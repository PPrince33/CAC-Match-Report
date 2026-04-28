'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { fetchSupabase, upsertSupabase } from '../../../lib/supabase.js'
import { PITCH_CONFIG } from '../../../lib/pitchConfig.js'
import { calculateXG, calculateXGOT } from '../../../lib/xg.js'
import { CAC_LOGIC } from '../../../lib/cacLogic.js'
import { STATS_REGISTRY, STATS_CONFIG } from '../../../lib/statsRegistry.js'
import BrutalistCard from '../../../components/ui/BrutalistCard.jsx'
import BrutalistButton from '../../../components/ui/BrutalistButton.jsx'
import CompareRow from '../../../components/ui/CompareRow.jsx'
import DistributionPitch from '../../../components/pitch/DistributionPitch.jsx'
import AveragePositionsPitch from '../../../components/pitch/AveragePositionsPitch.jsx'
import ShotMapPitch from '../../../components/pitch/ShotMapPitch.jsx'
import ShotPlacementPitch from '../../../components/pitch/ShotPlacementPitch.jsx'
import HeatmapPitch, { PASS_OUTCOME_LEGEND } from '../../../components/pitch/HeatmapPitch.jsx'
import IntervalLineChart from '../../../components/charts/IntervalLineChart.jsx'
import PlayerDefenseMatrix from '../../../components/PlayerDefenseMatrix.jsx'
import PlayerPassMatrix from '../../../components/PlayerPassMatrix.jsx'
import GoalBuildupPitch from '../../../components/GoalBuildupPitch.jsx'
import HighlightsPitch from '../../../components/pitch/HighlightsPitch.jsx'
import RadarChart from '../../../components/RadarChart.jsx'
import LeaderCard from '../../../components/LeaderCard.jsx'
import TeamSheetSide from '../../../components/TeamSheetSide.jsx'
import MatchChatBot from '../../../components/ui/MatchChatBot.jsx'
import PassingNetworkPitch from '../../../components/pitch/PassingNetworkPitch.jsx'
import {
  ChevronLeft, Activity, Map as MapIcon, Target, Shield, Users, Video, Edit3,
  Filter, Layers, Clock, RefreshCw, GitBranch
} from 'lucide-react'

