import { describe, it, expect } from 'vitest'
import { primaryTeamByPerson } from './primary-team'

const m = (personId: string, name: string, isPrimary = false) => ({ personId, team: { name }, isPrimary })

describe("a person's main team, one rule for every screen", () => {
  it('follows the primary flag', () => {
    expect(primaryTeamByPerson([m('ana', 'Graphics'), m('ana', 'Writers', true)]).get('ana')?.name).toBe('Writers')
  })

  // The Report used to take whichever row came back first.
  it('without a flag, takes the first team by name, whatever the row order', () => {
    const one = primaryTeamByPerson([m('ana', 'Writers'), m('ana', 'Graphics')])
    const two = primaryTeamByPerson([m('ana', 'Graphics'), m('ana', 'Writers')])
    expect(one.get('ana')?.name).toBe('Graphics')
    expect(two.get('ana')?.name).toBe('Graphics')
  })

  it('answers each person apart, and leaves out who is on no team', () => {
    const out = primaryTeamByPerson([m('ana', 'SEO'), m('bo', 'Writers', true), m('bo', 'Art')])
    expect([...out].map(([id, t]) => [id, t.name])).toEqual([['ana', 'SEO'], ['bo', 'Writers']])
    expect(out.has('cy')).toBe(false)
  })
})
