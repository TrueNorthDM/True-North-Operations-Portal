'use client'

/**
 * 3D, the side summary (Time Entries.dc.html): hours by client, billable
 * against not, and "Needs attention" with each entry's way to fix it (Fix,
 * Review, View history), up to six.
 */

import { formatDuration } from '@/lib/timeclock/rounding'
import type { AttentionItem } from '@/lib/timeclock/clocky-types'
import { clientColor, type Totals } from './model'
import { LABEL } from './ui'

const CARD = 'bg-white border border-[var(--panel-border)] rounded-[14px] p-4 flex flex-col'

export function SummaryAside({ totals, attention, onAttention }: {
  totals: Totals
  attention: readonly AttentionItem[]
  onAttention: (a: AttentionItem) => void
}) {
  const max = Math.max(1, ...totals.byClient.map(c => c.seconds))
  const billPct = totals.seconds ? (totals.billable / totals.seconds) * 100 : 0
  return (
    <aside className="w-[280px] flex-none flex flex-col gap-3">
      <div className={`${CARD} gap-[11px]`}>
        <div className={`${LABEL} text-muted`}>Hours by client</div>
        {totals.byClient.map(c => (
          <div key={c.client} className="flex flex-col gap-[5px]">
            <div className="flex justify-between text-[12.5px]">
              <span className="font-semibold text-tn-ink">{c.client}</span>
              <span className="text-foreground tabular-nums lining-nums">{formatDuration(c.seconds)}</span>
            </div>
            <div className="h-[5px] rounded-[3px] bg-[var(--row-rule)] overflow-hidden">
              <div className="h-full rounded-[3px]" style={{ width: `${Math.max(3, (c.seconds / max) * 100)}%`, background: clientColor(c.client) }} />
            </div>
          </div>
        ))}
        {totals.byClient.length === 0 && <div className="text-[12.5px] text-muted">No hours yet.</div>}
      </div>
      <div className={`${CARD} gap-2.5`}>
        <div className={`${LABEL} text-muted`}>Billable vs not</div>
        <div className="flex h-2 rounded-[4px] overflow-hidden bg-[var(--row-rule)]"><div className="bg-tn-teal" style={{ width: `${billPct}%` }} /></div>
        <div className="flex justify-between text-[12.5px] tabular-nums lining-nums">
          <span><b className="text-tn-teal">Billable</b> {formatDuration(totals.billable)}</span>
          <span><b className="text-[var(--chip-neutral-fg)]">Not</b> {formatDuration(totals.nonBillable)}</span>
        </div>
      </div>
      <div className={`${CARD} gap-2`}>
        <div className="flex items-center justify-between">
          <span className={`${LABEL} text-muted`}>Needs attention</span>
          <span className={`font-(family-name:--font-display) font-extrabold text-[12px] ${attention.length ? 'text-[var(--warn-fg)]' : 'text-[var(--ok-fg)]'}`}>{attention.length}</span>
        </div>
        {attention.slice(0, 6).map(a => (
          <button key={a.key} type="button" onClick={() => onAttention(a)}
            className="flex flex-col gap-0.5 border border-[#f0e2a8] bg-[var(--warn-bg)] rounded-[10px] px-[11px] py-[9px] text-left whitespace-normal transition-colors hover:border-[var(--warn-fg)]">
            <span className="text-[12.5px] font-bold text-tn-ink">{a.reason}</span>
            <span className="text-[11.5px] text-foreground leading-[1.4] tabular-nums lining-nums">{a.sub}</span>
            <span className="text-[11.5px] font-bold text-tn-teal">{a.cta}</span>
          </button>
        ))}
        {attention.length === 0 && <div className="text-[12.5px] text-[var(--ok-fg)] font-semibold">Nothing to fix in this period.</div>}
      </div>
    </aside>
  )
}
