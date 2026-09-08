# Client reports: what was asked for, and the plan

Written as a proposal. Phase 1 is being built; phases 2 and 3 are outlines and
nothing in them is committed to.

## Where this comes from

Two sources, both from the Admin Assistant (Tina), and this document exists so
neither has to be read again to know what was decided:

1. **The workbook** `Portal reports and Info 8-2026.xlsx`, five sheets, handed
   over as the shape the reports should take.
2. **A Slack thread of 2 September 2026**, where the questions the workbook left
   open were put to her and answered.

## The workbook, sheet by sheet

| Sheet | What it is | Status |
| --- | --- | --- |
| Needs | An earlier draft of the project table | Retired. She asked for it to be merged into Project costs: "the information in the needs tab should be merged with the Project Costs. We can eliminate the needs tab." |
| Project costs report | Projects down the side, money and hours across | **Shipped** as Client Report · Project Hours & Others |
| People report | Projects down the side, people across, hours in the cells | Believed **already shipped** as that report's People tab. To be confirmed with her rather than built twice. |
| Dept report | Projects down the side, departments across, hours and costs | **Not built.** Needs a field the portal does not have. See phase 2. |
| Rates | Break-even rates per person | Not a report: "I didn't want the rates tab listed, that was just for your information to be able to do the formulas." It carries something else valuable, though. See phase 2. |

She also caught her own mistake in the merged layout: "Sorry I have donations
listed twice, remove the first donations column." The shipped report has one
pair of donation columns, not two, so this was already right.

## What the Slack thread settles

### Donations

Four things, and one of them overturned the model that had been assumed.

1. **Manual entry, and not as a stopgap.** "I will need to manually enter the
   donations as there isn't a way to add that in the workflow." The figures come
   from **checks and online donations**, so there is no system holding them to
   integrate with. The portal has no accounting, bank or donor-platform
   connection, and QuickBooks Time carries hours only.
2. **A donation is not always attached to a project.** "Donations are not all
   for just AAAF. If the donor requests the donations go to AAAF that's where
   they go, otherwise the donation goes under unrestricted and used for all
   projects." So there are two kinds, **restricted** to a named project and
   **unrestricted**. A table keyed only by project could not hold the second.
3. **They never convert to hours.** "It doesn't translate into hours for this
   purpose." Unlike the prepaid, which does.
4. **The point of the report is a financial report for Ed.** "This report will
   allow me to pull figures from one area in order to create a financial report
   for Ed." So the figures are read and copied out, which is why blank and zero
   have to stay distinguishable.

### Two things confirmed rather than changed

- **Contractor cost is the break-even rate times TSheets hours.** Asked
  directly, answered "Correct." This is what the shipped report already does.
- **Prepaid is $90 an hour, Church and School only**, and separate from
  donations: "The pre-paid is separate and only for the Church and School."

## Phase 1: donations

### The model

One row per **bucket** per month, where a bucket is a project or the
unrestricted fund, holding an amount and an optional note.

Deliberately not one row per donation. She totals cheques and online payments
herself before writing them down, and donor-level records would be a much larger
build serving reporting nobody has asked for. If donor history is ever wanted,
this table is what it would be summarised into, so nothing here blocks it.

### Decisions taken, and why

1. **Unrestricted money gets its own row**, below the four projects, rather than
   being divided across them. Splitting it would invent an allocation nobody
   asked for, and she described it as a pool "used for all projects" rather than
   as an amount belonging to each.
2. **Blank still means blank.** A month nobody has entered reads empty, not
   `$0.00`. Zero is a claim that nothing came in, and this report is copied into
   a financial report for someone else.
3. **The entry screen takes prepaid hours as well.** `tc_project_purchases` has
   had a table since migration 062 and no way to write to it, so every Grants
   Pass purchase is a hand-written SQL insert. It is the same act as a donation,
   money arriving for a project in a month, and it belongs on the same screen.
4. **The Admin Assistant can write, and already could.** This was assumed to
   need a widened policy and does not. `is_admin()` reads `profiles.role`, and
   migration 038 set that to `'admin'` for the `admin_assistant` tier too, so
   the database has never excluded her. The gate that WOULD have shut her out
   is in the app: `access.isAdmin` is `roleType === 'admin'` exactly, so the
   entry screen checks `isPrivileged` instead. Worth writing down because the
   two names disagree: at the database an assistant is an admin, in the app she
   is not.

### Open, and worth confirming with her

- Whether the unrestricted row should also appear in the totals line, or sit
  outside it. Adding a fund to a set of projects makes a number that is correct
  but has no name.
- Whether donations are ever recorded against Grants Pass Church or School. Her
  own layout gives them a donations column, but they are prepaid rather than
  donation funded, so the column may be blank for them permanently.

## Phase 2: the department report

Not started, and it needs a decision from her first.

The report was thought unbuildable because the portal has no field saying what a
person does. **The Rates sheet is that field**: it carries a `Dept` for all 25
people, with the values `Writers`, `SEO`, `Web`, `Admin`, `Special Projects`,
`Translator`, `Graphics` (and one spelling to normalise, `Writer` against
`Writers`).

The portal's nearest concept is the primary team, which is only `seo`,
`writing`, `web`, `lead`, `other`. That covers three of the seven and drops
Admin, Graphics, Translator and Special Projects into "other". Department and
team are different axes, so this needs its own column on `people`, seeded from
the sheet the same way `be_rate` was in migration 078.

**The question for her:** her sketch shows only SEO, Writing and Web as columns.
The Rates sheet has seven departments. Admin and Special Projects hours have to
land somewhere, so either those columns exist or the report says what it leaves
out.

## Phase 3: the people report

Probably already delivered. Her sheet is projects down the side, people across,
hours in the cells, Total Hours at the foot, which is the People tab of the
shipped report. The one difference is that her sheet lists every person as a
column while the tab shows only those with hours in the period.

The next step is to show her the live tab and ask whether that closes it, not to
build a second report.
