/**
 * Home's tabs card (design_handoff_home, README "3. Needs you / My Work /
 * Requests", 25 October 2026): the shape of its rows and the side panel each
 * one opens, the due labels, and the counts. Pure, so the server builds the
 * rows (needs-you.ts), the card draws them, and a design check fills them
 * with sample data, all in one shape.
 */

import type { QueueRow } from '@/lib/timeclock/approval-queue'
import { NOTE_TO_APPROVE } from '@/lib/timeclock/entry-rules'

/** What a row is, which picks its chip (README, the type chip table). */
export type RowKind = 'approval' | 'request' | 'work' | 'system' | 'access' | 'invoices' | 'mine'

export type TabKey = 'needs' | 'work' | 'mine'

/** Late is red, today navy, later grey. */
export type DueTone = 'late' | 'today' | 'later'
export interface Due { label: string; tone: DueTone; /** Orders the rows: a day or an instant, ISO. */ at: string }

/** A panel button's work: the same server action the page behind it runs. */
export type PanelOp =
  | { do: 'approve-timesheet'; id: number }
  | { do: 'return-timesheet'; id: number }
  | { do: 'invoice'; id: number; decision: 'approve' | 'return' }
  | { do: 'correction'; id: number; decision: 'approve' | 'deny' }
  | { do: 'time-off'; id: number; decision: 'approve' | 'deny'; cancel: boolean }
  | { do: 'reimbursement'; id: number; decision: 'approve' | 'deny' }
  | { do: 'reimbursement-report'; id: number; ids: number[]; decision: 'approve' | 'deny' }
  | { do: 'extra-hours'; id: number; decision: 'approve' | 'deny' }
  | { do: 'resend-invite'; id: string }
  | { do: 'run-checks' }

export interface PanelButton {
  label: string
  /** A server action; or a link (`href`); or neither, and the button closes the panel. */
  op?: PanelOp
  href?: string
  /** Opens outside the portal (an item in Monday). */
  external?: boolean
  /** Copies this text (the sign-in link of an invitation). */
  copy?: string
  /** The page asks for a reason here: the panel asks for it too. */
  needsReason?: boolean
  /** The gold symbol on the navy button. */
  icon?: 'check' | 'arrow'
}

export interface Panel {
  title: string
  sub: string
  facts: { k: string; v: string }[]
  note: string | null
  /** "Open in Approvals", with the page the row belongs to. */
  link: { label: string; href: string }
  primary: PanelButton
  secondary: PanelButton | null
  /** Approving needs a note too (hours over the allowance not approved before). */
  approveNeedsNote?: boolean
}

export interface HomeRow {
  key: string
  kind: RowKind
  title: string
  sub: string
  due: Due | null
  /** The row's button; null for a row that only informs (Invoices). */
  button: string | null
  panel: Panel | null
  /**
   * Your own requests: the page the row's button opens, as a link rather than
   * the panel (audit, 25 October 2026: those rows had nothing to click).
   */
  href?: string
  /** Your own requests: waiting, or done; picks the chip's colours and its icon. */
  mine?: { state: 'wait' | 'done'; icon: 'requests' | 'clock' | 'client-reports' }
}

/**
 * A read that failed: one red line, a link to its page when the person can
 * open it (audit, 25 October 2026: "Open Approvals to try again" had nothing
 * to click).
 */
export interface TabError { text: string; href?: string }

/** One tab: its rows, and one line for each read that failed (never an empty list that pretends). */
export interface HomeTab { rows: HomeRow[]; errors: TabError[] }

export interface NeedsYouData {
  needs: HomeTab
  /** Null when My Work is not open to the person. */
  work: HomeTab | null
  mine: HomeTab
}

// ── Due labels ─────────────────────────────────────────────────────────────

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY = 86_400_000

const parts = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m, d, w: new Date(Date.UTC(y, m - 1, d)).getUTCDay(), t: Date.UTC(y, m - 1, d) }
}
const daysBetween = (a: string, b: string) => Math.round((parts(b).t - parts(a).t) / DAY)

