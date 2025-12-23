/**
 * HEDU AI – FULL Apps Script API (SSOT) */

const CFG = {
  SHEET_CLASSES: "CLASSES",
  SHEET_STUDENTS: "STUDENTS",
  SHEET_TASKS: "TASKS",
  SHEET_SUBMISSIONS: "SUBMISSIONS",
  SHEET_FEEDBACKS: "FEEDBACKS",
  SHEET_USERS: "USERS",
  SHEET_SESSIONS: "SESSIONS",
  SHEET_YEARS: "YEARS",
  SHEET_SETTINGS: "SETTINGS",
  SHEET_MESSAGES: "MESSAGES",

  // ✅ NEW (sync mapping)
  SHEET_PARENT_ACKS: "PARENT_ACKS",
  SHEET_AI_LOGS: "AI_LOGS",

  MAX_AI_CHARS: 12000,
  SESSION_TTL_HOURS: 72,
};

// ===========================
// CORS / HTTP
// ===========================
function _cors_(output) {
  return output
    .setHeader("Access-Control-Allow-Origin", "*")
    .setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
    .setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
    .setHeader("Access-Control-Max-Age", "86400");
}
function doOptions(e) {
  return _cors_(ContentService.createTextOutput(""));
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ✅ Tách logic xử lý để doPost/doGet dùng chung
 * Ông chủ chỉ cần bọc lại đúng đoạn handlers[action] đang có.
 */
function handleRequest_(body) {
  const action = String(body.action || "").trim();
  if (!action) return { ok: false, error: "Missing action" };

  ensureSheets_();

  const handlers = {
    // ===== AUTH =====
    listClassesPublic,
    authTeacherRegister,
    authTeacherLogin,
    authStudentLogin,
    authParentLogin,
    authAdminLogin,
    authLogout,

    // ===== TEACHER (legacy) =====
    listClassesForTeacher,
    listStudents,
    listTasks,
    upsertTask,
    publishTask,
    duplicateTask,
    archiveTask,
    listSubmissions,
    getSubmissionDetail,
    saveGrade,
    saveFeedbackTyped,
    getGradebook,
    getClassReport,
    getLearningPath,
    listMessages,
    sendMessage,

    // ===== STUDENT / PARENT (legacy) =====
    listTasksForStudent,
    submitAnswer,        // ✅ core đã fix ở dưới
    getMyHistory,
    getParentHistory,
    getStudentSummary,

    // ===== ADMIN =====
    adminOverview,
    adminListYears,
    adminAddYear,
    adminSetActiveYear,
    adminListClasses,
    adminCreateClass,
    adminImportStudents,

    // ===== AI =====
    aiGenerateTask,
    aiGenerateRubric,
    aiSuggestFeedback,
    aiSuggestLearningPath,
    aiClassWeeklyReport,

    // ===== NEW MAPPING =====
    getClassDashboard,
    teacherPublishTask,
    teacherListFilters,
    teacherListSubmissions,
    teacherGradebook,
    teacherInsights,
    teacherSaveFeedback,

    studentDashboard,
    studentListTasks,
    studentSubmit,       // ✅ alias gọi core
    studentGetFeedback,
    studentProgress,

    parentWeekReport,
    parentNotes,
    parentProgress,
    parentConfirmRead,
  };

  const fn = handlers[action];
  if (!fn) return { ok: false, error: "Unknown action: " + action };

  const out = fn(body) || {};

  // ✅ Nếu handler đã trả ok:false thì giữ nguyên
  if (out && out.ok === false) return out;

  // ✅ Chuẩn: luôn đính pilot + ok:true
  return { ok: true, pilot: getPilot_(), ...out };
}


function doPost(e){
  try{
    const data = parseBody_(e) || {};
    const result = handleRequest_(data); // ✅ dùng router chuẩn luôn bọc ok:true
    return _cors_(
      ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON)
    );
  }catch(err){
    return _cors_(
      ContentService
        .createTextOutput(JSON.stringify({ok:false, error: err.message || String(err)}))
        .setMimeType(ContentService.MimeType.JSON)
    );
  }
}


function handleAction_(data){
  var action = String((data && data.action) || "").trim();
  if (!action) return { ok:false, error:"Missing action" };

  return callAction_(action, data);
}

function callAction_(name, data){
  // Ưu tiên gọi đúng tên action (không _) trước
  var f1 = this[name];
  if (typeof f1 === "function") return f1(data);

  // Fallback: có _ ở cuối
  var f2 = this[name + "_"];
  if (typeof f2 === "function") return f2(data);

  // Nếu anh lỡ đặt handler theo kiểu khác (ví dụ: listClassesPublic_ / authTeacherLogin_)
  // thì sẽ bắt được ở f2 phía trên.

  return { ok:false, error: (name + " is not defined") };
}


/**
 * ✅ NEW: Parse body an toàn
 * - Hỗ trợ JSON: {"action":"..."}
 * - Hỗ trợ form-urlencoded: payload={...json...}
 * Không ảnh hưởng luồng cũ.
 */
function parseBody_(e) {
  const raw = (e && e.postData && e.postData.contents) ? String(e.postData.contents) : "";
  if (!raw) return {};

  // Case 1: payload=... (application/x-www-form-urlencoded)
  // ví dụ: "payload=%7B%22action%22%3A%22authTeacherLogin%22%2C...%7D"
  if (raw.indexOf("payload=") === 0) {
    const decoded = decodeURIComponent(raw.replace(/^payload=/, ""));
    return JSON.parse(decoded || "{}");
  }

  // Case 2: có thể là form có nhiều field -> thử lấy payload từ querystring
  if (raw.indexOf("=") > -1 && raw.indexOf("{") === -1) {
    const params = raw.split("&").reduce((acc, kv) => {
      const i = kv.indexOf("=");
      const k = i >= 0 ? kv.slice(0, i) : kv;
      const v = i >= 0 ? kv.slice(i + 1) : "";
      acc[decodeURIComponent(k)] = decodeURIComponent(v);
      return acc;
    }, {});
    if (params.payload) return JSON.parse(params.payload || "{}");
  }

  // Case 3: JSON chuẩn (application/json)
  return JSON.parse(raw);
}

function doGet(e){
  try{
    const p = (e && e.parameter) ? e.parameter : {};
    const action = (p.action || "").trim();

    let payload = {};
    if (p.payload){
      try { payload = JSON.parse(p.payload); } catch(_){ payload = {}; }
    }
    if (!payload.action) payload.action = action;

    const result = handleRequest_(payload); // ✅ đổi ở đây

    if (p.callback){
      const cb = String(p.callback).replace(/[^\w$.]/g, "");
      const js = cb + "(" + JSON.stringify(result) + ");";
      return _cors_(ContentService.createTextOutput(js).setMimeType(ContentService.MimeType.JAVASCRIPT));
    }

    return _cors_(
      ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON)
    );

  }catch(err){
    return _cors_(
      ContentService
        .createTextOutput(JSON.stringify({ok:false, error: err.message || String(err)}))
        .setMimeType(ContentService.MimeType.JSON)
    );
  }
}

// ===========================
// PILOT CONFIG / LOCK
// ===========================
function props_() { return PropertiesService.getScriptProperties(); }

function getPilot_() {
  const p = props_();
  return {
    classId: (p.getProperty("PILOT_CLASS_ID") || "5A1").trim(),
    grade: (p.getProperty("PILOT_GRADE") || "5").trim(),
    subject: (p.getProperty("PILOT_SUBJECT") || "Tiếng Việt").trim(),
    textbook: (p.getProperty("PILOT_TEXTBOOK") || "Kết nối tri thức").trim(),
    lock: (p.getProperty("PILOT_LOCK") || "1").trim(),
    lockScope: (p.getProperty("PILOT_LOCK_SCOPE") || "GRADE_SUBJECT").trim(), // CLASS | GRADE_SUBJECT
  };
}

function normalizeClassId_(x) {
  return String(x || "").trim().toUpperCase();
}

function enforcePilot_(payload) {
  const pilot = getPilot_();
  if (pilot.lock !== "1") return payload;

  const scope = String(pilot.lockScope || "GRADE_SUBJECT").toUpperCase();

  payload.classId = normalizeClassId_(payload.classId || pilot.classId);
  payload.grade = String(payload.grade || pilot.grade).trim();
  payload.subject = String(payload.subject || pilot.subject).trim();
  payload.textbook = String(payload.textbook || pilot.textbook).trim();

  if (scope === "CLASS") {
    if (payload.classId !== normalizeClassId_(pilot.classId)) {
      throw new Error(`Pilot đang khóa theo lớp ${pilot.classId}.`);
    }
  } else {
    if (payload.grade !== pilot.grade || payload.subject !== pilot.subject || payload.textbook !== pilot.textbook) {
      throw new Error(`Pilot đang khóa theo: Khối ${pilot.grade} – ${pilot.subject} – "${pilot.textbook}".`);
    }
  }
  return payload;
}

function enforcePilotClass_(classId) {
  const pilot = getPilot_();
  const lock = pilot.lock === "1";
  const cid = normalizeClassId_(classId || pilot.classId);
  if (lock && cid !== normalizeClassId_(pilot.classId)) {
    throw new Error(`Hệ thống đang chạy chế độ pilot cho lớp ${pilot.classId}.`);
  }
  return cid;
}

// ===========================
// SHEETS / UTIL
// ===========================
function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function sh_(name) {
  const s = ss_().getSheetByName(name);
  if (!s) throw new Error("Missing sheet: " + name);
  return s;
}

function ensureHeader_(sheetName, headers) {
  const s = sh_(sheetName);
  if (s.getLastRow() === 0) {
    s.getRange(1, 1, 1, headers.length).setValues([headers]);
    s.setFrozenRows(1);
    return;
  }

  const lastCol = Math.max(s.getLastColumn(), headers.length);
  const row1 = s.getRange(1, 1, 1, lastCol).getValues()[0].map(x => String(x || "").trim());
  const hasAny = row1.some(Boolean);

  if (!hasAny) {
    s.getRange(1, 1, 1, headers.length).setValues([headers]);
    s.setFrozenRows(1);
    return;
  }

  const existing = new Set(row1.filter(Boolean));
  const missing = headers.filter(h => !existing.has(h));
  if (missing.length) {
    const startCol = row1.length + 1;
    s.getRange(1, startCol, 1, missing.length).setValues([missing]);
  }
  s.setFrozenRows(1);
}

function getAll_(sheetName) {
  const s = sh_(sheetName);
  const values = s.getDataRange().getValues();
  if (values.length <= 1) return [];
  const headers = values[0].map(x => String(x || "").trim());
  return values.slice(1)
    .filter(r => r.some(v => String(v || "").trim() !== ""))
    .map(r => {
      const o = {};
      headers.forEach((h, i) => o[h] = r[i]);
      return o;
    });
}

function appendRow_(sheetName, values) {
  sh_(sheetName).appendRow(values);
}

function formatTextColumns_(sheetName, colNames) {
  const s = sh_(sheetName);
  const headers = s.getRange(1, 1, 1, Math.max(s.getLastColumn(), colNames.length)).getValues()[0]
    .map(x => String(x || "").trim());
  const idx = {};
  headers.forEach((h, i) => idx[h] = i + 1);

  colNames.forEach(name => {
    const col = idx[name];
    if (!col) return;
    const rows = Math.max(2, s.getMaxRows());
    s.getRange(1, col, rows, 1).setNumberFormat("@");
  });
}

function nowIso_() { return new Date().toISOString(); }

// ===========================
// ADMIN YEAR/SETTINGS (SSOT)
// ===========================
function ensureAdminSheets_() {
  ensureHeader_(CFG.SHEET_YEARS, ["year", "createdAt"]);
  ensureHeader_(CFG.SHEET_SETTINGS, ["key", "value", "updatedAt"]);

  const y = getActiveYear_();
  if (!y) {
    // tạo năm mặc định nếu chưa có
    addYear_({ year: "2025-2026" });
    setActiveYear_("2025-2026");
  }
}

function getActiveYear_() {
  const sh = sh_(CFG.SHEET_SETTINGS);
  const data = sh.getDataRange().getValues();
  if (data.length <= 1) return "";
  for (let i = 1; i < data.length; i++) {
    const k = String(data[i][0] || "").trim();
    if (k === "ACTIVE_YEAR") return String(data[i][1] || "").trim();
  }
  return "";
}

