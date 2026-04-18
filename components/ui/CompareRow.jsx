export default function CompareRow({ label, homeVal, awayVal, highlight = false }) {
  return (
    <div className={`flex items-center justify-between border-b-2 border-dashed border-gray-300 last:border-0 py-2.5 ${highlight ? 'bg-[#FFD166] -mx-4 px-4 border-solid border-black border-y-2' : ''}`}>
      <div className="w-1/3 text-left font-black text-lg text-[#0077B6]">{homeVal}</div>
      <div className="w-1/3 text-center text-[10px] sm:text-[11px] font-black uppercase text-gray-500 tracking-widest leading-tight">{label}</div>
      <div className="w-1/3 text-right font-black text-lg text-[#D90429]">{awayVal}</div>
    </div>
  )
}
