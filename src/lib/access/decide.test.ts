import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ALIAS, CATALOGUE, CHILDREN, ITEM, TOOL_ITEMS, isLeadPosition } from './catalogue'
import { allowedKeys, decide, impact, levelOf, overlay, ruleKey, type Rules, type Subject } from './decide'
import { NO_RULES } from './simulate'
import { TOOLS } from './tools'
import { RAIL } from './nav'

const T = '2026-10-07'
const seo = 'team-seo'
const writers = 'team-writers'
const tools = (entries: [string, { every?: boolean; teams?: [string, 'team' | 'lead'][] }][]): Rules =>
  ({ levels: new Map(), tools: new Map(entries.map(([k, s]) => [k, { every: !!s.every, teams: new Map(s.teams ?? []) }])) })
const who = (level: Subject['level'], teams: [string, boolean][] = [], exceptions: Subject['exceptions'] = []): Subject =>
  ({ level, teams: new Map(teams), exceptions })

describe('the catalogue', () => {
  it('has unique keys, and every child under a page, a tool or a module', () => {
    expect(new Set(CATALOGUE.map(i => i.key)).size).toBe(CATALOGUE.length)
    for (const i of CATALOGUE) {
      if (!i.parent) { expect(i.kind, i.key).toBe('module'); continue }
      const p = ITEM.get(i.parent)!
      if (i.kind === 'tab' || i.kind === 'action') expect(['page', 'tool'], i.key).toContain(p.kind)
      else expect(p.kind, i.key).toBe('module')
    }
  })

  it('lists every tool of the Tools panel as a tool item, each on its own row', () => {
    expect(TOOL_ITEMS.map(t => t.key).sort()).toEqual(TOOLS.map(t => t.key).sort())
  })

  it('knows every row the rail can draw', () => {
    for (const e of RAIL) {
      if (e.kind === 'rule') continue
      if (e.kind === 'page' && e.surface) expect(ITEM.has(e.surface), e.key).toBe(true)
      if (e.kind === 'hub') for (const g of e.groups) for (const r of g.items) {
        if (r.surface) expect(ITEM.has(ALIAS[r.surface] ?? r.surface), r.key).toBe(true)
        for (const t of r.tools ?? []) expect(ITEM.get(t)?.kind, t).toBe('tool')
      }
    }
  })

  // A key a page asks for that the catalogue does not know is closed to all
  // but Super Admins: this catches the typo before anyone is locked out.
  it('knows every key a page or action asks for', () => {
    const root = join(__dirname, '..', '..')
    const files: string[] = []
    const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(f) && !/\.test\./.test(f)) files.push(p) } }
    walk(join(root, 'app')); walk(join(root, 'components')); walk(join(root, 'lib'))
    const asked = new Set<string>()
    const re = /(?:requireSurface|allowedTo|\.can|canTool|requirePrivileged|requireAdmin)\(\s*'([a-z0-9-]+)'/g
    for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(re)) asked.add(m[1])
    const unknown = [...asked].filter(k => !ITEM.has(ALIAS[k] ?? k))
    expect(unknown).toEqual([])
    expect(asked.size).toBeGreaterThan(30)
  })
})

describe('levels', () => {
  it('keeps Super Admin and Admin as given, and works out the rest from team positions', () => {
    expect(levelOf('super_admin', false)).toBe('super_admin')
    expect(levelOf('admin', true)).toBe('admin')
    expect(levelOf(null, true)).toBe('team_leader')
    expect(levelOf(null, false)).toBe('user')
  })

  it('reads the older positions as Lead', () => {
    for (const p of ['lead', 'founder', 'manager', 'team_leader']) expect(isLeadPosition(p), p).toBe(true)
    for (const p of ['member', 'collaborator', null]) expect(isLeadPosition(p), String(p)).toBe(false)
  })
})

