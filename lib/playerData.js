// Data layer for the multi-match player report (/player/[id]).
// Reads processed_match_events only (never raw match_events). Loads the whole
// processed pool once, because percentiles compare against every
// non-placeholder CAC player with enough minutes in the same format.

import { fetchSupabase } from './supabase.js'
import {
  computeMatchStats, computeMinutes, sumStats, deriveValues, positionGroup, percentile,
  consistencyScore, impactScore, matchLength, minPoolMinutes, RADAR_METRICS, BROAD_GROUP, GROUP_LABEL,
} from './playerStats.js'
import { PLAYER_STATS, PLAYER_KEY_NUMBERS } from './statsRegistry.js'

const PAGE = 1000
const MIN_POOL = 8 // fall back to a broader position group below this

const EVENT_COLS = [
  'processed_event_id', 'match_event_id', 'match_id', 'half', 'match_minute', 'match_time_seconds',
  'start_x', 'start_y', 'end_x', 'end_y', 'end_z', 'gk_x', 'gk_y', 'action', 'outcome', 'type', 'body_part',
  'player_id', 'reaction_player_id', 'is_futsal', 'pressure_on', 'shot_technique', 'first_time_shot', 'assist_type',
].join(',')

async function fetchAll(table, params) {
  let out = [], offset = 0
  while (true) {
    const rows = await fetchSupabase(table, { ...params, limit: PAGE, offset })
    out = out.concat(rows || [])
    if (!rows || rows.length < PAGE) break
    offset += PAGE
  }
  return out
}

const toNum = (v) => (v == null ? null : parseFloat(v))
const normEvent = (e) => ({
  ...e,
  start_x: toNum(e.start_x), start_y: toNum(e.start_y), end_x: toNum(e.end_x), end_y: toNum(e.end_y),
  end_z: toNum(e.end_z), gk_x: toNum(e.gk_x), gk_y: toNum(e.gk_y),
  match_time_seconds: toNum(e.match_time_seconds), match_minute: toNum(e.match_minute),
})

let _poolCache = null
/** Drop the cached pool (the server calls this so each request sees fresh data). */
export function resetPoolCache() { _poolCache = null }
/** Everything needed for the report and the percentile pool. Cached per page load. */
export async function loadPool() {
  if (_poolCache) return _poolCache
  _poolCache = (async () => {
    const [matches, lineups, players, events] = await Promise.all([
      fetchAll('matches', {
        // '*' so optional columns (tagging_mode, focus fields, exclude_from_reports) are read when present
        select: '*,home_team:teams!matches_home_team_id_fkey(team_name),away_team:teams!matches_away_team_id_fkey(team_name)',
        order: 'match_date.asc',
      }),
      fetchAll('lineups', { select: 'match_id,player_id,team_id,jersey_no,starting_xi,position,substitution_in_time,substitution_off_time,match_duration', order: 'match_id.asc,player_id.asc' }),
      fetchAll('players', { select: 'player_id,player_name,position,team_id,is_placeholder,teams(team_name)', order: 'player_id.asc' }),
      fetchAll('processed_match_events', { select: EVENT_COLS, order: 'processed_event_id.asc' }),
    ])
    return buildPool({ matches, lineups, players, events: events.map(normEvent) })
  })()
  try { return await _poolCache } catch (e) { _poolCache = null; throw e }
}

