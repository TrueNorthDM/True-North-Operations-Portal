// The Requests guides (owner, 4 November 2026): time off, reimbursements,
// extra hours, and Approvals for the people who decide them. Written from the
// built screens (components/requests, components/clocky/approvals) and their
// rules (requests/actions.ts, reimbursements/new/route.ts, routing.ts); the
// pictures are those screens with made-up data. North Time's own rules (the
// clock, timesheets, allowances, the contractor's own invoice, decided on 4
// November 2026) are explained in the North Time pages.

import Link from 'next/link'
import { GuideHeader, Picture, Step, Tip } from '../GuideParts'
import { ApprovalsPicture, ExtraHoursPicture, ReimbursementsPicture, RmbDocPicture, TimeOffPicture } from './RequestsPictures'

const LINK = 'font-bold text-tn-teal'

export function TimeOffGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideHeader eyebrow="Requests" title="Time off" minutes={4}>
        Time off is for employees: ask for days off here, and only here. Once approved, the days go to the Agenda and the team Google Calendar by themselves, and into your time entries. Contractors are not paid for days off, so there is nothing for them to ask.
      </GuideHeader>

      <Step n={1} title="Open Time off" picture={<Picture caption="Time off, with one request waiting and one approved." height={620}><TimeOffPicture show="page" /></Picture>}>
        <p className="m-0">On the left rail, click the Requests icon, then <strong>Time off</strong>. Your requests are listed in <strong>Pending</strong>, <strong>Upcoming</strong> and <strong>Past</strong>, each with its state and what happened to it.</p>
        <p className="m-0">The cards at the top are your kinds of paid time off. Their balances will show there once Rippling is connected; until then each card shows the hours still waiting for approval.</p>
      </Step>

      <Step n={2} title="Ask for days off" picture={<Picture caption="Request time off, three days of Vacation picked."><TimeOffPicture show="ask" /></Picture>}>
        <p className="m-0">Click <strong>Request time off</strong>. Pick the <strong>Type</strong>, then on the calendar click the first day and the last day (one click for a single day). Weekends and company holidays inside the range are not counted.</p>
        <p className="m-0">Under <strong>Each day</strong>, keep <strong>Full days</strong> or choose <strong>Hours a day</strong> for part of a day (1h to 8h). Add a <strong>Note (optional)</strong> if there is something to know.</p>
        <p className="m-0">On the right, <strong>Counted</strong> shows the working days and hours, and <strong>Who else is off</strong> shows who else is out on those days, your team first. On the calendar, a gold dot is a company holiday and a purple dot a day someone on your team is off. Click <strong>Send request</strong>.</p>
      </Step>

      <Step n={3} title="Who decides">
        <p className="m-0">Your request goes to the approver set in Company settings for your time off, who decides it in <Link href="/manual/guides/approvals" className={LINK}>Approvals</Link> and gets it in the bell. If your Team Leader is not that approver, they are told too. You hear back in the bell, with the reason when it is denied.</p>
        <p className="m-0">Time off is asked before it starts, and never for days you already asked for. For days already gone, tell a Super Admin.</p>
      </Step>

      <Step n={4} title="What happens when it is approved" picture={<Picture caption="An approved request, opened." height={620}><TimeOffPicture show="drawer" /></Picture>}>
        <p className="m-0">Click a request to open it. <strong>What happened by itself</strong> lists each step: the team calendar shows you as out on those days (everyone sees it in the Agenda), North Time writes the days into your time entries, and Rippling gets them for payroll once it is connected. Nobody copies anything by hand.</p>
        <p className="m-0"><strong>History</strong> shows when you asked and who approved it.</p>
      </Step>

      <Step n={5} title="Cancel time off" picture={<Picture caption="Asking to cancel approved time off."><TimeOffPicture show="cancel" /></Picture>}>
        <p className="m-0">Still waiting: click <strong>Cancel</strong> on its row. It is gone straight away, and nothing was sent anywhere.</p>
        <p className="m-0">Approved and still to come: click <strong>Cancel…</strong> on its row, or <strong>Cancel this time off</strong> in the request. Write the <strong>Reason (required)</strong> and click <strong>Ask to cancel</strong>. The same approver decides; once they approve, the days come off the team calendar and Rippling, and the hours leave your time entries. <strong>Keep it</strong> closes the window without asking.</p>
        <p className="m-0">Time off that has already started cannot be cancelled here: tell a Super Admin.</p>
      </Step>

      <Tip title="Company holidays are not asked for.">They are off for everyone, and the calendar skips them when it counts your days: New Year&apos;s Day, Memorial Day, Independence Day, Labor Day, Thanksgiving Day, the day after Thanksgiving and Christmas Day (on a weekend, the Friday before or the Monday after).</Tip>
    </div>
  )
}

