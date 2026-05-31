import time
import os
import json
import subprocess
import tempfile
import struct
import math
import random
import threading
from typing import Callable, List
from PIL import Image, ImageDraw, ImageFilter, ImageColor, ImageOps
from job_schema import RenderConfig

# Helper to load monospace / standard fonts on Windows
def safe_load_font(font_name="consola.ttf", size=24) -> ImageDraw.ImageDraw.font:
    from PIL import ImageFont
    paths = [
        f"C:\\Windows\\Fonts\\{font_name}",
        f"C:\\Windows\\Fonts\\arial.ttf",
        "consola.ttf",
        "arial.ttf"
    ]
    for p in paths:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()

# Get duration of audio/video using ffprobe
def get_media_duration(file_path: str) -> float:
    try:
        cmd = [
            "ffprobe", "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            file_path
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, check=True)
        data = json.loads(res.stdout)
        return float(data.get("format", {}).get("duration", 0))
    except Exception as e:
        print(f"Error getting duration for {file_path}: {e}")
        return 0.0

# Extract time-domain amplitudes at specific frame rate
def extract_amplitude_samples(audio_path: str, fps: int = 30) -> List[int]:
    try:
        # Sử dụng tần số phân tích cao hơn (1000 Hz) để tránh hiện tượng răng cưa và mất sóng âm
        analysis_rate = 1000
        cmd = [
            "ffmpeg", "-y",
            "-i", audio_path,
            "-f", "s16le",
            "-ac", "1",
            "-ar", str(analysis_rate),
            "-"
        ]
        res = subprocess.run(cmd, capture_output=True)
        raw_data = res.stdout
        
        num_samples = len(raw_data) // 2
        if num_samples == 0:
            return []
        
        samples = struct.unpack(f"<{num_samples}h", raw_data)
        abs_samples = [abs(s) for s in samples]
        
        # Downsample về tần số khung hình (fps) bằng cách lấy giá trị cực đại (peak)
        samples_per_frame = analysis_rate / fps
        downsampled = []
        
        total_frames = int(num_samples / samples_per_frame)
        for f in range(total_frames + 1):
            start_idx = int(f * samples_per_frame)
            end_idx = int((f + 1) * samples_per_frame)
            window = abs_samples[start_idx:end_idx]
            if window:
                # Lấy giá trị lớn nhất trong cửa sổ thời gian để sóng nhảy nhạy và đẹp mắt
                downsampled.append(max(window))
            else:
                downsampled.append(0)
        return downsampled
    except Exception as e:
        print(f"Error extracting amplitudes: {e}")
        return []

# Create styled ASS subtitles from SRT with dynamic word-level effects
def create_ass_subtitles_from_srt(srt_path: str, config: RenderConfig, job_rand: str) -> str:
    ass_path = f"temp_subtitles_{job_rand}.ass"
    
    def to_ass_color(hex_str: str) -> str:
        hex_str = hex_str.strip('#')
        if len(hex_str) == 6:
            r, g, b = hex_str[0:2], hex_str[2:4], hex_str[4:6]
        else:
            r, g, b = "FF", "FF", "FF"
        # ASS Color format is BGR (no alpha) with trailing ampersand
        return f"&H00{b}{g}{r}&"

    s_cfg = config.subtitles
    p_color = to_ass_color(s_cfg.primaryColor)
    s_color = to_ass_color(s_cfg.secondaryColor)
    o_color = to_ass_color(s_cfg.outlineColor)
    font_name = s_cfg.fontFamily if s_cfg.fontFamily else "Arial"
    font_size = s_cfg.fontSize
    effect_type = s_cfg.effect
    
    # Auto-wrap settings to prevent off-screen horizontal text shifting
    try:
        res_str = getattr(config.render, 'resolution', '1920x1080')
        rx, ry = map(int, res_str.split('x'))
    except Exception:
        rx, ry = 1920, 1080
    is_portrait = ry > rx
    max_chars = 24 if is_portrait else 38

    # Map coordinate spaces to match the output aspect ratio perfectly, preventing position conflicts with overlays
    play_res_x = 1920
    play_res_y = int(1920 * (ry / rx)) if rx > 0 else 1080
    margin_v = int(s_cfg.bottomMargin * (play_res_y / 1080.0))
    sub_y_pos = play_res_y - margin_v

    def wrap_words_to_lines(words_list, limit=max_chars):
        lines = []
        current_line = []
        current_len = 0
        for w in words_list:
            w_len = len(w)
            added_len = w_len + (1 if current_line else 0)
            if current_line and current_len + added_len > limit:
                lines.append(current_line)
                current_line = [w]
                current_len = w_len
            else:
                current_line.append(w)
                current_len += added_len
        if current_line:
            lines.append(current_line)
            
        # Enforce maximum of 2 lines by dynamically widening the limit
        if len(lines) > 2:
            temp_limit = limit
            while len(lines) > 2 and temp_limit < 200:
                temp_limit += 4
                lines = []
                current_line = []
                current_len = 0
                for w in words_list:
                    w_len = len(w)
                    added_len = w_len + (1 if current_line else 0)
                    if current_line and current_len + added_len > temp_limit:
                        lines.append(current_line)
                        current_line = [w]
                        current_len = w_len
                    else:
                        current_line.append(w)
                        current_len += added_len
                if current_line:
                    lines.append(current_line)
        return lines
    
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {play_res_x}
PlayResY: {play_res_y}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font_name},{font_size},{p_color},{s_color},{o_color},&H80000000,-1,0,0,0,100,100,0,0,1,3,0,2,10,10,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    
    def parse_srt_seconds(t_str: str) -> float:
        t_str = t_str.strip().replace(',', '.')
        parts = t_str.split(':')
        if len(parts) == 3:
            h = float(parts[0])
            m = float(parts[1])
            s = float(parts[2])
            return h * 3600 + m * 60 + s
        return 0.0

    def format_ass_time(seconds: float) -> str:
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        s = int(seconds % 60)
        cs = int(round((seconds - int(seconds)) * 100))
        if cs >= 100:
            s += 1
            cs -= 100
        if s >= 60:
            m += 1
            s -= 60
        if m >= 60:
            h += 1
            m -= 60
        return f"{h}:{m:02d}:{s:02d}.{cs:02d}"

    content = ""
    
    try:
        with open(srt_path, "r", encoding="utf-8-sig", errors="replace") as f:
            srt_content = f.read()
        
        import re
        blocks = re.split(r'\n\s*\n', srt_content.strip())
        
        for block in blocks:
            lines = [l.strip() for l in block.split('\n') if l.strip()]
            if len(lines) >= 2:
                time_line = ""
                time_idx = -1
                for idx, line in enumerate(lines):
                    if "-->" in line:
                        time_line = line
                        time_idx = idx
                        break
                
                if time_idx != -1 and time_idx < len(lines):
                    times = time_line.split("-->")
                    if len(times) == 2:
                        start_sec = parse_srt_seconds(times[0])
                        end_sec = parse_srt_seconds(times[1])
                        
                        raw_text = " ".join(lines[time_idx + 1:])
                        raw_text = re.sub(r'<[^>]+>', '', raw_text)
                        
                        words = [w.strip() for w in raw_text.split() if w.strip()]
                        if not words:
                            continue
                            
                        # Apply capitalization/textCase conversions
                        case_opt = getattr(s_cfg, 'textCase', 'uppercase')
                        if case_opt == 'uppercase':
                            words = [w.upper() for w in words]
                            raw_text = raw_text.upper()
                        elif case_opt == 'lowercase':
                            words = [w.lower() for w in words]
                            raw_text = raw_text.lower()
                            
                        # Check RSVP Single-Word flashing mode (Fixes horizontal shifting of dynamic sentences)
                        one_word_mode = getattr(s_cfg, 'oneWordAtATime', False)
                        if one_word_mode:
                            tot_duration = end_sec - start_sec
                            if tot_duration <= 0:
                                tot_duration = 0.5
                            word_dur = tot_duration / len(words)
                            for i, word in enumerate(words):
                                w_start = start_sec + i * word_dur
                                w_end = w_start + word_dur
                                start_ass = format_ass_time(w_start)
                                end_ass = format_ass_time(w_end)
                                
                                # Render the single word pop in center
                                if effect_type == "pop":
                                    content += f"Dialogue: 0,{start_ass},{end_ass},Default,,0,0,0,,{{\\pos(960,{sub_y_pos})\\fscx120\\fscy120\\q2}}{word}\n"
                                else:
                                    content += f"Dialogue: 0,{start_ass},{end_ass},Default,,0,0,0,,{{\\pos(960,{sub_y_pos})}}{word}\n"
                            continue
                            
                        if effect_type == "karaoke":
                            tot_duration = end_sec - start_sec
                            if tot_duration <= 0:
                                tot_duration = 0.5
                            tot_cs = int(tot_duration * 100)
                            
                            num_words = len(words)
                            word_cs = tot_cs // num_words if num_words > 0 else 10
                            
                            lines_wrapped = wrap_words_to_lines(words)
                            kar_text = ""
                            word_idx = 0
                            for line_idx, line in enumerate(lines_wrapped):
                                line_text = ""
                                for w_in_line_idx, word in enumerate(line):
                                    current_word_cs = word_cs
                                    if word_idx == num_words - 1:
                                        current_word_cs += (tot_cs % num_words)
                                    line_text += f"{{\\kf{current_word_cs}}}{word} "
                                    word_idx += 1
                                kar_text += line_text.strip()
                                if line_idx < len(lines_wrapped) - 1:
                                    kar_text += "\\N"
                                
                            start_ass = format_ass_time(start_sec)
                            end_ass = format_ass_time(end_sec)
                            content += f"Dialogue: 0,{start_ass},{end_ass},Default,,0,0,0,,{{\\pos(960,{sub_y_pos})}}{kar_text.strip()}\n"
                            
                        elif effect_type == "word_reveal":
                            tot_duration = end_sec - start_sec
                            if tot_duration <= 0:
                                tot_duration = 0.5
                            tot_ms = int(tot_duration * 1000)
                            
                            # Reserve holding time at the end (e.g. 500ms, or up to 25% if sentence is short)
                            hold_ms = min(500, int(tot_ms * 0.25))
                            reveal_ms = tot_ms - hold_ms
                            if reveal_ms <= 100:
                                reveal_ms = tot_ms
                                hold_ms = 0
                            
                            num_words = len(words)
                            
                            # Proportional duration based on word length
                            word_lens = [len(w) for w in words]
                            total_len = sum(word_lens) if sum(word_lens) > 0 else 1
                            
                            lines_wrapped = wrap_words_to_lines(words)
                            animated_text = ""
                            running_ms = 0.0
                            word_idx = 0
                            for line_idx, line in enumerate(lines_wrapped):
                                line_text = ""
                                for w_in_line_idx, word in enumerate(line):
                                    # Share of total length
                                    share = len(word) / total_len
                                    w_dur = reveal_ms * share
                                    
                                    w_start = int(running_ms)
                                    w_end = int(running_ms + w_dur)
                                    running_ms += w_dur
                                    
                                    # Safety margins
                                    if word_idx == num_words - 1:
                                        w_end = reveal_ms
                                        
                                    # Transitions fade durations (max 120ms, scaled for short words)
                                    fade_in = min(120, max(30, int(w_dur * 0.3)))
                                    fade_out = min(120, max(30, int(w_dur * 0.3)))
                                    
                                    # BGR formatting support (append trailing & for safety if needed)
                                    p_color_tag = f"{p_color}&" if not p_color.endswith('&') else p_color
                                    s_color_tag = f"{s_color}&" if not s_color.endswith('&') else s_color
                                    
                                    line_text += f"{{\\alpha&HFF&\\t({w_start},{w_start+fade_in},\\alpha&H00&\\1c{p_color_tag})\\t({w_end},{w_end+fade_out},\\1c{s_color_tag})}}{word} "
                                    word_idx += 1
                                animated_text += line_text.strip()
                                if line_idx < len(lines_wrapped) - 1:
                                    animated_text += "\\N"
                                
                            start_ass = format_ass_time(start_sec)
                            end_ass = format_ass_time(end_sec)
                            content += f"Dialogue: 0,{start_ass},{end_ass},Default,,0,0,0,,{{\\pos(960,{sub_y_pos})}}{animated_text.strip()}\n"
                            
                        elif effect_type == "pop":
                            tot_duration = end_sec - start_sec
                            if tot_duration <= 0:
                                tot_duration = 0.5
                            num_words = len(words)
                            word_dur = tot_duration / num_words if num_words > 0 else 0.5
                            
                            for i, word in enumerate(words):
                                w_start = start_sec + i * word_dur
                                w_end = w_start + word_dur
                                start_ass = format_ass_time(w_start)
                                end_ass = format_ass_time(w_end)
                                content += f"Dialogue: 0,{start_ass},{end_ass},Default,,0,0,0,,{{\\pos(960,{sub_y_pos})\\fscx115\\fscy115\\q2}}{word}\n"
                                
                        elif effect_type == "fade":
                            lines_wrapped = wrap_words_to_lines(words)
                            wrapped_text = "\\N".join([" ".join(line) for line in lines_wrapped])
                            start_ass = format_ass_time(start_sec)
                            end_ass = format_ass_time(end_sec)
                            content += f"Dialogue: 0,{start_ass},{end_ass},Default,,0,0,0,,{{\\pos(960,{sub_y_pos})\\fad(80,80)}}{wrapped_text}\n"
                            
                        else:
                            lines_wrapped = wrap_words_to_lines(words)
                            wrapped_text = "\\N".join([" ".join(line) for line in lines_wrapped])
                            start_ass = format_ass_time(start_sec)
                            end_ass = format_ass_time(end_sec)
                            content += f"Dialogue: 0,{start_ass},{end_ass},Default,,0,0,0,,{{\\pos(960,{sub_y_pos})}}{wrapped_text}\n"
                            
    except Exception as e:
        print(f"Error processing SRT file: {e}")
        content += f"Dialogue: 0,0:00:00.00,0:00:10.00,Default,,0,0,0,,[Error reading SRT: {str(e)}]\n"

    with open(ass_path, "w", encoding="utf-8-sig") as f:
        f.write(header + content)
        
    return ass_path

