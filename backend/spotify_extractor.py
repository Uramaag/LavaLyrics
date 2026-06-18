import os
import subprocess
import json
import httpx
from urllib.parse import quote

async def get_spotify_track_info(url: str, output_dir: str):
    """
    Usa spotdl para descargar la canción como wav o mp3 (mejor wav o flac para calidad de edición) y obtener metadata.
    """
    os.makedirs(output_dir, exist_ok=True)
    
    import imageio_ffmpeg
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()

    # 1. Obtener la metadata JSON de spotdl para saber artista y título, y la URL de youtube
    # spotdl save "url" --save-file meta.spotdl
    cmd_meta = [
        "spotdl", 
        "save", url,
        "--save-file", os.path.join(output_dir, "meta.spotdl"),
        "--ffmpeg", ffmpeg_exe
    ]
    subprocess.run(cmd_meta, cwd=output_dir, check=True)
    
    with open(os.path.join(output_dir, "meta.spotdl"), "r", encoding="utf-8") as f:
        meta = json.load(f)[0]
    
    track_name = meta.get("name")
    artist_name = meta.get("artist")
    yt_url = meta.get("download_url")
    
    filename = f"{artist_name} - {track_name}"
    # Remove invalid characters
    filename = "".join(c for c in filename if c.isalnum() or c in (' ', '-', '_')).rstrip()

    # 2. Descargar audio con spotdl (sin especificar --output para evitar bugs de plantillas)
    cmd_dl = [
        "spotdl", 
        url,
        "--format", "wav",
        "--ffmpeg", ffmpeg_exe,
        "--audio", "youtube"
    ]
    subprocess.run(cmd_dl, cwd=output_dir, check=True)
    
    # Buscar cualquier archivo .wav generado en la carpeta raíz
    wav_files = [f for f in os.listdir(output_dir) if f.endswith(".wav") and os.path.isfile(os.path.join(output_dir, f))]
    if not wav_files:
        raise Exception("spotdl terminó pero no se generó el archivo de audio. Verifica que FFmpeg funcione y que la URL sea válida.")
    
    audio_path_final = os.path.join(output_dir, wav_files[0])
    
    # Renombrar audio.wav al nombre correcto
    audio_path = os.path.join(output_dir, f"{filename}.wav")
    if os.path.exists(audio_path_final):
        os.rename(audio_path_final, audio_path)
    
    # 3. Intentar obtener el heatmap de YouTube usando yt-dlp
    heatmap = []
    if yt_url:
        try:
            import yt_dlp
            ydl_opts = {'skip_download': True, 'quiet': True}
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(yt_url, download=False)
                heatmap = info.get('heatmap', [])
        except Exception:
            pass
            
    # 4. Obtener letras sincronizadas de lrclib.net
    lrc_content = None
    try:
        async with httpx.AsyncClient(headers={"User-Agent": "LavaLyrics/1.0 (https://github.com/tu-usuario/lavalyrics)"}) as client:
            res = await client.get(
                f"https://lrclib.net/api/get?track_name={quote(track_name)}&artist_name={quote(artist_name)}"
            )
            if res.status_code == 200:
                data = res.json()
                if data.get("syncedLyrics"):
                    lrc_content = data.get("syncedLyrics")
                    
            if not lrc_content:
                # Fallback: usar el endpoint de búsqueda
                search_query = quote(f"{artist_name} {track_name}")
                res = await client.get(f"https://lrclib.net/api/search?q={search_query}")
                if res.status_code == 200:
                    results = res.json()
                    for r in results:
                        if r.get("syncedLyrics"):
                            lrc_content = r.get("syncedLyrics")
                            break
    except Exception as e:
        print("Error fetching lyrics from lrclib.net:", e)
        
    if lrc_content:
        lrc_path = os.path.join(output_dir, f"{filename}.lrc")
        with open(lrc_path, "w", encoding="utf-8") as f:
            f.write(lrc_content)
    else:
        lrc_path = None
        
    return {
        "audio_path": audio_path,
        "lrc_path": lrc_path,
        "heatmap": heatmap,
        "track_name": track_name,
        "artist_name": artist_name
    }
