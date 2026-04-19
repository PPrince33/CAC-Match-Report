'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { drawPitchMarkings } from './PitchDrawing.js'
import { PITCH_CONFIG } from '../../lib/pitchConfig.js'

const PAD = 30
const DOT_RADIUS = 5

// Action → shape hint  (circle | square | triangle | diamond)
const ACTION_SHAPE = {
  'Shoot':            'circle',
  'Pass':             'circle',
  'Through Ball':     'circle',
  'Carry':            'circle',
  'Dribble':          'circle',
  'Standing Tackle':  'diamond',
  'Sliding Tackle':   'diamond',
  'Pass Intercept':   'diamond',
  'Block':            'square',
  'Clearance':        'square',
  'Save':             'square',
  'Pressure':         'circle',
}

function drawShape(ctx, shape, cx, cy, r, filled, strokeColor, fillColor) {
  ctx.beginPath()
  if (shape === 'diamond') {
    ctx.moveTo(cx,     cy - r)
    ctx.lineTo(cx + r, cy)
    ctx.lineTo(cx,     cy + r)
    ctx.lineTo(cx - r, cy)
    ctx.closePath()
  } else if (shape === 'square') {
    ctx.rect(cx - r, cy - r, r * 2, r * 2)
  } else {
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
  }
  if (filled) { ctx.fillStyle = fillColor; ctx.fill() }
  ctx.strokeStyle = strokeColor
  ctx.lineWidth = 1.5
  ctx.stroke()
}

