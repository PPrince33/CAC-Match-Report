'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase, fetchSupabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../../../../../lib/supabase.js'
import { RefreshCw, Save, Trash2, Plus, ArrowLeft } from 'lucide-react'

async function patchSupabase(table, matchId, body) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?match_id=eq.${matchId}`
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token || SUPABASE_ANON_KEY
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Patch failed: ${res.status} - ${text}`)
  }
  return res.json()
}

async function deleteLineupRow(lineupId) {
  const url = `${SUPABASE_URL}/rest/v1/lineups?lineup_id=eq.${lineupId}`
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token || SUPABASE_ANON_KEY
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`)
}

async function insertLineupRow(row) {
  const url = `${SUPABASE_URL}/rest/v1/lineups`
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token || SUPABASE_ANON_KEY
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(row)
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Insert failed: ${res.status} - ${text}`)
  }
  return res.json()
}

async function patchLineupRow(lineupId, body) {
  const url = `${SUPABASE_URL}/rest/v1/lineups?lineup_id=eq.${lineupId}`
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token || SUPABASE_ANON_KEY
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`Patch lineup failed: ${res.status}`)
  return res.json()
}

export default function EditMatchPage() {
  const router = useRouter()
  const { id } = useParams()
  const [authChecked, setAuthChecked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)
  const [error, setError] = useState(null)

  // Match fields
  const [matchName, setMatchName] = useState('')
  const [matchDate, setMatchDate] = useState('')
  const [tournamentName, setTournamentName] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [homeScore, setHomeScore] = useState('')
  const [awayScore, setAwayScore] = useState('')
  const [status, setStatus] = useState('Pending')
  const [isFutsal, setIsFutsal] = useState(false)
  const [homeTeamId, setHomeTeamId] = useState(null)
  const [awayTeamId, setAwayTeamId] = useState(null)
  const [homeTeamName, setHomeTeamName] = useState('')
  const [awayTeamName, setAwayTeamName] = useState('')

  // Lineups
  const [lineups, setLineups] = useState([])
  const [allPlayers, setAllPlayers] = useState([])

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/admin')
        return
      }
      setAuthChecked(true)

      try {
        const [matchData, lineupsData, playersData] = await Promise.all([
          fetchSupabase('matches', {
            select: 'match_id,match_name,match_date,tournament_name,video_url,home_team_score,away_team_score,status,is_futsal,home_team_id,away_team_id,home_team:teams!matches_home_team_id_fkey(team_name),away_team:teams!matches_away_team_id_fkey(team_name)',
            'match_id': `eq.${id}`,
            limit: '1'
          }),
          fetchSupabase('lineups', {
            select: 'lineup_id,match_id,team_id,player_id,is_starter,jersey_no,position,players(player_name)',
            'match_id': `eq.${id}`,
            order: 'is_starter.desc,jersey_no.asc'
          }),
          fetchSupabase('players', {
            select: 'player_id,player_name',
            order: 'player_name.asc'
          })
        ])

        const match = matchData?.[0]
        if (!match) {
          setError('Match not found.')
          setLoading(false)
          return
        }

        setMatchName(match.match_name || '')
        setMatchDate(match.match_date || '')
        setTournamentName(match.tournament_name || '')
        setVideoUrl(match.video_url || '')
        setHomeScore(match.home_team_score ?? '')
        setAwayScore(match.away_team_score ?? '')
        setStatus(match.status || 'Pending')
        setIsFutsal(match.is_futsal || false)
        setHomeTeamId(match.home_team_id)
        setAwayTeamId(match.away_team_id)
        setHomeTeamName(match.home_team?.team_name || 'Home Team')
        setAwayTeamName(match.away_team?.team_name || 'Away Team')
        setLineups(lineupsData || [])
        setAllPlayers(playersData || [])
      } catch (err) {
        setError('Failed to load match data.')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    if (id) init()
  }, [id, router])

  const handleSaveMatch = async () => {
    setSaving(true)
    setSaveMsg(null)
    setError(null)
    try {
      await patchSupabase('matches', id, {
        match_name: matchName,
        match_date: matchDate || null,
        tournament_name: tournamentName,
        video_url: videoUrl || null,
        home_team_score: homeScore !== '' ? Number(homeScore) : null,
        away_team_score: awayScore !== '' ? Number(awayScore) : null,
        status,
        is_futsal: isFutsal
      })
      setSaveMsg('Match saved successfully.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteLineup = async (lineupId) => {
    if (!confirm('Remove this player from the lineup?')) return
    try {
      await deleteLineupRow(lineupId)
      setLineups(prev => prev.filter(l => l.lineup_id !== lineupId))
    } catch (err) {
      setError(err.message)
    }
  }

  const handleUpdateLineup = async (lineupId, field, value) => {
    setLineups(prev => prev.map(l => l.lineup_id === lineupId ? { ...l, [field]: value } : l))
    try {
      await patchLineupRow(lineupId, { [field]: value })
    } catch (err) {
      setError(err.message)
    }
  }

  const handleAddPlayer = async (teamId) => {
    const playerSelect = document.getElementById(`new-player-${teamId}`)
    const jerseyInput = document.getElementById(`new-jersey-${teamId}`)
    const positionInput = document.getElementById(`new-position-${teamId}`)
    const starterCheck = document.getElementById(`new-starter-${teamId}`)

    const playerId = playerSelect?.value
    if (!playerId) { setError('Please select a player.'); return }

    const newRow = {
      match_id: id,
      team_id: teamId,
      player_id: playerId,
      is_starter: starterCheck?.checked ?? true,
      jersey_no: jerseyInput?.value ? Number(jerseyInput.value) : null,
      position: positionInput?.value || null
    }

    try {
      const result = await insertLineupRow(newRow)
      const inserted = result?.[0]
      if (inserted) {
        const player = allPlayers.find(p => p.player_id === playerId)
        setLineups(prev => [...prev, { ...inserted, players: { player_name: player?.player_name || '' } }])
      }
      // Reset inputs
      if (playerSelect) playerSelect.value = ''
      if (jerseyInput) jerseyInput.value = ''
      if (positionInput) positionInput.value = ''
      if (starterCheck) starterCheck.checked = true
    } catch (err) {
      setError(err.message)
    }
  }

  const homeLineup = lineups.filter(l => l.team_id === homeTeamId)
  const awayLineup = lineups.filter(l => l.team_id === awayTeamId)

  if (!authChecked || loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] font-mono flex items-center justify-center">
        <div className="flex items-center gap-3 text-xl font-bold uppercase">
          <RefreshCw className="animate-spin" /> Loading match...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] font-mono flex flex-col">
      {/* Header */}
      <header className="bg-black text-white p-6 border-b-4 border-black">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter leading-none">
              Edit Match
            </h1>
            <p className="text-[#FFD166] font-black uppercase tracking-[0.2em] text-xs mt-2">
              {homeTeamName} vs {awayTeamName}
            </p>
          </div>
          <Link
            href="/admin/dashboard"
            className="border-2 border-white px-4 py-2 font-bold uppercase text-xs hover:bg-white hover:text-black transition-all flex items-center gap-2"
          >
            <ArrowLeft size={14} />
            Dashboard
          </Link>
        </div>
      </header>

      <main className="p-6 md:p-8 max-w-7xl mx-auto w-full flex-1">
        {/* Status Messages */}
        {saveMsg && (
          <div className="border-2 border-[#06D6A0] bg-[#06D6A0]/10 p-3 mb-6">
            <p className="text-xs font-black text-[#06D6A0] uppercase">{saveMsg}</p>
          </div>
        )}
        {error && (
          <div className="border-2 border-[#D90429] bg-[#D90429]/10 p-3 mb-6">
            <p className="text-xs font-black text-[#D90429] uppercase">{error}</p>
            <button onClick={() => setError(null)} className="text-[9px] font-black underline text-[#D90429] mt-1">Dismiss</button>
          </div>
        )}

        {/* Match Details Form */}
        <section className="mb-10">
          <h2 className="text-xl font-black uppercase border-b-4 border-black pb-1 mb-6">Match Details</h2>

          <div className="border-2 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] bg-white">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Match Name</label>
                <input
                  type="text"
                  value={matchName}
                  onChange={e => setMatchName(e.target.value)}
                  className="w-full border-2 border-black p-3 font-bold text-sm focus:outline-none focus:border-[#0077B6] bg-white"
                  placeholder="e.g. Group Stage Match 3"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Match Date</label>
                <input
                  type="date"
                  value={matchDate}
                  onChange={e => setMatchDate(e.target.value)}
                  className="w-full border-2 border-black p-3 font-bold text-sm focus:outline-none focus:border-[#0077B6] bg-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Tournament Name</label>
                <input
                  type="text"
                  value={tournamentName}
                  onChange={e => setTournamentName(e.target.value)}
                  className="w-full border-2 border-black p-3 font-bold text-sm focus:outline-none focus:border-[#0077B6] bg-white"
                  placeholder="e.g. CAC Summer Cup"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Video URL</label>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={e => setVideoUrl(e.target.value)}
                  className="w-full border-2 border-black p-3 font-bold text-sm focus:outline-none focus:border-[#0077B6] bg-white"
                  placeholder="https://youtube.com/..."
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                  Home Score ({homeTeamName})
                </label>
                <input
                  type="number"
                  min="0"
                  value={homeScore}
                  onChange={e => setHomeScore(e.target.value)}
                  className="w-full border-2 border-black p-3 font-bold text-sm focus:outline-none focus:border-[#0077B6] bg-white"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                  Away Score ({awayTeamName})
                </label>
                <input
                  type="number"
                  min="0"
                  value={awayScore}
                  onChange={e => setAwayScore(e.target.value)}
                  className="w-full border-2 border-black p-3 font-bold text-sm focus:outline-none focus:border-[#0077B6] bg-white"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Status</label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                  className="w-full border-2 border-black p-3 font-black uppercase text-sm focus:outline-none focus:border-[#0077B6] bg-white cursor-pointer"
                >
                  <option value="Pending">Pending</option>
                  <option value="Live">Live</option>
                  <option value="Done">Done</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Sport Type</label>
                <div className="flex gap-3 mt-3">
                  <button
                    type="button"
                    onClick={() => setIsFutsal(false)}
                    className={`flex-1 border-2 border-black py-3 font-black uppercase text-xs transition-all ${!isFutsal ? 'bg-[#0077B6] text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]' : 'bg-white text-black hover:bg-gray-50'}`}
                  >
                    Football
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsFutsal(true)}
                    className={`flex-1 border-2 border-black py-3 font-black uppercase text-xs transition-all ${isFutsal ? 'bg-[#06D6A0] text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]' : 'bg-white text-black hover:bg-gray-50'}`}
                  >
                    Futsal
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t-2 border-dashed border-gray-200">
              <button
                onClick={handleSaveMatch}
                disabled={saving}
                className="flex items-center gap-2 border-2 border-black px-8 py-3 font-black uppercase text-sm bg-black text-white hover:bg-[#0077B6] hover:border-[#0077B6] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={16} />
                {saving ? 'Saving...' : 'Save Match Details'}
              </button>
            </div>
          </div>
        </section>

        {/* Lineup Management */}
        <section className="mb-10">
          <h2 className="text-xl font-black uppercase border-b-4 border-black pb-1 mb-6">Lineup Management</h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {[
              { teamId: homeTeamId, teamName: homeTeamName, lineup: homeLineup, colorClass: 'border-t-[#0077B6]' },
              { teamId: awayTeamId, teamName: awayTeamName, lineup: awayLineup, colorClass: 'border-t-[#D90429]' }
            ].map(({ teamId, teamName, lineup, colorClass }) => (
              <div key={teamId} className={`border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] bg-white overflow-hidden border-t-8 ${colorClass}`}>
                <div className="bg-black text-white px-4 py-3 flex items-center justify-between">
                  <h3 className="font-black uppercase text-sm">{teamName}</h3>
                  <span className="text-[10px] font-bold text-gray-400">{lineup.length} players</span>
                </div>

                {/* Existing Lineup */}
                <div className="divide-y divide-gray-100">
                  {lineup.length === 0 ? (
                    <div className="p-6 text-center text-xs font-black uppercase text-gray-300">No players registered</div>
                  ) : (
                    lineup.map(player => (
                      <div key={player.lineup_id} className="p-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-black uppercase truncate block">
                            {player.players?.player_name || 'Unknown Player'}
                          </span>
                        </div>
                        <input
                          type="number"
                          defaultValue={player.jersey_no || ''}
                          placeholder="#"
                          className="w-14 border border-black p-1 text-xs font-bold text-center focus:outline-none"
                          onBlur={e => handleUpdateLineup(player.lineup_id, 'jersey_no', e.target.value ? Number(e.target.value) : null)}
                        />
                        <input
                          type="text"
                          defaultValue={player.position || ''}
                          placeholder="Pos"
                          className="w-14 border border-black p-1 text-xs font-bold text-center uppercase focus:outline-none"
                          onBlur={e => handleUpdateLineup(player.lineup_id, 'position', e.target.value || null)}
                        />
                        <label className="flex items-center gap-1 text-[10px] font-black uppercase cursor-pointer">
                          <input
                            type="checkbox"
                            defaultChecked={player.is_starter}
                            onChange={e => handleUpdateLineup(player.lineup_id, 'is_starter', e.target.checked)}
                            className="accent-black"
                          />
                          Start
                        </label>
                        <button
                          onClick={() => handleDeleteLineup(player.lineup_id)}
                          className="text-[#D90429] hover:text-[#D90429]/60 transition-all"
                          title="Remove player"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Player Form */}
                <div className="border-t-2 border-dashed border-gray-200 p-4 bg-gray-50">
                  <p className="text-[10px] font-black uppercase text-gray-400 mb-3 flex items-center gap-1">
                    <Plus size={10} /> Add Player
                  </p>
                  <div className="flex flex-col gap-2">
                    <select
                      id={`new-player-${teamId}`}
                      className="border-2 border-black p-2 font-bold text-xs focus:outline-none bg-white cursor-pointer"
                      defaultValue=""
                    >
                      <option value="">Select player...</option>
                      {allPlayers.map(p => (
                        <option key={p.player_id} value={p.player_id}>{p.player_name}</option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <input
                        id={`new-jersey-${teamId}`}
                        type="number"
                        placeholder="Jersey #"
                        className="flex-1 border-2 border-black p-2 font-bold text-xs focus:outline-none bg-white"
                      />
                      <input
                        id={`new-position-${teamId}`}
                        type="text"
                        placeholder="Position"
                        className="flex-1 border-2 border-black p-2 font-bold text-xs uppercase focus:outline-none bg-white"
                      />
                      <label className="flex items-center gap-1 text-[10px] font-black uppercase cursor-pointer whitespace-nowrap">
                        <input
                          id={`new-starter-${teamId}`}
                          type="checkbox"
                          defaultChecked
                          className="accent-black"
                        />
                        Starter
                      </label>
                    </div>
                    <button
                      onClick={() => handleAddPlayer(teamId)}
                      className="border-2 border-black px-4 py-2 font-black uppercase text-xs bg-white hover:bg-[#FFD166] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:shadow-none transition-all flex items-center justify-center gap-1"
                    >
                      <Plus size={12} /> Add to Lineup
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Quick Nav */}
        <div className="flex gap-4 items-center pt-4 border-t-2 border-dashed border-gray-200">
          <Link
            href={`/match/${id}`}
            className="border-2 border-black px-6 py-2 font-bold uppercase text-sm bg-white hover:bg-[#FFD166] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-none transition-all"
            target="_blank"
            rel="noopener noreferrer"
          >
            View Public Report ↗
          </Link>
          <Link
            href="/admin/dashboard"
            className="text-xs font-black uppercase text-gray-400 hover:text-black transition-all flex items-center gap-1"
          >
            <ArrowLeft size={12} /> Back to Dashboard
          </Link>
        </div>
      </main>

      <footer className="mt-auto p-6 border-t-4 border-black text-center text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
        CAC Admin Panel
      </footer>
    </div>
  )
}
