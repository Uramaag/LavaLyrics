import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../store/useAppStore'
import '../styles/modals.css'

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

export default function IntroScreen() {
  const { setScreen, setProgress, setJobData, setParsedLyrics, updateTrack, setAudioDuration } = useAppStore()

  const [urlValue, setUrlValue] = useState('')
  const [status, setStatus] = useState('')
  const [isError, setIsError] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)

  // Search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const searchDebounce = useRef(null)

  // Recents (Downloads Library)
  const [recents, setRecents] = useState([])
  const [sidebarFilter, setSidebarFilter] = useState('')

  useEffect(() => {
    fetch('/api/recent')
      .then(r => r.json())
      .then(d => setRecents(d.recent || []))
      .catch(() => {})
  }, [])

  // Search debounce
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
      }
      finally { setIsSearching(false) }
    }, 500)
    return () => clearTimeout(searchDebounce.current)
  }, [searchQuery])

  const handleSelectResult = (item) => {
    const val = item.spotify_url || item.url || `${item.artist} - ${item.title}`
    setUrlValue(val)
    setSearchQuery(`${item.title} — ${item.artist}`)
    setShowResults(false)
    // Auto-trigger extract
    setTimeout(() => extractFromUrl(val), 100)
  }

  async function pollStatus(jobId, onProgress) {
    return new Promise((resolve, reject) => {
      const tick = async () => {
        try {
          const res = await fetch(`/api/status/${jobId}`)
          const data = await res.json()
          if (data.status === 'completed') return resolve(data)
          if (data.status === 'error') return reject(new Error(data.error || 'Error desconocido'))
          if (onProgress) onProgress(data.progress || 0, data.step || 'Procesando...')
          setTimeout(tick, 1500)
        } catch (e) {
          setTimeout(tick, 2000)
        }
      }
      tick()
    })
  }

  async function loadCachedSong(jobId, trackName, artistName, hasLrc) {
    setIsExtracting(true)
    setIsError(false)
    setStatus('')
    setScreen('progress')
    setProgress(30, 'Cargando audio desde caché...')

    try {
      setJobData(jobId, trackName, artistName, hasLrc)

      // Load audio duration
      const audioEl = new Audio(`/api/data/${jobId}/audio`)
      await new Promise((resolve, reject) => {
        audioEl.onloadedmetadata = () => {
          const dur = audioEl.duration
          setAudioDuration(dur)
          updateTrack('audio', [{
            id: 'audio-main',
            type: 'audio',
            start: 0,
            duration: dur,
            mediaStart: 0,
          }])
          resolve()
        }
        audioEl.onerror = () => {
          reject(new Error("No se pudo cargar el archivo de audio. Verifica que exista y que el servidor esté activo."))
        }
      })

      // Load lyrics
      if (hasLrc) {
        setProgress(70, 'Cargando letras desde caché...')
        try {
          const lyrRes = await fetch(`/api/data/${jobId}/lyrics`)
          if (lyrRes.ok) {
            const lyrData = await lyrRes.json()
            const parsed = parseLRC(lyrData.lyrics)
            setParsedLyrics(parsed)
            updateTrack('lyrics', [{
              id: 'lyrics-main',
              type: 'lyrics',
              start: 0,
              duration: audioEl.duration || 180,
              mediaStart: 0,
            }])
          }
        } catch {}
      }

      setProgress(100, '¡Cargado con éxito! ⚡')
      setTimeout(() => setScreen('editor'), 400)
    } catch (err) {
      setScreen('intro')
      setStatus('Error al cargar audio desde caché')
      setIsError(true)
      setIsExtracting(false)
    }
  }

  async function extractFromUrl(url) {
    if (!url) {
      setStatus('Ingresa una URL de Spotify o término de búsqueda.'); setIsError(true); return
    }
    setIsExtracting(true); setIsError(false); setStatus('')
    setScreen('progress')
    setProgress(0, 'Iniciando extracción...')

    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()

      let finalData
      if (data.status === 'cached') {
        setProgress(100, 'Cargado desde caché ⚡')
        const sr = await fetch(`/api/status/${data.job_id}`)
        finalData = { ...(await sr.json()), job_id: data.job_id }
      } else {
        finalData = await pollStatus(data.job_id, (pct, step) => setProgress(pct, step))
        finalData.job_id = data.job_id
      }

      if (finalData.status !== 'completed') throw new Error(finalData.error)

      const { track_name, artist_name, lrc_path, job_id } = finalData.data || finalData
      setJobData(job_id || data.job_id, track_name, artist_name, !!lrc_path)

      // Load audio duration
      const audioEl = new Audio(`/api/data/${job_id || data.job_id}/audio`)
      await new Promise((resolve, reject) => {
        audioEl.onloadedmetadata = () => {
          const dur = audioEl.duration
          setAudioDuration(dur)
          updateTrack('audio', [{
            id: 'audio-main',
            type: 'audio',
            start: 0,
            duration: dur,
            mediaStart: 0,
          }])
          resolve()
        }
        audioEl.onerror = () => {
          reject(new Error("No se pudo cargar el archivo de audio. Verifica que exista y que el servidor esté activo."))
        }
      })

      // Load lyrics
      try {
        const lyrRes = await fetch(`/api/data/${job_id || data.job_id}/lyrics`)
        if (lyrRes.ok) {
          const lyrData = await lyrRes.json()
          const parsed = parseLRC(lyrData.lyrics)
          setParsedLyrics(parsed)
          updateTrack('lyrics', [{
            id: 'lyrics-main',
            type: 'lyrics',
            start: 0,
            duration: audioEl.duration || 180,
            mediaStart: 0,
          }])
        }
      } catch {}

      setProgress(100, '¡Listo!')
      setTimeout(() => setScreen('editor'), 600)
    } catch (err) {
      setScreen('intro')
      setStatus(err.message || 'Error al extraer')
      setIsError(true)
      setIsExtracting(false)
    }
  }

  const handleExtract = () => extractFromUrl(urlValue)

  // Filter recents
  const filteredRecents = recents.filter(r => 
    r.title.toLowerCase().includes(sidebarFilter.toLowerCase()) || 
    r.artist.toLowerCase().includes(sidebarFilter.toLowerCase())
  )

  return (
    <div className="intro-root">
      <div className="bg-mesh" />
      
      <div className="intro-layout">
        
        {/* Main Card */}
        <motion.div
          className="intro-card"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* Logo */}
          <div className="intro-logo">
            <h1>
              Lava<span className="text-gradient">Lyrics</span>
            </h1>
            <p>Genera clips virales con letras sincronizadas</p>
          </div>

          {/* URL Input */}
          <div className="intro-input-group">
            <label className="label">URL de Spotify / YouTube</label>
            <div className="intro-input-wrap">
              <input
                id="spotify-url"
                type="url"
                placeholder="https://open.spotify.com/track/... o enlace de YouTube"
                value={urlValue}
                onChange={e => setUrlValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleExtract()}
                disabled={isExtracting}
              />
              <span className="intro-input-icon">🎵</span>
            </div>
          </div>

          <button
            id="btn-extract"
            className="btn-primary"
            style={{ width: '100%', marginBottom: '8px' }}
            onClick={handleExtract}
            disabled={isExtracting}
          >
            {isExtracting ? 'Procesando...' : 'Extraer Audio y Letras →'}
          </button>

          {status && (
            <p className={`status-message${isError ? ' error' : ''}`}>{status}</p>
          )}

          {/* Divider */}
          <div className="intro-divider">
            <span>o busca una canción</span>
          </div>

          {/* Search */}
          <div className="search-container">
            <div className="search-input-wrap">
              <span className="search-icon">🔍</span>
              <input
                id="song-search"
                type="search"
                placeholder="Buscar artista, canción..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                disabled={isExtracting}
              />
              {isSearching && <span className="search-spinner" />}
            </div>

            <AnimatePresence>
              {showResults && (
                <motion.div
                  className="search-results-list"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {searchResults.length > 0 ? (
                    searchResults.map((r, i) => (
                      <button
                        key={i}
                        className="search-result-item"
                        onClick={() => handleSelectResult(r)}
                      >
                        {r.thumbnail ? (
                          <img className="search-result-thumb" src={r.thumbnail} alt="" />
                        ) : (
                          <div className="search-result-thumb-placeholder">🎵</div>
                        )}
                        <div className="search-result-info">
                          <div className="search-result-title">
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {r.title}
                            </span>
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
                              <span className={`search-result-badge ${r.source}`}>
                                {r.source === 'yt_music' ? '🎵 YT Music' : r.source === 'youtube' ? '🎥 YouTube' : r.source === 'soundcloud' ? '☁️ SoundCloud' : '🟢 Spotify'}
                              </span>
                              {r.has_lyrics ? (
                                <span className="search-result-badge lyrics-yes">
                                  📝 Sincronizada
                                </span>
                              ) : (
                                <span className="search-result-badge lyrics-no">
                                  ❌ Sin Letra
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="search-result-artist">{r.artist}</div>
                        </div>
                        {r.duration && (
                          <span className="search-result-duration">{r.duration}</span>
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="search-no-results">
                      No se encontró nada 😢
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Sidebar Downloads */}
        <motion.div
          className="sidebar-downloads"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
        >
          <div className="sidebar-header">
            <h3>Descargas Previas</h3>
            <span className="sidebar-count">{filteredRecents.length}</span>
          </div>
          <p className="sidebar-desc">Tus audios y letras listos para editar al instante</p>
          
          <div className="sidebar-search-wrap">
            <span className="sidebar-search-icon">🔍</span>
            <input
              type="text"
              placeholder="Buscar en tu biblioteca..."
              value={sidebarFilter}
              onChange={e => setSidebarFilter(e.target.value)}
              disabled={isExtracting}
            />
          </div>

          <div className="sidebar-list">
            {filteredRecents.length > 0 ? (
              filteredRecents.map((r, i) => (
                <button
                  key={i}
                  className="sidebar-item"
                  onClick={() => loadCachedSong(r.job_id, r.title, r.artist, !!r.lrc_path)}
                  disabled={isExtracting}
                >
                  {r.thumbnail ? (
                    <img className="sidebar-item-thumb" src={r.thumbnail} alt="" />
                  ) : (
                    <div className="sidebar-item-thumb-placeholder">🎵</div>
                  )}
                  <div className="sidebar-item-info">
                    <div className="sidebar-item-name">{r.title}</div>
                    <div className="sidebar-item-artist">
                      {r.artist} {r.lrc_path && <span className="lrc-indicator">📝 Letra</span>}
                    </div>
                  </div>
                  <span className="sidebar-item-arrow">→</span>
                </button>
              ))
            ) : (
              <div className="sidebar-empty">
                {sidebarFilter ? 'Ningún audio coincide' : 'Biblioteca vacía'}
              </div>
            )}
          </div>
        </motion.div>

      </div>
    </div>
  )
}
