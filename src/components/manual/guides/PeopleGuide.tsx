// The People guides (owner, 4 November 2026): the Directory and a person's
// page, the org chart, History and Human Resources. Written from the built
// screens (components/admin, components/person, components/OrgChart,
// components/history, components/hr, components/review); who sees what follows
// lib/directory/page-rights.ts and lib/access/catalogue.ts. The pictures are
// those screens with made-up data.

import Link from 'next/link'
import { GuideHeader, Picture, Step, Tip } from '../GuideParts'
import {
  AnniversariesPicture, DirectoryPicture, HistoryPicture, HrTabsPicture, OrgChartPicture, PersonPagePicture, PortalAccessPicture, ReportsPicture,
} from './PeoplePictures'
import { HistoryRowsPicture, MyGoalsPicture, ReviewCardPicture, TeamGoalsPicture } from './ReviewPictures'

const link = 'font-bold text-tn-teal'

export function DirectoryGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideHeader eyebrow="People" title="Directory" minutes={6}>
        The Directory is everyone at True North, and each person has their own page. How much you see depends on your level: everyone opens their own page, Team Leaders also see the people on the teams they lead, and Admins keep the records.
      </GuideHeader>

      <Step n={1} title="Open your own page">
        <p className="m-0">Click your photo at the top right, then <strong>My profile</strong>. Everyone has this page, whatever their level. You can also reach it from the Directory, My Team and Human Resources.</p>
      </Step>

      <Step n={2} title="Read the tabs" picture={<Picture caption="Alex's own page, on the Personal tab." height={620}><PersonPagePicture viewer="own" tab="personal" /></Picture>}>
        <p className="m-0">The top of the page shows the photo, job title, teams, the day the person joined and their anniversary badge. Below it, one tab per who keeps the information:</p>
        <ul className="m-0 pl-5 flex flex-col gap-1">
          <li><strong>Personal</strong>: contact, date of birth and address. You keep these: click <strong>Edit personal data</strong>, change what you need and <strong>Save changes</strong>.</li>
          <li><strong>Work</strong>: job, type, schedule, company emails, teams, who you report to, dates, milestones and employment history. The company keeps these; if something is wrong, tell an Admin.</li>
          <li><strong>Payments</strong>: your invoices or pay periods and reimbursements, when North Time is open to you. Only you, Super Admins and Finance see it: someone else&apos;s pay, rates and invoices are never shown to Team Leaders, nor to Admins unless they are Finance (November 5, 2026). Rates &amp; Costs is the same: Super Admins change it, Finance reads it.</li>
          <li><strong>HR and access</strong>: onboarding, offboarding, the portal invitation, two-step sign-in and last access. It is never shown to the person themselves, unless their own level opens it on everyone&apos;s page.</li>
          <li><strong>Reports</strong>: who reports to the person, by reporting line or through a team they lead.</li>
        </ul>
        <p className="m-0">The coloured line under the tabs always says who keeps the tab and whether you can change it.</p>
      </Step>

      <Step n={3} title="Find someone" picture={<Picture caption="The Directory as an Admin sees it." height={560}><DirectoryPicture /></Picture>}>
        <p className="m-0">On the left rail, click <strong>People</strong>, then <strong>Directory</strong>. Type in <strong>Search people…</strong> to find someone by name, job title or team. Admins also get <strong>Filter</strong> to filter by any column and a Columns menu to choose which columns show; the list keeps Active and Inactive people apart.</p>
        <p className="m-0">Click a row to open that person&apos;s page. In the shorter list a Team Leader sees, a name with an arrow opens a page; the others show only name, role and team.</p>
      </Step>

      <Step n={4} title="Who sees what">
        <ul className="m-0 pl-5 flex flex-col gap-1">
          <li><strong>User</strong>: no Directory on the rail. Their own page, from My profile.</li>
          <li><strong>Team Leader</strong>: the whole company list and the Teams tab, read only. They open the pages of the people on the teams they lead, on the Work tab.</li>
          <li><strong>Admin</strong>: the full Directory with its tabs (People, Emails, Teams, Access log, Portal access) and everyone&apos;s page with every tab. They add and remove people and invite them to the portal.</li>
          <li><strong>Super Admin</strong>: everything, and also teams and who leads them, and resetting someone&apos;s two-step sign-in.</li>
        </ul>
        <p className="m-0">These are the usual settings; a Super Admin can change each item on Admin, Access levels.</p>
      </Step>

      <Step n={5} title="See who reports to someone" picture={<Picture caption="Jordan's Reports tab." height={420}><ReportsPicture /></Picture>}>
        <p className="m-0">Open the person&apos;s page and click <strong>Reports</strong>. Each card is someone who reports to them; &ldquo;dotted line&rdquo; means they also report to someone else. A card opens that person&apos;s page when your access allows it.</p>
      </Step>

      <Step n={6} title="Admins: add a person">
        <p className="m-0">On the Directory&apos;s People tab, click <strong>Add person</strong>, then <strong>Add person</strong> again in the menu. Fill in the full name, the job (title, type, time, weekly hours), the company emails, who they report to and the day they joined. <strong>Timesheet (required)</strong> says how often they submit their hours. Click <strong>Add person</strong> at the bottom: their page opens, and their personal details and HR are filled in there.</p>
      </Step>

      <Step n={7} title="Admins: edit a person" picture={<Picture caption="Alex's Work tab, as an Admin sees it." height={560}><PersonPagePicture viewer="admin" tab="work" /></Picture>}>
        <p className="m-0">Open their page and the tab to change. <strong>Edit work</strong> changes the Work tab, <strong>Edit personal data</strong> the Personal tab and <strong>Edit statuses</strong> the HR and access tab (onboarding, offboarding and the QuickBooks Time link). Each tab saves on its own with <strong>Save changes</strong>. Edit work keeps the Work tab&apos;s sections where they are, and each line you can change turns into its field: <strong>Reports to</strong> and <strong>Also reports to</strong> in Approvals, <strong>Pays as</strong> and the rate in Pay and hours (for whoever keeps Rates &amp; Costs). A contractor&apos;s <strong>Hours limit</strong> is their hours allowance, <strong>Per week</strong> or <strong>Per month</strong> (Per month is for people paid monthly), and the line under it shows what it gives each pay period. Teams and who leads them are changed only by a Super Admin.</p>
        <p className="m-0">To take someone out, use <strong>Remove from the Directory</strong> in Edit work. If they have hours or rates on record they are made inactive instead, so every report stays true.</p>
      </Step>

      <Step n={8} title="Admins: invite them to the portal" picture={<Picture caption="Portal access, with everyone active and where they stand." height={520}><PortalAccessPicture /></Picture>}>
        <p className="m-0">People sign in with their GoodNews address, after an Admin invites them. On the person&apos;s page, open <strong>HR and access</strong> and click <strong>Invite</strong> next to Invitation. They get an email; until they sign in the pill says <strong>Invited</strong>, with <strong>Send again</strong> and <strong>Revoke</strong> beside it.</p>
        <p className="m-0">To invite several people at once, open the Directory&apos;s <strong>Portal access</strong> tab, tick them and click <strong>Invite selected</strong>. The chips on top count each group (Not invited, Invited, not in yet, Signed in, Two-step not set up) and filter the list.</p>
      </Step>

      <Tip title="No GoodNews address?">The invitation needs one: add a @goodnewsadvocates.org address on the Work tab first, since it is the one they sign in with.</Tip>
    </div>
  )
}

