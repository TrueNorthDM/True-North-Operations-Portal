// The guide to the invoice form (owner, 17 November 2026): for the people who
// send True North their invoice without signing in to the portal, and for the
// people who share the link with them. Written from the built form
// (app/send, components/invoice-form/SendInvoice.tsx) and the Company
// settings card that holds the link.

import { GuideHeader, Step, Tip } from '../GuideParts'

export function SendInvoiceGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideHeader eyebrow="North Time" title="Sending an invoice without the portal" minutes={3}>
        Some people send True North an invoice without using the portal: freelancers paid a fixed amount, or paid by deliverables. They do it on one page, <strong>truenorthportal.online/send</strong>, with no account and no password. Every invoice goes to its approver like any other, and they hear by email when it is received, approved and paid.
      </GuideHeader>

      <Step n={1} title="Open the link and say who you are">
        <p className="m-0">Open <strong>truenorthportal.online/send</strong>. Under <strong>Who are you?</strong>, write <strong>Your name</strong> and <strong>Your email</strong>: the email True North already has for you. Under <strong>How you are paid</strong>, pick <strong>Fixed amount</strong> or <strong>Deliverables</strong>, then press <strong>Send me a code</strong>.</p>
      </Step>

      <Step n={2} title="Type the code">
        <p className="m-0">A 6-digit code arrives by email. Type it under <strong>The code</strong> and press <strong>Continue</strong>. The code works for 10 minutes; if it does not arrive, look in spam, or send it again after a minute. The device then remembers your email for 30 days.</p>
      </Step>

      <Step n={3} title="Check your details">
        <p className="m-0">Under <strong>Your details</strong> you see your name, address and email, from your record at True North. If something is missing or wrong, fill it in and press <strong>Use these</strong> (or <strong>Edit</strong> to change it later). What you change also goes on your record, so next time it is already right.</p>
      </Step>

      <Step n={4} title="Write your invoice">
        <p className="m-0">Pick the <strong>Month</strong> it is for: one invoice a month. Under <strong>How do you send your invoice?</strong>, choose:</p>
        <ul className="m-0 pl-5 flex flex-col gap-1">
          <li><strong>My own file</strong>: the invoice you made, as a PDF, with its total on it.</li>
          <li><strong>Fill it in here</strong>: write <strong>What it covers</strong> and the <strong>Amount (USD)</strong>, and the portal makes the PDF for you.</li>
        </ul>
        <p className="m-0">Paid by deliverables? You list each finished item instead, as a translated page or a design asset, at your rates. An item already sent is refused, with the day it was sent. To add a reimbursement to the same invoice, answer <strong>Yes</strong> and fill it in.</p>
      </Step>

      <Step n={5} title="Preview and send">
        <p className="m-0">Press <strong>Preview invoice</strong> and check it. If it is right, tick <strong>This is my invoice.</strong> and press <strong>Send invoice</strong>. The page says <strong>Sent</strong> and shows your invoice number (like INV-2026-012), and a copy goes to your email. If the invoice is returned, the email says why: fix it and send it again from the same link.</p>
      </Step>

      <Tip title="Sharing the link.">Admins find the link in Admin, Company settings, Invoices, under Send an invoice: press Copy to share it. The address is the same for good. A sender who is not in the Directory yet waits under New sender, not in the Directory, in North Time, Invoices, until someone links them to their person.</Tip>
    </div>
  )
}