function buildPool({ matches, lineups, players, events }) {
  const playerById = Object.fromEntries(players.map(p => [p.player_id, p]))
  const isPlaceholder = (pid) => playerById[pid]?.is_placeholder === true
  const matchById = Object.fromEntries(matches.map(m => [m.match_id, m]))

  const eventsByMatch = {}
  events.forEach(e => { (eventsByMatch[e.match_id] ||= []).push(e) })
  Object.values(eventsByMatch).forEach(list => list.sort((a, b) => (a.match_time_seconds ?? 0) - (b.match_time_seconds ?? 0)))

  const lineupByMatch = {}
  lineups.forEach(l => { (lineupByMatch[l.match_id] ||= {})[l.player_id] = l })

  // Per (match, player) rows for every non-placeholder player who played
  const rows = []
  Object.entries(eventsByMatch).forEach(([matchId, mEvents]) => {
    const match = matchById[matchId]
    if (!match || match.exclude_from_reports) return // hidden in Admin Portal → Matches
    const isFutsal = match.is_futsal !== false
    const lu = lineupByMatch[matchId] || {}
    const teamOf = {}
    Object.values(lu).forEach(l => { teamOf[l.player_id] = l.team_id })
    mEvents.forEach(e => { if (e.player_id && !teamOf[e.player_id]) teamOf[e.player_id] = playerById[e.player_id]?.team_id })

    const actorIdx = {}, reactIdx = {}
    mEvents.forEach(e => {
      if (e.action === 'Match Time') return
      if (e.player_id) (actorIdx[e.player_id] ||= []).push(e)
      if (e.reaction_player_id) (reactIdx[e.reaction_player_id] ||= []).push(e)
    })
    const candidates = new Set([...Object.keys(lu), ...Object.keys(actorIdx)])
    const withTeamContext = (match.tagging_mode || 'full') !== 'player'

    // One-team matches only describe the tagged team; one-player matches only the focus player
    const mode = match.tagging_mode || 'full'
    const counts = (pid) => mode === 'full' ? true
      : mode === 'player' ? pid === match.focus_player_id
      : !match.focus_team_id || teamOf[pid] === match.focus_team_id

    candidates.forEach(pid => {
      if (!playerById[pid] || isPlaceholder(pid) || !counts(pid)) return
      const actor = actorIdx[pid] || [], reaction = reactIdx[pid] || []
      const { minutes, approx } = computeMinutes({ lineup: lu[pid], playerId: pid, matchEvents: mEvents, actor, reaction, isFutsal })
      if (minutes <= 0 && !actor.length) return
      const teamId = teamOf[pid]
      const stats = computeMatchStats({ actor, reaction, matchEvents: mEvents, teamOf, teamId, isFutsal, withTeamContext })
      rows.push({ matchId, playerId: pid, teamId, isFutsal, minutes, approx, stats, actor, reaction, withTeamContext })
    })
  })

  return { matches, matchById, playerById, lineupByMatch, eventsByMatch, rows }
}

/* ── Aggregation per player for one format ─────────────────── */
function aggregate(rows, isFutsal) {
  const minutes = rows.reduce((a, r) => a + r.minutes, 0)
  const totals = sumStats(rows.map(r => r.stats))
  const locs = rows.flatMap(r => r.actor).filter(e => e.start_x != null && e.action !== 'Substitution')
  const avgX = locs.length ? locs.reduce((a, e) => a + e.start_x, 0) / locs.length : null
  const avgY = locs.length ? locs.reduce((a, e) => a + e.start_y, 0) / locs.length : null
  return { minutes, totals, values: deriveValues(totals, minutes, isFutsal), avgX, avgY }
}

const leagueOf = (pool, r) => pool.matchById[r.matchId]?.tournament_name || 'Other'

/** Comparison pool: same format, optionally only rows from the given leagues (Set). */
function poolFor(pool, isFutsal, leagues = null) {
  const byPlayer = {}
  pool.rows.filter(r => r.isFutsal === isFutsal && (!leagues || leagues.has(leagueOf(pool, r))))
    .forEach(r => { (byPlayer[r.playerId] ||= []).push(r) })
  return Object.entries(byPlayer).map(([pid, rs]) => {
    const agg = aggregate(rs, isFutsal)
    const pl = pool.playerById[pid]
    return { playerId: pid, ...agg, ...positionGroup(pl?.position, agg.avgX, agg.avgY, isFutsal) }
  }).filter(p => p.minutes >= minPoolMinutes(isFutsal))
}

/**
 * Matches a player appears in (lineup or events) that have processed data.
 * @returns {Promise<Array>} match rows, oldest first
 */
export async function processedMatchesFor(playerId) {
  const pool = await loadPool()
  const ids = new Set(pool.rows.filter(r => r.playerId === playerId).map(r => r.matchId))
  return pool.matches.filter(m => ids.has(m.match_id))
}

