// 다크/라이트 모드 전환 (head에서 불러와 화면 깜빡임 없이 저장된 테마를 먼저 적용)
(function () {
  const STORAGE_KEY = "theme";
  const root = document.documentElement;
  const media = window.matchMedia("(prefers-color-scheme: dark)");

  function getSaved() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function save(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {
      // 저장이 막힌 환경에서는 이번 방문 동안만 적용
    }
  }

  // 저장된 값이 없으면 운영체제 설정을 따른다
  function currentTheme() {
    return root.dataset.theme || (media.matches ? "dark" : "light");
  }

  function updateButtons() {
    const isDark = currentTheme() === "dark";
    document.querySelectorAll(".theme-toggle").forEach((btn) => {
      btn.textContent = isDark ? "☀️" : "🌙";
      btn.setAttribute("aria-label", isDark ? "라이트 모드로 전환" : "다크 모드로 전환");
      btn.title = isDark ? "라이트 모드" : "다크 모드";
    });
  }

  // 선택한 테마를 select 드롭다운·스크롤바 등 브라우저 기본 요소에도 반영
  function apply(theme) {
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
  }

  const saved = getSaved();
  if (saved === "light" || saved === "dark") {
    apply(saved);
  }

  document.addEventListener("DOMContentLoaded", () => {
    updateButtons();
    document.querySelectorAll(".theme-toggle").forEach((btn) => {
      btn.addEventListener("click", () => {
        const next = currentTheme() === "dark" ? "light" : "dark";
        apply(next);
        save(next);
        updateButtons();
      });
    });
  });

  // 사용자가 직접 고르지 않았다면 운영체제 테마 변경을 따라간다
  const onSystemChange = () => {
    if (!root.dataset.theme) updateButtons();
  };
  // 구형 Safari는 addEventListener 대신 addListener만 지원
  if (media.addEventListener) {
    media.addEventListener("change", onSystemChange);
  } else {
    media.addListener(onSystemChange);
  }
})();
