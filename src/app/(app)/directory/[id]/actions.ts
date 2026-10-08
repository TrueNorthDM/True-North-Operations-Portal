'use server'

/**
 * Saving a person's page (8 October 2026), one tab at a time. Each save asks
 * the same rule the page draws with (lib/directory/page-rights.ts), for the
 * person really signed in, and then writes with the privileged client: the
 * access items decide, not the database role. A View Stage preview never
 * saves. Each tab writes only its own columns, so a save never touches what
 * the person saving could not see.
 */

import { revalidatePath } from 'next/cache'
import type { Json, TablesUpdate } from '@/lib/types/database.types'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { writerAccess } from '@/lib/access/resolve'
import { levelsOf, noteLevelShifts } from '@/lib/access/log'
import { endSessions } from '@/lib/auth/portal-access'
import { normalizeAddress, type AddressForm } from '@/lib/address'
import { LIFECYCLE_OPTIONS } from '@/lib/directory/people-types'
import { loadLedMemberIds } from '@/lib/directory/person-page-data'
import { pageRights, relationTo, type PageRights } from '@/lib/directory/page-rights'
import { mapPersonError, setPersonTeams, takenMailbox, wouldCreateCycle } from '@/lib/directory/person-writes'
import { cleanWork, type WorkInput } from '@/lib/directory/person-validate'

type Result = { ok: true } | { ok: false; error: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE = /^\d{4}-\d{2}-\d{2}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const fail = (error: string): Result => ({ ok: false, error })
const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)
const date = (v: unknown): string | null | false => {
  const t = text(v)
  if (!t) return null
  return DATE.test(t) ? t : false
}
const email = (v: unknown): string | null | false => {
  const t = text(v)
  if (!t) return null
  return EMAIL.test(t) ? t : false
}

/** What the person really signed in may do on this page, or why not. */
async function rightsOver(personId: string): Promise<{ rights: PageRights; actorId: string | null } | { error: string }> {
  if (typeof personId !== 'string' || !UUID.test(personId)) return { error: 'That person does not exist.' }
  const access = await writerAccess()
  if (!access) return { error: 'Sign in again, and close View Stage if it is open, to save.' }
  const led = await loadLedMemberIds(createAdminClient(), access.personId)
  const rights = pageRights(access.can, relationTo(access.personId, personId, led))
  if (!rights) return { error: 'This page is not open to your access.' }
  return { rights, actorId: access.personId }
}

function refresh(personId: string) {
  revalidatePath(`/directory/${personId}`)
  revalidatePath('/directory')
  revalidatePath('/') // Home's birthdays and the org chart read the same records
}

// ── Personal ────────────────────────────────────────────────────────────────

export interface PersonalInput {
  lastName: string
  personalEmail: string
  phone: string
  whatsappSame: string
  dateOfBirth: string
  location: string
  address: AddressForm
}

export async function savePersonal(personId: string, input: PersonalInput): Promise<Result> {
  const who = await rightsOver(personId)
  if ('error' in who) return fail(who.error)
  if (!who.rights.personalEdit) return fail('Personal is not yours to change on this page.')

  const personalEmail = email(input.personalEmail)
  if (personalEmail === false) return fail('That personal email does not look right.')
  const dateOfBirth = date(input.dateOfBirth)
  if (dateOfBirth === false) return fail('That date of birth could not be read.')
  const whatsapp = text(input.whatsappSame)
  if (whatsapp && whatsapp !== 'yes' && whatsapp !== 'no') return fail('Choose yes or no for WhatsApp.')

  const db = createAdminClient()
  // A sign-in without a linked account is matched to a person by any of their
  // mailboxes (lib/directory/current-person.ts), so one address must never
  // belong to two people: anyone can set their own personal email here.
  if (await takenMailbox(db, [personalEmail], personId)) return fail('That email belongs to someone else in the Directory.')

  const { error } = await db.from('people').update({
    last_name: text(input.lastName),
    email_personal: personalEmail,
    phone: text(input.phone),
    whatsapp_same_number: whatsapp,
    date_of_birth: dateOfBirth,
    location: text(input.location),
    address: (input.address ? normalizeAddress(input.address) : null) as Json,
  }).eq('id', personId)
  if (error) return fail(mapPersonError(error.message))
  refresh(personId)
  return { ok: true }
}

