'use server'

/**
 * People directory mutations. Each is allowed by its own access item (Add and
 * remove people, Invite, Reset two-step), decided by the access rule, and then
 * written with the privileged client: the access item decides, not the
 * database role (audit, 8 October 2026: with the session client, someone given
 * the item but not the database's admin role got "done" while nothing was
 * written). Every action returns its result, since a thrown message never
 * reaches the screen in production. Every change revalidates the Directory and
 * the home org chart, which reads the same directory.
 *
 * A person's level is not set here (since 7 October 2026): Super Admin and
 * Admin are given on Admin > Access levels; Team Leader follows team
 * positions, which only a Super Admin changes (d-positions).
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Json, TablesInsert } from '@/lib/types/database.types'
import { allowedTo } from '@/lib/access/resolve'
import { endSessions } from '@/lib/auth/portal-access'
import { looksLikeEmail, signInExceptionOf } from '@/lib/auth/sign-in-exceptions'
import { isFounding } from '@/lib/auth/portal-rule'
import { isSuperAdmin } from '@/lib/access/resolve'
import { requestOrigin } from '@/lib/auth/origin'
import { getRealPerson } from '@/lib/auth/session'
import { loadCurrentPerson } from '@/lib/directory/current-person'
import { mapPersonError, setPersonTeams, takenMailbox } from '@/lib/directory/person-writes'
import { cleanWork, UUID, type WorkInput } from '@/lib/directory/person-validate'
import { renderInvite } from '@/lib/email/invite'
import { sendEmail } from '@/lib/email/resend'

type Result<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string }
const fail = (error: string) => ({ ok: false as const, error })
const NOT_ALLOWED = 'That is not open to your access.'

/** Done to yourself these would only lock you out: refused, whatever the page shows. */
async function isSelf(personId: string): Promise<boolean> {
  return (await getRealPerson())?.id === personId
}

function revalidate() {
  revalidatePath('/directory', 'layout')
  revalidatePath('/admin/access-levels') // the access-levels board lists everyone's level
  revalidatePath('/') // home org chart reads the same directory
}

/**
 * Add someone with their name and Work (decided 8 October 2026). Personal and
 * HR are filled in on their own page, each under its own access item, so
 * "Add people" never writes a birth date or an onboarding status. Teams and
 * positions only with d-positions (Super Admin).
 *
 * How they submit their hours (Clocky's timesheet cadence) is required: there
 * is no company default (owner, 20 October 2026). It is kept from the start of
 * the records, so every period of theirs follows it until a Super Admin
 * changes it on their page or in Rates & Costs.
 */
export async function createPerson(input: WorkInput, cadence?: string): Promise<Result<{ id: string }>> {
  if (!(await allowedTo('d-edit'))) return fail(NOT_ALLOWED)
  if (cadence !== 'monthly' && cadence !== 'biweekly') return fail('Choose how they submit their hours: Monthly or Every 2 weeks.')
  const clean = cleanWork(input, null)
  if (!clean.ok) return fail(clean.error)
  const { cols } = clean
  const db = createAdminClient()

  if (cadence === 'biweekly') {
    const { data: s } = await db.from('tc_settings').select('pay_period_anchor').eq('singleton_id', 1).maybeSingle()
    if (!(s as { pay_period_anchor: string | null } | null)?.pay_period_anchor) {
      return fail('Pay periods have no start day yet. Set it in Company settings, Timesheet periods, or choose Monthly.')
    }
  }

  const taken = await takenMailbox(db, [cols.email_goodnews, cols.email_true_north, cols.email_coe], null)
  if (taken) return fail(`${taken} already belongs to someone else in the Directory.`)
  for (const id of [cols.manager_id, cols.also_reports_to_id]) {
    if (!id) continue
    const { data } = await db.from('people').select('id').eq('id', id).maybeSingle()
    if (!data) return fail('That manager is not in the Directory any more. Choose again.')
  }

  const { data, error } = await db.from('people')
    .insert({ ...cols, milestones: cols.milestones as unknown as Json } as TablesInsert<'people'>)
    .select('id').single()
  if (error || !data) return fail(mapPersonError(error?.message ?? 'The person could not be added.'))
  const id = (data as { id: string }).id

  // Never a person without a cadence: if it cannot be kept, they are not added.
  const { error: cadErr } = await db.from('tc_person_cadence')
    .insert({ person_id: id, cadence, effective_from: '2017-01-01', set_by: (await getRealPerson())?.id ?? null })
  if (cadErr) {
    await db.from('people').delete().eq('id', id)
    return fail('The person could not be added. Try again in a moment.')
  }

  if (clean.teams.length && (await allowedTo('d-positions'))) {
    const ids = [...new Set(clean.teams.map(t => t.teamId))]
    const { data: found } = await db.from('teams').select('id').in('id', ids)
    if ((found ?? []).length === ids.length) {
      try { await setPersonTeams(db, id, clean.teams) } catch { /* added without teams: they can be set on the page */ }
    }
  }
  revalidate()
  return { ok: true, id }
}