function setActiveYear_(year) {
  year = String(year || "").trim();
  if (!year) throw new Error("Thiếu năm học");

  const sh = sh_(CFG.SHEET_SETTINGS);
  const now = nowIso_();

  for (let i = 2; i <= sh.getLastRow(); i++) {
    const k = String(sh.getRange(i, 1).getValue() || "").trim();
    if (k === "ACTIVE_YEAR") {
      sh.getRange(i, 2).setValue(year);
      sh.getRange(i, 3).setValue(now);
      return year;
    }
  }
  sh.appendRow(["ACTIVE_YEAR", year, now]);
  return year;
}

function listYearsArr_() {
  const rows = getAll_(CFG.SHEET_YEARS);
  const out = rows.map(r => String(r.year || "").trim()).filter(Boolean);
  return [...new Set(out)];
}

function addYear_({ year }) {
  year = String(year || "").trim();
  if (!year) throw new Error("Thiếu year");

  const sh = sh_(CFG.SHEET_YEARS);
  const years = listYearsArr_();
  if (!years.includes(year)) sh.appendRow([year, nowIso_()]);

  return { year, years: listYearsArr_() };
}

function getYearFrom_(payload) {
  // ✅ accept year OR schoolYear
  const y = String((payload && (payload.year || payload.schoolYear)) || "").trim();
  return y || (getActiveYear_() || "2025-2026");
}

// ===========================
// SHEET INIT
// ===========================
function ensureSheets_() {
  const ss = ss_();
  const must = [
    CFG.SHEET_CLASSES, CFG.SHEET_STUDENTS, CFG.SHEET_TASKS, CFG.SHEET_SUBMISSIONS,
    CFG.SHEET_FEEDBACKS, CFG.SHEET_USERS, CFG.SHEET_SESSIONS,
    CFG.SHEET_YEARS, CFG.SHEET_SETTINGS, CFG.SHEET_MESSAGES,
    // ✅ NEW
    CFG.SHEET_PARENT_ACKS, CFG.SHEET_AI_LOGS
  ];
  must.forEach(n => { if (!ss.getSheetByName(n)) ss.insertSheet(n); });

  ensureAdminSheets_();

  ensureHeader_(CFG.SHEET_CLASSES, [
    "year", "classId", "className", "grade", "subject", "textbook", "homeroomTeacher", "updatedAt"
  ]);

  ensureHeader_(CFG.SHEET_STUDENTS, [
    "year", "classId", "studentId", "name", "grade", "phone", "parentPhone", "updatedAt"
  ]);

  ensureHeader_(CFG.SHEET_TASKS, [
    "year", "classId", "taskId",
    "domain", "skill", "unit", "topic", "level",
    "body", "rubric", "answerKey",
    "dueAt", "status", "createdAt", "publishedAt", "updatedAt",
    "grade", "subject", "textbook",
    "createdBy", "tags"
  ]);

  ensureHeader_(CFG.SHEET_SUBMISSIONS, [
    "year", "classId", "submissionId",
    "taskId", "studentId",
    "answer", "createdAt",
    "status", "isLate",
    "grade", "subject", "textbook"
  ]);

  ensureHeader_(CFG.SHEET_FEEDBACKS, [
    "year", "classId", "feedbackId",
    "taskId", "studentId",
    "score", "scoreMax",
    "feedbackHS", "feedbackPH", "feedbackProfile",
    "rubricSnapshot", "by", "aiUsed",
    "createdAt", "updatedAt",
    "grade", "subject", "textbook"
  ]);

  ensureHeader_(CFG.SHEET_USERS, [
    "role", "classId", "username", "phone", "email", "passwordHash",
    "displayName", "status", "createdAt", "updatedAt"
  ]);

  ensureHeader_(CFG.SHEET_SESSIONS, [
    "sessionId", "role", "classId", "studentId", "username", "displayName", "createdAt", "expiresAt"
  ]);

  ensureHeader_(CFG.SHEET_MESSAGES, [
    "year", "classId", "messageId",
    "threadKey", "toRole", "toStudentId",
    "fromRole", "fromName",
    "subject", "content",
    "createdAt", "readAt",
    "grade", "subjectCtx", "textbook"
  ]);

  // ✅ NEW: parent confirms + AI logs
  ensureHeader_(CFG.SHEET_PARENT_ACKS, [
  "year", "classId", "studentId", "weekKey", "createdAt"
]);

  ensureHeader_(CFG.SHEET_AI_LOGS, [
    "createdAt", "role", "classId", "studentId", "action", "model", "tokens", "note"
  ]);

  formatTextColumns_(CFG.SHEET_USERS, ["username", "phone"]);
  formatTextColumns_(CFG.SHEET_STUDENTS, ["studentId", "phone", "parentPhone"]);

  seedPilotClassIfEmpty_();
}

function seedPilotClassIfEmpty_() {
  const pilot = getPilot_();
  const activeYear = getActiveYear_() || "2025-2026";
  const rows = getAll_(CFG.SHEET_CLASSES);

  const has = rows.some(r =>
    String(r.year || "").trim() === activeYear &&
    normalizeClassId_(r.classId) === normalizeClassId_(pilot.classId)
  );
  if (!has) {
    sh_(CFG.SHEET_CLASSES).appendRow([
      activeYear,
      pilot.classId,
      pilot.classId,
      pilot.grade,
      pilot.subject,
      pilot.textbook,
      "",
      nowIso_()
    ]);
  }
}

// ===========================
// AUTH / SESSIONS
// ===========================
function normalizePhoneText_(s) {
  s = String(s || "").trim();
  if (!s) return "";
  s = s.replace(/\s+/g, "").replace(/[.\-]/g, "");
  if (s.startsWith("+84")) s = "0" + s.slice(3);
  if (s.startsWith("84") && s.length >= 10 && !s.startsWith("0")) s = "0" + s.slice(2);
  return s;
}

function hashPassword_(pw) {
  const salt = Utilities.getUuid().slice(0, 8);
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + "|" + pw);
  const hex = bytes.map(b => {
    const v = (b < 0) ? b + 256 : b;
    return ("0" + v.toString(16)).slice(-2);
  }).join("");
  return salt + ":" + hex;
}

function verifyPassword_(pw, stored) {
  stored = String(stored || "");
  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  const salt = parts[0];
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + "|" + pw);
  const hex = bytes.map(b => {
    const v = (b < 0) ? b + 256 : b;
    return ("0" + v.toString(16)).slice(-2);
  }).join("");
  return (salt + ":" + hex) === stored;
}

function cleanupSessions_() {
  const sh = sh_(CFG.SHEET_SESSIONS);
  const data = sh.getDataRange().getValues();
  if (data.length <= 1) return;

  const header = data[0].map(String);
  const idxExpires = header.indexOf("expiresAt");
  if (idxExpires < 0) return;

  const now = new Date();
  const rowsToDelete = [];
  for (let i = 1; i < data.length; i++) {
    const exp = new Date(data[i][idxExpires]);
    if (exp && !isNaN(exp) && exp < now) rowsToDelete.push(i + 1);
  }
  rowsToDelete.reverse().forEach(r => sh.deleteRow(r));
}

function createSession_({ role, classId, studentId, username, displayName }) {
  cleanupSessions_();

  const sid = "S" + Utilities.getUuid().replace(/-/g, "");
  const now = new Date();
  const exp = new Date(now.getTime() + CFG.SESSION_TTL_HOURS * 3600 * 1000);

  appendRow_(CFG.SHEET_SESSIONS, [
    sid,
    String(role || ""),
    String(classId || ""),
    String(studentId || ""),
    String(username || ""),
    String(displayName || ""),
    now.toISOString(),
    exp.toISOString()
  ]);

  return {
    sessionId: sid,
    role: String(role || ""),
    classId: String(classId || ""),
    studentId: String(studentId || ""),
    username: String(username || ""),
    displayName: String(displayName || ""),
    createdAt: now.toISOString(),
    expiresAt: exp.toISOString()
  };
}

function requireRoleSession_(token, roles) {
  const sid = String(token || "").trim();
  if (!sid) throw new Error("Thiếu token (sessionId)");

  const rows = getAll_(CFG.SHEET_SESSIONS);
  const s = rows.find(r => String(r.sessionId) === sid);
  if (!s) throw new Error("Phiên đăng nhập không hợp lệ");

  const exp = new Date(s.expiresAt);
  if (isNaN(exp) || exp < new Date()) throw new Error("Phiên đăng nhập đã hết hạn");

  const role = String(s.role || "").toUpperCase();
  const need = (roles || []).map(x => String(x).toUpperCase());
  if (need.length && !need.includes(role)) throw new Error("Không đủ quyền");

  return s;
}

function authLogout({ token }) {
  const sid = String(token || "").trim();
  if (!sid) return { loggedOut: true };
  const sh = sh_(CFG.SHEET_SESSIONS);
  const data = sh.getDataRange().getValues();
  if (data.length <= 1) return { loggedOut: true };

  const header = data[0].map(x => String(x || "").trim());
  const idx = header.indexOf("sessionId");
  if (idx < 0) return { loggedOut: true };

  for (let i = 2; i <= sh.getLastRow(); i++) {
    const v = String(sh.getRange(i, idx + 1).getValue() || "").trim();
    if (v === sid) { sh.deleteRow(i); break; }
  }
  return { loggedOut: true };
}

// ===== PUBLIC CLASSES (login) =====
function listClassesPublic() {
  const pilot = getPilot_();

  // ✅ Pilot lock: trả đủ classId + className
  if (pilot.lock === "1") {
    return { classes: [{ classId: pilot.classId, className: pilot.classId }] };
  }

  const y = getActiveYear_() || "2025-2026";
  const rows = getAll_(CFG.SHEET_CLASSES)
    .filter(r => String(r.year || "").trim() === y)
    .map(r => ({
      classId: String(r.classId || "").trim(),
      className: String(r.className || r.classId || "").trim()
    }))
    .filter(x => x.classId);

  // unique
  const seen = new Set();
  const out = [];
  rows.forEach(x => {
    const k = normalizeClassId_(x.classId);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(x);
  });

  return { classes: out };
}


// ===== TEACHER REGISTER/LOGIN =====
function authTeacherRegister({ fullName, phone, email, password }) {
  const pilot = getPilot_();
  const classId = pilot.classId;
  const role = "TEACHER";

  fullName = String(fullName || "").trim();
  phone = normalizePhoneText_(phone);
  email = String(email || "").trim();
  password = String(password || "");

  if (!fullName) throw new Error("Thiếu họ tên");
  if (!phone) throw new Error("Thiếu số điện thoại");
  if (password.length < 4) throw new Error("Mật khẩu quá ngắn");

  const username = normalizePhoneText_(phone);

  const users = getAll_(CFG.SHEET_USERS);
  const existed = users.some(u =>
    String(u.role).toUpperCase() === role &&
    (String(u.username || "").trim() === username || (email && String(u.email || "").trim() === email))
  );
  if (existed) throw new Error("Tài khoản đã tồn tại");

  const hash = hashPassword_(password);

  appendRow_(CFG.SHEET_USERS, [
    role,
    classId,
    "'" + username,
    "'" + phone,
    email,
    hash,
    fullName,
    "active",
    nowIso_(),
    nowIso_()
  ]);

  return { registered: true };
}

function authTeacherLogin({ account, password }) {
  const pilot = getPilot_();
  const classId = pilot.classId;
  const role = "TEACHER";

  account = String(account || "").trim();
  password = String(password || "");
  if (!account || !password) throw new Error("Thiếu tài khoản/mật khẩu");

  const users = getAll_(CFG.SHEET_USERS).filter(u => String(u.role).toUpperCase() === role);
  const accNormPhone = normalizePhoneText_(account);

  const found = users.find(u => {
    const uUser = String(u.username || "").trim();
    const uPhone = normalizePhoneText_(u.phone);
    const uEmail = String(u.email || "").trim().toLowerCase();
    const aEmail = account.toLowerCase();
    return (uUser === account) || (uPhone && uPhone === accNormPhone) || (uEmail && uEmail === aEmail);
  });

  if (!found) throw new Error("Sai tài khoản hoặc mật khẩu");
  if (String(found.status || "active").toLowerCase() !== "active") throw new Error("Tài khoản đang bị khoá");

  const ok = verifyPassword_(password, String(found.passwordHash || ""));
  if (!ok) throw new Error("Sai tài khoản hoặc mật khẩu");

  const cid = enforcePilotClass_(classId);

  const session = createSession_({
    role,
    classId: cid,
    studentId: "",
    username: String(found.username || "").trim(),
    displayName: String(found.displayName || found.username || "Giáo viên"),
  });

  return { session };
}

