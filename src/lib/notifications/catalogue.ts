/**
 * The notification catalogue: every notification the portal knows about, in
 * the blocks of the Notification settings page.
 *
 * Decided on 22 September 2026. The list is built in full as far as the portal
 * allows; anything it cannot do yet stays in the list, faded, with the reason,
 * so the list is the plan as well as the settings. When a faded one becomes
 * possible, it is switched on here and the user is told (standing rule).
 *
 * Each notification has two settings: on or off, and when. "When" decides
 * where (7 October 2026): as it happens lands in the bell at once; the daily
 * summary lands in the bell at the person's summary hour (8:00 unless they
 * chose 6:00 to 10:00) and goes out by email, one email a day for Tools
 * (System stays in the bell, 13 October 2026), on US working days only. Some
 * types only make sense one way (`timings`), and then "when" is not a choice.
 * An admin sets the rule for everyone: a default for each setting, and whether
 * people may change it or it is fixed. A person changes what the rule leaves
 * open.
 *
 * Pure module: the settings page, the drawers and the generators read it.
 */

import type { NavIconKey } from '@/lib/nav/nav-icons'

export type NotificationTab = 'tools' | 'system' | 'chat' | 'email'
export type BlockKey = NotificationTab
export type Timing = 'instant' | 'daily'
export type Channel = 'app' | 'email' | 'both'

/** Which timings a type allows: both, or only one of them. */
export type Timings = 'both' | Timing

/**
 * Where a notification goes follows from when (7 October 2026): as it happens
 * is the bell alone; the daily summary is the bell and the summary email. The
 * channel columns in the tables are kept, written from this, never chosen.
 */
export const channelFor = (timing: Timing): Channel => (timing === 'instant' ? 'app' : 'both')

/** The name of each category, as the settings page and the emails say it. */
export const CATEGORY_LABEL: Record<BlockKey, string> = { tools: 'Tools', system: 'System', chat: 'Chat', email: 'Email' }

/** Who a notification can go to. The settings page shows a person only the ones that can reach them. */
export type Audience =
  | { kind: 'everyone' }
  | { kind: 'admins' }
  | { kind: 'leaders' }
  | { kind: 'tool'; tool: string }

export interface NotificationType {
  key: string
  block: BlockKey
  title: string
  description: string
  /** "You", "Your team", "Admins": who receives it, in the words the page uses. */
  who: string
  audience: Audience
  /** The small uppercase origin line in the drawer: "My Work", "Monday sync". */
  src: string
  icon: NavIconKey
  defaultTiming: Timing
  /** The timings that make sense for it. A single one is shown fixed, not as a choice. */
  timings: Timings
  /** The heading of its section in the summary email: "Assigned to you". */
  section: string
  /** The words beside its count at the top of the summary email: "due tomorrow". */
  stat: string
  /** The same for a count of one, when it differs: "sync to check". */
  statOne?: string
  /** Shows red in the email: something is wrong or late. */
  alarm?: boolean
  /** Invented content for the preview window and "Send me a test". */
  example: { title: string; body: string }
  /** False while the portal cannot produce it yet: listed, faded, with `blockedBy`. */
  available: boolean
  blockedBy?: string
  /** Where the admin rule starts, when it differs from "on, default timing, people may change both". */
  rule?: Partial<Rule>
  /**
   * The one button a bell row carries (Clocky, 16 October 2026: N1, N3, N4):
   * a link, or something the bell does itself ("keep-going" calls Clocky's
   * keepGoing; "open-clock" opens the clock panel).
   */
  button?: NotificationButton
}

export interface NotificationButton {
  label: string
  href?: string
  action?: 'keep-going' | 'open-clock'
}

/** The admin's rule for one notification, for everyone it reaches. */
export interface Rule {
  enabled: boolean
  timing: Timing
  /** Kept in step with timing (channelFor); nobody chooses it. */
  channel: Channel
  /** Fixed: people see the admin's value, locked, and cannot change it. */
  fixEnabled: boolean
  fixTiming: boolean
  /** Always false now that the channel follows timing. */
  fixChannel: boolean
}

/** A person's own choices. A missing field follows the rule's default. */
export interface Pref {
  enabled?: boolean
  timing?: Timing
}

