import { RenderConfig } from '../types/render';

export function generateFfmpegPlan(config: RenderConfig): string {
  const encoder = config.render?.encoder === 'auto' ? 'h264_nvenc (Ưu tiên GPU)' : config.render?.encoder;
  const isFastBlur = config.background?.blurMode === 'fast';
  const blurPct = config.background?.blurPercent ?? 20;

  // Blur parameters formula matching python video_processor.py
  const fastRadius = Math.max(1, Math.floor(blurPct * 0.35));
  const fastPower = Math.max(1, Math.floor(blurPct * 0.1));
  const qualityRadius = Math.max(1, Math.floor(blurPct * 0.75));
  const qualityPower = Math.max(1, Math.floor(qualityRadius / 3));

  const blurFilters = isFastBlur
    ? `scale=960:540:force_original_aspect_ratio=increase,crop=960:540,boxblur=${fastRadius}:${fastPower},scale=1920:1080`
    : `scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,boxblur=${qualityRadius}:${qualityPower}`;

  const xfadeType = config.background?.transitionType ?? 'fade';
  const xfadeDur = config.background?.transitionDuration ?? 1.0;

  const maskShape = config.imageOverlay?.maskShape ?? 'circle';
  const feather = config.imageOverlay?.feather ?? 5;
  const overlayX = config.imageOverlay?.x ?? 960;
  const overlayY = config.imageOverlay?.y ?? 540;

  const waveSource = config.waveform?.source ?? 'voice';
  const wavePath = config.waveform?.path ?? 'linear';
  const waveMirror = config.waveform?.mirror ? 'Đối xứng hai bên baseline' : 'Một hướng từ baseline';

  const subtitleEffect = config.subtitles?.effect ?? 'karaoke';
  const subtitleFont = config.subtitles?.fontFamily ?? 'Arial';

  return `### 🎬 KẾ HOẠCH FFmpeg & PILLOW PIPELINE (BẢN DỊCH CHI TIẾT)

Hệ thống đã phân tích các tham số đầu vào và tạo ra kế hoạch kết xuất video đơn lớp cao cấp (Single-Pass Rendering) nhằm triệt tiêu I/O đĩa trung gian:

---

#### 1. 🖼️ Xử lý Nền Video (Background Layer)
- **Tỷ lệ & Kích thước**: Đồng bộ hóa toàn bộ video nền về độ phân giải chuẩn **1920×1080**.
- **Hiệu ứng làm mờ nền (Blur Background)**:
  - Loại mờ: \`${config.background?.blurMode === 'fast' ? 'Mờ nhanh (Fast BoxBlur)' : 'Mờ chất lượng cao (Quality BoxBlur)'}\` (Độ mờ: \`${blurPct}%\`).
  - Lệnh bộ lọc FFmpeg:
    \`\`\`bash
    [0:v]format=yuv420p,${blurFilters}[bg_processed]
    \`\`\`
  - *Ghi chú tối ưu*: ${
    isFastBlur
      ? 'Được downscale về 960×540 trước khi làm mờ để tăng tốc độ xử lý gấp 4 lần, sau đó upscale lại về 1920×1080.'
      : 'Được làm mờ trực tiếp ở độ phân giải gốc 1920×1080.'
  }
- **Hiệu ứng chuyển cảnh (xfade)**:
  - Sử dụng chuyển cảnh loại \`${xfadeType}\` với thời lượng \`${xfadeDur}s\`.
  - Công thức tính thời điểm ghép (offset): \`offset_i = tổng_thời_lượng_trước - ${xfadeDur}s\`.

---

#### 2. 🎵 Trộn Âm thanh (Audio Mixing Layer)
- Sử dụng bộ lọc \`amix\` để trộn tệp giọng đọc chính (\`voiceFile\`) với nhạc nền (\`musicFiles\`).
- **Tham số bộ trộn**:
  - Âm lượng nhạc nền: \`${Math.round((config.musicVolume ?? 0.5) * 100)}%\`.
  - Bộ cắt âm thanh (\`atrim\`) giới hạn nhạc nền và áp dụng hiệu ứng nhỏ dần (\`afade\`) trong \`5.0s\` cuối cùng.
  - Bộ lọc:
    \`\`\`bash
    [1:a]volume=${config.musicVolume ?? 0.5},atrim=end=45.5,afade=t=out:st=40.5:d=5[mus];[0:a][mus]amix=inputs=2:duration=first[aout]
    \`\`\`

---

#### 3. 🖼️ Lớp Ảnh Phủ (Image Overlay Layer)
- **Xử lý mặt nạ qua Pillow (Python)**:
  - Đọc các ảnh từ \`overlayImages\` và chuyển đổi sang không gian màu **RGBA**.
  - Áp dụng mặt nạ \`${maskShape}\` với góc bo mịn (feather) \`${feather}px\` sử dụng bộ lọc GaussianBlur trên mặt nạ nhị phân.
  - Hỗ trợ xoay ảnh ở góc \`${config.imageOverlay?.rotation}°\` (sử dụng phép nội suy \`BICUBIC\` chất lượng cao).
- **Lồng ghép bằng FFmpeg (overlay)**:
  - Áp dụng làm mờ alpha khi ảnh xuất hiện và biến mất:
    \`\`\`bash
    fade=t=in:st=0:d=${config.imageOverlay?.imageTransitionDuration ?? 1}:alpha=1,fade=t=out:st=${
    (config.imageOverlay?.imageDuration ?? 5) - (config.imageOverlay?.imageTransitionDuration ?? 1)
  }:d=${config.imageOverlay?.imageTransitionDuration ?? 1}:alpha=1
    \`\`\`
  - Vị trí lồng ghép: Tọa độ căn giữa X=${overlayX}, Y=${overlayY}. Công thức: \`x=${overlayX}-w/2, y=${overlayY}-h/2\`.

---

#### 4. 📊 Lớp Sóng Âm (Waveform System)
- **Phương thức tạo**: Kích hoạt bộ xử lý Python đọc phong bì âm thanh (Audio Envelope) từ WAV 8kHz mono.
- **Visual rendering**:
  - Dựng sóng dạng \`${wavePath}\` (\`${config.waveform?.barsCount} cột\`, độ nhạy \`${config.waveform?.sensitivity}\`).
  - Màu sắc: \`${
    config.waveform?.gradientEnabled
      ? `Chuyển sắc từ ${config.waveform?.gradientStart} đến ${config.waveform?.gradientEnd}`
      : `Đơn sắc: ${config.waveform?.fillColor}`
  }\`.
  - Phép đối xứng: \`${waveMirror}\`.
- **Tối ưu hóa Frame-skip**:
  - Chỉ vẽ sóng âm trên các frame chẵn (15fps) và tái sử dụng byte ảnh trên frame lẻ. Truyền trực tiếp qua cổng ghép luồng (stdin pipe) vào FFmpeg giúp **loại bỏ 100% chi phí ghi đĩa**.

---

#### 5. 🔤 Lớp Phụ Đề (Subtitle Layer)
- **Nhận diện giọng nói**: Gọi API Gemini 3.5 Flash để trả về thời gian khớp chi tiết ở cấp độ từ (word-level).
- **Định dạng Ass (Advanced SubStation Alpha)**:
  - Font chữ: \`${subtitleFont}\` (Kích cỡ: \`${config.subtitles?.fontSize}pt\`).
  - Căn lề: Căn giữa dưới (Alignment 2), khoảng cách đáy: \`${config.subtitles?.bottomMargin}px\`.
  - Hiệu ứng: \`${subtitleEffect}\` (Với hiệu ứng karaoke, sử dụng các tag \`\\kf\` biểu diễn mili-giây chi tiết cho từng từ).

---

#### 6. 📹 Lớp Khung Camera mô phỏng (Camera Overlay Layer)
- Thêm lớp viền tĩnh mô phỏng khung camera quay phim (REC, battery, góc ngắm).
- Chấm đỏ REC nhấp nháy 1 giây sáng / 1 giây tắt thông qua công thức chia dư thời gian:
  \`\`\`bash
  overlay=100:75:enable='lt(mod(t,2),1)'
  \`\`\`

---

#### 7. 📤 Thiết lập Mã hóa Đầu ra (Encoding & Fallback Settings)
- **Bộ mã hóa được chọn**: \`${encoder}\`.
- **Hệ thống tự động phòng vệ**: Nếu phần cứng GPU NVENC bị lỗi hoặc bận, hệ thống tự động fallback về bộ mã hóa CPU mềm chất lượng cao \`libx264 ultrafast crf 23\`.
- **Độ phân giải**: \`${config.render?.resolution ?? '1920x1080'}\` | Khung hình: \`${config.render?.fps ?? 30}fps\` | Bitrate: \`${config.render?.bitrate ?? '6M'}\`.
`;
}
