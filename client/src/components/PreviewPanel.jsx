import { useRef, useCallback, useEffect, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { usePreview } from '../hooks/usePreview'

function getLyricsAtTime(parsedLyrics, t) {
  if (!parsedLyrics.length) return null
  let idx = -1
  for (let i = 0; i < parsedLyrics.length; i++) {
    if (t >= parsedLyrics[i].time) idx = i
    else break
  }
  if (idx === -1) return null
  return {
    past: idx > 0 ? parsedLyrics[idx - 1].text : '',
    current: parsedLyrics[idx].text,
    next: idx < parsedLyrics.length - 1 ? parsedLyrics[idx + 1].text : '',
  }
}

export default function PreviewPanel({ videoRef: externalVideoRef, audioRef: externalAudioRef }) {
  const {
    masterTime, setMasterTime,
    isPlaying, setIsPlaying,
    tracks, parsedLyrics, audioDuration, bgVideoDuration,
    selectedClipId, getClipFilters,
    currentJobId, bgVideoPath, bgVideoBlobUrl,
    exportSettings,
  } = useAppStore()

  const [previewQuality, setPreviewQuality] = useState('proxy') // 'proxy' | 'original'

  const internalVideoRef = useRef(null)
  const internalAudioRef = useRef(null)
  const videoRef  = externalVideoRef  || internalVideoRef
  const audioRef  = externalAudioRef  || internalAudioRef

  const { togglePlay, seekTo, stepForwardFrame } = usePreview({ videoRef, audioRef })

  // Set audio src
  useEffect(() => {
    if (currentJobId && audioRef.current) {
      audioRef.current.src = `/api/data/${currentJobId}/audio`
      audioRef.current.load()
    }
  }, [currentJobId]) // eslint-disable-line

  const [isVideoLoading, setIsVideoLoading] = useState(false)

  // Zoom state - aplica solo al soltar el slider
  const [zoomLevel, setZoomLevel] = useState(1)
  const [zoomOrigin, setZoomOrigin] = useState({ x: 0.5, y: 0.5 })
  const pendingZoomRef = useRef(1)
  const miniMapCanvasRef = useRef(null)
  const miniMapContainerRef = useRef(null)
  const isDraggingMiniRef = useRef(false)

  // Animar el mini-mapa dibujando desde el video
  useEffect(() => {
    const canvas = miniMapCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let rafId
    const draw = () => {
      const vid = videoRef.current
      if (vid && vid.readyState >= 2 && vid.videoWidth > 0) {
        ctx.drawImage(vid, 0, 0, canvas.width, canvas.height)
      } else {
        ctx.fillStyle = '#0a0a0a'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
      rafId = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(rafId)
  }, [videoRef])

  // Handler para mover el zoom origin desde el mini-mapa
  const handleMiniMapPointer = useCallback((e, container) => {
    if (!container) return
    const rect = container.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    setZoomOrigin({ x, y })
  }, [])

  // Set video src - reactive to previewQuality
  useEffect(() => {
    if (videoRef.current) {
      const targetSrc = bgVideoBlobUrl || (bgVideoPath ? `/api/video?path=${encodeURIComponent(bgVideoPath)}&quality=${previewQuality}` : '')
      if (targetSrc && !videoRef.current.src.includes(targetSrc)) {
        setIsVideoLoading(true)
        videoRef.current.src = targetSrc
        videoRef.current.load()
      }
    }
  }, [bgVideoPath, bgVideoBlobUrl, previewQuality]) // eslint-disable-line

  // Compute current lyric from parsedLyrics timeline, applying lyrics offset (mediaStart) if present
  const activeLyricsClip = tracks.lyrics.find(c => masterTime >= c.start && masterTime < c.start + c.duration)
  const currentLyrics = activeLyricsClip 
    ? getLyricsAtTime(parsedLyrics, masterTime - activeLyricsClip.start - (activeLyricsClip.mediaStart || 0)) 
    : null

  // Compute video CSS filter from selected clip
  const videoFilter = useCallback(() => {
    const clip = selectedClipId ? tracks.video.find(c => c.id === selectedClipId) : null
    if (!clip) return ''
    const filters = getClipFilters(selectedClipId)
    return `brightness(${filters.brightness}) contrast(${filters.contrast}) saturate(${filters.saturation}) hue-rotate(${filters.hue}deg)`
  }, [selectedClipId, tracks.video, getClipFilters])

  // Active filter for current time position
  // Combines filters from the active video clip + all adjustment layers active at masterTime
  const activeVideoFilter = useCallback(() => {
    // Base clip (normal video)
    const activeClip = tracks.video.find(c =>
      c.clipType !== 'adjustment' && masterTime >= c.start && masterTime < c.start + c.duration
    )

    // Adjustment layers active at masterTime
    const adjustmentClips = tracks.video.filter(c =>
      c.clipType === 'adjustment' && masterTime >= c.start && masterTime < c.start + c.duration
    )

    if (!activeClip && adjustmentClips.length === 0) return 'none'

    // Start with base clip filters (or defaults)
    let brightness = 1, contrast = 1, saturation = 1, hue = 0

    if (activeClip) {
      const f = getClipFilters(activeClip.id)
      brightness = f.brightness
      contrast = f.contrast
      saturation = f.saturation
      hue = f.hue
    }

    // Multiply/add adjustment layer filters
    for (const adjClip of adjustmentClips) {
      const f = getClipFilters(adjClip.id)
      brightness *= f.brightness
      contrast *= f.contrast
      saturation *= f.saturation
      hue += f.hue
    }

    return `brightness(${brightness}) contrast(${contrast}) saturate(${saturation}) hue-rotate(${hue}deg)`
  }, [tracks.video, masterTime, getClipFilters])

  const totalTime = audioDuration || 0
  const formatTime = (s) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  }

  // Estilos de fuentes dinámicos del inspector
  const lyricGap = exportSettings.lyricGap ?? 16
  const prevNextScale = exportSettings.prevNextScale ?? 0.7
  const baseFontSize = exportSettings.fontSize || 28

  const lyricBaseStyle = {
    letterSpacing: `${exportSettings.letterSpacing || 0}px`,
    lineHeight: exportSettings.lineHeight || 1.2,
    textAlign: 'center',
    width: '100%',
  }
  const currentLyricStyle = {
    ...lyricBaseStyle,
    fontSize: `${baseFontSize}px`,
  }
  const sideLyricStyle = {
    ...lyricBaseStyle,
    fontSize: `${Math.round(baseFontSize * prevNextScale)}px`,
  }

  // States for visual guides
  const [guidesEnabled, setGuidesEnabled] = useState(false)
  const [showSafeMargins, setShowSafeMargins] = useState(false)
  const [showRuleOfThirds, setShowRuleOfThirds] = useState(false)
  const [showCenterSplit, setShowCenterSplit] = useState(false)
  
  const [safeMarginsColor, setSafeMarginsColor] = useState('#ef4444') // red
  const [ruleOfThirdsColor, setRuleOfThirdsColor] = useState('#3b82f6') // blue
  const [centerSplitColor, setCenterSplitColor] = useState('#22c55e') // green

  return (
    <div className="editor-preview" style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Upper header options */}
      <div className="preview-top-options" style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', background: 'rgba(0,0,0,0.1)', borderBottom: '1px solid var(--border-subtle)', zIndex: 10, alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        
        {/* Guides controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            <input type="checkbox" checked={guidesEnabled} onChange={e => setGuidesEnabled(e.target.checked)} />
            📐 GUÍAS
          </label>

          {guidesEnabled && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '2px 8px', borderRadius: '4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
                <input type="checkbox" checked={showSafeMargins} onChange={e => setShowSafeMargins(e.target.checked)} />
                Márgenes
                <input type="color" value={safeMarginsColor} onChange={e => setSafeMarginsColor(e.target.value)} style={{ width: 14, height: 14, border: 'none', padding: 0, background: 'none', cursor: 'pointer' }} />
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
                <input type="checkbox" checked={showRuleOfThirds} onChange={e => setShowRuleOfThirds(e.target.checked)} />
                Tercios
                <input type="color" value={ruleOfThirdsColor} onChange={e => setRuleOfThirdsColor(e.target.value)} style={{ width: 14, height: 14, border: 'none', padding: 0, background: 'none', cursor: 'pointer' }} />
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
                <input type="checkbox" checked={showCenterSplit} onChange={e => setShowCenterSplit(e.target.checked)} />
                Mitades
                <input type="color" value={centerSplitColor} onChange={e => setCenterSplitColor(e.target.value)} style={{ width: 14, height: 14, border: 'none', padding: 0, background: 'none', cursor: 'pointer' }} />
              </label>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Calidad de Previsualización:</span>
          <select 
            value={previewQuality} 
            onChange={e => setPreviewQuality(e.target.value)}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.72rem',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="proxy">⚡ Proxy (480p - GPU Rápido)</option>
            <option value="original">💎 Completa (Original)</option>
          </select>
        </div>
      </div>

      <div className="preview-canvas-area" style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '16px 16px 8px', gap: '16px', background: 'var(--bg-deep)' }}>
        
        {/* Symmetrical 9:16 Phone Viewport Container */}
        <div 
          className="preview-viewport"
          style={{
            position: 'relative',
            aspectRatio: '9/16',
            height: '100%',
            backgroundColor: '#000',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-xl)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {/* Video with cover aspect fitting */}
          <video
            ref={videoRef}
            muted
            playsInline
            onLoadStart={() => setIsVideoLoading(true)}
            onWaiting={() => setIsVideoLoading(true)}
            onPlaying={() => setIsVideoLoading(false)}
            onCanPlay={() => setIsVideoLoading(false)}
            onSeeked={() => setIsVideoLoading(false)}
            onCanPlayThrough={() => setIsVideoLoading(false)}
            onSuspend={() => setIsVideoLoading(false)}
            onAbort={() => setIsVideoLoading(false)}
            onEmptied={() => setIsVideoLoading(false)}
            onStalled={() => setIsVideoLoading(false)}
            onError={() => setIsVideoLoading(false)}
            style={{ 
              width: '100%', 
              height: '100%', 
              filter: activeVideoFilter(),
              objectFit: 'cover',
              transform: zoomLevel !== 1 ? `scale(${zoomLevel})` : undefined,
              transformOrigin: `${zoomOrigin.x * 100}% ${zoomOrigin.y * 100}%`,
              transition: 'transform 0.15s ease',
            }}
          />

          {/* Loading Indicator */}
          {isVideoLoading && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              zIndex: 10,
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                border: '3px solid rgba(255,255,255,0.2)',
                borderTopColor: 'var(--lava-red)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
              }} />
              <span style={{ fontSize: '0.8rem', color: '#fff', fontWeight: 'bold' }}>CARGANDO...</span>
            </div>
          )}

          {/* Guides Overlay aligned directly to the viewport bounds */}
          {guidesEnabled && (
            <div style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 8,
            }}>
              {/* 1. Symmetrical Safe Margins for Vertical Video (9:16) */}
              {showSafeMargins && (
                <div style={{
                  position: 'absolute',
                  top: '10%',
                  bottom: '15%',
                  left: '10%',
                  right: '10%',
                  border: `1.5px dashed ${safeMarginsColor}`,
                  boxSizing: 'border-box'
                }}>
                  <span style={{ position: 'absolute', top: -14, left: 2, fontSize: '9px', color: safeMarginsColor, background: '#000', padding: '0 2px' }}>Margen Seguro</span>
                </div>
              )}

              {/* 2. Rule of Thirds Grid */}
              {showRuleOfThirds && (
                <div style={{ position: 'absolute', inset: 0 }}>
                  {/* Vertical Lines */}
                  <div style={{ position: 'absolute', top: 0, bottom: 0, left: '33.33%', width: '1px', borderLeft: `1px solid ${ruleOfThirdsColor}`, opacity: 0.6 }} />
                  <div style={{ position: 'absolute', top: 0, bottom: 0, left: '66.66%', width: '1px', borderLeft: `1px solid ${ruleOfThirdsColor}`, opacity: 0.6 }} />
                  {/* Horizontal Lines */}
                  <div style={{ position: 'absolute', left: 0, right: 0, top: '33.33%', height: '1px', borderTop: `1px solid ${ruleOfThirdsColor}`, opacity: 0.6 }} />
                  <div style={{ position: 'absolute', left: 0, right: 0, top: '66.66%', height: '1px', borderTop: `1px solid ${ruleOfThirdsColor}`, opacity: 0.6 }} />
                </div>
              )}

              {/* 3. Center split lines */}
              {showCenterSplit && (
                <div style={{ position: 'absolute', inset: 0 }}>
                  {/* Vertical Split */}
                  <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: '1px', borderLeft: `1.5px dotted ${centerSplitColor}`, opacity: 0.7 }} />
                  {/* Horizontal Split */}
                  <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: '1px', borderTop: `1.5px dotted ${centerSplitColor}`, opacity: 0.7 }} />
                </div>
              )}
            </div>
          )}

          {/* Hidden audio element */}
          <audio ref={audioRef} style={{ display: 'none' }} crossOrigin="anonymous" />

          {/* Lyrics overlay - perfectly aligned and centered inside safe margins */}
          <div
            className="preview-lyrics-overlay"
            style={{
              position: 'absolute',
              top: '10%',
              bottom: '15%',
              left: '10%',
              right: '10%',
              transform: 'none',
              width: 'auto',
              maxWidth: 'none',
              height: 'auto',
              zIndex: 9,
              gap: `${lyricGap}px`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              boxSizing: 'border-box',
            }}
          >
            {currentLyrics && (
              <>
                {currentLyrics.past && (
                  <div className="lyric-line past" style={sideLyricStyle}>{currentLyrics.past}</div>
                )}
                <div className="lyric-line current" key={currentLyrics.current} style={currentLyricStyle}>
                  {currentLyrics.current}
                </div>
                {currentLyrics.next && (
                  <div className="lyric-line next" style={sideLyricStyle}>{currentLyrics.next}</div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Real-time Decibel VU Meter Panel - outside the phone container */}
        <VUMeter audioRef={audioRef} isPlaying={isPlaying} />

        {/* Mini-map de zoom */}
        {zoomLevel > 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vista</span>
            {/* Mini-mapa interactivo */}
            <div
              ref={miniMapContainerRef}
              style={{
                position: 'relative',
                width: '80px',
                height: '142px', // ~9:16
                borderRadius: '6px',
                overflow: 'hidden',
                border: '1px solid var(--border-subtle)',
                cursor: 'crosshair',
                flexShrink: 0,
              }}
              onPointerDown={(e) => {
                isDraggingMiniRef.current = true
                e.currentTarget.setPointerCapture(e.pointerId)
                handleMiniMapPointer(e, miniMapContainerRef.current)
              }}
              onPointerMove={(e) => {
                if (!isDraggingMiniRef.current) return
                handleMiniMapPointer(e, miniMapContainerRef.current)
              }}
              onPointerUp={() => { isDraggingMiniRef.current = false }}
            >
              {/* Canvas con frame del video */}
              <canvas
                ref={miniMapCanvasRef}
                width={80}
                height={142}
                style={{ display: 'block', width: '100%', height: '100%' }}
              />
              {/* Rectángulo de zona de zoom */}
              <div style={{
                position: 'absolute',
                border: '1.5px solid #f97316',
                boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
                pointerEvents: 'none',
                width: `${(1 / zoomLevel) * 100}%`,
                height: `${(1 / zoomLevel) * 100}%`,
                left: `${Math.max(0, Math.min(1 - 1/zoomLevel, zoomOrigin.x - 1/(2*zoomLevel))) * 100}%`,
                top: `${Math.max(0, Math.min(1 - 1/zoomLevel, zoomOrigin.y - 1/(2*zoomLevel))) * 100}%`,
              }} />
              {/* Crosshair en el punto de origen */}
              <div style={{
                position: 'absolute',
                width: '8px',
                height: '8px',
                border: '1.5px solid #fb923c',
                borderRadius: '50%',
                background: 'rgba(249,115,22,0.3)',
                left: `calc(${zoomOrigin.x * 100}% - 4px)`,
                top: `calc(${zoomOrigin.y * 100}% - 4px)`,
                pointerEvents: 'none',
              }} />
            </div>
            <span style={{ fontSize: '0.6rem', color: '#f97316', fontWeight: 'bold' }}>{zoomLevel.toFixed(1)}x</span>
          </div>
        )}

      </div>

      {/* Controls Bar */}
      <div className="preview-controls-bar" style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '6px 14px 10px', borderTop: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.15)', flexShrink: 0 }}>

        {/* Fila 1: Scrubber - solo aplica al soltar para no cortar el audio */}
        <ScrubberInput
          totalTime={totalTime}
          masterTime={masterTime}
          setMasterTime={setMasterTime}
          seekTo={seekTo}
        />

        {/* Fila 2: Botones de transporte + tiempo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <button id="btn-back-start" className="btn-icon" title="Inicio" onClick={() => seekTo(0)} style={{ height: '30px', width: '30px', fontSize: '0.85rem', flexShrink: 0 }}>⏮</button>
          <button id="btn-back5" className="btn-icon" title="-5s" onClick={() => seekTo(Math.max(0, masterTime - 5))} style={{ height: '30px', width: '30px', fontSize: '0.85rem', flexShrink: 0 }}>⏪</button>
          <button id="btn-play-pause" className="btn-icon" onClick={togglePlay} style={{ width: '36px', height: '36px', fontSize: '1.1rem', flexShrink: 0 }}>{isPlaying ? '⏸' : '▶'}</button>
          <button id="btn-fwd5" className="btn-icon" title="+5s" onClick={() => seekTo(Math.min(totalTime, masterTime + 5))} style={{ height: '30px', width: '30px', fontSize: '0.85rem', flexShrink: 0 }}>⏩</button>
          <button id="btn-go-end" className="btn-icon" title="Final" onClick={() => seekTo(totalTime)} style={{ height: '30px', width: '30px', fontSize: '0.85rem', flexShrink: 0 }}>⏭</button>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginLeft: '10px', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
            {formatTime(masterTime)} / {formatTime(totalTime)}
          </span>
        </div>

        {/* Fila 3: Zoom */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>🔍 Zoom</span>
          <input
            type="range"
            min="1" max="5" step="0.1" defaultValue="1"
            style={{ width: '100px', accentColor: '#f97316', cursor: 'pointer' }}
            onChange={(e) => { pendingZoomRef.current = parseFloat(e.target.value) }}
            onPointerUp={(e) => {
              const v = parseFloat(e.target.value)
              setZoomLevel(v)
              if (v === 1) setZoomOrigin({ x: 0.5, y: 0.5 })
            }}
          />
          <span style={{ fontSize: '0.65rem', color: '#f97316', fontWeight: 'bold', minWidth: '28px' }}>{zoomLevel.toFixed(1)}x</span>
          {zoomLevel > 1 && (
            <button className="btn-icon" style={{ height: '20px', width: '20px', fontSize: '0.55rem', padding: 0 }}
              onClick={() => { setZoomLevel(1); setZoomOrigin({ x: 0.5, y: 0.5 }) }}>✕</button>
          )}
        </div>

      </div>
    </div>
  )
}

