'use client'

// Small chart pieces for the player report, in the CAC deck theme.

const INK = '#0B0D0B', ACCENT = '#6BDB58', ACCENT_INK = '#23801A', LINE = '#D6DBD3', MUTED = '#5B6359'

export const pctColor = (p) => (p == null ? LINE : p >= 80 ? ACCENT_INK : p >= 60 ? ACCENT : p >= 40 ? '#9AA397' : '#C9CFC6')

/** Horizontal percentile bar: 0–100 with ticks at 25 / 50 / 75. */
export function PercentileBar({ value }) {
  return (
    <div className="relative h-2.5 w-full rounded-full bg-[#E4E8E1] overflow-hidden" aria-label={value == null ? 'No percentile' : `${value}th percentile`}>
      {[25, 50, 75].map(t => <div key={t} className="absolute top-0 bottom-0 w-px bg-white" style={{ left: `${t}%` }} />)}
      {value != null && <div className="absolute left-0 top-0 bottom-0 rounded-full" style={{ width: `${Math.max(3, value)}%`, background: pctColor(value) }} />}
    </div>
  )
}

/** Radar of percentiles (0–100) for 6–8 metrics. */
export function PercentileRadar({ axes }) {
  const size = 320, c = size / 2, R = size * 0.36
  const n = axes.length
  const pt = (v, i, r = R) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2
    const rr = ((v ?? 0) / 100) * r
    return [c + rr * Math.cos(a), c + rr * Math.sin(a)]
  }
  const poly = axes.map((ax, i) => pt(ax.value, i).join(',')).join(' ')
  return (
    <svg viewBox={`-70 -30 ${size + 140} ${size + 60}`} className="w-full h-auto max-w-[460px] mx-auto font-mono" role="img" aria-label="Position radar of percentiles">
      {[25, 50, 75, 100].map(l => (
        <polygon key={l} points={axes.map((_, i) => pt(l, i).join(',')).join(' ')} fill="none" stroke={LINE} strokeWidth="1" strokeDasharray={l < 100 ? '2,3' : ''} />
      ))}
      {axes.map((_, i) => { const [x, y] = pt(100, i); return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke={LINE} /> })}
      <polygon points={poly} fill="rgba(107,219,88,0.35)" stroke={ACCENT_INK} strokeWidth="2.5" strokeLinejoin="round" />
      {axes.map((ax, i) => {
        const [x, y] = pt(ax.value, i)
        return <circle key={`d${i}`} cx={x} cy={y} r="4.5" fill={ax.value == null ? LINE : INK} />
      })}
      {axes.map((ax, i) => {
        const a = (Math.PI * 2 * i) / n - Math.PI / 2
        const x = c + R * 1.2 * Math.cos(a), y = c + R * 1.2 * Math.sin(a)
        const anchor = Math.abs(Math.cos(a)) < 0.15 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end'
        return (
          <g key={`l${i}`}>
            <text x={x} y={y - 6} textAnchor={anchor} fontSize="10.5" fontWeight="700" fill={INK} style={{ textTransform: 'uppercase' }}>{ax.label}</text>
            <text x={x} y={y + 8} textAnchor={anchor} fontSize="11" fontWeight="700" fill={ax.value == null ? MUTED : ACCENT_INK}>{ax.value == null ? 'n/a' : `${ax.value}th`}</text>
          </g>
        )
      })}
    </svg>
  )
}

/** Small multi-line trend over matches. series: [{ label, values: number[] }] */
export function TrendChart({ labels, series }) {
  const W = 640, H = 220, pl = 34, pr = 12, pt = 14, pb = 34
  const colors = [INK, ACCENT_INK, '#0077B6', '#9AA397']
  const n = labels.length
  const x = (i) => pl + (n <= 1 ? (W - pl - pr) / 2 : (i * (W - pl - pr)) / (n - 1))
  return (
    <div>
      <div className="flex flex-wrap gap-4 mb-2 font-mono text-[10px] font-bold uppercase tracking-wider">
        {series.map((s, si) => (
          <span key={s.label} className="flex items-center gap-1.5"><span className="inline-block w-3 h-[3px]" style={{ background: colors[si] }} />{s.label}</span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto font-mono" role="img" aria-label="Match-by-match trend, each line scaled to its own maximum">
        {[0, 0.5, 1].map(f => <line key={f} x1={pl} x2={W - pr} y1={pt + (1 - f) * (H - pt - pb)} y2={pt + (1 - f) * (H - pt - pb)} stroke={LINE} strokeDasharray={f ? '2,3' : ''} />)}
        {series.map((s, si) => {
          const max = Math.max(...s.values.filter(v => v != null), 0.0001)
          const y = (v) => pt + (1 - (v ?? 0) / max) * (H - pt - pb)
          const d = s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ')
          return (
            <g key={s.label}>
              <path d={d} fill="none" stroke={colors[si]} strokeWidth="2.25" strokeLinejoin="round" />
              {s.values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3.2" fill={colors[si]} />)}
            </g>
          )
        })}
        {labels.map((l, i) => <text key={i} x={x(i)} y={H - 12} textAnchor="middle" fontSize="10" fill={MUTED}>{l}</text>)}
      </svg>
      <p className="font-mono text-[10px] text-[#5B6359] mt-1">Each line is scaled to its own best match, so shapes compare form, not size.</p>
    </div>
  )
}