# Create styled ASS subtitles file in current working directory to avoid Windows colon/backslash escapes
def create_ass_subtitles(preview_text: str, duration: float, config: RenderConfig, job_rand: str) -> str:
    ass_path = f"temp_subtitles_{job_rand}.ass"
    
    def to_ass_color(hex_str: str) -> str:
        hex_str = hex_str.strip('#')
        if len(hex_str) == 6:
            r, g, b = hex_str[0:2], hex_str[2:4], hex_str[4:6]
        else:
            r, g, b = "FF", "FF", "FF"
        # ASS Color format is BGR (no alpha) with trailing ampersand
        return f"&H00{b}{g}{r}&"

    s_cfg = config.subtitles
    p_color = to_ass_color(s_cfg.primaryColor)
    s_color = to_ass_color(s_cfg.secondaryColor)
    o_color = to_ass_color(s_cfg.outlineColor)
    font_name = s_cfg.fontFamily if s_cfg.fontFamily else "Arial"
    font_size = s_cfg.fontSize
    
    try:
        res_str = getattr(config.render, 'resolution', '1920x1080')
        rx, ry = map(int, res_str.split('x'))
    except Exception:
        rx, ry = 1920, 1080
    is_portrait = ry > rx
    max_chars = 24 if is_portrait else 38

    # Map coordinate spaces to match the output aspect ratio perfectly, preventing position conflicts with overlays
    play_res_x = 1920
    play_res_y = int(1920 * (ry / rx)) if rx > 0 else 1080
    margin_v = int(s_cfg.bottomMargin * (play_res_y / 1080.0))
    sub_y_pos = play_res_y - margin_v
    
    content = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {play_res_x}
