import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../store/useAppStore'

export default function MissingMediaModal({ isOpen, onClose, missingPath, videoRef }) {
  const { setBgVideo, setBgVideoBlobUrl, updateTrack, addToast } = useAppStore()
  const [uploadStatus, setUploadStatus] = useState('')
  const fileInputRef = useRef(null)

  if (!isOpen) return null

  const handleFileUpload = async (file) => {
    if (!file) return
    setUploadStatus('Midiendo duración del video...')
    try {
      const fileURL = URL.createObjectURL(file)
      const el = document.createElement('video')
      el.src = fileURL
      await new Promise((resolve) => {
        el.onloadedmetadata = () => resolve(true)
        el.onerror = () => resolve(false)
      })
      const duration = el.duration || 0

      if (videoRef && videoRef.current) {
        videoRef.current.src = fileURL
        videoRef.current.load()
      }
      setBgVideoBlobUrl(fileURL)
      setBgVideo(null, duration)

      setUploadStatus('Reemplazando en el servidor...')
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/upload_bg', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Error al subir archivo')
      const data = await res.json()

      setBgVideo(data.file_path, duration)
      setUploadStatus('Completado ✓')
      addToast('Video de fondo reconectado con éxito', 'success')
      onClose()
    } catch (err) {
      console.error(err)
      setUploadStatus('Error al reconectar el video')
      addToast('Error al procesar el nuevo video', 'error', 'ERR_REPLACE_FAILED')
    }
  }

  const handleRemoveVideo = () => {
    if (confirm('¿Estás seguro de que deseas eliminar el video de fondo y todos sus bloques de la línea de tiempo?')) {
      updateTrack('video', [])
      setBgVideo(null, 0)
      setBgVideoBlobUrl(null)
      if (videoRef && videoRef.current) {
        videoRef.current.src = ''
        videoRef.current.load()
      }
      addToast('Video de fondo eliminado de la línea de tiempo', 'info')
      onClose()
    }
  }

  return (
    <div 
      className="modal-overlay" 
      style={{ 
        position: 'fixed', 
        inset: 0, 
        background: 'rgba(0,0,0,0.85)', 
        zIndex: 9999, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backdropFilter: 'blur(6px)'
      }}
    >
      <motion.div
        className="modal-box"
        initial={{ opacity: 0, scale: 0.93, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.93, y: 15 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        style={{ 
          maxWidth: 520, 
          width: '90%', 
          background: 'var(--bg-elevated)', 
          borderRadius: 'var(--radius-lg)', 
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)',
          padding: '24px',
          color: 'var(--text-primary)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <span style={{ fontSize: '1.8rem' }}>⚠️</span>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--lava-orange)' }}>
            Video de Fondo no Encontrado
          </h2>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '14px' }}>
          El proyecto original guarda una referencia al video de fondo en la siguiente ubicación, pero no existe en esta computadora:
        </p>

        <div style={{ 
          background: 'rgba(0,0,0,0.25)', 
          border: '1px solid var(--border-subtle)', 
          borderRadius: 'var(--radius-sm)', 
          padding: '10px 12px', 
          fontSize: '0.78rem', 
          fontFamily: 'monospace', 
          wordBreak: 'break-all', 
          color: 'var(--text-muted)',
          marginBottom: '20px'
        }}>
          {missingPath}
        </div>

        {uploadStatus && (
          <div style={{ 
            fontSize: '0.8rem', 
            color: 'var(--lava-orange)', 
            fontWeight: 600, 
            textAlign: 'center', 
            marginBottom: '16px',
            background: 'rgba(230,90,53,0.08)',
            padding: '8px',
            borderRadius: '4px'
          }}>
            {uploadStatus}
          </div>
        )}

        <input 
          type="file" 
          ref={fileInputRef} 
          accept="video/*" 
          onChange={e => handleFileUpload(e.target.files[0])} 
          style={{ display: 'none' }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button 
            className="btn-primary" 
            style={{ width: '100%', padding: '12px', fontSize: '0.88rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            onClick={() => fileInputRef.current.click()}
          >
            🔍 Localizar y Reemplazar Video
          </button>
          
          <button 
            className="btn-secondary" 
            style={{ width: '100%', padding: '10px', fontSize: '0.85rem', border: '1px solid rgba(230,57,70,0.4)', color: 'var(--lava-red)' }}
            onClick={handleRemoveVideo}
          >
            🗑️ Eliminar video del timeline
          </button>

          <button 
            className="btn-ghost" 
            style={{ width: '100%', padding: '10px', fontSize: '0.82rem', color: 'var(--text-muted)' }}
            onClick={onClose}
          >
            Ignorar por ahora
          </button>
        </div>
      </motion.div>
    </div>
  )
}
