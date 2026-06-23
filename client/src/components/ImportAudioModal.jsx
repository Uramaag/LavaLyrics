import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../store/useAppStore'

function parseLRC(lrcText) {
  const lines = lrcText.split('\n')
  const lyrics = []
  const regex = /\[(\d{2}):(\d{2}\.\d{2,3})\](.*)/
  for (const line of lines) {
    const m = line.match(regex)
    if (m) {
      const t = parseInt(m[1]) * 60 + parseFloat(m[2])
      const txt = m[3].trim()
      if (txt) lyrics.push({ time: t, text: txt })
    }
  }
  return lyrics
}

export default function ImportAudioModal({ isOpen, onClose }) {
  const { setJobData, setParsedLyrics, updateTrack, setAudioDuration, addToast } = useAppStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [hideNoLyrics, setHideNoLyrics] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadStep, setDownloadStep] = useState('')
  const [downloadPct, setDownloadPct] = useState(0)
  
  const searchDebounce = useRef(null)

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); setShowResults(false); return }
    clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`)
        const data = await res.json()
        setSearchResults(data.results || [])
        setShowResults(true)
      } catch {
        setSearchResults([])
        setShowResults(true)
      } finally {
        setIsSearching(false)
      }
    }, 500)
    return () => clearTimeout(searchDebounce.current)
  }, [searchQuery])

  async function pollStatus(jobId) {
    return new Promise((resolve, reject) => {
      const tick = async () => {
        try {
          const res = await fetch(`/api/status/${jobId}`)
          const data = await res.json()
          if (data.status === 'completed') return resolve(data)
          if (data.status === 'error') {
            const err = new Error(data.error || 'Error desconocido')
            err.code = data.code || 'ERR_EXTRACT_FAILED'
            return reject(err)
          }
          setDownloadPct(data.progress || 0)
          setDownloadStep(data.step || 'Procesando...')
          setTimeout(tick, 1500)
        } catch {
          setTimeout(tick, 2000)
        }
      }
      tick()
    })
  }

  const handleSelectResult = async (item) => {
    const val = item.spotify_url || item.url || `${item.artist} - ${item.title}`
    setIsDownloading(true)
    setDownloadPct(0)
    setDownloadStep('Iniciando descarga...')
    setShowResults(false)

    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: val }),
      })
      const data = await res.json()

      let finalData
      if (data.status === 'cached') {
        setDownloadPct(100)
        setDownloadStep('Cargado desde caché ⚡')
        const sr = await fetch(`/api/status/${data.job_id}`)
        finalData = { ...(await sr.json()), job_id: data.job_id }
      } else {
        finalData = await pollStatus(data.job_id)
        finalData.job_id = data.job_id
      }

      if (finalData.status !== 'completed') {
        const err = new Error(finalData.error)
        err.code = finalData.code || 'ERR_EXTRACT_FAILED'
        throw err
      }

      const { track_name, artist_name, lrc_path, job_id, heatmap } = finalData.data || finalData

      // Load duration
      const audioEl = new Audio(`/api/data/${job_id || data.job_id}/audio`)
      let dur = 180
      await new Promise((resolve, reject) => {
        audioEl.onloadedmetadata = () => {
          dur = audioEl.duration
          resolve()
        }
        audioEl.onerror = () => {
          reject(new Error("Error al decodificar metadatos del audio"))
        }
      })

      // Load lyrics
      let parsed = []
      if (lrc_path) {
        try {
          const lyrRes = await fetch(`/api/data/${job_id || data.job_id}/lyrics`)
          if (lyrRes.ok) {
            const lyrData = await lyrRes.json()
            parsed = parseLRC(lyrData.lyrics)
          }
        } catch {}
      }

      // Update state
      setJobData(job_id || data.job_id, track_name, artist_name, !!lrc_path, heatmap || [])
      setAudioDuration(dur)
      setParsedLyrics(parsed)

      // Replace audio & lyrics tracks
      updateTrack('audio', [{
        id: 'audio-main-' + Date.now(),
        type: 'audio',
        start: 0,
        duration: dur,
        mediaStart: 0,
      }])

      updateTrack('lyrics', lrc_path ? [{
        id: 'lyrics-main-' + Date.now(),
        type: 'lyrics',
        start: 0,
        duration: dur,
        mediaStart: 0,
      }] : [])

      addToast('Audio y Letras importados correctamente', 'success')
      onClose()
    } catch (err) {
      addToast(err.message || 'Error al descargar la canción', 'error', err.code || 'ERR_EXTRACT_FAILED')
    } finally {
      setIsDownloading(false)
    }
  }

  if (!isOpen) return null

  const filteredResults = hideNoLyrics ? searchResults.filter(r => r.has_lyrics) : searchResults

  return (
    <div className="modal-overlay" style={{ zIndex: 11000 }}>
      <motion.div 
        className="modal-box"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{ maxWidth: 500, padding: '24px' }}
      >
        <h2 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>Importar Audio y Letras</h2>
        
        {!isDownloading ? (
          <>
            <div className="search-input-wrap" style={{ marginBottom: '12px' }}>
              <span className="search-icon">🔍</span>
              <input
                type="search"
                placeholder="Busca una canción o ingresa URL..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoFocus
              />
              {isSearching && <span className="search-spinner" />}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <input 
                id="modal-hide-lyrics-chk"
                type="checkbox" 
                checked={hideNoLyrics} 
                onChange={e => setHideNoLyrics(e.target.checked)}
                style={{ cursor: 'pointer', accentColor: 'var(--lava-red)' }}
              />
              <label htmlFor="modal-hide-lyrics-chk" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                Ocultar canciones sin letras sincronizadas
              </label>
            </div>

            <div className="search-results-list">
              {showResults && (
                filteredResults.length > 0 ? (
                  filteredResults.map((r, i) => (
                    <button
                      key={i}
                      className="search-result-item"
                      onClick={() => handleSelectResult(r)}
                    >
                      {r.thumbnail ? (
                        <img src={r.thumbnail} className="search-result-thumb" alt="" />
                      ) : (
                        <div className="search-result-thumb-placeholder">🎵</div>
                      )}
                      <div className="search-result-info">
                        <div className="search-result-title">
                          <span>{r.title}</span>
                          <span className="search-result-duration">{r.duration}</span>
                        </div>
                        <div className="search-result-artist" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                          <span>{r.artist}</span>
                          {r.is_downloaded && (
                            <span className="search-result-badge" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                              ✓ YA DESCARGADA
                            </span>
                          )}
                          {r.is_downloaded && r.missing_lyrics && (
                            <span className="search-result-badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                              ⚠️ FALTAN LOS LYRICS
                            </span>
                          )}
                          <span className={`search-result-badge ${r.has_lyrics ? 'lyrics-yes' : 'lyrics-no'}`}>
                            {r.has_lyrics ? '📝 Sincronizada' : '❌ Sin Letra'}
                          </span>
                          {r.source && (
                            <span className={`search-result-badge ${r.source}`}>
                              {r.source === 'yt_music' ? 'YT Music' : r.source === 'soundcloud' ? 'SoundCloud' : r.source === 'youtube' ? 'YouTube' : 'Spotify'}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="search-no-results">No se encontraron resultados</div>
                )
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button className="btn-secondary" onClick={onClose}>Cancelar</button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div className="search-spinner" style={{ width: '40px', height: '40px', borderThickness: '3px', margin: '0 auto 16px auto' }} />
            <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '8px' }}>{downloadStep}</div>
            
            <div style={{ width: '100%', background: 'rgba(255,255,255,0.08)', height: '6px', borderRadius: '3px', overflow: 'hidden', marginBottom: '8px' }}>
              <div style={{ width: `${downloadPct}%`, background: 'var(--lava-gradient)', height: '100%', transition: 'width 0.2s' }} />
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{downloadPct}% completado</div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
