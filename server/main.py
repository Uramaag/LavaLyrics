import os
import sys

# Prevent NoneType AttributeError when running uvicorn in PyInstaller --noconsole mode
class DummyStream:
    def write(self, data):
        pass
    def writelines(self, lines):
        pass
    def flush(self):
        pass
    def isatty(self):
        return False
    def closed(self):
        return False

if sys.stdout is None:
    sys.stdout = DummyStream()
if sys.stderr is None:
    sys.stderr = DummyStream()

import shutil
import threading
import webbrowser
import uvicorn
import uuid
import json
import asyncio
import subprocess
from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any

from spotify_extractor import get_spotify_track_info, search_tracks
from video_processor import process_video

# ── Paths ──────────────────────────────────────────────────────────────
if getattr(sys, 'frozen', False):
    BASE_DIR = sys._MEIPASS
    EXE_DIR = os.path.dirname(sys.executable)
    # If the executable is in 'dist', go up one level to 'LavaLyrics' folder
    if os.path.basename(EXE_DIR).lower() == 'dist':
        WORK_DIR = os.path.dirname(EXE_DIR)
    else:
        WORK_DIR = EXE_DIR
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    # Go up one level from 'server' to 'LavaLyrics'
    WORK_DIR = os.path.dirname(BASE_DIR)

DATA_DIR = os.path.join(WORK_DIR, "data")
LOG_DIR = os.path.join(WORK_DIR, "logs")
PROJECTS_DIR = os.path.join(WORK_DIR, "LavaLyricsProjects")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(LOG_DIR, exist_ok=True)
os.makedirs(PROJECTS_DIR, exist_ok=True)

import logging
import time

LOG_FILE = os.path.join(LOG_DIR, "lavalyrics.log")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] (%(name)s) %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("LavaLyrics")

active_renders: Dict[str, subprocess.Popen] = {}
last_keepalive = time.time() + 45.0  # 45 seconds grace period for startup

def shutdown_monitor():
    global last_keepalive
    while True:
        time.sleep(5)
        if time.time() - last_keepalive > 15.0:
            logger.info("No active clients detected for 15s. Interrupting services and shutting down...")
            for render_id, proc in list(active_renders.items()):
                try:
                    logger.info(f"Terminating active render process: {render_id}")
                    proc.kill()
                except:
                    pass
            os._exit(0)

threading.Thread(target=shutdown_monitor, daemon=True).start()

# Frontend: in production serve client/dist/, in dev this is unused (Vite proxies)
FRONTEND_DIST = os.path.join(BASE_DIR, "..", "client", "dist")
if not os.path.exists(FRONTEND_DIST):
    FRONTEND_DIST = os.path.join(BASE_DIR, "client", "dist")

# ── In-memory DB ────────────────────────────────────────────────────────
jobs: Dict[str, Any] = {}

# ── Cache ───────────────────────────────────────────────────────────────
CACHE_FILE = os.path.join(DATA_DIR, "cache.json")
SEARCH_CACHE_FILE = os.path.join(DATA_DIR, "search_cache.json")

def load_cache():
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r") as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_cache(cache):
    with open(CACHE_FILE, "w") as f:
        json.dump(cache, f)

def load_search_cache():
    if os.path.exists(SEARCH_CACHE_FILE):
        try:
            with open(SEARCH_CACHE_FILE, "r") as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_search_cache(cache):
    with open(SEARCH_CACHE_FILE, "w") as f:
        json.dump(cache, f)

url_cache = load_cache()
search_cache = load_search_cache()

# Restore completed jobs from cache on startup
for url, cache_info in url_cache.items():
    if isinstance(cache_info, dict):
        job_id = cache_info.get("job_id")
        data = cache_info.get("data", {})
        audio_path = data.get("audio_path")
        if job_id and audio_path and os.path.exists(audio_path):
            jobs[job_id] = {"status": "completed", "data": data}

