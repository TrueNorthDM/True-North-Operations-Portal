import { describe, expect, it } from 'vitest'
import { STRUCTURE } from './structure-2026'
import { whenToUse } from './structure-2026-seed'

describe('the "When to use" lines of the 2026 structure', () => {
  const names = STRUCTURE.flatMap(c => [c.name, ...c.divisions.flatMap(d => [d.name, ...d.projects.map(p => p.name)]), ...c.projects.map(p => p.name)])
  it('writes one for every client, division and project', () => {
    expect(names).toHaveLength(70)
    expect(names.filter(n => !whenToUse(n))).toEqual([])
  })
  it('keeps each to one plain line the catalogue accepts, with no em dash', () => {
    for (const n of names) {
      const line = whenToUse(n)!
      expect(line.length, n).toBeLessThanOrEqual(400)
      expect(line, n).not.toContain('—')
      expect(line, n).not.toContain('\n')
    }
  })
  it('reads an i7 code and a General project from their names', () => {
    expect(whenToUse('MME-WEBDVT')).toMatch(/^Web development for MME\./)
    expect(whenToUse('Fundraising General')).toMatch(/spans several Fundraising projects/)
  })
})
