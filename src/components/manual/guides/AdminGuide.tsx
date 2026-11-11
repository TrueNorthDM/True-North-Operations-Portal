// The Admin guides (owner, 4 November 2026): Company settings, Access levels
// and View Stage, Notification rules, and Monday accounts with Automations.
// For Admins and Super Admins. Written from the built screens (admin/**,
// notifications, components/settings, components/access); the pictures are
// those screens with made-up data.

import Link from 'next/link'
import { GuideHeader, Picture, Step, Tip } from '../GuideParts'
import {
  AccessLevelsPicture, CompanySettingsPicture, HrSettingsPicture, IntegrationsPicture,
  MondayAccountsPicture, NotificationRulesPicture, WorklistSourcesPicture,
} from './AdminPictures'

const P = 'm-0'
const LIST = 'm-0 pl-5 flex flex-col gap-1.5 list-disc'

export function CompanySettingsGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideHeader eyebrow="Admin" title="Company settings" minutes={7}>
        The settings the whole portal runs on: the Monday and QuickBooks Time connections, clients and budgets, publishing goals, the Google links, and the yearly review. Admins open it and read most of it; Super Admins change it.
      </GuideHeader>

      <Step n={1} title="Open Company settings" picture={<Picture caption="Company settings, with Human Resources open." height={620}><CompanySettingsPicture /></Picture>}>
        <p className={P}>Open <strong>Admin</strong> on the left rail, then the <strong>Company settings</strong> card. The sections are listed A to Z on the left; click one to open it on the right. Each section has its own address, so you can bookmark it or send the link.</p>
        <p className={P}>You only see the sections your level opens. By default, Admins see every section except <strong>APIs &amp; tokens</strong>, which is for Super Admins only. A Super Admin can change who sees what on <Link href="/manual/guides/access-levels" className="font-bold text-tn-teal">Access levels</Link>.</p>
      </Step>

      <Step n={2} title="What each section is for">
        <ul className={LIST}>
          <li><strong>APIs &amp; tokens</strong> (Super Admins only): the Monday API token, the address Monday posts to, and the QuickBooks Time (TSheets) token. Only the last four characters of a token are ever shown.</li>
          <li><strong>Clients &amp; budgets</strong>: the dollar budget and budget period of each client, any approved Extra, and the month&apos;s Highlights note printed on the client PDF. It feeds the Clients Reports.</li>
          <li><strong>Clients, Projects &amp; Job Codes</strong>: each client, its projects and their job codes, read live from QuickBooks Time, with who is assigned and the average billing rate.</li>
          <li><strong>Human Resources</strong>: the yearly performance review. See step 3.</li>
          <li><strong>Integrations</strong>: Google Calendar and Google Drive. See step 4.</li>
          <li><strong>Invoices</strong> (North Time): how invoices and reimbursement documents are numbered, and the billing details.</li>
          <li><strong>Job catalogue</strong> (North Time): the jobs people pick in North Time, their fields and the clients.</li>
          <li><strong>My Work sources</strong>: which Monday workspaces, boards and people may appear on My Work. See step 5.</li>
          <li><strong>North Time rollout</strong> (North Time): who starts on North Time when, and the switch that opens it.</li>
          <li><strong>Publishing targets</strong>: the pace goal for each site and language, per week or per two-week cycle. They drive the Publishing Goals dashboard.</li>
          <li><strong>Reminders</strong> (North Time): which timesheet reminders the bell sends.</li>
          <li><strong>Sites &amp; languages</strong>: the publishing languages of each site. Pausing a language hides it from dashboards and reports without deleting its history.</li>
          <li><strong>Timesheet periods</strong> (North Time): the pay periods and who submits how.</li>
        </ul>
        <p className={P}>The North Time sections are being redefined, so this guide does not explain their rules yet. Admins read them; Super Admins change them.</p>
      </Step>

      <Step n={3} title="Human Resources: the yearly review" picture={<Picture caption="Human Resources: roles, who takes part, two reviewers, dates, Drive and last year's reviews."><HrSettingsPicture /></Picture>}>
        <p className={P}>Everything the annual review needs before it starts:</p>
        <ul className={LIST}>
          <li><strong>Roles</strong>: pick the <strong>VP of Operations</strong>, the <strong>CISO</strong> and <strong>HR</strong> from the list. The VP of Operations starts the reviews and adds their own priorities; the CISO writes the Company Priorities; HR sees every review and is told when one is approved. Only a Super Admin picks the roles.</li>
          <li><strong>Who takes part</strong>: every employee in the Directory has a review. Use <strong>Add a person</strong> to include someone else, like a contractor, and <strong>Remove</strong> to take them out.</li>
          <li><strong>Two reviewers</strong>: who is reviewed by two people, by the rule (someone who leads their own team and also works in another) or set by hand. A Super Admin can <strong>Remove</strong> one, <strong>Add a second reviewer</strong> with the team they review for, or go <strong>Back to the rule</strong>.</li>
          <li><strong>Dates</strong>: read only here. Every date comes from the day the VP of Operations starts the reviews in Human Resources, Reviews, and is moved there.</li>
          <li><strong>Google Drive</strong>: click <strong>Pick the folder</strong> to choose where approved review PDFs go. They are copied there, inside a folder for the year, through the office@ Google account.</li>
          <li><strong>Last year&apos;s reviews</strong>: click <strong>Import last year&apos;s reviews</strong> and pick the files in Drive. Each file is matched to a person by its name; check the ones marked <strong>Check</strong> or <strong>No match</strong>, pick the right person, then click the <strong>Import</strong> button (it shows how many files are ready). Once imported, <strong>Check</strong> on a row shows the goals read from the file so you can fix them.</li>
        </ul>
        <p className={P}>Admins read this section. Super Admins change it, and so can the person picked as HR (everything but the roles).</p>
      </Step>

      <Step n={4} title="Integrations: Google" picture={<Picture caption="Integrations, as a Super Admin sees it." height={900}><IntegrationsPicture /></Picture>}>
        <ul className={LIST}>
          <li><strong>The new Agenda</strong>: the switch at the top opens or closes the new Agenda (event drawer, Find a time, Agenda settings, booking links) for everyone. It asks before it changes anything.</li>
          <li><strong>Team calendar (Google)</strong>: the office@ Google account, connected by a Super Admin in Agenda settings (the <strong>Agenda settings</strong> button takes you there). Approved time off and team events are written to its calendar.</li>
          <li><strong>Google sign-in</strong>: the portal&apos;s own Google app, which lets people connect their Google accounts in Agenda settings. <strong>Change keys</strong> replaces its keys.</li>
          <li><strong>Google Drive</strong>: the folder where the portal writes invoices and receipts. <strong>Pick the folder</strong> (or <strong>Change folder</strong>), <strong>Write a test file</strong>, and under <strong>How the copies are doing</strong>, <strong>Copy the missing now</strong>.</li>
        </ul>
        <p className={P}>When something could not be sent, it is listed under <strong>Errors</strong> on its card with <strong>Try again</strong>. Admins see this section read only; only Super Admins connect, replace keys, flip the switch or try again.</p>
      </Step>

      <Step n={5} title="Monday: the token and what My Work reads">
        <p className={P}>Monday comes into the portal in two places here. In <strong>APIs &amp; tokens</strong>, a Super Admin saves the Monday API token: it reads the boards for My Work, the Report, Publishing Goals and Href Links. Replacing or removing it asks first, because it breaks the connection until a working token is saved.</p>
        <p className={P}>In <strong>My Work sources</strong>, you choose what My Work may show. See <Link href="/manual/guides/monday-and-automations" className="font-bold text-tn-teal">Monday accounts and Automations</Link> for this and for linking Monday accounts to people.</p>
      </Step>

      <Tip title="A section is missing?">Your level does not open it. A Super Admin can tick it for Admins on Access levels, or add an exception for you alone.</Tip>
    </div>
  )
}

