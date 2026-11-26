'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Play, Pause, SkipBack, SkipForward, ExternalLink } from 'lucide-react'
import { youTubeId, clipUrl } from '../../lib/video.js'
import { isAssist, isKeyPass, isProgressivePass, isProgressiveCarry } from '../../lib/playerStats.js'

// In-report video: filter the player's actions, click one to watch it, or
// "Play all" to watch every clip in the filter back to back (jumping across
// matches). Screen only — the report's print/PDF leaves this section out.

const BEFORE = 5 // seconds shown before the action
const AFTER = 5  // seconds shown after it

const TACKLES = ['Standing Tackle', 'Sliding Tackle']
const won = (e) => e.outcome === 'Successful'

/** Clip categories: [key, label, test(event, cfg)] — order = chip order. */
const CATEGORIES = [
  ['shots', 'Shots', e => e.action === 'Shoot'],
  ['goals', 'Goals', e => e.action === 'Shoot' && e.outcome === 'Goal'],
  ['chances', 'Assists & key passes', e => isAssist(e) || isKeyPass(e)],
  ['progpass', 'Progressive passes', (e, cfg) => isProgressivePass(e, cfg)],
  ['dribbles', 'Dribbles won', e => e.action === 'Dribble' && (e.outcome === 'Successful' || e.outcome === 'Foul Won')],
  ['carries', 'Progressive carries', (e, cfg) => isProgressiveCarry(e, cfg)],
  ['tackles', 'Tackles won', e => TACKLES.includes(e.action) && won(e)],
  ['interceptions', 'Interceptions', e => e.action === 'Pass Intercept' && won(e)],
  ['blocks', 'Blocks & clearances', e => (e.action === 'Block' && won(e)) || e.action === 'Clearance'],
  ['pressures', 'Pressures', e => e.action === 'Pressure'],
  ['saves', 'Saves', e => e.action === 'Save'],
  ['losses', 'Ball losses', e => e.action === 'Ball Control' || (e.action === 'Dribble' && e.outcome === 'Unsuccessful')],
]

function clipLabel(e) {
  if (e.action === 'Shoot') return `Shot · ${e.outcome}`
  if (isAssist(e)) return 'Assist'
  if (isKeyPass(e)) return 'Key pass'
  if (e.action === 'Pass' || e.action === 'Through Ball') return `${e.action} · ${e.outcome}`
  return `${e.action}${e.outcome && e.outcome !== 'Unknown' ? ' · ' + e.outcome : ''}`
}

const shortDate = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '?')

// Load the YouTube IFrame API once per page
let ytReady = null
function loadYouTubeApi() {
  if (typeof window === 'undefined') return Promise.reject()
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (!ytReady) {
    ytReady = new Promise(resolve => {
      const prev = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT) }
      const s = document.createElement('script')
      s.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(s)
    })
  }
  return ytReady
}

