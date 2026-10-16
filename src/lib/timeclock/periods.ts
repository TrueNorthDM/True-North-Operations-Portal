// Pay periods, and the state a person's month is in.
//
// The account runs monthly, so a period is a calendar month in the company's
// timezone. Kept as its own module because two screens ask the same questions
// of it: My Hours, to know whether the month can still be edited, and the
// approvals list, to know whose month is waiting.

export type SubmissionState = 'draft' | 'submitted' | 'approved' | 'returned'

/** The month an ISO date falls in, as a period. */
export function periodFor(dateISO: string): { month: string; start: string; end: string } {
  const month = dateISO.slice(0, 7)
  const [y, m] = month.split('-').map(Number)
  return {
    month,
    start: `${month}-01`,
    end: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10),
  }
}

/** Step a month back or forward: '2026-01' shifted by -1 is '2025-12'. */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + by, 1))
  return d.toISOString().slice(0, 7)
}

/** 'August 2026', for a heading. */
export function monthName(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1))
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/**
 * What a person may do with a month, given where it is.
 *
 * One function rather than conditions spread across the screens, so the button
 * that appears and the action that runs cannot disagree about whether a month
 * is still open.
 */
export function whatCanIDo(state: SubmissionState | null): {
  canEdit: boolean
  canSubmit: boolean
  label: string
  hint: string
} {
  switch (state) {
    case 'submitted':
      return {
        canEdit: false, canSubmit: false,
        label: 'Waiting for approval',
        hint: 'Sent. It cannot be edited while somebody is looking at it. Ask to have it handed back if something is wrong.',
      }
    case 'approved':
      return {
        canEdit: false, canSubmit: false,
        label: 'Approved',
        hint: 'Signed off. Changing it now needs an admin, on purpose: somebody has already acted on these hours.',
      }
    case 'returned':
      return {
        canEdit: true, canSubmit: true,
        label: 'Handed back',
        hint: 'It came back to you with a note. Fix what is flagged and send it again.',
      }
    default:
      return {
        canEdit: true, canSubmit: true,
        label: 'Open',
        hint: 'Still yours to edit. Submit it when the month is done.',
      }
  }
}

// ─── Clocky: monthly or every 2 weeks (SPEC section 11A) ─────────────────────
//
// Each person submits monthly (the 1st to the last day of the month, in their
// own time zone) or every 2 weeks, by pay period: 14 days counted from a start
// date set once for the company. How a person submits is kept as a list of
// changes, each with the day it takes effect (tc_person_cadence), and the pay
// period start as a list of moves (tc_pay_period_anchors), because both rules
// of 11A are about the past staying as it was:
//
//   * changing a person's cadence never cuts a period in half: the current
//     period closes the way it started (cadenceChange below works out the
//     dates);
//   * moving the start date keeps every period already submitted; the new
//     dates start with the first period nobody has submitted yet, and the days
//     in between close as one period (anchorMove).
//
// A period is the cadence's own period cut to where its rule is in force:
// a month, or the 14 days of the pay period grid, cut at the day a change or a
// move takes effect. The one exception is the last stretch of pay periods
// before monthly starts, which closes as ONE period however long it is
// ("then Oct 18 to 31 closes as one last pay period"): that change is stored
// with onePeriod set.
//
// Dates are YYYY-MM-DD calendar days in the person's own time zone.

export type Cadence = 'monthly' | 'biweekly'

/** One row of tc_person_cadence. */
export interface CadenceChange { cadence: Cadence; effectiveFrom: string; onePeriod?: boolean }

/** One row of tc_pay_period_anchors. null effectiveFrom: from the beginning. */
export interface AnchorChange { anchor: string; effectiveFrom: string | null }

export interface Period { start: string; end: string; kind: 'month' | 'pay_period' }

/** What periods are worked out from, for one person. */
export interface CadenceRules {
  changes: readonly CadenceChange[]
  /** tc_settings.default_cadence: anyone with no change follows it. */
  fallback: Cadence
  anchors: readonly AnchorChange[]
}

export const PAY_PERIOD_DAYS = 14

const DAY_MS = 86_400_000
const dayNumber = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS)
}
const fromDayNumber = (n: number): string => new Date(n * DAY_MS).toISOString().slice(0, 10)

export const addDays = (iso: string, days: number): string => fromDayNumber(dayNumber(iso) + days)
export const daysBetween = (from: string, to: string): number => dayNumber(to) - dayNumber(from)
export const monthStart = (iso: string): string => `${iso.slice(0, 7)}-01`
export const monthEnd = (iso: string): string => periodFor(iso).end
const later = (a: string, b: string) => (a > b ? a : b)
const earlier = (a: string, b: string) => (a < b ? a : b)

