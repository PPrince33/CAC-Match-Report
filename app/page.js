'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { fetchSupabase } from '../lib/supabase.js'
import { RefreshCw, ChevronDown } from 'lucide-react'
import CacLogo from '../components/ui/CacLogo.jsx'

export default function HomePage() {
  const [matches, setMatches] = useState([])
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [tournamentFilter, setTournamentFilter] = useState('ALL')
  const [sportFilter, setSportFilter] = useState('ALL')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [matchesData, tournamentsData] = await Promise.all([
          fetchSupabase('matches', {
            select: 'match_id,home_team_id,away_team_id,match_date,match_name,status,is_futsal,video_url,tournament_name,tournament_id,home_team_score,away_team_score,home_team:teams!matches_home_team_id_fkey(team_name),away_team:teams!matches_away_team_id_fkey(team_name)',
            'status': 'eq.Done',
            order: 'match_date.desc'
          }),
          fetchSupabase('tournaments', {
            select: 'tournament_id,tournament_name',
            order: 'tournament_name.asc'
          }),
        ])
        setMatches(matchesData || [])
        setTournaments(tournamentsData || [])
      } catch (err) {
        console.error('Fetch Error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const filteredMatches = useMemo(() => {
    let result = matches
    if (tournamentFilter !== 'ALL') {
      result = result.filter(m => m.tournament_id === tournamentFilter)
    }
    if (sportFilter !== 'ALL') {
      const isFutsal = sportFilter === 'FUTSAL'
      result = result.filter(m => m.is_futsal === isFutsal)
    }
    return result
  }, [matches, tournamentFilter, sportFilter])

  return (
    <div className="min-h-screen bg-white font-sans text-[#0B0D0B]">
      {/* Header */}
      <header className="border-b-2 border-[#D6DBD3]">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-8 flex flex-col gap-5">
          <a href="https://calcioac.com" target="_blank" rel="noreferrer" className="w-fit"><CacLogo className="w-24 h-auto" /></a>
          <div className="flex items-center gap-4 font-mono text-xs uppercase tracking-[0.16em] text-[#5B6359]">
            <span className="w-10 h-1 bg-[#6BDB58]" />
            <span><b className="text-[#0B0D0B] font-semibold">CAC</b> Calcio Analysis Company</span>
            <Link href="/players" className="ml-auto underline hover:text-[#0B0D0B]">Player reports</Link>
          </div>
          <h1 className="text-5xl md:text-7xl uppercase leading-[0.9]">
            Match <span className="hl">reports.</span>
          </h1>
        </div>
      </header>

      {/* Filter Bar */}
      <div className="max-w-7xl mx-auto px-6 md:px-8 pt-8">
        <div className="bg-[#F0F2EE] rounded-[20px] p-4 flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-widest text-[#5B6359]">
            <ChevronDown size={16} />
            <span>Filter</span>
          </div>
          <select
            className="bg-white rounded-full border-2 border-[#D6DBD3] px-4 py-2 font-semibold text-sm focus:outline-none focus:border-[#6BDB58] cursor-pointer min-w-[240px]"
            value={tournamentFilter}
            onChange={(e) => setTournamentFilter(e.target.value)}
          >
            <option value="ALL">All tournaments</option>
            {tournaments.map(t => (
              <option key={t.tournament_id} value={t.tournament_id}>{t.tournament_name}</option>
            ))}
          </select>
          <select
            className="bg-white rounded-full border-2 border-[#D6DBD3] px-4 py-2 font-semibold text-sm focus:outline-none focus:border-[#6BDB58] cursor-pointer min-w-[160px]"
            value={sportFilter}
            onChange={(e) => setSportFilter(e.target.value)}
          >
            <option value="ALL">All sports</option>
            <option value="FUTSAL">Futsal</option>
            <option value="FOOTBALL">Football</option>
          </select>
          <span className="font-mono text-xs font-semibold uppercase tracking-widest text-[#5B6359] sm:ml-auto">
            {filteredMatches.length} match{filteredMatches.length !== 1 ? 'es' : ''}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <main className="px-6 md:px-8 py-8 max-w-7xl mx-auto">
        {loading ? (
          <div className="flex items-center gap-3 font-mono text-sm font-semibold uppercase tracking-widest text-[#5B6359] py-20 justify-center">
            <RefreshCw className="animate-spin" size={18} /> Fetching match data
          </div>
        ) : (
          <ul className="border-t-2 border-[#D6DBD3]">
            {filteredMatches.length > 0 ? filteredMatches.map((m) => (
              <li key={m.match_id} className="border-b-2 border-[#D6DBD3]">
                <Link
                  href={`/match/${m.match_id}`}
                  className="group grid grid-cols-1 md:grid-cols-[110px_minmax(0,1fr)_auto_auto] items-center gap-x-6 gap-y-2 px-2 md:px-4 py-5 rounded-xl hover:bg-[#F0F2EE] transition-colors"
                >
                  {/* Date */}
                  <span className="font-mono text-xs uppercase tracking-wider text-[#5B6359] tabular-nums">
                    {m.match_date || '—'}
                  </span>

                  {/* Match: one line */}
                  <h2 className="text-xl md:text-2xl uppercase leading-none md:whitespace-nowrap md:truncate">
                    <span className="text-[#0077B6]">{m.home_team?.team_name}</span>
                    {' '}
                    <span className="tabular-nums"><span className="text-[#9AA397]">[</span><span className="text-[#0077B6]">{m.home_team_score ?? 0}</span><span className="text-[#9AA397]">]</span></span>
                    <span className="text-[#9AA397] mx-2">–</span>
                    <span className="tabular-nums"><span className="text-[#9AA397]">[</span><span className="text-[#D90429]">{m.away_team_score ?? 0}</span><span className="text-[#9AA397]">]</span></span>
                    {' '}
                    <span className="text-[#D90429]">{m.away_team?.team_name}</span>
                  </h2>

                  {/* Tags */}
                  <span className="flex items-center gap-2">
                    <span className="bg-[#F0F2EE] group-hover:bg-white rounded-full px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap transition-colors">
                      {m.tournament_name || 'CAC'}
                    </span>
                    <span className={`rounded-full px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider ${m.is_futsal ? 'bg-[#6BDB58] text-[#0B0D0B]' : 'bg-[#0B0D0B] text-white'}`}>
                      {m.is_futsal ? 'Futsal' : 'Football'}
                    </span>
                  </span>

                  {/* Action */}
                  <span className="hidden md:inline-block font-mono font-bold uppercase text-xs tracking-wider whitespace-nowrap group-hover:text-[#23801A] transition-colors">
                    View report →
                  </span>
                </Link>
              </li>
            )) : (
              <li className="py-16 text-center border-b-2 border-[#D6DBD3]">
                <p className="text-[#5B6359] font-semibold">No matches found for this selection.</p>
              </li>
            )}
          </ul>
        )}
      </main>

      <footer className="mt-16 max-w-7xl mx-auto px-6 md:px-8 py-8 border-t-2 border-[#D6DBD3] flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.14em] text-[#5B6359]">
        <CacLogo className="w-12 h-auto" />
        <a href="https://calcioac.com" target="_blank" rel="noreferrer" className="hover:text-[#0B0D0B] transition-colors">calcioac.com</a>
      </footer>
    </div>
  )
}
