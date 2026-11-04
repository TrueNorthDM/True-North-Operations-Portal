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
import { useConfirm } from '@/components/ui/useConfirm'
import { PdfPreview, type PdfRequest } from '@/components/ui/PdfPreview'
import { Modal, Toast, type ToastState } from '@/components/clocky/entries/ui'
import { EventDrawer, type DrawerApi } from '@/components/agenda/EventDrawer'
import type { StatusState } from '@/lib/ui/status-icons'
import type { Booking } from '@/lib/review/booking'
import type { ReviewView } from '@/lib/review/view'
import { STEP_LABEL, dueWords, type GoalResult } from '@/lib/review/rules'
import { fmtDay, fmtInstantDay, fmtInstantShort, fmtShort, fmtTime, fmtWhen, hireLabel, initials } from '@/lib/review/format'
import { Count, GoalList, PastGoal, PriorityGrid, QuestionField, Section, useAutosave, type GoalApi } from './parts'

type Res = { ok: true; savedAt?: string; toast?: string; id?: number } | { ok: false; error: string }
export interface ReviewApi extends GoalApi {
  saveAnswer(i: { reviewId: number; key: string; body: string }): Promise<Res>
  copyJobDescription(i: { reviewId: number }): Promise<Res>
  undoCopyJob(i: { reviewId: number }): Promise<Res>
  addGoal(i: { reviewId: number; past?: boolean }): Promise<Res>
  markGoal(i: { goalId: number; result?: GoalResult | null; comment?: string }): Promise<Res>
  submitSelf(i: { reviewId: number }): Promise<Res>
  sendBack(i: { reviewId: number; reason: string }): Promise<Res>
  finishReview(i: { reviewId: number }): Promise<Res>
  linkMeeting(i: { reviewId: number; eventId: string }): Promise<Res>
  saveMeetingNotes(i: { reviewId: number; notes: string }): Promise<Res>
  agreeReview(i: { reviewId: number }): Promise<Res>
  approveReview(i: { reviewId: number }): Promise<Res>
  retryReviewDrive(i: { reviewId: number }): Promise<Res>
  savePriority(i: { cycleId: number; id?: number | null; teamId?: string | null; title?: string; body?: string }): Promise<Res>
  removePriority(i: { id: number }): Promise<Res>
  sendTeamPriorities(i: { cycleId: number; teamId: string }): Promise<Res>
}

const STEP_ORDER = ['self', 'review', 'meeting', 'approval'] as const

