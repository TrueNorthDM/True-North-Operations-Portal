# i7 Budget Usage Report — where the budget numbers come from

_Audience: product owner. Last verified: 2026-07-06._

## TL;DR

The report's monthly budget and the "Budget balance" carryover come from the
**`i7_monthly_budget`** table — the per-month schedule (Jan $50k, Feb–Jun $45k,
Jul–Nov $55k, Dec $50k).

**As of 2026-07-06, the Settings → Clients & Budgets → i7 modal edits that same
`i7_monthly_budget` table** — a month-by-month grid where past months are locked
and the current month and later are editable. So the screen you edit and the
numbers the report shows are now the same source of truth. The old single-budget
form (`tr_budgets`) is no longer used for i7 (other clients still use it).

## The two budget sources

| | `i7_monthly_budget` (live) | `tr_budgets` (legacy) |
|---|---|---|
| **What it is** | One row **per month** with a base amount + optional extra | **One** record per client with a single date range |
| **Shape** | Jan → $50k, Feb → $45k, … Dec → $50k | $50k base + $5k extra, with start/end dates |
| **Who reads it** | The report — `loadMonthlyBudgets()` in `src/app/(app)/tools/time-report/page.tsx`, used for each month's budget and the carryover | Nothing in the report. Only the legacy modal for non-i7 clients |
| **Where it's edited** | Settings → Clients & Budgets → **i7** → month grid (`MonthlyBudgetGrid`, past months locked) | Settings → Clients & Budgets → a **non-i7** client → "Edit" |
| **Audit trail** | Yes — justification + `tr_audit_log` (`entity_type='monthly_budget'`) | Yes — justification + `tr_audit_log` |

## Why the two exist

The i7 budget changes month to month, and each month's leftover carries into the
next (a running "bank balance"). A single budget with one date range — which is
all `tr_budgets` can express — cannot say "$45k in May but $55k in July." So the
per-month table `i7_monthly_budget` was added specifically for i7, and the report
was pointed at it. The old `tr_budgets` record was never removed, so it still
appears in the Settings modal and now reads as stale.

## Current values (verified 2026-07-06)

`i7_monthly_budget` — **this is what the report uses:**

| Month | Base | Extra | Total |
|---|---:|---:|---:|
| Jan 2026 | $50,000 | — | **$50,000** |
| Feb–Jun 2026 | $45,000 | — | **$45,000** |
| Jul–Nov 2026 | $50,000 | $5,000 | **$55,000** |
| Dec 2026 | $50,000 | — | **$50,000** |

`tr_budgets` (legacy, shown in the modal — **not used by the report**):
$50,000 base (Jul 1 – Dec 31, 2026) + $5,000 extra (Jul 1 – Oct 31, 2026).

## How to change the i7 budget (2026-07-06 onwards)

Settings → Tools & Projects → Clients & Budgets → click **2 - i7 Marketing**.
The modal shows two transposed grids (months across the top), each a **6-month
window** — the current month and the next 5:

- **Monthly budget** — rows are Budget / Extra / Total. Type the new base and/or
  extra, click **Review changes**, add a justification, confirm.
- **Budget hours per project** — a projects × months matrix. Each cell is the
  budgeted hours for that project in that month; the report's "Budget hrs / Hrs
  avail." column reads the selected month's value (`i7_project_month_hours`).
- Only the cells you changed are written, and one entry is added to Change
  History. The report reflects it immediately.

Older months (before the current one) are read-only under **Change History →
View past schedule**, bounded by the same 24-month retention window as the
reports.

## Change History

Every budget/rate change is recorded in Change History (Settings → … → Change
History) with a typed label — **Budget updated**, **Extra budget**, **Hourly
rate updated**, **Budget hours updated** — and a one-line summary; click a row to
see the before → after per month and the justification.

The history was reset on 2026-07-06 to a single seed entry ("Budget history")
summarising the year so far; new changes accumulate on top of it.

## Related

- Report page: `src/app/(app)/tools/time-report/page.tsx` (`loadMonthlyBudgets`)
- Carryover math: `ReportView` in the same file (`opening = Σ budget − Σ cost`
  from January)
- Monthly table schema: `supabase/migrations/024_i7_monthly_budget.sql`
- Legacy budget schema: `supabase/migrations/022_budget_extra_periods.sql`,
  `023_*`
