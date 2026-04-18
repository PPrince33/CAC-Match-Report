import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ChevronLeft, Activity, Map as MapIcon, Crosshair, 
  Shield, Grid, Terminal, RefreshCw, ClipboardList, 
  Filter, ChevronDown, Layers, Clock, Users, Zap, Target,
  Video, Edit3, Download
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import statsConfig from './stats_config.json';

// ============================================================================
// ⚙️ PITCH CONFIGURATION (Futsal vs Football)
// ============================================================================
const PITCH_CONFIG = {
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
    width: 105, height: 68,
    centerCircleRadius: 9.15,
    penaltyAreaX: 16.5, penaltyAreaYMin: 13.84, penaltyAreaYMax: 54.16,
    goalAreaX: 5.5, goalAreaYMin: 24.84, goalAreaYMax: 43.16,
    penaltySpot1: 11,
    goalWidth: 7.32, goalYMin: 30.34, goalYMax: 37.66,
    goalHeight: 2.44,
    aspectRatio: 0.65,
    attackingThirdX: 70,
    boxX: 88.5, boxYMin: 13.84, boxYMax: 54.16,
    progressiveThreshold: 21,
    label: 'Football'
  }
};

// ============================================================================
// 📐 xG CALCULATOR (distance + angle based)
// ============================================================================
const calculateXG = (startX, startY, pitchW, pitchH) => {
  const goalX = pitchW;
  const goalCenterY = pitchH / 2;
  const goalW = pitchW === 40 ? 3 : 7.32;
  const dx = goalX - startX;
  const dy = goalCenterY - startY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const goalPost1Y = goalCenterY - goalW / 2;
  const goalPost2Y = goalCenterY + goalW / 2;
  const angle1 = Math.atan2(goalPost1Y - startY, goalX - startX);
  const angle2 = Math.atan2(goalPost2Y - startY, goalX - startX);
  const angle = Math.abs(angle2 - angle1);
  const maxDist = pitchW * 0.8;
  const distFactor = Math.max(0, 1 - distance / maxDist);
  const angleFactor = angle / Math.PI;
  let xg = distFactor * 0.55 + angleFactor * 0.45;
  xg = Math.max(0.01, Math.min(0.95, xg));
  return parseFloat(xg.toFixed(2));
};

// ============================================================================
// ⚙️ CAC LOGIC DICTIONARY
// ============================================================================
const CAC_LOGIC = {
  "Pass": {
      "Successful": ["Normal Pass", "Goalkick", "Goalkeeper Throw", "Corner Kick", "Free Kick", "Throw-in", "Penalty"],
      "Assist": ["Normal Pass", "Goalkick", "Goalkeeper Throw", "Corner Kick", "Free Kick", "Throw-in", "Penalty"],
      "Key Pass": ["Normal Pass", "Goalkick", "Goalkeeper Throw", "Corner Kick", "Free Kick", "Throw-in", "Penalty"],
      "Unsuccessful": ["Normal Pass", "Goalkick", "Goalkeeper Throw", "Corner Kick", "Free Kick", "Throw-in", "Penalty"],
      "Off-Side": ["Normal Pass", "Goalkick", "Goalkeeper Throw", "Corner Kick", "Free Kick", "Penalty"]
  },
  "Ball Control": { "Unsuccessful": ["NA"] },
  "Shoot": {
      "Save": ["Normal", "Penalty", "Free Kick"],
      "Woodwork": ["Normal", "Penalty", "Free Kick"],
      "Goal": ["Normal", "Penalty", "Free Kick"],
      "Block": ["Normal", "Penalty", "Free Kick"],
      "Off-Target": ["Normal", "Penalty", "Free Kick"]
  },
  "Carry": { "Successful": ["NA"] },
  "Dribble": {
      "Successful": ["NA"],
      "Unsuccessful": ["NA"],
      "Foul Won": ["NA"]
  },
  "Sliding Tackle": {
      "Successful": ["With Possession", "Without Possession"],
      "Unsuccessful": ["NA"],
      "Foul": ["No Card", "Yellow Card", "Red Card"]
  },
  "Standing Tackle": {
      "Successful": ["With Possession", "Without Possession"],
      "Unsuccessful": ["NA"],
      "Foul": ["No Card", "Yellow Card", "Red Card"]
  },
  "Save": {
      "Gripping": ["NA"],
      "Pushing-in": ["NA"],
      "Pushing-out": ["NA"]
  },
  "Block": {
      "Successful": ["With Possession", "Without Possession"],
      "Unsuccessful": ["Hand Ball", "Own Goal"]
  },
  "Clearance": {
      "Successful": ["With Possession", "Without Possession"],
      "Unsuccessful": ["Own Goal", "Without Possession"]
  },
  "Pass Intercept": {
      "Successful": ["With Possession", "Without Possession"],
      "Unsuccessful": ["Hand Ball", "Without Possession", "Own Goal"]
  },
  "Pressure": { "Foul": ["No Card"] },
  "Through Ball": {
      "Successful": ["Normal", "Assist", "Key Pass"],
      "Unsuccessful": ["Normal", "Off-Side"]
  },
  "Discipline": { "Foul": ["No Card", "Yellow Card", "Red Card"] },
  "Substitution": { "Off": ["Tactical", "Injury"] },
  "Match Time": {
      "1st Half": ["Kick-Off", "Half Break", "Match End"],
      "2nd Half": ["Kick-Off", "Half Break", "Match End"],
      "1st Extra Time": ["Kick-Off", "Half Break", "Match End"],
      "2nd Extra Time": ["Kick-Off", "Half Break", "Match End"],
      "Penalty shootout": ["Kick-Off", "Match End"]
  }
};

// ============================================================================
// 📊 STATS REGISTRY
// ============================================================================
const STATS_REGISTRY = {
  // ── SUMMARY ──
  "summary_possession":    { label: "Possession",                      getH: (h) => `${h.possession}%`,                              getA: (a) => `${a.possession}%`,                              highlight: true  },
  "summary_xg":            { label: "Expected Goals (xG)",              getH: (h) => h.xg,                                            getA: (a) => a.xg                                                              },
  "summary_shots_sot":     { label: "Shots (SoT)",                      getH: (h) => `${h.shots} (${h.sot})`,                         getA: (a) => `${a.shots} (${a.sot})`                                          },
  "summary_pass_accuracy": { label: "Pass Accuracy (Total Passes)",     getH: (h) => `${h.passAcc}% (${h.passes})`,                   getA: (a) => `${a.passAcc}% (${a.passes})`                                    },
  "summary_fouls":         { label: "Disciplined Play (Fouls)",         getH: (h) => h.fouls,                                         getA: (a) => a.fouls                                                           },

  // ── ATTACK – Shooting & Efficiency ──
  "attack_goals":                { label: "Goals",                      getH: (h) => h.goals,                                         getA: (a) => a.goals,                                         highlight: true  },
  "attack_shots_on_target":      { label: "Total Shots (On Target)",    getH: (h) => `${h.shots} (${h.sot})`,                         getA: (a) => `${a.shots} (${a.sot})`                                          },
  "attack_shots_inside_box":     { label: "Shots Inside Box",           getH: (h) => h.boxShots,                                      getA: (a) => a.boxShots                                                        },
  "attack_shots_outside_box":    { label: "Shots Outside Box",          getH: (h) => h.outBoxShots,                                   getA: (a) => a.outBoxShots                                                     },
  "attack_avg_shot_distance":    { label: "Avg Shot Distance (m)",      getH: (h) => h.avgShotDist,                                   getA: (a) => a.avgShotDist                                                     },
  "attack_xg":                   { label: "Expected Goals (xG)",        getH: (h) => h.xg,                                            getA: (a) => a.xg                                                              },
  "attack_xg_per_shot":          { label: "xG Per Shot",                getH: (h) => h.xgPerShot,                                     getA: (a) => a.xgPerShot                                                       },
  "attack_xg_overperformance":   { label: "xG Overperformance",         getH: (h) => h.xgDiff,                                        getA: (a) => a.xgDiff                                                          },

  // ── ATTACK – Distribution & Creativity ──
  "attack_assists":             { label: "Assists",                      getH: (h) => h.assists,                                       getA: (a) => a.assists,                                       highlight: true  },
  "attack_key_passes":          { label: "Key Passes",                   getH: (h) => h.keyPasses,                                     getA: (a) => a.keyPasses                                                       },
  "attack_total_passes":        { label: "Total Passes (Accuracy %)",   getH: (h) => `${h.passes} (${h.passAcc}%)`,                   getA: (a) => `${a.passes} (${a.passAcc}%)`                                    },
  "attack_progressive_passes":  { label: "Progressive Passes",          getH: (h) => h.progPasses,                                    getA: (a) => a.progPasses                                                      },
  "attack_through_balls":       { label: "Through Balls",               getH: (h) => h.throughBalls,                                  getA: (a) => a.throughBalls                                                    },
  "attack_crosses":             { label: "Crosses",                      getH: (h) => h.crosses,                                       getA: (a) => a.crosses                                                         },

  // ── ATTACK – Ball Progression ──
  "attack_total_carries":         { label: "Total Carries",              getH: (h) => h.carries,                                       getA: (a) => a.carries                                                         },
  "attack_progressive_carries":   { label: "Progressive Carries",        getH: (h) => h.progCarries,                                   getA: (a) => a.progCarries                                                     },
  "attack_carries_final_third":   { label: "Carries into Final 3rd",     getH: (h) => h.final3rdCarries,                               getA: (a) => a.final3rdCarries,                               highlight: true  },
  "attack_dribbles":              { label: "Dribbles (Success %)",        getH: (h) => `${h.dribbles} (${h.dribbleAcc}%)`,             getA: (a) => `${a.dribbles} (${a.dribbleAcc}%)`                               },

  // ── ATTACK – Performance Under Pressure ──
  "attack_shots_under_pressure":    { label: "Shots Under Pressure",     getH: (h) => h.shotsUnderPressure,                           getA: (a) => a.shotsUnderPressure,                            highlight: true  },
  "attack_pass_acc_under_pressure": { label: "Pass Acc Under Pressure",  getH: (h) => `${h.pressPassAcc}%`,                           getA: (a) => `${a.pressPassAcc}%`                                              },

  // ── DEFENSE – Tackling & Interceptions ──
  "defense_total_tackles":               { label: "Total Tackles (Success %)",    getH: (h) => `${h.totalTackles} (${h.tackleSuccess}%)`,         getA: (a) => `${a.totalTackles} (${a.tackleSuccess}%)`,        highlight: true  },
  "defense_tackles_succ_failed":         { label: "Tackles: Succ / Failed",       getH: (h) => `${h.succTackles} / ${h.failedTackles}`,           getA: (a) => `${a.succTackles} / ${a.failedTackles}`                            },
  "defense_tackles_gaining_poss":        { label: "Tackles Gaining Possession",   getH: (h) => h.tacklesWithPoss,                                  getA: (a) => a.tacklesWithPoss                                                  },
  "defense_total_interceptions":         { label: "Total Interceptions",           getH: (h) => h.totalInterceptions,                               getA: (a) => a.totalInterceptions,                             highlight: true  },
  "defense_interceptions_succ_failed":   { label: "Interceptions: Succ / Failed", getH: (h) => `${h.succInterceptions} / ${h.failedInterceptions}`, getA: (a) => `${a.succInterceptions} / ${a.failedInterceptions}`                },
  "defense_ints_gaining_poss":           { label: "Ints Gaining Possession",      getH: (h) => h.intsWithPoss,                                     getA: (a) => a.intsWithPoss                                                     },

  // ── DEFENSE – Blocks & Clearances ──
  "defense_total_blocks":              { label: "Total Blocks (Successful)",     getH: (h) => `${h.totalBlocks} (${h.succBlocks})`,               getA: (a) => `${a.totalBlocks} (${a.succBlocks})`,             highlight: true  },
  "defense_opp_shots_blocked":         { label: "Opponent Shots Blocked",        getH: (h) => h.oppShotsBlocked,                                  getA: (a) => a.oppShotsBlocked                                                  },
  "defense_total_clearances":          { label: "Total Clearances (Successful)", getH: (h) => `${h.totalClearances} (${h.succClearances})`,       getA: (a) => `${a.totalClearances} (${a.succClearances})`,     highlight: true  },
  "defense_clearances_gaining_poss":   { label: "Clearances Gaining Poss",       getH: (h) => h.clearWithPoss,                                    getA: (a) => a.clearWithPoss                                                    },
  "defense_own_goals":                 { label: "Defensive Own Goals",           getH: (h) => h.blockOwnGoals + h.clearOwnGoals,                  getA: (a) => a.blockOwnGoals + a.clearOwnGoals                                  },

  // ── DEFENSE – Work Rate & Recoveries ──
  "defense_total_defensive_actions":   { label: "Total Defensive Actions",       getH: (h) => h.totalDefensiveActions,                            getA: (a) => a.totalDefensiveActions,                          highlight: true  },
  "defense_defensive_success_rate":    { label: "Defensive Success %",           getH: (h) => `${h.defActionSuccessRate}%`,                       getA: (a) => `${a.defActionSuccessRate}%`                                       },
  "defense_possession_wins":           { label: "Possession Wins",               getH: (h) => h.possessionWins,                                   getA: (a) => a.possessionWins,                                 highlight: true  },
  "defense_total_ball_recoveries":     { label: "Total Ball Recoveries",         getH: (h) => h.ballRecoveries,                                   getA: (a) => a.ballRecoveries                                                   },
  "defense_total_pressures":           { label: "Total Pressures",               getH: (h) => h.totalPressures,                                   getA: (a) => a.totalPressures                                                   },

  // ── DEFENSE – Goalkeeping & Discipline ──
  "defense_total_saves":         { label: "Total Saves",                          getH: (h) => h.totalSaves,                                       getA: (a) => a.totalSaves,                                     highlight: true  },
  "defense_gripping_push_saves": { label: "Gripping / Push Saves",               getH: (h) => `${h.grippingSaves} / ${h.pushSaves}`,             getA: (a) => `${a.grippingSaves} / ${a.pushSaves}`                              },
  "defense_total_fouls":         { label: "Total Fouls (Inc. Pressing)",          getH: (h) => h.totalFouls + h.pressureFouls,                    getA: (a) => a.totalFouls + a.pressureFouls,                   highlight: true  },
  "defense_yellow_red_cards":    { label: "Yellow / Red Cards",                   getH: (h) => `${h.yellowCards} / ${h.redCards}`,                getA: (a) => `${a.yellowCards} / ${a.redCards}`                                 },
};

// Helper: render CompareRow components driven by stats_config.json
const renderStatRows = (sectionKey, homeStats, awayStats) => {
  if (!homeStats || !awayStats) return null;
  return (statsConfig[sectionKey] || [])
    .filter(e => e.enabled)
    .sort((a, b) => a.order - b.order)
    .map(e => {
      const def = STATS_REGISTRY[e.id];
      if (!def) return null;
      return (
        <CompareRow
          key={e.id}
          label={def.label}
          homeVal={def.getH(homeStats)}
          awayVal={def.getA(awayStats)}
          highlight={def.highlight || false}
        />
      );
    });
};

// ============================================================================
// ⚙️ SUPABASE CONFIGURATION
// ============================================================================
const SUPABASE_URL = "https://pxhbxewnijavotdwiueo.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4aGJ4ZXduaWphdm90ZHdpdWVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNjIwODIsImV4cCI6MjA4OTkzODA4Mn0.UD55F-XT43KYbZpKRiwuD70eSNLpJvAQT5n-V5bYL00";

const fetchSupabase = async (table, queryParams) => {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  Object.entries(queryParams).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });
  
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    }
  });

  if (!res.ok) throw new Error(`Supabase Error: ${res.status}`);
  return await res.json();
};

// ============================================================================
// 🎨 BRUTALIST UI COMPONENTS
// ============================================================================
const BrutalistCard = ({ children, className = "", color = "bg-white" }) => (
  <div className={`border-2 border-black p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-none ${color} ${className}`}>
    {children}
  </div>
);

const BrutalistButton = ({ children, onClick, className = "", variant = "primary", disabled = false, title }) => {
  const baseStyle = "border-2 border-black px-4 py-2 font-bold uppercase tracking-tight transition-all duration-75 rounded-none disabled:opacity-50 flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-black text-white hover:bg-white hover:text-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]",
    secondary: "bg-white text-black hover:bg-[#FFD166] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-none",
    danger: "bg-[#D90429] text-white hover:bg-white hover:text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]",
    accent: "bg-[#06D6A0] text-black hover:bg-white hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant]} ${className}`} title={title}>
      {children}
    </button>
  );
};

const CompareRow = ({ label, homeVal, awayVal, highlight = false }) => (
  <div className={`flex items-center justify-between border-b-2 border-dashed border-gray-300 last:border-0 py-2.5 ${highlight ? 'bg-[#FFD166] -mx-4 px-4 border-solid border-black border-y-2' : ''}`}>
    <div className="w-1/3 text-left font-black text-lg text-[#0077B6]">{homeVal}</div>
    <div className="w-1/3 text-center text-[10px] sm:text-[11px] font-black uppercase text-gray-500 tracking-widest leading-tight">{label}</div>
    <div className="w-1/3 text-right font-black text-lg text-[#D90429]">{awayVal}</div>
  </div>
);

