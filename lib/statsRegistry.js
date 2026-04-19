export const STATS_REGISTRY = {
  "summary_possession":    { label: "Possession",                      getH: (h) => `${h.possession}%`,                              getA: (a) => `${a.possession}%`,                              highlight: true  },
  "summary_xg":            { label: "Expected Goals (xG)",              getH: (h) => h.xg,                                            getA: (a) => a.xg                                                              },
  "summary_shots_sot":     { label: "Shots (SoT)",                      getH: (h) => `${h.shots} (${h.sot})`,                         getA: (a) => `${a.shots} (${a.sot})`                                          },
  "summary_pass_accuracy": { label: "Pass Accuracy (Total Passes)",     getH: (h) => `${h.passAcc}% (${h.passes})`,                   getA: (a) => `${a.passAcc}% (${a.passes})`                                    },
  "summary_fouls":         { label: "Disciplined Play (Fouls)",         getH: (h) => h.fouls,                                         getA: (a) => a.fouls                                                           },

  "attack_goals":                { label: "Goals",                      getH: (h) => h.goals,                                         getA: (a) => a.goals,                                         highlight: true  },
  "attack_shots_on_target":      { label: "Total Shots (On Target)",    getH: (h) => `${h.shots} (${h.sot})`,                         getA: (a) => `${a.shots} (${a.sot})`                                          },
  "attack_shots_inside_box":     { label: "Shots Inside Box",           getH: (h) => h.boxShots,                                      getA: (a) => a.boxShots                                                        },
  "attack_xg":                   { label: "Expected Goals (xG)",        getH: (h) => h.xg,                                            getA: (a) => a.xg                                                              },
  "attack_xg_per_shot":          { label: "xG Per Shot",                getH: (h) => h.xgPerShot,                                     getA: (a) => a.xgPerShot                                                       },

  "attack_assists":             { label: "Assists",                      getH: (h) => h.assists,                                       getA: (a) => a.assists,                                       highlight: true  },
  "attack_key_passes":          { label: "Key Passes",                   getH: (h) => h.keyPasses,                                     getA: (a) => a.keyPasses                                                       },
  "attack_total_passes":        { label: "Total Passes (Accuracy %)",   getH: (h) => `${h.passes} (${h.passAcc}%)`,                   getA: (a) => `${a.passes} (${a.passAcc}%)`                                    },
  "attack_through_balls":       { label: "Through Balls",               getH: (h) => h.throughBalls,                                  getA: (a) => a.throughBalls                                                    },
  "attack_crosses":             { label: "Crosses",                      getH: (h) => h.crosses,                                       getA: (a) => a.crosses                                                         },

  "attack_total_carries":         { label: "Total Carries",              getH: (h) => h.carries,                                       getA: (a) => a.carries                                                         },
  "attack_dribbles":              { label: "Dribbles (Success %)",        getH: (h) => `${h.dribbles} (${h.dribbleAcc}%)`,             getA: (a) => `${a.dribbles} (${a.dribbleAcc}%)`                               },

  "attack_shots_under_pressure":    { label: "Shots Under Pressure",     getH: (h) => h.shotsUnderPressure,                           getA: (a) => a.shotsUnderPressure,                            highlight: true  },
  "attack_pass_acc_under_pressure": { label: "Pass Acc Under Pressure",  getH: (h) => `${h.pressPassAcc}%`,                           getA: (a) => `${a.pressPassAcc}%`                                              },

  "defense_total_tackles":               { label: "Total Tackles (Success %)",    getH: (h) => `${h.totalTackles} (${h.tackleSuccess}%)`,         getA: (a) => `${a.totalTackles} (${a.tackleSuccess}%)`,        highlight: true  },
  "defense_total_interceptions":         { label: "Total Interceptions",           getH: (h) => h.totalInterceptions,                               getA: (a) => a.totalInterceptions,                             highlight: true  },

  "defense_total_blocks":              { label: "Total Blocks (Successful)",     getH: (h) => `${h.totalBlocks} (${h.succBlocks})`,               getA: (a) => `${a.totalBlocks} (${a.succBlocks})`,             highlight: true  },
  "defense_total_clearances":          { label: "Total Clearances (Successful)", getH: (h) => `${h.totalClearances} (${h.succClearances})`,       getA: (a) => `${a.totalClearances} (${a.succClearances})`,     highlight: true  },

  "defense_total_defensive_actions":   { label: "Total Defensive Actions",       getH: (h) => h.totalDefensiveActions,                            getA: (a) => a.totalDefensiveActions,                          highlight: true  },
  "defense_ball_recoveries":           { label: "Ball Recoveries",               getH: (h) => h.ballRecoveries,                                   getA: (a) => a.ballRecoveries,                                 highlight: true  },
  "defense_possession_wins":           { label: "Possession Wins",               getH: (h) => h.possessionWins,                                   getA: (a) => a.possessionWins,                                 highlight: true  },
  "defense_total_pressures":           { label: "Total Pressures",               getH: (h) => h.totalPressures,                                   getA: (a) => a.totalPressures                                                   },

  "defense_total_saves":         { label: "Total Saves",                          getH: (h) => h.totalSaves,                                       getA: (a) => a.totalSaves,                                     highlight: true  },
  "defense_total_fouls":         { label: "Total Fouls (Inc. Pressing)",          getH: (h) => h.totalFouls + h.pressureFouls,                    getA: (a) => a.totalFouls + a.pressureFouls,                   highlight: true  },
  "defense_yellow_red_cards":    { label: "Yellow / Red Cards",                   getH: (h) => `${h.yellowCards} / ${h.redCards}`,                getA: (a) => `${a.yellowCards} / ${a.redCards}`                                 },

  // PPDA — lower = more intense press
  "defense_ppda": {
    label: "PPDA (↓ = Better Press)",
    getH: (h) => h.ppda !== null ? `${h.ppda}` : 'N/A',
    getA: (a) => a.ppda !== null ? `${a.ppda}` : 'N/A',
    highlight: true
  },
  "defense_ppda_breakdown": {
    label: "Opp. Passes / Def. Actions (Zone)",
    getH: (h) => `${h.oppPassesInZone} / ${h.defActionsInZone}`,
    getA: (a) => `${a.oppPassesInZone} / ${a.defActionsInZone}`,
  },
}

