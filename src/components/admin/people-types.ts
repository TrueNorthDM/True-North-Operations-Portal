// Shared view-model types + helpers for the admin Directory UI (People tab,
// Emails tab, Teams cards, Access rows, and the person modal). Plain module (no
// 'use client') so both the server page and the client components can import it.

export interface PersonEmails {
  trueNorth: string | null
  goodnews: string | null
  coe: string | null
  personal: string | null
}

/** A "History" document attached to a person (private person-files bucket). */
export interface PersonAttachment {
  id: string
  fileName: string
  storagePath: string
  mime: string | null
  sizeBytes: number | null
  uploadedAt: string
}

export interface PersonView {
  id: string
  full_name: string
  lastName: string | null
  title: string | null // job title

  // Primary team (first membership) — drives avatar colour, badge, filter, group.
  teamId: string | null
  teamName: string | null
  teamKey: TeamKey

  // Reporting
  manager_id: string | null
  managerName: string | null
  managerTeamKey: TeamKey | null
  alsoReportsToId: string | null
  alsoReportsToName: string | null
  alsoReportsToTeamKey: TeamKey | null
  reportsToManager: string | null // 'yes' | 'no' | 'sometimes'
  managerNameText: string | null // free-text manager name (board question)

  // Employment
  employmentType: string | null // 'us' | 'contractor'
  schedule: string | null // 'full' | 'part'
  weeklyHours: number | null
  internalRate: number | null
  teamMeeting: boolean // "Team Meeting" checkbox (board)
  roleType: string // contact type: 'user'|'admin'|'admin_assistant'|'team_leader'
  status: 'active' | 'inactive'

  // Contact
  phone: string | null
  location: string | null
  whatsappSameNumber: string | null // 'yes' | 'no' — same number on WhatsApp?

  // Onboarding (tri-state chips)
  companyEmail: string | null // 'yes' | 'notyet'
  usesSystem: string | null // 'yes' | 'notyet' | 'no'

  // Dates (stored as ISO; formatted for display)
  dateOfBirth: string | null
  hireDate: string | null
  leftOn: string | null

  // Emails + account
  emails: PersonEmails
  accountId: string | null
  accountEmail: string | null
  hasTsheets: boolean

  history: string | null
  mondayDocs: string | null // text of the person's "History" Monday Doc
  attachments: PersonAttachment[] // "History" documents
}

export interface Account {
  id: string
  email: string
}

/** The payload the modal sends back on save. Mirrors the DB columns. */
export interface PersonDraft {
  full_name: string
  lastName: string | null
  title: string | null
  teamId: string | null
  manager_id: string | null
  alsoReportsToId: string | null
  reportsToManager: string | null
  managerNameText: string | null
  employmentType: string | null
  schedule: string | null
  weeklyHours: number | null
  internalRate: number | null
  teamMeeting: boolean
  roleType: string
  status: 'active' | 'inactive'
  phone: string | null
  location: string | null
  whatsappSameNumber: string | null
  companyEmail: string | null
  usesSystem: string | null
  dateOfBirth: string | null
  hireDate: string | null
  leftOn: string | null
  emails: PersonEmails
  hasTsheets: boolean
  history: string | null
  mondayDocs: string | null
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

// Contact type (migration 035) — a directory label, distinct from RBAC grants.
export const ROLE_TYPE_OPTIONS = ['user', 'admin', 'admin_assistant', 'team_leader'] as const
export const ROLE_TYPE_LABEL: Record<string, string> = {
  user: 'User', admin: 'Admin', admin_assistant: 'Admin Assistant', team_leader: 'Team Leader',
}
export const roleTypePill = (v: string): Pill => {
  if (v === 'admin') return { kind: 'violet', label: 'Admin' }
  if (v === 'admin_assistant') return { kind: 'blue', label: 'Admin Assistant' }
  if (v === 'team_leader') return { kind: 'amber', label: 'Team Leader' }
  return { kind: 'grey', label: 'User' }
}

// Access-grant roles — the product vocabulary from the design (migration 030).
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
