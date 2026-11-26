'use client'

import { useMemo, useState } from 'react'
import CacLogo from '../ui/CacLogo.jsx'
import BrutalistCard from '../ui/BrutalistCard.jsx'
import HeatmapPitch, { PASS_OUTCOME_LEGEND } from '../pitch/HeatmapPitch.jsx'
import ShotMapPitch from '../pitch/ShotMapPitch.jsx'
import ShotPlacementPitch from '../pitch/ShotPlacementPitch.jsx'
import { PercentileBar, PercentileRadar, TrendChart, pctColor } from './PlayerCharts.jsx'
import { PLAYER_STATS, PLAYER_TREND_METRICS } from '../../lib/statsRegistry.js'
import { calculateXG } from '../../lib/xg.js'
import { getPitchConfig } from '../../lib/pitchConfig.js'
import { isAssist, isKeyPass, isDefensiveWin, perUnitLabel } from '../../lib/playerStats.js'
import { clipUrl } from '../../lib/video.js'

const GROUP_TITLE = {
  goalkeeper: 'Goalkeeper', 'centre-back': 'Centre-back', 'full-back': 'Full-back',
  midfielder: 'Midfielder', winger: 'Winger', striker: 'Striker',
}

export const fmtStat = (k, v) => {
  if (v == null || Number.isNaN(v)) return '–'
  const def = PLAYER_STATS[k]
  if (def?.kind === 'pct') return `${Math.round(v)}%`
  return v.toFixed(def?.dp ?? 2)
}
const signed = (v) => (v == null ? '–' : `${v > 0 ? '+' : ''}${v.toFixed(2)}`)
const fmtDate = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '')
const shortDate = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '?')

function ageFrom(dob) {
  if (!dob) return null
  const b = new Date(dob + 'T00:00:00'), n = new Date()
  let a = n.getFullYear() - b.getFullYear()
  if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--
  return a
}

function Section({ n, title, children, kicker }) {
  return (
    <section className="report-section mb-10">
      <div className="print-only report-print-header">
        <CacLogo className="w-10 h-auto" /><span>CAC Player Report</span>
      </div>
      <div className="flex items-baseline gap-3 mb-4">
        <span className="font-mono text-xs font-bold text-[#23801A]">{String(n).padStart(2, '0')}</span>
        <h2 className="text-2xl md:text-3xl uppercase leading-none">{title}</h2>
      </div>
      {kicker && <p className="font-mono text-[11px] text-[#5B6359] uppercase tracking-wider -mt-2 mb-4">{kicker}</p>}
      {children}
    </section>
  )
}

