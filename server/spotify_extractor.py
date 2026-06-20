import os
import subprocess
import json
import httpx
import re
import asyncio
import urllib.parse
from urllib.parse import quote, unquote

def _init_spotify_client():
    pass

def _fmt_duration(seconds):
    if not seconds:
        return ""
    try:
        s = int(seconds)
        return f"{s // 60}:{s % 60:02d}"
    except:
        return ""

async def _search_ytmusic(query: str):
    try:
        from ytmusicapi import YTMusic
        import asyncio
        yt = YTMusic()
        loop = asyncio.get_event_loop()
        results = await loop.run_in_executor(None, lambda: yt.search(query, filter="songs"))
        
        songs = []
        for r in results[:8]:
            title = r.get("title", "")
            artists = ", ".join([a.get("name") for a in r.get("artists", [])])
            videoId = r.get("videoId", "")
            duration = r.get("duration", "")
            thumbnails = r.get("thumbnails", [])
            thumb = thumbnails[-1].get("url") if thumbnails else ""
            
            encoded_title = quote(title)
            encoded_artist = quote(artists)
            fake_spotify_url = f"https://open.spotify.com/track/YT-{videoId}__TITLE-{encoded_title}__ARTIST-{encoded_artist}__SRC-yt_music"
            
            songs.append({
                "title": title,
                "artist": artists,
                "spotify_url": fake_spotify_url,
                "url": fake_spotify_url,
                "duration": duration,
                "thumbnail": thumb,
                "source": "yt_music"
            })
        return songs
    except Exception as e:
        print("YTMusic search failed:", e)
        return []

async def _search_ytdlp_search(query: str):
    try:
        import yt_dlp
        ydl_opts = {
            'quiet': True,
            'extract_flat': True,
            'skip_download': True,
        }
        def _run():
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                res = ydl.extract_info(f"ytsearch6:{query}", download=False)
                return res.get('entries', [])
                
        loop = asyncio.get_event_loop()
        entries = await loop.run_in_executor(None, _run)
        
        results = []
        for item in entries:
            if not item:
                continue
            video_id = item.get('id')
            title = item.get('title', '')
            channel = item.get('channel', 'YouTube')
            duration_sec = item.get('duration')
            duration = _fmt_duration(duration_sec) if duration_sec else ""
            
            artist = channel
            song_title = title
            if " - " in title:
                parts = title.split(" - ", 1)
                artist = parts[0].strip()
                song_title = parts[1].strip()
                
            song_title = re.sub(r'\s*[\(\[][Ll]yrics[\)\]]', '', song_title)
            song_title = re.sub(r'\s*[\(\[][Oo]fficial.*[\)\]]', '', song_title)
            song_title = re.sub(r'\s*[\(\[][Ss]ub.*[\)\]]', '', song_title)
            song_title = re.sub(r'\s*[\(\[][Aa]udio[\)\]]', '', song_title)
            song_title = song_title.strip()
            
            encoded_title = quote(song_title)
            encoded_artist = quote(artist)
            fake_spotify_url = f"https://open.spotify.com/track/YT-{video_id}__TITLE-{encoded_title}__ARTIST-{encoded_artist}__SRC-youtube"
            
            results.append({
                "title": song_title,
                "artist": artist,
                "spotify_url": fake_spotify_url,
                "url": fake_spotify_url,
                "duration": duration,
                "thumbnail": f"https://img.youtube.com/vi/{video_id}/0.jpg" if video_id else "",
                "source": "youtube"
            })
        return results
    except Exception as e:
        print("YT Search failed:", e)
        return []