export function ReimbursementsGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideHeader eyebrow="Requests" title="Reimbursements" minutes={5}>
        Ask for money you spent for work, with its receipt. Anyone can ask, employees and contractors. Approved, a contractor&apos;s waits for the next invoice they send; an employee&apos;s goes on a reimbursement document that Finance pays, outside Rippling payroll.
      </GuideHeader>

      <Step n={1} title="Open Reimbursements" picture={<Picture caption="A contractor's reimbursements: a trip waiting, one on an invoice, one paid, one denied." height={560}><ReimbursementsPicture show="page" /></Picture>}>
        <p className="m-0">On the left rail, click the Requests icon, then <strong>Reimbursements</strong>. Each line shows the date, the category, the description, the amount, its state and <strong>Where it is</strong>: waiting for whom, on which invoice or document, paid when, or why it was denied.</p>
        <p className="m-0">Receipts sent together in one request sit under its name and total. A receipt icon next to a line opens the receipt.</p>
      </Step>

      <Step n={2} title="Ask for one, with the receipt" picture={<Picture caption="New reimbursement, with the receipt added."><ReimbursementsPicture show="receipt" /></Picture>}>
        <p className="m-0">Click <strong>New request</strong>. Drop a photo or PDF of the receipt on the box, or click it to choose a file; on a phone you can also <strong>Take a photo</strong>. Each receipt can be up to 10 MB.</p>
        <p className="m-0">Fill in the <strong>Date of the expense</strong> (like 10/31/2026 or Oct 31, 2026), the <strong>Category</strong>, the <strong>Amount</strong> and the <strong>Description of expense</strong>. If it was for a client, pick it under <strong>Client or project (optional)</strong> and say whether it is <strong>Billable to the client</strong>. Click <strong>Send request</strong>.</p>
        <p className="m-0">Contractors ask in US dollars, because their invoice is in USD: paid in another currency, convert it and write the amount you paid in the description. Employees can pick the <strong>Currency</strong>, and Finance converts at the rate of the expense date.</p>
      </Step>

      <Step n={3} title="Pick the right category">
        <p className="m-0">The categories are Internet, Software, Equipment, Travel, Mileage, Meals while travelling, Meals with a client and Other. Every one needs its receipt except Mileage.</p>
        <p className="m-0"><strong>Meals while travelling</strong> are $25 a meal. A meal over that still goes, for review: the form says it is over the limit, and the description must say why in a few words. The approver sees it flagged <strong>Over the $25 meal limit</strong>.</p>
      </Step>

      <Step n={4} title="Mileage" picture={<Picture caption="A mileage line: the miles, and the amount worked out."><ReimbursementsPicture show="mileage" /></Picture>}>
        <p className="m-0">Pick <strong>Mileage</strong> as the category and write the <strong>Miles</strong> instead of an amount. The portal works it out at the company&apos;s rate a mile, in US dollars, and shows it as you type. No receipt is needed: write where you drove in the description.</p>
      </Step>

      <Step n={5} title="Several receipts in one request" picture={<Picture caption="A trip sent as one request with three receipts." height={760}><ReimbursementsPicture show="several" /></Picture>}>
        <p className="m-0">For a trip or an event, click <strong>Add another receipt</strong>, or drop several photos and PDFs at once. Name it under <strong>Event or trip (optional)</strong> and pick the client once at the top; <strong>Other client for this receipt</strong> changes it for one line. The button says how many you are sending, for example <strong>Send 3 receipts</strong>.</p>
        <p className="m-0">Each receipt is decided on its own, so one can be denied while the others are approved.</p>
        <p className="m-0">Sending more for the same event later? Use the same name: while every receipt of that request is still waiting, the new ones join it (case and spaces do not matter), so the whole event is approved at once. Once part of it is decided, a new request is made.</p>
      </Step>

      <Step n={6} title="Change or withdraw it while it waits">
        <p className="m-0">While nothing in a request is decided, your own shows <strong>Edit</strong> and <strong>Withdraw</strong>. Edit opens the same form, filled in: change the date, category, amount or miles, description, client or billable, replace a receipt, add one or remove one, then click <strong>Save changes</strong>. Withdraw takes the whole request back, with a reason if you like; it shows <strong>Withdrawn</strong> in your list and leaves Approvals.</p>
        <p className="m-0">Whoever decides is told in the bell, and every change is kept with who made it and when. Once any receipt is decided, the request can no longer be changed.</p>
      </Step>

      <Step n={7} title="Who decides">
        <p className="m-0">Reimbursements go to the reimbursement approvers set in Company settings, who decide them in <Link href="/manual/guides/approvals" className={LINK}>Approvals</Link>. You hear back in the bell. A denied one shows the reason under Where it is: fix what it says and send a new request.</p>
      </Step>

      <Step n={8} title="After it is approved" picture={<Picture caption="An employee's reimbursements, with the document waiting for Finance." height={460}><ReimbursementsPicture show="employee" /></Picture>}>
        <p className="m-0"><strong>Contractors:</strong> you make and send your own invoice, so it waits for it. When you send your next invoice (North Time, <strong>Invoices</strong>, <strong>Send your invoice</strong>), tick it: it goes on as its own line and shows <strong>On invoice</strong>.</p>
        <p className="m-0"><strong>Employees:</strong> the portal puts it on a reimbursement document for Finance. The card at the top of the page opens it.</p>
      </Step>

      <Step n={9} title="The reimbursement document (employees)" picture={<Picture caption="A reimbursement document, as its employee sees it." height={640}><RmbDocPicture /></Picture>}>
        <p className="m-0">It lists your approved items, each with its receipt, and the total. New approved items are added to it by themselves until it is paid. <strong>Preview PDF</strong> shows it as a PDF.</p>
        <p className="m-0">Finance pays it outside Rippling payroll and marks it paid; you see it in the bell, and its items show <strong>Paid</strong>.</p>
      </Step>

      <Tip title="Keep the receipt clear.">A photo where the date, the amount and the seller can be read saves a round trip: the approver opens it full size before deciding.</Tip>
    </div>
  )
}

