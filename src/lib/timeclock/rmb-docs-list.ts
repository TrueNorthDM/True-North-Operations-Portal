/**
 * The reimbursement documents list (owner, 25 October 2026): the Documents
 * view of the Reimbursements page, every employee's RMB document for Super
 * Admins, Admins and Finance, laid out as the Invoices list (6E). Only Finance
 * marks one paid. Pure: the read is loadReimbursements (requests-data.ts),
 * after its access check.
 */

import { dateLabel, initials as initialsOf, localDate, monthLong, monthYear } from './format'
import { moneyTotal, paidText } from './invoice-doc'

export type RmbDocState = 'appr' | 'paid'

export interface RmbDocListRow {
  id: number
  number: string
  who: string
  initials: string
  team: string
  teamColor: string
  /** How many reimbursements it holds. */
  items: number
  /** "Oct 21, 2026": the day it was made, in the viewer's zone. */
  date: string
  /** "October 2026": the Period filter, by that day. */
  period: string
  /** Each currency on its own, as the document adds them: "$57.99", "$120.00 + KES 4,500.00". */
  total: string
  /** The CSV's Total and Currency: a number for one currency, the text for several. */
  csv: { total: string; currency: string }
  st: RmbDocState
  /** The Paid column: the day and the reference, or where it is. */
  where: string
  /** YYYY-MM-DD, for the "Paid in" card. */
  paidOn: string | null
  canPay: boolean
  /** The Mark paid dialog's line: "2 items · approved Nov 3, 2026", as the document's. */
  payLine: string
}

export interface RmbDocList {
  finance: boolean
  rows: RmbDocListRow[]
  people: string[]
  /** Newest first: "October 2026". */
  periods: string[]
  /** The strip: approved and not paid, and paid this month. */
  toPay: { count: number; total: string }
  paidIn: { label: string; count: number; total: string }
  /** "Tina Gennette": who marks documents paid (Company settings, Invoices). */
  financeNames: string
}

export type RmbDocSource = { id: number; number: string; person_id: string; state: string; total: number; paid_on: string | null; paid_ref: string | null; created_at: string }
export type RmbDocItem = { document_id: number; amount: number; currency: string | null; decided_at: string | null }

export interface RmbDocListSource {
  finance: boolean
  docs: readonly RmbDocSource[]
  items: readonly RmbDocItem[]
  person: (id: string) => { name: string; team: string; color: string }
  financeNames: string
  zone: string
  /** Today, YYYY-MM-DD in the viewer's zone. */
  today: string
}

type Amount = { amount: number; currency: string }

/** One currency: the number and its code, for a spreadsheet; several: the document's text and every code. */
export function csvTotal(amounts: readonly Amount[]): { total: string; currency: string } {
  const codes = [...new Set(amounts.map(a => a.currency))]
  if (codes.length > 1) return { total: moneyTotal(amounts), currency: codes.sort((a, b) => (a === 'USD' ? -1 : b === 'USD' ? 1 : a.localeCompare(b))).join(' + ') }
  return { total: (amounts.reduce((n, a) => n + Math.round(a.amount * 100), 0) / 100).toFixed(2), currency: codes[0] ?? 'USD' }
}

export function buildRmbDocList(src: RmbDocListSource): RmbDocList {
  const byDoc = new Map<number, RmbDocItem[]>()
  for (const i of src.items) byDoc.set(i.document_id, [...(byDoc.get(i.document_id) ?? []), i])
  const amountsOf = new Map<number, Amount[]>()
  const docs = [...src.docs].sort((a, b) => b.number.localeCompare(a.number))
  const rows: RmbDocListRow[] = docs.map(d => {
    const items = byDoc.get(d.id) ?? []
    // A document with no items read falls back on its own total, in dollars, rather than $0.00.
    const amounts: Amount[] = items.length ? items.map(i => ({ amount: Number(i.amount), currency: i.currency || 'USD' })) : [{ amount: Number(d.total), currency: 'USD' }]
    amountsOf.set(d.id, amounts)
    const day = localDate(d.created_at, src.zone)
    const p = src.person(d.person_id)
    const st: RmbDocState = d.state === 'paid' ? 'paid' : 'appr'
    const last = items.map(i => i.decided_at).filter((x): x is string => !!x).sort().pop()
    return {
      id: d.id, number: d.number, who: p.name, initials: initialsOf(p.name), team: p.team, teamColor: p.color,
      items: items.length, date: dateLabel(day), period: monthYear(day),
      total: moneyTotal(amounts), csv: csvTotal(amounts), st,
      where: st === 'paid' && d.paid_on ? paidText(d.paid_on, d.paid_ref) : st === 'paid' ? 'Paid' : 'Waiting for Finance',
      paidOn: st === 'paid' ? d.paid_on : null,
      canPay: src.finance && st === 'appr',
      payLine: `${items.length} item${items.length === 1 ? '' : 's'}${last ? ` · approved ${dateLabel(localDate(last, src.zone))}` : ''}`,
    }
  })
  const sum = (list: RmbDocListRow[]) => moneyTotal(list.flatMap(r => amountsOf.get(r.id) ?? []))
  const appr = rows.filter(r => r.st === 'appr')
  // "Paid in" is this month: a document has no monthly cycle, unlike an invoice, paid the month after its period.
  const ym = src.today.slice(0, 7)
  const paid = rows.filter(r => r.st === 'paid' && r.paidOn?.startsWith(ym))
  const periods = [...new Map(docs.map(d => { const day = localDate(d.created_at, src.zone); return [day.slice(0, 7), monthYear(day)] as const })).entries()]
    .sort((a, b) => b[0].localeCompare(a[0])).map(([, label]) => label)
  return {
    finance: src.finance, rows,
    people: [...new Set(rows.map(r => r.who))].sort((a, b) => a.localeCompare(b)),
    periods,
    toPay: { count: appr.length, total: sum(appr) },
    paidIn: { label: monthLong(`${ym}-01`), count: paid.length, total: sum(paid) },
    financeNames: src.financeNames,
  }
}
