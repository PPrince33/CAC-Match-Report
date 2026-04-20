'use client'

import { useRef, useEffect, useState, useMemo } from 'react'
import { drawPitchMarkings } from './PitchDrawing'
import { PITCH_CONFIG } from '../../lib/pitchConfig'

const HOME_COLOR = '#0077B6'
const AWAY_COLOR = '#D90429'
const MIN_CONNECTIONS = 2

export default function PassingNetworkPitch({ events = [], lineups = [], homeTeamId, isFutsal, teamFilter = 'ALL' }) {
  const canvasRef = useRef(null)
  const [tooltip, setTooltip] = useState(null)
  const [hoverNode, setHoverNode] = useState(null)

  const cfg = isFutsal ? PITCH_CONFIG.futsal : PITCH_CONFIG.football

  const playerMap = useMemo(() => {
    const map = {}
    lineups.forEach(p => {
      map[p.player_id] = { name: p.player_name, jersey: p.jersey_no, teamId: p.team_id }
    })
    return map
  }, [lineups])

  const { connections, positions } = useMemo(() => {
    const passActions = new Set(['Pass', 'Through Ball'])
    const successOutcomes = new Set(['Successful', 'Assist', 'Key Pass'])

    const connMap = {}
    const posMap = {}

    events.forEach(e => {
      if (!passActions.has(e.action)) return
      if (!successOutcomes.has(e.outcome)) return
      if (!e.player_id || !e.reaction_player_id) return
      if (e.start_x == null || e.start_y == null) return

      const passer = e.player_id
      const receiver = e.reaction_player_id

      // accumulate positions
      if (!posMap[passer]) posMap[passer] = { sumX: 0, sumY: 0, count: 0, teamId: e.team_id }
      posMap[passer].sumX += e.start_x
      posMap[passer].sumY += e.start_y
      posMap[passer].count++
      if (e.team_id) posMap[passer].teamId = e.team_id

      // accumulate connections (undirected — use sorted key)
      const key = [passer, receiver].sort().join('|')
      if (!connMap[key]) connMap[key] = { a: passer, b: receiver, count: 0 }
      connMap[key].count++
    })

    const avgPos = {}
    Object.entries(posMap).forEach(([pid, d]) => {
      avgPos[pid] = { x: d.sumX / d.count, y: d.sumY / d.count, teamId: d.teamId }
    })

    const conns = Object.values(connMap).filter(c => c.count >= MIN_CONNECTIONS)
    return { connections: conns, positions: avgPos }
  }, [events])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const w = canvas.width
    const h = canvas.height

    drawPitchMarkings(ctx, w, h, isFutsal, PITCH_CONFIG)

    const pad = 30
    const drawW = w - pad * 2
    const drawH = h - pad * 2
    const scaleX = x => pad + (x / cfg.width) * drawW
    const scaleY = y => h - (pad + (y / cfg.height) * drawH)

    const maxCount = Math.max(...connections.map(c => c.count), 1)

    const isVisible = (pid) => {
      const p = playerMap[pid]
      if (!p) return false
      if (teamFilter === 'HOME') return p.teamId === homeTeamId
      if (teamFilter === 'AWAY') return p.teamId !== homeTeamId
      return true
    }

    // Draw connection lines
    connections.forEach(({ a, b, count }) => {
      if (!positions[a] || !positions[b]) return
      if (!isVisible(a) || !isVisible(b)) return
      const pa = positions[a]
      const pb = positions[b]
      const aTeam = playerMap[a]?.teamId === homeTeamId
      const bTeam = playerMap[b]?.teamId === homeTeamId
      const sameTeam = aTeam === bTeam
      if (!sameTeam) return

      const lineW = 1 + (count / maxCount) * 7
      const alpha = 0.25 + (count / maxCount) * 0.65
      const color = aTeam ? HOME_COLOR : AWAY_COLOR

      ctx.beginPath()
      ctx.moveTo(scaleX(pa.x), scaleY(pa.y))
      ctx.lineTo(scaleX(pb.x), scaleY(pb.y))
      ctx.strokeStyle = color + Math.round(alpha * 255).toString(16).padStart(2, '0')
      ctx.lineWidth = lineW
      ctx.stroke()
    })

    // Draw player nodes
    Object.entries(positions).forEach(([pid, pos]) => {
      if (!isVisible(pid)) return
      const player = playerMap[pid]
      if (!player) return
      const isHome = player.teamId === homeTeamId
      const color = isHome ? HOME_COLOR : AWAY_COLOR
      const cx = scaleX(pos.x)
      const cy = scaleY(pos.y)
      const r = hoverNode === pid ? 16 : 13

      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
      ctx.strokeStyle = '#000'
      ctx.lineWidth = 2
      ctx.stroke()

      ctx.fillStyle = '#fff'
      ctx.font = `bold ${r < 14 ? 9 : 10}px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(player.jersey, cx, cy)
    })
  }, [connections, positions, isFutsal, cfg, playerMap, homeTeamId, teamFilter, hoverNode])

  const getNodeAt = (mx, my) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const scaleXFactor = canvas.width / rect.width
    const scaleYFactor = canvas.height / rect.height
    const cx = (mx - rect.left) * scaleXFactor
    const cy = (my - rect.top) * scaleYFactor
    const pad = 30
    const drawW = canvas.width - pad * 2
    const drawH = canvas.height - pad * 2
    const scaleX = x => pad + (x / cfg.width) * drawW
    const scaleY = y => canvas.height - (pad + (y / cfg.height) * drawH)

    for (const [pid, pos] of Object.entries(positions)) {
      const dx = scaleX(pos.x) - cx
      const dy = scaleY(pos.y) - cy
      if (Math.sqrt(dx * dx + dy * dy) < 16) return pid
    }
    return null
  }

  const handleMouseMove = (e) => {
    const pid = getNodeAt(e.clientX, e.clientY)
    setHoverNode(pid)
    if (pid) {
      const player = playerMap[pid]
      const pos = positions[pid]
      const connectCount = connections.filter(c => (c.a === pid || c.b === pid)).reduce((s, c) => s + c.count, 0)
      setTooltip({ pid, name: player?.name, jersey: player?.jersey, x: e.clientX, y: e.clientY, passes: connectCount })
    } else {
      setTooltip(null)
    }
  }

  const handleMouseLeave = () => {
    setHoverNode(null)
    setTooltip(null)
  }

  const totalNodes = Object.keys(positions).filter(pid => {
    const p = playerMap[pid]
    if (!p) return false
    if (teamFilter === 'HOME') return p.teamId === homeTeamId
    if (teamFilter === 'AWAY') return p.teamId !== homeTeamId
    return true
  }).length

  if (totalNodes === 0) {
    return (
      <div className="border-4 border-black p-8 text-center font-black uppercase text-gray-400">
        No passing network data available
      </div>
    )
  }

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={700}
        height={isFutsal ? 385 : 469}
        className="w-full border-4 border-black"
        style={{ cursor: hoverNode ? 'pointer' : 'default' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
      {tooltip && (
        <div
          className="fixed z-50 bg-black text-white text-[10px] font-black uppercase px-3 py-2 border-2 border-[#FFD166] pointer-events-none shadow-[4px_4px_0px_0px_#FFD166]"
          style={{ left: tooltip.x + 12, top: tooltip.y - 40 }}
        >
          #{tooltip.jersey} {tooltip.name}<br />
          <span className="text-[#FFD166]">{tooltip.passes} connected passes</span>
        </div>
      )}
    </div>
  )
}
