// The Client Reports guides (owner, 4 November 2026): what they are, then the
// i7 report and Project Hours & Others. Written from the built pages
// (app/(app)/ops/client-reports, components/tsheets); the pictures are those
// screens with made-up people, hours and money.

import Link from 'next/link'
import { GuideHeader, Picture, Step, Tip } from '../GuideParts'
import { ClientReportTabs } from '@/components/ClientReportTabs'
import {
  I7HistoryPicture, I7ReportPicture, ManualHoursPicture, MonthNotePicture,
  ProjectHistoryPicture, ProjectHoursPicture, ProjectToolbarPicture,
} from './ClientReportsPictures'

const A = 'font-bold text-tn-teal'

export function ClientReportsGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideHeader eyebrow="Tools" title="Client Reports" minutes={3}>
        The client reports turn the hours the team logs into what each client used: hours, cost and, for i7, the budget. The hours come from QuickBooks Time, imported into the portal, plus any added by hand. There are two reports, and each one is open to its own levels and teams, set by a Super Admin on Access levels.
      </GuideHeader>

      <Step n={1} title="Open Client Reports" picture={<Picture caption="The tabs, when you can open both reports."><ClientReportTabs active="i7-budget" canTool={() => true} /></Picture>}>
        <p className="m-0">On the left rail, click <strong>Tools</strong>, then <strong>Client Reports</strong> under Operations. It opens the first report you may see. If you can open both, tabs at the top switch between <strong>i7</strong> and <strong>Project Hours &amp; Others</strong>.</p>
      </Step>

      <Step n={2} title="Pick the report">
        <p className="m-0"><strong>i7</strong> is i7 Marketing&apos;s budget report: every hour on its projects, what it cost, and how much of the month&apos;s budget is left. See <Link href="/manual/guides/client-report-i7" className={A}>i7 report</Link>.</p>
        <p className="m-0"><strong>Project Hours &amp; Others</strong> follows AskAnAdventistFriend.com, Grants Pass Church and School, and Hope for Africa: hours by person and by month, costs, donations and prepaid hours. See <Link href="/manual/guides/client-report-project-hours" className={A}>Project Hours &amp; Others</Link>.</p>
      </Step>

      <Step n={3} title="Choose the months">
        <p className="m-0">Both reports open on the current month. <strong>Period</strong> changes it: <strong>One month</strong>, a <strong>Year</strong>, the <strong>Last 12 months</strong> or <strong>Choose months</strong>. The address keeps your choice, so you can send someone the exact view.</p>
      </Step>

      <Tip title="Seeing less than a colleague?">Some parts are separate permissions: exporting, the Team Update image, adding hours by hand and entering money. If a button in this guide is not on your screen, your level does not have it yet.</Tip>
    </div>
  )
}

