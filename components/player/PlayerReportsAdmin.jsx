'use client'

import { useEffect, useState } from 'react'
import { Search, Copy, ExternalLink } from 'lucide-react'
import { supabase, fetchSupabase } from '../../lib/supabase.js'
import { processedMatchesFor } from '../../lib/playerData.js'

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || ''
const pill = 'inline-flex items-center gap-1.5 rounded-full border-2 border-[#0B0D0B] px-3 py-1.5 font-mono font-bold uppercase text-[10px] bg-white hover:bg-[#6BDB58] transition-all'

async function copy(text, setNote) {
  try { await navigator.clipboard.writeText(text); setNote('Link copied.') }
  catch { window.prompt('Copy the link:', text) }
}

/** Admin dashboard: build a player report link from ticked matches, and list Player Projects. */
export default function PlayerReportsAdmin() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [player, setPlayer] = useState(null)
  const [matches, setMatches] = useState(null)
  const [ticked, setTicked] = useState(new Set())
  const [projects, setProjects] = useState([])
  const [note, setNote] = useState('')

  useEffect(() => {
    supabase.from('player_projects')
      .select('project_id, player_id, title, status, share_token, summary_approved, created_at, players(player_name), player_project_matches(match_id)')
      .order('created_at', { ascending: false })
      .then(({ data }) => setProjects(data || []))
  }, [])

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      try {
        const rows = await fetchSupabase('players', {
          select: 'player_id,player_name,position,teams(team_name)',
          player_name: `ilike.*${q.trim()}*`, is_placeholder: 'eq.false', order: 'player_name.asc', limit: 15,
        })
        setResults(rows || [])
      } catch { setResults([]) }
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  const pick = async (p) => {
    setPlayer(p); setResults([]); setQ(''); setMatches(null); setNote('')
    const ms = await processedMatchesFor(p.player_id)
    setMatches(ms)
    setTicked(new Set(ms.map(m => m.match_id)))
  }

  const toggle = (id) => setTicked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const link = player && ticked.size
    ? `${origin}${BASE}/player/${player.player_id}${matches && ticked.size === matches.length ? '' : `?matches=${[...ticked].join(',')}`}`
    : null

  return (
    <section className="mb-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-black uppercase border-b-4 border-line pb-1">Player reports</h2>
        {note && <span className="font-mono text-xs text-[#23801A]">{note}</span>}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-[20px] bg-[#F0F2EE] p-5">
          <h3 className="text-lg uppercase mb-3">Report from matches</h3>
          <div className="relative">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5B6359]" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search a player…"
              className="w-full rounded-full border-2 border-[#D6DBD3] bg-white pl-10 pr-4 py-2 text-sm focus:border-[#0B0D0B] outline-none" />
          </div>
          {results.length > 0 && (
            <ul className="mt-2 rounded-[14px] bg-white border-2 border-[#D6DBD3] divide-y divide-[#D6DBD3]">
              {results.map(p => (
                <li key={p.player_id}><button onClick={() => pick(p)} className="w-full text-left px-4 py-2 text-sm hover:bg-[#EFFAEC]">
                  <strong>{p.player_name}</strong> <span className="text-[#5B6359]">{p.position || ''} · {p.teams?.team_name || 'No team'}</span>
                </button></li>
              ))}
            </ul>
          )}

          {player && (
            <div className="mt-4">
              <p className="font-bold">{player.player_name} <span className="font-normal text-[#5B6359]">· {player.teams?.team_name}</span></p>
              {matches == null ? <p className="font-mono text-xs mt-2">Loading processed matches…</p>
                : matches.length === 0 ? <p className="text-sm text-[#5B6359] mt-2">No processed matches with this player yet.</p>
                : (
                  <>
                    <ul className="mt-2 space-y-1">
                      {matches.map(m => (
                        <li key={m.match_id}>
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="checkbox" checked={ticked.has(m.match_id)} onChange={() => toggle(m.match_id)} className="w-4 h-4 accent-[#23801A]" />
                            <span className="font-mono text-xs text-[#5B6359]">{m.match_date}</span>
                            {m.home_team?.team_name} v {m.away_team?.team_name}
                            <span className="font-mono text-[9px] uppercase text-[#5B6359]">{m.tagging_mode || 'full'}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                    {link && (
                      <div className="flex gap-2 mt-4">
                        <a href={link} target="_blank" rel="noopener noreferrer" className={pill}><ExternalLink size={12} />Open report</a>
                        <button onClick={() => copy(link, setNote)} className={pill}><Copy size={12} />Copy link</button>
                      </div>
                    )}
                  </>
                )}
            </div>
          )}
        </div>

        <div className="rounded-[20px] bg-[#F0F2EE] p-5">
          <h3 className="text-lg uppercase mb-3">Player projects</h3>
          {projects.length === 0 ? <p className="text-sm text-[#5B6359]">No projects yet. Create them in the tagger under Player Projects.</p> : (
            <ul className="divide-y divide-[#D6DBD3]">
              {projects.map(p => (
                <li key={p.project_id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-sm">{p.players?.player_name} <span className="font-normal text-[#5B6359]">· {p.title || 'Untitled'}</span></p>
                    <p className="font-mono text-[10px] uppercase text-[#5B6359]">{(p.player_project_matches || []).length} matches · {p.status} · summary {p.summary_approved ? 'approved' : 'not approved'}</p>
                  </div>
                  <div className="flex gap-2">
                    <a href={`${BASE}/player/${p.player_id}?project=${p.project_id}`} className={pill}><ExternalLink size={12} />Open</a>
                    <button onClick={() => copy(`${origin}${BASE}/player/share/${p.share_token}`, setNote)} className={pill}><Copy size={12} />Share link</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
