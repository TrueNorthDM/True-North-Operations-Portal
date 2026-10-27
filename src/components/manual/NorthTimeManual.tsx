/**
 * The System manual's Home and North Time sections (27 October 2026): the new
 * Home, North Time as built (the clock, the 2026 job structure, Time entries,
 * the hours allowance, timesheets, approvals, requests, invoices), a quick
 * start for each audience, the move from TSheets, and "Where do I find...".
 *
 * Every line is written from the screens themselves (the clock panel, Time
 * entries, Approvals, Requests, Invoices, Company settings, the TSheets
 * transition page), with the button and tab names as they appear there.
 * Static content: SystemManual draws these sections and lists their ids in
 * its table of contents (NORTH_TIME_TOC).
 */

import { Eyebrow, Heading, Lede, Rich, SubHeading, card } from './ManualParts'

export const NORTH_TIME_TOC = [
  { id: 'home', label: 'Home' },
  { id: 'north-time', label: 'North Time' },
  { id: 'quick-start', label: 'North Time quick start' },
  { id: 'transition', label: 'Moving from TSheets' },
  { id: 'where', label: 'Where do I find...' },
] as const

type Block = { t: string; d: string }

function Cards({ items, cols = 2 }: { items: readonly Block[]; cols?: 2 | 3 }) {
  return (
    <div className={`grid grid-cols-1 ${cols === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3`}>
      {items.map(c => (
        <div key={c.t} className={`${card} p-4`}>
          <div className="font-(family-name:--font-display) font-extrabold text-sm text-tn-ink">{c.t}</div>
          <div className="text-[13px] leading-relaxed text-muted mt-1.5"><Rich text={c.d} /></div>
        </div>
      ))}
    </div>
  )
}

// ── Home ────────────────────────────────────────────────────────────────────

const HOME: Block[] = [
  { t: 'Your day', d: 'The banner across the top greets you and says how many things need you today. It holds your clock: **On the clock** or **Off the clock**, today’s hours, the job you are on, **Switch**, and **Clock in** or **Clock out**. It is the same clock as the button in the top bar.' },
  { t: 'Needs you · My Work · Requests', d: 'One card with three tabs and their counts. **Needs you**: what waits for your decision or your action, only what you can act on. **My Work**: your Monday items due in the next 7 days or late. **Requests**: what you asked for and where it is. A row’s button (**Decide**, **Open**) opens a side panel whose buttons do the same as the page behind them.' },
  { t: 'To pay', d: 'For Super Admins, Admins and Finance: **Invoices to pay** and **Reimbursements to pay**, pinned at the top of Needs you, with how many, the total, and red while one is past due. **Open Invoices** and **Open Reimbursements** go to the lists where Finance pays them.' },
  { t: 'Pay period', d: 'Your current pay period: days worked, PTO, holidays (employees only) and sick days, the hours expected so far and your pace. It is also your timesheet reminder: amber on the day your period closes, red every day after until you send it. **Review and send** opens Time entries with Submit open. It never shows money.' },
  { t: 'Agenda', d: 'Who is **Out today**, what is on **Today**, and what is **Coming up** in the next month.' },
  { t: 'i7 Budget and Publishing goals', d: 'For people with the i7 report: the **Balance left** this month, with **Open report**. For Team Leaders and above: Publishing goals over the **Last 5 weeks**, every board against its targets.' },
]

export function HomeSection() {
  return (
    <section id="home" className="scroll-mt-6">
      <Eyebrow>Home</Eyebrow>
      <Heading>Home: what to do today</Heading>
      <Lede>Home answers one question for each person: what do I need to do today? Each part reads on its own. If one cannot be read, it says so in its own card, and the rest still shows.</Lede>
      <Cards items={HOME} />
      <p className="text-[13px] leading-relaxed text-muted mt-3">No longer on Home: favourite pages, the org chart (it is in People, Organization), birthdays and work anniversaries (they are in the Agenda) and the health banner (its alerts are Needs you rows).</p>
    </section>
  )
}

// ── North Time ──────────────────────────────────────────────────────────────

