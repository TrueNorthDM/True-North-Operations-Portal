/**
 * The access catalogue (7 October 2026): every module, page, tool, tab and
 * action the portal can open, as a tree. The rows of Admin > Access levels.
 *
 * Each item has a stable `key` (stored in access_rules.item_key, so labels may
 * change freely but keys never do once shipped) and its starting answer per
 * level, used until a Super Admin changes it. The starting answers reproduce
 * what the portal did on the day it moved to this model (the old matrix and
 * its configured rows), except the Admin column, which is the owner's approved
 * proposal for the new Admin level.
 *
 * Rules that are not a tick:
 *   always     everyone signed in reaches it (Home, Organization, your own).
 *   superOnly  Super Admin only; it can never be given to another level.
 *   tool       a tool also needs one of the person's teams on its team list
 *              (access_tool_teams), unless the list is "every team".
 *
 * A child never opens without its parent: a tab needs its page, an action its
 * page or tool. A key not in this catalogue is closed to all but Super Admin,
 * which is what makes a new page safe by default.
 *
 * Pure module (no server imports): the Access page, its preview and the server
 * all read it.
 */

export type ItemKind = 'module' | 'page' | 'tool' | 'tab' | 'action'
export type AccessLevel = 'super_admin' | 'admin' | 'team_leader' | 'user'
export type ConfigurableLevel = Exclude<AccessLevel, 'super_admin'>

export const LEVELS: readonly { key: AccessLevel; label: string; summary: string }[] = [
  { key: 'super_admin', label: 'Super Admin', summary: 'Everything, always, including this page. At least two.' },
  { key: 'admin', label: 'Admin', summary: 'Given by a Super Admin. Opens what the Admin column has ticked.' },
  { key: 'team_leader', label: 'Team Leader', summary: 'Automatic: Lead of at least one team.' },
  { key: 'user', label: 'User', summary: 'Automatic: everyone else.' },
]
export const CONFIGURABLE: readonly ConfigurableLevel[] = ['admin', 'team_leader', 'user']
export const LEVEL_LABEL: Record<AccessLevel, string> = Object.fromEntries(LEVELS.map(l => [l.key, l.label])) as Record<AccessLevel, string>

export interface CatalogueItem {
  key: string
  label: string
  kind: ItemKind
  parent: string | null
  /** Starting answer per configurable level. Absent on modules, `always` and `superOnly` items. */
  defaults?: Record<ConfigurableLevel, boolean>
  always?: boolean
  superOnly?: boolean
  soon?: boolean
  building?: boolean
  /** The Tools panel group a tool sits in. */
  group?: string
  note?: string
}

type Node = Omit<CatalogueItem, 'parent' | 'defaults'> & { v?: [0 | 1, 0 | 1, 0 | 1]; ch?: Node[] }

