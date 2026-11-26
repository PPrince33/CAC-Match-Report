'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'

/**
 * Pill-shaped dropdown with a checkbox list. `selected` empty = everything.
 * @param {object} p
 *   label:    e.g. "Matches"
 *   prefix:   optional text before the summary, e.g. "vs"
 *   options:  [{ value, label, hint? }]
 *   selected: string[] of values ([] means all)
 *   onChange: (string[]) => void
 */
export default function MultiSelect({ label, options, selected, onChange, prefix = null }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const esc = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [open])

  const all = selected.length === 0 || selected.length === options.length
  const summary = all ? `All ${label.toLowerCase()} (${options.length})` : `${selected.length} of ${options.length} ${label.toLowerCase()}`
  const isOn = (v) => all || selected.includes(v)

  const toggle = (v) => {
    const current = all ? options.map(o => o.value) : selected
    const next = current.includes(v) ? current.filter(x => x !== v) : [...current, v]
    onChange(next.length === options.length ? [] : next)
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="listbox" aria-expanded={open} aria-label={`${label}: ${summary}`}
        className={`inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 font-mono font-bold uppercase text-xs bg-white transition-colors ${all ? 'border-[#D6DBD3]' : 'border-[#6BDB58]'} hover:border-[#0B0D0B]`}>
        {prefix && <span className="text-[#5B6359]">{prefix}</span>}<span className="max-w-[200px] truncate">{summary}</span><ChevronDown size={14} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>
      {open && (
        <div role="listbox" aria-multiselectable="true"
          className="absolute right-0 mt-2 w-[320px] max-h-[360px] overflow-y-auto rounded-[16px] border-2 border-[#D6DBD3] bg-white p-2 shadow-lg z-50">
          {!all && (
            <div className="px-2 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#5B6359]">
              <button type="button" onClick={() => onChange([])} className="hover:text-[#0B0D0B] underline">Select all</button>
            </div>
          )}
          {options.map(o => (
            <button type="button" role="option" aria-selected={isOn(o.value)} key={o.value} onClick={() => toggle(o.value)}
              className="w-full flex items-start gap-2.5 rounded-[10px] px-2 py-2 text-left text-sm hover:bg-[#F0F2EE]">
              <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 ${isOn(o.value) ? 'bg-[#0B0D0B] border-[#0B0D0B] text-white' : 'border-[#D6DBD3]'}`}>
                {isOn(o.value) && <Check size={11} strokeWidth={3} />}
              </span>
              <span className="min-w-0">
                <span className="block font-semibold leading-tight">{o.label}</span>
                {o.hint && <span className="block font-mono text-[10px] uppercase tracking-wider text-[#5B6359] mt-0.5">{o.hint}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
