// Player stats engine for multi-match player reports.
// Formulas follow lib/statsRegistry.js (team match report) wherever the same
// stat exists there, and CAC-player-match-report/src/utils/stats.js for the
// player-only ones. All coordinates come from processed_match_events, where
// every event is normalised so the acting team attacks left → right.

import { calculateXG } from './xg.js'
import { getPitchConfig } from './pitchConfig.js'

const SUCCESS = ['Successful', 'Key Pass', 'Assist']
const TACKLES = ['Standing Tackle', 'Sliding Tackle']
const XA_WINDOW_SECONDS = 15

export const matchLength = (isFutsal) => (isFutsal ? 40 : 90)
export const perUnitLabel = (isFutsal) => (isFutsal ? 'per 40' : 'per 90')
export const minPoolMinutes = (isFutsal) => (isFutsal ? 80 : 180)
const minMatchMinutes = (isFutsal) => (isFutsal ? 15 : 30)

const num = (v) => (v == null ? null : Number(v))
const isPass = (e) => e.action === 'Pass' || e.action === 'Through Ball'
export const isAssist = (e) => (e.action === 'Pass' && e.outcome === 'Assist') || (e.action === 'Through Ball' && e.type === 'Assist')
export const isKeyPass = (e) => (e.action === 'Pass' && e.outcome === 'Key Pass') || (e.action === 'Through Ball' && e.type === 'Key Pass')
const passOk = (e) => SUCCESS.includes(e.outcome)
const inBox = (x, y, cfg) => x != null && y != null && x >= cfg.boxX && y >= cfg.boxYMin && y <= cfg.boxYMax
const forward = (e) => (e.end_x != null && e.start_x != null ? e.end_x - e.start_x : 0)

export const isProgressivePass = (e, cfg) =>
  isPass(e) && passOk(e) && e.type !== 'Throw-in' && e.type !== 'Corner Kick' && forward(e) >= cfg.progressiveThreshold

export const isProgressiveCarry = (e, cfg) =>
  e.action === 'Carry' && e.end_x != null &&
  (forward(e) >= cfg.progressiveThreshold || (e.start_x < cfg.attackingThirdX && e.end_x >= cfg.attackingThirdX))

const isCross = (e, cfg) =>
  isPass(e) && (e.type === 'Corner Kick' || (
    e.type !== 'Throw-in' && e.start_x >= cfg.crossStartXMin &&
    (e.start_y <= cfg.crossStartYNarrow || e.start_y >= cfg.height - cfg.crossStartYNarrow)))

export const isDefensiveWin = (e) =>
  (TACKLES.includes(e.action) && e.outcome === 'Successful') ||
  (['Pass Intercept', 'Block', 'Clearance'].includes(e.action) && e.outcome === 'Successful')

/**
 * Counting stats for one player in one match.
 * @param {object} a
 *   actor       – events where the player is player_id
 *   reaction    – events where the player is reaction_player_id (tackled, fouled, dribbled at)
 *   matchEvents – every event of the match (for xA and team share), time-sorted
 *   teamOf      – { player_id: team_id } for this match
 *   teamId      – the player's team in this match
 *   isFutsal, withTeamContext (false for player-mode matches)
 */
