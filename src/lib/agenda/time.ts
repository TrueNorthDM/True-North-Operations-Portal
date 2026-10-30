/**
 * Time for the new Agenda (owner, 30 October 2026): every event is set in
 * Washington DC time, and each person also sees it in their own zone. Instants
 * are stored in UTC; a zone only says how to show one. Pure.
 *
 * Daylight saving: a wall time that happens twice (1:30 AM on the US fall-back
 * day) is the first one; a wall time that does not exist (2:30 AM on the
 * spring-forward day) moves forward by the gap, as Google Calendar does.
 */

export const DC = 'America/New_York'

/** Minutes the zone is ahead of UTC at an instant (New York in November: -300). */
export function offsetMin(zone: string, ms: number): number {
  const o: Record<string, number> = {}
  new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(new Date(ms)).forEach(x => { if (x.type !== 'literal') o[x.type] = Number(x.value) })
  return (Date.UTC(o.year, o.month - 1, o.day, o.hour % 24, o.minute) - Math.floor(ms / 60000) * 60000) / 60000
}

/** The instant of a wall time: a day and minutes from midnight in a zone. */
export function instantOf(dateISO: string, minutes: number, zone: string): number {
  const [y, m, d] = dateISO.split('-').map(Number)
  const wall = Date.UTC(y, m - 1, d, 0, minutes)
  // Two guesses settle every zone; the earlier offset wins when a time happens twice.
  const first = wall - offsetMin(zone, wall - 12 * 3600e3) * 60000
  if (Math.round((wallOf(first, zone) - wall) / 60000) === 0) return first
  const second = wall - offsetMin(zone, wall + 12 * 3600e3) * 60000
  if (Math.round((wallOf(second, zone) - wall) / 60000) === 0) return Math.min(first, second)
  // Not a real time (the spring-forward gap): the same distance past the jump.
  return wall - offsetMin(zone, wall - 12 * 3600e3) * 60000
}

/** The wall clock of an instant in a zone, as if it were UTC (for comparing). */
function wallOf(ms: number, zone: string): number {
  return ms + offsetMin(zone, ms) * 60000
}

/** The day and minutes from midnight of an instant in a zone. */
export function localOf(ms: number, zone: string): { date: string; minutes: number } {
  const w = new Date(wallOf(ms, zone))
  return { date: w.toISOString().slice(0, 10), minutes: w.getUTCHours() * 60 + w.getUTCMinutes() }
}

/** "9:00 AM". */
export function clockLabel(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440, h = Math.floor(m / 60), mm = m % 60
  return `${(h + 11) % 12 + 1}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

const NAMES: Record<string, string> = {
  'America/New_York': 'Eastern time (ET)', 'America/Chicago': 'Central time (CT)', 'America/Denver': 'Mountain time (MT)',
  'America/Phoenix': 'Arizona time (MST)', 'America/Los_Angeles': 'Pacific time (PT)',
  'America/Sao_Paulo': 'Brasília time (BRT)', 'America/Fortaleza': 'Brasília time (BRT)', 'America/Recife': 'Brasília time (BRT)',
  'America/Bahia': 'Brasília time (BRT)', 'America/Belem': 'Brasília time (BRT)', 'America/Manaus': 'Amazon time (AMT)',
  'Africa/Nairobi': 'East Africa time (EAT)', 'Africa/Kigali': 'Central Africa time (CAT)', 'Africa/Kampala': 'East Africa time (EAT)',
  'Europe/London': 'UK time', 'Europe/Lisbon': 'Portugal time',
}

/** The city of a zone, "Fortaleza". */
export const cityOf = (zone: string): string => (zone.split('/').pop() ?? zone).replace(/_/g, ' ')

/** "Brasília time (BRT), Fortaleza"; a zone without a known name is its city. */
export function zoneLabel(zone: string): string {
  const name = NAMES[zone]
  return name ? `${name}, ${cityOf(zone)}` : cityOf(zone)
}

/** "1 hour behind you" / "2 hours ahead of you" / "the same time as you": Washington against the person, at an instant. */
export function dcVersus(zone: string, ms: number): string {
  const diff = offsetMin(DC, ms) - offsetMin(zone, ms)
  if (diff === 0) return 'the same time as you'
  const h = Math.abs(diff) / 60, n = Number.isInteger(h) ? String(h) : h.toFixed(1)
  return `${n} hour${h === 1 ? '' : 's'} ${diff < 0 ? 'behind' : 'ahead of'} you`
}
