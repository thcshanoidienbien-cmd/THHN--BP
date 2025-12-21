/* assets/auth-modal.js
 * HEDU – Auth Modal Controller (JS thuần)
 * Yêu cầu: assets/config.js phải set window.APP_SCRIPT_URL
 */

// ====== CONFIG ======
const LS_KEY = "hed_u_session";

// ====== HELPERS ======
function $(sel) { return document.querySelector(sel); }
function val(id) { const el = document.getElementById(id); return el ? String(el.value || "").trim() : ""; }
function setText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text || ""; }
function show(id, yes) { const el = document.getElementById(id); if (el) el.style.display = yes ? "" : "none"; }

function getSession() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "null"); }
  catch (_) { return null; }
}
function saveSession(session) {
  localStorage.setItem(LS_KEY, JSON.stringify(session || null));
}
function clearSession() {
  localStorage.removeItem(LS_KEY);
}

async function apiPost(action, payload = {}) {
  const url = window.APP_SCRIPT_URL;
  if (!url || !String(url).includes("/exec")) {
    throw new Error("Thiếu hoặc sai APP_SCRIPT_URL trong assets/config.js");
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });

  const data = await res.json().catch(() => null);
  if (!data) throw new Error("API không trả JSON hợp lệ");

  // chuẩn doPost: { ok:true/false, error?, ... }
  if (data.ok === false) throw new Error(data.error || "API error");
  return data;
}

// ====== REDIRECT MAP ======
function redirectByRole(role) {
  const r = String(role || "").toUpperCase();
  const map = {
    TEACHER: "pages/teacher/teacher-dashboard.html",
    STUDENT: "pages/student/dashboard.html",
    PARENT:  "pages/parent/dashboard.html",
    ADMIN:   "pages/admin/admin-dashboard.html",
  };
  location.href = map[r] || "index.html";
}

// ====== MODAL CONTROL ======
let _targetRole = "TEACHER";

window.openAuthModal = async function openAuthModal(role) {
  _targetRole = String(role || "TEACHER").toUpperCase();

  // nếu đã có session đúng role -> đi thẳng
  const s = getSession();
  if (s && String(s.role || "").toUpperCase() === _targetRole && s.sessionId) {
    redirectByRole(_targetRole);
    return;
  }

  // mở modal
  const modal = document.getElementById("authModal");
  if (!modal) {
    alert("Thiếu #authModal trong HTML");
    return;
  }
  modal.style.display = "block";

  setText("authRoleTitle", _targetRole);

  // bật/tắt form theo role
  // (Các block này là optional; nếu HTML không có thì cũng không crash)
  show("authBlockTeacher", _targetRole === "TEACHER");
  show("authBlockStudent", _targetRole === "STUDENT");
  show("authBlockParent",  _targetRole === "PARENT");
  show("authBlockAdmin",   _targetRole === "ADMIN");

  setText("authMsg", "");

  // student/parent cần list lớp
  if (_targetRole === "STUDENT" || _targetRole === "PARENT") {
    await loadClassesToSelect();
  }
};

window.closeAuthModal = function closeAuthModal() {
  const modal = document.getElementById("authModal");
  if (modal) modal.style.display = "none";
  setText("authMsg", "");
};

async function loadClassesToSelect() {
  const sel = document.getElementById("authClassId");
  if (!sel) return;

  sel.innerHTML = `<option value="">-- Chọn lớp --</option>`;
  try {
    const data = await apiPost("listClassesPublic", {});
    const classes = (data.classes || []).map(x => String(x.classId || "").trim()).filter(Boolean);

    classes.forEach(cid => {
      const opt = document.createElement("option");
      opt.value = cid;
      opt.textContent = cid;
      sel.appendChild(opt);
    });
  } catch (e) {
    // không throw để khỏi chặn mở modal
    setText("authMsg", "Không tải được danh sách lớp. Kiểm tra Web App URL / quyền deploy.");
  }
}

// ====== SUBMIT HANDLERS ======
window.authSubmit = async function authSubmit() {
  try {
    setText("authMsg", "");
    const role = _targetRole;

    if (role === "TEACHER") {
      const account = val("authAccount");
      const password = val("authPassword");
      if (!account || !password) throw new Error("Thiếu tài khoản/mật khẩu");

      const res = await apiPost("authTeacherLogin", { account, password });
      if (!res.session || !res.session.sessionId) throw new Error("Không tạo được phiên đăng nhập");
      saveSession(res.session);
      redirectByRole("TEACHER");
      return;
    }

    if (role === "STUDENT") {
      const classId = val("authClassId");
      const studentId = val("authStudentId");
      const name = val("authName");
      const phone = val("authPhone");
      const parentPhone = val("authParentPhone");
      if (!classId) throw new Error("Chưa chọn lớp");
      if (!studentId) throw new Error("Thiếu mã học sinh");

      const res = await apiPost("authStudentLogin", { classId, studentId, name, phone, parentPhone });
      if (!res.session || !res.session.sessionId) throw new Error("Không tạo được phiên đăng nhập");
      saveSession(res.session);
      redirectByRole("STUDENT");
      return;
    }

    if (role === "PARENT") {
      const classId = val("authClassId");
      const studentId = val("authStudentId");
      if (!classId) throw new Error("Chưa chọn lớp");
      if (!studentId) throw new Error("Thiếu mã học sinh");

      const res = await apiPost("authParentLogin", { classId, studentId });
      if (!res.session || !res.session.sessionId) throw new Error("Không tạo được phiên đăng nhập");
      saveSession(res.session);
      redirectByRole("PARENT");
      return;
    }

    if (role === "ADMIN") {
      const adminCode = val("authAdminCode");
      if (!adminCode) throw new Error("Thiếu mã BGH/Quản trị");

      const res = await apiPost("authAdminLogin", { adminCode });
      if (!res.session || !res.session.sessionId) throw new Error("Không tạo được phiên đăng nhập");
      saveSession(res.session);
      redirectByRole("ADMIN");
      return;
    }

    throw new Error("Role không hợp lệ");
  } catch (e) {
    setText("authMsg", String(e && e.message ? e.message : e));
  }
};

