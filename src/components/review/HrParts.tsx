'use client'

/**
 * Human Resources' review parts (design handoff, C1, C2, G1 to G6): the review
 * card (Human Resources and Home), My reviews, My goals with "Update a goal",
 * My team's goals with Book, and the 6-month check-in.
 */

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BTN } from '@/lib/ui/buttons'
import { CARD, FIELD_LABEL, TH } from '@/lib/ui/type'
import { TEXTAREA } from '@/lib/ui/fields'
import { Pill } from '@/components/ui/Pill'
import { Segmented } from '@/components/ui/Segmented'
import { StatusIcon } from '@/components/ui/StatusIcon'
import { PdfPreview, type PdfRequest } from '@/components/ui/PdfPreview'
import { Modal, Toast, type ToastState } from '@/components/clocky/entries/ui'
import { EventDrawer, type DrawerApi } from '@/components/agenda/EventDrawer'
import { GOAL_STATUS, type GoalStatus } from '@/lib/review/rules'
import { fmtDay, fmtInstantDay, fmtWhen, initials } from '@/lib/review/format'
import type { Booking } from '@/lib/review/booking'
import type { GoalItem, GoalsView, HistoryRow, ReviewCard as Card, TeamGoalRow } from '@/lib/review/mine'

type Res = { ok: true; toast?: string } | { ok: false; error: string }
const statusOf = (s: GoalStatus) => GOAL_STATUS.find(x => x.key === s)!

// ── The review card ────────────────────────────────────────────────────────

