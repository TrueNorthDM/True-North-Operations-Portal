'use client'

/**
 * Choose a range and take the Full history as a CSV.
 *
 * The table on screen is always one calendar year, because that is the shape a
 * budget is planned in. The question people bring to it is not always that:
 * "the last twelve months" crosses a year end, and reconciling an invoice run
 * needs whatever months that run covered.
 *
 * One button rather than a row of controls. The three ways of asking are not
 * three separate settings, they are one choice, and laying them out side by side
 * made the header read as a form somebody had to fill in before exporting.
 *
 * January 2026 is the floor. tc_entries has hours back to 2017, but budgets and
 * rates start in 2026, so anything earlier would export real hours beside zero
 * money, which reads as a month where nothing was spent.
 */

import { useEffect, useRef, useState } from 'react'
import { Select } from '@/components/ui/Select'

type Mode = 'year' | 'last12' | 'custom'

const FLOOR = '2026-01'
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const short = (ym: string) => `${MON[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`

function shift(ym: string, by: number): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7)
}

const FIELD = 'w-full rounded-[9px] border border-slate-200 bg-white px-3 py-2 text-[13px] text-tn-ink font-semibold'

export function HistoryExport({ currentMonth }: { currentMonth: string }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('year')
  const [year, setYear] = useState(currentMonth.slice(0, 4))
  const [from, setFrom] = useState(shift(currentMonth, -11))
  const [to, setTo] = useState(currentMonth)
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
  for (let y = Number(FLOOR.slice(0, 4)); y <= Number(currentMonth.slice(0, 4)); y++) years.push(String(y))

  // Clamped here as well as on the server. A floor enforced in one place only is
  // a floor somebody meets as an error instead of a boundary.
  const range = mode === 'year'
    ? { from: `${year}-01`, to: year === currentMonth.slice(0, 4) ? currentMonth : `${year}-12` }
    : mode === 'last12'
      ? { from: shift(currentMonth, -11), to: currentMonth }
      : { from: from < FLOOR ? FLOOR : from, to: to > currentMonth ? currentMonth : to }

  const valid = range.from <= range.to
  const label = mode === 'year' ? year : `${short(range.from)} to ${short(range.to)}`

  return (
    <div className="flex items-center gap-2.5">
      <div className="relative" ref={box}>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          className="inline-flex items-center gap-2.5 bg-white text-tn-ink border border-slate-200 rounded-[10px] px-[16px] py-[11px] font-(family-name:--font-display) font-extrabold text-[13px] tracking-[.02em] shadow-[0_1px_2px_rgba(1,35,88,.06)] transition-all hover:border-tn-teal hover:text-tn-teal"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1E7D7F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
          <span>{label}</span>
          <svg className={`w-3 h-3 text-muted transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
        </button>

        {open && (
          <div className="absolute right-0 mt-2 z-30 w-[290px] rounded-[14px] border border-slate-200 bg-white shadow-[0_24px_50px_-20px_rgba(1,35,88,.4)] p-3">
            <p className="px-1 pb-2 text-[9.5px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.1em] text-muted m-0">
              Months to export
            </p>

            {([
              ['year', 'A calendar year'],
              ['last12', 'Last 12 months'],
              ['custom', 'Choose the months'],
            ] as const).map(([m, text]) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex items-center gap-2.5 w-full text-left rounded-[9px] px-3 py-2.5 text-[13px] font-(family-name:--font-display) font-bold transition-colors ${
                  mode === m ? 'bg-tn-teal-soft text-tn-teal' : 'text-tn-ink hover:bg-subtle'
                }`}
              >
                <span className={`w-[7px] h-[7px] rounded-full shrink-0 ${mode === m ? 'bg-tn-teal' : 'bg-slate-200'}`} />
                {text}
              </button>
            ))}

            {/* The chosen way's own control, under it rather than beside the
                others: only one of the three is ever being answered. */}
            {mode === 'year' && (
              <div className="pt-2.5">
                <Select
                  value={year} onChange={setYear} fullWidth ariaLabel="Year"
                  options={years.map(y => ({ value: y, label: y }))}
                  className={FIELD} strongValue
                />
              </div>
            )}

            {mode === 'custom' && (
              <div className="pt-2.5 grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="block text-[9.5px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.1em] text-muted mb-1">From</span>
                  <input type="month" value={from} min={FLOOR} max={currentMonth} onChange={e => setFrom(e.target.value)} className={FIELD} />
                </label>
                <label className="block">
                  <span className="block text-[9.5px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.1em] text-muted mb-1">To</span>
                  <input type="month" value={to} min={FLOOR} max={currentMonth} onChange={e => setTo(e.target.value)} className={FIELD} />
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

      {/* Downloads on click, unlike the PDFs. A spreadsheet is opened where it
          lands, and a preview of one would be a second, worse spreadsheet. */}
      <a
        href={valid ? `/tools/time-report/history/csv?from=${range.from}&to=${range.to}` : undefined}
        aria-disabled={!valid}
        className={`inline-flex items-center gap-2.5 bg-tn-primary text-white rounded-[10px] px-[18px] py-[11px] font-(family-name:--font-display) font-extrabold text-[13px] tracking-[.02em] shadow-[0_8px_20px_-8px_rgba(1,35,88,.55)] transition-transform ${valid ? 'hover:-translate-y-px' : 'opacity-50 pointer-events-none'}`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F2C40A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /></svg>
        <span className="text-[#ffffff]">CSV</span>
      </a>
    </div>
  )
}
