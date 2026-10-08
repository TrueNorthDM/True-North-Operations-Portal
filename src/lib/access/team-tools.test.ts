import { describe, it, expect } from 'vitest'
import { toolsByTeam } from './team-tools'
import type { Rules } from './decide'

const rules = (tools: [string, { every: boolean; teams: [string, 'team' | 'lead'][] }][]): Rules =>
  ({ levels: new Map(), tools: new Map(tools.map(([k, s]) => [k, { every: s.every, teams: new Map(s.teams) }])) })

describe('toolsByTeam (the team cards, from Access levels)', () => {
  it('lists a tool on the teams of its list, with whole team or Leads only', () => {
    const m = toolsByTeam(rules([['href-links', { every: false, teams: [['seo', 'team'], ['web', 'lead']] }]]), ['seo', 'web', 'writers'])
    expect(m.get('seo')).toEqual([{ toolKey: 'href-links', audience: 'all' }])
    expect(m.get('web')).toEqual([{ toolKey: 'href-links', audience: 'lead' }])
    expect(m.get('writers')).toEqual([])
  })

  it('puts an "every team" tool on every card', () => {
    const m = toolsByTeam(rules([['publishing', { every: true, teams: [] }]]), ['a', 'b'])
    expect(m.get('a')).toEqual([{ toolKey: 'publishing', audience: 'all' }])
    expect(m.get('b')).toEqual([{ toolKey: 'publishing', audience: 'all' }])
  })

  it('lists nothing for a tool with no team yet, or a key the catalogue lost', () => {
    const m = toolsByTeam(rules([['gone-tool', { every: true, teams: [] }]]), ['a'])
    expect(m.get('a')).toEqual([])
  })
})
