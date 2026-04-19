'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { fetchSupabase } from '../lib/supabase.js'
import { RefreshCw, ChevronDown } from 'lucide-react'

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
    <div className="min-h-screen bg-[#f8fafc] font-mono">
      {/* Header */}
      <header className="bg-black text-white p-6 border-b-4 border-black">
        <div className="max-w-7xl mx-auto flex justify-between items-start">
          <div>
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-none">
              Welcome to <a href="https://calico-analysis-company.lovable.app" target="_blank" rel="noreferrer" className="hover:text-[#FFD166] transition-colors">CAC</a> Match Report
            </h1>
            <p className="text-[#06D6A0] font-black uppercase tracking-[0.3em] text-xs mt-2">
              <a href="https://calico-analysis-company.lovable.app" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">CAC Analytics</a>
            </p>
          </div>
        </div>
      </header>

      {/* Filter Bar */}
      <div className="border-b-4 border-black bg-[#FFD166] p-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-black font-bold">
            <ChevronDown size={20} />
            <span className="uppercase text-sm">Filter:</span>
          </div>
          <select
            className="bg-white border-2 border-black p-2 font-black uppercase text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:outline-none cursor-pointer min-w-[240px]"
            value={tournamentFilter}
            onChange={(e) => setTournamentFilter(e.target.value)}
          >
            <option value="ALL">All Tournaments</option>
            {tournaments.map(t => (
              <option key={t.tournament_id} value={t.tournament_id}>{t.tournament_name}</option>
            ))}
          </select>
          <select
            className="bg-white border-2 border-black p-2 font-black uppercase text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:outline-none cursor-pointer min-w-[160px]"
            value={sportFilter}
            onChange={(e) => setSportFilter(e.target.value)}
          >
            <option value="ALL">All Sports</option>
            <option value="FUTSAL">Futsal</option>
            <option value="FOOTBALL">Football</option>
          </select>
          <span className="text-xs font-black uppercase text-black/60 ml-auto">
            {filteredMatches.length} match{filteredMatches.length !== 1 ? 'es' : ''}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <main className="p-6 md:p-8 max-w-7xl mx-auto">
        {loading ? (
          <div className="flex items-center gap-3 text-xl font-bold uppercase py-20 justify-center">
            <RefreshCw className="animate-spin" /> Fetching match data...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {filteredMatches.length > 0 ? filteredMatches.map((m) => (
              <div
                key={m.match_id}
                className="border-2 border-black p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] bg-white hover:-translate-y-1 transition-all duration-150 flex flex-col"
              >
                {/* Badges */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="bg-[#FFD166] border-2 border-black px-2 py-1 text-[10px] font-black uppercase">
                    {m.tournament_name || 'CAC'}
                  </span>
                  <span className={`border-2 border-black px-2 py-1 text-[10px] font-black uppercase ${m.is_futsal ? 'bg-[#06D6A0] text-black' : 'bg-[#0077B6] text-white'}`}>
                    {m.is_futsal ? 'Futsal' : 'Football'}
                  </span>
                </div>

                {/* Score */}
                <h2 className="text-xl font-black uppercase mb-1 leading-tight">
                  <span className="text-[#0077B6]">{m.home_team?.team_name}</span>
                  {' '}
                  <span className="text-[#0077B6] text-2xl">{m.home_team_score ?? 0}</span>
                  <span className="text-gray-400 mx-2">-</span>
                  <span className="text-[#D90429] text-2xl">{m.away_team_score ?? 0}</span>
                  {' '}
                  <span className="text-[#D90429]">{m.away_team?.team_name}</span>
                </h2>

                <p className="text-xs font-bold text-gray-400 mb-6">
                  {m.match_date} &bull; {m.match_name}
                </p>

                <div className="mt-auto">
                  <Link
                    href={`/match/${m.match_id}`}
                    className="border-2 border-black px-6 py-2 font-bold uppercase text-sm bg-white hover:bg-[#FFD166] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-none transition-all inline-block"
                  >
                    View Report
                  </Link>
                </div>
              </div>
            )) : (
              <div className="col-span-full py-16 border-4 border-dashed border-gray-200 text-center">
                <p className="text-gray-400 font-black uppercase">No matches found for this selection.</p>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="mt-20 p-8 border-t-4 border-black text-center text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
        <a href="https://calico-analysis-company.lovable.app" target="_blank" rel="noreferrer" className="hover:text-black transition-colors">CAC Analytics Engine</a>
      </footer>
    </div>
  )
}
