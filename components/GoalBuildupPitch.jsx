'use client'

import { useRef, useEffect, useState } from 'react'
import { drawPitchMarkings } from './pitch/PitchDrawing.js'
import { PITCH_CONFIG } from '../lib/pitchConfig.js'

const ACTION_COLORS = {
  'Pass':            '#0B0D0B',
  'Through Ball':    '#23801A',
  'Carry':           '#9AA397',
  'Dribble':         '#5B6359',
  'Shoot':           '#6BDB58',
  'Cross':           '#9BE58C',
  'Pass Intercept':  '#CBD1C8',
  'Standing Tackle': '#CBD1C8',
  'Sliding Tackle':  '#CBD1C8',
  'Block':           '#CBD1C8',
  'Save':            '#CBD1C8',
  'Clearance':       '#CBD1C8',
  'Pressure':        '#CBD1C8',
  'Ball Control':    '#CBD1C8',
  'Aerial Duel':     '#CBD1C8',
  'Discipline':      '#5B6359',
}

const colorOf = (e) => ACTION_COLORS[e.action] || '#5B6359'

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
export default function GoalBuildupPitch({ events = [], lineups = [], isFutsal = false, isHome = true, homeTeamId = null }) {
  const playerById = (() => {
    const m = {}
    lineups.forEach(l => { m[l.player_id] = l })
    return m
  })()
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
      ctx.strokeStyle = '#9AA397'
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
      // Team ring color: home → blue, away → red
      const teamColor = homeTeamId == null ? null : (e.team_id === homeTeamId ? '#0077B6' : '#D90429')

      // Arrow from start → end where applicable
      const hasEnd = e.end_x != null && e.end_y != null && (
        e.action === 'Pass' || e.action === 'Through Ball' ||
        e.action === 'Carry' || e.action === 'Dribble' || e.action === 'Shoot'
      )
      if (hasEnd) {
        drawArrow(ctx, sX, sY, scaleX(e.end_x), scaleY(e.end_y), color, isHovered ? 2.5 : 1.4, isHovered ? 0.95 : 0.65)
      }

      // Outer team ring
      const r = isGoal ? 14 : (isHovered ? 12 : 10)
      if (teamColor && !isGoal) {
        ctx.beginPath()
        ctx.arc(sX, sY, r + 3, 0, Math.PI * 2)
        ctx.strokeStyle = teamColor
        ctx.lineWidth = 2
        ctx.stroke()
      }

      // Numbered start marker
      ctx.beginPath()
      ctx.arc(sX, sY, r, 0, Math.PI * 2)
      ctx.fillStyle = isGoal ? '#6BDB58' : '#fff'
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
        className="block border-4 border-line"
        style={{ cursor: hovered ? 'pointer' : 'default' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
      />
      {hovered && (() => {
        const lu = playerById[hovered.player_id]
        const playerLabel = lu ? `#${lu.jersey_no} ${lu.players?.player_name || ''}`.trim() : (hovered.player_id ? '?' : '')
        const minuteVal = hovered.match_minute ?? Math.floor((hovered.match_time_seconds || 0) / 60)
        const teamColor = homeTeamId == null ? null : (hovered.team_id === homeTeamId ? '#0077B6' : '#D90429')
        return (
          <div className="absolute top-2 right-2 bg-black text-white border-2 border-[#6BDB58] px-3 py-2 text-[10px] font-black uppercase pointer-events-none min-w-[200px]">
            <div className="text-[#6BDB58] mb-1 border-b border-white/20 pb-1">
              {hover === events.length - 1 ? '⚽ GOAL' : `Action ${hover + 1}`} · {minuteVal}'
            </div>
            <div className="space-y-0.5">
              {playerLabel && (
                <div>
                  <span className="text-[#9AA397]">Player:</span>{' '}
                  {teamColor && <span className="inline-block w-2 h-2 mr-1" style={{ backgroundColor: teamColor }} />}
                  {playerLabel}
                </div>
              )}
              <div><span className="text-[#9AA397]">Action:</span> {hovered.action || '?'}</div>
              {hovered.outcome && <div><span className="text-[#9AA397]">Outcome:</span> {hovered.outcome}</div>}
              {hovered.type && hovered.type !== 'NA' && <div><span className="text-[#9AA397]">Type:</span> {hovered.type}</div>}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