/**
 * Full report model for one player.
 * @param {string} playerId
 * @param {string[]|null} matchIds  null = every processed match the player appears in
 * @param {boolean|null} format     force futsal (true) / 11-a-side (false); null = majority of minutes
 */
/**
 * @param {string[]|null} compareWith  leagues (tournament names) for the percentile pool:
 *   null = the player's own league(s) in this report, [] = every league
 */
export async function loadPlayerReport(playerId, matchIds = null, format = null, compareWith = null) {
  const pool = await loadPool()
  const player = pool.playerById[playerId]
  if (!player) throw new Error('Player not found.')

  let myRows = pool.rows.filter(r => r.playerId === playerId)
  const missing = []
  if (matchIds?.length) {
    const want = new Set(matchIds)
    const have = new Set(myRows.map(r => r.matchId))
    matchIds.forEach(id => { if (!have.has(id)) missing.push(pool.matchById[id] || { match_id: id }) })
    myRows = myRows.filter(r => want.has(r.matchId))
  }
  if (!myRows.length) {
    return { player, empty: true, missing }
  }

  // One format per report; mixed reports can be switched on the page
  const minsBy = { true: 0, false: 0 }
  myRows.forEach(r => { minsBy[r.isFutsal] += r.minutes })
  const formats = [true, false].filter(f => myRows.some(r => r.isFutsal === f))
  const isFutsal = format != null && formats.includes(format) ? format : minsBy.true > minsBy.false
  myRows = myRows.filter(r => r.isFutsal === isFutsal)

  const me = aggregate(myRows, isFutsal)
  const { group, inferred } = positionGroup(player.position, me.avgX, me.avgY, isFutsal)

  // Percentile pool: same format and league(s), same position group; broaden the
  // position group (never the leagues) when there are too few players
  const ownLeagues = [...new Set(myRows.map(r => leagueOf(pool, r)))]
  const compareLeagues = compareWith == null ? ownLeagues : compareWith
  const everyone = poolFor(pool, isFutsal, compareLeagues.length ? new Set(compareLeagues) : null)
  // Leagues available to compare against in this format, with eligible player counts
  const allEligible = poolFor(pool, isFutsal)
  const leagueOptions = [...new Set(pool.rows.filter(r => r.isFutsal === isFutsal).map(r => leagueOf(pool, r)))].sort()
    .map(name => ({ name, players: poolFor(pool, isFutsal, new Set([name])).length }))
  let poolGroup = group
  let peers = everyone.filter(p => p.group === group)
  if (peers.length < MIN_POOL && group !== 'goalkeeper') {
    poolGroup = BROAD_GROUP[group]
    peers = everyone.filter(p => BROAD_GROUP[p.group] === poolGroup)
  }
  if (peers.length < MIN_POOL && group !== 'goalkeeper') {
    poolGroup = 'outfield'
    peers = everyone.filter(p => p.group !== 'goalkeeper')
  }
  const percentiles = {}
  Object.keys(PLAYER_STATS).forEach(k => {
    percentiles[k] = percentile(me.values[k], peers.map(p => p.values[k]), PLAYER_STATS[k].lowerIsBetter)
  })

  // Match by match
  const perMatch = myRows.map(r => {
    const m = pool.matchById[r.matchId]
    const oppName = r.teamId === m.home_team_id ? m.away_team?.team_name : m.home_team?.team_name
    const teamName = r.teamId === m.home_team_id ? m.home_team?.team_name : m.away_team?.team_name
    return {
      match: m, oppName, teamName, minutes: r.minutes, approx: r.approx, stats: r.stats,
      per90: deriveValues(r.stats, r.minutes, isFutsal), impact: impactScore(r.stats, r.minutes, isFutsal),
      actor: r.actor, reaction: r.reaction, withTeamContext: r.withTeamContext,
    }
  }).sort((a, b) => String(a.match.match_date || '').localeCompare(String(b.match.match_date || '')))

  const rated = perMatch.filter(m => m.impact != null)
  const best = rated.length > 1 ? rated.reduce((a, b) => (b.impact > a.impact ? b : a)) : null
  const worst = rated.length > 1 ? rated.reduce((a, b) => (b.impact < a.impact ? b : a)) : null

  const radarKeys = RADAR_METRICS[group] || RADAR_METRICS.midfielder
  const consistency = consistencyScore(perMatch, radarKeys.filter(k => PLAYER_STATS[k]?.kind === 'p90'), isFutsal)

  const teamContextMatches = perMatch.filter(m => m.withTeamContext).length
  const currentTeam = player.teams?.team_name || perMatch[perMatch.length - 1]?.teamName || null

  return {
    player, empty: false, missing, isFutsal, formats,
    unitLen: matchLength(isFutsal),
    group, groupInferred: inferred,
    poolGroup, poolLabel: GROUP_LABEL[poolGroup], poolSize: peers.length, poolMinMinutes: minPoolMinutes(isFutsal),
    ownLeagues, compareLeagues, leagueOptions, poolAllLeagues: !compareLeagues.length, eligibleAllLeagues: allEligible.length,
    minutes: me.minutes, minutesApprox: perMatch.some(m => m.approx),
    totals: me.totals, values: me.values, percentiles,
    keyNumbers: PLAYER_KEY_NUMBERS, radarKeys, consistency,
    perMatch, best, worst,
    teamContextMatches, playerModeMatches: perMatch.length - teamContextMatches,
    currentTeam,
    actor: perMatch.flatMap(m => m.actor.map(e => ({ ...e, _match: m.match, _oppName: m.oppName }))),
    reaction: perMatch.flatMap(m => m.reaction.map(e => ({ ...e, _match: m.match }))),
  }
}