export function computeMatchStats({ actor, reaction, matchEvents, teamOf, teamId, isFutsal, withTeamContext }) {
  const cfg = getPitchConfig(isFutsal)
  const s = {}

  // ── Passing ──
  const passes = actor.filter(isPass)
  s.passes = passes.length
  s.passesOk = passes.filter(passOk).length
  s.assists = passes.filter(isAssist).length
  s.keyPasses = passes.filter(isKeyPass).length
  s.progPasses = passes.filter(e => isProgressivePass(e, cfg)).length
  s.passesIntoBox = passes.filter(e => passOk(e) && !inBox(e.start_x, e.start_y, cfg) && inBox(e.end_x, e.end_y, cfg)).length
  s.crosses = passes.filter(e => isCross(e, cfg)).length
  s.throughBalls = actor.filter(e => e.action === 'Through Ball').length
  s.longBalls = passes.filter(e => e.end_x != null && Math.hypot(e.end_x - e.start_x, e.end_y - e.start_y) >= cfg.longBallThreshold).length

  // ── Shooting ──
  const shots = actor.filter(e => e.action === 'Shoot')
  s.shots = shots.length
  s.sot = shots.filter(e => e.outcome === 'Goal' || e.outcome === 'Save').length
  s.goals = shots.filter(e => e.outcome === 'Goal').length
  s.npGoals = shots.filter(e => e.outcome === 'Goal' && e.type !== 'Penalty').length
  s.boxShots = shots.filter(e => inBox(e.start_x, e.start_y, cfg)).length
  s.xg = 0; s.npxg = 0
  shots.forEach(e => {
    const x = calculateXG(e, cfg)
    s.xg += x
    if (e.type !== 'Penalty') s.npxg += x
  })

  // ── xA: xG of the shot that followed each assist / key pass ──
  s.xa = 0
  passes.filter(e => isAssist(e) || isKeyPass(e)).forEach(p => {
    const t = num(p.match_time_seconds)
    const shot = matchEvents.find(e =>
      e.action === 'Shoot' && e.player_id !== p.player_id &&
      num(e.match_time_seconds) >= t && num(e.match_time_seconds) <= t + XA_WINDOW_SECONDS &&
      (teamOf[e.player_id] == null || teamOf[e.player_id] === teamId))
    if (shot) s.xa += calculateXG(shot, cfg)
  })

  // ── Carrying & dribbling ──
  const dribbles = actor.filter(e => e.action === 'Dribble')
  s.dribbles = dribbles.length
  s.dribblesWon = dribbles.filter(e => e.outcome === 'Successful' || e.outcome === 'Foul Won').length
  const carries = actor.filter(e => e.action === 'Carry')
  s.carries = carries.length
  s.progCarries = carries.filter(e => isProgressiveCarry(e, cfg)).length
  s.carriesIntoFinal3rd = [...carries, ...dribbles].filter(e => e.outcome !== 'Unsuccessful' && e.end_x != null && e.start_x < cfg.attackingThirdX && e.end_x >= cfg.attackingThirdX).length
  s.carriesIntoBox = [...carries, ...dribbles].filter(e => e.outcome !== 'Unsuccessful' && !inBox(e.start_x, e.start_y, cfg) && inBox(e.end_x, e.end_y, cfg)).length

  // ── Defending ──
  const tackles = actor.filter(e => TACKLES.includes(e.action))
  s.tackles = tackles.length
  s.tacklesWon = tackles.filter(e => e.outcome === 'Successful').length
  s.interceptions = actor.filter(e => e.action === 'Pass Intercept' && e.outcome === 'Successful').length
  s.blocks = actor.filter(e => e.action === 'Block' && e.outcome === 'Successful').length
  s.clearances = actor.filter(e => e.action === 'Clearance').length
  // Registry "Total Regained Possession": intercepts + tackles + blocks with possession
  s.recoveries = actor.filter(e => ['Pass Intercept', 'Block', ...TACKLES].includes(e.action) && e.outcome === 'Successful' && e.type === 'With Possession').length
  s.pressures = actor.filter(e => e.action === 'Pressure').length
  s.aerialWon = actor.filter(e => e.action === 'Pass Intercept' && e.outcome === 'Successful' && e.body_part === 'Head').length

  // Duels: own dribbles, own tackles, and opponents' dribbles at this player
  const dribbledAt = reaction.filter(e => e.action === 'Dribble')
  s.dribbledPast = dribbledAt.filter(e => e.outcome === 'Successful' || e.outcome === 'Foul Won').length
  const groundWon = s.dribblesWon + tackles.filter(e => e.outcome === 'Successful' && e.type === 'With Possession').length + dribbledAt.filter(e => e.outcome === 'Unsuccessful').length
  s.duels = s.dribbles + s.tackles + dribbledAt.length + s.aerialWon
  s.duelsWon = groundWon + s.aerialWon

  // ── Goalkeeping ──
  const saves = actor.filter(e => e.action === 'Save')
  s.saves = saves.length
  s.savesHeld = saves.filter(e => e.outcome === 'Gripping').length

  // ── Discipline & ball security ──
  s.foulsCommitted = actor.filter(e => e.outcome === 'Foul').length
  s.foulsWon = dribbles.filter(e => e.outcome === 'Foul Won').length + reaction.filter(e => e.outcome === 'Foul').length
  s.yellowCards = actor.filter(e => e.type === 'Yellow Card').length
  s.redCards = actor.filter(e => e.type === 'Red Card').length
  s.turnovers = actor.filter(e => e.action === 'Ball Control').length + dribbles.filter(e => e.outcome === 'Unsuccessful').length

  // ── Under pressure ──
  const pp = passes.filter(e => e.pressure_on), np = passes.filter(e => !e.pressure_on)
  s.pressPasses = pp.length; s.pressPassesOk = pp.filter(passOk).length
  s.noPressPasses = np.length; s.noPressPassesOk = np.filter(passOk).length
  const ballActs = actor.filter(e => e.pressure_on && (isPass(e) || ['Dribble', 'Carry', 'Ball Control'].includes(e.action)))
  s.pressBallActions = ballActs.length
  s.pressRetained = ballActs.filter(e => (isPass(e) ? passOk(e) : e.action === 'Carry' || (e.action === 'Dribble' && e.outcome !== 'Unsuccessful'))).length

  // ── Team context: share of the team's progressive actions ──
  s.teamProgActions = null
  if (withTeamContext) {
    s.teamProgActions = matchEvents.filter(e => teamOf[e.player_id] === teamId && (isProgressivePass(e, cfg) || isProgressiveCarry(e, cfg))).length
  }
  s.progActions = s.progPasses + s.progCarries
  s.progActionsWithTeam = withTeamContext ? s.progActions : null

  return s
}

