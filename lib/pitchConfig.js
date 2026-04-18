export const PITCH_CONFIG = {
  futsal: {
    width: 40, height: 20,
    centerCircleRadius: 3,
    penaltyAreaRadius: 6,
    penaltySpot1: 6, penaltySpot2: 10,
    goalWidth: 3, goalYMin: 8.5, goalYMax: 11.5,
    goalHeight: 2,
    aspectRatio: 0.55,
    attackingThirdX: 26.67,
    boxX: 34, boxYMin: 6, boxYMax: 14,
    progressiveThreshold: 8,
    label: 'Futsal'
  },
  football: {
    width: 120, height: 80,
    centerCircleRadius: 9.15,
    penaltyAreaX: 16.5, penaltyAreaYMin: 18, penaltyAreaYMax: 62,
    goalAreaX: 5.5, goalAreaYMin: 30, goalAreaYMax: 50,
    penaltySpot1: 11,
    goalWidth: 7.32, goalYMin: 36.34, goalYMax: 43.66,
    goalHeight: 2.44,
    aspectRatio: 0.67,
    attackingThirdX: 80,
    boxX: 103.5, boxYMin: 18, boxYMax: 62,
    progressiveThreshold: 24,
    label: 'Football'
  }
}

export const getPitchConfig = (isFutsal) => isFutsal ? PITCH_CONFIG.futsal : PITCH_CONFIG.football
