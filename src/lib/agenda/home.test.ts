import { describe, expect, it } from 'vitest'
import { homeAgenda, untilLabel } from './home'
import { AG_ICON, type AgendaItem, type AgendaWho } from './model'

// The handoff's sample day: Monday, October 26, 2026, 10:46 AM.
const TODAY = '2026-10-26'
const NOW = 10 + 46 / 60
const who = (id: string, name: string): AgendaWho => ({ id, name, teamId: null, teamName: null, color: '#9CA3AF' })
const pto = (id: string, name: string, a: string, b: string, type: string | null = null): AgendaItem => ({ id: `pto:${id}`, k: 'pto', a, b, who: who(id, name), type })
const ev = (id: string, a: string, title: string, s?: number, e?: number, teams = 'Everyone'): AgendaItem => ({ id, k: 'event', a, b: a, s, e, title, teams })

const SAMPLE: AgendaItem[] = [
  pto('h', 'Hosea Moturi', '2026-10-23', '2026-10-28'),
  pto('a', 'Amy Prindle', '2026-10-26', '2026-10-26'),
  pto('x', 'Dave Sharpe', '2026-10-27', '2026-10-30'),
  ev('e1', TODAY, 'Ops weekly', 9, 9.5),
  ev('e2', TODAY, 'Leadership sync', 11, 11.5),
  ev('e3', TODAY, 'i7 monthly review', 14, 15),
  ev('e4', '2026-10-27', 'All-hands', 10, 11),
  { id: 'anni:t', k: 'anni', a: '2026-10-29', b: '2026-10-29', who: who('t', 'Tina Gennette'), yrs: 3 },
  { id: 'bday:s', k: 'bday', a: '2026-10-30', b: '2026-10-30', who: who('s', 'Saheed Fidimaye') },
  { id: 'hol:2026-11-11', k: 'hol', a: '2026-11-11', b: '2026-11-11', title: 'Veterans Day', country: 'US' },
]

describe('Out today', () => {
  const { out } = homeAgenda(SAMPLE, TODAY, NOW, id => (id === 'a' ? 'https://x/amy.jpg' : null))
  it('lists who is out today, the one back first', () => {
    expect(out.map(o => [o.name, o.reason, o.until])).toEqual([
      ['Amy Prindle', 'Unavailable', 'today only'],
      ['Hosea Moturi', 'Unavailable', 'until Wed'],
    ])
  })
  it('carries the Directory photo', () => {
    expect(out.map(o => o.avatarUrl)).toEqual(['https://x/amy.jpg', null])
  })
  it('shows the type where the Agenda does, one row a person', () => {
    const r = homeAgenda([pto('a', 'Amy Prindle', TODAY, TODAY, 'Vacation'), { ...pto('a', 'Amy Prindle', TODAY, '2026-10-27', 'Vacation'), id: 'pto:a2' }], TODAY, NOW)
    expect(r.out.map(o => [o.reason, o.until])).toEqual([['Vacation', 'until Tue']])
  })
  it('is empty on a weekend, as the Agenda draws time off', () => {
    expect(homeAgenda([pto('h', 'Hosea Moturi', '2026-10-23', '2026-10-28')], '2026-10-25', NOW).out).toEqual([])
  })
})

describe('untilLabel', () => {
  it('names the weekday within a week, the date past it', () => {
    expect(untilLabel(TODAY, TODAY)).toBe('today only')
    expect(untilLabel('2026-11-01', TODAY)).toBe('until Sun')
    expect(untilLabel('2026-11-02', TODAY)).toBe('until Nov 2')
  })
})

describe('The next 5 events', () => {
  const { events } = homeAgenda(SAMPLE, TODAY, NOW)
  it('puts what is left of today first, then the days after, five in all', () => {
    expect(events.map(e => [e.section, e.top, e.big, e.title, e.sub])).toEqual([
      ['today', 'AM', '11:00', 'Leadership sync', 'Today, 30 min'],
      ['today', 'PM', '2:00', 'i7 monthly review', 'Today, 60 min'],
      ['later', 'Tue', '27', 'All-hands', '10:00 AM, everyone'],
      ['later', 'Thu', '29', 'Tina Gennette, 3 years', 'Work anniversary'],
      ['later', 'Fri', '30', 'Saheed Fidimaye', 'Birthday'],
    ])
  })
  it('keeps an event until it ends', () => {
    expect(homeAgenda(SAMPLE, TODAY, 11.25).events[0].title).toBe('Leadership sync')
    expect(homeAgenda(SAMPLE, TODAY, 11.5).events[0].title).toBe('i7 monthly review')
  })
  it('writes company holidays and team events, and puts today\'s all-day items under Today', () => {
    const r = homeAgenda([
      { id: 'bday:s', k: 'bday', a: TODAY, b: TODAY, who: who('s', 'Saheed Fidimaye') },
      ev('t1', '2026-10-28', 'Social standup', 13, 13.5, 'Social'),
      { id: 'hol:2026-11-11', k: 'hol', a: '2026-11-11', b: '2026-11-11', title: 'Veterans Day', country: 'US' },
    ], TODAY, NOW)
    expect(r.events.map(e => [e.section, e.top, e.big, e.sub])).toEqual([
      ['today', 'Mon', '26', 'Today, birthday'],
      ['later', 'Wed', '28', '1:00 PM, Social'],
      ['later', 'Wed', '11', 'Company holiday'],
    ])
    // The Agenda's own icon for each kind (owner, 29 October 2026).
    expect(r.events[0].look.d).toBe(AG_ICON.gift)
    expect(r.events[1].look.d).toBe(AG_ICON.cal)
    expect(r.events[2].look.flag).toBe('🇺🇸')
  })
  it('leaves time off, the Good News Calendar and other countries\' holidays to /agenda', () => {
    const r = homeAgenda([
      pto('x', 'Dave Sharpe', '2026-10-27', '2026-10-30'),
      { id: 'gn:1', k: 'gn', a: '2026-10-27', b: '2026-10-27', title: 'Good news' },
      { id: 'hol:KE:2026-10-20', k: 'hol', a: '2026-10-28', b: '2026-10-28', title: 'Mashujaa Day', country: 'KE' },
    ], TODAY, NOW)
    expect(r.events).toEqual([])
  })
})
