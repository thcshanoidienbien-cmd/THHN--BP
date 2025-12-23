// assets/config.js
// ===============================
// HEDU – Global App Configuration (SSOT)
// ===============================
// ⚠️ Chỉ DEV / ADMIN chỉnh file này

(function () {
  "use strict";

  const CFG = {
    // Brand
    APP_NAME: "HEDU – Sổ liên lạc & Học tập",
    SCHOOL_NAME: "Trường Tiểu học Hà Nội – Điện Biên Phủ",
    LOGO_URL: "assets/img/logo-school.jpg", // ✅ đặt 1 nơi cho toàn hệ thống

    // Web App Apps Script (exec)
    SCRIPT_URL: "https://script.google.com/macros/s/AKfycbymZ9g6DHnjeq2tA_H8T8tMVI5NWC3D3_odNf9TM3Ks8-2NvVVg44cOlu3VxqzdllyhTg/exec",

    // ===== SYSTEM MODE =====
    MODE: "production", // development | production
    LOCK_SCOPE: "GRADE_SUBJECT", // GRADE | SUBJECT | GRADE_SUBJECT

    // ===== FEATURE FLAGS =====
    ALLOW_PARENT_HISTORY: true,
    ENABLE_AI_SUGGESTION: true,
  };

  // Expose global (SSOT)
  window.HEDU_CONFIG = CFG;

  // Aliases (để code cũ vẫn chạy)
  window.APP_NAME = CFG.APP_NAME;
  window.SCHOOL_NAME = CFG.SCHOOL_NAME;
  window.SCRIPT_URL = CFG.SCRIPT_URL;
  window.LOCK_SCOPE = CFG.LOCK_SCOPE;
  window.APP_MODE = CFG.MODE;

  // ✅ Single source of truth
  window.getConfig = function () {
    return CFG;
  };
})();
