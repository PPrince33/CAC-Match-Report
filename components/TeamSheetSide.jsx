import BrutalistCard from './ui/BrutalistCard.jsx'
import { ClipboardList, ArrowUp, ArrowDown } from 'lucide-react'

const SubBadge = ({ sub }) => {
  if (!sub) return null
  const isOff = sub.direction === 'off'
  const Icon = isOff ? ArrowDown : ArrowUp
  const bg = isOff ? 'bg-[#0B0D0B] text-white' : 'bg-[#6BDB58] text-[#0B0D0B]'
  const title = `${isOff ? 'Subbed Off' : 'Subbed On'}${sub.minute != null ? ` at ${sub.minute}'` : ''}`
  return (
    <span title={title} className={`inline-flex items-center gap-0.5 ${bg} px-1 py-0.5 rounded text-[9px] font-black leading-none shrink-0`}>
      <Icon size={10} strokeWidth={3} />
      {sub.minute != null && <span>{sub.minute}'</span>}
    </span>
  )
}

export default function TeamSheetSide({ teamName, roster, colorClass }) {
  return (
    <BrutalistCard color="bg-white" className="flex flex-col h-full">
      <div className={`p-3 -mx-5 -mt-5 mb-4 rounded-t-[20px] flex items-center justify-between ${colorClass} text-white`}>
        <h4 className="text-xl font-black uppercase">{teamName}</h4>
        <ClipboardList size={20} />
      </div>
      <div className="space-y-6">
        <section>
          <div className="space-y-1.5">
            {roster.starters.map((p, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm font-bold border-b border-[#D6DBD3] pb-1 gap-2">
                <span className="flex items-center gap-3 min-w-0">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center bg-[#0B0D0B] text-white text-[10px] leading-none shrink-0">
                    {p.jersey_no || '-'}
                  </span>
                  <span className="uppercase truncate">{p.players?.player_name}</span>
                  <SubBadge sub={p.sub} />
                </span>
                <span className="text-[10px] font-black text-[#9AA397] uppercase w-8 text-right shrink-0">
                  {p.position || p.players?.position || 'POS'}
                </span>
              </div>
            ))}
          </div>
        </section>
        <section>
          <div className="space-y-1.5 opacity-80">
            {roster.subs.length > 0 ? roster.subs.map((p, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm font-bold border-b border-[#D6DBD3] pb-1 italic gap-2">
                <span className="flex items-center gap-3 min-w-0">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center border border-[#0B0D0B] text-[#0B0D0B] text-[10px] leading-none shrink-0">
                    {p.jersey_no || '-'}
                  </span>
                  <span className="uppercase truncate">{p.players?.player_name}</span>
                  <SubBadge sub={p.sub} />
                </span>
                <span className="text-[10px] font-black text-[#9AA397] uppercase w-8 text-right shrink-0">
                  {p.position || p.players?.position || 'SUB'}
                </span>
              </div>
            )) : (
              <div className="text-xs font-bold text-[#9AA397] uppercase">None Registered</div>
            )}
          </div>
        </section>
      </div>
    </BrutalistCard>
  )
}
