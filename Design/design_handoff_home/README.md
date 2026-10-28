# Handoff: the new Home (TN Operations Portal)

Decided on 25 October 2026. Replaces `src/app/(app)/page.tsx` as it is on `main` today (rebuilt in `reference/Home (atual).dc.html` for comparison).

## Overview

Home stops being a stack of cards and answers one question per level: **what do I need to do today?** Only the welcome banner survives from today's page, and it changes shape: it becomes the day's timeline, with the sun moving across it with the time of day and the hours already worked drawn as gold bars.

Below it, in this order:

1. **Needs you / My Work / Requests** (everyone): one card, three tabs, a scroll inside. Every row opens a side panel with the detail; the panel's main button resolves it.
2. **Pay period** (everyone with `clocky-hours`): hours in the active period, pace, the 14 days broken down by kind (worked, PTO, holiday, sick). It is also the timesheet reminder: it turns amber on the day the period closes and red every day after, until it is sent. This replaces `TimesheetDueCard`.
3. Right column: **Agenda** (everyone: Out today, then the next 5 events) and **i7 Budget** (Super Admin, Admin; last in the column).
4. **Publishing goals** (Super Admin, Admin, Team Leader): full width, the last 5 complete weeks, English first.

Who's working leaves the page: it is the people icon in the top bar (`ClockyTopBar`, already on staging), with the count badge.

Removed from Home: Favourites, the org chart (it has `/organization`), the separate Birthdays and Work anniversaries cards (they live in the Agenda now), `SystemHealthBanner` as a banner (its alerts become rows in Needs you).

## About the design files

`Home Final.dc.html` is a **design reference built in HTML**: a prototype of the intended look and behaviour, not code to copy. Recreate it in the portal's own stack (Next.js App Router, React server components, Tailwind v4 with the tokens in `src/app/globals.css`), with its existing components (`Avatar`, `TenureBadge`, `NavIcon`, `BudgetBalanceCard`'s meter, `Sunrise`) and patterns. Open the file in a browser: the three switches at the top change the level, the pay period state and the Bessemeters data. All figures in it are sample data.

## Fidelity

**High fidelity.** Colours, type, spacing, radii and copy are final. Match them with the codebase's existing tokens; the hex values below are the ones those tokens already resolve to.

## Levels

Level is the access tier (`lib/access/catalogue.ts`): Super Admin, Admin, Team Leader, User. Employee/contractor is a fact about the person (`lib/access/nav-facts.ts`), not a level. The design shows five cases:

| Widget | Super Admin | Admin | Team Leader | User, employee | User, contractor |
|---|---|---|---|---|---|
| Banner + day timeline | yes | yes | yes | yes | yes |
| Pay period | yes | yes | yes | yes | yes |
| Needs you / My Work / Requests | yes | yes | yes | yes | yes |
| Agenda (Out today + next 5) | yes | yes | yes | yes | yes |
| i7 Budget | yes | yes | | | |
| Publishing goals | yes | yes | yes | | |
| Who's working icon (top bar) | 6, company | 6, company | 1, their team | | |

What can land in **Needs you**, by level:

| Row kind | Super Admin | Admin | Team Leader | User |
|---|---|---|---|---|
| System (integration down / warning) | yes | yes | | |
| Access (invitation not accepted, etc.) | yes | yes | | |
| Approval: invoice, with amount | yes | | | |
| Approval: team hours, never amounts | | | yes | |
| Request to decide (time off, extra hours, reimbursement) | yes | | | |
| Invoices info (fixed-pay invoices created on day 1) | yes | | | |

The timesheet is **never** a row: the Pay period card owns it.

Use the same gates the pages already use: `home-health` for System rows, `clocky-approvals` and `getApprovalsCount` for approvals, `rq-*` / `ck-timeoff` for decisions, `canTool('i7-budget')` for the i7 card (as today), `canTool('publishing')` for whether Publishing goals links.

## Layout

Content area (inside `MainContent`, which keeps its `px-6 py-8`): measured at 1280px window, so 1216px beside the 64px rail.

