import { describe, it, expect } from 'vitest'

import { narrowReport } from './narrow'
import type { I7Report } from './types'

/**
 * This is the only thing standing between a restricted viewer and the whole
 * company's hours, now that the report reads completely. It used to be a filter
 * in the browser, which was safe only because the database had already removed
 * the rows. These pin the two halves that matter: what is removed, and what is
 * deliberately NOT (the totals, which stay everyone's so a narrowed report
 * cannot be mistaken for a whole one).
 */
const REPORT: I7Report = {
  month: 'September 2026', startDate: '2026-09-01', endDate: '2026-09-30',
  totalHours: 10, totalCost: 950, hasRates: true,
  people: ['Cheyenne', 'Clarise', 'Jeannette'],
  projects: [
    {
      project: 'Bessemeter', hours: 10, cost: 950,
      byPerson: { Cheyenne: 4, Clarise: 3, Jeannette: 3 },
      jobcodes: [
        {
          code: 'BE-MKTG', hours: 10, cost: 950,
          byPerson: { Cheyenne: 4, Clarise: 3, Jeannette: 3 },
          activities: [
            { activity: 'SEO', hours: 10, cost: 950, byPerson: { Cheyenne: 4, Clarise: 3, Jeannette: 3 } },
          ],
        },
      ],
    },
  ],
}

describe('narrowReport', () => {
  it('drops the columns of people the viewer may not see, at every level', () => {
    const out = narrowReport(REPORT, { people: ['Clarise'], keepCost: false })
    expect(out.people).toEqual(['Clarise'])
    expect(out.projects[0].byPerson).toEqual({ Clarise: 3 })
    expect(out.projects[0].jobcodes[0].byPerson).toEqual({ Clarise: 3 })
    expect(out.projects[0].jobcodes[0].activities[0].byPerson).toEqual({ Clarise: 3 })
  })

  // The promise the Access levels page makes in writing: "Hours used is still
  // the figure for everyone, not the sum of the columns they can see."
  it('leaves the hour totals as everyone’s', () => {
    const out = narrowReport(REPORT, { people: ['Clarise'], keepCost: false })
    expect(out.totalHours).toBe(10)
    expect(out.projects[0].hours).toBe(10)
    expect(out.projects[0].jobcodes[0].activities[0].hours).toBe(10)
  })

  it('removes the money when the level may not see it', () => {
    const out = narrowReport(REPORT, { people: ['Clarise'], keepCost: false })
    expect(out.totalCost).toBe(0)
    expect(out.projects[0].cost).toBe(0)
    expect(out.projects[0].jobcodes[0].cost).toBe(0)
    expect(out.projects[0].jobcodes[0].activities[0].cost).toBe(0)
  })

  it('keeps the money when the level may see it', () => {
    const out = narrowReport(REPORT, { people: ['Clarise'], keepCost: true })
    expect(out.totalCost).toBe(950)
    expect(out.projects[0].cost).toBe(950)
  })

  // Someone in no team, or a name that no longer matches a column.
  it('an empty allow-list leaves no columns and still no wrong total', () => {
    const out = narrowReport(REPORT, { people: [], keepCost: false })
    expect(out.people).toEqual([])
    expect(out.projects[0].byPerson).toEqual({})
    expect(out.totalHours).toBe(10)
  })

  it('does not mutate the report it was given', () => {
    narrowReport(REPORT, { people: ['Clarise'], keepCost: false })
    expect(REPORT.people).toEqual(['Cheyenne', 'Clarise', 'Jeannette'])
    expect(REPORT.projects[0].byPerson).toEqual({ Cheyenne: 4, Clarise: 3, Jeannette: 3 })
    expect(REPORT.totalCost).toBe(950)
  })
})
