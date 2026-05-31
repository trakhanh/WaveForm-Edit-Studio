import subprocess
import shutil
import sys

def check_ffmpeg_on_path() -> bool:
    """Kiểm tra xem ffmpeg có nằm trên PATH không."""
    return shutil.which("ffmpeg") is not None

def check_ffprobe_on_path() -> bool:
    """Kiểm tra xem ffprobe có nằm trên PATH không."""
    return shutil.which("ffprobe") is not None

def check_nvenc_support() -> bool:
    """Kiểm tra tăng tốc phần cứng h264_nvenc bằng cách chạy 1 frame dummy."""
    if not check_ffmpeg_on_path():
        return False
    
    cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi",
        "-i", "color=c=black:s=320x240",
        "-frames:v", "1",
        "-c:v", "h264_nvenc",
        "-f", "null",
        "-"
    ]
    
    try:
        # Timeout 3 seconds to avoid hanging
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=3,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
        )
        return result.returncode == 0
    except Exception:
        return False

def get_system_report() -> dict:
    """Báo cáo trạng thái khả dụng của các công cụ kết xuất."""
    ffmpeg_ok = check_ffmpeg_on_path()
    ffprobe_ok = check_ffprobe_on_path()
    nvenc_ok = check_nvenc_support()
    
    return {
        "ffmpeg": ffmpeg_ok,
        "ffprobe": ffprobe_ok,
        "h264_nvenc": nvenc_ok,
        "recommended_encoder": "h264_nvenc" if nvenc_ok else "libx264"
    }

if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    print("--- HỆ THỐNG KIỂM TRA BỘ LỌC KẾT XUẤT ---")
    report = get_system_report()
    print(f"FFmpeg  : {'XÁC NHẬN SẴN SÀNG' if report['ffmpeg'] else 'KHÔNG TÌM THẤY'}")
    print(f"FFprobe : {'XÁC NHẬN SẴN SÀNG' if report['ffprobe'] else 'KHÔNG TÌM THẤY'}")
    print(f"NVIDIA NVENC : {'ĐƯỢC HỖ TRỢ' if report['h264_nvenc'] else 'KHÔNG HỖ TRỢ (Dùng CPU fallback)'}")
    print(f"Bộ giải mã đề xuất: {report['recommended_encoder']}")