// ===== STUDENT / PARENT LOGIN =====
function authStudentLogin({ classId, studentId, name, phone, parentPhone }) {
  const cid = enforcePilotClass_(classId);
  studentId = String(studentId || "").trim();
  if (!studentId) throw new Error("Thiếu mã học sinh");

  upsertStudent_({
    classId: cid,
    studentId,
    name: String(name || studentId).trim(),
    phone: normalizePhoneText_(phone),
    parentPhone: normalizePhoneText_(parentPhone),
  });

  const session = createSession_({
    role: "STUDENT",
    classId: cid,
    studentId,
    username: "",
    displayName: String(name || studentId || "Học sinh"),
  });
  return { session };
}

function authParentLogin({ classId, studentId }) {
  const cid = enforcePilotClass_(classId);
  studentId = String(studentId || "").trim();
  if (!studentId) throw new Error("Thiếu mã học sinh");

  upsertStudent_({ classId: cid, studentId, name: studentId });

  const session = createSession_({
    role: "PARENT",
    classId: cid,
    studentId,
    username: "",
    displayName: "PH " + studentId,
  });
  return { session };
}

function authAdminLogin({ adminCode }) {
  const codeNeed = String(props_().getProperty("ADMIN_SETUP_CODE") || "").trim();
  if (!codeNeed) throw new Error("Chưa cấu hình ADMIN_SETUP_CODE trong Script Properties");
  const codeGot = String(adminCode || "").trim();
  if (!codeGot || codeGot !== codeNeed) throw new Error("Sai mã BGH / Quản trị");

  const pilot = getPilot_();
  const session = createSession_({
    role: "ADMIN",
    classId: pilot.classId,
    studentId: "",
    username: "ADMIN",
    displayName: "BGH/Quản trị",
  });
  return { session };
}

// ===========================
// STUDENTS (upsert, list)
// ===========================
function upsertStudent_({ classId, studentId, name, grade, phone, parentPhone }) {
  const pilot = getPilot_();
  const y = getActiveYear_() || "2025-2026";
  const cid = normalizeClassId_(classId);
  const sid = String(studentId || "").trim();
  const nm = String(name || sid).trim();
  const g = String(grade || pilot.grade).trim();
  const ph = normalizePhoneText_(phone);
  const pph = normalizePhoneText_(parentPhone);

  const sh = sh_(CFG.SHEET_STUDENTS);
  const data = sh.getDataRange().getValues();

  if (data.length <= 1) {
    sh.appendRow([y, cid, sid, nm, g, ph, pph, nowIso_()]);
    return;
  }

  for (let i = 2; i <= sh.getLastRow(); i++) {
    const r = sh.getRange(i, 1, 1, 8).getValues()[0];
    const ry = String(r[0] || "").trim();
    const rc = normalizeClassId_(r[1]);
    const rs = String(r[2] || "").trim();
    if (ry === y && rc === cid && rs === sid) {
      sh.getRange(i, 4).setValue(nm);
      sh.getRange(i, 5).setValue(g);
      if (ph) sh.getRange(i, 6).setValue(ph);
      if (pph) sh.getRange(i, 7).setValue(pph);
      sh.getRange(i, 8).setValue(nowIso_());
      return;
    }
  }
  sh.appendRow([y, cid, sid, nm, g, ph, pph, nowIso_()]);
}

function listStudents({ token, classId, year }) {
  requireRoleSession_(token, ["TEACHER", "ADMIN"]);
  const y = String(year || "").trim() || (getActiveYear_() || "2025-2026");
  const cid = enforcePilotClass_(classId || getPilot_().classId);

  const rows = getAll_(CFG.SHEET_STUDENTS)
    .filter(r => String(r.year || "").trim() === y)
    .filter(r => normalizeClassId_(r.classId) === normalizeClassId_(cid))
    .map(r => ({
      studentId: String(r.studentId || "").trim(),
      name: String(r.name || r.studentId || "").trim(),
      grade: String(r.grade || "").trim(),
      phone: String(r.phone || "").trim(),
      parentPhone: String(r.parentPhone || "").trim(),
      updatedAt: String(r.updatedAt || "")
    }))
    .filter(x => x.studentId);

  rows.sort((a, b) => String(a.studentId).localeCompare(String(b.studentId)));
  return { year: y, classId: cid, students: rows };
}
// ===========================
// TEACHER: CLASSES
// ===========================
function listClassesForTeacher({ token }) {
  requireRoleSession_(token, ["TEACHER", "ADMIN"]);
  const pilot = getPilot_();

  if (pilot.lock === "1") {
    return { classes: [{ classId: pilot.classId, className: pilot.classId }] };
  }

  const y = getActiveYear_() || "2025-2026";
  const rows = getAll_(CFG.SHEET_CLASSES).filter(r => String(r.year || "").trim() === y);
  const out = rows.map(r => ({
    classId: String(r.classId || "").trim(),
    className: String(r.className || r.classId || "").trim(),
    grade: String(r.grade || "").trim(),
    subject: String(r.subject || "").trim(),
    textbook: String(r.textbook || "").trim(),
  })).filter(x => x.classId);

  out.sort((a, b) => String(a.classId).localeCompare(String(b.classId)));
  return { year: y, classes: out };
}

// ===========================
// TASKS (library + assign) - legacy
// ===========================
function listTasks({ token, classId, year, grade, subject, domain, status, q }) {
  requireRoleSession_(token, ["TEACHER", "ADMIN"]);

  const pilot = getPilot_();
  const y = String(year || "").trim() || (getActiveYear_() || "2025-2026");

  const payload = enforcePilot_({
    classId: classId || pilot.classId,
    grade: grade || pilot.grade,
    subject: subject || pilot.subject,
    textbook: pilot.textbook,
  });

  const cid = enforcePilotClass_(payload.classId);

  let rows = getAll_(CFG.SHEET_TASKS)
    .filter(r => String(r.year || "").trim() === y)
    .filter(r => normalizeClassId_(r.classId) === normalizeClassId_(cid));

  if (grade) rows = rows.filter(r => String(r.grade || "").trim() === String(grade).trim());
  if (subject) rows = rows.filter(r => String(r.subject || "").trim() === String(subject).trim());
  if (domain) rows = rows.filter(r => String(r.domain || "").trim().toUpperCase() === String(domain).trim().toUpperCase());
  if (status) rows = rows.filter(r => String(r.status || "").trim().toUpperCase() === String(status).trim().toUpperCase());

  const qq = String(q || "").trim().toLowerCase();
  if (qq) {
    rows = rows.filter(r => {
      const s = [
        r.taskId, r.topic, r.unit, r.domain, r.skill, r.level, r.tags
      ].map(x => String(x || "").toLowerCase()).join(" ");
      return s.includes(qq);
    });
  }

  rows.sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
  return { year: y, classId: cid, tasks: rows };
}

function upsertTask({ token, classId, year, task }) {
  const s = requireRoleSession_(token, ["TEACHER", "ADMIN"]);
  const pilot = getPilot_();
  const y = String(year || "").trim() || (getActiveYear_() || "2025-2026");
  const cid = enforcePilotClass_(classId || pilot.classId);

  if (!task || !task.taskId) throw new Error("Thiếu task/taskId");

  const t = {
    taskId: String(task.taskId).trim(),
    domain: String(task.domain || "GENERAL").trim(),
    skill: String(task.skill || "").trim(),
    unit: String(task.unit || "").trim(),
    topic: String(task.topic || "").trim(),
    level: String(task.level || "nhan_biet").trim(),
    body: String(task.body || "").trim(),
    rubric: String(task.rubric || "").trim(),
    answerKey: String(task.answerKey || "").trim(),
    dueAt: String(task.dueAt || "").trim(),
    status: String(task.status || "DRAFT").trim().toUpperCase(),
    createdAt: String(task.createdAt || nowIso_()),
    publishedAt: String(task.publishedAt || "").trim(),
    updatedAt: nowIso_(),
    grade: String(task.grade || pilot.grade).trim(),
    subject: String(task.subject || pilot.subject).trim(),
    textbook: String(task.textbook || pilot.textbook).trim(),
    createdBy: String(task.createdBy || s.displayName || "TEACHER").trim(),
    tags: String(task.tags || "").trim(),
  };

  enforcePilot_({ classId: cid, grade: t.grade, subject: t.subject, textbook: t.textbook });

  const sh = sh_(CFG.SHEET_TASKS);
  const data = sh.getDataRange().getValues();
  const header = data[0].map(x => String(x || "").trim());
  const idx = {};
  header.forEach((h, i) => idx[h] = i);

  let rowFound = -1;
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (String(r[idx.year] || "").trim() === y &&
      normalizeClassId_(r[idx.classId]) === normalizeClassId_(cid) &&
      String(r[idx.taskId] || "").trim() === t.taskId
    ) {
      rowFound = i + 1;
      break;
    }
  }

  const values = [
    y, cid, t.taskId,
    t.domain, t.skill, t.unit, t.topic, t.level,
    t.body, t.rubric, t.answerKey,
    t.dueAt, t.status, t.createdAt, t.publishedAt, t.updatedAt,
    t.grade, t.subject, t.textbook,
    t.createdBy, t.tags
  ];

  if (rowFound > 0) {
    sh.getRange(rowFound, 1, 1, values.length).setValues([values]);
  } else {
    sh.appendRow(values);
  }

  return { saved: true, taskId: t.taskId, status: t.status };
}

function publishTask({ token, classId, taskId, dueAt }) {
  requireRoleSession_(token, ["TEACHER", "ADMIN"]);
  const pilot = getPilot_();
  const y = getActiveYear_() || "2025-2026";
  const cid = enforcePilotClass_(classId || pilot.classId);
  taskId = String(taskId || "").trim();
  if (!taskId) throw new Error("Thiếu taskId");

  const sh = sh_(CFG.SHEET_TASKS);
  const data = sh.getDataRange().getValues();
  const header = data[0].map(x => String(x || "").trim());
  const idx = {};
  header.forEach((h, i) => idx[h] = i);

  let rowFound = -1;
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (String(r[idx.year] || "").trim() === y &&
      normalizeClassId_(r[idx.classId]) === normalizeClassId_(cid) &&
      String(r[idx.taskId] || "").trim() === taskId
    ) { rowFound = i + 1; break; }
  }
  if (rowFound < 0) throw new Error("Không tìm thấy task");

  sh.getRange(rowFound, idx.status + 1).setValue("PUBLISHED");
  sh.getRange(rowFound, idx.publishedAt + 1).setValue(nowIso_());
  sh.getRange(rowFound, idx.updatedAt + 1).setValue(nowIso_());
  if (dueAt && idx.dueAt >= 0) sh.getRange(rowFound, idx.dueAt + 1).setValue(String(dueAt));

  return { published: true, taskId };
}

function duplicateTask({ token, classId, taskId }) {
  requireRoleSession_(token, ["TEACHER", "ADMIN"]);
  const pilot = getPilot_();
  const y = getActiveYear_() || "2025-2026";
  const cid = enforcePilotClass_(classId || pilot.classId);
  taskId = String(taskId || "").trim();
  if (!taskId) throw new Error("Thiếu taskId");

  const rows = getAll_(CFG.SHEET_TASKS)
    .filter(r => String(r.year || "").trim() === y)
    .filter(r => normalizeClassId_(r.classId) === normalizeClassId_(cid))
    .filter(r => String(r.taskId || "").trim() === taskId);

  const src = rows[0];
  if (!src) throw new Error("Không tìm thấy task");

  const newId = "T" + Date.now().toString().slice(-10);
  const task = {
    taskId: newId,
    domain: src.domain,
    skill: src.skill,
    unit: src.unit,
    topic: String(src.topic || "") + " (copy)",
    level: src.level,
    body: src.body,
    rubric: src.rubric,
    answerKey: src.answerKey,
    dueAt: "",
    status: "DRAFT",
    createdAt: nowIso_(),
    publishedAt: "",
    grade: src.grade || pilot.grade,
    subject: src.subject || pilot.subject,
    textbook: src.textbook || pilot.textbook,
    tags: src.tags || "",
  };

  return upsertTask({ token, classId: cid, year: y, task });
}

