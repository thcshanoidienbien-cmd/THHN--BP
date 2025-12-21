(function(){
  async function parentInit(){
    // bảo vệ role
    const s = window.requireRole ? requireRole("PARENT") : null;
    if(!s) return;

    // ví dụ: load dữ liệu tuần / tiến bộ / nhận xét...
    // gọi API bằng apiPost/api
    // const rs = await apiPost("parent.week", {...});
  }
  window.parentInit = parentInit;
})();
