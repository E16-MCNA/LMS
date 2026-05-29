# Hệ Thống E16 LMS (Học Viện & Quản Lý Đào Tạo)

Chào mừng bạn đến với **E16 LMS** - Nền tảng Quản lý Học tập (LMS) và Hệ thống Thông tin Học sinh (SIS) cao cấp dành cho Học viện E16. Hệ thống được xây dựng trên kiến trúc hiện đại, giao diện trực quan cao cấp, hỗ trợ đầy đủ các phân hệ vai trò trong môi trường giáo dục chuyên nghiệp.

---

## 🌟 Tính Năng Cao Cấp Mới Nổi Bật

### ⚡ Bộ Lọc Sắp Xếp Cột Trực Quan (Click Column Header Sorting)
Hệ thống vừa được nâng cấp toàn diện với tính năng **Sắp xếp theo Tiêu đề Cột** trên toàn bộ **17 bảng dữ liệu** ở mọi phân hệ:
* **Chỉ báo trực quan**: Trạng thái sắp xếp hiển thị rõ ràng thông qua biểu tượng chiều hướng tinh gọn (`▲` tăng dần, `▼` giảm dần, `↕` có thể sắp xếp).
* **Hover Micro-interaction**: Tiêu đề cột hỗ trợ sắp xếp phản hồi mượt mà khi di chuột qua (`hover:text-white transition`) theo phong cách glassmorphism hiện đại.
* **Xử lý thông minh**: Hỗ trợ chuẩn hóa tiếng Việt có dấu (`localeCompare("vi")`), số học, thời gian thực và tự động xử lý an toàn dữ liệu lồng nhau phức tạp (nested object paths) giúp loại bỏ hoàn toàn nguy cơ crash giao diện.

---

## 👥 Các Phân Hệ & Vai Trò Trong Hệ Thống

Hệ thống được thiết kế phân quyền chặt chẽ với các giao diện tối ưu riêng biệt cho từng đối tượng:

1. **Quản Trị Viên (Admin / Super Admin)**: Phân quyền tài khoản người dùng, khóa/mở khóa tài khoản, giám sát hoạt động hệ thống toàn diện.
2. **Quản Lý Học Vụ (Academic Manager / Admin)**: Quản lý năm học, học kỳ, khoa chuyên môn, ngành học, khung chương trình đào tạo và sổ học bạ sinh viên toàn trường.
3. **Giảng Viên (Teacher)**: Biên soạn giáo trình (bài giảng, quiz trắc nghiệm, bài tập tự luận), điểm danh lớp học phần và chấm điểm/nhận xét bài nộp của học viên.
4. **Sinh Viên (Student)**: Xem thời khóa biểu lớp học, tham gia bài giảng, nộp bài tập tự luận, làm bài kiểm tra trắc nghiệm, theo dõi lịch sử nộp học phí và bảng điểm cá nhân (GPA 4.0).
5. **Phụ Huynh (Parent)**: Liên kết tài khoản giám sát tiến độ học tập, chuyên cần (điểm danh), các cảnh báo học thuật và lịch sử đóng học phí của con em.
6. **Kế Toán (Finance)**: Đối soát phê duyệt giao dịch đóng học phí, theo dõi công nợ, quản lý sổ nợ học phí và tính toán/thanh toán lương & hoa hồng cho giảng viên.
7. **Lễ Tân (Receptionist)**: Tìm kiếm tra cứu nhanh hồ sơ sinh viên, hỗ trợ đặt lại mật khẩu khẩn cấp và đăng ký nhập học nhanh cho sinh viên mới.

---

## 🛠️ Thiết Lập Phát Triển (Development Setup)

### Yêu Cầu Hệ Thống
* Node.js phiên bản mới nhất (khuyến nghị v18 trở lên).
* Trình quản lý gói `npm`.

### Hướng Dẫn Cài Đặt
1. **Cài đặt các thư viện phụ thuộc**:
   ```bash
   npm install
   ```
2. **Thiết lập biến môi trường**: Tạo file `.env` từ `.env.example` và cấu hình các giá trị cần thiết.
3. **Chạy máy chủ phát triển cục bộ (Development Server)**:
   ```bash
   npm run dev
   ```
   Ứng dụng sẽ hoạt động tại địa chỉ: `http://localhost:3000`

---

## 🧪 Kiểm Thử & Xác Thực (Testing & Verification)

Để đảm bảo hệ thống luôn hoạt động ổn định và không phát sinh lỗi biên dịch, vui lòng sử dụng các bộ công cụ kiểm tra sau:

* **Kiểm tra kiểu dữ liệu & Cú pháp tĩnh (Type-Checking)**:
  ```bash
  npm run lint
  ```
  *(Sử dụng lệnh `npm.cmd run lint` nếu bạn dùng PowerShell trên Windows để tránh Execution Policy).*

* **Kiểm thử Luồng Học Thuật Đóng Gói (E2E Integration Academic Flow)**:
  1. Đảm bảo máy chủ đang hoạt động.
  2. Khởi chạy bộ kiểm thử E2E:
     ```bash
     # Trên Linux / macOS hoặc Git Bash
     E2E_BASE_URL=http://localhost:3000 npm run test:e2e

     # Trên Windows PowerShell
     $env:E2E_BASE_URL="http://localhost:3000"; npm.cmd run test:e2e
     ```

---

## 🚀 Triển Khai Sản Phẩm (Production Deployment)

Hệ thống được khuyến nghị triển khai trên các dịch vụ đám mây sử dụng Render thông qua cấu hình `render.yaml`.

### 1. Các Biến Môi Trường Bắt Buộc (Required Env Variables)
```env
NODE_ENV=production
DATABASE_URL=postgresql://...
JWT_SECRET=thay-doi-sang-mot-chuoi-khoa-ngau-nhien-bao-mat
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### 2. Các Bước Triển Khai Thực Tế (Deploy Steps)
```bash
npm ci
npm run db:migrate
npm run db:drift
npm run build
npm start
```

### 3. Kiểm Thử Khói Sau Triển Khai (Post-Deploy Smoke Test)
Để kiểm tra tính khả dụng của trang web sau khi deploy lên domain production:
```bash
DEPLOY_URL=https://domain-cua-ban.example.com npm run smoke:deploy
```

---

## 🛡️ Quy Trình Khôi Phục Lỗi (Rollback Procedure)
Trong trường hợp triển khai phiên bản mới gặp sự cố nghiêm trọng trên production, quy trình khôi phục nhanh (rollback) được tài liệu hóa chi tiết tại file [rollback-checklist.md](file:///d:/LMS/docs/rollback-checklist.md). Vui lòng tuân thủ nghiêm ngặt các bước để tránh làm gián đoạn dịch vụ của học viện.
