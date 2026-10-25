/**
 * The shapes Clocky's actions and loaders return (docs/time-clock/05-clocky-build.md,
 * "API as built"). Types only, plus nothing that reaches the server: the
 * screens import from here.
 *
 * Times are ISO instants unless named otherwise; days are YYYY-MM-DD in the
 * person's own time zone. Every duration and total is a whole number of
 * seconds on the quarter hour (lib/timeclock/rounding.ts formats them); only a
 * running entry's start, with `now`, makes a live timer.
 */

import type { AccessLevel } from '@/lib/access/catalogue'
import type { FieldName, MissingName } from './entry-rules'
import type { Cadence, Period } from './periods'

// ── Results ─────────────────────────────────────────────────────────────────

export interface OverlapInfo {
  /** The other entry. */
  entryId: number
  name: string
  start: string
  end: string | null
  /** What the two share. */
  sharedStart: string
  sharedEnd: string
}

/** A refusal: `error` is the sentence to show; the rest lets a screen open the right fix. */
export interface Fail {
  ok: false
  error: string
  /** 1F: what the running entry lacks before a switch or a clock out. */
  missing?: MissingName[]
  /** 3F: the entry the times run into. */
  overlap?: OverlapInfo
  /** The clock had passed its 5-hour mark: Clocky stopped it; show 1L. */
  stopped?: true
  /** 3H: what must be fixed before the period can be submitted. */
  attention?: AttentionItem[]
  /** The clock's read: the login is linked to nobody in the Directory, so there is no clock to show. */
  unlinked?: true
}

export type Ok<T extends object = Record<never, never>> = { ok: true } & T
export type Result<T extends object = Record<never, never>> = Ok<T> | Fail

// ── The clock panel (1A to 1N) ──────────────────────────────────────────────

export interface PanelJob {
  id: number
  name: string
  /** "2 - i7 Marketing › Web Dev" */
  path: string
  /** "i7 › Web Dev" */
  short: string
  /** The folder (client) it sits in, or null for a top-level job. */
  folderId: number | null
  isI7: boolean
  /** The job catalogue's "When to use" line (11C), and its billable default. */
  use: string | null
  billable: boolean
  /** Its place in the job catalogue's order. */
  order: number
}

export interface PanelFolder { id: number; name: string; jobIds: number[]; use: string | null; order: number }

export interface PanelField {
  key: FieldName
  /** The tc_fields id, as the fields objects key it. */
  id: string
  /** "1 Company", "2 Project", "3 Activity", "4 Billable", "1 - i7 Code" */
  label: string
  options: string[]
  /** i7 Code is asked, and required, only on i7 jobs. */
  required: 'always' | 'i7'
}

/** A saved combination, a recent one, or the resume card. */
export interface ClockChoice {
  /** tc_combinations id; null for a recent or the resume card. */
  combinationId: number | null
  /** The saved name ("i7 Web Dev"), null when not saved. */
  name: string | null
  jobcodeId: number
  path: string
  short: string
  isI7: boolean
  fields: Record<string, string>
  notes: string
  /** The name when saved, else the short job: how toasts and breakdowns name it. */
  label: string
  activity: string
  /** 'yes' | 'no' | '' */
  billable: string
}

export interface RunningEntry {
  id: number
  jobcodeId: number | null
  path: string
  short: string
  label: string
  isI7: boolean
  fields: Record<string, string>
  notes: string
  /** Recorded start (on the quarter hour) and the real one (null for QuickBooks Time). */
  startedAt: string
  startedAtReal: string | null
  sessionStartedAt: string | null
  windowStartedAt: string | null
  /** Rounded seconds so far (for lists and totals; the timer uses startedAtReal ?? startedAt). */
  recordedSeconds: number
  /** "Counted from 10:00 AM. You clocked in at 10:07 AM; ..." when the two differ. */
  roundNote: { recorded: string; real: string } | null
  missing: MissingName[]
  imported: boolean
}

export interface SafetyView {
  windowStartedAt: string
  sessionStartedAt: string | null
  warnAt: string
  stopAt: string
  /** Past 4h 30m: show 1I. */
  warn: boolean
  /** 1I's card text, exact copy. */
  panelText: string
}

