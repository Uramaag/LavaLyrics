import { useRef, useState, useCallback, useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { useTimeline } from '../hooks/useTimeline'

const TRACK_DEFS = [
  { name: 'audio_lyrics', label: 'Audio & Letras', locked: true  },
  { name: 'video',        label: 'Video',          locked: false },
]

function TimelineClip({ clip, trackName, pixelsPerSecond, isCutMode, onSelect, isSelected, onContextMenu }) {
  const { moveClip, resizeClipLeft, resizeClipRight, cutClip } = useTimeline()
  const dragState = useRef(null)

  const handleMouseDown = useCallback((e, action) => {
    if (isCutMode) return
    e.stopPropagation()
    dragState.current = {
      action,
      startX: e.clientX,
      initialStart: clip.start,
      initialDuration: clip.duration,
      initialMediaStart: clip.mediaStart,
      moved: false,
    }

    const onMove = (me) => {
      if (!dragState.current) return
      const diffPx = me.clientX - dragState.current.startX
      if (Math.abs(diffPx) > 3) dragState.current.moved = true
      if (!dragState.current.moved) return

      const diffTime = diffPx / pixelsPerSecond
      const { action, initialStart, initialDuration } = dragState.current
      const mappedTrack = trackName === 'audio_lyrics' ? 'audio' : trackName

      if (action === 'move') {
        moveClip(mappedTrack, clip.id, initialStart + diffTime)
      } else if (action === 'resize-right') {
        resizeClipRight(mappedTrack, clip.id, initialStart + initialDuration + diffTime)
      } else if (action === 'resize-left') {
        resizeClipLeft(mappedTrack, clip.id, initialStart + diffTime)
      }
    }

    const onUp = () => {
      dragState.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [clip, trackName, pixelsPerSecond, isCutMode, moveClip, resizeClipLeft, resizeClipRight])

  const handleClick = (e) => {
    const mappedTrack = trackName === 'audio_lyrics' ? 'audio' : trackName
    if (isCutMode) {
      const rect = e.currentTarget.getBoundingClientRect()
      const clickTime = (e.clientX - rect.left) / pixelsPerSecond
      cutClip(mappedTrack, clip.id, clickTime)
      return
    }
    if (dragState.current?.moved) return
    onSelect(clip.id)
    e.stopPropagation()
  }

  const left = clip.start * pixelsPerSecond
  const width = clip.duration * pixelsPerSecond

  if (trackName === 'audio_lyrics') {
    return (
      <div
        className={`clip clip-audio-lyrics${isSelected ? ' selected' : ''}`}
        style={{ left, width: Math.max(width, 30) }}
        onMouseDown={(e) => handleMouseDown(e, 'move')}
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, clip.id, trackName)}
      >
        {/* Left resize handle */}
        <div
          className="resize-handle-left"
          onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, 'resize-left') }}
          onClick={e => e.stopPropagation()}
        />
        
        {/* Split container visually representing Audio (top) and Letras (bottom) */}
        <div className="clip-split-container">
          <div className="clip-split-top">
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              🎵 Audio ({clip.duration.toFixed(1)}s)
            </span>
          </div>
          <div className="clip-split-bottom">
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              📝 Letras
            </span>
          </div>
        </div>

        {/* Right resize handle */}
        <div
          className="resize-handle-right"
          onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, 'resize-right') }}
          onClick={e => e.stopPropagation()}
        />
      </div>
    )
  }

  const clipClass = `clip clip-${clip.type}${isSelected ? ' selected' : ''}`

  return (
    <div
      className={clipClass}
      style={{ left, width: Math.max(width, 20) }}
      onMouseDown={(e) => handleMouseDown(e, 'move')}
      onClick={handleClick}
      onContextMenu={(e) => onContextMenu(e, clip.id, trackName)}
    >
      <div
        className="resize-handle-left"
        onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, 'resize-left') }}
        onClick={e => e.stopPropagation()}
      />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', pointerEvents: 'none', paddingLeft: '6px' }}>
        {clip.type === 'video' ? '🎬 Video' : clip.type === 'lyrics' ? '📝 Letras' : '🎵 Audio'}
      </span>
      <div
        className="resize-handle-right"
        onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, 'resize-right') }}
        onClick={e => e.stopPropagation()}
      />
    </div>
  )
}

