import { describe, it, expect } from 'vitest'
import { fakeDb } from './__fakes__/db'
import { setPersonTeams, takenMailbox, wouldCreateCycle } from './person-writes'

describe('a reporting loop is refused when a manager is saved', () => {
  const db = fakeDb({ people: [
    { id: 'ceo', manager_id: null },
    { id: 'lead', manager_id: 'ceo' },
    { id: 'ana', manager_id: 'lead' },
  ] }).db

  it('allows a manager higher up', async () => {
    expect(await wouldCreateCycle(db, 'ana', 'ceo')).toBe(false)
  })

  it('refuses making someone report to a person under them', async () => {
    expect(await wouldCreateCycle(db, 'ceo', 'ana')).toBe(true)
  })

  it('refuses reporting to yourself', async () => {
    expect(await wouldCreateCycle(db, 'ana', 'ana')).toBe(true)
  })

  it('stops on a loop already in the data instead of spinning', async () => {
    const looped = fakeDb({ people: [{ id: 'a', manager_id: 'b' }, { id: 'b', manager_id: 'a' }, { id: 'c', manager_id: null }] }).db
    expect(await wouldCreateCycle(looped, 'c', 'a')).toBe(true)
  })
})

describe("a person's teams are replaced in one step (migration 099)", () => {
  it('sends every team to set_person_teams in one call, with exactly one primary', async () => {
    const f = fakeDb({})
    await setPersonTeams(f.db, 'ana', [
      { teamId: 't1', position: 'member' },
      { teamId: 't2', position: 'lead', primary: true },
      { teamId: 't3', position: 'team_leader', primary: true },
    ])
    expect(f.rpcs).toEqual([{ fn: 'set_person_teams', args: { p_person: 'ana', p_teams: [
      { team_id: 't1', position: 'member', is_primary: false },
      { team_id: 't2', position: 'lead', is_primary: true },
      { team_id: 't3', position: 'lead', is_primary: false },
    ] } }])
    expect(f.writes).toEqual([]) // never a delete, then an insert
  })

  it('makes the first team primary when none was chosen, and keeps one row per team', async () => {
    const f = fakeDb({})
    await setPersonTeams(f.db, 'ana', [{ teamId: 't1', position: 'member' }, { teamId: 't1', position: 'lead' }, { teamId: '', position: 'member' }])
    expect((f.rpcs[0].args as { p_teams: unknown[] }).p_teams).toEqual([{ team_id: 't1', position: 'lead', is_primary: true }])
  })

  it('says so when the database refuses, so the screen does not report a save', async () => {
    const f = fakeDb({}, { rpcError: 'violates foreign key' })
    await expect(setPersonTeams(f.db, 'ana', [{ teamId: 't1', position: 'member' }])).rejects.toThrow('Nothing changed')
  })
})

describe('one company mailbox belongs to one person (P1)', () => {
  const people = [
    { id: 'ana', email_goodnews: 'ana@goodnewsadvocates.org', email_true_north: null, email_coe: null, email_personal: null },
    { id: 'bo', email_goodnews: null, email_true_north: 'bo@truenorth.com', email_coe: null, email_personal: 'bo@gmail.com' },
  ]

  it('finds an address someone else holds, in any of their columns', async () => {
    const db = fakeDb({ people }).db
    expect(await takenMailbox(db, ['bo@truenorth.com'], null)).toBe('bo@truenorth.com')
    expect(await takenMailbox(db, [null, 'bo@gmail.com'], 'ana')).toBe('bo@gmail.com')
  })

  it('does not count the person being saved', async () => {
    const db = fakeDb({ people }).db
    expect(await takenMailbox(db, ['ana@goodnewsadvocates.org'], 'ana')).toBeNull()
  })

  it('matches whatever the case', async () => {
    const db = fakeDb({ people }).db
    expect(await takenMailbox(db, ['ANA@GoodNewsAdvocates.org'], null)).toBe('ANA@GoodNewsAdvocates.org')
  })

  it('fails closed: a read that fails lets nothing through', async () => {
    const db = fakeDb({ people }, { fail: ['people'] }).db
    expect(await takenMailbox(db, ['new@goodnewsadvocates.org'], null)).toBe('new@goodnewsadvocates.org')
  })

  it('passes a free address', async () => {
    const db = fakeDb({ people }).db
    expect(await takenMailbox(db, ['new@goodnewsadvocates.org', null], null)).toBeNull()
  })
})