```
┌ Banner / day timeline ─────────────────────────────── full width, 310px ┐
├──────────────────────────────────────────────┬──────────────────────────┤
│ Needs you · My Work · Requests   (row 1)     │ Agenda                   │
│   list scrolls inside; the card stretches so │                          │
│   the two left cards end with the right col. │ i7 Budget (SA, Admin)    │
├──────────────────────────────────────────────┤                          │
│ Pay period                       (row 2)     │                          │
├──────────────────────────────────────────────┴──────────────────────────┤
│ Publishing goals                               full width     (row 3)   │
└─────────────────────────────────────────────────────────────────────────┘
```

The banner is full-bleed inside the content area: no radius, no margin, from the rail to the window edge (in the prototype it sits directly under the top bar). Below it, a grid with 28px padding:

- `grid-template-columns: minmax(0,1fr) 320px`, `grid-template-rows: 1fr auto auto`, `gap: 22px 24px`, `align-items: start`.
- Tabs card: `grid-column 1; grid-row 1; align-self: stretch`, flex column. Its list wrapper is `flex: 1; min-height: 250px; contain: size; overflow-y: auto`, so the right column decides the height and the list scrolls.
- Pay period: `grid-column 1; grid-row 2`, at its natural height. Scrollbar hidden (`scrollbar-width: none`, plus `::-webkit-scrollbar { display:none }` in CSS), with a 28px fade at the bottom (`mask-image: linear-gradient(to bottom, #000 calc(100% - 28px), transparent)`) and 20px bottom padding inside.
- Right column: `grid-column 2; grid-row 1 / span 2`, flex column, gap 20px.
- Publishing goals: `grid-column 1 / -1; grid-row 3`.

Below `lg`, stack everything in one column in this order: banner, tabs (fixed `max-height: 420px` with the same scroll), Pay period, Agenda, i7, Publishing goals.

## 1. Banner / day timeline

Replaces `WelcomeBanner`. Height 310px, `padding: 30px 36px 0`, background `linear-gradient(180deg, #0a2f63, #012358)`, `overflow: hidden`, `position: relative`.

**The sun** is `Sunrise`, unchanged, at 0.75 scale (ray layers 495/390px, rings 405px; core stays 12px), anchored at `top: 180px` and at a left that follows the clock: `left = 36px + (100% − 72px) × (hour − 7) / 12`, so 7 AM is the left end of the track and 7 PM the right. Glow `radial-gradient(circle at X% 60%, rgba(242,196,10,.26), transparent 46%)`. Move it with `transition: left 1.2s ease`; recompute every minute. Honour `prefers-reduced-motion` as `.tn-anim` already does.

**Left, text:**
- Eyebrow `MONDAY, OCTOBER 26 · 10:46 AM`: Raleway 800, 11px, letter-spacing .2em, `#94C4C5`. In the person's zone.
- `Good morning, {first name}`: Raleway 800, 32px, letter-spacing −.015em, white, margin-top 8px. Morning before 12, afternoon before 18, evening after.
- Summary, Open Sans 15.5px, `rgba(255,255,255,.85)`, margin-top 8px. Rules, from open Needs you + My Work rows due late or today:
  - `N things need you today, M of them late.` (omit the late clause when 0; `1 thing needs`)
  - none today but some this week: `Today is clear. N more this week.`
  - nothing: `Nothing is waiting on you.`

**Right, the clock card** (300px wide, `background: rgba(255,255,255,.07)`, `border: 1px solid rgba(255,255,255,.16)`, radius 16, padding 16px 18px, flex column gap 12):
- Row: status dot 8px with a 4px halo (`#1E9E6A` + `rgba(30,158,106,.25)` on the clock; `rgba(255,255,255,.4)` + `.08` off) and label `ON THE CLOCK` / `OFF THE CLOCK` (Raleway 800, 11px, .12em, uppercase, `#7fd1ad` / `rgba(255,255,255,.7)`); right, `since 8:05 AM` / `not started today`, 12px, white 65%.
- Today's hours: Raleway 900, 38px, line-height 1, white, tabular, letter-spacing −.02em; `today` beside it, 11.5px, white 60%.
- Job pill: `background: rgba(255,255,255,.08)`, radius 9, padding 8px 10px; my-work icon 14px `#94C4C5`; job name 12.5px/600 white, ellipsis; `Switch` 12px/700 `#94C4C5` (only on the clock; opens the job picker the top bar clock already has).
- Button full width, radius 10, padding 11px 14px, Raleway 800 13.5px, navy words: on the clock **white** `Clock out` with a stop square; off **gold `#F2C40A`** `Clock in` with a play triangle.

