/**
 * The Work fields of a person, checked once for every place that writes them:
 * Add person (admin/people/actions.ts createPerson) and the Work tab of a
 * person's page (directory/[id]/actions.ts saveWork). Before the audit of
 * 8 October 2026 Add person checked almost nothing while the page checked
 * everything, so the same field could be saved in two shapes.
 *
 * Pure: no database. What needs one (the manager loop, a mailbox already
 * taken, teams that exist) is checked by the caller with these answers.
 */

import { normalizeMilestones, type MilestoneForm } from '@/lib/milestones'

export interface WorkInput {
  fullName: string
  title: string
  employmentType: string
  schedule: string
  weeklyHours: string
  status: 'active' | 'inactive'
  emails: { trueNorth: string; goodnews: string; coe: string }
  teams: { teamId: string; position: string; primary: boolean }[]
  managerId: string
  alsoReportsToId: string
  hireDate: string
  leftOn: string
  milestones: MilestoneForm[]
  history: string
}

/** The people columns a Work save writes. */
export interface WorkColumns {
  full_name: string
  title: string | null
  employment_type: string | null
  schedule: string | null
  weekly_hours: number | null
  status: 'active' | 'inactive'
  email_true_north: string | null
  email_goodnews: string | null
  email_coe: string | null
  manager_id: string | null
  also_reports_to_id: string | null
  hire_date: string | null
  left_on: string | null
  milestones: ReturnType<typeof normalizeMilestones>
  employment_history: string | null
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE = /^\d{4}-\d{2}-\d{2}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)
const date = (v: unknown): string | null | false => { const t = text(v); return t == null ? null : DATE.test(t) ? t : false }
const email = (v: unknown): string | null | false => { const t = text(v); return t == null ? null : EMAIL.test(t) ? t.toLowerCase() : false }

export type CleanWork =
  | { ok: true; cols: WorkColumns; teams: WorkInput['teams'] }
  | { ok: false; error: string }

/**
 * The Work input as columns, or the first thing wrong with it in words a
 * person can act on. `personId` is the person being saved (null when adding
 * one), so nobody is made to report to themselves.
 */
export function cleanWork(input: WorkInput, personId: string | null): CleanWork {
  const fail = (error: string): CleanWork => ({ ok: false, error })
  const fullName = text(input?.fullName)
  if (!fullName) return fail('The name is required.')
  const employmentType = text(input.employmentType)
  if (employmentType && employmentType !== 'us' && employmentType !== 'contractor') return fail('Choose US Employee or Contractor.')
  const schedule = text(input.schedule)
  if (schedule && schedule !== 'full' && schedule !== 'part') return fail('Choose Full-Time or Part-Time.')
  const hoursText = text(input.weeklyHours)
  const weeklyHours = hoursText == null ? null : Number(hoursText)
  if (weeklyHours != null && (!Number.isFinite(weeklyHours) || weeklyHours < 0 || weeklyHours > 168)) return fail('Weekly hours must be between 0 and 168.')
  if (input.status !== 'active' && input.status !== 'inactive') return fail('Choose Active or Inactive.')
  const emails = { trueNorth: email(input.emails?.trueNorth), goodnews: email(input.emails?.goodnews), coe: email(input.emails?.coe) }
  if (emails.trueNorth === false || emails.goodnews === false || emails.coe === false) return fail('One of the company emails does not look right.')
  const mailboxes = [emails.trueNorth, emails.goodnews, emails.coe].filter((e): e is string => !!e)
  if (new Set(mailboxes).size !== mailboxes.length) return fail('The same address is written twice. Each company email belongs in one field.')
  const hireDate = date(input.hireDate)
  const leftOn = date(input.leftOn)
  if (hireDate === false || leftOn === false) return fail('A date could not be read.')
  const managerId = text(input.managerId)
  const alsoId = text(input.alsoReportsToId)
  for (const id of [managerId, alsoId]) if (id && !UUID.test(id)) return fail('That manager does not exist.')
  if (personId && (managerId === personId || alsoId === personId)) return fail('A person cannot report to themselves.')
  const teams = Array.isArray(input.teams) ? input.teams.filter(t => t && typeof t.teamId === 'string' && UUID.test(t.teamId)) : []
  return {
    ok: true,
    teams,
    cols: {
      full_name: fullName,
      title: text(input.title),
      employment_type: employmentType,
      schedule,
      weekly_hours: weeklyHours,
      status: input.status,
      email_true_north: emails.trueNorth,
      email_goodnews: emails.goodnews,
      email_coe: emails.coe,
      manager_id: managerId,
      also_reports_to_id: alsoId,
      hire_date: hireDate,
      left_on: leftOn,
      milestones: normalizeMilestones(Array.isArray(input.milestones) ? input.milestones : []),
      employment_history: text(input.history),
    },
  }
}
