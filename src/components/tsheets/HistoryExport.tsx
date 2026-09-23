'use client'

/**
 * Choose a range and take the Full history as a CSV.
 *
 * The table on screen is always one calendar year, because that is the shape a
 * budget is planned in. The question people bring to it is not always that:
 * "the last twelve months" crosses a year end, and reconciling an invoice run
 * needs whatever months that run covered.
 *
 * The control is RangeFilter, the same one the report above it uses to choose
 * what it shows. It was written here first and moved out when the report needed
 * it: one filter answering the same question in two places beats two that drift.
 * A single month is not offered, because a year is the smallest thing this
 * table is about; the report is where a month is asked for.
 */

import { useState } from 'react'
import { RangeFilter } from './RangeFilter'
import { rangeOf, shiftMonth, type RangeChoice } from '@/lib/tsheets/range'
import { ROUTES } from '@/lib/nav/routes'

export function HistoryExport({ currentMonth }: { currentMonth: string }) {
  // A calendar year to start with: it is the table this button sits under.
  const [choice, setChoice] = useState<RangeChoice>({
    mode: 'year',
    month: currentMonth,
    year: currentMonth.slice(0, 4),
    from: shiftMonth(currentMonth, -11),
    to: currentMonth,
  })

  const range = rangeOf(choice, currentMonth)
  const valid = range.from <= range.to

  return (
    <div className="flex items-center gap-2.5">
      <RangeFilter
        value={choice}
        onChange={setChoice}
        currentMonth={currentMonth}
        modes={['year', 'last12', 'custom']}
        align="right"
        heading="Months to export"
      />

      {/* Downloads on click, unlike the PDFs. A spreadsheet is opened where it
          lands, and a preview of one would be a second, worse spreadsheet. */}
      <a
        href={valid ? `${ROUTES.i7}/history/csv?from=${range.from}&to=${range.to}` : undefined}
        aria-disabled={!valid}
        className={`inline-flex items-center gap-2.5 bg-tn-primary text-white rounded-[10px] px-[18px] py-[11px] font-(family-name:--font-display) font-extrabold text-[13px] tracking-[.02em] shadow-[0_8px_20px_-8px_rgba(1,35,88,.55)] transition-transform ${valid ? 'hover:-translate-y-px' : 'opacity-50 pointer-events-none'}`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F2C40A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /></svg>
        <span className="text-[#ffffff]">CSV</span>
      </a>
    </div>
  )
}
