import { describe, expect, it } from 'vitest'
import { resolveTab, visibleTabs } from '@/components/report/ReportTabs'

describe('visibleTabs', () => {
  // Screen 2.5 counts it exactly: two tabs fewer at level 1.
  it('gives level 1 two tabs fewer than level 3', () => {
    expect(visibleTabs(3).length - visibleTabs(1).length).toBe(2)
  })

  // Control 2.1: level 1 never sees another name, and People is a table of
  // nothing but other people's names.
  it('never shows level 1 the People tab', () => {
    expect(visibleTabs(1).map(t => t.key)).not.toContain('people')
  })

  it('keeps Workload for level 3 alone', () => {
    expect(visibleTabs(2).map(t => t.key)).not.toContain('workload')
    expect(visibleTabs(3).map(t => t.key)).toContain('workload')
  })

  it('always leaves a tab to land on', () => {
    expect(visibleTabs(1)[0].key).toBe('overview')
  })
})

describe('resolveTab', () => {
  // Screen 6.6: an admin's link opened by a level 1 person lands on Overview,
  // not on an error page and not on a tab that throws when it renders.
  it('sends a level that may not see the tab back to Overview', () => {
    expect(resolveTab('workload', 1)).toBe('overview')
    expect(resolveTab('workload', 2)).toBe('overview')
    expect(resolveTab('people', 1)).toBe('overview')
  })

  it('honours a tab the level may see', () => {
    expect(resolveTab('workload', 3)).toBe('workload')
    expect(resolveTab('people', 2)).toBe('people')
  })

  it('ignores a tab that does not exist', () => {
    expect(resolveTab('nonsense', 3)).toBe('overview')
    expect(resolveTab(undefined, 3)).toBe('overview')
  })
})
