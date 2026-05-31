# 🌌 WaveForm Edit Studio - Hướng dẫn Cài đặt & Sử dụng Toàn diện

Chào mừng bạn đến với **WaveForm Edit Studio**, phần mềm lập trình biên tập video cao cấp, thiết kế mượt mà chuyên biệt cho việc tạo sóng âm thanh nhảy động (Waveform audio visualizer), trích xuất phụ đề tự động bằng trí tuệ nhân tạo (Whisper AI) và tích hợp các lớp ảnh phủ, khung camera máy quay độc quyền.

Giao diện của phần mềm được thiết kế theo phong cách **Glassmorphic** hiện đại, kết hợp dải màu Tím-Indigo Neon thời thượng và lưới mesh Mesh không gian kỹ thuật số có chiều sâu vượt trội.

---

## 🛠️ Yêu cầu Hệ thống & Hướng dẫn Cài đặt Tiền đề

Trước khi khởi chạy ứng dụng, hãy đảm bảo máy tính của bạn đã được cài đặt đầy đủ 3 công cụ cốt lõi dưới đây. Vì ứng dụng được tối ưu hóa chạy tốt nhất trên **Windows**, hãy làm theo hướng dẫn từng bước chi tiết sau:

### 1. 🟢 Cài đặt Node.js & NPM
*   **Bước A:** Truy cập trang chủ chính thức: **[nodejs.org](https://nodejs.org/)**.
*   **Bước B:** Tải về phiên bản **LTS (Recommended For Most Users)** để có sự ổn định tốt nhất.
*   **Bước C:** Mở tệp `.msi` vừa tải, nhấp **Next** liên tục để cài đặt theo các giá trị mặc định của hệ thống.
*   **Bước D:** Xác thực cài đặt thành công bằng cách mở Terminal (PowerShell hoặc CMD) gõ:
    ```bash
    node -v
    npm -v
    ```
    *(Màn hình hiển thị phiên bản ví dụ `v20.x.x` và `10.x.x` là hoàn tất).*

---

### 2. 🐍 Cài đặt Python (Cực kỳ quan trọng ô tích PATH)
*   **Bước A:** Truy cập trang tải về: **[python.org/downloads](https://python.org/downloads/)**.
*   **Bước B:** Nhấp nút tải phiên bản Python mới nhất phù hợp cho Windows.
*   **Bước C:** Mở trình cài đặt. **LƯU Ý BẮT BUỘC:** Hãy tích chọn vào ô vuông **"Add python.exe to PATH"** (hoặc *Add Python to PATH*) nằm ở dưới cùng giao diện cài đặt trước khi bấm nút **Install Now**. Nếu bỏ qua bước này, máy tính sẽ báo lỗi *"lệnh python/pip không tồn tại"*.
*   **Bước D:** Xác thực cài đặt thành công bằng cách mở Terminal gõ:
    ```bash
    python --version
    pip --version
    ```
    *(Màn hình hiển thị phiên bản Python `3.10` trở lên là thành công).*

---

### 3. 🎬 Cài đặt FFmpeg & Cấu hình Biến môi trường PATH (Tối quan trọng cho Video)
FFmpeg là công cụ giải mã âm thanh và vẽ sóng nhạc. Đây là phần cài đặt đòi hỏi sự chính xác cao trên Windows, hãy làm đúng theo 4 bước nhỏ sau:

*   **Bước A: Tải gói FFmpeg build sẵn cho Windows:**
    *   Truy cập trang phân phối chính thức: **[gyan.dev/ffmpeg/builds/](https://www.gyan.dev/ffmpeg/builds/)**.
    *   Kéo xuống phần **git master builds** hoặc **release builds**, nhấp chuột vào tệp **`ffmpeg-git-full.7z`** (hoặc `ffmpeg-release-essentials.zip`) để tải về.
*   **Bước B: Giải nén và đặt thư mục:**
    *   Tạo một thư mục mới có tên là **`FFmpeg`** nằm trực tiếp tại ổ đĩa `C:\` (đường dẫn đầy đủ là `C:\FFmpeg`).
    *   Dùng phần mềm giải nén (như WinRAR hoặc 7-Zip) giải nén tệp tin vừa tải vào thư mục này. 
    *   Hãy chắc chắn rằng cấu trúc thư mục chứa tệp chạy có dạng: **`C:\FFmpeg\bin`** (bên trong thư mục `bin` này phải chứa 3 file thực thi là `ffmpeg.exe`, `ffplay.exe`, và `ffprobe.exe`).
*   **Bước C: Thêm đường dẫn thư mục `bin` vào Environment Variables (PATH):**
    1.  Nhấn nút `Start` (hoặc phím `Windows`) $\rightarrow$ gõ tìm kiếm chữ **`env`** $\rightarrow$ chọn mở mục **"Edit the system environment variables"** (Chỉnh sửa biến môi trường hệ thống).
    2.  Tại tab *Advanced* của cửa sổ hiện lên, nhấp chọn nút **"Environment Variables..."** nằm ở góc dưới cùng bên phải.
    3.  Tại khung **"System variables"** ở nửa dưới, cuộn tìm dòng có tên là **`Path`** (hoặc `PATH`) $\rightarrow$ nhấp đúp chuột vào nó (hoặc chọn và nhấn **Edit...**).
    4.  Nhấp chọn nút **"New"** ở góc phải $\rightarrow$ dán chính xác đường dẫn thư mục chứa tệp chạy của bạn vào: **`C:\FFmpeg\bin`**.
    5.  Bấm nút **OK** liên tiếp ở tất cả các cửa sổ để lưu lại thay đổi.
*   **Bước D: Khởi động lại terminal để nhận diện:**
    *   **Lưu ý:** Bạn bắt buộc phải **đóng hoàn toàn** tất cả các Terminal/CMD/VS Code đang mở và khởi động lại một cửa sổ mới để hệ thống tải lại biến môi trường.
    *   Gõ các lệnh sau để kiểm tra:
        ```bash
        ffmpeg -version
        ffprobe -version
        ```
    *   *(Nếu terminal hiển thị đầy đủ thông số cấu hình và phiên bản của FFmpeg nghĩa là bạn đã hoàn tất tích hợp thành công 100%!)*

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
