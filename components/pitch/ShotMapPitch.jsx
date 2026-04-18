'use client'

import { useRef, useState, useEffect } from 'react'
import { drawPitchMarkings } from './PitchDrawing.js'
import { PITCH_CONFIG } from '../../lib/pitchConfig.js'

export default function ShotMapPitch({ shots, teamName, isHome, lineups, isFutsal = true }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, transform: '', shot: null })

  const cfg = isFutsal ? PITCH_CONFIG.futsal : PITCH_CONFIG.football
  const pitchWidth = cfg.width
  const pitchHeight = cfg.height

  const getRadiusForXg = (xgValue) => {
    const val = parseFloat(xgValue) || 0.05
    return 4 + val * 14
  }

  const drawPitch = (ctx, w, h) => {
    const pad = 30
    const drawW = w - pad * 2
    const drawH = h - pad * 2
    const scaleX = (x) => pad + (x / pitchWidth) * drawW
    const scaleY = (y) => h - (pad + (y / pitchHeight) * drawH)

    drawPitchMarkings(ctx, w, h, isFutsal, PITCH_CONFIG)

    const primaryColor = isHome ? '#0077B6' : '#D90429'
    const sortedShots = [...shots].sort((a, b) => (parseFloat(b.xg) || 0) - (parseFloat(a.xg) || 0))
    sortedShots.forEach(s => {
      if (s.start_x === null || s.start_y === null) return
      const pX = scaleX(s.start_x)
      const pY = scaleY(s.start_y)
      const radius = getRadiusForXg(s.xg)
      const isHovered = tooltip.shot && tooltip.shot.processed_event_id === s.processed_event_id
      const isGoal = s.outcome === 'Goal'
      ctx.beginPath()
      ctx.arc(pX, pY, isHovered ? radius + 2 : radius, 0, Math.PI * 2)
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
      canvas.height = container.clientWidth * (cfg.aspectRatio + 0.05)
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
    const scaleX = (x) => pad + (x / pitchWidth) * drawW
    const scaleY = (y) => canvas.height - (pad + (y / pitchHeight) * drawH)
    let hoveredShot = null
    const sortedShots = [...shots].sort((a, b) => (parseFloat(a.xg) || 0) - (parseFloat(b.xg) || 0))
    for (const s of sortedShots) {
      if (s.start_x === null || s.start_y === null) continue
      const evX = scaleX(s.start_x)
      const evY = scaleY(s.start_y)
      const radius = getRadiusForXg(s.xg)
      const dist = Math.sqrt(Math.pow(mouseX - evX, 2) + Math.pow(mouseY - evY, 2))
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
    <div ref={containerRef} className="flex-1 min-w-[300px] border-4 border-black bg-white relative cursor-crosshair">
      <div className={`absolute top-2 left-2 ${isHome ? 'bg-[#0077B6]' : 'bg-[#D90429]'} text-white border-2 border-black px-2 py-1 text-[10px] font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] z-10`}>
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
          className={`absolute z-50 bg-[#FFD166] border-2 border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] pointer-events-none min-w-[180px] transition-all duration-75 ${tooltip.transform}`}
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="text-sm font-black uppercase border-b-2 border-black pb-1 mb-2">
            #{lineups.find(l => l.player_id === tooltip.shot.player_id)?.jersey_no || '-'} {getPlayerName(tooltip.shot.player_id)}
          </div>
          <div className="space-y-1 text-xs font-bold leading-tight">
            <p><span className="text-gray-600">xG Value:</span> {parseFloat(tooltip.shot.xg || 0).toFixed(2)}</p>
            <p><span className="text-gray-600">Outcome:</span> {tooltip.shot.outcome}</p>
            {tooltip.shot.type && tooltip.shot.type !== 'NA' && <p><span className="text-gray-600">Type:</span> {tooltip.shot.type}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
