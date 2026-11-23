/**
 * Rippling's "Time off balances" report (Tina, 20 November 2026), as Finance
 * loads it into the portal (owner, 23 November 2026):
 *
 *   # | Employee          | Type       | Current Balance
 *   2 | Amy Prindle       | All        | 53.77
 *     | Amy Prindle       | Sick Leave | 7.1
 *     | Amy Prindle       | Vacation   | 46.67
 *
 * The "All" rows are the two added up and are left out. Each name is found in
 * the Directory by its full name, else by its first name when only one US
 * employee has it (Rippling keeps some last names the portal does not), and a
 * name that is not found is shown to Finance, never guessed.
 *
 * Plain data only: the file is read in the browser (lib/xlsx-rows.ts) and
 * saved by reports/balances/actions.ts.
 */

import type { PaidKind } from './time-off-rules'

export interface ReportRow { name: string; kind: PaidKind; hours: number }

const kindOf = (type: string): PaidKind | null => {
  const t = type.trim().toLowerCase()
  return t.startsWith('sick') ? 'sick' : t.startsWith('vacation') || t === 'pto' ? 'vacation' : null
}

/** The report's balances, from its rows; an error when the columns are not the report's. */
export function readReport(rows: readonly (readonly string[])[]): { rows: ReportRow[]; error: string | null } {
  const head = rows.findIndex(r => r.some(c => /^employee/i.test(c.trim())) && r.some(c => /balance/i.test(c)))
  if (head < 0) return { rows: [], error: 'This does not look like Rippling\'s Time off balances report: it needs the columns Employee, Type and Current Balance.' }
  const cols = rows[head].map(c => c.trim().toLowerCase())
  const iName = cols.findIndex(c => c.startsWith('employee')), iType = cols.findIndex(c => c.startsWith('type') || c.includes('policy')), iHours = cols.findIndex(c => c.includes('balance'))
  if (iType < 0) return { rows: [], error: 'The report has no Type column, so Vacation cannot be told from Sick Leave.' }
  const out = new Map<string, ReportRow>()
  for (const r of rows.slice(head + 1)) {
    const name = (r[iName] ?? '').replace(/\s+/g, ' ').trim()
    const kind = kindOf(r[iType] ?? '')
    const hours = Number(String(r[iHours] ?? '').replace(/,/g, '').trim())
    if (!name || !kind || !Number.isFinite(hours) || String(r[iHours] ?? '').trim() === '') continue
    out.set(`${name.toLowerCase()}|${kind}`, { name, kind, hours: Math.round(hours * 100) / 100 })
  }
  return out.size ? { rows: [...out.values()], error: null } : { rows: [], error: 'The report has no Vacation or Sick Leave balance in it.' }
}

export interface ReportPerson { id: string; fullName: string }
export interface MatchedBalance {
  personId: string
  /** The person's name in the Directory. */
  name: string
  /** The name in the report, when it is not the same. */
  reportName: string | null
  vacation: number | null
  sick: number | null
}

const norm = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()
const firstName = (s: string) => norm(s).split(' ')[0] ?? ''

/** Each report name with its person, and the names nobody in the list answers to. */
export function matchReport(rows: readonly ReportRow[], people: readonly ReportPerson[]): { matched: MatchedBalance[]; unmatched: string[] } {
  const byName = new Map(people.map(p => [norm(p.fullName), p]))
  const names = [...new Set(rows.map(r => r.name))]
  const matched = new Map<string, MatchedBalance>()
  const unmatched: string[] = []
  for (const name of names) {
    let person = byName.get(norm(name))
    if (!person) {
      // By first name, only when one person has it here and one name has it in the report.
      const same = people.filter(p => firstName(p.fullName) === firstName(name))
      if (same.length === 1 && names.filter(n => firstName(n) === firstName(name)).length === 1 && !names.some(n => norm(n) === norm(same[0].fullName))) person = same[0]
    }
    if (!person || matched.has(person.id)) { unmatched.push(name); continue }
    const of = (kind: PaidKind) => rows.find(r => r.name === name && r.kind === kind)?.hours ?? null
    matched.set(person.id, { personId: person.id, name: person.fullName, reportName: norm(name) === norm(person.fullName) ? null : name, vacation: of('vacation'), sick: of('sick') })
  }
  return { matched: [...matched.values()].sort((a, b) => a.name.localeCompare(b.name)), unmatched }
}

/** The report's day from its file name: "Time_off_balances_report-11-20-26.xlsx" is 2026-11-20. Null when it has none. */
export function reportDay(fileName: string): string | null {
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(fileName)
  const us = /(\d{1,2})-(\d{1,2})-(\d{2}|\d{4})(?!\d)/.exec(fileName)
  const made = iso ? [Number(iso[1]), Number(iso[2]), Number(iso[3])] : us ? [Number(us[3]) < 100 ? 2000 + Number(us[3]) : Number(us[3]), Number(us[1]), Number(us[2])] : null
  if (!made) return null
  const [y, m, d] = made
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date.toISOString().slice(0, 10) : null
}
