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

  function getSessionSSOT(){
    const s = safeJson_(localStorage.getItem(SESSION_KEY) || "null", null);
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
      localStorage.removeItem(SESSION_KEY);
      return;
    }
    if(!s.token && s.sessionId) s.token = s.sessionId;
    s.role = normRole_(s.role);
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  }

  function clearSessionSSOT(){
    localStorage.removeItem(SESSION_KEY);
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

  /**
   * ✅ Tương thích ngược:
   * Nếu ông chủ đang dùng requireRole("TEACHER")... thì ép nó gọi SSOT
   * (nếu requireRole đã tồn tại, mình override nhẹ nhàng để chuẩn hoá hành vi)
   */
  window.requireRole = function(role){
    return getTokenOrLogin(role, { loginPath: "../../index.html" });
  };
})();

  // ---------- Session normalize ----------
  function normalizeSession(input) {
    const s = (input && input.session) ? input.session : (input || {});
    const user = s.user || s.userInfo || s.profile || s || null;

    const role = String(s.role || user?.role || "").toUpperCase();
    const token = String(s.token || s.sessionId || user?.token || user?.sessionId || "");

    const schoolYear = s.schoolYear || s.year || user?.schoolYear || user?.year || "";
    const classId =
      s.classId ||
      user?.classId ||
      localStorage.getItem("hedu_class") ||
      localStorage.getItem("rw_class") ||
      "";

    const userId = s.userId || user?.userId || user?.id || "";
    const displayName =
      s.displayName ||
      user?.displayName ||
      user?.fullName ||
      user?.name ||
      localStorage.getItem("hedu_teacher_name") ||
      "";

    return { token, role, schoolYear, classId, userId, displayName, user };
  }

  function saveSession(session, opts = {}) {
    const norm = normalizeSession(session);
    localStorage.setItem("hedu_session", JSON.stringify(norm));
    if (typeof opts.remember !== "undefined") {
      localStorage.setItem("hedu_remember", opts.remember ? "1" : "0");
    }
    if (norm.classId) localStorage.setItem("hedu_class", String(norm.classId).trim().toUpperCase());
    if (norm.displayName) localStorage.setItem("hedu_teacher_name", norm.displayName);
  }

  function getSession() {
    try {
      const raw = localStorage.getItem("hedu_session");
      if (raw) return normalizeSession(JSON.parse(raw));
    } catch (_) {}

    // legacy: rw_user
    try {
      const ru = JSON.parse(localStorage.getItem("rw_user") || "null");
      if (ru) {
        return normalizeSession({
          user: ru,
          role: ru.role,
          token: ru.token,
          classId: localStorage.getItem("rw_class") || "",
        });
      }
    } catch (_) {}

    return null;
  }

  function clearSession() {
    localStorage.removeItem("hedu_session");
    localStorage.removeItem("hedu_remember");
    localStorage.removeItem("hedu_teacher_name");
    localStorage.removeItem("hedu_class");
    localStorage.removeItem("hedu_teacher_classId");

    // legacy cleanup
    localStorage.removeItem("rw_user");
    localStorage.removeItem("rw_class");
  }

  function getToken() {
    const s = getSession();
    return s?.token ? String(s.token) : "";
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

  // ---------- Teacher Topbar (5 pages FINAL) ----------
  function renderTeacherTopbar(active = "") {
    const s = getSession();
    const name = s?.displayName || "Giáo viên";
    const cls = getTeacherClassId("—") || "—";
    const subject =
      (window.getConfig?.().DEFAULT_SUBJECT) ||
      (window.HEDU_CONFIG?.DEFAULT_SUBJECT) ||
      "";

    const nav = [
      { key: "dashboard", label: "Dashboard", href: "teacher-dashboard.html" },
      { key: "tasks", label: "Ngân hàng bài", href: "teacher-tasks.html" },
      { key: "subs", label: "Bài nộp", href: "teacher-submissions.html" },
      { key: "grading", label: "Chấm/nhận xét", href: "teacher-grading.html" },
      { key: "insights", label: "Insights", href: "teacher-insights.html" },
    ];

    const host = document.getElementById("topbar");
    if (!host) return;

    host.innerHTML = `
      <div class="topbar">
        <div class="inner">
          <div class="brand">
            <div class="logo">H</div>
            <div class="meta">
              <div class="title">HEDU • Portal Giáo viên</div>
              <div class="sub">
                GV: <b>${escapeHtml(name)}</b>
                • Lớp: <b id="heduTopbarClass">${escapeHtml(cls)}</b>
                ${subject ? ` • <span style="color:#64748b">${escapeHtml(subject)}</span>` : ""}
              </div>
            </div>
          </div>

          <div class="nav">
            ${nav
              .map(
                (i) =>
                  `<a class="chip ${active === i.key ? "active" : ""}" href="${escapeHtml(
                    i.href
                  )}">${escapeHtml(i.label)}</a>`
              )
              .join("")}
          </div>

          <div class="top-actions">
            <button class="btn ghost" id="btnLogout" type="button">Đăng xuất</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById("btnLogout")?.addEventListener("click", logout);
  }

  function updateTopbarClassBadge() {
    const el = document.getElementById("heduTopbarClass");
    if (!el) return;
    el.textContent = getTeacherClassId("—") || "—";
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

  window.normalizeSession = normalizeSession;
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

  // UI
  window.renderTeacherTopbar = renderTeacherTopbar;
  window.loginHref = loginHref;
  window.indexHref = indexHref;
})();
