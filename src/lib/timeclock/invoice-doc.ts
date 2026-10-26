/**
 * An invoice row and its lines as the document the portal draws (InvoiceDoc):
 * the 6C page, the invoice detail (6F), its PDF and the Payments tab use the
 * same one, so the screen and the file never disagree. Pure: no database.
 */

import { dateLabel } from './format'
import { formatDuration } from './rounding'

export type InvRow = {
  id: number; number: string; submission_id: number | null; person_id: string; total: number; kind: string; state: string
  period_start: string; period_end: string; issued_on: string; due_on: string; created_at: string
  approved_by: string | null; approved_at: string | null; paid_on: string | null; paid_ref: string | null
  from_snapshot: { name?: string; location?: string; email?: string }; to_snapshot: { name?: string; address?: string; email?: string }
}
export const INV_COLS = 'id, number, submission_id, person_id, total, kind, state, period_start, period_end, issued_on, due_on, created_at, approved_by, approved_at, paid_on, paid_ref, from_snapshot, to_snapshot'

export type LineRow = { kind: string; client: string | null; description: string; hours_seconds: number | null; rate: number | null; amount: number }
export const LINE_COLS = 'kind, client, description, hours_seconds, rate, amount'

export type DocTone = 'ok' | 'warn' | 'bad' | 'neu' | 'teal'

export interface InvoiceDocView {
  id: number; number: string; date: string; period: string; due: string; state: { label: string; tone: DocTone }
  lines: { desc: string; hrs: string; muted: boolean; rate: string; amt: string }[]
  reimb: { desc: string; cat: string; amt: string }[]
  total: string
  from: { name: string; line: string; email: string }
  to: { name: string; line1: string; line2: string }
  paid: string | null
}

export const usd = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** A reimbursement in its own currency: dollars as "$45.00", others with their code ("KES 4,500.00"); Finance converts at the expense date. */
export const money = (n: number, currency = 'USD') => (currency === 'USD' ? usd(n) : `${currency} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)

/** A total over several currencies, never added across them: "$120.00 + KES 4,500.00". */
export function moneyTotal(items: readonly { amount: number; currency?: string | null }[]): string {
  const by = new Map<string, number>()
  for (const i of items) { const c = i.currency || 'USD'; by.set(c, (by.get(c) ?? 0) + Math.round(i.amount * 100)) }
  if (!by.size) return usd(0)
  return [...by.entries()].sort(([a], [b]) => (a === 'USD' ? -1 : b === 'USD' ? 1 : a.localeCompare(b))).map(([c, cents]) => money(cents / 100, c)).join(' + ')
}

/** "INV-2026-142 · Paid Nov 12, 2026 · WISE-88412" without the number: the paid stamp and the Paid column. */
export const paidText = (paidOn: string, ref: string | null): string => `${dateLabel(paidOn)}${ref ? ` · ${ref}` : ''}`

export function invoiceDocOf(i: InvRow, lines: LineRow[], periodName: string): InvoiceDocView {
  const st = i.state === 'approved' ? { label: 'Approved', tone: 'ok' as const } : i.state === 'paid' ? { label: 'Paid', tone: 'ok' as const } : i.state === 'draft' ? { label: 'Draft', tone: 'neu' as const } : { label: 'Waiting for approval', tone: 'warn' as const }
  const to = (i.to_snapshot?.address ?? '').split('\n')
  return {
    id: i.id, number: i.number, date: dateLabel(i.issued_on), period: periodName, due: dateLabel(i.due_on), state: st,
    lines: lines.filter(l => l.kind !== 'reimbursement').map(l => ({
      desc: l.description, hrs: l.hours_seconds != null ? formatDuration(l.hours_seconds) : '–', muted: l.kind === 'fixed',
      rate: l.kind === 'fixed' ? 'Fixed' : l.rate != null ? usd(Number(l.rate)) : '', amt: usd(Number(l.amount)),
    })),
    reimb: lines.filter(l => l.kind === 'reimbursement').map(l => ({ desc: l.description, cat: l.client ?? '', amt: usd(Number(l.amount)) })),
    total: usd(Number(i.total)),
    from: { name: i.from_snapshot?.name ?? '', line: i.from_snapshot?.location ?? '', email: i.from_snapshot?.email ?? '' },
    to: { name: i.to_snapshot?.name ?? 'True North Digital Marketing', line1: to[0] ?? '', line2: [to.slice(1).join(', '), i.to_snapshot?.email].filter(Boolean).join(' · ') },
    paid: i.state === 'paid' && i.paid_on ? `Paid ${paidText(i.paid_on, i.paid_ref)}` : null,
  }
}
