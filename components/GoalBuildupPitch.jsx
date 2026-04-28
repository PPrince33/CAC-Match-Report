'use client'

import { useRef, useEffect, useState } from 'react'
import { drawPitchMarkings } from './pitch/PitchDrawing.js'
import { PITCH_CONFIG } from '../lib/pitchConfig.js'

const ACTION_COLORS = {
  'Pass':            '#3b82f6',
  'Through Ball':    '#8b5cf6',
  'Carry':           '#06b6d4',
  'Dribble':         '#0ea5e9',
  'Shoot':           '#ef4444',
  'Cross':           '#f59e0b',
  'Pass Intercept':  '#84cc16',
  'Standing Tackle': '#84cc16',
  'Sliding Tackle':  '#84cc16',
  'Block':           '#eab308',
  'Save':            '#f97316',
  'Clearance':       '#10b981',
  'Pressure':        '#fb923c',
  'Ball Control':    '#94a3b8',
  'Aerial Duel':     '#a855f7',
  'Discipline':      '#dc2626',
}

const colorOf = (e) => ACTION_COLORS[e.action] || '#64748b'

function drawArrow(ctx, x1, y1, x2, y2, color, lineWidth = 1.5, alpha = 0.9) {
  const headLen = Math.max(6, lineWidth * 3)
  const angle = Math.atan2(y2 - y1, x2 - x1)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = lineWidth
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6))
  ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6))
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

/**
 * GoalBuildupPitch — visualize the N events leading up to a goal.
 * The events array is the chronologically-ordered buildup; the LAST event
 * is the goal itself.
 */
export default function GoalBuildupPitch({ events = [], isFutsal = false, isHome = true }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const sizeRef = useRef({ w: 700, h: 469 })
  const [, setTick] = useState(0)
  const [hover, setHover] = useState(null)  // index into events

  const cfg = isFutsal ? PITCH_CONFIG.futsal : PITCH_CONFIG.football
  const aspect = isFutsal ? 0.55 : 0.67

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const ro = new ResizeObserver(() => setTick(t => t + 1))
    ro.observe(container)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const ctx = canvas.getContext('2d')

    const dpr = window.devicePixelRatio || 1
    const cssW = Math.max(320, container.clientWidth)
    const cssH = Math.round(cssW * aspect)
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    canvas.style.width = cssW + 'px'
    canvas.style.height = cssH + 'px'
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.imageSmoothingEnabled = true
    sizeRef.current = { w: cssW, h: cssH }

    const w = cssW, h = cssH
    drawPitchMarkings(ctx, w, h, isFutsal, PITCH_CONFIG)

    const pad = 30
    const drawW = w - pad * 2
    const drawH = h - pad * 2
    const scaleX = (x) => pad + (x / cfg.width) * drawW
    const scaleY = (y) => h - (pad + (y / cfg.height) * drawH)

    // Connector lines between consecutive events (faded)
    for (let i = 0; i < events.length - 1; i++) {
      const a = events[i], b = events[i + 1]
      if (a.start_x == null || a.start_y == null || b.start_x == null || b.start_y == null) continue
      ctx.save()
      ctx.strokeStyle = '#94a3b8'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.globalAlpha = 0.5
      ctx.beginPath()
      ctx.moveTo(scaleX(a.start_x), scaleY(a.start_y))
      ctx.lineTo(scaleX(b.start_x), scaleY(b.start_y))
      ctx.stroke()
      ctx.restore()
    }

    events.forEach((e, i) => {
      if (e.start_x == null || e.start_y == null) return
      const sX = scaleX(e.start_x), sY = scaleY(e.start_y)
      const isGoal = i === events.length - 1
      const isHovered = hover === i
      const color = colorOf(e)

      // Arrow from start → end where applicable
      const hasEnd = e.end_x != null && e.end_y != null && (
        e.action === 'Pass' || e.action === 'Through Ball' ||
        e.action === 'Carry' || e.action === 'Dribble' || e.action === 'Shoot'
      )
      if (hasEnd) {
        drawArrow(ctx, sX, sY, scaleX(e.end_x), scaleY(e.end_y), color, isHovered ? 2.5 : 1.4, isHovered ? 0.95 : 0.65)
      }

      // Numbered start marker
      const r = isGoal ? 14 : (isHovered ? 12 : 10)
      ctx.beginPath()
      ctx.arc(sX, sY, r, 0, Math.PI * 2)
      ctx.fillStyle = isGoal ? '#FFD166' : '#fff'
      ctx.fill()
      ctx.strokeStyle = isGoal ? '#000' : color
      ctx.lineWidth = isGoal ? 3 : (isHovered ? 3 : 2)
      ctx.stroke()

      ctx.fillStyle = isGoal ? '#000' : color
      ctx.font = `bold ${isGoal ? 11 : 10}px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(isGoal ? '⚽' : String(i + 1), sX, sY)
    })
  }, [events, isFutsal, cfg, hover])

  const handleMouseMove = (ev) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const cx = ev.clientX - rect.left
    const cy = ev.clientY - rect.top
    const { w, h } = sizeRef.current
    const pad = 30
    const drawW = w - pad * 2
    const drawH = h - pad * 2
    const scaleX = (x) => pad + (x / cfg.width) * drawW
    const scaleY = (y) => h - (pad + (y / cfg.height) * drawH)
    let best = null, bestDist = Infinity
    events.forEach((e, i) => {
      if (e.start_x == null) return
      const dx = scaleX(e.start_x) - cx
      const dy = scaleY(e.start_y) - cy
      const d = Math.hypot(dx, dy)
      if (d < 18 && d < bestDist) { bestDist = d; best = i }
    })
    setHover(best)
  }

  const hovered = hover != null ? events[hover] : null

  return (
    <div className="relative" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="block border-4 border-black"
        style={{ cursor: hovered ? 'pointer' : 'default' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
      />
      {hovered && (
        <div className="absolute top-2 right-2 bg-black text-white border-2 border-[#FFD166] px-3 py-2 text-[10px] font-black uppercase shadow-[3px_3px_0px_0px_#FFD166] pointer-events-none">
          <div className="text-[#FFD166] mb-0.5">
            {hover === events.length - 1 ? '⚽ GOAL' : `Action ${hover + 1}`} ·{' '}
            {(hovered.match_minute ?? Math.floor((hovered.match_time_seconds || 0) / 60))}'
          </div>
          <div>{hovered.action}{hovered.outcome ? ` · ${hovered.outcome}` : ''}</div>
        </div>
      )}
    </div>
  )
}
