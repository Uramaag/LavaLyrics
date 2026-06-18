import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { useTimeline } from '../hooks/useTimeline'
import FiltersPanel from './FiltersPanel'

export default function Sidebar({ videoRef, audioRef }) {
  const { fillVideoToEnd } = useTimeline()
  const {
    currentJobId, trackName, artistName, hasLyrics,
    bgVideoPath, bgVideoDuration, audioDuration,
    tracks, updateTrack, setBgVideo, setBgVideoBlobUrl,
    selectedClipId,
  } = useAppStore()

  const [uploadStatus, setUploadStatus] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)

  // Selected clip is a video clip?
  const selectedVideoClip = selectedClipId
    ? tracks.video.find(c => c.id === selectedClipId)
    : null

  const handleFileUpload = async (file) => {
    if (!file) return
    const fileURL = URL.createObjectURL(file)
    const el = document.createElement('video')
    el.src = fileURL
    await new Promise(r => { el.onloadedmetadata = r; el.onerror = r })
    const duration = el.duration || 0

    // Add initial video clip to track
    updateTrack('video', [{
      id: 'video-main-' + Date.now(),
      type: 'video',
      start: 0,
      duration: duration,
      mediaStart: 0,
    }])

    // Set preview source and duration locally immediately
    if (videoRef.current) {
      videoRef.current.src = fileURL
      videoRef.current.load()
    }
    setBgVideoBlobUrl(fileURL)
    setBgVideo(null, duration)

    // Upload to backend
    setUploadStatus('Subiendo video...')
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/upload_bg', { method: 'POST', body: formData })
      const data = await res.json()
      setBgVideo(data.file_path, duration)
      setUploadStatus('Video listo ✓')
    } catch {
      setUploadStatus('Error al subir el video')
    }
  }

  const handleDrop = (e) => {
    e.preventDefault(); setIsDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f && f.type.startsWith('video/')) handleFileUpload(f)
  }

  const handleAddVideoBlock = () => {
    if (!bgVideoDuration) return
    const lastEnd = tracks.video.reduce((m, c) => Math.max(m, c.start + c.duration), 0)
    updateTrack('video', [
      ...tracks.video,
      {
        id: 'video-' + Date.now(),
        type: 'video',
        start: lastEnd,
        duration: bgVideoDuration,
        mediaStart: 0,
      }
    ])
  }

  return (
    <aside className="editor-sidebar">
      {/* Track info */}
      <div className="sidebar-section">
        <div className="sidebar-section-title">Canción</div>
        <div style={{ marginBottom: '6px' }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {trackName || '—'}
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {artistName}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {hasLyrics
            ? <span className="badge badge-success">Letras ✓</span>
            : <span className="badge badge-warning">Sin letras</span>
          }
          {audioDuration > 0 &&
            <span className="badge badge-info">{Math.round(audioDuration)}s</span>
          }
        </div>
      </div>

      {/* Video upload */}
      <div className="sidebar-section">
        <div className="sidebar-section-title">Video de fondo</div>
        <div
          className={`drop-zone${isDragOver ? ' drag-over' : ''}`}
          onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
        >
          <input
            id="bg-video-input"
            type="file"
            accept="video/*"
            onChange={e => handleFileUpload(e.target.files[0])}
          />
          <div className="drop-icon">{bgVideoPath ? '🎬' : '📁'}</div>
          <div className="drop-text">
            {bgVideoPath
              ? `Video cargado (${Math.round(bgVideoDuration)}s)`
              : 'Arrastra o haz click para subir'
            }
          </div>
        </div>
        {uploadStatus && (
          <p style={{ fontSize: '0.78rem', color: 'var(--lava-orange)', marginTop: '6px' }}>
            {uploadStatus}
          </p>
        )}
        {bgVideoPath && bgVideoDuration > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
            <button
              className="btn-secondary"
              style={{ width: '100%', fontSize: '0.82rem' }}
              onClick={handleAddVideoBlock}
            >
              + Repetir bloque de video
            </button>
            <button
              className="btn-secondary"
              style={{ width: '100%', fontSize: '0.82rem', borderColor: 'var(--lava-red)', color: 'var(--text-primary)' }}
              onClick={fillVideoToEnd}
            >
              ⚡ Rellenar video hasta el final
            </button>
          </div>
        )}
      </div>

      {/* Filters — only show when a video clip is selected */}
      {selectedVideoClip ? (
        <FiltersPanel clipId={selectedVideoClip.id} videoRef={videoRef} />
      ) : (
        <div className="sidebar-section">
          <div className="sidebar-section-title">Filtros</div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Selecciona un clip de <strong style={{ color: 'var(--text-secondary)' }}>video</strong> en el timeline para aplicar filtros.
          </p>
        </div>
      )}
    </aside>
  )
}
