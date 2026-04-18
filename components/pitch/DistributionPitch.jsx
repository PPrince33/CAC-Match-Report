'use client'

import { useRef, useState, useEffect } from 'react'
import { drawPitchMarkings } from './PitchDrawing.js'
import { PITCH_CONFIG } from '../../lib/pitchConfig.js'
import { Map as MapIcon } from 'lucide-react'

export default function DistributionPitch({ filteredEvents, homeTeamId, lineups, isFutsal = true }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, transform: '', event: null })

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

    filteredEvents.forEach(e => {
      const color = e.team_id === homeTeamId ? '#0077B6' : '#D90429'
      const isHovered = tooltip.event && tooltip.event.processed_event_id === e.processed_event_id

      ctx.fillStyle = color
      ctx.globalAlpha = isHovered ? 1.0 : 0.6
      ctx.beginPath()
      ctx.arc(scaleX(e.start_x), scaleY(e.start_y), isHovered ? 8 : 5, 0, Math.PI * 2)
      ctx.fill()

      if (isHovered) {
        ctx.strokeStyle = '#000'
        ctx.lineWidth = 2
        ctx.stroke()
      }

      if (e.end_x !== null && e.end_y !== null) {
        ctx.strokeStyle = color
        ctx.lineWidth = isHovered ? 3 : 1.5
        ctx.beginPath()
        ctx.moveTo(scaleX(e.start_x), scaleY(e.start_y))
        ctx.lineTo(scaleX(e.end_x), scaleY(e.end_y))
        ctx.stroke()

        const angle = Math.atan2(scaleY(e.end_y) - scaleY(e.start_y), scaleX(e.end_x) - scaleX(e.start_x))
        ctx.beginPath()
        ctx.moveTo(scaleX(e.end_x), scaleY(e.end_y))
        ctx.lineTo(scaleX(e.end_x) - 10 * Math.cos(angle - Math.PI / 6), scaleY(e.end_y) - 10 * Math.sin(angle - Math.PI / 6))
        ctx.moveTo(scaleX(e.end_x), scaleY(e.end_y))
        ctx.lineTo(scaleX(e.end_x) - 10 * Math.cos(angle + Math.PI / 6), scaleY(e.end_y) - 10 * Math.sin(angle + Math.PI / 6))
        ctx.stroke()
      }
      ctx.globalAlpha = 1.0
    })
  }

  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current || !containerRef.current) return
      const canvas = canvasRef.current
      const container = containerRef.current
      canvas.width = container.clientWidth
      canvas.height = container.clientWidth * cfg.aspectRatio
      const ctx = canvas.getContext('2d')
      drawPitch(ctx, canvas.width, canvas.height)
    }
    window.addEventListener('resize', handleResize)
    handleResize()
    return () => window.removeEventListener('resize', handleResize)
  }, [filteredEvents, tooltip.event, isFutsal])

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
    let closestEvent = null
    let minDistance = 15
    filteredEvents.forEach(ev => {
      if (ev.start_x === null || ev.start_y === null) return
      const evX = scaleX(ev.start_x)
      const evY = scaleY(ev.start_y)
      const dist = Math.sqrt(Math.pow(mouseX - evX, 2) + Math.pow(mouseY - evY, 2))
      if (dist < minDistance) { minDistance = dist; closestEvent = ev }
    })
    if (closestEvent) {
      const cursorX = e.clientX - rect.left
      const cursorY = e.clientY - rect.top
      let tX = cursorX, tY = cursorY - 15
      let transform = 'transform -translate-x-1/2 -translate-y-full'
      if (cursorY < 120) { tY = cursorY + 20; transform = 'transform -translate-x-1/2' }
      if (cursorX < 110) { transform = transform.replace('-translate-x-1/2', 'translate-x-0'); tX = cursorX + 15 }
      else if (cursorX > rect.width - 110) { transform = transform.replace('-translate-x-1/2', '-translate-x-full'); tX = cursorX - 15 }
      setTooltip({ visible: true, x: tX, y: tY, transform, event: closestEvent })
    } else {
      setTooltip({ visible: false, x: 0, y: 0, transform: '', event: null })
    }
  }

  const formatTime = (secs) => {
    if (!secs) return '0:00'
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const getPlayerDisplay = (playerId) => {
    if (!playerId) return 'N/A'
    const p = lineups.find(l => l.player_id === playerId)
    return p ? `#${p.jersey_no || '-'} ${p.players?.player_name}` : 'Unknown'
  }

  return (
    <div ref={containerRef} className="w-full border-4 border-black bg-white relative cursor-crosshair mb-4">
      <div className="absolute top-2 left-2 bg-white border-2 border-black px-2 py-1 text-[10px] font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] z-10 flex items-center gap-1">
        <MapIcon size={12} /> Scatter Telemetry
      </div>
      <canvas
        ref={canvasRef}
        className="w-full block"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip({ visible: false, x: 0, y: 0, transform: '', event: null })}
      />
      {tooltip.visible && tooltip.event && (
        <div
          className={`absolute z-20 bg-[#FFD166] border-2 border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] pointer-events-none min-w-[200px] transition-all duration-75 ${tooltip.transform}`}
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="text-sm font-black uppercase border-b-2 border-black pb-1 mb-2 flex justify-between items-center">
            <span>{tooltip.event.action}</span>
            <span className="bg-black text-white px-1 text-xs">{formatTime(tooltip.event.match_time_seconds)}</span>
          </div>
          <div className="space-y-1 text-xs font-bold leading-tight">
            <p><span className="text-gray-600">PLAYER:</span> {getPlayerDisplay(tooltip.event.player_id)}</p>
            <p><span className="text-gray-600">OUTCOME:</span> {tooltip.event.outcome}</p>
            {tooltip.event.type && tooltip.event.type !== 'NA' && <p><span className="text-gray-600">TYPE:</span> {tooltip.event.type}</p>}
            {tooltip.event.reaction_player_id && (
              <p className="mt-2 pt-1 border-t border-dashed border-black">
                <span className="text-gray-600">REACTION:</span> {getPlayerDisplay(tooltip.event.reaction_player_id)}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
