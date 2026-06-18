import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '../store/useAppStore'

const RING_R = 40
const RING_CIRC = 2 * Math.PI * RING_R

export default function ExportProgressModal() {
  const { renderPct, renderId, setRenderState, setSuccessModal } = useAppStore()
  const pollRef = useRef(null)
  const startTimeRef = useRef(null)

  useEffect(() => {
    if (renderId) {
      if (startTimeRef.current === null) {
        startTimeRef.current = Date.now()
      }
    } else {
      startTimeRef.current = null
    }
  }, [renderId])

  useEffect(() => {
    if (!renderId) return

    const poll = async () => {
      try {
        const res = await fetch(`/api/status/${renderId}`)
        const data = await res.json()

        if (data.status === 'completed') {
          clearTimeout(pollRef.current)
          setRenderState(false, 100, renderId)
          setSuccessModal(true, data.video_path || '')
          return
        }
        if (data.status === 'error') {
          clearTimeout(pollRef.current)
          setRenderState(false, 0, null)
          alert('Error en el renderizado: ' + (data.error || 'Desconocido'))
          return
        }
        // progress 0-100
        const pct = data.progress ?? renderPct
        setRenderState(true, pct, renderId)
        pollRef.current = setTimeout(poll, 1000)
      } catch {
        pollRef.current = setTimeout(poll, 2000)
      }
    }

    poll()
    return () => clearTimeout(pollRef.current)
  }, [renderId]) // eslint-disable-line

  const handleCancel = async () => {
    if (!renderId) return
    try {
      await fetch(`/api/render/cancel/${renderId}`, { method: 'POST' })
    } catch (err) {
      console.error('Cancel render failed:', err)
    }
    setRenderState(false, 0, null)
  }

  const pct = Math.min(100, Math.max(0, renderPct))
  const offset = RING_CIRC - (pct / 100) * RING_CIRC

  // Estimate remaining time
  let remainingTimeStr = 'Estimando tiempo restante...'
  if (pct > 2 && startTimeRef.current) {
    const elapsedSeconds = (Date.now() - startTimeRef.current) / 1000
    const remainingSeconds = (elapsedSeconds / (pct / 100)) - elapsedSeconds
    const rounded = Math.round(remainingSeconds / 30) * 30
    if (rounded < 30) {
      remainingTimeStr = 'FALTAN menos de un minuto'
    } else {
      const m = Math.floor(rounded / 60)
      const s = rounded % 60
      remainingTimeStr = `FALTAN ${m}:${s === 0 ? '00' : s} minutos`
    }
  }

  return (
    <div className="modal-overlay">
      <motion.div
        className="modal-box"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{ maxWidth: 400 }}
      >
        <div className="export-progress-modal-inner" style={{ textAlign: 'center' }}>
          {/* SVG ring */}
          <div className="export-progress-ring">
            <svg viewBox="0 0 100 100" width={100} height={100}>
              <defs>
                <linearGradient id="lavaGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#e63946" />
                  <stop offset="100%" stopColor="#ff6b35" />
                </linearGradient>
              </defs>
              <circle className="export-progress-ring-bg" cx="50" cy="50" r={RING_R} />
              <circle
                className="export-progress-ring-fill"
                cx="50" cy="50" r={RING_R}
                strokeDasharray={RING_CIRC}
                strokeDashoffset={offset}
              />
            </svg>
            <div className="export-progress-ring-text">
              <span className="text-gradient" style={{ fontWeight: 800 }}>{Math.round(pct)}%</span>
            </div>
          </div>

          <h2 style={{ marginBottom: '8px' }}>Renderizando video...</h2>
          <p>FFmpeg está procesando tu video. Esto puede tomar unos minutos.</p>
          
          <div style={{ marginTop: '12px', fontSize: '0.9rem', fontWeight: 600, color: 'var(--lava-orange)' }}>
            {remainingTimeStr}
          </div>

          <div className="progress-bar-track" style={{ marginTop: 'var(--space-lg)' }}>
            <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
          </div>

          <button
            className="btn-secondary"
            style={{ marginTop: '24px', width: '100%', borderColor: 'rgba(230,57,70,0.3)', color: '#ff6b35', fontWeight: 'bold' }}
            onClick={handleCancel}
          >
            Detener Renderizado 🛑
          </button>
        </div>
      </motion.div>
    </div>
  )
}
