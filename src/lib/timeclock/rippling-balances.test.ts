import { describe, expect, it } from 'vitest'
import { matchReport, readReport, reportDay } from './rippling-balances'
import { csvRows, sheetRows } from '@/lib/xlsx-rows'

const ROWS = [
  ['#', 'Employee', 'Type', 'Current Balance'],
  ['1', 'Alyssa Sommerville', 'All', '44.87'],
  ['', 'Alyssa Sommerville', 'Sick Leave', '44.87'],
  ['2', 'Joy Inyele', 'All', '84.91', 'GNA employee'],
  ['', 'Joy Inyele', 'Sick Leave', '11.06'],
  ['', 'Joy Inyele', 'Vacation', '73.849999999999994'],
  ['3', 'Someone Else', 'All', '3'],
  ['', 'Someone Else', 'Vacation', '3'],
]

describe('readReport', () => {
  it('keeps Vacation and Sick Leave, leaves the All rows out, rounds to cents', () => {
    expect(readReport(ROWS)).toEqual({ error: null, rows: [
      { name: 'Alyssa Sommerville', kind: 'sick', hours: 44.87 },
      { name: 'Joy Inyele', kind: 'sick', hours: 11.06 },
      { name: 'Joy Inyele', kind: 'vacation', hours: 73.85 },
      { name: 'Someone Else', kind: 'vacation', hours: 3 },
    ] })
  })
  it('says when the file is not the report', () => {
    expect(readReport([['type', 'hours', 'fname', 'lname']]).error).toContain('Time off balances report')
  })
})

describe('matchReport', () => {
  const people = [{ id: 'a', fullName: 'Alyssa Sommerville' }, { id: 'j', fullName: 'Joy Deche' }, { id: 'k', fullName: 'Kevin Ames' }]
  it('finds people by name, by first name when only one has it, and never guesses the rest', () => {
    const { matched, unmatched } = matchReport(readReport(ROWS).rows, people)
    expect(matched).toEqual([
      { personId: 'a', name: 'Alyssa Sommerville', reportName: null, vacation: null, sick: 44.87 },
      { personId: 'j', name: 'Joy Deche', reportName: 'Joy Inyele', vacation: 73.85, sick: 11.06 },
    ])
    expect(unmatched).toEqual(['Someone Else'])
  })
  it('does not match a first name two people share', () => {
    const rows = readReport([['Employee', 'Type', 'Current Balance'], ['Joy Inyele', 'Vacation', '5']]).rows
    expect(matchReport(rows, [{ id: 'j', fullName: 'Joy Deche' }, { id: 'x', fullName: 'Joy Other' }]).unmatched).toEqual(['Joy Inyele'])
  })
})

describe('reportDay', () => {
  it('reads the day from the file name', () => {
    expect(reportDay('Time_off_balances_report-11-20-26.xlsx')).toBe('2026-11-20')
    expect(reportDay('balances 2026-12-04.csv')).toBe('2026-12-04')
    expect(reportDay('balances.xlsx')).toBeNull()
    expect(reportDay('report-13-40-26.xlsx')).toBeNull()
  })
})

describe('the file readers', () => {
  it('reads a sheet by its cell positions, with shared and inline text', () => {
    const shared = '<sst><si><t>Employee</t></si><si><r><t>Amy </t></r><r><t>Prindle</t></r></si></sst>'
    const sheet = '<sheetData><row r="1"><c r="B1" t="s"><v>0</v></c><c r="D1" t="inlineStr"><is><t>Current &amp; Balance</t></is></c></row><row r="2"><c r="B2" t="s"><v>1</v></c><c r="D2"><v>7.1</v></c></row></sheetData>'
    expect(sheetRows(sheet, shared)).toEqual([['', 'Employee', '', 'Current & Balance'], ['', 'Amy Prindle', '', '7.1']])
  })
  it('reads CSV with quotes and any line ending', () => {
    expect(csvRows('Employee,Type,Current Balance\r\n"Prindle, Amy",Vacation,"46.67"\n\n')).toEqual([['Employee', 'Type', 'Current Balance'], ['Prindle, Amy', 'Vacation', '46.67']])
  })
})
