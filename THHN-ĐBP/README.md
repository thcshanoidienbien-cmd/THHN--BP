# HEDU – Commercial Optimized UI (Light)

## Mục tiêu
- Giao diện nhẹ, dễ dùng cho người không rành công nghệ
- Đăng nhập theo vai trò:
  - Giáo viên: tài khoản + mật khẩu
  - Học sinh: chọn năm học + lớp + mã HS
  - Phụ huynh: chọn năm học + lớp + mã HS (không đăng ký)
  - BGH: mã quản trị (không tạo tài khoản)
- Quản lý theo NĂM HỌC (quan trọng cho lên lớp/ở lại lớp)

## Thiết lập
1) Mở `assets/config.js`
2) Dán `SCRIPT_URL` = Web App `/exec` của Apps Script
3) (Tuỳ chọn) đổi `ADMIN_SETUP_CODE`
4) Mở `index.html` để chạy

## API Actions cần có (backend Apps Script)
- listYearsPublic
- listClassesPublic
- authTeacherLogin
- authTeacherRegister
- authStudentLogin
- authParentLogin
- authAdminLogin
- teacherDashboard
- listClassesForTeacher
- teacherPublishTask
- teacherListFilters
- teacherListSubmissions
- teacherGradebook
- studentDashboard
- studentListTasks
- studentSubmit
- studentGetFeedback
- studentProgress
- parentWeekReport
- parentConfirmRead
- parentProgress
- parentNotes
- adminDashboard
- initSchema
- adminSeedTrainingData
- adminListClasses
- adminCreateClass
