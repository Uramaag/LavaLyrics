import os
import sys
import shutil
import threading
import webbrowser
import uvicorn
import uuid
import json
import asyncio
from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from spotify_extractor import get_spotify_track_info
from video_processor import process_video

# Para forzar ejecución desde el .exe o el script
if getattr(sys, 'frozen', False):
    # Si corre desde PyInstaller
    BASE_DIR = sys._MEIPASS
    WORK_DIR = os.getcwd()
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    WORK_DIR = BASE_DIR

DATA_DIR = os.path.join(WORK_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

# Base de datos en memoria para el estado de los trabajos
jobs = {}

# Caché simple para URLs
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

# Cargar en memoria trabajos pasados válidos para que funcionen tras reiniciar
for url, cache_info in url_cache.items():
    if isinstance(cache_info, dict):
        job_id = cache_info.get("job_id")
        data = cache_info.get("data", {})
        audio_path = data.get("audio_path")
        if job_id and audio_path and os.path.exists(audio_path):
            jobs[job_id] = {"status": "completed", "data": data}

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ExtractRequest(BaseModel):
    url: str

@app.post("/api/extract")
async def extract_audio(req: ExtractRequest):
    # Revisar caché
    if req.url in url_cache:
        cache_entry = url_cache[req.url]
        # Puede ser string antiguo o dict nuevo
        cached_job_id = cache_entry if isinstance(cache_entry, str) else cache_entry.get("job_id")
        
        if cached_job_id in jobs and jobs[cached_job_id].get("status") == "completed":
            audio_path = jobs[cached_job_id]["data"].get("audio_path")
            if audio_path and os.path.exists(audio_path):
                return {"job_id": cached_job_id, "status": "cached"}

    job_id = str(uuid.uuid4())
    output_dir = os.path.join(DATA_DIR, job_id)
    jobs[job_id] = {"status": "processing"}

    def extractor_task():
        try:
            data = asyncio.run(get_spotify_track_info(req.url, output_dir))
            jobs[job_id] = {"status": "completed", "data": data}
            url_cache[req.url] = {"job_id": job_id, "data": data}
            save_cache(url_cache)
        except Exception as e:
            jobs[job_id] = {"status": "error", "error": str(e)}

    threading.Thread(target=extractor_task).start()
    return {"job_id": job_id}

@app.get("/api/status/{job_id}")
async def get_status(job_id: str):
    return jobs.get(job_id, {"status": "not_found"})

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
                    "url": url,
                    "title": data.get("track_name", "Desconocido"),
                    "artist": data.get("artist_name", "Desconocido")
                })
    return {"recent": recent}

@app.post("/api/upload_bg")
async def upload_bg(file: UploadFile = File(...)):
    bg_id = str(uuid.uuid4())
    bg_dir = os.path.join(DATA_DIR, "backgrounds")
    os.makedirs(bg_dir, exist_ok=True)
    file_path = os.path.join(bg_dir, f"{bg_id}_{file.filename}")
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {"bg_id": bg_id, "file_path": file_path}

class RenderRequest(BaseModel):
    job_id: str
    bg_path: str
    start_time: float
    duration: float
    tracks: dict = {}

@app.post("/api/render")
async def render_video(req: RenderRequest, background_tasks: BackgroundTasks):
    render_id = str(uuid.uuid4())
    jobs[render_id] = {"status": "rendering"}
    
    def render_task():
        try:
            job_data = jobs.get(req.job_id, {}).get("data", {})
            audio_path = job_data.get("audio_path")
            lrc_path = job_data.get("lrc_path")
            
            if not audio_path or not os.path.exists(audio_path):
                raise Exception("Audio no encontrado")
                
            out_mp4 = process_video(
                audio_path=audio_path,
                bg_video_path=req.bg_path,
                lrc_path=lrc_path,
                start_time=req.start_time,
                duration=req.duration,
                output_dir=os.path.join(DATA_DIR, render_id),
                tracks=req.tracks
            )
            jobs[render_id] = {"status": "completed", "video_path": out_mp4}
        except Exception as e:
            jobs[render_id] = {"status": "error", "error": str(e)}

    # Ejecutar en hilo separado ya que es sincrónico
    threading.Thread(target=render_task).start()
    return {"render_id": render_id}

@app.get("/api/download/{render_id}")
async def download_video(render_id: str):
    data = jobs.get(render_id, {})
    if data.get("status") == "completed" and data.get("video_path"):
        return FileResponse(data["video_path"], media_type="video/mp4", filename="lavalyrics_export.mp4")
    return JSONResponse({"error": "Video no listo o no encontrado"}, status_code=404)

@app.get("/api/data/{job_id}/audio")
async def get_audio(job_id: str):
    data = jobs.get(job_id, {}).get("data", {})
    if data.get("audio_path") and os.path.exists(data["audio_path"]):
        return FileResponse(data["audio_path"], media_type="audio/wav")
    return JSONResponse({"error": "Audio no encontrado"}, status_code=404)

@app.get("/api/data/{job_id}/lyrics")
async def get_lyrics(job_id: str):
    data = jobs.get(job_id, {}).get("data", {})
    if data.get("lrc_path") and os.path.exists(data["lrc_path"]):
        # Asegurar codificación utf-8
        with open(data["lrc_path"], "r", encoding="utf-8") as f:
            content = f.read()
        return JSONResponse({"lyrics": content})
    return JSONResponse({"error": "Letras no encontradas"}, status_code=404)

# Montar frontend estático
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")

def open_browser():
    webbrowser.open("http://127.0.0.1:8000")

if __name__ == "__main__":
    threading.Timer(1.5, open_browser).start()
    uvicorn.run(app, host="127.0.0.1", port=8000)
