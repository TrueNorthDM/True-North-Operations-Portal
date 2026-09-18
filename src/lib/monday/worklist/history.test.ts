import { describe, expect, it } from 'vitest'
import { columnSteps, groupHistory, personIds, shortDate, type HistoryEvent, type HistoryStep } from './history'

// The item the mockups were drawn on: HFA.ai 04/024 on HFA - Publishing.
const STEPS = [
  { people_col: 'people', step_name: 'Staging', position: 1, status_col: 'status33', stages: [{ statusCol: 'status33', dateCol: 'date10' }] },
  { people_col: 'people29', step_name: 'Publishing', position: 5, status_col: 'status31', stages: [{ statusCol: 'status31', dateCol: 'date54' }] },
  { people_col: 'seo2', step_name: 'Href Link', position: 6, status_col: 'href', stages: [{ statusCol: 'href', dateCol: 'setup' }] },
  { people_col: 'extra', step_name: 'Translation', position: 7, status_col: 'tr', stages: null },
]

const step = (key: string, name: string, position: number, owners: number[]): HistoryStep =>
  ({ key, name, position, owners, status: null, statusColor: null, dueTitle: null, due: null })

const ev = (id: string, at: string, stepKey: string | null, event = 'update_column_value'): HistoryEvent =>
  ({ id, event, at, userId: null, column: 'x', from: null, to: 'y', stepKey })

describe('columnSteps', () => {
  it('files the people, status and every stage date column under the step', () => {
    const m = columnSteps(STEPS)
    expect(m.get('people29')).toBe('people29')
    expect(m.get('status31')).toBe('people29')
    expect(m.get('date54')).toBe('people29')
    expect(m.get('setup')).toBe('seo2')
    expect(m.get('tr')).toBe('extra')
    expect(m.get('link8')).toBeUndefined()
  })

  it('takes extra columns for a step, such as the due column the sync recorded', () => {
    expect(columnSteps(STEPS, new Map([['people', ['staging_deadline']]])).get('staging_deadline')).toBe('people')
  })
})

describe('personIds', () => {
  it('reads the accounts out of a people column value, and leaves teams out', () => {
    expect(personIds({ personsAndTeams: [{ id: 12514481, kind: 'person' }, { id: 9, kind: 'team' }] })).toEqual([12514481])
    expect(personIds({})).toEqual([])
    expect(personIds(null)).toEqual([])
  })
})

describe('groupHistory', () => {
  const steps = [step('people', 'Staging', 1, [12699548]), step('people29', 'Publishing', 5, [29399541]), step('seo2', 'Href Link', 6, [12514481]), step('extra', 'Translation', 7, [])]
  const events = [
    ev('1', '2026-09-17T17:28:00Z', 'seo2'),
    ev('2', '2026-09-17T17:28:00Z', null),
    ev('3', '2026-09-17T17:27:00Z', 'people29'),
    ev('4', '2026-09-01T00:00:00Z', 'people29', 'subscribe'),
    ev('5', '2026-07-15T15:26:00Z', 'people'),
  ]

  it("puts the reader's own step first, and nobody else's", () => {
    const g = groupHistory(events, steps, [12514481])
    expect(g.mine.map(x => x.step.name)).toEqual(['Href Link'])
    expect(g.mine[0].events.map(e => e.id)).toEqual(['1'])
  })

  it("orders everyone else's by the latest change, newest first", () => {
    expect(groupHistory(events, steps, [12514481]).others.map(x => x.step.name)).toEqual(['Publishing', 'Staging'])
  })

  it('leaves out a step with nobody on it and nothing in the log', () => {
    expect(groupHistory(events, steps, []).others.map(x => x.step.name)).not.toContain('Translation')
  })

  it('sends changes on no step to the item, and drops the follow and owner noise', () => {
    const g = groupHistory(events, steps, [12514481])
    expect(g.item.map(e => e.id)).toEqual(['2'])
    expect(g.others.flatMap(x => x.events).map(e => e.id)).not.toContain('4')
  })

  it('shows nothing as the reader\'s when they are on no step', () => {
    const g = groupHistory(events, steps, [1])
    expect(g.mine).toEqual([])
    expect(g.others.map(x => x.step.name)).toEqual(['Href Link', 'Publishing', 'Staging'])
  })
})

describe('shortDate', () => {
  const now = new Date('2026-09-18T12:00:00Z')
  it('writes a date the way the rest of the panel does', () => {
    expect(shortDate('2026-09-17', now)).toBe('Sep 17')
    expect(shortDate('2025-12-01', now)).toBe('Dec 1, 2025')
  })
  it('leaves anything that is not a date alone', () => {
    expect(shortDate('Done', now)).toBe('Done')
    expect(shortDate(null, now)).toBeNull()
  })
})
