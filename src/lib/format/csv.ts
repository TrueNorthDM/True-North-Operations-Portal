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
