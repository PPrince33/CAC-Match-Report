'use client'

import { useRef, useState, useEffect } from 'react'
import { PITCH_CONFIG } from '../../lib/pitchConfig.js'

export default function ShotPlacementPitch({ shots, teamName, isHome, lineups, isFutsal = true }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, transform: '', shot: null })

  const cfg = isFutsal ? PITCH_CONFIG.futsal : PITCH_CONFIG.football
  const goalYMin = cfg.goalYMin
  const goalYMax = cfg.goalYMax
  const goalH = cfg.goalHeight

  // Bubble size is driven by xGOT (post-shot expected goals).
  // On-target shots (Goal/Save) carry an xGOT > 0; off-target/blocked shots
  // have xGOT = 0 → they still render at the base radius so they're visible.
  const getRadiusForXgot = (xgotValue) => {
    const val = parseFloat(xgotValue) || 0
    return 4 + val * 18
  }

  const drawPitch = (ctx, w, h) => {
    const pad = 30
    const drawW = w - pad * 2
    const drawH = h - pad * 2
    const viewPadY = (goalYMax - goalYMin) * 1.5
    const viewMinY = goalYMin - viewPadY
    const viewMaxY = goalYMax + viewPadY
    const viewRangeY = viewMaxY - viewMinY
    const viewMinZ = -0.5
    const viewMaxZ = goalH + 1.5
    const viewRangeZ = viewMaxZ - viewMinZ
    const scaleY = (y) => pad + drawW - ((y - viewMinY) / viewRangeY) * drawW
    const scaleZ = (z) => pad + drawH - ((z - viewMinZ) / viewRangeZ) * drawH

    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(pad, pad, drawW, drawH)
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 3
    ctx.strokeRect(pad, pad, drawW, drawH)

    ctx.beginPath()
    ctx.moveTo(pad, scaleZ(0))
    ctx.lineTo(w - pad, scaleZ(0))
    ctx.strokeStyle = '#CBD1C8'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.stroke()
    ctx.setLineDash([])

    ctx.beginPath()
    ctx.moveTo(scaleY(goalYMin), scaleZ(0))
    ctx.lineTo(scaleY(goalYMin), scaleZ(goalH))
    ctx.lineTo(scaleY(goalYMax), scaleZ(goalH))
    ctx.lineTo(scaleY(goalYMax), scaleZ(0))
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 6
    ctx.stroke()

    ctx.strokeStyle = '#D6DBD3'
    ctx.lineWidth = 1
    ctx.beginPath()
    const gridStep = (goalYMax - goalYMin) / 12
    for (let i = goalYMin + gridStep; i < goalYMax; i += gridStep) {
      ctx.moveTo(scaleY(i), scaleZ(0))
      ctx.lineTo(scaleY(i), scaleZ(goalH))
    }
    const zStep = goalH / 8
    for (let j = zStep; j < goalH; j += zStep) {
      ctx.moveTo(scaleY(goalYMin), scaleZ(j))
      ctx.lineTo(scaleY(goalYMax), scaleZ(j))
    }
    ctx.stroke()

    const primaryColor = isHome ? '#0077B6' : '#D90429'
    // Largest xGOT first → small bubbles draw on top of big ones (visible)
    const sortedShots = [...shots].sort((a, b) => (parseFloat(b.xgot) || 0) - (parseFloat(a.xgot) || 0))
    sortedShots.forEach(s => {
      if (s.end_y === null || s.end_z === null) return
      const pY = scaleY(s.end_y)
      const pZ = scaleZ(s.end_z)
      if (pY < pad - 10 || pY > w - pad + 10 || pZ < pad - 10 || pZ > h - pad + 10) return
      const radius = getRadiusForXgot(s.xgot)
      const isHovered = tooltip.shot && tooltip.shot.processed_event_id === s.processed_event_id
      const isGoal = s.outcome === 'Goal'
      ctx.beginPath()
      ctx.arc(pY, pZ, isHovered ? radius + 2 : radius, 0, Math.PI * 2)
      if (isGoal) {
        ctx.fillStyle = primaryColor; ctx.fill()
        ctx.strokeStyle = '#000000'; ctx.lineWidth = isHovered ? 3 : 2; ctx.stroke()
      } else {
        ctx.fillStyle = `${primaryColor}66`; ctx.fill()
        ctx.strokeStyle = primaryColor; ctx.lineWidth = isHovered ? 2.5 : 1.5; ctx.stroke()
      }
    })
  }

  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current || !containerRef.current) return
      const canvas = canvasRef.current
      const container = containerRef.current
      canvas.width = container.clientWidth
      canvas.height = container.clientWidth * 0.4
      const ctx = canvas.getContext('2d')
      drawPitch(ctx, canvas.width, canvas.height)
    }
    window.addEventListener('resize', handleResize)
    handleResize()
    return () => window.removeEventListener('resize', handleResize)
  }, [shots, tooltip.shot, isFutsal])

  const handleMouseMove = (e) => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width)
    const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height)
    const pad = 30
    const drawW = canvas.width - pad * 2
    const drawH = canvas.height - pad * 2
    const viewPadY = (goalYMax - goalYMin) * 1.5
    const viewMinY = goalYMin - viewPadY
    const viewMaxY = goalYMax + viewPadY
    const viewRangeY = viewMaxY - viewMinY
    const viewMinZ = -0.5
    const viewMaxZ = goalH + 1.5
    const viewRangeZ = viewMaxZ - viewMinZ
    const scaleY = (y) => pad + drawW - ((y - viewMinY) / viewRangeY) * drawW
    const scaleZ = (z) => pad + drawH - ((z - viewMinZ) / viewRangeZ) * drawH
    let hoveredShot = null
    // Smallest first so small bubbles win the hit-test if overlapping a bigger one
    const sortedShots = [...shots].sort((a, b) => (parseFloat(a.xgot) || 0) - (parseFloat(b.xgot) || 0))
    for (const s of sortedShots) {
      if (s.end_y === null || s.end_z === null) continue
      const evY = scaleY(s.end_y)
      const evZ = scaleZ(s.end_z)
      const radius = getRadiusForXgot(s.xgot)
      const dist = Math.sqrt(Math.pow(mouseX - evY, 2) + Math.pow(mouseY - evZ, 2))
      if (dist <= radius + 2) { hoveredShot = s; break }
    }
    if (hoveredShot) {
      const cursorX = e.clientX - rect.left
      const cursorY = e.clientY - rect.top
      let tX = cursorX, tY = cursorY - 15
      let transform = 'transform -translate-x-1/2 -translate-y-full'
      if (cursorY < 120) { tY = cursorY + 20; transform = 'transform -translate-x-1/2' }
      if (cursorX < 110) { transform = transform.replace('-translate-x-1/2', 'translate-x-0'); tX = cursorX + 15 }
      else if (cursorX > rect.width - 110) { transform = transform.replace('-translate-x-1/2', '-translate-x-full'); tX = cursorX - 15 }
      setTooltip({ visible: true, x: tX, y: tY, transform, shot: hoveredShot })
    } else {
      setTooltip({ visible: false, x: 0, y: 0, transform: '', shot: null })
    }
  }

  const getPlayerName = (pid) => {
    const l = lineups.find(x => x.player_id === pid)
    return l ? l.players?.player_name : 'Unknown'
  }

  return (
    <div ref={containerRef} className="flex-1 min-w-[300px] border-4 border-line bg-white relative cursor-crosshair">
      <div className={`absolute top-2 left-2 ${isHome ? 'bg-[#0077B6]' : 'bg-[#D90429]'} text-white border-2 border-line px-2 py-1 text-[10px] font-black uppercase z-10`}>
        {teamName}
      </div>
      <canvas
        ref={canvasRef}
        className="w-full block"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip({ visible: false, x: 0, y: 0, transform: '', shot: null })}
      />
      {tooltip.visible && tooltip.shot && (
        <div
          className={`absolute z-50 bg-[#6BDB58] border-2 border-line p-3 pointer-events-none min-w-[180px] transition-all duration-75 ${tooltip.transform}`}
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="text-sm font-black uppercase border-b-2 border-line pb-1 mb-2">
            #{lineups.find(l => l.player_id === tooltip.shot.player_id)?.jersey_no || '-'} {getPlayerName(tooltip.shot.player_id)}
          </div>
          <div className="space-y-1 text-xs font-bold leading-tight">
            <p><span className="text-[#5B6359]">xG:</span> {parseFloat(tooltip.shot.xg || 0).toFixed(2)}</p>
            <p><span className="text-[#5B6359]">xGOT:</span> {parseFloat(tooltip.shot.xgot || 0).toFixed(2)}</p>
            <p><span className="text-[#5B6359]">Outcome:</span> {tooltip.shot.outcome}</p>
            {tooltip.shot.type && tooltip.shot.type !== 'NA' && <p><span className="text-[#5B6359]">Type:</span> {tooltip.shot.type}</p>}
            <p className="mt-2 pt-1 border-t border-dashed border-line">
              <span className="text-[#5B6359]">Placement Height:</span> {parseFloat(tooltip.shot.end_z || 0).toFixed(2)}m
            </p>
          </div>
        </div>
      )}
      <div className="border-t-2 border-line px-3 py-1.5 bg-[#F0F2EE] text-[9px] font-black uppercase tracking-widest text-[#5B6359] flex items-center justify-center gap-2">
        <span>Attack Direction →</span>
      </div>
    </div>
  )
}
