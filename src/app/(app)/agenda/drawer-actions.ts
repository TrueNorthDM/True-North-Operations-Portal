'use server'

/**
 * The New event drawer (owner, 30 October 2026): create, change and delete an
 * event, and read everyone's working and busy times for Find a time.
 *
 * Rules in lib/agenda/event-rules.ts. The event is made on the creator's own
 * Google account (Send from): on an account signed in with Google it goes to
 * that Google Calendar, which sends the invitations and makes the Meet link
 * (lib/agenda/google-events.ts); on a sample account it stays in the portal
 * with a sample Meet link. Refused while the new Agenda is closed (migration
 * 134) and during a View Stage preview.
 */

import { revalidatePath } from 'next/cache'
import { writerAccess, type Access } from '@/lib/access/resolve'
import type { AccessLevel } from '@/lib/access/catalogue'
import { getViewAs } from '@/lib/auth/view-as-server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadDirectory } from '@/lib/timeclock/clocky-context'
import { closedRefusal } from '@/lib/agenda/google-lock'
import { allLevels, invitablePeople, loadAvailability } from '@/lib/agenda/drawer-data'
import { checkDrawer, invitees, mayManage, seesEvent, type DrawerInput, type SeenRow, type Viewer } from '@/lib/agenda/event-rules'
import { sampleMeetLink } from '@/lib/agenda/sample-plan'
import { answerOnGoogle, readFromGoogle, removeFromGoogle, sendToGoogle, type GuestAnswer } from '@/lib/agenda/google-events'
import { answerOf, type Answer } from '@/lib/agenda/model'
import { endBefore, fromRRule, instanceId, lastDay, restFrom, toRRule, type Scope } from '@/lib/agenda/recurrence'
import { occurrenceOf } from '@/lib/agenda/series'

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

const sampleMeet = sampleMeetLink

/** `extra`: columns a new row also takes (one occurrence of a series: its series, its day, its Google id). */
async function save(input: DrawerInput, id: number | null, extra: Record<string, unknown> = {}): Promise<Done> {
  const w = await writer(); if (isDone(w)) return w
  const { access, viewer } = w
  const c = createAdminClient()
  const dir = await loadDirectory()
  const r = checkDrawer(input, { level: viewer.level, led: viewer.led, allLevels: await allLevels(), teamIds: [...dir.teams.keys()] })
  if (!r.ok) return no(r.error)
  // Their own account, or the team calendar (office@), which anyone may send from.
  const { data: acct } = await c.from('agenda_accounts').select('id, source').eq('id', r.row.sent_from_account_id).or(`person_id.eq.${access.personId},team_calendar.eq.true`).maybeSingle()
  if (!acct) return no('That account is no longer connected. Select another one to send from.')

  const google = acct.source === 'google'
  let eventId = id
  let before: { accountId: number | null; googleEventId: string | null } | undefined
  if (id != null) {
    const { data: old } = await c.from('agenda_events').select('id, audience, audience_team_ids, created_by, team_id, meet_link, sent_from_account_id, google_event_id, series_id').eq('id', id).maybeSingle()
    if (!old || !old.audience) return no('That event is no longer on the Agenda.')
    if (!mayManage(old as Parameters<typeof mayManage>[0], viewer)) return no('Only who created it can change this event.')
    before = { accountId: old.sent_from_account_id, googleEventId: old.google_event_id }
    // One occurrence changed on its own stays one occurrence: it never becomes a series of its own.
    if (old.series_id) { r.row.recurrence = null; r.row.recur_until = null }
    // On Google the link is Google's own (sendToGoogle sets it); a sample account keeps a sample one.
    const meet = r.row.how !== 'online' ? null : google ? old.meet_link : (old.meet_link || sampleMeet(`${id}`))
    const { error } = await c.from('agenda_events').update({ ...r.row, meet_link: meet, source: google ? 'google' : 'sample' }).eq('id', id)
    if (error) { console.error('[agenda drawer] update:', error.message); return no(NOT_SAVED) }
    const { error: delErr } = await c.from('agenda_event_guests').delete().eq('event_id', id)
    if (delErr) { console.error('[agenda drawer] guests:', delErr.message); return no(NOT_SAVED) }
  } else {
    const { data, error } = await c.from('agenda_events').insert({ ...r.row, created_by: access.personId, add_to_google: false, source: google ? 'google' : 'sample', ...extra }).select('id').single()
    if (error || !data) { console.error('[agenda drawer] create:', error?.message); return no(NOT_SAVED) }
    eventId = data.id as number
    if (r.row.how === 'online' && !google) await c.from('agenda_events').update({ meet_link: sampleMeet(`${eventId}`) }).eq('id', eventId)
  }
  const list = invitees(r.row.audience, r.row.audience_team_ids ?? [], r.guests, await invitablePeople(), access.personId)
  if (list.length) {
    const { error } = await c.from('agenda_event_guests').insert(list.map(g => ({ ...g, event_id: eventId as number })))
    if (error) { console.error('[agenda drawer] guests:', error.message); return no(NOT_SAVED) }
  }
  // Moved from a Google account to a sample one: its Google copy goes.
  if (!google && before?.googleEventId && before.accountId != null) {
    await removeFromGoogle(before.accountId, before.googleEventId)
    await c.from('agenda_events').update({ google_event_id: null, calendar_state: null }).eq('id', eventId as number)
  }
  const sent = google ? await sendToGoogle(eventId as number, before) : true
  revalidatePath('/agenda')
  revalidatePath('/')
  const n = list.length
  if (!sent) return { ok: true, toast: `${r.row.title} is on the Agenda, but Google did not take it, so no invitation went out. Open it and save again, or reconnect the account in Agenda settings.` }
  return { ok: true, toast: `${r.row.title} is on the Agenda${n ? `. Google invitation sent to ${n} ${n === 1 ? 'person' : 'people'}` : ''}.` }
}