/** The first day of the pay period a day falls in, counting 14 days from the anchor (backwards too). */
export function payPeriodStart(iso: string, anchor: string): string {
  const k = Math.floor(daysBetween(anchor, iso) / PAY_PERIOD_DAYS)
  return addDays(anchor, k * PAY_PERIOD_DAYS)
}

const sortChanges = (rows: readonly CadenceChange[]) => [...rows].sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1))
const sortAnchors = (rows: readonly AnchorChange[]) =>
  [...rows].sort((a, b) => (a.effectiveFrom ?? '') < (b.effectiveFrom ?? '') ? -1 : 1)

/** The change in force on a day, with the stretch of days it covers (null: open ended). */
export function cadenceOn(iso: string, rules: Pick<CadenceRules, 'changes' | 'fallback'>): {
  cadence: Cadence; onePeriod: boolean; from: string | null; to: string | null
} {
  const rows = sortChanges(rules.changes)
  let at = -1
  rows.forEach((r, i) => { if (r.effectiveFrom <= iso) at = i })
  const next = rows[at + 1]
  const to = next ? addDays(next.effectiveFrom, -1) : null
  if (at < 0) return { cadence: rules.fallback, onePeriod: false, from: null, to }
  const r = rows[at]
  return { cadence: r.cadence, onePeriod: !!r.onePeriod && !!next, from: r.effectiveFrom, to }
}

/** The pay period start in force on a day, with the stretch it covers. Null when none was ever set. */
export function anchorOn(iso: string, anchors: readonly AnchorChange[]): { anchor: string; from: string | null; to: string | null } | null {
  const rows = sortAnchors(anchors)
  if (!rows.length) return null
  // Before the first dated move, the first row counts, whatever its date.
  let at = 0
  rows.forEach((r, i) => { if (r.effectiveFrom === null || r.effectiveFrom <= iso) at = i })
  const next = rows[at + 1]
  return { anchor: rows[at].anchor, from: at === 0 ? null : rows[at].effectiveFrom, to: next?.effectiveFrom ? addDays(next.effectiveFrom, -1) : null }
}

/** The pay period of the company grid a day falls in, cut where a move of the start date takes effect. */
export function gridPeriod(iso: string, anchors: readonly AnchorChange[]): Period | null {
  const a = anchorOn(iso, anchors)
  if (!a) return null
  const start = payPeriodStart(iso, a.anchor)
  let p = { start, end: addDays(start, PAY_PERIOD_DAYS - 1) }
  if (a.from) p = { start: later(p.start, a.from), end: p.end }
  if (a.to) p = { start: p.start, end: earlier(p.end, a.to) }
  return { ...p, kind: 'pay_period' }
}

/** The period a person's day belongs to. */
export function periodContaining(iso: string, rules: CadenceRules): Period {
  const c = cadenceOn(iso, rules)
  const clip = (p: Period): Period => ({
    ...p,
    start: c.from ? later(p.start, c.from) : p.start,
    end: c.to ? earlier(p.end, c.to) : p.end,
  })
  if (c.onePeriod && c.from && c.to) return { start: c.from, end: c.to, kind: 'pay_period' }
  if (c.cadence === 'biweekly') {
    const p = gridPeriod(iso, rules.anchors)
    if (p) return clip(p)
  }
  return clip({ start: monthStart(iso), end: monthEnd(iso), kind: 'month' })
}

/** Every period that touches a range of days, oldest first. */
export function periodsBetween(from: string, to: string, rules: CadenceRules): Period[] {
  const out: Period[] = []
  for (let d = from; d <= to && out.length < 1000; ) {
    const p = periodContaining(d, rules)
    out.push(p)
    d = addDays(p.end, 1)
  }
  return out
}

/** Whether a period is a whole calendar month. */
export const isWholeMonth = (p: { start: string; end: string }): boolean =>
  p.start === monthStart(p.start) && p.end === monthEnd(p.start)

/**
 * How a period is named: "October" / "October 2026" for a month, "Oct 4 to 17"
 * / "Oct 4 to 17, 2026" otherwise. "Submit October", "Submit Oct 4 to 17".
 */
export function periodLabel(p: { start: string; end: string }): { label: string; full: string } {
  if (isWholeMonth(p)) {
    const name = monthName(p.start.slice(0, 7))
    return { label: name.split(' ')[0], full: name }
  }
  return { label: rangeText(p.start, p.end), full: `${rangeText(p.start, p.end)}, ${p.end.slice(0, 4)}` }
}

const SHORT_MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const LONG_MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const md = (iso: string) => `${SHORT_MONTH[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`
const wmd = (iso: string) => `${WEEKDAY[new Date(`${iso}T00:00:00Z`).getUTCDay()]}, ${md(iso)}`
const longMonth = (iso: string) => LONG_MONTH[Number(iso.slice(5, 7)) - 1]

