from spotdl import Downloader, Song
from spotdl.utils.config import DEFAULT_CONFIG
import imageio_ffmpeg
import os

try:
    print("Initializing SpotifyClient...")
    from spotdl.utils.spotify import SpotifyClient
    SpotifyClient.init(
        client_id='5f573c9620494bae87890c0f08a60293',
        client_secret='212476d9b0f3472eaa762d90b19b0ba8',
        user_auth=False,
        no_cache=True,
    )
    print("Init done. Configuring Downloader...")
    settings = dict(DEFAULT_CONFIG)
    settings["ffmpeg"] = imageio_ffmpeg.get_ffmpeg_exe()
    settings["format"] = "wav"
    settings["output"] = "test_output.wav"
    
    downloader = Downloader(settings=settings)
    print("Downloader created. Resolving song...")
    song = Song.from_search_term("Mon Laferte - Tu Falta De Querer")
    print("Song resolved. Downloading...")
    downloader.search_and_download(song)
    print("Download completed! File exists:", os.path.exists("test_output.wav"))
except Exception as e:
    print("Error:", e)