export function AccessLevelsGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideHeader eyebrow="Admin" title="Access levels and View Stage" minutes={7}>
        Who can open what, in one place: four levels, one list of every module, page, tool, tab and action, and for tools, which teams may use them. Access levels and View Stage are for Super Admins only.
      </GuideHeader>

      <Step n={1} title="The four levels">
        <ul className={LIST}>
          <li><strong>Super Admin</strong>: everything, always, including Access levels. There are always at least two.</li>
          <li><strong>Admin</strong>: given by a Super Admin. Opens what the Admin column has ticked.</li>
          <li><strong>Team Leader</strong>: automatic, for anyone who is Lead of at least one team on the Directory&apos;s Teams tab.</li>
          <li><strong>User</strong>: automatic, everyone else.</li>
        </ul>
        <p className={P}>Open <strong>Admin</strong>, then <strong>Access levels</strong>. The page has five tabs: <strong>Permissions</strong>, <strong>People and levels</strong>, <strong>Check a person</strong>, <strong>Exceptions</strong> and <strong>Change log</strong>.</p>
      </Step>

      <Step n={2} title="Tick what each level opens" picture={<Picture caption="Permissions: a tick per level, and the teams for each tool." height={640}><AccessLevelsPicture tab="permissions" /></Picture>}>
        <p className={P}>On <strong>Permissions</strong>, each row is a page, tool, tab or action, grouped by module. Someone opens an item when their level has it ticked, the page or tool above it is open to them too, and for tools, one of their teams is on its list.</p>
        <ol className="m-0 pl-5 flex flex-col gap-1.5 list-decimal">
          <li>Click <strong>Edit</strong>. Use the search box, or <strong>Expand all</strong>, to find the row.</li>
          <li>Click the circle in a level&apos;s column to tick or untick it. With <strong>Apply to everything inside</strong> on, a page or tool takes its tabs and actions with it.</li>
          <li>For a tool, click the button in its <strong>Teams</strong> column (it reads, for example, 2 teams have access), then <strong>Edit the list</strong>: <strong>Every team</strong>, or <strong>Only these teams</strong> with <strong>Leads only</strong> or <strong>Whole team</strong> for each. Click <strong>Apply</strong>.</li>
        </ol>
        <p className={P}>Nothing changes for anyone yet: each change is outlined and counted in a bar at the bottom of the screen.</p>
      </Step>

      <Step n={3} title="Review and save, with a reason">
        <p className={P}>Click <strong>Review and save</strong> in the bar. You see the changes, who will <strong>Gain access</strong> and who will <strong>Lose access</strong>. Write why in the box (it is required and kept in the change log), then click <strong>Save changes</strong>. The other Super Admins get a notification.</p>
        <p className={P}><strong>Discard</strong> drops every unsaved change. If you try to leave the page with unsaved changes, the portal asks first.</p>
      </Step>

      <Step n={4} title="Give or take Admin and Super Admin" picture={<Picture caption="People and levels." height={560}><AccessLevelsPicture tab="people" /></Picture>}>
        <p className={P}>On <strong>People and levels</strong>, each level has its card. Click <strong>+ Add</strong> on Super Admin or Admin, or <strong>Change</strong> next to a name, choose the level (or <strong>Automatic</strong> to go back to Team Leader or User), see what they gain and lose, write why, and click <strong>Save the level</strong>.</p>
        <p className={P}>Team Leader and User follow team positions: change them on the Directory&apos;s Teams tab.</p>
      </Step>

      <Step n={5} title="Check a person" picture={<Picture caption="Check a person: what Sam Patel opens, and why." height={560}><AccessLevelsPicture tab="why" who="p-sam" /></Picture>}>
        <p className={P}>On <strong>Check a person</strong>, pick someone under <strong>Whose access?</strong>. You see every page, tool, tab and action, open or not, with the rule that decided it. <strong>See their portal</strong> shows their navigation and pages from these rules.</p>
      </Step>

      <Step n={6} title="An exception for one person" picture={<Picture caption="Exceptions: Sam Patel may open the Report until the end of the month."><AccessLevelsPicture tab="exceptions" /></Picture>}>
        <p className={P}>For one person and one item, for a while, without changing their level or teams. On <strong>Exceptions</strong>, click <strong>+ Add an exception</strong>, pick the person and the item, <strong>Can open</strong> or <strong>Cannot open</strong>, and until when (<strong>1 week</strong>, <strong>End of the month</strong>, <strong>Until removed</strong> or a date). Write why and click <strong>Add exception</strong>.</p>
        <p className={P}>An exception ends on its date by itself. To end it sooner, click <strong>End now</strong>, say why and click <strong>End it</strong>.</p>
      </Step>

      <Step n={7} title="The change log" picture={<Picture caption="The change log, every change with its reason." height={520}><AccessLevelsPicture tab="log" /></Picture>}>
        <p className={P}>Every change, with who made it, when, why and who gained or lost access. Filter by kind at the top. <strong>Undo</strong> puts back what was there before, for everyone it touched; it asks why and is added as a new entry, so nothing is erased.</p>
      </Step>

      <Step n={8} title="See the portal as another level: View Stage">
        <p className={P}>Open <strong>Admin</strong>, then <strong>View Stage</strong>. You see four columns side by side, <strong>Super Admin</strong>, <strong>Admin</strong>, <strong>Team Leader</strong> and <strong>User</strong>, each showing the real portal as a real person of that level sees it (their name is under the level). The Super Admin column is your own session.</p>
        <ul className={LIST}>
          <li>Click and use the pages inside a column as that person would. Nothing is saved from inside a preview.</li>
          <li>Change a column&apos;s level with the list in its header; the square button opens it full screen (Esc to leave).</li>
          <li>Drag the background to move, scroll to zoom, or use <strong>−</strong>, <strong>+</strong> and <strong>Fit</strong>. <strong>Refresh</strong> reloads every column, for example after you change someone&apos;s level.</li>
        </ul>
        <p className={P}>The badge at the top says where the preview cannot be trusted. Today that is North Time, which shows your own hours under My rather than the previewed person&apos;s.</p>
        <p className={P}>View Stage needs the live portal, so this guide has no picture of it. On Access levels, the eye in a level&apos;s column header shows a quick preview from the ticks on the page, unsaved ones included.</p>
      </Step>

      <Tip title="Saved but nothing changed for them?">Check a person shows the rule that decided each item. For a tool, the most common reason is that none of their teams is on its list.</Tip>
    </div>
  )
}

