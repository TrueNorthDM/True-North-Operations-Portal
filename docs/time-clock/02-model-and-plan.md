# The portal's own time clock: model and plan

Proposal, not yet built. Nothing here is connected to anything outside the
portal: no writes to TSheets, no payroll, no Rippling, until the whole thing is
approved.

## Decisions already taken

1. **Store raw time, round only on the way out.** TSheets rounds every clock in
   and out to the nearest 15 minutes, so what it stores is already the rounded
   number. We keep what actually happened and apply rounding when producing
   payroll, which turns the rule into a setting instead of into the data.
2. **Overtime stays uncalculated**, as it is today.
3. **Absence becomes its own entity**: a person requests days, someone approves,
   the balance moves, and the hours are generated. Today it is just another job
   code, which is why an approved vacation is indistinguishable from work.

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

| # | What | Ends with |
|---|---|---|
| 0 | Schema + settings page, read only, showing the imported rules | The rules on screen, no clock yet |
| 1 | Import: 545 job codes, 70 users, 136,167 entries, resumable and idempotent | A reconciliation screen: our monthly totals against TSheets', month by month, 2017 to today |
| 2 | The clock: start/stop, today's list, weekly timecard, manual entry, notes | People *can* track time in the portal, in parallel with TSheets |
| 3 | Submit and approve, by team, on the monthly period | The approval flow that today happens by email |
| 4 | Absence: request, approve, balance, generated entries | PTO stops being a job code |
| 5 | Point the existing reports at `tc_entries` | The i7 and Grant Pass reports read from us, not from the cache |
| 6 | Payroll output for Rippling | A file or an API call, once we know which |
| 7 | Cutover: freeze TSheets, final delta import | TSheets read-only, then gone |

Phase 1 is the one that decides whether the rest is trustworthy, which is why it
ends in a reconciliation and not in a "done". If our March 2019 does not match
theirs to the second, the import is wrong and everything built on it inherits
the error.
