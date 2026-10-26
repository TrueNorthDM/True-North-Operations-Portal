/**
 * The Home's Pay period card (design handoff, 25 October 2026, README section
 * 2): the signed-in person's active period, its days by kind (worked, PTO,
 * holiday, sick), the expected hours and the pace. It is also the timesheet
 * reminder that replaced TimesheetDueCard: amber on the day the period closes,
 * red every day after, until it is sent (dueTimesheet decides).
 *
 *   buildPayPeriod(src)        pure: the facts in, every figure and line out.
 *                              The design check and the tests feed it samples.
 *   loadHomePayPeriod(id, now) reads the facts for one person on the server.
 *                              A read that fails comes back as { ok: false },
 *                              so the card says so instead of showing zeros;
 *                              a period that cannot be set up for the person
 *                              (no Directory entry, no route to an approver)
 *                              as { ok: false, unset: true }, so the card asks
 *                              for the profile to be checked (owner, 25
 *                              October 2026: the card used to be left out).
 *
 * Where each figure comes from:
 *   worked     tc_entries that are not absence (a running clock counts to now)
 *   PTO, sick  tc_entries of kind absence (approved time off writes them),
 *              sick and holiday told apart by the job code's name
 *   holiday    the company holidays the Agenda shows (time-off.ts), credited
 *              with the person's daily hours on a weekday up to today;
 *              employees only: a contractor is paid for hours worked
 *   expected   weekdays in the period x daily hours (people.weekly_hours / 5,
 *              8h when it is not set)
 *
 * Dates are the person's own calendar days (dir.zoneOf). No amounts: Team
 * Leaders see this card for themselves and money never reaches it.
 */

import { db, loadCadenceChanges, loadClockySettings, loadDirectory, rulesFor } from './clocky-context'
import { loadSubmissions } from './clocky-store'
import { entrySeconds } from './clocky-panel'
import { dateLabel, dayLabel, localDate } from './format'
import { loadRouteSettings, loadRoutes } from './pay-terms'
import { addDays, daysBetween, monthEnd, monthStart, periodContaining, periodLabel } from './periods'
import { currentStep } from './routing'
import { formatDuration } from './rounding'
import { holidaysBetween } from './time-off'
import { dueTimesheet } from './home-timesheet'

type Span = { start: string; end: string }

/** One calendar day's time, in seconds, by kind. */
export interface PayDayTime { worked: number; pto: number; holiday: number; sick: number }

/** The period before the active one, as its chip reads it. */
export interface PrevFacts extends Span {
  /** tc_submissions.state, or the fixed invoice's state for fixed pay; null when never sent. */
  state: string | null
  /** Whose step it waits at, by name. */
  withName: string | null
  /** The contractor's invoice for it was paid on this day. */
  paidOn: string | null
  /** Holds time recorded in the portal (so it has to be sent). */
  logged: boolean
}

/** Everything the card is built from. */
export interface PayPeriodSource {
  today: string
  employee: boolean
  fixedNoTimesheet: boolean
  /** The person's expected seconds on a working day. */
  dailySeconds: number
  current: Span
  next: Span
  prev: PrevFacts
  /** From dueTimesheet: the period still to send, if any. */
  due: { state: 'today' | 'late'; period: Span; days: number } | null
  /** Who approves the timesheet, by name: null when nobody does (recorded only). Employees: Rippling. */
  approver: string | null
  /** day -> time, any day from prev.start to current.end. */
  time: Readonly<Record<string, PayDayTime>>
  /** The company holidays: day -> name. */
  holidays: Readonly<Record<string, string>>
}

export type PayPeriodState = 'running' | 'today' | 'late' | 'sent' | 'fixed'

export interface PayDayView {
  letter: string
  title: string
  /** Bottom up, in px (50px = 8h). Empty: a stub. */
  segs: { h: number; bg: string }[]
  stub: 'work' | 'weekend' | null
  today: boolean
  weekend: boolean
}

