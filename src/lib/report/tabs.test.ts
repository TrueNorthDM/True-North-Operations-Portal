import { describe, expect, it } from 'vitest'
import { resolveTab, rightsForLevel, tabRights, visibleTabs } from '@/components/report/ReportTabs'
import { REPORT_PEOPLE, REPORT_WORKLOAD, surfaceAllowed } from '@/lib/access/surfaces'

const keys = (r: Parameters<typeof visibleTabs>[0]) => visibleTabs(r).map(t => t.key)

describe('visibleTabs', () => {
  it('shows People and Workload only when their rows say so', () => {
    expect(keys({ people: false, workload: false })).toEqual(['overview', 'waits', 'method'])
    expect(keys({ people: true, workload: false })).toEqual(['overview', 'people', 'waits', 'method'])
    expect(keys({ people: false, workload: true })).toEqual(['overview', 'workload', 'waits', 'method'])
  })

  it('always leaves a tab to land on', () => {
    expect(visibleTabs({ people: false, workload: false })[0].key).toBe('overview')
  })

  // The design check still draws levels: what they gave before the rows existed.
  it('keeps the old level mapping for the design check', () => {
    expect(keys(rightsForLevel(1))).not.toContain('people')
    expect(keys(rightsForLevel(2))).toContain('people')
    expect(keys(rightsForLevel(2))).not.toContain('workload')
    expect(keys(rightsForLevel(3))).toContain('workload')
  })
})

describe('tab rows on Access levels', () => {
  const none = new Map<string, boolean>()
  const can = (role: Parameters<typeof surfaceAllowed>[0], configured = none) =>
    tabRights(k => surfaceAllowed(role, k, configured))

  // Nothing configured: what the directory levels gave before 18 September 2026.
  it('defaults to what each level had before', () => {
    expect(can('user')).toEqual({ people: false, workload: false })
    expect(can('team_leader')).toEqual({ people: true, workload: false })
    expect(can('admin_assistant')).toEqual({ people: true, workload: true })
    expect(can('admin')).toEqual({ people: true, workload: true })
  })

  it('lets an admin give team leaders the Workload tab, or take People away', () => {
    const set = new Map([[`team_leader:${REPORT_WORKLOAD}`, true], [`team_leader:${REPORT_PEOPLE}`, false]])
    expect(can('team_leader', set)).toEqual({ people: false, workload: true })
  })
})

describe('resolveTab', () => {
  // Screen 6.6: an admin's link opened by someone without the tab lands on
  // Overview, not on an error page and not on a tab that throws.
  it('sends a tab the person may not see back to Overview', () => {
    expect(resolveTab('workload', { people: true, workload: false })).toBe('overview')
    expect(resolveTab('people', { people: false, workload: true })).toBe('overview')
  })

  it('honours a tab the person may see', () => {
    expect(resolveTab('workload', { people: false, workload: true })).toBe('workload')
    expect(resolveTab('people', { people: true, workload: false })).toBe('people')
  })

  it('ignores a tab that does not exist', () => {
    expect(resolveTab('nonsense', { people: true, workload: true })).toBe('overview')
    expect(resolveTab(undefined, { people: true, workload: true })).toBe('overview')
  })
})
