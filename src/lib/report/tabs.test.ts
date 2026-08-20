import { describe, expect, it } from 'vitest'
import { visibleTabs } from '@/components/report/ReportTabs'

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