export const BLOCKS: readonly { key: BlockKey; title: string; available: boolean; blockedBy?: string }[] = [
  { key: 'tools', title: 'Tools', available: true },
  { key: 'system', title: 'System', available: true },
  { key: 'chat', title: 'Chat', available: false, blockedBy: 'Arrives with Chat, which is not built yet.' },
  { key: 'email', title: 'Email', available: false, blockedBy: 'Arrives with Email, which is not built yet.' },
]

/**
 * How many late steps make a pile (team-late-pile). 5 at first; raised to 10
 * on 23 September 2026, after the first dry run found most people well over 5.
 */
export const LATE_PILE = 10

export const NOTIFICATION_TYPES: readonly NotificationType[] = [
  // ── Tools ────────────────────────────────────────────────────────────────
  {
    key: 'step-assigned', src: 'My Work', block: 'tools', icon: 'my-work', defaultTiming: 'instant', available: true,
    timings: 'both', section: 'Assigned to you', stat: 'assigned',
    example: { title: '2 new steps were assigned to you', body: 'Translate into Portuguese: How to pray when you are tired, and Feature image: Sabbath rest for busy people. Due Oct 16.' },
    title: 'A new step was assigned to you',
    description: 'A step in Monday is yours now. Several at once arrive as one notification.',
    who: 'You', audience: { kind: 'everyone' },
  },
  {
    key: 'step-due-tomorrow', src: 'My Work', block: 'tools', icon: 'my-work', defaultTiming: 'daily', available: true,
    timings: 'daily', section: 'Due tomorrow', stat: 'due tomorrow',
    example: { title: 'A step of yours is due tomorrow', body: 'Publish on WordPress: Faith on the farm. Due Oct 8.' },
    title: 'A step of yours is due tomorrow',
    description: 'Open steps whose deadline is tomorrow.',
    who: 'You', audience: { kind: 'everyone' },
  },
  {
    key: 'step-late', src: 'My Work', block: 'tools', icon: 'my-work', defaultTiming: 'daily', available: true,
    timings: 'daily', section: 'Late', stat: 'late', alarm: true,
    example: { title: 'A step of yours became late', body: 'Translate into Spanish: When prayer feels silent. Due Oct 5.' },
    title: 'A step of yours became late',
    description: 'An open step passed its deadline.',
    who: 'You', audience: { kind: 'everyone' },
  },
  {
    key: 'team-order-changed', src: 'My Work', block: 'tools', icon: 'my-work', defaultTiming: 'daily', available: true,
    timings: 'both', section: 'Team order', stat: 'order changes', statOne: 'order change',
    example: { title: "Your team's priority order changed", body: 'A team leader saved a new order for Translation.' },
    title: "Your team's priority order changed",
    description: "A team leader saved a new order for your team's steps.",
    who: 'Your team', audience: { kind: 'everyone' },
  },
  {
    key: 'step-released', src: 'My Work', block: 'tools', icon: 'my-work', defaultTiming: 'instant', available: false,
    timings: 'instant', section: 'Released', stat: 'released',
    example: { title: 'A step waiting on you was released', body: 'The step before yours is done: Review: Hope in hard times.' },
    title: 'A step waiting on you was released',
    description: 'The step before yours was finished, so yours can start.',
    who: 'You', audience: { kind: 'everyone' },
    blockedBy: 'Needs "waiting on the previous step" in My Work, which is not built yet.',
  },
  {
    key: 'publishing-behind', src: 'Publishing Goals', block: 'tools', icon: 'publishing-goals', defaultTiming: 'daily', available: true,
    timings: 'daily', section: 'Publishing Goals', stat: 'behind pace',
    example: { title: 'Publishing Goals behind pace', body: 'AAAF: 14 of 20 published this week, 17 expected by now.' },
    title: 'Publishing Goals behind pace',
    description: "A client's week is behind its publishing target for the days that have gone.",
    who: 'Who can open Publishing Goals', audience: { kind: 'tool', tool: 'publishing' },
  },
  {
    key: 'i7-budget', src: 'i7 report', block: 'tools', icon: 'client-reports', defaultTiming: 'daily', available: true,
    timings: 'both', section: 'i7 budget', stat: 'budget alerts', statOne: 'budget alert',
    example: { title: 'i7 budget crossed 75%', body: "i7 has used 78% of October's budget." },
    title: 'i7 budget crossed 75% or 90%',
    description: "This month's i7 budget passed 75%, then 90%.",
    who: 'Who can open the i7 report', audience: { kind: 'tool', tool: 'i7-budget' },
  },
  {
    key: 'team-late-pile', src: 'My Team', block: 'tools', icon: 'my-team', defaultTiming: 'daily', available: true,
    timings: 'daily', section: 'Late piles', stat: 'late piles', statOne: 'late pile', alarm: true,
    example: { title: 'Late steps piling up on Design', body: 'One person on Design has 12 late steps.' },
    title: 'Late steps piling up on your team',
    description: `People on a team you lead with ${LATE_PILE} or more late steps. Checked once a week, one notification per team, in that day's summary.`,
    who: 'Team leaders', audience: { kind: 'leaders' },
  },

  // ── Clocky (16 October 2026, design handoff Design/design_handoff_clocky) ──
  // The row's text is its title, exact copy from the design; the body is empty.
  {
    key: 'clocky-still-working', src: 'North Time', block: 'tools', icon: 'clocky', defaultTiming: 'instant', available: true,
    timings: 'instant', section: 'Clock safety', stat: 'still working?',
    example: { title: 'Still working?', body: 'Your clock has been running 4h 30m since you clocked in at 8:00 AM. It stops at 5h 00m unless you keep it going.' },
    title: 'Still working? (your clock at 4h 30m)',
    description: 'Your clock has run 4h 30m since you clocked in, across every switch. Keep going, or it stops by itself at 5h 00m. In the bell only, never by email.',
    who: 'You', audience: { kind: 'everyone' },
    button: { label: 'Keep going', action: 'keep-going' },
  },
  {
    key: 'clocky-stopped', src: 'North Time', block: 'tools', icon: 'clocky', defaultTiming: 'instant', available: true,
    timings: 'instant', section: 'Clock safety', stat: 'clocks stopped', statOne: 'clock stopped', alarm: true,
    example: { title: 'Your clock stopped by itself at 1:00 PM.', body: 'Confirm when you really stopped.' },
    title: 'Your clock stopped by itself',
    description: 'Nobody answered "Still working?", so North Time stopped your clock at 5h 00m. In the bell, and the one North Time email: "Your clock stopped by itself".',
    who: 'You', audience: { kind: 'everyone' },
    button: { label: 'Confirm end time', action: 'open-clock' },
  },
  {
    key: 'clocky-correction-requested', src: 'North Time · approvals', block: 'tools', icon: 'clocky', defaultTiming: 'instant', available: true,
    timings: 'instant', section: 'Time corrections', stat: 'time corrections to review', statOne: 'time correction to review',
    example: { title: 'Samuel Manzi asked for a time correction', body: '1h 00m on Tue, Oct 13, 4:00 PM to 5:00 PM.' },
    title: 'Someone asked for a time correction',
    description: "A person you approve for asked for time they have no entry for. It counts only once approved. In the bell only.",
    who: "The person's Team Leader, Admins and Super Admins", audience: { kind: 'tool', tool: 'clocky-approvals' },
    button: { label: 'Review', href: '/clocky-hours/approvals' },
  },
  {
    key: 'clocky-correction-decided', src: 'North Time · your request', block: 'tools', icon: 'clocky', defaultTiming: 'instant', available: true,
    timings: 'instant', section: 'Your requests', stat: 'requests decided', statOne: 'request decided',
    example: { title: 'Rock Kai approved your time correction', body: '1h 30m on Wed, Oct 14. It now counts in your hours.' },
    title: 'Your time correction was approved or denied',
    description: 'Approved, it counts in your hours; denied, with the reason. In the bell only.',
    who: 'You', audience: { kind: 'everyone' },
    button: { label: 'Open time entries', href: '/clocky-hours' },
  },
  {
    key: 'clocky-timeoff-requested', src: 'North Time · approvals', block: 'tools', icon: 'clocky', defaultTiming: 'instant', available: true,
    timings: 'instant', section: 'Time off', stat: 'time off requests', statOne: 'time off request',
    example: { title: 'Olivia Hale asked for time off', body: 'Vacation, Fri, Oct 16 (8h 00m).' },
    title: 'Someone asked for time off',
    description: 'A request for time off, waiting for a Super Admin. In the bell only.',
    who: 'Super Admins', audience: { kind: 'tool', tool: 'ck-timeoff' },
    button: { label: 'Review', href: '/clocky-hours/approvals' },
  },
  {
    key: 'clocky-timeoff-decided', src: 'North Time · your request', block: 'tools', icon: 'clocky', defaultTiming: 'instant', available: true,
    timings: 'instant', section: 'Your requests', stat: 'requests decided', statOne: 'request decided',
    example: { title: 'Dave Sharpe approved your time off', body: 'Vacation, Fri, Oct 16 (8h 00m).' },
    title: 'Your time off was approved or denied',
    description: 'A Super Admin decided your time off: approved, or denied with the reason. In the bell only.',
    who: 'You', audience: { kind: 'everyone' },
    button: { label: 'Open time entries', href: '/clocky-hours' },
  },
  {
    key: 'clocky-clocked-out-for', src: 'North Time · Who\'s working', block: 'tools', icon: 'clocky', defaultTiming: 'instant', available: true,
    timings: 'instant', section: 'Clock safety', stat: 'clocks ended for you', statOne: 'clock ended for you',
    example: { title: 'Dave Sharpe clocked you out at 3:45 PM', body: 'Reason: "Forgot to clock out."' },
    title: 'Someone clocked you out',
    description: "A Super Admin ended your running clock from Who's working, with the reason. In the bell only.",
    who: 'You', audience: { kind: 'everyone' },
    // No address of its own: the row's, that entry's history.
    button: { label: 'Open entry' },
  },
  {
    key: 'clocky-timesheet-submitted', src: 'North Time · approvals', block: 'tools', icon: 'clocky', defaultTiming: 'instant', available: true,
    timings: 'instant', section: 'Timesheets', stat: 'timesheets to approve', statOne: 'timesheet to approve',
    example: { title: 'Samuel Manzi submitted October 2026', body: '168h 30m, waiting for a Super Admin.' },
    title: 'Someone submitted a timesheet',
    description: 'A person sent their month or pay period: the hours go to whoever they report to, the invoice to Arnaldo Oliveira or Dave Sharpe. Approve it, or return it with a reason. In the bell only.',
    who: 'Whoever approves it', audience: { kind: 'everyone' },
    button: { label: 'Review', href: '/clocky-hours/approvals' },
  },
  {
    key: 'clocky-timesheet-decided', src: 'North Time · your timesheet', block: 'tools', icon: 'clocky', defaultTiming: 'instant', available: true,
    timings: 'instant', section: 'Timesheets', stat: 'timesheets decided', statOne: 'timesheet decided',
    example: { title: 'Arnaldo Oliveira approved your October 2026 timesheet', body: 'Returned or reopened, it comes with the reason.' },
    title: 'Your timesheet was approved, returned or reopened',
    description: 'Approved, it stays locked; returned or reopened, with the reason, you can change it and send it again. In the bell only.',
    who: 'You', audience: { kind: 'everyone' },
    button: { label: 'Open time entries', href: '/clocky-hours' },
  },
  // Invoices (Clocky part 2, Invoices.dc.html bell lines).
  {
    key: 'clocky-invoice-made', src: 'North Time · invoices', block: 'tools', icon: 'clocky', defaultTiming: 'instant', available: true,
    timings: 'instant', section: 'Invoices', stat: 'invoices made', statOne: 'invoice made',
    example: { title: 'We created invoice INV-2026-0142 for October', body: '$2,310.00. It waits for approval with your hours.' },
    title: 'Your invoice was made',
    description: 'A contractor submits a timesheet and the invoice is made from it, with the rate from Rates & Costs. In the bell only.',
    who: 'You', audience: { kind: 'everyone' },
    button: { label: 'Open invoice' },
  },
  {
    key: 'clocky-invoice-approved', src: 'North Time · invoices', block: 'tools', icon: 'clocky', defaultTiming: 'instant', available: true,
    timings: 'instant', section: 'Invoices', stat: 'invoices to pay', statOne: 'invoice to pay',
    example: { title: 'INV-2026-0138 (Stephanie Aguirre, $2,304.00) was approved', body: 'Ready to pay.' },
    title: 'An invoice is ready to pay',
    description: 'An invoice was approved: pay it outside Rippling, then mark it paid. In the bell only.',
    who: 'Finance', audience: { kind: 'everyone' },
    button: { label: 'Open invoices', href: '/clocky-hours/invoices' },
  },
  {
    key: 'clocky-invoice-paid', src: 'North Time · invoices', block: 'tools', icon: 'clocky', defaultTiming: 'instant', available: true,
    timings: 'instant', section: 'Invoices', stat: 'invoices paid', statOne: 'invoice paid',
    example: { title: 'INV-2026-0131 (September) was paid on Oct 12, 2026', body: 'Ref. WISE-77310.' },
    title: 'Your invoice was paid',
    description: 'Finance paid it and marked it paid, with the date and the reference. In the bell only.',
    who: 'You', audience: { kind: 'everyone' },
    button: { label: 'Open invoice' },
  },
  // Requests (Clocky part 2, Requests.dc.html bell lines).
  {
    key: 'clocky-reimbursement-requested', src: 'Requests · reimbursement', block: 'tools', icon: 'clocky', defaultTiming: 'instant', available: true,
    timings: 'instant', section: 'Reimbursements', stat: 'reimbursements to decide', statOne: 'reimbursement to decide',
    example: { title: 'Wendy Cacka asked for a reimbursement', body: 'Software, $45.00 (Figma Professional, Oct to Dec).' },
    title: 'Someone asked for a reimbursement',
    description: 'Money spent for work, with the receipt. Approve it on Approvals, or deny it with a reason. In the bell only.',
    who: 'Super Admins', audience: { kind: 'tool', tool: 'rq-decide' },
    button: { label: 'Review', href: '/clocky-hours/approvals' },
  },
  {
    key: 'clocky-reimbursement-decided', src: 'Requests · reimbursement', block: 'tools', icon: 'clocky', defaultTiming: 'instant', available: true,
    timings: 'instant', section: 'Reimbursements', stat: 'reimbursements decided', statOne: 'reimbursement decided',
    example: { title: 'Arnaldo Oliveira approved "Internet, October" ($35.00)', body: 'It is on invoice INV-2026-0142.' },
    title: 'Your reimbursement was approved or denied',
    description: 'Approved, it goes on your next invoice or on a reimbursement document; denied, with the reason. In the bell only.',
    who: 'You', audience: { kind: 'everyone' },
    button: { label: 'Open', href: '/requests/reimbursements' },
  },
  {
    key: 'clocky-rmb-ready', src: 'Requests · reimbursement', block: 'tools', icon: 'clocky', defaultTiming: 'instant', available: true,
    timings: 'instant', section: 'Reimbursements', stat: 'documents to pay', statOne: 'document to pay',
    example: { title: 'RMB-2026-0030 (Dave Sharpe, $86.40) was approved', body: 'Ready to pay.' },
    title: 'A reimbursement document is ready to pay',
    description: "An employee's approved reimbursements, on one document: pay it outside Rippling payroll, then mark it paid. In the bell only.",
    who: 'Finance', audience: { kind: 'everyone' },
    button: { label: 'Open' },
  },
  {
    key: 'clocky-rmb-paid', src: 'Requests · reimbursement', block: 'tools', icon: 'clocky', defaultTiming: 'instant', available: true,
    timings: 'instant', section: 'Reimbursements', stat: 'documents paid', statOne: 'document paid',
    example: { title: 'RMB-2026-0031 was paid on Nov 3, 2026', body: 'Ref. ACH-20261103.' },
    title: 'Your reimbursement document was paid',
    description: 'Finance paid it and marked it paid, with the date and the reference. In the bell only.',
    who: 'You', audience: { kind: 'everyone' },
    button: { label: 'Open' },
  },
  {
    key: 'clocky-extra-requested', src: 'Requests · extra hours', block: 'tools', icon: 'clocky', defaultTiming: 'instant', available: true,
    timings: 'instant', section: 'Extra hours', stat: 'extra hours to decide', statOne: 'extra hours request to decide',
    example: { title: 'Cheyenne Wilson asked for 8h extra in November', body: 'For 2 - i7 Marketing.' },
    title: 'Someone asked for extra hours',
    description: 'More hours than the allowance, asked before going over. Approve it on Approvals, or deny it with a reason. In the bell only.',
    who: 'Super Admins', audience: { kind: 'tool', tool: 'rq-decide' },
    button: { label: 'Review', href: '/clocky-hours/approvals' },
  },
  {
    key: 'clocky-extra-decided', src: 'Requests · extra hours', block: 'tools', icon: 'clocky', defaultTiming: 'instant', available: true,
    timings: 'instant', section: 'Extra hours', stat: 'extra hours decided', statOne: 'extra hours request decided',
    example: { title: 'Arnaldo Oliveira approved 8h extra in October', body: 'For 2 - i7 Marketing.' },
    title: 'Extra hours were approved or denied',
    description: 'To the person, and to the Team Leader who asked for them. In the bell only.',
    who: 'You', audience: { kind: 'everyone' },
    button: { label: 'Open', href: '/requests/extra-hours' },
  },
  // Clocky part 2: Rippling's refusals, the timesheet reminders and the allowance (Company Settings.dc.html 13C).
  {
    key: 'clocky-timeoff-refused', src: 'Requests · time off', block: 'tools', icon: 'clocky', defaultTiming: 'instant', available: true, alarm: true,
    timings: 'instant', section: 'Time off', stat: 'refused by Rippling', statOne: 'refused by Rippling',
    example: { title: "Rippling refused Dave Sharpe's time off (Sick, Thu, Oct 29)", body: '"Sick balance is 0h."' },
    title: 'Rippling refused an approved time off',
    description: 'Payroll does not have those days yet. Fix it in Rippling, then Try again on the request. In the bell only.',
    who: 'Super Admins', audience: { kind: 'tool', tool: 'ck-timeoff' },
    button: { label: 'Open request', href: '/requests/time-off' },
  },
  {
    key: 'clocky-reminder', src: 'North Time · reminders', block: 'tools', icon: 'clocky', defaultTiming: 'instant', available: true,
    timings: 'instant', section: 'Timesheets', stat: 'timesheet reminders', statOne: 'timesheet reminder',
    example: { title: 'Your October timesheet is due tomorrow', body: 'Or: your pay period ends Saturday; or it is late.' },
    title: 'Your timesheet is due, or late',
    description: 'The day before a month ends, the Thursday before a pay period ends, and every morning once it is late. Super Admins turn each one on or off in Company settings. In the bell only.',
    who: 'You', audience: { kind: 'everyone' },
    button: { label: 'Open Time entries', href: '/clocky-hours' },
  },
  {
    // Agenda.dc.html (8D, the bell's "Agenda" line) and Company settings 13C.
    key: 'agenda-birthday', src: 'Agenda', block: 'tools', icon: 'agenda', defaultTiming: 'instant', available: true,
    timings: 'instant', section: 'Agenda', stat: 'birthdays', statOne: 'birthday',
    example: { title: "Today: Joy Inyele's birthday", body: 'From the Directory: the day and month, never the year.' },
    title: "Today: someone's birthday",
    description: 'At 7:00 AM in your time zone, on the day. Each person can hide their own birthday in their settings; Super Admins turn this on or off for everyone in Company settings. In the bell only.',
    who: 'You', audience: { kind: 'everyone' },
    button: { label: 'Open Agenda', href: '/agenda' },
  },
  {
    key: 'clocky-late', src: 'North Time · reminders', block: 'tools', icon: 'clocky', defaultTiming: 'instant', available: true,
    timings: 'instant', section: 'Timesheets', stat: 'timesheets late', statOne: 'timesheet late',
    example: { title: 'Submit October: it is 3 days late', body: 'Saheed Fidimaye has not submitted.' },
    title: 'Someone has not submitted, 3 days late',
    description: 'From the 3rd day late, every morning, until it is sent. In the bell only.',
    who: 'Super Admins', audience: { kind: 'tool', tool: 'ck-reopen' },
    button: { label: 'Open Time entries', href: '/clocky-hours' },
  },
  {
    key: 'clocky-allowance', src: 'North Time · allowance', block: 'tools', icon: 'clocky', defaultTiming: 'instant', available: true,
    timings: 'instant', section: 'Allowance', stat: 'allowance lines', statOne: 'allowance line',
    example: { title: 'You have used 90% of your allowance', body: '126h of 140h this month.' },
    title: 'Your hours allowance: 90%, or over',
    description: 'Once at 90% and once over, each week or month. Ask for extra hours before going over. In the bell only.',
    who: 'You', audience: { kind: 'everyone' },
    button: { label: 'Ask for extra hours', href: '/requests/extra-hours?ask=1' },
  },
  {
    key: 'clocky-allowance-over', src: 'North Time · allowance', block: 'tools', icon: 'clocky', defaultTiming: 'instant', available: true,
    timings: 'instant', section: 'Allowance', stat: 'over the allowance', statOne: 'over the allowance',
    example: { title: 'Cheyenne Wilson is over the October allowance without approval', body: '151h 15m of 140h.' },
    title: 'Someone went over the allowance without approval',
    description: 'To the Team Leader of their team and the Super Admins, once per week or month. In the bell only.',
    who: 'Their Team Leader and Super Admins', audience: { kind: 'everyone' },
    button: { label: 'Open Extra hours', href: '/requests/extra-hours' },
  },
  {
    key: 'clocky-type-change', src: 'North Time · people', block: 'tools', icon: 'clocky', defaultTiming: 'instant', available: true,
    timings: 'instant', section: 'Contractor to employee', stat: 'changes scheduled', statOne: 'change scheduled',
    example: { title: 'Rock Kai becomes an employee on Tue, Dec 1, 2026', body: 'November closes as the last invoice; then pay periods and Rippling.' },
    title: 'A contractor becomes an employee',
    description: 'A Super Admin scheduled it: the last invoice, then pay periods and Rippling. To whoever they report to and Finance. In the bell only.',
    who: 'Whoever they report to, and Finance', audience: { kind: 'everyone' },
    button: { label: 'Open' },
  },
  {
    key: 'clocky-auto-stops', src: 'North Time · daily summary', block: 'tools', icon: 'clocky', defaultTiming: 'daily', available: true,
    timings: 'daily', section: 'Clock safety', stat: 'automatic clock-outs', statOne: 'automatic clock-out',
    example: { title: '2 automatic clock-outs yesterday', body: 'Wendy Cacka, Justus Tsofa.' },
    title: 'Automatic clock-outs yesterday',
    description: 'One line a day: how many clocks North Time stopped by itself yesterday, and whose.',
    who: 'Super Admins', audience: { kind: 'tool', tool: 'access-levels' },
    button: { label: 'Open Clock safety', href: '/clocky-hours/safety' },
  },

  // ── System ───────────────────────────────────────────────────────────────
  {
    key: 'integration-failed', src: 'Integrations', block: 'system', icon: 'automations', defaultTiming: 'instant', available: true, rule: { fixEnabled: true },
    timings: 'instant', section: 'Integrations', stat: 'integrations down', statOne: 'integration down', alarm: true,
    example: { title: 'QuickBooks Time is not answering', body: 'The sync could not sign in: check the token.' },
    title: 'An integration failed',
    description: 'Monday, its webhooks or QuickBooks Time stopped answering.',
    who: 'Who sees the integration alert on Home', audience: { kind: 'tool', tool: 'home-health' },
  },
  {
    key: 'sync-incomplete', src: 'Monday sync', block: 'system', icon: 'automations', defaultTiming: 'daily', available: true,
    timings: 'both', section: 'Syncs', stat: 'syncs to check', statOne: 'sync to check', alarm: true,
    example: { title: "A sync didn't finish", body: 'The Monday sync that started at 9:15 PM stopped with 2 boards left: the time ran out.' },
    title: "A sync didn't finish",
    description: 'A Monday sync stopped before reading every board.',
    who: 'Who sees the integration alert on Home', audience: { kind: 'tool', tool: 'home-health' },
  },
  {
    key: 'first-login', src: 'Access', block: 'system', icon: 'admin', defaultTiming: 'daily', available: true,
    timings: 'both', section: 'First sign-ins', stat: 'first sign-ins', statOne: 'first sign-in',
    example: { title: 'Someone signed in for the first time', body: 'Maria Example signed in for the first time, as Collaborator.' },
    title: 'Someone signed in for the first time',
    description: 'A new person reached the portal, and the level they landed on.',
    who: 'Who can open the Access log', audience: { kind: 'tool', tool: 'd-log' },
  },
  {
    key: 'level-changed', src: 'Access', block: 'system', icon: 'admin', defaultTiming: 'instant', available: true,
    timings: 'instant', section: 'Access levels', stat: 'access changes', statOne: 'access change',
    example: { title: 'An access level was changed', body: 'John Example is now Team leader (was Collaborator).' },
    title: 'An access level was changed',
    description: "Someone's access level changed. The person is told too.",
    who: 'Who can open the Access log, and the person', audience: { kind: 'everyone' },
  },
  {
    key: 'access-rules-changed', src: 'Access levels', block: 'system', icon: 'admin', defaultTiming: 'instant', available: true,
    timings: 'instant', section: 'Access rules', stat: 'access rule changes', statOne: 'access rule change',
    example: { title: 'Access rules were changed', body: "Team Leader: Workload on. Why: Team Leaders plan the week with it." },
    title: 'Access rules were changed',
    description: 'A Super Admin changed who can open what, an exception or a level, with the reason.',
    who: 'Super Admins', audience: { kind: 'tool', tool: 'access-levels' },
  },
  {
    key: 'monday-account-unlinked', src: 'Monday accounts', block: 'system', icon: 'monday-accounts', defaultTiming: 'daily', available: true,
    timings: 'daily', section: 'Monday accounts', stat: 'Monday accounts', statOne: 'Monday account',
    example: { title: 'A new Monday account with no person', body: 'New Writer (new.writer@example.org) has no person in the Directory, so its work shows under Unknown user.' },
    title: 'A new Monday account with no person',
    description: 'Monday has an account the Directory does not know, so its work shows under Unknown user.',
    who: 'Who can open Monday accounts', audience: { kind: 'tool', tool: 'monday-accounts' },
  },
]

