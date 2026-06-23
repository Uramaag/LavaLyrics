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

  // Set video src - reactive to previewQuality
  useEffect(() => {
    if (videoRef.current) {
      const targetSrc = bgVideoBlobUrl || (bgVideoPath ? `/api/video?path=${encodeURIComponent(bgVideoPath)}&quality=${previewQuality}` : '')
      if (targetSrc && !videoRef.current.src.includes(targetSrc)) {
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
  const activeVideoFilter = useCallback(() => {
    const activeClip = tracks.video.find(c => masterTime >= c.start && masterTime < c.start + c.duration)
    if (!activeClip) return ''
    const f = getClipFilters(activeClip.id)
    return `brightness(${f.brightness}) contrast(${f.contrast}) saturate(${f.saturation}) hue-rotate(${f.hue}deg)`
  }, [tracks.video, masterTime, getClipFilters])

  const totalTime = audioDuration || 0
  const formatTime = (s) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  }

  // Estilos de fuentes dinámicos del inspector
  const lyricStyle = {
    letterSpacing: `${exportSettings.letterSpacing || 0}px`
  }
  const currentLyricStyle = {
    ...lyricStyle,
    fontSize: `${exportSettings.fontSize || 28}px`
  }
  const sideLyricStyle = {
    ...lyricStyle,
    fontSize: `${Math.round((exportSettings.fontSize || 28) * 0.7)}px`
  }

  return (
    <div className="editor-preview" style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Upper header options */}
      <div className="preview-top-options" style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 12px', background: 'rgba(0,0,0,0.1)', borderBottom: '1px solid var(--border-subtle)', zIndex: 10 }}>
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

      <div className="preview-canvas-area" style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '16px', gap: '16px' }}>
        <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          {/* Video */}
          <video
            ref={videoRef}
            muted
            playsInline
            style={{ 
              maxHeight: '100%', 
              maxWidth: '100%', 
              filter: activeVideoFilter(),
              objectFit: 'contain',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)'
            }}
          />
          {/* Hidden audio element */}
          <audio ref={audioRef} style={{ display: 'none' }} crossOrigin="anonymous" />

          {/* Lyrics overlay */}
          <div className="preview-lyrics-overlay" style={{ pointerEvents: 'none' }}>
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

        {/* Controls overlay */}
        <div className="preview-controls-bar">
          <button
            id="btn-back5"
            className="btn-icon"
            title="−5s"
            onClick={() => seekTo(Math.max(0, masterTime - 5))}
            style={{ height: '28px', width: '28px', fontSize: '0.8rem' }}
          >⏪</button>
          <button
            id="btn-play-pause"
            className="btn-icon"
            style={{ width: 34, height: 34, fontSize: '1rem' }}
            onClick={togglePlay}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button
            id="btn-fwd-frame"
            className="btn-icon"
            title="+1 frame"
            onClick={stepForwardFrame}
            style={{ height: '28px', width: '28px', fontSize: '0.8rem' }}
          >⏭</button>
          <button
            id="btn-fwd5"
            className="btn-icon"
            title="+5s"
            onClick={() => seekTo(Math.min(totalTime, masterTime + 5))}
            style={{ height: '28px', width: '28px', fontSize: '0.8rem' }}
          >⏩</button>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
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