export function ClientReportI7Guide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideHeader eyebrow="Tools" title="i7 report" minutes={6}>
        Client Report · i7 shows the hours, cost and budget usage for i7 Marketing, month by month. Whoever opens it sees all of it, budget included.
      </GuideHeader>

      <Step n={1} title="Open the report" picture={<Picture caption="The i7 report on In Numbers, as an Admin sees it." height={760}><I7ReportPicture /></Picture>}>
        <p className="m-0">Go to <strong>Tools</strong>, <strong>Client Reports</strong>, then the <strong>i7</strong> tab. The line at the top says where the hours come from and when they were last synced. The round &quot;i&quot; beside it opens <strong>How the i7 Budget Usage Report is built</strong>, the report&apos;s Guide: every input and formula in plain words.</p>
      </Step>

      <Step n={2} title="Choose the period and the team">
        <p className="m-0">Pick the months in <strong>Period</strong>. <strong>Team</strong> keeps only the hour columns of that team&apos;s people; hours used, cost and budget stay the figures for everyone, and the report says so above the table.</p>
      </Step>

      <Step n={3} title="Read the budget">
        <p className="m-0">On <strong>In Numbers</strong>, the budget card comes first. <strong>Carried in</strong> is the balance brought from last month. <strong>Budget total this month</strong> is that plus this month&apos;s budget, <strong>Balance left</strong> is what remains after this month&apos;s cost, and the <strong>Budget used</strong> bar shows how much of it is spent.</p>
      </Step>

      <Step n={4} title="Open a project">
        <p className="m-0">The table lists each <strong>Project · Job code · Activity</strong>. Click a project to see its job codes, and a job code to see its activities. <strong>Expand all</strong> and <strong>Collapse all</strong>, under the table, open or close everything.</p>
        <p className="m-0"><strong>Budget hrs</strong> is the project&apos;s planned hours for the month, <strong>Hrs avail.</strong> what is left of them, <strong>Budget avail.</strong> those hours in dollars at the i7 rate, and <strong>Budget used</strong> each person&apos;s hours times their rate. Then one column per person, and <strong>Hours used</strong>.</p>
      </Step>

      <Step n={5} title="See it in charts" picture={<Picture caption="The same month on In Graphics." height={620}><I7ReportPicture view="graphics" /></Picture>}>
        <p className="m-0">Click <strong>In Graphics</strong> for the same figures as charts: <strong>Hours by project</strong>, <strong>Hours by person</strong>, <strong>Budget utilization</strong> (each project against its budget, marked <strong>Near budget</strong> or <strong>Over budget</strong>) and <strong>Activity mix</strong>.</p>
      </Step>

      <Step n={6} title="Add hours by hand" picture={<Picture caption="Add hours: the form and the hours already added this month." height={560}><ManualHoursPicture /></Picture>}>
        <p className="m-0">For hours that are not in QuickBooks Time, such as an invoice from someone outside it, click <strong>Add hours</strong>. Fill in the <strong>Person</strong>, <strong>Day</strong>, <strong>Hours</strong>, the job and its <strong>1 - i7 Code</strong>, <strong>3 Activity</strong> and <strong>4 Billable</strong>, plus a note if you like. <strong>+ Add another line</strong> keeps the job for the next line; <strong>Add to the report</strong> saves them all.</p>
        <p className="m-0">Below the form, the hours already added this month are listed, each with <strong>Remove</strong>. They count exactly like imported hours. Only the levels given &quot;Add manual hours&quot; see this button.</p>
      </Step>

      <Step n={7} title="Share the Team Update">
        <p className="m-0"><strong>Team Update</strong> downloads a picture of the month&apos;s budget at a glance (used, left, the month&apos;s total) to share with the team. It works on a single month.</p>
      </Step>

      <Step n={8} title="Export the report">
        <p className="m-0"><strong>Export</strong> opens two versions, each as a PDF or a CSV. <strong>Internal</strong> is per person, with costs and rates. <strong>Client</strong> is the summary with no names, the one to send to the client. A PDF opens in a preview first, and you download it from there; the PDFs need a single month, while the CSVs cover whatever is on screen.</p>
      </Step>

      <Step n={9} title="Look back over the year" picture={<Picture caption="Full history, January to the current month." height={520}><I7HistoryPicture /></Picture>}>
        <p className="m-0">Under the report, <strong>Full history</strong> shows the year month by month: the budget, what was used, what was carried in and the hours, with <strong>Budget YTD</strong> and <strong>Used YTD</strong> on top. If you can export, choose the months and click <strong>CSV</strong>.</p>
      </Step>

      <Step n={10} title="Write the month's note" picture={<Picture caption="The month's note in Company settings."><MonthNotePicture /></Picture>}>
        <p className="m-0">The note is a short summary printed on the client PDF as Highlights. It is written in <strong>Company settings</strong>, <strong>Clients &amp; budgets</strong>: click <strong>Edit</strong> on <strong>Month note</strong>, write it and <strong>Save</strong>. It is for the current month, and only the levels given &quot;Edit the month&apos;s note&quot; can change it.</p>
      </Step>

      <Tip title="Budgets and rates live elsewhere.">The month&apos;s dollar budget and each project&apos;s budget hours are set in Company settings, Clients &amp; budgets; each person&apos;s rate in People, Rates &amp; Costs. The gear at the top right of the report goes to Company settings.</Tip>
    </div>
  )
}

