import os
import re
import subprocess
import uuid
import pysubs2


def parse_lrc(lrc_path: str):
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
        events[i]["end"] = events[i + 1]["start"]
    if events:
        events[-1]["end"] = events[-1]["start"] + 5000
    return events


def generate_ass_subtitle(lrc_path: str, output_ass: str, start_time: float, duration: float,
                           lyrics_blocks: list, width: int = 1080, height: int = 1920):
    lrc_events = parse_lrc(lrc_path)
    new_subs = pysubs2.SSAFile()

    style = pysubs2.SSAStyle()
    style.fontname = "Montserrat"
    style.fontsize = max(14, int(height * 0.032))
    style.primarycolor = pysubs2.Color(255, 255, 255, 0)
    style.outlinecolor = pysubs2.Color(0, 0, 0, 0)
    style.backcolor = pysubs2.Color(0, 0, 0, 128)
    style.bold = True
    style.alignment = 5
    style.marginv = int(height * 0.04)
    style.outline = 1.8
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
                past = lrc_events[i - 1]["text"] if i > 0 else ""
                current = lrc["text"]
                nxt = lrc_events[i + 1]["text"] if i < len(lrc_events) - 1 else ""

                rel_start = max(0, lrc["start"] - start_ms)
                rel_end = min(dur * 1000, lrc["end"] - start_ms)
                
                # Shift events relative to start_time of the export window
                event_start = int(start_timeline * 1000) + rel_start - int(start_time * 1000)
                event_end = int(start_timeline * 1000) + rel_end - int(start_time * 1000)

                # Only include events that overlap with the exported window [0, duration]
                if event_end > 0 and event_start < duration * 1000:
                    event_start_clamped = max(0, event_start)
                    event_end_clamped = min(int(duration * 1000), event_end)
                    event_dur = event_end_clamped - event_start_clamped

                    pop_dur = min(250, int(event_dur))
                    spacing_size = int(style.fontsize * 0.45)
                    spaced_break = r"\N{\fs%d} \N" % spacing_size

                    lines_ass = []
                    if past:
                        lines_ass.append(r"{\r\alpha&H99&\fscx80\fscy80}" + past + r"{\r}")
                    
                    # Dynamic pop-in animation mimicking React preview's spring pop
                    lines_ass.append(
                        r"{\r\fscx95\fscy95\alpha&HFF&\t(0,%d,\fscx104\fscy104\alpha&H00&)}" % pop_dur
                        + current + r"{\r}"
                    )
                    
                    if nxt:
                        lines_ass.append(r"{\r\alpha&H99&\fscx80\fscy80}" + nxt + r"{\r}")

                    # Styled multi-line breaks for interline spacing
                    full_text = spaced_break.join(lines_ass)

                    event = pysubs2.SSAEvent(
                        start=event_start_clamped,
                        end=event_end_clamped,
                        text=full_text,
                        style="Default",
                    )
                    new_subs.append(event)

    new_subs.sort()
    new_subs.info["PlayResX"] = str(width)
    new_subs.info["PlayResY"] = str(height)
    new_subs.save(output_ass)


def build_filter_complex(video_blocks, audio_blocks, start_time: float, duration: float, ass_path,
                          width: int = 1080, height: int = 1920):
    """
    Build FFmpeg filtergraph supporting:
    - Multiple video/audio blocks with gaps
    - Per-clip color filters (brightness, contrast, saturation, hue)
    - Configurable output resolution
    - ASS subtitle overlay
    """
    filter_lines = []
    v_streams = []
    a_streams = []
    timeline_limit = start_time + duration

    # Split video/audio inputs if multiple blocks
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
        media_start = block["mediaStart"]
        clip_filters = block.get("filters", {})

        # Gap filler (black frame)
        if start > curr_time + 0.01:
            gap_dur = start - curr_time
            filter_lines.append(
                f"color=c=black:s={width}x{height}:d={gap_dur}:r=60[vblack{i}];"
            )
            v_streams.append(f"[vblack{i}]")

        in_stream = f"[v1_{i}]" if len(video_blocks) > 1 else "[1:v]"

        # Build per-clip color filter chain
        color_filters = _build_color_filter(clip_filters)

        filter_lines.append(
            f"{in_stream}trim=start={media_start}:duration={dur},"
            f"setpts=PTS-STARTPTS,"
            f"scale={width}:{height}:force_original_aspect_ratio=increase,"
            f"crop={width}:{height},"
            f"setsar=1,"
            f"fps=60"
            + (f",{color_filters}" if color_filters else "")
            + f"[vclip{i}];"
        )
        v_streams.append(f"[vclip{i}]")
        curr_time = start + dur

    if curr_time < timeline_limit - 0.01:
        gap_dur = timeline_limit - curr_time
        filter_lines.append(
            f"color=c=black:s={width}x{height}:d={gap_dur}:r=60[vblack_end];"
        )
        v_streams.append("[vblack_end]")

    if v_streams:
        filter_lines.append(
            f"{''.join(v_streams)}concat=n={len(v_streams)}:v=1:a=0[vbase_raw];"
        )
    else:
        filter_lines.append(
            f"color=c=black:s={width}x{height}:d={timeline_limit}:r=60[vbase_raw];"
        )

    # Trim final video
    filter_lines.append(
        f"[vbase_raw]trim=start={start_time}:end={start_time + duration},"
        f"setpts=PTS-STARTPTS[vbase];"
    )

    # Subtitle overlay
    if ass_path:
        ass_filter_path = ass_path.replace("\\", "/").replace(":", "\\:")
        filter_lines.append(f"[vbase]ass='{ass_filter_path}'[vout];")
    else:
        filter_lines.append("[vbase]null[vout];")

    # Audio assembly
    curr_time = 0.0
    for i, block in enumerate(audio_blocks):
        start = block["start"]
        dur = block["duration"]
        media_start = block["mediaStart"]

        if start > curr_time + 0.01:
            gap_dur = start - curr_time
            filter_lines.append(f"anullsrc=r=44100:cl=stereo:d={gap_dur}[asilent{i}];")
            a_streams.append(f"[asilent{i}]")

        in_stream = f"[a0_{i}]" if len(audio_blocks) > 1 else "[0:a]"
        filter_lines.append(
            f"{in_stream}atrim=start={media_start}:duration={dur},"
            f"asetpts=PTS-STARTPTS[aclip{i}];"
        )
        a_streams.append(f"[aclip{i}]")
        curr_time = start + dur

    if curr_time < timeline_limit - 0.01:
        gap_dur = timeline_limit - curr_time
        filter_lines.append(f"anullsrc=r=44100:cl=stereo:d={gap_dur}[asilent_end];")
        a_streams.append("[asilent_end]")

    if a_streams:
        filter_lines.append(
            f"{''.join(a_streams)}concat=n={len(a_streams)}:v=0:a=1[aout_raw];"
        )
    else:
        filter_lines.append(f"anullsrc=r=44100:cl=stereo:d={timeline_limit}[aout_raw]")

    # Trim final audio
    filter_lines.append(
        f"[aout_raw]atrim=start={start_time}:end={start_time + duration},"
        f"asetpts=PTS-STARTPTS[aout]"
    )

    return "".join(filter_lines).strip(";")


