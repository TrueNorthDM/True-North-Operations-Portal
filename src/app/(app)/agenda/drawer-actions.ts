'use server'

/**
 * The New event drawer (owner, 30 October 2026): create, change and delete an
 * event, and read everyone's working and busy times for Find a time.
 *
 * Rules in lib/agenda/event-rules.ts. The event is made on the creator's own
 * Google account (Send from); until Google sign-in is set up the accounts are
 * samples and nothing goes to Google, but the event, its guests and its Meet
 * link live in the portal exactly as they will then. Refused while the new
 * Agenda is closed (migration 134) and during a View Stage preview.
 */

import { revalidatePath } from 'next/cache'
import { writerAccess, type Access } from '@/lib/access/resolve'
import type { AccessLevel } from '@/lib/access/catalogue'
import { getViewAs } from '@/lib/auth/view-as-server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadDirectory } from '@/lib/timeclock/clocky-context'
import { closedRefusal } from '@/lib/agenda/google-lock'
import { allLevels, invitablePeople, loadAvailability } from '@/lib/agenda/drawer-data'
import { checkDrawer, invitees, mayManage, type DrawerInput, type Viewer } from '@/lib/agenda/event-rules'
import { seeded } from '@/lib/agenda/sample-plan'

type Done = { ok: true; toast: string } | { ok: false; error: string }
const no = (error: string): Done => ({ ok: false, error })
const NOT_SAVED = 'Not saved. Try again in a moment.'
const isDone = (x: unknown): x is Done => !!x && typeof x === 'object' && 'ok' in x

async function writer(): Promise<{ access: Access & { personId: string }; viewer: Viewer } | Done> {
  const closed = await closedRefusal(no)
  if (closed) return closed
  if (await getViewAs()) return no('View Stage is only a preview. Close it to save an event.')
  const access = await writerAccess()
  if (!access?.personId || !access.can('agenda')) return no('Sign in again to save.')
  const dir = await loadDirectory()
  const p = dir.people.get(access.personId)
  return {
    access: access as Access & { personId: string },
    viewer: { id: access.personId, level: access.level as AccessLevel, teamIds: p?.teamIds ?? [], led: dir.led.get(access.personId) ?? new Set<string>() },
  }
}

/** A Meet link for a sample account: the shape of Google's, made from the event so it stays the same. */
const sampleMeet = (key: string) => {
  const r = seeded(`meet:${key}`), l = (n: number) => Array.from({ length: n }, () => String.fromCharCode(97 + Math.floor(r() * 26))).join('')
  return `https://meet.google.com/${l(3)}-${l(4)}-${l(3)}`
}

async function save(input: DrawerInput, id: number | null): Promise<Done> {
  const w = await writer(); if (isDone(w)) return w
  const { access, viewer } = w
  const c = createAdminClient()
  const dir = await loadDirectory()
  const r = checkDrawer(input, { level: viewer.level, led: viewer.led, allLevels: await allLevels(), teamIds: [...dir.teams.keys()] })
  if (!r.ok) return no(r.error)
  const { data: acct } = await c.from('agenda_accounts').select('id, source').eq('id', r.row.sent_from_account_id).eq('person_id', access.personId).maybeSingle()
  if (!acct) return no('That account is no longer connected. Select another one to send from.')

  let eventId = id
  if (id != null) {
    const { data: old } = await c.from('agenda_events').select('id, audience, audience_team_ids, created_by, team_id, meet_link').eq('id', id).maybeSingle()
    if (!old || !old.audience) return no('That event is no longer on the Agenda.')
    if (!mayManage(old as Parameters<typeof mayManage>[0], viewer)) return no('Only who created it can change this event.')
    const meet = r.row.how === 'online' ? (old.meet_link || sampleMeet(`${id}`)) : null
    const { error } = await c.from('agenda_events').update({ ...r.row, meet_link: meet, source: acct.source === 'google' ? 'google' : 'sample' }).eq('id', id)
    if (error) { console.error('[agenda drawer] update:', error.message); return no(NOT_SAVED) }
    const { error: delErr } = await c.from('agenda_event_guests').delete().eq('event_id', id)
    if (delErr) { console.error('[agenda drawer] guests:', delErr.message); return no(NOT_SAVED) }
  } else {
    const { data, error } = await c.from('agenda_events').insert({ ...r.row, created_by: access.personId, add_to_google: false, source: acct.source === 'google' ? 'google' : 'sample' }).select('id').single()
    if (error || !data) { console.error('[agenda drawer] create:', error?.message); return no(NOT_SAVED) }
    eventId = data.id as number
    if (r.row.how === 'online') await c.from('agenda_events').update({ meet_link: sampleMeet(`${eventId}`) }).eq('id', eventId)
  }
  const list = invitees(r.row.audience, r.row.audience_team_ids ?? [], r.guests, await invitablePeople(), access.personId)
  if (list.length) {
    const { error } = await c.from('agenda_event_guests').insert(list.map(g => ({ ...g, event_id: eventId as number })))
    if (error) { console.error('[agenda drawer] guests:', error.message); return no(NOT_SAVED) }
  }
  revalidatePath('/agenda')
  revalidatePath('/')
  const n = list.length
  return { ok: true, toast: `${r.row.title} is on the Agenda${n ? `. Google invitation sent to ${n} ${n === 1 ? 'person' : 'people'}` : ''}.` }
}

export async function createDrawerEvent(input: DrawerInput): Promise<Done> {
  return save(input, null)
}

export async function updateDrawerEvent(input: DrawerInput & { id: number }): Promise<Done> {
  const id = Number(input?.id)
  if (!Number.isSafeInteger(id)) return no(NOT_SAVED)
  return save(input, id)
}

export async function deleteDrawerEvent(input: { id: number }): Promise<Done> {
  const w = await writer(); if (isDone(w)) return w
  const id = Number(input?.id)
  const c = createAdminClient()
  const { data: old } = await c.from('agenda_events').select('id, title, audience, audience_team_ids, created_by, team_id').eq('id', id).maybeSingle()
  if (!old || !old.audience) return no('That event is no longer on the Agenda.')
  if (!mayManage(old as Parameters<typeof mayManage>[0], w.viewer)) return no('Only who created it can delete this event.')
  const { error } = await c.from('agenda_events').delete().eq('id', id)
  if (error) { console.error('[agenda drawer] delete:', error.message); return no(NOT_SAVED) }
  revalidatePath('/agenda')
  revalidatePath('/')
  return { ok: true, toast: `${old.title} was deleted. The guests get Google's cancellation.` }
}

/** Find a time: the working and busy times of these people, from a Washington day for four weeks. */
export async function findTimeData(input: { personIds: string[]; from: string }): Promise<{ ok: true; people: Awaited<ReturnType<typeof loadAvailability>> } | { ok: false; error: string }> {
  const closed = await closedRefusal(no)
  if (closed) return { ok: false, error: closed.ok ? '' : closed.error }
  const access = await writerAccess()
  if (!access?.personId || !access.can('agenda')) return { ok: false, error: 'Sign in again.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input?.from ?? '')) return { ok: false, error: 'Pick a date.' }
  try {
    const ids = [access.personId, ...(input.personIds ?? []).filter(x => typeof x === 'string')]
    return { ok: true, people: await loadAvailability(ids, input.from, 35) }
  } catch (e) {
    console.error('[agenda drawer] find a time:', e instanceof Error ? e.message : e)
    return { ok: false, error: 'Free and busy times could not be read. Try again in a moment.' }
  }
}