PlayResY: {play_res_y}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font_name},{font_size},{p_color},{s_color},{o_color},&H80000000,-1,0,0,0,100,100,0,0,1,3,0,2,10,10,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    def format_time(sec: float) -> str:
        h = int(sec // 3600)
        m = int((sec % 3600) // 60)
        s = int(sec % 60)
        cs = int(round((sec - int(sec)) * 100))
        return f"{h}:{m:02d}:{s:02d}.{cs:02d}"
        
    end_time_str = format_time(duration)
    subtitle_text = preview_text if preview_text else s_cfg.previewText
    if not subtitle_text:
        subtitle_text = "Auto Video Merger Studio"
        
    case_opt = getattr(s_cfg, 'textCase', 'uppercase')
    if case_opt == 'uppercase':
        subtitle_text = subtitle_text.upper()
    elif case_opt == 'lowercase':
        subtitle_text = subtitle_text.lower()
        
    # Auto-wrap preview subtitle text to prevent overflowing or shifting left
    words = [w.strip() for w in subtitle_text.split() if w.strip()]
    
    lines = []
    current_line = []
    current_len = 0
    for w in words:
        w_len = len(w)
        added_len = w_len + (1 if current_line else 0)
        if current_line and current_len + added_len > max_chars:
            lines.append(current_line)
            current_line = [w]
            current_len = w_len
        else:
            current_line.append(w)
            current_len += added_len
    if current_line:
        lines.append(current_line)
        
    # Enforce maximum of 2 lines by dynamically widening the limit
    if len(lines) > 2:
        temp_limit = max_chars
        while len(lines) > 2 and temp_limit < 200:
            temp_limit += 4
            lines = []
            current_line = []
            current_len = 0
            for w in words:
                w_len = len(w)
                added_len = w_len + (1 if current_line else 0)
                if current_line and current_len + added_len > temp_limit:
                    lines.append(current_line)
                    current_line = [w]
                    current_len = w_len
                else:
                    current_line.append(w)
                    current_len += added_len
            if current_line:
                lines.append(current_line)
        
    subtitle_text = "\\N".join([" ".join(line) for line in lines])
    
    content += f"Dialogue: 0,0:00:00.00,{end_time_str},Default,,0,0,0,,{{\\pos(960,{sub_y_pos})}}{subtitle_text}\n"
    
    with open(ass_path, "w", encoding="utf-8-sig") as f:
        f.write(content)
        
    return ass_path

# Process image overlay and return paths
def process_image_overlay(image_path: str, cfg, temp_dir: str) -> str:
    img = Image.open(image_path).convert("RGBA")
    w, h = cfg.width, cfg.height
    
    # Sử dụng ImageOps.fit để tự động crop và giữ nguyên tỷ lệ gốc của ảnh, tránh méo hình
    from PIL import ImageOps
    img = ImageOps.fit(img, (w, h), Image.Resampling.LANCZOS)
    
    # Create mask of same size
    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)
    shape = cfg.maskShape
    inset = cfg.inset if hasattr(cfg, 'inset') else 10
    
    if shape == "circle":
        d = min(w, h)
        cx, cy = w // 2, h // 2
        r = d // 2
        draw.ellipse([cx - r + inset, cy - r + inset, cx + r - inset, cy + r - inset], fill=255)
    elif shape == "hexagon":
        cx, cy = w // 2, h // 2
        r = (min(w, h) - inset * 2) // 2
        points = []
        for i in range(6):
            angle = i * math.pi / 3
            px = cx + r * math.cos(angle)
            py = cy + r * math.sin(angle)
            points.append((px, py))
        draw.polygon(points, fill=255)
    elif shape == "square":
        side = min(w, h) - inset * 2
        cx, cy = w // 2, h // 2
        lx = cx - side // 2
        ty = cy - side // 2
        draw.rectangle([lx, ty, lx + side, ty + side], fill=255)
    else: # rectangle
        draw.rectangle([inset, inset, w - inset, h - inset], fill=255)
        
    feather = cfg.feather if hasattr(cfg, 'feather') else 8
    if feather > 0:
        mask = mask.filter(ImageFilter.GaussianBlur(feather))
        
    # Scale the mask by opacity
    opacity_val = int(cfg.opacity * 255)
    scaled_mask = mask.point(lambda p: int(p * opacity_val / 255))
    
    # Alpha Compositing: Tạo nền trong suốt sạch hoàn toàn và composite ảnh đè lên bằng mặt nạ
    # Điều này triệt tiêu hoàn toàn các hộp/viền chữ nhật bao quanh khi hiển thị trong FFmpeg
    transparent_bg = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    img = Image.composite(img, transparent_bg, scaled_mask)
    
    # Use item ID in filename if available, to prevent overwrite collisions
    filename_id = getattr(cfg, 'id', 'default')
    base_name = os.path.splitext(os.path.basename(image_path))[0]
    processed_path = os.path.join(temp_dir, f"processed_overlay_{filename_id}_{base_name}.png")
    img.save(processed_path, format="PNG")
    return processed_path

# Draw static camera framing details
def draw_camera_overlay(width: int, height: int, config: RenderConfig, temp_dir: str) -> str:
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    c_cfg = config.camera
    if not c_cfg.enabled:
        overlay_path = os.path.join(temp_dir, "camera_overlay.png")
        img.save(overlay_path)
        return overlay_path
        
    # Read customizable parameters with defaults
    scale = float(getattr(c_cfg, 'scale', 1.0))
    padding = int(getattr(c_cfg, 'padding', 30))
    thickness = int(getattr(c_cfg, 'thickness', 3))
    style = str(getattr(c_cfg, 'style', 'classic_rec'))
    color_hex = str(getattr(c_cfg, 'color', '#ffffff'))
    
    # Helper to convert hex to RGBA
    def hex_to_rgba(h_str, a=255):
        h_str = h_str.lstrip('#')
        if len(h_str) == 3:
            h_str = ''.join([c*2 for c in h_str])
        if len(h_str) == 6:
            r = int(h_str[0:2], 16)
            g = int(h_str[2:4], 16)
            b = int(h_str[4:6], 16)
            return (r, g, b, a)
        return (255, 255, 255, a)
        
    color_main = hex_to_rgba(color_hex, 220)
    color_full = hex_to_rgba(color_hex, 255)
    color_muted = hex_to_rgba(color_hex, 160)
    
    # Fonts
    font_monospace = safe_load_font("consola.ttf", int(20 * scale))
    font_large = safe_load_font("consola.ttf", int(26 * scale))
    font_small = safe_load_font("consola.ttf", int(14 * scale))
    
    # -------------------------------------------------------------
    # STYLE 1: CLASSIC CAMERA REC HUD
    # -------------------------------------------------------------
    if style == 'classic_rec':
        # Draw corners
        if c_cfg.showCorners:
            sz = int(45 * scale)
            # Top-left corner
            draw.line([padding, padding, padding + sz, padding], fill=color_main, width=thickness)
            draw.line([padding, padding, padding, padding + sz], fill=color_main, width=thickness)
            # Top-right corner
            draw.line([width - padding, padding, width - padding - sz, padding], fill=color_main, width=thickness)
            draw.line([width - padding, padding, width - padding, padding + sz], fill=color_main, width=thickness)
            # Bottom-left corner
            draw.line([padding, height - padding, padding + sz, height - padding], fill=color_main, width=thickness)
            draw.line([padding, height - padding, padding, height - padding - sz], fill=color_main, width=thickness)
            # Bottom-right corner
            draw.line([width - padding, height - padding, width - padding - sz, height - padding], fill=color_main, width=thickness)
            draw.line([width - padding, height - padding, width - padding, height - padding - sz], fill=color_main, width=thickness)
            
        # Draw REC Text + Red Blinking Dot
        if c_cfg.showRecText:
            rx = padding + int(50 * scale)
            ry = padding + int(12 * scale)
            draw.text((rx, ry), "REC", fill=(239, 68, 68, 255), font=font_large)
            if c_cfg.showBlinkingDot:
                dot_sz = int(12 * scale)
                dx = padding + int(24 * scale)
                dy = padding + int(20 * scale)
                draw.ellipse([dx, dy, dx + dot_sz, dy + dot_sz], fill=(239, 68, 68, 255))
            
        # Draw Battery Status
        if c_cfg.showBattery:
            bx = width - padding - int(60 * scale)
            by = padding + int(12 * scale)
            bw = int(40 * scale)
            bh = int(18 * scale)
            # Battery outer outline
            draw.rectangle([bx, by, bx + bw, by + bh], outline=color_main, width=max(1, int(2 * scale)))
            # Positive terminal block
            draw.rectangle([bx + bw, by + int(4 * scale), bx + bw + int(3 * scale), by + bh - int(4 * scale)], fill=color_main)
            # Active green cells
            draw.rectangle([bx + int(3 * scale), by + int(3 * scale), bx + bw - int(3 * scale), by + bh - int(3 * scale)], fill=(34, 197, 94, 200))
            
        # Draw Timecode
        if c_cfg.showTimecode:
            tx = width // 2 - int(80 * scale)
            ty = height - padding - int(40 * scale)
            draw.text((tx, ty), "TC 00:00:18:24", fill=color_muted, font=font_monospace)
            
    # -------------------------------------------------------------
    # STYLE 2: MODERN CINEMATIC HUD
    # -------------------------------------------------------------
    elif style == 'modern_cinema':
        # Border box around workspace with small gap at the corners
        if c_cfg.showCorners:
            draw.rectangle([padding, padding, width - padding, height - padding], outline=color_main, width=1)
            # Draw corner tick marks
            sz = int(20 * scale)
            draw.line([padding + sz, padding, padding + sz, padding + sz], fill=color_main, width=1)
            draw.line([width - padding - sz, padding, width - padding - sz, padding + sz], fill=color_main, width=1)
            draw.line([padding + sz, height - padding, padding + sz, height - padding - sz], fill=color_main, width=1)
            draw.line([width - padding - sz, height - padding, width - padding - sz, height - padding - sz], fill=color_main, width=1)
            
        # Center Crosshair
        cx, cy = width // 2, height // 2
        r = int(18 * scale)
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=color_muted, width=1)
        # Small center dot
        draw.ellipse([cx - 2, cy - 2, cx + 2, cy + 2], fill=color_full)
        # Crosshair lines
        draw.line([cx - r - 10, cy, cx - r + 4, cy], fill=color_muted, width=1)
        draw.line([cx + r - 4, cy, cx + r + 10, cy], fill=color_muted, width=1)
        draw.line([cx, cy - r - 10, cx, cy - r + 4], fill=color_muted, width=1)
        draw.line([cx, cy + r - 4, cx, cy + r + 10], fill=color_muted, width=1)
        
        # Cinema formats text on corners
        if c_cfg.showRecText:
            draw.text((padding + int(15 * scale), padding + int(15 * scale)), "RAW 4K DCI", fill=color_full, font=font_small)
            draw.text((padding + int(15 * scale), padding + int(35 * scale)), "LUT: CINEMA_GOLD", fill=color_muted, font=font_small)
            
        if c_cfg.showBattery:
            draw.text((width - padding - int(120 * scale), padding + int(15 * scale)), "FPS 24.000", fill=color_full, font=font_small)
            draw.text((width - padding - int(120 * scale), padding + int(35 * scale)), "1/48s  F2.8", fill=color_muted, font=font_small)
            
        if c_cfg.showTimecode:
            # Bottom display
            draw.text((width // 2 - int(90 * scale), height - padding - int(30 * scale)), "A-CAM  00:00:12:00", fill=color_full, font=font_monospace)
            
    # -------------------------------------------------------------
    # STYLE 3: VLOGGER DSLR HUD
    # -------------------------------------------------------------
    elif style == 'vlogger_dslr':
        # Focus AF Brackets in center
        if c_cfg.showCorners:
            box_w = int(220 * scale)
            box_h = int(140 * scale)
            sz = int(20 * scale)
            cx, cy = width // 2, height // 2
            x1, y1 = cx - box_w // 2, cy - box_h // 2
            x2, y2 = cx + box_w // 2, cy + box_h // 2
            
            # Top-left bracket
            draw.line([x1, y1 + sz, x1, y1], fill=color_main, width=2)
            draw.line([x1, y1, x1 + sz, y1], fill=color_main, width=2)
            # Top-right bracket
            draw.line([x2, y1 + sz, x2, y1], fill=color_main, width=2)
            draw.line([x2 - sz, y1, x2, y1], fill=color_main, width=2)
            # Bottom-left bracket
            draw.line([x1, y2 - sz, x1, y2], fill=color_main, width=2)
            draw.line([x1, y2, x1 + sz, y2], fill=color_main, width=2)
            # Bottom-right bracket
            draw.line([x2, y2 - sz, x2, y2], fill=color_main, width=2)
            draw.line([x2 - sz, y2, x2, y2], fill=color_main, width=2)
            
            # Center target brackets [ ]
            draw.line([cx - 10, cy - 6, cx - 10, cy + 6], fill=color_muted, width=1)
            draw.line([cx + 10, cy - 6, cx + 10, cy + 6], fill=color_muted, width=1)
            
        # Left side Exposure scale meter (EV)
        ex = padding + int(15 * scale)
        ey = height // 2
        eh = int(120 * scale)
        draw.line([ex, ey - eh // 2, ex, ey + eh // 2], fill=color_muted, width=1)
        # Tick marks
        for i in range(-2, 3):
            ty = ey + int(i * (eh // 4))
            draw.line([ex, ty, ex + int(6 * scale), ty], fill=color_muted, width=1)
            draw.text((ex + int(10 * scale), ty - int(7 * scale)), f"{'+' if i > 0 else ''}{i}", fill=color_muted, font=font_small)
        # Exposure marker cursor at 0.0 or +0.3
        draw.polygon([(ex - 8, ey), (ex - 2, ey - 4), (ex - 2, ey + 4)], fill=(239, 68, 68, 255))
        
        # DSLR parameters at the bottom
        if c_cfg.showRecText:
            draw.text((padding + int(20 * scale), height - padding - int(35 * scale)), "ISO 800  1/125s  F4.0", fill=color_full, font=font_monospace)
            
        if c_cfg.showBattery:
            # Vlog focus status
            draw.text((width - padding - int(150 * scale), height - padding - int(35 * scale)), "• AF-S [AUTO]", fill=(34, 197, 94, 255), font=font_monospace)
            
        if c_cfg.showTimecode:
            # Top center timecode
            draw.text((width // 2 - int(80 * scale), padding + int(15 * scale)), "0:02:14", fill=color_full, font=font_large)
            
    # -------------------------------------------------------------
    # STYLE 4: RETRO VHS CAMCORDER
    # -------------------------------------------------------------
    elif style == 'retro_vhs':
        # Draw typical block corners
        if c_cfg.showCorners:
            sz = int(30 * scale)
            draw.line([padding, padding, padding + sz, padding], fill=color_main, width=2)
            draw.line([padding, padding, padding, padding + sz], fill=color_main, width=2)
            draw.line([width - padding, padding, width - padding - sz, padding], fill=color_main, width=2)
            draw.line([width - padding, padding, width - padding, padding + sz], fill=color_main, width=2)
            draw.line([padding, height - padding, padding + sz, height - padding], fill=color_main, width=2)
            draw.line([padding, height - padding, padding, height - padding - sz], fill=color_main, width=2)
            draw.line([width - padding, height - padding, width - padding - sz, height - padding], fill=color_main, width=2)
            draw.line([width - padding, height - padding, width - padding, height - padding - sz], fill=color_main, width=2)
            
        # VHS playback text on top left
        if c_cfg.showRecText:
            rx = padding + int(20 * scale)
            ry = padding + int(15 * scale)
            draw.text((rx, ry), "PLAY ▶", fill=color_full, font=font_large)
            draw.text((rx, ry + int(32 * scale)), "SP 0:00:00", fill=color_muted, font=font_monospace)
            
        # Battery percentage on top right
        if c_cfg.showBattery:
            bx = width - padding - int(120 * scale)
            by = padding + int(15 * scale)
            draw.text((bx, by), "🔋 100%", fill=color_full, font=font_monospace)
            
        # Date and Timecode at the bottom (Standard retro orange or green or white block font)
        if c_cfg.showTimecode:
            # Bottom Left: Retro Date
            draw.text((padding + int(20 * scale), height - padding - int(60 * scale)), "MAY 31 2026", fill=color_full, font=font_large)
            # Bottom Right: Retro Time
            draw.text((width - padding - int(150 * scale), height - padding - int(60 * scale)), "12:00:15", fill=color_full, font=font_large)
            
        # Analog Glitch White Scanline Lines at the very bottom
        for ly in [height - padding + 5, height - padding + 12]:
            if ly < height:
                draw.line([padding + 10, ly, width - padding - 10, ly], fill=(255, 255, 255, 60), width=1)
                
    # Save image
    overlay_path = os.path.join(temp_dir, "camera_overlay.png")
    img.save(overlay_path)
    return overlay_path

# Draw single waveform frame
def draw_waveform_frame(
    width: int, height: int, amplitudes: List[int], frame_idx: int, config: RenderConfig,
    overlay_img_objs=None, active_overlay_by_frame=None, bounce_scales=None
) -> bytes:
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    w_cfg = config.waveform
    img_cfg = config.imageOverlay
    
    # Check if either is enabled, else return blank
    if not w_cfg.enabled and not (img_cfg.enabled and overlay_img_objs):
        return img.tobytes()
        
    global_max = max(amplitudes) if amplitudes else 32768.0
    if global_max < 1000.0:
        global_max = 1000.0
        
    # Helper 1: Draw dynamic, reactive bouncing overlay image in RAM
    def draw_overlay_to_canvas():
        if not img_cfg.enabled:
            return
            
        # Scale factors to map 1920x1080 coordinate space to actual video resolution
        scale_x = width / 1920.0
        scale_y = height / 1080.0
            
        # 1. Multiple simultaneous overlays
        overlay_mode = getattr(img_cfg, 'overlayMode', 'cycle')
        if overlay_mode == 'custom' and hasattr(img_cfg, 'items') and img_cfg.items:
            # overlay_img_objs is a dict map {item.id: Image}
            if not isinstance(overlay_img_objs, dict):
                return
            for item in img_cfg.items:
                if not item.enabled or item.id not in overlay_img_objs:
                    continue
                active_img = overlay_img_objs[item.id]
                
                # Scale width & height based on video resolution
                w = int(item.width * scale_x)
                h = int(item.height * scale_y)
                
                # Calculate dynamic bounce scale based on pre-computed spring-damping scales
                bounce_scale = 1.0
                if item.bounceEnabled:
                    if bounce_scales and frame_idx < len(bounce_scales):
                        bounce_scale = bounce_scales[frame_idx]
                    elif amplitudes and frame_idx < len(amplitudes):
                        current_amp = amplitudes[frame_idx]
                        bounce_scale = 1.0 + 0.15 * (current_amp / global_max)
                        
                new_w = max(1, int(w * bounce_scale))
                new_h = max(1, int(h * bounce_scale))
                
                # Crop and resize dynamically to preserve aspect ratio without stretching
                resized_img = ImageOps.fit(active_img, (new_w, new_h), Image.Resampling.BILINEAR)
                
                # Rotate image
                if item.rotation != 0:
                    resized_img = resized_img.rotate(-item.rotation, resample=Image.Resampling.BICUBIC, expand=True)
                    new_w, new_h = resized_img.size
                    
                # Scale center coordinates
                px = int(item.x * scale_x) - new_w // 2
                py = int(item.y * scale_y) - new_h // 2
                
                img.alpha_composite(resized_img, (px, py))
            return
            
        # 2. Fallback: single cycle overlay
        if not overlay_img_objs or not isinstance(overlay_img_objs, list):
            return
            
        img_idx = 0
        if active_overlay_by_frame and frame_idx < len(active_overlay_by_frame):
            img_idx = active_overlay_by_frame[frame_idx]
            
        if img_idx >= len(overlay_img_objs):
            img_idx = 0
            
        active_img = overlay_img_objs[img_idx]
        
        # Scale width & height based on video resolution
        w = int(img_cfg.width * scale_x)
        h = int(img_cfg.height * scale_y)
        
        # Calculate dynamic bounce scale based on pre-computed spring-damping scales
        bounce_scale = 1.0
        if img_cfg.bounceEnabled:
            if bounce_scales and frame_idx < len(bounce_scales):
                bounce_scale = bounce_scales[frame_idx]
            elif amplitudes and frame_idx < len(amplitudes):
                current_amp = amplitudes[frame_idx]
                bounce_scale = 1.0 + 0.15 * (current_amp / global_max)
            
        new_w = max(1, int(w * bounce_scale))
        new_h = max(1, int(h * bounce_scale))
        
        # Crop and scale dynamically in RAM using BILINEAR for high-speed rendering
        resized_img = ImageOps.fit(active_img, (new_w, new_h), Image.Resampling.BILINEAR)
        
        # Rotate image if rotation is set
        if img_cfg.rotation != 0:
            resized_img = resized_img.rotate(-img_cfg.rotation, resample=Image.Resampling.BICUBIC, expand=True)
            new_w, new_h = resized_img.size
            
        # Scale center coordinates
        px = int(img_cfg.x * scale_x) - new_w // 2
        py = int(img_cfg.y * scale_y) - new_h // 2
        
        # Composite RGBA clean frame
        img.alpha_composite(resized_img, (px, py))

    # Helper 2: Draw the waveform geometry
    def draw_waveform_geometry():
        if not w_cfg.enabled or not amplitudes:
            return
            
        # Use nonlocal to allow safe reassignment of the outer 'draw' object when SSAA is enabled
        nonlocal draw
        
        # Performance Mode: Set sf = 1.0 (Direct Drawing) for lightning-fast rendering (10x-15x speedup)
        # We draw directly on the main canvas with zero RAM/resize/composite overhead.
        sf = 1.0
        if sf == 1.0:
            super_img = img
        else:
            super_w, super_h = int(width * sf), int(height * sf)
            super_img = Image.new("RGBA", (super_w, super_h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(super_img)
        
        # Scale all geometrical parameters by the scale factor
        bars_count = w_cfg.barsCount
        bar_width = int(w_cfg.barWidth * sf)
        if bar_width < 1:
            bar_width = 1
        sensitivity = w_cfg.sensitivity
        max_height = int(w_cfg.maxHeight * sf)
        path_shape = w_cfg.path
        center_x = int(w_cfg.x * sf)
        center_y = int(w_cfg.y * sf)
        wf_width = int(w_cfg.width * sf)
        wf_height = int(w_cfg.height * sf)
        
        # 1. Get the smoothed amplitude of the current frame
        if 0 <= frame_idx < len(amplitudes):
            current_base_amp = amplitudes[frame_idx]
        else:
            current_base_amp = 0

        fps = config.render.fps if config.render.fps else 30
        # Scale time factor by 3.0 to perfectly match the preview's Date.now() * 0.003 (which is 3.0 * seconds)
        time_factor = (frame_idx / fps) * 3.0
        
        # 2. Synthesize identical spatial math as frontend preview for perfect parity and smoothness
        frame_amplitudes = []
        for i in range(bars_count):
            bell_curve = math.sin((math.pi * i) / (bars_count - 1)) if bars_count > 1 else 1.0
            
            if path_shape in ("circle", "square", "hexagon", "triangle", "rectangle"):
                # Seamless wrapping periodic mapping of the preview's smooth sines
                angle_factor = (i / bars_count) * 2 * math.pi if bars_count > 0 else 0.0
                jitter = 0.85 + 0.15 * math.sin(time_factor * 0.8 + angle_factor * 3.0)
                raw_amp = 0.2 + 0.6 * math.sin(time_factor + angle_factor) * (0.8 + 0.2 * math.sin(time_factor * 2.5 + angle_factor * 2.0))
            else:
                # Direct match of frontend linear formulas
                jitter = 0.85 + 0.15 * math.sin(time_factor * 0.8 + i * 0.6)
                raw_amp = 0.2 + 0.6 * math.sin(time_factor + i * 0.06) * (0.8 + 0.2 * math.sin(time_factor * 2.5 + i * 0.15))
            
            # Combine to get clean undulating factor
            spatial_factor = max(0.05, raw_amp * jitter)
            
            # Linear/vertical shapes apply bell curve to taper off at the boundaries
            if path_shape in ("linear", "vertical", "custom"):
                spatial_factor *= bell_curve
            
            # Height scales with the real-time audio amplitude peak
            bar_amp = current_base_amp * spatial_factor
            frame_amplitudes.append(int(bar_amp))

        # 3. Spatial smoothing to prevent sudden local spikes
        spatial_smoothed = []
        for i in range(bars_count):
            neighbors = []
            for offset in (-2, -1, 0, 1, 2):
                neighbor_idx = i + offset
                if path_shape in ("circle", "square", "hexagon", "triangle", "rectangle"):
                    neighbor_idx = neighbor_idx % bars_count
                    neighbors.append(frame_amplitudes[neighbor_idx])
                else:
                    if 0 <= neighbor_idx < bars_count:
                        neighbors.append(frame_amplitudes[neighbor_idx])
            spatial_smoothed.append(int(sum(neighbors) / len(neighbors)))
        frame_amplitudes = spatial_smoothed

        # 4. Apply a bell curve only to open paths (linear, vertical, custom) to prevent lopsidedness on closed shapes!
        if path_shape in ("linear", "vertical", "custom"):
            for i in range(bars_count):
                bell_curve = math.sin((math.pi * i) / (bars_count - 1)) if bars_count > 1 else 1.0
                frame_amplitudes[i] = int(frame_amplitudes[i] * bell_curve)
            
        def parse_hex_color(hex_str: str) -> tuple:
            hex_str = hex_str.strip('#')
            if len(hex_str) == 6:
                r = int(hex_str[0:2], 16)
                g = int(hex_str[2:4], 16)
                b = int(hex_str[4:6], 16)
                return (r, g, b, 255)
            return (99, 102, 241, 255)

        def interpolate_color(color1: tuple, color2: tuple, factor: float) -> tuple:
            r = int(color1[0] + factor * (color2[0] - color1[0]))
            g = int(color1[1] + factor * (color2[1] - color1[1]))
            b = int(color1[2] + factor * (color2[2] - color1[2]))
            return (r, g, b, 255)

        c_fill = parse_hex_color(w_cfg.fillColor) if w_cfg.fillColor else (99, 102, 241, 255)
        c_line = parse_hex_color(w_cfg.lineColor) if w_cfg.lineColor else (255, 255, 255, 255)
        c_grad_start = parse_hex_color(w_cfg.gradientStart) if w_cfg.gradientStart else (129, 140, 248, 255)
        c_grad_end = parse_hex_color(w_cfg.gradientEnd) if w_cfg.gradientEnd else (79, 70, 229, 255)
            
        is_flipped = getattr(w_cfg, 'flip', False)
            
        if path_shape == "linear":
            start_x_local = -wf_width // 2
            step = wf_width / bars_count if bars_count > 0 else 1.0
            rad = w_cfg.rotation * math.pi / 180.0
            cos_r = math.cos(rad)
            sin_r = math.sin(rad)
            
            for i, amp in enumerate(frame_amplitudes):
                factor = i / (bars_count - 1) if bars_count > 1 else 0.0
                if w_cfg.gradientEnabled:
                    bar_color = interpolate_color(c_grad_start, c_grad_end, factor)
                    mirror_color = bar_color
                else:
                    bar_color = c_line
                    mirror_color = c_fill

                h_bar = int((amp / global_max) * sensitivity * max_height * 0.72)
                h_bar = max(4, min(max_height, h_bar))
                
                lx = start_x_local + i * step
                ly = 0.0
                dy = 1.0 if is_flipped else -1.0
                
                if w_cfg.mirror:
                    ly1 = - (h_bar / 2) * dy
                    ly2 = (h_bar / 2) * dy
                    rx1 = lx * cos_r - ly1 * sin_r
                    ry1 = lx * sin_r + ly1 * cos_r
                    rx2 = lx * cos_r - ly2 * sin_r
                    ry2 = lx * sin_r + ly2 * cos_r
                    draw.line([center_x + rx1, center_y + ry1, center_x + rx2, center_y + ry2], fill=mirror_color, width=bar_width)
                else:
                    ly1 = ly
                    ly2 = ly + h_bar * dy
                    rx1 = lx * cos_r - ly1 * sin_r
                    ry1 = lx * sin_r + ly1 * cos_r
                    rx2 = lx * cos_r - ly2 * sin_r
                    ry2 = lx * sin_r + ly2 * cos_r
                    draw.line([center_x + rx1, center_y + ry1, center_x + rx2, center_y + ry2], fill=bar_color, width=bar_width)
                    
            if w_cfg.showBaseline:
                lx1 = -wf_width // 2
                lx2 = wf_width // 2
                rx1 = lx1 * cos_r
                ry1 = lx1 * sin_r
                rx2 = lx2 * cos_r
                ry2 = lx2 * sin_r
                draw.line([center_x + rx1, center_y + ry1, center_x + rx2, center_y + ry2], fill=c_line, width=2)
                
        elif path_shape == "vertical":
            start_y_local = -wf_height // 2
            step = wf_height / bars_count if bars_count > 0 else 1.0
            rad = w_cfg.rotation * math.pi / 180.0
            cos_r = math.cos(rad)
            sin_r = math.sin(rad)
            
            for i, amp in enumerate(frame_amplitudes):
                factor = i / (bars_count - 1) if bars_count > 1 else 0.0
                if w_cfg.gradientEnabled:
                    bar_color = interpolate_color(c_grad_start, c_grad_end, factor)
                    mirror_color = bar_color
                else:
                    bar_color = c_line
                    mirror_color = c_fill

                h_bar = int((amp / global_max) * sensitivity * max_height * 0.72)
                h_bar = max(4, min(max_height, h_bar))
                
                lx = 0.0
                ly = start_y_local + i * step
                dx = -1.0 if is_flipped else 1.0
                
                if w_cfg.mirror:
                    lx1 = - (h_bar / 2) * dx
                    lx2 = (h_bar / 2) * dx
                    rx1 = lx1 * cos_r - ly * sin_r
                    ry1 = lx1 * sin_r + ly * cos_r
                    rx2 = lx2 * cos_r - ly * sin_r
                    ry2 = lx2 * sin_r + ly * cos_r
                    draw.line([center_x + rx1, center_y + ry1, center_x + rx2, center_y + ry2], fill=mirror_color, width=bar_width)
                else:
                    lx1 = lx
                    lx2 = lx + h_bar * dx
                    rx1 = lx1 * cos_r - ly * sin_r
                    ry1 = lx1 * sin_r + ly * cos_r
                    rx2 = lx2 * cos_r - ly * sin_r
                    ry2 = lx2 * sin_r + ly * cos_r
                    draw.line([center_x + rx1, center_y + ry1, center_x + rx2, center_y + ry2], fill=bar_color, width=bar_width)
                    
            if w_cfg.showBaseline:
                ly1 = -wf_height // 2
                ly2 = wf_height // 2
                rx1 = -ly1 * sin_r
                ry1 = ly1 * cos_r
                rx2 = -ly2 * sin_r
                ry2 = ly2 * cos_r
                draw.line([center_x + rx1, center_y + ry1, center_x + rx2, center_y + ry2], fill=c_line, width=2)
                
        elif path_shape in ("circle", "square", "hexagon", "triangle", "rectangle"):
            radius = min(wf_width, wf_height) // 2
            direction = -1.0 if is_flipped else 1.0
            for i, amp in enumerate(frame_amplitudes):
                factor = i / (bars_count - 1) if bars_count > 1 else 0.0
                if w_cfg.gradientEnabled:
                    bar_color = interpolate_color(c_grad_start, c_grad_end, factor)
                    mirror_color = bar_color
                else:
                    bar_color = c_line
                    mirror_color = c_fill

                angle = (i / bars_count) * 2 * math.pi + (w_cfg.rotation * math.pi / 180.0)
                h_bar = int((amp / global_max) * sensitivity * max_height * 0.72)
                h_bar = max(4, min(max_height, h_bar))
                
                if path_shape == "circle":
                    sx = center_x + radius * math.cos(angle)
                    sy = center_y + radius * math.sin(angle)
                elif path_shape == "square":
                    cos_a, sin_a = math.cos(angle), math.sin(angle)
                    scale = 1.0 / max(abs(cos_a), abs(sin_a)) if max(abs(cos_a), abs(sin_a)) > 0 else 1.0
                    sx = center_x + radius * cos_a * scale
                    sy = center_y + radius * sin_a * scale
                elif path_shape == "hexagon":
                    cos_a, sin_a = math.cos(angle), math.sin(angle)
                    deg_60 = math.pi / 3
                    segment = math.floor(angle / deg_60)
                    a_segment = angle - (segment + 0.5) * deg_60
                    scale = math.cos(deg_60 / 2) / math.cos(a_segment) if math.cos(a_segment) > 0 else 1.0
                    sx = center_x + radius * cos_a * scale
                    sy = center_y + radius * sin_a * scale
                else:
                    sx = center_x + radius * math.cos(angle)
                    sy = center_y + radius * math.sin(angle)
                    
                ex = sx + direction * h_bar * math.cos(angle)
                ey = sy + direction * h_bar * math.sin(angle)
                
                if w_cfg.mirror:
                    isx = sx - direction * (h_bar // 2) * math.cos(angle)
                    iex = sx + direction * (h_bar // 2) * math.cos(angle)
                    isy = sy - direction * (h_bar // 2) * math.sin(angle)
                    iey = sy + direction * (h_bar // 2) * math.sin(angle)
                    draw.line([isx, isy, iex, iey], fill=mirror_color, width=bar_width)
                else:
                    draw.line([sx, sy, ex, ey], fill=bar_color, width=bar_width)

        elif path_shape == "custom":
            start_x_local = -wf_width // 2
            step = wf_width / bars_count if bars_count > 0 else 1.0
            fps = config.render.fps if config.render.fps else 30
            t_val = frame_idx / fps
            rad = w_cfg.rotation * math.pi / 180.0
            cos_r = math.cos(rad)
            sin_r = math.sin(rad)
            
            for i, amp in enumerate(frame_amplitudes):
                factor = i / (bars_count - 1) if bars_count > 1 else 0.0
                if w_cfg.gradientEnabled:
                    bar_color = interpolate_color(c_grad_start, c_grad_end, factor)
                    mirror_color = bar_color
                else:
                    bar_color = c_line
                    mirror_color = c_fill

                h_bar = int((amp / global_max) * sensitivity * max_height * 0.72)
                h_bar = max(4, min(max_height, h_bar))
                
                lx = start_x_local + i * step
                ly = int(20.0 * sf) * math.sin((i / bars_count) * 4.0 * math.pi + t_val * 1.8)
                dy = 1.0 if is_flipped else -1.0
                
                if w_cfg.mirror:
                    ly1 = ly - (h_bar / 2) * dy
                    ly2 = ly + (h_bar / 2) * dy
                    rx1 = lx * cos_r - ly1 * sin_r
                    ry1 = lx * sin_r + ly1 * cos_r
                    rx2 = lx * cos_r - ly2 * sin_r
                    ry2 = lx * sin_r + ly2 * cos_r
                    draw.line([center_x + rx1, center_y + ry1, center_x + rx2, center_y + ry2], fill=mirror_color, width=bar_width)
                else:
                    ly1 = ly
                    ly2 = ly + h_bar * dy
                    rx1 = lx * cos_r - ly1 * sin_r
                    ry1 = lx * sin_r + ly1 * cos_r
                    rx2 = lx * cos_r - ly2 * sin_r
                    ry2 = lx * sin_r + ly2 * cos_r
                    draw.line([center_x + rx1, center_y + ry1, center_x + rx2, center_y + ry2], fill=bar_color, width=bar_width)

        if sf != 1.0:
            # Downscale using BILINEAR back to target resolution for high-speed, perfect anti-aliasing
            smoothed_geometry_img = super_img.resize((width, height), Image.Resampling.BILINEAR)
            # External reference 'img' represents the base canvas we composite onto
            img.alpha_composite(smoothed_geometry_img)

    # Perform Z-indexed rendering
    layer_order = getattr(w_cfg, 'layerOrder', 'waveform_on_top')
    if layer_order == 'image_on_top':
        draw_waveform_geometry()
        draw_overlay_to_canvas()
    else:
        draw_overlay_to_canvas()
        draw_waveform_geometry()
        
    return img.tobytes()
                
    return img.tobytes()

def render_video(config: RenderConfig, progress_callback: Callable[[int, str], None]) -> str:
    # ----------------------------------------------------
    # BƯỚC 0: Khởi tạo GPU + Temp directory inside workspace
    # ----------------------------------------------------
    progress_callback(5, "Đang thiết lập môi trường và cấu hình GPU chuyên nghiệp...")
    temp_dir = tempfile.mkdtemp(prefix="video_merger_", dir=os.getcwd())
    
    try:
        return _render_video_impl(config, progress_callback, temp_dir)
    finally:
        # Cleanup temp directory and ASS subtitles on any success or failure (leak-proof)
        try:
            for f in os.listdir(os.getcwd()):
                if f.startswith("temp_subtitles_") and f.endswith(".ass"):
                    try:
                        os.remove(f)
                    except Exception:
                        pass
        except Exception:
            pass
        try:
            if os.path.exists(temp_dir):
                for f in os.listdir(temp_dir):
                    os.remove(os.path.join(temp_dir, f))
                os.rmdir(temp_dir)
        except Exception as e:
            print(f"Error cleaning up temp directory: {e}")

def _render_video_impl(config: RenderConfig, progress_callback: Callable[[int, str], None], temp_dir: str) -> str:
    
    # ----------------------------------------------------
    # BƯỚC 1: Kiểm tra tệp tin giọng đọc chính qua FFprobe
    # ----------------------------------------------------
    voice_path = config.media.voiceFile
    if not os.path.exists(voice_path):
        raise FileNotFoundError(f"Không tìm thấy tệp giọng đọc: {voice_path}")
        
    progress_callback(15, f"Xác nhận tệp tin giọng đọc: {os.path.basename(voice_path)}. Đang trích xuất thời lượng...")
    voice_duration = get_media_duration(voice_path)
    if voice_duration <= 0:
        raise ValueError("Không thể lấy thời lượng của tệp giọng đọc. File bị lỗi hoặc trống.")
        
    progress_callback(20, f"Đã tìm thấy tệp giọng nói! Thời lượng: {voice_duration:.2f} giây.")
    
    # ----------------------------------------------------
    # BƯỚC 2: Trộn giọng đọc và nhạc nền (Audio Mixing)
    # ----------------------------------------------------
    progress_callback(25, "Đang thực hiện trộn âm thanh giọng đọc với nhạc nền...")
    mixed_audio_path = os.path.join(temp_dir, "mixed_audio.wav")
    
    music_files = config.media.musicFiles
    music_volume = getattr(config, 'musicVolume', 0.5)
    if music_volume is None:
        music_volume = 0.5
        
    voice_volume = getattr(config, 'voiceVolume', 1.0)
    if voice_volume is None:
        voice_volume = 1.0
        
    music_loop = getattr(config, 'musicLoop', True)
    if music_loop is None:
        music_loop = True
        
    music_duration = getattr(config, 'musicDuration', 0.0)
    if music_duration is None:
        music_duration = 0.0
    
    if music_files and os.path.exists(music_files[0]):
        music_path = music_files[0]
        # Filter complex to scale music volume and mix (with optional duration trim)
        if music_duration > 0:
            filter_complex = f"[0:a]volume={voice_volume}[voice];[1:a]atrim=end={music_duration},volume={music_volume}[bg];[voice][bg]amix=inputs=2:duration=first:dropout_transition=2[out]"
        else:
            filter_complex = f"[0:a]volume={voice_volume}[voice];[1:a]volume={music_volume}[bg];[voice][bg]amix=inputs=2:duration=first:dropout_transition=2[out]"
            
        cmd_mix = ["ffmpeg", "-y", "-i", voice_path]
        if music_loop:
            cmd_mix += ["-stream_loop", "-1"]  # Lặp nhạc nền vô hạn theo độ dài giọng đọc
            
        cmd_mix += [
            "-i", music_path,
            "-filter_complex", filter_complex,
            "-map", "[out]",
            "-ac", "1",
            "-ar", "44100",
            mixed_audio_path
        ]
        progress_callback(28, f"Sử dụng nhạc nền: {os.path.basename(music_path)} (Âm lượng: {int(music_volume*100)}%, Giọng đọc: {int(voice_volume*100)}%)...")
        subprocess.run(cmd_mix, capture_output=True, check=True)
    else:
        # Just convert voice to standard 44.1kHz wav for analysis and scale voice volume
        cmd_convert = [
            "ffmpeg", "-y",
            "-i", voice_path,
            "-filter_complex", f"[0:a]volume={voice_volume}[out]",
            "-map", "[out]",
            "-ac", "1",
            "-ar", "44100",
            mixed_audio_path
        ]
        progress_callback(28, f"Không sử dụng nhạc nền. Thực hiện điều chỉnh âm lượng giọng chính ({int(voice_volume*100)}%) và chuẩn hóa...")
        subprocess.run(cmd_convert, capture_output=True, check=True)
        
    # Phân tích tách kênh thông minh: Trích xuất độc lập biên độ của Giọng đọc chính và Nhạc nền
    progress_callback(32, "Đang trích xuất và tối ưu hóa biên độ sóng âm đa luồng...")
    fps = config.render.fps if config.render.fps else 30
    
    # 1. Trích xuất biên độ giọng nói
    voice_amps = extract_amplitude_samples(voice_path, fps=fps)
    
    # 2. Trích xuất biên độ nhạc nền (nếu có)
    music_amps = []
    if music_files and os.path.exists(music_files[0]):
        music_amps = extract_amplitude_samples(music_files[0], fps=fps)
        
    # 3. Chuẩn hóa độc lập giọng nói về thang đo [0.0, 1.0]
    if voice_amps:
        max_v = max(voice_amps) if max(voice_amps) > 0 else 1.0
        voice_norm = [v / max_v for v in voice_amps]
    else:
        voice_norm = []
        
    # 4. Chuẩn hóa độc lập nhạc nền về thang đo [0.0, 1.0]
    if music_amps:
        max_m = max(music_amps) if max(music_amps) > 0 else 1.0
        music_norm = [m / max_m for m in music_amps]
    else:
        music_norm = []
        
    # 5. Dựng chuỗi biên độ kết hợp cực nhạy theo cấu hình `source`
    total_frames = int(voice_duration * fps)
    amplitudes = []
    wf_source = getattr(config.waveform, 'source', 'mixed')
    
    for i in range(total_frames + 100):  # Đệm thêm khung hình để tránh lỗi tràn chỉ mục
        # Lấy giá trị giọng nói
        v_val = voice_norm[i] if i < len(voice_norm) else 0.0
        
        # Lấy giá trị nhạc nền (lặp tuần hoàn nhạc nếu nhạc ngắn hơn giọng đọc)
        m_val = 0.0
        if music_norm:
            m_idx = i % len(music_norm)
            m_val = music_norm[m_idx]
            
        # Áp dụng công thức trộn sóng
        if wf_source == 'voice':
            combined_val = v_val
        elif wf_source == 'music':
            combined_val = m_val
        else: # 'mixed' (Trộn thông minh: giọng nói 85%, nhạc nền giữ nhịp 45%)
            combined_val = v_val * 0.85 + m_val * 0.45
            
        # Scale về tầm 20000 để duy trì tính tương thích ngược hoàn hảo với backend draw
        amplitudes.append(int(combined_val * 20000))
        
    # 1. Áp dụng bộ lọc bao biên độ động học (Inertial Envelope Filter) để sóng nhảy nhạy bén và mượt mà như bơ
    smoothed_envelope_amps = []
    current_val = 0.0
    wf_attack = 0.5   # Attack cực nhanh theo nhịp bass
    wf_decay = 0.12   # Decay trượt xuống mềm mại không răng cưa
    for amp in amplitudes:
        if amp > current_val:
            current_val += (amp - current_val) * wf_attack
        else:
            current_val -= (current_val - amp) * wf_decay
        smoothed_envelope_amps.append(int(current_val))
    amplitudes = smoothed_envelope_amps

    # 2. Tính toán trước dải Bounce Scale lò xo (Spring-Damped Elastic Bounce Envelope) siêu mượt cho ảnh phủ
    global_max = max(amplitudes) if amplitudes else 20000.0
    if global_max < 1000.0:
        global_max = 1000.0
        
    bounce_scales = []
    current_scale = 1.0
    bounce_attack = 0.65
    bounce_decay = 0.10
    for amp in amplitudes:
        normalized_amp = amp / global_max
        target_scale = 1.0 + 0.15 * normalized_amp
        if target_scale > current_scale:
            current_scale += (target_scale - current_scale) * bounce_attack
        else:
            current_scale -= (current_scale - target_scale) * bounce_decay
        bounce_scales.append(current_scale)
    
    # ----------------------------------------------------
    # BƯỚC 3: Xử lý video nền (Background Loops)
    # ----------------------------------------------------
    progress_callback(35, "Đang thiết lập luồng video nền lặp vô hạn...")
    bg_videos = config.media.backgroundVideos
    
    bg_video_path = None
    if bg_videos and os.path.exists(bg_videos[0]):
        bg_video_path = bg_videos[0]
        progress_callback(38, f"Sử dụng video nền: {os.path.basename(bg_video_path)}")
    else:
        progress_callback(38, "Không tìm thấy video nền. Sử dụng nền đen chuẩn HD...")
        
    # ----------------------------------------------------
    # BƯỚC 4: Vẽ các mặt nạ ảnh phủ (Overlay image shapes) & Camera HUD bằng Pillow
    # ----------------------------------------------------
    res_str = config.render.resolution if config.render.resolution else "1920x1080"
    try:
        res_w, res_h = map(int, res_str.split("x"))
    except Exception:
        res_w, res_h = 1920, 1080
        
    overlay_img_objs = {}
    active_overlay_by_frame = []
    
    # Check if we are using custom layout mode
    overlay_mode = getattr(config.imageOverlay, 'overlayMode', 'cycle')
    
    if overlay_mode == 'custom' and hasattr(config.imageOverlay, 'items') and config.imageOverlay.items and config.imageOverlay.enabled:
        progress_callback(45, f"Áp dụng mặt nạ cắt lên từng ảnh phủ trong danh sách...")
        overlay_img_objs = {} # dict mapping item.id -> PIL Image
        for item in config.imageOverlay.items:
            if not item.enabled:
                continue
            img_path = item.imagePath
            if img_path and os.path.exists(img_path):
                try:
                    proc_path = process_image_overlay(img_path, item, temp_dir)
                    overlay_img_objs[item.id] = Image.open(proc_path).convert("RGBA")
                except Exception as e:
                    print(f"Error processing multiple overlay item {item.id}: {e}")
    else:
        # Fallback to single cycle overlay
        overlay_images = config.media.overlayImages
        processed_overlay_paths = []
        if overlay_images and config.imageOverlay.enabled:
            progress_callback(45, f"Áp dụng mặt nạ hình {config.imageOverlay.maskShape} lên các tệp ảnh phủ...")
            for img_path in overlay_images:
                if img_path and os.path.exists(img_path):
                    try:
                        proc_path = process_image_overlay(img_path, config.imageOverlay, temp_dir)
                        processed_overlay_paths.append(proc_path)
                    except Exception as e:
                        print(f"Error processing fallback overlay {img_path}: {e}")
            
        overlay_img_list = []
        if processed_overlay_paths:
            for path in processed_overlay_paths:
                try:
                    overlay_img_list.append(Image.open(path).convert("RGBA"))
                except Exception as e:
                    print(f"Error loading overlay image {path} into RAM: {e}")
                    
        overlay_img_objs = overlay_img_list # list mapping to original variable
        
        # Pre-compute the active overlay index for each frame
        if overlay_img_objs:
            if len(processed_overlay_paths) == 1:
                active_overlay_by_frame = [0] * (total_frames + 100)
            else:
                swap_interval = getattr(config.imageOverlay, 'imageDuration', 5.0)
                if swap_interval is None or swap_interval <= 0:
                    swap_interval = 5.0
                num_intervals = math.ceil(voice_duration / swap_interval)
                indices = list(range(len(processed_overlay_paths)))
                
                random_order = getattr(config.imageOverlay, 'randomImageOrder', False)
                if random_order:
                    seed_val = sum(ord(c) for c in config.media.outputFilename) if config.media.outputFilename else 42
                    rng = random.Random(seed_val)
                    interval_indices = [rng.choice(indices) for _ in range(num_intervals)]
                else:
                    interval_indices = [i % len(processed_overlay_paths) for i in range(num_intervals)]
                    
                for f_idx in range(total_frames + 100):
                    t_val = f_idx / fps
                    interval_idx = int(t_val // swap_interval)
                    interval_idx = min(interval_idx, num_intervals - 1)
                    active_overlay_by_frame.append(interval_indices[interval_idx])
        
    progress_callback(50, "Đang vẽ giao diện ghi hình kỹ thuật số (Camera Overlays)...")
    camera_overlay_path = draw_camera_overlay(res_w, res_h, config, temp_dir)
    
    # ----------------------------------------------------
    # BƯỚC 5: Thiết lập danh sách tham số đầu vào cho FFmpeg với index đếm chuẩn
    # ----------------------------------------------------
    progress_callback(55, "Đang liên kết các luồng dữ liệu truyền dẫn...")
    
    # Dynamic inputs array and accurate index tracker
    ffmpeg_inputs = []
    input_counter = 0
    
    # Input 0: Background video loop (or black color canvas)
    if bg_video_path:
        ffmpeg_inputs += ["-stream_loop", "-1", "-i", bg_video_path]
    else:
        ffmpeg_inputs += ["-f", "lavfi", "-i", f"color=c=black:s={res_w}x{res_h}:r={fps}"]
    bg_index = input_counter
    input_counter += 1
        
    # Input 1: Mixed audio file
    ffmpeg_inputs += ["-i", mixed_audio_path]
    audio_index = input_counter
    input_counter += 1
    
    # Input 2: Waveform raw RGBA video pipe stream
    ffmpeg_inputs += ["-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{res_w}x{res_h}", "-r", str(fps), "-i", "-"]
    wave_index = input_counter
    input_counter += 1
    
    # Input 3: Processed overlay images (if present) - DEPRECATED: Drawn in Pillow for high-fidelity audio-reactive bounce
    overlay_start_index = -1
        
    # Input 4: Camera overlay image (if present)
    camera_index = -1
    if config.camera.enabled:
        ffmpeg_inputs += ["-i", camera_overlay_path]
        camera_index = input_counter
        input_counter += 1
        
    # ----------------------------------------------------
    # BƯỚC 6: Xây dựng filter_complex đồ họa tối ưu
    # ----------------------------------------------------
    progress_callback(65, "Đang biên dịch chuỗi bộ lọc filter_complex kết xuất...")
    
    filter_parts = []
    
    # 1. Scale background video to target resolution, reset SAR to 1:1, and apply smooth blur
    blur_percent = config.background.blurPercent
    # Scale blur radius relative to target resolution and boxblur power to match Web Gaussian blur perfectly
    blur_radius = max(1, int((blur_percent / 100.0) * (res_w / 1024.0) * 25)) if blur_percent > 0 else 0
    
    # Reset Sample Aspect Ratio (SAR) to 1:1 to prevent anamorphic stretching of background and overlays
    bg_filter = f"[0:v]setsar=1,scale={res_w}:{res_h}:force_original_aspect_ratio=decrease:flags=lanczos,pad={res_w}:{res_h}:(ow-iw)/2:(oh-ih)/2"
    if blur_radius > 0:
        bg_filter += f",boxblur=luma_radius={blur_radius}:luma_power=3"
    else:
        # High quality sharpening pass only when background is not blurred to make it pop
        bg_filter += ",unsharp=luma_msize_x=5:luma_msize_y=5:luma_amount=0.25"
    bg_filter += "[bg_scaled]"
    filter_parts.append(bg_filter)
    
    # 2 & 3. Overlay Waveform (which already contains pre-composited, bouncing image overlays from Pillow!)
    filter_parts.append(f"[bg_scaled][{wave_index}:v]overlay=0:0[v_wave]")
    current_v_label = "[v_wave]"
        
    # 4. Overlay Camera Frame HUD
    if config.camera.enabled and camera_index != -1:
        filter_parts.append(f"{current_v_label}[{camera_index}:v]overlay=0:0[v_camera]")
        current_v_label = "[v_camera]"
        
    # 5. Build Subtitles ASS Overlay
    ass_subtitles_path = None
    job_rand = "".join(random.choices("abcdefghijklmnopqrstuvwxyz0123456789", k=8))
    
    if config.subtitles.enabled:
        progress_callback(68, "Đang thiết lập luồng phụ đề ASS chuyên dụng...")
        
        sub_file = getattr(config.subtitles, 'subtitleFile', '')
        if sub_file and os.path.exists(sub_file):
            progress_callback(69, f"Phát hiện tệp phụ đề SRT: {os.path.basename(sub_file)}. Đang chuyển đổi sang định dạng ASS có hiệu ứng động...")
            ass_subtitles_path = create_ass_subtitles_from_srt(sub_file, config, job_rand)
        else:
            # Create subtitle file inside active directory (flat path to avoid Windows quotes)
            ass_subtitles_path = create_ass_subtitles(config.subtitles.previewText, voice_duration, config, job_rand)
        
        # Safe relative path without colon or backslashes
        filter_parts.append(f"{current_v_label}subtitles={ass_subtitles_path}[v_final]")
        current_v_label = "[v_final]"
        
    filter_complex_str = ";".join(filter_parts)
    
    # Determine video encoder
    has_nvenc = False
    try:
        chk = subprocess.run(["ffmpeg", "-encoders"], capture_output=True, text=True)
        if "h264_nvenc" in chk.stdout:
            has_nvenc = True
    except Exception:
        pass
        
    encoder = "libx264"
    if config.render.encoder == "h264_nvenc" or (config.render.encoder == "auto" and has_nvenc):
        encoder = "h264_nvenc"
        
    # Build complete FFmpeg process call
    output_filename = config.media.outputFilename
    # Ensure parent output directory exists
    parent_out_dir = os.path.dirname(os.path.abspath(output_filename))
    if parent_out_dir:
        os.makedirs(parent_out_dir, exist_ok=True)
        
    # Cấu hình chất lượng video đầu ra để sắc nét nhất có thể (bitrate cực cao, crf thấp, preset tối ưu)
    bitrate = config.render.bitrate if config.render.bitrate else "12M"
    quality_params = []
    if encoder == "h264_nvenc":
        quality_params += [
            "-b:v", bitrate,
            "-preset", "p5",       # Pristine quality preset
            "-profile:v", "high"
        ]
    else:
        quality_params += [
            "-b:v", bitrate,
            "-crf", "16",          # Lower CRF value (16) ensures pristine visually lossless quality
            "-preset", "veryfast"  # Veryfast software encoding speedup (3x-5x faster than 'medium')
        ]
        
    threads_val = "0"
    if hasattr(config.render, 'cpuThreads') and config.render.cpuThreads != "auto":
        threads_val = str(config.render.cpuThreads)

    cmd_render = [
        "ffmpeg", "-y"
    ] + ffmpeg_inputs + [
        "-filter_complex", filter_complex_str,
        "-map", current_v_label,
        "-map", "1:a",
        "-c:v", encoder,
    ] + quality_params + [
        "-threads", threads_val,   # Direct multi-threading to use all available CPU cores
        "-r", str(fps),            # Ràng buộc số khung hình đầu ra chuẩn theo cấu hình
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        "-t", f"{voice_duration:.3f}",
        "-shortest",
        output_filename
    ]
    
    # ----------------------------------------------------
    # BƯỚC 7: Khởi chạy luồng ghi sóng âm pipe và FFmpeg
    # ----------------------------------------------------
    progress_callback(75, "Khởi chạy tiến trình FFmpeg và Daemon truyền khung hình...")
    
    proc = subprocess.Popen(
        cmd_render,
        stdin=subprocess.PIPE,
        stderr=subprocess.PIPE,
        stdout=subprocess.PIPE
    )
    
    # Thread-safe logs accumulator to retain accurate logs upon failure
    ffmpeg_logs = []
    
    # Read output asynchronously using a daemon thread to avoid pipe blocks
    def monitor_ffmpeg_progress(proc, duration, callback):
        while True:
            line = proc.stderr.readline()
            if not line:
                break
            line_str = line.decode('utf-8', errors='replace').strip()
            if line_str:
                ffmpeg_logs.append(line_str)
                # Keep last 50 lines to avoid high RAM use
                if len(ffmpeg_logs) > 50:
                    ffmpeg_logs.pop(0)
                    
                if "time=" in line_str:
                    try:
                        parts = line_str.split("time=")
                        if len(parts) > 1:
                            time_part = parts[1].split()[0]
                            t_parts = time_part.split(":")
                            if len(t_parts) == 3:
                                h, m, s = float(t_parts[0]), float(t_parts[1]), float(t_parts[2])
                                elapsed = h * 3600 + m * 60 + s
                                pct = 90 + int((elapsed / duration) * 8)
                                pct = max(90, min(98, pct))
                                callback(pct, f"Đang đóng gói và mã hóa video: {time_part} / {duration:.1f}s ({int(elapsed/duration*100)}%)...")
                    except Exception:
                        pass
                    
    progress_thread = threading.Thread(
        target=monitor_ffmpeg_progress,
        args=(proc, voice_duration, progress_callback),
        daemon=True
    )
    progress_thread.start()
    
    # ----------------------------------------------------
    # BƯỚC 8: Chạy luồng sinh sóng âm frame-by-frame ghi vào pipe stdin (Truyền thêm bộ đệm ảnh phủ giật nảy)
    # ----------------------------------------------------
    total_frames = int(voice_duration * fps)
    progress_callback(80, f"Đang tiến hành vẽ {total_frames} khung hình sóng âm trực tiếp...")
    
    try:
        for f_idx in range(total_frames):
            frame_bytes = draw_waveform_frame(
                res_w, res_h, amplitudes, f_idx, config,
                overlay_img_objs=overlay_img_objs,
                active_overlay_by_frame=active_overlay_by_frame,
                bounce_scales=bounce_scales
            )
            proc.stdin.write(frame_bytes)
            proc.stdin.flush()
            
            # Update progress dynamically every 100 frames to show real-time activity
            if f_idx % 100 == 0 or f_idx == total_frames - 1:
                pct_draw = 80 + int((f_idx / total_frames) * 10)
                progress_callback(pct_draw, f"Đang tiến hành dựng sóng âm: {f_idx}/{total_frames} khung hình ({int(f_idx/total_frames*100)}%)...")
    except (BrokenPipeError, OSError):
        # Stdin pipe broken (FFmpeg finished or crashed prematurely)
        pass
    finally:
        try:
            proc.stdin.close()
        except Exception:
            pass
            
    # Wait for completion
    proc.wait()
    
    # If error occurred, throw accumulator logs
    if proc.returncode != 0:
        err_msg = "\n".join(ffmpeg_logs)
        raise RuntimeError(f"FFmpeg failed with code {proc.returncode}. Log:\n{err_msg}")
        
    # ----------------------------------------------------
    # BƯỚC 9: Dọn dẹp tệp tin đệm an toàn
    # ----------------------------------------------------
    progress_callback(95, "Đang dọn dẹp các phân đoạn tệp đệm và ảnh phủ tạm thời...")
    try:
        if ass_subtitles_path and os.path.exists(ass_subtitles_path):
            os.remove(ass_subtitles_path)
    except Exception:
        pass
    try:
        for f in os.listdir(temp_dir):
            os.remove(os.path.join(temp_dir, f))
        os.rmdir(temp_dir)
    except Exception as e:
        print(f"Error cleaning up temp directory: {e}")
        
    # ----------------------------------------------------
    # BƯỚC 10: Hoàn tất
    # ----------------------------------------------------
    out_abspath = os.path.abspath(output_filename)
    progress_callback(100, f"Hoàn tất kết xuất video thành công! Tệp tin đầu ra được xuất tại: {out_abspath}")
    
    return out_abspath
