'use client'

/**
 * An item's History, one card per step, with whose step it is.
 *
 * Chosen on 18 September 2026 from /design-check/history-owners (option B,
 * mirrored, with the navy owner tag):
 *   - the reader's own steps first, open, with their avatar and "Your step";
 *   - everyone else's with the owner on the left as a navy tag with a gold
 *     symbol, the status and the step on the right, and their latest change
 *     aligned right under it, the earlier ones a click away;
 *   - changes on no step (the page link, the published date, an automation's
 *     switch) under "The item itself".
 * Only the reader gets an avatar. Everyone else is a name.
 *
 * The owner is the person on the step's people column now, which is often not
 * who made the change; "changed by" says who clicked.
 */

import { useState } from 'react'
import { Avatar } from '@/components/Avatar'
import { StatusChip } from './StatusChip'
import { WORK_ZONE } from './shared'
import {
  groupHistory, shortDate, type HistoryData, type HistoryEvent, type HistoryStep, type StepGroup,
} from '@/lib/monday/worklist/history'

/**
 * When a change happened, written out: "Oct 9, 2026, 3:05 PM", in New York's
 * clock (audit, 10 October 2026), the calendar the rest of My Work counts in.
 */
export function historyWhen(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: WORK_ZONE,
  })
}

const PERSON = <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>

/** Another person's name on their step: Save and close's palette, navy with a gold symbol. */
function OwnerTag({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-tn-primary border border-tn-primary px-3 py-[5px] font-(family-name:--font-display) font-extrabold text-[12px] whitespace-nowrap shadow-[0_6px_14px_-8px_rgba(1,35,88,.6)]">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#F2C40A" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">{PERSON}</svg>
      <span className="text-[#ffffff]">{name}</span>
    </span>
  )
}

function NobodyTag() {
  return (
    <span className="inline-flex items-center rounded-full border border-dashed border-[var(--panel-border)] px-3 py-[4px] text-[12px] font-semibold text-muted whitespace-nowrap">
      Nobody on it
    </span>
  )
}

function YourStep() {
  return (
    <span className="shrink-0 inline-flex items-center rounded-full bg-tn-primary px-2 py-[2px] font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.06em] uppercase text-[#F2C40A]">
      Your step
    </span>
  )
}

