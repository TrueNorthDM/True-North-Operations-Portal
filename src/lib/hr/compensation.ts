/**
 * The pay columns, read the only way that still works.
 *
 * WHY THIS EXISTS. `people_read` and the tr_* read policies grant SELECT to the
 * `authenticated` role with USING (true). That role is the same one for an
 * admin and for a first-week hire, because RLS decides which ROWS you see and
 * has nothing to say about columns. So while the Directory correctly redacts
 * pay before anything reaches the browser (levels 1 and 2 get a RestrictedPerson
 * with no rate on it), anyone signed in could skip the page entirely:
 *
 *   GET /rest/v1/people?select=full_name,monthly_salary,internal_rate
 *   GET /rest/v1/tr_assignments?select=tsheets_user_id,hourly_rate
 *
 * with the public anon key from the JS bundle and their own session token out of
 * localStorage. Not an exploit, just devtools.
 *
 * Migration 054 revokes those three columns from `authenticated` at the
 * privilege level, which is the mechanism that actually understands columns.
 * After it, NO session can read them: not a leaked token, not a hijacked
 * session, not an admin's own browser. The service-role client can, and that is
 * what this module is.
 *
 * The rule in lib/supabase/admin.ts still holds: the service-role client must
 * not act on user input. Nothing here takes any. Fixed tables, fixed columns,
 * one optional client id that is looked up from our own data. The gate stays
 * where it already was, in the pages and actions that call this, all of which
 * are behind directory level 3, requireSurface, or requireAdmin.
 *
 * A limit worth stating: the Clients Report shows hours per person and cost per
 * project to team leaders, so on a single-person project the rate is arithmetic.
 * Locking the column does not close that, and closing it would mean changing
 * what the report shows, which is a product decision rather than a security one.
 */

import { createAdminClient } from '@/lib/supabase/admin'

export interface Compensation {
  /** people.internal_rate: cost per hour. */
  internalRate: number | null
  /** people.monthly_salary: flat monthly cost, for staff not paid hourly. */
  monthlySalary: number | null
}

/**
 * Pay per person, keyed by people.id.
 *
 * Returned as a map so callers can drop these columns from their own `people`
 * select and merge afterwards, instead of every read site needing its own
 * privileged query.
 */
export async function loadCompensationByPerson(): Promise<Map<string, Compensation>> {
  const admin = createAdminClient()
  const { data } = await admin.from('people').select('id, internal_rate, monthly_salary')
  const rows = (data ?? []) as { id: string; internal_rate: number | null; monthly_salary: number | null }[]
  return new Map(
    rows.map(r => [r.id, {
      internalRate: r.internal_rate != null ? Number(r.internal_rate) : null,
      monthlySalary: r.monthly_salary != null ? Number(r.monthly_salary) : null,
    }]),
  )
}

export interface AssignmentRate {
  id: number
  tsheetsUserId: number
  clientId: number
  hourlyRate: number
  effectiveFrom: string | null
  effectiveTo: string | null
}

/**
 * Billing rates from tr_assignments.
 *
 * `clientId` narrows to one client; `activeOnly` keeps just the open, active
 * assignment per person, which is what the settings screens list. Both are
 * plain filters over our own data, not user input.
 */
export async function loadAssignmentRates(
  opts: { clientId?: number; activeOnly?: boolean } = {},
): Promise<AssignmentRate[]> {
  const admin = createAdminClient()
  let q = admin
    .from('tr_assignments')
    .select('id, tsheets_user_id, client_id, hourly_rate, effective_from, effective_to')
  if (opts.clientId != null) q = q.eq('client_id', opts.clientId)
  if (opts.activeOnly) q = q.is('effective_to', null).eq('active', true)

  const { data } = await q
  const rows = (data ?? []) as {
    id: number; tsheets_user_id: number; client_id: number
    hourly_rate: number; effective_from: string | null; effective_to: string | null
  }[]
  return rows.map(r => ({
    id: r.id,
    tsheetsUserId: r.tsheets_user_id,
    clientId: r.client_id,
    hourlyRate: Number(r.hourly_rate),
    effectiveFrom: r.effective_from,
    effectiveTo: r.effective_to,
  }))
}

/**
 * The rate/salary change history.
 *
 * tr_audit_log stores the old and new values in before_data/after_data, so
 * leaving it readable while locking the columns themselves would have been
 * theatre: /rest/v1/tr_audit_log returns the same numbers. Migration 054 makes
 * it admin-only, and this is how the screens that legitimately show it read it.
 */
export async function loadAuditLog(limit = 100) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('tr_audit_log')
    .select('id, entity_type, entity_id, action, before_data, after_data, justification, changed_at, changed_by')
    .order('changed_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

/** One person's pay, for the audit "before" snapshot on a save. */
export async function loadPersonCompensation(personId: string): Promise<(Compensation & { fullName: string }) | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('people')
    .select('id, full_name, internal_rate, monthly_salary')
    .eq('id', personId)
    .maybeSingle()
  if (!data) return null
  const r = data as { full_name: string; internal_rate: number | null; monthly_salary: number | null }
  return {
    fullName: r.full_name,
    internalRate: r.internal_rate != null ? Number(r.internal_rate) : null,
    monthlySalary: r.monthly_salary != null ? Number(r.monthly_salary) : null,
  }
}
