'use client'

import { useState } from 'react'

export default function RadarChart({ p1Data, p2Data, maxes }) {
  const [tooltip, setTooltip] = useState(null)
  if (!p1Data || !p2Data) return null

  const size = 300
  const center = size / 2
  const radius = size * 0.35
  const metrics = [
    { key: 'passes', label: 'Passes' },
    { key: 'shots', label: 'Shots' },
    { key: 'xg', label: 'xG' },
    { key: 'carries', label: 'Carries' },
    { key: 'tackles', label: 'Tackles' },
    { key: 'interceptions', label: 'Pass Intercepts' }
  ]

  const getPoint = (val, max, idx) => {
    const angle = (Math.PI * 2 * idx) / metrics.length - Math.PI / 2
    const r = max > 0 ? (val / max) * radius : 0
    return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`
  }

  const p1Points = metrics.map((m, i) => getPoint(p1Data.stats[m.key], maxes[m.key], i)).join(' ')
  const p2Points = metrics.map((m, i) => getPoint(p2Data.stats[m.key], maxes[m.key], i)).join(' ')
  const levels = [0.2, 0.4, 0.6, 0.8, 1]

  return (
    <div className="relative w-full h-full max-w-[400px] mx-auto font-mono">
      <svg viewBox={`-60 -60 ${size + 120} ${size + 120}`} className="w-full h-full overflow-visible">
        {levels.map((level, levelIdx) => (
          <polygon
            key={`level-${levelIdx}`}
            points={metrics.map((_, i) => getPoint(level, 1, i)).join(' ')}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="1"
            strokeDasharray={level < 1 ? '2,2' : ''}
          />
        ))}
        {metrics.map((_, i) => {
          const angle = (Math.PI * 2 * i) / metrics.length - Math.PI / 2
          return (
            <line
              key={`axis-${i}`}
              x1={center} y1={center}
              x2={center + radius * Math.cos(angle)}
              y2={center + radius * Math.sin(angle)}
              stroke="#e5e7eb" strokeWidth="1"
            />
          )
        })}
        {metrics.map((m, i) => {
          const angle = (Math.PI * 2 * i) / metrics.length - Math.PI / 2
          const labelR = radius * 1.25
          const x = center + labelR * Math.cos(angle)
          const y = center + labelR * Math.sin(angle)
          let anchor = 'middle'
          if (Math.abs(Math.cos(angle)) > 0.1) anchor = Math.cos(angle) > 0 ? 'start' : 'end'
          return (
            <text
              key={`label-${i}`}
              x={x} y={y}
              textAnchor={anchor}
              dominantBaseline="middle"
              fontSize="11"
              fontWeight="bold"
              fill="#374151"
              className="uppercase"
            >
              {m.label}
            </text>
          )
        })}
        <polygon points={p1Points} fill="rgba(0, 119, 182, 0.25)" stroke="#0077B6" strokeWidth="2" />
        <polygon points={p2Points} fill="rgba(217, 4, 41, 0.25)" stroke="#D90429" strokeWidth="2" />
        {metrics.map((m, i) => {
          const pt = getPoint(p1Data.stats[m.key], maxes[m.key], i).split(',')
          return (
            <circle
              key={`p1-pt-${i}`}
              cx={pt[0]} cy={pt[1]} r="5"
              fill="#0077B6"
              className="cursor-crosshair"
              onMouseEnter={() => setTooltip({ player: p1Data.info.players?.player_name, val: p1Data.stats[m.key], max: maxes[m.key], metric: m.label, color: '#0077B6' })}
              onMouseLeave={() => setTooltip(null)}
            />
          )
        })}
        {metrics.map((m, i) => {
          const pt = getPoint(p2Data.stats[m.key], maxes[m.key], i).split(',')
          return (
            <circle
              key={`p2-pt-${i}`}
              cx={pt[0]} cy={pt[1]} r="5"
              fill="#D90429"
              className="cursor-crosshair"
              onMouseEnter={() => setTooltip({ player: p2Data.info.players?.player_name, val: p2Data.stats[m.key], max: maxes[m.key], metric: m.label, color: '#D90429' })}
              onMouseLeave={() => setTooltip(null)}
            />
          )
        })}
      </svg>
      {tooltip && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-4 bg-white border-2 border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-20 whitespace-nowrap pointer-events-none">
          <div className="text-[10px] font-black uppercase text-gray-500 border-b-2 border-black pb-1 mb-2">{tooltip.metric} Overview</div>
          <div className="text-sm font-bold flex flex-col gap-1">
            <span className="uppercase" style={{ color: tooltip.color }}>{tooltip.player}</span>
            <div className="text-black">
              Player Value: <span className="font-black text-lg">{tooltip.val}</span>
              <span className="text-[10px] text-gray-500 ml-2">(Match Max: {tooltip.max})</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
