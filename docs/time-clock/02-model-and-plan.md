# Clocky Hours: model and plan

The module is **Clocky Hours** at /clocky-hours, admin only while it is built.
Its person-facing half is **My Hours** at /hours.

Written as a proposal. Nothing here is connected to anything outside the
portal: no writes to TSheets, no payroll, no Rippling, until the whole thing is
approved.

## Decisions already taken

1. **Store raw time, round only on the way out.** TSheets rounds every clock in
   and out to the nearest 15 minutes, so what it stores is already the rounded
   number. We keep what actually happened and apply rounding when producing
   payroll, which turns the rule into a setting instead of into the data.
2. **Overtime stays uncalculated**, as it is today.
3. **Absence becomes its own entity**: a person requests days, someone approves,
   and the hours are generated. Today it is just another job code, which is why
   an approved vacation is indistinguishable from work.

Three more, taken during the build, each from looking at the data rather than
deciding in the abstract:

4. **Balances do not gate a request.** All 26 active people carry a PTO balance
   of zero for every type in QuickBooks Time, which is how you can tell nobody
   maintains them. Checking a request against one would have refused every
   request ever made. The table stays for when there is a policy to put in it.
5. **The catch-up runs itself**, every four hours, and the plan to run the full
   import by hand for the length of the parallel period is dead. The delta takes
   twenty seconds against forty-five minutes.
6. **The client report's month picker stops at January 2026**, though the hours
   go back to 2022. Budgets and rates both start in 2026, so an earlier month
   would show real hours beside a cost of zero, and zero is not unknown. See the
   note in lib/tsheets/retention.ts.

## Tables

Prefix `tc_` for time clock, to sit beside the existing `tr_` report tables
without colliding with them.

### tc_jobcodes
The tree, all 545 of them, active and not.
`id, parent_id, name, kind ('regular'|'pto'|'unpaid'), billable, active,
external_id (TSheets id), sort_name`.

Inactive codes are imported and kept. Nothing in this module ever filters by
`active` when reading history; `active` only decides what a person may pick now.

### tc_entries
One row per stretch of time.

`id, person_id, jobcode_id, started_at timestamptz, ended_at timestamptz null,
duration_seconds int, entry_date date, kind ('clock'|'manual'|'absence'),
state ('open'|'submitted'|'approved'|'locked'), notes text, fields jsonb,
source ('portal'|'tsheets'), external_id bigint unique, created_by,
created_at, updated_at`.

- `started_at` / `ended_at` null for imported `manual` rows, where TSheets never
  had them. `duration_seconds` is always populated, so every reader has one
  reliable number.
- `entry_date` is the day the entry belongs to in the company timezone, kept
  separately because that is what every report groups by and it must not shift
  with a timezone change.
- `fields jsonb` holds the five dropdowns, keyed by our own field ids. Config
  lives in `tc_fields` / `tc_field_options` so the settings page can add one
  without a migration, with expression indexes on the keys the reports group by.

### tc_fields, tc_field_options
The entry form, as data: `name, position, required, active`, and the options with
`label, active, position`. Seeded from the six TSheets custom fields, including
the two switched off, because old entries still carry their values.

### tc_periods, tc_submissions
`tc_periods`: the monthly pay periods, generated from settings.
`tc_submissions`: `person_id, period_id, submitted_at, approved_at, approved_by,
state, note`. This replaces the pair of dates TSheets keeps on the user record,
which cannot answer "who approved March" once April is submitted.

### tc_absence_requests, tc_absence_balances
Built. Balances are informational only, see decision 4.

`tc_absence_requests`: `person_id, type_id (a pto jobcode), start_date, end_date,
hours_per_day, state ('pending'|'approved'|'denied'|'cancelled'), reason,
requested_at, decided_by, decided_at, decision_note`.
An approved request generates `tc_entries` rows with `kind='absence'`, which is
what keeps the timecard honest without anyone typing hours.

`tc_absence_balances`: `person_id, type_id, year, accrued_hours, used_hours,
carried_hours`. Seeded once at cutover from the TSheets `pto_balances`, because
the request history behind them cannot be migrated (the API does not expose it).

### tc_settings
One row, the settings page: timezone, week start, pay period type and anchor,
rounding (on, direction, minutes) applied at payroll only, auto clock-out hours,
split at midnight, overtime rules, which fields are required, who may edit past
entries.

### tc_entry_audit
`entry_id, changed_by, changed_at, before jsonb, after jsonb`. We are replacing a
system of record for hours worked. Every edit to a submitted or approved entry
has to leave a trace, and it costs almost nothing to write it from the start.

## Phases

Each one ends with something visible, and nothing is connected outward until the
last two.

| # | What | State |
|---|---|---|
| 0 | Schema + the rules | **Done**, and the rules are editable rather than read-only |
| 1 | Import, resumable and idempotent | **Done.** 136,404 entries, 116 months reconciling entry for entry. A cron keeps it current every four hours |
| 2 | The clock: start/stop, week, manual entry, notes | **Done**, tested end to end in production |
| 3 | Submit and approve | **Built.** Submit, freeze and reopen tested; approve and hand back still need a second person |
| 4 | Absence: request, approve, generated entries | **Built.** Request and cancel tested; approve and deny still need a second person |
| 5 | The reports read `tc_entries` | **Done.** Checked month by month against the old cache before switching, buckets identical |
| — | Grant Pass report | **Done.** 756 entries, 479 hours, July 2017 to July 2026 |
| 6 | Payroll output for Rippling | Waiting on who owns the current connection. Rippling accepts input by API |
| 7 | Cutover: freeze TSheets, final delta, fix the import cutoff date | Not started |

The two halves of phases 3 and 4 that are untested need one thing: a second
person. The plan is a placeholder profile, created when the module is otherwise
finished, rather than involving anyone real before then.

Phase 1 is the one that decides whether the rest is trustworthy, which is why it
ends in a reconciliation and not in a "done". If our March 2019 does not match
theirs to the second, the import is wrong and everything built on it inherits
the error.

## What the build taught, kept because it will apply again

**The admin is the worst person to test as.** Three separate defects were
invisible to an admin and obvious to anyone else: My Hours showing the whole
company's 440 hours, submitting behaving differently depending on who pressed
it, and the Grant Pass report answering in 187ms for the service role while
timing out for a real session. Policies combine with OR, so the admin blanket
policy satisfies every read on its own and hides whatever the narrower policy
was doing.

**Intent belongs in the query, not in the permission.** "Mine", "born here",
"this person's" are what a page MEANS. A permission that happens to coincide is
a floor, not a definition, and the day they diverge the page is wrong rather
than merely permissive.

**Measure before deducing.** Twice the first two explanations were wrong and the
third attempt was a probe that settled it in one call: the delta's 417, which
was a fractional-seconds watermark and not a range; and the report picker, where
the carryover I predicted would break turns out to be zero minus zero. Both
probes cost about thirty seconds.

**A correctness check is not a performance check.** The report source swap
matched to the second and still froze the page, because comparing numbers says
nothing about what they cost to produce.