window.teacherRegister = async function teacherRegister() {
  try {
    setText("authMsg", "");

    const fullName = val("authFullName");
    const phone = val("authRegPhone");
    const email = val("authEmail");
    const password = val("authRegPassword");

    if (!fullName) throw new Error("Thiếu họ tên");
    if (!phone) throw new Error("Thiếu SĐT");
    if (!password || password.length < 4) throw new Error("Mật khẩu tối thiểu 4 ký tự");

    await apiPost("authTeacherRegister", { fullName, phone, email, password });

    setText("authMsg", "✅ Tạo tài khoản thành công. Giờ đăng nhập nhé!");
  } catch (e) {
    setText("authMsg", String(e && e.message ? e.message : e));
  }
};

window.authLogout = async function authLogout() {
  const s = getSession();
  try {
    if (s && s.sessionId) await apiPost("authLogout", { token: s.sessionId });
  } catch (_) {}
  clearSession();
  location.href = "index.html";
};

// ====== OPTIONAL: close modal when click overlay ======
document.addEventListener("click", (ev) => {
  const modal = document.getElementById("authModal");
  if (!modal) return;
  if (ev.target === modal) window.closeAuthModal();
});

// assets/auth-modal.js
(function () {
  const ROLE_TO_PAGE = {
    TEACHER: "pages/teacher/teacher-dashboard.html",
    STUDENT: "pages/student/dashboard.html",
    PARENT: "pages/parent/dashboard.html",
    ADMIN: "pages/admin/admin-dashboard.html",
  };

  // ===== Session helpers =====
  function getSession() {
    try {
      const raw = localStorage.getItem("hedu_session");
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function saveSession(session) {
    localStorage.setItem("hedu_session", JSON.stringify(session));
  }

  function clearSession() {
    localStorage.removeItem("hedu_session");
  }

  // ===== UI helpers (modal) =====
  function ensureModal_() {
    if (document.getElementById("authModal")) return;

    const div = document.createElement("div");
    div.id = "authModal";
    div.style.cssText = "position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.45);z-index:9999;padding:16px;";
    div.innerHTML = `
      <div style="width:100%;max-width:460px;background:#fff;border-radius:14px;padding:16px 16px 14px;box-shadow:0 16px 50px rgba(0,0,0,.25)">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
          <div>
            <div id="amTitle" style="font-weight:800;font-size:16px;">Đăng nhập</div>
            <div id="amSub" style="font-size:12px;opacity:.7;margin-top:2px;"></div>
          </div>
          <button id="amClose" style="border:0;background:#f2f2f2;border-radius:10px;padding:8px 10px;cursor:pointer;">✖</button>
        </div>

        <div style="margin-top:12px;display:flex;flex-direction:column;gap:10px;">
          <div id="amClassWrap">
            <label style="font-size:12px;opacity:.8;">Lớp</label>
            <select id="amClass" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:10px;"></select>
          </div>

          <div id="amStudentWrap">
            <label style="font-size:12px;opacity:.8;">Mã học sinh</label>
            <input id="amStudentId" placeholder="VD: HS001" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:10px;" />
          </div>

          <div id="amNameWrap">
            <label style="font-size:12px;opacity:.8;">Họ tên (tuỳ chọn)</label>
            <input id="amName" placeholder="VD: Nguyễn Văn A" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:10px;" />
          </div>

          <div id="amAccountWrap">
            <label style="font-size:12px;opacity:.8;">Tài khoản (SĐT hoặc Email)</label>
            <input id="amAccount" placeholder="VD: 090xxxxxxx" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:10px;" />
          </div>

          <div id="amPasswordWrap">
            <label style="font-size:12px;opacity:.8;">Mật khẩu</label>
            <input id="amPassword" type="password" placeholder="••••" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:10px;" />
          </div>

          <div id="amAdminWrap">
            <label style="font-size:12px;opacity:.8;">Mã BGH/Quản trị</label>
            <input id="amAdminCode" placeholder="VD: BGH2026@" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:10px;" />
          </div>

          <div id="amError" style="display:none;color:#b00020;font-size:12px;"></div>

          <button id="amSubmit" style="margin-top:2px;border:0;background:#0b5fff;color:#fff;border-radius:12px;padding:11px 12px;font-weight:700;cursor:pointer;">
            Đăng nhập
          </button>

          <button id="amLogout" style="display:none;border:0;background:#eee;border-radius:12px;padding:10px 12px;font-weight:700;cursor:pointer;">
            Đăng xuất
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(div);

    document.getElementById("amClose").onclick = closeAuthModal;
    div.addEventListener("click", (e) => {
      if (e.target && e.target.id === "authModal") closeAuthModal();
    });
  }

  function showError_(msg) {
    const el = document.getElementById("amError");
    el.style.display = msg ? "block" : "none";
    el.textContent = msg || "";
  }

  function setVisible_(id, on) {
    const el = document.getElementById(id);
    if (el) el.style.display = on ? "" : "none";
  }

  async function loadClasses_() {
    const sel = document.getElementById("amClass");
    sel.innerHTML = `<option value="">Đang tải...</option>`;
    try {
      const res = await window.apiPost("listClassesPublic", {});
      const classes = (res.classes || []).map(x => String(x.classId || "").trim()).filter(Boolean);
      sel.innerHTML = classes.length
        ? classes.map(c => `<option value="${c}">${c}</option>`).join("")
        : `<option value="">(Chưa có lớp)</option>`;

      // set default
      const def = (window.HEDU_CONFIG && window.HEDU_CONFIG.DEFAULT_CLASS_ID) || "5A1";
      if (classes.includes(def)) sel.value = def;
    } catch (e) {
      sel.innerHTML = `<option value="">(Lỗi tải lớp)</option>`;
    }
  }

  // ===== Core: openAuthModal(role) =====
  async function openAuthModal(role) {
    role = String(role || "").toUpperCase();
    ensureModal_();

    const session = getSession();
    if (session && String(session.role || "").toUpperCase() === role) {
      // ✅ đã đúng role -> vào thẳng
      location.href = ROLE_TO_PAGE[role] || "index.html";
      return;
    }

    // ✅ chưa đúng role -> mở modal
    const modal = document.getElementById("authModal");
    modal.style.display = "flex";
    showError_("");

    // setup UI theo role
    document.getElementById("amTitle").textContent =
      role === "TEACHER" ? "Đăng nhập Giáo viên" :
      role === "STUDENT" ? "Đăng nhập Học sinh" :
      role === "PARENT"  ? "Đăng nhập Phụ huynh" :
      "Đăng nhập Quản trị";

    document.getElementById("amSub").textContent = (window.SCHOOL_NAME || "");

    // show/hide fields
    setVisible_("amClassWrap", role === "STUDENT" || role === "PARENT");
    setVisible_("amStudentWrap", role === "STUDENT" || role === "PARENT");
    setVisible_("amNameWrap", role === "STUDENT");
    setVisible_("amAccountWrap", role === "TEACHER");
    setVisible_("amPasswordWrap", role === "TEACHER");
    setVisible_("amAdminWrap", role === "ADMIN");

    setVisible_("amLogout", !!session);

    // load classes only for student/parent
    if (role === "STUDENT" || role === "PARENT") await loadClasses_();

    // submit handler
    document.getElementById("amSubmit").onclick = async () => {
      try {
        showError_("");
        const classId = (document.getElementById("amClass") || {}).value || "";
        const studentId = (document.getElementById("amStudentId") || {}).value || "";
        const name = (document.getElementById("amName") || {}).value || "";
        const account = (document.getElementById("amAccount") || {}).value || "";
        const password = (document.getElementById("amPassword") || {}).value || "";
        const adminCode = (document.getElementById("amAdminCode") || {}).value || "";

        let res;

        if (role === "TEACHER") {
          res = await window.apiPost("authTeacherLogin", { account, password });
        } else if (role === "STUDENT") {
          res = await window.apiPost("authStudentLogin", { classId, studentId, name });
        } else if (role === "PARENT") {
          res = await window.apiPost("authParentLogin", { classId, studentId });
        } else if (role === "ADMIN") {
          res = await window.apiPost("authAdminLogin", { adminCode });
        } else {
          throw new Error("Role không hợp lệ");
        }

        if (!res.session) throw new Error("Không nhận được session");

        saveSession(res.session);
        closeAuthModal();
        location.href = ROLE_TO_PAGE[role] || "index.html";
      } catch (e) {
        showError_(String(e && e.message ? e.message : e));
      }
    };

    // logout
    document.getElementById("amLogout").onclick = async () => {
      try {
        const ss = getSession();
        if (ss && ss.sessionId) {
          try { await window.apiPost("authLogout", { token: ss.sessionId }); } catch (_) {}
        }
      } finally {
        clearSession();
        closeAuthModal();
        location.href = "index.html";
      }
    };
  }

  function closeAuthModal() {
    const modal = document.getElementById("authModal");
    if (modal) modal.style.display = "none";
  }

  // expose globals
  window.openAuthModal = openAuthModal;
  window.closeAuthModal = closeAuthModal;
  window.getSession = getSession;
  window.saveSession = saveSession;
  window.clearSession = clearSession;
})();