def _build_color_filter(filters: dict) -> str:
    """
    Convert CSS-equivalent filter values to FFmpeg eq + hue filters.
    filters: { brightness, contrast, saturation, hue }
    """
    parts = []
    b = filters.get("brightness", 1.0)
    c = filters.get("contrast", 1.0)
    s = filters.get("saturation", 1.0)
    h = filters.get("hue", 0)

    # eq filter: brightness maps to -1..1 (FFmpeg), we keep 0.5..1.5 range mapped
    # FFmpeg eq brightness: -1.0 to 1.0 (0 = no change), contrast: -1000..1000 (1.0 = no change)
    # We use simpler approach: normalize around 1.0
    if abs(b - 1.0) > 0.01 or abs(c - 1.0) > 0.01 or abs(s - 1.0) > 0.01:
        # FFmpeg eq: brightness -1..1 (0=neutral), contrast 0..1000 (1=neutral), saturation 0..3 (1=neutral)
        b_ffmpeg = b - 1.0  # shift: 1.0 CSS → 0.0 FFmpeg
        parts.append(f"eq=brightness={b_ffmpeg:.3f}:contrast={c:.3f}:saturation={s:.3f}")

    if abs(h) > 0.5:
        parts.append(f"hue=h={h:.1f}")

    return ",".join(parts)


def _parse_ffmpeg_progress(line: str, total_frames: int):
    """Extract progress percentage from FFmpeg stderr output."""
    m = re.search(r'frame=\s*(\d+)', line)
    if m and total_frames > 0:
        frame = int(m.group(1))
        return min(99, int(frame / total_frames * 100))
    return None


def process_video(
    audio_path: str,
    bg_video_path: str,
    lrc_path: str,
    start_time: float,
    duration: float,
    output_dir: str,
    tracks: dict = None,
    width: int = 1080,
    height: int = 1920,
    on_progress=None,
    on_process_created=None,
):
    os.makedirs(output_dir, exist_ok=True)
    out_id = str(uuid.uuid4())[:8]
    output_mp4 = os.path.join(output_dir, f"export_{out_id}.mp4")

    if not tracks:
        tracks = {
            "video":  [{"start": 0, "duration": duration, "mediaStart": 0}],
            "audio":  [{"start": 0, "duration": duration, "mediaStart": 0}],
            "lyrics": [{"start": 0, "duration": duration, "mediaStart": 0}],
        }

    video_blocks  = sorted(tracks.get("video", []),  key=lambda x: x["start"])
    audio_blocks  = sorted(tracks.get("audio", []),  key=lambda x: x["start"])
    lyrics_blocks = sorted(tracks.get("lyrics", []), key=lambda x: x["start"])

    ass_path = None
    if lrc_path and lyrics_blocks:
        ass_path = os.path.join(output_dir, f"subs_{out_id}.ass")
        generate_ass_subtitle(lrc_path, ass_path, start_time, duration, lyrics_blocks, width, height)

    import imageio_ffmpeg
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()

    filtergraph = build_filter_complex(
        video_blocks, audio_blocks, start_time, duration, ass_path, width, height
    )

    total_frames = int(duration * 60)  # 60fps

    cmd = [
        ffmpeg_exe, "-y",
        "-i", audio_path,
        "-stream_loop", "-1", "-i", bg_video_path,
        "-filter_complex", filtergraph,
        "-map", "[vout]",
        "-map", "[aout]",
        "-c:v", "libx264", "-preset", "fast", "-crf", "22",
        "-c:a", "aac", "-b:a", "192k",
        "-t", str(duration),
        output_mp4,
    ]

    try:
        proc = subprocess.Popen(
            cmd,
            stderr=subprocess.PIPE,
            stdout=subprocess.DEVNULL,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        if on_process_created:
            on_process_created(proc)
        for line in proc.stderr:
            if on_progress:
                pct = _parse_ffmpeg_progress(line, total_frames)
                if pct is not None:
                    on_progress(pct)
        proc.wait()
        if proc.returncode != 0:
            raise Exception(f"FFmpeg exited with code {proc.returncode}")
    except Exception as e:
        raise Exception("Error al procesar video: " + str(e))

    if ass_path and os.path.exists(ass_path):
        os.remove(ass_path)

    return output_mp4
