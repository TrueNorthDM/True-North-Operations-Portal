/**
 * manual/data.ts: the System Manual (admin page at /admin/manual).
 *
 * Code-based on purpose: Claude maintains this alongside the tracker and the
 * test checklist. When a feature changes, this doc changes with it, so it
 * never rots into stale wiki pages. Plain structured blocks, rendered by
 * SystemManual.tsx.
 */

export type ManualBlock =
  | { kind: 'p'; text: string }
  | { kind: 'subhead'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'steps'; items: string[] }
  | { kind: 'note'; text: string }
  | { kind: 'table'; head: string[]; rows: string[][] }

export interface ManualSection {
  id: string
  title: string
  body: ManualBlock[]
}

export const MANUAL_UPDATED = '2026-06-30'

export const MANUAL: ManualSection[] = [
  {
    id: 'overview',
    title: 'Overview',
    body: [
      { kind: 'p', text: 'The True North Operations Portal is the company’s operations hub. Today it covers the editorial / publishing workflow for AAAF and HFA and the company directory; it’s growing toward CRM, communications, task tracking and tools.' },
      { kind: 'subhead', text: 'Getting around (since 22 September 2026)' },
      { kind: 'list', items: [
        'The navy rail on the left, in three groups. Yours: Home, My Work (a panel of My Work, Report, My Team), My Hours, Chat and Emails (coming soon). The company: Tools and People. For admins: Admin and Clocky.',
        'Tools opens a panel in two groups. SEO Tools: Href Links, and seven tools coming soon (Schema App, Schema Scraper, Knowledge Graph, Page Auditor, Image Optimization, Analytics, Impact Globe). Operations: Publishing Goals, Boards and Client Reports. Each tool is granted per team, on the Directory\u2019s Teams tab.',
        'People opens the Directory, the Organization chart and, from level 2, Human Resources.',
        'The avatar at the foot of the rail holds My profile, My Team, Settings (admins) and Sign out.',
        'The top bar: search (Cmd+K finds any page, tool or person you can open), Messages (Chat and Email) and Notifications (Tools and System). Notifications are being set up; the drawers say what will land in them.',
      ] },
      { kind: 'p', text: 'Home shows the company org chart, your pinned favourites, and shortcuts to the pillars.' },
    ],
  },
  {
    id: 'access',
    title: 'Access & roles (RBAC)',
    body: [
      { kind: 'p', text: 'Access is modelled as a directory: People belong to Teams, and Teams (or a single person) are granted access to Projects with a role.' },
      { kind: 'subhead', text: 'Roles, per project' },
      { kind: 'list', items: [
        'Admin, manage the project and who can access it.',
        'Member, use and edit.',
        'Viewer, read-only.',
        'Portal super-admin (profiles.role = admin), sees everything and manages people/teams/access.',
      ] },
      { kind: 'subhead', text: 'The enforcement rule: “unrestricted until granted”' },
      { kind: 'p', text: 'A project with no grants is visible to everyone signed in. The moment you grant it to a team, only that team (plus super-admins) can reach it. So nothing is hidden until you deliberately grant access, and removing the grant makes it open again.' },
      { kind: 'note', text: 'A grant only reaches a real person once their portal account is linked: Admin → People → edit → Portal account. Until then, granting a project effectively restricts it to super-admins.' },
    ],
  },
  {
    id: 'pages',
    title: 'Pages, what they do & who sees them',
    body: [
      { kind: 'table',
        head: ['Page', 'What it does', 'Who'],
        rows: [
          ['Home', 'Org chart + favourites + pillar shortcuts', 'Anyone signed in'],
          ['Tools → Operations → Publishing Goals', 'Publishing pace vs weekly target (/ops/publishing)', 'By team tool grant'],
          ['Tools → SEO Tools → Href Links', 'hreflang tag management for the AAAF / HFA WordPress pages (/seo/href-links)', 'By team tool grant'],
          ['Tools → Operations → Client Reports', 'i7 and Project Hours & Others, one tab per client (/ops/client-reports)', 'By team tool grant, per client'],
          ['People → Organization', 'The company org chart (/organization)', 'Anyone signed in'],
          ['Settings', 'Languages per project, Monday + TSheets API tokens, publishing targets', 'Admins edit; others read'],
          ['Admin → People / Teams / Access', 'The directory + RBAC (who can access what)', 'Admins'],
          ['Admin → Tickets / Tests / Manual', 'Dev work tracker, QA checklist, this document', 'Admins'],
        ],
      },
    ],
  },
  {
    id: 'monday',
    title: 'How Monday feeds the system',
    body: [
      { kind: 'p', text: 'The Monday API is touched in just three files (monday/snapshot.ts, monday/client.ts, monday/handlers.ts), through two distinct flows, with one shared token.' },
      { kind: 'subhead', text: 'The token' },
      { kind: 'p', text: 'It lives only in the database (app_settings.monday_api_token) and is set in Settings → Monday API token. It is never hardcoded anywhere; an optional MONDAY_TOKEN env var exists only as a local-dev fallback. The nightly cron, the live snapshot and the webhook all use this one token.' },
      { kind: 'subhead', text: 'Flow 1, Pull (nightly) → Dashboards' },
      { kind: 'steps', items: [
        'A Vercel Cron runs /api/cron/ingest on a schedule.',
        'processBoard() pulls items (paginated) + activity logs from the Publishing boards via GraphQL.',
        'The whole snapshot is written to the monday_snapshot store (a JSONB cache), overwriting the previous one.',
        'Dashboards read /api/snapshot, instant from the store, with a live fetch as a fallback if a board is missing.',
        'The pace / stage math runs over the snapshot. This flow is read-only: the dashboard is a nightly mirror of Monday.',
      ] },
      { kind: 'subhead', text: 'Flow 2, Webhook (near real-time) → Href Links' },
      { kind: 'steps', items: [
        'Monday fires a webhook to /api/monday/webhook when the “Href Link(s)” status column changes.',
        'The request’s HMAC signature is verified and the event is logged to monday_events.',
        '“Run Link” → the system reads that language’s page URL and saves it.',
        'Once all languages have URLs → the system writes “Apply Link” back to Monday (the only write-back).',
        '“Done” → the system marks that language confirmed live; when all are live, the page is marked complete.',
      ] },
      { kind: 'table',
        head: ['Boards', 'Used for'],
        rows: [
          ['HFA-P, AAAF-P (Publishing)', 'Dashboards (pull) + the Href Link webhook'],
          ['HFA-T, AAAF-T (Translation)', 'The Translation dashboard (pull)'],
        ],
      },
      { kind: 'note', text: 'Which columns are read is configured in two places: BOARDS (lib/boards/config.ts) for the dashboards, and sites.monday_column_ids for the hreflang webhook (hrefLinksStatus, language, pageLink, languageMap).' },
    ],
  },
  {
    id: 'data',
    title: 'Where the data lives',
    body: [
      { kind: 'table',
        head: ['Concern', 'Where'],
        rows: [
          ['People, teams, grants, org chart', 'Supabase (directory tables)'],
          ['hreflang pages, URLs, confirmations', 'Supabase'],
          ['Publishing targets', 'Supabase (publishing_targets), NOT Monday'],
          ['Dashboard data (Monday snapshot)', 'Supabase store, refreshed nightly from Monday'],
          ['Favourites', 'Supabase (per user)'],
          ['Budget Usage Report (TSheets hours)', 'Live fetch from TSheets REST API, not stored in the portal DB'],
          ['Tickets, tests, this manual', 'Code (repo), maintained by Claude'],
          ['Editorial / publishing source of truth', 'Monday'],
        ],
      },
    ],
  },
  {
    id: 'tsheets',
    title: 'QuickBooks Time (TSheets), Budget Usage Report',
    body: [
      { kind: 'p', text: 'The Budget Usage Report tool at /ops/client-reports/i7 replaces a manual process: the admin assistant used to export a TSheets CSV, build a pivot table in Excel, and copy hours cell-by-cell into the monthly Google Sheet. The portal does all of that automatically.' },
      { kind: 'subhead', text: 'The token' },
      { kind: 'p', text: 'A static API access token lives in app_settings.tsheets_api_token and is set in Settings → QuickBooks Time API. Like the Monday token, it never leaves the server, the component only receives { exists, last4 }. To generate one: TSheets → company menu → Company Settings → Add-ons → API Access.' },
      { kind: 'subhead', text: 'How it works' },
      { kind: 'steps', items: [
        'User opens /ops/client-reports/i7 (optionally with ?month=YYYY-MM; defaults to current month).',
        'Server reads tsheets_api_token from app_settings.',
        'Server calls 3 TSheets REST v1 endpoints in parallel: GET /users, GET /jobcodes, GET /timesheets (filtered by date range).',
        'buildMatrix() sums duration (seconds → hours) per jobcode x user and pre-computes row/column totals.',
        'The matrix is passed as props to TimeReportMatrixView (client component) for the month picker and table render.',
        'No data is stored in the portal DB, always fetched fresh from TSheets on each page load.',
      ] },
      { kind: 'note', text: 'Phase 2 (not yet built): budget hours per job code stored in the portal DB so the table can show actual vs budget and cost variance, replacing the Google Sheet entirely.' },
    ],
  },
  {
    id: 'roadmap',
    title: 'Not built yet',
    body: [
      { kind: 'list', items: [
        'Budget Usage Report Phase 2, budget hours + cost variance stored in portal DB (replaces the Google Sheet).',
        'My Work, everything you\'re working on across the whole Monday account (the Home widget + a full view; TN-019 / TN-022). This would be the third Monday use.',
        'My Team, a team-at-a-glance view on Home.',
        'My Work, every step assigned to somebody across all 262 Monday boards, in three blocks. Unknown user is work on a Monday account with nobody behind it in the Directory: it cannot be filtered by team, and an admin resolves it under Admin → Monday accounts. On-going is every step still open. Completed shows finished steps where the item was last changed in Monday within the last 6 months, which the filter widens to everything on request. Nothing is deleted: older finished work stays in the database and out of the page, because a work list that opens on nine years of finished steps is not a work list. Monday does not record when a step was completed, so the item\u2019s last change stands in for it, which keeps a step in view a little longer when the item was touched for an unrelated reason.',
        'Custom SMTP (Resend) for production login (to lift the email rate limit).',
      ] },
    ],
  },
]
