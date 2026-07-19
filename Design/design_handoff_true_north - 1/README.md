# Handoff: True North Operations Portal — brand & UI redesign

## Overview
This package restyles the **True North Operations Portal** (Next.js app) to the
**True North Digital Marketing** brand. It covers three areas:
1. **Login** (`/login`)
2. **App shell** (top bar + sidebar) + **Home** (`/`)
3. **Dashboards** landing (`/dashboards`) + **Publishing Goals** dashboard

The redesign is **visual only** — brand colors, typography, spacing, card
styling, a light/dark theme, the logo lockup, and a few small copy changes.
No new features, no new data, no routing changes.

---

## ⚠️ READ THIS FIRST — how to implement without making a mess

This is the most important section. A previous attempt at a handoff like this
"got messy" because the implementer **restructured the app**. Do not do that.

**Rules:**
1. **Do NOT restructure anything.** Keep every component, route, server action,
   Supabase call, prop, and piece of state exactly as it is. You are only
   changing *how things look*, never *how they work* or *where they live*.
2. **Change only three kinds of things:** (a) Tailwind classes / inline styles,
   (b) design tokens in `src/app/globals.css`, (c) the specific copy strings
   listed in the "Copy" notes below. Nothing else.
3. **Reuse the existing dark-mode mechanism.** `globals.css` already implements
   dark mode by remapping CSS variables under `.dark` (see the `.dark { … }`
   block). **Do not** hand-write `dark:` variants per element or add a second
   theme system. Put brand colors into the existing token variables so the
   existing remap keeps working. `ThemeToggle.tsx` and `/theme-init.js` stay
   untouched.
4. **Work in this exact order, and build + eyeball after each step. Commit per
   step so you can roll back cleanly:**
   - **Step 1 — Tokens & fonts.** Update `globals.css` brand tokens and swap the
     display/body fonts in `src/app/layout.tsx`. Verify the whole app still
     builds and the palette shifted. *(This alone gets you ~60% of the look.)*
   - **Step 2 — App shell.** Restyle the top bar in `src/app/(app)/layout.tsx`,
     `Sidebar.tsx`, `UserMenu.tsx`. Add the logo lockup.
   - **Step 3 — Login.** `src/app/login/page.tsx` + `src/components/LoginForm.tsx`.
   - **Step 4 — Home.** `src/app/(app)/page.tsx` + `HomeWidgets.tsx` +
     `FavoritesBlock.tsx` + `OrgChart.tsx`.
   - **Step 5 — Dashboards / Publishing Goals.** `src/app/(app)/dashboards/page.tsx`
     + the Publishing Goals dashboard components.
5. **Branch + PR.** Do it on a feature branch (`feat/true-north-brand`), commit
   per step, open a PR. Never push straight to main.
6. If something in a prototype conflicts with the existing component structure,
   **keep the existing structure and apply the styling to it** — don't reshape
   the component to match the prototype's DOM.

---

## About the design files
The files in `prototypes/` are **design references written in plain HTML**
(they open in any browser). They are **not** production code and must **not** be
copied into the app. They exist to show the intended look, spacing, colors,
copy, and interactions. Your job is to **recreate that look inside the existing
Next.js + React + Tailwind v4 components**, using the app's established patterns.

Ignore the prototypes' internal machinery (the `{{ }}` templating, `<sc-if>`,
`<x-dc>`, the CSS-variable `themeStyle` string, `.dc.html` wrappers). Only the
**rendered visual result + the values in this README** matter.

## Fidelity
**High-fidelity.** Colors, typography, spacing, and interactions are final.
Recreate pixel-close using Tailwind classes / tokens.

---

## Design tokens (exact)

### Brand colors (from the True North brand board)
| Token | Hex | Use |
|---|---|---|
| Navy (primary / ink) | `#012358` | headings, primary buttons, avatar, logo text |
| Teal (accent) | `#1E7D7F` | active nav, links, focus ring, highlights |
| Gold (spark) | `#F2C40A` | logo star, small accents, top rule |
| Light teal | `#94C4C5` | soft fills, chart "Target" bars |

### Semantic surface tokens — LIGHT
```
canvas (page bg)      #f1efe8      surface (cards)     #ffffff
top bar / rail bg     #ffffff      ink (headings)      #012358
body text             #435066      muted text          #8593a4
border                #e4e7ec      field border        #d5dbe2
hover bg              #f4f2ec      track (progress bg)  #eef0f3
active nav bg         rgba(30,125,127,.10)   active nav ink  #1E7D7F
card shadow           0 1px 2px rgba(1,35,88,.06)
```