describe('the rule', () => {
  it('gives a Super Admin everything, Super Admin only pages included', () => {
    const open = allowedKeys(who('super_admin'), NO_RULES, { today: T })
    expect(open.has('access-levels')).toBe(true)
    expect(open.has('cs-apis')).toBe(true)
    expect(open.size).toBe(CATALOGUE.length)
  })

  it('never gives anyone else a Super Admin only page', () => {
    for (const level of ['admin', 'team_leader', 'user'] as const) {
      expect(decide(who(level), 'access-levels', NO_RULES, { today: T }).ok, level).toBe(false)
    }
  })

  it('gives everyone the always-on pages', () => {
    for (const k of ['home', 'organization', 'history', 'profile', 'personal-settings']) {
      expect(decide(who('user'), k, NO_RULES, { today: T }).ok, k).toBe(true)
    }
  })

  it('starts each level where the portal was on the day of the move', () => {
    const user = allowedKeys(who('user'), NO_RULES, { today: T })
    const lead = allowedKeys(who('team_leader', [[seo, true]]), NO_RULES, { today: T })
    expect(user.has('report')).toBe(false)
    expect(lead.has('report')).toBe(false)
    expect(user.has('directory')).toBe(false)
    expect(lead.has('directory')).toBe(true)
    expect(lead.has('my-hours')).toBe(false)
  })

  it('closes a tab whose page is closed, whatever its own tick says', () => {
    const d = decide(who('team_leader'), 'report-people', NO_RULES, { today: T })
    expect(d.ok).toBe(false)
    expect(d.reasons[0].text).toBe('Needs Report')
  })

  it('follows a saved tick over the starting answer', () => {
    const rules: Rules = { levels: new Map([[ruleKey('team_leader', 'report'), true]]), tools: new Map() }
    expect(decide(who('team_leader'), 'report', rules, { today: T }).ok).toBe(true)
    expect(decide(who('team_leader'), 'report-people', rules, { today: T }).ok).toBe(true)
  })
})

describe('tools and their teams', () => {
  const lead = who('team_leader', [[seo, true]])
  const member = who('team_leader', [[seo, false], [writers, true]])
  const user = who('user', [[seo, false]])

  it('closes a tool no team may use yet', () => {
    expect(decide(lead, 'href-links', NO_RULES, { today: T }).reasons[0].text).toBe('No team may use it yet')
  })

  it('opens a whole-team tool to everyone on the team whose level has it', () => {
    const rules = tools([['href-links', { teams: [[seo, 'team']] }]])
    expect(decide(lead, 'href-links', rules, { today: T }).ok).toBe(true)
    expect(decide(user, 'href-links', rules, { today: T }).ok).toBe(true)
    expect(decide(who('user', [[writers, false]]), 'href-links', rules, { today: T }).ok).toBe(false)
  })

  it('opens a Leads-only tool to that team\'s Leads alone', () => {
    const rules = tools([['i7-budget', { teams: [[seo, 'lead']] }]])
    expect(decide(lead, 'i7-budget', rules, { today: T }).ok).toBe(true)
    // Lead of Writers, Member of SEO: SEO's list is Leads only.
    expect(decide(member, 'i7-budget', rules, { today: T }).ok).toBe(false)
  })

  // The owner's example: Team Leader has i7, but only the SEO team may use it.
  it('lets the team list narrow what a level allows, for Admins too', () => {
    const rules = tools([['i7-budget', { teams: [[seo, 'team']] }]])
    expect(decide(who('admin', [[seo, true]]), 'i7-budget', rules, { today: T }).ok).toBe(true)
    expect(decide(who('admin', [[writers, true]]), 'i7-budget', rules, { today: T }).ok).toBe(false)
    expect(decide(who('super_admin'), 'i7-budget', rules, { today: T }).ok).toBe(true)
  })

  it('opens an every-team tool to every level that has it, and closes its tabs with it', () => {
    const rules = tools([['i7-budget', { every: true }]])
    expect(decide(who('user'), 'i7-budget', rules, { today: T }).ok).toBe(true)
    expect(decide(who('user'), 'i7-numbers', NO_RULES, { today: T }).ok).toBe(false)
  })
})

