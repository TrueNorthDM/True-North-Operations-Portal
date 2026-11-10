import { describe, expect, it } from 'vitest'
import { TYPES, type EventType } from './event-rules'
import { TYPE_ICON, TYPE_LOOK, cardOf, comingUp, listDays, look, type AgendaItem } from './model'
import { homeAgenda } from './home'

// One icon and one colour a type, in every place the Agenda draws it (owner, 10 November 2026):
// the List view drew every event with a clock while Home drew the type's own icon.
const TODAY = '2026-11-10', DAY = '2026-11-11'
const item = (type: EventType, team: AgendaItem['team'] = null): AgendaItem => ({ id: `ev:${type}`, k: type === 'milestone' ? 'ms' : 'event', evType: type, a: DAY, b: DAY, title: type, team })
const VIEW = { meId: 'me', superAdmin: false, today: TODAY, zone: 'America/New_York', holidays: new Set<string>() }

describe('a type looks the same everywhere', () => {
  it('has an icon and a colour for each of the nine types', () => {
    for (const t of TYPES) { expect(TYPE_ICON[t.id]).toBeTruthy(); expect(TYPE_LOOK[t.id].bg).toMatch(/^#/) }
    expect(new Set(TYPES.map(t => TYPE_ICON[t.id])).size).toBe(TYPES.length)
  })
  for (const { id } of TYPES.filter(t => t.id !== 'milestone')) {
    it(`draws ${id} with one icon in the List view, Coming up, the card and Home`, () => {
      const x = item(id)
      const want = { d: TYPE_ICON[id], bg: TYPE_LOOK[id].bg, fg: TYPE_LOOK[id].fg }
      const L = look(x)
      expect({ d: L.d, bg: L.bg, fg: L.fg }).toEqual(want)
      const row = listDays([x], DAY, TODAY, () => true)[0].rows[0]
      expect({ d: row.d, bg: row.bg, fg: row.fg }).toEqual(want)
      const up = comingUp([x], TODAY).flatMap(g => g.items)[0]
      expect({ d: up.d, bg: up.bg, fg: up.fg }).toEqual(want)
      const card = cardOf(x, VIEW)
      expect({ d: card.d, bg: card.icBg, fg: card.icFg }).toEqual(want)
      const home = homeAgenda([x], TODAY, 10).events[0]
      expect({ d: home.look.d, bg: home.look.bg, fg: home.look.fg }).toEqual(want)
    })
  }
})
