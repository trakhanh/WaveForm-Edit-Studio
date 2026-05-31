# 🐍 Python Render Worker — Auto Video Merger Engine

Bộ phận này là nhân xử lý kết xuất (Rendering Engine) thực tế của **Auto Video Merger Studio**, hoạt động độc lập với máy chủ Web Next.js. Nhiệm vụ của nó là nhận cấu hình `RenderConfig` định dạng JSON, phân tích đầu vào và điều phối chạy các tiến trình **FFmpeg, FFprobe, Pillow (PIL)** thật để tạo video đầu ra hoàn chỉnh.

---

## 🛠️ Yêu Cầu Hệ Thống & Cài Đặt

### 1. Cài đặt FFmpeg & FFprobe
Đảm bảo bạn đã cài đặt FFmpeg và FFprobe trên hệ thống. 
- **Windows**: (Đã được cài đặt tự động qua `winget` trong pha chuẩn bị).
- Đường dẫn của `ffmpeg` và `ffprobe` phải nằm trong biến môi trường `PATH`. Để kiểm tra, chạy lệnh:
  ```bash
  ffmpeg -version
  ffprobe -version
  ```

### 2. Cài đặt Python & Thư viện phụ thuộc
Worker yêu cầu **Python >= 3.9** (Khuyên dùng **Python 3.12**).
Cài đặt các gói thư viện cần thiết thông qua `requirements.txt`:
```bash
pip install -r requirements.txt
```

---

## 📂 Danh Sách Các File Trong Thư Mục

- `job_schema.py`: Định nghĩa các Pydantic Schema kiểm định kiểu dữ liệu của `RenderConfig` đồng bộ hoàn toàn với TypeScript phía Frontend.
- `ffmpeg_check.py`: Module kiểm tra tính sẵn sàng của `ffmpeg`, `ffprobe` trên hệ thống và báo cáo hỗ trợ tăng tốc phần cứng GPU NVIDIA (`h264_nvenc`).
- `video_processor_adapter.py`: Adapter điều khiển luồng render thực tế (đọc audio envelope, xử lý vẽ sóng âm transparent RGBA, bo viền hình ảnh Pillow, ghép nối video qua bộ lọc phức tạp `filter_complex` của FFmpeg).
- `worker.py`: File CLI chạy chính. Nhận tệp JSON chứa cấu hình job, thực thi tiến trình render và in ra tiến độ dưới dạng JSON Lines từng dòng để Server cha dễ dàng thu thập và SSE về trình duyệt.

---

## 🚀 Cách Chạy Thử Nghiệm (Mock / Real)

### 1. Chạy CLI Worker đơn giản
Worker chấp nhận đường dẫn tệp tin cấu hình JSON đầu vào:
```bash
python worker.py --config config.json
```

### 2. Định dạng đầu ra của Tiến độ (Progress Output)
Khi chạy, Worker sẽ in ra stdout định dạng JSON chuẩn theo từng dòng thời gian thực:
```json
{"percent": 15, "log": "Kiểm tra tệp tin đầu vào voiceFile.mp3..."}
{"percent": 45, "log": "Xử lý ảnh phủ bằng Pillow..."}
{"percent": 85, "log": "Đang xuất video chính sử dụng h264_nvenc..."}
{"percent": 100, "log": "Hoàn tất kết xuất video thành công!"}
```
Next.js API có thể bắt luồng \`stdout\` của tiến trình con này bằng \`subprocess.Popen\` và đẩy qua Server-Sent Events (SSE) để hiển thị mượt mà lên trình duyệt người dùng.

---

## 🎯 Luồng Tích Hợp FFmpeg Thật Trong Tương Lai
Để nối nhân `video_processor.py` (PySide6 cũ) vào Adapter này:
1. Copy các hàm logic Pillow và chuỗi filter FFmpeg từ `video_processor.py` cũ vào `video_processor_adapter.py`.
2. Map trực tiếp các tham số từ Pydantic \`RenderConfig\` sang từ điển \`params\` mà hàm cũ mong muốn.
3. Kích hoạt tính năng ghi đè luồng \`progress_callback\` để thay thế việc in log thô bằng cấu trúc JSON có \`percent\` và \`log\`.
