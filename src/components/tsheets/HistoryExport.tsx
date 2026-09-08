'use client'

/**
 * Choose a range and take the Full history as a CSV.
 *
 * The table on screen is always one calendar year, because that is the shape a
 * budget is planned in. The question people bring to it is not always that:
 * "the last twelve months" crosses a year end, and reconciling an invoice run
 * needs whatever months that run covered.
 *
 * January 2026 is the floor. tc_entries has hours back to 2017, but budgets and
 * rates start in 2026, so anything earlier would export real hours beside zero
 * money, which reads as a month where nothing was spent.
 */

import { useState } from 'react'
import { Select } from '@/components/ui/Select'

type Mode = 'year' | 'last12' | 'custom'

const FLOOR = '2026-01'

function shift(ym: string, by: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + by, 1))
  return d.toISOString().slice(0, 7)
}

export function HistoryExport({ currentMonth }: { currentMonth: string }) {
  const [mode, setMode] = useState<Mode>('year')
  const [year, setYear] = useState(currentMonth.slice(0, 4))
  const [from, setFrom] = useState(shift(currentMonth, -11))
  const [to, setTo] = useState(currentMonth)

  const years: string[] = []
  for (let y = Number(FLOOR.slice(0, 4)); y <= Number(currentMonth.slice(0, 4)); y++) years.push(String(y))

  // The range each mode means. Custom is the only one the person types, and it
  // is clamped here as well as on the server: a floor enforced in one place is
  // a floor somebody meets as an error instead of a boundary.
  const range = mode === 'year'
    ? { from: `${year}-01`, to: year === currentMonth.slice(0, 4) ? currentMonth : `${year}-12` }
    : mode === 'last12'
      ? { from: shift(currentMonth, -11), to: currentMonth }
      : { from: from < FLOOR ? FLOOR : from, to: to > currentMonth ? currentMonth : to }

  const valid = range.from <= range.to
  const href = `/tools/time-report/history/csv?from=${range.from}&to=${range.to}`

  return (
    <div className="flex items-center gap-2.5 flex-wrap">
      <Select
        value={mode}
        onChange={v => setMode(v as Mode)}
        options={[
          { value: 'year', label: 'A calendar year' },
          { value: 'last12', label: 'Last 12 months' },
          { value: 'custom', label: 'Choose the months' },
        ]}
        ariaLabel="Period"
        className="px-3 py-2 rounded-[9px] border border-slate-200 text-[13px] bg-white text-tn-ink font-(family-name:--font-display) font-bold"
      />

      {mode === 'year' && (
        <Select
          value={year}
          onChange={setYear}
          options={years.map(y => ({ value: y, label: y }))}
          ariaLabel="Year"
          className="px-3 py-2 rounded-[9px] border border-slate-200 text-[13px] bg-white text-tn-ink font-(family-name:--font-display) font-bold"
        />
      )}

      {mode === 'custom' && (
        <>
          <input
            type="month" value={from} min={FLOOR} max={currentMonth}
            onChange={e => setFrom(e.target.value)} aria-label="From month"
            className="rounded-[9px] border border-slate-200 bg-white px-3 py-2 text-[13px] text-tn-ink font-semibold"
          />
          <span className="text-[13px] text-muted">to</span>
          <input
            type="month" value={to} min={FLOOR} max={currentMonth}
            onChange={e => setTo(e.target.value)} aria-label="To month"
            className="rounded-[9px] border border-slate-200 bg-white px-3 py-2 text-[13px] text-tn-ink font-semibold"
          />
        </>
      )}

      {/* Downloads on click, unlike the PDFs. A spreadsheet is opened where it
          lands, and a preview of one would be a second, worse spreadsheet. */}
      {valid ? (
        <a
          href={href}
          className="inline-flex items-center gap-2 rounded-[9px] border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-(family-name:--font-display) font-bold text-tn-ink hover:border-tn-teal hover:bg-tn-teal-soft transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1E7D7F" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /></svg>
          CSV
        </a>
      ) : (
        <span className="text-[12.5px] text-[#b06d0a]">The first month has to come before the last.</span>
      )}
    </div>
  )
}
