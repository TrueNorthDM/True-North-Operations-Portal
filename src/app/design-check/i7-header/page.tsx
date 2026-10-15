'use client'

// Design check: the top of the i7 report, the two rows above the table.
//
// The real page reads the import status and the whole tree before it can draw
// anything, and none of that changes what this checks, so the fixture stops at
// the toolbar: where the freshness badge and the guide sit, and what the period
// filter does to the Export menu.
//
// The filter here changes local state instead of the URL, so every mode can be
// tried without a server that has the months. What it drives is real: the same
// RangeFilter, and the same Export menu reading the same `monthly` flag, so the
// PDFs fade exactly where they will on the report.

import { useState } from 'react'
import Link from 'next/link'
import { Select } from '@/components/ui/Select'
import { RangeFilter } from '@/components/tsheets/RangeFilter'
import { ReportMeta } from '@/components/tsheets/ReportMeta'
import { ManualHoursDialog } from '@/components/tsheets/ManualHoursDialog'
import { ExportMenu, ExportImageButton } from '@/components/tsheets/I7ReportParts'
import type { ManualOptions } from '@/components/tsheets/ManualHours'
import { defaultChoice, isSingleMonth, rangeOf, spanWording } from '@/lib/tsheets/range'

const MONTH = '2026-09'

// Enough for the closed button. Opening the form is not what this page checks.
const NO_OPTIONS: ManualOptions = {
  people: [], tops: [], jobsByTop: {}, i7Codes: [],
  companies: [], projects: [], activities: [], billable: [],
}

const SOURCE_LINE =
  'The hours come from QuickBooks Time, imported into the portal, plus any added by hand in the panel below.'

// Module scope, not render: the badge only has to read "5 minutes ago", and
// Date.now() in a render body is impure.
const SYNCED_AT = new Date(Date.now() - 5 * 60_000).toISOString()

const selectCls = 'px-3 py-2 rounded-[9px] border border-slate-200 text-sm bg-white text-tn-ink font-(family-name:--font-display) font-bold focus:outline-none focus:border-tn-teal focus:ring-2 focus:ring-tn-teal/20'

const MONTHS = ['2026-09', '2026-08', '2026-07', '2026-06', '2026-05', '2026-04', '2026-03', '2026-02', '2026-01']

export default function I7HeaderDesignCheck() {
  const [choice, setChoice] = useState(defaultChoice(MONTH))
  const range = rangeOf(choice, MONTH)
  const monthly = isSingleMonth(range)

  return (
    <div className="min-h-screen bg-[var(--page-bg,#efedE8)] px-6 py-10">
      <div className="max-w-[1400px] mx-auto space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.14em] text-tn-teal m-0">Design check</p>
            <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">Client Report · i7</h1>
            <p className="mt-1.5 text-muted leading-relaxed m-0">Hours, cost and budget usage for i7 Marketing.</p>
          </div>
          <Link
            href="#"
            title="Manage rates &amp; budgets in Settings"
            aria-label="Settings"
            className="shrink-0 w-11 h-11 rounded-full border border-slate-200 bg-white text-muted flex items-center justify-center transition-colors hover:text-tn-ink hover:border-tn-teal"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
          </Link>
        </div>

        <div className="space-y-5">
          <ReportMeta
            sourceLine={SOURCE_LINE}
            guideHref="#"
            syncedAt={SYNCED_AT}
          />

          <div className="space-y-6">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted">Period</span>
              <RangeFilter
                value={choice}
                onChange={setChoice}
                currentMonth={MONTH}
                modes={['month', 'year', 'last12', 'custom']}
                months={MONTHS}
                layout="inline"
              />
              <label htmlFor="team-select" className="text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted ml-2">Team</label>
              <Select
                id="team-select"
                value=""
                onChange={() => {}}
                options={[{ value: '', label: 'All teams' }]}
                ariaLabel="Team"
                className={selectCls}
              />
              <div className="ml-auto flex items-center gap-2.5">
                <ManualHoursDialog rows={[]} options={NO_OPTIONS} month={range.to} blurb="" />
                <ExportImageButton month={range.to} monthly={monthly} />
                <ExportMenu range={range} monthly={monthly} />
              </div>
            </div>

            <div className="flex gap-1 border-b border-slate-200">
              {['In Numbers', 'In Graphics'].map((t, i) => (
                <span key={t} className={`px-4 py-2.5 text-[13.5px] font-(family-name:--font-display) font-bold border-b-2 -mb-px ${i === 0 ? 'border-tn-teal text-tn-teal' : 'border-transparent text-muted'}`}>{t}</span>
              ))}
            </div>

            <div className="rounded-[14px] border border-slate-200 bg-white h-40 flex items-center justify-center text-sm text-muted">
              The table for {spanWording(range.from, range.to)} sits here.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