export default function HighlightsPitch({
  events,          // hlFilteredEvents
  lineups,
  isFutsal,
  homeTeamId,
  onEventClick,    // (timeSecs) => void  — jump video to event
  onBrushChange,   // ({x1,y1,x2,y2} | null) => void  — pitch-coord bounds
}) {
  const canvasRef    = useRef(null)
  const containerRef = useRef(null)

  // tooltip state
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, event: null, transform: '' })

  // brush in canvas-pixel space
  const [brush, setBrush]         = useState(null)   // {sx,sy,ex,ey}
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef(null)

  const cfg = isFutsal ? PITCH_CONFIG.futsal : PITCH_CONFIG.football

  // ── coordinate helpers ─────────────────────────────────────────────────────
  const toCanvas = useCallback((pitchX, pitchY, w, h) => ({
    x: PAD + (pitchX / cfg.width)  * (w - PAD * 2),
    y: h - (PAD + (pitchY / cfg.height) * (h - PAD * 2)),
  }), [cfg])

  const toPitch = useCallback((cx, cy, w, h) => ({
    x: ((cx - PAD) / (w - PAD * 2)) * cfg.width,
    y: ((h - PAD - cy) / (h - PAD * 2)) * cfg.height,
  }), [cfg])

  // ── draw everything ────────────────────────────────────────────────────────
  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const w = canvas.width
    const h = canvas.height

    drawPitchMarkings(ctx, w, h, isFutsal, PITCH_CONFIG)

    // Determine which events are inside brush (pitch coords)
    let brushPitch = null
    if (brush) {
      const p1 = toPitch(Math.min(brush.sx, brush.ex), Math.min(brush.sy, brush.ey), w, h)
      const p2 = toPitch(Math.max(brush.sx, brush.ex), Math.max(brush.sy, brush.ey), w, h)
      brushPitch = { x1: p1.x, y1: p2.y, x2: p2.x, y2: p1.y }
      // p1 is top-left in canvas → smaller y → larger pitchY (Y axis flipped)
    }

    // draw dots
    events.forEach(e => {
      if (e.start_x == null || e.start_y == null) return
      const { x: cx, y: cy } = toCanvas(e.start_x, e.start_y, w, h)
      const isHome   = e.team_id === homeTeamId
      const color    = isHome ? '#0077B6' : '#D90429'
      const shape    = ACTION_SHAPE[e.action] || 'circle'
      const isGoal   = e.outcome === 'Goal'
      const isSucc   = ['Successful', 'Goal', 'Save', 'Assist', 'Key Pass'].includes(e.outcome)

      // dim if brush active and outside brush
      let alpha = 1
      if (brushPitch) {
        const inside =
          e.start_x >= brushPitch.x1 && e.start_x <= brushPitch.x2 &&
          e.start_y >= brushPitch.y1 && e.start_y <= brushPitch.y2
        alpha = inside ? 1 : 0.15
      }

      ctx.globalAlpha = alpha
      drawShape(
        ctx, shape, cx, cy,
        isGoal ? DOT_RADIUS + 3 : DOT_RADIUS,
        isSucc,
        color,
        color + 'aa',
      )
      ctx.globalAlpha = 1
    })

    // draw brush rectangle
    if (brush) {
      const x1 = Math.min(brush.sx, brush.ex)
      const y1 = Math.min(brush.sy, brush.ey)
      const bw = Math.abs(brush.ex - brush.sx)
      const bh = Math.abs(brush.ey - brush.sy)
      ctx.fillStyle = 'rgba(255,209,102,0.18)'
      ctx.fillRect(x1, y1, bw, bh)
      ctx.strokeStyle = '#FFD166'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 4])
      ctx.strokeRect(x1, y1, bw, bh)
      ctx.setLineDash([])
    }
  }, [events, brush, isFutsal, homeTeamId, toCanvas, toPitch])

  // ── resize observer ────────────────────────────────────────────────────────
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current
      const container = containerRef.current
      if (!canvas || !container) return
      canvas.width  = container.clientWidth
      canvas.height = container.clientWidth * (cfg.aspectRatio + 0.05)
      render()
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [render, cfg])

  useEffect(() => { render() }, [render])

  // ── mouse helpers ──────────────────────────────────────────────────────────
  const getCanvasXY = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width  / rect.width
    const scaleY = canvas.height / rect.height
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top)  * scaleY,
      cssX: clientX - rect.left,
      cssY: clientY - rect.top,
    }
  }

  const findEventAtPoint = (cx, cy) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const w = canvas.width, h = canvas.height
    let found = null
    for (const e of events) {
      if (e.start_x == null || e.start_y == null) continue
      const { x, y } = toCanvas(e.start_x, e.start_y, w, h)
      const isGoal = e.outcome === 'Goal'
      const r = (isGoal ? DOT_RADIUS + 3 : DOT_RADIUS) + 3
      if (Math.hypot(cx - x, cy - y) <= r) { found = e; break }
    }
    return found
  }

  // ── pointer events ─────────────────────────────────────────────────────────
  const handleMouseDown = (e) => {
    const { x, y } = getCanvasXY(e)
    dragRef.current = { sx: x, sy: y }
    setIsDragging(true)
    setBrush(null)
    onBrushChange(null)
  }

  const handleMouseMove = (e) => {
    const { x, y, cssX, cssY } = getCanvasXY(e)
    const canvas = canvasRef.current
    const rect   = canvasRef.current?.getBoundingClientRect()

    if (isDragging && dragRef.current) {
      const dx = x - dragRef.current.sx
      const dy = y - dragRef.current.sy
      if (Math.hypot(dx, dy) > 4) {
        setBrush({ sx: dragRef.current.sx, sy: dragRef.current.sy, ex: x, ey: y })
      }
      return
    }

    // hover tooltip
    const hit = findEventAtPoint(x, y)
    if (hit) {
      let tx = cssX, ty = cssY - 15
      let transform = '-translate-x-1/2 -translate-y-full'
      if (!rect) return
      if (cssY < 120)           { ty = cssY + 20; transform = '-translate-x-1/2' }
      if (cssX < 120)           transform = transform.replace('-translate-x-1/2', 'translate-x-0')
      else if (cssX > rect.width - 120) transform = transform.replace('-translate-x-1/2', '-translate-x-full')
      setTooltip({ visible: true, x: tx, y: ty, transform, event: hit })
    } else {
      setTooltip(t => t.visible ? { ...t, visible: false } : t)
    }
  }

  const handleMouseUp = (e) => {
    if (!isDragging) return
    setIsDragging(false)

    if (!brush) {
      // plain click — check for event hit
      const { x, y } = getCanvasXY(e)
      const hit = findEventAtPoint(x, y)
      if (hit) onEventClick?.(hit.match_time_seconds)
      return
    }

    // commit brush → convert to pitch coords and notify parent
    const canvas = canvasRef.current
    if (!canvas) return
    const w = canvas.width, h = canvas.height
    const p1 = toPitch(Math.min(brush.sx, brush.ex), Math.min(brush.sy, brush.ey), w, h)
    const p2 = toPitch(Math.max(brush.sx, brush.ex), Math.max(brush.sy, brush.ey), w, h)
    onBrushChange({ x1: p1.x, y1: p2.y, x2: p2.x, y2: p1.y })
  }

  const clearBrush = () => {
    setBrush(null)
    onBrushChange(null)
  }

  const getPlayerName = (pid) => {
    const l = lineups.find(x => x.player_id === pid)
    return l?.players?.player_name || 'Unknown'
  }

  const eventsInBrush = brush
    ? (() => {
        const canvas = canvasRef.current
        if (!canvas) return 0
        const w = canvas.width, h = canvas.height
        const p1 = toPitch(Math.min(brush.sx, brush.ex), Math.min(brush.sy, brush.ey), w, h)
        const p2 = toPitch(Math.max(brush.sx, brush.ex), Math.max(brush.sy, brush.ey), w, h)
        const bnd = { x1: p1.x, y1: p2.y, x2: p2.x, y2: p1.y }
        return events.filter(e =>
          e.start_x != null && e.start_y != null &&
          e.start_x >= bnd.x1 && e.start_x <= bnd.x2 &&
          e.start_y >= bnd.y1 && e.start_y <= bnd.y2
        ).length
      })()
    : null

  return (
    <div className="border-4 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      {/* header bar */}
      <div className="flex items-center justify-between border-b-4 border-black px-3 py-2 bg-[#f1f5f9]">
        <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
          <span className="w-2 h-2 bg-black rounded-full inline-block" />
          Pitch Map — {events.filter(e => e.start_x != null).length} events
          {eventsInBrush !== null && (
            <span className="ml-2 bg-[#FFD166] border border-black px-1 text-[9px]">
              {eventsInBrush} in selection
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-gray-500 font-bold uppercase">
            {brush ? 'Drag to resize · Click to clear' : 'Drag to select region'}
          </span>
          {brush && (
            <button
              onClick={clearBrush}
              className="text-[9px] font-black uppercase border-2 border-black px-2 py-0.5 bg-white hover:bg-[#D90429] hover:text-white transition-all shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* legend */}
      <div className="flex items-center gap-4 px-3 py-1.5 border-b-2 border-black bg-white text-[9px] font-bold uppercase">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#0077B6] inline-block border border-black" /> Home</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#D90429] inline-block border border-black" /> Away</span>
        <span className="ml-auto flex items-center gap-3 text-gray-500">
          <span>● Shoot / Pass / Carry</span>
          <span>◆ Tackle / Intercept</span>
          <span>■ Block / Clear / Save</span>
          <span className="text-gray-700">Filled = success · Outline = fail</span>
        </span>
      </div>

      {/* canvas */}
      <div ref={containerRef} className="relative select-none" style={{ cursor: isDragging ? 'crosshair' : 'crosshair' }}>
        <canvas
          ref={canvasRef}
          className="w-full block"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            setIsDragging(false)
            setTooltip(t => ({ ...t, visible: false }))
          }}
        />

        {/* tooltip */}
        {tooltip.visible && tooltip.event && (
          <div
            className={`absolute z-50 bg-[#FFD166] border-2 border-black p-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] pointer-events-none min-w-[160px] transform ${tooltip.transform}`}
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <div className="text-[10px] font-black uppercase border-b-2 border-black pb-1 mb-1.5 flex items-center gap-1">
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ background: tooltip.event.team_id === homeTeamId ? '#0077B6' : '#D90429' }}
              />
              #{lineups.find(l => l.player_id === tooltip.event.player_id)?.jersey_no || '-'}{' '}
              {getPlayerName(tooltip.event.player_id)}
            </div>
            <div className="space-y-0.5 text-[9px] font-bold leading-tight">
              <p>{Math.floor((tooltip.event.match_time_seconds || 0) / 60)}'{' '}
                <span className="text-gray-600">{tooltip.event.action}</span>
              </p>
              <p><span className="text-gray-600">Outcome: </span>{tooltip.event.outcome}</p>
              {tooltip.event.type && tooltip.event.type !== 'NA' && (
                <p><span className="text-gray-600">Type: </span>{tooltip.event.type}</p>
              )}
              {tooltip.event.action === 'Shoot' && (
                <p><span className="text-gray-600">xG: </span>{parseFloat(tooltip.event.xg || 0).toFixed(2)}</p>
              )}
              <p className="text-gray-400 mt-1">Click to jump video</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
