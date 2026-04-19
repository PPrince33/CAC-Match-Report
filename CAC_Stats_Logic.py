"""
CAC Match Report — Stats Definitions & Calculation Logic
=========================================================
All stats are derived from a flat table of processed match events.
Each row in `processed_match_events` has:

    match_id            – which match
    player_id           – who performed the action
    reaction_player_id  – who received / reacted (e.g. pass receiver)
    action              – event type  (Pass, Shoot, Carry, Dribble, …)
    outcome             – result      (Successful, Goal, Unsuccessful, …)
    type                – sub-type    (Normal, Corner Kick, Yellow Card, …)
    start_x, start_y    – pitch coords where action started  (metres)
    end_x,   end_y      – pitch coords where action ended
    match_time_seconds  – clock time in seconds
    pressure_on         – bool, True if player was under pressure
"""

# =============================================================================
# PITCH DIMENSIONS
# =============================================================================
PITCH = {
    "football": {
        "width": 105,           # metres (attacking direction = +x)
        "height": 68,
        "goal_width": 7.32,
        "box_x": 88.5,          # penalty-area x start
        "box_y_min": 13.84,
        "box_y_max": 54.16,
        "attacking_third_x": 70,
        "progressive_threshold": 10,  # metres gain in x to count as progressive
    },
    "futsal": {
        "width": 40,
        "height": 20,
        "goal_width": 3.0,
        "box_x": 34,
        "box_y_min": 7,
        "box_y_max": 13,
        "attacking_third_x": 26.67,
        "progressive_threshold": 5,
    },
}


# =============================================================================
# EVENT TAXONOMY  (CAC_LOGIC)
# =============================================================================
# action → { outcome → [allowed types] }
CAC_LOGIC = {
    "Pass": {
        "Successful":  ["Normal Pass", "Goalkick", "Goalkeeper Throw",
                        "Corner Kick", "Free Kick", "Throw-in", "Penalty"],
        "Assist":      ["Normal Pass", "Goalkick", "Goalkeeper Throw",
                        "Corner Kick", "Free Kick", "Throw-in", "Penalty"],
        "Key Pass":    ["Normal Pass", "Goalkick", "Goalkeeper Throw",
                        "Corner Kick", "Free Kick", "Throw-in", "Penalty"],
        "Unsuccessful":["Normal Pass", "Goalkick", "Goalkeeper Throw",
                        "Corner Kick", "Free Kick", "Throw-in", "Penalty"],
        "Off-Side":    ["Normal Pass", "Goalkick", "Goalkeeper Throw",
                        "Corner Kick", "Free Kick", "Penalty"],
    },
    "Ball Control": {"Unsuccessful": ["NA"]},
    "Shoot": {
        "Save":       ["Normal", "Penalty", "Free Kick"],
        "Woodwork":   ["Normal", "Penalty", "Free Kick"],
        "Goal":       ["Normal", "Penalty", "Free Kick"],
        "Block":      ["Normal", "Penalty", "Free Kick"],
        "Off-Target": ["Normal", "Penalty", "Free Kick"],
    },
    "Carry":   {"Successful": ["NA"]},
    "Dribble": {"Successful": ["NA"], "Unsuccessful": ["NA"], "Foul Won": ["NA"]},
    "Sliding Tackle": {
        "Successful":  ["With Possession", "Without Possession"],
        "Unsuccessful":["NA"],
        "Foul":        ["No Card", "Yellow Card", "Red Card"],
    },
    "Standing Tackle": {
        "Successful":  ["With Possession", "Without Possession"],
        "Unsuccessful":["NA"],
        "Foul":        ["No Card", "Yellow Card", "Red Card"],
    },
    "Save":        {"Gripping": ["NA"], "Pushing-in": ["NA"], "Pushing-out": ["NA"]},
    "Block":       {"Successful": ["With Possession", "Without Possession"],
                    "Unsuccessful": ["Hand Ball", "Own Goal"]},
    "Clearance":   {"Successful": ["With Possession", "Without Possession"],
                    "Unsuccessful": ["Own Goal", "Without Possession"]},
    "Pass Intercept": {
        "Successful":  ["With Possession", "Without Possession"],
        "Unsuccessful":["Hand Ball", "Without Possession", "Own Goal"],
    },
    "Pressure":     {"Foul": ["No Card"]},
    "Through Ball": {
        "Successful":  ["Normal", "Assist", "Key Pass"],
        "Unsuccessful":["Normal", "Off-Side"],
    },
    "Discipline":   {"Foul": ["No Card", "Yellow Card", "Red Card"]},
    "Substitution": {"Off": ["Tactical", "Injury"]},
    "Match Time":   {
        "1st Half": ["Kick-Off", "Half Break", "Match End"],
        "2nd Half": ["Kick-Off", "Half Break", "Match End"],
    },
}