const renderStatRows = (sectionKey, homeStats, awayStats, clickHandlers = {}) => {
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
          info={def.info}
          lowerIsBetter={def.lowerIsBetter || false}
          onLabelClick={clickHandlers[e.id] || null}
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

  // Passes tab filters (shared by stats table + passing network)
  const [passHalf, setPassHalf] = useState('ALL')      // ALL / 1st / 2nd
  const [passZone, setPassZone] = useState('ALL')      // ALL / DEF / MID / ATT (by start_x)
  const [passMinMin, setPassMinMin] = useState(0)
  const [passMaxMin, setPassMaxMin] = useState(120)
  const [passSelectedPlayer, setPassSelectedPlayer] = useState(null)
  const [passModal, setPassModal] = useState(null)  // { title, filterFn } or null
  const [selectedShotId, setSelectedShotId] = useState(null)
  const [defenseModal, setDefenseModal] = useState(null)  // { title, filterFn }
  const [defMatrixAction, setDefMatrixAction] = useState('ALL')
  const [buildupCount, setBuildupCount] = useState(20)

  // Distribution filters
  const [netTeam, setNetTeam] = useState('HOME')
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
  const [defActionFilter, setDefActionFilter] = useState(() => new Set())  // empty = ALL
  const [defOutcomeFilter, setDefOutcomeFilter] = useState(() => new Set()) // empty = ALL

  // Per-tab Half / Zone / Time-range filters
  const [atkHalf, setAtkHalf] = useState('ALL')
  const [atkZone, setAtkZone] = useState('ALL')
  const [atkMinMin, setAtkMinMin] = useState(0)
  const [atkMaxMin, setAtkMaxMin] = useState(120)
  const [defHalf, setDefHalf] = useState('ALL')
  const [defZone, setDefZone] = useState('ALL')
  const [defMinMin, setDefMinMin] = useState(0)
  const [defMaxMin, setDefMaxMin] = useState(120)
  const defActions = useMemo(() => ['Standing Tackle', 'Sliding Tackle', 'Block', 'Save', 'Pass Intercept'], [])

  // Player comparison state
  const [cacExpandedId, setCacExpandedId] = useState(null)
  const [cacPointsOpen, setCacPointsOpen] = useState(false)
  const [analysisText, setAnalysisText] = useState('')
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisSaved, setAnalysisSaved] = useState(false)
  const [analysisGeneratedAt, setAnalysisGeneratedAt] = useState(null)
  const [p1TeamId, setP1TeamId] = useState(null)
  const [p1PlayerId, setP1PlayerId] = useState(null)
  const [p2TeamId, setP2TeamId] = useState(null)
  const [p2PlayerId, setP2PlayerId] = useState(null)
  const [cmpAction, setCmpAction] = useState('ALL')
  const [cmpOutcome, setCmpOutcome] = useState('ALL')
  const [cmpType, setCmpType] = useState('ALL')

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

        // Load saved analysis note if exists
        try {
          const noteData = await fetchSupabase('match_notes', { 'match_id': `eq.${matchId}`, select: 'analysis_text,generated_at' })
          if (noteData?.[0]?.analysis_text) {
            setAnalysisText(noteData[0].analysis_text)
            setAnalysisGeneratedAt(noteData[0].generated_at)
            setAnalysisSaved(true)
          }
        } catch (_) { /* table may not exist yet */ }

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
          setPassMaxMin(finalMax)
          setAtkMaxMin(finalMax)
          setDefMaxMin(finalMax)
        } else {
          setMaxMinute(defaultMax)
          setAvgMaxMinute(defaultMax)
          setPassMaxMin(defaultMax)
          setAtkMaxMin(defaultMax)
          setDefMaxMin(defaultMax)
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
        let xg = 0, xgot = 0
        if (e.action === 'Shoot' && e.start_x !== null && e.start_y !== null) {
          xg = calculateXG(e, cfg)
          xgot = calculateXGOT(e, xg, cfg)
        }
        return { ...e, team_id: teamId, xg, xgot }
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
      // Minimum forward gain: 3m futsal / 5m football — filters out lateral passes with tiny forward drift
      const minForward = cfg.width === 40 ? 3 : 5
      const forward = passes.filter(e => e.end_x - e.start_x >= minForward).length
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

  const buildAttackStats = (eventsList) => {
    if (!match || !eventsList || eventsList.length === 0) return null
    const calcTeamAttack = (teamId) => {
      const evs = eventsList.filter(e => e.team_id === teamId)
      const shots = evs.filter(e => e.action === 'Shoot')
      const totalShots = shots.length
      // Goals per spec: any (Shoot → Goal) or (Type=Own Goal) credited to Act Team
      const goals = evs.filter(e =>
        (e.action === 'Shoot' && e.outcome === 'Goal') || e.type === 'Own Goal'
      ).length
      // Shots on Target: Goal + Save + goal-line block
      const goalLineX = cfg.width - 2.5
      const sot = shots.filter(s =>
        s.outcome === 'Goal' || s.outcome === 'Save' ||
        (s.outcome === 'Block' && s.end_x != null && s.end_x >= goalLineX &&
         s.end_y != null && s.end_y >= cfg.goalYMin && s.end_y <= cfg.goalYMax)
      ).length
      const boxShots = shots.filter(e => e.start_x !== null && e.start_x >= cfg.boxX && e.start_y >= cfg.boxYMin && e.start_y <= cfg.boxYMax).length

      // xG totals — both with-penalties and non-penalty (NPxG)
      const xgTotal = +(shots.reduce((acc, s) => acc + (parseFloat(s.xg) || 0), 0)).toFixed(2)
      const xgotTotal = +(shots.reduce((acc, s) => acc + (parseFloat(s.xgot) || 0), 0)).toFixed(2)
      const nonPenShots = shots.filter(s => s.type !== 'Penalty')
      const npxg = +(nonPenShots.reduce((acc, s) => acc + (parseFloat(s.xg) || 0), 0)).toFixed(2)
      const npxgot = +(nonPenShots.reduce((acc, s) => acc + (parseFloat(s.xgot) || 0), 0)).toFixed(2)
      const xgPerShot = nonPenShots.length ? (npxg / nonPenShots.length).toFixed(2) : 0

      // Performance = Goals scored − xG (positive = overperformed, negative = underperformed)
      const penGoals = shots.filter(s => s.outcome === 'Goal' && s.type === 'Penalty').length
      const nonPenGoals = goals - penGoals
      const goalsMinusXg = +(goals - xgTotal).toFixed(2)
      const goalsMinusNpxg = +(nonPenGoals - npxg).toFixed(2)
      // Legacy alias for any old consumers
      const xg = npxg, xgot = npxgot, xgDiff = goalsMinusNpxg.toFixed(2)
      const conversionRate = totalShots > 0 ? +(goals / totalShots * 100).toFixed(1) : 0
      const shootingAccuracy = totalShots > 0 ? +(sot / totalShots * 100).toFixed(1) : 0
      const passes = evs.filter(e => e.action === 'Pass')
      const succPasses = passes.filter(p => ['Successful', 'Assist', 'Key Pass'].includes(p.outcome)).length
      const progPasses = passes.filter(p => p.end_x !== null && p.start_x !== null && (p.end_x - p.start_x) >= cfg.progressiveThreshold).length
      const keyPasses = passes.filter(p => p.outcome === 'Key Pass').length
      const throughBalls = evs.filter(e => e.action === 'Through Ball').length
      const assistPasses = passes.filter(p => p.outcome === 'Assist').length
      const assistThroughBalls = evs.filter(e => e.action === 'Through Ball' && e.outcome === 'Assist').length
      const assists = assistPasses + assistThroughBalls
      const corners = evs.filter(e => e.type === 'Corner Kick').length
      const crosses = evs.filter(e => e.action === 'Pass' && e.type !== 'Corner Kick' && e.start_y !== null && (e.start_y < cfg.height * 0.2 || e.start_y > cfg.height * 0.8) && e.start_x > cfg.attackingThirdX).length
      const carries = evs.filter(e => e.action === 'Carry')
      const progCarries = carries.filter(c => c.end_x !== null && c.start_x !== null && (c.end_x - c.start_x) >= cfg.progressiveThreshold).length
      const final3rdCarries = carries.filter(c => c.start_x !== null && c.end_x !== null && c.start_x < cfg.attackingThirdX && c.end_x >= cfg.attackingThirdX).length
      const dribbles = evs.filter(e => e.action === 'Dribble')
      const succDribbles = dribbles.filter(d => d.outcome === 'Successful').length

      // Ball progressions = Carry + Dribble, only counting successful ones
      const progressionEvents = evs.filter(e =>
        (e.action === 'Carry' || e.action === 'Dribble') && e.outcome === 'Successful'
      )
      const progIntoFinal3rd = progressionEvents.filter(e =>
        e.start_x != null && e.end_x != null &&
        e.start_x < cfg.attackingThirdX && e.end_x >= cfg.attackingThirdX
      ).length
      const startedOutsideBox = (e) =>
        e.start_x != null && e.start_y != null && (
          e.start_x < cfg.boxX || e.start_y < cfg.boxYMin || e.start_y > cfg.boxYMax
        )
      const endedInsideBox = (e) =>
        e.end_x != null && e.end_y != null &&
        e.end_x >= cfg.boxX && e.end_y >= cfg.boxYMin && e.end_y <= cfg.boxYMax
      const progIntoBox = progressionEvents.filter(e => startedOutsideBox(e) && endedInsideBox(e)).length
      const shotsUnderPressure = shots.filter(s => s.pressure_on === true).length
      const passesUnderPressure = passes.filter(p => p.pressure_on === true)
      const succPassesUnderPressure = passesUnderPressure.filter(p => ['Successful', 'Assist', 'Key Pass'].includes(p.outcome)).length
      const pressPassAcc = passesUnderPressure.length ? Math.round((succPassesUnderPressure / passesUnderPressure.length) * 100) : 0
      return {
        shots: totalShots, goals, nonPenGoals, sot, boxShots, outBoxShots: totalShots - boxShots,
        xg, xgot, xgTotal, xgotTotal, npxg, npxgot,
        goalsMinusXg, goalsMinusNpxg,
        xgPerShot, xgDiff, conversionRate, shootingAccuracy,
        passes: passes.length, succPasses, passAcc: passes.length ? Math.round((succPasses / passes.length) * 100) : 0,
        progPasses, keyPasses, assists, throughBalls, crosses, corners,
        carries: carries.length, progCarries, final3rdCarries,
        dribbles: dribbles.length, succDribbles, dribbleAcc: dribbles.length ? Math.round((succDribbles / dribbles.length) * 100) : 0,
        progIntoFinal3rd, progIntoBox,
        shotsUnderPressure, pressPassAcc
      }
    }
    return { home: calcTeamAttack(match.home_team_id), away: calcTeamAttack(match.away_team_id) }
  }

  const buildDefenseStats = (eventsList) => {
    if (!match || !eventsList || eventsList.length === 0) return null

    // ── Aerial Duels Won (header interceptions matched to intercepted passes) ──
    // Footballed-specific. We scan once and bucket by team.
    const distScale = cfg.width / 120   // football units → cfg-equivalent
    const distThreshold = 3.0 * distScale
    const timeThreshold = 8.0
    const intendedPasses = eventsList.filter(e => e.action === 'Pass' && e.outcome === 'Intercepted')
    const headerIntercepts = eventsList.filter(e => e.action === 'Pass Intercept' && e.outcome === 'Successful' && e.body_part === 'Head')
    const aerialByTeam = {}
    const aerialMatches = []   // [{ defenderId, opponentId, teamId, dist }]
    headerIntercepts.forEach(intercept => {
      if (intercept.start_x == null || intercept.start_y == null) return
      const defX = cfg.width - intercept.start_x
      const defY = cfg.height - intercept.start_y
      const t = intercept.match_time_seconds ?? 0
      let best = null
      intendedPasses.forEach(p => {
        if (p.end_x == null || p.end_y == null) return
        if (Math.abs((p.match_time_seconds ?? 0) - t) > timeThreshold) return
        const d = Math.hypot(p.end_x - defX, p.end_y - defY)
        if (d > distThreshold) return
        if (best == null || d < best.d) best = { d, pass: p }
      })
      if (best) {
        aerialByTeam[intercept.team_id] = (aerialByTeam[intercept.team_id] || 0) + 1
        aerialMatches.push({
          defenderId: intercept.player_id,
          opponentId: best.pass.reaction_player_id,  // intended receiver = the attacker
          teamId: intercept.team_id,
          dist: best.d,
          event: intercept,
        })
      }
    })

    const calcTeamDefense = (teamId, opponentId) => {
      const evs = eventsList.filter(e => e.team_id === teamId)
      const oppEvs = eventsList.filter(e => e.team_id === opponentId)

      const lostBallControl = evs.filter(e => e.action === 'Ball Control').length

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
      const clearWithPoss = clearances.filter(e => e.type === 'With Possession').length
      const clearOwnGoals = clearances.filter(e => e.outcome === 'Unsuccessful' && e.type === 'Own Goal').length

      const pressures = evs.filter(e => e.action === 'Pressure')
      const totalPressures = pressures.length
      const pressureFouls = pressures.filter(e => e.outcome === 'Foul').length

      const totalFouls = evs.filter(e => e.outcome === 'Foul').length
      const yellowCards = evs.filter(e => e.type === 'Yellow Card').length
      const redCards = evs.filter(e => e.type === 'Red Card').length

      const saves = evs.filter(e => e.action === 'Save')
      const totalSaves = saves.length
      const grippingSaves = saves.filter(e => e.outcome === 'Gripping').length
      const pushSaves = saves.filter(e => ['Pushing-in', 'Pushing-out'].includes(e.outcome)).length
      const savesRegained = grippingSaves   // per spec: outcome='Gripping' = save that retained possession

      const oppShotsBlocked = oppEvs.filter(e => e.action === 'Shoot' && e.outcome === 'Block').length

      const totalRegainedPossession = intsWithPoss + tacklesWithPoss + blocksWithPoss
      const possessionWins = totalRegainedPossession + clearWithPoss
      const ballRecoveries = totalRegainedPossession   // alias

      const totalDefensiveActions = totalTackles + totalInterceptions + totalBlocks + totalClearances + totalPressures
      const totalSuccDefActions = succTackles.length + succInterceptions.length + succBlocks.length + succClearances.length
      const defActionSuccessRate = totalDefensiveActions > 0 ? Math.round((totalSuccDefActions / totalDefensiveActions) * 100) : 0

      const aerialDuelsWon = aerialByTeam[teamId] || 0

      // Ground duels won = successful 1v1 contests on the ground
      //   (Dribble + Successful/Foul Won) + (Tackle + Successful + With Possession)
      const groundDuelsWon = evs.filter(e =>
        (e.action === 'Dribble' && (e.outcome === 'Successful' || e.outcome === 'Foul Won')) ||
        (['Standing Tackle', 'Sliding Tackle'].includes(e.action) && e.outcome === 'Successful' && e.type === 'With Possession')
      ).length

      // ── PPDA per spec ──────────────────────────────────
      // Passes Allowed = OPPONENT's successful "normal" passes that started in their
      //   own defensive 60% (Start X < 60% of pitch length, scaled).
      // Def Actions   = THIS team's defensive actions that started in the high-press zone
      //   (Start X > 40% of pitch length).
      const passSuccess = ['Successful', 'Key Pass', 'Assist']
      const passNormalTypes = ['Normal', 'Normal Pass']
      const lowZone = cfg.width * 0.6
      const highZone = cfg.width * 0.4

      const oppPassesInZone = oppEvs.filter(e =>
        ['Pass', 'Through Ball'].includes(e.action) &&
        e.start_x != null && e.start_x < lowZone &&
        passSuccess.includes(e.outcome) &&
        passNormalTypes.includes(e.type)
      ).length

      const defActionsInZone = evs.filter(e =>
        ['Block', 'Pass Intercept', 'Standing Tackle', 'Sliding Tackle'].includes(e.action) &&
        e.start_x != null && e.start_x > highZone
      ).length

      const ppda = defActionsInZone > 0
        ? parseFloat((oppPassesInZone / defActionsInZone).toFixed(2))
        : null

      return {
        lostBallControl,
        totalTackles, succTackles: succTackles.length, failedTackles: failedTackles.length, tacklesWithPoss, tackleSuccess,
        totalInterceptions, succInterceptions: succInterceptions.length, failedInterceptions, intsWithPoss,
        totalBlocks, succBlocks: succBlocks.length, blocksWithPoss, blockOwnGoals,
        totalClearances, succClearances: succClearances.length, clearWithPoss, clearOwnGoals,
        totalPressures, pressureFouls, totalFouls, yellowCards, redCards,
        totalSaves, grippingSaves, pushSaves, savesRegained, oppShotsBlocked,
        possessionWins, ballRecoveries, totalRegainedPossession,
        aerialDuelsWon, groundDuelsWon,
        totalDefensiveActions, defActionSuccessRate,
        ppda, oppPassesInZone, defActionsInZone,
      }
    }
    return {
      home: calcTeamDefense(match.home_team_id, match.away_team_id),
      away: calcTeamDefense(match.away_team_id, match.home_team_id),
      aerialMatches,
    }
  }

  // Generic Half / Zone / Time-range filter — reused by Passes / Attack / Defense tabs
  const applyHalfZoneTime = (evs, half, zone, minMin, maxMin) => {
    return evs.filter(e => {
      if (half !== 'ALL') {
        const h = e.half || ''
        if (half === '1ST' && !h.includes('1st')) return false
        if (half === '2ND' && !h.includes('2nd')) return false
      }
      const m = e.match_minute ?? (e.match_time_seconds != null ? Math.floor(e.match_time_seconds / 60) : null)
      if (m != null) {
        if (m < minMin || m > maxMin) return false
      }
      if (zone !== 'ALL' && e.start_x != null) {
        const third = cfg.width / 3
        if (zone === 'DEF' && e.start_x > third) return false
        if (zone === 'MID' && (e.start_x <= third || e.start_x >= 2 * third)) return false
        if (zone === 'ATT' && e.start_x < 2 * third) return false
      }
      return true
    })
  }

  // Filtered event lists per tab
  const atkFilteredEvents = useMemo(() => applyHalfZoneTime(enrichedEvents, atkHalf, atkZone, atkMinMin, atkMaxMin),
    [enrichedEvents, atkHalf, atkZone, atkMinMin, atkMaxMin, cfg])
  const defFilteredEvents = useMemo(() => applyHalfZoneTime(enrichedEvents, defHalf, defZone, defMinMin, defMaxMin),
    [enrichedEvents, defHalf, defZone, defMinMin, defMaxMin, cfg])

  // Global stats (unfiltered) — used by Summary, chat / AI context
  const attackStats = useMemo(() => buildAttackStats(enrichedEvents), [enrichedEvents, match, cfg])
  const defenseStats = useMemo(() => buildDefenseStats(enrichedEvents), [enrichedEvents, match, cfg])

  // Filtered stats — used by the Attack / Defense tab UI
  const attackStatsFiltered = useMemo(() => buildAttackStats(atkFilteredEvents), [atkFilteredEvents, match, cfg])
  const defenseStatsFiltered = useMemo(() => buildDefenseStats(defFilteredEvents), [defFilteredEvents, match, cfg])

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
    // Map: player_id -> { direction: 'off'|'on', minute, partnerId }
    const subMap = {}
    enrichedEvents.forEach(e => {
      if (e.action !== 'Substitution') return
      const minute = e.match_minute ?? (e.match_time_seconds ? Math.floor(e.match_time_seconds / 60) : null)
      if (e.player_id) {
        subMap[e.player_id] = { direction: 'off', minute, partnerId: e.reaction_player_id }
      }
      if (e.reaction_player_id) {
        subMap[e.reaction_player_id] = { direction: 'on', minute, partnerId: e.player_id }
      }
    })
    const attachSub = (p) => ({ ...p, sub: subMap[p.player_id] || null })
    const processRoster = (teamId) => {
      const matchLineup = lineups.filter(l => l.team_id === teamId).map(attachSub)
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

  const cacPlayerPoints = useMemo(() => {
    if (!enrichedEvents || !lineups || !match) return []

    const gkIds = new Set()
    lineups.forEach(l => {
      const pos = (l.position || l.players?.position || '').toLowerCase()
      if (pos === 'gk' || pos === 'goalkeeper' || l.jersey_no === 1) gkIds.add(l.player_id)
    })
    enrichedEvents.forEach(e => { if (e.action === 'Save') gkIds.add(e.player_id) })

    const PTS = {
      goal: 10, penaltyWon: 3, shotBox: 2, shotOut: 1, bigChanceMissed: -2,
      assist: 6, keyPass: 3, passInBox: 2, progressive: 1, cross: 1,
      blockDefBox: 3, blockDef3rd: 2, ballRecovery: 2, tackleWon: 2, interception: 2, clearance: 1, aerialWon: 1,
      dribble: 1, foulDrawn: 1, dispossessed: -1,
      foulCommitted: -1, yellowCard: -2, penaltyConceded: -4, ownGoal: -5, redCard: -6,
    }

    const counts = {}
    const inc = (pid, cat) => {
      if (!pid || gkIds.has(pid)) return
      if (!counts[pid]) counts[pid] = Object.fromEntries(Object.keys(PTS).map(k => [k, 0]))
      counts[pid][cat] = (counts[pid][cat] || 0) + 1
    }

    const inAttBox = (x, y) => x != null && y != null && x >= cfg.boxX && y >= cfg.boxYMin && y <= cfg.boxYMax
    const inDefBox = (x, y) => x != null && y != null && x <= (cfg.width - cfg.boxX) && y >= cfg.boxYMin && y <= cfg.boxYMax
    const inDefThird = (x) => x != null && x <= (cfg.width - cfg.attackingThirdX)
    const inAttThird = (x) => x != null && x >= cfg.attackingThirdX
    const isWide = (y) => y != null && (y < cfg.height * 0.2 || y > cfg.height * 0.8)

    enrichedEvents.forEach(e => {
      if (!e.player_id) return
      const { action, outcome, type, start_x: sx, start_y: sy, end_x: ex, end_y: ey, xg: xgVal } = e

      // Shooting
      if (action === 'Shoot') {
        if (outcome === 'Goal') {
          if (type === 'Own Goal') inc(e.player_id, 'ownGoal')
          else inc(e.player_id, 'goal')
        } else if (outcome === 'Save') {
          inAttBox(sx, sy) ? inc(e.player_id, 'shotBox') : inc(e.player_id, 'shotOut')
        } else if ((outcome === 'Off-Target' || outcome === 'Block') && parseFloat(xgVal || 0) >= 0.3) {
          inc(e.player_id, 'bigChanceMissed')
        }
      }

      // Passing
      if (action === 'Pass' || action === 'Through Ball') {
        if (outcome === 'Assist') {
          inc(e.player_id, 'assist')
        } else if (outcome === 'Key Pass') {
          inc(e.player_id, 'keyPass')
        } else if (outcome === 'Successful') {
          if (isWide(sy) && inAttBox(ex, ey)) inc(e.player_id, 'cross')
          else if (inAttBox(ex, ey)) inc(e.player_id, 'passInBox')
        }
        // Progressive pass
        if (
          ['Successful', 'Key Pass', 'Assist'].includes(outcome) &&
          sx != null && ex != null &&
          (ex - sx) >= cfg.progressiveThreshold &&
          (inAttThird(sx) || inAttThird(ex))
        ) {
          inc(e.player_id, 'progressive')
        }
      }

      // Defending
      if ((action === 'Standing Tackle' || action === 'Sliding Tackle') && outcome === 'Successful') {
        inc(e.player_id, 'tackleWon')
        if (type === 'With Possession') inc(e.player_id, 'ballRecovery')
      }
      if (action === 'Pass Intercept' && outcome === 'Successful') {
        inc(e.player_id, 'interception')
        if (type === 'With Possession') inc(e.player_id, 'ballRecovery')
      }
      if (action === 'Block' && outcome === 'Successful') {
        if (inDefBox(sx, sy)) inc(e.player_id, 'blockDefBox')
        else if (inDefThird(sx)) inc(e.player_id, 'blockDef3rd')
      }
      if (action === 'Clearance') inc(e.player_id, 'clearance')
      if (action === 'Aerial Duel' && outcome === 'Successful') inc(e.player_id, 'aerialWon')
      if (action !== 'Standing Tackle' && action !== 'Sliding Tackle' && action !== 'Pass Intercept' &&
          type === 'With Possession' && outcome === 'Successful') {
        inc(e.player_id, 'ballRecovery')
      }

      // Possession
      if (action === 'Dribble' && outcome === 'Successful') inc(e.player_id, 'dribble')
      if (outcome === 'Dispossessed') inc(e.player_id, 'dispossessed')
      if (outcome === 'Foul Won') {
        type === 'Penalty' ? inc(e.player_id, 'penaltyWon') : inc(e.player_id, 'foulDrawn')
      }

      // Discipline
      if (outcome === 'Foul') {
        type === 'Penalty' ? inc(e.player_id, 'penaltyConceded') : inc(e.player_id, 'foulCommitted')
      }
      if (type === 'Yellow Card') inc(e.player_id, 'yellowCard')
      if (type === 'Red Card') inc(e.player_id, 'redCard')
    })

    return Object.entries(counts)
      .map(([pid, cats]) => {
        const total = Object.entries(cats).reduce((sum, [cat, cnt]) => sum + cnt * (PTS[cat] || 0), 0)
        const l = lineups.find(x => x.player_id === pid)
        const isHome = l?.team_id === match.home_team_id
        return {
          playerId: pid,
          name: l?.players?.player_name || 'Unknown',
          jersey: l?.jersey_no || '-',
          teamName: isHome ? match.home_team?.team_name : match.away_team?.team_name,
          isHome,
          total,
          cats,
          PTS,
        }
      })
      .filter(p => p.total !== 0)
      .sort((a, b) => b.total - a.total)
  }, [enrichedEvents, lineups, match, cfg])

  const goalEvents = useMemo(() => {
    if (!enrichedEvents || !lineups || !match) return []
    const goals = enrichedEvents.filter(e => e.action === 'Shoot' && e.outcome === 'Goal')
    return goals.map(g => {
      const scorerLineup = lineups.find(l => l.player_id === g.player_id)
      const isHome = scorerLineup?.team_id === match.home_team_id
      const minute = g.match_time_seconds ? Math.floor(g.match_time_seconds / 60) : '?'
      // find assist in same sequence (pass with Assist outcome just before this event)
      const assistEvent = enrichedEvents.find(e =>
        e.outcome === 'Assist' &&
        Math.abs((e.match_time_seconds || 0) - (g.match_time_seconds || 0)) < 10
      )
      const assisterLineup = assistEvent ? lineups.find(l => l.player_id === assistEvent.player_id) : null
      return {
        minute,
        scorer: scorerLineup?.players?.player_name || `#${scorerLineup?.jersey_no || '?'}`,
        team: isHome ? match.home_team?.team_name : match.away_team?.team_name,
        assister: assisterLineup ? (assisterLineup.players?.player_name || `#${assisterLineup.jersey_no}`) : null,
      }
    })
  }, [enrichedEvents, lineups, match])

  // Build-up sequence (last N events for the scoring team leading into each goal)
  const goalBuildups = useMemo(() => {
    if (!enrichedEvents || !lineups || !match) return []
    const sortedEvents = [...enrichedEvents].sort((a, b) => (a.match_time_seconds ?? 0) - (b.match_time_seconds ?? 0))
    const goals = sortedEvents
      .filter(e => (e.action === 'Shoot' && e.outcome === 'Goal') || e.type === 'Own Goal')
    return goals.map(g => {
      const teamId = g.team_id  // attacking team that scored (or own-goal acted by team)
      const scorerLU = lineups.find(l => l.player_id === g.player_id)
      const minute = g.match_time_seconds != null ? Math.floor(g.match_time_seconds / 60) : null
      const goalIdx = sortedEvents.indexOf(g)
      // Pull preceding events from the SCORING team (skip goal itself), then append goal at the end
      const precedingTeamEvents = []
      for (let i = goalIdx - 1; i >= 0 && precedingTeamEvents.length < buildupCount; i--) {
        const ev = sortedEvents[i]
        if (ev.team_id !== teamId) continue
        if (ev.action === 'Match Time') continue
        precedingTeamEvents.push(ev)
      }
      precedingTeamEvents.reverse()
      return {
        goalEvent: g,
        scorer: scorerLU?.players?.player_name || `#${scorerLU?.jersey_no || '?'}`,
        scorerJersey: scorerLU?.jersey_no || '?',
        teamId,
        isHome: teamId === match.home_team_id,
        teamName: teamId === match.home_team_id ? match.home_team?.team_name : match.away_team?.team_name,
        minute,
        sequence: [...precedingTeamEvents, g],
      }
    })
  }, [enrichedEvents, lineups, match, buildupCount])

  // ───────────────────────────────────────────────────────────────────────
  // Passes tab — outcome buckets per spec
  // ───────────────────────────────────────────────────────────────────────
  const PASS_SUCCESS = new Set(['Successful', 'Key Pass', 'Assist'])
  const PASS_INCOMPLETE = new Set(['Missed', 'Intercepted', 'Off-Side'])

  // Apply Passes-tab filters (half / time range / zone) to any event list
  const applyPassFilters = (evs) => {
    return evs.filter(e => {
      if (passHalf !== 'ALL') {
        const half = e.half || ''
        if (passHalf === '1ST' && !half.includes('1st')) return false
        if (passHalf === '2ND' && !half.includes('2nd')) return false
      }
      const min = e.match_minute ?? (e.match_time_seconds != null ? Math.floor(e.match_time_seconds / 60) : null)
      if (min != null) {
        if (min < passMinMin || min > passMaxMin) return false
      }
      if (passZone !== 'ALL' && e.start_x != null) {
        const third = cfg.width / 3
        if (passZone === 'DEF' && e.start_x > third) return false
        if (passZone === 'MID' && (e.start_x <= third || e.start_x >= 2 * third)) return false
        if (passZone === 'ATT' && e.start_x < 2 * third) return false
      }
      return true
    })
  }

  // Compute the full pass stats block (matches Python spec) for any event subset
  const computePassStats = (allEvs) => {
    const passActs = new Set(['Pass', 'Through Ball'])
    const passEvs = allEvs.filter(e => passActs.has(e.action))
    const ck = (e) => e.type === 'Corner Kick'
    const isSucc = (e) => PASS_SUCCESS.has(e.outcome)
    const isInc = (e) => PASS_INCOMPLETE.has(e.outcome)
    const dist = (e) => Math.hypot((e.end_x ?? e.start_x ?? 0) - (e.start_x ?? 0), (e.end_y ?? e.start_y ?? 0) - (e.start_y ?? 0))

    const halfX = cfg.width / 2
    const att3 = cfg.attackingThirdX
    const bx = cfg.boxX, byMin = cfg.boxYMin, byMax = cfg.boxYMax
    const inBox = (x, y) => x != null && y != null && x >= bx && y >= byMin && y <= byMax
    const longTh = cfg.longBallThreshold
    const progTh = cfg.progressiveThreshold

    const total = passEvs.length
    const complete = passEvs.filter(isSucc).length
    const incomplete = passEvs.filter(isInc).length

    const ownHalfTot = passEvs.filter(e => e.start_x != null && e.start_x <= halfX).length
    const ownHalfSucc = passEvs.filter(e => e.start_x != null && e.start_x <= halfX && isSucc(e)).length

    const oppHalfTot = passEvs.filter(e => e.start_x != null && e.start_x >= halfX).length
    const oppHalfSucc = passEvs.filter(e => e.start_x != null && e.start_x >= halfX && isSucc(e)).length

    const throwTot = passEvs.filter(e => e.type === 'Throw-in').length
    const throwSucc = passEvs.filter(e => e.type === 'Throw-in' && isSucc(e)).length

    const freeKickTot = passEvs.filter(e => e.type === 'Free Kick').length
    const freeKickSucc = passEvs.filter(e => e.type === 'Free Kick' && isSucc(e)).length

    const cornerTot = allEvs.filter(ck).length
    const cornerSucc = allEvs.filter(e => ck(e) && isSucc(e)).length

    const longTot = passEvs.filter(e => dist(e) >= longTh).length
    const longSucc = passEvs.filter(e => dist(e) >= longTh && isSucc(e)).length

    const inAtt3Tot = passEvs.filter(e => e.start_x != null && e.end_x != null && e.start_x >= att3 && e.end_x >= att3).length
    const inAtt3Succ = passEvs.filter(e => e.start_x != null && e.end_x != null && e.start_x >= att3 && e.end_x >= att3 && isSucc(e)).length

    const intoAtt3Tot = passEvs.filter(e => e.start_x != null && e.end_x != null && e.start_x < att3 && e.end_x >= att3).length
    const intoAtt3Succ = passEvs.filter(e => e.start_x != null && e.end_x != null && e.start_x < att3 && e.end_x >= att3 && isSucc(e)).length

    const yNarrow = cfg.crossStartYNarrow
    const isCross = (e) => e.start_x != null && e.start_y != null && e.end_x != null && e.end_y != null &&
      e.start_x >= cfg.crossStartXMin &&
      (e.start_y <= yNarrow || e.start_y >= (cfg.height - yNarrow)) &&
      inBox(e.end_x, e.end_y) &&
      e.type !== 'Throw-in'
    const crossTot = passEvs.filter(isCross).length
    const crossSucc = passEvs.filter(e => isCross(e) && isSucc(e)).length

    const missed = passEvs.filter(e => e.outcome === 'Missed').length
    const intercepted = passEvs.filter(e => e.outcome === 'Intercepted').length
    const offside = passEvs.filter(e => e.outcome === 'Off-Side').length

    const isProg = (e) => e.start_x != null && e.end_x != null && e.end_x > e.start_x && (e.end_x - e.start_x) > progTh
    const progTot = passEvs.filter(isProg).length
    const progSucc = passEvs.filter(e => isProg(e) && isSucc(e)).length
    const progOppTot = passEvs.filter(e => isProg(e) && e.start_x >= halfX).length
    const progOppSucc = passEvs.filter(e => isProg(e) && e.start_x >= halfX && isSucc(e)).length

    // Into box: not starting in box, ends in box
    const intoBoxTot = passEvs.filter(e => !inBox(e.start_x, e.start_y) && inBox(e.end_x, e.end_y)).length
    const intoBoxSucc = passEvs.filter(e => !inBox(e.start_x, e.start_y) && inBox(e.end_x, e.end_y) && isSucc(e)).length

    const insideBoxTot = passEvs.filter(e => inBox(e.start_x, e.start_y) && inBox(e.end_x, e.end_y)).length
    const insideBoxSucc = passEvs.filter(e => inBox(e.start_x, e.start_y) && inBox(e.end_x, e.end_y) && isSucc(e)).length

    const accuracy = total > 0 ? Math.round((complete / total) * 100) : 0

    return {
      total, complete, incomplete, accuracy,
      ownHalfTot, ownHalfSucc, oppHalfTot, oppHalfSucc,
      throwTot, throwSucc, freeKickTot, freeKickSucc, cornerTot, cornerSucc,
      longTot, longSucc, inAtt3Tot, inAtt3Succ,
      intoAtt3Tot, intoAtt3Succ, crossTot, crossSucc,
      missed, intercepted, offside,
      progTot, progSucc, progOppTot, progOppSucc,
      intoBoxTot, intoBoxSucc, insideBoxTot, insideBoxSucc,
    }
  }

  // Filtered events for the Passes tab (used by table & network)
  const passFilteredEvents = useMemo(() => applyPassFilters(enrichedEvents),
    [enrichedEvents, passHalf, passZone, passMinMin, passMaxMin, cfg])

  // Filter functions for clickable metric labels (operate on Pass/Through Ball events)
  const passMapFilters = useMemo(() => {
    const passActs = new Set(['Pass', 'Through Ball'])
    const passOnly = (e) => passActs.has(e.action)
    const att3 = cfg.attackingThirdX
    const bx = cfg.boxX, byMin = cfg.boxYMin, byMax = cfg.boxYMax
    const inBox = (x, y) => x != null && y != null && x >= bx && y >= byMin && y <= byMax
    const yNarrow = cfg.crossStartYNarrow
    const longTh = cfg.longBallThreshold
    const dist = (e) => Math.hypot((e.end_x ?? e.start_x ?? 0) - (e.start_x ?? 0), (e.end_y ?? e.start_y ?? 0) - (e.start_y ?? 0))

    return {
      'Missed':       e => passOnly(e) && e.outcome === 'Missed',
      'Intercepted':  e => passOnly(e) && e.outcome === 'Intercepted',
      'Long Balls':   e => passOnly(e) && dist(e) >= longTh,
      'In Att 3rd':   e => passOnly(e) && e.start_x != null && e.end_x != null && e.start_x >= att3 && e.end_x >= att3,
      'Into Att 3rd': e => passOnly(e) && e.start_x != null && e.end_x != null && e.start_x < att3 && e.end_x >= att3,
      'Into Box':     e => passOnly(e) && !inBox(e.start_x, e.start_y) && inBox(e.end_x, e.end_y),
      'Inside Box':   e => passOnly(e) && inBox(e.start_x, e.start_y) && inBox(e.end_x, e.end_y),
      'Crosses':      e => passOnly(e) && e.start_x != null && e.start_y != null && e.end_x != null && e.end_y != null &&
        e.start_x >= cfg.crossStartXMin &&
        (e.start_y <= yNarrow || e.start_y >= (cfg.height - yNarrow)) &&
        inBox(e.end_x, e.end_y) && e.type !== 'Throw-in',
    }
  }, [cfg])

  const passStatsByTeam = useMemo(() => {
    if (!match) return null
    const home = passFilteredEvents.filter(e => e.team_id === match.home_team_id)
    const away = passFilteredEvents.filter(e => e.team_id === match.away_team_id)
    return { home: computePassStats(home), away: computePassStats(away) }
  }, [passFilteredEvents, match, cfg])

  // 5-minute interval breakdowns for the over-time line charts
  const passIntervalSeries = useMemo(() => {
    if (!match) return { all: [], long: [] }
    const passActs = new Set(['Pass', 'Through Ball'])
    const passEvs = passFilteredEvents.filter(e => passActs.has(e.action))
    const longTh = cfg.longBallThreshold

    const buildSeries = (predicate) => {
      const buckets = {}  // intervalStart -> { home: {c,i,t}, away: {c,i,t} }
      passEvs.filter(predicate).forEach(e => {
        const min = e.match_minute ?? (e.match_time_seconds != null ? Math.floor(e.match_time_seconds / 60) : null)
        if (min == null) return
        const interval = Math.floor(min / 5) * 5
        const side = e.team_id === match.home_team_id ? 'home' : (e.team_id === match.away_team_id ? 'away' : null)
        if (!side) return
        if (!buckets[interval]) buckets[interval] = { home: { c: 0, i: 0 }, away: { c: 0, i: 0 } }
        if (PASS_SUCCESS.has(e.outcome)) buckets[interval][side].c++
        else if (PASS_INCOMPLETE.has(e.outcome)) buckets[interval][side].i++
      })

      // ensure every interval in the visible range exists (no gaps in the line)
      const lo = Math.floor(passMinMin / 5) * 5
      const hi = Math.floor(passMaxMin / 5) * 5
      const intervals = []
      for (let v = lo; v <= hi; v += 5) intervals.push(v)
      return intervals.map(interval => {
        const b = buckets[interval] || { home: { c: 0, i: 0 }, away: { c: 0, i: 0 } }
        return {
          interval,
          homeY: b.home.c,
          homeIncomplete: b.home.i,
          homeTotal: b.home.c + b.home.i,
          awayY: b.away.c,
          awayIncomplete: b.away.i,
          awayTotal: b.away.c + b.away.i,
        }
      })
    }

    const dist = (e) => Math.hypot((e.end_x ?? e.start_x ?? 0) - (e.start_x ?? 0), (e.end_y ?? e.start_y ?? 0) - (e.start_y ?? 0))
    return {
      all: buildSeries(() => true),
      long: buildSeries(e => dist(e) >= longTh),
    }
  }, [passFilteredEvents, match, cfg, passMinMin, passMaxMin])

  const passStatsForSelectedPlayer = useMemo(() => {
    if (!passSelectedPlayer) return null
    const evs = passFilteredEvents.filter(e => e.player_id === passSelectedPlayer)
    return computePassStats(evs)
  }, [passFilteredEvents, passSelectedPlayer, cfg])

  const playerPassStats = useMemo(() => {
    if (!enrichedEvents || !lineups || !match) return []
    const map = {}
    enrichedEvents.forEach(e => {
      if (!e.player_id || (e.action !== 'Pass' && e.action !== 'Through Ball')) return
      const l = lineups.find(x => x.player_id === e.player_id)
      if (!l) return
      if (!map[e.player_id]) {
        map[e.player_id] = {
          name: l.players?.player_name || 'Unknown',
          jersey: l.jersey_no || '?',
          team: l.team_id === match.home_team_id ? match.home_team?.team_name : match.away_team?.team_name,
          total: 0, successful: 0,
        }
      }
      map[e.player_id].total += 1
      if (['Successful', 'Assist', 'Key Pass'].includes(e.outcome)) {
        map[e.player_id].successful += 1
      }
      if (e.start_x != null && e.end_x != null && e.end_x < e.start_x) {
        map[e.player_id].backPasses = (map[e.player_id].backPasses || 0) + 1
      }
    })
    return Object.values(map)
      .filter(p => p.total >= 5)
      .map(p => ({ ...p, accuracy: Math.round((p.successful / p.total) * 100), backPasses: p.backPasses || 0 }))
      .sort((a, b) => b.accuracy - a.accuracy)
  }, [enrichedEvents, lineups, match])

  const playerEventSummary = useMemo(() => {
    if (!enrichedEvents || !lineups || !match) return []
    const map = {}
    enrichedEvents.forEach(e => {
      if (!e.player_id || !e.action) return
      if (!map[e.player_id]) {
        const l = lineups.find(x => x.player_id === e.player_id)
        map[e.player_id] = {
          name: l?.players?.player_name || 'Unknown',
          jersey: l?.jersey_no || '?',
          team: l?.team_id === match.home_team_id ? match.home_team?.team_name : match.away_team?.team_name,
          actions: {},
        }
      }
      const key = e.type && e.type !== 'NA' ? `${e.action} (${e.type})` : e.action
      map[e.player_id].actions[key] = (map[e.player_id].actions[key] || 0) + 1
    })
    return Object.values(map)
  }, [enrichedEvents, lineups, match])

  const eventSummary = useMemo(() => {
    if (!enrichedEvents || !match) return { home: {}, away: {} }
    const build = (teamId) => {
      const counts = {}
      enrichedEvents.filter(e => e.team_id === teamId).forEach(e => {
        if (!e.action) return
        const key = e.type && e.type !== 'NA' ? `${e.action} (${e.type})` : e.action
        counts[key] = (counts[key] || 0) + 1
      })
      return counts
    }
    return {
      home: build(match.home_team_id),
      away: build(match.away_team_id),
    }
  }, [enrichedEvents, match])

  const matchContext = useMemo(() => {
    if (!match || !attackStats || !defenseStats) return null
    return {
      match: {
        homeName: match.home_team?.team_name,
        awayName: match.away_team?.team_name,
        homeScore: computedScores?.home ?? match.home_team_score ?? 0,
        awayScore: computedScores?.away ?? match.away_team_score ?? 0,
        tournament: match.tournament_name || 'CAC',
        date: match.match_date,
        sport: isFutsal ? 'Futsal' : 'Football',
      },
      home: { ...attackStats.home, possession: stats?.home?.possession ?? 50 },
      away: { ...attackStats.away, possession: stats?.away?.possession ?? 50 },
      defHome: defenseStats.home,
      defAway: defenseStats.away,
      vertHome: verticalityStats?.home || {},
      vertAway: verticalityStats?.away || {},
      fieldTilt: fieldTiltStats,
      allPlayers: cacPlayerPoints,
      goalEvents,
      eventSummary,
      playerEventSummary,
      playerPassStats,
    }
  }, [match, attackStats, defenseStats, stats, verticalityStats, fieldTiltStats, cacPlayerPoints, goalEvents, eventSummary, playerEventSummary, playerPassStats, isFutsal])

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
    const sourceActions = defActionFilter.size === 0 ? defActions : Array.from(defActionFilter)
    sourceActions.forEach(action => {
      if (CAC_LOGIC[action]) Object.keys(CAC_LOGIC[action]).forEach(o => outcomes.add(o))
    })
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

  const generateAnalysis = async () => {
    if (!match || !attackStats || !defenseStats) return
    setAnalysisLoading(true)
    setAnalysisSaved(false)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          match: {
            homeName: match.home_team?.team_name,
            awayName: match.away_team?.team_name,
            homeScore: computedScores?.home ?? match.home_team_score ?? 0,
            awayScore: computedScores?.away ?? match.away_team_score ?? 0,
            tournament: match.tournament_name || 'CAC',
            date: match.match_date,
            sport: isFutsal ? 'Futsal' : 'Football',
          },
          home: { ...attackStats.home, possession: stats?.home?.possession },
          away: { ...attackStats.away, possession: stats?.away?.possession },
          defHome: defenseStats.home,
          defAway: defenseStats.away,
          vertHome: verticalityStats?.home || {},
          vertAway: verticalityStats?.away || {},
          fieldTilt: fieldTiltStats,
          topPlayers: cacPlayerPoints.slice(0, 5),
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAnalysisText(data.analysis)
      // Auto-save to Supabase (non-blocking — show analysis even if save fails)
      try {
        await upsertSupabase('match_notes', {
          match_id: matchId,
          analysis_text: data.analysis,
          generated_at: new Date().toISOString(),
        })
        setAnalysisSaved(true)
        setAnalysisGeneratedAt(new Date().toISOString())
      } catch (saveErr) {
        console.warn('Could not save note to Supabase:', saveErr.message)
      }
    } catch (err) {
      console.error('Analysis error:', err)
      setAnalysisText(`Error generating analysis: ${err.message}`)
    } finally {
      setAnalysisLoading(false)
    }
  }

  const tabs = [
    { id: 'SUMMARY', label: 'Summary', icon: Activity },
    { id: 'DISTRIBUTION', label: 'Distribution', icon: MapIcon },
    { id: 'PASSES', label: 'Passes', icon: GitBranch },
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

  const dbHomeScore = computedScores?.home ?? match.home_team_score ?? 0
  const dbAwayScore = computedScores?.away ?? match.away_team_score ?? 0
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
                          {filterOptions.types.length > 0 && (
                            <div>
                              <label className="block mb-1 text-gray-500">Type</label>
                              <select className="w-full border-2 border-black p-1.5 font-black text-xs" value={distType} onChange={e => setDistType(e.target.value)}>
                                <option value="ALL">All Types</option>
                                {filterOptions.types.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                            </div>
                          )}
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

            {/* PASSES TAB */}
            {activeTab === 'PASSES' && passStatsByTeam && (
              <div className="space-y-12">
                {/* Filters */}
                <section>
                  <BrutalistCard>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-[10px] font-black uppercase text-gray-400"><Filter size={12} className="inline" /> Filters</h4>
                      <button onClick={() => { setPassHalf('ALL'); setPassZone('ALL'); setPassMinMin(0); setPassMaxMin(absoluteMaxMinute); setPassSelectedPlayer(null) }} className="text-[10px] font-black uppercase border-2 border-black px-2 py-0.5 hover:bg-[#06D6A0]">Reset</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-bold uppercase">
                      <div>
                        <label className="block mb-1 text-gray-500">Half</label>
                        <div className="flex gap-1">
                          {['ALL', '1ST', '2ND'].map(h => (
                            <button key={h} onClick={() => setPassHalf(h)} className={`flex-1 border-2 border-black p-1.5 font-black text-[11px] ${passHalf === h ? 'bg-black text-white' : 'bg-white hover:bg-[#FFD166]'}`}>{h}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block mb-1 text-gray-500">Zone (by start)</label>
                        <div className="flex gap-1">
                          {[['ALL','All'],['DEF','Def 3rd'],['MID','Mid 3rd'],['ATT','Att 3rd']].map(([k,l]) => (
                            <button key={k} onClick={() => setPassZone(k)} className={`flex-1 border-2 border-black p-1.5 font-black text-[10px] ${passZone === k ? 'bg-black text-white' : 'bg-white hover:bg-[#FFD166]'}`}>{l}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block mb-1 text-gray-500">Time Range (min)</label>
                        <div className="flex items-center gap-2">
                          <input type="number" className="w-1/2 border-2 border-black p-1.5 text-xs font-black" value={passMinMin} min={0} max={absoluteMaxMinute} onChange={e => setPassMinMin(parseInt(e.target.value) || 0)} />
                          <span className="text-xs font-black">TO</span>
                          <input type="number" className="w-1/2 border-2 border-black p-1.5 text-xs font-black" value={passMaxMin} min={0} max={absoluteMaxMinute} onChange={e => setPassMaxMin(parseInt(e.target.value) || absoluteMaxMinute)} />
                        </div>
                      </div>
                    </div>
                  </BrutalistCard>
                </section>

                {/* Team-level passing stats */}
                <section>
                  <h3 className="text-xl font-black uppercase border-b-4 border-black inline-block pb-1 mb-6">Team Passing Stats</h3>
                  <BrutalistCard>
                    {[
                      { title: 'Overall', rows: [
                        { label: 'Total Passes', h: passStatsByTeam.home.total, a: passStatsByTeam.away.total },
                        { label: 'Complete', h: passStatsByTeam.home.complete, a: passStatsByTeam.away.complete },
                        { label: 'Incomplete', h: passStatsByTeam.home.incomplete, a: passStatsByTeam.away.incomplete, lowerIsBetter: true },
                        { label: 'Pass Accuracy', h: `${passStatsByTeam.home.accuracy}%`, a: `${passStatsByTeam.away.accuracy}%`, highlight: true, info: 'Complete ÷ (Complete + Incomplete). Outcomes excluded from total: anything other than Successful, Key Pass, Assist, Missed, Intercepted, Off-Side.' },
                      ]},
                      { title: 'Incomplete Breakdown', rows: [
                        { label: 'Missed', h: passStatsByTeam.home.missed, a: passStatsByTeam.away.missed, lowerIsBetter: true, mapKey: 'Missed' },
                        { label: 'Intercepted', h: passStatsByTeam.home.intercepted, a: passStatsByTeam.away.intercepted, lowerIsBetter: true, mapKey: 'Intercepted' },
                        { label: 'Off-Side', h: passStatsByTeam.home.offside, a: passStatsByTeam.away.offside, lowerIsBetter: true },
                      ]},
                      { title: 'Pitch Halves (Complete / Total)', rows: [
                        { label: 'Own Half', h: `${passStatsByTeam.home.ownHalfSucc}/${passStatsByTeam.home.ownHalfTot}`, a: `${passStatsByTeam.away.ownHalfSucc}/${passStatsByTeam.away.ownHalfTot}` },
                        { label: 'Opp Half', h: `${passStatsByTeam.home.oppHalfSucc}/${passStatsByTeam.home.oppHalfTot}`, a: `${passStatsByTeam.away.oppHalfSucc}/${passStatsByTeam.away.oppHalfTot}` },
                      ]},
                      { title: 'Attacking Third', rows: [
                        { label: 'In Att 3rd', h: `${passStatsByTeam.home.inAtt3Succ}/${passStatsByTeam.home.inAtt3Tot}`, a: `${passStatsByTeam.away.inAtt3Succ}/${passStatsByTeam.away.inAtt3Tot}`, info: 'Passes that start AND end in the attacking third.', mapKey: 'In Att 3rd' },
                        { label: 'Into Att 3rd', h: `${passStatsByTeam.home.intoAtt3Succ}/${passStatsByTeam.home.intoAtt3Tot}`, a: `${passStatsByTeam.away.intoAtt3Succ}/${passStatsByTeam.away.intoAtt3Tot}`, info: 'Passes that start outside and end inside the attacking third.', mapKey: 'Into Att 3rd' },
                      ]},
                      { title: 'Penalty Box', rows: [
                        { label: 'Into Box', h: `${passStatsByTeam.home.intoBoxSucc}/${passStatsByTeam.home.intoBoxTot}`, a: `${passStatsByTeam.away.intoBoxSucc}/${passStatsByTeam.away.intoBoxTot}`, info: 'Passes that start outside and end inside the attacking penalty box.', mapKey: 'Into Box' },
                        { label: 'Inside Box', h: `${passStatsByTeam.home.insideBoxSucc}/${passStatsByTeam.home.insideBoxTot}`, a: `${passStatsByTeam.away.insideBoxSucc}/${passStatsByTeam.away.insideBoxTot}`, info: 'Passes that start AND end inside the attacking penalty box.', mapKey: 'Inside Box' },
                        { label: 'Crosses', h: `${passStatsByTeam.home.crossSucc}/${passStatsByTeam.home.crossTot}`, a: `${passStatsByTeam.away.crossSucc}/${passStatsByTeam.away.crossTot}`, info: 'Passes from a wide attacking position into the box (excluding throw-ins).', mapKey: 'Crosses' },
                      ]},
                      { title: 'Progression', rows: [
                        { label: 'Progressive', h: `${passStatsByTeam.home.progSucc}/${passStatsByTeam.home.progTot}`, a: `${passStatsByTeam.away.progSucc}/${passStatsByTeam.away.progTot}`, info: `Forward passes covering at least ${cfg.progressiveThreshold} units of the pitch.` },
                        { label: 'Progressive (Opp Half)', h: `${passStatsByTeam.home.progOppSucc}/${passStatsByTeam.home.progOppTot}`, a: `${passStatsByTeam.away.progOppSucc}/${passStatsByTeam.away.progOppTot}` },
                        { label: 'Long Balls', h: `${passStatsByTeam.home.longSucc}/${passStatsByTeam.home.longTot}`, a: `${passStatsByTeam.away.longSucc}/${passStatsByTeam.away.longTot}`, info: `Passes covering at least ${cfg.longBallThreshold} units of distance.`, mapKey: 'Long Balls' },
                      ]},
                      { title: 'Set Pieces', rows: [
                        { label: 'Throw-ins', h: `${passStatsByTeam.home.throwSucc}/${passStatsByTeam.home.throwTot}`, a: `${passStatsByTeam.away.throwSucc}/${passStatsByTeam.away.throwTot}` },
                        { label: 'Free Kicks', h: `${passStatsByTeam.home.freeKickSucc}/${passStatsByTeam.home.freeKickTot}`, a: `${passStatsByTeam.away.freeKickSucc}/${passStatsByTeam.away.freeKickTot}` },
                        { label: 'Corners', h: `${passStatsByTeam.home.cornerSucc}/${passStatsByTeam.home.cornerTot}`, a: `${passStatsByTeam.away.cornerSucc}/${passStatsByTeam.away.cornerTot}` },
                      ]},
                    ].map(section => (
                      <div key={section.title} className="mb-6 last:mb-0">
                        <h4 className="text-sm font-black uppercase text-gray-400 mb-2 flex items-center gap-2"><Layers size={14} /> {section.title}</h4>
                        {section.rows.map((row, i) => (
                          <CompareRow
                            key={i}
                            label={row.label}
                            homeVal={row.h}
                            awayVal={row.a}
                            highlight={row.highlight || false}
                            info={row.info}
                            lowerIsBetter={row.lowerIsBetter || false}
                            onLabelClick={row.mapKey ? () => setPassModal({ title: row.label, filterFn: passMapFilters[row.mapKey] }) : null}
                          />
                        ))}
                      </div>
                    ))}
                    <p className="text-[9px] font-bold uppercase text-gray-400 mt-2 border-t-2 border-black pt-2">Values shown as successful / total · success = Successful, Key Pass, Assist · incomplete = Missed, Intercepted, Off-Side</p>
                  </BrutalistCard>
                </section>

                {/* Over-time charts */}
                <section>
                  <h3 className="text-xl font-black uppercase border-b-4 border-black inline-block pb-1 mb-6">Passing Tempo</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <BrutalistCard>
                      <h4 className="text-sm font-black uppercase text-gray-400 mb-3 flex items-center gap-2"><Layers size={14} /> Completed Passes / 5-min</h4>
                      <IntervalLineChart
                        data={passIntervalSeries.all}
                        yLabel="Completed"
                        homeName={match.home_team?.team_name}
                        awayName={match.away_team?.team_name}
                        metricLabel="Completed"
                      />
                    </BrutalistCard>
                    <BrutalistCard>
                      <h4 className="text-sm font-black uppercase text-gray-400 mb-3 flex items-center gap-2"><Layers size={14} /> Successful Long Balls / 5-min</h4>
                      <IntervalLineChart
                        data={passIntervalSeries.long}
                        yLabel="Successful"
                        homeName={match.home_team?.team_name}
                        awayName={match.away_team?.team_name}
                        metricLabel="Successful"
                      />
                    </BrutalistCard>
                  </div>
                </section>

                {/* Passing Network */}
                <section>
                  <h3 className="text-xl font-black uppercase border-b-4 border-black inline-block pb-1 mb-6">Passing Network</h3>
                  <div className="flex gap-2 mb-4">
                    {['HOME', 'AWAY'].map(t => (
                      <button
                        key={t}
                        onClick={() => { setNetTeam(t); setPassSelectedPlayer(null) }}
                        className={`text-xs font-black uppercase border-2 border-black px-4 py-1.5 transition-all ${netTeam === t ? 'bg-black text-white' : 'bg-white text-black hover:bg-[#FFD166]'}`}
                      >
                        {t === 'HOME' ? match.home_team?.team_name : match.away_team?.team_name}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2">
                      <PassingNetworkPitch
                        events={passFilteredEvents}
                        lineups={lineups}
                        homeTeamId={match.home_team_id}
                        isFutsal={isFutsal}
                        teamFilter={netTeam}
                        selectedPlayerId={passSelectedPlayer}
                        onSelectPlayer={setPassSelectedPlayer}
                      />
                      <div className="flex gap-6 text-[10px] font-black uppercase mt-3 flex-wrap">
                        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-[#0077B6]"></div> {match.home_team?.team_name}</div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-[#D90429]"></div> {match.away_team?.team_name}</div>
                        <div className="flex items-center gap-1 text-gray-400 italic ml-auto">* Click a player for breakdown · Hover for details</div>
                      </div>
                    </div>
                    {/* Player breakdown panel */}
                    <BrutalistCard className="lg:col-span-1">
                      {passSelectedPlayer && passStatsForSelectedPlayer ? (() => {
                        const lp = lineups.find(l => l.player_id === passSelectedPlayer)
                        const isHomeP = lp?.team_id === match.home_team_id
                        const ps = passStatsForSelectedPlayer
                        return (
                          <>
                            <div className={`-m-4 mb-3 p-3 border-b-2 border-black ${isHomeP ? 'bg-[#0077B6]' : 'bg-[#D90429]'} text-white flex items-center justify-between`}>
                              <div>
                                <div className="text-[9px] font-bold uppercase opacity-80">#{lp?.jersey_no}</div>
                                <h4 className="text-sm font-black uppercase leading-tight">{lp?.players?.player_name}</h4>
                              </div>
                              <button onClick={() => setPassSelectedPlayer(null)} className="text-white/80 hover:text-white text-xs font-black border border-white/50 px-2 py-0.5">×</button>
                            </div>
                            <div className="space-y-1 text-[11px] font-black uppercase">
                              {[
                                ['Total', ps.total],
                                ['Complete', ps.complete],
                                ['Incomplete', ps.incomplete],
                                ['Accuracy', `${ps.accuracy}%`, true],
                                ['—', null],
                                ['Missed', ps.missed],
                                ['Intercepted', ps.intercepted],
                                ['Off-Side', ps.offside],
                                ['—', null],
                                ['Own Half', `${ps.ownHalfSucc}/${ps.ownHalfTot}`],
                                ['Opp Half', `${ps.oppHalfSucc}/${ps.oppHalfTot}`],
                                ['—', null],
                                ['In Att 3rd', `${ps.inAtt3Succ}/${ps.inAtt3Tot}`],
                                ['Into Att 3rd', `${ps.intoAtt3Succ}/${ps.intoAtt3Tot}`],
                                ['Into Box', `${ps.intoBoxSucc}/${ps.intoBoxTot}`],
                                ['Inside Box', `${ps.insideBoxSucc}/${ps.insideBoxTot}`],
                                ['Crosses', `${ps.crossSucc}/${ps.crossTot}`],
                                ['—', null],
                                ['Progressive', `${ps.progSucc}/${ps.progTot}`],
                                ['Prog (Opp)', `${ps.progOppSucc}/${ps.progOppTot}`],
                                ['Long Balls', `${ps.longSucc}/${ps.longTot}`],
                                ['—', null],
                                ['Throw-ins', `${ps.throwSucc}/${ps.throwTot}`],
                                ['Free Kicks', `${ps.freeKickSucc}/${ps.freeKickTot}`],
                                ['Corners', `${ps.cornerSucc}/${ps.cornerTot}`],
                              ].map((row, i) => row[0] === '—' ? (
                                <div key={i} className="border-t border-gray-200 my-1.5"></div>
                              ) : (
                                <div key={i} className={`flex items-center justify-between px-1.5 py-0.5 ${row[2] ? 'bg-[#FFD166]' : ''}`}>
                                  <span className="text-gray-600">{row[0]}</span>
                                  <span>{row[1]}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )
                      })() : (
                        <div className="flex items-center justify-center h-full min-h-[300px] text-center px-4">
                          <p className="text-[11px] font-bold uppercase text-gray-400">Click a player on the network to see their pass breakdown here.</p>
                        </div>
                      )}
                    </BrutalistCard>
                  </div>
                </section>

                {/* Pass Link Matrices */}
                <section>
                  <h3 className="text-xl font-black uppercase border-b-4 border-black inline-block pb-1 mb-6">Pass Link Matrices</h3>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <PlayerPassMatrix
                      events={passFilteredEvents}
                      lineups={lineups}
                      teamId={match.home_team_id}
                      teamColor="#0077B6"
                      teamName={match.home_team?.team_name}
                    />
                    <PlayerPassMatrix
                      events={passFilteredEvents}
                      lineups={lineups}
                      teamId={match.away_team_id}
                      teamColor="#D90429"
                      teamName={match.away_team?.team_name}
                    />
                  </div>
                  <p className="text-[9px] font-bold uppercase text-gray-400 mt-3 italic">Cells = completed pass count between the pair · respects the active half / zone / time-range filters · hover for the per-pass timeline</p>
                </section>

                {/* Pass Map Modal */}
                {passModal && (() => {
                  const filteredHome = passFilteredEvents.filter(e => e.team_id === match.home_team_id && passModal.filterFn(e))
                  const filteredAway = passFilteredEvents.filter(e => e.team_id === match.away_team_id && passModal.filterFn(e))
                  return (
                    <div
                      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto"
                      onClick={() => setPassModal(null)}
                    >
                      <div
                        className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-6xl w-full p-5 my-auto"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-start justify-between border-b-2 border-black pb-3 mb-4">
                          <div>
                            <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Pass Map</p>
                            <h3 className="text-2xl font-black uppercase tracking-tighter">{passModal.title}</h3>
                            <p className="text-[10px] font-bold uppercase text-gray-500 mt-1">
                              <span style={{ color: '#0077B6' }}>{match.home_team?.team_name}: {filteredHome.length}</span>
                              {' · '}
                              <span style={{ color: '#D90429' }}>{match.away_team?.team_name}: {filteredAway.length}</span>
                              {(passHalf !== 'ALL' || passZone !== 'ALL' || passMinMin > 0 || passMaxMin < absoluteMaxMinute) && (
                                <span className="text-gray-400 italic"> · filters applied</span>
                              )}
                            </p>
                          </div>
                          <button
                            onClick={() => setPassModal(null)}
                            className="border-2 border-black px-3 py-1 font-black text-sm bg-white hover:bg-[#FFD166] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                          >✕ CLOSE</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <HeatmapPitch
                            events={filteredHome}
                            teamName={match.home_team?.team_name}
                            isHome={true}
                            isFutsal={isFutsal}
                            showEvents={true}
                          />
                          <HeatmapPitch
                            events={filteredAway}
                            teamName={match.away_team?.team_name}
                            isHome={false}
                            isFutsal={isFutsal}
                            showEvents={true}
                          />
                        </div>
                        <div className="mt-3 pt-2 border-t border-gray-200 flex items-center gap-x-4 gap-y-1 flex-wrap">
                          <span className="text-[9px] font-bold uppercase text-gray-400">Arrows: start → end</span>
                          {PASS_OUTCOME_LEGEND.map(([label, color]) => (
                            <span key={label} className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-gray-600">
                              <span className="inline-block w-3 h-[3px]" style={{ backgroundColor: color }} />
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* ATTACK TAB */}
            {activeTab === 'ATTACK' && (
              <div className="space-y-12">
                {/* Half / Zone / Time filters (Attack-tab scoped) */}
                <section>
                  <BrutalistCard>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-[10px] font-black uppercase text-gray-400"><Filter size={12} className="inline" /> Filters</h4>
                      <button onClick={() => { setAtkHalf('ALL'); setAtkZone('ALL'); setAtkMinMin(0); setAtkMaxMin(absoluteMaxMinute); setSelectedShotId(null) }} className="text-[10px] font-black uppercase border-2 border-black px-2 py-0.5 hover:bg-[#06D6A0]">Reset</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-bold uppercase">
                      <div>
                        <label className="block mb-1 text-gray-500">Half</label>
                        <div className="flex gap-1">
                          {['ALL', '1ST', '2ND'].map(h => (
                            <button key={h} onClick={() => setAtkHalf(h)} className={`flex-1 border-2 border-black p-1.5 font-black text-[11px] ${atkHalf === h ? 'bg-black text-white' : 'bg-white hover:bg-[#FFD166]'}`}>{h}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block mb-1 text-gray-500">Zone (by start)</label>
                        <div className="flex gap-1">
                          {[['ALL','All'],['DEF','Def 3rd'],['MID','Mid 3rd'],['ATT','Att 3rd']].map(([k,l]) => (
                            <button key={k} onClick={() => setAtkZone(k)} className={`flex-1 border-2 border-black p-1.5 font-black text-[10px] ${atkZone === k ? 'bg-black text-white' : 'bg-white hover:bg-[#FFD166]'}`}>{l}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block mb-1 text-gray-500">Time Range (min)</label>
                        <div className="flex items-center gap-2">
                          <input type="number" className="w-1/2 border-2 border-black p-1.5 text-xs font-black" value={atkMinMin} min={0} max={absoluteMaxMinute} onChange={e => setAtkMinMin(parseInt(e.target.value) || 0)} />
                          <span className="text-xs font-black">TO</span>
                          <input type="number" className="w-1/2 border-2 border-black p-1.5 text-xs font-black" value={atkMaxMin} min={0} max={absoluteMaxMinute} onChange={e => setAtkMaxMin(parseInt(e.target.value) || absoluteMaxMinute)} />
                        </div>
                      </div>
                    </div>
                  </BrutalistCard>
                </section>

                <section>
                  <h3 className="text-xl font-black uppercase border-b-4 border-black inline-block pb-1 mb-6">Shot Maps (xG)</h3>
                  <div className="flex flex-wrap gap-8 mb-8">
                    <ShotMapPitch shots={atkFilteredEvents.filter(e => e.action === 'Shoot' && e.team_id === match.home_team_id)} teamName={match.home_team?.team_name} isHome={true} lineups={lineups} isFutsal={isFutsal} selectedShotId={selectedShotId} onSelectShot={setSelectedShotId} />
                    <ShotMapPitch shots={atkFilteredEvents.filter(e => e.action === 'Shoot' && e.team_id === match.away_team_id)} teamName={match.away_team?.team_name} isHome={false} lineups={lineups} isFutsal={isFutsal} selectedShotId={selectedShotId} onSelectShot={setSelectedShotId} />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[10px] font-black uppercase text-gray-500 items-center">
                    <span className="text-gray-400">Bubble (start):</span>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#0077B6]"></div> Goal</div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full border-2 border-[#D90429] opacity-60"></div> No Goal</div>
                    {selectedShotId ? (
                      <>
                        <span className="text-gray-300">·</span>
                        <span className="text-gray-400">End point:</span>
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#16a34a' }}></div> Goal</div>
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#f97316' }}></div> Save</div>
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-white border-2" style={{ borderColor: '#ef4444' }}></div> Off-Target</div>
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-white border-2" style={{ borderColor: '#eab308' }}></div> Block</div>
                        <button
                          onClick={() => setSelectedShotId(null)}
                          className="ml-2 border-2 border-black bg-white px-2 py-0.5 text-[9px] font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#FFD166]"
                        >✕ Clear</button>
                      </>
                    ) : null}
                    <div className="ml-auto italic">* Bubble size = xG · click a start bubble to see its trajectory</div>
                  </div>
                </section>
                <section>
                  <h3 className="text-xl font-black uppercase border-b-4 border-black inline-block pb-1 mb-6">Shot Placement (Goal Face)</h3>
                  <div className="flex flex-wrap gap-8">
                    <ShotPlacementPitch shots={atkFilteredEvents.filter(e => e.action === 'Shoot' && e.team_id === match.home_team_id)} teamName={match.home_team?.team_name} isHome={true} lineups={lineups} isFutsal={isFutsal} />
                    <ShotPlacementPitch shots={atkFilteredEvents.filter(e => e.action === 'Shoot' && e.team_id === match.away_team_id)} teamName={match.away_team?.team_name} isHome={false} lineups={lineups} isFutsal={isFutsal} />
                  </div>
                  <div className="flex gap-4 mt-3 text-[10px] font-black uppercase text-gray-500">
                    <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-[#0077B6]"></div> Goal (Filled)</div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full border-2 border-[#D90429] opacity-50"></div> No Goal</div>
                    <div className="ml-auto italic">* Bubble size = xGOT (off-target shots have xGOT 0 → smallest)</div>
                  </div>
                </section>
                <section>
                  <h3 className="text-xl font-black uppercase border-b-4 border-black inline-block pb-1 mb-6">Attack Statistics</h3>
                  <BrutalistCard>
                    {[
                      { key: 'attack_shooting', title: 'Shooting & Efficiency' },
                      { key: 'attack_ball_progression', title: 'Ball Progression' },
                      { key: 'attack_pressure', title: 'Performance Under Pressure' }
                    ].map(section => (
                      <div key={section.key} className="mb-6 last:mb-0">
                        <h4 className="text-sm font-black uppercase text-gray-400 mb-2 flex items-center gap-2"><Layers size={14} /> {section.title}</h4>
                        {renderStatRows(section.key, attackStatsFiltered?.home, attackStatsFiltered?.away)}
                      </div>
                    ))}
                  </BrutalistCard>
                </section>

                {/* Goal Build-ups */}
                <section>
                  <div className="flex items-end justify-between gap-4 border-b-4 border-black mb-6 pb-1 flex-wrap">
                    <h3 className="text-xl font-black uppercase">Goal Build-up</h3>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase">
                      <span className="text-gray-500">Actions before goal:</span>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={buildupCount}
                        onChange={e => setBuildupCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                        className="w-16 border-2 border-black p-1 text-xs font-black text-center"
                      />
                      <div className="flex gap-1">
                        {[5, 10, 20, 30].map(n => (
                          <button
                            key={n}
                            onClick={() => setBuildupCount(n)}
                            className={`border border-black px-1.5 py-0.5 text-[10px] ${buildupCount === n ? 'bg-black text-white' : 'bg-white hover:bg-[#FFD166]'}`}
                          >{n}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {goalBuildups.length === 0 ? (
                    <div className="border-4 border-dashed border-gray-200 p-8 text-center text-[11px] font-black uppercase text-gray-400">
                      No goals in this match
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {goalBuildups.map((g, i) => {
                        const isOwnGoal = g.goalEvent.type === 'Own Goal'
                        return (
                          <BrutalistCard key={i}>
                            <div className={`-m-4 mb-4 px-4 py-2 border-b-2 border-black flex items-center justify-between text-white ${g.isHome ? 'bg-[#0077B6]' : 'bg-[#D90429]'}`}>
                              <div className="flex items-center gap-3">
                                <span className="text-2xl">⚽</span>
                                <div>
                                  <div className="text-xs font-black uppercase opacity-80">{g.minute != null ? `${g.minute}'` : '?'} · {g.teamName}</div>
                                  <div className="text-base font-black uppercase leading-tight">#{g.scorerJersey} {g.scorer}{isOwnGoal ? ' (Own Goal)' : ''}</div>
                                </div>
                              </div>
                              <div className="text-right text-[10px] font-bold uppercase opacity-90">
                                {g.sequence.length - 1} preceding action{g.sequence.length - 1 !== 1 ? 's' : ''}
                              </div>
                            </div>
                            <GoalBuildupPitch
                              events={g.sequence}
                              lineups={lineups}
                              isFutsal={isFutsal}
                              isHome={g.isHome}
                            />
                            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[9px] font-black uppercase text-gray-500 border-t border-gray-200 pt-2">
                              <span className="text-gray-400">Legend:</span>
                              {['Pass', 'Carry', 'Dribble', 'Shoot', 'Cross', 'Pass Intercept'].map(act => (
                                <span key={act} className="flex items-center gap-1">
                                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor:
                                    act === 'Pass' ? '#3b82f6' :
                                    act === 'Carry' ? '#06b6d4' :
                                    act === 'Dribble' ? '#0ea5e9' :
                                    act === 'Shoot' ? '#ef4444' :
                                    act === 'Cross' ? '#f59e0b' : '#84cc16'
                                  }} />
                                  {act}
                                </span>
                              ))}
                              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#FFD166] border border-black" /> Goal</span>
                              <span className="ml-auto italic text-gray-400">Numbers = chronological order · hover for action details</span>
                            </div>
                          </BrutalistCard>
                        )
                      })}
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* DEFENSE TAB */}
            {activeTab === 'DEFENSE' && (
              <div className="space-y-12">
                {/* Half / Zone / Time filters (Defense-tab scoped) */}
                <section>
                  <BrutalistCard>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-[10px] font-black uppercase text-gray-400"><Filter size={12} className="inline" /> Filters</h4>
                      <button onClick={() => { setDefHalf('ALL'); setDefZone('ALL'); setDefMinMin(0); setDefMaxMin(absoluteMaxMinute) }} className="text-[10px] font-black uppercase border-2 border-black px-2 py-0.5 hover:bg-[#06D6A0]">Reset</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-bold uppercase">
                      <div>
                        <label className="block mb-1 text-gray-500">Half</label>
                        <div className="flex gap-1">
                          {['ALL', '1ST', '2ND'].map(h => (
                            <button key={h} onClick={() => setDefHalf(h)} className={`flex-1 border-2 border-black p-1.5 font-black text-[11px] ${defHalf === h ? 'bg-black text-white' : 'bg-white hover:bg-[#FFD166]'}`}>{h}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block mb-1 text-gray-500">Zone (by start)</label>
                        <div className="flex gap-1">
                          {[['ALL','All'],['DEF','Def 3rd'],['MID','Mid 3rd'],['ATT','Att 3rd']].map(([k,l]) => (
                            <button key={k} onClick={() => setDefZone(k)} className={`flex-1 border-2 border-black p-1.5 font-black text-[10px] ${defZone === k ? 'bg-black text-white' : 'bg-white hover:bg-[#FFD166]'}`}>{l}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block mb-1 text-gray-500">Time Range (min)</label>
                        <div className="flex items-center gap-2">
                          <input type="number" className="w-1/2 border-2 border-black p-1.5 text-xs font-black" value={defMinMin} min={0} max={absoluteMaxMinute} onChange={e => setDefMinMin(parseInt(e.target.value) || 0)} />
                          <span className="text-xs font-black">TO</span>
                          <input type="number" className="w-1/2 border-2 border-black p-1.5 text-xs font-black" value={defMaxMin} min={0} max={absoluteMaxMinute} onChange={e => setDefMaxMin(parseInt(e.target.value) || absoluteMaxMinute)} />
                        </div>
                      </div>
                    </div>
                  </BrutalistCard>
                </section>

                <section>
                  <h3 className="text-xl font-black uppercase border-b-4 border-black inline-block pb-1 mb-6">Defensive Density Heatmaps</h3>
                  <div className="space-y-3 mb-6">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-black uppercase text-gray-500">Filter Action {defActionFilter.size > 0 && <span className="text-black">({defActionFilter.size} selected)</span>}</label>
                        {defActionFilter.size > 0 && (
                          <button onClick={() => setDefActionFilter(new Set())} className="text-[9px] font-black uppercase border border-black px-1.5 py-0.5 hover:bg-[#FFD166]">Clear</button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {defActions.map(a => {
                          const active = defActionFilter.has(a)
                          return (
                            <button
                              key={a}
                              onClick={() => setDefActionFilter(prev => { const n = new Set(prev); n.has(a) ? n.delete(a) : n.add(a); return n })}
                              className={`text-[10px] font-black uppercase border-2 border-black px-2 py-1 transition-all ${active ? 'bg-black text-white' : 'bg-white text-black hover:bg-[#FFD166]'}`}
                            >{a}</button>
                          )
                        })}
                      </div>
                      {defActionFilter.size === 0 && <p className="text-[9px] font-bold uppercase text-gray-400 mt-1 italic">None selected → all defensive actions shown</p>}
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-black uppercase text-gray-500">Filter Outcome {defOutcomeFilter.size > 0 && <span className="text-black">({defOutcomeFilter.size} selected)</span>}</label>
                        {defOutcomeFilter.size > 0 && (
                          <button onClick={() => setDefOutcomeFilter(new Set())} className="text-[9px] font-black uppercase border border-black px-1.5 py-0.5 hover:bg-[#FFD166]">Clear</button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {availableDefOutcomes.map(o => {
                          const active = defOutcomeFilter.has(o)
                          return (
                            <button
                              key={o}
                              onClick={() => setDefOutcomeFilter(prev => { const n = new Set(prev); n.has(o) ? n.delete(o) : n.add(o); return n })}
                              className={`text-[10px] font-black uppercase border-2 border-black px-2 py-1 transition-all ${active ? 'bg-black text-white' : 'bg-white text-black hover:bg-[#FFD166]'}`}
                            >{o}</button>
                          )
                        })}
                      </div>
                      {defOutcomeFilter.size === 0 && <p className="text-[9px] font-bold uppercase text-gray-400 mt-1 italic">None selected → all outcomes shown</p>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-8">
                    {(() => {
                      const matchActionSet = (e) => defActionFilter.size === 0 ? defActions.includes(e.action) : defActionFilter.has(e.action)
                      const matchOutcomeSet = (e) => defOutcomeFilter.size === 0 || defOutcomeFilter.has(e.outcome)
                      const filt = (teamId) => defFilteredEvents.filter(e => e.team_id === teamId && matchActionSet(e) && matchOutcomeSet(e))
                      return (
                        <>
                          <HeatmapPitch events={filt(match.home_team_id)} teamName={match.home_team?.team_name} isHome={true} isFutsal={isFutsal} />
                          <HeatmapPitch events={filt(match.away_team_id)} teamName={match.away_team?.team_name} isHome={false} isFutsal={isFutsal} />
                        </>
                      )
                    })()}
                  </div>
                </section>
                <section>
                  <h3 className="text-xl font-black uppercase border-b-4 border-black inline-block pb-1 mb-6">Defense Statistics</h3>
                  <BrutalistCard>
                    {[
                      { key: 'defense_overview',         title: 'Ball Winning Overview' },
                      { key: 'defense_pass_intercepts',  title: 'Pass Intercepts' },
                      { key: 'defense_tackles',          title: 'Tackles' },
                      { key: 'defense_blocks',           title: 'Blocks' },
                      { key: 'defense_saves',            title: 'Saves' },
                      { key: 'defense_clearances',       title: 'Clearances' },
                      { key: 'defense_work_rate',        title: 'Total Defensive Actions' },
                      { key: 'defense_discipline',       title: 'Discipline' },
                      { key: 'defense_pressing',         title: 'Pressing Intensity (PPDA)' }
                    ].map(section => (
                      <div key={section.key} className="mb-6 last:mb-0">
                        <h4 className="text-sm font-black uppercase text-gray-400 mb-2 flex items-center gap-2"><Shield size={14} /> {section.title}</h4>
                        {renderStatRows(section.key, defenseStatsFiltered?.home, defenseStatsFiltered?.away, {
                          defense_total_regained: () => setDefenseModal({
                            title: 'Total Regained Possession',
                            filterFn: e =>
                              ['Pass Intercept', 'Standing Tackle', 'Sliding Tackle', 'Block'].includes(e.action) &&
                              e.outcome === 'Successful' &&
                              e.type === 'With Possession',
                          }),
                          defense_ground_duels_won: () => setDefenseModal({
                            title: 'Ground Duels Won',
                            filterFn: e =>
                              (e.action === 'Dribble' && (e.outcome === 'Successful' || e.outcome === 'Foul Won')) ||
                              (['Standing Tackle', 'Sliding Tackle'].includes(e.action) && e.outcome === 'Successful' && e.type === 'With Possession'),
                          }),
                          defense_aerial_duels_won: () => setDefenseModal({
                            title: 'Aerial Duels Won',
                            filterFn: e =>
                              e.action === 'Pass Intercept' && e.outcome === 'Successful' && e.body_part === 'Head',
                          }),
                          defense_lost_ball_control: () => setDefenseModal({
                            title: 'Lost Ball Control',
                            filterFn: e => e.action === 'Ball Control',
                          }),
                        })}
                      </div>
                    ))}
                  </BrutalistCard>
                </section>

                {/* Defensive Match-ups — player vs player matrix */}
                <section>
                  <h3 className="text-xl font-black uppercase border-b-4 border-black inline-block pb-1 mb-6">Defensive Match-ups</h3>
                  <div className="mb-4">
                    <label className="block mb-1 text-[10px] font-black uppercase text-gray-500">Filter Action</label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        ['ALL', 'All Defensive'],
                        ['Pass Intercept', 'Pass Intercept'],
                        ['Standing Tackle', 'Standing Tackle'],
                        ['Sliding Tackle', 'Sliding Tackle'],
                        ['Block', 'Block'],
                        ['Save', 'Save'],
                        ['Pressure', 'Pressure'],
                        ['Ground Duels', 'Ground Duels'],
                        ['Aerial Duels', 'Aerial Duels'],
                      ].map(([key, label]) => (
                        <button
                          key={key}
                          onClick={() => setDefMatrixAction(key)}
                          className={`text-[10px] font-black uppercase border-2 border-black px-2 py-1 transition-all ${defMatrixAction === key ? 'bg-black text-white' : 'bg-white text-black hover:bg-[#FFD166]'}`}
                        >{label}</button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <PlayerDefenseMatrix
                      events={defFilteredEvents}
                      lineups={lineups}
                      defenderTeamId={match.home_team_id}
                      attackerTeamId={match.away_team_id}
                      actionFilter={defMatrixAction}
                      aerialMatches={(defenseStatsFiltered?.aerialMatches || []).filter(m => m.teamId === match.home_team_id)}
                      defenderColor="#0077B6"
                      defenderTeamName={match.home_team?.team_name}
                      attackerTeamName={match.away_team?.team_name}
                    />
                    <PlayerDefenseMatrix
                      events={defFilteredEvents}
                      lineups={lineups}
                      defenderTeamId={match.away_team_id}
                      attackerTeamId={match.home_team_id}
                      actionFilter={defMatrixAction}
                      aerialMatches={(defenseStatsFiltered?.aerialMatches || []).filter(m => m.teamId === match.away_team_id)}
                      defenderColor="#D90429"
                      defenderTeamName={match.away_team?.team_name}
                      attackerTeamName={match.home_team?.team_name}
                    />
                  </div>
                  <p className="text-[9px] font-bold uppercase text-gray-400 mt-3 italic">Cells coloured by frequency · hover for full names · pairs with no events are blank</p>
                </section>

                {/* Defense Modal — pitch view of ball-winning event locations */}
                {defenseModal && (() => {
                  const filteredHome = defFilteredEvents.filter(e => e.team_id === match.home_team_id && defenseModal.filterFn(e))
                  const filteredAway = defFilteredEvents.filter(e => e.team_id === match.away_team_id && defenseModal.filterFn(e))
                  return (
                    <div
                      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto"
                      onClick={() => setDefenseModal(null)}
                    >
                      <div
                        className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-6xl w-full p-5 my-auto"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-start justify-between border-b-2 border-black pb-3 mb-4">
                          <div>
                            <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Defense Map</p>
                            <h3 className="text-2xl font-black uppercase tracking-tighter">{defenseModal.title}</h3>
                            <p className="text-[10px] font-bold uppercase text-gray-500 mt-1">
                              <span style={{ color: '#0077B6' }}>{match.home_team?.team_name}: {filteredHome.length}</span>
                              {' · '}
                              <span style={{ color: '#D90429' }}>{match.away_team?.team_name}: {filteredAway.length}</span>
                            </p>
                          </div>
                          <button
                            onClick={() => setDefenseModal(null)}
                            className="border-2 border-black px-3 py-1 font-black text-sm bg-white hover:bg-[#FFD166] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                          >✕ CLOSE</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <HeatmapPitch
                            events={filteredHome}
                            teamName={match.home_team?.team_name}
                            isHome={true}
                            isFutsal={isFutsal}
                          />
                          <HeatmapPitch
                            events={filteredAway}
                            teamName={match.away_team?.team_name}
                            isHome={false}
                            isFutsal={isFutsal}
                          />
                        </div>
                        <p className="text-[9px] font-bold uppercase text-gray-400 mt-3">Heat density shows where each team's ball-winning events occurred on the pitch.</p>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* PLAYER TAB */}
            {activeTab === 'PLAYER' && (
              <div className="space-y-12">

                {/* ── CAC POINTS TABLE ── */}
                <section>
                  <button
                    onClick={() => setCacPointsOpen(o => !o)}
                    className="flex items-center gap-3 text-xl font-black uppercase border-b-4 border-black pb-1 mb-4 hover:text-gray-600 transition-colors w-full text-left"
                  >
                    <span>CAC Points System</span>
                    <span className="text-sm">{cacPointsOpen ? '▲' : '▼'}</span>
                  </button>
                  {cacPointsOpen && <><div className="overflow-x-auto">
                    <table className="border-4 border-black text-[11px] font-black uppercase w-full">
                      <thead>
                        <tr className="bg-black text-white">
                          <th className="px-3 py-2 text-left border-r-2 border-gray-600">Action</th>
                          <th className="px-3 py-2 text-center border-r-2 border-gray-600">Points</th>
                          <th className="px-3 py-2 text-left text-gray-300 font-bold normal-case">Condition</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { section: 'ATTACKING', bg: 'bg-[#0077B6] text-white' },
                          { action: 'Goal',                    pts: '+10', note: 'Shoot → Goal' },
                          { action: 'Penalty Won',             pts: '+3',  note: 'Foul Won → Penalty' },
                          { action: 'Shot on Target (In Box)', pts: '+2',  note: 'Shoot → Save inside penalty box' },
                          { action: 'Shot on Target (Out)',    pts: '+1',  note: 'Shoot → Save outside penalty box' },
                          { action: 'Big Chance Missed',       pts: '−2',  note: 'Shoot off-target/blocked with xG ≥ 0.30', neg: true },
                          { section: 'PASSING', bg: 'bg-[#06D6A0] text-black' },
                          { action: 'Assist',                  pts: '+6',  note: 'Pass → Assist' },
                          { action: 'Key Pass',                pts: '+3',  note: 'Pass → Key Pass' },
                          { action: 'Pass into Box',           pts: '+2',  note: 'Successful pass ending inside attacking penalty box' },
                          { action: 'Progressive Pass',        pts: '+1',  note: 'Successful forward pass ≥ threshold in/to attacking third' },
                          { action: 'Accurate Cross',          pts: '+1',  note: 'Successful pass from wide position into attacking box' },
                          { section: 'DEFENDING', bg: 'bg-[#8338EC] text-white' },
                          { action: 'Block (Def Box)',         pts: '+3',  note: 'Successful block inside defensive penalty box' },
                          { action: 'Block (Def 3rd)',         pts: '+2',  note: 'Successful block in defensive third (outside box)' },
                          { action: 'Ball Recovery',           pts: '+2',  note: 'Possession won via any recovery/tackle/intercept' },
                          { action: 'Tackle Won',              pts: '+2',  note: 'Standing/Sliding Tackle → Successful' },
                          { action: 'Interception',            pts: '+2',  note: 'Pass Intercept → Successful' },
                          { action: 'Clearance',               pts: '+1',  note: 'Clearance action' },
                          { action: 'Aerial Duel Won',         pts: '+1',  note: 'Aerial Duel → Successful' },
                          { section: 'POSSESSION', bg: 'bg-[#FFD166] text-black' },
                          { action: 'Successful Dribble',      pts: '+1',  note: 'Dribble → Successful' },
                          { action: 'Foul Drawn',              pts: '+1',  note: 'Foul Won (non-penalty)' },
                          { action: 'Dispossessed',            pts: '−1',  note: 'Outcome → Dispossessed', neg: true },
                          { section: 'DISCIPLINE', bg: 'bg-[#D90429] text-white' },
                          { action: 'Foul Committed',          pts: '−1',  note: 'Outcome → Foul (non-penalty)', neg: true },
                          { action: 'Yellow Card',             pts: '−2',  note: 'Type → Yellow Card', neg: true },
                          { action: 'Penalty Conceded',        pts: '−4',  note: 'Outcome → Foul (Penalty)', neg: true },
                          { action: 'Own Goal',                pts: '−5',  note: 'Shoot → Own Goal', neg: true },
                          { action: 'Red Card',                pts: '−6',  note: 'Type → Red Card', neg: true },
                        ].map((row, i) => row.section ? (
                          <tr key={`s${i}`} className={row.bg}>
                            <td colSpan={3} className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest">{row.section}</td>
                          </tr>
                        ) : (
                          <tr key={i} className={`border-b border-black/10 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                            <td className="px-3 py-1.5 border-r-2 border-black">{row.action}</td>
                            <td className={`px-3 py-1.5 border-r-2 border-black text-center font-black ${row.neg ? 'bg-[#D90429] text-white' : 'bg-[#FFD166]'}`}>{row.pts}</td>
                            <td className="px-3 py-1.5 text-gray-500 normal-case font-bold">{row.note}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[9px] font-bold uppercase text-gray-400 mt-2">GK excluded from all rankings</p>
                  </>}
                </section>

                {/* ── CAC PLAYER POINTS ── */}
                <section>
                  <div className="border-b-4 border-black pb-2 mb-6 flex items-end gap-4">
                    <h2 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-3"><Users size={32} /> CAC Player Points</h2>
                    <span className="text-[10px] font-black uppercase text-gray-400 mb-1">GK excluded · sorted by total</span>
                  </div>
                  <BrutalistCard>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs font-bold uppercase">
                        <thead>
                          <tr className="border-b-4 border-black text-left text-[10px] text-gray-500">
                            <th className="py-2 pr-3 w-8">#</th>
                            <th className="py-2 pr-3 w-8">No.</th>
                            <th className="py-2 pr-4">Player</th>
                            <th className="py-2 pr-3">Team</th>
                            <th className="py-2 text-right text-black">CAC Pts</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cacPlayerPoints.map((p, i) => {
                            const isExpanded = cacExpandedId === p.playerId
                            const rowBg = i === 0 ? 'bg-[#FFD166]' : i < 3 ? 'bg-[#fff9e6]' : 'hover:bg-gray-50'
                            const breakdown = Object.entries(p.cats || {})
                              .filter(([, cnt]) => cnt !== 0)
                              .map(([cat, cnt]) => ({
                                label: cat.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()),
                                pts: p.PTS[cat],
                                count: cnt,
                                total: cnt * (p.PTS[cat] || 0),
                                neg: (p.PTS[cat] || 0) < 0,
                              }))
                              .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
                            return (
                              <>
                                <tr key={p.playerId} className={`border-b border-gray-200 ${rowBg}`}>
                                  <td className="py-2 pr-3 font-black text-gray-400">{i + 1}</td>
                                  <td className="py-2 pr-3">
                                    <span className={`px-1.5 py-0.5 border text-[10px] font-black ${p.isHome ? 'border-[#0077B6] text-[#0077B6]' : 'border-[#D90429] text-[#D90429]'}`}>
                                      #{p.jersey}
                                    </span>
                                  </td>
                                  <td className="py-2 pr-4 font-black">{p.name}</td>
                                  <td className="py-2 pr-3 text-gray-500 text-[10px]">{p.teamName}</td>
                                  <td className="py-2 text-right">
                                    <button
                                      onClick={() => setCacExpandedId(isExpanded ? null : p.playerId)}
                                      className={`font-black text-base px-2 py-0.5 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all ${isExpanded ? 'bg-black text-white' : 'bg-white hover:bg-[#FFD166]'}`}
                                    >
                                      {p.total} {isExpanded ? '▲' : '▼'}
                                    </button>
                                  </td>
                                </tr>
                                {isExpanded && (
                                  <tr key={`${p.playerId}-breakdown`} className="border-b-2 border-black">
                                    <td colSpan={5} className="px-4 py-3 bg-black text-white">
                                      <div className="flex flex-wrap gap-3">
                                        {breakdown.map((b, bi) => (
                                          <div key={bi} className="flex items-center gap-1.5 bg-white/10 border border-white/30 px-2 py-1 text-[10px] font-black uppercase">
                                            <span className="text-gray-300">{b.label}</span>
                                            <span className={b.neg ? 'text-[#ff6b6b]' : 'text-[#FFD166]'}>
                                              {b.count} × {b.pts > 0 ? '+' : ''}{b.pts} = {b.total > 0 ? '+' : ''}{b.total}
                                            </span>
                                          </div>
                                        ))}
                                        <div className="flex items-center gap-1.5 border-l border-white/30 pl-3 ml-auto text-[10px] font-black uppercase">
                                          <span className="text-gray-300">Total</span>
                                          <span className="text-[#FFD166] text-sm">{p.total} pts</span>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    {/* point key */}
                    <div className="mt-4 pt-3 border-t-2 border-black flex flex-wrap gap-x-4 gap-y-1 text-[9px] font-bold uppercase text-gray-500">
                      <span className="text-[#0077B6]">Goal +10</span><span className="text-[#0077B6]">Pen Won +3</span><span className="text-[#0077B6]">SoT Box +2 / Out +1</span><span className="text-[#D90429]">Big Chance Missed −2</span>
                      <span className="text-[#06D6A0]">Assist +6</span><span className="text-[#06D6A0]">Key Pass +3</span><span className="text-[#06D6A0]">Pass in Box +2</span><span className="text-[#06D6A0]">Prog Pass +1</span>
                      <span className="text-[#8338EC]">Block Def Box +3</span><span className="text-[#8338EC]">Recovery/Tackle/Intercept +2</span><span className="text-[#8338EC]">Clearance +1</span>
                      <span>Dribble +1</span><span>Foul Drawn +1</span><span className="text-[#D90429]">Yellow −2 · Red −6 · Pen Conceded −4 · OG −5</span>
                    </div>
                  </BrutalistCard>
                </section>

                {/* ── MATCH LEADERS ── */}
                <section>
                  <h3 className="text-xl font-black uppercase border-b-4 border-black inline-block pb-1 mb-6">Match Leaders</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {matchLeaders.map((leader, i) => <LeaderCard key={i} leader={leader} />)}
                  </div>
                </section>

                {/* ── PLAYER COMPARISON ── */}
                <section>
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

                      {/* ── PITCH COMPARISON ── */}
                      <BrutalistCard>
                        <h4 className="text-sm font-black uppercase text-gray-400 mb-4">Pitch Heatmap</h4>
                        {/* Shared filters */}
                        <div className="flex flex-wrap gap-2 mb-4">
                          <select
                            className="border-2 border-black p-1.5 font-black text-[10px] uppercase flex-1 min-w-[120px]"
                            value={cmpAction}
                            onChange={e => { setCmpAction(e.target.value); setCmpOutcome('ALL'); setCmpType('ALL') }}
                          >
                            <option value="ALL">All Actions</option>
                            {Array.from(new Set(enrichedEvents.map(e => e.action))).filter(Boolean).sort().map(a => (
                              <option key={a} value={a}>{a}</option>
                            ))}
                          </select>
                          <select
                            className="border-2 border-black p-1.5 font-black text-[10px] uppercase flex-1 min-w-[120px]"
                            value={cmpOutcome}
                            onChange={e => { setCmpOutcome(e.target.value); setCmpType('ALL') }}
                          >
                            <option value="ALL">All Outcomes</option>
                            {Array.from(new Set(enrichedEvents.filter(e => cmpAction === 'ALL' || e.action === cmpAction).map(e => e.outcome))).filter(Boolean).sort().map(o => (
                              <option key={o} value={o}>{o}</option>
                            ))}
                          </select>
                          <select
                            className="border-2 border-black p-1.5 font-black text-[10px] uppercase flex-1 min-w-[120px]"
                            value={cmpType}
                            onChange={e => setCmpType(e.target.value)}
                          >
                            <option value="ALL">All Types</option>
                            {Array.from(new Set(enrichedEvents.filter(e => (cmpAction === 'ALL' || e.action === cmpAction) && (cmpOutcome === 'ALL' || e.outcome === cmpOutcome)).map(e => e.type))).filter(t => t && t !== 'NA').sort().map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => { setCmpAction('ALL'); setCmpOutcome('ALL'); setCmpType('ALL') }}
                            className="border-2 border-black px-3 py-1.5 font-black text-[10px] uppercase bg-white hover:bg-[#FFD166] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                          >Reset</button>
                        </div>
                        {/* Side by side pitches */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] font-black uppercase text-[#0077B6] mb-1">
                              #{p1Data.info.jersey_no} {p1Data.info.players?.player_name} — {enrichedEvents.filter(e => e.player_id === p1PlayerId && (cmpAction === 'ALL' || e.action === cmpAction) && (cmpOutcome === 'ALL' || e.outcome === cmpOutcome) && (cmpType === 'ALL' || e.type === cmpType)).length} events
                            </p>
                            <HeatmapPitch
                              events={enrichedEvents.filter(e => e.player_id === p1PlayerId && (cmpAction === 'ALL' || e.action === cmpAction) && (cmpOutcome === 'ALL' || e.outcome === cmpOutcome) && (cmpType === 'ALL' || e.type === cmpType))}
                              teamName={p1Data.info.players?.player_name}
                              isHome={true}
                              isFutsal={isFutsal}
                              showEvents={cmpAction !== 'ALL' || cmpOutcome !== 'ALL' || cmpType !== 'ALL'}
                            />
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase text-[#D90429] mb-1">
                              #{p2Data.info.jersey_no} {p2Data.info.players?.player_name} — {enrichedEvents.filter(e => e.player_id === p2PlayerId && (cmpAction === 'ALL' || e.action === cmpAction) && (cmpOutcome === 'ALL' || e.outcome === cmpOutcome) && (cmpType === 'ALL' || e.type === cmpType)).length} events
                            </p>
                            <HeatmapPitch
                              events={enrichedEvents.filter(e => e.player_id === p2PlayerId && (cmpAction === 'ALL' || e.action === cmpAction) && (cmpOutcome === 'ALL' || e.outcome === cmpOutcome) && (cmpType === 'ALL' || e.type === cmpType))}
                              teamName={p2Data.info.players?.player_name}
                              isHome={false}
                              isFutsal={isFutsal}
                              showEvents={cmpAction !== 'ALL' || cmpOutcome !== 'ALL' || cmpType !== 'ALL'}
                            />
                          </div>
                        </div>
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
                        {hlFilterOptions.types.length > 0 && (
                          <select className="border-2 border-black p-1 font-black text-[10px] uppercase" value={hlType} onChange={e => { setHlType(e.target.value); setHlBrushBounds(null) }}>
                            <option value="ALL">All Types</option>
                            {hlFilterOptions.types.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        )}
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

                {/* ── AI ANALYSIS ── */}
                <section>
                  <div className="border-b-4 border-black pb-2 mb-6 flex items-end justify-between flex-wrap gap-3">
                    <h2 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-3"><Edit3 size={32} /> Match Analysis</h2>
                    <div className="flex items-center gap-3">
                      {analysisSaved && analysisGeneratedAt && (
                        <span className="text-[10px] font-bold text-gray-400 uppercase">
                          Saved · {new Date(analysisGeneratedAt).toLocaleDateString()}
                        </span>
                      )}
                      <button
                        onClick={generateAnalysis}
                        disabled={analysisLoading}
                        className="flex items-center gap-2 border-2 border-black px-4 py-2 font-black uppercase text-xs shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-[#FFD166] transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                      >
                        {analysisLoading ? (
                          <><RefreshCw size={12} className="animate-spin" /> Generating...</>
                        ) : analysisText ? (
                          <><RefreshCw size={12} /> Regenerate</>
                        ) : (
                          <>✦ Generate Analysis</>
                        )}
                      </button>
                    </div>
                  </div>

                  {analysisLoading && (
                    <BrutalistCard color="bg-[#f8fafc]">
                      <div className="flex items-center gap-3 py-8 justify-center text-gray-400 font-bold uppercase text-sm animate-pulse">
                        <RefreshCw size={16} className="animate-spin" />
                        Groq AI is analysing match data…
                      </div>
                    </BrutalistCard>
                  )}

                  {!analysisLoading && analysisText && (
                    <BrutalistCard color="bg-white">
                      {analysisSaved && (
                        <div className="flex items-center gap-2 mb-4 text-[10px] font-black uppercase text-[#06D6A0] border-b-2 border-black pb-3">
                          <span className="w-2 h-2 rounded-full bg-[#06D6A0] inline-block" />
                          Saved to Supabase
                        </div>
                      )}
                      <div className="prose prose-sm max-w-none font-mono text-sm leading-relaxed whitespace-pre-wrap text-gray-800">
                        {analysisText}
                      </div>
                    </BrutalistCard>
                  )}

                  {!analysisLoading && !analysisText && (
                    <BrutalistCard color="bg-[#f8fafc]">
                      <div className="py-10 text-center text-gray-400 font-bold uppercase text-sm">
                        <p className="mb-2">No analysis yet.</p>
                        <p className="text-[10px]">Click "Generate Analysis" to let Groq AI write the match report.</p>
                      </div>
                    </BrutalistCard>
                  )}
                </section>

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
        <a href="https://calcioac.com" target="_blank" rel="noreferrer" className="hover:text-black transition-colors">CAC Analytics Engine</a>
      </footer>

      {matchContext && <MatchChatBot matchContext={matchContext} />}
    </div>
  )
}
