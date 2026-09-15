# Client reports: what was asked for, and the plan

Phase 1 is built and in production. Phases 2 and 3 are outlines and nothing in
them is committed to.

## Where this comes from

Three sources, all from the Admin Assistant (Tina), and this document exists so
none of them has to be read again to know what was decided:

1. **The workbook** `Portal reports and Info 8-2026.xlsx`, five sheets, handed
   over as the shape the reports should take.
2. **A Slack thread of 2 September 2026**, answering the questions the workbook
   left open.
3. **A Slack thread of 9 September 2026**, answering five follow-up questions.
   Two of its answers removed work rather than adding any.

## The workbook, sheet by sheet

| Sheet | What it is | Status |
| --- | --- | --- |
| Needs | An earlier draft of the project table | Retired: "the information in the needs tab should be merged with the Project Costs. We can eliminate the needs tab." |
| Project costs report | Projects down the side, money and hours across | **Shipped** as Client Report · Project Hours & Others |
| People report | Projects down the side, people across, hours in the cells | Believed **already shipped** as that report's People tab. To be confirmed with her rather than built twice. |
| Dept report | Projects down the side, departments across, hours and costs | **Not built.** Needs a field the portal does not have. See phase 2. |
| Rates | Break-even rates per person | Not a report: "that was just for your information to be able to do the formulas." It carries something else valuable though. See phase 2. |

## What the two threads settle

### Donations

- **Manual entry, permanently.** "I will need to manually enter the donations as
  there isn't a way to add that in the workflow. The figures come from checks and
  online donations." There is no accounting or donor platform to read, and
  QuickBooks Time carries hours only.
- **Monthly totals, not individual donations.** "I don't list each donation. Only
  the total donated for the month." This is what the table was built for, so it
  did not change. The consequence is that **the month is the finest date there
  is**: a donations report can say which month, never which day.
- **They never convert to hours.** "It doesn't translate into hours for this
  purpose." Unlike the prepaid, which does.
- **Only two projects receive them.** "These two are client projects (work on
  their websites), so they do not get donations. AAAF and HFA are projects that we
  sometimes get donations for." Grants Pass Church and School buy hours instead,
  so `prepaid` in `TRACKED_PROJECTS` already says which is which and the code
  reads that rather than carrying a second list.
- **Restricted and unrestricted do not appear.** "These reports should never show
  restricted verses unrestricted. That part is all done in our accounting." So
  what reaches the portal is already resolved to a project.
- **No donor names.** "We have a donor database that tracks everything. These
  reports are just cost information for our financial planning." Nothing here is
  personal data, which is why the read policy is "anyone who can open the report".

### Costs and prepaid, confirmed rather than changed

- **Contractor cost is the break-even rate times TSheets hours.** Asked directly,
  answered "Correct."
- **Prepaid is $90 an hour, Church and School only**, and separate from donations.

### Net

Her sheet has a **Net (Donations minus all costs)** row per month, which the
portal did not have although it held every input. It is now on screen, in the
printed sheet and in both CSVs.

**One deliberate difference from her sheet.** Hers folds the Grants Pass
school-website and church-invoice income into AskAnAdventist's and Hope for
Africa's rows, because her layout has nowhere else to put it. The portal has
somewhere: those sit on the Grants Pass rows as hours bought in advance, and she
said so herself, "already accounted for on the portal report". Adding them here
too would count them twice.

So the portal's AAAF net differs from hers by exactly the school-website line:
March reads −47,912.23 here against −47,587.23 on her sheet. The portal's is the
correct attribution. **She has not been told this yet.**

A year-to-date net was built and then dropped. Her sheet has no such figure, and
at 109 pixels it was the single widest column and the reason the table went back
to scrolling on a 1280-wide laptop. Both its inputs are still on the row.

## Phase 1: donations. Built.

### The model

One row per project per month in `tc_project_donations`, holding an amount and an
optional note. Migration 079, applied 8 September 2026.

`project_label` is nullable, which is now dead capability: it was for unrestricted
money before her answer removed the idea. The column and its partial unique index
are harmless and are left rather than migrated away.

### Decisions, and why

1. **Blank is not zero.** A month nobody has entered reads empty; typing `0` reads
   `$0.00`. Zero is a claim that nothing came in, and this report is copied into a
   financial report for someone else. An empty field deletes the row, which is
   also the only way to undo a figure entered by mistake.
2. **The entry screen takes prepaid hours as well.** `tc_project_purchases` had a
   table since migration 062 and no way to write to it, so every Grants Pass
   purchase was a hand-written SQL insert. It is the same act, money arriving for
   a project in a month.
3. **The Admin Assistant can write, and already could.** This was assumed to need
   a widened policy and did not. `is_admin()` reads `profiles.role`, and migration
   038 set that to `'admin'` for the `admin_assistant` tier too. The gate that
   WOULD have shut her out is in the app: `access.isAdmin` is
   `roleType === 'admin'` exactly, so the entry screen checks `isPrivileged`.
   Worth writing down because the two names disagree: at the database an assistant
   is an admin, in the app she is not.

