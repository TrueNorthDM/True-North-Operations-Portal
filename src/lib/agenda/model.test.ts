import { describe, expect, it } from 'vitest'
import { agendaFrame } from '@/app/design-check/clocky-part2/agenda-sample'
import { ALL_TEAMS, KINDS, backOn, cardOf, comingUp, dayKinds, filterItems, weekNumber, linkIn, listDays, monthCells, rangeTitle, stepAnchor, thisWeek, weekModel, type AgendaItem } from './model'
import { daysOf } from './good-news'

// Agenda.dc.html's own sample, seen on Tue, Nov 3, 2026.
const items = agendaFrame('8A').items
const TODAY = '2026-11-03'
const all = new Set(KINDS)
const seesType = (x: AgendaItem) => !!x.type

describe('8A month', () => {
  const cells = monthCells(items, TODAY, TODAY)
  const cell = (d: string) => cells.find(c => c.day === d)!
  it('runs Sunday to Saturday around the month', () => {
    expect(cells[0].day).toBe('2026-11-01')
    expect(cells.at(-1)!.day).toBe('2026-12-05')
    expect(cell('2026-12-01').inMonth).toBe(false)
  })
  it('writes a timed event with its hour, events before milestones', () => {
    expect(cell('2026-11-05').items.map(i => i.label)).toEqual(['11am All-hands'])
    expect(cell('2026-11-13').items.map(i => i.label)).toEqual(['3pm Web sprint review', 'i7 site launch'])
  })
  it('shows who is out on working days only', () => {
    expect(cell('2026-11-06').out.map(o => o.ini)).toEqual(['DS'])
    expect(cell('2026-11-06').outTip).toBe('Dave Sharpe, out')
    const span = monthCells([{ ...items.find(x => x.id === 'o2')!, id: 'x', a: '2026-11-13', b: '2026-11-16' }], TODAY, TODAY)
    expect(span.filter(c => c.out.length).map(c => c.day)).toEqual(['2026-11-13', '2026-11-16'])
  })
})

describe('8A on a phone', () => {
  it('dots a day with each kind on it, in the chips\' order, PTO on weekdays only', () => {
    expect(dayKinds(items, '2026-11-13')).toEqual(['event', 'ms'])
    expect(dayKinds(items, '2026-11-03')).toEqual(['bday'])
    expect(dayKinds(items, '2026-11-11')).toEqual([])
  })
})

describe('the week number (US count)', () => {
  it('starts on Sunday, and week 1 has Jan 1', () => {
    expect(weekNumber('2026-11-22')).toBe(48)
    expect(weekNumber('2026-11-28')).toBe(48)
    expect(weekNumber('2025-12-28')).toBe(1)
    expect(weekNumber('2026-01-03')).toBe(1)
    expect(weekNumber('2026-01-04')).toBe(2)
    expect(weekNumber('2026-12-27')).toBe(1)
  })
})

describe('8B week', () => {
  const wk = weekModel(items, '2026-11-24', TODAY, seesType)
  it('draws time off across its days, with the type for a Super Admin', () => {
    const bar = wk.bars.find(b => b.id === 'o3')!
    expect(bar.label).toBe('Wendy Cacka, out (Vacation)')
    expect(bar.col).toBe('5 / 8')
  })
  it('puts all-day bars on different days in the same row', () => {
    const w = weekModel(items, '2026-11-17', TODAY, seesType)
    expect(w.bars.length).toBe(6)
    // Sun to Sat, one a day except two on Fri: two rows, not six.
    expect(Math.max(...w.bars.map(b => b.row))).toBe(2)
    expect(w.bars.filter(b => b.row === 2).map(b => b.col)).toEqual(['7 / 8'])
  })
  it('places an event by its hours, as drawn', () => {
    const e = wk.cols[2].events[0]
    expect([e.title, e.time, e.top, e.height]).toEqual(['Thanksgiving gratitude call', '1:00 PM to 1:45 PM', 242, 32])
    expect(wk.hours[0]).toBe('8 AM')
    expect(wk.hours.at(-1)).toBe('5 PM')
  })
})

