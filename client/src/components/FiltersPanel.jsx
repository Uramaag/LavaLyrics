import { useCallback } from 'react'
import Slider from 'rc-slider'
import 'rc-slider/assets/index.css'
import { useAppStore } from '../store/useAppStore'

const PRESETS = [
  {
    name: 'Original', filters: { brightness: 1, contrast: 1, saturation: 1, hue: 0 }
  },
  {
    name: 'Vibrante', filters: { brightness: 1.05, contrast: 1.1, saturation: 1.6, hue: 0 }
  },
  {
    name: 'Cine Frío', filters: { brightness: 0.95, contrast: 1.15, saturation: 0.8, hue: 200 }
  },
  {
    name: 'Golden Hour', filters: { brightness: 1.05, contrast: 1.05, saturation: 1.3, hue: 30 }
  },
  {
    name: 'Noir', filters: { brightness: 0.9, contrast: 1.3, saturation: 0, hue: 0 }
  },
  {
    name: 'Dreamy', filters: { brightness: 1.1, contrast: 0.9, saturation: 1.4, hue: 280 }
  },
  {
    name: 'Matrix', filters: { brightness: 0.95, contrast: 1.2, saturation: 0.3, hue: 120 }
  },
  {
    name: 'Fuego', filters: { brightness: 1.05, contrast: 1.1, saturation: 1.2, hue: -20 }
  },
]

const SLIDER_STYLE = {
  rail: { background: 'var(--bg-elevated)', height: 4 },
  track: { background: 'linear-gradient(90deg, #e63946, #ff6b35)', height: 4 },
  handle: {
    borderColor: 'var(--lava-red)',
    background: '#fff',
    width: 14, height: 14, marginTop: -5,
    boxShadow: '0 0 6px rgba(230,57,70,0.5)',
    opacity: 1,
  },
}

const DEFAULT_FILTERS = { brightness: 1, contrast: 1, saturation: 1, hue: 0 }

export default function FiltersPanel({ clipId, videoRef, draggableOnly = false }) {
  const { getClipFilters, setClipFilter, setClipFilters, resetClipFilters } = useAppStore()
  const filters = clipId ? getClipFilters(clipId) : DEFAULT_FILTERS

  const applyToPreview = useCallback((f) => {
    if (videoRef?.current) {
      videoRef.current.style.filter =
        `brightness(${f.brightness}) contrast(${f.contrast}) saturate(${f.saturation}) hue-rotate(${f.hue}deg)`
    }
  }, [videoRef])

  const handleChange = useCallback((key, value) => {
    if (!clipId) return
    setClipFilter(clipId, key, value)
    const current = { ...filters, [key]: value }
    applyToPreview(current)
  }, [clipId, filters, setClipFilter, applyToPreview])

  const applyPreset = useCallback((preset) => {
    if (!clipId) return
    setClipFilters(clipId, preset.filters)
    applyToPreview(preset.filters)
  }, [clipId, setClipFilters, applyToPreview])

  const handleReset = () => {
    if (!clipId) return
    resetClipFilters(clipId)
    applyToPreview({ brightness: 1, contrast: 1, saturation: 1, hue: 0 })
  }

  return (
    <div className="sidebar-section">
      {!draggableOnly && (
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
          <div className="sidebar-section-title" style={{ margin: 0 }}>Filtros de Video</div>
          <button
            className="btn-ghost"
            style={{ marginLeft: 'auto', fontSize: '0.72rem', padding: '4px 8px' }}
            onClick={handleReset}
          >
            Resetear
          </button>
        </div>
      )}

      {draggableOnly && (
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>
          🎨 Presets de Filtro
        </div>
      )}

      {/* Presets */}
      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '6px', textAlign: 'center' }}>
        ↕ Arrastra un preset a la línea de tiempo como capa de ajuste
      </div>
      <div className="preset-grid" style={{ marginBottom: 'var(--space-md)' }}>
        {PRESETS.map(p => {
          const isActive = !draggableOnly &&
            Math.abs(filters.brightness - p.filters.brightness) < 0.01 &&
            Math.abs(filters.contrast - p.filters.contrast) < 0.01 &&
            Math.abs(filters.saturation - p.filters.saturation) < 0.01 &&
            Math.abs(filters.hue - p.filters.hue) < 1
          return (
            <button
              key={p.name}
              className={`preset-btn${isActive ? ' active' : ''}`}
              draggable={true}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'copy'
                e.dataTransfer.setData('application/lava-filter-preset', JSON.stringify({
                  presetName: p.name,
                  filters: p.filters,
                }))
              }}
              onClick={() => applyPreset(p)}
              title={`Click: aplicar al clip | Arrastra: crear capa de ajuste en la línea de tiempo`}
            >
              {p.name}
            </button>
          )
        })}
      </div>

      {!draggableOnly && (
        <>
          <div className="separator" />
          {/* Sliders */}
          {[
            { key: 'brightness', label: 'Brillo', min: 0.5, max: 2, step: 0.01 },
            { key: 'contrast',   label: 'Contraste', min: 0.5, max: 2, step: 0.01 },
            { key: 'saturation', label: 'Saturación', min: 0, max: 3, step: 0.01 },
            { key: 'hue',        label: 'Matiz', min: -180, max: 180, step: 1 },
          ].map(({ key, label, min, max, step }) => (
            <div className="filter-slider-group" key={key}>
              <div className="filter-slider-label">
                <span>{label}</span>
                <span>{key === 'hue' ? `${filters[key]}°` : filters[key].toFixed(2)}</span>
              </div>
              <Slider
                min={min}
                max={max}
                step={step}
                value={filters[key]}
                onChange={(v) => handleChange(key, v)}
                styles={SLIDER_STYLE}
              />
            </div>
          ))}
        </>
      )}
    </div>
  )
}
