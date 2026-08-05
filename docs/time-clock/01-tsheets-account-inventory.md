# QuickBooks Time account, what is actually in it

Surveyed on 2026-08-05 through `/api/admin/tsheets-inventory`, read only, 52 GET
calls. This is the input to the portal's own time clock: what has to be
reproduced, what has to be migrated, and what can be dropped on purpose.

## The account

| | |
|---|---|
| Company | True North (`truenorthagency`), plan `plus` |
| Timezone | `America/New_York`, week starts Sunday, 12h clock, US dates |
| Pay period | monthly |
| History begins | 2017 (nothing before, first schedule calendar created 2017-07-10) |

## Volume to migrate

| Year | Entries | of which manual |
|---|---:|---:|
| 2017 | 3,067 | 480 |
| 2018 | 7,759 | 1,240 |
| 2019 | 7,726 | 1,327 |
| 2020 | 9,641 | 2,022 |
| 2021 | 12,692 | 2,129 |
| 2022 | 21,578 | 1,323 |
| 2023 | 22,476 | 1,510 |
| 2024 | 21,346 | 833 |
| 2025 | 19,536 | 741 |
| 2026 (to Aug) | 10,346 | 215 |
| **Total** | **136,167** | **11,820** |

`regular` entries carry a clock in and out. `manual` entries carry only a
duration, and they are not a rounding error: 8.7% of the whole history, and
almost all of the PTO. Both shapes have to exist in our model.

Pulling a year takes 4 to 5 minutes through the API at 200 records a page, so a
full import is roughly 45 minutes of paging. It has to be resumable and
idempotent, not a single long request.

## People

70 users, **26 active and 44 inactive**. The inactive ones own a decade of the
history, so they have to come across as people, not as orphaned ids.

A user record carries: `pay_rate`, `pay_interval`, `pto_balances`,
`permissions`, `submitted_to`, `approved_to`, `manager_of_group_ids`,
`hire_date`, `term_date`, `payroll_id` (empty for everyone here).

13 groups, 6 already inactive. `manager_of_group_ids` is the approval chain, and
it maps almost one to one onto the portal's teams. One thing to fix on the way
in: Sandrine Umuhoza is inactive but is still listed as manager of Rwanda and
Web Dev.

## How time is entered today

Entry method is the weekly timecard. A line needs a job code (`jobcode_is_optional: 0`)
plus **five required dropdowns**:

| Field | id | Values |
|---|---|---|
| 1 Company | 129626 | COE · DDI · GNA/COEI · True North |
| 1 - i7 Code | 129628 | 23 (BE-*, MME-*, WM-*, WMFL-*, WMFP-*, WMW-*, i7-*, `1 None`) |
| 2 Project | 129636 | 14 (AAAF, ASI, Africa, Called!, **GP School**, **GP church**, GYC, In-House, Internship, Messiah's Mansion, NAD, Rwanda, `not listed--ask Dave`) |
| 3 Activity | 19156 | 41 |
| 4 Billable | 19158 | yes · no · 50% (off) |

`Tasks` (126808) is optional. Notes are enabled, up to 4000 characters.

Two fields are switched off but their historical values are still on old
entries: `i7 Rate` (35/40/50/65) and `Client Rate` (90/100).

## Rules currently in force

These are the settings the portal's own settings page has to be able to express,
whatever we decide to do with them.

- **Rounding is on**: clock in and clock out both round to the *nearest 15
  minutes*. Every hour figure the portal shows today is already rounded.
- **Auto clock-out after 8 hours** (`clockout_override`), for forgotten clock-outs.
- **Entries split at midnight** (`split_at_eod`).
- **Overtime is not calculated** (`calculate_overtime: 0`), even though 8h/day
  and 40h/week are configured.
- **No automatic lunch deduction** (`lunch_deduct: 0`).
- Approvals installed: employee submits (partial weeks allowed), manager
  approves, email reminders before and after the payroll close date.
- PTO installed with employee entry and manual approval.
- Location tracking optional, geofencing configured but never narrowed.

Decisions already taken on these (see 02-decisions.md): store raw time and round
only when producing payroll; keep overtime uncalculated; absence becomes its own
entity rather than a job code.

## Job codes

**545 total, 26 active, 519 inactive.** That ratio is the single most important
number in this document. The inactive ones are not clutter, they are ten years of
finished clients and projects, and they are where the history lives. The current
sync passes `active: 'yes'`, which is exactly why Grant Pass disappeared from the
report: a filter meant for performance quietly became a scope decision.

Types: 540 `regular`, 4 `pto` (Holiday, Sick, Vacation, Rwanda-Incidental), 1
`unpaid_time_off` (Jury duty). **Absence is a job code today**, which is why an
approved vacation is indistinguishable from work in the data.

**Grant Pass lives in two places**, which settles the open question from the
client report work:

- inactive job codes `GP Church` (1606222) and `GP School` (1606224), each with
  children for Content Development, Meetings, Reports, SEO, Web Development;
- values of the `2 Project` custom field.

My earlier guess that it was under `1 - i7 Code` was wrong.

## A timesheet record

```json
{
  "id": 547876596,
  "state": "APPROVED",
  "user_id": 1239615,
  "jobcode_id": 1606202,
  "start": "", "end": "", "duration": 28800,
  "date": "2026-01-01",
  "tz": -5, "tz_str": "America/New_York",
  "type": "manual",
  "location": "QuickBooks Time web",
  "on_the_clock": false,
  "locked": 0,
  "notes": "",
  "customfields": { "19156": "", "19158": "", "126808": "", "129626": "", "129628": "", "129636": "" },
  "last_modified": "2025-12-29T14:17:32+00:00",
  "attached_files": [],
  "created_by_user_id": 1239615
}
```

What our current cache (`tsheets_timesheets`) keeps of this: `user_id`,
`jobcode_id`, `duration`, `date`, and two of the six custom fields. Everything
else, including `start`, `end`, `state`, `locked`, `notes`, `created_by_user_id`
and the timezone, is thrown away today. For a client report that was enough. For
a system of record it is not, and the import has to take the whole record.

## Payroll, and the thing that does not transfer

TSheets reports **every payroll integration uninstalled**: `quickbooks: 0`,
`xero: 0`, `zenpayroll: 0`. Rippling is therefore not an add-on inside TSheets,
it pulls from outside using a TSheets API token.

That means the phrase "feed Rippling the same way" does not survive the move.
The API being consumed is TSheets', and when TSheets goes it goes with it.
Rippling's own integration cannot be pointed at the portal. Feeding Rippling
becomes a separate piece of work against Rippling's API, or whatever import
format it accepts.

Two things to find out, neither of them blocking:

- who configured that connection and with which token, since whoever holds it can
  read the entire TSheets account;
- whether Rippling accepts time in by API, or only by file import.

## What the API cannot give us

- `/timeoff_requests` answers **404**. Time off requests are not exposed in v1,
  so the history of *who asked for what and who approved it* cannot be migrated.
  Only the resulting hours can. PTO balances live on the user record.
- Schedules exist (one calendar, "True North", business hours 08:00 to 17:00)
  but scheduling is out of scope.
