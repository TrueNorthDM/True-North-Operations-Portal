/**
 * Booking links, server side (owner, 30 October 2026): each person's link for
 * Agenda settings, and for the public page the host behind an address and
 * their free times. Rules in booking.ts; busy times as Find a time reads them
 * (drawer-data.ts), plus the times held or booked through the link. Server only.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { loadDirectory } from '@/lib/timeclock/clocky-context'
import { loadAvailability } from './drawer-data'
import { bookingSlots, slugFor } from './booking'
import { DC, localOf } from './time'

export interface LinkRow {
  person_id: string; slug: string; is_on: boolean; lengths: number[]
  gap_min: number; notice_min: number; window_days: number; account_id: number | null
}
const LINK_COLS = 'person_id, slug, is_on, lengths, gap_min, notice_min, window_days, account_id'

/** The person's link, made the first time it is asked for: off, on their first account. */
export async function ensureLink(personId: string): Promise<LinkRow> {
  const c = createAdminClient()
  const { data, error } = await c.from('agenda_booking_links').select(LINK_COLS).eq('person_id', personId).maybeSingle()
  if (error) throw new Error(`The booking link could not be read: ${error.message}`)
  if (data) return data as LinkRow
  const dir = await loadDirectory()
  const [{ data: slugs }, { data: acct }] = await Promise.all([
    c.from('agenda_booking_links').select('slug'),
    c.from('agenda_accounts').select('id').eq('person_id', personId).order('connected_at').limit(1).maybeSingle(),
  ])
  const slug = slugFor(dir.nameOf(personId), new Set((slugs ?? []).map(s => s.slug as string)))
  const { data: made, error: e } = await c.from('agenda_booking_links')
    .upsert({ person_id: personId, slug, account_id: (acct?.id as number | undefined) ?? null }, { onConflict: 'person_id', ignoreDuplicates: true })
    .select(LINK_COLS).maybeSingle()
  if (e) throw new Error(`The booking link could not be made: ${e.message}`)
  if (made) return made as LinkRow
  const { data: again } = await c.from('agenda_booking_links').select(LINK_COLS).eq('person_id', personId).single()
  return again as LinkRow
}

export interface PublicHost {
  personId: string; name: string; initials: string; zone: string; slug: string
  lengths: number[]; gap: number; noticeMin: number; windowDays: number; accountId: number
}

const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()

/**
 * The host behind a booking address: `host` when they can be booked, `off`
 * (their name) when the link is off, the person has no account to make the
 * meeting on, or the person has left; null when there is no such address.
 */
export async function loadPublicLink(slug: string): Promise<{ host: PublicHost } | { off: string } | null> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 60) return null
  const { data } = await createAdminClient().from('agenda_booking_links').select(LINK_COLS).eq('slug', slug).maybeSingle()
  if (!data) return null
  return hostOf(data as LinkRow)
}

/** The host a booking was made with, for confirming it; null when they can no longer be booked. */
export async function loadHost(personId: string): Promise<PublicHost | null> {
  const { data } = await createAdminClient().from('agenda_booking_links').select(LINK_COLS).eq('person_id', personId).maybeSingle()
  const r = data ? await hostOf(data as LinkRow) : null
  return r && 'host' in r ? r.host : null
}

async function hostOf(l: LinkRow): Promise<{ host: PublicHost } | { off: string }> {
  const { data: p } = await createAdminClient().from('people').select('id, full_name, status').eq('id', l.person_id).maybeSingle()
  const name = ((p?.full_name as string | undefined) ?? '').trim()
  // No account chosen yet (or the chosen one was disconnected): the first one the person connected, as Agenda settings shows it.
  let accountId = l.account_id
  if (accountId == null) {
    const { data: first } = await createAdminClient().from('agenda_accounts').select('id').eq('person_id', l.person_id).order('connected_at').limit(1).maybeSingle()
    accountId = first?.id ?? null
  }
  if (!l.is_on || accountId == null || !p || p.status !== 'active') return { off: name || 'This person' }
  const dir = await loadDirectory()
  return {
    host: {
      personId: l.person_id, name, initials: initialsOf(name), zone: dir.zoneOf(l.person_id), slug: l.slug,
      lengths: [...l.lengths].sort((a, b) => a - b), gap: l.gap_min, noticeMin: l.notice_min, windowDays: l.window_days, accountId,
    },
  }
}

/**
 * The host's free times for each length. `now` is when the notice and the
 * window count from: a confirmation counts from when the time was held, so
 * the 15 minutes of the hold never push it under the notice. `except` is the
 * hold being confirmed, which must not block itself.
 */
export async function freeSlots(host: PublicHost, now = Date.now(), except?: number): Promise<Record<number, number[]>> {
  const [av] = await loadAvailability([host.personId], localOf(now, DC).date, host.windowDays + 2)
  const c = createAdminClient()
  const { data, error } = await c.from('agenda_bookings').select('id, starts_at, ends_at, state, held_until')
    .eq('host_id', host.personId).in('state', ['held', 'booked']).gt('ends_at', new Date(now).toISOString())
  if (error) throw new Error(`Bookings could not be read: ${error.message}`)
  const live = Date.now()
  const busy: [number, number][] = [...(av?.avail.busy ?? [])]
  for (const b of (data ?? []) as { id: number; starts_at: string; ends_at: string; state: string; held_until: string }[]) {
    if (b.id === except || (b.state === 'held' && Date.parse(b.held_until) <= live)) continue
    busy.push([Date.parse(b.starts_at), Date.parse(b.ends_at)])
  }
  const rules = { gap: host.gap, noticeMin: host.noticeMin, windowDays: host.windowDays }
  return Object.fromEntries(host.lengths.map(len => [len, bookingSlots(av?.avail.work ?? [], busy, len, rules, now)]))
}