export const STATS_CONFIG = {
  summary: [
    { id: 'summary_possession', enabled: true, order: 1 },
    { id: 'summary_xg', enabled: true, order: 2 },
    { id: 'summary_shots_sot', enabled: true, order: 3 },
    { id: 'summary_pass_accuracy', enabled: true, order: 4 },
    { id: 'summary_fouls', enabled: true, order: 5 },
  ],
  attack_shooting: [
    { id: 'attack_goals', enabled: true, order: 1 },
    { id: 'attack_shots_on_target', enabled: true, order: 2 },
    { id: 'attack_shots_inside_box', enabled: true, order: 3 },
    { id: 'attack_xg', enabled: true, order: 4 },
    { id: 'attack_xg_per_shot', enabled: true, order: 5 },
  ],
  attack_distribution: [
    { id: 'attack_assists', enabled: true, order: 1 },
    { id: 'attack_key_passes', enabled: true, order: 2 },
    { id: 'attack_total_passes', enabled: true, order: 3 },
    { id: 'attack_through_balls', enabled: true, order: 4 },
    { id: 'attack_crosses', enabled: true, order: 5 },
  ],
  attack_ball_progression: [
    { id: 'attack_total_carries', enabled: true, order: 1 },
    { id: 'attack_dribbles', enabled: true, order: 2 },
  ],
  attack_pressure: [
    { id: 'attack_shots_under_pressure', enabled: true, order: 1 },
    { id: 'attack_pass_acc_under_pressure', enabled: true, order: 2 },
  ],
  defense_tackling: [
    { id: 'defense_total_tackles', enabled: true, order: 1 },
    { id: 'defense_total_interceptions', enabled: true, order: 2 },
  ],
  defense_blocks: [
    { id: 'defense_total_blocks', enabled: true, order: 1 },
    { id: 'defense_total_clearances', enabled: true, order: 2 },
  ],
  defense_work_rate: [
    { id: 'defense_total_defensive_actions', enabled: true, order: 1 },
    { id: 'defense_possession_wins', enabled: true, order: 2 },
  ],
  defense_goalkeeping: [
    { id: 'defense_total_saves', enabled: true, order: 1 },
    { id: 'defense_total_fouls', enabled: true, order: 2 },
    { id: 'defense_yellow_red_cards', enabled: true, order: 3 },
  ],
  defense_pressing: [
    { id: 'defense_ppda', enabled: true, order: 1 },
    { id: 'defense_ppda_breakdown', enabled: true, order: 2 },
  ],
}
