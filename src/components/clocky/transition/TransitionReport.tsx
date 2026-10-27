'use client'

/**
 * North Time > TSheets transition (27 October 2026): every TSheets entry from
 * the switch date to the 2026 job structure, as TSheets recorded it (left) and
 * as the portal reads it (right), problems first. The reading is
 * lib/timeclock/transition-check.ts; the loader transition-data.ts.
 *
 * The filters change the address and the server reads again (TransitionLive).
 * The design check hands in its own `go`, which answers from sample data.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Segmented } from '@/components/ui/Segmented'
import { withViewAs } from '@/components/ViewAsKeeper'
import { FieldLabel, LabeledSelect } from '@/components/clocky/entries/ui'
import { dateLabel, dayLabel } from '@/lib/timeclock/format'
import { formatDuration } from '@/lib/timeclock/rounding'
import { PROBLEM_HINT, PROBLEM_LABEL, PROBLEM_ORDER, type TransitionRow } from '@/lib/timeclock/transition-check'
import type { TransitionData, TransitionQuery } from '@/lib/timeclock/transition-data'

const LABEL = 'font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted'
const H1 = 'm-0 mt-0.5 font-(family-name:--font-display) font-extrabold text-[30px] text-tn-ink'
const CARD = 'bg-white border border-[var(--panel-border)] rounded-[14px]'
const DATE_INPUT = 'h-10 box-border px-3 border border-[var(--panel-border)] rounded-[10px] text-[13px] text-tn-ink bg-white'
// Problem | Date, Person, Job and fields, Hours | Client, Division, Project, Activity, Billable
const GRID = 'grid grid-cols-[190px_110px_150px_minmax(300px,1.6fr)_80px_130px_140px_170px_190px_80px]'
/** A whole day: a typed year passes through 0002 and 0202 before 2026, so those wait. */
const fullDay = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= '2000-01-01' && !Number.isNaN(Date.parse(d))

/** The address of a query, without the defaults. */
export function transitionSearch(q: TransitionQuery): string {
  const s = new URLSearchParams()
  if (q.from) s.set('from', q.from)
  if (q.to) s.set('to', q.to)
  if (q.person) s.set('person', q.person)
  if (q.problems) s.set('problems', '1')
  return s.toString()
}

/** The page: each filter changes the address, and the server reads again. */
export function TransitionLive({ data }: { data: TransitionData }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const go = (q: TransitionQuery) => {
    const s = transitionSearch(q)
    startTransition(() => router.replace(withViewAs(`/clocky-hours/transition${s ? `?${s}` : ''}`), { scroll: false }))
  }
  return <TransitionReport data={data} go={go} />
}

function Header({ sub }: { sub: string }) {
  return (
    <div>
      <Breadcrumb parents={['/clocky-hours']} now="TSheets transition" />
      <h1 className={H1}>TSheets transition</h1>
      <p className="m-0 mt-1 text-[13.5px] text-muted">{sub}</p>
    </div>
  )
}

const empty = <span className="text-[var(--faint)]">–</span>

function ProblemCell({ r }: { r: TransitionRow }) {
  if (!r.problems.length) {
    return (
      <div className="px-3 py-2.5">
        <span className="text-[11.5px] font-bold rounded-full px-[9px] py-[3px] whitespace-nowrap bg-[var(--ok-bg)] text-[var(--ok-fg)]">{r.portal.timeOff ? 'Time off' : 'Reads fine'}</span>
      </div>
    )
  }
  return (
    <div className="px-3 py-2.5 flex flex-col items-start gap-1">
      {r.problems.map(p => (
        <span key={p} title={PROBLEM_HINT[p]} className="text-[11.5px] font-bold rounded-full px-[9px] py-[3px] bg-[var(--bdg-red-bg)] text-[var(--bdg-red-fg)]">{PROBLEM_LABEL[p]}</span>
      ))}
    </div>
  )
}

