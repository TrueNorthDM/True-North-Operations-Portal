/**
 * The System manual's Home and North Time sections (27 October 2026): the new
 * Home, North Time as built (the clock, the 2026 job structure, Time entries,
 * the hours allowance, timesheets, approvals, requests, invoices), a quick
 * start for each audience, the move from TSheets, and "Where do I find...".
 *
 * Brought up to the rules leadership decided on 4 November 2026: a clock left
 * running stops at 12h (no "Still working?"), everyone adds and changes their
 * own hours, US employees (all salaried) are outside the allowance, contractors make
 * and send their own invoice (checked against the timesheet on approval, with
 * an "Invoice record" page on the PDF), Home's cards are each person's choice,
 * and the breaks and lunch policy.
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
  { t: 'Needs you · My Work · Requests', d: 'One card with three tabs and their counts. **Needs you**: what waits for your decision or your action, only what you can act on (a contractor also sees **Send your invoice** until it is sent). **My Work**: your Monday items due in the next 7 days or late. **Requests**: what you asked for and where it is. A row’s button (**Decide**, **Open**) opens a side panel whose buttons do the same as the page behind them.' },
  { t: 'To pay', d: 'For Super Admins and Finance: **Invoices to pay** and **Reimbursements to pay**, pinned at the top of Needs you, with how many, the total, and red while one is past due. **Open Invoices** and **Open Reimbursements** go to the lists where Finance pays them.' },
  { t: 'Pay period', d: 'Your current pay period: days worked, PTO, holidays (employees only) and sick days, the hours expected so far and your pace. It is also your timesheet reminder: amber on the day your period closes, red every day after until you send it. **Review and send** opens Time entries with Submit open. It never shows money.' },
  { t: 'Agenda', d: 'Who is **Out today**, what is on **Today**, and what is **Coming up** in the next month.' },
  { t: 'i7 Budget and Publishing goals', d: 'For people with the i7 report: the **Balance left** this month, with **Open report**. For Team Leaders and above: Publishing goals over the **Last 5 weeks**, every board against its targets.' },
  { t: 'Your choice of cards', d: 'Each person chooses which cards Home shows: Settings, **Home and start**, a **Show ... on Home** switch for each of Needs you, Pay period, Agenda, My goals, i7 budget and Publishing goals (only the ones you can have). The day banner with the clock and the annual review card always show.' },
]

export function HomeSection() {
  return (
    <section id="home" className="scroll-mt-6">
      <Eyebrow>Home</Eyebrow>
      <Heading>Home: what to do today</Heading>
      <Lede>Home answers one question for each person: what do I need to do today? Each part reads on its own. If one cannot be read, it says so in its own card, and the rest still shows.</Lede>
      <Cards items={HOME} />
      <p className="text-[13px] leading-relaxed text-muted mt-3">No longer on Home: favourite pages, the org chart (it is in People, Human Resources), birthdays and work anniversaries (they are in the Agenda) and the health banner (its alerts are Needs you rows).</p>
    </section>
  )
}

// ── North Time ──────────────────────────────────────────────────────────────

const NT: Block[] = [
  { t: 'The clock', d: 'The clock button in the top bar opens the clock panel. Pick **Resume** (your last job), one of **My combinations**, a **Recent** one, or search under **Something else** (**Browse** shows every job). Check the details and press **Clock in**. **Switch to** ends one entry and starts the next at the same second. The clock has no break button: to take a break off the clock, clock out. Times are kept on the nearest 15 minutes.' },
  { t: 'A clock left running', d: 'If you forget to clock out, the clock stops by itself after **12h 00m** on the clock, counted from the clock in across every switch. There is no question before it. You are always told, in the bell and by email (a notification nobody can turn off), and the clock button turns red until you confirm when you really stopped. Admins see every automatic stop in **Clock safety**.' },
  { t: 'Breaks and lunch', d: 'Longer breaks are encouraged, never required. A break under 15 minutes needs no clock out. Contractors clock out for lunch; US employees, who are all salaried, do not have to. The portal does not watch your computer and never clocks you out for being idle.' },
  { t: 'The 2026 job structure', d: 'From the switch date you pick a project as **Client › Division › Project**, then its **Activity**, grouped by family. **Billable** comes from the project and shows read only, “from the project”. **Notes** are required for **Other** and **Meeting: Other**. Before the switch date you pick the TSheets jobs, as before. **Which job?** lists every job and when to use it, with the TSheets list one choice away for people still on TSheets.' },
  { t: 'Combinations', d: 'Your favourites: a job with its Activity and note, saved under a name. Use **Save as combination** in the details, or the star on a Recent row. The panel shows the first 6; **More** shows the rest. **Manage** reorders, edits and deletes them. A combination on a TSheets job stops showing from the switch date; it is not deleted.' },
  { t: 'Time entries', d: 'Your hours as a **List**, a **Week grid** or a **Day timeline**, by day, week, month or pay period. Team Leaders and above switch **Whose hours** to **My team** or **All**. Everyone adds and changes their own hours, as in TSheets: **Add time**, or edit an entry. Team Leaders also change their team’s hours; Admins and Super Admins everyone’s. Every change needs a reason and stays in the entry’s history. The allowance still applies, and a sent timesheet stays locked.' },
  { t: 'Hours allowance', d: 'A contractor’s allowance is their **Hours limit** (Directory, the person’s Work tab), per week or per month, and it covers their pay period: every 2 weeks, twice the weekly number for each pay period; monthly, the weekly number / 5 for each weekday of the month (30 h a week is 126h in a month of 21 weekdays), or the number per month. Someone whose cadence is not set yet has it a week. US employees have none. It is a hard limit: when it is used, the clock stops by itself and nothing more can be added until extra hours are approved. From 90% the clock panel says how much is left and when the clock will stop. A contractor with no Hours limit has no allowance, and their hours are never flagged as over. US employees are all salaried and outside the allowance (People, **Rates & Costs** shows them as **Salaried (Rippling)** and **Exempt (salaried)**). Overtime only with extra hours approved first.' },
  { t: 'Timesheets and approvals', d: 'Each person submits monthly or every 2 weeks. Hours are approved by the person they report to (Directory, Work tab, **Reports to**); a contractor’s invoice by the invoice approver in Company settings, Invoices; when it is the same person it is one step. The hours can be approved before the invoice arrives. A submitted period is locked until it is returned or a Super Admin reopens it.' },
  { t: 'Requests', d: 'In Requests on the rail: **Time off** (US employees), **Reimbursements** and **Extra hours**. Who decides is set in Company settings, Invoices, **Who approves what**: time off and extra hours follow the invoice rule (the person’s Reports to when they approve invoices, else the default approver); reimbursements go to the people on the **Reimbursements** list. Nobody decides their own.' },
  { t: 'Invoices and documents', d: 'Contractors make and send their own invoice: the portal no longer makes one from the timesheet, nor on the 1st. After sending the timesheet, they send it from North Time, **Invoices**, **Send your invoice**: their own PDF, or one they build here. The approver checks it against the timesheet, client by client. Its PDF has a second page, **Invoice record**: who made it, the check and the history. An employee’s approved reimbursements go on a reimbursement document. Finance pays both outside Rippling payroll and marks them paid.' },
]

export function NorthTimeSection() {
  return (
    <section id="north-time" className="scroll-mt-6">
      <Eyebrow>Time clock</Eyebrow>
      <Heading>North Time</Heading>
      <Lede>North Time is the portal’s own time clock. It replaces QuickBooks Time (TSheets): you clock in here, the portal keeps your hours, you submit them each pay period, and contractors then send their own invoice for it. It opens from the clock button in the top bar, from Home, and from North Time on the rail.</Lede>
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
      { t: 'Add or change your own time', steps: [
        'Everyone adds and changes their own hours, as in TSheets. Open North Time, **Time entries**, and press **Add time**.',
        'Fill in the date, the start and end (or a duration), the job and Activity, and the reason. Then **Save**.',
        'To change an entry, open it, change it and write the reason. Every change is kept in the entry’s history.',
        'Your allowance still applies, and a sent timesheet stays locked: ask your approver to return it first.',
      ] },
      { t: 'A clock left running', steps: [
        'Forgot to clock out? The clock stops by itself after **12h 00m** on the clock.',
        'You are always told, in the bell and by email. Nobody can turn this one off.',
        'The clock button turns red. Open it and confirm when you really stopped.',
      ] },
      { t: 'Breaks and lunch', steps: [
        'Longer breaks are encouraged, never required.',
        'A break under 15 minutes needs no clock out.',
        'Contractors clock out for lunch. US employees, who are all salaried, do not have to.',
        'The portal does not watch your computer and never clocks you out for being idle.',
      ] },
      { t: 'Request extra hours', steps: [
        'Open Requests, **Extra hours**, and press **Ask for extra hours** (the clock panel links there too).',
        'Fill in **How many hours**, which week, month or pay period (the one your allowance counts in), **Client or project** and **Why**.',
        'Press **Send request**. The message names who decides it.',
        'Approved hours are added to your allowance for that week, month or pay period.',
      ] },
      { t: 'The hours allowance and the hard limit', steps: [
        'A contractor’s allowance is their **Hours limit** (Work tab), per week or per month, counted over their pay period. The clock panel shows it: “This week 12h of 40h”, “This pay period 32h of 60h”.',
        'From 90% it shows the hours left and, while the clock runs, the time it will stop by itself.',
        'When the allowance is used, your clock stops, and **Clock in**, **Switch** and adding time are refused.',
        'Ask for extra hours before you need them, not after.',
        'US employees are all salaried and have no allowance: their hours are never stopped or flagged as over.',
      ] },
      { t: 'Submit your timesheet', steps: [
        'When your period closes, Home’s **Pay period** card turns amber (red once it is late).',
        'Press **Review and send**, or **Submit** with your period’s name on Time entries.',
        'If your clock is running, clock out first.',
        'Fix anything listed under **Fix these first**, then check the total and **By client**.',
        'Press **Submit**. The period locks. If your approver returns it, you see why, fix it and submit again.',
        'Contractors: then send your invoice for the period (see Contractors, below).',
      ] },
      { t: 'Time off (US employees)', steps: [
        'Open Requests, **Time off**, and press **Request time off**.',
        'Pick the **Type** and the **Dates** (one day or a range), full days or hours a day, and add a note if you like.',
        '**Who else is off** shows who on your team is off those days.',
        'Press **Send request**. The message names who decides it (Company settings, **Who approves what**), and you get a notification.',
        'Company holidays are off for everyone and are not asked for: the seven company holidays (New Year’s Day, Memorial Day, Independence Day, Labor Day, Thanksgiving Day, the day after Thanksgiving and Christmas Day); one that falls on a Saturday is observed the Friday before, on a Sunday the Monday after. Full-time employees are paid for them. Vacation, Sick, Holiday and Jury duty are never clocked.',
      ] },
      { t: 'Reimbursements', steps: [
        'Open Requests, **Reimbursements**, and press **New request**.',
        'Add a line for each receipt: you can drop several photos and PDFs at once, so one request can hold a whole trip.',
        'For each line: the date, the category, the amount, the description of the expense, and its photo or PDF.',
        'Press **Send request** (**Send 3 receipts** when there are three). Someone on the **Reimbursements** list decides each receipt; the message names them.',
        'A meal while travelling over $25 still goes, for review: write why in the description, and the approver sees it flagged **Over the $25 meal limit**.',
        'More receipts for the same event later? Use the same event name: while that request is still waiting, they join it and the whole event is approved at once.',
        'While nothing in it is decided, your request shows **Edit** and **Withdraw**: change a line, add or remove a receipt, or take it all back. Every change is kept, and whoever decides is told.',
        'Anyone can ask for a reimbursement. Each receipt gets its own number when it is sent, like **RCT-2026-005**.',
        'Contractors: tick your approved receipts on the next invoice you send; each goes on it as its own line. Employees: approved receipts go on a reimbursement document that Finance pays, outside Rippling payroll.',
      ] },
    ],
  },
  {
    id: 'qs-contractors', who: 'Contractors', intro: 'You make and send your own invoice. Making the invoice is part of being a contractor (US labor law), so the portal no longer makes it for you.',
    topics: [
      { t: 'Sending your invoice (contractors)', steps: [
        'Send your timesheet first (**Submit** on Time entries). Paid a fixed amount with no timesheet? Start on the 1st, for the month before.',
        'Open North Time, **Invoices**, and press **Send your invoice**. Until it is sent, Home’s **Needs you**, the Invoices list and a reminder every morning at 9:00 AM ask for it.',
        'Pick the period.',
        'Choose **Upload my own invoice**: press **Choose your PDF** (up to 10 MB) and write **Your invoice number**, the **Hours on it** and the **Total (USD)**, so it can be checked.',
        'Or choose **Build it here**: press **Use my timesheet hours** to fill the lines from your sent timesheet, one a client, with the rate in your contract (Rates & Costs), or write the hours line by line. You can adjust the hours, change what a line says, and add or remove lines; the rate cannot be changed (to change it, talk to whoever approves your invoice). Paid a fixed amount? One line with the amount on file, which cannot be changed either. No rate or amount on file yet? Ask whoever approves your invoice, or upload your own.',
        'Tick the approved reimbursements your invoice includes.',
        'Tick **This is my invoice.** and press **Send invoice**. It gets its INV number (like INV-2026-001).',
        'Every version you send is kept: who sent it, when, how, and the sentence you ticked.',
        'Sent back? You see the reason. Fix it and send it again: same number.',
      ] },
      { t: 'How it is checked', steps: [
        'Your hours can be approved before your invoice arrives.',
        'The approver sees your invoice beside your timesheet, client by client: **Matches** or **Differs**, with the difference in hours and dollars (against your rate on file or your fixed amount).',
        'When they differ, the approver can send the invoice back with a reason (your hours stay approved), approve the hours only, or approve anyway with a written reason.',
      ] },
      { t: 'Payments', steps: [
        'Open North Time, **Invoices** (**My invoices**) to see each invoice and where it is, for example **Waiting for approval**, **Approved** or **Paid**.',
        '**Preview PDF** shows the invoice; download it from the preview. Its last page, **Invoice record**, says who made it, the check against the timesheet and its history (after your own file, when you sent one).',
        'Finance pays approved invoices outside Rippling and marks them paid with the day.',
        'Your bell tells you when your invoice is received, sent back (with the reason) and paid.',
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
        'Press **Approve hours** for a contractor (the invoice approver then finishes it) or **Approve for payroll** for an employee (Finance then enters the hours and time off in Rippling). Or press **Send the hours back**, with a reason.',
      ] },
      { t: 'Change your team’s hours', steps: [
        'On Time entries, set **Whose hours** to **My team** and pick the person.',
        'Use **Add time**, edit an entry, the **Week grid** or the **Day timeline**. Every change needs a reason and is kept in the history.',
        'Your own hours work like everyone’s: you add and change them yourself, with a reason.',
        'Nobody’s hours go past their allowance, whoever adds them.',
      ] },
      { t: 'Extra hours', steps: [
        'Open Requests, **Extra hours**, **Ask for extra hours**, and pick the person under **For**.',
        'Ask before they go over. It goes to whoever decides for that person (Company settings, **Who approves what**), not for you.',
        'If someone on your team goes over without approval, your bell tells you.',
      ] },
      { t: 'Never any money', steps: [
        'You see no one else’s invoices, rates or amounts (only your own): a timesheet in Approvals says **Hours only**.',
        'Reports show your teams’ hours only. Time off for your team is decided as Company settings, **Who approves what**, says; your bell tells you when someone who reports to you asks.',
      ] },
    ],
  },
  {
    id: 'qs-admins', who: 'Admins, Super Admins and Finance', intro: 'Decisions, payments and the company settings behind North Time.',
    topics: [
      { t: 'Approvals', steps: [
        'North Time, **Approvals**: **Waiting for you**, **With others** (read only) and **Decided** (the last 90 days).',
        'Time off, its cancellation and extra hours go to the person’s Reports to when they approve invoices, else to the default approver; reimbursements (each receipt) to anyone on the **Reimbursements** list, the first to decide closes it. Only they decide, never their own; everyone else sees whose decision it is under **With others**.',
        'A timesheet goes to the person’s Reports to; the invoice to the approver in Company settings, Invoices.',
        'Hours over the allowance that were not approved before: **Approve** still works, with a **Note to approve (required)**.',
        'A Super Admin can **Reopen** an approved timesheet until its invoice is paid.',
      ] },
      { t: 'Approving a contractor’s invoice', steps: [
        'The hours can be approved before the invoice arrives; the page says when the invoice is still to come.',
        'Open the timesheet with **Review**: **Invoice details submitted** shows what the contractor sent (who sent it, when and how), and the check beside it. Built in the portal: their lines as sent (description, hours, rate, amount), each marked **Matches**, **Differs** (with the difference) or **Not on timesheet** against the timesheet hours for that client, then the reimbursements, any client left out (**Missing**) and the total against the approved hours at the rate on file. Their own file: the invoice number, hours, total and what it covers as they typed them, then the hours in all and the total checked. A fixed amount: their line against the amount on file. An invoice the portal made from the timesheet before November 4, 2026 shows its own lines and is checked on its total only. The sentence they confirmed when sending is at the bottom.',
        '**Preview invoice** opens the invoice in a window (their own PDF, when they sent one); download it from there.',
        'When they match: **Approve both**.',
        'When they do not: **Send the invoice back** (the invoice alone, with your reason; the hours stay), **Approve the hours only**, or approve anyway with a reason under **To approve anyway, write why (required)**.',
        'The invoice PDF (preview, download and the Google Drive copy) ends with an **Invoice record** page: who made it, the check against the timesheet and the history.',
      ] },
      { t: 'Invoices to pay and Mark paid', steps: [
        'Home shows **Invoices to pay**; **Open Invoices** opens North Time, Invoices on the approved ones.',
        'Filter by state (**Waiting for approval**, **Approved, not paid**, **Paid** in the month), person and period; **Export CSV**; **Preview PDF**.',
        'Only Finance marks paid, after the money left: **Mark paid**, then **Paid on**, an optional reference and note. It can be done once.',
        'Super Admins who are not Finance see what waits, but do not mark it paid. Admins who are not Finance see no one else’s invoices or amounts.',
      ] },
      { t: 'The invoice form (Send an invoice)', steps: [
        'For people who send True North invoices without signing in to the portal: freelancers paid a fixed amount, or by deliverables (one line a Monday item). They make their own invoice, like every contractor. One link for everyone, in Admin, **Company settings**, Invoices, **Send an invoice**: **Copy** it to share. The address is the same for good: truenorthportal.online/send.',
        'They write their name and email and press **Send me a code**: a 6-digit code by email, valid 10 minutes, 5 tries, **send it again** after a minute. The device then remembers their email for 30 days.',
        'Their email is looked up in the Directory (True North, Good News, personal and COE addresses). Found: their name and address come from their record, with **Edit**; what they change also goes on their record. Not found: they fill them in.',
        'One invoice a month. First they choose **My own file** (their PDF, with the total on it) or **Fill it in here** (the portal makes the PDF from what they write). Before sending, they tick **This is my invoice**; every version sent is kept. Fixed amount: what it covers and the amount. Deliverables: each Monday item as a **Translated page** or a **Design asset**, at the rates in **Deliverable rates** (a person’s own in People, **Rates & Costs**, **Rate / page** and **Rate / design asset**, when set). An item already sent with the same kind, by anyone, is refused with the day it was sent. Reimbursements take the same fields and rules as **New reimbursement**, and their own PDF can go with it.',
        'A sender in the Directory gets an INV number at once; the invoice goes to its approver like any other (Approvals, **Invoice form**), and **Came from** on its page says how it came in, with their PDF. Approving it approves its reimbursements. A sender not in the Directory shows at the top of North Time, **Invoices**, under **New sender, not in the Directory**: the default approver picks the person (**Link to this person**; add them in Admin, People first if needed), and only then it gets its number.',
        'They hear everything by email: the copy, the number, approved, returned with the reason (they fix it and send it again from the same link, same number) and paid. While North Time is closed, the form says it is not open yet.',
      ] },
      { t: 'RMB documents', steps: [
        'A reimbursement document (like RMB-2026-001) is made when an employee’s reimbursement is approved.',
        'Find them in Requests, **Reimbursements**, **Documents**, or from Home’s **Reimbursements to pay** (**Open Reimbursements**).',
        'Open one and press **Preview PDF**: the document comes first, then each receipt as its own page.',
        'Finance pays it outside Rippling payroll, then presses **Mark paid**, as for invoices.',
      ] },
      { t: 'Copies in Google Drive', steps: [
        'Every approved invoice, every approved reimbursement receipt and every RMB document is copied to Google Drive by the portal, every 5 minutes, from Nov 1, 2026. The portal stays the record; Drive is Finance’s copy.',
        'An invoice is copied when it is approved and updated (a new version of the same file) when it is marked paid. A receipt is copied when its request is approved. An RMB document is copied when it is made and updated when it is paid.',
        'Each file is named by its code and the person, the same name it downloads with from the portal: **INV-2026-010-Arnaldo Oliveira.pdf**, **RMB-2026-002-Arnaldo Oliveira.pdf**, **RCT-2026-005-Arnaldo Oliveira.jpg** (a receipt keeps its own file type).',
        'In Drive: the main folder **Docs from the Portal**, with **Invoices** and **Reimbursement Requests** inside it, and **Receipts** and **RMB** inside Reimbursement Requests. The portal makes the inside folders itself.',
        'North Time, **Invoices**, and Requests, Reimbursements, **Documents**, have a **Drive** column: **In Drive** (opens the file), **Waiting** (copied within 5 minutes), **Failed** (with the reason) or **After approval**. An invoice’s page shows its Google Drive box and history.',
      ] },
      { t: 'Setting up Google Drive (Super Admins, once)', steps: [
        'Create one folder named **Docs from the Portal** in the Drive of whoever keeps the files (Tina, for example). Create only this folder: the portal makes Invoices, Reimbursement Requests, Receipts and RMB inside it, and it cannot see folders it did not make.',
        'Share that folder with **office@truenorthdigitalmarketing.com** as **Editor**.',
        'office@ must be connected as the team calendar in Agenda settings, with the Drive box ticked.',
        'Admin, **Company settings**, Integrations, Google Drive: press **Pick the folder** and choose it (a folder shared with office@ is under **Shared with me**).',
        'Under **How the copies are doing**: **Copy the missing now** copies at once; a failed copy shows why, and **Try again** sends it again after the cause is fixed (for example, the folder shared again). Failed copies also count in the rail’s integration errors.',
      ] },
      { t: 'Company settings', steps: [
        'Admin, **Company settings**. Admins read these sections; Super Admins change them.',
        '**Job catalogue**: the 2026 structure beside the TSheets jobs. Add clients, divisions and projects; options are hidden, never deleted. From the switch date a TSheets job can be switched off, never renamed or moved.',
        '**Invoices**: the prefixes and the next number for invoices (INV), reimbursement documents (RMB) and receipts (RCT) (the count never restarts, only the year changes), **Who approves what** (timesheets, invoices, time off and extra hours, and the **Reimbursements** list: **Add a person who approves reimbursements**, **Remove**), who is **Finance** (the people who mark invoices and reimbursement documents paid: **Add a person to Finance**, **Remove**), True North’s billing details and the payment terms.',
        '**Reminders**: turn each timesheet reminder on or off; **See them in the bell**.',
        '**North Time rollout**: each wave’s start date, who is in each wave (**Move to wave 1** or **2**, **No wave**, **Follow their level**), **Save dates**, and **Clocked in TSheets after switching**: each TSheets entry made after its person’s date waits under **To decide**, where you **Count it** (it becomes a Time entry; past the allowance it asks for a reason) or **Discard it**; **Decided** shows who chose what, and when.',
        '**Timesheet periods**: when pay periods start and who submits how.',
      ] },
      { t: 'The TSheets transition page', steps: [
        'North Time, **TSheets transition** (Super Admins and Admins). Reading only: nothing there changes an entry.',
        'It lists every TSheets entry from the switch date: **As recorded in TSheets** beside **How the portal read it** (Client, Division, Project, Activity, Billable).',
        'TSheets keeps its old jobs and fields, so each entry is translated into the 2026 structure. Problems come first: what the person can fix in TSheets (Activity, i7 Code, Notes for Other or Meeting: Other) and what an admin fixes in the portal (an unknown job, a TSheets folder with no 2026 client, an Activity the translation table does not know).',
        'Filter by **From**, **Person** and **Show** (**Every entry** or **Only problems**). **Remind** tells a person, in the bell, only what they can fix in TSheets.',
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
  { t: 'No wave', d: 'People it is not yet known whether they will use North Time, put there by a Super Admin. They have no start date: **Clock in**, **Switch** and **Add time** are refused (“You are not on North Time yet. Keep recording your time in TSheets.”), the TSheets import keeps every entry of theirs, and North Time sends them no timesheet or invoice reminders until they are moved to a wave.' },
]

const SWITCH: Block[] = [
  { t: 'Before your date', d: 'The clock does not start for you. **Clock in** and **Switch** are refused, and the clock panel says the day, for wave 2: “You start on North Time on Sunday, Nov 22. Until then, keep clocking in TSheets.” Keep clocking in TSheets: those hours come into the portal and count the same. Adding time by hand and approvals are not affected.' },
  { t: 'On your date', d: 'North Time’s clock opens for you. The TSheets import stops taking your entries dated on or after that day. A TSheets entry made after it is set aside, never counted twice, and listed for someone to decide. Your TSheets account stays as it is: from that day, record your hours in North Time only.' },
  { t: 'Why the jobs change', d: 'The 2026 structure says who pays (Client), what the work serves (Division and Project), what kind of work it was (Activity) and whether it can be invoiced (Billable, from the project). North Time offers it from the switch date. TSheets is not changed: it keeps its old jobs and fields until it is switched off, so you meet the new structure the day you start on North Time, and the portal translates every TSheets entry for the reports (the client always, the division and project where the old fields say it).' },
  { t: 'Old hours keep the old structure', d: 'No entry is rewritten. TSheets entries keep their job and fields for good. From the switch date the TSheets jobs are frozen in the portal: they can be switched off, never renamed or moved, so the history keeps its names. Reports read a TSheets entry through the translation table and a North Time entry as it is, so both sit side by side in the same report.' },
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
  { what: 'Fix missing time', where: 'Time entries, **Add time**, with a reason' },
  { what: 'Which job to use', where: 'North Time, **Which job?**' },
  { what: 'Send my timesheet', where: 'Home, Pay period, **Review and send**, or Time entries, **Submit**' },
  { what: 'Time off', where: 'Requests, **Time off** (US employees)' },
  { what: 'Reimbursements', where: 'Requests, **Reimbursements**, **New request**' },
  { what: 'Extra hours', where: 'Requests, **Extra hours**' },
  { what: 'My invoices', where: 'North Time, **Invoices** (contractors)' },
  { what: 'Send my invoice', where: 'North Time, **Invoices**, **Send your invoice**, or Home, Needs you (contractors)' },
  { what: 'Choose the cards on Home', where: 'Settings, **Home and start**' },
  { what: 'Decisions waiting for me', where: 'North Time, **Approvals**, or Home, Needs you' },
  { what: 'Who is on the clock now', where: 'North Time, **Who’s working** (Team Leaders and up), also in the top bar' },
  { what: 'Hours by client, team or person', where: 'North Time, **Reports** (your own hours; Team Leaders their teams, hours only)' },
  { what: 'Invoices to pay', where: 'Home, **Invoices to pay**, or North Time, **Invoices**' },
  { what: 'Reimbursement documents', where: 'Requests, Reimbursements, **Documents**' },
  { what: 'The invoice form link and the deliverable rates', where: 'Admin, **Company settings**, Invoices, **Send an invoice**; a person’s own rates in People, **Rates & Costs**' },
  { what: 'Invoices from senders not in the Directory', where: 'North Time, **Invoices**, **New sender, not in the Directory**' },
  { what: 'Copies of invoices and receipts in Google Drive', where: 'The **Drive** column in Invoices and Documents; set up in Admin, **Company settings**, Integrations, **Google Drive**' },
  { what: 'A person’s rate, allowance and Reports to', where: 'Directory, the person, **Work** tab, **Edit work** (the allowance is **Hours limit**); the rate also in People, **Rates & Costs**' },
  { what: 'Job catalogue, Invoices, Reminders, North Time rollout', where: 'Admin, **Company settings**' },
  { what: 'TSheets entries since the switch date', where: 'North Time, **TSheets transition**' },
  { what: 'TSheets entries made after a person switched', where: 'Company settings, North Time rollout, **Clocked in TSheets after switching**' },
  { what: 'Clocks that stopped by themselves (12h)', where: 'North Time, **Clock safety** (Admins and up)' },
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
      <p className="text-[13.5px] leading-relaxed text-foreground">Everyone has the clock, Time entries, Requests, Reports (their own hours) and Which job?. Team Leaders add Approvals and Who’s working for their teams. Admins and Super Admins see everyone’s hours, Clock safety, the TSheets transition page and Import. Money (rates, invoices and their amounts, reimbursement amounts, payment documents, money columns in Reports and the To pay totals) is shown only to the person it belongs to, to Super Admins and to Finance (Company settings, Invoices): never to Team Leaders, and not to Admins unless they are Finance (November 5, 2026). Everyone adds and changes their own hours, with a reason. Admin, Access levels can move the other ticks.</p>
    </section>
  )
}
