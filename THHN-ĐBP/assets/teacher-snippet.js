// assets/parent-snippet.js
// SSOT Parent UI + helpers (works with core.js + api.js)

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
    // activeKey: "week" | "progress" | "notes"
    const map = {
      "week": "week.html",
      "progress": "progress.html",
      "notes": "notes.html",
    };
    const href = map[activeKey] || "week.html";
    document.querySelectorAll(".pills a.pill").forEach(a=>{
      const h = (a.getAttribute("href") || "").trim();
      a.classList.toggle("active", h === href);
    });
  }

  async function safeToast_(msg){
    try{ if (typeof toast === "function") toast(msg); }catch(_){}
  }

  async function parentInit(activeKey){
    setBrand_();
    wireLogout_();
    setActivePill_(activeKey);

    const s = (typeof requireRole === "function") ? requireRole(["PARENT"]) : null;
    if (!s) return;

    const who = $("who");
    if (who) who.textContent = `PH của ${s.studentId||"—"} • ${s.classId||""}`;

    window.__PAR__ = s;
  }

  window.parentInit = parentInit;
  window.parentToast = safeToast_;
})();
