'use server'

/**
 * Agenda settings (owner, 30 October 2026): a person's Google accounts, where
 * invitations to them go and their working hours; for a Super Admin, the team
 * calendar (office@).
 *
 * Google sign-in is not set up yet, so an account is added by its address and
 * kept as a sample (source 'sample'): the Agenda works with it end to end and
 * nothing goes to Google. Until Google approves the portal only
 * @truenorthdigitalmarketing.com addresses connect.
 *
 * Every write is refused while the new Agenda is closed (migration 134), and
 * during a View Stage preview.
 */

import { revalidatePath } from 'next/cache'
import { writerAccess } from '@/lib/access/resolve'
import { getViewAs } from '@/lib/auth/view-as-server'
import { createAdminClient } from '@/lib/supabase/admin'
import { closedRefusal } from '@/lib/agenda/google-lock'
import { APPROVED_DOMAIN } from '@/lib/agenda/accounts'
import { checkHours } from '@/lib/agenda/working-hours'

type Done = { ok: true; toast: string } | { ok: false; error: string }
const no = (error: string): Done => ({ ok: false, error })
const NOT_SAVED = 'Not saved. Try again in a moment.'
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function me(): Promise<{ personId: string; superAdmin: boolean } | Done> {
  const closed = await closedRefusal(no)
  if (closed) return closed
  if (await getViewAs()) return no('View Stage is only a preview. Close it to change Agenda settings.')
  const access = await writerAccess()
  if (!access?.personId || !access.can('agenda')) return no('Sign in again to save.')
  return { personId: access.personId, superAdmin: access.level === 'super_admin' }
}
const isDone = (x: unknown): x is Done => !!x && typeof x === 'object' && 'ok' in x

const done = (toast: string): Done => { revalidatePath('/agenda/settings'); revalidatePath('/agenda'); return { ok: true, toast } }

/** The address an account may have: an email, on the approved domain until Google approves the portal. */
function addressOf(raw: unknown): string | Done {
  const email = String(raw ?? '').trim().toLowerCase()
  if (!EMAIL.test(email)) return no('That does not look like an email address.')
  if (!email.endsWith(`@${APPROVED_DOMAIN}`)) return no(`For now only @${APPROVED_DOMAIN} accounts connect. Other accounts can connect once Google approves the portal.`)
  return email
}

export async function connectAccount(input: { email: string }): Promise<Done> {
  const m = await me(); if (isDone(m)) return m
  const email = addressOf(input?.email); if (typeof email !== 'string') return email
  const c = createAdminClient()
  const { data: taken } = await c.from('agenda_accounts').select('person_id, team_calendar').ilike('email', email).maybeSingle()
  if (taken) return no(taken.person_id === m.personId ? 'That account is already connected.' : 'That account is connected by someone else.')
  const { error } = await c.from('agenda_accounts').insert({ person_id: m.personId, email, source: 'sample', connected_by: m.personId })
  if (error) { console.error('[agenda settings] connect:', error.message); return no(NOT_SAVED) }
  return done(`${email} is connected.`)
}

export async function disconnectAccount(input: { id: number }): Promise<Done> {
  const m = await me(); if (isDone(m)) return m
  const id = Number(input?.id)
  if (!Number.isSafeInteger(id)) return no(NOT_SAVED)
  const { data, error } = await createAdminClient().from('agenda_accounts').delete().eq('id', id).eq('person_id', m.personId).select('email')
  if (error) { console.error('[agenda settings] disconnect:', error.message); return no(NOT_SAVED) }
  if (!data?.length) return no('That account is no longer connected.')
  return done(`${data[0].email} is disconnected.`)
}

/** "Invitations to you go to": one of their accounts, or null for the work address. */
export async function setInviteAccount(input: { id: number | null }): Promise<Done> {
  const m = await me(); if (isDone(m)) return m
  const c = createAdminClient()
  let id: number | null = null
  if (input?.id != null) {
    id = Number(input.id)
    const { data } = await c.from('agenda_accounts').select('id').eq('id', id).eq('person_id', m.personId).maybeSingle()
    if (!data) return no('That account is no longer connected.')
  }
  const { error } = await c.from('agenda_person_settings').upsert({ person_id: m.personId, invite_account_id: id, updated_at: new Date().toISOString() }, { onConflict: 'person_id' })
  if (error) { console.error('[agenda settings] invite account:', error.message); return no(NOT_SAVED) }
  return done('Saved. Invitations to you go there from now on.')
}

export async function saveWorkingHours(input: { hours: unknown }): Promise<Done> {
  const m = await me(); if (isDone(m)) return m
  const r = checkHours(input?.hours)
  if (!r.ok) return no(r.error)
  const { error } = await createAdminClient().from('agenda_person_settings').upsert({ person_id: m.personId, working_hours: r.hours, updated_at: new Date().toISOString() }, { onConflict: 'person_id' })
  if (error) { console.error('[agenda settings] hours:', error.message); return no(NOT_SAVED) }
  return done('Working hours saved.')
}

/** Who may invite all of True North to an event: a Super Admin chooses the levels; Super Admins always may. */
export async function setAllLevels(input: { levels: string[] }): Promise<Done> {
  const m = await me(); if (isDone(m)) return m
  if (!m.superAdmin) return no('Only a Super Admin chooses who invites all of True North.')
  const known = ['super_admin', 'admin', 'team_leader', 'user']
  const levels = ['super_admin', ...known.filter(l => l !== 'super_admin' && (input?.levels ?? []).includes(l))]
  const { error } = await createAdminClient().from('app_settings').update({ agenda_all_levels: levels }).eq('singleton_id', 1)
  if (error) { console.error('[agenda settings] all levels:', error.message); return no(NOT_SAVED) }
  return done('Saved. Who can invite True North is updated.')
}

/** The team calendar (office@): a Super Admin connects and disconnects it. */
export async function connectTeamCalendar(input: { email: string }): Promise<Done> {
  const m = await me(); if (isDone(m)) return m
  if (!m.superAdmin) return no('Only a Super Admin connects the team calendar.')
  const email = addressOf(input?.email); if (typeof email !== 'string') return email
  const c = createAdminClient()
  const { data: taken } = await c.from('agenda_accounts').select('id, team_calendar').ilike('email', email).maybeSingle()
  if (taken && !taken.team_calendar) return no('That address is connected as someone\'s own account.')
  const { error: delErr } = await c.from('agenda_accounts').delete().eq('team_calendar', true)
  if (delErr) { console.error('[agenda settings] team calendar:', delErr.message); return no(NOT_SAVED) }
  const { error } = await c.from('agenda_accounts').insert({ person_id: null, team_calendar: true, email, source: 'sample', connected_by: m.personId })
  if (error) { console.error('[agenda settings] team calendar:', error.message); return no(NOT_SAVED) }
  return done(`${email} is the team calendar.`)
}

export async function disconnectTeamCalendar(): Promise<Done> {
  const m = await me(); if (isDone(m)) return m
  if (!m.superAdmin) return no('Only a Super Admin disconnects the team calendar.')
  const { error } = await createAdminClient().from('agenda_accounts').delete().eq('team_calendar', true)
  if (error) { console.error('[agenda settings] team calendar:', error.message); return no(NOT_SAVED) }
  return done('The team calendar is disconnected.')
}