describe('8C list and Coming up', () => {
  it('groups the next 14 days by day', () => {
    const days = listDays(items, TODAY, TODAY, seesType)
    expect(days[0]).toMatchObject({ title: 'Tue, Nov 3', sub: 'Today' })
    expect(days[0].rows[0]).toMatchObject({ label: "Joy Inyele's birthday", sub: 'Birthday', time: 'All day' })
    expect(days.find(d => d.day === '2026-11-09')!.rows.find(r => r.label.startsWith('Justus'))!.sub).toBe('Anniversary')
    expect(days.find(d => d.day === '2026-11-06')!.rows[0].sub).toBe('Vacation · Fri, Nov 6')
  })
  it('lists who is out, celebrations and events', () => {
    const g = comingUp(items, TODAY)
    expect(g.map(x => x.title)).toEqual(['Who is out', 'Birthdays and anniversaries', 'Events and milestones'])
    expect(g[0].items.map(i => `${i.label} ${i.when}`)).toEqual(['Dave Sharpe Nov 6', 'Tina Gennette Nov 9 to Tue, Nov 10'])
  })
  it('names the range on screen', () => {
    expect(rangeTitle('month', TODAY)).toBe('November 2026')
    expect(rangeTitle('week', '2026-11-24')).toBe('Nov 22 to 28, 2026')
    expect(rangeTitle('list', TODAY)).toBe('Nov 3 to 16, 2026')
    expect(stepAnchor('month', '2026-11-30', 1)).toBe('2026-12-01')
  })
})

describe('filters', () => {
  it('keeps a team, its people, and what is for everyone', () => {
    const ids = filterItems(items, all, 'Writers').map(x => x.id)
    expect(ids).toEqual(expect.arrayContaining(['b2', 'a3', 't1', 'e1', 'm1', 'h1']))
    expect(ids).not.toContain('e2')
    expect(ids).not.toContain('o1')
    expect(filterItems(items, new Set(['hol']), ALL_TEAMS).every(x => x.k === 'hol')).toBe(true)
  })
})

describe('8D cards', () => {
  const v = { meId: 'Arnaldo Oliveira', superAdmin: true, today: TODAY, zone: 'America/New_York', holidays: new Set(['2026-11-26', '2026-11-27']) }
  it('says when someone is back, skipping weekends and holidays', () => {
    expect(backOn('2026-11-25', v.holidays)).toBe('2026-11-30')
    const c = cardOf(items.find(x => x.id === 'o3')!, v)
    expect(c.rows.map(r => r.b + r.t)).toEqual(['Wed, Nov 25 to Fri, Nov 27', 'Back on Mon, Nov 30', 'Vacation', 'Web'])
  })
  it('never shows a type the server left out', () => {
    const c = cardOf({ ...items.find(x => x.id === 'o3')!, type: null }, { ...v, superAdmin: false })
    expect(c.rows.some(r => r.b === 'Vacation')).toBe(false)
  })
  it('never writes the year of a birthday', () => {
    const c = cardOf(items.find(x => x.id === 'b1')!, v)
    expect(c.rows[0].b + c.rows[0].t).toBe('Nov 3, today')
  })
  it('writes an event in the viewer\'s zone, with its call', () => {
    const c = cardOf(items.find(x => x.id === 'e1')!, v)
    expect(c.rows[0].b + c.rows[0].t).toBe('Thu, Nov 5, 11:00 AM to 12:00 PM in your time zone (New York)')
    expect(c.button).toEqual({ label: 'Join the call', href: 'https://meet.google.com/tnd-allh-ands' })
  })
})

describe('8F This week', () => {
  it('matches the Home card', () => {
    const w = thisWeek(items, TODAY)
    expect(w.range).toBe('Nov 1 to 7')
    expect(w.out.map(o => `${o.name} ${o.when}`)).toEqual(['Dave Sharpe Nov 6'])
    // Sunday to Saturday, as the title: Justus's Nov 9 is next week.
    expect(w.celebrations.map(o => `${o.name} ${o.when}`)).toEqual(["Joy Inyele's birthday Today"])
    expect(thisWeek(items, '2026-11-09').celebrations.map(o => o.name)).toContain('Justus Tsofa, 4 years at True North')
    expect(w.next).toEqual({ dow: 'Thu', n: 5, title: 'All-hands', sub: '11:00 AM to 12:00 PM · Google Meet' })
  })
})

describe('links and Google', () => {
  it('finds a call link in a place', () => {
    expect(linkIn('Google Meet · meet.google.com/tnd-allh-ands')).toBe('https://meet.google.com/tnd-allh-ands')
    expect(linkIn('https://zoom.us/j/123')).toBe('https://zoom.us/j/123')
    expect(linkIn('Google Meet')).toBeNull()
    expect(linkIn('PO Box 2096, New York')).toBeNull()
  })
  it('reads Google days: all-day ends are exclusive', () => {
    expect(daysOf({ id: 'a', start: { date: '2026-11-14' }, end: { date: '2026-11-15' } })).toMatchObject({ start: '2026-11-14', end: '2026-11-14' })
    expect(daysOf({ id: 'b', start: { dateTime: '2026-11-21T16:00:00+03:00' }, end: { dateTime: '2026-11-21T17:00:00+03:00' } })).toMatchObject({ start: '2026-11-21', end: '2026-11-21' })
  })
})