export function NotificationRulesGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideHeader eyebrow="Admin" title="Notification rules" minutes={3}>
        The rule for everyone each notification reaches: whether it is on, when it arrives, and whether people may change either. Each person&apos;s own choices are in their Settings, under Notifications.
      </GuideHeader>

      <Step n={1} title="Open Notification rules" picture={<Picture caption="Notification rules, with one choice fixed for everyone." height={620}><NotificationRulesPicture /></Picture>}>
        <p className={P}>Open <strong>Admin</strong>, then <strong>Notification rules</strong>. Admins and Super Admins can open it. Every notification is listed, Tools first, then System. The ones the portal cannot send yet are faded, marked <strong>not built yet</strong>.</p>
      </Step>

      <Step n={2} title="Set the default">
        <p className={P}>For each notification, <strong>Default on</strong> turns it on or off for everyone, and <strong>Default when</strong> picks <strong>As it happens</strong> (in the bell right away) or <strong>Daily summary</strong> (the bell at the person&apos;s summary hour and the summary email). A notification that only makes sense one way shows that way, fixed. Each change saves by itself.</p>
      </Step>

      <Step n={3} title="Fix it for everyone, or let people choose">
        <p className={P}>Click the lock next to a setting. Gold means <strong>fixed</strong>: people see your value, locked, and cannot change it. Open means people may change it; those who never did follow your default.</p>
      </Step>

      <Step n={4} title="Read the Turned off by column">
        <p className={P}>How many of the people a notification reaches switched it off. A high share, shown in amber, can mean it is noisy or not useful.</p>
      </Step>

      <Tip title="Your own notifications?">They are in your Settings, under Notifications, not here. There you also see how each one looks and can send yourself a test.</Tip>
    </div>
  )
}

