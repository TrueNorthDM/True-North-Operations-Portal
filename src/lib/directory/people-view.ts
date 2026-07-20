// Loads the PersonView models + team options + free accounts, the exact inputs
// the PersonModal needs, so surfaces other than the Directory (e.g. Human
// Resources) can open a person's card in place. Kept in sync with the identical
// construction in app/(app)/directory/page.tsx (the Directory owns the canonical
// version; this is a self-contained copy so it never risks that critical page).

import { createClient } from '@/lib/supabase/server'
import type { PersonAddress } from '@/lib/address'
import type { PersonMilestone } from '@/lib/milestones'
import {
  teamKeyFromName,
  teamPositionRank,
  TEAM_COLOR,
  type PersonView,
  type PersonAttachment,
  type PersonTeam,
  type Account,
  type TeamKey,
} from '@/components/admin/people-types'
import type { TeamOption } from '@/components/admin/DirectoryTabs'

const PEOPLE_FULL =
  'id, full_name, last_name, title, manager_id, status, profile_id, tsheets_user_id, ' +
  'employment_type, schedule, weekly_hours, internal_rate, reports_to_manager, also_reports_to_id, manager_name_text, ' +
  'email_true_north, email_goodnews, email_coe, email_personal, phone, location, whatsapp_same_number, ' +
  'date_of_birth, hire_date, left_on, employment_history'
const PEOPLE_BASE = 'id, full_name, title, manager_id, status, profile_id, tsheets_user_id'

type PRow = Record<string, unknown> & { id: string; full_name: string }