export async function createDrawerEvent(input: DrawerInput): Promise<Done> {
  return save(input, null)
}

const SERIES_COLS = 'id, title, audience, audience_team_ids, created_by, team_id, start_date, end_date, starts_at, ends_at, time_zone, recurrence, skip_days, sent_from_account_id, google_event_id, meet_link'
type SeriesOld = { id: number; title: string; audience: string | null; audience_team_ids: string[] | null; created_by: string | null; team_id: string | null; start_date: string; end_date: string; starts_at: string | null; ends_at: string | null; time_zone: string | null; recurrence: string | null; skip_days: string[] | null; sent_from_account_id: number | null; google_event_id: string | null; meet_link: string | null }
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5)
const plusDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10)

/** The id Google gives one occurrence of this series on `day`. */
function occurrenceGoogleId(old: SeriesOld, day: string): string | null {
  if (!old.google_event_id) return null
  const o = occurrenceOf(old, day)
  return instanceId(old.google_event_id, o.starts_at ? { at: o.starts_at } : { date: day })
}

/** A series ends the day before `day` ("This and following"): its rule, its later one-off changes, and its Google copy. */
async function cutSeries(old: SeriesOld, day: string): Promise<boolean> {
  const c = createAdminClient()
  const rule = fromRRule(old.recurrence)
  const cut = rule ? endBefore(rule, old.start_date, day) : null
  if (!rule || !cut) return false
  const { error } = await c.from('agenda_events').update({ recurrence: toRRule(cut, old.start_date, !old.starts_at), recur_until: lastDay(cut, old.start_date), skip_days: (old.skip_days ?? []).filter(d => d < day) }).eq('id', old.id)
  if (error) throw new Error(error.message)
  await c.from('agenda_events').delete().eq('series_id', old.id).gte('original_day', day)
  if (old.google_event_id) await sendToGoogle(old.id)
  return true
}

/**
 * A change to an event. On one occurrence of a series (`occurrence`), the
 * answer to "This event, This and following, or All events" decides what
 * changes, here and on Google, as Google Calendar does it.
 */
