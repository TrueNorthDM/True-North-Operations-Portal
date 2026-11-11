'use client'

/**
 * Human Resources > Reviews (design handoff, B1 and A5): one row a person for
 * the year, with the step, who it waits for, the due date and the Drive copy.
 * The numbers on top filter the list. Before the year starts, the VP of
 * Operations starts it (owner, 10 November 2026); once started, the progress
 * block on top shows each step, who did it, and its date.
 */

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BTN, BTN_ICON } from '@/lib/ui/buttons'
import { withViewAs } from '@/components/ViewAsKeeper'
import { FileButton } from '@/components/ui/FileViewer'
import { CARD, FIELD_LABEL, PAGE_TITLE, TH } from '@/lib/ui/type'
import { Pill, type PillToneName } from '@/components/ui/Pill'
import { Segmented } from '@/components/ui/Segmented'
import { StatusIcon } from '@/components/ui/StatusIcon'
import { Modal, Toast, type ToastState } from '@/components/clocky/entries/ui'
import { fmtDay, initials } from '@/lib/review/format'
import { INPUT } from '@/lib/ui/fields'
import { DateField } from '@/components/ui/DateField'
import type { Progress, ProgressRow } from '@/lib/review/progress'
import type { DateKey } from '@/lib/review/schedule'

export interface ListRow {
  id: number; personId: string; name: string; sub: string; team: string; leader: string | null
  step: 'waiting' | 'self' | 'review' | 'meeting' | 'approval' | 'approved'; sentBack: boolean; booked: string | null
  waits: string; due: string | null; dueText: string; late: boolean; approvedOn: string | null; drive: 'waiting' | 'saved' | 'failed' | null
}
export interface ImportListRow { id: number; name: string; file: string; when: string | null }
export interface StartCheck { key: string; label: string; text: string; ok: boolean | 'warn'; href: string; action: string }
/** Before the year starts (owner, 10 November 2026): what the kickoff does, with the dates it would set today. */
export interface KickoffInfo {
  canStart: boolean; canSettings: boolean; checks: StartCheck[]; warn: string | null
  plan: { label: string; who: string; due: string }[]; people: number; added: string[]; finish: string
}
export interface DateRow { key: DateKey; label: string; value: string | null }

const STEP_PILL: Record<ListRow['step'], [string, PillToneName]> = {
  // Each step waits on someone: amber (owner, 8 November 2026).
  waiting: ['Not open yet', 'gray'], self: ['Self-review', 'amber'], review: ['Review', 'amber'], meeting: ['Meeting', 'amber'], approval: ['Approval', 'amber'], approved: ['Approved', 'green'],
}
type Filter = 'all' | 'self' | 'review' | 'meeting' | 'approved'
type Res = { ok: true; toast?: string } | { ok: false; error: string }

