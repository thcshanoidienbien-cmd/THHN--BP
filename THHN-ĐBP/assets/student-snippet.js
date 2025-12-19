// assets/student-snippet.js
// SSOT Student UI + helpers (works with core.js + api.js)

(function(){
  function $(id){ return document.getElementById(id); }

  function setBrand_(){
    const cfg = (typeof getConfig === "function") ? getConfig() : {};
    const bn = $("brandName"), bs = $("brandSub");
    if (bn) bn.textContent = cfg.APP_NAME || "HEDU";
    if (bs) bs.textContent = cfg.SCHOOL_NAME || "";
  }

  function wireLogout_(){
    const btn = $("btnLogout");
    if (!btn) return;
    btn.onclick = (e)=>{
      e.preventDefault();
      try{ if (typeof clearSession === "function") clearSession(); }catch(_){}
      location.href = "../../index.html";
    };
  }

  function setActivePill_(activeKey){
    // activeKey: "dashboard" | "do-task" | "progress"
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
    setBrand_();
    wireLogout_();
    setActivePill_(activeKey);

    // Require session
    const s = (typeof requireRole === "function") ? requireRole(["STUDENT"]) : null;
    if (!s) return;

    // Show who
    const who = $("who");
    if (who) who.textContent = `${s.studentId||"Học sinh"} • ${s.classId||""}`;

    // Expose global
    window.__STU__ = s;
  }

  window.studentInit = studentInit;
  window.studentToast = safeToast_;
})();
