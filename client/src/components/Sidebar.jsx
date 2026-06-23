import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import ImportAudioModal from './ImportAudioModal'

export default function Sidebar({ videoRef, audioRef }) {
  const {
    projectName, trackName, artistName, hasLyrics,
    audioDuration, bgVideoDuration,
    tracks, updateTrack,
    selectedClipId, setSelectedClipId,
    exportSettings, setExportSettings,
    parsedLyrics, addToast
  } = useAppStore()

  const [isImportModalOpen, setIsImportModalOpen] = useState(false)

  // 1. Determine selection
  const selectedVideoClip = selectedClipId
    ? tracks.video.find(c => c.id === selectedClipId)
    : null

  const selectedAudioClip = selectedClipId
    ? tracks.audio.find(c => c.id === selectedClipId)
    : null

  // Helpers to update video clip properties
  const updateVideoClipProp = (key, value) => {
    if (!selectedVideoClip) return
    const updated = tracks.video.map(c => {
      if (c.id === selectedVideoClip.id) {
        return { ...c, [key]: value }
      }
      return c
    })
    updateTrack('video', updated)
  }

  // Delete selected video clip
  const deleteSelectedClip = () => {
    if (!selectedVideoClip) return
    updateTrack('video', tracks.video.filter(c => c.id !== selectedVideoClip.id))
    setSelectedClipId(null)
    addToast('Clip de video eliminado', 'success')
  }

  // Modify lyrics offset (mediaStart of lyrics track)
  const lyricsClip = tracks.lyrics[0]
  const currentOffset = lyricsClip ? lyricsClip.mediaStart : 0

  const handleOffsetChange = (val) => {
    const num = parseFloat(val) || 0
    const updated = tracks.lyrics.map(c => ({ ...c, mediaStart: num }))
    updateTrack('lyrics', updated)
  }

  // Format time
  const fmtTime = (s) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    const ms = Math.floor((s % 1) * 10)
    return `${m}:${sec.toString().padStart(2, '0')}.${ms}`
  }

  return (
    <aside className="editor-sidebar" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-elevated)', borderRight: '1px solid var(--border-subtle)', overflowY: 'auto' }}>
      
      {/* 1. INSPECTOR DE CLIP DE VIDEO SELECCIONADO */}
      {selectedVideoClip && (
        <div style={{ padding: '16px' }}>
          <div className="sidebar-section-title" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--lava-red)', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Inspector: Clip de Video
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label className="label" style={{ fontSize: '0.65rem' }}>Inicio (s)</label>
                <input 
                  type="number" 
                  step="0.1"
                  value={selectedVideoClip.start.toFixed(1)}
                  onChange={e => updateVideoClipProp('start', parseFloat(e.target.value) || 0)}
                  style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                />
              </div>
              <div>
                <label className="label" style={{ fontSize: '0.65rem' }}>Duración (s)</label>
                <input 
                  type="number" 
                  step="0.1"
                  value={selectedVideoClip.duration.toFixed(1)}
                  onChange={e => updateVideoClipProp('duration', parseFloat(e.target.value) || 0)}
                  style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                />
              </div>
            </div>

            <div>
              <label className="label">Asignar a Capa</label>
              <select
                value={selectedVideoClip.layer || 0}
                onChange={e => updateVideoClipProp('layer', parseInt(e.target.value) || 0)}
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  padding: '8px',
                  borderRadius: 'var(--radius-md)',
                  width: '100%',
                  fontSize: '0.8rem',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value={0}>Capa Video 1 (Fondo)</option>
                <option value={1}>Capa Video 2</option>
                <option value={2}>Capa Video 3</option>
                <option value={3}>Capa Video 4</option>
              </select>
            </div>

            <div style={{ marginTop: '8px' }}>
              <button 
                className="btn-secondary" 
                style={{ width: '100%', borderColor: 'var(--lava-red)', color: 'var(--text-primary)', fontSize: '0.8rem', padding: '8px' }}
                onClick={deleteSelectedClip}
              >
                🗑️ Eliminar Clip de Video
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. INSPECTOR DE CLIP DE AUDIO Y LETRAS SELECCIONADO */}
      {selectedAudioClip && (
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div className="sidebar-section-title" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--lava-red)', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Inspector: Audio & Letras
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>{trackName}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>{artistName}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label className="label" style={{ fontSize: '0.65rem' }}>Inicio (s)</label>
                <input 
                  type="number" 
                  value={selectedAudioClip.start}
                  disabled
                  style={{ padding: '6px 10px', fontSize: '0.8rem', opacity: 0.6 }}
                />
              </div>
              <div>
                <label className="label" style={{ fontSize: '0.65rem' }}>Duración (s)</label>
                <input 
                  type="number" 
                  value={selectedAudioClip.duration.toFixed(1)}
                  disabled
                  style={{ padding: '6px 10px', fontSize: '0.8rem', opacity: 0.6 }}
                />
              </div>
            </div>

            <div>
              <label className="label">Desfase de Letras (s)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input 
                  type="number" 
                  step="0.1"
                  value={currentOffset}
                  onChange={e => handleOffsetChange(e.target.value)}
                  style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  (+ atrasa, - adelanta)
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label className="label" style={{ fontSize: '0.65rem' }}>Tamaño Letra (px)</label>
                <input 
                  type="number" 
                  min="10"
                  max="120"
                  value={exportSettings.fontSize || 28}
                  onChange={e => setExportSettings({ fontSize: parseInt(e.target.value) || 28 })}
                  style={{ padding: '6px 10px', fontSize: '0.8rem', width: '100%' }}
                />
              </div>
              <div>
                <label className="label" style={{ fontSize: '0.65rem' }}>Interletrado (px)</label>
                <input 
                  type="number" 
                  min="-10"
                  max="40"
                  value={exportSettings.letterSpacing || 0}
                  onChange={e => setExportSettings({ letterSpacing: parseInt(e.target.value) || 0 })}
                  style={{ padding: '6px 10px', fontSize: '0.8rem', width: '100%' }}
                />
              </div>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <label className="label" style={{ marginBottom: '6px' }}>Letras Sincronizadas</label>
              <div style={{ flex: 1, background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '10px', overflowY: 'auto', fontSize: '0.78rem', lineHeight: '1.4' }}>
                {parsedLyrics.length > 0 ? (
                  parsedLyrics.map((lyr, index) => (
                    <div key={index} style={{ marginBottom: '6px', color: 'var(--text-secondary)' }}>
                      <span style={{ color: 'var(--lava-orange)', fontWeight: 'bold', marginRight: '6px' }}>
                        [{fmtTime(lyr.time)}]
                      </span>
                      {lyr.text}
                    </div>
                  ))
                ) : (
                  <div style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>No hay letras sincronizadas cargadas.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. INSPECTOR GLOBAL DEL PROYECTO (SIN SELECCIÓN) */}
      {!selectedVideoClip && !selectedAudioClip && (
        <div style={{ padding: '16px' }}>
          <div className="sidebar-section-title" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--lava-red)', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Propiedades del Proyecto
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label className="label">Nombre</label>
              <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{projectName}</div>
            </div>

            <div>
              <label className="label">Configuraciones de Secuencia</label>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div>📐 Orientación: <strong>{exportSettings.orientation === 'vertical' ? 'Vertical (9:16)' : 'Horizontal (16:9)'}</strong></div>
                <div>📺 Resolución: <strong>{exportSettings.resolution} px</strong></div>
                <div>🎞️ Fotogramas: <strong>{exportSettings.fps} FPS</strong></div>
              </div>
            </div>

            <div className="separator" style={{ margin: '8px 0' }} />

            <div>
              <label className="label">Audio Importado</label>
              {trackName ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '0.78rem', padding: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontWeight: 600 }}>{trackName}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>{artistName} ({Math.round(audioDuration)}s)</div>
                  </div>
                  <button 
                    className="btn-secondary" 
                    style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                    onClick={() => setIsImportModalOpen(true)}
                  >
                    🔄 Reemplazar Audio
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '8px' }}>Sin canción importada.</div>
                  <button 
                    className="btn-primary" 
                    style={{ fontSize: '0.75rem', padding: '6px 12px', width: '100%' }}
                    onClick={() => setIsImportModalOpen(true)}
                  >
                    📥 Importar Audio
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      <ImportAudioModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />
    </aside>
  )
}
