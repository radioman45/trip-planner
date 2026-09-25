// 기기 간 동기화 엔드포인트 (Cloudflare Pages Function)
//
// KV 바인딩 이름: SYNC
// 바인딩이 없으면 503을 돌려주고, 페이지는 동기화 없이 그대로 동작합니다.
//
//   GET  /api/sync?code=xxxxxxxxxxxx  → { updatedAt, data }
//   PUT  /api/sync?code=xxxxxxxxxxxx  → { ok, updatedAt }

const CODE_RE = /^[a-z0-9]{12}$/;     // 연동 코드는 정확히 이 형태만 허용
const MAX_BYTES = 256 * 1024;          // 본문 상한 (KV 값 한도보다 훨씬 낮게)
const MAX_ITEMS = 500;                 // 배열 길이 상한
const MAX_STR = 200;                   // 문자열 필드 길이 상한
const CATEGORIES = ["맛집", "카페", "명소"];

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function str(v, max) {
  return typeof v === "string" ? v.slice(0, max || MAX_STR) : "";
}

function idList(v) {
  if (!Array.isArray(v)) return [];
  return v
    .filter(function (x) { return typeof x === "string" && x.length > 0 && x.length <= 80; })
    .slice(0, MAX_ITEMS);
}

// 클라이언트가 보낸 것을 그대로 믿지 않고 형태를 강제합니다.
function sanitize(data) {
  if (!data || typeof data !== "object") return null;
  const custom = Array.isArray(data.custom) ? data.custom : [];
  return {
    custom: custom
      .filter(function (p) {
        return p && typeof p === "object" &&
          typeof p.id === "string" && p.id.length > 0 && p.id.length <= 80 &&
          typeof p.name === "string" && p.name.trim().length > 0 &&
          typeof p.address === "string" && p.address.trim().length > 0 &&
          CATEGORIES.indexOf(p.category) !== -1 &&
          typeof p.region === "string" && p.region.length <= 40;
      })
      .slice(0, MAX_ITEMS)
      .map(function (p) {
        return {
          id: str(p.id, 80),
          name: str(p.name, 60),
          category: p.category,
          region: str(p.region, 40),
          address: str(p.address, 160),
          summary: str(p.summary, 200),
          highlight: str(p.highlight, 120),
          hours: str(p.hours, 80),
          price: str(p.price, 60),
          tip: str(p.tip, 200),
          custom: true,
        };
      }),
    saved: idList(data.saved),
    hidden: idList(data.hidden),
  };
}

export async function onRequest(context) {
  const request = context.request;
  const env = context.env;

  // KV 바인딩 미설정 — 페이지는 이 응답을 보고 동기화를 끕니다.
  if (!env || !env.SYNC) return json({ error: "sync_not_configured" }, 503);

  const url = new URL(request.url);
  const code = (url.searchParams.get("code") || "").toLowerCase();
  if (!CODE_RE.test(code)) return json({ error: "bad_code" }, 400);

  const key = "plan:" + code;

  if (request.method === "GET") {
    const raw = await env.SYNC.get(key);
    if (!raw) return json({ error: "not_found" }, 404);
    return new Response(raw, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  if (request.method === "PUT") {
    const text = await request.text();
    if (text.length > MAX_BYTES) return json({ error: "too_large" }, 413);

    let body;
    try {
      body = JSON.parse(text);
    } catch (e) {
      return json({ error: "bad_json" }, 400);
    }

    const data = sanitize(body && body.data);
    if (!data) return json({ error: "bad_shape" }, 400);

    const payload = { updatedAt: Date.now(), data: data };
    await env.SYNC.put(key, JSON.stringify(payload));
    return json({ ok: true, updatedAt: payload.updatedAt });
  }

  return json({ error: "method_not_allowed" }, 405);
}
