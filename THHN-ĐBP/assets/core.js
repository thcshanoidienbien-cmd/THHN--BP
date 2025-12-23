// assets/core.js — HEDU Core (SSOT chuẩn) — FIXED
// Teacher pages:
// - pages/teacher/teacher-dashboard.html
// - pages/teacher/teacher-tasks.html
// - pages/teacher/teacher-submissions.html
// - pages/teacher/teacher-grading.html
// - pages/teacher/teacher-insights.html

(function () {
  // ---------- Toast ----------
  function toast(msg) {
    const el = document.createElement("div");
    el.className = "toast show";
    el.textContent = String(msg ?? "");
    document.body.appendChild(el);
    setTimeout(() => el.classList.remove("show"), 2200);
    setTimeout(() => el.remove(), 2550);
  }
  window.toast = window.toast || toast;

  // ---------- Storage fallback ----------
  // Một số trình duyệt/extension (Tracking Prevention) có thể chặn localStorage,
  // khiến token biến mất và bị "tự out". Ta giữ thêm bản sao trong RAM + window.name.
  const __MEM_KEY__ = "__HEDU_MEM_SESSION__";
  const __WN_KEY__ = "hedu_session_wn";

  function _lsGet_(k){ try{ return localStorage.getItem(k); }catch(_){ return null; } }
  function _lsSet_(k,v){ try{ localStorage.setItem(k,v); return true; }catch(_){ return false; } }
  function _lsDel_(k){ try{ localStorage.removeItem(k); }catch(_){ } }

  function _wnRead_(){
    try{
      const raw = String(window.name||"{}");
      const obj = JSON.parse(raw);
      const hedu = obj && obj.__hedu__ ? obj.__hedu__ : null;
      if(hedu && hedu[__WN_KEY__]) return String(hedu[__WN_KEY__]||"");
    }catch(_){ }
    return "";
  }
  function _wnWrite_(raw){
    try{
      const base = String(window.name||"{}");
      const obj = JSON.parse(base);
      obj.__hedu__ = obj.__hedu__ || {};
      obj.__hedu__[__WN_KEY__] = String(raw||"");
      window.name = JSON.stringify(obj);
    }catch(_){
      try{ window.name = JSON.stringify({__hedu__:{[__WN_KEY__]:String(raw||"")}}); }catch(__){ }
    }
  }

  // ---------- URL helpers ----------
  function loginHref(role, returnTo){
  const u = new URL(window.location.href);
  const base = indexHref(); // ✅ đúng root dự án
  const r = role ? String(role).toUpperCase() : "";
  const rt = returnTo || (u.pathname + u.search + u.hash);

  const qs = new URLSearchParams();
  qs.set("login","1");
  if(r) qs.set("role", r);
  if(rt) qs.set("return", rt);

  return base + "?" + qs.toString();
}

  function indexHref() {
  const u = new URL(window.location.href);
  // lấy root theo việc có "pages/" hay không
  const parts = u.pathname.split("/").filter(Boolean);
  const i = parts.indexOf("pages");
  const root = (i >= 0)
    ? "/" + parts.slice(0, i).join("/") + "/"
    : "/" + parts.slice(0, Math.max(parts.length - 1, 0)).join("/") + "/";
  return u.origin + root + "index.html";
}


  function teacherBaseHref() {
    const u = new URL(window.location.href);
    const p = u.pathname;
    const idx = p.lastIndexOf("/pages/teacher/");
    if (idx >= 0) return u.origin + p.slice(0, idx + "/pages/teacher/".length);
    return u.origin + p.substring(0, p.lastIndexOf("/") + 1);
  }
  function teacherHref(file) {
    return teacherBaseHref() + String(file || "");
  }

  /***********************
 * HEDU SSOT Session (Triệt để)
 * - 1 key duy nhất: hedu_session
 * - 1 schema duy nhất: { token, role, displayName, classId, ... }
 * - 1 hàm dùng chung: getTokenOrLogin(role, opts)
 ***********************/
(function(){
  const SESSION_KEY = "hedu_session";

  function normRole_(r){
    return String(r || "").trim().toUpperCase();
  }

  function safeJson_(x, fallback=null){
    try { return JSON.parse(x); } catch(e){ return fallback; }
  }

  // localStorage có thể bị chặn (Tracking Prevention) -> fallback RAM + window.name
  function getSessionSSOT(){
    let s = null;
    // 1) localStorage
    try{
      s = safeJson_(localStorage.getItem(SESSION_KEY) || "null", null);
    }catch(_){ s = null; }

    // 2) RAM
    if(!s || typeof s !== "object"){
      try{
        const mem = window.__HEDU_MEM_SESSION__;
        if(mem && typeof mem === "object") s = { ...mem };
      }catch(_){ }
    }

    // 3) window.name
    if(!s || typeof s !== "object"){
      try{
        const name = window.name || "";
        const m = name.match(/(?:^|;)hedu_session_wn=([^;]+)(?:;|$)/);
        if(m && m[1]) s = safeJson_(decodeURIComponent(m[1]), null);
      }catch(_){ s = null; }
    }

    if(!s || typeof s !== "object") return null;

    // ✅ Chuẩn hoá token: ưu tiên token, fallback sessionId
    if(!s.token && s.sessionId) s.token = s.sessionId;

    // ✅ Chuẩn hoá role
    s.role = normRole_(s.role);

    // ✅ Token rỗng thì coi như không có session
    if(!s.token) return null;

    return s;
  }

  function setSessionSSOT(session){
    const s = session && typeof session === "object" ? { ...session } : null;
    if(!s){
      try{ localStorage.removeItem(SESSION_KEY); }catch(_){ }
      try{ delete window.__HEDU_MEM_SESSION__; }catch(_){ }
      try{ window.name = (window.name||"").replace(/(?:^|;)hedu_session_wn=[^;]*;?/g, ""); }catch(_){ }
      return;
    }
    if(!s.token && s.sessionId) s.token = s.sessionId;
    s.role = normRole_(s.role);
    // RAM
    try{ window.__HEDU_MEM_SESSION__ = { ...s }; }catch(_){ }
    // window.name
    try{
      const enc = encodeURIComponent(JSON.stringify(s));
      const base = (window.name || "").replace(/(?:^|;)hedu_session_wn=[^;]*;?/g, "");
      window.name = (base ? base.replace(/;\s*$/,'') + ';' : '') + `hedu_session_wn=${enc};`;
    }catch(_){ }
    // localStorage
    try{ localStorage.setItem(SESSION_KEY, JSON.stringify(s)); }catch(_){ }
  }

  function clearSessionSSOT(){
    try{ localStorage.removeItem(SESSION_KEY); }catch(_){ }
    try{ delete window.__HEDU_MEM_SESSION__; }catch(_){ }
    try{ window.name = (window.name||"").replace(/(?:^|;)hedu_session_wn=[^;]*;?/g, ""); }catch(_){ }
  }

  /**
   * ✅ Hàm “đập chết” session:
   * - Nếu đủ role + có token: trả về session (đã chuẩn hoá)
   * - Nếu thiếu: redirect về index.html để login (có returnUrl)
   *
   * opts:
   *  - returnUrl: mặc định = location.href
   *  - loginPath: mặc định = "../../index.html"
   *  - noRedirect: true => không redirect, chỉ throw Error
   */
  function getTokenOrLogin(requiredRole, opts={}){
    const roleNeed = normRole_(requiredRole);
    const s = getSessionSSOT();
    const ok = !!(s && s.token && (!roleNeed || s.role === roleNeed));

    if(ok) return s;

    const returnUrl = opts.returnUrl || location.href;
    const loginPath = opts.loginPath || "../../index.html"; // pages/*/* -> ../../index.html
    const noRedirect = !!opts.noRedirect;

    const msg = !s
      ? "Chưa đăng nhập."
      : `Sai quyền. Cần ${roleNeed}, hiện tại ${s.role || "UNKNOWN"}.`;

    if(noRedirect){
      throw new Error(msg);
    }

    // ✅ Redirect có returnUrl để login xong quay lại đúng trang
    const u = new URL(loginPath, location.href);
    u.searchParams.set("login", "1");
    if(roleNeed) u.searchParams.set("role", roleNeed);
    u.searchParams.set("return", returnUrl);

    location.replace(u.toString());
    // chặn code chạy tiếp
    throw new Error("Redirecting to login...");
  }

  // ✅ Export ra window để mọi trang dùng
  window.HEDU_SESSION_KEY = SESSION_KEY;
  window.getSessionSSOT = getSessionSSOT;
  window.setSessionSSOT = setSessionSSOT;
  window.clearSessionSSOT = clearSessionSSOT;
  window.getTokenOrLogin = getTokenOrLogin;

  // NOTE: requireRole sẽ được export ở cuối file (1 lần duy nhất) để tránh ghi đè.
})();


  // ---------- Session SSOT wrappers (không còn legacy normalize) ----------
  function getSession(){
    try{ return (typeof window.getSessionSSOT === "function") ? window.getSessionSSOT() : null; }
    catch(_){ return null; }
  }
  function saveSession(sessionLike){
    try{ if(typeof window.setSessionSSOT === "function") return window.setSessionSSOT(sessionLike); }
    catch(_){ }
    try{ localStorage.setItem("hedu_session", JSON.stringify(sessionLike||null)); }catch(_){ }
  }
  function clearSession(){
    try{ if(typeof window.clearSessionSSOT === "function") return window.clearSessionSSOT(); }
    catch(_){ }
    try{ localStorage.removeItem("hedu_session"); }catch(_){ }
  }
  function getToken(){
    const s = getSession();
    return s && s.token ? String(s.token) : "";
  }

  // ---------- SSOT Teacher classId ----------
  // 1) ưu tiên lớp teacher đang chọn (hedu_teacher_classId)
  // 2) fallback lớp trong session
  // 3) fallback hedu_class / rw_class
  function getTeacherClassId(fallback = "") {
    const s = getSession();
    return (
      localStorage.getItem("hedu_teacher_classId") ||
      s?.classId ||
      localStorage.getItem("hedu_class") ||
      localStorage.getItem("rw_class") ||
      fallback ||
      ""
    );
  }

  function setTeacherClassId(cid) {
    const v = String(cid || "").trim().toUpperCase();
    if (!v) return "";
    localStorage.setItem("hedu_teacher_classId", v);
    localStorage.setItem("hedu_class", v); // giữ tương thích
    updateTopbarClassBadge();
    return v;
  }

  // ---------- Auth guards ----------
  function requireRole(role) {
  const s = getSession();
  const need = role
    ? (Array.isArray(role) ? role : [role]).map(x => String(x).toUpperCase())
    : [];

  if (!s || !s.token) {
    const r = need[0] || "";
    window.location.href = loginHref(r);
    return null;
  }

  if (need.length) {
    const has = String(s.role || "").toUpperCase();
    if (!need.includes(has)) {
      clearSession();
      window.location.href = loginHref(need[0] || "");
      return null;
    }
  }

  return s;
}

  function logout() {
    clearSession();
    window.location.href = indexHref();
  }

  // ---------- Teacher badge update (UI do teacher.js đảm nhiệm) ----------
  function updateTopbarClassBadge() {
    // Nếu teacher.js có badge riêng, cập nhật qua API đó
    try {
      if (typeof window.setTeacherHeaderBadge === "function") {
        window.setTeacherHeaderBadge(getTeacherClassId("") || "");
      }
    } catch (_) {}
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ---------- export ----------
  window.toast = window.toast || toast;

  // ✅ Public SSOT
  window.saveSession = saveSession;
  window.getSession = getSession;
  window.clearSession = clearSession;
  window.requireRole = requireRole;
  window.logout = logout;
  window.getToken = getToken;

  // teacher SSOT
  window.getTeacherClassId = getTeacherClassId;
  window.setTeacherClassId = setTeacherClassId;
  window.updateTopbarClassBadge = updateTopbarClassBadge;

  // nav helpers
  window.teacherBaseHref = teacherBaseHref;
  window.teacherHref = teacherHref;

  // UI: Teacher topbar dùng assets/teacher.js (tránh trùng hàm)
  window.loginHref = loginHref;
  window.indexHref = indexHref;
})();