export function ReviewPage({ v, api, booking, drawerApi, today }: { v: ReviewView; api: ReviewApi; booking: Booking | null; drawerApi: DrawerApi | null; today: string }) {
  const router = useRouter()
  const [toast, setToast] = useState<ToastState | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [dialog, confirm] = useConfirm()
  const [busy, setBusy] = useState(false)
  const [panel, setPanel] = useState(false)
  const [backOpen, setBackOpen] = useState(false)
  const [booking2, setBooking2] = useState(false)
  const [pdf, setPdf] = useState<PdfRequest | null>(null)
  const [editingGoal, setEditingGoal] = useState<number | null>(null)
  const [openSec, setOpenSec] = useState<Record<string, boolean>>({})
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
  const writesSelf = isPerson && v.step === 'self'
  const writesReview = isReviewer && v.step === 'review'
  const writesGoals = writesSelf || (isReviewer && (v.step === 'review' || v.step === 'meeting'))
  const first = v.person.name.split(' ')[0]
  const rFirst = v.reviewer.name.split(' ')[0]
  const after = v.step === 'meeting' || v.step === 'approval' || v.step === 'approved'
  const managerVisible = !isPerson || after
  const own = useMemo(() => v.template.sections.filter(s => s.key !== 'manager'), [v.template])
  const mgr = v.template.sections.find(s => s.key === 'manager')!
  const answered = (keys: string[]) => keys.filter(k => (v.answers[k]?.body ?? '').trim()).length
  const ownKeys = own.flatMap(s => s.questions.map(q => q.key))
  const mgrKeys = mgr.questions.map(q => q.key)
  const marked = v.pastGoals.filter(g => g.result).length
  const opened = (k: string, dflt: boolean) => openSec[k] ?? dflt
  const toggle = (k: string, dflt: boolean) => setOpenSec(s => ({ ...s, [k]: !(s[k] ?? dflt) }))
  const youOr = (name: string, id: string | null) => (id && ((isPerson && id === v.person.id) || (isReviewer && id === v.reviewer.id)) ? 'You' : name)

  // ── The sections, in the order the step shows them ──
  type Nav = { id: string; label: string; state: StatusState; count?: string }
  const nav: Nav[] = []
  const blocks: React.ReactNode[] = []
  const answerApi = (key: string) => (b: string) => api.saveAnswer({ reviewId: v.id, key, body: b })

  const lastYear = v.year - 1
  const importCard = v.lastImport && (
    <section id="last" data-section="last" className={`${CARD} ${panel ? 'border-tn-teal' : ''} scroll-mt-[150px] px-[22px] py-[18px] flex flex-wrap items-center gap-4`} key="last">
      <span className="w-10 h-10 rounded-[10px] bg-subtle flex items-center justify-center text-muted flex-none">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5" /></svg>
      </span>
      <div className="flex-1 min-w-[220px] flex flex-col gap-0.5">
        <span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">{isPerson ? 'Your' : `${first}'s`} {lastYear} review</span>
        {isPerson && v.step === 'self' && v.pastGoals.every(g => !g.fromLastReview) && <span className="text-[13px] text-[#435066]">Your goals for {v.year} are in it. Open it beside the form to add them under &ldquo;Your {v.year} goals&rdquo;.</span>}
        <span className="text-[12px] text-muted">{v.lastImport.file_name} · imported from Google Drive{v.lastImport.imported_at ? ` on ${fmtInstantShort(v.lastImport.imported_at)}` : ''}</span>
      </div>
      <button type="button" className={BTN.smallWhite} onClick={() => setPanel(p => !p)}>
        <StatusIcon state={panel ? 'locked' : 'info'} size={14} color="currentColor" className={panel ? 'hidden' : ''} />{panel ? `Close the ${lastYear} review` : `Open the ${lastYear} review`}
      </button>
    </section>
  )

  const pastSection = (v.pastGoals.length > 0 || writesSelf) && (
    <Section key="past" id="past" title={isPerson ? `Your ${v.year} goals: how they went` : `${first}'s ${v.year} goals: how they went`}
      sub={isPerson && v.step === 'self'
        ? (v.pastGoals.some(g => g.fromLastReview) ? `The goals you agreed for ${v.year} in your ${lastYear} review. Mark how each one went and say why in a sentence.` : `The goals set for ${v.year} are in your ${lastYear} review. Add each one here, mark how it went and say why in a sentence. From the ${v.year + 1} review on, they come in by themselves.`)
        : `How ${isPerson ? 'you' : first} marked the ${v.year} goals. Talk them through at the meeting.`}
      right={<span className="font-(family-name:--font-display) font-extrabold text-[12.5px] text-muted">{v.pastGoals.length ? `${marked} of ${v.pastGoals.length} marked` : 'None added yet'}</span>}>
      <div className="flex flex-col">
        {v.pastGoals.map(g => <PastGoal key={g.id} g={g} year={v.year} editable={writesSelf} api={api} onSaved={onSaved} onError={onError} onRemoved={() => router.refresh()} />)}
        {!v.pastGoals.length && <p className="m-0 text-[13px] text-muted">No {v.year} goals added yet.{v.lastImport ? ` Open your ${lastYear} review and add the first one.` : ''}</p>}
      </div>
      {writesSelf && v.pastGoals.every(g => !g.fromLastReview) && (
        <div><button type="button" disabled={busy} className={BTN.smallWhite} onClick={() => run(() => api.addGoal({ reviewId: v.id, past: true }))}>+ Add a {v.year} goal</button></div>
      )}
    </Section>
  )
  const pastNav: Nav = { id: 'past', label: `${v.year} goals`, state: !v.pastGoals.length ? 'todo' : marked === v.pastGoals.length ? 'done' : writesSelf ? 'progress' : 'info', count: v.pastGoals.length ? `${marked}/${v.pastGoals.length}` : '0' }
  const qNav = (key: string): Nav => {
    const s = own.find(x => x.key === key)!
    const keys = s.questions.map(q => q.key)
    const done = answered(keys)
    return { id: key, label: s.title, state: done === keys.length ? 'done' : writesSelf ? (done ? 'progress' : 'todo') : 'info', count: writesSelf || !after ? `${done}/${keys.length}` : undefined }
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
          {copyable && empty && <button type="button" className={BTN.smallWhite} disabled={busy} onClick={() => run(() => api.copyJobDescription({ reviewId: v.id }))}>Copy from your {lastYear} review</button>}
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
    <Section key="pri" id="pri" title={`Company Priorities for ${v.year + 1}`} open={opened('pri', true)} onToggle={() => toggle('pri', true)}>
      <PriorityGrid items={v.priorities} showGoals />
    </Section>
  )

  const teamSections = writesSelf ? v.teamBlocks.map(t => <TeamPriorities key={t.teamId} t={t} cycleId={v.cycle.id} year={v.year} api={api} busy={busy} run={run} onSaved={onSaved} onError={onError} />) : []

  const goalsTitle = isPerson ? `Your goals for ${v.year + 1}` : `${first}'s goals for ${v.year + 1}`
  const proposed = v.goals.filter(g => !g.addedByReviewer).length
  const goalsSection = (
    <Section key="goals" id="goals" title={after ? `Agreed goals for ${v.year + 1}` : goalsTitle}
      sub={after ? `${proposed} goal${proposed === 1 ? '' : 's'} from ${first}${v.goals.length - proposed ? ` and ${v.goals.length - proposed} added by ${v.reviewer.name}` : ''}.${v.step === 'meeting' && isReviewer ? ' Change a goal here if the meeting changes it.' : ''}`
        : writesReview ? `${first} proposed ${proposed}. Change or add what you need; every change is marked for ${first}.` : 'One item each: what, how it is measured, by when (month and year), the term, and which of the priorities above it serves.'}
      right={<span className="font-(family-name:--font-display) font-extrabold text-[12.5px] text-muted">{v.goals.length} {v.goals.length === 1 ? 'goal' : 'goals'}</span>}>
      {(writesSelf || writesReview) && (
        <p className="m-0 flex items-start gap-2.5 rounded-[10px] bg-[var(--bdg-blue-bg)] px-3.5 py-2.5 text-[13px] text-tn-ink">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 flex-none"><path d="M4 22V4M4 4h13l-2 4 2 4H4" /></svg>
          {writesSelf ? 'Your goals should be aligned with the Company Priorities above and based on them as much as possible.' : `${first}'s goals should be aligned with the Company Priorities above and based on them as much as possible. Where one is not, change it or add one that is.`}
        </p>
      )}
      <GoalList goals={v.goals} priorities={v.priorities} api={api} editable={writesGoals} mode={writesSelf ? 'person' : writesGoals ? 'reviewer' : 'read'} who={v.person.name}
        onSaved={onSaved} onError={onError} onChanged={() => router.refresh()} editingId={editingGoal} setEditingId={setEditingGoal} />
      {writesGoals && <div><button type="button" disabled={busy} className={BTN.smallWhite} onClick={() => run(() => api.addGoal({ reviewId: v.id }), r => { if (r.ok && r.id && !writesSelf) setEditingGoal(r.id) })}>+ Add a goal</button></div>}
    </Section>
  )
  const priNav: Nav = { id: 'pri', label: 'Priorities', state: 'info', count: String(v.priorities.length) }
  const teamNavs: Nav[] = writesSelf ? v.teamBlocks.map(t => ({ id: `team-${t.teamId}`, label: 'Team priorities', state: t.state === 'approved' ? 'done' : t.state === 'sent' ? 'locked' : 'progress', count: String(t.priorities.length) })) : []

  const mgrDone = answered(mgrKeys)
  const managerSection = (
    <Section key="mgr" id="mgr" title="Manager's Feedback" tone={!managerVisible ? 'locked' : undefined}
      sub={!managerVisible ? `${v.reviewer.name} writes this part in step 2. You read it at the meeting step.` : writesReview ? `Your part. ${first} reads it at the meeting step.` : v.dates.reviewSent ? `${youOr(v.reviewer.name, v.reviewer.id)} · sent ${fmtInstantShort(v.dates.reviewSent)}` : undefined}
      open={managerVisible ? opened('mgr', writesReview || (isPerson && after)) : undefined} onToggle={managerVisible ? () => toggle('mgr', writesReview || (isPerson && after)) : undefined}
      right={writesReview ? <Count done={mgrDone} total={mgrKeys.length} /> : !managerVisible ? <StatusIcon state="locked" /> : undefined}>
      {managerVisible && opened('mgr', writesReview || (isPerson && after)) && (
        <div className="flex flex-col gap-4">
          {mgr.questions.map(q => <QuestionField key={q.key} label={q.label} hint={q.hint} initial={v.answers[q.key]?.body ?? ''} editable={writesReview} save={answerApi(q.key)} onSaved={onSaved} onError={onError} />)}
        </div>
      )}
      {managerVisible && !opened('mgr', writesReview || (isPerson && after)) && <p className="m-0 text-[13px] text-muted">{mgrKeys.length} answers: {mgr.questions.map(q => q.label.toLowerCase()).join(', ')}.</p>}
    </Section>
  )

  // ── The meeting, the notes, approval and the PDF (steps 3 and 4) ──
  const meetingSection = after && (
    <Section key="meet" id="meet" title="The meeting" right={v.meeting.held ? <Pill tone="green" text="Held" /> : v.meeting.startsAt ? <Pill tone="blue" text="Booked" /> : undefined}>
      {v.meeting.startsAt ? (
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex-none w-14 rounded-[10px] bg-subtle text-center py-1.5 font-(family-name:--font-display) font-extrabold text-tn-ink leading-tight">
            <span className="block text-[10px] tracking-[.08em] uppercase text-muted">{new Date(v.meeting.startsAt).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/New_York' })}</span>
            <span className="block text-[20px]">{new Date(v.meeting.startsAt).toLocaleDateString('en-US', { day: 'numeric', timeZone: 'America/New_York' })}</span>
            <span className="block text-[10px] tracking-[.08em] uppercase text-muted">{new Date(v.meeting.startsAt).toLocaleDateString('en-US', { month: 'short', timeZone: 'America/New_York' })}</span>
          </span>
          <div className="flex-1 min-w-[200px] text-[13.5px] text-[#435066]">
            <span className="block font-(family-name:--font-display) font-extrabold text-tn-ink">{fmtTime(v.meeting.startsAt)} to {v.meeting.endsAt ? fmtTime(v.meeting.endsAt) : ''}</span>
            {v.reviewer.name} and {v.person.name}. On the Agenda and on both Google Calendars.
          </div>
          {isReviewer && v.step === 'meeting' && booking && !v.meeting.held && <button type="button" className={BTN.smallWhite} onClick={() => setBooking2(true)}>Book another time</button>}
        </div>
      ) : isReviewer && v.step === 'meeting' ? (
        <div className="flex items-center gap-4 flex-wrap">
          <p className="m-0 flex-1 min-w-[220px] text-[13.5px] text-[#435066]">Meet with {first}{v.cycle.meeting_due ? ` before ${fmtDay(v.cycle.meeting_due)}` : ''} to agree the goals. The booking shows the times you are both free and puts it on both Google Calendars.</p>
          {booking && drawerApi
            ? <button type="button" className={BTN.navy} onClick={() => setBooking2(true)}>Book the meeting</button>
            : <span className="text-[12.5px] text-muted">The new Agenda is not open yet, so the meeting cannot be booked from here.</span>}
        </div>
      ) : <p className="m-0 text-[13.5px] text-muted">{v.reviewer.name} books it.</p>}
    </Section>
  )
  const notesSection = after && <MeetingNotes key="notes" v={v} editable={isReviewer && v.step === 'meeting'} api={api} onSaved={onSaved} onError={onError} />

  // ── Order ──
  const mgrNav: Nav = { id: 'mgr', label: "Manager's Feedback", state: !managerVisible ? 'locked' : writesReview ? (mgrDone === mgrKeys.length ? 'done' : 'progress') : 'info', count: writesReview ? `${mgrDone}/${mgrKeys.length}` : undefined }
  const goalsNav: Nav = { id: 'goals', label: after ? `Agreed goals for ${v.year + 1}` : goalsTitle, state: after ? 'done' : v.goals.length ? (writesGoals ? 'progress' : 'done') : 'todo', count: String(v.goals.length) }
  if (!after) {
    if (importCard) { blocks.push(importCard); nav.push({ id: 'last', label: `${lastYear} review`, state: 'info' }) }
    if (pastSection) { blocks.push(pastSection); nav.push(pastNav) }
    blocks.push(questionSection('job'), questionSection('self'), prioritiesSection, ...teamSections, goalsSection, questionSection('feedback'), managerSection)
    nav.push(qNav('job'), qNav('self'), priNav, ...teamNavs, goalsNav, qNav('feedback'), mgrNav)
  } else {
    if (v.step === 'approval' && isReviewer) {
      nav.push({ id: 'approve', label: 'Approval', state: 'turn' })
      blocks.push(<ApprovalBox key="approve" v={v} busy={busy} onBack={() => setBackOpen(true)} onApprove={async () => {
        if (await confirm({ title: `Approve ${v.person.name}'s ${v.year} review?`, body: 'The review locks for everyone. The PDF is made and saved to Google Drive, and HR is told.', action: 'Approve and make the PDF' })) await run(() => api.approveReview({ reviewId: v.id }))
      }} />)
    }
    if (v.step === 'approved') {
      nav.push({ id: 'pdf', label: 'The PDF', state: 'done' })
      blocks.push(<PdfBox key="pdf" v={v} busy={busy} onOpen={() => setPdf({ url: `/human-resources/reviews/${v.id}/pdf`, title: `${v.year} review, ${v.person.name}`, fallbackName: v.pdf.name ?? 'review.pdf' })} onRetry={() => run(() => api.retryReviewDrive({ reviewId: v.id }))} />)
    }
    blocks.push(meetingSection, notesSection, goalsSection)
    nav.push({ id: 'meet', label: 'The meeting', state: v.meeting.held ? 'done' : v.meeting.startsAt ? 'progress' : isReviewer ? 'turn' : 'todo' }, { id: 'notes', label: 'Meeting notes', state: v.meeting.notes ? 'done' : 'todo' }, goalsNav)
    if (isPerson) { blocks.push(managerSection); nav.push(mgrNav) }
    if (pastSection) { blocks.push(pastSection); nav.push(pastNav) }
    blocks.push(questionSection('job'), questionSection('self'), questionSection('feedback'))
    nav.push(qNav('job'), qNav('self'), qNav('feedback'))
    if (!isPerson) { blocks.push(managerSection); nav.push(mgrNav) }
  }

  // ── Step strip ──
  const stepState = (s: (typeof STEP_ORDER)[number]) => {
    const i = STEP_ORDER.indexOf(s), cur = v.step === 'approved' ? 4 : v.step === 'waiting' ? -1 : STEP_ORDER.indexOf(v.step as (typeof STEP_ORDER)[number])
    return i < cur ? 'done' : i === cur ? 'now' : 'next'
  }
  const stepLine = (s: (typeof STEP_ORDER)[number]) => {
    const st = stepState(s)
    if (s === 'self') return st === 'done' ? `Sent ${fmtInstantShort(v.dates.selfSent)}` : `Due ${fmtDay(v.phase === 1 ? v.cycle.leaders_due ?? v.cycle.self_due : v.cycle.self_due)}${st === 'now' && v.due ? ` · ${dueWords(v.due, today)}` : ''}`
    if (s === 'review') return st === 'done' ? `Sent ${fmtInstantShort(v.dates.reviewSent)}` : st === 'now' ? `Due ${fmtDay(v.cycle.review_due)}${v.due ? ` · ${dueWords(v.due, today)}` : ''}` : `By ${fmtShort(v.cycle.review_due)}`
    if (s === 'meeting') return st === 'done' ? `Agreed ${fmtInstantShort(v.dates.agreed)}` : st === 'now' ? (v.meeting.held ? 'Held. Read and agree.' : v.meeting.startsAt ? `Booked ${fmtInstantShort(v.meeting.startsAt)}` : `Book by ${fmtDay(v.cycle.meeting_due)}`) : `By ${fmtShort(v.cycle.meeting_due)}`
    return st === 'done' ? `Approved ${fmtInstantShort(v.dates.approved)}` : st === 'now' ? `Due ${fmtDay(v.cycle.approval_due)}${v.due ? ` · ${dueWords(v.due, today)}` : ''}` : `By ${fmtShort(v.cycle.approval_due)}`
  }
  const stepWho = (s: (typeof STEP_ORDER)[number]) => s === 'self' ? v.person.name : s === 'meeting' ? `${rFirst} and ${first}` : v.reviewer.name

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

  // ── The bar at the bottom ──
  const ownDone = answered(ownKeys)
  let bar: { text: string; sub: string; actions: React.ReactNode } | null = null
  if (writesSelf) bar = {
    text: `${ownDone} of ${ownKeys.length} questions answered · ${v.goals.length} ${v.goals.length === 1 ? 'goal' : 'goals'}`,
    sub: `Saved as you type. Submit sends it to ${v.reviewer.name} and locks your part.`,
    actions: <button type="button" disabled={busy} className={`${BTN.navy} disabled:opacity-50`} onClick={async () => {
      const empty = own.flatMap(s => s.questions).filter(q => !(v.answers[q.key]?.body ?? '').trim()).map(q => q.label)
      const ok = await confirm({ title: `Submit your self-review to ${v.reviewer.name}?`, action: 'Submit',
        body: <><p className="m-0">Your part locks once it is sent. If something needs changing, {rFirst} can send it back to you with a reason.</p>{empty.length > 0 && <p className="m-0 mt-2 text-[var(--bdg-orange-fg)]">{empty.length} {empty.length === 1 ? 'question is' : 'questions are'} empty: {empty.join(', ')}.</p>}</> })
      if (ok) await run(() => api.submitSelf({ reviewId: v.id }))
    }}><Send />Submit to {v.reviewer.name}</button>,
  }
  else if (writesReview) {
    const added = v.goals.filter(g => g.addedByReviewer).length, changed = v.goals.filter(g => !g.addedByReviewer && g.changedByName).length
    bar = {
      text: `Manager's Feedback: ${mgrDone} of ${mgrKeys.length} answered${added || changed ? ` · ${[added && `${added} goal${added === 1 ? '' : 's'} added`, changed && `${changed} changed`].filter(Boolean).join(', ')}` : ''}`,
      sub: `Saved as you type. Next, book the meeting with ${first}. ${isPerson ? 'Your' : 'Their'} part stays locked.`,
      actions: <>
        <button type="button" disabled={busy} className={BTN.white} onClick={() => setBackOpen(true)}>Send back to {first}</button>
        <button type="button" disabled={busy} className={`${BTN.navy} disabled:opacity-50`} onClick={() => run(() => api.finishReview({ reviewId: v.id }))}>Save and book the meeting</button>
      </>,
    }
  } else if (isReviewer && v.step === 'meeting') bar = {
    text: v.meeting.startsAt ? (v.meeting.held ? `Waiting for ${first} to read and agree` : `Meeting booked for ${fmtWhen(v.meeting.startsAt)}`) : 'Book the meeting',
    sub: `After the meeting, ${first} reads the review and agrees. Then it comes back to you to approve.`,
    actions: <button type="button" disabled={busy} className={BTN.white} onClick={() => setBackOpen(true)}>Send back to the review</button>,
  }
  else if (isPerson && v.step === 'meeting' && v.meeting.held) bar = {
    text: 'Read and agree',
    sub: `This tells ${rFirst} you have read the meeting notes, the goals and the feedback, and that you agree. The review then goes to ${v.reviewer.name} for approval.`,
    actions: <button type="button" disabled={busy} className={`${BTN.navy} disabled:opacity-50`} onClick={() => run(() => api.agreeReview({ reviewId: v.id }))}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>I have read and agree</button>,
  }

  const savedLabel = savedAt ? `Saved · ${fmtTime(savedAt)}` : null
  const stepPill = v.step === 'meeting' && isPerson && v.meeting.held ? 'Meeting' : STEP_LABEL[v.step]

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
              <span className="text-[14px] text-[#c7d2e3]">{isPerson ? 'Your' : ''} {v.year} review · {[v.person.title, v.person.teamName].filter(Boolean).join(', ')}</span>
            </div>
            {savedLabel && <span className="text-[12.5px] text-[#c7d2e3] flex items-center gap-1.5"><StatusIcon state="done" size={14} color="#7fd1b0" />{savedLabel}</span>}
          </div>
          <div className="rounded-[12px] border border-[rgba(255,255,255,.14)] bg-[rgba(255,255,255,.05)] px-4 py-3 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))] items-center">
            {[['Position', v.person.title ?? 'Not set'], ['Team', v.person.teamName ?? 'No team'], [v.person.teamLeaderName ? 'Team Leader' : 'Reviewer', v.person.teamLeaderName ?? v.reviewer.name], ['Date of hire', hireLabel(v.person.hireDate, today)]].map(([k, val]) => (
              <div key={k} className="flex flex-col gap-0.5 min-w-0"><span className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.08em] uppercase text-[#F2C40A]">{k}</span><span className="font-(family-name:--font-display) font-extrabold text-[14px] text-[#ffffff] truncate">{val}</span></div>
            ))}
            <span className="text-[12px] text-[#c7d2e3] flex items-center gap-1.5"><StatusIcon state="locked" size={13} color="#c7d2e3" />From the Directory</span>
          </div>
        </div>
        <ol className="m-0 list-none px-6 md:px-7 py-4 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))] overflow-x-auto">
          {STEP_ORDER.map((s, i) => {
            const st = stepState(s)
            return (
              <li key={s} className="flex flex-col gap-1 min-w-[140px]">
                <div className="flex items-center gap-2">
                  {st === 'done' ? <StatusIcon state="done" size={22} /> : <span className={`w-[22px] h-[22px] rounded-full flex items-center justify-center font-(family-name:--font-display) font-extrabold text-[10.5px] ${st === 'now' ? 'bg-tn-primary text-[#F2C40A] ring-2 ring-[#F2C40A]' : 'border border-[var(--panel-border)] text-muted'}`}>{i + 1}</span>}
                  <span className="flex-1 h-px bg-[var(--panel-border)]" />
                </div>
                <span className={`font-(family-name:--font-display) font-extrabold text-[14px] ${st === 'next' ? 'text-muted' : 'text-tn-ink'}`}>{s === 'self' ? 'Self-review' : s === 'review' ? 'Review' : s === 'meeting' ? 'Meeting' : 'Approval'}</span>
                <span className="text-[12.5px] text-muted">{stepWho(s)}</span>
                <span className={`text-[12.5px] font-semibold ${st === 'now' ? 'text-tn-ink' : 'text-muted'}`}>{stepLine(s)}</span>
              </li>
            )
          })}
        </ol>
      </div>

      {v.sentBack && v.step !== 'approved' && ((isPerson && v.step === 'self') || (isReviewer && v.sentBack.from && v.step !== v.sentBack.from)) && (
        <div className="rounded-[12px] border border-[var(--bdg-orange-fg)] bg-[var(--bdg-orange-bg)] px-4 py-3 text-[13.5px] text-tn-ink">
          <strong className="font-(family-name:--font-display)">{v.sentBack.by} sent it back on {fmtInstantDay(v.sentBack.at)}:</strong> {v.sentBack.reason}
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
              <span className={`flex-1 min-w-0 font-(family-name:--font-display) font-extrabold text-[13px] leading-[1.3] ${here === n.id ? 'text-tn-teal' : 'text-tn-ink'}`}>{n.label}</span>
              {n.count && <span className="text-[11.5px] text-muted tabular-nums">{n.count}</span>}
            </button>
          ))}
        </nav>

        <div ref={main} className="flex-1 min-w-0 flex flex-col gap-4">{blocks}</div>

        {/* Last year's file beside the form, wide screens */}
        {panel && v.lastImport && (
          <aside className={`${CARD} hidden min-[1360px]:flex flex-col w-[460px] flex-none sticky top-[calc(var(--chrome-top,64px)+16px)] h-[calc(100vh-140px)] overflow-hidden`}>
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

      {bar && (
        <div className="fixed bottom-0 right-0 left-0 md:left-[var(--rail-w,64px)] z-40 px-4 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-3 pointer-events-none">
          <div className={`${CARD} pointer-events-auto max-w-[1100px] mx-auto px-5 py-3.5 flex flex-wrap items-center gap-3 shadow-[0_-10px_30px_-12px_rgba(1,35,88,.25)]`}>
            <div className="flex-1 min-w-[220px] flex flex-col gap-0.5">
              <span className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">{bar.text}</span>
              <span className="text-[12.5px] text-muted">{bar.sub}</span>
            </div>
            <div className="flex flex-wrap gap-2.5">{bar.actions}</div>
          </div>
        </div>
      )}

      {backOpen && <SendBackDialog who={v.step === 'review' ? v.person.name : v.step === 'meeting' ? 'the review step' : 'the meeting'} personFirst={first}
        toPerson={v.step === 'review'} onClose={() => setBackOpen(false)} onSend={async reason => { setBackOpen(false); await run(() => api.sendBack({ reviewId: v.id, reason })) }} />}

      {booking2 && booking && drawerApi && (
        <EventDrawer setup={booking.setup} preset={booking.preset} note={booking.note} today={today} api={drawerApi}
          onClose={() => setBooking2(false)}
          onDone={async (t, id) => {
            setBooking2(false)
            if (id) await run(() => api.linkMeeting({ reviewId: v.id, eventId: String(id) }))
            else say(t)
          }} />
      )}
      <PdfPreview request={pdf} onClose={() => setPdf(null)} />
      {dialog}
      <Toast toast={toast} />
    </div>
  )
}

const Send = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></svg>

function LastFile({ v, onClose }: { v: ReviewView; onClose: () => void }) {
  const f = v.lastImport!
  return (
    <>
      <div className="flex-none bg-tn-primary px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0 flex flex-col">
          <span className="font-(family-name:--font-display) font-extrabold text-[14px] text-[#ffffff]">{v.role === 'person' ? 'Your' : `${v.person.name.split(' ')[0]}'s`} {v.year - 1} review</span>
          <span className="text-[12px] text-[#c7d2e3] truncate">{f.file_name} · from Google Drive</span>
        </div>
        <a href={f.url} target="_blank" rel="noopener noreferrer" aria-label="Open in a new window" className="text-[#ffffff] p-1.5 rounded-[8px] hover:bg-[rgba(255,255,255,.1)]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
        </a>
        <button type="button" onClick={onClose} aria-label="Close" className="text-[#ffffff] p-1.5 rounded-[8px] hover:bg-[rgba(255,255,255,.1)] border-0 bg-transparent cursor-pointer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>
      <iframe title={`The ${v.year - 1} review`} src={f.url} className="flex-1 w-full border-0 bg-subtle" />
    </>
  )
}

function TeamPriorities({ t, cycleId, year, api, busy, run, onSaved, onError }: {
  t: ReviewView['teamBlocks'][number]; cycleId: number; year: number; api: ReviewApi; busy: boolean
  run: (go: () => Promise<Res>) => Promise<void>; onSaved: (a: string) => void; onError: (e: string) => void
}) {
  const editable = t.state === 'draft' || t.state === 'returned'
  const pill = t.state === 'approved' ? <Pill tone="green" text="Approved" /> : t.state === 'sent' ? <Pill tone="blue" text="Waiting for approval" /> : t.state === 'returned' ? <Pill tone="amber" text="Sent back" /> : <Pill tone="gray" text="Not sent yet" />
  return (
    <Section id={`team-${t.teamId}`} title={`Team priorities for ${year + 1}`} sub={`For the ${t.teamName}. Your team sees them at the top of their reviews, with the whole-company ones, and can tie their goals to them.`} right={pill}>
      {t.reason && <p className="m-0 rounded-[10px] bg-[var(--bdg-orange-bg)] px-3.5 py-2.5 text-[13px] text-tn-ink"><strong>Sent back:</strong> {t.reason}</p>}
      <div className="flex flex-col gap-3">
        {t.priorities.map((p, i) => <TeamPriority key={p.id} n={i + 1} p={p} editable={editable} cycleId={cycleId} api={api} onSaved={onSaved} onError={onError} run={run} />)}
        {!t.priorities.length && <p className="m-0 text-[13px] text-muted">No team priorities yet.</p>}
      </div>
      {editable && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={busy} className={BTN.smallWhite} onClick={() => run(() => api.savePriority({ cycleId, teamId: t.teamId, title: '', body: '' }))}>+ Add a priority</button>
          <span className="flex-1 min-w-[200px] text-[12.5px] text-muted">Your team&apos;s self-reviews open when the VP of Operations or the CISO approves these, or on the &ldquo;Teams open by&rdquo; date at the latest. Sending them does not send your self-review.</span>
          <button type="button" disabled={busy || !t.priorities.length} className={`${BTN.smallNavy} disabled:opacity-50`} onClick={() => run(() => api.sendTeamPriorities({ cycleId, teamId: t.teamId }))}>Send for approval</button>
        </div>
      )}
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
    <div className="rounded-[12px] border border-[var(--panel-border)] px-4 py-3 flex gap-3">
      <span className="flex-none w-6 h-6 rounded-full bg-[#eaf4f4] text-tn-teal font-(family-name:--font-display) font-extrabold text-[11px] flex items-center justify-center mt-6">{n}</span>
      <div className="flex-1 min-w-0 flex flex-col gap-2.5">
        <label className="flex flex-col gap-1.5"><span className={FIELD_LABEL}>Title</span>
          <input value={title.value} onChange={e => title.change(e.target.value)} onBlur={title.blur} maxLength={200} className={`${INPUT} w-full font-semibold`} /></label>
        <label className="flex flex-col gap-1.5"><span className={FIELD_LABEL}>What it means</span>
          <textarea value={body.value} onChange={e => body.change(e.target.value)} onBlur={body.blur} rows={2} maxLength={2000} className={`${TEXTAREA} w-full`} /></label>
      </div>
      <button type="button" aria-label="Remove this priority" className={BTN.icon} onClick={() => run(() => api.removePriority({ id: p.id }))}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
      </button>
    </div>
  )
}

