import { useRef, useState, useCallback, useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { useTimeline } from '../hooks/useTimeline'
import ImportAudioModal from './ImportAudioModal'

function TimelineClip({ clip, trackName, pixelsPerSecond, isCutMode, onSelect, isSelected, onContextMenu, videoLayersCount, onMoveLayer }) {
  const { moveClip, resizeClipLeft, resizeClipRight, cutClip } = useTimeline()
  const dragState = useRef(null)

  const handleMouseDown = useCallback((e, action) => {
    if (isCutMode) return
    e.stopPropagation()
    dragState.current = {
      action,
      startX: e.clientX,
      startY: e.clientY,
      initialStart: clip.start,
      initialDuration: clip.duration,
      initialMediaStart: clip.mediaStart,
      initialLayer: clip.layer || 0,
      moved: false,
    }

    const onMove = (me) => {
      if (!dragState.current) return
      const diffPx = me.clientX - dragState.current.startX
      const diffPy = me.clientY - dragState.current.startY
      if (Math.abs(diffPx) > 3 || Math.abs(diffPy) > 3) dragState.current.moved = true
      if (!dragState.current.moved) return

      const { action, initialStart, initialDuration, initialLayer } = dragState.current
      const mappedTrack = trackName.startsWith('video') ? 'video' : (trackName === 'audio_lyrics' ? 'audio' : trackName)

      if (action === 'move') {
        const diffTime = diffPx / pixelsPerSecond
        moveClip(mappedTrack, clip.id, initialStart + diffTime)
        
        // Mover verticalmente entre capas si es un clip de video
        if (mappedTrack === 'video' && onMoveLayer) {
          // Altura estimada de fila de track es ~42px
          const rowHeight = 42
          const layerShift = -Math.round(diffPy / rowHeight) // Hacia arriba disminuye y (pero incrementa índice de capa ya que 0 está abajo)
          const targetLayer = Math.max(0, Math.min(videoLayersCount - 1, initialLayer + layerShift))
          if (targetLayer !== clip.layer) {
            onMoveLayer(clip.id, targetLayer - (clip.layer || 0))
          }
        }
      } else if (action === 'resize-right') {
        const diffTime = diffPx / pixelsPerSecond
        resizeClipRight(mappedTrack, clip.id, initialStart + initialDuration + diffTime)
      } else if (action === 'resize-left') {
        const diffTime = diffPx / pixelsPerSecond
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
  }, [clip, trackName, pixelsPerSecond, isCutMode, moveClip, resizeClipLeft, resizeClipRight, videoLayersCount, onMoveLayer])

  const handleClick = (e) => {
    const mappedTrack = trackName.startsWith('video') ? 'video' : (trackName === 'audio_lyrics' ? 'audio' : trackName)
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
    const audioWavemap = useAppStore(s => s.audioWavemap || [])
    const audioDuration = useAppStore(s => s.audioDuration || 0)
    
    return (
      <div
        className={`clip clip-audio-lyrics${isSelected ? ' selected' : ''}`}
        style={{ left, width: Math.max(width, 30), overflow: 'hidden' }}
        onMouseDown={(e) => handleMouseDown(e, 'move')}
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, clip.id, trackName)}
      >
        <div
          className="resize-handle-left"
          onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, 'resize-left') }}
          onClick={e => e.stopPropagation()}
        />
        
        <div className="clip-split-container" style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Waveform Canvas Overlay in the Audio section */}
          <div className="clip-split-top" style={{ position: 'relative', overflow: 'hidden', height: '50%' }}>
            {audioWavemap.length > 0 && (
              <WaveformCanvas 
                wavemap={audioWavemap} 
                mediaStart={clip.mediaStart || 0}
                duration={clip.duration} 
                audioDuration={audioDuration}
              />
            )}
            <span style={{ position: 'relative', zIndex: 2, textShadow: '0 1px 2px rgba(0,0,0,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              🎵 Audio ({clip.duration.toFixed(1)}s)
            </span>
          </div>
          <div className="clip-split-bottom" style={{ height: '50%' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              📝 Letras Sincronizadas
            </span>
          </div>
        </div>

        <div
          className="resize-handle-right"
          onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, 'resize-right') }}
          onClick={e => e.stopPropagation()}
        />
      </div>
    )
  }

  const isAdjustment = clip.clipType === 'adjustment'
  const clipClass = `clip clip-${clip.type}${isSelected ? ' selected' : ''}${isAdjustment ? ' clip-adjustment' : ''}`

  return (
    <div
      className={clipClass}
      style={{
        left, width: Math.max(width, 20),
        ...(isAdjustment ? {
          background: 'linear-gradient(135deg, rgba(139,92,246,0.55), rgba(192,132,252,0.35))',
          borderColor: 'rgba(192,132,252,0.8)',
          borderStyle: 'dashed',
        } : {})
      }}
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
        {isAdjustment ? '🎨 Ajuste' : '🎬 Video'}
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
    updateTrack, saveHistory, addToast, setClipFilters,
  } = useAppStore()

  const [isCutMode, setIsCutMode] = useState(false)
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false)
  const [cutGuideX, setCutGuideX] = useState(null)
  const [contextMenu, setContextMenu] = useState(null) // { x, y, clipId, trackName, layerIndex }
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)

  // videoLayersCount state linked directly to storage and updated reactively
  const [videoLayersCount, setVideoLayersCount] = useState(2)

  useEffect(() => {
    const val = localStorage.getItem('lavalyrics_layers_count')
    setVideoLayersCount(val ? parseInt(val) : 2)
  }, [tracks]) // Syncs when tracks change (like loading project)

  const addVideoLayer = () => {
    const nextCount = videoLayersCount + 1
    setVideoLayersCount(nextCount)
    localStorage.setItem('lavalyrics_layers_count', nextCount.toString())
  }

  const copiedType = window.__copiedClip?.type
  const isTargetVideo = contextMenu?.trackName.startsWith('video')
  const isTargetAudioLyrics = contextMenu?.trackName === 'audio_lyrics'
  const canPaste = !!(window.__copiedClip && (
    (isTargetVideo && copiedType === 'video') ||
    (isTargetAudioLyrics && (copiedType === 'audio' || copiedType === 'lyrics'))
  ))

  const containerRef = useRef(null)
  const LABEL_WIDTH = 110

  useEffect(() => {
    const handleClose = () => setContextMenu(null)
    window.addEventListener('click', handleClose)
    return () => window.removeEventListener('click', handleClose)
  }, [])

  // Keyboard shortcut Ctrl+Shift+D to duplicate selected clip ahead
  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key ? e.key.toLowerCase() : ''
      if (e.ctrlKey && e.shiftKey && key === 'd') {
        e.preventDefault()
        e.stopPropagation()
        if (!selectedClipId) return
        
        // Find which track has the selected clip
        let foundTrack = null
        let foundClip = null
        for (const tname of ['video', 'audio']) {
          const c = tracks[tname].find(clip => clip.id === selectedClipId)
          if (c) {
            foundTrack = tname
            foundClip = c
            break
          }
        }
        if (foundClip && foundTrack) {
          handleDuplicate(foundClip.id, foundTrack, true)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [selectedClipId, tracks])

  const handleCopy = (clipId, trackName) => {
    const mappedTrack = trackName.startsWith('video') ? 'video' : (trackName === 'audio_lyrics' ? 'audio' : trackName)
    const clip = tracks[mappedTrack].find(c => c.id === clipId)
    if (clip) {
      window.__copiedClip = JSON.parse(JSON.stringify(clip))
      addToast('Clip copiado al portapapeles', 'info')
    }
  }

  const handleCut = (clipId, trackName) => {
    saveHistory()
    const mappedTrack = trackName.startsWith('video') ? 'video' : (trackName === 'audio_lyrics' ? 'audio' : trackName)
    const clip = tracks[mappedTrack].find(c => c.id === clipId)
    if (clip) {
      window.__copiedClip = JSON.parse(JSON.stringify(clip))
      if (mappedTrack === 'audio') {
        const idx = tracks.audio.findIndex(c => c.id === clipId)
        if (idx !== -1) {
          updateTrack('audio', tracks.audio.filter((_, i) => i !== idx))
          updateTrack('lyrics', tracks.lyrics.filter((_, i) => i !== idx))
        }
      } else {
        updateTrack(mappedTrack, tracks[mappedTrack].filter(c => c.id !== clipId))
      }
      addToast('Clip cortado al portapapeles', 'info')
    }
  }

  const handlePaste = (trackName, layerIndex) => {
    saveHistory()
    const mappedTrack = trackName.startsWith('video') ? 'video' : (trackName === 'audio_lyrics' ? 'audio' : trackName)
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
      const newClip = { ...window.__copiedClip, id: 'clip-paste-' + randId, start: masterTime, layer: layerIndex }
      updateTrack(mappedTrack, [...tracks[mappedTrack], newClip])
    }
  }

  const handleDuplicate = (clipId, trackName, ahead = false) => {
    saveHistory()
    const mappedTrack = trackName.startsWith('video') ? 'video' : (trackName === 'audio_lyrics' ? 'audio' : trackName)
    const clip = tracks[mappedTrack].find(c => c.id === clipId)
    if (!clip) return
    
    const randId = Math.random()
    if (mappedTrack === 'audio') {
      const newStart = ahead ? (clip.start + clip.duration) : clip.start
      const audioId = 'audio-dup-' + randId
      const newAudio = { ...clip, id: audioId, start: newStart }
      const newLyrics = {
        id: 'lyrics-dup-' + randId,
        type: 'lyrics',
        start: newStart,
        duration: clip.duration,
        mediaStart: clip.mediaStart,
      }
      updateTrack('audio', [...tracks.audio, newAudio])
      updateTrack('lyrics', [...tracks.lyrics, newLyrics])
      setSelectedClipId(audioId)
    } else {
      const newStart = ahead ? (clip.start + clip.duration) : clip.start
      const videoId = 'clip-dup-' + randId
      const newClip = { ...clip, id: videoId, start: newStart }
      updateTrack(mappedTrack, [...tracks[mappedTrack], newClip])
      setSelectedClipId(videoId)
    }
  }

  // Layer movement helpers for context menu
  const moveClipLayer = (clipId, dir) => {
    saveHistory()
    const updated = tracks.video.map(c => {
      if (c.id === clipId) {
        const currentLayer = c.layer || 0
        const targetLayer = Math.max(0, Math.min(videoLayersCount - 1, currentLayer + dir))
        return { ...c, layer: targetLayer }
      }
      return c
    })
    updateTrack('video', updated)
  }

  // Toggle adjustment layer type
  const toggleAdjustmentLayer = (clipId) => {
    saveHistory()
    const updated = tracks.video.map(c => {
      if (c.id === clipId) {
        const isAdj = c.clipType === 'adjustment'
        return { ...c, clipType: isAdj ? 'video' : 'adjustment' }
      }
      return c
    })
    updateTrack('video', updated)
    setContextMenu(null)
  }

  // Delete selected clip (used from context menu)
  const deleteClipById = (clipId, trackName) => {
    saveHistory()
    const mappedTrack = trackName.startsWith('video') ? 'video' : (trackName === 'audio_lyrics' ? 'audio' : trackName)
    if (mappedTrack === 'audio') {
      const idx = tracks.audio.findIndex(c => c.id === clipId)
      if (idx !== -1) {
        updateTrack('audio', tracks.audio.filter((_, i) => i !== idx))
        updateTrack('lyrics', tracks.lyrics.filter((_, i) => i !== idx))
      }
    } else {
      updateTrack(mappedTrack, tracks[mappedTrack].filter(c => c.id !== clipId))
    }
    if (selectedClipId === clipId) setSelectedClipId(null)
    setContextMenu(null)
    addToast('Clip eliminado', 'info')
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

  // Drop handler for filter presets dragged from FiltersPanel
  const handleFilterPresetDrop = (e, layerIndex) => {
    e.preventDefault()
    const raw = e.dataTransfer.getData('application/lava-filter-preset')
    if (!raw) return
    try {
      const { presetName, filters } = JSON.parse(raw)
      saveHistory()
      const dropTime = timeFromX(e.clientX)
      const newId = 'adj-' + Date.now()
      const newClip = {
        id: newId,
        type: 'video',
        clipType: 'adjustment',
        start: Math.max(0, dropTime),
        duration: 5,
        layer: layerIndex,
        mediaStart: 0,
      }
      updateTrack('video', [...tracks.video, newClip])
      setClipFilters(newId, filters)
      setSelectedClipId(newId)
      addToast(`Capa de ajuste "${presetName}" añadida`, 'success')
    } catch { /* ignore */ }
  }

  const handleTrackClick = (e) => {
    if (e.target.closest('.clip') || e.target.closest('.playhead-head')) return
    const t = timeFromX(e.clientX)
    setMasterTime(t)
  }

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

  const handleMouseMove = (e) => {
    if (isCutMode && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setCutGuideX(e.clientX - rect.left + containerRef.current.scrollLeft)
    }
  }

  // Create list of video layer specs (from top to bottom layer)
  const videoLayerRows = []
  for (let i = videoLayersCount - 1; i >= 0; i--) {
    videoLayerRows.push({
      index: i,
      name: `video_${i}`,
      label: `Capa Video ${i + 1}`
    })
  }

  return (
    <div className="timeline-panel" style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-elevated)', borderTop: '1px solid var(--border-subtle)' }}>
      {/* Header */}
      <div className="timeline-header" style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.15)', height: '42px', alignItems: 'center' }}>
        <h2>Línea de Tiempo</h2>
        <div className="timeline-tools" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            className="btn-secondary"
            onClick={addVideoLayer}
            style={{ fontSize: '0.78rem', padding: '4px 10px' }}
          >
            ➕ Capa de Video
          </button>
          <button
            className={`btn-icon${isCutMode ? ' active' : ''}`}
            title="Herramienta de corte"
            onClick={() => setIsCutMode(!isCutMode)}
            style={{ fontSize: '0.82rem', width: 'auto', padding: '0 10px', height: '28px' }}
          >
            ✂️ {isCutMode ? 'Corte ON' : 'Corte'}
          </button>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
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
        style={{ cursor: isCutMode ? 'crosshair' : 'default', flex: 1, overflowY: 'auto', position: 'relative' }}
      >
        <div className="timeline-inner" style={{ width: totalWidth + LABEL_WIDTH, position: 'relative' }}>
          {/* Ruler */}
          <div className="timeline-ruler" style={{ width: totalWidth + LABEL_WIDTH, height: '24px', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.1)' }}>
            <div style={{ width: LABEL_WIDTH, display: 'inline-block', flexShrink: 0 }} />
            <div style={{ position: 'relative', display: 'inline-block', width: totalWidth }}>
              {ticks.map(t => (
                <div
                  key={t}
                  className="ruler-tick"
                  style={{ left: t * pixelsPerSecond, position: 'absolute' }}
                >
                  <div className="ruler-tick-line" style={{ height: '6px', width: '1px', background: 'var(--border-medium)' }} />
                  <div className="ruler-tick-label" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', position: 'absolute', top: '6px', transform: 'translateX(-50%)' }}>{t}s</div>
                </div>
              ))}
            </div>
          </div>

          {/* 1. Track row: Audio & Lyrics */}
          <div className="track-row" style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', height: '60px', alignItems: 'center' }}>
            <div 
              className="track-label" 
              style={{ width: LABEL_WIDTH, padding: '0 8px', fontSize: '0.78rem', color: 'var(--text-primary)', borderRight: '1px solid var(--border-subtle)', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)' }}
            >
              <span>Audio + Letras</span>
              <span style={{ fontSize: '0.7rem' }}>🔒</span>
            </div>
            <div
              className="track-content"
              style={{ width: totalWidth, position: 'relative', height: '100%', background: 'rgba(0,0,0,0.1)' }}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setContextMenu({
                  x: e.clientX,
                  y: e.clientY,
                  clipId: null,
                  trackName: 'audio_lyrics',
                  layerIndex: 0
                })
              }}
            >
              {tracks.audio.map(clip => (
                <TimelineClip
                  key={clip.id}
                  clip={clip}
                  trackName="audio_lyrics"
                  pixelsPerSecond={pixelsPerSecond}
                  isCutMode={isCutMode}
                  onSelect={(id) => setSelectedClipId(id === selectedClipId ? null : id)}
                  isSelected={clip.id === selectedClipId}
                  onContextMenu={(ev, cid, tname) => {
                    ev.preventDefault()
                    ev.stopPropagation()
                    setSelectedClipId(cid) // Selección automática al dar click derecho
                    setContextMenu({
                      x: ev.clientX,
                      y: ev.clientY,
                      clipId: cid,
                      trackName: tname,
                      layerIndex: 0
                    })
                  }}
                />
              ))}
            </div>
          </div>

          {/* 2. Track rows: Video layers */}
          {videoLayerRows.map(({ name, label, index }) => {
            const layerClips = tracks.video.filter(c => (c.layer || 0) === index)
            return (
              <div className="track-row" key={name} style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', height: '42px', alignItems: 'center' }}>
                <div 
                  className="track-label" 
                  style={{ width: LABEL_WIDTH, padding: '0 8px', fontSize: '0.75rem', color: 'var(--text-secondary)', borderRight: '1px solid var(--border-subtle)', height: '100%', display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}
                >
                  {label}
                </div>
                <div
                  className="track-content"
                  style={{ width: totalWidth, position: 'relative', height: '100%', background: 'rgba(0,0,0,0.05)' }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      clipId: null,
                      trackName: 'video',
                      layerIndex: index
                    })
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleFilterPresetDrop(e, index)}
                >
                  {layerClips.map(clip => (
                    <TimelineClip
                      key={clip.id}
                      clip={clip}
                      trackName="video"
                      pixelsPerSecond={pixelsPerSecond}
                      isCutMode={isCutMode}
                      onSelect={(id) => setSelectedClipId(id === selectedClipId ? null : id)}
                      isSelected={clip.id === selectedClipId}
                      videoLayersCount={videoLayersCount}
                      onMoveLayer={moveClipLayer}
                      onContextMenu={(ev, cid, tname) => {
                        ev.preventDefault()
                        ev.stopPropagation()
                        setSelectedClipId(cid) // Selección automática al dar click derecho
                        setContextMenu({
                          x: ev.clientX,
                          y: ev.clientY,
                          clipId: cid,
                          trackName: tname,
                          layerIndex: index
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
            style={{ left: LABEL_WIDTH + masterTime * pixelsPerSecond, position: 'absolute', top: 0, bottom: 0, width: '1px', background: 'var(--lava-orange)', zIndex: 100 }}
          >
            <div
              className="playhead-head"
              onMouseDown={handlePlayheadMouseDown}
              style={{ width: '13px', height: '13px', borderRadius: '50%', background: 'var(--lava-orange)', cursor: 'ew-resize', position: 'absolute', top: '6px', left: '-6px', border: '1px solid #fff' }}
            />
          </div>

          {/* Cut guide */}
          {isCutMode && cutGuideX !== null && (
            <div className="cut-guide" style={{ left: cutGuideX, display: 'block', position: 'absolute', top: 0, bottom: 0, width: '1px', background: '#ff0000', borderLeft: '1px dashed #fff', pointerEvents: 'none' }} />
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
            minWidth: '150px',
            backdropFilter: 'var(--glass-blur)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Menu options for tracks */}
          {contextMenu.clipId === null ? (
            <>
              {contextMenu.trackName === 'audio_lyrics' && (
                <button
                  className="context-menu-item"
                  onClick={() => setIsImportModalOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', padding: '6px 12px', border: 'none', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', fontSize: '0.8rem' }}
                >
                  {audioDuration > 0 ? '🔄 Reemplazar Audio...' : '📥 Importar Audio...'}
                </button>
              )}
              <button
                className="context-menu-item"
                disabled={!canPaste}
                onClick={() => handlePaste(contextMenu.trackName, contextMenu.layerIndex)}
                style={{ opacity: canPaste ? 1 : 0.4, display: 'flex', alignItems: 'center', gap: '6px', width: '100%', padding: '6px 12px', border: 'none', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', fontSize: '0.8rem' }}
              >
                📋 Pegar clip
              </button>
            </>
          ) : (
            /* Menu options for clips */
            <>
              <button
                className="context-menu-item"
                onClick={() => handleCopy(contextMenu.clipId, contextMenu.trackName)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', padding: '6px 12px', border: 'none', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', fontSize: '0.8rem' }}
              >
                📋 Copiar clip
              </button>
              <button
                className="context-menu-item"
                onClick={() => handleCut(contextMenu.clipId, contextMenu.trackName)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', padding: '6px 12px', border: 'none', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', fontSize: '0.8rem' }}
              >
                ✂️ Cortar clip
              </button>
              <button
                className="context-menu-item"
                onClick={() => handleDuplicate(contextMenu.clipId, contextMenu.trackName, false)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', padding: '6px 12px', border: 'none', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', fontSize: '0.8rem' }}
              >
                👥 Duplicar clip
              </button>
              <button
                className="context-menu-item"
                onClick={() => handleDuplicate(contextMenu.clipId, contextMenu.trackName, true)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', padding: '6px 12px', border: 'none', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', fontSize: '0.8rem' }}
              >
                ⏩ Duplicar clip adelante
              </button>
              {/* Toggle Adjustment Layer - solo para clips de video */}
              {contextMenu.trackName !== 'audio_lyrics' && (() => {
                const clip = tracks.video.find(c => c.id === contextMenu.clipId)
                const isAdj = clip?.clipType === 'adjustment'
                return (
                  <button
                    className="context-menu-item"
                    onClick={() => toggleAdjustmentLayer(contextMenu.clipId)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', padding: '6px 12px', border: 'none', background: isAdj ? 'rgba(139,92,246,0.15)' : 'transparent', color: isAdj ? '#c084fc' : 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', fontSize: '0.8rem', borderRadius: '4px' }}
                  >
                    {isAdj ? '📹 Convertir a Clip Normal' : '🎨 Convertir a Capa de Ajuste'}
                  </button>
                )
              })()}
              {/* Delete clip */}
              <button
                className="context-menu-item"
                onClick={() => deleteClipById(contextMenu.clipId, contextMenu.trackName)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', padding: '6px 12px', border: 'none', background: 'transparent', color: '#f87171', cursor: 'pointer', textAlign: 'left', fontSize: '0.8rem' }}
              >
                🗑️ Eliminar clip
              </button>
              {contextMenu.trackName === 'audio_lyrics' && (
                <button
                  className="context-menu-item"
                  onClick={() => setIsImportModalOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', padding: '6px 12px', border: 'none', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', fontSize: '0.8rem' }}
                >
                  🔄 Reemplazar Audio...
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Import/Replace Modal */}
      <ImportAudioModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />
    </div>
  )
}

// Lightweight component to draw audio waveform peaks on timeline
function WaveformCanvas({ wavemap, mediaStart, duration, audioDuration }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    
    // Set internal resolution matching DOM size for pixel-perfect drawing
    const rect = canvas.getBoundingClientRect()
    const w = rect.width || 1200
    const h = rect.height || 30
    canvas.width = w
    canvas.height = h

    ctx.clearRect(0, 0, w, h)
    if (!wavemap || wavemap.length === 0 || !audioDuration) return

    const barWidth = 2
    const gap = 1
    const totalBars = Math.floor(w / (barWidth + gap))

    ctx.fillStyle = 'rgba(74, 222, 128, 0.7)' // Bright neon green with higher opacity

    for (let i = 0; i < totalBars; i++) {
      // Map column i to clip playhead time
      const progress = i / totalBars
      const clipTime = progress * duration
      const songTime = mediaStart + clipTime

      // Map song time to wavemap index
      const wavemapProgress = songTime / audioDuration
      const index = Math.min(wavemap.length - 1, Math.floor(wavemapProgress * wavemap.length))
      
      if (index < 0 || index >= wavemap.length) continue

      const peak = wavemap[index]
      const val = typeof peak === 'object' ? (peak.value || 0) : (peak || 0)
      
      const barHeight = val * h * 0.95
      const x = i * (barWidth + gap)
      const y = (h - barHeight) / 2
      
      ctx.fillRect(x, y, barWidth, barHeight)
    }
  }, [wavemap, mediaStart, duration, audioDuration])

  return (
    <canvas 
      ref={canvasRef} 
      style={{ 
        position: 'absolute', 
        inset: 0, 
        width: '100%', 
        height: '100%', 
        pointerEvents: 'none',
        zIndex: 1,
        opacity: 0.9
      }} 
    />
  )
}
