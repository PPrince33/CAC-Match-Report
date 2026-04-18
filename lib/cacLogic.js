export const CAC_LOGIC = {
  "Pass": {
    "Successful": ["Normal Pass","Goalkick","Goalkeeper Throw","Corner Kick","Free Kick","Throw-in","Penalty"],
    "Assist": ["Normal Pass","Goalkick","Goalkeeper Throw","Corner Kick","Free Kick","Throw-in","Penalty"],
    "Key Pass": ["Normal Pass","Goalkick","Goalkeeper Throw","Corner Kick","Free Kick","Throw-in","Penalty"],
    "Unsuccessful": ["Normal Pass","Goalkick","Goalkeeper Throw","Corner Kick","Free Kick","Throw-in","Penalty"],
    "Off-Side": ["Normal Pass","Goalkick","Goalkeeper Throw","Corner Kick","Free Kick","Penalty"]
  },
  "Ball Control": { "Unsuccessful": ["NA"] },
  "Shoot": {
    "Save": ["Normal","Penalty","Free Kick"],
    "Woodwork": ["Normal","Penalty","Free Kick"],
    "Goal": ["Normal","Penalty","Free Kick"],
    "Block": ["Normal","Penalty","Free Kick"],
    "Off-Target": ["Normal","Penalty","Free Kick"]
  },
  "Carry": { "Successful": ["NA"] },
  "Dribble": { "Successful": ["NA"], "Unsuccessful": ["NA"], "Foul Won": ["NA"] },
  "Sliding Tackle": {
    "Successful": ["With Possession","Without Possession"],
    "Unsuccessful": ["NA"],
    "Foul": ["No Card","Yellow Card","Red Card"]
  },
  "Standing Tackle": {
    "Successful": ["With Possession","Without Possession"],
    "Unsuccessful": ["NA"],
    "Foul": ["No Card","Yellow Card","Red Card"]
  },
  "Save": { "Gripping": ["NA"], "Pushing-in": ["NA"], "Pushing-out": ["NA"] },
  "Block": { "Successful": ["With Possession","Without Possession"], "Unsuccessful": ["Hand Ball","Own Goal"] },
  "Clearance": { "Successful": ["With Possession","Without Possession"], "Unsuccessful": ["Own Goal","Without Possession"] },
  "Pass Intercept": { "Successful": ["With Possession","Without Possession"], "Unsuccessful": ["Hand Ball","Without Possession","Own Goal"] },
  "Pressure": { "Foul": ["No Card"] },
  "Through Ball": { "Successful": ["Normal","Assist","Key Pass"], "Unsuccessful": ["Normal","Off-Side"] },
  "Discipline": { "Foul": ["No Card","Yellow Card","Red Card"] },
  "Substitution": { "Off": ["Tactical","Injury"] },
  "Match Time": { "1st Half": ["Kick-Off","Half Break","Match End"], "2nd Half": ["Kick-Off","Half Break","Match End"] }
}
