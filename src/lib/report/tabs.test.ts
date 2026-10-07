import { describe, expect, it } from 'vitest'
import { resolveTab, rightsForLevel, tabRights, visibleTabs, type TabRights } from '@/components/report/ReportTabs'
import { REPORT_PEOPLE, REPORT_WORKLOAD } from '@/lib/access/surfaces'
import { canAs } from '@/lib/access/simulate'
import { ruleKey } from '@/lib/access/decide'
import { reportFilter } from './scope'

const keys = (r: TabRights) => visibleTabs(r).map(t => t.key)
const all: TabRights = { overview: true, people: true, workload: true, waits: true, method: true }
const without = (...off: (keyof TabRights)[]): TabRights => ({ ...all, ...Object.fromEntries(off.map(k => [k, false])) })

describe('visibleTabs', () => {
  it('shows each tab only when its row says so', () => {
    expect(keys(without('people', 'workload'))).toEqual(['overview', 'waits', 'method'])
    expect(keys(without('workload'))).toEqual(['overview', 'people', 'waits', 'method'])
    expect(keys(without('overview', 'waits', 'method'))).toEqual(['people', 'workload'])
  })

  // The design check still draws levels: what they gave before the rows existed.
  it('keeps the old level mapping for the design check', () => {
    expect(keys(rightsForLevel(1))).not.toContain('people')
    expect(keys(rightsForLevel(2))).toContain('people')
    expect(keys(rightsForLevel(2))).not.toContain('workload')
    expect(keys(rightsForLevel(3))).toContain('workload')
  })
})

describe('tab ticks on Access levels', () => {
  // The catalogue's starting answers (7 October 2026): Report itself is off for
  // Team Leaders and Users, as it was configured on the day of the move.
  it('starts each level where the portal was', () => {
    const none = { overview: false, people: false, workload: false, waits: false, method: false }
    expect(tabRights(canAs('user'))).toEqual(none)
    expect(tabRights(canAs('team_leader'))).toEqual(none)
    expect(tabRights(canAs('admin'))).toEqual(all)
    expect(tabRights(canAs('super_admin'))).toEqual(all)
  })

  it('lets a Super Admin give Team Leaders the Report and its Workload tab, or take People away', () => {
    const rules = { levels: new Map([[ruleKey('team_leader', 'report'), true], [ruleKey('team_leader', REPORT_WORKLOAD), true], [ruleKey('team_leader', REPORT_PEOPLE), false]]), tools: new Map() }
    expect(tabRights(canAs('team_leader', { rules }))).toEqual({ overview: true, people: false, workload: true, waits: true, method: true })
  })

  it('takes Overview, Where it waits and Method away when their rows are off', () => {
    const rules = { levels: new Map([[ruleKey('admin', 'rp-overview'), false], [ruleKey('admin', 'rp-waits'), false], [ruleKey('admin', 'rp-method'), false]]), tools: new Map() }
    expect(keys(tabRights(canAs('admin', { rules })))).toEqual(['people', 'workload'])
  })
})

describe('resolveTab', () => {
  // Screen 6.6: an admin's link opened by someone without the tab lands on the
  // first tab they have, not on an error page and not on a tab that throws.
  it('sends a tab the person may not see to the first one they may', () => {
    expect(resolveTab('workload', without('workload'))).toBe('overview')
    expect(resolveTab('waits', without('overview', 'waits'))).toBe('people')
  })

  it('honours a tab the person may see', () => {
    expect(resolveTab('workload', all)).toBe('workload')
    expect(resolveTab('method', without('overview'))).toBe('method')
  })

  it('ignores a tab that does not exist, and answers nothing when no tab is open', () => {
    expect(resolveTab('nonsense', all)).toBe('overview')
    expect(resolveTab(undefined, all)).toBe('overview')
    expect(resolveTab('overview', without('overview', 'people', 'workload', 'waits', 'method'))).toBeNull()
  })
})

describe('whose work', () => {
  it('reads nobody, not everybody, for a login linked to no one', () => {
    const r = reportFilter({ scope: 'me', level: 2, meId: null, led: [], ledMembers: new Set() })
    expect(r.filter).toEqual({ personIds: [] })
  })
})
