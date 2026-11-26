// Deep links into match video at a given moment (used by player report clips).

const LEAD_IN_SECONDS = 5

export function youTubeId(url) {
  if (!url) return null
  const m = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|live\/|watch\?v=|&v=)([^#&?]*).*/)
  return m && m[2].length === 11 ? m[2] : null
}

/** URL that opens `videoUrl` at `seconds` (minus a short lead-in), or null if it can't be linked. */
export function clipUrl(videoUrl, seconds) {
  if (!videoUrl || seconds == null) return null
  const t = Math.max(0, Math.floor(Number(seconds)) - LEAD_IN_SECONDS)
  const yt = youTubeId(videoUrl)
  if (yt) return `https://www.youtube.com/watch?v=${yt}&t=${t}s`
  if (videoUrl.includes('drive.google.com')) return videoUrl // Drive links cannot seek
  return `${videoUrl.split('#')[0]}#t=${t}`
}