const NT: Block[] = [
  { t: 'The clock', d: 'The clock button in the top bar opens the clock panel. Pick **Resume** (your last job), one of **My combinations**, a **Recent** one, or search under **Something else** (**Browse** shows every job). Check the details and press **Clock in**. **Switch to** ends one entry and starts the next at the same second. There are no breaks: a break is a clock out. Times are kept on the nearest 15 minutes.' },
  { t: 'The 2026 job structure', d: 'From the switch date you pick a project as **Client › Division › Project**, then its **Activity**, grouped by family. **Billable** comes from the project and shows read only, “from the project”. **Notes** are required for **Other** and **Meeting: Other**. Before the switch date you pick the TSheets jobs, as before. **Which job?** lists every job and when to use it.' },
  { t: 'Combinations', d: 'Your favourites: a job with its Activity and note, saved under a name. Use **Save as combination** in the details, or the star on a Recent row. The panel shows the first 6; **More** shows the rest. **Manage** reorders, edits and deletes them. A combination on a TSheets job stops showing from the switch date; it is not deleted.' },
  { t: 'Time entries', d: 'Your hours as a **List**, a **Week grid** or a **Day timeline**, by day, week, month or pay period. Team Leaders and above switch **Whose hours** to **My team** or **All**. Users and Team Leaders can only shorten their own entries. **Add time** is for Team Leaders (their team), Admins and Super Admins; everyone else sends **Request a time correction**. Every change needs a reason and stays in the entry’s history.' },
  { t: 'Hours allowance', d: 'Each person can have an allowance a week or a month (Directory, the person’s Work tab, **Pay and hours**). It is a hard limit: when it is used, the clock stops by itself and nothing more can be added until extra hours are approved. From 90% the clock panel says how much is left and when the clock will stop. No allowance means your hours are never flagged as over.' },
  { t: 'Timesheets and approvals', d: 'Each person submits monthly or every 2 weeks. Hours are approved by the person they report to (Directory, Work tab, **Reports to**); a contractor’s invoice by the invoice approver in Company settings, Invoices; when it is the same person it is one step. A submitted period is locked until it is returned or a Super Admin reopens it.' },
  { t: 'Requests', d: 'In Requests on the rail: **Time off** (US employees), **Reimbursements** and **Extra hours**. Super Admins decide them. Time corrections are decided by the person’s Team Lead, an Admin or a Super Admin, never by the person.' },
  { t: 'Invoices and documents', d: 'A contractor’s invoice is made when they submit their timesheet, from their hours, their rate in Rates & Costs and their approved reimbursements. An employee’s approved reimbursements go on a reimbursement document. Finance pays both outside Rippling payroll and marks them paid.' },
]

export function NorthTimeSection() {
  return (
    <section id="north-time" className="scroll-mt-6">
      <Eyebrow>Time clock</Eyebrow>
      <Heading>North Time</Heading>
      <Lede>North Time is the portal’s own time clock. It replaces QuickBooks Time (TSheets): you clock in here, the portal keeps your hours, you submit them each pay period, and a contractor’s invoice is made from the same timesheet. It opens from the clock button in the top bar, from Home, and from North Time on the rail.</Lede>
      <Cards items={NT} />
    </section>
  )
}

// ── Quick start ─────────────────────────────────────────────────────────────

type Topic = { t: string; steps: readonly string[] }
type Audience = { id: string; who: string; intro: string; topics: readonly Topic[] }

