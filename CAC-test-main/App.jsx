import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ChevronLeft, Activity, Map as MapIcon, Crosshair, 
  Shield, Grid, Terminal, RefreshCw, ClipboardList, 
  Filter, ChevronDown, Layers, Clock, Users, Zap, Target,
  Video, Edit3, Download
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import statsConfig from './src/stats_config.json';

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
// 📊 STATS REGISTRY — defines every available stat row for each section.
// Toggle visibility / order via stats_manager.py (edits src/stats_config.json).
// ============================================================================
const STATS_REGISTRY = {
  // ── SUMMARY (uses stats.home / stats.away) ──────────────────────────────
  "summary_possession":    { label: "Possession",                      getH: (h) => `${h.possession}%`,                              getA: (a) => `${a.possession}%`,                              highlight: true  },
  "summary_xg":            { label: "Expected Goals (xG)",              getH: (h) => h.xg,                                            getA: (a) => a.xg                                                              },
  "summary_shots_sot":     { label: "Shots (SoT)",                      getH: (h) => `${h.shots} (${h.sot})`,                         getA: (a) => `${a.shots} (${a.sot})`                                          },
  "summary_pass_accuracy": { label: "Pass Accuracy (Total Passes)",     getH: (h) => `${h.passAcc}% (${h.passes})`,                   getA: (a) => `${a.passAcc}% (${a.passes})`                                    },
  "summary_fouls":         { label: "Disciplined Play (Fouls)",         getH: (h) => h.fouls,                                         getA: (a) => a.fouls                                                           },

  // ── ATTACK – Shooting & Efficiency (uses attackStats.home / .away) ──────
  "attack_goals":                { label: "Goals",                      getH: (h) => h.goals,                                         getA: (a) => a.goals,                                         highlight: true  },
  "attack_shots_on_target":      { label: "Total Shots (On Target)",    getH: (h) => `${h.shots} (${h.sot})`,                         getA: (a) => `${a.shots} (${a.sot})`                                          },
  "attack_shots_inside_box":     { label: "Shots Inside Box",           getH: (h) => h.boxShots,                                      getA: (a) => a.boxShots                                                        },
  "attack_shots_outside_box":    { label: "Shots Outside Box",          getH: (h) => h.outBoxShots,                                   getA: (a) => a.outBoxShots                                                     },
  "attack_avg_shot_distance":    { label: "Avg Shot Distance (m)",      getH: (h) => h.avgShotDist,                                   getA: (a) => a.avgShotDist                                                     },
  "attack_xg":                   { label: "Expected Goals (xG)",        getH: (h) => h.xg,                                            getA: (a) => a.xg                                                              },
  "attack_xg_per_shot":          { label: "xG Per Shot",                getH: (h) => h.xgPerShot,                                     getA: (a) => a.xgPerShot                                                       },
  "attack_xg_overperformance":   { label: "xG Overperformance",         getH: (h) => h.xgDiff,                                        getA: (a) => a.xgDiff                                                          },

  // ── ATTACK – Distribution & Creativity ───────────────────────────────────
  "attack_assists":             { label: "Assists",                      getH: (h) => h.assists,                                       getA: (a) => a.assists,                                       highlight: true  },
  "attack_key_passes":          { label: "Key Passes",                   getH: (h) => h.keyPasses,                                     getA: (a) => a.keyPasses                                                       },
  "attack_total_passes":        { label: "Total Passes (Accuracy %)",   getH: (h) => `${h.passes} (${h.passAcc}%)`,                   getA: (a) => `${a.passes} (${a.passAcc}%)`                                    },
  "attack_progressive_passes":  { label: "Progressive Passes",          getH: (h) => h.progPasses,                                    getA: (a) => a.progPasses                                                      },
  "attack_through_balls":       { label: "Through Balls",               getH: (h) => h.throughBalls,                                  getA: (a) => a.throughBalls                                                    },
  "attack_crosses":             { label: "Crosses",                      getH: (h) => h.crosses,                                       getA: (a) => a.crosses                                                         },

  // ── ATTACK – Ball Progression ─────────────────────────────────────────────
  "attack_total_carries":         { label: "Total Carries",              getH: (h) => h.carries,                                       getA: (a) => a.carries                                                         },
  "attack_progressive_carries":   { label: "Progressive Carries",        getH: (h) => h.progCarries,                                   getA: (a) => a.progCarries                                                     },
  "attack_carries_final_third":   { label: "Carries into Final 3rd",     getH: (h) => h.final3rdCarries,                               getA: (a) => a.final3rdCarries,                               highlight: true  },
  "attack_dribbles":              { label: "Dribbles (Success %)",        getH: (h) => `${h.dribbles} (${h.dribbleAcc}%)`,             getA: (a) => `${a.dribbles} (${a.dribbleAcc}%)`                               },

  // ── ATTACK – Performance Under Pressure ──────────────────────────────────
  "attack_shots_under_pressure":    { label: "Shots Under Pressure",     getH: (h) => h.shotsUnderPressure,                           getA: (a) => a.shotsUnderPressure,                            highlight: true  },
  "attack_pass_acc_under_pressure": { label: "Pass Acc Under Pressure",  getH: (h) => `${h.pressPassAcc}%`,                           getA: (a) => `${a.pressPassAcc}%`                                              },

  // ── DEFENSE – Tackling & Interceptions (uses defenseStats.home / .away) ─
  "defense_total_tackles":               { label: "Total Tackles (Success %)",    getH: (h) => `${h.totalTackles} (${h.tackleSuccess}%)`,         getA: (a) => `${a.totalTackles} (${a.tackleSuccess}%)`,        highlight: true  },
  "defense_tackles_succ_failed":         { label: "Tackles: Succ / Failed",       getH: (h) => `${h.succTackles} / ${h.failedTackles}`,           getA: (a) => `${a.succTackles} / ${a.failedTackles}`                            },
  "defense_tackles_gaining_poss":        { label: "Tackles Gaining Possession",   getH: (h) => h.tacklesWithPoss,                                  getA: (a) => a.tacklesWithPoss                                                  },
  "defense_total_interceptions":         { label: "Total Interceptions",           getH: (h) => h.totalInterceptions,                               getA: (a) => a.totalInterceptions,                             highlight: true  },
  "defense_interceptions_succ_failed":   { label: "Interceptions: Succ / Failed", getH: (h) => `${h.succInterceptions} / ${h.failedInterceptions}`, getA: (a) => `${a.succInterceptions} / ${a.failedInterceptions}`                },
  "defense_ints_gaining_poss":           { label: "Ints Gaining Possession",      getH: (h) => h.intsWithPoss,                                     getA: (a) => a.intsWithPoss                                                     },

  // ── DEFENSE – Blocks & Clearances ────────────────────────────────────────
  "defense_total_blocks":              { label: "Total Blocks (Successful)",     getH: (h) => `${h.totalBlocks} (${h.succBlocks})`,               getA: (a) => `${a.totalBlocks} (${a.succBlocks})`,             highlight: true  },
  "defense_opp_shots_blocked":         { label: "Opponent Shots Blocked",        getH: (h) => h.oppShotsBlocked,                                  getA: (a) => a.oppShotsBlocked                                                  },
  "defense_total_clearances":          { label: "Total Clearances (Successful)", getH: (h) => `${h.totalClearances} (${h.succClearances})`,       getA: (a) => `${a.totalClearances} (${a.succClearances})`,     highlight: true  },
  "defense_clearances_gaining_poss":   { label: "Clearances Gaining Poss",       getH: (h) => h.clearWithPoss,                                    getA: (a) => a.clearWithPoss                                                    },
  "defense_own_goals":                 { label: "Defensive Own Goals",           getH: (h) => h.blockOwnGoals + h.clearOwnGoals,                  getA: (a) => a.blockOwnGoals + a.clearOwnGoals                                  },

  // ── DEFENSE – Work Rate & Recoveries ─────────────────────────────────────
  "defense_total_defensive_actions":   { label: "Total Defensive Actions",       getH: (h) => h.totalDefensiveActions,                            getA: (a) => a.totalDefensiveActions,                          highlight: true  },
  "defense_defensive_success_rate":    { label: "Defensive Success %",           getH: (h) => `${h.defActionSuccessRate}%`,                       getA: (a) => `${a.defActionSuccessRate}%`                                       },
  "defense_possession_wins":           { label: "Possession Wins",               getH: (h) => h.possessionWins,                                   getA: (a) => a.possessionWins,                                 highlight: true  },
  "defense_total_ball_recoveries":     { label: "Total Ball Recoveries",         getH: (h) => h.ballRecoveries,                                   getA: (a) => a.ballRecoveries                                                   },
  "defense_total_pressures":           { label: "Total Pressures",               getH: (h) => h.totalPressures,                                   getA: (a) => a.totalPressures                                                   },

  // ── DEFENSE – Goalkeeping & Discipline ───────────────────────────────────
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
const SUPABASE_URL = "https://oettovcvpzedbgvswvgh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ldHRvdmN2cHplZGJndnN3dmdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NTMzNjQsImV4cCI6MjA4ODEyOTM2NH0.Ii0ptncoh-b3c4jn5xspWXvyoS3uBSK752XaMBUg2ME";

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

const updateTournamentMatchNote = async (tournamentId, matchId, note) => {
  const url = new URL(`${SUPABASE_URL}/rest/v1/tournament_matches?tournament_id=eq.${tournamentId}&match_id=eq.${matchId}`);
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify({ notes: note })
  });
  if (!res.ok) console.error(`Supabase Error updating notes: ${res.status}`);
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

// ----------------------------------------------------------------------------
// Reusable Component for Side-by-Side Metric Rows
// ----------------------------------------------------------------------------
const CompareRow = ({ label, homeVal, awayVal, highlight = false }) => (
  <div className={`flex items-center justify-between border-b-2 border-dashed border-gray-300 last:border-0 py-2.5 ${highlight ? 'bg-[#FFD166] -mx-4 px-4 border-solid border-black border-y-2' : ''}`}>
    <div className="w-1/3 text-left font-black text-lg text-[#0077B6]">{homeVal}</div>
    <div className="w-1/3 text-center text-[10px] sm:text-[11px] font-black uppercase text-gray-500 tracking-widest leading-tight">{label}</div>
    <div className="w-1/3 text-right font-black text-lg text-[#D90429]">{awayVal}</div>
  </div>
);

