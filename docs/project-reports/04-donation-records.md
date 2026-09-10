# Donation records and change log

The two questions asked when the January to July figures were imported, and what
was built to answer them.

---

## What was asked

> "quando adicionamos dinheiro aqui, fica registrado o historico de doações? e
> acabei de perceber que vamos precisar de reports tambem pra isso: quanto e
> quando foi doado, pra que projeto"

> "depois vou precisar que voce me mostre onde ficam esses registros, quando
> adicionamos donations - se nao tivermos um lugar vamos precisar construir"

## What the answers were, before this

**Where they lived:** in `tc_project_donations`, and nowhere a person could look
at them. Three screens touched the figures and none of them was a list. The
month dialog writes them but loads only the month you are standing in. The
report shows the selected month. The month-by-month table shows a year. So the
numbers were visible and the records were not.

**Whether history was kept:** no. Three separate gaps.

1. `saveDonation` updated the row in place, so correcting $500 to $700 left
   nothing behind.
2. The table had `created_at` and `updated_at` but no author, so "who entered
   this" had no answer.
3. `note` existed in the table, was never offered by the dialog, and was never
   displayed. The only notes in there were the ones the import wrote, and they
   were unreadable through the portal.

---

## What was built

### Migration 080, `tc_project_donations_log`

One row per change: what it was, what it became, who did it, when.

Separate table rather than columns, because a donation row answers "what is the
figure now" and needs one row per month, while a log answers "what has this
figure been" and needs one row per change.

The actor is stored as name and email as well as a person id. A log records what
was true when it happened, and joining to `people` would let a later rename
rewrite history or an archive lose it.

**Backfilled.** The seven imported months get a `created` entry attributed to
"Imported from the tracking sheet", so the log starts at the beginning rather
than mid-story, and does not claim a person typed them.

**Not writable.** No update or delete policy. An audit trail that can be
rewritten is not one; a wrong figure is corrected on the donation, which writes
another entry.

**What it does not catch:** a figure edited directly in the Supabase table
editor. Writes go through the service-role client, so `auth.uid()` is null and a
database trigger could only ever record an anonymous change. The application
knows who the person is, so the application writes the log.

### The actor is the real person, not the previewed one

`loadCurrentPerson` answers with the impersonated person while View Stage is on.
That is correct for deciding what a screen may show and wrong for a log: an
entry naming the person being previewed would name someone who was not at the
keyboard. `currentActor` reads the session instead, which View Stage does not
touch.

### The records screen

`/tools/time-report/grant-pass/donations`, linked beside the "Money in" button.

Two tables. **Entries** is what the figures are now, with inline editing of the
amount and the note and a delete. **Change log** is what has happened to them,
newest first, and cannot be edited.

Editing is inline rather than through the month dialog on purpose: the dialog
asks about a month and shows every project in it, which is right when entering
what arrived and wrong when you have found one wrong figure.

Gated tighter than the report it belongs to. The report's grant decides who
reads the figures; this page also requires the privileged tier, because it names
who changed what. That is admins and the Admin Assistant, the same pair that may
write them.

### A data-loss bug fixed on the way

The month dialog calls `saveDonation` with the amounts only, and the action was
writing `note: null` whenever no note was passed. The first time anyone re-saved
a month, the note on that row would have been erased, and the new log would have
recorded a note change nobody made.

`undefined` now means "leave the note alone" and an empty string means "clear
it". The two were being treated as the same answer, and they are not.

---

## Test list

| # | What was asked | What was done | How to test |
|---|---|---|---|
| 1 | Show where the records live | A records screen listing every entry | Open the Project Hours & Others report as an admin, click **Donation records** beside "Money in". Seven rows, January to July, AAAF |
| 2 | Same | Reachable only by the right people | Sign in as someone without the privileged tier. The link is absent and the URL redirects to the report |
| 3 | Is the history recorded? | A log of every change | Edit any figure on the records screen. A row appears in **Change log** showing the old figure, the new one, your name and the time |
| 4 | Same | Corrections are counted | Edit the same figure twice. Its "Last changed" cell says "corrected 2×" |
| 5 | Same | Creating is not a correction | A figure that has only ever been entered shows no correction count |
| 6 | Same | Deletions stay in the log | Delete an entry. The row leaves **Entries**, and **Change log** keeps a `deleted` row with the figure struck through |
| 7 | Quanto, quando, para que projeto | Every log row names all three | Read any **Change log** row: project, month, and the amount before and after |
| 8 | Same | Filter by year | Use the year chips. Both tables narrow; the chips themselves do not |
| 9 | The imported months | Backfilled, not blank | The seven January to July rows show "Imported from the tracking sheet" rather than a person |
| 10 | The dead `note` field | Now readable and editable | The imported rows show "Ed & other donations, from the tracking sheet" in the Note column. Edit one |
| 11 | Notes must not be silently wiped | `undefined` no longer clears | Open **Money in**, re-save a month that has a note, and check the note is still on the records screen and that no note change was logged |
| 12 | Before the migration is applied | The page degrades rather than crashes | Verified against the live database with the log table absent: the seven entries load and the log section says the table is not there yet |
| 13 | Who is recorded under View Stage | The real person | With View Stage active, edit a figure. The log names your own account, not the previewed person |

Checks 1 to 11 and 13 need migration 080 applied and a login. Check 12 was run
against the real database before the migration existed.
