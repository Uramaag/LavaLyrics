# 🌋 LavaLyrics

Crea clips musicales virales con letras sincronizadas al estilo TikTok y Reels.

## Estructura del proyecto

```
LavaLyrics/
│
├── client/              ← Frontend (Vite + React)
│   ├── src/
│   │   ├── screens/     ← Pantallas (Intro, Progress, Editor)
│   │   ├── components/  ← Componentes UI (Timeline, Sidebar, Modales…)
│   │   ├── hooks/       ← Lógica reutilizable (preview, timeline, polling)
│   │   ├── store/       ← Estado global (Zustand)
│   │   └── styles/      ← Design system (CSS tokens, editor, modales)
│   ├── package.json
│   └── vite.config.js   ← Proxy /api → :8000 en dev
│
├── server/              ← Backend (Python + FastAPI)
│   ├── main.py          ← API endpoints
│   ├── spotify_extractor.py
│   └── video_processor.py
│
├── dist/                ← 📦 OUTPUT — El .exe está aquí
│   └── LavaLyrics.exe
│
├── dev.py               ← 🚀 Servidor de desarrollo
└── build.py             ← 🔨 Build de producción
```

---

## Desarrollo (con hot reload)

```bash
# Ejecuta con el Python que tiene uvicorn y spotdl instalados
<tu-python> dev.py
```

- **Frontend**: http://localhost:5173 — modifica `.jsx` y actualiza al instante
- **API**: http://localhost:8000 — modifica `.py` y uvicorn recarga solo

---

## Build (.exe)

```bash
<tu-python> build.py
```

El ejecutable queda en:
```
dist\LavaLyrics.exe   ← doble clic para abrir la app
```

---

## Tecnologías

| Capa | Stack |
|---|---|
| Frontend | React 18 + Vite 5 + Zustand + Framer Motion |
| Backend | Python + FastAPI + uvicorn |
| Audio/Video | spotdl + yt-dlp + FFmpeg (imageio-ffmpeg) |
| Letras | lrclib.net API |
| Distribución | PyInstaller (.exe sin dependencias) |
