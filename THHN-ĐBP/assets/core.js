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
  function loginHref() {
    const u = new URL(window.location.href);
    return u.origin + "/login.html";
  }
  function indexHref() {
    const u = new URL(window.location.href);
    return u.origin + "/index.html";
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
    if (!s || !s.token) {
      window.location.href = loginHref();
      return null;
    }
    if (role) {
      const need = Array.isArray(role)
        ? role.map((x) => String(x).toUpperCase())
        : [String(role).toUpperCase()];
      const has = String(s.role || "").toUpperCase();
      if (!need.includes(has)) {
        clearSession();
        window.location.href = loginHref();
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
