import { describe, expect, it } from 'vitest'
import { withoutLineCosts } from './report-money'
import type { I7Report } from './types'

const report: I7Report = {
  month: 'June 2026', startDate: '2026-06-01', endDate: '2026-06-30',
  totalHours: 10, totalCost: 950, hasRates: true, people: ['Ana', 'Bo'],
  projects: [{ project: 'Bessemeter', hours: 10, cost: 950, byPerson: { Ana: 7, Bo: 3 }, jobcodes: [
    { code: 'BE-MKTG', hours: 10, cost: 950, byPerson: { Ana: 7, Bo: 3 }, activities: [
      { activity: 'SEO', hours: 7, cost: 665, byPerson: { Ana: 7 } },
      { activity: 'Social', hours: 3, cost: 285, byPerson: { Bo: 3 } },
    ] },
  ] }],
}

describe('withoutLineCosts (owner, 5 November 2026)', () => {
  it('sends no cost on any line, so no rate can be worked out from the hours beside it', () => {
    const out = withoutLineCosts(report)
    const costs = [out.totalCost, ...out.projects.flatMap(p => [p.cost, ...p.jobcodes.flatMap(j => [j.cost, ...j.activities.map(a => a.cost)])])]
    expect(costs.every(c => c === 0)).toBe(true)
    expect(JSON.stringify(out)).not.toContain('665')
  })
  it('keeps every hour and every person', () => {
    const out = withoutLineCosts(report)
    expect(out.totalHours).toBe(10)
    expect(out.people).toEqual(['Ana', 'Bo'])
    expect(out.projects[0].jobcodes[0].activities[1].byPerson).toEqual({ Bo: 3 })
  })
})