export interface PayPeriodView {
  state: PayPeriodState
  band: { title: string; sub: string } | null
  label: 'Pay period' | 'Period to send'
  range: string
  chip: { text: string; dot: string; bg: string } | null
  /** Null for fixed pay with no timesheet. */
  meter: {
    total: string
    expected: string
    stats: { k: string; v: string; fg: string }[]
    fillPct: number
    pace: { pct: number; shift: string } | null
    days: PayDayView[]
    legend: { label: string; bg: string; v: string }[]
  } | null
  footer: { text: string; icon: 'arrow' | 'invoice' }
  nextLine: string | null
}

export type PayPeriodResult = { ok: true; view: PayPeriodView } | { ok: false; unset?: true }

export const KINDS = [
  { key: 'worked', label: 'Worked', bg: '#012358' },
  { key: 'pto', label: 'PTO', bg: '#1E7D7F' },
  { key: 'holiday', label: 'Holiday', bg: '#F2C40A' },
  { key: 'sick', label: 'Sick', bg: '#94C4C5' },
] as const

const LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const HOUR = 3600
const BAR_MAX = 56
/** Within 30 minutes of expected is on pace. */
export const PACE_SLACK = 30 * 60
const NONE: PayDayTime = { worked: 0, pto: 0, holiday: 0, sick: 0 }
const hm = (sec: number) => formatDuration(sec)
const dow = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay()
const isWeekend = (iso: string) => dow(iso) === 0 || dow(iso) === 6
/** "Oct 23" */
const md = (iso: string) => dateLabel(iso).replace(/, \d{4}$/, '')
const daysIn = (p: Span) => { const out: string[] = []; for (let d = p.start; d <= p.end; d = addDays(d, 1)) out.push(d); return out }
const sumOf = (t: PayDayTime) => t.worked + t.pto + t.holiday + t.sick

/** A day's time as the card counts it: nothing after today; a company holiday on a weekday credits the daily hours. */
export function countedDay(src: Pick<PayPeriodSource, 'today' | 'time' | 'holidays' | 'dailySeconds'>, iso: string): PayDayTime {
  if (iso > src.today) return NONE
  const t = src.time[iso] ?? NONE
  if (src.holidays[iso] && !isWeekend(iso) && !t.holiday) return { ...t, holiday: src.dailySeconds }
  return t
}

/** The figures of a period: total, expected, pace and the average per day. */
export function periodFigures(src: Pick<PayPeriodSource, 'today' | 'time' | 'holidays' | 'dailySeconds'>, p: Span) {
  const days = daysIn(p)
  const work = days.filter(d => !isWeekend(d))
  const done = work.filter(d => d < src.today).length
  const sums = { worked: 0, pto: 0, holiday: 0, sick: 0 }
  for (const d of days) { const t = countedDay(src, d); sums.worked += t.worked; sums.pto += t.pto; sums.holiday += t.holiday; sums.sick += t.sick }
  const total = sumOf(sums)
  const expected = work.length * src.dailySeconds
  const byToday = done * src.dailySeconds
  const todayHas = src.today >= p.start && src.today <= p.end && sumOf(countedDay(src, src.today)) > 0
  return {
    sums, total, expected, byToday,
    workingDays: work.length,
    left: work.length - done,
    /** Working days with any time. */
    withTime: work.filter(d => sumOf(countedDay(src, d)) > 0).length,
    behind: Math.max(0, byToday - total),
    onPace: total - byToday >= -PACE_SLACK,
    perDay: Math.round(total / Math.max(1, done + (todayHas ? 1 : 0))),
  }
}

/** Running, closes today, late, sent, or fixed pay. */
export function payPeriodState(src: Pick<PayPeriodSource, 'fixedNoTimesheet' | 'due' | 'prev'>): PayPeriodState {
  if (src.fixedNoTimesheet) return 'fixed'
  if (src.due) return src.due.state
  return src.prev.state === 'submitted' ? 'sent' : 'running'
}

