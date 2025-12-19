// assets/api.js — HEDU API client (CORS-safe, SSOT)
// ✅ Use application/x-www-form-urlencoded to avoid CORS preflight on Apps Script WebApp

async function api(action, payload = {}) {
  const cfg = (typeof getConfig === "function") ? getConfig() : (window.HEDU_CONFIG || {});
  const url = cfg.SCRIPT_URL;

  if (!url || String(url).includes("PASTE_")) {
    throw new Error("Hệ thống chưa cấu hình SCRIPT_URL (assets/config.js).");
  }

  // body chuẩn
  const body = { action, ...(payload || {}) };

  // ✅ tự gắn token nếu chưa có
  try {
    if (typeof getSession === "function") {
      const s = getSession();
      if (s?.token && body.token === undefined) body.token = s.token;
    }
    if (typeof getToken === "function") {
      const tk = getToken();
      if (tk && body.token === undefined) body.token = tk;
    }
  } catch (_) {}

  // ✅ Encode form (avoid preflight)
  const form = new URLSearchParams();
  Object.keys(body).forEach((k) => {
    const v = body[k];
    form.append(k, (typeof v === "object") ? JSON.stringify(v) : String(v ?? ""));
  });

  const ctrl = new AbortController();
  const tm = setTimeout(() => ctrl.abort(), 25000);

  let res, text, data;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: form.toString(),
      signal: ctrl.signal,
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
    // cố parse json lỗi
    try {
      const j = JSON.parse(text);
      throw new Error(j?.error || `HTTP ${res.status}`);
    } catch (_) {
      throw new Error(`Máy chủ lỗi HTTP ${res.status}. (Deploy sai quyền hoặc URL Web App sai)`);
    }
  }

  // parse JSON
  try {
    data = JSON.parse(text);
  } catch (_) {
    throw new Error("Máy chủ không trả JSON hợp lệ. (Có thể Apps Script trả HTML)");
  }

  if (!data || data.ok !== true) {
    throw new Error(data?.error || "API lỗi");
  }
  return data;
}