/** Plain-text stat digest for the AI scout summary. */
export function summaryPayload(r) {
  const fmt = (k) => {
    const v = r.values[k]
    if (v == null) return 'n/a'
    return PLAYER_STATS[k].kind === 'pct' ? `${Math.round(v)}%` : v.toFixed(PLAYER_STATS[k].dp ?? 2)
  }
  const lines = Object.keys(PLAYER_STATS)
    .filter(k => r.values[k] != null && !(PLAYER_STATS[k].teamOnly && !r.teamContextMatches))
    .map(k => `${PLAYER_STATS[k].label}: ${fmt(k)}${PLAYER_STATS[k].kind === 'p90' ? ` per ${r.unitLen}` : ''}` +
      (r.percentiles[k] != null ? ` (${r.percentiles[k]}th percentile vs ${r.poolSize} ${r.poolLabel} in ${r.poolAllLeagues ? 'all CAC leagues' : r.compareLeagues.join(', ')})` : ''))
  return {
    name: r.player.player_name,
    position: r.group,
    team: r.currentTeam,
    sport: r.isFutsal ? 'Futsal' : 'Football (11-a-side)',
    matches: r.perMatch.length,
    minutes: Math.round(r.minutes),
    consistency: r.consistency,
    stats: lines,
  }
}

/**
 * Every non-placeholder player with processed data, for the /players index.
 * Team = the team in their most recent processed match.
 */
export async function listPlayers() {
  const pool = await loadPool()
  const by = {}
  pool.rows.forEach(r => {
    const m = pool.matchById[r.matchId]
    const p = (by[r.playerId] ||= { matches: 0, minutes: 0, approx: false, futsal: false, football: false, last: null })
    p.matches++
    p.minutes += r.minutes
    p.approx = p.approx || r.approx
    if (r.isFutsal) p.futsal = true; else p.football = true
    if (!p.last || String(m.match_date || '') > String(p.last.match.match_date || '')) p.last = { match: m, teamId: r.teamId }
  })
  return Object.entries(by).map(([pid, a]) => {
    const pl = pool.playerById[pid]
    const m = a.last.match
    const team = a.last.teamId === m.home_team_id ? m.home_team?.team_name : a.last.teamId === m.away_team_id ? m.away_team?.team_name : pl.teams?.team_name
    return {
      player_id: pid, name: pl.player_name, position: pl.position || null, team: team || pl.teams?.team_name || '—',
      matches: a.matches, minutes: Math.round(a.minutes), approx: a.approx,
      sport: a.futsal && a.football ? 'Both' : a.futsal ? 'Futsal' : 'Football',
      lastDate: m.match_date || null,
    }
  }).sort((a, b) => a.name.localeCompare(b.name))
}