const QUICK: Audience[] = [
  {
    id: 'qs-everyone', who: 'Everyone', intro: 'What every person does in North Time.',
    topics: [
      { t: 'Clock in and out', steps: [
        'Press the clock button in the top bar, or **Clock in** on Home.',
        'Pick **Resume**, one of **My combinations**, a **Recent** one, or search under **Something else**.',
        'Check the details and press **Clock in**. The timer starts at once.',
        'To stop, press **Clock out**. If the Activity or Notes are missing, the panel asks for them first. **Undo** shows for 10 seconds after.',
      ] },
      { t: 'Pick the Project and the Activity', steps: [
        'From the switch date, search or browse to the project: **Client › Division › Project**.',
        'Pick the **Activity** (type to search; they are grouped by family).',
        '**Billable** shows “from the project”: you do not choose it.',
        'For **Other** and **Meeting: Other**, write what you did in **Notes**: it is required.',
        'The Activity and Notes can wait while the clock runs, but you need them to switch or clock out.',
      ] },
      { t: 'Switch', steps: [
        'Open the clock while it runs.',
        'Under **Switch to**, pick a combination, or **Something else: search jobs**.',
        'One entry ends and the next starts at the same second.',
      ] },
      { t: 'Favourites (combinations)', steps: [
        'In the details, press **Save as combination**, or press the star on a **Recent** row.',
        'Give it a name and save. It shows under **My combinations**.',
        '**Manage** lets you drag them in order, **Edit** or **Delete** them. Deleting keeps the hours you already recorded.',
      ] },
      { t: 'Add time by hand', steps: [
        'Only Team Leaders (for their team), Admins and Super Admins see **Add time** on Time entries.',
        'Everyone else, and Team Leaders for their own hours, asks with a time correction (below).',
        'In **Add time**: the date, the start and end (or a duration), the job and Activity, and the reason. Then **Save**.',
      ] },
      { t: 'Request a correction', steps: [
        'Open North Time, **Time entries**, and press **Request a time correction**.',
        'Pick the **Date**, **Start** and **End**.',
        'Pick a combination under **Use a combination**, or the job and Activity.',
        'Write **What happened (required)** and press **Send request**. The window says who it goes to.',
        'The time counts only after it is approved. The answer comes to your bell.',
      ] },
      { t: 'Request extra hours', steps: [
        'Open Requests, **Extra hours**, and press **Ask for extra hours** (the clock panel links there too).',
        'Fill in **How many hours**, **Which week or month**, **Client or project** and **Why**.',
        'Press **Send request**. A Super Admin decides.',
        'Approved hours are added to your allowance for that week or month.',
      ] },
      { t: 'The hours allowance and the hard limit', steps: [
        'The clock panel shows your allowance: “This week 12h of 40h”.',
        'From 90% it shows the hours left and, while the clock runs, the time it will stop by itself.',
        'When the allowance is used, your clock stops, and **Clock in**, **Switch** and adding time are refused.',
        'Ask for extra hours before you need them, not after.',
      ] },
      { t: 'Submit your timesheet', steps: [
        'When your period closes, Home’s **Pay period** card turns amber (red once it is late).',
        'Press **Review and send**, or **Submit** with your period’s name on Time entries.',
        'If your clock is running, clock out first.',
        'Fix anything listed under **Fix these first**, then check the total and **By client**.',
        'Press **Submit**. The period locks. If your approver returns it, you see why, fix it and submit again.',
      ] },
      { t: 'Time off (US employees)', steps: [
        'Open Requests, **Time off**, and press **Request time off**.',
        'Pick the **Type** and the **Dates** (one day or a range), full days or hours a day, and add a note if you like.',
        '**Who else is off** shows who on your team is off those days.',
        'Press **Send request**. A Super Admin decides, and you get a notification.',
        'Company holidays are off for everyone and are not asked for. Vacation, Sick, Holiday and Jury duty are never clocked.',
      ] },
      { t: 'Reimbursements', steps: [
        'Open Requests, **Reimbursements**, and press **New request**.',
        'Add a line for each receipt: you can drop several photos and PDFs at once, so one request can hold a whole trip.',
        'For each line: the date, the category, the amount, what it was for, and its photo or PDF.',
        'Press **Send request** (**Send 3 receipts** when there are three). A Super Admin decides each receipt.',
        'Contractors: each approved receipt goes on your next invoice as its own line. Employees: approved receipts go on a reimbursement document that Finance pays, outside Rippling payroll.',
      ] },
    ],
  },
  {
    id: 'qs-contractors', who: 'Contractors', intro: 'Your invoice is made from your timesheet. You never type hours or your rate.',
    topics: [
      { t: 'The invoice made with your timesheet', steps: [
        'When you submit, the window shows **Your invoice**: its lines and the total, and who approves it.',
        'Submit, and the invoice is made at the same time. You see it after you submit.',
        'If Rates & Costs has no rate (or no amount a month) for you, the window says the invoice cannot be made yet. Ask a Super Admin to add it.',
        'Paid a fixed amount with no timesheet? Your invoice is made by itself on the 1st of the month.',
      ] },
      { t: 'What is on it', steps: [
        'Its number (like INV-2026-001), the date, the period and the due date.',
        'From: your name, country and email from the Directory. To: True North’s billing details.',
        'Paid by the hour: one line per client, your hours times your rate. Fixed monthly: one line for the fixed amount, with your hours listed for the record.',
        'Each approved reimbursement as its own line, then the total due, in US dollars.',
      ] },
      { t: 'Payments', steps: [
        'Open North Time, **Invoices** (**My invoices**) to see each invoice and where it is, for example **Waiting for approval**, **Approved** or **Paid**.',
        '**Preview PDF** shows the invoice; download it from the preview.',
        'Finance pays approved invoices outside Rippling and marks them paid with the day.',
        'Your bell tells you when an invoice is created, approved, returned (with the reason) and paid.',
        'You are paid for hours worked: a company holiday adds no hours for a contractor.',
      ] },
    ],
  },
  {
    id: 'qs-leaders', who: 'Team Leaders', intro: 'You approve and fix your team’s hours. You never see money.',
    topics: [
      { t: 'Approve hours', steps: [
        'Open North Time, **Approvals**. **Waiting for you** lists the timesheets of the people who report to you.',
        'Press **Review** to open the timesheet: the summary by client and by day, and every entry.',
        'Press **Approve hours** for a contractor (the invoice approver then finishes it) or **Approve and send to Rippling** for an employee. Or press **Return**, with a reason.',
      ] },
      { t: 'Change only your team’s hours', steps: [
        'On Time entries, set **Whose hours** to **My team** and pick the person.',
        'Use **Add time**, edit an entry, the **Week grid** or the **Day timeline**. Every change needs a reason and is kept in the history.',
        'Your own hours work like everyone’s: you can only shorten them, and missing time goes through **Request a time correction**.',
        'Your own corrections are decided by another Lead of a team you are on, an Admin or a Super Admin.',
      ] },
      { t: 'Corrections', steps: [
        'Time corrections from your team show in **Approvals**, **Waiting for you**.',
        'Press **Approve**, or **Deny** with a reason. Approved, the time counts, but never past the person’s allowance.',
      ] },
      { t: 'Extra hours', steps: [
        'Open Requests, **Extra hours**, **Ask for extra hours**, and pick the person under **For**.',
        'Ask before they go over. A Super Admin decides.',
        'If someone on your team goes over without approval, your bell tells you.',
      ] },
      { t: 'Never any money', steps: [
        'You see no invoices, rates or amounts: a timesheet in Approvals says **Hours only**.',
        'Reports show your teams’ hours only. Time off for your team is decided by Super Admins; your bell tells you when someone asks.',
      ] },
    ],
  },
  {
    id: 'qs-admins', who: 'Admins, Super Admins and Finance', intro: 'Decisions, payments and the company settings behind North Time.',
    topics: [
      { t: 'Approvals', steps: [
        'North Time, **Approvals**: **Waiting for you**, **With others** (read only) and **Decided** (the last 90 days).',
        'Super Admins decide time off, reimbursements (each receipt) and extra hours. Admins and Super Admins decide time corrections for everyone.',
        'A timesheet goes to the person’s Reports to; the invoice to the approver in Company settings, Invoices.',
        'Hours over the allowance that were not approved before: **Approve** still works, with a **Note to approve (required)**.',
        'A Super Admin can **Reopen** an approved timesheet until its invoice is paid.',
      ] },
      { t: 'Invoices to pay and Mark paid', steps: [
        'Home shows **Invoices to pay**; **Open Invoices** opens North Time, Invoices on the approved ones.',
        'Filter by state (**Waiting for approval**, **Approved, not paid**, **Paid** in the month), person and period; **Export CSV**; **Preview PDF**.',
        'Only Finance marks paid, after the money left: **Mark paid**, then **Paid on**, an optional reference and note. It can be done once.',
        'Admins and Super Admins who are not Finance see what waits, but do not mark it paid.',
      ] },
      { t: 'RMB documents', steps: [
        'A reimbursement document (like RMB-2026-001) is made when a Super Admin approves an employee’s reimbursement.',
        'Find them in Requests, **Reimbursements**, **Documents**, or from Home’s **Reimbursements to pay** (**Open Reimbursements**).',
        'Open one and press **Preview PDF**: the document comes first, then each receipt as its own page.',
        'Finance pays it outside Rippling payroll, then presses **Mark paid**, as for invoices.',
      ] },
      { t: 'Company settings', steps: [
        'Admin, **Company settings**. Admins read these sections; Super Admins change them.',
        '**Job catalogue**: the 2026 structure beside the TSheets jobs. Add clients, divisions and projects; options are hidden, never deleted. From the switch date a TSheets job can be switched off, never renamed or moved.',
        '**Invoices**: the prefixes and the next number (the count never restarts, only the year changes), who approves invoices, True North’s billing details and the payment terms.',
        '**Reminders**: turn each timesheet reminder on or off; **See them in the bell**.',
        '**North Time rollout**: each wave’s start date, who is in each wave (**Move to wave 1** or **2**, **Follow their level**), **Save dates**, and **Clocked in TSheets after switching**.',
        '**Timesheet periods**: when pay periods start and who submits how.',
      ] },
      { t: 'The TSheets transition page', steps: [
        'North Time, **TSheets transition** (Super Admins and Admins). Reading only: nothing there changes an entry.',
        'It lists every TSheets entry from the switch date: **As recorded in TSheets** beside **How the portal read it** (Client, Division, Project, Activity, Billable).',
        'Problems come first: an unknown job, an old TSheets job after the switch, a folder instead of a project, a project with no Activity, Notes missing for Other or Meeting: Other.',
        'Filter by **From**, **Person** and **Show** (**Every entry** or **Only problems**). Fix a problem in TSheets before a report uses it.',
        'With no switch date set, the page says so and shows nothing else.',
      ] },
    ],
  },
]

