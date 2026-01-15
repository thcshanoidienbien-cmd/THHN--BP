// assets/student-snippet.js
// SSOT Student UI + helpers (works with core.js + api.js)

(function(){
  function $(id){ return document.getElementById(id); }

  function safeCfg_(){
    try{ return (typeof getConfig === "function") ? (getConfig()||{}) : {}; }
    catch(_){ return {}; }
  }

  function setBrand_(stu){
    const cfg = (typeof getConfig === "function") ? getConfig() : {};
    const bn = $("brandName");
    const bs = $("brandSub");
    const brand = document.querySelector(".brand");

    /* 1️⃣ Dòng chính: TÊN TRƯỜNG */
    if (bn) bn.textContent = cfg.SCHOOL_NAME || "";

    /* 2️⃣ Logo trường (xử lý path TỰ ĐỘNG – KHÔNG ĐỘNG config.js) */
    if (brand && cfg.LOGO_URL) {
      if (!brand.querySelector("img")) {
        const img = document.createElement("img");
        img.src = cfg.LOGO_URL.startsWith("http")
          ? cfg.LOGO_URL
          : "../../" + cfg.LOGO_URL.replace(/^\/+/, "");
        img.alt = "Logo trường";
        img.style.width = "40px";
        img.style.height = "40px";
        img.style.objectFit = "contain";
        img.style.borderRadius = "8px";
        brand.prepend(img);
      }
    }

    /* 3️⃣ Dòng phụ: TÊN HỌC SINH */
    const s = stu || window.__STU__ || null;
    if (bs && s) {
      bs.textContent = s.studentName || s.displayName || s.studentId || "Học sinh";
    }
  }

  function wireLogout_(){
    const btn = $("btnLogout");
    if (!btn) return;
    btn.onclick = (e)=>{
      e.preventDefault();
      try{ if (typeof clearSession === "function") clearSession(); }catch(_){}
      location.href = "../../index.html"; // ✅ về trang index.html
    };
  }

  function setActivePill_(activeKey){
    const map = {
      "dashboard": "dashboard.html",
      "do-task": "do-task.html",
      "progress": "progress.html",
    };
    const href = map[activeKey] || "dashboard.html";
    document.querySelectorAll(".pills a.pill").forEach(a=>{
      const h = (a.getAttribute("href") || "").trim();
      a.classList.toggle("active", h === href);
    });
  }

  async function safeToast_(msg){
    try{ if (typeof toast === "function") toast(msg); }catch(_){}
  }

  async function studentInit(activeKey){
    wireLogout_();
    setActivePill_(activeKey);

    // Require session
    const s = (typeof requireRole === "function") ? requireRole(["STUDENT"]) : null;
    if (!s) return;

    // Expose global sớm để setBrand_ có dữ liệu
    window.__STU__ = s;

    // ✅ set brand theo yêu cầu (trường + tên HS)
    setBrand_(s);

    // Show who (dòng dưới tiêu đề trang)
    const who = $("who");
    if (who) who.textContent = `${(s.displayName||s.name||s.studentId||"Học sinh")} • ${s.classId||""}`;
  }

  window.studentInit = studentInit;
  window.studentToast = safeToast_;
})();

/* =========================================================
 * HEDU Feedback Inbox + Badges (SSOT helper)
 * - Unread = localStorage hedu_fb_read_{classId}_{studentId}_{taskId}
 * - Sig    = localStorage hedu_fb_sig_{classId}_{studentId}_{taskId}
 *   => nếu sig đổi (GV sửa nhận xét) thì tự reset unread
 * - Badge  = hiển thị SỐ nhận xét chưa đọc ở 3 tab:
 *   #tabDashboard / #tabDoTask / #tabProgress
 * ========================================================= */
