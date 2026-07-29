// Admin → Directory. The single surface for People · Emails · Teams · Access,
// all controlled from one page. Gated to admins.

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isCurrentUserAdmin } from '@/lib/auth/role'
import { DirectoryTabs } from '@/components/admin/DirectoryTabs'
import type { AccessLogEntry } from '@/components/admin/AccessLogManager'
import { RestrictedDirectory, type RestrictedPerson } from '@/components/admin/RestrictedDirectory'
import { teamKeyFromName, TEAM_COLOR, initialsOf, teamPositionRank, teamPositionLeads, type PersonView, type PersonAttachment, type PersonTeam, type TeamKey } from '@/components/admin/people-types'
import type { PersonAddress } from '@/lib/address'
import type { PersonMilestone } from '@/lib/milestones'
import type { TeamCard } from '@/components/admin/TeamsManager'
import type { ToolAudience } from '@/lib/access/tools'
import { loadCurrentPerson } from '@/lib/directory/current-person'
import { tierOf } from '@/lib/auth/tier'
import { getBudgetUsageData } from '@/lib/tsheets/budget-usage-data'
import type { GrantRole } from '@/app/(app)/admin/teams/actions'

// Full people select (needs migration 029). Falls back to base columns if the
// migration hasn't run yet, so the page never 500s on a pre-migration deploy.
const PEOPLE_FULL =
  'id, full_name, last_name, title, manager_id, status, profile_id, tsheets_user_id, ' +
  'employment_type, schedule, weekly_hours, internal_rate, reports_to_manager, also_reports_to_id, manager_name_text, ' +
  'email_true_north, email_goodnews, email_coe, email_personal, phone, location, whatsapp_same_number, ' +
  'date_of_birth, hire_date, left_on, employment_history'
const PEOPLE_BASE = 'id, full_name, title, manager_id, status, profile_id, tsheets_user_id'

const LOGO_BY_CODE: Record<string, string> = { aaaf: '/logos/aaaf.jpg', hfa: '/logos/hfa.png' }

/** Loosely-typed people row, columns depend on whether migration 029 ran. */
type PRow = Record<string, unknown> & { id: string; full_name: string }

export default async function DirectoryPage({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  // ?open=<personId>, deep-link a person's card open (e.g. from Human Resources).
  const openId = (await searchParams).open ?? null
  // Directory is open to everyone now (Part 4); the tier decides the view,
  // privileged get the full admin tabs, everyone else the read-only list below.
  const [isAdmin, mePerson] = await Promise.all([isCurrentUserAdmin(), loadCurrentPerson(supabase, user)])
  const tier = tierOf(isAdmin ? 'admin' : (mePerson?.roleType ?? 'user'))

  // People with graceful degradation, then the rest in parallel.
  let pRes = await supabase.from('people').select(PEOPLE_FULL)
  if (pRes.error) pRes = await supabase.from('people').select(PEOPLE_BASE)

  const [{ data: tData }, { data: gData }, { data: sData }, { data: prData }, aRes, dRes, ttRes, addrRes, lcRes, msRes, alRes] = await Promise.all([
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
    // Isolated + graceful: address (042) may not exist yet.
    supabase.from('people').select('id, address'),
    // Isolated + graceful: onboarding/offboarding status (043).
    supabase.from('people').select('id, onboarding_status, offboarding_status'),
    // Isolated + graceful: milestones (044).
    supabase.from('people').select('id, milestones'),
    // Access log (045), admin-readable; graceful if the table isn't there yet.
    supabase.from('access_log').select('id, profile_id, person_id, name, email, user_agent, accessed_at').order('accessed_at', { ascending: false }).limit(1000),
  ])

  const people = (pRes.data ?? []) as unknown as PRow[]
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

  // Per-person memberships with position (drives the People modal's teams editor)
  // and the set of teams each person LEADS (position=team_leader) for the tier.
  const teamsByPerson = new Map<string, PersonTeam[]>()
  const leadTeamIdsByPerson = new Map<string, Set<string>>()
  for (const m of members) {
    const t = teamById.get(m.team_id)
    if (t) {
      const arr = teamsByPerson.get(m.person_id) ?? []
      arr.push({ teamId: t.id, teamName: t.name, teamKey: teamKeyFromName(t.name), position: m.position, primary: m.is_primary })
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
    .map(t => ({ id: t.id, name: t.name, key: teamKeyFromName(t.name), color: t.color ?? TEAM_COLOR[teamKeyFromName(t.name)] }))
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
        color: t.color ?? TEAM_COLOR[key],
        memberCount: mem.length,
        members: mem,
        access: (grantsByTeam.get(t.id) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
        tools: toolsByTeam.get(t.id) ?? [],
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  // ── Non-privileged tiers: read-only, scoped list (Part 4) ──
  // The list is visible to all; only self (user) or self + reports/led-team
  // members (lead) carry a detail block, and comp/HR is never sent for anyone.
  if (!tier.isPrivileged) {
    const viewerId = mePerson?.id ?? null
    const scope = new Set<string>()
    if (viewerId) {
      scope.add(viewerId)
      if (tier.isLead) {
        for (const p of people) {
          if (str(p.manager_id) === viewerId || str(p.also_reports_to_id) === viewerId) scope.add(p.id)
        }
        const myTeamIds = leadTeamIdsByPerson.get(viewerId) ?? new Set<string>()
        for (const m of members) if (myTeamIds.has(m.team_id)) scope.add(m.person_id)
      }
    }
    const dirPeople: RestrictedPerson[] = people
      .filter(p => p.status !== 'inactive')
      .map((p): RestrictedPerson => {
        const pt = primaryTeam(p.id)
        const mgrId = str(p.manager_id)
        return {
          id: p.id,
          name: p.full_name,
          title: str(p.title),
          teamName: pt?.name ?? null,
          teamKey: teamKeyFromName(pt?.name),
          avatarUrl: avatarById.get(p.id) ?? null,
          roleType: roleTypeById.get(p.id) ?? 'user',
          status: (p.status === 'inactive' ? 'inactive' : 'active') as 'active' | 'inactive',
          detail: scope.has(p.id)
            ? {
                managerName: mgrId ? nameById.get(mgrId) ?? null : null,
                workEmail: str(p.email_true_north) ?? str(p.email_goodnews) ?? str(p.email_coe),
                phone: str(p.phone),
                location: str(p.location),
                hireDate: str(p.hire_date),
                employmentType: str(p.employment_type),
              }
            : null,
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-[13px] text-muted">
          <Link href="/" className="font-semibold hover:text-tn-ink">Dashboard</Link>
          <span className="text-slate-300">/</span>
          <span className="font-semibold text-tn-ink">People</span>
        </div>
        <RestrictedDirectory people={dirPeople} isLead={tier.isLead} />
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
      avatarUrl: pv?.avatarUrl ?? null,
      teamKey: (pv?.teamKey ?? 'other') as TeamKey,
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-[13px] text-muted">
        <Link href="/" className="font-semibold hover:text-tn-ink">Dashboard</Link>
        <span className="text-slate-300">/</span>
        <span className="font-semibold text-tn-ink">People, Teams and Permissions</span>
      </div>

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
