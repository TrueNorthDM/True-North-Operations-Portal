/**
 * The rows of the "month by month" table, on screen and in its CSV.
 */

import { describe, it, expect } from 'vitest'
import { historyRows, historyCsvRows, historyMonthHeading } from './project-history-rows'
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

describe('historyCsvRows', () => {
  it('heads the months with their year', () => {
    expect(historyMonthHeading('2026-09')).toBe('Sep 2026')
    expect(historyCsvRows([AAAF])[0]).toEqual(['Project', 'Row', 'Jan 2026', 'Feb 2026'])
  })

  it('has exactly the rows the screen has, project by project', () => {
    const rows = historyCsvRows([AAAF, CHURCH]).slice(1).map(r => `${r[0]} / ${r[1]}`)
    expect(rows).toEqual([
      'AskAnAdventistFriend.com / Hours',
      'AskAnAdventistFriend.com / Employee costs (USD)',
      'AskAnAdventistFriend.com / Contractor costs (USD)',
      'AskAnAdventistFriend.com / Donations (USD)',
      'AskAnAdventistFriend.com / Net (USD)',
      'Grants Pass Church / Hours',
      'Grants Pass Church / Employee costs (USD)',
    ])
  })

  it('writes plain numbers a spreadsheet can add, zero included', () => {
    const [, hours, employee] = historyCsvRows([CHURCH])
    expect(hours.slice(2)).toEqual(['1.50', '0.00'])
    expect(employee.slice(2)).toEqual(['96.30', '0.00'])
    const [, , aaafEmployee] = historyCsvRows([AAAF])
    expect(aaafEmployee.slice(2)).toEqual(['35382.46', '33215.07'])
  })

  it('leaves a donation nobody has entered blank, and still gives that month its net', () => {
    const rows = historyCsvRows([AAAF])
    const donations = rows.find(r => r[1] === 'Donations (USD)')!
    const net = rows.find(r => r[1] === 'Net (USD)')!
    expect(donations.slice(2)).toEqual(['12104.00', ''])
    expect(net.slice(2)).toEqual(['-31513.84', '-43922.17'])
  })

  it('is empty when there is nothing to export', () => {
    expect(historyCsvRows([])).toEqual([])
  })
})