async def _search_soundcloud(query: str):
    try:
        import yt_dlp
        ydl_opts = {
            'quiet': True,
            'extract_flat': True,
            'skip_download': True,
        }
        def _run():
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                res = ydl.extract_info(f"scsearch6:{query}", download=False)
                return res.get('entries', [])
                
        loop = asyncio.get_event_loop()
        entries = await loop.run_in_executor(None, _run)
        
        results = []
        for item in entries:
            if not item:
                continue
            title = item.get('title', '')
            uploader = item.get('uploader', 'SoundCloud')
            url = item.get('url') or item.get('webpage_url')
            if not url:
                continue
                
            duration_sec = item.get('duration')
            duration = _fmt_duration(duration_sec) if duration_sec else ""
            
            encoded_title = quote(title)
            encoded_artist = quote(uploader)
            fake_spotify_url = f"https://open.spotify.com/track/QUERY__TITLE-{encoded_title}__ARTIST-{encoded_artist}__SRC-soundcloud__DLURL-{quote(url)}"
            
            results.append({
                "title": title,
                "artist": uploader,
                "spotify_url": fake_spotify_url,
                "url": fake_spotify_url,
                "duration": duration,
                "thumbnail": "",
                "source": "soundcloud"
            })
        return results
    except Exception as e:
        print("SoundCloud Search failed:", e)
        return []

def remove_accents(s: str) -> str:
    import unicodedata
    nfkd_form = unicodedata.normalize('NFKD', s)
    return "".join([c for c in nfkd_form if not unicodedata.combining(c)])

def normalize_string(s: str) -> str:
    if not s:
        return ""
    s = remove_accents(s)
    s = s.lower()
    s = re.sub(r'[\(\[].*?[\)\]]', '', s)
    s = re.sub(r'[^a-z0-9\s]', '', s)
    s = re.sub(r'\s+', ' ', s)
    return s.strip()

async def _search_lrclib(query: str):
    try:
        async with httpx.AsyncClient(
            headers={"User-Agent": "LavaLyrics/2.0"},
            timeout=10,
        ) as client:
            res = await client.get(
                f"https://lrclib.net/api/search?q={quote(query)}"
            )
            if res.status_code == 200:
                data = res.json()
                seen = set()
                results = []
                for item in data[:30]:
                    track = item.get("trackName", "")
                    artist = item.get("artistName", "")
                    key = f"{track}-{artist}".lower()
                    if key in seen:
                        continue
                    seen.add(key)
                    
                    encoded_title = quote(track)
                    encoded_artist = quote(artist)
                    fake_spotify_url = f"https://open.spotify.com/track/QUERY__TITLE-{encoded_title}__ARTIST-{encoded_artist}__SRC-lrclib"
                    
                    results.append({
                        "title": track,
                        "artist": artist,
                        "spotify_url": fake_spotify_url,
                        "url": fake_spotify_url,
                        "duration": _fmt_duration(item.get("duration", 0)),
                        "thumbnail": "",
                        "source": "spotify",
                        "has_lyrics": bool(item.get("syncedLyrics"))
                    })
                return results
    except Exception as e:
        print("lrclib search failed:", e)
    return []

async def search_tracks(query: str):
    """
    Search songs in parallel using YouTube Music, YouTube Search, SoundCloud and LrcLib,
    and merge/prioritize them.
    """
    results_ytmusic, results_ytdlp, results_soundcloud, results_lrclib = await asyncio.gather(
        _search_ytmusic(query),
        _search_ytdlp_search(query),
        _search_soundcloud(query),
        _search_lrclib(query),
        return_exceptions=True
    )
    
    if isinstance(results_ytmusic, Exception): results_ytmusic = []
    if isinstance(results_ytdlp, Exception): results_ytdlp = []
    if isinstance(results_soundcloud, Exception): results_soundcloud = []
    if isinstance(results_lrclib, Exception): results_lrclib = []
    
    # Build a lookup set of normalized (title, artist) that have synced lyrics in LrcLib
    synced_lyrics_set = set()
    for item in results_lrclib:
        if item.get("has_lyrics"):
            norm_t = normalize_string(item["title"])
            norm_a = normalize_string(item["artist"])
            synced_lyrics_set.add((norm_t, norm_a))
            
    def check_has_lyrics(title, artist):
        norm_t = normalize_string(title)
        norm_a = normalize_string(artist)
        # Check direct match
        if (norm_t, norm_a) in synced_lyrics_set:
            return True
        # Check if artist is in artist name or vice versa (fuzzy check)
        for t, a in synced_lyrics_set:
            if t == norm_t and (a in norm_a or norm_a in a):
                return True
        return False

    combined = []
    seen_keys = set()
    
    # Helper to format/add has_lyrics to item
    def process_item(item):
        if "has_lyrics" not in item:
            item["has_lyrics"] = check_has_lyrics(item["title"], item["artist"])
        return item
    
    # 1. Official YouTube Music Songs
    for item in results_ytmusic:
        key = f"{item['title']}-{item['artist']}".lower()
        if key not in seen_keys:
            seen_keys.add(key)
            combined.append(process_item(item))
            
    # 2. Spotify / LrcLib tracks (exact metadata from lyrics database)
    for item in results_lrclib[:8]:
        key = f"{item['title']}-{item['artist']}".lower()
        if key not in seen_keys:
            seen_keys.add(key)
            combined.append(process_item(item))
            
    # 3. SoundCloud results
    for item in results_soundcloud:
        key = f"{item['title']}-{item['artist']}".lower()
        if key not in seen_keys:
            seen_keys.add(key)
            combined.append(process_item(item))
            
    # 4. YouTube General Videos (covers, fan lyrics, etc.)
    for item in results_ytdlp:
        key = f"{item['title']}-{item['artist']}".lower()
        
        video_id_item = item['url'].split("YT-")[-1].split("__")[0]
        video_id_seen = False
        for added in combined:
            if "YT-" in added['url']:
                vid = added['url'].split("YT-")[-1].split("__")[0]
                if vid == video_id_item:
                    video_id_seen = True
                    break
                    
        if key not in seen_keys and not video_id_seen:
            seen_keys.add(key)
            combined.append(process_item(item))
            
    return combined[:20]

