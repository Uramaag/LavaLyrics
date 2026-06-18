import { useRef, useCallback, useEffect } from 'react'
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
  } = useAppStore()

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

  // Set video src
  useEffect(() => {
    if (videoRef.current) {
      const targetSrc = bgVideoBlobUrl || (bgVideoPath ? `/api/video?path=${encodeURIComponent(bgVideoPath)}` : '')
      if (targetSrc && !videoRef.current.src.includes(targetSrc)) {
        videoRef.current.src = targetSrc
        videoRef.current.load()
      }
    }
  }, [bgVideoPath, bgVideoBlobUrl]) // eslint-disable-line

  // Compute current lyric
  const lyricsBlock = useCallback(() => {
    return tracks.lyrics.find(c => masterTime >= c.start && masterTime < c.start + c.duration)
  }, [tracks.lyrics, masterTime])

  const lb = lyricsBlock()
  const lyricsMediaTime = lb ? lb.mediaStart + (masterTime - lb.start) : -1
  const currentLyrics = lyricsMediaTime >= 0 ? getLyricsAtTime(parsedLyrics, lyricsMediaTime) : null

  // Compute video CSS filter from selected clip
  const videoFilter = useCallback(() => {
    const clip = selectedClipId ? tracks.video.find(c => c.id === selectedClipId) : null
    if (!clip) return ''
    // Also check if current time is in this clip
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

  return (
    <div className="editor-preview">
      <div className="preview-canvas-area">
        {/* Video */}
        <video
          ref={videoRef}
          muted
          playsInline
          style={{ filter: activeVideoFilter() }}
        />
        {/* Hidden audio element */}
        <audio ref={audioRef} style={{ display: 'none' }} />

        {/* Lyrics overlay */}
        <div className="preview-lyrics-overlay">
          {currentLyrics && (
            <>
              {currentLyrics.past && (
                <div className="lyric-line past">{currentLyrics.past}</div>
              )}
              <div className="lyric-line current" key={currentLyrics.current}>
                {currentLyrics.current}
              </div>
              {currentLyrics.next && (
                <div className="lyric-line next">{currentLyrics.next}</div>
              )}
            </>
          )}
        </div>

        {/* Controls overlay */}
        <div className="preview-controls-bar">
          <button
            id="btn-back5"
            className="btn-icon"
            title="−5s"
            onClick={() => seekTo(Math.max(0, masterTime - 5))}
          >⏪</button>
          <button
            id="btn-play-pause"
            className="btn-icon"
            style={{ width: 40, height: 40, fontSize: '1.2rem' }}
            onClick={togglePlay}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button
            id="btn-fwd-frame"
            className="btn-icon"
            title="+1 frame"
            onClick={stepForwardFrame}
          >⏭</button>
          <button
            id="btn-fwd5"
            className="btn-icon"
            title="+5s"
            onClick={() => seekTo(Math.min(totalTime, masterTime + 5))}
          >⏩</button>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
            {formatTime(masterTime)} / {formatTime(totalTime)}
          </span>
        </div>
      </div>
    </div>
  )
}