/** "Oct 4 to 17", "Oct 25 to Nov 7" (the same as format.ts rangeLabel, kept here so this module stands alone). */
export function rangeText(from: string, to: string): string {
  return from.slice(0, 7) === to.slice(0, 7) ? `${md(from)} to ${Number(to.slice(8, 10))}` : `${md(from)} to ${md(to)}`
}

/**
 * The line in the submit dialog (3H) that says which kind of period this is:
 * "You submit monthly. October runs to Sat, Oct 31. A Super Admin sets this per
 * person." or "You submit every 2 weeks, by pay period. This one runs Sun,
 * Oct 4 to Sat, Oct 17. A Super Admin sets this per person."
 */
export function cadenceLine(p: Period): string {
  if (p.kind === 'month') {
    return `You submit monthly. ${periodLabel(p).label} runs to ${wmd(p.end)}. A Super Admin sets this per person.`
  }
  return `You submit every 2 weeks, by pay period. This one runs ${wmd(p.start)} to ${wmd(p.end)}. A Super Admin sets this per person.`
}

/** "October is submitted. Ask a Super Admin to reopen it." (1N, and every refused change in a locked period). */
export const lockedMessage = (p: { start: string; end: string }): string =>
  `${periodLabel(p).label} is submitted. Ask a Super Admin to reopen it.`

/** A submission as the lock rule reads it: its period's days and its state. */
export interface SubmittedPeriod { start: string; end: string; state: string }

/**
 * Locked: the day sits in a period the person submitted or had approved, or
 * the entry itself is submitted, approved or locked (as QuickBooks Time left
 * imported rows). Locked for everyone; a Super Admin reopens the period first.
 */
export function lockedBy(iso: string, submissions: readonly SubmittedPeriod[], entryState?: string | null): SubmittedPeriod | { start: string; end: string; state: string } | null {
  const s = submissions.find(x => (x.state === 'submitted' || x.state === 'approved') && x.start <= iso && iso <= x.end)
  if (s) return s
  if (entryState === 'submitted' || entryState === 'approved' || entryState === 'locked') {
    const p = periodFor(iso)
    return { start: p.start, end: p.end, state: entryState }
  }
  return null
}

export const isLocked = (iso: string, submissions: readonly SubmittedPeriod[], entryState?: string | null): boolean =>
  lockedBy(iso, submissions, entryState) !== null

// ── Changing a person's cadence ─────────────────────────────────────────────

export interface CadencePlan {
  /** The changes to write after removing every change still in the future. */
  insert: CadenceChange[]
  /** The day the new way of submitting starts, or null when nothing changes. */
  effectiveFrom: string | null
  /** The sentence the confirm dialogs show (5B, 5C), "" when nothing changes. */
  text: string
}

/**
 * What changing a person to `to` on `today` writes, by the rule of 11A:
 *
 *   monthly to every 2 weeks: the current month still closes monthly; the
 *   first pay period starts after it. If the month ends in the middle of a pay
 *   period, the days between close as one short period.
 *
 *   every 2 weeks to monthly: the current pay period closes as it is; if days
 *   remain before the 1st, they close as one last pay period; monthly starts on
 *   the 1st.
 *
 * Changes still in the future are dropped first (changing your mind before a
 * change takes effect undoes it). Copy from Timesheet Periods.dc.html.
 */
export function cadenceChange(today: string, to: Cadence, rules: CadenceRules): CadencePlan {
  const future = sortChanges(rules.changes).filter(c => c.effectiveFrom > today)
  const kept = sortChanges(rules.changes).filter(c => c.effectiveFrom <= today)
  const now = cadenceOn(today, rules)
  const keptRules: CadenceRules = { ...rules, changes: kept }

  // In the last stretch of pay periods before monthly: it closes as planned.
  if (now.onePeriod && now.to) {
    if (to === 'monthly') return { insert: future, effectiveFrom: null, text: '' }
    const first = addDays(now.to, 1)
    const start = firstGridStart(first, rules.anchors) ?? first
    const gap = start > first ? { start: first, end: addDays(start, -1) } : null
    return {
      insert: [{ cadence: 'biweekly', effectiveFrom: first }],
      effectiveFrom: first,
      text: `Starts with the pay period of ${rangeText(start, addDays(start, PAY_PERIOD_DAYS - 1))}. The current pay period (${rangeText(now.from!, now.to)}) closes as it is${gap ? `, and ${rangeText(gap.start, gap.end)} closes as one short period` : ''}.`,
    }
  }

  const from = cadenceOn(today, keptRules).cadence
  if (from === to) return { insert: [], effectiveFrom: null, text: '' }

  if (to === 'biweekly') {
    const end = periodContaining(today, keptRules).end
    const first = addDays(end, 1)
    const start = firstGridStart(first, rules.anchors) ?? first
    const gap = start > first ? { start: first, end: addDays(start, -1) } : null
    return {
      insert: [{ cadence: 'biweekly', effectiveFrom: first }],
      effectiveFrom: first,
      text: `Starts with the pay period of ${rangeText(start, addDays(start, PAY_PERIOD_DAYS - 1))}. ${longMonth(today)} still closes monthly${gap ? `, and ${rangeText(gap.start, gap.end)} closes as one short period` : ''}.`,
    }
  }

  const cur = periodContaining(today, keptRules)
  const lastDay = monthEnd(cur.end)
  const first = addDays(lastDay, 1)
  const gap = cur.end < lastDay ? { start: addDays(cur.end, 1), end: lastDay } : null
  return {
    insert: [
      ...(gap ? [{ cadence: 'biweekly' as const, effectiveFrom: gap.start, onePeriod: true }] : []),
      { cadence: 'monthly', effectiveFrom: first },
    ],
    effectiveFrom: first,
    text: `Starts in ${longMonth(first)}. The current pay period (${rangeText(cur.start, cur.end)}) closes as it is${gap ? `, then ${rangeText(gap.start, gap.end)} closes as one last pay period` : ''}.`,
  }
}

