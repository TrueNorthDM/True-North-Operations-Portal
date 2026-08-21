import { describe, expect, it } from 'vitest'
import { accountsIn, backfillEvents, handoffsFrom, whenOf, type OpenAssignment } from './backfill'

const log = (at: string, columnId: string, prev: unknown, next: unknown) => ({
  id: at,
  event: 'update_column_value',
  data: JSON.stringify({ column_id: columnId, previous_value: prev, value: next }),
  // Monday's microseconds since the epoch, as a string.
  created_at: String(Date.parse(at) * 10000),
  user_id: '1',
})

const people = (...ids: number[]) => ({ personsAndTeams: ids.map(id => ({ id, kind: 'person' })) })

describe('whenOf', () => {
  it('reads Monday microseconds back into an ISO moment', () => {
    expect(whenOf(String(Date.parse('2026-08-01T09:00:00.000Z') * 10000)))
      .toBe('2026-08-01T09:00:00.000Z')
  })

  it('refuses a stamp that is not one', () => {
    expect(whenOf('0')).toBeNull()
    expect(whenOf('not a number')).toBeNull()
  })
})

describe('accountsIn', () => {
  it('reads the people out of a column value', () => {
    expect(accountsIn(people(7, 9))).toEqual([7, 9])
  })

  // A team is not somebody's workload, and the live ingest already skips them.
  it('skips teams', () => {
    expect(accountsIn({ personsAndTeams: [{ id: 7, kind: 'person' }, { id: 3, kind: 'team' }] })).toEqual([7])
  })

  it('survives an empty or broken value', () => {
    expect(accountsIn(null)).toEqual([])
    expect(accountsIn('not json')).toEqual([])
    expect(accountsIn({})).toEqual([])
  })
})

describe('handoffsFrom', () => {
  it('dates a person from when they were added', () => {
    const out = handoffsFrom([log('2026-06-01T00:00:00.000Z', 'writer', null, people(7))], 'writer')
    expect(out.get(7)).toBe('2026-06-01T00:00:00.000Z')
  })

  // Added, removed, added again: they are holding it since the second time,
  // which is the same rule the live diff follows.
  it('takes the last time they landed, not the first', () => {
    const out = handoffsFrom([
      log('2026-06-01T00:00:00.000Z', 'writer', null, people(7)),
      log('2026-06-10T00:00:00.000Z', 'writer', people(7), null),
      log('2026-07-01T00:00:00.000Z', 'writer', null, people(7)),
    ], 'writer')
    expect(out.get(7)).toBe('2026-07-01T00:00:00.000Z')
  })

  it('forgets somebody who was taken off and not put back', () => {
    const out = handoffsFrom([
      log('2026-06-01T00:00:00.000Z', 'writer', null, people(7)),
      log('2026-06-10T00:00:00.000Z', 'writer', people(7), null),
    ], 'writer')
    expect(out.has(7)).toBe(false)
  })

  it('ignores changes to another column', () => {
    const out = handoffsFrom([log('2026-06-01T00:00:00.000Z', 'reviewer', null, people(7))], 'writer')
    expect(out.size).toBe(0)
  })

  it('keeps the person who stayed when a second one was added', () => {
    const out = handoffsFrom([
      log('2026-06-01T00:00:00.000Z', 'writer', null, people(7)),
      log('2026-06-05T00:00:00.000Z', 'writer', people(7), people(7, 9)),
    ], 'writer')
    expect(out.get(7)).toBe('2026-06-01T00:00:00.000Z')
    expect(out.get(9)).toBe('2026-06-05T00:00:00.000Z')
  })

  it('reads events that arrive newest first', () => {
    const out = handoffsFrom([
      log('2026-06-10T00:00:00.000Z', 'writer', people(7), null),
      log('2026-06-01T00:00:00.000Z', 'writer', null, people(7)),
    ], 'writer')
    expect(out.has(7)).toBe(false)
  })
})

describe('backfillEvents', () => {
  const open = (o: Partial<OpenAssignment> = {}): OpenAssignment => ({
    board_id: 1, item_id: 2, people_col: 'writer', monday_user_id: 7,
    status_text: 'Working on it', status_done: false, due_date: '2026-09-01', ...o,
  })

  it('writes an assigned event carrying the step state', () => {
    const [e] = backfillEvents([open()], new Map([[7, '2026-06-01T00:00:00.000Z']]))
    expect(e).toMatchObject({ event: 'assigned', to_value: 'Working on it', occurred_at: '2026-06-01T00:00:00.000Z' })
  })

  // A wrong hand-off date is worse than a missing one: it produces a held
  // time that looks measured.
  it('leaves out anybody Monday could not date', () => {
    expect(backfillEvents([open()], new Map())).toEqual([])
  })

  it('only writes the people who are actually still on the step', () => {
    const events = backfillEvents([open()], new Map([[7, '2026-06-01T00:00:00.000Z'], [9, '2026-06-02T00:00:00.000Z']]))
    expect(events).toHaveLength(1)
    expect(events[0].monday_user_id).toBe(7)
  })
})
