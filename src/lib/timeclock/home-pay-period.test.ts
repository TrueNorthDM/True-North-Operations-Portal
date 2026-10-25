import { describe, expect, it } from 'vitest'
import { absenceKind, buildPayPeriod, dailyFrom, payPeriodState, periodFigures, prevChip, type PrevFacts } from './home-pay-period'
import { SAMPLES } from '@/app/design-check/home-pay-period/samples'

const H = 3600
const src = (name: string) => SAMPLES.find(s => s.name === name)!.src
const prev = (x: Partial<PrevFacts> = {}): PrevFacts => ({ start: '2026-10-12', end: '2026-10-25', state: null, withName: null, paidOn: null, logged: true, ...x })

describe('the Pay period card', () => {
  it('expects the working days times the daily hours, 8h when the schedule has none', () => {
    const s = src('Running, employee')
    expect(periodFigures(s, s.current).expected).toBe(80 * H)
    expect(periodFigures({ ...s, dailySeconds: dailyFrom(30) }, s.current).expected).toBe(60 * H)
    expect(dailyFrom(null)).toBe(8 * H)
    expect(dailyFrom(0)).toBe(8 * H)
  })

  it('is on pace within 30 minutes of expected by today, else says how far behind', () => {
    const on = src('Running, employee')
    const f = periodFigures(on, on.current)
    expect(f.byToday).toBe(40 * H)
    expect(f.total).toBe(42 * H + 45 * 60)
    expect(f.onPace).toBe(true)
    expect(periodFigures({ ...on, time: { ...on.time, '2026-10-26': { worked: 0, pto: 0, holiday: 0, sick: 0 }, '2026-10-22': { worked: 7.5 * H, pto: 0, holiday: 0, sick: 0 } } }, on.current).onPace).toBe(true)
    const behind = src('Running, employee, behind')
    expect(buildPayPeriod(behind).meter!.stats[1]).toEqual({ k: 'Pace', v: '4h 00m behind', fg: '#9a5a00' })
    expect(buildPayPeriod(on).meter!.stats[0]).toEqual({ k: 'Working days left', v: '5', fg: '#012358' })
  })

  it('averages per day over the working days gone, and today once it has time', () => {
    const on = src('Running, employee')
    expect(periodFigures(on, on.current).perDay).toBe(Math.round((42.75 * H) / 6))
    const behind = src('Running, employee, behind')
    expect(periodFigures(behind, behind.current).perDay).toBe(Math.round((36 * H) / 5))
  })

  it('credits a company holiday up to today, never the days ahead', () => {
    const m = src('Running, monthly')
    const f = periodFigures(m, m.current)
    expect(f.sums.holiday).toBe(8 * H)
    expect(buildPayPeriod(m).meter!.legend.map(l => l.label)).toEqual(['Worked', 'Holiday'])
  })

  it('takes its state from the timesheet still to send, then from the last one sent', () => {
    expect(payPeriodState(src('Running, employee'))).toBe('running')
    expect(payPeriodState(src('Closes today'))).toBe('today')
    expect(payPeriodState(src('Late'))).toBe('late')
    expect(payPeriodState(src('Sent'))).toBe('sent')
    expect(payPeriodState(src('Fixed pay, no timesheet'))).toBe('fixed')
    expect(payPeriodState({ ...src('Fixed pay, no timesheet'), due: { state: 'late', period: { start: '2026-09-01', end: '2026-09-30' }, days: 3 } })).toBe('fixed')
  })

  it('says the band, the stats and the next period in the two reminder states', () => {
    const today = buildPayPeriod(src('Closes today'))
    expect(today.band).toEqual({ title: 'Your Oct 12 to 25 timesheet closes today', sub: '72h 15m logged. Check your entries and send it when the day is done.' })
    expect(today.meter!.stats).toEqual([{ k: 'Days with entries', v: '9 of 10', fg: '#012358' }, { k: 'Approves', v: 'Arnaldo Oliveira', fg: '#012358' }])
    expect(today.meter!.pace).toBeNull()
    expect(today.nextLine).toBe('Next period, Oct 26 to Nov 8, starts tomorrow.')
    const late = buildPayPeriod(src('Late'))
    expect(late.band!.title).toBe('Your Oct 12 to 25 timesheet is 1 day late')
    expect(late.band!.sub).toBe('72h 15m logged. Send it so Arnaldo Oliveira can approve it.')
    expect(late.nextLine).toBe('Next period, Oct 26 to Nov 8, started today: 2h 45m so far.')
    const emp = buildPayPeriod({ ...src('Late'), employee: true })
    expect(emp.meter!.stats[1].v).toBe('Rippling')
    expect(emp.footer.text).toBe('Goes to Rippling for payroll when it closes on Sun, Nov 8.')
  })

  it('names the previous period in its chip', () => {
    expect(prevChip(prev({ state: 'submitted', withName: 'Dave Sharpe' }), '2026-10-26', false)).toEqual({ text: 'Oct 12 to 25: sent, with Dave Sharpe', dot: '#1E7D7F', bg: '#eaf4f4' })
    expect(prevChip(prev({ state: 'hours_approved', withName: 'Dave Sharpe' }), '2026-10-26', false)?.text).toBe('Oct 12 to 25: with Dave Sharpe')
    expect(prevChip(prev({ start: '2026-10-04', end: '2026-10-17', state: 'approved', paidOn: '2026-10-23' }), '2026-10-26', false)).toEqual({ text: 'Oct 4 to 17: paid Oct 23', dot: '#1E9E6A', bg: '#f4f2ec' })
    expect(prevChip(prev(), '2026-10-26', false)).toEqual({ text: 'Oct 12 to 25: not sent, 1 day late', dot: '#c8323d', bg: '#f4f2ec' })
    expect(prevChip(prev({ logged: false }), '2026-10-26', false)).toBeNull()
    expect(prevChip(prev({ start: '2026-09-01', end: '2026-09-30', state: 'waiting', withName: 'Arnaldo Oliveira' }), '2026-10-26', true)?.text).toBe('September: with Arnaldo Oliveira')
  })

  it('shows fixed pay the month and when its invoice is made, with no hours', () => {
    const v = buildPayPeriod(src('Fixed pay, no timesheet'))
    expect(v).toMatchObject({ range: 'October', meter: null, band: null, footer: { text: 'Your invoice is created on Nov 1.', icon: 'invoice' } })
  })

  it('draws 50px for 8h, a stub on an empty working day, nothing on a weekend, and outlines today', () => {
    const d = buildPayPeriod(src('Running, employee')).meter!.days
    expect(d).toHaveLength(14)
    expect(d[0]).toMatchObject({ letter: 'S', stub: 'weekend', segs: [] })
    expect(d[1]).toMatchObject({ letter: 'M', segs: [{ h: 50, bg: '#012358' }], title: 'Oct 19: Worked 8h 00m' })
    expect(d[5].title).toBe('Oct 23: PTO 8h 00m')
    expect(d[8].today).toBe(true)
    expect(d[9]).toMatchObject({ stub: 'work', title: 'Oct 27: not yet' })
  })

  it('tells sick and holiday time off from the rest by the job code', () => {
    expect(absenceKind('Sick')).toBe('sick')
    expect(absenceKind('Holiday')).toBe('holiday')
    expect(absenceKind('Vacation')).toBe('pto')
    expect(absenceKind(null)).toBe('pto')
  })
})
