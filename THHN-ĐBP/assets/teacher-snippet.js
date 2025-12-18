// assets/teacher-snippet.js — HEDU Teacher Page Bootstrap (SSOT)
// Works with: teacher-dashboard.html, teacher-tasks.html, teacher-submissions.html, teacher-grading.html, teacher-insights.html
// Requires: config.js + core.js + api.js loaded BEFORE this file.

(function () {
  // ---------- helpers ----------
  function esc(s) {
    return String(s ?? "").replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
  }

  function fallbackToast(msg) {
    const t = document.getElementById("toast");
    if (!t) return alert(String(msg || ""));
    t.hidden = false;
    t.textContent = msg || "—";
    t.classList.add("show");
    clearTimeout(window.__t);
    window.__t = setTimeout(() => {
      t.classList.remove("show");
      t.hidden = true;
    }, 2400);
  }

  function toast(msg) {
    if (typeof window.toast === "function") return window.toast(msg);
    return fallbackToast(msg);
  }

  function detectActiveKeyFromPath() {
    const p = String(location.pathname || "").toLowerCase();
    if (p.includes("teacher-dashboard") || p.includes("/dashboard")) return "dashboard";
    if (p.includes("teacher-tasks") || p.includes("/tasks")) return "tasks";
    if (p.includes("teacher-submissions") || p.includes("/submissions")) return "subs";
    if (p.includes("teacher-grading") || p.includes("/grading")) return "grading";
    if (p.includes("teacher-insights") || p.includes("/insights")) return "insights";
    return "";
  }

  // ---------- core SSOT wrappers ----------
  function getTeacherClassIdSafe() {
    if (typeof window.getTeacherClassId === "function") return window.getTeacherClassId();
    try {
      const s = typeof window.getSession === "function" ? window.getSession() : null;
      return (
        localStorage.getItem("hedu_teacher_classId") ||
        s?.classId ||
        localStorage.getItem("hedu_class") ||
        "5A1"
      );
    } catch (_) {
      return "5A1";
    }
  }

  function setTeacherClassIdSafe(cid) {
    cid = String(cid || "").trim().toUpperCase();
    if (!cid) return;
    if (typeof window.setTeacherClassId === "function") return window.setTeacherClassId(cid);
    localStorage.setItem("hedu_teacher_classId", cid);
    localStorage.setItem("hedu_class", cid);
  }

  // ---------- bootstrap ----------
  function bootstrapTeacherPage() {
    // 1) require teacher
    const session = typeof window.requireRole === "function" ? window.requireRole("TEACHER") : null;
    if (!session) return; // requireRole will redirect to login

    // 2) expose globals for page scripts
    const token = session?.token || (typeof window.getToken === "function" ? window.getToken() : "") || "";
    const classId = getTeacherClassIdSafe() || "5A1";

    window.HEDU_T = {
      session,
      token,
      classId,
      esc,
      toast,
      getClassId: getTeacherClassIdSafe,
      setClassId: setTeacherClassIdSafe,
    };

    // 3) set "me" pill if exists
    const me = document.getElementById("me");
    if (me) me.textContent = `${session?.displayName || "Giáo viên"} • ${classId}`;

    // 4) set classId input if exists
    const classInput = document.getElementById("classId");
    if (classInput && (classInput.tagName === "INPUT" || classInput.tagName === "SELECT")) {
      try {
        classInput.value = classId;
      } catch (_) {}
    }

    // 5) render topbar
    const key =
      (document.body && document.body.getAttribute("data-active")) ||
      detectActiveKeyFromPath();
    if (typeof window.renderTeacherTopbar === "function") {
      window.renderTeacherTopbar(String(key || ""));
    }

    // 6) optional: auto-bind a <select id="classSelect"> if page has it
    const sel = document.getElementById("classSelect");
    if (sel && sel.tagName === "SELECT") {
      // if page already populated options, just set + listen
      sel.value = classId;

      sel.addEventListener("change", () => {
        const v = String(sel.value || "").trim().toUpperCase();
        if (!v) return;
        setTeacherClassIdSafe(v);
        toast("Đã chọn lớp ✅");
        // reload page to refresh data if page doesn't implement reactive reload
        setTimeout(() => location.reload(), 250);
      });
    }
  }

  // run when DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrapTeacherPage);
  } else {
    bootstrapTeacherPage();
  }
})();