// Visual VU Meter Component using Web Audio API
function VUMeter({ audioRef, isPlaying }) {
  const canvasRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const sourceRef = useRef(null)
  const animationRef = useRef(null)

  useEffect(() => {
    const el = audioRef.current
    if (!el) return

    const initAudioContext = () => {
      if (audioContextRef.current) return
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext
        const ctx = new AudioContext()
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 64
        analyser.smoothingTimeConstant = 0.5

        const source = ctx.createMediaElementSource(el)
        source.connect(analyser)
        // NO conectar al destination — el audio ya sale del elemento HTML directamente
        // analyser.connect(ctx.destination) ← este causaba el pitido/duplicación

        audioContextRef.current = ctx
        analyserRef.current = analyser
        sourceRef.current = source
      } catch (err) {
        console.error("Audio Context Init error:", err)
      }
    }

    const startMetering = () => {
      initAudioContext()
      if (!analyserRef.current) return

      const ctx = audioContextRef.current
      if (ctx && ctx.state === 'suspended') {
        ctx.resume()
      }

      const canvas = canvasRef.current
      if (!canvas) return
      const canvasCtx = canvas.getContext('2d')
      const bufferLength = analyserRef.current.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      const draw = () => {
        if (!analyserRef.current) return
        animationRef.current = requestAnimationFrame(draw)
        analyserRef.current.getByteFrequencyData(dataArray)

        // Calculate average volume level
        let sum = 0
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i]
        }
        const average = sum / bufferLength
        const heightPct = Math.min(100, (average / 140) * 100)

        // Draw VU Meter Column
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height)
        
        // Background track
        canvasCtx.fillStyle = 'rgba(255,255,255,0.05)'
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height)

        // Foreground level bar (Green-Yellow-Red gradient)
        const meterHeight = (heightPct / 100) * canvas.height
        const grad = canvasCtx.createLinearGradient(0, canvas.height, 0, 0)
        grad.addColorStop(0, '#2ec4b6') // Green-Teal
        grad.addColorStop(0.7, '#fbbf24') // Yellow
        grad.addColorStop(1, '#e63946') // Red
        
        canvasCtx.fillStyle = grad
        canvasCtx.fillRect(0, canvas.height - meterHeight, canvas.width, meterHeight)

        // Grid lines (decibel divisions)
        canvasCtx.fillStyle = 'rgba(255,255,255,0.2)'
        for (let y = 10; y < canvas.height; y += 20) {
          canvasCtx.fillRect(0, y, canvas.width, 1)
        }
      }
      draw()
    }

    // Connect context on audio activity/play
    el.addEventListener('play', startMetering)
    if (isPlaying) {
      startMetering()
    }

    return () => {
      cancelAnimationFrame(animationRef.current)
      if (el) el.removeEventListener('play', startMetering)
    }
  }, [audioRef, isPlaying])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '90%', width: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', padding: '4px 0', border: '1px solid var(--border-subtle)' }}>
      <canvas 
        ref={canvasRef} 
        width={10} 
        height={180} 
        style={{ flex: 1, width: '8px', borderRadius: '2px', background: '#000' }} 
      />
      <span style={{ fontSize: '0.55rem', color: '#2ec4b6', fontWeight: 'bold', marginTop: '4px' }}>VU</span>
    </div>
  )
}