export async function updateDrawerEvent(input: DrawerInput & { id: number; occurrence?: { day: string; scope: Scope } | null }): Promise<Done> {
  const id = Number(input?.id)
  if (!Number.isSafeInteger(id)) return no(NOT_SAVED)
  const occ = input.occurrence
  if (!occ || !/^\d{4}-\d{2}-\d{2}$/.test(occ.day ?? '') || !['one', 'following', 'all'].includes(occ.scope)) return save(input, id)
  const w = await writer(); if (isDone(w)) return w
  const c = createAdminClient()
  const { data } = await c.from('agenda_events').select(SERIES_COLS).eq('id', id).maybeSingle()
  const old = data as SeriesOld | null
  if (!old?.audience) return no('That event is no longer on the Agenda.')
  if (!mayManage(old as Parameters<typeof mayManage>[0], w.viewer)) return no('Only who created it can change this event.')
  if (!old.recurrence) return save(input, id)
  const day = occ.day

  if (occ.scope === 'all' || (occ.scope === 'following' && day <= old.start_date)) {
    // The whole series moves by as many days as this occurrence moved, and keeps the new times.
    return save({ ...input, date: plusDays(old.start_date, daysBetween(day, input.date)) }, id)
  }
  if (occ.scope === 'one') {
    const single = { ...input, repeat: null }
    const { data: mine } = await c.from('agenda_events').select('id').eq('series_id', id).eq('original_day', day).maybeSingle()
    if (mine) return save(single, mine.id as number)
    const done = await save(single, null, { series_id: id, original_day: day, created_by: old.created_by, google_event_id: occurrenceGoogleId(old, day), meet_link: old.meet_link })
    if (done.ok) await c.from('agenda_events').update({ skip_days: [...new Set([...(old.skip_days ?? []), day])] }).eq('id', id)
    return done
  }
  // This and following: the series ends the day before, and a new one starts with the changes.
  const rule = fromRRule(old.recurrence)!
  const rest = input.repeat && input.repeat.ends === 'count' && rule.ends === 'count' ? { ...input.repeat, count: restFrom(rule, old.start_date, day).count } : input.repeat
  try {
    await cutSeries(old, day)
  } catch (e) {
    console.error('[agenda drawer] cut series:', e instanceof Error ? e.message : e)
    return no(NOT_SAVED)
  }
  return save({ ...input, repeat: rest ?? null }, null)
}