function archiveTask({ token, classId, taskId }) {
  requireRoleSession_(token, ["TEACHER", "ADMIN"]);
  const pilot = getPilot_();
  const y = getActiveYear_() || "2025-2026";
  const cid = enforcePilotClass_(classId || pilot.classId);
  taskId = String(taskId || "").trim();
  if (!taskId) throw new Error("Thiếu taskId");

  const sh = sh_(CFG.SHEET_TASKS);
  const data = sh.getDataRange().getValues();
  const header = data[0].map(x => String(x || "").trim());
  const idx = {}; header.forEach((h, i) => idx[h] = i);

  for (let i = 2; i <= sh.getLastRow(); i++) {
    const ry = String(sh.getRange(i, idx.year + 1).getValue() || "").trim();
    const rc = normalizeClassId_(sh.getRange(i, idx.classId + 1).getValue());
    const rt = String(sh.getRange(i, idx.taskId + 1).getValue() || "").trim();
    if (ry === y && rc === normalizeClassId_(cid) && rt === taskId) {
      sh.getRange(i, idx.status + 1).setValue("ARCHIVED");
      sh.getRange(i, idx.updatedAt + 1).setValue(nowIso_());
      return { archived: true, taskId };
    }
  }
  throw new Error("Không tìm thấy task");
}

// ===========================
// STUDENT/PARENT TASKS + SUBMIT (legacy)
// ===========================
function listTasksForStudent({ token, classId, studentId }) {
  const s = requireRoleSession_(token, ["STUDENT", "PARENT"]);
  const pilot = getPilot_();
  const y = getActiveYear_() || "2025-2026";
  const cid = enforcePilotClass_(classId || s.classId || pilot.classId);
  const sid = String(studentId || s.studentId || "").trim();
  if (!sid) throw new Error("Thiếu studentId");

  let rows = getAll_(CFG.SHEET_TASKS)
    .filter(r => String(r.year || "").trim() === y)
    .filter(r => normalizeClassId_(r.classId) === normalizeClassId_(cid))
    .filter(r => String(r.status || "").toUpperCase() === "PUBLISHED");

  rows = rows.filter(r => {
    try { enforcePilot_({ classId: cid, grade: r.grade, subject: r.subject, textbook: r.textbook }); return true; }
    catch (_) { return false; }
  });

  const subs = getAll_(CFG.SHEET_SUBMISSIONS)
    .filter(r => String(r.year || "").trim() === y)
    .filter(r => normalizeClassId_(r.classId) === normalizeClassId_(cid))
    .filter(r => String(r.studentId || "").trim() === sid);

  const mapSub = {};
  subs.forEach(x => { mapSub[String(x.taskId || "").trim()] = x; });

  const tasks = rows.map(t => {
    const tid = String(t.taskId || "").trim();
    const sub = mapSub[tid];
    return {
      taskId: tid,
      domain: t.domain,
      skill: t.skill,
      unit: t.unit,
      topic: t.topic,
      level: t.level,
      body: t.body,
      rubric: t.rubric,
      dueAt: t.dueAt,
      createdAt: t.createdAt,
      publishedAt: t.publishedAt,
      grade: t.grade, subject: t.subject, textbook: t.textbook,
      submissionStatus: sub ? String(sub.status || "SUBMITTED") : "NOT_SUBMITTED",
      submittedAt: sub ? String(sub.createdAt || "") : ""
    };
  });

  tasks.sort((a, b) => String(b.publishedAt || b.createdAt).localeCompare(String(a.publishedAt || a.createdAt)));
  return { year: y, classId: cid, studentId: sid, tasks };
}

function submitAnswer({ token, classId, studentId, taskId, answer }) {
  return submitAnswerCore_({ token, classId, studentId, taskId, answer });
}

// ===========================
// SUBMISSIONS (teacher inbox) - legacy
// ===========================
function listSubmissions({ token, classId, taskId, year, status }) {
  requireRoleSession_(token, ["TEACHER", "ADMIN"]);

  const pilot = getPilot_();
  const y = String(year || "").trim() || (getActiveYear_() || "2025-2026");
  const cid = enforcePilotClass_(classId || pilot.classId);
  taskId = String(taskId || "").trim();
  status = String(status || "").trim().toUpperCase();

  const subs = getAll_(CFG.SHEET_SUBMISSIONS)
    .filter(r => String(r.year || "").trim() === y)
    .filter(r => normalizeClassId_(r.classId) === normalizeClassId_(cid))
    .filter(r => !taskId || String(r.taskId || "").trim() === taskId)
    .filter(r => !status || String(r.status || "").trim().toUpperCase() === status);

  const fbs = getAll_(CFG.SHEET_FEEDBACKS)
    .filter(r => String(r.year || "").trim() === y)
    .filter(r => normalizeClassId_(r.classId) === normalizeClassId_(cid));

  const gradedSet = new Set(fbs.map(x => `${String(x.studentId || "").trim()}|||${String(x.taskId || "").trim()}`));

  const items = subs.map(x => {
    const sid = String(x.studentId || "").trim();
    const tid = String(x.taskId || "").trim();
    const graded = gradedSet.has(`${sid}|||${tid}`);
    const isLate = String(x.isLate || "") === "1";
    return {
      submissionId: String(x.submissionId || ""),
      createdAt: String(x.createdAt || ""),
      studentId: sid,
      taskId: tid,
      status: graded ? "GRADED" : "SUBMITTED",
      statusLabel: graded ? "Đã nhận xét" : (isLate ? "Nộp muộn" : "Chờ chấm"),
      isLate: isLate
    };
  }).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  return { year: y, classId: cid, submissions: items };
}

function getSubmissionDetail({ token, classId, submissionId }) {
  requireRoleSession_(token, ["TEACHER", "ADMIN"]);
  const pilot = getPilot_();
  const y = getActiveYear_() || "2025-2026";
  const cid = enforcePilotClass_(classId || pilot.classId);
  submissionId = String(submissionId || "").trim();
  if (!submissionId) throw new Error("Thiếu submissionId");

  const sub = getAll_(CFG.SHEET_SUBMISSIONS)
    .find(r => String(r.year || "").trim() === y &&
      normalizeClassId_(r.classId) === normalizeClassId_(cid) &&
      String(r.submissionId || "").trim() === submissionId);

  if (!sub) throw new Error("Không tìm thấy bài nộp");

  const task = getAll_(CFG.SHEET_TASKS)
    .find(t => String(t.year || "").trim() === y &&
      normalizeClassId_(t.classId) === normalizeClassId_(cid) &&
      String(t.taskId || "").trim() === String(sub.taskId || "").trim());

  const fb = getAll_(CFG.SHEET_FEEDBACKS)
    .find(f => String(f.year || "").trim() === y &&
      normalizeClassId_(f.classId) === normalizeClassId_(cid) &&
      String(f.taskId || "").trim() === String(sub.taskId || "").trim() &&
      String(f.studentId || "").trim() === String(sub.studentId || "").trim());

  return { submission: sub, task: task || null, feedback: fb || null };
}

function submitAnswerCore_({ token, classId, studentId, taskId, answer }) {
  const sess = requireRoleSession_(token, ["STUDENT", "PARENT"]);
  const p = getPilot_();
  const y = getActiveYear_() || "2025-2026";

  const cid = enforcePilotClass_(classId || sess.classId || p.classId);
  const sid = String(studentId || sess.studentId || "").trim();
  const tid = String(taskId || "").trim();
  const ans = String(answer || "").trim();

  if (!sid) throw new Error("Thiếu studentId");
  if (!tid) throw new Error("Thiếu taskId");
  if (!ans) throw new Error("Thiếu answer");

  // ✅ tìm task để lấy dueAt + ctx
  const task = getAll_(CFG.SHEET_TASKS).find(t =>
    String(t.year || "").trim() === y &&
    normalizeClassId_(t.classId) === normalizeClassId_(cid) &&
    String(t.taskId || "").trim() === tid
  );
  if (!task) throw new Error("Không tìm thấy task");

  // enforce pilot scope theo grade/subject/textbook của task
  enforcePilot_({ classId: cid, grade: task.grade, subject: task.subject, textbook: task.textbook });

  // ✅ tính nộp muộn
  let isLate = "0";
  const now = new Date();
  const due = task.dueAt ? new Date(task.dueAt) : null;
  if (due && !isNaN(due) && now > due) isLate = "1";

  const sh = sh_(CFG.SHEET_SUBMISSIONS);
  const data = sh.getDataRange().getValues();
  const header = data[0].map(x => String(x || "").trim());
  const idx = {};
  header.forEach((h, i) => (idx[h] = i));

  const createdAt = nowIso_();
  let rowFound = -1;

  // ✅ upsert theo (year,classId,taskId,studentId)
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    const ry = String(r[idx.year] || "").trim();
    const rc = normalizeClassId_(r[idx.classId]);
    const rt = String(r[idx.taskId] || "").trim();
    const rs = String(r[idx.studentId] || "").trim();

    if (ry === y && rc === normalizeClassId_(cid) && rt === tid && rs === sid) {
      rowFound = i + 1;
      break;
    }
  }

  const submissionId = rowFound > 0
    ? String(sh.getRange(rowFound, idx.submissionId + 1).getValue() || "").trim() || ("SUB" + Utilities.getUuid().replace(/-/g, "").slice(0, 12))
    : ("SUB" + Utilities.getUuid().replace(/-/g, "").slice(0, 12));

  const values = [
    y, cid, submissionId,
    tid, sid,
    ans, createdAt,
    "SUBMITTED", isLate,
    String(task.grade || p.grade).trim(),
    String(task.subject || p.subject).trim(),
    String(task.textbook || p.textbook).trim()
  ];

  if (rowFound > 0) {
    sh.getRange(rowFound, 1, 1, values.length).setValues([values]);
  } else {
    sh.appendRow(values);
  }

  return { submitted: true, submissionId, isLate };
}

// ===========================
// GRADING / FEEDBACKS (legacy)
// ===========================
function saveGrade({ token, classId, taskId, studentId, score, scoreMax, feedbackHS, feedbackPH, feedbackProfile, rubricSnapshot, aiUsed }) {
  const s = requireRoleSession_(token, ["TEACHER", "ADMIN"]);
  const pilot = getPilot_();
  const y = getActiveYear_() || "2025-2026";
  const cid = enforcePilotClass_(classId || pilot.classId);

  taskId = String(taskId || "").trim();
  studentId = String(studentId || "").trim();
  if (!taskId || !studentId) throw new Error("Thiếu taskId/studentId");

  const task = getAll_(CFG.SHEET_TASKS)
    .find(t => String(t.year || "").trim() === y && normalizeClassId_(t.classId) === normalizeClassId_(cid) && String(t.taskId || "").trim() === taskId);
  if (!task) throw new Error("Không tìm thấy task");

  const fbId = "FB" + Utilities.getUuid().replace(/-/g, "").slice(0, 12);
  const createdAt = nowIso_();

  appendRow_(CFG.SHEET_FEEDBACKS, [
    y, cid, fbId,
    taskId, studentId,
    String(score ?? ""), String(scoreMax ?? ""),
    String(feedbackHS || "").trim(),
    String(feedbackPH || "").trim(),
    String(feedbackProfile || "").trim(),
    String(rubricSnapshot || task.rubric || "").trim(),
    String(s.displayName || "GV"),
    aiUsed ? "1" : "0",
    createdAt, createdAt,
    String(task.grade || pilot.grade),
    String(task.subject || pilot.subject),
    String(task.textbook || pilot.textbook)
  ]);

  return { saved: true, feedbackId: fbId };
}

