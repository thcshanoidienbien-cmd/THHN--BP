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

    // window.__STU__ đã set ở trên
  }

  window.studentInit = studentInit;
  window.studentToast = safeToast_;
})();