export const TYPE_BY_KEY: ReadonlyMap<string, NotificationType> = new Map(NOTIFICATION_TYPES.map(t => [t.key, t]))

/** The tab of the drawer a type lands in. */
export const tabOf = (t: NotificationType): NotificationTab => t.block

/** A timing the type allows: a type with one timing always gets that one. */
export const allowedTiming = (t: NotificationType, timing: Timing): Timing => (t.timings === 'both' ? timing : t.timings)

/** Whether "when" is a choice for this type at all. */
export const timingIsChoice = (t: NotificationType): boolean => t.timings === 'both'

/** The rule a notification starts with, before any admin has changed it. */
export function defaultRule(t: NotificationType): Rule {
  const timing = allowedTiming(t, t.defaultTiming)
  return {
    enabled: true, timing, channel: channelFor(timing),
    fixEnabled: false, fixTiming: false, fixChannel: false,
    ...t.rule,
  }
}

/**
 * What a person actually gets. A fixed setting is the admin's value whatever
 * the person chose; an open one is the person's choice, or the admin's default
 * when they never chose. The person's choice is kept while a setting is fixed,
 * so it comes back if the admin opens the setting again. A timing the type does
 * not allow (an old choice, from before `timings`) gives way to the one it does.
 */
export function effective(t: NotificationType, rule: Rule, pref: Pref | undefined): { enabled: boolean; timing: Timing; channel: Channel } {
  const timing = allowedTiming(t, rule.fixTiming ? rule.timing : pref?.timing ?? rule.timing)
  return {
    enabled: rule.fixEnabled ? rule.enabled : pref?.enabled ?? rule.enabled,
    timing,
    channel: channelFor(timing),
  }
}