### What else shipped with it

The report was brought level with the i7 one while this was being built: the
period filter and team filter, the navy-white-navy toolbar, the Export menu with
client and internal as PDF and CSV, and a **Last updated** badge that takes the
newest of three sources rather than copying i7's "Last synced". A sync is only one
of the three things that change this page, so a sync badge would not move when
Tina enters a donation.

## Phase 2: the department report

Not started, and it needs one answer from her first.

The report was thought unbuildable because the portal has no field saying what a
person does. **The Rates sheet is that field**: it carries a `Dept` for all 25
people, with the values `Writers`, `SEO`, `Web`, `Admin`, `Special Projects`,
`Translator`, `Graphics` (and one spelling to normalise, `Writer` against
`Writers`).

The portal's nearest concept is the primary team, which is only `seo`, `writing`,
`web`, `lead`, `other`. That covers three of the seven and drops Admin, Graphics,
Translator and Special Projects into "other". Department and team are different
axes, so this needs its own column on `people`, seeded from the sheet the same way
`be_rate` was in migration 078.

**The question for her:** her sketch shows only SEO, Writing and Web as columns.
The Rates sheet has seven departments. Admin and Special Projects hours have to
land somewhere, so either those columns exist or the report says what it leaves
out.

## Phase 3: the people report

Probably already delivered as the People tab. The one difference is that her sheet
lists every person as a column while the tab shows only those with hours in the
period. Show her the live tab and ask whether that closes it, rather than building
a second report.

## Still open

Checked against the database and the code on 10 September 2026, not from memory.
Updated on 15 September 2026 with Tina's reply to the questions below.

### Needs her

1. **August's donation figures.** Answered: entered, and she keeps them current
   as money comes in. The change log shows her own entries for August and
   September, corrections included.
2. **Phase 2, the department report.** Paused at her request: she is changing
   the job codes in T-Sheets first. Nothing to build until she says it is done.
3. **Phase 3, the people report.** Closed: keep the People tab as it is, listing
   only the people with hours in the period. Nothing to build.
4. **The AAAF net difference.** Told, and she said to leave it as it is. She will
   discuss that section with Ed, who can now open the report, so it may change
   after that conversation.

### Watch

- **Her T-Sheets code changes can move hours out of the i7 report.** Project
  Hours counts by the "2 Project" field, so it does not care where a job code
  sits. The i7 report adds up everything under the i7 parent job code, so a code
  moved out of that tree takes its hours with it, silently. Compare both reports
  once she has finished.

### Needs us

5. **The PDF has never been generated.** The route handles `report=projects` and
   points at `/tools/time-report/grant-pass/print`, so the path exists, but it
   needs a login and headless Chromium and has not once been run end to end.
   Both CSV exports have.

### Done since this document was written

- **Four fixes from her reply, 15 September 2026.**
  1. *The "i" text.* It said Hope for Africa had no job code, and it has one
     (Adventist Messengers/HFA). What is true is that part of its work is logged
     under True North job codes with "2 Project" set to Africa, about a quarter of
     its 2026 hours, which is why the report counts by the field. The two hour
     gaps it quoted were measurements from while the report was being built and
     had already gone stale, so the text carries no figures now.
  2. *No Contractor costs row for Grants Pass Church and School* in the month by
     month table: no contractor worked on either in 2025 or 2026. The row comes
     back by itself the first month one does, so no cost is ever hidden.
  3. *A CSV of the month by month table*, under Export, where she looked for it.
     Same rows as the screen, decided by the same function.
  4. *Team moved to the People tab.* In the toolbar it looked like a filter for
     the whole report, and it only ever narrowed the People columns, so on the
     Costs tab it visibly did nothing. That was her "the Team filter does not
     change anything". A note says the totals still count everyone.

- **Ed can open the report.** She wrote "These reports are only for Dave, myself
  and Ed", and he was the one who could not: `role_type: user`, the lowest tier.
  The grant lived only on Admin Assistants at audience `lead`, which of that team
  is Tina alone.

  Ed is a founder and sits in the Leadership team, where he already had
  publishing, workload, href-links and i7-budget. Only this report was missing,
  so the grant was added to **Leadership at audience `lead`**, one row. That is
  the honest place for it: the leadership sees the cost reports.

  Putting him in Admin Assistants instead would have granted the same one tool,
  since he held the rest already, but `ledTeams` feeds the org chart on the Home
  page, so a founder would have appeared leading the admin assistants above
  Tina. A grant is not worth a wrong reporting line on the page everyone opens.

  It reaches one person nobody named: **Kim Wagner**, a manager in Leadership.
  Accepted deliberately rather than overlooked. Grants are per team and there is
  no per-person mechanism, so the alternatives were a team that is not a team or
  the wrong org chart.

  Now open to: Ed Wagner, Kim Wagner, David Sharpe, Tina Gennette and Arnaldo
  Oliveira.

- January to July entered, seven months, AAAF only.
- The donations report asked for ("how much, when, for which project") shipped
  twice over: the month-by-month table under the report, and the Donation
  records screen with its change log.
