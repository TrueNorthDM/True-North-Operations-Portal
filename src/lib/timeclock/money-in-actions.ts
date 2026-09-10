'use server'

/**
 * The two ways money arrives for a project, written from the report it feeds.
 *
 * A donation is money given, restricted to a project or unrestricted. A
 * purchase is hours bought in advance, which only Grants Pass Church and School
 * do, at $90. They are the same act from the report's side, money arriving in a
 * month, which is why they share a screen and this file.
 *
 * Both are typed in by hand, permanently. Asked where the figures come from:
 * "I will need to manually enter the donations as there isn't a way to add that
 * in the workflow. The figures come from checks and online donations."
 *
 * Written through the privileged client, like every other write that touches a
 * client report. The permission is decided here, above, from the access level,
 * rather than by row-level security: that is the rule an admin can see and
 * change, and it is the reason the i7 report was wrong until September.
 */

import { revalidatePath } from 'next/cache'
import { loadAccess } from '@/lib/access/resolve'
import { createAdminClient } from '@/lib/supabase/admin'
import { TRACKED_PROJECTS } from './projects'
import { parseMoney } from './money-in-data'
import { currentActor, logDonationChange } from './donations-log'

export interface MoneyResult {
  ok: boolean
  error?: string
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/
const LABELS: string[] = TRACKED_PROJECTS.map(p => p.label)

/**
 * Admin OR Admin Assistant.
 *
 * `isAdmin` would have been the obvious check and the wrong one: it is
 * `roleType === 'admin'` exactly, and the Admin Assistant is the person who
 * holds these figures. At the database she already counts as an admin, because
 * migration 038 set profiles.role for that tier, so this is the only gate that
 * would have shut her out.
 */
async function mayWrite(): Promise<boolean> {
  const access = await loadAccess()
  return access.isPrivileged
}

/**
 * Record what was given to a project, or to none of them, in a month.
 *
 * `project` is a tracked label, or null for unrestricted. An empty amount
 * deletes the row rather than storing zero: the report draws a blank month
 * differently from a month where nothing came in, and the only way to say
 * "I entered this by mistake" is to take it out.
 */
export async function saveDonation(input: {
  project: string | null
  month: string
  amount: string
  note?: string
}): Promise<MoneyResult> {
  if (!(await mayWrite())) return { ok: false, error: 'You cannot edit these figures.' }
  if (!MONTH.test(input.month)) return { ok: false, error: 'Pick a month.' }
  if (input.project !== null && !LABELS.includes(input.project)) {
    return { ok: false, error: 'That is not one of the tracked projects.' }
  }

  const { value, error } = parseMoney(input.amount, 'The amount')
  if (error) return { ok: false, error }

  // Undefined and empty are different answers, and the difference is a data
  // loss bug. The month dialog sends the amounts only, so treating "no note
  // given" as "clear the note" would wipe what someone had written the moment
  // anybody re-entered that month's figures, and the log would record a note
  // change nobody made. Undefined leaves it alone; an empty string clears it.
  const noteGiven = input.note !== undefined
  const note = input.note?.trim() || null
  const supabase = createAdminClient()
  // The amount and note come back too, not just the id: they are what the log
  // entry needs as "before", and after the write they are gone.
  const where = supabase.from('tc_project_donations').select('id, amount_usd, note').eq('month', input.month)
  const { data: existing } = await (input.project === null
    ? where.is('project_label', null)
    : where.eq('project_label', input.project)
  ).maybeSingle()

  const actor = await currentActor()
  const common = { project: input.project, month: input.month }

  if (value === null) {
    if (existing) {
      const { error: e } = await supabase.from('tc_project_donations').delete().eq('id', existing.id)
      if (e) return { ok: false, error: e.message }
      await logDonationChange({
        ...common, donationId: existing.id, action: 'deleted',
        amountBefore: Number(existing.amount_usd), noteBefore: existing.note,
      }, actor)
    }
    // Nothing there and nothing asked for is not a change, so it is not logged.
  } else if (existing) {
    const before = Number(existing.amount_usd)
    const noteAfter = noteGiven ? note : (existing.note ?? null)
    const { error: e } = await supabase.from('tc_project_donations')
      .update({
        amount_usd: value,
        ...(noteGiven ? { note } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
    if (e) return { ok: false, error: e.message }
    // Re-saving the same figure is not a change. Logging it would bury the real
    // corrections under entries that say nothing happened.
    if (before !== value || (existing.note ?? null) !== noteAfter) {
      await logDonationChange({
        ...common, donationId: existing.id, action: 'updated',
        amountBefore: before, amountAfter: value,
        noteBefore: existing.note, noteAfter,
      }, actor)
    }
  } else {
    const { data: created, error: e } = await supabase.from('tc_project_donations')
      .insert({ project_label: input.project, month: input.month, amount_usd: value, note })
      .select('id').maybeSingle()
    if (e) return { ok: false, error: e.message }
    await logDonationChange({
      ...common, donationId: created?.id ?? null, action: 'created',
      amountAfter: value, noteAfter: note,
    }, actor)
  }

  revalidatePath('/tools/time-report/grant-pass')
  revalidatePath('/tools/time-report/grant-pass/donations')
  return { ok: true }
}

/**
 * Record hours bought in advance, which is Grants Pass Church and School only.
 *
 * "The pre-paid is separate and only for the Church and School. That is the $90
 * hourly rate." The amount invoiced rides along beside the hours it bought so
 * the two can be checked against each other later, which is what the column has
 * been for since migration 062.
 */
export async function savePurchase(input: {
  project: string
  month: string
  hours: string
  amount?: string
  note?: string
}): Promise<MoneyResult> {
  if (!(await mayWrite())) return { ok: false, error: 'You cannot edit these figures.' }
  if (!MONTH.test(input.month)) return { ok: false, error: 'Pick a month.' }

  const buys = TRACKED_PROJECTS.find(p => p.label === input.project)
  if (!buys) return { ok: false, error: 'That is not one of the tracked projects.' }
  if (!buys.prepaid) return { ok: false, error: `${buys.name} does not buy hours in advance.` }

  const hours = parseMoney(input.hours, 'The hours')
  if (hours.error) return { ok: false, error: hours.error }
  const amount = parseMoney(input.amount ?? '', 'The amount invoiced')
  if (amount.error) return { ok: false, error: amount.error }

  const supabase = createAdminClient()
  const { data: existing } = await supabase.from('tc_project_purchases')
    .select('id').eq('project_label', input.project).eq('month', input.month).maybeSingle()

  if (hours.value === null) {
    if (existing) await supabase.from('tc_project_purchases').delete().eq('id', existing.id)
  } else if (existing) {
    const { error: e } = await supabase.from('tc_project_purchases')
      .update({ hours: hours.value, amount_usd: amount.value, note: input.note?.trim() || null, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (e) return { ok: false, error: e.message }
  } else {
    const { error: e } = await supabase.from('tc_project_purchases')
      .insert({ project_label: input.project, month: input.month, hours: hours.value, amount_usd: amount.value, rate_usd: 90, note: input.note?.trim() || null })
    if (e) return { ok: false, error: e.message }
  }

  revalidatePath('/tools/time-report/grant-pass')
  return { ok: true }
}
