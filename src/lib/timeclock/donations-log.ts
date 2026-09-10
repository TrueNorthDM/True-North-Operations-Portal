/**
 * Who changed a donation figure, and what it was before.
 *
 * tc_project_donations holds one row per project per month and it is written in
 * place, so a correction used to leave nothing behind. This writes the entry
 * that says what happened.
 *
 * The actor is resolved here rather than taken from the caller so that every
 * write records the same thing, and so that one rule about identity lives in
 * one place.
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface DonationActor {
  personId: string | null
  name: string | null
  email: string | null
}

/**
 * The person actually signed in, not the one being previewed.
 *
 * loadCurrentPerson answers with the impersonated person while View Stage is
 * on, which is right for deciding what a screen may show and wrong for a log:
 * an audit entry naming the person being previewed would name someone who was
 * not at the keyboard. The session is the one thing View Stage does not touch,
 * so the real identity is read from it directly.
 */
export async function currentActor(): Promise<DonationActor> {
  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user) return { personId: null, name: null, email: null }

  const supabase = createAdminClient()
  let row: { id: string; full_name: string } | null = null

  const byProfile = await supabase.from('people').select('id, full_name').eq('profile_id', user.id).limit(1)
  row = byProfile.data?.[0] ?? null

  if (!row && user.email) {
    const em = user.email
    const byEmail = await supabase.from('people').select('id, full_name')
      .or(`email_personal.eq.${em},email_true_north.eq.${em},email_goodnews.eq.${em},email_coe.eq.${em}`)
      .limit(1)
    row = byEmail.data?.[0] ?? null
  }

  // The email is kept even when no people row matches. An entry that says only
  // "someone" is barely an audit entry, and the session always has an address.
  return { personId: row?.id ?? null, name: row?.full_name ?? null, email: user.email ?? null }
}

export interface DonationChange {
  donationId: number | null
  project: string | null
  month: string
  action: 'created' | 'updated' | 'deleted'
  amountBefore?: number | null
  amountAfter?: number | null
  noteBefore?: string | null
  noteAfter?: string | null
}

/**
 * Record one change. Never throws and never blocks the write it describes.
 *
 * A failure here must not fail the save: losing the figure the user typed in
 * order to protect the record of them typing it would be the wrong trade. The
 * error is returned so the caller can surface it if it wants to.
 */
export async function logDonationChange(
  change: DonationChange,
  actor: DonationActor,
): Promise<{ logged: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from('tc_project_donations_log').insert({
      donation_id: change.donationId,
      project_label: change.project,
      month: change.month,
      action: change.action,
      amount_before: change.amountBefore ?? null,
      amount_after: change.amountAfter ?? null,
      note_before: change.noteBefore ?? null,
      note_after: change.noteAfter ?? null,
      actor_person_id: actor.personId,
      actor_name: actor.name,
      actor_email: actor.email,
    })
    return error ? { logged: false, error: error.message } : { logged: true }
  } catch (e) {
    return { logged: false, error: e instanceof Error ? e.message : 'Could not write the log entry.' }
  }
}