export function MondayAndAutomationsGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideHeader eyebrow="Admin" title="Monday accounts and Automations" minutes={5}>
        My Work, the Report and the team filters read Monday. These pages make sure each Monday account belongs to the right person, that My Work reads the right boards, and that every automatic job is running.
      </GuideHeader>

      <Step n={1} title="Open Monday accounts" picture={<Picture caption="Monday accounts, most work first." height={640}><MondayAccountsPicture /></Picture>}>
        <p className={P}>Open <strong>Admin</strong>, then <strong>Monday accounts</strong>. Every assignment in My Work carries a Monday account. Until that account is attached to someone in the Directory, their work still shows but falls outside every team filter. Admins and Super Admins can open it.</p>
        <p className={P}>The lists are ordered by how much work rides on each answer. Use <strong>Search accounts</strong> to find one.</p>
      </Step>

      <Step n={2} title="Say who each account is">
        <ul className={LIST}>
          <li><strong>On work, owned by nobody</strong>: the accounts the My Work banner is counting. Pick the person in <strong>Choose a person</strong>, or click <strong>Who is this?</strong> to see their boards, steps and who they worked alongside.</li>
          <li><strong>Waiting on an answer</strong>: when the portal finds a likely match, click <strong>This is</strong> followed by the name. Otherwise pick the person from the list.</li>
          <li><strong>Not ours</strong> marks an account as outside True North (a client or a freelancer): it stops waiting, and its work stays out of every person&apos;s and team&apos;s list. It asks first.</li>
        </ul>
      </Step>

      <Step n={3} title="Fix a mistake">
        <p className={P}>Under <strong>Linked</strong>, each account shows the person and how it was matched. <strong>Unlink</strong> sends it back to waiting. Under <strong>Outside True North</strong>, <strong>Undo</strong> does the same for an account marked Not ours.</p>
      </Step>

      <Step n={4} title="Choose what My Work reads" picture={<Picture caption="Company settings, My Work sources." height={460}><WorklistSourcesPicture /></Picture>}>
        <p className={P}>In <strong>Company settings</strong>, <strong>My Work sources</strong> lists the Monday workspaces and boards, most work first, with when each was last used. <strong>Shown</strong> and <strong>Not shown</strong> switch a board, or a whole workspace, on or off for My Work; <strong>High</strong>, <strong>Medium</strong> and <strong>Low</strong> set its priority. The <strong>People</strong> tab does the same for a person&apos;s Monday work.</p>
        <p className={P}>Switching a board off only changes what My Work shows: it is still read, counted and in the reports. The switch at the top hides boards quiet for months and brings them back when used.</p>
      </Step>

      <Step n={5} title="Check the Automations">
        <p className={P}>Open <strong>Admin</strong>, then <strong>Automations</strong>. Every webhook and scheduled job is a card: what it does, its trigger and schedule, and its health (<strong>Operational</strong>, <strong>Warning</strong>, <strong>Down</strong> or <strong>Not monitored</strong>). The box at the top sums it up, for example <strong>All services operational</strong>, and lists any problem in words.</p>
        <p className={P}>The checks run every 4 hours. Click <strong>Run checks now</strong> to run them at once; they take a few seconds. Admins can open the page and run the checks.</p>
        <p className={P}>This page is drawn by the server from the live checks, so this guide has no picture of it.</p>
      </Step>

      <Tip title="Something shows Down?">Read its line in the box at the top: it says what failed. If it is Monday or QuickBooks Time, a Super Admin checks the token in Company settings, APIs &amp; tokens.</Tip>
    </div>
  )
}
