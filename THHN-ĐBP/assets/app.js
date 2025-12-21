// assets/app.js (FIXED - dùng api.js + config.js, KHÔNG phá UI)

// ====== UI HELPERS ======
// ===== APP ROOT: tự nhận đúng folder deploy (local / hosting) =====
const APP_ROOT = (() => {
  const parts = location.pathname.replace(/\\/g,"/").split("/").filter(Boolean);
  const i = parts.indexOf("pages");
  if (i >= 0) return "/" + parts.slice(0, i).join("/") + "/";
  // nếu đang ở /THHN-DBP/index.html -> root = /THHN-DBP/
  if (parts.length <= 1) return "/";
  return "/" + parts.slice(0, parts.length - 1).join("/") + "/";
})();

function goIndex(params = "") {
  const url = APP_ROOT + "index.html" + (params ? (params.startsWith("?") ? params : "?" + params) : "");
  location.assign(url);
}

/**
 * Guard chuẩn:
 * - Không redirect sang login.html
 * - Nếu chưa có session -> về index.html và bật modal
 */
function requireAuth(role, returnTo) {
  const ses = JSON.parse(localStorage.getItem("hedu_session") || "null");
  if (ses && ses.role === role && ses.token) return true;

  // Lưu returnTo để login xong quay lại đúng trang
  if (returnTo) localStorage.setItem("hedu_return_to", returnTo);

  // bật modal login tại index
  goIndex(`login=1&role=${encodeURIComponent(role)}`);
  return false;
}

function qs(sel, root = document) { return root.querySelector(sel); }
function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

function toast(msg, type="info") {
  let box = document.getElementById("hedu_toast");
  if (!box) {
    box = document.createElement("div");
    box.id = "hedu_toast";
    box.style.cssText = `
      position:fixed;left:50%;bottom:24px;transform:translateX(-50%);
      background:#111827;color:#fff;padding:10px 14px;border-radius:12px;
      font:14px/1.3 system-ui;box-shadow:0 10px 30px rgba(0,0,0,.18);
      opacity:0;transition:.2s;z-index:9999;max-width:90vw;text-align:center;
    `;
    document.body.appendChild(box);
  }
  box.textContent = msg;
  box.style.opacity = "1";
  setTimeout(() => (box.style.opacity = "0"), 2200);
}

function setLoginButtonState() {
  const s = getSession();
  const btn = $("#btnLoginTop");
  const user = $("#topUserBadge");
  if (!btn) return;
  if (s) {
    btn.textContent = "Đăng xuất";
    btn.dataset.state = "logout";
    if (user) {
      user.style.display = "inline-flex";
      user.textContent = `${s.role || "USER"} • ${(s.displayName || s.username || "").trim()}`;
    }
  } else {
    btn.textContent = "Đăng nhập";
    btn.dataset.state = "login";
    if (user) user.style.display = "none";
  }
}
const LS = {
  session: "hedu_session",
  returnTo: "hedu_return_to",
};

function getSession() {
  try { return JSON.parse(localStorage.getItem(LS.session) || "null"); }
  catch { return null; }
}

function setSession(s) {
  localStorage.setItem(LS.session, JSON.stringify(s || null));
}

function clearSession() {
  localStorage.removeItem(LS.session);
  localStorage.removeItem(LS.returnTo);
}

// ====== MODAL LOGIN CONTROL ======
function openLoginModal(role) {
  const modal = $("#loginModal");
  if (!modal) return;
  modal.dataset.role = role || "STUDENT";
  $("#loginRoleTitle").textContent = roleTitle_(modal.dataset.role);

  const r = modal.dataset.role;
  $("#blkTeacher").style.display = (r === "TEACHER") ? "block" : "none";
  $("#blkStudent").style.display = (r === "STUDENT") ? "block" : "none";
  $("#blkParent").style.display  = (r === "PARENT")  ? "block" : "none";
  $("#blkAdmin").style.display   = (r === "ADMIN")   ? "block" : "none";

  if (r === "STUDENT" || r === "PARENT") loadClassesPublic_();

  modal.classList.add("open");
}
function closeLoginModal() {
  const modal = $("#loginModal");
  if (!modal) return;
  modal.classList.remove("open");
}

function roleTitle_(role) {
  return ({
    TEACHER: "Đăng nhập Giáo viên",
    STUDENT: "Đăng nhập Học sinh",
    PARENT:  "Đăng nhập Phụ huynh",
    ADMIN:   "Đăng nhập BGH / Quản trị",
  })[role] || "Đăng nhập";
}

