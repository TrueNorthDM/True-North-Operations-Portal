import { describe, it, expect } from 'vitest'
import {
  stepKey, isStepKey, compareDefault, defaultOrder, teamRanking, pinsFor, moveTo, agreement, displacement,
  cleanSavedOrder, leads, orderTeamFor, canSetOrder, editorTeamFor, updatedWhen, MAX_STEPS,
  type OrderableStep, type Membership,
} from './team-priority'

let nextItem = 100
const step = (o: Partial<OrderableStep> = {}): OrderableStep => ({
  itemId: nextItem++, peopleCol: 'person', mondayUserId: 7, priority: 'medium',
  dueDate: null, dueSuspect: false, itemName: 'Item', ...o,
})

/** Keys a..j, already in the default order, so a test can read a list by letter. */
const D = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']

/** What a leader arranged, saved the way the editor saves it. */
const save = (list: string[], moved: string | null = null) => ({ order: list, pinned: pinsFor(list, D, { moved }) })

describe('stepKey', () => {
  it('names a step by item, people column and Monday account', () => {
    expect(stepKey({ itemId: 5012, peopleCol: 'people4', mondayUserId: 88 })).toBe('5012|people4|88')
    expect(isStepKey('5012|people4|88')).toBe(true)
  })

  it('refuses anything else', () => {
    for (const bad of ['', '5012|people4', 'x|people4|88', '5012||88', '5012|a b|88', 42, null, '1|2|3|4']) {
      expect(isStepKey(bad)).toBe(false)
    }
  })
})

describe('the default order', () => {
  it('is board priority, then the soonest deadline, then the name', () => {
    const late = step({ priority: 'high', dueDate: '2026-08-29', itemName: 'B82' })
    const soon = step({ priority: 'high', dueDate: '2026-09-25', itemName: 'Lead magnet' })
    const medium = step({ priority: 'medium', dueDate: '2026-09-01', itemName: 'Newsletter' })
    const low = step({ priority: 'low', dueDate: '2026-01-01', itemName: 'SOP' })
    expect(defaultOrder([low, medium, soon, late])).toEqual([late, soon, medium, low])
  })

  it('puts steps with no usable date after the dated ones in their band', () => {
    const undated = step({ priority: 'high', dueDate: null, itemName: 'A' })
    const suspect = step({ priority: 'high', dueDate: '0202-08-21', dueSuspect: true, itemName: 'B' })
    const dated = step({ priority: 'high', dueDate: '2027-01-01', itemName: 'Z' })
    expect(defaultOrder([undated, suspect, dated])[0]).toBe(dated)
  })

  it('settles every tie, so the same steps always come out in the same order', () => {
    const one = step({ itemId: 2, itemName: 'Same' })
    const two = step({ itemId: 1, itemName: 'Same' })
    expect(compareDefault(one, two)).toBeGreaterThan(0)
    expect(defaultOrder([one, two])).toEqual(defaultOrder([two, one]))
  })
})

