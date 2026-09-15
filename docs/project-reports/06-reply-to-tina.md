# Reply to Tina, 15 September 2026

Answers her reply to `05-message-to-tina.md` and asks her to test the new CSV.
Her points are answered in the order she raised them. Short, like 05, because
long messages have come back as too long.

Three choices behind it:

- **Joy Deche's cost is mentioned.** Tina's screenshot of the month by month
  table was taken before Joy had a break-even rate, when her hours counted as
  $0. The rate was set in Rates & Costs on 14 September 2026 (tr_audit_log,
  `person_be_rate`, null to a figure), and since `people.be_rate` has no date,
  every month of 2026 recalculated. Hope for Africa's employee costs rose by
  exactly Joy's hours at that rate: January 168 h, $11,020.80. Without a word
  about it, the first thing Tina would find when comparing the CSV with her
  screenshot is Hope for Africa costing three times what it did.
- **The rate itself is not in the message.** An individual's rate is kept out of
  the column grants for a reason. The report already shows the project totals.
- **Ed's access is not mentioned.** 05 had a paragraph saying Ed can open the
  reports; the message actually sent left it out.

---

Hi Tina,

Thanks, all noted: the Net stays as is until you talk to Ed, departments wait for your T-Sheets changes, and the People tab stays as is.

Your points are done on the report (refresh it if it's open):

1. Team: it only ever filtered the person columns on the People tab, which is why you saw no difference. It now shows only on that tab, and the totals still count everyone.

2. CSV: Export now has a "Month by month" row. Could you test it? Click Export, then the CSV icon on that row, and compare the file with the "2026, month by month" table. It covers January to the month you have selected. Let me know if it works for what you need, including printing.

3. Contractor costs: removed for GP Church and School. If a contractor ever logs time there, the line comes back on its own.

4. Info text: you're right, HFA is a job code, and that's corrected. What it meant: about a quarter of HFA's hours this year are logged under True North job codes (like Project Management or Web Dev) with "2 Project" set to Africa, so counting the HFA job code alone comes out short. The gaps came from comparing a few months with your 2025 sheet while I built the report, and "corrections and retroactive approvals" was my guess at the cause, not something the portal shows. I took both out.

Also: HFA's employee costs are now higher than in your screenshot. Joy Deche had no break-even rate, so her hours counted as $0. Her rate was added on September 14, so every month of 2026 now includes her cost.

Heads-up on your T-Sheets changes: this report counts by "2 Project", so moving job codes won't affect it as long as those names stay the same. The i7 report counts the job codes under i7, so a code moved out of that group would drop out of it. Let me know when you're done and I'll check both reports.

Thanks,
Arnaldo