This card and the top bar clock are the same clock (`getClockPanel`): one source, both update together.

**Bottom, the track** (absolute, `left/right: 36px`, `bottom: 20px`):
- Track 12px tall, radius 999, `rgba(255,255,255,.10)`.
- Worked segments: gold `#F2C40A` bars, radius 999, one per clock-in/out pair today, positioned on the same 7 AM–7 PM scale. The open segment ends at now.
- Now marker: 2px white, extends 10px above and below the track.
- Hour labels every 2 hours: 11.5px, white 55%, `nowrap`, 8px below; centred on their position, except the first (left-aligned to the track start) and the last (right-aligned to its end).

**Time zone.** Everything in the banner is in the **signed-in person's own time zone**: the eyebrow date and time, the greeting, the sun's position, the now marker, the worked segments and the hour labels. Use the zone the Agenda already uses for the person (`agendaViewer(access).zone`, from their profile); fall back to the browser's zone only if the profile has none. The server renders it in that zone and the client keeps it moving with a one-minute tick, so a person in Nairobi and one in New York each see their own morning.

**Range.** 7 AM to 7 PM by default. It widens to the person's day: it starts at the earlier of 7 AM and their first clock-in today (rounded down to the hour), and ends at the later of 7 PM and now (rounded up). Someone who clocked in at 6:30 sees a track from 6 AM.

The day's meetings are **not** drawn on the track (tried, too crowded): they are in the Agenda.

## 2. Pay period (below the tabs card)

White card, radius 20, `box-shadow: 0 18px 40px -26px rgba(1,35,88,.45)`, padding 24px 28px, flex column gap 18, `overflow: hidden`. Border `#e4e7ec`, or the state colour below.

### States

| State | When | Border | Top band | Body shows |
|---|---|---|---|---|
| Running | default | `#e4e7ec` | none | the active period |
| Closes today | the period's last day, until sent | `#f0e2a8` | `#fdf8e7`, icon `#8a6d1a`, title navy | the period to send |
| Late | every day after it closed, until sent | `#f3c6ca` | `#fdeeef`, icon and title `#c8323d` | the period to send |
| Sent | after sending, until approved | `#e4e7ec` | none | the new active period; chip says sent |

