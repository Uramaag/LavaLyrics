import sys
from spotdl.console.entry_point import console_entry_point
import imageio_ffmpeg
import os

try:
    print("Running spotdl internally...")
    sys.argv = [
        "spotdl",
        "download",
        "https://open.spotify.com/track/4c077ef228b9451c9868e0d9b4b0e91a",
        "--ffmpeg", imageio_ffmpeg.get_ffmpeg_exe(),
        "--format", "wav",
        "--audio", "youtube"
    ]
    console_entry_point()
except SystemExit as se:
    print("SystemExit code:", se.code)
    # Let's see if any WAV file was downloaded
    wav_files = [f for f in os.listdir(".") if f.endswith(".wav")]
    print("WAV files:", wav_files)
except Exception as e:
    print("Error:", e)
