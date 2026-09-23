/**
 * Which rows each project has in the "month by month" table, and the same table
 * as spreadsheet rows.
 *
 * One rule for the screen and the CSV. The CSV was added after the screen, and a
 * download with a row the table does not have (or the other way round) is the
 * kind of difference nobody spots until two people compare numbers.
 */

import type { ProjectHistoryBlock, ProjectMonthRow } from './projects'

export type HistoryRowKey = 'hours' | 'employeeCost' | 'contractorCost' | 'donations' | 'net'

/** What each row is called on screen. */
export const HISTORY_ROW_NAMES: Record<HistoryRowKey, string> = {
  hours: 'Hours',
  employeeCost: 'Employee costs',
  contractorCost: 'Contractor costs',
  donations: 'Donations',
  net: 'Net',
}

/**
 * A row's name for this block. i7 and MME have no donations: the same row holds
 * what was billed to the client, and is called that.
 */
export const historyRowName = (key: HistoryRowKey, b: Pick<ProjectHistoryBlock, 'billed'>): string =>
  key === 'donations' && b.billed ? 'Billed' : HISTORY_ROW_NAMES[key]

/**
 * The rows a project's block shows, in order.
 *
 * The two prepaid projects have no donations and so no net: their income is
 * hours bought in advance, not gifts. They also lose Contractor costs, which
 * Tina asked for in September 2026. No contractor has logged an hour against
 * Grants Pass Church or School in 2025 or 2026, so the row was a line of dashes.
 *
 * The row comes back on its own the first month one does. Hiding a row of zeros
 * tidies the table; hiding a row with money in it would make the project look
 * cheaper than it was.
 */
export function historyRows(block: ProjectHistoryBlock): HistoryRowKey[] {
  if (!block.prepaid) return ['hours', 'employeeCost', 'contractorCost', 'donations', 'net']
  return block.months.some(m => m.contractorCost !== 0)
    ? ['hours', 'employeeCost', 'contractorCost']
    : ['hours', 'employeeCost']
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Jan": the column heading the screen uses. The year is in the title above. */
export const historyMonthHeading = (ym: string) => MON[Number(ym.slice(5, 7)) - 1]

/**
 * A project's year so far, the Total column of the PDF and the CSV. Donations
 * and net stay blank when no month has one, as each month does.
 */
export function historyTotal(b: ProjectHistoryBlock): Omit<ProjectMonthRow, 'month'> {
  const sum = (pick: (m: ProjectMonthRow) => number | null) => {
    const parts = b.months.map(pick).filter((n): n is number => n != null)
    return parts.length === 0 ? null : parts.reduce((a, n) => a + n, 0)
  }
  return {
    hours: sum(m => m.hours) ?? 0,
    employeeCost: sum(m => m.employeeCost) ?? 0,
    contractorCost: sum(m => m.contractorCost) ?? 0,
    donations: sum(m => m.donations),
    net: sum(m => m.net),
  }
}

const dollars = (n: number) => '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * One cell, written the way the screen writes it: a dash for nothing, blank
 * for a donation nobody entered, dollars with thousands and cents.
 *
 * `minus` is the sign in front of a negative net. The screen and the PDF use
 * the typographic one; the CSV uses a plain hyphen, because a spreadsheet reads
 * "-$33,737.20" as the number it is and "\u2212$33,737.20" as text.
 */
export function historyText(key: HistoryRowKey, m: Omit<ProjectMonthRow, 'month'>, minus = '\u2212'): string {
  switch (key) {
    case 'hours': return m.hours === 0 ? '-' : m.hours.toFixed(2)
    case 'employeeCost':
    case 'contractorCost': return m[key] === 0 ? '-' : dollars(m[key])
    case 'donations': return m.donations == null ? '' : m.donations === 0 ? '-' : dollars(m.donations)
    // A month with nothing in it, which only i7 and MME can have (no hours,
    // nothing billed), is a dash like every other empty figure.
    case 'net': return m.net == null ? '' : m.net === 0 ? '-' : (m.net < 0 ? minus : '') + dollars(m.net)
  }
}

/** What the table says under itself, and so what the PDF and the CSV say too. */
export const HISTORY_NOTE =
  'Net is donations minus employee and contractor costs, for that month alone. It differs from the '
  + 'same figure on the tracking sheet by the Grants Pass school-website and church-invoice lines: '
  + 'those sit on the Grants Pass rows here as hours bought in advance, so counting them again '
  + 'against these two projects would count them twice. For i7 and MME, Billed is hours times the '
  + 'client rate, as on the i7 invoices, and Net is billed minus costs.'

/**
 * The table as a spreadsheet, laid out the way the screen lays it out.
 *
 * Asked for by Tina on 16 September 2026: the first version repeated the
 * project on every row with plain numbers, which suits sorting and is not what
 * she reads. Now it is the screen: a title, the months across with a Total, one
 * block per project with its name on a line of its own and its rows under it,
 * a blank line between projects, and the figures written as the screen writes
 * them. A spreadsheet still reads "$30,233.01" and "-$33,737.20" as numbers.
 */
export function historyCsvRows(
  blocks: ProjectHistoryBlock[],
  head: { period: string; generatedOn: string } = { period: '', generatedOn: '' },
): string[][] {
  if (blocks.length === 0) return []
  const months = blocks[0].months.map(m => m.month)
  const out: string[][] = [
    ['Project Hours & Others, month by month'],
    [head.period],
    [head.generatedOn ? `Generated ${head.generatedOn}` : ''],
    [],
    ['Project', ...months.map(historyMonthHeading), 'Total'],
  ]
  for (const b of blocks) {
    out.push([b.prepaid ? `${b.name} (prepaid)` : b.billed ? `${b.name} (billed)` : b.name])
    const total = historyTotal(b)
    for (const key of historyRows(b)) {
      out.push([historyRowName(key, b), ...b.months.map(m => historyText(key, m, '-')), historyText(key, total, '-')])
    }
    out.push([])
  }
  out.push([HISTORY_NOTE])
  return out
}