function saveFeedbackTyped({ token, classId, studentId, taskId, feedbackText, feedbackType }) {
  const s = requireRoleSession_(token, ["TEACHER", "ADMIN"]);
  const pilot = getPilot_();
  const y = getActiveYear_() || "2025-2026";
  const cid = enforcePilotClass_(classId || pilot.classId);

  studentId = String(studentId || "").trim();
  taskId = String(taskId || "").trim();
  feedbackText = String(feedbackText || "").trim();
  feedbackType = String(feedbackType || "HS").trim().toUpperCase();

  if (!studentId || !taskId || !feedbackText) throw new Error("Thiếu studentId/taskId/feedbackText");

  const task = getAll_(CFG.SHEET_TASKS)
    .find(t => String(t.year || "").trim() === y && normalizeClassId_(t.classId) === normalizeClassId_(cid) && String(t.taskId || "").trim() === taskId);
  if (!task) throw new Error("Không tìm thấy task");

  const fbId = "FB" + Utilities.getUuid().replace(/-/g, "").slice(0, 12);
  const createdAt = nowIso_();

  const hs = feedbackType === "HS" ? feedbackText : "";
  const ph = feedbackType === "PH" ? feedbackText : "";
  const pf = (feedbackType === "PROFILE" || feedbackType === "HOSO") ? feedbackText : "";

  appendRow_(CFG.SHEET_FEEDBACKS, [
    y, cid, fbId,
    taskId, studentId,
    "", "",
    hs, ph, pf,
    String(task.rubric || ""),
    String(s.displayName || "GV"),
    "1",
    createdAt, createdAt,
    String(task.grade || pilot.grade),
    String(task.subject || pilot.subject),
    String(task.textbook || pilot.textbook)
  ]);

  return { saved: true, feedbackId: fbId };
}

// ===========================
// INSIGHTS: Gradebook / Reports / LearningPath (legacy)
// ===========================
function getGradebook({ token, classId, year }) {
  requireRoleSession_(token, ["TEACHER", "ADMIN"]);
  const pilot = getPilot_();
  const y = String(year || "").trim() || (getActiveYear_() || "2025-2026");
  const cid = enforcePilotClass_(classId || pilot.classId);

  const students = getAll_(CFG.SHEET_STUDENTS)
    .filter(r => String(r.year || "").trim() === y)
    .filter(r => normalizeClassId_(r.classId) === normalizeClassId_(cid))
    .map(r => ({ studentId: String(r.studentId || "").trim(), name: String(r.name || r.studentId || "").trim() }))
    .filter(x => x.studentId);

  const tasks = getAll_(CFG.SHEET_TASKS)
    .filter(r => String(r.year || "").trim() === y)
    .filter(r => normalizeClassId_(r.classId) === normalizeClassId_(cid))
    .filter(r => String(r.status || "").toUpperCase() === "PUBLISHED");

  const subs = getAll_(CFG.SHEET_SUBMISSIONS)
    .filter(r => String(r.year || "").trim() === y)
    .filter(r => normalizeClassId_(r.classId) === normalizeClassId_(cid));

  const fbs = getAll_(CFG.SHEET_FEEDBACKS)
    .filter(r => String(r.year || "").trim() === y)
    .filter(r => normalizeClassId_(r.classId) === normalizeClassId_(cid));

  const taskCount = tasks.length || 0;

  const subCount = {};
  subs.forEach(s => {
    const sid = String(s.studentId || "").trim();
    if (!sid) return;
    subCount[sid] = (subCount[sid] || 0) + 1;
  });

  const fbCount = {};
  fbs.forEach(s => {
    const sid = String(s.studentId || "").trim();
    if (!sid) return;
    fbCount[sid] = (fbCount[sid] || 0) + 1;
  });

  const rows = students.map(st => {
    const nSub = subCount[st.studentId] || 0;
    const nFb = fbCount[st.studentId] || 0;
    return {
      studentId: st.studentId,
      name: st.name,
      submitted: nSub,
      graded: nFb,
      progress: taskCount ? Math.round((nSub / taskCount) * 100) + "%" : "0%"
    };
  });

  return { year: y, classId: cid, taskCount, rows };
}

function getClassReport({ token, classId, rangeDays }) {
  requireRoleSession_(token, ["TEACHER", "ADMIN"]);
  const pilot = getPilot_();
  const y = getActiveYear_() || "2025-2026";
  const cid = enforcePilotClass_(classId || pilot.classId);

  const days = Math.max(1, Math.min(60, Number(rangeDays || 7)));
  const now = new Date();
  const since = new Date(now.getTime() - days * 24 * 3600 * 1000);

  const subs = getAll_(CFG.SHEET_SUBMISSIONS)
    .filter(r => String(r.year || "").trim() === y)
    .filter(r => normalizeClassId_(r.classId) === normalizeClassId_(cid))
    .filter(r => {
      const d = new Date(r.createdAt);
      return !isNaN(d) && d >= since;
    });

  const fbs = getAll_(CFG.SHEET_FEEDBACKS)
    .filter(r => String(r.year || "").trim() === y)
    .filter(r => normalizeClassId_(r.classId) === normalizeClassId_(cid))
    .filter(r => {
      const d = new Date(r.createdAt);
      return !isNaN(d) && d >= since;
    });

  const late = subs.filter(x => String(x.isLate || "") === "1").length;

  return {
    year: y,
    classId: cid,
    report: {
      rangeDays: days,
      submissions: subs.length,
      lateSubmissions: late,
      feedbacks: fbs.length,
      since: since.toISOString(),
      now: now.toISOString(),
    }
  };
}

function getLearningPath({ token, classId, studentId }) {
  requireRoleSession_(token, ["TEACHER", "ADMIN"]);
  const pilot = getPilot_();
  const y = getActiveYear_() || "2025-2026";
  const cid = enforcePilotClass_(classId || pilot.classId);
  studentId = String(studentId || "").trim();
  if (!studentId) throw new Error("Thiếu studentId");

  const subs = getAll_(CFG.SHEET_SUBMISSIONS)
    .filter(r => String(r.year || "").trim() === y)
    .filter(r => normalizeClassId_(r.classId) === normalizeClassId_(cid))
    .filter(r => String(r.studentId || "").trim() === studentId)
    .slice(-30);

  const tasks = getAll_(CFG.SHEET_TASKS)
    .filter(r => String(r.year || "").trim() === y)
    .filter(r => normalizeClassId_(r.classId) === normalizeClassId_(cid));

  const tmap = {};
  tasks.forEach(t => { tmap[String(t.taskId || "").trim()] = t; });

  const bySkill = {};
  subs.forEach(su => {
    const t = tmap[String(su.taskId || "").trim()];
    const k = String((t && t.skill) || (t && t.domain) || "GENERAL").trim() || "GENERAL";
    bySkill[k] = (bySkill[k] || 0) + 1;
  });

  let plan = "";
  try {
    plan = aiSuggestLearningPath({
      grade: pilot.grade,
      subject: pilot.subject,
      textbook: pilot.textbook,
      studentId,
      signals: bySkill
    }).planText || "";
  } catch (_) {
    plan = [
      `Lộ trình gợi ý cho ${studentId}:`,
      `- Mỗi ngày 10 phút đọc 1 đoạn + trả lời 3 câu hỏi.`,
      `- Mỗi tuần 2 bài viết ngắn (80–120 chữ) theo dàn ý.`,
      `- Ưu tiên kỹ năng ít làm: ${Object.keys(bySkill).sort((a,b)=>bySkill[a]-bySkill[b]).slice(0,2).join(", ") || "GENERAL"}.`
    ].join("\n");
  }

  return { year: y, classId: cid, studentId, signals: bySkill, planText: plan };
}

// ===========================
// MESSAGES (legacy)
// ===========================
function listMessages({ token, classId, toRole, toStudentId, threadKey, limit }) {
  const s = requireRoleSession_(token, ["TEACHER", "ADMIN", "STUDENT", "PARENT"]);
  const pilot = getPilot_();
  const y = getActiveYear_() || "2025-2026";
  const cid = enforcePilotClass_(classId || s.classId || pilot.classId);

  toRole = String(toRole || "").trim().toUpperCase();
  toStudentId = String(toStudentId || "").trim();
  threadKey = String(threadKey || "").trim();
  const lim = Math.max(1, Math.min(200, Number(limit || 50)));

  let rows = getAll_(CFG.SHEET_MESSAGES)
    .filter(r => String(r.year || "").trim() === y)
    .filter(r => normalizeClassId_(r.classId) === normalizeClassId_(cid));

  const role = String(s.role || "").toUpperCase();
  if (role === "STUDENT" || role === "PARENT") {
    rows = rows.filter(r => String(r.toStudentId || "").trim() === String(s.studentId || "").trim());
  } else {
    if (toRole) rows = rows.filter(r => String(r.toRole || "").toUpperCase() === toRole);
    if (toStudentId) rows = rows.filter(r => String(r.toStudentId || "").trim() === toStudentId);
  }

  if (threadKey) rows = rows.filter(r => String(r.threadKey || "").trim() === threadKey);

  rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  rows = rows.slice(0, lim);

  return { year: y, classId: cid, messages: rows };
}

function sendMessage({ token, classId, toRole, toStudentId, subject, content, threadKey }) {
  const s = requireRoleSession_(token, ["TEACHER", "ADMIN"]);
  const pilot = getPilot_();
  const y = getActiveYear_() || "2025-2026";
  const cid = enforcePilotClass_(classId || pilot.classId);

  toRole = String(toRole || "").trim().toUpperCase();
  toStudentId = String(toStudentId || "").trim();
  subject = String(subject || "").trim();
  content = String(content || "").trim();
  threadKey = String(threadKey || "").trim() || (toStudentId ? `${cid}::${toStudentId}` : `${cid}::broadcast`);

  if (!toRole) throw new Error("Thiếu toRole (STUDENT/PARENT)");
  if (!toStudentId) throw new Error("Thiếu toStudentId");
  if (!content) throw new Error("Thiếu content");

  const msgId = "M" + Utilities.getUuid().replace(/-/g, "").slice(0, 12);
  const createdAt = nowIso_();

  appendRow_(CFG.SHEET_MESSAGES, [
    y, cid, msgId,
    threadKey, toRole, toStudentId,
    String(s.role || "TEACHER"), String(s.displayName || "GV"),
    subject || "",
    content,
    createdAt, "",
    String(pilot.grade), String(pilot.subject), String(pilot.textbook)
  ]);

  return { sent: true, messageId: msgId };
}

// ===========================
// STUDENT/PARENT HISTORY (legacy)
// ===========================
function getMyHistory({ token, classId, studentId, limit }) {
  const s = requireRoleSession_(token, ["STUDENT"]);
  const pilot = getPilot_();
  const y = getActiveYear_() || "2025-2026";
  const cid = enforcePilotClass_(classId || s.classId || pilot.classId);
  const sid = String(studentId || s.studentId || "").trim();
  const lim = Math.max(1, Math.min(200, Number(limit || 50)));
  if (!sid) throw new Error("Thiếu studentId");

  const subs = getAll_(CFG.SHEET_SUBMISSIONS)
    .filter(r => String(r.year || "").trim() === y)
    .filter(r => normalizeClassId_(r.classId) === normalizeClassId_(cid))
    .filter(r => String(r.studentId || "").trim() === sid)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, lim);

  const fbs = getAll_(CFG.SHEET_FEEDBACKS)
    .filter(r => String(r.year || "").trim() === y)
    .filter(r => normalizeClassId_(r.classId) === normalizeClassId_(cid))
    .filter(r => String(r.studentId || "").trim() === sid)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, lim);

  return { year: y, classId: cid, studentId: sid, submissions: subs, feedbacks: fbs };
}

function getParentHistory({ token, classId, studentId, limit }) {
  const s = requireRoleSession_(token, ["PARENT"]);
  if (String(studentId || "").trim() && String(studentId).trim() !== String(s.studentId || "").trim()) {
    throw new Error("Phụ huynh chỉ được xem lịch sử của học sinh thuộc phiên đăng nhập.");
  }
  return getMyHistory({ token: token, classId: classId, studentId: s.studentId, limit: limit });
}

