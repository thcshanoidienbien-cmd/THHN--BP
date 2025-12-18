// assets/api.js — HEDU API client (PRO, stable)

async function api(action, payload = {}) {
  const cfg = (typeof getConfig === "function") ? getConfig() : (window.HEDU_CONFIG || {});
  const url = cfg.SCRIPT_URL;

  if (!url || String(url).includes("PASTE_")) {
    throw new Error("Hệ thống chưa cấu hình SCRIPT_URL (assets/config.js).");
  }

  // body chuẩn
  const body = { action, ...(payload || {}) };

  // ✅ tự gắn token nếu chưa có (token = sessionId)
  try {
    if (typeof getSession === "function") {
      const s = getSession();
      if (s?.token && body.token === undefined) body.token = s.token;
    }
    // fallback: nếu core có getToken()
    if (typeof getToken === "function") {
      const tk = getToken();
      if (tk && body.token === undefined) body.token = tk;
    }
  } catch (_) {}

  const ctrl = new AbortController();
  const tm = setTimeout(() => ctrl.abort(), 25000);

  let res, text, data;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },  // ✅ quan trọng
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
  } catch (e) {
    clearTimeout(tm);
    throw new Error("Không kết nối được máy chủ (Apps Script).");
  }
  clearTimeout(tm);

  // ✅ đọc text trước để xử lý trường hợp server trả HTML lỗi
  try {
    text = await res.text();
  } catch (_) {
    throw new Error("Không đọc được phản hồi từ máy chủ.");
  }

  // ✅ nếu HTTP lỗi -> báo rõ
  if (!res.ok) {
    // cố gắng parse JSON để lấy error (nếu có)
    try {
      const j = JSON.parse(text);
      throw new Error(j?.error || `HTTP ${res.status}`);
    } catch (_) {
      throw new Error(`Máy chủ lỗi HTTP ${res.status}. (Có thể deploy sai quyền hoặc sai URL Web App)`);
    }
  }

  // ✅ parse JSON
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error("Máy chủ không trả JSON hợp lệ. (Có thể URL sai hoặc Apps Script trả trang HTML)");
  }

  if (!data || data.ok !== true) {
    throw new Error(data?.error || "API lỗi");
  }
  return data;
}
