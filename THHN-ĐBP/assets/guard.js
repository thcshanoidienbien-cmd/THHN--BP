// assets/guard.js — TRIỆT ĐỂ chống "entry phá" + fix root path

(function () {
  // ===== detect APP_ROOT =====
  const APP_ROOT = (() => {
    const p = location.pathname.replace(/\\/g, "/");
    // nếu có THHN-ĐBP trong path thì lấy root tới đó
    const m = p.match(/^(.*\/THHN-ĐBP\/)/);
    if (m) return m[1];
    // fallback: cùng thư mục hiện tại
    return new URL("./", location.href).pathname;
  })();

  window.APP_ROOT = APP_ROOT;

  // ===== block mọi điều hướng sai về /login.html hoặc login.html =====
  function normalizeUrl(u) {
    try { return new URL(u, location.href).href; } catch { return String(u || ""); }
  }
  function isBadLoginUrl(u) {
    const href = normalizeUrl(u);
    return /\/login\.html(\?|#|$)/i.test(href) || /(^|\/)login\.html(\?|#|$)/i.test(href);
  }
  function safeGoIndex(extra = "") {
    const q = extra ? (extra.startsWith("?") ? extra : "?" + extra) : "";
    location.assign(APP_ROOT + "index.html" + q);
  }

  // patch assign/replace để chặn tuyệt đối
  const _assign = location.assign.bind(location);
  const _replace = location.replace.bind(location);

  location.assign = function (url) {
    if (isBadLoginUrl(url)) return safeGoIndex("login=1");
    return _assign(url);
  };
  location.replace = function (url) {
    if (isBadLoginUrl(url)) return safeGoIndex("login=1");
    return _replace(url);
  };

  // patch window.open nếu có
  const _open = window.open.bind(window);
  window.open = function (url, name, specs) {
    if (isBadLoginUrl(url)) {
      safeGoIndex("login=1");
      return null;
    }
    return _open(url, name, specs);
  };

  // helper chung
  window.goIndex = function (params = "") {
    const q = params ? (params.startsWith("?") ? params : "?" + params) : "";
    location.assign(APP_ROOT + "index.html" + q);
  };

})();
