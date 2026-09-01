'use server'

/** Adding and removing hours by hand. Admins only: this becomes an invoice. */

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isSecurityAdmin } from '@/lib/auth/role'
import { loadCurrentPerson } from '@/lib/directory/current-person'
import { loadEntryFieldKeys } from './manual-fields'
import { i7JobcodeIdsHere } from './report-source'
import { loadI7Assignments } from '@/lib/tsheets/report-data'
import { rateStateFor } from '@/lib/tsheets/rates'
import { monthName } from './periods'
import { ERROR_TEXT, toSeconds, validateManualEntry, type ManualEntryInput } from './manual-entry'

type Result = { ok: boolean; error?: string }

export async function addManualEntry(input: ManualEntryInput): Promise<Result> {
  if (!(await isSecurityAdmin())) return { ok: false, error: 'Admins only.' }

  const today = new Date().toISOString().slice(0, 10)
  const bad = validateManualEntry(input, today)
  if (bad) return { ok: false, error: ERROR_TEXT[bad] }

  const supabase = createAdminClient()
  const keys = await loadEntryFieldKeys(supabase)

  // Whether this entry lands in the i7 report, which is the branch that groups
  // by the i7 code and the only one where an hour becomes money.
  const isI7 = (await i7JobcodeIdsHere(supabase)).has(input.jobcodeId)

  // A rate has to cover the day being added, or this entry reaches an invoice
  // costing nothing. The form warns about it, but a warning is only advice and
  // the two ways of costing zero look identical once the invoice is out, so
  // the write refuses rather than letting it through.
  //
  // Asked through the same lookup the report uses, so a refusal here always
  // means the report really would have counted the hours at zero.
  //
  // Only inside the i7 tree. The Grant Pass report counts hours and shows no
  // cost, so demanding a rate for one of its entries would enforce a rule that
  // does not exist over there.
  const month = input.entryDate.slice(0, 7)
  const state = isI7 ? rateStateFor(await loadI7Assignments(), input.personId, month) : 'rated'
  if (state !== 'rated') {
    const { data: who } = await supabase
      .from('people').select('full_name').eq('id', input.personId).maybeSingle()
    const name = (who as { full_name: string } | null)?.full_name ?? 'This person'
    return {
      ok: false,
      error: state === 'outside'
        ? `${name} has an i7 rate, but it does not cover ${monthName(month)}. In Rates & Costs, start the rate on or before this month, then add the hours.`
        : `${name} has no i7 rate. Set one in Rates & Costs first, otherwise these hours reach the invoice costing nothing.`,
    }
  }

  // A report groups by the activity, so an entry missing it lands under a blank
  // one and is effectively invisible where it matters. The i7 code is required
  // only for an i7 entry, which is the branch that groups by it.
  if (!keys.activity || (isI7 && !keys.code)) {
    return { ok: false, error: 'The QuickBooks Time fields are not synced yet.' }
  }

  // Who is adding it. The entry says manual and says who, which together are
  // the whole audit trail: nothing else records that a person typed this.
  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()
  const me = await loadCurrentPerson(session, user ?? null)

  const { error } = await supabase.from('tc_entries').insert({
    person_id: input.personId,
    jobcode_id: input.jobcodeId,
    duration_seconds: toSeconds(input.hours),
    entry_date: input.entryDate,
    kind: 'manual',
    source: 'portal',
    // Approved on arrival: it is read off an invoice that has already been
    // agreed, and a queue nobody watches would hold hours out of the report
    // for reasons nobody remembers.
    state: 'approved',
    notes: input.notes || null,
    fields: {
      ...(keys.code && input.i7Code ? { [keys.code]: input.i7Code } : {}),
      [keys.activity]: input.activity,
      ...(keys.company && input.company ? { [keys.company]: input.company } : {}),
      ...(keys.project && input.project ? { [keys.project]: input.project } : {}),
      ...(keys.billable && input.billable ? { [keys.billable]: input.billable } : {}),
    },
    created_by: me?.id ?? null,
  })
  if (error) return { ok: false, error: error.message }

  revalidatePath('/tools/time-report')
  revalidatePath('/tools/time-report/grant-pass')
  return { ok: true }
}

/**
 * Remove an entry added by hand.
 *
 * Only ever a manual one. A synced entry deleted here would come back on the
 * next pull, so the button would work once and then appear broken.
 */
export async function deleteManualEntry(id: number): Promise<Result> {
  if (!(await isSecurityAdmin())) return { ok: false, error: 'Admins only.' }

  const { error } = await createAdminClient()
    .from('tc_entries').delete().eq('id', id).eq('kind', 'manual').is('external_id', null)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/tools/time-report')
  revalidatePath('/tools/time-report/grant-pass')
  return { ok: true }
}
