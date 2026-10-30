'use server'

/**
 * The public booking page (owner, 30 October 2026): anyone, signed in or not,
 * holds a time on someone's booking link and confirms it from the email.
 *
 * No session here on purpose, so every action checks the rest itself: the new
 * Agenda is open, the link is on, the time is one of the host's free times,
 * and the booker is not trying too often (a hash of their network address and
 * their email, counted over the last hour). Holding and confirming go through
 * migration 138's functions, one host at a time, so a time is never booked
 * twice. Only the email holds the confirmation link: the page never sees it,
 * except on the staging copy, which cannot email people and shows it instead.
 */

import { createHash, randomBytes } from 'node:crypto'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { IS_STAGING } from '@/lib/environment'
import { sendEmail } from '@/lib/email/resend'
import { agendaGoogleOpen } from '@/lib/agenda/google-lock'
import { freeSlots, loadHost, loadPublicLink } from '@/lib/agenda/booking-data'
import { bookingTitle, bookingZoneLabel, checkBooking, confirmEmail, HOLD_MINUTES, hostLine, whenLine, type BookingInput } from '@/lib/agenda/booking'
import { sampleMeetLink } from '@/lib/agenda/sample-plan'
import { DC, localOf } from '@/lib/agenda/time'
import { portalOrigin } from '@/lib/timeclock/clocky-notify'
import { notifyAgendaBooking } from '@/lib/notifications/run'

type Fail = { ok: false; error: string }
const no = (error: string): Fail => ({ ok: false, error })
const TRY_AGAIN = 'Something went wrong. Try again in a moment.'
const NOT_TAKING = 'This booking page is not taking bookings right now.'
/** Holds per network address and per email in an hour. */
const PER_CLIENT = 8, PER_EMAIL = 4, MAX_EMAILS = 3

const sha = (s: string) => createHash('sha256').update(s).digest('hex')
async function clientKey(): Promise<string> {
  const h = await headers()
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || 'unknown'
  return sha(`agenda-booking:${ip}`)
}

export interface HoldPreview { subject: string; link: string; html: string }
export type Held = { ok: true; id: number; heldUntil: string; preview: HoldPreview | null } | Fail

/** Emails the confirmation link; on staging, also hands it back to show on the page. */
async function emailLink(b: { id: number; email: string; name: string; starts_at: string; ends_at: string; booker_zone: string; guests: string[] }, hostName: string, token: string, sent: number): Promise<{ ok: true; preview: HoldPreview | null } | Fail> {
  const start = Date.parse(b.starts_at), len = Math.round((Date.parse(b.ends_at) - start) / 60_000)
  const link = `${await portalOrigin()}/meet/confirm/${token}`
  const mail = confirmEmail({ host: hostName, booker: b.name, when: whenLine(start, len, b.booker_zone), zone: bookingZoneLabel(b.booker_zone), guests: b.guests.length, link })
  const r = await sendEmail({ to: b.email, ...mail, idempotencyKey: `agenda-booking:${b.id}:${sent}` })
  const blocked = !r.sent && !!r.blocked
  if (!r.sent && !blocked) { console.error('[booking] email:', r.reason); return no('The email could not be sent. Try again in a moment.') }
  await createAdminClient().from('agenda_bookings').update({ emails_sent: sent, emailed_at: new Date().toISOString() }).eq('id', b.id)
  return { ok: true, preview: IS_STAGING || blocked ? { subject: mail.subject, link, html: mail.html } : null }
}

