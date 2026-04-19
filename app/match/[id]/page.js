'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { fetchSupabase } from '../../../lib/supabase.js'
import { PITCH_CONFIG } from '../../../lib/pitchConfig.js'
import { calculateXG } from '../../../lib/xg.js'
import { CAC_LOGIC } from '../../../lib/cacLogic.js'
import { STATS_REGISTRY, STATS_CONFIG } from '../../../lib/statsRegistry.js'
import BrutalistCard from '../../../components/ui/BrutalistCard.jsx'
import BrutalistButton from '../../../components/ui/BrutalistButton.jsx'
import CompareRow from '../../../components/ui/CompareRow.jsx'
import DistributionPitch from '../../../components/pitch/DistributionPitch.jsx'
import AveragePositionsPitch from '../../../components/pitch/AveragePositionsPitch.jsx'
import ShotMapPitch from '../../../components/pitch/ShotMapPitch.jsx'
import ShotPlacementPitch from '../../../components/pitch/ShotPlacementPitch.jsx'
import HeatmapPitch from '../../../components/pitch/HeatmapPitch.jsx'
import HighlightsPitch from '../../../components/pitch/HighlightsPitch.jsx'
import RadarChart from '../../../components/RadarChart.jsx'
import LeaderCard from '../../../components/LeaderCard.jsx'
import TeamSheetSide from '../../../components/TeamSheetSide.jsx'
import {
  ChevronLeft, Activity, Map as MapIcon, Target, Shield, Users, Video, Edit3,
  Filter, Layers, Clock, RefreshCw
} from 'lucide-react'

const renderStatRows = (sectionKey, homeStats, awayStats) => {
  if (!homeStats || !awayStats) return null
  return (STATS_CONFIG[sectionKey] || [])
    .filter(e => e.enabled)
    .sort((a, b) => a.order - b.order)
    .map(e => {
      const def = STATS_REGISTRY[e.id]
      if (!def) return null
      return (
        <CompareRow
          key={e.id}
          label={def.label}
          homeVal={def.getH(homeStats)}
          awayVal={def.getA(awayStats)}
          highlight={def.highlight || false}
        />
      )
    })
}

