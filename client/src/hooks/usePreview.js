import { useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '../store/useAppStore'

/**
 * Master clock / game loop for the editor preview.
 * Drives masterTime and syncs video/audio elements.
 * Fixed stale state closure loops using mutable masterTimeRef.
 */
export function usePreview({ videoRef, audioRef }) {
  const {
    isPlaying, setIsPlaying,
    masterTime, setMasterTime,
    tracks, audioDuration, bgVideoDuration,
  } = useAppStore()

  const rafRef = useRef(null)
  const lastFrameRef = useRef(null)
  const isAudioSeeking = useRef(false)
  const isVideoSeeking = useRef(false)
  
  const masterTimeRef = useRef(0)

  // Sync the mutable ref with the store masterTime
  useEffect(() => {
    masterTimeRef.current = masterTime
  }, [masterTime])

  const getBlockAtTime = useCallback((arr, t) =>
    arr.find(c => t >= c.start && t < c.start + c.duration)
  , [])

  const syncAtTime = useCallback((time) => {
    const vBlock = getBlockAtTime(tracks.video, time)
    const aBlock = getBlockAtTime(tracks.audio, time)

    if (videoRef.current) {
      if (vBlock && bgVideoDuration > 0) {
        videoRef.current.style.opacity = '1'
        const vTarget = vBlock.mediaStart + (time - vBlock.start)
        if (!isVideoSeeking.current && Math.abs(videoRef.current.currentTime - vTarget) > 0.25) {
          isVideoSeeking.current = true
          videoRef.current.currentTime = Math.min(vTarget, bgVideoDuration - 0.01)
        }
        if (isPlaying && videoRef.current.paused) {
          videoRef.current.play().catch(() => {})
        }
      } else {
        videoRef.current.style.opacity = '0'
        if (!videoRef.current.paused) {
          videoRef.current.pause()
        }
      }
    }

    if (audioRef.current) {
      if (aBlock && audioDuration > 0) {
        audioRef.current.muted = false
        audioRef.current.volume = 1
        const aTarget = aBlock.mediaStart + (time - aBlock.start)
        if (!isAudioSeeking.current && Math.abs(audioRef.current.currentTime - aTarget) > 0.25) {
          isAudioSeeking.current = true
          audioRef.current.currentTime = Math.min(aTarget, audioDuration - 0.01)
        }
        if (isPlaying && audioRef.current.paused) {
          audioRef.current.play().catch(() => {})
        }
      } else {
        audioRef.current.volume = 0
        if (!audioRef.current.paused) {
          audioRef.current.pause()
        }
      }
    }
  }, [tracks, audioDuration, bgVideoDuration, videoRef, audioRef, getBlockAtTime, isPlaying])

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

      const newTime = masterTimeRef.current + delta
      const totalTime = audioDuration || 0
      
      if (totalTime > 0 && newTime >= totalTime) {
        masterTimeRef.current = 0
        setMasterTime(0)
        setIsPlaying(false)
        return
      }

      masterTimeRef.current = newTime
      setMasterTime(newTime)
      syncAtTime(newTime)
      rafRef.current = requestAnimationFrame(loop)
    }

    videoRef.current?.play().catch(() => {})
    audioRef.current?.play().catch(() => {})

    rafRef.current = requestAnimationFrame(loop)

    return () => cancelAnimationFrame(rafRef.current)
  }, [isPlaying, audioDuration]) // eslint-disable-line

  // When paused, sync
  useEffect(() => {
    if (!isPlaying) {
      videoRef.current?.pause()
      audioRef.current?.pause()
      syncAtTime(masterTime)
    }
  }, [masterTime, isPlaying]) // eslint-disable-line

  useEffect(() => {
    if (videoRef.current) videoRef.current.onseeked = () => { isVideoSeeking.current = false }
    if (audioRef.current) audioRef.current.onseeked = () => { isAudioSeeking.current = false }
  }, [videoRef, audioRef])

  const togglePlay = useCallback(() => {
    setIsPlaying(!isPlaying)
  }, [isPlaying, setIsPlaying])

  const seekTo = useCallback((t) => {
    setMasterTime(t)
    syncAtTime(t)
  }, [setMasterTime, syncAtTime])

  const stepForwardFrame = useCallback(() => {
    const t = masterTime + (1 / 60)
    setMasterTime(t)
    syncAtTime(t)
  }, [masterTime, setMasterTime, syncAtTime])

  return { togglePlay, seekTo, stepForwardFrame, getBlockAtTime }
}