The dates come from `loadHomeTimesheet` (today's `TimesheetDueCard` logic: from the day the period closes until it is sent). Fixed-pay contractors (no timesheet) never see Closes today / Late; their card shows the month and "Your invoice is created on Nov 1".

**Top band** (Closes today, Late): `margin: -24px -28px 0; padding: 18px 28px`, bottom border in the state colour. Left, a 42px white chip with the clock icon in the state colour. Title, Raleway 800 17px:
- `Your Oct 12 to 25 timesheet closes today` / `Your Oct 12 to 25 timesheet is 1 day late` (`N days` when more).

Sub, 13px `#5b6b82`:
- today: `{hours} logged. Check your entries and send it when the day is done.`
- late: `{hours} logged. Send it so {approver} can approve it.`

Buttons: navy `Review and send` (white words, gold play triangle, the portal's navy-button rule) opens Time entries on that period with the submit step (`/clocky-hours?submit=1`, as today); white `Open Time entries` (navy words, border `#d9dee6`).

In those two states a slim footer line sits at the bottom of the card (`margin: -4px -28px -24px; padding: 12px 28px; background: #f8f7f3`, top border `#eceff3`, green dot): `Next period, Oct 26 to Nov 8, started today: 2h 41m so far.` (contractors; employees' periods run back to back the same way).

### Body

- Eyebrow `PAY PERIOD` (or `PERIOD TO SEND`): Raleway 800 11px .12em `#8593a4`. Range below, Raleway 800 20px navy: `Oct 26 to Nov 8`.
- Right of it (Running, Sent), the previous period chip: radius 999, padding 6px 12px, 12.5px `#5b6b82`, bg `#f4f2ec`, 7px dot:
  - `Oct 12 to 25: with Dave Sharpe` (dot `#e0940e`), `Oct 4 to 17: paid Oct 23` (dot `#1E9E6A`), `Oct 12 to 25: not sent, 1 day late` (dot `#c8323d`), after sending `Oct 12 to 25: sent, with Dave Sharpe` (dot `#1E7D7F`, bg `#eaf4f4`).
- Hours: Raleway 900 46px, line-height 1, navy, tabular, −.02em, e.g. `32h 00m`, then `of 80h 00m in the period` 14px `#8593a4`. The total counts worked + PTO + holiday + sick.
- Stats, right-aligned, gap 26: label 10.5px Raleway 800 .06em uppercase `#8593a4`, value Raleway 800 16px.
  - Running / Sent: `WORKING DAYS LEFT` (`5`), `PACE` (`On pace` in `#167a52`, or `8h 00m behind` in `#9a5a00`; on pace means within 30 minutes of expected), `PER DAY` (average over the working days with time, today included).
  - Closes today / Late: `DAYS WITH ENTRIES` (`9 of 10`), `APPROVES` (`Arnaldo Oliveira`, `Dave Sharpe`, or `Rippling` for employees).
- Progress bar: 12px, radius 999, track `#eef0f3`, fill navy `#012358` to total ÷ expected. Pace marker (Running only, and only once at least one working day has passed): 2px gold `#F2C40A`, 20px tall, at expected-by-today ÷ expected; label `expected by today` 11px/700 `#8a6d1a` under it, centred, anchored left under 12% and right over 88% (as `Meter` in `I7CarryoverPanel` does).
- 14 day columns: `grid-template-columns: repeat(14, 1fr)`, gap 6, height 74. Each column stacks its kinds bottom-up, 50px = 8h, radius 4, 1px white between segments: Worked `#012358`, PTO `#1E7D7F`, Holiday `#F2C40A`, Sick `#94C4C5`. An empty working day is a 3px `#e4e7ec` stub; weekends are blank. Day letter below, 10.5px: today navy 800 with a 2px gold outline (offset 2) around its bar; weekends `#cbd2da`; others `#8593a4`. Tooltip per day: `Oct 23: PTO 8h 00m`.
- Legend, 12.5px `#5b6b82`, only for kinds present: 10px swatch, label, total bold navy: `Worked 32h 00m · PTO 8h 00m`.
- Footer line, top border `#eceff3`, 13px `#5b6b82`, teal 15px icon: employees `Goes to Rippling for payroll when it closes on Sat, Oct 31.`; contractors `When it closes, {approver} approves it and it becomes your invoice.`

Data: the period and its entries are what `/clocky-hours` already reads (time entries + approved time off from Requests + company holidays from the Agenda). Expected = working days in the period × the person's daily expectation (8h in the design; use their schedule).

## 3. Needs you / My Work / Requests

White card, radius 18, border `#e4e7ec`, padding 8px 22px.

**Tabs**: bottom border `#eceff3`. Each tab: Raleway 800 14px, padding 14px 12px 12px, 2.5px bottom border; active navy with a gold `#F2C40A` line, idle `#8593a4`. Count pill 20px tall: active navy bg with gold figure, idle `#f1f3f6` / `#5b6b82`. Counts are open rows (Requests: all open).

- **Needs you**: every row kind in the table above that is not a task, not the timesheet.
- **My Work**: the same worklist as `/my-work`, due within 7 days or late, by due date.
- **Requests**: what the person asked for and where it is.

**Row**: flex, gap 12, padding 13px 0, bottom border `#f1f3f6`.
- Type chip 32px, radius 9, icon 16px stroke 2:

| Kind | Icon (`nav-icons.ts`) | Chip bg | Icon |
|---|---|---|---|
| Approval | `tests` | `#e8edf5` | `#012358` |
| Request | `requests` | `#fbf1cf` | `#8a6703` |
| My Work | `my-work` | `#eaf4f4` | `#1E7D7F` |
| System | alert triangle | `#fdecea` | `#b3271f` |
| Access | `admin` | `#f1f3f6` | `#5b6b82` |
| Invoices | `client-reports` | `#f1f3f6` | `#5b6b82` |
| My request, waiting | `requests` / `clock` / `client-reports` | `#fdf8e7` | `#8a6d1a` |
| My request, done | same | `#e6f6ee` | `#0d7a4f` |

- Title 14px/700 navy; sub 12.5px `#8593a4`, tabular figures (e.g. `Wendy Cacka approved 76h 30m. Approve the invoice: $2,295.00.`).
- Due, 12.5px/700: late `#c8323d` (`Was due Fri`, `Since 7:40`), today navy (`Today`), later `#8593a4` (`Fri, Oct 30`).
- Button: white, border `#e4e7ec`, radius 9, padding 7px 11px, Raleway 800 12.5px navy: `Approve invoice`, `Decide`, `Review hours`, `Open`, `Open Automations`, `Resend`. Informational rows (Invoices) have none.
- Resolved rows fade to 45% with a strikethrough and a `Done` label in `#0d7a4f`, then leave the list on the next load.

**Side panel** (opens from any row's button): 460px, from the right, full height below the top bar, `box-shadow: -24px 0 50px -24px rgba(1,35,88,.35)`, overlay `rgba(1,35,88,.18)` that closes it. Escape closes it; focus moves in and returns to the row's button (the drawers' existing behaviour).
- Header (padding 22px 24px 18px, bottom border): type chip 34px + type label (Raleway 800 11px .1em uppercase, type colour) + `· {due}`; close ×. Title Raleway 800 22px; sub 14px `#5b6b82`.
- Body: a key/value table (border `#e4e7ec`, radius 14; rows padding 12px 16px; key 13px `#8593a4`; value 13.5px/700 navy, right-aligned); then an optional note (`#f4f2ec`, radius 12, 13.5px); then `Open in Approvals ↗` (or the page the row belongs to).
- Footer: primary navy button, full width (gold symbol), plus a white secondary. Examples: `Approve invoice` / `Send back`, `Approve` / `Decline`, `Approve hours` / `Send back`, `Run sync now` / `Close`, `Resend invitation` / `Copy link`, `Mark done` / `Close`. The primary runs the same server action the page behind it uses.
- Team Leaders see hours only, never amounts: the panel says `You approve the hours. Amounts are never shown to Team Leaders.`

## 4. Agenda (right column)

White card, radius 18, border `#e4e7ec`, padding 20, flex column gap 14. Title `Agenda`, Raleway 800 16px.

- **Out today** block: bg `#f8f7f3`, border `#eceff3`, radius 12, padding 12, gap 10. Header `OUT TODAY` (Raleway 800 10.5px .1em `#8593a4`) and `2 people`. Rows: avatar 30px, name 13px/700 navy, reason 12px `#8593a4`, until 12px `#5b6b82` (`until Wed`, `today only`). Reason as the Agenda shows it to that level (`Unavailable` unless the viewer may see more).
- **Next 5 events**: today's remaining events first under `TODAY`, then the following days under `COMING UP`, until there are 5. Headers Raleway 800 10.5px .1em `#8593a4`.
  - Today rows: bg `#f4f2ec`, radius 12, padding 10px 12px. Date block 44px: `AM`/`PM` Raleway 800 10.5px `#c8323d`, time Raleway 900 17px navy (`11:00`). Title Raleway 800 14px; sub 12px `Today, 30 min`.
  - Later rows: transparent. Date block: weekday Raleway 800 10.5px `#8593a4` uppercase, day Raleway 900 22px navy. Sub: `Work anniversary`, `Birthday`, `Company holiday`, `10:00 AM, everyone`.
- `Open Agenda ›` link, 13px/700 teal.

Data: `loadAgendaItems` from now to +31 days, the same source as `ThisWeekCard` (which this replaces).

## 5. i7 Budget (right column, last)

Same data and gate as today (`loadI7Carryover`, `canTool('i7-budget')`, `unavailable` state kept). Compact version of `BudgetBalanceCard`; the whole card links to `ROUTES.i7`.
- Navy header, padding 12px 18px: `i7 Budget` Raleway 800 16px white; `October 2026` Raleway 700 12px white 70%.
- Body padding 16px 18px 18px, gap 12: `BALANCE LEFT` label (10px Raleway 800 uppercase `#8593a4`) and the balance, Raleway 800 26px `#1E9E6A` (`#c2410c` when negative); status pill on the right (the existing `PILL` styles).
- Bar 8px with the existing gradient (`#1E7D7F → #31a39a 50% → #f59e0b 78% → #ef4444`) masked by `#eef0f3` past the used share.
- `4% used · $3,568.75` (Raleway 800 12px navy) and `of $85,712.38` (`#8593a4`).

## 6. Publishing goals (full width)

Same gate and link as today (`linked = canTool('publishing')`, `ROUTES.publishing`, the whole card is the link, `aria-label="Publishing goals, open the dashboard"`). Navy header `Publishing goals` / `Last 5 weeks`.

**Two clients side by side** (`grid-template-columns: repeat(2, 1fr)`, 1px `#eceff3` divider), each padding 20px 24px:
- Header: client name Raleway 800 16px; right, 12.5px `#8593a4`: `**3/5** weeks English on target · **2/5** all languages` (English figure `#167a52` when it hits all but one or more, else `#9a5a00`).
- **English chart**: label `ENGLISH` (Raleway 800 11px .08em navy) + `2 a week`. 150px plot, full column width. Y from 0 to 150% (clamped), top padding 22, bottom 10. Dashed 1.5px `#c9d1dc` line at 100%. Area under the line `rgba(1,35,88,.06)`; line navy 2.5px, round joins. A point per week: 12px dot with a 2.5px white ring and a 1.5px outline in the week's colour; the % above it (Raleway 800 12.5px). Colour: ≥100% `#167a52`, above 0 `#9a5a00`, 0 `#c8323d`. Week labels below (`Sep 21` … `Oct 19`), 11px `#8593a4`.
- **Every other language**, one row each (grid `52px 104px 1fr auto`, gap 14, padding 7px 0, bottom border `#f1f3f6`):
  - Code (Raleway 800 12.5px navy: ES, PT, SW, HI, FR) over the weekly target (`3/wk`, 11px `#8593a4`).
  - Sparkline 104×26: dashed `#d6dbe3` target line, teal `#1E7D7F` 1.8px line, 6px dots per week coloured green `#1E9E6A` / amber `#e08a1e` / red `#c8323d`.
  - Five week cells, 24px, radius 6, 11.5px/700: `3/3` on `#d6f0e3` text `#167a52` (met), `#fbe9cf` / `#9a5a00` (part), `#fbe1e1` / `#c8323d` (none).
  - Pill: weeks on target `3/5`, 12px/800, radius 999: all met `#e6f6ee`/`#167a52`, ≥2 `#fdf3e3`/`#9a5a00`, else `#fdeeef`/`#c8323d`.
- Footer: `Updated Oct 15, 2:04 AM · dashed lines are the targets · pills count weeks on target`, 11.5px `#8593a4` (`updatedLabel` as today).

**Boards in two-week cycles (Bessemeters)**, a full-width row under the two clients (padding 18px 24px 20px):
- Header: `Bessemeters` + `English · every 2 weeks · 2 per cycle` (12.5px `#8593a4`); right, `**4/5** cycles on target`.
- Five cycle cells (`repeat(5, 1fr)`, gap 12), each radius 12, padding 12px 14px: met bg `#f1f9f5`, missed `#fdf6ea`. Cycle label (`Sep 28-Oct 11`, 11.5px `#5b6b82`), % (Raleway 900 22px navy) with the count (`2 of 2`, 12px/800, green or amber), 6px bar (`#1E9E6A` / `#e08a1e` on `rgba(1,35,88,.08)`).
- Before the first cycle ends: one line instead: name + rule, `First cycle, Oct 12 to 25` with `0 of 1 so far` and an 8px progress bar, and an `Ends Sun, Oct 25` pill (`#fdeeef` / `#c8323d`).

AAAF's languages are **EN, ES, PT, SW, HI**. The per-language targets in the prototype (EN 2, ES 3, PT 2, SW 2, HI 2) are placeholders; read them from `publishing_targets`.

### Data changes in `lib/boards/publishing-weeks.ts`

- **5 complete weeks**, not 4 (`lastFourWeeks` → `lastWeeks(now, 5)`), and the last **5** complete cycles for a cycled board (`lastCompleteCycles(cadence, today, 5)`).
- Each `PublishingWeek` carries **every targeted language**, not only English: `langs: { lang, done, target }[]`. `computePublishingMetrics(...).boards[0].langs` already has them; keep `en` for compatibility.
- `PublishingBoardWeeks` gains per-language hits (`langHits: Record<string, number>`).
- Update `PublishingGoalsWidget.test.tsx` and `publishing-weeks.test.ts` for five rows and the language rows.

## Top bar

Who's working moves out of Home and into the top bar, as staging already has it (`ClockyTopBar`, `getWhosWorkingCount`, gate `ck-whos-working`): the people icon left of the clock, with a green `#177a52` badge (white figure, 2px white ring, top 3px right 2px, 18px). Super Admin and Admin see the company count; a Team Leader their team's.

## Avatars

Neutral when there is no photo: initials on `#eef1f5`, text `#435066`, 1px `#dfe4ea` border, Raleway 800. No team colours on the avatar. With `avatar_url`, the photo fills the circle (`object-fit: cover`) and the initials are not drawn. The status dot (green on the clock, `#cbd2da` off) keeps its colour. Change `Avatar`'s default `color` for these surfaces rather than adding a second component.

## Design tokens

Already in `globals.css`; listed with the values they resolve to.

- Navy `#012358` (`tn-primary`, `tn-ink`); gold `#F2C40A` (`tn-accent`); teal `#1E7D7F` (`tn-teal`); light teal `#94C4C5`; green `#1E9E6A` (bars), text green `#167a52`; amber bars `#e08a1e`, amber text `#9a5a00`; red `#c8323d`.
- Surfaces: page `#f1efe8`; card `#fff`; subtle `#f4f2ec`; faint fill `#f8f7f3`; borders `#e4e7ec` (`--panel-border`), rows `#eceff3` / `#f1f3f6`; muted text `#8593a4`; body `#435066`, secondary `#5b6b82`.
- States: warn `#fdf8e7` / `#8a6d1a` / border `#f0e2a8`; late `#fdeeef` / `#c8323d` / border `#f3c6ca`; ok `#e6f6ee` / `#0d7a4f`.
- Type: Raleway (`--font-display`) 700/800/900 for titles and figures; Open Sans body. Figures `tabular-nums lining-nums`.
- Radii: 20 (Pay period), 18 (cards), 16 (clock card), 12 (inner blocks), 10/9 (buttons, chips), 999 (pills, bars).
- Shadows: hero `0 18px 40px -26px rgba(1,35,88,.45)`; link-card hover `0 10px 28px -14px rgba(1,35,88,.45)` with border `tn-teal`.

## Loading and errors

Each widget loads in its own `Suspense` boundary with a skeleton of its own height; no widget waits for another (the page today awaits everything in one `Promise.all`; split it). A read that fails shows the widget with one line saying so, never zeros (`The i7 budget could not be read just now…`, `Publishing goals could not be read. Try again in a moment.`, the same for Pay period and Agenda).

## Files

- `Home Final.dc.html`: the design. Open it in a browser (with `support.js` beside it). Switches at the top: level, Pay period state (Auto, Running, Closes today, Late, Sent), Bessemeters (no data / with data).
- `reference/Home (atual).dc.html`: today's Home rebuilt from `main`, for comparison.
- `true-north.png`: the logo the prototype's top bar uses (the app has it at `/logos/true-north.png`).

Code this replaces or touches: `src/app/(app)/page.tsx`; `components/home/WelcomeBanner.tsx` (becomes the day banner), `TimesheetDueCard.tsx` (folded into Pay period), `ThisWeekCard.tsx` (becomes Agenda), `I7BudgetWidget.tsx` (compact), `PublishingGoalsWidget.tsx` (rewritten), `Favourites.tsx`, `Birthdays.tsx`, `Anniversaries.tsx` (off Home); `components/admin/SystemHealthBanner.tsx` (its summary feeds Needs you rows); `lib/boards/publishing-weeks.ts`; `components/Avatar.tsx`; `components/clocky/clock/ClockyTopBar.tsx` (Who's working, if not already merged from staging). Update `lib/manual/data.ts` (System manual) at the end.
