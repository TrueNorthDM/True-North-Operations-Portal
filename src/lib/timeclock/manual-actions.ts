'use server'

/** Adding and removing hours by hand. Admins only: this becomes an invoice. */

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { allowedTo } from '@/lib/access/resolve'
import { loadCurrentPerson } from '@/lib/directory/current-person'
import { loadEntryFieldKeys } from './manual-fields'
import { i7JobcodeIdsHere } from './report-source'
import { loadI7Assignments } from '@/lib/tsheets/report-data'
import { rateStateFor } from '@/lib/tsheets/rates'
import { monthName } from './periods'
import { ERROR_TEXT, toSeconds, validateManualEntry, type ManualEntryInput } from './manual-entry'
import { ROUTES } from '@/lib/nav/routes'

type Result = { ok: boolean; error?: string }

/**
 * Several lines at once, all of them or none.
 *
 * An invoice is a handful of lines for one person, and adding them one at a
 * time meant opening and closing the form once per line. Batching them raises
 * the question of what a half-written batch means, and the answer has to be
 * nothing: a partial one is the worst outcome available here, because you
 * cannot tell from the screen which lines landed, and re-entering the batch to
 * be safe bills the client twice.
 *
 * So everything is checked before anything is written, and the write is a
 * single insert, which Postgres either applies whole or not at all.
 */
export async function addManualEntries(inputs: ManualEntryInput[]): Promise<Result> {
  if (!(await allowedTo('i7-manual')) && !(await allowedTo('ph-manual'))) return { ok: false, error: 'You cannot add manual hours.' }
  if (!inputs.length) return { ok: false, error: 'Add a line first.' }

  // Named by position, but only when there is more than one: "Line 1:" in front
  // of the only line on screen is a label for something nobody is choosing
  // between.
  const at = (i: number) => (inputs.length > 1 ? `Line ${i + 1}: ` : '')

  const today = new Date().toISOString().slice(0, 10)
  for (const [i, input] of inputs.entries()) {
    const bad = validateManualEntry(input, today)
    if (bad) return { ok: false, error: `${at(i)}${ERROR_TEXT[bad]}` }
  }

  const supabase = createAdminClient()
  const keys = await loadEntryFieldKeys(supabase)
  const i7Ids = await i7JobcodeIdsHere(supabase)
  const rates = await loadI7Assignments()

  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()
  // Who added them: the person really signed in, never a View Stage preview.
  const me = await loadCurrentPerson(session, user ?? null, { real: true })

  const rows = []
  for (const [i, input] of inputs.entries()) {
    const isI7 = i7Ids.has(input.jobcodeId)
    const month = input.entryDate.slice(0, 7)
    const state = isI7 ? rateStateFor(rates, input.personId, month) : 'rated'
    if (state !== 'rated') {
      const { data: who } = await supabase
        .from('people').select('full_name').eq('id', input.personId).maybeSingle()
      const name = (who as { full_name: string } | null)?.full_name ?? 'This person'
      return {
        ok: false,
        error: state === 'outside'
          ? `${at(i)}${name} has an i7 rate, but it does not cover ${monthName(month)}. In Rates & Costs, start the rate on or before this month, then add the hours.`
          : `${at(i)}${name} has no i7 rate. Set one in Rates & Costs first, otherwise these hours reach the invoice costing nothing.`,
      }
    }
    if (!keys.activity || (isI7 && !keys.code)) {
      return { ok: false, error: 'The QuickBooks Time fields are not synced yet.' }
    }
    rows.push({
      person_id: input.personId,
      jobcode_id: input.jobcodeId,
      duration_seconds: toSeconds(input.hours),
      entry_date: input.entryDate,
      kind: 'manual',
      source: 'portal',
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
  }

  const { error } = await supabase.from('tc_entries').insert(rows)
  if (error) return { ok: false, error: error.message }

  revalidatePath(ROUTES.i7)
  revalidatePath(ROUTES.projectHours)
  return { ok: true }
}

export async function deleteManualEntry(id: number): Promise<Result> {
  if (!(await allowedTo('i7-manual')) && !(await allowedTo('ph-manual'))) return { ok: false, error: 'You cannot add manual hours.' }

  const { error } = await createAdminClient()
    .from('tc_entries').delete().eq('id', id).eq('kind', 'manual').is('external_id', null)
  if (error) return { ok: false, error: error.message }

  revalidatePath(ROUTES.i7)
  revalidatePath(ROUTES.projectHours)
  return { ok: true }
}
