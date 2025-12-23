// assets/teacher-snippet.js
// SSOT Teacher helpers (works with core.js + api.js)
(function(){
  function $(id){ return document.getElementById(id); }

  function setBrand_(t){
    const cfg = (typeof getConfig==="function") ? (getConfig()||{}) : {};
    const bn = $("brandName"), bs = $("brandSub");
    if(bn) bn.textContent = cfg.SCHOOL_NAME || cfg.APP_NAME || "HEDU";
    if(bs) bs.textContent = (t && (t.displayName||t.name||t.username)) ? ("Giáo viên: " + (t.displayName||t.name||t.username)) : "Giáo viên";

    // optional logo
    const brand = document.querySelector(".brand");
    if(brand && cfg.LOGO_URL && !brand.querySelector("img")){
      const img = document.createElement("img");
      img.className = "logoImg";
      img.alt = "Logo";
      img.src = cfg.LOGO_URL.startsWith("http") ? cfg.LOGO_URL : ("../../" + String(cfg.LOGO_URL).replace(/^\/+/,""));
      brand.prepend(img);
    }
  }

  function wireLogout_(){
    const btn = $("btnLogout");
    if(!btn) return;
    btn.onclick = (e)=>{
      e.preventDefault();
      try{ if(typeof clearSession==="function") clearSession(); }catch(_){ }
      location.href = "../../index.html";
    };
  }

  function setActivePill_(activeKey){
    // teacher pages: tasks/submissions/grading/insights/dashboard
    const map = {
      "dashboard": "teacher-dashboard.html",
      "tasks": "teacher-tasks.html",
      "submissions": "teacher-submissions.html",
      "grading": "teacher-grading.html",
      "insights": "teacher-insights.html",
    };
    const href = map[activeKey] || "";
    if(!href) return;
    document.querySelectorAll(".pills a.pill").forEach(a=>{
      const h = (a.getAttribute("href")||"").trim();
      a.classList.toggle("active", h===href);
    });
  }

  async function teacherInit(activeKey){
    wireLogout_();
    setActivePill_(activeKey);
    const s = (typeof requireRole==="function") ? requireRole(["TEACHER"]) : null;
    if(!s) return;
    window.__TEA__ = s;
    setBrand_(s);

    // Some pages have who line
    const who = $("who");
    if(who) who.textContent = `${s.displayName||s.username||"Giáo viên"} • ${s.classId||""}`;
  }

  window.teacherInit = teacherInit;
})();
