// assets/api.js — HEDU SSOT ULTRA (POST first, JSONP fallback, auto-session, auto-kill-session)
(function () {
  "use strict";

  /*********************
   * CONFIG
   *********************/
  function getConfig_() {
    try {
      return (typeof getConfig === "function") ? (getConfig() || {}) : (window.HEDU_CONFIG || {});
    } catch (_) {
      return (window.HEDU_CONFIG || {});
    }
  }

  function getScriptUrl_() {
    const cfg = getConfig_();
    const u = (cfg && cfg.SCRIPT_URL) ? String(cfg.SCRIPT_URL).trim() : "";
    const w = (window.SCRIPT_URL ? String(window.SCRIPT_URL).trim() : "");
    const url = u || w;
    if (!url) throw new Error("Missing SCRIPT_URL (check assets/config.js loaded before api.js)");
    return url;
  }

  /*********************
   * SESSION SSOT
   * - ưu tiên dùng core.js nếu có (saveSession/clearSession/loginHref)
   * - fallback localStorage nếu page chưa load core.js
   *********************/
  const SESSION_KEY = "hedu_session";

  function _rawSession_() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); }
    catch (_) { return null; }
  }

  function _setRawSession_(s) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(s || null)); } catch (_) {}
  }

  function getToken_() {
    try {
      const s = _rawSession_();
      if (!s) return "";
      return String(s.token || s.sessionId || s.sid || "");
    } catch (_) {
      return "";
    }
  }

  function setToken_(t) {
    try {
      const raw = _rawSession_() || {};
      const tok = String(t || "");
      if (tok) {
        raw.token = raw.token || tok;
        raw.sessionId = raw.sessionId || tok;
      } else {
        delete raw.token;
        delete raw.sessionId;
      }
      _setRawSession_(raw);
    } catch (_) {}
  }

  function saveSession_(sessionLike) {
    // Ưu tiên core.js nếu có (chuẩn normalizeSession)
    try {
      if (typeof window.saveSession === "function") {
        window.saveSession(sessionLike);
        return;
      }
    } catch (_) {}

    // Fallback: lưu thô nhưng cố normalize tối thiểu
    try {
      const s = sessionLike && sessionLike.session ? sessionLike.session : (sessionLike || {});
      const user = s.user || s.userInfo || s.profile || s || null;

      const role = String(s.role || user?.role || "").toUpperCase();
      const token = String(s.token || s.sessionId || user?.token || user?.sessionId || "");

      const classId = s.classId || user?.classId || localStorage.getItem("hedu_class") || localStorage.getItem("rw_class") || "";
      const displayName = s.displayName || user?.displayName || user?.fullName || user?.name || localStorage.getItem("hedu_teacher_name") || "";

      const out = Object.assign({}, s, { role, token, sessionId: token || s.sessionId, classId, displayName, user });
      _setRawSession_(out);

      if (classId) localStorage.setItem("hedu_class", String(classId).trim().toUpperCase());
      if (displayName) localStorage.setItem("hedu_teacher_name", String(displayName));
    } catch (_) {}
  }

  function clearSession_() {
    // Ưu tiên core.js nếu có (dọn sạch legacy)
    try {
      if (typeof window.clearSession === "function") {
        window.clearSession();
        return;
      }
    } catch (_) {}

    // Fallback: dọn sạch các key hay dùng
    try {
      localStorage.removeItem("hedu_session");
      localStorage.removeItem("hedu_remember");
      localStorage.removeItem("hedu_teacher_name");
      localStorage.removeItem("hedu_class");
      localStorage.removeItem("hedu_teacher_classId");

      // legacy cleanup
      localStorage.removeItem("rw_user");
      localStorage.removeItem("rw_class");
    } catch (_) {}
  }

  /*********************
   * LOGIN REDIRECT (return đúng trang)
   *********************/
  function indexHref_() {
    // Ưu tiên core.js nếu có
    try {
      if (typeof window.indexHref === "function") return window.indexHref();
    } catch (_) {}

    // Fallback: tìm root theo "pages/"
    const u = new URL(window.location.href);
    const parts = u.pathname.split("/").filter(Boolean);
    const i = parts.indexOf("pages");
    const root = (i >= 0)
      ? "/" + parts.slice(0, i).join("/") + "/"
      : "/" + parts.slice(0, Math.max(parts.length - 1, 0)).join("/") + "/";
    return u.origin + root + "index.html";
  }

  function loginHref_(role, returnTo) {
    // Ưu tiên core.js nếu có
    try {
      if (typeof window.loginHref === "function") return window.loginHref(role, returnTo);
    } catch (_) {}

    const base = indexHref_();
    const rt = returnTo || (window.location.pathname + window.location.search + window.location.hash);
    const qs = new URLSearchParams();
    qs.set("login", "1");
    if (role) qs.set("role", String(role).toUpperCase());
    if (rt) qs.set("return", rt);
    return base + "?" + qs.toString();
  }

  function redirectLogin_(role) {
    const url = loginHref_(role || "", (window.location.pathname + window.location.search + window.location.hash));
    // Dùng replace để tránh “Back” quay lại trang lỗi session
    window.location.replace(url);
  }

  /*********************
   * SESSION ERROR DETECT — “đập chết” triệt để
   *********************/
  function isSessionError_(msg) {
    const m = String(msg || "").toLowerCase();
    // Cụm phổ biến trong Apps Script/SSOT
    return (
      m.includes("phiên đăng nhập") ||
      m.includes("het han") || m.includes("hết hạn") ||
      m.includes("không đủ quyền") ||
      m.includes("unauthorized") ||
      m.includes("forbidden") ||
      m.includes("invalid token") ||
      m.includes("token expired") ||
      m.includes("not logged") ||
      m.includes("need login")
    );
  }

  function shouldAutoLogout_(action) {
    // các action login/public không nên auto logout
    const a = String(action || "");
    if (!a) return true;
    return !(
      a.includes("authTeacherLogin") ||
      a.includes("authStudentLogin") ||
      a.includes("authParentLogin") ||
      a.includes("authAdminLogin") ||
      a.includes("listClassesPublic")
    );
  }

  function normalizePayload_(action, payload) {
    const p = Object.assign({}, payload || {});
    const a = String(action || "");

    // Attach token auto (chỉ khi page chưa truyền)
    const t = getToken_();
    if (t) {
      if (p.token == null) p.token = t;
      if (p.sessionId == null) p.sessionId = t;
    }

    // ---- Aliases by action: backend kiểu gì cũng nhận
    // Teacher
    if (a === "authTeacherLogin") {
      if (p.username != null && p.account == null) p.account = p.username;
      if (p.password != null && p.pass == null) p.pass = p.password;
      if (p.password != null && p.pwd == null) p.pwd = p.password;
      if (p.password != null && p.passwordText == null) p.passwordText = p.password;
    }
    if (a === "authTeacherRegister") {
      if (p.fullName != null && p.name == null) p.name = p.fullName;
      if (p.phone != null && p.account == null) p.account = p.phone; // nhiều backend dùng phone làm account
    }

    // Student
    if (a === "authStudentLogin") {
      if (p.studentCode != null && p.studentId == null) p.studentId = p.studentCode;
      if (p.code != null && p.studentId == null) p.studentId = p.code;
    }

    // Parent
    if (a === "authParentLogin") {
      if (p.studentCode != null && p.studentId == null) p.studentId = p.studentCode;
      if (p.code != null && p.studentId == null) p.studentId = p.code;
    }

    // Admin
    if (a === "authAdminLogin") {
      if (p.code != null && p.adminCode == null) p.adminCode = p.code;
      if (p.admin_code != null && p.adminCode == null) p.adminCode = p.admin_code;
    }

    // Logout
    if (a === "authLogout") {
      const tok = p.token || p.sessionId || t || "";
      if (tok) {
        p.token = p.token || tok;
        p.sessionId = p.sessionId || tok;
      }
    }

    return p;
  }

  /*********************
   * JSONP fallback
   * NOTE: backend phải hỗ trợ doGet JSONP (action/payload/callback)
   *********************/
  function buildUrl_(base, params) {
    const u = new URL(base);
    Object.keys(params).forEach(k => u.searchParams.set(k, params[k]));
    return u.toString();
  }

  function jsonp_(action, payload = {}) {
    return new Promise((resolve) => {
      const SCRIPT_URL = getScriptUrl_();
      const cb = "__HEDU_JSONP_" + Date.now() + "_" + Math.random().toString(16).slice(2);
      const url = buildUrl_(SCRIPT_URL, {
        action,
        payload: JSON.stringify({ action, ...payload }),
        callback: cb
      });

      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        cleanup();
        resolve({ ok: false, error: "JSONP load timeout" });
      }, 12000);

      function cleanup() {
        try { delete window[cb]; } catch (_) { window[cb] = undefined; }
        if (script && script.parentNode) script.parentNode.removeChild(script);
        clearTimeout(timer);
      }

      window[cb] = (data) => {
        if (done) return;
        done = true;
        cleanup();
        resolve(data);
      };

      const script = document.createElement("script");
      script.src = url;
      script.async = true;
      script.onerror = () => {
        if (done) return;
        done = true;
        cleanup();
        resolve({ ok: false, error: "JSONP load error" });
      };
      document.head.appendChild(script);
    });
  }

  /*********************
   * CORE POST
   *********************/
  async function corePost_(action, payload = {}) {
    const SCRIPT_URL = getScriptUrl_();
    const act = String(action || "");
    const p = normalizePayload_(act, payload);
    const bodyObj = Object.assign({ action: act }, p);

    let res, txt;
    try {
      res = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" }, // simple request cho Apps Script
        body: JSON.stringify(bodyObj),
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
      });
      txt = await res.text();
    } catch (e) {
      // Fallback JSONP when fetch blocked
      const j = await jsonp_(act, p);
      // JSONP cũng phải qua pipeline session
      return postProcess_(act, p, j);
    }

    if (! attachingOk_(res)) {
      const dataErr = { ok: false, error: "HTTP " + (res ? res.status : "0"), raw: txt };
      return postProcess_(act, p, dataErr);
    }

    let data;
    try { data = JSON.parse(txt); }
    catch (_) { data = { ok: false, error: "Invalid JSON from server", raw: txt }; }

    return postProcess_(act, p, data);
  }

  function attachingOk_(res) {
    return !!(res && res.ok);
  }

  /*********************
   * POST PROCESS:
   * - auto save session when response has session/token
   * - auto kill session on session errors
   *********************/
  function extractTokenFromResponse_(data) {
    if (!data) return "";
    // phổ biến: data.session.token | data.session.sessionId | data.token
    const s = data.session || data.user || null;
    const t =
      (s && (s.token || s.sessionId)) ||
      data.token ||
      data.sessionId ||
      "";
    return String(t || "");
  }

  function postProcess_(action, payload, data) {
    // 1) Auto save session if returned
    try {
      if (data && data.session) {
        saveSession_(data.session);
        const tok = extractTokenFromResponse_(data);
        if (tok) setToken_(tok);
      } else {
        const tok = extractTokenFromResponse_(data);
        // một số endpoint trả token rời
        if (tok) setToken_(tok);
      }
    } catch (_) {}

    // 2) Auto kill session on auth errors (protected actions)
    try {
      if (data && data.ok === false && shouldAutoLogout_(action)) {
        const msg = String(data.error || data.message || "");
        if (isSessionError_(msg)) {
          clearSession_();
          // role ưu tiên lấy từ session cũ (nếu có), rồi mới payload.role
          let role = "";
          try {
            const s = _rawSession_();
            role = String(s?.role || payload?.role || "");
          } catch (_) {
            role = String(payload?.role || "");
          }
          redirectLogin_(role);
          // chặn page chạy tiếp (nếu page có try/catch thì vẫn không phá UI)
          throw new Error("SESSION_KILLED_REDIRECT_LOGIN");
        }
      }
    } catch (_) {}

    return data;
  }

  /*********************
   * EXPORT
   *********************/
  window.__heduApiPost = corePost_;
  window.apiPost = corePost_;
  window.apiCall = corePost_;
  window.api = corePost_; // alias cho page cũ

  window.__heduGetToken = getToken_;
  window.__heduSetToken = setToken_;
})();
