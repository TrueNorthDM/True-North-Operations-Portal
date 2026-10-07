# Access redesign: design and decisions

Status: Accepted 7 October 2026 (mockup approved with comments; built the same day)
Deciders: Arnaldo (owner). Built by Claude.

## 1. Why

Today what a person can open is decided in four places, and you have to cross
them in your head to know why someone sees something:

1. the person's level (`people.role_type`) and the matrix on Admin > Access levels
   (`access_level_pages`, catalogue in `src/lib/access/surfaces.ts`);
2. the tools granted per team on each card of Directory > Teams
   (`team_tool_grants`: Off, Lead, Team);
3. the person's position inside each team (Founder, Manager, Team Leader,
   Collaborator), which decides what "Lead" means;
4. the "People directory" levels 1 to 3, hidden inside the matrix rows.

The owner's brief (7 October 2026):

- Teams tab: only teams, members and each member's position.
- Four levels: **Super Admin, Admin, Team Leader, User**.
  - Super Admin: Arnaldo and David. Sees absolutely everything.
  - Admin: Tina, Jonatas, Wendy, Jeannette.
  - Team Leader: automatic, anyone who is **Lead** of at least one team.
  - User: everyone else.
- Team positions become **Lead** and **Member**.
- One detailed list: **Module > page or tool > tab or capability**, ticked per level.
- Tools get one more layer: **which teams** may use them, either the whole team
  or only its Leads.
- A change log with a mandatory reason, readable by Super Admins.
- On top of each level column, a button that opens a popup preview of that level,
  aware of team (an SEO Team Leader sees different tools from a Writing one), with
  a way on to View Stage for the full portal.
- Agreed extras: "why can this person see this", impact preview before saving,
  per-person exceptions with an end date, Super Admin safety rules, new pages
  start Super Admin only, bulk module switches, notification on rule changes.

Owner's decisions on the mockup (7 October 2026):

- The Admin column starts with the proposal (work, reports, people and most of
  Admin; not API tokens, two-step resets, manual hours, the month's note or
  Clocky).
- Tool team lists apply to Admins too; only Super Admins skip them.
- Founder, Manager and Team Leader positions become Lead; Collaborator Member.
- Staging first, then production after the owner sees who gains and loses.
- Comments on the mockup: explain Page, Tool, Tab and Action on the page; a
  change to a page or tool can apply to everything inside it (a switch, on by
  default); the Teams column is a dropdown ("3 teams have access", open for the
  list); each "Soon" tool has its own row.

## 2. Requirements

Functional

- F1. A catalogue tree of every module, page, tool, tab and capability.
- F2. Per item and level: allowed or not. Super Admin is always allowed.
- F3. Per tool: open to all teams, or to a list of teams, each "whole team" or
  "Leads only". Applies to Admin, Team Leader and User. Super Admin bypasses it.
- F4. Per person exceptions: grant or remove one item, until a date, with a reason.
- F5. Changes are staged on screen, shown with their impact (who gains, who
  loses), and saved together with one reason.
- F6. Every saved change is logged (who, when, before, after, reason) and can be
  undone, which is itself a logged change.
- F7. "Why": for any person, every item they can and cannot open, with the rule
  that decided it.
- F8. Level preview popup: one level, a chosen team and position, showing the
  navigation and the pages and tabs that combination reaches, including
  unsaved changes.
- F9. Super Admin only: this page, the log, exceptions, making Admins. At least
  two Super Admins at all times.
- F10. A page added to the catalogue starts allowed for Super Admin only.

Non-functional

- About 75 people, about 15 teams, about 150 catalogue items. Everything fits in
  memory; the resolver is a pure function over small inputs.
- The access answer for a page must not add a database round trip beyond what
  `loadAccess()` does today (it is cached per request).
- No lock-out: Super Admin cannot be configured away.
- Migration without a window: production keeps working at every step.

## 3. High-level design

```
                    +---------------------------------------+
  code              |  catalogue.ts  (modules > items > tabs) |
                    +-------------------+-------------------+
                                        |
  database          access_rules   access_team_rules   access_exceptions   people.access_level
  (rules)           (level x item) (item x team, audience) (person x item)  team_members.position
                                        |
                    +-------------------v-------------------+
                    |  resolve(person, rules) -> Decision[]  |   pure, tested
                    |  each Decision: allowed + reasons      |
                    +---+--------+---------+--------+--------+
                        |        |         |        |
                  page guards   rail   "Why" panel  level preview   impact preview
                  loadAccess()  nav    (one person) (level+team)    (everyone, old vs new)
                                        |
                    saveAccessChanges(changes, reason) -> one transaction
                                        |
                                  access_changes (log, undo)
```

## 4. Data model

