import { describe, expect, it } from 'vitest'
import { emailsOf, hoursByDay, leaveDays, leaveTypeFor, matchWorkers, planEntries, sentLeave } from './rippling-rules'

describe('people matched to Rippling workers (owner, 9 November 2026)', () => {
  const workers = [
    { id: 'w-tina', status: 'ACTIVE', work_email: 'Tina@TrueNorthDigitalMarketing.com' },
    { id: 'w-dave', status: 'ACTIVE', work_email: 'dave@goodnews.org', personal_email: 'dave@gmail.com' },
    { id: 'w-old', status: 'TERMINATED', work_email: 'gone@truenorthdigitalmarketing.com' },
    { id: 'w-a', status: 'ACTIVE', work_email: 'shared@x.org' },
    { id: 'w-b', status: 'ACTIVE', work_email: 'shared@x.org' },
    { id: 'w-u', status: 'ACTIVE', user: { emails: [{ value: 'joy@goodnews.org' }] } },
  ]
  it('reads every address of a worker, work first', () => {
    expect(emailsOf(workers[1])).toEqual(['dave@goodnews.org', 'dave@gmail.com'])
    expect(emailsOf(workers[5])).toEqual(['joy@goodnews.org'])
  })
  it('matches by any address, ignoring case', () => {
    const m = matchWorkers([
      { id: 'tina', emails: ['tina@truenorthdigitalmarketing.com'] },
      { id: 'dave', emails: [null, 'dave@gmail.com'] },
      { id: 'joy', emails: ['JOY@goodnews.org'] },
    ], workers)
    expect([...m]).toEqual([['tina', 'w-tina'], ['dave', 'w-dave'], ['joy', 'w-u']])
  })
  it('never guesses: a terminated worker, a shared address or two workers leave the person out', () => {
    const m = matchWorkers([
      { id: 'gone', emails: ['gone@truenorthdigitalmarketing.com'] },
      { id: 'shared', emails: ['shared@x.org'] },
      { id: 'two', emails: ['tina@truenorthdigitalmarketing.com', 'dave@goodnews.org'] },
      { id: 'nobody', emails: ['nobody@x.org'] },
    ], workers)
    expect(m.size).toBe(0)
  })
})

describe('time off to Rippling', () => {
  const types = [{ id: 't-vac', name: 'Vacation' }, { id: 't-sick', name: 'Sick Leave' }, { id: 't-unp', name: 'Unpaid Time Off' }]
  it('maps the three kinds by name', () => {
    expect(leaveTypeFor('Vacation', types)).toBe('t-vac')
    expect(leaveTypeFor('Sick', types)).toBe('t-sick')
    expect(leaveTypeFor('Unpaid Time Off', types)).toBe('t-unp')
  })
  it('has no type for the kinds no longer asked', () => {
    expect(leaveTypeFor('Jury duty', types)).toBeNull()
    expect(leaveTypeFor('Other', types)).toBeNull()
  })
  it('sends one request a day, with the hours only when it is not a full day', () => {
    expect(leaveDays(['2026-11-11', '2026-11-10'], 8)).toEqual([{ day: '2026-11-10', hours: null }, { day: '2026-11-11', hours: null }])
    expect(leaveDays(['2026-11-10'], 4)).toEqual([{ day: '2026-11-10', hours: 4 }])
  })
  it('reads back what was sent, day by day', () => {
    expect([...sentLeave(['2026-11-10:abc123', 'bad', '2026-11-11:def'])]).toEqual([['2026-11-10', 'abc123'], ['2026-11-11', 'def']])
  })
})

describe('hours to Rippling', () => {
  const entries = [
    { entry_date: '2026-11-07', duration_seconds: 3600, kind: 'clock' },
    { entry_date: '2026-11-09', duration_seconds: 4 * 3600, kind: 'clock' },
    { entry_date: '2026-11-09', duration_seconds: 2 * 3600 + 1200, kind: 'manual' },
    { entry_date: '2026-11-10', duration_seconds: 8 * 3600, kind: 'absence' },
    { entry_date: '2026-11-11', duration_seconds: 0, kind: 'clock' },
    { entry_date: '2026-11-12', duration_seconds: 7 * 3600, kind: 'clock' },
  ]
  it('adds each day from the start date on, without time off, to the hundredth', () => {
    expect(hoursByDay(entries, '2026-11-08', '2026-11-21', '2026-11-08')).toEqual({ '2026-11-09': 6.33, '2026-11-12': 7 })
  })
  it('sends nothing before the start date, nor for someone with no start date', () => {
    expect(hoursByDay(entries, '2026-11-08', '2026-11-21', '2026-11-12')).toEqual({ '2026-11-12': 7 })
    expect(hoursByDay(entries, '2026-11-08', '2026-11-21', null)).toEqual({})
  })
  it('changes and removes what was sent instead of adding again', () => {
    const plan = planEntries({ '2026-11-09': { id: 'a', hours: 6.33 }, '2026-11-12': { id: 'b', hours: 6 }, '2026-11-13': { id: 'c', hours: 2 } }, { '2026-11-09': 6.33, '2026-11-12': 7, '2026-11-16': 8 })
    expect(plan).toEqual({ create: [{ day: '2026-11-16', hours: 8 }], update: [{ day: '2026-11-12', id: 'b', hours: 7 }], remove: [{ day: '2026-11-13', id: 'c' }] })
    expect(planEntries(null, { '2026-11-09': 1 })).toEqual({ create: [{ day: '2026-11-09', hours: 1 }], update: [], remove: [] })
  })
})