function Row({ r }: { r: TransitionRow }) {
  const p = r.portal
  const cell = 'px-3 py-2.5 min-w-0'
  return (
    <div className={`${GRID} items-start border-b border-[var(--row-rule)] text-[13px] tabular-nums lining-nums hover:bg-[var(--row-hover)]`}>
      <ProblemCell r={r} />
      <div className={`${cell} text-tn-ink font-semibold whitespace-nowrap`}>{dayLabel(r.date)}</div>
      <div className={`${cell} text-tn-ink font-(family-name:--font-display) font-bold`}>{r.person}</div>
      <div className={`${cell} flex flex-col gap-1`}>
        <span className={r.tsheets.job ? 'text-foreground font-semibold break-words' : 'text-[#c8323d] font-bold'}>{r.tsheets.job ?? 'No job'}</span>
        {r.tsheets.fields.length > 0 && (
          <span className="flex flex-col gap-0.5 text-[12px]">
            {r.tsheets.fields.map(f => (
              <span key={f.label} className="break-words"><span className="text-muted">{f.label}:</span> <span className="text-foreground">{f.value}</span></span>
            ))}
          </span>
        )}
        <span className="text-[12px] break-words">
          <span className="text-muted">Notes:</span> {r.tsheets.notes ? <span className="text-foreground">{r.tsheets.notes}</span> : empty}
        </span>
        {r.externalId != null && <span className="text-[11px] text-muted">TSheets #{r.externalId}</span>}
      </div>
      <div className={`${cell} text-right font-semibold text-foreground whitespace-nowrap`}>{formatDuration(r.seconds)}</div>
      {p.timeOff ? (
        <div className={`${cell} col-span-5 text-muted`}>Time off: no project to read.</div>
      ) : (
        <>
          <div className={`${cell} text-foreground break-words`}>{p.client ?? empty}</div>
          <div className={`${cell} text-foreground break-words`}>{p.division ?? empty}</div>
          <div className={`${cell} text-foreground font-semibold break-words`}>{p.project ?? empty}</div>
          <div className={`${cell} text-foreground break-words`}>{p.activity ?? empty}</div>
          <div className={`${cell} text-foreground`}>{p.billable == null ? empty : p.billable ? 'Yes' : 'No'}</div>
        </>
      )}
    </div>
  )
}

export function TransitionReport({ data, go }: { data: TransitionData; go: (q: TransitionQuery) => void }) {
  // The From and To boxes follow the server's period (set while rendering, not in an effect).
  const period = data.switchDate ? { from: data.from, to: data.to ?? '' } : { from: '', to: '' }
  const [range, setRange] = useState(period)
  const [shown, setShown] = useState(period)
  if (shown.from !== period.from || shown.to !== period.to) {
    setShown(period)
    setRange(period)
  }

  if (!data.switchDate) {
    return (
      <div className="flex flex-col gap-[18px] leading-[normal]">
        <Header sub="TSheets entries from the switch date to the 2026 job structure, as TSheets recorded them and as the portal reads them." />
        <div className={`${CARD} px-5 py-14 flex flex-col items-center gap-2.5 text-center`}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#1E9E6A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" /></svg>
          <p className="m-0 font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">No switch date is set yet.</p>
          <p className="m-0 text-[13px] text-muted">Until the day the 2026 job structure (Client, Division, Project and the 2026 Activity) starts is set, every entry uses the TSheets jobs and there is nothing to compare. Once it is set, this page lists every TSheets entry from that day, with what the portal could not read.</p>
        </div>
      </div>
    )
  }

  const q: TransitionQuery = { from: data.from === data.switchDate ? null : data.from, to: data.to, person: data.personId, problems: data.onlyProblems }
  const pick = (patch: Partial<typeof range>) => {
    const next = { ...range, ...patch }
    setRange(next)
    const toOk = next.to === '' || (fullDay(next.to) && next.to >= next.from)
    if (fullDay(next.from) && toOk && (next.from !== period.from || next.to !== period.to)) {
      go({ ...q, from: next.from <= data.switchDate ? null : next.from, to: next.to || null })
    }
  }
  const s = data.summary
  const cards = [
    { label: 'TSheets entries', value: String(s.entries), color: '#012358' },
    { label: 'Hours', value: formatDuration(s.seconds), color: '#012358' },
    { label: 'Entries with a problem', value: String(s.problems), color: s.problems ? '#c8323d' : '#0d7a4f' },
  ]
  const kinds = PROBLEM_ORDER.filter(k => s.byKind[k] > 0)
  const people = [{ value: '', label: 'Everyone' }, ...data.people.map(p => ({ value: p.id, label: p.name }))]

  return (
    <div className="flex flex-col gap-[18px] leading-[normal]">
      <Header sub={`While TSheets and North Time run side by side: every TSheets entry from the switch date (${dateLabel(data.switchDate)}), as TSheets recorded it and as the portal reads it in the 2026 structure. Problems first. Nothing here changes an entry.`} />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
        {cards.map(c => (
          <div key={c.label} className={`${CARD} px-[18px] py-4 flex flex-col gap-1.5`}>
            <span className={LABEL}>{c.label}</span>
            <span className="font-(family-name:--font-display) font-black text-[28px] tabular-nums lining-nums" style={{ color: c.color }}>{c.value}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2.5 items-end">
        <label className="flex flex-col gap-[5px]"><FieldLabel>From</FieldLabel>
          <input type="date" value={range.from} min={data.switchDate} max={range.to || undefined} onChange={e => pick({ from: e.target.value })} className={DATE_INPUT} /></label>
        <label className="flex flex-col gap-[5px]"><FieldLabel>To</FieldLabel>
          <input type="date" value={range.to} min={range.from} onChange={e => pick({ to: e.target.value })} className={DATE_INPUT} /></label>
        <div className="w-full md:w-[200px]">
          <LabeledSelect label="Person" value={data.personId ?? ''} search options={people} onChange={v => go({ ...q, person: v || null })} />
        </div>
        <div className="flex flex-col gap-[5px]">
          <FieldLabel>Show</FieldLabel>
          <Segmented label="Show" display="px-3 py-1.5 text-[12.5px]" value={data.onlyProblems ? 'problems' : 'all'}
            options={[{ key: 'all', label: 'Every entry' }, { key: 'problems', label: 'Only problems' }]}
            onChange={k => go({ ...q, problems: k === 'problems' })} />
        </div>
        {(data.from !== data.switchDate || data.to || data.personId || data.onlyProblems) && (
          <button type="button" onClick={() => go({})} className="h-10 px-2 border-0 bg-transparent cursor-pointer text-[12.5px] font-bold text-tn-teal hover:text-tn-ink">Since the switch date, everyone</button>
        )}
      </div>

      {kinds.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center text-[12.5px] text-muted">
          {kinds.map(k => (
            <span key={k} title={PROBLEM_HINT[k]} className="inline-flex items-center gap-1.5 bg-white border border-[var(--panel-border)] rounded-full px-[11px] py-[5px]">
              <span className="font-bold text-[var(--bdg-red-fg)] tabular-nums">{s.byKind[k]}</span>{PROBLEM_LABEL[k]}
            </span>
          ))}
        </div>
      )}

      {data.rows.length === 0 ? (
        <div className={`${CARD} px-5 py-14 flex flex-col items-center gap-2.5 text-center`}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#1E9E6A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-3 8-9V6l-8-3-8 3v7c0 6 8 9 8 9zM9 12l2 2 4-4" /></svg>
          <p className="m-0 font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">
            {data.onlyProblems && s.entries ? 'No problems in this period: every TSheets entry reads in the 2026 structure.' : 'No TSheets entries in this period.'}
          </p>
        </div>
      ) : (
        <section className="flex flex-col gap-2.5">
          <div className={`${CARD} overflow-auto`}>
            <div className="min-w-[1540px]">
              <div className={`${GRID} bg-subtle`}>
                <div className="px-3 pt-2.5" />
                <div className="col-span-4 mx-3 pt-2.5 pb-1.5 border-b-2 border-[var(--panel-border)] font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink">As recorded in TSheets</div>
                <div className="col-span-5 mx-3 pt-2.5 pb-1.5 border-b-2 border-tn-teal font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink">How the portal read it</div>
              </div>
              <div className={`${GRID} bg-subtle border-b border-[var(--panel-border)]`}>
                {['Problem', 'Date', 'Person', 'Job, fields and notes', 'Hours', 'Client', 'Division', 'Project', 'Activity', 'Billable'].map(h => (
                  <div key={h} className={`px-3 py-2.5 whitespace-nowrap ${LABEL} ${h === 'Hours' ? 'text-right' : ''}`}>{h}</div>
                ))}
              </div>
              {data.rows.map(r => <Row key={r.id} r={r} />)}
            </div>
          </div>
          <p className="m-0 text-[12px] text-muted">
            Billable comes from the 2026 project. The Activity is the 2026 Activity field{data.activityField ? ` ("${data.activityField}")` : ''}; the old TSheets fields show on the left as they were recorded. Time off is listed but not checked.
          </p>
        </section>
      )}
    </div>
  )
}