// ============================================================================
// 🖌️ SHARED PITCH DRAWING UTILITY
// ============================================================================
const drawPitchMarkings = (ctx, w, h, isFutsal) => {
  const pad = 30;
  const cfg = isFutsal ? PITCH_CONFIG.futsal : PITCH_CONFIG.football;
  const pW = cfg.width;
  const pH = cfg.height;
  const drawW = w - pad * 2;
  const drawH = h - pad * 2;
  const scaleX = x => pad + (x / pW) * drawW;
  const scaleY = y => h - (pad + (y / pH) * drawH);

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(pad, pad, drawW, drawH);
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 3;
  ctx.strokeRect(pad, pad, drawW, drawH);

  // Half line
  ctx.beginPath();
  ctx.moveTo(scaleX(pW / 2), scaleY(0));
  ctx.lineTo(scaleX(pW / 2), scaleY(pH));
  ctx.stroke();

  // Center circle
  ctx.beginPath();
  ctx.arc(scaleX(pW / 2), scaleY(pH / 2), (cfg.centerCircleRadius / pW) * drawW, 0, Math.PI * 2);
  ctx.stroke();

  // Center spot
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(scaleX(pW / 2), scaleY(pH / 2), 3, 0, Math.PI * 2);
  ctx.fill();

  if (isFutsal) {
    // D-shaped penalty areas
    const dRadius = (cfg.penaltyAreaRadius / pW) * drawW;
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(scaleX(0), scaleY(pH / 2), dRadius, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(scaleX(pW), scaleY(pH / 2), dRadius, Math.PI / 2, -Math.PI / 2);
    ctx.stroke();

    // Penalty spots
    ctx.fillStyle = "#000";
    [cfg.penaltySpot1, cfg.penaltySpot2, pW - cfg.penaltySpot2, pW - cfg.penaltySpot1].forEach(x => {
      ctx.beginPath();
      ctx.arc(scaleX(x), scaleY(pH / 2), 3, 0, Math.PI * 2);
      ctx.fill();
    });
  } else {
    // Football penalty areas
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;

    // Left penalty area
    const lpX = scaleX(0);
    const lpY = scaleY(cfg.penaltyAreaYMax);
    const lpW2 = (cfg.penaltyAreaX / pW) * drawW;
    const lpH2 = ((cfg.penaltyAreaYMax - cfg.penaltyAreaYMin) / pH) * drawH;
    ctx.strokeRect(lpX, lpY, lpW2, lpH2);

    // Right penalty area
    const rpX = scaleX(pW - cfg.penaltyAreaX);
    ctx.strokeRect(rpX, lpY, lpW2, lpH2);

    // Left goal area
    const lgY = scaleY(cfg.goalAreaYMax);
    const lgW2 = (cfg.goalAreaX / pW) * drawW;
    const lgH2 = ((cfg.goalAreaYMax - cfg.goalAreaYMin) / pH) * drawH;
    ctx.strokeRect(scaleX(0), lgY, lgW2, lgH2);

    // Right goal area
    ctx.strokeRect(scaleX(pW - cfg.goalAreaX), lgY, lgW2, lgH2);

    // Penalty spots
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(scaleX(cfg.penaltySpot1), scaleY(pH / 2), 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(scaleX(pW - cfg.penaltySpot1), scaleY(pH / 2), 3, 0, Math.PI * 2);
    ctx.fill();

    // Corner arcs
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1.5;
    const cornerR = (1 / pW) * drawW;
    [[0, 0, 0, Math.PI / 2], [pW, 0, Math.PI / 2, Math.PI], [pW, pH, Math.PI, 3 * Math.PI / 2], [0, pH, 3 * Math.PI / 2, 2 * Math.PI]].forEach(([cx, cy, s, e]) => {
      ctx.beginPath();
      ctx.arc(scaleX(cx), scaleY(cy), cornerR, s, e);
      ctx.stroke();
    });
  }

  // Goals
  ctx.strokeStyle = "#D90429";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(scaleX(0), scaleY(cfg.goalYMin));
  ctx.lineTo(scaleX(0), scaleY(cfg.goalYMax));
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(scaleX(pW), scaleY(cfg.goalYMin));
  ctx.lineTo(scaleX(pW), scaleY(cfg.goalYMax));
  ctx.stroke();
};

// ============================================================================
// 🗺️ EVENT SCATTER PITCH COMPONENT
// ============================================================================
const FutsalDistributionPitch = ({ filteredEvents, homeTeamId, lineups, isFutsal = true }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, transform: "", event: null });

  const cfg = isFutsal ? PITCH_CONFIG.futsal : PITCH_CONFIG.football;
  const pitchWidth = cfg.width;
  const pitchHeight = cfg.height;

  const drawPitch = (ctx, w, h) => {
    const pad = 30;
    const drawW = w - (pad * 2);
    const drawH = h - (pad * 2);
    const scaleX = (x) => pad + (x / pitchWidth) * drawW;
    const scaleY = (y) => h - (pad + (y / pitchHeight) * drawH);

    drawPitchMarkings(ctx, w, h, isFutsal);

    filteredEvents.forEach(e => {
      const color = e.team_id === homeTeamId ? '#0077B6' : '#D90429';
      const isHovered = tooltip.event && tooltip.event.processed_event_id === e.processed_event_id;
      
      ctx.fillStyle = color;
      ctx.globalAlpha = isHovered ? 1.0 : 0.6;
      ctx.beginPath();
      ctx.arc(scaleX(e.start_x), scaleY(e.start_y), isHovered ? 8 : 5, 0, Math.PI * 2);
      ctx.fill();
      
      if (isHovered) {
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      if (e.end_x !== null && e.end_y !== null) {
        ctx.strokeStyle = color;
        ctx.lineWidth = isHovered ? 3 : 1.5;
        ctx.beginPath();
        ctx.moveTo(scaleX(e.start_x), scaleY(e.start_y));
        ctx.lineTo(scaleX(e.end_x), scaleY(e.end_y));
        ctx.stroke();
        
        const angle = Math.atan2(scaleY(e.end_y) - scaleY(e.start_y), scaleX(e.end_x) - scaleX(e.start_x));
        ctx.beginPath();
        ctx.moveTo(scaleX(e.end_x), scaleY(e.end_y));
        ctx.lineTo(scaleX(e.end_x) - 10 * Math.cos(angle - Math.PI/6), scaleY(e.end_y) - 10 * Math.sin(angle - Math.PI/6));
        ctx.moveTo(scaleX(e.end_x), scaleY(e.end_y));
        ctx.lineTo(scaleX(e.end_x) - 10 * Math.cos(angle + Math.PI/6), scaleY(e.end_y) - 10 * Math.sin(angle + Math.PI/6));
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;
    });
  };

  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current || !containerRef.current) return;
      const canvas = canvasRef.current;
      const container = containerRef.current;
      canvas.width = container.clientWidth;
      canvas.height = container.clientWidth * cfg.aspectRatio;
      const ctx = canvas.getContext('2d');
      drawPitch(ctx, canvas.width, canvas.height);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [filteredEvents, tooltip.event]); 

  const handleMouseMove = (e) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
    const pad = 30;
    const drawW = canvas.width - (pad * 2);
    const drawH = canvas.height - (pad * 2);
    const scaleX = (x) => pad + (x / pitchWidth) * drawW;
    const scaleY = (y) => canvas.height - (pad + (y / pitchHeight) * drawH);
    let closestEvent = null;
    let minDistance = 15; 
    filteredEvents.forEach(ev => {
      if (ev.start_x === null || ev.start_y === null) return;
      const evX = scaleX(ev.start_x);
      const evY = scaleY(ev.start_y);
      const dist = Math.sqrt(Math.pow(mouseX - evX, 2) + Math.pow(mouseY - evY, 2));
      if (dist < minDistance) { minDistance = dist; closestEvent = ev; }
    });
    if (closestEvent) {
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      let tX = cursorX, tY = cursorY - 15;
      let transform = "transform -translate-x-1/2 -translate-y-full";
      if (cursorY < 120) { tY = cursorY + 20; transform = "transform -translate-x-1/2"; }
      if (cursorX < 110) { transform = transform.replace("-translate-x-1/2", "translate-x-0"); tX = cursorX + 15; }
      else if (cursorX > rect.width - 110) { transform = transform.replace("-translate-x-1/2", "-translate-x-full"); tX = cursorX - 15; }
      setTooltip({ visible: true, x: tX, y: tY, transform, event: closestEvent });
    } else {
      setTooltip({ visible: false, x: 0, y: 0, transform: "", event: null });
    }
  };

  const formatTime = (secs) => { if (!secs) return "0:00"; const m = Math.floor(secs / 60); const s = secs % 60; return `${m}:${s.toString().padStart(2, '0')}`; };
  const getPlayerDisplay = (playerId) => { if (!playerId) return "N/A"; const p = lineups.find(l => l.player_id === playerId); return p ? `#${p.jersey_no || '-'} ${p.players?.player_name}` : "Unknown"; };

  return (
    <div ref={containerRef} className="w-full border-4 border-black bg-white relative cursor-crosshair mb-4">
      <div className="absolute top-2 left-2 bg-white border-2 border-black px-2 py-1 text-[10px] font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] z-10 flex items-center gap-1">
        <MapIcon size={12}/> Scatter Telemetry
      </div>
      <canvas ref={canvasRef} className="w-full block" onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip({ visible: false, x: 0, y: 0, transform: "", event: null })} />
      {tooltip.visible && tooltip.event && (
        <div className={`absolute z-20 bg-[#FFD166] border-2 border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] pointer-events-none min-w-[200px] transition-all duration-75 ${tooltip.transform}`} style={{ left: tooltip.x, top: tooltip.y }}>
          <div className="text-sm font-black uppercase border-b-2 border-black pb-1 mb-2 flex justify-between items-center">
            <span>{tooltip.event.action}</span>
            <span className="bg-black text-white px-1 text-xs">{formatTime(tooltip.event.match_time_seconds)}</span>
          </div>
          <div className="space-y-1 text-xs font-bold leading-tight">
            <p><span className="text-gray-600">PLAYER:</span> {getPlayerDisplay(tooltip.event.player_id)}</p>
            <p><span className="text-gray-600">OUTCOME:</span> {tooltip.event.outcome}</p>
            {tooltip.event.type && tooltip.event.type !== "NA" && <p><span className="text-gray-600">TYPE:</span> {tooltip.event.type}</p>}
            {tooltip.event.reaction_player_id && (
              <p className="mt-2 pt-1 border-t border-dashed border-black">
                <span className="text-gray-600">REACTION:</span> {getPlayerDisplay(tooltip.event.reaction_player_id)}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 📍 AVERAGE POSITIONS PITCH COMPONENT
// ============================================================================
const AveragePositionsPitch = ({ data, teamName, isHome, lineups, isFutsal = true }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, transform: "", playerInfo: null });

  const cfg = isFutsal ? PITCH_CONFIG.futsal : PITCH_CONFIG.football;
  const pitchWidth = cfg.width;
  const pitchHeight = cfg.height;

  const drawPitch = (ctx, w, h) => {
    const pad = 30;
    const drawW = w - (pad * 2);
    const drawH = h - (pad * 2);
    const scaleX = (x) => pad + (x / pitchWidth) * drawW;
    const scaleY = (y) => h - (pad + (y / pitchHeight) * drawH);

    drawPitchMarkings(ctx, w, h, isFutsal);

    const primaryColor = isHome ? '#0077B6' : '#D90429';
    data.forEach(p => {
      const pX = scaleX(p.avgX);
      const pY = scaleY(p.avgY);
      const isHovered = tooltip.playerInfo && tooltip.playerInfo.playerId === p.playerId;
      ctx.beginPath();
      ctx.arc(pX, pY, isHovered ? 14 : 12, 0, Math.PI * 2);
      ctx.fillStyle = primaryColor;
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.stroke();
      const lineupItem = lineups.find(l => l.player_id === p.playerId);
      const jerseyNo = lineupItem?.jersey_no || '?';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(jerseyNo, pX, pY + 1);
    });
  };

  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current || !containerRef.current) return;
      const canvas = canvasRef.current;
      const container = containerRef.current;
      canvas.width = container.clientWidth;
      canvas.height = container.clientWidth * (cfg.aspectRatio + 0.05);
      const ctx = canvas.getContext('2d');
      drawPitch(ctx, canvas.width, canvas.height);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [data, tooltip.playerInfo]);

  const handleMouseMove = (e) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
    const pad = 30;
    const drawW = canvas.width - (pad * 2);
    const drawH = canvas.height - (pad * 2);
    const scaleX = (x) => pad + (x / pitchWidth) * drawW;
    const scaleY = (y) => canvas.height - (pad + (y / pitchHeight) * drawH);
    let hoveredPlayer = null;
    data.forEach(p => {
      const evX = scaleX(p.avgX);
      const evY = scaleY(p.avgY);
      const dist = Math.sqrt(Math.pow(mouseX - evX, 2) + Math.pow(mouseY - evY, 2));
      if (dist < 14) hoveredPlayer = p;
    });
    if (hoveredPlayer) {
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      let tX = cursorX, tY = cursorY - 15;
      let transform = "transform -translate-x-1/2 -translate-y-full";
      if (cursorY < 120) { tY = cursorY + 20; transform = "transform -translate-x-1/2"; }
      if (cursorX < 110) { transform = transform.replace("-translate-x-1/2", "translate-x-0"); tX = cursorX + 15; }
      else if (cursorX > rect.width - 110) { transform = transform.replace("-translate-x-1/2", "-translate-x-full"); tX = cursorX - 15; }
      setTooltip({ visible: true, x: tX, y: tY, transform, playerInfo: hoveredPlayer });
    } else {
      setTooltip({ visible: false, x: 0, y: 0, transform: "", playerInfo: null });
    }
  };

  const getPlayerName = (pid) => { const l = lineups.find(x => x.player_id === pid); return l ? l.players?.player_name : "Unknown"; };

  return (
    <div ref={containerRef} className="flex-1 min-w-[300px] border-4 border-black bg-white relative cursor-crosshair">
      <div className={`absolute top-2 left-2 ${isHome ? 'bg-[#0077B6]' : 'bg-[#D90429]'} text-white border-2 border-black px-2 py-1 text-[10px] font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] z-10 flex items-center gap-1`}>
        {teamName}
      </div>
      <canvas ref={canvasRef} className="w-full block" onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip({ visible: false, x: 0, y: 0, transform: "", playerInfo: null })} />
      {tooltip.visible && tooltip.playerInfo && (
        <div className={`absolute z-50 bg-[#FFD166] border-2 border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] pointer-events-none min-w-[180px] transition-all duration-75 ${tooltip.transform}`} style={{ left: tooltip.x, top: tooltip.y }}>
          <div className="text-sm font-black uppercase border-b-2 border-black pb-1 mb-2">
            #{lineups.find(l => l.player_id === tooltip.playerInfo.playerId)?.jersey_no} {getPlayerName(tooltip.playerInfo.playerId)}
          </div>
          <div className="space-y-1 text-xs font-bold leading-tight">
            <p><span className="text-gray-600">Events Recorded:</span> {tooltip.playerInfo.count}</p>
            <p><span className="text-gray-600">Avg X:</span> {tooltip.playerInfo.avgX.toFixed(1)}m</p>
            <p><span className="text-gray-600">Avg Y:</span> {tooltip.playerInfo.avgY.toFixed(1)}m</p>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 🎯 SHOT MAP (xG) PITCH COMPONENT
// ============================================================================
const ShotMapPitch = ({ shots, teamName, isHome, lineups, isFutsal = true }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, transform: "", shot: null });

  const cfg = isFutsal ? PITCH_CONFIG.futsal : PITCH_CONFIG.football;
  const pitchWidth = cfg.width;
  const pitchHeight = cfg.height;

  const getRadiusForXg = (xgValue) => { const val = parseFloat(xgValue) || 0.05; return 4 + (val * 14); };

  const drawPitch = (ctx, w, h) => {
    const pad = 30;
    const drawW = w - (pad * 2);
    const drawH = h - (pad * 2);
    const scaleX = (x) => pad + (x / pitchWidth) * drawW;
    const scaleY = (y) => h - (pad + (y / pitchHeight) * drawH);

    drawPitchMarkings(ctx, w, h, isFutsal);

    const primaryColor = isHome ? '#0077B6' : '#D90429';
    const sortedShots = [...shots].sort((a, b) => (parseFloat(b.xg) || 0) - (parseFloat(a.xg) || 0));
    sortedShots.forEach(s => {
      if (s.start_x === null || s.start_y === null) return;
      const pX = scaleX(s.start_x);
      const pY = scaleY(s.start_y);
      const radius = getRadiusForXg(s.xg);
      const isHovered = tooltip.shot && tooltip.shot.processed_event_id === s.processed_event_id;
      const isGoal = s.outcome === 'Goal';
      ctx.beginPath();
      ctx.arc(pX, pY, isHovered ? radius + 2 : radius, 0, Math.PI * 2);
      if (isGoal) {
        ctx.fillStyle = primaryColor; ctx.fill();
        ctx.strokeStyle = '#000000'; ctx.lineWidth = isHovered ? 3 : 2; ctx.stroke();
      } else {
        ctx.fillStyle = `${primaryColor}66`; ctx.fill();
        ctx.strokeStyle = primaryColor; ctx.lineWidth = isHovered ? 2.5 : 1.5; ctx.stroke();
      }
    });
  };

  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current || !containerRef.current) return;
      const canvas = canvasRef.current;
      const container = containerRef.current;
      canvas.width = container.clientWidth;
      canvas.height = container.clientWidth * (cfg.aspectRatio + 0.05);
      const ctx = canvas.getContext('2d');
      drawPitch(ctx, canvas.width, canvas.height);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [shots, tooltip.shot]);

  const handleMouseMove = (e) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
    const pad = 30;
    const drawW = canvas.width - (pad * 2);
    const drawH = canvas.height - (pad * 2);
    const scaleX = (x) => pad + (x / pitchWidth) * drawW;
    const scaleY = (y) => canvas.height - (pad + (y / pitchHeight) * drawH);
    let hoveredShot = null;
    const sortedShots = [...shots].sort((a, b) => (parseFloat(a.xg) || 0) - (parseFloat(b.xg) || 0));
    for (let s of sortedShots) {
      if (s.start_x === null || s.start_y === null) continue;
      const evX = scaleX(s.start_x);
      const evY = scaleY(s.start_y);
      const radius = getRadiusForXg(s.xg);
      const dist = Math.sqrt(Math.pow(mouseX - evX, 2) + Math.pow(mouseY - evY, 2));
      if (dist <= radius + 2) { hoveredShot = s; break; }
    }
    if (hoveredShot) {
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      let tX = cursorX, tY = cursorY - 15;
      let transform = "transform -translate-x-1/2 -translate-y-full";
      if (cursorY < 120) { tY = cursorY + 20; transform = "transform -translate-x-1/2"; }
      if (cursorX < 110) { transform = transform.replace("-translate-x-1/2", "translate-x-0"); tX = cursorX + 15; }
      else if (cursorX > rect.width - 110) { transform = transform.replace("-translate-x-1/2", "-translate-x-full"); tX = cursorX - 15; }
      setTooltip({ visible: true, x: tX, y: tY, transform, shot: hoveredShot });
    } else {
      setTooltip({ visible: false, x: 0, y: 0, transform: "", shot: null });
    }
  };

  const getPlayerName = (pid) => { const l = lineups.find(x => x.player_id === pid); return l ? l.players?.player_name : "Unknown"; };

  return (
    <div ref={containerRef} className="flex-1 min-w-[300px] border-4 border-black bg-white relative cursor-crosshair">
      <div className={`absolute top-2 left-2 ${isHome ? 'bg-[#0077B6]' : 'bg-[#D90429]'} text-white border-2 border-black px-2 py-1 text-[10px] font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] z-10 flex flex-col`}>
        <span>{teamName}</span>
      </div>
      <canvas ref={canvasRef} className="w-full block" onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip({ visible: false, x: 0, y: 0, transform: "", shot: null })} />
      {tooltip.visible && tooltip.shot && (
        <div className={`absolute z-50 bg-[#FFD166] border-2 border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] pointer-events-none min-w-[180px] transition-all duration-75 ${tooltip.transform}`} style={{ left: tooltip.x, top: tooltip.y }}>
          <div className="text-sm font-black uppercase border-b-2 border-black pb-1 mb-2">
            #{lineups.find(l => l.player_id === tooltip.shot.player_id)?.jersey_no || '-'} {getPlayerName(tooltip.shot.player_id)}
          </div>
          <div className="space-y-1 text-xs font-bold leading-tight">
            <p><span className="text-gray-600">xG Value:</span> {parseFloat(tooltip.shot.xg || 0).toFixed(2)}</p>
            <p><span className="text-gray-600">Outcome:</span> {tooltip.shot.outcome}</p>
            {tooltip.shot.type && tooltip.shot.type !== "NA" && <p><span className="text-gray-600">Type:</span> {tooltip.shot.type}</p>}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 🥅 SHOT PLACEMENT MAP (GOAL FACE) PITCH COMPONENT
// ============================================================================
const ShotPlacementPitch = ({ shots, teamName, isHome, lineups, isFutsal = true }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, transform: "", shot: null });

  const cfg = isFutsal ? PITCH_CONFIG.futsal : PITCH_CONFIG.football;
  const goalYMin = cfg.goalYMin;
  const goalYMax = cfg.goalYMax;
  const goalH = cfg.goalHeight;

  const getRadiusForXg = (xgValue) => { const val = parseFloat(xgValue) || 0.05; return 4 + (val * 14); };

  const drawPitch = (ctx, w, h) => {
    const pad = 30;
    const drawW = w - (pad * 2);
    const drawH = h - (pad * 2);
    const viewPadY = (goalYMax - goalYMin) * 1.5;
    const viewMinY = goalYMin - viewPadY;
    const viewMaxY = goalYMax + viewPadY;
    const viewRangeY = viewMaxY - viewMinY;
    const viewMinZ = -0.5;
    const viewMaxZ = goalH + 1.5;
    const viewRangeZ = viewMaxZ - viewMinZ;
    const scaleY = (y) => pad + ((y - viewMinY) / viewRangeY) * drawW;
    const scaleZ = (z) => pad + drawH - ((z - viewMinZ) / viewRangeZ) * drawH;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(pad, pad, drawW, drawH);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 3;
    ctx.strokeRect(pad, pad, drawW, drawH);

    ctx.beginPath();
    ctx.moveTo(pad, scaleZ(0));
    ctx.lineTo(w - pad, scaleZ(0));
    ctx.strokeStyle = "#d1d5db";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.moveTo(scaleY(goalYMin), scaleZ(0));
    ctx.lineTo(scaleY(goalYMin), scaleZ(goalH));
    ctx.lineTo(scaleY(goalYMax), scaleZ(goalH));
    ctx.lineTo(scaleY(goalYMax), scaleZ(0));
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    ctx.beginPath();
    const gridStep = (goalYMax - goalYMin) / 12;
    for(let i = goalYMin + gridStep; i < goalYMax; i += gridStep) {
        ctx.moveTo(scaleY(i), scaleZ(0));
        ctx.lineTo(scaleY(i), scaleZ(goalH));
    }
    const zStep = goalH / 8;
    for(let j = zStep; j < goalH; j += zStep) {
        ctx.moveTo(scaleY(goalYMin), scaleZ(j));
        ctx.lineTo(scaleY(goalYMax), scaleZ(j));
    }
    ctx.stroke();

    const primaryColor = isHome ? '#0077B6' : '#D90429';
    const sortedShots = [...shots].sort((a, b) => (parseFloat(b.xg) || 0) - (parseFloat(a.xg) || 0));
    sortedShots.forEach(s => {
      if (s.end_y === null || s.end_z === null) return;
      const pY = scaleY(s.end_y);
      const pZ = scaleZ(s.end_z);
      if (pY < pad - 10 || pY > w - pad + 10 || pZ < pad - 10 || pZ > h - pad + 10) return;
      const radius = getRadiusForXg(s.xg);
      const isHovered = tooltip.shot && tooltip.shot.processed_event_id === s.processed_event_id;
      const isGoal = s.outcome === 'Goal';
      ctx.beginPath();
      ctx.arc(pY, pZ, isHovered ? radius + 2 : radius, 0, Math.PI * 2);
      if (isGoal) {
        ctx.fillStyle = primaryColor; ctx.fill();
        ctx.strokeStyle = '#000000'; ctx.lineWidth = isHovered ? 3 : 2; ctx.stroke();
      } else {
        ctx.fillStyle = `${primaryColor}66`; ctx.fill();
        ctx.strokeStyle = primaryColor; ctx.lineWidth = isHovered ? 2.5 : 1.5; ctx.stroke();
      }
    });
  };

  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current || !containerRef.current) return;
      const canvas = canvasRef.current;
      const container = containerRef.current;
      canvas.width = container.clientWidth;
      canvas.height = container.clientWidth * 0.4;
      const ctx = canvas.getContext('2d');
      drawPitch(ctx, canvas.width, canvas.height);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [shots, tooltip.shot]);

  const handleMouseMove = (e) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
    const pad = 30;
    const drawW = canvas.width - (pad * 2);
    const drawH = canvas.height - (pad * 2);
    const viewPadY = (goalYMax - goalYMin) * 1.5;
    const viewMinY = goalYMin - viewPadY;
    const viewMaxY = goalYMax + viewPadY;
    const viewRangeY = viewMaxY - viewMinY;
    const viewMinZ = -0.5;
    const viewMaxZ = goalH + 1.5;
    const viewRangeZ = viewMaxZ - viewMinZ;
    const scaleY = (y) => pad + ((y - viewMinY) / viewRangeY) * drawW;
    const scaleZ = (z) => pad + drawH - ((z - viewMinZ) / viewRangeZ) * drawH;
    let hoveredShot = null;
    const sortedShots = [...shots].sort((a, b) => (parseFloat(a.xg) || 0) - (parseFloat(b.xg) || 0));
    for (let s of sortedShots) {
      if (s.end_y === null || s.end_z === null) continue;
      const evY = scaleY(s.end_y);
      const evZ = scaleZ(s.end_z);
      const radius = getRadiusForXg(s.xg);
      const dist = Math.sqrt(Math.pow(mouseX - evY, 2) + Math.pow(mouseY - evZ, 2));
      if (dist <= radius + 2) { hoveredShot = s; break; }
    }
    if (hoveredShot) {
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      let tX = cursorX, tY = cursorY - 15;
      let transform = "transform -translate-x-1/2 -translate-y-full";
      if (cursorY < 120) { tY = cursorY + 20; transform = "transform -translate-x-1/2"; }
      if (cursorX < 110) { transform = transform.replace("-translate-x-1/2", "translate-x-0"); tX = cursorX + 15; }
      else if (cursorX > rect.width - 110) { transform = transform.replace("-translate-x-1/2", "-translate-x-full"); tX = cursorX - 15; }
      setTooltip({ visible: true, x: tX, y: tY, transform, shot: hoveredShot });
    } else {
      setTooltip({ visible: false, x: 0, y: 0, transform: "", shot: null });
    }
  };

  const getPlayerName = (pid) => { const l = lineups.find(x => x.player_id === pid); return l ? l.players?.player_name : "Unknown"; };

  return (
    <div ref={containerRef} className="flex-1 min-w-[300px] border-4 border-black bg-white relative cursor-crosshair">
      <div className={`absolute top-2 left-2 ${isHome ? 'bg-[#0077B6]' : 'bg-[#D90429]'} text-white border-2 border-black px-2 py-1 text-[10px] font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] z-10 flex flex-col`}>
        <span>{teamName}</span>
      </div>
      <canvas ref={canvasRef} className="w-full block" onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip({ visible: false, x: 0, y: 0, transform: "", shot: null })} />
      {tooltip.visible && tooltip.shot && (
        <div className={`absolute z-50 bg-[#FFD166] border-2 border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] pointer-events-none min-w-[180px] transition-all duration-75 ${tooltip.transform}`} style={{ left: tooltip.x, top: tooltip.y }}>
          <div className="text-sm font-black uppercase border-b-2 border-black pb-1 mb-2">
            #{lineups.find(l => l.player_id === tooltip.shot.player_id)?.jersey_no || '-'} {getPlayerName(tooltip.shot.player_id)}
          </div>
          <div className="space-y-1 text-xs font-bold leading-tight">
            <p><span className="text-gray-600">xG Value:</span> {parseFloat(tooltip.shot.xg || 0).toFixed(2)}</p>
            <p><span className="text-gray-600">Outcome:</span> {tooltip.shot.outcome}</p>
            {tooltip.shot.type && tooltip.shot.type !== "NA" && <p><span className="text-gray-600">Type:</span> {tooltip.shot.type}</p>}
            <p className="mt-2 pt-1 border-t border-dashed border-black">
              <span className="text-gray-600">Placement Height:</span> {parseFloat(tooltip.shot.end_z || 0).toFixed(2)}m
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 🧲 HEATMAP PITCH COMPONENT (KERNEL DENSITY)
// ============================================================================
const HeatmapPitch = ({ events, teamName, isHome, isFutsal = true }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const cfg = isFutsal ? PITCH_CONFIG.futsal : PITCH_CONFIG.football;
  const pitchWidth = cfg.width;
  const pitchHeight = cfg.height;

  const drawPitch = (ctx, w, h) => {
    drawPitchMarkings(ctx, w, h, isFutsal);

    const pad = 30;
    const drawW = w - (pad * 2);
    const scaleX = (x) => pad + (x / pitchWidth) * drawW;
    const scaleY = (y) => h - (pad + (y / pitchHeight) * (h - pad * 2));

    const primaryRGB = isHome ? '0, 119, 182' : '217, 4, 41';
    ctx.globalCompositeOperation = 'multiply';
    events.forEach(s => {
      if (s.start_x === null || s.start_y === null) return;
      const pX = scaleX(s.start_x);
      const pY = scaleY(s.start_y);
      const radius = (4 / pitchWidth) * drawW;
      const grad = ctx.createRadialGradient(pX, pY, 0, pX, pY, radius);
      grad.addColorStop(0, `rgba(${primaryRGB}, 0.35)`);
      grad.addColorStop(1, `rgba(${primaryRGB}, 0)`);
      ctx.beginPath();
      ctx.arc(pX, pY, radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    });
    ctx.globalCompositeOperation = 'source-over';
  };

  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current || !containerRef.current) return;
      const canvas = canvasRef.current;
      const container = containerRef.current;
      canvas.width = container.clientWidth;
      canvas.height = container.clientWidth * (cfg.aspectRatio + 0.05);
      const ctx = canvas.getContext('2d');
      drawPitch(ctx, canvas.width, canvas.height);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [events]);

  return (
    <div ref={containerRef} className="flex-1 min-w-[300px] border-4 border-black bg-white relative">
      <div className={`absolute top-2 left-2 ${isHome ? 'bg-[#0077B6]' : 'bg-[#D90429]'} text-white border-2 border-black px-2 py-1 text-[10px] font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] z-10 flex flex-col`}>
        <span>{teamName}</span>
      </div>
      <canvas ref={canvasRef} className="w-full block" />
    </div>
  );
};

// ============================================================================
// 🕸️ RADAR CHART COMPONENT
// ============================================================================
const RadarChart = ({ p1Data, p2Data, maxes }) => {
  const [tooltip, setTooltip] = useState(null);
  if (!p1Data || !p2Data) return null;
  const size = 300;
  const center = size / 2;
  const radius = size * 0.35;
  const metrics = [
      { key: 'passes', label: 'Passes' },
      { key: 'shots', label: 'Shots' },
      { key: 'xg', label: 'xG' },
      { key: 'carries', label: 'Carries' },
      { key: 'tackles', label: 'Tackles' },
      { key: 'interceptions', label: 'Pass Intercepts' }
  ];
  const getPoint = (val, max, idx) => {
      const angle = (Math.PI * 2 * idx) / metrics.length - Math.PI / 2;
      const r = max > 0 ? (val / max) * radius : 0;
      return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
  };
  const p1Points = metrics.map((m, i) => getPoint(p1Data.stats[m.key], maxes[m.key], i)).join(' ');
  const p2Points = metrics.map((m, i) => getPoint(p2Data.stats[m.key], maxes[m.key], i)).join(' ');
  const levels = [0.2, 0.4, 0.6, 0.8, 1];

  return (
      <div className="relative w-full h-full max-w-[400px] mx-auto font-mono">
        <svg viewBox={`-60 -60 ${size + 120} ${size + 120}`} className="w-full h-full overflow-visible">
            {levels.map((level, levelIdx) => (
                <polygon key={`level-${levelIdx}`} points={metrics.map((_, i) => getPoint(level, 1, i)).join(' ')} fill="none" stroke="#e5e7eb" strokeWidth="1" strokeDasharray={level < 1 ? "2,2" : ""} />
            ))}
            {metrics.map((_, i) => {
                const angle = (Math.PI * 2 * i) / metrics.length - Math.PI / 2;
                return <line key={`axis-${i}`} x1={center} y1={center} x2={center + radius * Math.cos(angle)} y2={center + radius * Math.sin(angle)} stroke="#e5e7eb" strokeWidth="1" />;
            })}
            {metrics.map((m, i) => {
                const angle = (Math.PI * 2 * i) / metrics.length - Math.PI / 2;
                const labelR = radius * 1.25;
                const x = center + labelR * Math.cos(angle);
                const y = center + labelR * Math.sin(angle);
                let anchor = "middle";
                if (Math.abs(Math.cos(angle)) > 0.1) anchor = Math.cos(angle) > 0 ? "start" : "end";
                return <text key={`label-${i}`} x={x} y={y} textAnchor={anchor} dominantBaseline="middle" fontSize="11" fontWeight="bold" fill="#374151" className="uppercase">{m.label}</text>;
            })}
            <polygon points={p1Points} fill="rgba(0, 119, 182, 0.25)" stroke="#0077B6" strokeWidth="2" />
            <polygon points={p2Points} fill="rgba(217, 4, 41, 0.25)" stroke="#D90429" strokeWidth="2" />
            {metrics.map((m, i) => {
                const pt = getPoint(p1Data.stats[m.key], maxes[m.key], i).split(',');
                return <circle key={`p1-pt-${i}`} cx={pt[0]} cy={pt[1]} r="5" fill="#0077B6" className="cursor-crosshair" onMouseEnter={() => setTooltip({ player: p1Data.info.players?.player_name, val: p1Data.stats[m.key], max: maxes[m.key], metric: m.label, color: '#0077B6' })} onMouseLeave={() => setTooltip(null)} />;
            })}
            {metrics.map((m, i) => {
                const pt = getPoint(p2Data.stats[m.key], maxes[m.key], i).split(',');
                return <circle key={`p2-pt-${i}`} cx={pt[0]} cy={pt[1]} r="5" fill="#D90429" className="cursor-crosshair" onMouseEnter={() => setTooltip({ player: p2Data.info.players?.player_name, val: p2Data.stats[m.key], max: maxes[m.key], metric: m.label, color: '#D90429' })} onMouseLeave={() => setTooltip(null)} />;
            })}
        </svg>
        {tooltip && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-4 bg-white border-2 border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-20 whitespace-nowrap pointer-events-none">
            <div className="text-[10px] font-black uppercase text-gray-500 border-b-2 border-black pb-1 mb-2">{tooltip.metric} Overview</div>
            <div className="text-sm font-bold flex flex-col gap-1">
              <span className="uppercase" style={{ color: tooltip.color }}>{tooltip.player}</span>
              <div className="text-black">Player Value: <span className="font-black text-lg">{tooltip.val}</span><span className="text-[10px] text-gray-500 ml-2">(Match Max: {tooltip.max})</span></div>
            </div>
          </div>
        )}
      </div>
  );
};

