# 🌌 WaveForm Edit Studio - Hướng dẫn Cài đặt & Sử dụng Toàn diện

Chào mừng bạn đến với **WaveForm Edit Studio**, phần mềm lập trình biên tập video cao cấp, thiết kế mượt mà chuyên biệt cho việc tạo sóng âm thanh nhảy động (Waveform audio visualizer), trích xuất phụ đề tự động bằng trí tuệ nhân tạo (Whisper AI) và tích hợp các lớp ảnh phủ, khung camera máy quay độc quyền.

Giao diện của phần mềm được thiết kế theo phong cách **Glassmorphic** hiện đại, kết hợp dải màu Tím-Indigo Neon thời thượng và lưới mesh Mesh không gian kỹ thuật số có chiều sâu vượt trội.

---

## 🛠️ Yêu cầu Hệ thống & Tiền đề Cài đặt

Trước khi khởi chạy ứng dụng, hãy đảm bảo máy tính của bạn đã được cài đặt đầy đủ các công cụ cốt lõi sau:

1.  **Node.js (v18.0 trở lên)** & Trình quản lý gói `npm`.
2.  **Python (v3.10 trở lên)** (Đã được tích hợp vào biến môi trường PATH để gọi từ lệnh `python`).
3.  **FFmpeg (Rất quan trọng):** Bộ công cụ xử lý video dòng lệnh. Bạn bắt buộc phải cài đặt FFmpeg và cấu hình thư mục `bin` vào **System Environment Variables (PATH)** trên Windows để ứng dụng có thể ghép nối và mã hóa video.
    *   *Cách kiểm tra:* Mở Terminal/CMD gõ `ffmpeg -version` và `ffprobe -version` nếu hiển thị thông số phiên bản là đã thành công.

---

## 🚀 Hướng dẫn các Bước Cài đặt

### Bước 1: Tải mã nguồn và cài đặt Thư viện Frontend (Node.js)
Mở cửa sổ Terminal (PowerShell hoặc CMD) tại thư mục dự án `AI_Story_App` và chạy lệnh sau để tải các thư viện Next.js/React:
```bash
npm install
```

### Bước 2: Cài đặt Thư viện Backend (Python Worker)
Ứng dụng sử dụng một Python Worker chạy ngầm để phân tích tần số sóng âm, bo viền ảnh bằng Pillow và ghép nối video. Bạn hãy cài đặt các thư viện Python bằng lệnh:
```bash
pip install -r worker-python/requirements.txt
```
> [!NOTE]
> Danh sách thư viện chính bao gồm: `openai-whisper` (dành cho phụ đề AI), `torch` & `torchaudio` (để Whisper chạy tăng tốc phần cứng), `pillow` (xử lý hình ảnh), và `pydantic` (để kiểm định dữ liệu).

---

## 💻 Cách Khởi chạy Ứng dụng

Khởi chạy máy chủ Next.js Dev Server cục bộ bằng lệnh:
```bash
npm run dev
```
Sau đó, mở trình duyệt web và truy cập đường dẫn: **`http://localhost:3000`**. Giao diện WaveForm Edit Studio chuẩn Studio chuyên nghiệp sẽ xuất hiện!

---

## 🎛️ Hướng dẫn Chi tiết Sử dụng các Tab Chức năng

Giao diện làm việc được chia làm hai phần chính: Cột bên trái là **Trình phát mô phỏng Live (Clean Canvas)** và bảng điều khiển nút chạy/nhật ký; Cột bên phải là dải các **Tab Cấu hình** được sắp xếp cực kỳ khoa học từ trái qua phải theo đúng luồng biên tập:

### 1. 📂 Tab: Tập tin nguồn (Source Files)
Nơi tiếp nhận toàn bộ nguyên liệu đầu vào cho video của bạn:
*   **Video nền chính:** Duyệt chọn tệp video nền mong muốn (ví dụ: phong cảnh, thành phố, vũ trụ).
*   **Giọng đọc / Nhạc nền:** Tệp âm thanh MP3/WAV dùng để phân tích biên độ sóng âm và làm dải tiếng cho video.
*   **Tệp phụ đề (.srt):** Bạn có thể tải lên tệp phụ đề có sẵn, hoặc để trống và sử dụng tính năng trích xuất AI Whisper ở Tab Phụ đề.
*   **Danh sách ảnh phủ:** Chọn các hình ảnh muốn chèn đè lên trên video (ví dụ: ảnh chân dung nhân vật).

### 2. 🌌 Tab: Nền (Background)
*   **Lớp phủ màu:** Lựa chọn màu sắc phủ (Color) và điều chỉnh Độ mờ nền (Opacity) để tạo một lớp lót tối giúp dải sóng âm nổi bật.
*   **Hiệu ứng mờ nhòe (Blur):** Tăng cường độ nhòe mịn từ `0%` đến `100%`. Hệ thống sử dụng bộ lọc Gaussian Boxblur đa tầng `luma_power=3` trong FFmpeg giúp nền video mờ sâu như bơ, chuyên nghiệp như phim điện ảnh.

### 3. 🖼️ Tab: Ảnh phủ (Image Overlays)
Tùy biến các bức ảnh chèn đè lên video nền:
*   **Chế độ ảnh phủ (overlayMode):** 
    *   *Xoay vòng (Cycle):* Hiện tuần tự từng ảnh theo chu kỳ số giây thiết lập.
    *   *Nhiều ảnh (Custom):* Cho phép hiển thị đồng thời nhiều tấm ảnh ở các vị trí khác nhau trên màn hình.
