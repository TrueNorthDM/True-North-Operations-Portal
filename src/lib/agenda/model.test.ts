import { describe, expect, it } from 'vitest'
import { agendaFrame } from '@/app/design-check/clocky-part2/agenda-sample'
import { ALL_TEAMS, lanesOf, answerCounts, answerOf, countsLabel, durationLabel, otherZonesLabel, KINDS, backOn, cardOf, comingUp, dayKinds, filterItems, weekNumber, linkIn, listDays, monthCells, miniMonth, nowLine, offHours, rangeTitle, stepAnchor, thisWeek, weekModel, WEEK_ROW, type AgendaItem } from './model'
import { daysOf } from '@/lib/integrations/google-calendar'

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
    expect(w.bars.length).toBe(5)
    // Sun to Fri, one a day except two on Fri: two rows, not five.
    expect(Math.max(...w.bars.map(b => b.row))).toBe(2)
    expect(w.bars.filter(b => b.row === 2).map(b => b.col)).toEqual(['7 / 8'])
  })
  it('places an event by its hours, as drawn', () => {
    const e = wk.cols[2].events[0]
    expect([e.title, e.time, e.top, e.height]).toEqual(['Thanksgiving gratitude call', '1:00 PM to 1:45 PM', 13 * WEEK_ROW + 2, 0.75 * WEEK_ROW - 4])
    expect(wk.hours[0]).toBe('12 AM')
    expect(wk.hours.at(-1)).toBe('11 PM')
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
    expect(g.map(x => x.title)).toEqual(['Who is out', 'Events and milestones', 'Birthdays and anniversaries'])
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
    expect(c.meet).toBe('https://meet.google.com/tnd-allh-ands')
    expect(c.button).toBeNull()
  })
  it('keeps the button for a call that is not Google Meet', () => {
    const c = cardOf({ ...items.find(x => x.id === 'e1')!, link: 'https://zoom.us/j/1' }, v)
    expect(c.meet).toBeNull()
    expect(c.button).toEqual({ label: 'Join the call', href: 'https://zoom.us/j/1' })
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

describe('the open card of a drawer event', () => {
  const g = (name: string, answer: 'yes' | 'no' | 'maybe' | 'waiting', zone: string | null = 'America/New_York', organizer = false) =>
    ({ key: name, name, ini: name[0], color: '#ccc', sub: '', answer, zone, organizer })
  it('says how long it lasts', () => {
    expect(durationLabel(1)).toBe('1 hour')
    expect(durationLabel(1.5)).toBe('1 hour 30 minutes')
    expect(durationLabel(0.75)).toBe('45 minutes')
  })
  it('counts the answers without the organizer', () => {
    const n = answerCounts([g('Ana', 'yes', null, true), g('Bo', 'yes'), g('Cy', 'no'), g('Di', 'waiting'), g('Ed', 'waiting')])
    expect(countsLabel(n)).toBe('1 yes · 1 no · 2 waiting')
  })
  it('gives the start for guests in other time zones', () => {
    const s = otherZonesLabel([g('Jonatas Queiroz', 'yes', 'America/Sao_Paulo'), g('Ana Lee', 'yes')], '2026-11-03T15:00:00Z', 'America/New_York')
    expect(s).toBe('12:00 PM in Sao Paulo for Jonatas')
    expect(otherZonesLabel([g('Ana Lee', 'yes')], '2026-11-03T15:00:00Z', 'America/New_York')).toBeNull()
  })
  it('reads Google answers', () => {
    expect(answerOf('accepted')).toBe('yes')
    expect(answerOf('needsAction')).toBe('waiting')
  })
})

describe('events at the same time in the week', () => {
  it('share the width side by side, and a lone event takes it all', () => {
    expect(lanesOf([{ s: 10, e: 11 }, { s: 10.5, e: 11.5 }, { s: 12, e: 13 }])).toEqual([{ lane: 0, lanes: 2 }, { lane: 1, lanes: 2 }, { lane: 0, lanes: 1 }])
  })
  it('reuses a lane that came free', () => {
    expect(lanesOf([{ s: 9, e: 12 }, { s: 9, e: 10 }, { s: 10, e: 11 }])).toEqual([{ lane: 0, lanes: 2 }, { lane: 1, lanes: 2 }, { lane: 1, lanes: 2 }])
  })
})

describe('the line at the current time in the week', () => {
  const wk = { days: ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'], first: 8, last: 17 }
  it('sits in today\'s column at the minute', () => {
    expect(nowLine(wk, { date: '2026-11-03', minutes: 14 * 60 + 30 })).toEqual({ col: 2, top: 6.5 * WEEK_ROW })
  })
  it('is left out off the week or off the hours drawn', () => {
    expect(nowLine(wk, { date: '2026-11-08', minutes: 600 })).toBeNull()
    expect(nowLine(wk, { date: '2026-11-03', minutes: 7 * 60 })).toBeNull()
    expect(nowLine(wk, { date: '2026-11-03', minutes: 17 * 60 + 59 })).not.toBeNull()
    expect(nowLine(wk, { date: '2026-11-03', minutes: 18 * 60 + 1 })).toBeNull()
  })
})

describe('the hours outside work, shaded in the week', () => {
  const hours = { 2: [[420, 660], [780, 1080]] as [number, number][] }
  it('shades before, between and after the blocks', () => {
    expect(offHours('2026-11-03', hours)).toEqual([[0, 7 * WEEK_ROW], [11 * WEEK_ROW, 2 * WEEK_ROW], [18 * WEEK_ROW, 6 * WEEK_ROW]])
  })
  it('shades a day off whole', () => {
    expect(offHours('2026-11-01', hours)).toEqual([[0, 24 * WEEK_ROW]])
  })
})

describe('the small month', () => {
  it('draws the month Sunday to Saturday, with the week shown and today', () => {
    const m = miniMonth('2026-11-20', '2026-11-04', '2026-11-03')
    expect(m.length).toBe(5)
    expect(m[0].days[0]).toEqual({ day: '2026-11-01', n: 1, inMonth: true, today: false })
    expect(m.filter(w => w.shown).map(w => w.start)).toEqual(['2026-11-01'])
    expect(m[0].days[2].today).toBe(true)
    expect(m[4].days.at(-1)).toMatchObject({ day: '2026-12-05', inMonth: false })
  })
})