function MeetingNotes({ v, editable, api, onSaved, onError }: { v: ReviewView; editable: boolean; api: ReviewApi; onSaved: (a: string) => void; onError: (e: string) => void }) {
  const a = useAutosave(v.meeting.notes, n => api.saveMeetingNotes({ reviewId: v.id, notes: n }), onSaved, onError)
  return (
    <Section id="notes" title="Meeting notes" sub={editable ? `Write them during or after the meeting. ${v.person.name.split(' ')[0]} reads them before agreeing.` : v.meeting.startsAt ? `${v.reviewer.name} · ${fmtInstantDay(v.meeting.startsAt)}` : undefined}>
      {editable
        ? <textarea value={a.value} onChange={e => a.change(e.target.value)} onBlur={a.blur} rows={5} placeholder="Write the meeting notes" className={`${TEXTAREA} w-full text-[14px] leading-[1.55]`} />
        : <p className={`m-0 text-[14px] leading-[1.6] whitespace-pre-wrap ${v.meeting.notes ? 'text-[#435066]' : 'text-muted italic'}`}>{v.meeting.notes || 'No notes yet.'}</p>}
    </Section>
  )
}

function ApprovalBox({ v, busy, onBack, onApprove }: { v: ReviewView; busy: boolean; onBack: () => void; onApprove: () => void }) {
  const added = v.goals.filter(g => g.addedByReviewer).length, changed = v.goals.filter(g => !g.addedByReviewer && g.changedByName).length
  const rows = [
    ['Self-review', v.person.name, fmtInstantDay(v.dates.selfSent)],
    ['Review', `${v.reviewer.name}${added || changed ? `: ${[added && `${added} goal${added === 1 ? '' : 's'} added`, changed && `${changed} changed`].filter(Boolean).join(', ')}` : ''}`, fmtInstantDay(v.dates.reviewSent)],
    ['Meeting', `${v.reviewer.name} and ${v.person.name}`, fmtInstantDay(v.meeting.startsAt)],
    ['Read and agreed', v.person.name, v.dates.agreed ? `${fmtInstantDay(v.dates.agreed)}, ${fmtTime(v.dates.agreed)}` : ''],
  ]
  return (
    <section id="approve" data-section="approve" className={`${CARD} border-tn-teal scroll-mt-[150px] px-[22px] py-[18px] flex flex-col gap-3`}>
      <div className="flex flex-col gap-0.5"><h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink">Ready to approve</h2><span className="text-[13px] text-muted">Every step before this one is done.</span></div>
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
      <p className="m-0 text-[13px] text-muted">Approving locks the review, makes the PDF, saves it to Google Drive and tells HR.</p>
      <div className="flex flex-wrap gap-2.5 justify-end">
        <button type="button" disabled={busy} className={BTN.white} onClick={onBack}>Send back to the meeting</button>
        <button type="button" disabled={busy} className={`${BTN.navy} disabled:opacity-50`} onClick={onApprove}>Approve and make the PDF</button>
      </div>
    </section>
  )
}

