import { useCallback } from 'react'
import { useAppStore } from '../store/useAppStore'

/**
 * Timeline utilities: add/move/resize/cut clips, snap logic.
 * Supports unified Audio & Letras track linking and history saving.
 */
export function useTimeline() {
  const { tracks, updateTrack, masterTime, pixelsPerSecond, saveHistory, audioDuration, bgVideoDuration } = useAppStore()

  const getSnapTime = useCallback((proposedTime, excludeId) => {
    const SNAP_THRESHOLD = 0.5
    let best = proposedTime
    let minDiff = SNAP_THRESHOLD

    const check = (t) => {
      const d = Math.abs(proposedTime - t)
      if (d < minDiff) { minDiff = d; best = t }
    }

    check(0)
    check(masterTime)

    ;['video', 'audio', 'lyrics'].forEach(tn => {
      tracks[tn].forEach(c => {
        if (c.id !== excludeId) {
          check(c.start)
          check(c.start + c.duration)
        }
      })
    })

    return best
  }, [tracks, masterTime])

  const moveClip = useCallback((trackName, clipId, newStart) => {
    saveHistory()
    const snapped = getSnapTime(Math.max(0, newStart), clipId)

    if (trackName === 'audio' || trackName === 'lyrics') {
      const currentClip = tracks.audio.find(c => c.id === clipId) || tracks.audio[0]
      if (!currentClip) return
      const shift = snapped - currentClip.start
      
      const newAudio = tracks.audio.map(c => ({ ...c, start: c.start + shift }))
      const newLyrics = tracks.lyrics.map(c => ({ ...c, start: c.start + shift }))
      
      updateTrack('audio', newAudio)
      updateTrack('lyrics', newLyrics)
    } else {
      updateTrack(trackName, tracks[trackName].map(c =>
        c.id === clipId ? { ...c, start: snapped } : c
      ))
    }
  }, [tracks, updateTrack, getSnapTime, saveHistory])

  const resizeClipRight = useCallback((trackName, clipId, newEnd) => {
    saveHistory()
    const snapped = getSnapTime(Math.max(0.5, newEnd), clipId)

    if (trackName === 'audio' || trackName === 'lyrics') {
      const currentClip = tracks.audio.find(c => c.id === clipId) || tracks.audio[0]
      if (!currentClip) return
      
      // Clamp to audio source duration limit
      const maxDuration = audioDuration > 0 ? (audioDuration - currentClip.mediaStart) : 99999
      const newDur = Math.min(Math.max(0.5, snapped - currentClip.start), maxDuration)
      
      const newAudio = tracks.audio.map(c => ({ ...c, duration: newDur }))
      const newLyrics = tracks.lyrics.map(c => ({ ...c, duration: newDur }))
      
      updateTrack('audio', newAudio)
      updateTrack('lyrics', newLyrics)
    } else {
      updateTrack(trackName, tracks[trackName].map(c => {
        if (c.id !== clipId) return c
        const snappedVal = getSnapTime(Math.max(c.start + 0.5, newEnd), clipId)
        
        // Clamp to video source duration limit
        const maxDuration = bgVideoDuration > 0 ? (bgVideoDuration - c.mediaStart) : 99999
        const newDur = Math.min(snappedVal - c.start, maxDuration)
        
        return { ...c, duration: newDur }
      }))
    }
  }, [tracks, updateTrack, getSnapTime, saveHistory, audioDuration, bgVideoDuration])

  const resizeClipLeft = useCallback((trackName, clipId, newStart) => {
    saveHistory()
    const snapped = getSnapTime(Math.max(0, newStart), clipId)

    if (trackName === 'audio' || trackName === 'lyrics') {
      const currentClip = tracks.audio.find(c => c.id === clipId) || tracks.audio[0]
      if (!currentClip) return
      
      // Clamp to prevent mediaStart going below 0
      const minStart = Math.max(0, currentClip.start - currentClip.mediaStart)
      const clampedStart = Math.max(minStart, snapped)
      
      const shift = clampedStart - currentClip.start
      const newDur = currentClip.duration - shift
      if (newDur < 0.5) return
      
      const newAudio = tracks.audio.map(c => ({
        ...c,
        start: clampedStart,
        duration: newDur,
        mediaStart: Math.max(0, c.mediaStart + shift),
      }))
      const newLyrics = tracks.lyrics.map(c => ({
        ...c,
        start: clampedStart,
        duration: newDur,
        mediaStart: Math.max(0, c.mediaStart + shift),
      }))
      
      updateTrack('audio', newAudio)
      updateTrack('lyrics', newLyrics)
    } else {
      updateTrack(trackName, tracks[trackName].map(c => {
        if (c.id !== clipId) return c
        const snappedVal = getSnapTime(Math.max(0, newStart), clipId)
        
        // Clamp to prevent mediaStart going below 0
        const minStart = Math.max(0, c.start - c.mediaStart)
        const clampedStart = Math.max(minStart, snappedVal)
        
        const shift = clampedStart - c.start
        const newDur = c.duration - shift
        if (newDur < 0.5) return c
        return {
          ...c,
          start: clampedStart,
          duration: newDur,
          mediaStart: Math.max(0, c.mediaStart + shift),
        }
      }))
    }
  }, [tracks, updateTrack, getSnapTime, saveHistory, audioDuration, bgVideoDuration])

  const cutClip = useCallback((trackName, clipId, cutTimeInClip) => {
    saveHistory()

    if (trackName === 'audio' || trackName === 'lyrics') {
      const audioClip = tracks.audio.find(c => c.id === clipId) || tracks.audio[0]
      const lyricsClip = tracks.lyrics.find(c => c.id === clipId) || tracks.lyrics[0]
      if (!audioClip || !lyricsClip) return
      if (cutTimeInClip < 0.5 || cutTimeInClip > audioClip.duration - 0.5) return

      const randId = Math.random()
      
      const leftAudio = { ...audioClip, duration: cutTimeInClip }
      const rightAudio = {
        ...audioClip,
        id: 'audio-cut-' + randId,
        start: audioClip.start + cutTimeInClip,
        duration: audioClip.duration - cutTimeInClip,
        mediaStart: audioClip.mediaStart + cutTimeInClip,
      }
      
      const leftLyrics = { ...lyricsClip, duration: cutTimeInClip }
      const rightLyrics = {
        ...lyricsClip,
        id: 'lyrics-cut-' + randId,
        start: lyricsClip.start + cutTimeInClip,
        duration: lyricsClip.duration - cutTimeInClip,
        mediaStart: lyricsClip.mediaStart + cutTimeInClip,
      }
      
      updateTrack('audio', [leftAudio, rightAudio])
      updateTrack('lyrics', [leftLyrics, rightLyrics])
    } else {
      const clip = tracks[trackName].find(c => c.id === clipId)
      if (!clip) return
      if (cutTimeInClip < 0.5 || cutTimeInClip > clip.duration - 0.5) return

      const left = { ...clip, duration: cutTimeInClip }
      const right = {
        ...clip,
        id: Date.now() + Math.random(),
        start: clip.start + cutTimeInClip,
        duration: clip.duration - cutTimeInClip,
        mediaStart: clip.mediaStart + cutTimeInClip,
      }
      updateTrack(trackName, [
        ...tracks[trackName].filter(c => c.id !== clipId),
        left, right,
      ])
    }
  }, [tracks, updateTrack, saveHistory])

  const addVideoClip = useCallback((bgVideoDuration) => {
    saveHistory()
    const lastEnd = tracks.video.reduce((m, c) => Math.max(m, c.start + c.duration), 0)
    updateTrack('video', [
      ...tracks.video,
      {
        id: 'video-' + Date.now() + Math.random(),
        type: 'video',
        start: lastEnd,
        duration: bgVideoDuration,
        mediaStart: 0,
      }
    ])
  }, [tracks, updateTrack, saveHistory])

  const addLyricsClip = useCallback((targetTrack, audioDuration) => {
    saveHistory()
    if (targetTrack === 'audio') return
    updateTrack(targetTrack, [
      ...tracks[targetTrack],
      {
        id: 'lyrics-' + Date.now() + Math.random(),
        type: 'lyrics',
        start: 0,
        duration: audioDuration || 180,
        mediaStart: 0,
      }
    ])
  }, [tracks, updateTrack, saveHistory])

  const fillVideoToEnd = useCallback(() => {
    saveHistory()
    if (!bgVideoDuration) return
    const audioEnd = tracks.audio.reduce((m, c) => Math.max(m, c.start + c.duration), 0)
    // Respect cropped audio duration if present, otherwise fallback to raw audioDuration
    const targetEnd = audioEnd > 0 ? audioEnd : (audioDuration || 0)
    if (targetEnd <= 0) return

    let videoEnd = tracks.video.reduce((m, c) => Math.max(m, c.start + c.duration), 0)
    if (videoEnd >= targetEnd) return

    const newClips = [...tracks.video]
    let count = 0
    while (videoEnd < targetEnd && count < 100) {
      const remaining = targetEnd - videoEnd
      const dur = Math.min(bgVideoDuration, remaining)
      newClips.push({
        id: 'video-fill-' + Date.now() + '-' + Math.random(),
        type: 'video',
        start: videoEnd,
        duration: dur,
        mediaStart: 0,
      })
      videoEnd += dur
      count++
    }
    updateTrack('video', newClips)
  }, [tracks, updateTrack, saveHistory, bgVideoDuration, audioDuration])

  return { moveClip, resizeClipRight, resizeClipLeft, cutClip, addVideoClip, addLyricsClip, fillVideoToEnd, getSnapTime }
}
