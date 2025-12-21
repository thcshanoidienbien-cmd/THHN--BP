// assets/teacher.js
// TOPBAR Giáo viên (logo + menu 1 dòng) — chỉ UI, KHÔNG đổi tính năng

(function(){
  "use strict";

  function cfg_(){
    try{ return (typeof getConfig==="function") ? (getConfig()||{}) : (window.HEDU_CONFIG||{}); }
    catch(_){ return (window.HEDU_CONFIG||{}); }
  }

  // Root dự án: cắt tại /pages/
  function appRoot_(){
    const parts = location.pathname.replace(/\\/g,"/").split("/").filter(Boolean);
    const i = parts.indexOf("pages");
    if(i >= 0) return "/" + parts.slice(0, i).join("/") + "/";
    if(parts.length <= 1) return "/";
    return "/" + parts.slice(0, parts.length - 1).join("/") + "/";
  }
  function abs_(path){
    return new URL(String(path||""), location.origin + appRoot_()).href;
  }
  function esc_(s){
    return String(s||"").replace(/[&<>"]/g,m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[m]));
  }

  function clearAllSession_(){
    try{ if(typeof clearSession==="function") clearSession(); }catch(_){}
    try{ localStorage.removeItem("hedu_session"); }catch(_){}
    try{ localStorage.removeItem("hedu_entry"); }catch(_){}
  }

  // ✅ PUBLIC: setTeacherHeaderBadge(classId) — dashboard gọi khi đổi lớp
  window.setTeacherHeaderBadge = function(classId){
    const el = document.getElementById("teacherBadge");
    if(!el) return;
    const cid = String(classId||"").trim();
    el.style.display = cid ? "inline-flex" : "none";
    el.textContent = cid || "";
  };

  // ✅ PUBLIC: renderTeacherTopbar(activeKey)
  // activeKey: "dashboard" | "tasks" | "submissions" | "grading" | "insights"
  window.renderTeacherTopbar = function(activeKey){
    const bar = document.getElementById("topbar");
    if(!bar) return;

    const cfg = cfg_();
    const SCHOOL_NAME = cfg.SCHOOL_NAME || "";
    const LOGO_URL = cfg.LOGO_URL || "assets/img/logo-school.jpg";

    // Lấy session để hiển thị “GV: ...” (KHÔNG hiện lớp ở dòng này theo yêu cầu #2)
    let s = null;
    try{ s = (typeof requireRole==="function") ? requireRole(["TEACHER"]) : null; }catch(_){}
    const gvName = (s && s.displayName) ? String(s.displayName) : "Giáo viên";
    const gvLine = `GV: ${gvName}`; // ✅ bỏ dấu • và bỏ “Lớp: ...”

    bar.innerHTML = `
      <header class="topbar">
        <div class="inner">
          <div class="brand">
            <div class="logo" title="Logo nhà trường">
              <img src="${esc_(abs_(LOGO_URL))}" alt="Logo nhà trường">
            </div>
            <div class="meta">
              <!-- ✅ #1: Xoá cụm “HEDU – ... • Cổng Giáo viên”, chỉ để tên trường -->
              <div class="title" id="brandName">${esc_(SCHOOL_NAME || "Nhà trường")}</div>
              <div class="sub" id="brandSub">${esc_(gvLine)}</div>
            </div>
          </div>

          <nav class="nav hedu-nav-one-line" aria-label="Điều hướng giáo viên">
            <a class="chip ${activeKey==="dashboard"?"active":""}" href="./teacher-dashboard.html">Bảng điều khiển</a>
            <a class="chip ${activeKey==="tasks"?"active":""}" href="./teacher-tasks.html">Ngân hàng bài</a>
            <a class="chip ${activeKey==="submissions"?"active":""}" href="./teacher-submissions.html">Bài nộp</a>
            <a class="chip ${activeKey==="grading"?"active":""}" href="./teacher-grading.html">Chấm/nhận xét</a>
            <a class="chip ${activeKey==="insights"?"active":""}" href="./teacher-insights.html">Thống kê</a>
          </nav>

          <div class="top-actions">
            <!-- ✅ #4: Góc phải chỉ hiện lớp đang chọn (không hiện tên) -->
            <span class="badge" id="teacherBadge" style="display:none"></span>
            <button class="btn ghost" id="btnLogout" type="button">Đăng xuất</button>
          </div>
        </div>
      </header>

      <!-- ✅ CSS inline để đảm bảo menu luôn 1 dòng (không wrap), tràn thì kéo ngang -->
      <style>
        .hedu-nav-one-line{
          flex-wrap:nowrap !important;
          overflow-x:auto;
          justify-content:center;
          -webkit-overflow-scrolling:touch;
          scrollbar-width:thin;
        }
        .hedu-nav-one-line .chip{ white-space:nowrap; flex:0 0 auto; }
      </style>
    `;

    // logout
    const btn = document.getElementById("btnLogout");
    if(btn){
      btn.onclick = async (e)=>{
        e.preventDefault();
        try{ if(typeof apiPost==="function") await apiPost("authLogout", {}); }catch(_){}
        clearAllSession_();
        location.href = abs_("index.html");
      };
    }
  };

})();
