// Shared data + helpers for the Home "celebrations" widgets (work anniversaries
// and birthdays): active people with their primary team, plus the rolling
// last / this / next month window.

import { createClient } from '@/lib/supabase/server'
import { loadBirthDates } from '@/lib/hr/contact'
import { primaryTeamByPerson } from '@/lib/directory/primary-team'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadCelebrationOptOuts } from '@/lib/settings/person'
import { teamKeyFromName, type TeamKey } from '@/lib/directory/people-types'
import { colourOf, teamColoursFrom } from '@/lib/directory/team-colour'

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MON_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export interface CelebrationPerson {
  id: string
  name: string
  avatarUrl: string | null
  hireDate: string | null
  dob: string | null
  teamName: string | null
  teamKey: TeamKey
  /** Resolved from teams.color, the same palette every other screen uses. */
  color: string
}

export function parseYMD(iso: string | null | undefined): { y: number; m: number; d: number } | null {
  if (!iso) return null
  const x = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return x ? { y: +x[1], m: +x[2] - 1, d: +x[3] } : null
}

/** "Apr 7", month + day, no year (for birthdays). */
export function formatMonthDay(iso: string | null | undefined): string {
  const p = parseYMD(iso)
  return p ? `${MON_SHORT[p.m]} ${p.d}` : '-'
}

export interface MonthTarget { year: number; month: number; label: string; current: boolean }

/** Last, this and next calendar month, relative to `now`. */
export function monthWindow(now: Date): MonthTarget[] {
  return [-1, 0, 1].map(off => {
    const d = new Date(now.getFullYear(), now.getMonth() + off, 1)
    return { year: d.getFullYear(), month: d.getMonth(), label: MONTHS[d.getMonth()], current: off === 0 }
  })
}

export async function loadCelebrationPeople(): Promise<CelebrationPerson[]> {
  const supabase = await createClient()
  // date_of_birth is no longer readable by the signed-in role (migration 056),
  // so it comes from the privileged reader and is merged in below. Everything
  // else here is public-by-design directory material.
  let pRes = await supabase.from('people').select('id, full_name, status, hire_date, avatar_url')
  if (pRes.error) pRes = (await supabase.from('people').select('id, full_name, status, hire_date')) as typeof pRes
  // Each person may keep their birthday or anniversary off Home (Settings,
  // Privacy, 7 October 2026): the date is left out, so the card skips them.
  const [{ data: tData }, { data: mData }, birthdays, optOut] = await Promise.all([
    supabase.from('teams').select('id, name, color'),
    supabase.from('team_members').select('team_id, person_id, is_primary'),
    loadBirthDates(),
    loadCelebrationOptOuts(createAdminClient()),
  ])

  const teamById = new Map((tData ?? []).map(t => [t.id, t.name]))
  // The same palette the directory and My Team use, so a face on the home
  // page is the colour that person is everywhere else.
  const colours = teamColoursFrom((tData ?? []) as { name: string; color: string | null }[])

  // The portal's one rule for a main team (lib/directory/primary-team).
  const primary = primaryTeamByPerson((mData ?? []).flatMap(m => {
    const name = teamById.get(m.team_id)
    return name ? [{ personId: m.person_id, team: { name }, isPrimary: m.is_primary === true }] : []
  }))
  const primaryTeam = (pid: string): string | null => primary.get(pid)?.name ?? null

  return (pRes.data ?? [])
    .filter(p => p.status === 'active')
    .map(p => {
      const tn = primaryTeam(p.id)
      return {
        id: p.id,
        name: p.full_name,
        avatarUrl: p.avatar_url ?? null,
        hireDate: optOut.anniversary.has(p.id) ? null : p.hire_date,
        dob: optOut.birthday.has(p.id) ? null : birthdays.get(p.id) ?? null,
        teamName: tn,
        teamKey: teamKeyFromName(tn),
        color: colourOf(colours, tn),
      }
    })
}
