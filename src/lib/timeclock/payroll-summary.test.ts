import { describe, expect, it } from 'vitest'
import { buildPayroll, gapText, payrollCsv, splitName, type PayrollEntry } from './payroll-summary'

const H = 3600
const e = (personId: string, hours: number, sort: PayrollEntry['sort'] = 'work', approved = true): PayrollEntry =>
  ({ personId, date: '2026-10-27', seconds: hours * H, sort, approved })

describe('splitName', () => {
  it('takes the kept last name and what comes before it', () => {
    expect(splitName('Joy Deche', 'Deche')).toEqual({ fname: 'Joy', lname: 'Deche' })
    expect(splitName('Mary Ann  van Dyke', 'van Dyke')).toEqual({ fname: 'Mary Ann', lname: 'van Dyke' })
  })
  it('falls back to the last word when no last name is kept', () => {
    expect(splitName('Rock Kai', null)).toEqual({ fname: 'Rock', lname: 'Kai' })
    expect(splitName('Cher', null)).toEqual({ fname: 'Cher', lname: '' })
  })
})

describe('buildPayroll', () => {
  const people = [
    { id: 't', fullName: 'Tina Gennette', lastName: 'Gennette' },
    { id: 'c', fullName: 'Clarise Nixon', lastName: 'Nixon' },
    { id: 'd', fullName: 'David Sharpe', lastName: 'Sharpe' },
    { id: 'n', fullName: 'Nobody Here', lastName: 'Here' },
  ]
  const lines = buildPayroll(people, [
    e('c', 64), e('c', 8, 'pto'), e('c', 8, 'pto'),
    e('d', 80.75),
    e('t', 70, 'work'), e('t', 2, 'work', false), e('t', 8, 'pto'), e('t', 4, 'unpaid'),
  ])

  it('sorts by first name and keeps people with no hours', () => {
    expect(lines.map(l => l.fname)).toEqual(['Clarise', 'David', 'Nobody', 'Tina'])
  })
  it('splits work and paid time off, leaves unpaid out, never tops up or caps', () => {
    const by = Object.fromEntries(lines.map(l => [l.personId, l]))
    expect(by.c).toMatchObject({ reg: 64, pto: 16, gap: 0 })
    expect(by.d).toMatchObject({ reg: 80.75, pto: 0, gap: 0.75 })
    expect(by.t).toMatchObject({ reg: 72, pto: 8, pending: 2, gap: 0 })
    expect(by.n).toMatchObject({ reg: 0, pto: 0, gap: -80 })
  })
  it('writes the check line', () => {
    expect(gapText(-8)).toBe('8 h short of 80')
    expect(gapText(0.75)).toBe('0.75 h over 80')
    expect(gapText(0)).toBeNull()
  })
  it('writes the file in Tina\'s shape, the PTO row under its person', () => {
    expect(payrollCsv(lines)).toBe([
      'type,hours,fname,lname',
      'REG,64,Clarise,Nixon',
      'PTO,16,,',
      'REG,80.75,David,Sharpe',
      'REG,0,Nobody,Here',
      'REG,72,Tina,Gennette',
      'PTO,8,,',
      '',
    ].join('\n'))
  })
})