export async function loadDirectoryPeopleView(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ people: PersonView[]; teamOptions: TeamOption[]; availableAccounts: Account[] }> {
  let pRes = await supabase.from('people').select(PEOPLE_FULL)
  if (pRes.error) pRes = await supabase.from('people').select(PEOPLE_BASE)

  const [{ data: tData }, { data: prData }, aRes, dRes, addrRes, lcRes, msRes] = await Promise.all([
    supabase.from('teams').select('id, name, color'),
    supabase.from('profiles').select('id, email'),
    supabase.from('person_attachments').select('id, person_id, file_name, storage_path, mime, size_bytes, uploaded_at'),
    supabase.from('people').select('id, monday_docs, role_type, avatar_url'),
    // Isolated select: `address` (042) may not exist yet, so a failure here must
    // NOT drop the other columns. Left empty until the migration runs.
    supabase.from('people').select('id, address'),
    // Isolated select: onboarding/offboarding status (043), same graceful pattern.
    supabase.from('people').select('id, onboarding_status, offboarding_status'),
    // Isolated select: milestones (044), same graceful pattern.
    supabase.from('people').select('id, milestones'),
  ])

  const people = (pRes.data ?? []) as unknown as PRow[]
  const teams = tData ?? []
  const profiles = prData ?? []

  let tmRes = await supabase.from('team_members').select('team_id, person_id, position')
  if (tmRes.error) tmRes = (await supabase.from('team_members').select('team_id, person_id')) as typeof tmRes
  const members = (tmRes.data ?? []).map((m: { team_id: string; person_id: string; position?: string }) => ({
    team_id: m.team_id,
    person_id: m.person_id,
    position: m.position === 'founder' ? 'founder' : m.position === 'manager' ? 'manager' : m.position === 'team_leader' ? 'team_leader' : 'collaborator',
  }))

  const attachmentsByPerson = new Map<string, PersonAttachment[]>()
  for (const a of aRes.data ?? []) {
    const arr = attachmentsByPerson.get(a.person_id) ?? []
    arr.push({ id: a.id, fileName: a.file_name, storagePath: a.storage_path, mime: a.mime, sizeBytes: a.size_bytes, uploadedAt: a.uploaded_at })
    attachmentsByPerson.set(a.person_id, arr)
  }

  const mondayDocsById = new Map<string, string>()
  const roleTypeById = new Map<string, string>()
  const avatarById = new Map<string, string>()
  for (const d of dRes.data ?? []) {
    if (d.monday_docs) mondayDocsById.set(d.id, d.monday_docs)
    if (d.role_type) roleTypeById.set(d.id, d.role_type)
    if (d.avatar_url) avatarById.set(d.id, d.avatar_url)
  }
  const addressById = new Map<string, PersonAddress>()
  if (!addrRes.error) for (const r of (addrRes.data ?? []) as { id: string; address: PersonAddress | null }[]) if (r.address) addressById.set(r.id, r.address)
  const onboardingById = new Map<string, string>()
  const offboardingById = new Map<string, string>()
  if (!lcRes.error) for (const r of (lcRes.data ?? []) as { id: string; onboarding_status: string | null; offboarding_status: string | null }[]) {
    if (r.onboarding_status) onboardingById.set(r.id, r.onboarding_status)
    if (r.offboarding_status) offboardingById.set(r.id, r.offboarding_status)
  }
  const milestonesById = new Map<string, PersonMilestone[]>()
  if (!msRes.error) for (const r of (msRes.data ?? []) as { id: string; milestones: PersonMilestone[] | null }[]) if (Array.isArray(r.milestones)) milestonesById.set(r.id, r.milestones)

  const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)
  const num = (v: unknown): number | null => (v == null || v === '' ? null : Number(v))

  const teamById = new Map(teams.map(t => [t.id, t]))
  const teamIdsByPerson = new Map<string, string[]>()
  for (const m of members) {
    const arr = teamIdsByPerson.get(m.person_id) ?? []
    arr.push(m.team_id)
    teamIdsByPerson.set(m.person_id, arr)
  }
  const primaryTeam = (pid: string): { id: string; name: string } | null => {
    const named = (teamIdsByPerson.get(pid) ?? []).map(id => teamById.get(id)).filter((t): t is NonNullable<typeof t> => !!t)
    named.sort((a, b) => a.name.localeCompare(b.name))
    return named[0] ? { id: named[0].id, name: named[0].name } : null
  }
  const teamKeyByPerson = new Map<string, TeamKey>()
  for (const p of people) teamKeyByPerson.set(p.id, teamKeyFromName(primaryTeam(p.id)?.name))

  const teamsByPerson = new Map<string, PersonTeam[]>()
  for (const m of members) {
    const t = teamById.get(m.team_id)
    if (!t) continue
    const arr = teamsByPerson.get(m.person_id) ?? []
    arr.push({ teamId: t.id, teamName: t.name, teamKey: teamKeyFromName(t.name), position: m.position })
    teamsByPerson.set(m.person_id, arr)
  }
  for (const arr of teamsByPerson.values()) {
    arr.sort((a, b) => teamPositionRank(a.position) - teamPositionRank(b.position) || (a.teamName ?? '').localeCompare(b.teamName ?? ''))
  }

  const emailByProfile = new Map(profiles.map(pr => [pr.id, pr.email ?? '(no email)']))
  const linkedProfileIds = new Set(people.map(p => (typeof p.profile_id === 'string' ? p.profile_id : null)).filter(Boolean) as string[])
  const availableAccounts = profiles
    .filter(pr => !linkedProfileIds.has(pr.id))
    .map(pr => ({ id: pr.id, email: pr.email ?? '(no email)' }))
    .sort((a, b) => a.email.localeCompare(b.email))

  const nameById = new Map(people.map(p => [p.id, p.full_name]))

  const peopleView: PersonView[] = people
    .map((p): PersonView => {
      const pt = primaryTeam(p.id)
      const mgrId = str(p.manager_id)
      const alsoId = str(p.also_reports_to_id)
      return {
        id: p.id,
        full_name: p.full_name,
        lastName: str(p.last_name),
        avatarUrl: avatarById.get(p.id) ?? null,
        title: str(p.title),
        teamId: pt?.id ?? null,
        teamName: pt?.name ?? null,
        teamKey: teamKeyFromName(pt?.name),
        teams: teamsByPerson.get(p.id) ?? [],
        manager_id: mgrId,
        managerName: mgrId ? nameById.get(mgrId) ?? null : null,
        managerTeamKey: mgrId ? teamKeyByPerson.get(mgrId) ?? 'other' : null,
        alsoReportsToId: alsoId,
        alsoReportsToName: alsoId ? nameById.get(alsoId) ?? null : null,
        alsoReportsToTeamKey: alsoId ? teamKeyByPerson.get(alsoId) ?? 'other' : null,
        reportsToManager: str(p.reports_to_manager),
        managerNameText: str(p.manager_name_text),
        employmentType: str(p.employment_type),
        schedule: str(p.schedule),
        weeklyHours: num(p.weekly_hours),
        internalRate: num(p.internal_rate),
        roleType: roleTypeById.get(p.id) ?? 'user',
        status: (p.status === 'inactive' ? 'inactive' : 'active') as 'active' | 'inactive',
        phone: str(p.phone),
        location: str(p.location),
        address: addressById.get(p.id) ?? null,
        whatsappSameNumber: str(p.whatsapp_same_number),
        onboardingStatus: onboardingById.get(p.id) ?? null,
        offboardingStatus: offboardingById.get(p.id) ?? null,
        dateOfBirth: str(p.date_of_birth),
        hireDate: str(p.hire_date),
        leftOn: str(p.left_on),
        emails: {
          trueNorth: str(p.email_true_north),
          goodnews: str(p.email_goodnews),
          coe: str(p.email_coe),
          personal: str(p.email_personal),
        },
        accountId: str(p.profile_id),
        accountEmail: str(p.profile_id) ? emailByProfile.get(p.profile_id as string) ?? null : null,
        hasTsheets: p.tsheets_user_id != null,
        lastAccessAt: null,
        lastAccessAgent: null,
        history: str(p.employment_history),
        milestones: milestonesById.get(p.id) ?? [],
        mondayDocs: mondayDocsById.get(p.id) ?? null,
        attachments: attachmentsByPerson.get(p.id) ?? [],
      }
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name))

  const teamOptions: TeamOption[] = teams
    .map(t => ({ id: t.id, name: t.name, key: teamKeyFromName(t.name), color: t.color ?? TEAM_COLOR[teamKeyFromName(t.name)] }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return { people: peopleView, teamOptions, availableAccounts }
}
