import { describe, expect, it } from 'vitest'
import { diffAssignments, keyOf, type AssignmentSnapshot } from './changes'

const NOW = '2026-08-20T12:00:00.000Z'

const row = (o: Partial<AssignmentSnapshot> = {}): AssignmentSnapshot => ({
  item_id: 1,
  people_col: 'people',
  monday_user_id: 42,
  status_text: 'Working on it',
  status_done: false,
  due_date: '2026-09-01',
  item_updated_at: '2026-08-20T09:00:00.000Z',
  ...o,
})

const kinds = (e: { event: string }[]) => e.map(x => x.event)

describe('diffAssignments', () => {
  it('says nothing when nothing changed', () => {
    expect(diffAssignments(7, [row()], [row()], NOW)).toEqual([])
  })

  // Held time is measured from here. Without this event the step can never
  // have one, however long it sits.
  it('records the moment a step lands on somebody', () => {
    const e = diffAssignments(7, [], [row()], NOW)
    expect(kinds(e)).toEqual(['assigned'])
    expect(e[0].to_value).toBe('Working on it')
    expect(e[0].occurred_at).toBe('2026-08-20T09:00:00.000Z')
  })

  it('records a step being taken off somebody', () => {
    const e = diffAssignments(7, [row()], [], NOW)
    expect(kinds(e)).toEqual(['unassigned'])
    expect(e[0].from_value).toBe('Working on it')
  })

  // Monday cannot say when something stopped being true, so the only honest
  // stamp for a disappearance is when we noticed.
  it('dates a disappearance now, not from a stale item stamp', () => {
    expect(diffAssignments(7, [row()], [], NOW)[0].occurred_at).toBe(NOW)
  })

  it('names done rather than leaving it as a status change', () => {
    const e = diffAssignments(7, [row()], [row({ status_text: 'Done', status_done: true })], NOW)
    expect(kinds(e)).toEqual(['done'])
  })

  it('names a reopen too, so delivered can be undone', () => {
    const before = row({ status_text: 'Done', status_done: true })
    const after = row({ status_text: 'Working on it', status_done: false })
    expect(kinds(diffAssignments(7, [before], [after], NOW))).toEqual(['reopened'])
  })

  it('records an ordinary status move', () => {
    const e = diffAssignments(7, [row()], [row({ status_text: 'Stuck' })], NOW)
    expect(kinds(e)).toEqual(['status'])
    expect(e[0]).toMatchObject({ from_value: 'Working on it', to_value: 'Stuck' })
  })

  // On-time delivery has to know which deadline was in force, so a deadline
  // that moved is its own event even when the status moved in the same sync.
  it('keeps a deadline change separate from a status change', () => {
    const e = diffAssignments(7, [row()], [row({ status_text: 'Stuck', due_date: '2026-09-15' })], NOW)
    expect(kinds(e)).toEqual(['status', 'due_date'])
  })

  it('records a deadline being cleared', () => {
    const e = diffAssignments(7, [row()], [row({ due_date: null })], NOW)
    expect(kinds(e)).toEqual(['due_date'])
    expect(e[0]).toMatchObject({ from_value: '2026-09-01', to_value: null })
  })

  // Two people on one step are two rows, and one of them leaving is not the
  // other one leaving.
  it('tracks each person on a shared step separately', () => {
    const before = [row({ monday_user_id: 1 }), row({ monday_user_id: 2 })]
    const after = [row({ monday_user_id: 1, status_text: 'Done', status_done: true })]
    const e = diffAssignments(7, before, after, NOW)
    expect(kinds(e).sort()).toEqual(['done', 'unassigned'])
    expect(e.find(x => x.event === 'unassigned')!.monday_user_id).toBe(2)
  })

  it('tracks two steps of one item separately', () => {
    const before = [row({ people_col: 'writer' }), row({ people_col: 'reviewer' })]
    const after = [row({ people_col: 'writer' }), row({ people_col: 'reviewer', status_text: 'Stuck' })]
    const e = diffAssignments(7, before, after, NOW)
    expect(e).toHaveLength(1)
    expect(e[0].people_col).toBe('reviewer')
  })

  it('falls back to the sync time when Monday gives no stamp', () => {
    expect(diffAssignments(7, [], [row({ item_updated_at: null })], NOW)[0].occurred_at).toBe(NOW)
  })
})

describe('keyOf', () => {
  it('is the same step, item and person, and nothing else', () => {
    expect(keyOf(row())).toBe('1|people|42')
    expect(keyOf(row({ monday_user_id: 43 }))).not.toBe(keyOf(row()))
  })
})