export function ReviewList({ year, years, intro, rows, imports, canPriorities, kickoff, progress, dates, approvals, openStart = false, api, tabs }: {
  /** Human Resources' tabs: the list is its Reviews tab. */
  tabs?: React.ReactNode
  year: number; years: number[]; intro: string; rows: ListRow[]; imports: ImportListRow[] | null
  canPriorities: boolean
  kickoff: KickoffInfo | null
  /** The progress block: the VP of Operations, the CISO, HR and Super Admins. */
  progress: Progress | null
  /** The year's dates, for whoever may move them. */
  dates: DateRow[] | null
  /** The reviews waiting for the viewer's approval: "Approve all". */
  approvals: { ids: number[]; names: string[] } | null
  /** Opened from Needs you's "Start Reviews". */
  openStart?: boolean
  api?: {
    startCycle(i: { year: number }): Promise<Res>
    moveDatesUp(i: { year: number; key: DateKey }): Promise<Res>
    saveReviewDates(i: { year: number; dates: Partial<Record<DateKey, string | null>> }): Promise<Res>
    approveAll(i: { reviewIds: number[] }): Promise<Res>
    remindNow(i: { reviewId: number; part?: 0 | 1 | null }): Promise<Res>
  }
}) {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>('all')
  const [toast, setToast] = useState<ToastState | null>(null)
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState(openStart && !!kickoff?.canStart)
  const [who, setWho] = useState<ProgressRow | null>(null)
  const [approveOpen, setApproveOpen] = useState(false)
  const [datesOpen, setDatesOpen] = useState(false)
  const n = (f: (r: ListRow) => boolean) => rows.filter(f).length
  const selfRows = rows.filter(r => r.step === 'self' || r.step === 'waiting')
  const tiles: { key: Filter; label: string; value: number; sub: string; red?: boolean }[] = [
    { key: 'all', label: 'All', value: rows.length, sub: 'in the review' },
    { key: 'self', label: 'Self-review', value: selfRows.length, sub: [n(r => (r.step === 'self') && r.late) && `${n(r => r.step === 'self' && r.late)} late`, n(r => r.sentBack && r.step === 'self') && `${n(r => r.sentBack && r.step === 'self')} sent back`].filter(Boolean).join(', ') || 'on time', red: n(r => r.step === 'self' && r.late) > 0 },
    { key: 'review', label: 'In review', value: n(r => r.step === 'review' || r.step === 'approval'), sub: 'waiting on a reviewer' },
    { key: 'meeting', label: 'Meeting', value: n(r => r.step === 'meeting'), sub: `${n(r => r.step === 'meeting' && !r.booked)} to book` },
    { key: 'approved', label: 'Approved', value: n(r => r.step === 'approved'), sub: driveSub(n(r => r.step === 'approved' && r.drive === 'failed'), n(r => r.step === 'approved' && r.drive === 'waiting')) },
  ]
  const shown = useMemo(() => rows.filter(r => filter === 'all' || (filter === 'self' ? r.step === 'self' || r.step === 'waiting' : filter === 'meeting' ? r.step === 'meeting' : filter === 'review' ? r.step === 'review' || r.step === 'approval' : r.step === filter)), [rows, filter])

  const say = (r: Res) => setToast(r.ok ? { text: r.toast ?? 'Done.' } : { text: r.error, error: true })
  const go = async (f: () => Promise<Res>) => {
    if (!api) return
    setBusy(true)
    try { const r = await f(); say(r); if (r.ok) router.refresh() } catch { setToast({ text: 'That did not go through. Try again in a moment.', error: true }) } finally { setBusy(false) }
  }
  const PLAY = 'M6 4l14 8-14 8z'

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[260px] flex flex-col gap-1.5">
          <h1 className={PAGE_TITLE}>{tabs ? 'Human Resources' : 'Reviews'}</h1>
          <p className="m-0 text-[15px] text-muted leading-relaxed">{intro}</p>
        </div>
        {years.length > 1 && <Segmented label="Year" value={year} options={years.map(y => ({ key: y, label: String(y) }))} onChange={y => router.push(withViewAs(`/human-resources/reviews?year=${y}`))} />}
        {canPriorities && (
          <Link href="/human-resources/reviews/priorities" className={`${BTN.white} py-[9px]`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 22V4M4 4h13l-2 4 2 4H4" /></svg>
            Priorities
          </Link>
        )}
        {kickoff && (kickoff.canStart
          ? <button type="button" disabled={busy} className={`${BTN.navy} disabled:opacity-50`} onClick={() => setAsking(true)}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={PLAY} /></svg>Start Reviews</button>
          : null)}
      </div>

      {tabs}

      {kickoff && (
        <div className={`${CARD} px-[22px] py-5 flex flex-col gap-1`}>
          <h2 className="m-0 mb-1 font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink">{year} reviews, not started</h2>
          <p className="m-0 mb-2 text-[13.5px] text-[#435066]">{kickoff.canStart ? `Nobody has been asked for anything yet. Starting asks the CISO and you for the priorities and opens everyone's self-review; every step has its date, all done by ${kickoff.finish}.` : 'Waiting for the VP of Operations to start the reviews.'}</p>
          {kickoff.checks.map(c => (
            <div key={c.key} className="flex items-start gap-3 py-3 border-t border-[#f1f3f6]">
              <StatusIcon state={c.ok === true ? 'done' : c.ok === 'warn' ? 'progress' : 'todo'} size={18} className="mt-px" />
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="text-[14px] font-bold text-tn-ink">{c.label}</span>
                <span className={`text-[13px] leading-[1.5] ${c.ok === true ? 'text-[#5b6b82]' : 'text-[var(--bdg-orange-fg)]'}`}>{c.text}</span>
              </div>
              {(kickoff.canSettings || !c.href.startsWith('/admin/')) && <Link href={c.href} className="font-(family-name:--font-display) font-extrabold text-[12.5px] text-tn-teal hover:text-tn-ink">{c.action}</Link>}
            </div>
          ))}
        </div>
      )}

      {asking && kickoff && (
        <Modal label={`Start the ${year} reviews`} width={640} gap={14} onClose={() => setAsking(false)}>
          <h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[19px] text-tn-ink">Start the {year} reviews</h2>
          <div className="flex flex-col gap-1.5 max-w-[240px]"><span className={FIELD_LABEL}>Year</span><span className={`${INPUT} flex items-center font-bold text-tn-ink`}>{year}</span><span className="text-[12px] text-muted">Only the current year.</span></div>
          <p className="m-0 text-[13.5px] text-[#435066]">What happens when you start, with the dates it sets from today:</p>
          <div className="rounded-[12px] border border-[var(--panel-border)] overflow-hidden">
            <table className="w-full border-collapse text-[13px]">
              <tbody>
                {kickoff.plan.map((r, i) => (
                  <tr key={i} className="border-t border-[var(--row-rule)] first:border-t-0">
                    <td className="px-3.5 py-2 font-bold text-tn-ink">{r.label}</td>
                    <td className="px-3.5 py-2 text-[#435066]">{r.who}</td>
                    <td className="px-3.5 py-2 text-right tabular-nums text-tn-ink whitespace-nowrap">{r.due}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="m-0 rounded-[10px] bg-[#eaf4f4] px-3.5 py-2.5 text-[13px] leading-[1.5] text-tn-ink">{kickoff.people} people take part{kickoff.added.length ? `, with ${kickoff.added.join(', ')} added in Company settings` : ''}. Everyone gets their self-review now, by email and on Needs you; the CISO and you are asked for the priorities. Each approved review is copied to Google Drive, and the 6-month check-in comes six months from today.</p>
          {kickoff.warn && <p className="m-0 rounded-[10px] bg-[#fdf8e7] border border-[#f0e2a8] px-3 py-2.5 text-[13px] leading-[1.5] text-[#8a6d1a]">{kickoff.warn}</p>}
          <div className="flex justify-end gap-2.5 pt-1">
            <button type="button" className={BTN.white} onClick={() => setAsking(false)}>Cancel</button>
            <button type="button" disabled={busy} className={`${BTN.navy} disabled:opacity-50`} onClick={() => { setAsking(false); void go(() => api!.startCycle({ year })) }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={PLAY} /></svg>Start the {year} reviews</button>
          </div>
        </Modal>
      )}

      {approvals && approvals.ids.length > 0 && (
        <div className={`${CARD} px-[22px] py-4 flex flex-wrap items-center gap-3`}>
          <div className="flex-1 min-w-[240px] flex flex-col gap-0.5">
            <span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">{approvals.ids.length} {approvals.ids.length === 1 ? 'review is' : 'reviews are'} ready for your approval</span>
            <span className="text-[13px] text-muted">{approvals.names.join(', ')}. Read each one&apos;s meeting notes and add your final remarks, then approve them together.</span>
          </div>
          <button type="button" disabled={busy} className={`${BTN.navy} disabled:opacity-50`} onClick={() => setApproveOpen(true)}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>Approve all</button>
        </div>
      )}
      {approveOpen && approvals && (
        <Modal label="Approve all" width={500} gap={12} alert onClose={() => setApproveOpen(false)}>
          <h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[18px] text-tn-ink">Approve {approvals.ids.length} {approvals.ids.length === 1 ? 'review' : 'reviews'}?</h2>
          <p className="m-0 text-[13.5px] leading-[1.6] text-[#435066]">{approvals.names.join(', ')}. Each one locks; a review with a second reviewer is complete when they approve too. The PDFs are made and copied to Google Drive, and HR is told.</p>
          <div className="flex justify-end gap-2.5 pt-1">
            <button type="button" className={BTN.white} onClick={() => setApproveOpen(false)}>Cancel</button>
            <button type="button" disabled={busy} className={`${BTN.navy} disabled:opacity-50`} onClick={() => { setApproveOpen(false); void go(() => api!.approveAll({ reviewIds: approvals.ids })) }}>Approve all</button>
          </div>
        </Modal>
      )}

      {progress && <ProgressBlock year={year} p={progress} canDates={!!dates} busy={busy} onWho={setWho} onMoveUp={key => void go(() => api!.moveDatesUp({ year, key }))} onDates={() => setDatesOpen(true)} />}
      {who && <WhoWindow row={who} canRemind={!!api} busy={busy} onClose={() => setWho(null)} onRemind={(id, part) => void go(() => api!.remindNow({ reviewId: id, part }))} />}
      {datesOpen && dates && <DatesWindow dates={dates} busy={busy} onClose={() => setDatesOpen(false)} onSave={patch => { setDatesOpen(false); void go(() => api!.saveReviewDates({ year, dates: patch })) }} />}

      {imports ? (
        <div className={`${CARD} overflow-x-auto`}>
          <table className="w-full min-w-[640px] border-collapse">
            <thead><tr><th className={TH}>Employee</th><th className={TH}>File</th><th className={TH}>Imported</th><th className={TH} /></tr></thead>
            <tbody>
              {imports.map(r => (
                <tr key={r.id} className="border-t border-[var(--row-rule)]">
                  <td className="px-4 py-3 font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">{r.name}</td>
                  <td className="px-4 py-3 text-[13px] text-[#435066]">{r.file}</td>
                  <td className="px-4 py-3 text-[13px] text-muted">{r.when ? fmtDay(r.when.slice(0, 10)) : ''}</td>
                  <td className="px-4 py-3 text-right"><FileButton file={{ href: `/human-resources/imports/${r.id}/file`, title: 'Imported review', name: 'review.pdf' }} className={BTN.smallWhite}>Open the PDF</FileButton></td>
                </tr>
              ))}
              {!imports.length && <tr><td colSpan={4} className="px-4 py-6 text-[13px] text-muted">No {year} reviews imported yet. Import them in Company settings › Human Resources.</td></tr>}
            </tbody>
          </table>
        </div>
      ) : rows.length > 0 && (
        <>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
            {tiles.map(t => (
              <button key={t.key} type="button" onClick={() => setFilter(t.key)} aria-pressed={filter === t.key}
                className={`${CARD} text-left px-4 py-3.5 flex flex-col gap-[7px] cursor-pointer ${filter === t.key ? 'border-tn-teal shadow-[0_0_0_3px_rgba(30,125,127,.12)]' : 'hover:border-tn-teal'}`}>
                <span className={FIELD_LABEL}>{t.label}</span>
                <span className="font-(family-name:--font-display) font-black text-[28px] text-tn-ink leading-none tabular-nums">{t.value}</span>
                <span className={`text-[12px] ${t.red ? 'text-[var(--bdg-red-fg)]' : 'text-[#8593a4]'}`}>{t.sub}</span>
              </button>
            ))}
          </div>
          <div className={`${CARD} overflow-x-auto`}>
            <table className="w-full min-w-[900px] border-collapse">
              <thead><tr className="bg-[#f4f2ec] border-b border-[#e4e7ec]"><th className={TH}>Employee</th><th className={TH}>Team</th><th className={TH}>Team Leader</th><th className={TH}>Step</th><th className={TH}>Waits for</th><th className={TH}>Due</th><th className={TH}>Drive</th></tr></thead>
              <tbody>
                {shown.map(r => {
                  const [label, tone] = r.sentBack && r.step === 'self' ? ['Sent back', 'amber' as PillToneName] : STEP_PILL[r.step]
                  return (
                    <tr key={r.id} onClick={() => router.push(withViewAs(`/human-resources/reviews/${r.id}`))} className="border-t border-[#f1f3f6] cursor-pointer hover:bg-[#fbfaf6]">
                      <td className="px-4 py-2.5">
                        <Link href={`/human-resources/reviews/${r.id}`} className="flex items-center gap-3 no-underline" onClick={e => e.stopPropagation()}>
                          <span className="w-8 h-8 rounded-full border border-[#dfe4ea] bg-[#eef1f5] flex items-center justify-center font-(family-name:--font-display) font-extrabold text-[11px] text-[#435066] flex-none">{initials(r.name)}</span>
                          <span className="flex flex-col min-w-0"><span className="text-[13.5px] font-bold text-tn-ink">{r.name}</span><span className="text-[12px] text-[#8593a4] truncate">{r.sub}</span></span>
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-[13px] text-[#435066]">{r.team}</td>
                      <td className={`px-4 py-2.5 text-[13px] ${r.leader ? 'text-[#435066]' : 'text-[#8593a4]'}`}>{r.leader ?? 'No Team Leader'}</td>
                      <td className="px-4 py-2.5"><Pill tone={tone} text={label} /></td>
                      <td className="px-4 py-2.5 text-[13px] text-[#435066]">{r.waits}</td>
                      <td className={`px-4 py-2.5 text-[13px] font-bold ${r.late ? 'text-[var(--bdg-red-fg)]' : r.step === 'approved' ? 'text-[#8593a4]' : 'text-tn-ink'}`}>{r.step === 'approved' && r.approvedOn ? `Approved ${fmtDay(r.approvedOn.slice(0, 10)).replace(/^\w+, /, '')}` : r.dueText}</td>
                      <td className="px-4 py-2.5">{r.step === 'approved' && <DriveState s={r.drive ?? 'waiting'} />}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="m-0 text-[12.5px] text-[#8593a4]">{rows.length} {rows.length === 1 ? 'employee' : 'employees'} in the review. Every employee has one; anyone else is added in Company settings › Human Resources.</p>
        </>
      )}
      <Toast toast={toast} />
    </div>
  )
}

const STATE_PILL: Record<ProgressRow['state'], [string, PillToneName]> = { done: ['Done', 'green'], now: ['In progress', 'amber'], late: ['Late', 'red'], later: ['Later', 'gray'] }

/** The year's steps on top of Reviews (owner, 10 November 2026). */
function ProgressBlock({ year, p, canDates, busy, onWho, onMoveUp, onDates }: { year: number; p: Progress; canDates: boolean; busy: boolean; onWho: (r: ProgressRow) => void; onMoveUp: (k: DateKey) => void; onDates: () => void }) {
  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="px-[22px] py-4 flex flex-wrap items-center gap-4 border-b border-[var(--row-rule)]">
        <div className="flex-1 min-w-[240px] flex flex-col gap-0.5">
          <h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink">{year} reviews</h2>
          <span className="text-[12.5px] text-muted">Week {p.week} of {p.weeks}{p.lateCount ? ` · ${p.lateCount} ${p.lateCount === 1 ? 'person' : 'people'} late` : ' · on time'}</span>
        </div>
        <div className="min-w-[220px] flex flex-col gap-1.5">
          <span className="flex items-baseline gap-2"><b className="font-(family-name:--font-display) font-extrabold text-[22px] text-tn-ink tabular-nums">{p.pct}%</b><span className="text-[13px] text-muted">of the steps done</span></span>
          <span className="block h-2 rounded-full bg-[var(--row-rule)] overflow-hidden"><span className="block h-full rounded-full bg-tn-primary" style={{ width: `${p.pct}%` }} /></span>
        </div>
        {canDates && <button type="button" className={BTN.smallWhite} onClick={onDates}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5h16v16H4zM4 10h16M9 3v4M15 3v4" /></svg>Change the dates</button>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse">
          <thead><tr className="bg-[#f4f2ec] border-b border-[#e4e7ec]"><th className={TH}>Step</th><th className={TH}>Who</th><th className={TH}>Done</th><th className={TH}>Due</th><th className={TH}>State</th><th className={TH} /></tr></thead>
          <tbody>
            {p.rows.map(r => {
              const [label, tone] = STATE_PILL[r.state]
              const pct = r.total ? Math.round((r.done / r.total) * 100) : 0
              return (
                <tr key={r.key} className="border-t border-[#f1f3f6]">
                  <td className="px-4 py-2.5 text-[13.5px] font-bold text-tn-ink">{r.label}{r.note && <span className="block text-[12px] font-normal text-muted">{r.note}</span>}</td>
                  <td className="px-4 py-2.5 text-[13px] text-[#435066]">{r.who}</td>
                  <td className="px-4 py-2.5 min-w-[140px]">{r.items.length ? <><span className="block h-1.5 max-w-[140px] rounded-full bg-[var(--row-rule)] overflow-hidden mb-1"><span className="block h-full rounded-full bg-tn-primary" style={{ width: `${pct}%` }} /></span><span className="text-[12.5px] text-[#435066] tabular-nums">{r.done} of {r.total}</span></> : <span className="text-[12.5px] text-[#435066]">{r.done ? 'Done' : 'Not yet'}</span>}</td>
                  <td className="px-4 py-2.5 text-[13px] text-tn-ink whitespace-nowrap">{r.due ? fmtDay(r.due) : ''}</td>
                  <td className="px-4 py-2.5"><Pill tone={tone} text={r.state === 'late' ? `${r.items.filter(x => x.late).length || ''} late`.trim() : label} /></td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    {r.moveUp && canDates ? <button type="button" disabled={busy} className={`${BTN.link} mr-3`} onClick={() => onMoveUp(r.dateKey!)}>Move the later dates up {r.moveUp} {r.moveUp === 1 ? 'day' : 'days'}</button> : null}
                    {r.items.length > 0 && <button type="button" className={BTN.link} onClick={() => onWho(r)}>Who</button>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

type WhoFilter = 'all' | 'open' | 'late' | 'done'

/** Who finished a step and who did not, late first, with Remind. */
function WhoWindow({ row, canRemind, busy, onClose, onRemind }: { row: ProgressRow; canRemind: boolean; busy: boolean; onClose: () => void; onRemind: (reviewId: number, part: 0 | 1 | null) => void }) {
  const [f, setF] = useState<WhoFilter>('all')
  const items = row.items.filter(x => f === 'all' || (f === 'open' ? !x.done : f === 'late' ? x.late : x.done))
  const count = (g: (x: ProgressRow['items'][number]) => boolean) => row.items.filter(g).length
  return (
    <Modal label={row.label} width={780} gap={14} onClose={onClose}>
      <div className="flex flex-col gap-0.5">
        <h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[18px] text-tn-ink">{row.label}</h2>
        <span className="text-[12.5px] text-muted">{row.done} of {row.total} done{row.due ? ` · due ${fmtDay(row.due)}` : ''}</span>
      </div>
      <Segmented label="Show" value={f} options={[{ key: 'all', label: `All ${row.items.length}` }, { key: 'open', label: `Not done ${count(x => !x.done)}` }, { key: 'late', label: `Late ${count(x => x.late)}` }, { key: 'done', label: `Done ${count(x => x.done)}` }]} onChange={setF} />
      <div className="rounded-[12px] border border-[var(--panel-border)] overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse">
          <thead><tr className="bg-[#f4f2ec] border-b border-[#e4e7ec]"><th className={TH}>Person</th><th className={TH}>Reviewer</th><th className={TH}>Where it is</th><th className={TH}>State</th><th className={TH} /></tr></thead>
          <tbody>
            {items.map(x => (
              <tr key={x.key} className="border-t border-[#f1f3f6]">
                <td className="px-4 py-2.5"><span className="flex items-center gap-2.5"><span className="w-7 h-7 rounded-full bg-tn-primary text-[#ffffff] flex items-center justify-center font-(family-name:--font-display) font-extrabold text-[10.5px] flex-none">{initials(x.name)}</span>{x.reviewId ? <Link href={`/human-resources/reviews/${x.reviewId}`} className="text-[13.5px] font-bold text-tn-ink no-underline hover:underline">{x.name}</Link> : <span className="text-[13.5px] font-bold text-tn-ink">{x.name}</span>}</span></td>
                <td className="px-4 py-2.5 text-[13px] text-[#435066]">{x.reviewer ?? ''}{x.area ? <span className="text-muted"> · {x.area}</span> : null}</td>
                <td className="px-4 py-2.5 text-[13px] text-[#435066]">{x.where}</td>
                <td className="px-4 py-2.5"><Pill tone={x.done ? 'green' : x.late ? 'red' : 'amber'} text={x.done ? 'Done' : x.late ? 'Late' : 'Open'} /></td>
                <td className="px-4 py-2.5 text-right">{!x.done && canRemind && x.reviewId && <button type="button" disabled={busy} className={BTN.smallWhite} onClick={() => onRemind(x.reviewId!, x.part)}>Remind</button>}</td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={5} className="px-4 py-5 text-[13px] text-muted">Nobody here.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="m-0 text-[12.5px] text-muted">Someone with two reviewers is listed once for each reviewer in the reviewers&apos; steps.</p>
    </Modal>
  )
}

/** Change the year's dates (VP of Operations, HR, Super Admins). */
function DatesWindow({ dates, busy, onClose, onSave }: { dates: DateRow[]; busy: boolean; onClose: () => void; onSave: (patch: Partial<Record<DateKey, string>>) => void }) {
  const [v, setV] = useState<Record<string, string>>(Object.fromEntries(dates.map(d => [d.key, d.value ?? ''])))
  const changed = Object.fromEntries(dates.filter(d => (v[d.key] || null) !== d.value && v[d.key]).map(d => [d.key, v[d.key]])) as Partial<Record<DateKey, string>>
  return (
    <Modal label="Change the dates" width={620} gap={14} onClose={onClose}>
      <h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[18px] text-tn-ink">Change the dates</h2>
      <p className="m-0 text-[13.5px] leading-[1.55] text-[#435066]">They came from the kickoff. When a step finishes early, the progress block offers to move the dates after it up; a late step never moves the dates after it. The reminders follow the dates.</p>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
        {dates.map(d => (
          <label key={d.key} className="flex flex-col gap-1.5"><span className={FIELD_LABEL}>{d.label}</span>
            <DateField value={v[d.key]} ariaLabel={d.label} onChange={x => setV(s => ({ ...s, [d.key]: x }))} /></label>
        ))}
      </div>
      <div className="flex justify-end gap-2.5 pt-1">
        <button type="button" className={BTN.white} onClick={onClose}>Cancel</button>
        <button type="button" disabled={busy || !Object.keys(changed).length} className={`${BTN.navy} disabled:opacity-50`} onClick={() => onSave(changed)}>Save the dates</button>
      </div>
    </Modal>
  )
}

// The Drive column (design handoff, B1): a coloured word with its symbol, no pill.
/** The Approved tile's line: a failed copy is named first, it needs someone. */
function driveSub(failed: number, waiting: number): string {
  const parts = [failed && `${failed} failed to copy to Drive`, waiting && `${waiting} waiting to copy to Drive`].filter(Boolean)
  return parts.length ? parts.join(', ') : 'all in Drive'
}

function DriveState({ s }: { s: 'waiting' | 'saved' | 'failed' }) {
  const [fg, d, word] = s === 'saved' ? ['#0d7a4f', 'M5 12l5 5 9-10', 'Saved'] : s === 'failed' ? ['#c8323d', 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z', 'Failed'] : ['#9a5a00', 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z', 'Waiting']
  return <span className="flex items-center gap-1.5 text-[12.5px] font-bold" style={{ color: fg }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>{word}</span>
}