export default function MatchReportPage() {
  const params = useParams()
  const matchId = params.id

  const [match, setMatch] = useState(null)
  const [events, setEvents] = useState([])
  const [lineups, setLineups] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('SUMMARY')

  // Distribution filters
  const [distTeam, setDistTeam] = useState('ALL')
  const [distPlayer, setDistPlayer] = useState('ALL')
  const [distAction, setDistAction] = useState('ALL')
  const [distOutcome, setDistOutcome] = useState('ALL')
  const [distType, setDistType] = useState('ALL')
  const [distZone, setDistZone] = useState('ALL')
  const [minMinute, setMinMinute] = useState(0)
  const [maxMinute, setMaxMinute] = useState(90)

  // Average positions state
  const [avgStatType, setAvgStatType] = useState('ALL_ACTIONS')
  const [avgMinMinute, setAvgMinMinute] = useState(0)
  const [avgMaxMinute, setAvgMaxMinute] = useState(90)
  const [avgHomePlayers, setAvgHomePlayers] = useState([])
  const [avgAwayPlayers, setAvgAwayPlayers] = useState([])
  const [avgStartingXIOnly, setAvgStartingXIOnly] = useState(false)

  // Defense heatmap state
  const [defActionFilter, setDefActionFilter] = useState('ALL')
  const [defOutcomeFilter, setDefOutcomeFilter] = useState('ALL')
  const defActions = useMemo(() => ['Standing Tackle', 'Sliding Tackle', 'Block', 'Save', 'Pass Intercept'], [])

  // Player comparison state
  const [p1TeamId, setP1TeamId] = useState(null)
  const [p1PlayerId, setP1PlayerId] = useState(null)
  const [p2TeamId, setP2TeamId] = useState(null)
  const [p2PlayerId, setP2PlayerId] = useState(null)

  // Highlights state
  const [hlTeam, setHlTeam] = useState('ALL')
  const [hlPlayer, setHlPlayer] = useState('ALL')
  const [hlAction, setHlAction] = useState('ALL')
  const [hlOutcome, setHlOutcome] = useState('ALL')
  const [hlType, setHlType] = useState('ALL')
  const [hlInsideBox, setHlInsideBox] = useState(false)
  const [hlBrushBounds, setHlBrushBounds] = useState(null) // {x1,y1,x2,y2} in pitch coords
  const [hlSeekTime, setHlSeekTime] = useState(0)
  const [hlForceRender, setHlForceRender] = useState(0)
  const videoRef = useRef(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [matchData, eventsData, lineupsData] = await Promise.all([
          fetchSupabase('matches', {
            select: 'match_id,home_team_id,away_team_id,match_date,match_name,status,is_futsal,video_url,tournament_name,home_team_score,away_team_score,home_team:teams!matches_home_team_id_fkey(team_name),away_team:teams!matches_away_team_id_fkey(team_name)',
            'match_id': `eq.${matchId}`
          }),
          fetchSupabase('processed_match_events', {
            select: '*',
            'match_id': `eq.${matchId}`
          }),
          fetchSupabase('lineups', {
            select: 'player_id,team_id,jersey_no,starting_xi,position,players(player_name,position)',
            'match_id': `eq.${matchId}`
          })
        ])

        const m = matchData?.[0]
        if (!m) return
        setMatch(m)

        const sortedLineups = (lineupsData || []).sort((a, b) => (a.jersey_no || 99) - (b.jersey_no || 99))
        setLineups(sortedLineups)
        setEvents(eventsData || [])

        const homeLineup = sortedLineups.filter(l => l.team_id === m.home_team_id)
        const awayLineup = sortedLineups.filter(l => l.team_id === m.away_team_id)
        setAvgHomePlayers(homeLineup.map(l => l.player_id))
        setAvgAwayPlayers(awayLineup.map(l => l.player_id))
        setP1TeamId(m.home_team_id)
        setP2TeamId(m.away_team_id)
        if (homeLineup.length > 0) setP1PlayerId(homeLineup[0].player_id)
        if (awayLineup.length > 0) setP2PlayerId(awayLineup[0].player_id)

        const isFutsalMatch = m.is_futsal !== false
        const defaultMax = isFutsalMatch ? 40 : 90
        if (eventsData && eventsData.length > 0) {
          const maxSecs = Math.max(...eventsData.map(e => e.match_time_seconds || 0))
          const calculatedMax = Math.ceil(maxSecs / 60)
          const finalMax = calculatedMax > 0 ? calculatedMax : defaultMax
          setMaxMinute(finalMax)
          setAvgMaxMinute(finalMax)
        } else {
          setMaxMinute(defaultMax)
          setAvgMaxMinute(defaultMax)
        }
      } catch (err) {
        console.error('Data fetch failed', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [matchId])

  const isFutsal = match ? match.is_futsal !== false : true
  const cfg = isFutsal ? PITCH_CONFIG.futsal : PITCH_CONFIG.football

  const enrichedEvents = useMemo(() => {
    if (!match) return []
    return events
      .filter(e => e.action !== 'Match Time')
      .map(e => {
        const teamId = lineups.find(l => l.player_id === e.player_id)?.team_id
        let xg = 0
        if (e.action === 'Shoot' && e.start_x !== null && e.start_y !== null) {
          xg = calculateXG(e.start_x, e.start_y, cfg.width, cfg.height)
        }
        return { ...e, team_id: teamId, xg }
      })
  }, [events, lineups, cfg, match])

  const filterOptions = useMemo(() => {
    if (!match) return { actions: [], outcomes: [], types: [], homePlayers: [], awayPlayers: [] }
    const homeLineup = lineups.filter(l => l.team_id === match.home_team_id)
    const awayLineup = lineups.filter(l => l.team_id === match.away_team_id)
    const activeActions = Array.from(new Set(enrichedEvents.map(e => e.action))).filter(Boolean).sort()
    let availableOutcomes = []
    if (distAction === 'ALL') {
      availableOutcomes = Array.from(new Set(enrichedEvents.map(e => e.outcome))).filter(Boolean).sort()
    } else if (CAC_LOGIC[distAction]) {
      availableOutcomes = Object.keys(CAC_LOGIC[distAction]).sort()
    }
    let availableTypes = []
    if (distAction === 'ALL' || distOutcome === 'ALL') {
      availableTypes = Array.from(new Set(enrichedEvents.map(e => e.type))).filter(t => t && t !== 'NA').sort()
    } else if (CAC_LOGIC[distAction] && CAC_LOGIC[distAction][distOutcome]) {
      availableTypes = CAC_LOGIC[distAction][distOutcome].filter(t => t !== 'NA').sort()
    }
    return { actions: activeActions, outcomes: availableOutcomes, types: availableTypes, homePlayers: homeLineup, awayPlayers: awayLineup }
  }, [enrichedEvents, lineups, match, distAction, distOutcome])

  const filteredEvents = useMemo(() => {
    if (!match) return []
    const third = cfg.width / 3
    return enrichedEvents.filter(e => {
      const matchTeam = distTeam === 'ALL' || e.team_id === distTeam
      const matchPlayer = distPlayer === 'ALL' || e.player_id === distPlayer
      const matchAction = distAction === 'ALL' || e.action === distAction
      const matchOutcome = distOutcome === 'ALL' || e.outcome === distOutcome
      const matchType = distType === 'ALL' || e.type === distType
      const eventMinute = Math.floor((e.match_time_seconds || 0) / 60)
      const matchTime = eventMinute >= minMinute && eventMinute <= maxMinute
      const matchZone = distZone === 'ALL' || (
        e.start_x !== null && (
          distZone === 'DEF' ? e.start_x <= third :
          distZone === 'MID' ? e.start_x > third && e.start_x <= third * 2 :
          distZone === 'ATT' ? e.start_x > third * 2 : true
        )
      )
      return matchTeam && matchPlayer && matchAction && matchOutcome && matchType && matchTime && matchZone && e.start_x !== null
    })
  }, [enrichedEvents, distTeam, distPlayer, distAction, distOutcome, distType, distZone, minMinute, maxMinute, match, cfg])

  const calculateAverageData = (teamId, selectedIds, statType, minMin, maxMin) => {
    if (!selectedIds || selectedIds.length === 0) return []
    const sType = statType || avgStatType
    const minM = minMin !== undefined ? minMin : avgMinMinute
    const maxM = maxMin !== undefined ? maxMin : avgMaxMinute
    const validEvents = enrichedEvents.filter(e => {
      const eventMin = Math.floor((e.match_time_seconds || 0) / 60)
      return eventMin >= minM && eventMin <= maxM
    })
    const playerStatsMap = {}
    validEvents.forEach(e => {
      let targetPlayerId = null
      let x = null, y = null
      if (sType === 'ALL_ACTIONS') { targetPlayerId = e.player_id; x = e.start_x; y = e.start_y }
      else if (sType === 'PASS' && (e.action === 'Pass' || e.action === 'Through Ball')) { targetPlayerId = e.player_id; x = e.start_x; y = e.start_y }
      else if (sType === 'RECEIVE' && (e.action === 'Pass' || e.action === 'Through Ball')) {
        if (['Successful', 'Assist', 'Key Pass'].includes(e.outcome)) { targetPlayerId = e.reaction_player_id; x = e.end_x; y = e.end_y }
      }
      else if (sType === 'SHOT' && e.action === 'Shoot') { targetPlayerId = e.player_id; x = e.start_x; y = e.start_y }
      else if (sType === 'DEFENCE' && ['Pass Intercept', 'Standing Tackle', 'Sliding Tackle', 'Save', 'Block'].includes(e.action)) { targetPlayerId = e.player_id; x = e.start_x; y = e.start_y }
      if (targetPlayerId && selectedIds.includes(targetPlayerId) && x !== null && y !== null) {
        const l = lineups.find(lx => lx.player_id === targetPlayerId)
        if (l && l.team_id === teamId) {
          if (!playerStatsMap[targetPlayerId]) playerStatsMap[targetPlayerId] = { sumX: 0, sumY: 0, count: 0 }
          playerStatsMap[targetPlayerId].sumX += x
          playerStatsMap[targetPlayerId].sumY += y
          playerStatsMap[targetPlayerId].count += 1
        }
      }
    })
    return Object.keys(playerStatsMap).map(pid => ({
      playerId: pid,
      avgX: playerStatsMap[pid].sumX / playerStatsMap[pid].count,
      avgY: playerStatsMap[pid].sumY / playerStatsMap[pid].count,
      count: playerStatsMap[pid].count
    }))
  }

  // When Starting XI filter is on, use only starters; otherwise use the manual player selection
  const effectiveHomePlayers = useMemo(() => {
    if (!avgStartingXIOnly) return avgHomePlayers
    return lineups.filter(l => l.team_id === match?.home_team_id && l.starting_xi).map(l => l.player_id)
  }, [avgStartingXIOnly, avgHomePlayers, lineups, match])

  const effectiveAwayPlayers = useMemo(() => {
    if (!avgStartingXIOnly) return avgAwayPlayers
    return lineups.filter(l => l.team_id === match?.away_team_id && l.starting_xi).map(l => l.player_id)
  }, [avgStartingXIOnly, avgAwayPlayers, lineups, match])

  const avgHomeData = useMemo(() => match ? calculateAverageData(match.home_team_id, effectiveHomePlayers, avgStatType, avgMinMinute, avgMaxMinute) : [], [enrichedEvents, effectiveHomePlayers, avgStatType, avgMinMinute, avgMaxMinute, match])
  const avgAwayData = useMemo(() => match ? calculateAverageData(match.away_team_id, effectiveAwayPlayers, avgStatType, avgMinMinute, avgMaxMinute) : [], [enrichedEvents, effectiveAwayPlayers, avgStatType, avgMinMinute, avgMaxMinute, match])

  const fieldTiltStats = useMemo(() => {
    if (!match) return { homeActions: 0, awayActions: 0, homeTilt: 50, awayTilt: 50 }
    let homeFtActions = 0, awayFtActions = 0
    const attackThreshold = cfg.width * (2 / 3)
    enrichedEvents.forEach(e => {
      if (e.start_x !== null && e.start_x > attackThreshold) {
        if (e.team_id === match.home_team_id) homeFtActions++
        if (e.team_id === match.away_team_id) awayFtActions++
      }
    })
    const total = homeFtActions + awayFtActions
    return {
      homeActions: homeFtActions, awayActions: awayFtActions,
      homeTilt: total > 0 ? Math.round((homeFtActions / total) * 100) : 50,
      awayTilt: total > 0 ? Math.round((awayFtActions / total) * 100) : 50
    }
  }, [enrichedEvents, match, cfg])

  const zoneStats = useMemo(() => {
    const valid = filteredEvents.filter(e => e.start_x !== null)
    if (valid.length === 0) return { def: 0, mid: 0, att: 0 }
    const total = valid.length
    const third = cfg.width / 3
    const def = valid.filter(e => e.start_x <= third).length
    const mid = valid.filter(e => e.start_x > third && e.start_x <= third * 2).length
    const att = valid.filter(e => e.start_x > third * 2).length
    return { def: Math.round((def / total) * 100), mid: Math.round((mid / total) * 100), att: Math.round((att / total) * 100) }
  }, [filteredEvents, cfg])

  const verticalityStats = useMemo(() => {
    if (!match) return null
    const calcTeam = (teamId) => {
      const passes = enrichedEvents.filter(e =>
        e.team_id === teamId &&
        (e.action === 'Pass' || e.action === 'Through Ball') &&
        e.start_x !== null && e.end_x !== null
      )
      if (passes.length === 0) return { ratio: 0, label: 'N/A', forward: 0, total: 0 }
      const forward = passes.filter(e => e.end_x - e.start_x > 0).length
      const ratio = Math.round((forward / passes.length) * 100)
      const label = ratio >= 60 ? 'High' : ratio >= 40 ? 'Medium' : 'Low'
      return { ratio, label, forward, total: passes.length }
    }
    return { home: calcTeam(match.home_team_id), away: calcTeam(match.away_team_id) }
  }, [enrichedEvents, match])

  const topActors = useMemo(() => {
    const counts = {}
    filteredEvents.forEach(e => { counts[e.player_id] = (counts[e.player_id] || 0) + 1 })
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([pid, count]) => {
      const player = lineups.find(l => l.player_id === pid)
      return { name: player ? player.players?.player_name : 'Unknown', jersey: player?.jersey_no || '-', count }
    })
  }, [filteredEvents, lineups])

  const attackStats = useMemo(() => {
    if (!match || !enrichedEvents || enrichedEvents.length === 0) return null
    const calcTeamAttack = (teamId) => {
      const evs = enrichedEvents.filter(e => e.team_id === teamId)
      const shots = evs.filter(e => e.action === 'Shoot')
      const goals = shots.filter(e => e.outcome === 'Goal').length
      const sot = shots.filter(e => ['Goal', 'Save'].includes(e.outcome)).length
      const boxShots = shots.filter(e => e.start_x !== null && e.start_x >= cfg.boxX && e.start_y >= cfg.boxYMin && e.start_y <= cfg.boxYMax).length
      const xg = shots.reduce((acc, s) => acc + (parseFloat(s.xg) || 0), 0).toFixed(2)
      const xgPerShot = shots.length ? (xg / shots.length).toFixed(2) : 0
      const xgDiff = (goals - xg).toFixed(2)
      const passes = evs.filter(e => e.action === 'Pass')
      const succPasses = passes.filter(p => ['Successful', 'Assist', 'Key Pass'].includes(p.outcome)).length
      const progPasses = passes.filter(p => p.end_x !== null && p.start_x !== null && (p.end_x - p.start_x) >= cfg.progressiveThreshold).length
      const keyPasses = passes.filter(p => p.outcome === 'Key Pass').length
      const throughBalls = evs.filter(e => e.action === 'Through Ball').length
      const assistPasses = passes.filter(p => p.outcome === 'Assist').length
      const assistThroughBalls = evs.filter(e => e.action === 'Through Ball' && e.outcome === 'Assist').length
      const assists = assistPasses + assistThroughBalls
      const crosses = evs.filter(e => e.type === 'Corner Kick' || (e.action === 'Pass' && e.start_y !== null && (e.start_y < cfg.height * 0.2 || e.start_y > cfg.height * 0.8) && e.start_x > cfg.attackingThirdX)).length
      const carries = evs.filter(e => e.action === 'Carry')
      const progCarries = carries.filter(c => c.end_x !== null && c.start_x !== null && (c.end_x - c.start_x) >= cfg.progressiveThreshold).length
      const final3rdCarries = carries.filter(c => c.start_x !== null && c.end_x !== null && c.start_x < cfg.attackingThirdX && c.end_x >= cfg.attackingThirdX).length
      const dribbles = evs.filter(e => e.action === 'Dribble')
      const succDribbles = dribbles.filter(d => d.outcome === 'Successful').length
      const shotsUnderPressure = shots.filter(s => s.pressure_on === true).length
      const passesUnderPressure = passes.filter(p => p.pressure_on === true)
      const succPassesUnderPressure = passesUnderPressure.filter(p => ['Successful', 'Assist', 'Key Pass'].includes(p.outcome)).length
      const pressPassAcc = passesUnderPressure.length ? Math.round((succPassesUnderPressure / passesUnderPressure.length) * 100) : 0
      return {
        shots: shots.length, goals, sot, boxShots, outBoxShots: shots.length - boxShots, xg, xgPerShot, xgDiff,
        passes: passes.length, succPasses, passAcc: passes.length ? Math.round((succPasses / passes.length) * 100) : 0,
        progPasses, keyPasses, assists, throughBalls, crosses,
        carries: carries.length, progCarries, final3rdCarries,
        dribbles: dribbles.length, succDribbles, dribbleAcc: dribbles.length ? Math.round((succDribbles / dribbles.length) * 100) : 0,
        shotsUnderPressure, pressPassAcc
      }
    }
    return { home: calcTeamAttack(match.home_team_id), away: calcTeamAttack(match.away_team_id) }
  }, [enrichedEvents, match, cfg])

  const defenseStats = useMemo(() => {
    if (!match || !enrichedEvents || enrichedEvents.length === 0) return null
    const calcTeamDefense = (teamId, opponentId) => {
      const evs = enrichedEvents.filter(e => e.team_id === teamId)
      const oppEvs = enrichedEvents.filter(e => e.team_id === opponentId)
      const tackles = evs.filter(e => ['Sliding Tackle', 'Standing Tackle'].includes(e.action))
      const totalTackles = tackles.length
      const succTackles = tackles.filter(e => e.outcome === 'Successful')
      const failedTackles = tackles.filter(e => e.outcome === 'Unsuccessful')
      const tacklesWithPoss = succTackles.filter(e => e.type === 'With Possession').length
      const tackleSuccess = totalTackles > 0 ? Math.round((succTackles.length / totalTackles) * 100) : 0
      const interceptions = evs.filter(e => e.action === 'Pass Intercept')
      const totalInterceptions = interceptions.length
      const succInterceptions = interceptions.filter(e => e.outcome === 'Successful')
      const failedInterceptions = interceptions.filter(e => e.outcome === 'Unsuccessful').length
      const intsWithPoss = succInterceptions.filter(e => e.type === 'With Possession').length
      const blocks = evs.filter(e => e.action === 'Block')
      const totalBlocks = blocks.length
      const succBlocks = blocks.filter(e => e.outcome === 'Successful')
      const blocksWithPoss = succBlocks.filter(e => e.type === 'With Possession').length
      const blockOwnGoals = blocks.filter(e => e.outcome === 'Unsuccessful' && e.type === 'Own Goal').length
      const clearances = evs.filter(e => e.action === 'Clearance')
      const totalClearances = clearances.length
      const succClearances = clearances.filter(e => e.outcome === 'Successful')
      const clearWithPoss = succClearances.filter(e => e.type === 'With Possession').length
      const clearOwnGoals = clearances.filter(e => e.outcome === 'Unsuccessful' && e.type === 'Own Goal').length
      const pressures = evs.filter(e => e.action === 'Pressure')
      const totalPressures = pressures.length
      const pressureFouls = pressures.filter(e => e.outcome === 'Foul').length
      const discipline = evs.filter(e => e.action === 'Discipline')
      const disciplineFouls = discipline.filter(e => e.outcome === 'Foul')
      const totalFouls = disciplineFouls.length
      const yellowCards = disciplineFouls.filter(e => e.type === 'Yellow Card').length
      const redCards = disciplineFouls.filter(e => e.type === 'Red Card').length
      const saves = evs.filter(e => e.action === 'Save')
      const totalSaves = saves.length
      const grippingSaves = saves.filter(e => e.outcome === 'Gripping').length
      const pushSaves = saves.filter(e => ['Pushing-in', 'Pushing-out'].includes(e.outcome)).length
      const oppShotsBlocked = oppEvs.filter(e => e.action === 'Shoot' && e.outcome === 'Block').length
      const possessionWins = tacklesWithPoss + intsWithPoss + blocksWithPoss + clearWithPoss
      const ballRecoveries = possessionWins + totalSaves
      const totalDefensiveActions = totalTackles + totalInterceptions + totalBlocks + totalClearances + totalPressures
      const totalSuccDefActions = succTackles.length + succInterceptions.length + succBlocks.length + succClearances.length
      const defActionSuccessRate = totalDefensiveActions > 0 ? Math.round((totalSuccDefActions / totalDefensiveActions) * 100) : 0

      // ── PPDA (Passes Per Defensive Action) ──────────────────────────────────
      // Measures pressing intensity in the opponent's defensive zone.
      // PPDA zone: opponent's defensive 60% (standard StatsBomb definition)
      // Formula: opponent passes in pressing zone / team defensive actions in that zone
      // Lower = more intense press. Defensive actions = tackles + interceptions + fouls.
      const isHome = teamId === match.home_team_id
      const pressThreshold = cfg.width * 0.4              // attacking 60% of pitch

      const oppPassesInZone = oppEvs.filter(e =>
        e.action === 'Pass' && e.start_x !== null &&
        e.start_x > pressThreshold
      ).length

      const defActionsInZone = evs.filter(e =>
        ['Sliding Tackle', 'Standing Tackle', 'Pass Intercept', 'Discipline', 'Pressure'].includes(e.action) &&
        e.start_x !== null &&
        e.start_x > pressThreshold
      ).length

      const ppda = defActionsInZone > 0
        ? parseFloat((oppPassesInZone / defActionsInZone).toFixed(2))
        : null   // null = no defensive actions in zone (show as N/A)

      return {
        totalTackles, succTackles: succTackles.length, failedTackles: failedTackles.length, tacklesWithPoss, tackleSuccess,
        totalInterceptions, succInterceptions: succInterceptions.length, failedInterceptions, intsWithPoss,
        totalBlocks, succBlocks: succBlocks.length, blocksWithPoss, blockOwnGoals,
        totalClearances, succClearances: succClearances.length, clearWithPoss, clearOwnGoals,
        totalPressures, pressureFouls, totalFouls, yellowCards, redCards,
        totalSaves, grippingSaves, pushSaves, oppShotsBlocked,
        possessionWins, ballRecoveries, totalDefensiveActions, defActionSuccessRate,
        ppda, oppPassesInZone, defActionsInZone
      }
    }
    return { home: calcTeamDefense(match.home_team_id, match.away_team_id), away: calcTeamDefense(match.away_team_id, match.home_team_id) }
  }, [enrichedEvents, match, cfg])

  const computedScores = useMemo(() => {
    if (!match) return { home: 0, away: 0 }
    let homeScore = 0, awayScore = 0
    enrichedEvents.forEach(e => {
      if (e.action === 'Shoot' && e.outcome === 'Goal') {
        if (e.team_id === match.home_team_id) homeScore++
        else if (e.team_id === match.away_team_id) awayScore++
      }
      if (e.outcome === 'Unsuccessful' && e.type === 'Own Goal') {
        if (e.team_id === match.home_team_id) awayScore++
        else if (e.team_id === match.away_team_id) homeScore++
      }
    })
    return { home: homeScore, away: awayScore }
  }, [enrichedEvents, match])

  const computeScorers = (teamId) => {
    const goalMap = {}
    enrichedEvents.forEach(e => {
      if (e.action === 'Shoot' && e.outcome === 'Goal' && e.team_id === teamId) {
        goalMap[e.player_id] = (goalMap[e.player_id] || 0) + 1
      }
    })
    return Object.entries(goalMap).map(([pid, count]) => {
      const l = lineups.find(x => x.player_id === pid)
      return { name: l?.players?.player_name || 'Unknown', jersey: l?.jersey_no || '-', count }
    })
  }

  const stats = useMemo(() => {
    if (!attackStats || !match) return null
    const hStats = attackStats.home
    const aStats = attackStats.away
    const homePassEvents = enrichedEvents.filter(e => e.team_id === match.home_team_id && (e.action === 'Pass' || e.action === 'Through Ball')).length
    const awayPassEvents = enrichedEvents.filter(e => e.team_id === match.away_team_id && (e.action === 'Pass' || e.action === 'Through Ball')).length
    const totalPassEvents = homePassEvents + awayPassEvents
    const possessionHome = totalPassEvents ? Math.round((homePassEvents / totalPassEvents) * 100) : 50
    const processRoster = (teamId) => {
      const matchLineup = lineups.filter(l => l.team_id === teamId)
      return {
        starters: matchLineup.filter(l => l.starting_xi),
        subs: matchLineup.filter(l => !l.starting_xi),
        scorers: computeScorers(teamId)
      }
    }
    return {
      home: {
        possession: possessionHome,
        xg: hStats.xg, shots: hStats.shots, sot: hStats.sot,
        passAcc: hStats.passAcc, passes: hStats.passes,
        fouls: enrichedEvents.filter(e => e.team_id === match.home_team_id && (e.outcome === 'Foul' || e.action === 'Discipline')).length,
        roster: processRoster(match.home_team_id)
      },
      away: {
        possession: 100 - possessionHome,
        xg: aStats.xg, shots: aStats.shots, sot: aStats.sot,
        passAcc: aStats.passAcc, passes: aStats.passes,
        fouls: enrichedEvents.filter(e => e.team_id === match.away_team_id && (e.outcome === 'Foul' || e.action === 'Discipline')).length,
        roster: processRoster(match.away_team_id)
      }
    }
  }, [enrichedEvents, attackStats, lineups, match])

  // Player comparison
  const p1Options = useMemo(() => lineups.filter(l => l.team_id === p1TeamId), [lineups, p1TeamId])
  const p2Options = useMemo(() => lineups.filter(l => l.team_id === p2TeamId), [lineups, p2TeamId])

  const matchMaxes = useMemo(() => {
    const playerTotals = {}
    enrichedEvents.forEach(e => {
      if (!playerTotals[e.player_id]) playerTotals[e.player_id] = { passes: 0, shots: 0, tackles: 0, interceptions: 0, carries: 0, xg: 0 }
      const pt = playerTotals[e.player_id]
      if (e.action === 'Pass') pt.passes++
      if (e.action === 'Shoot') { pt.shots++; pt.xg += parseFloat(e.xg || 0) }
      if (['Standing Tackle', 'Sliding Tackle'].includes(e.action)) pt.tackles++
      if (e.action === 'Pass Intercept') pt.interceptions++
      if (e.action === 'Carry') pt.carries++
    })
    let maxes = { passes: 1, shots: 1, tackles: 1, interceptions: 1, carries: 1, xg: 0.1 }
    Object.values(playerTotals).forEach(pt => {
      if (pt.passes > maxes.passes) maxes.passes = pt.passes
      if (pt.shots > maxes.shots) maxes.shots = pt.shots
      if (pt.tackles > maxes.tackles) maxes.tackles = pt.tackles
      if (pt.interceptions > maxes.interceptions) maxes.interceptions = pt.interceptions
      if (pt.carries > maxes.carries) maxes.carries = pt.carries
      if (pt.xg > maxes.xg) maxes.xg = pt.xg
    })
    return maxes
  }, [enrichedEvents])

  const getPlayerStatsForComparison = (pid) => {
    if (!pid) return null
    const info = lineups.find(l => l.player_id === pid) || {}
    const evs = enrichedEvents.filter(e => e.player_id === pid)
    const passes = evs.filter(e => e.action === 'Pass')
    const succPasses = passes.filter(p => ['Successful', 'Assist', 'Key Pass'].includes(p.outcome))
    const shots = evs.filter(e => e.action === 'Shoot')
    const goals = shots.filter(s => s.outcome === 'Goal').length
    const tackles = evs.filter(e => ['Sliding Tackle', 'Standing Tackle'].includes(e.action))
    const succTackles = tackles.filter(t => t.outcome === 'Successful').length
    const carries = evs.filter(e => e.action === 'Carry')
    const interceptions = evs.filter(e => e.action === 'Pass Intercept')
    return {
      info, events: evs,
      stats: {
        passes: passes.length, succPasses: succPasses.length,
        passAcc: passes.length ? Math.round((succPasses.length / passes.length) * 100) : 0,
        shots: shots.length, goals,
        xg: parseFloat(shots.reduce((acc, s) => acc + (parseFloat(s.xg) || 0), 0).toFixed(2)),
        tackles: tackles.length, succTackles,
        carries: carries.length, interceptions: interceptions.length
      }
    }
  }

  const p1Data = useMemo(() => getPlayerStatsForComparison(p1PlayerId), [p1PlayerId, lineups, enrichedEvents])
  const p2Data = useMemo(() => getPlayerStatsForComparison(p2PlayerId), [p2PlayerId, lineups, enrichedEvents])

  const matchLeaders = useMemo(() => {
    const excludedActions = ['Substitution', 'Match Time', 'Pressure']
    const validActions = Object.keys(CAC_LOGIC).filter(a => !excludedActions.includes(a))
    const counts = {}
    enrichedEvents.forEach(e => {
      if (validActions.includes(e.action)) {
        if (!counts[e.action]) counts[e.action] = {}
        counts[e.action][e.player_id] = (counts[e.action][e.player_id] || 0) + 1
      }
    })
    const leaders = []
    validActions.forEach(action => {
      if (!counts[action]) return
      const sortedPlayers = Object.entries(counts[action]).sort((a, b) => b[1] - a[1])
      if (sortedPlayers.length > 0) {
        const topList = sortedPlayers.slice(0, 4).map(([pid, count]) => {
          const pLineup = lineups.find(l => l.player_id === pid) || {}
          const isHomePlayer = pLineup.team_id === match?.home_team_id
          return { count, playerName: pLineup.players?.player_name || 'Unknown', jerseyNo: pLineup.jersey_no || '-', teamName: isHomePlayer ? match?.home_team?.team_name : match?.away_team?.team_name, isHome: isHomePlayer }
        })
        const actionTotal = sortedPlayers.reduce((sum, [, c]) => sum + c, 0)
        leaders.push({ action, actionTotal, topList })
      }
    })
    return leaders.sort((a, b) => b.actionTotal - a.actionTotal).slice(0, 12)
  }, [enrichedEvents, lineups, match])

  const matchVideoUrl = match?.video_url

  const matchVideoProvider = useMemo(() => {
    if (!matchVideoUrl) return null
    if (matchVideoUrl.includes('youtube.com') || matchVideoUrl.includes('youtu.be')) return 'youtube'
    if (matchVideoUrl.includes('drive.google.com')) return 'drive'
    return 'mp4'
  }, [matchVideoUrl])

  const getYouTubeId = (url) => {
    if (!url) return null
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
    const mtch = url.match(regExp)
    return (mtch && mtch[2].length === 11) ? mtch[2] : null
  }

  const getDriveId = (url) => {
    if (!url) return null
    const mtch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/)
    return mtch ? mtch[1] : null
  }

  const hlFilterOptions = useMemo(() => {
    const actions = Array.from(new Set(enrichedEvents.map(e => e.action))).filter(Boolean).sort()
    let outcomes = []
    if (hlAction === 'ALL') { outcomes = Array.from(new Set(enrichedEvents.map(e => e.outcome))).filter(Boolean).sort() }
    else if (CAC_LOGIC[hlAction]) { outcomes = Object.keys(CAC_LOGIC[hlAction]).sort() }
    let types = []
    if (hlAction === 'ALL' || hlOutcome === 'ALL') { types = Array.from(new Set(enrichedEvents.map(e => e.type))).filter(t => t && t !== 'NA').sort() }
    else if (CAC_LOGIC[hlAction] && CAC_LOGIC[hlAction][hlOutcome]) { types = CAC_LOGIC[hlAction][hlOutcome].filter(t => t !== 'NA').sort() }
    return { actions, outcomes, types }
  }, [enrichedEvents, hlAction, hlOutcome])

  const hlFilteredEvents = useMemo(() => {
    return enrichedEvents.filter(e => {
      const matchTeam = hlTeam === 'ALL' || e.team_id === hlTeam
      const matchPlayer = hlPlayer === 'ALL' || e.player_id === hlPlayer
      const matchAction = hlAction === 'ALL' || e.action === hlAction
      const matchOutcome = hlOutcome === 'ALL' || e.outcome === hlOutcome
      const matchType = hlType === 'ALL' || e.type === hlType
      const matchBox = !hlInsideBox || (
        e.action === 'Shoot' &&
        e.start_x !== null && e.start_x >= cfg.boxX &&
        e.start_y !== null && e.start_y >= cfg.boxYMin && e.start_y <= cfg.boxYMax
      )
      return matchTeam && matchPlayer && matchAction && matchOutcome && matchType && matchBox && e.action !== 'Match Time'
    }).sort((a, b) => a.match_time_seconds - b.match_time_seconds)
  }, [enrichedEvents, hlTeam, hlPlayer, hlAction, hlOutcome, hlType, hlInsideBox, cfg])

  const hlPitchFilteredEvents = useMemo(() => {
    if (!hlBrushBounds) return hlFilteredEvents
    const { x1, y1, x2, y2 } = hlBrushBounds
    return hlFilteredEvents.filter(e =>
      e.start_x != null && e.start_y != null &&
      e.start_x >= x1 && e.start_x <= x2 &&
      e.start_y >= y1 && e.start_y <= y2
    )
  }, [hlFilteredEvents, hlBrushBounds])

  const handleEventClick = (timeSecs) => {
    setHlSeekTime(Math.max(0, timeSecs - 5))
    setHlForceRender(prev => prev + 1)
  }

  useEffect(() => {
    if (videoRef.current && hlSeekTime >= 0) {
      try { videoRef.current.currentTime = hlSeekTime } catch (err) { }
      videoRef.current.play().catch(() => { })
    }
  }, [hlSeekTime, hlForceRender])

  const availableDefOutcomes = useMemo(() => {
    const outcomes = new Set()
    if (defActionFilter === 'ALL') {
      defActions.forEach(action => { if (CAC_LOGIC[action]) Object.keys(CAC_LOGIC[action]).forEach(o => outcomes.add(o)) })
    } else {
      if (CAC_LOGIC[defActionFilter]) Object.keys(CAC_LOGIC[defActionFilter]).forEach(o => outcomes.add(o))
    }
    return Array.from(outcomes).sort()
  }, [defActions, defActionFilter])

  const absoluteMaxMinute = useMemo(() => {
    if (!events || events.length === 0) return isFutsal ? 40 : 90
    const maxSecs = Math.max(...events.map(e => e.match_time_seconds || 0))
    const calculated = Math.ceil(maxSecs / 60)
    return calculated > 0 ? calculated : (isFutsal ? 40 : 90)
  }, [events, isFutsal])

  const toggleAvgPlayer = (teamFlag, pid) => {
    if (teamFlag === 'HOME') setAvgHomePlayers(prev => prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid])
    else setAvgAwayPlayers(prev => prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid])
  }

  const hotFilters = [
    { label: 'Shoot', apply: () => { setHlAction('Shoot'); setHlOutcome('ALL'); setHlType('ALL'); setHlTeam('ALL'); setHlPlayer('ALL'); setHlInsideBox(false) } },
    { label: 'Standing Tackle', apply: () => { setHlAction('Standing Tackle'); setHlOutcome('ALL'); setHlType('ALL'); setHlTeam('ALL'); setHlPlayer('ALL'); setHlInsideBox(false) } },
    { label: 'Sliding Tackle', apply: () => { setHlAction('Sliding Tackle'); setHlOutcome('ALL'); setHlType('ALL'); setHlTeam('ALL'); setHlPlayer('ALL'); setHlInsideBox(false) } },
    { label: 'Pass Intercept', apply: () => { setHlAction('Pass Intercept'); setHlOutcome('ALL'); setHlType('ALL'); setHlTeam('ALL'); setHlPlayer('ALL'); setHlInsideBox(false) } },
    { label: 'Save', apply: () => { setHlAction('Save'); setHlOutcome('ALL'); setHlType('ALL'); setHlTeam('ALL'); setHlPlayer('ALL'); setHlInsideBox(false) } },
    { label: 'Goal', apply: () => { setHlAction('ALL'); setHlOutcome('Goal'); setHlType('ALL'); setHlTeam('ALL'); setHlPlayer('ALL'); setHlInsideBox(false) } },
    { label: 'Assist', apply: () => { setHlAction('ALL'); setHlOutcome('Assist'); setHlType('ALL'); setHlTeam('ALL'); setHlPlayer('ALL'); setHlInsideBox(false) } },
    { label: 'Foul', apply: () => { setHlAction('ALL'); setHlOutcome('Foul'); setHlType('ALL'); setHlTeam('ALL'); setHlPlayer('ALL'); setHlInsideBox(false) } },
    { label: 'Key Pass', apply: () => { setHlAction('ALL'); setHlOutcome('Key Pass'); setHlType('ALL'); setHlTeam('ALL'); setHlPlayer('ALL'); setHlInsideBox(false) } },
    { label: 'Shots Inside Box', apply: () => { setHlAction('Shoot'); setHlOutcome('ALL'); setHlType('ALL'); setHlTeam('ALL'); setHlPlayer('ALL'); setHlInsideBox(true) } },
  ]

  const tabs = [
    { id: 'SUMMARY', label: 'Summary', icon: Activity },
    { id: 'DISTRIBUTION', label: 'Distribution', icon: MapIcon },
    { id: 'ATTACK', label: 'Attack', icon: Target },
    { id: 'DEFENSE', label: 'Defense', icon: Shield },
    { id: 'PLAYER', label: 'Player', icon: Users },
    { id: 'HIGHLIGHTS', label: 'Highlights', icon: Video },
    { id: 'NOTES', label: 'Notes', icon: Edit3 },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-white font-mono flex items-center justify-center">
        <div className="flex items-center gap-3 text-xl font-bold uppercase">
          <RefreshCw className="animate-spin" /> Processing match data...
        </div>
      </div>
    )
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-white font-mono flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl font-black uppercase mb-4">Match not found</p>
          <Link href="/" className="border-2 border-black px-4 py-2 font-bold uppercase hover:bg-[#FFD166]">Back to Home</Link>
        </div>
      </div>
    )
  }

  const dbHomeScore = match.home_team_score ?? 0
  const dbAwayScore = match.away_team_score ?? 0
  const tournamentName = match.tournament_name || 'CAC'

  return (
    <div className="min-h-screen bg-white font-mono overflow-x-hidden">
      {/* Header */}
      <header className="bg-black text-white p-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Link href="/" className="hover:text-[#FFD166] flex items-center gap-1">
            <ChevronLeft size={28} />
          </Link>
          <div>
            <h1 className="text-lg font-black uppercase tracking-widest truncate max-w-[200px] md:max-w-none">
              {match.home_team?.team_name} vs {match.away_team?.team_name}
            </h1>
            <p className="text-[10px] text-gray-400 uppercase">{tournamentName} &bull; {match.match_date}</p>
          </div>
          <div className={`text-[10px] font-black border px-2 py-0.5 uppercase ${isFutsal ? 'border-[#06D6A0] text-[#06D6A0]' : 'border-[#FFD166] text-[#FFD166]'}`}>
            {isFutsal ? 'Futsal' : 'Football'}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm font-black">
            <span className="text-[#0077B6]">{dbHomeScore}</span>
            <span className="text-gray-400 mx-1">-</span>
            <span className="text-[#D90429]">{dbAwayScore}</span>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="border-b-4 border-black bg-[#f1f5f9] flex overflow-x-auto no-scrollbar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-4 font-black uppercase text-xs whitespace-nowrap border-r-2 border-black transition-all
              ${activeTab === tab.id ? 'bg-[#FFD166] translate-y-[2px]' : 'hover:bg-white'}`}
          >
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </nav>

      <main className="p-4 md:p-8 max-w-7xl mx-auto">
        {!stats ? (
          <div className="py-20 text-center uppercase font-black animate-pulse">Processing Advanced Metrics...</div>
        ) : (
          <>
            {/* SUMMARY TAB */}
            {activeTab === 'SUMMARY' && (
              <div className="space-y-12">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                  <BrutalistCard color="bg-[#f8fafc]" className="text-center py-10">
                    <h2 className="text-3xl font-black uppercase text-[#0077B6] mb-4 tracking-tighter">{match.home_team?.team_name}</h2>
                    <div className="text-9xl font-black tracking-tighter">{dbHomeScore}</div>
                    <div className="mt-6 text-sm font-bold text-gray-600 space-y-2">
                      {stats.home.roster.scorers.map((s, i) => (
                        <div key={i} className="flex items-center justify-center gap-2">
                          <span className="text-[#0077B6] font-black text-xs border border-[#0077B6] px-1.5 py-0.5">#{s.jersey}</span>
                          <span>{s.name}</span>
                          <span className="tracking-tight">{Array(s.count).fill('⚽').join('')}</span>
                        </div>
                      ))}
                    </div>
                  </BrutalistCard>
                  <div className="flex flex-col items-center justify-center gap-4">
                    <span className="text-5xl font-black bg-black text-white px-8 py-4">FINAL</span>
                    <span className="font-black text-gray-400 uppercase tracking-[0.2em] text-xs">{match.match_date}</span>
                  </div>
                  <BrutalistCard color="bg-[#f8fafc]" className="text-center py-10">
                    <h2 className="text-3xl font-black uppercase text-[#D90429] mb-4 tracking-tighter">{match.away_team?.team_name}</h2>
                    <div className="text-9xl font-black tracking-tighter">{dbAwayScore}</div>
                    <div className="mt-6 text-sm font-bold text-gray-600 space-y-2">
                      {stats.away.roster.scorers.map((s, i) => (
                        <div key={i} className="flex items-center justify-center gap-2">
                          <span className="text-[#D90429] font-black text-xs border border-[#D90429] px-1.5 py-0.5">#{s.jersey}</span>
                          <span>{s.name}</span>
                          <span className="tracking-tight">{Array(s.count).fill('⚽').join('')}</span>
                        </div>
                      ))}
                    </div>
                  </BrutalistCard>
                </div>

                <section>
                  <h3 className="text-2xl font-black uppercase border-b-4 border-black inline-block pb-1 mb-6">Match Analytics</h3>
                  <div className="grid grid-cols-1 gap-3">
                    {(STATS_CONFIG.summary || []).filter(e => e.enabled).sort((a, b) => a.order - b.order).map(e => {
                      const def = STATS_REGISTRY[e.id]
                      if (!def) return null
                      return (
                        <div key={e.id} className="flex items-center border-2 border-black bg-white overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                          <div className="w-1/4 p-4 text-center font-black text-2xl bg-[#0077B6] text-white">{def.getH(stats.home)}</div>
                          <div className="w-2/4 p-4 text-center font-black uppercase tracking-widest text-xs bg-white border-x-2 border-black">{def.label}</div>
                          <div className="w-1/4 p-4 text-center font-black text-2xl bg-[#D90429] text-white">{def.getA(stats.away)}</div>
                        </div>
                      )
                    })}
                  </div>
                </section>

                <section>
                  <h3 className="text-2xl font-black uppercase border-b-4 border-black inline-block pb-1 mb-8">Team Sheets</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <TeamSheetSide teamName={match.home_team?.team_name || 'HOME'} roster={stats.home.roster} colorClass="bg-[#0077B6]" />
                    <TeamSheetSide teamName={match.away_team?.team_name || 'AWAY'} roster={stats.away.roster} colorClass="bg-[#D90429]" />
                  </div>
                </section>
              </div>
            )}

            {/* DISTRIBUTION TAB */}
            {activeTab === 'DISTRIBUTION' && (
              <div className="space-y-12">
                <section>
                  <h3 className="text-xl font-black uppercase border-b-4 border-black inline-block pb-1 mb-6">Raw Telemetry</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <div className="lg:col-span-3">
                      <DistributionPitch filteredEvents={filteredEvents} homeTeamId={match.home_team_id} lineups={lineups} isFutsal={isFutsal} />
                      <div className="flex gap-4 text-[10px] font-black uppercase mb-4">
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-[#0077B6]"></div> Home</div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-[#D90429]"></div> Away</div>
                        <div className="flex items-center gap-1 italic text-gray-400 ml-auto">* Hover over points</div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="border-2 border-black bg-white p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                          <h4 className="text-[10px] font-black uppercase text-gray-400 mb-2 border-b-2 border-black pb-1">Zone Activity</h4>
                          <div className="flex h-8 border-2 border-black w-full mb-1">
                            {zoneStats.def > 0 && <div className="bg-[#f8fafc] flex items-center justify-center text-[10px] font-black border-r-2 border-black" style={{ width: `${zoneStats.def}%` }}>{zoneStats.def}%</div>}
                            {zoneStats.mid > 0 && <div className="bg-[#FFD166] flex items-center justify-center text-[10px] font-black border-r-2 border-black" style={{ width: `${zoneStats.mid}%` }}>{zoneStats.mid}%</div>}
                            {zoneStats.att > 0 && <div className="bg-black text-white flex items-center justify-center text-[10px] font-black" style={{ width: `${zoneStats.att}%` }}>{zoneStats.att}%</div>}
                          </div>
                          <div className="flex justify-between text-[9px] font-black uppercase text-gray-500"><span>Def 3rd</span><span>Mid 3rd</span><span>Att 3rd</span></div>
                        </div>
                        <div className="border-2 border-black bg-white p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                          <h4 className="text-[10px] font-black uppercase text-gray-400 mb-2 border-b-2 border-black pb-1">Top Actors</h4>
                          {topActors.map((p, i) => (
                            <div key={i} className="flex justify-between items-center text-xs font-bold uppercase mb-1">
                              <span>#{p.jersey} {p.name}</span>
                              <span className="bg-black text-white px-2 text-[10px]">{p.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <BrutalistCard>
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-[10px] font-black uppercase text-gray-400"><Filter size={12} className="inline" /> Filters</h4>
                          <button onClick={() => { setDistTeam('ALL'); setDistPlayer('ALL'); setDistAction('ALL'); setDistOutcome('ALL'); setDistType('ALL'); setDistZone('ALL'); setMinMinute(0); setMaxMinute(absoluteMaxMinute) }} className="text-[10px] font-black uppercase border-2 border-black px-2 py-0.5 hover:bg-[#06D6A0]">Reset</button>
                        </div>
                        <div className="space-y-3 text-xs font-bold uppercase">
                          <div>
                            <label className="block mb-1 text-gray-500">Team</label>
                            <select className="w-full border-2 border-black p-1.5 font-black text-xs" value={distTeam} onChange={e => { setDistTeam(e.target.value); setDistPlayer('ALL') }}>
                              <option value="ALL">All</option>
                              <option value={match.home_team_id}>{match.home_team?.team_name}</option>
                              <option value={match.away_team_id}>{match.away_team?.team_name}</option>
                            </select>
                          </div>
                          <div>
                            <label className="block mb-1 text-gray-500">Player</label>
                            <select className="w-full border-2 border-black p-1.5 font-black text-xs" value={distPlayer} onChange={e => setDistPlayer(e.target.value)}>
                              <option value="ALL">All Players</option>
                              {(distTeam === 'ALL' ? lineups : lineups.filter(l => l.team_id === distTeam)).map(p => (
                                <option key={p.player_id} value={p.player_id}>#{p.jersey_no} {p.players?.player_name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block mb-1 text-gray-500">Action</label>
                            <select className="w-full border-2 border-black p-1.5 font-black text-xs" value={distAction} onChange={e => { setDistAction(e.target.value); setDistOutcome('ALL'); setDistType('ALL') }}>
                              <option value="ALL">All Actions</option>
                              {filterOptions.actions.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block mb-1 text-gray-500">Outcome</label>
                            <select className="w-full border-2 border-black p-1.5 font-black text-xs" value={distOutcome} onChange={e => { setDistOutcome(e.target.value); setDistType('ALL') }}>
                              <option value="ALL">All Outcomes</option>
                              {filterOptions.outcomes.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block mb-1 text-gray-500">Zone</label>
                            <div className="flex gap-1">
                              {[['ALL', 'All'], ['DEF', 'Def 3rd'], ['MID', 'Mid 3rd'], ['ATT', 'Att 3rd']].map(([val, lbl]) => (
                                <button key={val} onClick={() => setDistZone(val)} className={`flex-1 border-2 border-black px-1 py-1 text-[9px] font-black uppercase transition-all ${distZone === val ? 'bg-black text-white' : 'bg-white hover:bg-[#FFD166]'}`}>{lbl}</button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="block mb-1 text-gray-500">Time (min)</label>
                            <div className="flex items-center gap-1">
                              <input type="number" className="w-1/2 border-2 border-black p-1" value={minMinute} min={0} max={absoluteMaxMinute} onChange={e => setMinMinute(parseInt(e.target.value) || 0)} />
                              <span>-</span>
                              <input type="number" className="w-1/2 border-2 border-black p-1" value={maxMinute} min={0} max={absoluteMaxMinute} onChange={e => setMaxMinute(parseInt(e.target.value) || absoluteMaxMinute)} />
                            </div>
                          </div>
                        </div>
                      </BrutalistCard>
                      <div className="text-center p-3 border-2 border-dashed border-gray-200">
                        <div className="text-sm font-black">{filteredEvents.length}</div>
                        <div className="text-[9px] font-bold text-gray-500 uppercase">Filtered Events</div>
                      </div>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-xl font-black uppercase border-b-4 border-black inline-block pb-1 mb-6">Field Tilt</h3>
                  <div className="flex h-10 border-4 border-black mb-2 w-full shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <div className="bg-[#0077B6] text-white flex items-center justify-center font-black text-sm" style={{ width: `${fieldTiltStats.homeTilt}%` }}>{fieldTiltStats.homeTilt}%</div>
                    <div className="bg-[#D90429] text-white flex items-center justify-center font-black text-sm" style={{ width: `${fieldTiltStats.awayTilt}%` }}>{fieldTiltStats.awayTilt}%</div>
                  </div>
                  <div className="flex justify-between text-[10px] font-black uppercase text-gray-500">
                    <span>{match.home_team?.team_name} ({fieldTiltStats.homeActions} actions)</span>
                    <span>{match.away_team?.team_name} ({fieldTiltStats.awayActions} actions)</span>
                  </div>
                </section>

                {verticalityStats && (
                  <section>
                    <h3 className="text-xl font-black uppercase border-b-4 border-black inline-block pb-1 mb-6">Verticality</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {[
                        { team: match.home_team?.team_name, data: verticalityStats.home, color: '#0077B6' },
                        { team: match.away_team?.team_name, data: verticalityStats.away, color: '#D90429' },
                      ].map(({ team, data, color }) => (
                        <div key={team} className="border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                          <h4 className="text-[10px] font-black uppercase mb-3" style={{ color }}>{team}</h4>
                          <div className="flex items-end gap-3 mb-2">
                            <span className="text-4xl font-black">{data.ratio}%</span>
                            <span className="text-xs font-black uppercase pb-1 text-gray-500">forward passes</span>
                          </div>
                          <div className="w-full h-3 border-2 border-black mb-3">
                            <div className="h-full" style={{ width: `${data.ratio}%`, backgroundColor: color }} />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase border-2 border-black px-2 py-0.5" style={{ backgroundColor: data.label === 'High' ? '#06D6A0' : data.label === 'Medium' ? '#FFD166' : '#f8fafc' }}>
                              {data.label} Verticality
                            </span>
                            <span className="text-[10px] font-bold text-gray-400 uppercase">{data.forward} / {data.total} passes fwd</span>
                          </div>
                          <p className="text-[10px] text-gray-400 font-bold uppercase mt-2">
                            {data.label === 'Low' ? 'Moves ball sideways/backwards to create gaps' : data.label === 'Medium' ? 'Balanced mix of forward and lateral play' : 'Direct, vertical approach — plays forward quickly'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <section>
                  <h3 className="text-xl font-black uppercase border-b-4 border-black inline-block pb-1 mb-6">Average Positions</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div>
                      <label className="block mb-1 text-[10px] font-black uppercase text-gray-500">Metric</label>
                      <select className="w-full border-2 border-black p-2 font-black text-xs uppercase" value={avgStatType} onChange={e => setAvgStatType(e.target.value)}>
                        <option value="ALL_ACTIONS">All Actions</option>
                        <option value="PASS">Pass Origin</option>
                        <option value="RECEIVE">Pass Receive</option>
                        <option value="SHOT">Shots</option>
                        <option value="DEFENCE">Defensive Actions</option>
                      </select>
                    </div>
                    <div>
                      <label className="block mb-1 text-[10px] font-black uppercase text-gray-500">Players</label>
                      <button
                        onClick={() => setAvgStartingXIOnly(prev => !prev)}
                        className={`w-full border-2 border-black p-2 font-black text-xs uppercase transition-all ${
                          avgStartingXIOnly
                            ? 'bg-black text-[#06D6A0] shadow-none'
                            : 'bg-white text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-[#FFD166]'
                        }`}
                      >
                        {avgStartingXIOnly ? '✓ Starting XI Only' : 'Starting XI Only'}
                      </button>
                    </div>
                    <div className="lg:col-span-2">
                      <label className="block mb-1 text-[10px] font-black uppercase text-gray-500">Time Range (min)</label>
                      <div className="flex items-center gap-2">
                        <input type="number" className="w-1/2 border-2 border-black p-2 text-xs font-black" value={avgMinMinute} min={0} max={absoluteMaxMinute} onChange={e => setAvgMinMinute(parseInt(e.target.value) || 0)} />
                        <span className="text-xs font-black">TO</span>
                        <input type="number" className="w-1/2 border-2 border-black p-2 text-xs font-black" value={avgMaxMinute} min={0} max={absoluteMaxMinute} onChange={e => setAvgMaxMinute(parseInt(e.target.value) || absoluteMaxMinute)} />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-8">
                    <AveragePositionsPitch data={avgHomeData} teamName={match.home_team?.team_name} isHome={true} lineups={lineups} isFutsal={isFutsal} />
                    <AveragePositionsPitch data={avgAwayData} teamName={match.away_team?.team_name} isHome={false} lineups={lineups} isFutsal={isFutsal} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                    {[
                      { flag: 'HOME', team: match.home_team?.team_name, players: filterOptions.homePlayers, selected: avgHomePlayers, effective: effectiveHomePlayers, color: '#0077B6' },
                      { flag: 'AWAY', team: match.away_team?.team_name, players: filterOptions.awayPlayers, selected: avgAwayPlayers, effective: effectiveAwayPlayers, color: '#D90429' }
                    ].map(t => (
                      <div key={t.flag} className={`border-2 border-black p-3 bg-white transition-opacity ${avgStartingXIOnly ? 'opacity-60' : ''}`}>
                        <div className="flex justify-between items-center mb-2">
                          <h5 className="text-[10px] font-black uppercase flex items-center gap-2" style={{ color: t.color }}>
                            {t.team}
                            {avgStartingXIOnly && (
                              <span className="bg-black text-[#06D6A0] text-[8px] font-black px-1.5 py-0.5 uppercase">XI Active</span>
                            )}
                          </h5>
                          {!avgStartingXIOnly && (
                            <div className="flex gap-1">
                              <button onClick={() => { if (t.flag === 'HOME') setAvgHomePlayers(t.players.map(p => p.player_id)); else setAvgAwayPlayers(t.players.map(p => p.player_id)) }} className="text-[9px] font-bold uppercase border px-1 hover:bg-gray-100">All</button>
                              <button onClick={() => { if (t.flag === 'HOME') setAvgHomePlayers(t.players.filter(p => p.starting_xi).map(p => p.player_id)); else setAvgAwayPlayers(t.players.filter(p => p.starting_xi).map(p => p.player_id)) }} className="text-[9px] font-bold uppercase border px-1 hover:bg-[#FFD166]">XI</button>
                              <button onClick={() => { if (t.flag === 'HOME') setAvgHomePlayers([]); else setAvgAwayPlayers([]) }} className="text-[9px] font-bold uppercase border px-1 hover:bg-gray-100">None</button>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {t.players.map(p => {
                            const isActive = t.effective.includes(p.player_id)
                            const isStarter = p.starting_xi
                            return (
                              <button
                                key={p.player_id}
                                onClick={() => !avgStartingXIOnly && toggleAvgPlayer(t.flag, p.player_id)}
                                disabled={avgStartingXIOnly}
                                title={`${isStarter ? '⬛ Starter' : '○ Sub'} — #${p.jersey_no}`}
                                className={`text-[10px] font-bold uppercase border-2 px-2 py-0.5 transition-all ${
                                  isActive
                                    ? (t.flag === 'HOME' ? 'bg-[#0077B6] text-white border-[#0077B6]' : 'bg-[#D90429] text-white border-[#D90429]')
                                    : 'bg-white text-black border-black hover:bg-gray-100'
                                } ${isStarter ? 'border-solid' : 'border-dashed opacity-70'}`}
                              >
                                #{p.jersey_no}{isStarter ? '' : '°'}
                              </button>
                            )
                          })}
                        </div>
                        <p className="text-[9px] text-gray-400 font-bold mt-2 uppercase">Solid border = Starter · Dashed + ° = Sub</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {/* ATTACK TAB */}
            {activeTab === 'ATTACK' && (
              <div className="space-y-12">
                <section>
                  <h3 className="text-xl font-black uppercase border-b-4 border-black inline-block pb-1 mb-6">Shot Maps (xG)</h3>
                  <div className="flex flex-wrap gap-8 mb-8">
                    <ShotMapPitch shots={enrichedEvents.filter(e => e.action === 'Shoot' && e.team_id === match.home_team_id)} teamName={match.home_team?.team_name} isHome={true} lineups={lineups} isFutsal={isFutsal} />
                    <ShotMapPitch shots={enrichedEvents.filter(e => e.action === 'Shoot' && e.team_id === match.away_team_id)} teamName={match.away_team?.team_name} isHome={false} lineups={lineups} isFutsal={isFutsal} />
                  </div>
                  <div className="flex gap-4 text-[10px] font-black uppercase text-gray-500">
                    <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-[#0077B6]"></div> Goal (Filled)</div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full border-2 border-[#D90429] opacity-50"></div> No Goal</div>
                    <div className="ml-auto italic">* Bubble size = xG</div>
                  </div>
                </section>
                <section>
                  <h3 className="text-xl font-black uppercase border-b-4 border-black inline-block pb-1 mb-6">Shot Placement (Goal Face)</h3>
                  <div className="flex flex-wrap gap-8">
                    <ShotPlacementPitch shots={enrichedEvents.filter(e => e.action === 'Shoot' && e.team_id === match.home_team_id)} teamName={match.home_team?.team_name} isHome={true} lineups={lineups} isFutsal={isFutsal} />
                    <ShotPlacementPitch shots={enrichedEvents.filter(e => e.action === 'Shoot' && e.team_id === match.away_team_id)} teamName={match.away_team?.team_name} isHome={false} lineups={lineups} isFutsal={isFutsal} />
                  </div>
                </section>
                <section>
                  <h3 className="text-xl font-black uppercase border-b-4 border-black inline-block pb-1 mb-6">Attack Statistics</h3>
                  <BrutalistCard>
                    {[
                      { key: 'attack_shooting', title: 'Shooting & Efficiency' },
                      { key: 'attack_distribution', title: 'Distribution & Creativity' },
                      { key: 'attack_ball_progression', title: 'Ball Progression' },
                      { key: 'attack_pressure', title: 'Performance Under Pressure' }
                    ].map(section => (
                      <div key={section.key} className="mb-6 last:mb-0">
                        <h4 className="text-sm font-black uppercase text-gray-400 mb-2 flex items-center gap-2"><Layers size={14} /> {section.title}</h4>
                        {renderStatRows(section.key, attackStats?.home, attackStats?.away)}
                      </div>
                    ))}
                  </BrutalistCard>
                </section>
              </div>
            )}

            {/* DEFENSE TAB */}
            {activeTab === 'DEFENSE' && (
              <div className="space-y-12">
                <section>
                  <h3 className="text-xl font-black uppercase border-b-4 border-black inline-block pb-1 mb-6">Defensive Density Heatmaps</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block mb-1 text-[10px] font-black uppercase text-gray-500">Filter Action</label>
                      <select className="w-full border-2 border-black p-2 font-black text-xs uppercase" value={defActionFilter} onChange={e => { setDefActionFilter(e.target.value); setDefOutcomeFilter('ALL') }}>
                        <option value="ALL">All Defensive Actions</option>
                        {defActions.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block mb-1 text-[10px] font-black uppercase text-gray-500">Filter Outcome</label>
                      <select className="w-full border-2 border-black p-2 font-black text-xs uppercase" value={defOutcomeFilter} onChange={e => setDefOutcomeFilter(e.target.value)}>
                        <option value="ALL">All Outcomes</option>
                        {availableDefOutcomes.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-8">
                    <HeatmapPitch events={enrichedEvents.filter(e => e.team_id === match.home_team_id && (defActionFilter === 'ALL' ? defActions.includes(e.action) : e.action === defActionFilter) && (defOutcomeFilter === 'ALL' || e.outcome === defOutcomeFilter))} teamName={match.home_team?.team_name} isHome={true} isFutsal={isFutsal} />
                    <HeatmapPitch events={enrichedEvents.filter(e => e.team_id === match.away_team_id && (defActionFilter === 'ALL' ? defActions.includes(e.action) : e.action === defActionFilter) && (defOutcomeFilter === 'ALL' || e.outcome === defOutcomeFilter))} teamName={match.away_team?.team_name} isHome={false} isFutsal={isFutsal} />
                  </div>
                </section>
                <section>
                  <h3 className="text-xl font-black uppercase border-b-4 border-black inline-block pb-1 mb-6">Defense Statistics</h3>
                  <BrutalistCard>
                    {[
                      { key: 'defense_tackling', title: 'Tackling & Interceptions' },
                      { key: 'defense_blocks', title: 'Blocks & Clearances' },
                      { key: 'defense_work_rate', title: 'Work Rate & Recoveries' },
                      { key: 'defense_goalkeeping', title: 'Goalkeeping & Discipline' },
                      { key: 'defense_pressing', title: 'Pressing Intensity (PPDA)' }
                    ].map(section => (
                      <div key={section.key} className="mb-6 last:mb-0">
                        <h4 className="text-sm font-black uppercase text-gray-400 mb-2 flex items-center gap-2"><Shield size={14} /> {section.title}</h4>
                        {renderStatRows(section.key, defenseStats?.home, defenseStats?.away)}
                      </div>
                    ))}
                  </BrutalistCard>
                </section>
              </div>
            )}

            {/* PLAYER TAB */}
            {activeTab === 'PLAYER' && (
              <div className="space-y-12">
                <div className="border-b-4 border-black pb-2 mb-8">
                  <h2 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-3"><Users size={32} /> Player Comparison</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <BrutalistCard color="bg-[#f8fafc]">
                    <h4 className="text-[10px] font-black uppercase text-gray-400 mb-2">PLAYER 1 (Blue)</h4>
                    <select className="w-full border-2 border-black p-2 font-black text-xs uppercase mb-2" value={p1TeamId || ''} onChange={e => setP1TeamId(e.target.value)}>
                      <option value={match.home_team_id}>{match.home_team?.team_name}</option>
                      <option value={match.away_team_id}>{match.away_team?.team_name}</option>
                    </select>
                    <select className="w-full border-2 border-black p-2 font-black text-xs uppercase" value={p1PlayerId || ''} onChange={e => setP1PlayerId(e.target.value)}>
                      {p1Options.map(p => <option key={p.player_id} value={p.player_id}>#{p.jersey_no} {p.players?.player_name}</option>)}
                    </select>
                  </BrutalistCard>
                  <BrutalistCard color="bg-[#f8fafc]">
                    <h4 className="text-[10px] font-black uppercase text-gray-400 mb-2">PLAYER 2 (Red)</h4>
                    <select className="w-full border-2 border-black p-2 font-black text-xs uppercase mb-2" value={p2TeamId || ''} onChange={e => setP2TeamId(e.target.value)}>
                      <option value={match.home_team_id}>{match.home_team?.team_name}</option>
                      <option value={match.away_team_id}>{match.away_team?.team_name}</option>
                    </select>
                    <select className="w-full border-2 border-black p-2 font-black text-xs uppercase" value={p2PlayerId || ''} onChange={e => setP2PlayerId(e.target.value)}>
                      {p2Options.map(p => <option key={p.player_id} value={p.player_id}>#{p.jersey_no} {p.players?.player_name}</option>)}
                    </select>
                  </BrutalistCard>
                </div>
                {p1Data && p2Data && (
                  <div className="space-y-8">
                    <BrutalistCard className="py-8">
                      <RadarChart p1Data={p1Data} p2Data={p2Data} maxes={matchMaxes} />
                    </BrutalistCard>
                    <BrutalistCard>
                      <h4 className="text-sm font-black uppercase text-gray-400 mb-4">Head-to-Head</h4>
                      <CompareRow label="Total Passes" homeVal={p1Data.stats.passes} awayVal={p2Data.stats.passes} />
                      <CompareRow label="Pass Accuracy" homeVal={`${p1Data.stats.passAcc}%`} awayVal={`${p2Data.stats.passAcc}%`} highlight />
                      <CompareRow label="Total Shots" homeVal={p1Data.stats.shots} awayVal={p2Data.stats.shots} />
                      <CompareRow label="Goals" homeVal={p1Data.stats.goals} awayVal={p2Data.stats.goals} highlight />
                      <CompareRow label="xG" homeVal={p1Data.stats.xg} awayVal={p2Data.stats.xg} />
                      <CompareRow label="Tackles" homeVal={p1Data.stats.tackles} awayVal={p2Data.stats.tackles} />
                      <CompareRow label="Carries" homeVal={p1Data.stats.carries} awayVal={p2Data.stats.carries} />
                      <CompareRow label="Pass Intercepts" homeVal={p1Data.stats.interceptions} awayVal={p2Data.stats.interceptions} />
                    </BrutalistCard>
                  </div>
                )}
                <section>
                  <h3 className="text-xl font-black uppercase border-b-4 border-black inline-block pb-1 mb-6">Match Leaders</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {matchLeaders.map((leader, i) => <LeaderCard key={i} leader={leader} />)}
                  </div>
                </section>
              </div>
            )}

            {/* HIGHLIGHTS TAB */}
            {activeTab === 'HIGHLIGHTS' && (
              <div className="space-y-8">
                <div className="border-b-4 border-black pb-2 mb-6">
                  <h2 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-3"><Video size={32} /> Highlights Reel</h2>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2">
                    <BrutalistCard>
                      {matchVideoUrl ? (
                        matchVideoProvider === 'youtube' ? (
                          <div className="aspect-video w-full border-4 border-black bg-black">
                            <iframe
                              src={`https://www.youtube.com/embed/${getYouTubeId(matchVideoUrl)}?start=${Math.floor(hlSeekTime)}&autoplay=1`}
                              className="w-full h-full" allowFullScreen allow="autoplay"
                              key={hlForceRender}
                            />
                          </div>
                        ) : matchVideoProvider === 'drive' ? (
                          <div className="aspect-video w-full border-4 border-black bg-black">
                            <iframe src={`https://drive.google.com/file/d/${getDriveId(matchVideoUrl)}/preview`} className="w-full h-full" allowFullScreen />
                          </div>
                        ) : (
                          <div className="aspect-video w-full border-4 border-black bg-black">
                            <video ref={videoRef} src={matchVideoUrl} controls className="w-full h-full" />
                          </div>
                        )
                      ) : (
                        <div className="border-4 border-dashed border-gray-300 bg-gray-50 aspect-video w-full flex items-center justify-center">
                          <p className="text-gray-400 font-black uppercase text-sm">No video available for this match</p>
                        </div>
                      )}
                    </BrutalistCard>
                    <div className="flex flex-wrap gap-2 mt-4">
                      {hotFilters.map((hf, i) => (
                        <button key={i} onClick={() => { hf.apply(); setHlBrushBounds(null) }} className="text-[10px] font-black uppercase border-2 border-black px-2 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#FFD166] transition-all bg-white">
                          {hf.label}
                        </button>
                      ))}
                      <button onClick={() => { setHlAction('ALL'); setHlOutcome('ALL'); setHlType('ALL'); setHlTeam('ALL'); setHlPlayer('ALL'); setHlInsideBox(false); setHlBrushBounds(null) }} className="text-[10px] font-black uppercase border-2 border-black px-2 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#06D6A0] transition-all bg-white ml-auto">
                        Reset
                      </button>
                    </div>

                    {/* Pitch Map with brush selection */}
                    <div className="mt-4">
                      <HighlightsPitch
                        events={hlFilteredEvents}
                        lineups={lineups}
                        isFutsal={isFutsal}
                        homeTeamId={match.home_team_id}
                        onEventClick={handleEventClick}
                        onBrushChange={setHlBrushBounds}
                      />
                    </div>
                  </div>
                  <div>
                    <BrutalistCard className="max-h-[90vh] flex flex-col">
                      <h4 className="text-[10px] font-black uppercase text-gray-400 mb-3 flex items-center gap-1 border-b-2 border-black pb-2">
                        <Clock size={12} /> Event Timeline ({hlPitchFilteredEvents.length}
                        {hlBrushBounds ? ' in region' : ''})
                      </h4>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <select className="border-2 border-black p-1 font-black text-[10px] uppercase" value={hlTeam} onChange={e => { setHlTeam(e.target.value); setHlPlayer('ALL'); setHlBrushBounds(null) }}>
                          <option value="ALL">All Teams</option>
                          <option value={match.home_team_id}>{match.home_team?.team_name}</option>
                          <option value={match.away_team_id}>{match.away_team?.team_name}</option>
                        </select>
                        <select className="border-2 border-black p-1 font-black text-[10px] uppercase" value={hlPlayer} onChange={e => { setHlPlayer(e.target.value); setHlBrushBounds(null) }}>
                          <option value="ALL">All Players</option>
                          {(hlTeam === 'ALL' ? lineups : lineups.filter(l => l.team_id === hlTeam)).map(p => (
                            <option key={p.player_id} value={p.player_id}>#{p.jersey_no} {p.players?.player_name}</option>
                          ))}
                        </select>
                        <select className="border-2 border-black p-1 font-black text-[10px] uppercase" value={hlAction} onChange={e => { setHlAction(e.target.value); setHlOutcome('ALL'); setHlType('ALL'); setHlBrushBounds(null) }}>
                          <option value="ALL">All Actions</option>
                          {hlFilterOptions.actions.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                        <select className="border-2 border-black p-1 font-black text-[10px] uppercase" value={hlOutcome} onChange={e => { setHlOutcome(e.target.value); setHlType('ALL'); setHlBrushBounds(null) }}>
                          <option value="ALL">All Outcomes</option>
                          {hlFilterOptions.outcomes.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div className="flex-1 overflow-y-auto no-scrollbar">
                        {hlPitchFilteredEvents.length === 0 ? (
                          <div className="text-center py-6 text-gray-400 font-bold text-xs uppercase">No events match filters</div>
                        ) : (
                          <table className="w-full text-[10px] font-bold uppercase">
                            <thead>
                              <tr className="border-b-2 border-black text-left text-gray-500">
                                <th className="py-1 w-10">Time</th>
                                <th className="py-1 w-4">T</th>
                                <th className="py-1">Player</th>
                                <th className="py-1">Action</th>
                                <th className="py-1">Out</th>
                              </tr>
                            </thead>
                            <tbody>
                              {hlPitchFilteredEvents.map((e, i) => {
                                const isHome = e.team_id === match.home_team_id
                                const pLineup = lineups.find(l => l.player_id === e.player_id)
                                return (
                                  <tr
                                    key={i}
                                    onClick={() => handleEventClick(e.match_time_seconds)}
                                    className="border-b border-gray-200 hover:bg-[#FFD166] cursor-pointer transition-colors"
                                  >
                                    <td className="py-2 font-black text-black">{Math.floor((e.match_time_seconds || 0) / 60)}'</td>
                                    <td className="py-2"><div className={`w-3 h-3 rounded-full ${isHome ? 'bg-[#0077B6]' : 'bg-[#D90429]'}`}></div></td>
                                    <td className="py-2 truncate max-w-[80px]">{pLineup ? `#${pLineup.jersey_no} ${pLineup.players?.player_name}` : 'Unknown'}</td>
                                    <td className="py-2">{e.action}</td>
                                    <td className="py-2 text-gray-600">{e.outcome}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </BrutalistCard>
                  </div>
                </div>
              </div>
            )}

            {/* NOTES TAB */}
            {activeTab === 'NOTES' && (
              <div className="space-y-12">
                <div className="border-b-4 border-black pb-2 mb-6">
                  <h2 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-3"><Edit3 size={32} /> Match Info</h2>
                </div>
                <BrutalistCard color="bg-[#FFD166]">
                  <div className="mb-4">
                    <h3 className="text-lg font-black uppercase border-b-2 border-black pb-1 inline-block">Match Details</h3>
                  </div>
                  <div className="space-y-3 text-sm font-bold">
                    <div className="flex justify-between border-b border-dashed border-black/30 pb-2">
                      <span className="text-gray-700 uppercase text-xs">Match Name</span>
                      <span>{match.match_name || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between border-b border-dashed border-black/30 pb-2">
                      <span className="text-gray-700 uppercase text-xs">Date</span>
                      <span>{match.match_date || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between border-b border-dashed border-black/30 pb-2">
                      <span className="text-gray-700 uppercase text-xs">Tournament</span>
                      <span>{tournamentName}</span>
                    </div>
                    <div className="flex justify-between border-b border-dashed border-black/30 pb-2">
                      <span className="text-gray-700 uppercase text-xs">Sport</span>
                      <span>{isFutsal ? 'Futsal' : 'Football'}</span>
                    </div>
                    <div className="flex justify-between border-b border-dashed border-black/30 pb-2">
                      <span className="text-gray-700 uppercase text-xs">Score (DB)</span>
                      <span>{match.home_team?.team_name} {dbHomeScore} - {dbAwayScore} {match.away_team?.team_name}</span>
                    </div>
                    <div className="flex justify-between border-b border-dashed border-black/30 pb-2">
                      <span className="text-gray-700 uppercase text-xs">Score (Events)</span>
                      <span>{match.home_team?.team_name} {computedScores.home} - {computedScores.away} {match.away_team?.team_name}</span>
                    </div>
                    {matchVideoUrl && (
                      <div className="flex justify-between border-b border-dashed border-black/30 pb-2">
                        <span className="text-gray-700 uppercase text-xs">Video</span>
                        <a href={matchVideoUrl} target="_blank" rel="noreferrer" className="text-[#0077B6] underline truncate max-w-[300px]">{matchVideoUrl}</a>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-700 uppercase text-xs">Total Events</span>
                      <span>{enrichedEvents.length}</span>
                    </div>
                  </div>
                </BrutalistCard>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <TeamSheetSide teamName={match.home_team?.team_name || 'HOME'} roster={stats.home.roster} colorClass="bg-[#0077B6]" />
                  <TeamSheetSide teamName={match.away_team?.team_name || 'AWAY'} roster={stats.away.roster} colorClass="bg-[#D90429]" />
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <footer className="mt-20 p-8 border-t-4 border-black text-center text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
        <a href="https://calico-analysis-company.lovable.app" target="_blank" rel="noreferrer" className="hover:text-black transition-colors">CAC Analytics Engine</a>
      </footer>
    </div>
  )
}
