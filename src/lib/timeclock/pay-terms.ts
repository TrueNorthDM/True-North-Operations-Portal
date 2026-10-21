/**
 * How people are paid and who approves them (Clocky part 2, migration 115):
 * the pay terms (Pays as, the fixed amount, the hours allowance), the invoice
 * settings (who approves invoices, the Deputy Director, Finance), and the
 * routing input each person's timesheet is decided with (lib/timeclock/
 * routing.ts).
 *
 * Money rule (README_PART2, "Team Leaders never see invoices or money"): pay
 * is shown to the person, Super Admins, Admins and Finance, never to Team
 * Leaders or anyone else. `seesMoney` is the one place that says so. Reads go
 * through the privileged client after that check, as the rest of the money in
 * the portal does.
 *
 * Not a "use server" file.
 */

import type { Access } from '@/lib/access/resolve'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PaysAs, RoutePerson, RouteSettings } from './routing'
import { loadAllowanceUse } from './allowance-data'

export interface PayTerms {
  personId: string
  /** Null for employees (Rippling payroll). */
  paysAs: PaysAs | null
  /** people.internal_rate: Rates & Costs "Rate / cost". Hourly invoices use it. */
  hourlyRate: number | null
  /** people.monthly_salary: Rates & Costs "Month / salary". Fixed invoices use it. */
  fixedAmount: number | null
  allowance: { hours: number; period: 'week' | 'month' } | null
}

export interface InvoiceSettings extends RouteSettings {
  prefix: string
  nextNumber: number
  rmbPrefix: string
  rmbNextNumber: number
  billingName: string | null
  billingAddress: string | null
  billingEmail: string | null
  paymentDays: number
  finance: readonly string[]
}

const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v))

export async function loadInvoiceSettings(): Promise<InvoiceSettings> {
  const { data, error } = await createAdminClient().from('invoice_settings').select('*').eq('singleton_id', 1).maybeSingle()
  if (error) throw new Error(`Invoice settings could not be read: ${error.message}`)
  const s = data ?? null
  return {
    prefix: s?.prefix ?? 'INV',
    nextNumber: s?.next_number ?? 1,
    rmbPrefix: s?.rmb_prefix ?? 'RMB',
    rmbNextNumber: s?.rmb_next_number ?? 1,
    billingName: s?.billing_name ?? null,
    billingAddress: s?.billing_address ?? null,
    billingEmail: s?.billing_email ?? null,
    paymentDays: s?.payment_days ?? 15,
    invoiceApprovers: s?.invoice_approvers ?? [],
    defaultApprover: s?.default_approver ?? null,
    deputyDirector: s?.deputy_director ?? null,
    finance: s?.finance ?? [],
  }
}

/** Sees someone's pay and invoices: themselves, Super Admins, Admins and Finance. Never Team Leaders. */
export function seesMoney(access: Pick<Access, 'isAdmin' | 'personId'>, personId: string | null, settings: Pick<InvoiceSettings, 'finance'>): boolean {
  if (access.isAdmin) return true
  if (!access.personId) return false
  return access.personId === personId || settings.finance.includes(access.personId)
}

/** Finance: marks invoices and reimbursement documents paid. */
export const isFinance = (access: Pick<Access, 'personId'>, settings: Pick<InvoiceSettings, 'finance'>): boolean =>
  !!access.personId && settings.finance.includes(access.personId)


type PersonRow = { id: string; manager_id: string | null; employment_type: string | null; internal_rate: number | null; monthly_salary: number | null }
type TermsRow = { person_id: string; pays_as: PaysAs | null; allowance_hours: number | null; allowance_period: 'week' | 'month' | null }

/** Pay terms and routing input for some people (all when no ids). Money included: call after seesMoney. */
export async function loadPayTerms(personIds?: readonly string[]): Promise<Map<string, PayTerms & { route: RoutePerson }>> {
  const c = createAdminClient()
  let pq = c.from('people').select('id, manager_id, employment_type, internal_rate, monthly_salary')
  let tq = c.from('pay_terms').select('person_id, pays_as, allowance_hours, allowance_period')
  if (personIds) { pq = pq.in('id', [...personIds]); tq = tq.in('person_id', [...personIds]) }
  const [{ data: people, error: e1 }, { data: terms, error: e2 }] = await Promise.all([pq, tq])
  if (e1) throw new Error(`People could not be read: ${e1.message}`)
  if (e2) throw new Error(`Pay terms could not be read: ${e2.message}`)
  const byPerson = new Map(((terms ?? []) as TermsRow[]).map(t => [t.person_id, t]))
  const out = new Map<string, PayTerms & { route: RoutePerson }>()
  for (const p of (people ?? []) as PersonRow[]) {
    const t = byPerson.get(p.id)
    const isContractor = p.employment_type === 'contractor'
    // A contractor with no row yet is paid by the hour (what everyone was until part 2).
    const paysAs: PaysAs | null = isContractor ? t?.pays_as ?? 'hourly' : null
    out.set(p.id, {
      personId: p.id,
      paysAs,
      hourlyRate: num(p.internal_rate),
      fixedAmount: num(p.monthly_salary),
      allowance: t?.allowance_hours != null && t.allowance_period ? { hours: Number(t.allowance_hours), period: t.allowance_period } : null,
      route: { personId: p.id, reportsTo: p.manager_id, isContractor, paysAs },
    })
  }
  return out
}

/** Routing input only (no money): who reports to whom, contractor or not, Pays as. */
export async function loadRoutes(personIds?: readonly string[]): Promise<Map<string, RoutePerson>> {
  const terms = await loadPayTerms(personIds)
  return new Map([...terms].map(([id, t]) => [id, t.route]))
}

/**
 * Rates & Costs' Pays as, Allowance and Over (10A-2) for the people on it.
 * Money-free by itself, but it sits in a money tab: call it only with d-rates.
 */
export async function loadRatesPay(personIds: readonly string[], canEdit: boolean): Promise<{
  byPerson: Record<string, { isContractor: boolean; paysAs: PaysAs | null; allowance: { hours: number; period: 'week' | 'month' } | null; overSeconds: number | null }>
  canEdit: boolean
} | null> {
  try {
    const terms = await loadPayTerms(personIds)
    const use = await loadAllowanceUse(terms)
    return {
      byPerson: Object.fromEntries([...terms.values()].map(t => [t.personId, {
        isContractor: t.route.isContractor, paysAs: t.paysAs, allowance: t.allowance, overSeconds: use.get(t.personId)?.over ?? null,
      }])),
      canEdit,
    }
  } catch (e) {
    // The columns are left out rather than the tab failing (migration 115 not run yet).
    console.error('[rates pay]', e instanceof Error ? e.message : e)
    return null
  }
}