/** Sum counting stats across matches (null-safe for team-context fields). */
export function sumStats(list) {
  const out = {}
  list.forEach(s => Object.entries(s).forEach(([k, v]) => {
    if (v == null) { if (!(k in out)) out[k] = null; return }
    out[k] = (out[k] || 0) + v
  }))
  return out
}

/**
 * Minutes played in one match.
 * Order: lineup sub times + match_duration → Substitution events → estimate
 * from the player's own events (each half with events counts as a full half).
 * @returns {{ minutes:number, approx:boolean }}
 */
export function computeMinutes({ lineup, playerId, matchEvents, actor, reaction, isFutsal }) {
  const defLen = matchLength(isFutsal), halfLen = defLen / 2
  const duration = num(lineup?.match_duration) > 0 ? num(lineup.match_duration) : null
  const subs = matchEvents.filter(e => e.action === 'Substitution')
  const subOff = subs.find(e => e.player_id === playerId)
  const subOn = subs.find(e => e.reaction_player_id === playerId)

  let start = num(lineup?.substitution_in_time) ?? (subOn ? num(subOn.match_minute) : null)
  if (start == null && lineup?.starting_xi) start = 0
  const end = num(lineup?.substitution_off_time) ?? (subOff ? num(subOff.match_minute) : null)

  if (start != null && (duration || end != null || subOn)) {
    const len = duration ?? defLen
    return { minutes: Math.max(0, Math.min(len, end ?? len) - start), approx: duration == null && end == null }
  }

  // Estimate from events: each half the player appears in, rounded up to whole halves
  const own = [...actor, ...reaction].filter(e => e.match_time_seconds != null)
  if (!own.length) return { minutes: lineup?.starting_xi ? defLen : 0, approx: !!lineup?.starting_xi }
  const byHalf = {}
  own.forEach(e => {
    const h = e.half || '1st Half'
    if (h === 'Penalty shootout') return
    const t = num(e.match_time_seconds)
    byHalf[h] = byHalf[h] ? [Math.min(byHalf[h][0], t), Math.max(byHalf[h][1], t)] : [t, t]
  })
  let mins = 0
  Object.values(byHalf).forEach(([a, b]) => { mins += Math.max(1, Math.ceil((b - a) / 60 / halfLen)) * halfLen })
  return { minutes: Math.min(mins, defLen + (isFutsal ? 10 : 30)), approx: true }
}

/* ── Derived values (per 90 and percentages) ────────────── */
const pct = (a, b) => (b > 0 ? (a / b) * 100 : null)

export function deriveValues(totals, minutes, isFutsal) {
  const unit = matchLength(isFutsal)
  const p90 = (v) => (minutes > 0 && v != null ? (v / minutes) * unit : null)
  const d = {}
  ;['goals', 'npGoals', 'assists', 'xg', 'npxg', 'xa', 'shots', 'sot', 'keyPasses', 'passes', 'progPasses', 'progCarries',
    'passesIntoBox', 'crosses', 'carriesIntoFinal3rd', 'carriesIntoBox', 'dribbles', 'dribblesWon', 'duelsWon', 'tackles', 'tacklesWon',
    'interceptions', 'blocks', 'clearances', 'recoveries', 'pressures', 'aerialWon', 'saves', 'savesHeld',
    'foulsCommitted', 'foulsWon', 'turnovers', 'dribbledPast', 'longBalls'].forEach(k => { d[k] = p90(totals[k]) })
  d.passAcc = pct(totals.passesOk, totals.passes)
  d.dribbleSucc = pct(totals.dribblesWon, totals.dribbles)
  d.duelWinPct = pct(totals.duelsWon, totals.duels)
  d.shotAcc = pct(totals.sot, totals.shots)
  d.pressPassAcc = pct(totals.pressPassesOk, totals.pressPasses)
  d.noPressPassAcc = pct(totals.noPressPassesOk, totals.noPressPasses)
  d.pressRetention = pct(totals.pressRetained, totals.pressBallActions)
  d.progShare = totals.teamProgActions ? pct(totals.progActionsWithTeam, totals.teamProgActions) : null
  d.goalsMinusXg = totals.goals - totals.xg
  d.assistsMinusXa = totals.assists - totals.xa
  return d
}