/** Holds a time for 15 minutes and emails the link that confirms it. */
export async function holdBooking(input: BookingInput & { slug: string }): Promise<Held> {
  if (!(await agendaGoogleOpen())) return no(NOT_TAKING)
  const found = await loadPublicLink(String(input?.slug ?? ''))
  if (!found || !('host' in found)) return no(NOT_TAKING)
  const host = found.host
  const r = checkBooking(input, host.lengths)
  if (!r.ok) return no(r.error)
  const b = r.booking
  const c = createAdminClient()
  const key = await clientKey()
  const since = new Date(Date.now() - 3600e3).toISOString()
  const [byClient, byEmail] = await Promise.all([
    c.from('agenda_bookings').select('id', { count: 'exact', head: true }).eq('client_key', key).gt('created_at', since),
    c.from('agenda_bookings').select('id', { count: 'exact', head: true }).ilike('email', b.email).gt('created_at', since),
  ])
  if ((byClient.count ?? 0) >= PER_CLIENT || (byEmail.count ?? 0) >= PER_EMAIL) return no('Too many tries in the last hour. Try again later.')

  try {
    const free = await freeSlots(host, Date.now())
    if (!free[b.len]?.includes(b.start)) return no('That time was just taken. Pick another one.')
  } catch (e) {
    console.error('[booking] free times:', e instanceof Error ? e.message : e)
    return no(TRY_AGAIN)
  }
  const token = randomBytes(24).toString('base64url')
  const heldUntil = new Date(Date.now() + HOLD_MINUTES * 60_000).toISOString()
  const start = new Date(b.start).toISOString(), end = new Date(b.start + b.len * 60_000).toISOString()
  const { data: id, error } = await c.rpc('agenda_booking_hold', {
    p_host: host.personId, p_start: start, p_end: end, p_gap: host.gap, p_name: b.name, p_email: b.email, p_guests: b.guests,
    p_note: b.note, p_zone: b.zone, p_token_hash: sha(token), p_client: key, p_held_until: heldUntil,
  })
  if (error) { console.error('[booking] hold:', error.message); return no(TRY_AGAIN) }
  if (id == null) return no('That time was just taken. Pick another one.')
  const mailed = await emailLink({ id: id as number, email: b.email, name: b.name, starts_at: start, ends_at: end, booker_zone: b.zone, guests: b.guests }, host.name, token, 1)
  if (!mailed.ok) {
    await c.from('agenda_bookings').update({ state: 'expired' }).eq('id', id as number)
    return mailed
  }
  return { ok: true, id: id as number, heldUntil, preview: mailed.preview }
}

/** "Send it again": a new link (the old one stops working), at most three emails, while the time is held. */
export async function resendBooking(input: { id: number; email: string }): Promise<Held> {
  if (!(await agendaGoogleOpen())) return no(NOT_TAKING)
  const c = createAdminClient()
  const { data: b } = await c.from('agenda_bookings').select('id, host_id, email, name, starts_at, ends_at, booker_zone, guests, state, held_until, emails_sent, emailed_at')
    .eq('id', Number(input?.id)).maybeSingle()
  if (!b || b.email !== String(input?.email ?? '').trim().toLowerCase()) return no(TRY_AGAIN)
  if (b.state !== 'held' || Date.parse(b.held_until) <= Date.now()) return no('The time is no longer held. Pick it again.')
  if (b.emails_sent >= MAX_EMAILS) return no('We already sent it three times. Check the spam folder.')
  if (b.emailed_at && Date.now() - Date.parse(b.emailed_at) < 30_000) return no('Give it half a minute, then send it again.')
  const host = await loadHost(b.host_id)
  if (!host) return no(NOT_TAKING)
  const token = randomBytes(24).toString('base64url')
  const { error } = await c.from('agenda_bookings').update({ token_hash: sha(token) }).eq('id', b.id).eq('state', 'held')
  if (error) { console.error('[booking] resend:', error.message); return no(TRY_AGAIN) }
  const mailed = await emailLink(b, host.name, token, b.emails_sent + 1)
  return mailed.ok ? { ok: true, id: b.id, heldUntil: b.held_until, preview: mailed.preview } : mailed
}

export type Confirmed = { ok: true; already: boolean } | Fail

/**
 * The link in the email: checks the time is still free, books it, makes the
 * meeting on the host's account with the booker and the guests invited, and
 * tells the host in their bell.
 */
