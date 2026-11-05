// A CSV as the portal writes it (audit, 15 October 2026). Every export used to
// carry its own copy of these few lines, and the copies had drifted: the
// Report quoted a cell holding a carriage return, the client report routes did
// not, so a stray CR from a pasted Monday name could end a row early in Excel.
// One rule now, the strictest of them.
//
// Pure string work, no I/O.

export type CsvValue = string | number | null | undefined

/**
 * One cell. Quoted only when it needs to be (a comma, a quote, a CR or an LF),
 * with any quote inside doubled. Nothing (null or undefined) is an empty cell.
 */
export function csvCell(v: CsvValue): string {
  if (v == null) return ''
  const s = String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** One line of cells, comma separated. */
export const csvRow = (cells: readonly CsvValue[]): string => cells.map(csvCell).join(',')

export interface CsvFileOptions {
  /**
   * A UTF-8 byte order mark first, so Excel reads accented names as UTF-8
   * instead of mojibake. On unless a caller says otherwise.
   */
  bom?: boolean
}

/**
 * Lines already written (see csvRow) as a whole file: CRLF between lines and
 * after the last one, the line ending Excel and RFC 4180 expect.
 */
export function csvFile(lines: readonly string[], { bom = true }: CsvFileOptions = {}): string {
  return (bom ? '\uFEFF' : '') + lines.join('\r\n') + '\r\n'
}

/**
 * A day in an export, as numbers the US way: 2026-10-01 to "10/1/2026" (owner,
 * 5 November 2026, from Finance: spreadsheets read it as a date). Only CSV
 * files; the screens and PDFs keep "Oct 1, 2026". Anything that is not a
 * YYYY-MM-DD day (or an ISO time starting with one) comes back as it was;
 * nothing is an empty cell.
 */
export function csvDate(day: string | null | undefined): string {
  if (!day) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day)
  return m ? `${+m[2]}/${+m[3]}/${m[1]}` : day
}
