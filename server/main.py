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

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(LOG_DIR, exist_ok=True)

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

url_cache = load_cache()

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
STATE_FILE = os.path.join(DATA_DIR, "project_state.json")

class ProjectState(BaseModel):
    state: dict

@app.post("/api/project/state")
async def save_project_state(req: ProjectState):
    try:
        with open(STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(req.state, f, ensure_ascii=False, indent=2)
        return {"status": "ok"}
    except Exception as e:
        logger.exception("Error saving project state:")
        return JSONResponse({"error": str(e)}, status_code=500)

@app.get("/api/project/state")
async def get_project_state():
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            job_id = data.get("currentJobId")
            if job_id:
                job_dir = os.path.join(DATA_DIR, job_id)
                if os.path.exists(job_dir):
                    wav_files = [f for f in os.listdir(job_dir) if f.endswith(".wav")]
                    if wav_files:
                        return {"state": data}
        except Exception as e:
            logger.error(f"Error loading project state: {e}")
    return {"state": None}

@app.delete("/api/project/state")
async def delete_project_state():
    if os.path.exists(STATE_FILE):
        try:
            os.remove(STATE_FILE)
        except Exception as e:
            logger.error(f"Error deleting project state: {e}")
    return {"status": "ok"}

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
async def get_video(path: str):
    if not path or not os.path.exists(path):
        return JSONResponse({"error": "Video no encontrado"}, status_code=404)
    return FileResponse(path, media_type="video/mp4")

# ── Search ───────────────────────────────────────────────────────────────
@app.get("/api/search")
async def search_songs(q: str = ""):
    if not q.strip():
        return {"results": []}
    try:
        results = await search_tracks(q)
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
                jobs[job_id] = {"status": "error", "error": str(e)}

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
        return {"bg_id": bg_id, "file_path": file_path}
    except Exception as e:
        logger.exception("Failed to upload background video:")
        return JSONResponse({"error": f"Error al subir el video: {str(e)}"}, status_code=500)

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
