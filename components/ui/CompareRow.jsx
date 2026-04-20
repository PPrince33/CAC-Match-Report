'use client'

import { useState } from 'react'

export default function CompareRow({ label, homeVal, awayVal, highlight = false, info }) {
  const [show, setShow] = useState(false)

  return (
    <div className={`flex items-center justify-between border-b-2 border-dashed border-gray-300 last:border-0 py-2.5 ${highlight ? 'bg-[#FFD166] -mx-4 px-4 border-solid border-black border-y-2' : ''}`}>
      <div className="w-1/3 text-left font-black text-lg text-[#0077B6]">{homeVal}</div>
      <div className="w-1/3 text-center text-[10px] sm:text-[11px] font-black uppercase text-gray-500 tracking-widest leading-tight relative">
        {label}
        {info && (
          <span className="relative inline-block ml-1 align-middle">
            <button
              onMouseEnter={() => setShow(true)}
              onMouseLeave={() => setShow(false)}
              onFocus={() => setShow(true)}
              onBlur={() => setShow(false)}
              className="text-gray-400 hover:text-black leading-none focus:outline-none"
              style={{ fontSize: '11px' }}
              aria-label={`Info: ${label}`}
            >ⓘ</button>
            {show && (
              <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-black text-white text-[10px] font-normal normal-case tracking-normal leading-snug px-3 py-2 border-2 border-black shadow-[3px_3px_0px_0px_#FFD166] pointer-events-none">
                {info}
              </span>
            )}
          </span>
        )}
      </div>
      <div className="w-1/3 text-right font-black text-lg text-[#D90429]">{awayVal}</div>
    </div>
  )
}