# =============================================================================
# xG MODEL  (Torvaney logistic regression)
# =============================================================================
# Source: https://torvaney.github.io/projects/xG.html
#
# Features
#   goal_angle    – angle (radians) subtended by the goal width from shot position
#   goal_distance – straight-line distance (metres) to centre of goal
#   is_header     – 0 for all shots (headers not tracked in CAC data)
#
# Coefficients (non-header path):
#   intercept                    = -1.745598
#   b_angle                      =  1.338737
#   b_distance                   = -0.110384
#   b_angle_x_distance           =  0.168798
#
# xG = sigmoid(intercept + b_angle*angle + b_dist*dist + b_int*angle*dist)
# Clamped to [0.01, 0.95]

import math

def calculate_xg(start_x: float, start_y: float, pitch: dict) -> float:
    """
    Return xG for a shot taken from (start_x, start_y) on the given pitch.

    Parameters
    ----------
    start_x, start_y : float  — shot origin in metres (0,0 = bottom-left)
    pitch            : dict   — one of PITCH["football"] or PITCH["futsal"]
    """
    goal_x        = pitch["width"]
    goal_center_y = pitch["height"] / 2
    half_goal     = pitch["goal_width"] / 2

    goal_post1_y  = goal_center_y - half_goal
    goal_post2_y  = goal_center_y + half_goal

    # Distance to goal centre
    dx            = goal_x - start_x
    dy            = goal_center_y - start_y
    goal_distance = math.sqrt(dx**2 + dy**2)

    # Angle subtended by goal width
    angle1        = math.atan2(goal_post1_y - start_y, goal_x - start_x)
    angle2        = math.atan2(goal_post2_y - start_y, goal_x - start_x)
    goal_angle    = abs(angle2 - angle1)

    linear = (
        -1.745598
        + 1.338737  * goal_angle
        - 0.110384  * goal_distance
        + 0.168798  * goal_angle * goal_distance
    )

    xg = 1 / (1 + math.exp(-linear))
    return round(max(0.01, min(0.95, xg)), 2)


# =============================================================================
# STAT CALCULATIONS  (given a list of enriched events for one team)
# =============================================================================
# Each event dict is expected to already carry a `team_id` field and an `xg`
# field computed by calculate_xg() above.
#
# Helper: filter events by team
def team_events(events: list, team_id) -> list:
    return [e for e in events if e.get("team_id") == team_id]

def opp_events(events: list, team_id) -> list:
    return [e for e in events if e.get("team_id") != team_id]


# ─────────────────────────────────────────────
# POSSESSION
# ─────────────────────────────────────────────
def possession(events: list, home_id, away_id) -> dict:
    """
    Pass-based possession.
    Count all Pass + Through Ball events for each team;
    the share of total pass-events is each team's possession %.
    """
    home_passes = len([e for e in events
                       if e["team_id"] == home_id
                       and e["action"] in ("Pass", "Through Ball")])
    away_passes = len([e for e in events
                       if e["team_id"] == away_id
                       and e["action"] in ("Pass", "Through Ball")])
    total = home_passes + away_passes
    home_pct = round((home_passes / total) * 100) if total else 50
    return {"home": home_pct, "away": 100 - home_pct}


