export const backendPlan = {
  title: 'KIẾN TRÚC RENDER PRODUCTION CHUẨN GOOGLE ANTIGRAVITY',
  description: 'Hệ thống này được thiết kế để giải quyết triệt để các hạn chế về tài nguyên của việc render video trực tiếp trong browser hoặc trong luồng chính của máy chủ web Next.js API.',
  
  diagram: `graph TB
    subgraph "Trình duyệt Người dùng (Client)"
        UI["React Web UI<br/>(Cài đặt, Preset, Tiến độ)"]
        Canvas["Preview Canvas<br/>(Tương tác kéo/thả)"]
        SSE["SSE Client<br/>(Nhận log & % tiến độ)"]
    end

    subgraph "Lớp API Điều phối (Next.js Server)"
        API["REST API Endpoint<br/>(/api/jobs/start, /api/jobs/cancel)"]
        SSE_Server["SSE Router<br/>(/api/jobs/[id]/events)"]
        Store["RAM/Database Store<br/>(Lưu trạng thái Job)"]
    end

    subgraph "Hàng đợi Phân tán (Production Queue)"
        Queue["Redis / BullMQ / Celery<br/>(Quản lý hàng đợi Job)"]
    end

    subgraph "Lớp Render Worker (Python Service)"
        Worker["Python Render Worker<br/>(worker.py CLI)"]
        Pillow["Pillow (PIL)<br/>(Xử lý ảnh phủ & mask)"]
        FFmpeg["FFmpeg & FFprobe<br/>(Xử lý video song song)"]
        Gemini["Gemini API<br/>(Nhận diện phụ đề giọng nói)"]
    end

    subgraph "Hệ thống Lưu trữ (Storage)"
        Disk["Object Storage / S3 / Local Disk<br/>(Tài nguyên video & Output)"]
        SegmentCache[".render_cache/ (MD5)<br/>(Cache segment video 10GB)"]
    end

    UI -->|"1. Thiết lập & bấm Render"| API
    UI -->|"4. Mở kết nối SSE"| SSE_Server
    API -->|"2. Khởi tạo Job"| Store
    API -->|"3. Đẩy Job vào hàng đợi"| Queue
    Queue -->|"5. Lấy Job xử lý"| Worker
    Worker -->|"6. Gọi thư viện"| Pillow & FFmpeg & Gemini
    Worker -->|"7. Sử dụng & Lưu trữ"| Disk & SegmentCache
    Worker -->|"8. Gửi Callback tiến độ"| Store
    SSE_Server -->|"9. Stream tiến độ thời gian thực"| SSE
    SSE -->|"10. Cập nhật UI hiển thị"| UI`,

  specifications: [
    {
      title: '1. Không Render trực tiếp trên Browser / Next.js API',
      detail: 'Không sử dụng ffmpeg.wasm trên trình duyệt (hiệu năng cực kỳ kém và dễ crash V8) cũng như không chạy tiến trình FFmpeg dài trực tiếp trong Next.js API route (làm nghẽn luồng xử lý web request của máy chủ).'
    },
    {
      title: '2. API Layer bất đồng bộ (Asynchronous Orchestration)',
      detail: 'Next.js REST API chỉ đóng vai trò nhận cấu hình, tạo bản ghi Job ngay lập tức, đẩy vào hàng đợi và trả về mã Job ID trong vòng chưa đầy 100ms. Luồng phản hồi của API không bị block.'
    },
    {
      title: '3. Python Render Worker độc lập',
      detail: 'Phần kết xuất thực tế chạy trên một Service Python Worker chạy ngầm chuyên dụng. Worker này có thể chạy trên cùng một máy chủ vật lý hoặc một cụm máy chủ Render GPU độc lập có hiệu năng cao.'
    },
    {
      title: '4. Hàng đợi Job phân tán (Job Queue)',
      detail: 'Trong sản xuất thật, hàng đợi được duy trì bởi Redis kết hợp BullMQ (nếu dùng Node.js) hoặc Celery/RQ (nếu dùng Python). Hàng đợi đảm bảo các job render được xử lý tuần tự hoặc song song dựa trên số lõi GPU/CPU hiện có mà không làm sập máy chủ.'
    },
    {
      title: '5. Stream tiến độ SSE (Server-Sent Events)',
      detail: 'Sử dụng giao thức Server-Sent Events (SSE) giúp stream dữ liệu tiến độ (%) và nhật ký xử lý (logs) bằng tiếng Việt theo thời gian thực từ Server về Client một cách nhẹ nhàng hơn rất nhiều so với WebSocket hay Polling liên tục.'
    },
    {
      title: '6. Lưu trữ tệp đầu vào và đầu ra',
      detail: 'Mọi tệp đầu vào (giọng đọc, nhạc nền, ảnh phủ, video nền) được upload lên máy chủ hoặc lưu trữ trên các Object Storage (AWS S3, Google Cloud Storage). Worker sẽ tải về vùng cache tạm thời và lưu kết quả đầu ra lên S3, trả về link tải video an toàn cho client.'
    },
    {
      title: '7. Tối ưu hóa phân đoạn & Cache Segment',
      detail: 'Đối với các video dài (> 10 phút), hệ thống chia nhỏ thành các phân đoạn 10 phút, tiến hành render song song trên nhiều luồng Python (ThreadPoolExecutor). Sau đó tính toán mã băm MD5 của từng phân đoạn lưu vào .render_cache/ để tái sử dụng, cuối cùng nối lại (concat demuxer) để tạo tệp hoàn tất cực kỳ nhanh.'
    },
    {
      title: '8. Triển khai Docker Container có FFmpeg',
      detail: 'Khi triển khai lên đám mây (Cloud), ứng dụng Worker được đóng gói trong một Docker Container (chạy hệ điều hành Linux) có cài đặt sẵn các thư viện FFmpeg, FFprobe, Pillow và driver NVIDIA CUDA cho NVENC để đảm bảo tính đồng nhất môi trường.'
    },
    {
      title: '9. Chạy cục bộ trên Windows',
      detail: 'Khi chạy cục bộ trên môi trường phát triển Windows, hệ thống yêu cầu cài đặt FFmpeg/FFprobe qua Gyan.FFmpeg vào biến môi trường PATH để Python subprocess và FFmpeg có thể giao tiếp thông qua stdin/stdout pipe.'
    }
  ]
};
