/**
 * The data behind a person's page (8 October 2026), read with the privileged
 * client after page-rights.ts has decided what the viewer opens. A tab that is
 * closed to the viewer is not read at all, so nothing of it can reach the
 * browser: the header carries only what every open tab already shows.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { isLeadPosition } from '@/lib/access/catalogue'
import { loadContactByPerson } from '@/lib/hr/contact'
import { loadTwoStepByAccount } from '@/lib/auth/two-step'
import { loadSettings } from '@/lib/settings/person'
import { colourOf, teamColoursFrom } from '@/lib/directory/team-colour'
import { normalPosition } from '@/lib/directory/people-types'
import { teamTie, TIE_RANK, type TeamTie } from '@/lib/directory/team-of'
import { formatPhone } from '@/lib/phone'
import { formatTenure, milestoneOf, tenureSince, type Milestone, type Tenure } from '@/lib/tenure'
import type { PersonAddress } from '@/lib/address'
import type { PersonMilestone } from '@/lib/milestones'
import { pageRights, personHref, relationTo, type PageRights } from './page-rights'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = SupabaseClient<any, any, any>

/** Everyone on the teams this person leads (the person included). */
export async function loadLedMemberIds(db: Client, personId: string | null): Promise<Set<string>> {
  if (!personId) return new Set()
  const { data: mine } = await db.from('team_members').select('team_id, position').eq('person_id', personId)
  const led = ((mine ?? []) as { team_id: string; position: string | null }[]).filter(m => isLeadPosition(m.position)).map(m => m.team_id)
  if (!led.length) return new Set()
  const { data: members } = await db.from('team_members').select('person_id').in('team_id', led)
  return new Set(((members ?? []) as { person_id: string }[]).map(m => m.person_id))
}

export interface PageTeam { teamId: string; teamName: string; color: string; position: 'lead' | 'member'; primary: boolean }

export interface PersonPageData {
  id: string
  name: string
  title: string | null
  avatarUrl: string | null
  color: string
  active: boolean
  rights: PageRights
  cover: {
    teams: PageTeam[]
    hireDate: string | null
    tenure: { text: string; milestone: Milestone; next: string | null } | null
    /** Personal: only when the viewer opens it. */
    location: string | null
    localTime: string | null
    /** Someone else's page only: the GoodNews address (Work) and WhatsApp (Personal). */
    email: string | null
    whatsapp: string | null
  }
  personal: null | {
    lastName: string | null
    personalEmail: string | null
    phone: string | null
    whatsappSame: string | null
    dateOfBirth: string | null
    location: string | null
    address: PersonAddress | null
  }
  work: null | {
    fullName: string
    title: string | null
    employmentType: string | null
    schedule: string | null
    weeklyHours: number | null
    status: 'active' | 'inactive'
    accessLevel: string
    emails: { trueNorth: string | null; goodnews: string | null; coe: string | null }
    teams: PageTeam[]
    managerId: string | null
    managerName: string | null
    alsoReportsToId: string | null
    alsoReportsToName: string | null
    hireDate: string | null
    leftOn: string | null
    milestones: PersonMilestone[]
    history: string | null
  }
  hr: null | {
    onboarding: string | null
    offboarding: string | null
    invitedAt: string | null
    hasAccount: boolean
    goodnews: string | null
    /** Undefined before two-step sign-in exists (migration 090). */
    twoStepSince: string | null | undefined
    lastAccessAt: string | null
    lastAccessAgent: string | null
    hasTsheets: boolean
  }
  reports: null | { id: string; name: string; title: string | null; color: string; via: TeamTie; teamName: string | null; href: string | null }[]
  /** For the Work editor only. */
  options: null | { people: { value: string; label: string }[]; teams: { id: string; name: string }[] }
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)

/** The next service milestone, as the cover's medal says it. */
export function nextMilestone(t: Tenure | null): string | null {
  if (!t) return null
  const months = t.years * 12 + t.months
  const target = months < 12 ? (Math.floor(months / 3) + 1) * 3 : (t.years + 1) * 12
  const left = target - months - (t.days > 0 ? 1 : 0)
  const name = target < 12 ? `${target} months` : target === 12 ? '1 year' : `${target / 12} years`
  if (left <= 0) return `Next: ${name} this month`
  return `Next: ${name} in ${left} ${left === 1 ? 'month' : 'months'}`
}

/**
 * The page for one person as one viewer opens it, or null when it does not
 * open to them. `viewer` is the access the page renders with (a View Stage
 * preview included); `ledByViewer` the people on the teams the viewer leads.
 */
