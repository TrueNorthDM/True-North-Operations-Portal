# Phase 1, donations: what was asked, what was done, how to test

**Status:** deployed to production. **Migration 079 is applied**, and both tables
were confirmed reachable from the app. Everything below is ready to test.

The report is at **Tools & Dashboards → Client Report · Project Hours & Others**.

## What was asked, and what was done

| What was asked | Where it came from | What was done |
| --- | --- | --- |
| The donation columns should hold real figures | Her layout has "Donations this month" and "Total Donations 2026" | Both columns read from `tc_project_donations` |
| The figures are entered by hand | "I will need to manually enter the donations as there isn't a way to add that in the workflow" | A **Money in** dialog on the report toolbar |
| Only two projects receive donations | "These two are client projects, so they do not get donations. AAAF and HFA are projects that we sometimes get donations for" | The form offers two donation fields; Church and School have none |
| Never show restricted versus unrestricted | "That part is all done in our accounting" | The Unrestricted row, field and bucket were built and then removed |
| Donations are a monthly total | "I don't list each donation. Only the total donated for the month" | One row per project per month, which is what the table already was |
| Net: donations minus costs | Her sheet has it as a row per month | On screen, in the printed sheet and in both CSVs, red when short and green when ahead |
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

### 3. Only two projects can receive one

Open **Money in**.

- There are exactly **two** donation fields: AskAnAdventistFriend.com and Hope
  for Africa
- Grants Pass Church and School have none. "These two are client projects (work
  on their websites), so they do not get donations"
- There is no Unrestricted field. "These reports should never show restricted
  verses unrestricted. That part is all done in our accounting"
- On the report, the donation cells for Church and School are blank permanently,
  and there is no fifth row under Hope for Africa

### 4. Blank means blank, and is how you undo

**Do not skip.** These figures are copied into a financial report for Ed, so
"nobody has said" and "nothing came in" have to stay different. It is also the
only way to take out a figure entered by mistake.

- A project with nothing entered shows an **empty** cell, not `$0.00`
- Enter `0` for Hope for Africa, Save. It shows `$0.00`: a real answer
- Clear the field entirely, Save. The cell goes **back to empty** and the row is
  removed

Watch the **Net** column while doing this. With no donation it is minus the
costs; entering one moves it by exactly that amount.

### 5. The period filter

**Do not skip the second step.** Choosing a *mode* always worked; choosing a
*month or year* inside it did nothing at all until 9 September, because the
dropdown's menu renders in a portal and the popover treated clicking an option as
clicking outside itself. This was broken on the i7 report and the Full history
export too.

- It opens on **the current month**, and the PDF options in Export are available
- Open it and **pick a different month from the dropdown**. The report must
  change, and the button must show the month you chose
- Choose **A calendar year**, then **pick a year from the dropdown**. Same test
- The middle block of columns is now headed with the span, not "This month", and
  the figures cover the whole range
- The prepaid balance still walks: **Carried in** is what was left entering the
  range, **Remaining** is where it stands at the end
- Choose **Last 12 months**. It stops at January 2026, because there is no budget
  or rate before that

### 6. The team filter

- Pick a team. On the **People** tab, only that team's people keep columns
- The **Totals** row does not change. A partial view must not read as a whole one

### 7. Net

- **Net** sits at the end of the This month block: donations minus employee and
  contractor costs. Red when short, green when ahead
- It is **blank for Church and School**. Their income is prepaid hours, not
  gifts, so donations minus costs would not be their net of anything
- There is deliberately **no year-to-date Net**. Her sheet has none, and its two
  inputs are both on the row

### 8. Export

- With a **single month** chosen, all four buttons are live
- Choose a **year**. The two PDF buttons and the PDF column header go grey, the
  CSVs stay live, and a line appears saying why
- **Client CSV**: one row per project, with Net, and a total
- **Internal CSV**: one row per project per person, with hours. It carries names
- **Client PDF**: opens a preview first, and only then offers the download.
  *This is the least-tested thing in the phase: it has never been generated,
  because it runs headless Chromium behind the login. Try it early.*

### 9. Prepaid hours, which used to need a developer

Under **Hours bought in advance**, put `11.25` against Grants Pass School with
`1012.50` invoiced. Save.

- The School row's **Prepaid** shows `11.25`, and **Remaining** moves by the same
- Only Church and School are offered. The other two do not buy hours
- Pick **May 2026** and reopen the dialog: it should already show `11.25`, from
  the figure migration 062 seeded

### 10. Bad input is refused, not stored

- `-50` → "The amount cannot be negative." Nothing saved
- `two thousand` → "The amount has to be a number."
- `$1,234.56` → accepted as `1234.56`. Figures pasted from a bank statement keep
  their dollar sign and commas, so those are stripped rather than refused

### 11. Reopening shows what is stored

Save some figures, close the dialog, reopen it. The fields are filled with what
was saved, not empty. A form that opened empty over existing figures would invite
somebody to type them twice.

### 12. Last updated

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

## What the model cannot do, by her own choice

**The month is the finest date there is.** "I don't list each donation. Only the
total donated for the month." So a donations report can say which month and which
project, never which day, and there is no record of a figure before it was
corrected. That is her working method rather than a gap to close.

## Still open

1. **Her January to July figures** are sent and not entered. August to follow.
2. **A donations report**: how much, when, for which project. Possible at month
   granularity.
3. **Who may open this.** "These reports are only for Dave, myself and Ed."
   Worth checking against who holds the `grant-pass-report` grant.
4. **The AAAF Net difference.** The portal does not fold the Grants Pass
   school-website income into AAAF, so its net differs from her sheet by exactly
   that line, $325 in March. Ours is the correct attribution. She has not been
   told.

Her answers are recorded in `03-questions-for-tina.md`.