/** The first day on or after `iso` where a pay period of the grid starts. */
function firstGridStart(iso: string, anchors: readonly AnchorChange[]): string | null {
  const p = gridPeriod(iso, anchors)
  if (!p) return null
  return p.start === iso ? iso : addDays(p.end, 1)
}

// ── Moving the pay period start ─────────────────────────────────────────────

export interface AnchorPlan {
  /** The day the new start date takes over; null when it is the first one ever set. */
  effectiveFrom: string | null
  /** The current pay period before and after (Company settings' amber line and its dialog). */
  oldCurrent: Period | null
  newCurrent: Period
  /** The days that close as one period between the old dates and the new ones. */
  gap: { start: string; end: string } | null
  /** Whether today's pay period changes at all. */
  moves: boolean
}

/**
 * Moving the start date (5A): periods already submitted keep their dates; the
 * new dates start with the first period nobody has submitted yet; the days in
 * between close as one period.
 *
 * `lastSubmittedEnd`: the last day of the latest pay period anyone submitted or
 * had approved. The new dates start the day after it. With none, they start
 * with today's pay period, which nobody has submitted.
 */
export function anchorMove(today: string, anchors: readonly AnchorChange[], newAnchor: string, lastSubmittedEnd: string | null): AnchorPlan {
  const oldCurrent = gridPeriod(today, anchors)
  if (!oldCurrent) {
    const p = gridPeriod(today, [{ anchor: newAnchor, effectiveFrom: null }])!
    return { effectiveFrom: null, oldCurrent: null, newCurrent: p, gap: null, moves: true }
  }
  const from = lastSubmittedEnd ? addDays(lastSubmittedEnd, 1) : oldCurrent.start
  const after = applyAnchor(anchors, newAnchor, from)
  const newCurrent = gridPeriod(today, after)!
  // The days from `from` to the first start of the new dates are one period.
  const firstNew = gridPeriod(from, after)!
  const gap = payPeriodStart(from, newAnchor) === from ? null : { start: firstNew.start, end: firstNew.end }
  return {
    effectiveFrom: from,
    oldCurrent,
    newCurrent,
    gap,
    moves: newCurrent.start !== oldCurrent.start || newCurrent.end !== oldCurrent.end,
  }
}

/** The moves after a new start date takes effect on `from`: later moves give way to it. */
export function applyAnchor(anchors: readonly AnchorChange[], newAnchor: string, from: string | null): AnchorChange[] {
  if (from === null || !anchors.length) return [{ anchor: newAnchor, effectiveFrom: null }]
  const kept = sortAnchors(anchors).filter(a => a.effectiveFrom === null || a.effectiveFrom < from)
  return [...kept, { anchor: newAnchor, effectiveFrom: from }]
}

/**
 * The company's pay periods around today (5A): the one before, the current one
 * and the next four, on the grid in force.
 */
export function companyPayPeriods(today: string, anchors: readonly AnchorChange[], before = 1, after = 4): (Period & { state: 'closed' | 'current' | 'next' })[] {
  const cur = gridPeriod(today, anchors)
  if (!cur) return []
  const out: (Period & { state: 'closed' | 'current' | 'next' })[] = []
  let p: Period | null = cur
  const back: Period[] = []
  for (let i = 0; i < before && p; i++) { p = gridPeriod(addDays(p.start, -1), anchors); if (p) back.unshift(p) }
  for (const b of back) out.push({ ...b, state: 'closed' })
  out.push({ ...cur, state: 'current' })
  p = cur
  for (let i = 0; i < after && p; i++) { p = gridPeriod(addDays(p.end, 1), anchors); if (p) out.push({ ...p, state: 'next' }) }
  return out
}