/** "Fri" within the last week, else "Oct 12". */
const pastDay = (iso: string, today: string) => {
  const p = parts(iso)
  return daysBetween(iso, today) <= 6 ? WEEKDAY[p.w] : `${MONTH[p.m - 1]} ${p.d}`
}

/** A day's due label: "Was due Fri", "Today", "Fri, Oct 30". */
export function dueOnDay(day: string, today: string): Due {
  if (day < today) return { label: `Was due ${pastDay(day, today)}`, tone: 'late', at: day }
  if (day === today) return { label: 'Today', tone: 'today', at: day }
  const p = parts(day)
  return { label: `${WEEKDAY[p.w]}, ${MONTH[p.m - 1]} ${p.d}`, tone: 'later', at: day }
}

/** Waiting now: "Today". */
export const dueToday = (today: string): Due => ({ label: 'Today', tone: 'today', at: today })

/**
 * A problem since an instant, in the viewer's zone: "Since 7:40" the same day
 * (the prototype's words, no AM or PM), "Since Fri" within the week, else
 * "Since Oct 12". Always late.
 */
export function dueSince(at: string, zone: string, now: Date = new Date()): Due {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' })
  const day = f.format(new Date(at)), today = f.format(now)
  if (day === today) {
    const time = new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', minute: '2-digit' }).format(new Date(at)).replace(/\s?[AP]M$/, '')
    return { label: `Since ${time}`, tone: 'late', at }
  }
  return { label: `Since ${pastDay(day, today)}`, tone: 'late', at }
}

const TONE_ORDER: Record<DueTone, number> = { late: 0, today: 1, later: 2 }

/** Late first, then today, then later; inside each, the earliest first. */
export function byDue(a: HomeRow, b: HomeRow): number {
  const ta = a.due ? TONE_ORDER[a.due.tone] : 3, tb = b.due ? TONE_ORDER[b.due.tone] : 3
  return ta - tb || (a.due?.at ?? '').localeCompare(b.due?.at ?? '')
}

// ── Counts ─────────────────────────────────────────────────────────────────

/**
 * A tab's count pill (the prototype's rule): Needs you and My Work count the
 * open rows that ask something (an informing row has no button and no count);
 * Requests counts the ones still waiting.
 */
export function tabCount(tab: TabKey, rows: readonly HomeRow[], done: ReadonlySet<string> = new Set()): number {
  if (tab === 'mine') return rows.filter(r => r.mine?.state === 'wait').length
  return rows.filter(r => r.button && !done.has(r.key)).length
}

/**
 * What the day banner sums up (README "Summary"): the open Needs you and My
 * Work rows, late, due today, and due later this week.
 */
export function dayCounts(data: NeedsYouData): { late: number; today: number; week: number } {
  const open = [...data.needs.rows, ...(data.work?.rows ?? [])].filter(r => r.button && r.due)
  return {
    late: open.filter(r => r.due!.tone === 'late').length,
    today: open.filter(r => r.due!.tone === 'today').length,
    week: open.filter(r => r.due!.tone === 'later').length,
  }
}

/** What an empty tab says (audit, 25 October 2026: "Nothing else here." when nothing was ever there). */
export const EMPTY_TAB: Record<TabKey, string> = {
  needs: 'Nothing needs you right now.',
  work: 'Nothing due this week.',
  mine: 'No requests open.',
}

/** Errors without repeats, in the order they came (two kinds can fail with the same line). */
export function uniqueErrors(errors: readonly (TabError | null | undefined)[]): TabError[] {
  const seen = new Set<string>()
  return errors.filter((e): e is TabError => !!e && !seen.has(e.text) && !!seen.add(e.text))
}

/**
 * The card when Needs you could not be read at all (audit, 25 October 2026:
 * the failure took Home down through the error page). One line in Needs you
 * and one in Requests, never a list that reads as nothing waiting.
 */
export function unreadNeedsYou(): NeedsYouData {
  return {
    needs: { rows: [], errors: [{ text: 'Needs you could not be read just now. Try again in a moment.' }] },
    work: null,
    mine: { rows: [], errors: [{ text: 'Your requests could not be read just now.' }] },
  }
}

