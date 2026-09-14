# My Work: what the team reported, and what is actually true

> **Start with `00-briefing.md`.** This file is the full evidence behind it.
>
> **The draft replies in this file were written before verification and must not be sent.**
> When a verdict was overturned, the workflow replaced the verdict and kept the first
> classifier's reply text, so seven drafts (J1, J4, J5, A1, A3, A4, A8) say things that are
> wrong. Each is marked below. The corrected answers are in the briefing.

Two team members reviewed My Work in August 2026. Their feedback was checked against the
source rather than taken at face value or waved away: every item was classified, and every
classification was then attacked by three independent readers through different lenses.
Six of thirteen verdicts were overturned by that challenge. Analysis run 2026-09-10;
the load-bearing numbers were re-checked by hand on 2026-09-14 (see the briefing).

An independent audit ran alongside it and found 51 further problems, 17 of them serious.

## What they are really saying

Two complaints are really one. The list is too long: 700+ open rows for a single person,
most of them work that ended years ago or people columns that were never stages of work at
all. And the list disagrees with Monday: a row whose own status chip reads "No edits needed"
sits under a heading saying "Steps still open", finished audits carry a red Late badge, and
the column that would let anyone check the item in Monday is empty on every row for everyone
who is not a security admin. Underneath both is the same set of decisions. Doneness is read
only from each Monday board's own done_colors, with no in-portal override and no way to
repair a step that was paired to the wrong status column. A step is seeded automatically
from every people column on every active board, and all 174 of them are still unreviewed
guesses. One deadline is read per item and stamped on every owner of that item. And the
person looking at the page has a search box, Mine/Everyone, person, team and a finished-work
toggle, which is nothing that narrows open work and nothing that sorts. So the plan is
ordered to make the list shorter and truer first with very small diffs, then give the person
on the page real levers, then give doneness a repair path, then stop blaming one person for
another person's deadline.

## The single worst finding (verified by hand)

**The Monday link is dead for everybody except admins.** Both reviewers said there was no
link to Monday. There is one, in the last column, and it is empty for them.
`app_settings` is readable only by admins (migration 052), `loadWorklist` reads the account
slug with the signed-in person's own client (data.ts:165), so for a non-admin the slug comes
back null, `itemUrl` returns null on its first line, and every row renders a dash. The slug
IS configured (`truenorthdigitalmarketing`). An admin looking for this bug cannot see it.

## Verdicts

| Tag | Item | Verdict | Effort | Impact | Draft reply |
| --- | --- | --- | --- | --- | --- |
| J1 | my-work-row-click-opens-monday | portal-gap (upheld) | small | medium | DO NOT SEND |
| J2 | my-work-700-tasks-none-are-priorities | portal-gap (upheld) | medium | high | usable |
| J3 | my-work-aaaf-onpage-seo-skip | monday-data (upheld) | none | medium | usable |
| J4 | my-work-old-boards-unrecognised-done-statuses | portal-gap (overturned) | small | medium | DO NOT SEND |
| J5 | my-work-all-boards-one-place-workload-balancing | portal-gap (overturned) | small | low | DO NOT SEND |
| A1 | my-work-monday-link | portal-bug (overturned) | small | low | DO NOT SEND |
| A2 | my-work-overdue-not-my-step | portal-gap (upheld) | large | high | usable |
| A3 | my-work-tasks-from-years-ago | portal-gap (overturned) | medium | medium | DO NOT SEND |
| A4 | my-work-no-edits-needed-stays-open | portal-gap (overturned) | small | medium | DO NOT SEND |
| A5 | my-work-not-relevant-still-shows-bm-photo-curation-audits | monday-data (upheld) | small | medium | usable |
| A6 | my-work-filter-sort | portal-gap (upheld) | small | high | usable |
| A7 | my-work-bm-general-audit-late-vs-done | portal-bug (upheld) | medium | high | usable |
| A8 | my-work-aaaf-publishing-bottleneck | already-exists (overturned) | medium | high | DO NOT SEND |

## J1. my-work-row-click-opens-monday

**From:** Jeannette Owens (email, 31 Aug 2026)

**What they wrote:**

> It would be nice if clicking a task opened up the monday task directly rather than the
> history. Maybe make the option to open the history a secondary option.

**Verdict:** portal-gap, upheld; effort small, impact medium

Clicking a row on My Work opens the history panel, and the only way to jump to Monday is the
small eye icon in the last column, so the swap they are asking for does not exist yet.

**Evidence:**

- src/components/monday/WorkList.tsx:359 - the row div is `onClick={() => onPick(r)}`, and
  that is the row's only click handler
- src/components/monday/WorkList.tsx:456 - `onPick` is `setOpenRow`, wired at
  WorkList.tsx:696, :707 and :718 for the Unknown user / On-going / Completed blocks
- src/components/monday/WorkList.tsx:725 - `{openRow && <HistoryPanel row={openRow}
  onClose={...} />}`: the row click opens the history drawer and nothing else
- src/components/monday/WorkList.tsx:395 - the Monday link exists only in the twelfth
  column: `{r.url ? <OpenInMonday href={r.url} label={r.itemName} /> : <span>-</span>}`
- src/components/monday/WorkList.tsx:97-132 - `OpenInMonday` is a 28x28 eye chip,
  `target="_blank"`, with `onClick={e => e.stopPropagation()}` at :112 precisely so the eye
  does not also open the history
- src/components/monday/WorkList.tsx:64 - `const GRID = '13% 9% 8% 7% 10% 6% 8% 9% 8% 6% 9%
  7%'`, and WorkList.tsx:336-337 wraps the grid in `min-w-[1180px]` with horizontal scroll,
  so on a normal laptop the Monday column is off-screen to the right
- src/components/monday/WorkList.tsx:230-241 - a second Monday link sits in the history
  panel header, i.e. today Monday is reachable in two clicks (row, then eye) or one hard-to-
  find click
- src/components/monday/WorkList.tsx:200 - the history panel fetches `/api/monday/item-
  history?board=...&item=...` on open, so every row click currently costs a live Monday API
  call
- src/lib/monday/worklist/data.ts:182-188 - `itemUrl` builds
  `https://{slug}.monday.com/boards/{board}/pulses/{item}`, returning null when
  `app_settings.monday_account_slug` is unset (data.ts:165-167) and resolving a subitem to
  its PARENT item and board
- src/components/monday/WorkList.tsx:355-360 - the row is a plain `<div>` with `cursor-
  pointer`, no `role`, no `tabIndex`, no `href`: not keyboard reachable and not middle-
  clickable/cmd-clickable today

**Draft reply, written before verification:**

> **DO NOT SEND.** Says the Monday link is there and only needs a sideways scroll. For every non-admin that column is a dash (see A1).

Good catch, and you are right that it works the other way round today. Clicking anywhere on
a row opens the history drawer. There is already a link straight to Monday, the little eye
in the far-right "Monday" column, but that column is at the end of a wide table so on most
screens you have to scroll sideways to find it, which is exactly why it feels like the
option is missing. We agree the priority is backwards and we will swap it: the row itself
will open the Monday item in a new tab, and the history will move to its own small button on
the row. Two things to expect when we do: subitems open their parent item in Monday (a
subitem board has no page of its own), and any row where we cannot build a Monday link will
keep opening the history instead of doing nothing.

**Work needed:**

Invert the two actions in src/components/monday/WorkList.tsx. (1) Turn the row into a real
link to `r.url` (an `<a target="_blank" rel="noopener noreferrer">` wrapping the grid, or an
anchor overlay), replacing the `onClick={() => onPick(r)}` at :359, so it is also keyboard
focusable and cmd/middle-clickable, which the current div is not. (2) Keep `onPick`, but
move it to a small dedicated control on the row (a clock/history icon next to the eye at
:395) with `e.stopPropagation()` and `e.preventDefault()`, mirroring what OpenInMonday does
at :112. (3) Retire or repurpose the now-redundant eye column at :395 and the "Monday"
header at :352 so the row does not carry two identical links. (4) Fall back to opening the
history when `r.url` is null (no `monday_account_slug`, or a subitem with no parent board:
src/lib/monday/worklist/data.ts:183-186), otherwise those rows lose their click entirely.
(5) Update the stale row comment at WorkList.tsx:110-111 ("The row opens the history; this
opens Monday"). (6) Same treatment in the design catalogue preview that renders these rows,
and a check that the report tab's copies of the row are untouched.

## J2. my-work-700-tasks-none-are-priorities

**From:** Jeannette Owens (email, 31 Aug 2026)

**What they wrote:**

> I have 700+ tasks showing, most which aren't actually active or relevant. And none of
> them are actually my priority tasks right now.

**Verdict:** portal-gap, upheld; effort medium, impact high

My Work is working exactly as written: it shows every step ever assigned to you that Monday
has not flagged as finished, with no way for you to narrow it and no notion of what matters
to you today, so a long backlog is the expected result rather than a fault.

**Evidence:**

- src/app/(app)/my-work/page.tsx:98 and src/lib/monday/worklist/filters.ts:29 - with no
  person in the URL the list defaults to the signed-in person, so the 700+ really is one
  person's own rows, not everyone's
- src/lib/monday/worklist/data.ts:242-246 - the only age filter in the read path applies to
  FINISHED work; any row whose status_done is null or false is returned no matter how old it
  is
- src/lib/monday/worklist/data.ts:318 - open is defined as 'not exactly true', so a row with
  no status at all counts as open work forever
- src/lib/monday/worklist/ingest.ts:215 - status_done is null whenever the step has no
  status column paired to it, or the status cell is empty
- src/lib/monday/worklist/steps.ts:97-115 and src/lib/monday/worklist/discover.ts:267-276 -
  EVERY people column on every active board is turned into a step automatically with source
  'guess'
- src/lib/monday/worklist/ingest.ts:160 - guessed steps are ingested as real work; only a
  step an admin explicitly sets to 'off' is excluded, so people columns like 'Client' or
  'Account Manager' produce permanently open rows
- src/components/monday/WorkList.tsx:558-632 - the complete set of controls on the page:
  free-text search, Mine/Everyone, person, team, and a finished-work window toggle. There is
  no status, board, workspace, group, due-date or age filter
- src/components/monday/WorkList.tsx:342-353 - the twelve column headers are plain divs with
  no onClick and no sort state, so nothing on the table can be re-sorted by the reader
- src/lib/monday/worklist/data.ts:59 and :302 - the Monday group name is stored on every row
  and never rendered or filtered, so groups like 'Archive' or '2019' cannot be excluded
- supabase/migrations/070_monday_board_priority.sql:11-13 and :22 - Priority is a single
  value set per BOARD by an admin, defaulting to 'medium'
- src/lib/monday/worklist/data.ts:82-83 and :313 - every row inherits its board's priority;
  there is no per-item and no per-person priority anywhere
- src/components/monday/WorkList.tsx:546-552 - the On-going block is sorted by that board-
  level priority, then by due date, which is the only ranking the page has
- src/app/(app)/settings/monday/actions.ts:29, :57, :79, :96, :133 - the only levers that
  shrink the list (hide a board, set board priority, hide an account, switch a step off,
  auto-hide stale boards) are all admin-only and board-grained
- supabase/migrations/074_monday_auto_hide_stale.sql:42-43 - the rule that hides boards with
  no activity in six months ships switched OFF by default
- src/lib/monday/worklist/ingest.ts:14-17 - whether a label such as 'Not Relevant' or 'No
  edits needed' closes a row is decided by each Monday board's own done_colors setting, and
  the code deliberately offers no in-portal override

**Draft reply, written before verification:**

You are right on both counts, and neither is you missing a setting. My Work shows every step
ever assigned to you that Monday has not marked as finished. There is no cutoff on age, so a
step from 2019 that nobody ever closed sits next to today's work, and the only ways to
narrow the list are the search box, the person and team pickers, and the finished-work
toggle. There is no filter by status, board, workspace, group or due date, and no way to
sort the columns. Two things inflate the count in particular. First, a step counts as open
unless the label on it is one Monday itself paints as done, so labels like "Not Relevant" or
"No edits needed" stay on your list forever unless that board marks them as done labels.
Second, the portal automatically turns every people column on every board into a step, so
columns that are not really stages of work (an owner, an account manager, a requester)
generate rows that can never be completed. On priorities: the "Priority" chip you see is set
per board by an admin, not per task, so it can never mean "this is what I should do today".
There is nothing personal in the page at all: no pin, no star, no today view. Two things we
can do right away that shrink the list for everyone: switch on the rule that hides boards
with no Monday activity in six months, and go through the step review queue to switch off
the people columns that are not real stages. Beyond that this is a real gap and we should
build it: filters for status, board and due window, an "active" default that opens on the
near term with a click to show everything, sortable columns, and a way for you to pin your
own handful of tasks to the top. Tell me if that pin, plus an overdue and next-seven-days
view, would be the version you would actually open every morning.

**Work needed:**

1) Filters on My Work over the rows already loaded: status label (include/exclude), board
and workspace, Monday group (group_title is already stored at
src/lib/monday/worklist/data.ts:302 and never used), due window (overdue, next 7, next 30,
no date) and last-touched age. 2) An "active" default view that opens narrow (dated within
the horizon or item touched recently) with a one-click widener to everything, mirroring the
existing finished-work toggle at src/components/monday/WorkList.tsx:624-632. 3) Sortable
column headers on the twelve-column grid (src/components/monday/WorkList.tsx:342-353), which
today are inert divs. 4) A personal priority: per-user pinning of a small number of rows,
stored per user, sorted above everything, with the board-level priority kept only as a
tiebreaker. 5) Surface and act on the two admin levers that shrink every person's list at
once: switch on monday_hide_stale_boards (currently defaulting off,
supabase/migrations/074_monday_auto_hide_stale.sql:42-43) and work the step review queue so
non-workflow people columns are set to 'off' (src/app/(app)/settings/monday/actions.ts:96).
6) Optional but high value: a per-board override declaring which status labels count as
finished, so labels like "Not Relevant" stop reading as open work. Today the code
deliberately refuses this (src/lib/monday/worklist/ingest.ts:14-17), which leaves a badly
configured board with no in-portal remedy.

## J3. my-work-aaaf-onpage-seo-skip

**From:** Jeannette Owens (email, 31 Aug 2026)

**What they wrote:**

> I know you said you were making filters on the back end of the app to clean up the
> results, but it is the monday boards themselves that need to be cleaned up. Like non-
> english AAAF pages on the publishing board are supposed to skip On-page SEO. Something
> is broken in the automation.

**Verdict:** monday-data, upheld; effort none, impact medium

They are right: the Monday automation that should skip On-page SEO for non-English AAAF
pages has only fired on about a third of them, and the portal is faithfully showing what the
board holds.

**Evidence:**

- src/lib/monday/worklist/ingest.ts:215 - status_done is derived only from the label index
  appearing in Monday's own done_colors, so what closes a step is decided by the board
  config, not by us
- src/lib/monday/worklist/ingest.ts:14-17 - the comment states this was a deliberate refusal
  to keep a portal-side list of done labels
- src/lib/monday/worklist/ingest.ts:206-207 - `if (!ids.length) continue`, no assignee means
  no assignment row is written at all, which is why blank On-page SEO cells never surface as
  work
- src/lib/monday/worklist/data.ts:245 - the open filter is
  `status_done.is.null,status_done.eq.false,item_updated_at.gte.<6mo>`
- src/lib/monday/worklist/data.ts:318 - `if (row.statusDone !== true) open++`, open means
  not exactly true
- src/lib/monday/client.ts:87-110 - setStatusLabel is the only function in the repo that
  writes to Monday
- src/lib/monday/handlers.ts:185 - its single caller, and it only ever writes the Href Links
  column for the hreflang flow, never status29
- src/app/(app)/projects/page.tsx:247 - the portal's own documentation records that the
  automations on these boards run on Monday's side, not ours
- supabase/migrations/002_monday_webhook.sql:33-44 - AAAF board 462251934, language column
  color_mkqr7s1t
- LIVE DB monday_board_steps board_id=462251934 - the step exists as step_name 'On-Page
  SEO', people_col people30 ('SEO 1'), status_col status29
- LIVE MONDAY board 462251934, 999 items, language color_mkqr7s1t x status29 - non-English
  (PT 172, ES 169, SW 176, FR 1 = 518 items): only 191 'Not Relevant', 204 'Done', 106
  blank, 17 'Stuck'; and 95 English items wrongly sit on 'Not Relevant'
- LIVE DB monday_assignments board_id=462251934 people_col=people30 - 637 rows: 608 'Done'
  done=true, 12 'Not Relevant' done=true, 17 'Stuck' done=false, confirming 'Not Relevant'
  IS in status29's done_colors and already closes the row
- LIVE MONDAY cross-check - 0 items have a blank On-page SEO status with someone assigned,
  110 are blank with nobody assigned, so the portal surfaces no phantom open work from the
  blanks
- src/lib/boards/translation.ts:385 and :410 - publishing boards never run the stage
  pipeline, so the older AAAF-P stage list at src/lib/boards/config.ts:132-138 is inert and
  is not a cause here

**Draft reply, written before verification:**

You are right, and the board data backs you up. I pulled the AAAF Publishing board directly.
Of the 518 non-English pages (Portuguese, Spanish, Swahili and one French), only 191 have
On-page SEO set to "Not Relevant". The skip did not happen on the rest: 204 are marked
"Done", 106 are still blank, and 17 are "Stuck". It is going wrong in the other direction
too, 95 English pages are sitting on "Not Relevant", and English pages are the ones that are
supposed to get On-page SEO.  There is nothing for us to fix in the portal. When a page says
"Not Relevant" we already treat that step as finished and it drops off My Work, because that
label is configured as a finished label on the board itself. I checked all 12 of those in
our data and every one is closed. The blank ones never appear either, because nobody is
assigned to them. The only On-page SEO work My Work is showing right now is those 17 Stuck
pages, and those genuinely are stuck.  So the cleanup is on the board, as you said: get the
automation firing again, then fix the 204 non-English pages sitting on "Done" and the 95
English ones sitting on "Not Relevant". The 95 English ones are the ones I would look at
first, since if the On-page SEO work really was skipped on those, that has an effect on the
live site.  Happy to send the item lists for any of those groups if that helps the cleanup.

**Work needed:**

Nothing in the portal for the reported problem. The portal already handles the skip
correctly: "Not Relevant" is in status29's done_colors on the board, so ingest.ts:215 sets
status_done=true and the row closes. The fix is entirely in the Monday automation and in the
board data behind it. Optional and not requested: if the team wants the portal to catch this
class of automation drift in future, that would be a new small report (a per-board check for
items whose skip label disagrees with their language), but nothing today is broken in our
code.

## J4. my-work-old-boards-unrecognised-done-statuses

**From:** Jeannette Owens (email, 31 Aug 2026)

**What they wrote:**

> Old boards or old tasks with status types not recognized as "done" are showing up. Some
> of these old unused boards and old tasks probably could be archived.

**Verdict:** portal-gap, overturned (the first verdict was monday-data); effort small, impact medium

My Work treats a task as finished only when the Monday board itself marks that label as a
done label, and the switch that hides boards quiet for six months is off by default, so both
kinds of old work keep showing up until the boards are fixed or the switch is turned on.

**Evidence:**

- src/lib/monday/worklist/ingest.ts:215 (done = st.status_col && index != null ?
  cfg?.done.has(index) ?? false : null, the only place doneness is decided)
- src/lib/monday/worklist/ingest.ts:59-75 (statusSettings reads done_colors from the board's
  own status column; unparseable settings fall back to an empty done set, making every label
  read open)
- src/lib/monday/worklist/ingest.ts:14-17 (comment: the portal deliberately refuses to keep
  its own list of which labels mean done)
- src/lib/monday/worklist/data.ts:318 (if (row.statusDone !== true) open++, so null counts
  as open)
- src/lib/monday/worklist/data.ts:242-246 (the six-month window applies only when a row is
  finished; an open row has no age limit at all)
- src/app/(app)/my-work/page.tsx:38 (search params are only tab, person, team, done: no age
  or date filter exists in the UI)
- src/lib/monday/worklist/steps.ts:111 (a people column with no free status column beside it
  gets statusCol: null, so its rows can never read as done)
- supabase/migrations/074_monday_auto_hide_stale.sql:42-43
  (app_settings.monday_hide_stale_boards defaults to false, and no migration or code turns
  it on)
- src/lib/monday/worklist/stale.ts:9 and :49-56 (the six-month follow-activity rule that
  hides quiet boards and brings them back)
- src/components/monday/StaleRuleToggle.tsx:19-38 and :74-79 (the admin switch, with a live
  preview of how many boards it would hide)
- src/components/monday/WorklistSources.tsx:218 (per-board Shown / Not shown toggle in
  Settings)
- src/app/(app)/settings/monday/actions.ts:29-36 (setBoardIncluded, which also pins the
  board so the automatic rule stops deciding for it)
- src/app/(app)/settings/monday/actions.ts:96-108 (setStepSource 'off', the only in-portal
  way to silence a step whose status column cannot say done)
- src/lib/monday/worklist/ingest.ts:253-258 (delete-then-insert per board, so anything
  Monday stops returning, including archived items, disappears from our copy at the next
  sync)
- src/lib/monday/worklist/ingest.ts:299 vs src/lib/monday/worklist/stale.ts:55 (the ingest
  queue is filtered to included boards, so a board the rule hides never refreshes its
  activity stamp and the bring-it-back half can never fire)

**Why the first verdict was overturned:**

- The mechanics cited are accurate, but the label is wrong on both halves of the feedback.
  1) Old boards were never a Monday-data problem. src/lib/monday/worklist/data.ts:234-239
  excludes not-included boards inside the query, so flipping a board to Not shown in
  Settings (WorklistSources.tsx:218 -> settings/monday/actions.ts:29-36) removes its rows at
  once, and the Settings list already prints assignment counts plus "last used" with a stale
  highlight, so the dead boards list themselves. Board visibility is decided entirely in
  portal code; nothing has to change in Monday for that half.  2) The remedy the verdict
  leans on is defective, and their own evidence proves it. I grepped every writer of
  last_activity_at across src and supabase: ingest.ts:267 is the only one, and ingestSlice
  queues .eq('included', true) at ingest.ts:299. A board the rule hides therefore freezes
  its stamp at a value already past the cutoff, isStale stays true (stale.ts:37-39), and
  staleSweep's show branch (stale.ts:55) can never fire for it. Turning the switch on is a
  one-way door across 262 boards while the switch's own label promises "bring them back when
  used" (StaleRuleToggle.tsx:64). Prescribing that switch as the answer is recommending a
  broken feature, not classifying the report.  3) The old-tasks half has no portal answer at
  any granularity below deleting the step for everyone. Doneness is read only from the
  board's done_colors (ingest.ts:59-75, 215), the portal refuses by design to keep its own
  map (ingest.ts:14-17), nothing in src ever renders done_colors so no screen shows which
  boards or steps never report done, and there is no age filter on open work:
  data.ts:242-246 passes every row with status_done null or false regardless of age, and the
  six-month window touches finished rows only. A step whose people column has no status
  column beside it (steps.ts seedSteps, via 'none', statusCol null) reads null forever and
  cannot be marked done from Monday at all; the only in-portal lever is setStepSource 'off'
  (actions.ts:96-108), which wipes that column's work from everybody's list.  Archiving in
  Monday does clear the copy (delete-then-insert per board, ingest.ts:253-258), so part of
  the cleanup genuinely sits on the Monday side. But what the team is reporting is that the
  portal gives them no way to say "this label means done" or "stop showing open work nobody
  has touched in years", and the one board-level lever that exists is off by default with
  its return path broken. That is a missing feature, so portal-gap, with the one-way stale
  rule (ingest.ts:299 vs stale.ts:55) worth filing separately as a portal-bug.

- The "old boards can be archived" half is fair (ingest.ts:253-258 delete-then-insert plus
  discover.ts allBoards filtering state === 'active' means Monday archiving really does
  clear rows), but the classification fails on the half the reporter actually led with, and
  its own remedy is defective.  (1) The switch it leans on is broken in the direction its
  label advertises. ingestSlice filters the queue to .eq('included', true) (ingest.ts:299)
  and last_activity_at is written only inside that loop (ingest.ts:267), so a board the rule
  hides freezes its stamp at a value already older than the cutoff and staleSweep's show
  half (stale.ts:55, !b.included && !isStale(b)) can never contain it.
  StaleRuleToggle.tsx:69 nonetheless reads "hide boards quiet for 6 months, bring them back
  when used" and prints "would hide N and bring back M". Recommending that switch recommends
  a one-way door with a lying label. The classifier cited this defect as supporting
  evidence.  (2) A whole class of rows can never read as done no matter what anyone does in
  Monday. steps.ts:111 gives statusCol: null when no free status column sits beside a people
  column (via: 'none'); ingest.ts:215 then writes status_done = null; data.ts:318 counts
  null as open, and data.ts:242-246 applies the 6-month window only to finished rows, so
  those rows have no age limit ever. The only step controls that exist are confirm / off /
  back-to-guess (StepReview.tsx:110-132 to actions.ts:96) - there is no re-pair control and
  no done-label override anywhere (no override column or UI in src or supabase). The
  portal's offer is "wrong forever" or "deleted from everyone's list".  (3) The Monday-side
  fix is gated by portal state. syncMondayBoards re-seeds only steps whose source is still
  'guess' (discover.ts, the `reviewed` set), so a step confirmed while unpaired keeps
  status_col = null permanently even after that board's columns are fixed in Monday.  (4) No
  normal user can act. my-work/page.tsx:38 carries only tab/person/team/done, the one
  visible filter only widens finished work (WorkList.tsx:626-631), and every remedy named is
  behind isSecurityAdmin or lives in Monday.  Calling this monday-data says no portal work
  is needed. Both routes to fixing the doneness complaint run through portal work: a way to
  declare a label or step finished, or to re-pair a status column. Gap, with a separate
  confirmed bug in the stale rule's bring-back half.

