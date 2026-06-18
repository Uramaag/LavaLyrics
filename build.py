"""
build.py — LavaLyrics Production Build

Pasos:
  1. Compila el frontend React con Vite  →  client/dist/
  2. Empaqueta todo con PyInstaller      →  dist/LavaLyrics.exe

Uso:
    <tu-python> build.py
"""
import os
import subprocess
import shutil
import sys

def build():
    ROOT       = os.path.dirname(os.path.abspath(__file__))
    CLIENT_DIR = os.path.join(ROOT, "client")
    SERVER_DIR = os.path.join(ROOT, "server")
    DIST_DIR   = os.path.join(ROOT, "dist")

    print("=" * 55)
    print("  LavaLyrics — Build de Producción")
    print("=" * 55)

    # ── 1. Vite build ────────────────────────────────────────
    print("\n[1/3] Compilando frontend (Vite)...")
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
    subprocess.run([npm_cmd, "run", "build"], cwd=CLIENT_DIR, check=True)
    print("  [OK] client/dist/ generado")

    # ── 2. Limpiar builds anteriores ─────────────────────────
    print("\n[2/3] Limpiando builds anteriores...")
    for d in [os.path.join(SERVER_DIR, "build"),
              os.path.join(SERVER_DIR, "dist")]:
        if os.path.exists(d):
            shutil.rmtree(d, ignore_errors=True)
    if os.path.exists(DIST_DIR):
        shutil.rmtree(DIST_DIR, ignore_errors=True)
    os.makedirs(DIST_DIR, exist_ok=True)

    # ── 3. PyInstaller ────────────────────────────────────────
    print("\n[3/3] Empaquetando con PyInstaller...")
    client_dist = os.path.join(CLIENT_DIR, "dist")

    # Separator: ; on Windows, : on Unix
    sep = ";" if sys.platform == "win32" else ":"

    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--name", "LavaLyrics",
        "--onefile",
        "--noconsole",                              # No ventana de consola
        "--add-data", f"{client_dist}{sep}client/dist",
        "--hidden-import", "uvicorn",
        "--hidden-import", "uvicorn.logging",
        "--hidden-import", "uvicorn.loops",
        "--hidden-import", "uvicorn.loops.auto",
        "--hidden-import", "uvicorn.protocols",
        "--hidden-import", "uvicorn.protocols.http",
        "--hidden-import", "uvicorn.protocols.http.auto",
        "--hidden-import", "uvicorn.protocols.websockets",
        "--hidden-import", "uvicorn.protocols.websockets.auto",
        "--hidden-import", "uvicorn.lifespan",
        "--hidden-import", "uvicorn.lifespan.on",
        "--hidden-import", "fastapi",
        "--hidden-import", "pydantic",
        "--hidden-import", "starlette",
        "--hidden-import", "spotdl",
        "--hidden-import", "yt_dlp",
        "--hidden-import", "ytmusicapi",
        "--hidden-import", "pysubs2",
        "--hidden-import", "imageio_ffmpeg",
        "--hidden-import", "httpx",
        "--hidden-import", "anyio",
        "main.py",
    ]
    subprocess.run(cmd, cwd=SERVER_DIR, check=True)

    # ── Mover el exe al dist/ raíz ───────────────────────────
    exe_src = os.path.join(SERVER_DIR, "dist", "LavaLyrics.exe")
    exe_dst = os.path.join(DIST_DIR, "LavaLyrics.exe")

    if os.path.exists(exe_src):
        shutil.copy(exe_src, exe_dst)
        print(f"\n  [OK] Ejecutable listo en:")
        print(f"    {exe_dst}")
    else:
        print(f"\n  [WARNING] No se encontró el exe en {exe_src}")

    print("\n" + "=" * 55)
    print("  Build completado!")
    print("  Ejecuta:  dist\\LavaLyrics.exe")
    print("=" * 55)

if __name__ == "__main__":
    build()
