# Questions for Tina, and her answers

Asked 9 September 2026, answered the same morning. Kept because two of the
answers removed work rather than adding any, and the reasons are not obvious from
the code that came out of them.

---

**1. Donations: one line each, or one total per month?**

> "I don't list each donation. Only the total donated for the month. Below is
> the donation information for Jan through July. I will get back with you on Aug."

**Monthly totals.** This is what `tc_project_donations` already was, so nothing
changed. The consequence to remember: the month is the finest date there is, so a
donations report can say which month and which project, never which day.

She sent January to July with her answer. **Not yet entered.**

---

**2. If one by one, does the donor's name go on it?**

> "These reports are only for Dave, myself and Ed."
>
> "I don't know what you mean, but if you are referring to donors we have a donor
> database that tracks everything. These reports are just cost information for
> our financial planning."

**No donor names.** There is a donor database elsewhere and this is not it, so
nothing here is personal data. That is why the read policy can stay "anyone who
can open the report".

Her first line answers a question that was not asked and is worth acting on:
the audience is **Dave, Tina and Ed**. Whether the `grant-pass-report` grant
matches that has not been checked.

---

**3. Do Grants Pass Church or School ever receive donations?**

> "These two are client projects (work on their websites), so they do not get
> donations. AAAF and HFA are projects that we sometimes get donations for."

**No.** The form now offers two donation fields rather than four, and the report's
donation cells for Church and School are blank permanently. `prepaid` in
`TRACKED_PROJECTS` already separated the same two, so the code reads that rather
than carrying a second list.

---

**4. Should the unrestricted fund be inside the Totals line?**

> "These reports should never show restricted verses unrestricted. That part is
> all done in our accounting."

**A better answer than the question deserved.** The split is settled before a
figure reaches the portal, so the Unrestricted row, its form field and its data
bucket were removed. What arrives is already a project's money.

`tc_project_donations.project_label` stays nullable, which is now dead capability.
Harmless, and left rather than migrated away.

---

**5. Do you want a note against a figure?**

Misread as a question about donors; see 2. Taken as **no**, since the report is
"just cost information for our financial planning" and nobody asked for it. The
column exists in the table and the form does not offer it.

---

## Follow-up, in the same thread

> "Ignore the lines on this spreadsheet that show GP school website and GP church
> invoices. The school website is already accounted for on the portal report and
> the line that shows GP church invoices is also already accounted for in the
> donations section of the portal report."

Checked against her figures, and it matters more than it reads. Her **Net** row
*includes* those two lines: March AAAF is −47,587.23 on her sheet, where
`467 − (35,908.31 + 12,470.92)` gives −47,912.23. The $325 difference is exactly
the GP School Website line.

The portal must not fold that income into AAAF, because it already sits on the
Grants Pass row as hours bought in advance. So **the portal's AAAF net will differ
from her sheet's by exactly those lines**, and the portal's is the correct
attribution.

**She has not been told this.** Worth doing before she spots it.