/** What inviting someone did, for the Directory to say. */
export interface InviteResult {
  /** The address they sign in with. */
  loginEmail: string
  /** Whether the invitation email went out; if not, why, so the admin can tell them. */
  emailed: boolean
  reason?: string
}

/**
 * Invite a person to the portal (migration 089), or send the invitation again:
 * from now on they can sign in with their GoodNews address, the only address that
 * can, one per person. Only active people with a GoodNews address can be invited.
 *
 * The portal emails the invitation itself (lib/email/invite.ts). It carries no
 * sign-in token, so it never expires: its button opens the sign-in page with the
 * address filled in. If the email cannot go out, the access is still granted and
 * the Directory says so, so the admin can tell the person another way.
 */
export async function invitePerson(id: string): Promise<Result<InviteResult>> {
  if (!(await allowedTo('d-invite'))) return fail(NOT_ALLOWED)
  if (!UUID.test(id)) return fail('That person is not in the Directory.')
  const db = createAdminClient()
  const { data: person, error: readErr } = await db
    .from('people').select('full_name, status, email_goodnews, portal_invited_at').eq('id', id).maybeSingle()
  if (readErr) return fail('The person could not be read. Try again.')
  const p = person as { full_name: string; status: string | null; email_goodnews: string | null; portal_invited_at: string | null } | null
  if (!p) return fail('That person is not in the Directory.')
  if (p.status === 'inactive') return fail(`${p.full_name} is inactive. Make them active before inviting them.`)
  // Their sign-in exception when a Super Admin listed one (migration 168), else their GoodNews mailbox.
  const exception = await signInExceptionOf(id)
  const loginEmail = exception ?? p.email_goodnews?.trim().toLowerCase() ?? ''
  if (!exception && !loginEmail.endsWith('@goodnewsadvocates.org')) {
    return fail(`${p.full_name} has no @goodnewsadvocates.org address in the Directory. Add it first, or a Super Admin lists another address for them under Sign-in exceptions (Directory, Portal access).`)
  }
  const { data: { user } } = await (await createClient()).auth.getUser()
  // Sending again keeps the date of the first invitation.
  if (!p.portal_invited_at) {
    const { error, count } = await db.from('people')
      .update({ portal_invited_at: new Date().toISOString(), portal_invited_by: user?.id ?? null }, { count: 'exact' })
      .eq('id', id)
    if (error || !count) return fail('The invitation could not be saved, so no email was sent. Try again.')
  }
  revalidate()

  const inviter = user ? await loadCurrentPerson(db, user, { real: true }) : null
  const origin = await requestOrigin()
  const mail = renderInvite({
    firstName: p.full_name.trim().split(/\s+/)[0] || p.full_name,
    invitedBy: inviter?.full_name ?? 'An admin at True North',
    email: loginEmail,
    url: `${origin}/login?email=${encodeURIComponent(loginEmail)}`,
    origin,
  })
  const sent = await sendEmail({ to: loginEmail, ...mail })
  return sent.sent ? { ok: true, loginEmail, emailed: true } : { ok: true, loginEmail, emailed: false, reason: sent.reason }
}

/** Withdraw a person's invitation: they cannot sign in, and their sessions end now. */
export async function revokeInvite(id: string): Promise<Result> {
  if (!(await allowedTo('d-invite'))) return fail(NOT_ALLOWED)
  if (!UUID.test(id)) return fail('That person is not in the Directory.')
  if (await isSelf(id)) return fail('You cannot revoke your own access.')
  const db = createAdminClient()
  const { data: before } = await db.from('people').select('profile_id').eq('id', id).maybeSingle()
  const { error, count } = await db.from('people')
    .update({ portal_invited_at: null, portal_invited_by: null }, { count: 'exact' })
    .eq('id', id)
  if (error || !count) return fail('The access could not be revoked. Nothing changed; try again.')
  await endSessions((before as { profile_id?: string | null } | null)?.profile_id)
  revalidate()
  return { ok: true }
}

