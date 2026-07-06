# i7 Budget Usage Report — where the budget numbers come from

_Audience: product owner. Last verified: 2026-07-06._

## TL;DR

The report's monthly budget and the "Budget balance" carryover come from the
**`i7_monthly_budget`** table — the per-month schedule (Jan $50k, Feb–Jun $45k,
Jul–Nov $55k, Dec $50k). That schedule is correct and is what you see driving the
report.

The **Settings → Clients & Budgets** budget modal (the pop-up with "Budget ($)"
and "Extra budget ($)") edits a **different, legacy** table (`tr_budgets`). The
report does **not** read it for the monthly budget. That's why it looks out of
date — it's a leftover from an earlier design and editing it changes nothing in
the report today.

## The two budget sources

| | `i7_monthly_budget` (live) | `tr_budgets` (legacy) |
|---|---|---|
| **What it is** | One row **per month** with a base amount + optional extra | **One** record per client with a single date range |
| **Shape** | Jan → $50k, Feb → $45k, … Dec → $50k | $50k base + $5k extra, with start/end dates |
| **Who reads it** | The report — `loadMonthlyBudgets()` in `src/app/(app)/tools/time-report/page.tsx`, used for each month's budget and the carryover | Nothing in the report. Only shown/edited in Settings |
| **Where it's edited** | **No UI yet** — seeded directly in the database | Settings → Clients & Budgets → click a client → "Edit" |
| **Audit trail** | None (DB change) | Yes — justification + `tr_audit_log` |

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

## The gap (and the recommended fix)

Right now the **only** budget UI (the Settings modal) edits the **wrong** table,
and the table the report actually uses has **no UI** — it can only be changed in
the database. That's the confusion.

Recommended fix (not yet done): replace the i7 budget modal so it edits the
**monthly schedule** (`i7_monthly_budget`) — a small month-by-month editor with
the same justification + audit trail — and retire the legacy `tr_budgets` editor
for i7. Then the screen you edit and the numbers the report shows are the same
thing.

Until that's built, monthly budget changes are applied directly to
`i7_monthly_budget` in the database.

## Related

- Report page: `src/app/(app)/tools/time-report/page.tsx` (`loadMonthlyBudgets`)
- Carryover math: `ReportView` in the same file (`opening = Σ budget − Σ cost`
  from January)
- Monthly table schema: `supabase/migrations/024_i7_monthly_budget.sql`
- Legacy budget schema: `supabase/migrations/022_budget_extra_periods.sql`,
  `023_*`
