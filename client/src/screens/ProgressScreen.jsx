import { motion } from 'framer-motion'
import { useAppStore } from '../store/useAppStore'
import '../styles/modals.css'

export default function ProgressScreen() {
  const { progressPct, progressStep, trackName, artistName } = useAppStore()

  return (
    <div className="progress-root">
      <div className="bg-mesh" />
      <motion.div
        className="progress-card"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <div className="lava-pulse">🎵</div>

        <h2>Procesando tu canción</h2>
        {(trackName || artistName) ? (
          <p style={{ marginBottom: 'var(--space-md)' }}>
            <strong style={{ color: 'var(--text-primary)' }}>{trackName}</strong>
            {artistName && <span style={{ color: 'var(--text-muted)' }}> — {artistName}</span>}
          </p>
        ) : (
          <p style={{ marginBottom: 'var(--space-md)' }}>Descargando audio y letras sincronizadas...</p>
        )}

        <div className="progress-percentage">{Math.round(progressPct)}%</div>

        <div className="progress-bar-track" style={{ marginBottom: '12px' }}>
          <div
            className="progress-bar-fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="progress-step-label">{progressStep || 'Iniciando...'}</div>
      </motion.div>
    </div>
  )
}
