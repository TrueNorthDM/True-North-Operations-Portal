Rebuild the Home page of the TN Operations Portal from the design in this folder.

Read `README.md` first, top to bottom: it is the spec. Open `Home Final.dc.html` in a browser for the look and the behaviour (the switches at the top change the level and the states). The HTML is a reference, not code to copy: build it in the app's own stack (Next.js App Router, server components, Tailwind v4 with the tokens in `src/app/globals.css`) and reuse the existing components (`Sunrise`, `Avatar`, `TenureBadge`, `NavIcon`, the `Meter` in `I7CarryoverPanel`, the drawers' focus handling).

Work in this order and run `npm run verify` after each step:

1. **Data.** Extend `lib/boards/publishing-weeks.ts`: 5 complete weeks, 5 complete cycles for a cycled board, every targeted language per row (`langs`), per-language hits. Update its tests and `PublishingGoalsWidget.test.tsx`.
2. **Page skeleton.** Rewrite `src/app/(app)/page.tsx` to the layout in the README (banner, then the grid: the tabs card, Pay period under it, the right column, Publishing goals). Each widget gets its own `Suspense` boundary and its own failure line. Remove Favourites, the org chart, Birthdays and Anniversaries from Home.
3. **Banner / day timeline.** Turn `WelcomeBanner` into the day banner: the sun following the time, today's worked segments, the clock card wired to the same source as the top bar clock (`getClockPanel`).
4. **Pay period.** New component; it absorbs `TimesheetDueCard` and its four states (Running, Closes today, Late, Sent), driven by `loadHomeTimesheet` and the period's entries, approved time off and holidays.
5. **Needs you / My Work / Requests.** One card, three tabs, a hidden-scrollbar list sized by the right column. Row kinds and who gets them are in the README tables; the System rows come from `healthSummary` (what `SystemHealthBanner` reads). Add the side panel; its primary button calls the same server action as the page behind it.
6. **Agenda** (Out today + next 5 events, from `loadAgendaItems`) and the compact **i7 Budget**, last in the right column.
7. **Publishing goals**, full width: two clients side by side, the English chart, a row per other language, and the cycle row for Bessemeters (with its "first cycle" state).
8. **Top bar and avatars.** Who's working as the people icon with its badge (from staging, if not already in), and neutral initials avatars with photos when `avatar_url` is set.
9. Update `lib/manual/data.ts` for the new Home.

Rules that must hold:
- Team Leaders never see amounts: no invoice values anywhere on their Home, panel included.
- The timesheet is never a Needs you row; the Pay period card owns it.
- A read that fails says so in its widget; it never shows zeros or disappears.
- Gates are the ones the pages already use (README, "Levels"). Hiding a widget and blocking its data come from the same check.

When something in the code contradicts the README (a name, a route, a data shape), follow the code and note the difference in your summary.
