import { motion } from 'framer-motion'
import { useAppStore } from '../store/useAppStore'

export default function SuccessModal() {
  const { renderId, resetToIntro, setSuccessModal } = useAppStore()

  const handleOpenFolder = async () => {
    try {
      await fetch('/api/open_folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ render_id: renderId }),
      })
    } catch (e) {
      console.error('Error al abrir carpeta:', e)
    }
  }

  const handleDownload = () => {
    if (renderId) window.open(`/api/download/${renderId}`, '_blank')
  }

  return (
    <div className="modal-overlay">
      <motion.div
        className="modal-box"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
        style={{ maxWidth: 420 }}
      >
        <div className="success-modal-inner">
          <div className="success-icon">🎉</div>
          <div className="success-title">¡Listo!</div>
          <p>Tu video fue exportado con éxito. Puedes abrirlo o empezar uno nuevo.</p>

          <div className="success-actions">
            <button
              id="btn-open-folder"
              className="btn-primary"
              onClick={handleOpenFolder}
            >
              📂 Abrir carpeta
            </button>
            <button
              id="btn-download-video"
              className="btn-secondary"
              onClick={handleDownload}
            >
              ⬇️ Descargar
            </button>
          </div>

          <div className="separator" style={{ marginTop: 'var(--space-xl)' }} />

          <button
            id="btn-start-over"
            className="btn-ghost"
            style={{ marginTop: 'var(--space-md)', width: '100%' }}
            onClick={resetToIntro}
          >
            ↺ Empezar de nuevo
          </button>
        </div>
      </motion.div>
    </div>
  )
}
