# Handoff 2: True North Operations Portal — the rest of the app

This is the **second** handoff package. The first one
(`design_handoff_true_north/`) covered **Login**, the **app shell + Home**, and
the **Dashboards / Publishing Goals** area. **This package covers everything
else** — every other screen in the portal.

Read the first handoff's README **first**. This document does **not** repeat the
brand tokens, fonts, radii, animation rules, or the "how to implement without
making a mess" section — all of that still applies verbatim. This file only adds
the **new screens**, their **behaviour**, and their **data sources**.

---

## ⚠️ READ THIS FIRST — same rules as handoff 1, plus one

Everything from handoff 1 still holds:
1. **Don't restructure the app.** Apply the look to the existing components /
   routes; don't reshape them to match the prototype DOM.
2. Change only styling, tokens, and the specific copy called out here.
3. Reuse the existing dark-mode remap (`.dark { … }` in `globals.css`). Every
   screen in this package has a working Light/Dark toggle (top-right) — check
   both themes.
4. Branch + PR, commit per screen, build + eyeball after each.

**The one addition:** unlike handoff 1 (which was *pure restyle* of screens that
already existed), this package is a **mix of restyles and net-new features**.
Before building, confirm each screen's status against the codebase — see the
table below. Do **not** assume a screen already exists.

### What exists vs. what is new (confirm against the repo)
| Screen | Nav location | Likely status |
|---|---|---|
| **Projects** (hreflang home) | rail → Projects | restyle (route exists) |
| **Project pages** (site page list) | Projects → a site | restyle |
| **Page detail / editor** | a site → a page | restyle |
| **Tools** (hub) | rail → Tools | restyle |
| **Settings** | rail → Settings (pinned) | restyle + new sections |
| **Admin** (hub) | rail → Admin (pinned) | restyle / new hub |
| **Tickets** | Admin → Tickets | **new feature** |
| **Tests** (QA checklist) | Admin → Tests | **new feature** |
| **Directory** (people/teams/access) | Admin → Directory, and Home "My Team" | **new feature** |
| **System manual** (docs) | Admin → System manual | **new feature** |
| **My Work** (Tasks) | Home "My Work" widget | **new feature** |
| **i7 Budget Usage Report** | Tools → i7 report | **new feature** |

The Home page (handoff 1) already ships **My Team** and **My Work** as
placeholder widgets with a "Soon" pill. **Directory** is the build-out of *My
Team*; **Tasks** is the build-out of *My Work*. When these ship, replace the
"Soon" placeholders with live links.

---

## About the design files & fidelity
Same as handoff 1: the files in `prototypes/` are **plain-HTML design references**,
not production code. Ignore their internal machinery (`{{ }}`, `<sc-if>`,
`<x-dc>`, `.dc.html`, the `themeStyle` CSS-var string). Recreate the **rendered
look** inside the existing Next.js + Tailwind components.

Two of the older prototypes (Projects, Project pages, Page detail, Tools) show a
small **"Turn 4 — …" pill** in the top-left corner. That is exploration chrome —
**ignore it**, it is not part of the screen.

**Fidelity: high.** Colours, type, spacing, and interactions are final.

---

## Design tokens
**Use the exact token table from handoff 1** (brand navy/teal/gold/light-teal,
the warm light surfaces, the dark remap, Raleway + Open Sans, radii). Nothing
changes. The status / stage / flag colours defined there are reused across every
screen in this package. A few status colours these screens lean on:

- **Stage / status:** Completed `#1E9E6A`, Publishing `#1E7D7F`, Staging
  `#2A6FDB`, Proofing / Waiting `#E0940E`, Stuck / Blocked `#d64545`.
- **Priority:** Low `#1E9E6A`, Medium `#E0940E`, High `#d64545` (rendered as a
  signal-bars pill — 1/2/3 filled bars).
- **Language flags:** Spanish `#F5B800`, Portuguese `#009C3B`, Swahili `#00A3DD`.
- **Assignee count avatar:** orange `#E8912A`, white number.

---

## The shell (every screen reuses it)
All screens sit in the same frame from handoff 1:
- **Top bar:** white (dark `#0c1a30`), True North logo + "Operations Portal"
  (muted) baseline-aligned, theme toggle + circular navy avatar "AO" on the right.
- **64 px icon rail:** Home, Dashboards, Projects, Tools; **Admin + Settings
  pinned to the bottom**. Active = teal tint + teal icon. Rail icons keep the
  subtle looping micro-animation.
- **Breadcrumb** above each page title (e.g. `Dashboard / Admin / Tickets`).
- Page title in **Raleway 800**, muted one-line subtitle under it.

---

## Screens

### A. hreflang workflow — Projects → Pages → Page detail
This is the portal's core job: keeping **hreflang** language tags correct across
the two WordPress sites (**AAAF** — askanadventistfriend.com, **HFA** —
hopeforafrica). Three levels:

**1. Projects — `prototypes/Projects.dc.html`**
- Title "Projects" + "Manage hreflang tag workflows for AAAF and HFA WordPress
  sites."
