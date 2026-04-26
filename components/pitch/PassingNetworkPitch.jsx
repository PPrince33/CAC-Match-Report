'use client'

import { useRef, useEffect, useState, useMemo } from 'react'
import { drawPitchMarkings } from './PitchDrawing'
import { PITCH_CONFIG } from '../../lib/pitchConfig'

const HOME_COLOR = '#0077B6'
const AWAY_COLOR = '#D90429'
const MIN_CONNECTIONS = 2
const NODE_R = 18
const NODE_R_HOVER = 22

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - ax, py - ay)
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

export default function PassingNetworkPitch({ events = [], lineups = [], homeTeamId, isFutsal, teamFilter = 'HOME', selectedPlayerId = null, onSelectPlayer = null }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const sizeRef = useRef({ w: 700, h: 385 })
  const [, setResizeTick] = useState(0)
  const [tooltip, setTooltip] = useState(null)
  const [hoverNode, setHoverNode] = useState(null)
  const [hoverLine, setHoverLine] = useState(null)
  const [playerFilter, setPlayerFilter] = useState('ALL')
  const [selectedPlayers, setSelectedPlayers] = useState(new Set())

  const cfg = isFutsal ? PITCH_CONFIG.futsal : PITCH_CONFIG.football
  const aspect = isFutsal ? 0.55 : 0.67

  const playerMap = useMemo(() => {
    const map = {}
    lineups.forEach(p => {
      map[p.player_id] = {
        name: p.players?.player_name || p.player_name,
        jersey: p.jersey_no,
        teamId: p.team_id,
        startingXI: p.starting_xi ?? false,
      }
    })
    return map
  }, [lineups])

  const teamPlayers = useMemo(() => {
    return lineups.filter(p => teamFilter === 'HOME' ? p.team_id === homeTeamId : p.team_id !== homeTeamId)
  }, [lineups, teamFilter, homeTeamId])

  // When team changes, reset to ALL
  useEffect(() => { setPlayerFilter('ALL'); setSelectedPlayers(new Set()) }, [teamFilter])

  const { connections, positions, passStats, dirPasses } = useMemo(() => {
    const passActions = new Set(['Pass', 'Through Ball'])
    const successOutcomes = new Set(['Successful', 'Assist', 'Key Pass'])
    const incompleteOutcomes = new Set(['Missed', 'Intercepted', 'Off-Side'])

    const connMap = {}
    const pairMap = {}  // key -> { successful, unsuccessful }
    const posMap = {}
    const statsMap = {}

    events.forEach(e => {
      if (!passActions.has(e.action)) return
      if (!e.player_id) return

      const pid = e.player_id
      const isSucc = successOutcomes.has(e.outcome)
      const isInc = incompleteOutcomes.has(e.outcome)

      // Only count passes whose outcome falls in the strict success/incomplete buckets
      if (isSucc || isInc) {
        if (!statsMap[pid]) statsMap[pid] = { total: 0, successful: 0 }
        statsMap[pid].total++
        if (isSucc) statsMap[pid].successful++
      }

      if (!isSucc) return
      if (!e.reaction_player_id) return
      if (e.start_x == null || e.start_y == null) return

      if (!posMap[pid]) posMap[pid] = { sumX: 0, sumY: 0, count: 0, teamId: e.team_id }
      posMap[pid].sumX += e.start_x
      posMap[pid].sumY += e.start_y
      posMap[pid].count++
      if (e.team_id) posMap[pid].teamId = e.team_id

      const key = [pid, e.reaction_player_id].sort().join('|')
      if (!connMap[key]) connMap[key] = { a: pid, b: e.reaction_player_id, count: 0 }
      connMap[key].count++

      // Track directed: pid→receiver
      const dirKey = `${pid}|${e.reaction_player_id}`
      if (!pairMap[dirKey]) pairMap[dirKey] = 0
      pairMap[dirKey]++
    })

    const avgPos = {}
    Object.entries(posMap).forEach(([pid, d]) => {
      avgPos[pid] = { x: d.sumX / d.count, y: d.sumY / d.count, teamId: d.teamId }
    })

    return {
      connections: Object.values(connMap).filter(c => c.count >= MIN_CONNECTIONS),
      positions: avgPos,
      passStats: statsMap,
      dirPasses: pairMap
    }
  }, [events])

  const isVisible = (pid) => {
    const p = playerMap[pid]
    if (!p) return false
    if (teamFilter === 'HOME' && p.teamId !== homeTeamId) return false
    if (teamFilter === 'AWAY' && p.teamId === homeTeamId) return false
    if (playerFilter === 'XI' && !p.startingXI) return false
    if (playerFilter === 'CUSTOM' && !selectedPlayers.has(pid)) return false
    return true
  }

  // Resize observer → re-render on container width change
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const ro = new ResizeObserver(() => setResizeTick(t => t + 1))
    ro.observe(container)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const ctx = canvas.getContext('2d')

    // Compute logical CSS pixel size from container
    const dpr = window.devicePixelRatio || 1
    const cssW = Math.max(320, container.clientWidth)
    const cssH = Math.round(cssW * aspect)

    // Backing store at DPR for sharp output
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    canvas.style.width = cssW + 'px'
    canvas.style.height = cssH + 'px'
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    sizeRef.current = { w: cssW, h: cssH }
    const w = cssW
    const h = cssH

    drawPitchMarkings(ctx, w, h, isFutsal, PITCH_CONFIG)

    const pad = 30
    const drawW = w - pad * 2
    const drawH = h - pad * 2
    const scaleX = x => pad + (x / cfg.width) * drawW
    const scaleY = y => h - (pad + (y / cfg.height) * drawH)
    const maxCount = Math.max(...connections.map(c => c.count), 1)

    connections.forEach(({ a, b, count }) => {
      if (!positions[a] || !positions[b]) return
      if (!isVisible(a) || !isVisible(b)) return
      const aHome = playerMap[a]?.teamId === homeTeamId
      const bHome = playerMap[b]?.teamId === homeTeamId
      if (aHome !== bHome) return

      const isHL = hoverLine && ((hoverLine.a === a && hoverLine.b === b) || (hoverLine.a === b && hoverLine.b === a))
      const lineW = isHL ? 8 + (count / maxCount) * 8 : 2.5 + (count / maxCount) * 9
      const alpha = isHL ? 1 : 0.35 + (count / maxCount) * 0.6
      const color = aHome ? HOME_COLOR : AWAY_COLOR

      ctx.beginPath()
      ctx.moveTo(scaleX(positions[a].x), scaleY(positions[a].y))
      ctx.lineTo(scaleX(positions[b].x), scaleY(positions[b].y))
      ctx.strokeStyle = isHL ? color : color + Math.round(alpha * 255).toString(16).padStart(2, '0')
      ctx.lineWidth = lineW
      ctx.stroke()
    })

    Object.entries(positions).forEach(([pid, pos]) => {
      if (!isVisible(pid)) return
      const player = playerMap[pid]
      if (!player) return
      const isHome = player.teamId === homeTeamId
      const color = isHome ? HOME_COLOR : AWAY_COLOR
      const cx = scaleX(pos.x)
      const cy = scaleY(pos.y)
      const isHN = hoverNode === pid
      const isSel = selectedPlayerId === pid
      const r = isHN || isSel ? NODE_R_HOVER : NODE_R

      // Selected ring (under fill)
      if (isSel) {
        ctx.beginPath()
        ctx.arc(cx, cy, r + 5, 0, Math.PI * 2)
        ctx.strokeStyle = '#FFD166'
        ctx.lineWidth = 4
        ctx.stroke()
      }

      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fillStyle = isHN ? '#FFD166' : (isSel ? '#000' : color)
      ctx.fill()
      ctx.strokeStyle = isSel ? '#FFD166' : '#000'
      ctx.lineWidth = isHN || isSel ? 4 : 3
      ctx.stroke()

      ctx.fillStyle = isHN ? '#000' : '#fff'
      ctx.font = `bold ${Math.round(r * 0.75)}px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(player.jersey, cx, cy)
    })
  }, [connections, positions, isFutsal, cfg, playerMap, homeTeamId, teamFilter, hoverNode, hoverLine, playerFilter, selectedPlayers, selectedPlayerId])

  const getCanvasCoords = (mx, my) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const { w, h } = sizeRef.current
    const pad = 30
    const drawW = w - pad * 2
    const drawH = h - pad * 2
    return {
      cx: mx - rect.left,
      cy: my - rect.top,
      scaleX: x => pad + (x / cfg.width) * drawW,
      scaleY: y => h - (pad + (y / cfg.height) * drawH)
    }
  }

  const handleMouseMove = (e) => {
    const coords = getCanvasCoords(e.clientX, e.clientY)
    if (!coords) return
    const { cx, cy, scaleX, scaleY } = coords

    // Node hover
    for (const [pid, pos] of Object.entries(positions)) {
      if (!isVisible(pid)) continue
      if (Math.hypot(scaleX(pos.x) - cx, scaleY(pos.y) - cy) < NODE_R_HOVER) {
        setHoverNode(pid); setHoverLine(null)
        const player = playerMap[pid]
        const s = passStats[pid] || { total: 0, successful: 0 }
        const miss = s.total - s.successful
        const rate = s.total > 0 ? Math.round((s.successful / s.total) * 100) : 0
        setTooltip({ type: 'node', name: player?.name, jersey: player?.jersey, total: s.total, successful: s.successful, miss, rate, x: e.clientX, y: e.clientY })
        return
      }
    }

    // Line hover
    let foundLine = null, minDist = Infinity
    for (const conn of connections) {
      const { a, b } = conn
      if (!positions[a] || !positions[b]) continue
      if (!isVisible(a) || !isVisible(b)) continue
      const aHome = playerMap[a]?.teamId === homeTeamId
      const bHome = playerMap[b]?.teamId === homeTeamId
      if (aHome !== bHome) continue
      const d = distToSegment(cx, cy, scaleX(positions[a].x), scaleY(positions[a].y), scaleX(positions[b].x), scaleY(positions[b].y))
      if (d < 12 && d < minDist) { minDist = d; foundLine = conn }
    }

    if (foundLine) {
      setHoverNode(null); setHoverLine(foundLine)
      const pa = playerMap[foundLine.a]
      const pb = playerMap[foundLine.b]
      const sa = passStats[foundLine.a] || { total: 0, successful: 0 }
      const sb = passStats[foundLine.b] || { total: 0, successful: 0 }
      // Directed: A→B and B→A
      const aToB = dirPasses[`${foundLine.a}|${foundLine.b}`] || 0
      const bToA = dirPasses[`${foundLine.b}|${foundLine.a}`] || 0
      // Success rate between pair = passes between them / total passes of each
      const rateAtoB = sa.total > 0 ? Math.round((aToB / sa.total) * 100) : 0
      const rateBtoA = sb.total > 0 ? Math.round((bToA / sb.total) * 100) : 0
      // Overall individual pass accuracy
      const accA = sa.total > 0 ? Math.round((sa.successful / sa.total) * 100) : 0
      const accB = sb.total > 0 ? Math.round((sb.successful / sb.total) * 100) : 0
      setTooltip({
        type: 'line',
        nameA: pa?.name, jerseyA: pa?.jersey,
        nameB: pb?.name, jerseyB: pb?.jersey,
        aToB, bToA, total: foundLine.count,
        rateAtoB, rateBtoA, accA, accB,
        x: e.clientX, y: e.clientY
      })
    } else {
      setHoverNode(null); setHoverLine(null); setTooltip(null)
    }
  }

  const handleMouseLeave = () => { setHoverNode(null); setHoverLine(null); setTooltip(null) }

  const handleClick = (e) => {
    if (!onSelectPlayer) return
    const coords = getCanvasCoords(e.clientX, e.clientY)
    if (!coords) return
    const { cx, cy, scaleX, scaleY } = coords
    for (const [pid, pos] of Object.entries(positions)) {
      if (!isVisible(pid)) continue
      if (Math.hypot(scaleX(pos.x) - cx, scaleY(pos.y) - cy) < NODE_R_HOVER) {
        onSelectPlayer(pid === selectedPlayerId ? null : pid)
        return
      }
    }
    if (selectedPlayerId) onSelectPlayer(null) // click empty space deselects
  }

  const togglePlayer = (pid) => {
    setSelectedPlayers(prev => {
      const next = new Set(prev)
      next.has(pid) ? next.delete(pid) : next.add(pid)
      return next
    })
  }

  const color = teamFilter === 'HOME' ? HOME_COLOR : AWAY_COLOR

  return (
    <div>
      {/* Player filter row */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {['ALL', 'XI', 'CUSTOM'].map(f => (
          <button key={f} onClick={() => setPlayerFilter(f)}
            className={`text-[10px] font-black uppercase border-2 border-black px-3 py-1 transition-all ${playerFilter === f ? 'bg-black text-white' : 'bg-white text-black hover:bg-[#FFD166]'}`}>
            {f === 'ALL' ? 'All' : f === 'XI' ? 'Starting XI' : 'Select Players'}
          </button>
        ))}
      </div>

      {/* Player selection grid — shown when CUSTOM */}
      {playerFilter === 'CUSTOM' && (
        <div className="border-2 border-black p-3 mb-3 bg-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase text-gray-500">Select players to display</span>
            <div className="flex gap-1">
              <button onClick={() => setSelectedPlayers(new Set(teamPlayers.map(p => p.player_id)))} className="text-[9px] font-bold uppercase border px-1.5 py-0.5 hover:bg-[#FFD166]">All</button>
              <button onClick={() => setSelectedPlayers(new Set(teamPlayers.filter(p => p.starting_xi).map(p => p.player_id)))} className="text-[9px] font-bold uppercase border px-1.5 py-0.5 hover:bg-[#FFD166]">XI</button>
              <button onClick={() => setSelectedPlayers(new Set())} className="text-[9px] font-bold uppercase border px-1.5 py-0.5 hover:bg-gray-100">None</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {teamPlayers.map(p => {
              const active = selectedPlayers.has(p.player_id)
              return (
                <button key={p.player_id} onClick={() => togglePlayer(p.player_id)}
                  title={`${p.player_name}${p.starting_xi ? ' (Starter)' : ' (Sub)'}`}
                  className={`text-[10px] font-bold border-2 px-2 py-0.5 transition-all ${active ? 'text-white border-transparent' : 'bg-white text-black border-black hover:bg-gray-100'} ${!p.starting_xi ? 'border-dashed opacity-70' : ''}`}
                  style={active ? { backgroundColor: color, borderColor: color } : {}}>
                  #{p.jersey_no}{p.starting_xi ? '' : '°'}
                </button>
              )
            })}
          </div>
          <p className="text-[9px] text-gray-400 font-bold mt-2 uppercase">Solid = Starter · Dashed + ° = Sub</p>
        </div>
      )}

      <div className="relative" ref={containerRef}>
        <canvas ref={canvasRef}
          className="block border-4 border-black"
          style={{ cursor: (hoverNode || hoverLine) ? 'pointer' : 'default' }}
          onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} onClick={handleClick} />

        {tooltip && (
          <div className="fixed z-50 bg-black text-white text-[10px] font-black uppercase px-3 py-2 border-2 border-[#FFD166] pointer-events-none shadow-[4px_4px_0px_0px_#FFD166] min-w-[170px]"
            style={{ left: tooltip.x + 14, top: tooltip.y - 80 }}>
            {tooltip.type === 'node' ? (
              <>
                <div className="text-[#FFD166] text-[11px] mb-1.5">#{tooltip.jersey} {tooltip.name}</div>
                <div className="flex justify-between gap-4"><span>Total</span><span className="text-[#FFD166]">{tooltip.total}</span></div>
                <div className="flex justify-between gap-4"><span>Successful</span><span className="text-[#06D6A0]">{tooltip.successful}</span></div>
                <div className="flex justify-between gap-4"><span>Missed</span><span className="text-[#FF4D4D]">{tooltip.miss}</span></div>
                <div className="flex justify-between gap-4 border-t border-gray-600 mt-1 pt-1"><span>Success Rate</span><span className="text-[#FFD166]">{tooltip.rate}%</span></div>
              </>
            ) : (
              <>
                <div className="text-[#FFD166] text-[11px] mb-1.5">#{tooltip.jerseyA} {tooltip.nameA} ↔ #{tooltip.jerseyB} {tooltip.nameB}</div>
                <div className="text-gray-300 text-[9px] uppercase mb-1">Total passes: <span className="text-white">{tooltip.total}</span></div>
                <div className="border-t border-gray-600 pt-1 space-y-0.5">
                  <div className="flex justify-between gap-3">
                    <span>#{tooltip.jerseyA}→#{tooltip.jerseyB}</span>
                    <span><span className="text-[#06D6A0]">{tooltip.aToB}</span> passes · <span className="text-[#FFD166]">{tooltip.rateAtoB}%</span> of #{tooltip.jerseyA}'s</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>#{tooltip.jerseyB}→#{tooltip.jerseyA}</span>
                    <span><span className="text-[#06D6A0]">{tooltip.bToA}</span> passes · <span className="text-[#FFD166]">{tooltip.rateBtoA}%</span> of #{tooltip.jerseyB}'s</span>
                  </div>
                  <div className="border-t border-gray-600 mt-1 pt-1 text-gray-300 text-[9px] uppercase">Overall accuracy</div>
                  <div className="flex justify-between gap-3"><span>#{tooltip.jerseyA}</span><span className="text-[#FFD166]">{tooltip.accA}%</span></div>
                  <div className="flex justify-between gap-3"><span>#{tooltip.jerseyB}</span><span className="text-[#FFD166]">{tooltip.accB}%</span></div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