### Semantic surface tokens — DARK (feed these into the existing `.dark` remap)
```
canvas   #070f1d      surface  #101f37      top bar/rail #0c1a30
ink      #eaf1fb      body     #aebfd4      muted        #74849c
border   #20355a      field bg #0b1a31      field border #2a4168
hover bg #0c1a30      track    #16294a
teal     #5ac2bf      primary button #2a5cab   avatar    #2a5cab
chart navy bar → #4b8fe0 (navy is invisible on dark, so lighten it)
logo    → sits on a white rounded chip in dark (see Assets)
card shadow  0 1px 2px rgba(0,0,0,.4)
```

### Typography
- **Headings / display:** **Raleway** (weights 700 / 800 / 900). Replaces the
  current Space Grotesk display face.
- **Body / UI:** **Open Sans** (400 / 600 / 700). Replaces Geist for body text.
- Both are Google Fonts — load via `next/font/google` in `layout.tsx`.
- Headings are tight: `letter-spacing: -0.01em`. Uppercase micro-labels use
  Raleway 800, `letter-spacing: .08em–.1em`.

### Radii & shape
- Cards `14px`; app frame / big panels `18px`; inputs & selects `10–12px`;
  pills / badges / avatars `999px`; icon-rail items `12px`.

### Chart / status colors
- Chart: **Published** = navy `#012358` (dark: `#4b8fe0`), **Target** = `#94C4C5`.
- Progress bar per language (flag colors): Spanish `#F5B800`, Portuguese
  `#009C3B`, Swahili `#00A3DD`. (French `#0055A4` — currently **not in use**.)
- Stage/status: Completed `#1E9E6A`, Publishing `#1E7D7F`, Staging `#2A6FDB`,
  Proofing `#E0940E`, Stuck `#d64545`, Waiting `#E0940E`.
- Assignee count avatar: orange `#E8912A`, white number.

---

## Step 1 — tokens & fonts (do this first)

### `src/app/globals.css`
Update the brand tokens in the `@theme` block (the app already exposes
`--color-tn-primary` / `--color-tn-accent`; just change the values and add teal +
light-teal):
```css
--color-tn-primary: #012358;   /* was #24466e */
--color-tn-accent:  #F2C40A;   /* was #f4c24a */
--color-tn-teal:    #1E7D7F;
--color-tn-teal-soft:#eaf4f4;
--color-tn-lightteal:#94C4C5;
```
Update the light `:root` surface vars to the warm set above (`--background`
`#f1efe8`, `--foreground` `#012358`, `--card #ffffff`, `--border #e4e7ec`,
`--muted #8593a4`, `--primary #012358`). Point `--font-display` at Raleway.
In the `.dark { … }` block, set the dark surface values above (the block already
mirrors the palette — just supply True North's dark tones and a lightened
`--color-tn-primary` `#4b8fe0` for dark).

### `src/app/layout.tsx`
Swap the `next/font/google` imports: add `Raleway` (`['700','800','900']`) and
`Open_Sans` (`['400','600','700']`); set the display variable to Raleway and the
body/sans variable to Open Sans. Keep the AAAF/HFA brand fonts (Nunito/Bebas)
as-is. Keep `suppressHydrationWarning` and the `/theme-init.js` script.

---

## Screens

### 1. Login — `prototypes/Login.dc.html`
**Target files:** `src/app/login/page.tsx`, `src/components/LoginForm.tsx`.
**Use option `1a` (the split brand panel)** — it's the chosen direction.

- **Layout:** full-height centered card, `max-width ~1120px`, `border-radius 22px`,
  frame shadow, two columns:
  - **Left panel (~454px):** deep navy gradient (`#012358 → #0a2f63`) with an
    animated "north-star / sunrise" motif (rotating gold light rays, breathing
    glow, expanding rings, pulsing gold core). Content centered: eyebrow
    "TRUE NORTH" (Raleway 900, light-teal, letter-spacing .34em), headline
    "Operations Portal" (Raleway 900, 52px, white), and a supporting paragraph.
    Motion must respect `prefers-reduced-motion`.
  - **Right panel:** off-white; the True North logo at top (see Assets), then the
    magic-link form, **center-aligned**.
