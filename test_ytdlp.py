import yt_dlp
import imageio_ffmpeg
import os

try:
    print("Testing yt-dlp download...")
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': 'test_dl_ytdlp.%(ext)s',
        'ffmpeg_location': ffmpeg_exe,
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'wav',
        }],
        'quiet': False,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download(["https://www.youtube.com/watch?v=j_sG_Juncn8"])
    print("Download completed! File exists:", os.path.exists("test_dl_ytdlp.wav"))
except Exception as e:
    print("Error:", e)