/**
 * Remove someone from the Directory. Someone with hours or rates on record is
 * made inactive instead (decided 8 October 2026): their hours and costs stay
 * true in every report, their access ends, and they leave the lists. Only a
 * person with no history is deleted, with their photo and documents.
 */
export async function deletePerson(id: string): Promise<Result<{ outcome: 'removed' | 'inactive' }>> {
  if (!(await allowedTo('d-edit'))) return fail(NOT_ALLOWED)
  if (!UUID.test(id)) return fail('That person is not in the Directory.')
  if (await isSelf(id)) return fail('You cannot remove yourself from the Directory.')
  const db = createAdminClient()
  const { data: before } = await db.from('people').select('profile_id, status').eq('id', id).maybeSingle()
  const row = before as { profile_id: string | null; status: string | null } | null
  if (!row) return fail('That person is not in the Directory.')

  const [{ count: hours }, { count: rates }] = await Promise.all([
    db.from('tc_entries').select('id', { count: 'exact', head: true }).eq('person_id', id),
    db.from('tr_assignments').select('id', { count: 'exact', head: true }).eq('person_id', id),
  ])
  if ((hours ?? 0) > 0 || (rates ?? 0) > 0) {
    const { error } = await db.from('people').update({ status: 'inactive' }).eq('id', id)
    if (error) return fail('They could not be made inactive. Nothing changed; try again.')
    await endSessions(row.profile_id)
    revalidate()
    return { ok: true, outcome: 'inactive' }
  }

  const { data: files } = await db.from('person_attachments').select('storage_path').eq('person_id', id)
  const { error } = await db.from('people').delete().eq('id', id)
  if (error) return fail(mapPersonError(error.message))
  // Removed from the Directory: no person, no access, and nothing of theirs left behind.
  await endSessions(row.profile_id)
  await db.storage.from('avatars').remove([`${id}.jpg`])
  const paths = ((files ?? []) as { storage_path: string }[]).map(f => f.storage_path)
  if (paths.length) await db.storage.from('person-files').remove(paths)
  revalidate()
  return { ok: true, outcome: 'removed' }
}

/**
 * Reset a person's two-step sign-in (plan step p4-2fa): for a lost or replaced
 * phone. Their authenticator app is removed and their sessions end; at their next
 * sign-in they set it up again with a new QR code.
 */
export async function resetTwoStep(id: string): Promise<Result> {
  if (!(await allowedTo('d-2fa'))) return fail(NOT_ALLOWED)
  if (!UUID.test(id)) return fail('That person is not in the Directory.')
  if (await isSelf(id)) return fail('You cannot reset your own two-step sign-in. Ask another Super Admin.')
  const admin = createAdminClient()
  const { data: row } = await admin.from('people').select('profile_id').eq('id', id).maybeSingle()
  const profileId = (row as { profile_id?: string | null } | null)?.profile_id
  if (!profileId) return fail('This person has no account yet.')
  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId: profileId })
  if (error) return fail('Their two-step sign-in could not be read. Try again.')
  for (const f of data?.factors ?? []) {
    const { error: delErr } = await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: profileId })
    if (delErr) return fail('Their two-step sign-in could not be reset. Try again.')
  }
  await endSessions(profileId)
  revalidate()
  return { ok: true }
}

// ── Sign-in exceptions (owner, 18 November 2026; migration 168) ─────────────

const SUPER_ONLY = 'Only Super Admins change the sign-in exceptions.'

/**
 * The addresses a person has in the Directory, to pick their sign-in exception
 * from (the personal one too). Super Admins only.
 */
