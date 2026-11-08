'use client'

/**
 * Human Resources' review parts (design handoff, C1, C2, G1 to G6): the review
 * card (Human Resources and Home), My reviews, My goals with "Update a goal",
 * My team's goals with Book, and the 6-month check-in.
 */

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BTN, BTN_ICON } from '@/lib/ui/buttons'
import { CARD, FIELD_LABEL } from '@/lib/ui/type'
import { TEXTAREA } from '@/lib/ui/fields'
import { Pill } from '@/components/ui/Pill'
import { Segmented } from '@/components/ui/Segmented'
import { PdfPreview, type PdfRequest } from '@/components/ui/PdfPreview'
import { CloseButton, Modal, Toast, type ToastState } from '@/components/clocky/entries/ui'
import { EventDrawer, type DrawerApi } from '@/components/agenda/EventDrawer'
import { GOAL_STATUS, type GoalStatus } from '@/lib/review/rules'
import { fmtDay, fmtInstantDay, fmtWhen, initials } from '@/lib/review/format'
import type { Booking } from '@/lib/review/booking'
import type { GoalItem, GoalsView, HistoryRow, ReviewCard as Card, TeamGoalRow } from '@/lib/review/mine'
import { APR_COLORS } from '@/lib/review/colors'

type Res = { ok: true; toast?: string } | { ok: false; error: string }
const statusOf = (s: GoalStatus) => GOAL_STATUS.find(x => x.key === s)!

// ── The review card ────────────────────────────────────────────────────────

