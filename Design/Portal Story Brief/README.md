# The Operations Portal story: design brief

Written on 23 September 2026 for Claude Design. The facts below come from the portal's own code and its Git history (642 commits since 28 May 2026); dates are the day each piece first shipped.

## 1. What we want

Turn the current migration status page into **the story of the True North Operations Portal**: one public page that tells the team, in five chapters, where the portal came from, what it is for, what it already does for them, the move happening now, and what is coming next.

The migration status that is live today does not go away. It becomes chapter 4, and it keeps working exactly as it does now (live progress, clickable widgets, the phase timeline). See section 6.

**Audience:** the whole True North team and its leaders, most of them not technical. They should finish the page understanding why the portal exists, what it saves them, and what is changing. Technical detail stays available but lower down, never in the way.

**Tone:** warm, plain, confident, specific. Real numbers and real names of things. No hype, no jargon on the first read.

## 2. What exists today

- Live page: https://truenorth-portal-move.vercel.app (a static page, `migration-status/` in the portal's repository, its own Vercel project).
- `reference/current-landing.html`: its full source. Read it: the design system, the widgets and the data contract are all in there.
- `reference/current-landing-top.png`, `current-landing-full.png`, `current-landing-phone.png`: how it looks today.
- `reference/logo.png`: the True North lockup used in the top bar.
- `reference/progress.json`: the live progress file the page reads.

## 3. The five chapters, with the facts

### Chapter 1: How and why the portal started

- **28 May 2026.** It began as **Href Links**, an hreflang tag tracker for the AskAnAdventistFriend (AAAF) and Hope for Africa (HFA) WordPress sites. It replaced two Google Sheets workflows, and from day one it talked to Monday: when a page was marked in Monday, the portal knew.
- **8 June 2026.** It was renamed the **True North Operations Portal** and absorbed the **Boards Review** dashboard (the former COE Dashboard: the translation pipeline and weekly publishing goals), which is today's **Publishing Goals**.
- **9 June 2026.** It gained the **People and Teams directory** with access by team, an admin area with **Tickets** and **Tests**, and its shape: Dashboards, Projects, Tools, Admin.
- **Why.** The work lived in scattered spreadsheets, separate dashboards and manual exports, each with its own login and its own version of the numbers. The portal puts them in one place, on live data, with one sign-in.

### Chapter 2: The purpose

The portal's own line, on its sign-in page: **"One home for the tools, dashboards, and tasks that keep your team moving every day."**

What that means in practice:
- Live data from the systems the team already uses (Monday, QuickBooks Time), instead of copies typed by hand.
- Everyone sees what is theirs; leaders see their team; admins see everything; clients get clean reports.
- One sign-in, one address, one place to look.

### Chapter 3: What we have built, and how it helps the team

In the order they arrived. Each one names the manual work it replaced.

| When | What | How it helps |
|---|---|---|
| May 2026 | **Href Links** | Hreflang tags per page for AAAF and HFA, kept in step with Monday. Replaced two spreadsheets. |
| June 2026 | **Publishing Goals** | Weekly publishing pace against target, per client, read from the Monday boards. The targets are set in Settings. |
| June 2026 | **Home** and search | A personal home with widgets and favourites, and Cmd+K to jump anywhere. |
| June to July 2026 | **Directory** and **Organization** | People, teams and the org chart. On 17 July it became the HR source of truth. |
| July 2026 | **i7 Budget Usage Report** | Hours, cost and budget usage for the client i7 Marketing, straight from QuickBooks Time, with PDF, CSV and image exports. Replaced exports and pivot tables done by hand every month. |
| July 2026 | **View Stage** and **True North Team** | Admins preview the portal as each level sees it; the Monday team board mirrored live. |
| August 2026 | **Access levels** | What each level (user, team leader, admin assistant, admin) can open, set by an admin on one board. |
| August 2026 | **Project Hours and Others** | The project tracking sheet accounting kept by hand (AAAF, Grants Pass, Hope for Africa), now automatic, with donations, a month by month table and exports. i7 and MME added in September at break-even rates. |
| August 2026 | **Clocky** | The portal became the time clock, with history back to 2017 (138,330 time entries). |
| August to September 2026 | **My Work** and **My Team** | Everyone's Monday steps across every board in one list (about 50,000 assignments), and team leaders set their team's priority order. |
| September 2026 | **Report** | Team leaders read their team's workload and pace. |
| September 2026 | **New navigation** and **Notifications** | A navy rail with panels and search, and a bell that tells people about new work, deadlines and syncs, with a daily summary. |
| July to September 2026 | **The True North look** | The whole portal rebranded to True North Digital Marketing's identity. |

