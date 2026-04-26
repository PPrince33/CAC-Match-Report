'use client'

import { useRef, useEffect } from 'react'
import { drawPitchMarkings } from './PitchDrawing.js'
import { PITCH_CONFIG } from '../../lib/pitchConfig.js'

const OUTCOME_COLORS = {
  'Goal':        '#16a34a',
  'Assist':      '#0ea5e9',
  'Key Pass':    '#8b5cf6',
  'Successful':  '#22c55e',
  'Save':        '#f97316',
  'Off-Target':  '#ef4444',
  'Block':       '#f59e0b',
  'Foul':        '#dc2626',
  'Foul Won':    '#84cc16',
  'Unsuccessful':'#94a3b8',
}

function drawArrow(ctx, x1, y1, x2, y2, color, lineWidth = 1.5) {
  const headLen = Math.max(5, lineWidth * 3)
  const angle = Math.atan2(y2 - y1, x2 - x1)
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
}

function drawSymbol(ctx, x, y, action, outcome, size) {
  const color = OUTCOME_COLORS[outcome] || '#64748b'
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 1.5

  if (action === 'Shoot') {
    // Star / diamond for shots
    ctx.beginPath()
    ctx.moveTo(x, y - size)
    ctx.lineTo(x + size * 0.4, y - size * 0.4)
    ctx.lineTo(x + size, y)
    ctx.lineTo(x + size * 0.4, y + size * 0.4)
    ctx.lineTo(x, y + size)
    ctx.lineTo(x - size * 0.4, y + size * 0.4)
    ctx.lineTo(x - size, y)
    ctx.lineTo(x - size * 0.4, y - size * 0.4)
    ctx.closePath()
    ctx.globalAlpha = 0.85
    ctx.fill()
    ctx.globalAlpha = 1
  } else if (action === 'Block' || action === 'Clearance') {
    // Square
    ctx.beginPath()
    ctx.rect(x - size * 0.7, y - size * 0.7, size * 1.4, size * 1.4)
    ctx.globalAlpha = 0.75
    ctx.fill()
    ctx.globalAlpha = 1
  } else if (action === 'Standing Tackle' || action === 'Sliding Tackle') {
    // X mark
    ctx.beginPath()
    ctx.moveTo(x - size, y - size); ctx.lineTo(x + size, y + size)
    ctx.moveTo(x + size, y - size); ctx.lineTo(x - size, y + size)
    ctx.lineWidth = 2
    ctx.stroke()
  } else if (action === 'Pass Intercept') {
    // Triangle
    ctx.beginPath()
    ctx.moveTo(x, y - size)
    ctx.lineTo(x + size, y + size)
    ctx.lineTo(x - size, y + size)
    ctx.closePath()
    ctx.globalAlpha = 0.8
    ctx.fill()
    ctx.globalAlpha = 1
  } else if (action === 'Aerial Duel') {
    // Up-arrow dot
    ctx.beginPath()
    ctx.arc(x, y, size * 0.7, 0, Math.PI * 2)
    ctx.globalAlpha = 0.75
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, y + size * 0.4); ctx.lineTo(x, y - size * 0.4)
    ctx.moveTo(x - size * 0.3, y - size * 0.1); ctx.lineTo(x, y - size * 0.4); ctx.lineTo(x + size * 0.3, y - size * 0.1)
    ctx.stroke()
  } else {
    // Default circle
    ctx.beginPath()
    ctx.arc(x, y, size * 0.7, 0, Math.PI * 2)
    ctx.globalAlpha = 0.75
    ctx.fill()
    ctx.globalAlpha = 1
  }
}

export default function HeatmapPitch({ events, teamName, isHome, isFutsal = true, showEvents = false }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)

  const cfg = isFutsal ? PITCH_CONFIG.futsal : PITCH_CONFIG.football
  const pitchWidth = cfg.width
  const pitchHeight = cfg.height

  const drawPitch = (ctx, w, h) => {
    drawPitchMarkings(ctx, w, h, isFutsal, PITCH_CONFIG)

    const pad = 30
    const drawW = w - pad * 2
    const scaleX = (x) => pad + (x / pitchWidth) * drawW
    const scaleY = (y) => h - (pad + (y / pitchHeight) * (h - pad * 2))
    const symSize = Math.max(4, (3.5 / pitchWidth) * drawW)

    if (!showEvents) {
      // Heatmap mode
      const primaryRGB = isHome ? '0, 119, 182' : '217, 4, 41'
      ctx.globalCompositeOperation = 'multiply'
      events.forEach(s => {
        if (s.start_x == null || s.start_y == null) return
        const pX = scaleX(s.start_x)
        const pY = scaleY(s.start_y)
        const radius = (4 / pitchWidth) * drawW
        const grad = ctx.createRadialGradient(pX, pY, 0, pX, pY, radius)
        grad.addColorStop(0, `rgba(${primaryRGB}, 0.35)`)
        grad.addColorStop(1, `rgba(${primaryRGB}, 0)`)
        ctx.beginPath()
        ctx.arc(pX, pY, radius, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.fill()
      })
      ctx.globalCompositeOperation = 'source-over'
    } else {
      // Symbols / arrows mode
      events.forEach(e => {
        if (e.start_x == null || e.start_y == null) return
        const sx = scaleX(e.start_x)
        const sy = scaleY(e.start_y)
        const hasEnd = e.end_x != null && e.end_y != null
        if (hasEnd && (e.action === 'Pass' || e.action === 'Through Ball' || e.action === 'Dribble' || e.action === 'Carry')) {
          const ex = scaleX(e.end_x)
          const ey = scaleY(e.end_y)
          const color = OUTCOME_COLORS[e.outcome] || '#64748b'
          drawArrow(ctx, sx, sy, ex, ey, color, 1.2)
        } else {
          drawSymbol(ctx, sx, sy, e.action, e.outcome, symSize)
        }
      })
    }
  }

  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current || !containerRef.current) return
      const canvas = canvasRef.current
      const container = containerRef.current
      canvas.width = container.clientWidth
      canvas.height = container.clientWidth * (cfg.aspectRatio + 0.05)
      const ctx = canvas.getContext('2d')
      drawPitch(ctx, canvas.width, canvas.height)
    }
    window.addEventListener('resize', handleResize)
    handleResize()
    return () => window.removeEventListener('resize', handleResize)
  }, [events, isFutsal])

  return (
    <div ref={containerRef} className="flex-1 min-w-[300px] border-4 border-black bg-white relative">
      <div className={`absolute top-2 left-2 ${isHome ? 'bg-[#0077B6]' : 'bg-[#D90429]'} text-white border-2 border-black px-2 py-1 text-[10px] font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] z-10`}>
        {teamName}
      </div>
      <canvas ref={canvasRef} className="w-full block" />
      <div className="border-t-2 border-black px-3 py-1.5 bg-[#f1f5f9] text-[9px] font-black uppercase tracking-widest text-gray-500 flex items-center justify-center gap-2">
        <span>Attack Direction →</span>
      </div>
    </div>
  )
}
