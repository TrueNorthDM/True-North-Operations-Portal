// Admin → Directory. The single surface for People · Emails · Teams · Access,
// all controlled from one page. Gated to admins.

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isCurrentUserAdmin } from '@/lib/auth/role'
import { DirectoryTabs } from '@/components/admin/DirectoryTabs'
import { teamKeyFromName, TEAM_COLOR, initialsOf, type PersonView, type PersonAttachment, type TeamKey } from '@/components/admin/people-types'
import type { TeamCard } from '@/components/admin/TeamsManager'
import type { AccessRow } from '@/components/admin/AccessMatrix'
import type { ToolAudience } from '@/lib/access/tools'
import type { GrantRole } from '@/app/(app)/admin/teams/actions'

// Full people select (needs migration 029). Falls back to base columns if the
// migration hasn't run yet, so the page never 500s on a pre-migration deploy.
const PEOPLE_FULL =
  'id, full_name, last_name, title, manager_id, status, profile_id, tsheets_user_id, ' +
  'employment_type, schedule, weekly_hours, internal_rate, reports_to_manager, also_reports_to_id, manager_name_text, ' +
  'email_true_north, email_goodnews, email_coe, email_personal, phone, location, whatsapp_same_number, ' +
  'company_email, uses_system, date_of_birth, hire_date, left_on, employment_history, team_meeting'
const PEOPLE_BASE = 'id, full_name, title, manager_id, status, profile_id, tsheets_user_id'

const LOGO_BY_CODE: Record<string, string> = { aaaf: '/logos/aaaf.jpg', hfa: '/logos/hfa.png' }

/** Loosely-typed people row — columns depend on whether migration 029 ran. */
type PRow = Record<string, unknown> & { id: string; full_name: string }

export default async function DirectoryPage() {
  if (!(await isCurrentUserAdmin())) redirect('/')
  const supabase = await createClient()

  // People with graceful degradation, then the rest in parallel.
  let pRes = await supabase.from('people').select(PEOPLE_FULL)
  if (pRes.error) pRes = await supabase.from('people').select(PEOPLE_BASE)

  const [{ data: tData }, { data: mData }, { data: gData }, { data: sData }, { data: prData }, aRes, dRes, ttRes] = await Promise.all([
    supabase.from('teams').select('id, name, leader_person_id'),
    supabase.from('team_members').select('team_id, person_id'),
    supabase.from('grants').select('subject_type, subject_id, project_id, role'),
    supabase.from('sites').select('id, name, code'),
    supabase.from('profiles').select('id, email'),
    supabase.from('person_attachments').select('id, person_id, file_name, storage_path, mime, size_bytes, uploaded_at'),
    // Separate + graceful: monday_docs (034) / role_type (035) / avatar_url (036)
    // may not exist yet — a failed query here must NOT drop the PEOPLE_FULL select.
    supabase.from('people').select('id, monday_docs, role_type, avatar_url'),
    // Team → tool access (037). Table may not exist yet — empty on error.
    supabase.from('team_tool_grants').select('team_id, tool_key, audience'),
  ])

  const people = (pRes.data ?? []) as unknown as PRow[]
  const teams = tData ?? []
  const members = mData ?? []
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
  function primaryTeam(personId: string): { id: string; name: string } | null {
    const ids = teamIdsByPerson.get(personId) ?? []
    const named = ids.map(id => teamById.get(id)).filter((t): t is NonNullable<typeof t> => !!t)
    named.sort((a, b) => a.name.localeCompare(b.name))
    return named[0] ? { id: named[0].id, name: named[0].name } : null
  }
  const teamKeyByPerson = new Map<string, TeamKey>()
  for (const p of people) teamKeyByPerson.set(p.id, teamKeyFromName(primaryTeam(p.id)?.name))

  // ── Accounts (for the account picker) ──
  const emailByProfile = new Map(profiles.map(pr => [pr.id, pr.email ?? '(no email)']))
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
        teamMeeting: p.team_meeting === true,
        roleType: roleTypeById.get(p.id) ?? 'user',
        status: (p.status === 'inactive' ? 'inactive' : 'active') as 'active' | 'inactive',
        phone: str(p.phone),
        location: str(p.location),
        whatsappSameNumber: str(p.whatsapp_same_number),
        companyEmail: str(p.company_email),
        usesSystem: str(p.uses_system),
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
        history: str(p.employment_history),
        mondayDocs: mondayDocsById.get(p.id) ?? null,
        attachments: attachmentsByPerson.get(p.id) ?? [],
      }
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name))

  // ── Teams (filter pills + Team select options) ──
  const teamOptions = teams
    .map(t => ({ id: t.id, name: t.name, key: teamKeyFromName(t.name), color: TEAM_COLOR[teamKeyFromName(t.name)] }))
    .sort((a, b) => a.name.localeCompare(b.name))

  // ── Team cards (members with LEAD flag + project access) ──
  const grantsByTeam = new Map<string, { projectId: string; name: string; logo: string | null; role: GrantRole }[]>()
  for (const g of grants) {
    if (g.subject_type !== 'team') continue
    const site = siteById.get(g.project_id)
    const arr = grantsByTeam.get(g.subject_id) ?? []
    arr.push({ projectId: g.project_id, name: site?.name ?? '—', logo: site ? LOGO_BY_CODE[site.code] ?? null : null, role: g.role as GrantRole })
    grantsByTeam.set(g.subject_id, arr)
  }
  const membersByTeam = new Map<string, string[]>()
  for (const m of members) {
    const arr = membersByTeam.get(m.team_id) ?? []
    arr.push(m.person_id)
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
      const memberIds = (membersByTeam.get(t.id) ?? [])
      const mem = memberIds
        .map(id => people.find(p => p.id === id))
        .filter((p): p is PRow => !!p)
        .map(p => ({
          id: p.id,
          name: p.full_name,
          initials: initialsOf(p.full_name),
          teamKey: teamKeyByPerson.get(p.id) ?? key,
          isLead: t.leader_person_id === p.id,
          roleType: roleTypeById.get(p.id) ?? 'user',
          avatarUrl: avatarById.get(p.id) ?? null,
        }))
        // Team leaders (the team's lead, then anyone typed Team Leader) at the
        // top; everyone else alphabetical.
        .sort((a, b) => {
          const rank = (m: { isLead: boolean; roleType: string }) => (m.isLead ? 0 : m.roleType === 'team_leader' ? 1 : 2)
          return rank(a) - rank(b) || a.name.localeCompare(b.name)
        })
      return {
        id: t.id,
        name: t.name,
        teamKey: key,
        color: TEAM_COLOR[key],
        memberCount: mem.length,
        members: mem,
        access: (grantsByTeam.get(t.id) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
        tools: toolsByTeam.get(t.id) ?? [],
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  // ── Access rows (one per team grant) ──
  const accessRows: AccessRow[] = grants
    .filter(g => g.subject_type === 'team')
    .map(g => ({ id: `${g.subject_id}|${g.project_id}`, teamId: g.subject_id, projectId: g.project_id, role: g.role as GrantRole }))
  const projectOptions = sites
    .map(s => ({ id: s.id, name: s.name, logo: LOGO_BY_CODE[s.code] ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name))

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
        accessRows={accessRows}
        projectOptions={projectOptions}
        availableAccounts={availableAccounts}
      />
    </div>
  )
}
