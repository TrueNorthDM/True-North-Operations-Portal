/**
 * my-team.ts: the Level 1 directory view for the signed-in person, whatever
 * their access level.
 *
 * /directory shows whatever their level allows (up to the full admin tabs);
 * this is the personal view, always Level 1: the people on the teams they
 * belong to, with only their own card openable. An admin gets the same thing
 * their team gets, which is the point of having it in the user menu.
 *
 * Loads only those teams' members rather than the whole company, so it stays
 * cheap even as the directory grows.
 */

import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database.types'
import { loadCurrentPerson } from '@/lib/directory/current-person'
import { teamKeyFromName } from '@/lib/directory/people-types'
import { asRoleType } from '@/lib/auth/tier'
import type { RestrictedPerson, FullProfile } from '@/components/admin/RestrictedDirectory'

type Client = SupabaseClient<Database>

const str = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : ''
  return s === '' ? null : s
}

export interface MyTeamView {
  people: RestrictedPerson[]
  teamNames: string[]
  /** Whose card the viewer may open, keyed by person id. */
  profiles: Record<string, FullProfile>
  selfId: string | null
}

/**
 * @param level the viewer's directory level (access/surfaces.ts). At 3 every
 *   teammate's card opens; at 1 and 2 only their own, which is the same rule
 *   the Directory itself follows.
 */
export async function loadMyTeam(supabase: Client, user: User | null, level: 1 | 2 | 3): Promise<MyTeamView> {
  const me = await loadCurrentPerson(supabase, user)
  if (!me) return { people: [], teamNames: [], profiles: {}, selfId: null }

  const { data: myMemberships } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('person_id', me.id)
  const teamIds = (myMemberships ?? []).map(m => m.team_id)

  // Everyone on those teams (the viewer is always included, even with no team).
  const personIds = new Set<string>([me.id])
  let teamNames: string[] = []
  if (teamIds.length) {
    const [{ data: peers }, { data: teams }] = await Promise.all([
      supabase.from('team_members').select('person_id').in('team_id', teamIds),
      supabase.from('teams').select('name').in('id', teamIds),
    ])
    for (const p of peers ?? []) personIds.add(p.person_id)
    teamNames = (teams ?? []).map(t => t.name).sort((a, b) => a.localeCompare(b))
  }

  // Two reads instead of one, split by who the viewer may actually open.
  //
  // The single wide select this replaced pulled dates of birth, personal
  // emails and phone numbers for every teammate and then dropped them while
  // building the response. That was never a leak, but it left the privacy of
  // the screen resting entirely on two filters further down: move the wrong
  // line, or return `rows` directly one day, and it becomes one, with nothing
  // in the diff looking wrong. Not fetching what must not be shown removes the
  // question instead of answering it.
  const openableIds = level >= 3 ? [...personIds] : [me.id]

  // Enough for the card list: name, avatar, team colour, and the manager
  // lookup. Nothing here is private to the person.
  // Spelled out rather than composed: the typed client can only infer the row
  // shape from a literal, so a concatenated string erases the types.
  const { data: rows } = await supabase
    .from('people')
    .select('id, full_name, title, avatar_url, role_type, status, manager_id')
    .in('id', [...personIds])

  // The rest, only for the people whose card this viewer can open.
  const { data: detailRows } = await supabase
    .from('people')
    .select('id, full_name, last_name, title, avatar_url, role_type, status, manager_id, also_reports_to_id, reports_to_manager, manager_name_text, email_true_north, email_goodnews, email_coe, email_personal, phone, whatsapp_same_number, location, date_of_birth, hire_date, left_on, employment_type, schedule, weekly_hours, onboarding_status, offboarding_status')
    .in('id', openableIds)
  const detailById = new Map((detailRows ?? []).map(r => [r.id, r]))

  const nameById = new Map((rows ?? []).map(r => [r.id, r.full_name]))
  // The primary team drives the avatar colour; one lookup for the whole set.
  const { data: primary } = await supabase
    .from('team_members')
    .select('person_id, team_id, teams(name)')
    .in('person_id', [...personIds])
  const teamNamesByPerson = new Map<string, string[]>()
  for (const m of (primary ?? []) as unknown as { person_id: string; teams: { name: string } | null }[]) {
    if (!m.teams?.name) continue
    const list = teamNamesByPerson.get(m.person_id) ?? []
    if (!list.includes(m.teams.name)) list.push(m.teams.name)
    teamNamesByPerson.set(m.person_id, list)
  }
  for (const list of teamNamesByPerson.values()) list.sort((a, b) => a.localeCompare(b))
  const teamNameByPerson = new Map([...teamNamesByPerson].map(([id, list]) => [id, list[0]]))

  const people: RestrictedPerson[] = (rows ?? [])
    .filter(p => p.status !== 'inactive')
    .map((p): RestrictedPerson => {
      const teamName = teamNameByPerson.get(p.id) ?? null
      const mgrId = str(p.manager_id)
      // `openable` is now decided by whether the private row was fetched at
      // all, so the two can no longer disagree.
      const d = detailById.get(p.id)
      return {
        id: p.id,
        name: p.full_name,
        title: str(p.title),
        teamName,
        teamKey: teamKeyFromName(teamName ?? undefined),
        avatarUrl: p.avatar_url ?? null,
        roleType: asRoleType(p.role_type),
        status: 'active',
        // Levels 1 and 2: only your own card opens. Level 3: everyone's.
        detail: d
          ? {
              managerName: mgrId ? nameById.get(mgrId) ?? null : null,
              workEmail: str(d.email_true_north) ?? str(d.email_goodnews) ?? str(d.email_coe),
              phone: str(d.phone),
              location: str(d.location),
              hireDate: str(d.hire_date),
              employmentType: str(d.employment_type),
            }
          : null,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  // Full cards only for the people this viewer may open, so the extra fields
  // are never sent to the browser for anyone else.
  type Row = NonNullable<typeof detailRows>[number]
  const toProfile = (r: Row): FullProfile => ({
    name: r.full_name,
    lastName: str(r.last_name),
    title: str(r.title),
    avatarUrl: r.avatar_url ?? null,
    roleType: asRoleType(r.role_type),
    active: r.status !== 'inactive',
    teamNames: teamNamesByPerson.get(r.id) ?? [],
    personalEmail: str(r.email_personal),
    phone: str(r.phone),
    whatsapp: str(r.whatsapp_same_number),
    location: str(r.location),
    dateOfBirth: str(r.date_of_birth),
    employmentType: str(r.employment_type),
    schedule: str(r.schedule),
    weeklyHours: r.weekly_hours ?? null,
    managerName: str(r.manager_id) ? nameById.get(r.manager_id as string) ?? null : null,
    alsoReportsToName: str(r.also_reports_to_id) ? nameById.get(r.also_reports_to_id as string) ?? null : null,
    managerNameText: str(r.manager_name_text),
    reportsToManager: str(r.reports_to_manager),
    onboardingStatus: str(r.onboarding_status),
    offboardingStatus: str(r.offboarding_status),
    emailTrueNorth: str(r.email_true_north),
    emailGoodnews: str(r.email_goodnews),
    emailCoe: str(r.email_coe),
    hireDate: str(r.hire_date),
    leftOn: str(r.left_on),
  })

  // No level check here any more: detailRows IS the allowed set.
  const profiles: Record<string, FullProfile> = {}
  for (const r of detailRows ?? []) {
    if (r.status === 'inactive') continue
    profiles[r.id] = toProfile(r)
  }

  return { people, teamNames, profiles, selfId: me.id }
}