// v = [Admin, Team Leader, User]
const TREE: Node[] = [
  { key: 'm-home', label: 'Home', kind: 'module', ch: [
    // The i7 budget widget is not an item: whoever opens the i7 report sees it
    // (owner's decision, 7 October 2026).
    { key: 'home', label: 'Home page', kind: 'page', always: true, ch: [
      { key: 'home-health', label: 'Alert when an integration is down', kind: 'action', v: [1, 0, 0] },
    ] },
  ] },
  { key: 'm-my-work', label: 'My Work', kind: 'module', ch: [
    { key: 'my-work', label: 'My Work', kind: 'page', v: [1, 1, 1], ch: [
      { key: 'mw-everyone', label: "See everyone's list, not only their own", kind: 'action', v: [1, 1, 1] },
      { key: 'priority-own', label: 'Set the priority order of the teams they lead', kind: 'action', v: [1, 1, 1] },
      { key: 'priority-all', label: 'Set the priority order of every team', kind: 'action', v: [1, 0, 0] },
    ] },
    // Clicking someone opens their page, as "A person's page" (People) allows.
    { key: 'my-team', label: 'My Team', kind: 'page', v: [1, 1, 1], note: "The people on their teams. Clicking someone opens their page, as A person's page allows.", ch: [
      { key: 'mt-teams', label: 'Teams', kind: 'tab', v: [1, 1, 0] },
    ] },
    { key: 'report', label: 'Report', kind: 'page', v: [1, 0, 0], note: 'Delivery, held time and lateness.', ch: [
      { key: 'rp-overview', label: 'Overview', kind: 'tab', v: [1, 1, 1] },
      { key: 'report-people', label: 'People', kind: 'tab', v: [1, 1, 0] },
      { key: 'report-workload', label: 'Workload', kind: 'tab', v: [1, 0, 0] },
      { key: 'rp-waits', label: 'Where it waits', kind: 'tab', v: [1, 1, 1] },
      { key: 'rp-method', label: 'Method', kind: 'tab', v: [1, 1, 1] },
      { key: 'rp-everyone', label: 'See everyone, not only themselves and the teams they lead', kind: 'action', v: [1, 0, 0] },
      { key: 'rp-export', label: 'Export (CSV, PDF and the printable page)', kind: 'action', v: [1, 0, 0] },
    ] },
  ] },
  { key: 'm-hours', label: 'My Hours', kind: 'module', building: true, ch: [
    { key: 'my-hours', label: 'Hours', kind: 'page', v: [1, 0, 0], note: 'Being built; QuickBooks Time is still the official record.', ch: [
      { key: 'h-week', label: 'Week', kind: 'tab', v: [1, 1, 1] },
      { key: 'h-month', label: 'Month submission', kind: 'tab', v: [1, 1, 1] },
      { key: 'h-waiting', label: 'Waiting for you (approvals)', kind: 'tab', v: [0, 0, 0], note: 'Approving hours and time off: Super Admins only, for now (8 October 2026).' },
      { key: 'h-timeoff', label: 'Time off', kind: 'tab', v: [1, 1, 1] },
      { key: 'h-reopen', label: 'Reopen a submitted month', kind: 'action', v: [0, 0, 0] },
    ] },
    { key: 'my-hours-reports', label: 'Reports', kind: 'page', soon: true, v: [1, 0, 0] },
    { key: 'my-hours-approvals', label: 'Approvals and invoices', kind: 'page', soon: true, v: [1, 0, 0] },
  ] },
  { key: 'm-chat', label: 'Chat', kind: 'module', ch: [{ key: 'chat', label: 'Chat', kind: 'page', soon: true, v: [1, 1, 1] }] },
  { key: 'm-emails', label: 'Emails', kind: 'module', ch: [{ key: 'emails', label: 'Emails', kind: 'page', soon: true, v: [1, 1, 1] }] },
  { key: 'm-tools', label: 'Tools', kind: 'module', ch: [
    // Its sites and languages are configured in Company settings (cs-sites).
    { key: 'href-links', label: 'Href Links', kind: 'tool', group: 'SEO Tools', v: [1, 1, 1] },
    { key: 'schema-app', label: 'Schema App', kind: 'tool', group: 'SEO Tools', soon: true, v: [1, 1, 1] },
    { key: 'schema-scraper', label: 'Schema Scraper', kind: 'tool', group: 'SEO Tools', soon: true, v: [1, 1, 1] },
    { key: 'knowledge-graph', label: 'Knowledge Graph', kind: 'tool', group: 'SEO Tools', soon: true, v: [1, 1, 1] },
    { key: 'page-auditor', label: 'Page Auditor', kind: 'tool', group: 'SEO Tools', soon: true, v: [1, 1, 1] },
    { key: 'image-optimization', label: 'Image Optimization', kind: 'tool', group: 'SEO Tools', soon: true, v: [1, 1, 1] },
    { key: 'analytics', label: 'Analytics', kind: 'tool', group: 'SEO Tools', soon: true, v: [1, 1, 1] },
    { key: 'impact-globe', label: 'Impact Globe', kind: 'tool', group: 'SEO Tools', soon: true, v: [1, 1, 1] },
    { key: 'publishing', label: 'Publishing Goals', kind: 'tool', group: 'Operations', v: [1, 1, 1] },
    // Whoever opens it sees the whole report, budget included, and the budget
    // widget on Home (owner's decision, 7 October 2026).
    { key: 'i7-budget', label: 'Client Report · i7', kind: 'tool', group: 'Operations', v: [1, 1, 1], ch: [
      { key: 'i7-numbers', label: 'In Numbers', kind: 'tab', v: [1, 1, 1] },
      { key: 'i7-graphics', label: 'In Graphics', kind: 'tab', v: [1, 1, 1] },
      { key: 'i7-guide', label: 'Guide', kind: 'tab', v: [1, 1, 1] },
      { key: 'i7-export', label: 'Export (PDF, CSV and the printable page)', kind: 'action', v: [1, 0, 0] },
      { key: 'report-team-update', label: 'Team Update, the shareable budget image', kind: 'action', v: [1, 0, 0] },
      { key: 'i7-manual', label: 'Add manual hours', kind: 'action', v: [0, 0, 0] },
      { key: 'i7-note', label: "Edit the month's note", kind: 'action', v: [0, 0, 0] },
    ] },
    { key: 'grant-pass-report', label: 'Client Report · Project Hours & Others', kind: 'tool', group: 'Operations', v: [1, 1, 1], ch: [
      { key: 'ph-costs', label: 'Costs', kind: 'tab', v: [1, 1, 1] },
      { key: 'ph-people', label: 'People', kind: 'tab', v: [1, 1, 1] },
      { key: 'ph-money', label: 'Money in and donation records', kind: 'action', v: [1, 0, 0] },
      { key: 'ph-export', label: 'Export (PDF, CSV and the printable page)', kind: 'action', v: [1, 0, 0] },
      { key: 'ph-manual', label: 'Add manual hours', kind: 'action', v: [0, 0, 0] },
    ] },
  ] },
  { key: 'm-people', label: 'People', kind: 'module', ch: [
    { key: 'directory', label: 'Directory', kind: 'page', v: [1, 1, 0], note: 'The list of people and the tabs beside it.', ch: [
      { key: 'd-company', label: 'See the whole company, not only their own teams', kind: 'action', v: [1, 1, 0] },
      { key: 'd-teams', label: 'Teams', kind: 'tab', v: [1, 1, 0] },
      { key: 'd-emails', label: 'Emails', kind: 'tab', v: [1, 0, 0] },
      { key: 'd-rates', label: 'Rates & Costs', kind: 'tab', v: [1, 0, 0] },
      { key: 'd-log', label: 'Access log', kind: 'tab', v: [1, 0, 0] },
      { key: 'd-portal', label: 'Portal access', kind: 'tab', v: [1, 0, 0] },
      { key: 'd-edit', label: 'Add people, and change teams and positions on the Teams tab', kind: 'action', v: [1, 0, 0] },
      { key: 'd-invite', label: 'Invite, resend and revoke portal access', kind: 'action', v: [1, 0, 0] },
    ] },
    // A person's page (8 October 2026): one tab per who keeps the information.
    // Everyone opens their own; someone else's needs p-led or p-any, and then
    // each tab its own tick (lib/directory/page-rights.ts).
    { key: 'person', label: "A person's page", kind: 'page', always: true, note: 'Opened from the Directory, My Team, Human Resources, and My profile in the avatar menu.', ch: [
      { key: 'p-own', label: 'Their own page: edit Personal, see Work and Reports, never HR and access', kind: 'action', always: true },
      { key: 'p-led', label: 'Open the pages of people on the teams they lead', kind: 'action', v: [1, 1, 0] },
      { key: 'p-any', label: "Open anyone's page", kind: 'action', v: [1, 0, 0] },
      { key: 'p-personal', label: 'Personal: contact, date of birth, address', kind: 'tab', v: [1, 0, 0] },
      { key: 'p-personal-edit', label: "Edit someone else's Personal", kind: 'action', v: [1, 0, 0] },
      { key: 'p-work', label: 'Work: job, teams, reporting, dates, history', kind: 'tab', v: [1, 1, 0] },
      { key: 'p-work-edit', label: "Edit someone else's Work", kind: 'action', v: [1, 0, 0] },
      { key: 'p-hr', label: 'HR and access: onboarding, offboarding, invitation, last access', kind: 'tab', v: [1, 0, 0] },
      { key: 'p-hr-edit', label: 'Change onboarding, offboarding and the QuickBooks Time link', kind: 'action', v: [1, 0, 0] },
      { key: 'd-2fa', label: "Reset someone's two-step sign-in", kind: 'action', v: [0, 0, 0] },
      { key: 'p-reports', label: 'Reports: who reports to the person', kind: 'tab', v: [1, 0, 0] },
    ] },
    { key: 'organization', label: 'Organization', kind: 'page', always: true },
    { key: 'history', label: 'History', kind: 'page', always: true },
    { key: 'human-resources', label: 'Human Resources', kind: 'page', v: [1, 0, 0] },
  ] },
  { key: 'm-admin', label: 'Admin', kind: 'module', ch: [
    { key: 'admin', label: 'Admin', kind: 'page', v: [1, 0, 0], note: 'The landing page of the Admin area.' },
    { key: 'access-levels', label: 'Access levels, with Check a person, Exceptions and the change log', kind: 'page', superOnly: true },
    { key: 'view-stage', label: 'View Stage', kind: 'page', superOnly: true },
    { key: 'monday-accounts', label: 'Monday accounts', kind: 'page', v: [1, 0, 0] },
    { key: 'automations', label: 'Automations', kind: 'page', v: [1, 0, 0], ch: [
      { key: 'au-run', label: 'Run the checks now', kind: 'action', v: [1, 0, 0] },
    ] },
    { key: 'settings', label: 'Company settings', kind: 'page', v: [1, 0, 0], ch: [
      { key: 'cs-apis', label: 'APIs & tokens', kind: 'tab', v: [0, 0, 0] },
      { key: 'cs-my-work', label: 'My Work sources', kind: 'tab', v: [1, 0, 0] },
      { key: 'cs-clients', label: 'Clients & budgets', kind: 'tab', v: [1, 0, 0] },
      { key: 'cs-catalog', label: 'Clients, Projects & Job Codes', kind: 'tab', v: [1, 0, 0] },
      { key: 'cs-targets', label: 'Publishing targets', kind: 'tab', v: [1, 0, 0] },
      { key: 'cs-sites', label: 'Sites & languages', kind: 'tab', v: [1, 0, 0] },
    ] },
    { key: 'notification-rules', label: 'Notification rules', kind: 'page', v: [1, 0, 0] },
    { key: 'tickets', label: 'Tickets', kind: 'page', v: [1, 0, 0] },
    { key: 'tests', label: 'Tests', kind: 'page', v: [1, 0, 0] },
    { key: 'manual', label: 'System manual', kind: 'page', v: [1, 0, 0], ch: [
      { key: 'man-portal', label: 'The portal', kind: 'tab', v: [1, 0, 0] },
      { key: 'man-runs', label: 'How it runs', kind: 'tab', v: [1, 0, 0] },
    ] },
  ] },
  { key: 'm-clocky', label: 'Clocky', kind: 'module', building: true, ch: [
    { key: 'clocky-hours', label: 'Hours', kind: 'page', v: [0, 0, 0], ch: [
      { key: 'ck-rules', label: 'Rules in force', kind: 'tab', v: [0, 0, 0] },
      { key: 'ck-import', label: 'Migration', kind: 'tab', v: [0, 0, 0] },
      { key: 'ck-recon', label: 'Reconciliation', kind: 'tab', v: [0, 0, 0] },
    ] },
    { key: 'clocky-reports', label: 'Reports', kind: 'page', soon: true, v: [0, 0, 0] },
    { key: 'clocky-approvals', label: 'Approvals', kind: 'page', soon: true, v: [0, 0, 0] },
  ] },
  { key: 'm-you', label: 'Your own', kind: 'module', ch: [
    { key: 'profile', label: 'My profile: their own page in the Directory', kind: 'page', always: true },
    { key: 'personal-settings', label: 'Settings', kind: 'page', always: true },
  ] },
]

