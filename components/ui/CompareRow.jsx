'use client'

import { useState } from 'react'

// Parse a comparable numeric value out of common formats: number, "84%", "37/55"
const parseScore = (v) => {
  if (v == null) return null
  if (typeof v === 'number') return v
  const s = String(v).trim()
  if (s.endsWith('%')) return parseFloat(s.slice(0, -1))
  if (s.includes('/')) return parseFloat(s.split('/')[0])
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

export default function CompareRow({ label, homeVal, awayVal, highlight = false, info, lowerIsBetter = false, compareBetter = true, onLabelClick = null }) {
  const [show, setShow] = useState(false)

  let better = null
  if (compareBetter) {
    const h = parseScore(homeVal)
    const a = parseScore(awayVal)
    if (h != null && a != null && h !== a) {
      const homeBetter = lowerIsBetter ? h < a : h > a
      better = homeBetter ? 'home' : 'away'
    }
  }
  const WIN = '#6BDB58'
  const winLine = `inline-block pb-0.5 border-b-[3px]`

  return (
    <div className={`flex items-center justify-between border-b border-[#D6DBD3] last:border-0 py-2.5 ${highlight ? 'bg-[#6BDB58] -mx-5 px-5 rounded-lg border-transparent' : ''}`}>
      <div className="w-1/3 text-left font-display italic font-black text-xl text-[#0077B6] tabular-nums">
        <span className={better === 'home' ? winLine : ''} style={better === 'home' ? { borderColor: WIN } : {}}>{homeVal}</span>
      </div>
      <div className="w-1/3 text-center text-[10px] sm:text-[11px] font-mono font-semibold uppercase text-[#5B6359] tracking-widest leading-tight relative">
        {onLabelClick ? (
          <button
            type="button"
            onClick={onLabelClick}
            className="hover:text-black underline decoration-dotted decoration-[#9AA397] underline-offset-4 hover:decoration-black focus:outline-none focus:text-black"
            title="Click to view pitch map"
          >{label}</button>
        ) : label}
        {info && (
          <span className="relative inline-block ml-1 align-middle">
            <button
              onMouseEnter={() => setShow(true)}
              onMouseLeave={() => setShow(false)}
              onFocus={() => setShow(true)}
              onBlur={() => setShow(false)}
              className="text-[#9AA397] hover:text-black leading-none focus:outline-none"
              style={{ fontSize: '11px' }}
              aria-label={`Info: ${label}`}
            >ⓘ</button>
            {show && (
              <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-[#0B0D0B] text-white text-[10px] font-normal normal-case tracking-normal leading-snug px-3 py-2 rounded-lg pointer-events-none">
                {info}
              </span>
            )}
          </span>
        )}
      </div>
      <div className="w-1/3 text-right font-display italic font-black text-xl text-[#D90429] tabular-nums">
        <span className={better === 'away' ? winLine : ''} style={better === 'away' ? { borderColor: WIN } : {}}>{awayVal}</span>
      </div>
    </div>
  )
}
