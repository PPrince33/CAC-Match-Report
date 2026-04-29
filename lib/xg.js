/**
 * Custom xG + xGOT model.
 *
 * xG (chance quality at point of shot):
 *   - Penalty → fixed 0.76
 *   - Shots from own half / outside attacking third → capped 0.01
 *   - Otherwise: logistic regression on distance, angle, shot technique,
 *     assist type, first-time shot, pressure, plus a "blocked w/o tracked
 *     pressure" adjustment, with two minimum-floor rules.
 *
 * xGOT (chance quality once on target):
 *   - 0 unless outcome is Goal or Save
 *   - xG × multiplier based on |end_y − goal-centre| (placement vs centre)
 *
 * Football pitch is 120×80; futsal is 40×20. The function scales coefficients
 * by remapping distance to "football-equivalent" units so the same z-score
 * formula stays calibrated across both sports.
 */

export const calculateXG = (e, cfg) => {
  if (!e || e.start_x == null) return 0

  // Penalty: fixed probability
  if (e.type === 'Penalty') return 0.76

  // Extreme long shots (own half / outside attacking third) → 1% floor
  if (e.start_x <= cfg.attackingThirdX) return 0.01

  let z = -0.5

  // Free Kick: wall in front, but no live pressure / generic assist context
  const isFK = e.type === 'Free Kick'
  if (isFK) z += 0.7

  // --- Geometry ---
  const goalX = cfg.width
  const goalY = cfg.height / 2
  const sx = e.start_x
  const sy = e.start_y ?? goalY

  // Distance, rescaled to football-equivalent units so coefficients stay calibrated
  const distScale = 120 / cfg.width
  const distance = Math.hypot(goalX - sx, goalY - sy) * distScale
  z -= 0.10 * distance

  // Angle subtended by the goal posts, in degrees
  const v1x = goalX - sx, v1y = cfg.goalYMin - sy
  const v2x = goalX - sx, v2y = cfg.goalYMax - sy
  const dot = v1x * v2x + v1y * v2y
  const m1 = Math.hypot(v1x, v1y)
  const m2 = Math.hypot(v2x, v2y)
  const cosA = Math.max(-1, Math.min(1, dot / (m1 * m2 + 1e-9)))
  const angleDeg = Math.acos(cosA) * 180 / Math.PI
  z += 0.012 * angleDeg

  // --- Shot technique ---
  if (e.shot_technique === 'Header') z -= 0.80
  else if (e.shot_technique === 'Volley') z -= 0.2

  // --- Assist type (free kicks override to "Normal Pass") ---
  const assistType = isFK ? 'Normal Pass' : e.assist_type
  if (assistType === 'Through ball') z += 0.6
  else if (assistType === 'Cross') z -= 0.4
  else if (assistType === 'Rebound') z += 0.5
  else if (assistType === 'Free Kick') z += 0.3

  // --- Context ---
  if (e.first_time_shot === true || e.first_time_shot === 1) z += 0.4

  // --- Pressure (free kicks override to false) ---
  const pressure = isFK ? false : (e.pressure_on === true)
  if (pressure) z -= 0.90
  else if (!pressure && e.outcome === 'Block') z -= 0.60  // blocked w/o tracked pressure → defender in path

  // Logistic
  let xg = 1 / (1 + Math.exp(-z))

  // Floor 1: anywhere in attacking half, never below 2%
  if (sx > cfg.attackingThirdX && xg < 0.01) xg = 0.02

  // Floor 2: danger zone — edge-of-box / central. Scale football's 95-103 X & 15-65 Y bounds.
  const dxMin = (95 / 120) * cfg.width
  const dxMax = (103 / 120) * cfg.width
  const dyMin = (15 / 80) * cfg.height
  const dyMax = (65 / 80) * cfg.height
  if (sx >= dxMin && sx <= dxMax && sy >= dyMin && sy <= dyMax && xg < 0.02) xg = 0.02

  return parseFloat(xg.toFixed(3))
}

export const calculateXGOT = (e, xg, cfg) => {
  if (!e) return 0
  if (e.outcome !== 'Goal' && e.outcome !== 'Save') return 0
  if (e.end_y == null) return 0

  const goalY = cfg.height / 2
  let mult

  if (e.end_z != null) {
    // 2D placement on the goal mouth: combine y-deviation and shot height.
    //   yFactor = how far from goal-Y centre, normalised to half-goal-width
    //   zFactor = shot height as fraction of crossbar
    //   cornerScore ∈ [0, 1] — 0 = dead centre on the ground, 1 = top corner
    const goalHalfWidth = Math.max((cfg.goalYMax - cfg.goalYMin) / 2, 0.001)
    const goalH = Math.max(cfg.goalHeight || 1, 0.001)
    const yFactor = Math.min(1, Math.abs(e.end_y - goalY) / goalHalfWidth)
    const zFactor = Math.max(0, Math.min(1, e.end_z / goalH))
    const cornerScore = Math.min(1, Math.hypot(yFactor, zFactor) / Math.SQRT2)
    // Multiplier 0.5 (centre, ground) → 1.8 (top corner)
    mult = 0.5 + cornerScore * 1.3
  } else {
    // y-only fallback (no 3-D placement recorded)
    const placementY = Math.abs(e.end_y - goalY)
    const f = cfg.height / 80
    const t1 = 1.5 * f
    const t2 = 3.0 * f
    if (placementY >= t2) mult = 1.6
    else if (placementY >= t1) mult = 1.1
    else mult = 0.6
  }

  return parseFloat(Math.min(xg * mult, 0.99).toFixed(3))
}
