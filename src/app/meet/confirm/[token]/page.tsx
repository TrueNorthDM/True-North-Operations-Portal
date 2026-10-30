// The link in the booking confirmation email (owner, 30 October 2026). Shows
// the meeting and one button that books it; see BookingConfirm for why it
// never books on open. The token is checked by its hash, like the action does.

import { createHash } from 'node:crypto'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { agendaGoogleOpen } from '@/lib/agenda/google-lock'
import { bookingZoneLabel, whenLine } from '@/lib/agenda/booking'
import { BookingConfirm } from '@/components/agenda/booking/BookingConfirm'
import { confirmBooking } from '../../actions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Confirm your meeting', robots: { index: false, follow: false } }

/** Booked, still held, or let go (not confirmed in time, or replaced by a newer email). */
function stateOf(b: { state: string; held_until: string }, now = Date.now()): 'held' | 'booked' | 'gone' {
  return b.state === 'booked' ? 'booked' : b.state === 'held' && Date.parse(b.held_until) > now ? 'held' : 'gone'
}

export default async function ConfirmPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!(await agendaGoogleOpen()) || !/^[A-Za-z0-9_-]{20,64}$/.test(token)) notFound()
  const c = createAdminClient()
  const { data: b } = await c.from('agenda_bookings').select('host_id, starts_at, ends_at, email, guests, booker_zone, state, held_until')
    .eq('token_hash', createHash('sha256').update(token).digest('hex')).maybeSingle()
  if (!b) notFound()
  const [{ data: link }, { data: p }] = await Promise.all([
    c.from('agenda_booking_links').select('slug').eq('person_id', b.host_id).maybeSingle(),
    c.from('people').select('full_name').eq('id', b.host_id).maybeSingle(),
  ])
  const name = ((p?.full_name as string | undefined) ?? '').trim()
  const start = Date.parse(b.starts_at), len = Math.round((Date.parse(b.ends_at) - start) / 60_000)
  const zone = b.booker_zone as string
  const state = stateOf(b)
  return (
    <BookingConfirm confirm={confirmBooking} view={{
      token, len, state,
      host: { name, initials: name.split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase(), slug: (link?.slug as string | undefined) ?? '' },
      when: `${whenLine(start, len, zone)}, ${bookingZoneLabel(zone)}`,
      short: `${new Date(start).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: zone })}, ${new Date(start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: zone })}`,
      everyone: [b.email as string, ...((b.guests ?? []) as string[])],
    }} />
  )
}