- An **amber alert banner**: "N pages need hreflang review" with per-site jump
  pills (`AAAF · 2 →`, `HFA · 1 →`).
- One **site card** per WordPress site: site logo (`brand/aaaf.jpg`,
  `brand/hfa.png`) in a white tile, site name (Raleway 800), domain link,
  "View pages →", active-language chips (EN/PT/ES/SW), and 3 stat numbers
  (pages / with all langs / needing review). Card top edge uses the site brand
  colour (AAAF green `#44ad85`, HFA orange `#fe9d2d`). Hover lifts + teal border.

**2. Project pages — `prototypes/ProjectPages.dc.html`**
- Breadcrumb `Dashboard / AAAF`; big site title + domain; "Manage access" with
  **WP Dev** / **WP Live** link pills.
- **Overall progress** card (filled bar + "29 / 41 pages complete").
- Toolbar: search "N pages by name", **Status** select (All / …), **Has
  language** select. "Showing N of N".
- The page list is grouped into **collapsible sections**; each row shows the page
  name + which languages exist as small flag chips.

**3. Page detail / editor — `prototypes/PageDetail.dc.html`**
- Breadcrumb `Dashboard / AAAF / <page>`; page title; a status pill
  ("1/4 confirmed live"), a **Not relevant** toggle, and a **delete** (trash)
  button.
- **Language URLs** card: one row per language (EN/PT/ES/SW) — a coloured
  language chip, a full-width URL input, and an open-in-new-tab arrow (disabled
  when empty). A teal **Save URLs** button.
- Below: per-language "confirmed live" checkboxes / Edit / View / Copy actions.
- **This editor is the ONLY place the portal writes back to WordPress** (the
  hreflang tags). Everything else in the portal is read-only against its sources.

