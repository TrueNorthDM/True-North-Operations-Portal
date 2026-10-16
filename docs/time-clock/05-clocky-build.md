# Clocky build, from the design handoff (Oct 16, 2026)

The design is final: `Design/design_handoff_clocky/` (README.md wins over SPEC.md;
the `.dc.html` files are the visual truth: measure them, do not invent). Served
locally by the `clocky-design` preview config at http://localhost:4323/ (each
file opens a frame with `?frame=CODE`, phone with `&device=phone`, and has a
level switch at the top).

Owner instructions: replicate the design exactly ("nao invente nada, nao
adivinhe nada"; measure sizes, colours, fonts, button styles), build all of it,
the owner verifies after. Release: STAGING ONLY until the owner verifies.

## Owner decisions (Oct 16, 2026)

1. Clocky for everyone: one hub "Clocky" in the rail for every level, rows
   filtered by level. `/hours` redirects to `/clocky-hours`; the My Hours hub
   leaves the nav.
2. Routes: `/clocky-hours` (Time entries), `/clocky-hours/approvals`,
   `/clocky-hours/whos-working`, `/clocky-hours/safety`, `/clocky-hours/reports`
   (SOON), `/clocky-hours/import` (the existing import + reconciliation + the
   remaining rules such as the import cutoff move here).
3. The menu row is "Approvals" (not "Approvals and Invoices").

## Screen inventory (code, file, frame)

| Code | Screen | Prototype |
|---|---|---|
| TB | Top bar clock button, 4 states | Clock Panel (top of each frame) |
| 1A 1B 1C 1Cb 1D 1E 1F 1H 1I 1J 1K 1L 1N2 1N3 | Clock panel states, desktop and phone | Clock Panel `?frame=` |
| 2A 2Am 2B 2C 2D 2E 2P | Who's working drawer, row menu, page | Who's Working `?frame=` |
| 3A1 3A2 3A3 3Am 3B1 3B2 3B3 3C1 3C2 3C3 3C4 3E1 3E2 3E3 3F 3G 3H1 3H2 3H3 3I 3J 3K1 3K2 3K3 3K4 3L 3L2 E | Time entries, modals, approvals | Time Entries `?frame=` |
| 4A (data) 4B (empty), N1 (bell), N3 (bellLead), N4 (bellUser), N2 (email) | Clock safety, bell rows, email | Clock Safety `?frame=` |
| 5A 5A2 5B 5B2 5C 5C2 5C3 | Timesheet periods: Company settings, person Work tab, Rates & Costs | Timesheet Periods `?frame=` |
| Select | The dropdown inside all of them | Select.dc.html |

## Build steps and ownership

1. Foundation (data, rules, server actions, jobs, notifications): migrations
   112+, `src/lib/timeclock/**`, `src/app/(app)/clocky-hours/**/actions.ts`,
   cron, catalogue. Its API is written below under "API as built".
2. UI, three parallel tracks on disjoint files:
   - A. Top bar clock button + clock panel (TB, 1x) + Who's working (2x).
   - B. Time entries page (3A to 3K) + Approvals (3L).
   - C. Clock safety (4x), bell rows and email (N1 to N4), Timesheet periods
     (5x), nav (Clocky hub for everyone, /hours redirect), System manual.
3. Verification against the prototypes, staging.

## API as built

Foundation step, October 16, 2026. Nothing is committed, deployed or applied to a
database yet. Run the two migrations on staging first, then
`deploy/db/gen-types.sh` (the generated types were extended by hand to match
them and should come out the same).

### Conventions

- Every action is a Server Function (`'use server'`) returning
  `{ ok: true, ...data }` or `{ ok: false, error }` (`Result` / `Fail` in
  `src/lib/timeclock/clocky-types.ts`). `error` is a sentence to show as is.
  Some refusals carry more, for the screen to open the right fix:
  `missing` (1F: what the running entry lacks), `overlap` (3F: the entry the
  times run into, with the shared span), `stopped: true` (the clock had passed
  its 5-hour mark and Clocky stopped it: show 1L), `attention` (3H).
- Writes are for the person really signed in (`writerAccess`); during a View
  Stage preview every write answers "View Stage is only a preview. Close it to
  ...". Reads (`get...`) follow `loadAccess`, so a preview shows that level.
- Times are ISO instants. Days are `YYYY-MM-DD` in the entry owner's own time
  zone (personal settings, default America/New_York). Form times are sent as
  `"HH:MM"` (24-hour) in the owner's zone, or `"now"` to keep a running entry
  running. Every recorded time is on the quarter hour; every duration or total
  returned is a whole number of seconds on the quarter hour (format with
  `formatDuration` "7h 45m" or `formatClock` "7:45" from
  `src/lib/timeclock/rounding.ts`). Live timers use `formatTimer` from the
  real start (`startedAtReal ?? startedAt`, or `timerFrom`) and the server's `now`.
- Fields are `Record<tc_fields id as text, value>`: Company, Project, Activity,
  Billable always required to switch or clock out, the i7 Code only on i7 jobs,
  notes when the Activity says "in Notes". `PanelField.required` is `'always'`
  or `'i7'`.
- Toast copy comes back in `toast` where the design gives it; the UI shows it as is.
- Pure helpers the screens can import (no server code): `rounding.ts`,
  `format.ts` (`timeLabel`, `dayLabel` "Thu, Oct 15", `dateLabel` "Oct 9, 2026",
  `rangeLabel` "Oct 4 to 17", `timeWithZone` "2:15 PM EAT", `zoneAbbr`,
  `shortJob` "i7 › Web Dev", `clientOf`), `periods.ts` (`periodContaining`,
  `payPeriodStart`, `periodLabel`, `rangeText`, `cadenceLine`), `scope.ts`
  (`SHORTEN_ONLY`), `entry-rules.ts` (`gateText`, `missingFields`, the 3E check
  line copy `END_AFTER_START`, `DURATION_FORMAT`, `OVER_24H`, `overlapLine`),
  `safety.ts` (`KEEP_GOING_TOAST_PANEL`, `KEEP_GOING_TOAST_BELL`),
  `clocky-types.ts` (every returned shape).

### Access (src/lib/access/catalogue.ts, module Clocky)

Starting answers per level as README "Who sees what"; a Super Admin can still
change a tick on Admin > Access levels. Scope rules are `src/lib/timeclock/scope.ts`.

| Key | Item | Admin / Team Leader / User |
|---|---|---|
| `clocky-hours` | Time entries, and the clock in the top bar (page) | yes / yes / yes |
| `ck-team` | See and change the hours of the teams they lead | yes / yes / no |
| `ck-all` | See and change everyone's hours | yes / no / no |
| `ck-reopen` | Reopen a submitted period | Super Admin only |
| `ck-rules`, `ck-import`, `ck-recon` | Rules, Import, Reconciliation (move to `/clocky-hours/import`) | yes / no / no |
| `clocky-approvals` | Approvals (page) | yes / yes / no |
| `ck-timeoff` | Decide time off | Super Admin only |
| `ck-whos-working` | Who's working (page and drawer) | yes / yes / no |
| `ck-clock-out-for` | Clock out for them (2E) | Super Admin only |
| `clocky-reports` | Reports (SOON) | yes / yes / yes |
| `ck-safety` | Clock safety (page; read only below Super Admin) | yes / no / no |
| `cs-periods` | Company settings > Timesheet periods (tab) | yes / no / no |
| `cs-periods-edit` | Change the timesheet periods (anchor, default, cadences) | Super Admin only |

The rail (`src/lib/access/nav.ts`) still has the old Clocky rows; track C
points them at these keys (Time entries, Approvals with
`getApprovalsCount`, Who's working, Reports, Clock safety, Timesheet periods,
Import) and removes the My Hours hub. Pages guard with `requireSurface(key)`.

### Data (migrations 112 and 113)

- `tc_entries` gains `started_at_real`, `ended_at_real`, `session_started_at`,
  `window_started_at`, `auto_stopped_at`, `end_confirmed_at`,
  `end_confirmed_by`, `end_flagged`, `clocked_out_by`, `edited_by`,
  `edited_at`, `changed_here_at` (an imported entry the portal changed; the
  import leaves it alone). `started_at` / `ended_at` / `duration_seconds` stay
  the counted (rounded) values.
- `tc_entry_audit.reason`, and the actions `clock_in`, `switch`, `clock_out`,
  `undo_clock_out`, `auto_stop`, `confirm_end`, `keep_going`, `add`, `edit`,
  `trim`, `grid`, `clocked_out_for`, `correction_approved`, `imported`,
  `reopen` (plus the old `create`, `update`, `delete`). A reason is required by
  the database for `add`, `edit`, `trim`, `grid`, `clocked_out_for`, and by the
  server for `delete`.
- New, server only: `tc_correction_requests`, `tc_combinations`,
  `tc_person_cadence` (with `one_period` for the last stretch of pay periods
  before monthly), `tc_pay_period_anchors`, `tc_safety_events`
  (`warned` / `keep_going` / `auto_stop`, one per window).
- `tc_settings.pay_period_anchor`, `tc_settings.default_cadence`,
  `tc_periods.kind` (`month` / `pay_period`), `notifications.done_note`.
- `tc_job_field_defaults(p_since, p_keys)`: the smart defaults in one read
  (service role only).
- 113: no INSERT / UPDATE / DELETE for the signed-in or anonymous role on
  `tc_entries`, `tc_submissions`, `tc_absence_requests`, `tc_entry_audit`,
  `tc_periods`, `tc_settings` (the admin blanket rule becomes read only);
  `db_protections_check()` watches all of it.

### Clock panel: `src/app/(app)/clocky-hours/clock-actions.ts`

| Function | Input | Returns (`ok: true` +) |
|---|---|---|
| `getClockPanel()` | | `data: ClockPanelData`: `me`, `now`, `today`, `todayLabel`, `todaySeconds`, `weekSeconds`, `running: RunningEntry or null` (recorded and real start, `roundNote`, `missing`), `safety` (`windowStartedAt`, `warnAt`, `stopAt`, `warn`, `panelText` = 1I copy), `toConfirm: ToConfirm[]` (1L: `stopWhen`, `text`, `options`, `laterOptions`), `resume`, `combinations` (all, ordered: show 6 + More), `recents` (5), `todayByCombination`, `jobs`, `folders`, `fields`, `defaults` (job id -> field id -> value), `locked` (1N sentence or null), `period`, `firstTime` (1B), `correctionGoesTo` (3K-1 line). Stops a clock past its 5-hour mark first (not in a preview). |
| `clockIn(input)` | `{ jobcodeId, fields?, notes? }` | `entryId, startedAt, startedAtReal`. Refusals: "Pick a job code.", "You are already clocked in. Stop that one first.", the locked sentence, `stopped`. |
| `switchTo(input)` | `ClockInput & { finish?: { fields?, notes? } }` | `entryId` (the new one), `previous: { label, todaySeconds }`, `toast` ("Switched to TN Admin. i7 Web Dev: 2h 10m."). Refused with `missing` and the 1F sentence while the running entry lacks a field (what `finish` sent is saved anyway). |
| `clockOut(input?)` | `{ finish? }` | `entryId, endedAt, recordedEnd, todaySeconds, undoUntil, toast` ("Clocked out at 5:10 PM, recorded as 5:15 PM. Today 8h 15m."). Same `missing` refusal (1H). |
| `undoClockOut({ entryId })` | the `entryId` clockOut returned | `{}`; refused after 10 s (+5 s grace): "It is too late to undo that clock out." |
| `saveRunningDetails(input)` | `{ fields?, notes? }` (merged into the running entry) | `missing`. No reason, no history line: the notes autosave of 1E. |
| `keepGoing()` | | `windowStartedAt`, `toast` (panel copy), `toastFromBell` (bell copy). Marks the bell's "Still working?" row done ("You kept going at 12:31 PM. Clocky asks again in 4h 30m."). |
| `confirmEnd(input)` | `{ entryId, end: ISO, stillWorking?: boolean }` (`end` = the stop for "Keep 1:00 PM") | `recordedEnd, flagged, toast` ("End time confirmed: 12:45 PM. Today 4h 45m. Flagged for the approver."). Later than the stop only with `stillWorking`, up to now. |
| `createCombination(input)` / `updateCombination(input & { id })` | `{ name, jobcodeId, fields?, notes? }` | `combination: ClockChoice, toast` ("Saved i7 Web Dev."). |
| `deleteCombination({ id })` | | `toast` ("Deleted i7 Web Dev."). |
| `reorderCombinations({ ids })` | every id of the person's combinations, in the new order | `{}` |
| `requestTimeOff(input)` | `{ jobcodeId (a time off code), startDate, endDate, hoursPerDay, reason? }` | `requestId`. Super Admins hear of it in the bell. |

### Time entries: `src/app/(app)/clocky-hours/entries-actions.ts`

| Function | Input | Returns |
|---|---|---|
| `getEntries(query)` | `{ from, to (at most 62 days), who: 'my' or 'all', personId?, teamId? }` | `data: EntriesData`: `viewer` (`who`: 'all', 'team' or null, `cadence`, `leader`), `rows: EntryView[]` (entries, pending and denied corrections, pending and denied time off; each with `pills`, `canEdit`, `shortenOnly`, `canDelete`, `canContinue`, `continuesPrevious`, `locked`, `attention`, `zoneAbbr` when not the viewer's), `days`, `totals` (work only; corrections and time off count in none), `attention: AttentionItem[]` (Review / Fix / View history), `people` (Team member picker, with cadence), `teams`, `submit` (the viewer's own period and state), `canAdd`, `anchors`. |
| `getEntryHistory({ id })` | | `data: HistoryData`: `summary`, `lines` (newest first: `when`, `who`, `text`, `changes` old/new, `reason`, `dot`), `real`, `recorded`. |
| `addTime(input)` | `EntryInput & { personId }`: `{ date, mode: 'range' or 'duration', start?, end?, duration?, jobcodeId, fields?, notes?, reason, fix? }` | `entryId, toast` ("Added 2h 00m on Thu, Oct 15."). Leaders only (a User gets "Hours come from your clock. To add time, ask your Team Leader."). |
| `editEntry(input)` | `EntryInput & { id }` | `entryId, changes, toast` ("Saved. 2 changes kept in the history." / "Saved. Nothing changed."). A User: same date and kind, times only inward, else `SHORTEN_ONLY`. Confirms an unconfirmed automatic stop. |
| `deleteEntry({ id, reason })` | | `toast` ("Entry deleted. The reason is kept in the change log."). |
| `saveWeekGrid(input)` | `{ personId, weekStart, rows: [{ jobcodeId, fields?, cells: { 'YYYY-MM-DD': '2:30' } }], reason }` (only changed cells) | `weekSeconds, toast` ("Saved. Week total 37h 15m."). Refuses "More than 24 hours on Wed. ..." and 'Use "2:30" or "2.5" in Wed.'. |
| `requestCorrection(input)` | `{ date (this week), start, end, jobcodeId, fields?, notes?, reason }` | `requestId, goesTo, toast` ("Request sent to Rock Kai. It counts once it is approved."). Refuses an overlap (`overlap`, 3K red line). |
| `getSubmitSummary({ start? })` | the viewer's current period, or the one holding `start` | `data: SubmitSummary`: `title` ("Submit October 2026?"), `label`, `cadenceLine`, `lockNote`, `state`, `running`, `totalSeconds`, `byClient`, `noTime`, `attention`, `canSubmit`. |
| `submitPeriod({ start, end })` | | `locked, toast` ("October submitted. 23 entries are now locked."). Refuses "Clock out first. Your clock is running.", attention (`attention`), empty, no approver. |
| `reopenPeriod({ personId, start, end, reason? })` | Super Admins | `{}` |

3F (overlap fix): resend `addTime` / `editEntry` with `fix: { otherId, trim: 'other' or 'this' }`
(`otherId` = `overlap.entryId` from the refusal). "Trim the other" saves the
other entry shorter (history: "trimmed this entry to fix an overlap", same
reason); "Trim this one" saves this one shorter; "Nothing left to keep. Cancel
instead." when nothing would remain.

### Approvals: `src/app/(app)/clocky-hours/approvals/actions.ts`

| Function | Input | Returns |
|---|---|---|
| `getApprovals()` | | `data: ApprovalsData`: `subtitle` (per level), `note`, `waiting`, `decided` (`ApprovalRow`: `type`, `when` in the person's zone, `job`, `reason`, `asked`, `decided`, `overlap` (Approve opens the review instead), `entryId` for the history drawer). |
| `getApprovalsCount()` | | `count` for the menu pill (0: no pill). |
| `decideCorrection(input)` | `{ id, decision: 'approve' or 'deny', note? }` (note required to deny) | `entryId?` (approve), `toast` ("Approved. 1h 30m added to Clarise Nixon's entries. Clarise gets a notification." / "Denied. Clarise gets the reason."). |
| `decideTimeOff(input)` | same | `{}` (Super Admins; approve writes the entries, refused into a locked period). |

### Who's working: `src/app/(app)/clocky-hours/whos-working/actions.ts`

| Function | Input | Returns |
|---|---|---|
| `getWhosWorking()` | | `data: WhosWorkingData`: `viewer` (`scope`, `teamNames` for "You lead Web, so you see your team only."), `now`, `onTheClock`, `people: WorkingPerson[]` (everyone in scope; filter "On the clock" by `status`; group by `team`; `zoneAbbr`, `current.timerFrom`, `daySeconds`, `weekSeconds`, `over` (4h 30m since clock in), `keptGoingAt`, `autoOutToday`, `clockedOutBy`, `lastOut`, `canClockOut`). |
| `getWhosWorkingCount()` | | `count` for the top-bar badge. |
| `clockOutFor(input)` | `{ personId, end?: ISO or 'now', reason }` (Super Admins) | `toast` ('Justus Tsofa clocked out at 10:59 AM. Marked "Clocked out by Arnaldo Oliveira".'). |

### Clock safety: `src/app/(app)/clocky-hours/safety/actions.ts`

`getClockSafety({ period?: 'month' or '3m' or 'all', q? })` returns `data: ClockSafetyData`:
`access` ('full' or 'read'), `cards`, `byPerson` (with `keptGoing`, `last`, `byMonth` for the last four months), `occurrences`
(times in the viewer's zone, `confirmedEnd` null = "Not confirmed", `diffMinutes`, `keptGoingEarlier`, `entryId`).

### Timesheet periods: `src/app/(app)/clocky-hours/periods/actions.ts`

| Function | Input | Returns |
|---|---|---|
| `getTimesheetPeriods()` | | `data: TimesheetPeriodsData`: `access`, `anchor`, `anchorLabel`, `defaultCadence`, `counts`, `periods` (one closed, current, next four), `people` (`cadence`, `scheduled`, `currentPeriod`). |
| `previewAnchorMove({ anchor })` | | `data: AnchorPreview`: `movedText` (5A amber line), `dialog` ("Move the pay periods?"), `oldCurrent`, `newCurrent`, `gap`, `effectiveFrom`. |
| `setPayPeriodAnchor({ anchor })` | Super Admins | `effectiveFrom` |
| `setDefaultCadence({ cadence: 'monthly' or 'biweekly' })` | Super Admins | `{}` |
| `previewCadenceChange({ personIds, cadence })` | | `data: CadencePreview[]`: `change` ("Monthly → Every 2 weeks"), `plan.text` (5B starts line, 5C dialog), `plan.effectiveFrom`. |
| `setCadence({ personIds, cadence })` | Super Admins, one or many | `changed: [{ personId, effectiveFrom, text }]` |

### The bell and the email

Notification types (src/lib/notifications/catalogue.ts, Tools tab), each with
`button` (`{ label, href? , action?: 'keep-going' or 'open-clock' }`) that
`loadInbox` passes to `NotificationItem.button`, and `done` (the done line):

| Type | When | Text (the row's title; body empty) | Button |
|---|---|---|---|
| `clocky-still-working` | 4h 30m, once per window, bell only | "Still working? Your clock has been running 4h 30m since you clocked in at 8:00 AM. It stops at 5h 00m unless you keep it going." | Keep going (call `keepGoing`) |
| `clocky-stopped` | 5h 00m, bell + the email | "Your clock stopped by itself at 1:00 PM. Confirm when you really stopped." | Confirm end time (open the panel) |
| `clocky-correction-requested` | to the person's Team Lead, Admins, Super Admins | "Samuel Manzi asked for a time correction: 1h 00m on Tue, Oct 13, 4:00 PM to 5:00 PM." | Review → `/clocky-hours/approvals` |
| `clocky-correction-decided` | to the requester | "Rock Kai approved your time correction: ..." / "... denied ... Reason: "..."" | Open time entries → `/clocky-hours` |
| `clocky-timeoff-requested` | to Super Admins | "Olivia Hale asked for time off: Vacation, Fri, Oct 16 (8h 00m)." | Review → `/clocky-hours/approvals` |
| `clocky-auto-stops` | daily summary, Super Admins | "2 automatic clock-outs yesterday: Wendy Cacka, Justus Tsofa." | Open Clock safety → `/clocky-hours/safety` |

The clock rows' `href` is `/clocky-hours?clock=open`: the top bar opens the
clock panel when it sees `clock=open`. The email is `src/lib/email/clock-stopped.ts`
(`renderClockStopped`), sent once per stop with the bell row.

### The safety job

`GET /api/cron/clocky-safety` every 5 minutes (`deploy/cron/portal.crontab`),
`src/lib/timeclock/clocky-safety-run.ts`: warns at 4h 30m, stops at 5h 00m (the
5-hour mark recorded on the quarter hour, the real mark kept, logged in
`tc_safety_events`, bell + email), for portal clocks and clocks open from
QuickBooks Time alike; once a day the Super Admins' line. Any action or the
panel that finds a clock past its mark stops it the same way first.
