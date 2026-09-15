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

/** "Jan 2026". The year is in every heading so a pasted block still says which year it is. */
export const historyMonthHeading = (ym: string) => `${MON[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`

/** Plain numbers for a spreadsheet: no symbol, no thousands comma, two decimals. */
const plain = (n: number) => (Math.round(n * 100) / 100).toFixed(2)

function csvValue(key: HistoryRowKey, m: ProjectMonthRow): string {
  switch (key) {
    case 'hours': return plain(m.hours)
    case 'employeeCost': return plain(m.employeeCost)
    case 'contractorCost': return plain(m.contractorCost)
    // Blank, never 0.00, when nobody has entered a donation: the screen draws
    // that month empty for the same reason.
    case 'donations': return m.donations == null ? '' : plain(m.donations)
    case 'net': return m.net == null ? '' : plain(m.net)
  }
}

/**
 * The table as rows of cells, heading first.
 *
 * The screen's shape, months across, because that is the shape of the tracking
 * sheet the table copies and the likeliest place these rows get pasted. The
 * project name is repeated on every row rather than written once per block, so
 * the rows can be sorted or filtered without losing whose they are. Money rows
 * say USD in their name, as the report's other CSV does in its headings.
 */
export function historyCsvRows(blocks: ProjectHistoryBlock[]): string[][] {
  if (blocks.length === 0) return []
  const months = blocks[0].months.map(m => m.month)
  const out: string[][] = [['Project', 'Row', ...months.map(historyMonthHeading)]]
  for (const b of blocks) {
    for (const key of historyRows(b)) {
      const name = key === 'hours' ? HISTORY_ROW_NAMES[key] : `${HISTORY_ROW_NAMES[key]} (USD)`
      out.push([b.name, name, ...b.months.map(m => csvValue(key, m))])
    }
  }
  return out
}