export function HistorySteps({ data, steps }: { data: HistoryData; steps: HistoryStep[] }) {
  const accounts = data.reader?.accounts ?? []
  const { mine, others, item } = groupHistory(data.events, steps, accounts)
  const [open, setOpen] = useState<Set<string>>(new Set())

  const who = (id: number) => (accounts.includes(id) ? 'you' : data.names[id] ?? 'someone')
  const names = (ids: number[]) => ids.map(who).join(', ')

  /** One change: what moved, then when and who clicked. */
  const change = (e: HistoryEvent, step?: HistoryStep, right = false) => {
    const label = e.column && e.column !== step?.name ? e.column : null
    let what
    if (e.assigned || e.unassigned) {
      const added = e.assigned ?? []
      const removed = e.unassigned ?? []
      what = (
        <>
          <span className="font-bold">{step?.name ?? e.column}</span>
          {added.length > 0
            ? <><span className="text-muted"> assigned to </span><span className="font-bold">{names(added)}</span></>
            : <><span className="text-muted"> unassigned </span><span className="font-bold">{names(removed)}</span></>}
          {added.length > 0 && removed.length > 0 && <span className="text-muted">{` in place of ${names(removed)}`}</span>}
          {step && e.column && e.column !== step.name && <span className="text-muted">{` (${e.column})`}</span>}
        </>
      )
    } else if (e.column) {
      const from = shortDate(e.from)
      const to = shortDate(e.to)
      what = (
        <>
          {label && <span className="font-bold">{label}</span>}
          {from && <span className="text-muted">{label ? ' from ' : 'From '}{from}</span>}
          <span className="font-semibold">{label || from ? ' → ' : '→ '}{to ?? 'cleared'}</span>
        </>
      )
    } else {
      what = <span className="text-muted">{e.event.replace(/_/g, ' ')}</span>
    }
    return (
      <div key={e.id} className={`text-[12.5px] leading-[1.45] text-tn-ink break-words ${right ? 'text-right' : ''}`}>
        <div>{what}</div>
        <div className="text-[11.5px] text-muted mt-0.5">
          {historyWhen(e.at)}
          {/* Only a name the portal knows. Automations and integrations write
              with accounts it has never seen, and "changed by someone" says less
              than nothing, which is what the plain timeline did too. */}
          {e.userId && (accounts.includes(e.userId) || data.names[e.userId])
            ? <>{' · changed by '}<span className={accounts.includes(e.userId) ? 'font-semibold text-tn-ink' : ''}>{who(e.userId)}</span></>
            : null}
        </div>
      </div>
    )
  }

  const status = (s: HistoryStep) => (s.status ? <StatusChip text={s.status} colour={s.statusColor} /> : null)

  const myCard = (g: StepGroup) => {
    const co = g.step.owners.filter(o => !accounts.includes(o))
    const due = g.step.due ? `${g.step.dueTitle ?? 'Due'} ${shortDate(g.step.due)}` : null
    return (
      <div key={g.step.key} className="rounded-[14px] border-2 border-tn-primary bg-white overflow-hidden">
        <div className="flex items-center gap-3 px-3.5 py-3 bg-[rgba(1,35,88,.04)] border-b border-[var(--panel-border)]">
          <Avatar name={data.reader?.name ?? null} avatarUrl={data.reader?.avatarUrl} size={34} color="#1E7D7F" className="ring-2 ring-[#F2C40A] ring-offset-2 ring-offset-white" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-(family-name:--font-display) font-extrabold text-[14.5px] text-tn-ink">{g.step.name}</span>
              {status(g.step)}
            </div>
            <div className="text-[12px] text-muted mt-0.5">
              {['Yours', co.length ? `with ${names(co)}` : null, due].filter(Boolean).join(' · ')}
            </div>
          </div>
          <YourStep />
        </div>
        <div className="px-3.5 py-2.5 space-y-2">
          {g.events.length
            ? g.events.map(e => change(e, g.step))
            : <p className="text-[12.5px] text-muted m-0">No changes in Monday&apos;s log yet.</p>}
        </div>
      </div>
    )
  }

  const theirCard = (g: StepGroup) => {
    const expanded = open.has(g.step.key)
    const shown = expanded ? g.events : g.events.slice(0, 1)
    const more = g.events.length - 1
    return (
      <div key={g.step.key} className="rounded-[14px] border border-[var(--panel-border)] bg-white px-3.5 py-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="inline-flex items-center gap-1.5 flex-wrap">
            {g.step.owners.length ? g.step.owners.map(o => <OwnerTag key={o} name={who(o)} />) : <NobodyTag />}
          </span>
          <span className="ml-auto inline-flex items-center gap-2.5">
            {status(g.step)}
            <span className="font-(family-name:--font-display) font-extrabold text-[13.5px] text-tn-ink">{g.step.name}</span>
          </span>
        </div>
        {shown.length > 0 && (
          <div className="mt-2 space-y-2">
            {shown.map(e => change(e, g.step, true))}
          </div>
        )}
        {more > 0 && (
          <div className="mt-1.5 text-right">
            <button
              type="button"
              onClick={() => setOpen(prev => {
                const next = new Set(prev)
                if (next.has(g.step.key)) next.delete(g.step.key)
                else next.add(g.step.key)
                return next
              })}
              className="text-[12px] font-semibold text-tn-teal hover:underline"
            >
              {expanded ? 'Show only the latest' : `${more} earlier ${more === 1 ? 'change' : 'changes'}`}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {mine.map(myCard)}
      {others.map(theirCard)}
      {item.length > 0 && (
        <div className="rounded-[14px] border border-dashed border-[var(--panel-border)] px-3.5 py-3">
          <div className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted mb-2">The item itself</div>
          <div className="space-y-2">
            {item.map(e => change(e))}
          </div>
        </div>
      )}
    </div>
  )
}