```sql
-- Who is what. Team Leader and User are not stored: they follow team positions.
ALTER TABLE people ADD COLUMN access_level TEXT
  CHECK (access_level IN ('super_admin','admin'));        -- null = automatic

-- Team positions: Lead or Member (Founder, Manager, Team Leader -> Lead;
-- Collaborator -> Member).
-- team_members.position values migrated in place.

CREATE TABLE access_rules (            -- replaces access_level_pages
  level     TEXT NOT NULL CHECK (level IN ('admin','team_leader','user')),
  item_key  TEXT NOT NULL,
  allowed   BOOLEAN NOT NULL,
  PRIMARY KEY (level, item_key)
);

CREATE TABLE access_team_rules (       -- replaces team_tool_grants
  item_key  TEXT NOT NULL,
  team_id   UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  audience  TEXT NOT NULL CHECK (audience IN ('team','lead')),
  PRIMARY KEY (item_key, team_id)
);
-- No rows for a tool = open to every team. Rows = only those teams.

CREATE TABLE access_exceptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id  UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  item_key   TEXT NOT NULL,
  effect     TEXT NOT NULL CHECK (effect IN ('grant','deny')),
  until      DATE,                    -- null = until removed
  reason     TEXT NOT NULL,
  created_by UUID REFERENCES people(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE access_changes (          -- the log
  id         BIGSERIAL PRIMARY KEY,
  at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id   UUID REFERENCES people(id),
  reason     TEXT NOT NULL,
  changes    JSONB NOT NULL,          -- [{kind, key, before, after}]
  impact     JSONB,                   -- {gained:[...], lost:[...]} as computed at save
  undoes     BIGINT REFERENCES access_changes(id)
);
```

All five are read and written by the server with the privileged client, for a
person already identified, like the notification tables. The signed-in role may
read nothing (the log names people and reasons).

## 5. The resolver

```
decide(person, item):
  1. person is Super Admin                        -> allowed  ("Super Admin")
  2. an exception for (person, item), not expired  -> its effect ("Exception until ...")
  3. the item's parent is not allowed              -> not allowed ("Needs <parent>")
  4. access_rules[level][item] (or catalogue default; new items: false)
                                                   -> if false: not allowed ("<Level> is off")
  5. the item, or its tool, has team rules and the person is in none of them
     with the right audience                       -> not allowed ("Only <teams>")
  6.                                               -> allowed ("<Level>" + "Team <X>, <Lead|whole team>")
```

Every decision carries its reasons, which is what the Why panel and the preview
show. The same function runs with the saved rules (page guards) and with saved
plus staged rules (preview and impact), so the screen never disagrees with the
portal.

## 6. Decision records

### ADR-1: One resolver in app code; the database stays coarse

Status: Proposed

Context. Access is decided in app code today (`loadAccess`, `requireSurface`),
with row-level security as a second, coarser line (`is_admin()` in policies).
The owner's model (levels x teams x exceptions, tab level detail) is far finer
than RLS can express without a policy per table and tab.

Options

| | A. Resolver in app code | B. Encode it in RLS |
|---|---|---|
| Complexity | Low: one pure, tested function | High: policies per table, per tab |
| Explainability | Every decision has its reasons | Opaque: a row is or is not returned |
| Preview of unsaved rules | Trivial (pass other rules) | Impossible without writing them |
| Defence in depth | Needs the existing coarse RLS kept | Strong |

Decision. A. The resolver decides; RLS keeps its coarse role (signed-in role
reads only what everyone may read; admin areas use the privileged client after
the resolver said yes), and `is_admin()` is redefined as "Super Admin or Admin".
Client-facing numbers keep their rule (privileged and narrow, never RLS).

Consequences. Every page guard must call the resolver, which the migration does
by keeping `loadAccess().can(key)` as the entry point. A missed guard is a hole:
a test walks every route in `ROUTE_SURFACES` against the catalogue.

### ADR-2: Team Leader is automatic; only Super Admin and Admin are stored

Status: Proposed

Context. "Team Leader" is both a level and a team position today, and they can
disagree. The owner chose to derive the level from positions.

Decision. `people.access_level` stores only `super_admin` or `admin`; null means
"Team Leader if Lead of any team, else User". `role_type` is kept read-only for
one release (old code paths), then dropped.

Consequences. Making someone a Team Leader is done on the Teams tab (make them
Lead), never on the Access page; the Access page says so. Moving a person between
teams can change their level, and the log records it as a team change.

### ADR-3: The level preview is a simulation, not an embedded copy of the portal

Status: Proposed

| | A. Simulated from the resolver | B. iframe of the portal in View Stage |
|---|---|---|
| Speed | Instant | Loads a whole portal per level |
| Unsaved changes | Shown | Not shown (only saved rules) |
| Fidelity | Navigation, pages and tabs, not page content | Real pages |
| Side effects | None | View Stage's cookie would leak into the main tab |