/** The previous period's chip. Null when there is nothing to say about it. */
export function prevChip(prev: PrevFacts, today: string, fixed: boolean): PayPeriodView['chip'] {
  const name = periodLabel(prev).label
  const tone = (text: string, dot: string, bg = '#f4f2ec') => ({ text: `${name}: ${text}`, dot, bg })
  if (prev.paidOn) return tone(`paid ${md(prev.paidOn)}`, '#1E9E6A')
  if (fixed) {
    if (prev.state === 'waiting') return tone(prev.withName ? `with ${prev.withName}` : 'waiting', '#e0940e')
    if (prev.state === 'approved') return tone('approved', '#1E9E6A')
    return null
  }
  if (prev.state === 'submitted') return tone(prev.withName ? `sent, with ${prev.withName}` : 'sent', '#1E7D7F', '#eaf4f4')
  if (prev.state === 'hours_approved') return tone(prev.withName ? `with ${prev.withName}` : 'waiting', '#e0940e')
  if (prev.state === 'approved') return tone('approved', '#1E9E6A')
  if (prev.state === 'recorded') return tone('recorded', '#1E9E6A')
  if (prev.logged) {
    const n = daysBetween(prev.end, today)
    return tone(`not sent, ${n} day${n === 1 ? '' : 's'} late`, '#c8323d')
  }
  return null
}

function dayViews(src: PayPeriodSource, p: Span): PayDayView[] {
  return daysIn(p).map(d => {
    const weekend = isWeekend(d)
    const future = d > src.today
    const t = countedDay(src, d)
    // 50px = 8h; a long day stops at 56px, the room the 74px row leaves above the letter.
    const tall = sumOf(t) / (8 * HOUR) * 50
    const scale = tall > BAR_MAX ? BAR_MAX / tall : 1
    const segs = KINDS.map(k => ({ h: Math.round((t[k.key] / (8 * HOUR)) * 50 * scale), bg: k.bg })).filter(s => s.h > 0)
    const parts = KINDS.filter(k => t[k.key] > 0).map(k => `${k.label} ${hm(t[k.key])}`)
    return {
      letter: LETTER[dow(d)],
      title: `${md(d)}: ${parts.join(', ') || (future ? 'not yet' : 'nothing logged')}`,
      segs,
      stub: segs.length ? null : weekend ? 'weekend' : 'work',
      today: d === src.today,
      weekend,
    }
  })
}

