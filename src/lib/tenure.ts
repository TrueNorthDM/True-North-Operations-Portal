// Tenure (time of service), the maths behind the anniversary badges. Pure
// functions: an ISO hire date + an "as of" date in, a calendar breakdown +
// milestone out. No React, no Date.now() inside (the caller passes `now`).

import { COLOR_PALETTE } from '@/lib/constants/color-palette'

export interface Tenure { years: number; months: number; days: number; totalDays: number }

const parseISO = (iso: string): { y: number; m: number; d: number } | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] } : null
}

// Calendar diff (years / months / days) from a hire date to `end`, borrowing
// days from the previous month when the day component goes negative.
export function tenureSince(iso: string | null | undefined, end: Date): Tenure | null {
  if (!iso) return null
  const h = parseISO(iso)
  if (!h) return null
  const hire = Date.UTC(h.y, h.m, h.d)
  const cur = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate())
  if (cur < hire) return { years: 0, months: 0, days: 0, totalDays: 0 }

  let years = end.getFullYear() - h.y
  let months = end.getMonth() - h.m
  let days = end.getDate() - h.d
  if (days < 0) {
    months -= 1
    days += new Date(Date.UTC(end.getFullYear(), end.getMonth(), 0)).getUTCDate() // days in prev month
  }
  if (months < 0) { years -= 1; months += 12 }
  const totalDays = Math.floor((cur - hire) / 86_400_000)
  return { years, months, days, totalDays }
}

export type Milestone =
  | { kind: 'year'; value: number; color: string }
  | { kind: 'quarter'; value: number } // 1, 2, 3 (= 3, 6, 9 months)
  | { kind: 'none' }

// The badge a tenure earns: quarters in the first year (from 3 months), then a
// coloured year badge (1–20, colour reused for 20+).
export function milestoneOf(t: Tenure | null): Milestone {
  if (!t) return { kind: 'none' }
  if (t.years >= 1) {
    const capped = Math.min(t.years, 20)
    return { kind: 'year', value: t.years, color: COLOR_PALETTE[(capped - 1) % COLOR_PALETTE.length] }
  }
  const q = Math.floor((t.years * 12 + t.months) / 3) // 0..3
  return q >= 1 ? { kind: 'quarter', value: q } : { kind: 'none' }
}

// The colour a given whole-year anniversary uses (for the Home widget).
export const yearColor = (years: number): string =>
  COLOR_PALETTE[(Math.min(Math.max(years, 1), 20) - 1) % COLOR_PALETTE.length]

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

// "1 year, 3 months and 3 days", omits zero components (but always shows at
// least days, so a brand-new hire still reads "5 days").
export function formatTenure(t: Tenure | null): string {
  if (!t) return '-'
  const parts: string[] = []
  if (t.years) parts.push(plural(t.years, 'year'))
  if (t.months) parts.push(plural(t.months, 'month'))
  if (t.days || parts.length === 0) parts.push(plural(t.days, 'day'))
  if (parts.length === 1) return parts[0]
  return parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1]
}

// Compact one-line form: "1y 2mo 4d" (zero components dropped, days always kept).
export function formatTenureShort(t: Tenure | null): string {
  if (!t) return '-'
  const parts: string[] = []
  if (t.years) parts.push(`${t.years}y`)
  if (t.months) parts.push(`${t.months}mo`)
  if (t.days || parts.length === 0) parts.push(`${t.days}d`)
  return parts.join(' ')
}
