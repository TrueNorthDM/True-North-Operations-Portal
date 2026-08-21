import { describe, expect, it } from 'vitest'
import { cell, exportName, peopleCsv, row, toFile, waitsCsv, workloadCsv } from './csv'
import type { PersonRow } from '@/components/report/ReportPeople'
import type { WorkloadRow } from './workload'

const person = (o: Partial<PersonRow> = {}): PersonRow => ({
  id: '1', name: 'Amy Marsh', team: 'SEO', color: '#1E7D7F', initials: 'AM',
  delivered: 42, onTimePct: 79, medianHeld: 4.2, open: 9, late: 3, hours: 494, ...o,
})

describe('cell', () => {
  it('leaves an ordinary value alone', () => {
    expect(cell('Amy Marsh')).toBe('Amy Marsh')
  })

  it('quotes a comma, which a name can carry', () => {
    expect(cell('Marsh, Amy')).toBe('"Marsh, Amy"')
  })

  // Monday item names contain quotes often enough that this is not theoretical.
  it('doubles a quote inside a quoted cell', () => {
    expect(cell('SEO "sprint" report')).toBe('"SEO ""sprint"" report"')
  })

  it('quotes a newline rather than breaking the row in two', () => {
    expect(cell('line one\nline two')).toBe('"line one\nline two"')
  })

  it('writes an empty cell for nothing', () => {
    expect(cell(null)).toBe('')
    expect(row(['a', null, 1])).toBe('a,,1')
  })
})

describe('peopleCsv', () => {
  it('writes one row per person under a header', () => {
    const lines = peopleCsv([person()])
    expect(lines[0]).toContain('Person,Team,Delivered')
    expect(lines[1]).toBe('Amy Marsh,SEO,42,79,4.2,9,3,494')
  })

  // A spreadsheet sums a column. A zero standing in for "no history" becomes
  // part of a total somebody then presents as fact.
  it('leaves an unknown empty rather than writing a zero', () => {
    const lines = peopleCsv([person({ delivered: null, onTimePct: null, medianHeld: null, hours: null })])
    expect(lines[1]).toBe('Amy Marsh,SEO,,,,9,3,')
  })
})

describe('workloadCsv', () => {
  const load = (o: Partial<WorkloadRow> = {}): WorkloadRow => ({
    id: '1', name: 'Amy Marsh', initials: 'AM', color: '#1E7D7F',
    contracted: 40, observed: 38, hoursLogged: 494, estimatedAhead: 214,
    arriving: 4.6, finishing: 3.5, weekly: [], ...o,
  })

  it('says which rows borrowed somebody else outside week', () => {
    const lines = workloadCsv([load(), load({ id: '2', name: 'Wendy Clark', observed: null, hoursLogged: null })])
    expect(lines[1]).toContain('own hours')
    expect(lines[2]).toContain('group average week')
  })

  it('carries the reading, so the file says the same thing the screen does', () => {
    expect(workloadCsv([load()])[1]).toMatch(/Overloaded$/)
  })
})

describe('waitsCsv', () => {
  it('sorts the steps slowest first, as the panel draws them', () => {
    const lines = waitsCsv(
      [{ name: 'Publish', median: 1.1, delivered: 88 }, { name: 'Approve', median: 7.5, delivered: 38 }],
      [],
    )
    expect(lines[1]).toContain('Approve')
    expect(lines[2]).toContain('Publish')
  })

  it('separates the two tables with a blank line and its own header', () => {
    const lines = waitsCsv([], [{ id: '1', item: 'A', who: 'B', step: 'C', heldDays: 4 }])
    expect(lines).toContain('')
    expect(lines).toContain('Item,With,Step,Held (days)')
  })
})

describe('toFile and exportName', () => {
  // Without the BOM, Excel reads the accented names as mojibake.
  it('starts the file with a byte order mark and uses CRLF', () => {
    const out = toFile(['a', 'b'])
    expect(out.charCodeAt(0)).toBe(0xfeff)
    expect(out).toContain('\r\n')
  })

  it('names the file after what it actually covers', () => {
    expect(exportName('people', 'My team', 30)).toMatch(/^Report People - My team, last 30 days - \d{4}-\d{2}-\d{2}$/)
  })
})
