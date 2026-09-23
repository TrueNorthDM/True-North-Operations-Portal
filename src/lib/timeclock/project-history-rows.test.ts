/**
 * The rows of the "month by month" table, on screen and in its CSV.
 */

import { describe, it, expect } from 'vitest'
import { historyRows, historyCsvRows, historyMonthHeading, historyText, historyTotal, HISTORY_NOTE } from './project-history-rows'
import type { ProjectHistoryBlock, ProjectMonthRow } from './projects'

const month = (ym: string, over: Partial<ProjectMonthRow> = {}): ProjectMonthRow => ({
  month: ym, hours: 0, employeeCost: 0, contractorCost: 0, donations: null, net: null, ...over,
})

const AAAF: ProjectHistoryBlock = {
  label: 'AAAF', name: 'AskAnAdventistFriend.com', prepaid: false,
  months: [
    month('2026-01', { hours: 914.13, employeeCost: 35382.46, contractorCost: 8235.38, donations: 12104, net: -31513.84 }),
    month('2026-02', { hours: 921.4, employeeCost: 33215.07, contractorCost: 10707.1, donations: null, net: -43922.17 }),
  ],
}

const CHURCH: ProjectHistoryBlock = {
  label: 'GP church', name: 'Grants Pass Church', prepaid: true,
  months: [month('2026-01', { hours: 1.5, employeeCost: 96.3 }), month('2026-02')],
}

describe('historyRows', () => {
  it('gives a donation-funded project all five rows, in the order of the sheet', () => {
    expect(historyRows(AAAF)).toEqual(['hours', 'employeeCost', 'contractorCost', 'donations', 'net'])
  })

  it('keeps Contractor costs for a donation-funded project even in a year of none', () => {
    const quiet = { ...AAAF, months: AAAF.months.map(m => ({ ...m, contractorCost: 0 })) }
    expect(historyRows(quiet)).toContain('contractorCost')
  })

  it('stops a prepaid project at employee costs while no contractor has worked on it', () => {
    expect(historyRows(CHURCH)).toEqual(['hours', 'employeeCost'])
  })

  // The safeguard. A tidy table must never hide money.
  it('brings Contractor costs back for a prepaid project the month a contractor cost appears', () => {
    const withContractor = {
      ...CHURCH,
      months: [CHURCH.months[0], month('2026-02', { hours: 2, contractorCost: 63.58 })],
    }
    expect(historyRows(withContractor)).toEqual(['hours', 'employeeCost', 'contractorCost'])
  })
})

describe('historyText: cells written as the screen writes them', () => {
  const m = AAAF.months[0]
  it('writes hours with two decimals and a dash for none', () => {
    expect(historyText('hours', m)).toBe('914.13')
    expect(historyText('hours', CHURCH.months[1])).toBe('-')
  })

  it('writes dollars with thousands and cents, blank for a donation nobody entered', () => {
    expect(historyText('employeeCost', m)).toBe('$35,382.46')
    expect(historyText('donations', AAAF.months[1])).toBe('')
  })

  it('signs a negative net with the typographic minus on screen and a hyphen for a spreadsheet', () => {
    expect(historyText('net', m)).toBe('\u2212$31,513.84')
    expect(historyText('net', m, '-')).toBe('-$31,513.84')
  })
})

describe('historyTotal', () => {
  it('adds the year, and leaves donations blank when no month had one', () => {
    const t = historyTotal(AAAF)
    expect(t.hours).toBeCloseTo(1835.53)
    expect(t.donations).toBe(12104)
    expect(t.net).toBeCloseTo(-75436.01)
    expect(historyTotal(CHURCH).donations).toBeNull()
  })
})

describe('historyCsvRows: the screen, as a spreadsheet', () => {
  const rows = historyCsvRows([AAAF, CHURCH], { period: 'Jan to Feb 2026', generatedOn: 'September 23, 2026' })

  it('opens with a title, the period and the date, then the months and a Total', () => {
    expect(rows.slice(0, 5)).toEqual([
      ['Project Hours & Others, month by month'],
      ['Jan to Feb 2026'],
      ['Generated September 23, 2026'],
      [],
      ['Project', 'Jan', 'Feb', 'Total'],
    ])
    expect(historyMonthHeading('2026-09')).toBe('Sep')
  })

  it('gives each project a line of its own, its rows under it, and a blank line after', () => {
    const labels = rows.slice(5).map(r => r[0] ?? '')
    expect(labels).toEqual([
      'AskAnAdventistFriend.com', 'Hours', 'Employee costs', 'Contractor costs', 'Donations', 'Net', '',
      'Grants Pass Church (prepaid)', 'Hours', 'Employee costs', '',
      HISTORY_NOTE,
    ])
  })

  it('writes the figures as the screen does, with a hyphen minus a spreadsheet can read', () => {
    const net = rows.find(r => r[0] === 'Net')!
    expect(net.slice(1)).toEqual(['-$31,513.84', '-$43,922.17', '-$75,436.01'])
    const churchHours = rows[rows.indexOf(rows.find(r => r[0] === 'Grants Pass Church (prepaid)')!) + 1]
    expect(churchHours.slice(1)).toEqual(['1.50', '-', '1.50'])
  })

  it('is empty when there is nothing to export', () => {
    expect(historyCsvRows([])).toEqual([])
  })
})
