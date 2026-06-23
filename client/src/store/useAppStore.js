import { create } from 'zustand'

const DEFAULT_FILTERS = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  hue: 0,
}

let autoSaveTimeout = null
const triggerAutoSave = (get, set) => {
  clearTimeout(autoSaveTimeout)
  autoSaveTimeout = setTimeout(async () => {
    const state = get()
    if (!state.projectName) return
    set({ savingStatus: 'saving' })
    try {
      await fetch(`/api/projects/${encodeURIComponent(state.projectName)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: {
            projectName: state.projectName,
            currentJobId: state.currentJobId,
            trackName: state.trackName,
            artistName: state.artistName,
            hasLyrics: state.hasLyrics,
            audioDuration: state.audioDuration,
            bgVideoPath: state.bgVideoPath,
            bgVideoDuration: state.bgVideoDuration,
            parsedLyrics: state.parsedLyrics,
            tracks: state.tracks,
            clipFilters: state.clipFilters,
            exportSettings: state.exportSettings,
            audioWavemap: state.audioWavemap || [],
          }
        })
      })
      set({ savingStatus: 'saved' })
      setTimeout(() => {
        if (get().savingStatus === 'saved') set({ savingStatus: 'idle' })
      }, 1500)
    } catch {
      set({ savingStatus: 'idle' })
    }
  }, 1000)
}

export const useAppStore = create((set, get) => ({
  // ── Screen ──────────────────────────────────────────────
  screen: 'intro',   // 'intro' | 'progress' | 'editor'
  setScreen: (s) => set({ screen: s }),

  // ── Progress ─────────────────────────────────────────────
  progressPct: 0,
  progressStep: '',
  setProgress: (pct, step) => set({ progressPct: pct, progressStep: step }),

  // ── Toasts ───────────────────────────────────────────────
  toasts: [],
  addToast: (message, type = 'info', code = '') => {
    const id = Date.now() + Math.random()
    set(s => ({ toasts: [...s.toasts, { id, message, type, code }] }))
    setTimeout(() => {
      set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }))
    }, 4500)
  },
  removeToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),

  // ── Project / Job / Track info ───────────────────────────
  projectName: '',
  setProjectName: (name) => set({ projectName: name }),
  currentJobId: null,
  trackName: '',
  artistName: '',
  hasLyrics: false,
  audioWavemap: [],
  setJobData: (jobId, trackName, artistName, hasLyrics, wavemap = []) => {
    set({ currentJobId: jobId, trackName, artistName, hasLyrics, audioWavemap: wavemap })
    triggerAutoSave(get, set)
  },

  // ── Save status ──────────────────────────────────────────
  savingStatus: 'idle', // 'idle' | 'saving' | 'saved'
  setSavingStatus: (s) => set({ savingStatus: s }),

  // ── Undo / Redo history ──────────────────────────────────
  undoStack: [],
  redoStack: [],

  saveHistory: () => {
    const { tracks, clipFilters, undoStack } = get()
    const tracksCopy = JSON.parse(JSON.stringify(tracks))
    const filtersCopy = JSON.parse(JSON.stringify(clipFilters))
    set({
      undoStack: [...undoStack, { tracks: tracksCopy, clipFilters: filtersCopy }].slice(-50),
      redoStack: [],
    })
  },

  undo: () => {
    const { undoStack, redoStack, tracks, clipFilters } = get()
    if (!undoStack.length) return
    const prev = undoStack[undoStack.length - 1]
    const newUndoStack = undoStack.slice(0, -1)
    const currentTracks = JSON.parse(JSON.stringify(tracks))
    const currentFilters = JSON.parse(JSON.stringify(clipFilters))
    set({
      tracks: prev.tracks,
      clipFilters: prev.clipFilters,
      undoStack: newUndoStack,
      redoStack: [...redoStack, { tracks: currentTracks, clipFilters: currentFilters }],
    })
    triggerAutoSave(get, set)
  },

  redo: () => {
    const { undoStack, redoStack, tracks, clipFilters } = get()
    if (!redoStack.length) return
    const next = redoStack[redoStack.length - 1]
    const newRedoStack = redoStack.slice(0, -1)
    const currentTracks = JSON.parse(JSON.stringify(tracks))
    const currentFilters = JSON.parse(JSON.stringify(clipFilters))
    set({
      tracks: next.tracks,
      clipFilters: next.clipFilters,
      redoStack: newRedoStack,
      undoStack: [...undoStack, { tracks: currentTracks, clipFilters: currentFilters }],
    })
    triggerAutoSave(get, set)
  },

  // ── Media state ──────────────────────────────────────────
  audioDuration: 0,
  setAudioDuration: (d) => {
    set({ audioDuration: d })
    triggerAutoSave(get, set)
  },
  bgVideoPath: null,
  bgVideoBlobUrl: null,
  bgVideoDuration: 0,
  setBgVideo: (path, duration) => {
    set({ bgVideoPath: path, bgVideoDuration: duration })
    triggerAutoSave(get, set)
  },
  setBgVideoBlobUrl: (url) => set({ bgVideoBlobUrl: url }),
  parsedLyrics: [],
  setParsedLyrics: (l) => {
    set({ parsedLyrics: l })
    triggerAutoSave(get, set)
  },

  // ── Timeline state ───────────────────────────────────────
  tracks: { audio: [], video: [], lyrics: [] },
  setTracks: (t) => {
    set({ tracks: t })
    triggerAutoSave(get, set)
  },
  updateTrack: (name, clips) => {
    set((s) => ({ tracks: { ...s.tracks, [name]: clips } }))
    triggerAutoSave(get, set)
  },

  selectedClipId: null,
  setSelectedClipId: (id) => set({ selectedClipId: id }),

  pixelsPerSecond: 30,
  setPixelsPerSecond: (v) => set({ pixelsPerSecond: Math.max(5, Math.min(200, v)) }),

  masterTime: 0,
  setMasterTime: (t) => set({ masterTime: t }),

  isPlaying: false,
  setIsPlaying: (v) => set({ isPlaying: v }),

  // ── Filters ──────────────────────────────────────────────
  clipFilters: {},
  setClipFilter: (clipId, key, value) => {
    set((s) => ({
      clipFilters: {
        ...s.clipFilters,
        [clipId]: {
          ...(s.clipFilters[clipId] || DEFAULT_FILTERS),
          [key]: value,
        },
      },
    }))
    triggerAutoSave(get, set)
  },
  setClipFilters: (clipId, filters) => {
    set((s) => ({
      clipFilters: {
        ...s.clipFilters,
        [clipId]: { ...(s.clipFilters[clipId] || DEFAULT_FILTERS), ...filters },
      },
    }))
    triggerAutoSave(get, set)
  },
  resetClipFilters: (clipId) => {
    set((s) => ({
      clipFilters: { ...s.clipFilters, [clipId]: { ...DEFAULT_FILTERS } },
    }))
    triggerAutoSave(get, set)
  },
  getClipFilters: (clipId) => get().clipFilters[clipId] || DEFAULT_FILTERS,

  // ── Load full project state ──────────────────────────────
  loadProjectState: (projState) => {
    // Determine the maximum layer index inside project to ensure we load enough layers
    let maxLayer = 1
    if (projState.tracks && projState.tracks.video) {
      projState.tracks.video.forEach(c => {
        if ((c.layer || 0) > maxLayer) maxLayer = c.layer
      })
    }
    const currentStoredLayers = parseInt(localStorage.getItem('lavalyrics_layers_count') || "2")
    if (maxLayer + 1 > currentStoredLayers) {
      localStorage.setItem('lavalyrics_layers_count', (maxLayer + 1).toString())
    }

    set({
      projectName: projState.projectName || '',
      currentJobId: projState.currentJobId || null,
      trackName: projState.trackName || '',
      artistName: projState.artistName || '',
      hasLyrics: projState.hasLyrics || false,
      audioDuration: projState.audioDuration || 0,
      bgVideoPath: projState.bgVideoPath || null,
      bgVideoDuration: projState.bgVideoDuration || 0,
      parsedLyrics: projState.parsedLyrics || [],
      tracks: projState.tracks || { audio: [], video: [], lyrics: [] },
      clipFilters: projState.clipFilters || {},
      exportSettings: projState.exportSettings || { resolution: '1080x1920', inPoint: 0, outPoint: 15 },
      audioWavemap: projState.audioWavemap || [],
      screen: 'editor',
      masterTime: 0,
      isPlaying: false,
      undoStack: [],
      redoStack: [],
    })
  },

  // ── Export modal ─────────────────────────────────────────
  exportModalOpen: false,
  setExportModalOpen: (v) => set({ exportModalOpen: v }),

  exportSettings: {
    resolution: '1080x1920',
    inPoint: 0,
    outPoint: 15,
    fontSize: 28,
    letterSpacing: 0,
  },
  setExportSettings: (s) => {
    set((prev) => ({ exportSettings: { ...prev.exportSettings, ...s } }))
    triggerAutoSave(get, set)
  },

  // ── Render progress ──────────────────────────────────────
  renderProgressOpen: false,
  renderPct: 0,
  renderId: null,
  setRenderState: (open, pct, id) =>
    set({ renderProgressOpen: open, renderPct: pct, renderId: id }),

  // ── Success modal ────────────────────────────────────────
  successModalOpen: false,
  lastExportPath: null,
  setSuccessModal: (open, path) =>
    set({ successModalOpen: open, lastExportPath: path }),

  // ── Reset to intro ────────────────────────────────────────
  resetToIntro: () => {
    set({
      screen: 'intro',
      progressPct: 0,
      progressStep: '',
      projectName: '',
      currentJobId: null,
      trackName: '',
      artistName: '',
      hasLyrics: false,
      audioDuration: 0,
      bgVideoPath: null,
      bgVideoDuration: 0,
      parsedLyrics: [],
      tracks: { audio: [], video: [], lyrics: [] },
      selectedClipId: null,
      masterTime: 0,
      isPlaying: false,
      clipFilters: {},
      exportModalOpen: false,
      renderProgressOpen: false,
      renderPct: 0,
      renderId: null,
      successModalOpen: false,
      lastExportPath: null,
      undoStack: [],
      redoStack: [],
      savingStatus: 'idle',
    })
  },
}))
