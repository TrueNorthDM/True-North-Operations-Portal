'use server'

/**
 * Adding and removing hours by hand, from the client reports. This becomes an
 * invoice, so since the audit of 9 October 2026:
 * - the item asked for follows the job code's branch: i7-manual for the i7
 *   tree, ph-manual for the rest (either one used to open both);
 * - nobody adds hours for themselves: they land approved, so that would be
 *   approving one's own hours;
 * - every line of a batch carries the batch (migration 101), so the same batch
 *   sent twice lands once, and the panel lists and removes only what it added;
 * - a removal must remove exactly one such row, and is written to the entry
 *   history (tc_entry_audit);
 * - nobody's hours go past their allowance plus the extra hours approved,
 *   whoever adds them (owner, 25 October 2026): the same limit and the same
 *   sentence as North Time's Time entries (allowance-limit.ts).
 */

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
import { ERROR_TEXT, manualAdds, toSeconds, validateManualEntry, type ManualEntryInput } from './manual-entry'
import { limitRefusal } from './allowance-limit'
import { dateInZone } from './clock'
import { structureOn } from './entry-rules'
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
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** The company's day, not the server's or UTC's: after 8 pm in New York, UTC is already tomorrow. */
const COMPANY_ZONE = 'America/New_York'

const NOT_ADDED = 'The hours were not added. Try again in a moment.'
const NOT_REMOVED = 'The line was not removed. Try again in a moment.'

/**
 * A database refusal, as the result the panel shows: a plain sentence for the
 * person, the database's wording in the server log. Returned, not thrown
 * (audit, 13 October 2026): the try/catch around each action stays only for
 * what nobody here expects to fail.
 */
function failed(step: string, error: { message: string }, sentence: string): { ok: false; error: string } {
  console.error(`[manual hours] ${step}:`, error.message)
  return { ok: false, error: sentence }
}

/** The person really signed in, never a View Stage preview's. */
async function realMe() {
  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()
  return loadCurrentPerson(session, user ?? null, { real: true })
}

/** `batchId`: made once per batch in the browser, so a batch sent twice lands once. */
export async function addManualEntries(inputs: ManualEntryInput[], batchId: string): Promise<Result> {
  try {
    return await addBatch(inputs, batchId)
  } catch (e) {
    console.error('[manual hours] add:', (e as Error).message)
    return { ok: false, error: NOT_ADDED }
  }
}

