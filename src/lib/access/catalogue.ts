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
    // Topic Studio (5 November 2026): two grants behind one row, as the client
    // reports. Its team lists decide who is a writer and who is an SEO.
    { key: 'topic-studio', label: 'Topic Studio', kind: 'tool', group: 'SEO Tools', v: [1, 1, 1], note: 'The Writer workshop and SEO brief of the topics an SEO has shared with writers.' },
    { key: 'topic-studio-seo', label: 'Topic Studio · SEO research', kind: 'tool', group: 'SEO Tools', v: [1, 1, 1], note: 'Every topic and every tab: import topic files, research, and share topics with writers.' },
    { key: 'publishing', label: 'Publishing Goals', kind: 'tool', group: 'Operations', v: [1, 1, 1] },
    // Whoever opens it sees the whole report, budget included, and the budget
    // widget on Home (owner's decision, 7 October 2026).
    { key: 'i7-budget', label: 'Client Report · i7', kind: 'tool', group: 'Operations', v: [1, 1, 1], ch: [
      { key: 'i7-numbers', label: 'In Numbers', kind: 'tab', v: [1, 1, 1], note: "Hours per person, budget hours and the month's budget, used and left for everyone. Budget used and Budget avail. by line, and the i7 rate, only for Super Admins and Finance. Owner, Nov 5, 2026: beside each person's hours they give away that person's rate." },
      { key: 'i7-graphics', label: 'In Graphics', kind: 'tab', v: [1, 1, 1] },
      { key: 'i7-guide', label: 'Guide', kind: 'tab', v: [1, 1, 1] },
      { key: 'i7-export', label: 'Export (PDF, CSV and the printable page)', kind: 'action', v: [1, 0, 0], note: 'The PDFs and CSVs carry costs by line, so they open only for Super Admins and Finance; the Full history CSV (month totals) for everyone ticked.' },
      { key: 'report-team-update', label: 'Team Update, the shareable budget image', kind: 'action', v: [1, 0, 0] },
      { key: 'i7-manual', label: 'Add manual hours', kind: 'action', v: [0, 0, 0] },
      { key: 'i7-note', label: "Edit the month's note", kind: 'action', v: [0, 0, 0] },
    ] },
    { key: 'grant-pass-report', label: 'Client Report · Project Hours & Others', kind: 'tool', group: 'Operations', v: [1, 1, 1], ch: [
      { key: 'ph-costs', label: 'Costs', kind: 'tab', v: [1, 1, 1], note: "Worked out from what each person is paid, so only Super Admins and Finance see it, whatever the tick, and the month by month table with it. Owner, Nov 5, 2026: beside each person's hours they give away that person's rate." },
      { key: 'ph-people', label: 'People', kind: 'tab', v: [1, 1, 1] },
      { key: 'ph-money', label: 'Money in and donation records', kind: 'action', v: [1, 0, 0] },
      { key: 'ph-export', label: 'Export (PDF, CSV and the printable page)', kind: 'action', v: [1, 0, 0], note: 'Client and Month by month carry costs: Super Admins and Finance only. Internal (hours by person) for everyone ticked.' },
      { key: 'ph-manual', label: 'Add manual hours', kind: 'action', v: [0, 0, 0] },
    ] },
  ] },
  { key: 'm-people', label: 'People', kind: 'module', ch: [
    { key: 'directory', label: 'Directory', kind: 'page', v: [1, 1, 0], note: 'The list of people and the tabs beside it.', ch: [
      { key: 'd-company', label: 'See the whole company, not only their own teams', kind: 'action', v: [1, 1, 0] },
      { key: 'd-teams', label: 'Teams', kind: 'tab', v: [1, 1, 0] },
      { key: 'd-emails', label: 'Emails', kind: 'tab', v: [1, 0, 0] },
      { key: 'd-rates', label: 'Rates & Costs', kind: 'tab', superOnly: true, note: 'Everyone\'s rates and costs. Finance (Company settings > Invoices) reads it too; only Super Admins change it (owner, Nov 5, 2026).' },
      { key: 'd-log', label: 'Access log', kind: 'tab', v: [1, 0, 0] },
      { key: 'd-portal', label: 'Portal access', kind: 'tab', v: [1, 0, 0] },
      { key: 'd-edit', label: 'Add and remove people', kind: 'action', v: [1, 0, 0] },
      // Being on a team, and leading it, opens that team's tools: only a Super
      // Admin changes it (audit, 8 October 2026), so nobody gives themselves a tool.
      { key: 'd-positions', label: 'Teams and positions: create teams, who is on them, and who leads them', kind: 'action', superOnly: true },
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
      { key: 'd-2fa', label: "Reset someone's two-step sign-in", kind: 'action', superOnly: true },
      { key: 'p-reports', label: 'Reports: who reports to the person', kind: 'tab', v: [1, 0, 0] },
      { key: 'p-payments', label: "Payments: someone else's pay, invoices and payment documents", kind: 'tab', superOnly: true, note: 'Their own always; Finance (Company settings > Invoices) too. Owner, Nov 5, 2026: Team Leaders and Admins never, unless Finance.' },
    ] },
    { key: 'organization', label: 'Organization', kind: 'page', always: true },
    { key: 'history', label: 'History', kind: 'page', always: true },
    // The annual review (design handoff, 3 November 2026) opens Human Resources
    // to everyone: each person's own review and goals. Who sees which review is
    // decided by the review itself (lib/review/data.ts), never by a tick.
    { key: 'human-resources', label: 'Human Resources', kind: 'page', always: true, note: 'Everyone: their own review and goals. The rest follows the ticks below and the roles in Company settings > Human Resources.', ch: [
      // Open to everyone since 4 November 2026 (the owner, with the C1 screen).
      { key: 'hr-anniversaries', label: 'Anniversaries: the service badge gallery', kind: 'tab', always: true },
      { key: 'hr-start', label: 'Start the yearly review cycle', kind: 'action', superOnly: true },
    ] },
  ] },
  { key: 'm-agenda', label: 'Agenda', kind: 'module', ch: [
    { key: 'agenda', label: 'Agenda: time off, birthdays, events and milestones', kind: 'page', always: true, ch: [
      { key: 'ag-company', label: 'Create company events and milestones', kind: 'action', v: [1, 0, 0] },
      { key: 'ag-team', label: 'Create events for the teams they lead', kind: 'action', v: [1, 1, 0] },
    ] },
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
      { key: 'cs-apis', label: 'APIs & tokens', kind: 'tab', superOnly: true, note: 'The Monday and TSheets tokens and the webhook address: Super Admins only (10 October 2026).' },
      { key: 'cs-my-work', label: 'My Work sources', kind: 'tab', v: [1, 0, 0] },
      { key: 'cs-clients', label: 'Clients & budgets', kind: 'tab', v: [1, 0, 0] },
      { key: 'cs-catalog', label: 'Clients, Projects & Job Codes', kind: 'tab', v: [1, 0, 0] },
      { key: 'cs-targets', label: 'Publishing targets', kind: 'tab', v: [1, 0, 0] },
      { key: 'cs-sites', label: 'Sites & languages', kind: 'tab', v: [1, 0, 0] },
      { key: 'cs-periods', label: 'Timesheet periods', kind: 'tab', v: [1, 0, 0] },
      { key: 'cs-periods-edit', label: 'Change the timesheet periods: the pay period start and who submits how', kind: 'action', superOnly: true },
      // Clocky part 2 (Company Settings.dc.html 13A, 13B, 13C): Admins read them; Super Admins change them.
      { key: 'cs-jobs', label: 'Job catalogue: the jobs, their fields and the clients', kind: 'tab', v: [1, 0, 0] },
      { key: 'cs-jobs-edit', label: 'Change the job catalogue', kind: 'action', superOnly: true },
      { key: 'cs-integrations', label: 'Integrations: Rippling and Google Calendar', kind: 'tab', v: [1, 0, 0] },
      { key: 'cs-integrations-edit', label: 'Connect Rippling and Google Calendar, and try failed items again', kind: 'action', superOnly: true },
      { key: 'cs-invoices', label: 'Invoices: numbering and billing details', kind: 'tab', v: [1, 0, 0], note: 'Who approves what, who is Finance and who decides reimbursements. Finance sees everyone\'s money and marks invoices and reimbursement documents paid.' },
      { key: 'cs-invoices-edit', label: 'Change the invoice numbering and billing details', kind: 'action', superOnly: true },
      { key: 'cs-reminders', label: 'Reminders: the timesheet reminders and bell lines', kind: 'tab', v: [1, 0, 0] },
      { key: 'cs-reminders-edit', label: 'Turn the reminders on or off', kind: 'action', superOnly: true },
      // North Time rollout (owner, 27 October 2026): the two waves' start dates and who is in each.
      { key: 'cs-rollout', label: 'North Time rollout: the waves, their start dates, and the TSheets entries set aside', kind: 'tab', v: [1, 0, 0], note: 'Wave 1, Wave 2 and No wave: people in No wave keep recording in TSheets and cannot add time in North Time.' },
      { key: 'cs-rollout-decide', label: 'Decide the TSheets entries set aside after the start date: count them as hours, or discard them', kind: 'action', v: [1, 0, 0] },
      { key: 'cs-rollout-edit', label: 'Set the North Time start dates and move people between waves', kind: 'action', superOnly: true },
      { key: 'cs-rollout-open', label: 'Open or close North Time for everyone, and see its pages while closed', kind: 'action', superOnly: true },
      // The annual review (design handoff, 3 November 2026): the roles, who takes part, the dates, the Drive folder.
      { key: 'cs-hr', label: 'Human Resources: the review roles, who takes part, its dates and the Drive folder', kind: 'tab', v: [1, 0, 0] },
      { key: 'cs-hr-edit', label: 'Change the Human Resources settings (the HR person picked there can too)', kind: 'action', superOnly: true },
    ] },
    { key: 'notification-rules', label: 'Notification rules', kind: 'page', v: [1, 0, 0] },
    { key: 'tests', label: 'Tests', kind: 'page', v: [1, 0, 0] },
  ] },
  // The System manual on the rail for everyone (owner, 4 November 2026; it was
  // in Admin). How it runs stays Super Admin only.
  { key: 'm-manual', label: 'System manual', kind: 'module', ch: [
    { key: 'manual', label: 'System manual', kind: 'page', always: true, ch: [
      { key: 'man-portal', label: 'The portal', kind: 'tab', always: true },
      { key: 'man-runs', label: 'How it runs', kind: 'tab', superOnly: true, note: 'Shows the server and where its key files live: Super Admins only (10 October 2026).' },
    ] },
  ] },
  // Clocky for everyone (design handoff of 16 October 2026, README "Who sees
  // what"; owner's decisions in docs/time-clock/05-clocky-build.md). Who sees
  // and changes whose hours is lib/timeclock/scope.ts.
  { key: 'm-clocky', label: 'North Time', kind: 'module', ch: [
    { key: 'clocky-hours', label: 'Time entries, and the clock in the top bar', kind: 'page', v: [1, 1, 1], note: 'Everyone clocks in, adds and changes their own hours, with a reason kept in the history (Nov 4, 2026). A sent timesheet stays locked; the weekly allowance applies; people in No wave cannot add time.', ch: [
      { key: 'ck-grid', label: 'Week grid', kind: 'tab', v: [1, 1, 1] },
      { key: 'ck-timeline', label: 'Day timeline', kind: 'tab', v: [1, 1, 1] },
      { key: 'ck-team', label: 'See and change the hours of the teams they lead (Whose hours: My team)', kind: 'action', v: [1, 1, 0] },
      { key: 'ck-all', label: "See and change everyone's hours", kind: 'action', v: [1, 0, 0] },
      { key: 'ck-reopen', label: 'Reopen an approved timesheet, until its invoice is paid', kind: 'action', superOnly: true },
      { key: 'ck-rules', label: 'Rules in force', kind: 'tab', v: [1, 0, 0] },
      { key: 'ck-import', label: 'Import from QuickBooks Time', kind: 'tab', v: [1, 0, 0] },
      { key: 'ck-recon', label: 'Reconciliation', kind: 'tab', v: [1, 0, 0] },
    ] },
    { key: 'clocky-approvals', label: 'Approvals: the decisions that are theirs', kind: 'page', v: [1, 1, 0], note: 'Whose decision each row is: hours, the person\'s Reports to; invoices, time off and extra hours, Company settings > Invoices, Who approves what; reimbursements, the Reimbursements list. Never their own. Someone who cannot open Approvals is passed over for the default approver.', ch: [
      { key: 'ck-approvals-all', label: 'See every approval, read only (With others, Decided)', kind: 'action', v: [1, 0, 0], note: 'Amounts only with See other people\'s money or Finance.' },
      { key: 'ck-timeoff', label: 'Try again when Rippling refuses a time off', kind: 'action', superOnly: true, note: 'Who decides time off is set in Company settings, Invoices, Who approves what (1 November 2026).' },
      { key: 'ck-rippling-retry', label: "Try again when Rippling refuses an employee's approved hours", kind: 'action', superOnly: true, note: "The person's hours approver can too." },
    ] },
    { key: 'ck-whos-working', label: "Who's working: their teams, or everyone with See everyone's hours", kind: 'page', v: [1, 1, 0], ch: [
      { key: 'ck-clock-out-for', label: 'Clock out for them', kind: 'action', superOnly: true },
    ] },
    { key: 'clocky-invoices', label: 'Invoices', kind: 'page', v: [1, 1, 1], note: 'Contractors see and send their own (Send your invoice: their PDF or built here). Employees have none. Only Finance marks one paid.', ch: [
      { key: 'ck-inv-all', label: "See every contractor's invoice list (filters, Export CSV, Preview PDF, the Drive column)", kind: 'action', v: [1, 0, 0], note: 'Amounts only with See other people\'s money or Finance. Without them the list shows only their own invoices (owner, Nov 5, 2026).' },
      { key: 'ck-inv-link', label: 'Link an invoice-form invoice to a person', kind: 'action', v: [1, 0, 0], note: 'The default approver can too. Amounts only with See other people\'s money or Finance.' },
      { key: 'ck-money', label: "See other people's money: rates, amounts, invoices, reimbursements and payment documents", kind: 'action', superOnly: true, note: 'Their own always; Finance (Company settings > Invoices) too. Owner, Nov 5, 2026: Team Leaders and Admins never, unless Finance.' },
    ] },
    { key: 'clocky-reports', label: 'Reports', kind: 'page', v: [1, 1, 1], note: "Whose hours: everyone with See everyone's hours, the teams they lead with My team, else their own. Money columns: their own, or everyone's with See other people's money or Finance.", ch: [
      { key: 'ck-reports-export', label: 'Export (CSV, PDF, printable page)', kind: 'action', v: [1, 1, 1] },
    ] },
    { key: 'ck-which-job', label: 'Which job?: every job and when to use it', kind: 'page', always: true },
    { key: 'ck-safety', label: 'Clock safety', kind: 'page', v: [1, 0, 0], note: 'Every automatic clock-out. Reading only.' },
    { key: 'ck-transition', label: 'TSheets transition: TSheets entries from the switch date, translated into the 2026 structure', kind: 'page', v: [1, 0, 0], note: 'While TSheets and North Time run side by side: who still records in TSheets after their start date.', ch: [
      { key: 'ck-transition-remind', label: 'Remind them to record in North Time', kind: 'action', v: [1, 0, 0] },
    ] },
  ] },
  // Requests (Clocky part 2, Requests.dc.html): everyone asks for their own;
  // Who decides a request is the routing (owner, 1 November 2026: Company settings > Invoices,
  // Who approves what; routing.ts requestDeciders), not a key here. ck-timeoff and rq-decide stay
  // for what is not a decision: Rippling's retry and its bell, and reading any receipt.
  { key: 'm-requests', label: 'Requests', kind: 'module', ch: [
    { key: 'rq-time-off', label: 'Time off: ask for days off', kind: 'page', v: [1, 1, 1], note: 'US employees only: approved days go to Rippling payroll and the team calendar. Contractors do not see it. The reason is seen only by the person and Super Admins.', ch: [
      { key: 'rq-off-all', label: "See everyone's time off", kind: 'action', v: [1, 0, 0] },
    ] },
    { key: 'rq-reimbursements', label: 'Reimbursements: ask for money spent for work', kind: 'page', v: [1, 1, 1], note: 'With the receipt. A contractor\'s goes on their next invoice; an employee\'s on a reimbursement document Finance pays. Amounts: their own, or with See other people\'s money or Finance.', ch: [
      { key: 'rq-decide', label: 'Open any receipt', kind: 'action', superOnly: true, note: 'Who decides reimbursements and extra hours is set in Company settings, Invoices, Who approves what (1 November 2026).' },
      { key: 'rq-rmb-all', label: "See everyone's reimbursements and the reimbursement documents", kind: 'action', v: [1, 0, 0], note: 'Amounts only with See other people\'s money or Finance. Without them the list shows only their own (owner, Nov 5, 2026).' },
    ] },
    { key: 'rq-extra-hours', label: 'Extra hours: ask before going over the allowance', kind: 'page', v: [1, 1, 1], ch: [
      { key: 'rq-xh-team', label: 'Ask for extra hours for people on the teams they lead', kind: 'action', v: [1, 1, 0] },
    ] },
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
