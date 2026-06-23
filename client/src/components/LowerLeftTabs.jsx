import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { useTimeline } from '../hooks/useTimeline'
import FiltersPanel from './FiltersPanel'
import ImportAudioModal from './ImportAudioModal'

export default function LowerLeftTabs({ videoRef }) {
  const [activeTab, setActiveTab] = useState('effects') // 'effects' | 'media'
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false)
  const { fillVideoToEnd } = useTimeline()
  const {
    trackName, artistName, hasLyrics,
    bgVideoPath, bgVideoDuration, audioDuration,
    tracks, updateTrack, setBgVideo, setBgVideoBlobUrl,
    selectedClipId, addToast
  } = useAppStore()

  const [uploadStatus, setUploadStatus] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)

  // Selected video clip for Filters
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

    if (videoRef.current) {
      videoRef.current.src = fileURL
      videoRef.current.load()
    }
    setBgVideoBlobUrl(fileURL)
    setBgVideo(null, duration)

    setUploadStatus('Subiendo video...')
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/upload_bg', { method: 'POST', body: formData })
      const data = await res.json()
      setBgVideo(data.file_path, duration)
      setUploadStatus('Video listo ✓')
      addToast('Video de fondo subido con éxito', 'success')
    } catch {
      setUploadStatus('Error al subir el video')
      addToast('Error al subir el video de fondo', 'error', 'ERR_UPLOAD_FAILED')
    }
  }

  const handleDrop = (e) => {
    e.preventDefault(); setIsDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f && f.type.startsWith('video/')) handleFileUpload(f)
  }

  return (
    <div className="lower-left-tabs-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-elevated)' }}>
      {/* Tab Headers */}
      <div className="tab-headers" style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.15)' }}>
        <button 
          className={`tab-btn ${activeTab === 'effects' ? 'active' : ''}`}
          onClick={() => setActiveTab('effects')}
          style={{
            flex: 1,
            padding: '10px 14px',
            background: activeTab === 'effects' ? 'var(--bg-elevated)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'effects' ? '2px solid var(--lava-red)' : '2px solid transparent',
            color: activeTab === 'effects' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.82rem',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          ✨ Efectos y Filtros
        </button>
        <button 
          className={`tab-btn ${activeTab === 'media' ? 'active' : ''}`}
          onClick={() => setActiveTab('media')}
          style={{
            flex: 1,
            padding: '10px 14px',
            background: activeTab === 'media' ? 'var(--bg-elevated)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'media' ? '2px solid var(--lava-red)' : '2px solid transparent',
            color: activeTab === 'media' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.82rem',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          📁 Medios Importados
        </button>
      </div>

      {/* Tab Contents */}
      <div className="tab-content" style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
        {activeTab === 'effects' && (
          <div>
            {selectedVideoClip ? (
              <FiltersPanel clipId={selectedVideoClip.id} videoRef={videoRef} />
            ) : (
              <FiltersPanel clipId={null} videoRef={videoRef} draggableOnly />
            )}
          </div>
        )}

        {activeTab === 'media' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Audio asset */}
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', padding: '10px 12px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)' }}>Audio del Proyecto</div>
                <button
                  className="btn-secondary"
                  onClick={() => setIsAudioModalOpen(true)}
                  style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px' }}
                >
                  {trackName ? '🔄 Reemplazar' : '📥 Importar'}
                </button>
              </div>
              {trackName ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ fontSize: '1.4rem' }}>🎵</div>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{trackName}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{artistName} ({Math.round(audioDuration)}s)</div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin audio importado. Haz click en importar o click derecho en la pista.</div>
              )}
            </div>

            {/* Video Background asset */}
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', padding: '10px 12px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: '8px', color: 'var(--text-primary)' }}>Video de Fondo</div>
              
              <div
                className={`drop-zone${isDragOver ? ' drag-over' : ''}`}
                onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                style={{
                  border: '1px dashed var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px 10px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: isDragOver ? 'rgba(230,57,70,0.1)' : 'transparent',
                  transition: 'all 0.2s'
                }}
                onClick={() => document.getElementById('media-bg-video-input').click()}
              >
                <input
                  id="media-bg-video-input"
                  type="file"
                  accept="video/*"
                  onChange={e => handleFileUpload(e.target.files[0])}
                  style={{ display: 'none' }}
                />
                <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>{bgVideoPath ? '🎬' : '📁'}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {bgVideoPath
                    ? `Cargado (${Math.round(bgVideoDuration)}s)`
                    : 'Arrastra o haz click para subir'
                  }
                </div>
              </div>
              
              {uploadStatus && (
                <p style={{ fontSize: '0.72rem', color: 'var(--lava-orange)', marginTop: '6px', textAlign: 'center' }}>
                  {uploadStatus}
                </p>
              )}

              {bgVideoPath && bgVideoDuration > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                  <button
                    className="btn-secondary"
                    style={{ width: '100%', fontSize: '0.75rem', padding: '6px 12px' }}
                    onClick={fillVideoToEnd}
                  >
                    ⚡ Rellenar video hasta el final
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <ImportAudioModal
        isOpen={isAudioModalOpen}
        onClose={() => setIsAudioModalOpen(false)}
      />
    </div>
  )
}
