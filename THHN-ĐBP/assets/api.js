// assets/api.js — HEDU SSOT ULTRA PRO (POST first, JSONP fallback, auto-session, auto-kill-session)
// ✅ PRO ADD-ONS:
// 1) Auto-detect dạng bài (taskType)
// 2) Chặn lộ đáp án (guardrail)
// 3) Gợi ý theo tiến bộ (signals from history/progress) — client-side enrichment
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
      if (typeof window.getSession === "function") {
        const ss = window.getSession();
        if (ss && (ss.token || ss.sessionId || ss.sid)) return String(ss.token || ss.sessionId || ss.sid || "");
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
      try { if (typeof window.saveSession === "function") window.saveSession(raw); } catch (_) {}
    } catch (_) {}
  }

  function saveSession_(sessionLike) {
    try {
      if (typeof window.saveSession === "function") {
        window.saveSession(sessionLike);
        return;
      }
    } catch (_) {}

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
    try {
      if (typeof window.clearSession === "function") {
        window.clearSession();
        return;
      }
    } catch (_) {}

    try {
      localStorage.removeItem("hedu_session");
      localStorage.removeItem("hedu_remember");
      localStorage.removeItem("hedu_teacher_name");
      localStorage.removeItem("hedu_class");
      localStorage.removeItem("hedu_teacher_classId");
      localStorage.removeItem("rw_user");
      localStorage.removeItem("rw_class");
    } catch (_) {}
  }

  /*********************
   * LOGIN REDIRECT
   *********************/
  function indexHref_() {
    try { if (typeof window.indexHref === "function") return window.indexHref(); } catch (_) {}

    const u = new URL(window.location.href);
    const parts = u.pathname.split("/").filter(Boolean);
    const i = parts.indexOf("pages");
    const root = (i >= 0)
      ? "/" + parts.slice(0, i).join("/") + "/"
      : "/" + parts.slice(0, Math.max(parts.length - 1, 0)).join("/") + "/";
    return u.origin + root + "index.html";
  }

  function loginHref_(role, returnTo) {
    try { if (typeof window.loginHref === "function") return window.loginHref(role, returnTo); } catch (_) {}

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
    window.location.replace(url);
  }

  /*********************
   * SESSION ERROR DETECT
   *********************/
  function isSessionError_(msg) {
    const m = String(msg || "").toLowerCase();
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
    if (!hadToken) return false;
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

  /*********************
   * NORMALIZE PAYLOAD
   *********************/
  function normalizePayload_(action, payload) {
    const p = Object.assign({}, payload || {});
    const a = String(action || "");

    const t = getToken_();
    if (t) {
      if (p.token == null) p.token = t;
      if (p.sessionId == null) p.sessionId = t;
    }

    if (a === "authTeacherLogin") {
      if (p.username != null && p.account == null) p.account = p.username;
      if (p.password != null && p.pass == null) p.pass = p.password;
      if (p.password != null && p.pwd == null) p.pwd = p.password;
      if (p.password != null && p.passwordText == null) p.passwordText = p.password;
    }
    if (a === "authTeacherRegister") {
      if (p.fullName != null && p.name == null) p.name = p.fullName;
      if (p.phone != null && p.account == null) p.account = p.phone;
    }
    if (a === "authStudentLogin") {
      if (p.studentCode != null && p.studentId == null) p.studentId = p.studentCode;
      if (p.code != null && p.studentId == null) p.studentId = p.code;
    }
    if (a === "authParentLogin") {
      if (p.studentCode != null && p.studentId == null) p.studentId = p.studentCode;
      if (p.code != null && p.studentId == null) p.studentId = p.code;
    }
    if (a === "authAdminLogin") {
      if (p.code != null && p.adminCode == null) p.adminCode = p.code;
      if (p.admin_code != null && p.adminCode == null) p.adminCode = p.admin_code;
    }
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
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        keepCb = true;
        try { window[cb] = function () {}; } catch (_) {}
        cleanup();
        resolve({ ok: false, error: "JSONP load timeout" });
      }, 25000);

      let declScript = null;
      let remoteScript = null;

      function cleanup() {
        try { delete window.__HEDU_JSONP_MAP[cb]; } catch (_) {}
        try { if (declScript && declScript.parentNode) declScript.parentNode.removeChild(declScript); } catch (_) {}
        try { if (remoteScript && remoteScript.parentNode) remoteScript.parentNode.removeChild(remoteScript); } catch (_) {}
        if (keepCb) {
          try { setTimeout(() => { try { delete window[cb]; } catch (_) { window[cb] = undefined; } }, 5000); } catch (_) {}
        } else {
          try { delete window[cb]; } catch (_) { window[cb] = undefined; }
        }
        clearTimeout(timer);
      }

      window.__HEDU_JSONP_MAP[cb] = { resolve, cleanup, done: false };

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
  function shouldUseJsonpFirst_() {
    try {
      const proto = String(window.location.protocol || "");
      return proto === "file:";
    } catch (_) {}
    return false;
  }

  async function corePost_(action, payload = {}) {
    const SCRIPT_URL = getScriptUrl_();
    const act = String(action || "");
    const p = normalizePayload_(act, payload);
    const bodyObj = Object.assign({ action: act }, p);

    if (shouldUseJsonpFirst_()) {
      const j = await jsonp_(act, p);
      return postProcess_(act, p, j);
    }

    let res, txt;
    try {
      res = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(bodyObj),
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
      });
      txt = await res.text();
    } catch (e) {
      const j = await jsonp_(act, p);
      return postProcess_(act, p, j);
    }

    if (!(res && res.ok)) {
      const dataErr = { ok: false, error: "HTTP " + (res ? res.status : "0"), raw: txt };
      return postProcess_(act, p, dataErr);
    }

    let data;
    try { data = JSON.parse(txt); }
    catch (_) { data = { ok: false, error: "Invalid JSON from server", raw: txt }; }

    return postProcess_(act, p, data);
  }

  function forceOk_(data) {
    try {
      if (data && typeof data === "object" && !Array.isArray(data)) {
        if (!("ok" in data)) data.ok = true;
      }
    } catch (_) {}
    return data;
  }

  function extractTokenFromResponse_(data) {
    if (!data) return "";
    const s = data.session || data.user || null;
    const t = (s && (s.token || s.sessionId)) || data.token || data.sessionId || "";
    return String(t || "");
  }

  function postProcess_(action, payload, data) {
    data = forceOk_(data);

    try {
      if (data && data.session) {
        saveSession_(data.session);
        const tok = extractTokenFromResponse_(data);
        if (tok) setToken_(tok);
      } else {
        const tok = extractTokenFromResponse_(data);
        if (tok) setToken_(tok);
      }
    } catch (_) {}

    try {
      const hadToken = !!(payload && (payload.token || payload.sessionId || payload.sid)) || !!getToken_();
      if (data && data.ok === false && shouldAutoLogout_(action, hadToken)) {
        const msg = String(data.error || data.message || "");
        if (isSessionError_(msg)) {
          clearSession_();
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

  /***********************************************************
   * ✅ PRO AI HINT PIPELINE (AUTO-DETECT + GUARD + PROGRESS)
   ***********************************************************/
  const AI_CACHE_KEY = "hedu_ai_cache_v1";
  const AI_DEBOUNCE_MS = 600;
  let _aiDebounceTimer = null;

  function _getAiCache_() {
    try { return JSON.parse(localStorage.getItem(AI_CACHE_KEY) || "{}"); } catch (_) { return {}; }
  }
  function _setAiCache_(o) {
    try { localStorage.setItem(AI_CACHE_KEY, JSON.stringify(o || {})); } catch (_) {}
  }

  function _hash_(s) {
    // hash nhẹ đủ dùng (không crypto)
    s = String(s || "");
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return ("00000000" + h.toString(16)).slice(-8);
  }

  function detectTaskType_(task) {
    // task: {topic, body, domain, skill, ...}
    const topic = String(task?.topic || "").toLowerCase();
    const body = String(task?.body || "").toLowerCase();
    const domain = String(task?.domain || "").toLowerCase();
    const skill = String(task?.skill || "").toLowerCase();
    const s = (topic + " " + body + " " + domain + " " + skill).replace(/\s+/g, " ").trim();

    // Heuristic rules (tiểu học)
    const has = (re) => re.test(s);

    if (has(/ý chính|ý chủ đạo|nội dung chính|chủ đề chính|đại ý/)) return "DOC_HIEU_Y_CHINH";
    if (has(/đọc hiểu|trả lời câu hỏi|dựa vào đoạn văn|đoạn văn trên/)) return "DOC_HIEU";
    if (has(/chính tả|nghe viết|điền âm|điền vần|l\/n|s\/x|ch\/tr|d\/gi\/r/)) return "CHINH_TA";
    if (has(/luyện từ và câu|từ loại|danh từ|động từ|tính từ|trạng ngữ|chủ ngữ|vị ngữ|câu kể|câu hỏi/)) return "LTVC";
    if (has(/viết đoạn|viết bài|viết văn|kể lại|tả|miêu tả|viết thư|viết cảm nghĩ/)) return "VIET";
    if (has(/toán|tính|phép cộng|phép trừ|phép nhân|phép chia|giải toán|bài toán/)) return "TOAN";
    if (has(/khoa học|tự nhiên|xã hội|lịch sử|địa lí/)) return "KHTN_XH";

    return "GENERAL";
  }

  function detectLeakAttempt_(draftOrQuestion) {
    const t = String(draftOrQuestion || "").toLowerCase();

    // Học sinh xin đáp án trực tiếp
    const leakSignals = [
      "đáp án", "đáp an", "cho đáp án", "đưa đáp án", "đáp số",
      "lời giải", "giải hộ", "làm hộ", "làm giúp", "viết giúp",
      "bài mẫu", "mẫu hoàn chỉnh", "viết hoàn chỉnh",
      "kết quả là gì", "đúng không", "đáp án đúng"
    ];
    return leakSignals.some(k => t.includes(k));
  }

  function guardrailMode_(draft, extraQuestion) {
    // nếu học sinh cố “xin đáp án” => bật guard mode
    const leak = detectLeakAttempt_(draft) || detectLeakAttempt_(extraQuestion);
    return leak ? "NO_ANSWER" : "NORMAL";
  }

  async function getProgressSignals_(opts) {
    // opts: {classId, studentId}
    // Lấy tín hiệu nhanh để cá nhân hoá:
    // - ưu tiên studentProgress (gom theo tuần)
    // - fallback getMyHistory (đếm kỹ năng/domain)
    const cfg = getConfig_();
    const actionProgress = (cfg && cfg.AI_PROGRESS_ACTION) ? String(cfg.AI_PROGRESS_ACTION) : "studentProgress";
    const actionHistory = (cfg && cfg.AI_HISTORY_ACTION) ? String(cfg.AI_HISTORY_ACTION) : "getMyHistory";

    const classId = opts?.classId || "";
    const studentId = opts?.studentId || "";

    // 1) studentProgress
    try {
      const r = await corePost_(actionProgress, { classId, studentId });
      if (r && r.ok !== false && Array.isArray(r.rows)) {
        // signal đơn giản: tuần gần nhất submitted/feedback
        const last = r.rows[0] || {};
        return {
          source: "studentProgress",
          recent: {
            week: String(last.weekLabel || ""),
            submitted: Number(last.submitted || 0),
            feedbackCount: Number(last.feedbackCount || 0),
          }
        };
      }
    } catch (_) {}

    // 2) getMyHistory
    try {
      const r = await corePost_(actionHistory, { classId, studentId, limit: 50 });
      if (r && r.ok !== false) {
        const subs = Array.isArray(r.submissions) ? r.submissions : [];
        // đếm nhanh theo taskId (để AI biết mức “chăm”)
        return {
          source: "getMyHistory",
          recent: {
            submissions: subs.length
          }
        };
      }
    } catch (_) {}

    return { source: "none", recent: {} };
  }

  function buildAiCacheKey_(task, draft, guardMode) {
    const base = [
      task?.taskId || "",
      task?.topic || "",
      task?.domain || "",
      guardMode || "NORMAL",
      _hash_(String(task?.body || "")),
      _hash_(String(draft || ""))
    ].join("|");
    return _hash_(base);
  }

  async function aiHint_(task, draft, opts) {
    // task: object from studentListTasks
    // opts: { extraQuestion, classId, studentId, useProgress=true }
    const cfg = getConfig_();
    const actionHint = (cfg && cfg.AI_HINT_ACTION) ? String(cfg.AI_HINT_ACTION) : "aiStudentHint";

    const guardMode = guardrailMode_(draft, opts?.extraQuestion);
    const taskType = detectTaskType_(task);

    const cache = _getAiCache_();
    const ck = buildAiCacheKey_(task, draft, guardMode);
    if (cache[ck] && cache[ck].hint) {
      return { ok: true, hint: cache[ck].hint, cached: true, taskType, guardMode };
    }

    // (Tuỳ chọn) lấy signals theo tiến bộ
    let signals = null;
    if (opts?.useProgress !== false) {
      try {
        signals = await getProgressSignals_({ classId: opts?.classId, studentId: opts?.studentId });
      } catch (_) {
        signals = null;
      }
    }

    // gửi thêm fields (backend hiện tại có thể ignore, không phá)
    const payload = {
      taskId: task?.taskId || "",
      topic: task?.topic || "",
      body: task?.body || "",
      draft: String(draft || ""),

      // ✅ PRO enrich
      taskType,
      guardMode,
      extraQuestion: String(opts?.extraQuestion || ""),
      signals: signals || null,
    };

    const r = await corePost_(actionHint, payload);
    if (r && r.ok !== false && String(r.hint || "").trim()) {
      cache[ck] = { hint: String(r.hint).trim(), at: Date.now() };
      _setAiCache_(cache);
      return { ok: true, hint: cache[ck].hint, cached: false, taskType, guardMode };
    }

    return { ok: false, error: (r && (r.error || r.message)) || "AI hint failed" };
  }

  function aiHintDebounced_(task, draft, opts, onDone) {
    // Debounce để tránh spam gọi AI khi học sinh đang gõ
    try { if (_aiDebounceTimer) clearTimeout(_aiDebounceTimer); } catch (_) {}
    _aiDebounceTimer = setTimeout(async () => {
      try {
        const out = await aiHint_(task, draft, opts);
        onDone && onDone(out);
      } catch (e) {
        onDone && onDone({ ok: false, error: String(e.message || e) });
      }
    }, AI_DEBOUNCE_MS);
  }

  /*********************
   * EXPORT
   *********************/
  window.__heduApiPost = corePost_;
  window.apiPost = corePost_;
  window.apiCall = corePost_;
  window.api = corePost_;

  window.__heduGetToken = getToken_;
  window.__heduSetToken = setToken_;

  // ✅ PRO exports
  window.heduDetectTaskType = detectTaskType_;
  window.heduAiHint = aiHint_;
  window.heduAiHintDebounced = aiHintDebounced_;
  window.heduAiGuardMode = guardrailMode_;
  window.heduGetProgressSignals = getProgressSignals_;
})();
