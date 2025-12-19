// assets/api.js — HEDU API client (SSOT, stable)

async function api(action, payload = {}) {
  const cfg = (typeof getConfig === "function") ? getConfig() : (window.HEDU_CONFIG || {});
  const url = cfg.SCRIPT_URL;

  if (!url || String(url).includes("PASTE_")) {
    throw new Error("Hệ thống chưa cấu hình SCRIPT_URL (assets/config.js).");
  }

  const body = { action, ...(payload || {}) };

  // ✅ SSOT token: token == sessionId
  // ưu tiên token truyền vào, nếu không có thì tự gắn từ session
  try {
    if (body.token === undefined || body.token === null || body.token === "") {
      if (typeof getSession === "function") {
        const s = getSession();
        const tk = s?.token || s?.sessionId || "";
        if (tk) body.token = tk;
      }
      if ((body.token === undefined || body.token === null || body.token === "") && typeof getToken === "function") {
        const tk2 = getToken();
        if (tk2) body.token = tk2;
      }
    }
  } catch (_) {}

  const ctrl = new AbortController();
  const tm = setTimeout(() => ctrl.abort(), 25000);

  let res, text, data;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
  } catch (e) {
    clearTimeout(tm);
    throw new Error("Không kết nối được máy chủ (Apps Script).");
  }
  clearTimeout(tm);

  try {
    text = await res.text();
  } catch (_) {
    throw new Error("Không đọc được phản hồi từ máy chủ.");
  }

  if (!res.ok) {
    try {
      const j = JSON.parse(text);
      throw new Error(j?.error || `HTTP ${res.status}`);
    } catch (_) {
      throw new Error(`Máy chủ lỗi HTTP ${res.status}. (Có thể deploy sai quyền hoặc sai URL Web App)`);
    }
  }

  try {
    data = JSON.parse(text);
  } catch (e) {
    // Apps Script đôi khi trả HTML (đăng nhập, lỗi deploy...)
    throw new Error("Máy chủ không trả JSON hợp lệ. (Có thể URL sai hoặc Apps Script trả trang HTML)");
  }

  if (!data || data.ok !== true) {
    throw new Error(data?.error || "API lỗi");
  }

  return data;
}