function escapeHtml_(s){
  return String(s||"").replace(/[&<>"']/g,m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
}

// ====== CLASS LIST (public) ======
async function loadClassesPublic_() {
  const sel1 = $("#studentClass");
  const sel2 = $("#parentClass");
  const setLoading = (sel) => {
    if (!sel) return;
    sel.innerHTML = `<option value="">Đang tải lớp...</option>`;
    sel.disabled = true;
  };
  setLoading(sel1); setLoading(sel2);

  try {
    // apiPost ở đây là api.js (payload=...), KHÔNG phải app.js
    const rs = await apiPost("listClassesPublic", {});
    const items = rs.classes || [];   // ✅ FIX: backend trả "classes"
    const html = [`<option value="">-- Chọn lớp --</option>`]
      .concat(items.map(c => {
        const id = String(c.classId || "").trim();
        const name = String(c.className || c.classId || "").trim();
        return `<option value="${escapeHtml_(id)}">${escapeHtml_(name || id)}</option>`;
      }))
      .join("");

    if (sel1) { sel1.innerHTML = html; sel1.disabled = false; }
    if (sel2) { sel2.innerHTML = html; sel2.disabled = false; }
  } catch (e) {
    if (sel1) sel1.innerHTML = `<option value="">Không tải được lớp</option>`;
    if (sel2) sel2.innerHTML = `<option value="">Không tải được lớp</option>`;
    toast(String(e.message || e), "error");
  }
}

// ====== AUTH ACTIONS (mapping chuẩn theo Code.gs) ======
async function loginByRole_(role) {
  if (role === "TEACHER") {
    const username = $("#t_username").value.trim();
    const password = $("#t_password").value.trim();
    if (!username || !password) return toast("Nhập đủ tài khoản + mật khẩu giáo viên nhé 🙏");

    // ✅ FIX: backend nhận {account,password}
    const rs = await apiPost("authTeacherLogin", { account: username, password });
    commitSessionAndGo_(rs.session, "TEACHER");
  }

  if (role === "STUDENT") {
    const classId = $("#studentClass").value.trim();
    const studentId = ($("#s_username").value || "").trim(); // giữ UI: ô "tài khoản" = mã HS
    const name = ($("#s_password").value || "").trim();      // giữ UI: ô "mật khẩu" = tên HS (tạm)
    if (!classId) return toast("Chọn lớp trước nhé 👇");
    if (!studentId) return toast("Nhập mã học sinh nhé 🙏");

    // ✅ FIX: backend nhận {classId, studentId, name, phone, parentPhone}
    const rs = await apiPost("authStudentLogin", { classId, studentId, name: name || studentId });
    commitSessionAndGo_(rs.session, "STUDENT");
  }

  if (role === "PARENT") {
    const classId = $("#parentClass").value.trim();
    const studentId = ($("#p_student").value || "").trim(); // giữ UI: ô mã học sinh
    // p_code UI giữ nguyên, nhưng backend hiện chưa dùng
    if (!classId) return toast("Chọn lớp trước nhé 👇");
    if (!studentId) return toast("Nhập mã học sinh nhé 🙏");

    // ✅ FIX: backend nhận {classId, studentId}
    const rs = await apiPost("authParentLogin", { classId, studentId });
    commitSessionAndGo_(rs.session, "PARENT");
  }

  if (role === "ADMIN") {
    const adminCode = $("#a_code").value.trim();
    if (!adminCode) return toast("Nhập mã BGH/Quản trị nhé 🔐");

    const rs = await apiPost("authAdminLogin", { adminCode });
    commitSessionAndGo_(rs.session, "ADMIN");
  }
}

function abs_(path){
  // luôn đi từ root dự án, không phụ thuộc đang đứng ở /pages/...
  return new URL(path, location.origin + APP_ROOT).href;
}

function commitSessionAndGo_(session, role) {
  const s = session || {};
  s.role = (s.role || role || "").toUpperCase();

  // đồng bộ token cho api.js
  if (typeof setToken_ === "function") setToken_(s.sessionId || "");

  setSession(s);
  closeLoginModal();
  setLoginButtonState();

  const map = {
    TEACHER: "pages/teacher/teacher-dashboard.html",
    STUDENT: "pages/student/dashboard.html",
    PARENT:  "pages/parent/week.html",
    ADMIN:   "pages/admin/dashboard.html",
  };

  location.href = abs_(map[s.role] || "index.html");
}

async function logoutEverywhere_() {
  try {
    // api.js tự gắn token => backend authLogout({token}) OK
    await apiPost("authLogout", {});
  } catch (e) {}

  clearSession();
  if (typeof setToken_ === "function") setToken_("");
  setLoginButtonState();
  toast("Đã đăng xuất ✅");
  if (!location.pathname.endsWith("index.html")) location.href = abs_("index.html");
}

// ====== MENU CLICK ======
function goOrLogin(role) {
  const s = getSession();
  if (s && String(s.role || "").toUpperCase() === role) {
    const map = {
      TEACHER: "./pages/teacher/dashboard.html",
      STUDENT: "./pages/student/dashboard.html",
      PARENT:  "./pages/parent/dashboard.html",
      ADMIN:   "./pages/admin/dashboard.html",
    };
    location.href = map[role] || "./";
    return;
  }
  openLoginModal(role);
}

// ====== INIT ======
document.addEventListener("click", (ev) => {
  const t = ev.target.closest("[data-go-role]");
  if (t) {
    ev.preventDefault();
    const role = t.getAttribute("data-go-role");
    goOrLogin(role);
  }

  if (ev.target && ev.target.id === "btnLoginTop") {
    ev.preventDefault();
    const state = ev.target.dataset.state || "login";
    if (state === "logout") return logoutEverywhere_();
    openLoginModal("STUDENT");
  }

  if (ev.target && ev.target.matches("[data-close-login]")) {
    ev.preventDefault();
    closeLoginModal();
  }

  if (ev.target && ev.target.matches("[data-do-login]")) {
    ev.preventDefault();
    const modal = $("#loginModal");
    const role = modal ? modal.dataset.role : "STUDENT";
    loginByRole_(role).catch(e => toast(String(e.message || e), "error"));
  }

  const roleBtn = ev.target.closest("[data-set-login-role]");
  if (roleBtn) {
    ev.preventDefault();
    openLoginModal(roleBtn.getAttribute("data-set-login-role"));
  }
});

document.addEventListener("DOMContentLoaded", () => {
  setLoginButtonState();
});
