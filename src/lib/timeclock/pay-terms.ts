/**
 * How people are paid and who approves them (Clocky part 2, migration 115):
 * the pay terms (Pays as, the fixed amount, the hours allowance), the invoice
 * settings (who approves invoices and reimbursements, the Deputy Director,
 * Finance), and the
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

import { cache } from 'react'
import type { Access } from '@/lib/access/resolve'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadAudience } from '@/lib/notifications/audience'
import { requestDeciders, type PaysAs, type RequestKind, type RoutePerson, type RouteSettings } from './routing'
import { loadAllowanceUse } from './allowance-data'
import { allowanceFromWeeklyHours } from './allowance'
import { DEFAULT_MILEAGE_RATE } from './reimbursement-rules'

export interface PayTerms {
  personId: string
  /** Null for employees (Rippling payroll). */
  paysAs: PaysAs | null
  /** people.internal_rate: Rates & Costs "Rate / cost". Hourly invoices use it. */
  hourlyRate: number | null
  /** people.monthly_salary: Rates & Costs "Month / salary". Fixed invoices use it. */
  fixedAmount: number | null
  /**
   * The allowance that applies (owner, 5 November 2026): a contractor's
   * Weekly hours (people.weekly_hours, the Work tab), a week. Null for every
   * US employee (all are salaried, so exempt) and for a contractor with no
   * Weekly hours (no limit). pay_terms.allowance_hours / allowance_period are
   * no longer read or written. The type keeps 'month' for old approved extra
   * hours and the helpers that still accept it.
   */
  allowance: { hours: number; period: 'week' | 'month' } | null
  /** A US employee: all are salaried (owner, 5 November 2026). Never a contractor. pay_terms.salaried (migration 151) is no longer read. */
  salaried: boolean
}

export interface InvoiceSettings extends RouteSettings {
  prefix: string
  nextNumber: number
  rmbPrefix: string
  rmbNextNumber: number
  /** Receipts (migration 145): RCT-2026-005. */
  rctPrefix: string
  rctNextNumber: number
  billingName: string | null
  billingAddress: string | null
  billingEmail: string | null
  paymentDays: number
  finance: readonly string[]
  /** Decide reimbursements (migration 146), chosen in Company settings > Invoices. */
  reimbursementApprovers: readonly string[]
  /** Dollars a mile for a Mileage reimbursement (migration 133; Tina's spreadsheet used 0.76). */
  mileageRate: number
  /** The invoice form's deliverable rates for everyone (migration 147): a translated page, a translated design asset. */
  pageRate: number
  assetRate: number
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
    rctPrefix: s?.rct_prefix ?? 'RCT',
    rctNextNumber: s?.rct_next_number ?? 1,
    billingName: s?.billing_name ?? null,
    billingAddress: s?.billing_address ?? null,
    billingEmail: s?.billing_email ?? null,
    paymentDays: s?.payment_days ?? 15,
    invoiceApprovers: s?.invoice_approvers ?? [],
    defaultApprover: s?.default_approver ?? null,
    deputyDirector: s?.deputy_director ?? null,
    finance: s?.finance ?? [],
    reimbursementApprovers: s?.reimbursement_approvers ?? [],
    mileageRate: num((s as { mileage_rate?: unknown } | null)?.mileage_rate) ?? DEFAULT_MILEAGE_RATE,
    pageRate: num((s as { page_rate?: unknown } | null)?.page_rate) ?? 30,
    assetRate: num((s as { asset_rate?: unknown } | null)?.asset_rate) ?? 5,
  }
}

/**
 * The invoice settings with who can decide in Approvals (routing.ts
 * `approvers`): everyone who signs in and opens Approvals, by the access rule
 * as their own pages decide it (the notifications' audience reads it the same
 * way). Routing passes anyone else over for the default approver, so a
 * timesheet never waits for someone who cannot open it. Read once per request;
 * every place that says or decides whose step it is reads this one.
 */
export const loadRouteSettings = cache(async function loadRouteSettings(): Promise<InvoiceSettings> {
  const [settings, audience] = await Promise.all([loadInvoiceSettings(), loadAudience(createAdminClient())])
  return { ...settings, approvers: audience.withTool('clocky-approvals').map(r => r.personId) }
})

/** Sees someone's pay and invoices: themselves, Super Admins, Admins and Finance. Never Team Leaders. */
export function seesMoney(access: Pick<Access, 'isAdmin' | 'personId'>, personId: string | null, settings: Pick<InvoiceSettings, 'finance'>): boolean {
  if (access.isAdmin) return true
  if (!access.personId) return false
  return access.personId === personId || settings.finance.includes(access.personId)
}

/** Finance: marks invoices and reimbursement documents paid. */
export const isFinance = (access: Pick<Access, 'personId'>, settings: Pick<InvoiceSettings, 'finance'>): boolean =>
  !!access.personId && settings.finance.includes(access.personId)

