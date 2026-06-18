import os
import subprocess
import shutil

def build():
    print("Limpiando build anterior...")
    if os.path.exists("build"):
        shutil.rmtree("build")
    if os.path.exists("dist"):
        shutil.rmtree("dist", ignore_errors=True)
    
    print("Construyendo ejecutable con PyInstaller...")
    cmd = [
        "pyinstaller",
        "--name", "LavaLyrics",
        "--onefile",
        "--add-data", "../frontend:frontend",
        "--hidden-import", "uvicorn",
        "--hidden-import", "fastapi",
        "--hidden-import", "pydantic",
        "--hidden-import", "starlette",
        "--hidden-import", "spotdl",
        "--hidden-import", "pysubs2",
        "--hidden-import", "imageio_ffmpeg",
        "--hidden-import", "httpx",
        "main.py"
    ]
    
    # Run from backend dir
    subprocess.run(cmd, cwd="backend", check=True)
    
    # Move the exe to the root
    if not os.path.exists("dist"):
        os.makedirs("dist")
        
    shutil.copy("backend/dist/LavaLyrics.exe", "dist/LavaLyrics.exe")
    print("¡Build completado! El ejecutable está en dist/LavaLyrics.exe")

if __name__ == "__main__":
    build()