export function ClientReportProjectHoursGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideHeader eyebrow="Tools" title="Project Hours & Others" minutes={5}>
        Client Report · Project Hours &amp; Others follows AskAnAdventistFriend.com, Grants Pass Church and School, and Hope for Africa, plus the i7 and MME invoices: hours by person and by month, what each project cost, the donations it received and, for Grants Pass, the hours bought in advance. It has the shape of accounting&apos;s tracking sheet.
      </GuideHeader>

      <Step n={1} title="Open the report" picture={<Picture caption="The row above the report, as an Admin sees it."><ProjectToolbarPicture /></Picture>}>
        <p className="m-0">Go to <strong>Tools</strong>, <strong>Client Reports</strong>, then the <strong>Project Hours &amp; Others</strong> tab. At the top right, the badge says when anything on the page last changed, and <strong>How this report is built</strong> explains every figure. Pick the months in <strong>Period</strong>.</p>
      </Step>

      <Step n={2} title="Read the costs" picture={<Picture caption="The Costs tab." height={620}><ProjectHoursPicture /></Picture>}>
        <p className="m-0">Four cards sum up the period: <strong>Worked this month</strong>, <strong>Costs this month</strong>, <strong>Total costs</strong> for the year and <strong>Prepaid hours left</strong> for Grants Pass. On the <strong>Costs</strong> tab, each project shows its <strong>Prepaid hours</strong> (Carried in, Prepaid, Remaining), its <strong>Employee</strong> and <strong>Contractor</strong> costs, <strong>Donations / billed</strong> and <strong>Net</strong>, then the year to date.</p>
        <p className="m-0">Costs are hours times each person&apos;s break-even rate: what a project consumed, not what left the bank. The prepaid columns stay blank for projects that do not buy hours.</p>
      </Step>

      <Step n={3} title="See who did the hours" picture={<Picture caption="The People tab, with the Writers team chosen." height={560}><ProjectHoursPicture people /></Picture>}>
        <p className="m-0">Click <strong>People</strong> for one column per person. <strong>Team</strong>, at the end of the tabs, keeps only that team&apos;s people; the totals still count everyone. i7 and MME are on Costs only.</p>
      </Step>

      <Step n={4} title="Enter the money that came in">
        <p className="m-0">If your level has &quot;Money in and donation records&quot;, click <strong>Money in</strong>. Under <strong>Donations</strong>, enter the month&apos;s total for AskAnAdventistFriend.com and Hope for Africa. Under <strong>Hours bought in advance</strong>, enter the hours Grants Pass Church or School bought, and the amount invoiced if you have it. Click <strong>Save</strong>. Leave a field empty when nothing came in.</p>
        <p className="m-0"><strong>Donation records</strong>, beside it, is where every figure entered is kept, with who changed what.</p>
      </Step>

      <Step n={5} title="Add hours by hand">
        <p className="m-0"><strong>Add hours</strong> opens the same form as on the i7 report: choose the job, then the <strong>1 Company</strong> and <strong>2 Project</strong> for these projects. See <Link href="/manual/guides/client-report-i7" className={A}>i7 report</Link>, step 6.</p>
      </Step>

      <Step n={6} title="Export">
        <p className="m-0"><strong>Export</strong> offers <strong>Client</strong> (projects, costs and donations), <strong>Internal</strong> (per person, with names) and <strong>Month by month</strong>, as PDF or CSV. The Client and Internal PDFs need a single month; the CSVs and the month by month PDF cover whatever is on screen.</p>
      </Step>

      <Step n={7} title="Look back over the year" picture={<Picture caption="The year, month by month." height={520}><ProjectHistoryPicture /></Picture>}>
        <p className="m-0">Under the report, the year runs month by month for each project: hours, costs, donations and net, from January to the month on screen. It is shown to those who can see the Costs tab.</p>
      </Step>

      <Tip title="Last year's column may differ from the old sheet.">The same period a year earlier is recalculated from the timesheets as they are today. A timesheet edited after the old sheet was filled in makes the two disagree.</Tip>
    </div>
  )
}
