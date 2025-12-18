// assets/config.js
// ===============================
// HEDU – Global App Configuration
// ===============================
// ⚠️ Chỉ DEV / ADMIN chỉnh file này

(function () {
  const CFG = {
    APP_NAME: "HEDU – Sổ liên lạc & Học tập",
    SCHOOL_NAME: "Trường Tiểu học Hà Nội – Điện Biên Phủ",

    // Web App Apps Script (exec)
    SCRIPT_URL: "https://script.google.com/macros/s/AKfycbygWQIyQ2cBSTKJ44R1M8zOVz-Tf8ROmq4n-C9TapuXTt_dsTB95SL1k0Y4oRGIEvvc3A/exec",

    // ===== SYSTEM MODE =====
    MODE: "production", // development | production
    LOCK_SCOPE: "GRADE_SUBJECT", // GRADE | SUBJECT | GRADE_SUBJECT

    // ===== DEFAULT CONTEXT =====
    DEFAULT_SCHOOL_YEAR: "2025-2026",
    DEFAULT_GRADE: "5",
    DEFAULT_CLASS_ID: "5A1",
    DEFAULT_SUBJECT: "Tiếng Việt",
    DEFAULT_BOOK: "Kết nối tri thức",

    // ===== FEATURE FLAGS =====
    ALLOW_PARENT_HISTORY: true,
    ENABLE_AI_SUGGESTION: true,

    // ⚠️ CHỈ DÙNG DEMO – KHÔNG DÙNG KHI TRIỂN KHAI THẬT
    ADMIN_SETUP_CODE: "BGH2026@"
  };

  // Expose global
  window.HEDU_CONFIG = CFG;

  // ===== Alias cho toàn hệ thống =====
  window.APP_NAME = CFG.APP_NAME;
  window.SCHOOL_NAME = CFG.SCHOOL_NAME;
  window.SCRIPT_URL = CFG.SCRIPT_URL;
  window.LOCK_SCOPE = CFG.LOCK_SCOPE;
  window.APP_MODE = CFG.MODE;

  window.getConfig = function () {
    return CFG;
  };
})();