export function ExtraHoursGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideHeader eyebrow="Requests" title="Extra hours" minutes={3}>
        If you have an hours allowance and need more, ask here before you go over it, not after: overtime needs approval first. US employees are salaried and have no allowance. Team Leaders can also ask for someone on the teams they lead.
      </GuideHeader>

      <Step n={1} title="Open Extra hours" picture={<Picture caption="Extra hours, with one request waiting."><ExtraHoursPicture show="page" /></Picture>}>
        <p className="m-0">On the left rail, click the Requests icon, then <strong>Extra hours</strong>. The card at the top shows your allowance for this week or month and how much of it is used. Below, <strong>Your requests</strong> lists what you asked and what was decided.</p>
      </Step>

      <Step n={2} title="Ask for extra hours" picture={<Picture caption="Ask for extra hours, filled in."><ExtraHoursPicture show="ask" /></Picture>}>
        <p className="m-0">Click <strong>Ask for extra hours</strong>. Write <strong>How many hours</strong>, pick <strong>Which week or month</strong> and the <strong>Client or project</strong>, and say under <strong>Why</strong> what the hours are for and who asked. The line at the bottom shows what your allowance becomes if it is approved. Click <strong>Send request</strong>.</p>
        <p className="m-0">Team Leaders pick the person under <strong>For</strong> first.</p>
      </Step>

      <Step n={3} title="What happens next">
        <p className="m-0">The approver set in Company settings decides it in <Link href="/manual/guides/approvals" className={LINK}>Approvals</Link>, and you hear back in the bell. Approved, the hours are added to the allowance for that week or month. Denied, the bell tells you why.</p>
      </Step>

      <Tip title="Ask early.">A request sent before the work starts gives the approver time to decide before you reach your allowance.</Tip>
    </div>
  )
}

