// The prototype's sample, level by level (Home Final.dc.html: C.L, C.PERIOD,
// C.CLOSED, C.MEETS, C.OUT, C.UPCOMING and ppModeOf), in the shapes the real
// components take. Monday, October 26 2026, 10:46 AM in New York.

import { FRAMES } from '@/app/design-check/clocky-clock/sample'
import { SAMPLE, type Level } from '@/app/design-check/home-needs-you/sample'
import { ITEMS } from '@/app/design-check/home-right/sample'
import { addDays } from '@/lib/timeclock/periods'
import { buildPayPeriod, type PayDayTime, type PayPeriodSource, type PayPeriodView, type PrevFacts } from '@/lib/timeclock/home-pay-period'
import type { AgendaItem } from '@/lib/agenda/model'
import type { ClockPanelData } from '@/lib/timeclock/clocky-types'
import type { HomeRow, NeedsYouData } from '@/lib/home/needs-you-model'

export const NOW = '2026-10-26T14:46:00.000Z'
export const TODAY = '2026-10-26'
export type PayMode = 'auto' | 'running' | 'today' | 'late' | 'sent'

/** New York 10:46 AM on Oct 26 is 14:46Z: an hour of the day as an instant. */
const at = (h: number) => new Date(Date.UTC(2026, 9, 26, 4 + Math.floor(h), Math.round((h % 1) * 60))).toISOString()

interface Lvl {
  label: string
  first: string
  clock: { on: boolean; since?: number; job?: string; mins: number }
  kind: 'con' | 'emp'
  /** ppModeOf's Auto. */
  auto: Exclude<PayMode, 'auto'>
}

export const LEVELS: Record<Level, Lvl> = {
  super: { label: 'Super Admin', first: 'Arnaldo', clock: { on: true, since: 8.08, job: 'Leadership · Operations', mins: 161 }, kind: 'con', auto: 'sent' },
  admin: { label: 'Admin', first: 'Dave', clock: { on: false, mins: 0 }, kind: 'emp', auto: 'running' },
  lead: { label: 'Team Leader', first: 'Rock', clock: { on: true, since: 9.33, job: 'AAAF · Social strategy', mins: 86 }, kind: 'con', auto: 'late' },
  emp: { label: 'User · employee', first: 'Tina', clock: { on: false, mins: 0 }, kind: 'emp', auto: 'running' },
  con: { label: 'User · contractor', first: 'Cheyenne', clock: { on: true, since: 7.83, job: 'AAAF · Articles', mins: 176 }, kind: 'con', auto: 'late' },
}

// ── The clock ────────────────────────────────────────────────────────────────

const off = FRAMES.find(f => f.code === '1A')!.data!
const onF = FRAMES.find(f => f.code === '1E')!.data!

export function clockOf(level: Level): ClockPanelData {
  const c = LEVELS[level].clock
  if (!c.on) return { ...off, now: NOW, today: TODAY, todaySeconds: 0, todaySpans: [], safety: null, toConfirm: [] }
  const start = at(c.since!)
  const job = c.job!.replace(' · ', ' › ')
  return {
    ...onF, now: NOW, today: TODAY, todaySeconds: c.mins * 60, todaySpans: [{ start, end: null }], safety: null, toConfirm: [],
    running: { ...onF.running!, label: c.job!, short: job, path: job, isI7: false, missing: [], startedAt: start, startedAtReal: start, sessionStartedAt: start, windowStartedAt: start },
  }
}

// ── The pay period ───────────────────────────────────────────────────────────

const M = 60
/** One entry per day from `start`, [worked, pto, holiday, sick] in minutes. */
function days(start: string, list: number[][]): Record<string, PayDayTime> {
  const out: Record<string, PayDayTime> = {}
  list.forEach(([w = 0, p = 0, h = 0, s = 0], i) => { out[addDays(start, i)] = { worked: w * M, pto: p * M, holiday: h * M, sick: s * M } })
  return out
}
const prev = (start: string, end: string, x: Partial<PrevFacts> = {}): PrevFacts => ({ start, end, state: null, withName: null, paidOn: null, logged: true, ...x })

// C.PERIOD and C.CLOSED. The employees' period runs Oct 18 to 31, the contractors' Oct 26 to Nov 8.
const EMP_DAYS: Record<'admin' | 'emp', number[][]> = {
  admin: [[0], [480], [480], [480], [480], [0, 480], [0], [0]],
  emp: [[0], [480], [480], [240, 0, 0, 240], [480], [480], [0], [0]],
}
const CLOSED: Record<Level, { start: string; end: string; approver: string; days: number[][] }> = {
  super: { start: '2026-10-12', end: '2026-10-25', approver: 'Dave Sharpe', days: [[480], [480], [480], [480], [480], [0], [0], [480], [480], [480], [480], [480], [0], [0]] },
  lead: { start: '2026-10-12', end: '2026-10-25', approver: 'Dave Sharpe', days: [[480], [480], [480], [480], [330], [0], [0], [480], [480], [480], [480], [320], [0], [0]] },
  con: { start: '2026-10-12', end: '2026-10-25', approver: 'Arnaldo Oliveira', days: [[480], [480], [480], [480], [0], [0], [0], [480], [480], [480], [480], [495], [0], [0]] },
  admin: { start: '2026-10-18', end: '2026-10-31', approver: 'Rippling', days: [[0], [480], [480], [480], [480], [0, 480], [0], [0], [480], [480], [480], [480], [480], [0]] },
  emp: { start: '2026-10-18', end: '2026-10-31', approver: 'Rippling', days: [[0], [480], [480], [240, 0, 0, 240], [480], [480], [0], [0], [480], [480], [480], [480], [480], [0]] },
}
const APPROVER: Record<Level, string> = { super: 'Dave Sharpe', admin: 'Rippling', lead: 'Dave Sharpe', emp: 'Rippling', con: 'Arnaldo Oliveira' }

