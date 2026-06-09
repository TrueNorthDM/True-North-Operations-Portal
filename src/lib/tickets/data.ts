/**
 * tickets/data.ts — the dev work tracker (admin-only page at /admin/tickets).
 *
 * Code-based on purpose: Claude maintains this file directly — adds a ticket
 * whenever new work comes up, and flips it to `done` (with the commit) when it
 * lands. That only works if the data lives in the repo, not the DB. Versioned
 * with the code, no migration needed.
 *
 * Convention: codes are TN-NNN, monotonic. Next free code: TN-016.
 */

export type TicketType = 'task' | 'bug' | 'feature' | 'chore' | 'idea'
export type TicketStatus = 'backlog' | 'in_progress' | 'blocked' | 'done' | 'wont_do'
export type TicketPriority = 'high' | 'medium' | 'low'

export interface Ticket {
  code: string //          TN-001
  type: TicketType
  title: string
  description?: string
  status: TicketStatus
  priority: TicketPriority
  area: string //          grouping, e.g. "RBAC", "Org Chart", "Hreflang"
  createdAt: string //     ISO date
  doneAt?: string //       ISO date when it landed
  commit?: string //       short commit hash where it landed
  notes?: string
}

export const TYPE_META: Record<TicketType, { label: string; cls: string }> = {
  task: { label: 'Task', cls: 'bg-slate-100 text-slate-600' },
  bug: { label: 'Bug', cls: 'bg-red-100 text-red-700' },
  feature: { label: 'Feature', cls: 'bg-indigo-100 text-indigo-700' },
  chore: { label: 'Chore', cls: 'bg-stone-100 text-stone-600' },
  idea: { label: 'Idea', cls: 'bg-amber-100 text-amber-700' },
}

export const STATUS_META: Record<TicketStatus, { label: string; dot: string; cls: string }> = {
  backlog: { label: 'Backlog', dot: 'bg-slate-400', cls: 'bg-slate-100 text-slate-600' },
  in_progress: { label: 'In progress', dot: 'bg-amber-500', cls: 'bg-amber-100 text-amber-700' },
  blocked: { label: 'Blocked', dot: 'bg-red-500', cls: 'bg-red-100 text-red-700' },
  done: { label: 'Done', dot: 'bg-green-500', cls: 'bg-green-100 text-green-700' },
  wont_do: { label: 'Won’t do', dot: 'bg-slate-300', cls: 'bg-slate-100 text-slate-400' },
}

export const PRIORITY_META: Record<TicketPriority, { label: string; cls: string }> = {
  high: { label: 'High', cls: 'text-red-600' },
  medium: { label: 'Medium', cls: 'text-amber-600' },
  low: { label: 'Low', cls: 'text-slate-400' },
}

// Order statuses are surfaced in (active work first, archive last).
export const STATUS_ORDER: TicketStatus[] = ['in_progress', 'blocked', 'backlog', 'done', 'wont_do']