// ── Work ────────────────────────────────────────────────────────────────────

export type { WorkInput } from '@/lib/directory/person-validate'

export async function saveWork(personId: string, input: WorkInput): Promise<Result> {
  const who = await rightsOver(personId)
  if ('error' in who) return fail(who.error)
  if (!who.rights.workEdit) return fail('Work is kept by the company: you cannot change it here.')

  // The same checks as Add person (lib/directory/person-validate.ts).
  const clean = cleanWork(input, personId)
  if (!clean.ok) return fail(clean.error)
  const { cols } = clean
  const managerId = cols.manager_id
  const fullName = cols.full_name
  const db = createAdminClient()
  // Teams and positions only with teamsEdit (page-rights.ts): without it the
  // teams sent are ignored and the person's teams stay as they are.
  let teams: WorkInput['teams'] | null = null
  if (who.rights.teamsEdit) {
    teams = clean.teams
    // Every team must exist before the old memberships are replaced.
    const ids = [...new Set(teams.map(t => t.teamId))]
    if (ids.length) {
      const { data: found } = await db.from('teams').select('id').in('id', ids)
      if ((found ?? []).length !== ids.length) return fail('One of those teams no longer exists. Reload the page and try again.')
    }
  }

  if (managerId && await wouldCreateCycle(db, personId, managerId)) {
    return fail('That reporting line would make a loop: the chosen manager already reports up to this person.')
  }
  // One address, one person: a sign-in is matched by its mailbox.
  const taken = await takenMailbox(db, [cols.email_goodnews, cols.email_true_north, cols.email_coe], personId)
  if (taken) return fail(`${taken} already belongs to someone else in the Directory.`)

  const { data: before } = await db.from('people').select('status, profile_id').eq('id', personId).maybeSingle()
  const levelsBefore = await levelsOf(db, [personId])
  const { error } = await db.from('people').update({ ...cols, milestones: cols.milestones as unknown as Json })
    .eq('id', personId)
  if (error) return fail(mapPersonError(error.message))
  if (teams) {
    try { await setPersonTeams(db, personId, teams) } catch (e) { return fail(e instanceof Error ? e.message : 'The teams could not be saved.') }
    // Lead of a team or not decides Team Leader: a change of teams can move the level.
    const { data: { user } } = await (await createClient()).auth.getUser()
    await noteLevelShifts(db, levelsBefore, { personId: who.actorId, profileId: user?.id ?? null }, `Teams changed on ${fullName}'s page.`)
  }
  // Made inactive: their sessions end now, not when the token runs out.
  const was = before as { status?: string | null; profile_id?: string | null } | null
  if (cols.status === 'inactive' && was?.status !== 'inactive') await endSessions(was?.profile_id)
  refresh(personId)
  return { ok: true }
}

// ── HR and access ───────────────────────────────────────────────────────────

export interface HrInput {
  onboarding: string
  offboarding: string
  /** Unlink their QuickBooks Time account. Linking happens in the hours sync. */
  unlinkTsheets: boolean
}

export async function saveHr(personId: string, input: HrInput): Promise<Result> {
  const who = await rightsOver(personId)
  if ('error' in who) return fail(who.error)
  if (!who.rights.hrEdit) return fail('HR and access is not yours to change.')
  const allowed = new Set<string>(LIFECYCLE_OPTIONS)
  const onboarding = text(input.onboarding)
  const offboarding = text(input.offboarding)
  if ((onboarding && !allowed.has(onboarding)) || (offboarding && !allowed.has(offboarding))) return fail('Choose a status from the list.')

  const patch: TablesUpdate<'people'> = { onboarding_status: onboarding, offboarding_status: offboarding }
  if (input.unlinkTsheets === true) patch.tsheets_user_id = null
  const { error } = await createAdminClient().from('people').update(patch).eq('id', personId)
  if (error) return fail(mapPersonError(error.message))
  refresh(personId)
  return { ok: true }
}