*   **Hình dạng mặt nạ (Mask Shape):** Bo viền ảnh thành hình **Tròn (Circle)**, **Lục giác (Hexagon)**, **Hình vuông (Square)** hoặc **Chữ nhật (Rectangle)**.
*   **Hiệu ứng nhún nhảy theo nhạc (Wave Bounce):** Khi kích hoạt, ảnh phủ sẽ tự động co giãn to/nhỏ nhịp nhàng khớp chuẩn xác với nhịp điệu bass của sóng âm.
*   **Viền mịn (Feather):** Thiết lập độ nhòe mềm viền cắt ảnh (mặc định = 0px để giữ cạnh cắt sắc sảo).

### 📊 4. Tab: Sóng âm (Waveform)
Hệ thống vẽ sóng âm kỹ thuật số chuyên sâu:
*   **Kiểu dáng đường chạy (Path):** Hỗ trợ 7 kiểu dáng sóng âm rực rỡ bao gồm: **Sóng thẳng (Linear)**, **Vòng tròn (Circle)**, **Sóng dọc (Vertical)**, **Hình hộp (Rectangle)**, **Tam giác (Triangle)**, **Lục giác (Hexagon)** và **Sóng lượn sóng tự do (Custom)**.
*   **Màu sắc & Dải chuyển màu (Gradient):** Bật dải màu chuyển tiếp gradient nối giữa Màu bắt đầu (Gradient Start) và Màu kết thúc (Gradient End) để dải sóng chuyển màu tuyệt đẹp.
*   **Hiệu ứng đối xứng (Mirror):** Nhân đôi dải sóng đối xứng gương qua trục gốc.
*   **Z-index (Z-Order):** Quyết định đưa dải Sóng âm đè lên trước ảnh phủ (`waveform_on_top`) hoặc ẩn xuống phía sau ảnh phủ (`image_on_top`).

### 💬 5. Tab: Phụ đề (Subtitles)
*   **✨ Tự động tạo phụ đề AI (Whisper):** Nhấp nút và lựa chọn Mô hình AI (Base/Small/Medium) cùng ngôn ngữ đầu vào (mặc định là *Tự động nhận diện*). Thanh tiến trình sẽ báo cáo real-time phần trăm trích xuất mượt mà kèm nút **Hủy trích xuất** khẩn cấp để dừng tiến trình tức thời.
*   **Hiệu ứng động (Effects):** Hỗ trợ hiện chữ từng từ sáng lên theo giọng nói (**Word Reveal**), Karaoke nhảy màu, Pop giật chữ đàn hồi, hay Fade mờ dần.
*   **Định dạng kiểu chữ (Text Case):** Chọn tự động viết hoa toàn bộ chữ (**UPPERCASE**) giúp phụ đề nổi bật chuẩn short-form TikTok/Reels.
*   **Chữ chạy đơn RSVP:** Chế độ nhấp nháy chữ đơn chính giữa đáy, giúp mắt cố định điểm đọc cực nhanh.
*   **Khóa cứng tối đa 2 dòng (Max 2 Lines):** Thuật toán tự động tính toán ngắt dòng thông minh, ép toàn bộ câu thoại dài chỉ hiển thị tối đa **2 dòng**, giữ màn hình luôn thoáng đãng.

### 📐 6. Tab: Khung (Camera Frame)
Trang trí video bằng khung HUD máy quay kỹ thuật số:
*   Hỗ trợ 4 phong cách ngắm quay: **Classic REC** (Cổ điển), **Modern Cinema** (Điện ảnh), **Vlogger DSLR** (Máy cơ) và **Retro VHS** (Băng từ hoài cổ).
*   Tinh chỉnh linh hoạt: Màu sắc khung (Color), Độ co lề (Padding), Độ dày nét vẽ (Thickness) và Tỷ lệ phóng to HUD (Scale).

### ✂️ 7. Tab: Xóa nền AI (AI Bg Removal)
*   Hỗ trợ tải lên một bức ảnh chân dung thô (JPEG/PNG).
*   Bấm **XÓA NỀN BẰNG AI** để hệ thống tự động lọc sạch nền xung quanh, xuất ra ảnh chân dung PNG trong suốt hoàn hảo để bạn chèn trực tiếp làm ảnh phủ custom.

### 🚀 8. Tab: Cấu hình (Render Settings)
*   **Độ phân giải (Resolution):** Chọn Khung hình ngang chuẩn HD **`1920x1080` (Widescreen 16:9)** hoặc Khung dọc TikTok/Shorts **`1080x1920` (Portrait 9:16)**. Tọa độ phụ đề, camera và ảnh phủ sẽ tự động co giãn tỷ lệ thuận chính xác 100% không lo lệch vị trí.
*   **Chất lượng (Bitrate):** Đặt bitrate (mặc định 12Mbps) và chọn luồng luồng CPU xử lý để render nhanh nhất.
*   Bấm **BẮT ĐẦU GHÉP VIDEO** và theo dõi thanh tiến trình cùng bảng Logs trực quan. Khi hoàn tất 100%, bạn có thể bấm **📂 Mở thư mục chứa** hoặc **▶ Phát video ngay** để thưởng thức thành phẩm!