- Refuted. "monday-data" only covers the second half of the feedback (archiving unused
  boards is genuinely a Monday action, and ingest.ts:253-258 does clear archived items). The
  main complaint, statuses not recognized as done, is largely manufactured by the portal
  itself, and the remedies cited are either unreachable or broken.  1. A whole class of
  forever-open rows has no Monday-side cause and no portal-side fix. steps.ts:111 gives a
  people column `statusCol: null` when nothing state-like sits beside it or the nearest
  status was already claimed by another owner. ingest.ts:215 then writes `status_done =
  null`, data.ts:318 counts null as open, and WorkList.tsx:546 puts it in the block
  literally labelled "On-going / Steps still open". The item can be marked Done in Monday on
  a status column the portal never paired, and the row still asserts it is open. Nothing an
  admin does in Monday changes that. And the portal cannot be corrected either:
  `monday_board_steps.status_col` is written in exactly one place, discover.ts:273 (the
  automatic guess). There is no server action and no UI to re-point a step at the right
  status column. StepReview.tsx:110 and :114 offer exactly two buttons, confirmed and off,
  so the only choice is "wrong forever" or "delete this work from everyone's list". That is
  a portal gap, not Monday data.  2. Two more open-by-default paths are portal fallbacks,
  not board configuration. statusSettings (ingest.ts:59-75) returns an empty done set on any
  unparseable or missing settings_str, making every label on that board read open, and
  ingest.ts:215's `cfg?.done.has(index) ?? false` also yields false when the status column
  is missing from the columns response (renamed or deleted between discovery and ingest). In
  both cases Monday is fine and the portal invents "not done".  3. The recommended remedy is
  a one-way door, which the classifier's own evidence notes and then discounts.
  `last_activity_at` is written in exactly one place, ingest.ts:267, inside ingestBoard, and
  ingestSlice queries `.eq('included', true)` at ingest.ts:299. So a board the rule hides is
  never ingested again, its stamp freezes and only ages, and staleSweep's `show` half
  (stale.ts:52-56) can never fire. The toggle's own label promises "bring them back when
  used" (StaleRuleToggle.tsx:74-76) and the code cannot deliver it. That is a confirmed
  portal bug sitting inside the answer being handed back to the team.  4. Reachability fails
  the user-reality test. Every action in settings/monday/actions.ts is behind
  `isSecurityAdmin()` (guard at :12-14), so the per-board Shown toggle, the step off switch
  and the stale rule are all admin-only. The person who filed this has, on My Work, a search
  box, person and team filters, and one "Finished work: 6 months / all of it" toggle
  (WorkList.tsx:626-631). No board filter, no age filter, no per-row dismiss. Filing this
  feedback was their only available action, which is the signature of a gap rather than of
  data somebody else should go clean up.  Correct label: portal-gap (the portal has no way
  to say which labels mean done and no way to repair a step whose status column was never
  paired), with a confirmed portal-bug in the stale rule's return half.

**Draft reply, written before verification:**

> **DO NOT SEND.** Recommends switching on the stale-board rule. Its return path cannot fire: a hidden board never comes back.

You are right that they show up, and most of it can be fixed today without any new code.
Old boards: Settings already has a per-board Shown / Not shown switch, and above it a switch
that hides any board with no Monday activity for six months and brings it back when someone
uses it again. That second switch is off by default, which is why the quiet boards are still
on your list. An admin can turn it on, and before clicking it tells you how many boards it
would hide.  Old tasks that never look done: the portal does not keep its own list of what
counts as done. It reads each board's own status column and treats a label as finished only
if that board marks it as a done label in Monday (the green ones). So a label like "No edits
needed" or "Not relevant" counts as open work forever until somebody marks it as a done
label on that board. Fix it there and it clears everywhere at the next sync, including for
old items.  Archiving works too. Anything Monday stops handing us gets removed from our copy
at the next sync, so archiving the old items or the old boards does clear them from My Work.
One case Monday cannot fix: when a person column on a board has no status column next to it,
there is nothing for us to read a finished state from, so those rows sit under On-going
forever. An admin can switch that step off in Settings, or we can build a way to fold away
open work that has not moved in years. Right now the six-month cutoff only applies to
finished work, never to open work.

**Work needed:**

Nothing is strictly required to clear the reported symptom: an admin turns on the follow-
activity switch in Settings (already built, src/components/monday/StaleRuleToggle.tsx), the
board owners mark those labels as done labels in Monday, and archiving in Monday already
propagates (ingest.ts:253-258). Three pieces of real work remain. (1) Fix the bring-it-back
half of the auto-hide rule before we recommend the switch: a board the rule hides is dropped
from the ingest queue (ingest.ts:299), so its last_activity_at can never refresh and
stale.ts:55 can never fire for it. (2) Add an age cutoff for OPEN rows, or at least a fold,
since data.ts:242-246 ages out only finished work and an untouched 2017 item stays on the
list forever. (3) Surface the rows whose step has no paired status column (steps.ts:111,
ingest.ts:215) as a reviewable bucket in Settings, because no Monday change can ever close
them and today the only remedy is switching the whole step off, which also removes live
work.

## J5. my-work-all-boards-one-place-workload-balancing

**From:** Jeannette Owens (email, 31 Aug 2026)

**What they wrote:**

> I think the biggest win here is it can show all of someone's tasks across all of the
> boards in one place. Potentially very handy for balancing team member workloads.

**Verdict:** portal-gap, overturned (the first verdict was already-exists); effort small, impact low

They are right that My Work already puts one person's tasks from every board in a single
list, and the workload balancing they imagine is also already built as the Workload tab of
the Report, which only level 3 people can see.

**Evidence:**

- src/app/(app)/my-work/page.tsx:1 header states the page is "everything assigned to the
  signed-in person across Monday"
- src/lib/monday/worklist/data.ts:239 the query spans every included board at once:
  out.in('board_id', includedBoards)
- src/lib/monday/worklist/data.ts:241 and one person is a filter on top of that:
  out.in('monday_user_id', onlyAccounts)
- src/lib/monday/worklist/data.ts:137-142 accountsFor() folds all of a person's Monday
  accounts into that filter via monday_user_links
- src/lib/monday/worklist/data.ts:260 the 5,000 row cap is lifted once a person or a team is
  picked, so one person's list is complete, not a sample
- src/components/monday/WorkList.tsx:564-565 the Mine / Everyone switch, and
  WorkList.tsx:610 and :618 the Person and Team dropdowns
- src/components/monday/WorkList.tsx:344-345 Board and Workspace are columns on a flat
  cross-board table, not levels of a tree (design note at
  src/lib/monday/worklist/data.ts:97-100)
- src/app/(app)/my-work/page.tsx:101-103 the page loads the worklist with personId/teamId
  and passes every active person and team as options
- src/components/report/ReportTabs.tsx:21 the Workload tab exists with minLevel: 3
- src/app/(app)/report/page.tsx:40 READY includes 'workload', and page.tsx:142-173 renders
  the real tab
- src/lib/report/workload-data.ts:43-138 loadWorkload reads live tc_entries hours, open
  steps due in the next 30 days, and the assignment change log: it is not a mock
- src/lib/report/workload.ts:19-49 the columns are Utilisation, Load (30 days), Backlog (8
  weeks); workload.ts:113-119 turns them into an overloaded / waiting / at-capacity / spare
  / steady verdict
- src/app/(app)/report/page.tsx:44 the searchParams type omits 'person' and page.tsx:70-72
  builds the loader filters from scope and team only, while
  src/components/report/WorkloadFilters.tsx:59 writes ?person=, so the person dropdown on
  Workload changes nothing
- src/lib/monday/worklist/data.ts:234 and :286 only boards marked included, and only people
  columns not switched off, reach the list, so "all boards" means all boards we have
  switched on

**Why the first verdict was overturned:**

- Half right, and the wrong half is the load-bearing one. The cross-board single-person list
  genuinely exists and is genuinely reachable: `my-work` defaults ON for every role
  (src/lib/access/surfaces.ts:61-66), boards default `included`
  (supabase/migrations/064_monday_worklist.sql:63), the query spans all included boards
  (src/lib/monday/worklist/data.ts:239), the 5,000 cap lifts on a person or team filter
  (data.ts:260, `cap = onlyAccounts ? POSITIVE_INFINITY : UNFILTERED_CAP`), and the
  Mine/Everyone switch plus both dropdowns render for any user, not just admins
  (src/components/monday/WorkList.tsx:559-620). That part of the verdict I could not break.
  But the workload-balancing half is called "already built" when it is not built for anyone
  who would use it. `directoryLevel()` returns 3 only on `dir-full` (surfaces.ts:211-215),
  and `dir-full` defaults to PRIV = { admin_assistant: true, team_leader: false, user: false
  } (surfaces.ts:126-132), with no migration seeding it otherwise
  (073_split_my_work_surfaces.sql touches only the My Work split). So the Workload tab is
  admin and admin-assistant only by default: the team leader, the exact role that balances
  team member workloads, cannot see it. And the tab that does exist is half-wired:
  report/page.tsx:44 omits `person` from searchParams and :70-72 builds filters from scope
  and team only, while WorkloadFilters.tsx:59 writes ?person= and
  src/lib/report/filters.ts:32 also deletes `scope`, so picking a person silently falls back
  to everyone; `effectiveScope()`, written so the scope switch would stop lying in that
  case, is imported nowhere in src/ outside its own test, even though loadWorkload accepts
  personId (workload-data.ts:45). Finally, My Work itself cannot compare people at all: a
  row is a step, `who` is one column (WorkList.tsx:375), and there is no per-person count or
  side-by-side, so balancing there means flipping the dropdown person by person and reading
  the "N open" figure. The feedback's stated win exists; the use they project onto it does
  not reach them. That is a gap, not an already-exists.

- Half the classification holds and half of it points at a broken screen. The praised
  capability is real and reachable by a normal user: my-work defaults ON for every
  configurable role (src/lib/access/surfaces.ts), no directory-level clamp exists anywhere
  in the My Work path, WorkList.tsx shows Everyone plus the Person and Team dropdowns to
  anyone who can open the page, and picking a person lifts the 5,000 row cap so the list is
  complete. One caveat the reviewer understated: switched-off boards are never even ingested
  (src/lib/monday/worklist/ingest.ts:297-299 .eq('included', true)) and migration 074 can
  auto-hide any board quiet for six months, so "all boards" is "the boards we still sync",
  refreshed six times a day. What fails is the reviewer's answer to the workload half. They
  cite the Workload tab as the built version, then their own evidence names its dead person
  filter, and it is worse than dead: WorkloadFilters.tsx:59 writes ?person=,
  src/lib/report/filters.ts:35 deletes scope whenever a filter is set, so
  resolveScope(undefined, 3) returns 'team' and report/page.tsx:70-72 builds
  filters={teamId:null}. loadWorkload then calls activePeople(supabase, {}) and returns
  every active person while the Person select renders the chosen name in its active state
  and the note at page.tsx:162 says "N people in scope". The control says one person, the
  table shows everyone, and nothing admits it. It is not one missing line: ReportState
  carries person and reportHref writes it, but page.tsx:63 builds state without it, so
  ReportControls and every tab link strip the parameter on the next click. Both loaders
  already accept personId (directory.ts:20, data.ts:85), so this is unfinished wiring, not
  design. Filing the item as already-exists routes it to no action, buries a live defect in
  the exact feature named as the fulfilment, and invites telling the team member "we already
  have that" while pointing them at a screen that answers the wrong question. I do not count
  the level 3 gate against the verdict: surfaces.ts documents it as deliberate policy and
  the reviewer disclosed it. Worth passing on separately: My Work itself has no per-person
  subtotal or sort by assignee, so balancing there means switching the Person dropdown one
  name at a time and reading the "N open" count.

**Draft reply, written before verification:**

> **DO NOT SEND.** Says "ask us and we will check your access". Team leaders cannot open the Report at all by configuration, so it is not an individual access problem.

You are right, and that is exactly what the page was built for. My Work pulls one person's
steps from every Monday board we have switched on into a single list, and when you pick a
person or a team the row limit comes off, so you are seeing all of theirs and not just the
first few thousand. Use the Everyone switch and then the Person or Team dropdown to do it.
On workload balancing: that already exists too. The Report has a Workload tab that shows,
per person, hours logged against contracted hours, estimated hours of work due in the next
30 days, whether work is arriving faster than it is finishing over the last 8 weeks, and a
plain reading of what the three together mean (overloaded, waiting, at capacity, spare,
steady). It is limited to level 3 directory access, which is probably why it looked like
potential rather than something already there. If you should have it, ask us and we will
check your access. One small thing we know about: the person dropdown on that Workload tab
currently does nothing, the table always lists everyone in scope. The team dropdown works.
We will fix the person one.

**Work needed:**

Nothing for the capability they described: the cross-board per-person list and the workload
balancing view both ship today. Two optional follow-ups surfaced while checking. One, fix
the dead person filter on the Report Workload tab: add 'person' to the searchParams type at
src/app/(app)/report/page.tsx:44 and thread it into the filters at page.tsx:70-72 and into
ReportState at page.tsx:61, since src/lib/report/scope.ts already supports it and
src/components/report/WorkloadFilters.tsx:59 already writes it. Two, decide whether the
Workload tab should stay level 3 only (src/components/report/ReportTabs.tsx:21), or whether
team leads should get it, since balancing loads is a lead's job.

## A1. my-work-monday-link

**From:** Second reviewer, probably Stephanie Aguirre ("Item 1 - Portal" and "Item 4 - Portal")

**What they wrote:**

> There is no Monday link on the far right of each item

**Verdict:** portal-bug, overturned (the first verdict was already-exists); effort small, impact low

Every row on My Work already ends with a "Monday" column holding an eye button that opens
that item in Monday, so the link is there, but it can slide out of view on a narrow window
and it turns into a dash if the portal has not stored the Monday account name.

**Evidence:**

- src/components/monday/WorkList.tsx:353 - the twelfth and last column header is literally
  `Monday`, right-aligned
- src/components/monday/WorkList.tsx:395 - the last cell of every row renders `{r.url ?
  <OpenInMonday href={r.url} label={r.itemName} /> : <span
  className="text-[var(--faint)]">-</span>}`
- src/components/monday/WorkList.tsx:97-132 - `OpenInMonday` is a real anchor:
  `target="_blank"`, `rel="noopener noreferrer"`, `aria-label={`Open ${label} in Monday`}`,
  an eye icon in a tinted square, plus an "Open in Monday" tooltip on hover
- src/components/monday/WorkList.tsx:112 - `onClick={e => e.stopPropagation()}` so clicking
  the eye opens Monday instead of the row's history drawer
- src/components/monday/WorkList.tsx:64 - `const GRID = '13% 9% 8% 7% 10% 6% 8% 9% 8% 6% 9%
  7%'`, twelve columns summing to exactly 100%, the Monday column last at 7%
- src/components/monday/WorkList.tsx:336-337 - the table lives in `overflow-x-auto` around a
  `min-w-[1180px]` block, so below about 1292px of browser width the rightmost column is the
  first thing pushed off screen, and nothing pins it
- src/components/Sidebar.tsx:241 - sidebar is `w-16` (64px)
- src/components/MainContent.tsx:40 - page padding is `px-6` (24px each side), which is
  where the ~1292px threshold comes from
- src/lib/monday/worklist/data.ts:182-188 - `itemUrl` returns null when there is no account
  slug, and a subitem deliberately links to its parent item on the parent board
- src/lib/monday/worklist/data.ts:165-167 - the slug is read from
  `app_settings.monday_account_slug`; if that is empty, every row's link is null and the
  whole column shows dashes
- src/lib/monday/worklist/discover.ts:206 - the slug is only ever written by the Monday
  sync, at the first hop of a run
- src/components/monday/WorkList.tsx:230-241 - a second Monday link sits in the top-right
  corner of the history drawer that opens when you click a row
- src/components/MyWork.tsx:169 - the old sample screen has a hover style but no click
  target and no Monday link anywhere; it is dead code, and the live page does not use it
- src/app/(app)/my-work/page.tsx:108 - the live page renders `WorkList`, not that old sample
  screen

**Why the first verdict was overturned:**