/** An automatic stop waiting for the person's real end time (1L). */
export interface ToConfirm {
  entryId: number
  path: string
  label: string
  startedAt: string
  /** Where Clocky stopped it: recorded (quarter hour) and the real 5-hour mark. */
  stoppedAt: string
  stoppedAtReal: string | null
  date: string
  /** "1:00 PM", or "1:00 PM on Mon, Oct 12" for an earlier day. */
  stopWhen: string
  /** "It ran 5h 00m without an answer since you clocked in at 8:00 AM, so it stopped at 1:00 PM. When did you really stop working?" */
  text: string
  /** Time picker options, newest first (ISO, 15-minute steps): up to the stop, and after it with "I was still working until...". */
  options: string[]
  laterOptions: string[]
}

export interface ClockPanelData {
  me: { personId: string; name: string; zone: string; zoneAbbr: string; level: AccessLevel; leader: boolean }
  /** The server's now, to anchor the live timers. */
  now: string
  today: string
  /** "Thu, Oct 15" */
  todayLabel: string
  todaySeconds: number
  /**
   * Today's clock-ins, real times, oldest first; `end` null while it runs.
   * Home's day banner draws them as the gold bars (design_handoff_home, 25 October 2026).
   */
  todaySpans: { start: string; end: string | null }[]
  weekSeconds: number
  /** The hours allowance this week or month (Clocky part 2, 10B); null without one. */
  allowance: (import('./allowance').AllowanceStatus & { period: 'week' | 'month'; hours: number }) | null
  running: RunningEntry | null
  safety: SafetyView | null
  toConfirm: ToConfirm[]
  resume: ClockChoice | null
  /** Every saved combination, in the person's order: the panel shows the first 6, the rest under More. */
  combinations: ClockChoice[]
  /** The last 5 distinct combinations used, not saved. */
  recents: ClockChoice[]
  /** "Today, by combination", biggest first. */
  todayByCombination: { label: string; seconds: number; running: boolean }[]
  jobs: PanelJob[]
  folders: PanelFolder[]
  fields: PanelField[]
  /** Smart defaults: job id -> field id -> the value that job carries most often. */
  defaults: Record<string, Record<string, string>>
  /** Today's period is submitted: clocking in is refused with this sentence (1N). */
  locked: string | null
  period: Period & { label: string; full: string }
  /** No history and no combinations (1B). */
  firstTime: boolean
  /** "Goes to Rock Kai, your Team Leader. ..." (3K-1), for the correction request. */
  correctionGoesTo: string
}

// ── Time entries (3A to 3K) ─────────────────────────────────────────────────

export type PillTone = 'ok' | 'warn' | 'bad' | 'neutral'
export interface Pill { text: string; tone: PillTone; tip: string }

export interface EntryView {
  /** 'e<entry id>', 'c<correction id>' or 'o<time off request id>': unique across the three. */
  key: string
  rowType: 'entry' | 'correction' | 'time_off'
  /** The tc_entries / tc_correction_requests / tc_absence_requests id. */
  id: number
  personId: string
  personName: string
  initials: string
  team: { id: string; name: string; color: string | null } | null
  zone: string
  /** The zone's abbreviation when it is not the viewer's ("EAT"), else "". */
  zoneAbbr: string
  date: string
  start: string | null
  end: string | null
  running: boolean
  /** "8:30 AM to 3:30 PM", "4:30 PM to now", "Duration only", "All day" (in the person's zone). */
  timeText: string
  seconds: number
  jobcodeId: number | null
  path: string
  short: string
  client: string
  isI7: boolean
  fields: Record<string, string>
  company: string
  project: string
  activity: string
  billable: string
  code: string
  notes: string
  kind: 'clock' | 'manual' | 'absence' | 'correction' | 'time_off'
  imported: boolean
  /** Status pills, in order (Running / Open / Submitted / Approved, Auto out, Edited, Correction: ..., Time off: ...). */
  pills: Pill[]
  autoOut: { confirmed: boolean; flagged: boolean } | null
  edited: { by: string; at: string } | null
  clockedOutBy: string | null
  locked: boolean
  /** 'submitted' | 'approved' | 'locked' when locked. */
  lockWhy: string | null
  canEdit: boolean
  /** A User on their own entry: times may only move inward. */
  shortenOnly: boolean
  canDelete: boolean
  /** Continue: start the clock with this (own, finished, timed entries). */
  canContinue: boolean
  /** Starts the moment the person's previous entry ended (a switch: the thin connector line). */
  continuesPrevious: boolean
  attention: string | null
  /** Corrections only. */
  correction: {
    state: 'pending' | 'approved' | 'denied'; reason: string; requestedAt: string; decidedBy: string | null; decidedAt: string | null; decisionNote: string | null; canDecide: boolean
    /** Who decides it (3K-3, "Clarise Nixon · goes to Rock Kai"): the person's Team Leaders, else "the Admins and Super Admins". */
    goesTo: string
  } | null
  /** Time off only (pending and denied requests; approved time off is its entries). */
  timeOff: { type: string; state: string; startDate: string; endDate: string; hoursPerDay: number; note: string; canDecide: boolean } | null
}

