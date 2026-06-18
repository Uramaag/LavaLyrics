from spotdl import Song, Downloader
from spotdl.utils.config import DEFAULT_CONFIG
import imageio_ffmpeg
import os

try:
    # We do NOT initialize SpotifyClient!
    print("Creating manual Song object...")
    song = Song.from_missing_data(
        name="Lovers Rock",
        artists=["TV Girl"],
        url="https://open.spotify.com/track/dummy",
        download_url="https://music.youtube.com/watch?v=j_sG_Juncn8"
    )
    print("Song created. Downloader config...")
    settings = dict(DEFAULT_CONFIG)
    settings["ffmpeg"] = imageio_ffmpeg.get_ffmpeg_exe()
    settings["format"] = "wav"
    settings["output"] = "test_manual_song.wav"
    
    downloader = Downloader(settings=settings)
    print("Downloading...")
    downloader.download_song(song)
    print("Download completed! File exists:", os.path.exists("test_manual_song.wav"))
except Exception as e:
    print("Error:", e)