/**
 * Who is shown what waits to be paid (owner, 25 October 2026): Super Admins,
 * Admins and Finance; invoices where Invoices is open to them and
 * reimbursement documents where Reimbursements is. Only Finance marks them
 * paid (on the pages); the others see that payments are waiting. Home's "to
 * pay" lines and the rail's To pay count both read this one rule.
 */
export function paysWhat(access: Pick<Access, 'personId' | 'can' | 'isAdmin'>, settings: Pick<InvoiceSettings, 'finance'>): { invoices: boolean; documents: boolean } {
  const sees = access.isAdmin || isFinance(access, settings)
  return { invoices: sees && access.can('clocky-invoices'), documents: sees && access.can('rq-reimbursements') }
}


type PersonRow = { id: string; manager_id: string | null; employment_type: string | null; internal_rate: number | null; monthly_salary: number | null; weekly_hours: number | null }
type TermsRow = { person_id: string; pays_as: PaysAs | null }

/** Pay terms and routing input for some people (all when no ids). Money included: call after seesMoney. */
export async function loadPayTerms(personIds?: readonly string[]): Promise<Map<string, PayTerms & { route: RoutePerson }>> {
  const c = createAdminClient()
  let pq = c.from('people').select('id, manager_id, employment_type, internal_rate, monthly_salary, weekly_hours')
  let tq = c.from('pay_terms').select('person_id, pays_as')
  if (personIds) {
    pq = pq.in('id', [...personIds])
    tq = tq.in('person_id', [...personIds])
  }
  const [{ data: people, error: e1 }, { data: terms, error: e2 }] = await Promise.all([pq, tq])
  if (e1) throw new Error(`People could not be read: ${e1.message}`)
  if (e2) throw new Error(`Pay terms could not be read: ${e2.message}`)
  const byPerson = new Map(((terms ?? []) as unknown as TermsRow[]).map(t => [t.person_id, t]))
  const out = new Map<string, PayTerms & { route: RoutePerson }>()
  for (const p of (people ?? []) as PersonRow[]) {
    const t = byPerson.get(p.id)
    const isContractor = p.employment_type === 'contractor'
    // A contractor with no row yet is paid by the hour (what everyone was until part 2).
    const paysAs: PaysAs | null = isContractor ? t?.pays_as ?? 'hourly' : null
    // Every employee is salaried (owner, 5 November 2026); the per-person flag of migration 151 is not needed.
    const salaried = !isContractor
    out.set(p.id, {
      personId: p.id,
      paysAs,
      hourlyRate: num(p.internal_rate),
      fixedAmount: num(p.monthly_salary),
      allowance: allowanceFromWeeklyHours(isContractor, p.weekly_hours),
      salaried,
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
 * Who decides time off, extra hours and reimbursements (routing.ts
 * requestDeciders) for these people, with the settings every other place reads
 * (loadRouteSettings, unless the caller has them). Someone missing from the Directory reports to nobody.
 */
export async function loadRequestDeciders(personIds: readonly string[], given?: RouteSettings): Promise<(kind: RequestKind, personId: string) => string[]> {
  const ids = [...new Set(personIds)]
  const [settings, routes] = await Promise.all([given ?? loadRouteSettings(), ids.length ? loadRoutes(ids) : Promise.resolve(new Map<string, RoutePerson>())])
  return (kind, personId) => requestDeciders(kind, { personId, reportsTo: routes.get(personId)?.reportsTo ?? null }, settings)
}

/**
 * Rates & Costs' Pays as, Allowance and Over (10A-2) for the people on it.
 * Money-free by itself, but it sits in a money tab: call it only with d-rates.
 */
export async function loadRatesPay(personIds: readonly string[], canEdit: boolean): Promise<{
  byPerson: Record<string, { isContractor: boolean; paysAs: PaysAs | null; salaried: boolean; allowance: { hours: number; period: 'week' | 'month' } | null; overSeconds: number | null; pageRate: number | null; assetRate: number | null }>
  canEdit: boolean
} | null> {
  try {
    const terms = await loadPayTerms(personIds)
    const use = await loadAllowanceUse(terms)
    // Their own rates for the invoice form (migration 147); empty uses the company's.
    const { data: own, error: oErr } = await createAdminClient().from('pay_terms').select('person_id, page_rate, asset_rate').in('person_id', [...personIds])
    if (oErr) console.error('[rates pay] deliverable rates:', oErr.message)
    const ownOf = new Map((own ?? []).map(r => [r.person_id, r]))
    return {
      byPerson: Object.fromEntries([...terms.values()].map(t => [t.personId, {
        isContractor: t.route.isContractor, paysAs: t.paysAs, salaried: t.salaried, allowance: t.allowance, overSeconds: use.get(t.personId)?.over ?? null,
        pageRate: num(ownOf.get(t.personId)?.page_rate), assetRate: num(ownOf.get(t.personId)?.asset_rate),
      }])),
      canEdit,
    }
  } catch (e) {
    // The columns are left out rather than the tab failing (migration 115 not run yet).
    console.error('[rates pay]', e instanceof Error ? e.message : e)
    return null
  }
}
