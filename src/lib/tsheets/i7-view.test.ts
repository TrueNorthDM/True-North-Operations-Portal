import { describe, it, expect } from 'vitest'
import { budgetStatus, costShares, hoursByPerson, isMMEProject, projectsNearBudget, totalBudgetHours, usedShare } from './i7-view'

const report = {
  projects: [
    { project: 'Bessemeter', hours: 95, cost: 0, byPerson: { Ana: 60, Bo: 35 }, jobcodes: [] },
    { project: 'Moisture Meters (MME)', hours: 4, cost: 0, byPerson: { Ana: 4 }, jobcodes: [] },
  ],
} as never

describe('the i7 figures the screen, the PDFs and the image share', () => {
  it('reads the budget the same way everywhere: watch from 75%, over past 100%', () => {
    expect(budgetStatus(70, 100)).toBe('good')
    expect(budgetStatus(75, 100)).toBe('warn')
    expect(budgetStatus(100, 100)).toBe('warn')
    expect(budgetStatus(101, 100)).toBe('bad')
    expect(budgetStatus(10, 0)).toBe('none')
  })

  it('measures use against the money available this month', () => {
    expect(usedShare({ monthUsed: 45_000, totalAvailable: 49_094 } as never)).toBeCloseTo(0.9166, 3)
    expect(usedShare(null)).toBe(0)
  })

  it('counts every project budgeted, including one with no hours yet', () => {
    expect(totalBudgetHours({ Bessemeter: 100, 'i7 Marketing': 40 })).toBe(140)
  })

  it('names the projects near budget, not always MME', () => {
    expect(projectsNearBudget(report, { Bessemeter: 100, 'Moisture Meters (MME)': 10 })).toEqual(['Bessemeter'])
  })

  it('adds each person up across projects, and tells MME apart', () => {
    expect(hoursByPerson(report)).toEqual({ Ana: 64, Bo: 35 })
    expect(isMMEProject('Moisture Meters (MME)')).toBe(true)
    expect(isMMEProject('Bessemeter')).toBe(false)
  })
})

// The client PDF's Share column and the client CSV read these. Rounded one by
// one, three equal projects read 33% each under a total of 100% (audit,
// 13 October 2026).
describe('costShares', () => {
  const jc = (code: string, cost: number) => ({ code, hours: 1, cost, activities: [], byPerson: {} })
  const split = {
    projects: [
      { project: 'Bessemeter', hours: 3, cost: 300, byPerson: {}, jobcodes: [jc('BE-A', 100), jc('BE-B', 100), jc('BE-C', 100)] },
      { project: 'i7 Marketing', hours: 3, cost: 300, byPerson: {}, jobcodes: [jc('I7-A', 300)] },
      { project: 'Moisture Meters (MME)', hours: 3, cost: 300, byPerson: {}, jobcodes: [jc('MME-A', 150), jc('MME-B', 150)] },
      { project: 'Wagner Meters (WM)', hours: 0, cost: 0, byPerson: {}, jobcodes: [] },
    ],
  } as never
  const s = costShares(split)
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

  it('adds the invoices up to 100', () => {
    expect(s.invoice).toEqual({ i7: 67, mme: 33 })
  })

  it('adds an invoice\'s projects up to that invoice', () => {
    expect(s.project['Bessemeter'] + s.project['i7 Marketing'] + s.project['Wagner Meters (WM)']).toBe(s.invoice.i7)
    expect(s.project['Moisture Meters (MME)']).toBe(s.invoice.mme)
    expect(s.project['Wagner Meters (WM)']).toBe(0)
  })

  it('adds a project\'s job codes up to that project, and all of them to 100', () => {
    for (const [project, codes] of Object.entries(s.jobcode)) expect(sum(Object.values(codes))).toBe(s.project[project])
    expect(sum(Object.values(s.jobcode).flatMap(c => Object.values(c)))).toBe(100)
  })

  it('shares nothing out of a month that cost nothing', () => {
    const free = costShares({ projects: [{ project: 'Bessemeter', hours: 2, cost: 0, byPerson: {}, jobcodes: [jc('BE-A', 0)] }] } as never)
    expect(free.invoice).toEqual({ i7: 0, mme: 0 })
    expect(free.jobcode['Bessemeter']['BE-A']).toBe(0)
  })
})
