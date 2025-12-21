// assets/parent-ui.js
// Parent Topbar SSOT (UI only) — đồng bộ config.js, không can thiệp backend

(function () {
  "use strict";

  function cfg_() {
    try { return (typeof getConfig === "function") ? (getConfig() || {}) : {}; }
    catch (_) { return {}; }
  }

  // pages/parent/... -> ../../
  function relFromParent_(p) {
    return "../../" + String(p || "").replace(/^\/+/, "");
  }

  function esc_(s) {
    return String(s ?? "").replace(/[&<>"]/g, m => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"
    }[m]));
  }

  function readSession_() {
    // ưu tiên core.js nếu có getSession()
    try {
      if (typeof getSession === "function") {
        const s = getSession();
        if (s) return s;
      }
    } catch (_) { }

    // fallback: localStorage
    try {
      const raw = localStorage.getItem("hedu_session");
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) { return null; }
  }

  function clearSession_() {
    try { if (typeof clearSession === "function") clearSession(); } catch (_) { }
    try { localStorage.removeItem("hedu_session"); } catch (_) { }
    try { localStorage.removeItem("hedu_entry"); } catch (_) { }
  }

  function activeKey_() {
    const k = document.body?.getAttribute("data-active") || "";
    return String(k).trim();
  }

  // ✅ PUBLIC
  window.renderParentTopbar = function renderParentTopbar(activeKey) {
    const holder = document.getElementById("topbar");
    if (!holder) return;

    const cfg = cfg_();
    const SCHOOL = cfg.SCHOOL_NAME || "Nhà trường";
    const LOGO = cfg.LOGO_URL ? relFromParent_(cfg.LOGO_URL) : "";

    const s = readSession_();
    const role = String(s?.role || s?.userRole || "").toUpperCase();
    const parentName = String(s?.parentName || "").trim();

    // subline đúng yêu cầu: “Phụ huynh” (không nhồi thêm chip)
    const subLine = parentName ? ("PH: " + parentName) : "Phụ huynh";

    const act = activeKey || activeKey_();

    holder.innerHTML = `
      <header class="topbar parent-topbar">
        <div class="inner">
          <div class="brand" style="cursor:default">
            <div class="logo" id="pLogoBox" style="background:#fff;border:1px solid rgba(15,23,42,.10);box-shadow:0 10px 22px rgba(15,23,42,.10);overflow:hidden">
              ${LOGO
                ? `<img src="${esc_(LOGO)}" alt="Logo" style="width:100%;height:100%;object-fit:cover;display:block">`
                : `H`
              }
            </div>
            <div class="meta" style="min-width:0">
              <div class="title" id="pBrandTitle" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc_(SCHOOL)}</div>
              <div class="sub" id="pBrandSub" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc_(subLine)}</div>
            </div>
          </div>

          <nav class="nav parent-nav-one-line" aria-label="Điều hướng phụ huynh">
            <a class="chip ${act === "week" ? "active" : ""}" href="./week.html" data-nav="week">Tuần này</a>
            <a class="chip ${act === "progress" ? "active" : ""}" href="./progress.html" data-nav="progress">Tiến bộ</a>
            <a class="chip ${act === "notes" ? "active" : ""}" href="./notes.html" data-nav="notes">Nhận xét</a>
          </nav>

          <div class="top-actions">
            <button class="chip parent-press" id="btnLogout" type="button" aria-label="Đăng xuất">Đăng xuất</button>
          </div>
        </div>
      </header>

      <style>
        .parent-nav-one-line{
          flex-wrap:nowrap !important;
          overflow-x:auto;
          justify-content:center;
          -webkit-overflow-scrolling:touch;
          scrollbar-width:thin;
        }
        .parent-nav-one-line .chip{ white-space:nowrap; flex:0 0 auto; }

        /* ✅ Hiệu ứng bấm menu + logout (nhẹ, chuyên nghiệp) */
        .parent-press, .parent-topbar .chip{
          transition: transform .08s ease, filter .15s ease;
          user-select:none;
        }
        .parent-topbar .chip:hover{ filter:brightness(.98); }
        .parent-topbar .chip:active{ transform:scale(.98); }
        .parent-press:active{ transform:scale(.98); }
      </style>
    `;

    // ✅ đảm bảo logout luôn bấm được (nhiều khi bị overlay/đè)
    const btn = document.getElementById("btnLogout");
    if (btn) {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        try { if (typeof apiPost === "function") await apiPost("authLogout", {}); } catch (_) { }
        clearSession_();

        // ✅ yêu cầu ông chủ: logout về index.html
        window.location.href = "../../index.html";
      }, { passive: false });
    }

    // (Không tự redirect nếu chưa login — tránh “bị đẩy ra”)
    // Vai trò sẽ được page tự xử lý phần dữ liệu.
  };

})();
