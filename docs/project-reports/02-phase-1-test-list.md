# Phase 1, donations: what was asked, what was done, how to test

## Before anything else

**Migration 079 has to be applied**, or every test below fails at the first
step with a missing table. Paste `supabase/migrations/079_project_donations.sql`
into the Supabase SQL Editor and run it. It creates `tc_project_donations` and
its policies, and touches nothing that already exists.

Nothing here is deployed yet. Test on localhost first.

## What was asked, and what was done

| What was asked | Where it came from | What was done |
| --- | --- | --- |
| The report's donation columns should hold real figures | Her layout has "Donations this month" and "Total Donations 2026" | Both columns read from a new table and fill in |
| The figures are entered by hand | "I will need to manually enter the donations as there isn't a way to add that in the workflow" | A **Money in** dialog on the report toolbar |
| A donation may belong to no project | "otherwise the donation goes under unrestricted and used for all projects" | The project is nullable; the fund gets its **own row**, not a share of the four |
| Donations are money, never hours | "It doesn't translate into hours for this purpose" | No rate, no conversion. The row's hours and cost cells stay empty |
| Prepaid stays separate | "The pre-paid is separate and only for the Church and School. That is the $90 hourly rate" | Unchanged, and now editable from the same dialog |
| Nothing was asked here | Found while building | `tc_project_purchases` had a table since migration 062 and no way to write to it. Every Grants Pass purchase was a hand-written INSERT. It is now on the screen |

## How to test

Each test says what to do and what should happen. The report is at
**Tools & Dashboards → Client Report · Project Hours & Others**.

### 1. The button is there, and only for the right people

- **As you (admin):** open the report. A navy **Money in** button sits beside
  Add hours. → It is there.
- **As Tina (admin assistant):** same page. → The button is there for her too.
  This is the one worth checking, because the obvious permission check would
  have hidden it from her and she is the person with the figures.
- **As a team leader or a user:** if they can open the report at all, the button
  is **not** there.

### 2. A donation against a project

- Open **Money in**, type `2450` under AskAnAdventistFriend.com, Save.
- → The dialog closes and the report's **Donations** column shows `$2,450.00`
  on the AAAF row.
- → **Total Donations 2026** shows the same figure, since it is the only month
  entered so far.
- → The Totals row at the foot shows `$2,450.00`.

### 3. An unrestricted donation

- Open **Money in**, type `6100` under **Unrestricted (no project)**, Save.
- → A new row appears under Hope for Africa, labelled **Unrestricted / not a
  project**.
- → Its donation cells show `$6,100.00`. Every other cell on that row is empty:
  no hours, no costs, no prepaid. A fund has none of those.
- → The Totals row now shows `$8,550.00`, which is 2,450 + 6,100.

### 4. Blank means blank, and is how you undo

This is the one to be fussy about, because the report is copied into a
financial report for Ed.

- A project with nothing entered shows an **empty** donation cell, not `$0.00`.
- Enter `0` for Hope for Africa and Save. → It shows `$0.00`. That is a real
  answer: nothing came in.
- Clear the field entirely and Save. → The cell goes **back to empty**, and the
  row is removed from the table. That is how a figure entered by mistake is
  taken out.

### 5. It accumulates across months, and only within the year

- Enter a donation in August, another in September.
- → On September, **Donations this month** shows only September's.
- → **Total Donations 2026** shows both added together.
- → Switch to August: this month shows August's, and the year to date shows only
  August's, because the year runs to the month you are looking at, not past it.

### 6. Prepaid hours, which used to need me

- Open **Money in**, and under **Hours bought in advance** put `11.25` against
  Grants Pass School with `1012.50` invoiced. Save.
- → The School row's **Prepaid** column shows `11.25`.
- → **Remaining** moves by the same amount.
- → Church and School are the only two offered. AAAF and Hope for Africa have no
  fields there, because they do not buy hours.

### 7. Bad input is refused, not stored

- Type `-50` into any amount. Save. → "The amount cannot be negative." Nothing
  is saved.
- Type `two thousand`. Save. → "The amount has to be a number."
- Type `$1,234.56`. Save. → Accepted as `1234.56`. Figures pasted from a bank
  statement keep their dollar sign and commas, so those are stripped rather than
  refused.

### 8. Reopening shows what is stored

- Save some figures, close the dialog, reopen it.
- → The fields are filled with what was saved, not empty. Editing and entering
  are the same act, and a form that opened empty over existing figures would
  invite somebody to type them twice.

## What is covered by tests, and what is not

Automated (`npm test`, 537 passing):

- The blank-versus-zero rule, in seven cases: empty, whitespace, a real zero,
  `$1,234.56`, rounding to the cent, text, and a negative.

Not automated, which is why the list above exists:

- Everything that needs the database and a signed-in person: the dialog saving,
  the report reading it back, and who can see the button. These need a login and
  live data, so they are yours to check.

## Still open, and worth asking her

1. **Should the unrestricted fund be inside the Totals line, or outside it?**
   Today it is inside: the Totals row adds the four projects and the fund. The
   Unrestricted row sits directly above, so the arithmetic is visible, but it
   does add a fund to a set of projects.
2. **Do Grants Pass Church or School ever receive donations?** Her layout gives
   them a donations column, but they are prepaid rather than donation funded, so
   those cells may be blank permanently.
3. **Does she want a note against a figure?** The table stores one and the form
   does not offer it yet, on the grounds that nobody asked.
