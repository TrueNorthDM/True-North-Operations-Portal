import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeDb, type Fake } from '@/lib/directory/__fakes__/db'

// No wave (owner, 5 November 2026, migration 154): what the database readers make of it.
let open = true
vi.mock('./north-time-lock', () => ({ northTimeOpen: async () => open }))
const SUBJECT_BO = { id: 'bo', name: 'Bo User', level: 'user', teams: new Map(), given: null, profileId: null, status: 'active' }
vi.mock('@/lib/access/store', () => ({
  loadSubject: async (_c: unknown, id: string) => (id === 'bo' ? SUBJECT_BO : id === 'lea' ? { ...SUBJECT_BO, id: 'lea', level: 'user', teams: new Map([['t1', true]]) } : null),
  loadSubjects: async () => [
    { id: 'ana', name: 'Ana Lead', level: 'team_leader', teams: new Map(), given: null, profileId: null, status: 'active' },
    { id: 'bo', name: 'Bo User', level: 'user', teams: new Map(), given: null, profileId: null, status: 'active' },
    { id: 'ed', name: 'Ed Wagner', level: 'user', teams: new Map(), given: null, profileId: null, status: 'active' },
    { id: 'jo', name: 'John Huynh', level: 'admin', teams: new Map(), given: null, profileId: null, status: 'active' },
    { id: 'arn', name: 'Arnaldo Oliveira', level: 'super_admin', teams: new Map(), given: 'super_admin', profileId: null, status: 'active' },
  ],
}))

const { loadNoWave, loadRolloutPeople, loadStartDates, startOf, startOfPerson } = await import('./waves-data')

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

describe('the import\'s start dates (audit, 5 November 2026)', () => {
  it('do not depend on the North Time switch: closing it never takes a started wave\'s TSheets hours in again', async () => {
    open = false
    expect(Object.fromEntries(await loadStartDates(c()))).toEqual({ ana: '2026-11-08', bo: '2026-11-08', arn: '2026-11-08' })
  })

  it('a failed read throws, so the import run fails instead of reading "nobody started"', async () => {
    const broken = fakeDb(fake.tables, { fail: ['tc_rollout_waves'] })
    await expect(loadStartDates(broken.db as never)).rejects.toThrow(/rollout dates could not be read/)
  })

  it('a failed read of the people moved by hand throws too', async () => {
    const broken = fakeDb(fake.tables, { fail: ['tc_rollout_people'] })
    await expect(loadStartDates(broken.db as never)).rejects.toThrow(/rollout people could not be read/)
  })
})

describe('startOfPerson (Add time and the week grid for anyone)', () => {
  it('reads the person\'s level and teams as the import does', async () => {
    expect(await startOfPerson(c(), 'bo')).toEqual({ startsOn: '2026-11-08', noWave: false })
    // A Lead of a team is wave 1 whatever their level.
    fake.tables.tc_rollout_people = []
    expect(await startOfPerson(c(), 'lea')).toEqual({ startsOn: '2026-11-08', noWave: false })
    expect(await startOfPerson(c(), 'bo')).toEqual({ startsOn: '2026-11-22', noWave: false })
  })

  it('someone not in the Directory has no start date (and no wave when moved there)', async () => {
    expect(await startOfPerson(c(), 'ghost')).toEqual({ startsOn: null, noWave: false })
    fake.tables.tc_rollout_people.push({ person_id: 'ghost', wave: 0, set_by: 'arn' })
    expect(await startOfPerson(c(), 'ghost')).toEqual({ startsOn: null, noWave: true })
  })
})