Decision. A, with "Open in View Stage" for the real thing. The popup takes a
level, a team and a position (Lead or Member), and draws the rail, the opened
module and every page and tab with its decision.

### ADR-4: Staged changes live on the page; the save is one transaction

Status: Proposed

Decision. Edits are kept in the browser until "Review and save". The server
recomputes the impact from the saved rules (never trusts the browser's), checks
the Super Admin rules, writes the rules, then one `access_changes` row, and
notifies the Super Admins. (Built as sequential writes through the API, not one
database transaction: the rules are small upserts and the log is written last,
so a failure leaves no log entry for a change that did not land.) Undo writes the inverse as a new
change with its own reason. No draft table: nothing half-saved can exist.

### ADR-5: Tool access moves from team cards to the tool's row

Status: Proposed

Decision. `team_tool_grants` becomes `access_team_rules`, keyed by tool, edited
from the tool's row on the Access page ("All teams" or a list, each whole team or
Leads only). Migration: every existing grant is copied; a tool with no grant today
(hidden from everyone but admins) becomes "Off for every level" rather than "all
teams", so nobody gains access by the migration.

## 7. Migration plan (no window)

1. Migration 094 (before the new code): new tables and columns, the six named
   levels, tool team lists copied from `team_tool_grants`; positions may hold
   Lead and Member beside the old words. The catalogue's starting answers
   reproduce the old matrix and its configured rows, so nothing is copied from
   `access_level_pages`. Old tables stay.
   Migration 095 (after the new code is live): positions become Lead and
   Member, `profiles.role` follows the given levels, `people.role_type` mirrors
   the level by trigger, and the sign-up trigger uses the given level.
2. Code: the resolver behind `loadAccess()`; all existing `can()` keys mapped to
   catalogue keys; new Access page, Teams tab, log, preview. Staging first.
3. Compare: for every active person, the old and new answers for every key
   must be equal except where the owner's brief changes them. The list of
   differences is shown to the owner before production.
4. Promote. One release later, drop `access_level_pages`, `team_tool_grants`,
   `role_type`.

## 8. Audit before staging (7 October 2026)

The owner asked, before staging, for proof that changing who may open what,
exceptions included, works and that nobody can see what they may not. What the
audit found and what changed:

- **Direct database access.** The database's public address answered table
  reads to anyone signed in who copied their session from the browser, and
  several tables were readable by every signed-in role. Nothing in the browser
  needs it, so the address now refuses tables and private files without a key
  only the portal's server sends (the database gate, `deploy/README.md`). Row
  rules stay as the second, coarse line (ADR-1).
- **Data for hidden parts.** Several pages loaded everything and hid tabs in
  the browser. Each part is now read only when its item is open: Directory
  (rates, access log, portal access, two-step, teams), Human Resources (cards
  follow the Directory's items), Company settings (each section, including the
  API tokens and the webhook secret), the i7 report (no budget or budget used
  without "See the whole report"), Project Hours (costs, money in, people),
  Report (all five tabs), Hours, Clocky and the System manual (whose "How it
  runs" text is no longer in a public script file).
- **Exports** need every item whose figures the file carries
  (`lib/tsheets/export-keys.ts`).
- **Actions** that checked nothing now check their item (Href Links, Hours,
  publishing targets, Monday item history); site configuration has one item,
  Company settings > Sites & languages.
- **The rule.** An exception is decided after "Super Admin only" and after the
  parent page, so it can never open a Super Admin page, a key that left the
  catalogue, or a tab whose page is closed (the Add exception form already said
  so). A failed read of the rules or exceptions now refuses instead of falling
  back to the starting answers.
- **Items that were the page itself or a twin** left the catalogue: Directory
  People and My Team People (the page), Href Links' sites tab (the tool) and its
  configure action (the same as Sites & languages).
- **Tests that keep it so** (`lib/access/coverage.test.ts`): every page, file
  route and server action asks the rule or is listed with its reason, and every
  item on Access levels is asked for somewhere. `store.test.ts` follows a saved
  tick, team list, position and exception from the database rows to the answer.

Left as decided, for the owner to revisit: the Home budget widget (its own
item, ticked for Team Leaders) shows the i7 balance, which the i7 report hides
from the same Team Leaders without "See the whole report"; and the i7 budget
alert tells everyone with the tool the percentage used, never amounts.

## 9. What to revisit as it grows

- If the team count grows past a few dozen, the team picker needs search and the
  impact preview should be computed on the server only.
- If client logins arrive, they need their own level outside this tree.
- If Chat and Emails arrive, each mailbox or channel is an item with its own team
  rules (the model already allows it).
