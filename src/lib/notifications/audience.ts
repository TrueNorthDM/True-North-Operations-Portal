/**
 * Who notifications can go to: everyone who can sign in to the portal, with
 * what each of them is (admin, which teams they lead, which tools they open).
 * Read once per run, with the privileged client, so a generator can ask
 * "the admins", "the leaders of this team" or "who opens Publishing Goals"
 * without a query of its own.
 *
 * Signing in is decided the way the portal decides it: an explicit account
 * link (people.profile_id), else a mailbox matching an account's email. Most
 * people who sign in every day are matched by email, so reading profile_id
 * alone would leave most of the company out.
 *
 * Admin means Super Admin or Admin. Tools, and everything else, follow the
 * access rule exactly as the person's own pages do (lib/access/decide.ts):
 * their level's ticks, the tool's team list, and their exceptions.
 */

import type { Db } from '@/lib/supabase/types'
import { teamPositionLeads } from '@/lib/directory/people-types'
import type { RoleType } from '@/lib/auth/tier'
import { allowedKeys } from '@/lib/access/decide'
import { loadRules, loadSubjects } from '@/lib/access/store'
import { zoneDate } from './schedule'
import { reaches, type NotificationType } from './catalogue'

/** One team membership: the team and the position held in it. */
interface Membership { team_id: string; position?: string | null }

type Client = Db

export interface Recipient {
  personId: string
  profileId: string
  name: string
  /** The address they sign in with: where the summary email goes. */
  email: string | null
  roleType: RoleType
  isAdmin: boolean
  /** team id -> leads it */
  teams: ReadonlyMap<string, boolean>
  canTool: (key: string) => boolean
}

export interface Audience {
  people: readonly Recipient[]
  byId: ReadonlyMap<string, Recipient>
  byProfile: ReadonlyMap<string, Recipient>
  teamName: ReadonlyMap<string, string>
  /** Every member of a team, sign-in or not: whose work a leader watches. */
  teamMembers: ReadonlyMap<string, readonly string[]>
  admins(): Recipient[]
  withTool(key: string): Recipient[]
  leadersOf(teamId: string): Recipient[]
  membersOf(teamId: string): Recipient[]
  /** The catalogue's own test: can this type ever reach this person. */
  reached(t: NotificationType, r: Recipient): boolean
}

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()

export async function loadAudience(db: Client): Promise<Audience> {
  const [{ data: peopleRows }, { data: profileRows }, { data: memberRows }, { data: teamRows }, rules, subjects] =
    await Promise.all([
      db.from('people').select('id, full_name, profile_id, status, email_true_north, email_goodnews, email_coe, email_personal'),
      db.from('profiles').select('id, email, role'),
      db.from('team_members').select('team_id, person_id, position'),
      db.from('teams').select('id, name'),
      loadRules(db),
      loadSubjects(db),
    ])
  const subjectOf = new Map(subjects.map(s => [s.id, s]))
  const today = zoneDate(new Date())

  type P = {
    id: string; full_name: string; profile_id: string | null; status: string | null
    email_true_north: string | null; email_goodnews: string | null; email_coe: string | null; email_personal: string | null
  }
  const profiles = (profileRows ?? []) as { id: string; email: string | null; role: string | null }[]
  const profileById = new Map(profiles.map(p => [p.id, p]))
  const profileByEmail = new Map(profiles.filter(p => p.email).map(p => [norm(p.email), p]))

  const members = (memberRows ?? []) as (Membership & { person_id: string })[]
  const membershipsOf = new Map<string, Membership[]>()
  const teamMembers = new Map<string, string[]>()
  for (const m of members) {
    ;(membershipsOf.get(m.person_id) ?? membershipsOf.set(m.person_id, []).get(m.person_id)!).push(m)
    ;(teamMembers.get(m.team_id) ?? teamMembers.set(m.team_id, []).get(m.team_id)!).push(m.person_id)
  }

  const people: Recipient[] = []
  for (const p of (peopleRows ?? []) as P[]) {
    if (p.status && p.status !== 'active') continue
    const profile = (p.profile_id ? profileById.get(p.profile_id) : undefined)
      ?? [p.email_true_north, p.email_goodnews, p.email_coe, p.email_personal]
        .map(e => profileByEmail.get(norm(e)))
        .find(Boolean)
    if (!profile) continue

    // The access rule decides, as for the person themselves (lib/access/decide.ts).
    const subject = subjectOf.get(p.id)
    if (!subject) continue
    const roleType: RoleType = subject.level
    const isAdmin = subject.level === 'super_admin' || subject.level === 'admin'
    const mine = membershipsOf.get(p.id) ?? []
    const open = allowedKeys(subject, rules, { today })

    people.push({
      personId: p.id,
      profileId: profile.id,
      name: p.full_name,
      email: profile.email,
      roleType,
      isAdmin,
      teams: new Map(mine.map(m => [m.team_id, teamPositionLeads(m.position ?? 'member')])),
      canTool: key => open.has(key),
    })
  }

  const byId = new Map(people.map(r => [r.personId, r]))
  return {
    people,
    byId,
    byProfile: new Map(people.map(r => [r.profileId, r])),
    teamName: new Map(((teamRows ?? []) as { id: string; name: string }[]).map(t => [t.id, t.name])),
    teamMembers,
    admins: () => people.filter(r => r.isAdmin),
    withTool: key => people.filter(r => r.canTool(key)),
    leadersOf: teamId => people.filter(r => r.teams.get(teamId) === true),
    membersOf: teamId => (teamMembers.get(teamId) ?? []).map(id => byId.get(id)).filter((r): r is Recipient => !!r),
    reached: (t, r) => reaches(t, { isAdmin: r.isAdmin, leads: [...r.teams.values()].some(Boolean), canTool: r.canTool }),
  }
}
