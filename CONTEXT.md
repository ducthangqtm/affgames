# BỐ CỤC & TÀI LIỆU DỰ ÁN THẮNG NHẢY DÂY ALL-IN-ONE (CONTEXT.MD)

Tài liệu này đóng băng toàn bộ tiến độ kỹ thuật, cấu trúc thư mục, quy chuẩn kiến trúc và luồng dữ liệu của dự án **ThangNhayDay All-in-One**.

---

## 1. TỔNG QUAN HỆ THỐNG
- **Tên dự án**: Thắng Nhảy Dây Bio-Link & Arcade Hub 4-in-1.
- **Tech Stack**:
  - Frontend: Vite Multi-page (Vanilla JavaScript ES Modules + HTML5 Canvas + Tailwind CSS / Vanilla CSS Neon Cyberpunk).
  - Serverless Backend: Cloudflare Pages Functions (`/functions/api/`).
  - Database: Cloudflare D1 SQL Database (SQLite-compatible at edge).
  - Hosting: Cloudflare Pages (Auto-deploy từ nhánh `main` của GitHub repo `ducthangqtm/affgames`).

---

## 2. BỐ CỤC 2 TAB CHÍNH (MAIN NAVIGATION)
Nằm ngay dưới phần Profile Header & nút "Mời cà phê / Donate":
1. **Tab 1: "🛍️ ĐỒ TẬP & PHỤ KIỆN" (Mặc định khi mở web)**
   - Hiển thị danh mục lọc: "Tất cả", "Dây nhảy", "Đồ tập & Giày", "Phụ kiện & Dinh dưỡng".
   - Danh sách thẻ sản phẩm Affiliate Shopee load từ `src/data/products.json`.
   - Tối ưu trải nghiệm mua sắm nhanh chóng cho người dùng khi truy cập link từ TikTok/YouTube/Facebook.
2. **Tab 2: "🎮 TRÒ CHƠI (ARCADE 4-IN-1)"**
   - Chứa Game Carousel cuộn vòng tròn 4 mini-game và Bảng Vàng Leaderboard tự động đồng bộ.
   - Mỗi khi mở tab này, hệ thống luôn tự động định vị trò **"Thắng Nhảy Dây"** (`jump`) ở tâm màn hình.

---

## 3. QUY TẮC 4 MINI-GAME & ARCHITECTURE
Tất cả 4 game kế thừa từ lớp `BaseGame` (`init`, `start`, `pause`, `destroy`) và được điều phối qua `GameController.js`:
- **Độc quyền 1 thẻ Canvas duy nhất (`#arcadeCanvas`)**: Nằm trong Arcade Cabinet Frame viền Neon đôi cao cấp, phóng to chiếm `min(92vw, 420px)` chiều rộng mobile.
- **Khóa cuộn màn hình tuyệt đối khi chơi (`Mobile Fullscreen Lock`)**: Chặn `touchmove`, `overscroll-behavior`, gesture navigation và bounce scroll.

### Chi tiết 4 trò chơi:
1. **Thắng Nhảy Dây (`jump`)**:
   - **Game mặc định** của Hub. Thuật toán nhịp điệu quay dây và nhảy né dây hành lang 1m5.
   - **Cơ chế tốc độ theo điểm số**: `ropeSpeed = baseSpeed + (score * 0.015)`, giới hạn trần an toàn `Math.min(ropeSpeed, baseSpeed * 1.85)` đảm bảo giữ được phản xạ người chơi ở mốc điểm cao (50 - 100+).
   - **Nút đổi bối cảnh**: Chuyển thành nhãn **"HÀNH LANG"** dạng pill button (Dòng trên: `HÀNH LANG` font 13px bold, Dòng dưới: `${currentIndex} / 11` font 15px cyan).
   - **Chế độ Đua Top Tuần**: Hiển thị 2 Tab `[ 🔥 Đua Top Tuần ]` và `[ 👑 Kỷ lục All-Time ]`. Banner quà tặng *"Top 1 Tuần nhận ngay 1 Dây nhảy PVC Thắng Nhảy Dây (Chốt 23:59 Chủ Nhật)"* và Badge *"🎁 Quà Đua Top Tuần: Coming Soon"*.
   - **Modal Ghi Điểm Top 10**: Thêm trường tự nguyện **"Số Zalo / SĐT nhận quà (Không bắt buộc)"** được bảo mật ẩn hoàn toàn, chỉ dùng đối soát trao giải.
