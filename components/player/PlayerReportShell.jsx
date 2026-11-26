'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { RefreshCw, Printer, Link2, Sparkles, Save } from 'lucide-react'
import { supabase } from '../../lib/supabase.js'
import { loadPlayerReport, summaryPayload } from '../../lib/playerData.js'
import CacLogo from '../ui/CacLogo.jsx'
import PlayerReport from './PlayerReport.jsx'

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || ''
const pill = 'inline-flex items-center gap-2 rounded-full px-4 py-2 font-mono font-bold uppercase text-xs transition-colors disabled:opacity-50'

/**
 * Loads and renders a player report.
 * @param {object} p
 *   playerId, matchIds (null = all processed matches)
 *   project:  { project_id, share_token, scout_summary, summary_approved } when opened from a project
 *   shared:   true on the public share link (read-only, approved summary only)
 *   profile:  player_profiles row (share link passes it in; otherwise loaded when signed in)
 *   error:    message to show instead of the report
 */
export default function PlayerReportShell({ playerId, matchIds = null, project = null, shared = false, profile: profileIn = null, error: errorIn = null }) {
  const [report, setReport] = useState(null)
  const [error, setError] = useState(errorIn)
  const [format, setFormat] = useState(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(profileIn)

  // Scout summary state
  const [text, setText] = useState(project?.scout_summary || '')
  const [approved, setApproved] = useState(!!project?.summary_approved)
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState('')

  useEffect(() => { setText(project?.scout_summary || ''); setApproved(!!project?.summary_approved) }, [project])

  useEffect(() => {
    if (errorIn || !playerId) return
    let alive = true
    setReport(null)
    loadPlayerReport(playerId, matchIds, format)
      .then(r => { if (alive) setReport(r) })
      .catch(e => { if (alive) setError(e.message) })
    return () => { alive = false }
  }, [playerId, matchIds?.join(','), format, errorIn])

  useEffect(() => {
    if (shared) return
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data?.user || null)
      if (data?.user && playerId) {
        const { data: pr } = await supabase.from('player_profiles').select('*').eq('player_id', playerId).maybeSingle()
        if (pr) setProfile(pr)
      }
    })
  }, [shared, playerId])

  const canEdit = !shared && !!user

  const generate = async () => {
    setBusy('gen'); setMsg('')
    try {
      const res = await fetch(`${BASE}/api/analyze`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'player', player: summaryPayload(report) }),
      })
      const data = await res.json()
      if (!res.ok || !data.analysis) throw new Error(data.error || 'No summary returned')
      setText(data.analysis.trim()); setApproved(false)
      setMsg(project ? 'Draft generated. Edit it, then save.' : 'Draft generated (not saved: open this report from a project to save it).')
    } catch (e) { setMsg('Could not generate: ' + e.message) }
    setBusy(null)
  }

  const save = async (nextApproved = approved) => {
    if (!project) return
    setBusy('save'); setMsg('')
    const { error: err } = await supabase.from('player_projects')
      .update({ scout_summary: text, summary_approved: nextApproved, summary_updated_at: new Date().toISOString() })
      .eq('project_id', project.project_id)
    setBusy(null)
    if (err) setMsg('Save failed: ' + err.message)
    else { setApproved(nextApproved); setMsg(nextApproved ? 'Saved and approved: visible on the share link.' : 'Saved as draft: hidden from the share link.') }
  }

  const shareUrl = project?.share_token ? `${window.location.origin}${BASE}/player/share/${project.share_token}` : null
  const copyShare = async () => {
    try { await navigator.clipboard.writeText(shareUrl); setMsg('Share link copied.') }
    catch { window.prompt('Copy the share link:', shareUrl) }
  }

  if (error) {
    return <Frame><div className="max-w-xl mx-auto mt-16 rounded-[20px] bg-[#F0F2EE] p-8"><h2 className="text-2xl uppercase mb-2">Report unavailable</h2><p className="text-[#5B6359]">{error}</p></div></Frame>
  }
  if (!report) {
    return <Frame><div className="flex items-center justify-center gap-3 mt-24 font-mono font-bold uppercase"><RefreshCw className="animate-spin" size={18} /> Building player report…</div></Frame>
  }
  if (report.empty) {
    return <Frame><div className="max-w-xl mx-auto mt-16 rounded-[20px] bg-[#F0F2EE] p-8">
      <h2 className="text-2xl uppercase mb-2">{report.player.player_name}</h2>
      <p className="text-[#5B6359]">No processed match data for this player yet{report.missing.length ? ` (${report.missing.length} selected match${report.missing.length > 1 ? 'es are' : ' is'} not processed)` : ''}. Run Finish &amp; Process in the tagger first.</p>
    </div></Frame>
  }

  // Summary block: editor when signed in, read-only otherwise
  let summary = null
  if (canEdit) {
    summary = (
      <div className="rounded-[20px] bg-[#F0F2EE] p-5">
        <textarea value={text} onChange={e => setText(e.target.value)} rows={6}
          placeholder="Generate a draft from the stats, or write the summary yourself."
          className="w-full rounded-[14px] border-2 border-[#D6DBD3] bg-white p-4 text-[15px] leading-relaxed focus:border-[#0B0D0B] outline-none no-print" />
        <p className="print-only text-[15px] leading-relaxed whitespace-pre-line">{text}</p>
        <div className="no-print flex flex-wrap items-center gap-2 mt-3">
          <button onClick={generate} disabled={!!busy} className={`${pill} bg-[#0B0D0B] text-white hover:bg-[#23801A]`}><Sparkles size={14} />{busy === 'gen' ? 'Generating…' : 'Generate draft'}</button>
          {project && <button onClick={() => save(approved)} disabled={!!busy} className={`${pill} bg-white border-2 border-[#0B0D0B] hover:bg-[#EFFAEC]`}><Save size={14} />Save</button>}
          {project && (
            <label className="flex items-center gap-2 font-mono text-xs font-bold uppercase ml-2 cursor-pointer">
              <input type="checkbox" checked={approved} onChange={e => save(e.target.checked)} disabled={!!busy || !text.trim()} className="w-4 h-4 accent-[#23801A]" />
              Approved for share link
            </label>
          )}
          {msg && <span className="font-mono text-xs text-[#5B6359]">{msg}</span>}
        </div>
        {!approved && project && <p className="no-print font-mono text-[10px] uppercase text-[#5B6359] mt-2">Clients only see the summary after you approve it.</p>}
      </div>
    )
  } else if (text && (approved || shared)) {
    summary = <div className="rounded-[20px] bg-[#F0F2EE] p-6 text-[15px] leading-relaxed whitespace-pre-line">{text}</div>
  }

  return (
    <Frame actions={
      <>
        {shareUrl && canEdit && <button onClick={copyShare} className={`${pill} bg-white border-2 border-[#0B0D0B] hover:bg-[#EFFAEC]`}><Link2 size={14} />Share link</button>}
        <button onClick={() => window.print()} className={`${pill} bg-[#0B0D0B] text-white hover:bg-[#23801A]`}><Printer size={14} />Download PDF</button>
      </>
    }>
      {report.missing.length > 0 && (
        <p className="no-print mb-4 rounded-[14px] bg-[#EFFAEC] px-4 py-3 font-mono text-xs">
          {report.missing.length} selected match{report.missing.length > 1 ? 'es have' : ' has'} no processed data for this player yet and {report.missing.length > 1 ? 'are' : 'is'} not included.
        </p>
      )}
      <PlayerReport report={report} profile={profile} summary={summary} onFormatChange={setFormat}
        profileEditor={canEdit ? <ProfileEditor playerId={playerId} profile={profile} onSaved={setProfile} /> : null} />
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

/** Optional details: filled in whenever known; every field can stay empty. */
function ProfileEditor({ playerId, profile, onSaved }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({})
  const [status, setStatus] = useState('')
  useEffect(() => {
    setF({
      date_of_birth: profile?.date_of_birth || '', preferred_foot: profile?.preferred_foot || '',
      height_cm: profile?.height_cm ?? '', weight_kg: profile?.weight_kg ?? '', nationality: profile?.nationality || '',
    })
  }, [profile])
  const set = (k) => (e) => setF(prev => ({ ...prev, [k]: e.target.value }))
  const save = async () => {
    setStatus('Saving…')
    const row = {
      player_id: playerId,
      date_of_birth: f.date_of_birth || null, preferred_foot: f.preferred_foot || null,
      height_cm: f.height_cm === '' ? null : Number(f.height_cm), weight_kg: f.weight_kg === '' ? null : Number(f.weight_kg),
      nationality: f.nationality.trim() || null, updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabase.from('player_profiles').upsert(row).select().single()
    if (error) setStatus('Save failed: ' + error.message)
    else { setStatus('Saved.'); onSaved(data) }
  }
  const input = 'rounded-full border-2 border-[#D6DBD3] bg-white px-4 py-2 text-sm w-full focus:border-[#0B0D0B] outline-none'
  return (
    <div className="no-print mt-3">
      <button onClick={() => setOpen(o => !o)} className="font-mono text-xs font-bold uppercase underline">{open ? 'Close player details' : 'Edit player details (optional)'}</button>
      {open && (
        <div className="mt-3 rounded-[20px] bg-[#F0F2EE] p-5 grid sm:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
          <label className="text-xs font-bold uppercase">Date of birth<input type="date" value={f.date_of_birth} onChange={set('date_of_birth')} className={input} /></label>
          <label className="text-xs font-bold uppercase">Foot<select value={f.preferred_foot} onChange={set('preferred_foot')} className={input}><option value="">—</option><option>Left</option><option>Right</option><option>Both</option></select></label>
          <label className="text-xs font-bold uppercase">Height (cm)<input type="number" min="100" max="230" value={f.height_cm} onChange={set('height_cm')} className={input} /></label>
          <label className="text-xs font-bold uppercase">Weight (kg)<input type="number" min="30" max="150" value={f.weight_kg} onChange={set('weight_kg')} className={input} /></label>
          <label className="text-xs font-bold uppercase">Nationality<input type="text" value={f.nationality} onChange={set('nationality')} className={input} /></label>
          <div className="flex items-center gap-3"><button onClick={save} className={`${pill} bg-[#0B0D0B] text-white`}>Save</button><span className="font-mono text-[10px]">{status}</span></div>
        </div>
      )}
    </div>
  )
}