function PdfBox({ v, busy, onOpen, onRetry }: { v: ReviewView; busy: boolean; onOpen: () => void; onRetry: () => void }) {
  return (
    <section id="pdf" data-section="pdf" className={`${CARD} scroll-mt-[150px] px-[22px] py-[18px] flex flex-col gap-3`}>
      <div className="flex items-center gap-4 flex-wrap">
        <span className="w-10 h-10 rounded-[10px] bg-[#fdeeef] text-[#c8323d] flex items-center justify-center font-(family-name:--font-display) font-black text-[10px] flex-none">PDF</span>
        <div className="flex-1 min-w-[220px] flex flex-col gap-0.5">
          <span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">{v.pdf.name ?? `${v.year} review.pdf`}</span>
          <span className="text-[12.5px] text-muted">Approved by {v.dates.approvedBy} on {fmtWhen(v.dates.approved)}. HR was told.</span>
        </div>
        <button type="button" className={BTN.smallWhite} onClick={onOpen}>Open PDF</button>
      </div>
      <DriveLine v={v} busy={busy} onRetry={onRetry} />
    </section>
  )
}

export function DriveLine({ v, busy, onRetry }: { v: Pick<ReviewView, 'pdf' | 'year'>; busy: boolean; onRetry: () => void }) {
  if (v.pdf.drive === 'saved') return (
    <p className="m-0 flex items-center gap-2 flex-wrap rounded-[10px] bg-[var(--bdg-green-bg)] px-3.5 py-2.5 text-[13px] text-tn-ink">
      <StatusIcon state="done" />Saved to Drive: Annual Performance Reviews / {v.year} / {v.pdf.name}
      {v.pdf.driveLink && <a href={v.pdf.driveLink} target="_blank" rel="noopener noreferrer" className={`${BTN.link} ml-auto`}>Open in Drive</a>}
    </p>
  )
  if (v.pdf.drive === 'failed') return (
    <p className="m-0 flex items-center gap-2 flex-wrap rounded-[10px] bg-[var(--bdg-red-bg)] px-3.5 py-2.5 text-[13px] text-tn-ink">
      <StatusIcon state="locked" color="var(--bdg-red-fg)" />Failed: {v.pdf.driveError ?? 'Drive did not take it.'} Try again, or pick the folder again in Company settings.
      <button type="button" disabled={busy} className={`${BTN.smallWhite} ml-auto`} onClick={onRetry}>Try again</button>
    </p>
  )
  return <p className="m-0 flex items-center gap-2 rounded-[10px] bg-subtle px-3.5 py-2.5 text-[13px] text-[#435066]"><StatusIcon state="progress" />Waiting to copy to Drive. It goes as soon as Google answers; nobody needs to do anything.</p>
}

function SendBackDialog({ who, personFirst, toPerson, onClose, onSend }: { who: string; personFirst: string; toPerson: boolean; onClose: () => void; onSend: (reason: string) => void }) {
  const [reason, setReason] = useState('')
  return (
    <Modal label={`Send back to ${who}?`} width={460} onClose={onClose}>
      <h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[19px] text-tn-ink">Send back to {who}?</h2>
      <p className="m-0 text-[13.5px] text-[#435066]">{toPerson ? `Their self-review opens again for them, with your reason at the top. Your changes to the goals and your feedback stay.` : 'The review goes back one step, with your reason.'}</p>
      <label className="flex flex-col gap-1.5"><span className={FIELD_LABEL}>Reason{toPerson ? ` (${personFirst} sees it)` : ''}</span>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} autoFocus className={`${TEXTAREA} w-full`} /></label>
      <div className="flex justify-end gap-2.5">
        <button type="button" className={BTN.white} onClick={onClose}>Cancel</button>
        <button type="button" disabled={!reason.trim()} className={`${BTN.navy} disabled:opacity-50`} onClick={() => onSend(reason.trim())}>Send back</button>
      </div>
    </Modal>
  )
}