// ============================================================================
// 🏆 FLIPPING LEADER CARD COMPONENT
// ============================================================================
const LeaderCard = ({ leader }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  if (!leader || !leader.topList || leader.topList.length === 0) return null;
  const topPlayer = leader.topList[0];
  const runnerUps = leader.topList.slice(1);

  return (
    <div className="relative w-full h-[150px] cursor-pointer perspective-1000 group" onClick={() => setIsFlipped(!isFlipped)}>
      <div className={`w-full h-full relative preserve-3d transition-transform duration-500 ${isFlipped ? 'rotate-y-180' : 'group-hover:-translate-y-1'}`}>
        <div className={`absolute inset-0 backface-hidden border-2 border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white flex flex-col justify-between ${topPlayer.isHome ? 'border-t-8 border-t-[#0077B6]' : 'border-t-8 border-t-[#D90429]'}`}>
          <div className="mb-2">
            <div className="flex justify-between items-start mb-1">
               <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-tight">{leader.action}</div>
               <div className="text-[8px] uppercase font-bold text-gray-400 bg-gray-100 px-1 border border-gray-300">Tap to Flip</div>
            </div>
            <div className="text-4xl font-black leading-none">{topPlayer.count}</div>
          </div>
          <div className="pt-2 border-t border-dashed border-gray-200">
            <div className="text-xs font-bold uppercase truncate" title={topPlayer.playerName}>#{topPlayer.jerseyNo} {topPlayer.playerName}</div>
            <div className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${topPlayer.isHome ? 'text-[#0077B6]' : 'text-[#D90429]'}`}>{topPlayer.teamName}</div>
          </div>
        </div>
        <div className="absolute inset-0 backface-hidden rotate-y-180 border-2 border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-[#FFD166] flex flex-col">
           <div className="text-[10px] font-black text-black uppercase tracking-widest leading-tight border-b-2 border-black pb-1 mb-2 flex justify-between items-center">
              <span>{leader.action} Runners-up</span>
              <span className="text-[10px]">🔙</span>
           </div>
           <div className="flex-1 overflow-y-auto no-scrollbar space-y-1.5 mt-1">
             {runnerUps.length > 0 ? runnerUps.map((p, i) => (
               <div key={i} className="flex items-center justify-between text-[11px] leading-tight bg-white/60 p-1 border border-black/20">
                 <div className="font-bold uppercase truncate pr-2" title={p.playerName}>
                    <span className={p.isHome ? "text-[#0077B6]" : "text-[#D90429]"}>#{p.jerseyNo}</span> {p.playerName}
                 </div>
                 <div className="font-black shrink-0">{p.count}</div>
               </div>
             )) : (
               <div className="text-[10px] text-black font-bold uppercase mt-2 opacity-50">No other players</div>
             )}
           </div>
        </div>
      </div>
    </div>
  );
};


// ============================================================================
// 🚀 SCREENS
// ============================================================================

const BootScreen = ({ onComplete }) => {
  const [text, setText] = useState("");
  const fullText = "> INITIATING CAC ANALYTICS CORE...\n> LOADING TOURNAMENT CONFIG...\n> CONNECTING TO MATCH DATA PIPELINE...\n> MAPPING PITCH COORDINATES...\n> READY.";

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setText(fullText.slice(0, i));
      i++;
      if (i > fullText.length) { clearInterval(interval); setTimeout(onComplete, 800); }
    }, 30);
    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div className="min-h-screen bg-black text-[#06D6A0] font-mono p-10 flex flex-col justify-end text-xl">
      <pre className="whitespace-pre-wrap">{text}</pre>
      <span className="animate-pulse mt-2 block w-4 h-6 bg-[#06D6A0]"></span>
    </div>
  );
};

// ============================================================================
// 🏟️ SELECTION SCREEN
// ============================================================================
const SelectionScreen = ({ onSelectMatch }) => {
  const [matches, setMatches] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tournamentFilter, setTournamentFilter] = useState('ALL');
  const [sportFilter, setSportFilter] = useState('ALL');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [matchesData, tournamentsData, goalEvents, allLineups] = await Promise.all([
          fetchSupabase('matches', {
            select: 'match_id,home_team_id,away_team_id,match_date,match_name,status,is_futsal,video_url,tournament_name,tournament_id,home_team:teams!matches_home_team_id_fkey(team_name),away_team:teams!matches_away_team_id_fkey(team_name)',
            status: 'eq.Done',
            order: 'match_date.desc'
          }),
          fetchSupabase('tournaments', {
            select: 'tournament_id,tournament_name',
            order: 'tournament_name.asc'
          }),
          fetchSupabase('processed_match_events', {
            select: 'match_id,player_id,action,outcome,type',
            or: '(and(action.eq.Shoot,outcome.eq.Goal),and(outcome.eq.Unsuccessful,type.eq.Own Goal))'
          }),
          fetchSupabase('lineups', {
            select: 'match_id,player_id,team_id'
          })
        ]);

        // Compute scores for each match
        const enrichedMatches = (matchesData || []).map(m => {
          const mGoals = (goalEvents || []).filter(g => g.match_id === m.match_id);
          const mLineups = (allLineups || []).filter(l => l.match_id === m.match_id);

          let homeScore = 0;
          let awayScore = 0;

          mGoals.forEach(g => {
            const lineup = mLineups.find(l => l.player_id === g.player_id);
            const playerTeamId = lineup?.team_id;

            if (g.action === 'Shoot' && g.outcome === 'Goal') {
              // Regular goal
              if (playerTeamId === m.home_team_id) homeScore++;
              else if (playerTeamId === m.away_team_id) awayScore++;
            } else if (g.outcome === 'Unsuccessful' && g.type === 'Own Goal') {
              // Own goal — counts for the OTHER team
              if (playerTeamId === m.home_team_id) awayScore++;
              else if (playerTeamId === m.away_team_id) homeScore++;
            }
          });

          return { ...m, home_score: homeScore, away_score: awayScore };
        });

        setMatches(enrichedMatches);
        setTournaments(tournamentsData || []);
      } catch (err) {
        console.error("Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredMatches = useMemo(() => {
    let result = matches;
    if (tournamentFilter !== 'ALL') {
      result = result.filter(m => m.tournament_id === tournamentFilter);
    }
    if (sportFilter !== 'ALL') {
      const isFutsal = sportFilter === 'FUTSAL';
      result = result.filter(m => m.is_futsal === isFutsal);
    }
    return result;
  }, [matches, tournamentFilter, sportFilter]);

  return (
    <div className="min-h-screen bg-[#f8fafc] p-8 font-mono">
      <header className="border-b-4 border-black pb-4 mb-8">
        <h1 className="text-4xl font-black uppercase tracking-tighter flex items-center gap-3">
          <Terminal size={36} /> CAC ANALYTICS PORTAL
        </h1>
        
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-4 flex-wrap">
           <div className="flex items-center gap-2 text-gray-600 font-bold">
             <ChevronDown size={20} className="text-black" />
             <span>FILTER:</span>
           </div>
           <select 
             className="bg-white border-2 border-black p-2 font-black uppercase text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:outline-none cursor-pointer min-w-[240px]"
             value={tournamentFilter}
             onChange={(e) => setTournamentFilter(e.target.value)}
           >
             <option value="ALL">ALL TOURNAMENTS</option>
             {tournaments.map(t => (
               <option key={t.tournament_id} value={t.tournament_id}>{t.tournament_name}</option>
             ))}
           </select>
           <select 
             className="bg-white border-2 border-black p-2 font-black uppercase text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:outline-none cursor-pointer min-w-[160px]"
             value={sportFilter}
             onChange={(e) => setSportFilter(e.target.value)}
           >
             <option value="ALL">ALL SPORTS</option>
             <option value="FUTSAL">⚽ FUTSAL</option>
             <option value="FOOTBALL">🏟️ FOOTBALL</option>
           </select>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center gap-3 text-xl font-bold uppercase"><RefreshCw className="animate-spin" /> Fetching...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 max-w-7xl">
          {filteredMatches.length > 0 ? filteredMatches.map((m) => (
            <BrutalistCard key={m.match_id} className="flex flex-col hover:-translate-y-1 transition-all">
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-[#FFD166] border-2 border-black px-2 py-1 text-[10px] font-black uppercase inline-block">
                  {m.tournament_name || "MATCH_REPORT"}
                </div>
                <div className={`border-2 border-black px-2 py-1 text-[10px] font-black uppercase inline-block ${m.is_futsal ? 'bg-[#06D6A0]' : 'bg-[#0077B6] text-white'}`}>
                  {m.is_futsal ? '⚽ Futsal' : '🏟️ Football'}
                </div>
              </div>
              <h2 className="text-xl font-black uppercase mb-1">
                {m.home_team?.team_name} <span className="text-[#0077B6]">{m.home_score}</span> : <span className="text-[#D90429]">{m.away_score}</span> {m.away_team?.team_name}
              </h2>
              <p className="text-xs font-bold text-gray-400 mb-6">{m.match_date} • {m.match_name}</p>
              <BrutalistButton onClick={() => onSelectMatch(m)} variant="secondary" className="w-full sm:w-fit px-8">
                ANALYZE PERFORMANCE
              </BrutalistButton>
            </BrutalistCard>
          )) : (
            <div className="col-span-full py-10 border-4 border-dashed border-gray-200 text-center">
              <p className="text-gray-400 font-black uppercase">No matches found for this selection.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const TeamSheetSide = ({ teamName, roster, colorClass }) => (
  <BrutalistCard color="bg-white" className="flex flex-col h-full">
    <div className={`p-3 -m-4 mb-4 border-b-2 border-black flex items-center justify-between ${colorClass} text-white`}>
      <h4 className="text-xl font-black uppercase">{teamName}</h4>
      <ClipboardList size={20} />
    </div>
    <div className="space-y-6">
      <section>
        <div className="space-y-1.5">
          {roster.starters.map((p, idx) => (
            <div key={idx} className="flex items-center justify-between text-sm font-bold border-b border-gray-100 pb-1">
              <span className="flex items-center gap-3">
                <span className="w-5 h-5 flex items-center justify-center bg-black text-white text-[10px] leading-none">{p.jersey_no || '-'}</span>
                <span className="uppercase">{p.players?.player_name}</span>
              </span>
              <span className="text-[10px] font-black text-gray-400 uppercase w-8 text-right">{p.position || p.players?.position || 'POS'}</span>
            </div>
          ))}
        </div>
      </section>
      <section>
        <div className="space-y-1.5 opacity-80">
          {roster.subs.length > 0 ? roster.subs.map((p, idx) => (
            <div key={idx} className="flex items-center justify-between text-sm font-bold border-b border-gray-100 pb-1 italic">
              <span className="flex items-center gap-3">
                <span className="w-5 h-5 flex items-center justify-center border border-black text-black text-[10px] leading-none">{p.jersey_no || '-'}</span>
                <span className="uppercase">{p.players?.player_name}</span>
              </span>
              <span className="text-[10px] font-black text-gray-400 uppercase w-8 text-right">{p.position || p.players?.position || 'SUB'}</span>
            </div>
          )) : <div className="text-xs font-bold text-gray-300 uppercase">None Registered</div>}
        </div>
      </section>
    </div>
  </BrutalistCard>
);

// ============================================================================
// 📊 DASHBOARD SCREEN
// ============================================================================
const DashboardScreen = ({ match, onBack }) => {
  const [events, setEvents] = useState([]);
  const [lineups, setLineups] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('SUMMARY');

  // Determine sport type and pitch config
  const isFutsal = match.is_futsal !== false; // default true
  const cfg = isFutsal ? PITCH_CONFIG.futsal : PITCH_CONFIG.football;
  
  // Standard Scatter Distribution Filters
  const [distTeam, setDistTeam] = useState('ALL');
  const [distPlayer, setDistPlayer] = useState('ALL');
  const [distAction, setDistAction] = useState('ALL');
  const [distOutcome, setDistOutcome] = useState('ALL');
  const [distType, setDistType] = useState('ALL');
  const [minMinute, setMinMinute] = useState(0);
  const [maxMinute, setMaxMinute] = useState(isFutsal ? 40 : 90); 

  // --- AVERAGE POSITIONS STATE ---
  const [avgStatType, setAvgStatType] = useState('ALL_ACTIONS'); 
  const [avgMinMinute, setAvgMinMinute] = useState(0);
  const [avgMaxMinute, setAvgMaxMinute] = useState(isFutsal ? 40 : 90);
  const [avgHomePlayers, setAvgHomePlayers] = useState([]);
  const [avgAwayPlayers, setAvgAwayPlayers] = useState([]);

  // --- DEFENSE HEATMAP STATE ---
  const [defActionFilter, setDefActionFilter] = useState('ALL');
  const [defOutcomeFilter, setDefOutcomeFilter] = useState('ALL');
  const defActions = useMemo(() => ['Standing Tackle', 'Sliding Tackle', 'Block', 'Save', 'Pass Intercept'], []);
  
  const availableDefOutcomes = useMemo(() => {
    const outcomes = new Set();
    if (defActionFilter === 'ALL') {
      defActions.forEach(action => { if (CAC_LOGIC[action]) Object.keys(CAC_LOGIC[action]).forEach(o => outcomes.add(o)); });
    } else {
      if (CAC_LOGIC[defActionFilter]) Object.keys(CAC_LOGIC[defActionFilter]).forEach(o => outcomes.add(o));
    }
    return Array.from(outcomes).sort();
  }, [defActions, defActionFilter]);

  const handleDefActionChange = (e) => { setDefActionFilter(e.target.value); setDefOutcomeFilter('ALL'); };

  // --- PLAYER COMPARISON STATE ---
  const [p1TeamId, setP1TeamId] = useState(match.home_team_id);
  const [p1PlayerId, setP1PlayerId] = useState(null);
  const [p2TeamId, setP2TeamId] = useState(match.away_team_id);
  const [p2PlayerId, setP2PlayerId] = useState(null);

  // --- HIGHLIGHTS / VIDEO STATE ---
  const [hlTeam, setHlTeam] = useState('ALL');
  const [hlPlayer, setHlPlayer] = useState('ALL');
  const [hlAction, setHlAction] = useState('ALL');
  const [hlOutcome, setHlOutcome] = useState('ALL');
  const [hlType, setHlType] = useState('ALL');
  const [hlSeekTime, setHlSeekTime] = useState(0);
  const [hlForceRender, setHlForceRender] = useState(0);
  const videoRef = useRef(null);

  // --- PDF GENERATION STATE ---
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const tournamentName = match.tournament_name || "MATCH_REPORT";

  useEffect(() => {
    const fetchMatchData = async () => {
      try {
        const [eventsData, lineupsData] = await Promise.all([
          fetchSupabase('processed_match_events', { select: '*', match_id: `eq.${match.match_id}` }),
          fetchSupabase('lineups', { select: 'player_id,team_id,jersey_no,starting_xi,position,players(player_name,position)', match_id: `eq.${match.match_id}` })
        ]);
        setEvents(eventsData || []);
        
        const sortedLineups = (lineupsData || []).sort((a,b) => (a.jersey_no || 99) - (b.jersey_no || 99));
        setLineups(sortedLineups);

        const homeLineup = sortedLineups.filter(l => l.team_id === match.home_team_id);
        const awayLineup = sortedLineups.filter(l => l.team_id === match.away_team_id);
        
        setAvgHomePlayers(homeLineup.map(l => l.player_id));
        setAvgAwayPlayers(awayLineup.map(l => l.player_id));
        
        if (homeLineup.length > 0) setP1PlayerId(homeLineup[0].player_id);
        if (awayLineup.length > 0) setP2PlayerId(awayLineup[0].player_id);

        if (eventsData && eventsData.length > 0) {
            const maxSeconds = Math.max(...eventsData.map(e => e.match_time_seconds));
            const calculatedMaxMinute = Math.ceil(maxSeconds / 60);
            const defaultMax = isFutsal ? 40 : 90;
            setMaxMinute(calculatedMaxMinute > 0 ? calculatedMaxMinute : defaultMax);
            setAvgMaxMinute(calculatedMaxMinute > 0 ? calculatedMaxMinute : defaultMax);
        }
      } catch (err) {
        console.error("Data fetch failed", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMatchData();
  }, [match]);

  // --- ENRICHED EVENTS (add team_id + computed xg) ---
  const enrichedEvents = useMemo(() => {
    return events
      .filter(e => e.action !== 'Match Time') 
      .map(e => {
        const teamId = lineups.find(l => l.player_id === e.player_id)?.team_id;
        // Compute xG for shots
        let xg = 0;
        if (e.action === 'Shoot' && e.start_x !== null && e.start_y !== null) {
          xg = calculateXG(e.start_x, e.start_y, cfg.width, cfg.height);
        }
        return { ...e, team_id: teamId, xg };
      });
  }, [events, lineups, cfg]);

  const filterOptions = useMemo(() => {
    const homeLineup = lineups.filter(l => l.team_id === match.home_team_id);
    const awayLineup = lineups.filter(l => l.team_id === match.away_team_id);
    const activeActions = Array.from(new Set(enrichedEvents.map(e => e.action))).filter(Boolean).sort();
    let availableOutcomes = [];
    if (distAction === 'ALL') {
      availableOutcomes = Array.from(new Set(enrichedEvents.map(e => e.outcome))).filter(Boolean).sort();
    } else if (CAC_LOGIC[distAction]) {
      availableOutcomes = Object.keys(CAC_LOGIC[distAction]).sort();
    }
    let availableTypes = [];
    if (distAction === 'ALL' || distOutcome === 'ALL') {
      availableTypes = Array.from(new Set(enrichedEvents.map(e => e.type))).filter(t => t && t !== 'NA').sort();
    } else if (CAC_LOGIC[distAction] && CAC_LOGIC[distAction][distOutcome]) {
      availableTypes = CAC_LOGIC[distAction][distOutcome].filter(t => t !== 'NA').sort();
    }
    return { actions: activeActions, outcomes: availableOutcomes, types: availableTypes, homePlayers: homeLineup, awayPlayers: awayLineup };
  }, [enrichedEvents, lineups, match, distAction, distOutcome]);

  const filteredEvents = useMemo(() => {
    return enrichedEvents.filter(e => {
      const matchTeam = distTeam === 'ALL' || e.team_id === distTeam;
      const matchPlayer = distPlayer === 'ALL' || e.player_id === distPlayer;
      const matchAction = distAction === 'ALL' || e.action === distAction;
      const matchOutcome = distOutcome === 'ALL' || e.outcome === distOutcome;
      const matchType = distType === 'ALL' || e.type === distType;
      const eventMinute = Math.floor(e.match_time_seconds / 60);
      const matchTime = eventMinute >= minMinute && eventMinute <= maxMinute;
      return matchTeam && matchPlayer && matchAction && matchOutcome && matchType && matchTime && e.start_x !== null;
    });
  }, [enrichedEvents, distTeam, distPlayer, distAction, distOutcome, distType, minMinute, maxMinute]);

  // --- AVERAGE POSITIONS LOGIC ---
  const calculateAverageData = (teamId, selectedIds, statType = avgStatType, minMin = avgMinMinute, maxMin = avgMaxMinute) => {
    if (selectedIds.length === 0) return [];
    let validEvents = enrichedEvents.filter(e => {
      const eventMin = Math.floor(e.match_time_seconds / 60);
      return eventMin >= minMin && eventMin <= maxMin;
    });
    let playerStatsMap = {};
    validEvents.forEach(e => {
      let targetPlayerId = null;
      let x = null, y = null;
      if (statType === 'ALL_ACTIONS') { targetPlayerId = e.player_id; x = e.start_x; y = e.start_y; }
      else if (statType === 'PASS' && (e.action === 'Pass' || e.action === 'Through Ball')) { targetPlayerId = e.player_id; x = e.start_x; y = e.start_y; } 
      else if (statType === 'RECEIVE' && (e.action === 'Pass' || e.action === 'Through Ball')) {
        if (['Successful', 'Assist', 'Key Pass'].includes(e.outcome)) { targetPlayerId = e.reaction_player_id; x = e.end_x; y = e.end_y; }
      } 
      else if (statType === 'SHOT' && e.action === 'Shoot') { targetPlayerId = e.player_id; x = e.start_x; y = e.start_y; } 
      else if (statType === 'DEFENCE' && ['Pass Intercept', 'Standing Tackle', 'Sliding Tackle', 'Save', 'Block'].includes(e.action)) { targetPlayerId = e.player_id; x = e.start_x; y = e.start_y; }
      if (targetPlayerId && selectedIds.includes(targetPlayerId) && x !== null && y !== null) {
        const l = lineups.find(lx => lx.player_id === targetPlayerId);
        if (l && l.team_id === teamId) {
          if (!playerStatsMap[targetPlayerId]) playerStatsMap[targetPlayerId] = { sumX: 0, sumY: 0, count: 0 };
          playerStatsMap[targetPlayerId].sumX += x;
          playerStatsMap[targetPlayerId].sumY += y;
          playerStatsMap[targetPlayerId].count += 1;
        }
      }
    });
    return Object.keys(playerStatsMap).map(pid => ({
      playerId: pid,
      avgX: playerStatsMap[pid].sumX / playerStatsMap[pid].count,
      avgY: playerStatsMap[pid].sumY / playerStatsMap[pid].count,
      count: playerStatsMap[pid].count
    }));
  };

  const avgHomeData = useMemo(() => calculateAverageData(match.home_team_id, avgHomePlayers), [enrichedEvents, avgHomePlayers, avgStatType, avgMinMinute, avgMaxMinute]);
  const avgAwayData = useMemo(() => calculateAverageData(match.away_team_id, avgAwayPlayers), [enrichedEvents, avgAwayPlayers, avgStatType, avgMinMinute, avgMaxMinute]);

  // --- PDF SPECIFIC DATA MEMOS ---
  const allHomePlayerIds = filterOptions.homePlayers.map(p => p.player_id);
  const allAwayPlayerIds = filterOptions.awayPlayers.map(p => p.player_id);

  const pdfAvgPassHome = useMemo(() => calculateAverageData(match.home_team_id, allHomePlayerIds, 'PASS', 0, 400), [enrichedEvents]);
  const pdfAvgPassAway = useMemo(() => calculateAverageData(match.away_team_id, allAwayPlayerIds, 'PASS', 0, 400), [enrichedEvents]);
  const pdfAvgRecvHome = useMemo(() => calculateAverageData(match.home_team_id, allHomePlayerIds, 'RECEIVE', 0, 400), [enrichedEvents]);
  const pdfAvgRecvAway = useMemo(() => calculateAverageData(match.away_team_id, allAwayPlayerIds, 'RECEIVE', 0, 400), [enrichedEvents]);

  const homePasses = useMemo(() => enrichedEvents.filter(e => e.team_id === match.home_team_id && e.action === 'Pass' && e.start_x !== null), [enrichedEvents]);
  const awayPasses = useMemo(() => enrichedEvents.filter(e => e.team_id === match.away_team_id && e.action === 'Pass' && e.start_x !== null), [enrichedEvents]);
  
  const allHomeDefEvents = useMemo(() => enrichedEvents.filter(e => e.team_id === match.home_team_id && defActions.includes(e.action)), [enrichedEvents, defActions]);
  const allAwayDefEvents = useMemo(() => enrichedEvents.filter(e => e.team_id === match.away_team_id && defActions.includes(e.action)), [enrichedEvents, defActions]);

  // --- DYNAMIC SCATTER INSIGHTS LOGIC ---
  const zoneStats = useMemo(() => {
    const valid = filteredEvents.filter(e => e.start_x !== null);
    if (valid.length === 0) return { def: 0, mid: 0, att: 0 };
    const total = valid.length;
    const third = cfg.width / 3;
    const def = valid.filter(e => e.start_x <= third).length;
    const mid = valid.filter(e => e.start_x > third && e.start_x <= third * 2).length;
    const att = valid.filter(e => e.start_x > third * 2).length;
    return { def: Math.round((def/total)*100), mid: Math.round((mid/total)*100), att: Math.round((att/total)*100) };
  }, [filteredEvents, cfg]);

  const topActors = useMemo(() => {
    const counts = {};
    filteredEvents.forEach(e => { counts[e.player_id] = (counts[e.player_id] || 0) + 1; });
    return Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 3).map(([pid, count]) => {
        const player = lineups.find(l => l.player_id === pid);
        return { name: player ? player.players?.player_name : 'Unknown', jersey: player?.jersey_no || '-', count };
    });
  }, [filteredEvents, lineups]);

  // --- FIELD TILT LOGIC ---
  const fieldTiltStats = useMemo(() => {
    let homeFtActions = 0;
    let awayFtActions = 0;
    const attackThreshold = cfg.width * (2/3);
    enrichedEvents.forEach(e => {
      if (e.start_x !== null && e.start_x > attackThreshold) {
        if (e.team_id === match.home_team_id) homeFtActions++;
        if (e.team_id === match.away_team_id) awayFtActions++;
      }
    });
    const total = homeFtActions + awayFtActions;
    return {
      homeActions: homeFtActions, awayActions: awayFtActions,
      homeTilt: total > 0 ? Math.round((homeFtActions / total) * 100) : 50,
      awayTilt: total > 0 ? Math.round((awayFtActions / total) * 100) : 50
    };
  }, [enrichedEvents, match.home_team_id, match.away_team_id, cfg]);

  // --- COMPREHENSIVE ATTACK METRICS LOGIC ---
  const attackStats = useMemo(() => {
    if (!enrichedEvents || enrichedEvents.length === 0) return null;
    const calcTeamAttack = (teamId) => {
        const evs = enrichedEvents.filter(e => e.team_id === teamId);
        const shots = evs.filter(e => e.action === 'Shoot');
        const goals = shots.filter(e => e.outcome === 'Goal').length;
        const sot = shots.filter(e => ['Goal', 'Save'].includes(e.outcome)).length;
        const boxShots = shots.filter(e => e.start_x !== null && e.start_x >= cfg.boxX && e.start_y >= cfg.boxYMin && e.start_y <= cfg.boxYMax).length;
        const outBoxShots = shots.length - boxShots;
        let totalDist = 0, validDistShots = 0;
        shots.forEach(s => {
            if (s.start_x !== null && s.start_y !== null) {
                totalDist += Math.sqrt(Math.pow(cfg.width - s.start_x, 2) + Math.pow(cfg.height / 2 - s.start_y, 2));
                validDistShots++;
            }
        });
        const avgShotDist = validDistShots ? (totalDist / validDistShots).toFixed(1) : 0;
        const xg = shots.reduce((acc, s) => acc + (parseFloat(s.xg) || 0), 0).toFixed(2);
        const xgPerShot = shots.length ? (xg / shots.length).toFixed(2) : 0;
        const xgDiff = (goals - xg).toFixed(2);
        const passes = evs.filter(e => e.action === 'Pass');
        const succPasses = passes.filter(p => ['Successful', 'Assist', 'Key Pass'].includes(p.outcome)).length;
        const progPasses = passes.filter(p => p.end_x !== null && p.start_x !== null && (p.end_x - p.start_x) >= cfg.progressiveThreshold).length;
        const keyPasses = passes.filter(p => p.outcome === 'Key Pass').length;
        const assists = passes.filter(p => p.outcome === 'Assist').length;
        const throughBalls = evs.filter(e => e.action === 'Through Ball').length;
        const crosses = evs.filter(e => e.type === 'Corner Kick' || (e.action === 'Pass' && e.start_y !== null && (e.start_y < cfg.height * 0.2 || e.start_y > cfg.height * 0.8) && e.start_x > cfg.attackingThirdX)).length;
        const carries = evs.filter(e => e.action === 'Carry');
        const progCarries = carries.filter(c => c.end_x !== null && c.start_x !== null && (c.end_x - c.start_x) >= cfg.progressiveThreshold).length;
        const final3rdCarries = carries.filter(c => c.start_x !== null && c.end_x !== null && c.start_x < cfg.attackingThirdX && c.end_x >= cfg.attackingThirdX).length;
        const dribbles = evs.filter(e => e.action === 'Dribble');
        const succDribbles = dribbles.filter(d => d.outcome === 'Successful').length;
        const shotsUnderPressure = shots.filter(s => s.pressure_on === true).length;
        const passesUnderPressure = passes.filter(p => p.pressure_on === true);
        const succPassesUnderPressure = passesUnderPressure.filter(p => ['Successful', 'Assist', 'Key Pass'].includes(p.outcome)).length;
        const pressPassAcc = passesUnderPressure.length ? Math.round((succPassesUnderPressure / passesUnderPressure.length) * 100) : 0;
        return {
            shots: shots.length, goals, sot, boxShots, outBoxShots, avgShotDist, xg, xgPerShot, xgDiff,
            passes: passes.length, succPasses, passAcc: passes.length ? Math.round((succPasses/passes.length)*100) : 0,
            progPasses, keyPasses, assists, throughBalls, crosses,
            carries: carries.length, progCarries, final3rdCarries,
            dribbles: dribbles.length, succDribbles, dribbleAcc: dribbles.length ? Math.round((succDribbles/dribbles.length)*100) : 0,
            shotsUnderPressure, pressPassAcc
        };
    };
    return { home: calcTeamAttack(match.home_team_id), away: calcTeamAttack(match.away_team_id) };
  }, [enrichedEvents, match, cfg]);

  // --- COMPREHENSIVE DEFENSE METRICS LOGIC ---
  const defenseStats = useMemo(() => {
    if (!enrichedEvents || enrichedEvents.length === 0) return null;
    const calcTeamDefense = (teamId, opponentId) => {
        const evs = enrichedEvents.filter(e => e.team_id === teamId);
        const oppEvs = enrichedEvents.filter(e => e.team_id === opponentId);
        const tackles = evs.filter(e => ['Sliding Tackle', 'Standing Tackle'].includes(e.action));
        const totalTackles = tackles.length;
        const succTackles = tackles.filter(e => e.outcome === 'Successful');
        const failedTackles = tackles.filter(e => e.outcome === 'Unsuccessful');
        const tacklesWithPoss = succTackles.filter(e => e.type === 'With Possession').length;
        const tackleSuccess = totalTackles > 0 ? Math.round((succTackles.length / totalTackles) * 100) : 0;
        const interceptions = evs.filter(e => e.action === 'Pass Intercept');
        const totalInterceptions = interceptions.length;
        const succInterceptions = interceptions.filter(e => e.outcome === 'Successful');
        const failedInterceptions = interceptions.filter(e => e.outcome === 'Unsuccessful').length;
        const intsWithPoss = succInterceptions.filter(e => e.type === 'With Possession').length;
        const blocks = evs.filter(e => e.action === 'Block');
        const totalBlocks = blocks.length;
        const succBlocks = blocks.filter(e => e.outcome === 'Successful');
        const blocksWithPoss = succBlocks.filter(e => e.type === 'With Possession').length;
        const blockOwnGoals = blocks.filter(e => e.outcome === 'Unsuccessful' && e.type === 'Own Goal').length;
        const clearances = evs.filter(e => e.action === 'Clearance');
        const totalClearances = clearances.length;
        const succClearances = clearances.filter(e => e.outcome === 'Successful');
        const clearWithPoss = succClearances.filter(e => e.type === 'With Possession').length;
        const clearOwnGoals = clearances.filter(e => e.outcome === 'Unsuccessful' && e.type === 'Own Goal').length;
        const pressures = evs.filter(e => e.action === 'Pressure');
        const totalPressures = pressures.length;
        const pressureFouls = pressures.filter(e => e.outcome === 'Foul').length;
        const discipline = evs.filter(e => e.action === 'Discipline');
        const disciplineFouls = discipline.filter(e => e.outcome === 'Foul');
        const totalFouls = disciplineFouls.length;
        const yellowCards = disciplineFouls.filter(e => e.type === 'Yellow Card').length;
        const redCards = disciplineFouls.filter(e => e.type === 'Red Card').length;
        const saves = evs.filter(e => e.action === 'Save');
        const totalSaves = saves.length;
        const grippingSaves = saves.filter(e => e.outcome === 'Gripping').length;
        const pushSaves = saves.filter(e => ['Pushing-in', 'Pushing-out'].includes(e.outcome)).length;
        const oppShotsBlocked = oppEvs.filter(e => e.action === 'Shoot' && e.outcome === 'Block').length;
        const possessionWins = tacklesWithPoss + intsWithPoss + blocksWithPoss + clearWithPoss;
        const ballRecoveries = possessionWins + totalSaves;
        const totalDefensiveActions = totalTackles + totalInterceptions + totalBlocks + totalClearances + totalPressures;
        const totalSuccDefActions = succTackles.length + succInterceptions.length + succBlocks.length + succClearances.length;
        const defActionSuccessRate = totalDefensiveActions > 0 ? Math.round((totalSuccDefActions / totalDefensiveActions) * 100) : 0;
        return {
            totalTackles, succTackles: succTackles.length, failedTackles: failedTackles.length, tacklesWithPoss, tackleSuccess,
            totalInterceptions, succInterceptions: succInterceptions.length, failedInterceptions, intsWithPoss,
            totalBlocks, succBlocks: succBlocks.length, blocksWithPoss, blockOwnGoals,
            totalClearances, succClearances: succClearances.length, clearWithPoss, clearOwnGoals,
            totalPressures, pressureFouls, totalFouls, yellowCards, redCards,
            totalSaves, grippingSaves, pushSaves, oppShotsBlocked,
            possessionWins, ballRecoveries, totalDefensiveActions, defActionSuccessRate
        };
    };
    return { home: calcTeamDefense(match.home_team_id, match.away_team_id), away: calcTeamDefense(match.away_team_id, match.home_team_id) };
  }, [enrichedEvents, match]);

  // --- PLAYER COMPARISON LOGIC ---
  const p1Options = useMemo(() => lineups.filter(l => l.team_id === p1TeamId), [lineups, p1TeamId]);
  const p2Options = useMemo(() => lineups.filter(l => l.team_id === p2TeamId), [lineups, p2TeamId]);

  useEffect(() => {
    if (p1Options.length > 0 && (!p1PlayerId || !p1Options.find(p => p.player_id === p1PlayerId))) setP1PlayerId(p1Options[0].player_id);
  }, [p1Options, p1PlayerId]);

  useEffect(() => {
    if (p2Options.length > 0 && (!p2PlayerId || !p2Options.find(p => p.player_id === p2PlayerId))) setP2PlayerId(p2Options[0].player_id);
  }, [p2Options, p2PlayerId]);

  const matchMaxes = useMemo(() => {
    const playerTotals = {};
    enrichedEvents.forEach(e => {
        if (!playerTotals[e.player_id]) playerTotals[e.player_id] = { passes: 0, shots: 0, tackles: 0, interceptions: 0, carries: 0, xg: 0 };
        const pt = playerTotals[e.player_id];
        if (e.action === 'Pass') pt.passes++;
        if (e.action === 'Shoot') { pt.shots++; pt.xg += parseFloat(e.xg || 0); }
        if (['Standing Tackle', 'Sliding Tackle'].includes(e.action)) pt.tackles++;
        if (e.action === 'Pass Intercept') pt.interceptions++;
        if (e.action === 'Carry') pt.carries++;
    });
    let maxes = { passes: 1, shots: 1, tackles: 1, interceptions: 1, carries: 1, xg: 0.1 };
    Object.values(playerTotals).forEach(pt => {
        if (pt.passes > maxes.passes) maxes.passes = pt.passes;
        if (pt.shots > maxes.shots) maxes.shots = pt.shots;
        if (pt.tackles > maxes.tackles) maxes.tackles = pt.tackles;
        if (pt.interceptions > maxes.interceptions) maxes.interceptions = pt.interceptions;
        if (pt.carries > maxes.carries) maxes.carries = pt.carries;
        if (pt.xg > maxes.xg) maxes.xg = pt.xg;
    });
    return maxes;
  }, [enrichedEvents]);

  const getPlayerStatsForComparison = (pid) => {
    if (!pid) return null;
    const info = lineups.find(l => l.player_id === pid) || {};
    const evs = enrichedEvents.filter(e => e.player_id === pid);
    const passes = evs.filter(e => e.action === 'Pass');
    const succPasses = passes.filter(p => ['Successful', 'Assist', 'Key Pass'].includes(p.outcome));
    const shots = evs.filter(e => e.action === 'Shoot');
    const goals = shots.filter(s => s.outcome === 'Goal').length;
    const tackles = evs.filter(e => ['Sliding Tackle', 'Standing Tackle'].includes(e.action));
    const succTackles = tackles.filter(t => t.outcome === 'Successful').length;
    const carries = evs.filter(e => e.action === 'Carry');
    const interceptions = evs.filter(e => e.action === 'Pass Intercept');
    return {
        info, events: evs,
        stats: {
            passes: passes.length, succPasses: succPasses.length,
            passAcc: passes.length ? Math.round((succPasses.length/passes.length)*100) : 0,
            shots: shots.length, goals,
            xg: parseFloat(shots.reduce((acc, s) => acc + (parseFloat(s.xg) || 0), 0).toFixed(2)),
            tackles: tackles.length, succTackles,
            carries: carries.length, interceptions: interceptions.length
        }
    };
  };

  const p1Data = useMemo(() => getPlayerStatsForComparison(p1PlayerId), [p1PlayerId, lineups, enrichedEvents]);
  const p2Data = useMemo(() => getPlayerStatsForComparison(p2PlayerId), [p2PlayerId, lineups, enrichedEvents]);

  // --- MATCH LEADERS LOGIC ---
  const matchLeaders = useMemo(() => {
    const excludedActions = ['Substitution', 'Match Time', 'Pressure'];
    const validActions = Object.keys(CAC_LOGIC).filter(a => !excludedActions.includes(a));
    const counts = {};
    enrichedEvents.forEach(e => {
        if (validActions.includes(e.action)) {
            if (!counts[e.action]) counts[e.action] = {};
            counts[e.action][e.player_id] = (counts[e.action][e.player_id] || 0) + 1;
        }
    });
    const leaders = [];
    validActions.forEach(action => {
        if (!counts[action]) return;
        const sortedPlayers = Object.entries(counts[action]).sort((a, b) => b[1] - a[1]);
        if (sortedPlayers.length > 0) {
            const topList = sortedPlayers.slice(0, 4).map(([pid, count]) => {
                const pLineup = lineups.find(l => l.player_id === pid) || {};
                const isHomePlayer = pLineup.team_id === match.home_team_id;
                return { count, playerName: pLineup.players?.player_name || 'Unknown', jerseyNo: pLineup.jersey_no || '-', teamName: isHomePlayer ? match.home_team?.team_name : match.away_team?.team_name, isHome: isHomePlayer };
            });
            const actionTotal = sortedPlayers.reduce((sum, [,c]) => sum + c, 0);
            leaders.push({ action, actionTotal, topList });
        }
    });
    return leaders.sort((a, b) => b.actionTotal - a.actionTotal).slice(0, 12);
  }, [enrichedEvents, lineups, match]);

  // --- HIGHLIGHTS LOGIC & FILTERS ---
  const matchVideoUrl = match.video_url;

  // Auto-detect video provider from URL
  const matchVideoProvider = useMemo(() => {
    if (!matchVideoUrl) return null;
    if (matchVideoUrl.includes('youtube.com') || matchVideoUrl.includes('youtu.be')) return 'youtube';
    if (matchVideoUrl.includes('drive.google.com')) return 'drive';
    return 'mp4';
  }, [matchVideoUrl]);

  const hlFilterOptions = useMemo(() => {
    const actions = Array.from(new Set(enrichedEvents.map(e => e.action))).filter(Boolean).sort();
    let outcomes = [];
    if (hlAction === 'ALL') { outcomes = Array.from(new Set(enrichedEvents.map(e => e.outcome))).filter(Boolean).sort(); }
    else if (CAC_LOGIC[hlAction]) { outcomes = Object.keys(CAC_LOGIC[hlAction]).sort(); }
    let types = [];
    if (hlAction === 'ALL' || hlOutcome === 'ALL') { types = Array.from(new Set(enrichedEvents.map(e => e.type))).filter(t => t && t !== 'NA').sort(); }
    else if (CAC_LOGIC[hlAction] && CAC_LOGIC[hlAction][hlOutcome]) { types = CAC_LOGIC[hlAction][hlOutcome].filter(t => t !== 'NA').sort(); }
    return { actions, outcomes, types };
  }, [enrichedEvents, hlAction, hlOutcome]);

  const hlFilteredEvents = useMemo(() => {
    return enrichedEvents.filter(e => {
        const matchTeam = hlTeam === 'ALL' || e.team_id === hlTeam;
        const matchPlayer = hlPlayer === 'ALL' || e.player_id === hlPlayer;
        const matchAction = hlAction === 'ALL' || e.action === hlAction;
        const matchOutcome = hlOutcome === 'ALL' || e.outcome === hlOutcome;
        const matchType = hlType === 'ALL' || e.type === hlType;
        return matchTeam && matchPlayer && matchAction && matchOutcome && matchType && e.action !== 'Match Time';
    }).sort((a, b) => a.match_time_seconds - b.match_time_seconds);
  }, [enrichedEvents, hlTeam, hlPlayer, hlAction, hlOutcome, hlType]);

  const handleEventClick = (timeSecs) => { setHlSeekTime(Math.max(0, timeSecs - 5)); setHlForceRender(prev => prev + 1); };

  useEffect(() => {
    const handleKeyDown = (e) => {
        if (activeTab !== 'HIGHLIGHTS') return;
        if (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT') return;
        if (videoRef.current) {
            if (e.code === 'Space') { e.preventDefault(); videoRef.current.paused ? videoRef.current.play().catch(() => {}) : videoRef.current.pause(); }
            else if (e.code === 'ArrowRight') { e.preventDefault(); try { videoRef.current.currentTime += 5; } catch(err) {} }
            else if (e.code === 'ArrowLeft') { e.preventDefault(); try { videoRef.current.currentTime -= 5; } catch(err) {} }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab]);

  useEffect(() => {
    if (videoRef.current && hlSeekTime >= 0) {
        try { videoRef.current.currentTime = hlSeekTime; } catch (err) {}
        videoRef.current.play().catch(() => {});
    }
  }, [hlSeekTime, hlForceRender]);

  const getYouTubeId = (url) => {
    if(!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const mtch = url.match(regExp);
    return (mtch && mtch[2].length === 11) ? mtch[2] : null;
  };

  const getDriveId = (url) => {
    if(!url) return null;
    const mtch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
    return mtch ? mtch[1] : null;
  };

  const hotFilters = [
    { label: 'Shoot', apply: () => { setHlAction('Shoot'); setHlOutcome('ALL'); setHlType('ALL'); setHlTeam('ALL'); setHlPlayer('ALL'); } },
    { label: 'Standing Tackle', apply: () => { setHlAction('Standing Tackle'); setHlOutcome('ALL'); setHlType('ALL'); setHlTeam('ALL'); setHlPlayer('ALL'); } },
    { label: 'Sliding Tackle', apply: () => { setHlAction('Sliding Tackle'); setHlOutcome('ALL'); setHlType('ALL'); setHlTeam('ALL'); setHlPlayer('ALL'); } },
    { label: 'Pass Intercept', apply: () => { setHlAction('Pass Intercept'); setHlOutcome('ALL'); setHlType('ALL'); setHlTeam('ALL'); setHlPlayer('ALL'); } },
    { label: 'Save', apply: () => { setHlAction('Save'); setHlOutcome('ALL'); setHlType('ALL'); setHlTeam('ALL'); setHlPlayer('ALL'); } },
    { label: 'Foul', apply: () => { setHlAction('ALL'); setHlOutcome('Foul'); setHlType('ALL'); setHlTeam('ALL'); setHlPlayer('ALL'); } },
    { label: 'Assist', apply: () => { setHlAction('ALL'); setHlOutcome('Assist'); setHlType('ALL'); setHlTeam('ALL'); setHlPlayer('ALL'); } },
    { label: 'Goal', apply: () => { setHlAction('ALL'); setHlOutcome('Goal'); setHlType('ALL'); setHlTeam('ALL'); setHlPlayer('ALL'); } },
    { label: 'Own Goal', apply: () => { setHlAction('ALL'); setHlOutcome('ALL'); setHlType('Own Goal'); setHlTeam('ALL'); setHlPlayer('ALL'); } },
    { label: 'Key Pass', apply: () => { setHlAction('ALL'); setHlOutcome('Key Pass'); setHlType('ALL'); setHlTeam('ALL'); setHlPlayer('ALL'); } },
    { label: 'Dribble', apply: () => { setHlAction('Dribble'); setHlOutcome('ALL'); setHlType('ALL'); setHlTeam('ALL'); setHlPlayer('ALL'); } },
  ];

  // --- COMPUTE SCORES FROM EVENTS ---
  const computedScores = useMemo(() => {
    let homeScore = 0;
    let awayScore = 0;
    enrichedEvents.forEach(e => {
      if (e.action === 'Shoot' && e.outcome === 'Goal') {
        if (e.team_id === match.home_team_id) homeScore++;
        else if (e.team_id === match.away_team_id) awayScore++;
      }
      // Own goals from blocks/clearances/intercepts
      if (e.outcome === 'Unsuccessful' && e.type === 'Own Goal') {
        if (e.team_id === match.home_team_id) awayScore++;
        else if (e.team_id === match.away_team_id) homeScore++;
      }
    });
    return { home: homeScore, away: awayScore };
  }, [enrichedEvents, match]);

  // --- COMPUTE SCORERS FROM EVENTS ---
  const computeScorers = (teamId) => {
    const goalMap = {};
    enrichedEvents.forEach(e => {
      if (e.action === 'Shoot' && e.outcome === 'Goal' && e.team_id === teamId) {
        goalMap[e.player_id] = (goalMap[e.player_id] || 0) + 1;
      }
    });
    return Object.entries(goalMap).map(([pid, count]) => {
      const l = lineups.find(x => x.player_id === pid);
      return { name: l?.players?.player_name || 'Unknown', display: Array(count).fill('⚽').join('') };
    });
  };

  const stats = useMemo(() => {
      if (!attackStats) return null;
      const hStats = attackStats.home;
      const aStats = attackStats.away;
      const totalEventsHome = enrichedEvents.filter(e => e.team_id === match.home_team_id).length;
      const totalEventsAway = enrichedEvents.filter(e => e.team_id === match.away_team_id).length;
      const totalEvents = totalEventsHome + totalEventsAway;
      const possessionHome = totalEvents ? Math.round((totalEventsHome / totalEvents) * 100) : 50;

      const processRoster = (teamId) => {
        const matchLineup = lineups.filter(l => l.team_id === teamId);
        return {
          starters: matchLineup.filter(l => l.starting_xi),
          subs: matchLineup.filter(l => !l.starting_xi),
          scorers: computeScorers(teamId)
        };
      };

      return { 
        home: { 
          possession: possessionHome, 
          xg: hStats.xg, shots: hStats.shots, sot: hStats.sot, 
          passAcc: hStats.passAcc, passes: hStats.passes, 
          fouls: enrichedEvents.filter(e => e.team_id === match.home_team_id && (e.outcome === 'Foul' || e.action === 'Discipline')).length,
          roster: processRoster(match.home_team_id) 
        }, 
        away: { 
          possession: 100 - possessionHome, 
          xg: aStats.xg, shots: aStats.shots, sot: aStats.sot, 
          passAcc: aStats.passAcc, passes: aStats.passes, 
          fouls: enrichedEvents.filter(e => e.team_id === match.away_team_id && (e.outcome === 'Foul' || e.action === 'Discipline')).length,
          roster: processRoster(match.away_team_id) 
        } 
      };
    }, [enrichedEvents, attackStats, lineups, match]);

  const handleDownloadPDF = () => {
    setIsGeneratingPDF(true);
    setTimeout(() => {
      try {
        const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        const W = 210, H = 297, M = 12;
        const pw = W - M * 2;
        let y = M;
        const addText = (text, x, fontSize, opts = {}) => {
          doc.setFontSize(fontSize); doc.setFont('helvetica', opts.style || 'normal'); doc.setTextColor(opts.color || '#000000');
          const lines = doc.splitTextToSize(String(text || ''), opts.maxW || (pw - (x - M)));
          doc.text(lines, x, y); return lines.length * fontSize * 0.4;
        };
        const checkPage = (needed) => { if (y + needed > H - M) { doc.addPage(); y = M; return true; } return false; };
        const drawLine = (x1, y1, x2, y2, color = '#000000', width = 0.5) => { doc.setDrawColor(color); doc.setLineWidth(width); doc.line(x1, y1, x2, y2); };
        const drawRect = (x, ry, w, h, fill, border = '#000000') => { doc.setDrawColor(border); doc.setFillColor(fill); doc.rect(x, ry, w, h, 'FD'); };
        const compareRow = (label, hVal, aVal, highlight = false) => {
          checkPage(8);
          if (highlight) { doc.setFillColor('#FFD166'); doc.rect(M, y - 3.5, pw, 8, 'F'); }
          doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor('#0077B6');
          doc.text(String(hVal), M + pw * 0.17, y, { align: 'center' });
          doc.setTextColor('#333333'); doc.setFontSize(6); doc.setFont('helvetica', 'normal');
          doc.text(String(label).toUpperCase(), M + pw * 0.5, y, { align: 'center' });
          doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor('#D90429');
          doc.text(String(aVal), M + pw * 0.83, y, { align: 'center' });
          y += 6; drawLine(M, y - 2, M + pw, y - 2, '#dddddd', 0.2);
        };

        // PAGE 1: HEADER + SUMMARY
        drawRect(M, y - 2, pw, 14, '#000000');
        doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor('#FFFFFF');
        doc.text('CAC MATCH REPORT', M + 4, y + 6);
        doc.setFontSize(8); doc.setTextColor('#06D6A0');
        doc.text(tournamentName.toUpperCase(), M + pw - 4, y + 6, { align: 'right' });
        y += 18;
        doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor('#0077B6');
        doc.text(match.home_team?.team_name || '', M, y);
        doc.setFontSize(22); doc.setTextColor('#000000');
        doc.text(`${computedScores.home}  -  ${computedScores.away}`, M + pw * 0.5, y, { align: 'center' });
        doc.setFontSize(14); doc.setTextColor('#D90429');
        doc.text(match.away_team?.team_name || '', M + pw, y, { align: 'right' });
        y += 6;
        doc.setFontSize(7); doc.setTextColor('#888888'); doc.setFont('helvetica', 'normal');
        doc.text(`${match.match_date || ''} • ${match.match_name || ''} • FINAL`, M + pw * 0.5, y, { align: 'center' });
        y += 8; drawLine(M, y, M + pw, y, '#000000', 1); y += 6;

        if (stats) {
          addText('1. MATCH SUMMARY', M, 11, { style: 'bold' }); y += 8;
          drawLine(M, y - 3, M + pw, y - 3, '#000000', 0.5);
          doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setTextColor('#0077B6');
          doc.text(match.home_team?.team_name || 'HOME', M + pw * 0.17, y, { align: 'center' });
          doc.setTextColor('#D90429');
          doc.text(match.away_team?.team_name || 'AWAY', M + pw * 0.83, y, { align: 'center' });
          y += 6;
          (statsConfig.summary || []).filter(e => e.enabled).sort((a,b) => a.order - b.order).forEach(e => {
            const def = STATS_REGISTRY[e.id]; if (!def || !stats) return;
            compareRow(def.label, def.getH(stats.home), def.getA(stats.away), def.highlight || false);
          });
          y += 4;
        }

        // PAGE 2: ATTACK
        doc.addPage(); y = M;
        addText('2. ATTACK OVERVIEW', M, 11, { style: 'bold' }); y += 8;
        drawLine(M, y - 3, M + pw, y - 3, '#000000', 0.5);
        if (attackStats) {
          doc.setFontSize(6); doc.setFont('helvetica', 'bold');
          doc.setTextColor('#0077B6'); doc.text(match.home_team?.team_name || 'HOME', M + pw * 0.17, y, { align: 'center' });
          doc.setTextColor('#D90429'); doc.text(match.away_team?.team_name || 'AWAY', M + pw * 0.83, y, { align: 'center' });
          y += 6;
          [{ key: 'attack_shooting', title: 'SHOOTING & EFFICIENCY' }, { key: 'attack_distribution', title: 'DISTRIBUTION & CREATIVITY' }, { key: 'attack_ball_progression', title: 'BALL PROGRESSION' }, { key: 'attack_pressure', title: 'PERFORMANCE UNDER PRESSURE' }].forEach(({ key, title }) => {
            const rows = (statsConfig[key] || []).filter(e => e.enabled).sort((a,b) => a.order - b.order);
            if (rows.length === 0) return;
            drawRect(M, y - 3, pw, 6, '#eeeeee');
            doc.setFontSize(6); doc.setTextColor('#000000'); doc.text(title, M + pw * 0.5, y + 1, { align: 'center' });
            y += 8;
            rows.forEach(e => { const def = STATS_REGISTRY[e.id]; if (!def) return; compareRow(def.label, def.getH(attackStats.home), def.getA(attackStats.away), def.highlight || false); });
            y += 4;
          });
        }

        // PAGE 3: DEFENSE
        doc.addPage(); y = M;
        addText('3. DEFENSE OVERVIEW', M, 11, { style: 'bold' }); y += 8;
        drawLine(M, y - 3, M + pw, y - 3, '#000000', 0.5);
        if (defenseStats) {
          doc.setFontSize(6); doc.setFont('helvetica', 'bold');
          doc.setTextColor('#0077B6'); doc.text(match.home_team?.team_name || 'HOME', M + pw * 0.17, y, { align: 'center' });
          doc.setTextColor('#D90429'); doc.text(match.away_team?.team_name || 'AWAY', M + pw * 0.83, y, { align: 'center' });
          y += 6;
          [{ key: 'defense_tackling', title: 'TACKLING & INTERCEPTIONS' }, { key: 'defense_blocks', title: 'BLOCKS & CLEARANCES' }, { key: 'defense_work_rate', title: 'WORK RATE & RECOVERIES' }, { key: 'defense_goalkeeping', title: 'GOALKEEPING & DISCIPLINE' }].forEach(({ key, title }) => {
            const rows = (statsConfig[key] || []).filter(e => e.enabled).sort((a,b) => a.order - b.order);
            if (rows.length === 0) return;
            drawRect(M, y - 3, pw, 6, '#eeeeee');
            doc.setFontSize(6); doc.setTextColor('#000000'); doc.text(title, M + pw * 0.5, y + 1, { align: 'center' });
            y += 8;
            rows.forEach(e => { const def = STATS_REGISTRY[e.id]; if (!def) return; compareRow(def.label, def.getH(defenseStats.home), def.getA(defenseStats.away), def.highlight || false); });
            y += 4;
          });
        }

        // PAGE 4: MATCH LEADERS
        doc.addPage(); y = M;
        addText('4. MATCH LEADERS', M, 11, { style: 'bold' }); y += 8;
        drawLine(M, y - 3, M + pw, y - 3, '#000000', 0.5);
        if (matchLeaders && matchLeaders.length > 0) {
          const colW = pw / 3 - 2;
          matchLeaders.forEach((leader, i) => {
            const col = i % 3;
            if (col === 0 && i > 0) y += 2;
            checkPage(28);
            const xOff = M + col * (colW + 3);
            drawRect(xOff, y, colW, 24, '#FFFFFF', '#000000');
            doc.setFontSize(5); doc.setFont('helvetica', 'bold'); doc.setTextColor('#888888');
            doc.text(leader.action.toUpperCase(), xOff + 2, y + 4);
            drawLine(xOff, y + 5, xOff + colW, y + 5, '#000000', 0.3);
            if (leader.topList[0]) {
              doc.setFontSize(12); doc.setTextColor('#000000'); doc.text(String(leader.topList[0].count), xOff + 2, y + 13);
              doc.setFontSize(5); doc.setFont('helvetica', 'normal');
              doc.text(`#${leader.topList[0].jerseyNo} ${leader.topList[0].playerName}`.substring(0, 25), xOff + 14, y + 11);
              doc.setTextColor(leader.topList[0].isHome ? '#0077B6' : '#D90429'); doc.setFontSize(4);
              doc.text(leader.topList[0].teamName || '', xOff + 14, y + 14);
            }
            doc.setFontSize(4); doc.setTextColor('#888888');
            leader.topList.slice(1, 4).forEach((p, idx) => {
              doc.setTextColor(p.isHome ? '#0077B6' : '#D90429');
              doc.text(`#${p.jerseyNo} ${p.playerName}: ${p.count}`.substring(0, 35), xOff + 2, y + 18 + idx * 2.5);
            });
            if (col === 2) y += 26;
          });
          if (matchLeaders.length % 3 !== 0) y += 26;
        }

        doc.save(`Match_Report_${match.home_team?.team_name}_vs_${match.away_team?.team_name}.pdf`);
      } catch (err) {
        console.error('PDF generation failed:', err);
        alert('PDF generation failed. Check console for details.');
      } finally {
        setIsGeneratingPDF(false);
      }
    }, 2500);
  };

  const tabs = [
    { id: 'SUMMARY', label: 'Summary', icon: Activity },
    { id: 'DISTRIBUTION', label: 'Distribution & Avg', icon: MapIcon },
    { id: 'ATTACK', label: 'Attack Overview', icon: Target },
    { id: 'DEFENSE', label: 'Defense', icon: Shield },
    { id: 'PLAYER', label: 'Player Comparison', icon: Users },
    { id: 'HIGHLIGHTS', label: 'Highlights', icon: Video },
    { id: 'NOTES', label: 'Match Info', icon: Edit3 },
  ];

  const resetScatterFilters = () => {
    setDistTeam('ALL'); setDistPlayer('ALL'); setDistAction('ALL'); setDistOutcome('ALL'); setDistType('ALL');
    let calculatedMax = isFutsal ? 40 : 90;
    if (events && events.length > 0) calculatedMax = Math.ceil(Math.max(...events.map(e => e.match_time_seconds)) / 60);
    setMinMinute(0); setMaxMinute(calculatedMax > 0 ? calculatedMax : (isFutsal ? 40 : 90));
  };

  const absoluteMaxMinute = useMemo(() => {
    if (!events || events.length === 0) return isFutsal ? 40 : 90;
    const maxSecs = Math.max(...events.map(e => e.match_time_seconds));
    const calculated = Math.ceil(maxSecs / 60);
    return calculated > 0 ? calculated : (isFutsal ? 40 : 90);
  }, [events, isFutsal]);

  const toggleAvgPlayer = (teamFlag, pid) => {
    if (teamFlag === 'HOME') setAvgHomePlayers(prev => prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid]);
    else setAvgAwayPlayers(prev => prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid]);
  };
  const handleSelectAllAvgPlayers = (teamFlag, selectAll) => {
    if (teamFlag === 'HOME') setAvgHomePlayers(selectAll ? filterOptions.homePlayers.map(p => p.player_id) : []);
    else setAvgAwayPlayers(selectAll ? filterOptions.awayPlayers.map(p => p.player_id) : []);
  };

  return (
    <div className="min-h-screen bg-white font-mono relative overflow-x-hidden">
      
      {/* HIDDEN PDF REPORT CONTAINER */}
      {isGeneratingPDF && (
        <div className="fixed pointer-events-none" style={{ top: 0, left: '-9999px', width: '800px', zIndex: -1, overflow: 'auto' }}>
        <div id="pdf-report-container" className="bg-white p-8 font-mono text-black print-container" style={{ width: '800px', maxWidth: '800px' }}>
            <div className="border-b-4 border-black pb-4 mb-8">
              <h1 className="text-4xl font-black uppercase text-[#0077B6] mb-2 tracking-tighter">CAC Match Report</h1>
              <h2 className="text-3xl font-bold uppercase">{match.home_team?.team_name} <span className="text-[#0077B6]">{computedScores.home}</span> - <span className="text-[#D90429]">{computedScores.away}</span> {match.away_team?.team_name}</h2>
              <p className="text-sm font-bold text-gray-500 mt-2">{match.match_date} • {match.match_name} • {tournamentName}</p>
            </div>
          <div className="pdf-section mb-12">
             <h3 className="text-2xl font-black uppercase border-b-2 border-black mb-6">Distribution & Positioning</h3>
             <h4 className="text-lg font-black uppercase mb-2 bg-black text-white p-2">Passes Telemetry</h4>
             <div className="grid grid-cols-2 gap-8 mb-8">
               <div><FutsalDistributionPitch filteredEvents={homePasses} homeTeamId={match.home_team_id} lineups={lineups} isFutsal={isFutsal} /><div className="text-center text-xs font-black uppercase text-[#0077B6] mt-2">{match.home_team?.team_name}</div></div>
               <div><FutsalDistributionPitch filteredEvents={awayPasses} homeTeamId={match.home_team_id} lineups={lineups} isFutsal={isFutsal} /><div className="text-center text-xs font-black uppercase text-[#D90429] mt-2">{match.away_team?.team_name}</div></div>
             </div>
             <h4 className="text-lg font-black uppercase mb-2 bg-black text-white p-2">Average Pass Position</h4>
             <div className="grid grid-cols-2 gap-8 mb-8">
                <AveragePositionsPitch data={pdfAvgPassHome} teamName={match.home_team?.team_name} isHome={true} lineups={lineups} isFutsal={isFutsal} />
                <AveragePositionsPitch data={pdfAvgPassAway} teamName={match.away_team?.team_name} isHome={false} lineups={lineups} isFutsal={isFutsal} />
             </div>
             <h4 className="text-lg font-black uppercase mb-2 bg-black text-white p-2">Average Pass Receiving Position</h4>
             <div className="grid grid-cols-2 gap-8 mb-8">
                <AveragePositionsPitch data={pdfAvgRecvHome} teamName={match.home_team?.team_name} isHome={true} lineups={lineups} isFutsal={isFutsal} />
                <AveragePositionsPitch data={pdfAvgRecvAway} teamName={match.away_team?.team_name} isHome={false} lineups={lineups} isFutsal={isFutsal} />
             </div>
          </div>
          <div className="pdf-section mb-12">
             <h4 className="text-lg font-black uppercase mb-2 bg-black text-white p-2">Shot Maps (xG)</h4>
             <div className="grid grid-cols-2 gap-8 mb-8">
               <div><ShotMapPitch shots={enrichedEvents.filter(e => e.action === 'Shoot' && e.team_id === match.home_team_id)} teamName={match.home_team?.team_name} isHome={true} lineups={lineups} isFutsal={isFutsal} /></div>
               <div><ShotMapPitch shots={enrichedEvents.filter(e => e.action === 'Shoot' && e.team_id === match.away_team_id)} teamName={match.away_team?.team_name} isHome={false} lineups={lineups} isFutsal={isFutsal} /></div>
             </div>
             <h4 className="text-lg font-black uppercase mb-2 bg-black text-white p-2">Shot Placement Maps (Goal Face)</h4>
             <div className="grid grid-cols-2 gap-8 mb-8">
               <div><ShotPlacementPitch shots={enrichedEvents.filter(e => e.action === 'Shoot' && e.team_id === match.home_team_id)} teamName={match.home_team?.team_name} isHome={true} lineups={lineups} isFutsal={isFutsal} /></div>
               <div><ShotPlacementPitch shots={enrichedEvents.filter(e => e.action === 'Shoot' && e.team_id === match.away_team_id)} teamName={match.away_team?.team_name} isHome={false} lineups={lineups} isFutsal={isFutsal} /></div>
             </div>
          </div>
          <div className="pdf-section mb-12">
             <h4 className="text-lg font-black uppercase mb-2 bg-black text-white p-2">Defensive Density Heatmap</h4>
             <div className="grid grid-cols-2 gap-8 mb-8">
               <div><HeatmapPitch events={allHomeDefEvents} teamName={match.home_team?.team_name} isHome={true} isFutsal={isFutsal} /></div>
               <div><HeatmapPitch events={allAwayDefEvents} teamName={match.away_team?.team_name} isHome={false} isFutsal={isFutsal} /></div>
             </div>
          </div>
          </div>
        </div>
      )}

      {/* MAIN UI HEADER & NAVIGATION */}
      <header className="bg-black text-white p-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="hover:text-[#FFD166]"><ChevronLeft size={28} /></button>
          <h1 className="text-xl font-black uppercase tracking-widest truncate max-w-[200px] md:max-w-none">
            {match.home_team?.team_name} vs {match.away_team?.team_name}
          </h1>
          <div className={`text-[10px] font-black border px-2 py-0.5 uppercase ${isFutsal ? 'border-[#06D6A0] text-[#06D6A0]' : 'border-[#FFD166] text-[#FFD166]'}`}>
            {isFutsal ? 'Futsal' : 'Football'}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-[10px] font-black border border-white px-2 py-1 hidden sm:block uppercase">
            {tournamentName}
          </div>
          <button 
             onClick={handleDownloadPDF} 
             disabled={isGeneratingPDF}
             className="bg-[#06D6A0] text-black border-2 border-[#06D6A0] px-3 py-1 font-black uppercase text-xs flex items-center gap-2 hover:bg-white transition-all disabled:opacity-50"
          >
             <Download size={14} /> {isGeneratingPDF ? "Generating PDF..." : "Download Report PDF"}
          </button>
        </div>
      </header>

      <nav className="border-b-4 border-black bg-[#f1f5f9] flex overflow-x-auto no-scrollbar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-8 py-4 font-black uppercase text-sm whitespace-nowrap border-r-2 border-black transition-all
              ${activeTab === tab.id ? 'bg-[#FFD166] translate-y-[2px]' : 'hover:bg-white'}`}
          >
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </nav>

      <main className="p-4 md:p-8 max-w-7xl mx-auto">
        {loading || !stats ? (
          <div className="py-20 text-center uppercase font-black animate-pulse">Processing Advanced Metrics...</div>
        ) : (
          <>
            {activeTab === 'SUMMARY' && (
              <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                  <BrutalistCard color="bg-[#f8fafc]" className="text-center py-10 relative overflow-hidden">
                    <h2 className="text-3xl font-black uppercase text-[#0077B6] mb-4 relative z-10 tracking-tighter">{match.home_team?.team_name}</h2>
                    <div className="text-9xl font-black tracking-tighter relative z-10">{computedScores.home}</div>
                    <div className="mt-8 flex flex-col items-center justify-center min-h-[40px] text-sm font-bold text-gray-700">
                      {stats.home.roster.scorers.map((s, i) => (
                        <div key={i} className="flex items-center gap-2 tracking-widest">{s.display} {s.name}</div>
                      ))}
                    </div>
                  </BrutalistCard>
                  
                  <div className="flex flex-col items-center justify-center gap-4">
                    <span className="text-5xl font-black bg-black text-white px-8 py-4 shadow-[10px_10px_0px_0px_rgba(0,0,0,0.1)]">FINAL</span>
                    <span className="font-black text-gray-400 uppercase tracking-[0.2em] text-xs">MATCH DATE: {match.match_date}</span>
                    <div className="w-16 h-1 bg-black"></div>
                  </div>

                  <BrutalistCard color="bg-[#f8fafc]" className="text-center py-10 relative overflow-hidden">
                    <h2 className="text-3xl font-black uppercase text-[#D90429] mb-4 relative z-10 tracking-tighter">{match.away_team?.team_name}</h2>
                    <div className="text-9xl font-black tracking-tighter relative z-10">{computedScores.away}</div>
                    <div className="mt-8 flex flex-col items-center justify-center min-h-[40px] text-sm font-bold text-gray-700">
                      {stats.away.roster.scorers.map((s, i) => (
                        <div key={i} className="flex items-center gap-2 tracking-widest">{s.display} {s.name}</div>
                      ))}
                    </div>
                  </BrutalistCard>
                </div>

                <section>
                  <h3 className="text-2xl font-black uppercase border-b-4 border-black inline-block pb-1 mb-6">Match Analytics</h3>
                  <div className="grid grid-cols-1 gap-3">
                    {(statsConfig.summary || []).filter(e => e.enabled).sort((a, b) => a.order - b.order).map(e => {
                        const def = STATS_REGISTRY[e.id];
                        if (!def) return null;
                        return (
                          <div key={e.id} className="flex items-center border-2 border-black bg-white overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <div className="w-1/4 p-4 text-center font-black text-2xl bg-[#0077B6] text-white">{def.getH(stats.home)}</div>
                            <div className="w-2/4 p-4 text-center font-black uppercase tracking-widest text-xs bg-white border-x-2 border-black">{def.label}</div>
                            <div className="w-1/4 p-4 text-center font-black text-2xl bg-[#D90429] text-white">{def.getA(stats.away)}</div>
                          </div>
                        );
                      })}
                  </div>
                </section>

                <section>
                  <h3 className="text-2xl font-black uppercase border-b-4 border-black inline-block pb-1 mb-8">Official Team Sheets</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <TeamSheetSide teamName={match.home_team?.team_name || 'HOME'} roster={stats.home.roster} colorClass="bg-[#0077B6]" />
                    <TeamSheetSide teamName={match.away_team?.team_name || 'AWAY'} roster={stats.away.roster} colorClass="bg-[#D90429]" />
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'DISTRIBUTION' && (
              <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <section>
                  <h3 className="text-xl font-black uppercase border-b-4 border-black inline-block pb-1 mb-6">Raw Telemetry (Scatter)</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <div className="lg:col-span-3">
                      <FutsalDistributionPitch filteredEvents={filteredEvents} homeTeamId={match.home_team_id} lineups={lineups} isFutsal={isFutsal} />
                      <div className="flex gap-4 text-[10px] font-black uppercase mb-4">
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-[#0077B6]"></div> Home Action</div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-[#D90429]"></div> Away Action</div>
                        <div className="flex items-center gap-1 italic text-gray-400 ml-auto">* Hover over points</div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="border-2 border-black bg-white p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between">
                           <h4 className="text-[10px] font-black uppercase text-gray-400 mb-2 border-b-2 border-black pb-1">Filtered Zone Activity</h4>
                           <div className="flex h-8 border-2 border-black w-full mb-1">
                             {zoneStats.def > 0 && <div className="bg-[#f8fafc] flex items-center justify-center text-[10px] font-black border-r-2 border-black last:border-r-0" style={{width: `${zoneStats.def}%`}}>{zoneStats.def}%</div>}
                             {zoneStats.mid > 0 && <div className="bg-[#FFD166] flex items-center justify-center text-[10px] font-black border-r-2 border-black last:border-r-0" style={{width: `${zoneStats.mid}%`}}>{zoneStats.mid}%</div>}
                             {zoneStats.att > 0 && <div className="bg-black text-white flex items-center justify-center text-[10px] font-black" style={{width: `${zoneStats.att}%`}}>{zoneStats.att}%</div>}
                           </div>
                           <div className="flex justify-between text-[9px] font-black uppercase text-gray-500"><span>Def 3rd</span><span>Mid 3rd</span><span>Att 3rd</span></div>
                        </div>
                        <div className="border-2 border-black bg-white p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                           <h4 className="text-[10px] font-black uppercase text-gray-400 mb-2 border-b-2 border-black pb-1 flex justify-between"><span>Top Actors (Current Filter)</span><span>Events</span></h4>
                           <div className="space-y-1">
                             {topActors.length > 0 ? topActors.map((p, i) => (
                               <div key={i} className="flex justify-between items-center text-xs font-bold uppercase">
                                 <span className="truncate pr-2">#{p.jersey} {p.name}</span>
                                 <span className="bg-black text-white px-2 py-0.5 text-[10px]">{p.count}</span>
                               </div>
                             )) : <div className="text-[10px] text-gray-400 italic">No telemetry data matching filters</div>}
                           </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-6 mt-6 lg:mt-0">
                      <BrutalistCard>
                        <div className="flex items-center justify-between mb-4"><h4 className="text-[10px] font-black uppercase text-gray-400 flex items-center gap-1"><Filter size={14}/> CONTROL PANEL</h4><BrutalistButton onClick={resetScatterFilters} variant="accent" className="text-[10px] py-1 px-2">Reset</BrutalistButton></div>
                        <div className="space-y-4 text-xs font-bold uppercase">
                          <div><label className="block mb-1 text-gray-500">Team</label><select className="w-full border-2 border-black p-2 font-black" value={distTeam} onChange={e => { setDistTeam(e.target.value); setDistPlayer('ALL'); }}><option value="ALL">ALL</option><option value={match.home_team_id}>{match.home_team?.team_name}</option><option value={match.away_team_id}>{match.away_team?.team_name}</option></select></div>
                          <div><label className="block mb-1 text-gray-500">Player</label><select className="w-full border-2 border-black p-2 font-black" value={distPlayer} onChange={e => setDistPlayer(e.target.value)}><option value="ALL">ALL PLAYERS</option>{(distTeam === 'ALL' ? lineups : lineups.filter(l => l.team_id === distTeam)).map(p => (<option key={p.player_id} value={p.player_id}>#{p.jersey_no} {p.players?.player_name}</option>))}</select></div>
                          <div><label className="block mb-1 text-gray-500">Action</label><select className="w-full border-2 border-black p-2 font-black" value={distAction} onChange={e => { setDistAction(e.target.value); setDistOutcome('ALL'); setDistType('ALL'); }}><option value="ALL">ALL ACTIONS</option>{filterOptions.actions.map(a => (<option key={a} value={a}>{a}</option>))}</select></div>
                          <div><label className="block mb-1 text-gray-500">Outcome</label><select className="w-full border-2 border-black p-2 font-black" value={distOutcome} onChange={e => { setDistOutcome(e.target.value); setDistType('ALL'); }}><option value="ALL">ALL OUTCOMES</option>{filterOptions.outcomes.map(o => (<option key={o} value={o}>{o}</option>))}</select></div>
                          {filterOptions.types.length > 0 && (<div><label className="block mb-1 text-gray-500">Type</label><select className="w-full border-2 border-black p-2 font-black" value={distType} onChange={e => setDistType(e.target.value)}><option value="ALL">ALL TYPES</option>{filterOptions.types.map(t => (<option key={t} value={t}>{t}</option>))}</select></div>)}
                          <div><label className="block mb-1 text-gray-500">Time Range (Minutes)</label><div className="flex items-center gap-2"><input type="number" className="w-1/2 border-2 border-black p-2" value={minMinute} min={0} max={absoluteMaxMinute} onChange={e => setMinMinute(parseInt(e.target.value)||0)} /><span>-</span><input type="number" className="w-1/2 border-2 border-black p-2" value={maxMinute} min={0} max={absoluteMaxMinute} onChange={e => setMaxMinute(parseInt(e.target.value)||absoluteMaxMinute)} /></div></div>
                        </div>
                      </BrutalistCard>
                      <div className="text-center p-3 border-2 border-dashed border-gray-200"><div className="text-sm font-black">{filteredEvents.length}</div><div className="text-[9px] font-bold text-gray-500 uppercase">Filtered Events</div></div>
                    </div>
                  </div>
                </section>

                {/* FIELD TILT SECTION */}
                <section>
                  <h3 className="text-xl font-black uppercase border-b-4 border-black inline-block pb-1 mb-6">Field Tilt</h3>
                  <div className="flex h-10 border-4 border-black mb-2 w-full shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <div className="bg-[#0077B6] text-white flex items-center justify-center font-black text-sm" style={{width: `${fieldTiltStats.homeTilt}%`}}>{fieldTiltStats.homeTilt}%</div>
                    <div className="bg-[#D90429] text-white flex items-center justify-center font-black text-sm" style={{width: `${fieldTiltStats.awayTilt}%`}}>{fieldTiltStats.awayTilt}%</div>
                  </div>
                  <div className="flex justify-between text-[10px] font-black uppercase text-gray-500"><span>{match.home_team?.team_name} ({fieldTiltStats.homeActions} actions)</span><span>{match.away_team?.team_name} ({fieldTiltStats.awayActions} actions)</span></div>
                </section>

                {/* AVERAGE POSITIONS */}
                <section>
                  <h3 className="text-xl font-black uppercase border-b-4 border-black inline-block pb-1 mb-6">Average Positions</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div><label className="block mb-1 text-[10px] font-black uppercase text-gray-500">Metric</label><select className="w-full border-2 border-black p-2 font-black text-xs uppercase" value={avgStatType} onChange={e => setAvgStatType(e.target.value)}><option value="ALL_ACTIONS">All Actions</option><option value="PASS">Pass Origin</option><option value="RECEIVE">Pass Receive</option><option value="SHOT">Shots</option><option value="DEFENCE">Defensive Actions</option></select></div>
                    <div className="lg:col-span-3"><label className="block mb-1 text-[10px] font-black uppercase text-gray-500">Time Range</label><div className="flex items-center gap-2"><input type="number" className="w-1/2 border-2 border-black p-2 text-xs font-black" value={avgMinMinute} min={0} max={absoluteMaxMinute} onChange={e => setAvgMinMinute(parseInt(e.target.value)||0)} /><span className="text-xs font-black">TO</span><input type="number" className="w-1/2 border-2 border-black p-2 text-xs font-black" value={avgMaxMinute} min={0} max={absoluteMaxMinute} onChange={e => setAvgMaxMinute(parseInt(e.target.value)||absoluteMaxMinute)} /><span className="text-[10px] font-bold text-gray-400 uppercase">min</span></div></div>
                  </div>
                  <div className="flex flex-wrap gap-8">
                    <AveragePositionsPitch data={avgHomeData} teamName={match.home_team?.team_name} isHome={true} lineups={lineups} isFutsal={isFutsal} />
                    <AveragePositionsPitch data={avgAwayData} teamName={match.away_team?.team_name} isHome={false} lineups={lineups} isFutsal={isFutsal} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                    {[{ flag: 'HOME', team: match.home_team?.team_name, players: filterOptions.homePlayers, selected: avgHomePlayers, color: '#0077B6' }, { flag: 'AWAY', team: match.away_team?.team_name, players: filterOptions.awayPlayers, selected: avgAwayPlayers, color: '#D90429' }].map(t => (
                      <div key={t.flag} className="border-2 border-black p-3 bg-white"><div className="flex justify-between items-center mb-2"><h5 className="text-[10px] font-black uppercase" style={{color: t.color}}>{t.team}</h5><div className="flex gap-1"><button onClick={() => handleSelectAllAvgPlayers(t.flag, true)} className="text-[9px] font-bold uppercase border px-1 hover:bg-gray-100">All</button><button onClick={() => handleSelectAllAvgPlayers(t.flag, false)} className="text-[9px] font-bold uppercase border px-1 hover:bg-gray-100">None</button></div></div><div className="flex flex-wrap gap-1">{t.players.map(p => (<button key={p.player_id} onClick={() => toggleAvgPlayer(t.flag, p.player_id)} className={`text-[10px] font-bold uppercase border-2 border-black px-2 py-0.5 transition-all ${t.selected.includes(p.player_id) ? (t.flag === 'HOME' ? 'bg-[#0077B6] text-white' : 'bg-[#D90429] text-white') : 'bg-white text-black hover:bg-gray-100'}`}>#{p.jersey_no}</button>))}</div></div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'ATTACK' && (
              <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <section>
                  <h3 className="text-xl font-black uppercase border-b-4 border-black inline-block pb-1 mb-6">Shot Maps (xG)</h3>
                  <div className="flex flex-wrap gap-8 mb-8">
                    <ShotMapPitch shots={enrichedEvents.filter(e => e.action === 'Shoot' && e.team_id === match.home_team_id)} teamName={match.home_team?.team_name} isHome={true} lineups={lineups} isFutsal={isFutsal} />
                    <ShotMapPitch shots={enrichedEvents.filter(e => e.action === 'Shoot' && e.team_id === match.away_team_id)} teamName={match.away_team?.team_name} isHome={false} lineups={lineups} isFutsal={isFutsal} />
                  </div>
                  <div className="flex gap-4 text-[10px] font-black uppercase text-gray-500 mb-8">
                    <div className="flex items-center gap-2"><div className="w-5 h-5 rounded-full bg-[#0077B6] border-2 border-black"></div> Goal (Filled)</div>
                    <div className="flex items-center gap-2"><div className="w-5 h-5 rounded-full border-2 border-[#D90429] opacity-50"></div> No Goal (Hollow)</div>
                    <div className="ml-auto italic text-gray-400">* Bubble size = xG value</div>
                  </div>
                </section>
                <section>
                  <h3 className="text-xl font-black uppercase border-b-4 border-black inline-block pb-1 mb-6">Shot Placement (Goal Face)</h3>
                  <div className="flex flex-wrap gap-8 mb-8">
                    <ShotPlacementPitch shots={enrichedEvents.filter(e => e.action === 'Shoot' && e.team_id === match.home_team_id)} teamName={match.home_team?.team_name} isHome={true} lineups={lineups} isFutsal={isFutsal} />
                    <ShotPlacementPitch shots={enrichedEvents.filter(e => e.action === 'Shoot' && e.team_id === match.away_team_id)} teamName={match.away_team?.team_name} isHome={false} lineups={lineups} isFutsal={isFutsal} />
                  </div>
                </section>
                <section>
                  <h3 className="text-xl font-black uppercase border-b-4 border-black inline-block pb-1 mb-6">Attack Statistics</h3>
                  <BrutalistCard>
                    {[{ key: 'attack_shooting', title: 'Shooting & Efficiency' }, { key: 'attack_distribution', title: 'Distribution & Creativity' }, { key: 'attack_ball_progression', title: 'Ball Progression' }, { key: 'attack_pressure', title: 'Performance Under Pressure' }].map(section => (
                      <div key={section.key} className="mb-6 last:mb-0">
                        <h4 className="text-sm font-black uppercase text-gray-300 mb-2 flex items-center gap-2"><Layers size={14}/> {section.title}</h4>
                        {renderStatRows(section.key, attackStats?.home, attackStats?.away)}
                      </div>
                    ))}
                  </BrutalistCard>
                </section>
              </div>
            )}

            {activeTab === 'DEFENSE' && (
              <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <section>
                  <h3 className="text-xl font-black uppercase border-b-4 border-black inline-block pb-1 mb-6">Defensive Density Heatmaps</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div><label className="block mb-1 text-[10px] font-black uppercase text-gray-500">Filter Action</label><select className="w-full border-2 border-black p-2 font-black text-xs uppercase" value={defActionFilter} onChange={handleDefActionChange}><option value="ALL">All Defensive Actions</option>{defActions.map(a => (<option key={a} value={a}>{a}</option>))}</select></div>
                    <div><label className="block mb-1 text-[10px] font-black uppercase text-gray-500">Filter Outcome</label><select className="w-full border-2 border-black p-2 font-black text-xs uppercase" value={defOutcomeFilter} onChange={e => setDefOutcomeFilter(e.target.value)}><option value="ALL">All Outcomes</option>{availableDefOutcomes.map(o => (<option key={o} value={o}>{o}</option>))}</select></div>
                  </div>
                  <div className="flex flex-wrap gap-8">
                    <HeatmapPitch events={enrichedEvents.filter(e => e.team_id === match.home_team_id && (defActionFilter === 'ALL' ? defActions.includes(e.action) : e.action === defActionFilter) && (defOutcomeFilter === 'ALL' || e.outcome === defOutcomeFilter))} teamName={match.home_team?.team_name} isHome={true} isFutsal={isFutsal} />
                    <HeatmapPitch events={enrichedEvents.filter(e => e.team_id === match.away_team_id && (defActionFilter === 'ALL' ? defActions.includes(e.action) : e.action === defActionFilter) && (defOutcomeFilter === 'ALL' || e.outcome === defOutcomeFilter))} teamName={match.away_team?.team_name} isHome={false} isFutsal={isFutsal} />
                  </div>
                </section>
                <section>
                  <h3 className="text-xl font-black uppercase border-b-4 border-black inline-block pb-1 mb-6">Defense Statistics</h3>
                  <BrutalistCard>
                    {[{ key: 'defense_tackling', title: 'Tackling & Interceptions' }, { key: 'defense_blocks', title: 'Blocks & Clearances' }, { key: 'defense_work_rate', title: 'Work Rate & Recoveries' }, { key: 'defense_goalkeeping', title: 'Goalkeeping & Discipline' }].map(section => (
                      <div key={section.key} className="mb-6 last:mb-0">
                        <h4 className="text-sm font-black uppercase text-gray-300 mb-2 flex items-center gap-2"><Shield size={14}/> {section.title}</h4>
                        {renderStatRows(section.key, defenseStats?.home, defenseStats?.away)}
                      </div>
                    ))}
                  </BrutalistCard>
                </section>
              </div>
            )}

            {activeTab === 'PLAYER' && (
              <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="border-b-4 border-black pb-2 mb-8"><h2 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-3"><Users size={32} /> Player Comparison</h2></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <BrutalistCard color="bg-[#f8fafc]">
                    <h4 className="text-[10px] font-black uppercase text-gray-400 mb-2">PLAYER 1 (Blue)</h4>
                    <select className="w-full border-2 border-black p-2 font-black text-xs uppercase mb-2" value={p1TeamId} onChange={e => setP1TeamId(e.target.value)}><option value={match.home_team_id}>{match.home_team?.team_name}</option><option value={match.away_team_id}>{match.away_team?.team_name}</option></select>
                    <select className="w-full border-2 border-black p-2 font-black text-xs uppercase" value={p1PlayerId || ''} onChange={e => setP1PlayerId(e.target.value)}>{p1Options.map(p => (<option key={p.player_id} value={p.player_id}>#{p.jersey_no} {p.players?.player_name}</option>))}</select>
                  </BrutalistCard>
                  <BrutalistCard color="bg-[#f8fafc]">
                    <h4 className="text-[10px] font-black uppercase text-gray-400 mb-2">PLAYER 2 (Red)</h4>
                    <select className="w-full border-2 border-black p-2 font-black text-xs uppercase mb-2" value={p2TeamId} onChange={e => setP2TeamId(e.target.value)}><option value={match.home_team_id}>{match.home_team?.team_name}</option><option value={match.away_team_id}>{match.away_team?.team_name}</option></select>
                    <select className="w-full border-2 border-black p-2 font-black text-xs uppercase" value={p2PlayerId || ''} onChange={e => setP2PlayerId(e.target.value)}>{p2Options.map(p => (<option key={p.player_id} value={p.player_id}>#{p.jersey_no} {p.players?.player_name}</option>))}</select>
                  </BrutalistCard>
                </div>
                {p1Data && p2Data && (
                  <div className="space-y-8">
                    <BrutalistCard className="py-8"><RadarChart p1Data={p1Data} p2Data={p2Data} maxes={matchMaxes} /></BrutalistCard>
                    <BrutalistCard>
                      <h4 className="text-sm font-black uppercase text-gray-300 mb-4 flex items-center gap-2"><Grid size={14}/> Head-to-Head Metrics</h4>
                      <CompareRow label="Total Passes" homeVal={p1Data.stats.passes} awayVal={p2Data.stats.passes} />
                      <CompareRow label="Pass Accuracy" homeVal={`${p1Data.stats.passAcc}%`} awayVal={`${p2Data.stats.passAcc}%`} highlight />
                      <CompareRow label="Total Shots" homeVal={p1Data.stats.shots} awayVal={p2Data.stats.shots} />
                      <CompareRow label="Goals" homeVal={p1Data.stats.goals} awayVal={p2Data.stats.goals} highlight />
                      <CompareRow label="xG" homeVal={p1Data.stats.xg} awayVal={p2Data.stats.xg} />
                      <CompareRow label="Tackles" homeVal={p1Data.stats.tackles} awayVal={p2Data.stats.tackles} />
                      <CompareRow label="Carries" homeVal={p1Data.stats.carries} awayVal={p2Data.stats.carries} />
                      <CompareRow label="Pass Intercepts" homeVal={p1Data.stats.interceptions} awayVal={p2Data.stats.interceptions} />
                    </BrutalistCard>
                  </div>
                )}
                <section>
                  <h3 className="text-xl font-black uppercase border-b-4 border-black inline-block pb-1 mb-6">Match Leaders</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {matchLeaders.map((leader, i) => (<LeaderCard key={i} leader={leader} />))}
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'HIGHLIGHTS' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="border-b-4 border-black pb-2 mb-6"><h2 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-3"><Video size={32} /> Highlights Reel</h2></div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2">
                    <BrutalistCard>
                      {matchVideoUrl ? (
                        matchVideoProvider === 'youtube' ? (
                          <div className="aspect-video w-full border-4 border-black bg-black"><iframe src={`https://www.youtube.com/embed/${getYouTubeId(matchVideoUrl)}?start=${Math.floor(hlSeekTime)}&autoplay=1`} className="w-full h-full" allowFullScreen allow="autoplay" key={hlForceRender}></iframe></div>
                        ) : matchVideoProvider === 'drive' ? (
                          <div className="aspect-video w-full border-4 border-black bg-black"><iframe src={`https://drive.google.com/file/d/${getDriveId(matchVideoUrl)}/preview`} className="w-full h-full" allowFullScreen></iframe></div>
                        ) : (
                          <div className="aspect-video w-full border-4 border-black bg-black"><video ref={videoRef} src={matchVideoUrl} controls className="w-full h-full" /></div>
                        )
                      ) : (
                        <div className="border-4 border-dashed border-gray-300 bg-gray-50 aspect-video w-full flex items-center justify-center"><p className="text-gray-400 font-black uppercase text-sm">No video available for this match</p></div>
                      )}
                    </BrutalistCard>
                    <div className="flex flex-wrap gap-2 mt-4">
                      {hotFilters.map((hf, i) => (<button key={i} onClick={hf.apply} className="text-[10px] font-black uppercase border-2 border-black px-2 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#FFD166] transition-all bg-white">{hf.label}</button>))}
                      <button onClick={() => { setHlAction('ALL'); setHlOutcome('ALL'); setHlType('ALL'); setHlTeam('ALL'); setHlPlayer('ALL'); }} className="text-[10px] font-black uppercase border-2 border-black px-2 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#06D6A0] transition-all bg-white ml-auto">Reset</button>
                    </div>
                  </div>
                  <div>
                    <BrutalistCard className="max-h-[90vh] flex flex-col">
                      <h4 className="text-[10px] font-black uppercase text-gray-400 mb-3 flex items-center gap-1 border-b-2 border-black pb-2"><Clock size={12}/> Event Timeline ({hlFilteredEvents.length})</h4>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <select className="border-2 border-black p-1 font-black text-[10px] uppercase" value={hlTeam} onChange={e => { setHlTeam(e.target.value); setHlPlayer('ALL'); }}><option value="ALL">All Teams</option><option value={match.home_team_id}>{match.home_team?.team_name}</option><option value={match.away_team_id}>{match.away_team?.team_name}</option></select>
                        <select className="border-2 border-black p-1 font-black text-[10px] uppercase" value={hlPlayer} onChange={e => setHlPlayer(e.target.value)}><option value="ALL">All Players</option>{(hlTeam === 'ALL' ? lineups : lineups.filter(l => l.team_id === hlTeam)).map(p => (<option key={p.player_id} value={p.player_id}>#{p.jersey_no} {p.players?.player_name}</option>))}</select>
                        <select className="border-2 border-black p-1 font-black text-[10px] uppercase" value={hlAction} onChange={e => { setHlAction(e.target.value); setHlOutcome('ALL'); setHlType('ALL'); }}><option value="ALL">All Actions</option>{hlFilterOptions.actions.map(a => (<option key={a} value={a}>{a}</option>))}</select>
                        <select className="border-2 border-black p-1 font-black text-[10px] uppercase" value={hlOutcome} onChange={e => { setHlOutcome(e.target.value); setHlType('ALL'); }}><option value="ALL">All Outcomes</option>{hlFilterOptions.outcomes.map(o => (<option key={o} value={o}>{o}</option>))}</select>
                      </div>
                      <div className="flex-1 overflow-y-auto no-scrollbar">
                        {hlFilteredEvents.length === 0 ? (<div className="text-center py-6 text-gray-400 font-bold text-xs uppercase">No events match filters</div>) : (
                          <table className="w-full text-[10px] font-bold uppercase">
                            <thead><tr className="border-b-2 border-black text-left text-gray-500"><th className="py-1 w-12">Time</th><th className="py-1 w-6">T</th><th className="py-1">Player</th><th className="py-1">Action</th><th className="py-1">Outcome</th><th className="py-1">Rx</th></tr></thead>
                            <tbody>
                              {hlFilteredEvents.map((e, i) => {
                                const isHome = e.team_id === match.home_team_id;
                                const pLineup = lineups.find(l => l.player_id === e.player_id);
                                const rLineup = lineups.find(l => l.player_id === e.reaction_player_id);
                                return (
                                  <tr key={i} onClick={() => handleEventClick(e.match_time_seconds)} className="border-b border-gray-200 hover:bg-[#FFD166] cursor-pointer transition-colors">
                                    <td className="py-2 font-black text-black">{Math.floor(e.match_time_seconds / 60)}' {(e.match_time_seconds % 60).toString().padStart(2, '0')}</td>
                                    <td className="py-2"><div className={`w-3 h-3 rounded-full ${isHome ? 'bg-[#0077B6]' : 'bg-[#D90429]'}`}></div></td>
                                    <td className="py-2 truncate max-w-[100px]">{pLineup ? `#${pLineup.jersey_no} ${pLineup.players?.player_name}` : 'Unknown'}</td>
                                    <td className="py-2">{e.action}</td>
                                    <td className="py-2 text-gray-600">{e.outcome} {e.type !== 'NA' ? <span className="text-[9px] font-black text-gray-400 block">{e.type}</span> : ''}</td>
                                    <td className="py-2 truncate max-w-[100px] text-gray-500">{rLineup ? `#${rLineup.jersey_no} ${rLineup.players?.player_name}` : '-'}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </BrutalistCard>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'NOTES' && (
                  <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="border-b-4 border-black pb-2 mb-6 flex items-center justify-between">
                      <h2 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-3">
                        <Edit3 size={32} /> Match Info
                      </h2>
                    </div>
                    <BrutalistCard color="bg-[#FFD166]">
                      <div className="mb-4">
                        <h3 className="text-lg font-black uppercase border-b-2 border-black pb-1 inline-block">Match Details</h3>
                      </div>
                      <div className="space-y-3 text-sm font-bold">
                        <div className="flex justify-between border-b border-dashed border-black/30 pb-2"><span className="text-gray-700 uppercase text-xs">Match Name</span><span>{match.match_name || 'N/A'}</span></div>
                        <div className="flex justify-between border-b border-dashed border-black/30 pb-2"><span className="text-gray-700 uppercase text-xs">Date</span><span>{match.match_date || 'N/A'}</span></div>
                        <div className="flex justify-between border-b border-dashed border-black/30 pb-2"><span className="text-gray-700 uppercase text-xs">Tournament</span><span>{tournamentName}</span></div>
                        <div className="flex justify-between border-b border-dashed border-black/30 pb-2"><span className="text-gray-700 uppercase text-xs">Sport</span><span>{isFutsal ? '⚽ Futsal' : '🏟️ Football'}</span></div>
                        <div className="flex justify-between border-b border-dashed border-black/30 pb-2"><span className="text-gray-700 uppercase text-xs">Score</span><span>{match.home_team?.team_name} {computedScores.home} - {computedScores.away} {match.away_team?.team_name}</span></div>
                        {matchVideoUrl && <div className="flex justify-between border-b border-dashed border-black/30 pb-2"><span className="text-gray-700 uppercase text-xs">Video</span><a href={matchVideoUrl} target="_blank" rel="noreferrer" className="text-[#0077B6] underline truncate max-w-[300px]">{matchVideoUrl}</a></div>}
                        <div className="flex justify-between"><span className="text-gray-700 uppercase text-xs">Total Events</span><span>{enrichedEvents.length}</span></div>
                      </div>
                    </BrutalistCard>
                  </div>
                )}
          </>
        )}
      </main>

      <footer className="mt-20 p-8 border-t-4 border-black text-center text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
        CAC ANALYTICS ENGINE
      </footer>
    </div>
  );
};

export default function App() {
  const [view, setView] = useState('BOOT');
  const [selectedMatch, setSelectedMatch] = useState(null);

  if (view === 'BOOT') return <BootScreen onComplete={() => setView('SELECTION')} />;
  if (view === 'SELECTION') return <SelectionScreen onSelectMatch={(m) => { setSelectedMatch(m); setView('DASHBOARD'); }} />;
  if (view === 'DASHBOARD' && selectedMatch) return <DashboardScreen match={selectedMatch} onBack={() => setView('SELECTION')} />;
  return null;
}