export function ReviewCard({ c, compact = false }: { c: Card; compact?: boolean }) {
  const [pdf, setPdf] = useState<PdfRequest | null>(null)
  const id = c.href.split('/').pop()
  const open = c.state === 'approved'
  return (
    <div className={`${CARD} overflow-hidden flex flex-col`}>
      <div className="h-[3px] bg-[#F2C40A]" />
      <div className={`px-5 ${compact ? 'py-4' : 'py-[18px]'} flex flex-col gap-3`}>
        <span className={FIELD_LABEL}>Your {c.year} review</span>
        <div className="flex flex-col gap-1">
          <span className="font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink leading-tight">{c.title}</span>
          <span className={`text-[13px] leading-[1.5] ${c.state === 'late' ? 'text-[var(--bdg-red-fg)]' : 'text-muted'}`}>{c.sub}</span>
        </div>
        {!compact && c.state !== 'soon' && (
          <ol className="m-0 p-0 list-none flex gap-1.5 flex-wrap">
            {c.steps.map(s => (
              <li key={s.label} className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ${s.state === 'now' ? 'bg-tn-primary text-[#ffffff]' : s.state === 'done' ? 'bg-[var(--bdg-green-bg)] text-[var(--bdg-green-fg)]' : 'bg-subtle text-muted'}`}>
                {s.state === 'done' && <StatusIcon state="done" size={12} />}{s.label}
              </li>
            ))}
          </ol>
        )}
        <div>
          {open
            ? <button type="button" className={BTN.smallNavy} onClick={() => setPdf({ url: `/human-resources/reviews/${id}/pdf`, title: `${c.year} review`, fallbackName: `${c.year} review.pdf` })}>{c.button}</button>
            : <Link href={c.state === 'soon' ? '/human-resources?tab=priorities' : c.href} className={BTN.smallNavy}>{c.button}</Link>}
        </div>
      </div>
      <PdfPreview request={pdf} onClose={() => setPdf(null)} />
    </div>
  )
}

// ── My reviews ─────────────────────────────────────────────────────────────

export function ReviewHistory({ rows, intro, footer }: { rows: HistoryRow[]; intro: string; footer: string }) {
  const [pdf, setPdf] = useState<PdfRequest | null>(null)
  return (
    <div className={`${CARD} px-[22px] py-5 flex flex-col gap-3`}>
      <div className="flex flex-col gap-0.5"><h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink">Annual reviews</h2><span className="text-[13px] text-muted">{intro}</span></div>
      {rows.map(r => (
        <div key={r.key} className="flex items-center gap-3 py-3 border-t border-[var(--row-rule)] first:border-t-0 flex-wrap">
          <span className="w-10 h-10 rounded-[10px] bg-[#fdeeef] text-[#c8323d] flex items-center justify-center font-(family-name:--font-display) font-black text-[10px] flex-none">PDF</span>
          <div className="flex-1 min-w-[220px] flex flex-col gap-0.5">
            <span className="flex items-center gap-2"><span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">{r.year} review</span>{r.kind === 'approved' ? <Pill tone="green" text="Approved" /> : r.kind === 'imported' ? <Pill tone="gray" text="Imported" /> : <Pill tone="blue" text="In progress" />}</span>
            <span className="text-[12.5px] text-muted">{r.line}</span>
          </div>
          {r.pdf
            ? <button type="button" className={BTN.smallWhite} onClick={() => setPdf({ url: r.href, title: `${r.year} review`, fallbackName: `${r.year} review.pdf` })}>{r.kind === 'imported' ? 'Open the PDF' : 'Open PDF'}</button>
            : <Link href={r.href} className={BTN.smallWhite}>Open</Link>}
        </div>
      ))}
      {!rows.length && <p className="m-0 text-[13px] text-muted">No reviews yet.</p>}
      <p className="m-0 text-[12.5px] text-muted">{footer}</p>
      <PdfPreview request={pdf} onClose={() => setPdf(null)} />
    </div>
  )
}

// ── Goals ──────────────────────────────────────────────────────────────────

function GoalCard({ g, onUpdate, comment }: { g: GoalItem; onUpdate?: () => void; comment?: React.ReactNode }) {
  const s = statusOf(g.status)
  return (
    <div className={`${CARD} px-5 py-4 flex gap-3`}>
      <span className="flex-none w-7 h-7 rounded-full bg-[#eaf4f4] text-tn-teal font-(family-name:--font-display) font-extrabold text-[12px] flex items-center justify-center">{g.n}</span>
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px] flex flex-col gap-0.5">
            <span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">{g.what}</span>
            {g.how && <span className="text-[13px] text-[#435066]">Measured by: {g.how}</span>}
          </div>
          <Pill tone={s.tone} text={s.label} />
        </div>
        <span className="text-[12.5px] text-muted">By {g.by}{g.term ? ` · ${g.term}` : ''}{g.serves ? ` · Serves: ${g.serves}` : ''}</span>
        {g.dueNote && <span className="text-[12.5px] font-semibold text-[var(--bdg-orange-fg)]">{g.dueNote}</span>}
        <div className="rounded-[10px] bg-subtle px-3.5 py-2.5 text-[13px] text-[#435066]">
          {g.lastUpdate ? <><span className="font-(family-name:--font-display) font-extrabold text-tn-ink">Updated {fmtInstantDay(g.lastUpdate.at, true).replace(/^\w+, /, '')}</span> {g.lastUpdate.body}</> : <span className="text-muted">No update yet.</span>}
        </div>
        {g.comments.map((c, i) => (
          <div key={i} className="flex gap-2.5 text-[13px]"><span className="w-7 h-7 rounded-full bg-subtle flex items-center justify-center font-(family-name:--font-display) font-extrabold text-[9.5px] text-muted flex-none">{initials(c.who)}</span>
            <span className="flex flex-col"><span className="font-(family-name:--font-display) font-extrabold text-tn-ink">{c.who}{c.checkin ? ' · check-in' : ''}</span><span className="text-[#435066]">{c.body}</span></span></div>
        ))}
        {comment}
      </div>
      {onUpdate && <div className="flex-none"><button type="button" className={BTN.smallWhite} onClick={onUpdate}>Update</button></div>}
    </div>
  )
}

export function MyGoals({ v, api }: { v: GoalsView; api: { updateGoal(i: { goalId: number; status: GoalStatus; body: string }): Promise<Res> } }) {
  const router = useRouter()
  const [editing, setEditing] = useState<GoalItem | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  return (
    <div className="flex flex-col gap-3">
      <div className={`${CARD} px-5 py-4 flex items-center gap-3 flex-wrap`}>
        <StatusIcon state={v.checkin.finished ? 'done' : v.checkin.at ? 'progress' : 'todo'} size={20} />
        <div className="flex-1 min-w-[220px] flex flex-col gap-0.5">
          <span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">6-month check-in with {v.manager.name || 'your manager'}</span>
          <span className="text-[13px] text-muted">{v.checkin.finished ? `Done on ${fmtInstantDay(v.checkin.finished)}.` : v.checkin.at ? `Booked for ${fmtWhen(v.checkin.at)}. You go through every goal together.` : `${v.checkinsBy ? `By ${fmtDay(v.checkinsBy, true)} · ` : ''}${v.manager.name.split(' ')[0] || 'Your manager'} books it in the Agenda. You go through every goal together.`}</span>
        </div>
      </div>
      {v.goals.map(g => <GoalCard key={g.id} g={g} onUpdate={() => setEditing(g)} />)}
      {editing && <UpdateDialog g={editing} manager={v.manager.name} onClose={() => setEditing(null)} onSave={async (status, body) => {
        const r = await api.updateGoal({ goalId: editing.id, status, body })
        if (r.ok) { setEditing(null); setToast({ text: r.toast ?? 'Saved.' }); router.refresh() } else setToast({ text: r.error, error: true })
        setTimeout(() => setToast(null), 5000)
      }} />}
      <Toast toast={toast} />
    </div>
  )
}

function UpdateDialog({ g, manager, onClose, onSave }: { g: GoalItem; manager: string; onClose: () => void; onSave: (s: GoalStatus, body: string) => Promise<void> }) {
  const [status, setStatus] = useState<GoalStatus>(g.status)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <Modal label="Update your goal" width={520} onClose={onClose}>
      <div className="flex flex-col gap-0.5"><h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[19px] text-tn-ink">Update your goal</h2><span className="text-[13px] text-muted">{g.what} · by {g.by}</span></div>
      <div className="flex flex-col gap-1.5"><span className={FIELD_LABEL}>Where it is</span>
        <Segmented label="Where it is" value={status} options={GOAL_STATUS.map(s => ({ key: s.key, label: s.label }))} onChange={setStatus} /></div>
      <label className="flex flex-col gap-1.5"><span className={FIELD_LABEL}>What changed</span>
        <textarea value={body} onChange={e => setBody(e.target.value)} rows={3} autoFocus placeholder="What changed, in a sentence" className={`${TEXTAREA} w-full`} /></label>
      <p className="m-0 text-[12.5px] text-muted">{manager || 'Your manager'} sees the update in their team&apos;s goals and can comment.</p>
      <div className="flex justify-end gap-2.5">
        <button type="button" className={BTN.white} onClick={onClose}>Cancel</button>
        <button type="button" disabled={busy} className={`${BTN.navy} disabled:opacity-50`} onClick={async () => { setBusy(true); try { await onSave(status, body) } finally { setBusy(false) } }}>Save the update</button>
      </div>
    </Modal>
  )
}

// ── My team's goals ────────────────────────────────────────────────────────

export function TeamGoals({ rows }: { rows: TeamGoalRow[] }) {
  return (
    <div className={`${CARD} overflow-x-auto`}>
      <table className="w-full min-w-[760px] border-collapse">
        <thead><tr><th className={TH}>Person</th><th className={TH}>Goals</th><th className={TH}>Where they are</th><th className={TH}>6-month check-in</th><th className={TH}>Last update</th><th className={TH} /></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.personId} className="border-t border-[var(--row-rule)]">
              <td className="px-4 py-3"><span className="flex items-center gap-3"><span className="w-8 h-8 rounded-full border border-[var(--panel-border)] flex items-center justify-center font-(family-name:--font-display) font-extrabold text-[10.5px] text-muted">{initials(r.name)}</span><span className="flex flex-col"><span className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">{r.name}</span><span className="text-[12px] text-muted">{r.title}</span></span></span></td>
              <td className="px-4 py-3 font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">{r.goals}</td>
              <td className="px-4 py-3 text-[13px] text-[#435066]">{r.summary}</td>
              <td className="px-4 py-3">{r.checkin.state === 'done' ? <Pill tone="green" text={r.checkin.label} /> : r.checkin.state === 'booked' ? <Pill tone="blue" text={r.checkin.label} /> : <span className="text-[13px] font-semibold text-[var(--bdg-orange-fg)]">{r.checkin.label}</span>}</td>
              <td className="px-4 py-3 text-[13px] text-muted">{r.lastUpdate ? fmtInstantDay(r.lastUpdate, true).replace(/^\w+, /, '') : 'No update yet'}</td>
              <td className="px-4 py-3 text-right"><Link href={`/human-resources/team-goals/${r.personId}`} className={r.checkin.state === 'book' ? BTN.smallNavy : BTN.smallWhite}>{r.checkin.state === 'book' ? 'Book' : 'Open'}</Link></td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={6} className="px-4 py-6 text-[13px] text-muted">No agreed goals yet for the people who report to you.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

// ── The 6-month check-in ───────────────────────────────────────────────────

export function Checkin({ v, name, booking, drawerApi, today, api }: {
  v: GoalsView; name: string; booking: Booking | null; drawerApi: DrawerApi | null; today: string
  api: {
    commentGoal(i: { goalId: number; body: string; checkin?: boolean }): Promise<Res>
    linkCheckin(i: { personId: string; eventId: string }): Promise<Res>
    finishCheckin(i: { personId: string }): Promise<Res>
  }
}) {
  const router = useRouter()
  const [toast, setToast] = useState<ToastState | null>(null)
  const [drafts, setDrafts] = useState<Record<number, string>>({})
  const [book, setBook] = useState(false)
  const [busy, setBusy] = useState(false)
  const first = name.split(' ')[0]
  const say = (t: ToastState) => { setToast(t); setTimeout(() => setToast(null), 5000) }
  const run = async (go: () => Promise<Res>) => {
    setBusy(true)
    try { const r = await go(); if (r.ok) { if (r.toast) say({ text: r.toast }); router.refresh() } else say({ text: r.error, error: true }) } finally { setBusy(false) }
  }
  const writing = Object.values(drafts).filter(x => x.trim()).length
  return (
    <div className="flex flex-col gap-4 pb-28">
      <div className={`${CARD} px-5 py-4 flex items-center gap-3 flex-wrap`}>
        <StatusIcon state={v.checkin.finished ? 'done' : v.checkin.at ? 'progress' : 'todo'} size={20} />
        <div className="flex-1 min-w-[220px] flex flex-col gap-0.5">
          <span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">{v.checkin.at ? fmtWhen(v.checkin.at) : 'Not booked yet'}</span>
          <span className="text-[13px] text-muted">{v.checkin.finished ? `Finished on ${fmtInstantDay(v.checkin.finished)}.` : v.checkin.at ? `Booked in the Agenda, with ${name}.` : `${v.checkinsBy ? `Due by ${fmtDay(v.checkinsBy, true)}. ` : ''}Book it in the Agenda, filled in.`}</span>
        </div>
        {v.checkin.at && <Link href="/agenda" className={BTN.smallWhite}>Open in the Agenda</Link>}
        {!v.checkin.at && (booking && drawerApi ? <button type="button" className={BTN.smallNavy} onClick={() => setBook(true)}>Book</button> : <span className="text-[12.5px] text-muted">The new Agenda is not open yet.</span>)}
      </div>
      {v.goals.map(g => (
        <GoalCard key={g.id} g={g} comment={!v.checkin.finished && (
          <label className="flex flex-col gap-1.5"><span className={FIELD_LABEL}>Your comment</span>
            <div className="flex gap-2 items-start">
              <textarea value={drafts[g.id] ?? ''} onChange={e => setDrafts(d => ({ ...d, [g.id]: e.target.value }))} rows={2} className={`${TEXTAREA} flex-1`} placeholder={`What you and ${first} agreed about this goal`} />
              <button type="button" disabled={busy || !(drafts[g.id] ?? '').trim()} className={`${BTN.smallWhite} disabled:opacity-50`} onClick={() => run(async () => { const r = await api.commentGoal({ goalId: g.id, body: drafts[g.id]!, checkin: true }); if (r.ok) setDrafts(d => ({ ...d, [g.id]: '' })); return r })}>Save</button>
            </div>
          </label>
        )} />
      ))}
      {!v.checkin.finished && (
        <div className="fixed bottom-0 right-0 left-0 md:left-[var(--rail-w,64px)] z-40 px-4 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-3 pointer-events-none">
          <div className={`${CARD} pointer-events-auto max-w-[1100px] mx-auto px-5 py-3.5 flex flex-wrap items-center gap-3 shadow-[0_-10px_30px_-12px_rgba(1,35,88,.25)]`}>
            <div className="flex-1 min-w-[220px] flex flex-col gap-0.5">
              <span className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">{v.goals.length} goals{writing ? ` · ${writing} comment${writing === 1 ? '' : 's'} not saved yet` : ''}</span>
              <span className="text-[12.5px] text-muted">{first} gets your comments by email and in Needs you when you finish.</span>
            </div>
            <button type="button" disabled={busy} className={`${BTN.navy} disabled:opacity-50`} onClick={() => run(() => api.finishCheckin({ personId: v.personId }))}>Finish the check-in</button>
          </div>
        </div>
      )}
      {book && booking && drawerApi && (
        <EventDrawer setup={booking.setup} preset={booking.preset} note={booking.note} today={today} api={drawerApi} onClose={() => setBook(false)}
          onDone={async (t, id) => { setBook(false); if (id) await run(() => api.linkCheckin({ personId: v.personId, eventId: String(id) })); else say({ text: t }) }} />
      )}
      <Toast toast={toast} />
    </div>
  )
}
