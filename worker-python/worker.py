import argparse
import sys
import os
import json
from job_schema import RenderConfig
from video_processor_adapter import render_video

def main():
    parser = argparse.ArgumentParser(description="Auto Video Merger Studio - Render Worker")
    parser.add_argument(
        "--config", 
        required=True, 
        help="Đường dẫn đến tệp cấu hình JSON chứa thông số RenderConfig"
    )
    
    args = parser.parse_args()
    
    if not os.path.exists(args.config):
        print(json.dumps({"percent": 0, "error": f"Không tìm thấy tệp cấu hình: {args.config}"}))
        sys.exit(1)
        
    try:
        # 1. Đọc và parse cấu hình JSON
        with open(args.config, "r", encoding="utf-8") as f:
            config_data = json.load(f)
            
        # 2. Kiểm định dữ liệu bằng Pydantic
        config = RenderConfig(**config_data)
        
        # 3. Định nghĩa hàm callback in tiến độ định dạng JSON Lines
        def progress_callback(percent: int, log_message: str):
            print(json.dumps({
                "percent": percent,
                "log": log_message
            }), flush=True)
            
        # 4. Bắt đầu luồng render video chính
        output_file = render_video(config, progress_callback)
        
    except Exception as e:
        print(json.dumps({
            "percent": 0,
            "error": f"Lỗi không mong muốn trong quá trình thực thi: {str(e)}"
        }), flush=True)
        sys.exit(1)

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding='utf-8')
    main()