function flatten(nodes: readonly Node[], parent: string | null, out: CatalogueItem[]): CatalogueItem[] {
  for (const { ch, v, ...rest } of nodes) {
    out.push({ ...rest, parent, ...(v ? { defaults: { admin: !!v[0], team_leader: !!v[1], user: !!v[2] } } : {}) })
    if (ch) flatten(ch, rest.key, out)
  }
  return out
}

/** Every item, parents before children, in the order the Access page lists them. */
export const CATALOGUE: readonly CatalogueItem[] = flatten(TREE, null, [])
export const ITEM: ReadonlyMap<string, CatalogueItem> = new Map(CATALOGUE.map(i => [i.key, i]))
export const CHILDREN: ReadonlyMap<string, readonly CatalogueItem[]> = (() => {
  const m = new Map<string, CatalogueItem[]>()
  for (const i of CATALOGUE) if (i.parent) (m.get(i.parent) ?? m.set(i.parent, []).get(i.parent)!).push(i)
  return m
})()

/** The tool items (each also needs a team on its list). */
export const TOOL_ITEMS: readonly CatalogueItem[] = CATALOGUE.filter(i => i.kind === 'tool')

/** The tool an item belongs to (itself, or the tool above it), if any. */
export function toolOf(key: string): CatalogueItem | null {
  for (let i = ITEM.get(key); i; i = i.parent ? ITEM.get(i.parent) : undefined) if (i.kind === 'tool') return i
  return null
}

/** The module an item sits in. */
export function moduleOf(key: string): CatalogueItem | null {
  for (let i = ITEM.get(key); i; i = i.parent ? ITEM.get(i.parent) : undefined) if (i.kind === 'module') return i
  return null
}

/** Whether a level may be given an item at all (not always-on, not Super Admin only, not a module). */
export const isConfigurable = (i: CatalogueItem): boolean => !!i.defaults

/** Older keys some pages still ask for, read as the catalogue item they became. */
export const ALIAS: Readonly<Record<string, string>> = {
  tools: 'm-tools',
  'report-export': 'rp-export',
  clocky: 'clocky-hours',
}

/** Team positions (7 October 2026): Lead or Member. The older positions read as these. */
export type TeamPosition = 'lead' | 'member'
export const POSITION_LABEL: Record<TeamPosition, string> = { lead: 'Lead', member: 'Member' }
export const isLeadPosition = (p: string | null | undefined): boolean =>
  p === 'lead' || p === 'founder' || p === 'manager' || p === 'team_leader'
