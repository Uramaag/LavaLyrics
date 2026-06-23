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
  const { setScreen, setProgress, setJobData, setParsedLyrics, updateTrack, setAudioDuration, addToast, loadProjectState } = useAppStore()

  const [urlValue, setUrlValue] = useState('')
  const [status, setStatus] = useState('')
  const [isError, setIsError] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)

  // Search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [hideNoLyrics, setHideNoLyrics] = useState(false)
  const searchDebounce = useRef(null)

  // Projects list
  const [projects, setProjects] = useState([])
  const [projectFilter, setProjectFilter] = useState('')

  // New project modal state
  const [showNewProjectModal, setShowNewProjectModal] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [orientation, setOrientation] = useState('vertical') // 'vertical' | 'horizontal'
  const [resolution, setResolution] = useState('1080x1920') // '1080x1920' | '1920x1080'
  const [fps, setFps] = useState('30')

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects')
      const d = await res.json()
      setProjects(d.projects || [])
    } catch {}
  }

  useEffect(() => {
    fetchProjects()
  }, [])

  // Auto-adjust resolution when orientation changes
  useEffect(() => {
    if (orientation === 'vertical') {
      setResolution('1080x1920')
    } else {
      setResolution('1920x1080')
    }
  }, [orientation])

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
    setTimeout(() => extractFromUrl(val, `${item.artist} - ${item.title}`), 100)
  }

  async function pollStatus(jobId, onProgress) {
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
          if (onProgress) onProgress(data.progress || 0, data.step || 'Procesando...')
          setTimeout(tick, 1500)
        } catch (e) {
          setTimeout(tick, 2000)
        }
      }
      tick()
    })
  }

  // Load an existing .lavalyrics project
  const loadExistingProject = async (projectName) => {
    setIsExtracting(true)
    setScreen('progress')
    setProgress(20, 'Cargando archivo de proyecto...')
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}`)
      if (!res.ok) throw new Error('No se pudo cargar el proyecto')
      const d = await res.json()
      loadProjectState(d.state)
      setProgress(100, 'Proyecto cargado ⚡')
    } catch (err) {
      setScreen('intro')
      addToast(err.message, 'error', 'ERR_PROJECT_LOAD_FAILED')
    } finally {
      setIsExtracting(false)
    }
  }

  // Delete an existing project
  const deleteProject = async (e, projectName) => {
    e.stopPropagation()
    if (!confirm(`¿Estás seguro de que deseas eliminar el proyecto "${projectName}"?`)) return
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}`, { method: 'DELETE' })
      if (res.ok) {
        addToast('Proyecto eliminado con éxito', 'success')
        fetchProjects()
      } else {
        throw new Error()
      }
    } catch {
      addToast('No se pudo eliminar el proyecto', 'error', 'ERR_PROJECT_DELETE_FAILED')
    }
  }

  // Create an empty project
  const handleCreateEmptyProject = async () => {
    const trimmedName = newProjectName.trim()
    if (!trimmedName) {
      addToast('Ingresa un nombre para el proyecto', 'error', 'ERR_INVALID_NAME')
      return
    }

    const initialProjectState = {
      projectName: trimmedName,
      currentJobId: null,
      trackName: '',
      artistName: '',
      hasLyrics: false,
      audioDuration: 0,
      bgVideoPath: null,
      bgVideoDuration: 0,
      parsedLyrics: [],
      tracks: { audio: [], video: [], lyrics: [] },
      clipFilters: {},
      exportSettings: {
        resolution: resolution,
        orientation: orientation,
        fps: parseInt(fps),
        inPoint: 0,
        outPoint: 30
      }
    }

    try {
      const saveRes = await fetch(`/api/projects/${encodeURIComponent(trimmedName)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: initialProjectState })
      })
      if (!saveRes.ok) throw new Error()
      
      loadProjectState(initialProjectState)
      setShowNewProjectModal(false)
      addToast('Proyecto en blanco creado', 'success')
    } catch {
      addToast('Error al inicializar el proyecto en el disco', 'error', 'ERR_PROJECT_SAVE_FAILED')
    }
  }

  // Extract lyrics and create project automatically
  async function extractFromUrl(url, defaultProjName = 'Nuevo Proyecto') {
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

      if (finalData.status !== 'completed') {
        const err = new Error(finalData.error || 'Error de extracción')
        err.code = finalData.code || 'ERR_EXTRACT_FAILED'
        throw err
      }

      const { track_name, artist_name, lrc_path, job_id, heatmap } = finalData.data || finalData
      
      // Load audio duration
      const audioEl = new Audio(`/api/data/${job_id || data.job_id}/audio`)
      let dur = 180
      await new Promise((resolve, reject) => {
        audioEl.onloadedmetadata = () => {
          dur = audioEl.duration
          resolve()
        }
        audioEl.onerror = () => {
          reject(new Error("No se pudo leer la duración del audio descargado."))
        }
      })

      // Load lyrics content if available
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

      // Initialize auto-created project state
      const cleanedProjName = `${artist_name} - ${track_name}`.replace(/[\\/*?:"<>|]/g, "")
      const initialProjectState = {
        projectName: cleanedProjName,
        currentJobId: job_id || data.job_id,
        trackName: track_name,
        artistName: artist_name,
        audioWavemap: heatmap || [],
        hasLyrics: !!lrc_path,
        audioDuration: dur,
        bgVideoPath: null,
        bgVideoDuration: 0,
        parsedLyrics: parsed,
        tracks: {
          audio: [{
            id: 'audio-main',
            type: 'audio',
            start: 0,
            duration: dur,
            mediaStart: 0,
          }],
          video: [],
          lyrics: lrc_path ? [{
            id: 'lyrics-main',
            type: 'lyrics',
            start: 0,
            duration: dur,
            mediaStart: 0,
          }] : []
        },
        clipFilters: {},
        exportSettings: {
          resolution: '1080x1920',
          orientation: 'vertical',
          fps: 30,
          inPoint: 0,
          outPoint: Math.min(30, dur)
        }
      }

      // Save initial project state on disk
      await fetch(`/api/projects/${encodeURIComponent(cleanedProjName)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: initialProjectState })
      })

      loadProjectState(initialProjectState)
      setProgress(100, '¡Listo!')
      addToast('Proyecto inicializado y audio importado', 'success')
    } catch (err) {
      setScreen('intro')
      addToast(err.message || 'Error al descargar la pista', 'error', err.code || 'ERR_EXTRACT_FAILED')
      setIsExtracting(false)
    }
  }

  const handleExtract = () => extractFromUrl(urlValue)

  // Filter projects
  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(projectFilter.toLowerCase()) || 
    (p.track_name && p.track_name.toLowerCase().includes(projectFilter.toLowerCase())) ||
    (p.artist_name && p.artist_name.toLowerCase().includes(projectFilter.toLowerCase()))
  )

  const filteredSearchResults = hideNoLyrics ? searchResults.filter(r => r.has_lyrics) : searchResults

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

            {/* Sync Filter Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', paddingLeft: '4px' }}>
              <input 
                id="hide-no-lyrics-checkbox"
                type="checkbox" 
                checked={hideNoLyrics} 
                onChange={e => setHideNoLyrics(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--lava-red)', cursor: 'pointer' }}
              />
              <label htmlFor="hide-no-lyrics-checkbox" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
                Ocultar canciones sin letras sincronizadas
              </label>
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
                  {filteredSearchResults.length > 0 ? (
                    filteredSearchResults.map((r, i) => (
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

        {/* Sidebar Projects */}
        <motion.div
          className="sidebar-downloads"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
        >
          <div className="sidebar-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Tus Proyectos</h3>
              <span className="sidebar-count">{filteredProjects.length}</span>
            </div>
            
            <button 
              className="btn-primary" 
              style={{ padding: '8px 12px', fontSize: '0.82rem', width: '100%' }}
              onClick={() => setShowNewProjectModal(true)}
            >
              + Nuevo Proyecto Vacío
            </button>
          </div>
          
          <div className="sidebar-search-wrap" style={{ marginTop: '12px' }}>
            <span className="sidebar-search-icon">🔍</span>
            <input
              type="text"
              placeholder="Buscar proyectos..."
              value={projectFilter}
              onChange={e => setProjectFilter(e.target.value)}
              disabled={isExtracting}
            />
          </div>

          <div className="sidebar-list" style={{ marginTop: '8px' }}>
            {filteredProjects.length > 0 ? (
              filteredProjects.map((p, i) => (
                <div
                  key={i}
                  className="sidebar-item"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', cursor: 'pointer' }}
                  onClick={() => loadExistingProject(p.name)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, overflow: 'hidden' }}>
                    <div className="sidebar-item-thumb-placeholder">🗂️</div>
                    <div className="sidebar-item-info" style={{ overflow: 'hidden' }}>
                      <div className="sidebar-item-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                        {p.name}
                      </div>
                      <div className="sidebar-item-artist" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                        {p.track_name ? `${p.track_name} — ${p.artist_name}` : 'Proyecto en blanco'}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <button 
                      className="btn-ghost" 
                      style={{ padding: '4px 8px', color: 'var(--lava-red)', fontSize: '0.9rem' }}
                      onClick={(e) => deleteProject(e, p.name)}
                    >
                      🗑️
                    </button>
                    <span className="sidebar-item-arrow">→</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="sidebar-empty">
                {projectFilter ? 'Ningún proyecto coincide' : 'No tienes proyectos guardados'}
              </div>
            )}
          </div>
        </motion.div>

      </div>

      {/* New Project Modal */}
      {showNewProjectModal && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <motion.div 
            className="modal-box" 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ maxWidth: 460, padding: '24px' }}
          >
            <h2 style={{ fontSize: '1.3rem', marginBottom: '16px' }}>Configurar Nuevo Proyecto</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
              <div>
                <label className="label">Nombre del Proyecto</label>
                <input 
                  type="text" 
                  placeholder="Mi Video Viral"
                  value={newProjectName}
                  onChange={e => setNewProjectName(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="label">Orientación</label>
                  <select 
                    value={orientation} 
                    onChange={e => setOrientation(e.target.value)}
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', padding: '10px', borderRadius: 'var(--radius-md)', width: '100%', outline: 'none' }}
                  >
                    <option value="vertical">Vertical (9:16)</option>
                    <option value="horizontal">Horizontal (16:9)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Resolución</label>
                  <select 
                    value={resolution} 
                    onChange={e => setResolution(e.target.value)}
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', padding: '10px', borderRadius: 'var(--radius-md)', width: '100%', outline: 'none' }}
                  >
                    {orientation === 'vertical' ? (
                      <>
                        <option value="1080x1920">1080 x 1920 (TikTok/Reels)</option>
                        <option value="720x1280">720 x 1280 (SD Vertical)</option>
                      </>
                    ) : (
                      <>
                        <option value="1920x1080">1920 x 1080 (YouTube/HD)</option>
                        <option value="1280x720">1280 x 720 (SD Horizontal)</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Tasa de Fotogramas (FPS)</label>
                <select 
                  value={fps} 
                  onChange={e => setFps(e.target.value)}
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', padding: '10px', borderRadius: 'var(--radius-md)', width: '100%', outline: 'none' }}
                >
                  <option value="30">30 FPS (Recomendado)</option>
                  <option value="60">60 FPS (Ultra fluido)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                className="btn-secondary" 
                onClick={() => setShowNewProjectModal(false)}
              >
                Cancelar
              </button>
              <button 
                className="btn-primary" 
                onClick={handleCreateEmptyProject}
              >
                Crear Proyecto
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