export function ApprovalsGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideHeader eyebrow="Requests" title="Approvals" minutes={4}>
        For the people who decide requests. Who decides what is set by a Super Admin in Company settings, Invoices, under Who approves what: time off, cancelling it and extra hours follow the invoice approvers, and reimbursements have their own list. Nobody decides their own requests.
      </GuideHeader>

      <Step n={1} title="Open Approvals" picture={<Picture caption="Approvals, with three requests waiting." height={600}><ApprovalsPicture /></Picture>}>
        <p className="m-0">On the left rail, click the Requests icon, then <strong>Approvals</strong> under Decisions. The number on the rail is how many are waiting for you, and the bell tells you when a new one arrives.</p>
      </Step>

      <Step n={2} title="Find what is yours">
        <p className="m-0"><strong>Waiting for you</strong> holds what you decide. <strong>With others</strong> shows, read only, what is waiting for someone else and whose it is. <strong>Decided</strong> shows the last 90 days, with who decided, when and why.</p>
        <p className="m-0">The chips above the list filter it by kind: Time off, Reimbursement, Extra hours, and the others North Time sends here. A timesheet opens its own page with <strong>Review</strong>.</p>
      </Step>

      <Step n={3} title="Open a request" picture={<Picture caption="A time off request, opened."><ApprovalsPicture open="off" /></Picture>}>
        <p className="m-0">Click a row to open its card: who asked and when, the facts, and what approving does by itself. A time off card shows the team calendar for that week, with who else is out and the company holidays. An extra hours card shows the person&apos;s allowance and how much is used.</p>
      </Step>

      <Step n={4} title="Approve" picture={<Picture caption="A trip with three receipts, each decided on its own."><ApprovalsPicture open="rmb" /></Picture>}>
        <p className="m-0">Click <strong>Approve</strong>, on the row or on the card. The person hears it in the bell, and the rest happens by itself: time off goes to the calendar and the time entries, a reimbursement to the next invoice or the reimbursement document, extra hours to the allowance.</p>
        <p className="m-0">A reimbursement with several receipts lists each one, with its receipt to open. Each has <strong>Approve</strong> and <strong>Deny</strong>; switch the ones to deny and give each its reason. The button then says what it will do, for example <strong>Approve 2, deny 1</strong>, with the total approved. <strong>Approve all 3</strong> approves every one.</p>
        <p className="m-0">When someone asks to cancel approved time off, the buttons are <strong>Approve cancellation</strong> and <strong>Keep it</strong>.</p>
      </Step>

      <Step n={5} title="Deny, with a reason">
        <p className="m-0">Click <strong>Deny</strong>, write the <strong>Reason (required)</strong>, and click <strong>Deny</strong> again. <strong>Cancel</strong> goes back without deciding. The person gets the reason in the bell, and can send a new request. For several receipts, <strong>Deny all</strong> takes one reason for all of them.</p>
      </Step>

      <Tip title="Not yours to decide?">Rows in With others, and cards you open there, are read only: the card says who decides it.</Tip>
    </div>
  )
}