describe('exceptions', () => {
  it('opens or closes one item for one person until a date', () => {
    const grant = who('user', [], [{ key: 'report', effect: 'grant', until: '2026-10-31' }])
    expect(decide(grant, 'report', NO_RULES, { today: T }).ok).toBe(true)
    expect(decide(grant, 'report', NO_RULES, { today: '2026-11-01' }).ok).toBe(false)
    const deny = who('admin', [], [{ key: 'report-workload', effect: 'deny', until: null }])
    expect(decide(deny, 'report-workload', NO_RULES, { today: T }).ok).toBe(false)
    expect(decide(deny, 'report-people', NO_RULES, { today: T }).ok).toBe(true)
  })

  it('lets a deny win when a grant and a deny are both open, in either order', () => {
    const a = who('user', [], [{ key: 'report', effect: 'grant', until: null }, { key: 'report', effect: 'deny', until: null }])
    const b = who('user', [], [{ key: 'report', effect: 'deny', until: null }, { key: 'report', effect: 'grant', until: null }])
    expect(decide(a, 'report', NO_RULES, { today: T }).ok).toBe(false)
    expect(decide(b, 'report', NO_RULES, { today: T }).ok).toBe(false)
  })

  it('counts an exception ending today as open all day, and the grant once the deny has expired', () => {
    const p = who('user', [], [{ key: 'report', effect: 'deny', until: '2026-10-08' }, { key: 'report', effect: 'grant', until: null }])
    expect(decide(p, 'report', NO_RULES, { today: '2026-10-08' }).ok).toBe(false)
    expect(decide(p, 'report', NO_RULES, { today: '2026-10-09' }).ok).toBe(true)
  })

  it('keeps the Super-Admin-only items closed to an Admin, whatever is ticked', () => {
    for (const key of ['d-positions', 'd-2fa', 'h-waiting', 'h-reopen']) {
      expect(ITEM.get(key)?.superOnly, key).toBe(true)
      const ticked = { ...NO_RULES, levels: new Map([[ruleKey('admin', key), true]]) }
      expect(decide(who('admin'), key, ticked, { today: T }).ok, key).toBe(false)
    }
  })

  it('never opens a Super Admin only page, or a key the catalogue lost', () => {
    const p = who('admin', [], [
      { key: 'access-levels', effect: 'grant', until: null },
      { key: 'gone-page', effect: 'grant', until: null },
    ])
    expect(decide(p, 'access-levels', NO_RULES, { today: T }).ok).toBe(false)
    expect(decide(p, 'gone-page', NO_RULES, { today: T }).ok).toBe(false)
  })

  it('never opens a tab whose page stays closed', () => {
    const tab = who('user', [], [{ key: 'report-people', effect: 'grant', until: null }])
    expect(decide(tab, 'report-people', NO_RULES, { today: T }).reasons[0].text).toBe('Needs Report')
    const both = who('user', [], [{ key: 'report', effect: 'grant', until: null }, { key: 'report-people', effect: 'grant', until: null }])
    expect(decide(both, 'report-people', NO_RULES, { today: T }).ok).toBe(true)
  })

  it('closes everything inside a page it closes', () => {
    const p = who('admin', [], [{ key: 'directory', effect: 'deny', until: null }])
    for (const k of ['directory', 'd-rates', 'd-edit', 'd-log']) expect(decide(p, k, NO_RULES, { today: T }).ok, k).toBe(false)
  })

  it('opens a tool past its team list for that one person', () => {
    const p = who('user', [[writers, false]], [{ key: 'href-links', effect: 'grant', until: null }])
    const rules = tools([['href-links', { teams: [[seo, 'team']] }]])
    expect(decide(p, 'href-links', rules, { today: T }).ok).toBe(true)
    expect(decide(who('user', [[writers, false]]), 'href-links', rules, { today: T }).ok).toBe(false)
  })

  it('never narrows a Super Admin', () => {
    const sa = who('super_admin', [], [{ key: 'report', effect: 'deny', until: null }])
    expect(decide(sa, 'report', NO_RULES, { today: T }).ok).toBe(true)
  })
})

describe('impact', () => {
  it('names who gains and who loses, and what', () => {
    const people = [{ id: 'a', ...who('team_leader', [[seo, true]]) }, { id: 'b', ...who('user') }]
    const after = overlay(NO_RULES, new Map([[ruleKey('team_leader', 'report'), true]]), new Map())
    const rows = impact(people, NO_RULES, after, { today: T })
    expect(rows.map(r => r.personId)).toEqual(['a'])
    expect(rows[0].gained).toContain('report')
    expect(rows[0].gained).toContain('rp-overview')
    expect(rows[0].lost).toEqual([])
  })

  it('counts nothing for modules, only what can be opened', () => {
    const people = [{ id: 'a', ...who('team_leader', [[seo, true]]) }]
    const after = overlay(NO_RULES, new Map([[ruleKey('team_leader', 'my-hours'), true]]), new Map())
    const [row] = impact(people, NO_RULES, after, { today: T })
    expect(row.gained.some(k => ITEM.get(k)?.kind === 'module')).toBe(false)
    expect(CHILDREN.get('m-hours')?.length).toBeGreaterThan(0)
  })
})