export function payOf(level: Level, mode: PayMode): { view: PayPeriodView; state: Exclude<PayMode, 'auto'> } {
  const L = LEVELS[level]
  const state = mode === 'auto' ? L.auto : mode
  const emp = L.kind === 'emp'
  const cl = CLOSED[level]
  const base = { employee: emp, fixedNoTimesheet: false, dailySeconds: 8 * 3600, holidays: {}, approver: APPROVER[level] }
  const todayTime = { [TODAY]: { worked: L.clock.mins * M, pto: 0, holiday: 0, sick: 0 } }

  let src: PayPeriodSource
  if (state === 'today' || state === 'late') {
    // The period to send: closing today (its last day), or one day late.
    const today = state === 'today' ? cl.end : addDays(cl.end, 1)
    const after = addDays(cl.end, 1)
    src = {
      ...base, today, approver: cl.approver,
      current: state === 'today' ? { start: cl.start, end: cl.end } : { start: after, end: addDays(after, 13) },
      next: state === 'today' ? { start: after, end: addDays(after, 13) } : { start: addDays(after, 14), end: addDays(after, 27) },
      prev: state === 'today' ? prev(addDays(cl.start, -14), addDays(cl.start, -1), { state: 'approved', paidOn: '2026-10-23' }) : prev(cl.start, cl.end),
      due: { state, period: { start: cl.start, end: cl.end }, days: state === 'late' ? 1 : 0 },
      time: { ...days(cl.start, cl.days), ...(state === 'late' && !emp ? { [today]: { worked: L.clock.mins * M, pto: 0, holiday: 0, sick: 0 } } : {}) },
    }
  } else if (emp) {
    src = {
      ...base, today: TODAY,
      current: { start: '2026-10-18', end: '2026-10-31' }, next: { start: '2026-11-01', end: '2026-11-14' },
      prev: prev('2026-10-04', '2026-10-17', { state: 'approved', paidOn: '2026-10-23' }),
      due: null,
      time: { ...days('2026-10-18', EMP_DAYS[level as 'admin' | 'emp']), ...todayTime },
    }
  } else {
    src = {
      ...base, today: TODAY,
      current: { start: '2026-10-26', end: '2026-11-08' }, next: { start: '2026-11-09', end: '2026-11-22' },
      prev: state === 'sent'
        ? prev('2026-10-12', '2026-10-25', { state: 'submitted', withName: cl.approver })
        : level === 'super' ? prev('2026-10-12', '2026-10-25', { state: 'hours_approved', withName: 'Dave Sharpe' }) : prev('2026-10-12', '2026-10-25'),
      due: null,
      time: todayTime,
    }
  }
  return { view: buildPayPeriod(src), state }
}

// ── The Agenda: OUT and UPCOMING for everyone, MEETS by level ───────────────

const MEETS: Record<Level, [number, number, string][]> = {
  super: [[11, 11.5, 'Leadership sync'], [14, 15, 'i7 monthly review']],
  admin: [[11, 11.5, 'Leadership sync'], [15.5, 16, 'Bessemeters kickoff']],
  lead: [[13, 13.5, 'Social team standup']],
  emp: [[10, 10.5, 'Ops weekly'], [14, 14.5, 'i7 call']],
  con: [[12, 12.5, 'Writers check-in']],
}
export function agendaItemsOf(level: Level): AgendaItem[] {
  const rest = ITEMS.filter(i => !(i.k === 'event' && i.a === TODAY))
  const meets: AgendaItem[] = MEETS[level].map(([s, e, title], n) => ({ id: `ev:m${n}`, k: 'event', a: TODAY, b: TODAY, s, e, title, teams: 'Everyone' }) as AgendaItem)
  return [...rest, ...meets]
}

// ── Needs you: the prototype's Requests tab, timesheet and invoice included ─

const mineRow = (key: string, title: string, sub: string, state: 'wait' | 'done', icon: 'requests' | 'clock' | 'client-reports'): HomeRow =>
  ({ key, kind: 'mine', title, sub, due: null, button: 'Open', panel: null, href: icon === 'clock' ? '/clocky-hours' : icon === 'client-reports' ? '/clocky-hours/invoices' : '/requests/time-off', mine: { state, icon } })

export function needsOf(level: Level): NeedsYouData {
  const d = SAMPLE[level]
  if (level === 'super') return { ...d, mine: { rows: [mineRow('r1', 'Your Oct 12 to 25 timesheet', 'With Dave Sharpe since Sun', 'wait', 'clock')], errors: [] } }
  if (level === 'con') return { ...d, mine: { rows: [...d.mine.rows, mineRow('r2', 'September invoice, $2,180.00', 'Paid on Oct 6', 'done', 'client-reports')], errors: [] } }
  return d
}