describe('teamRanking', () => {
  it('is the default order when nothing was saved, or the order was reset', () => {
    expect(teamRanking(D, null).keys).toEqual(D)
    expect(teamRanking(D, { order: [], pinned: [] }).keys).toEqual(D)
  })

  it('gives back exactly the list the leader saved', () => {
    const arranged = ['b', 'f', 'c', 'd', 'a', 'e', 'g', 'h', 'i', 'j']
    const r = teamRanking(D, save(arranged))
    expect(r.keys).toEqual(arranged)
    // "b" is still ahead of c, d and e as the default order has it, so only the
    // two steps that broke the order are placed by hand.
    expect([...r.pinned].sort()).toEqual(['a', 'f'])
    expect(r.fresh.size).toBe(0)
  })

  it('moves placed steps up as the work above them is finished', () => {
    const arranged = ['c', 'a', 'b', 'd', 'e', 'f', 'g', 'h', 'i', 'j'] // c pulled to the top
    const saved = save(arranged, 'c')
    expect(saved.pinned).toEqual(['c'])
    // "a" and "b" are done: "c" was third in the saved list only because of them.
    const open = D.filter(k => k !== 'a' && k !== 'b')
    expect(teamRanking(open, saved).keys).toEqual(['c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'])
  })

  it('lets the steps nobody placed follow the default order as it changes', () => {
    const saved = save(['c', 'a', 'b', 'd', 'e', 'f', 'g', 'h', 'i', 'j'], 'c')
    // In Monday, "j" got an earlier deadline than everything else: it is first in
    // the default order now. The placed step keeps its place; "j" is next.
    const today = ['j', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']
    expect(teamRanking(today, saved).keys).toEqual(['c', 'j', 'a', 'b', 'd', 'e', 'f', 'g', 'h', 'i'])
  })

  it('fits new steps in where the default order puts them, and marks them', () => {
    const saved = save(['c', 'a', 'b', 'd', 'e', 'f', 'g', 'h', 'i', 'j'], 'c')
    const today = ['a', 'new1', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']
    const r = teamRanking(today, saved)
    expect(r.keys).toEqual(['c', 'a', 'new1', 'b', 'd', 'e', 'f', 'g', 'h', 'i', 'j'])
    expect([...r.fresh]).toEqual(['new1'])
  })

  it('ignores steps that are no longer open, and duplicates in what was stored', () => {
    const r = teamRanking(['a', 'b'], { order: ['gone', 'b', 'b', 'a'], pinned: ['b', 'gone'] })
    expect(r.keys).toEqual(['b', 'a'])
    expect([...r.pinned]).toEqual(['b'])
  })

  it('keeps a step pushed down below the steps it was put under', () => {
    const arranged = ['b', 'c', 'd', 'a', 'e', 'f', 'g', 'h', 'i', 'j'] // a pushed down to fourth
    const saved = save(arranged, 'a')
    expect(saved.pinned).toEqual(['a'])
    expect(teamRanking(D, saved).keys).toEqual(arranged)
  })
})

describe('pinsFor', () => {
  it('pins nothing when the list is the default order', () => {
    expect(pinsFor(D, D)).toEqual([])
  })

  it('pins only the step that was moved, however far', () => {
    expect(pinsFor(['i', ...D.filter(k => k !== 'i')], D, { moved: 'i' })).toEqual(['i'])
    expect(pinsFor([...D.filter(k => k !== 'a'), 'a'], D, { moved: 'a' })).toEqual(['a'])
  })

  it('pins the step the leader moved when two neighbours swap', () => {
    const swapped = ['b', 'a', ...D.slice(2)]
    expect(pinsFor(swapped, D, { moved: 'b' })).toEqual(['b'])
    expect(pinsFor(swapped, D, { moved: 'a' })).toEqual(['a'])
  })

  it('unpins a step moved back to where the default order has it', () => {
    const there = moveTo(D, 'e', 0)
    const pinned = pinsFor(there, D, { moved: 'e' })
    expect(pinned).toEqual(['e'])
    const back = moveTo(there, 'e', 4)
    expect(back).toEqual(D)
    expect(pinsFor(back, D, { keep: pinned, moved: 'e' })).toEqual([])
  })

  it('keeps a placed step placed even where the default order now agrees with it', () => {
    // "c" was put first; since then its deadline moved and the default order
    // has it first too. Moving something else does not quietly unpin it.
    const today = ['c', 'a', 'b', 'd', 'e', 'f', 'g', 'h', 'i', 'j']
    const moved = moveTo(today, 'j', 1)
    expect(pinsFor(moved, today, { keep: ['c'], moved: 'j' }).sort()).toEqual(['c', 'j'])
  })

  it('keeps an earlier pin pinned when a later move could be read either way', () => {
    // "c" was placed first; then "b" is moved to just under it.
    const first = moveTo(D, 'c', 0)
    const pins1 = pinsFor(first, D, { moved: 'c' })
    expect(pins1).toEqual(['c'])
    const second = moveTo(first, 'b', 1)
    expect(second.slice(0, 3)).toEqual(['c', 'b', 'a'])
    const pins2 = pinsFor(second, D, { keep: pins1, moved: 'b' })
    expect([...pins2].sort()).toEqual(['b', 'c'])
    expect(teamRanking(D, { order: second, pinned: pins2 }).keys).toEqual(second)
  })

  it('always gives back a list that teamRanking reproduces', () => {
    // A fixed shuffle of forty steps, so the check is deterministic.
    const keys = Array.from({ length: 40 }, (_, i) => `k${i}`)
    let seed = 7
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
    const list = [...keys]
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[list[i], list[j]] = [list[j], list[i]]
    }
    const pinned = pinsFor(list, keys, { keep: ['k3', 'k17'], moved: 'k30' })
    expect(pinned).toEqual(expect.arrayContaining(['k3', 'k17']))
    expect(teamRanking(keys, { order: list, pinned }).keys).toEqual(list)
  })

  it('is quick on a team the size of SEO', () => {
    const keys = Array.from({ length: 2000 }, (_, i) => `k${i}`)
    const list = [...keys].reverse()
    const t = performance.now()
    const pinned = pinsFor(list, keys)
    expect(performance.now() - t).toBeLessThan(200)
    expect(pinned).toHaveLength(1999)
  })
})

describe('moveTo', () => {
  it('moves a step up, down, and clamps to the ends', () => {
    expect(moveTo(['a', 'b', 'c'], 'c', 0)).toEqual(['c', 'a', 'b'])
    expect(moveTo(['a', 'b', 'c'], 'a', 1)).toEqual(['b', 'a', 'c'])
    expect(moveTo(['a', 'b', 'c'], 'a', 99)).toEqual(['b', 'c', 'a'])
    expect(moveTo(['a', 'b', 'c'], 'b', -5)).toEqual(['b', 'a', 'c'])
  })

  it('leaves the list alone for a step that is not on it', () => {
    const list = ['a', 'b']
    expect(moveTo(list, 'z', 0)).toBe(list)
  })
})

describe('agreement', () => {
  it('is 100 for the default order and 0 for its reverse', () => {
    expect(agreement(D, D)).toBe(100)
    expect(agreement([...D].reverse(), D)).toBe(0)
  })

  it('never reads 100 once something has moved', () => {
    const keys = Array.from({ length: 1000 }, (_, i) => `k${i}`)
    expect(agreement(moveTo(keys, 'k999', 0), keys)).toBe(99)
  })

  it('is 100 for a list too short to disagree', () => {
    expect(agreement(['a'], ['a'])).toBe(100)
    expect(agreement([], [])).toBe(100)
  })
})

describe('displacement', () => {
  it('is positive for a step moved up and negative for one moved down', () => {
    const d = displacement(['c', 'a', 'b'], ['a', 'b', 'c'])
    expect(d.get('c')).toBe(2)
    expect(d.get('a')).toBe(-1)
  })
})

describe('cleanSavedOrder', () => {
  it('keeps step keys, drops duplicates, and only pins what is on the list', () => {
    expect(cleanSavedOrder(['1|p|2', '3|p|4', '1|p|2'], ['3|p|4', '9|p|9'])).toEqual({ order: ['1|p|2', '3|p|4'], pinned: ['3|p|4'] })
  })

  it('refuses anything that is not two lists of step keys', () => {
    expect(cleanSavedOrder('1|p|2', [])).toBeNull()
    expect(cleanSavedOrder(['1|p|2'], null)).toBeNull()
    expect(cleanSavedOrder(['1|p|2', 'drop table'], [])).toBeNull()
    expect(cleanSavedOrder(new Array(MAX_STEPS + 1).fill('1|p|2'), [])).toBeNull()
  })

  it('accepts an empty order, which is the reset', () => {
    expect(cleanSavedOrder([], [])).toEqual({ order: [], pinned: [] })
  })
})

const m = (o: Partial<Membership>): Membership => ({ teamId: 't', teamName: 'Team', isPrimary: false, position: 'collaborator', ...o })

describe('who leads', () => {
  it('is the team leader or the founder, as on the org chart', () => {
    expect(leads({ position: 'team_leader' })).toBe(true)
    expect(leads({ position: 'founder' })).toBe(true)
    expect(leads({ position: 'collaborator' })).toBe(false)
    expect(leads({ position: null })).toBe(false)
  })

  it('lets a leader set only the teams they lead, and an admin any', () => {
    const jeannette = [m({ teamId: 'seo', position: 'team_leader' }), m({ teamId: 'graphics' })]
    expect(canSetOrder('seo', jeannette, false)).toBe(true)
    expect(canSetOrder('graphics', jeannette, false)).toBe(false)
    expect(canSetOrder('graphics', [], true)).toBe(true)
  })
})

describe('orderTeamFor', () => {
  const stephanie = [
    m({ teamId: 'seo', teamName: 'SEO' }),
    m({ teamId: 'graphics', teamName: 'Graphics', isPrimary: true, position: 'team_leader' }),
  ]

  it('follows the primary team', () => {
    expect(orderTeamFor(stephanie)).toBe('graphics')
  })

  it('follows another of their teams when asked', () => {
    expect(orderTeamFor(stephanie, 'seo')).toBe('seo')
  })

  it('ignores a team they are not on', () => {
    expect(orderTeamFor(stephanie, 'writers')).toBe('graphics')
  })

  it('picks by name when no team is primary, and nothing for nobody on a team', () => {
    expect(orderTeamFor([m({ teamId: 'w', teamName: 'Writers' }), m({ teamId: 'a', teamName: 'Africa' })])).toBe('a')
    expect(orderTeamFor([])).toBeNull()
  })
})

describe('editorTeamFor', () => {
  const teams = [{ id: 'africa', name: 'Africa' }, { id: 'seo', name: 'SEO' }]

  it('opens on the team asked for when this person may set it', () => {
    expect(editorTeamFor(teams, [], 'seo')).toBe('seo')
  })

  it('otherwise opens on their own team, then the first they may set', () => {
    expect(editorTeamFor(teams, [m({ teamId: 'seo', isPrimary: true, position: 'team_leader' })], 'nope')).toBe('seo')
    expect(editorTeamFor(teams, [])).toBe('africa')
    expect(editorTeamFor([], [])).toBeNull()
  })
})

describe('updatedWhen', () => {
  const now = new Date(2026, 8, 16, 15, 0)

  it('says today and yesterday in words', () => {
    expect(updatedWhen(new Date(2026, 8, 16, 10, 32).toISOString(), now)).toBe('today at 10:32 AM')
    expect(updatedWhen(new Date(2026, 8, 15, 16, 5).toISOString(), now)).toBe('yesterday at 4:05 PM')
  })

  it('gives the date otherwise, and the year only when it is not this one', () => {
    expect(updatedWhen(new Date(2026, 8, 2, 9, 0).toISOString(), now)).toBe('Sep 2 at 9:00 AM')
    expect(updatedWhen(new Date(2025, 11, 30, 9, 0).toISOString(), now)).toBe('Dec 30, 2025 at 9:00 AM')
  })
})