- **Form:** label "Work email" (Raleway 800, uppercase, 12px); email input
  (full width, `border-radius 12px`, `1.5px` border, **text centered**, teal
  focus ring `0 0 0 3px rgba(30,125,127,.18)`); navy submit button "Send magic
  link" (Raleway 800, hover darkens). Keep the existing client-side domain
  validation (`isAllowedEmail`) and the `sendMagicLink` server action — only the
  visuals change. On success show the "Check your inbox" panel.
- **Dark mode:** navy panel stays dark; right panel + form follow dark tokens;
  the logo gets a white rounded chip so it stays legible.

### 2. App shell + Home — `prototypes/Home.dc.html`
**Shell target files:** `src/app/(app)/layout.tsx` (top bar), `Sidebar.tsx`,
`UserMenu.tsx`, `ThemeToggle.tsx`.
- **Top bar:** white (dark: `#0c1a30`), bottom border. Left = **the True North
  logo** (`brand/logo-large.png`) with "Operations Portal" (muted) baseline-
  aligned to the logo's bottom; **no "/" divider**. Right = theme toggle
  (sun/moon, existing behavior) + circular avatar with initials on navy
  (dark: `#2a5cab`).
- **Sidebar:** 64px icon rail, white bg, right border. Keep the exact existing
  icons and order (Home, Dashboards, Projects, Tools; Admin + Settings pinned to
  the bottom). Active item = teal tint bg + teal icon (`--color-tn-teal`); idle =
  muted, hover = light bg + navy icon. Keep the hover tooltips.

**Home target files:** `src/app/(app)/page.tsx`, `HomeWidgets.tsx`,
`FavoritesBlock.tsx`, `OrgChart.tsx`.
- **Heading:** "True North Operations Portal" (Raleway 800) + "Where would you
  like to go?" (muted).
- **Widgets (`HomeWidgets`):** the 4 destination cards in a **single row** (grid,
  4 equal columns). Icon in a teal-soft rounded chip; title Raleway 800; hover
  lifts + teal border. Placeholders (My Team / My Work) keep the dashed border +
  "Soon" pill. **Each icon has a subtle looping micro-animation** (grid pulses,
  wrench wiggles, people split apart to reveal a third figure, briefcase sways) —
  optional but nice; guard with `prefers-reduced-motion`.
- **Favourites (`FavoritesBlock`):** pinned cards with a gold star; "Edit" opens
  the existing inline picker (grouped checkboxes, count `n/5`, Save/Cancel).
  Keep the existing save logic.
- **Org chart (`OrgChart`):** person cards with a colored top band + connector
  lines; team box under a leader; card hover lifts + teal border. "Full screen"
  opens the existing zoomable overlay. Keep the existing tree-building logic.

### 3. Dashboards + Publishing Goals — `prototypes/Dashboards.dc.html`
**Landing target files:** `src/app/(app)/dashboards/page.tsx`, `NavCard.tsx`.
- "Dashboards" + "Boards Review dashboards." + 2 nav cards ("Publishing Goals",
  "Workload — IN CONSTRUCTION") in a 2-col grid. Icon chip, Raleway 800 title,
  teal "Open →". Publishing Goals card hover lifts + teal border. Icons animate
  subtly.

