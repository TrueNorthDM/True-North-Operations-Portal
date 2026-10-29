// Admin → Directory. The single surface for People · Emails · Teams · Access,
// all controlled from one page. Gated to admins.

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DirectoryTabs } from '@/components/admin/DirectoryTabs'
import type { AccessLogEntry } from '@/components/admin/AccessLogManager'
import { RestrictedDirectory, type RestrictedPerson, type RestrictedTeam } from '@/components/admin/RestrictedDirectory'
import { colourOf, teamColour, teamColoursFrom } from '@/lib/directory/team-colour'
import { teamKeyFromName, initialsOf, teamPositionRank, teamPositionLeads, TEAM_POSITION_LABEL, cardRights, type PersonView, type PersonTeam, type TeamKey, normalPosition } from '@/lib/directory/people-types'
import type { TeamCard } from '@/components/admin/TeamsManager'
import { getBudgetUsageData } from '@/lib/tsheets/budget-usage-data'
import { requireSurface } from '@/lib/access/resolve'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadLedMemberIds } from '@/lib/directory/person-page-data'
import { primaryTeamByPerson } from '@/lib/directory/primary-team'
import { LIST_COLUMNS, LIST_COLUMNS_BASE, listGates } from '@/lib/directory/list-gates'
import { pageHrefs, personHref } from '@/lib/directory/page-rights'
import { directoryLevel } from '@/lib/access/surfaces'
import { TOOLS } from '@/lib/access/tools'
import { loadRules } from '@/lib/access/store'
import { toolsByTeam } from '@/lib/access/team-tools'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { getCurrentPerson, getSessionUser } from '@/lib/auth/session'
import { loadInvitesByPerson } from '@/lib/directory/invites'
import { loadTwoStepByAccount } from '@/lib/auth/two-step'

// The columns the list reads, and what each row carries by access, live in
// lib/directory/list-gates.ts, where a test holds them.


/** Loosely-typed people row, columns depend on whether migration 029 ran. */
type PRow = Record<string, unknown> & { id: string; full_name: string }

