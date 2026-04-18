'use client'

import { useState } from 'react'

export default function LeaderCard({ leader }) {
  const [isFlipped, setIsFlipped] = useState(false)
  if (!leader || !leader.topList || leader.topList.length === 0) return null

  const topPlayer = leader.topList[0]
  const runnerUps = leader.topList.slice(1)

  return (
    <div
      className="relative w-full h-[150px] cursor-pointer perspective-1000 group"
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <div className={`w-full h-full relative preserve-3d transition-transform duration-500 ${isFlipped ? 'rotate-y-180' : 'group-hover:-translate-y-1'}`}>
        {/* Front */}
        <div className={`absolute inset-0 backface-hidden border-2 border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white flex flex-col justify-between ${topPlayer.isHome ? 'border-t-8 border-t-[#0077B6]' : 'border-t-8 border-t-[#D90429]'}`}>
          <div className="mb-2">
            <div className="flex justify-between items-start mb-1">
              <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-tight">{leader.action}</div>
              <div className="text-[8px] uppercase font-bold text-gray-400 bg-gray-100 px-1 border border-gray-300">Tap to Flip</div>
            </div>
            <div className="text-4xl font-black leading-none">{topPlayer.count}</div>
          </div>
          <div className="pt-2 border-t border-dashed border-gray-200">
            <div className="text-xs font-bold uppercase truncate" title={topPlayer.playerName}>
              #{topPlayer.jerseyNo} {topPlayer.playerName}
            </div>
            <div className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${topPlayer.isHome ? 'text-[#0077B6]' : 'text-[#D90429]'}`}>
              {topPlayer.teamName}
            </div>
          </div>
        </div>
        {/* Back */}
        <div className="absolute inset-0 backface-hidden rotate-y-180 border-2 border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-[#FFD166] flex flex-col">
          <div className="text-[10px] font-black text-black uppercase tracking-widest leading-tight border-b-2 border-black pb-1 mb-2 flex justify-between items-center">
            <span>{leader.action} Runners-up</span>
            <span className="text-[10px]">Back</span>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar space-y-1.5 mt-1">
            {runnerUps.length > 0 ? runnerUps.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-[11px] leading-tight bg-white/60 p-1 border border-black/20">
                <div className="font-bold uppercase truncate pr-2" title={p.playerName}>
                  <span className={p.isHome ? 'text-[#0077B6]' : 'text-[#D90429]'}>#{p.jerseyNo}</span> {p.playerName}
                </div>
                <div className="font-black shrink-0">{p.count}</div>
              </div>
            )) : (
              <div className="text-[10px] text-black font-bold uppercase mt-2 opacity-50">No other players</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
