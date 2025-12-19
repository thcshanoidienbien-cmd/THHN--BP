// assets/api.js — HEDU API client (NO-CORS preflight version)
async function api(action, payload = {}) {
  const cfg = (typeof getConfig === "function") ? getConfig() : (window.HEDU_CONFIG || {});
  const url = cfg.SCRIPT_URL;

  if (!url || String(url).includes("PASTE_")) {
    throw new Error("Hệ thống chưa cấu hình SCRIPT_URL (assets/config.js).");
  }

  const bodyObj = { action, ...(payload || {}) };

  // auto token
  try {
    if (typeof getSession === "function") {
      const s = getSession();
      if (s?.token && bodyObj.token === undefined) bodyObj.token = s.token;
    }
    if (typeof getToken === "function") {
      const tk = getToken();
      if (tk && bodyObj.token === undefined) bodyObj.token = tk;
    }
  } catch (_) {}

  // ✅ gửi dạng form-urlencoded để tránh preflight CORS
  const form = new URLSearchParams();
  form.set("payload", JSON.stringify(bodyObj));

  const ctrl = new AbortController();
  const tm = setTimeout(() => ctrl.abort(), 25000);

  let res, text, data;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: form.toString(),
      signal: ctrl.signal
    });
  } catch (e) {
    clearTimeout(tm);
    throw new Error("Không kết nối được máy chủ (Apps Script).");
  }
  clearTimeout(tm);

  try { text = await res.text(); }
  catch { throw new Error("Không đọc được phản hồi từ máy chủ."); }

  // parse JSON
  try { data = JSON.parse(text); }
  catch { throw new Error("Máy chủ không trả JSON hợp lệ."); }

  if (!data || data.ok !== true) throw new Error(data?.error || "API lỗi");
  return data;
}
