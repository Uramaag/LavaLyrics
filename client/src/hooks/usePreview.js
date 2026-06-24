import { useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '../store/useAppStore'

/**
 * Master clock / game loop for the editor preview.
 * Drives masterTime and syncs video/audio elements.
 * Prevents seek storms and audio/video stutters by driving timeline time
 * directly from native audio/video element playback and using a seek throttle.
 */
export function usePreview({ videoRef, audioRef }) {
  const {
    isPlaying, setIsPlaying,
    masterTime, setMasterTime,
    tracks, audioDuration, bgVideoDuration,
  } = useAppStore()

  const rafRef = useRef(null)
  const lastFrameRef = useRef(null)
  
  const masterTimeRef = useRef(0)
  const lastVideoSeekTimeRef = useRef(0)
  const lastAudioSeekTimeRef = useRef(0)

  // Sync the mutable ref with the store masterTime
  useEffect(() => {
    masterTimeRef.current = masterTime
  }, [masterTime])

  const getBlockAtTime = useCallback((arr, t) =>
    arr.find(c => t >= c.start && t < c.start + c.duration)
  , [])

  const syncPlaybackElements = useCallback((time, timeUpdatedFromAudio, timeUpdatedFromVideo) => {
    const vBlock = getBlockAtTime(tracks.video, time)
    const aBlock = getBlockAtTime(tracks.audio, time)
    const now = performance.now()

    if (videoRef.current) {
      const isVideoReady = videoRef.current.readyState >= 1 && !videoRef.current.error
      if (vBlock && bgVideoDuration > 0 && isVideoReady) {
        videoRef.current.style.opacity = '1'
        const vTarget = (vBlock.mediaStart || 0) + (time - vBlock.start)
        
        // Seek video if drift is significant. Throttle drift corrections during playback.
        const threshold = isPlaying ? 1.5 : 0.15
        const drift = Math.abs(videoRef.current.currentTime - vTarget)
        const shouldSeek = isPlaying
          ? (drift > threshold && !videoRef.current.seeking && (now - lastVideoSeekTimeRef.current > 1000))
          : (drift > threshold && !videoRef.current.seeking)

        if (shouldSeek) {
          lastVideoSeekTimeRef.current = now
          videoRef.current.currentTime = Math.min(vTarget, bgVideoDuration - 0.01)
        }
        
        if (isPlaying) {
          if (videoRef.current.paused) {
            videoRef.current.play().catch(() => {})
          }
        } else {
          videoRef.current.pause()
        }
      } else {
        videoRef.current.style.opacity = '0'
        if (!videoRef.current.paused) {
          videoRef.current.pause()
        }
      }
    }

    if (audioRef.current) {
      const isAudioReady = audioRef.current.readyState >= 1 && !audioRef.current.error
      if (aBlock && audioDuration > 0 && isAudioReady) {
        audioRef.current.muted = false
        const aTarget = (aBlock.mediaStart || 0) + (time - aBlock.start)
        
        // Seek audio if drift is significant. Throttle drift corrections during playback.
        const threshold = isPlaying ? 1.5 : 0.1
        const drift = Math.abs(audioRef.current.currentTime - aTarget)
        const shouldSeek = isPlaying
          ? (drift > threshold && !audioRef.current.seeking && (now - lastAudioSeekTimeRef.current > 1000))
          : (drift > threshold && !audioRef.current.seeking)

        if (shouldSeek) {
          lastAudioSeekTimeRef.current = now
          audioRef.current.currentTime = Math.min(aTarget, audioDuration - 0.01)
        }
        
        if (isPlaying) {
          if (audioRef.current.paused) {
            audioRef.current.play().catch(() => {})
          }
        } else {
          if (!audioRef.current.paused) {
            audioRef.current.pause()
          }
        }
      } else {
        if (!audioRef.current.paused) {
          audioRef.current.pause()
        }
      }
    }
  }, [tracks, audioDuration, bgVideoDuration, videoRef, audioRef, getBlockAtTime, isPlaying])

  const tracksRef = useRef(tracks)
  const audioDurationRef = useRef(audioDuration)
  const bgVideoDurationRef = useRef(bgVideoDuration)
  const syncPlaybackElementsRef = useRef(syncPlaybackElements)

  useEffect(() => {
    tracksRef.current = tracks
    audioDurationRef.current = audioDuration
    bgVideoDurationRef.current = bgVideoDuration
    syncPlaybackElementsRef.current = syncPlaybackElements
  })

  // Game loop
  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(rafRef.current)
      return
    }

    lastFrameRef.current = performance.now()

    const loop = () => {
      const now = performance.now()
      const delta = (now - lastFrameRef.current) / 1000
      lastFrameRef.current = now

      // Sync with external state changes (like playhead dragging/scrubbing)
      const storeTime = useAppStore.getState().masterTime
      if (Math.abs(storeTime - masterTimeRef.current) > 0.05) {
        masterTimeRef.current = storeTime
      }

      let newTime = masterTimeRef.current + delta

      const totalTime = audioDurationRef.current || 0
      if (totalTime > 0 && newTime >= totalTime) {
        masterTimeRef.current = 0
        setMasterTime(0)
        setIsPlaying(false)
        return
      }

      masterTimeRef.current = newTime
      setMasterTime(newTime)

      // Sync elements to newTime
      syncPlaybackElementsRef.current(newTime, false, false)

      rafRef.current = requestAnimationFrame(loop)
    }

    if (videoRef.current && isPlaying) videoRef.current.play().catch(() => {})
    if (audioRef.current && isPlaying) audioRef.current.play().catch(() => {})

    rafRef.current = requestAnimationFrame(loop)

    return () => cancelAnimationFrame(rafRef.current)
  }, [isPlaying, setMasterTime, setIsPlaying, videoRef, audioRef])

  // When paused, sync
  useEffect(() => {
    if (!isPlaying) {
      if (videoRef.current) videoRef.current.pause()
      if (audioRef.current) audioRef.current.pause()
      syncPlaybackElementsRef.current(masterTime, false, false)
    }
  }, [masterTime, isPlaying])

  const togglePlay = useCallback(() => {
    setIsPlaying(!isPlaying)
  }, [isPlaying, setIsPlaying])

  const seekTo = useCallback((t) => {
    const clamped = Math.max(0, t)
    masterTimeRef.current = clamped
    setMasterTime(clamped)

    // Reset seek throttles to allow immediate sync on manual seek
    lastAudioSeekTimeRef.current = 0
    lastVideoSeekTimeRef.current = 0

    if (isPlaying) {
      const aBlock = getBlockAtTime(tracks.audio, clamped)
      const vBlock = getBlockAtTime(tracks.video, clamped)
      if (audioRef.current && aBlock && audioDuration > 0) {
        const aTarget = (aBlock.mediaStart || 0) + (clamped - aBlock.start)
        audioRef.current.currentTime = Math.min(aTarget, audioDuration - 0.01)
      }
      if (videoRef.current && vBlock && bgVideoDuration > 0) {
        const vTarget = (vBlock.mediaStart || 0) + (clamped - vBlock.start)
        videoRef.current.currentTime = Math.min(vTarget, bgVideoDuration - 0.01)
      }
    } else {
      syncPlaybackElements(clamped, false, false)
    }
  }, [setMasterTime, syncPlaybackElements, isPlaying, tracks, audioDuration, bgVideoDuration, audioRef, videoRef, getBlockAtTime])

  const stepForwardFrame = useCallback(() => {
    const t = masterTimeRef.current + (1 / 60)
    masterTimeRef.current = t
    setMasterTime(t)
    syncPlaybackElements(t, false, false)
  }, [setMasterTime, syncPlaybackElements])

  return { togglePlay, seekTo, stepForwardFrame, getBlockAtTime }
}

