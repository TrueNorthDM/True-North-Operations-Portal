/**
 * Sample data for the new Agenda on staging (owner, 30 October 2026): the
 * training sessions show Find a time, Send from and booking links before
 * Google is connected, so staging gets accounts, working hours and busy times
 * that look real. Everything here is pure and deterministic: the same person
 * and day always get the same busy times, so running the seed again changes
 * nothing.
 */

import { instantOf } from './time'
import { DEFAULT_HOURS, workingIntervals, type WorkingHours } from './working-hours'

/** A small seeded random number generator (mulberry32 over a string hash). */
export function seeded(key: string): () => number {
  let h = 1779033703 ^ key.length
  for (let i = 0; i < key.length; i++) { h = Math.imul(h ^ key.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19) }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

/** Working hours for a sample person: most work 9 to 6, some split the day, a few start early. */
export function sampleHours(key: string): WorkingHours {
  const r = seeded(`hours:${key}`)()
  if (r < 0.2) return { 1: [[420, 660], [780, 1080]], 2: [[420, 660], [780, 1080]], 3: [[420, 660], [780, 1080]], 4: [[420, 660], [780, 1080]], 5: [[420, 660]] }
  if (r < 0.35) return { 1: [[480, 1020]], 2: [[480, 1020]], 3: [[480, 1020]], 4: [[480, 1020]], 5: [[480, 960]] }
  return DEFAULT_HOURS
}

const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10)

/**
 * Busy blocks for one account, inside its person's working hours, from a day
 * for some days: 1 to 3 a working day, 30, 60 or 90 minutes on the half hour,
 * never overlapping. UTC milliseconds.
 */
export function sampleBusy(key: string, hours: WorkingHours, zone: string, fromDate: string, days: number): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i < days; i++) {
    const day = addDays(fromDate, i)
    const spans = workingIntervals(hours, zone, instantOf(day, 0, zone), instantOf(day, 1440, zone))
    if (!spans.length) continue
    const r = seeded(`${key}:${day}`)
    const n = 1 + Math.floor(r() * 3)
    const taken: [number, number][] = []
    for (let k = 0; k < n * 3 && taken.length < n; k++) {
      const [s, e] = spans[Math.floor(r() * spans.length)]
      const len = [30, 60, 60, 90][Math.floor(r() * 4)] * 60000
      const slots = Math.floor((e - s - len) / 1800000)
      if (slots < 0) continue
      const a = s + Math.floor(r() * (slots + 1)) * 1800000, b = a + len
      if (taken.some(([x, y]) => a < y + 1800000 && b > x - 1800000)) continue
      taken.push([a, b])
    }
    out.push(...taken.sort((x, y) => x[0] - y[0]))
  }
  return out
}

/** A Meet link for a sample account: the shape of Google's, made from a key so it stays the same. */
export function sampleMeetLink(key: string): string {
  const r = seeded(`meet:${key}`), l = (n: number) => Array.from({ length: n }, () => String.fromCharCode(97 + Math.floor(r() * 26))).join('')
  return `https://meet.google.com/${l(3)}-${l(4)}-${l(3)}`
}
