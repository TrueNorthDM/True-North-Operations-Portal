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
    expect(keys(railFor('super_admin'))).toEqual(['home', 'my-work', 'chat', 'emails', '|', 'tools', 'people', '|', 'admin', 'clocky'])
  })

  // Clocky is for every level (16 October 2026: Time entries and the clock),
  // so a user sees it after the second rule; not Admin. My Hours is gone.
  it('gives a user Clocky, but neither Admin nor My Hours', () => {
    expect(keys(railFor('user', ['publishing']))).toEqual(['home', 'my-work', 'chat', 'emails', '|', 'tools', 'people', '|', 'clocky'])
  })

  // A rule with nothing on one side is not drawn, and never two in a row.
  it('leaves Tools off for someone with no tool open, and draws no rule for it', () => {
    const k = keys(railFor('user'))
    expect(k).not.toContain('tools')
    expect(k.some((x, i) => x === '|' && k[i + 1] === '|')).toBe(false)
    expect(k[0]).not.toBe('|')
    expect(k[k.length - 1]).not.toBe('|')
  })

  it('gives an Admin the Admin area and Clocky, but not Access levels or View Stage', () => {
    const rail = railFor('admin')
    expect(rows(rail, 'admin')).not.toContain('access-levels')
    expect(rows(rail, 'admin')).not.toContain('view-stage')
    expect(rows(rail, 'admin')).toContain('company-settings')
    expect(keys(rail)).toContain('clocky')
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

  // The Clocky menu as the design handoff draws it (README "Clocky menu in
  // the rail"), filtered by level.
  // Invoices.dc.html: an employee gets no invoice, so the row is not in their menu.
  it('leaves Invoices out for someone without the invoices fact (an employee)', () => {
    const can = canAs('user', { teams: [['t1', false]], rules: rulesWithTools([]) })
    expect(rows(buildRail({ can, canTool: can, facts: new Set() }), 'clocky')).toEqual(['clocky-hours', 'clocky-reports'])
    expect(rows(buildRail({ can, canTool: can, facts: new Set(['invoices']) }), 'clocky')).toEqual(['clocky-hours', 'clocky-invoices', 'clocky-reports'])
  })

  it('gives each level its Clocky rows, in the designed order', () => {
    expect(rows(railFor('super_admin'), 'clocky')).toEqual(['clocky-hours', 'clocky-approvals', 'clocky-whos-working', 'clocky-invoices', 'clocky-reports', 'clocky-safety', 'clocky-periods', 'clocky-import'])
    expect(rows(railFor('admin'), 'clocky')).toEqual(['clocky-hours', 'clocky-approvals', 'clocky-whos-working', 'clocky-invoices', 'clocky-reports', 'clocky-safety', 'clocky-periods', 'clocky-import'])
    expect(rows(railFor('team_leader'), 'clocky')).toEqual(['clocky-hours', 'clocky-approvals', 'clocky-whos-working', 'clocky-invoices', 'clocky-reports'])
    expect(rows(railFor('user'), 'clocky')).toEqual(['clocky-hours', 'clocky-invoices', 'clocky-reports'])
  })

  it('names the Clocky rows and groups them as designed', () => {
    const clocky = hub(railFor('super_admin'), 'clocky')!
    expect(clocky.groups.map(g => [g.label, g.items.map(i => [i.label, i.href])])).toEqual([
      [null, [['Time entries', '/clocky-hours'], ['Approvals', '/clocky-hours/approvals'], ["Who's working", '/clocky-hours/whos-working'], ['Invoices', '/clocky-hours/invoices'], ['Reports', '/clocky-hours/reports']]],
      ['The module', [['Clock safety', '/clocky-hours/safety'], ['Timesheet periods', '/admin/settings#periods'], ['Import', '/clocky-hours/import']]],
    ])
    expect(clocky.groups[0].items.find(i => i.key === 'clocky-approvals')?.count).toBe('approvals')
    expect(clocky.groups[0].items.find(i => i.key === 'clocky-reports')?.soon).toBe(true)
    expect(clocky.readiness).toBeUndefined()
  })

  it('tells each level what the Clocky hub holds for them', () => {
    expect(hub(railFor('super_admin'), 'clocky')!.hint).toBe("The time module: everyone's hours, and the rules behind them.")
    expect(hub(railFor('admin'), 'clocky')!.hint).toBe("The time module: everyone's hours, and the rules behind them.")
    expect(hub(railFor('team_leader'), 'clocky')!.hint).toBe("Your hours and your team's. Clock in and Who's working also open from the top bar.")
    expect(hub(railFor('user'), 'clocky')!.hint).toBe('Your own hours: what you clocked, and the corrections you asked for. Clock in opens from the top bar.')
  })

  it('lights a hub on every page under its rows', () => {
    const tools = hub(railFor('super_admin'), 'tools')!
    expect(tools.matches).toContain('/ops')
    expect(tools.matches).toContain('/seo')
    expect(hub(railFor('super_admin'), 'admin')!.matches).toContain('/admin')
  })
})
