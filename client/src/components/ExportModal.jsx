import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import Slider from 'rc-slider'
import 'rc-slider/assets/index.css'
import { useAppStore } from '../store/useAppStore'

const RESOLUTIONS = [
  { label: '9:16', sub: '1080×1920', value: '1080x1920', icon: '📱' },
  { label: '16:9', sub: '1920×1080', value: '1920x1080', icon: '🖥️' },
  { label: '1:1',  sub: '1080×1080', value: '1080x1080', icon: '⬜' },
  { label: '4:5',  sub: '864×1080',  value: '864x1080',  icon: '📷' },
  { label: '21:9', sub: '2560×1080', value: '2560x1080', icon: '🎬' },
  { label: '9:19.5', sub: '1080×2340', value: '1080x2340', icon: '📲' },
]

const SLIDER_STYLE = {
  rail: { background: 'var(--bg-elevated)', height: 4 },
  track: { background: 'linear-gradient(90deg, #e63946, #ff6b35)', height: 4 },
  handle: {
    borderColor: 'var(--lava-red)', background: '#fff',
    width: 16, height: 16, marginTop: -6,
    boxShadow: '0 0 8px rgba(230,57,70,0.5)', opacity: 1,
  },
}

export default function ExportModal({ videoRef, audioRef }) {
  const {
    setExportModalOpen, exportSettings, setExportSettings,
    audioDuration, tracks, currentJobId, bgVideoPath, bgVideoBlobUrl,
    clipFilters, parsedLyrics,
    setRenderState, setExportModalOpen: closeModal,
    setMasterTime, trackName,
  } = useAppStore()

  const [exportName, setExportName] = useState('')
  const { resolution, inPoint, outPoint } = exportSettings
  const maxDuration = audioDuration || 60
  const exportVideoRef = useRef(null)

  // Time string states for text inputs
  const [inStr, setInStr] = useState('')
  const [outStr, setOutStr] = useState('')

  // Sync text inputs when sliders or trim changes
  useEffect(() => {
    setInStr(formatTime(inPoint))
  }, [inPoint]) // eslint-disable-line

  useEffect(() => {
    setOutStr(formatTime(outPoint))
  }, [outPoint]) // eslint-disable-line

  const prevIn = useRef(inPoint)
  const prevOut = useRef(outPoint)

  // Seek preview video in modal when adjusting trim slider or inputs
  useEffect(() => {
    if (!exportVideoRef.current) return
    if (prevIn.current !== inPoint) {
      exportVideoRef.current.currentTime = inPoint
      prevIn.current = inPoint
    } else if (prevOut.current !== outPoint) {
      exportVideoRef.current.currentTime = outPoint
      prevOut.current = outPoint
    }
  }, [inPoint, outPoint])

  const parseTimeInput = (str, fallback) => {
    const cleaned = str.trim()
    if (!cleaned) return fallback
    const parts = cleaned.split(':')
    if (parts.length === 2) {
      const m = parseFloat(parts[0])
      const s = parseFloat(parts[1])
      if (!isNaN(m) && !isNaN(s) && m >= 0 && s >= 0 && s < 60) {
        return m * 60 + s
      }
    } else if (parts.length === 1) {
      const s = parseFloat(parts[0])
      if (!isNaN(s) && s >= 0) {
        return s
      }
    }
    return fallback
  }

  const handleInBlur = () => {
    const val = parseTimeInput(inStr, inPoint)
    const clamped = Math.max(0, Math.min(val, outPoint - 0.5))
    setExportSettings({ inPoint: clamped, outPoint })
    setInStr(formatTime(clamped))
  }

  const handleOutBlur = () => {
    const val = parseTimeInput(outStr, outPoint)
    const clamped = Math.max(inPoint + 0.5, Math.min(val, maxDuration))
    setExportSettings({ inPoint, outPoint: clamped })
    setOutStr(formatTime(clamped))
  }

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur()
    }
  }

  const formatTime = (s) => {
    const m = Math.floor(s / 60)
    const sec = (s % 60).toFixed(1)
    return `${String(m).padStart(2, '0')}:${String(parseFloat(sec) < 10 ? '0' : '')}${sec}`
  }

  const handleExport = async () => {
    const trimmedName = exportName.trim()
    if (!trimmedName) {
      alert('Por favor, ingresa un nombre para el video antes de exportar.')
      return
    }
    if (!currentJobId || !bgVideoPath) {
      alert('Asegúrate de tener una canción y un video de fondo cargados.')
      return
    }

    // Collect filters for each video clip
    const videoClipsWithFilters = tracks.video.map(c => ({
      ...c,
      filters: clipFilters[c.id] || { brightness: 1, contrast: 1, saturation: 1, hue: 0 },
    }))

    const [w, h] = resolution.split('x').map(Number)

    closeModal(false)
    setRenderState(true, 0, null)

    try {
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: currentJobId,
          bg_path: bgVideoPath,
          start_time: inPoint,
          duration: outPoint - inPoint,
          tracks: {
            video: videoClipsWithFilters,
            audio: tracks.audio,
            lyrics: tracks.lyrics,
          },
          width: w,
          height: h,
          filename: trimmedName,
        }),
      })
      const data = await res.json()
      setRenderState(true, 0, data.render_id)
    } catch (e) {
      setRenderState(false, 0, null)
      alert('Error al iniciar el renderizado: ' + e.message)
    }
  }

  return (
    <div className="modal-overlay" onClick={() => setExportModalOpen(false)}>
      <motion.div
        className="modal-box"
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        style={{ maxWidth: 820, width: '90%' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="export-modal-inner" style={{ display: 'flex', gap: '28px', maxHeight: '80vh', overflowY: 'auto' }}>
          {/* Left Column: controls */}
          <div className="export-modal-left" style={{ flex: 1.2, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
              <h2>Exportar Video</h2>
            </div>

            {/* Preview */}
            <div className="export-preview-area" style={{ marginBottom: 'var(--space-lg)' }}>
              <video
                ref={exportVideoRef}
                src={bgVideoBlobUrl || (bgVideoPath ? `/api/video?path=${encodeURIComponent(bgVideoPath)}` : '')}
                muted
                playsInline
                style={{ maxHeight: 240, width: '100%', objectFit: 'contain', background: '#000', borderRadius: 'var(--radius-md)' }}
                controls
              />
            </div>

            {/* Filename input */}
            <div className="export-section" style={{ marginBottom: 'var(--space-md)' }}>
              <div className="export-section-title">Nombre del video</div>
              <input
                type="text"
                placeholder="Ej: MiVideoLavaLyrics"
                value={exportName}
                onChange={e => setExportName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                El video y el audio se guardarán en la carpeta raíz <strong style={{ color: 'var(--lava-orange)' }}>Exports/</strong> con este nombre.
              </p>
            </div>

            {/* Trim / In-Out points */}
            <div className="export-section">
              <div className="export-section-title">Recorte de duración</div>
              <div className="trim-slider-wrap">
                <Slider
                  range
                  min={0}
                  max={maxDuration}
                  step={0.1}
                  value={[inPoint, outPoint]}
                  onChange={([i, o]) => setExportSettings({ inPoint: i, outPoint: o })}
                  styles={SLIDER_STYLE}
                />
                 <div className="trim-range-display" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                     <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>⏮</span>
                     <input
                       type="text"
                       value={inStr}
                       onChange={e => setInStr(e.target.value)}
                       onBlur={handleInBlur}
                       onKeyDown={handleInputKeyDown}
                       style={{
                         width: '75px',
                         padding: '4px 8px',
                         background: 'var(--bg-elevated)',
                         border: '1px solid var(--border-subtle)',
                         borderRadius: 'var(--radius-sm)',
                         color: 'var(--text-primary)',
                         fontSize: '0.82rem',
                         textAlign: 'center',
                         outline: 'none',
                         fontFamily: 'monospace',
                       }}
                     />
                   </div>

                   <span style={{ color: 'var(--lava-orange)', fontWeight: 600, fontSize: '0.85rem' }}>
                     Duración: {formatTime(outPoint - inPoint)}
                   </span>

                   <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                     <input
                       type="text"
                       value={outStr}
                       onChange={e => setOutStr(e.target.value)}
                       onBlur={handleOutBlur}
                       onKeyDown={handleInputKeyDown}
                       style={{
                         width: '75px',
                         padding: '4px 8px',
                         background: 'var(--bg-elevated)',
                         border: '1px solid var(--border-subtle)',
                         borderRadius: 'var(--radius-sm)',
                         color: 'var(--text-primary)',
                         fontSize: '0.82rem',
                         textAlign: 'center',
                         outline: 'none',
                         fontFamily: 'monospace',
                       }}
                     />
                     <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>⏭</span>
                   </div>
                 </div>
              </div>
            </div>

            {/* Resolution */}
            <div className="export-section" style={{ marginBottom: 'var(--space-lg)' }}>
              <div className="export-section-title">Resolución y formato</div>
              <div className="resolution-grid">
                {RESOLUTIONS.map(r => (
                  <button
                    key={r.value}
                    className={`resolution-btn${resolution === r.value ? ' selected' : ''}`}
                    onClick={() => setExportSettings({ resolution: r.value })}
                  >
                    <span className="res-label">{r.icon} {r.label}</span>
                    <span className="res-sub">{r.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Export button */}
            <button
              id="btn-start-export"
              className="btn-primary"
              style={{ width: '100%', padding: '14px', fontSize: '1rem' }}
              onClick={handleExport}
            >
              🚀 Exportar en {resolution}
            </button>
          </div>

          {/* Right Column: Synced Lyrics */}
          <div className="export-modal-right" style={{ flex: 1, minWidth: 260, borderLeft: '1px solid var(--border-subtle)', paddingLeft: '24px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Letras Sincronizadas
              </h3>
              <button
                className="btn-ghost"
                style={{ marginLeft: 'auto', fontSize: '1.2rem', padding: '4px 8px' }}
                onClick={() => setExportModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.4' }}>
              Haz clic en un verso para saltar a ese momento y establecer el inicio de recorte.
            </p>
            
            <div className="export-lyrics-list" style={{ flex: 1, overflowY: 'auto', maxHeight: '420px', gap: '8px', display: 'flex', flexDirection: 'column', paddingRight: '4px' }}>
              {parsedLyrics && parsedLyrics.length > 0 ? (
                parsedLyrics.map((lyr, index) => {
                  const isActive = inPoint >= lyr.time && (index === parsedLyrics.length - 1 || inPoint < parsedLyrics[index + 1].time)
                  return (
                    <button
                      key={index}
                      className="export-lyric-item"
                      style={{
                        textAlign: 'left',
                        background: isActive ? 'rgba(230, 57, 70, 0.15)' : 'var(--bg-elevated)',
                        border: isActive ? '1px solid var(--lava-red)' : '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '10px 14px',
                        cursor: 'pointer',
                        fontSize: '0.82rem',
                        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                        transition: 'all 0.15s ease',
                        lineHeight: '1.3'
                      }}
                      onClick={() => {
                        const newIn = lyr.time
                        const newOut = Math.max(outPoint, newIn + 1)
                        setExportSettings({ inPoint: newIn, outPoint: newOut })
                        setMasterTime(newIn)
                        if (exportVideoRef.current) {
                          exportVideoRef.current.currentTime = newIn
                        }
                      }}
                      onMouseEnter={e => {
                        if (!isActive) {
                          e.currentTarget.style.borderColor = 'var(--lava-red)'
                          e.currentTarget.style.color = 'var(--text-primary)'
                          e.currentTarget.style.background = 'var(--bg-hover)'
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isActive) {
                          e.currentTarget.style.borderColor = 'var(--border-subtle)'
                          e.currentTarget.style.color = 'var(--text-secondary)'
                          e.currentTarget.style.background = 'var(--bg-elevated)'
                        }
                      }}
                    >
                      <div style={{ color: 'var(--lava-orange)', fontWeight: 700, fontSize: '0.72rem', marginBottom: '3px' }}>
                        ⏱️ {formatTime(lyr.time)}
                      </div>
                      <div>{lyr.text}</div>
                    </button>
                  )
                })
              ) : (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '40px 20px', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
                  📝 Sin letras sincronizadas
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