async function addBatch(inputs: ManualEntryInput[], batchId: string): Promise<Result> {
  const [mayI7, mayPh] = [await allowedTo('i7-manual'), await allowedTo('ph-manual')]
  if (!mayI7 && !mayPh) return { ok: false, error: 'You cannot add manual hours.' }
  if (!Array.isArray(inputs) || !inputs.length) return { ok: false, error: 'Add a line first.' }
  if (typeof batchId !== 'string' || !UUID.test(batchId)) return { ok: false, error: 'Reload the page and try again.' }

  // Named by position, but only when there is more than one: "Line 1:" in front
  // of the only line on screen is a label for something nobody is choosing
  // between.
  const at = (i: number) => (inputs.length > 1 ? `Line ${i + 1}: ` : '')

  const today = dateInZone(new Date(), COMPANY_ZONE)
  for (const [i, input] of inputs.entries()) {
    const bad = validateManualEntry(input, today)
    if (bad) return { ok: false, error: `${at(i)}${ERROR_TEXT[bad]}` }
  }

  const me = await realMe()
  if (!me) return { ok: false, error: 'Your login is not linked to anyone in the Directory.' }

  const supabase = createAdminClient()
  const keys = await loadEntryFieldKeys(supabase)
  const i7Ids = await i7JobcodeIdsHere(supabase)
  const rates = await loadI7Assignments()

  // The job codes named: real, still active, and a code rather than a folder.
  const jobIds = [...new Set(inputs.map(i => i.jobcodeId))]
  const [{ data: jobs, error: jobsErr }, { data: sw, error: swErr }] = await Promise.all([
    supabase.from('tc_jobcodes').select('id, active, kind, structure').in('id', jobIds),
    supabase.from('tc_settings').select('structure_switch_date').eq('singleton_id', 1).maybeSingle(),
  ])
  if (jobsErr) return failed('job codes', jobsErr, NOT_ADDED)
  // Unread is not "no switch date": a line could land in the wrong structure.
  if (swErr) return failed('the structure switch date', swErr, NOT_ADDED)
  const switchDate = (sw as { structure_switch_date: string | null } | null)?.structure_switch_date ?? null
  const jobById = new Map(((jobs ?? []) as { id: number; active: boolean | null; kind: string | null; structure: number | null }[]).map(j => [j.id, j]))
  const { data: kids, error: kidsErr } = await supabase.from('tc_jobcodes').select('parent_id').in('parent_id', jobIds)
  if (kidsErr) return failed('job code folders', kidsErr, NOT_ADDED)
  const activeIds = new Set(((jobs ?? []) as { id: number; active: boolean | null }[]).filter(j => j.active !== false).map(j => j.id))
  const folders = new Set(((kids ?? []) as { parent_id: number }[]).map(k => k.parent_id))

  const rows = []
  for (const [i, input] of inputs.entries()) {
    const isI7 = i7Ids.has(input.jobcodeId)
    if (isI7 ? !mayI7 : !mayPh) {
      return { ok: false, error: `${at(i)}Your access does not add hours to ${isI7 ? 'the i7 report' : 'Project Hours'}.` }
    }
    if (input.personId === me.id) {
      return { ok: false, error: `${at(i)}These hours would be approved as they are added, so someone else adds your own.` }
    }
    if (!activeIds.has(input.jobcodeId) || folders.has(input.jobcodeId) || (jobById.get(input.jobcodeId)?.kind ?? 'regular') !== 'regular') {
      return { ok: false, error: `${at(i)}Choose an active job code, not a folder.` }
    }
    // These lines carry the TSheets fields: only a TSheets job, on a day before the switch date.
    if ((jobById.get(input.jobcodeId)?.structure ?? 1) !== 1 || structureOn(input.entryDate, switchDate) !== 1) {
      return { ok: false, error: `${at(i)}From the switch date hours go in North Time > Time entries, on a 2026 project. This list adds hours to the TSheets jobs before that day.` }
    }
    if (isI7 && !input.i7Code?.trim()) {
      return { ok: false, error: `${at(i)}Choose the i7 code: without it the hours land under Unassigned.` }
    }
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
      created_by: me.id,
      manual_batch: batchId,
      manual_line: i,
    })
  }

  // Not past anyone's allowance, in each week or month the lines fall in. The
  // lines of this batch already there (sent twice) are left out of the count,
  // so a retry lands once instead of being refused by itself.
  const people = [...new Set(inputs.map(i => i.personId))]
  const [{ data: landed, error: landedErr }, { data: names, error: namesErr }] = await Promise.all([
    supabase.from('tc_entries').select('id').eq('manual_batch', batchId),
    supabase.from('people').select('id, full_name').in('id', people),
  ])
  if (landedErr) return failed('batch', landedErr, NOT_ADDED)
  if (namesErr) return failed('names', namesErr, NOT_ADDED)
  const exclude = ((landed ?? []) as { id: number }[]).map(r => r.id)
  const nameOf = new Map(((names ?? []) as { id: string; full_name: string }[]).map(p => [p.id, p.full_name]))
  const now = new Date()
  for (const [personId, add] of manualAdds(inputs)) {
    const limit = await limitRefusal(personId, { add, exclude }, now, nameOf.get(personId) ?? 'This person')
    if (limit) return { ok: false, error: limit }
  }

  const { error } = await supabase.from('tc_entries').insert(rows)
  // The batch already landed (a double click, a retry after a timeout): it is
  // there once, which is what was asked for.
  if (error && !(error.code === '23505' && /manual_batch/.test(error.message))) return failed('insert', error, NOT_ADDED)

  revalidatePath(ROUTES.i7)
  revalidatePath(ROUTES.projectHours)
  return { ok: true }
}

/** Removes one line the panel added (and only such a line), with a history entry. */
export async function deleteManualEntry(id: number): Promise<Result> {
  try {
    const [mayI7, mayPh] = [await allowedTo('i7-manual'), await allowedTo('ph-manual')]
    if (!mayI7 && !mayPh) return { ok: false, error: 'You cannot remove manual hours.' }
    if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'That line is not there any more. Reload the page.' }
    const me = await realMe()
    if (!me) return { ok: false, error: 'Your login is not linked to anyone in the Directory.' }

    const supabase = createAdminClient()
    const { data: before, error: readErr } = await supabase.from('tc_entries').select('*')
      .eq('id', id).eq('kind', 'manual').is('external_id', null).not('manual_batch', 'is', null).maybeSingle()
    if (readErr) return failed('read', readErr, NOT_REMOVED)
    if (!before) return { ok: false, error: 'That line is not there any more. Reload the page.' }
    const isI7 = (await i7JobcodeIdsHere(supabase)).has((before as { jobcode_id: number }).jobcode_id)
    if (isI7 ? !mayI7 : !mayPh) return { ok: false, error: `Your access does not remove hours from ${isI7 ? 'the i7 report' : 'Project Hours'}.` }

    const { data: gone, error } = await supabase.from('tc_entries').delete()
      .eq('id', id).not('manual_batch', 'is', null).select('id')
    if (error) return failed('delete', error, NOT_REMOVED)
    if ((gone ?? []).length !== 1) return { ok: false, error: 'That line is not there any more. Reload the page.' }

    const { error: auditErr } = await supabase.from('tc_entry_audit').insert({
      entry_id: null, action: 'delete', changed_by: me.id, before: before as never, after: null,
    })
    if (auditErr) console.error('[manual hours] audit:', auditErr.message)

    revalidatePath(ROUTES.i7)
    revalidatePath(ROUTES.projectHours)
    return { ok: true }
  } catch (e) {
    console.error('[manual hours] delete:', (e as Error).message)
    return { ok: false, error: NOT_REMOVED }
  }
}
