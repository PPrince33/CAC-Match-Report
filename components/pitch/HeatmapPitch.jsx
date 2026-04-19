'use client'

import { useRef, useEffect } from 'react'
import { drawPitchMarkings } from './PitchDrawing.js'
import { PITCH_CONFIG } from '../../lib/pitchConfig.js'

export default function HeatmapPitch({ events, teamName, isHome, isFutsal = true }) {
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

    const primaryRGB = isHome ? '0, 119, 182' : '217, 4, 41'
    ctx.globalCompositeOperation = 'multiply'
    events.forEach(s => {
      if (s.start_x === null || s.start_y === null) return
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
