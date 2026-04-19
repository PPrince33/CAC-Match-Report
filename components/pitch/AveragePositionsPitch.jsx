'use client'

import { useRef, useState, useEffect } from 'react'
import { drawPitchMarkings } from './PitchDrawing.js'
import { PITCH_CONFIG } from '../../lib/pitchConfig.js'

export default function AveragePositionsPitch({ data, teamName, isHome, lineups, isFutsal = true }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, transform: '', playerInfo: null })

  const cfg = isFutsal ? PITCH_CONFIG.futsal : PITCH_CONFIG.football
  const pitchWidth = cfg.width
  const pitchHeight = cfg.height

  const drawPitch = (ctx, w, h) => {
    const pad = 30
    const drawW = w - pad * 2
    const drawH = h - pad * 2
    const scaleX = (x) => pad + (x / pitchWidth) * drawW
    const scaleY = (y) => h - (pad + (y / pitchHeight) * drawH)

    drawPitchMarkings(ctx, w, h, isFutsal, PITCH_CONFIG)

    const primaryColor = isHome ? '#0077B6' : '#D90429'
    data.forEach(p => {
      const pX = scaleX(p.avgX)
      const pY = scaleY(p.avgY)
      const isHovered = tooltip.playerInfo && tooltip.playerInfo.playerId === p.playerId
      ctx.beginPath()
      ctx.arc(pX, pY, isHovered ? 14 : 12, 0, Math.PI * 2)
      ctx.fillStyle = primaryColor
      ctx.fill()
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 2
      ctx.stroke()
      const lineupItem = lineups.find(l => l.player_id === p.playerId)
      const jerseyNo = lineupItem?.jersey_no || '?'
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 12px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(jerseyNo, pX, pY + 1)
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
  }, [data, tooltip.playerInfo, isFutsal])

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
    let hoveredPlayer = null
    data.forEach(p => {
      const evX = scaleX(p.avgX)
      const evY = scaleY(p.avgY)
      const dist = Math.sqrt(Math.pow(mouseX - evX, 2) + Math.pow(mouseY - evY, 2))
      if (dist < 14) hoveredPlayer = p
    })
    if (hoveredPlayer) {
      const cursorX = e.clientX - rect.left
      const cursorY = e.clientY - rect.top
      let tX = cursorX, tY = cursorY - 15
      let transform = 'transform -translate-x-1/2 -translate-y-full'
      if (cursorY < 120) { tY = cursorY + 20; transform = 'transform -translate-x-1/2' }
      if (cursorX < 110) { transform = transform.replace('-translate-x-1/2', 'translate-x-0'); tX = cursorX + 15 }
      else if (cursorX > rect.width - 110) { transform = transform.replace('-translate-x-1/2', '-translate-x-full'); tX = cursorX - 15 }
      setTooltip({ visible: true, x: tX, y: tY, transform, playerInfo: hoveredPlayer })
    } else {
      setTooltip({ visible: false, x: 0, y: 0, transform: '', playerInfo: null })
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
        onMouseLeave={() => setTooltip({ visible: false, x: 0, y: 0, transform: '', playerInfo: null })}
      />
      {tooltip.visible && tooltip.playerInfo && (
        <div
          className={`absolute z-50 bg-[#FFD166] border-2 border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] pointer-events-none min-w-[180px] transition-all duration-75 ${tooltip.transform}`}
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="text-sm font-black uppercase border-b-2 border-black pb-1 mb-2">
            #{lineups.find(l => l.player_id === tooltip.playerInfo.playerId)?.jersey_no} {getPlayerName(tooltip.playerInfo.playerId)}
          </div>
          <div className="space-y-1 text-xs font-bold leading-tight">
            <p><span className="text-gray-600">Events Recorded:</span> {tooltip.playerInfo.count}</p>
            <p><span className="text-gray-600">Avg X:</span> {tooltip.playerInfo.avgX.toFixed(1)}m</p>
            <p><span className="text-gray-600">Avg Y:</span> {tooltip.playerInfo.avgY.toFixed(1)}m</p>
          </div>
        </div>
      )}
      <div className="border-t-2 border-black px-3 py-1.5 bg-[#f1f5f9] text-[9px] font-black uppercase tracking-widest text-gray-500 flex items-center justify-center gap-2">
        <span>Attack Direction →</span>
      </div>
    </div>
  )
}