export default async function DirectoryPage({ searchParams }: { searchParams: Promise<{ open?: string; _vs?: string }> }) {
  const access = await requireSurface('directory')
  // Resolved up here, not next to the view models, because it decides which
  // COLUMNS to read a few lines below and not just what to render.
  const level = directoryLevel(access.can)
  // What the full cards may carry beyond the card itself (Admin > Access
  // levels). What is false is never read, so it never reaches the browser.
  const rights = cardRights(access.can)

  const supabase = await createClient()
  const user = await getSessionUser()
  if (!user) redirect('/login')
  // ?open=<personId> opened a person's card here before their own page existed
  // (8 October 2026): old links go to the page now.
  const { open: openId, _vs: vs } = await searchParams
  if (openId && /^[0-9a-f-]{36}$/i.test(openId)) redirect(personHref(openId) + (vs ? `?_vs=${encodeURIComponent(vs)}` : ''))
  // Directory is reachable by everyone; the configured directory level decides
  // the view (see access/surfaces.ts): level 3 gets the full admin tabs,
  // levels 1 and 2 the read-only, team-scoped list below.
  const mePerson = await getCurrentPerson()

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
    const full = await supabase.from('people').select(LIST_COLUMNS)
    if (!full.error) pRows = full.data
  }
  if (!pRows) {
    const base = await supabase.from('people').select(LIST_COLUMNS_BASE)
    pRows = base.data ?? []
  }

  // Whose page each row opens (lib/directory/page-rights.ts): their own, the
  // people of the teams they lead, or anyone's, as Access levels says.
  const led = await loadLedMemberIds(createAdminClient(), access.personId)
  const hrefFor = pageHrefs(access.can, access.personId, led)
  // The full list carries no more than the items open (audit, 8 October 2026).
  const gates = listGates(access.can, led)
  const seesEmails = gates.emails
  const seesLogin = gates.login
  const seesWork = gates.work

  const [{ data: tData }, { data: prData }, dRes, alRes, accessRules] = await Promise.all([
    supabase.from('teams').select('id, name, color'),
    supabase.from('profiles').select('id, email'),
    // Separate + graceful: role_type (035) / avatar_url (036) may not exist
    // yet, a failed query here must NOT drop the LIST_COLUMNS select.
    supabase.from('people').select('id, role_type, avatar_url'),
    // Access log (045), admin-readable; graceful if the table isn't there yet.
    // Only for the Access log tab and the cards' last access (d-log).
    level >= 3 && rights.accessLog
      ? supabase.from('access_log').select('id, profile_id, person_id, name, email, user_agent, accessed_at').order('accessed_at', { ascending: false }).limit(1000)
      : Promise.resolve({ data: [], error: null }),
    // Each tool's team list, as Access levels sets it (lib/access/team-tools.ts).
    loadRules(createAdminClient()),
  ])

  const people = (pRows ?? []) as unknown as PRow[]
  // Invitations and two-step sign-in: Portal access (d-portal, d-invite, d-2fa).
  const invites = level >= 3 && rights.portal ? await loadInvitesByPerson(supabase) : new Map<string, string>()
  // Two-step sign-in by account (migration 090); null before it runs, and the
  // Directory then leaves the two-step column and row out.
  const twoStepByAccount = level >= 3 && (rights.portal || rights.resetTwoStep) ? await loadTwoStepByAccount() : null
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
    position: normalPosition(m.position),
    is_primary: m.is_primary === true,
  }))
  const profiles = prData ?? []

  // Contact type (035) and photo per person; 'user' default if the migration
  // isn't applied yet.
  const roleTypeById = new Map<string, string>()
  const avatarById = new Map<string, string>()
  for (const d of dRes.data ?? []) {
    if (d.role_type) roleTypeById.set(d.id, d.role_type)
    if (d.avatar_url) avatarById.set(d.id, d.avatar_url)
  }

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

  // ── Primary team per person: the portal's one rule (lib/directory/primary-team) ──
  const primaryByPerson = primaryTeamByPerson(members.flatMap(m => {
    const t = teamById.get(m.team_id)
    return t ? [{ personId: m.person_id, team: { id: t.id, name: t.name }, isPrimary: m.is_primary }] : []
  }))
  const primaryTeam = (personId: string): { id: string; name: string } | null => primaryByPerson.get(personId) ?? null
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
    for (const e of [p.email_true_north, p.email_goodnews, p.email_coe]) {
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
  const nameById = new Map(people.map(p => [p.id, p.full_name]))

  // ── People view models ──
  const peopleView: PersonView[] = people
    .map((p): PersonView => {
      const pt = primaryTeam(p.id)
      const mgrId = str(p.manager_id)
      const alsoId = str(p.also_reports_to_id)
      const work = seesWork(p.id)
      return {
        id: p.id,
        full_name: p.full_name,
        avatarUrl: avatarById.get(p.id) ?? null,
        title: str(p.title),
        teamId: pt?.id ?? null,
        teamName: pt?.name ?? null,
        teamKey: teamKeyFromName(pt?.name),
        color: colourOf(teamPalette, pt?.name ?? null),
        teams: teamsByPerson.get(p.id) ?? [],
        manager_id: mgrId,
        managerName: mgrId ? nameById.get(mgrId) ?? null : null,
        alsoReportsToId: alsoId,
        alsoReportsToName: alsoId ? nameById.get(alsoId) ?? null : null,
        employmentType: work ? str(p.employment_type) : null,
        schedule: work ? str(p.schedule) : null,
        weeklyHours: work ? num(p.weekly_hours) : null,
        roleType: roleTypeById.get(p.id) ?? 'user',
        status: (p.status === 'inactive' ? 'inactive' : 'active') as 'active' | 'inactive',
        hireDate: work ? str(p.hire_date) : null,
        emails: {
          trueNorth: seesEmails ? str(p.email_true_north) : null,
          goodnews: seesLogin ? str(p.email_goodnews) : null,
          coe: seesEmails ? str(p.email_coe) : null,
        },
        accountId: str(p.profile_id),
        accountEmail: seesLogin && str(p.profile_id) ? emailByProfile.get(p.profile_id as string) ?? null : null,
        hasTsheets: p.tsheets_user_id != null,
        lastAccessAt: lastAccessByPersonId.get(p.id as string)?.at ?? null,
        portalInvitedAt: invites.get(p.id) ?? null,
        twoStepSince: twoStepByAccount ? (p.profile_id ? twoStepByAccount.get(p.profile_id as string) ?? null : null) : undefined,
      }
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name))

  // ── Teams (filter pills + Team select options) ──
  const teamOptions = teams
    .map(t => ({ id: t.id, name: t.name, key: teamKeyFromName(t.name), color: teamColour(t.color, t.name) }))
    .sort((a, b) => a.name.localeCompare(b.name))

  // ── Team cards (members with LEAD flag + project access) ──
  const membersByTeam = new Map<string, { personId: string; position: string }[]>()
  for (const m of members) {
    const arr = membersByTeam.get(m.team_id) ?? []
    arr.push({ personId: m.person_id, position: m.position })
    membersByTeam.set(m.team_id, arr)
  }
  // The tools each team is on, from Access levels (not the old team_tool_grants).
  const toolLists = toolsByTeam(accessRules, teams.map(t => t.id))

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
        tools: toolLists.get(t.id) ?? [],
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
          href: hrefFor(p.id),
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
        // Inactive people are on no team card (decided 8 October 2026).
        members: members
          .filter(m => m.team_id === t.id && people.find(p => p.id === m.person_id)?.status !== 'inactive')
          .map(m => ({
            id: m.person_id,
            name: nameById.get(m.person_id) ?? 'Unknown',
            title: str(people.find(p => p.id === m.person_id)?.title ?? null),
            avatarUrl: avatarById.get(m.person_id) ?? null,
            positionLabel: TEAM_POSITION_LABEL[(m as { position?: string }).position ?? 'member'] ?? 'Member',
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        tools: level >= 2
          ? (toolLists.get(t.id) ?? []).map(g => ({
              label: toolLabel.get(g.toolKey) ?? g.toolKey,
              audience: g.audience,
            }))
          : null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    const showTeams = level >= 2 && access.can('d-teams')
    return (
      <div className="space-y-6">
        <Breadcrumb self="/directory" />
        <RestrictedDirectory people={dirPeople} teams={showTeams ? dirTeams : []} showTeams={showTeams} />
      </div>
    )
  }

  // Privileged only: the Rates & Costs tab data (moved here from Settings →
  // People & rates). Loaded after the restricted branch so non-admins never
  // trigger it, and only with Rates & Costs (d-rates): it carries every pay rate.
  const budget = rights.rates ? await getBudgetUsageData({ pay: true }) : null

  // Access-log rows resolved to the current person (avatar/team) for the tab.
  // Resolve each access row to a person by any key we hold, most specific
  // first: the stored person_id, then the auth profile_id (People link to auth
  // by profile_id, which is why the card's Last access already resolves), then
  // any known email. logAccess can store a null person_id/name when RLS hides
  // the people table from the signed-in user at insert time, so we re-resolve
  // here, where the page reads as admin and sees everyone.
  const pvById = new Map(peopleView.map(pv => [pv.id, pv]))
  const pvByProfile = new Map(peopleView.filter(pv => pv.accountId).map(pv => [pv.accountId as string, pv]))
  const accessLog: AccessLogEntry[] = accessRows.map(r => {
    const pv = (r.person_id ? pvById.get(r.person_id) : undefined)
      ?? (r.profile_id ? pvByProfile.get(r.profile_id) : undefined)
      // By email through the rows read above, not the list: the list carries
      // emails only with the Emails item.
      ?? (r.email ? pvById.get(personIdByEmail.get(r.email.toLowerCase()) ?? '') : undefined)
    return {
      id: r.id,
      personId: pv?.id ?? r.person_id,
      name: pv?.full_name ?? r.name ?? r.email ?? '(unknown)',
      email: r.email ?? (pv?.accountId ? emailByProfile.get(pv.accountId) : null) ?? '',
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
        teamCards={access.can('d-teams') ? teamCards : []}
        rights={rights}
        // Active people only: someone who left is in People, Inactive, with their rates on their own page (owner, 28 October 2026).
        ratesPeople={(budget?.people ?? []).filter(p => !p.inactive)}
        ratesClients={(budget?.clients ?? []).map(c => ({ id: c.id, name: c.name }))}
        accessLog={accessLog}
        allowed={([['emails', 'd-emails'], ['teams', 'd-teams'], ['rates', 'd-rates'], ['access', 'd-log'], ['portal', 'd-portal']] as const)
          .filter(([, key]) => access.can(key)).map(([tab]) => tab)}
      />
    </div>
  )
}
