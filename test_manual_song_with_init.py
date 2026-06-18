from spotdl import Song, Downloader
from spotdl.utils.config import DEFAULT_CONFIG
import imageio_ffmpeg
import os
from spotdl.utils.spotify import SpotifyClient

try:
    print("Initializing SpotifyClient...")
    SpotifyClient.init(
        client_id='5f573c9620494bae87890c0f08a60293',
        client_secret='212476d9b0f3472eaa762d90b19b0ba8',
        user_auth=False,
        no_cache=True,
    )
    print("Creating manual Song object...")
    song = Song.from_missing_data(
        name="Lovers Rock",
        artists=["TV Girl"],
        url="https://open.spotify.com/track/dummy",
        download_url="https://music.youtube.com/watch?v=j_sG_Juncn8"
    )
    print("Downloader config...")
    settings = dict(DEFAULT_CONFIG)
    settings["ffmpeg"] = imageio_ffmpeg.get_ffmpeg_exe()
    settings["format"] = "wav"
    settings["output"] = "test_manual_song_init.wav"
    
    downloader = Downloader(settings=settings)
    print("Downloading...")
    downloader.download_song(song)
    print("Completed! File exists:", os.path.exists("test_manual_song_init.wav"))
except Exception as e:
    print("Error:", e)