# ─────────────────────────────────────────────
# ATTACK STATS  (per team)
# ─────────────────────────────────────────────
def attack_stats(evs: list, pitch: dict) -> dict:
    """
    Compute all attacking stats for a single team's event list.

    Parameters
    ----------
    evs   : list of event dicts pre-filtered to one team
    pitch : PITCH["football"] or PITCH["futsal"]
    """
    shots  = [e for e in evs if e["action"] == "Shoot"]
    passes = [e for e in evs if e["action"] == "Pass"]

    # ── Shooting ────────────────────────────────────────────────────────────
    goals  = len([s for s in shots if s["outcome"] == "Goal"])
    sot    = len([s for s in shots if s["outcome"] in ("Goal", "Save")])

    # Inside box = shot origin inside the penalty area rectangle
    box_shots = len([
        s for s in shots
        if s.get("start_x") is not None
        and s["start_x"] >= pitch["box_x"]
        and pitch["box_y_min"] <= s["start_y"] <= pitch["box_y_max"]
    ])

    xg        = round(sum(s.get("xg", 0) for s in shots), 2)
    xg_per_shot = round(xg / len(shots), 2) if shots else 0
    xg_diff   = round(goals - xg, 2)          # over/under-performance

    # ── Passing ─────────────────────────────────────────────────────────────
    succ_passes = len([p for p in passes
                       if p["outcome"] in ("Successful", "Assist", "Key Pass")])
    pass_acc    = round((succ_passes / len(passes)) * 100) if passes else 0

    # Progressive pass: end_x - start_x >= progressive_threshold
    prog_passes = len([
        p for p in passes
        if p.get("end_x") is not None and p.get("start_x") is not None
        and (p["end_x"] - p["start_x"]) >= pitch["progressive_threshold"]
    ])

    key_passes  = len([p for p in passes if p["outcome"] == "Key Pass"])

    # Assists = passes with outcome Assist + through balls with outcome Assist
    through_balls     = [e for e in evs if e["action"] == "Through Ball"]
    assist_passes     = len([p for p in passes if p["outcome"] == "Assist"])
    assist_through    = len([t for t in through_balls if t["outcome"] == "Assist"])
    assists           = assist_passes + assist_through

    # Crosses = Corner Kicks + wide passes in final third
    # (pass starting in final third on wide channel, y < 20 % or y > 80 % of pitch height)
    ATT_X = pitch["attacking_third_x"]
    crosses = len([
        e for e in evs
        if e.get("type") == "Corner Kick"
        or (
            e["action"] == "Pass"
            and e.get("start_y") is not None
            and (e["start_y"] < pitch["height"] * 0.2
                 or e["start_y"] > pitch["height"] * 0.8)
            and e.get("start_x", 0) > ATT_X
        )
    ])

    # ── Ball Progression ────────────────────────────────────────────────────
    carries = [e for e in evs if e["action"] == "Carry"]
    prog_carries = len([
        c for c in carries
        if c.get("end_x") is not None and c.get("start_x") is not None
        and (c["end_x"] - c["start_x"]) >= pitch["progressive_threshold"]
    ])
    final_third_carries = len([
        c for c in carries
        if c.get("start_x") is not None and c.get("end_x") is not None
        and c["start_x"] < ATT_X <= c["end_x"]
    ])

    dribbles      = [e for e in evs if e["action"] == "Dribble"]
    succ_dribbles = len([d for d in dribbles if d["outcome"] == "Successful"])
    dribble_acc   = round((succ_dribbles / len(dribbles)) * 100) if dribbles else 0

    # ── Under Pressure ──────────────────────────────────────────────────────
    shots_under_pressure = len([s for s in shots if s.get("pressure_on") is True])
    passes_under_pressure = [p for p in passes if p.get("pressure_on") is True]
    succ_press_passes = len([
        p for p in passes_under_pressure
        if p["outcome"] in ("Successful", "Assist", "Key Pass")
    ])
    press_pass_acc = (
        round((succ_press_passes / len(passes_under_pressure)) * 100)
        if passes_under_pressure else 0
    )

    return {
        # Shooting
        "goals": goals, "shots": len(shots), "sot": sot,
        "box_shots": box_shots, "out_box_shots": len(shots) - box_shots,
        "xg": xg, "xg_per_shot": xg_per_shot, "xg_diff": xg_diff,
        # Passing
        "passes": len(passes), "succ_passes": succ_passes, "pass_acc": pass_acc,
        "prog_passes": prog_passes, "key_passes": key_passes,
        "assists": assists, "through_balls": len(through_balls), "crosses": crosses,
        # Ball progression
        "carries": len(carries), "prog_carries": prog_carries,
        "final_third_carries": final_third_carries,
        "dribbles": len(dribbles), "succ_dribbles": succ_dribbles,
        "dribble_acc": dribble_acc,
        # Under pressure
        "shots_under_pressure": shots_under_pressure,
        "press_pass_acc": press_pass_acc,
    }


