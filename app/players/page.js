'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { RefreshCw, Search, ChevronDown, Copy } from 'lucide-react'
import CacLogo from '../../components/ui/CacLogo.jsx'
import { listPlayers } from '../../lib/playerData.js'

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || ''
const POSITIONS = { GK: 'Goalkeeper', DF: 'Defender', MF: 'Midfielder', FW: 'Forward' }
const select = 'bg-white rounded-full border-2 border-[#D6DBD3] px-4 py-2 font-semibold text-sm focus:outline-none focus:border-[#6BDB58] cursor-pointer'

// Index of every player with processed match data. Click a name to open
// their report, so nobody has to remember player IDs.
export default function PlayersPage() {
  const [players, setPlayers] = useState(null)
  const [error, setError] = useState(null)
  const [q, setQ] = useState('')
  const [team, setTeam] = useState('ALL')
  const [pos, setPos] = useState('ALL')
  const [sport, setSport] = useState('ALL')
  const [copied, setCopied] = useState(null)

  useEffect(() => { listPlayers().then(setPlayers).catch(e => setError(e.message)) }, [])

  const teams = useMemo(() => [...new Set((players || []).map(p => p.team))].sort(), [players])
  const strip = (s) => String(s || '').replace(/[łŁ]/g, 'l').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const shown = useMemo(() => (players || []).filter(p =>
    (!q.trim() || strip(`${p.name} ${p.team}`).includes(strip(q.trim()))) &&
    (team === 'ALL' || p.team === team) &&
    (pos === 'ALL' || p.position === pos) &&
    (sport === 'ALL' || p.sport === sport || p.sport === 'Both')
  ), [players, q, team, pos, sport])

  const copyLink = async (p) => {
    const url = `${window.location.origin}${BASE}/player/${p.player_id}`
    try { await navigator.clipboard.writeText(url) } catch { window.prompt('Copy the report link:', url) }
    setCopied(p.player_id); setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div className="min-h-screen bg-white font-sans text-[#0B0D0B]">
      <header className="border-b-2 border-[#D6DBD3]">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-8 flex flex-col gap-5">
          <Link href="/" className="w-fit"><CacLogo className="w-24 h-auto" /></Link>
          <div className="flex items-center gap-4 font-mono text-xs uppercase tracking-[0.16em] text-[#5B6359]">
            <span className="w-10 h-1 bg-[#6BDB58]" />
            <span><b className="text-[#0B0D0B] font-semibold">CAC</b> Calcio Analysis Company</span>
            <Link href="/" className="ml-auto underline hover:text-[#0B0D0B]">Match reports</Link>
          </div>
          <h1 className="text-5xl md:text-7xl uppercase leading-[0.9]">
            Player <span className="hl">reports.</span>
          </h1>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 md:px-8 pt-8">
        <div className="bg-[#F0F2EE] rounded-[20px] p-4 flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5B6359]" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search player or team…" aria-label="Search player or team"
              className="w-full bg-white rounded-full border-2 border-[#D6DBD3] pl-10 pr-4 py-2 font-semibold text-sm focus:outline-none focus:border-[#6BDB58]" />
          </div>
          <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-widest text-[#5B6359]"><ChevronDown size={16} /><span>Filter</span></div>
          <select className={`${select} min-w-[200px]`} value={team} onChange={e => setTeam(e.target.value)} aria-label="Team">
            <option value="ALL">All teams</option>
            {teams.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className={`${select} min-w-[150px]`} value={pos} onChange={e => setPos(e.target.value)} aria-label="Position">
            <option value="ALL">All positions</option>
            {Object.entries(POSITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className={`${select} min-w-[140px]`} value={sport} onChange={e => setSport(e.target.value)} aria-label="Sport">
            <option value="ALL">All sports</option>
            <option value="Futsal">Futsal</option>
            <option value="Football">Football</option>
          </select>
          <span className="font-mono text-xs font-semibold uppercase tracking-widest text-[#5B6359] sm:ml-auto">
            {shown.length} player{shown.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <main className="px-6 md:px-8 py-8 max-w-7xl mx-auto">
        {error ? (
          <p className="text-[#5B6359]">Could not load players: {error}</p>
        ) : !players ? (
          <div className="flex items-center gap-3 font-mono text-sm font-semibold uppercase tracking-widest text-[#5B6359] py-20 justify-center">
            <RefreshCw className="animate-spin" size={18} /> Fetching players
          </div>
        ) : (
          <ul className="border-t-2 border-[#D6DBD3]">
            {shown.length ? shown.map(p => (
              <li key={p.player_id} className="border-b-2 border-[#D6DBD3] flex items-center gap-2">
                <Link href={`/player/${p.player_id}`}
                  className="group flex-1 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-6 gap-y-2 px-2 md:px-4 py-5 rounded-xl hover:bg-[#F0F2EE] transition-colors">
                  <div className="min-w-0">
                    <h2 className="text-xl md:text-2xl uppercase leading-none truncate [word-spacing:0.2em]">{p.name}</h2>
                    <p className="font-mono text-xs uppercase tracking-wider text-[#5B6359] mt-1.5 truncate">{p.team}{p.position ? ` · ${POSITIONS[p.position] || p.position}` : ''}</p>
                  </div>
                  <span className="font-mono text-xs uppercase tracking-wider text-[#5B6359] tabular-nums whitespace-nowrap">
                    <b className="text-[#0B0D0B]">{p.matches}</b> match{p.matches !== 1 ? 'es' : ''} · <b className="text-[#0B0D0B]">{p.minutes}</b>{p.approx ? '~' : ''} min
                  </span>
                  <span className={`w-fit rounded-full px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider ${p.sport === 'Futsal' ? 'bg-[#6BDB58] text-[#0B0D0B]' : p.sport === 'Both' ? 'bg-[#F0F2EE] group-hover:bg-white' : 'bg-[#0B0D0B] text-white'}`}>
                    {p.sport === 'Both' ? 'Futsal + Football' : p.sport}
                  </span>
                </Link>
                <button onClick={() => copyLink(p)} title="Copy report link" aria-label={`Copy report link for ${p.name}`}
                  className="shrink-0 rounded-full p-2.5 text-[#5B6359] hover:bg-[#F0F2EE] hover:text-[#0B0D0B] font-mono text-[10px] uppercase flex items-center gap-1">
                  <Copy size={14} />{copied === p.player_id ? 'Copied' : ''}
                </button>
              </li>
            )) : (
              <li className="py-16 text-center text-[#5B6359]">No players match these filters.</li>
            )}
          </ul>
        )}
        <p className="font-mono text-[10px] uppercase tracking-wider text-[#9AA397] mt-6">~ minutes partly estimated from tagged events. Only players with processed match data are listed.</p>
      </main>
    </div>
  )
}
