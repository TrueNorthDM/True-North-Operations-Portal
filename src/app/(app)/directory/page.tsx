// Admin → Directory. The single surface for People · Emails · Teams · Access,
// all controlled from one page. Gated to admins.

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadCompensationByPerson } from '@/lib/hr/compensation'
import { loadContactByPerson, type Contact } from '@/lib/hr/contact'
import { DirectoryTabs } from '@/components/admin/DirectoryTabs'
import type { AccessLogEntry } from '@/components/admin/AccessLogManager'
import { RestrictedDirectory, type RestrictedPerson, type RestrictedTeam } from '@/components/admin/RestrictedDirectory'
import { colourOf, teamColour, teamColoursFrom } from '@/lib/directory/team-colour'
import { teamKeyFromName, initialsOf, teamPositionRank, teamPositionLeads, TEAM_POSITION_LABEL, type PersonView, type PersonAttachment, type PersonTeam, type TeamKey } from '@/lib/directory/people-types'
import type { PersonAddress } from '@/lib/address'
import type { PersonMilestone } from '@/lib/milestones'
import type { TeamCard } from '@/components/admin/TeamsManager'
import type { ToolAudience } from '@/lib/access/tools'
import { loadCurrentPerson } from '@/lib/directory/current-person'
import { getBudgetUsageData } from '@/lib/tsheets/budget-usage-data'
import type { GrantRole } from '@/app/(app)/admin/teams/actions'
import { requireSurface } from '@/lib/access/resolve'
import { directoryLevel } from '@/lib/access/surfaces'
import { TOOLS } from '@/lib/access/tools'
import { Breadcrumb } from '@/components/ui/Breadcrumb'

// Full people select (needs migration 029). Falls back to base columns if the
// migration hasn't run yet, so the page never 500s on a pre-migration deploy.
const PEOPLE_FULL =
  'id, full_name, last_name, title, manager_id, status, profile_id, tsheets_user_id, ' +
  'employment_type, schedule, weekly_hours, reports_to_manager, also_reports_to_id, manager_name_text, ' +
  // personal email, phone, date of birth and address are privileged reads now
  // (migration 056); they come back from lib/hr/contact.ts.
  'email_true_north, email_goodnews, email_coe, location, whatsapp_same_number, ' +
  'hire_date, left_on, employment_history'
const PEOPLE_BASE = 'id, full_name, title, manager_id, status, profile_id, tsheets_user_id'

const LOGO_BY_CODE: Record<string, string> = { aaaf: '/logos/aaaf.jpg', hfa: '/logos/hfa.png' }

/** Loosely-typed people row, columns depend on whether migration 029 ran. */
type PRow = Record<string, unknown> & { id: string; full_name: string }

