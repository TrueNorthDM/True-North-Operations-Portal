# Phase 1, donations: what was asked, what was done, how to test

**Status:** deployed to production. **Migration 079 is applied**, and both tables
were confirmed reachable from the app. Everything below is ready to test.

The report is at **Tools & Dashboards → Client Report · Project Hours & Others**.

## What was asked, and what was done

| What was asked | Where it came from | What was done |
| --- | --- | --- |
| The donation columns should hold real figures | Her layout has "Donations this month" and "Total Donations 2026" | Both columns read from `tc_project_donations` |
| The figures are entered by hand | "I will need to manually enter the donations as there isn't a way to add that in the workflow" | A **Money in** dialog on the report toolbar |
| A donation may belong to no project | "otherwise the donation goes under unrestricted and used for all projects" | The project is nullable, and the fund gets its **own row** rather than a share of the four |
| Donations are money, never hours | "It doesn't translate into hours for this purpose" | No rate, no conversion. That row's hours and cost cells stay empty |
| Prepaid stays separate | "The pre-paid is separate and only for the Church and School. That is the $90 hourly rate" | Unchanged, and now editable from the same dialog |
| The toolbar should match the i7 report | Asked while looking at the page | Navy, white, navy with the gold on Export; the "i" above the buttons |
| The same period filter as i7 | Asked while looking at the page | The same control, four ways of asking. Over a range everything sums except the prepaid balance, which is a walk |
| The same team filter as i7 | Asked while looking at the page | Narrows the People columns, never the totals |
| Export like i7: internal and client, PDF and CSV | Asked while looking at the page | An Export menu. CSVs follow the period; PDFs wait for a single month |
| Is "Last synced" right here? | Asked, and it was not | **"Last updated"**, the newest of three sources: the import, hours added by hand, and money typed in |
| *Nothing was asked here* | Found while building | `tc_project_purchases` had a table since migration 062 and no way to write to it. Every Grants Pass purchase was a hand-written INSERT |

## How to test

### 1. The button is there, and only for the right people

**Do not skip.** The obvious permission check would have hidden this from the one
person who holds the figures.

- **As you (admin):** a navy **Money in** button, then white **Add hours**, then
  navy **Export**.
- **As Tina (admin assistant):** the same three. Money in must be there for her.
- **As a team leader or user:** if they can open the report at all, Money in is
  **not** there.

### 2. A donation against a project

Open **Money in**, type `2450` under AskAnAdventistFriend.com, Save.

- The AAAF row's **Donations** shows `$2,450.00`
- **Total Donations 2026** shows the same, it being the only month entered
- The Totals row shows `$2,450.00`

### 3. An unrestricted donation

Type `6100` under **Unrestricted (no project)**, Save.

- A new row appears under Hope for Africa: **Unrestricted / not a project**
- Its donation cells show `$6,100.00`, and every other cell on that row is empty:
  no hours, no costs, no prepaid
- Totals now reads `$8,550.00`, which is 2,450 + 6,100

### 4. Blank means blank, and is how you undo

**Do not skip.** These figures are copied into a financial report for Ed, so
"nobody has said" and "nothing came in" have to stay different. It is also the
only way to take out a figure entered by mistake.

- A project with nothing entered shows an **empty** cell, not `$0.00`
- Enter `0` for Hope for Africa, Save. It shows `$0.00`: a real answer
- Clear the field entirely, Save. The cell goes **back to empty** and the row is
  removed

### 5. The period filter

- It opens on **the current month**, and the PDF options in Export are available
- Choose **A calendar year**. The middle block of columns is now headed with the
  span, not "This month", and the figures cover the whole range
- The prepaid balance still walks: **Carried in** is what was left entering the
  range, **Remaining** is where it stands at the end
- Choose **Last 12 months**. It stops at January 2026, because there is no budget
  or rate before that

### 6. The team filter

- Pick a team. On the **People** tab, only that team's people keep columns
- The **Totals** row does not change. A partial view must not read as a whole one

### 7. Export

- With a **single month** chosen, all four buttons are live
- Choose a **year**. The two PDF buttons and the PDF column header go grey, the
  CSVs stay live, and a line appears saying why
- **Client CSV**: one row per project, plus the Unrestricted row and a total
- **Internal CSV**: one row per project per person, with hours. It carries names
- **Client PDF**: opens a preview first, and only then offers the download.
  *This is the least-tested thing in the phase: it has never been generated,
  because it runs headless Chromium behind the login. Try it early.*

### 8. Prepaid hours, which used to need a developer

Under **Hours bought in advance**, put `11.25` against Grants Pass School with
`1012.50` invoiced. Save.

- The School row's **Prepaid** shows `11.25`, and **Remaining** moves by the same
- Only Church and School are offered. The other two do not buy hours
- Pick **May 2026** and reopen the dialog: it should already show `11.25`, from
  the figure migration 062 seeded

### 9. Bad input is refused, not stored

- `-50` → "The amount cannot be negative." Nothing saved
- `two thousand` → "The amount has to be a number."
- `$1,234.56` → accepted as `1234.56`. Figures pasted from a bank statement keep
  their dollar sign and commas, so those are stripped rather than refused

### 10. Reopening shows what is stored

Save some figures, close the dialog, reopen it. The fields are filled with what
was saved, not empty. A form that opened empty over existing figures would invite
somebody to type them twice.

### 11. Last updated

- Enter a donation. The badge should move to **"Last updated just now"**
- Hover it: it names which of the three sources moved
- This is the point of it. A "Last synced" badge would not have moved at all,
  because a sync is only one of the three things that change this page

## What tests cover, and what they cannot

**Automatic, 542 passing:** the blank-versus-zero rule in seven cases; the
"newest of three sources" rule behind Last updated, including money entered by
hand beating an older import; and that a range split by month adds back up to
the range built in one go.

**Yours to check:** everything needing the database and a signed-in person. The
dialog saving, the report reading it back, who can see the button, and the PDF
generating. That is what the list above is for.

## A known gap, not a bug

**There is no donation history.** The table holds one row per project per month.
Saving overwrites it and clearing deletes it, so if a figure is corrected from
2,450 to 2,600 the 2,450 is gone, and nothing records who changed it. The month
is the finest date there is: no donation carries a day.

This was a deliberate choice when nobody had asked for donation reporting. That
has now changed, and answering "how much was donated, when, and to which project"
needs one row per donation rather than one per month. See
`04-donation-history.md` once the questions in `03-questions-for-tina.md` come
back.

The table is currently **empty**, so the model can still be changed for the cost
of a migration. That stops being true once figures are entered.

## Still open, worth asking her

Now written up as questions in `03-questions-for-tina.md`:

1. Whether the unrestricted fund belongs inside the Totals line or outside it
2. Whether Grants Pass Church or School ever receive donations
3. Whether a donation needs a note against it
4. Whether donations should be recorded one by one, with a date
