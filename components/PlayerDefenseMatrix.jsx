'use client'

import { useMemo, useState } from 'react'

/**
 * PlayerDefenseMatrix
 *
 *  Rows  = defenders (players from `defenderTeamId`)
 *  Cols  = attackers (players from `attackerTeamId`)
 *  Cells = count of qualifying events between the pair
 *
 * `events` is the already-enriched event list. The `actionFilter` determines
 * which events count and how to map (defender, opponent) ids onto each event:
 *   - standard defensive actions → defender = player_id, opponent = reaction_player_id
 *   - 'Ball Control' → opponent = player_id (loser), defender = reaction_player_id (gainer)
 *   - 'Ground Duels' → tackles that won possession (Successful + With Possession)
 *   - 'Aerial Duels' → uses the precomputed list of matched header-intercept duels
 */
export default function PlayerDefenseMatrix({
  events = [],
  lineups = [],
  defenderTeamId,
  attackerTeamId,
  actionFilter = 'ALL',
  aerialMatches = [],
  defenderColor = '#0077B6',
  defenderTeamName = 'Home',
  attackerTeamName = 'Away',
}) {
  const [hoverCell, setHoverCell] = useState(null) // { row, col, count, defName, attName }

  const lineupById = useMemo(() => {
    const m = {}
    lineups.forEach(l => { m[l.player_id] = l })
    return m
  }, [lineups])

  const matrix = useMemo(() => {
    const m = {}     // defender_id -> { attacker_id -> count }
    const teamOf = (pid) => lineupById[pid]?.team_id

    const add = (defId, attId) => {
      if (!defId || !attId) return
      if (teamOf(defId) !== defenderTeamId) return
      if (teamOf(attId) !== attackerTeamId) return
      if (!m[defId]) m[defId] = {}
      m[defId][attId] = (m[defId][attId] || 0) + 1
    }

    // Iterate the appropriate event subset based on the filter
    const STANDARD_ACTIONS = ['Pass Intercept', 'Standing Tackle', 'Sliding Tackle', 'Block', 'Save', 'Clearance', 'Discipline', 'Pressure']

    if (actionFilter === 'Aerial Duels') {
      aerialMatches.forEach(d => add(d.defenderId, d.opponentId))
    } else if (actionFilter === 'Ground Duels') {
      // Tackles that won possession
      events.forEach(e => {
        if (!['Standing Tackle', 'Sliding Tackle'].includes(e.action)) return
        if (e.outcome !== 'Successful' || e.type !== 'With Possession') return
        add(e.player_id, e.reaction_player_id)
      })
    } else if (actionFilter === 'Ball Control') {
      // Loser = player_id (on attacker team), Gainer = reaction_player_id (on defender team)
      events.forEach(e => {
        if (e.action !== 'Ball Control') return
        add(e.reaction_player_id, e.player_id)
      })
    } else if (actionFilter === 'ALL') {
      events.forEach(e => {
        if (STANDARD_ACTIONS.includes(e.action)) {
          add(e.player_id, e.reaction_player_id)
        } else if (e.action === 'Ball Control') {
          add(e.reaction_player_id, e.player_id)
        }
      })
    } else if (STANDARD_ACTIONS.includes(actionFilter)) {
      events.forEach(e => {
        if (e.action !== actionFilter) return
        add(e.player_id, e.reaction_player_id)
      })
    }

    return m
  }, [events, lineupById, defenderTeamId, attackerTeamId, actionFilter, aerialMatches])

  // Players with at least one event in this matrix, sorted by jersey
  const { rowPlayers, colPlayers, maxCount, totalEvents } = useMemo(() => {
    const rowSet = new Set(), colSet = new Set()
    let max = 0, total = 0
    Object.entries(matrix).forEach(([dId, atts]) => {
      Object.entries(atts).forEach(([aId, c]) => {
        rowSet.add(dId); colSet.add(aId); total += c
        if (c > max) max = c
      })
    })
    const sortByJersey = (a, b) => (a.jersey_no || 99) - (b.jersey_no || 99)
    const rows = [...rowSet].map(id => lineupById[id]).filter(Boolean).sort(sortByJersey)
    const cols = [...colSet].map(id => lineupById[id]).filter(Boolean).sort(sortByJersey)
    return { rowPlayers: rows, colPlayers: cols, maxCount: max, totalEvents: total }
  }, [matrix, lineupById])

  const cellBg = (count) => {
    if (!count || maxCount === 0) return ''
    const alpha = 0.15 + (count / maxCount) * 0.65
    // hex → rgba
    const hex = defenderColor.replace('#', '')
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  if (rowPlayers.length === 0 || colPlayers.length === 0) {
    return (
      <div className="border-4 border-dashed border-gray-200 p-6 text-center text-[10px] font-black uppercase text-gray-400">
        No {actionFilter === 'ALL' ? 'defensive' : actionFilter.toLowerCase()} events from {defenderTeamName} against {attackerTeamName} players for this filter
      </div>
    )
  }

  return (
    <div className="border-4 border-black bg-white">
      <div className={`px-3 py-2 border-b-2 border-black text-white text-[11px] font-black uppercase flex items-center justify-between`} style={{ backgroundColor: defenderColor }}>
        <span>{defenderTeamName} Defense</span>
        <span className="opacity-90">vs</span>
        <span>{attackerTeamName} Attack</span>
      </div>
      <div className="px-3 py-1.5 text-[9px] font-bold uppercase text-gray-500 border-b border-gray-200">
        {totalEvents} events · max {maxCount} per pair
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] font-black uppercase">
          <thead>
            <tr className="bg-gray-50 border-b-2 border-black">
              <th className="px-2 py-1 text-left text-gray-500 sticky left-0 bg-gray-50 z-10">Defender ↓ / Attacker →</th>
              {colPlayers.map(p => (
                <th key={p.player_id} className="px-1.5 py-1 text-center text-[#D90429] min-w-[34px]" title={p.players?.player_name}>
                  #{p.jersey_no}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowPlayers.map(rp => (
              <tr key={rp.player_id} className="border-b border-gray-100">
                <th className="px-2 py-1 text-left sticky left-0 bg-white z-10 border-r border-gray-200" style={{ color: defenderColor }}>
                  <div className="flex items-center gap-1.5">
                    <span className="px-1 border" style={{ borderColor: defenderColor }}>#{rp.jersey_no}</span>
                    <span className="truncate max-w-[110px]" title={rp.players?.player_name}>{rp.players?.player_name}</span>
                  </div>
                </th>
                {colPlayers.map(cp => {
                  const c = matrix[rp.player_id]?.[cp.player_id] || 0
                  const isHover = hoverCell?.row === rp.player_id && hoverCell?.col === cp.player_id
                  return (
                    <td
                      key={cp.player_id}
                      className={`px-1 py-1 text-center min-w-[34px] cursor-default transition-colors ${isHover ? 'outline outline-2 outline-black' : ''}`}
                      style={{ backgroundColor: cellBg(c) }}
                      onMouseEnter={() => setHoverCell({ row: rp.player_id, col: cp.player_id, count: c, defName: rp.players?.player_name, attName: cp.players?.player_name })}
                      onMouseLeave={() => setHoverCell(null)}
                    >
                      {c > 0 ? c : ''}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hoverCell && hoverCell.count > 0 && (
        <div className="px-3 py-2 border-t-2 border-black bg-black text-white text-[10px] font-bold uppercase">
          <span style={{ color: '#FFD166' }}>{hoverCell.count}</span> · {hoverCell.defName} → {hoverCell.attName}
        </div>
      )}
    </div>
  )
}
