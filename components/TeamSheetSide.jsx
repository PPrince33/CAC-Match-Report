import BrutalistCard from './ui/BrutalistCard.jsx'
import { ClipboardList } from 'lucide-react'

export default function TeamSheetSide({ teamName, roster, colorClass }) {
  return (
    <BrutalistCard color="bg-white" className="flex flex-col h-full">
      <div className={`p-3 -m-4 mb-4 border-b-2 border-black flex items-center justify-between ${colorClass} text-white`}>
        <h4 className="text-xl font-black uppercase">{teamName}</h4>
        <ClipboardList size={20} />
      </div>
      <div className="space-y-6">
        <section>
          <div className="space-y-1.5">
            {roster.starters.map((p, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm font-bold border-b border-gray-100 pb-1">
                <span className="flex items-center gap-3">
                  <span className="w-5 h-5 flex items-center justify-center bg-black text-white text-[10px] leading-none">
                    {p.jersey_no || '-'}
                  </span>
                  <span className="uppercase">{p.players?.player_name}</span>
                </span>
                <span className="text-[10px] font-black text-gray-400 uppercase w-8 text-right">
                  {p.position || p.players?.position || 'POS'}
                </span>
              </div>
            ))}
          </div>
        </section>
        <section>
          <div className="space-y-1.5 opacity-80">
            {roster.subs.length > 0 ? roster.subs.map((p, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm font-bold border-b border-gray-100 pb-1 italic">
                <span className="flex items-center gap-3">
                  <span className="w-5 h-5 flex items-center justify-center border border-black text-black text-[10px] leading-none">
                    {p.jersey_no || '-'}
                  </span>
                  <span className="uppercase">{p.players?.player_name}</span>
                </span>
                <span className="text-[10px] font-black text-gray-400 uppercase w-8 text-right">
                  {p.position || p.players?.position || 'SUB'}
                </span>
              </div>
            )) : (
              <div className="text-xs font-bold text-gray-300 uppercase">None Registered</div>
            )}
          </div>
        </section>
      </div>
    </BrutalistCard>
  )
}