export default function PlayerReport({ report: r, profile, summary, onFormatChange }) {
  const [selectedShotId, setSelectedShotId] = useState(null)
  const unit = perUnitLabel(r.isFutsal)
  const cfg = getPitchConfig(r.isFutsal)
  const teamName = r.currentTeam
  const age = ageFrom(profile?.date_of_birth)
  const minutesStr = `${Math.round(r.minutes)}${r.minutesApprox ? ' (approx.)' : ''}`

  const fakeLineup = useMemo(() => [{ player_id: r.player.player_id, jersey_no: null, players: { player_name: r.player.player_name } }], [r.player])
  const ballEvents = useMemo(() => r.actor.filter(e => e.start_x != null && !['Substitution', 'Match Time'].includes(e.action)), [r.actor])
  const shots = useMemo(() => r.actor.filter(e => e.action === 'Shoot').map(e => ({ ...e, xg: calculateXG(e, cfg) })), [r.actor, cfg])
  const passCarry = useMemo(() => ballEvents.filter(e => ['Pass', 'Through Ball', 'Carry', 'Dribble'].includes(e.action)), [ballEvents])
  const defensive = useMemo(() => ballEvents.filter(e => ['Standing Tackle', 'Sliding Tackle', 'Pass Intercept', 'Block', 'Clearance', 'Pressure'].includes(e.action)), [ballEvents])

  const clips = useMemo(() => {
    const tag = (e) => e.action === 'Shoot' ? `Shot · ${e.outcome}` : isAssist(e) ? 'Assist' : isKeyPass(e) ? 'Key pass' : `${e.action} won`
    const pick = (fn) => r.actor.filter(fn).map(e => ({ e, label: tag(e), url: clipUrl(e._match?.video_url, e.match_time_seconds) }))
      .sort((a, b) => String(a.e._match?.match_date).localeCompare(String(b.e._match?.match_date)) || a.e.match_time_seconds - b.e.match_time_seconds)
    return [
      { title: 'Shots', items: pick(e => e.action === 'Shoot') },
      { title: 'Assists & key passes', items: pick(e => isAssist(e) || isKeyPass(e)) },
      { title: 'Defensive wins', items: pick(isDefensiveWin) },
    ]
  }, [r.actor])

  const sec = (n) => (summary ? n : n - 1) // section numbers close up when there is no summary
  const radarAxes = r.radarKeys.map(k => ({ label: PLAYER_STATS[k]?.label || k, value: r.percentiles[k] }))
  const trendSeries = PLAYER_TREND_METRICS.map(k => ({ label: `${PLAYER_STATS[k].label} ${unit}`, values: r.perMatch.map(m => m.per90[k]) }))
  const poolNote = r.poolSize ? `Percentiles vs ${r.poolSize} CAC ${r.poolLabel} with ${r.poolMinMinutes}+ minutes (${r.isFutsal ? 'futsal' : '11-a-side'})` : `Not enough CAC ${r.poolLabel || 'players'} with ${r.poolMinMinutes}+ minutes yet for percentiles`

  const detail = [
    ['Position', GROUP_TITLE[r.group] + (r.player.position ? ` (${r.player.position})` : r.groupInferred ? ' (from match data)' : '')],
    ['Age', age != null ? `${age}` : null],
    ['Foot', profile?.preferred_foot],
    ['Height', profile?.height_cm ? `${profile.height_cm} cm` : null],
    ['Weight', profile?.weight_kg ? `${profile.weight_kg} kg` : null],
    ['Nationality', profile?.nationality],
    ['Current team', teamName],
  ].filter(([, v]) => v)

  return (
    <div className="player-report">
      {/* 1. Player card */}
      <section className="report-section mb-10">
        <div className="rounded-[24px] bg-[#0B0D0B] text-white p-6 md:p-8 relative overflow-hidden">
          <div className="flex justify-between items-start gap-6 flex-wrap">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#6BDB58] mb-2">CAC Player Report · {r.isFutsal ? 'Futsal' : 'Football'}</p>
              <h1 className="text-4xl md:text-6xl uppercase leading-[0.95] [word-spacing:0.2em]">{r.player.player_name}</h1>
              <dl className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-3">
                {detail.map(([k, v]) => (
                  <div key={k}>
                    <dt className="font-mono text-[10px] uppercase tracking-widest text-[#9AA397]">{k}</dt>
                    <dd className="font-bold">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="text-right">
              <CacLogo className="w-20 h-auto ml-auto" light />
              <p className="font-mono text-[10px] uppercase tracking-widest text-[#9AA397] mt-3">As of {fmtDate(new Date().toISOString().slice(0, 10))}</p>
            </div>
          </div>
          <div className="mt-6 pt-5 border-t border-white/15 grid grid-cols-3 gap-4">
            <div><div className="font-display italic font-black text-3xl md:text-4xl tabular-nums">{r.perMatch.length}</div><div className="font-mono text-[10px] uppercase tracking-widest text-[#9AA397]">Matches</div></div>
            <div><div className="font-display italic font-black text-3xl md:text-4xl tabular-nums">{minutesStr}</div><div className="font-mono text-[10px] uppercase tracking-widest text-[#9AA397]">Minutes</div></div>
            <div><div className="font-display italic font-black text-3xl md:text-4xl tabular-nums text-[#6BDB58]">{r.consistency ?? '–'}</div><div className="font-mono text-[10px] uppercase tracking-widest text-[#9AA397]">Consistency /100</div></div>
          </div>
          <p className="font-mono text-[11px] text-[#9AA397] mt-4">
            {r.perMatch.map(m => `${shortDate(m.match.match_date)} v ${m.oppName || '?'}`).join(' · ')}
          </p>
        </div>
        {r.formats.length > 1 && onFormatChange && (
          <div className="no-print mt-3 flex gap-2 font-mono text-xs">
            <span className="text-[#5B6359] self-center uppercase">This player has futsal and 11-a-side matches:</span>
            {r.formats.map(f => (
              <button key={String(f)} onClick={() => onFormatChange(f)} className={`rounded-full px-3 py-1 font-bold uppercase ${f === r.isFutsal ? 'bg-[#0B0D0B] text-white' : 'bg-[#F0F2EE]'}`}>{f ? 'Futsal' : '11-a-side'}</button>
            ))}
          </div>
        )}
      </section>

      {/* 2. Scout summary */}
      {summary && (
        <Section n={2} title={<>Scout <span className="hl">summary</span></>}>
          {summary}
        </Section>
      )}

      {/* 3. Key numbers */}
      <Section n={sec(3)} title={<>Key <span className="hl">numbers</span></>} kicker={`Counting stats ${unit} minutes · ${poolNote}`}>
        <div className="grid md:grid-cols-2 gap-x-10 gap-y-3">
          {r.keyNumbers.map(k => (
            <div key={k} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1">
              <span className="font-bold text-sm" title={PLAYER_STATS[k].info}>{PLAYER_STATS[k].label}</span>
              <span className="font-mono text-sm font-bold tabular-nums">{fmtStat(k, r.values[k])}
                <span className="ml-2 inline-block w-10 text-right text-[11px]" style={{ color: pctColor(r.percentiles[k]) === '#C9CFC6' ? '#5B6359' : pctColor(r.percentiles[k]) }}>{r.percentiles[k] != null ? `P${r.percentiles[k]}` : ''}</span>
              </span>
              <div className="col-span-2"><PercentileBar value={r.percentiles[k]} /></div>
            </div>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
          <BrutalistCard>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#5B6359]">Goals − xG</p>
            <p className="font-display italic font-black text-3xl tabular-nums">{signed(r.values.goalsMinusXg)}</p>
            <p className="text-xs text-[#5B6359]">{r.totals.goals} goals from {r.totals.xg.toFixed(2)} xG</p>
          </BrutalistCard>
          <BrutalistCard>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#5B6359]">Assists − xA</p>
            <p className="font-display italic font-black text-3xl tabular-nums">{signed(r.values.assistsMinusXa)}</p>
            <p className="text-xs text-[#5B6359]">{r.totals.assists} assists from {r.totals.xa.toFixed(2)} xA</p>
          </BrutalistCard>
          <BrutalistCard>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#5B6359]">Under pressure</p>
            <p className="font-display italic font-black text-3xl tabular-nums">{fmtStat('pressPassAcc', r.values.pressPassAcc)}</p>
            <p className="text-xs text-[#5B6359]">pass accuracy ({r.totals.pressPasses} passes) vs {fmtStat('passAcc', r.values.noPressPassAcc)} without pressure · retention {fmtStat('pressRetention', r.values.pressRetention)}</p>
          </BrutalistCard>
          <BrutalistCard>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#5B6359]">Share of team progression</p>
            {r.teamContextMatches ? (
              <>
                <p className="font-display italic font-black text-3xl tabular-nums">{fmtStat('progShare', r.values.progShare)}</p>
                <p className="text-xs text-[#5B6359]">of the team's progressive passes and carries, {r.teamContextMatches} match{r.teamContextMatches > 1 ? 'es' : ''} with team tagging</p>
              </>
            ) : <p className="text-xs text-[#5B6359] mt-2">Not available: these matches were tagged in player-only mode, so there is no team context.</p>}
          </BrutalistCard>
        </div>
        {r.playerModeMatches > 0 && r.teamContextMatches > 0 && (
          <p className="font-mono text-[10px] text-[#5B6359] mt-2">{r.playerModeMatches} player-only match{r.playerModeMatches > 1 ? 'es are' : ' is'} left out of team-share metrics.</p>
        )}
      </Section>

      {/* 4. Radar */}
      <Section n={sec(4)} title={<>{GROUP_TITLE[r.group]} <span className="hl">profile</span></>} kicker={poolNote}>
        <div className="grid md:grid-cols-[1.2fr_1fr] gap-8 items-center">
          {radarAxes.some(a => a.value != null) ? <PercentileRadar axes={radarAxes} /> : (
            <BrutalistCard><p className="text-sm text-[#5B6359]">The radar shows percentiles against other CAC {r.poolLabel || 'players'}. It fills in once enough players have {r.poolMinMinutes}+ minutes of processed data in this format. The raw numbers are on the right.</p></BrutalistCard>
          )}
          <ul className="space-y-2 text-sm">
            {r.radarKeys.map(k => (
              <li key={k} className="flex justify-between gap-4 border-b border-[#D6DBD3] pb-1.5">
                <span>{PLAYER_STATS[k]?.label}</span>
                <span className="font-mono font-bold tabular-nums">{fmtStat(k, r.values[k])}{PLAYER_STATS[k]?.kind === 'p90' ? <span className="text-[#5B6359] font-normal"> {unit}</span> : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* 5. Match by match */}
      <Section n={sec(5)} title={<>Match by <span className="hl">match</span></>} kicker={r.best && r.worst ? 'Best and worst match by CAC impact score (decisive and progressive actions minus losses, per 90)' : null}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase text-[#5B6359] border-b-2 border-[#0B0D0B]">
                <th className="py-2 pr-3">Date</th><th className="pr-3">Opponent</th><th className="pr-3 text-right">Min</th>
                <th className="pr-3 text-right">G</th><th className="pr-3 text-right">A</th><th className="pr-3 text-right">xG</th><th className="pr-3 text-right">xA</th>
                <th className="pr-3 text-right">Key P</th><th className="pr-3 text-right">Prog</th><th className="pr-3 text-right">Pass %</th><th className="pr-3 text-right">Duels</th><th className="text-right">Recov</th>
              </tr>
            </thead>
            <tbody>
              {r.perMatch.map(m => {
                const tag = m === r.best ? 'best' : m === r.worst ? 'worst' : null
                return (
                  <tr key={m.match.match_id} className={`border-b border-[#D6DBD3] ${tag === 'best' ? 'bg-[#EFFAEC]' : tag === 'worst' ? 'bg-[#F0F2EE]' : ''}`}>
                    <td className="py-2 pr-3 font-mono whitespace-nowrap">{shortDate(m.match.match_date)}</td>
                    <td className="pr-3 font-bold">{m.oppName || '?'}{tag && <span className={`ml-2 rounded-full px-2 py-0.5 font-mono text-[9px] uppercase ${tag === 'best' ? 'bg-[#6BDB58]' : 'bg-[#0B0D0B] text-white'}`}>{tag}</span>}</td>
                    <td className="pr-3 text-right font-mono">{Math.round(m.minutes)}{m.approx ? '~' : ''}</td>
                    <td className="pr-3 text-right font-mono">{m.stats.goals}</td>
                    <td className="pr-3 text-right font-mono">{m.stats.assists}</td>
                    <td className="pr-3 text-right font-mono">{m.stats.xg.toFixed(2)}</td>
                    <td className="pr-3 text-right font-mono">{m.stats.xa.toFixed(2)}</td>
                    <td className="pr-3 text-right font-mono">{m.stats.keyPasses}</td>
                    <td className="pr-3 text-right font-mono">{m.stats.progActions}</td>
                    <td className="pr-3 text-right font-mono">{m.stats.passes ? Math.round((m.stats.passesOk / m.stats.passes) * 100) + '%' : '–'}</td>
                    <td className="pr-3 text-right font-mono">{m.stats.duelsWon}/{m.stats.duels}</td>
                    <td className="text-right font-mono">{m.stats.recoveries}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {r.minutesApprox && <p className="font-mono text-[10px] text-[#5B6359] mt-2">~ approx. minutes: estimated from the player's tagged events (no lineup sub times or substitution events).</p>}
        </div>
        {r.perMatch.length > 1 && (
          <BrutalistCard className="mt-6">
            <TrendChart labels={r.perMatch.map(m => shortDate(m.match.match_date))} series={trendSeries} />
          </BrutalistCard>
        )}
      </Section>

      {/* 6. On the pitch */}
      <Section n={sec(6)} title={<>On the <span className="hl">pitch</span></>} kicker={`${r.perMatch.length > 1 ? `All ${r.perMatch.length} matches combined` : '1 match'} · attacking left to right`}>
        <div className="grid md:grid-cols-2 gap-6 pitch-grid">
          <div><h4 className="text-sm uppercase mb-2">Heatmap · all actions</h4>
            <HeatmapPitch events={ballEvents} teamName={r.player.player_name} isHome isFutsal={r.isFutsal} /></div>
          <div><h4 className="text-sm uppercase mb-2">Shot map · bubble size = xG</h4>
            {shots.length ? <ShotMapPitch shots={shots} teamName={`${shots.length} shots · ${r.totals.xg.toFixed(2)} xG`} isHome lineups={fakeLineup} isFutsal={r.isFutsal} selectedShotId={selectedShotId} onSelectShot={setSelectedShotId} />
              : <BrutalistCard><p className="text-sm text-[#5B6359]">No shots in these matches.</p></BrutalistCard>}</div>
          <div><h4 className="text-sm uppercase mb-2">Shot placement</h4>
            {shots.length ? <ShotPlacementPitch shots={shots} teamName={r.player.player_name} isHome lineups={fakeLineup} isFutsal={r.isFutsal} />
              : <BrutalistCard><p className="text-sm text-[#5B6359]">No shots in these matches.</p></BrutalistCard>}</div>
          <div><h4 className="text-sm uppercase mb-2">Passes, carries & dribbles</h4>
            <HeatmapPitch events={passCarry} teamName={`${passCarry.length} actions`} isHome isFutsal={r.isFutsal} showEvents />
            <div className="flex flex-wrap gap-3 mt-2 font-mono text-[10px] uppercase">
              {PASS_OUTCOME_LEGEND.map(([label, color]) => <span key={label} className="flex items-center gap-1"><span className="inline-block w-3 h-[3px]" style={{ background: color }} />{label}</span>)}
            </div></div>
          <div className="md:col-span-2"><h4 className="text-sm uppercase mb-2">Defensive actions · tackles, interceptions, blocks, clearances, pressures</h4>
            <div className="max-w-2xl"><HeatmapPitch events={defensive} teamName={`${defensive.length} actions`} isHome isFutsal={r.isFutsal} showEvents /></div></div>
        </div>
      </Section>

      {/* 7. Clips */}
      <Section n={sec(7)} title={<>Watch the <span className="hl">clips</span></>} kicker="Each link opens the match video 5 seconds before the action">
        <div className="grid md:grid-cols-3 gap-6">
          {clips.map(group => (
            <div key={group.title}>
              <h4 className="text-sm uppercase mb-2">{group.title} <span className="font-mono text-[#5B6359]">({group.items.length})</span></h4>
              {group.items.length === 0 ? <p className="text-sm text-[#5B6359]">None.</p> : (
                <ul className="space-y-1 text-sm max-h-[420px] overflow-y-auto pr-2 clip-list">
                  {group.items.map(({ e, label, url }) => (
                    <li key={e.processed_event_id} className="flex justify-between gap-3 border-b border-[#D6DBD3] py-1">
                      <span><span className="font-mono text-[#5B6359]">{shortDate(e._match?.match_date)} · {e.match_minute ?? '?'}′</span> {label}</span>
                      {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="font-mono text-xs font-bold text-[#23801A] underline whitespace-nowrap">Watch ▸</a>
                        : <span className="font-mono text-[10px] text-[#9AA397] whitespace-nowrap">no video</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* 8. Footer */}
      <footer className="report-section border-t-2 border-[#0B0D0B] pt-6 mt-4 grid md:grid-cols-[auto_1fr] gap-6 items-start text-sm">
        <CacLogo className="w-16 h-auto" />
        <div className="space-y-2 text-[#5B6359]">
          <p><strong className="text-[#0B0D0B]">Data source.</strong> Event data tagged by CAC analysts from match video, frame by frame, then processed (halves, minutes, attacking direction left to right). {r.playerModeMatches ? `${r.playerModeMatches} of ${r.perMatch.length} matches were tagged in player-only mode; opponents in those matches are recorded as a single stand-in. ` : ''}Minutes come from lineup sub times where recorded{r.minutesApprox ? ', otherwise they are estimated from tagged events' : ''}.</p>
          <p><strong className="text-[#0B0D0B]">Method.</strong> Counting stats are {unit} minutes. xG uses the CAC model (distance, angle, technique, assist type, pressure). {poolNote}.</p>
          <p><strong className="text-[#0B0D0B]">Contact.</strong> CAC · <a className="underline" href="https://calcioac.com">calcioac.com</a></p>
        </div>
      </footer>
    </div>
  )
}