async def _fetch_spotify_metadata(spotify_url: str):
    track_name, artist_name = "", ""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.get(f"https://open.spotify.com/oembed?url={quote(spotify_url, safe='')}")
            if res.status_code == 200:
                data = res.json()
                track_name = data.get("title", "")
                artist_name = data.get("author_name", "")
    except Exception as e:
        print("Spotify oembed failed:", e)
        
    if not track_name:
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
            async with httpx.AsyncClient(headers=headers, timeout=10) as client:
                res = await client.get(spotify_url)
                if res.status_code == 200:
                    html = res.text
                    title_match = re.search(r"<title>(.*?)</title>", html)
                    if title_match:
                        title_text = title_match.group(1)
                        title_text = title_text.replace(" | Spotify", "").strip()
                        match = re.search(r"^(.*?) - (?:song|song and lyrics|canción|canción y letra) (?:by|de) (.*?)$", title_text, re.IGNORECASE)
                        if match:
                            track_name = match.group(1).strip()
                            artist_name = match.group(2).strip()
                        else:
                            parts = title_text.split(" - ")
                            if len(parts) >= 2:
                                track_name = parts[0].strip()
                                artist_name = parts[1].strip()
                            else:
                                track_name = title_text
                                artist_name = "Desconocido"
        except Exception as e:
            print("Spotify HTML scraping failed:", e)
            
    if "Spotify" in track_name or track_name == "Page not found":
        track_name = ""
    if artist_name == "Desconocido":
        artist_name = ""
        
    return track_name, artist_name

async def _resolve_ytmusic_video_id(artist_name: str, track_name: str):
    try:
        from ytmusicapi import YTMusic
        yt = YTMusic()
        loop = asyncio.get_event_loop()
        query = f"{artist_name} - {track_name}"
        results = await loop.run_in_executor(None, lambda: yt.search(query, filter="songs"))
        if results:
            first = results[0]
            video_id = first.get("videoId")
            thumbnails = first.get("thumbnails", [])
            thumb = thumbnails[-1].get("url") if thumbnails else ""
            if video_id:
                return video_id, thumb
    except Exception as e:
        print("YTMusic resolve failed:", e)
    return None, None

