// Shared view-model types + helpers for the People directory: the row shapes the
// server builds, and the pill/label helpers the screens render them with.
//
// Lives in lib because lib modules (access/resolve, directory/my-team,
// directory/people-view, hr/celebrations) need it, and lib must not reach up
// into components. Plain module (no 'use client'), so server pages and client
// components both import it.

import { isLeadPosition } from '@/lib/access/catalogue'

/** The company mailboxes. The personal address is on the person's own page. */
export interface PersonEmails {
  trueNorth: string | null
  goodnews: string | null
  coe: string | null
}

/** One of a person's team memberships + their POSITION in that team (migration
 *  040). A person can lead one team and be a collaborator in another. */
export interface PersonTeam {
  teamId: string
  teamName: string | null
  teamKey: TeamKey
  /** See PersonView.color. */
  color: string
  position: string // 'founder' | 'manager' | 'team_leader' | 'collaborator'
  primary: boolean // the person's main department (migration 048)
}

/**
 * What the viewer of a person's card may see and do beyond the card itself,
 * from Admin > Access levels. The page leaves out what is false, so the data
 * never reaches the browser; these flags only shape the screen around it.
 */
export interface CardRights {
  /** d-rates: the internal rate. */
  rates: boolean
  /** d-log: the last access. */
  accessLog: boolean
  /** d-portal or d-invite: portal access and the two-step state. */
  portal: boolean
  /** d-invite: invite, send again, revoke. */
  invite: boolean
  /** d-2fa: reset someone's two-step sign-in. */
  resetTwoStep: boolean
  /** d-edit: add and remove people. */
  edit: boolean
  /** d-positions: teams and who is on them, who leads them (Super Admin only). */
  positions: boolean
  /** p-work: type, schedule and joined date on the list (only for the pages it opens). */
  work: boolean
}

/** The card rights a person's access gives them (the Directory and Human Resources). */
export function cardRights(can: (key: string) => boolean): CardRights {
  return {
    rates: can('d-rates'),
    accessLog: can('d-log'),
    portal: can('d-portal') || can('d-invite'),
    invite: can('d-invite'),
    resetTwoStep: can('d-2fa'),
    edit: can('d-edit'),
    positions: can('d-positions'),
    work: can('p-work'),
  }
}

/**
 * One row of the Directory's full list (directory/page.tsx), and only what its
 * tabs show. Everything else about a person (personal data, HR, history,
 * milestones) is on their own page, read per tab by Access levels
 * (lib/directory/person-page-data.ts), so it has no field here to fill by
 * mistake. Emails and the Work columns are null unless their item is open.
 */
export interface PersonView {
  id: string
  full_name: string
  avatarUrl: string | null // profile photo (public URL)
  title: string | null // job title

  // Primary team (lib/directory/primary-team), drives the badge, filter and group.
  teamId: string | null
  teamName: string | null
  teamKey: TeamKey
  /**
   * The avatar colour, resolved once from teams.color with the key map as the
   * fallback. A field rather than a lookup, because thirteen components each
   * looking it up their own way is how the same person came out three
   * different colours on three screens.
   */
  color: string
  // All memberships with per-team position (Team Position, distinct from access).
  teams: PersonTeam[]

  // Reporting
  manager_id: string | null
  managerName: string | null
  alsoReportsToId: string | null
  alsoReportsToName: string | null

  // Employment (Work tab item)
  employmentType: string | null // 'us' | 'contractor'
  schedule: string | null // 'full' | 'part'
  weeklyHours: number | null
  hireDate: string | null
  roleType: string // access level: 'super_admin'|'admin'|'team_leader'|'user' (people.role_type mirrors it)
  status: 'active' | 'inactive'

  // Emails + account
  emails: PersonEmails
  accountId: string | null
  accountEmail: string | null
  hasTsheets: boolean
  lastAccessAt: string | null // most recent portal access (from access_log)
  portalInvitedAt: string | null // invited to the portal (migration 089); null = cannot sign in
  twoStepSince?: string | null // two-step sign-in set up since (p4-2fa); null = not yet; absent = not loaded
}

export interface Account {
  id: string
  email: string
}

// ── Team colour system ──────────────────────────────────────────────────────
// The app's teams are dynamic, so we key colours off the team name (SEO / Writing
// / Web / Leadership) with a neutral fallback for anything else.
export type TeamKey = 'seo' | 'writing' | 'web' | 'lead' | 'other'

export const TEAM_COLOR: Record<TeamKey, string> = {
  seo: '#1E7D7F', // teal
  writing: '#e08a1e', // orange
  web: '#6d5ae0', // purple
  lead: '#012358', // navy
  other: '#8593a4', // slate
}

export function teamKeyFromName(name: string | null | undefined): TeamKey {
  const n = (name ?? '').toLowerCase()
  if (n.includes('seo')) return 'seo'
  if (n.includes('writ')) return 'writing'
  if (n.includes('web')) return 'web'
  if (n.includes('lead')) return 'lead'
  return 'other'
}

/** ISO date (YYYY-MM-DD) → "Sep 4, 1982". UTC-parsed to avoid tz day-shift. */
export function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

// ── Label pills (theme-aware via the shared --bdg-* badge palette) ──────────
export type PillKind = 'green' | 'amber' | 'pink' | 'red' | 'blue' | 'teal' | 'grey' | 'violet'

