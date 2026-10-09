import { describe, it, expect } from 'vitest'
import { budgetStatus, hoursByPerson, isMMEProject, projectsNearBudget, totalBudgetHours, usedShare } from './i7-view'

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