async def get_spotify_track_info(url: str, output_dir: str, on_progress=None):
    """
    Decoupled track download and metadata resolver.
    Does NOT depend on Spotipy / Spotdl Spotify Client Credentials or API limits.
    Downloads the audio directly using yt-dlp and fetches lyrics from lrclib.net.
    Supports YouTube, SoundCloud, and Spotify oembed metadata fallbacks.
    """
    os.makedirs(output_dir, exist_ok=True)
    import asyncio
    import imageio_ffmpeg
    import yt_dlp
    
    track_name = ""
    artist_name = ""
    video_id = None
    yt_url = None
    thumbnail_url = ""
    
    if on_progress:
        on_progress(5, "Obteniendo metadata...")
        
    # 1. Parse metadata and determine download URL
    if "__DLURL-" in url:
        # Pre-resolved direct download URL (like SoundCloud)
        yt_url = unquote(url.split("__DLURL-")[-1].split("__")[0])
        if "__TITLE-" in url:
            track_name = unquote(url.split("__TITLE-")[-1].split("__")[0])
        if "__ARTIST-" in url:
            artist_name = unquote(url.split("__ARTIST-")[-1].split("__")[0])
            
    elif "spotify.com" in url and "YT-" not in url and "QUERY-" not in url and "QUERY__" not in url:
        # User pasted a real Spotify URL
        track_name, artist_name = await _fetch_spotify_metadata(url)
        if not track_name:
            raise Exception("No se pudo extraer información del enlace de Spotify. Por favor, escribe la canción en la barra de búsqueda o usa otro método.")
        
        if on_progress:
            on_progress(12, f"Buscando audio en YouTube Music...")
            
        video_id, thumbnail_url = await _resolve_ytmusic_video_id(artist_name, track_name)
        if not video_id:
            # Fallback to general YouTube search with (Audio) suffix
            yt_query = f"{artist_name} - {track_name} (Audio)"
            if on_progress:
                on_progress(15, f"Buscando audio en YouTube...")
                
            def _search_yt():
                ydl_opts = {
                    'quiet': True,
                    'extract_flat': True,
                    'skip_download': True,
                }
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    res = ydl.extract_info(f"ytsearch1:{yt_query}", download=False)
                    entries = res.get('entries', [])
                    if entries:
                        return entries[0].get('id'), entries[0].get('thumbnail')
                    return None, None
                    
            loop = asyncio.get_event_loop()
            video_id, thumbnail_url = await loop.run_in_executor(None, _search_yt)
            
        if not video_id:
            raise Exception(f"No se encontró audio en YouTube para: {artist_name} - {track_name}")
        yt_url = f"https://www.youtube.com/watch?v={video_id}"
        
    else:
        # Fake Spotify URL or search term
        if "YT-" in url:
            video_id = url.split("YT-")[-1].split("__")[0]
            yt_url = f"https://www.youtube.com/watch?v={video_id}"
            if "__TITLE-" in url:
                track_name = unquote(url.split("__TITLE-")[-1].split("__")[0])
            if "__ARTIST-" in url:
                artist_name = unquote(url.split("__ARTIST-")[-1].split("__")[0])
        elif "QUERY-" in url or "QUERY__" in url:
            if "__TITLE-" in url:
                track_name = unquote(url.split("__TITLE-")[-1].split("__")[0])
            if "__ARTIST-" in url:
                artist_name = unquote(url.split("__ARTIST-")[-1].split("__")[0])
            else:
                query_str = unquote(url.split("QUERY-")[-1].split("__")[0])
                track_name = query_str
                artist_name = ""
        else:
            # Plain search query
            track_name = url
            artist_name = ""
            
        # Search YouTube if we don't have a video ID or URL
        if not video_id and not yt_url:
            if artist_name and artist_name != "Desconocido":
                if on_progress:
                    on_progress(12, f"Buscando audio en YouTube Music...")
                video_id, thumbnail_url = await _resolve_ytmusic_video_id(artist_name, track_name)
                if video_id:
                    yt_url = f"https://www.youtube.com/watch?v={video_id}"
                
            if not video_id:
                if on_progress:
                    on_progress(12, f"Buscando audio en YouTube...")
                yt_query = f"{artist_name} - {track_name} (Audio)" if artist_name else f"{track_name} (Audio)"
                def _search_yt():
                    ydl_opts = {
                        'quiet': True,
                        'extract_flat': True,
                        'skip_download': True,
                    }
                    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                        res = ydl.extract_info(f"ytsearch1:{yt_query}", download=False)
                        entries = res.get('entries', [])
                        if entries:
                            return entries[0].get('id'), entries[0].get('thumbnail'), entries[0].get('title')
                        return None, None, None
                        
                loop = asyncio.get_event_loop()
                video_id, thumbnail_url, full_title = await loop.run_in_executor(None, _search_yt)
                
                # If still not found, search without (Audio) suffix
                if not video_id:
                    yt_query = f"{artist_name} - {track_name}" if artist_name else track_name
                    video_id, thumbnail_url, full_title = await loop.run_in_executor(None, _search_yt)
                    
                if not video_id:
                    raise Exception(f"No se encontró audio para la búsqueda: {yt_query}")
                yt_url = f"https://www.youtube.com/watch?v={video_id}"
                
                if not artist_name or artist_name == "Desconocido":
                    if full_title and " - " in full_title:
                        parts = full_title.split(" - ", 1)
                        artist_name = parts[0].strip()
                        track_name = parts[1].strip()
                    else:
                        track_name = full_title or track_name
                        artist_name = "YouTube"
                        
                    track_name = re.sub(r'\s*[\(\[][Ll]yrics[\)\]]', '', track_name)
                    track_name = re.sub(r'\s*[\(\[][Oo]fficial.*[\)\]]', '', track_name)
                    track_name = re.sub(r'\s*[\(\[][Ss]ub.*[\)\]]', '', track_name)
                    track_name = re.sub(r'\s*[\(\[][Aa]udio[\)\]]', '', track_name)
                    track_name = track_name.strip()
                    
    if not track_name or track_name == "Desconocido":
        track_name = "Cancion Desconocida"
    if not artist_name or artist_name == "Desconocido":
        artist_name = "Artista Desconocido"
        
    # 2. Download audio file and convert to WAV
    filename = f"{artist_name} - {track_name}"
    filename = "".join(c for c in filename if c.isalnum() or c in (' ', '-', '_')).rstrip()
    
    if on_progress:
        on_progress(20, "Descargando audio...")
        
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': os.path.join(output_dir, f"{filename}.%(ext)s"),
        'ffmpeg_location': ffmpeg_exe,
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'wav',
        }],
        'quiet': True,
    }
    
    loop = asyncio.get_event_loop()
    def _download():
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(yt_url, download=True)
            thumb = info.get('thumbnail') or (info.get('thumbnails')[-1].get('url') if info.get('thumbnails') else '')
            return info.get('heatmap', []), thumb
            
    heatmap, dl_thumb = await loop.run_in_executor(None, _download)
    if dl_thumb:
        thumbnail_url = dl_thumb
        
    if on_progress:
        on_progress(65, "Procesando audio...")
        
    audio_path = os.path.join(output_dir, f"{filename}.wav")
    if not os.path.exists(audio_path):
        wav_files = [f for f in os.listdir(output_dir) if f.endswith(".wav")]
        if wav_files:
            os.rename(os.path.join(output_dir, wav_files[0]), audio_path)
        else:
            raise Exception("No se pudo generar el archivo de audio. Verifica tu conexión a internet o la URL.")
            
    # 3. Fetch Synced Lyrics from lrclib.net
    if on_progress:
        on_progress(75, "Obteniendo letras sincronizadas...")
        
    lrc_content = None
    try:
        async with httpx.AsyncClient(
            headers={"User-Agent": "LavaLyrics/2.0 (https://github.com/Uramaag/LavaLyrics)"},
            timeout=10,
        ) as client:
            res = await client.get(
                f"https://lrclib.net/api/get?track_name={quote(track_name)}&artist_name={quote(artist_name)}"
            )
            if res.status_code == 200:
                data = res.json()
                lrc_content = data.get("syncedLyrics")
                
            if not lrc_content:
                search_q = quote(f"{artist_name} {track_name}")
                res = await client.get(f"https://lrclib.net/api/search?q={search_q}")
                if res.status_code == 200:
                    for r in res.json():
                        if r.get("syncedLyrics"):
                            lrc_content = r["syncedLyrics"]
                            break
    except Exception as e:
        print("Lyrics fetch failed:", e)
        
    lrc_path = None
    if lrc_content:
        lrc_path = os.path.join(output_dir, f"{filename}.lrc")
        with open(lrc_path, "w", encoding="utf-8") as f:
            f.write(lrc_content)
            
    if on_progress:
        on_progress(95, "Finalizando...")
        
    return {
        "audio_path": audio_path,
        "lrc_path": lrc_path,
        "heatmap": heatmap,
        "track_name": track_name,
        "artist_name": artist_name,
        "thumbnail": thumbnail_url,
    }