// ── The side panel's text box ──────────────────────────────────────────────

/** What the panel's one text box is for now: a Note to approve, or a Reason to send back or decline. */
export type PanelField = 'note' | 'reason' | null

/**
 * The text a panel button sends: the secondary its Reason, the navy button
 * only a Note (audit, 25 October 2026: a reason typed for Send back went out
 * as the approval's note).
 */
export function panelText(field: PanelField, isSecondary: boolean, text: string): string {
  return (isSecondary ? field === 'reason' : field === 'note') ? text : ''
}

/** approveTimesheet's answer when hours over the allowance need a note. */
export const asksForNote = (error: string): boolean => error.endsWith(NOTE_TO_APPROVE)

// ── Approval rows ──────────────────────────────────────────────────────────

const beforeDot = (s: string) => (s.includes(' · ') ? s.slice(0, s.indexOf(' · ')) : s)
const afterDot = (s: string) => (s.includes(' · ') ? s.slice(s.indexOf(' · ') + 3) : s)

/**
 * A timesheet or a fixed invoice waiting for the viewer, from its Approvals
 * row (approval-queue.ts). The queue shows an amount only to who may see it,
 * and never to a Team Leader; this never adds one.
 *
 * A fixed invoice is labelled by what it is, whoever approves it (audit, 25
 * October 2026: a Team Leader saw "Approve hours" on an invoice). "Goes to"
 * is a fact only when it names a place: "Hours only" and "No timesheet" say
 * nothing about where it goes, so an Admin without money rights gets no such
 * line.
 */
export function timesheetRow(r: QueueRow, isLead: boolean, today: string, approvalsHref: string): HomeRow {
  const fixed = r.key.startsWith('n')
  const period = beforeDot(r.main)
  const hours = fixed ? null : afterDot(r.main)
  const money = !isLead && r.sub.startsWith('Invoice ')
  const payroll = !isLead && r.sub.startsWith('Payroll summary')
  const title = `${r.name}, ${period}`
  // The flag and the queue's line can say the same ("No timesheet"): once.
  const sub = [...new Set([hours, r.flag?.text, isLead ? null : r.sub].filter((x): x is string => !!x))].join(' · ')
  const asInvoice = fixed || money
  const panel: Panel = {
    title, sub,
    facts: [
      { k: 'Period', v: period },
      ...(hours ? [{ k: 'Hours', v: hours }] : []),
      ...(money ? [{ k: 'Invoice', v: r.sub.replace(/^Invoice /, '') }] : payroll ? [{ k: 'Goes to', v: 'Rippling' }] : []),
      ...(r.flag ? [{ k: 'Status', v: r.flag.text }] : []),
      ...(r.asked ? [{ k: fixed ? 'Created' : 'Sent', v: r.asked.replace(/^(Submitted|Created by itself,) /, '') }] : []),
    ],
    note: isLead && !fixed ? 'You approve the hours. Amounts are never shown to Team Leaders.' : r.why,
    link: { label: 'Open in Approvals', href: r.href ?? approvalsHref },
    primary: {
      label: asInvoice ? 'Approve invoice' : isLead ? 'Approve hours' : 'Approve',
      op: fixed ? { do: 'invoice', id: r.id, decision: 'approve' } : { do: 'approve-timesheet', id: r.id },
      icon: 'check',
    },
    secondary: { label: 'Send back', op: fixed ? { do: 'invoice', id: r.id, decision: 'return' } : { do: 'return-timesheet', id: r.id }, needsReason: true },
    // approveTimesheet asks for a note when hours over the allowance were not approved before.
    // The queue flags it only for who sees money; anyone else gets the field when the action asks.
    approveNeedsNote: !isLead && !!r.flag?.text.includes('over the allowance'),
  }
  return { key: `q-${r.key}`, kind: 'approval', title, sub, due: dueToday(today), button: asInvoice ? 'Approve invoice' : 'Review hours', panel }
}
