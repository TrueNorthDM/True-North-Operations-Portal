// Shared data + helpers for the Home "celebrations" widgets (work anniversaries
// and birthdays): active people with their primary team, plus the rolling
// last / this / next month window.

import { createClient } from '@/lib/supabase/server'
import { loadContactByPerson } from '@/lib/hr/contact'
import { teamKeyFromName, type TeamKey } from '@/lib/directory/people-types'

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
  const [{ data: tData }, { data: mData }, birthdays] = await Promise.all([
    supabase.from('teams').select('id, name'),
    supabase.from('team_members').select('team_id, person_id'),
    loadContactByPerson(),
  ])

  const teamById = new Map((tData ?? []).map(t => [t.id, t.name]))
  const teamsByPerson = new Map<string, string[]>()
  for (const m of mData ?? []) {
    const arr = teamsByPerson.get(m.person_id) ?? []
    arr.push(m.team_id)
    teamsByPerson.set(m.person_id, arr)
  }
  // Primary team = first membership, name-sorted for determinism.
  const primaryTeam = (pid: string): string | null => {
    const names = (teamsByPerson.get(pid) ?? []).map(id => teamById.get(id)).filter((n): n is string => !!n).sort()
    return names[0] ?? null
  }

  return (pRes.data ?? [])
    .filter(p => p.status === 'active')
    .map(p => {
      const tn = primaryTeam(p.id)
      return {
        id: p.id,
        name: p.full_name,
        avatarUrl: p.avatar_url ?? null,
        hireDate: p.hire_date,
        dob: birthdays.get(p.id)?.dateOfBirth ?? null,
        teamName: tn,
        teamKey: teamKeyFromName(tn),
      }
    })
}
