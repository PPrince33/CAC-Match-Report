'use client'

import { useMemo, useState } from 'react'

const PASS_SUCCESS = new Set(['Successful', 'Key Pass', 'Assist'])

/**
 * PlayerPassMatrix
 *
 *  Rows  = passers (players from `teamId`)
 *  Cols  = receivers (players from `teamId`)
 *  Cells = count of successful Pass / Through Ball events between the pair
 *
 * Hover any cell to see the list of those passes (minute + outcome).
 */
export default function PlayerPassMatrix({
  events = [],
  lineups = [],
  teamId,
  teamColor = '#0077B6',
  teamName = 'Team',
}) {
  const [hoverCell, setHoverCell] = useState(null)

  const lineupById = useMemo(() => {
    const m = {}
    lineups.forEach(l => { m[l.player_id] = l })
    return m
  }, [lineups])

  const { matrix, details } = useMemo(() => {
    const m = {}
    const dt = {}
    events.forEach(e => {
      if (!['Pass', 'Through Ball'].includes(e.action)) return
      if (!PASS_SUCCESS.has(e.outcome)) return
      if (!e.player_id || !e.reaction_player_id) return
      const passerLU = lineupById[e.player_id]
      const recvLU = lineupById[e.reaction_player_id]
      if (!passerLU || !recvLU) return
      if (passerLU.team_id !== teamId || recvLU.team_id !== teamId) return

      if (!m[e.player_id]) m[e.player_id] = {}
      m[e.player_id][e.reaction_player_id] = (m[e.player_id][e.reaction_player_id] || 0) + 1

      if (!dt[e.player_id]) dt[e.player_id] = {}
      if (!dt[e.player_id][e.reaction_player_id]) dt[e.player_id][e.reaction_player_id] = []
      const minute = e.match_minute ?? (e.match_time_seconds != null ? Math.floor(e.match_time_seconds / 60) : null)
      dt[e.player_id][e.reaction_player_id].push({ minute, outcome: e.outcome, action: e.action })
    })
    return { matrix: m, details: dt }
  }, [events, lineupById, teamId])

  const { rowPlayers, colPlayers, maxCount, totalEvents } = useMemo(() => {
    const rowSet = new Set(), colSet = new Set()
    let max = 0, total = 0
    Object.entries(matrix).forEach(([pId, recs]) => {
      Object.entries(recs).forEach(([rId, c]) => {
        rowSet.add(pId); colSet.add(rId); total += c
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
    const hex = teamColor.replace('#', '')
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  if (rowPlayers.length === 0 || colPlayers.length === 0) {
    return (
      <div className="border-4 border-dashed border-[#D6DBD3] p-6 text-center text-[10px] font-black uppercase text-[#9AA397]">
        No completed passes for {teamName} in current filter range
      </div>
    )
  }

  return (
    <div className="border-4 border-line bg-white">
      <div className="px-3 py-2 border-b-2 border-line text-white text-[11px] font-black uppercase flex items-center justify-between" style={{ backgroundColor: teamColor }}>
        <span>{teamName}</span>
        <span className="opacity-90 normal-case">passer → receiver</span>
      </div>
      <div className="px-3 py-1.5 text-[9px] font-bold uppercase text-[#5B6359] border-b border-[#D6DBD3]">
        {totalEvents} completed passes · max {maxCount} per pair
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] font-black uppercase">
          <thead>
            <tr className="bg-[#F0F2EE] border-b-2 border-line">
              <th className="px-2 py-1 text-left text-[#5B6359] sticky left-0 bg-[#F0F2EE] z-10">Passer ↓ / Receiver →</th>
              {colPlayers.map(p => (
                <th key={p.player_id} className="px-1.5 py-1 text-center min-w-[34px]" style={{ color: teamColor }} title={p.players?.player_name}>
                  #{p.jersey_no}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowPlayers.map(rp => (
              <tr key={rp.player_id} className="border-b border-[#D6DBD3]">
                <th className="px-2 py-1 text-left sticky left-0 bg-white z-10 border-r border-[#D6DBD3]" style={{ color: teamColor }}>
                  <div className="flex items-center gap-1.5">
                    <span className="px-1 border" style={{ borderColor: teamColor }}>#{rp.jersey_no}</span>
                    <span className="truncate max-w-[110px]" title={rp.players?.player_name}>{rp.players?.player_name}</span>
                  </div>
                </th>
                {colPlayers.map(cp => {
                  const c = matrix[rp.player_id]?.[cp.player_id] || 0
                  const isSelf = rp.player_id === cp.player_id
                  const isHover = hoverCell?.row === rp.player_id && hoverCell?.col === cp.player_id
                  return (
                    <td
                      key={cp.player_id}
                      className={`px-1 py-1 text-center min-w-[34px] cursor-default transition-colors ${isHover ? 'outline outline-2 outline-black' : ''} ${isSelf ? 'bg-[#F0F2EE] text-[#9AA397]' : ''}`}
                      style={{ backgroundColor: isSelf ? undefined : cellBg(c) }}
                      onMouseEnter={() => setHoverCell({ row: rp.player_id, col: cp.player_id, count: c, passerName: rp.players?.player_name, recvName: cp.players?.player_name })}
                      onMouseLeave={() => setHoverCell(null)}
                    >
                      {isSelf ? '–' : (c > 0 ? c : '')}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hoverCell && hoverCell.count > 0 && (
        <div className="px-3 py-2 border-t-2 border-line bg-black text-white text-[10px] font-bold uppercase">
          <div className="flex items-center gap-2 border-b border-white/20 pb-1 mb-1.5">
            <span style={{ color: '#6BDB58' }} className="text-sm">{hoverCell.count}</span>
            <span>{hoverCell.passerName} → {hoverCell.recvName}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {(details[hoverCell.row]?.[hoverCell.col] || [])
              .slice()
              .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0))
              .map((d, i) => (
                <span key={i} className="border border-white/30 px-1.5 py-0.5 bg-white/10 normal-case">
                  <span className="text-[#6BDB58]">{d.minute != null ? `${d.minute}'` : '?'}</span>
                  {' '}{d.action}{d.outcome !== 'Successful' ? ` · ${d.outcome}` : ''}
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
