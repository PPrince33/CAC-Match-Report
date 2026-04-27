export const STATS_REGISTRY = {
  "summary_possession":    { label: "Possession",                      getH: (h) => `${h.possession}%`,                              getA: (a) => `${a.possession}%`,                              highlight: true,  info: "% of total passes belonging to each team. Calculated as team passes ÷ total passes × 100."  },
  "summary_xg":            { label: "Expected Goals (xG)",              getH: (h) => h.xg,                                            getA: (a) => a.xg,                                                              info: "Sum of xG for non-penalty shots. Each shot's xG comes from the custom model based on distance, angle, technique, assist type, first-time, and pressure context."  },
  "summary_shots_sot":     { label: "Shots (SoT)",                      getH: (h) => `${h.shots} (${h.sot})`,                         getA: (a) => `${a.shots} (${a.sot})`,                                           info: "Total shots taken. Shots on Target (SoT) in brackets = shots resulting in a Goal or Save."  },
  "summary_pass_accuracy": { label: "Pass Accuracy (Total Passes)",     getH: (h) => `${h.passAcc}% (${h.passes})`,                   getA: (a) => `${a.passAcc}% (${a.passes})`,                                     info: "Successful passes ÷ total passes × 100. Successful = Successful, Assist, or Key Pass outcome."  },
  "summary_fouls":         { label: "Disciplined Play (Fouls)",         getH: (h) => h.fouls,                                         getA: (a) => a.fouls,                                                            info: "Total foul events recorded for the team across all action types.", lowerIsBetter: true  },

  "attack_goals":                { label: "Goals",                      getH: (h) => h.goals,                                         getA: (a) => a.goals,                                         highlight: true,  info: "Shots resulting in a Goal, plus any event with Type = Own Goal credited to the acting team."  },
  "attack_total_shots":          { label: "Total Shots",                getH: (h) => h.shots,                                         getA: (a) => a.shots,                                                            info: "Count of all Shoot actions."  },
  "attack_shots_on_target":      { label: "Shots on Target",            getH: (h) => h.sot,                                           getA: (a) => a.sot,                                                              info: "Shots with outcome Goal or Save, plus Blocks where the end coordinate is on the goal line within the goal posts."  },
  "attack_shots_inside_box":     { label: "Shots Inside Box",           getH: (h) => h.boxShots,                                      getA: (a) => a.boxShots,                                                         info: "Shots where the start position falls inside the attacking penalty box (X ≥ 102, 20 ≤ Y ≤ 60 on football, scaled for futsal)."  },
  "attack_shot_conversion":      { label: "Shot Conversion (%)",        getH: (h) => `${h.conversionRate}%`,                          getA: (a) => `${a.conversionRate}%`,                                             info: "Goals ÷ Total Shots × 100. How clinical the team was with their attempts."  },
  "attack_shooting_accuracy":    { label: "Shooting Accuracy (%)",      getH: (h) => `${h.shootingAccuracy}%`,                        getA: (a) => `${a.shootingAccuracy}%`,                                           info: "Shots on Target ÷ Total Shots × 100. How often the team hit the target."  },
  "attack_xg":                   { label: "xG (Non-Penalty)",           getH: (h) => h.xg,                                            getA: (a) => a.xg,                                                               info: "Sum of xG for non-penalty shots only. Custom model uses distance, angle, shot technique, assist type, first-time shot, and pressure context."  },
  "attack_xgot":                 { label: "xGOT (Non-Penalty)",         getH: (h) => h.xgot,                                          getA: (a) => a.xgot,                                                             info: "Sum of post-shot xG for non-penalty shots that hit the target. Base xG × placement multiplier (0.6 central → 1.1 corner-ish → 1.6 top corners)."  },
  "attack_xg_per_shot":          { label: "xG Per Shot",                getH: (h) => h.xgPerShot,                                     getA: (a) => a.xgPerShot,                                                        info: "Non-penalty xG ÷ non-penalty shots. Average open-play shot quality."  },

  "attack_assists":             { label: "Assists",                      getH: (h) => h.assists,                                       getA: (a) => a.assists,                                       highlight: true,  info: "Passes or Through Balls with outcome = Assist (directly led to a goal). Worth 6 CAC pts."  },
  "attack_key_passes":          { label: "Key Passes",                   getH: (h) => h.keyPasses,                                     getA: (a) => a.keyPasses,                                                        info: "Passes with outcome = Key Pass (created a clear goal-scoring opportunity but did not result in a goal)."  },
  "attack_total_passes":        { label: "Total Passes (Accuracy %)",   getH: (h) => `${h.passes} (${h.passAcc}%)`,                   getA: (a) => `${a.passes} (${a.passAcc}%)`,                                     info: "Total pass attempts. Accuracy % = successful passes ÷ total passes × 100."  },
  "attack_through_balls":       { label: "Through Balls",               getH: (h) => h.throughBalls,                                  getA: (a) => a.throughBalls,                                                     info: "Count of Through Ball actions — penetrating passes played in behind the defensive line."  },
  "attack_crosses":             { label: "Crosses",                      getH: (h) => h.crosses,                                       getA: (a) => a.crosses,                                                          info: "Passes delivered from wide positions in the attacking third (within 20% of pitch width from the touchline), plus corner kicks."  },
  "attack_corners":             { label: "Corner Kicks",                  getH: (h) => h.corners,                                       getA: (a) => a.corners,                                                         info: "Passes with type = Corner Kick. These are set-piece deliveries from the corner arc."  },

  "attack_total_carries":         { label: "Total Carries",              getH: (h) => h.carries,                                       getA: (a) => a.carries,                                                          info: "Count of Carry actions — when a player moves the ball forward under control without passing."  },
  "attack_dribbles":              { label: "Dribbles (Success %)",        getH: (h) => `${h.dribbles} (${h.dribbleAcc}%)`,             getA: (a) => `${a.dribbles} (${a.dribbleAcc}%)`,                                info: "Total dribble attempts. Success % = successful dribbles ÷ total dribbles × 100."  },
  "attack_prog_into_final_3rd":   { label: "Carries/Dribbles → Final 3rd", getH: (h) => h.progIntoFinal3rd,                              getA: (a) => a.progIntoFinal3rd,                                                 info: "Carries or dribbles that start outside the attacking third and end inside it."  },
  "attack_prog_into_box":         { label: "Carries/Dribbles → Pen Box",   getH: (h) => h.progIntoBox,                                   getA: (a) => a.progIntoBox,                                                      info: "Carries or dribbles that start outside the attacking penalty box and end inside it."  },

  "attack_shots_under_pressure":    { label: "Shots Under Pressure",     getH: (h) => h.shotsUnderPressure,                           getA: (a) => a.shotsUnderPressure,                            highlight: true,  info: "Shots where the pressure_on flag is true — the shooter was being actively closed down."  },
  "attack_pass_acc_under_pressure": { label: "Pass Acc Under Pressure",  getH: (h) => `${h.pressPassAcc}%`,                           getA: (a) => `${a.pressPassAcc}%`,                                               info: "Pass accuracy only for passes made while under pressure. Measures composure on the ball."  },

  "defense_total_tackles":               { label: "Total Tackles (Success %)",    getH: (h) => `${h.totalTackles} (${h.tackleSuccess}%)`,         getA: (a) => `${a.totalTackles} (${a.tackleSuccess}%)`,        highlight: true,  info: "Standing + Sliding Tackle attempts. Success % = tackles winning possession ÷ total tackles × 100."  },
  "defense_total_interceptions":         { label: "Total Interceptions",           getH: (h) => h.totalInterceptions,                               getA: (a) => a.totalInterceptions,                             highlight: true,  info: "Pass Intercept actions — the player cut out an opponent's pass."  },

  "defense_total_blocks":              { label: "Total Blocks (Successful)",     getH: (h) => `${h.totalBlocks} (${h.succBlocks})`,               getA: (a) => `${a.totalBlocks} (${a.succBlocks})`,             highlight: true,  info: "Block actions recorded. Successful (in brackets) = blocks with outcome = Successful."  },
  "defense_total_clearances":          { label: "Total Clearances (Successful)", getH: (h) => `${h.totalClearances} (${h.succClearances})`,       getA: (a) => `${a.totalClearances} (${a.succClearances})`,     highlight: true,  info: "Clearance actions recorded. Successful (in brackets) = clearances that retained or won possession."  },

  "defense_total_defensive_actions":   { label: "Total Defensive Actions",       getH: (h) => h.totalDefensiveActions,                            getA: (a) => a.totalDefensiveActions,                          highlight: true,  info: "Sum of all defensive events: tackles, interceptions, blocks, clearances, and saves."  },
  "defense_ball_recoveries":           { label: "Ball Recoveries",               getH: (h) => h.ballRecoveries,                                   getA: (a) => a.ballRecoveries,                                 highlight: true,  info: "Tackles or interceptions with outcome = Successful AND type = With Possession — directly regained the ball."  },
  "defense_possession_wins":           { label: "Possession Wins",               getH: (h) => h.possessionWins,                                   getA: (a) => a.possessionWins,                                 highlight: true,  info: "All defensive actions (tackles, interceptions, blocks, clearances) where possession was won back."  },
  "defense_total_pressures":           { label: "Total Pressures",               getH: (h) => h.totalPressures,                                   getA: (a) => a.totalPressures,                                                   info: "Count of Pressure actions — active pressing of the opponent on the ball."  },

  "defense_total_saves":         { label: "Total Saves",                          getH: (h) => h.totalSaves,                                       getA: (a) => a.totalSaves,                                     highlight: true,  info: "Save actions by the goalkeeper — shots stopped with any save type (Gripping, Pushing-in, Pushing-out)."  },
  "defense_total_fouls":         { label: "Total Fouls (Inc. Pressing)",          getH: (h) => h.totalFouls + h.pressureFouls,                    getA: (a) => a.totalFouls + a.pressureFouls,                   highlight: true,  info: "Fouls from tackles and dribbles plus fouls committed while pressing. All cards included.", lowerIsBetter: true  },
  "defense_yellow_red_cards":    { label: "Yellow / Red Cards",                   getH: (h) => `${h.yellowCards} / ${h.redCards}`,                getA: (a) => `${a.yellowCards} / ${a.redCards}`,                                 info: "Cards issued from fouls. Yellow = caution, Red = dismissal.", lowerIsBetter: true  },

  "defense_ppda": {
    label: "PPDA (↓ = Better Press)",
    getH: (h) => h.ppda !== null ? `${h.ppda}` : 'N/A',
    getA: (a) => a.ppda !== null ? `${a.ppda}` : 'N/A',
    highlight: true,
    lowerIsBetter: true,
    info: "Passes Per Defensive Action in the opponent's half. Lower = more intense pressing. Calculated as opponent passes ÷ defensive actions in the pressing zone."
  },
  "defense_ppda_breakdown": {
    label: "Opp. Passes / Def. Actions (Zone)",
    getH: (h) => `${h.oppPassesInZone} / ${h.defActionsInZone}`,
    getA: (a) => `${a.oppPassesInZone} / ${a.defActionsInZone}`,
    info: "Raw numbers behind PPDA: opponent passes allowed in the pressing zone vs. defensive actions made in that zone."
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
    { id: 'attack_goals',              enabled: true, order: 1 },
    { id: 'attack_total_shots',        enabled: true, order: 2 },
    { id: 'attack_shots_on_target',    enabled: true, order: 3 },
    { id: 'attack_shots_inside_box',   enabled: true, order: 4 },
    { id: 'attack_shot_conversion',    enabled: true, order: 5 },
    { id: 'attack_shooting_accuracy',  enabled: true, order: 6 },
    { id: 'attack_xg',                 enabled: true, order: 7 },
    { id: 'attack_xgot',               enabled: true, order: 8 },
    { id: 'attack_xg_per_shot',        enabled: true, order: 9 },
  ],
  attack_ball_progression: [
    { id: 'attack_total_carries',       enabled: true, order: 1 },
    { id: 'attack_dribbles',            enabled: true, order: 2 },
    { id: 'attack_prog_into_final_3rd', enabled: true, order: 3 },
    { id: 'attack_prog_into_box',       enabled: true, order: 4 },
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