2. **Cyber Snake (`snake`)**:
   - Rắn săn mồi Neon 60FPS với cơ chế wrap-around xuyên viền màn hình.
   - **Cơ chế tăng tốc**: `baseSpeed = 160ms`, cứ mỗi 5 điểm giảm 8ms (`currentSpeed = Math.max(70, 160 - Math.floor(score / 5) * 8)`), giới hạn sàn không giảm dưới 70ms để giữ trải nghiệm mượt mà trên cảm ứng mobile.
   - Điều khiển: Cụm D-Pad 4 nút to bản, dễ bấm bằng 1 ngón tay trên mobile.
3. **2048 Neon (`2048`)**:
   - Trượt số ghép khối neon logic chuẩn 2048.
   - **Không dùng nút bấm trên màn hình**: Điều khiển 100% bằng vuốt cảm ứng (touch swipe 4 hướng) mượt mà.
4. **Xếp Hình Neon (`tetris`)**:
   - Logic Tetris chuẩn 7-bag randomization và hệ thống tính điểm cấp số nhân.
   - **Tăng cấp & Tốc độ rơi**: Cứ xóa 10 hàng (lines) tăng 1 Cấp độ (Level). Tốc độ rơi: `dropInterval = Math.max(120, 800 * Math.pow(0.85, level - 1))`.
   - **Tắt hoàn toàn Ghost piece** (hình bóng đổ của khối gạch rơi).
   - Cụm điều khiển: Chỉ giữ phím Sang Trái / Sang Phải, nút Xoay ngoài cùng bên phải, và nút Thả Nhanh (Hard Drop) ở vị trí giữa.

---

## 4. CƠ CHẾ TRUE SEAMLESS INFINITE CAROUSEL
Khắc phục triệt để lỗi giật lùi bằng kỹ thuật **Clone DOM & Instant Reset Teleport**:
- **Cấu trúc DOM 6 thẻ**:
  `[Clone Tetris (0)] - [1. Nhảy Dây] - [2. Rắn] - [3. 2048] - [4. Tetris] - [Clone Nhảy Dây (5)]`
- **Khởi tạo**: Đặt `scrollLeft` trỏ thẳng vào thẻ thật `[1. Nhảy Dây]`.
- **Cơ chế Teleport**:
  - Gỡ bỏ `scroll-behavior: smooth` khỏi CSS `.carousel-container` để tránh xung đột hiệu ứng tua ngược của trình duyệt.
  - Khi vuốt qua phải đến `[Clone Nhảy Dây (5)]`: Ngay lập tức gán `scrollLeft` về vị trí `[1. Nhảy Dây]` với `behavior: 'auto'` / `'instant'` và tạm ngắt `scroll-snap-type` trong 1 frame.
  - Khi vuốt qua trái đến `[Clone Tetris (0)]`: Ngay lập tức gán `scrollLeft` về vị trí `[4. Tetris]`.
  - Hỗ trợ cuộn vòng tròn cả khi bấm Dot Indicators (4 -> Clone 5 -> 1 hoặc 1 -> Clone 0 -> 4).
  - Mắt người dùng không cảm nhận được bất kỳ độ trễ hay hiệu ứng giật lùi nào.

---

## 5. CƠ CHẾ CLOUDFLARE D1 LEADERBOARD
- **File Schema**: `schema.sql`
  - Bảng `players`: `id`, `display_name`, `normalized_name`, `pin_hash` (SHA-256), `contact_info` (Zalo/SĐT), `created_at`.
  - Bảng `game_scores`: `id`, `player_id`, `game_id`, `score`, `week_id` (định dạng ISO `YYYY-Www`), `updated_at`.
- **Giao diện Bảng Vàng**:
  - Badge nổi bật: `🎁 Quà Đua Top Tuần: Coming Soon` viền vàng kim nét đứt, nền mờ sang trọng.
  - **Tối ưu hàng hiển thị**: Xóa bỏ hoàn toàn dòng ngày tháng dưới tên người chơi; tên người chơi căn giữa theo chiều dọc (`align-items: center`) ngang hàng trực tiếp với số thứ tự/huy hiệu và điểm số.
