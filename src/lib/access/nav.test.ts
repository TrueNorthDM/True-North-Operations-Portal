import { describe, it, expect } from 'vitest'
import { buildRail, type ResolvedEntry } from './nav'
import { canAs, rulesWithTools } from './simulate'
import type { AccessLevel } from './catalogue'

// The rail, resolved for each level by the access rule with nothing configured
// beyond the catalogue's starting answers (7 October 2026), and the given tools
// open to every team.

const railFor = (level: AccessLevel, tools: string[] = []) => {
  const can = canAs(level, { teams: [['t1', level === 'team_leader']], rules: rulesWithTools(tools) })
  return buildRail({ can, canTool: can })
}
const keys = (rail: ResolvedEntry[]) => rail.map(e => (e.kind === 'page' ? e.item.key : e.kind === 'hub' ? e.key : '|'))
const hub = (rail: ResolvedEntry[], key: string) =>
  rail.find((e): e is Extract<ResolvedEntry, { kind: 'hub' }> => e.kind === 'hub' && e.key === key)
const rows = (rail: ResolvedEntry[], key: string) => hub(rail, key)?.groups.flatMap(g => g.items.map(i => i.key)) ?? []

describe('the rail', () => {
  it('gives a Super Admin everything, in the handoff order, with two rules', () => {
    expect(keys(railFor('super_admin'))).toEqual(['home', 'my-work', 'my-hours', 'chat', 'emails', '|', 'tools', 'people', '|', 'admin', 'clocky'])
  })

  // A rule with nothing after it is not drawn, so a user sees one rule, not two.
  it('gives a user one rule, and neither Admin, Clocky nor My Hours', () => {
    expect(keys(railFor('user', ['publishing']))).toEqual(['home', 'my-work', 'chat', 'emails', '|', 'tools', 'people'])
  })

  it('leaves Tools off for someone with no tool open, and draws no rule for it', () => {
    const k = keys(railFor('user'))
    expect(k).not.toContain('tools')
    expect(k.filter(x => x === '|')).toHaveLength(1)
  })

  it('gives an Admin the Admin area, but not Access levels, View Stage or Clocky', () => {
    const rail = railFor('admin')
    expect(rows(rail, 'admin')).not.toContain('access-levels')
    expect(rows(rail, 'admin')).not.toContain('view-stage')
    expect(rows(rail, 'admin')).toContain('company-settings')
    expect(keys(rail)).not.toContain('clocky')
  })

  // Settings is in the avatar menu, never on the rail.
  it('never puts Settings on the rail', () => {
    expect(keys(railFor('super_admin'))).not.toContain('settings')
  })

  it('shows only the tools open to them, in their groups', () => {
    const tools = hub(railFor('team_leader', ['href-links', 'publishing']), 'tools')!
    expect(tools.groups.map(g => [g.label, g.items.map(i => i.key)])).toEqual([
      ['SEO Tools', ['href-links']],
      ['Operations', ['publishing']],
    ])
  })

  // Two tools behind one row: either client report shows Client Reports.
  it('shows one Client Reports row for either client report', () => {
    for (const tool of ['i7-budget', 'grant-pass-report']) {
      const ops = hub(railFor('team_leader', [tool]), 'tools')!.groups.find(g => g.label === 'Operations')!
      expect(ops.items.map(i => i.key)).toEqual(['client-reports'])
    }
  })

  // Organization and History are for everyone signed in; the Directory and
  // Human Resources follow their ticks.
  it('gives a user Organization and History, and a Team Leader the Directory too', () => {
    expect(rows(railFor('user'), 'people')).toEqual(['organization', 'history'])
    expect(rows(railFor('team_leader'), 'people')).toEqual(['directory', 'organization', 'history'])
    expect(rows(railFor('admin'), 'people')).toEqual(['directory', 'organization', 'human-resources', 'history'])
  })

  it('lights a hub on every page under its rows', () => {
    const tools = hub(railFor('super_admin'), 'tools')!
    expect(tools.matches).toContain('/ops')
    expect(tools.matches).toContain('/seo')
    expect(hub(railFor('super_admin'), 'admin')!.matches).toContain('/admin')
  })
})
