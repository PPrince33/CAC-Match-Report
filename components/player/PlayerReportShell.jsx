'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { RefreshCw, Printer } from 'lucide-react'
import { loadPlayerReport } from '../../lib/playerData.js'
import CacLogo from '../ui/CacLogo.jsx'
import PlayerReport from './PlayerReport.jsx'

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

  useEffect(() => {
    if (errorIn || !playerId) return
    let alive = true
    setReport(null)
    loadPlayerReport(playerId, matchIds, format)
      .then(r => { if (alive) setReport(r) })
      .catch(e => { if (alive) setError(e.message) })
    return () => { alive = false }
  }, [playerId, matchIds?.join(','), format, errorIn])

  if (error) {
    return <Frame><div className="max-w-xl mx-auto mt-16 rounded-[20px] bg-[#F0F2EE] p-8"><h2 className="text-2xl uppercase mb-2">Report unavailable</h2><p className="text-[#5B6359]">{error}</p></div></Frame>
  }
  if (!report) {
    return <Frame><div className="flex items-center justify-center gap-3 mt-24 font-mono font-bold uppercase"><RefreshCw className="animate-spin" size={18} /> Building player report…</div></Frame>
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
    <Frame actions={<button onClick={() => window.print()} className={`${pill} bg-[#0B0D0B] text-white hover:bg-[#23801A]`}><Printer size={14} />Download PDF</button>}>
      {report.missing.length > 0 && (
        <p className="no-print mb-4 rounded-[14px] bg-[#EFFAEC] px-4 py-3 font-mono text-xs">
          {report.missing.length} selected match{report.missing.length > 1 ? 'es have' : ' has'} no processed data for this player yet and {report.missing.length > 1 ? 'are' : 'is'} not included.
        </p>
      )}
      <PlayerReport report={report} profile={profile} summary={summaryBlock} onFormatChange={setFormat} />
    </Frame>
  )
}

function Frame({ children, actions }) {
  return (
    <div className="min-h-screen bg-white font-sans">
      <header className="no-print bg-white/95 backdrop-blur border-b-2 border-[#D6DBD3] px-4 md:px-8 py-3 flex justify-between items-center gap-4 sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-3 hover:opacity-70"><CacLogo className="w-12 h-auto" /><span className="font-mono text-[11px] uppercase tracking-widest text-[#5B6359]">Player report</span></Link>
        <div className="flex gap-2">{actions}</div>
      </header>
      <main className="p-4 md:p-8 max-w-6xl mx-auto">{children}</main>
    </div>
  )
}