export default function Timeline({ videoRef, audioRef }) {
  const {
    tracks, audioDuration,
    masterTime, setMasterTime,
    pixelsPerSecond, setPixelsPerSecond,
    selectedClipId, setSelectedClipId,
    updateTrack,
  } = useAppStore()

  const [isCutMode, setIsCutMode] = useState(false)
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false)
  const [cutGuideX, setCutGuideX] = useState(null)
  const [contextMenu, setContextMenu] = useState(null) // { x, y, clipId, trackName }

  const copiedType = window.__copiedClip?.type
  const isTargetVideo = contextMenu?.trackName === 'video'
  const isTargetAudioLyrics = contextMenu?.trackName === 'audio_lyrics'
  const canPaste = !!(window.__copiedClip && (
    (isTargetVideo && copiedType === 'video') ||
    (isTargetAudioLyrics && (copiedType === 'audio' || copiedType === 'lyrics'))
  ))

  const containerRef = useRef(null)
  const LABEL_WIDTH = 90

  useEffect(() => {
    const handleClose = () => setContextMenu(null)
    window.addEventListener('click', handleClose)
    return () => window.removeEventListener('click', handleClose)
  }, [])

  const handleCopy = (clipId, trackName) => {
    const mappedTrack = trackName === 'audio_lyrics' ? 'audio' : trackName
    const clip = tracks[mappedTrack].find(c => c.id === clipId)
    if (clip) {
      window.__copiedClip = { ...clip }
    }
  }

  const handleCut = (clipId, trackName) => {
    const mappedTrack = trackName === 'audio_lyrics' ? 'audio' : trackName
    const clip = tracks[mappedTrack].find(c => c.id === clipId)
    if (clip) {
      window.__copiedClip = { ...clip }
      if (mappedTrack === 'audio') {
        updateTrack('audio', tracks.audio.filter(c => c.id !== clipId))
        updateTrack('lyrics', tracks.lyrics.filter(c => c.id !== clipId))
      } else {
        updateTrack(mappedTrack, tracks[mappedTrack].filter(c => c.id !== clipId))
      }
    }
  }

  const handlePaste = (trackName) => {
    const mappedTrack = trackName === 'audio_lyrics' ? 'audio' : trackName
    if (!window.__copiedClip) return
    const randId = Math.random()
    if (mappedTrack === 'audio') {
      const newAudio = { ...window.__copiedClip, id: 'audio-paste-' + randId, start: masterTime }
      const newLyrics = {
        id: 'lyrics-paste-' + randId,
        type: 'lyrics',
        start: masterTime,
        duration: window.__copiedClip.duration,
        mediaStart: window.__copiedClip.mediaStart,
      }
      updateTrack('audio', [...tracks.audio, newAudio])
      updateTrack('lyrics', [...tracks.lyrics, newLyrics])
    } else {
      const newClip = { ...window.__copiedClip, id: 'clip-paste-' + randId, start: masterTime }
      updateTrack(mappedTrack, [...tracks[mappedTrack], newClip])
    }
  }

  // Total visible duration
  const totalDuration = Math.max(
    audioDuration || 0,
    ...Object.values(tracks).flat().map(c => c.start + c.duration),
    30,
  ) + 10

  // Ruler ticks
  const step = pixelsPerSecond < 10 ? 10 : pixelsPerSecond > 60 ? 1 : 5
  const ticks = []
  for (let t = 0; t <= totalDuration; t += step) {
    ticks.push(t)
  }
  const totalWidth = totalDuration * pixelsPerSecond

  const timeFromX = useCallback((clientX) => {
    if (!containerRef.current) return 0
    const rect = containerRef.current.getBoundingClientRect()
    const x = clientX - rect.left + containerRef.current.scrollLeft - LABEL_WIDTH
    return Math.max(0, x / pixelsPerSecond)
  }, [pixelsPerSecond])

  // Native scroll wheel handler to prevent browser page-zoom and enable horizontal HMR zoom
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleNativeWheel = (e) => {
      if (e.ctrlKey) {
        e.preventDefault()
        setPixelsPerSecond(pixelsPerSecond + (e.deltaY > 0 ? -3 : 3))
      }
    }

    container.addEventListener('wheel', handleNativeWheel, { passive: false })
    return () => {
      container.removeEventListener('wheel', handleNativeWheel)
    }
  }, [pixelsPerSecond, setPixelsPerSecond])

  // Click on track to seek
  const handleTrackClick = (e) => {
    if (e.target.closest('.clip') || e.target.closest('.playhead-head')) return
    const t = timeFromX(e.clientX)
    setMasterTime(t)
  }

  // Playhead drag
  const handlePlayheadMouseDown = (e) => {
    e.stopPropagation()
    setIsDraggingPlayhead(true)
    const onMove = (me) => setMasterTime(timeFromX(me.clientX))
    const onUp = () => {
      setIsDraggingPlayhead(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // Cut mode guide
  const handleMouseMove = (e) => {
    if (isCutMode && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setCutGuideX(e.clientX - rect.left + containerRef.current.scrollLeft)
    }
  }

  return (
    <div className="timeline-panel">
      {/* Header */}
      <div className="timeline-header">
        <h2>Línea de Tiempo</h2>
        <div className="timeline-tools">
          <button
            className={`btn-icon${isCutMode ? ' active' : ''}`}
            title="Herramienta de corte"
            onClick={() => setIsCutMode(!isCutMode)}
            style={{ fontSize: '0.85rem', width: 'auto', padding: '0 10px' }}
          >
            ✂️ {isCutMode ? 'Corte ON' : 'Corte'}
          </button>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0 6px' }}>
            Ctrl+Scroll: zoom
          </span>
        </div>
      </div>

      {/* Scrollable timeline */}
      <div
        className="timeline-scrollable"
        ref={containerRef}
        onClick={handleTrackClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setCutGuideX(null)}
        style={{ cursor: isCutMode ? 'crosshair' : 'default' }}
      >
        <div className="timeline-inner" style={{ width: totalWidth + LABEL_WIDTH }}>
          {/* Ruler */}
          <div className="timeline-ruler" style={{ width: totalWidth + LABEL_WIDTH }}>
            <div style={{ width: LABEL_WIDTH, display: 'inline-block', flexShrink: 0 }} />
            <div style={{ position: 'relative', display: 'inline-block', width: totalWidth }}>
              {ticks.map(t => (
                <div
                  key={t}
                  className="ruler-tick"
                  style={{ left: t * pixelsPerSecond }}
                >
                  <div className="ruler-tick-line" />
                  <div className="ruler-tick-label">{t}s</div>
                </div>
              ))}
            </div>
          </div>

          {/* Track rows */}
          {TRACK_DEFS.map(({ name, label, locked }) => {
            const clips = name === 'audio_lyrics' ? tracks.audio : tracks[name]
            return (
              <div className="track-row" key={name}>
                <div className="track-label">
                  <span>{label}</span>
                  {locked && <span style={{ marginLeft: 'auto', fontSize: '0.65rem' }}>🔒</span>}
                </div>
                <div
                  className="track-content"
                  style={{ width: totalWidth, position: 'relative' }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      clipId: null,
                      trackName: name
                    })
                  }}
                >
                  {clips.map(clip => (
                    <TimelineClip
                      key={clip.id}
                      clip={clip}
                      trackName={name}
                      pixelsPerSecond={pixelsPerSecond}
                      isCutMode={isCutMode && !locked}
                      onSelect={(id) => setSelectedClipId(id === selectedClipId ? null : id)}
                      isSelected={clip.id === selectedClipId}
                      onContextMenu={(ev, cid, tname) => {
                        ev.preventDefault()
                        ev.stopPropagation()
                        setContextMenu({
                          x: ev.clientX,
                          y: ev.clientY,
                          clipId: cid,
                          trackName: tname
                        })
                      }}
                    />
                  ))}
                </div>
              </div>
            )
          })}

          {/* Playhead */}
          <div
            className="playhead"
            style={{ left: LABEL_WIDTH + masterTime * pixelsPerSecond }}
          >
            <div
              className="playhead-head"
              onMouseDown={handlePlayheadMouseDown}
            />
          </div>

          {/* Cut guide */}
          {isCutMode && cutGuideX !== null && (
            <div className="cut-guide" style={{ left: cutGuideX, display: 'block' }} />
          )}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="timeline-context-menu"
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 9999,
            padding: '4px',
            display: 'flex',
            flexDirection: 'column',
            minWidth: '130px',
            backdropFilter: 'var(--glass-blur)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {contextMenu.clipId ? (
            <>
              <button
                className="context-menu-item"
                onClick={() => {
                  handleCopy(contextMenu.clipId, contextMenu.trackName)
                  setContextMenu(null)
                }}
              >
                📋 Copiar clip
              </button>
              <button
                className="context-menu-item"
                onClick={() => {
                  handleCut(contextMenu.clipId, contextMenu.trackName)
                  setContextMenu(null)
                }}
              >
                ✂️ Cortar clip
              </button>
            </>
          ) : (
            <button
              className="context-menu-item"
              disabled={!canPaste}
              onClick={() => {
                handlePaste(contextMenu.trackName)
                setContextMenu(null)
              }}
              style={{ opacity: canPaste ? 1 : 0.4 }}
            >
              📥 Pegar clip
            </button>
          )}
        </div>
      )}
    </div>
  )
}
