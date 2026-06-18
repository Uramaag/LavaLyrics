import os
import subprocess
import pysubs2
import uuid

def parse_lrc(lrc_path: str):
    import re
    events = []
    with open(lrc_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    for line in lines:
        match = re.match(r'^\[(\d+):(\d+\.\d+)\](.*)$', line.strip())
        if match:
            mins, secs, text = match.groups()
            time_ms = int(int(mins) * 60000 + float(secs) * 1000)
            if text.strip():
                events.append({"start": time_ms, "text": text.strip()})
    
    for i in range(len(events) - 1):
        events[i]["end"] = events[i+1]["start"]
    if events:
        events[-1]["end"] = events[-1]["start"] + 5000
    return events

def generate_ass_subtitle(lrc_path: str, output_ass: str, total_duration: float, lyrics_blocks: list):
    lrc_events = parse_lrc(lrc_path)
    new_subs = pysubs2.SSAFile()
    
    style = pysubs2.SSAStyle()
    style.fontname = "Montserrat"
    style.fontsize = 16
    style.primarycolor = pysubs2.Color(255, 255, 255, 0)
    style.outlinecolor = pysubs2.Color(0, 0, 0, 0)
    style.backcolor = pysubs2.Color(0, 0, 0, 128)
    style.bold = True
    style.alignment = 5 # Medio centro
    style.marginv = 50
    style.outline = 1.5
    style.shadow = 1.5
    
    new_subs.styles["Default"] = style
    
    for block in lyrics_blocks:
        start_timeline = block["start"]
        dur = block["duration"]
        media_start = block["mediaStart"]
        
        start_ms = int(media_start * 1000)
        end_ms = int((media_start + dur) * 1000)
        
        for i, lrc in enumerate(lrc_events):
            if lrc["end"] > start_ms and lrc["start"] < end_ms:
                past = lrc_events[i-1]["text"] if i > 0 else ""
                current = lrc["text"]
                nxt = lrc_events[i+1]["text"] if i < len(lrc_events)-1 else ""
                
                lines_ass = []
                if past:
                    lines_ass.append(r"{\alpha&H99&}{\fscx80\fscy80}" + past + r"{\r}")
                lines_ass.append(r"{\fscx100\fscy100}" + current + r"{\r}")
                if nxt:
                    lines_ass.append(r"{\alpha&H99&}{\fscx80\fscy80}" + nxt + r"{\r}")
                    
                full_text = r"\N".join(lines_ass)
                
                rel_start = max(0, lrc["start"] - start_ms)
                rel_end = min(dur * 1000, lrc["end"] - start_ms)
                
                event = pysubs2.SSAEvent(
                    start=int(start_timeline * 1000) + rel_start,
                    end=int(start_timeline * 1000) + rel_end,
                    text=full_text,
                    style="Default"
                )
                new_subs.append(event)
                
    new_subs.sort()
    new_subs.info["PlayResX"] = "288"
    new_subs.info["PlayResY"] = "512"
    new_subs.save(output_ass)

def build_filter_complex(video_blocks, audio_blocks, total_duration, ass_path):
    filter_lines = []
    v_streams = []
    a_streams = []
    
    if len(video_blocks) > 1:
        v_splits = "".join([f"[v1_{i}]" for i in range(len(video_blocks))])
        filter_lines.append(f"[1:v]split={len(video_blocks)}{v_splits};")
        
    if len(audio_blocks) > 1:
        a_splits = "".join([f"[a0_{i}]" for i in range(len(audio_blocks))])
        filter_lines.append(f"[0:a]asplit={len(audio_blocks)}{a_splits};")

    curr_time = 0.0
    for i, block in enumerate(video_blocks):
        start = block["start"]
        dur = block["duration"]
        mediaStart = block["mediaStart"]
        
        if start > curr_time:
            gap_dur = start - curr_time
            filter_lines.append(f"color=c=black:s=1080x1920:d={gap_dur}:r=60[vblack{i}];")
            v_streams.append(f"[vblack{i}]")
            
        in_stream = f"[v1_{i}]" if len(video_blocks) > 1 else "[1:v]"
        filter_lines.append(f"{in_stream}trim=start={mediaStart}:duration={dur},setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=60[vclip{i}];")
        v_streams.append(f"[vclip{i}]")
        curr_time = start + dur
        
    if curr_time < total_duration:
        gap_dur = total_duration - curr_time
        filter_lines.append(f"color=c=black:s=1080x1920:d={gap_dur}:r=60[vblack_end];")
        v_streams.append(f"[vblack_end]")

    if v_streams:
        filter_lines.append(f"{''.join(v_streams)}concat=n={len(v_streams)}:v=1:a=0[vbase];")
    else:
        filter_lines.append(f"color=c=black:s=1080x1920:d={total_duration}:r=60[vbase];")

    if ass_path:
        ass_filter_path = ass_path.replace("\\", "/").replace(":", "\\:")
        filter_lines.append(f"[vbase]ass='{ass_filter_path}'[vout];")
    else:
        filter_lines.append(f"[vbase]null[vout];")

    curr_time = 0.0
    for i, block in enumerate(audio_blocks):
        start = block["start"]
        dur = block["duration"]
        mediaStart = block["mediaStart"]
        
        if start > curr_time:
            gap_dur = start - curr_time
            filter_lines.append(f"anullsrc=r=44100:cl=stereo:d={gap_dur}[asilent{i}];")
            a_streams.append(f"[asilent{i}]")
            
        in_stream = f"[a0_{i}]" if len(audio_blocks) > 1 else "[0:a]"
        filter_lines.append(f"{in_stream}atrim=start={mediaStart}:duration={dur},asetpts=PTS-STARTPTS[aclip{i}];")
        a_streams.append(f"[aclip{i}]")
        curr_time = start + dur
        
    if curr_time < total_duration:
        gap_dur = total_duration - curr_time
        filter_lines.append(f"anullsrc=r=44100:cl=stereo:d={gap_dur}[asilent_end];")
        a_streams.append(f"[asilent_end]")

    if a_streams:
        filter_lines.append(f"{''.join(a_streams)}concat=n={len(a_streams)}:v=0:a=1[aout]")
    else:
        filter_lines.append(f"anullsrc=r=44100:cl=stereo:d={total_duration}[aout]")

    return "".join(filter_lines).strip(";")

def process_video(audio_path: str, bg_video_path: str, lrc_path: str, start_time: float, duration: float, output_dir: str, tracks: dict = None):
    os.makedirs(output_dir, exist_ok=True)
    out_id = str(uuid.uuid4())[:8]
    output_mp4 = os.path.join(output_dir, f"export_{out_id}.mp4")
    
    if not tracks:
        tracks = {
            "video": [{"start": 0, "duration": duration, "mediaStart": 0}],
            "audio": [{"start": 0, "duration": duration, "mediaStart": 0}],
            "lyrics": [{"start": 0, "duration": duration, "mediaStart": 0}]
        }
        
    video_blocks = sorted(tracks.get("video", []), key=lambda x: x["start"])
    audio_blocks = sorted(tracks.get("audio", []), key=lambda x: x["start"])
    lyrics_blocks = sorted(tracks.get("lyrics", []), key=lambda x: x["start"])
    
    ass_path = None
    if lrc_path and lyrics_blocks:
        ass_path = os.path.join(output_dir, f"subs_{out_id}.ass")
        generate_ass_subtitle(lrc_path, ass_path, duration, lyrics_blocks)
        
    import imageio_ffmpeg
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    
    filtergraph = build_filter_complex(video_blocks, audio_blocks, duration, ass_path)
    
    cmd = [
        ffmpeg_exe, "-y",
        "-i", audio_path,
        "-stream_loop", "-1", "-i", bg_video_path,
        "-filter_complex", filtergraph,
        "-map", "[vout]",
        "-map", "[aout]",
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        output_mp4
    ]
    
    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError as e:
        print("FFmpeg Error:", e.stderr)
        raise Exception("Error al procesar video: " + str(e.stderr[-200:]))
    
    if ass_path and os.path.exists(ass_path):
        os.remove(ass_path)
        
    return output_mp4