export function OrganizationGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideHeader eyebrow="People" title="Organization" minutes={2}>
        The org chart shows who reports to whom across True North. Everyone signed in can see it. It is drawn from the Directory, so it changes by itself when someone&apos;s team or reporting line changes.
      </GuideHeader>

      <Step n={1} title="Open the org chart" picture={<Picture caption="The org chart." height={460}><OrgChartPicture /></Picture>}>
        <p className="m-0">On the left rail, click <strong>People</strong>, then <strong>Human Resources</strong>. The chart is the <strong>Organization</strong> block, before the anniversary badges; once you have tabs there, it is on the <strong>Anniversaries</strong> tab. Old links to Organization land there too.</p>
      </Step>

      <Step n={2} title="Read it">
        <p className="m-0">Each card is a person with their job title and teams; the bar on top is the colour of the team they lead, or else of their main team. A solid line goes to the person they report to; a dotted line is &ldquo;also reports to&rdquo;. A lighter dashed card that says &ldquo;also on&rdquo; a team is someone whose main team is elsewhere: the same person, not an extra one.</p>
      </Step>

      <Step n={3} title="Go full screen">
        <p className="m-0">Click <strong>Full screen</strong>. Zoom in and out with the buttons, or the + and - keys; <strong>Reset</strong> (or 0) goes back to 100%. Drag the chart to move around. <strong>Close</strong>, or Escape, brings you back.</p>
      </Step>

      <Tip title="Something wrong in the chart?">The chart only draws what the Directory says. Ask an Admin to fix the person&apos;s Reports to, or a Super Admin to fix their teams.</Tip>
    </div>
  )
}