# ── App ──────────────────────────────────────────────────────────────────
app = FastAPI(title="LavaLyrics API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Models ───────────────────────────────────────────────────────────────
class ExtractRequest(BaseModel):
    url: str

class RenderRequest(BaseModel):
    job_id: str
    bg_path: str
    start_time: float = 0
    duration: float = 15
    tracks: dict = {}
    width: int = 1080
    height: int = 1920
    filename: Optional[str] = None

class OpenFolderRequest(BaseModel):
    render_id: Optional[str] = None
    path: Optional[str] = None

# ── Project state persistence ──────────────────────────────────────────────
class ProjectState(BaseModel):
    state: dict

@app.get("/api/projects")
async def list_projects():
    try:
        files = []
        for f in os.listdir(PROJECTS_DIR):
            if f.endswith(".lavalyrics"):
                path = os.path.join(PROJECTS_DIR, f)
                stat = os.stat(path)
                name = os.path.splitext(f)[0]
                # Try to load meta from the json
                track_name = ""
                artist_name = ""
                try:
                    with open(path, "r", encoding="utf-8") as file:
                        data = json.load(file)
                        track_name = data.get("trackName", "")
                        artist_name = data.get("artistName", "")
                except:
                    pass
                files.append({
                    "name": name,
                    "modified": stat.st_mtime,
                    "size": stat.st_size,
                    "track_name": track_name,
                    "artist_name": artist_name
                })
        # Sort by last modified desc
        files.sort(key=lambda x: x["modified"], reverse=True)
        return {"projects": files}
    except Exception as e:
        logger.exception("Error listing projects:")
        return JSONResponse({"error": str(e)}, status_code=500)

@app.get("/api/projects/{name}")
async def get_project(name: str):
    path = os.path.join(PROJECTS_DIR, f"{name}.lavalyrics")
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return {"state": data}
        except Exception as e:
            logger.error(f"Error loading project {name}: {e}")
            return JSONResponse({"error": str(e)}, status_code=500)
    return JSONResponse({"error": "Proyecto no encontrado"}, status_code=404)

@app.post("/api/projects/{name}")
async def save_project(name: str, req: ProjectState):
    try:
        path = os.path.join(PROJECTS_DIR, f"{name}.lavalyrics")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(req.state, f, ensure_ascii=False, indent=2)
        return {"status": "ok"}
    except Exception as e:
        logger.exception(f"Error saving project {name}:")
        return JSONResponse({"error": str(e)}, status_code=500)

@app.delete("/api/projects/{name}")
async def delete_project(name: str):
    path = os.path.join(PROJECTS_DIR, f"{name}.lavalyrics")
    if os.path.exists(path):
        try:
            os.remove(path)
            return {"status": "ok"}
        except Exception as e:
            logger.error(f"Error deleting project {name}: {e}")
            return JSONResponse({"error": str(e)}, status_code=500)
    return JSONResponse({"error": "Proyecto no encontrado"}, status_code=404)

# ── Keep-alive ─────────────────────────────────────────────────────────────
@app.post("/api/keepalive")
async def keepalive():
    global last_keepalive
    last_keepalive = time.time()
    return {"status": "alive"}

# ── Cancel Render ──────────────────────────────────────────────────────────
@app.post("/api/render/cancel/{render_id}")
async def cancel_render(render_id: str):
    proc = active_renders.get(render_id)
    if proc:
        try:
            logger.info(f"Cancelling render job {render_id} by user request...")
            proc.terminate()
            proc.wait(timeout=2)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass
        active_renders.pop(render_id, None)
        if render_id in jobs:
            jobs[render_id] = {"status": "error", "error": "Renderizado cancelado por el usuario"}
        return {"status": "cancelled"}
    return JSONResponse({"error": "Render process not found"}, status_code=404)

# ── Video stream ───────────────────────────────────────────────────────────
@app.get("/api/video")
async def get_video(path: str, quality: Optional[str] = "proxy"):
    if not path or not os.path.exists(path):
        return JSONResponse({"error": "Video no encontrado"}, status_code=404)
    
    if quality == "proxy":
        dir_name = os.path.dirname(path)
        base_name = os.path.basename(path)
        proxy_path = os.path.join(dir_name, f"proxy_{base_name}")
        if os.path.exists(proxy_path):
            return FileResponse(proxy_path, media_type="video/mp4")
            
    return FileResponse(path, media_type="video/mp4")

# ── Search ───────────────────────────────────────────────────────────────
@app.get("/api/search")
async def search_songs(q: str = ""):
    query_clean = q.strip().lower()
    if not query_clean:
        return {"results": []}
    try:
        # Check query cache
        if query_clean in search_cache:
            results = search_cache[query_clean]
        else:
            results = await search_tracks(q)
            # Store raw results in search cache
            search_cache[query_clean] = results
            save_search_cache(search_cache)
            
        # Dynamically check download cache to add live badge markers
        for r in results:
            url_val = r.get("spotify_url") or r.get("url")
            is_downloaded = False
            missing_lyrics = False
            
            if url_val in url_cache:
                entry = url_cache[url_val]
                cached_job_id = entry if isinstance(entry, str) else entry.get("job_id")
                if cached_job_id in jobs and jobs[cached_job_id].get("status") == "completed":
                    is_downloaded = True
                    data = jobs[cached_job_id].get("data", {})
                    missing_lyrics = not bool(data.get("lrc_path"))
            
            r["is_downloaded"] = is_downloaded
            r["missing_lyrics"] = missing_lyrics
            
        return {"results": results}
    except Exception as e:
        logger.error(f"Search failed for query '{q}': {e}")
        return {"results": [], "error": str(e)}

# ── Extract ───────────────────────────────────────────────────────────────
@app.post("/api/extract")
async def extract_audio(req: ExtractRequest):
    try:
        # Check cache
        if req.url in url_cache:
            cache_entry = url_cache[req.url]
            cached_job_id = cache_entry if isinstance(cache_entry, str) else cache_entry.get("job_id")
            if cached_job_id in jobs and jobs[cached_job_id].get("status") == "completed":
                audio_path = jobs[cached_job_id]["data"].get("audio_path")
                if audio_path and os.path.exists(audio_path):
                    return {"job_id": cached_job_id, "status": "cached"}

        job_id = str(uuid.uuid4())
        output_dir = os.path.join(DATA_DIR, job_id)
        jobs[job_id] = {"status": "processing", "progress": 0, "step": "Iniciando..."}

        def extractor_task():
            try:
                def on_progress(pct, step):
                    jobs[job_id]["progress"] = pct
                    jobs[job_id]["step"] = step

                data = asyncio.run(get_spotify_track_info(req.url, output_dir, on_progress))
                jobs[job_id] = {"status": "completed", "progress": 100, "step": "¡Listo!", "data": data}
                url_cache[req.url] = {"job_id": job_id, "data": data}
                save_cache(url_cache)
            except Exception as e:
                logger.exception(f"Extraction failed for URL {req.url}:")
                jobs[job_id] = {
                    "status": "error", 
                    "error": str(e),
                    "code": getattr(e, "code", "ERR_EXTRACT_FAILED")
                }

        threading.Thread(target=extractor_task, daemon=True).start()
        return {"job_id": job_id}
    except Exception as e:
        logger.exception(f"Failed to start extraction for URL {req.url}:")
        return JSONResponse({"error": str(e)}, status_code=500)

# ── Status ────────────────────────────────────────────────────────────────
@app.get("/api/status/{job_id}")
async def get_status(job_id: str):
    return jobs.get(job_id, {"status": "not_found"})

# ── Recent ────────────────────────────────────────────────────────────────
@app.get("/api/recent")
async def get_recent_audios():
    recent = []
    for url, cache_info in url_cache.items():
        if isinstance(cache_info, dict):
            job_id = cache_info.get("job_id")
            data = cache_info.get("data", {})
            audio_path = data.get("audio_path")
            if job_id and audio_path and os.path.exists(audio_path):
                recent.append({
                    "job_id": job_id,
                    "url": url,
                    "title": data.get("track_name", "Desconocido"),
                    "artist": data.get("artist_name", "Desconocido"),
                    "thumbnail": data.get("thumbnail", ""),
                    "lrc_path": data.get("lrc_path"),
                })
    return {"recent": list(reversed(recent))}

# ── Upload background ─────────────────────────────────────────────────────
def generate_video_proxy(original_path: str, proxy_path: str):
    import imageio_ffmpeg
    import subprocess
    try:
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        # Scale to 480p height, strip audio with -an for super fast decoding
        cmd = [
            ffmpeg_exe, "-y",
            "-i", original_path,
            "-vf", "scale=-2:480",
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-crf", "30",
            "-an",
            proxy_path
        ]
        logger.info(f"Generating video proxy: {' '.join(cmd)}")
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        logger.info(f"Video proxy generated successfully at {proxy_path}")
    except Exception as e:
        logger.error(f"Failed to generate video proxy: {e}")

@app.post("/api/upload_bg")
async def upload_bg(file: UploadFile = File(...)):
    try:
        bg_id = str(uuid.uuid4())
        bg_dir = os.path.join(DATA_DIR, "backgrounds")
        os.makedirs(bg_dir, exist_ok=True)
        safe_name = "".join(c for c in file.filename if c.isalnum() or c in "._-")
        file_path = os.path.join(bg_dir, f"{bg_id}_{safe_name}")
        with open(file_path, "wb") as buf:
            shutil.copyfileobj(file.file, buf)
        logger.info(f"Background video uploaded successfully: {file_path}")
        
        # Start proxy generation thread
        proxy_path = os.path.join(bg_dir, f"proxy_{bg_id}_{safe_name}")
        threading.Thread(target=generate_video_proxy, args=(file_path, proxy_path), daemon=True).start()
        
        return {"bg_id": bg_id, "file_path": file_path}
    except Exception as e:
        logger.exception("Failed to upload background video:")
        return JSONResponse({"error": f"Error al subir el video: {str(e)}", "code": "ERR_UPLOAD_FAILED"}, status_code=500)

# ── Render ─────────────────────────────────────────────────────────────────
@app.post("/api/render")
async def render_video(req: RenderRequest):
    render_id = str(uuid.uuid4())
    jobs[render_id] = {"status": "rendering", "progress": 0}

    def render_task():
        try:
            job_data = jobs.get(req.job_id, {}).get("data", {})
            audio_path = job_data.get("audio_path")
            lrc_path = job_data.get("lrc_path")

            if not audio_path or not os.path.exists(audio_path):
                raise Exception("Audio no encontrado")

            def on_progress(pct):
                jobs[render_id]["progress"] = pct

            def on_process_created(proc):
                active_renders[render_id] = proc

            out_mp4 = process_video(
                audio_path=audio_path,
                bg_video_path=req.bg_path,
                lrc_path=lrc_path,
                start_time=req.start_time,
                duration=req.duration,
                output_dir=os.path.join(DATA_DIR, render_id),
                tracks=req.tracks,
                width=req.width,
                height=req.height,
                on_progress=on_progress,
                on_process_created=on_process_created,
            )
            # Determine output filename
            base_name = req.filename or "export"
            base_name = "".join(c for c in base_name if c.isalnum() or c in "._- ").strip()
            if not base_name:
                base_name = "export"

            # Find a unique filename in Exports folder
            exports_dir = os.path.join(WORK_DIR, "Exports")
            os.makedirs(exports_dir, exist_ok=True)
            
            final_video_path = os.path.join(exports_dir, f"{base_name}.mp4")
            counter = 1
            while os.path.exists(final_video_path):
                final_video_path = os.path.join(exports_dir, f"{base_name} ({counter}).mp4")
                counter += 1

            # Copy video
            shutil.copy2(out_mp4, final_video_path)

            # Copy audio to matching name (with counter if needed)
            final_audio_name = os.path.splitext(os.path.basename(final_video_path))[0]
            final_audio_path = os.path.join(exports_dir, f"{final_audio_name}.wav")
            shutil.copy2(audio_path, final_audio_path)

            jobs[render_id] = {
                "status": "completed",
                "progress": 100,
                "video_path": final_video_path,
            }
        except Exception as e:
            logger.exception(f"Render task failed for job {render_id}:")
            jobs[render_id] = {"status": "error", "error": str(e)}
        finally:
            active_renders.pop(render_id, None)

    threading.Thread(target=render_task, daemon=True).start()
    return {"render_id": render_id}

# ── Download ───────────────────────────────────────────────────────────────
@app.get("/api/download/{render_id}")
async def download_video(render_id: str):
    data = jobs.get(render_id, {})
    if data.get("status") == "completed" and data.get("video_path"):
        return FileResponse(
            data["video_path"],
            media_type="video/mp4",
            filename="lavalyrics_export.mp4",
        )
    return JSONResponse({"error": "Video no listo"}, status_code=404)

# ── Audio / Lyrics streams ─────────────────────────────────────────────────
@app.get("/api/data/{job_id}/audio")
async def get_audio(job_id: str):
    try:
        data = jobs.get(job_id, {}).get("data", {})
        audio_path = data.get("audio_path")
        if audio_path and os.path.exists(audio_path):
            return FileResponse(audio_path, media_type="audio/wav")
        logger.error(f"Audio file not found for job {job_id}")
        return JSONResponse({"error": "Audio no encontrado"}, status_code=404)
    except Exception as e:
        logger.exception(f"Error serving audio for job {job_id}:")
        return JSONResponse({"error": str(e)}, status_code=500)

@app.get("/api/data/{job_id}/lyrics")
async def get_lyrics(job_id: str):
    try:
        data = jobs.get(job_id, {}).get("data", {})
        lrc_path = data.get("lrc_path")
        if lrc_path and os.path.exists(lrc_path):
            with open(lrc_path, "r", encoding="utf-8") as f:
                content = f.read()
            return JSONResponse({"lyrics": content})
        logger.error(f"Lyrics file not found for job {job_id}")
        return JSONResponse({"error": "Letras no encontradas"}, status_code=404)
    except Exception as e:
        logger.exception(f"Error serving lyrics for job {job_id}:")
        return JSONResponse({"error": str(e)}, status_code=500)

# ── Open folder ────────────────────────────────────────────────────────────
@app.post("/api/open_folder")
async def open_folder(req: OpenFolderRequest):
    path = req.path
    if not path and req.render_id:
        data = jobs.get(req.render_id, {})
        video_path = data.get("video_path")
        if video_path:
            path = os.path.dirname(video_path)
    if not path or not os.path.exists(path):
        return JSONResponse({"error": "Ruta no encontrada"}, status_code=404)
    try:
        if sys.platform == "win32":
            os.startfile(path)
        elif sys.platform == "darwin":
            subprocess.Popen(["open", path])
        else:
            subprocess.Popen(["xdg-open", path])
        return {"ok": True}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

# ── Static frontend (production only) ─────────────────────────────────────
if os.path.exists(FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")

# ── Entry point ───────────────────────────────────────────────────────────
def open_browser():
    webbrowser.open("http://127.0.0.1:8000")

if __name__ == "__main__":
    threading.Timer(1.5, open_browser).start()
    uvicorn.run(app, host="127.0.0.1", port=8000)
