# Time clock research, October 15, 2026

What QuickBooks Time (TSheets) and ten other products do for the three things
we are building first: the clock-in widget, Who's Working, and Time Entries.
Sources are vendor help pages unless marked. Read with
03-survey-2026-10-15.md (what Clocky already has).

## QuickBooks Time, as we use it (owner's screenshots, Oct 15, 2026)

- **Time Clock widget**: "Arnaldo clocked in at 8:00 AM"; totals CURRENT / DAY /
  WEEK (a forgotten clock showed 74:59); job search; "Top" breadcrumb; starred
  favourites (for example "1 - True North > Administrative"), folders to browse
  ("1 - True North", "2 - i7 Marketing"), a plain job ("Adventist
  Messengers/HFA"); fields 1 COMPANY, 2 PROJECT, 3 ACTIVITY, 4 BILLABLE; NOTES;
  Options; Clock Out.
- **Who's Working**: filter "On the clock", sort "Day total", groups (no group,
  Africa, Content, Graphics, Web Dev), each person with job, day total (red when
  long: 75:58, 20:28, 8:43) and current entry; MAP button; search.
- **Time Entries**: tabs Timesheets / Manual Time Card / Time Slider; Add Time,
  Actions, Submit Time; Week, Today, calendar, arrows, "Oct 11 to 17, 2026";
  My / All; team member search; rows grouped by day with Name, Time in-out
  ("4:30pm - Now"), Duration, Job, Location, Attachments, 3 Activity, Notes;
  time off rows ("Vacation", "Pending"); per-row edit, log, delete.

## QuickBooks Time, from its docs

- Clock in to a job; **Switch** starts a new job without clocking out; Take /
  End Break (minimum break length possible). Favourites, recents and "required
  fields prompted at clock out" are documented for the mobile app.
  https://quickbooks.intuit.com/learn-support/en-us/help-article/track-worker-time/clock-switch-jobs-customers-clock-quickbooks-time/L2u6w82Ox_US_en_US
- Custom fields carry a required flag, apply to timesheet/user/jobcode, can be
  limited to linked jobcodes, and can depend on each other.
  https://cdn.cdata.com/help/HCN/ado/pg_table-customfields.htm
- Who's Working: green on the clock, orange on break; filter all / on the clock;
  sort by clock-in, day total, name, location, job; a manager can clock someone
  in or out; map from app GPS.
  https://quickbooks.intuit.com/learn-support/en-us/help-article/employee-management/use-working-window-quickbooks-time/L6gAOMere_US_en_US
- Timesheets: My / All, team search, Day/Week/Month/Year/Pay period; only 6
  columns (custom fields count); Edit, View Log, Delete; manager edits marked
  "Edited by Manager" in red; Add Time as In/Out or Duration.
  https://quickbooks.intuit.com/learn-support/en-us/track-worker-time/view-timesheets/00/380826
- Manual Time Card: week grid of hours per job. Time Slider: drag a day bar per
  person to open the editor (third-party description).
- Submit Week locks editing until rejected. Approving locks that period AND all
  earlier time; reject needs a reason. No native auto clock-out found.
  https://quickbooks.intuit.com/learn-support/en-ca/help-article/time-tracking/approve-unapprove-quickbooks-time-hours-quickbooks/L5HJLyUNr_CA_en_CA
- Complaints: dated interface, overwhelming at first, cost, awkward client
  switching, three editing surfaces for the same data, 6-column cap, approval
  locks all earlier time. https://www.capterra.com/p/151722/TSheets/reviews/

## Competitors, the patterns worth knowing

| Product | Pattern |
|---|---|
| Clockify | required fields block STOP, not start (start now, fill later); idle detection (keep/discard, private); reminders; team table of what each person runs now; week grid with copy last week and templates; calendar drag to move/resize; approved entries locked even for admins (withdraw with a note); audit log with old/new values |
| Toggl Track | Continue any entry (C key), N new, M manual, @ project and # tag in the description; calendar drag to create; idle keep/discard/log separately; weak "who's working" |
| Harvest | day view for timers, week grid for bulk; a new timer stops the old one; stuck timer indicator; copy previous timesheet; long-running timer reminder; cannot submit with a timer running; week approval locks the week |
| Jibble | in / on break / out dashboard with activity and project; switch without clocking out; auto clock-out (after a duration or at a time, adjustable at clock-in); change history per entry |
| Hubstaff | idle: discard, keep, keep but reassign to another project; manual time needs approval with a reason; reviewer picks which overlapping hours to keep; submitted/approved time locked |
| Homebase | auto clock-out after shift or ask the real end time; reminders by email/SMS/push; flags on the list (missing clock-out, missing break) |
| Deputy | auto-approve clean timesheets; original start time kept beside the approved one |
| Connecteam | auto clock-out and admin alerts; lock specific days; dots for admin-created/edited entries with who and when |
| Rippling | job switches mid-shift; alerts for overtime, forgotten clock-outs, timecards to approve |
| Gusto | log hours at once or clock in; shift split at midnight; employees edit until approval |

## The 15 ideas we took from it

1. One-click Resume of the last entry and Continue on any past entry.
2. Start now, fill in later: required fields block clock-out, not clock-in.
3. Smart defaults from the job (Company, Project, Billable filled by the job;
   only the fields that apply are shown).
4. Favourites + Recent + type-ahead search over the full job path.
5. Forgotten clock-out safety net: reminder, auto-stop, "confirm your real end
   time", flag for the manager.
6. Idle return prompt in the browser (opt-in, private): keep, discard, move.
7. One editing surface: a day timeline (drag to create, resize, move).
8. Block overlaps at save, with a fix-it choice.
9. Week grid with "Copy last week" and templates (replaces Manual Time Card).
10. Who's Working for remote teams: by team, job, elapsed, day and week totals,
    the person's local time, long-running tinted, on break, no map.
11. Visible edit trail on every entry (who, what, old and new values).
12. Clear submit, approve and lock rules (lock only the approved period, no
    submit with a running clock, reasons on return, withdraw with a note).
13. Approval flags and optional auto-approve of clean weeks.
14. Keyboard shortcuts and the running timer in the top bar and the tab title.
15. End-of-day nudge in the widget and the daily summary; Switch is atomic.

Extras: breaks as a status with an optional minimum; split at midnight per day
(people in Africa and the US); installable on a phone home screen (PWA).