export const TICKETS: Ticket[] = [
  // ── Open ──────────────────────────────────────────────────────────────────
  {
    code: 'TN-001',
    type: 'task',
    title: 'Apply migration 014 (People & Teams directory + access grants) in Supabase',
    description:
      'F1 schema: people, teams, team_members, grants + RLS. Run 014_directory_and_access.sql in the portal Supabase SQL Editor. Foundation for the org chart and RBAC.',
    status: 'done',
    priority: 'high',
    area: 'RBAC',
    createdAt: '2026-06-09',
    doneAt: '2026-06-09',
    notes: 'Applied by Arnaldo in Supabase (014 + 015 seed).',
  },
  {
    code: 'TN-002',
    type: 'task',
    title: 'Seed the directory from the company org chart',
    description: 'Migration 015: 33 people, titles, teams and (best-guess) reporting lines seeded into people/teams/team_members so the chart starts populated.',
    status: 'done',
    priority: 'high',
    area: 'Org Chart',
    createdAt: '2026-06-09',
    doneAt: '2026-06-09',
    notes: 'Written; applied as part of TN-001 (run after 014).',
  },
  {
    code: 'TN-003',
    type: 'feature',
    title: 'Company org chart on Home (auto-layout, read-only)',
    description: 'People + teams + manager_id rendered as an auto-laid-out pure-CSS connector tree, pinned to the home page. Everyone sees it; admins will edit (F2).',
    status: 'done',
    priority: 'high',
    area: 'Org Chart',
    createdAt: '2026-06-09',
    doneAt: '2026-06-09',
    notes: 'Shows once 014 + 015 are applied and deployed.',
  },
  {
    code: 'TN-004',
    type: 'feature',
    title: 'Admin → People editor (F2a)',
    description: 'Add/edit/remove people; set title, manager (reporting line) and status. Edits revalidate the home org chart. Unblocks fixing the seeded reporting lines (TN-014).',
    status: 'done',
    priority: 'medium',
    area: 'RBAC',
    createdAt: '2026-06-09',
    doneAt: '2026-06-09',
  },
  {
    code: 'TN-015',
    type: 'feature',
    title: 'Admin → Teams editor (F2b): members + project grants',
    description: 'Team list + detail (members add/remove, project access with role). The core "who can access what" screen. Writes team_members + grants.',
    status: 'done',
    priority: 'medium',
    area: 'RBAC',
    createdAt: '2026-06-09',
    doneAt: '2026-06-09',
  },
  {
    code: 'TN-005',
    type: 'feature',
    title: 'Access matrix + per-project "Manage access" (F3)',
    description: 'Read-mostly Teams × Projects matrix for auditing, plus a contextual "Manage access" affordance on each project.',
    status: 'backlog',
    priority: 'medium',
    area: 'RBAC',
    createdAt: '2026-06-09',
  },
  {
    code: 'TN-006',
    type: 'feature',
    title: 'Enforce access in sidebar/hubs by grants (F4)',
    description: 'Filter projects/tools/dashboards by the signed-in user’s grants; super-admin sees all.',
    status: 'backlog',
    priority: 'medium',
    area: 'RBAC',
    createdAt: '2026-06-09',
  },
  {
    code: 'TN-007',
    type: 'task',
    title: 'Custom SMTP (Resend) for production login',
    description: 'Supabase built-in email hits a ~4/hour rate limit, blocking real logins. Configure Resend SMTP in Supabase → Auth → SMTP.',
    status: 'backlog',
    priority: 'medium',
    area: 'Auth',
    createdAt: '2026-06-09',
  },
  {
    code: 'TN-008',
    type: 'chore',
    title: 'Raise nightly ingest window 365 → 730 days',
    description: 'Arnaldo is Vercel Pro (maxDuration 300s); bump INGEST_DAYS for a true 2-year rolling window in the dashboards.',
    status: 'backlog',
    priority: 'low',
    area: 'Dashboards',
    createdAt: '2026-06-09',
  },
  {
    code: 'TN-009',
    type: 'task',
    title: 'Verify /boards-beta visually (B1–B5)',
    description: 'The React rewrite of Boards Review (Goals, Translation, Targets) passed tsc/eslint but was never run. Verify on the live deploy before any cutover.',
    status: 'backlog',
    priority: 'medium',
    area: 'Dashboards',
    createdAt: '2026-06-09',
  },
  {
    code: 'TN-010',
    type: 'task',
    title: 'B6 cutover: retire boards.html, /boards-beta becomes Boards Review',
    description: 'Remove the legacy static dashboard once the React version is verified; only do the destructive step after TN-009.',
    status: 'blocked',
    priority: 'low',
    area: 'Dashboards',
    createdAt: '2026-06-09',
    notes: 'Blocked by TN-009 (visual verification).',
  },

  {
    code: 'TN-014',
    type: 'task',
    title: 'Refine org chart reporting lines + verify on deploy',
    description: 'After 014/015 are applied: check the org chart renders, then correct the best-guess manager lines (who reports to whom) — easiest once the People editor (F2) exists, or directly in SQL.',
    status: 'backlog',
    priority: 'low',
    area: 'Org Chart',
    createdAt: '2026-06-09',
  },

  // ── Done ──────────────────────────────────────────────────────────────────
  {
    code: 'TN-011',
    type: 'feature',
    title: 'F0 — reshape IA into Dashboards / Projects / Tools / Admin',
    status: 'done',
    priority: 'high',
    area: 'Navigation',
    createdAt: '2026-06-09',
    doneAt: '2026-06-09',
    commit: '3aef995',
  },
  {
    code: 'TN-012',
    type: 'task',
    title: 'Unify page background + make framed COE dashboard fill the shell',
    status: 'done',
    priority: 'medium',
    area: 'UI',
    createdAt: '2026-06-09',
    doneAt: '2026-06-09',
    commit: '0bbcac8',
  },
  {
    code: 'TN-013',
    type: 'bug',
    title: 'Done pages stuck in On-going — backfill confirmed_done_at (migration 013)',
    status: 'done',
    priority: 'high',
    area: 'Hreflang',
    createdAt: '2026-06-09',
    doneAt: '2026-06-09',
    notes: 'On-going HFA 21→12; the 3 lingering Run Link pages were deleted manually.',
  },
]
