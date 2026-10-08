import { describe, it, expect } from 'vitest'
import { openTabs, pageRights, relationTo, resolvePageTab } from './page-rights'
import { canAs } from '@/lib/access/simulate'
import { ruleKey } from '@/lib/access/decide'

/**
 * The owner's rules for a person's page (8 October 2026), with the catalogue's
 * starting answers: the person edits their own Personal, sees their own Work
 * and Reports, never their own HR and access; an Admin opens and edits anyone's;
 * a Team Leader opens the pages of the people on the teams they lead, Work tab
 * only; a User opens only their own.
 */

describe('their own page', () => {
  it('edits Personal, sees Work and Reports, at every level', () => {
    for (const level of ['super_admin', 'admin', 'team_leader', 'user'] as const) {
      const r = pageRights(canAs(level), 'own')!
      expect(r.personal && r.personalEdit && r.work && r.reports, level).toBe(true)
    }
  })

  it('never shows HR and access to a User or a Team Leader', () => {
    for (const level of ['team_leader', 'user'] as const) {
      const r = pageRights(canAs(level), 'own')!
      expect(r.hr || r.hrEdit || r.invite || r.resetTwoStep, level).toBe(false)
    }
  })

  it('shows and edits HR and access for whoever keeps it for everyone, without the lock-out actions', () => {
    for (const level of ['super_admin', 'admin'] as const) {
      const r = pageRights(canAs(level), 'own')!
      expect(r.hr && r.hrEdit, level).toBe(true)
      expect(r.invite || r.resetTwoStep, level).toBe(false)
    }
  })

  it('opens their own HR only with the same items that open anyone\'s', () => {
    expect(pageRights((k: string) => k === 'p-hr', 'own')!.hr).toBe(false)
    expect(pageRights((k: string) => k === 'p-any' || k === 'p-hr', 'own')!.hr).toBe(true)
  })

  it('changes their own Work only with the items that change anyone\'s', () => {
    expect(pageRights(canAs('user'), 'own')!.workEdit).toBe(false)
    expect(pageRights(canAs('team_leader'), 'own')!.workEdit).toBe(false)
    expect(pageRights(canAs('admin'), 'own')!.workEdit).toBe(true)
  })
})

describe('someone else\'s page', () => {
  it('opens every tab to an Admin, and edits them, but not the two-step reset', () => {
    const r = pageRights(canAs('admin'), 'other')!
    expect(openTabs(r)).toEqual(['personal', 'work', 'hr', 'reports'])
    expect(r.personalEdit && r.workEdit && r.hrEdit && r.invite).toBe(true)
    expect(r.resetTwoStep).toBe(false)
    expect(pageRights(canAs('super_admin'), 'other')!.resetTwoStep).toBe(true)
  })

  it('opens only the Work tab, read only, to the Team Leader of the person\'s team', () => {
    const r = pageRights(canAs('team_leader'), 'led')!
    expect(openTabs(r)).toEqual(['work'])
    expect(r.workEdit).toBe(false)
  })

  it('does not open to a Team Leader who does not lead the person\'s team', () => {
    expect(pageRights(canAs('team_leader'), 'other')).toBeNull()
  })

  it('never opens to a User', () => {
    expect(pageRights(canAs('user'), 'led')).toBeNull()
    expect(pageRights(canAs('user'), 'other')).toBeNull()
  })

  it('does not open when every tab is off, even with the page itself', () => {
    const off = ['p-personal', 'p-work', 'p-hr', 'p-reports'].map(k => [ruleKey('admin', k), false] as [string, boolean])
    const rules = { levels: new Map(off), tools: new Map() }
    expect(pageRights(canAs('admin', { rules }), 'other')).toBeNull()
  })

  it('never lets an edit item open a tab that is closed', () => {
    const rules = { levels: new Map([[ruleKey('admin', 'p-personal'), false]]), tools: new Map() }
    const r = pageRights(canAs('admin', { rules }), 'other')!
    expect(r.personal).toBe(false)
    expect(r.personalEdit).toBe(false)
  })
})

describe('the tab and the relation', () => {
  it('lands on the tab asked for when it is open, else the first open one', () => {
    const lead = pageRights(canAs('team_leader'), 'led')!
    expect(resolvePageTab('personal', lead)).toBe('work')
    expect(resolvePageTab('hr', pageRights(canAs('admin'), 'other')!)).toBe('hr')
    expect(resolvePageTab(undefined, pageRights(canAs('user'), 'own')!)).toBe('personal')
  })

  it('tells their own page, a led teammate and anyone else apart', () => {
    const led = new Set(['b'])
    expect(relationTo('a', 'a', led)).toBe('own')
    expect(relationTo('a', 'b', led)).toBe('led')
    expect(relationTo('a', 'c', led)).toBe('other')
    expect(relationTo(null, 'a', led)).toBe('other')
  })
})

describe('teams and positions on the page', () => {
  // Lead of a team makes a Team Leader and opens the team's tools, so only a
  // Super Admin changes teams (d-positions, decided 8 October 2026).
  const only = (keys: string[]) => (key: string) => keys.includes(key)

  it('are a Super Admin\'s alone, on anyone\'s page and their own', () => {
    expect(pageRights(canAs('super_admin'), 'other')!.teamsEdit).toBe(true)
    expect(pageRights(canAs('super_admin'), 'own')!.teamsEdit).toBe(true)
    expect(pageRights(canAs('admin'), 'other')!.teamsEdit).toBe(false)
    expect(pageRights(canAs('admin'), 'own')!.teamsEdit).toBe(false)
    expect(pageRights(canAs('team_leader'), 'led')!.teamsEdit).toBe(false)
  })

  it('stay closed to someone given Work editing without d-positions, on their own page too', () => {
    const can = only(['p-any', 'p-led', 'p-work', 'p-work-edit', 'd-edit'])
    expect(pageRights(can, 'own')!.workEdit).toBe(true)
    expect(pageRights(can, 'own')!.teamsEdit).toBe(false)
    expect(pageRights(can, 'other')!.teamsEdit).toBe(false)
  })

  it('never come without Work editing, whatever else is ticked', () => {
    expect(pageRights(only(['p-any', 'p-work', 'd-positions']), 'other')!.teamsEdit).toBe(false)
  })
})