export function buildPayPeriod(src: PayPeriodSource): PayPeriodView {
  const state = payPeriodState(src)
  const cur = periodLabel(src.current).label
  const nameOf = src.employee ? 'Rippling' : src.approver

  if (state === 'fixed') {
    return {
      state, band: null, label: 'Pay period', range: cur,
      chip: prevChip(src.prev, src.today, true), meter: null,
      footer: { text: `Your invoice is created on ${md(addDays(src.current.end, 1))}.`, icon: 'invoice' },
      nextLine: null,
    }
  }

  const footer: PayPeriodView['footer'] = src.employee
    ? { text: `Goes to Rippling for payroll when it closes on ${dayLabel(src.current.end)}.`, icon: 'arrow' }
    : { text: src.approver ? `When it closes, ${src.approver} approves it and it becomes your invoice.` : 'When it closes, it is recorded and becomes your invoice.', icon: 'invoice' }

  const shown = src.due ? src.due.period : src.current
  const f = periodFigures(src, shown)
  const r = f.expected ? f.byToday / f.expected : 0
  const base = {
    total: hm(f.total),
    expected: hm(f.expected),
    fillPct: f.expected ? Math.min(100, (f.total / f.expected) * 100) : 0,
    days: dayViews(src, shown),
    legend: KINDS.filter(k => k.key === 'worked' || f.sums[k.key] > 0).map(k => ({ label: k.label, bg: k.bg, v: hm(f.sums[k.key]) })),
  }

  if (src.due) {
    const name = periodLabel(src.due.period).label
    const n = src.due.days
    const after = src.due.state === 'today'
      ? `Next period, ${periodLabel(src.next).label}, starts tomorrow.`
      : `Next period, ${cur}, started ${src.current.start === src.today ? 'today' : dayLabel(src.current.start)}: ${hm(periodFigures(src, src.current).total)} so far.`
    return {
      state,
      band: src.due.state === 'today'
        ? { title: `Your ${name} timesheet closes today`, sub: `${base.total} logged. Check your entries and send it when the day is done.` }
        : { title: `Your ${name} timesheet is ${n} day${n === 1 ? '' : 's'} late`, sub: nameOf ? `${base.total} logged. Send it so ${nameOf} can approve it.` : `${base.total} logged. Send it so it is recorded.` },
      label: 'Period to send', range: name, chip: null,
      meter: {
        ...base, pace: null,
        stats: [
          { k: 'Days with entries', v: `${f.withTime} of ${f.workingDays}`, fg: '#012358' },
          { k: 'Approves', v: nameOf ?? 'Nobody, recorded', fg: '#012358' },
        ],
      },
      footer, nextLine: after,
    }
  }

  return {
    state, band: null, label: 'Pay period', range: cur,
    chip: prevChip(src.prev, src.today, false),
    meter: {
      ...base,
      pace: f.byToday > 0 ? { pct: r * 100, shift: r < 0.12 ? 'translateX(0)' : r > 0.88 ? 'translateX(-100%)' : 'translateX(-50%)' } : null,
      stats: [
        { k: 'Working days left', v: String(f.left), fg: '#012358' },
        { k: 'Pace', v: f.onPace ? 'On pace' : `${hm(f.behind)} behind`, fg: f.onPace ? '#167a52' : '#9a5a00' },
        { k: 'Per day', v: hm(f.perDay), fg: '#012358' },
      ],
    },
    footer, nextLine: null,
  }
}

// ── The read ────────────────────────────────────────────────────────────────

/** 8h when the person's weekly hours are not set. */
export const DEFAULT_DAILY = 8 * HOUR

/** Daily hours from the Directory's weekly hours (Work tab), five days a week. */
export const dailyFrom = (weeklyHours: number | null | undefined): number =>
  weeklyHours && weeklyHours > 0 ? Math.round((weeklyHours / 5) * HOUR) : DEFAULT_DAILY

/** Which kind an absence is, by its job code (Vacation, Sick, Holiday, Jury duty). */
export const absenceKind = (name: string | null | undefined): 'pto' | 'sick' | 'holiday' =>
  /sick/i.test(name ?? '') ? 'sick' : /holiday/i.test(name ?? '') ? 'holiday' : 'pto'

/**
 * The card for one person. Any read that fails is { ok: false }, never a card
 * of zeros; a period that cannot be set up for them is { ok: false, unset: true }.
 */
export async function loadHomePayPeriod(personId: string, now = new Date()): Promise<PayPeriodResult> {
  try {
    return await readPayPeriod(personId, now)
  } catch (e) {
    console.error('[home] pay period:', e instanceof Error ? e.message : e)
    return { ok: false }
  }
}

