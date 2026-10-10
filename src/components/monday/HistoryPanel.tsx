'use client'

/**
 * An item's history, in a drawer from the right of My Work. Asked of Monday
 * live, so what opens is current by definition. Split out of WorkList.tsx
 * (audit, 10 October 2026).
 *
 * A modal window as the portal's others are (useModal): focus goes in, Tab
 * stays inside, Escape closes it and focus goes back to the row's button. Named
 * by the item's own heading.
 */

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { withViewAs } from '@/components/ViewAsKeeper'
import { useModal } from '@/components/ui/useModal'
import type { HistoryData } from '@/lib/monday/worklist/history'
import type { WorkRow } from '@/lib/monday/worklist/data'
import { chip, DUE_BADGE, DUE_TIME } from './tokens'
import { StatusChip } from './StatusChip'
import { HistorySteps, historyWhen } from './HistorySteps'
import { EyeIcon } from './RowLinks'
import { readDue, workToday } from './shared'

/** What the browser is told when Monday, or the way to it, did not answer. */
export const UNREACHABLE = 'Monday could not be reached. Try again in a moment.'

type PanelState = { loading?: boolean; error?: string } & Partial<HistoryData>

/**
 * Reads the history route's answer. Only JSON is believed: a sign-in page or a
 * proxy's error page arriving instead would otherwise be parsed as nonsense or
 * shown to the reader as raw text (audit, 10 October 2026). The route's own
 * refusals are plain sentences and are said as they are.
 */
export async function readHistory(r: Response): Promise<PanelState> {
  const json = (r.headers.get('content-type') ?? '').includes('application/json')
  if (!json) return { loading: false, error: UNREACHABLE }
  const d = await r.json().catch(() => null) as ({ error?: unknown } & Partial<HistoryData>) | null
  if (!d) return { loading: false, error: UNREACHABLE }
  if (typeof d.error === 'string' && d.error) return { loading: false, error: d.error }
  if (!r.ok) return { loading: false, error: UNREACHABLE }
  return { loading: false, events: d.events, names: d.names, steps: d.steps, reader: d.reader }
}

