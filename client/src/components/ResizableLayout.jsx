import { useState, useEffect, useRef } from 'react'

export default function ResizableLayout({ 
  topLeft, // Inspector
  topRight, // Preview
  bottomLeft, // Effects / Medios
  bottomRight // Timeline
}) {
  // Read initial sizes from localStorage or set defaults
  const [verticalSplit, setVerticalSplit] = useState(() => {
    const val = localStorage.getItem('lavalyrics_v_split')
    return val ? parseFloat(val) : 32 // % of width for left columns
  })
  
  const [topLeftHeight, setTopLeftHeight] = useState(() => {
    const val = localStorage.getItem('lavalyrics_tl_height')
    return val ? parseFloat(val) : 55 // % of height for top-left
  })

  const [topRightHeight, setTopRightHeight] = useState(() => {
    const val = localStorage.getItem('lavalyrics_tr_height')
    return val ? parseFloat(val) : 60 // % of height for top-right
  })

  const containerRef = useRef(null)
  const isDraggingRef = useRef(null) // 'vertical' | 'horizontal-left' | 'horizontal-right'

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDraggingRef.current || !containerRef.current) return
      
      const rect = containerRef.current.getBoundingClientRect()
      const clientX = e.clientX - rect.left
      const clientY = e.clientY - rect.top
      
      if (isDraggingRef.current === 'vertical') {
        const pct = Math.max(15, Math.min(85, (clientX / rect.width) * 100))
        setVerticalSplit(pct)
      } 
      else if (isDraggingRef.current === 'horizontal-left') {
        // Height of left columns is controlled by verticalSplit.
        // We calculate vertical percentage relative to container height.
        const pct = Math.max(10, Math.min(90, (clientY / rect.height) * 100))
        setTopLeftHeight(pct)
      } 
      else if (isDraggingRef.current === 'horizontal-right') {
        const pct = Math.max(10, Math.min(90, (clientY / rect.height) * 100))
        setTopRightHeight(pct)
      }
    }

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        localStorage.setItem('lavalyrics_v_split', verticalSplit.toString())
        localStorage.setItem('lavalyrics_tl_height', topLeftHeight.toString())
        localStorage.setItem('lavalyrics_tr_height', topRightHeight.toString())
        isDraggingRef.current = null
        document.body.style.cursor = 'default'
        document.body.style.userSelect = 'auto'
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [verticalSplit, topLeftHeight, topRightHeight])

  const startDrag = (type) => {
    isDraggingRef.current = type
    document.body.style.cursor = type === 'vertical' ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'
  }

  return (
    <div 
      className="resizable-container" 
      ref={containerRef}
      style={{
        display: 'flex',
        width: '100%',
        height: 'calc(100vh - 56px)', // Adjust for editor topbar
        position: 'relative',
        background: 'var(--bg-dark)',
        overflow: 'hidden'
      }}
    >
      {/* LEFT COLUMN */}
      <div 
        className="resizable-column-left" 
        style={{
          width: `${verticalSplit}%`,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}
      >
        {/* Top Left - Inspector */}
        <div style={{ height: `${topLeftHeight}%`, width: '100%', overflow: 'hidden' }}>
          {topLeft}
        </div>
        
        {/* Left Horizontal Splitter */}
        <div 
          className="splitter-horizontal" 
          onMouseDown={() => startDrag('horizontal-left')}
          style={{
            height: '4px',
            width: '100%',
            cursor: 'row-resize',
            background: 'var(--border-subtle)',
            zIndex: 10,
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--lava-orange)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--border-subtle)'}
        />
        
        {/* Bottom Left - Tabs (Effects / Medios) */}
        <div style={{ height: `${100 - topLeftHeight}%`, width: '100%', overflow: 'hidden' }}>
          {bottomLeft}
        </div>
      </div>

      {/* VERTICAL SPLITTER */}
      <div 
        className="splitter-vertical" 
        onMouseDown={() => startDrag('vertical')}
        style={{
          width: '4px',
          height: '100%',
          cursor: 'col-resize',
          background: 'var(--border-subtle)',
          zIndex: 10,
          transition: 'background 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--lava-orange)'}
        onMouseLeave={e => e.currentTarget.style.background = 'var(--border-subtle)'}
      />

      {/* RIGHT COLUMN */}
      <div 
        className="resizable-column-right" 
        style={{
          width: `${100 - verticalSplit}%`,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}
      >
        {/* Top Right - Preview */}
        <div style={{ height: `${topRightHeight}%`, width: '100%', overflow: 'hidden' }}>
          {topRight}
        </div>
        
        {/* Right Horizontal Splitter */}
        <div 
          className="splitter-horizontal" 
          onMouseDown={() => startDrag('horizontal-right')}
          style={{
            height: '4px',
            width: '100%',
            cursor: 'row-resize',
            background: 'var(--border-subtle)',
            zIndex: 10,
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--lava-orange)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--border-subtle)'}
        />
        
        {/* Bottom Right - Timeline */}
        <div style={{ height: `${100 - topRightHeight}%`, width: '100%', overflow: 'hidden' }}>
          {bottomRight}
        </div>
      </div>
    </div>
  )
}
