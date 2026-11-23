/**
 * The handbook's rules for paid time off (Tina, 20 November 2026; owner, 23
 * November 2026), and the balance a person has left.
 *
 *   Vacation     not in the first year of employment. The year counts from
 *                the day they became an employee (people.employee_since),
 *                or from their hire date when that is the same day.
 *   Sick leave   from the 91st day as an employee, counted like Vacation's year. No limit on how much in
 *                a year (Dave, owner, 23 November 2026: what is earned can be
 *                used; a 40-hour cap was here for a few hours and came out).
 *
 * A request that breaks a rule is refused, on the form and on the server.
 *
 * The balance is Rippling's: Finance loads its Time off balances report
 * (rippling-balances.ts), and the portal takes off what Rippling could not
 * know yet: the days after the report's day, and anything approved after it.
 * It adds nothing: what is earned since comes with the next report.
 *
 * Plain rules, tested without a database; the reads are time-off-rules-data.ts.
 */

import { addDays } from './periods'
import { dayLabel } from './format'
import type { OffKind } from './time-off-year'

export type PaidKind = 'vacation' | 'sick'
export const PAID_KINDS: readonly PaidKind[] = ['vacation', 'sick']
export const isPaidKind = (k: OffKind | null | undefined): k is PaidKind => k === 'vacation' || k === 'sick'

/** Sick leave can be used from the 91st day: 90 days after the first. */
export const SICK_WAIT_DAYS = 90

/** The same day a year later (Feb 29 becomes Mar 1). */
export function yearLater(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y + 1, m - 1, d)).toISOString().slice(0, 10)
}

/** The first day Vacation can be used: a year after they became an employee. Null when no date is on record. */
export const vacationOpensOn = (employeeSince: string | null, hireDate: string | null): string | null => {
  const from = employeeSince || hireDate
  return from ? yearLater(from) : null
}
/**
 * The first day sick leave can be used: the 91st day as an employee. Like
 * Vacation, it counts from the day they became an employee: time as a
 * contractor earns no benefits (Tina, owner, 23 November 2026: Rock, a
 * contractor since 2020 and an employee since October 1, 2026). Null when no
 * date is on record.
 */
export const sickOpensOn = (employeeSince: string | null, hireDate: string | null): string | null => {
  const from = employeeSince || hireDate
  return from ? addDays(from, SICK_WAIT_DAYS) : null
}

export interface OffBalance {
  /** What Rippling's report said, in hours. */
  reported: number
  /** The day of the report. */
  asOf: string
  /** Approved time off Rippling did not have yet, in seconds. */
  usedSince: number
  /** Asked and not decided, in seconds: not taken off the balance. */
  waiting: number
  /** What is left, in seconds; below zero when more was approved than there was. */
  left: number
}

export interface OffStanding {
  /** The rules are for US employees; false leaves everything open. */
  employee: boolean
  vacationFrom: string | null
  sickFrom: string | null
  /** Sick leave taken, approved or asked, in seconds, by calendar year ("2026"). */
  sickUsed: Record<string, number>
  balances: Partial<Record<PaidKind, OffBalance>>
}

export const NO_STANDING: OffStanding = { employee: false, vacationFrom: null, sickFrom: null, sickUsed: {}, balances: {} }

/**
 * "12h", "7h 06m", "-4h": hours to the minute, without empty minutes. Its own
 * writer: the portal's duration text rounds to the quarter hour, and a balance
 * of 7.1 hours is 7h 06m.
 */
export function hoursText(seconds: number): string {
  const m = Math.round(Math.abs(seconds) / 60)
  const h = Math.floor(m / 60), rest = m % 60
  return `${seconds < 0 && m > 0 ? '-' : ''}${h}h${rest ? ` ${String(rest).padStart(2, '0')}m` : ''}`
}

/**
 * Why this time off cannot be asked, or null when it can. `days` are the
 * working days asked (weekends and company holidays already left out).
 */
export function offRefusal(kind: OffKind | null, days: readonly string[], s: OffStanding): string | null {
  if (!s.employee || !days.length) return null
  const first = days[0]
  if (kind === 'vacation' && s.vacationFrom && first < s.vacationFrom) {
    return `Vacation can be used after a year of employment: for you, from ${dayLabel(s.vacationFrom)}, ${s.vacationFrom.slice(0, 4)}. Sick leave and Unpaid Time Off can be asked now.`
  }
  if (kind === 'sick' && s.sickFrom && first < s.sickFrom) {
    return `Sick leave can be used from the 91st day of employment: for you, from ${dayLabel(s.sickFrom)}, ${s.sickFrom.slice(0, 4)}. Unpaid Time Off can be asked now.`
  }
  return null
}

export interface BalanceRequest {
  kind: OffKind | null
  state: 'pending' | 'approved'
  /** Its working days. */
  days: readonly string[]
  hoursPerDay: number
  /** The day it was approved, on the company's calendar; null while it waits. */
  decidedOn: string | null
}

/**
 * What is left of a report's balance: less every approved day Rippling could
 * not have had on the report's day (a day after it, or one approved after it,
 * as a sick day asked after the fact is).
 */
export function balanceLeft(kind: PaidKind, reported: number, asOf: string, requests: readonly BalanceRequest[]): OffBalance {
  let usedSince = 0, waiting = 0
  for (const r of requests) {
    if (r.kind !== kind) continue
    const each = r.hoursPerDay * 3600
    if (r.state === 'pending') { waiting += r.days.length * each; continue }
    const all = !!r.decidedOn && r.decidedOn > asOf
    usedSince += (all ? r.days.length : r.days.filter(d => d > asOf).length) * each
  }
  return { reported, asOf, usedSince, waiting, left: Math.round(reported * 3600) - usedSince }
}

/** Under a balance: "Rippling, Nov 20, less 16h approved since". */
export function balanceNote(b: OffBalance): string {
  const day = dayLabel(b.asOf).replace(/^[A-Z][a-z]{2}, /, '')
  return b.usedSince > 0 ? `Rippling on ${day}, less ${hoursText(b.usedSince)} approved since` : `Rippling on ${day}`
}

/** One line for a request: "Vacation: 38h 40m left (Rippling on Nov 20, less 8h approved since)." */
export function balanceLine(label: string, b: OffBalance | undefined, asking = 0): string {
  if (!b) return `${label}: no balance loaded yet. Finance loads it from Rippling.`
  const over = asking > 0 && asking > b.left
  return `${label}: ${hoursText(b.left)} left (${balanceNote(b)}).${over ? ` This asks ${hoursText(asking)}, more than is left.` : ''}`
}
