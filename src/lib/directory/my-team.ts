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

import type { SupabaseClient } from '@supabase/supabase-js'
import type { SignedInIdentity } from './current-person'
import type { Database } from '@/lib/types/database.types'
import { loadCurrentPerson } from '@/lib/directory/current-person'
import { loadContactByPerson } from '@/lib/hr/contact'
import { teamKeyFromName } from '@/lib/directory/people-types'
import { asRoleType } from '@/lib/auth/tier'
import type { RestrictedPerson, FullProfile, RestrictedTeam } from '@/components/admin/RestrictedDirectory'
import { TEAM_POSITION_LABEL } from '@/lib/directory/people-types'
import { colourOf, teamColoursFrom } from '@/lib/directory/team-colour'
import { TOOLS } from '@/lib/access/tools'

type Client = SupabaseClient<Database>

const str = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : ''
  return s === '' ? null : s
}

export interface MyTeamView {
  people: RestrictedPerson[]
  teamNames: string[]
  /**
   * The viewer's teams as cards. Tool access is filled from level 2 up and
   * null below, which is the one thing that separates the two levels: at
   * level 1 the tab shows who is on the team, at level 2 it also shows what
   * the team can reach.
   */
  teams: RestrictedTeam[]
  /** Whose card the viewer may open, keyed by person id. */
  profiles: Record<string, FullProfile>
  selfId: string | null
}

/**
 * @param level the viewer's directory level (access/surfaces.ts). At 3 every
 *   teammate's card opens; at 1 and 2 only their own, which is the same rule
 *   the Directory itself follows.
 */
export async function loadMyTeam(supabase: Client, user: SignedInIdentity | null, level: 1 | 2 | 3): Promise<MyTeamView> {
  const me = await loadCurrentPerson(supabase, user)
  if (!me) return { people: [], teamNames: [], teams: [], profiles: {}, selfId: null }

  // One read of the team palette for the whole view, so every avatar on the
  // page agrees with every other and with the directory.
  const { data: allTeams } = await supabase.from('teams').select('name, color')
  const colours = teamColoursFrom((allTeams ?? []) as { name: string; color: string | null }[])

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
    .select('id, full_name, last_name, title, avatar_url, role_type, status, manager_id, also_reports_to_id, reports_to_manager, manager_name_text, email_true_north, email_goodnews, email_coe, whatsapp_same_number, location, hire_date, left_on, employment_type, schedule, weekly_hours, onboarding_status, offboarding_status')
    .in('id', openableIds)
  const detailById = new Map((detailRows ?? []).map(r => [r.id, r]))

  // Personal email, phone and date of birth are unreadable by the signed-in
  // role (migration 056). Fetched for the SAME id list, so the openable set
  // still decides everything and there is no second rule to keep in step.
  const contactById = await loadContactByPerson(openableIds)

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
        color: colourOf(colours, teamName),
        avatarUrl: p.avatar_url ?? null,
        roleType: asRoleType(p.role_type),
        status: 'active',
        // Levels 1 and 2: only your own card opens. Level 3: everyone's.
        detail: d
          ? {
              managerName: mgrId ? nameById.get(mgrId) ?? null : null,
              workEmail: str(d.email_true_north) ?? str(d.email_goodnews) ?? str(d.email_coe),
              phone: contactById.get(p.id)?.phone ?? null,
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
    personalEmail: contactById.get(r.id)?.emailPersonal ?? null,
    phone: contactById.get(r.id)?.phone ?? null,
    whatsapp: str(r.whatsapp_same_number),
    location: str(r.location),
    dateOfBirth: contactById.get(r.id)?.dateOfBirth ?? null,
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

  // ── The Teams tab ────────────────────────────────────────────────────────
  const teamCards: RestrictedTeam[] = []
  if (teamIds.length) {
    const [{ data: teamRows }, { data: memberRows }, tools] = await Promise.all([
      supabase.from('teams').select('id, name').in('id', teamIds),
      supabase.from('team_members').select('team_id, person_id, position').in('team_id', teamIds),
      // Level 1 never sees tool access, so it is never even asked for.
      level >= 2
        ? supabase.from('team_tools').select('team_id, tool_key, audience').in('team_id', teamIds)
        : Promise.resolve({ data: [] as { team_id: string; tool_key: string; audience: string }[] }),
    ])

    const titleById = new Map((rows ?? []).map(r => [r.id, str(r.title)]))
    const avatarById = new Map((rows ?? []).map(r => [r.id, r.avatar_url ?? null]))
    const toolLabel = new Map(TOOLS.map(t => [t.key, t.label]))

    const byTeam = new Map<string, { person_id: string; position?: string }[]>()
    for (const m of (memberRows ?? []) as { team_id: string; person_id: string; position?: string }[]) {
      byTeam.set(m.team_id, [...(byTeam.get(m.team_id) ?? []), m])
    }
    const toolsByTeam = new Map<string, { label: string; audience: 'lead' | 'all' }[]>()
    for (const t of (tools.data ?? []) as { team_id: string; tool_key: string; audience: string }[]) {
      toolsByTeam.set(t.team_id, [...(toolsByTeam.get(t.team_id) ?? []), {
        label: toolLabel.get(t.tool_key) ?? t.tool_key,
        audience: t.audience === 'lead' ? 'lead' : 'all',
      }])
    }

    for (const t of (teamRows ?? []) as { id: string; name: string }[]) {
      teamCards.push({
        id: t.id,
        name: t.name,
        teamKey: teamKeyFromName(t.name),
        color: colourOf(colours, t.name),
        members: (byTeam.get(t.id) ?? [])
          .map(m => ({
            id: m.person_id,
            name: nameById.get(m.person_id) ?? 'Unknown',
            title: titleById.get(m.person_id) ?? null,
            avatarUrl: avatarById.get(m.person_id) ?? null,
            positionLabel: TEAM_POSITION_LABEL[m.position ?? 'collaborator'] ?? 'Collaborator',
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        tools: level >= 2 ? (toolsByTeam.get(t.id) ?? []) : null,
      })
    }
    teamCards.sort((a, b) => a.name.localeCompare(b.name))
  }

  return { people, teamNames, teams: teamCards, profiles, selfId: me.id }
}