- **Backend API**: `/functions/api/leaderboard.ts`
  - Public GET API: Trả về Top 10 Bảng Vàng. **TUYỆT ĐỐI KHÔNG trả về `pin_hash` và `contact_info`**.
  - Logic tính điểm: Điểm All-Time tính theo max điểm mọi thời đại của người chơi. Điểm Tuần lọc theo `week_id` hiện tại theo giờ Việt Nam (UTC+7).
  - Phân hệ Admin GET (`type=admin_weekly`): Cung cấp thông tin đầy đủ gồm `contact_info` và `pin_hash` để phục vụ trao quà.

---

## 6. TRANG QUẢN TRỊ (/admin.html & src/admin.js)
Gồm 2 phân hệ độc lập:
1. **Quản Trị Sản Phẩm Affiliate**:
   - Form 4 trường (Tên, Danh mục, Link Affiliate Shopee, Link ảnh xem trước tức thì).
   - Danh sách sản phẩm trong `src/data/products.json`.
   - Nút Commit đồng bộ trực tiếp lên GitHub qua GitHub REST API (mã hóa Base64) để Cloudflare Pages tự động build lại trang.
2. **Trao Giải Đua Top Tuần (Thắng Nhảy Dây)**:
   - Dropdown chọn tuần (`week_id`) để tra cứu lịch sử tuần này hoặc tuần trước.
   - Hero Card Quán quân Top 1: Tên, điểm số, số Zalo/SĐT kèm nút Sao chép và nút "Nhắn Zalo" (`https://zalo.me/...`).
   - **Công cụ Đối Soát Mã PIN Bí Mật**: Nhập mã PIN 4-6 số người chơi gửi, hệ thống tự động băm SHA-256 client-side để so khớp với DB. Thông báo Xanh: *"Khớp PIN - Chính chủ"* hoặc Đỏ: *"Sai PIN"*.
   - Bảng Top 10 tuần chi tiết với nút "Đối soát PIN" cho từng người chơi.

---

## 7. MODAL DONATE QR TỐI ƯU
- **Bỏ hoàn toàn số tài khoản / ngân hàng dạng văn bản** để tránh rối mắt và nhầm lẫn.
- **Tâm điểm**: Mã VietQR MoMo Đa Năng (`public/assets/qr-donate.jpg`) bo góc tròn, viền sáng rõ nét, hiển thị chủ TK: `NGUYỄN ĐỨC THẮNG` kèm huy hiệu `✓ MoMo VietQR Đa Năng`.
- **Nút duy nhất (Full-width Primary Button)**:
  - Nút `[ 📥 Lưu Mã QR Vào Máy ]` (`.btn-save-qr`): chiếm 100% chiều ngang, padding `12px 0`, border-radius `12px`, font 15px bold, gradient hồng tím MoMo `#a50064 -> #d91b7a` với hiệu ứng shadow & active scale.
  - **Logic hành động**: Tự động tải file ảnh mã QR `QR-ThangNhayDay.jpg` về thư viện ảnh thiết bị + kích hoạt Toast thông báo: *"Đã lưu mã QR! Bạn có thể quét qua MoMo hoặc App Ngân Hàng ❤️"*.
  - **Đã loại bỏ hoàn toàn** nút "Mở App MoMo" và lệnh gọi liên kết `momo://`.
- **Dòng hướng dẫn phụ bên dưới nút**:
  - *"Lưu ảnh rồi mở MoMo hoặc App Ngân Hàng bất kỳ quét ảnh để ủng hộ ☕"* (font-size 12px, color `#94a3b8`, text-align center).

---

## 8. QUY CHUẨN HEADER AVATAR & FOOTER
- **Avatar Header**:
  - Kích thước khung chứa phóng to: `width: 110px !important; height: 110px !important;`.
  - Ảnh đại diện tròn: `scale(1.15)`, `object-position: center 20%` giúp khuôn mặt sáng rõ, nổi bật.
  - Viền phát sáng: `border: 3px solid rgba(56, 189, 248, 0.85); box-shadow: 0 0 20px rgba(56, 189, 248, 0.4);`.
  - Huy hiệu tích xanh (Verified badge): `24px x 24px`, căn chuẩn góc 4h30.
- **Footer Chân Trang**:
  - Nút code `>_ thangit.com` (`.footer-link`) và tác giả `Nguyễn Đức Thắng (Thắng iT) ↗` (`.author-link`) liên kết trực tiếp sang `https://thangit.com` (`target="_blank"`, `rel="noopener noreferrer"`).