export function QuickStartSection() {
  return (
    <section id="quick-start" className="scroll-mt-6">
      <Eyebrow>Quick start</Eyebrow>
      <Heading>North Time quick start</Heading>
      <Lede>Short steps for each kind of person. Start with Everyone, then read your own part.</Lede>
      <div className="flex flex-col gap-4">
        {QUICK.map(a => (
          <div key={a.id} id={a.id} className={`${card} p-5 scroll-mt-6`}>
            <div className="font-(family-name:--font-display) font-extrabold text-base text-tn-ink">{a.who}</div>
            <p className="text-[13px] leading-relaxed text-muted mt-1">{a.intro}</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-4 mt-4">
              {a.topics.map(t => (
                <div key={t.t} className="min-w-0">
                  <div className="font-(family-name:--font-display) font-extrabold text-[13.5px] text-tn-ink mb-1.5">{t.t}</div>
                  <ol className="list-decimal pl-5 space-y-1 text-[13px] leading-relaxed text-foreground">
                    {t.steps.map(s => <li key={s}><Rich text={s} /></li>)}
                  </ol>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── The move from TSheets ───────────────────────────────────────────────────

const WAVES: Block[] = [
  { t: 'Wave 1: Sunday, Nov 8', d: 'Team Leaders and above: every Super Admin, Admin and Lead of a team, plus anyone a Super Admin moves there by hand.' },
  { t: 'Wave 2: Sunday, Nov 22', d: 'Everyone else. Both days are the first day of a two-week pay period, so no employee’s period is split between the two apps.' },
]

const SWITCH: Block[] = [
  { t: 'Before your date', d: 'The clock does not start for you. **Clock in** and **Switch** are refused, and the clock panel says the day, for wave 2: “You start on North Time on Sunday, Nov 22. Until then, keep clocking in TSheets.” Keep clocking in TSheets: those hours come into the portal and count the same. Adding time by hand and approvals are not affected.' },
  { t: 'On your date', d: 'North Time’s clock opens for you. The TSheets import stops taking your entries dated on or after that day. A TSheets entry made after it is set aside, never counted twice, and listed for someone to decide. Your TSheets account is archived that day, so nobody clocks in both apps (North Time rollout says whether archiving is on).' },
  { t: 'Why the jobs change on the switch date', d: 'The 2026 structure says who pays (Client), what the work serves (Division and Project), what kind of work it was (Activity) and whether it can be invoiced (Billable, from the project). The switch date is the day it starts; it does not have to be a wave day. Translating each old TSheets entry would mean guessing its division and project, so from that day TSheets and North Time both record in the new structure.' },
  { t: 'Old hours keep the old structure', d: 'Nothing before the switch date changes. Old entries keep their TSheets job and fields for good. From the switch date the TSheets jobs are frozen: they can be switched off, never renamed or moved, so the history keeps its names. Reports read each entry by its date, and put both sides next to each other.' },
]

export function TransitionSection() {
  return (
    <section id="transition" className="scroll-mt-6">
      <Eyebrow>The transition</Eyebrow>
      <Heading>Moving from TSheets</Heading>
      <Lede>People move to North Time in two waves. A Super Admin sets each wave’s day in Company settings, North Time rollout, and the portal applies it by itself, in each person’s own time zone. Until a wave has a day, nothing changes for its people.</Lede>
      <Cards items={WAVES} />
      <div className="mt-3"><Cards items={SWITCH} /></div>
      <p className="text-[13px] leading-relaxed text-muted mt-3">A timesheet counts every hour of its period, whether it came from TSheets or North Time, so a month that started in TSheets is submitted and approved in the portal like any other.</p>
    </section>
  )
}

// ── Where do I find... ──────────────────────────────────────────────────────

const WHERE: { what: string; where: string }[] = [
  { what: 'Clock in, switch, clock out', where: 'The clock button in the top bar, or the banner on Home' },
  { what: 'My hours', where: 'North Time, **Time entries**' },
  { what: 'Fix missing time', where: 'Time entries, **Request a time correction**' },
  { what: 'Which job to use', where: 'North Time, **Which job?**' },
  { what: 'Send my timesheet', where: 'Home, Pay period, **Review and send**, or Time entries, **Submit**' },
  { what: 'Time off', where: 'Requests, **Time off** (US employees)' },
  { what: 'Reimbursements', where: 'Requests, **Reimbursements**, **New request**' },
  { what: 'Extra hours', where: 'Requests, **Extra hours**' },
  { what: 'My invoices', where: 'North Time, **Invoices** (contractors)' },
  { what: 'Decisions waiting for me', where: 'North Time, **Approvals**, or Home, Needs you' },
  { what: 'Who is on the clock now', where: 'North Time, **Who’s working** (Team Leaders and up), also in the top bar' },
  { what: 'Hours by client, team or person', where: 'North Time, **Reports** (your own hours; Team Leaders their teams, hours only)' },
  { what: 'Invoices to pay', where: 'Home, **Invoices to pay**, or North Time, **Invoices**' },
  { what: 'Reimbursement documents', where: 'Requests, Reimbursements, **Documents**' },
  { what: 'A person’s rate, allowance and Reports to', where: 'Directory, the person, **Work** tab; or People, **Rates & Costs**' },
  { what: 'Job catalogue, Invoices, Reminders, North Time rollout', where: 'Admin, **Company settings**' },
  { what: 'TSheets entries since the switch date', where: 'North Time, **TSheets transition**' },
  { what: 'TSheets entries made after a person switched', where: 'Company settings, North Time rollout, **Clocked in TSheets after switching**' },
  { what: 'Clocks that stopped by themselves', where: 'North Time, **Clock safety** (Admins and up)' },
]

export function WhereSection() {
  return (
    <section id="where" className="scroll-mt-6">
      <Eyebrow>Reference</Eyebrow>
      <Heading>Where do I find...</Heading>
      <div className={`${card} overflow-hidden`}>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3.5 px-[18px] py-3 bg-subtle border-b border-slate-200 font-(family-name:--font-display) font-extrabold text-[10.5px] uppercase tracking-wide text-muted">
          <span>I want</span><span>Go to</span>
        </div>
        {WHERE.map(r => (
          <div key={r.what} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3.5 px-[18px] py-3 border-b border-slate-100 last:border-0 items-start">
            <span className="font-(family-name:--font-display) font-bold text-[13.5px] text-tn-ink">{r.what}</span>
            <span className="text-[13px] text-muted leading-snug"><Rich text={r.where} /></span>
          </div>
        ))}
      </div>
      <SubHeading>Who sees what in North Time</SubHeading>
      <p className="text-[13.5px] leading-relaxed text-foreground">Everyone has the clock, Time entries, Requests, Reports (their own hours) and Which job?. Team Leaders add Approvals and Who’s working for their teams. Admins and Super Admins see everyone, Clock safety, the TSheets transition page and Import. Invoices are for contractors (their own), Super Admins, Admins and Finance. Admin, Access levels can move any of these ticks.</p>
    </section>
  )
}
