# TECHNICAL SPECIFICATION: THANGNHAYDAY HUB (ALL-IN-ONE)

Web App kết hợp Bio-Link Affiliate và Arcade Hub 4-in-1, chạy trên Cloudflare Pages + Cloudflare D1.

## 1. THAM KHẢO CODE GỐC (`oldgames/`)
- Tài nguyên: `oldgames/assets/`
- Code logic gốc: `audio.js`, `game-rope.js`, `game-snake.js`, `game-2048.js`, `game-tetris.js`.
- Yêu cầu: Giữ nguyên 100% physics, hitbox, ma trận điểm.
- Refactor: Đóng gói mỗi game thành Class/Module độc lập có lifecycle chuẩn:
  - `init(canvas)`
  - `start()`
  - `pause()`
  - `destroy()` (bắt buộc gỡ sạch event listener `keydown`, `touchstart`, hủy `requestAnimationFrame`).
  - Callback: `onGameOver(score)`.
- Điều phối: 1 thẻ `<canvas>` duy nhất, Game Controller mount/unmount game khi chuyển tab.

## 2. CAROUSEL GAME & ĐỒNG BỘ BXH
- 4 Game: `jump` (Thắng Nhảy Dây), `snake` (Cyber Snake), `2048` (2048 Neon), `tetris` (Xếp Hình Neon).
- Carousel cuộn ngang dạng CSS Scroll Snap.
- Dùng `IntersectionObserver` nhận diện game đang nằm chính giữa, tự động nạp Top 10 Bảng Vàng của game đó từ D1 (kèm cache cục bộ).

## 3. BẢNG VÀNG & XÁC THỰC TOP 10 (Cloudflare D1)
- Schema:
  - `players (id, display_name, normalized_name UNIQUE, pin_hash, created_at)`
  - `game_scores (id, player_id, game_id, score, updated_at)`
- Game Over:
  - Điểm không vào Top 10: Kết thúc thường, không hiện pop-up nhập tên.
  - Điểm lọt Top 10:
    - Nếu máy đã lưu profile trong `localStorage`: Tự gửi điểm ngầm.
    - Nếu máy mới: Hiện pop-up nhập Tên + Mã PIN (4-6 số).
- Quy tắc:
  - `normalized_name`: Không phân biệt hoa/thường (`name.trim().toLowerCase()`).
  - Tên mới: Lưu vào `players`.
  - Tên cũ: Khớp đúng PIN (SHA-256) mới được ghi đè điểm; sai PIN trả lỗi 403; quên PIN phải chọn tên khác.
- Tối ưu: Bảng `players` lưu vĩnh viễn; bảng `game_scores` chỉ lưu đúng Top 10 điểm cao nhất mỗi game (tự xóa hạng 11 trở đi).

## 4. BIO-LINK & TRANG QUẢN TRỊ (`/admin`)
- Sản phẩm lưu tĩnh tại `src/data/products.json`.
- Trang `/admin` đăng nhập bằng GitHub Personal Access Token (PAT), lưu tạm `sessionStorage`.
- Form nhập gồm 4 trường:
  1. Tên sản phẩm
  2. Tab danh mục
  3. Link Affiliate Shopee
  4. Link ảnh sản phẩm (có Image Preview tức thì)
- Nút "Cập nhật lên Git": Dùng GitHub REST API (`PUT /contents/src/data/products.json`) ghi đè base64 JSON, kích hoạt Cloudflare Pages CI/CD deploy lại web.
## 5. PROFILE HEADER & DONATE MODAL
- Sử dụng ảnh `avatar.jpg` làm avatar chính (bo tròn, viền hiệu ứng neon nhẹ).
- Tên hiển thị: "Thắng Nhảy Dây" (có icon tích xanh xác minh).
- Username: @thangnhayday
- Bio: "Chia sẻ hành trình 100 ngày nhảy dây giảm mỡ bụng, cải thiện vóc dáng & thể lực mỗi ngày. Khám phá kỹ thuật nhảy dây và đồ tập tại nhà chất lượng! 💪🔥"
- Dãy nút icon mạng xã hội: Facebook, YouTube, TikTok, Telegram/Zalo.
- Nút "Mời cà phê / Donate" (icon tách cà phê): Khi bấm vào sẽ mở một Modal pop-up hiển thị ảnh mã `qr-donate.jpg` để người theo dõi quét mã ủng hộ.