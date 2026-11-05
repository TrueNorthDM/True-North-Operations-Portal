// The My Work guides (owner, 4 November 2026): My Work, the Report and My
// Team, the three views of the same module. Written from the built screens
// (components/monday, components/report, components/team); the pictures are
// those screens with made-up data.

import Link from 'next/link'
import { GuideHeader, Picture, Step, Tip } from '../GuideParts'
import { MyTeamPicture, MyWorkPicture, ReportBarPicture, ReportPicture, TeamPriorityPicture, WorkViewSwitchPicture } from './MyWorkPictures'

const MORE = 'font-bold text-tn-teal'

export function MyWorkGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideHeader eyebrow="Your work" title="My Work" minutes={5}>
        My Work is every step assigned to you across Monday, in one list. A row is a step, not an item: if you own the Write and the Review of the same item, you see two rows, one for each thing you have to do.
      </GuideHeader>

      <Step n={1} title="Open My Work" picture={<Picture caption="My Work, with your open steps in On-going." height={620}><MyWorkPicture /></Picture>}>
        <p className="m-0">Click the briefcase icon on the left rail, then <strong>My Work</strong>. A number on the icon is how many of your open steps are late.</p>
        <p className="m-0">At the top right, <strong>My Work</strong>, <strong>Report</strong> and <strong>My Team</strong> move between the three views of the same work. You only see the views your level can open.</p>
      </Step>

      <Step n={2} title="Read a row">
        <p className="m-0">From left to right: the eye opens the item in Monday, and the clock opens its history, asked of Monday as you click, so it is always current. Then <strong>Item</strong>, <strong>Language</strong> and <strong>Parent item</strong> (for a page in one language, the name of the page it belongs to), <strong>Board</strong>, <strong>Workspace</strong>, <strong>Assignee</strong>, <strong>Priority</strong> (the board&apos;s: high, medium or low), <strong>Step</strong> and <strong>Status</strong>, in Monday&apos;s own words and colours.</p>
        <p className="m-0"><strong>Due</strong> is the deadline, and <strong>Time</strong> says how far off it is: <strong>Late</strong> with how long ago, <strong>Due today</strong>, or <strong>Upcoming</strong> with how long to go. <strong>Check date</strong> means the date in Monday looks wrong (a year like 0202): fix it on the board.</p>
      </Step>

      <Step n={3} title="On-going and Completed" picture={<Picture caption="Completed opened under On-going." height={560}><MyWorkPicture completed /></Picture>}>
        <p className="m-0"><strong>On-going</strong> holds the steps still open. <strong>Completed</strong> holds the finished ones, where the item changed in Monday in the last 6 months. Click a block&apos;s title to open or close it.</p>
        <p className="m-0">To see every finished step, ever, turn on the switch <strong>Finished work: 6 months</strong>; it then reads <strong>Finished work: all of it</strong>.</p>
      </Step>

      <Step n={4} title="Know why the list is in this order" picture={<Picture caption="The list following the Writers team's priority order." height={640}><MyWorkPicture ordered /></Picture>}>
        <p className="m-0">On-going is in True North&apos;s order: the board&apos;s priority first, then the soonest deadline. Late work sits at the top of its priority.</p>
        <p className="m-0">When a leader of your team has set a priority order, a line above the list says so, for example <strong>Ordered by the Writers team&apos;s priority</strong>, with who set it and when. The <strong>Team</strong> column then shows each step&apos;s place in the whole team&apos;s list, with True North&apos;s place under it. A pin means the leader placed that step by hand; a compass means it follows True North&apos;s order. The list is cut into bands where that changes, and the map at the top of On-going jumps to each one.</p>
        <p className="m-0">If you are on more than one team, pick whose order the list follows in that line.</p>
      </Step>

      <Step n={5} title="Find and narrow">
        <p className="m-0">Type in <strong>Search items, boards, people…</strong> to find any word on the page, a date or a word like late included. The filters beside it narrow what is shown: <strong>Any status</strong>, <strong>Any board</strong>, <strong>Any due date</strong> (Late, Due today, Due in the next 7 days, and more) and <strong>Any last change</strong>. A chosen filter turns teal, and <strong>Clear filters</strong> says how many rows it is hiding.</p>
        <p className="m-0">Click a column heading to sort by it; click again to reverse, and a third time to go back to the list&apos;s order. <strong>Columns</strong> hides the columns you do not need; this browser remembers the choice.</p>
        <p className="m-0"><strong>Mine</strong> is your own list. If your level may see everyone&apos;s list, <strong>Everyone</strong> shows all the work, with a person and a team to narrow it, and an <strong>Unknown user</strong> block for work on Monday accounts nobody in the Directory is linked to.</p>
      </Step>

      <Step n={6} title="What updates, and when">
        <p className="m-0">The portal reads Monday every 4 hours. The line under the controls, <strong>Work pulled from Monday at</strong>, gives the times and when it last ran. My Work only shows: to change a status, a date or who does a step, change it in Monday (the eye takes you there). The change shows here after the next pull.</p>
      </Step>

      <Step n={7} title="Set your team's priority (team leaders)" picture={<Picture caption="Team priority, as the Writers team's lead sees it." height={620}><TeamPriorityPicture /></Picture>}>
        <p className="m-0">If you lead a team, or an admin gave you the right, a <strong>Team priority</strong> button sits beside Mine and Everyone. It opens the team&apos;s open steps in order.</p>
        <p className="m-0">Move a step by dragging its grip, with the arrows, or by clicking its place number and typing a new one. A step you move is placed by hand and keeps its place. <strong>Order by</strong> switches between <strong>Workspace</strong>, <strong>Board</strong> and <strong>Item</strong>, to order whole workspaces and boards first. It saves as you go; <strong>Save and close</strong> takes you back to the list. Everyone on the team then sees their list in that order.</p>
      </Step>

      <Tip title="Something missing from your list?">My Work lists the steps where you are in a people column in Monday. If a step is not there, check in Monday that you are assigned on that item, then wait for the next pull.</Tip>

      <p className="m-0 text-[14.5px] text-foreground">Next: <Link href="/manual/guides/report" className={MORE}>Report</Link> and <Link href="/manual/guides/my-team" className={MORE}>My Team</Link>.</p>
    </div>
  )
}

