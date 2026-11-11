'use client'

/**
 * One annual review (design handoff, 3 November 2026, C3 to E5), for whoever
 * opens it: the person writes their self-review (step 1); the one they report
 * to reviews (2), books the meeting and writes the notes (3), then approves
 * (4); everyone else who may see it reads.
 *
 * The header and the four steps on top, "In this review" on the left (sticky,
 * follows the scroll, hidden below 960px), the sections in the middle, last
 * year's file beside the form at 1360px and wider (a drawer when narrower),
 * and the action bar stuck to the bottom.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BTN, BTN_ICON } from '@/lib/ui/buttons'
import { CARD, FIELD_LABEL } from '@/lib/ui/type'
import { TEXTAREA, INPUT } from '@/lib/ui/fields'
import { Pill } from '@/components/ui/Pill'
import { StatusIcon } from '@/components/ui/StatusIcon'
import { PdfPreview, type PdfRequest } from '@/components/ui/PdfPreview'
import { PdfPages } from '@/components/ui/PdfPages'
import { Modal, Toast, type ToastState } from '@/components/clocky/entries/ui'
import { EventDrawer, type DrawerApi } from '@/components/agenda/EventDrawer'
import type { StatusState } from '@/lib/ui/status-icons'
import type { Booking } from '@/lib/review/booking'
import type { ReviewView } from '@/lib/review/view'
import { STEP_LABEL, dueWords, type GoalResult } from '@/lib/review/rules'
import { fmtDay, fmtInstantDay, fmtInstantShort, fmtShort, fmtTime, fmtWhen, hireLabel, initials } from '@/lib/review/format'
import { Count, GoalList, PastGoal, PriorityBlock, QuestionField, Section, useAutosave, type GoalApi } from './parts'
import { APR_COLORS } from '@/lib/review/colors'

type Res = { ok: true; savedAt?: string; toast?: string; id?: number } | { ok: false; error: string }
type PartNo = 0 | 1
export interface ReviewApi extends GoalApi {
  saveAnswer(i: { reviewId: number; key: string; body: string; part?: PartNo }): Promise<Res>
  copyJobDescription(i: { reviewId: number }): Promise<Res>
  undoCopyJob(i: { reviewId: number }): Promise<Res>
  addGoal(i: { reviewId: number; past?: boolean; part?: PartNo }): Promise<Res>
  markGoal(i: { goalId: number; result?: GoalResult | null; comment?: string }): Promise<Res>
  submitSelf(i: { reviewId: number }): Promise<Res>
  sendBack(i: { reviewId: number; reason: string; part?: PartNo }): Promise<Res>
  finishReview(i: { reviewId: number; part?: PartNo }): Promise<Res>
  linkMeeting(i: { reviewId: number; eventId: string; part?: PartNo }): Promise<Res>
  saveMeetingNotes(i: { reviewId: number; notes: string; part?: PartNo }): Promise<Res>
  agreeReview(i: { reviewId: number; part?: PartNo }): Promise<Res>
  approveReview(i: { reviewId: number; part?: PartNo }): Promise<Res>
  retryReviewDrive(i: { reviewId: number }): Promise<Res>
  markApprovedSeen(i: { reviewId: number }): Promise<Res>
  savePriority(i: { cycleId: number; id?: number | null; teamId?: string | null; title?: string; body?: string }): Promise<Res>
  removePriority(i: { id: number }): Promise<Res>
}

const STEP_ORDER = ['self', 'review', 'meeting', 'approval'] as const
type PV = ReviewView['parts'][number]
const partAfter = (p: PV) => p.step === 'meeting' || p.step === 'approval' || p.step === 'approved'
const RANK: Record<PV['step'], number> = { waiting: 0, review: 1, meeting: 2, approval: 3, approved: 4 }

export function ReviewPage({ v, api, booking, drawerApi, today, showApproved = false }: { v: ReviewView; api: ReviewApi; booking: Booking | null; drawerApi: DrawerApi | null; today: string
  /** Opened from Home's "Your review is approved": the window that says what comes next (owner, 10 November 2026). */
  showApproved?: boolean }) {
  const router = useRouter()
  const [toast, setToast] = useState<ToastState | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [panel, setPanel] = useState(false)
  const [backOpen, setBackOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [approving, setApproving] = useState(false)
  const [booking2, setBooking2] = useState(false)
  const [pdf, setPdf] = useState<PdfRequest | null>(null)
  const [editingGoal, setEditingGoal] = useState<number | null>(null)
  const [openSec, setOpenSec] = useState<Record<string, boolean>>({})
  const [approvedOpen, setApprovedOpen] = useState(showApproved && v.role === 'person' && v.step === 'approved' && !v.approvedSeen)
  const say = (text: string, error = false) => { setToast({ text, error }); setTimeout(() => setToast(null), 5000) }
  const onSaved = (at: string) => setSavedAt(at || new Date().toISOString())
  const onError = (e: string) => say(e, true)
  const run = async (go: () => Promise<Res>, after?: (r: Res) => void) => {
    setBusy(true)
    try {
      const r = await go()
      if (r.ok) { if (r.toast) say(r.toast); after?.(r); router.refresh() } else say(r.error, true)
    } catch { say('That did not go through. Try again in a moment.', true) } finally { setBusy(false) }
  }

  const isPerson = v.role === 'person', isReviewer = v.role === 'reviewer'
  // Each reviewer works in their own part; the person sees every part (two reviewers, owner, 10 November 2026).
  const mp = v.parts.find(p => p.mine) ?? null
  const two = v.parts.length > 1
  const focus = mp ?? v.parts[0]
  const writesSelf = isPerson && v.step === 'self'
  const writesReview = isReviewer && mp?.step === 'review'
  const writesGoals = writesSelf || (isReviewer && (mp?.step === 'review' || mp?.step === 'meeting'))
  const first = v.person.name.split(' ')[0]
  const rFirst = focus.reviewer.name.split(' ')[0]
  const reviewerNames = v.parts.map(p => p.reviewer.name).join(' and ')
  const after = isReviewer ? !!mp && partAfter(mp) : v.step !== 'self' && v.parts.some(partAfter)
  const seesPart = (p: PV) => !isPerson || partAfter(p)
  const own = useMemo(() => v.template.sections.filter(s => s.key !== 'manager'), [v.template])
  const mgr = v.template.sections.find(s => s.key === 'manager')!
  const answered = (keys: string[], src: ReviewView['answers'] = v.answers) => keys.filter(k => (src[k]?.body ?? '').trim()).length
  const ownKeys = own.flatMap(s => s.questions.map(q => q.key))
  const mgrKeys = mgr.questions.map(q => q.key)
  const marked = v.pastGoals.filter(g => g.result).length
  const opened = (k: string, dflt: boolean) => openSec[k] ?? dflt
  const toggle = (k: string, dflt: boolean) => setOpenSec(s => ({ ...s, [k]: !(s[k] ?? dflt) }))
  const youOr = (name: string, id: string | null) => (id && ((isPerson && id === v.person.id) || (isReviewer && id === mp?.reviewer.id)) ? 'You' : name)
  const ownerLabel = (p: PV) => `${p.reviewer.name}${p.area ? ` · ${p.area}` : ''}`
  const owners = two ? v.parts.map(p => ({ no: p.no, label: ownerLabel(p) })) : undefined

  // ── The sections, in the order the step shows them ──
  type Nav = { id: string; label: string; state: StatusState; count?: string }
  const nav: Nav[] = []
  const blocks: React.ReactNode[] = []
  const answerApi = (key: string, part: PartNo = 0) => (b: string) => api.saveAnswer({ reviewId: v.id, key, body: b, part })

  const lastYear = v.year - 1
  const importCard = v.lastImport && (
    <section id="last" data-section="last" className={`${CARD} ${panel ? 'border-tn-teal' : ''} scroll-mt-[150px] px-[22px] py-[18px] flex flex-wrap items-center gap-4`} key="last">
      <span className="w-10 h-10 rounded-[10px] bg-subtle flex items-center justify-center text-muted flex-none">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5" /></svg>
      </span>
      <div className="flex-1 min-w-[220px] flex flex-col gap-0.5">
        <span className="font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink">{isPerson ? 'Your' : `${first}'s`} {lastYear} review</span>
        {isPerson && v.step === 'self' && v.pastGoals.every(g => !g.fromLastReview) && <span className="text-[14.5px] text-[#435066]">Your goals for {v.year} were read from it and are under &ldquo;Your {v.year} goals&rdquo;: mark how each one went. Open the file beside the form to check them.</span>}
        <span className="text-[13px] text-muted">{v.lastImport.file_name} · imported from Google Drive{v.lastImport.imported_at ? ` on ${fmtInstantShort(v.lastImport.imported_at)}` : ''}</span>
      </div>
      <button type="button" className={BTN.white} onClick={() => setPanel(p => !p)}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={panel ? 'M6 6l12 12M18 6 6 18' : 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5'} /></svg>{panel ? `Close the ${lastYear} review` : `Open the ${lastYear} review`}
      </button>
    </section>
  )

  const pastSection = (v.pastGoals.length > 0 || writesSelf) && (
    <Section key="past" id="past" title={isPerson ? `Your ${v.year} goals: how they went` : `${first}'s ${v.year} goals: how they went`}
      sub={isPerson && v.step === 'self'
        ? (v.pastGoals.some(g => g.fromLastReview) ? `The goals you agreed for ${v.year} in your ${lastYear} review. Mark how each one went and say why in a sentence.` : `The goals set for ${v.year}, from your ${lastYear} review. Mark how each one went and say why in a sentence.`)
        : `How ${isPerson ? 'you' : first} marked the ${v.year} goals. Talk them through at the meeting.`}
      right={<span className="font-(family-name:--font-display) font-extrabold text-[12.5px] text-muted">{v.pastGoals.length ? `${marked} of ${v.pastGoals.length} marked` : 'None'}</span>}>
      <div className="flex flex-col">
        {v.pastGoals.map(g => <PastGoal key={g.id} g={g} year={v.year} editable={writesSelf} api={api} onSaved={onSaved} onError={onError} />)}
        {!v.pastGoals.length && <p className="m-0 mt-1 rounded-[12px] border-[1.5px] border-dashed border-[#d9dee6] p-[18px] text-center text-[13.5px] text-[#8593a4]">No {v.year} goals in the portal. Say how the year went in Self-Evaluation, Accomplishments.</p>}
      </div>
    </Section>
  )
  const pastNav: Nav = { id: 'past', label: `${v.year} goals`, state: !writesSelf ? 'info' : !v.pastGoals.length ? 'todo' : marked === v.pastGoals.length ? 'done' : 'progress', count: v.pastGoals.length ? `${marked}/${v.pastGoals.length}` : '0' }
  const qNav = (key: string): Nav => {
    const s = own.find(x => x.key === key)!
    const keys = s.questions.map(q => q.key)
    const done = answered(keys)
    return { id: key, label: s.title, state: !writesSelf ? 'info' : done === keys.length ? 'done' : done ? 'progress' : 'todo', count: writesSelf ? `${done}/${keys.length}` : undefined }
  }

  const questionSection = (key: string) => {
    const s = own.find(x => x.key === key)!
    const keys = s.questions.map(q => q.key)
    const done = answered(keys)
    const dflt = writesSelf || (!after && !isPerson && key === 'job')
    const copyable = key === 'job' && writesSelf && v.canCopyJob
    const anyCopied = keys.some(k => v.answers[k]?.copied)
    const empty = done === 0
    return (
      <Section key={key} id={key} title={s.title} open={opened(key, dflt)} onToggle={() => toggle(key, dflt)}
        sub={!writesSelf && v.dates.selfSent ? `${youOr(v.person.name, v.person.id)} · sent ${fmtInstantShort(v.dates.selfSent)}` : undefined}
        right={<>
          {copyable && empty && <button type="button" className={BTN.smallWhite} disabled={busy} onClick={() => run(() => api.copyJobDescription({ reviewId: v.id }))}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 9h11v11H9zM5 15H4V4h11v1" /></svg>Copy from your {lastYear} review</button>}
          {copyable && anyCopied && <button type="button" className={BTN.link} onClick={() => run(() => api.undoCopyJob({ reviewId: v.id }))}>Undo</button>}
          {writesSelf && <Count done={done} total={keys.length} />}
        </>}>
        {opened(key, dflt) && (
          <div className="flex flex-col gap-4">
            {s.questions.map(q => (
              <QuestionField key={`${q.key}:${v.answers[q.key]?.copied ? 'c' : 'o'}`} label={q.label} hint={q.hint} initial={v.answers[q.key]?.body ?? ''}
                editable={writesSelf} copied={v.answers[q.key]?.copied} save={answerApi(q.key)} onSaved={onSaved} onError={onError} />
            ))}
          </div>
        )}
        {!opened(key, dflt) && <p className="m-0 text-[13px] text-muted">{keys.length} answers: {s.questions.map(q => q.label.toLowerCase()).join(', ')}.</p>}
      </Section>
    )
  }

  const prioritiesSection = (
    <PriorityBlock key="pri" id="pri" label={`Priorities for ${v.year + 1}`} items={v.priorities} showGoals open={opened('pri', true)} onToggle={() => toggle('pri', true)} />
  )

  const teamSections = isPerson ? v.teamBlocks.map(t => <TeamPriorities key={t.teamId} t={t} cycleId={v.cycle.id} year={v.year} editable={writesSelf} api={api} busy={busy} run={run} onSaved={onSaved} onError={onError} />) : []

  const goalsTitle = isPerson ? `Your goals for ${v.year + 1}` : `${first}'s goals for ${v.year + 1}`
  const proposed = v.goals.filter(g => !g.addedByReviewer).length
  const closedGoals = writesSelf && !v.goalsOpen
  const goalsSection = (
    <Section key="goals" id="goals" title={after ? `Agreed goals for ${v.year + 1}` : goalsTitle}
      sub={after ? `${proposed} goal${proposed === 1 ? '' : 's'} from ${first}${v.goals.length - proposed ? ` and ${v.goals.length - proposed} added by ${reviewerNames}` : ''}.${mp?.step === 'meeting' && isReviewer ? ' Change a goal here if the meeting changes it.' : ''}`
        : writesReview ? `${first} proposed ${proposed}. Change or add what you need${two ? ' for your part' : ''}; every change is marked for ${first}.` : `One item each: what, how it is measured, by when (month and year), the term, and which of the priorities above it serves${two ? ', and which of your two reviewers it is for' : ''}.`}
      right={<span className="font-(family-name:--font-display) font-extrabold text-[12.5px] text-muted">{v.goals.length} {v.goals.length === 1 ? 'goal' : 'goals'}</span>}>
      {closedGoals && (
        <div className="flex items-start gap-2.5 rounded-[10px] bg-subtle px-3.5 py-[11px] text-[13px] leading-[1.55] text-tn-ink">
          <StatusIcon state="locked" />
          <span>Your goals for {v.year + 1} open when the Company Priorities and the VP of Operations&apos; priorities are ready{v.cycle.vp_due ? `, by ${fmtDay(v.cycle.vp_due)} at the latest` : ''}. Meanwhile, the look back at {v.year} above is yours to write.</span>
        </div>
      )}
      {(writesSelf || writesReview) && !closedGoals && (
        <div className="flex items-start gap-2.5 rounded-[10px] bg-[#e8effa] px-3.5 py-[11px] text-[13px] leading-[1.55] text-[#1e3a8a]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 flex-none"><path d="M4 22V4M4 4h13l-2 4 2 4H4" /></svg>
          <div className="flex flex-col gap-1">
            <span>{writesSelf ? 'Your goals should be aligned with the priorities above and based on them as much as possible.' : `${first}'s goals should be aligned with the priorities above and based on them as much as possible. Where one is not, change it or add one that is.`}</span>
            {writesSelf && v.teamBlocks.length > 0 && <span>The people who report to you follow the same pattern: each of their goals is based on the Company Priorities and on {v.teamBlocks.length === 1 ? `${teamOf(v.teamBlocks[0].teamName)}'s` : 'their team\'s'}.</span>}
            {writesSelf && two && <span>You have two reviewers: for each goal, say which of them it is for. Each one talks through their own goals with you.</span>}
          </div>
        </div>
      )}
      <GoalList goals={v.goals} priorities={v.priorities} api={api} editable={writesGoals && !closedGoals} mode={writesSelf ? 'person' : writesGoals ? 'reviewer' : 'read'} who={v.person.name}
        onSaved={onSaved} onError={onError} onChanged={() => router.refresh()} editingId={editingGoal} setEditingId={setEditingGoal} owners={owners} myPart={mp?.no ?? null} />
      {writesGoals && !closedGoals && <div><button type="button" disabled={busy} className={BTN.smallWhite} onClick={() => run(() => api.addGoal({ reviewId: v.id, part: mp?.no }), r => { if (r.ok && r.id && !writesSelf) setEditingGoal(r.id) })}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>Add a goal</button></div>}
    </Section>
  )
  const priNav: Nav = { id: 'pri', label: 'Priorities', state: 'info', count: String(v.priorities.length) }
  const teamNavs: Nav[] = writesSelf ? v.teamBlocks.map(t => ({ id: `team-${t.teamId}`, label: v.teamBlocks.length > 1 ? `Team priorities · ${t.teamName}` : 'Team priorities', state: t.priorities.some(p => p.title.trim()) ? 'done' : 'todo', count: String(t.priorities.length) })) : []

  // ── Each reviewer's feedback: one block per part ──
  const mgrTitle = (p: PV) => (two ? `Review by ${p.reviewer.name}` : "Manager's Feedback")
  const managerSection = (p: PV) => {
    const id = two ? `mgr-${p.no}` : 'mgr'
    const editing = writesReview && p.mine
    const done = answered(mgrKeys, p.answers)
    const dflt = editing || (isPerson && partAfter(p))
    if (!seesPart(p)) return (
      <section key={id} id={id} data-section={id} className="scroll-mt-[150px] rounded-[14px] border-[1.5px] border-dashed border-[#d9dee6] px-5 py-4 flex items-center gap-3.5">
        <span className="w-[34px] h-[34px] rounded-[9px] bg-[#f1f3f6] text-[#8593a4] flex items-center justify-center flex-none"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4" /></svg></span>
        <div className="flex flex-col gap-0.5"><h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">{mgrTitle(p)}</h2><span className="text-[13px] text-[#8593a4]">{p.reviewer.name} writes this part after your self-review{two && p.area ? `, for ${p.area}` : ''}. You read it at the meeting step.</span></div>
      </section>
    )
    return (
      <Section key={id} id={id} title={mgrTitle(p)}
        sub={editing ? `Your part${two && p.area ? `, for ${p.area}` : ''}. ${first} reads it at the meeting step.` : [two && p.area ? p.area : '', p.dates.reviewSent ? `${youOr(p.reviewer.name, p.reviewer.id)} · sent ${fmtInstantShort(p.dates.reviewSent)}` : ''].filter(Boolean).join(' · ') || undefined}
        open={opened(id, dflt)} onToggle={() => toggle(id, dflt)}
        right={editing ? <Count done={done} total={mgrKeys.length} /> : undefined}>
        {opened(id, dflt) && (
          <div className="flex flex-col gap-4">
            {mgr.questions.map(q => <QuestionField key={q.key} label={q.label} hint={q.hint} initial={p.answers[q.key]?.body ?? ''} editable={editing} save={answerApi(q.key, p.no)} onSaved={onSaved} onError={onError} />)}
          </div>
        )}
        {!opened(id, dflt) && <p className="m-0 text-[13px] text-muted">{mgrKeys.length} answers: {mgr.questions.map(q => q.label.toLowerCase()).join(', ')}.</p>}
      </Section>
    )
  }
  const mgrNav = (p: PV): Nav => {
    const done = answered(mgrKeys, p.answers)
    const editing = writesReview && p.mine
    return { id: two ? `mgr-${p.no}` : 'mgr', label: two ? `Review by ${p.reviewer.name.split(' ')[0]}` : "Manager's Feedback", state: !seesPart(p) ? 'locked' : editing ? (done === mgrKeys.length ? 'done' : 'progress') : 'info', count: editing ? `${done}/${mgrKeys.length}` : undefined }
  }
  // The reviewer's own part first.
  const mgrParts = mp ? [mp, ...v.parts.filter(p => p !== mp)] : v.parts

  // ── The meetings, the notes, approval and the PDF (steps 3 and 4) ──
  // One meeting for both reviewers shows once.
  const meetParts = v.parts.filter(partAfter).filter((p, i, all) => !p.meeting.eventId || all.findIndex(x => x.meeting.eventId === p.meeting.eventId) === i)
  const meetingSection = (p: PV) => {
    const id = two ? `meet-${p.no}` : 'meet'
    const joint = two && !!p.meeting.eventId && v.parts.every(x => x.meeting.eventId === p.meeting.eventId)
    const who = joint ? reviewerNames : p.reviewer.name
    const mineHere = !!mp && (mp === p || (joint && mp.meeting.eventId === p.meeting.eventId))
    return (
      <Section key={id} id={id} title={<span className="inline-flex items-center gap-2.5">{two && !joint ? `The meeting with ${p.reviewer.name}` : 'The meeting'}{p.meeting.held ? <Pill tone="green" text="Held" /> : p.meeting.startsAt ? <Pill tone="blue" text="Booked" /> : null}</span>}>
        {p.meeting.startsAt ? (
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex-none w-14 rounded-[10px] bg-subtle text-center py-1.5 font-(family-name:--font-display) font-extrabold text-tn-ink leading-tight">
              <span className="block text-[10px] tracking-[.08em] uppercase text-[#c8323d]">{new Date(p.meeting.startsAt).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/New_York' })}</span>
              <span className="block text-[20px]">{new Date(p.meeting.startsAt).toLocaleDateString('en-US', { day: 'numeric', timeZone: 'America/New_York' })}</span>
              <span className="block text-[10px] tracking-[.08em] uppercase text-muted">{new Date(p.meeting.startsAt).toLocaleDateString('en-US', { month: 'short', timeZone: 'America/New_York' })}</span>
            </span>
            <div className="flex-1 min-w-[200px] text-[13.5px] text-[#435066]">
              <span className="block font-(family-name:--font-display) font-extrabold text-[14.5px] text-tn-ink">{timeRange(p.meeting.startsAt, p.meeting.endsAt)}{p.meeting.how === 'online' ? ', Google Meet' : p.meeting.how === 'in_person' && p.meeting.place ? `, ${p.meeting.place}` : ''}</span>
              {who} and {v.person.name}. On the Agenda and on the Google Calendars.
            </div>
            {mineHere && mp!.step === 'meeting' && booking && !p.meeting.held && <button type="button" className={BTN.smallWhite} onClick={() => setBooking2(true)}>Book another time</button>}
          </div>
        ) : p.mine && p.step === 'meeting' ? (
          <div className="flex items-center gap-4 flex-wrap">
            <p className="m-0 flex-1 min-w-[220px] text-[13.5px] text-[#435066]">Meet with {first}{p.due ? ` before ${fmtDay(p.due)}` : ''} to agree the goals.{two ? ` Invite ${v.parts.find(x => x !== p)?.reviewer.name} too to make it one meeting for both reviews.` : ''} The booking shows the times you are free and puts it on the Google Calendars.</p>
            {booking && drawerApi
              ? <button type="button" className={BTN.navy} onClick={() => setBooking2(true)}>Book the meeting</button>
              : <span className="text-[12.5px] text-muted">The new Agenda is not open yet, so the meeting cannot be booked from here.</span>}
          </div>
        ) : <p className="m-0 text-[13.5px] text-muted">{p.reviewer.name} books it.</p>}
      </Section>
    )
  }
  const notesSection = (p: PV) => <MeetingNotes key={`notes-${p.no}`} v={v} p={p} two={two} editable={p.mine && p.step === 'meeting'} api={api} onSaved={onSaved} onError={onError} />

  // ── Order ──
  const goalsNav: Nav = { id: 'goals', label: after ? `Agreed goals for ${v.year + 1}` : goalsTitle, state: after ? 'info' : v.goals.length ? (writesGoals ? 'progress' : 'done') : 'todo', count: String(v.goals.length) }
  if (!after) {
    if (importCard) { blocks.push(importCard); nav.push({ id: 'last', label: `${lastYear} review`, state: 'info' }) }
    if (pastSection) { blocks.push(pastSection); nav.push(pastNav) }
    blocks.push(...teamSections, questionSection('job'), questionSection('self'), prioritiesSection, goalsSection, questionSection('feedback'), ...mgrParts.map(managerSection))
    nav.push(...teamNavs, qNav('job'), qNav('self'), priNav, goalsNav, qNav('feedback'), ...mgrParts.map(mgrNav))
  } else {
    if (mp?.step === 'approval') {
      nav.push({ id: 'approve', label: 'Approval', state: 'turn' })
      blocks.push(<ApprovalBox key="approve" v={v} p={mp} two={two} busy={busy} onBack={() => setBackOpen(true)} onApprove={() => setApproving(true)} />)
    }
    if (v.step === 'approved') {
      nav.push({ id: 'pdf', label: 'The PDF', state: 'done' })
      blocks.push(<PdfBox key="pdf" v={v} busy={busy} onOpen={() => setPdf({ url: `/human-resources/reviews/${v.id}/pdf`, title: `${v.year} review, ${v.person.name}`, fallbackName: v.pdf.name ?? 'review.pdf', sheets: true })} onRetry={() => run(() => api.retryReviewDrive({ reviewId: v.id }))} />)
    }
    const shownParts = isReviewer && mp ? [mp] : meetParts
    for (const p of shownParts.filter(partAfter)) {
      blocks.push(meetingSection(p), notesSection(p))
      nav.push({ id: two ? `meet-${p.no}` : 'meet', label: two ? `Meeting · ${p.reviewer.name.split(' ')[0]}` : 'The meeting', state: p.meeting.held ? 'done' : p.meeting.startsAt ? 'progress' : p.mine ? 'turn' : 'todo' },
        { id: two ? `notes-${p.no}` : 'notes', label: 'Meeting notes', state: p.mine && p.step === 'meeting' ? (p.meeting.notes ? 'done' : 'todo') : 'info' })
    }
    blocks.push(goalsSection)
    nav.push(goalsNav)
    if (isPerson) { blocks.push(...mgrParts.map(managerSection)); nav.push(...mgrParts.map(mgrNav)) }
    if (pastSection) { blocks.push(pastSection); nav.push(pastNav) }
    blocks.push(questionSection('job'), questionSection('self'), questionSection('feedback'))
    nav.push(qNav('job'), qNav('self'), qNav('feedback'))
    if (!isPerson) { blocks.push(...mgrParts.map(managerSection)); nav.push(...mgrParts.map(mgrNav)) }
  }

  // ── Step strip: a step is done when every part is past it ──
  const low = Math.min(...v.parts.map(p => RANK[p.step]))
  const high = Math.max(...v.parts.map(p => RANK[p.step]))
  const stepState = (s: (typeof STEP_ORDER)[number]) => {
    if (s === 'self') return v.step === 'self' || v.step === 'waiting' ? 'now' : 'done'
    if (v.step === 'self' || v.step === 'waiting') return 'next'
    const r = s === 'review' ? 1 : s === 'meeting' ? 2 : 3
    return low > r ? 'done' : high >= r ? 'now' : 'next'
  }
  const fp = focus
  const stepLine = (s: (typeof STEP_ORDER)[number]) => {
    const st = stepState(s)
    if (s === 'self') return st === 'done' ? `Sent ${fmtInstantShort(v.dates.selfSent)}` : `Due ${fmtDay(v.cycle.self_due)}${st === 'now' && v.due ? ` · ${dueWords(v.due, today)}` : ''}`
    if (s === 'review') return st === 'done' ? `Sent ${fmtInstantShort(fp.dates.reviewSent)}` : st === 'now' ? `Due ${fmtDay(v.cycle.review_due)}${fp.due && fp.step === 'review' ? ` · ${dueWords(fp.due, today)}` : ''}` : `By ${fmtShort(v.cycle.review_due)}`
    const meetDue = fp.lane === 1 ? v.cycle.leaders_meeting_due ?? v.cycle.meeting_due : v.cycle.meeting_due
    const apprDue = fp.lane === 1 ? v.cycle.leaders_approval_due ?? v.cycle.approval_due : v.cycle.approval_due
    if (s === 'meeting') return st === 'done' ? `Agreed ${fmtInstantShort(fp.dates.agreed)}` : st === 'now' ? (fp.meeting.held ? `Held${fp.meeting.endsAt && fmtInstantDay(fp.meeting.endsAt) === fmtInstantDay(new Date().toISOString()) ? ' today' : ''}. Read and agree.` : fp.meeting.startsAt ? `Booked ${fmtInstantShort(fp.meeting.startsAt)}` : `Book by ${fmtDay(meetDue)}`) : `By ${fmtShort(meetDue)}`
    return st === 'done' ? `Approved ${fmtInstantShort(v.dates.approved)}` : st === 'now' ? `Due ${fmtDay(apprDue)}${fp.due && fp.step === 'approval' ? ` · ${dueWords(fp.due, today)}` : ''}` : `By ${fmtShort(apprDue)}`
  }
  const names = isReviewer && mp ? mp.reviewer.name : reviewerNames
  const stepWho = (s: (typeof STEP_ORDER)[number]) => s === 'self' ? v.person.name : s === 'meeting' ? `${isReviewer && mp ? rFirst : v.parts.map(p => p.reviewer.name.split(' ')[0]).join(', ')} and ${first}` : names

  // ── Follow the scroll in "In this review" ──
  const [here, setHere] = useState<string | null>(null)
  const main = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const els = main.current?.querySelectorAll<HTMLElement>('[data-section]')
    if (!els?.length || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(es => {
      const vis = es.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (vis[0]) setHere((vis[0].target as HTMLElement).dataset.section ?? null)
    }, { rootMargin: '-140px 0px -55% 0px' })
    els.forEach(e => io.observe(e))
    return () => io.disconnect()
  })
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  // What the submit window warns about (design handoff, C6): empty questions, and last year's goals not marked yet.
  const emptyQuestions = own.flatMap(s => s.questions).filter(q => !(v.answers[q.key]?.body ?? '').trim()).map(q => q.label)
  const unmarked = v.pastGoals.filter(g => !g.result).length
  const noTeamPriorities = v.teamBlocks.filter(t => !t.priorities.some(p => p.title.trim())).map(t => t.teamName)
  const warning = [
    emptyQuestions.length && `${emptyQuestions.length} ${emptyQuestions.length === 1 ? 'question is' : 'questions are'} empty: ${emptyQuestions.join(', ')}.`,
    unmarked && `${unmarked} of your ${v.year} goals ${unmarked === 1 ? 'is' : 'are'} not marked yet.`,
    !v.goals.length && v.goalsOpen && `You have no goals for ${v.year + 1} yet.`,
  ].filter(Boolean).join(' ')

  // ── The bar at the bottom ──
  const ownDone = answered(ownKeys)
  const toAgree = isPerson ? v.parts.filter(p => p.step === 'meeting' && p.meeting.held) : []
  let bar: { text: string; sub: string; actions: React.ReactNode } | null = null
  if (writesSelf) bar = {
    text: `${ownDone} of ${ownKeys.length} questions answered · ${v.goals.length} ${v.goals.length === 1 ? 'goal' : 'goals'}`,
    sub: noTeamPriorities.length ? `Write ${noTeamPriorities.length === 1 ? `the ${noTeamPriorities[0]}'s` : 'your teams\''} priorities first: your team builds its goals on them.` : `Saved as you type. Submit sends it to ${reviewerNames} and locks your part.`,
    actions: <button type="button" disabled={busy} className={`${BTN.navy} disabled:opacity-50`} onClick={() => setSubmitting(true)}><Send />Submit to {reviewerNames}</button>,
  }
  else if (writesReview && mp) {
    const added = v.goals.filter(g => g.addedByReviewer).length, changed = v.goals.filter(g => !g.addedByReviewer && g.changedByName).length
    const mgrDone = answered(mgrKeys, mp.answers)
    bar = {
      text: `${two ? 'Your review' : "Manager's Feedback"}: ${mgrDone} of ${mgrKeys.length} answered${added || changed ? ` · ${[added && `${added} goal${added === 1 ? '' : 's'} added`, changed && `${changed} changed`].filter(Boolean).join(', ')}` : ''}`,
      sub: `Saved as you type. Next, book the meeting with ${first}.`,
      actions: <>
        <button type="button" disabled={busy} className={BTN.white} onClick={() => setBackOpen(true)}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" /></svg>Send back to {first}</button>
        <button type="button" disabled={busy} className={`${BTN.navy} disabled:opacity-50`} onClick={() => run(() => api.finishReview({ reviewId: v.id, part: mp.no }), r => { if (r.ok) setBooking2(true) })}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5h16v16H4zM4 10h16M9 3v4M15 3v4" /></svg>Save and book the meeting</button>
      </>,
    }
  } else if (isReviewer && mp?.step === 'meeting') bar = {
    text: mp.meeting.startsAt ? (mp.meeting.held ? `Waiting for ${first} to read and agree` : `Meeting booked for ${fmtWhen(mp.meeting.startsAt)}`) : 'Book the meeting',
    sub: `After the meeting, ${first} reads the review and agrees. Then it comes back to you for your final remarks and approval.`,
    actions: <button type="button" disabled={busy} className={BTN.white} onClick={() => setBackOpen(true)}>Send back to the review</button>,
  }
  else if (toAgree.length) bar = {
    text: 'Read and agree',
    sub: `This tells ${toAgree.map(p => p.reviewer.name.split(' ')[0]).join(' and ')} you have read the meeting notes, the goals and the feedback, and that you agree. Then it goes to ${toAgree.map(p => p.reviewer.name).join(' and ')} for approval.`,
    actions: <button type="button" disabled={busy} className={`${BTN.navy} disabled:opacity-50`} onClick={() => run(() => api.agreeReview({ reviewId: v.id }))}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>I have read and agree</button>,
  }

  const savedLabel = savedAt ? `Saved · ${fmtTime(savedAt)}` : null
  const stepPill = toAgree.length ? 'Meeting' : v.step === 'approved' ? STEP_LABEL.approved : v.step === 'self' ? STEP_LABEL.self : isReviewer && mp ? STEP_LABEL[mp.step === 'waiting' ? 'self' : mp.step] : STEP_LABEL[v.step]
  const sentBack = (isReviewer && mp ? mp.sentBack : v.sentBack)

  return (
    <div className="flex flex-col gap-4 pb-28">
      {/* Header */}
      <div className={`${CARD} overflow-hidden`}>
        <div className="bg-tn-primary px-6 md:px-7 pt-6 pb-5 flex flex-col gap-4">
          <div className="flex items-start gap-4 flex-wrap">
            <span className="w-14 h-14 rounded-full bg-[#F2C40A] text-tn-primary flex items-center justify-center font-(family-name:--font-display) font-black text-[18px] flex-none">{initials(v.person.name)}</span>
            <div className="flex-1 min-w-[220px] flex flex-col gap-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="m-0 font-(family-name:--font-display) font-black text-[28px] leading-tight text-[#ffffff]">{v.person.name}</h1>
                <span className="rounded-full bg-[#ffffff] text-tn-primary px-2 py-[2px] font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.08em] uppercase">{stepPill}</span>
              </div>
              <span className="text-[14px] text-[rgba(255,255,255,.78)]">{isPerson ? 'Your' : ''} {v.year} review · {[v.person.title, v.person.teamName].filter(Boolean).join(', ')}</span>
            </div>
            {savedLabel && <span className="text-[12.5px] text-[rgba(255,255,255,.72)] flex items-center gap-1.5"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5fd39b" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>{savedLabel}</span>}
          </div>
          <div className="rounded-[12px] border border-[rgba(255,255,255,.14)] bg-[rgba(255,255,255,.05)] px-4 py-3 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))] items-center">
            {[['Position', v.person.title ?? 'Not set'], ['Team', v.person.teamName ?? 'No team'], [two ? 'Reviewers' : v.person.teamLeaderName ? 'Team Leader' : 'Reviewer', two ? v.parts.map(ownerLabel).join(', ') : v.person.teamLeaderName ?? v.reviewer.name], ['Date of hire', hireLabel(v.person.hireDate, today)]].map(([k, val]) => (
              <div key={k} className="flex flex-col gap-0.5 min-w-0"><span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-[#94C4C5]">{k}</span><span className="text-[14px] font-bold text-[#ffffff] truncate" title={val}>{val}</span></div>
            ))}
            <span className="text-[12px] text-[rgba(255,255,255,.66)] flex items-center gap-1.5"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4" /></svg>From the Directory</span>
          </div>
        </div>
        <ol className="m-0 list-none px-6 md:px-7 py-4 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))] overflow-x-auto">
          {STEP_ORDER.map((s, i) => {
            const st = stepState(s)
            return (
              <li key={s} className="flex flex-col gap-1 min-w-[140px]">
                <div className="flex items-center gap-2">
                  <span className={`w-[26px] h-[26px] rounded-full flex-none flex items-center justify-center border-[1.5px] font-(family-name:--font-display) font-black text-[12px] ${st === 'done' ? 'bg-[#1E9E6A] border-[#1E9E6A]' : st === 'now' ? 'bg-tn-ink border-tn-ink text-[#F2C40A] shadow-[0_0_0_4px_rgba(242,196,10,.28)]' : 'bg-[#ffffff] border-[#cbd2da] text-[#8593a4]'}`}>
                    {st === 'done' ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg> : i + 1}
                  </span>
                  {i < STEP_ORDER.length - 1 ? <span className={`flex-1 h-0.5 rounded-[2px] ${st === 'done' ? 'bg-[#1E9E6A]' : 'bg-[#e4e7ec]'}`} /> : <span className="flex-1" />}
                </div>
                <span className={`mt-[3px] font-(family-name:--font-display) font-extrabold text-[13.5px] ${st === 'next' ? 'text-[#8593a4]' : 'text-tn-ink'}`}>{s === 'self' ? 'Self-review' : s === 'review' ? 'Review' : s === 'meeting' ? 'Meeting' : 'Approval'}</span>
                <span className="text-[12.5px] text-[#5b6b82]">{stepWho(s)}</span>
                <span className={`text-[12px] font-bold ${st === 'now' ? 'text-tn-ink' : st === 'done' ? 'text-[#0d7a4f]' : 'text-[#8593a4]'}`}>{stepLine(s)}</span>
              </li>
            )
          })}
        </ol>
      </div>

      {sentBack && v.step !== 'approved' && ((isPerson && v.step === 'self') || (isReviewer && sentBack.from && mp && mp.step !== sentBack.from)) && (
        <div className="rounded-[12px] border border-[var(--bdg-orange-fg)] bg-[var(--bdg-orange-bg)] px-4 py-3 text-[13.5px] text-tn-ink">
          <strong className="font-(family-name:--font-display)">{sentBack.by} sent it back on {fmtInstantDay(sentBack.at)}:</strong> {sentBack.reason}
        </div>
      )}

      <div className="flex gap-4 items-start">
        {/* In this review */}
        <nav aria-label="In this review" className={`${CARD} hidden min-[960px]:flex flex-col gap-0.5 w-[200px] flex-none sticky top-[calc(var(--chrome-top,64px)+16px)] px-2 py-3 max-h-[calc(100vh-140px)] overflow-y-auto [scrollbar-width:none]`}>
          <span className={`${FIELD_LABEL} px-2.5 pb-2`}>In this review</span>
          {nav.map(n => (
            <button key={n.id} type="button" onClick={() => jump(n.id)}
              className={`flex items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left cursor-pointer border-0 ${here === n.id ? 'bg-[#eaf4f4]' : 'bg-transparent hover:bg-subtle'}`}>
              <StatusIcon state={n.state} title />
              <span className={`flex-1 min-w-0 text-[13px] font-bold leading-[1.3] ${here === n.id ? 'text-tn-teal' : 'text-tn-ink'}`}>{n.label}</span>
              {n.count && <span className="text-[11.5px] text-muted tabular-nums">{n.count}</span>}
            </button>
          ))}
        </nav>

        <div ref={main} className="flex-1 min-w-0 flex flex-col gap-4">
          {blocks}
          {/* The bar rides the bottom of the form column, never over "In this review". */}
          {bar && (
            <div className={`${CARD} sticky bottom-[calc(12px+env(safe-area-inset-bottom,0px))] z-30 px-5 py-3.5 flex flex-wrap items-center gap-3 shadow-[0_-10px_30px_-12px_rgba(1,35,88,.25)]`}>
              <div className="flex-1 min-w-[220px] flex flex-col gap-0.5">
                <span className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">{bar.text}</span>
                <span className="text-[12.5px] text-muted">{bar.sub}</span>
              </div>
              <div className="flex flex-wrap gap-2.5">{bar.actions}</div>
            </div>
          )}
        </div>

        {/* Last year's file beside the form, wide screens */}
        {panel && v.lastImport && (
          <aside className="bg-white border border-tn-ink rounded-[16px] hidden min-[1360px]:flex flex-col w-[460px] flex-none sticky top-[calc(var(--chrome-top,64px)+16px)] h-[calc(100vh-140px)] overflow-hidden">
            <LastFile v={v} onClose={() => setPanel(false)} />
          </aside>
        )}
      </div>

      {/* Narrower: a drawer from the right */}
      {panel && v.lastImport && (
        <div className="min-[1360px]:hidden fixed inset-0 z-[60] flex justify-end bg-[rgba(1,35,88,.35)]" onClick={() => setPanel(false)}>
          <aside className="bg-white w-full max-w-[520px] h-full flex flex-col shadow-[-18px_0_40px_rgba(1,35,88,.18)]" onClick={e => e.stopPropagation()}>
            <LastFile v={v} onClose={() => setPanel(false)} />
          </aside>
        </div>
      )}


      {submitting && (
        <Modal label={`Submit your self-review to ${reviewerNames}?`} width={476} gap={12} alert onClose={() => setSubmitting(false)}><div className="contents" style={APR_COLORS}>
          <h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[18px] text-tn-ink">Submit your self-review to {reviewerNames}?</h2>
          <p className="m-0 text-[13.5px] leading-[1.6] text-[#8593a4]">Your part locks once it is sent. If something needs changing, {two ? 'either of them' : rFirst} can send it back to you with a reason.</p>
          {warning && (
            <div className="flex gap-2.5 rounded-[10px] bg-[#fdf8e7] border border-[#f0e2a8] px-3 py-2.5 text-[13px] leading-[1.5] text-[#8a6d1a]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="flex-none mt-px" aria-hidden="true"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>
              <p className="m-0">{warning}</p>
            </div>
          )}
          <div className="flex justify-end gap-2.5 pt-1">
            <button type="button" className={BTN.white} onClick={() => setSubmitting(false)}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>Keep writing</button>
            <button type="button" disabled={busy} className={`${BTN.navy} disabled:opacity-50`} onClick={() => { setSubmitting(false); void run(() => api.submitSelf({ reviewId: v.id })) }}><Send />Submit</button>
          </div>
        </div></Modal>
      )}

      {approving && mp && (
        <Modal label={`Approve ${v.person.name}'s ${v.year} review?`} width={476} gap={12} alert onClose={() => setApproving(false)}><div className="contents" style={APR_COLORS}>
          <h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[18px] text-tn-ink">Approve {v.person.name}&apos;s {v.year} review?</h2>
          <p className="m-0 text-[13.5px] leading-[1.6] text-[#8593a4]">{two && v.parts.some(p => p !== mp && p.step !== 'approved')
            ? `Your part locks. The review is complete when ${v.parts.find(p => p !== mp)?.reviewer.name} approves theirs; then the PDF is made, saved to Google Drive and ${v.hr ? `${v.hr} (HR)` : 'HR'} is told.`
            : `The review locks for everyone. The PDF is made and saved to Google Drive (${v.driveFolder ?? 'Annual Performance Reviews'} / ${v.year}), and ${v.hr ? `${v.hr} (HR)` : 'HR'} is told.`}</p>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className={BTN.white} onClick={() => setApproving(false)}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.3" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>Cancel</button>
            <button type="button" disabled={busy} className={`${BTN.navy} disabled:opacity-50`} onClick={() => { setApproving(false); void run(() => api.approveReview({ reviewId: v.id, part: mp.no })) }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>Approve</button>
          </div>
        </div></Modal>
      )}

      {backOpen && mp && <SendBackDialog who={mp.step === 'review' ? v.person.name : mp.step === 'meeting' ? 'the review step' : 'the meeting'} personFirst={first}
        toPerson={mp.step === 'review'} onClose={() => setBackOpen(false)} onSend={async reason => { setBackOpen(false); await run(() => api.sendBack({ reviewId: v.id, reason, part: mp.no })) }} />}

      {booking2 && booking && drawerApi && (
        <EventDrawer setup={booking.setup} preset={booking.preset} note={booking.note} free={booking.free} today={today} api={drawerApi}
          onClose={() => setBooking2(false)}
          onDone={async (t, id) => {
            setBooking2(false)
            if (id) await run(() => api.linkMeeting({ reviewId: v.id, eventId: String(id), part: mp?.no }))
            else say(t)
          }} />
      )}

      {approvedOpen && (
        <Modal label={`Your ${v.year} review is approved`} width={520} gap={12} onClose={() => { setApprovedOpen(false); void api.markApprovedSeen({ reviewId: v.id }) }}><div className="contents" style={APR_COLORS}>
          <h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[19px] text-tn-ink">Your {v.year} review is approved</h2>
          <p className="m-0 text-[13.5px] leading-[1.6] text-[#435066]">Thank you, {first}. This is what happens with it:</p>
          <ul className="m-0 pl-5 flex flex-col gap-1.5 text-[13.5px] leading-[1.55] text-[#435066]">
            <li>Your goals for {v.year + 1} are recorded on your profile and in Human Resources, My review.</li>
            <li>A copy of the review is kept in the company&apos;s Google Drive folder.</li>
            <li>In 6 months{v.cycle.checkins_by ? `, around ${fmtDay(v.cycle.checkins_by, true)}` : ''}, there is a check-in to look at your goals again: tick what is done and change what needs changing.</li>
          </ul>
          <p className="m-0 rounded-[10px] bg-[#eaf4f4] px-3.5 py-2.5 text-[13px] text-tn-ink">You will see &ldquo;Your 6-month check-in&rdquo; on Needs you when it is time.</p>
          <div className="flex justify-end gap-2.5 pt-1">
            <button type="button" className={BTN.navy} onClick={() => { setApprovedOpen(false); void run(() => api.markApprovedSeen({ reviewId: v.id })) }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>Got it</button>
          </div>
        </div></Modal>
      )}
      <PdfPreview request={pdf} onClose={() => setPdf(null)} />
      <Toast toast={toast} />
    </div>
  )
}

const Send = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></svg>

function LastFile({ v, onClose }: { v: ReviewView; onClose: () => void }) {
  const f = v.lastImport!
  const [full, setFull] = useState(false)
  const title = `${v.role === 'person' ? 'Your' : `${v.person.name.split(' ')[0]}'s`} ${v.year - 1} review`
  const ICON = 'flex-none w-8 h-8 rounded-[8px] flex items-center justify-center text-[rgba(255,255,255,.8)] hover:bg-[rgba(255,255,255,.1)] border-0 bg-transparent cursor-pointer'
  return (
    <>
      <div className="flex-none bg-tn-ink px-4 py-3.5 flex items-center gap-3">
        <span className="w-[34px] h-[34px] rounded-[9px] bg-[rgba(255,255,255,.12)] text-[#F2C40A] flex items-center justify-center flex-none">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5" /></svg>
        </span>
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className="font-(family-name:--font-display) font-extrabold text-[15px] text-[#ffffff]">{title}</span>
          <span className="text-[12px] text-[rgba(255,255,255,.72)] truncate">{f.file_name} · from Google Drive</span>
        </div>
        <button type="button" onClick={() => setFull(true)} aria-label="Full screen" title="Full screen" className={ICON}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
        </button>
        <button type="button" onClick={onClose} aria-label="Close" title="Close" className={ICON}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>
      {/* Read only: pdf.js draws the pages, so there is nothing to edit, mark or download. */}
      <div className="flex-1 min-h-0 overflow-auto [scrollbar-width:none] bg-[#f4f2ec] p-[18px]"><PdfPages url={f.url} title={title} /></div>
      {full && (
        <Modal label={title} width={900} gap={0} onClose={() => setFull(false)}>
          <div className="-m-[22px] flex flex-col max-h-[calc(100vh-40px)] rounded-[16px] overflow-hidden">
            <div className="flex-none bg-tn-ink px-4 py-3.5 flex items-center gap-3">
              <div className="flex-1 min-w-0 flex flex-col gap-0.5"><span className="font-(family-name:--font-display) font-extrabold text-[15px] text-[#ffffff]">{title}</span><span className="text-[12px] text-[rgba(255,255,255,.72)] truncate">{f.file_name} · from Google Drive</span></div>
              <button type="button" onClick={() => setFull(false)} aria-label="Close" className={ICON}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
            </div>
            <div className="flex-1 min-h-0 overflow-auto bg-[#f4f2ec] p-6"><PdfPages url={f.url} title={title} /></div>
          </div>
        </Modal>
      )}
    </>
  )
}

// "the Writing Team", "the Leadership team": how a sentence names a team.
const teamOf = (name: string) => `the ${name}${/\bteam$/i.test(name) ? '' : ' team'}`

/** A Team Leader's team priorities, first thing in their self-review (owner, 10 November 2026): no approval step. */
function TeamPriorities({ t, cycleId, year, editable, api, busy, run, onSaved, onError }: {
  t: ReviewView['teamBlocks'][number]; cycleId: number; year: number; editable: boolean; api: ReviewApi; busy: boolean
  run: (go: () => Promise<Res>) => Promise<void>; onSaved: (a: string) => void; onError: (e: string) => void
}) {
  const written = t.priorities.filter(p => p.title.trim()).length
  return (
    <Section id={`team-${t.teamId}`} tone={editable ? 'teal' : undefined} title={`${t.teamName}: priorities for ${year + 1}`}
      sub={`Write these first. ${teamOf(t.teamName).replace(/^the/, 'The')} sees them at the top of their reviews, with the Company Priorities and the VP of Operations', and builds their goals on them.`}
      right={written ? <Pill tone="green" text={`${written} written`} /> : <Pill tone="amber" text="None yet" />}>
      <div className="flex flex-col gap-3">
        {t.priorities.map((p, i) => <TeamPriority key={p.id} n={i + 1} p={p} editable={editable} cycleId={cycleId} api={api} onSaved={onSaved} onError={onError} run={run} />)}
        {!t.priorities.length && <p className="m-0 text-[13px] text-muted">No team priorities yet.</p>}
      </div>
      {editable && <div><button type="button" disabled={busy} className={BTN.smallWhite} onClick={() => run(() => api.savePriority({ cycleId, teamId: t.teamId, title: '', body: '' }))}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>Add a priority</button></div>}
    </Section>
  )
}

function TeamPriority({ n, p, editable, cycleId, api, onSaved, onError, run }: {
  n: number; p: { id: number; title: string; body: string }; editable: boolean; cycleId: number; api: ReviewApi
  onSaved: (a: string) => void; onError: (e: string) => void; run: (go: () => Promise<Res>) => Promise<void>
}) {
  const title = useAutosave(p.title, x => api.savePriority({ cycleId, id: p.id, title: x }), onSaved, onError)
  const body = useAutosave(p.body, x => api.savePriority({ cycleId, id: p.id, body: x }), onSaved, onError)
  if (!editable) return (
    <div className="rounded-[12px] bg-subtle px-4 py-3 flex flex-col gap-1">
      <span className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">{n}. {p.title || 'Untitled'}</span>
      {p.body && <span className="text-[13px] text-muted">{p.body}</span>}
    </div>
  )
  return (
    <div className="rounded-[12px] border border-[#e4e7ec] px-4 py-3.5 grid grid-cols-[30px_minmax(0,1fr)_32px] gap-3">
      <span className="w-7 h-7 rounded-full bg-tn-ink text-[#F2C40A] font-(family-name:--font-display) font-black text-[13px] flex items-center justify-center">{n}</span>
      <div className="min-w-0 flex flex-col gap-2.5">
        <label className="flex flex-col gap-1.5"><span className={FIELD_LABEL}>Title</span>
          <input value={title.value} onChange={e => title.change(e.target.value)} onBlur={title.blur} maxLength={200} className={`${INPUT} w-full font-bold`} /></label>
        <label className="flex flex-col gap-1.5"><span className={FIELD_LABEL}>What it means</span>
          <textarea value={body.value} onChange={e => body.change(e.target.value)} onBlur={body.blur} rows={2} maxLength={2000} className={`${TEXTAREA} w-full`} /></label>
      </div>
      <button type="button" aria-label="Remove this priority" className={BTN.icon} onClick={() => run(() => api.removePriority({ id: p.id }))}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
      </button>
    </div>
  )
}

function MeetingNotes({ v, p, two, editable, api, onSaved, onError }: { v: ReviewView; p: ReviewView['parts'][number]; two: boolean; editable: boolean; api: ReviewApi; onSaved: (a: string) => void; onError: (e: string) => void }) {
  const a = useAutosave(p.meeting.notes, n => api.saveMeetingNotes({ reviewId: v.id, notes: n, part: p.no }), onSaved, onError)
  return (
    <Section id={two ? `notes-${p.no}` : 'notes'} title={two ? `Meeting notes · ${p.reviewer.name}` : 'Meeting notes'} sub={editable ? `Write them during or after the meeting. ${v.person.name.split(' ')[0]} reads them before agreeing.` : `Written by ${p.reviewer.name} after the meeting.`}
      right={!editable && p.meeting.startsAt ? <span className="font-(family-name:--font-display) font-extrabold text-[12.5px] text-[#8593a4]">{p.reviewer.name} · {fmtInstantDay(p.meeting.startsAt)}</span> : undefined}>
      {editable
        ? <textarea value={a.value} onChange={e => a.change(e.target.value)} onBlur={a.blur} rows={5} placeholder="Write the meeting notes" className={`${TEXTAREA} w-full text-[14px] leading-[1.55]`} />
        : <p className={`m-0 rounded-[10px] bg-[#f8f7f3] px-3.5 py-3 text-[14px] leading-[1.6] whitespace-pre-wrap ${p.meeting.notes ? 'text-[#435066]' : 'text-muted italic'}`}>{p.meeting.notes || 'No notes yet.'}</p>}
    </Section>
  )
}

function ApprovalBox({ v, p, two, busy, onBack, onApprove }: { v: ReviewView; p: ReviewView['parts'][number]; two: boolean; busy: boolean; onBack: () => void; onApprove: () => void }) {
  const added = v.goals.filter(g => g.addedByReviewer).length, changed = v.goals.filter(g => !g.addedByReviewer && g.changedByName).length
  const rows = [
    ['Self-review', v.person.name, fmtInstantDay(v.dates.selfSent)],
    ['Review', `${p.reviewer.name}${added || changed ? `: ${[added && `${added} goal${added === 1 ? '' : 's'} added`, changed && `${changed} changed`].filter(Boolean).join(', ')}` : ''}`, fmtInstantDay(p.dates.reviewSent)],
    ['Meeting', `${p.reviewer.name} and ${v.person.name}${p.meeting.startsAt && p.meeting.endsAt ? `, ${Math.round((Date.parse(p.meeting.endsAt) - Date.parse(p.meeting.startsAt)) / 60000)} min` : ''}`, fmtInstantDay(p.meeting.startsAt)],
    ['Read and agreed', v.person.name, p.dates.agreed ? `${fmtInstantDay(p.dates.agreed)}, ${fmtTime(p.dates.agreed)}` : ''],
  ]
  const other = two ? v.parts.find(x => x !== p) : null
  return (
    <section id="approve" data-section="approve" className={`${CARD} scroll-mt-[150px] px-[22px] py-[18px] flex flex-col gap-3`}>
      <div className="flex flex-col gap-0.5"><h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink">Final remarks and approval</h2><span className="text-[13px] text-muted">Every step before this one is done. Your final remarks go in the meeting notes above.</span></div>
      <div className="flex flex-col">
        {rows.map(([k, who, when]) => (
          <div key={k} className="flex items-center gap-3 py-2 border-t border-[var(--row-rule)] first:border-t-0 text-[13.5px]">
            <StatusIcon state="done" />
            <span className="w-[130px] flex-none font-(family-name:--font-display) font-extrabold text-tn-ink">{k}</span>
            <span className="flex-1 min-w-0 text-[#435066]">{who}</span>
            <span className="text-muted">{when}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-[#f1f3f6]">
        <p className="m-0 flex-1 min-w-[260px] text-[13px] leading-[1.5] text-[#8593a4]">{other && other.step !== 'approved'
          ? `Approving locks your part. The review is complete when ${other.reviewer.name} approves theirs.`
          : `Approving locks the review, makes the PDF, saves it to Google Drive and tells ${v.hr ? `${v.hr} (HR)` : 'HR'}.`}</p>
        <button type="button" disabled={busy} className={BTN.white} onClick={onBack}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" /></svg>Send back to the meeting</button>
        <button type="button" disabled={busy} className={`${BTN.navy} disabled:opacity-50`} onClick={onApprove}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>Approve</button>
      </div>
    </section>
  )
}

function PdfBox({ v, busy, onOpen, onRetry }: { v: ReviewView; busy: boolean; onOpen: () => void; onRetry: () => void }) {
  return (
    <section id="pdf" data-section="pdf" className={`${CARD} scroll-mt-[150px] px-[22px] py-5 flex flex-col gap-3.5`}>
      <div className="flex items-center gap-3.5 flex-wrap">
        <span className="w-[42px] h-[42px] rounded-[10px] bg-[#fdeeef] text-[#c8323d] flex items-center justify-center flex-none"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5" /></svg></span>
        <div className="flex-1 min-w-[220px] flex flex-col gap-[3px]">
          <span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">{v.pdf.name ?? `${v.year} review.pdf`}</span>
          <span className="text-[13px] text-[#5b6b82]">Approved by {v.parts.map(p => p.dates.approvedBy).filter(Boolean).join(' and ')}{v.parts.length < 2 ? ` on ${fmtWhen(v.dates.approved)}` : ''}. {v.hr ? `${v.hr} (HR)` : 'HR'} was told.</span>
        </div>
        <button type="button" className={BTN.navy} onClick={onOpen}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /></svg>Open PDF</button>
      </div>
      <DriveLine v={v} busy={busy} onRetry={onRetry} />
    </section>
  )
}

/** The Drive copy's three states, as in the handoff (E5): one tinted row each. */
const DRIVE = {
  saved: { fg: '#0d7a4f', bg: '#e6f6ee', d: 'M5 12l5 5 9-10' },
  waiting: { fg: '#9a5a00', bg: '#fdf1e0', d: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM12 7v5l3 2' },
  failed: { fg: '#c8323d', bg: '#fdeeef', d: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z' },
} as const

export function DriveLine({ v, busy, onRetry }: { v: Pick<ReviewView, 'pdf' | 'year' | 'driveFolder'>; busy: boolean; onRetry: () => void }) {
  const s = v.pdf.drive === 'saved' || v.pdf.drive === 'failed' ? v.pdf.drive : 'waiting'
  const c = DRIVE[s]
  const text = s === 'saved' ? `Saved to Drive: ${v.driveFolder ?? 'Annual Performance Reviews'} / ${v.year} / ${v.pdf.name}`
    : s === 'failed' ? `Failed: ${v.pdf.driveError ?? 'Drive did not take it.'} Try again, or pick the folder again in Company settings.`
    : 'Waiting to copy to Drive. It goes as soon as Google answers; nobody needs to do anything.'
  return (
    <div className="flex items-center gap-2.5 flex-wrap rounded-[10px] px-3.5 py-2.5" style={{ background: c.bg }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c.fg} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="flex-none" aria-hidden="true"><path d={c.d} /></svg>
      <p className="m-0 flex-1 min-w-0 text-[13px] font-semibold leading-[1.45]" style={{ color: c.fg }}>{text}</p>
      {s === 'saved' && v.pdf.driveLink && <a href={v.pdf.driveLink} target="_blank" rel="noopener noreferrer" className="font-(family-name:--font-display) font-extrabold text-[12.5px] text-[#1E7D7F] whitespace-nowrap hover:underline">Open in Drive</a>}
      {s === 'failed' && <button type="button" disabled={busy} className={`${BTN.smallWhite} disabled:opacity-50`} onClick={onRetry}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1E9E6A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5" /></svg>Try again</button>}
    </div>
  )
}

function SendBackDialog({ who, personFirst, toPerson, onClose, onSend }: { who: string; personFirst: string; toPerson: boolean; onClose: () => void; onSend: (reason: string) => void }) {
  const [reason, setReason] = useState('')
  return (
    <Modal label={`Send back to ${who}?`} width={500} gap={12} onClose={onClose}><div className="contents" style={APR_COLORS}>
      <h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[18px] text-tn-ink">Send back to {who}?</h2>
      {/* By name, never a guessed pronoun. */}
      <p className="m-0 text-[13.5px] leading-[1.6] text-[#8593a4]">{toPerson ? `${personFirst}'s self-review opens again for ${personFirst}, with your reason at the top. Your changes to the goals and your feedback stay.` : 'The review goes back one step, with your reason.'}</p>
      <label className="flex flex-col gap-1.5"><span className={FIELD_LABEL}>Reason{toPerson ? ` (${personFirst} sees it)` : ''}</span>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} autoFocus className={`${TEXTAREA} w-full min-h-[84px] text-[13.5px] leading-[1.55]`} /></label>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className={BTN.white} onClick={onClose}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.3" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>Cancel</button>
        <button type="button" disabled={!reason.trim()} className={`${BTN.navy} disabled:opacity-50`} onClick={() => onSend(reason.trim())}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" /></svg>Send back</button>
      </div>
    </div></Modal>
  )
}

/** "10:00 to 10:45 AM", or "11:30 AM to 12:15 PM" across noon (design handoff, E2). */
function timeRange(from: string, to: string | null): string {
  const a = fmtTime(from), b = to ? fmtTime(to) : ''
  if (!b) return a
  const am = (x: string) => x.slice(-2)
  return am(a) === am(b) ? `${a.slice(0, -3)} to ${b}` : `${a} to ${b}`
}
