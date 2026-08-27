'use server'

/** Adding and removing hours by hand. Admins only: this becomes an invoice. */

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isSecurityAdmin } from '@/lib/auth/role'
import { loadCurrentPerson } from '@/lib/directory/current-person'
import { I7_CODE_CF, ACTIVITY_CF } from '@/lib/tsheets/i7report'
import { ERROR_TEXT, toSeconds, validateManualEntry, type ManualEntryInput } from './manual-entry'

type Result = { ok: boolean; error?: string }

/** tc_fields ids for the two fields the i7 report groups by. */
async function fieldIds(supabase: ReturnType<typeof createAdminClient>) {
  const { data } = await supabase
    .from('tc_fields').select('id, external_id')
    .in('external_id', [Number(I7_CODE_CF), Number(ACTIVITY_CF)])
  const rows = (data ?? []) as { id: number; external_id: number | null }[]
  const find = (ext: string) => rows.find(r => String(r.external_id) === ext)?.id ?? null
  return { code: find(I7_CODE_CF), activity: find(ACTIVITY_CF) }
}

export async function addManualEntry(input: ManualEntryInput): Promise<Result> {
  if (!(await isSecurityAdmin())) return { ok: false, error: 'Admins only.' }

  const today = new Date().toISOString().slice(0, 10)
  const bad = validateManualEntry(input, today)
  if (bad) return { ok: false, error: ERROR_TEXT[bad] }

  const supabase = createAdminClient()
  const fields = await fieldIds(supabase)

  // The report groups by these two, so an entry missing them lands in the
  // tree under a blank code and is effectively invisible where it matters.
  if (!fields.code || !fields.activity) {
    return { ok: false, error: 'The i7 code and activity fields are not synced yet.' }
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
    fields: { [fields.code]: input.i7Code, [fields.activity]: input.activity },
    created_by: me?.id ?? null,
  })
  if (error) return { ok: false, error: error.message }

  revalidatePath('/tools/time-report')
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
  return { ok: true }
}
