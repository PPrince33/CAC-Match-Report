'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { RefreshCw, Printer } from 'lucide-react'
import { loadPlayerReport } from '../../lib/playerData.js'
import CacLogo from '../ui/CacLogo.jsx'
import PlayerReport from './PlayerReport.jsx'
import MultiSelect from './MultiSelect.jsx'

const pill = 'inline-flex items-center gap-2 rounded-full px-4 py-2 font-mono font-bold uppercase text-xs transition-colors'

/**
 * Loads and renders a read-only player report. Editing (scout summary,
 * player details, links) happens in the tagger's Player Projects screen.
 * @param {object} p
 *   playerId, matchIds (null = all processed matches)
 *   summary:  approved scout summary text (share link only)
 *   profile:  player_profiles row (share link only)
 *   error:    message to show instead of the report
 */
export default function PlayerReportShell({ playerId, matchIds = null, summary = null, profile = null, error: errorIn = null }) {
  const [report, setReport] = useState(null)
  const [error, setError] = useState(errorIn)
  const [format, setFormat] = useState(null)
  const [loading, setLoading] = useState(false)
  // Matches filter (empty = all; options come from the all-matches view) and the
  // leagues the player is compared with (null = his own league(s), [] = all leagues)
  const [matchOptions, setMatchOptions] = useState([])
  const [selMatches, setSelMatches] = useState([])
  const [compareWith, setCompareWith] = useState(null)

  const chosen = matchOptions.filter(m => !selMatches.length || selMatches.includes(m.id))
  const filtered = matchOptions.length > 0 && chosen.length < matchOptions.length
  const filterKey = (filtered ? chosen.map(m => m.id).join(',') : '') + '|' + (compareWith == null ? 'own' : compareWith.join(','))

  useEffect(() => {
    if (errorIn || !playerId) return
    if (filtered && !chosen.length) return
    let alive = true
    setLoading(true) // keep the current report on screen while the new selection loads
    loadPlayerReport(playerId, filtered ? chosen.map(m => m.id) : matchIds, format, compareWith)
      .then(r => {
        if (!alive) return
        setReport(r); setLoading(false)
        if (!filtered && !r.empty) setMatchOptions(r.perMatch.map(m => ({
          id: m.match.match_id,
          tournament: m.match.tournament_name || 'Other',
          label: `${m.match.match_date ? new Date(m.match.match_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '?'} · v ${m.oppName || '?'}`,
        })))
      })
      .catch(e => { if (alive) { setError(e.message); setLoading(false) } })
    return () => { alive = false }
  }, [playerId, matchIds?.join(','), format, filterKey, errorIn])

  const resetFilters = () => { setSelMatches([]); setCompareWith(null) }

  const changeFormat = (f) => { setMatchOptions([]); resetFilters(); setFormat(f) }

  const filterBar = <>
      {report && !report.empty && report.leagueOptions?.length > 0 && (
        <MultiSelect label="Leagues" prefix="vs" selected={compareWith ?? report.ownLeagues} onChange={setCompareWith}
          options={report.leagueOptions.map(l => ({ value: l.name, label: l.name,
            hint: `${l.players} player${l.players !== 1 ? 's' : ''} with ${report.poolMinMinutes}+ min${report.ownLeagues.includes(l.name) ? ' · own league' : ''}` }))} />
      )}
      {matchOptions.length > 1 && (
        <MultiSelect label="Matches" selected={selMatches} onChange={setSelMatches}
          options={matchOptions.map(m => ({ value: m.id, label: m.label, hint: m.tournament }))} />
      )}
  </>
  const pdfButton = <button onClick={() => window.print()} className={`${pill} bg-[#0B0D0B] text-white hover:bg-[#23801A]`}><Printer size={14} />Download PDF</button>

  if (error) {
    return <Frame><div className="max-w-xl mx-auto mt-16 rounded-[20px] bg-[#F0F2EE] p-8"><h2 className="text-2xl uppercase mb-2">Report unavailable</h2><p className="text-[#5B6359]">{error}</p></div></Frame>
  }
  if (!report) {
    return <Frame actions={<>{filterBar}</>}><div className="flex items-center justify-center gap-3 mt-24 font-mono font-bold uppercase"><RefreshCw className="animate-spin" size={18} /> Building player report…</div></Frame>
  }
  if (report.empty) {
    return <Frame><div className="max-w-xl mx-auto mt-16 rounded-[20px] bg-[#F0F2EE] p-8">
      <h2 className="text-2xl uppercase mb-2">{report.player.player_name}</h2>
      <p className="text-[#5B6359]">No processed match data for this player yet{report.missing.length ? ` (${report.missing.length} selected match${report.missing.length > 1 ? 'es are' : ' is'} not processed)` : ''}.</p>
    </div></Frame>
  }

  const summaryBlock = summary
    ? <div className="rounded-[20px] bg-[#F0F2EE] p-6 text-[15px] leading-relaxed whitespace-pre-line">{summary}</div>
    : null

  return (
    <Frame actions={<>{filterBar}{pdfButton}</>}>
      {report.missing.length > 0 && (
        <p className="no-print mb-4 rounded-[14px] bg-[#EFFAEC] px-4 py-3 font-mono text-xs">
          {report.missing.length} selected match{report.missing.length > 1 ? 'es have' : ' has'} no processed data for this player yet and {report.missing.length > 1 ? 'are' : 'is'} not included.
        </p>
      )}
      <div className={loading ? 'opacity-50 pointer-events-none transition-opacity' : 'transition-opacity'} aria-busy={loading}>
        <PlayerReport report={report} profile={profile} summary={summaryBlock} onFormatChange={changeFormat} />
      </div>
    </Frame>
  )
}

function Frame({ children, actions }) {
  return (
    <div className="min-h-screen bg-white font-sans">
      <header className="no-print bg-white/95 backdrop-blur border-b-2 border-[#D6DBD3] px-4 md:px-8 py-3 flex justify-between items-center gap-4 sticky top-0 z-50">
        <Link href="/players" className="flex items-center gap-3 hover:opacity-70" title="All player reports"><CacLogo className="w-12 h-auto" /><span className="font-mono text-[11px] uppercase tracking-widest text-[#5B6359]">Player report</span></Link>
        <div className="flex gap-2">{actions}</div>
      </header>
      <main className="p-4 md:p-8 max-w-6xl mx-auto">{children}</main>
    </div>
  )
}
