import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAppStore } from './store/useAppStore'
import IntroScreen from './screens/IntroScreen'
import ProgressScreen from './screens/ProgressScreen'
import EditorScreen from './screens/EditorScreen'

const screenVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -12 },
}

export default function App() {
  const screen = useAppStore(s => s.screen)
  const { undo, redo, loadProjectState } = useAppStore()
  const [restoreData, setRestoreData] = useState(null)

  // 1. Keep-Alive Heartbeat
  useEffect(() => {
    const heartbeat = setInterval(() => {
      fetch('/api/keepalive', { method: 'POST' }).catch(() => {})
    }, 5000)
    return () => clearInterval(heartbeat)
  }, [])

  // 1b. Disable default browser context menu globally for custom timeline context menus
  useEffect(() => {
    const handleContextMenu = (e) => e.preventDefault()
    window.addEventListener('contextmenu', handleContextMenu)
    return () => window.removeEventListener('contextmenu', handleContextMenu)
  }, [])

  // 2. Undo/Redo global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        return
      }
      if (e.ctrlKey) {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault()
          undo()
        } else if (e.key.toLowerCase() === 'y') {
          e.preventDefault()
          redo()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  // 3. Project state check on mount
  useEffect(() => {
    fetch('/api/project/state')
      .then(res => res.json())
      .then(data => {
        if (data && data.state) {
          setRestoreData(data.state)
        }
      })
      .catch(() => {})
  }, [])

  return (
    <>
      <AnimatePresence mode="wait">
        {screen === 'intro' && (
          <motion.div key="intro" {...screenVariants} transition={{ duration: 0.3 }} style={{ flex: 1 }}>
            <IntroScreen />
          </motion.div>
        )}
        {screen === 'progress' && (
          <motion.div key="progress" {...screenVariants} transition={{ duration: 0.3 }} style={{ flex: 1 }}>
            <ProgressScreen />
          </motion.div>
        )}
        {screen === 'editor' && (
          <motion.div key="editor" {...screenVariants} transition={{ duration: 0.3 }} style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh' }}>
            <EditorScreen />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Restore progress modal */}
      {restoreData && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <motion.div
            className="modal-box"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ maxWidth: 450 }}
          >
            <h2>¿Restaurar progreso anterior?</h2>
            <p style={{ margin: '12px 0 20px 0', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Se encontró una sesión anterior de <strong>{restoreData.trackName || 'Canción'}</strong> por {restoreData.artistName || 'Artista'}. ¿Deseas restaurar tu progreso y seguir editando?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                className="btn-secondary"
                onClick={async () => {
                  try {
                    await fetch('/api/project/state', { method: 'DELETE' })
                  } catch {}
                  setRestoreData(null)
                }}
              >
                Descartar
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  loadProjectState(restoreData)
                  setRestoreData(null)
                }}
              >
                Restaurar Progreso
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  )
}