export interface AttentionItem {
  key: string
  reason: string
  /** "Thu, Oct 15 · 8:00 AM to 12:40 PM · i7 › Web Dev" (with the person's name in All). */
  sub: string
  cta: 'Review' | 'Fix' | 'View history'
}

export interface EntriesData {
  viewer: {
    personId: string
    zone: string
    level: AccessLevel
    leader: boolean
    /** "My | All" ("My | My team" for a Team Leader); null for a User. */
    who: 'all' | 'team' | null
    cadence: Cadence
    canSubmit: boolean
  }
  range: { from: string; to: string }
  rows: EntryView[]
  days: { date: string; label: string; seconds: number; people: number }[]
  totals: {
    seconds: number
    billable: number
    nonBillable: number
    entries: number
    attention: number
    byClient: { client: string; seconds: number }[]
  }
  attention: AttentionItem[]
  /** The Team member picker, in scope, with each person's cadence. */
  /** The people the viewer may see, each with their own time zone (a form for them reads in it). */
  people: { id: string; name: string; zone: string; teamIds: string[]; cadence: Cadence }[]
  teams: { id: string; name: string; color: string | null }[]
  /** The viewer's own current period and where it stands (the Submit button). */
  submit: { start: string; end: string; kind: Period['kind']; label: string; full: string; state: string | null; submitted: boolean }
  canAdd: boolean
  /** Pay periods for the "Pay period" segment: the anchor moves, oldest first. */
  anchors: { anchor: string; effectiveFrom: string | null }[]
}

export interface HistoryData {
  /** "Wendy Cacka · 2 - i7 Marketing › Web Dev · Thu, Oct 15, 8:00 AM to 12:45 PM (4h 45m)" */
  summary: string
  lines: { at: string; when: string; who: string; text: string; changes: { field: string; old: string; new: string }[]; reason: string | null; dot: string }[]
  /** Clocked in at 8:07 AM, recorded as 8:00 AM: both, in the person's zone. */
  real: { start: string | null; end: string | null }
  recorded: { start: string | null; end: string | null }
}

export interface SubmitSummary {
  start: string
  end: string
  kind: Period['kind']
  /** "Submit October 2026?" / "Submit Oct 4 to 17, 2026?" */
  title: string
  /** "October" / "Oct 4 to 17": "Submit October", "October submitted". */
  label: string
  /** "You submit monthly. October runs to Sat, Oct 31. A Super Admin sets this per person." */
  cadenceLine: string
  /** "After you submit, October locks. Only a Super Admin can reopen it." */
  lockNote: string
  state: string | null
  running: boolean
  totalSeconds: number
  byClient: { client: string; seconds: number }[]
  /** Weekdays with no time so far: "Mon, Oct 5, Tue, Oct 6", or "None". */
  noTime: string
  attention: AttentionItem[]
  canSubmit: boolean
  /** "Total" for a contractor, "Worked" for an employee. */
  totalLabel: string
  /**
   * What submitting makes (Invoices.dc.html 6A, 6B): a contractor's invoice or
   * an employee's payroll summary. Null when nothing is known yet (no terms).
   */
  block: {
    kind: 'invoice' | 'payroll'
    title: string
    lines: { k: string; v: string }[]
    sumLabel: string
    sum: string
    note: string
    confirm: string
  } | null
}

// ── Approvals (3L) ──────────────────────────────────────────────────────────