(function(){
  // ===== Inject badge CSS once (đỡ phải lặp ở từng trang) =====
  (function injectBadgeCssOnce_(){
    if(document.getElementById("heduBadgeCss")) return;
    const style = document.createElement("style");
    style.id = "heduBadgeCss";
    style.textContent = `
      .pill{ position:relative; }
      /* Badge dạng bubble góc phải trên (Zalo/Facebook style) */
      .heduBadge{
        position:absolute;
        top:-7px;
        right:-7px;
        display:flex;
        align-items:center;
        justify-content:center;
        min-width:18px;
        height:18px;
        padding:0 5px;
        border-radius:999px;
        background:#ef4444;
        color:#fff;
        font-size:12px;
        font-weight:900;
        line-height:1;
        border:2px solid #fff;
        box-shadow:0 10px 22px rgba(15,23,42,.12);
        pointer-events:none;
      }
    `;
    document.head.appendChild(style);
  })();

  function keyBase_(classId, studentId, taskId){
    return `${String(classId||"").trim()}_${String(studentId||"").trim()}_${String(taskId||"").trim()}`;
  }
  function kRead_(classId, studentId, taskId){
    return `hedu_fb_read_${keyBase_(classId,studentId,taskId)}`;
  }
  function kSig_(classId, studentId, taskId){
    return `hedu_fb_sig_${keyBase_(classId,studentId,taskId)}`;
  }

  function safeStr_(v){ return String(v==null?"":v); }

  // Signature: đủ để phát hiện "nhận xét thay đổi" nhưng không cần hash crypto
  function feedbackSig_(fb){
    const parts = [
      safeStr_(fb.taskId),
      safeStr_(fb.score),
      safeStr_(fb.scoreMax),
      safeStr_(fb.feedbackHS || fb.feedbackStudent || fb.feedback || fb.comment || ""),
      safeStr_(fb.updatedAt || fb.createdAt || "")
    ];
    return parts.join("|").trim();
  }

  function ts_(fb){
    return Date.parse(fb?.updatedAt || fb?.createdAt || "") || 0;
  }

  // ✅ Compact feedbacks: lấy feedback mới nhất theo taskId
  function compactFeedbacks_(feedbacks){
    const map = Object.create(null);
    (feedbacks||[]).forEach(fb=>{
      const tid = String(fb?.taskId||"").trim();
      if(!tid) return;
      const cur = map[tid];
      map[tid] = (!cur || ts_(fb) >= ts_(cur)) ? fb : cur;
    });
    return Object.values(map);
  }

  // Sync sig: nếu nhận xét mới -> reset read
  function syncSig_(classId, studentId, fb){
    const taskId = String(fb?.taskId||"").trim();
    if(!taskId) return;
    const sig = feedbackSig_(fb);
    const ks = kSig_(classId, studentId, taskId);
    const kr = kRead_(classId, studentId, taskId);

    const old = localStorage.getItem(ks) || "";
    if(old && old !== sig){
      // nhận xét đã thay đổi => xem như chưa đọc lại
      localStorage.removeItem(kr);
    }
    if(sig) localStorage.setItem(ks, sig);
  }

  function isUnread_(classId, studentId, taskId){
    const kr = kRead_(classId, studentId, taskId);
    return localStorage.getItem(kr) !== "1";
  }

  function markRead_(classId, studentId, taskId){
    const kr = kRead_(classId, studentId, taskId);
    localStorage.setItem(kr, "1");
  }

  function syncFromFeedbacks_(classId, studentId, feedbacks){
    // ✅ chỉ sync theo feedback mới nhất để tránh đếm sai / reset sai
    compactFeedbacks_(feedbacks).forEach(fb => syncSig_(classId, studentId, fb));
  }

  function countUnread_(classId, studentId, feedbacks){
    let n = 0;
    compactFeedbacks_(feedbacks).forEach(fb=>{
      const tid = String(fb?.taskId||"").trim();
      if(!tid) return;
      if(isUnread_(classId, studentId, tid)) n++;
    });
    return n;
  }

  function _pickTabEl_(anchorId, href){
    return document.getElementById(anchorId)
      || document.querySelector(`.pills a.pill[href="${href}"]`)
      || document.querySelector(`a.pill[href="${href}"]`);
  }

  function _setBadgeOn_(el, n){
    const a = el;
    if(!a) return;

    const old = a.querySelector(".heduBadge");
    if(old) old.remove();

    if(!n) return;

    const b = document.createElement("span");
    b.className = "heduBadge";
    // kiểu Zalo/Facebook: số trắng trên nền đỏ
    b.textContent = (n >= 100) ? "99+" : String(n);
    a.appendChild(b);
  }

  // ✅ Badge cho cả 3 tab (Dashboard/Do-task/Progress)
  function setTabBadges_(n){
    const num = Number(n||0) || 0;
    _setBadgeOn_(_pickTabEl_("tabDashboard", "dashboard.html"), num);
    _setBadgeOn_(_pickTabEl_("tabDoTask", "do-task.html"), num);
    _setBadgeOn_(_pickTabEl_("tabProgress", "progress.html"), num);
  }

  // Backward compatible: chỉ set ở tabProgress (code cũ)
  function setProgressBadge_(n){
    const num = Number(n||0) || 0;
    _setBadgeOn_(_pickTabEl_("tabProgress", "progress.html"), num);
  }

  // expose
  window.heduInbox = {
    feedbackSig: feedbackSig_,
    compactFeedbacks: compactFeedbacks_,
    syncFromFeedbacks: syncFromFeedbacks_,
    isUnread: isUnread_,
    markRead: markRead_,
    countUnread: countUnread_,
    setProgressBadge: setProgressBadge_,
    setTabBadges: setTabBadges_,
  };
})();