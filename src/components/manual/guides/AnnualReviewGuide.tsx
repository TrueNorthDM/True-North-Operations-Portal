// The Annual review guide (owner, 4 November 2026): a tutorial for the person
// doing their review, then the parts for managers and for HR, the VP of
// Operations and the CISO. Written from the built screens (components/review,
// lib/review, app/(app)/human-resources); it replaces the one-page manual's
// Annual review section. The pictures are those screens with made-up data.

import Link from 'next/link'
import { GuideHeader, Picture, Step, Tip } from '../GuideParts'
import {
  GoalsPicture, PastGoalsPicture, PrioritiesPicture, ReviewCardPicture, ReviewListPicture, ReviewPagePicture, StartCyclePicture, TeamGoalsPicture,
} from './ReviewPictures'

const DISPLAY = 'font-(family-name:--font-display)'

function Part({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 pt-2 border-t border-[var(--panel-border)]">
      <h2 className={`m-0 pt-4 ${DISPLAY} font-black text-[21px] text-tn-ink`}>{title}</h2>
      <p className="m-0 text-[14.5px] leading-[1.6] text-foreground">{children}</p>
    </div>
  )
}

export function AnnualReviewGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideHeader eyebrow="People" title="Annual review" minutes={10}>
        Once a year you look back at your year and agree your goals for the next one with the person you report to: your Team Leader or, if you have none, the person you report to in the Directory. It happens in four steps: your self-review, their review, a meeting where you read and agree, and their approval. Everything lives in People, Human Resources.
      </GuideHeader>

      <Part title="Your self-review">Steps 1 to 9 walk through your own review, from the day it opens to the PDF.</Part>

      <Step n={1} title="Know when it opens" picture={<Picture caption="Your review card, on Human Resources and on Home."><ReviewCardPicture state="progress" /></Picture>}>
        <p className="m-0">Team Leaders, and people with no Team Leader, go first. Everyone else&apos;s self-review opens when their team&apos;s priorities are approved, or on the &ldquo;Teams open by&rdquo; date at the latest. Until then the card says <strong>Your self-review opens soon</strong>, with <strong>See the priorities</strong>.</p>
        <p className="m-0">When it opens you get an email and a row in <strong>Needs you</strong> on Home: <strong>Write your self-review</strong>. Reminders come 1 week before, 3 days before and on the due day.</p>
      </Step>

      <Step n={2} title="Open your review" picture={<Picture caption="The top of your review: who you are, and the four steps." height={520}><ReviewPagePicture step="self" /></Picture>}>
        <p className="m-0">Click <strong>Start your self-review</strong> (later, <strong>Continue</strong>) on the card. The top shows your position, team, Team Leader and date of hire, from the Directory, and the four steps with their dates. On a wide screen, <strong>In this review</strong> on the left lists the sections with how far each one is; click one to jump to it.</p>
        <p className="m-0">Everything saves as you type: the time of the last save shows at the top right. You can stop and come back any time before you submit.</p>
      </Step>

      <Step n={3} title="Mark how last year's goals went" picture={<Picture caption="Last year's goals, marked one by one."><PastGoalsPicture /></Picture>}>
        <p className="m-0">Under <strong>Your 2026 goals: how they went</strong>, pick <strong>Met</strong>, <strong>Partly met</strong>, <strong>Not met</strong> or <strong>No longer relevant</strong> for each goal, and say why in a sentence. The goals themselves cannot be changed: that year is closed.</p>
        <p className="m-0">In the first year, these goals were read from last year&apos;s file. Click <strong>Open the 2025 review</strong> to see the file beside the form and check them.</p>
      </Step>

      <Step n={4} title="Answer the sections">
        <p className="m-0">Three sections, each question with a short hint under it:</p>
        <ul className="m-0 pl-5 flex flex-col gap-1">
          <li><strong>Job Description</strong>: current responsibilities, initial role expectations, role alignment and success indicators. If you had a review last year, <strong>Copy from your 2025 review</strong> fills it in to change; <strong>Undo</strong> takes it back.</li>
          <li><strong>Self-Evaluation</strong>: strengths, accomplishments, challenges, areas for improvement, development plan and support needed.</li>
          <li><strong>Feedback and Suggestions</strong>: company improvements and additional comments.</li>
        </ul>
        <p className="m-0"><strong>Manager&apos;s Feedback</strong> is locked: the person you report to writes it, and you read it at the meeting step.</p>
      </Step>

      <Step n={5} title="Propose your goals for next year" picture={<Picture caption="The Company Priorities, and a goal being written." height={760}><GoalsPicture /></Picture>}>
        <p className="m-0">Read the <strong>Company Priorities</strong> first: your goals should be built on them, and on your team&apos;s, as much as possible. You see the whole-company ones and your own team&apos;s, never another team&apos;s.</p>
        <p className="m-0">Under <strong>Your goals for 2027</strong>, click <strong>Add a goal</strong> and fill in <strong>What</strong>, <strong>How it is measured</strong>, <strong>By when</strong> (month and year), the <strong>Term</strong> (6 months or 1 year) and which priority it serves. The bin removes a goal.</p>
      </Step>

      <Step n={6} title="Submit">
        <p className="m-0">The bar at the bottom counts your answers and goals. Click <strong>Submit to</strong> and the name of the person you report to. The window warns you about empty questions and goals not marked yet; <strong>Keep writing</strong> takes you back, <strong>Submit</strong> sends it.</p>
        <p className="m-0">Your part locks once it is sent. If something needs changing, they can send it back to you with a reason, shown at the top of your review.</p>
      </Step>

      <Step n={7} title="The meeting">
        <p className="m-0">The person you report to reads your self-review, may change or add goals, writes their feedback and books a meeting with you. It lands on the Agenda and on both your Google Calendars, with a Google Meet link, and the card shows its day and time.</p>
      </Step>

      <Step n={8} title="Read and agree" picture={<Picture caption="After the meeting: your review, with the notes and the agreed goals." height={640}><ReviewPagePicture step="agree" /></Picture>}>
        <p className="m-0">After the meeting the card says <strong>Read and agree</strong>. Open the review and read the <strong>Meeting notes</strong>, the <strong>Agreed goals</strong> and the <strong>Manager&apos;s Feedback</strong>. A goal your manager changed is marked <strong>Changed by</strong>, with <strong>Show the original</strong>; one they added is marked <strong>Added by</strong>.</p>
        <p className="m-0">When you are happy, click <strong>I have read and agree</strong>. The review goes to them for approval.</p>
      </Step>

      <Step n={9} title="Approved">
        <p className="m-0">Once approved, the review locks and its PDF is made. The card says <strong>Approved on</strong> with <strong>Open PDF</strong>; the review stays in <strong>My reviews</strong>, and the agreed goals become <strong>My goals</strong> for the year, to update as you go. See <Link href="/manual/guides/human-resources" className="font-bold text-tn-teal">Human Resources</Link>.</p>
      </Step>

      <Tip title="Are you a Team Leader?">Your self-review also has <strong>Team priorities for 2027</strong>, for your team. Write them with <strong>Add a priority</strong> and click <strong>Send for approval</strong>: the VP of Operations or the CISO approves them, and that opens your team&apos;s self-reviews. Sending them does not send your self-review.</Tip>

      <Part title="For managers">When someone reports to you, you do steps 2 to 4 of their review. Each step you owe is a row in your Needs you, and Human Resources, Reviews lists your people with where each one is.</Part>

      <Step n={10} title="Review their self-review" picture={<Picture caption="Jordan reviewing Alex's self-review." height={560}><ReviewPagePicture step="review" /></Picture>}>
        <p className="m-0">Open the row <strong>Review</strong> &hellip; <strong>self-review</strong> in Needs you, or the person in Reviews. Read their answers and their goals. To change a goal, click the pencil beside it; to add one, <strong>Add a goal</strong>. Every change is marked for them, and the original is kept.</p>
        <p className="m-0">Answer <strong>Manager&apos;s Feedback</strong>: performance summary, strengths, areas for development, goal alignment and support plan. If the self-review is not ready, <strong>Send back to</strong> them with a reason.</p>
      </Step>

      <Step n={11} title="Book the meeting">
        <p className="m-0">Click <strong>Save and book the meeting</strong>. Your feedback locks and the Agenda&apos;s New event drawer opens filled in, on the first time you are both free, with a Google Meet link. Send it and it goes on both Google Calendars. To move it later, use <strong>Book another time</strong>.</p>
        <p className="m-0">During or after the meeting, write the <strong>Meeting notes</strong> in the review; the person reads them before agreeing. A goal the meeting changes can still be changed now.</p>
      </Step>

      <Step n={12} title="Approve" picture={<Picture caption="Ready to approve." height={560}><ReviewPagePicture step="approval" /></Picture>}>
        <p className="m-0">Once they click I have read and agree, the review comes back to you with <strong>Ready to approve</strong>: every step and its date. Click <strong>Approve and make the PDF</strong> and confirm. The review locks for good, the PDF is saved to Google Drive in a folder for the year, and HR is told. If something is off, <strong>Send back to the meeting</strong>.</p>
      </Step>

      <Step n={13} title="During the year: goals and the 6-month check-in" picture={<Picture caption="My team's goals."><TeamGoalsPicture /></Picture>}>
        <p className="m-0">In Human Resources, <strong>My team&apos;s goals</strong> lists your people. <strong>Open</strong> shows their goals with their updates, for your comments. <strong>Book</strong> books the 6-month check-in in the Agenda; at the check-in, write a comment on every goal and click <strong>Finish the check-in</strong>. They get your comments by email and in Needs you.</p>
      </Step>

      <Tip title="Any step can go back one.">Always with a reason the other person reads: the review back to the self-review, the meeting back to the review, the approval back to the meeting.</Tip>

      <Part title="For HR, the VP of Operations and the CISO">The roles are picked in Admin, Company settings, Human Resources. HR sees every review and is told when one is approved. The CISO reviews the VP of Operations, and nobody reviews the CISO, who has no review of their own. The VP of Operations and the CISO write the Company Priorities and approve each team&apos;s; each reviews only the people who report to them.</Part>

      <Step n={14} title="Set up the year">
        <p className="m-0">In <strong>Company settings</strong>, <strong>Human Resources</strong>: the <strong>Roles</strong>, <strong>Who takes part</strong> (every employee in the Directory, plus anyone added there, a contractor for example), the <strong>Dates</strong> (Team Leaders open on, Team Leaders&apos; self-review by, Teams open by, Self-review by, Review by, Meeting by, Approval by, Check-ins by) and the <strong>Google Drive</strong> folder for the PDFs. A Super Admin and the HR person change them.</p>
      </Step>

      <Step n={15} title="Import last year's reviews">
        <p className="m-0">In the same place, under <strong>Last year&apos;s reviews</strong>, click <strong>Import last year&apos;s reviews</strong> and <strong>Pick the files</strong> from Google Drive. Each file is matched to a person by its name; on <strong>Check the matches</strong>, fix any marked Check or No match with <strong>Pick a person</strong>.</p>
        <p className="m-0">The portal reads the goals and the Job Description in each file; check them against the file, add what was missed and fix what was read wrong. Those goals are then waiting in each person&apos;s review to be marked, and the file opens beside it. From the second year on, this is not needed: the goals agreed in the portal come in by themselves.</p>
      </Step>

      <Step n={16} title="Write and approve the priorities" picture={<Picture caption="Priorities, with the Writers' sent for approval." height={620}><PrioritiesPicture /></Picture>}>
        <p className="m-0">In Human Resources, <strong>Reviews</strong>, click <strong>Edit priorities</strong>. Write the whole-company ones with <strong>Add a whole-company priority</strong>: a title and what it means. They show in every review.</p>
        <p className="m-0">When a Team Leader sends their team&apos;s, they wait under <strong>Team priorities to approve</strong>. <strong>Approve</strong> opens that team&apos;s self-reviews at once; <strong>Send back</strong> returns them with a reason; <strong>Edit</strong> changes their text. Either of you can approve, except a team one of you leads: the other one approves it.</p>
      </Step>

      <Step n={17} title="Start the cycle" picture={<Picture caption="Ready to start the 2026 cycle?" height={560}><StartCyclePicture /></Picture>}>
        <p className="m-0">Nothing opens before the cycle starts. In <strong>Reviews</strong>, <strong>Ready to start the 2026 cycle?</strong> checks the dates, roles, who takes part, the priorities, the Drive folder and last year&apos;s reviews, each with a link to fix it. A Super Admin clicks <strong>Start the 2026 cycle</strong>, then <strong>Start the cycle</strong>: the Team Leaders and the people with no Team Leader get their self-review and an email.</p>
      </Step>

      <Step n={18} title="Follow the year" picture={<Picture caption="The year's list." height={560}><ReviewListPicture /></Picture>}>
        <p className="m-0"><strong>Reviews</strong> lists every review of the year: the step, who it waits for, the due date and the Drive copy. The numbers on top (All, Waiting for self-review, In review, Meeting to book, Approved) filter the list; the year buttons show other years, including the imported ones.</p>
      </Step>

      <Tip title="Approving a team's priorities opens its self-reviews.">Before that, or before the Teams open by date, the team&apos;s people see that their review opens soon.</Tip>
    </div>
  )
}