export interface ApprovalRow {
  key: string
  /** A timesheet is a person's sent period (Super Admins approve, return or reopen it). */
  type: 'correction' | 'time_off' | 'timesheet'
  id: number
  personId: string
  name: string
  initials: string
  team: { name: string; color: string | null } | null
  /** The request's day, YYYY-MM-DD in the person's zone (time off: its first day): "Waiting" runs oldest day first. */
  date: string
  /** Corrections: who decides it, as the review card says it ("goes to Rock Kai"); "" for time off. */
  goesTo: string
  seconds: number
  /** "Tue, Oct 13, 2026 · 4:00 PM to 5:00 PM EAT" / "Fri, Oct 16, 2026 · Vacation" (the person's zone). */
  when: string
  /** "1 - True North › Web Dev · WebDev" (corrections); a timesheet's hours by client. */
  job: string
  /** The reason, unquoted (the page quotes it). */
  reason: string
  askedAt: string
  /** "Asked Oct 15, 2026, 8:40 AM" */
  asked: string
  /** A timesheet waiting is "pending"; sent back with a reason, "returned". */
  state: 'pending' | 'approved' | 'denied' | 'returned'
  decided: { by: string; at: string; when: string; note: string | null } | null
  /** Timesheets: the period, for the card and the decision. */
  period?: { start: string; end: string }
  /** Approved corrections open the entry's history. */
  entryId: number | null
  /** The time now runs into an entry: Approve opens the review with this. */
  overlap: string | null
  canDecide: boolean
}

export interface ApprovalsData {
  level: AccessLevel
  /** The subtitle under the title, per level (exact copy). */
  subtitle: string
  note: string
  waiting: ApprovalRow[]
  decided: ApprovalRow[]
}

// ── Who's working (2A to 2P) ────────────────────────────────────────────────

export interface WorkingPerson {
  personId: string
  name: string
  initials: string
  avatarUrl: string | null
  team: { id: string; name: string; color: string | null } | null
  zone: string
  zoneAbbr: string
  status: 'on' | 'off'
  /** "Auto out" today: Clocky stopped their clock. */
  autoOutToday: { at: string } | null
  clockedOutBy: { name: string; reason: string | null } | null
  current: {
    entryId: number
    path: string
    activity: string
    /** The timer counts from here (the real start, else the recorded one). */
    timerFrom: string
    startedAt: string
    sessionStartedAt: string | null
  } | null
  /** "Off the clock, last: 5:10 PM" / "Wed, 5:10 PM": the last clock out, in their zone. */
  lastOut: string | null
  daySeconds: number
  weekSeconds: number
  /** On the clock 4h 30m or more since they clocked in, across switches. */
  over: boolean
  /** Over their hours allowance without approval: the tag's tip (Clocky part 2); null otherwise. */
  allowanceOver: string | null
  /** The last time they answered "Still working?" in this session. */
  keptGoingAt: string | null
  canClockOut: boolean
}

export interface WhosWorkingData {
  viewer: { zone: string; zoneAbbr: string; scope: 'all' | 'team'; teamNames: string[] }
  now: string
  onTheClock: number
  people: WorkingPerson[]
}

// ── Clock safety (4A, 4B) ───────────────────────────────────────────────────

export interface SafetyOccurrence {
  eventId: number
  date: string
  personId: string
  name: string
  job: string
  /** Times in the viewer's zone. */
  clockStarted: string
  stoppedAt: string
  confirmedEnd: string | null
  /** Minutes between the stop and the confirmed end ("-20m"); null when not confirmed. */
  diffMinutes: number | null
  flagged: boolean
  keptGoingEarlier: boolean
  entryId: number | null
}

export interface ClockSafetyData {
  access: 'full' | 'read'
  zone: string
  cards: { autoStops: number; people: number; confirmed: number; keptGoing: number }
  byPerson: { personId: string; name: string; team: { name: string; color: string | null } | null; autoStops: number; keptGoing: number; last: string | null; byMonth: { month: string; count: number }[] }[]
  occurrences: SafetyOccurrence[]
}

// ── Timesheet periods (5A to 5C) ────────────────────────────────────────────

export interface CadencePerson {
  personId: string
  name: string
  /** How they submit now, and what is scheduled (the pill shows the latest). */
  cadence: Cadence
  scheduled: { cadence: Cadence; from: string } | null
  /** No cadence of their own (added before it became required): shown as "Not set", submits monthly meanwhile. */
  notSet: boolean
  /** "October 2026" / "Oct 4 to 17, 2026" */
  currentPeriod: string
}

export interface TimesheetPeriodsData {
  access: 'edit' | 'read'
  anchor: string | null
  /** "Sunday, Oct 4, 2026" */
  anchorLabel: string | null
  defaultCadence: Cadence
  /** People with a cadence of their own on each, and those with none yet ("Not set"). */
  counts: { monthly: number; biweekly: number; notSet: number }
  /** The one before, the current one and the next four (5A). */
  periods: { start: string; end: string; label: string; state: 'closed' | 'current' | 'next' }[]
  people: CadencePerson[]
}