# ─────────────────────────────────────────────
# DEFENSE STATS  (per team + opponent context)
# ─────────────────────────────────────────────
def defense_stats(evs: list, opp_evs: list, pitch: dict) -> dict:
    """
    Compute all defensive stats for one team.

    Parameters
    ----------
    evs     : events belonging to the defending team
    opp_evs : events belonging to the opponent
    pitch   : PITCH["football"] or PITCH["futsal"]
    """
    # ── Tackling ────────────────────────────────────────────────────────────
    tackles        = [e for e in evs if e["action"] in ("Sliding Tackle", "Standing Tackle")]
    succ_tackles   = [t for t in tackles if t["outcome"] == "Successful"]
    tackle_success = round((len(succ_tackles) / len(tackles)) * 100) if tackles else 0
    tackles_w_poss = len([t for t in succ_tackles if t["type"] == "With Possession"])

    # ── Interceptions ───────────────────────────────────────────────────────
    interceptions     = [e for e in evs if e["action"] == "Pass Intercept"]
    succ_ints         = [i for i in interceptions if i["outcome"] == "Successful"]
    ints_with_poss    = len([i for i in succ_ints if i["type"] == "With Possession"])

    # ── Blocks ──────────────────────────────────────────────────────────────
    blocks            = [e for e in evs if e["action"] == "Block"]
    succ_blocks       = [b for b in blocks if b["outcome"] == "Successful"]
    blocks_w_poss     = len([b for b in succ_blocks if b["type"] == "With Possession"])

    # ── Clearances ──────────────────────────────────────────────────────────
    clearances        = [e for e in evs if e["action"] == "Clearance"]
    succ_clearances   = [c for c in clearances if c["outcome"] == "Successful"]
    clear_w_poss      = len([c for c in succ_clearances if c["type"] == "With Possession"])

    # ── Pressures ───────────────────────────────────────────────────────────
    pressures         = [e for e in evs if e["action"] == "Pressure"]
    pressure_fouls    = len([p for p in pressures if p["outcome"] == "Foul"])

    # ── Discipline ──────────────────────────────────────────────────────────
    discipline        = [e for e in evs if e["action"] == "Discipline"]
    disc_fouls        = [d for d in discipline if d["outcome"] == "Foul"]
    total_fouls       = len(disc_fouls)
    yellow_cards      = len([d for d in disc_fouls if d["type"] == "Yellow Card"])
    red_cards         = len([d for d in disc_fouls if d["type"] == "Red Card"])

    # ── Saves ────────────────────────────────────────────────────────────────
    saves             = [e for e in evs if e["action"] == "Save"]
    gripping_saves    = len([s for s in saves if s["outcome"] == "Gripping"])
    push_saves        = len([s for s in saves if s["outcome"] in ("Pushing-in", "Pushing-out")])
    opp_shots_blocked = len([e for e in opp_evs if e["action"] == "Shoot" and e["outcome"] == "Block"])

    # ── Aggregates ──────────────────────────────────────────────────────────
    possession_wins = tackles_w_poss + ints_with_poss + blocks_w_poss + clear_w_poss
    ball_recoveries = possession_wins + len(saves)
    total_def_actions = (
        len(tackles) + len(interceptions) + len(blocks)
        + len(clearances) + len(pressures)
    )
    total_succ = (
        len(succ_tackles) + len(succ_ints)
        + len(succ_blocks) + len(succ_clearances)
    )
    def_action_success_rate = (
        round((total_succ / total_def_actions) * 100) if total_def_actions else 0
    )

    # ── PPDA (Passes Per Defensive Action) ──────────────────────────────────
    # Measures how intensely a team presses.
    # Zone: the OPPONENT's defensive 60% of the pitch
    #       i.e. the attacking 60% from the pressing team's perspective
    #       press_threshold = pitch_width × 0.4
    # Formula:
    #   PPDA = opponent passes in zone / team def-actions in that zone
    # Lower PPDA = more intense pressing (fewer opponent passes per action).
    # Defensive actions counted: Tackles + Interceptions + Discipline + Pressure
    # (consistent with StatsBomb's PPDA definition)
    press_threshold = pitch["width"] * 0.4

    opp_passes_in_zone = len([
        e for e in opp_evs
        if e["action"] == "Pass"
        and e.get("start_x") is not None
        and e["start_x"] > press_threshold
    ])
    def_actions_in_zone = len([
        e for e in evs
        if e["action"] in (
            "Sliding Tackle", "Standing Tackle",
            "Pass Intercept", "Discipline", "Pressure"
        )
        and e.get("start_x") is not None
        and e["start_x"] > press_threshold
    ])
    ppda = (
        round(opp_passes_in_zone / def_actions_in_zone, 2)
        if def_actions_in_zone > 0 else None   # None → displayed as N/A
    )

    return {
        # Tackling
        "total_tackles": len(tackles), "succ_tackles": len(succ_tackles),
        "tackle_success": tackle_success, "tackles_with_poss": tackles_w_poss,
        # Interceptions
        "total_interceptions": len(interceptions),
        "succ_interceptions": len(succ_ints), "ints_with_poss": ints_with_poss,
        # Blocks
        "total_blocks": len(blocks), "succ_blocks": len(succ_blocks),
        "blocks_with_poss": blocks_w_poss,
        # Clearances
        "total_clearances": len(clearances), "succ_clearances": len(succ_clearances),
        "clear_with_poss": clear_w_poss,
        # Pressures & discipline
        "total_pressures": len(pressures), "pressure_fouls": pressure_fouls,
        "total_fouls": total_fouls, "yellow_cards": yellow_cards, "red_cards": red_cards,
        # Saves
        "total_saves": len(saves), "gripping_saves": gripping_saves,
        "push_saves": push_saves, "opp_shots_blocked": opp_shots_blocked,
        # Aggregates
        "possession_wins": possession_wins, "ball_recoveries": ball_recoveries,
        "total_defensive_actions": total_def_actions,
        "def_action_success_rate": def_action_success_rate,
        # PPDA
        "ppda": ppda,
        "opp_passes_in_zone": opp_passes_in_zone,
        "def_actions_in_zone": def_actions_in_zone,
    }