export const PILL_CLASS: Record<PillKind, string> = {
  green: 'text-[var(--bdg-green-fg)] bg-[var(--bdg-green-bg)]',
  amber: 'text-[var(--bdg-gold-fg)] bg-[var(--bdg-gold-bg)]',
  pink: 'text-rose-700 bg-rose-100',
  red: 'text-[var(--bdg-red-fg)] bg-[var(--bdg-red-bg)]',
  blue: 'text-blue-700 bg-blue-50',
  teal: 'text-tn-teal bg-tn-teal-soft',
  grey: 'text-[var(--bdg-slate-fg)] bg-[var(--bdg-slate-bg)]',
  violet: 'text-[var(--bdg-purple-fg)] bg-[var(--bdg-purple-bg)]',
}

export interface Pill { kind: PillKind; label: string }

export const typePill = (v: string | null): Pill | null =>
  v == null ? null : v === 'contractor' ? { kind: 'teal', label: 'Contractor' } : { kind: 'blue', label: 'US Employee' }
export const timePill = (v: string | null): Pill | null =>
  v == null ? null : v === 'part' ? { kind: 'pink', label: 'Part-Time' } : { kind: 'blue', label: 'Full-Time' }
export const statusPill = (active: boolean): Pill => (active ? { kind: 'green', label: 'Active' } : { kind: 'grey', label: 'Inactive' })
export const ynPill = (v: string | null): Pill | null => {
  if (v === 'yes') return { kind: 'green', label: 'Yes' }
  if (v === 'no') return { kind: 'amber', label: 'No' }
  if (v === 'sometimes') return { kind: 'pink', label: 'Sometimes' }
  if (v === 'notyet') return { kind: 'red', label: 'Not yet' }
  return null
}

// Onboarding / Offboarding lifecycle status (migration 043).
export const LIFECYCLE_OPTIONS = ['not_started', 'in_progress', 'completed'] as const
export const LIFECYCLE_LABEL: Record<string, string> = {
  not_started: 'Not started', in_progress: 'In progress', completed: 'Completed',
}
export const lifecyclePill = (v: string | null): Pill => {
  if (v === 'completed') return { kind: 'green', label: 'Completed' }
  if (v === 'in_progress') return { kind: 'amber', label: 'In progress' }
  return { kind: 'grey', label: 'Not started' }
}

// The access level (people.role_type mirrors it since 7 October 2026): Super
// Admin and Admin are given on Admin > Access levels; Team Leader and User
// follow team positions. Shown as "Access level" on cards and lists.
export const ROLE_TYPE_OPTIONS = ['super_admin', 'admin', 'team_leader', 'user'] as const
export const ROLE_TYPE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin', admin: 'Admin', team_leader: 'Team Leader', user: 'User',
}
export const roleTypePill = (v: string): Pill => {
  if (v === 'super_admin') return { kind: 'violet', label: 'Super Admin' }
  if (v === 'admin') return { kind: 'blue', label: 'Admin' }
  if (v === 'team_leader') return { kind: 'amber', label: 'Team Leader' }
  return { kind: 'grey', label: 'User' }
}

// Team position (7 October 2026): Lead or Member of a team. Being Lead of any
// team makes someone a Team Leader. Whether a position leads is answered in
// one place, isLeadPosition (access/catalogue.ts); everything here reads it.
export const TEAM_POSITION_OPTIONS = ['lead', 'member'] as const
export const normalPosition = (v: string | null | undefined): 'lead' | 'member' =>
  isLeadPosition(v) ? 'lead' : 'member'
export const TEAM_POSITION_LABEL: Record<string, string> = {
  lead: 'Lead', member: 'Member', founder: 'Lead', manager: 'Lead', team_leader: 'Lead', collaborator: 'Member',
}
export const teamPositionPill = (v: string): Pill =>
  normalPosition(v) === 'lead' ? { kind: 'teal', label: 'Lead' } : { kind: 'grey', label: 'Member' }
// Order within a team's member list: Leads first.
export const teamPositionRank = (v: string): number => (normalPosition(v) === 'lead' ? 0 : 1)
// Whether the position leads the team (Team Leader level, org-chart colour, "Leads only" tools).
export const teamPositionLeads = (v: string): boolean => isLeadPosition(v)

// Access-grant roles, the product vocabulary from the design (migration 030).
// Legacy keys (admin/member) are mapped too, so grants still read correctly in
// the brief window before migration 030 is applied.
export const ROLE_PILL: Record<string, string> = {
  manager: 'text-tn-primary bg-slate-100',
  publisher: 'text-tn-teal bg-tn-teal-soft',
  editor: 'text-[var(--bdg-purple-fg)] bg-[var(--bdg-purple-bg)]',
  viewer: 'text-[var(--bdg-slate-fg)] bg-[var(--bdg-slate-bg)]',
  admin: 'text-tn-primary bg-slate-100', // legacy → manager
  member: 'text-[var(--bdg-purple-fg)] bg-[var(--bdg-purple-bg)]', // legacy → editor
}
export const ROLE_LABEL: Record<string, string> = {
  manager: 'Manager',
  publisher: 'Publisher',
  editor: 'Editor',
  viewer: 'Viewer',
  admin: 'Manager', // legacy
  member: 'Editor', // legacy
}

/** Two-letter initials from a full name (first + last word). */
export function initialsOf(fullName: string | null | undefined): string {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
