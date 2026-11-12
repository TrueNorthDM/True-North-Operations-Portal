/**
 * The payroll summary (owner and Tina, 12 November 2026): the file Tina sends
 * to Rippling each pay period, in the shape she exported from TSheets.
 *
 *   type,hours,fname,lname
 *   REG,72,Tina,Gennette
 *   PTO,8,,
 *
 * One REG row per US employee, and a PTO row right under it when they had
 * paid time off. The hours are what was recorded, never topped up or capped
 * (owner, 12 November 2026): a person short of the expected hours (80 in a pay
 * period) is flagged for Tina to decide, and one over shows the real hours.
 *
 * Plain data only: who is in it and the rows come from payroll-summary-data.ts.
 */

import type { PeriodKind } from './reports'

/** The same periods as Reports (Month, Pay period, Quarter, Custom); a pay period unless chosen. */
export interface PayrollQuery { kind: PeriodKind; from?: string; to?: string }

const ISO = /^\d{4}-\d{2}-\d{2}$/

export function parsePayrollQuery(sp: Record<string, string | undefined>): PayrollQuery {
  const kind = (['month', 'pp', 'quarter', 'custom'] as const).find(k => k === sp.period) ?? 'pp'
  return { kind, from: sp.from && ISO.test(sp.from) ? sp.from : undefined, to: sp.to && ISO.test(sp.to) ? sp.to : undefined }
}

/** The address of a period: always says which kind, since the default here is not Reports' default. */
export function payrollSearch(q: PayrollQuery): string {
  const p = new URLSearchParams({ period: q.kind })
  if (q.kind === 'custom' && q.from) p.set('from', q.from)
  if (q.kind === 'custom' && q.to) p.set('to', q.to)
  return p.toString()
}

/** The hours a salaried US employee is paid for each weekday. */
export const DAY_HOURS = 8

/**
 * The hours expected in a range: 8 for every weekday in it, so 80 for a
 * two-week pay period, and the right figure for a month, a quarter or any days.
 */
export function expectedHours(from: string, to: string): number {
  let n = 0
  for (let t = Date.parse(`${from}T00:00:00Z`), end = Date.parse(`${to}T00:00:00Z`); t <= end; t += 86_400_000) {
    const d = new Date(t).getUTCDay()
    if (d !== 0 && d !== 6) n++
  }
  return n * DAY_HOURS
}

export interface PayrollPerson { id: string; fullName: string; lastName: string | null }

export interface PayrollEntry {
  personId: string
  date: string
  seconds: number
  /** 'pto' for paid time off (Vacation, Sick, Holiday), 'unpaid', or 'work'. */
  sort: 'work' | 'pto' | 'unpaid'
  approved: boolean
}

export interface PayrollLine {
  personId: string
  fname: string
  lname: string
  reg: number
  pto: number
  /** Recorded but not approved yet, in hours (work and time off together). */
  pending: number
  /** Short of or over the expected hours, REG and PTO together; 0 when exact. */
  gap: number
}

/** Hours to two decimals, the way TSheets writes them (67.5, 80.75, 11.25). */
export const hoursOf = (seconds: number): number => Math.round((seconds / 3600) * 100) / 100

/**
 * First and last name from the Directory: the last name as kept, and the first
 * name as what comes before it. "Joy Deche" with last name "Deche" is Joy, Deche.
 */
export function splitName(fullName: string, lastName: string | null): { fname: string; lname: string } {
  const full = fullName.replace(/\s+/g, ' ').trim()
  const last = (lastName ?? '').trim()
  if (last && full.toLowerCase().endsWith(` ${last.toLowerCase()}`)) {
    return { fname: full.slice(0, full.length - last.length).trim(), lname: last }
  }
  const cut = full.lastIndexOf(' ')
  return cut < 0 ? { fname: full, lname: last } : { fname: full.slice(0, cut), lname: last || full.slice(cut + 1) }
}

/** One line per person, by first name then last name, everyone shown even with no hours. */
export function buildPayroll(people: readonly PayrollPerson[], entries: readonly PayrollEntry[], expected: number): PayrollLine[] {
  const sums = new Map<string, { reg: number; pto: number; pending: number }>()
  for (const e of entries) {
    if (e.sort === 'unpaid') continue
    const s = sums.get(e.personId) ?? { reg: 0, pto: 0, pending: 0 }
    if (e.sort === 'pto') s.pto += e.seconds
    else s.reg += e.seconds
    if (!e.approved) s.pending += e.seconds
    sums.set(e.personId, s)
  }
  return people.map(p => {
    const s = sums.get(p.id) ?? { reg: 0, pto: 0, pending: 0 }
    const reg = hoursOf(s.reg), pto = hoursOf(s.pto)
    return { personId: p.id, ...splitName(p.fullName, p.lastName), reg, pto, pending: hoursOf(s.pending), gap: Math.round((reg + pto - expected) * 100) / 100 }
  }).sort((a, b) => a.fname.localeCompare(b.fname) || a.lname.localeCompare(b.lname))
}

/** What the check column says: "8 h short of 80", "0.75 h over 80", or nothing. */
export function gapText(gap: number, expected: number): string | null {
  if (gap === 0) return null
  return gap < 0 ? `${-gap} h short of ${expected}` : `${gap} h over ${expected}`
}

/** A CSV cell: quoted only when it has to be. */
const cell = (v: string | number): string => {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Tina's file: type, hours, fname, lname; the PTO row under its person, with no name. */
export function payrollCsv(lines: readonly PayrollLine[]): string {
  const out = ['type,hours,fname,lname']
  for (const l of lines) {
    out.push(['REG', l.reg, l.fname, l.lname].map(cell).join(','))
    if (l.pto > 0) out.push(['PTO', l.pto, '', ''].map(cell).join(','))
  }
  return out.join('\n') + '\n'
}