function getStudentSummary({ token, classId, studentId }) {
  const s = requireRoleSession_(token, ["TEACHER", "ADMIN", "STUDENT", "PARENT"]);
  const pilot = getPilot_();
  const y = getActiveYear_() || "2025-2026";
  const cid = enforcePilotClass_(classId || s.classId || pilot.classId);

  const sid = String(studentId || s.studentId || "").trim();
  if (!sid) throw new Error("Missing studentId");

  const role = String(s.role || "").toUpperCase();
  if ((role === "STUDENT" || role === "PARENT") && sid !== String(s.studentId || "").trim()) {
    throw new Error("Không có quyền xem học sinh khác.");
  }

  const subs = getAll_(CFG.SHEET_SUBMISSIONS)
    .filter(r => String(r.year || "").trim() === y)
    .filter(r => normalizeClassId_(r.classId) === normalizeClassId_(cid))
    .filter(r => String(r.studentId || "").trim() === sid);

  const fbs = getAll_(CFG.SHEET_FEEDBACKS)
    .filter(r => String(r.year || "").trim() === y)
    .filter(r => normalizeClassId_(r.classId) === normalizeClassId_(cid))
    .filter(r => String(r.studentId || "").trim() === sid);

  return { summary: { submissions: subs, feedbacks: fbs } };
}

// ===========================
// ADMIN APIs (GIỮ NGUYÊN)
// ===========================
function requireAdmin_(tokenOrBody) {
  // token có thể nằm ở token / sessionId / sid (client khác nhau)
  let tok = "";
  if (typeof tokenOrBody === "object" && tokenOrBody) {
    tok = String(tokenOrBody.token || tokenOrBody.sessionId || tokenOrBody.sid || "").trim();
  } else {
    tok = String(tokenOrBody || "").trim();
  }
  return requireRoleSession_(tok, ["ADMIN"]);
}

function adminListYears({ token }) {
  requireAdmin_(token);
  const years = listYearsArr_();
  const activeYear = getActiveYear_() || (years[0] || "");
  return { ok: true, years, activeYear };
}

function adminAddYear({ token, year }) {
  requireAdmin_(token);
  const r = addYear_({ year });
  return { ok: true, ...r };
}

function adminSetActiveYear({ token, year }) {
  requireAdmin_(token);
  const y = setActiveYear_(year);
  return { ok: true, activeYear: y };
}

function adminListClasses({ token, year }) {
  requireAdmin_(token);
  const y = String(year || "").trim() || getActiveYear_();
  if (!y) throw new Error("Chưa có năm học active");

  const classes = getAll_(CFG.SHEET_CLASSES).filter(r => String(r.year || "").trim() === y);
  const students = getAll_(CFG.SHEET_STUDENTS).filter(r => String(r.year || "").trim() === y);

  const count = {};
  students.forEach(s => {
    const cid = normalizeClassId_(s.classId);
    count[cid] = (count[cid] || 0) + 1;
  });

  const pilot = getPilot_();
  const out = classes.map(c => {
    const cid = normalizeClassId_(c.classId);
    return {
      year: y,
      classId: cid,
      grade: String(c.grade || ""),
      studentCount: count[cid] || 0,
      health: (cid === normalizeClassId_(pilot.classId)) ? "OK" : "WARN"
    };
  });

  out.sort((a, b) => {
    const p = normalizeClassId_(pilot.classId);
    if (a.classId === p) return -1;
    if (b.classId === p) return 1;
    return String(a.classId).localeCompare(String(b.classId));
  });

  return { year: y, classes: out };
}

function adminCreateClass({ token, year, grade, classId, subject, textbook }) {
  requireAdmin_(token);

  const pilot = getPilot_();
  const y = String(year || "").trim() || getActiveYear_();
  if (!y) throw new Error("Chưa có năm học active");

  const cid = normalizeClassId_(classId);
  const g = String(grade || pilot.grade).trim() || pilot.grade;

  if (pilot.lock === "1" && cid !== normalizeClassId_(pilot.classId)) {
    throw new Error(`Chế độ pilot chỉ cho phép lớp ${pilot.classId}.`);
  }

  const subj = String(subject || pilot.subject).trim();
  const book = String(textbook || pilot.textbook).trim();

  const sh = sh_(CFG.SHEET_CLASSES);
  const data = sh.getDataRange().getValues();
  const header = data[0].map(x => String(x || "").trim());
  const idx = {};
  header.forEach((h, i) => idx[h] = i);

  let rowFound = -1;
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (String(r[idx.year] || "").trim() === y && normalizeClassId_(r[idx.classId]) === cid) {
      rowFound = i + 1; break;
    }
  }

  const now = nowIso_();
  const values = [y, cid, cid, g, subj, book, "", now];

  if (rowFound > 0) sh.getRange(rowFound, 1, 1, values.length).setValues([values]);
  else sh.appendRow(values);

  return { created: true, year: y, classId: cid };
}

function adminImportStudents({ token, year, students }) {
  requireAdmin_(token);

  const pilot = getPilot_();
  const y = String(year || "").trim() || getActiveYear_();
  if (!y) throw new Error("Chưa có năm học active");
  if (!Array.isArray(students) || !students.length) throw new Error("Thiếu danh sách học sinh");

  const sh = sh_(CFG.SHEET_STUDENTS);
  const data = sh.getDataRange().getValues();
  const header = data[0].map(x => String(x || "").trim());
  const idx = {};
  header.forEach((h, i) => idx[h] = i);

  const now = nowIso_();
  let added = 0, updated = 0;

  // year|classId|studentId => row
  const map = {};
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    const key =
      String(r[idx.year] || "").trim() + "|" +
      normalizeClassId_(r[idx.classId]) + "|" +
      String(r[idx.studentId] || "").trim();
    map[key] = i + 1;
  }

  students.forEach(st => {
    const cid = normalizeClassId_(st.classId);
    const sid = String(st.studentId || "").trim();
    const name = String(st.fullName || st.name || sid).trim();
    const phone = normalizePhoneText_(st.phone);
    const parentPhone = normalizePhoneText_(st.parentPhone);

    if (!cid || !sid) return;
    if (pilot.lock === "1" && cid !== normalizeClassId_(pilot.classId)) return;

    const key = y + "|" + cid + "|" + sid;

    const rowValues = [y, cid, sid, name, String(st.grade || pilot.grade).trim(), phone, parentPhone, now];

    if (map[key]) {
      sh.getRange(map[key], 1, 1, 8).setValues([rowValues]);
      updated++;
    } else {
      sh.appendRow(rowValues);
      added++;
    }
  });

  return { added, updated, year: y };
}

function adminOverview({ token }) {
  requireAdmin_(token);

  const pilot = getPilot_();
  const activeYear = getActiveYear_() || "2025-2026";

  const classes = getAll_(CFG.SHEET_CLASSES).filter(r => String(r.year || "").trim() === activeYear);
  const students = getAll_(CFG.SHEET_STUDENTS).filter(r => String(r.year || "").trim() === activeYear);

  const tasks = getAll_(CFG.SHEET_TASKS).filter(r => String(r.year || "").trim() === activeYear);
  const subs = getAll_(CFG.SHEET_SUBMISSIONS).filter(r => String(r.year || "").trim() === activeYear);
  const fbs = getAll_(CFG.SHEET_FEEDBACKS).filter(r => String(r.year || "").trim() === activeYear);
  const users = getAll_(CFG.SHEET_USERS);

  const totalTeachers = users.filter(u => String(u.role).toUpperCase() === "TEACHER").length;

  const stCount = {};
  students.forEach(s => {
    const cid = normalizeClassId_(s.classId);
    stCount[cid] = (stCount[cid] || 0) + 1;
  });

  const classCards = classes.map(c => {
    const cid = normalizeClassId_(c.classId);
    const health = (cid === normalizeClassId_(pilot.classId)) ? "OK" : "WARN";
    return { classId: cid, grade: String(c.grade || ""), studentCount: stCount[cid] || 0, health };
  });

  const health = {
    sheetsOk: true,
    headersOk: true,
    openaiOk: !!props_().getProperty("OPENAI_API_KEY"),
    hasPilotClass: classCards.some(x => x.classId === normalizeClassId_(pilot.classId))
  };

  return {
    overview: {
      activeYear,
      totalClasses: classCards.length,
      totalStudents: students.length,
      totalTeachers,
      totalTasks: tasks.length,
      totalSubmissions: subs.length,
      totalFeedbacks: fbs.length,
      classes: classCards,
      health
    }
  };
}

// ===========================
// AI (Responses API, robust)
// ===========================
function openaiText_(prompt, maxTokens) {
  const apiKey = props_().getProperty("OPENAI_API_KEY");
  if (!apiKey) throw new Error("Missing Script Property: OPENAI_API_KEY");
  const model = props_().getProperty("OPENAI_MODEL") || "gpt-4o-mini";

  prompt = String(prompt || "");
  if (prompt.length > CFG.MAX_AI_CHARS) prompt = prompt.slice(0, CFG.MAX_AI_CHARS);

  const url = "https://api.openai.com/v1/responses";
  const payload = { model, input: prompt, max_output_tokens: maxTokens || 500 };

  const res = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + apiKey },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const code = res.getResponseCode();
  const raw = res.getContentText();
  if (code >= 400) throw new Error("OpenAI error " + code + ": " + raw);

  const obj = JSON.parse(raw);

  if (typeof obj.output_text === "string" && obj.output_text.trim()) return obj.output_text.trim();

  const out = obj.output || [];
  let acc = "";
  for (const item of out) {
    const content = item.content || [];
    for (const c of content) {
      if ((c.type === "output_text" || c.type === "text") && c.text) acc += c.text;
    }
  }
  return String(acc || "").trim();
}

// AI: generate task (đa môn/đa khối)
function aiGenerateTask({ token, grade, subject, textbook, topic, level, domain, skill, constraints }) {
  // teacher/admin only
  requireRoleSession_(token, ["TEACHER", "ADMIN"]);
  const p = getPilot_();

  grade = String(grade || p.grade).trim();
  subject = String(subject || p.subject).trim();
  textbook = String(textbook || p.textbook).trim();
  topic = String(topic || "").trim();
  level = String(level || "nhan_biet").trim();
  domain = String(domain || "GENERAL").trim();
  skill = String(skill || "").trim();
  constraints = String(constraints || "").trim();

  if (!topic) throw new Error("Missing topic");

  // enforce pilot scope if locked
  enforcePilot_({ classId: p.classId, grade, subject, textbook });

  const prompt = [
    `Bạn là giáo viên tiểu học. Môn: ${subject}. Khối: ${grade}. Sách: "${textbook}".`,
    `Mảng: ${domain}${skill ? ` • Kỹ năng: ${skill}` : ""}. Mức độ: ${level}.`,
    `Chủ đề/bài học: ${topic}`,
    constraints ? `Ràng buộc thêm: ${constraints}` : "",
    "",
    "Hãy tạo 1 PHIẾU LUYỆN TẬP rõ ràng, ngắn gọn, phù hợp tiểu học:",
    "- Phần A: Ngữ liệu/Đề bài",
    "- Phần B: 5 câu hỏi hoặc yêu cầu (đánh số 1-5)",
    "- Phần C: Gợi ý đáp án ngắn (mỗi câu 1-2 dòng)",
  ].filter(Boolean).join("\n");

  const taskText = openaiText_(prompt, 650);
  return { taskText };
}

function aiGenerateRubric({ token, grade, subject, textbook, domain, topic, level }) {
  requireRoleSession_(token, ["TEACHER", "ADMIN"]);
  const p = getPilot_();

  grade = String(grade || p.grade).trim();
  subject = String(subject || p.subject).trim();
  textbook = String(textbook || p.textbook).trim();
  domain = String(domain || "GENERAL").trim();
  topic = String(topic || "").trim();
  level = String(level || "nhan_biet").trim();
  if (!topic) throw new Error("Thiếu topic");

  enforcePilot_({ classId: p.classId, grade, subject, textbook });

  const prompt = [
    `Bạn là giáo viên tiểu học. Môn ${subject}, khối ${grade}, sách "${textbook}".`,
    `Bài: ${topic} • Mảng: ${domain} • Mức độ: ${level}`,
    "",
    "Tạo RUBRIC chấm bài ngắn gọn:",
    "- 4 tiêu chí",
    "- Mỗi tiêu chí: mô tả + đạt/chưa đạt + gợi ý sửa",
    "- Tổng điểm gợi ý (ví dụ 10 hoặc 5)",
    "Trình bày dễ copy."
  ].join("\n");

  return { rubricText: openaiText_(prompt, 420) };
}