export async function confirmBooking(input: { token: string }): Promise<Confirmed> {
  if (!(await agendaGoogleOpen())) return no(NOT_TAKING)
  const hash = sha(String(input?.token ?? ''))
  const c = createAdminClient()
  const { data: b } = await c.from('agenda_bookings').select('id, host_id, starts_at, ends_at, name, email, guests, note, state, held_until, created_at')
    .eq('token_hash', hash).maybeSingle()
  if (!b) return no('This link does not work any more. If you asked for it again, use the newest email.')
  if (b.state === 'booked') return { ok: true, already: true }
  if (b.state !== 'held' || Date.parse(b.held_until) <= Date.now()) return no('The 15 minutes to confirm have passed, so the time was let go. Pick a time again.')
  const host = await loadHost(b.host_id)
  if (!host) return no(NOT_TAKING)
  const start = Date.parse(b.starts_at), len = Math.round((Date.parse(b.ends_at) - start) / 60_000)

  // Free and busy again: the host's calendar may have filled since the hold.
  try {
    const free = await freeSlots(host, Date.parse(b.created_at), b.id)
    if (!free[len]?.includes(start)) {
      await c.from('agenda_bookings').update({ state: 'expired' }).eq('id', b.id)
      return no(`${host.name} is no longer free at that time. Pick another time.`)
    }
  } catch (e) {
    console.error('[booking] free times:', e instanceof Error ? e.message : e)
    return no(TRY_AGAIN)
  }
  const { data: ok, error } = await c.rpc('agenda_booking_confirm', { p_token_hash: hash, p_gap: host.gap })
  if (error) { console.error('[booking] confirm:', error.message); return no(TRY_AGAIN) }
  if (ok == null) return no('That time was just taken. Pick another time.')

  const { data: acct } = await c.from('agenda_accounts').select('source').eq('id', host.accountId).maybeSingle()
  const day = localOf(start, DC).date
  const { data: ev, error: evErr } = await c.from('agenda_events').insert({
    kind: 'event', type: 'meeting', audience: 'guests', title: bookingTitle(b.name, host.name),
    start_date: day, end_date: day, starts_at: b.starts_at, ends_at: b.ends_at, time_zone: DC,
    how: 'online', place: null, audience_team_ids: null, client: null,
    description: [b.note, `Booked by ${b.name} (${b.email}) on ${host.name}'s booking link.`].filter(Boolean).join('\n\n'),
    sent_from_account_id: host.accountId, created_by: host.personId, add_to_google: false,
    source: acct?.source === 'google' ? 'google' : 'sample',
  }).select('id').single()
  if (evErr || !ev) {
    console.error('[booking] event:', evErr?.message)
    await c.from('agenda_bookings').update({ state: 'held', confirmed_at: null }).eq('id', b.id)
    return no(TRY_AGAIN)
  }
  const eventId = ev.id as number
  await c.from('agenda_events').update({ meet_link: sampleMeetLink(`${eventId}`) }).eq('id', eventId)
  const guests = [b.email as string, ...((b.guests ?? []) as string[])]
  const { data: known } = await c.from('people').select('id, email_true_north, email_goodnews').eq('status', 'active')
  const personOf = new Map<string, string>()
  for (const p of (known ?? []) as { id: string; email_true_north: string | null; email_goodnews: string | null }[]) {
    for (const e of [p.email_true_north, p.email_goodnews]) if (e) personOf.set(e.trim().toLowerCase(), p.id)
  }
  const { error: gErr } = await c.from('agenda_event_guests').insert(guests.map(email => ({ event_id: eventId, email, person_id: personOf.get(email) ?? null, via: 'guest' })))
  if (gErr) console.error('[booking] guests:', gErr.message)
  await c.from('agenda_bookings').update({ event_id: eventId }).eq('id', b.id)
  try {
    await notifyAgendaBooking({ bookingId: b.id, hostId: host.personId, title: `New booking: ${b.name}`, body: hostLine(start, len, guests.length, host.zone) })
  } catch (e) {
    console.error('[booking] notify:', e instanceof Error ? e.message : e)
  }
  revalidatePath('/agenda')
  revalidatePath('/')
  return { ok: true, already: false }
}