export default async function DirectoryPage({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  const access = await requireSurface('directory')
  // Resolved up here, not next to the view models, because it decides which
  // COLUMNS to read a few lines below and not just what to render.
  const level = directoryLevel(access.can)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  // ?open=<personId>, deep-link a person's card open (e.g. from Human Resources).
  const openId = (await searchParams).open ?? null
  // Directory is reachable by everyone; the configured directory level decides
  // the view (see access/surfaces.ts): level 3 gets the full admin tabs,
  // levels 1 and 2 the read-only, team-scoped list below.
  const mePerson = await loadCurrentPerson(supabase, user)

  // People, with graceful degradation, then the rest in parallel.
  //
  // Levels 1 and 2 get the narrow column set. The wide one carries personal
  // emails, phones, dates of birth and employment history for the whole
  // company, and those levels render a list of names and one card: their own.
  // The old code read everything and dropped it while assembling the response,
  // which worked but left the privacy of the screen resting on a filter 300
  // lines away. Not reading it removes the question.
  // Collected as rows rather than as the response object: the two selects have
  // different shapes, and everything downstream reads through PRow anyway.
  let pRows: unknown[] | null = null
  if (level >= 3) {
    const full = await supabase.from('people').select(PEOPLE_FULL)
    if (!full.error) pRows = full.data
  }
  if (!pRows) {
    const base = await supabase.from('people').select(PEOPLE_BASE)
    pRows = base.data ?? []
  }

  // The viewer's own row in full, since their own card opens at every level.
  const { data: selfWide } = mePerson && level < 3
    ? await supabase.from('people').select(PEOPLE_FULL).eq('id', mePerson.id).maybeSingle()
    : { data: null }

  const [{ data: tData }, { data: gData }, { data: sData }, { data: prData }, aRes, dRes, ttRes, lcRes, msRes, alRes] = await Promise.all([
    supabase.from('teams').select('id, name, color'),
    supabase.from('grants').select('subject_type, subject_id, project_id, role'),
    supabase.from('sites').select('id, name, code'),
    supabase.from('profiles').select('id, email'),
    supabase.from('person_attachments').select('id, person_id, file_name, storage_path, mime, size_bytes, uploaded_at'),
    // Separate + graceful: monday_docs (034) / role_type (035) / avatar_url (036)
    // may not exist yet, a failed query here must NOT drop the PEOPLE_FULL select.
    supabase.from('people').select('id, monday_docs, role_type, avatar_url'),
    // Team → tool access (037). Table may not exist yet, empty on error.
    supabase.from('team_tool_grants').select('team_id, tool_key, audience'),
    // Isolated + graceful: onboarding/offboarding status (043).
    supabase.from('people').select('id, onboarding_status, offboarding_status'),
    // Isolated + graceful: milestones (044).
    supabase.from('people').select('id, milestones'),
    // Access log (045), admin-readable; graceful if the table isn't there yet.
    supabase.from('access_log').select('id, profile_id, person_id, name, email, user_agent, accessed_at').order('accessed_at', { ascending: false }).limit(1000),
  ])

  const people = (pRows ?? []) as unknown as PRow[]
  const teams = tData ?? []
  // Team memberships + per-team position (040) + is_primary (048). Graceful:
  // pre-migration those columns are absent, so fall back progressively. Cast
  // through a loose type because is_primary isn't in the generated DB types.
  type TmRow = { team_id: string; person_id: string; position?: string; is_primary?: boolean }
  let tmData: TmRow[] = []
  {
    const withPrimary = await supabase.from('team_members').select('team_id, person_id, position, is_primary')
    if (!withPrimary.error) tmData = withPrimary.data as unknown as TmRow[]
    else {
      const withPos = await supabase.from('team_members').select('team_id, person_id, position')
      if (!withPos.error) tmData = withPos.data as unknown as TmRow[]
      else tmData = ((await supabase.from('team_members').select('team_id, person_id')).data ?? []) as unknown as TmRow[]
    }
  }
  const members = tmData.map((m) => ({
    team_id: m.team_id,
    person_id: m.person_id,
    position: m.position === 'founder' ? 'founder' : m.position === 'manager' ? 'manager' : m.position === 'team_leader' ? 'team_leader' : 'collaborator',
    is_primary: m.is_primary === true,
  }))
  const grants = gData ?? []
  const sites = sData ?? []
  const profiles = prData ?? []

  // "History" documents, grouped per person (empty if migration 033 isn't applied).
  const attachmentsByPerson = new Map<string, PersonAttachment[]>()
  for (const a of aRes.data ?? []) {
    const arr = attachmentsByPerson.get(a.person_id) ?? []
    arr.push({ id: a.id, fileName: a.file_name, storagePath: a.storage_path, mime: a.mime, sizeBytes: a.size_bytes, uploadedAt: a.uploaded_at })
    attachmentsByPerson.set(a.person_id, arr)
  }

  // Monday Docs text (034) + contact type (035) per person; empty/'user' default
  // if the migration isn't applied yet.
  const mondayDocsById = new Map<string, string>()
  const roleTypeById = new Map<string, string>()
  const avatarById = new Map<string, string>()
  for (const d of dRes.data ?? []) {
    if (d.monday_docs) mondayDocsById.set(d.id, d.monday_docs)
    if (d.role_type) roleTypeById.set(d.id, d.role_type)
    if (d.avatar_url) avatarById.set(d.id, d.avatar_url)
  }
  // Address, personal email, phone and date of birth: privileged reads now
  // (migration 056). Only fetched at level 3, where the full cards render; at
  // levels 1 and 2 the view model built from them is discarded anyway.
  const contactById = level >= 3 ? await loadContactByPerson() : new Map<string, Contact>()
  const addressById = new Map<string, PersonAddress>()
  for (const [id, c] of contactById) if (c.address) addressById.set(id, c.address)
  const onboardingById = new Map<string, string>()
  const offboardingById = new Map<string, string>()
  if (!lcRes.error) for (const r of (lcRes.data ?? []) as { id: string; onboarding_status: string | null; offboarding_status: string | null }[]) {
    if (r.onboarding_status) onboardingById.set(r.id, r.onboarding_status)
    if (r.offboarding_status) offboardingById.set(r.id, r.offboarding_status)
  }
  const milestonesById = new Map<string, PersonMilestone[]>()
  if (!msRes.error) for (const r of (msRes.data ?? []) as { id: string; milestones: PersonMilestone[] | null }[]) if (Array.isArray(r.milestones)) milestonesById.set(r.id, r.milestones)

  // Access log (045). Rows come newest-first, so the first row per profile is
  // their latest access. Graceful if the table doesn't exist yet.
  type AlRow = { id: string; profile_id: string | null; person_id: string | null; name: string | null; email: string | null; user_agent: string | null; accessed_at: string }
  const accessRows = (!alRes.error ? (alRes.data ?? []) : []) as AlRow[]
  // lastAccessByPersonId is built below, after the email lookups exist, so it can
  // resolve a login to a person by person_id -> profile_id -> any known email
  // (a login under an unlinked email would otherwise never reach the card).

  const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)
  const num = (v: unknown): number | null => (v == null || v === '' ? null : Number(v))

  const teamById = new Map(teams.map(t => [t.id, t]))
  const siteById = new Map(sites.map(s => [s.id, s]))

  // ── Primary team per person (first membership, name-sorted for determinism) ──
  const teamIdsByPerson = new Map<string, string[]>()
  for (const m of members) {
    const arr = teamIdsByPerson.get(m.person_id) ?? []
    arr.push(m.team_id)
    teamIdsByPerson.set(m.person_id, arr)
  }
  // Explicit primary (migration 048) wins; otherwise fall back to the
  // alphabetical-first membership so this stays deterministic pre-backfill.
  const primaryTeamIdByPerson = new Map<string, string>()
  for (const m of members) if (m.is_primary) primaryTeamIdByPerson.set(m.person_id, m.team_id)
  function primaryTeam(personId: string): { id: string; name: string } | null {
    const pid = primaryTeamIdByPerson.get(personId)
    if (pid) { const t = teamById.get(pid); if (t) return { id: t.id, name: t.name } }
    const ids = teamIdsByPerson.get(personId) ?? []
    const named = ids.map(id => teamById.get(id)).filter((t): t is NonNullable<typeof t> => !!t)
    named.sort((a, b) => a.name.localeCompare(b.name))
    return named[0] ? { id: named[0].id, name: named[0].name } : null
  }
  const teamKeyByPerson = new Map<string, TeamKey>()
  for (const p of people) teamKeyByPerson.set(p.id, teamKeyFromName(primaryTeam(p.id)?.name))

  // One palette for the page, from what the admin set on each team.
  const teamPalette = teamColoursFrom(teams as { name: string; color: string | null }[])

  // Per-person memberships with position (drives the People modal's teams editor)
  // and the set of teams each person LEADS (position=team_leader) for the tier.
  const teamsByPerson = new Map<string, PersonTeam[]>()
  const leadTeamIdsByPerson = new Map<string, Set<string>>()
  for (const m of members) {
    const t = teamById.get(m.team_id)
    if (t) {
      const arr = teamsByPerson.get(m.person_id) ?? []
      arr.push({ teamId: t.id, teamName: t.name, teamKey: teamKeyFromName(t.name), color: colourOf(teamPalette, t.name), position: m.position, primary: m.is_primary })
      teamsByPerson.set(m.person_id, arr)
    }
    if (teamPositionLeads(m.position)) {
      const s = leadTeamIdsByPerson.get(m.person_id) ?? new Set<string>()
      s.add(m.team_id)
      leadTeamIdsByPerson.set(m.person_id, s)
    }
  }
  // Founder → Team Leader → Collaborator, then alphabetical by team name.
  for (const arr of teamsByPerson.values()) {
    arr.sort((a, b) => teamPositionRank(a.position) - teamPositionRank(b.position) || (a.teamName ?? '').localeCompare(b.teamName ?? ''))
  }

  // ── Accounts (for the account picker) ──
  const emailByProfile = new Map(profiles.map(pr => [pr.id, pr.email ?? '(no email)']))

  // Last access per PERSON: resolve each access row (newest first) to a person by
  // person_id, then the person's linked profile_id, then any email they hold
  // (account email or one of their address columns). This is why "Last access"
  // shows up even when someone logs in with an email whose auth account isn't the
  // one linked on their person record.
  const peopleIds = new Set(people.map(p => p.id as string))
  const personIdByProfile = new Map<string, string>()
  const personIdByEmail = new Map<string, string>()
  for (const p of people) {
    const pid = p.id as string
    const prof = str(p.profile_id)
    if (prof) {
      personIdByProfile.set(prof, pid)
      const accEmail = emailByProfile.get(prof)
      if (accEmail && accEmail !== '(no email)') personIdByEmail.set(accEmail.toLowerCase(), pid)
    }
    for (const e of [p.email_true_north, p.email_goodnews, p.email_coe, p.email_personal]) {
      if (typeof e === 'string' && e) personIdByEmail.set(e.toLowerCase(), pid)
    }
  }
  const lastAccessByPersonId = new Map<string, { at: string; agent: string | null }>()
  for (const r of accessRows) {
    const pid = (r.person_id && peopleIds.has(r.person_id) ? r.person_id : null)
      ?? (r.profile_id ? personIdByProfile.get(r.profile_id) ?? null : null)
      ?? (r.email ? personIdByEmail.get(r.email.toLowerCase()) ?? null : null)
    if (pid && !lastAccessByPersonId.has(pid)) lastAccessByPersonId.set(pid, { at: r.accessed_at, agent: r.user_agent })
  }
  const linkedProfileIds = new Set(people.map(p => (typeof p.profile_id === 'string' ? p.profile_id : null)).filter(Boolean) as string[])
  const availableAccounts = profiles
    .filter(pr => !linkedProfileIds.has(pr.id))
    .map(pr => ({ id: pr.id, email: pr.email ?? '(no email)' }))
    .sort((a, b) => a.email.localeCompare(b.email))

  const nameById = new Map(people.map(p => [p.id, p.full_name]))

  // ── People view models ──
  const compensation = level >= 3 ? await loadCompensationByPerson() : new Map<string, { internalRate: number | null }>()

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
        color: colourOf(teamPalette, pt?.name ?? null),
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
        internalRate: compensation.get(p.id)?.internalRate ?? null,
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
        lastAccessAt: lastAccessByPersonId.get(p.id as string)?.at ?? null,
        lastAccessAgent: lastAccessByPersonId.get(p.id as string)?.agent ?? null,
        history: str(p.employment_history),
        milestones: milestonesById.get(p.id) ?? [],
        mondayDocs: mondayDocsById.get(p.id) ?? null,
        attachments: attachmentsByPerson.get(p.id) ?? [],
      }
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name))

  // ── Teams (filter pills + Team select options) ──
  const teamOptions = teams
    .map(t => ({ id: t.id, name: t.name, key: teamKeyFromName(t.name), color: teamColour(t.color, t.name) }))
    .sort((a, b) => a.name.localeCompare(b.name))

  // ── Team cards (members with LEAD flag + project access) ──
  const grantsByTeam = new Map<string, { projectId: string; name: string; logo: string | null; role: GrantRole }[]>()
  for (const g of grants) {
    if (g.subject_type !== 'team') continue
    const site = siteById.get(g.project_id)
    const arr = grantsByTeam.get(g.subject_id) ?? []
    arr.push({ projectId: g.project_id, name: site?.name ?? '-', logo: site ? LOGO_BY_CODE[site.code] ?? null : null, role: g.role as GrantRole })
    grantsByTeam.set(g.subject_id, arr)
  }
  const membersByTeam = new Map<string, { personId: string; position: string }[]>()
  for (const m of members) {
    const arr = membersByTeam.get(m.team_id) ?? []
    arr.push({ personId: m.person_id, position: m.position })
    membersByTeam.set(m.team_id, arr)
  }
  // Tool grants per team (037). Absence of a row = unrestricted (Part 4 enforces).
  const toolsByTeam = new Map<string, { toolKey: string; audience: ToolAudience }[]>()
  for (const r of ttRes.data ?? []) {
    const arr = toolsByTeam.get(r.team_id) ?? []
    arr.push({ toolKey: r.tool_key, audience: r.audience === 'lead' ? 'lead' : 'all' })
    toolsByTeam.set(r.team_id, arr)
  }
  const teamCards: TeamCard[] = teams
    .map((t): TeamCard => {
      const key = teamKeyFromName(t.name)
      const mem = (membersByTeam.get(t.id) ?? [])
        .map(mm => { const p = people.find(x => x.id === mm.personId); return p ? { p, position: mm.position } : null })
        // Inactive people never appear outside the People tab.
        .filter((x): x is { p: PRow; position: string } => !!x && x.p.status !== 'inactive')
        .map(({ p, position }) => ({
          id: p.id,
          name: p.full_name,
          initials: initialsOf(p.full_name),
          teamKey: teamKeyByPerson.get(p.id) ?? key,
          position,
          isLead: teamPositionLeads(position),
          roleType: roleTypeById.get(p.id) ?? 'user',
          avatarUrl: avatarById.get(p.id) ?? null,
        }))
        // Founder → Team Leader → Collaborator, then alphabetical.
        .sort((a, b) => teamPositionRank(a.position) - teamPositionRank(b.position) || a.name.localeCompare(b.name))
      return {
        id: t.id,
        name: t.name,
        teamKey: key,
        color: teamColour(t.color, t.name),
        memberCount: mem.length,
        members: mem,
        access: (grantsByTeam.get(t.id) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
        tools: toolsByTeam.get(t.id) ?? [],
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  // ── Levels 1 and 2: read-only. Level 3 falls through to the full tabs. ──
  //
  // Level 1  their own teams, and only their own card opens. Someone on no team
  //          sees just themselves.
  // Level 2  the whole company list, same as an admin sees, and every team,
  //          read-only. Still only their own card opens.
  //
  // The ladder is about REACH, not about detail: level 2 widens who you can see
  // exists and how the teams are arranged, and widens nothing about any
  // individual. My Team (the page and the My Work tab) is a different question,
  // "who do I work with", and stays scoped to the viewer's own teams for
  // everyone at every level.
  if (level < 3) {
    const viewerId = mePerson?.id ?? null

    // The viewer's teams (all of them, if several) and everyone in them.
    const myTeamIds = new Set<string>(
      viewerId ? members.filter(m => m.person_id === viewerId).map(m => m.team_id) : [],
    )
    const visible = new Set<string>(viewerId ? [viewerId] : [])
    for (const m of members) if (myTeamIds.has(m.team_id)) visible.add(m.person_id)
    const seesEveryone = level >= 2

    const dirPeople: RestrictedPerson[] = people
      .filter(p => p.status !== 'inactive' && (seesEveryone || visible.has(p.id)))
      .map((p): RestrictedPerson => {
        const pt = primaryTeam(p.id)
        const mgrId = str(p.manager_id)
        // Only the viewer's own card carries detail, at both levels.
        // Own card only, and its fields come from the row fetched for exactly
        // that purpose: at these levels `p` does not carry them at all.
        const self = p.id === viewerId ? (selfWide as Record<string, unknown> | null) : null
        return {
          id: p.id,
          name: p.full_name,
          title: str(p.title),
          teamName: pt?.name ?? null,
          teamKey: teamKeyFromName(pt?.name),
          color: colourOf(teamPalette, pt?.name ?? null),
          avatarUrl: avatarById.get(p.id) ?? null,
          roleType: roleTypeById.get(p.id) ?? 'user',
          status: (p.status === 'inactive' ? 'inactive' : 'active') as 'active' | 'inactive',
          detail: self
            ? {
                managerName: mgrId ? nameById.get(mgrId) ?? null : null,
                workEmail: str(self.email_true_north) ?? str(self.email_goodnews) ?? str(self.email_coe),
                phone: str(self.phone),
                location: str(self.location),
                hireDate: str(self.hire_date),
                employmentType: str(self.employment_type),
              }
            : null,
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))

    // The Teams tab (level 2). Tool labels come from the catalogue so an
    // unknown/retired key never leaks a raw slug into the UI.
    const toolLabel = new Map(TOOLS.map(t => [t.key, t.label]))
    const dirTeams: RestrictedTeam[] = teams
      .filter(t => seesEveryone || myTeamIds.has(t.id))
      .map((t): RestrictedTeam => ({
        id: t.id,
        name: t.name,
        teamKey: teamKeyFromName(t.name),
        color: colourOf(teamPalette, t.name),
        members: members
          .filter(m => m.team_id === t.id)
          .map(m => ({
            id: m.person_id,
            name: nameById.get(m.person_id) ?? 'Unknown',
            title: str(people.find(p => p.id === m.person_id)?.title ?? null),
            avatarUrl: avatarById.get(m.person_id) ?? null,
            positionLabel: TEAM_POSITION_LABEL[(m as { position?: string }).position ?? 'collaborator'] ?? 'Collaborator',
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        tools: level >= 2
          ? (toolsByTeam.get(t.id) ?? []).map(g => ({
              label: toolLabel.get(g.toolKey) ?? g.toolKey,
              audience: g.audience,
            }))
          : null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return (
      <div className="space-y-6">
        <Breadcrumb self="/directory" />
        <RestrictedDirectory people={dirPeople} teams={dirTeams} showTeams={level >= 2} />
      </div>
    )
  }

  // Privileged only: the Rates & Costs tab data (moved here from Settings →
  // People & rates). Loaded after the restricted branch so non-admins never
  // trigger it.
  const budget = await getBudgetUsageData()

  // Access-log rows resolved to the current person (avatar/team) for the tab.
  // Resolve each access row to a person by any key we hold, most specific
  // first: the stored person_id, then the auth profile_id (People link to auth
  // by profile_id, which is why the card's Last access already resolves), then
  // any known email. logAccess can store a null person_id/name when RLS hides
  // the people table from the signed-in user at insert time, so we re-resolve
  // here, where the page reads as admin and sees everyone.
  const pvById = new Map(peopleView.map(pv => [pv.id, pv]))
  const pvByProfile = new Map(peopleView.filter(pv => pv.accountId).map(pv => [pv.accountId as string, pv]))
  const pvByEmail = new Map<string, PersonView>()
  for (const pv of peopleView) {
    for (const e of [pv.accountEmail, pv.emails.trueNorth, pv.emails.goodnews, pv.emails.coe, pv.emails.personal]) {
      if (e) pvByEmail.set(e.toLowerCase(), pv)
    }
  }
  const accessLog: AccessLogEntry[] = accessRows.map(r => {
    const pv = (r.person_id ? pvById.get(r.person_id) : undefined)
      ?? (r.profile_id ? pvByProfile.get(r.profile_id) : undefined)
      ?? (r.email ? pvByEmail.get(r.email.toLowerCase()) : undefined)
    return {
      id: r.id,
      personId: pv?.id ?? r.person_id,
      name: pv?.full_name ?? r.name ?? r.email ?? '(unknown)',
      email: r.email ?? pv?.accountEmail ?? '',
      userAgent: r.user_agent,
      accessedAt: r.accessed_at,
      color: pv?.color ?? colourOf(teamPalette, null),
      avatarUrl: pv?.avatarUrl ?? null,
      teamKey: (pv?.teamKey ?? 'other') as TeamKey,
    }
  })

  return (
    <div className="space-y-6">
      <Breadcrumb self="/directory" />

      <DirectoryTabs
        people={peopleView}
        teamOptions={teamOptions}
        teamCards={teamCards}
        availableAccounts={availableAccounts}
        ratesPeople={budget.people}
        ratesClients={budget.clients.map(c => ({ id: c.id, name: c.name }))}
        accessLog={accessLog}
        initialOpenId={openId}
      />
    </div>
  )
}
