export const drawPitchMarkings = (ctx, w, h, isFutsal, PITCH_CONFIG) => {
  const pad = 30
  const cfg = isFutsal ? PITCH_CONFIG.futsal : PITCH_CONFIG.football
  const pW = cfg.width
  const pH = cfg.height
  const drawW = w - pad * 2
  const drawH = h - pad * 2
  const scaleX = x => pad + (x / pW) * drawW
  const scaleY = y => h - (pad + (y / pH) * drawH)

  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(pad, pad, drawW, drawH)
  ctx.strokeStyle = '#000000'
  ctx.lineWidth = 3
  ctx.strokeRect(pad, pad, drawW, drawH)

  // Half line
  ctx.beginPath()
  ctx.moveTo(scaleX(pW / 2), scaleY(0))
  ctx.lineTo(scaleX(pW / 2), scaleY(pH))
  ctx.stroke()

  // Center circle
  ctx.beginPath()
  ctx.arc(scaleX(pW / 2), scaleY(pH / 2), (cfg.centerCircleRadius / pW) * drawW, 0, Math.PI * 2)
  ctx.stroke()

  // Center spot
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.arc(scaleX(pW / 2), scaleY(pH / 2), 3, 0, Math.PI * 2)
  ctx.fill()

  if (isFutsal) {
    const dRadius = (cfg.penaltyAreaRadius / pW) * drawW
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(scaleX(0), scaleY(pH / 2), dRadius, -Math.PI / 2, Math.PI / 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(scaleX(pW), scaleY(pH / 2), dRadius, Math.PI / 2, -Math.PI / 2)
    ctx.stroke()
    ctx.fillStyle = '#000'
    ;[cfg.penaltySpot1, cfg.penaltySpot2, pW - cfg.penaltySpot2, pW - cfg.penaltySpot1].forEach(x => {
      ctx.beginPath()
      ctx.arc(scaleX(x), scaleY(pH / 2), 3, 0, Math.PI * 2)
      ctx.fill()
    })
  } else {
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2
    // Left penalty area
    ctx.strokeRect(scaleX(0), scaleY(cfg.penaltyAreaYMax), (cfg.penaltyAreaX / pW) * drawW, ((cfg.penaltyAreaYMax - cfg.penaltyAreaYMin) / pH) * drawH)
    // Right penalty area
    ctx.strokeRect(scaleX(pW - cfg.penaltyAreaX), scaleY(cfg.penaltyAreaYMax), (cfg.penaltyAreaX / pW) * drawW, ((cfg.penaltyAreaYMax - cfg.penaltyAreaYMin) / pH) * drawH)
    // Left goal area
    ctx.strokeRect(scaleX(0), scaleY(cfg.goalAreaYMax), (cfg.goalAreaX / pW) * drawW, ((cfg.goalAreaYMax - cfg.goalAreaYMin) / pH) * drawH)
    // Right goal area
    ctx.strokeRect(scaleX(pW - cfg.goalAreaX), scaleY(cfg.goalAreaYMax), (cfg.goalAreaX / pW) * drawW, ((cfg.goalAreaYMax - cfg.goalAreaYMin) / pH) * drawH)
    // Penalty spots
    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.arc(scaleX(cfg.penaltySpot1), scaleY(pH / 2), 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(scaleX(pW - cfg.penaltySpot1), scaleY(pH / 2), 3, 0, Math.PI * 2)
    ctx.fill()
    // Corner arcs
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 1.5
    const cornerR = (1 / pW) * drawW
    ;[[0, 0, 0, Math.PI / 2], [pW, 0, Math.PI / 2, Math.PI], [pW, pH, Math.PI, 3 * Math.PI / 2], [0, pH, 3 * Math.PI / 2, 2 * Math.PI]].forEach(([cx, cy, s, e]) => {
      ctx.beginPath()
      ctx.arc(scaleX(cx), scaleY(cy), cornerR, s, e)
      ctx.stroke()
    })
  }

  // Goals
  ctx.strokeStyle = '#D90429'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(scaleX(0), scaleY(cfg.goalYMin))
  ctx.lineTo(scaleX(0), scaleY(cfg.goalYMax))
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(scaleX(pW), scaleY(cfg.goalYMin))
  ctx.lineTo(scaleX(pW), scaleY(cfg.goalYMax))
  ctx.stroke()
}