export default function VideoClips({ events, cfg }) {
  const [active, setActive] = useState(['shots'])      // selected category keys
  const [current, setCurrent] = useState(null)         // index into `clips`
  const [playingAll, setPlayingAll] = useState(false)
  const [paused, setPaused] = useState(false)
  const holder = useRef(null)
  const player = useRef(null)
  const state = useRef({})                             // latest values for player callbacks

  // Every clip-able event with its categories and video id
  const all = useMemo(() => events
    .filter(e => e.match_time_seconds != null && !['Match Time', 'Substitution'].includes(e.action))
    .map(e => ({ e, cats: CATEGORIES.filter(([, , test]) => test(e, cfg)).map(([k]) => k), vid: youTubeId(e._match?.video_url) }))
    .filter(c => c.cats.length)
    .sort((a, b) => String(a.e._match?.match_date).localeCompare(String(b.e._match?.match_date)) || a.e.match_time_seconds - b.e.match_time_seconds),
  [events, cfg])

  const counts = useMemo(() => Object.fromEntries(CATEGORIES.map(([k]) => [k, all.filter(c => c.cats.includes(k)).length])), [all])
  const clips = useMemo(() => all.filter(c => c.cats.some(k => active.includes(k))), [all, active])
  const playable = clips.filter(c => c.vid)

  state.current = { clips, current, playingAll }

  const toggleCat = (k) => {
    setPlayingAll(false); setCurrent(null)
    setActive(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])
  }

  // Play clip i (skips clips without a YouTube video when playing all)
  const playIndex = async (i, auto = false) => {
    const list = state.current.clips
    let j = i
    while (auto && j < list.length && !list[j].vid) j++
    if (j >= list.length) { setPlayingAll(false); return }
    const c = list[j]
    if (!c.vid) return
    setCurrent(j); setPaused(false)
    const start = Math.max(0, Math.floor(c.e.match_time_seconds) - BEFORE)
    const end = Math.floor(c.e.match_time_seconds) + AFTER
    const YT = await loadYouTubeApi()
    if (!player.current) {
      player.current = new YT.Player(holder.current, {
        width: '100%', height: '100%',
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1, origin: window.location.origin },
        events: {
          onReady: (ev) => ev.target.loadVideoById({ videoId: c.vid, startSeconds: start, endSeconds: end }),
          onStateChange: (ev) => {
            if (ev.data === 0) { // ended (reached endSeconds)
              const { current: cur, playingAll: all } = state.current
              if (all) playIndex(cur + 1, true)
            }
            setPaused(ev.data === 2)
          },
        },
      })
    } else {
      player.current.loadVideoById({ videoId: c.vid, startSeconds: start, endSeconds: end })
    }
  }

  const playAll = () => { setPlayingAll(true); state.current.playingAll = true; playIndex(0, true) }
  const step = (d) => { if (current == null) return; const n = current + d; if (n >= 0 && n < clips.length) playIndex(n, true) }
  const togglePause = () => {
    const p = player.current
    if (!p) return
    if (paused) p.playVideo(); else p.pauseVideo()
  }

  useEffect(() => () => { try { player.current?.destroy() } catch { /* already gone */ } }, [])

  const now = current != null ? clips[current] : null

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Clip types">
        {CATEGORIES.filter(([k]) => counts[k] > 0).map(([k, label]) => {
          const on = active.includes(k)
          return (
            <button key={k} type="button" onClick={() => toggleCat(k)} aria-pressed={on}
              className={`rounded-full px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${on ? 'bg-[#0B0D0B] text-white' : 'bg-[#F0F2EE] text-[#0B0D0B] hover:bg-[#EFFAEC]'}`}>
              {label} <span className={on ? 'text-[#6BDB58]' : 'text-[#5B6359]'}>{counts[k]}</span>
            </button>
          )
        })}
      </div>

      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-5">
        {/* Player */}
        <div>
          <div className="relative aspect-video rounded-[16px] overflow-hidden bg-[#0B0D0B]">
            <div ref={holder} className="absolute inset-0" />
            {!now && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white text-center p-6 pointer-events-none">
                <p className="font-mono text-xs uppercase tracking-widest text-[#9AA397]">{clips.length} clip{clips.length !== 1 ? 's' : ''} selected</p>
                <p className="text-sm text-[#D6DBD3] max-w-sm">Click a clip on the right, or press Play all to watch them back to back.</p>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button type="button" onClick={playAll} disabled={!playable.length}
              className="inline-flex items-center gap-2 rounded-full bg-[#0B0D0B] text-white px-4 py-2 font-mono font-bold uppercase text-xs hover:bg-[#23801A] disabled:opacity-40">
              <Play size={14} /> Play all ({playable.length})
            </button>
            <button type="button" onClick={() => step(-1)} disabled={current == null || current === 0} aria-label="Previous clip"
              className="rounded-full border-2 border-[#D6DBD3] p-2 hover:border-[#0B0D0B] disabled:opacity-30"><SkipBack size={14} /></button>
            <button type="button" onClick={togglePause} disabled={current == null} aria-label={paused ? 'Play' : 'Pause'}
              className="rounded-full border-2 border-[#D6DBD3] p-2 hover:border-[#0B0D0B] disabled:opacity-30">{paused ? <Play size={14} /> : <Pause size={14} />}</button>
            <button type="button" onClick={() => step(1)} disabled={current == null || current >= clips.length - 1} aria-label="Next clip"
              className="rounded-full border-2 border-[#D6DBD3] p-2 hover:border-[#0B0D0B] disabled:opacity-30"><SkipForward size={14} /></button>
            {now && (
              <span className="font-mono text-xs text-[#5B6359] ml-1">
                {playingAll ? 'Playing all · ' : ''}{current + 1}/{clips.length} · {shortDate(now.e._match?.match_date)} {now.e.match_minute ?? '?'}′ · {clipLabel(now.e)}
              </span>
            )}
          </div>
        </div>

        {/* Playlist */}
        <ol className="max-h-[440px] overflow-y-auto rounded-[16px] bg-[#F0F2EE] p-2 space-y-1" aria-label="Clips">
          {clips.length === 0 && <li className="p-4 text-sm text-[#5B6359]">Pick at least one clip type above.</li>}
          {clips.map((c, i) => {
            const meta = <span className={`block font-mono text-[10px] uppercase tracking-wider ${i === current ? 'text-[#D6DBD3]' : 'text-[#5B6359]'}`}>
              {shortDate(c.e._match?.match_date)} · {c.e.match_minute ?? '?'}′ · v {c.e._oppName || '?'}
            </span>
            return (
              <li key={c.e.processed_event_id}>
                {c.vid ? (
                  <button type="button" onClick={() => { setPlayingAll(false); playIndex(i) }}
                    className={`w-full flex items-center gap-3 rounded-[10px] px-3 py-2 text-left text-sm transition-colors ${i === current ? 'bg-[#0B0D0B] text-white' : 'hover:bg-white'}`}>
                    <span className={`font-mono text-[10px] w-6 text-right ${i === current ? 'text-[#6BDB58]' : 'text-[#9AA397]'}`}>{i + 1}</span>
                    <span className="min-w-0 flex-1"><span className="block font-semibold truncate">{clipLabel(c.e)}</span>{meta}</span>
                  </button>
                ) : (
                  // Not a YouTube video: can't play inside the report, so link out (or show "no video")
                  <div className="flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm opacity-70">
                    <span className="font-mono text-[10px] w-6 text-right text-[#9AA397]">{i + 1}</span>
                    <span className="min-w-0 flex-1"><span className="block font-semibold truncate">{clipLabel(c.e)}</span>{meta}</span>
                    {c.e._match?.video_url
                      ? <a href={clipUrl(c.e._match.video_url, c.e.match_time_seconds)} target="_blank" rel="noopener noreferrer" className="text-[#23801A]" aria-label="Open video in a new tab"><ExternalLink size={14} /></a>
                      : <span className="font-mono text-[10px] uppercase text-[#9AA397]">no video</span>}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