# ─────────────────────────────────────────────
# FIELD TILT
# ─────────────────────────────────────────────
def field_tilt(events: list, home_id, away_id, pitch: dict) -> dict:
    """
    Share of actions each team performs in the attacking third (x > 2/3 pitch width).
    Reflects territorial dominance regardless of ball possession.
    """
    threshold = pitch["width"] * (2 / 3)
    home_att = len([e for e in events
                    if e.get("team_id") == home_id
                    and e.get("start_x") is not None
                    and e["start_x"] > threshold])
    away_att = len([e for e in events
                    if e.get("team_id") == away_id
                    and e.get("start_x") is not None
                    and e["start_x"] > threshold])
    total = home_att + away_att
    return {
        "home_actions": home_att,
        "away_actions": away_att,
        "home_tilt": round((home_att / total) * 100) if total else 50,
        "away_tilt": round((away_att / total) * 100) if total else 50,
    }


# ─────────────────────────────────────────────
# VERTICALITY
# ─────────────────────────────────────────────
def verticality(events: list, team_id) -> dict:
    """
    Percentage of passes that travel FORWARD (end_x > start_x).
    Higher = more direct / vertical play style.
      >= 60 % → High
      40–59 % → Medium
      < 40 %  → Low
    """
    passes = [
        e for e in events
        if e.get("team_id") == team_id
        and e["action"] in ("Pass", "Through Ball")
        and e.get("start_x") is not None
        and e.get("end_x")   is not None
    ]
    if not passes:
        return {"ratio": 0, "label": "N/A", "forward": 0, "total": 0}
    forward = len([p for p in passes if p["end_x"] - p["start_x"] > 0])
    ratio   = round((forward / len(passes)) * 100)
    label   = "High" if ratio >= 60 else "Medium" if ratio >= 40 else "Low"
    return {"ratio": ratio, "label": label, "forward": forward, "total": len(passes)}


