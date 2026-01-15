// assets/parent-ui.js
// Parent Topbar SSOT + Inbox badges (UI only)

(function () {
  "use strict";

  function cfg_() {
    try { return (typeof getConfig === "function") ? (getConfig() || {}) : {}; }
    catch (_) { return {}; }
  }

  function relFromParent_(p) {
    return "../../" + String(p || "").replace(/^\/+/, "");
  }

  function esc_(s) {
    return String(s ?? "").replace(/[&<>"]/g, m => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"
    }[m]));
  }

  function readSession_() {
    try {
      if (typeof getSession === "function") {
        const s = getSession();
        if (s) return s;
      }
    } catch (_) { }
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

  // =============================
  // Inbox badge: unread feedbackPH
  // =============================
  function base_(classId, studentId) {
    return `${String(classId || "").trim()}_${String(studentId || "").trim()}`;
  }

  function kRead_(classId, studentId, fbKey) {
    return `hedu_ph_read_${base_(classId, studentId)}_${String(fbKey || "").trim()}`;
  }

  function sigOf_(fb) {
    const safe = (v) => String(v == null ? "" : v);
    return [
      safe(fb?.taskId),
      safe(fb?.feedbackPH || fb?.feedbackParent || ""),
      safe(fb?.updatedAt || fb?.createdAt || "")
    ].join("|");
  }

  function fbKey_(fb) {
    const id = String(fb?.id || fb?.feedbackId || "").trim();
    if (id) return id;
    return `${String(fb?.taskId || "").trim()}__${String(fb?.createdAt || fb?.updatedAt || "").trim()}`;
  }

  function syncSig_(classId, studentId, fb) {
    const fbk = fbKey_(fb);
    if (!fbk.trim()) return;
    const ks = `hedu_ph_sig_${base_(classId, studentId)}_${fbk}`;
    const kr = kRead_(classId, studentId, fbk);

    const sig = sigOf_(fb);
    const old = localStorage.getItem(ks) || "";
    if (old && old !== sig) {
      localStorage.removeItem(kr);
    }
    if (sig) localStorage.setItem(ks, sig);
  }

  function isUnread_(classId, studentId, fb) {
    const fbk = fbKey_(fb);
    if (!fbk.trim()) return false;
    return localStorage.getItem(kRead_(classId, studentId, fbk)) !== "1";
  }

  function markRead_(classId, studentId, fb) {
    const fbk = fbKey_(fb);
    if (!fbk.trim()) return;
    localStorage.setItem(kRead_(classId, studentId, fbk), "1");
  }

  function onlyParentFeedback_(feedbacks) {
    return (feedbacks || []).filter(fb => String(fb?.feedbackPH || fb?.feedbackParent || "").trim());
  }

  function syncFromFeedbacks_(classId, studentId, feedbacks) {
    onlyParentFeedback_(feedbacks).forEach(fb => syncSig_(classId, studentId, fb));
  }

  function countUnread_(classId, studentId, feedbacks) {
    let n = 0;
    onlyParentFeedback_(feedbacks).forEach(fb => { if (isUnread_(classId, studentId, fb)) n++; });
    return n;
  }

  function markAllRead_(classId, studentId, feedbacks) {
    onlyParentFeedback_(feedbacks).forEach(fb => markRead_(classId, studentId, fb));
  }

  function ensureBadgeCss_() {
    if (document.getElementById("heduParentBadgeCss")) return;
    const st = document.createElement("style");
    st.id = "heduParentBadgeCss";
    st.textContent = `
      .parent-topbar, .parent-topbar *{ overflow:visible !important; }
      .parent-topbar .chip{ position:relative; }

      .heduNavBadge{
        position:absolute;
        top:-6px; right:-6px;          /* ✅ đỡ cắt */
        min-width:18px; height:18px;
        padding:0 6px;
        border-radius:999px;
        background:#ef4444;
        color:#fff;
        font-weight:1000;
        font-size:11px;
        line-height:18px;
        text-align:center;
        border:2px solid #fff;
        box-shadow:0 6px 14px rgba(15,23,42,.18);
        pointer-events:none;
      }
    `;
    document.head.appendChild(st);
  }

  // ✅ setNavBadges: hỗ trợ 2 kiểu gọi + chỉ gắn vào tab "Nhận xét"
  function setNavBadges_() {
    ensureBadgeCss_();

    let n = 0;
    try {
      if (arguments.length === 1) {
        n = Number(arguments[0]) || 0;
      } else {
        const classId = arguments[0];
        const studentId = arguments[1];
        const feedbacks = arguments[2] || [];
        n = countUnread_(classId, studentId, feedbacks);
      }
    } catch (_) { n = 0; }

    const a = document.querySelector('.parent-topbar a.chip[data-nav="notes"]');
    if (!a) return;

    const old = a.querySelector('.heduNavBadge');
    if (old) old.remove();
    if (!n) return;

    const b = document.createElement('span');
    b.className = 'heduNavBadge';
    b.textContent = n >= 99 ? '99+' : String(n);
    a.appendChild(b);
  }

  window.heduParentInbox = {
    syncFromFeedbacks: syncFromFeedbacks_,
    countUnread: countUnread_,
    markAllRead: markAllRead_,
    setNavBadges: setNavBadges_
  };

  // =============================
  // Topbar renderer
  // =============================
  window.renderParentTopbar = function renderParentTopbar(activeKey) {
    const holder = document.getElementById("topbar");
    if (!holder) return;

    const cfg = cfg_();
    const SCHOOL = cfg.SCHOOL_NAME || "Nhà trường";
    const LOGO = cfg.LOGO_URL ? relFromParent_(cfg.LOGO_URL) : "";

    const s = readSession_();
    const parentName = String(s?.parentName || "").trim();
    const subLine = parentName ? ("PH: " + parentName) : "Phụ huynh";

    const act = activeKey || activeKey_();

    holder.innerHTML = `
      <header class="topbar parent-topbar">
        <div class="inner" style="overflow:visible">
          <div class="brand" style="cursor:default">
            <div class="logo" style="background:#fff;border:1px solid rgba(15,23,42,.10);box-shadow:0 10px 22px rgba(15,23,42,.10);overflow:hidden">
              ${LOGO
                ? `<img src="${esc_(LOGO)}" alt="Logo" style="width:100%;height:100%;object-fit:cover;display:block">`
                : `H`
              }
            </div>
            <div class="meta" style="min-width:0">
              <div class="title" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc_(SCHOOL)}</div>
              <div class="sub" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc_(subLine)}</div>
            </div>
          </div>

          <nav class="nav parent-nav-flex" aria-label="Điều hướng phụ huynh">
            <a class="chip ${act === "week" ? "active" : ""}" href="./week.html" data-nav="week"><span class="lbl">Tuần này</span></a>
            <a class="chip ${act === "progress" ? "active" : ""}" href="./progress.html" data-nav="progress"><span class="lbl">Tiến bộ</span></a>
            <a class="chip ${act === "notes" ? "active" : ""}" href="./notes.html" data-nav="notes"><span class="lbl">Nhận xét</span></a>
          </nav>

          <div class="top-actions">
            <button class="chip parent-press" id="btnLogout" type="button" aria-label="Đăng xuất">Đăng xuất</button>
          </div>
        </div>
      </header>

      <style>
        /* ✅ Chừa khoảng trên để badge không bị cắt */
        .parent-nav-flex{
          padding-top:10px;
          gap:8px;
          justify-content:center;
          overflow:visible !important;
        }

        /* ✅ Desktop: 1 hàng */
        @media(min-width: 860px){
          .parent-nav-flex{ flex-wrap:nowrap; }
        }

        /* ✅ Mobile/hẹp: cho xuống dòng (không cắt badge) */
        @media(max-width: 859px){
          .parent-nav-flex{ flex-wrap:wrap; }
        }

        .parent-nav-flex .chip{ white-space:nowrap; }

        .parent-press, .parent-topbar .chip{
          transition: transform .08s ease, filter .15s ease;
          user-select:none;
        }
        .parent-topbar .chip:hover{ filter:brightness(.98); }
        .parent-topbar .chip:active{ transform:scale(.98); }
        .parent-press:active{ transform:scale(.98); }
      </style>
    `;

    const btn = document.getElementById("btnLogout");
    if (btn) {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        try { if (typeof apiPost === "function") await apiPost("authLogout", {}); } catch (_) { }
        clearSession_();
        window.location.href = "../../index.html";
      }, { passive: false });
    }
  };

})();
