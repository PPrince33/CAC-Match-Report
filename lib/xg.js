/**
 * xG model based on: https://torvaney.github.io/projects/xG.html
 *
 * Logistic regression with:
 *   - goalAngle  : angle (radians) subtended by the goal from the shot position
 *   - goalDistance: straight-line distance to centre of goal (metres)
 *   - isHeader   : 0 (not tracked in our data, assumed foot/other)
 *
 * Coefficients (isHeader = 0 path):
 *   intercept                       = -1.745598
 *   goalAngle                       =  1.338737
 *   goalDistance                    = -0.110384
 *   goalAngle × goalDistance        =  0.168798
 *
 * xG = 1 / (1 + exp(-(intercept + b1*angle + b2*dist + b3*angle*dist)))
 */
export const calculateXG = (startX, startY, pitchW, pitchH) => {
  const goalX = pitchW
  const goalCenterY = pitchH / 2

  // Goal width: 3m for futsal (40m pitch), 7.32m for football
  const goalW = pitchW === 40 ? 3 : 7.32
  const goalPost1Y = goalCenterY - goalW / 2
  const goalPost2Y = goalCenterY + goalW / 2

  // Distance to goal centre
  const dx = goalX - startX
  const dy = goalCenterY - startY
  const goalDistance = Math.sqrt(dx * dx + dy * dy)

  // Angle subtended by the goal (radians) — atan2 handles direction correctly
  const angle1 = Math.atan2(goalPost1Y - startY, goalX - startX)
  const angle2 = Math.atan2(goalPost2Y - startY, goalX - startX)
  const goalAngle = Math.abs(angle2 - angle1)

  // Logistic regression (isHeader = 0)
  const linear =
    -1.745598 +
    1.338737 * goalAngle +
    -0.110384 * goalDistance +
    0.168798 * goalAngle * goalDistance

  const xg = 1 / (1 + Math.exp(-linear))

  // Clamp to a sensible range and round
  return parseFloat(Math.max(0.01, Math.min(0.95, xg)).toFixed(2))
}