### B. Tools — `prototypes/Tools.dc.html`
Hub of "capabilities you use inside a project." Two cards:
- **Href Link Management** — entry into the hreflang workflow above ("Open a
  project →").
- **i7 Budget Usage Report** — "Hours, cost and budget usage for the i7 Marketing
  client — pulled live from QuickBooks Time." ("Open →" → the i7 report, screen F.)

Card = icon chip + Raleway 800 title + body + teal action link; hover lifts +
teal border; icons animate subtly.

### C. Admin (hub) — `prototypes/Admin.dc.html`
Landing for admin tools. Four cards, each linking to a screen in this package:
**Tickets**, **Tests**, **System manual**, **Directory**. Same card treatment
(icon chip, Raleway 800 title, "Open →", hover lift + teal border, animated icon).

### D. Admin screens

**Tickets — `prototypes/Tickets.dc.html`** *(new feature)*
- "Everything we need to resolve — so nothing gets lost."
- **6 stat cards**, each a solid colour block with a big count: Total (navy),
  In progress (gold), Blocked (red), Backlog (slate), Done (green), Won't do
  (grey).
- Toolbar: search, **type** select, **status** select, "Showing N of N".
- **Table:** Code (`TN-010`) · Type (pill) · Title · Area · **Priority**
  (signal-bars pill: Low/Medium/High) · **Status** (dot + label pill).
- Portal-local data (the team's own backlog), not Monday.

**Tests — `prototypes/Tests.dc.html`** *(new feature)*
- A QA / release **checklist**. Stat cards across the top (counts by state), a
  filter, and a **Reset** action.
- Items are grouped into **collapsible sections**; each row is a **tri-state**
  control (untested / pass / fail) with an optional **note** field.
- State persists locally (localStorage). Use it to sign off a release.

**Directory — `prototypes/Directory.dc.html`** *(new feature; = Home "My Team")*
People, teams, and access in one place. Four tabs (with counts): **People**,
**Emails**, **Teams**, **Access**.
- **People:** "Add person" button; search; **team** filter chips (All / SEO /
  Writing / Web / Leadership); an **All / Active / Inactive** segmented filter;
  and a **Columns** control to show/hide columns (Person is fixed; Team, Job
  title, Reports to, Type, Schedule, Joined, Internal rate are optional). Rows are
  clickable → a **person detail modal** with all the Monday board fields
  (Type, Team, Job title, Reports to / Also reports to, Schedule, Weekly hours,
  company email, contact, onboarding, dates, team members, employment history).
- **Emails:** the same people by their email addresses / accounts.
- **Teams:** a card per team with its members and the projects it can access.
- **Access:** the grant list — each row is **team × project × role**
  (Manager / Editor / Viewer), editable inline, with revoke. This is the model
  documented in the System manual.

**System manual — `prototypes/SystemManual.dc.html`** *(new feature)*
Internal documentation of the whole portal, in the app frame, with a fixed
**scroll-spy table of contents** on the left and six sections: Overview, Getting
around, Pages & sections (each screen + its data source), Access model (People →
Teams → Projects, and the three roles), How Monday feeds it (the data flow), and
Data sources. Content is prose + simple diagrams — recreate the layout; the copy
is the source of truth for how the app is meant to work.

### E. My Work (Tasks) — `prototypes/Tasks.dc.html` *(new feature; = Home "My Work")*
The signed-in person's own tasks.
- **Board / List** view toggle.
- Filters + a **"Show done"** toggle.
- **Board:** columns by status, cards with title / project / priority / due.
- **List:** the same tasks as rows.
- Tasks come from the person's assignments in **Monday**.

### F. i7 Budget Usage Report — `prototypes/i7 Report Client.dc.html` + `i7 Report Export (PDF).dc.html` *(new feature)*
A monthly report for the **i7 Marketing** client. Two modes of the same report,
switched by the **"VIEWING"** pill top-left; the **Export** button (top-right)
produces the PDF.
- **Client report** (`i7 Report Client.dc.html`) — the on-screen, client-facing
  view.
- **Export (PDF)** (`i7 Report Export (PDF).dc.html`) — the print/PDF layout
  (see the `*-print.html` siblings for the actual printable output).

Report content: "Your month at a glance" — **Budget available**, **Total work
delivered**, **Hours delivered**, **Budget remaining** stat cards; an **invoicing
breakdown** ("i7 invoice" + "MME billed to Wagner Meter separately"); **Budget
health**, **Investment by project**, and **Where your hours went** panels.
- **Hours** come live from **QuickBooks Time**; **rates & budgets** come from
  **Settings → Clients & budgets**.

### G. Settings — `prototypes/Settings.dc.html` *(restyle + new sections)*
Left **section rail**, editable form on the right, a **save toast**, and a
**"Synced N ago"** indicator. Five sections:
1. **Sites & languages** — the two WordPress sites, their Monday board IDs,
   Dev/Live URLs, and per-language targets (done / target / per-week).
2. **Publishing targets** — the publishing-goal targets (this is the "Targets
   editor" referenced in handoff 1 — it lives here, **not** on Boards Review).
3. **Clients & budgets** — the i7 (and MME) rates and monthly budgets that feed
   the i7 report.
4. **People & rates** — internal people and their rates.
5. **APIs & tokens** — the Monday / WordPress / QuickBooks connection tokens.

---

## Copy — fixes to make while implementing
Same principle as handoff 1 (**English wins**, use the prototype's wording). Two
specific leftovers to correct:
- **Settings section label** reads **"Clientes & budgets"** (Portuguese) — it
  should be **"Clients & budgets"**.
- Sweep each prototype for any stray Portuguese in labels/subtitles and use the
  English equivalent.

---

## Data sources (what each screen reads / writes)
- **Monday.com** — Tickets' *source of truth* is portal-local, but Directory
  people, My Work tasks, and the Publishing Goals data all originate from Monday
  boards (per-site Publishing boards + people/HR board). Read-only.
- **WordPress** (AAAF + HFA) — the Projects → Pages → Page-detail workflow reads
  each site's pages and **writes back only the hreflang tags** (from the Page
  detail editor). This is the single write-back in the app.
- **QuickBooks Time** — hours for the i7 Budget Usage Report.
- **Portal config / storage** — Settings values, the Tickets backlog, and the
  Tests checklist state.

---

## Assets
`brand/` (same as handoff 1, plus the two site logos this package uses):
- `logo-large.png` — True North lockup (top bar / login / report headers). On
  dark surfaces it sits on a white rounded chip.
- `brand-board.png` — palette + fonts reference.
- `aaaf.jpg`, `hfa.png` — the two WordPress site logos (Projects & Directory).
- (`logo-teal-navy.png`, `mood-board.png` included for reference.)

The prototypes reference `brand/…` relatively, so a copy of `brand/` also lives
inside `prototypes/` — that's only so the reference files render; ship the real
assets from the app's `public/`.

---

## Files in this package
```
README.md                     ← this file (read handoff 1's README first)
brand/                         brand + site logos
prototypes/
  Admin.dc.html                admin hub
  Projects.dc.html             hreflang home
  ProjectPages.dc.html         a site's page list
  PageDetail.dc.html           page editor (writes hreflang)
  Tools.dc.html                tools hub
  Tickets.dc.html              issue tracker
  Tasks.dc.html                My Work
  Settings.dc.html             5-section settings
  Tests.dc.html                QA checklist
  Directory.dc.html            people / emails / teams / access
  SystemManual.dc.html         internal docs
  i7 Report Client.dc.html     client-facing report
  i7 Report Export (PDF).dc.html   print/PDF report
  brand/, support.js           (so the reference files render)
screenshots/                   light + a couple of dark reference captures
```

## Screenshots (reference)
In `screenshots/`, light unless noted:
`00-admin` · `01-projects` · `02-project-pages` · `03-page-detail` · `04-tools` ·
`05-tickets` · `06-tasks` (+ `06b-tasks-dark`) · `07-settings` · `08-tests` ·
`09-directory` (+ `09b-directory-dark`) · `10-system-manual` ·
`11-i7-report-client` · `12-i7-report-export`.

Open each prototype in a browser and toggle Light/Dark (top-right) to see both
themes.
