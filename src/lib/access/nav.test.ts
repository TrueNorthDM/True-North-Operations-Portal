import { describe, it, expect } from 'vitest'
import { buildRail, type ResolvedEntry } from './nav'
import { directoryLevel, surfaceAllowed } from './surfaces'
import type { RoleType } from '@/lib/auth/tier'

// The rail of the navigation redesign (22 September 2026), resolved for each
// level with nothing configured on Access levels, as a new portal would be.

const railFor = (role: RoleType, grants: string[] = []) => {
  const can = (k: string) => surfaceAllowed(role, k, new Map())
  return buildRail({ can, canTool: k => role === 'admin' || grants.includes(k), level: directoryLevel(can) })
}
const keys = (rail: ResolvedEntry[]) => rail.map(e => (e.kind === 'page' ? e.item.key : e.kind === 'hub' ? e.key : '|'))
const hub = (rail: ResolvedEntry[], key: string) =>
  rail.find((e): e is Extract<ResolvedEntry, { kind: 'hub' }> => e.kind === 'hub' && e.key === key)

describe('the rail', () => {
  it('gives an admin everything, in the handoff order, with two rules', () => {
    expect(keys(railFor('admin'))).toEqual(['home', 'my-work', 'my-hours', 'chat', 'emails', '|', 'tools', 'people', '|', 'admin', 'clocky'])
  })

  // A rule with nothing after it is not drawn, so a user sees one rule, not two.
  it('gives a user one rule, and neither Admin nor Clocky', () => {
    expect(keys(railFor('user', ['publishing']))).toEqual(['home', 'my-work', 'my-hours', 'chat', 'emails', '|', 'tools', 'people'])
  })

  it('leaves Tools off for someone with no tool granted, and draws no rule for it', () => {
    const k = keys(railFor('user'))
    expect(k).not.toContain('tools')
    expect(k.filter(x => x === '|')).toHaveLength(1)
  })

  // Settings left the rail for the avatar menu.
  it('never puts Settings on the rail', () => {
    expect(keys(railFor('admin'))).not.toContain('settings')
  })

  it('shows only the tools a team was granted, in their groups', () => {
    const tools = hub(railFor('team_leader', ['href-links', 'publishing']), 'tools')!
    expect(tools.groups.map(g => [g.label, g.items.map(i => i.key)])).toEqual([
      ['SEO Tools', ['href-links']],
      ['Operations', ['publishing']],
    ])
  })

  // Two grants behind one row: either client report shows Client Reports.
  it('shows one Client Reports row for either client report', () => {
    for (const grant of ['i7-budget', 'grant-pass-report']) {
      const ops = hub(railFor('user', [grant]), 'tools')!.groups.find(g => g.label === 'Operations')!
      expect(ops.items.map(i => i.key)).toEqual(['client-reports'])
    }
  })

  // Human Resources is level 2 and up, on top of its own surface.
  it('keeps Human Resources from a user', () => {
    const people = hub(railFor('user'), 'people')!
    expect(people.groups.flatMap(g => g.items.map(i => i.key))).toEqual(['directory', 'organization'])
  })

  it('lights a hub on every page under its rows', () => {
    const tools = hub(railFor('admin'), 'tools')!
    expect(tools.matches).toContain('/ops')
    expect(tools.matches).toContain('/seo')
    expect(hub(railFor('admin'), 'admin')!.matches).toContain('/admin')
  })
})