# ─────────────────────────────────────────────
# ZONE DISTRIBUTION
# ─────────────────────────────────────────────
def zone_distribution(events: list, pitch: dict) -> dict:
    """
    Split all visible events into defensive / middle / attacking thirds.
    Returns percentage share for each zone.
    """
    valid = [e for e in events if e.get("start_x") is not None]
    if not valid:
        return {"def": 0, "mid": 0, "att": 0}
    third = pitch["width"] / 3
    def_  = len([e for e in valid if e["start_x"] <= third])
    mid   = len([e for e in valid if third < e["start_x"] <= third * 2])
    att   = len([e for e in valid if e["start_x"] > third * 2])
    total = len(valid)
    return {
        "def": round((def_ / total) * 100),
        "mid": round((mid  / total) * 100),
        "att": round((att  / total) * 100),
    }


# ─────────────────────────────────────────────
# AVERAGE POSITIONS  (per player)
# ─────────────────────────────────────────────
def average_positions(events: list, lineup: list, team_id,
                      stat_type: str = "ALL_ACTIONS") -> list:
    """
    Return the average pitch position for each player on a team.

    stat_type options
    -----------------
    ALL_ACTIONS  – every event (start_x / start_y)
    PASS         – pass / through ball origins
    RECEIVE      – successful pass / through ball destinations (reaction player)
    SHOT         – shot origins
    DEFENCE      – tackle / interception / save / block origins
    """
    player_ids = [l["player_id"] for l in lineup if l["team_id"] == team_id]
    stats = {}

    for e in events:
        pid = x = y = None

        if stat_type == "ALL_ACTIONS":
            pid, x, y = e["player_id"], e.get("start_x"), e.get("start_y")

        elif stat_type == "PASS" and e["action"] in ("Pass", "Through Ball"):
            pid, x, y = e["player_id"], e.get("start_x"), e.get("start_y")

        elif stat_type == "RECEIVE" and e["action"] in ("Pass", "Through Ball"):
            if e["outcome"] in ("Successful", "Assist", "Key Pass"):
                pid, x, y = e.get("reaction_player_id"), e.get("end_x"), e.get("end_y")

        elif stat_type == "SHOT" and e["action"] == "Shoot":
            pid, x, y = e["player_id"], e.get("start_x"), e.get("start_y")

        elif stat_type == "DEFENCE" and e["action"] in (
            "Pass Intercept", "Standing Tackle",
            "Sliding Tackle", "Save", "Block"
        ):
            pid, x, y = e["player_id"], e.get("start_x"), e.get("start_y")

        if pid and pid in player_ids and x is not None and y is not None:
            if pid not in stats:
                stats[pid] = {"sum_x": 0.0, "sum_y": 0.0, "count": 0}
            stats[pid]["sum_x"] += x
            stats[pid]["sum_y"] += y
            stats[pid]["count"] += 1

    return [
        {
            "player_id": pid,
            "avg_x": s["sum_x"] / s["count"],
            "avg_y": s["sum_y"] / s["count"],
            "count": s["count"],
        }
        for pid, s in stats.items()
    ]