function aiSuggestFeedback({ token, grade, subject, textbook, rubric, answer }) {
  requireRoleSession_(token, ["TEACHER", "ADMIN"]);
  const p = getPilot_();

  grade = String(grade || p.grade).trim();
  subject = String(subject || p.subject).trim();
  textbook = String(textbook || p.textbook).trim();
  rubric = String(rubric || "").trim();
  answer = String(answer || "").trim();
  if (!rubric || !answer) throw new Error("Thiếu rubric/answer");

  enforcePilot_({ classId: p.classId, grade, subject, textbook });

  const prompt = [
    `Bạn là giáo viên tiểu học. Môn ${subject}, khối ${grade}, sách "${textbook}".`,
    "Viết nhận xét theo RUBRIC, tích cực, dễ hiểu.",
    "Đầu ra gồm 3 phần rõ ràng:",
    "1) Nhận xét cho HỌC SINH (👍 2 ý tốt, 🌱 2 ý cần cải thiện, ✏️ 1 việc làm tuần tới)",
    "2) Nhận xét cho PHỤ HUYNH (ngắn gọn, hướng dẫn đồng hành 10 phút/ngày)",
    "3) Nhận xét lưu HỒ SƠ (1 đoạn khách quan, tập trung kỹ năng)",
    "",
    "RUBRIC:",
    rubric,
    "",
    "BÀI LÀM HỌC SINH:",
    answer
  ].join("\n");

  return { feedbackText: openaiText_(prompt, 650) };
}

function aiSuggestLearningPath({ grade, subject, textbook, studentId, signals }) {
  // called internally; if used externally, wrap with token check at endpoint level
  const prompt = [
    `Bạn là chuyên gia giáo dục tiểu học. Môn ${subject}, khối ${grade}, sách "${textbook}".`,
    `Học sinh: ${studentId}`,
    "Tín hiệu số lần làm theo kỹ năng/mảng (JSON):",
    JSON.stringify(signals || {}),
    "",
    "Hãy đề xuất LỘ TRÌNH 2 TUẦN, mỗi ngày 10-15 phút:",
    "- 6-8 gạch đầu dòng theo ngày/tuần",
    "- Nêu rõ kỹ năng ưu tiên",
    "- Có 1 câu động viên cuối"
  ].join("\n");
  return { planText: openaiText_(prompt, 520) };
}

function aiClassWeeklyReport({ token, classId, rangeDays }) {
  requireRoleSession_(token, ["TEACHER", "ADMIN"]);
  const p = getPilot_();
  const y = getActiveYear_() || "2025-2026";
  const cid = enforcePilotClass_(classId || p.classId);
  const days = Math.max(1, Math.min(30, Number(rangeDays || 7)));

  const now = new Date();
  const since = new Date(now.getTime() - days * 24 * 3600 * 1000);

  const subs = getAll_(CFG.SHEET_SUBMISSIONS)
    .filter(r => String(r.year || "").trim() === y)
    .filter(r => normalizeClassId_(r.classId) === normalizeClassId_(cid))
    .filter(r => {
      const d = new Date(r.createdAt);
      return !isNaN(d) && d >= since;
    });

  const fbs = getAll_(CFG.SHEET_FEEDBACKS)
    .filter(r => String(r.year || "").trim() === y)
    .filter(r => normalizeClassId_(r.classId) === normalizeClassId_(cid))
    .filter(r => {
      const d = new Date(r.createdAt);
      return !isNaN(d) && d >= since;
    });

  const prompt = [
    `Bạn là trợ lý giáo vụ tiểu học. Lập BÁO CÁO LỚP ${cid} trong ${days} ngày.`,
    `Môn/khối theo pilot: ${p.subject} - Khối ${p.grade}.`,
    "",
    "Dữ liệu (tóm tắt):",
    `- Số bài nộp: ${subs.length}`,
    `- Số nhận xét: ${fbs.length}`,
    `- Nộp muộn: ${subs.filter(x => String(x.isLate || "") === "1").length}`,
    "",
    "Viết báo cáo 1 trang gồm:",
    "1) Tóm tắt",
    "2) Điểm tích cực",
    "3) Vấn đề tồn tại",
    "4) Đề xuất tuần tới (5 gạch đầu dòng)",
    "5) Một câu chốt động viên"
  ].join("\n");

  return { reportText: openaiText_(prompt, 650) };
}
function getClassDashboard({ token, classId }) {
  // Teacher dashboard.html đang gọi action này
  const s = token ? requireRoleSession_(token, ["TEACHER","ADMIN"]) : null;
  const p = getPilot_();
  const y = getActiveYear_() || "2025-2026";
  const cid = enforcePilotClass_(classId || (s && s.classId) || p.classId);

  const students = getAll_(CFG.SHEET_STUDENTS)
    .filter(r => String(r.year||"").trim()===y)
    .filter(r => normalizeClassId_(r.classId)===normalizeClassId_(cid));

  const tasks = getAll_(CFG.SHEET_TASKS)
    .filter(r => String(r.year||"").trim()===y)
    .filter(r => normalizeClassId_(r.classId)===normalizeClassId_(cid));

  const subs = getAll_(CFG.SHEET_SUBMISSIONS)
    .filter(r => String(r.year||"").trim()===y)
    .filter(r => normalizeClassId_(r.classId)===normalizeClassId_(cid));

  const since = new Date(Date.now() - 7*24*3600*1000);
  const last7Days = subs.filter(x => {
    const d = new Date(x.createdAt);
    return !isNaN(d) && d >= since;
  });

  return {
    system: { classId: cid, grade: p.grade, subject: p.subject, textbook: p.textbook, lockScope: p.lockScope },
    dashboard: {
      students: students.map(x=>({studentId:x.studentId, name:x.name})),
      totalTasks: tasks.length,
      totalSubmissions: subs.length,
      last7Days
    }
  };
}

function teacherPublishTask({ token, classId, task }) {
  // assign-reading.html / assign-writing.html gọi action này
  requireRoleSession_(token, ["TEACHER","ADMIN"]);
  const p = getPilot_();
  const y = getActiveYear_() || "2025-2026";
  const cid = enforcePilotClass_(classId || p.classId);

  if(!task || !task.taskId) throw new Error("Thiếu task/taskId");

  // map tối thiểu từ HTML sang schema TASKS hiện có
  const t = {
    taskId: String(task.taskId).trim(),
    domain: String(task.domain || "GENERAL").trim(),
    skill: String(task.skill || "").trim(),
    unit: String(task.unit || "").trim(),
    topic: String(task.topic || "").trim(),
    level: String(task.level || "nhan_biet").trim(),
    body: String(task.body || "").trim(),
    rubric: String(task.rubric || "").trim(),
    dueAt: String(task.dueAt || "").trim(),
    status: "PUBLISHED",
    createdAt: String(task.createdAt || nowIso_()),
    publishedAt: nowIso_(),
    grade: String(task.grade || p.grade).trim(),
    subject: String(task.subject || p.subject).trim(),
    textbook: String(task.textbook || p.textbook).trim(),
    tags: String(task.tags || "").trim(),
  };

  // reuse upsertTask (đảm bảo không lệch schema)
  upsertTask({ token, classId: cid, year: y, task: t });
  return { published: true, taskId: t.taskId };
}

function teacherListFilters({ token, classId }) {
  // submissions.html gọi để lấy dropdown task
  requireRoleSession_(token, ["TEACHER","ADMIN"]);
  const p = getPilot_();
  const y = getActiveYear_() || "2025-2026";
  const cid = enforcePilotClass_(classId || p.classId);

  const tasks = getAll_(CFG.SHEET_TASKS)
    .filter(r => String(r.year||"").trim()===y)
    .filter(r => normalizeClassId_(r.classId)===normalizeClassId_(cid))
    .filter(r => String(r.status||"").toUpperCase()==="PUBLISHED")
    .map(t => ({ taskId: String(t.taskId||"").trim(), topic: String(t.topic||"").trim() }))
    .filter(x=>x.taskId);

  return { tasks };
}

function teacherListSubmissions({ token, classId, taskId }) {
  // submissions.html gọi action này
  return listSubmissions({ token, classId, taskId });
}

function teacherGradebook({ token, classId }) {
  // gradebook.html gọi action này
  return getGradebook({ token, classId });
}
function teacherInsights({ token, classId, studentId, rangeDays, includeMessages, limit }) {
  // Alias tổng hợp cho trang teacher-insights.html
  requireRoleSession_(token, ["TEACHER", "ADMIN"]);
  const p = getPilot_();
  const cid = enforcePilotClass_(classId || p.classId);

  const out = {};

  // 1) Gradebook (tiến độ lớp)
  try {
    const gb = getGradebook({ token, classId: cid });
    out.gradebook = { taskCount: gb.taskCount, rows: gb.rows, year: gb.year, classId: gb.classId };
  } catch (e) {
    out.gradebook = { error: String(e.message || e) };
  }

  // 2) Report (7 ngày mặc định)
  try {
    const rep = getClassReport({ token, classId: cid, rangeDays: rangeDays || 7 });
    out.report = rep.report;
  } catch (e) {
    out.report = { error: String(e.message || e) };
  }

  // 3) Learning path (nếu có studentId)
  const sid = String(studentId || "").trim();
  if (sid) {
    try {
      const lp = getLearningPath({ token, classId: cid, studentId: sid });
      out.learningPath = { studentId: sid, signals: lp.signals, planText: lp.planText };
    } catch (e) {
      out.learningPath = { studentId: sid, error: String(e.message || e) };
    }
  } else {
    out.learningPath = null;
  }

  // 4) Messages (optional)
  if (String(includeMessages || "").trim() === "1" || includeMessages === true) {
    try {
      const msg = listMessages({ token, classId: cid, limit: limit || 50 });
      out.messages = msg.messages || [];
    } catch (e) {
      out.messages = { error: String(e.message || e) };
    }
  }

  return out;
}
function teacherSaveFeedback(body) {
  // Alias thống nhất cho teacher-grading.html
  // Hỗ trợ 2 mode:
  // A) full grading: score/scoreMax + feedbackHS/PH/Profile + rubricSnapshot
  // B) typed/AI feedback: feedbackText + feedbackType (HS/PH/PROFILE)

  const token = body.token;
  const classId = body.classId;

  // bắt buộc phải là GV/ADMIN
  const s = requireRoleSession_(token, ["TEACHER", "ADMIN"]);
  const p = getPilot_();
  const cid = enforcePilotClass_(classId || p.classId);

  const taskId = String(body.taskId || "").trim();
  const studentId = String(body.studentId || "").trim();
  if (!taskId || !studentId) throw new Error("Thiếu taskId/studentId");

  // Nếu có feedbackText -> dùng saveFeedbackTyped
  const feedbackText = String(body.feedbackText || "").trim();
  if (feedbackText) {
    const feedbackType = String(body.feedbackType || "HS").trim().toUpperCase(); // HS/PH/PROFILE
    return saveFeedbackTyped({
      token,
      classId: cid,
      studentId,
      taskId,
      feedbackText,
      feedbackType
    });
  }

  // Ngược lại: dùng saveGrade (chấm đầy đủ)
  const score = (body.score !== undefined) ? body.score : "";
  const scoreMax = (body.scoreMax !== undefined) ? body.scoreMax : "";

  // 3 kênh nhận xét
  const feedbackHS = String(body.feedbackHS || "").trim();
  const feedbackPH = String(body.feedbackPH || "").trim();
  const feedbackProfile = String(body.feedbackProfile || "").trim();

  // rubric snapshot
  const rubricSnapshot = String(body.rubricSnapshot || "").trim();

  const aiUsed = (String(body.aiUsed || "") === "1" || body.aiUsed === true);

  // Nếu chẳng có gì ngoài điểm -> vẫn cho lưu, nhưng ít nhất phải có 1 trong các trường
  const hasAnything = String(score).trim() || String(scoreMax).trim() || feedbackHS || feedbackPH || feedbackProfile || rubricSnapshot;
  if (!hasAnything) throw new Error("Không có dữ liệu nhận xét/điểm để lưu.");

  return saveGrade({
    token,
    classId: cid,
    taskId,
    studentId,
    score,
    scoreMax,
    feedbackHS,
    feedbackPH,
    feedbackProfile,
    rubricSnapshot,
    aiUsed
  });
}