async function readPayPeriod(personId: string, now: Date): Promise<PayPeriodResult> {
  const c = db()
  const [dir, settings, changes, subs, routes, routeSettings, person] = await Promise.all([
    loadDirectory(), loadClockySettings(), loadCadenceChanges(c, [personId]), loadSubmissions(c, [personId]),
    loadRoutes([personId]), loadRouteSettings(),
    c.from('people').select('weekly_hours').eq('id', personId).maybeSingle(),
  ])
  if (person.error) throw new Error(`Your schedule could not be read: ${person.error.message}`)
  const route = routes.get(personId)
  if (!dir.people.has(personId) || !route) return { ok: false, unset: true }
  const today = localDate(now, dir.zoneOf(personId))
  const fixed = route.paysAs === 'fixed_no_timesheet'
  const rules = rulesFor(personId, changes, settings)
  // Fixed pay with no timesheet is invoiced by the month.
  const current: Span = fixed ? { start: monthStart(today), end: monthEnd(today) } : periodContaining(today, rules)
  const prevDay = addDays(current.start, -1)
  const prev: Span = fixed ? { start: monthStart(prevDay), end: monthEnd(prevDay) } : periodContaining(prevDay, rules)
  const next: Span = fixed ? { start: addDays(current.end, 1), end: monthEnd(addDays(current.end, 1)) } : periodContaining(addDays(current.end, 1), rules)

  const [entries, invoice] = await Promise.all([
    c.from('tc_entries').select('entry_date, started_at, ended_at, duration_seconds, kind, source, jobcode_id')
      .eq('person_id', personId).gte('entry_date', prev.start).lte('entry_date', current.end).limit(5000),
    route.isContractor
      ? c.from('invoices').select('state, paid_on').eq('person_id', personId).eq('period_start', prev.start).eq('period_end', prev.end).order('id', { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])
  if (entries.error) throw new Error(`Time entries could not be read: ${entries.error.message}`)
  if (invoice.error) throw new Error(`The invoice could not be read: ${invoice.error.message}`)
  const rows = entries.data ?? []

  const absenceCodes = [...new Set(rows.filter(r => r.kind === 'absence' && r.jobcode_id != null).map(r => r.jobcode_id as number))]
  const codes = new Map<number, { name: string; kind: string }>()
  if (absenceCodes.length) {
    const { data, error } = await c.from('tc_jobcodes').select('id, name, kind').in('id', absenceCodes)
    if (error) throw new Error(`Time off kinds could not be read: ${error.message}`)
    for (const j of data ?? []) codes.set(j.id, { name: j.name, kind: j.kind })
  }

  const time: Record<string, PayDayTime> = {}
  for (const r of rows) {
    const t = (time[r.entry_date] ??= { worked: 0, pto: 0, holiday: 0, sick: 0 })
    const sec = entrySeconds(r, now)
    if (r.kind !== 'absence') { t.worked += sec; continue }
    const code = r.jobcode_id != null ? codes.get(r.jobcode_id) : undefined
    // Unpaid time off is not time: it never counts toward the period.
    if (code?.kind === 'unpaid') continue
    t[absenceKind(code?.name)] += sec
  }

  const mySubs = subs.get(personId) ?? []
  const logged = (p: Span) => rows.some(r => r.source === 'portal' && r.entry_date >= p.start && r.entry_date <= p.end)
  const due = fixed ? null : dueTimesheet(today, current, prev, mySubs, logged)
  const prevSub = mySubs.find(s => s.start === prev.start && s.end === prev.end)
  const inv = invoice.data as { state: string; paid_on: string | null } | null
  const first = currentStep(route, routeSettings, 'submitted')?.owner ?? null
  const prevState = fixed ? inv?.state ?? null : prevSub?.state ?? null
  const prevOwner = fixed
    ? currentStep(route, routeSettings, 'submitted')?.owner ?? null
    : prevState === 'submitted' || prevState === 'hours_approved' ? currentStep(route, routeSettings, prevState)?.owner ?? null : null

  const view = buildPayPeriod({
    today,
    employee: !route.isContractor,
    fixedNoTimesheet: fixed,
    dailySeconds: dailyFrom(person.data?.weekly_hours == null ? null : Number(person.data.weekly_hours)),
    current, next,
    prev: {
      ...prev, state: prevState, withName: prevOwner ? dir.nameOf(prevOwner) : null,
      paidOn: inv?.state === 'paid' ? inv.paid_on : null, logged: logged(prev),
    },
    due,
    approver: first ? dir.nameOf(first) : null,
    time,
    // Contractors are paid only for hours worked and may work on a holiday within their
    // allowance (owner, 26 October 2026): a holiday credits nothing and changes nothing for them.
    holidays: route.isContractor ? {} : Object.fromEntries(holidaysBetween(prev.start, current.end)),
  })
  return { ok: true, view }
}
