import { describe, expect, it } from 'vitest'
import { csvCell, csvFile, csvRow } from './csv'

// The copies this module replaced (audit, 15 October 2026), frozen here so the
// test can show the files they wrote come out byte for byte the same.
const oldRouteCell = (v: string | number) => {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const oldReportCell = (v: string | number | null) => {
  if (v === null) return ''
  const s = String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const oldFile = (lines: string[]) => '\uFEFF' + lines.join('\r\n') + '\r\n'

const CORPUS: (string | number)[] = [
  '', 'Amy Marsh', 'Marsh, Amy', 'SEO "sprint" report', '"', '""', ',', 'line one\nline two',
  'a\r\nb', 'José Núñez', 'Ação', 'TOTAL 2026-09', '2026-09-01', 'i7 invoice',
  0, 1, -1, 12.5, 1234.56, 0.1 + 0.2, '1234.50', '100', 'tab\there', ' padded ',
]

describe('csvCell', () => {
  it('leaves an ordinary value alone', () => {
    expect(csvCell('Amy Marsh')).toBe('Amy Marsh')
    expect(csvCell(12.5)).toBe('12.5')
  })

  it('quotes a comma and doubles a quote', () => {
    expect(csvCell('Marsh, Amy')).toBe('"Marsh, Amy"')
    expect(csvCell('SEO "sprint" report')).toBe('"SEO ""sprint"" report"')
  })

  it('quotes an LF, a CRLF and a lone CR, so none of them ends the row', () => {
    expect(csvCell('a\nb')).toBe('"a\nb"')
    expect(csvCell('a\r\nb')).toBe('"a\r\nb"')
    expect(csvCell('a\rb')).toBe('"a\rb"')
  })

  it('writes an empty cell for nothing', () => {
    expect(csvCell(null)).toBe('')
    expect(csvCell(undefined)).toBe('')
  })

  it('matches every copy it replaced, for anything without a lone CR', () => {
    for (const v of CORPUS) {
      expect(csvCell(v)).toBe(oldRouteCell(v))
      expect(csvCell(v)).toBe(oldReportCell(v))
    }
    expect(csvCell(null)).toBe(oldReportCell(null))
  })
})

describe('csvRow', () => {
  it('joins the cells with commas', () => {
    expect(csvRow(['a', null, 1, 'b,c'])).toBe('a,,1,"b,c"')
  })

  it('writes the same line the old route copies did', () => {
    const cells = ['2026-09', 'i7 invoice', 'Pages, "new"', 'SEO', 12.25, '1234.50', 42.1]
    expect(csvRow(cells)).toBe(cells.map(oldRouteCell).join(','))
  })
})

describe('csvFile', () => {
  it('starts with a BOM and ends every line with CRLF', () => {
    expect(csvFile(['a,b', 'c,d'])).toBe('\uFEFFa,b\r\nc,d\r\n')
  })

  it('leaves the BOM out when asked', () => {
    expect(csvFile(['a'], { bom: false })).toBe('a\r\n')
  })

  it('writes the same bytes as the copies it replaced', () => {
    const rows = [
      ['Month', 'Budget', 'Carry-in', 'Used', 'Hours used', 'Balance'],
      ['2026-01', '5000.00', '0.00', '4210.33', '120.50', '789.67'],
      ['Total', '5000.00', '', '4210.33', '120.50', ''],
      ['José, "Zé" Núñez', 'multi\nline', 3],
    ]
    const lines = rows.map(csvRow)
    expect(csvFile(lines)).toBe(oldFile(rows.map(r => r.map(oldRouteCell).join(','))))
    expect(csvFile([])).toBe(oldFile([]))
  })
})
