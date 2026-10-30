/**
 * Booking links (owner, 30 October 2026; the approved mockup, Agenda settings
 * "Your booking link" and the public booking page). Pure: the settings action
 * and the public page read the database and decide with these.
 *
 *   The link   Everyone has one, off until they turn it on. They choose the
 *              meeting lengths, the gap between meetings, the minimum notice,
 *              how far ahead people can book and the account the meetings are
 *              made on.
 *   The times  Inside the host's working hours, in the host's own time zone,
 *              never over a busy time (with the gap on both sides), never
 *              sooner than the notice nor later than the window.
 *   Booking    Name and email, up to 10 guests and a note. The time is held
 *              for 15 minutes until the booker confirms from the email.
 *
 * Instants are milliseconds since 1970 (UTC); the booker's time zone only
 * changes how they are shown.
 */

export const LENGTHS = [15, 30, 45, 60] as const
export const GAPS = [0, 10, 15] as const
export const NOTICES = [120, 1440, 2880] as const
export const WINDOWS = [14, 30, 60] as const
export const HOLD_MINUTES = 15
export const MAX_BOOKING_GUESTS = 10

export const GAP_LABEL: Record<number, string> = { 0: 'None', 10: '10 min', 15: '15 min' }
export const NOTICE_LABEL: Record<number, string> = { 120: '2 hours', 1440: '1 day', 2880: '2 days' }
export const WINDOW_LABEL: Record<number, string> = { 14: '2 weeks', 30: '1 month', 60: '2 months' }

export interface LinkRules { lengths: number[]; gap: number; noticeMin: number; windowDays: number }
export interface LinkInput extends LinkRules { on: boolean; accountId: number | null }

const MIN = 60_000, DAY = 864e5

/** The address part of a person's link: their name, plain, with a number when it is taken. */
export function slugFor(name: string, taken: ReadonlySet<string>): string {
  const t = new Set([...taken, ...RESERVED_SLUGS])
  const base = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50).replace(/-+$/, '') || 'meet'
  if (!t.has(base)) return base
  for (let n = 2; ; n++) if (!t.has(`${base}-${n}`)) return `${base}-${n}`
}

/** Addresses under /meet that are pages of their own, never a person's link. */
export const RESERVED_SLUGS = ['confirm'] as const

/** What the settings card may save, or a sentence saying why not. */
export function checkLink(input: LinkInput, accountIds: readonly number[]): { ok: true; link: LinkInput } | { ok: false; error: string } {
  const lengths = [...new Set((input?.lengths ?? []).map(Number))].filter(l => (LENGTHS as readonly number[]).includes(l)).sort((a, b) => a - b)
  if (!lengths.length) return { ok: false, error: 'Pick at least one meeting length.' }
  if (!(GAPS as readonly number[]).includes(input.gap)) return { ok: false, error: 'Pick the gap between meetings.' }
  if (!(NOTICES as readonly number[]).includes(input.noticeMin)) return { ok: false, error: 'Pick the minimum notice.' }
  if (!(WINDOWS as readonly number[]).includes(input.windowDays)) return { ok: false, error: 'Pick how far ahead people can book.' }
  const accountId = input.accountId != null && accountIds.includes(input.accountId) ? input.accountId : null
  if (input.on && accountId == null) return { ok: false, error: 'Choose the account the meetings are made on.' }
  return { ok: true, link: { on: !!input.on, lengths, gap: input.gap, noticeMin: input.noticeMin, windowDays: input.windowDays, accountId } }
}

/** Start times are on the quarter hour for 15 and 45 minute meetings, else on the half hour. */
export const stepOf = (len: number) => (len % 30 === 0 ? 30 : 15)

/**
 * The start of every free time of one length. `work` and `busy` are
 * [start, end) instants; work comes from the host's working hours in their
 * own zone, so its blocks start on the hour or half hour.
 */
