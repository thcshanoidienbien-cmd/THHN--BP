(function(){
  window.getParentCtx = function(){
    const s = requireRole(["PARENT"]);
    const cfg = getConfig();
    return {
      token: s.token || "",
      schoolYear: s.schoolYear || cfg.DEFAULT_SCHOOL_YEAR || "",
      classId: s.classId || cfg.DEFAULT_CLASS_ID || "",
      studentId: s.studentId || ""
    };
  };
})();