**Publishing Goals target:** the component that renders the live Publishing Goals
dashboard (`/dashboards/publishing`). The prototype mirrors the live structure —
apply the brand to whatever renders it; keep all data logic.
- **Header:** "Publishing Goals" (Raleway 800) + the existing subtitle
  ("Publishing pace versus target for the AAAF and HFA Publishing boards … tracked
  from the Publishing column in Monday.") + a teal outline pill "Publishing Goals
  · Boards Review".
- **Controls:** "Updated 4h ago" pill (green dot) + period select ("This week").
- **Filters:** three bordered boxes with uppercase labels — Board / Publisher /
  Search.
- **Stat cards (4):** Total Items — Not Published / Completed / Staged to Publish /
  Avg time per stage. Each: label + info (i), a small trend arrow in a tinted
  square (colors: blue / red / green / gold), big number (Raleway 900, 36px),
  an "AAAF: x · HFA: y" pill, and a caption.
- **Goals progress card:** header "Goals progress" + "n/n pages" + Export PDF /
  Export CSV, and a **chart with a Bars/Rings toggle**:
  - **Bars:** grouped vertical bars per board·language, Published (navy) vs
    Target (light-teal), with y-gridlines.
  - **Rings:** conic-gradient completion donuts — one "Overall" + one per board.
  Below: per-board progress rows using the **flag colors** above.
- **Items list:** table — Item (title + `#id`) · Project · Language · Current
  stage (dot + label pill) · Assignee (orange count avatar + name + "+N") · Time
  in stage · Updated.

---

## Copy — keep the NEW wording

Where the prototypes' copy differs from what's in the code today, **the prototype
copy is the intended final copy — use it.** Notable changes:
- **Login subtitle:** "Use your True North — Good News Advocates email
  **@goodnewsadvocates.org**." (heading "Welcome back").
- Login form is **center-aligned** and the email placeholder is
  `you@goodnewsadvocates.org`.
- Everything is in **English** (earlier drafts had some Portuguese — English wins).
- Boards Review currently shows **Goals** and **Translation** only — the
  **Targets** editor lives on the **Settings** page, not here.
- Publishing Goals language scope is currently **Spanish, Portuguese, Swahili**
  (French is paused / hidden).

Read each prototype in the browser and lift the exact strings from it.

---

## Animations

All motion is **pure CSS** (`@keyframes` + `animation` on the element) and every
looping animation is disabled under `prefers-reduced-motion: reduce`. Put the
keyframes in `globals.css` and apply them with classes. Two rules that matter:
- Elements that animate must **not remount** on unrelated re-renders, or the
  animation restarts. In particular, for the "people split" icon the three
  figures must be **rendered together in the same commit** so they stay in phase.
- Keep durations slow and amplitudes small — this is subtle ambient motion, not
  attention-grabbing.

**1. Login — left panel "sun / sunrise" (`prototypes/Login.dc.html`, option 1a).**
The gold star/sunrise motif is alive:
- Two **counter-rotating light-ray layers** (a `repeating-conic-gradient` of thin
  gold/light-teal rays, masked into a ring band): `~80s` and `~120s`, linear,
  opposite directions.
- **Breathing radial glow** behind the core: opacity + scale, `~6.5s` ease-in-out.
- **Expanding light pulses**: 1px rings that scale from ~0.3→1 and fade out,
  `~5.4s` ease-out, staggered by ~1.8s (3 rings).
- **Pulsing gold core**: scale + box-shadow glow, `~6.5s` ease-in-out.

**2. Home widget icons (`prototypes/Home.dc.html`).** Each of the 4 icons loops a
distinct subtle motion (all ease-in-out, ~3–3.4s):
- **Dashboards** (grid): gentle scale pulse.
- **Tools** (wrench): rotate wiggle (±~16°).
- **My Team** (people): the two figures slide **apart** (translateX ±6px) and, at
  the separated point, a **third figure fades + scales in** in the middle
  (`tn-appear`) — so it reads "2 people → 3". The third figure uses the same
  glyph as the others. Snaps back together on the return half.
- **My Work** (briefcase): slight rotate/translate sway.

**3. Dashboards landing card icons (`prototypes/Dashboards.dc.html`).** The
Publishing Goals chart icon pulses; the Workload grid icon wiggles.

**4. Hover / transitions (throughout).**
- Cards (widgets, favourites, nav cards, org-chart cards): hover lifts
  `translateY(-2px…-4px)` + border turns teal + stronger shadow, `~.16–.18s`.
- Buttons / nav / tabs: color + background transitions `~.15s`.
- Theme switch: `background`/`color` transition `.3s` on the page + panels.
- Table rows: hover background = hover token, `~.12s`.

## Assets
- `brand/logo-large.png` — the full True North lockup (navy wordmark + gold
  star + teal "DIGITAL MARKETING"). Use in the top bar and on the login form.
  On **dark** surfaces, place it on a white rounded chip (transparent PNG). Add
  it to the app's `public/` and reference it (e.g. `/logos/true-north.png`).
- `brand/brand-board.png` — the brand board (palette + fonts) for reference only.

## Files in this package
- `prototypes/Login.dc.html` — login (use option 1a)
- `prototypes/Home.dc.html` — app shell + home (has a Light/Dark toggle top-right)
- `prototypes/Dashboards.dc.html` — dashboards landing + Publishing Goals
  (click "Open →"; the Goals progress card has a Bars/Rings toggle)
- `brand/logo-large.png`, `brand/brand-board.png`

## Screenshots (reference — light & dark)
In `screenshots/`, for checking your implementation against the intended result:
- `01-login-light.png`, `02-login-dark.png`
- `03-home-light.png`, `04-home-dark.png`
- `05-dashboards-landing-light.png`
- `06-publishing-goals-light.png`, `07-publishing-goals-dark.png`

Open each prototype in a browser and toggle Light/Dark to see both themes.
