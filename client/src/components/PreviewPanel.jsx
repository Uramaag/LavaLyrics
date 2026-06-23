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

  // Compute current lyric directly from parsedLyrics timeline if a lyrics clip is present on the timeline at masterTime
  const hasLyricsClip = tracks.lyrics.some(c => masterTime >= c.start && masterTime < c.start + c.duration)
  const currentLyrics = hasLyricsClip ? getLyricsAtTime(parsedLyrics, masterTime) : null

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

      <div className="preview-canvas-area" style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '16px 16px 8px', gap: '16px' }}>
        <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          {/* Video */}
          <video
            ref={videoRef}
            muted
            playsInline
            onLoadStart={() => setIsVideoLoading(true)}
            onWaiting={() => setIsVideoLoading(true)}
            onPlaying={() => setIsVideoLoading(false)}
            onCanPlay={() => setIsVideoLoading(false)}
            onSeeked={() => setIsVideoLoading(false)}
            style={{ 
              maxHeight: '100%', 
              maxWidth: '100%', 
              filter: activeVideoFilter(),
              objectFit: 'contain',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)'
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
              borderRadius: 'var(--radius-md)'
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

          {/* Guides Overlay Rendered Mathematically inside Video Frame Aspect Box */}
          {guidesEnabled && (
            <div style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {/* Contenedor que simula la relación de aspecto 9:16 vertical de tiktok del reproductor */}
              <div style={{
                position: 'relative',
                width: '100%',
                maxWidth: '300px',
                height: '100%',
                maxHeight: '533px',
                boxSizing: 'border-box'
              }}>
                {/* 1. Safe Margins for TikTok (9:16) */}
                {showSafeMargins && (
                  <div style={{
                    position: 'absolute',
                    top: '10%',
                    bottom: '15%',
                    left: '8%',
                    right: '12%',
                    border: `1.5px dashed ${safeMarginsColor}`,
                    boxSizing: 'border-box'
                  }}>
                    <span style={{ position: 'absolute', top: -14, left: 2, fontSize: '9px', color: safeMarginsColor, background: '#000', padding: '0 2px' }}>Margen Seguro Redes</span>
                  </div>
                )}

                {/* 2. Rule of Thirds Grid */}
                {showRuleOfThirds && (
                  <div style={{ position: 'absolute', inset: 0, boxSizing: 'border-box' }}>
                    {/* Vertical Lines */}
                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: '33.33%', width: '1px', borderLeft: `1px solid ${ruleOfThirdsColor}`, opacity: 0.8 }} />
                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: '66.66%', width: '1px', borderLeft: `1px solid ${ruleOfThirdsColor}`, opacity: 0.8 }} />
                    {/* Horizontal Lines */}
                    <div style={{ position: 'absolute', left: 0, right: 0, top: '33.33%', height: '1px', borderTop: `1px solid ${ruleOfThirdsColor}`, opacity: 0.8 }} />
                    <div style={{ position: 'absolute', left: 0, right: 0, top: '66.66%', height: '1px', borderTop: `1px solid ${ruleOfThirdsColor}`, opacity: 0.8 }} />
                  </div>
                )}

                {/* 3. Center split lines */}
                {showCenterSplit && (
                  <div style={{ position: 'absolute', inset: 0, boxSizing: 'border-box' }}>
                    {/* Vertical Split */}
                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: '1px', borderLeft: `1.5px dotted ${centerSplitColor}`, opacity: 0.9 }} />
                    {/* Horizontal Split */}
                    <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: '1px', borderTop: `1.5px dotted ${centerSplitColor}`, opacity: 0.9 }} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Hidden audio element */}
          <audio ref={audioRef} style={{ display: 'none' }} crossOrigin="anonymous" />

          {/* Lyrics overlay - centrado absoluto sobre el video */}
          <div
            className="preview-lyrics-overlay"
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 9,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px 16px',
              gap: `${lyricGap}px`,
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

        {/* Real-time Decibel VU Meter Panel */}
        <VUMeter audioRef={audioRef} isPlaying={isPlaying} />

      </div>

      {/* Controls Bar - fuera del canvas para tener todo el ancho */}
      <div className="preview-controls-bar" style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px 16px 12px', borderTop: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.15)', flexShrink: 0 }}>
        {/* Scrubber */}
        <input
          type="range"
          min="0"
          max={totalTime || 100}
          step="0.05"
          value={masterTime}
          onChange={(e) => seekTo(parseFloat(e.target.value))}
          style={{ width: '100%', height: '4px', background: 'var(--border-subtle)', borderRadius: '2px', outline: 'none', cursor: 'pointer', accentColor: 'var(--lava-red)' }}
        />
        {/* Buttons row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <button id="btn-back-start" className="btn-icon" title="Inicio" onClick={() => seekTo(0)} style={{ height: '30px', width: '30px', fontSize: '0.85rem', flexShrink: 0 }}>⏮</button>
          <button id="btn-back5" className="btn-icon" title="-5s" onClick={() => seekTo(Math.max(0, masterTime - 5))} style={{ height: '30px', width: '30px', fontSize: '0.85rem', flexShrink: 0 }}>⏪</button>
          <button id="btn-play-pause" className="btn-icon" onClick={togglePlay} style={{ width: '36px', height: '36px', fontSize: '1.1rem', flexShrink: 0 }}>{isPlaying ? '⏸' : '▶'}</button>
          <button id="btn-fwd-frame" className="btn-icon" title="+1 frame" onClick={stepForwardFrame} style={{ height: '30px', width: '30px', fontSize: '0.85rem', flexShrink: 0 }}>⏭</button>
          <button id="btn-fwd5" className="btn-icon" title="+5s" onClick={() => seekTo(Math.min(totalTime, masterTime + 5))} style={{ height: '30px', width: '30px', fontSize: '0.85rem', flexShrink: 0 }}>⏩</button>
          <button id="btn-go-end" className="btn-icon" title="Final" onClick={() => seekTo(totalTime)} style={{ height: '30px', width: '30px', fontSize: '0.85rem', flexShrink: 0 }}>⏭|</button>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '12px', whiteSpace: 'nowrap' }}>
            {formatTime(masterTime)} / {formatTime(totalTime)}
          </span>
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
        analyser.connect(ctx.destination)

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
