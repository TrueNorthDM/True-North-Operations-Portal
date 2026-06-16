/**
 * tickets/data.ts — the dev work tracker (admin-only page at /admin/tickets).
 *
 * Code-based on purpose: Claude maintains this file directly — adds a ticket
 * whenever new work comes up, and flips it to `done` (with the commit) when it
 * lands. That only works if the data lives in the repo, not the DB. Versioned
 * with the code, no migration needed.
 *
 * Convention: codes are TN-NNN, monotonic. Next free code: TN-026.
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
    description: 'Teams × Projects matrix at /admin/access — each cell an inline role select (none/admin/member/viewer). Plus an admin-only "Manage access" link on each project page.',
    status: 'done',
    priority: 'medium',
    area: 'RBAC',
    createdAt: '2026-06-09',
    doneAt: '2026-06-09',
  },
  {
    code: 'TN-006',
    type: 'feature',
    title: 'Enforce access by grants (F4)',
    description: 'accessible_site_ids() SECURITY DEFINER (migration 016) resolves a user’s reachable projects; /projects hub filters its cards and /aaaf,/hfa guard (redirect). Safe rule: admins → all, ungranted site → everyone, else needs a grant.',
    status: 'done',
    priority: 'medium',
    area: 'RBAC',
    createdAt: '2026-06-09',
    doneAt: '2026-06-09',
    notes: 'Migration 016 applied 2026-06-12. Zero grants today → nothing hidden yet.',
  },
  {
    code: 'TN-016',
    type: 'feature',
    title: 'Link a person to a portal account (in People editor)',
    description: 'People editor now has a "Portal account" field (links people.profile_id). Migration 017 enforces one account ↔ one person. Closes the RBAC loop — grants now resolve to real logins.',
    status: 'done',
    priority: 'medium',
    area: 'RBAC',
    createdAt: '2026-06-09',
    doneAt: '2026-06-09',
    notes: 'Migration 017 applied 2026-06-12.',
  },
  {
    code: 'TN-017',
    type: 'feature',
    title: 'Admin → System manual (auto-maintained)',
    description: 'An admin page documenting the whole system: what each page does, who can access it (RBAC), how pages interact, and how the system + each page is fed by Monday. Code-based and kept up to date by Claude as features change — like the tracker.',
    status: 'backlog',
    priority: 'medium',
    area: 'Docs',
    createdAt: '2026-06-09',
  },
  {
    code: 'TN-018',
    type: 'feature',
    title: 'Admin → Test page (auto-maintained)',
    description: 'Interactive checklist at /admin/tests covering the whole system (nav, org chart, People/Teams/Access, enforcement, projects, dashboards). Tick-offs saved per browser. Kept current by Claude as features ship.',
    status: 'done',
    priority: 'medium',
    area: 'QA',
    createdAt: '2026-06-09',
    doneAt: '2026-06-09',
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
    status: 'done',
    priority: 'medium',
    area: 'Dashboards',
    createdAt: '2026-06-09',
    doneAt: '2026-06-09',
    notes: 'Verified: all 3 tabs render with real data (Goals/Translation/Targets). But the desired Boards Review functionality is under review — see TN-019.',
  },
  {
    code: 'TN-019',
    type: 'idea',
    title: 'Boards Review → "My Work" view (what everyone works on across Monday)',
    description:
      'DIRECTION CHOSEN (2026-06-12): option C. Boards Review should become a person-centric "My Work" view — for each user, everything they’re working on across the whole Monday account (all boards), not the board-centric editorial port from the COE. Converges with TN-022 (the Home "My Work" widget) — same concept, two surfaces (a Home summary + a full view). Open design questions for when we resume: which Monday boards/columns define "assigned to me" and "in progress"; grouping (by board? by status? by project?); whether it’s read-only or actionable. Deferred — Arnaldo doesn’t want to build it yet. Done so far: targets editing moved out of the dashboard to Settings (TN-025). Still pending here: build the My Work view, then retire the legacy boards.html (+ its orphaned target modal that writes to the dead COE Supabase) in the cutover (TN-010).',
    status: 'backlog',
    priority: 'medium',
    area: 'Dashboards',
    createdAt: '2026-06-09',
  },
  {
    code: 'TN-025',
    type: 'feature',
    title: 'Move the publishing-targets editor to Settings',
    description: 'The original target modal lived inside boards.html and wrote to the old COE Supabase — orphaned after the merge (the dashboard reads /api/targets from the PORTAL DB). The connected React editor (TargetsEditor, writes portal publishing_targets) was hidden under the /boards-beta beta tab. Re-homed it in Settings — targets are configuration; the dashboard only shows progress against them. Admin edits, viewer read-only.',
    status: 'done',
    priority: 'medium',
    area: 'Dashboards',
    createdAt: '2026-06-12',
    doneAt: '2026-06-12',
  },
  {
    code: 'TN-010',
    type: 'task',
    title: 'B6 cutover: retire boards.html, /boards-beta becomes Boards Review',
    description: 'Remove the legacy static dashboard and promote the React version. Destructive — only after the Boards Review direction is settled.',
    status: 'blocked',
    priority: 'low',
    area: 'Dashboards',
    createdAt: '2026-06-09',
    notes: 'On hold: /boards-beta renders, but its purpose is being rethought (TN-019). Don’t cut over until that’s decided.',
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

  {
    code: 'TN-021',
    type: 'feature',
    title: 'My Team widget — decide and build the content',
    description: 'The Home "My Team" widget is a placeholder. Decide what it shows (your team’s members? activity? leader view?) and build it on the directory data.',
    status: 'backlog',
    priority: 'low',
    area: 'Home',
    createdAt: '2026-06-12',
  },
  {
    code: 'TN-022',
    type: 'feature',
    title: 'My Work widget — everything a person works on across Monday',
    description: 'The Home "My Work" widget is a placeholder. Eventually: pull every item assigned to the signed-in person across the Monday account (boards/columns TBD) and list it. Same concept as TN-019 (Boards Review → "My Work"): this is the Home summary, TN-019 is the full view — build them together.',
    status: 'backlog',
    priority: 'low',
    area: 'Home',
    createdAt: '2026-06-12',
  },

  // ── Done ──────────────────────────────────────────────────────────────────
  {
    code: 'TN-024',
    type: 'bug',
    title: 'Project cards vanished from /projects — enforcement failed closed',
    description: 'With migration 016 not applied, the accessible_site_ids RPC errored and the code treated it as "no access", hiding AAAF/HFA for everyone (even admins). Fixed: access now fails OPEN when it can’t be evaluated — per the "unrestricted until granted" rule — and logs the error. Applies to /projects, /aaaf and /hfa guards.',
    status: 'done',
    priority: 'high',
    area: 'RBAC',
    createdAt: '2026-06-12',
    doneAt: '2026-06-12',
    notes: 'Migrations 016/017 applied 2026-06-12 — enforcement fully wired.',
  },
  {
    code: 'TN-023',
    type: 'feature',
    title: 'Design system v2 — dark mode, navy identity, top-bar avatar + theme toggle',
    description: 'Portal-wide light/dark theme via a semantic palette remap (one CSS layer, contrast preserved by construction), True North navy + north-star gold identity on the chrome, Space Grotesk display headings, and a redesigned top bar: avatar menu (rightmost, with email + Sign out — replaces the sidebar "Signed in" block) and a sun/moon theme toggle. Theme persists per browser and follows the system preference on first visit.',
    status: 'done',
    priority: 'medium',
    area: 'UI',
    createdAt: '2026-06-12',
    doneAt: '2026-06-12',
    notes: 'Known gaps in dark mode: the legacy Publishing Goals iframe (boards.html) and the beta chart.js charts stay light — both pending the Boards Review rethink (TN-019).',
  },
  {
    code: 'TN-020',
    type: 'feature',
    title: 'Home redesign: 5 widgets + My favourites + wider container',
    description: 'Home rebuilt in 3 blocks: five compact destination widgets (Dashboards/Projects/Tools + My Team & My Work placeholders), a per-user "My favourites" block (up to 5, picked from a catalog, stored in the DB), and the org chart. Home now uses a wider container so the five widgets sit side by side.',
    status: 'done',
    priority: 'medium',
    area: 'Home',
    createdAt: '2026-06-12',
    doneAt: '2026-06-12',
    notes: 'Migration 018 applied 2026-06-12.',
  },
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
