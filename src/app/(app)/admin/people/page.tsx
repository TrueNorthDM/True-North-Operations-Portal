// Admin → People — manage the company directory (admin-only). Edits here drive
// the home org chart (same data). Server-guarded.

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isCurrentUserAdmin } from '@/lib/auth/role'
import { PeopleManager, type PersonView } from '@/components/admin/PeopleManager'

interface PersonRow {
  id: string
  full_name: string
  title: string | null
  manager_id: string | null
  status: string
  profile_id: string | null
}

export default async function PeoplePage() {
  if (!(await isCurrentUserAdmin())) redirect('/')
  const supabase = await createClient()

  const [{ data: pData }, { data: tData }, { data: mData }, { data: prData }] = await Promise.all([
    supabase.from('people').select('id, full_name, title, manager_id, status, profile_id'),
    supabase.from('teams').select('id, name'),
    supabase.from('team_members').select('team_id, person_id'),
    supabase.from('profiles').select('id, email'),
  ])

  const people = (pData ?? []) as unknown as PersonRow[]
  const teams = (tData ?? []) as unknown as { id: string; name: string }[]
  const members = (mData ?? []) as unknown as { team_id: string; person_id: string }[]
  const profiles = (prData ?? []) as unknown as { id: string; email: string | null }[]

  // Accounts: which profile each person is linked to, and which are still free.
  const emailByProfile = new Map(profiles.map(pr => [pr.id, pr.email ?? '(no email)']))
  const linkedProfileIds = new Set(people.map(p => p.profile_id).filter((x): x is string => !!x))
  const availableAccounts = profiles
    .filter(pr => !linkedProfileIds.has(pr.id))
    .map(pr => ({ id: pr.id, email: pr.email ?? '(no email)' }))
    .sort((a, b) => a.email.localeCompare(b.email))

  const nameById = new Map(people.map(p => [p.id, p.full_name]))
  const teamNameById = new Map(teams.map(t => [t.id, t.name]))
  const teamsByPerson = new Map<string, string[]>()
  for (const m of members) {
    const tn = teamNameById.get(m.team_id)
    if (!tn) continue
    const arr = teamsByPerson.get(m.person_id) ?? []
    arr.push(tn)
    teamsByPerson.set(m.person_id, arr)
  }

  const rows: PersonView[] = people
    .map(p => ({
      id: p.id,
      full_name: p.full_name,
      title: p.title,
      manager_id: p.manager_id,
      managerName: p.manager_id ? nameById.get(p.manager_id) ?? null : null,
      status: (p.status === 'inactive' ? 'inactive' : 'active') as 'active' | 'inactive',
      teams: teamsByPerson.get(p.id) ?? [],
      accountId: p.profile_id,
      accountEmail: p.profile_id ? emailByProfile.get(p.profile_id) ?? null : null,
    }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name))

  return <PeopleManager people={rows} availableAccounts={availableAccounts} />
}