// ============================================================================
// 🗺️ FUTSAL DISTRIBUTION COMPONENT (SCATTER)
// ============================================================================
const FutsalDistributionPitch = ({ filteredEvents, homeTeamId, lineups }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, transform: "", event: null });

  const pitchWidth = 40;
  const pitchHeight = 20;

  const drawPitch = (ctx, w, h) => {
    const pad = 30;
    const drawW = w - (pad * 2);
    const drawH = h - (pad * 2);

    const scaleX = (x) => pad + (x / pitchWidth) * drawW;
    const scaleY = (y) => h - (pad + (y / pitchHeight) * drawH);

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(pad, pad, drawW, drawH);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 3;
    ctx.strokeRect(pad, pad, drawW, drawH);
    
    ctx.beginPath();
    ctx.moveTo(scaleX(20), scaleY(0));
    ctx.lineTo(scaleX(20), scaleY(20));
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(scaleX(20), scaleY(10), (3 / pitchWidth) * drawW, 0, Math.PI * 2);
    ctx.stroke();

    const dRadius = (6 / pitchWidth) * drawW;
    ctx.beginPath();
    ctx.arc(scaleX(0), scaleY(10), dRadius, -Math.PI/2, Math.PI/2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(scaleX(40), scaleY(10), dRadius, Math.PI/2, -Math.PI/2);
    ctx.stroke();

    ctx.fillStyle = "#000";
    [6, 10, 30, 34].forEach(x => {
      ctx.beginPath();
      ctx.arc(scaleX(x), scaleY(10), 3, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.strokeStyle = "#D90429";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(scaleX(0), scaleY(8.5));
    ctx.lineTo(scaleX(0), scaleY(11.5));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(scaleX(40), scaleY(8.5));
    ctx.lineTo(scaleX(40), scaleY(11.5));
    ctx.stroke();

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
      canvas.height = container.clientWidth * 0.55;
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
      
      if (dist < minDistance) {
        minDistance = dist;
        closestEvent = ev;
      }
    });

    if (closestEvent) {
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      
      let tX = cursorX;
      let tY = cursorY - 15;
      let transform = "transform -translate-x-1/2 -translate-y-full";

      if (cursorY < 120) {
        tY = cursorY + 20;
        transform = "transform -translate-x-1/2";
      }

      if (cursorX < 110) {
        transform = transform.replace("-translate-x-1/2", "translate-x-0");
        tX = cursorX + 15;
      } else if (cursorX > rect.width - 110) {
        transform = transform.replace("-translate-x-1/2", "-translate-x-full");
        tX = cursorX - 15;
      }

      setTooltip({ 
        visible: true, 
        x: tX, 
        y: tY, 
        transform: transform,
        event: closestEvent 
      });
    } else {
      setTooltip({ visible: false, x: 0, y: 0, transform: "", event: null });
    }
  };

  const handleMouseLeave = () => {
    setTooltip({ visible: false, x: 0, y: 0, transform: "", event: null });
  };

  const formatTime = (secs) => {
    if (!secs) return "0:00";
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getPlayerDisplay = (playerId) => {
    if (!playerId) return "N/A";
    const p = lineups.find(l => l.player_id === playerId);
    return p ? `#${p.jersey_no || '-'} ${p.players?.player_name}` : "Unknown";
  };

  return (
    <div ref={containerRef} className="w-full border-4 border-black bg-white relative cursor-crosshair mb-4">
      <div className="absolute top-2 left-2 bg-white border-2 border-black px-2 py-1 text-[10px] font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] z-10 flex items-center gap-1">
        <MapIcon size={12}/> Scatter Telemetry
      </div>
      <canvas 
        ref={canvasRef} 
        className="w-full block" 
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
      
      {tooltip.visible && tooltip.event && (
        <div 
          className={`absolute z-20 bg-[#FFD166] border-2 border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] pointer-events-none min-w-[200px] transition-all duration-75 ${tooltip.transform}`}
          style={{ left: tooltip.x, top: tooltip.y }}
        >
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
const AveragePositionsPitch = ({ data, teamName, isHome, lineups }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, transform: "", playerInfo: null });

  const pitchWidth = 40;
  const pitchHeight = 20;

  const drawPitch = (ctx, w, h) => {
    const pad = 30;
    const drawW = w - (pad * 2);
    const drawH = h - (pad * 2);

    const scaleX = (x) => pad + (x / pitchWidth) * drawW;
    const scaleY = (y) => h - (pad + (y / pitchHeight) * drawH);

    // Clear & background
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(pad, pad, drawW, drawH);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 3;
    ctx.strokeRect(pad, pad, drawW, drawH);
    
    // Midline
    ctx.beginPath();
    ctx.moveTo(scaleX(20), scaleY(0));
    ctx.lineTo(scaleX(20), scaleY(20));
    ctx.stroke();
    
    // Center Circle
    ctx.beginPath();
    ctx.arc(scaleX(20), scaleY(10), (3 / pitchWidth) * drawW, 0, Math.PI * 2);
    ctx.stroke();

    // D-Zones
    const dRadius = (6 / pitchWidth) * drawW;
    ctx.beginPath();
    ctx.arc(scaleX(0), scaleY(10), dRadius, -Math.PI/2, Math.PI/2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(scaleX(40), scaleY(10), dRadius, Math.PI/2, -Math.PI/2);
    ctx.stroke();

    // Goal Lines
    ctx.strokeStyle = "#D90429";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(scaleX(0), scaleY(8.5));
    ctx.lineTo(scaleX(0), scaleY(11.5));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(scaleX(40), scaleY(8.5));
    ctx.lineTo(scaleX(40), scaleY(11.5));
    ctx.stroke();

    // Nodes
    const primaryColor = isHome ? '#0077B6' : '#D90429';
    
    data.forEach(p => {
      const pX = scaleX(p.avgX);
      const pY = scaleY(p.avgY);
      const isHovered = tooltip.playerInfo && tooltip.playerInfo.playerId === p.playerId;

      // Circle
      ctx.beginPath();
      ctx.arc(pX, pY, isHovered ? 14 : 12, 0, Math.PI * 2);
      ctx.fillStyle = primaryColor;
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Jersey Number
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
      canvas.height = container.clientWidth * 0.6; // Slightly taller aspect ratio for dual display
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
      if (dist < 14) {
        hoveredPlayer = p;
      }
    });

    if (hoveredPlayer) {
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      
      let tX = cursorX;
      let tY = cursorY - 15;
      let transform = "transform -translate-x-1/2 -translate-y-full";

      if (cursorY < 120) {
        tY = cursorY + 20;
        transform = "transform -translate-x-1/2";
      }

      if (cursorX < 110) {
        transform = transform.replace("-translate-x-1/2", "translate-x-0");
        tX = cursorX + 15;
      } else if (cursorX > rect.width - 110) {
        transform = transform.replace("-translate-x-1/2", "-translate-x-full");
        tX = cursorX - 15;
      }

      setTooltip({ 
        visible: true, 
        x: tX, 
        y: tY, 
        transform: transform,
        playerInfo: hoveredPlayer 
      });
    } else {
      setTooltip({ visible: false, x: 0, y: 0, transform: "", playerInfo: null });
    }
  };

  const getPlayerName = (pid) => {
    const l = lineups.find(x => x.player_id === pid);
    return l ? l.players?.player_name : "Unknown";
  };

  return (
    <div ref={containerRef} className="flex-1 min-w-[300px] border-4 border-black bg-white relative cursor-crosshair">
      <div className={`absolute top-2 left-2 ${isHome ? 'bg-[#0077B6]' : 'bg-[#D90429]'} text-white border-2 border-black px-2 py-1 text-[10px] font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] z-10 flex items-center gap-1`}>
        {teamName}
      </div>
      
      <canvas 
        ref={canvasRef} 
        className="w-full block" 
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip({ visible: false, x: 0, y: 0, transform: "", playerInfo: null })}
      />

      {tooltip.visible && tooltip.playerInfo && (
        <div 
          className={`absolute z-50 bg-[#FFD166] border-2 border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] pointer-events-none min-w-[180px] transition-all duration-75 ${tooltip.transform}`}
          style={{ left: tooltip.x, top: tooltip.y }}
        >
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
const ShotMapPitch = ({ shots, teamName, isHome, lineups }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, transform: "", shot: null });

  const pitchWidth = 40;
  const pitchHeight = 20;

  // Calculates radius based on xG value
  const getRadiusForXg = (xgValue) => {
    const minRadius = 4;
    const maxRadius = 18;
    const val = parseFloat(xgValue) || 0.05; // Fallback to small size if null
    return minRadius + (val * (maxRadius - minRadius));
  };

  const drawPitch = (ctx, w, h) => {
    const pad = 30;
    const drawW = w - (pad * 2);
    const drawH = h - (pad * 2);

    const scaleX = (x) => pad + (x / pitchWidth) * drawW;
    const scaleY = (y) => h - (pad + (y / pitchHeight) * drawH);

    // Clear & background
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(pad, pad, drawW, drawH);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 3;
    ctx.strokeRect(pad, pad, drawW, drawH);
    
    // Midline
    ctx.beginPath();
    ctx.moveTo(scaleX(20), scaleY(0));
    ctx.lineTo(scaleX(20), scaleY(20));
    ctx.stroke();
    
    // Center Circle
    ctx.beginPath();
    ctx.arc(scaleX(20), scaleY(10), (3 / pitchWidth) * drawW, 0, Math.PI * 2);
    ctx.stroke();

    // D-Zones
    const dRadius = (6 / pitchWidth) * drawW;
    ctx.beginPath();
    ctx.arc(scaleX(0), scaleY(10), dRadius, -Math.PI/2, Math.PI/2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(scaleX(40), scaleY(10), dRadius, Math.PI/2, -Math.PI/2);
    ctx.stroke();

    // Goal Lines
    ctx.strokeStyle = "#D90429";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(scaleX(0), scaleY(8.5));
    ctx.lineTo(scaleX(0), scaleY(11.5));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(scaleX(40), scaleY(8.5));
    ctx.lineTo(scaleX(40), scaleY(11.5));
    ctx.stroke();

    // Shots
    const primaryColor = isHome ? '#0077B6' : '#D90429';

    // Sort so smaller shots are drawn on top of bigger ones
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
        ctx.fillStyle = primaryColor;
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = isHovered ? 3 : 2;
        ctx.stroke();
      } else {
        // Semi-transparent for non-goals
        ctx.fillStyle = `${primaryColor}66`; // Approx 40% opacity
        ctx.fill();
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = isHovered ? 2.5 : 1.5;
        ctx.stroke();
      }
    });
  };

  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current || !containerRef.current) return;
      const canvas = canvasRef.current;
      const container = containerRef.current;
      canvas.width = container.clientWidth;
      canvas.height = container.clientWidth * 0.6; // Slightly taller aspect ratio for dual display
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
    
    // Reverse sort for hover detection (topmost smaller elements picked first)
    const sortedShots = [...shots].sort((a, b) => (parseFloat(a.xg) || 0) - (parseFloat(b.xg) || 0));

    for (let s of sortedShots) {
      if (s.start_x === null || s.start_y === null) continue;
      const evX = scaleX(s.start_x);
      const evY = scaleY(s.start_y);
      const radius = getRadiusForXg(s.xg);
      
      const dist = Math.sqrt(Math.pow(mouseX - evX, 2) + Math.pow(mouseY - evY, 2));
      // Give a tiny padding margin to the radius for easier hovering
      if (dist <= radius + 2) {
        hoveredShot = s;
        break; // Stop at first topmost hit
      }
    }

    if (hoveredShot) {
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      
      let tX = cursorX;
      let tY = cursorY - 15;
      let transform = "transform -translate-x-1/2 -translate-y-full";

      if (cursorY < 120) {
        tY = cursorY + 20;
        transform = "transform -translate-x-1/2";
      }

      if (cursorX < 110) {
        transform = transform.replace("-translate-x-1/2", "translate-x-0");
        tX = cursorX + 15;
      } else if (cursorX > rect.width - 110) {
        transform = transform.replace("-translate-x-1/2", "-translate-x-full");
        tX = cursorX - 15;
      }

      setTooltip({ 
        visible: true, 
        x: tX, 
        y: tY, 
        transform: transform,
        shot: hoveredShot 
      });
    } else {
      setTooltip({ visible: false, x: 0, y: 0, transform: "", shot: null });
    }
  };

  const getPlayerName = (pid) => {
    const l = lineups.find(x => x.player_id === pid);
    return l ? l.players?.player_name : "Unknown";
  };

  return (
    <div ref={containerRef} className="flex-1 min-w-[300px] border-4 border-black bg-white relative cursor-crosshair">
      <div className={`absolute top-2 left-2 ${isHome ? 'bg-[#0077B6]' : 'bg-[#D90429]'} text-white border-2 border-black px-2 py-1 text-[10px] font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] z-10 flex flex-col`}>
        <span>{teamName}</span>
      </div>
      
      <canvas 
        ref={canvasRef} 
        className="w-full block" 
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip({ visible: false, x: 0, y: 0, transform: "", shot: null })}
      />

      {tooltip.visible && tooltip.shot && (
        <div 
          className={`absolute z-50 bg-[#FFD166] border-2 border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] pointer-events-none min-w-[180px] transition-all duration-75 ${tooltip.transform}`}
          style={{ left: tooltip.x, top: tooltip.y }}
        >
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
const ShotPlacementPitch = ({ shots, teamName, isHome, lineups }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, transform: "", shot: null });

  // Calculates radius based on xG value
  const getRadiusForXg = (xgValue) => {
    const minRadius = 4;
    const maxRadius = 18;
    const val = parseFloat(xgValue) || 0.05;
    return minRadius + (val * (maxRadius - minRadius));
  };

  const drawPitch = (ctx, w, h) => {
    const pad = 30;
    const drawW = w - (pad * 2);
    const drawH = h - (pad * 2);

    // Goal Frame View Settings
    // Y represents horizontal pitch width (Futsal center is 10, goal is 8.5 to 11.5)
    // We display Y from 3 to 17 to capture off-target shots
    const viewMinY = 3;
    const viewMaxY = 17;
    const viewRangeY = viewMaxY - viewMinY;
    
    // Z represents height (Goal is 0 to 2m high)
    // We display Z from -0.5 to 3.5 to show some ground and shots going over
    const viewMinZ = -0.5;
    const viewMaxZ = 3.5;
    const viewRangeZ = viewMaxZ - viewMinZ;

    const scaleY = (y) => pad + ((y - viewMinY) / viewRangeY) * drawW;
    const scaleZ = (z) => pad + drawH - ((z - viewMinZ) / viewRangeZ) * drawH;

    // Clear & background
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(pad, pad, drawW, drawH);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 3;
    ctx.strokeRect(pad, pad, drawW, drawH);
    
    // Ground Line
    ctx.beginPath();
    ctx.moveTo(pad, scaleZ(0));
    ctx.lineTo(w - pad, scaleZ(0));
    ctx.strokeStyle = "#d1d5db";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash

    // Goal Frame (8.5 to 11.5 on Y axis, 0 to 2 on Z axis)
    ctx.beginPath();
    ctx.moveTo(scaleY(8.5), scaleZ(0));
    ctx.lineTo(scaleY(8.5), scaleZ(2));
    ctx.lineTo(scaleY(11.5), scaleZ(2));
    ctx.lineTo(scaleY(11.5), scaleZ(0));
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 6;
    ctx.stroke();

    // Goal Net (Faint gray lines)
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let i=8.75; i<11.5; i+=0.25) {
        ctx.moveTo(scaleY(i), scaleZ(0));
        ctx.lineTo(scaleY(i), scaleZ(2));
    }
    for(let j=0.25; j<2; j+=0.25) {
        ctx.moveTo(scaleY(8.5), scaleZ(j));
        ctx.lineTo(scaleY(11.5), scaleZ(j));
    }
    ctx.stroke();

    // Shots Placement
    const primaryColor = isHome ? '#0077B6' : '#D90429';

    // Sort so smaller shots are drawn on top of bigger ones
    const sortedShots = [...shots].sort((a, b) => (parseFloat(b.xg) || 0) - (parseFloat(a.xg) || 0));
    
    sortedShots.forEach(s => {
      if (s.end_y === null || s.end_z === null) return;
      
      const pY = scaleY(s.end_y);
      const pZ = scaleZ(s.end_z);

      // Clip roughly to our draw area to prevent spilling wildly outside
      if (pY < pad - 10 || pY > w - pad + 10 || pZ < pad - 10 || pZ > h - pad + 10) return;

      const radius = getRadiusForXg(s.xg);
      const isHovered = tooltip.shot && tooltip.shot.processed_event_id === s.processed_event_id;
      const isGoal = s.outcome === 'Goal';

      ctx.beginPath();
      ctx.arc(pY, pZ, isHovered ? radius + 2 : radius, 0, Math.PI * 2);
      
      if (isGoal) {
        ctx.fillStyle = primaryColor;
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = isHovered ? 3 : 2;
        ctx.stroke();
      } else {
        // Semi-transparent for non-goals
        ctx.fillStyle = `${primaryColor}66`; // Approx 40% opacity
        ctx.fill();
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = isHovered ? 2.5 : 1.5;
        ctx.stroke();
      }
    });
  };

  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current || !containerRef.current) return;
      const canvas = canvasRef.current;
      const container = containerRef.current;
      canvas.width = container.clientWidth;
      canvas.height = container.clientWidth * 0.4; // 14:4 aspect ratio approx
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
    
    const viewMinY = 3;
    const viewMaxY = 17;
    const viewRangeY = viewMaxY - viewMinY;
    const viewMinZ = -0.5;
    const viewMaxZ = 3.5;
    const viewRangeZ = viewMaxZ - viewMinZ;

    const scaleY = (y) => pad + ((y - viewMinY) / viewRangeY) * drawW;
    const scaleZ = (z) => pad + drawH - ((z - viewMinZ) / viewRangeZ) * drawH;

    let hoveredShot = null;
    
    // Reverse sort for hover detection (topmost smaller elements picked first)
    const sortedShots = [...shots].sort((a, b) => (parseFloat(a.xg) || 0) - (parseFloat(b.xg) || 0));

    for (let s of sortedShots) {
      if (s.end_y === null || s.end_z === null) continue;
      const evY = scaleY(s.end_y);
      const evZ = scaleZ(s.end_z);
      const radius = getRadiusForXg(s.xg);
      
      const dist = Math.sqrt(Math.pow(mouseX - evY, 2) + Math.pow(mouseY - evZ, 2));
      // Give a tiny padding margin to the radius for easier hovering
      if (dist <= radius + 2) {
        hoveredShot = s;
        break; // Stop at first topmost hit
      }
    }

    if (hoveredShot) {
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      
      let tX = cursorX;
      let tY = cursorY - 15;
      let transform = "transform -translate-x-1/2 -translate-y-full";

      if (cursorY < 120) {
        tY = cursorY + 20;
        transform = "transform -translate-x-1/2";
      }

      if (cursorX < 110) {
        transform = transform.replace("-translate-x-1/2", "translate-x-0");
        tX = cursorX + 15;
      } else if (cursorX > rect.width - 110) {
        transform = transform.replace("-translate-x-1/2", "-translate-x-full");
        tX = cursorX - 15;
      }

      setTooltip({ 
        visible: true, 
        x: tX, 
        y: tY, 
        transform: transform,
        shot: hoveredShot 
      });
    } else {
      setTooltip({ visible: false, x: 0, y: 0, transform: "", shot: null });
    }
  };

  const getPlayerName = (pid) => {
    const l = lineups.find(x => x.player_id === pid);
    return l ? l.players?.player_name : "Unknown";
  };

  return (
    <div ref={containerRef} className="flex-1 min-w-[300px] border-4 border-black bg-white relative cursor-crosshair">
      <div className={`absolute top-2 left-2 ${isHome ? 'bg-[#0077B6]' : 'bg-[#D90429]'} text-white border-2 border-black px-2 py-1 text-[10px] font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] z-10 flex flex-col`}>
        <span>{teamName}</span>
      </div>
      
      <canvas 
        ref={canvasRef} 
        className="w-full block" 
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip({ visible: false, x: 0, y: 0, transform: "", shot: null })}
      />

      {tooltip.visible && tooltip.shot && (
        <div 
          className={`absolute z-50 bg-[#FFD166] border-2 border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] pointer-events-none min-w-[180px] transition-all duration-75 ${tooltip.transform}`}
          style={{ left: tooltip.x, top: tooltip.y }}
        >
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
const HeatmapPitch = ({ events, teamName, isHome }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const pitchWidth = 40;
  const pitchHeight = 20;

  const drawPitch = (ctx, w, h) => {
    const pad = 30;
    const drawW = w - (pad * 2);
    const drawH = h - (pad * 2);

    const scaleX = (x) => pad + (x / pitchWidth) * drawW;
    const scaleY = (y) => h - (pad + (y / pitchHeight) * drawH);

    // Clear & background
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(pad, pad, drawW, drawH);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 3;
    ctx.strokeRect(pad, pad, drawW, drawH);
    
    // Midline
    ctx.beginPath();
    ctx.moveTo(scaleX(20), scaleY(0));
    ctx.lineTo(scaleX(20), scaleY(20));
    ctx.stroke();
    
    // Center Circle
    ctx.beginPath();
    ctx.arc(scaleX(20), scaleY(10), (3 / pitchWidth) * drawW, 0, Math.PI * 2);
    ctx.stroke();

    // D-Zones
    const dRadius = (6 / pitchWidth) * drawW;
    ctx.beginPath();
    ctx.arc(scaleX(0), scaleY(10), dRadius, -Math.PI/2, Math.PI/2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(scaleX(40), scaleY(10), dRadius, Math.PI/2, -Math.PI/2);
    ctx.stroke();

    // Goal Lines
    ctx.strokeStyle = "#D90429";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(scaleX(0), scaleY(8.5));
    ctx.lineTo(scaleX(0), scaleY(11.5));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(scaleX(40), scaleY(8.5));
    ctx.lineTo(scaleX(40), scaleY(11.5));
    ctx.stroke();

    // Density plotting
    const primaryRGB = isHome ? '0, 119, 182' : '217, 4, 41';

    // Enable multiply composition to build up density visually
    ctx.globalCompositeOperation = 'multiply';

    events.forEach(s => {
      if (s.start_x === null || s.start_y === null) return;
      const pX = scaleX(s.start_x);
      const pY = scaleY(s.start_y);
      // Roughly a 4 meter radius for kernel influence
      const radius = (4 / pitchWidth) * drawW;

      const grad = ctx.createRadialGradient(pX, pY, 0, pX, pY, radius);
      grad.addColorStop(0, `rgba(${primaryRGB}, 0.35)`);
      grad.addColorStop(1, `rgba(${primaryRGB}, 0)`);

      ctx.beginPath();
      ctx.arc(pX, pY, radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    });

    // Reset composition state
    ctx.globalCompositeOperation = 'source-over';
  };

  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current || !containerRef.current) return;
      const canvas = canvasRef.current;
      const container = containerRef.current;
      canvas.width = container.clientWidth;
      canvas.height = container.clientWidth * 0.6; // Maintains dual-pitch display aspect ratio
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
      { key: 'interceptions', label: 'Pass Intercepts' } // Updated label!
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
        {/* Adjusted viewBox padding (-60) to prevent long labels like 'Pass Intercepts' from getting clipped */}
        <svg viewBox={`-60 -60 ${size + 120} ${size + 120}`} className="w-full h-full overflow-visible">
            {/* Webs */}
            {levels.map((level, levelIdx) => (
                <polygon 
                    key={`level-${levelIdx}`}
                    points={metrics.map((_, i) => getPoint(level, 1, i)).join(' ')}
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="1"
                    strokeDasharray={level < 1 ? "2,2" : ""}
                />
            ))}

            {/* Axes */}
            {metrics.map((_, i) => {
                const angle = (Math.PI * 2 * i) / metrics.length - Math.PI / 2;
                return (
                    <line 
                        key={`axis-${i}`}
                        x1={center} y1={center}
                        x2={center + radius * Math.cos(angle)}
                        y2={center + radius * Math.sin(angle)}
                        stroke="#e5e7eb"
                        strokeWidth="1"
                    />
                );
            })}

            {/* Labels */}
            {metrics.map((m, i) => {
                const angle = (Math.PI * 2 * i) / metrics.length - Math.PI / 2;
                const labelR = radius * 1.25;
                const x = center + labelR * Math.cos(angle);
                const y = center + labelR * Math.sin(angle);
                
                let anchor = "middle";
                if (Math.abs(Math.cos(angle)) > 0.1) {
                    anchor = Math.cos(angle) > 0 ? "start" : "end";
                }

                return (
                    <text 
                        key={`label-${i}`} 
                        x={x} y={y} 
                        textAnchor={anchor} 
                        dominantBaseline="middle"
                        fontSize="11"
                        fontWeight="bold"
                        fill="#374151"
                        className="uppercase"
                    >
                        {m.label}
                    </text>
                );
            })}

            {/* Player 1 Polygon (Blue) */}
            <polygon points={p1Points} fill="rgba(0, 119, 182, 0.25)" stroke="#0077B6" strokeWidth="2" />

            {/* Player 2 Polygon (Red) */}
            <polygon points={p2Points} fill="rgba(217, 4, 41, 0.25)" stroke="#D90429" strokeWidth="2" />
            
            {/* Player 1 Points - Interactive */}
            {metrics.map((m, i) => {
                const pt = getPoint(p1Data.stats[m.key], maxes[m.key], i).split(',');
                return (
                    <circle 
                        key={`p1-pt-${i}`} cx={pt[0]} cy={pt[1]} r="5" fill="#0077B6" 
                        className="cursor-crosshair transition-all duration-100 hover:r-[8px]"
                        onMouseEnter={() => setTooltip({ player: p1Data.info.players?.player_name, val: p1Data.stats[m.key], max: maxes[m.key], metric: m.label, color: '#0077B6' })}
                        onMouseLeave={() => setTooltip(null)}
                    />
                );
            })}

            {/* Player 2 Points - Interactive */}
            {metrics.map((m, i) => {
                const pt = getPoint(p2Data.stats[m.key], maxes[m.key], i).split(',');
                return (
                    <circle 
                        key={`p2-pt-${i}`} cx={pt[0]} cy={pt[1]} r="5" fill="#D90429" 
                        className="cursor-crosshair transition-all duration-100 hover:r-[8px]"
                        onMouseEnter={() => setTooltip({ player: p2Data.info.players?.player_name, val: p2Data.stats[m.key], max: maxes[m.key], metric: m.label, color: '#D90429' })}
                        onMouseLeave={() => setTooltip(null)}
                    />
                );
            })}
        </svg>

        {/* Dynamic Tooltip UI Overlay */}
        {tooltip && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-4 bg-white border-2 border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-20 whitespace-nowrap pointer-events-none transition-all duration-75 animate-in zoom-in-95">
            <div className="text-[10px] font-black uppercase text-gray-500 border-b-2 border-black pb-1 mb-2">
              {tooltip.metric} Overview
            </div>
            <div className="text-sm font-bold flex flex-col gap-1">
              <span className="uppercase" style={{ color: tooltip.color }}>
                {tooltip.player}
              </span>
              <div className="text-black">
                 Player Value: <span className="font-black text-lg">{tooltip.val}</span>
                 <span className="text-[10px] text-gray-500 ml-2">(Match Max: {tooltip.max})</span>
              </div>
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
        
        {/* Front */}
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
            <div className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${topPlayer.isHome ? 'text-[#0077B6]' : 'text-[#D90429]'}`}>
              {topPlayer.teamName}
            </div>
          </div>
        </div>

        {/* Back */}
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
  const fullText = "> INITIATING CAC FUTSAL CORE...\n> LOADING TOURNAMENT CONFIG...\n> CONNECTING TO PROCESSED_MATCH_EVENTS...\n> MAPPING COURT COORDINATES...\n> READY.";

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setText(fullText.slice(0, i));
      i++;
      if (i > fullText.length) {
        clearInterval(interval);
        setTimeout(onComplete, 800);
      }
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

const SelectionScreen = ({ onSelectMatch }) => {
  const [matches, setMatches] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tournamentFilter, setTournamentFilter] = useState('ALL');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [matchesData, tournamentsData] = await Promise.all([
          fetchSupabase('matches', {
            select: 'match_id,home_team_id,away_team_id,match_date,detail,home_score,away_score,status,home_team:teams!fk_matches_home(team_name),away_team:teams!fk_matches_away(team_name),tournament_matches(tournament_id,video_url,video_provider,notes,tournaments(tournament_name))',
            status: 'eq.Published',
            order: 'match_date.desc'
          }),
          fetchSupabase('tournaments', {
            select: 'tournament_id,tournament_name',
            order: 'tournament_name.asc'
          })
        ]);
        setMatches(matchesData || []);
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
    if (tournamentFilter === 'ALL') return matches;
    return matches.filter(m => 
      m.tournament_matches?.some(tm => tm.tournament_id === tournamentFilter)
    );
  }, [matches, tournamentFilter]);

  return (
    <div className="min-h-screen bg-[#f8fafc] p-8 font-mono">
      <header className="border-b-4 border-black pb-4 mb-8">
        <h1 className="text-4xl font-black uppercase tracking-tighter flex items-center gap-3">
          <Terminal size={36} /> CAC FUTSAL PORTAL
        </h1>
        
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-4">
           <div className="flex items-center gap-2 text-gray-600 font-bold">
             <ChevronDown size={20} className="text-black" />
             <span>SELECT TOURNAMENT:</span>
           </div>
           <select 
             className="bg-white border-2 border-black p-2 font-black uppercase text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:translate-x-[2px] focus:translate-y-[2px] focus:shadow-none transition-all cursor-pointer min-w-[240px]"
             value={tournamentFilter}
             onChange={(e) => setTournamentFilter(e.target.value)}
           >
             <option value="ALL">ALL TOURNAMENTS</option>
             {tournaments.map(t => (
               <option key={t.tournament_id} value={t.tournament_id}>{t.tournament_name}</option>
             ))}
           </select>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center gap-3 text-xl font-bold uppercase"><RefreshCw className="animate-spin" /> Fetching...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 max-w-7xl">
          {filteredMatches.length > 0 ? filteredMatches.map((m) => (
            <BrutalistCard key={m.match_id} className="flex flex-col hover:-translate-y-1 transition-all">
              <div className="bg-[#FFD166] border-2 border-black px-2 py-1 text-[10px] font-black uppercase inline-block self-start mb-4">
                {m.tournament_matches?.[0]?.tournaments?.tournament_name || "FUTSAL_MATCH_REPORT"}
              </div>
              <h2 className="text-xl font-black uppercase mb-1">
                {m.home_team?.team_name} <span className="text-[#0077B6]">{m.home_score}</span> : <span className="text-[#D90429]">{m.away_score}</span> {m.away_team?.team_name}
              </h2>
              <p className="text-xs font-bold text-gray-400 mb-6">{m.match_date} • {m.detail}</p>
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
              <span className="text-[10px] font-black text-gray-400 uppercase w-8 text-right">{p.players?.position || 'POS'}</span>
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
              <span className="text-[10px] font-black text-gray-400 uppercase w-8 text-right">{p.players?.position || 'SUB'}</span>
            </div>
          )) : <div className="text-xs font-bold text-gray-300 uppercase">None Registered</div>}
        </div>
      </section>

      {roster.staff.length > 0 && (
        <section className="pt-4 border-t-2 border-dashed border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Shield size={16} className="text-gray-400" />
            <span className="text-[10px] font-black uppercase tracking-tighter text-gray-400">Technical Staff</span>
          </div>
          {roster.staff.map((p, idx) => (
            <div key={idx} className="text-xs font-black uppercase tracking-widest">
              {p.players?.player_name} <span className="text-gray-400 text-[10px] ml-2 font-normal">(Manager)</span>
            </div>
          ))}
        </section>
      )}
    </div>
  </BrutalistCard>
);

const DashboardScreen = ({ match, onBack }) => {
  const [events, setEvents] = useState([]);
  const [playerStats, setPlayerStats] = useState([]);
  const [lineups, setLineups] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('SUMMARY');
  
  // Standard Scatter Distribution Filters
  const [distTeam, setDistTeam] = useState('ALL');
  const [distPlayer, setDistPlayer] = useState('ALL');
  const [distAction, setDistAction] = useState('ALL');
  const [distOutcome, setDistOutcome] = useState('ALL');
  const [distType, setDistType] = useState('ALL');
  const [minMinute, setMinMinute] = useState(0);
  const [maxMinute, setMaxMinute] = useState(40); 

  // --- AVERAGE POSITIONS STATE ---
  const [avgStatType, setAvgStatType] = useState('ALL_ACTIONS'); 
  const [avgMinMinute, setAvgMinMinute] = useState(0);
  const [avgMaxMinute, setAvgMaxMinute] = useState(40);
  const [avgHomePlayers, setAvgHomePlayers] = useState([]);
  const [avgAwayPlayers, setAvgAwayPlayers] = useState([]);

  // --- DEFENSE HEATMAP STATE ---
  const [defActionFilter, setDefActionFilter] = useState('ALL');
  const [defOutcomeFilter, setDefOutcomeFilter] = useState('ALL');
  const defActions = useMemo(() => ['Standing Tackle', 'Sliding Tackle', 'Block', 'Save', 'Pass Intercept'], []);
  
  const availableDefOutcomes = useMemo(() => {
    const outcomes = new Set();
    if (defActionFilter === 'ALL') {
      defActions.forEach(action => {
        if (CAC_LOGIC[action]) {
          Object.keys(CAC_LOGIC[action]).forEach(o => outcomes.add(o));
        }
      });
    } else {
      if (CAC_LOGIC[defActionFilter]) {
        Object.keys(CAC_LOGIC[defActionFilter]).forEach(o => outcomes.add(o));
      }
    }
    return Array.from(outcomes).sort();
  }, [defActions, defActionFilter]);

  const handleDefActionChange = (e) => {
    setDefActionFilter(e.target.value);
    setDefOutcomeFilter('ALL');
  };

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
  const [hlForceRender, setHlForceRender] = useState(0); // for youtube iframe re-renders
  const videoRef = useRef(null);

  // --- ANALYST NOTES STATE ---
  const initialNote = match.tournament_matches?.[0]?.notes || "";
  const [analystNotes, setAnalystNotes] = useState(initialNote);
  const [isSavingNote, setIsSavingNote] = useState(false);

  // --- PDF GENERATION STATE ---
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const tournamentName = match.tournament_matches?.[0]?.tournaments?.tournament_name || "FUTSAL_MATCH_REPORT";



  useEffect(() => {
    const fetchMatchData = async () => {
      try {
        const [eventsData, statsData, lineupsData] = await Promise.all([
          fetchSupabase('processed_match_events', { select: '*', match_id: `eq.${match.match_id}` }),
          fetchSupabase('player_match_stats', { select: '*,players(player_name,position)', match_id: `eq.${match.match_id}` }),
          fetchSupabase('lineups', { select: 'player_id,team_id,jersey_no,starting_xi,players(player_name,position)', match_id: `eq.${match.match_id}` })
        ]);
        setEvents(eventsData || []);
        setPlayerStats(statsData || []);
        
        const sortedLineups = (lineupsData || []).sort((a,b) => (a.jersey_no || 99) - (b.jersey_no || 99));
        setLineups(sortedLineups);

        // Pre-fill all players for the Average Position multi-selects
        const homeLineup = sortedLineups.filter(l => l.team_id === match.home_team_id);
        const awayLineup = sortedLineups.filter(l => l.team_id === match.away_team_id);
        
        setAvgHomePlayers(homeLineup.map(l => l.player_id));
        setAvgAwayPlayers(awayLineup.map(l => l.player_id));
        
        // Initialize Player Comparison with first home & away players
        if (homeLineup.length > 0) setP1PlayerId(homeLineup[0].player_id);
        if (awayLineup.length > 0) setP2PlayerId(awayLineup[0].player_id);

        // Time limits dynamically
        if (eventsData && eventsData.length > 0) {
            const maxSeconds = Math.max(...eventsData.map(e => e.match_time_seconds));
            const calculatedMaxMinute = Math.ceil(maxSeconds / 60);
            setMaxMinute(calculatedMaxMinute > 0 ? calculatedMaxMinute : 40);
            setAvgMaxMinute(calculatedMaxMinute > 0 ? calculatedMaxMinute : 40);
        }

      } catch (err) {
        console.error("Data fetch failed", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMatchData();
  }, [match]);

  const handleNoteBlur = async () => {
     setIsSavingNote(true);
     const tId = match.tournament_matches?.[0]?.tournament_id;
     if (tId) {
         await updateTournamentMatchNote(tId, match.match_id, analystNotes);
     }
     setIsSavingNote(false);
  };

  const enrichedEvents = useMemo(() => {
    return events
      .filter(e => e.action !== 'Match Time') 
      .map(e => ({
        ...e,
        team_id: lineups.find(l => l.player_id === e.player_id)?.team_id
      }));
  }, [events, lineups]);

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

    return {
      actions: activeActions,
      outcomes: availableOutcomes,
      types: availableTypes,
      homePlayers: homeLineup,
      awayPlayers: awayLineup,
    };
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

    let playerStats = {};

    validEvents.forEach(e => {
      let targetPlayerId = null;
      let x = null, y = null;

      if (statType === 'ALL_ACTIONS') {
        targetPlayerId = e.player_id;
        x = e.start_x; y = e.start_y;
      }
      else if (statType === 'PASS' && (e.action === 'Pass' || e.action === 'Through Ball')) {
        targetPlayerId = e.player_id;
        x = e.start_x; y = e.start_y;
      } 
      else if (statType === 'RECEIVE' && (e.action === 'Pass' || e.action === 'Through Ball')) {
        // Must be a successful pass mapping to a reaction player
        if (['Successful', 'Assist', 'Key Pass'].includes(e.outcome) || e.is_successful_pass) {
          targetPlayerId = e.reaction_player_id;
          x = e.end_x; y = e.end_y;
        }
      } 
      else if (statType === 'SHOT' && e.action === 'Shoot') {
        targetPlayerId = e.player_id;
        x = e.start_x; y = e.start_y;
      } 
      else if (statType === 'DEFENCE' && ['Pass Intercept', 'Standing Tackle', 'Sliding Tackle', 'Save', 'Block'].includes(e.action)) {
        targetPlayerId = e.player_id;
        x = e.start_x; y = e.start_y;
      }

      // Check if target valid, x/y valid, and target is currently selected
      if (targetPlayerId && selectedIds.includes(targetPlayerId) && x !== null && y !== null) {
        // Ensure player is on the specific team we are computing for
        const l = lineups.find(x => x.player_id === targetPlayerId);
        if (l && l.team_id === teamId) {
          if (!playerStats[targetPlayerId]) playerStats[targetPlayerId] = { sumX: 0, sumY: 0, count: 0 };
          playerStats[targetPlayerId].sumX += x;
          playerStats[targetPlayerId].sumY += y;
          playerStats[targetPlayerId].count += 1;
        }
      }
    });

    return Object.keys(playerStats).map(pid => ({
      playerId: pid,
      avgX: playerStats[pid].sumX / playerStats[pid].count,
      avgY: playerStats[pid].sumY / playerStats[pid].count,
      count: playerStats[pid].count
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

  // --- NEW: DYNAMIC SCATTER INSIGHTS LOGIC ---
  const zoneStats = useMemo(() => {
    const valid = filteredEvents.filter(e => e.start_x !== null);
    if (valid.length === 0) return { def: 0, mid: 0, att: 0 };
    const total = valid.length;
    // Futsal court is ~40m. Thirds: 0-13.3m, 13.3m-26.6m, 26.6m-40m
    const def = valid.filter(e => e.start_x <= 13.33).length;
    const mid = valid.filter(e => e.start_x > 13.33 && e.start_x <= 26.66).length;
    const att = valid.filter(e => e.start_x > 26.66).length;
    return { 
      def: Math.round((def/total)*100), 
      mid: Math.round((mid/total)*100), 
      att: Math.round((att/total)*100) 
    };
  }, [filteredEvents]);

  const topActors = useMemo(() => {
    const counts = {};
    filteredEvents.forEach(e => {
        counts[e.player_id] = (counts[e.player_id] || 0) + 1;
    });
    return Object.entries(counts)
        .sort((a,b) => b[1] - a[1])
        .slice(0, 3)
        .map(([pid, count]) => {
            const player = lineups.find(l => l.player_id === pid);
            return {
                name: player ? player.players?.player_name : 'Unknown',
                jersey: player?.jersey_no || '-',
                count
            };
        });
  }, [filteredEvents, lineups]);

  // --- FIELD TILT LOGIC ---
  const fieldTiltStats = useMemo(() => {
    let homeFtActions = 0;
    let awayFtActions = 0;

    enrichedEvents.forEach(e => {
      // Attacking 3rd defined as start_x > 26
      if (e.start_x !== null && e.start_x > 26) {
        if (e.team_id === match.home_team_id) homeFtActions++;
        if (e.team_id === match.away_team_id) awayFtActions++;
      }
    });

    const total = homeFtActions + awayFtActions;
    const homeTilt = total > 0 ? Math.round((homeFtActions / total) * 100) : 50;
    const awayTilt = total > 0 ? Math.round((awayFtActions / total) * 100) : 50;

    return {
      homeActions: homeFtActions,
      awayActions: awayFtActions,
      homeTilt,
      awayTilt
    };
  }, [enrichedEvents, match.home_team_id, match.away_team_id]);

  // --- COMPREHENSIVE ATTACK METRICS LOGIC ---
  const attackStats = useMemo(() => {
    if (!enrichedEvents || enrichedEvents.length === 0) return null;

    const calcTeamAttack = (teamId) => {
        const evs = enrichedEvents.filter(e => e.team_id === teamId);
        
        // 1. Shooting & Efficiency
        const shots = evs.filter(e => e.action === 'Shoot');
        const goals = shots.filter(e => e.outcome === 'Goal').length;
        const sot = shots.filter(e => e.is_sot || ['Goal', 'Save'].includes(e.outcome)).length;
        
        // Box calculation for Futsal (Penalty area approx x >= 30, y between 6 and 14)
        const boxShots = shots.filter(e => e.start_x !== null && e.start_x >= 30 && e.start_y >= 6 && e.start_y <= 14).length;
        const outBoxShots = shots.length - boxShots;
        
        let totalDist = 0;
        let validDistShots = 0;
        shots.forEach(s => {
            if (s.start_x !== null && s.start_y !== null) {
                totalDist += Math.sqrt(Math.pow(40 - s.start_x, 2) + Math.pow(10 - s.start_y, 2));
                validDistShots++;
            }
        });
        const avgShotDist = validDistShots ? (totalDist / validDistShots).toFixed(1) : 0;
        
        const xg = shots.reduce((acc, s) => acc + (parseFloat(s.xg) || 0), 0).toFixed(2);
        const xgPerShot = shots.length ? (xg / shots.length).toFixed(2) : 0;
        const xgDiff = (goals - xg).toFixed(2);
        
        // 2. Passing & Creativity
        const passes = evs.filter(e => e.action === 'Pass');
        const succPasses = passes.filter(p => p.is_successful_pass || ['Successful', 'Assist', 'Key Pass'].includes(p.outcome)).length;
        const progPasses = passes.filter(p => p.progressive_pass).length;
        const keyPasses = passes.filter(p => p.outcome === 'Key Pass').length;
        const assists = passes.filter(p => p.outcome === 'Assist').length;
        const throughBalls = evs.filter(e => e.action === 'Through Ball').length;
        const crosses = evs.filter(e => e.is_cross).length;
        
        // 3. Carrying & Ball Progression
        const carries = evs.filter(e => e.action === 'Carry');
        const progCarries = carries.filter(c => c.end_x !== null && c.start_x !== null && (c.end_x - c.start_x) >= 8).length;
        const final3rdCarries = carries.filter(c => c.start_x !== null && c.end_x !== null && c.start_x < 26 && c.end_x >= 26).length;
        
        const dribbles = evs.filter(e => e.action === 'Dribble');
        const succDribbles = dribbles.filter(d => d.outcome === 'Successful').length;
        
        // 4. Pressure
        const shotsUnderPressure = shots.filter(s => s.pressure_on === true).length;
        const passesUnderPressure = passes.filter(p => p.pressure_on === true);
        const succPassesUnderPressure = passesUnderPressure.filter(p => p.is_successful_pass || ['Successful', 'Assist', 'Key Pass'].includes(p.outcome)).length;
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

    return {
        home: calcTeamAttack(match.home_team_id),
        away: calcTeamAttack(match.away_team_id)
    };
  }, [enrichedEvents, match]);

  // --- NEW: COMPREHENSIVE DEFENSE METRICS LOGIC ---
  const defenseStats = useMemo(() => {
    if (!enrichedEvents || enrichedEvents.length === 0) return null;

    const calcTeamDefense = (teamId, opponentId) => {
        const evs = enrichedEvents.filter(e => e.team_id === teamId);
        const oppEvs = enrichedEvents.filter(e => e.team_id === opponentId);

        // 1-6: Tackles
        const tackles = evs.filter(e => ['Sliding Tackle', 'Standing Tackle'].includes(e.action));
        const totalTackles = tackles.length;
        const succTackles = tackles.filter(e => e.outcome === 'Successful');
        const failedTackles = tackles.filter(e => e.outcome === 'Unsuccessful');
        const tacklesWithPoss = succTackles.filter(e => e.type === 'With Possession').length;
        const tacklesWithoutPoss = succTackles.filter(e => e.type === 'Without Possession').length;
        const tackleSuccess = totalTackles > 0 ? Math.round((succTackles.length / totalTackles) * 100) : 0;

        // 7-11: Interceptions
        const interceptions = evs.filter(e => e.action === 'Pass Intercept');
        const totalInterceptions = interceptions.length;
        const succInterceptions = interceptions.filter(e => e.outcome === 'Successful');
        const failedInterceptions = interceptions.filter(e => e.outcome === 'Unsuccessful').length;
        const intsWithPoss = succInterceptions.filter(e => e.type === 'With Possession').length;
        const intsWithoutPoss = succInterceptions.filter(e => e.type === 'Without Possession').length;

        // 12-16: Blocks
        const blocks = evs.filter(e => e.action === 'Block');
        const totalBlocks = blocks.length;
        const succBlocks = blocks.filter(e => e.outcome === 'Successful');
        const blocksWithPoss = succBlocks.filter(e => e.type === 'With Possession').length;
        const blocksWithoutPoss = succBlocks.filter(e => e.type === 'Without Possession').length;
        const blockOwnGoals = blocks.filter(e => e.outcome === 'Unsuccessful' && e.type === 'Own Goal').length;

        // 17-21: Clearances
        const clearances = evs.filter(e => e.action === 'Clearance');
        const totalClearances = clearances.length;
        const succClearances = clearances.filter(e => e.outcome === 'Successful');
        const clearWithPoss = succClearances.filter(e => e.type === 'With Possession').length;
        const clearWithoutPoss = succClearances.filter(e => e.type === 'Without Possession').length;
        const clearOwnGoals = clearances.filter(e => e.outcome === 'Unsuccessful' && e.type === 'Own Goal').length;

        // 22-23: Pressure
        const pressures = evs.filter(e => e.action === 'Pressure');
        const totalPressures = pressures.length;
        const pressureFouls = pressures.filter(e => e.outcome === 'Foul').length;

        // 24-26: Discipline
        const discipline = evs.filter(e => e.action === 'Discipline');
        const disciplineFouls = discipline.filter(e => e.outcome === 'Foul');
        const totalFouls = disciplineFouls.length;
        const yellowCards = disciplineFouls.filter(e => e.type === 'Yellow Card').length;
        const redCards = disciplineFouls.filter(e => e.type === 'Red Card').length;

        // 27-29: Goalkeeper Saves
        const saves = evs.filter(e => e.action === 'Save');
        const totalSaves = saves.length;
        const grippingSaves = saves.filter(e => e.outcome === 'Gripping').length;
        const pushSaves = saves.filter(e => ['Pushing-in', 'Pushing-out'].includes(e.outcome)).length;

        // 30: Defensive Shot Blocking (Derived from Opponent)
        const oppShotsBlocked = oppEvs.filter(e => e.action === 'Shoot' && e.outcome === 'Block').length;

        // 31: Possession Wins
        const possessionWins = tacklesWithPoss + intsWithPoss + blocksWithPoss + clearWithPoss;

        // 34: Ball Recoveries
        const ballRecoveries = possessionWins + totalSaves;

        // 32-33: Defensive Actions & Success Rate
        const totalDefensiveActions = totalTackles + totalInterceptions + totalBlocks + totalClearances + totalPressures;
        const totalSuccDefActions = succTackles.length + succInterceptions.length + succBlocks.length + succClearances.length;
        const defActionSuccessRate = totalDefensiveActions > 0 ? Math.round((totalSuccDefActions / totalDefensiveActions) * 100) : 0;

        return {
            totalTackles, succTackles: succTackles.length, failedTackles: failedTackles.length, tacklesWithPoss, tacklesWithoutPoss, tackleSuccess,
            totalInterceptions, succInterceptions: succInterceptions.length, failedInterceptions, intsWithPoss, intsWithoutPoss,
            totalBlocks, succBlocks: succBlocks.length, blocksWithPoss, blocksWithoutPoss, blockOwnGoals,
            totalClearances, succClearances: succClearances.length, clearWithPoss, clearWithoutPoss, clearOwnGoals,
            totalPressures, pressureFouls,
            totalFouls, yellowCards, redCards,
            totalSaves, grippingSaves, pushSaves,
            oppShotsBlocked,
            possessionWins, ballRecoveries,
            totalDefensiveActions, defActionSuccessRate
    };
  };

  return {
      home: calcTeamDefense(match.home_team_id, match.away_team_id),
      away: calcTeamDefense(match.away_team_id, match.home_team_id)
  };
}, [enrichedEvents, match]);

// --- NEW: PLAYER COMPARISON LOGIC ---
const p1Options = useMemo(() => lineups.filter(l => l.team_id === p1TeamId), [lineups, p1TeamId]);
const p2Options = useMemo(() => lineups.filter(l => l.team_id === p2TeamId), [lineups, p2TeamId]);

useEffect(() => {
  if (p1Options.length > 0 && (!p1PlayerId || !p1Options.find(p => p.player_id === p1PlayerId))) {
      setP1PlayerId(p1Options[0].player_id);
  }
}, [p1Options, p1PlayerId]);

useEffect(() => {
  if (p2Options.length > 0 && (!p2PlayerId || !p2Options.find(p => p.player_id === p2PlayerId))) {
      setP2PlayerId(p2Options[0].player_id);
  }
}, [p2Options, p2PlayerId]);

// Compute maximums across the match for radar chart scaling
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

const getPlayerStats = (pid) => {
  if (!pid) return null;
  const info = lineups.find(l => l.player_id === pid) || {};
  const evs = enrichedEvents.filter(e => e.player_id === pid);
  
  // Calculate player specific stats
  const passes = evs.filter(e => e.action === 'Pass');
  const succPasses = passes.filter(p => p.is_successful_pass || ['Successful', 'Assist', 'Key Pass'].includes(p.outcome));
  const shots = evs.filter(e => e.action === 'Shoot');
  const goals = shots.filter(s => s.outcome === 'Goal').length;
  const tackles = evs.filter(e => ['Sliding Tackle', 'Standing Tackle'].includes(e.action));
  const succTackles = tackles.filter(t => t.outcome === 'Successful').length;
  const carries = evs.filter(e => e.action === 'Carry');
  const interceptions = evs.filter(e => e.action === 'Pass Intercept');

  return {
      info,
      events: evs,
      stats: {
          passes: passes.length,
          succPasses: succPasses.length,
          passAcc: passes.length ? Math.round((succPasses.length/passes.length)*100) : 0,
          shots: shots.length,
          goals,
          xg: parseFloat(shots.reduce((acc, s) => acc + (parseFloat(s.xg) || 0), 0).toFixed(2)),
          tackles: tackles.length,
          succTackles,
          carries: carries.length,
          interceptions: interceptions.length
      }
  };
};

const p1Data = useMemo(() => getPlayerStats(p1PlayerId), [p1PlayerId, lineups, enrichedEvents]);
const p2Data = useMemo(() => getPlayerStats(p2PlayerId), [p2PlayerId, lineups, enrichedEvents]);

// --- NEW: MATCH LEADERS LOGIC ---
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
              const isHome = pLineup.team_id === match.home_team_id;
              return {
                  count,
                  playerName: pLineup.players?.player_name || 'Unknown',
                  jerseyNo: pLineup.jersey_no || '-',
                  teamName: isHome ? match.home_team?.team_name : match.away_team?.team_name,
                  isHome
              };
          });
          
          const actionTotal = sortedPlayers.reduce((sum, [,c]) => sum + c, 0);

          leaders.push({
              action,
              actionTotal,
              topList
          });
      }
  });

  // Sort leaders by highest action total in the match, picking the top 12 to ensure a symmetric 3x4 or 4x3 grid
  return leaders.sort((a, b) => b.actionTotal - a.actionTotal).slice(0, 12);
}, [enrichedEvents, lineups, match]);

// --- NEW: HIGHLIGHTS LOGIC & FILTERS ---
const matchVideoUrl = match.tournament_matches?.[0]?.video_url;
const matchVideoProvider = match.tournament_matches?.[0]?.video_provider;

const hlFilterOptions = useMemo(() => {
  const actions = Array.from(new Set(enrichedEvents.map(e => e.action))).filter(Boolean).sort();
  let outcomes = [];
  if (hlAction === 'ALL') {
      outcomes = Array.from(new Set(enrichedEvents.map(e => e.outcome))).filter(Boolean).sort();
  } else if (CAC_LOGIC[hlAction]) {
      outcomes = Object.keys(CAC_LOGIC[hlAction]).sort();
  }
  let types = [];
  if (hlAction === 'ALL' || hlOutcome === 'ALL') {
      types = Array.from(new Set(enrichedEvents.map(e => e.type))).filter(t => t && t !== 'NA').sort();
  } else if (CAC_LOGIC[hlAction] && CAC_LOGIC[hlAction][hlOutcome]) {
      types = CAC_LOGIC[hlAction][hlOutcome].filter(t => t !== 'NA').sort();
  }
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

const handleEventClick = (timeSecs) => {
  const seekTime = Math.max(0, timeSecs - 5); // 5 seconds early
  setHlSeekTime(seekTime);
  setHlForceRender(prev => prev + 1);
};

// Keyboard controls for video player
useEffect(() => {
  const handleKeyDown = (e) => {
      if (activeTab !== 'HIGHLIGHTS') return;
      // Don't intercept if typing in an input
      if (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT') return;
      
      if (videoRef.current) {
          if (e.code === 'Space') {
              e.preventDefault();
              if (videoRef.current.paused) {
                  // Catch the promise rejection if media is unsupported
                  videoRef.current.play().catch(err => console.log("Playback unsupported/prevented:", err));
              } else {
                  videoRef.current.pause();
              }
          } else if (e.code === 'ArrowRight') {
              e.preventDefault();
              try { videoRef.current.currentTime += 5; } catch (err) {}
          } else if (e.code === 'ArrowLeft') {
              e.preventDefault();
              try { videoRef.current.currentTime -= 5; } catch (err) {}
          }
      }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [activeTab]);

// Trigger seek for HTML5 Video
useEffect(() => {
  if (videoRef.current && hlSeekTime >= 0) {
      try {
          videoRef.current.currentTime = hlSeekTime;
      } catch (err) {
          console.log("Seek error:", err);
      }
      videoRef.current.play().catch(e => console.log("Autoplay prevented/Unsupported media", e));
  }
}, [hlSeekTime, hlForceRender]);

const getYouTubeId = (url) => {
  if(!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

const getDriveId = (url) => {
  if(!url) return null;
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
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

const stats = useMemo(() => {
    if (!attackStats) return null; // Wait for attack stats
    
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
        staff: playerStats.filter(p => p.team_id === teamId && p.players?.position === 'Coach'),
        scorers: playerStats.filter(p => p.team_id === teamId && p.goals > 0).map(p => ({
          name: p.players?.player_name || 'Unknown',
          display: Array(p.goals).fill('⚽').join('')
        }))
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
  }, [enrichedEvents, attackStats, playerStats, lineups, match]);

  const handleDownloadPDF = () => {
    setIsGeneratingPDF(true);

    // Wait for the hidden container to render canvases
    setTimeout(() => {
      try {
        const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        const W = 210, H = 297, M = 12; // A4 dimensions + margin
        const pw = W - M * 2; // printable width
        let y = M;

        // ── HELPERS ──
        const addText = (text, x, fontSize, opts = {}) => {
          doc.setFontSize(fontSize);
          doc.setFont('helvetica', opts.style || 'normal');
          doc.setTextColor(opts.color || '#000000');
          const lines = doc.splitTextToSize(String(text || ''), opts.maxW || (pw - (x - M)));
          doc.text(lines, x, y);
          return lines.length * fontSize * 0.4;
        };
        const checkPage = (needed) => {
          if (y + needed > H - M) { doc.addPage(); y = M; return true; }
          return false;
        };
        const drawLine = (x1, y1, x2, y2, color = '#000000', width = 0.5) => {
          doc.setDrawColor(color); doc.setLineWidth(width);
          doc.line(x1, y1, x2, y2);
        };
        const drawRect = (x, ry, w, h, fill, border = '#000000') => {
          doc.setDrawColor(border); doc.setFillColor(fill);
          doc.rect(x, ry, w, h, 'FD');
        };
        const compareRow = (label, hVal, aVal, highlight = false) => {
          checkPage(8);
          if (highlight) {
            doc.setFillColor('#FFD166'); doc.rect(M, y - 3.5, pw, 8, 'F');
          }
          doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor('#0077B6');
          doc.text(String(hVal), M + pw * 0.17, y, { align: 'center' });
          doc.setTextColor('#333333'); doc.setFontSize(6); doc.setFont('helvetica', 'normal');
          doc.text(String(label).toUpperCase(), M + pw * 0.5, y, { align: 'center' });
          doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor('#D90429');
          doc.text(String(aVal), M + pw * 0.83, y, { align: 'center' });
          y += 6;
          drawLine(M, y - 2, M + pw, y - 2, '#dddddd', 0.2);
        };

        // ── Grab canvases from hidden container ──
        const getCanvasImg = (index) => {
          const container = document.getElementById('pdf-report-container');
          if (!container) return null;
          const canvases = container.querySelectorAll('canvas');
          if (index < canvases.length && canvases[index].width > 0) {
            return canvases[index].toDataURL('image/png');
          }
          return null;
        };

        // ════════════════════════ PAGE 1: HEADER + SUMMARY ════════════════════════
        // Header bar
        drawRect(M, y - 2, pw, 14, '#000000');
        doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor('#FFFFFF');
        doc.text('CAC MATCH REPORT', M + 4, y + 6);
        doc.setFontSize(8); doc.setTextColor('#06D6A0');
        doc.text(tournamentName.toUpperCase(), M + pw - 4, y + 6, { align: 'right' });
        y += 18;

        // Scoreline
        doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor('#0077B6');
        doc.text(match.home_team?.team_name || '', M, y);
        doc.setFontSize(22); doc.setTextColor('#000000');
        const scoreText = `${match.home_score}  -  ${match.away_score}`;
        doc.text(scoreText, M + pw * 0.5, y, { align: 'center' });
        doc.setFontSize(14); doc.setTextColor('#D90429');
        doc.text(match.away_team?.team_name || '', M + pw, y, { align: 'right' });
        y += 6;
        doc.setFontSize(7); doc.setTextColor('#888888'); doc.setFont('helvetica', 'normal');
        doc.text(`${match.match_date || ''} • ${match.detail || ''} • FINAL`, M + pw * 0.5, y, { align: 'center' });
        y += 8;
        drawLine(M, y, M + pw, y, '#000000', 1);
        y += 6;

        // Section 1: Summary Stats
        if (stats) {
          addText('1. MATCH SUMMARY', M, 11, { style: 'bold' }); y += 8;
          drawLine(M, y - 3, M + pw, y - 3, '#000000', 0.5);

          // Column headers
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

          // Team sheets
          const printRoster = (roster, teamName, color, xOff) => {
            const colW = pw * 0.44;
            doc.setFontSize(7); doc.setFont('helvetica', 'bold');
            drawRect(xOff, y - 3, colW, 6, color);
            doc.setTextColor('#FFFFFF');
            doc.text(teamName.toUpperCase(), xOff + 2, y + 1);
            let ry = y + 6;
            doc.setTextColor('#000000'); doc.setFontSize(6);
            if (roster.starters) {
              roster.starters.forEach(p => {
                if (ry > H - M - 5) { doc.addPage(); ry = M; }
                doc.setFont('helvetica', 'bold');
                doc.text(`${p.jersey_no || '-'}`, xOff + 2, ry);
                doc.setFont('helvetica', 'normal');
                doc.text(`${p.players?.player_name || 'Unknown'}`, xOff + 10, ry);
                ry += 4;
              });
            }
            if (roster.subs && roster.subs.length > 0) {
              ry += 1;
              doc.setFontSize(5); doc.setTextColor('#999999');
              doc.text('SUBSTITUTES:', xOff + 2, ry); ry += 3;
              doc.setFontSize(6); doc.setTextColor('#666666');
              roster.subs.forEach(p => {
                if (ry > H - M - 5) { doc.addPage(); ry = M; }
                doc.text(`${p.jersey_no || '-'}  ${p.players?.player_name || 'Unknown'}`, xOff + 2, ry);
                ry += 3.5;
              });
            }
            return ry;
          };

          checkPage(60);
          addText('OFFICIAL TEAM SHEETS', M, 8, { style: 'bold' }); y += 6;
          const leftEnd = printRoster(stats.home.roster, match.home_team?.team_name, '#0077B6', M);
          const savedY = y;
          const rightEnd = printRoster(stats.away.roster, match.away_team?.team_name, '#D90429', M + pw * 0.53);
          y = Math.max(leftEnd, rightEnd) + 4;
        }

        // ════════════════════════ PAGE 2: ATTACK STATS ════════════════════════
        doc.addPage(); y = M;
        addText('2. ATTACK OVERVIEW', M, 11, { style: 'bold' }); y += 8;
        drawLine(M, y - 3, M + pw, y - 3, '#000000', 0.5);

        if (attackStats) {
          // Column header
          doc.setFontSize(6); doc.setFont('helvetica', 'bold');
          doc.setTextColor('#0077B6');
          doc.text(match.home_team?.team_name || 'HOME', M + pw * 0.17, y, { align: 'center' });
          doc.setTextColor('#D90429');
          doc.text(match.away_team?.team_name || 'AWAY', M + pw * 0.83, y, { align: 'center' });
          y += 6;

          const pdfAttackSections = [
            { key: 'attack_shooting',        title: 'SHOOTING & EFFICIENCY' },
            { key: 'attack_distribution',    title: 'DISTRIBUTION & CREATIVITY' },
            { key: 'attack_ball_progression',title: 'BALL PROGRESSION' },
            { key: 'attack_pressure',        title: 'PERFORMANCE UNDER PRESSURE' },
          ];
          pdfAttackSections.forEach(({ key, title }) => {
            const rows = (statsConfig[key] || []).filter(e => e.enabled).sort((a,b) => a.order - b.order);
            if (rows.length === 0) return;
            drawRect(M, y - 3, pw, 6, '#eeeeee');
            doc.setFontSize(6); doc.setTextColor('#000000');
            doc.text(title, M + pw * 0.5, y + 1, { align: 'center' });
            y += 8;
            rows.forEach(e => {
              const def = STATS_REGISTRY[e.id]; if (!def) return;
              compareRow(def.label, def.getH(attackStats.home), def.getA(attackStats.away), def.highlight || false);
            });
            y += 4;
          });
        }

        // ════════════════════════ PAGE 3: DEFENSE STATS ════════════════════════
        doc.addPage(); y = M;
        addText('3. DEFENSE OVERVIEW', M, 11, { style: 'bold' }); y += 8;
        drawLine(M, y - 3, M + pw, y - 3, '#000000', 0.5);

        if (defenseStats) {
          doc.setFontSize(6); doc.setFont('helvetica', 'bold');
          doc.setTextColor('#0077B6');
          doc.text(match.home_team?.team_name || 'HOME', M + pw * 0.17, y, { align: 'center' });
          doc.setTextColor('#D90429');
          doc.text(match.away_team?.team_name || 'AWAY', M + pw * 0.83, y, { align: 'center' });
          y += 6;

          const pdfDefenseSections = [
            { key: 'defense_tackling',    title: 'TACKLING & INTERCEPTIONS' },
            { key: 'defense_blocks',      title: 'BLOCKS & CLEARANCES' },
            { key: 'defense_work_rate',   title: 'WORK RATE & RECOVERIES' },
            { key: 'defense_goalkeeping', title: 'GOALKEEPING & DISCIPLINE' },
          ];
          pdfDefenseSections.forEach(({ key, title }) => {
            const rows = (statsConfig[key] || []).filter(e => e.enabled).sort((a,b) => a.order - b.order);
            if (rows.length === 0) return;
            drawRect(M, y - 3, pw, 6, '#eeeeee');
            doc.setFontSize(6); doc.setTextColor('#000000');
            doc.text(title, M + pw * 0.5, y + 1, { align: 'center' });
            y += 8;
            rows.forEach(e => {
              const def = STATS_REGISTRY[e.id]; if (!def) return;
              compareRow(def.label, def.getH(defenseStats.home), def.getA(defenseStats.away), def.highlight || false);
            });
            y += 4;
          });
        }

        // ════════════════════════ PAGE 4: PITCH DIAGRAMS ════════════════════════
        doc.addPage(); y = M;
        addText('4. PITCH DIAGRAMS', M, 11, { style: 'bold' }); y += 8;
        drawLine(M, y - 3, M + pw, y - 3, '#000000', 0.5);

        // Grab all canvases from the hidden container
        const container = document.getElementById('pdf-report-container');
        const canvases = container ? container.querySelectorAll('canvas') : [];
        const imgW = pw * 0.46;
        const imgH = imgW * 0.55;

        const addCanvasPair = (title, idx1, idx2, label1, label2) => {
          checkPage(imgH + 16);
          drawRect(M, y - 2, pw, 6, '#000000');
          doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor('#FFFFFF');
          doc.text(title.toUpperCase(), M + 3, y + 2);
          y += 8;

          const img1 = (idx1 < canvases.length && canvases[idx1].width > 0) ? canvases[idx1].toDataURL('image/png') : null;
          const img2 = (idx2 < canvases.length && canvases[idx2].width > 0) ? canvases[idx2].toDataURL('image/png') : null;

          if (img1) doc.addImage(img1, 'PNG', M, y, imgW, imgH);
          if (img2) doc.addImage(img2, 'PNG', M + pw * 0.52, y, imgW, imgH);

          doc.setFontSize(6); doc.setFont('helvetica', 'bold');
          doc.setTextColor('#0077B6');
          doc.text(label1 || '', M + imgW * 0.5, y + imgH + 3, { align: 'center' });
          doc.setTextColor('#D90429');
          doc.text(label2 || '', M + pw * 0.52 + imgW * 0.5, y + imgH + 3, { align: 'center' });
          y += imgH + 8;
        };

        const homeName = match.home_team?.team_name || 'Home';
        const awayName = match.away_team?.team_name || 'Away';

        // Canvas order in PDF container: 0-1 pass scatter, 2-3 avg pass pos, 4-5 avg recv pos,
        // 6-7 shot maps, 8-9 shot placement, 10-11 heatmaps
        addCanvasPair('Pass Distribution', 0, 1, homeName, awayName);
        addCanvasPair('Average Pass Position', 2, 3, homeName, awayName);

        doc.addPage(); y = M;
        addCanvasPair('Average Receiving Position', 4, 5, homeName, awayName);
        addCanvasPair('Shot Map (xG)', 6, 7, homeName, awayName);

        doc.addPage(); y = M;
        addCanvasPair('Shot Placement (Goal Face)', 8, 9, homeName, awayName);
        addCanvasPair('Defensive Heatmap', 10, 11, homeName, awayName);

        // ════════════════════════ PAGE: MATCH LEADERS ════════════════════════
        doc.addPage(); y = M;
        addText('5. MATCH LEADERS', M, 11, { style: 'bold' }); y += 8;
        drawLine(M, y - 3, M + pw, y - 3, '#000000', 0.5);

        if (matchLeaders && matchLeaders.length > 0) {
          const colW = pw / 3 - 2;
          matchLeaders.forEach((leader, i) => {
            const col = i % 3;
            if (col === 0 && i > 0) y += 2;
            checkPage(28);
            const xOff = M + col * (colW + 3);
            if (col === 0 && i > 0) {} // y already incremented

            // Leader card
            drawRect(xOff, y, colW, 24, '#FFFFFF', '#000000');
            doc.setFontSize(5); doc.setFont('helvetica', 'bold'); doc.setTextColor('#888888');
            doc.text(leader.action.toUpperCase(), xOff + 2, y + 4);
            drawLine(xOff, y + 5, xOff + colW, y + 5, '#000000', 0.3);

            if (leader.topList[0]) {
              doc.setFontSize(12); doc.setTextColor('#000000');
              doc.text(String(leader.topList[0].count), xOff + 2, y + 13);
              doc.setFontSize(5); doc.setFont('helvetica', 'normal');
              doc.text(`#${leader.topList[0].jerseyNo} ${leader.topList[0].playerName}`.substring(0, 25), xOff + 14, y + 11);
              doc.setTextColor(leader.topList[0].isHome ? '#0077B6' : '#D90429');
              doc.setFontSize(4);
              doc.text(leader.topList[0].teamName || '', xOff + 14, y + 14);
            }
            // Runner-ups
            doc.setFontSize(4); doc.setTextColor('#888888');
            leader.topList.slice(1, 4).forEach((p, idx) => {
              doc.setTextColor(p.isHome ? '#0077B6' : '#D90429');
              doc.text(`#${p.jerseyNo} ${p.playerName}: ${p.count}`.substring(0, 35), xOff + 2, y + 18 + idx * 2.5);
            });

            if (col === 2) y += 26;
          });
          if (matchLeaders.length % 3 !== 0) y += 26;
        }

        // ════════════════════════ PAGE: ANALYST NOTES ════════════════════════
        doc.addPage(); y = M;
        addText('6. ANALYST NOTES', M, 11, { style: 'bold' }); y += 8;
        drawLine(M, y - 3, M + pw, y - 3, '#000000', 0.5);

        drawRect(M, y, pw, 6, '#FFD166');
        doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setTextColor('#000000');
        doc.text('MATCH ANALYSIS & OBSERVATIONS', M + 3, y + 4);
        y += 10;

        const noteText = analystNotes || 'No notes provided for this match.';
        doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor('#333333');
        const noteLines = doc.splitTextToSize(noteText, pw - 4);
        noteLines.forEach(line => {
          checkPage(5);
          doc.text(line, M + 2, y);
          y += 4;
        });

        // ── SAVE ──
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
    { id: 'NOTES', label: 'Analyst Notes', icon: Edit3 },
  ];

  const resetScatterFilters = () => {
    setDistTeam('ALL');
    setDistPlayer('ALL');
    setDistAction('ALL');
    setDistOutcome('ALL');
    setDistType('ALL');
    let calculatedMax = 40;
    if (events && events.length > 0) {
        calculatedMax = Math.ceil(Math.max(...events.map(e => e.match_time_seconds)) / 60);
    }
    setMinMinute(0);
    setMaxMinute(calculatedMax > 0 ? calculatedMax : 40);
  };

  const absoluteMaxMinute = useMemo(() => {
    if (!events || events.length === 0) return 40;
    const maxSecs = Math.max(...events.map(e => e.match_time_seconds));
    const calculated = Math.ceil(maxSecs / 60);
    return calculated > 0 ? calculated : 40;
  }, [events]);

  const toggleAvgPlayer = (teamFlag, pid) => {
    if (teamFlag === 'HOME') {
      setAvgHomePlayers(prev => prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid]);
    } else {
      setAvgAwayPlayers(prev => prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid]);
    }
  };

  const handleSelectAllAvgPlayers = (teamFlag, selectAll) => {
    if (teamFlag === 'HOME') {
      setAvgHomePlayers(selectAll ? filterOptions.homePlayers.map(p => p.player_id) : []);
    } else {
      setAvgAwayPlayers(selectAll ? filterOptions.awayPlayers.map(p => p.player_id) : []);
    }
  };

  return (
    <div className="min-h-screen bg-white font-mono relative overflow-x-hidden">
      
      {/* ========================================================================= */}
      {/* 📥 HIDDEN PDF REPORT CONTAINER */}
      {/* ========================================================================= */}
      {isGeneratingPDF && (
        <div className="fixed pointer-events-none" style={{ top: 0, left: '-9999px', width: '800px', zIndex: -1, overflow: 'auto' }}>
        <div id="pdf-report-container" className="bg-white p-8 font-mono text-black print-container" style={{ width: '800px', maxWidth: '800px' }}>
            
            <div className="border-b-4 border-black pb-4 mb-8">
              <h1 className="text-4xl font-black uppercase text-[#0077B6] mb-2 tracking-tighter">CAC Match Report</h1>
              <h2 className="text-3xl font-bold uppercase">{match.home_team?.team_name} <span className="text-[#0077B6]">{match.home_score}</span> - <span className="text-[#D90429]">{match.away_score}</span> {match.away_team?.team_name}</h2>
              <p className="text-sm font-bold text-gray-500 mt-2">{match.match_date} • {match.detail} • {tournamentName}</p>
            </div>

          {/* PDF Section 1: Summary */}
          <div className="pdf-section mb-12 page-break-inside-avoid">
             <h3 className="text-2xl font-black uppercase border-b-2 border-black mb-6">1. Match Summary</h3>
             <div className="grid grid-cols-1 gap-3 mb-8 border-4 border-black p-4">
                {(statsConfig.summary || []).filter(e => e.enabled).sort((a,b) => a.order - b.order).map(e => {
                  const def = STATS_REGISTRY[e.id]; if (!def || !stats) return null;
                  return (
                    <div key={e.id} className="flex items-center border-b-2 border-dashed border-gray-300 pb-2">
                      <div className="w-1/3 text-center font-black text-xl text-[#0077B6]">{def.getH(stats.home)}</div>
                      <div className="w-1/3 text-center font-black uppercase text-xs">{def.label}</div>
                      <div className="w-1/3 text-center font-black text-xl text-[#D90429]">{def.getA(stats.away)}</div>
                    </div>
                  );
                })}
             </div>
             <div className="grid grid-cols-2 gap-8">
                <TeamSheetSide teamName={match.home_team?.team_name} roster={stats.home.roster} colorClass="bg-[#0077B6]"/>
                <TeamSheetSide teamName={match.away_team?.team_name} roster={stats.away.roster} colorClass="bg-[#D90429]"/>
             </div>
          </div>

          {/* PDF Section 2: Distribution */}
          <div className="pdf-section mb-12 html2pdf__page-break page-break-before-always mt-10">
             <h3 className="text-2xl font-black uppercase border-b-2 border-black mb-6">2. Distribution & Positioning</h3>
             
             {/* Passes Scatter */}
             <h4 className="text-lg font-black uppercase mb-2 bg-black text-white p-2">Passes Telemetry</h4>
             <div className="grid grid-cols-2 gap-8 mb-8">
               <div>
                 <FutsalDistributionPitch filteredEvents={homePasses} homeTeamId={match.home_team_id} lineups={lineups} />
                 <div className="text-center text-xs font-black uppercase text-[#0077B6] mt-2">{match.home_team?.team_name}</div>
               </div>
               <div>
                 <FutsalDistributionPitch filteredEvents={awayPasses} homeTeamId={match.home_team_id} lineups={lineups} />
                 <div className="text-center text-xs font-black uppercase text-[#D90429] mt-2">{match.away_team?.team_name}</div>
               </div>
             </div>

             {/* Field Tilt */}
             <h4 className="text-lg font-black uppercase mb-2 bg-black text-white p-2">Field Tilt (Final 3rd Actions)</h4>
             <div className="border-2 border-black p-4 mb-8 text-center">
                 <div className="flex justify-between items-center mb-3 font-black text-2xl">
                    <span className="text-[#0077B6]">{fieldTiltStats.homeTilt}% ({match.home_team?.team_name})</span>
                    <span className="text-[#D90429]">{fieldTiltStats.awayTilt}% ({match.away_team?.team_name})</span>
                 </div>
                 <div className="w-full h-8 flex border-2 border-black bg-white">
                    <div className="h-full bg-[#0077B6]" style={{ width: `${fieldTiltStats.homeTilt}%` }}></div>
                    <div className="h-full bg-[#D90429]" style={{ width: `${fieldTiltStats.awayTilt}%` }}></div>
                 </div>
             </div>

             {/* Avg Pass Position */}
             <h4 className="text-lg font-black uppercase mb-2 bg-black text-white p-2">Average Pass Position (All Players)</h4>
             <div className="grid grid-cols-2 gap-8 mb-8">
                <AveragePositionsPitch data={pdfAvgPassHome} teamName={match.home_team?.team_name} isHome={true} lineups={lineups} />
                <AveragePositionsPitch data={pdfAvgPassAway} teamName={match.away_team?.team_name} isHome={false} lineups={lineups} />
             </div>

             {/* Avg Pass Receive Position */}
             <h4 className="text-lg font-black uppercase mb-2 bg-black text-white p-2">Average Pass Receiving Position</h4>
             <div className="grid grid-cols-2 gap-8 mb-8">
                <AveragePositionsPitch data={pdfAvgRecvHome} teamName={match.home_team?.team_name} isHome={true} lineups={lineups} />
                <AveragePositionsPitch data={pdfAvgRecvAway} teamName={match.away_team?.team_name} isHome={false} lineups={lineups} />
             </div>
          </div>

          {/* PDF Section 3: Attack */}
          <div className="pdf-section mb-12 html2pdf__page-break page-break-before-always mt-10">
             <h3 className="text-2xl font-black uppercase border-b-2 border-black mb-6">3. Attack Overview</h3>
             
             <h4 className="text-lg font-black uppercase mb-2 bg-black text-white p-2">Shot Maps (xG)</h4>
             <div className="grid grid-cols-2 gap-8 mb-8">
               <div>
                  <ShotMapPitch shots={enrichedEvents.filter(e => e.action === 'Shoot' && e.team_id === match.home_team_id)} teamName={match.home_team?.team_name} isHome={true} lineups={lineups} />
                  <div className="text-center text-xs font-black uppercase text-[#0077B6] mt-2">{match.home_team?.team_name}</div>
               </div>
               <div>
                  <ShotMapPitch shots={enrichedEvents.filter(e => e.action === 'Shoot' && e.team_id === match.away_team_id)} teamName={match.away_team?.team_name} isHome={false} lineups={lineups} />
                  <div className="text-center text-xs font-black uppercase text-[#D90429] mt-2">{match.away_team?.team_name}</div>
               </div>
             </div>

             <h4 className="text-lg font-black uppercase mb-2 bg-black text-white p-2">Shot Placement Maps (Goal Face)</h4>
             <div className="grid grid-cols-2 gap-8 mb-8">
               <div>
                  <ShotPlacementPitch shots={enrichedEvents.filter(e => e.action === 'Shoot' && e.team_id === match.home_team_id)} teamName={match.home_team?.team_name} isHome={true} lineups={lineups} />
                  <div className="text-center text-xs font-black uppercase text-[#0077B6] mt-2">{match.home_team?.team_name}</div>
               </div>
               <div>
                  <ShotPlacementPitch shots={enrichedEvents.filter(e => e.action === 'Shoot' && e.team_id === match.away_team_id)} teamName={match.away_team?.team_name} isHome={false} lineups={lineups} />
                  <div className="text-center text-xs font-black uppercase text-[#D90429] mt-2">{match.away_team?.team_name}</div>
               </div>
             </div>
             
             <div className="grid grid-cols-2 gap-6">
                <BrutalistCard color="bg-white">
                  <h3 className="text-xs font-black uppercase bg-black text-white p-2 mb-4">Shooting & Efficiency</h3>
                  {renderStatRows('attack_shooting', attackStats.home, attackStats.away)}
                </BrutalistCard>
                <BrutalistCard color="bg-[#f8fafc]">
                  <h3 className="text-xs font-black uppercase bg-black text-[#FFD166] p-2 mb-4">Distribution & Creativity</h3>
                  {renderStatRows('attack_distribution', attackStats.home, attackStats.away)}
                </BrutalistCard>
                <BrutalistCard color="bg-white">
                  <h3 className="text-xs font-black uppercase bg-black text-white p-2 mb-4">Ball Progression</h3>
                  {renderStatRows('attack_ball_progression', attackStats.home, attackStats.away)}
                </BrutalistCard>
                <BrutalistCard color="bg-[#f8fafc]">
                  <h3 className="text-xs font-black uppercase bg-black text-[#FFD166] p-2 mb-4">Performance Under Pressure</h3>
                  {renderStatRows('attack_pressure', attackStats.home, attackStats.away)}
                </BrutalistCard>
             </div>
          </div>

          {/* PDF Section 4: Defense */}
          <div className="pdf-section mb-12 html2pdf__page-break page-break-before-always mt-10">
             <h3 className="text-2xl font-black uppercase border-b-2 border-black mb-6">4. Defense Overview</h3>
             <h4 className="text-lg font-black uppercase mb-2 bg-black text-white p-2">Defensive Density Heatmap</h4>
             <div className="grid grid-cols-2 gap-8 mb-8">
               <div>
                  <HeatmapPitch events={allHomeDefEvents} teamName={match.home_team?.team_name} isHome={true} />
                  <div className="text-center text-xs font-black uppercase text-[#0077B6] mt-2">{match.home_team?.team_name}</div>
               </div>
               <div>
                  <HeatmapPitch events={allAwayDefEvents} teamName={match.away_team?.team_name} isHome={false} />
                  <div className="text-center text-xs font-black uppercase text-[#D90429] mt-2">{match.away_team?.team_name}</div>
               </div>
             </div>

             <div className="grid grid-cols-2 gap-6">
                <BrutalistCard color="bg-white">
                  <h3 className="text-xs font-black uppercase bg-black text-white p-2 mb-4">Tackling & Interceptions</h3>
                  {renderStatRows('defense_tackling', defenseStats.home, defenseStats.away)}
                </BrutalistCard>
                <BrutalistCard color="bg-[#f8fafc]">
                  <h3 className="text-xs font-black uppercase bg-black text-[#FFD166] p-2 mb-4">Blocks & Clearances</h3>
                  {renderStatRows('defense_blocks', defenseStats.home, defenseStats.away)}
                </BrutalistCard>
                <BrutalistCard color="bg-white">
                  <h3 className="text-xs font-black uppercase bg-black text-white p-2 mb-4">Work Rate & Recoveries</h3>
                  {renderStatRows('defense_work_rate', defenseStats.home, defenseStats.away)}
                </BrutalistCard>
                <BrutalistCard color="bg-[#f8fafc]">
                  <h3 className="text-xs font-black uppercase bg-black text-[#FFD166] p-2 mb-4">Goalkeeping & Discipline</h3>
                  {renderStatRows('defense_goalkeeping', defenseStats.home, defenseStats.away)}
                </BrutalistCard>
             </div>
          </div>

          {/* PDF Section 5: Leaders */}
          <div className="pdf-section mb-12 html2pdf__page-break page-break-before-always mt-10">
             <h3 className="text-2xl font-black uppercase border-b-2 border-black mb-6">5. Match Leaders By Action</h3>
             <div className="grid grid-cols-3 gap-6">
                 {matchLeaders.map((leader, i) => (
                     <div key={i} className="border-4 border-black p-3 bg-white">
                        <div className="text-xs font-black text-gray-500 uppercase tracking-widest border-b-2 border-black pb-1 mb-2">{leader.action}</div>
                        
                        <div className="flex items-center gap-4 mb-2">
                           <div className="text-4xl font-black text-black">{leader.topList[0]?.count}</div>
                           <div>
                              <div className="text-sm font-bold uppercase truncate max-w-[150px]">#{leader.topList[0]?.jerseyNo} {leader.topList[0]?.playerName}</div>
                              <div className={`text-[10px] font-black uppercase ${leader.topList[0]?.isHome ? 'text-[#0077B6]' : 'text-[#D90429]'}`}>{leader.topList[0]?.teamName}</div>
                           </div>
                        </div>
      
                        <div className="mt-3 pt-2 border-t border-dashed border-gray-300">
                           <div className="text-[9px] font-black uppercase text-gray-400 mb-1">Next Top 3:</div>
                           {leader.topList.slice(1, 4).map((p, idx) => (
                              <div key={idx} className="flex justify-between items-center text-[11px] font-bold uppercase mb-1">
                                 <span className="truncate max-w-[150px]">
                                    <span className={p.isHome ? "text-[#0077B6]" : "text-[#D90429]"}>#{p.jerseyNo}</span> {p.playerName}
                                 </span>
                                 <span className="font-black">{p.count}</span>
                              </div>
                           ))}
                        </div>
                     </div>
                 ))}
             </div>
          </div>

          {/* PDF Section 6: Analyst Notes */}
          <div className="pdf-section mb-12 html2pdf__page-break page-break-before-always mt-10">
             <h3 className="text-2xl font-black uppercase border-b-2 border-black mb-6">6. Analyst Notes</h3>
             <div className="border-4 border-black p-6 bg-[#FFD166] min-h-[400px]">
                 <pre className="font-mono text-sm font-bold whitespace-pre-wrap">{analystNotes || "No notes provided for this match."}</pre>
             </div>
          </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🖥️ MAIN UI HEADER & NAVIGATION */}
      {/* ========================================================================= */}
      <header className="bg-black text-white p-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="hover:text-[#FFD166]"><ChevronLeft size={28} /></button>
          <h1 className="text-xl font-black uppercase tracking-widest truncate max-w-[200px] md:max-w-none">
            {match.home_team?.team_name} vs {match.away_team?.team_name}
          </h1>
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
                    <div className="text-9xl font-black tracking-tighter relative z-10">{match.home_score}</div>
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
                    <div className="text-9xl font-black tracking-tighter relative z-10">{match.away_score}</div>
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
                    {(statsConfig.summary || [])
                      .filter(e => e.enabled)
                      .sort((a, b) => a.order - b.order)
                      .map(e => {
                        const def = STATS_REGISTRY[e.id];
                        if (!def) return null;
                        return (
                          <div key={e.id} className="flex items-center border-2 border-black bg-white overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <div className="w-1/4 p-4 text-center font-black text-2xl bg-[#0077B6] text-white">
                              {def.getH(stats.home)}
                            </div>
                            <div className="w-2/4 p-4 text-center font-black uppercase tracking-widest text-xs bg-white border-x-2 border-black">
                              {def.label}
                            </div>
                            <div className="w-1/4 p-4 text-center font-black text-2xl bg-[#D90429] text-white">
                              {def.getA(stats.away)}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </section>

                <section>
                  <h3 className="text-2xl font-black uppercase border-b-4 border-black inline-block pb-1 mb-8">Official Team Sheets</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <TeamSheetSide 
                      teamName={match.home_team?.team_name || 'HOME'} 
                      roster={stats.home.roster}
                      colorClass="bg-[#0077B6]"
                    />
                    <TeamSheetSide 
                      teamName={match.away_team?.team_name || 'AWAY'} 
                      roster={stats.away.roster}
                      colorClass="bg-[#D90429]"
                    />
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'DISTRIBUTION' && (
              <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* === SCATTER MODULE === */}
                <section>
                  <h3 className="text-xl font-black uppercase border-b-4 border-black inline-block pb-1 mb-6">Raw Telemetry (Scatter)</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <div className="lg:col-span-3">
                      <FutsalDistributionPitch 
                        filteredEvents={filteredEvents} 
                        homeTeamId={match.home_team_id}
                        lineups={lineups}
                      />
                      <div className="flex gap-4 text-[10px] font-black uppercase mb-4">
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-[#0077B6]"></div> Home Action</div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-[#D90429]"></div> Away Action</div>
                        <div className="flex items-center gap-1 italic text-gray-400 ml-auto">* Hover over points</div>
                      </div>

                      {/* NEW: DYNAMIC SCATTER INSIGHTS (FREE SPACE UTILIZATION) */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Zone Activity */}
                        <div className="border-2 border-black bg-white p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between">
                           <h4 className="text-[10px] font-black uppercase text-gray-400 mb-2 border-b-2 border-black pb-1">Filtered Zone Activity</h4>
                           <div className="flex h-8 border-2 border-black w-full mb-1">
                             {zoneStats.def > 0 && <div className="bg-[#f8fafc] flex items-center justify-center text-[10px] font-black border-r-2 border-black last:border-r-0" style={{width: `${zoneStats.def}%`}}>{zoneStats.def}%</div>}
                             {zoneStats.mid > 0 && <div className="bg-[#FFD166] flex items-center justify-center text-[10px] font-black border-r-2 border-black last:border-r-0" style={{width: `${zoneStats.mid}%`}}>{zoneStats.mid}%</div>}
                             {zoneStats.att > 0 && <div className="bg-black text-white flex items-center justify-center text-[10px] font-black" style={{width: `${zoneStats.att}%`}}>{zoneStats.att}%</div>}
                           </div>
                           <div className="flex justify-between text-[9px] font-black uppercase text-gray-500">
                             <span>Def 3rd</span>
                             <span>Mid 3rd</span>
                             <span>Att 3rd</span>
                           </div>
                        </div>
                        
                        {/* Top Actors */}
                        <div className="border-2 border-black bg-white p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                           <h4 className="text-[10px] font-black uppercase text-gray-400 mb-2 border-b-2 border-black pb-1 flex justify-between">
                             <span>Top Actors (Current Filter)</span>
                             <span>Events</span>
                           </h4>
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
                      <BrutalistCard color="bg-white">
                        <div className="space-y-4">
                          <div className="bg-[#f1f5f9] p-2 border border-black text-center">
                            <div className="text-[9px] font-black text-gray-400">SCATTER DATA POINTS</div>
                            <div className="text-2xl font-black">{filteredEvents.length}</div>
                          </div>
                        </div>
                      </BrutalistCard>

                      <BrutalistCard color="bg-[#f8fafc]">
                        <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-4">
                          <h4 className="text-xs font-black uppercase flex items-center gap-2">
                            <Filter size={14} /> Telemetry Filters
                          </h4>
                          <button onClick={resetScatterFilters} className="text-[10px] font-black uppercase hover:text-[#D90429] flex items-center gap-1">
                            <RefreshCw size={10} /> Reset
                          </button>
                        </div>

                        <div className="space-y-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-gray-400">Team</label>
                            <select 
                              className="w-full border-2 border-black p-2 font-bold uppercase text-xs focus:bg-[#FFD166] outline-none"
                              value={distTeam}
                              onChange={(e) => { setDistTeam(e.target.value); setDistPlayer('ALL'); }}
                            >
                              <option value="ALL">All Teams</option>
                              <option value={match.home_team_id}>{match.home_team?.team_name} (Home)</option>
                              <option value={match.away_team_id}>{match.away_team?.team_name} (Away)</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-gray-400">Player</label>
                            <select 
                              className="w-full border-2 border-black p-2 font-bold uppercase text-xs focus:bg-[#FFD166] outline-none"
                              value={distPlayer}
                              onChange={(e) => setDistPlayer(e.target.value)}
                              disabled={distTeam === 'ALL'}
                            >
                              <option value="ALL">All Players</option>
                              {(distTeam === match.home_team_id) && filterOptions.homePlayers.map(p => (
                                <option key={p.player_id} value={p.player_id}>#{p.jersey_no || '-'} {p.players?.player_name}</option>
                              ))}
                              {(distTeam === match.away_team_id) && filterOptions.awayPlayers.map(p => (
                                <option key={p.player_id} value={p.player_id}>#{p.jersey_no || '-'} {p.players?.player_name}</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-gray-400">Action</label>
                            <select 
                              className="w-full border-2 border-black p-2 font-bold uppercase text-xs focus:bg-[#FFD166] outline-none"
                              value={distAction}
                              onChange={(e) => { setDistAction(e.target.value); setDistOutcome('ALL'); setDistType('ALL'); }}
                            >
                              <option value="ALL">All Actions</option>
                              {filterOptions.actions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-gray-400">Outcome</label>
                            <select 
                              className="w-full border-2 border-black p-2 font-bold uppercase text-xs focus:bg-[#FFD166] outline-none"
                              value={distOutcome}
                              onChange={(e) => { setDistOutcome(e.target.value); setDistType('ALL'); }}
                              disabled={distAction === 'ALL'}
                            >
                              <option value="ALL">All Outcomes</option>
                              {filterOptions.outcomes.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-gray-400">Type</label>
                            <select 
                              className="w-full border-2 border-black p-2 font-bold uppercase text-xs focus:bg-[#FFD166] outline-none"
                              value={distType}
                              onChange={(e) => setDistType(e.target.value)}
                              disabled={distAction === 'ALL' || distOutcome === 'ALL' || filterOptions.types.length === 0}
                            >
                              <option value="ALL">All Types</option>
                              {filterOptions.types.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          </div>

                          {/* Scatter Time Filter */}
                          <div className="pt-2 border-t-2 border-black space-y-2">
                             <label className="text-[10px] font-black uppercase text-gray-400 flex items-center gap-1">
                               <Clock size={12} /> Time Frame (Min)
                             </label>
                             <div className="flex items-center gap-2">
                                <input 
                                  type="number" min="0" max={maxMinute} value={minMinute} 
                                  onChange={(e) => setMinMinute(Math.max(0, Math.min(Number(e.target.value), maxMinute)))}
                                  className="w-full border-2 border-black p-2 font-bold text-xs text-center focus:bg-[#FFD166] outline-none"
                                />
                                <span className="font-black">-</span>
                                <input 
                                  type="number" min={minMinute} max={absoluteMaxMinute} value={maxMinute} 
                                  onChange={(e) => setMaxMinute(Math.max(minMinute, Math.min(Number(e.target.value), absoluteMaxMinute)))}
                                  className="w-full border-2 border-black p-2 font-bold text-xs text-center focus:bg-[#FFD166] outline-none"
                                />
                             </div>
                          </div>
                        </div>
                      </BrutalistCard>
                    </div>
                  </div>
                </section>

                {/* === FIELD TILT MODULE === */}
                <section className="pt-8 border-t-4 border-dashed border-gray-200">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-2">
                    <h3 className="text-xl font-black uppercase border-b-4 border-black inline-block pb-1">Field Tilt</h3>
                    <span className="text-[10px] font-bold text-gray-400 md:max-w-xs md:text-right uppercase tracking-widest leading-tight">
                      * Territorial dominance based on % of actions in the attacking 3rd (Start X &gt; 26m)
                    </span>
                  </div>
                  
                  <BrutalistCard color="bg-[#f8fafc]">
                    <div className="flex justify-between items-center mb-3 font-black text-2xl">
                      <div className="flex flex-col">
                        <span className="text-[#0077B6]">{fieldTiltStats.homeTilt}%</span>
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-[#D90429]">{fieldTiltStats.awayTilt}%</span>
                      </div>
                    </div>
                    
                    <div className="w-full h-10 flex border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white overflow-hidden relative">
                      {/* Midline marker */}
                      <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-black z-10 transform -translate-x-1/2 opacity-20"></div>
                      
                      <div 
                        className="h-full bg-[#0077B6] transition-all duration-1000 ease-out flex items-center justify-start px-3 text-white text-xs font-black uppercase tracking-widest"
                        style={{ width: `${fieldTiltStats.homeTilt}%` }}
                      >
                         {fieldTiltStats.homeTilt > 15 && match.home_team?.team_name}
                      </div>
                      <div 
                        className="h-full bg-[#D90429] transition-all duration-1000 ease-out flex items-center justify-end px-3 text-white text-xs font-black uppercase tracking-widest"
                        style={{ width: `${fieldTiltStats.awayTilt}%` }}
                      >
                        {fieldTiltStats.awayTilt > 15 && match.away_team?.team_name}
                      </div>
                    </div>
                    
                    <div className="flex justify-between mt-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                      <span>{fieldTiltStats.homeActions} Final 3rd Actions</span>
                      <span>{fieldTiltStats.awayActions} Final 3rd Actions</span>
                    </div>
                  </BrutalistCard>
                </section>

                {/* === NEW: AVERAGE POSITIONS MODULE === */}
                <section className="pt-8 border-t-4 border-dashed border-gray-200">
                  <h3 className="text-xl font-black uppercase border-b-4 border-black inline-block pb-1 mb-6">Average Positions</h3>
                  
                  {/* Controls for Average Positions */}
                  <BrutalistCard color="bg-[#f8fafc]" className="mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                      
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-xs font-black uppercase flex items-center gap-2">
                            <Layers size={16} /> Metric Calculation
                          </label>
                          <select 
                            className="w-full border-2 border-black p-3 font-bold uppercase text-sm focus:bg-[#FFD166] outline-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
                            value={avgStatType}
                            onChange={(e) => setAvgStatType(e.target.value)}
                          >
                            <option value="ALL_ACTIONS">Average Position (All Actions)</option>
                            <option value="PASS">Average Pass Position</option>
                            <option value="RECEIVE">Average Pass Receiving Position</option>
                            <option value="SHOT">Average Shot Position</option>
                            <option value="DEFENCE">Average Defence Position (Intercept, Tackle, Block, Save)</option>
                          </select>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-xs font-black uppercase flex items-center gap-2">
                            <Clock size={16} /> Time Frame (Minutes)
                          </label>
                          <div className="flex items-center gap-3">
                             <input 
                               type="number" min="0" max={avgMaxMinute} value={avgMinMinute} 
                               onChange={(e) => setAvgMinMinute(Math.max(0, Math.min(Number(e.target.value), avgMaxMinute)))}
                               className="w-full border-2 border-black p-3 font-bold text-sm text-center focus:bg-[#FFD166] outline-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                             />
                             <span className="font-black">-</span>
                             <input 
                               type="number" min={avgMinMinute} max={absoluteMaxMinute} value={avgMaxMinute} 
                               onChange={(e) => setAvgMaxMinute(Math.max(avgMinMinute, Math.min(Number(e.target.value), absoluteMaxMinute)))}
                               className="w-full border-2 border-black p-3 font-bold text-sm text-center focus:bg-[#FFD166] outline-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                             />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {/* HOME PLAYERS MULTI-SELECT */}
                        <div className="border-2 border-black bg-white flex flex-col h-40">
                          <div className="bg-[#0077B6] text-white p-2 border-b-2 border-black flex justify-between items-center text-[10px] font-black uppercase">
                            <span>{match.home_team?.team_name}</span>
                            <div className="space-x-2">
                              <button onClick={() => handleSelectAllAvgPlayers('HOME', true)} className="hover:underline">All</button>
                              <button onClick={() => handleSelectAllAvgPlayers('HOME', false)} className="hover:underline">None</button>
                            </div>
                          </div>
                          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                            {filterOptions.homePlayers.map(p => (
                              <label key={p.player_id} className="flex items-center gap-2 text-xs font-bold uppercase cursor-pointer hover:bg-[#f1f5f9] p-1">
                                <input 
                                  type="checkbox" 
                                  checked={avgHomePlayers.includes(p.player_id)}
                                  onChange={() => toggleAvgPlayer('HOME', p.player_id)}
                                  className="accent-black w-3 h-3 border-black"
                                />
                                <span>#{p.jersey_no || '-'} {p.players?.player_name}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* AWAY PLAYERS MULTI-SELECT */}
                        <div className="border-2 border-black bg-white flex flex-col h-40">
                          <div className="bg-[#D90429] text-white p-2 border-b-2 border-black flex justify-between items-center text-[10px] font-black uppercase">
                            <span>{match.away_team?.team_name}</span>
                            <div className="space-x-2">
                              <button onClick={() => handleSelectAllAvgPlayers('AWAY', true)} className="hover:underline">All</button>
                              <button onClick={() => handleSelectAllAvgPlayers('AWAY', false)} className="hover:underline">None</button>
                            </div>
                          </div>
                          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                            {filterOptions.awayPlayers.map(p => (
                              <label key={p.player_id} className="flex items-center gap-2 text-xs font-bold uppercase cursor-pointer hover:bg-[#f1f5f9] p-1">
                                <input 
                                  type="checkbox" 
                                  checked={avgAwayPlayers.includes(p.player_id)}
                                  onChange={() => toggleAvgPlayer('AWAY', p.player_id)}
                                  className="accent-black w-3 h-3 border-black"
                                />
                                <span>#{p.jersey_no || '-'} {p.players?.player_name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </BrutalistCard>

                  {/* Dual Pitches Render */}
                  <div className="flex flex-col md:flex-row gap-6">
                    <AveragePositionsPitch 
                      data={avgHomeData} 
                      teamName={match.home_team?.team_name}
                      isHome={true}
                      lineups={lineups}
                    />
                    <AveragePositionsPitch 
                      data={avgAwayData} 
                      teamName={match.away_team?.team_name}
                      isHome={false}
                      lineups={lineups}
                    />
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'ATTACK' && attackStats && (
              <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="border-b-4 border-black pb-2 mb-6 flex items-center justify-between">
                  <h2 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-3">
                    <Target size={32} /> Attacking KPIs
                  </h2>
                </div>

                {/* --- SHOT MAP MODULE --- */}
                <section className="mb-10">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-2">
                    <h3 className="text-xl font-black uppercase border-b-4 border-black inline-block pb-1">Shot Maps (xG)</h3>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-tight">
                        * Dot size indicates xG value
                      </span>
                      <div className="flex items-center gap-3 text-[10px] font-black uppercase text-gray-500">
                        <span className="flex items-center gap-1"><div className="w-3 h-3 border-2 border-black bg-black"></div> Goal</span>
                        <span className="flex items-center gap-1"><div className="w-3 h-3 border-2 border-black bg-transparent"></div> Miss/Save</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col md:flex-row gap-6">
                    <ShotMapPitch 
                      shots={enrichedEvents.filter(e => e.action === 'Shoot' && e.team_id === match.home_team_id)} 
                      teamName={match.home_team?.team_name}
                      isHome={true}
                      lineups={lineups}
                    />
                    <ShotMapPitch 
                      shots={enrichedEvents.filter(e => e.action === 'Shoot' && e.team_id === match.away_team_id)} 
                      teamName={match.away_team?.team_name}
                      isHome={false}
                      lineups={lineups}
                    />
                  </div>
                </section>

                {/* --- NEW: SHOT PLACEMENT MODULE --- */}
                <section className="mb-10 border-t-4 border-dashed border-gray-200 pt-8">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-2">
                    <h3 className="text-xl font-black uppercase border-b-4 border-black inline-block pb-1">Shot Placement Map (Goal Face)</h3>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-tight">
                        * Based on end coordinates (y, z)
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col md:flex-row gap-6">
                    <ShotPlacementPitch 
                      shots={enrichedEvents.filter(e => e.action === 'Shoot' && e.team_id === match.home_team_id)} 
                      teamName={match.home_team?.team_name}
                      isHome={true}
                      lineups={lineups}
                    />
                    <ShotPlacementPitch 
                      shots={enrichedEvents.filter(e => e.action === 'Shoot' && e.team_id === match.away_team_id)} 
                      teamName={match.away_team?.team_name}
                      isHome={false}
                      lineups={lineups}
                    />
                  </div>
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  
                  {/* --- SHOOTING & EFFICIENCY --- */}
                  <BrutalistCard color="bg-white">
                    <h3 className="text-sm font-black uppercase bg-black text-white p-2 mb-4 flex items-center gap-2">
                      <Crosshair size={16} /> Shooting & Efficiency
                    </h3>
                    <div className="flex flex-col">
                      {renderStatRows('attack_shooting', attackStats.home, attackStats.away)}
                    </div>
                  </BrutalistCard>

                  {/* --- DISTRIBUTION & CREATIVITY --- */}
                  <BrutalistCard color="bg-[#f8fafc]">
                    <h3 className="text-sm font-black uppercase bg-black text-[#FFD166] p-2 mb-4 flex items-center gap-2">
                      <Activity size={16} /> Distribution & Creativity
                    </h3>
                    <div className="flex flex-col">
                      {renderStatRows('attack_distribution', attackStats.home, attackStats.away)}
                    </div>
                  </BrutalistCard>

                  {/* --- BALL PROGRESSION --- */}
                  <BrutalistCard color="bg-white">
                    <h3 className="text-sm font-black uppercase bg-black text-white p-2 mb-4 flex items-center gap-2">
                      <Zap size={16} /> Ball Progression
                    </h3>
                    <div className="flex flex-col">
                      {renderStatRows('attack_ball_progression', attackStats.home, attackStats.away)}
                    </div>
                  </BrutalistCard>

                  {/* --- PERFORMANCE UNDER PRESSURE --- */}
                  <BrutalistCard color="bg-[#f8fafc]">
                    <h3 className="text-sm font-black uppercase bg-black text-[#FFD166] p-2 mb-4 flex items-center gap-2">
                      <Shield size={16} /> Performance Under Pressure
                    </h3>
                    <div className="flex flex-col">
                      {renderStatRows('attack_pressure', attackStats.home, attackStats.away)}
                    </div>
                  </BrutalistCard>

                </div>
              </div>
            )}

            {activeTab === 'DEFENSE' && defenseStats && (
              <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="border-b-4 border-black pb-2 mb-6 flex items-center justify-between">
                  <h2 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-3">
                    <Shield size={32} /> Defensive KPIs
                  </h2>
                </div>

                {/* --- DEFENSIVE HEATMAPS (KERNEL DENSITY) --- */}
                <section className="mb-10">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-2">
                    <div className="flex flex-col">
                      <h3 className="text-xl font-black uppercase border-b-4 border-black inline-block pb-1">Defensive Action Density</h3>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-tight mt-1">
                        * Kernel Distribution: Tackles, Interceptions, Blocks, & Saves
                      </span>
                    </div>
                    <div className="flex flex-col md:flex-row items-start md:items-end gap-4 w-full md:w-auto mt-4 md:mt-0">
                      <div className="flex flex-col items-start gap-1 w-full md:w-auto">
                        <label className="text-[10px] font-black uppercase text-gray-400">Defensive Action</label>
                        <select 
                          className="border-2 border-black p-2 font-bold uppercase text-xs focus:bg-[#FFD166] outline-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] w-full md:w-48 cursor-pointer"
                          value={defActionFilter}
                          onChange={handleDefActionChange}
                        >
                          <option value="ALL">All Actions</option>
                          {defActions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      </div>
                      <div className="flex flex-col items-start gap-1 w-full md:w-auto">
                        <label className="text-[10px] font-black uppercase text-gray-400">Outcome Filter</label>
                        <select 
                          className="border-2 border-black p-2 font-bold uppercase text-xs focus:bg-[#FFD166] outline-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] w-full md:w-48 cursor-pointer"
                          value={defOutcomeFilter}
                          onChange={(e) => setDefOutcomeFilter(e.target.value)}
                        >
                          <option value="ALL">All Outcomes</option>
                          {availableDefOutcomes.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col md:flex-row gap-6">
                    <HeatmapPitch 
                      events={enrichedEvents.filter(e => 
                        e.team_id === match.home_team_id && 
                        (defActionFilter === 'ALL' ? defActions.includes(e.action) : e.action === defActionFilter) && 
                        (defOutcomeFilter === 'ALL' || e.outcome === defOutcomeFilter)
                      )} 
                      teamName={match.home_team?.team_name}
                      isHome={true}
                    />
                    <HeatmapPitch 
                      events={enrichedEvents.filter(e => 
                        e.team_id === match.away_team_id && 
                        (defActionFilter === 'ALL' ? defActions.includes(e.action) : e.action === defActionFilter) && 
                        (defOutcomeFilter === 'ALL' || e.outcome === defOutcomeFilter)
                      )} 
                      teamName={match.away_team?.team_name}
                      isHome={false}
                    />
                  </div>
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  
                  {/* --- TACKLING & INTERCEPTIONS --- */}
                  <BrutalistCard color="bg-white">
                    <h3 className="text-sm font-black uppercase bg-black text-white p-2 mb-4 flex items-center gap-2">
                      <Zap size={16} /> Tackling & Interceptions
                    </h3>
                    <div className="flex flex-col">
                      {renderStatRows('defense_tackling', defenseStats.home, defenseStats.away)}
                    </div>
                  </BrutalistCard>

                  {/* --- BLOCKS & CLEARANCES --- */}
                  <BrutalistCard color="bg-[#f8fafc]">
                    <h3 className="text-sm font-black uppercase bg-black text-[#FFD166] p-2 mb-4 flex items-center gap-2">
                      <Shield size={16} /> Blocks & Clearances
                    </h3>
                    <div className="flex flex-col">
                      {renderStatRows('defense_blocks', defenseStats.home, defenseStats.away)}
                    </div>
                  </BrutalistCard>

                  {/* --- POSSESSION GAINS & WORK RATE --- */}
                  <BrutalistCard color="bg-white">
                    <h3 className="text-sm font-black uppercase bg-black text-white p-2 mb-4 flex items-center gap-2">
                      <RefreshCw size={16} /> Work Rate & Recoveries
                    </h3>
                    <div className="flex flex-col">
                      {renderStatRows('defense_work_rate', defenseStats.home, defenseStats.away)}
                    </div>
                  </BrutalistCard>

                  {/* --- GOALKEEPING & DISCIPLINE --- */}
                  <BrutalistCard color="bg-[#f8fafc]">
                    <h3 className="text-sm font-black uppercase bg-black text-[#FFD166] p-2 mb-4 flex items-center gap-2">
                      <ClipboardList size={16} /> Goalkeeping & Discipline
                    </h3>
                    <div className="flex flex-col">
                      {renderStatRows('defense_goalkeeping', defenseStats.home, defenseStats.away)}
                    </div>
                  </BrutalistCard>

                </div>
              </div>
            )}

            {activeTab === 'PLAYER' && p1Data && p2Data && (
              <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="border-b-4 border-black pb-2 mb-6 flex items-center justify-between">
                  <h2 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-3">
                    <Users size={32} /> Player Analysis & Comparison
                  </h2>
                </div>

                {/* --- MATCH LEADERS CARDS --- */}
                <section className="mb-6">
                  <h3 className="text-xl font-black uppercase border-b-4 border-black inline-block pb-1 mb-6">🏆 Match Leaders by Action</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {matchLeaders.map((leader, i) => (
                      <LeaderCard key={i} leader={leader} />
                    ))}
                  </div>
                </section>

                <div className="border-t-4 border-dashed border-gray-200 pt-8"></div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
                  {/* P1 Selector */}
                  <BrutalistCard color="bg-[#f8fafc]" className="border-[#0077B6]">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between mb-2 border-b-2 border-[#0077B6] pb-1">
                        <div className="flex items-center gap-2 text-[#0077B6]">
                          <div className="w-4 h-4 bg-[#0077B6]"></div>
                          <h3 className="font-black uppercase tracking-widest text-sm">Player A (Blue)</h3>
                        </div>
                        <div className="text-xl font-black uppercase tracking-tighter">{p1Data.info.players?.player_name} #{p1Data.info.jersey_no || '-'}</div>
                      </div>
                      <div className="flex gap-2">
                        <select 
                          className="w-1/3 border-2 border-[#0077B6] p-2 font-bold uppercase text-[10px] focus:bg-[#0077B6] focus:text-white outline-none cursor-pointer"
                          value={p1TeamId}
                          onChange={(e) => setP1TeamId(e.target.value)}
                        >
                          <option value={match.home_team_id}>{match.home_team?.team_name}</option>
                          <option value={match.away_team_id}>{match.away_team?.team_name}</option>
                        </select>
                        <select 
                          className="w-2/3 border-2 border-[#0077B6] p-2 font-bold uppercase text-xs focus:bg-[#0077B6] focus:text-white outline-none cursor-pointer"
                          value={p1PlayerId || ''}
                          onChange={(e) => setP1PlayerId(e.target.value)}
                        >
                          {p1Options.map(p => (
                            <option key={p.player_id} value={p.player_id}>
                              #{p.jersey_no || '-'} {p.players?.player_name} ({p.players?.position || 'N/A'})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </BrutalistCard>

                  {/* P2 Selector */}
                  <BrutalistCard color="bg-[#f8fafc]" className="border-[#D90429]">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between mb-2 border-b-2 border-[#D90429] pb-1">
                        <div className="flex items-center gap-2 text-[#D90429]">
                          <div className="w-4 h-4 bg-[#D90429]"></div>
                          <h3 className="font-black uppercase tracking-widest text-sm">Player B (Red)</h3>
                        </div>
                        <div className="text-xl font-black uppercase tracking-tighter">{p2Data.info.players?.player_name} #{p2Data.info.jersey_no || '-'}</div>
                      </div>
                      <div className="flex gap-2">
                        <select 
                          className="w-1/3 border-2 border-[#D90429] p-2 font-bold uppercase text-[10px] focus:bg-[#D90429] focus:text-white outline-none cursor-pointer"
                          value={p2TeamId}
                          onChange={(e) => setP2TeamId(e.target.value)}
                        >
                          <option value={match.home_team_id}>{match.home_team?.team_name}</option>
                          <option value={match.away_team_id}>{match.away_team?.team_name}</option>
                        </select>
                        <select 
                          className="w-2/3 border-2 border-[#D90429] p-2 font-bold uppercase text-xs focus:bg-[#D90429] focus:text-white outline-none cursor-pointer"
                          value={p2PlayerId || ''}
                          onChange={(e) => setP2PlayerId(e.target.value)}
                        >
                          {p2Options.map(p => (
                            <option key={p.player_id} value={p.player_id}>
                              #{p.jersey_no || '-'} {p.players?.player_name} ({p.players?.position || 'N/A'})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </BrutalistCard>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <BrutalistCard color="bg-white">
                    <h3 className="text-xl font-black uppercase border-b-4 border-black inline-block pb-1 mb-6">Radar Comparison</h3>
                    <div className="py-6 bg-[#f8fafc] border-2 border-dashed border-gray-300">
                        <RadarChart p1Data={p1Data} p2Data={p2Data} maxes={matchMaxes} />
                    </div>
                    <div className="text-center mt-4">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-tight">
                            * Chart scaled relative to the highest match values
                        </span>
                    </div>
                  </BrutalistCard>

                  <BrutalistCard color="bg-white">
                    <h3 className="text-xl font-black uppercase border-b-4 border-black inline-block pb-1 mb-6">Head-to-Head Metrics</h3>
                    <div className="flex flex-col">
                      <CompareRow label="Goals (xG)" homeVal={`${p1Data.stats.goals} (${p1Data.stats.xg})`} awayVal={`${p2Data.stats.goals} (${p2Data.stats.xg})`} highlight={true} />
                      <CompareRow label="Total Shots" homeVal={p1Data.stats.shots} awayVal={p2Data.stats.shots} />
                      <CompareRow label="Passes (Acc %)" homeVal={`${p1Data.stats.passes} (${p1Data.stats.passAcc}%)`} awayVal={`${p2Data.stats.passes} (${p2Data.stats.passAcc}%)`} highlight={true}/>
                      <CompareRow label="Tackles (Succ)" homeVal={`${p1Data.stats.tackles} (${p1Data.stats.succTackles})`} awayVal={`${p2Data.stats.tackles} (${p2Data.stats.succTackles})`} />
                      <CompareRow label="Interceptions" homeVal={p1Data.stats.interceptions} awayVal={p2Data.stats.interceptions} highlight={true}/>
                      <CompareRow label="Ball Carries" homeVal={p1Data.stats.carries} awayVal={p2Data.stats.carries} />
                    </div>
                  </BrutalistCard>
                </div>
              </div>
            )}

            {activeTab === 'HIGHLIGHTS' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="border-b-4 border-black pb-2 mb-6 flex items-center justify-between">
                  <h2 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-3">
                    <Video size={32} /> Video Highlights & Replay
                  </h2>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                  {/* VIDEO PLAYER SECTION */}
                  <div className="flex flex-col space-y-4">
                    <BrutalistCard color="bg-black" className="p-2 border-none">
                      <div className="w-full aspect-video bg-gray-900 relative flex items-center justify-center">
                        {!matchVideoUrl ? (
                          <div className="text-gray-500 font-black uppercase flex flex-col items-center gap-2">
                            <Video size={48} />
                            <p>No video linked to this match</p>
                          </div>
                        ) : matchVideoProvider === 'YouTube' ? (
                          <iframe 
                            key={hlForceRender}
                            className="w-full h-full"
                            src={`https://www.youtube-nocookie.com/embed/${getYouTubeId(matchVideoUrl)}?start=${hlSeekTime}&autoplay=1&rel=0&origin=${window.location.origin}`}
                            title="YouTube video player" 
                            frameBorder="0" 
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                            allowFullScreen
                          ></iframe>
                        ) : matchVideoProvider === 'Drive' ? (
                          <iframe 
                            className="w-full h-full"
                            src={`https://drive.google.com/file/d/${getDriveId(matchVideoUrl)}/preview`}
                            title="Drive video player" 
                            allow="autoplay"
                            allowFullScreen
                          ></iframe>
                        ) : (
                          <video 
                            ref={videoRef}
                            className="w-full h-full outline-none"
                            src={matchVideoUrl}
                            controls
                            autoPlay
                          ></video>
                        )}
                      </div>
                    </BrutalistCard>
                    
                    <BrutalistCard color="bg-[#f8fafc]">
                      <div className="text-xs font-bold uppercase text-gray-500 mb-2 border-b-2 border-black pb-1">Video Controls (HTML5)</div>
                      <div className="flex gap-4 text-[10px] font-black uppercase">
                        <span className="bg-white border-2 border-black px-2 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">SPACE = Play/Pause</span>
                        <span className="bg-white border-2 border-black px-2 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">ARROWS = Skip ±5s</span>
                        <span className="text-gray-400 italic mt-1 ml-2">* Raw Video / MP4 Only</span>
                      </div>
                    </BrutalistCard>
                  </div>

                  {/* EVENT TABLE & FILTERS SECTION */}
                  <div className="flex flex-col h-full max-h-[800px]">
                    <BrutalistCard color="bg-white" className="mb-4">
                      <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b-2 border-dashed border-gray-200">
                        <div className="w-full text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Hot Filters</div>
                        {hotFilters.map((hf, i) => (
                          <button 
                            key={i} 
                            onClick={hf.apply}
                            className="bg-[#f1f5f9] border border-black px-2 py-1 text-[10px] font-bold uppercase hover:bg-[#FFD166] transition-colors"
                          >
                            {hf.label}
                          </button>
                        ))}
                        <button onClick={() => { setHlAction('ALL'); setHlOutcome('ALL'); setHlType('ALL'); setHlTeam('ALL'); setHlPlayer('ALL'); }} className="bg-black text-white px-2 py-1 text-[10px] font-bold uppercase hover:bg-gray-800 transition-colors ml-auto">
                           Clear All
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                        <select className="border-2 border-black p-1.5 font-bold uppercase text-[10px] focus:bg-[#FFD166] outline-none cursor-pointer" value={hlTeam} onChange={e => {setHlTeam(e.target.value); setHlPlayer('ALL');}}>
                          <option value="ALL">All Teams</option>
                          <option value={match.home_team_id}>{match.home_team?.team_name}</option>
                          <option value={match.away_team_id}>{match.away_team?.team_name}</option>
                        </select>
                        <select className="border-2 border-black p-1.5 font-bold uppercase text-[10px] focus:bg-[#FFD166] outline-none cursor-pointer" value={hlPlayer} onChange={e => setHlPlayer(e.target.value)} disabled={hlTeam === 'ALL'}>
                          <option value="ALL">All Players</option>
                          {(hlTeam === match.home_team_id) && filterOptions.homePlayers.map(p => <option key={p.player_id} value={p.player_id}>#{p.jersey_no || '-'} {p.players?.player_name}</option>)}
                          {(hlTeam === match.away_team_id) && filterOptions.awayPlayers.map(p => <option key={p.player_id} value={p.player_id}>#{p.jersey_no || '-'} {p.players?.player_name}</option>)}
                        </select>
                        <select className="border-2 border-black p-1.5 font-bold uppercase text-[10px] focus:bg-[#FFD166] outline-none cursor-pointer" value={hlAction} onChange={e => {setHlAction(e.target.value); setHlOutcome('ALL'); setHlType('ALL');}}>
                          <option value="ALL">All Actions</option>
                          {hlFilterOptions.actions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                        <select className="border-2 border-black p-1.5 font-bold uppercase text-[10px] focus:bg-[#FFD166] outline-none cursor-pointer" value={hlOutcome} onChange={e => {setHlOutcome(e.target.value); setHlType('ALL');}} disabled={hlAction === 'ALL'}>
                          <option value="ALL">All Outcomes</option>
                          {hlFilterOptions.outcomes.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                        <select className="border-2 border-black p-1.5 font-bold uppercase text-[10px] focus:bg-[#FFD166] outline-none cursor-pointer" value={hlType} onChange={e => setHlType(e.target.value)} disabled={hlAction === 'ALL' || hlOutcome === 'ALL' || hlFilterOptions.types.length === 0}>
                          <option value="ALL">All Types</option>
                          {hlFilterOptions.types.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      </div>
                    </BrutalistCard>

                    <BrutalistCard color="bg-white" className="flex-1 flex flex-col overflow-hidden">
                      <div className="flex justify-between items-center border-b-2 border-black pb-2 mb-2 shrink-0">
                        <h3 className="text-sm font-black uppercase">Events Timeline</h3>
                        <span className="text-[10px] bg-black text-white px-2 py-1 font-bold">{hlFilteredEvents.length} Events</span>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                        {hlFilteredEvents.length === 0 ? (
                          <div className="py-10 text-center text-[10px] font-bold text-gray-400 uppercase italic">
                            No events match the current filters.
                          </div>
                        ) : (
                          <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-white shadow-sm z-10 text-[9px] font-black text-gray-500 uppercase tracking-widest">
                              <tr>
                                <th className="py-2 border-b-2 border-black">Time</th>
                                <th className="py-2 border-b-2 border-black">Team</th>
                                <th className="py-2 border-b-2 border-black">Player</th>
                                <th className="py-2 border-b-2 border-black">Action</th>
                                <th className="py-2 border-b-2 border-black">Outcome (Type)</th>
                                <th className="py-2 border-b-2 border-black">Reaction Player</th>
                              </tr>
                            </thead>
                            <tbody className="text-[11px] font-bold uppercase">
                              {hlFilteredEvents.map((e, i) => {
                                const isHome = e.team_id === match.home_team_id;
                                const pLineup = lineups.find(l => l.player_id === e.player_id);
                                const rLineup = lineups.find(l => l.player_id === e.reaction_player_id);
                                
                                return (
                                  <tr 
                                    key={i} 
                                    onClick={() => handleEventClick(e.match_time_seconds)}
                                    className="border-b border-gray-200 hover:bg-[#FFD166] cursor-pointer transition-colors"
                                  >
                                    <td className="py-2 font-black text-black">
                                      {Math.floor(e.match_time_seconds / 60)}' {(e.match_time_seconds % 60).toString().padStart(2, '0')}
                                    </td>
                                    <td className="py-2">
                                      <div className={`w-3 h-3 rounded-full ${isHome ? 'bg-[#0077B6]' : 'bg-[#D90429]'}`} title={isHome ? match.home_team?.team_name : match.away_team?.team_name}></div>
                                    </td>
                                    <td className="py-2 truncate max-w-[100px]" title={pLineup?.players?.player_name}>
                                      {pLineup ? `#${pLineup.jersey_no} ${pLineup.players?.player_name}` : 'Unknown'}
                                    </td>
                                    <td className="py-2">{e.action}</td>
                                    <td className="py-2 text-gray-600">
                                      {e.outcome} {e.type !== 'NA' ? <span className="text-[9px] font-black text-gray-400 block">{e.type}</span> : ''}
                                    </td>
                                    <td className="py-2 truncate max-w-[100px] text-gray-500" title={rLineup?.players?.player_name}>
                                      {rLineup ? `#${rLineup.jersey_no} ${rLineup.players?.player_name}` : '-'}
                                    </td>
                                  </tr>
                                )
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
                        <Edit3 size={32} /> Analyst Notes
                      </h2>
                    </div>

                    <BrutalistCard color="bg-[#FFD166]">
                      <div className="mb-4">
                        <h3 className="text-lg font-black uppercase border-b-2 border-black pb-1 inline-block">Match Observations</h3>
                        <p className="text-xs font-bold text-gray-700 mt-1 uppercase">
                           Read-only view.
                        </p>
                      </div>
                      <div className="w-full min-h-[24rem] border-4 border-black p-6 font-mono font-bold text-sm bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] whitespace-pre-wrap">
                        {analystNotes || "No notes provided for this match."}
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

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-left: 1px solid #000; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; }
        
        /* 3D Flip Styles */
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .print-container { position: static !important; width: 100% !important; left: auto !important; }
        }
      `}} />
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
