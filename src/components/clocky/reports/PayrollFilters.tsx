'use client'

/**
 * The payroll summary's period (owner, 12 November 2026: "the same time
 * filters as the Reports page"): Month, Pay period, Quarter or Custom, built
 * from the same pieces as ReportsView. A choice changes the address and the
 * server reads the summary again (lib/timeclock/payroll-summary-data.ts).
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { withViewAs } from '@/components/ViewAsKeeper'
import { FieldLabel } from '@/components/clocky/entries/ui'
import { DateField } from '@/components/ui/DateField'
import { Segmented } from '@/components/ui/Segmented'
import { DATE_FIELD_CLASS } from '@/lib/ui/fields'
import { FIELD_LABEL } from '@/lib/ui/type'
import { payrollSearch, type PayrollQuery } from '@/lib/timeclock/payroll-summary'

/** A whole day the summary can read: a typed year passes through 0002 and 0202 before 2026, so those wait. */
const fullDay = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= '2000-01-01' && !Number.isNaN(Date.parse(d))

export function PayrollFilters({ query, from, to, label }: { query: PayrollQuery; from: string; to: string; label: string }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [range, setRange] = useState({ from, to })
  // The From and To boxes follow the period the server answers with (set while rendering, not in an effect).
  const [shown, setShown] = useState({ from, to })
  if (shown.from !== from || shown.to !== to) {
    setShown({ from, to })
    setRange({ from, to })
  }
  const go = (q: PayrollQuery) =>
    startTransition(() => router.replace(withViewAs(`/clocky-hours/reports/payroll?${payrollSearch(q)}`), { scroll: false }))
  const pickDay = (patch: Partial<typeof range>) => {
    const next = { ...range, ...patch }
    setRange(next)
    if (fullDay(next.from) && fullDay(next.to) && next.from <= next.to && (next.from !== from || next.to !== to)) go({ kind: 'custom', ...next })
  }

  return (
    <div className="flex flex-wrap gap-2.5 items-end">
      <div className="flex flex-col gap-[5px]">
        <span className={FIELD_LABEL}>Period</span>
        <Segmented label="Period" options={[{ key: 'month', label: 'Month' }, { key: 'pp', label: 'Pay period' }, { key: 'quarter', label: 'Quarter' }, { key: 'custom', label: 'Custom' }] as const}
          value={query.kind} onChange={k => go({ kind: k, ...(k === 'custom' ? { from, to } : {}) })} />
      </div>
      {query.kind === 'custom' ? (
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-[5px]"><FieldLabel>From</FieldLabel>
            <DateField value={range.from} max={range.to} onChange={v => pickDay({ from: v })} className={DATE_FIELD_CLASS} /></label>
          <label className="flex flex-col gap-[5px]"><FieldLabel>To</FieldLabel>
            <DateField value={range.to} min={range.from} onChange={v => pickDay({ to: v })} className={DATE_FIELD_CLASS} /></label>
        </div>
      ) : (
        <span className="max-md:basis-full font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink px-1.5 max-md:px-0.5 pb-2.5 max-md:pb-0 whitespace-nowrap leading-[normal]">{label}</span>
      )}
    </div>
  )
}
