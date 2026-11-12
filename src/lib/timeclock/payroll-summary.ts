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
 * (owner, 12 November 2026): a salaried person short of 80 is flagged for Tina
 * to decide, and one over 80 shows the real hours.
 *
 * Plain data only: who is in it and the rows come from payroll-summary-data.ts.
 */

/** The hours a salaried US employee is paid for in a two-week pay period. */
export const PAY_PERIOD_HOURS = 80

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
  /** Short of or over PAY_PERIOD_HOURS, REG and PTO together; 0 when exact. */
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
export function buildPayroll(people: readonly PayrollPerson[], entries: readonly PayrollEntry[]): PayrollLine[] {
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
    return { personId: p.id, ...splitName(p.fullName, p.lastName), reg, pto, pending: hoursOf(s.pending), gap: Math.round((reg + pto - PAY_PERIOD_HOURS) * 100) / 100 }
  }).sort((a, b) => a.fname.localeCompare(b.fname) || a.lname.localeCompare(b.lname))
}

/** What the check column says: "8 h short of 80", "0.75 h over 80", or nothing. */
export function gapText(gap: number): string | null {
  if (gap === 0) return null
  return gap < 0 ? `${-gap} h short of ${PAY_PERIOD_HOURS}` : `${gap} h over ${PAY_PERIOD_HOURS}`
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
