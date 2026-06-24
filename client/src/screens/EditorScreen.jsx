import { useRef, useState, useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import Sidebar from '../components/Sidebar'
import PreviewPanel from '../components/PreviewPanel'
import Timeline from '../components/Timeline'
import LowerLeftTabs from '../components/LowerLeftTabs'
import ResizableLayout from '../components/ResizableLayout'
import ExportModal from '../components/ExportModal'
import ExportProgressModal from '../components/ExportProgressModal'
import SuccessModal from '../components/SuccessModal'
import MissingMediaModal from '../components/MissingMediaModal'
import '../styles/editor.css'

export default function EditorScreen() {
  const {
    projectName, trackName, artistName, hasLyrics,
    exportModalOpen, renderProgressOpen, successModalOpen,
    setExportModalOpen, savingStatus, resetToIntro,
    bgVideoPath,
  } = useAppStore()

  const videoRef = useRef(null)
  const audioRef = useRef(null)

  const [showMissingMedia, setShowMissingMedia] = useState(false)
  const [missingPath, setMissingPath] = useState('')

  useEffect(() => {
    if (bgVideoPath) {
      fetch(`/api/check_file?path=${encodeURIComponent(bgVideoPath)}`)
        .then(res => res.json())
        .then(data => {
          if (!data.exists) {
            setMissingPath(bgVideoPath)
            setShowMissingMedia(true)
          }
        })
        .catch(err => console.error("Error al comprobar archivo de video:", err))
    }
  }, [bgVideoPath])

  return (
    <div className="editor-root" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top bar */}
      <header className="editor-topbar" style={{ height: '56px', flexShrink: 0 }}>
        <div className="editor-topbar-left" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="logo-container" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="logo">
              Lava<span className="text-gradient">Lyrics</span>
            </div>
            <div className={`minecraft-save-icon ${savingStatus}`} title={`Autoguardado: ${savingStatus}`}>
              🧰
            </div>
          </div>
          <div className="track-meta" style={{ display: 'flex', flexDirection: 'column' }}>
            <span className="track-name" style={{ fontWeight: 'bold' }}>{projectName}</span>
            <span className="track-artist" style={{ fontSize: '0.75rem', opacity: 0.8 }}>
              {trackName ? `${trackName} — ${artistName}` : 'Proyecto en blanco'}
            </span>
          </div>
          {trackName && (
            hasLyrics
              ? <span className="badge badge-success">Letras ✓</span>
              : <span className="badge badge-warning">Sin letras</span>
          )}
        </div>
        <div className="editor-topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            className="btn-secondary"
            onClick={() => {
              if (confirm('¿Estás seguro de que deseas regresar al inicio? Tu proyecto está autoguardado en el disco.')) {
                resetToIntro()
              }
            }}
            style={{ padding: '10px 16px' }}
          >
            ← Volver al inicio
          </button>
          <button
            id="btn-export"
            className="btn-primary"
            onClick={() => setExportModalOpen(true)}
            style={{ padding: '10px 22px' }}
            disabled={!trackName}
          >
            Exportar →
          </button>
        </div>
      </header>

      {/* 4-Quadrant Resizable Layout */}
      <ResizableLayout
        topLeft={<Sidebar videoRef={videoRef} audioRef={audioRef} />}
        topRight={<PreviewPanel videoRef={videoRef} audioRef={audioRef} />}
        bottomLeft={<LowerLeftTabs videoRef={videoRef} />}
        bottomRight={<Timeline videoRef={videoRef} audioRef={audioRef} />}
      />

      {/* Modals */}
      {exportModalOpen && <ExportModal videoRef={videoRef} audioRef={audioRef} />}
      {renderProgressOpen && <ExportProgressModal />}
      {successModalOpen && <SuccessModal />}
      <MissingMediaModal 
        isOpen={showMissingMedia} 
        onClose={() => setShowMissingMedia(false)} 
        missingPath={missingPath} 
        videoRef={videoRef} 
      />
    </div>
  )
}