# ─────────────────────────────────────────────
# SCORE  (computed from events, not stored value)
# ─────────────────────────────────────────────
def compute_score(events: list, home_id, away_id) -> dict:
    """
    Derive scoreline from event data.
    Goals = Shoot → Goal (team gets the goal)
    Own goals = any action → outcome Unsuccessful + type Own Goal
                (attributed to the OTHER team)
    """
    home = away = 0
    for e in events:
        if e["action"] == "Shoot" and e["outcome"] == "Goal":
            if e["team_id"] == home_id:
                home += 1
            elif e["team_id"] == away_id:
                away += 1
        if e["outcome"] == "Unsuccessful" and e.get("type") == "Own Goal":
            if e["team_id"] == home_id:
                away += 1          # own goal by home → away scores
            elif e["team_id"] == away_id:
                home += 1
    return {"home": home, "away": away}


# =============================================================================
# QUICK-REFERENCE GLOSSARY
# =============================================================================
GLOSSARY = {
    "Possession (%)":
        "Pass-based: home_pass_events / total_pass_events × 100.",

    "xG (Expected Goals)":
        "Torvaney logistic regression on goal angle & goal distance. "
        "Clamped [0.01, 0.95]. Summed per team across all shots.",

    "xG per Shot":
        "Team xG ÷ total shots.",

    "xG Diff":
        "Goals scored − xG. Positive = over-performed; negative = under-performed.",

    "Shots on Target (SoT)":
        "Shots with outcome Goal or Save.",

    "Shots Inside Box":
        "Shots whose start_x/start_y falls inside the penalty-area rectangle.",

    "Pass Accuracy (%)":
        "Successful + Assist + Key Pass outcomes ÷ total Pass events × 100.",

    "Key Passes":
        "Passes with outcome Key Pass (directly led to a shot).",

    "Assists":
        "Pass outcome=Assist + Through Ball outcome=Assist.",

    "Crosses":
        "Corner Kick type events + wide passes from the attacking third "
        "(start_y < 20 % or > 80 % of pitch height and start_x > attacking third).",

    "Through Balls":
        "All events with action=Through Ball.",

    "Progressive Pass":
        "Pass where end_x − start_x ≥ progressive_threshold (10 m football / 5 m futsal).",

    "Progressive Carry":
        "Carry where end_x − start_x ≥ progressive_threshold.",

    "Final-Third Carry":
        "Carry that starts before the attacking third and ends inside it.",

    "Dribble Success (%)":
        "Dribbles with outcome Successful ÷ total Dribbles × 100.",

    "Shots Under Pressure":
        "Shots where pressure_on = True.",

    "Pass Acc Under Pressure (%)":
        "Successful+Assist+KeyPass passes where pressure_on=True ÷ "
        "total passes under pressure × 100.",

    "Tackles (Success %)":
        "Sliding + Standing tackles. Success = outcome Successful.",

    "Interceptions":
        "Pass Intercept events.",

    "Possession Wins":
        "Successful tackles/ints/blocks/clearances with type=With Possession (team regained ball).",

    "Total Defensive Actions":
        "Tackles + Interceptions + Blocks + Clearances + Pressures.",

    "PPDA (Passes Per Defensive Action)":
        "Opponent passes in their defensive 60 % ÷ team defensive actions in same zone. "
        "Lower = more intense press. Zone threshold = pitch_width × 0.4 from own goal.",

    "Field Tilt (%)":
        "Share of actions in the attacking third. "
        "Reflects territorial control rather than pass possession.",

    "Verticality":
        "% of passes that travel forward (end_x > start_x). "
        "High ≥ 60 %, Medium 40–59 %, Low < 40 %.",

    "Zone Distribution":
        "% of visible events in Defensive / Middle / Attacking third "
        "(pitch split into three equal horizontal bands).",

    "Average Position":
        "Mean start_x / start_y of all selected events for a player. "
        "Modes: ALL_ACTIONS, PASS, RECEIVE, SHOT, DEFENCE.",
}