export function ReportGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideHeader eyebrow="Your work" title="Report" minutes={5}>
        The Report says what got delivered, how long work stayed with each person, and what came in late. It reads the same Monday work as My Work, plus a record of every change on each step and the hours from the timeclock.
      </GuideHeader>

      <Step n={1} title="Open the Report" picture={<Picture caption="The switch at the top right of My Work, Report and My Team."><WorkViewSwitchPicture active="report" /></Picture>}>
        <p className="m-0">Click the briefcase icon on the left rail, then <strong>Report</strong>, or click <strong>Report</strong> in the switch at the top right of My Work.</p>
        <p className="m-0">Who opens it, and which of its tabs, is set on Admin, Access levels. Out of the box, Admins and Super Admins have it.</p>
      </Step>

      <Step n={2} title="Choose whose work and how long" picture={<Picture caption="The tabs, Whose work, the period and the export buttons."><ReportBarPicture /></Picture>}>
        <p className="m-0"><strong>Me</strong> is your own work. <strong>My team</strong> is the teams you lead, if you lead one. <strong>Everyone</strong> is the whole company, for whoever may see everyone. You only see the choices you have.</p>
        <p className="m-0">Then pick <strong>Last 30 days</strong> or <strong>Last 90 days</strong>. The address keeps the tab, whose work and the period, so a link you send opens the same view for the person who clicks it (as far as their own access allows).</p>
      </Step>

      <Step n={3} title="Overview" picture={<Picture caption="The Overview tab." height={640}><ReportPicture tab="overview" /></Picture>}>
        <p className="m-0">Five numbers first: <strong>Delivered</strong>, <strong>On time</strong> and <strong>Median held</strong> are about the period; <strong>Open now</strong> and <strong>Late now</strong> are Monday as it is today. Below them, <strong>Delivered per week</strong> (on time in teal, late in orange), <strong>Open work, by age</strong>, and <strong>How long work stays with each person</strong>.</p>
      </Step>

      <Step n={4} title="People" picture={<Picture caption="The People tab." height={420}><ReportPicture tab="people" /></Picture>}>
        <p className="m-0">One row per person: delivered, on-time share, median held, open, late now, and hours from the timeclock (blank for someone not on it). Click a row to open that person&apos;s detail on the right: what they delivered in the period and their hours by project.</p>
      </Step>

      <Step n={5} title="Workload" picture={<Picture caption="The Workload tab." height={520}><ReportPicture tab="workload" /></Picture>}>
        <p className="m-0">Three readings on their own clocks, none of them a score: <strong>Utilisation</strong> (hours logged against hours contracted, last 13 weeks), <strong>Load, next 30 days</strong> (estimated hours of work due against the hours the person has) and <strong>Backlog, 8 weeks</strong> (steps arriving against steps finished). <strong>Reading</strong> sums it up: Overloaded, Waiting, At capacity, Spare or Steady. Pick a team or a person in <strong>All teams</strong> and <strong>Anyone</strong> to narrow it.</p>
      </Step>

      <Step n={6} title="Where it waits" picture={<Picture caption="The Where it waits tab." height={560}><ReportPicture tab="waits" /></Picture>}>
        <p className="m-0">The same held time, grouped by step (Write, Review, Approve) and by board instead of by person, so a slow month can be traced to a stage. <strong>Sitting longest right now</strong> lists the open steps that have waited longest, and with whom.</p>
      </Step>

      <Step n={7} title="Method" picture={<Picture caption="The Method tab." height={480}><ReportPicture tab="method" /></Picture>}>
        <p className="m-0">Where every number comes from and how often it refreshes, the rules it follows (held time is working days, Monday to Friday without the company holidays; late means finished after the due date in New York), and <strong>Who sees what</strong>, with your own reach marked.</p>
      </Step>

      <Step n={8} title="Export">
        <p className="m-0">If your level may export, <strong>CSV</strong> downloads the tab you are on. <strong>PDF</strong> asks <strong>Landscape</strong> or <strong>Portrait</strong>, then <strong>Build the PDF</strong> shows it in a window first, with the download there. Both hold this tab, this scope and this period.</p>
      </Step>

      <Tip title="A number looks low?">Delivery, on time and held time count from the day the change log began, which the line beside the period gives (change log since...). Steps finished before then are not counted. Open now and Late now are always current.</Tip>
    </div>
  )
}