export function HistoryGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideHeader eyebrow="People" title="History" minutes={2}>
        History tells how things came to be at True North, with dates. Everyone signed in can read it. The first tab is the portal&apos;s own story; more histories will join it.
      </GuideHeader>

      <Step n={1} title="Open History" picture={<Picture caption="History, The portal tab." height={620}><HistoryPicture /></Picture>}>
        <p className="m-0">On the left rail, click <strong>People</strong>, then <strong>History</strong>. It opens on <strong>The portal</strong>. The <strong>True North</strong> tab says &ldquo;later&rdquo;: it is not written yet.</p>
      </Step>

      <Step n={2} title="Read it by chapter">
        <p className="m-0">The story is in five chapters: How it started, What it is for, What we built, The move and What comes next. The chapter menu follows you as you scroll; click a chapter to jump to it. The timeline at the top shows the main dates at a glance.</p>
      </Step>

      <Tip title="Something big just shipped?">History is the portal&apos;s record, so an entry is only added once the portal&apos;s owner says yes.</Tip>
    </div>
  )
}

export function HumanResourcesGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideHeader eyebrow="People" title="Human Resources" minutes={4}>
        Human Resources is open to everyone: your annual review, the goals you agreed in it, the org chart and the anniversary badges. Managers also follow the goals of the people who report to them.
      </GuideHeader>

      <Step n={1} title="Open Human Resources" picture={<Picture caption="The review card at the top of Human Resources."><ReviewCardPicture state="progress" /></Picture>}>
        <p className="m-0">On the left rail, click <strong>People</strong>, then <strong>Human Resources</strong>. While your review is open, its card is on top (and on Home): where it stands, the four steps and the button for what to do next.</p>
        <p className="m-0">Until a review of yours has been approved in the portal, the page is just that card, the org chart and the badges, with <strong>My review</strong> and, for those who follow reviews, <strong>Reviews</strong>.</p>
      </Step>

      <Step n={2} title="The tabs" picture={<Picture caption="The tabs, for someone with people reporting to them."><HrTabsPicture team /></Picture>}>
        <ul className="m-0 pl-5 flex flex-col gap-1">
          <li><strong>My reviews</strong>: every year, with its PDF. Only you, the person you report to and HR see them.</li>
          <li><strong>My goals</strong>: the goals you agreed in your last review, to update during the year.</li>
          <li><strong>My team&apos;s goals</strong>: only for someone with people reporting to them.</li>
          <li><strong>Anniversaries</strong>: the org chart and the service badges, for everyone.</li>
          <li><strong>Reviews</strong>: the year&apos;s list. HR, the VP of Operations, the CISO and Super Admins see everyone; a manager sees the people who report to them.</li>
        </ul>
      </Step>

      <Step n={3} title="My reviews" picture={<Picture caption="My reviews."><HistoryRowsPicture /></Picture>}>
        <p className="m-0">Each year is a row: <strong>Approved</strong>, <strong>In progress</strong> or <strong>Imported</strong> (a review from before the portal, kept as a PDF). <strong>Open</strong> shows the review; <strong>PDF</strong> or <strong>Open the PDF</strong> shows the file, with a download. Your reviews are also on your page in the Directory, under HR.</p>
      </Step>

      <Step n={4} title="Update a goal" picture={<Picture caption="My goals during the year." height={560}><MyGoalsPicture /></Picture>}>
        <p className="m-0">On <strong>My goals</strong>, click <strong>Update</strong> on a goal. Pick where it is (Not started, On track, At risk, Done or No longer relevant), say what changed in a sentence and click <strong>Save the update</strong>. The person you report to sees it and can comment.</p>
        <p className="m-0">The navy band on top is your 6-month check-in: your manager books it in the Agenda and you go through every goal together.</p>
      </Step>

      <Step n={5} title="Managers: my team's goals" picture={<Picture caption="My team's goals."><TeamGoalsPicture /></Picture>}>
        <p className="m-0">One row a person: how many goals, where they are, the 6-month check-in and the last update. <strong>Open</strong> shows their goals to comment on; <strong>Book</strong> books the check-in in the Agenda. The full steps are in <Link href="/manual/guides/annual-review" className={link}>Annual review</Link>.</p>
      </Step>

      <Step n={6} title="Anniversary badges" picture={<Picture caption="The anniversary badges."><AnniversariesPicture /></Picture>}>
        <p className="m-0">Every service milestone in order: 3, 6 and 9 months in the first year, then each year. The number under a badge is how many people hold it now; a faded one has nobody. Click a badge to list its people below; a name opens their page when your access allows it.</p>
        <p className="m-0">The line on top names the next person to complete a year, within the coming month. People who joined less than 3 months ago have no badge yet.</p>
      </Step>

      <Tip title="Your badge is on your page too.">The badge at the top right of your page in the Directory is the same one, with the next milestone beside it.</Tip>
    </div>
  )
}