- The markup claims all check out (12 columns, `Monday` last, `OpenInMonday` is a real
  anchor), but the link is dead for every non-admin, which is who "team feedback" is. The
  link's existence depends entirely on a value that RLS forbids ordinary users from reading.
  The chain, verified end to end: 1. `src/app/(app)/my-work/page.tsx:87` builds the Supabase
  client with `createClient()` from `src/lib/supabase/server.ts`, which is
  `createServerClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {cookies})`:
  the signed-in user's own session, not the service role. Line 101 hands that client to
  `loadWorklist`. 2. `src/lib/monday/worklist/data.ts:166` reads the slug with that same
  user client: `.from('app_settings').select('monday_account_slug').eq('singleton_id',
  1).maybeSingle()`. 3. `supabase/migrations/052_app_settings_admin_only.sql` drops every
  pre-existing policy on `app_settings` and creates exactly two, both
  `is_admin(auth.uid())`. Its own comment is explicit: "No read policy for plain
  authenticated users on purpose." Migration 068, which added `monday_account_slug` to that
  table, came after 052 and added no read policy. I grepped every migration through 080:
  nothing re-opens it. 4. `supabase/migrations/007_profiles_and_roles.sql:19` defaults
  `profiles.role` to `'viewer'`, and line 36 defines `is_admin` as `role = 'admin'`. So for
  a normal team member the SELECT is filtered to zero rows, `maybeSingle()` returns null
  with no error, and line 167 yields `slug = null`. 5. `data.ts:183` `if (!slug) return
  null`, so `r.url` is null on every single row, and `WorkList.tsx:395` renders the grey
  dash for all of them.  So the column is not "a link that sometimes slides out of view or
  occasionally dashes when the sync has not run". For anyone who is not `profiles.role =
  'admin'`, the entire column is dashes on every row, permanently, even with the slug
  correctly stored by the sync. Meanwhile `supabase/migrations/064_monday_worklist.sql:141`
  gives every authenticated user `USING (true)` on the `monday_*` tables, so the rows
  themselves render fine. Only the link dies. That is precisely "there is no Monday link on
  the far right of each item."  Two things in the evidence become arguments against the
  verdict once this is known: - The drawer fallback at `WorkList.tsx:230` is gated on the
  same `row.url`, so it is not rendered at all for those users. Both Monday links vanish
  together, not one. - `src/lib/monday/worklist/data.test.ts:87` hardcodes `app_settings: [{
  monday_account_slug: 'truenorth' }]` in the fake client, so no test ever exercises the
  null-slug path, and `src/app/design-check/my-work/page.tsx:36` hardcodes a URL, so the
  design check always shows the eye.  Why the classifier saw a working link: they are an
  admin, and per the View Stage note in this project, stepping down a level swaps the
  rendered access level but never the database identity, so an admin previewing as a viewer
  still passes `is_admin(auth.uid())` and still sees the eye. The bug is invisible from
  exactly the seat that classified it.  Fix is small and matches the project's own rule that
  a shared lookup must not be decided by RLS: read the slug with the privileged client (the
  way `src/app/(app)/settings/page.tsx:153` uses `createAdminClient()`), or move it out of
  the secrets table. The horizontal-overflow point at `WorkList.tsx:336-337` is real but
  secondary; the column is empty before it is ever off screen.

- The column exists in code, but for almost every person on the team it renders a dash on
  every single row, which is exactly what they reported.  The link is built only from
  `app_settings.monday_account_slug` (src/lib/monday/worklist/data.ts:165-167; `itemUrl`
  returns null with no slug, :183-188). `loadWorklist` is handed the request-scoped, RLS-
  bound user client: src/app/(app)/my-work/page.tsx:90 `createClient()` from
  src/lib/supabase/server.ts (anon key + session cookies), passed at :101. Since
  supabase/migrations/052_app_settings_admin_only.sql the ONLY SELECT policy on
  `app_settings` is `USING (is_admin(auth.uid()))`, and `is_admin` is `profiles.role =
  'admin'` (007_profiles_and_roles.sql:33-38), i.e. security admins only. Migration
  068_monday_item_links.sql then added the slug to that admin-only table and nothing granted
  read access back. So a normal signed-in user gets zero rows, `.maybeSingle()` yields null,
  no error is raised, slug is null, and `r.url` is null for every row: WorkList.tsx:395
  paints a dash in all twelve-column rows, and the drawer's corner link at :230-241 is not
  rendered either (it is inside `{row.url && ...}`). The rest of the page still works
  because monday_* tables are readable by any authenticated user
  (064_monday_worklist.sql:135-146), so only this column breaks.  Two reasons this looked
  fine to the reviewer: View Stage swaps the level but not the database identity, so an
  admin previewing a lower tier still has `is_admin` true and still sees the eyes; and
  data.test.ts:87 hardcodes `app_settings: [{ monday_account_slug: 'truenorth' }]` in a fake
  client with no RLS, so tests can never catch it. The `my-work` surface defaults ON for
  everyone (surfaces.ts:59-65), so the affected audience is the whole team.  Fix: read the
  slug with the privileged/service client (the pattern 052 itself prescribes and
  lib/tsheets/status.ts:42 follows) and pass it into `loadWorklist`. Note
  src/lib/report/data.ts:186, workload-data.ts:53, waits.ts:34 and people.ts:71 call the
  same function with the same user client. Secondary, still real: the table is
  `min-w-[1180px]` inside `overflow-x-auto` (WorkList.tsx:336-337) behind a 64px rail plus
  px-6 padding, so below about 1292px the Monday column and its header sit off-screen behind
  macOS overlay scrollbars with no affordance, which compounds the same complaint.

- REFUTED. The classifier read the component and stopped there. Follow the Supabase client
  instead and the link provably does not exist for the people who filed the feedback.  The
  chain: 1. `src/app/(app)/my-work/page.tsx:87` builds the client with `createClient()`,
  which is `src/lib/supabase/server.ts` = the ANON key plus the user's cookies, so RLS
  applies. It is handed to `loadWorklist` at line 101. 2.
  `src/lib/monday/worklist/data.ts:165-167` reads the slug with that same user client:
  `supabase.from('app_settings').select('monday_account_slug').eq('singleton_id',
  1).maybeSingle()`. `data.ts` never imports `createAdminClient` (0 occurrences). 3.
  `supabase/migrations/052_app_settings_admin_only.sql:47` is the only SELECT policy on that
  table: `CREATE POLICY app_settings_admin_read ON app_settings FOR SELECT TO authenticated
  USING (is_admin(auth.uid()))`, and `is_admin` (007:33-38) is `profiles.role = 'admin'`.
  There is no other policy on `app_settings` in any of the 80 migrations.  So for every
  signed-in NON-ADMIN the query returns zero rows, `maybeSingle()` gives `data: null` with
  no error, `slug` is null, and `itemUrl` (data.ts:183-188) returns null on its first line
  for every row. Every cell in the Monday column renders the grey dash at WorkList.tsx:395.
  The rest of the page is unaffected, because `064_monday_worklist.sql:141` grants `FOR
  SELECT TO authenticated USING (true)` on monday_users / monday_user_links / monday_boards
  / monday_board_steps / monday_assignments. That asymmetry produces exactly the reported
  symptom: a full, working, eleven-column list with a "Monday" header and nothing under it.
  The drawer fallback the classifier leaned on fails identically, since it is gated on the
  same `row.url` (WorkList.tsx:230).  The page's own header comment says "Available to any
  signed-in user", while `app_settings` is admin-only by design ("a signed-in team member
  has no reason to see the API tokens", 052). Whoever classified this was almost certainly
  looking as an admin, which is the one account where the feature does work.  Two
  corroborations that this is a real regression and not my theory: -
  `051_rls_on_report_and_project_tables.sql:45-49` warns in writing that reading
  `app_settings` with the user's client is the bug to fix ("it should use the admin
  client"). Migration 068 then added a new user-client read of `app_settings` in
  `loadWorklist`. - The correct pattern exists elsewhere:
  `src/app/(app)/settings/page.tsx:153` calls `loadWorklistSources(createAdminClient())` for
  its own `app_settings` read (sources.ts:68-69). Only My Work uses the RLS-bound client. -
  The test cannot catch it: `data.test.ts:87` seeds `app_settings: [{ monday_account_slug:
  'truenorth' }]` into a fake client with no RLS (fakeClient, line 15), and no test asserts
  `row.url` at all (zero matches for "url" in that file).  The classifier's own reasoning is
  also wrong about the cause. They wrote that the dash appears "if the portal has not stored
  the Monday account name", pointing a maintainer at re-running the sync (discover.ts:205).
  The value is stored fine; it is unreadable by the person looking at the screen. Re-running
  the sync changes nothing.  The window-width point in their evidence is real too and
  independently sinks "already-exists": the table is `min-w-[1180px]` inside `overflow-x-
  auto` (WorkList.tsx:336-337) with nothing sticky, so with the 64px rail (Sidebar.tsx:241)
  plus `px-6` (MainContent.tsx:40) the twelfth column falls off below roughly 1293px, with
  no visible cue under macOS overlay scrollbars. But that one is secondary: even at 2560px
  wide, a non-admin sees dashes.  Fix is one line: read the slug with `createAdminClient()`
  (or pass it in from the page), the same way Settings already does. Correct verdict:
  portal-bug.

**Draft reply, written before verification:**

> **DO NOT SEND.** Tells her to maximise the window or scroll. The link is dead for non-admins; this reply would be false.

The Monday link is already there. It is the last column on the right, headed "Monday", and
it shows as a small eye button on every row. Clicking it opens that exact item in Monday in
a new tab. If the row is a subitem, it opens the parent item, because a subitem on its own
has no page in Monday. There is a second Monday link too: click anywhere on a row and a
panel opens with the item's history, and the same eye sits in the top right corner of that
panel.  Two things could explain why you did not find it. First, the table is wide, about
1180 pixels, and it scrolls sideways inside its own box. On a smaller screen or a browser
window that is not maximised, the Monday column is the first one to slip off the right edge,
and on a Mac the scrollbar stays invisible until you actually scroll, so there is nothing
telling you there is more to the right. Try maximising the window, or scroll the table
sideways.  Second, if the column is visible but every row just shows a dash, that is a
settings problem on our side: the portal needs to know your Monday account name to build the
links, and it picks that up on the first Monday sync. Send me a screenshot and I will tell
you straight away which of the two it is.

**Work needed:**

Nothing needs building for the link itself. Two small robustness fixes are worth doing so
this stops being reported: (1) pin the Monday column so it cannot scroll out of view, by
making the last grid column sticky to the right edge of the scroll container at
src/components/monday/WorkList.tsx:336-337 and :395, or give the scroll container a visible
affordance such as a right-edge fade when there is more content; (2) confirm
`app_settings.monday_account_slug` is populated in production
(src/lib/monday/worklist/data.ts:165-167), and if it can be empty, surface that in Settings
rather than rendering a silent dash on every row (src/components/monday/WorkList.tsx:395).
Also worth deleting the dead sample screen src/components/MyWork.tsx, which has no Monday
link and would confirm this complaint if anyone ever wired it back up.

## A2. my-work-overdue-not-my-step

**From:** Second reviewer, probably Stephanie Aguirre ("Item 1 - Portal" and "Item 4 - Portal")

**What they wrote:**

> Most of the overdue items that are showing up in my list are not overdue because of my
> step in the workflow, but rather other people's steps not being completed on time after
> mine.

**Verdict:** portal-gap, upheld; effort large, impact high

They are right: My Work stamps one deadline on every person in a workflow, so anyone whose
step is still open gets marked "Late" for a delay that happened at somebody else's step.

**Evidence:**

- src/lib/monday/worklist/ingest.ts:217 - the deadline is read once per ITEM from a single
  board-level column: `const due = board.date_col ? dateOf(byCol.get(board.date_col)?.value
  ?? null) : null`
- src/lib/monday/worklist/ingest.ts:219-238 - that one date is then copied onto every row
  written for that item, one row per step per person (`due_date: due` inside the `for (const
  uid of ids)` loop)
- supabase/migrations/067_monday_dates_and_colours.sql:18-20 - `date_col` and `date_title`
  are columns on `monday_boards`, so a deadline belongs to a board, never to a step
- supabase/migrations/064_monday_worklist.sql:82-92 - `monday_board_steps` has board_id,
  people_col, people_title, status_col, step_name, position, source, updated_at and no date
  column at all. A per-step deadline is unrepresentable
- src/lib/monday/worklist/steps.ts:71-77 - `pickDateColumn` returns `dates.find(c =>
  deadline(c.title)) ?? null`, the FIRST matching date column in board order, for the whole
  board
- src/lib/monday/worklist/steps.ts:56-57 - the code's own comment names real boards carrying
  several per-stage deadlines ("Audit By, Adapt By, Plan By, Create By, GPT By"), and only
  one of them is ever used
- src/components/monday/WorkList.tsx:158-176 - `readDue` turns that single item date into
  `state: 'late'` with no reference to which step the row belongs to
- src/components/monday/WorkList.tsx:392 - the Late badge is rendered from that state on
  every row, and WorkList.tsx:342-353 shows the 12 headers contain no column, sort or filter
  for whose step is late
- src/components/monday/WorkList.tsx:546 and src/lib/monday/worklist/data.ts:318 - a row
  stays in On-going whenever `statusDone !== true`, so `null` and `false` both keep it in
  the list
- src/lib/monday/worklist/ingest.ts:215 - `const done = st.status_col && index != null ?
  cfg?.done.has(index) ?? false : null`. Whether a person's own step counts as finished is
  decided entirely by Monday's `done_colors` on that board
- src/lib/monday/worklist/steps.ts:109-111 - a people column with no free status beside it
  is stored with `statusCol: null`, which makes `status_done` permanently null, so that
  person's row can never leave On-going and carries the item deadline forever
- supabase/migrations/064_monday_worklist.sql:88 with src/lib/monday/worklist/data.ts:159
  and data.ts:197 - `position` (workflow order) is stored and loaded but never placed on
  `WorkRow`, so nothing can say which step is the one actually holding the item up
- src/lib/report/spans.ts:57-62, src/lib/report/data.ts:75-77 and
  src/lib/report/people.ts:107 - the Report's lateness and per-person late counts read the
  same item-level `due_date`, so the Report repeats the misattribution rather than
  correcting it

**Draft reply, written before verification:**

You are right, and it is our side, not yours. Today the portal takes one due date from the
whole Monday board and stamps it on every person in the workflow for that item. So if an
item is late, every step still sitting open is shown as late, no matter which step actually
caused the delay. Your step and the step three places after yours are judged against the
same date. There is nothing in the page that can tell the difference yet, and no filter or
badge for "this is not waiting on me". We are going to fix it, and there are two parts.
First, deadlines need to belong to a step rather than to a board, so a step with its own
"By" date is judged against that date. Second, a row needs to say where it sits in the
workflow and whether an earlier step is still open, so "waiting on someone else" is visible
instead of reading as your delay. One thing that will help right away while we build it:
check on your boards whether the label you set when you hand work on is marked as a Done
colour in Monday. If it is not, your finished step stays in your On-going list forever and
keeps collecting the item's deadline. That part we can put right per board this week.

**Work needed:**

Three pieces. (1) Move the deadline from the board to the step: add a date column to
`monday_board_steps` (schema at supabase/migrations/064_monday_worklist.sql:82-92), seed it
in discovery by pairing the nearest date column to each people column the way
`nearestStatus` already pairs statuses (src/lib/monday/worklist/steps.ts:80-116), make it
reviewable on /settings/monday next to the existing step review, and read it per step in the
ingest instead of the single `board.date_col` at src/lib/monday/worklist/ingest.ts:217. Keep
the board date as the fallback so nothing regresses. (2) Surface workflow order: `position`
is already stored and loaded (data.ts:159, 197) but dropped before `WorkRow`. Put it on the
row, compute the lowest-position open step per item, and when that step is not the viewer's,
badge the row as waiting on an earlier or later step rather than as their lateness. (3)
Audit the boards where a people column has no paired status (steps.ts:109-111 writes
`statusCol: null`, which makes `status_done` null and pins the row in On-going forever) and
the boards whose handoff labels are missing from Monday's `done_colors` (ingest.ts:215).
That second one is a Monday configuration fix, not code, but it is a large share of what
this person is seeing. The Report inherits the same item-level date
(src/lib/report/spans.ts:57-62, data.ts:75-77, people.ts:107) and has to be updated with the
new per-step date or its per-person late counts will keep contradicting the page.

## A3. my-work-tasks-from-years-ago

**From:** Second reviewer, probably Stephanie Aguirre ("Item 1 - Portal" and "Item 4 - Portal")

**What they wrote:**

> I know we already talked about this, but tasks are in the list from years ago.

**Verdict:** portal-gap, overturned (the first verdict was monday-data); effort medium, impact medium

Those old tasks are real, still open assignments in Monday: the portal only hides work after
six months once Monday itself says it is finished, so anything nobody ever closed stays on
the list forever, and the sort puts the most overdue ones at the very top.

**Evidence:**

- src/lib/monday/worklist/data.ts:245 - the only age filter in the whole read path:
  `out.or('status_done.is.null,status_done.eq.false,item_updated_at.gte.' + sinceIso)`. A
  row is dropped only when status_done is exactly true AND the item is older than the
  window. Anything not marked done survives at any age.
- src/lib/monday/worklist/data.ts:48 - COMPLETED_MONTHS = 6, the window that applies
  exclusively to finished work.
- src/lib/monday/worklist/data.ts:318 - `if (row.statusDone !== true) open++`, so null and
  false both count as open work.
- src/components/monday/WorkList.tsx:546 - the On-going block is `known.filter(r =>
  r.row.statusDone !== true)`, the same rule on screen.
- src/lib/monday/worklist/ingest.ts:215 - `const done = st.status_col && index != null ?
  cfg?.done.has(index) ?? false : null`. Doneness comes from Monday's own done_colors list,
  never from the label text. A blank status cell or a step with no status column yields
  null, which is permanently open.
- src/lib/monday/worklist/steps.ts:111 - when the guess cannot pair a people column with a
  free status column it stores `statusCol: null`, so no item on that step can ever read as
  done regardless of what happens in Monday.
- src/lib/monday/worklist/data.ts:327-332 - server sort is open first, then due date
  ascending, so the oldest overdue row is the first row.
- src/components/monday/WorkList.tsx:547-551 - the client re-sorts On-going by board
  priority then due date ascending, which again floats the most ancient overdue item to the
  top of each band.
- src/lib/monday/worklist/ingest.ts:189,195 - items are pulled with `items_page(limit:
  $limit)` and `next_items_page(...)`, no date argument and no rules, so a 2017 item is
  stored exactly like a 2026 one.
- src/lib/monday/worklist/stale.ts:9 and
  supabase/migrations/074_monday_auto_hide_stale.sql:43 - the only age rule we have is per
  BOARD (STALE_MONTHS = 6) and `monday_hide_stale_boards` defaults to false, so it is off
  unless somebody turned it on.
- src/lib/monday/worklist/ingest.ts:267 - `last_activity_at` is the newest item on the whole
  board, so one recently touched assignment keeps every 2017 item on that board visible even
  with the board rule switched on.
- src/lib/monday/worklist/data.ts:234,239 - board visibility is the only board-level gate
  that reaches the item query; nothing filters an individual item by age.
- src/components/monday/WorkList.tsx:515-640 - the entire filter bar is search,
  Mine/Everyone, person, team and the finished-work toggle. There is no date, age or due-
  date filter control anywhere.
- src/lib/monday/worklist/ingest.ts:253-257 - each sync deletes and reinserts a board's
  rows, so these are not leftover ghosts from a deleted Monday item; they are re-read from
  Monday on every pull.

**Why the first verdict was overturned:**

- The mechanics the classifier describes are accurate, but the conclusion drawn from them is
  not. The claim that carries the verdict is "those old tasks are real, still open
  assignments in Monday: the portal only hides work after six months once Monday itself says
  it is finished." The code shows Monday is frequently never allowed to say it.  1) The
  portal manufactures rows that can never be finished.
  src/lib/monday/worklist/steps.ts:110-113 stores statusCol: null whenever the guess cannot
  pair a people column with a FREE status column, and src/lib/monday/worklist/ingest.ts:215
  then hard-codes status_done = null for every assignment on that step, reading nothing from
  Monday at all. Null is treated as open at src/lib/monday/worklist/data.ts:245 (kept at any
  age), :318 (counted as open) and src/components/monday/WorkList.tsx:546 (rendered under
  On-going). The project's own tests prove this is the ordinary case, not an edge:
  src/lib/monday/worklist/steps.test.ts:52 (two adjacent people columns, the first is
  unpaired), :60 (two owners, one status, the second is unpaired), :71 (a people column with
  no status column anywhere, unpaired). Any Monday board with more people columns than
  status columns, or with an owner and a date and no status, puts every assignment it ever
  held on somebody's list forever. Those rows are portal output, not Monday state. The
  classifier cites steps.ts:111 as evidence FOR monday-data when it is the clearest evidence
  against it.  2) Doneness elsewhere is a heuristic that fails toward "open". ingest.ts:215
  ends in `cfg?.done.has(index) ?? false`, and statusSettings (ingest.ts:59-73) returns an
  EMPTY done set when settings_str is missing or unparsable. So a step whose Monday label
  literally reads Done is stored as not-done whenever the legacy done_colors list is absent,
  empty, or points at a different index. status_text is ingested right beside it and never
  cross-checked.  3) Nothing lets a user fix or even see this, which is what makes it a gap
  rather than bad data. setStepSource (src/app/(app)/settings/monday/actions.ts:96-108)
  updates `source` and nothing else; no code path anywhere writes status_col except the
  discovery seed (discover.ts:273). StepReview.tsx:110,114 offers exactly two choices,
  confirmed or off, and "off" deletes the step's genuinely open work too. `via` ('right' |
  'left' | 'none', steps.ts:46) is never persisted (discover.ts:270-277 writes no such
  column) and is absent from StepUnderReview (steps-review.ts:19-30), so a reviewer cannot
  tell an unpaired step from a paired one. Worse, discover.ts:260-268 skips any row whose
  source is not 'guess', so confirming an unpaired step freezes status_col = null
  permanently, even after the board gains a status column. On screen the row explains
  nothing: WorkList.tsx:381-383 renders a null status as "-", and group_title, ingested and
  carried all the way into WorkRow (data.ts:236,302), is never rendered, so an item parked
  in a Done group in Monday looks identical to live work.  Add the missing controls the
  classifier itself lists (no age or due filter, sort that floats the oldest overdue row to
  the top of every band at data.ts:327-332 and WorkList.tsx:547-551) and the team's
  complaint is answered by things the portal lacks: a way to repair a step's status pairing,
  a way to mark or filter work the portal cannot resolve, and any on-screen signal
  distinguishing "still open" from "unknowable here". monday-data would only hold if the old
  rows had been shown to sit on paired, correctly configured steps, and no one checked that.

- The classification's load-bearing claim, "those old tasks are real, still open assignments
  in Monday", is not established by the code it cites, and the code shows a portal-side
  mechanism that produces the same symptom with nobody in Monday neglecting anything.  1.
  The portal's "open" is not Monday's "open". src/lib/monday/worklist/ingest.ts:215 - `const
  done = st.status_col && index != null ? cfg?.done.has(index) ?? false : null`. Every
  uncertainty falls to `null`: no status column paired to the step, a blank/never-set status
  cell, or a status_col id that no longer exists on the board.
  src/lib/monday/worklist/data.ts:318 and src/components/monday/WorkList.tsx:546 then treat
  `statusDone !== true` as On-going, so "we could not read this" and "Monday says not done"
  are the same row on screen. Nothing in the read path distinguishes them, and the
  classifier did not run the one query that would (`status_done is null` vs `= false`, by
  board and step).  2. The evidence cited as PROOF of monday-data is the refutation.
  src/lib/monday/worklist/steps.ts:111 stores `statusCol: null` whenever the heuristic finds
  no status-like column in either direction, or the nearest one was already claimed by an
  earlier people column (`taken`). Every assignment on such a step is permanently On-going
  no matter what happens in Monday. That is the portal failing to read Monday, not Monday
  holding open work. Same for a step invented from a non-workflow status column: steps-
  review.ts:38 keeps a `NOT_A_STAGE` list
  (priority|status|type|category|label|stage|state|progress|owner|team|notes|comments)
  precisely because the pairing fabricates steps, and a fabricated step has no done label,
  so it can never leave the list.  3. There is no repair path, which turns the misread into
  a permanent one. src/app/(app)/settings/monday/actions.ts:96-108 (`setStepSource`) writes
  only `source`; `status_col` in supabase/migrations/064_monday_worklist.sql:87 is writable
  by the seeder alone. src/components/monday/StepReview.tsx:108-118 offers exactly "It is a
  step" / "Not a step" and never shows whether a status column is paired. And
  src/lib/monday/worklist/discover.ts:260-268 skips re-seeding anything not marked `guess`,
  so a null or wrong pairing that someone confirmed is frozen forever, even after the board
  grows the right column. steps-review.ts:1 says there are 515 such guesses nobody has
  confirmed. An admin's only lever is switching the whole people column off, which deletes
  real work from the list.  4. The portal's own sort guarantees these artifacts are the
  first thing the team sees (data.ts:327-332, WorkList.tsx:547-551), and `plausible()`
  bounds only 2000-2100, so a 2017 date sorts as a live deadline. The authors already
  accepted the principle that untrustworthy data must not float to the top (that is what
  `dueSuspect` does for year-202 dates); a years-stale date on a step the portal cannot mark
  done is the same class of problem and is unhandled.  5. Even granting that some old rows
  are genuinely open in Monday, the response "go close them in Monday" is not the whole
  answer. The Completed block has an age window and a toggle (COMPLETED_MONTHS = 6); On-
  going has neither, and the filter bar (WorkList.tsx:515-640) has no date, age or overdue
  control. The only age rule is per BOARD (stale.ts:9), is off by default (migration
  074:43), and is defeated by `last_activity_at` being the newest item on the whole board
  (ingest.ts:267) - all three facts the classifier lists as support, all three actually
  descriptions of a missing per-item rule.  Recommended check before acting: on the rows
  older than ~12 months in the On-going block, count `status_done is null` vs `status_done =
  false`, joined to `monday_board_steps.status_col is null` and `source = 'guess'`. If the
  null/unpaired share is material, this is a portal defect (the portal cannot see doneness
  and offers no way to fix the pairing). If the rows come back overwhelmingly `status_done =
  false` on confirmed, properly paired steps, then monday-data is right for those specific
  rows - and the residual complaint is still a portal-gap, since On-going has no age control
  at all. Either way the current verdict is asserted, not demonstrated, so it does not stand
  as written.

- The reasoning assumes every ancient On-going row is a genuinely unclosed Monday
  assignment. The code disproves that, using the classifier's own evidence read one step
  further.  1) The portal manufactures rows that can never be done, whatever Monday says.
  steps.ts:111 stores `statusCol: null` whenever the adjacency guess finds no free status
  column. ingest.ts:215 then computes `const done = st.status_col && index != null ?
  cfg?.done.has(index) ?? false : null`, so with no status column the answer is null, and
  data.ts:318 plus WorkList.tsx:546 both treat `statusDone !== true` as open. An item
  finished and signed off in Monday in 2019 still sits in On-going forever, because the
  portal never asks a column that could say otherwise. The UI even admits it: WorkList.tsx
  StatusChip says "Grey only when a step has no status column paired", and the row renders
  Status as a bare "-". That is the portal deciding, not Monday's data.  2) The same holds
  for a wrong pairing. steps-review.ts opens with "The 515 guesses nobody has confirmed" and
  says the pairing "is wrong loudly when it is not: a board whose people column sits next to
  a Priority dropdown gets a step called Priority, and every row of it is on somebody's
  list." A Priority or Type column never carries a done_colors index, so
  `cfg?.done.has(index) ?? false` is false forever on those steps. Also ingest.ts:71, `done:
  new Set(s.done_colors ?? [])`: a status column with no done_colors makes every label on
  that board not-done, permanently.  3) Nobody can correct it, so "fix it in Monday" is not
  an available answer. The only reachable writer is setStepSource
  (settings/monday/actions.ts:96-108), which updates `source` alone and never `status_col`.
  StepUnderReview does not even carry statusCol, so the reviewer cannot see that a step is
  structurally incapable of ever reading as done. It is admins-only (guard ->
  isSecurityAdmin), and the sole remedy, "off", deletes the whole step from everyone's list
  including the live work on it. Closing the item in Monday changes nothing for these rows.
  4) The portal holds the exact fact the person is complaining about and hides it.
  item_updated_at is ingested, selected (data.ts:236), carried onto every row as
  itemUpdatedAt (data.ts:316), and grep shows zero uses in any component: it is never
  displayed, never sorted on, and for open work never filtered on. group_title is likewise
  ingested and carried (data.ts:302) and never used, which is the field where Monday teams
  actually park finished work ("Done", "Archive", "Published 2019"). The one signal that
  would answer "is this still real?" is on the row object and off the screen.  5) The
  ordering is a portal choice that promotes the defect. data.ts:327-332 and
  WorkList.tsx:547-551 both sort open first, then due date ascending, so the phantom-open
  2019 row outranks a real task due tomorrow. Meanwhile the only date-shaped control on the
  page reads "Finished work: 6 months", which tells the user the list is time-bounded while
  the dominant On-going block ignores time entirely.  Even granting the most charitable
  reading, that some old rows are genuinely open in Monday, there is no age filter, no last-
  activity column, no per-item hide, and no stale marker anywhere on /my-work, so the person
  has no recourse. That alone would be portal-gap. Points 1 to 3 make it portal-bug:
  doneness is derived from a guessed column, or from no column at all, with no user-
  reachable repair, and the ancient rows are then ranked to the top of the page.

**Draft reply, written before verification:**

> **DO NOT SEND.** Says the rows are real Monday work that closing in Monday clears. Some are unpaired steps nothing in Monday can close.

Good catch, and the rows are not wrong. Every one of those old tasks is a Monday item where
your name is still in a people column and the status was never moved to a label Monday
counts as finished. We hide finished work after six months, but we only do that for work
Monday tells us is finished. Anything left open just stays open, whether it is from last
week or from 2017. It looks worse than it is because we sort the most overdue thing first,
so the oldest items land right at the top of your list instead of quietly at the bottom.
Two things are worth doing. On your side, if those items really are dead, closing them in
Monday (or taking your name off the people column) makes them disappear from My Work on the
next pull. On our side, there is a real gap: we give you no way to say "hide open work
nobody has touched in a year", and there are a few boards where the step has no status
column attached to it at all, which means those tasks can never register as done no matter
what you do in Monday. We will look at both. If you can send me one or two board names where
this is worst, that tells us straight away which of the two you are hitting.

**Work needed:**

Three pieces, in order of value.  1. An age control for open work on My Work. Today the only
age rule in the read path is data.ts:245, which applies solely to rows Monday marks done.
Add an opt-in filter on item_updated_at for open rows too, as a URL parameter alongside the
existing `done` toggle, with a matching control in the filter bar (WorkList.tsx:515-640,
which currently has no date filter at all). It must default to the current behaviour so
nobody's work silently vanishes, and it must not leak into the Report loaders, which all
call loadWorklist with includeDone false (src/lib/report/data.ts:186, workload-data.ts:53,
waits.ts:34, people.ts:71) and would otherwise report different totals than before.  2.
Surface the steps that can never complete. steps.ts:111 stores a people column with no
paired status column, and ingest.ts:215 then writes status_done null for every item on it,
forever. The Settings > Monday steps screen should list these explicitly so an admin can
pair the right status column or switch the step off. Note that `via` ('right' | 'left' |
'none') is computed at steps.ts:45-46 but never persisted (the insert at discover.ts:269-279
omits it and there is no column for it in migration 064), so the reviewer currently cannot
see how confident the guess was. Adding that column is a prerequisite for showing it.  3.
Reconsider the sort, or at least the framing. data.ts:327-332 and WorkList.tsx:547-551 both
put the oldest overdue row first. That is defensible for genuinely urgent work and actively
misleading for abandoned work. Either separate very old open rows into their own collapsed
block (the same shape as the existing Completed block) or mark them on the row so the reader
can tell "urgent" from "forgotten" without opening Monday.  Not needed: no code fix. Nothing
here is behaving contrary to what it documents, and no rows are stale leftovers, since each
sync deletes and reinserts a board's assignments (ingest.ts:253-257).

## A4. my-work-no-edits-needed-stays-open

**From:** Second reviewer, probably Stephanie Aguirre ("Item 1 - Portal" and "Item 4 - Portal")

**What they wrote:**

> Certain tasks are still in the list even though the workflow stops with me if I change
> the status in Monday to something in particular. This is happening with the AAAF photo
> curation audits. If I mark something as "No edits needed", this should remove the task
> from my to-do list because there is nothing more that needs to be done (for me or anyone
> else).

**Verdict:** portal-gap, overturned (the first verdict was monday-data); effort small, impact medium

The portal never reads the words on a status label: it only trusts which labels the Monday
board itself marks as "done", so "No edits needed" stays on the list until that label is
marked done on the AAAF photo curation board in Monday.

**Evidence:**

- src/lib/monday/worklist/ingest.ts:59-71 statusSettings() parses the status column's
  settings_str and returns done: new Set(s.done_colors ?? []), i.e. the label INDICES Monday
  itself paints as finished
- src/lib/monday/worklist/ingest.ts:215 const done = st.status_col && index != null ?
  cfg?.done.has(index) ?? false : null - the only place doneness is ever decided, and it is
  index membership, never a string
- src/lib/monday/worklist/ingest.ts:14-17 the design comment states the refusal outright:
  doneness comes from the board's own configuration 'instead of asking a person to declare
  which label means done on 197 boards'
- src/lib/monday/worklist/ingest.ts:233 status_text: sc?.text ?? null - the label text is
  stored and displayed, and is never compared against anything
- src/lib/monday/worklist/data.ts:245
  out.or(`status_done.is.null,status_done.eq.false,item_updated_at.gte.${sinceIso}`) - a row
  is open unless status_done is exactly true
- src/lib/monday/worklist/data.ts:318 if (row.statusDone !== true) open++
- src/components/monday/WorkList.tsx:546 ongoing = known.filter(r => r.row.statusDone !==
  true) and WorkList.tsx:553 completed = ... === true - the row only leaves On-going when
  status_done is true
- grep for 'no edits', 'not relevant', 'skipped', 'n/a' across src/lib/monday/worklist/*.ts
  returns nothing: there is no list of terminal labels and no normalisation of status text
  anywhere
- supabase/migrations/064_monday_worklist.sql:82-92 monday_board_steps has only board_id,
  people_col, people_title, status_col, step_name, position, source - there is no column for
  'this label means done', so there is no in-portal override
- src/app/(app)/settings/monday/actions.ts:96-108 setStepSource only accepts 'guess' |
  'confirmed' | 'off' - the only in-portal escape hatch is switching the whole step off for
  everyone
- src/lib/monday/worklist/ingest.ts:60 and 71 - if settings_str is missing or unparseable
  the done set is empty, which makes every label on that column read as not-done
- vercel.json - /api/cron/monday-worklist runs at minute 15 of hours 1,5,9,13,17,21 UTC, so
  any status change takes up to about 4 hours to reach the page; there is no live read
  (src/lib/monday/worklist/data.ts reads Postgres only)
- src/lib/monday/worklist/steps.ts:97-116 seedSteps pairs a people column to the nearest
  status column to its right, then left - if that guess picked the wrong column on this
  board, the row would show a different label in the Status column and its doneness would
  come from the wrong place

**Why the first verdict was overturned:**

- The mechanics are read correctly (doneness is only `cfg?.done.has(index)` at
  src/lib/monday/worklist/ingest.ts:215), but "monday-data" is the wrong owner, for four
  reasons.  1) The prescribed fix is asserted, not shown. Every item of evidence is portal
  code. Nothing establishes that the AAAF photo-curation step is even paired to the column
  this person changes, that "No edits needed" lives on that column, or that anyone at True
  North can add a label to `done_colors` (Monday surfaces it through settings_str; there is
  no verified board-side observation anywhere in the evidence). A verdict that hands the
  work to another system needs at least one fact from that system.  2) Three portal-side
  conditions produce this exact symptom, and no Monday edit fixes any of them. (a) Unpaired
  step: seedSteps (src/lib/monday/worklist/steps.ts:97-116) returns statusCol null whenever
  the nearest status column was already claimed by an earlier people column, so
  ingest.ts:215 writes status_done = null and data.ts:318 / WorkList.tsx:546 keep the row
  On-going forever. An audit board is precisely that shape (Curator, Status, Auditor: the
  auditor's status sits to the left and is already taken). (b) Wrong pairing: the guess
  reads a different status column, so the person changes the right one and nothing moves.
  (c) statusSettings (ingest.ts:59-71) returns an empty done set on a missing or unparseable
  settings_str, and `cfg?.done.has(index) ?? false` also yields false when the column is
  missing from settingsBy, which makes every label on that column, a literal "Done"
  included, read as not-done. In all three cases the row still renders the label text in
  Monday's own hex (WorkList.tsx:247), so it looks like the status was read correctly.  3)
  The portal offers no inspection and no override, so the user cannot even test the claim.
  monday_board_steps (supabase/migrations/064_monday_worklist.sql:82-92) has no done-label
  column; setStepSource takes only guess|confirmed|off; src/components/monday/StepReview.tsx
  never shows which status column a step reads, whether it has one, or which labels count as
  done. The only escape hatch, "Not a step", removes the step for everyone including its
  open work. Worse, src/lib/monday/worklist/discover.ts:268 skips any step whose source is
  not 'guess', so confirming a step freezes its status_col permanently: a confirmed wrong
  pairing is uncorrectable in the product.  4) What was asked for is a category the model
  cannot express: a terminal outcome that is not "done". ingest.ts:14-17 states the refusal
  on cost grounds ("197 boards"), which is a deferred feature, not bad board data. Pushing
  "No edits needed" into that board's done set would also change its batteries, automations
  and dashboards for everyone, i.e. reconfiguring a shared system to fit the portal's single
  boolean.  Caveat kept honest: if that step happens to be paired correctly and the board
  really does exclude the label, a Monday edit would clear the row. But the portal cannot
  tell anyone that, cannot show the pairing, and cannot express "this label ends my part",
  so the fix lives here. Corroborating: there is no ingest.test.ts, so statusSettings, the
  one function deciding doneness for ~53k rows, is untested in either direction.

- The code reading is correct: doneness comes only from done_colors indices
  (src/lib/monday/worklist/ingest.ts:59-71, :215), and a row leaves On-going only when
  status_done is exactly true (data.ts:318, WorkList.tsx:546). What is not established is
  that this board's config is the cause. Nothing in the evidence touches the AAAF board at
  all: no board id, no column list, no settings_str, no proof the row the person sees even
  has a status column paired. Three portal-side mechanisms produce this exact symptom and
  two cannot be fixed in Monday at all: (1) an unpaired step, where seedSteps found no
  status to the right or the status was already claimed (steps.ts:103-113), writes
  status_col null, so ingest.ts:215 yields null forever and no label change can ever clear
  the row; (2) a mispaired step reads a different column, so marking the right label done
  changes nothing; (3) an unparseable settings_str returns an empty done set
  (ingest.ts:60,72-74), making every label read not-done. The classifier picked the one
  cause that puts the fix on the customer without distinguishing it. Worse, the portal
  offers no repair: status_col is written only by the seeding upsert (discover.ts:273-284),
  and setStepSource accepts only guess/confirmed/off (settings/monday/actions.ts:96-108,
  isSecurityAdmin only), so not even an admin can re-point a wrong pairing or declare a
  terminal label. The refusal is deliberate and documented (ingest.ts:14-17), which makes
  the ask a declined capability, not customer data hygiene. The verdict also assumes a
  Monday user can edit done_colors, which is never checked, and ignores the ~4h cron lag
  (vercel.json).

- The mechanism is described correctly, but it is routed to the wrong owner. I found the
  exact rows in the live DB: board 6627839436 "AAAF - Photo Curation Audits", people col
  "people" (step "Assign", source still 'guess'), label "No edits needed" index 6 (#e484bd),
  status_done=false, 8 rows, all on monday_user_id 13330153 = Stephanie Aguirre,
  item_updated_at Oct 2025. She has been looking at an 11-month-old pink chip reading "No
  edits needed" sitting inside the block WorkList.tsx:705 titles "On-going / Steps still
  open", with the label rendered right there by StatusChip (WorkList.tsx:247,381). A page
  that prints the contradiction on its own row is not a Monday data problem. Scale kills the
  verdict: of 4,577 open rows on boards My Work actually shows for visible accounts, 942
  (21%) carry unambiguously terminal labels (No edits needed, Not Relevant, Not Needed,
  Cancelled, Declined, Topic Rejected), across 24 people and 17 boards - Clarise Nixon 405,
  Barack Owili 237, Stephanie 72. The signal is also self-inconsistent and invisible: "Not
  Relevant" index 10 is done=true on boards 462251934 and 1881594265 and done=false on
  6627839436, 18249582518, 8513810777, and settings_str/done_colors is read at ingest and
  never stored, so no screen anywhere tells anyone which labels count as done. The implied
  remedy is not data entry and is not hers: done_colors is a status-column configuration
  changed for everyone on 17 columns (every board here uses index 1, the Monday default, so
  nobody has ever set it by hand), it lands up to 4+ hours later via the rotation cron, and
  the only in-portal lever, setStepSource 'off' (actions.ts:96-108, admins only), deletes
  the step for the whole company. The design comment ("instead of asking a person to declare
  which label means done on 197 boards") is a confession of an unbuilt feature, not a
  defence: the portal already overrides Monday on board priority ("Nothing in Monday knows
  this; a person does"), hidden accounts, stale boards, date column, step names and step
  on/off; doneness is the one axis with no column in migration 064 to hold the answer. And
  "the portal never reads the words on a status label" is not a codebase principle: webhook-
  handler.ts dispatches on newLabel === 'Run Link' / 'Done', steps-review.ts's NOT_A_STAGE
  regex decides from a column's words whether a step exists at all, and steps.ts
  pickDateColumn picks deadlines from title words. Secondary gap the verdict misses
  entirely: doneness is per (item, people col, person), so there is no item-level terminal
  state that could ever satisfy her "nothing more for me or anyone else".

**Draft reply, written before verification:**

> **DO NOT SEND.** Promises the fix is one setting on the Monday board. Portal-side causes (wrong pairing, unpaired step) are just as likely, and the portal cannot show which.

You are right that the task should disappear, and the fix is one setting on the Monday board
rather than a change to the portal. My Work never reads the words on a status label. It asks
the board which labels Monday itself counts as finished (the ones marked done on that status
column) and closes the row only for those. On the AAAF photo curation board, "No edits
needed" is almost certainly not one of them, so the portal keeps treating it as outstanding,
forever. Two things to check, in order. First, open the task in My Work and look at the
Status column on that row: if it already reads "No edits needed", the portal is reading the
right column and the only thing missing is that the label is not marked as done in Monday.
Ask whoever owns that board to mark "No edits needed" (and any other closing label like "Not
relevant" or "N/A") as a done label on that status column, and the rows will move to
Completed on the next sync. Second, if the Status column on the row shows some other label
instead, tell us: it means we have paired your name column to the wrong status column on
that board, and that is ours to fix. Either way, expect up to about four hours before the
page catches up, because My Work refreshes from Monday six times a day rather than live. One
caveat on "nothing more for anyone else": the portal closes your step only. If the item has
other people columns with names still in them, those stay on those people's lists, since
Monday is where the workflow says it stopped.

**Work needed:**

No code change is required to make this work; the correction belongs on the Monday board.
Worth building anyway, because this will keep happening: (1) an admin screen, or a line in
the row history panel, showing which labels a board counts as done, so "why is this still
open" is answerable without reading settings_str; (2) a re-pair control in Step review,
since setStepSource today only offers guess/confirmed/off and cannot move a step to a
different status column; (3) a warning when a status column's settings_str is missing or has
an empty done set, which today silently makes every row on that column open forever
(ingest.ts:60,71).

## A5. my-work-not-relevant-still-shows-bm-photo-curation-audits

**From:** Second reviewer, probably Stephanie Aguirre ("Item 1 - Portal" and "Item 4 - Portal")

**What they wrote:**

> This is also the same on the BM photo curation audit board when I change the status to
> "Not Relevant". It still appears in my to-do list even though nothing is going to be
> done on that page.

**Verdict:** monday-data, upheld; effort small, impact medium

The portal only treats a step as finished when Monday's own status column lists that label
as a "done" label, and on the BM - Photo Curation Audits board "Not Relevant" was never
added to that list, so the portal keeps counting it as open work.

**Evidence:**

- src/lib/monday/worklist/ingest.ts:14-17 - the design is stated outright: doneness is read
  from the status column's `settings_str.done_colors`, "the label indices Monday itself
  treats as finished", deliberately "instead of asking a person to declare which label means
  done on 197 boards"
- src/lib/monday/worklist/ingest.ts:71 - `return { done: new Set(s.done_colors ?? []),
  colour }`; the done set holds label INDICES from Monday, never label text
- src/lib/monday/worklist/ingest.ts:215 - the single line that decides it: `const done =
  st.status_col && index != null ? cfg?.done.has(index) ?? false : null`
- src/lib/monday/worklist/ingest.ts:233-235 - `status_text` is stored verbatim next to
  `status_done` and is never compared against any literal anywhere in
  src/lib/monday/worklist/ (grep for 'Not Relevant', 'Not Needed', 'No edits needed',
  'Skipped', 'N/A' across that directory returns zero non-comment hits)
- src/lib/monday/worklist/data.ts:245 - the open query is
  `status_done.is.null,status_done.eq.false,item_updated_at.gte.<6 months>`, so a row with
  status_done=false is pulled in regardless of its label
- src/lib/monday/worklist/data.ts:318 - `if (row.statusDone !== true) open++`
- src/components/monday/WorkList.tsx:546 - On-going block is `known.filter(r =>
  r.row.statusDone !== true)`; WorkList.tsx:553 - Completed is `=== true`. The label text
  never enters either test
- LIVE DATA, board 18249582518 "BM - Photo Curation Audits" (last ingested
  2026-09-10T01:18Z): 37 of its 239 assignment rows carry status_text='Not Relevant',
  status_index=10, status_done=FALSE. On the same board status_text='Done' (index 1) stores
  status_done=TRUE, so the ingest and the people/status column pairing are working correctly
  there
- LIVE DATA, decisive control case: the identical label at the identical index 10 stores
  status_done=TRUE on other boards - 462251934 "AAAF - Publishing" (col status29),
  1881594265 "AAAF - General Audits", 1410326510 "BM - SEO & Writing". Same label, same
  index, same code, opposite result, because those Monday columns list index 10 in
  done_colors and the BM Photo Curation column does not
- LIVE DATA, blast radius: 954 assignment rows are counted open while carrying a terminal-
  sounding label - 663 'Not Relevant', 283 'Not Needed', 8 'No edits needed' - spread over
  18 boards and 34 distinct board+status-column pairs
- vercel.json:20-21 - `/api/cron/monday-worklist` runs at minute 15 of hours 1,5,9,13,17,21
  UTC, so even after the Monday fix a status change takes up to about 4 hours to reach the
  page; nothing pushes it sooner (src/lib/monday/webhook-handler.ts never writes
  monday_assignments)
- supabase/migrations/064_monday_worklist.sql:114 - `status_done BOOLEAN` is the only
  doneness field in the schema; there is no per-board or per-label override table anywhere
  (grep for done_label / label_override / treat_as_done across src/ and supabase/ returns
  nothing)

**Why the first verdict was overturned:**

- The mechanism in the evidence checks out line by line: ingest.ts:215
  (`cfg?.done.has(index)`), ingest.ts:71 (`done: new Set(s.done_colors ?? [])`),
  data.ts:245, WorkList.tsx:546/553. Doneness really is read only from Monday's
  `done_colors`, and label text really is never consulted. But "monday-data" is the wrong
  routing of that fact, for four reasons I confirmed in the repo.  (1) The portal already
  answers this exact question elsewhere, with these exact labels.
  src/lib/boards/config.ts:173-175 maps 'Not Relevant' and 'Not Needed' to the semantic
  'skipped', and src/lib/boards/translation.ts:168 counts a skipped stage as done
  (`s.skipped || s.semantic === 'complete' || s.semantic === 'skipped'`); config.ts:74 even
  carries a per-step gate `skipIf: 'Not Needed'`. src/components/PageList.tsx:454 renders a
  whole fourth section, "Not relevant", beside Ready/On-going/Completed. The product has
  both the vocabulary and the precedent; My Work is the one module that lacks it. That is a
  gap in the portal, not bad data in Monday.  (2) The rationale quoted at ingest.ts:14-17,
  that asking a person which label means done on 197 boards is unreasonable, is contradicted
  by the module's own design: src/lib/monday/worklist/steps-review.ts exists precisely to
  make a human confirm 515 guessed step pairings, ordered by how many assignments ride on
  each, and src/app/(app)/settings/monday/actions.ts (`setStepSource`) is the lever. The
  label problem is 34 board+column pairs, an order of magnitude smaller than the review
  surface this module already shipped.  (3) There is no user-reachable remedy of any kind. I
  read the whole admin surface: include/exclude a board, switch a step off, hide a Monday
  account, link a board to a jobcode, toggle the stale rule. There is no per-label or per-
  board doneness override anywhere, no dismiss on a row, and no "sync now" in any component
  (vercel.json:20 is the only trigger, so even a Monday-side change waits up to about 4
  hours with nothing in the UI to force it). The reporter cannot fix this, and neither can a
  portal admin.  (4) The Monday-side "fix" is not clean even if someone performs it 34
  times. `done_colors` is board-wide Monday configuration that also drives Monday's own
  battery/progress for everyone on that board, and once flipped the row lands in Completed
  (WorkList.tsx:553) and is counted as finished work by src/lib/report/data.ts:192,
  waits.ts:96, workload-data.ts:103 and people.ts:102, because `status_done` is the only
  doneness field in the schema (supabase/migrations/064_monday_worklist.sql:114). The portal
  has no third state for "closed without being done" here, though PageList has one.  The
  user-reality detail that seals it: WorkList.tsx:247 and :381 render the status chip, so
  the page literally prints "Not Relevant" on a row it is holding in the On-going block. The
  user is not looking at stale or wrong data; they are looking at the portal displaying the
  answer and declining to use it, at a scale the evidence itself puts at 954 rows over 18
  boards. That belongs in the portal backlog (reuse LABEL_SEMANTICS, or add a per-status-
  column done-label override to the step review screen already in Settings), not closed as
  "go reconfigure Monday".  Caveat: I have no database access here, so the LIVE DATA counts
  are unverified. My disagreement does not depend on them, and every code claim I could
  check was accurate.

**Draft reply, written before verification:**

You are right that it still shows up, and it is a five-second fix, but it has to be made in
Monday rather than in the portal.  My Work does not read the words on the status label. It
asks Monday which labels that specific column counts as finished (the ones in the column's
"done" group), and treats everything else as still open. On the BM - Photo Curation Audits
board, "Done" is registered as a finished label but "Not Relevant" never was, so as far as
Monday is concerned those items are still outstanding and the portal repeats what Monday
says. Proof it is the board and not us: on AAAF - Publishing, AAAF - General Audits and BM -
SEO & Writing the exact same "Not Relevant" label does close the item in My Work, because on
those boards it was set up as a done label.  The fix: on the BM - Photo Curation Audits
board, open the status column settings, edit the labels, and mark "Not Relevant" as a done
label (the same group "Done" is in). Everything already set to Not Relevant will drop off
your list on the next sync, within about four hours. Right now that is 37 rows on that
board.  Worth doing in one sweep while you are at it: the same thing is happening on 17
other boards. Across the account there are 954 steps sitting in people's to-do lists
carrying a label that means "nothing to do here" - 663 "Not Relevant", 283 "Not Needed" and
8 "No edits needed". They are also inflating the open counts and the Late figures in the
Report. If you tell me which boards you own I can list the exact status columns that need
the label marking.

**Work needed:**

Nothing is required in the portal to resolve this complaint; the correct fix is a Monday
configuration change on the affected status columns (34 board+column pairs across 18
boards). Two optional follow-ups worth considering separately: (1) an admin screen listing
status labels that are counted open across many rows but read as terminal, so the Monday
cleanup can be targeted instead of hunted board by board; (2) a per-board-column override
letting an admin declare extra done label indices inside the portal. Note that (2)
contradicts a deliberate design decision recorded at
src/lib/monday/worklist/ingest.ts:16-17, so it should not be built without agreeing to
reverse that choice.

## A6. my-work-filter-sort

**From:** Second reviewer, probably Stephanie Aguirre ("Item 1 - Portal" and "Item 4 - Portal")

**What they wrote:**

> Is there a way to filter the list? Maybe by status or due date? Or to be able to sort
> from soonest due date to latest, or other sorting options?

**Verdict:** portal-gap, upheld; effort small, impact high

My Work has no way to filter by status or due date and no way to sort any column, and the
list you see is ordered by board priority before deadline, so it never reads soonest-first.

**Evidence:**

- src/components/monday/WorkList.tsx:342-353 - the twelve column headers (Item, Parent item,
  Board, Workspace, Assignee, Priority, Step, Status, Due, Time, badge, Monday) are plain
  <div>s with no onClick, no aria-sort and no sort state anywhere in the file
- src/components/monday/WorkList.tsx:112,212,320,359,405,573,626 - the complete list of
  click handlers in the component: Monday link, panel backdrop, block collapse, row open,
  'show the other N', Mine/Everyone, finished-work toggle. None sorts or filters by status
  or due
- src/components/monday/WorkList.tsx:606,614 - the only two dropdowns on the page are Person
  and Team
- src/app/(app)/my-work/page.tsx:38 - searchParams is typed { tab?, person?, team?, done? };
  there is no status or due parameter to pass
- src/lib/monday/worklist/filters.ts - grep for status/due/sort returns zero hits; the file
  is three functions about the person parameter only
- src/components/monday/WorkList.tsx:546-552 - the On-going block is re-sorted client-side
  by PRIORITY_RANK first, and only then by due date, so deadlines order rows within a
  priority band rather than across the list
- src/lib/monday/worklist/data.ts:313 and :82 - priority is 'From the board. Orders the On-
  going block and nothing else', so that dominant sort key is not even a property of the
  task
- src/lib/monday/worklist/data.ts:327-332 - the server does sort by soonest deadline, but
  the client override above replaces that order before it is drawn
- src/components/monday/WorkList.tsx:528-533 - the search haystack does include status text
  and the due badge label ('Late', 'Due today', 'Upcoming', 'Check date')
- src/components/monday/WorkList.tsx:536 - but matching is a raw substring test,
  hay.includes(needle), so searching 'late' also returns every item whose name contains
  'Translate' or 'Latest'
- src/lib/monday/worklist/data.ts:32,260 - UNFILTERED_CAP = 5000 applies when no person or
  team is chosen, so any client-side sort or filter only reorders the rows that were fetched

**Draft reply, written before verification:**

You are right, and you did not miss anything. Right now My Work only lets you narrow by
person, by team, and by whether finished work is shown, plus the free text search box. There
is no status filter, no due date filter, and no way to click a column to sort it. The search
box will partly fake it, typing "late" does pull up the late rows, but it matches any text
on the row, so on our boards it also returns everything with "Translate" in the name. So it
is not a real filter and I would not lean on it. There is a second thing worth knowing,
because it probably explains why the list looks scrambled to you: the ongoing list is
currently ordered by the board's priority first and only then by the due date, and that
priority is set per board rather than per task. So even though the deadlines are sorted,
they are only sorted inside each priority group, which is why it never reads soonest-first
the way you would expect. We should build this. The plan is to add filters for status and
for due state (late, due today, upcoming, no date), make the column headers clickable to
sort, and let you sort straight by due date so the priority grouping stops getting in the
way. One caveat we will call out in the interface: when you are looking at everyone's work
rather than a person or a team, the page only loads the first 5,000 steps, so sorting will
order what is loaded rather than the whole company. Picking a person or a team removes that
limit.

**Work needed:**

Add filter and sort controls to the My Work list, all inside
src/components/monday/WorkList.tsx since the rows are already in the browser: (1) clickable
column headers with a sort state and aria-sort, at minimum for Due, Status, Board and Item,
applied to the On-going and Completed blocks; (2) a Status filter dropdown built from the
distinct statusText values present in the loaded rows, since the portal deliberately does
not maintain a label vocabulary (see src/lib/monday/worklist/ingest.ts:215, doneness comes
from Monday's own done_colors); (3) a Due filter built on the existing DueState tokens in
src/components/monday/tokens.ts:24-31 (Late, Due today, Upcoming, Check date, plus No date);
(4) an explicit "sort by due date" option that bypasses the board-priority-first ordering at
WorkList.tsx:546-552, and a decision on whether priority-first should stay the default at
all given that priority is board-level (src/lib/monday/worklist/data.ts:313); (5) carry the
new controls in the URL via the existing setParam pattern at WorkList.tsx:483-510 so a
filtered view is shareable, which also means widening the searchParams type at
src/app/(app)/my-work/page.tsx:38; (6) surface a note when data.truncated is set that
sorting and filtering only cover the loaded rows (UNFILTERED_CAP 5000 at
src/lib/monday/worklist/data.ts:32). No database, ingest or Monday API change is required.

## A7. my-work-bm-general-audit-late-vs-done

**From:** Second reviewer, probably Stephanie Aguirre ("Item 1 - Portal" and "Item 4 - Portal")

**What they wrote:**

> The first picture is the portal showing the BM General Audit tasks. It shows I have 6
> that are "late". The second picture is Monday showing the same tasks, however mine are
> marked Done and Jeannette's are marked Stuck. Also, B82 is showing as Stuck on the
> portal but Hasn't Started in Monday. And honestly, that's what a lot of my to-do list is
> - tasks that are stuck on other people's steps

**Verdict:** portal-bug, upheld; effort medium, impact high

On BM - General Audits the portal decides "is this finished?" by reading the wrong Monday
column, so finished audits never leave the list and all pick up a Late badge.

**Evidence:**

- src/lib/monday/worklist/steps.ts:101-115 - a step's status column is a guess: take the
  nearest status column to the RIGHT of the people column, else the nearest to the left.
  Nothing verifies the choice.
- src/lib/monday/worklist/steps.ts:14-18 - the code's own comment admits the rule 'cannot
  tell a workflow step from a tag', and says the confirmation screen is what catches it.
- src/lib/monday/worklist/discover.ts:267-283 - every pairing is written to
  monday_board_steps with source: 'guess'.
- LIVE DATA (monday_board_steps, board 2164537299 'BM - General Audits'): people4 'SEO' is
  paired to status2, titled 'Kick-Off'. Its only labels across 127 assignment rows are
  "Let's do this!" (125) and "Hasn't Started Yet" (2). Zero rows have ever been done, 116 of
  them show as late.
- LIVE DATA (same board): people7 'SEO Sup' -> status0 'SEO Review' has 92 of 136 rows done,
  so the board itself is configured fine. Only the SEO step reads a column that never
  closes.
- LIVE DATA (monday_board_steps + monday_assignments, all included boards): 174 of 174 steps
  are still source='guess'; nobody has ever run the review screen. Six of those steps have
  never produced a single done row and account for 572 open rows and 503 of the portal's
  2,929 late rows.
- src/lib/monday/worklist/ingest.ts:209-215 - status_done comes only from the one paired
  status column's done_colors; a step paired to the wrong column can never read as done.
- src/lib/monday/worklist/data.ts:318 - anything that is not exactly done counts as open, so
  those rows sit in On-going forever.
- src/lib/monday/worklist/ingest.ts:217,237 - one board-level deadline ('Audit By') is
  copied onto every person's step row of the item, so all owners are judged against the same
  date.
- src/components/monday/WorkList.tsx:158-176 and 392, src/components/monday/tokens.ts:26-27
  - the Late badge is purely dueDate < today. It never asks whose step is active, and it is
  painted on finished rows too.
- src/app/(app)/settings/monday/actions.ts:96-108 - setStepSource can only mark a step
  guess/confirmed/off. Nothing in the app can re-point a step at the right status column:
  status_col is written only by the seeder (grep of status_col across src).
- LIVE DATA (monday_assignment_events, item 12705666966 'B82'): the SEO Review column really
  did move from "Hasn't Started Yet" to 'Stuck' on 2026-08-30, and the board was synced
  2026-09-10 01:17 UTC, so the portal's 'Stuck' is current Monday data for that column.
- LIVE DATA: the same never-closing pattern on two more boards, 'BM - Publishing' people2
  'Stager' -> status45 'Audit Type' (labels New Page / Technical / Recovery Action, 133
  late) and 'HFA - AI Writing' 'SEO 3' -> 'Design Needs' (label 'Not Needed' on 237 rows,
  249 late).

**Draft reply, written before verification:**

You are right, and it is our fault, not the board's.  On BM - General Audits the portal
decides whether your part is finished by reading the wrong column. It is reading the "Kick-
Off" column (the one that says "Let's do this!") instead of the column you actually mark
done in. That column has never once said done for anybody: 127 rows on it, none finished,
116 of them showing as late. So work you completed never leaves your list, and because the
item's "Audit By" date has passed, every one of those rows gets a Late badge. The supervisor
step on the same board is paired correctly (92 of 136 done), which is why only some of your
audits misbehave. The same mistake is on two other boards, "Audit Type" on BM - Publishing
and "Design Needs" on HFA - AI Writing. Between the three, they produce about 500 of the
late badges in the whole portal.  On B82: the portal is showing the SEO Review column, and
that column really did change from "Hasn't Started Yet" to "Stuck" on 30 August, so that
value is current in Monday. If Monday shows you "Hasn't Started", you are reading a
different column than the one the portal picked for that step. Same root cause: we picked
the wrong column.  On "a lot of my list is stuck on other people's steps": the portal has no
idea whose turn it is. Everyone named on an item gets their own row, and the item's single
deadline is copied onto all of them, so you get flagged late for a stage that is waiting on
somebody else. That part does not exist yet and is worth building.  What we will do: correct
the column pairing on those boards, stop showing "Late" on a step that has no way of being
marked done, and add a way to tell "with me now" from "waiting on someone else". Nothing for
you to change in Monday.

**Work needed:**

1) Data fix, no deploy needed: in /settings, review the six steps that have never produced a
done row and switch off or re-point the three real offenders (BM - General Audits "SEO" ->
Kick-Off, BM - Publishing "Stager" -> Audit Type, HFA - AI Writing "SEO 3" -> Design Needs).
That alone removes 503 false Late rows. Today the only available action is "off", which also
removes legitimate ownership, so this is a stopgap. 2) Code: let a reviewer choose a step's
status column. actions.ts:96-108 can only write `source`; `status_col` is written solely by
the seeder (discover.ts:273). Needs a cached board-columns list (discover fetches columns
but stores none) plus a picker in StepReview. 3) Code: never paint "Late" on a step whose
paired status column has no done label at all, or has never produced a done row. Show "no
completion state" instead. Also stop rendering the due badge on rows the portal itself
counts as finished (WorkList.tsx:392). 4) Code: surface confidence. All 174 included steps
are unreviewed guesses and the list renders a guess exactly like a confirmed pairing. Add an
unverified marker and a link to the review screen. 5) Gap: "whose turn is it".
monday_board_steps.position (workflow order) is already stored and read (data.ts:197) but
never used. Use it to separate "with me now" from "waiting on an earlier step", and stop
judging every owner against a single item-level deadline. 6) Separate, and genuinely a
Monday config issue to raise with board owners: labels like "Not Relevant", "Not Needed" and
"No edits needed" are not in the boards' done_colors, so ingest.ts:215 counts them open
forever.

## A8. my-work-aaaf-publishing-bottleneck

**From:** Second reviewer, probably Stephanie Aguirre ("Item 1 - Portal" and "Item 4 - Portal")

**What they wrote:**

> Not reaching our AAAF 2 pages per week goal, only 7 pages in the pipeline to be
> published, is Wendy holding back because Amy is not sending a lot of pages through?

**Verdict:** already-exists, overturned (the first verdict was portal-gap); effort medium, impact high

The portal already shows the AAAF 2-per-week goal and the count of pages waiting to publish,
but it cannot show where in the pipeline those pages are sitting or who is holding them, so
it cannot answer whether Wendy is waiting on Amy.

**Evidence:**

- supabase/migrations/008_publishing_targets.sql:54 - the AAAF-P English weekly target is
  seeded as exactly 2, so the "2 pages per week goal" is a real, stored portal target, not
  something the team tracks outside the system
- src/lib/boards/config.ts:156 - PUBLISHERS = ['Samuel Manzi', 'Wendy Cacka']; Wendy is one
  of the two publishers the goal counts, via isPublisher() at config.ts:158-161 and the gate
  at src/lib/boards/publishing.ts:321
- src/app/(app)/dashboards/publishing/page.tsx:19-29 - the live Publishing Goals dashboard
  exists and is reachable in the portal (surface 'tools' + canTool('publishing')); it frames
  public/boards.html
- src/lib/boards/publishing.ts:303-360 - computePublishingMetrics turns published items and
  stored targets into pace-vs-target per board and per language, including the totals bar;
  this is the pace half of the question, already built
- public/boards.html:5909-5928 - the Goals KPI row is exactly the numbers quoted: 'Total
  Items - Not Published' with the context line 'in pipeline (excludes Published)', 'Staged
  to Publish', and 'Completed', each split HFA / AAAF
- public/boards.html:6845-6858 - the 'Not Published' (in pipeline) drill-down lists only
  Last update, Item, Language, Group, Project; there is no stage column and no owner column
- public/boards.html:6870-6876 - the 'Staged to Publish' drill-down adds only the Publishing
  column's own status; still no upstream stage and no person
- src/lib/boards/publishing.ts:120-179 - enrichPublishingBoard reads only publishedCol,
  publisherCol, languageCol and the item's group. It never evaluates config.stages, so for a
  publishing board the Staging -> Proofing -> Implementation -> Internal Linking ->
  Publishing chain is never computed at all
- src/lib/boards/config.ts:132-141 - the AAAF Publishing board's five stages carry no
  ownerCol and no ownerFixed, unlike the Translation boards at config.ts:67-71 which name an
  owner per stage; the six people columns are listed at config.ts:141 but never mapped to a
  stage
- src/lib/boards/translation.ts:410 - TRANSLATION_BOARD_IDS excludes every publishingMode
  board, so the one engine that does compute stage + owner + days-in-stage (evalPipeline,
  translation.ts:141-160) is never run on AAAF Publishing
- src/lib/report/waits.ts:85-87 - the Report's 'Where it waits' tab reports only a median
  held time and a delivered count per step name; it has no arrival count and no board
  filter, so it cannot say how many pages reached the Publishing step
- src/lib/report/workload-data.ts:161-182 - flowByPerson is the closest thing that exists:
  steps arriving vs finishing per person per week over 8 weeks. But loadWorkload's filters
  at workload-data.ts:43-46 accept only personId, teamId and period, so it cannot be
  narrowed to the AAAF Publishing board
- src/components/report/ReportTabs.tsx:21 - that Workload tab is level 3 only, and
  src/app/(app)/report/page.tsx:42-44 and :70-72 omit `person` from searchParams entirely,
  so its person dropdown does not actually filter anything
- grep for target/goal across src/lib/monday/worklist and src/components/monday returns only
  src/lib/monday/worklist/steps.ts:75 (a date-column name regex) and
  src/components/monday/WorkList.tsx:108 (target="_blank") - the My Work page has no notion
  of a goal, a target or a pipeline count
- src/app/(app)/my-work/page.tsx:4-7 - a My Work row is a STEP, not an item, so any count
  read off My Work is a count of steps and will not match a count of pages
- src/components/monday/WorkList.tsx:342-353 - the live My Work grid has no board filter, no
  grouping control and no sortable headers; the only filters are free text, person, team and
  the finished-work toggle

**Why the first verdict was overturned:**

- The verdict's core claim, that the portal "cannot show where in the pipeline those pages
  are sitting or who is holding them", is contradicted by the exact surface its own evidence
  calls live and reachable. /dashboards/publishing frames public/boards.html, and that file
  carries its OWN copy of the board map with the AAAF Publishing stages
  (boards.html:3047-3065: Staging, Proofing, Implementation, Internal Linking, Publishing)
  and its own evalPipeline (:4881-4908), which enrichItem runs for EVERY board, publishing
  included (:4936, main = evalPipeline(byId, board.stages)). The result feeds the main items
  table, whose headers are Item, Project, Language, Current stage, Assignee, Time in stage,
  Updated (:2846-2856), rendered at :6249-6330 with a stage chip, people chips and business
  days in stage coloured warn over 5 days and bad over 10. The Goals view CSS hides the
  status chips, metrics row, By person panel and the Status/Stage filter (:1657-1690) but
  never the items table. The board dropdown lists "AAAF - Publishing (N)" (:6340-6354), and
  clicking the "Total Items - Not Published" KPI both opens the modal the evidence quotes
  AND sets quickFilter 'notPublished', which narrows that table to exactly those in-pipeline
  items and scrolls it into view (:7049-7056, :5536-5538, :5578-5581). In production the
  page auto-loads via /api/snapshot with the server-side token, no token pasting
  (:7127-7160). So the seven quoted pages, each with its current stage and how long it has
  sat there, are one click from the number the team quoted.  The evidence's reading of
  src/lib/boards/publishing.ts:120-179 and translation.ts:410 is accurate but applies to the
  React rewrite at /boards-beta, a staging route behind canTool('workload') (boards-
  beta/page.tsx:11-18), not to the live dashboard.  Two more evidence bullets are wrong.
  loadWaits returns three things, not one: steps, boards AND stuck
  (src/lib/report/waits.ts:26, :59-84, :91-112). ReportWaits renders a "By board" panel with
  delivered count, median held and late percent (ReportWaits.tsx:51-92) and a "Sitting
  longest right now" list of open steps with item, who, step and days held (:136-150). That
  tab carries no minLevel, so anyone with the report surface reaches it
  (ReportTabs.tsx:19-25). And My Work does carry board, item, step, status and assignee per
  row (data.ts:280-310), its free text search covers boardName and stepName
  (WorkList.tsx:528-536), the Everyone tab plus person select is open to every user with no
  admin gate (:604-616), picking a person lifts the 5,000 row cap entirely (data.ts:260, cap
  = onlyAccounts ? Infinity : UNFILTERED_CAP), and the publishing boards do produce steps
  (steps.ts:10-12 says the seeding rule "found owners on the two Publishing boards that the
  hand-written config never mapped at all"; monday_boards.included defaults to true,
  migration 064:63).  What survives as a real limit, and it is narrower than "cannot show":
  the AAAF-P stages carry no ownerCol, so currentOwners stays empty for publishing items and
  the Assignee chips are the union of all six people columns rather than the owner of the
  current stage (boards.html:5157-5172); there is no per-stage count KPI, the stage is read
  row by row; and the Translations tab is hidden (:2570-2578, activeView forced to
  'publishing'), so the upstream half of the question, whether Amy is sending fewer pages
  through, is thinner than the downstream half. Unrelated bug found in passing:
  src/app/(app)/report/page.tsx:46 and :71-73 never read sp.person, while
  WorkloadFilters.tsx:59-66 writes ?person=, so the Workload person filter is inert.

- The load-bearing claim ("for a publishing board the Staging -> Proofing -> Implementation
  -> Internal Linking -> Publishing chain is never computed at all") is refuted by the My
  Work module itself. The classifier only inspected the legacy Goals engine
  (src/lib/boards/publishing.ts, src/lib/boards/config.ts) and concluded the portal cannot
  compute stage + owner. My Work has its own, board-agnostic engine that does.  1) Stage +
  owner ARE computed for AAAF Publishing. src/lib/monday/worklist/steps.ts:1-19 pairs each
  people column with the status column to its right, and its own comment says it "found
  owners on the two Publishing boards that the hand-written config never mapped at all"
  (steps.ts:11-12). The first unit test, src/lib/monday/worklist/steps.test.ts:12-27, is
  literally the AAAF Publishing board "in the order the board actually lays them out" and
  asserts Stager->Staging, Reader->Proofing, Implementer->Implementation,
  Publisher->Publishing. Seeded rows default to source 'guess'
  (supabase/migrations/064_monday_worklist.sql:89) and src/lib/monday/worklist/data.ts:286
  skips only source 'off', so guessed steps are live, not shelved. monday_boards.included
  defaults to true (064:63), so the board is in by default.  2) "Who is holding what, and
  for how long" already renders. src/lib/report/waits.ts:95-110 builds a live "stuck" list
  of open steps keyed to item + people column + person, and
  src/components/report/ReportWaits.tsx:136-154 draws it as "Sitting longest right now" with
  columns Item | With | Step | Held (days). The evidence cites waits.ts:85-87 for "only a
  median held time and a delivered count" and stopped ten lines short of the panel that
  answers the question. waits.ts also returns per-board medians and late % (BoardWait), so
  AAAF Publishing appears as its own row.  3) Reachable by a normal user, not admin-only.
  The 'report' surface defaults ON for admin_assistant, team_leader and user
  (src/lib/access/surfaces.ts:66-72), and "Where it waits" carries no minLevel in
  src/components/report/ReportTabs.tsx:15-24 (only Workload is level 3, People level 2). A
  team leader asking about Wendy and Amy is level 2+, so team scope resolves and both people
  are in view.  4) My Work answers the same question a second way. The grid has Board,
  Assignee, Step and Status columns (WorkList.tsx:344-349), the free-text haystack includes
  boardName, who, stepName and statusText (WorkList.tsx:529), and the person filter is
  uncapped: data.ts sets cap = Infinity whenever personId or teamId is set (data.ts:262), so
  filtering to Wendy Cacka or Amy Prindle returns every one of their open steps, complete.
  "No board filter" is true as a dropdown but the search box filters on board name, and the
  5,000-row cap only bites on the unfiltered Everyone view.  5) The pace half was already
  conceded: the 2/week AAAF English target is stored (008_publishing_targets.sql:54),
  computePublishingMetrics turns it into pace-vs-target, and /dashboards/publishing is gated
  by surface 'tools' plus canTool('publishing'). The "7 pages in the pipeline" figure the
  team quotes is almost certainly read off that dashboard's own KPI row.  So every element
  of the question is answerable today on shipped, reachable screens: the goal and the
  pipeline count on Publishing Goals, and which page sits at which stage with whom, and for
  how many days, on Report -> Where it waits and on My Work. What is genuinely missing is a
  join, one drill-down from the "Not Published" KPI to stage + owner, plus a board filter
  and a stuck list capped at 12 (waits.ts:18). That is a convenience and navigation
  shortfall across two existing screens, not the portal being unable to show where pages sit
  or who holds them. Under the skeptic's own test the feature exists, is reachable by a
  normal user, and does answer what they asked, so already-exists is the honest call.  One
  real defect the evidence surfaced but mislabelled: src/app/(app)/report/page.tsx:44 types
  searchParams as { tab, scope, period, team } with no 'person', while
  src/components/report/WorkloadFilters.tsx:28,57-58 reads and writes ?person=. The Workload
  tab's person dropdown therefore changes the URL and filters nothing. That is a portal-bug
  worth filing separately; it does not change this item's classification, since the Workload
  tab is level 3 and is not where this question gets answered.

- The verdict's central claim ("it cannot show where in the pipeline those pages are
  sitting") is false on the page the team is actually looking at. Every "cannot" cite in the
  evidence points at the wrong file.  1. Wrong file. src/lib/boards/publishing.ts powers
  /boards-beta, the unshipped React rewrite. The live dashboard is
  src/app/(app)/dashboards/publishing/page.tsx:26-31, which is nothing but `<iframe
  src="/boards.html">`; the file's own comment says "the native React rewrite lives at
  /boards-beta". public/boards.html carries its own board config and its own pipeline
  engine, and that is what renders. So "enrichPublishingBoard never evaluates config.stages"
  is true and irrelevant.  2. boards.html DOES compute the stage chain for AAAF Publishing.
  public/boards.html:3047-3065 repeats the same five stages (Staging, Proofing,
  Implementation, Internal Linking, Publishing) for board 462251934, and enrichItem calls
  `evalPipeline(byId, board.stages)` unconditionally at public/boards.html:4936, with no
  publishingMode branch. Every AAAF-P item therefore gets currentStage (first non-complete
  stage), stageBizDays (time in stage) and a full timeline of stage transitions with per-hop
  business-day durations (public/boards.html:5182-5205). getBoardColumnIds (4587-4596) and
  getBoardLogRelevantColumnIds (4610-4618) both include the publishing stage columns, so the
  data to do it is actually fetched.  3. It is on screen, in the Goals view, not hidden. The
  items table header at public/boards.html:2848-2856 is: Item, Project, Language, **Current
  stage**, **Assignee**, **Time in stage**, Updated. The `body.view-publishing` CSS block
  (public/boards.html:1655-1690) hides #statusChartCard, .status-chips-row, .metrics-row,
  #byPersonHeader, #peopleGrid and #filterStatusGroup. It does not hide the items table.
  renderAll() calls renderTable(tableFiltered) in both views (public/boards.html:5615), and
  renderTable emits the stage chip and the biz-days cell at 6321-6326.  4. The path from the
  exact number they quoted to the answer is one click. The KPI click handler at
  public/boards.html:7049-7055 both opens the popup AND calls
  setQuickFilter('notPublished'), and setQuickFilter re-renders then scrolls .items-table-
  wrap into view (5578-5583). So clicking the "7 ... in pipeline (excludes Published)" card
  lands the user on those exact 7 rows, each showing which of the five stages it is sitting
  in and for how many business days. Clicking a row opens the modal (6452-6480): Current
  stage, Time in this stage, Assignees, and the whole Stage history.  5. The narrowing they
  need exists too. filterBoard selects AAAF Publishing alone, and filterPerson is relabeled
  "Publisher" in Goals view (CSS .lbl-goals, 1666-1669) and matches only against
  it.publishers, the people29 publisher column (filterItems, 5503-5509). Wendy Cacka is one
  of the two options. Filter Board = AAAF Publishing, Publisher = Wendy, read the Current
  stage column: if none of the 7 is at Publishing, Wendy is provably not the constraint.
  That is the decision the team asked for.  Reachability is not in doubt: "Total Items - Not
  Published" and "in pipeline (excludes Published)" are verbatim the strings at
  public/boards.html:5910-5913, so they are already on this page, and the table is directly
  beneath the KPI row. In production the Monday token lives server-side
  (public/boards.html:7130-7142), so no token paste is required.  What genuinely does not
  exist is smaller than described: the AAAF-P stages carry no ownerCol/ownerFixed
  (src/lib/boards/config.ts:135-139 and public/boards.html:3049-3054), so currentOwners is
  empty for publishing items and the modal's "Waiting on" block never renders for a page.
  The Assignee column still shows the union of all six people columns via
  collectPeopleNames, collapsed to "first name +N". So the portal says which stage and who
  is on the card, but never "Proofing is Amy's". Naming Amy as the upstream constraint is
  also a Monday-data question first: if she is not filled into the Staging or Proofing
  person column on board 462251934, no portal change surfaces her, and "Amy Marsh, SEO
  Specialist" appears in this repo only as design fixture data (src/app/design-check/my-
  team/page.tsx:27), never in the board config.  Finally, the verdict was filed against the
  My Work module, but nothing in the feedback is about My Work. The evidence's My Work
  critique (a row is a STEP, no board filter, no notion of a goal) answers a question nobody
  asked; Publishing Goals is a different module behind a different tool grant
  (canTool('publishing'), src/lib/access/tools.ts:36).

**Draft reply, written before verification:**

> **DO NOT SEND.** Says the portal cannot show which stage each page is in. The live Publishing Goals dashboard does show Current stage and Time in stage.

Two of the three things you mention are already in the portal, just not on My Work. The AAAF
goal of 2 pages a week is stored in the portal and the Publishing Goals dashboard (Tools and
Dashboards, Publishing Goals) shows published-versus-target for AAAF and HFA by language,
for whatever period you pick. The "7 in the pipeline" number is the same dashboard's KPI
row, "Total Items - Not Published", and clicking it lists the items.  The third part,
whether Wendy is held up because Amy is not sending pages through, the portal genuinely
cannot answer today. When you click into those 7 items, the list shows the item name,
language, group and last update. It does not show which stage each one is at, and it does
not show who is holding it. For the AAAF Publishing board we only track the final Publishing
column: the earlier stages, Staging, Proofing, Implementation and Internal Linking, are not
read at all, and nobody is recorded as the owner of any of them. So there is no way to see
that, say, 5 of the 7 are still sitting in Proofing upstream of Wendy rather than waiting on
her.  One caution: if you counted the 7 on the My Work page rather than the dashboard, that
number is not pages. My Work lists one row per step, so a single page can appear several
times.  We should build this. It is a fair ask and it is the difference between a
conversation with the right person and a conversation with the wrong one. Before we can, we
need about fifteen minutes with someone who knows the AAAF Publishing board, to point out
which people column belongs to which stage. Once that is settled the pipeline engine we
already use on the Translations boards can run on Publishing too.

**Work needed:**

A "where the pipeline is sitting" view for the two Publishing boards, on the Publishing
Goals dashboard beside the existing pace-vs-target card.  1. Map stage to owner in config.
src/lib/boards/config.ts:113-149: the HFA-P and AAAF-P stage lists have no ownerCol or
ownerFixed, while the Translation boards do (config.ts:67-71). The six people columns are
listed at config.ts:141 but unassigned. This needs a short audit of the real Monday board
with whoever owns it, since the code cannot tell us which column belongs to Proofing versus
Implementation. This is the only blocking unknown.  2. Run the existing pipeline engine on
publishing boards. evalPipeline and enrichTranslationBoard
(src/lib/boards/translation.ts:141-160, :220-340) already compute current stage, owners,
stage start and days in stage. Today they are fenced off from publishing boards by
TRANSLATION_BOARD_IDS (translation.ts:410) and by enrichPublishingBoard ignoring
config.stages (publishing.ts:120-179). Either widen the enrichment or call both engines per
board.  3. Add stage and owner columns to the two KPI drill-downs
(public/boards.html:6845-6876), so clicking "7 in pipeline" says where each of the 7 is and
who has it.  4. Add a per-stage panel: count of not-yet-published items at each stage, who
holds them, and the oldest wait at each stage. That is what turns "we are short of 2 a week"
into "4 are parked at Proofing".  5. Optional second step, arrivals versus the target: pages
reaching the Publishing stage per week against the 2 a week. src/lib/report/workload-
data.ts:161-182 already computes arriving-versus-finishing per person per week from the
change log, but loadWorkload (workload-data.ts:43-46) has no board filter, so this needs
either a board-scoped variant or a small dedicated read of monday_assignment_events for the
AAAF-P Publishing step.  Placement decision to make first: public/boards.html is the live
dashboard, the native rewrite sits at /boards-beta pending the B6 cutover
(src/lib/tickets/data.ts:230). Building this twice would be waste, so it should land in
whichever one survives.  Not to do: put this on My Work. My Work is deliberately one row per
step for the signed-in person (src/app/(app)/my-work/page.tsx:4-7) and has no board filter;
a publishing goal does not belong there.

## The plan

### The risk that shapes the order

Every lever in this plan hides work, and this module has no history of hiding things
reversibly. The stale-board rule is the warning sign already in the codebase: it ships
switched off, its label promises to bring boards back when they are used again, and its
return path provably cannot fire, because a board it hides is dropped from the ingest queue
and its activity stamp can only get older. If we ship an "active by default" view, an age
cutoff on open rows, or a done-label override with that same one-way shape, we trade a list
nobody trusts because it is too long for a list nobody trusts because things disappear from
it, which is worse and far harder to detect: a missing row generates no complaint until
somebody misses a deadline. So every narrowing must be visible on the page as a permanent
count of what is hidden, reversible in one click, never applied silently by the server as a
default nobody chose, and never applied to My Work and the Report independently. Those two
already read the same tables with different exclusions, and they will contradict each other
on the same person the moment we add more rules to one of them.

### Phase 1: stop the list lying

*1 to 2 days, no schema change, no Monday change*

Six small diffs, no schema change, and they hit the two loudest reports directly. The Monday
link is not missing because of window width, it is dead for every non-admin, so the whole
team sees a column of dashes. The counters, the freshness footer and the one warning banner
all report numbers that are wrong by construction. Nothing here changes what work is shown,
so nothing can go missing.

- Read monday_account_slug with createAdminClient() and pass it into loadWorklist.
  src/lib/monday/worklist/data.ts:165-167 reads it with the RLS-bound user client handed
  over at src/app/(app)/my-work/page.tsx:87, and migration
  052_app_settings_admin_only.sql:47 restricts app_settings SELECT to is_admin, so for every
  non-admin the slug is null, itemUrl returns null on its first line, and every row renders
  a dash. The history panel's link is gated on the same value, so both Monday links vanish
  together. Settings already uses this exact pattern at src/app/(app)/settings/page.tsx:153.
  Note the four Report loaders call loadWorklist with the same user client, so fix it inside
  loadWorklist rather than at one call site. Add a data.test.ts case where app_settings
  returns nothing and assert the row still has a url, since the current fake client
  hardcodes a slug and no test asserts url at all.
- Count what is rendered, not what was fetched: data.ts:342 returns total: rows.length,
  taken before the loop drops rows for off steps, so both "N open, M in view" and "Showing
  the first N of M steps" overstate the list. Return the length of the array the page
  actually receives.
- Make switching a step off take effect now: setStepSource(..., 'off') at
  src/app/(app)/settings/monday/actions.ts:96-108 should also delete that people column's
  rows from monday_assignments. Today those rows clear only at that board's next pull, and
  on a board whose every step is off they never clear at all, because ingestBoard returns at
  ingest.ts:160-161 before its own delete.
- Fix the freshness line: compute oldestSyncAt over boards that are genuinely in the ingest
  queue (included AND holding at least one step not set to off), and return a separate count
  of included boards that have never been pulled. Today a board that left the queue pins the
  footer at "last refreshed 340 days ago" forever while describing rows that are not on the
  page, and a board that has never been read is silently omitted from the stamp entirely.
- Give the pull a failure state, copying the pattern already shipped next door:
  src/components/tsheets/settings/SyncStatus.tsx:8-12 takes a failed prop and prints "Import
  failed, data from X" instead of counting up in neutral grey. Also fix PullInfo's server-
  rendered fallback (PullInfo.tsx:66-67), which prints "Work pulled from Monday every 4
  hours" with the staleness half removed, so the first paint keeps the reassuring half and
  drops the qualifying one.
- Replace the dead unlinked-work banner at WorkList.tsx:663. It is gated on team &&
  data.unlinked > 0, but a team filter is built from monday_user_links, so every row read
  back is by definition linked and the count is 0 whenever the banner is allowed to render.
  The only on-page signal that a team view is hiding real work can never appear. Compute the
  count from monday_users minus monday_user_links (both small tables) and show it whenever a
  person or team filter is on.
- Swap the two row actions, as asked: make the row itself an anchor to the Monday item,
  which also makes it keyboard focusable and cmd-clickable (the current div is neither),
  move the history to its own small button beside it with stopPropagation, fall back to
  opening the history when the row has no url, and pin the last column sticky so it stops
  scrolling out of view below about 1292px.

### Phase 2: give the person on the page real levers

*about a week, no schema change, no Monday change*

Two reviewers said the list is too long, and the complete control set today is a search box,
Mine/Everyone, person, team and a finished-work toggle. Nothing narrows open work, no header
sorts, and the fields that would do the narrowing are already stored, already carried onto
every row, and rendered nowhere. This is where the list actually gets shorter for everybody,
without anyone waiting on a board owner.

- Order the capped read by meaning instead of by row id. data.ts:265 pages .order('id') and
  cuts at 5,000, and because each pull replaces a board's rows wholesale the id order is
  really "time since that board was last pulled", so the Everyone window rotates through the
  account and has no relation to what is late or open. Order by status_done then due_date,
  using the index built for exactly this at migration 067:31-33. This also removes the
  perverse effect where clicking "Finished work: all of it" pushes open steps off the page.
- Filters over the loaded rows, all carried in the URL through the existing setParam
  (WorkList.tsx:483-510), widening the searchParams type at my-work/page.tsx:38: status
  label, board, workspace, Monday group, due window (overdue, next 7, next 30, no date) and
  last-touched age for OPEN rows. group_title and itemUpdatedAt are already ingested,
  already stored and already copied onto every row object, and neither is rendered, searched
  or filtered on.
- Sortable column headers with aria-sort on Due, Status, Board, Item and Age. The twelve
  headers at WorkList.tsx:342-353 are plain divs with no click handler and no sort state
  anywhere in the file.
- An explicit "sort by due date" that bypasses the board-priority-first client sort at
  WorkList.tsx:546-552. Priority is a property of the BOARD, not the task, so it is the
  outer sort key and the date terms are never reached across bands: one board set to high
  with 200 or more open steps fills the entire first screen, and no late row from anywhere
  else appears until someone clicks "Show the other N".
- A narrow default view (dated inside the horizon, or touched recently) with a one-click
  widener mirroring the finished-work toggle, plus a permanent line stating how many rows
  the filters are hiding. The default must never hide silently and must be reversible in one
  click.
- Put priority into the search haystack at WorkList.tsx:528. The chip prints HIGH, MEDIUM or
  LOW on every row and typing "high" matches nothing, which breaks the rule written in the
  comment directly above the haystack.
- Reset a Block's "show all" flag when the row set changes (WorkList.tsx:315) and memoise
  the four derived arrays. Today every keystroke, every hover on the disabled Mine button
  and every row click re-partitions and re-sorts up to 5,000 rows, and once someone expands
  a long block it stays expanded through every later filter change with no way back.
- Bound the person and team path, or report it honestly. cap is Infinity whenever a person
  or team is set (data.ts:260), so a fifteen-person team is an unbounded read serialised
  whole into the page, and truncated can never become true on that branch, which means the
  honest "showing the first N of M" banner cannot fire on the one path that has no ceiling.

### Phase 3: give doneness a repair path

*1 to 2 weeks, two small tables, and one deliberate reversal of a documented design decision*

This is the half that makes the list disagree with Monday. Between 942 and 954 open rows
across 17 to 18 boards carry a plainly terminal label, all 174 steps are still unreviewed
guesses, and six steps have never produced a single done row while accounting for 572 open
rows and 503 of the 2,929 late rows. Today the portal cannot say "this label ends the step"
and cannot re-point a step at the right status column, so the only lever is deleting the
step for everyone, which also deletes the real work on it.

- Store what we already fetch and throw away: a monday_board_columns table (id, title, type)
  written from b.columns during syncMondayBoards, plus the labels and done indices the
  ingest already parses out of settings_str per board and status column. Both are free reads
  on the existing queries and both are prerequisites for everything else in this phase.
- A per-column done-label override consulted at ingest.ts:215, so an admin can declare
  inside the portal that Not Relevant, No edits needed, Not Needed or Cancelled end a step
  on a given board column. This deliberately reverses the refusal recorded at
  ingest.ts:14-17, so take it as a decision, not a patch: the alternative is asking board
  owners to change done_colors on about 34 board and column pairs, which also changes those
  boards' Monday batteries and progress bars for everyone on them.
- A re-pair control in step review: setStepStatusCol(boardId, peopleCol, statusCol) plus a
  picker fed by the stored columns. status_col is written today only by the seeder at
  discover.ts:273, and the review screen offers only "It is a step" and "Not a step", so a
  wrong pairing is wrong forever or removed from everybody's list. BM - General Audits is
  the worked example: its SEO step is paired to a column called Kick-Off whose only labels
  are "Let's do this!" and "Hasn't Started Yet", so zero of its 127 rows have ever been done
  and 116 show as late.
- Surface the steps that can never complete as their own bucket at the top of the review
  queue. loadStepsForReview does not even select status_col, so an unpaired step (status_col
  null, which pins status_done at null and the row in On-going forever, whatever anyone does
  in Monday) is invisible to the reviewer, and looksSuspicious cannot catch it because an
  unpaired step is named after its people column. Persist via ('right', 'left', 'none'),
  computed at steps.ts:45-46 for exactly this purpose and never written to the table.
- Re-validate a confirmed step on every discovery instead of skipping it (discover.ts:268).
  A confirmed step is frozen against Monday, so a column reorder can leave two owners
  sharing one status cell (which steps.test.ts:57-61 claims is impossible) and a deleted
  column leaves the step pointing at a dead id, permanently open with no in-portal fix. Keep
  the human's decision, but flag the step for review when its column vanishes or is claimed
  by another step.
- Fix the auto-hide rule's return half before recommending anyone switch it on. The ingest
  queue is .eq('included', true) at ingest.ts:299 and last_activity_at is written only
  inside that loop at ingest.ts:267, so a board the rule hides can never refresh its stamp
  and staleSweep's bring-back branch can never fire for it, while the toggle's own label
  promises "bring them back when used". Either heartbeat hidden boards cheaply or take the
  promise off the label.
- A label-drift report: open rows grouped by board, status column and label, so the Monday
  cleanup can be targeted instead of hunted board by board. The same label at the same index
  is already done on some boards and open on others, and nothing anywhere in the portal
  shows which boards count which labels as finished.

### Phase 4: stop marking one person late for someone else's step

*about two weeks, schema change plus matching Report work*

One deadline is read once per item from a single board-level column and copied onto every
person's row of that item, so three owners of one overdue item are all badged Late against
the same date, and the badge is painted even on rows the portal itself counts as finished.
The Report repeats the same misattribution rather than correcting it, so both have to move
together.

- Per-step deadline: a date column on monday_board_steps, seeded by pairing the nearest date
  column the way nearestStatus already pairs statuses, reviewable beside the step review,
  and read per step in the ingest instead of the single board.date_col at ingest.ts:217.
  Keep the board date as the fallback so nothing regresses. The code's own comment already
  names the boards that carry Audit By, Adapt By, Plan By, Create By and GPT By, of which
  exactly one is ever used.
- Carry position onto WorkRow. It is stored, selected and then dropped before the row is
  built, so nothing today can say which step is the one actually holding an item up. Compute
  the lowest-position open step per item and, when that step is not the viewer's, badge the
  row as waiting on another step rather than as their lateness.
- Never paint the due badge on a row the portal itself counts as finished
  (WorkList.tsx:392), and never paint Late on a step whose paired status column has no done
  label at all: show "no completion state" instead, which is the truthful statement and also
  routes the board to the phase 3 queue.
- Show dueLabel in the grid. It exists at data.ts:72-73 precisely so a wrong deadline can be
  spotted, and it renders only inside the history modal, so a contractual Deadline and a
  soft Delivery Target are the same red badge on screen and checking which is which costs
  one modal open and a live Monday round trip per row.
- Update the Report in the same change. report/spans.ts, report/data.ts and report/people.ts
  all read the same item-level date, and isLate is hand-copied in two places rather than
  shared, so the two screens will contradict each other on the same person the moment the
  page changes.

### Phase 5: make the pull dependable and let the Report admit its age

*about a week for the ingest work, plus about a week for Report parity and the age signals*

One bad board aborts the whole chain, returns 500, does not fire the next hop, and because
that board never gets its timestamp it is first in the oldest-first queue again next firing,
so it can block a pass indefinitely. Nothing anywhere records that a run failed. Meanwhile
the Report shows no data age at all, and the copies that leave the building (PDF and CSV)
stamp the print or download date, which every reader will take for the data date.

- try/catch per board in ingestSlice (ingest.ts:311-314) so one failure does not stop the
  chain, plus a runs table recording hops, boards done, boards failed and the error text.
  Today the only output of a firing is its HTTP response body, so a chain that dies at hop 3
  leaves no trace in the database.
- Retry, backoff and a timeout in gql (discover.ts:19-29), which today throws on the first
  GraphQL error with one query per board plus one per 250 items against Monday's per-minute
  complexity limits. Page the monday_board_steps reads (ingest.ts:305, discover.ts:258) like
  every other large read in the module: if that read is ever capped, boards silently vanish
  from the ingest queue and confirmed steps get re-seeded as guesses.
- Make the cron guard unconditional (route.ts:48-51 is if (secret && ...), so an environment
  with no CRON_SECRET is publicly callable), and stop two chains overlapping: the admin
  trigger fires a second walk of the same queue with no check, and delete-then-plain-insert
  against UNIQUE (item_id, people_col, monday_user_id) then throws 23505 and leaves a board
  half written, with its old timestamp intact so it repeats. Upsert, or put board_id in the
  key.
- Deactivate boards that have disappeared from Monday. allBoards filters to state active and
  the sync only upserts, so a board archived or deleted in Monday keeps its row, keeps
  included = true and stays in the queue forever, and every one of its rows in My Work
  clicks through to a history panel that says the item is genuinely empty.
- Give the Report the exclusions My Work already has. loadSpans, loadOpenSince and waits.ts
  apply no board filter, no hidden-account filter and no off-step filter, so Delivered, On
  time, Median held and Where it waits all count history from boards nobody is allowed to
  see and from columns an admin explicitly identified as not work. Turning a step off is
  currently permanent for My Work and a no-op for the Report.
- Wire the staleness banner that was built and never rendered (ReportNotices.tsx:49-62
  exists only in the design preview while its two siblings went to production), put the pull
  time on the print/PDF header instead of only the print date, and add a data-age line to
  the four CSV builders, whose only date today is the download date in the filename.
- Fix the Report's inert person filter: the page never reads sp.person while WorkloadFilters
  writes it, so choosing a name filters nothing, the table still lists everyone, and the
  note underneath still says how many people are in scope.

## Only the Monday boards can fix these

- Terminal labels that were never registered as done on their own status column. Between 942
  and 954 open rows across 17 to 18 boards and about 34 board-and-column pairs carry Not
  Relevant, Not Needed or No edits needed while that column's done list does not include the
  label. The same label at the same index already closes rows on other boards, which is the
  proof it is per-column configuration and not our code. Until the phase 3 override ships,
  only a board owner can change it, and changing it also changes that board's Monday
  batteries and progress bars for everyone on it.
- The AAAF On-page SEO skip automation. It has fired on roughly a third of the non-English
  pages (of 518, only 191 are Not Relevant), and separately 95 English items are sitting on
  Not Relevant when they should not be. That is an automation and board data, and no portal
  change corrects it.
- Boards nobody uses any more. Archiving or deleting a board in Monday does clear its rows
  from the portal at the next pull, because each pull replaces that board's assignments
  wholesale. Archiving there is cheaper and more honest than hiding it here, and it is the
  only route that also stops us reading the board six times a day.
- Items parked in a Done or Archive group but never given a done label. Once phase 2 ships
  you will be able to filter them out by group, but the item is still telling Monday it is
  open, and any count anyone takes from Monday itself will keep including them.
- Boards with an owner column and no stage column beside it. Phase 3 lets us re-point a step
  at the right status column, but where the board has no status column for that owner at
  all, only the board can add one. Until then those rows can never read as done no matter
  what anyone does.
- Deadlines held in a column the portal cannot recognise. Only date or timeline columns
  whose title ends in "by" or contains deadline, due, target or delivery are read as a
  deadline, and there is deliberately no fallback, because the fallback used to manufacture
  overdue work out of Published On and Item Creation. A board whose deadline column is named
  something else has to be renamed there, or its rows will keep showing no date.
- Assignees who have left, and Monday accounts whose email does not match any Directory
  email. Account to person linking is by email only, on purpose, so a mismatch is fixed
  either on the Monday account or by hand at /admin/monday-links.
- Which people column belongs to which publishing stage on the AAAF and HFA publishing
  boards. The code cannot infer it, so naming the owner of the current stage on Publishing
  Goals needs that mapping from whoever owns those boards before we can build anything on
  it.

## The independent audit, 51 findings

These are agent findings that were not individually re-verified by hand.

### high (17)

- **A people column marked 'off' still swallows the status column, leaving the real owner
  permanently unfinishable**
  `seedSteps` claims status columns strictly left to right into a `taken` set (steps.ts:94,
  :114) and `nearestStatus` refuses to reach past another people column (steps.ts:83-90). It
  has no knowledge of `monday_board_steps.source`, so a column an admin already switched off
  still consumes its neighbour. I verified this against the migration's own canonical
  example of a non-step column (064_monday_worklist.sql:81 names 'Owner, Watcher, Requested
  by'):    seedSteps([p('pe0','Requested by'), s('st1','Status'), p('pe1','Writer')])   =>
  [{peopleCol:'pe0', statusCol:'st1', via:'right'},       {peopleCol:'pe1', statusCol:null,
  via:'none'}]  Writer gets `statusCol: null` (steps.ts:110-112). Downstream that is fatal,
  not cosmetic: ingest.ts:215 `const done = st.status_col && index != null ?
  cfg?.done.has(index) ?? false : null` yields **null forever**; data.ts:245 admits every
  null row regardless of age (`status_done.is.null`), data.ts:318 counts `!== true` as open,
  WorkList.tsx:546 files it under On-going, and report/data.ts:192-193 counts it in 'Late
  now' whenever the board-level due date is past. The person can never make the row go away,
  because nothing they do in Monday changes a column the step is not reading.  Switching
  'Requested by' off does not release `st1` either: `seedSteps` is recomputed from Monday's
  raw columns on every discovery and `taken` is rebuilt identically each time, while the off
  row is skipped only at write time (discover.ts:268). There is no repair path at all:
  `setStepSource` writes `source` and nothing else (settings/monday/actions.ts:101-104),
  discover.ts:283 is the only other writer to the table and it never touches a reviewed row,
  and the review screen cannot even display the problem because `loadStepsForReview` does
  not select `status_col` (steps-review.ts:47) and `looksSuspicious` only matches generic
  titles like 'Owner'/'Status' (steps-review.ts:39) - an unpaired step is named after its
  people column ('Writer', 'Translator'), which never matches.
  `src/lib/monday/worklist/steps.ts:94,110-114 + src/lib/monday/worklist/ingest.ts:215 + src/lib/monday/worklist/data.ts:245,318 + src/lib/monday/worklist/steps-review.ts:47`

- **A confirmed step is frozen against Monday forever, so a board reorder makes two owners
  share one status column**
  `discover.ts:268` skips every row whose `source !== 'guess'`, which means `status_col`,
  `step_name`, `people_title` and `position` on a confirmed step are never written again.
  The `taken` guard in steps.ts only holds inside one seeding pass, so it cannot see what
  the confirmed rows still own. Verified:    BEFORE [A, Review, B, Publish] -> seedSteps:
  a->s1, b->s2   (A confirmed on s1)   AFTER  [A, B, Review, Publish] -> seedSteps: a->null,
  b->s1  After someone drags the people columns together in Monday, B's row is still a guess
  so it is upserted with `status_col = s1` (discover.ts:273). A's row is skipped, so A keeps
  `status_col = s1` in the database. Nothing prevents this: `monday_board_steps` is keyed
  `PRIMARY KEY (board_id, people_col)` with no uniqueness on `status_col`
  (064_monday_worklist.sql:82-92), and ingest.ts:164 de-duplicates `statusCols` and then
  hands both steps the same cell via `byCol.get(st.status_col)` (ingest.ts:209). Both people
  are now marked done, on time or late by one status cell that only one of them controls.
  This is exactly what steps.test.ts:57-61 ('never gives one status to two owners') claims
  is impossible.  The same freeze produces the finding-1 failure on a step a human
  explicitly approved: if the paired status column is deleted or replaced in Monday,
  `status_col` keeps pointing at a dead id, `column_values(ids:)` returns nothing for it,
  `index` stays null and `status_done` becomes null for every row on that step
  (ingest.ts:211-215) - permanently open, with no in-portal fix.
  `src/lib/monday/worklist/discover.ts:260-263,268,273 + src/lib/monday/worklist/steps.ts:94,114 + src/lib/monday/worklist/ingest.ts:164,209`

- **Every Report number counts work from boards and columns that were deliberately switched
  off**
  `loadWorklist` enforces three exclusions: included boards only (`out.in('board_id',
  includedBoards)`, data.ts:239), hidden Monday accounts dropped (data.ts:240), and steps
  whose column source is 'off' dropped (`if (st?.source === 'off') continue`, data.ts:286).
  `setStepSource`'s own docstring says an off column means 'the rows under it stop appearing
  on anybody's list' (settings/monday/actions.ts:93-94).  The change-log readers enforce
  none of them. `loadSpans` (report/data.ts:156-163) and `loadOpenSince`
  (report/data.ts:275-282) select from `monday_assignment_events` filtered only by
  `occurred_at` and, when a scope is set, `monday_user_id`. There is no board join, no step-
  source join and no hidden-account exclusion; when the viewer is unscoped,
  `accountsInScope` returns null (report/data.ts:91) and even the account filter is skipped.
  So Delivered, On time, Median held, the weekly chart and the held-per-person panel
  (report/data.ts:195-197, 236-259) all count history from a 'Requested by' column an admin
  correctly identified as not-work, and from boards nobody is allowed to see.
  `waits.ts:41-46` selects `monday_board_steps` with no source filter either, so that
  column's `step_name` is rendered as a genuine stage in 'Where it waits'. And there is no
  cleanup: grepping `monday_assignment_events` across src and supabase/migrations finds one
  writer (ingest.ts:139) and five readers - no DELETE anywhere. Turning a step off is
  permanent for My Work and a no-op for the Report.
  `src/lib/report/data.ts:156-163,275-282,91 + src/lib/report/waits.ts:41-46 (contrast src/lib/monday/worklist/data.ts:239,240,286)`

- **The first ingest of a board manufactures a hand-off date from item_updated_at, the exact
  field the Report says it refuses to use**
  `diffAssignments` dates every event with `const at = (r) => r.item_updated_at || now`
  (changes.ts:57), and a row with no prior counterpart becomes an `assigned` event at that
  stamp (changes.ts:73-77). On the first ingest of a board `recordChanges` reads an empty
  `before` (ingest.ts:125-129), so **every existing assignment on the board is emitted as a
  hand-off dated by the item's last-modified time** - which for an item last touched in 2019
  is 2019.  `loadOpenSince` stores that verbatim (`open.set(k, e.occurred_at)`,
  report/data.ts:293) and two panels render it as fact: 'Sitting longest right now' prints a
  named person and `heldDays` computed straight off it (waits.ts:99-108, heading at
  ReportWaits.tsx:136), and 'Open work, by age' buckets on the same number
  (report/data.ts:227-233).  This directly contradicts the rationale written above the call
  site: report/data.ts:222-226 says 'item_updated_at sits right there in the snapshot and
  means something else entirely: the last time anyone touched the item, by anyone, for any
  reason. Open work that predates the log has no hand-off yet and is left out rather than
  dated from the wrong thing.' The log does not leave it out - it back-dates it from
  precisely that field, and the number is attributed to a person by name. An item bumped
  last week for an unrelated column edit makes a three-year-old assignment read as seven
  days old; an untouched one makes a fresh assignment read as three years stuck.
  `src/lib/monday/worklist/changes.ts:57,73-77 + src/lib/report/data.ts:222-226,293 + src/lib/report/waits.ts:99-108`

- **A login with no Directory person is shown the entire company's work list by default**
  `resolvePersonFilter` returns `selfPersonId` when the `person` param is absent
  (filters.ts:29). When the signed-in user resolves to no directory person,
  `loadCurrentPerson` returns null (current-person.ts:83) and `selfPersonId` is null (my-
  work/page.tsx:96), so `personId` is null. With no `team` param either, `loadWorklist`
  leaves `onlyAccounts` at null (data.ts:147-154) and `applyFilters` applies no
  `monday_user_id` restriction at all (data.ts:241). The page renders the first 5,000
  assignments across every included board - everybody's work.  There is no database
  backstop: 064_monday_worklist.sql:141 creates `%I_read ... FOR SELECT TO authenticated
  USING (true)` for `monday_assignments` and its siblings, and the `my-work` surface is
  `defaults: ON` for every tier (access/surfaces.ts, 'my-work' entry), with the page's own
  header noting it is 'Available to any signed-in user'.  The UI already knows this state
  and mislabels it: the Mine button is disabled with a tooltip reading 'Your login is not
  linked to anyone in the Directory yet, so there is no "mine" to filter by'
  (WorkList.tsx:568, :591-597) while the list underneath it is Everyone's, under a heading
  that says 'Every step assigned to you across Monday' (page.tsx:53). The page comment at
  page.tsx:90-94 identifies this exact failure ('asked to filter by nobody, which is the
  same as everybody') and treats the email fallback as the fix, but the fallback only
  shrinks the population that hits it - a contractor login, a new hire whose people row
  carries a different address, or any service account still lands on the unfiltered view.
  `src/lib/monday/worklist/filters.ts:29 + src/app/(app)/my-work/page.tsx:96-101 + src/lib/monday/worklist/data.ts:147-154,241 + supabase/migrations/064_monday_worklist.sql:141`

- **The Report shows no data age at all, and the banner built for it was never wired**
  My Work carries a freshness footer (src/components/monday/WorkList.tsx:646-654 renders
  PullInfo with data.oldestSyncAt). The Report, reached from My Work's own view switch
  (src/components/monday/WorkViewSwitch.tsx:49-53), reads the same Monday snapshot and says
  nothing about its age anywhere.  A component exists for exactly this: `StaleSnapshot` at
  src/components/report/ReportNotices.tsx:49-62, documented at :41-48 as "6.4: the snapshot
  is behind", rendering "Open and late counts are from the Monday pull at {at} ({zone}), {N}
  hours ago. Delivered and held time are unaffected." Its only render site in the repo is
  the design preview, src/app/design-check/report/page.tsx:95. Its two siblings in the same
  file were wired to production (ChangeLogNotice at src/app/(app)/report/page.tsx:105), so
  this one was left behind rather than deliberately dropped.  The gap is made worse by the
  KPI copy. src/lib/report/data.ts:255 labels the open count "Open now" with the note
  "Current snapshot, not the period" - the word "Current" asserts a freshness the page
  cannot back, and it is the only age-adjacent word on the tab. src/lib/report/data.ts:256,
  "Late now", carries no age note at all.  The number is not even available to render: no
  loader under src/lib/report/ reads `items_synced_at`. monday_boards is touched only for
  effort and board names (src/lib/report/workload-data.ts:192, :236, :249) and for a count
  (src/lib/report/method.ts:21). Wiring StaleSnapshot requires adding the stamp to a loader
  first.
  `src/components/report/ReportNotices.tsx:49-62, src/app/(app)/report/page.tsx:105, src/lib/report/data.ts:255-256`

- **The printed/PDF report stamps the print date and never the pull date**
  src/app/(app)/report/print/page.tsx:51 computes `printed = new
  Date().toLocaleDateString(...)` and :62-64 renders the only provenance line on the page:
  `${SCOPE_LABEL[scope]} · last ${period} days · printed ${printed}`.  A PDF whose header
  says "printed 10 September 2026" reads as "these numbers are from 10 September". The Open
  and Late counts on it come from the Monday snapshot, which under the normal oldest-first
  rotation can be most of a 4-hour cycle behind, and for a board sitting at the head of a
  failing queue can be days behind. The header comment at print/page.tsx:4-5 states the
  design intent correctly - "a reader holding it on paper needs the scope and period stated
  instead" - but stops at scope and period and omits the one thing a paper reader cannot
  check for themselves.  This is the surface that leaves the building: it is what the PDF
  route photographs (print/page.tsx:7-8, 54-56), so it is the copy that ends up in an email
  or a meeting with no way back to the live page.
  `src/app/(app)/report/print/page.tsx:51, 62-64`

- **CSV exports date the file with the download date and carry no pull time in the body**
  `exportName` at src/lib/report/csv.ts:103-105 builds the filename from `new
  Date().toISOString().slice(0, 10)`, i.e. the moment of download, producing names like
  "Report People - Everyone, last 30 days - 2026-09-10.csv" (used at
  src/app/(app)/report/csv/route.ts:73 and :81).  None of the four builders emit a data-age
  line: overviewCsv (csv.ts:35), peopleCsv (csv.ts:54), workloadCsv (csv.ts:67) and waitsCsv
  (csv.ts:90) all open straight onto a header row. So the only date anywhere in or on the
  file is the download date, and it will be read as the data date - by the person who
  downloads it and by everyone they forward it to.  The file already sets its own precedent
  for writing a caveat into the data rather than trusting the screen: the "Load basis"
  column exists precisely so a percentage cannot travel without the note that it borrowed
  somebody else's week (csv.ts:80-84, comment). Data age deserves the same treatment,
  especially since a CSV outlives the page it came from.
  `src/lib/report/csv.ts:103-105, src/lib/report/csv.ts:35, 54, 67, 90`

- **The unfiltered 5,000-row window is picked by row id, not urgency, and it rotates as
  boards re-ingest**
  `loadWorklist` reads the capped view with `.order('id', { ascending: true }).range(from,
  from + PAGE - 1)` (src/lib/monday/worklist/data.ts:265) against `const cap = onlyAccounts
  ? Number.POSITIVE_INFINITY : UNFILTERED_CAP` (data.ts:260, UNFILTERED_CAP = 5000 at
  data.ts:32). The urgency sort (open first, then soonest deadline) runs afterwards, in JS,
  over whatever those 5,000 rows happened to be (data.ts:327-332). So the cap is applied on
  one key and the meaning is applied on another.  `id` is BIGSERIAL
  (supabase/migrations/064_monday_worklist.sql:97) and the ingest replaces a board's rows
  wholesale, `delete().eq('board_id', board.id)` (src/lib/monday/worklist/ingest.ts:253)
  then fresh inserts (ingest.ts:255-258), so every refresh moves that board's entire row set
  to the top of the id sequence. The ingest queue is ordered `items_synced_at` ascending
  (ingest.ts:299-300), so the lowest ids belong to exactly the boards that are next in line
  to be refreshed. Net effect: the "first 5,000" is a slice that cycles through the Monday
  account every few cron passes, and it has no relationship to what is late, open, or yours.
  The banner tells the reader otherwise: `Showing the first ${n(data.total)} of
  ${n(data.matching)} steps` (src/components/monday/WorkList.tsx:681) reads as a ranked
  prefix. The index that would make a real prefix possible already exists and has no
  consumer: `monday_assignments_due_idx ON monday_assignments (due_date) WHERE status_done
  IS NOT TRUE` (supabase/migrations/067_monday_dates_and_colours.sql:31-33). A grep for
  `due_date` across src finds no `.order('due_date')` and no range filter on it anywhere in
  the read path.
  `src/lib/monday/worklist/data.ts:265`

- **"Finished work: all of it" removes open work from the Everyone view**
  The cap does not move when the finished-work window is widened. `applyFilters` drops the
  six-month clause
  `status_done.is.null,status_done.eq.false,item_updated_at.gte.${sinceIso}` when
  `includeDone` is set (src/lib/monday/worklist/data.ts:242-246), but `cap` is still
  UNFILTERED_CAP (data.ts:260) and the rows are still taken in id order (data.ts:265).  The
  widened result set is a strict superset ordered by the same key, so the first 5,000 ids of
  the superset necessarily contain finished-old rows that the narrow query skipped, and
  therefore contain fewer open rows. Clicking `Finished work: all of it`
  (src/components/monday/WorkList.tsx:624-632) on the unfiltered view literally pushes open
  steps off the page, which is the opposite of what the label promises. The effect is
  confined to the unfiltered view, which is precisely where the list is longest and where
  the button is most likely to be pressed.
  `src/lib/monday/worklist/data.ts:260`

- **Switching a step off does not make room, contradicting the rule the same file states
  three lines above**
  data.ts:227-233 spells out why board exclusion is a query filter and not a post-filter:
  "the unfiltered view reads the first 5,000 rows, so a board switched off went on consuming
  that budget and pushed real work out of the page. Switching something off has to make
  room, otherwise hiding a board makes the list worse instead of shorter."  The step-level
  switch does not follow that rule. `applyFilters` (data.ts:237-248) narrows on `board_id`,
  hidden `monday_user_id` and the done clause only. Rows on a column whose step source is
  'off' are dropped in JS after the paged read: `if (st?.source === 'off') continue`
  (data.ts:286). So the lever aimed at the single biggest source of fake rows still consumes
  the 5,000-row budget, still inflates the `count: 'exact'` denominator (data.ts:256-258)
  and still inflates `total` (data.ts:342).  This matters more than the board switch because
  step seeding is a positional guess: every people column becomes a step, paired to the
  nearest status column right-then-left (src/lib/monday/worklist/steps.ts:97-116), and
  `setStepSource(..., 'off')` (src/app/(app)/settings/monday/actions.ts:96) is the only way
  to undo a wrong guess. The ingest honours 'off' properly (ingest.ts:160), so the rows are
  not even re-written; they just sit in the table forever consuming the read budget.
  `src/lib/monday/worklist/data.ts:286`

- **The banner that warns a team view is incomplete can never render**
  The banner is gated on `{team && data.unlinked > 0 && ...}`
  (src/components/monday/WorkList.tsx:663). Those two conditions are mutually exclusive by
  construction.  When a team is chosen, `onlyAccounts` is built from `monday_user_links`
  (data.ts:150-153 calling `accountsFor` at data.ts:137-142) and applied as
  `out.in('monday_user_id', onlyAccounts)` (data.ts:241). Every row read therefore carries
  an account that is, by definition, already linked. So `pid` is never null,
  `unlinkedAssignments` never increments (data.ts:292), and `accountsOnWork` (data.ts:289)
  contains only linked ids, which makes `unresolvedAccounts(accountsOnWork, linkedAccounts,
  externalAccounts)` return an empty set (src/lib/monday/worklist/links.ts:32-39, called at
  data.ts:343).  `data.unlinked` is structurally 0 exactly when the banner is permitted to
  show, and `data.unlinkedAssignments` in the banner copy (WorkList.tsx:665) would print 0
  too. The only on-page signal that a team filter is silently hiding real work, and the only
  link to `/admin/monday-links` (WorkList.tsx:669), is unreachable.
  `src/components/monday/WorkList.tsx:663`

- **The "team filter cannot see N unlinked assignments" banner can never render**
  WorkList.tsx:663 gates the warning on `team && data.unlinked > 0`, but `unlinked` is
  structurally 0 whenever a team is chosen. `accountsFor` (data.ts:137-141) builds
  `onlyAccounts` by selecting `monday_user_id` FROM `monday_user_links`, so every id in it
  is by definition linked. That list is then applied as a hard query filter,
  `out.in('monday_user_id', onlyAccounts)` (data.ts:241), so every row read back has a
  `personByAccount` hit (the map at data.ts:199-200 is built from the whole of the same
  table). Therefore `unlinkedAssignments++` (data.ts:292) never fires, `accountsOnWork`
  (data.ts:289) is a subset of `linkedAccounts`, and `unresolvedAccounts(...).size`
  (data.ts:343) is 0. The one blind spot the banner exists to announce (work on a Monday
  account nobody linked is invisible while a team is selected, per the rationale at
  WorkList.tsx:655-662) is the one thing the query has already excluded before the counter
  runs. It looks alive only because the design check hand-feeds the numbers: `base(ROWS, {
  unlinked: 6, unlinkedAssignments: 43 })` with `preview={{ team: 't1' }}` at
  src/app/design-check/states/page.tsx:74-81. A working count would have to be a separate
  query over the team's members' *unlinked* peers, not a derivative of the filtered read.
  `src/components/monday/WorkList.tsx:663-671, src/lib/monday/worklist/data.ts:137-141, 241, 288-292, 343`

- **A person with no Monday account gets an empty list that blames the sync instead of the
  link**
  When the chosen person (or every member of the chosen team) has no row in
  `monday_user_links`, `onlyAccounts` is `[]` and data.ts:250-251 returns early with `{
  rows: [], open: 0, total: 0, unlinked: 0, unlinkedAssignments: 0, truncated: false,
  matching: 0, oldestSyncAt: null }`. Downstream that renders as: the counter "0 open"
  (WorkList.tsx:637-640, identical to a genuinely finished person), "Nothing here." in On-
  going (WorkList.tsx:331), and, because `oldestSyncAt` is null, PullInfo prints `not
  ${pastVerb} yet` (src/components/PullInfo.tsx:70) which on this page reads "Work pulled
  from Monday at 03:15, 07:15 … · not refreshed yet". So the page states the Monday
  integration has never run, when the truth is that this one person is not wired to it.
  Nothing anywhere on the page names the actual cause, and the Mine button is *not* disabled
  (the `dead` check at WorkList.tsx:568 is `!selfPersonId`, which only covers a login with
  no Directory person, a different failure). The path is trivially reachable: the Person
  dropdown is populated from every active person (src/app/(app)/my-work/page.tsx:102) with
  no filter for whether they have a Monday account, so picking any of them is a guaranteed
  dead end presented as "no work". The same collapse happens with zero included boards,
  where `includedBoards` is `[]` (data.ts:234).
  `src/lib/monday/worklist/data.ts:250-251, src/components/PullInfo.tsx:70, src/app/(app)/my-work/page.tsx:102`

- **The "this team filter cannot see N assignments" banner can never render**
  WorkList.tsx:663 gates the warning on `team && data.unlinked > 0`, but `data.unlinked` is
  structurally always 0 whenever a team (or person) is selected.  In data.ts:150-153 a team
  filter resolves to `onlyAccounts`, which is built *from* `monday_user_links`, so every id
  in it is by definition linked. applyFilters then does `.in('monday_user_id',
  onlyAccounts)` (data.ts:241), so `rows` contains only those accounts. The loop feeds
  `accountsOnWork.add(a.monday_user_id)` (data.ts:289) from exactly those rows, and
  `unlinked` is `unresolvedAccounts(accountsOnWork, linkedAccounts, externalAccounts).size`
  (data.ts:343), which by construction returns the empty set. `unlinkedAssignments`
  (data.ts:292) is 0 for the same reason: `pid` is never null.  Verified by running
  loadWorklist against the fake client from data.test.ts, with one linked account and one
  unlinked account both holding work on the same included board:   unfiltered -> unlinked =
  1, unlinkedAssignments = 1   teamId 't1' -> unlinked = 0, unlinkedAssignments = 0  So the
  banner fires only in the state where WorkList.tsx:655-662 deliberately suppresses it (no
  team chosen), and never in the state it was written for. A team leader picking "Writers"
  gets a list that silently omits every assignment sitting on an unlinked Monday account,
  with no banner and no link to /admin/monday-links. The comment at data.ts:290-291 ("the
  same rule from the same function, so the two screens cannot report different numbers") is
  true and beside the point: the input set is the thing that was narrowed.
  `/Users/arnaldodlanra/Downloads/Claude/01: TN Op Portal/src/components/monday/WorkList.tsx:663 and src/lib/monday/worklist/data.ts:241,289,292,343`

- **A person with no Monday account link gets a confident empty list, and "Mine" is the
  default view**
  data.ts:148-149 resolves the person filter to their Monday accounts; data.ts:250-252
  returns `{ rows: [], open: 0, total: 0, unlinked: 0, unlinkedAssignments: 0, truncated:
  false, matching: 0, oldestSyncAt: null }` when that array is empty.  Verified:
  `loadWorklist(client, { personId: 'p2' })` for a directory person with no row in
  monday_user_links returns exactly that object. WorkList then renders "On-going: 0" and
  "Nothing here." (WorkList.tsx:326,331). PullInfo is fed `oldestSyncAt: null` so it prints
  "not refreshed yet" (PullInfo.tsx:70) rather than anything about the person.  This is the
  DEFAULT landing state, not an edge case: my-work/page.tsx:98 calls
  `resolvePersonFilter(sp, selfPersonId)`, which returns `selfPersonId` when `?person` is
  absent (filters.ts:29). So anyone whose Monday account was never linked opens My Work and
  is told, in the portal's own confident voice, that they have no work at all.  The one
  message that exists covers a different failure: WorkList.tsx:568 sets `dead = t.key ===
  'mine' && !selfPersonId`, and the tooltip at :596 says "Your login is not linked to anyone
  in the Directory yet". That is the login->person gap. The person->Monday gap (discover.ts
  links by email only) leaves `selfPersonId` set, so the Mine button is enabled,
  highlighted, and returns nothing with no explanation. The unlinked banner cannot help
  either, because it requires `team` (see the previous finding).
  `/Users/arnaldodlanra/Downloads/Claude/01: TN Op Portal/src/lib/monday/worklist/data.ts:250-252 and src/components/monday/WorkList.tsx:568,596`

- **Nothing prevents two ingest chains running at once, and the write is delete-then-plain-
  insert against a unique key**
  `monday_assignments` has `UNIQUE (item_id, people_col, monday_user_id)`
  (064_monday_worklist.sql:117) and the only write path is `delete().eq('board_id',
  board.id)` followed by plain `.insert(...)` in chunks of 500 (ingest.ts:253-258). There is
  no upsert, no ON CONFLICT, and no lock anywhere in the subsystem (grep for
  insert/upsert/delete on monday_assignments returns only those two lines).  The admin
  trigger fires a second chain unconditionally: admin/monday-ingest/route.ts:37 does `void
  fetch('/api/cron/monday-worklist')` with no check for a chain already in flight, and its
  own response text (:56-57) tells the admin the scheduled job also runs at 02:15, 06:15,
  ... An admin who presses it during a scheduled chain (which lasts minutes, six times a
  day) starts a second walk of the same queue. Both chains order boards by `items_synced_at`
  ascending (ingest.ts:300), so both pick the same board first.  On overlap, whichever chain
  inserts second hits a 23505 on the unique key. That is thrown at ingest.ts:257, and
  `ingestSlice`'s loop has no try/catch (ingest.ts:311-314), so it reaches route.ts:121-128,
  which returns 500 and does not fire the next hop. Three things are then true and none of
  them are visible:   - the board is left with a PARTIAL row set (chunks already inserted
  stay; the delete already ran), so My Work shows a fraction of that board's work as if that
  were all of it;   - `items_synced_at` is written only after the insert loop
  (ingest.ts:264-270), so the board keeps its old stamp and stays at the head of the queue,
  ready to repeat;   - the settings page keeps showing the board's stale `assignments_count`
  (sources.ts:101, also written only at :268) beside a live per-account scan of the same
  table (sources.ts:126-133), so the two halves of that screen now disagree with each other
  and with My Work.  The same collision is reachable without concurrency whenever an item is
  moved between two included boards in Monday and both boards use the same people-column id
  (`person`, `people`, `people4` are per-board ids that repeat across template-derived
  boards): the source board's stale row survives until its own turn, and the destination
  board's insert collides with it every pass.
  `/Users/arnaldodlanra/Downloads/Claude/01: TN Op Portal/src/lib/monday/worklist/ingest.ts:253-258,311-314 and src/app/api/admin/monday-ingest/route.ts:37`

### medium (23)

- **Steps that were already finished when their board was first ingested are counted as open
  work forever**
  The `done` event requires a transition: `if (was.status_done !== row.status_done &&
  row.status_done === true)` (changes.ts:83). A row with no `was` takes the earlier branch
  and emits only `assigned` (changes.ts:73-77) - even when `status_done` is already true. On
  the first ingest of a board that is every finished step on it; thereafter it is anyone
  added to a step that is already done.  `loadOpenSince` never looks at doneness. It replays
  only the event name (`if (e.event === 'assigned' || e.event === 'reopened') open.set(...)
  else open.delete(...)`, report/data.ts:291-294), so those keys are marked open and nothing
  ever removes them: `status_done` is already true, so it can never *change* to true and no
  `done` event will ever be written for them.  'Where it waits' happens to be protected
  because `stuck` re-filters against the live snapshot (`snapshot.rows.filter(r =>
  !r.statusDone)`, waits.ts:96). The Overview is not - `aging` is built purely from
  `openSince.values()` with no snapshot cross-check (report/data.ts:227-233) and is returned
  ungated at report/data.ts:259, next to an 'Open now' KPI that *is* taken from the snapshot
  (report/data.ts:255). The panel renders as 'Open work, by age' / 'How long each open step
  has been sitting with its assignee' (ReportOverview.tsx:109-110), and its bars will not
  add up to the 'Open now' figure sitting a few pixels away.
  `src/lib/monday/worklist/changes.ts:73-77,83 + src/lib/report/data.ts:227-233,255,291-294 + src/components/report/ReportOverview.tsx:109-110`

- **The 'Everyone' view's 5,000-row cap is a biased sample that systematically hides the
  freshest boards**
  The unfiltered read pages `.order('id', { ascending: true }).range(from, from + PAGE - 1)`
  and stops at `UNFILTERED_CAP = 5000` (data.ts:32, 260-272). `id` is `BIGSERIAL PRIMARY
  KEY` (064_monday_worklist.sql:97), and `ingestBoard` replaces a board's rows with
  `delete().eq('board_id', ...)` followed by fresh `insert`s (ingest.ts:253-257) - so every
  re-ingest gives that board brand-new, higher ids.  Ascending id is therefore ascending
  'time since this board was last ingested'. The 5,000 rows the page keeps are the ones from
  the boards the cron reached longest ago, and the rows it drops are the ones from the
  boards refreshed most recently. Against ~53,000 assignments (data.ts:22) that is a 9%
  slice chosen by exactly the wrong criterion.  The sort that makes the list look coherent
  (open first, then due date, data.ts:328-332) runs *after* the cap, so nothing on screen
  hints that the cut was arbitrary. The banner says 'Showing the first N of M steps. Pick a
  person or a team to see all of theirs.' (WorkList.tsx:679-683) without saying first by
  what, and a manager scanning Everyone can miss a person's overdue row entirely even though
  it appears the moment they pick that person.
  `src/lib/monday/worklist/data.ts:32,260-272,328-332 + src/lib/monday/worklist/ingest.ts:253-257 + supabase/migrations/064_monday_worklist.sql:97`

- **The assignment table's unique key omits board_id while the delete that maintains it is
  scoped to one board**
  `monday_assignments` is constrained `UNIQUE (item_id, people_col, monday_user_id)`
  (064_monday_worklist.sql:117) - no `board_id`. But the write path clears only its own
  board: `delete().eq('board_id', board.id)` (ingest.ts:253) followed by plain `insert`, not
  upsert (ingest.ts:256). `changes.ts:35-37` makes the same board-free assumption for the
  event key.  The two disagree whenever one (item, people column, user) triple exists under
  two board ids, which is what a Monday board-to-board move produces: the pulse keeps its
  id, and boards cut from one template share column ids like `person` / `status`. Until the
  losing board's own ingest runs (up to a full 4-hour cron cycle, longer if it is far down
  the oldest-first queue at ingest.ts:300), the stale row keeps the item on the old board's
  list under the old board name, and the receiving board's insert raises a 23505 that
  ingest.ts:257 converts into a thrown Error. With no try/catch around `ingestBoard` in
  `ingestSlice` (ingest.ts:311-314) that aborts the whole slice, and because the failing
  board never gets its `items_synced_at` stamp (ingest.ts:264-270) it is first in the
  oldest-first queue again on the next firing - so the collision blocks the pass repeatedly
  rather than resolving itself.
  `supabase/migrations/064_monday_worklist.sql:117 + src/lib/monday/worklist/ingest.ts:253-257,311-314 + src/lib/monday/worklist/changes.ts:35-37`

- **oldestSyncAt can be pinned forever by a board that contributes no rows and can never be
  re-pulled**
  src/lib/monday/worklist/data.ts:334-337 builds the freshness stamp as the minimum over
  `boardList.filter(b => b.included && b.items_synced_at)`. boardList is every row of
  monday_boards (selected unfiltered at data.ts:158), not the boards that produced rows on
  screen.  A board that is `included` but whose step rows are all `source = 'off'` is
  excluded from the ingest queue by the hasSteps intersection at
  src/lib/monday/worklist/ingest.ts:305-308, so its `items_synced_at` is frozen at whatever
  it was and can never advance again. Its rows are simultaneously dropped from the page at
  data.ts:286 (`if (st?.source === 'off') continue`). The result: that board sets
  `oldestSyncAt` permanently, and My Work's footer reads "last refreshed 340 days ago" while
  describing data that is not on the page and cannot ever improve.  The same holds, less
  permanently, for any `included` board with steps that simply has no rows matching the
  current person or team filter: the footer reports the age of a board the viewer is not
  looking at.  The "oldest, not newest" choice is right and well argued (data.ts:126-133),
  but it only works if the set being minimised over is the set on screen. As written, the
  honest signal degrades into a stuck alarm, which is the fastest way to teach people to
  ignore it.
  `src/lib/monday/worklist/data.ts:334-337 (with data.ts:158, data.ts:286, src/lib/monday/worklist/ingest.ts:305-308)`

- **A board that has never been pulled contributes no rows and no staleness signal**
  The same filter at src/lib/monday/worklist/data.ts:335 requires `b.items_synced_at` to be
  non-null, so a board that is `included`, has steps, and has never been reached is silently
  absent from the stamp. It is first in the ingest queue by construction (`nullsFirst:
  true`, src/lib/monday/worklist/ingest.ts:300), which is exactly the board most likely to
  be missing after a chain that died or hit the hop cap.  So the failure mode is: none of
  that board's work appears in My Work, and the footer states a confident "last refreshed 20
  minutes ago" drawn from the boards that did land. Nothing on the page distinguishes "you
  have no work on that board" from "that board has never been read".  The information exists
  and is well formatted, but only in a raw-text admin API route: src/app/api/admin/monday-
  inventory/route.ts:361-376 prints `BOARDS n/m read ← run the ingest again`, a "STILL TO
  READ" list, and `Oldest board read at {stamp}`. Grep shows /api/admin/monday-inventory is
  referenced only from other route.ts files (monday-discover, monday-ingest) and from no
  page or component, so reaching it means knowing the URL and the ?part=status query by
  hand.
  `src/lib/monday/worklist/data.ts:335, src/app/api/admin/monday-inventory/route.ts:361-376`

- **The Settings page that decides which boards feed My Work never shows when a board was
  last pulled**
  `loadWorklistSources` selects `id, name, workspace_name, included, included_pinned,
  priority, is_subitem_board, assignments_count, last_activity_at` at
  src/lib/monday/worklist/sources.ts:59-60. `items_synced_at` is not in the list, and
  `SourceBoard` (sources.ts:17-25) has no field for it.  What the page does show is
  `lastActivityAt`, documented at sources.ts:32 as "Newest activity across its boards: the
  number that says 'still in use'". That is a Monday-side stamp - the newest
  `item_updated_at` among assignment rows (src/lib/monday/worklist/ingest.ts:263-270) -
  sitting in the exact screen position where an admin would reasonably read a portal-side
  pull time. The two can differ by hours or, for a board that left the queue, by months, in
  the direction that flatters.  So the one screen where an admin turns boards on and off,
  and the natural place to answer "why is this board's work old or missing", has no per-
  board pull age at all.
  `src/lib/monday/worklist/sources.ts:59-60, sources.ts:17-25, sources.ts:32`

- **PullInfo has no failure state, though its sibling SyncStatus was built with one**
  PullInfo's props are syncedAt, utcHours, utcMinute, label, pastVerb, className
  (src/components/PullInfo.tsx:32-45). There is no way to say the last attempt failed, so
  the footer renders identically whether the rotation is merely behind or has been broken
  for two days: "Work pulled from Monday at 01:15, 05:15... · last refreshed 9 hours ago",
  in neutral grey, counting up.  The portal already solved this next door. `SyncStatus`
  takes a `failed` prop with the comment "The last import attempt failed, so `syncedAt` is
  older than it reads" (src/components/tsheets/settings/SyncStatus.tsx:8-12) and renders
  "Import failed, data from {ago}" instead of "Last synced {ago}" (SyncStatus.tsx:44-45);
  src/components/tsheets/ReportMeta.tsx:34 passes it through to a report header.
  src/lib/timeclock/import-status.ts:24-25 carries the same distinction in its return type.
  The Monday side has neither half: no failure flag reaching the UI, and no field for it if
  one existed. Given the ingest chain returns 500 and stops firing hops on a single bad
  board, "behind" and "broken" look the same to a user precisely when they diverge most.
  `src/components/PullInfo.tsx:32-45 vs src/components/tsheets/settings/SyncStatus.tsx:8-12, 44-45`

- **The Method tab prints a hardcoded "live" badge and a hardcoded cadence, in a file whose
  own header forbids exactly that**
  src/lib/report/method.ts:2-5 states the premise: "a number stays defensible when somebody
  disputes it, which a hand-written 'every 4 hours' cannot do: it stops being true the day
  the cron changes and nobody notices for a quarter." Ten lines later, method.ts:14-15 is
  `const SYNC_CADENCE = 'every 4 hours'`. src/components/report/ReportMethod.tsx:3-6 repeats
  the same claim in its own header.  `state: 'live'` is likewise a literal (method.ts:31 for
  Monday assignments, method.ts:44 for Timeclock entries), rendered as a teal "live" chip at
  src/components/report/ReportMethod.tsx:38 with the label from SOURCE_CHIP
  (ReportMethod.tsx:23). The chip says "live" whether the last successful pull was 20
  minutes or 3 weeks ago. The Source type's own comment calls cadence "How often it
  refreshes, read from the thing that refreshes it" (ReportMethod.tsx:15), which is not what
  happens.  The card mixes one genuinely measured value with two asserted ones and presents
  them at equal weight: the board count on the same line IS read from the database
  (method.ts:21-22, rendered as `${SYNC_CADENCE} · ${boards} boards`). `items_synced_at` is
  available in the same table this loader already queries.
  `src/lib/report/method.ts:14-15, 31, 44; src/components/report/ReportMethod.tsx:38`

- **The counters overstate the list: "in view" and "shown of" count rows that were never
  rendered, and "open" counts rows in a collapsed block**
  Two separate off-by-a-lot counters, both on the header line that tells a person how long
  their list is.  First, `loadWorklist` returns `total: rows.length` (data.ts:342), where
  `rows` is the raw paged read, while the array actually handed to the client is `out`
  (built at data.ts:294-320). `out` is smaller: rows are dropped for a missing or excluded
  board (data.ts:282), a hidden account (data.ts:283) and an 'off' step (data.ts:286). Both
  `${n(data.total)} shown of ${n(data.matching)}` (WorkList.tsx:638) and `${n(data.total)}
  in view` (WorkList.tsx:639), plus the truncation banner (WorkList.tsx:681), therefore
  report a number larger than the three blocks add up to. `matching` (data.ts:256-258) has
  the same problem: the `count: 'exact'` head query does not know about 'off' steps either.
  Second, `open` is incremented for every surviving row including unknown-user ones (`if
  (row.statusDone !== true) open++`, data.ts:318), but the On-going block is
  `known.filter(...)` (WorkList.tsx:542, 546), and the Unknown user block that holds the
  difference starts collapsed (WorkList.tsx:463-468). In the Everyone view the header reads
  "N open" while On-going shows a visibly smaller count, with no way to see where the gap
  went without expanding a block that is described as an admin queue.
  `src/lib/monday/worklist/data.ts:342`

- **Board priority outranks every deadline, and the 200-row block window makes one high
  board decisive**
  `ongoing` re-sorts the server's output with `PRIORITY_RANK[a.row.priority] -
  PRIORITY_RANK[b.row.priority]` as the outer key
  (src/components/monday/WorkList.tsx:546-552). Priority is a property of the board, not the
  task (`priority: b.priority ?? 'medium'`, data.ts:313; column is `TEXT NOT NULL DEFAULT
  'medium'`, supabase/migrations/070_monday_board_priority.sql:22, so the `??` is dead and
  every board starts equal until an admin sets one).  Because priority is the outer key, an
  undated step on a board marked high sorts above a step 400 days late on a board left at
  medium: the comparator never reaches the date terms. The comment at WorkList.tsx:548-549
  says the deadline order is kept "intact inside each band", which is accurate and is the
  problem.  Combined with the block window, this decides the whole visible page:
  `rows.slice(0, FIRST_ROWS)` with `FIRST_ROWS = 200` (WorkList.tsx:302, 316). One high
  board with 200 or more open steps fills the entire On-going view, and no late row from any
  other board appears until someone clicks `Show the other N` (WorkList.tsx:403-408).
  Setting a single board to high is currently a way to hide everything else, and nothing on
  the page says so.
  `src/components/monday/WorkList.tsx:546`

- **Search cannot reach priority, and group_title is read and carried on every row but never
  used for anything**
  The haystack is `[r.itemName, r.parentItemName, r.boardName, r.workspaceName, r.who,
  r.stepName, r.statusText, r.dueDate, due?.date, due?.time, due ?
  DUE_BADGE[due.state].label : null]` (WorkList.tsx:528-531). The rationale directly above
  it (WorkList.tsx:517-521) states the rule: the haystack is built from what was rendered,
  "because 'late' and 'upcoming' are words on the page too and somebody will type them."
  The Priority chip is rendered on every row (WorkList.tsx:377) and is not in the haystack,
  so typing "high" matches nothing. With no priority filter control anywhere, search was the
  only route to it, and it breaks the file's own stated rule.  `groupTitle` is worse than
  missing: it is fetched from Monday (`group { title }`, ingest.ts:224), stored
  (064_monday_worklist.sql:106), named in the SELECT on every page load (data.ts:236),
  copied onto every one of up to 5,000 row objects (data.ts:302), and then never rendered,
  never searched and never filtered on. It is the cheapest narrowing lever already sitting
  in the database (Monday boards routinely park finished or parked work in a group named
  "Done" or "Archive"), and it is paid for on every request while doing nothing.
  `src/components/monday/WorkList.tsx:528`

- **The person and team path has no cap and no truncation signal, only an assumption that it
  is small**
  `const cap = onlyAccounts ? Number.POSITIVE_INFINITY : UNFILTERED_CAP` (data.ts:260) and
  the loop `for (let from = 0; from < cap; from += PAGE)` (data.ts:263-272) pages until a
  short page comes back. `truncated` is only ever assigned inside the `if (from + PAGE >=
  cap)` branch (data.ts:271), so on this path it is permanently false and the honest
  "showing the first N of M" banner (WorkList.tsx:681) can never appear.  The justification
  at data.ts:26-30 is "somebody doing their work picks a person or a team, and that query is
  small and complete." That holds for one person. A team filter expands to every member's
  Monday accounts (data.ts:150-153), so a large team's read is unbounded in both round trips
  and row count, against a table the same comment sizes at 53,442 rows.  The client then
  offers to render all of it: `Show the other ${n(rows.length - FIRST_ROWS)}`
  (WorkList.tsx:403-408) with no ceiling, at the twelve cells per row that the file itself
  measures as "fifteen thousand DOM nodes for one block" at 1,280 rows
  (WorkList.tsx:294-299). The path with the guardrail is the one that cannot exceed 5,000;
  the path without one is the one that can.
  `src/lib/monday/worklist/data.ts:260`

- **Every keystroke re-partitions and re-sorts the whole loaded set, and so does every hover
  and row click**
  `prepared` is memoised on `[data.rows]` (WorkList.tsx:523-534), but the four arrays
  derived from it are computed in the render body with no `useMemo`: `unknown`
  (WorkList.tsx:541), `known` (:542), `ongoing` with its four-key sort (:546-552) and
  `completed` (:553).  They re-run on every render, not only on search. That includes each
  keystroke in the undebounced `SearchField` (WorkList.tsx:558), each block toggle, each
  `setOpenRow` when a row is clicked to open the history panel (WorkList.tsx:359, 696, 707,
  718), and each `setTip` fired by hovering or focusing the disabled Mine button
  (WorkList.tsx:574, 576). So opening one item's history first re-filters four times and re-
  sorts up to 5,000 rows, then reconciles up to 600 rendered rows across three blocks,
  before the panel appears.
  `src/components/monday/WorkList.tsx:546`

- **`total` counts rows fetched, not rows shown, so "N in view" lies whenever a step is
  switched off**
  `total: rows.length` at data.ts:342 is the length of the raw array read from the database,
  before the per-row drops in the loop at data.ts:280-292. The board and hidden-account
  drops are also enforced in the query so they cost nothing, but the step drop is not: `if
  (st?.source === 'off') continue` (data.ts:286) removes rows that are already inside
  `rows`. `open` is counted correctly (data.ts:318 sits after the `continue`s) and `out`
  holds only the visible rows, so `total` is the one number that includes work nobody can
  see. WorkList.tsx:640 renders `${n(data.open)} open · ${n(data.total)} in view`, and the
  difference between the two is what a reader interprets as finished work; an admin who
  switches off 40 mis-guessed steps on a busy board makes that gap grow by 40 with no
  visible rows behind it. The truncation banner at WorkList.tsx:681 repeats the same
  overstatement ("Showing the first 5,000 of 53,412 steps" when fewer than 5,000 are on
  screen). `out.length` is the number both strings want.
  `src/lib/monday/worklist/data.ts:342, 280-292, 318; src/components/monday/WorkList.tsx:640, 681`

- **Rows on switched-off steps still spend the 5,000-row unfiltered budget, which the file's
  own comment says must not happen**
  data.ts:227-233 is an explicit note that excluded boards are filtered in the QUERY and not
  after the fact, because "the unfiltered view reads the first 5,000 rows, so a board
  switched off went on consuming that budget and pushed real work out of the page. Switching
  something off has to make room, otherwise hiding a board makes the list worse instead of
  shorter." The step switch (`setStepSource(..., 'off')`, offered per row as "Not a step" at
  src/components/monday/StepReview.tsx:114-117) is exactly the same kind of switch and is
  implemented the way the comment rejects: `applyFilters` (data.ts:237-248) has no step
  predicate, and the drop happens in JS at data.ts:286. Since `monday_board_steps` is small
  and already loaded (data.ts:159), the off pairs are known before the query is built and
  could be excluded with a `.not('people_col','in',...)` per board or by pre-computing the
  allowed `(board_id, people_col)` set. Turning off a noisy "Priority" step on a high-volume
  board currently pushes that many real rows off the unfiltered page. data.test.ts covers
  the board switch (data.test.ts:105-110) but there is no fixture anywhere with `source:
  'off'`, which is why the asymmetry survived.
  `src/lib/monday/worklist/data.ts:227-248, 286; src/lib/monday/worklist/data.test.ts:77-80`

- **"Show the other N" is sticky forever, defeating the 200-row cap exactly where its own
  comment says it matters**
  `Block` holds `const [all, setAll] = useState(false)` (WorkList.tsx:315) and there is no
  key on any of the three `<Block>` elements (WorkList.tsx:690, 701, 710), so the flag lives
  for the life of the mounted `WorkList`. Filter changes do not remount it: `setParam`
  navigates with `startTransition(() => router.push(...))` (WorkList.tsx:509) and the
  component deliberately relies on surviving that navigation (the `wanted` state at
  WorkList.tsx:415 exists for precisely that reason). So once a person clicks "Show the
  other 500" on a 700-row list, `all` stays true while they switch to another person, pick a
  team, widen finished work, or type and clear a search, and every subsequent list renders
  in full. The doc comment at WorkList.tsx:295-301 justifies FIRST_ROWS as "1,280 on-going
  steps is fifteen thousand DOM nodes for one block, and building them is most of the wait
  when a tab changes" - the tab change is the case where the guard is now off. There is also
  no way back: the button is hidden once `all` is true (WorkList.tsx:403) and there is no
  "show fewer". Resetting `all` when `rows` identity changes, or keying the Block on the
  current filter, restores it.
  `src/components/monday/WorkList.tsx:315-316, 403-409, 690-716, 509`

- **The row cap is disabled for a whole TEAM, and `truncated` is unreachable in that
  branch**
  `const cap = onlyAccounts ? Number.POSITIVE_INFINITY : UNFILTERED_CAP` (data.ts:260).
  `onlyAccounts` is set for a team just as much as for a person (data.ts:148-154), so
  choosing "SEO" removes every limit: the loop pages 1,000 at a time until a short page
  arrives (data.ts:263-272), and because `from + PAGE >= cap` can never be true against
  Infinity, `truncated` stays false (data.ts:271) and the banner at WorkList.tsx:679-683
  cannot fire no matter how many rows come back. The whole array is then serialized into the
  RSC payload as a prop to a client component (src/app/(app)/my-work/page.tsx:108-114,
  `dynamic = 'force-dynamic'`, so nothing is cached), where FIRST_ROWS caps DOM nodes but
  not transfer. The justification at data.ts:22-31 reasons only about a person ("somebody
  doing their work picks a person or a team, and that query is small and complete") and only
  about round trips; a team of fifteen against 53,442 assignments is neither small nor
  bounded, and it is the exact selection a team leader makes first.
  `src/lib/monday/worklist/data.ts:260, 263-272, 22-31; src/app/(app)/my-work/page.tsx:108-114`

- **A board whose steps are all switched off pins the freshness footer for everyone,
  permanently**
  `oldestSyncAt` is the minimum `items_synced_at` over boards that are included and have
  ever synced (data.ts:334-337), and it feeds the page-wide "Work pulled from Monday … last
  refreshed X" line (WorkList.tsx:646-653). A board whose every step is set to 'off' leaves
  the ingest queue - `ingestSlice` keeps only boards present in `monday_board_steps` with
  `source != 'off'` (ingest.ts:305-308), and `ingestBoard` returns at ingest.ts:159-161
  before it would ever stamp `items_synced_at` (ingest.ts:265) - but it stays `included =
  true`, so it stays in the `stamps` array with a timestamp frozen at its last real sync.
  From then on it is permanently the minimum, and every user on every load is told the work
  list is days or months stale while every row they can actually see is current. It also
  contributes zero visible rows, because the read path drops them all at data.ts:286, so the
  number describes a board that is not on the page. Filtering `stamps` to boards that are
  still in the ingest queue, or clearing `items_synced_at` when a board's last step is
  turned off, fixes it. The same shape applies to any board that stays included but stops
  being ingested.
  `src/lib/monday/worklist/data.ts:334-337, 286; src/lib/monday/worklist/ingest.ts:159-161, 305-308; src/components/monday/WorkList.tsx:646-653`

- **The history panel says "genuinely empty rather than missing" when Monday returned no
  board at all**
  `const logs = d.boards?.[0]?.activity_logs ?? []` (src/app/api/monday/item-
  history/route.ts:63) collapses three different outcomes into one empty array: the item
  really has no activity, the board id no longer resolves (archived or deleted in Monday, or
  the token lost access), and the item was deleted. The panel then renders the reassuring
  text at WorkList.tsx:262-267: "Nothing in Monday's log for this item. Monday keeps
  activity for a limited window, so an item that has not moved in a long time is genuinely
  empty rather than missing." That reading is asserted, not established. It matters here
  because nothing ever removes a board from `monday_boards` when it disappears from Monday
  (`allBoards` filters to `state === 'active'` and the sync only upserts, discover.ts:196,
  234-237), so rows on dead boards persist in My Work indefinitely and every one of them
  clicks through to a message stating the item is fine. Distinguishing `d.boards` being
  empty from `activity_logs` being empty is a one-line check and gives the panel an honest
  third state.
  `src/app/api/monday/item-history/route.ts:63, src/components/monday/WorkList.tsx:262-267`

- **The header's "N in view" counts rows the page never draws, and switched-off steps still
  spend the 5,000-row cap**
  `total: rows.length` (data.ts:342) is the raw fetched array, but rows are dropped
  afterwards in the JS loop: `if (st?.source === 'off') continue` (data.ts:286) has no
  counterpart in `applyFilters` (data.ts:237-248). `open` is counted only over kept rows
  (data.ts:318). So one header line mixes two denominators.  Verified with the repo's fake
  client: one board, three assignments, one of them on a step whose `source` is 'off' ->
  `total = 3, matching = 3, rows.length = 2, open = 2`. WorkList.tsx:639 renders `2 open · 3
  in view` above two visible rows. The truncation banner at WorkList.tsx:681 ("Showing the
  first N of M steps") uses both inflated numbers too.  The cost is larger than the wrong
  label. data.ts:227-233 spells out why excluded boards were moved into the query: "Dropping
  them afterwards looked equivalent and was not: the unfiltered view reads the first 5,000
  rows, so a board switched off went on consuming that budget and pushed real work out of
  the page." Steps set to 'off' were never given the same treatment, so turning a step off
  in Settings (actions.ts:96-108) does not make room in the Everyone view; it just makes the
  page shorter, and the rows it pushes off the end are real work. data.test.ts covers the
  board switch and the hidden-person switch (:105,:112) but has no case for an 'off' step,
  and its "counts only what the switches allow" test (:119-124) asserts `matching` and never
  `total`.
  `/Users/arnaldodlanra/Downloads/Claude/01: TN Op Portal/src/lib/monday/worklist/data.ts:286,342 and src/components/monday/WorkList.tsx:639,681`

- **The history panel puts a live Monday timeline directly under stale snapshot chips, with
  nothing dating either**
  HistoryPanel renders the row's step, status and due chips from the Postgres snapshot at
  WorkList.tsx:246-249, then fetches Monday live at :200 and renders the returned timeline
  immediately below at :269-287. The file's own docstring (WorkList.tsx:12) frames the panel
  as authoritative: "Clicking a row asks Monday for that item's history, live. No history is
  stored, so what opens is current by definition."  The chips beside it are not current by
  definition. They were written at that board's last ingest, which the queue order
  (ingest.ts:300, oldest first) can leave close to a full four-hour cycle behind, and
  indefinitely behind for a board wedged by an insert error. So when a status moved since
  the last pass, the panel shows the newest timeline entry as "Status -> Done" with a chip
  two inches above it reading "Working on it", in Monday's own green, and nothing on the
  panel says which one is old.  The page does carry a freshness line, but it is `PullInfo`
  on the list behind the modal (WorkList.tsx:646-653), it reports `oldestSyncAt` for the
  whole page rather than this board, and the panel is a `fixed inset-0` overlay
  (WorkList.tsx:211) so it is not on screen while the two contradictory facts are. This is
  the one surface in the module where portal data and Monday data are placed side by side,
  and it is the one surface with no timestamp on either.
  `/Users/arnaldodlanra/Downloads/Claude/01: TN Op Portal/src/components/monday/WorkList.tsx:12,246-249,269-287`

- **Due badges are frozen at render time while the freshness line keeps ticking**
  `readDue` reads the wall clock (`const now = new Date()`, WorkList.tsx:171) and decides
  late / today / upcoming plus the elapsed string. It is called only inside `prepared`, a
  `useMemo` keyed on `[data.rows]` (WorkList.tsx:523-533), so every badge and every "in 4d"
  is computed once when the row data arrives and never again.  My Work is a list people
  leave open. A tab open across midnight keeps painting "Due today" on rows that are now
  overdue and "in 1d" on rows that are due today, and a tab open for two days keeps a stale
  "Late ... 2d" that never advances. Nothing invalidates it: the client-side search (`rows =
  needle ? prepared.filter(...)`, WorkList.tsx:536) reuses the frozen `prepared`, and
  `data.rows` only changes on a server navigation.  What makes it a trust problem rather
  than a cosmetic one is that PullInfo runs a 60-second interval on the same page
  (PullInfo.tsx:56-63) purely to keep "last refreshed X ago" moving. The page therefore
  visibly updates itself while the badges the reader is sorting by do not, so there is no
  signal that the urgency column has stopped being true.
  `/Users/arnaldodlanra/Downloads/Claude/01: TN Op Portal/src/components/monday/WorkList.tsx:171,523-533 and src/components/PullInfo.tsx:56-63`

- **A date-column swap blanks every deadline on the board until its next ingest, and blank
  reads as "not set"**
  When discovery sees a board's `date_col` change, it nulls `due_date` on every one of that
  board's assignments in the same pass: discover.ts:247-253, `.update({ due_date: null
  }).in('board_id', changed)`. The new values are only written when `ingestBoard` reaches
  that board (ingest.ts:217), which is later in the chain at best, and not at all if the
  chain hits the 8-hop cap (route.ts:55-57), drops a hop (route.ts:88-94), or dies on one
  bad board.  During that window every row on the board renders a faint "-" in the Due
  column and no badge (WorkList.tsx:386,392), which is exactly the rendering for a board
  that genuinely has no deadline column. pickDateColumn's docstring states the contract that
  breaks here: "blank is legible as 'not set' and a wrong date is not legible as anything"
  (steps.ts:66-68). After a swap, blank means "we deleted the value and have not re-read
  it", and the reader has no way to tell the two apart, on the exact column the page sorts
  and badges by.  The trigger is not rare or admin-driven. `pickDateColumn` is `dates.find(c
  => deadline(c.title)) ?? null` (steps.ts:71-76): first match, in whatever order Monday's
  GraphQL returned the columns (discover.ts:267 passes `b.columns` through unsorted), with
  no tie-break. A board carrying both "Due Date" and "Delivery Target" has two winners, and
  any change in that ordering silently swaps the source and wipes the column.
  `/Users/arnaldodlanra/Downloads/Claude/01: TN Op Portal/src/lib/monday/worklist/discover.ts:247-253 and src/lib/monday/worklist/steps.ts:66-76`

### low (11)

- **The server-rendered HTML asserts a cadence with no last-refreshed at all**
  PullInfo defers everything clock-dependent to after mount to avoid a hydration mismatch
  (src/components/PullInfo.tsx:51-63, a sound reason). The pre-mount fallback at
  PullInfo.tsx:66-67 is `text = `${label} every 4 hours``, so the server-rendered string on
  My Work is literally "Work pulled from Monday every 4 hours" - the schedule claim with the
  staleness half removed.  That is the entire first paint, and it is what any consumer of
  the SSR HTML sees: a browser with JS blocked or failed, a print of the page, a scrape. The
  fallback keeps the half that reassures and drops the half that qualifies, which is the
  wrong half to lose. "Work pulled from Monday every 4 hours" alone reads as "this is at
  most 4 hours old", a claim the hop-chain ingest does not guarantee for any individual
  board.
  `src/components/PullInfo.tsx:66-67`

- **The history panel shows a live Monday feed beside a stale snapshot chip with nothing
  marking which is which**
  The panel header renders `row.statusText` as a StatusChip and the due badge from the
  stored row (src/components/monday/WorkList.tsx:246-250) - snapshot values, as old as that
  board's last pull. Directly beneath, WorkList.tsx:200 fetches `/api/monday/item-history`
  live from Monday and prints each event with a real timestamp via `when(e.at)`
  (WorkList.tsx:181-186, rendered at :284-286).  So a step someone set to Done an hour ago
  shows "Status from Working on it → Done · Sep 10, 2026, 2:14 PM" in the log, sitting under
  a chip that still reads "Working on it" and, if the date has passed, a red "Late" badge.
  The panel is the one place in the module where the two clocks are visible side by side,
  and it is the one place with no line saying they are two clocks. Neither the chip row nor
  the History heading (WorkList.tsx:252) carries a "as at last pull" qualifier.  The empty-
  history case does get a careful caveat about Monday's retention window
  (WorkList.tsx:266-269), so the panel is otherwise conscientious about explaining what it
  is showing.
  `src/components/monday/WorkList.tsx:246-250 vs 200, 284-286`

- **oldestSyncAt is untested**
  src/lib/monday/worklist/data.test.ts sets `items_synced_at` on both board fixtures
  (data.test.ts:74-75) but never asserts on the returned `oldestSyncAt`; a grep for the
  field across the test file returns only those two fixture lines. One fixture is `included:
  true` and the other `included: false`, so the fixtures are shaped to exercise the
  inclusion condition at data.ts:335 and then nothing checks the result.  That condition is
  the one producing the two freshness defects above (a frozen stamp from an off-queue board,
  and a silently omitted never-pulled board). It is also the value that drives the only
  staleness statement a My Work user ever sees, so it has the highest ratio of user trust to
  test coverage in the module.
  `src/lib/monday/worklist/data.test.ts:74-75, src/lib/monday/worklist/data.ts:334-337`

- **Subitem boards are a separate row in every lever, so switching off a noisy area misses
  half of it**
  `is_subitem_board` is set by name regex at discovery
  (src/lib/monday/worklist/discover.ts:220) and stored (064_monday_worklist.sql:59), but it
  is used in exactly one place in the whole repo: a grey "subitems" label in the settings
  list (src/components/monday/WorklistSources.tsx:206).  Every lever is keyed on board id.
  `setBoardIncluded` (src/app/(app)/settings/monday/actions.ts:29) and `setBoardPriority`
  (actions.ts:57) update one `monday_boards` row, so switching off "Graphics" leaves every
  row from "Subitems of Graphics" on the page, and marking Graphics high leaves its subitems
  at medium, where the sort at WorkList.tsx:546 then ranks parent and child work apart.
  Finding both takes two searches, because the settings list sorts boards by assignment
  count within a workspace (src/lib/monday/worklist/sources.ts:107), which puts a parent and
  its subitem board far apart.  On the page itself the Board column shows the subitem
  board's own name, `boardName: b.name` where `b` is looked up by `a.board_id` (data.ts:296,
  rendered at WorkList.tsx:371-372), so those rows read "Subitems of Graphics". The parent
  board id is already on the row and already used for the link (`parent_board_id` written at
  ingest.ts:227, consumed by `itemUrl` at data.ts:182-188), so the row's eye icon opens the
  parent board while the Board column names a board a person will not recognise.
  `src/lib/monday/worklist/data.ts:296`

- **Item history silently truncates at 200 entries with no paging and no notice**
  The query asks `activity_logs(item_ids: $item, limit: 200)` (src/app/api/monday/item-
  history/route.ts:59) with no `page` argument and no follow-up request. The result is then
  filtered down further (route.ts:78 drops every non-`update_column_value` event that has no
  `column_title`) and sorted newest-first (route.ts:79), and the panel renders whatever
  survives under a bare heading "History" (WorkList.tsx:255) with no count and no "older
  activity not shown" line. On the busy items that generate the 700-row lists this feature
  is for - an item with many status and people columns moving over years - the panel shows a
  partial log presented as the whole one, and the filter at route.ts:78 means the user
  cannot even tell how close to 200 the raw result was. Either page the logs or return the
  raw count so the panel can say it stopped.
  `src/app/api/monday/item-history/route.ts:59, 78-79; src/components/monday/WorkList.tsx:255-289`

- **My Work and the admin links screen count different populations of unlinked accounts,
  despite the comment promising they cannot**
  links.ts:20-31 says the rule "has been written from scratch three times today … so both
  readers now call this and a disagreement becomes impossible rather than merely unlikely".
  Sharing `unresolvedAccounts` shares the predicate but not the input set. The links screen
  passes `counts.keys()` (links.ts:168), built by scanning every row of `monday_assignments`
  with no filter at all (links.ts:74-86). My Work passes `accountsOnWork` (data.ts:343),
  built only from rows that survived: included boards (data.ts:239), non-hidden accounts
  (data.ts:240), non-off steps (data.ts:286), the open-or-recent window (data.ts:245) and
  the 5,000-row cap (data.ts:260). Concrete divergence: a Monday account marked `hidden` in
  Settings that is also unlinked and has assignments appears in `pending` and in
  `onWorkUnresolved` on the links screen (links.ts:146, 168 - `hidden` is not even selected
  at links.ts:102, so that screen cannot show or reason about the state), while data.ts:240
  removes it from the query entirely so it can never be part of My Work's count. Same for an
  unlinked account whose only work sits on an excluded board, or whose work is finished and
  older than six months. The two screens will report different totals for the same question,
  which is the exact outcome the comment claims is now impossible.
  `src/lib/monday/worklist/links.ts:20-31, 74-86, 102, 168; src/lib/monday/worklist/data.ts:239-245, 260, 286, 343`

- **Step review says "Every step has been reviewed" when the search matched nothing, or when
  no steps exist**
  The empty branch picks its message from the toggle rather than from why the list is empty:
  `{onlyPending ? 'Every step has been reviewed.' : 'No step matches that.'}`
  (src/components/monday/StepReview.tsx:78-81). But `shown` is filtered by both conditions
  (StepReview.tsx:33-37), so with "Only unreviewed" on (its default, StepReview.tsx:30)
  typing a board name that does not exist produces the congratulation instead of "no match".
  The same string appears on a fresh install where `loadStepsForReview` returns nothing at
  all - discovery has never run, or `monday_boards` has no included row so the `.filter(s =>
  boardById.has(s.board_id))` at steps-review.ts:64 empties the list - telling an admin the
  review is finished when the ingest has not started. Choosing the message from `q` first,
  then `onlyPending`, then `steps.length === 0`, separates the three.
  `src/components/monday/StepReview.tsx:30, 33-37, 78-81; src/lib/monday/worklist/steps-review.ts:64`

- **Priority is printed on every row and excluded from the search, contradicting the comment
  that defines the haystack**
  WorkList.tsx:377 renders `{r.priority}` inside a chip with an `uppercase` class
  (tokens.ts:14), so the words HIGH / MEDIUM / LOW are literal text on every row under a
  column headed "Priority" (WorkList.tsx:347). The haystack at WorkList.tsx:528-531 lists
  itemName, parentItemName, boardName, workspaceName, who, stepName, statusText, dueDate,
  the printed date, the elapsed time and the badge label, and omits `priority`. It is the
  only rendered column left out.  The comment directly above it (WorkList.tsx:512-522)
  states the rule it breaks: "everything the row SHOWS flattened into one string to search
  ... Searching the fields alone missed the date: '2020' is on the screen, in the Due
  column, and finding nothing made the page look broken rather than narrow." Typing "high"
  reproduces exactly that: the counter switches to `N matching` (WorkList.tsx:636) and
  reports a number that excludes every high-priority row while the word is visible on all of
  them. Rows that do match are the ones whose item or board name happens to contain the
  substring, which is worse than none.
  `/Users/arnaldodlanra/Downloads/Claude/01: TN Op Portal/src/components/monday/WorkList.tsx:377,528-531`

- **The column a deadline came from is carried for exactly this purpose and never shown in
  the grid**
  `WorkRow.dueLabel` is documented at data.ts:72-73 as "Which column the date came from, so
  a wrong one can be spotted", populated from the board's `date_title` at data.ts:310. It is
  rendered in one place only: the history panel, as `{row.dueLabel ?? 'Due'}: {due.date}`
  (WorkList.tsx:248). The grid header is a bare "Due" (WorkList.tsx:350) and the cell prints
  the date alone (:386).  Because the source column is chosen per board by a title heuristic
  (steps.ts:71-76), two adjacent rows under that one header can be a contractual "Deadline"
  and a soft "Delivery Target", both badged "Late" in the same colour (tokens.ts:27).
  Checking which is which costs one modal open per row, and the modal is also where the live
  Monday history loads, so the check is a network round trip. The field exists to make a
  wrong deadline spottable; the surface where deadlines are read and sorted does not show
  it.
  `/Users/arnaldodlanra/Downloads/Claude/01: TN Op Portal/src/lib/monday/worklist/data.ts:72-73,310 and src/components/monday/WorkList.tsx:248,350`

- **The Assignee column shows the Directory name only, so searching the name Monday displays
  finds nothing**
  `who` prefers the directory person's `full_name` and falls back to the Monday display name
  (data.ts:315: `(pid ? personName.get(pid) : undefined) ?? mondayName.get(...) ?? 'User
  {id}'`). Only `r.who` reaches the search haystack (WorkList.tsx:529); the Monday account
  name behind a linked row is not carried on `WorkRow` at all.  So for anyone whose Monday
  display name differs from their directory record (a maiden name, a nickname, initials,
  "Ashery B. Lwimbo" against "Ashery Boniface Lwimbo" - the case links.ts:64-72 exists to
  reconcile), the portal prints a name Monday never shows, and typing the name the user just
  read in Monday returns zero matches with the counter confidently reporting "0 matching".
  The Assignee cell also carries no `title` attribute (WorkList.tsx:375), unlike the item,
  parent and board cells (:363,:368,:371), so hovering does not reveal the other name
  either.
  `/Users/arnaldodlanra/Downloads/Claude/01: TN Op Portal/src/lib/monday/worklist/data.ts:315 and src/components/monday/WorkList.tsx:375,529`