export function MyTeamGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideHeader eyebrow="Your work" title="My Team" minutes={3}>
        My Team is the people on your teams, and for team leaders and admins, each team as a card with its members and the tools it can reach.
      </GuideHeader>

      <Step n={1} title="Open My Team" picture={<Picture caption="My Team on People, as the Writers team's lead sees it." height={520}><MyTeamPicture /></Picture>}>
        <p className="m-0">Click the briefcase icon on the left rail, then <strong>My Team</strong>, or click <strong>My Team</strong> at the top right of My Work.</p>
        <p className="m-0">Everyone on any of your teams is listed, you included, with their level, title, team and whether they are <strong>Active</strong>. Type in <strong>Search people…</strong> to find someone by name, title or team.</p>
      </Step>

      <Step n={2} title="Open someone's page">
        <p className="m-0">A row with an arrow opens that person&apos;s page. Your own row always does. As a team leader, the people of the teams you lead open too; the others show their name, level and team only. Which part of a page you then see depends on your level: see the person page for the details.</p>
      </Step>

      <Step n={3} title="See your teams (team leaders and admins)" picture={<Picture caption="The Teams tab: one card for each of your teams." height={520}><MyTeamPicture tab="teams" /></Picture>}>
        <p className="m-0">Click <strong>Teams</strong>, next to People. Each of your teams is a card in its colour: who is on it, each as <strong>Lead</strong> or <strong>Member</strong>, and under <strong>Tool access</strong> the tools the team can open, for the <strong>Whole team</strong> or the <strong>Lead only</strong>.</p>
        <p className="m-0">Tool access is set on Admin, Access levels; a team with none says <strong>No tools granted to this team.</strong></p>
      </Step>

      <Tip title="Someone is on the wrong team?">Teams and who leads them are kept in the Directory. Ask an admin to change it there; My Team follows.</Tip>
    </div>
  )
}
