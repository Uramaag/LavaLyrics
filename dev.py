"""
dev.py — LavaLyrics Development Server
Levanta FastAPI (uvicorn --reload) + Vite HMR en paralelo.

Uso:
    <tu-python> dev.py

Frontend: http://localhost:5173  (Vite — hot reload)
API:      http://localhost:8000  (FastAPI — auto-reload)
"""
import subprocess
import sys
import os
import threading
import time
import signal

ROOT        = os.path.dirname(os.path.abspath(__file__))
CLIENT_DIR  = os.path.join(ROOT, "client")
SERVER_DIR  = os.path.join(ROOT, "server")

processes = []

def run_backend():
    p = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app",
         "--reload", "--host", "127.0.0.1", "--port", "8000"],
        cwd=SERVER_DIR,
    )
    processes.append(p)
    p.wait()

def run_frontend():
    time.sleep(1.5)
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
    p = subprocess.Popen(
        [npm_cmd, "run", "dev"],
        cwd=CLIENT_DIR,
    )
    processes.append(p)
    p.wait()

def shutdown(sig, frame):
    print("\n[dev] Cerrando servidores...")
    for p in processes:
        try:
            p.terminate()
        except Exception:
            pass
    sys.exit(0)

if __name__ == "__main__":
    try:
        signal.signal(signal.SIGINT, shutdown)
        signal.signal(signal.SIGTERM, shutdown)
    except Exception:
        pass

    print("=" * 55)
    print("  LavaLyrics — Servidor de Desarrollo")
    print(f"  Python:   {sys.executable}")
    print("  Frontend: http://localhost:5173  (Vite HMR)")
    print("  Backend:  http://localhost:8000  (FastAPI)")
    print("  Ctrl+C para detener")
    print("=" * 55)

    t1 = threading.Thread(target=run_backend,  daemon=True)
    t2 = threading.Thread(target=run_frontend, daemon=True)
    t1.start()
    t2.start()

    try:
        while t1.is_alive() or t2.is_alive():
            time.sleep(0.5)
    except KeyboardInterrupt:
        shutdown(None, None)