- **On a subitem row the Monday link is labelled with the subitem and opens the parent**
  For a subitem, `itemUrl` deliberately targets the parent: `const board = a.parent_board_id
  ?? ...; const item = a.parent_item_id ?? a.item_id` (data.ts:184-185), with the reasoning
  at data.ts:169-174 (a subitem board is not navigable, so a link to it would load an empty
  page). The reasoning holds; the labelling does not follow it.  The grid passes the
  subitem's own name as the link's label: `<OpenInMonday href={r.url} label={r.itemName} />`
  (WorkList.tsx:395), and OpenInMonday builds `aria-label={`Open ${label} in Monday`}`
  (:117) with a visible tooltip reading "Open in Monday" (:127). The panel's copy does the
  same: `aria-label={`Open ${row.itemName} in Monday`}` (:235) sits in a header whose
  headline is deliberately the PARENT name (:223). A screen reader is told "Open Portuguese
  in Monday" and Monday opens the parent item; a sighted user clicks the eye on the row
  reading "Portuguese" and lands somewhere else, with nothing on either surface saying the
  jump was intentional.
  `/Users/arnaldodlanra/Downloads/Claude/01: TN Op Portal/src/components/monday/WorkList.tsx:117,235,395 and src/lib/monday/worklist/data.ts:184-185`
