import os
import sys
import json
import argparse
import subprocess
import shutil
import tempfile
import warnings

def format_timestamp(seconds: float, always_include_hours: bool = False) -> str:
    assert seconds >= 0, "non-negative timestamp expected"
    milliseconds = round(seconds * 1000.0)

    hours = milliseconds // 3_600_000
    milliseconds -= hours * 3_600_000

    minutes = milliseconds // 60_000
    milliseconds -= minutes * 60_000

    seconds = milliseconds // 1_000
    milliseconds -= seconds * 1_000

    hours_marker = f"{hours:02d}:" if always_include_hours or hours > 0 else ""
    return f"{hours_marker}{minutes:02d}:{seconds:02d},{milliseconds:03d}"

def write_srt(transcript, file):
    for i, segment in enumerate(transcript, start=1):
        file.write(
            f"{i}\n"
            f"{format_timestamp(segment['start'], always_include_hours=True)} --> "
            f"{format_timestamp(segment['end'], always_include_hours=True)}\n"
            f"{segment['text'].strip().replace('-->', '->')}\n\n"
        )

def main():
    parser = argparse.ArgumentParser(description="Whisper Transcription Worker")
    parser.add_argument("--input", required=True, help="Đường dẫn file âm thanh hoặc video đầu vào")
    parser.add_argument("--output", help="Đường dẫn file .srt đầu ra (mặc định lưu cùng thư mục input)")
    parser.add_argument("--model", default="small", help="Tên mô hình Whisper (tiny, base, small, medium, large)")
    parser.add_argument("--language", default="auto", help="Ngôn ngữ nguồn (auto, vi, en, zh, ja, ko...)")
    args = parser.parse_args()

    input_path = os.path.abspath(args.input)
    
    if not os.path.exists(input_path):
        print(json.dumps({"percent": 0, "error": f"Không tìm thấy tệp đầu vào: {input_path}"}), flush=True)
        sys.exit(1)

    # Xác định đường dẫn file SRT đầu ra nếu không chỉ định
    if args.output:
        output_path = os.path.abspath(args.output)
    else:
        base_name, _ = os.path.splitext(input_path)
        output_path = f"{base_name}.srt"

    temp_wav_path = None
    try:
        # Bước 1: Trích xuất âm thanh sang WAV sử dụng FFmpeg hệ thống
        print(json.dumps({"percent": 10, "log": "Đang chuẩn bị trích xuất âm thanh từ tệp tin nguồn..."}), flush=True)
        
        if not shutil.which("ffmpeg"):
            print(json.dumps({"percent": 0, "error": "Không tìm thấy công cụ FFmpeg trên hệ thống. Vui lòng thêm FFmpeg vào biến môi trường PATH."}), flush=True)
            sys.exit(1)

        temp_dir = tempfile.gettempdir()
        temp_wav_path = os.path.join(temp_dir, f"transcribe_temp_{os.path.basename(input_path)}.wav")
        
        print(json.dumps({"percent": 20, "log": "Đang trích xuất kênh âm thanh chất lượng cao 16kHz mono bằng FFmpeg..."}), flush=True)
        
        # Gọi FFmpeg để tách audio thành WAV 16kHz mono PCM
        ffmpeg_cmd = [
            "ffmpeg", "-y",
            "-i", input_path,
            "-acodec", "pcm_s16le",
            "-ac", "1",
            "-ar", "16000",
            temp_wav_path
        ]
        
        result = subprocess.run(ffmpeg_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if result.returncode != 0:
            print(json.dumps({"percent": 0, "error": "Lỗi FFmpeg khi trích xuất âm thanh."}), flush=True)
            sys.exit(1)

        # Bước 2: Nạp thư viện và nạp mô hình Whisper
        print(json.dumps({"percent": 35, "log": "Đang khởi động AI và nạp thư viện Whisper..."}), flush=True)
        
        try:
            import tqdm
            
            class WhisperProgressTqdm(tqdm.tqdm):
                def __init__(self, *args, **kwargs):
                    super().__init__(*args, **kwargs)
                    self._is_whisper_pbar = (
                        self.total is not None and 
                        self.total > 0 and 
                        kwargs.get('unit') == 'frames'
                    )
                    self.current_n = 0

                def update(self, n=1):
                    super().update(n)
                    if getattr(self, '_is_whisper_pbar', False):
                        self.current_n += n
                        pct = self.current_n / self.total if self.total else 0
                        current_percent = 70 + int(pct * 15)
                        current_percent = min(85, max(70, current_percent))
                        
                        sec_done = self.current_n / 100.0
                        total_sec = self.total / 100.0
                        
                        print(json.dumps({
                            "percent": current_percent,
                            "log": f"AI đang phân tích âm thanh: {sec_done:.1f}s / {total_sec:.1f}s ({int(pct * 100)}%)..."
                        }), flush=True)

            tqdm.tqdm = WhisperProgressTqdm
        except Exception as e:
            pass

        try:
            import whisper
        except ImportError:
            print(json.dumps({"percent": 0, "error": "Chưa cài đặt thư viện 'openai-whisper'. Vui lòng chạy lệnh pip install openai-whisper."}), flush=True)
            sys.exit(1)

        print(json.dumps({"percent": 45, "log": f"Đang nạp mô hình AI Whisper ({args.model}). Tiến trình có thể mất một ít thời gian..."}), flush=True)
        
        warnings.filterwarnings("ignore")
        model = whisper.load_model(args.model)
        warnings.filterwarnings("default")

        # Bước 3: Chạy nhận dạng giọng nói Whisper
        print(json.dumps({"percent": 70, "log": f"Đang phân tích âm thanh và tạo phụ đề (Ngôn ngữ: {args.language})..."}), flush=True)
        
        transcribe_args = {}
        if args.language != "auto":
            transcribe_args["language"] = args.language

        warnings.filterwarnings("ignore")
        result = model.transcribe(temp_wav_path, **transcribe_args)
        warnings.filterwarnings("default")

        detected_lang = result.get("language", "Không rõ")
        print(json.dumps({"percent": 85, "log": f"Phân tích giọng nói hoàn tất! Ngôn ngữ phát hiện: {detected_lang}"}), flush=True)

        # Bước 4: Lưu file SRT đầu ra
        print(json.dumps({"percent": 95, "log": "Đang đóng gói và lưu tệp phụ đề sang định dạng .srt..."}), flush=True)
        
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as srt_file:
            write_srt(result["segments"], file=srt_file)

        print(json.dumps({
            "percent": 100,
            "log": "Đã hoàn thành tạo phụ đề thành công!",
            "outputPath": output_path,
            "detectedLanguage": detected_lang
        }), flush=True)

    except Exception as e:
        print(json.dumps({"percent": 0, "error": f"Lỗi trong quá trình xử lý phụ đề: {str(e)}"}), flush=True)
        sys.exit(1)
    finally:
        # Dọn dẹp tệp tạm
        if temp_wav_path and os.path.exists(temp_wav_path):
            try:
                os.remove(temp_wav_path)
            except:
                pass

if __name__ == "__main__":
    # Đảm bảo in ra UTF-8 chuẩn trên Windows
    sys.stdout.reconfigure(encoding='utf-8')
    main()
