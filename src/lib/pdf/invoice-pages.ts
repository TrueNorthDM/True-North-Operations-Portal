/**
 * The pages of an invoice's PDF (owner, 4 November 2026): the invoice, then
 * its record page. Pure, so the print pages, the download, the Drive copy and
 * the tests agree.
 *
 *   builder (and the portal's, before November 2026)   one print, two A4 pages
 *   own_file   their PDF as sent, then the record printed alone on the paper
 *              of their file's first page, numbered after their pages
 */

export type Paper = 'a4' | 'letter'

/** US Letter is 612 by 792 points; anything else (A4 is 595 by 842) gets A4. Either way up. */
export function paperOf(width: number, height: number): Paper {
  const near = (a: number, b: number) => Math.abs(a - b) < 6
  return (near(width, 612) && near(height, 792)) || (near(width, 792) && near(height, 612)) ? 'letter' : 'a4'
}

/** The print page's query for the record alone after their file. */
export const recordOnlyQuery = (ownPages: number, paper: Paper): string => `?only=record&pages=${ownPages}&paper=${paper}`

/** The print page's query read back: ?only=record&pages=<their file's pages>&paper=letter. */
export function printQuery(sp: Record<string, string | string[] | undefined>): { only?: 'record'; ownPages: number | null; paper: Paper } {
  const one = (k: string) => { const v = sp[k]; return Array.isArray(v) ? v[0] : v }
  const pages = Number(one('pages'))
  return {
    only: one('only') === 'record' ? 'record' : undefined,
    ownPages: Number.isInteger(pages) && pages > 0 && pages < 1000 ? pages : null,
    paper: one('paper') === 'letter' ? 'letter' : 'a4',
  }
}

/** The PDF's page labels: page 1 the builder's sheet (or their file's pages), the record last. */
export function recordPages(ownFilePages: number | null): { first: string; record: string } {
  const of = (ownFilePages ?? 1) + 1
  return { first: `Page 1 of ${of}`, record: `Page ${of} of ${of}` }
}