export async function deleteDrawerEvent(input: { id: number; occurrence?: { day: string; scope: Scope } | null }): Promise<Done> {
  const w = await writer(); if (isDone(w)) return w
  const id = Number(input?.id)
  const c = createAdminClient()
  const { data } = await c.from('agenda_events').select(SERIES_COLS).eq('id', id).maybeSingle()
  const old = data as SeriesOld | null
  if (!old || !old.audience) return no('That event is no longer on the Agenda.')
  if (!mayManage(old as Parameters<typeof mayManage>[0], w.viewer)) return no('Only who created it can delete this event.')
  const occ = input.occurrence
  if (old.recurrence && occ && /^\d{4}-\d{2}-\d{2}$/.test(occ.day ?? '') && occ.scope !== 'all' && !(occ.scope === 'following' && occ.day <= old.start_date)) {
    try {
      if (occ.scope === 'one') {
        // Only this one: taken out of the series here, and cancelled on Google (which tells the guests).
        const { data: mine } = await c.from('agenda_events').select('id').eq('series_id', id).eq('original_day', occ.day).maybeSingle()
        if (mine) await c.from('agenda_events').delete().eq('id', mine.id)
        const gid = occurrenceGoogleId(old, occ.day)
        if (gid && old.sent_from_account_id != null && !(await removeFromGoogle(old.sent_from_account_id, gid))) {
          return no('Google did not cancel it, so the guests were not told. Try again in a moment.')
        }
        const { error } = await c.from('agenda_events').update({ skip_days: [...new Set([...(old.skip_days ?? []), occ.day])] }).eq('id', id)
        if (error) throw new Error(error.message)
      } else {
        await cutSeries(old, occ.day)
      }
    } catch (e) {
      console.error('[agenda drawer] delete occurrence:', e instanceof Error ? e.message : e)
      return no(NOT_SAVED)
    }
    revalidatePath('/agenda')
    revalidatePath('/')
    return { ok: true, toast: occ.scope === 'one' ? `${old.title} on that day was deleted. The guests get Google's cancellation.` : `${old.title} was deleted from that day on.` }
  }
  if (old.google_event_id && old.sent_from_account_id != null && !(await removeFromGoogle(old.sent_from_account_id, old.google_event_id))) {
    return no('Google did not delete it, so the guests were not told. Try again in a moment, or reconnect the account in Agenda settings.')
  }
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

/** How long answers read from Google count as current when a card opens. */
const ANSWERS_FRESH_MS = 60_000

/** The event and its guests, when the viewer may see it. */
async function seenEvent(id: number, viewer: Viewer) {
  const c = createAdminClient()
  const { data: e } = await c.from('agenda_events').select('id, audience, audience_team_ids, created_by, team_id, google_event_id, responses_read_at').eq('id', id).maybeSingle()
  if (!e?.audience) return null
  const { data: gs } = await c.from('agenda_event_guests').select('person_id, email, response').eq('event_id', id)
  const guests = (gs ?? []) as { person_id: string | null; email: string; response: string }[]
  if (!seesEvent(e as SeenRow, viewer, new Set(guests.map(g => g.person_id).filter((x): x is string => !!x)))) return null
  return { e, guests }
}

/**
 * When a card opens: the guests' answers as Google has them now, read at most
 * once a minute. `gone`: the event was deleted in Google, so it comes off the
 * Agenda here too.
 */
export async function eventAnswers(input: { id: number }): Promise<{ ok: true; gone: boolean; answers: Record<string, Answer> } | { ok: false; error: string }> {
  const closed = await closedRefusal(no)
  if (closed) return { ok: false, error: closed.ok ? '' : closed.error }
  const access = await writerAccess()
  if (!access?.personId || !access.can('agenda')) return { ok: false, error: 'Sign in again.' }
  const id = Number(input?.id)
  if (!Number.isSafeInteger(id)) return { ok: false, error: 'That event is no longer on the Agenda.' }
  const dir = await loadDirectory()
  const viewer: Viewer = { id: access.personId, level: access.level as AccessLevel, teamIds: dir.people.get(access.personId)?.teamIds ?? [], led: dir.led.get(access.personId) ?? new Set<string>() }
  let seen = await seenEvent(id, viewer)
  if (!seen) return { ok: false, error: 'That event is no longer on the Agenda.' }
  const fresh = seen.e.responses_read_at && Date.now() - Date.parse(seen.e.responses_read_at) < ANSWERS_FRESH_MS
  if (seen.e.google_event_id && !fresh) {
    const r = await readFromGoogle(id)
    if (r?.gone) {
      await createAdminClient().from('agenda_events').delete().eq('id', id)
      revalidatePath('/agenda'); revalidatePath('/')
      return { ok: true, gone: true, answers: {} }
    }
    seen = (await seenEvent(id, viewer)) ?? seen
  }
  const answers: Record<string, Answer> = {}
  for (const g of seen.guests) answers[g.email.toLowerCase()] = answerOf(g.response)
  return { ok: true, gone: false, answers }
}

/** A guest's Yes, No or Maybe from the open card. */
export async function answerEvent(input: { id: number; answer: GuestAnswer }): Promise<Done> {
  const w = await writer(); if (isDone(w)) return w
  const id = Number(input?.id)
  const answer = input?.answer
  if (!Number.isSafeInteger(id) || !['yes', 'no', 'maybe'].includes(answer)) return no(NOT_SAVED)
  const seen = await seenEvent(id, w.viewer)
  const mine = seen?.guests.find(g => g.person_id === w.access.personId)
  if (!seen || !mine) return no('Only someone invited can answer.')
  const sent = await answerOnGoogle(id, w.access.personId, mine.email, answer)
  revalidatePath('/agenda')
  const said = answer === 'yes' ? 'going' : answer === 'no' ? 'not going' : 'maybe going'
  return { ok: true, toast: sent || !seen.e.google_event_id ? `You said you are ${said}.` : `You said you are ${said}. Google did not take the answer yet, so the organizer may not see it there.` }
}
