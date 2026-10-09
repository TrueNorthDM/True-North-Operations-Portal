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
import { allowedTo } from '@/lib/access/resolve'
import { createAdminClient } from '@/lib/supabase/admin'
import { TRACKED_PROJECTS } from './projects'
import { parseMoney } from './money-in-data'
import { currentActor, logDonationChange, logPurchaseChange } from './donations-log'
import { ROUTES } from '@/lib/nav/routes'

export interface MoneyResult {
  ok: boolean
  error?: string
  /** Saved, but something beside it was not: its line in the history. */
  warning?: string
}

const NOT_SAVED = 'Not saved. Try again in a moment.'
const NO_HISTORY = 'Saved, but its line in the change history could not be written. Tell an admin.'
const fail = (what: string, message: string): MoneyResult => {
  console.error(`[money in] ${what}:`, message)
  return { ok: false, error: NOT_SAVED }
}
/** Exactly one row changed, or the save did not happen as asked. */
const one = (rows: unknown[] | null) => (rows ?? []).length === 1

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/
const LABELS: string[] = TRACKED_PROJECTS.map(p => p.label)

/**
 * Whoever has the access item "Money in and donation records" (Client Report ·
 * Project Hours & Others), decided by the access rule.
 */
async function mayWrite(): Promise<boolean> {
  // Asked of the Auth server, not read from the token. loadAccess takes the
  // signed-in identity from the token's claims so that pages render fast, which
  // trusts an unexpired token without asking whether its session was revoked.
  // Right for reading a page, wrong for writing money: of every server action in
  // the portal, this was the one that authorised through loadAccess alone.
  // allowedTo asks the Auth server and refuses during a preview that lacks it.
  return allowedTo('ph-money')
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
  const { data: existing, error: readErr } = await (input.project === null
    ? where.is('project_label', null)
    : where.eq('project_label', input.project)
  ).maybeSingle()
  // Not knowing what is there is not "nothing there": clearing a figure would
  // answer ok and delete nothing (audit, 9 October 2026).
  if (readErr) return fail('donation read', readErr.message)

  const actor = await currentActor()
  const common = { project: input.project, month: input.month }
  let logged: { logged: boolean } = { logged: true }

  if (value === null) {
    if (existing) {
      const { data: gone, error: e } = await supabase.from('tc_project_donations').delete().eq('id', existing.id).select('id')
      if (e) return fail('donation delete', e.message)
      if (!one(gone)) return { ok: false, error: 'That figure changed while you were editing. Reload the page and try again.' }
      logged = await logDonationChange({
        ...common, donationId: existing.id, action: 'deleted',
        amountBefore: Number(existing.amount_usd), noteBefore: existing.note,
      }, actor)
    }
    // Nothing there and nothing asked for is not a change, so it is not logged.
  } else if (existing) {
    const before = Number(existing.amount_usd)
    const noteAfter = noteGiven ? note : (existing.note ?? null)
    const { data: changed, error: e } = await supabase.from('tc_project_donations')
      .update({
        amount_usd: value,
        ...(noteGiven ? { note } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id).select('id')
    if (e) return fail('donation update', e.message)
    if (!one(changed)) return { ok: false, error: 'That figure changed while you were editing. Reload the page and try again.' }
    // Re-saving the same figure is not a change. Logging it would bury the real
    // corrections under entries that say nothing happened.
    if (before !== value || (existing.note ?? null) !== noteAfter) {
      logged = await logDonationChange({
        ...common, donationId: existing.id, action: 'updated',
        amountBefore: before, amountAfter: value,
        noteBefore: existing.note, noteAfter,
      }, actor)
    }
  } else {
    const { data: created, error: e } = await supabase.from('tc_project_donations')
      .insert({ project_label: input.project, month: input.month, amount_usd: value, note })
      .select('id').maybeSingle()
    if (e) return fail('donation insert', e.message)
    logged = await logDonationChange({
      ...common, donationId: created?.id ?? null, action: 'created',
      amountAfter: value, noteAfter: note,
    }, actor)
  }

  revalidatePath(ROUTES.projectHours)
  revalidatePath(`${ROUTES.projectHours}/donations`)
  return logged.logged ? { ok: true } : { ok: true, warning: NO_HISTORY }
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

  // As for donations: no note sent leaves the note alone (the month dialog
  // sends hours and amount only, and used to wipe the note on every save).
  const noteGiven = input.note !== undefined
  const note = input.note?.trim() || null

  const supabase = createAdminClient()
  const { data: existing, error: readErr } = await supabase.from('tc_project_purchases')
    .select('id, hours, amount_usd, note').eq('project_label', input.project).eq('month', input.month).maybeSingle()
  if (readErr) return fail('purchase read', readErr.message)

  const actor = await currentActor()
  const common = { project: input.project, month: input.month }
  let logged: { logged: boolean } = { logged: true }
  const num = (v: unknown) => (v == null ? null : Number(v))

  if (hours.value === null) {
    if (existing) {
      const { data: gone, error: e } = await supabase.from('tc_project_purchases').delete().eq('id', existing.id).select('id')
      if (e) return fail('purchase delete', e.message)
      if (!one(gone)) return { ok: false, error: 'That figure changed while you were editing. Reload the page and try again.' }
      logged = await logPurchaseChange({
        ...common, purchaseId: existing.id, action: 'deleted',
        hoursBefore: num(existing.hours), amountBefore: num(existing.amount_usd), noteBefore: existing.note,
      }, actor)
    }
  } else if (existing) {
    const noteAfter = noteGiven ? note : (existing.note ?? null)
    const { data: changed, error: e } = await supabase.from('tc_project_purchases')
      .update({ hours: hours.value, amount_usd: amount.value, ...(noteGiven ? { note } : {}), updated_at: new Date().toISOString() })
      .eq('id', existing.id).select('id')
    if (e) return fail('purchase update', e.message)
    if (!one(changed)) return { ok: false, error: 'That figure changed while you were editing. Reload the page and try again.' }
    if (num(existing.hours) !== hours.value || num(existing.amount_usd) !== amount.value || (existing.note ?? null) !== noteAfter) {
      logged = await logPurchaseChange({
        ...common, purchaseId: existing.id, action: 'updated',
        hoursBefore: num(existing.hours), hoursAfter: hours.value,
        amountBefore: num(existing.amount_usd), amountAfter: amount.value,
        noteBefore: existing.note, noteAfter,
      }, actor)
    }
  } else {
    const { data: created, error: e } = await supabase.from('tc_project_purchases')
      .insert({ project_label: input.project, month: input.month, hours: hours.value, amount_usd: amount.value, rate_usd: 90, note })
      .select('id').maybeSingle()
    if (e) return fail('purchase insert', e.message)
    logged = await logPurchaseChange({
      ...common, purchaseId: created?.id ?? null, action: 'created',
      hoursAfter: hours.value, amountAfter: amount.value, noteAfter: note,
    }, actor)
  }

  revalidatePath(ROUTES.projectHours)
  return logged.logged ? { ok: true } : { ok: true, warning: NO_HISTORY }
}
