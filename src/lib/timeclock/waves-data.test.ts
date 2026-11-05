import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeDb, type Fake } from '@/lib/directory/__fakes__/db'

// No wave (owner, 5 November 2026, migration 154): what the database readers make of it.
let open = true
vi.mock('./north-time-lock', () => ({ northTimeOpen: async () => open }))
vi.mock('@/lib/access/store', () => ({
  loadSubjects: async () => [
    { id: 'ana', name: 'Ana Lead', level: 'team_leader', teams: new Map(), given: null, profileId: null, status: 'active' },
    { id: 'bo', name: 'Bo User', level: 'user', teams: new Map(), given: null, profileId: null, status: 'active' },
    { id: 'ed', name: 'Ed Wagner', level: 'user', teams: new Map(), given: null, profileId: null, status: 'active' },
    { id: 'jo', name: 'John Huynh', level: 'admin', teams: new Map(), given: null, profileId: null, status: 'active' },
    { id: 'arn', name: 'Arnaldo Oliveira', level: 'super_admin', teams: new Map(), given: 'super_admin', profileId: null, status: 'active' },
  ],
}))

const { loadNoWave, loadRolloutPeople, loadStartDates, startOf } = await import('./waves-data')

let fake: Fake
beforeEach(() => {
  open = true
  fake = fakeDb({
    tc_rollout_waves: [{ wave: 1, starts_on: '2026-11-08' }, { wave: 2, starts_on: '2026-11-22' }],
    tc_rollout_people: [
      { person_id: 'ed', wave: 0, set_by: 'arn' },
      { person_id: 'jo', wave: 0, set_by: 'arn' },
      { person_id: 'bo', wave: 1, set_by: 'arn' },
    ],
  })
})
const c = () => fake.db as never

describe('no wave in the database readers', () => {
  it('loadStartDates leaves them out: the import keeps every TSheets entry of theirs', async () => {
    const starts = await loadStartDates(c())
    expect(starts.has('ed')).toBe(false)
    expect(starts.has('jo')).toBe(false)
    expect(Object.fromEntries(starts)).toEqual({ ana: '2026-11-08', bo: '2026-11-08', arn: '2026-11-08' })
  })

  it('startOf says no wave, with no date, whatever the level, and even while no date is set', async () => {
    expect(await startOf(c(), 'jo', { level: 'admin' })).toEqual({ startsOn: null, noWave: true })
    expect(await startOf(c(), 'ana', { level: 'team_leader' })).toEqual({ startsOn: '2026-11-08', noWave: false })
    fake.tables.tc_rollout_waves = [{ wave: 1, starts_on: null }, { wave: 2, starts_on: null }]
    expect(await startOf(c(), 'ed', { level: 'user' })).toEqual({ startsOn: null, noWave: true })
    expect(await startOf(c(), 'bo', { level: 'user' })).toEqual({ startsOn: null, noWave: false })
  })

  it('loadNoWave finds them, by id or for everyone', async () => {
    expect([...(await loadNoWave(c()))].sort()).toEqual(['ed', 'jo'])
    expect([...(await loadNoWave(c(), ['ed', 'bo']))]).toEqual(['ed'])
    expect((await loadNoWave(c(), [])).size).toBe(0)
  })

  it('the rollout list puts them in no wave, set by whoever moved them', async () => {
    const people = await loadRolloutPeople(c())
    const ed = people.find(p => p.id === 'ed')!
    expect(ed).toMatchObject({ wave: 0, by: 'hand', startsOn: null, setByName: 'Arnaldo Oliveira' })
    expect(people.find(p => p.id === 'ana')).toMatchObject({ wave: 1, by: 'level', setByName: null })
  })
})
