// The Pay period card's states on the prototype's sample figures (Home
// Final.dc.html, PERIOD and CLOSED): today is Monday, October 26, 2026.

import { addDays } from '@/lib/timeclock/periods'
import { buildPayPeriod, type PayDayTime, type PayPeriodSource, type PayPeriodView, type PrevFacts } from '@/lib/timeclock/home-pay-period'

const M = 60
/** One entry per day from `start`, [worked, pto, holiday, sick] in minutes. */
function days(start: string, list: number[][]): Record<string, PayDayTime> {
  const out: Record<string, PayDayTime> = {}
  list.forEach(([w = 0, p = 0, h = 0, s = 0], i) => { out[addDays(start, i)] = { worked: w * M, pto: p * M, holiday: h * M, sick: s * M } })
  return out
}
const prev = (start: string, end: string, x: Partial<PrevFacts> = {}): PrevFacts => ({ start, end, state: null, withName: null, paidOn: null, logged: true, ...x })

const base = { today: '2026-10-26', employee: false, fixedNoTimesheet: false, dailySeconds: 8 * 3600, due: null, approver: 'Dave Sharpe', holidays: {} }
const contractorNow = { current: { start: '2026-10-26', end: '2026-11-08' }, next: { start: '2026-11-09', end: '2026-11-22' } }
// Oct 12 to 25, as the prototype's Late sample for a contractor.
const closedCon = days('2026-10-12', [[480], [480], [480], [480], [0], [0], [0], [480], [480], [480], [480], [495], [0], [0]])

export const SAMPLES: { name: string; note: string; src: PayPeriodSource }[] = [
  {
    name: 'Running, employee',
    note: 'Admin sample: Oct 18 to 31, PTO on Fri, 2h 45m today. Previous period paid.',
    src: {
      ...base, employee: true, approver: 'Arnaldo Oliveira',
      current: { start: '2026-10-18', end: '2026-10-31' }, next: { start: '2026-11-01', end: '2026-11-14' },
      prev: prev('2026-10-04', '2026-10-17', { state: 'approved', paidOn: '2026-10-23' }),
      time: days('2026-10-18', [[0], [480], [480], [480], [480], [0, 480], [0], [0], [165]]),
    },
  },
  {
    name: 'Running, employee, behind',
    note: 'Employee sample with half a sick day, and nothing logged yet today.',
    src: {
      ...base, employee: true,
      current: { start: '2026-10-18', end: '2026-10-31' }, next: { start: '2026-11-01', end: '2026-11-14' },
      prev: prev('2026-10-04', '2026-10-17', { state: 'hours_approved', withName: 'Dave Sharpe' }),
      time: days('2026-10-18', [[0], [480], [420], [240, 0, 0, 240], [300], [480], [0], [0]]),
    },
  },
  {
    name: 'Closes today',
    note: 'Contractor, Sunday Oct 25: the period\'s last day, not sent.',
    src: {
      ...base, today: '2026-10-25', approver: 'Arnaldo Oliveira',
      current: { start: '2026-10-12', end: '2026-10-25' }, next: { start: '2026-10-26', end: '2026-11-08' },
      prev: prev('2026-09-28', '2026-10-11', { state: 'approved', paidOn: '2026-10-19' }),
      due: { state: 'today', period: { start: '2026-10-12', end: '2026-10-25' }, days: 0 },
      time: closedCon,
    },
  },
  {
    name: 'Late',
    note: 'Contractor, Oct 12 to 25 not sent, 1 day late. The next period started today.',
    src: {
      ...base, approver: 'Arnaldo Oliveira', ...contractorNow,
      prev: prev('2026-10-12', '2026-10-25'),
      due: { state: 'late', period: { start: '2026-10-12', end: '2026-10-25' }, days: 1 },
      time: { ...closedCon, '2026-10-26': { worked: 161 * M, pto: 0, holiday: 0, sick: 0 } },
    },
  },
  {
    name: 'Sent',
    note: 'Contractor, Oct 12 to 25 sent and waiting for Dave Sharpe. The new period started today.',
    src: {
      ...base, ...contractorNow,
      prev: prev('2026-10-12', '2026-10-25', { state: 'submitted', withName: 'Dave Sharpe' }),
      time: { '2026-10-26': { worked: 161 * M, pto: 0, holiday: 0, sick: 0 } },
    },
  },
  {
    name: 'Fixed pay, no timesheet',
    note: 'Contractor paid a fixed amount: the month, and when the invoice is made.',
    src: {
      ...base, fixedNoTimesheet: true, approver: 'Arnaldo Oliveira',
      current: { start: '2026-10-01', end: '2026-10-31' }, next: { start: '2026-11-01', end: '2026-11-30' },
      prev: prev('2026-09-01', '2026-09-30', { state: 'waiting', withName: 'Arnaldo Oliveira', logged: false }),
      time: {},
    },
  },
  {
    name: 'Running, monthly',
    note: 'Someone who submits monthly, in November: Veterans Day credited as Holiday.',
    src: {
      ...base, today: '2026-11-12', approver: 'Arnaldo Oliveira',
      current: { start: '2026-11-01', end: '2026-11-30' }, next: { start: '2026-12-01', end: '2026-12-31' },
      prev: prev('2026-10-01', '2026-10-31', { state: 'submitted', withName: 'Arnaldo Oliveira' }),
      holidays: { '2026-11-11': 'Veterans Day', '2026-11-26': 'Thanksgiving Day' },
      time: days('2026-11-01', [[0], [480], [480], [450], [480], [480], [0], [0], [480], [480], [0], [240]]),
    },
  },
]

export const VIEWS: { name: string; note: string; view: PayPeriodView }[] = SAMPLES.map(s => ({ name: s.name, note: s.note, view: buildPayPeriod(s.src) }))
