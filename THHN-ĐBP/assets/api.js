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
      // Ưu tiên SSOT từ core.js (có fallback khi localStorage bị chặn)
      if (typeof window.getSession === "function") {
        const ss = window.getSession();
        if (ss && (ss.token || ss.sessionId || ss.sid)) {
          return String(ss.token || ss.sessionId || ss.sid || "");
        }
      }
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
      // Đồng bộ sang core.js để giữ session khi localStorage bị chặn
      try {
        if (typeof window.saveSession === "function") {
          window.saveSession(raw);
        }
      } catch (_) {}
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

  function shouldAutoLogout_(action, hadToken) {
    // Nếu request không có token (do storage bị chặn/đang init) thì KHÔNG auto logout.
    if (!hadToken) return false;
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

  // Robust JSONP:
  // - Defines a *real global function* (function declaration) so the callback name
  //   always exists when the remote script executes (fix intermittent: "cb is not defined").
  // - Uses a shared router map to resolve Promises.
  function jsonp_(action, payload = {}) {
    return new Promise((resolve) => {
      const SCRIPT_URL = getScriptUrl_();
      const cb = "__HEDU_JSONP_" + Date.now() + "_" + Math.random().toString(16).slice(2);

      // One-time router
      if (!window.__HEDU_JSONP_MAP) window.__HEDU_JSONP_MAP = Object.create(null);
      if (typeof window.__HEDU_JSONP_ROUTE !== "function") {
        window.__HEDU_JSONP_ROUTE = function (name, data) {
          const item = window.__HEDU_JSONP_MAP && window.__HEDU_JSONP_MAP[name];
          if (!item || item.done) return;
          item.done = true;
          try { item.cleanup && item.cleanup(); } catch (_) {}
          item.resolve && item.resolve(data);
        };
      }

      const url = buildUrl_(SCRIPT_URL, {
        action,
        payload: JSON.stringify({ action, ...payload }),
        callback: cb
      });

      let done = false;
      let keepCb = false;
      // Apps Script đôi lúc "cold start" nên giữ timeout dài hơn để tránh timeout giả.
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        // Nếu timeout nhưng script về sau mới tải xong và gọi callback,
        // việc xoá callback ngay lập tức sẽ gây lỗi "... is not a function".
        // Ta giữ lại callback dạng no-op trong một khoảng ngắn.
        keepCb = true;
        try{ window[cb] = function(){ /* ignore late response */ }; }catch(_){ }
        cleanup();
        resolve({ ok: false, error: "JSONP load timeout" });
      }, 25000);

      let declScript = null;
      let remoteScript = null;

      function cleanup() {
        try { delete window.__HEDU_JSONP_MAP[cb]; } catch (_) {}
        try { if (declScript && declScript.parentNode) declScript.parentNode.removeChild(declScript); } catch (_) {}
        try { if (remoteScript && remoteScript.parentNode) remoteScript.parentNode.removeChild(remoteScript); } catch (_) {}
        // Try to remove the binding as well.
        // Nếu đã timeout, giữ no-op callback thêm 5s để tránh console error
        // khi response về muộn và vẫn gọi callback.
        if (keepCb) {
          try { setTimeout(() => { try{ delete window[cb]; }catch(_){ window[cb]=undefined; } }, 5000); } catch (_) {}
        } else {
          try { delete window[cb]; } catch (_) { window[cb] = undefined; }
        }
        clearTimeout(timer);
      }

      // Register in map
      window.__HEDU_JSONP_MAP[cb] = { resolve, cleanup, done: false };

      // Create a *function declaration* for callback name.
      // This ensures the identifier exists for the remote script.
      declScript = document.createElement("script");
      declScript.text = "function " + cb + "(data){ try{ window.__HEDU_JSONP_ROUTE('" + cb + "', data); }catch(e){} }";
      document.head.appendChild(declScript);

      remoteScript = document.createElement("script");
      remoteScript.src = url;
      remoteScript.async = true;
      remoteScript.onerror = () => {
        if (done) return;
        done = true;
        cleanup();
        resolve({ ok: false, error: "JSONP load error" });
      };
      document.head.appendChild(remoteScript);
    });
  }

  /*********************
   * CORE POST
   *********************/
  function shouldUseJsonpFirst_(){
    try{
      const loc = window.location;
      const host = String(loc.hostname || "");
      const proto = String(loc.protocol || "");

      // Chỉ dùng JSONP khi chạy file://.
      // Localhost/hosted: ưu tiên fetch để tránh lỗi JSONP callback.
      if (proto === "file:") return true;
      // ⚠️ KHÔNG dùng JSONP-first cho 127.0.0.1/localhost nữa.

      // ✅ Không ép JSONP theo khác origin nữa.
      // Apps Script backend của dự án đã bật CORS; JSONP dễ lỗi callback.
      // Vì vậy chỉ bật JSONP-first khi chạy file://.
    }catch(_){
      // ignore
    }
    return false;
  }

  async function corePost_(action, payload = {}) {
    const SCRIPT_URL = getScriptUrl_();
    const act = String(action || "");
    const p = normalizePayload_(act, payload);
    const bodyObj = Object.assign({ action: act }, p);

    // ✅ JSONP-first in local dev to avoid CORS noise & blocked responses
    if (shouldUseJsonpFirst_()) {
      const j = await jsonp_(act, p);
      return postProcess_(act, p, j);
    }

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

    if (!attachingOk_(res)) {
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
   * ✅ FIX SSOT: AUTO ok:true IF BACKEND DOES NOT RETURN ok
   *********************/
  function forceOk_(data) {
    try {
      if (data && typeof data === "object" && !Array.isArray(data)) {
        if (!("ok" in data)) data.ok = true; // ✅ bọc ok=true cho endpoint legacy (adminListYears,...)
      }
    } catch (_) {}
    return data;
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
    // ✅ IMPORTANT: normalize ok before any consumer checks it
    data = forceOk_(data);

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
      // Chỉ auto-logout khi thực sự có token gửi lên (tránh "tự out" do storage bị chặn)
      const hadToken = !!(payload && (payload.token || payload.sessionId || payload.sid)) || !!getToken_();
      if (data && data.ok === false && shouldAutoLogout_(action, hadToken)) {
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
