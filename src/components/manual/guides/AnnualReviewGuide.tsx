// The Annual review guide (owner, 4 November 2026; rewritten for the workflow
// of 10 November 2026, docs/annual-review/01-workflow-2026-11.md): a tutorial
// for the person doing their review, then the parts for reviewers, for people
// with two reviewers, for the VP of Operations, the CISO and HR, and the
// 6-month check-in. Written from the built screens (components/review,
// lib/review, app/(app)/human-resources). The pictures are those screens with
// made-up data.

import Link from 'next/link'
import { GuideHeader, Picture, Step, Tip } from '../GuideParts'
import {
  GoalsPicture, PastGoalsPicture, PrioritiesPicture, ReviewCardPicture, ReviewListPicture, ReviewPagePicture, StartCyclePicture,
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
      <GuideHeader eyebrow="People" title="Annual review" minutes={12}>
        Once a year you look back at your year and agree your goals for the next one with the person you report to: your Team Leader or, if you have none, the person you report to in the Directory. The VP of Operations starts it in November and every step has its date, all approved by mid-December: your self-review, their review, a meeting where you read and agree, and their approval. Six months later there is a check-in on the goals. Everything lives in People, Human Resources.
      </GuideHeader>

      <Part title="Your self-review">Steps 1 to 9 walk through your own review, from the day it opens to the PDF.</Part>

      <Step n={1} title="Know when it opens" picture={<Picture caption="Your review card, on Human Resources and on Home."><ReviewCardPicture state="progress" /></Picture>}>
        <p className="m-0">Everyone&apos;s self-review opens the day the VP of Operations starts the reviews. You get an email and a row in <strong>Needs you</strong> on Home: <strong>Write your self-review</strong>, with its due date, about two weeks later.</p>
        <p className="m-0">Reminders come 3 days before, the day before and on the due day, by email and in Needs you.</p>
      </Step>

      <Step n={2} title="Open your review" picture={<Picture caption="The top of your review: who you are, and the four steps." height={520}><ReviewPagePicture step="self" /></Picture>}>
        <p className="m-0">Click <strong>Start your self-review</strong> (later, <strong>Continue</strong>) on the card. The top shows your position, team, who reviews you and your date of hire, from the Directory, and the four steps with their dates. On a wide screen, <strong>In this review</strong> on the left lists the sections with how far each one is; click one to jump to it.</p>
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

      <Step n={5} title="Propose your goals for next year" picture={<Picture caption="The priorities, and a goal being written." height={760}><GoalsPicture /></Picture>}>
        <p className="m-0">The goals open when the CISO&apos;s <strong>Company Priorities</strong> and the <strong>VP of Operations&apos; priorities</strong> are ready, in the first days. Until then the section says so, and the look back at the year is yours to write.</p>
        <p className="m-0">Read the priorities first: your goals should be built on them, and on your team&apos;s, as much as possible. Under <strong>Your goals for 2027</strong>, click <strong>Add a goal</strong> and fill in <strong>What</strong>, <strong>How it is measured</strong>, <strong>By when</strong> (month and year), the <strong>Term</strong> (6 months or 1 year) and which priority it serves. The bin removes a goal.</p>
      </Step>

      <Step n={6} title="Submit">
        <p className="m-0">The bar at the bottom counts your answers and goals. Click <strong>Submit to</strong> and the name of the person you report to. The window warns you about empty questions, goals not marked yet and no goals for next year; <strong>Keep writing</strong> takes you back, <strong>Submit</strong> sends it.</p>
        <p className="m-0">Your part locks once it is sent. If something needs changing, they can send it back to you with a reason, shown at the top of your review.</p>
      </Step>

      <Step n={7} title="The meeting">
        <p className="m-0">The person you report to reads your self-review, may change or add goals, writes their feedback and books a meeting with you. It lands on the Agenda and on your Google Calendars, with a Google Meet link, and the card shows its day and time.</p>
      </Step>

      <Step n={8} title="Read and agree" picture={<Picture caption="After the meeting: your review, with the notes and the agreed goals." height={640}><ReviewPagePicture step="agree" /></Picture>}>
        <p className="m-0">After the meeting the card says <strong>Read and agree</strong>. Open the review and read the <strong>Meeting notes</strong>, the <strong>Agreed goals</strong> and the <strong>Manager&apos;s Feedback</strong>. A goal your manager changed is marked <strong>Changed by</strong>, with <strong>Show the original</strong>; one they added is marked <strong>Added by</strong>.</p>
        <p className="m-0">When you are happy, click <strong>I have read and agree</strong>. The review goes to them for their final remarks and approval.</p>
      </Step>

      <Step n={9} title="Approved">
        <p className="m-0">Once approved, Needs you shows <strong>Your 2026 review is approved</strong>. <strong>See my review</strong> opens a window that says what happens next: your goals are recorded on your profile and in Human Resources, My review; a copy is kept in the company&apos;s Google Drive; and in 6 months there is a check-in on them. <strong>Got it</strong> clears the row.</p>
        <p className="m-0">The agreed goals become <strong>My goals</strong> for the year, to update as you go. See <Link href="/manual/guides/human-resources" className="font-bold text-tn-teal">Human Resources</Link>.</p>
      </Step>

      <Tip title="Are you a Team Leader?">Your self-review starts with <strong>your team&apos;s priorities for 2027</strong>. Write them first with <strong>Add a priority</strong>: there is no approval, and your team sees them in their reviews as soon as you write them. You cannot submit your self-review without at least one.</Tip>

      <Part title="For reviewers">When someone reports to you, you do steps 2 to 4 of their review. Each step you owe is a row in your Needs you, and Human Resources, Reviews lists your people with where each one is. The VP of Operations reviews the Team Leaders while the Team Leaders review their teams, in the same weeks.</Part>

      <Step n={10} title="Review and book the meeting" picture={<Picture caption="Jordan reviewing Alex's self-review." height={560}><ReviewPagePicture step="review" /></Picture>}>
        <p className="m-0">Open the row <strong>Review</strong> &hellip; <strong>and book the meeting</strong> in Needs you, or the person in Reviews. Read their answers and their goals. To change a goal, click the pencil beside it; to add one, <strong>Add a goal</strong>. Every change is marked for them, and the original is kept.</p>
        <p className="m-0">Answer <strong>Manager&apos;s Feedback</strong>, then click <strong>Save and book the meeting</strong>: your feedback locks and the Agenda&apos;s New event drawer opens filled in, on the first time you are both free, with a Google Meet link. If the self-review is not ready, <strong>Send back to</strong> them with a reason.</p>
      </Step>

      <Step n={11} title="The meeting and the notes">
        <p className="m-0">During or after the meeting, write the <strong>Meeting notes</strong> in the review; the person reads them before agreeing. A goal the meeting changes can still be changed now. To move the meeting, use <strong>Book another time</strong>.</p>
      </Step>

      <Step n={12} title="Final remarks and approval" picture={<Picture caption="Final remarks and approval." height={560}><ReviewPagePicture step="approval" /></Picture>}>
        <p className="m-0">Once they click I have read and agree, the review comes back with <strong>Final remarks and approval</strong>: every step and its date. Click <strong>Approve</strong> and confirm. The review locks for good, the PDF is saved to Google Drive in a folder for the year, and HR is told. If something is off, <strong>Send back to the meeting</strong>.</p>
        <p className="m-0">With several waiting, Human Resources, Reviews shows <strong>Approve all</strong>: read each one first, then approve them together.</p>
      </Step>

      <Tip title="Any step can go back one.">Always with a reason the other person reads: the review back to the self-review, the meeting back to the review, the approval back to the meeting.</Tip>

      <Part title="Two reviewers">Someone who leads their own team and also works in another team is reviewed by both: the person they report to, for their own team, and the other team&apos;s Team Leader. Company settings, Human Resources lists them, and a Super Admin can add or remove one.</Part>

      <Step n={13} title="Each reviewer has their own part" picture={<Picture caption="Sam Patel, reviewed by Chris Taylor for SEO and by Jordan Lee for the Writers; seen by Jordan." height={600}><ReviewPagePicture step="two" /></Picture>}>
        <p className="m-0">There is one self-review. Each reviewer then has their own <strong>Review by</strong> part, their own meeting and notes, the person&apos;s read and agree, and their own approval. The person says which reviewer each goal is for, under <strong>For</strong>; each reviewer changes only their own goals.</p>
        <p className="m-0">Booking the meeting invites the other reviewer too, to make it one meeting for both parts. The review is approved, and copied to Drive, only when both have approved; the PDF has both parts.</p>
      </Step>

      <Part title="For the VP of Operations, the CISO and HR">The roles are picked in Admin, Company settings, Human Resources. The VP of Operations starts the reviews and adds their own priorities; the CISO writes the Company Priorities; HR sees every review and is told when one is approved. The CISO reviews the VP of Operations, and nobody reviews the CISO, who has no review of their own.</Part>

      <Step n={14} title="Before the start">
        <p className="m-0">In <strong>Company settings</strong>, <strong>Human Resources</strong>: the <strong>Roles</strong>, <strong>Who takes part</strong> (every employee in the Directory, plus anyone added there, a contractor for example), <strong>Two reviewers</strong>, and the <strong>Google Drive</strong> folder for the PDFs.</p>
        <p className="m-0">In the same place, <strong>Import last year&apos;s reviews</strong> picks the files from Google Drive; each is matched to a person by its name. Fix any marked Check or No match, then check the goals and Job Description read from each file. From the second year on, this is not needed.</p>
      </Step>

      <Step n={15} title="Start the reviews" picture={<Picture caption="Before the start, as the VP of Operations sees it." height={620}><StartCyclePicture /></Picture>}>
        <p className="m-0">From the second Monday of November, the VP of Operations has <strong>Start the reviews</strong> in Needs you. In Human Resources, Reviews, click <strong>Start Reviews</strong>: the window confirms the year (only the current one) and shows every date it sets from today. Click <strong>Start</strong>.</p>
        <p className="m-0">Everyone&apos;s self-review opens with an email, and the CISO and the VP are asked for the priorities. A Super Admin can start it too, when the VP cannot.</p>
      </Step>

      <Step n={16} title="The priorities" picture={<Picture caption="The priorities, as the CISO sees them." height={620}><PrioritiesPicture /></Picture>}>
        <p className="m-0">In Reviews, click <strong>Priorities</strong>. The CISO writes the <strong>Company Priorities</strong> within two days; the VP of Operations adds theirs within four. Each clicks <strong>Mark them ready</strong>: when both are ready, the goals for next year open in every self-review. Every review shows both.</p>
        <p className="m-0">Below, <strong>Teams</strong> shows how many priorities each Team Leader has written in their self-review.</p>
      </Step>

      <Step n={17} title="Follow the year" picture={<Picture caption="The progress block and the year's list." height={760}><ReviewListPicture /></Picture>}>
        <p className="m-0">On top of Reviews, the progress block lists each step: who does it, how many have done it, its date and its state. <strong>Who</strong> opens the people behind the number, late first, with <strong>Remind</strong>. The VP and HR can <strong>Change the dates</strong>.</p>
        <p className="m-0">When a step is done before its date, the block offers <strong>Move the later dates up</strong> by the days saved. A late step never pushes the dates after it. From 2 days late, the VP sees the people in Needs you.</p>
      </Step>

      <Part title="The 6-month check-in">Six months after the start, everyone looks at their goals again with the person who reviewed them.</Part>

      <Step n={18} title="Start it and check the priorities">
        <p className="m-0">The VP of Operations gets <strong>Start the 6-month check-in</strong> in Needs you; in Reviews, click <strong>Start check-in</strong>. Then, in Priorities, the VP and the CISO go through each Company Priority under <strong>The priorities at mid-year</strong>: <strong>No change</strong>, <strong>Changed</strong> (say what and why) or <strong>Added</strong>.</p>
        <p className="m-0">Click <strong>Priorities checked, tell everyone</strong>: each person and each reviewer get the check-in in Needs you and by email. The check-in has its own progress block in Reviews.</p>
      </Step>

      <Step n={19} title="The check-in in each review" picture={<Picture caption="Alex's check-in, as Jordan sees it." height={640}><ReviewPagePicture step="checkin" /></Picture>}>
        <p className="m-0">Each approved review gets a <strong>6-month check-in</strong> part, with the priorities as checked on top. The reviewer clicks <strong>Book the check-in</strong> (the Agenda, filled in). Together they tick goals done, the reviewer clicks <strong>Adjust</strong> or <strong>Add a goal</strong>, and each writes their notes.</p>
        <p className="m-0">The reviewer clicks <strong>Finish the check-in</strong>: the person gets the notes by email and in Needs you. With two reviewers, each one has their own block.</p>
      </Step>
    </div>
  )
}