export function bookingSlots(work: readonly [number, number][], busy: readonly [number, number][], len: number, rules: Omit<LinkRules, 'lengths'>, now: number): number[] {
  const step = stepOf(len) * MIN, dur = len * MIN, pad = rules.gap * MIN
  const first = now + rules.noticeMin * MIN, last = now + rules.windowDays * DAY
  const out: number[] = []
  for (const [a, b] of work) {
    for (let t = a; t + dur <= b; t += step) {
      if (t < first || t >= last) continue
      if (busy.some(([x, y]) => x < t + dur + pad && y > t - pad)) continue
      out.push(t)
    }
  }
  return [...new Set(out)].sort((x, y) => x - y)
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const clean = (s: unknown, max: number) => String(s ?? '').trim().slice(0, max)

/** Whether the browser's name for a time zone is one this server knows. */
export function validZone(zone: string): boolean {
  try { new Intl.DateTimeFormat('en-US', { timeZone: zone }); return !!zone } catch { return false }
}

export interface BookingInput { len: number; start: number; name: string; email: string; guests: string[]; note?: string; zone: string }
export interface Booking { len: number; start: number; name: string; email: string; guests: string[]; note: string | null; zone: string }

/** The booker's details, cleaned, or a sentence saying what to fix. */
export function checkBooking(input: BookingInput, lengths: readonly number[]): { ok: true; booking: Booking } | { ok: false; error: string } {
  const len = Number(input?.len)
  if (!lengths.includes(len)) return { ok: false, error: 'Pick a meeting length.' }
  const start = Number(input.start)
  if (!Number.isSafeInteger(start)) return { ok: false, error: 'Pick a time.' }
  const name = clean(input.name, 120)
  if (!name) return { ok: false, error: 'Type your name.' }
  const email = clean(input.email, 254).toLowerCase()
  if (!EMAIL.test(email)) return { ok: false, error: 'Type your email address.' }
  const guests: string[] = []
  for (const g of input.guests ?? []) {
    const e = clean(g, 254).toLowerCase()
    if (!e) continue
    if (!EMAIL.test(e)) return { ok: false, error: `${e} does not look like an email address.` }
    if (e !== email && !guests.includes(e)) guests.push(e)
  }
  if (guests.length > MAX_BOOKING_GUESTS) return { ok: false, error: `Up to ${MAX_BOOKING_GUESTS} guests.` }
  const zone = clean(input.zone, 64)
  return { ok: true, booking: { len, start, name, email, guests, note: clean(input.note, 2000) || null, zone: validZone(zone) ? zone : 'America/New_York' } }
}

/** The meeting's name on both calendars. */
export const bookingTitle = (booker: string, host: string) => `${booker} and ${host}`

/** "Maria Santos booked a meeting with you" in the host's bell: when, in the host's time, and how many. */
export function hostLine(start: number, len: number, people: number, hostZone: string): string {
  const day = new Date(start).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: hostZone })
  const at = new Date(start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: hostZone })
  return `${day}, ${at} your time · ${len} min · ${people} ${people === 1 ? 'person' : 'people'}`
}

/** "Monday, November 2, 10:30 AM to 11:00 AM" in a time zone. */
export function whenLine(start: number, len: number, zone: string): string {
  const day = new Date(start).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: zone })
  const t = (ms: number) => new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: zone })
  return `${day}, ${t(start)} to ${t(start + len * MIN)}`
}

/** The time zones the booking page offers, the booker's own added first when it is not here. */
export const BOOKING_ZONES: readonly [string, string][] = [
  ['America/New_York', 'New York (ET)'], ['America/Chicago', 'Chicago (CT)'], ['America/Denver', 'Denver (MT)'],
  ['America/Los_Angeles', 'Los Angeles (PT)'], ['America/Sao_Paulo', 'São Paulo (BRT)'], ['America/Fortaleza', 'Fortaleza (BRT)'],
  ['Europe/London', 'London (UK)'], ['Europe/Lisbon', 'Lisbon'], ['Africa/Lagos', 'Lagos (WAT)'],
  ['Africa/Kigali', 'Kigali (CAT)'], ['Africa/Nairobi', 'Nairobi (EAT)'], ['Asia/Manila', 'Manila (PHT)'],
]

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

/** The email that confirms a booking: the only way to turn a held time into a meeting. */
export function confirmEmail(x: { host: string; booker: string; when: string; zone: string; guests: number; link: string }): { subject: string; html: string; text: string } {
  const first = x.booker.split(/\s+/)[0] || 'there'
  const guests = x.guests ? `, with ${x.guests} ${x.guests === 1 ? 'guest' : 'guests'}` : ''
  const subject = `Confirm your meeting with ${x.host}`
  const text = `Hi ${first},\n\nPlease confirm your meeting with ${x.host}:\n${x.when}, ${x.zone}\nGoogle Meet${guests}\n\nConfirm my meeting: ${x.link}\n\nThe time is held for ${HOLD_MINUTES} minutes. If you did not ask for this meeting, ignore this email and nothing is booked.`
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1c2b3a;max-width:520px">
<p>Hi ${esc(first)},</p><p>Please confirm your meeting with ${esc(x.host)}:</p>
<p><b>${esc(x.when)}, ${esc(x.zone)}</b><br>Google Meet${esc(guests)}</p>
<p><a href="${esc(x.link)}" style="display:inline-block;background:#012358;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:10px">Confirm my meeting</a></p>
<p style="color:#5b6b7b;font-size:13px">The time is held for ${HOLD_MINUTES} minutes. If you did not ask for this meeting, ignore this email and nothing is booked.</p></div>`
  return { subject, html, text }
}

/** A time zone's name for people: "São Paulo (BRT)" from the list, else the city. */
export const bookingZoneLabel = (zone: string) => BOOKING_ZONES.find(z => z[0] === zone)?.[1] ?? (zone.split('/').pop() ?? zone).replace(/_/g, ' ')
