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
  const toasts = useAppStore(s => s.toasts)
  const removeToast = useAppStore(s => s.removeToast)
  const { undo, redo } = useAppStore()

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

      {/* Toasts System Container */}
      <div className="toasts-wrapper">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              className={`toast-item ${toast.type}`}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            >
              <div className="toast-header-row">
                <div className="toast-title">
                  {toast.type === 'error' ? '❌ Error' : toast.type === 'success' ? '🚀 Éxito' : 'ℹ️ Info'}
                  {toast.code && <span className="toast-code">{toast.code}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button 
                    className="toast-copy" 
                    title="Copiar detalles"
                    onClick={(e) => {
                      e.stopPropagation();
                      const txt = `[${toast.type.toUpperCase()}] ${toast.code ? toast.code + ': ' : ''}${toast.message}`;
                      navigator.clipboard.writeText(txt);
                    }}
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      border: 'none',
                      color: 'var(--text-muted)',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      fontSize: '0.7rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    📋 Copiar
                  </button>
                  <button className="toast-close" onClick={() => removeToast(toast.id)} style={{ position: 'relative', top: 'auto', right: 'auto' }}>✕</button>
                </div>
              </div>
              <div className="toast-message">{toast.message}</div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  )
}
