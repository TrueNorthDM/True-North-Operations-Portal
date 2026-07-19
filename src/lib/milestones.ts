// Employment milestones: a manual timeline of a person's career events (joined,
// promotions, role changes, etc.), stored as a jsonb array on people.milestones
// (migration 044). Generic { kind, date, note } so any event fits.

export interface PersonMilestone {
  kind: string // one of MILESTONE_KINDS
  date: string | null // ISO YYYY-MM-DD
  note: string | null
}

export const MILESTONE_KINDS = ['joined', 'joined_team', 'promoted', 'role_change', 'role_addition', 'left', 'other'] as const

export const MILESTONE_LABEL: Record<string, string> = {
  joined: 'Joined',
  joined_team: 'Joined team',
  promoted: 'Promoted',
  role_change: 'Role change',
  role_addition: 'Role addition',
  left: 'Left',
  other: 'Note',
}

export const MILESTONE_COLOR: Record<string, string> = {
  joined: '#1f8a5b', // green
  joined_team: '#1E7D7F', // teal
  promoted: '#6d5ae0', // violet
  role_change: '#e08a1e', // orange
  role_addition: '#3b82f6', // blue
  left: '#d7392f', // red
  other: '#8593a4', // slate
}

export const milestoneLabel = (kind: string) => MILESTONE_LABEL[kind] ?? 'Note'
export const milestoneColor = (kind: string) => MILESTONE_COLOR[kind] ?? '#8593a4'

/** Chronological; undated entries sink to the bottom. */
export function sortMilestones(m: PersonMilestone[]): PersonMilestone[] {
  return [...m].sort((a, b) => (a.date ?? '9999-99-99').localeCompare(b.date ?? '9999-99-99'))
}

/** All fields as plain strings for controlled form inputs. */
export interface MilestoneForm {
  kind: string
  date: string
  note: string
}

export function toMilestoneForms(m: PersonMilestone[] | null | undefined): MilestoneForm[] {
  return (m ?? []).map(x => ({ kind: x.kind || 'other', date: x.date ?? '', note: x.note ?? '' }))
}

/** Keep rows that carry a date or a note; null when nothing is entered. */
export function normalizeMilestones(forms: MilestoneForm[]): PersonMilestone[] | null {
  const out = forms
    .filter(f => f.date.trim() || f.note.trim())
    .map(f => ({ kind: f.kind || 'other', date: f.date.trim() || null, note: f.note.trim() || null }))
  return out.length ? out : null
}