/* ── Position groups ─────────────────────────────────────── */
export const GROUP_LABEL = {
  goalkeeper: 'goalkeepers', 'centre-back': 'centre-backs', 'full-back': 'full-backs',
  midfielder: 'midfielders', winger: 'wingers', striker: 'strikers',
  defender: 'defenders', forward: 'forwards', outfield: 'outfield players',
}
export const BROAD_GROUP = { 'centre-back': 'defender', 'full-back': 'defender', winger: 'forward', striker: 'forward', midfielder: 'midfielder', goalkeeper: 'goalkeeper' }

/**
 * Detailed group from listed position (GK/DF/MF/FW) plus average location.
 * Wide = average distance from the centre line of the pitch > 22% of its width.
 */
export function positionGroup(position, avgX, avgY, isFutsal) {
  const cfg = getPitchConfig(isFutsal)
  let pos = position
  let inferred = false
  if (!pos) {
    inferred = true
    if (avgX == null) return { group: 'midfielder', inferred }
    pos = avgX < cfg.width * 0.35 ? 'DF' : avgX > cfg.width * 0.62 ? 'FW' : 'MF'
  }
  const wide = avgY != null && Math.abs(avgY - cfg.height / 2) > cfg.height * 0.22
  if (pos === 'GK') return { group: 'goalkeeper', inferred }
  if (pos === 'DF') return { group: wide ? 'full-back' : 'centre-back', inferred }
  if (pos === 'FW') return { group: wide ? 'winger' : 'striker', inferred }
  return { group: 'midfielder', inferred }
}

/* ── Radar metrics per group (percentile axes) ─────────────── */
export const RADAR_METRICS = {
  striker:       ['goals', 'npxg', 'shots', 'xa', 'keyPasses', 'dribblesWon', 'progCarries', 'pressures'],
  winger:        ['xa', 'keyPasses', 'dribblesWon', 'progCarries', 'crosses', 'npxg', 'shots', 'progPasses'],
  midfielder:    ['passes', 'passAcc', 'progPasses', 'keyPasses', 'xa', 'interceptions', 'recoveries', 'pressures'],
  'full-back':   ['progPasses', 'progCarries', 'keyPasses', 'crosses', 'tacklesWon', 'interceptions', 'recoveries', 'duelsWon'],
  'centre-back': ['passAcc', 'progPasses', 'tacklesWon', 'interceptions', 'clearances', 'blocks', 'aerialWon', 'recoveries'],
  goalkeeper:    ['saves', 'savesHeld', 'passes', 'passAcc', 'longBalls', 'clearances'],
}

/** Percentile of `value` within `pool` (mid-rank for ties). Null when not comparable. */
export function percentile(value, pool, lowerIsBetter = false) {
  const vals = pool.filter(v => v != null && Number.isFinite(v))
  if (value == null || !vals.length) return null
  let below = 0, equal = 0
  vals.forEach(v => {
    if (lowerIsBetter ? v > value : v < value) below++
    else if (v === value) equal++
  })
  return Math.round(((below + equal * 0.5) / vals.length) * 100)
}

/**
 * Consistency score 0–100 from the coefficient of variation of per-90 values
 * across matches (matches with too few minutes are skipped). 100 = identical
 * output every match; CV of 1 scores 50; CV of 2 or more scores 0.
 */
export function consistencyScore(perMatch, keys, isFutsal) {
  const rows = perMatch.filter(m => m.minutes >= minMatchMinutes(isFutsal))
  if (rows.length < 2) return null
  const cvs = []
  keys.forEach(k => {
    const vals = rows.map(m => m.per90[k]).filter(v => v != null)
    if (vals.length < 2) return
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length
    if (mean <= 0) return
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length)
    cvs.push(sd / mean)
  })
  if (!cvs.length) return null
  const avg = cvs.reduce((a, b) => a + b, 0) / cvs.length
  return Math.max(0, Math.min(100, Math.round(100 - avg * 50)))
}

/**
 * CAC impact score for one match, used to pick best / worst match.
 * Weighted sum of decisive and progressive actions minus losses, per 90.
 */
export function impactScore(s, minutes, isFutsal) {
  const raw = 3 * s.goals + 3 * s.assists + 2 * s.xg + 2 * s.xa + s.keyPasses +
    0.3 * s.progPasses + 0.3 * s.progCarries + 0.5 * s.dribblesWon +
    0.5 * s.tacklesWon + 0.5 * s.interceptions + 0.3 * s.recoveries + 0.5 * s.saves -
    0.5 * s.turnovers - 0.3 * s.foulsCommitted
  if (minutes < minMatchMinutes(isFutsal)) return null
  return (raw / minutes) * matchLength(isFutsal)
}