function studentListTasks({ token, schoolYear, classId, studentId }) {
  // do-task.html gọi action này
  // nếu api.js auto đính token thì ok; nếu không có token, vẫn chạy theo studentId/classId (nhưng ưu tiên token)
  return listTasksForStudent({ token, classId, studentId });
}

function studentSubmit({ token, schoolYear, classId, studentId, taskId, answer }) {
  return submitAnswerCore_({ token, classId, studentId, taskId, answer });
}

function studentGetFeedback({ token, schoolYear, classId, studentId, taskId }) {
  // do-task.html gọi action này
  const s = token ? requireRoleSession_(token, ["STUDENT","PARENT"]) : null;
  const p = getPilot_();
  const y = getActiveYear_() || "2025-2026";
  const cid = enforcePilotClass_(classId || (s && s.classId) || p.classId);
  const sid = String(studentId || (s && s.studentId) || "").trim();
  taskId = String(taskId || "").trim();
  if(!sid || !taskId) throw new Error("Thiếu studentId/taskId");

  const fb = getAll_(CFG.SHEET_FEEDBACKS).find(f =>
    String(f.year||"").trim()===y &&
    normalizeClassId_(f.classId)===normalizeClassId_(cid) &&
    String(f.studentId||"").trim()===sid &&
    String(f.taskId||"").trim()===taskId
  );

  // ưu tiên feedbackHS, nếu chưa có thì fallback
  const txt = fb ? (fb.feedbackHS || fb.feedbackProfile || fb.feedbackPH || "") : "";
  return { feedbackText: String(txt||"") };
}

function studentDashboard({ token, schoolYear, classId, studentId }) {
  // student/dashboard.html gọi action này
  const s = token ? requireRoleSession_(token, ["STUDENT"]) : null;
  const p = getPilot_();
  const y = getActiveYear_() || "2025-2026";
  const cid = enforcePilotClass_(classId || (s && s.classId) || p.classId);
  const sid = String(studentId || (s && s.studentId) || "").trim();
  if(!sid) throw new Error("Thiếu studentId");

  const tasks = getAll_(CFG.SHEET_TASKS)
    .filter(r => String(r.year||"").trim()===y)
    .filter(r => normalizeClassId_(r.classId)===normalizeClassId_(cid))
    .filter(r => String(r.status||"").toUpperCase()==="PUBLISHED");

  const subs = getAll_(CFG.SHEET_SUBMISSIONS)
    .filter(r => String(r.year||"").trim()===y)
    .filter(r => normalizeClassId_(r.classId)===normalizeClassId_(cid))
    .filter(r => String(r.studentId||"").trim()===sid);

  const fbs = getAll_(CFG.SHEET_FEEDBACKS)
    .filter(r => String(r.year||"").trim()===y)
    .filter(r => normalizeClassId_(r.classId)===normalizeClassId_(cid))
    .filter(r => String(r.studentId||"").trim()===sid);

  const subSet = new Set(subs.map(x=>String(x.taskId||"").trim()));
  const tasksForTable = tasks.map(t => ({
    taskId: String(t.taskId||"").trim(),
    title: String(t.topic||t.unit||t.taskId||"").trim(),
    type: String(t.domain||"GENERAL").trim(),
    typeLabel: String(t.domain||"").trim()
  })).filter(x=>x.taskId);

  // “Nhận xét mới”: tạm tính 7 ngày gần nhất
  const since = new Date(Date.now() - 7*24*3600*1000);
  const newFeedback = fbs.filter(x=>{
    const d = new Date(x.updatedAt || x.createdAt);
    return !isNaN(d) && d >= since;
  }).length;

  return {
    dashboard: {
      totalTasks: tasks.length,
      submitted: subSet.size,
      newFeedback,
      tasks: tasksForTable
    }
  };
}

function studentProgress({ token, schoolYear, classId, studentId }) {
  // student/progress.html gọi action này
  const s = token ? requireRoleSession_(token, ["STUDENT"]) : null;
  const p = getPilot_();
  const y = getActiveYear_() || "2025-2026";
  const cid = enforcePilotClass_(classId || (s && s.classId) || p.classId);
  const sid = String(studentId || (s && s.studentId) || "").trim();
  if(!sid) throw new Error("Thiếu studentId");

  const subs = getAll_(CFG.SHEET_SUBMISSIONS)
    .filter(r => String(r.year||"").trim()===y)
    .filter(r => normalizeClassId_(r.classId)===normalizeClassId_(cid))
    .filter(r => String(r.studentId||"").trim()===sid);

  const fbs = getAll_(CFG.SHEET_FEEDBACKS)
    .filter(r => String(r.year||"").trim()===y)
    .filter(r => normalizeClassId_(r.classId)===normalizeClassId_(cid))
    .filter(r => String(r.studentId||"").trim()===sid);

  // gom theo tuần ISO đơn giản
  const byWeek = {};
  subs.forEach(x=>{
    const d = new Date(x.createdAt);
    const key = isNaN(d) ? "—" : `${d.getFullYear()}-W${Math.ceil((((d - new Date(d.getFullYear(),0,1)) / 86400000) + new Date(d.getFullYear(),0,1).getDay()+1)/7)}`;
    byWeek[key] = byWeek[key] || { weekLabel:key, submitted:0, feedbackCount:0, note:"" };
    byWeek[key].submitted++;
  });
  fbs.forEach(x=>{
    const d = new Date(x.createdAt);
    const key = isNaN(d) ? "—" : `${d.getFullYear()}-W${Math.ceil((((d - new Date(d.getFullYear(),0,1)) / 86400000) + new Date(d.getFullYear(),0,1).getDay()+1)/7)}`;
    byWeek[key] = byWeek[key] || { weekLabel:key, submitted:0, feedbackCount:0, note:"" };
    byWeek[key].feedbackCount++;
  });

  const rows = Object.values(byWeek).sort((a,b)=>String(b.weekLabel).localeCompare(String(a.weekLabel)));
  return { rows };
}
function parentNotes({ token, schoolYear, classId, studentId }) {
  const s = token ? requireRoleSession_(token, ["PARENT"]) : null;
  const p = getPilot_();
  const y = getActiveYear_() || "2025-2026";
  const cid = enforcePilotClass_(classId || (s && s.classId) || p.classId);
  const sid = String(studentId || (s && s.studentId) || "").trim();
  if(!sid) throw new Error("Thiếu studentId");

  const rows = getAll_(CFG.SHEET_FEEDBACKS)
    .filter(r => String(r.year||"").trim()===y)
    .filter(r => normalizeClassId_(r.classId)===normalizeClassId_(cid))
    .filter(r => String(r.studentId||"").trim()===sid)
    .map(r => ({ createdAt: r.createdAt || r.updatedAt || "", text: r.feedbackPH || r.feedbackHS || r.feedbackProfile || "" }))
    .filter(x=>String(x.text||"").trim())
    .sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));

  return { rows };
}

function parentProgress({ token, schoolYear, classId, studentId }) {
  const s = token ? requireRoleSession_(token, ["PARENT"]) : null;
  const p = getPilot_();
  const y = getActiveYear_() || "2025-2026";
  const cid = enforcePilotClass_(classId || (s && s.classId) || p.classId);
  const sid = String(studentId || (s && s.studentId) || "").trim();
  if(!sid) throw new Error("Thiếu studentId");

  const subs = getAll_(CFG.SHEET_SUBMISSIONS)
    .filter(r => String(r.year||"").trim()===y)
    .filter(r => normalizeClassId_(r.classId)===normalizeClassId_(cid))
    .filter(r => String(r.studentId||"").trim()===sid);

  const fbs = getAll_(CFG.SHEET_FEEDBACKS)
    .filter(r => String(r.year||"").trim()===y)
    .filter(r => normalizeClassId_(r.classId)===normalizeClassId_(cid))
    .filter(r => String(r.studentId||"").trim()===sid);

  // tuần đơn giản
  const byWeek = {};
  subs.forEach(x=>{
    const d = new Date(x.createdAt);
    const key = isNaN(d) ? "—" : `${d.getFullYear()}-W${Math.ceil((((d - new Date(d.getFullYear(),0,1)) / 86400000) + new Date(d.getFullYear(),0,1).getDay()+1)/7)}`;
    byWeek[key] = byWeek[key] || { weekLabel:key, completed:0, noteCount:0, note:"" };
    byWeek[key].completed++;
  });
  fbs.forEach(x=>{
    const d = new Date(x.createdAt);
    const key = isNaN(d) ? "—" : `${d.getFullYear()}-W${Math.ceil((((d - new Date(d.getFullYear(),0,1)) / 86400000) + new Date(d.getFullYear(),0,1).getDay()+1)/7)}`;
    byWeek[key] = byWeek[key] || { weekLabel:key, completed:0, noteCount:0, note:"" };
    byWeek[key].noteCount++;
  });

  const rows = Object.values(byWeek).sort((a,b)=>String(b.weekLabel).localeCompare(String(a.weekLabel)));
  return { rows };
}

function parentWeekReport({ token, schoolYear, classId, studentId }) {
  const s = token ? requireRoleSession_(token, ["PARENT"]) : null;
  const p = getPilot_();
  const y = getActiveYear_() || "2025-2026";
  const cid = enforcePilotClass_(classId || (s && s.classId) || p.classId);
  const sid = String(studentId || (s && s.studentId) || "").trim();
  if(!sid) throw new Error("Thiếu studentId");

  const weekKey = "WEEK_" + new Date().toISOString().slice(0,10); // key đơn giản theo ngày (anh có thể đổi theo tuần ISO sau)
  const since = new Date(Date.now() - 7*24*3600*1000);

  const subs = getAll_(CFG.SHEET_SUBMISSIONS)
    .filter(r => String(r.year||"").trim()===y)
    .filter(r => normalizeClassId_(r.classId)===normalizeClassId_(cid))
    .filter(r => String(r.studentId||"").trim()===sid)
    .filter(r => { const d=new Date(r.createdAt); return !isNaN(d) && d>=since; });

  const fbs = getAll_(CFG.SHEET_FEEDBACKS)
    .filter(r => String(r.year||"").trim()===y)
    .filter(r => normalizeClassId_(r.classId)===normalizeClassId_(cid))
    .filter(r => String(r.studentId||"").trim()===sid)
    .filter(r => { const d=new Date(r.createdAt); return !isNaN(d) && d>=since; });

  const items = subs.map(x=>({
    taskId: x.taskId,
    title: x.taskId,
    status: "OK",
    statusLabel: "Đã nộp",
    note: ""
  }));

  const teacherNote = (fbs[0] && (fbs[0].feedbackPH || fbs[0].feedbackHS || "")) || "";

  return {
    report: {
      weekLabel: weekKey,
      submitted: subs.length,
      noteCount: fbs.length,
      teacherNote,
      items
    }
  };
}

function parentConfirmRead({ token, schoolYear, classId, studentId }) {
  const s = token ? requireRoleSession_(token, ["PARENT"]) : null;
  const p = getPilot_();
  const y = getActiveYear_() || "2025-2026";
  const cid = enforcePilotClass_(classId || (s && s.classId) || p.classId);
  const sid = String(studentId || (s && s.studentId) || "").trim();
  if(!sid) throw new Error("Thiếu studentId");

  const weekKey = "WEEK_" + new Date().toISOString().slice(0,10);
  appendRow_(CFG.SHEET_PARENT_ACKS, [y, cid, sid, weekKey, nowIso_()]);
  return { ok:true };
}

// ===========================
// RUN ONCE
// ===========================
function INIT_SYSTEM() {
  ensureSheets_();
  Logger.log("✅ INIT_SYSTEM: created sheets + headers + years/settings + pilot class.");
}
