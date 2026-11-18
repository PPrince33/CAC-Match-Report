'use client'

import { useState, useRef } from 'react'

const HOME_COLOR = '#0077B6'
const AWAY_COLOR = '#D90429'

const W = 800, H = 320, padL = 50, padR = 20, padT = 20, padB = 38
const innerW = W - padL - padR
const innerH = H - padT - padB

const niceTicks = (max, count = 5) => {
  if (max <= 0) return [0, 1]
  const step = Math.max(1, Math.ceil(max / count))
  const arr = []
  for (let v = 0; v <= step * count; v += step) arr.push(v)
  return arr
}

/**
 * Generic interval-line chart — two team lines (home blue, away red) with
 * markers and a hover tooltip showing completed / incompleted / total values.
 *
 * Props:
 *   data: [{ interval, homeY, homeIncomplete, homeTotal, awayY, awayIncomplete, awayTotal }]
 *   yLabel: y-axis label
 *   homeName, awayName: team names for the legend / tooltip
 *   metricLabel: tooltip label for the y value (e.g. "Completed Passes" or "Successful Long Balls")
 */
export default function IntervalLineChart({ data = [], yLabel = 'Count', homeName = 'Home', awayName = 'Away', metricLabel = 'Completed' }) {
  const [hover, setHover] = useState(null) // index into data
  const svgRef = useRef(null)

  if (!data.length) {
    return (
      <div className="border-4 border-dashed border-[#D6DBD3] p-8 text-center text-[11px] font-black uppercase text-[#9AA397]">
        No data for this metric in the current filter range
      </div>
    )
  }

  const maxX = Math.max(...data.map(d => d.interval), 5)
  const maxY = Math.max(...data.flatMap(d => [d.homeY || 0, d.awayY || 0]), 1)
  const yTicks = niceTicks(maxY)
  const yMax = Math.max(...yTicks)

  const xScale = i => padL + (i / maxX) * innerW
  const yScale = v => padT + innerH - (v / yMax) * innerH

  const linePath = (key) => data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(d.interval)} ${yScale(d[key] || 0)}`)
    .join(' ')

  const handleMouseMove = (e) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const xRatio = (e.clientX - rect.left) / rect.width
    const xVal = (xRatio * W - padL) / innerW * maxX
    if (xVal < -2.5 || xVal > maxX + 2.5) { setHover(null); return }
    // nearest interval
    let best = 0, bestDist = Infinity
    data.forEach((d, i) => {
      const dist = Math.abs(d.interval - xVal)
      if (dist < bestDist) { bestDist = dist; best = i }
    })
    setHover(best)
  }

  const handleMouseLeave = () => setHover(null)
  const hovered = hover != null ? data[hover] : null

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto select-none"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* gridlines */}
        {yTicks.map(t => (
          <line key={`g${t}`} x1={padL} y1={yScale(t)} x2={padL + innerW} y2={yScale(t)} stroke="#D6DBD3" strokeWidth="1" />
        ))}

        {/* axes */}
        <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="black" strokeWidth="2" />
        <line x1={padL} y1={padT + innerH} x2={padL + innerW} y2={padT + innerH} stroke="black" strokeWidth="2" />

        {/* y-axis ticks + labels */}
        {yTicks.map(t => (
          <g key={`y${t}`}>
            <line x1={padL - 4} y1={yScale(t)} x2={padL} y2={yScale(t)} stroke="black" strokeWidth="1.5" />
            <text x={padL - 8} y={yScale(t)} dy="0.32em" textAnchor="end" fontSize="11" fontFamily="monospace" fontWeight="700" fill="#2A302A">{t}</text>
          </g>
        ))}
        <text x={12} y={padT + innerH / 2} fontSize="10" fontFamily="monospace" fontWeight="900" fill="#5B6359" textAnchor="middle"
          transform={`rotate(-90 12 ${padT + innerH / 2})`}>{yLabel.toUpperCase()}</text>

        {/* x-axis ticks + labels (every 5 min) */}
        {data.map((d, i) => {
          const showLabel = (d.interval % 10 === 0) || data.length <= 12
          return (
            <g key={`x${d.interval}`}>
              <line x1={xScale(d.interval)} y1={padT + innerH} x2={xScale(d.interval)} y2={padT + innerH + 4} stroke="black" strokeWidth="1.5" />
              {showLabel && (
                <text x={xScale(d.interval)} y={padT + innerH + 18} textAnchor="middle" fontSize="11" fontFamily="monospace" fontWeight="700" fill="#2A302A">{d.interval}'</text>
              )}
            </g>
          )
        })}
        <text x={padL + innerW / 2} y={H - 4} textAnchor="middle" fontSize="10" fontFamily="monospace" fontWeight="900" fill="#5B6359">MATCH MINUTE (5-MIN INTERVALS)</text>

        {/* hover vertical guide */}
        {hovered && (
          <line x1={xScale(hovered.interval)} y1={padT} x2={xScale(hovered.interval)} y2={padT + innerH} stroke="#000" strokeWidth="1" strokeDasharray="3 3" opacity="0.4" />
        )}

        {/* lines */}
        <path d={linePath('homeY')} fill="none" stroke={HOME_COLOR} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <path d={linePath('awayY')} fill="none" stroke={AWAY_COLOR} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

        {/* markers */}
        {data.map((d, i) => (
          <g key={`m${i}`}>
            <circle cx={xScale(d.interval)} cy={yScale(d.homeY || 0)} r={hover === i ? 6 : 4} fill={HOME_COLOR} stroke="white" strokeWidth="2" />
            <circle cx={xScale(d.interval)} cy={yScale(d.awayY || 0)} r={hover === i ? 6 : 4} fill={AWAY_COLOR} stroke="white" strokeWidth="2" />
          </g>
        ))}
      </svg>

      {/* legend */}
      <div className="flex items-center gap-4 mt-1 text-[10px] font-black uppercase text-[#5B6359]">
        <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-[3px]" style={{ backgroundColor: HOME_COLOR }} />{homeName}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-[3px]" style={{ backgroundColor: AWAY_COLOR }} />{awayName}</span>
        <span className="ml-auto text-[#9AA397] italic">Hover anywhere for breakdown</span>
      </div>

      {/* tooltip card */}
      {hovered && (
        <div className="mt-3 border-2 border-line bg-white p-3 text-[11px] font-black uppercase">
          <div className="flex items-center justify-between border-b-2 border-line pb-1.5 mb-2">
            <span className="text-[#5B6359]">Minute</span>
            <span className="text-base">{hovered.interval}–{hovered.interval + 5}'</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] mb-1" style={{ color: HOME_COLOR }}>{homeName}</div>
              <div className="flex justify-between gap-3"><span className="text-[#5B6359]">{metricLabel}</span><span style={{ color: HOME_COLOR }}>{hovered.homeY ?? 0}</span></div>
              <div className="flex justify-between gap-3"><span className="text-[#5B6359]">Incompleted</span><span className="text-[#9AA397]">{hovered.homeIncomplete ?? 0}</span></div>
              <div className="flex justify-between gap-3"><span className="text-[#5B6359]">Total</span><span>{hovered.homeTotal ?? 0}</span></div>
            </div>
            <div>
              <div className="text-[10px] mb-1" style={{ color: AWAY_COLOR }}>{awayName}</div>
              <div className="flex justify-between gap-3"><span className="text-[#5B6359]">{metricLabel}</span><span style={{ color: AWAY_COLOR }}>{hovered.awayY ?? 0}</span></div>
              <div className="flex justify-between gap-3"><span className="text-[#5B6359]">Incompleted</span><span className="text-[#9AA397]">{hovered.awayIncomplete ?? 0}</span></div>
              <div className="flex justify-between gap-3"><span className="text-[#5B6359]">Total</span><span>{hovered.awayTotal ?? 0}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
