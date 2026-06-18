import { useRef, useCallback } from 'react'
import { useAppStore } from '../store/useAppStore'
import Sidebar from '../components/Sidebar'
import PreviewPanel from '../components/PreviewPanel'
import Timeline from '../components/Timeline'
import ExportModal from '../components/ExportModal'
import ExportProgressModal from '../components/ExportProgressModal'
import SuccessModal from '../components/SuccessModal'
import '../styles/editor.css'

export default function EditorScreen() {
  const {
    trackName, artistName, hasLyrics,
    exportModalOpen, renderProgressOpen, successModalOpen,
    setExportModalOpen, savingStatus, resetToIntro,
  } = useAppStore()

  const videoRef = useRef(null)
  const audioRef = useRef(null)

  return (
    <div className="editor-root">
      {/* Top bar */}
      <header className="editor-topbar">
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
            <span className="track-name">{trackName}</span>
            <span className="track-artist">{artistName}</span>
          </div>
          {hasLyrics
            ? <span className="badge badge-success">Letras ✓</span>
            : <span className="badge badge-warning">Sin letras</span>
          }
        </div>
        <div className="editor-topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            className="btn-secondary"
            onClick={() => {
              if (confirm('¿Estás seguro de que deseas regresar al inicio? Esto descartará el proyecto actual.')) {
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
          >
            Exportar →
          </button>
        </div>
      </header>

      {/* Workspace */}
      <div className="editor-workspace">
        <Sidebar videoRef={videoRef} audioRef={audioRef} />
        <PreviewPanel videoRef={videoRef} audioRef={audioRef} />
      </div>

      {/* Timeline */}
      <Timeline videoRef={videoRef} audioRef={audioRef} />

      {/* Modals */}
      {exportModalOpen && <ExportModal videoRef={videoRef} audioRef={audioRef} />}
      {renderProgressOpen && <ExportProgressModal />}
      {successModalOpen && <SuccessModal />}
    </div>
  )
}
