import { describe, it, expect } from 'vitest'
import { teamTie, leadsTeam, TIE_RANK } from './team-of'

const person = (over: Partial<Parameters<typeof teamTie>[0]> = {}) => ({
  id: 'x', managerId: null, alsoReportsToId: null, teamIds: [] as string[], ...over,
})

const STEPH = 'steph'
const GRAPHICS = new Set(['graphics'])

describe('teamTie', () => {
  it('counts a direct report', () => {
    expect(teamTie(person({ managerId: STEPH }), STEPH, GRAPHICS)).toBe('solid')
  })

  // The case that started this: Cheyenne works on Graphics under Stephanie, but
  // her solid line runs to Writers. Reading manager_id alone hid her.
  it('counts a second reporting line', () => {
    expect(teamTie(person({ managerId: 'clarisse', alsoReportsToId: STEPH }), STEPH, GRAPHICS)).toBe('dotted')
  })

  it('counts somebody on a team this person leads', () => {
    expect(teamTie(person({ managerId: 'clarisse', teamIds: ['graphics'] }), STEPH, GRAPHICS)).toBe('team')
  })

  it('says nothing about somebody with no tie at all', () => {
    expect(teamTie(person({ managerId: 'clarisse', teamIds: ['writers'] }), STEPH, GRAPHICS)).toBeNull()
  })

  it('never puts the leader in their own team', () => {
    expect(teamTie(person({ id: STEPH, teamIds: ['graphics'] }), STEPH, GRAPHICS)).toBeNull()
  })

  // A tie is reported at its strongest, so a direct report is never labelled as
  // merely a teammate.
  it('reports the strongest tie when several hold', () => {
    const both = person({ managerId: STEPH, alsoReportsToId: STEPH, teamIds: ['graphics'] })
    expect(teamTie(both, STEPH, GRAPHICS)).toBe('solid')
    expect(teamTie(person({ alsoReportsToId: STEPH, teamIds: ['graphics'] }), STEPH, GRAPHICS)).toBe('dotted')
  })

  it('finds nobody through a team the person is only a member of', () => {
    expect(teamTie(person({ teamIds: ['graphics'] }), STEPH, new Set())).toBeNull()
  })
})

describe('leadsTeam', () => {
  it('is true for the positions that lead', () => {
    expect(leadsTeam('team_leader')).toBe(true)
    expect(leadsTeam('manager')).toBe(true)
    expect(leadsTeam('founder')).toBe(true)
  })
  it('is false for plain membership or none', () => {
    expect(leadsTeam('collaborator')).toBe(false)
    expect(leadsTeam(null)).toBe(false)
    expect(leadsTeam(undefined)).toBe(false)
  })
})

describe('TIE_RANK', () => {
  it('orders direct reports before the dotted line before the team', () => {
    expect(TIE_RANK.solid).toBeLessThan(TIE_RANK.dotted)
    expect(TIE_RANK.dotted).toBeLessThan(TIE_RANK.team)
  })
})