export async function signInAddressesOf(personId: string): Promise<Result<{ addresses: { label: string; email: string }[] }>> {
  if (!(await isSuperAdmin())) return fail(SUPER_ONLY)
  if (!UUID.test(personId)) return fail('That person is not in the Directory.')
  const { data, error } = await createAdminClient().from('people').select('email_true_north, email_goodnews, email_coe, email_personal').eq('id', personId).maybeSingle()
  if (error || !data) return fail('The person could not be read. Try again.')
  const rows: [string, string | null][] = [['True North', data.email_true_north], ['GoodNews', data.email_goodnews], ['COE', data.email_coe], ['Personal', data.email_personal]]
  return { ok: true, addresses: rows.flatMap(([label, v]) => (v?.trim() ? [{ label, email: v.trim().toLowerCase() }] : [])) }
}

/**
 * Lists an address as a person's sign-in exception: the one they sign in with
 * in place of a GoodNews mailbox. It opens nothing by itself (they must still
 * be active and invited). One address serves one person, and it cannot be an
 * address the Directory has for someone else. Changing it for someone who has
 * already signed in ends their sessions and frees their account link, so the
 * next sign-in, with the new address, is tied to them.
 */
export async function setSignInException(input: { personId: string; email: string }): Promise<Result> {
  if (!(await isSuperAdmin())) return fail(SUPER_ONLY)
  const personId = String(input?.personId ?? '')
  const email = String(input?.email ?? '').trim().toLowerCase()
  if (!UUID.test(personId)) return fail('Pick a person.')
  if (!looksLikeEmail(email) || email.length > 254) return fail('That does not look like an email address.')
  if (email.endsWith('@goodnewsadvocates.org')) return fail('A GoodNews address is not an exception: add it as their GoodNews address in the Directory and invite them.')
  const db = createAdminClient()
  const { data: person, error: readErr } = await db.from('people').select('id, full_name, status, profile_id').eq('id', personId).maybeSingle()
  if (readErr || !person) return fail('That person is not in the Directory.')
  if (person.status === 'inactive') return fail(`${person.full_name} is inactive. Make them active first.`)
  const { data: other } = await db.from('portal_sign_in_exceptions').select('person_id').eq('email', email).neq('person_id', personId).maybeSingle()
  if (other) return fail('That address is already someone else\'s exception.')
  if (await takenMailbox(db, [email], personId)) return fail('The Directory has that address for someone else.')
  const { data: before } = await db.from('portal_sign_in_exceptions').select('email').eq('person_id', personId).maybeSingle()
  if (before?.email === email) return { ok: true }
  const me = await getRealPerson()
  const { error } = await db.from('portal_sign_in_exceptions').upsert({ person_id: personId, email, added_by: me?.id ?? null, added_at: new Date().toISOString() }, { onConflict: 'person_id' })
  if (error) { console.error('[sign-in exceptions] save:', error.message); return fail('Not saved. Try again in a moment.') }
  // Their exception changed after they signed in with the old one: that account lets go, so the new address becomes theirs.
  if (before && person.profile_id && personId !== me?.id) {
    await endSessions(person.profile_id)
    await db.from('people').update({ profile_id: null }).eq('id', personId)
  }
  revalidate()
  return { ok: true }
}

/**
 * Takes a person's sign-in exception away. If that is the address they signed
 * in with, their sessions end and the account lets go of them. The founding
 * account's exception stays, and nobody removes their own.
 */
export async function removeSignInException(personId: string): Promise<Result> {
  if (!(await isSuperAdmin())) return fail(SUPER_ONLY)
  if (!UUID.test(personId)) return fail('That person is not in the Directory.')
  if (await isSelf(personId)) return fail('You cannot remove your own sign-in address.')
  const db = createAdminClient()
  const { data: row } = await db.from('portal_sign_in_exceptions').select('email').eq('person_id', personId).maybeSingle()
  if (!row) return { ok: true }
  if (isFounding(row.email)) return fail('The founding account keeps its address.')
  const { error } = await db.from('portal_sign_in_exceptions').delete().eq('person_id', personId)
  if (error) { console.error('[sign-in exceptions] remove:', error.message); return fail('Not removed. Try again in a moment.') }
  const { data: person } = await db.from('people').select('profile_id').eq('id', personId).maybeSingle()
  if (person?.profile_id) {
    const { data: profile } = await db.from('profiles').select('email').eq('id', person.profile_id).maybeSingle()
    if ((profile?.email ?? '').trim().toLowerCase() === row.email) {
      await endSessions(person.profile_id)
      await db.from('people').update({ profile_id: null }).eq('id', personId)
    }
  }
  revalidate()
  return { ok: true }
}
