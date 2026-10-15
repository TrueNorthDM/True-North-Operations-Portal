'use client'

/**
 * The two lists ManualHours draws: the lines staged and not yet sent, and the
 * hours already added this month. Both are leaves: the rows come in as props
 * and a removal goes back out through `onRemove`.
 */

import { formatDate } from '@/lib/directory/people-types'
import { addedWhat, h2, isNotBillable, totalHours, type ManualRow, type StagedLine } from './manual-hours'

/**
 * Staged lines. Dashed above, solid below: the two buttons do different
 * things and used to look the same, which is the one confusion this shape
 * can cause.
 */
export function StagedLines({ lines, onRemove }: {
  lines: StagedLine[]
  /** Drops the staged line at this index. */
  onRemove: (index: number) => void
}) {
  return (
    <div className="mt-3 rounded-[12px] border border-[var(--panel-border)] overflow-hidden">
      {lines.map((l, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-2.5 text-[13px] border-b border-[var(--panel-border)] last:border-b-0 bg-subtle"
        >
          <span className="w-[92px] shrink-0 text-muted tabular-nums">{formatDate(l.entryDate)}</span>
          <span className="flex-1 min-w-0 truncate text-foreground">
            {l.label}
            {isNotBillable(l.billable) && (
              <span className="ml-2 text-[10.5px] font-bold uppercase tracking-wider text-[#b06d0a]">not billable</span>
            )}
          </span>
          <span className="w-[56px] shrink-0 text-right font-semibold text-tn-ink tabular-nums">{l.hours}h</span>
          <button
            type="button"
            onClick={() => onRemove(i)}
            aria-label={`Remove line ${i + 1}`}
            className="shrink-0 text-muted hover:text-tn-ink transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
      ))}
    </div>
  )
}

/** The hours already in the report, each removable, with the month's total under them. */
export function AddedRows({ rows, busy, onRemove }: {
  rows: ManualRow[]
  busy: boolean
  onRemove: (r: ManualRow) => void
}) {
  if (rows.length === 0) {
    return <p className="text-[13px] text-muted m-0">Nothing added by hand this month.</p>
  }
  const total = totalHours(rows)
  return (
    <>
      <div className="border border-[var(--panel-border)] rounded-[12px] overflow-hidden">
        {rows.map((r, i) => (
          <div key={r.id} className={`flex items-center gap-3 px-4 py-2.5 ${i ? 'border-t border-[var(--row-rule)]' : ''}`}>
            <span className="w-[100px] flex-none text-[12.5px] text-muted">{formatDate(r.entryDate)}</span>
            <span className="w-[130px] flex-none text-[13px] font-semibold text-tn-ink truncate">{r.personName}</span>
            <span className="min-w-0 flex-1 text-[12.5px] text-foreground truncate">
              {addedWhat(r)}
              {r.notes ? <span className="text-muted"> · {r.notes}</span> : null}
            </span>
            <span className="w-[60px] flex-none text-right text-[13px] font-semibold text-tn-ink">{h2(r.hours)}h</span>
            <span className="w-[110px] flex-none text-right text-[11.5px] text-muted truncate">
              {r.addedBy ? `by ${r.addedBy}` : ''}
            </span>
            <button
              type="button"
              onClick={() => onRemove(r)}
              disabled={busy}
              aria-label={`Remove ${h2(r.hours)}h for ${r.personName} on ${formatDate(r.entryDate)}`}
              className="shrink-0 text-[12px] font-semibold text-muted hover:text-[#c2410c] transition-colors"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <p className="text-[12.5px] text-muted mt-2.5 m-0">
        {`${rows.length} ${rows.length === 1 ? 'entry' : 'entries'} · ${total}h added by hand this month, already counted above.`}
      </p>
    </>
  )
}