export function HistoryPanel({ row, onClose, state, today }: {
  row: WorkRow
  onClose: () => void
  /** Design check only: show one of the panel's states without waiting for it. */
  state?: PanelState
  /** New York's day, from the page, for the deadline's badge. */
  today?: string
}) {
  const [live, setLive] = useState<PanelState>({ loading: true })
  const box = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const titleId = useId()
  useModal(true, box, onClose)

  // useModal moves focus to the first control inside. A row with no Monday link
  // has none until the history arrives, so the heading takes it instead of
  // leaving focus behind the overlay.
  useEffect(() => {
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        if (!box.current?.contains(document.activeElement)) heading.current?.focus()
      })
    })
    return () => { cancelAnimationFrame(outer); cancelAnimationFrame(inner) }
  }, [])

  useEffect(() => {
    if (state) return
    let alive = true
    // Through withViewAs, so a View Stage preview asks as the level it shows.
    fetch(withViewAs(`/api/monday/item-history?board=${row.boardId}&item=${row.itemId}`))
      .then(readHistory)
      .then(next => { if (alive) setLive(next) })
      .catch(() => { if (alive) setLive({ loading: false, error: UNREACHABLE }) })
    return () => { alive = false }
  }, [row.boardId, row.itemId, state])

  const s = state ?? live
  const due = row.dueDate ? readDue(row.dueDate, row.dueSuspect, today ?? workToday()) : null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Out of the Tab order: Escape closes the window for the keyboard. */}
      <button className="absolute inset-0 bg-[rgba(1,35,88,.35)]" onClick={onClose} aria-label="Close" tabIndex={-1} />

      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-[560px] h-full bg-white shadow-[0_24px_50px_-20px_rgba(1,35,88,.6)] overflow-y-auto"
      >
        <div className="sticky top-0 bg-white border-b border-[var(--panel-border)] px-[18px] py-4 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.07em] uppercase text-muted">Item</div>
            <h3 ref={heading} id={titleId} tabIndex={-1} className="font-(family-name:--font-display) font-extrabold text-[17px] leading-[1.25] text-tn-ink m-0 mt-[3px] outline-none">
              {row.itemName}
            </h3>
          </div>

          {/* No close button: clicking away or Escape closes it, and the corner
              belongs to the one action that leaves for somewhere else. */}
          {row.url && (
            <a
              href={row.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${row.itemName} in Monday`}
              title="Open in Monday"
              className="shrink-0 inline-flex items-center justify-center w-[30px] h-[30px] rounded-full text-muted hover:text-tn-teal hover:bg-subtle transition-colors"
            >
              <EyeIcon />
            </a>
          )}
        </div>

        <div className="px-[18px] pt-4 pb-5">
          {/* Where the step lives, written out. The table can hide Parent item,
              Board and Workspace, and a subitem called "Portuguese" means
              nothing without them, so the panel always carries all three. */}
          <dl className="grid grid-cols-[104px_minmax(0,1fr)] gap-x-3 gap-y-2.5 m-0 mb-5 rounded-[12px] border border-[var(--panel-border)] bg-subtle px-3.5 py-3">
            {row.language && <Detail label="Language">{row.language}</Detail>}
            <Detail label="Parent item">{row.parentItemName ?? <span className="text-[var(--faint)]">-</span>}</Detail>
            <Detail label="Board">{row.boardName}</Detail>
            <Detail label="Workspace">{row.workspaceName ?? <span className="text-[var(--faint)]">-</span>}</Detail>
            <Detail label="Assignee">{row.who}</Detail>
            <Detail label="Step">
              <span className="inline-flex items-center gap-[7px] flex-wrap">
                <span>{row.stepName}</span>
                {row.statusText && <StatusChip text={row.statusText} colour={row.statusColor} />}
              </span>
            </Detail>
            <Detail label={row.dueLabel ?? 'Due'}>
              {due ? (
                <span className="inline-flex items-center gap-[7px] flex-wrap">
                  <span>{due.date}</span>
                  {due.time && <span className={`text-[12px] ${DUE_TIME[due.state]}`}>{due.time}</span>}
                  <span className={`${chip} ${DUE_BADGE[due.state].className}`}>{DUE_BADGE[due.state].label}</span>
                </span>
              ) : <span className="text-[var(--faint)]">-</span>}
            </Detail>
          </dl>

          <h4 className="font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink m-0 mb-3">History</h4>

          {s.loading && <div className="text-[13px] text-muted" role="status">Asking Monday…</div>}

          {s.error && (
            <div role="alert" className="rounded-[10px] border border-[var(--warn-border)] bg-[var(--warn-bg)] p-3.5 text-[13px] leading-[1.55] text-[var(--warn-fg)]">
              {s.error}
            </div>
          )}

          {s.events && s.events.length === 0 && (
            <p className="text-[13px] text-muted leading-[1.6] m-0">
              Nothing in Monday&apos;s log for this item. Monday keeps activity for a limited window, so an item
              that has not moved in a long time is genuinely empty rather than missing.
            </p>
          )}

          {/* One card per step, whose it is, yours first (HistorySteps). An
              answer without steps, from an older deploy or the design check,
              falls back to the plain timeline below. */}
          {s.events && s.events.length > 0 && s.steps && (
            <HistorySteps data={{ events: s.events, names: s.names ?? {}, steps: s.steps, reader: s.reader ?? null }} steps={s.steps} />
          )}

          {s.events && s.events.length > 0 && !s.steps && s.events.map(e => (
            <div key={e.id} className="relative pl-[18px] mb-3">
              <span className="absolute left-0 top-1.5 w-[7px] h-[7px] rounded-full bg-tn-teal" />
              <div className="text-[12.5px] leading-[1.45] text-tn-ink">
                {e.column ? (
                  <>
                    <span className="font-bold">{e.column}</span>
                    {e.from && <span className="text-muted"> from {e.from}</span>}
                    {e.to && <span className="font-semibold"> → {e.to}</span>}
                  </>
                ) : (
                  <span className="text-muted">{e.event.replace(/_/g, ' ')}</span>
                )}
              </div>
              <div className="text-[11.5px] text-muted mt-0.5">
                {historyWhen(e.at)}{e.userId && s.names?.[e.userId] ? ` · ${s.names[e.userId]}` : ''}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** One line of the panel's details: a small label, then the value. */
function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.07em] uppercase text-muted pt-[3px] m-0">{label}</dt>
      <dd className="text-[13px] leading-[1.45] text-tn-ink min-w-0 break-words m-0">{children}</dd>
    </>
  )
}