export async function loadPersonPage(
  db: Client,
  personId: string,
  viewer: { personId: string | null; can: (key: string) => boolean },
  ledByViewer: ReadonlySet<string>,
): Promise<PersonPageData | null> {
  const rights = pageRights(viewer.can, relationTo(viewer.personId, personId, ledByViewer))
  if (!rights) return null

  const { data: row } = await db.from('people')
    .select('id, full_name, last_name, title, avatar_url, status, hire_date, left_on, location, whatsapp_same_number, employment_type, schedule, weekly_hours, role_type, email_true_north, email_goodnews, email_coe, manager_id, also_reports_to_id, employment_history, milestones, onboarding_status, offboarding_status, profile_id, tsheets_user_id, portal_invited_at')
    .eq('id', personId).maybeSingle()
  if (!row) return null
  const p = row as Record<string, unknown> & { id: string; full_name: string }

  const [{ data: allTeams }, { data: myMembers }] = await Promise.all([
    db.from('teams').select('id, name, color'),
    db.from('team_members').select('team_id, position, is_primary').eq('person_id', personId),
  ])
  const teamRows = (allTeams ?? []) as { id: string; name: string; color: string | null }[]
  const palette = teamColoursFrom(teamRows)
  const teamName = new Map(teamRows.map(t => [t.id, t.name]))
  const teams: PageTeam[] = ((myMembers ?? []) as { team_id: string; position: string | null; is_primary: boolean | null }[])
    .filter(m => teamName.has(m.team_id))
    .map(m => ({
      teamId: m.team_id, teamName: teamName.get(m.team_id)!, color: colourOf(palette, teamName.get(m.team_id)),
      position: (normalPosition(m.position) === 'lead' ? 'lead' : 'member') as 'lead' | 'member', primary: m.is_primary === true,
    }))
    .sort((a, b) => Number(b.primary) - Number(a.primary) || Number(b.position === 'lead') - Number(a.position === 'lead') || a.teamName.localeCompare(b.teamName))
  const color = teams[0]?.color ?? colourOf(palette, null)

  const tenure = tenureSince(str(p.hire_date), str(p.left_on) ? new Date(`${p.left_on}T12:00:00Z`) : new Date())

  // Personal: the person's own, or with p-personal.
  let personal: PersonPageData['personal'] = null
  let localTime: string | null = null
  if (rights.personal) {
    const contact = (await loadContactByPerson([personId])).get(personId)
    personal = {
      lastName: str(p.last_name), personalEmail: contact?.emailPersonal ?? null, phone: contact?.phone ?? null,
      whatsappSame: str(p.whatsapp_same_number), dateOfBirth: contact?.dateOfBirth ?? null,
      location: str(p.location), address: contact?.address ?? null,
    }
    // Their local time: only from a zone they chose themselves.
    const settings = await loadSettings(db, personId).catch(() => null)
    if (settings?.ownZone) {
      try { localTime = new Intl.DateTimeFormat('en-US', { timeZone: settings.timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date()) } catch { localTime = null }
    }
  }

  // Work: the person's own, or with p-work.
  let work: PersonPageData['work'] = null
  if (rights.work) {
    const ids = [str(p.manager_id), str(p.also_reports_to_id)].filter((x): x is string => !!x)
    const { data: names } = ids.length ? await db.from('people').select('id, full_name').in('id', ids) : { data: [] }
    const nameOf = new Map(((names ?? []) as { id: string; full_name: string }[]).map(n => [n.id, n.full_name]))
    work = {
      fullName: p.full_name, title: str(p.title), employmentType: str(p.employment_type), schedule: str(p.schedule),
      weeklyHours: p.weekly_hours == null ? null : Number(p.weekly_hours),
      status: p.status === 'inactive' ? 'inactive' : 'active',
      accessLevel: str(p.role_type) ?? 'user',
      emails: { trueNorth: str(p.email_true_north), goodnews: str(p.email_goodnews), coe: str(p.email_coe) },
      teams,
      managerId: str(p.manager_id), managerName: str(p.manager_id) ? nameOf.get(p.manager_id as string) ?? null : null,
      alsoReportsToId: str(p.also_reports_to_id), alsoReportsToName: str(p.also_reports_to_id) ? nameOf.get(p.also_reports_to_id as string) ?? null : null,
      hireDate: str(p.hire_date), leftOn: str(p.left_on),
      milestones: Array.isArray(p.milestones) ? (p.milestones as PersonMilestone[]) : [],
      history: str(p.employment_history),
    }
  }

  // HR and access: never the person's own; with p-hr.
  let hr: PersonPageData['hr'] = null
  if (rights.hr) {
    const profileId = str(p.profile_id)
    const [twoStep, { data: last }] = await Promise.all([
      loadTwoStepByAccount(),
      db.from('access_log').select('accessed_at, user_agent')
        .or(profileId ? `person_id.eq.${personId},profile_id.eq.${profileId}` : `person_id.eq.${personId}`)
        .order('accessed_at', { ascending: false }).limit(1).maybeSingle(),
    ])
    const lastRow = last as { accessed_at: string; user_agent: string | null } | null
    hr = {
      onboarding: str(p.onboarding_status), offboarding: str(p.offboarding_status),
      invitedAt: str(p.portal_invited_at), hasAccount: !!profileId, goodnews: str(p.email_goodnews),
      twoStepSince: twoStep ? (profileId ? twoStep.get(profileId) ?? null : null) : undefined,
      lastAccessAt: lastRow?.accessed_at ?? null, lastAccessAgent: lastRow?.user_agent ?? null,
      hasTsheets: p.tsheets_user_id != null,
    }
  }

  // Reports: who reports to the person, by line or by a team they lead.
  let reports: PersonPageData['reports'] = null
  if (rights.reports) {
    const ledTeamIds = new Set(teams.filter(t => t.position === 'lead').map(t => t.teamId))
    const [{ data: everyone }, { data: memberships }] = await Promise.all([
      db.from('people').select('id, full_name, title, manager_id, also_reports_to_id').or('status.is.null,status.eq.active'),
      db.from('team_members').select('person_id, team_id, is_primary'),
    ])
    const teamsOf = new Map<string, string[]>()
    const primaryOf = new Map<string, string>()
    for (const m of (memberships ?? []) as { person_id: string; team_id: string; is_primary: boolean | null }[]) {
      (teamsOf.get(m.person_id) ?? teamsOf.set(m.person_id, []).get(m.person_id)!).push(m.team_id)
      if (m.is_primary) primaryOf.set(m.person_id, m.team_id)
    }
    reports = ((everyone ?? []) as { id: string; full_name: string; title: string | null; manager_id: string | null; also_reports_to_id: string | null }[])
      .map(x => {
        const via = teamTie({ id: x.id, managerId: x.manager_id, alsoReportsToId: x.also_reports_to_id, teamIds: teamsOf.get(x.id) ?? [] }, personId, ledTeamIds)
        if (!via) return null
        const viaTeam = via === 'team' ? (teamsOf.get(x.id) ?? []).find(t => ledTeamIds.has(t)) : undefined
        const own = primaryOf.get(x.id) ?? (teamsOf.get(x.id) ?? [])[0]
        const opens = pageRights(viewer.can, relationTo(viewer.personId, x.id, ledByViewer))
        return {
          id: x.id, name: x.full_name, title: x.title, color: colourOf(palette, own ? teamName.get(own) : null),
          via, teamName: viaTeam ? teamName.get(viaTeam) ?? null : null, href: opens ? personHref(x.id) : null,
        }
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => TIE_RANK[a.via] - TIE_RANK[b.via] || a.name.localeCompare(b.name))
  }

  // The Work editor's lists.
  let options: PersonPageData['options'] = null
  if (rights.workEdit) {
    const { data: active } = await db.from('people').select('id, full_name').or('status.is.null,status.eq.active').order('full_name')
    options = {
      people: ((active ?? []) as { id: string; full_name: string }[]).filter(x => x.id !== personId).map(x => ({ value: x.id, label: x.full_name })),
      teams: rights.teamsEdit ? teamRows.map(t => ({ id: t.id, name: t.name })).sort((a, b) => a.name.localeCompare(b.name)) : [],
    }
  }

  const phone = personal?.phone ? formatPhone(personal.phone) : null
  return {
    id: personId, name: p.full_name, title: str(p.title), avatarUrl: str(p.avatar_url), color,
    active: p.status !== 'inactive', rights,
    // Teams, positions and dates are Work: the cover shows them only with it.
    cover: {
      teams: rights.work ? teams : [], hireDate: rights.work ? str(p.hire_date) : null,
      tenure: rights.work && tenure ? { text: formatTenure(tenure), milestone: milestoneOf(tenure), next: str(p.left_on) ? null : nextMilestone(tenure) } : null,
      location: personal?.location ?? null, localTime,
      email: !rights.own && rights.work ? str(p.email_goodnews) : null,
      whatsapp: !rights.own && phone?.valid ? phone.digits : null,
    },
    personal, work, hr, reports, options,
  }
}