/** Can this type ever reach this person? The settings page lists only those. */
export function reaches(t: NotificationType, who: { isAdmin: boolean; leads: boolean; canTool: (k: string) => boolean }): boolean {
  switch (t.audience.kind) {
    case 'everyone': return true
    case 'admins': return who.isAdmin
    // A team's late pile is My Team's news: only with My Team open (audit, 9 October 2026).
    case 'leaders': return (who.leads || who.isAdmin) && who.canTool('my-team')
    case 'tool': return who.canTool(t.audience.tool)
  }
}

/**
 * The hour the daily summary lands, in each person's own time zone
 * (person_settings), or the company's (Clocky's rules) when they never chose.
 */
export const DAILY_HOUR = 8
export const DAILY_ZONE = 'America/New_York'

/** Read notifications go after 30 days, unread after 90. */
export const KEEP_READ_DAYS = 30
export const KEEP_UNREAD_DAYS = 90

const TIMINGS: readonly Timing[] = ['instant', 'daily']
const bool = (v: unknown): v is boolean => typeof v === 'boolean'

/**
 * What a browser sent as a person's choice, checked: only known values. The
 * channel is never a choice (it follows timing), so it is dropped. Null when
 * it cannot be read at all.
 */
export function cleanPref(v: unknown): Pref | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const out: Pref = {}
  if (o.enabled !== undefined) { if (!bool(o.enabled)) return null; out.enabled = o.enabled }
  if (o.timing !== undefined) { if (!TIMINGS.includes(o.timing as Timing)) return null; out.timing = o.timing as Timing }
  return out
}

/** The same for an admin's rule, which must be complete. The channel is worked out, not read. */
export function cleanRule(v: unknown): Rule | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  if (!bool(o.enabled) || !bool(o.fixEnabled) || !bool(o.fixTiming)) return null
  if (!TIMINGS.includes(o.timing as Timing)) return null
  const timing = o.timing as Timing
  return {
    enabled: o.enabled, timing, channel: channelFor(timing),
    fixEnabled: o.fixEnabled, fixTiming: o.fixTiming, fixChannel: false,
  }
}