Numbers worth showing: **642** updates shipped in four months, **31** active people, **138,330** time entries, about **50,000** Monday assignments tracked.

### Chapter 4: The move happening now

Keep everything the current page says about the migration (see `reference/current-landing.html`): why the portal is moving, what changes for the team (new address truenorthportal.online, sign-in by invitation, Google or a 6‑digit code, a second step on the phone, up to three days offline), the progress widgets, the phase timeline, and the detailed plan lower down. Phase 0 is done; phase 1 is next.

### Chapter 5: What comes next

Frame these as **being built** or **possible next steps**, never as promises with dates.

- **Being built now:** Clocky reports, approvals and invoices; My Hours for each person.
- **Planned modules:** **Chat** and **Emails**, arriving in the Messages drawer already in the top bar.
- **SEO tools in the catalogue, not built yet:** Schema App, Schema Scraper (pull the schema off any URL and compare it with ours), Knowledge Graph (the entities in our schema and how they connect), Page Auditor (titles, headings, links, speed), Image Optimization (weight, format, missing alt text), Analytics (traffic and search per site), Impact Globe (where in the world the sites are read).
- **Improvements from the team's feedback:** My Work showing when a step is waiting on the previous one, and notifications for it.
- **After the move:** this status page can live inside the portal itself.

## 4. Visual identity (use it, don't reinvent it)

The page must look like the portal. Everything below is in `reference/current-landing.html`.

- **Colours:** background `#f1efe8` (warm off-white), cards `#ffffff` with border `#e4e7ec`, body text `#435066`, muted `#8593a4`, navy `#012358` (headings, primary), gold `#F2C40A` (accents, the top rule), teal `#1E7D7F` (links, active), green `#1E9E6A` (success, icons on white).
- **Type:** Raleway 800 and 900 for headings, Open Sans for text, both from Google Fonts.
- **Shapes:** cards with 14px radius (18px for the headline widgets), soft navy shadows.
- **Top bar:** white, the True North logo with "Operations Portal" beside it, a 3px gold rule along the top.
- **Widgets:** navy ones with white words and gold details (the headline ones, clickable); white ones with navy words and green icons.
- Light theme only.

## 5. Rules (from Arnaldo, all mandatory)

1. **No dashes anywhere in the text**: no em dash, no en dash, no hyphen used as a dash. Use a colon, a comma or a full stop.
2. **Text uses the full width of its block.** No narrow measure (`max-width` in `ch`). A line breaks only where the block ends or a new paragraph starts.
3. "6‑digit" is written with a non-breaking hyphen so it never splits across lines.
4. The **Progress** widget stays large on the left, with the animated percentage, the animated gold bar and one pip per phase. **Happening now**, **New address** and **Portal offline** sit stacked on its right.
5. The navy widgets are clickable as a whole, with a **gold info icon in the bottom right corner** (no "See every step" text links). Progress goes to the timeline; Happening now goes to the current phase, opened.
6. It is a **public** page: nothing secret, no internal server details beyond what is there today. Keep `noindex`.
7. Works on a phone: everything stacks, no sideways scrolling.
8. English on the page.

## 6. The data contract (must keep working)

The migration chapter is driven by data, and a daily task updates it. Keep this exactly:

- The page fetches `progress.json` (no cache): `{ "updated": "YYYY-MM-DD", "offlineWindow": null | { "label", "note" }, "done": { "<step-id>": "YYYY-MM-DD" } }`.
- The phases and steps live in the `<script type="application/json" id="plan">` block. **Every step id must stay the same** (p0-brainstorm, p1-org, p3-db, p6-dns and so on): the internal plan and the daily sync use them. Wording can be improved; ids cannot change.
- Percentages, the current phase, the pips and each phase's status (Done, In progress, Up next, Portal offline) are computed from those two, never written by hand.
- When the tab is hidden, final values show at once (animations only run when someone is looking).

## 7. What to send back

The same shape as the navigation handoff you made on 21 September (`Design/Redesign Handoff`):

- A navigable prototype of the new page (`.dc.html`), with chapter navigation so a reader can jump between the five chapters.
- A `README.md` implementation guide: what changes in `migration-status/index.html`, section by section.
- A `CLAUDE_CODE_PROMPT.md` to paste into Claude Code.
- `screenshots/` of each chapter, on desktop and on a phone.

Ideas welcome: a visual timeline for chapter 1, before and after comparisons for chapter 3 (the spreadsheet it replaced versus the screen that replaced it), and a clear "Being built / Possible" split for chapter 5.