// The button of each state (design handoff, C2): navy to act, white to look.
const CARD_BUTTON: Record<Card['state'], { tone: 'navy' | 'white'; d: string }> = {
  soon: { tone: 'white', d: 'M4 22V4M4 4h13l-2 4 2 4H4' },
  open: { tone: 'navy', d: 'M6 4l14 8-14 8z' },
  progress: { tone: 'navy', d: 'M6 4l14 8-14 8z' },
  late: { tone: 'navy', d: 'M6 4l14 8-14 8z' },
  with_reviewer: { tone: 'white', d: 'M9 6l6 6-6 6' },
  booked: { tone: 'white', d: 'M9 6l6 6-6 6' },
  agree: { tone: 'navy', d: 'M5 12l5 5 9-10' },
  approved: { tone: 'white', d: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z' },
}
const CLIPBOARD = 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2H9zM9 14l2 2 4-4'

/**
 * The review card (design handoff, C1 and C2): wide at the top of Human
 * Resources, compact at the top of Home's right column.
 */
export function ReviewCard({ c, compact = false }: { c: Card; compact?: boolean }) {
  const [pdf, setPdf] = useState<PdfRequest | null>(null)
  const id = c.href.split('/').pop()
  const look = CARD_BUTTON[c.state]
  const bar = (s: Card['steps'][number]) => s.state === 'done' ? 'bg-[#1E9E6A]' : s.state === 'now' ? 'bg-tn-ink' : 'bg-[#e4e7ec]'
  const icon = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={look.tone === 'navy' ? BTN_ICON.navy : BTN_ICON.white} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={look.d} /></svg>
  const btnClass = `${look.tone === 'navy' ? BTN.navy : BTN.white}${compact ? ' w-full justify-center' : ''}`
  const button = c.state === 'approved'
    ? <button type="button" className={btnClass} onClick={() => setPdf({ url: `/human-resources/reviews/${id}/pdf`, title: `${c.year} review`, fallbackName: `${c.year} review.pdf`, sheets: true })}>{icon}{c.button}</button>
    : <Link href={c.state === 'soon' ? '/human-resources?tab=priorities' : c.href} className={btnClass}>{icon}{c.button}</Link>
  const subTone = c.state === 'late' ? 'text-[#c8323d]' : 'text-[#5b6b82]'
  const tile = (size: number, glyph: number) => (
    <span className="rounded-[12px] bg-tn-ink text-[#F2C40A] flex items-center justify-center flex-none" style={{ width: size, height: size, borderRadius: size > 40 ? 12 : 9 }}>
      <svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={size > 40 ? 2 : 2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={CLIPBOARD} /></svg>
    </span>
  )
  return (
    <div style={APR_COLORS} className={`${CARD} shadow-[0_18px_40px_-26px_rgba(1,35,88,.45)] ${compact ? 'rounded-[14px] px-[18px] py-4 flex flex-col gap-3' : 'rounded-[16px] px-6 py-5 flex flex-wrap items-center gap-[22px]'}`}>
      {compact ? (
        <>
          <div className="flex items-center gap-2.5">{tile(32, 16)}<span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-[#8593a4]">Your {c.year} review</span></div>
          <div className="flex flex-col gap-[3px]"><span className="font-(family-name:--font-display) font-extrabold text-[16px] text-tn-ink">{c.title}</span><span className={`text-[13px] leading-[1.5] ${subTone}`}>{c.sub}</span></div>
          <div className="grid grid-cols-4 gap-1">{c.steps.map(s => <span key={s.label} className={`h-[5px] rounded-full ${bar(s)}`} />)}</div>
          {button}
        </>
      ) : (
        <>
          {tile(46, 22)}
          <div className="flex-1 min-w-[220px] flex flex-col gap-1">
            <span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-[#8593a4]">Your {c.year} review</span>
            <span className="font-(family-name:--font-display) font-extrabold text-[19px] text-tn-ink">{c.title}</span>
            <span className={`text-[13.5px] ${subTone}`}>{c.sub}</span>
          </div>
          <ol className="m-0 p-0 list-none grid grid-cols-[repeat(4,84px)] gap-1.5">
            {c.steps.map(s => (
              <li key={s.label} className="flex flex-col gap-1.5">
                <span className={`h-[5px] rounded-full ${bar(s)}`} />
                <span className={`text-[11.5px] font-bold ${s.state === 'next' ? 'text-[#8593a4]' : 'text-tn-ink'}`}>{s.label}</span>
              </li>
            ))}
          </ol>
          {button}
        </>
      )}
      <PdfPreview request={pdf} onClose={() => setPdf(null)} />
    </div>
  )
}

// ── My reviews ─────────────────────────────────────────────────────────────

const EYE = 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'
const DOC = 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5'
const Ico = ({ d }: { d: string }) => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>

/** The teal line under the reviews: where else they are, or who sees them. */
export function HistoryNote({ text }: { text: string }) {
  return <p className="m-0 flex items-center gap-2.5 rounded-[12px] bg-[#eaf4f4] px-4 py-3 text-[13.5px] leading-[1.5] text-[#12585a]"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="flex-none" aria-hidden="true"><path d={EYE} /></svg>{text}</p>
}

/** Every review of the person by year, with its PDF (design handoff G1, G2). */
export function ReviewHistory({ rows, intro }: { rows: HistoryRow[]; intro: string }) {
  const [pdf, setPdf] = useState<PdfRequest | null>(null)
  const open = (r: HistoryRow) => setPdf({ url: r.href, title: `${r.year} review`, fallbackName: `${r.year} review.pdf`, sheets: true })
  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="px-5 pt-4 pb-1.5 flex items-baseline justify-between gap-3 flex-wrap"><h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink">Annual reviews</h2><span className="text-[12.5px] text-[#8593a4]">{intro}</span></div>
      {rows.map(r => (
        <div key={r.key} className="flex items-center flex-wrap gap-3.5 px-5 py-3.5 border-t border-[#f1f3f6]">
          <span className="w-[38px] h-[38px] rounded-[10px] bg-[#f1f3f6] text-[#5b6b82] flex items-center justify-center flex-none"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={DOC} /></svg></span>
          <div className="flex-[1_1_260px] min-w-0 flex flex-col gap-0.5">
            <span className="flex items-center gap-2.5 flex-wrap"><span className="text-[15px] font-extrabold text-tn-ink">{r.year} review</span>{r.kind === 'approved' ? <Pill tone="green" text="Approved" /> : r.kind === 'imported' ? <Pill tone="gray" text="Imported" /> : <Pill tone="amber" text="In progress" />}</span>
            <span className="text-[13px] text-[#5b6b82]">{r.line}</span>
          </div>
          <span className="flex gap-2">
            {r.page && <Link href={r.page} className={BTN.smallWhite}><Ico d={EYE} />Open</Link>}
            {r.pdf
              ? <button type="button" className={BTN.smallWhite} onClick={() => open(r)}><Ico d={DOC} />{r.kind === 'imported' ? 'Open the PDF' : 'PDF'}</button>
              : <Link href={r.href} className={BTN.smallWhite}><Ico d={EYE} />Open</Link>}
          </span>
        </div>
      ))}
      {!rows.length && <p className="m-0 px-5 py-3.5 border-t border-[#f1f3f6] text-[13px] text-[#8593a4]">No reviews yet.</p>}
      <PdfPreview request={pdf} onClose={() => setPdf(null)} />
    </div>
  )
}

// ── Goals ──────────────────────────────────────────────────────────────────

/** One goal during the year (design handoff G3): where it is, the last update, the manager's comments. */
function GoalCard({ g, onUpdate, comment }: { g: GoalItem; onUpdate?: () => void; comment?: React.ReactNode }) {
  const s = statusOf(g.status)
  return (
    <div className={`${CARD} px-5 py-[18px] flex flex-col gap-2.5`}>
      <div className="flex items-start gap-3">
        <span className="flex-none w-7 h-7 rounded-full bg-[#012358] text-[#F2C40A] font-(family-name:--font-display) font-black text-[13px] flex items-center justify-center">{g.n}</span>
        <div className="flex-1 min-w-0 flex flex-col gap-[3px]">
          <span className="text-[15px] font-extrabold text-tn-ink">{g.what}</span>
          {g.how && <span className="text-[13px] text-[#5b6b82]">Measured by: {g.how}</span>}
        </div>
        <Pill tone={s.tone} text={s.label} />
      </div>
      <div className="flex flex-wrap gap-1.5 items-center pl-10">
        <span className="text-[12px] font-semibold text-[#435066] bg-[#f4f2ec] rounded-full px-2.5 py-[3px] whitespace-nowrap">By {g.by}{g.term ? ` · ${g.term}` : ''}</span>
        {g.serves && <span className="text-[12px] font-semibold text-[#1E7D7F] bg-[#eaf4f4] rounded-full px-2.5 py-[3px]">Serves: {g.serves}</span>}
        {g.dueNote && <span className="text-[12px] font-bold text-[#9a5a00] bg-[#fdf1e0] rounded-full px-2.5 py-[3px]">{g.dueNote}</span>}
      </div>
      <div className="ml-10 rounded-[10px] bg-[#f8f7f3] px-3.5 py-2.5 flex flex-col gap-1">
        <span className="text-[12px] font-bold text-[#8593a4]">{g.lastUpdate ? `Updated ${fmtInstantDay(g.lastUpdate.at, true).replace(/^\w+, /, '')}` : 'No update yet'}</span>
        {g.lastUpdate && <span className="text-[13.5px] leading-[1.5] text-[#435066]">{g.lastUpdate.body}</span>}
      </div>
      {g.comments.map((c, i) => (
        <div key={i} className="ml-10 flex gap-2.5 items-start">
          <span className="w-[26px] h-[26px] rounded-full bg-[#eef1f5] border border-[#dfe4ea] flex items-center justify-center font-(family-name:--font-display) font-extrabold text-[9.5px] text-[#435066] flex-none">{initials(c.who)}</span>
          <span className="flex flex-col gap-0.5"><span className="text-[12px] font-bold text-tn-ink">{c.who}{c.checkin ? ' · check-in' : ''}</span><span className="text-[13.5px] leading-[1.5] text-[#435066]">{c.body}</span></span>
        </div>
      ))}
      {comment && <div className="ml-10">{comment}</div>}
      {onUpdate && <div className="flex justify-end"><button type="button" className={BTN.smallWhite} onClick={onUpdate}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" /></svg>Update</button></div>}
    </div>
  )
}

/**
 * The goals on the person's page in the Directory, HR tab (owner, 4 November
 * 2026): read only, from the latest approved review, so a newly approved
 * review's goals take the place of the last ones by themselves.
 */
export function PersonGoals({ v, href }: { v: GoalsView; href: string | null }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3 flex-wrap px-1">
        <div className="flex flex-col gap-[3px]">
          <h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink">Goals for {v.year}</h2>
          <span className="text-[13px] text-[#5b6b82]">From the {v.reviewYear} review · {v.summary || 'No goals'}{v.checkin.finished ? ` · 6-month check-in done on ${fmtInstantDay(v.checkin.finished)}` : v.checkinsBy ? ` · 6-month check-in by ${fmtDay(v.checkinsBy)}` : ''}</span>
        </div>
        {href && <Link href={href} className="font-(family-name:--font-display) font-extrabold text-[12.5px] text-[#1E7D7F] hover:text-tn-ink">Open the goals</Link>}
      </div>
      {v.goals.map(g => <GoalCard key={g.id} g={g} />)}
    </section>
  )
}

/** The 6-month check-in, at the top of the goals (design handoff G3, G6): navy, with the calendar. */
export function CheckinBanner({ title, sub, children }: { title: string; sub: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center flex-wrap gap-3.5 px-5 py-4 rounded-[14px] bg-[#012358] text-[#ffffff]">
      <span className="w-10 h-10 rounded-[10px] bg-white/[.12] text-[#F2C40A] flex items-center justify-center flex-none"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5h16v16H4zM4 10h16M9 3v4M15 3v4" /></svg></span>
      <div className="flex-[1_1_260px] flex flex-col gap-0.5"><span className="font-(family-name:--font-display) font-extrabold text-[15px]">{title}</span><span className="text-[13px] text-white/[.78]">{sub}</span></div>
      {children}
    </div>
  )
}

export function MyGoals({ v, api }: { v: GoalsView; api: { updateGoal(i: { goalId: number; status: GoalStatus; body: string }): Promise<Res> } }) {
  const router = useRouter()
  const [editing, setEditing] = useState<GoalItem | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  return (
    <div className="flex flex-col gap-4">
      <CheckinBanner title={`6-month check-in with ${v.manager.name || 'your manager'}`} sub={v.checkin.finished ? `Done on ${fmtInstantDay(v.checkin.finished)}.` : v.checkin.at ? `Booked for ${fmtWhen(v.checkin.at)}. You go through every goal together.` : `${v.checkinsBy ? `By ${fmtDay(v.checkinsBy, true)} · ` : ''}${v.manager.name.split(' ')[0] || 'Your manager'} books it in the Agenda. You go through every goal together.`} />
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
    <Modal label="Update your goal" width={560} gap={16} onClose={onClose}><div className="contents" style={APR_COLORS}>
      <div className="flex items-start gap-3">
        <div className="flex-1 flex flex-col gap-[3px]"><h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[18px] text-tn-ink">Update your goal</h2><span className="text-[13.5px] text-[#5b6b82]">{g.what} · by {g.by}</span></div>
        <CloseButton onClick={onClose} />
      </div>
      <div className="flex flex-col gap-2"><span className={FIELD_LABEL}>Where it is</span>
        <Segmented label="Where it is" value={status} options={GOAL_STATUS.map(s => ({ key: s.key, label: s.label }))} onChange={setStatus} /></div>
      <label className="flex flex-col gap-2"><span className={FIELD_LABEL}>What changed</span>
        <textarea value={body} onChange={e => setBody(e.target.value)} rows={3} autoFocus placeholder="What changed, in a sentence" className={`${TEXTAREA} w-full min-h-[84px] text-[13.5px] leading-[1.55]`} /></label>
      <p className="m-0 text-[12.5px] text-[#8593a4]">{manager || 'Your manager'} sees the update in the team&apos;s goals and can comment.</p>
      <div className="flex justify-end gap-2">
        <button type="button" className={BTN.white} onClick={onClose}>Cancel</button>
        <button type="button" disabled={busy} className={`${BTN.navy} disabled:opacity-50`} onClick={async () => { setBusy(true); try { await onSave(status, body) } finally { setBusy(false) } }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>Save the update</button>
      </div>
    </div></Modal>
  )
}

// ── My team's goals ────────────────────────────────────────────────────────

const TEAM_COLS = 'grid grid-cols-[minmax(0,1.6fr)_70px_minmax(0,1.8fr)_minmax(0,1.2fr)_120px_90px] gap-3.5 items-center px-[18px]'

/** The goals of the people who report to the viewer (design handoff G5). */
export function TeamGoals({ rows }: { rows: TeamGoalRow[] }) {
  return (
    <div className={`${CARD} overflow-x-auto [scrollbar-width:none]`}>
      <div className="min-w-[900px]" role="table" aria-label="My team's goals">
        <div role="row" className={`${TEAM_COLS} py-2.5 bg-[#f4f2ec] border-b border-[#e4e7ec] font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-[#8593a4]`}>
          <span role="columnheader">Person</span><span role="columnheader">Goals</span><span role="columnheader">Where they are</span><span role="columnheader">6-month check-in</span><span role="columnheader">Last update</span><span role="columnheader" />
        </div>
        {rows.map((r, i) => (
          <div key={r.personId} role="row" className={`${TEAM_COLS} py-3 ${i ? 'border-t border-[#f1f3f6]' : ''}`}>
            <span role="cell" className="flex items-center gap-2.5 min-w-0">
              <span className="w-8 h-8 rounded-full bg-[#eef1f5] border border-[#dfe4ea] flex items-center justify-center font-(family-name:--font-display) font-extrabold text-[11px] text-[#435066] flex-none">{initials(r.name)}</span>
              <span className="flex flex-col min-w-0"><span className="text-[13.5px] font-bold text-tn-ink truncate">{r.name}</span>{r.title && <span className="text-[12px] text-[#8593a4] truncate">{r.title}</span>}</span>
            </span>
            <span role="cell" className="text-[13.5px] font-bold text-tn-ink">{r.goals}</span>
            <span role="cell" className="text-[13px] text-[#435066]">{r.summary}</span>
            <span role="cell" className="flex"><Pill tone={r.checkin.state === 'done' ? 'green' : r.checkin.state === 'booked' ? 'blue' : 'amber'} text={r.checkin.label} /></span>
            <span role="cell" className="text-[12.5px] text-[#8593a4]">{r.lastUpdate ? fmtInstantDay(r.lastUpdate, true).replace(/^\w+, /, '') : 'No update yet'}</span>
            <span role="cell" className="text-right"><Link href={`/human-resources/team-goals/${r.personId}${r.checkin.state === 'book' ? '?book=1' : ''}`} className="font-(family-name:--font-display) font-extrabold text-[12.5px] text-[#1E7D7F] hover:text-tn-ink">{r.checkin.state === 'book' ? 'Book' : 'Open'}</Link></span>
          </div>
        ))}
        {!rows.length && <p className="m-0 px-[18px] py-6 text-[13px] text-[#8593a4]">No agreed goals yet for the people who report to you.</p>}
      </div>
    </div>
  )
}

// ── The 6-month check-in ───────────────────────────────────────────────────

export function Checkin({ v, name, booking, drawerApi, today, api, bookNow }: {
  v: GoalsView; name: string; booking: Booking | null; drawerApi: DrawerApi | null; today: string
  /** Came from Book on My team's goals: the drawer opens at once (design handoff G5). */
  bookNow?: boolean
  api: {
    commentGoal(i: { goalId: number; body: string; checkin?: boolean }): Promise<Res>
    linkCheckin(i: { personId: string; eventId: string }): Promise<Res>
    finishCheckin(i: { personId: string }): Promise<Res>
  }
}) {
  const router = useRouter()
  const [toast, setToast] = useState<ToastState | null>(null)
  const [drafts, setDrafts] = useState<Record<number, string>>({})
  const [book, setBook] = useState(!!bookNow && !v.checkin.at)
  const [busy, setBusy] = useState(false)
  const first = name.split(' ')[0]
  const say = (t: ToastState) => { setToast(t); setTimeout(() => setToast(null), 5000) }
  const run = async (go: () => Promise<Res>) => {
    setBusy(true)
    try { const r = await go(); if (r.ok) { if (r.toast) say({ text: r.toast }); router.refresh() } else say({ text: r.error, error: true }) } finally { setBusy(false) }
  }
  const writing = Object.values(drafts).filter(x => x.trim()).length
  // A comment is kept when the manager leaves its box, and any still open when they finish (design handoff G6: no Save per goal).
  const keep = async (goalId: number) => {
    const body = (drafts[goalId] ?? '').trim()
    if (!body) return true
    const r = await api.commentGoal({ goalId, body, checkin: true })
    if (r.ok) { setDrafts(d => ({ ...d, [goalId]: '' })); router.refresh() } else say({ text: r.error, error: true })
    return r.ok
  }
  const finish = () => run(async () => {
    for (const id of Object.keys(drafts).map(Number)) if (!(await keep(id))) return { ok: false, error: 'A comment could not be saved. Try again.' } as Res
    return api.finishCheckin({ personId: v.personId })
  })
  const cal = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5h16v16H4zM4 10h16M9 3v4M15 3v4" /></svg>
  return (
    <div className="flex flex-col gap-4">
      <CheckinBanner
        title={v.checkin.finished ? `Finished on ${fmtInstantDay(v.checkin.finished)}` : v.checkin.at ? fmtWhen(v.checkin.at) : 'Not booked yet'}
        sub={v.checkin.at ? `Booked in the Agenda by ${v.manager.name || 'you'}, with ${name}` : `${v.checkinsBy ? `Due by ${fmtDay(v.checkinsBy, true)}. ` : ''}Book it in the Agenda, filled in.`}>
        {v.checkin.at && <Link href={`/agenda?d=${new Date(v.checkin.at).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })}`} className={BTN.smallWhite}>{cal}Open in the Agenda</Link>}
        {!v.checkin.at && (booking && drawerApi ? <button type="button" className={BTN.smallWhite} onClick={() => setBook(true)}>{cal}Book</button> : <span className="text-[12.5px] text-white/[.78]">The new Agenda is not open yet.</span>)}
      </CheckinBanner>
      {v.goals.map(g => (
        <GoalCard key={g.id} g={g} comment={!v.checkin.finished && (
          <label className="flex flex-col gap-1.5"><span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-[#8593a4]">Your comment</span>
            <textarea value={drafts[g.id] ?? ''} onChange={e => setDrafts(d => ({ ...d, [g.id]: e.target.value }))} onBlur={() => { if (!busy) void keep(g.id) }} rows={2} className={`${TEXTAREA} w-full min-h-[56px] text-[13.5px] leading-[1.5]`} placeholder={`What you and ${first} agreed about this goal`} />
          </label>
        )} />
      ))}
      {!v.checkin.finished && (
        <div className="sticky bottom-3 z-[6] rounded-[14px] border border-[#e4e7ec] bg-white px-[22px] py-4 flex flex-wrap items-center gap-3.5 shadow-[0_18px_40px_-18px_rgba(1,35,88,.5)]">
          <div className="flex-1 min-w-[220px] flex flex-col gap-[3px]">
            <span className="text-[14px] font-bold text-tn-ink">{v.goals.length} goal{v.goals.length === 1 ? '' : 's'}{writing ? ` · ${writing} comment${writing === 1 ? '' : 's'} being written` : ''}</span>
            <span className="text-[12.5px] text-[#8593a4]">{first} gets your comments by email and in Needs you when you finish.</span>
          </div>
          <button type="button" disabled={busy} className={`${BTN.navy} disabled:opacity-50`} onClick={finish}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>Finish the check-in</button>
        </div>
      )}
      {book && booking && drawerApi && (
        <EventDrawer setup={booking.setup} preset={booking.preset} note={booking.note} free={booking.free} today={today} api={drawerApi} onClose={() => setBook(false)}
          onDone={async (t, id) => { setBook(false); if (id) await run(() => api.linkCheckin({ personId: v.personId, eventId: String(id) })); else say({ text: t }) }} />
      )}
      <Toast toast={toast} />
    </div>
  )
}
