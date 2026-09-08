'use client'

/**
 * One button that says which months a report is showing, and opens the four
 * ways of changing that.
 *
 * Built for the Full history export first, where the three ways of asking for a
 * stretch of time are not three settings but one choice, and laying them out
 * side by side made the header read as a form to fill in before exporting. The
 * i7 report now asks the same question, so it asks it with the same control.
 *
 * The i7 report adds a fourth way, one month, and opens on it. A month is the
 * shape of a pay period and the shape of the PDF that gets sent to the client,
 * so it stays the thing you land on; the other three are what you reach for
 * when a question crosses a month end.
 *
 * What a choice MEANS lives in lib/tsheets/range.ts. This file only draws it.
 */

import { useEffect, useRef, useState } from 'react'
import { Select } from '@/components/ui/Select'
import {
  RANGE_FLOOR, rangeLabel, rangeOf, shortMonth,
  type RangeChoice, type RangeMode,
} from '@/lib/tsheets/range'

const FIELD = 'w-full rounded-[9px] border border-slate-200 bg-white px-3 py-2 text-[13px] text-tn-ink font-semibold'

const WORDING: Record<RangeMode, string> = {
  month: 'A single month',
  year: 'A calendar year',
  last12: 'Last 12 months',
  custom: 'Choose the months',
}

export function RangeFilter(
  { value, onChange, currentMonth, modes = ['year', 'last12', 'custom'], months, floor = RANGE_FLOOR, label, align = 'left', heading = 'Months to show' }: {
    value: RangeChoice
    onChange: (next: RangeChoice) => void
    /** The newest month there is anything to show for. Nothing after it can be chosen. */
    currentMonth: string
    modes?: RangeMode[]
    /**
     * The months the single-month mode offers, newest first. Required whenever
     * 'month' is one of the modes: the report has its own idea of which months
     * it holds, and it is narrower than "everything since the floor".
     */
    months?: string[]
    floor?: string
    /** Overrides the button's text. Only for a filter whose range is not what it is naming. */
    label?: string
    /** Which edge the popover hangs from. Follow the button's own side of the row. */
    align?: 'left' | 'right'
    heading?: string
  },
) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const years: string[] = []
  for (let y = Number(floor.slice(0, 4)); y <= Number(currentMonth.slice(0, 4)); y++) years.push(String(y))

  const range = rangeOf(value, currentMonth, floor)
  const valid = range.from <= range.to
  const set = (over: Partial<RangeChoice>) => onChange({ ...value, ...over })

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-2.5 bg-white text-tn-ink border border-slate-200 rounded-[10px] px-[16px] py-[11px] font-(family-name:--font-display) font-extrabold text-[13px] tracking-[.02em] shadow-[0_1px_2px_rgba(1,35,88,.06)] transition-all hover:border-tn-teal hover:text-tn-teal"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1E7D7F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
        <span>{label ?? rangeLabel(value, currentMonth, floor)}</span>
        <svg className={`w-3 h-3 text-muted transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
      </button>

      {open && (
        <div className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-2 z-30 w-[290px] rounded-[14px] border border-slate-200 bg-white shadow-[0_24px_50px_-20px_rgba(1,35,88,.4)] p-3`}>
          <p className="px-1 pb-2 text-[9.5px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.1em] text-muted m-0">
            {heading}
          </p>

          {modes.map(m => (
            <button
              key={m}
              type="button"
              onClick={() => set({ mode: m })}
              className={`flex items-center gap-2.5 w-full text-left rounded-[9px] px-3 py-2.5 text-[13px] font-(family-name:--font-display) font-bold transition-colors ${
                value.mode === m ? 'bg-tn-teal-soft text-tn-teal' : 'text-tn-ink hover:bg-subtle'
              }`}
            >
              <span className={`w-[7px] h-[7px] rounded-full shrink-0 ${value.mode === m ? 'bg-tn-teal' : 'bg-slate-200'}`} />
              {WORDING[m]}
            </button>
          ))}

          {/* The chosen way's own control, under it rather than beside the
              others: only one of the three is ever being answered. */}
          {value.mode === 'month' && months && (
            <div className="pt-2.5">
              <Select
                value={value.month} onChange={month => set({ month })} fullWidth ariaLabel="Month"
                options={months.map(ym => ({ value: ym, label: shortMonth(ym) }))}
                className={FIELD} strongValue
              />
            </div>
          )}

          {value.mode === 'year' && (
            <div className="pt-2.5">
              <Select
                value={value.year} onChange={year => set({ year })} fullWidth ariaLabel="Year"
                options={years.map(y => ({ value: y, label: y }))}
                className={FIELD} strongValue
              />
            </div>
          )}

          {/* The fields show the CLAMPED months, not the raw ones. A default
              seeded from "last twelve" starts before the floor, and a field
              reading October while the report reads January is a field that
              lies about what pressing nothing will do. */}
          {value.mode === 'custom' && (
            <div className="pt-2.5 grid grid-cols-2 gap-2">
              <label className="block">
                <span className="block text-[9.5px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.1em] text-muted mb-1">From</span>
                <input type="month" value={range.from} min={floor} max={currentMonth} onChange={e => set({ from: e.target.value })} className={FIELD} />
              </label>
              <label className="block">
                <span className="block text-[9.5px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.1em] text-muted mb-1">To</span>
                <input type="month" value={range.to} min={floor} max={currentMonth} onChange={e => set({ to: e.target.value })} className={FIELD} />
              </label>
            </div>
          )}

          {!valid && (
            <p className="px-1 pt-2.5 text-[11.5px] text-[#b06d0a] m-0 leading-[1.5]">
              The first month has to come before the last.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
