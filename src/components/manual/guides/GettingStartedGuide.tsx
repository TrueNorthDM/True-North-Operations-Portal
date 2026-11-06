// The Getting started guides (owner, 4 November 2026): getting around the
// portal, Home, a finder for common tasks, and your profile and settings.
// Written from the built screens (Sidebar, the top bar in app/(app)/layout.tsx,
// components/home, components/settings/PersonalSettings); the pictures are
// those screens with made-up data.

import Link from 'next/link'
import { GuideHeader, Picture, Step, Tip } from '../GuideParts'
import {
  AvatarMenuPicture, BellPicture, DayBannerPicture, HomePicture, HomeRightPicture, NeedsYouPicture, ProfilePicture,
  PublishingPicture, RailPicture, SettingsPicture,
} from './GettingStartedPictures'

const LINK = 'font-bold text-tn-teal'

export function GettingAroundGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideHeader eyebrow="Getting started" title="Getting around" minutes={4}>
        Every screen of the portal has the same frame: the navy rail on the left, the top bar across the top, and the page in the middle. Learn these once and you can reach anything.
      </GuideHeader>

      <Step n={1} title="Use the rail on the left" picture={<Picture caption="The rail as a Team Leader sees it, on Home."><RailPicture /></Picture>}>
        <p className="m-0">Each icon is a place. Point at one to see its name. From the top: <strong>Home</strong>, <strong>Agenda</strong>, <strong>My Work</strong>, <strong>North Time</strong> and <strong>Requests</strong> (the day&apos;s work), then <strong>Chat</strong>, <strong>Emails</strong> and the <strong>System manual</strong>, then <strong>Tools</strong> and <strong>People</strong>, and <strong>Admin</strong> for Admins and Super Admins.</p>
        <p className="m-0">The page you are on has a white icon on a lighter square. A faded icon is a module that is not finished yet: Chat and Emails are coming soon.</p>
        <p className="m-0">You only see what your access level opens, so your rail may have fewer icons than a colleague&apos;s.</p>
      </Step>

      <Step n={2} title="Open a panel" picture={<Picture caption="My Work's panel, open, with 3 late steps."><RailPicture hub="my-work" /></Picture>}>
        <p className="m-0">Most icons open a white panel of pages beside the rail: for example <strong>My Work</strong> holds My Work and My Team (and Report, for Admins and up), and <strong>People</strong> holds the Directory, Human Resources and History. The panel says in one line what the place is for. Click a page to go there.</p>
        <p className="m-0">To close the panel, click the <strong>X</strong>, click anywhere outside it, or press <strong>Escape</strong>. With the keyboard, the up and down arrows move between its pages.</p>
        <p className="m-0">When a place has only one page for you, its icon skips the panel and opens that page straight away.</p>
      </Step>

      <Step n={3} title="Read the counts">
        <p className="m-0">A gold number on a rail icon says how many things in that place need your attention: late steps in My Work, decisions waiting for you in Approvals, invoices to pay. Inside the panel, each page carries its own number. Point at a number to read what it counts. The numbers update each time you move to another page or open a panel.</p>
      </Step>

      <Step n={4} title="Search with Cmd+K">
        <p className="m-0">The magnifying glass in the top bar opens the search. You can also press <strong>Cmd+K</strong> on a Mac, or <strong>Ctrl+K</strong> on Windows, from any page. Type part of a tool, page or person&apos;s name, move with the arrows and press <strong>Enter</strong> to open it.</p>
        <p className="m-0">It offers exactly the pages your rail offers, plus your own Settings. People in the Directory show up too if your level opens the Directory.</p>
      </Step>

      <Step n={5} title="Check your notifications" picture={<Picture caption="The Notifications drawer, on its Tools tab."><BellPicture /></Picture>}>
        <p className="m-0">The bell in the top bar opens <strong>Notifications</strong>, in two tabs: <strong>Tools</strong> (My Work, Publishing Goals, the reports you can reach) and <strong>System</strong> (syncs, health checks and access changes). A number on the bell is how many are unread.</p>
        <p className="m-0">Click a notification to open the page it is about; it is marked read. <strong>Show</strong> switches between <strong>All</strong> and <strong>Unread</strong>, and <strong>Mark all read</strong> clears the tab. <strong>Open notification settings</strong> takes you to your choices (see <Link href="/manual/guides/profile-and-settings" className={LINK}>Your profile &amp; settings</Link>).</p>
        <p className="m-0">The speech bubble beside it opens <strong>Messages</strong>, with a <strong>Chat</strong> and an <strong>Email</strong> tab. They fill up once Chat and Emails are built.</p>
      </Step>

      <Step n={6} title="The clock and Who's working">
        <p className="m-0">Once North Time is open for you, the top bar also has the clock button, to clock in, switch and clock out, and, for Team Leaders and up, <strong>Who&apos;s working</strong>, with how many people are on the clock now. Until then you do not see them.</p>
      </Step>

      <Step n={7} title="Your avatar" picture={<Picture caption="The avatar's menu, open."><AvatarMenuPicture /></Picture>}>
        <p className="m-0">Your initials (or your photo) sit at the foot of the rail. Click them for a menu with your name and email, <strong>My profile</strong>, <strong>My Team</strong>, <strong>Settings</strong> and <strong>Sign out</strong>. Each is explained in <Link href="/manual/guides/profile-and-settings" className={LINK}>Your profile &amp; settings</Link>.</p>
      </Step>

      <Tip title="On a phone?">The rail is hidden to leave room for the page. Your avatar moves to the top right of the top bar, beside the search and the bell, and the search reaches every page the rail would.</Tip>
    </div>
  )
}

export function HomeGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideHeader eyebrow="Getting started" title="Home" minutes={3}>
        Home answers one question: what do I need to do today? Click the True North logo at the top left, or the house on the rail, to come back to it from anywhere.
      </GuideHeader>

      <Step n={1} title="Take in the whole page" picture={<Picture caption="Home, as a Team Leader sees it." height={760}><HomePicture /></Picture>}>
        <p className="m-0">A navy banner across the top, then the cards. On the left, <strong>Needs you</strong>. On the right, the <strong>Agenda</strong> and, if you have the i7 report, the <strong>i7 Budget</strong>. Across the bottom, for Team Leaders and up, <strong>Publishing goals</strong>.</p>
        <p className="m-0">Each card reads on its own. If one cannot be read, it says so in its own place, and the rest of Home still shows.</p>
        <p className="m-0">You choose which cards show, in Settings, <strong>Home and start</strong> (see <Link href="/manual/guides/profile-and-settings" className={LINK}>Your profile &amp; settings</Link>). The day banner with the clock and the annual review card always show.</p>
      </Step>

      <Step n={2} title="Read your day in the banner" picture={<Picture caption="The day banner."><DayBannerPicture /></Picture>}>
        <p className="m-0">The date, a greeting, and one line on how many things need you today and how many of them are late. The track along the bottom is your day, with the line moving with the time, in your own time zone.</p>
        <p className="m-0">The clock part of North Time also lives in this banner, on the right, once North Time is open for you.</p>
      </Step>

      <Step n={3} title="Work through Needs you" picture={<Picture caption="Needs you, with a sync warning and an invitation."><NeedsYouPicture /></Picture>}>
        <p className="m-0">One card, three tabs, each with its count:</p>
        <ul className="m-0 pl-5 flex flex-col gap-1">
          <li><strong>Needs you</strong>: what waits for your decision or your action, and only what you can act on.</li>
          <li><strong>My Work</strong>: your Monday steps due in the next 7 days, or late.</li>
          <li><strong>Requests</strong>: what you asked for, and where it stands.</li>
        </ul>
        <p className="m-0">Each row says when it is due, in red when it is late. Its button (<strong>Open</strong>, <strong>Decide</strong>, <strong>Resend</strong>...) opens a side panel with the details and the same buttons as the page behind it, so you can act without leaving Home. A row you finish there fades with <strong>Done</strong> and is gone the next time Home loads.</p>
      </Step>

      <Step n={4} title="See who is out and what is coming" picture={<Picture caption="The Agenda and the i7 Budget cards."><HomeRightPicture /></Picture>}>
        <p className="m-0">The <strong>Agenda</strong> card lists who is <strong>Out today</strong>, what is on <strong>Today</strong>, and what is <strong>Coming up</strong>: events, birthdays, anniversaries and holidays. <strong>Open Agenda</strong> takes you to the full calendar (see <Link href="/manual/guides/agenda" className={LINK}>Agenda</Link>).</p>
        <p className="m-0">The <strong>i7 Budget</strong> card shows the <strong>Balance left</strong> this month. Click it to open the i7 report. It shows only for people with the i7 report.</p>
      </Step>

      <Step n={5} title="Check the publishing goals" picture={<Picture caption="Publishing goals over the last 5 weeks." height={520}><PublishingPicture /></Picture>}>
        <p className="m-0">For Team Leaders, Admins and Super Admins: every publishing board over the <strong>Last 5 weeks</strong>, language by language, against its targets (the dashed lines). The pills count the weeks on target. Click the card to open the Publishing Goals dashboard.</p>
      </Step>

      <Tip title="Your annual review shows up here too.">While your review is open, a card for it sits at the top of the right column; once a review agreed your goals, a <strong>My goals</strong> card follows the Agenda.</Tip>
    </div>
  )
}

/** Where things are, as the rail and the menus have them today. */
const WHERE: { what: string; where: React.ReactNode }[] = [
  { what: 'My tasks for this week', where: <><b>My Work</b> on the rail, then <b>My Work</b>; or the My Work tab on Home</> },
  { what: 'The people on my teams', where: <><b>My Work</b>, <b>My Team</b>; or the avatar, <b>My Team</b></> },
  { what: 'Delivery, held time and lateness', where: <><b>My Work</b>, <b>Report</b> (Admins and up)</> },
  { what: 'Who is out, events, birthdays, holidays', where: <><b>Agenda</b>, <b>Calendar</b>; or the Agenda card on Home</> },
  { what: 'Connect Google, my working hours, my booking link', where: <><b>Agenda</b>, <b>Settings</b></> },
  { what: 'Decisions waiting for me', where: <>Home, <b>Needs you</b>; or <b>Requests</b>, <b>Approvals</b></> },
  { what: 'Clock in, switch, clock out', where: <>The clock button in the top bar, or the banner on Home, once North Time is open for you</> },
  { what: 'My hours', where: <><b>North Time</b>, <b>Time entries</b></> },
  { what: 'Which job to use', where: <><b>North Time</b>, <b>Which job?</b></> },
  { what: 'Time off, reimbursements, extra hours', where: <><b>Requests</b>, then <b>Time off</b> (US employees), <b>Reimbursements</b> or <b>Extra hours</b></> },
  { what: 'My invoices', where: <><b>North Time</b>, <b>Invoices</b> (contractors)</> },
  { what: 'Publishing goals, Href Links, client reports', where: <><b>Tools</b>, each as your team has it</> },
  { what: 'Anyone in the company', where: <><b>People</b>, <b>Directory</b> (Team Leaders and up); or search with Cmd+K</> },
  { what: 'My own page', where: <>The avatar, <b>My profile</b></> },
  { what: 'My review, my goals, the org chart, anniversaries', where: <><b>People</b>, <b>Human Resources</b></> },
  { what: 'What changed in the portal', where: <><b>People</b>, <b>History</b></> },
  { what: 'My notifications, time zone, two-step sign-in', where: <>The avatar, <b>Settings</b></> },
  { what: 'This manual', where: <>The book icon on the rail, <b>System manual</b></> },
  { what: 'Access levels, View Stage, Monday accounts, Automations', where: <><b>Admin</b> (Admins and Super Admins)</> },
  { what: 'Company settings and notification rules for everyone', where: <><b>Admin</b>, under Configuration</> },
]

export function WhereGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideHeader eyebrow="Getting started" title="Where do I find..." minutes={2}>
        The quick answer for the things people look for most. Not on the list? Press <strong>Cmd+K</strong> (Ctrl+K on Windows) and type what you want.
      </GuideHeader>

      <div className="rounded-[14px] border border-[var(--panel-border)] bg-white overflow-hidden">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-3.5 px-[18px] py-3 bg-subtle border-b border-[var(--row-rule)] font-(family-name:--font-display) font-extrabold text-[10.5px] uppercase tracking-wide text-muted">
          <span>I want</span><span>Go to</span>
        </div>
        {WHERE.map(r => (
          <div key={r.what} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-3.5 px-[18px] py-3 border-b border-[var(--row-rule)] last:border-0 items-start">
            <span className="font-(family-name:--font-display) font-bold text-[13.5px] text-tn-ink">{r.what}</span>
            <span className="text-[13.5px] text-foreground leading-snug [&_b]:font-bold [&_b]:text-tn-ink">{r.where}</span>
          </div>
        ))}
      </div>

      <Tip title="Something on the list is missing for you?">Your access level decides what you see. If you need a page you cannot find, ask a Super Admin.</Tip>
    </div>
  )
}

export function ProfileSettingsGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideHeader eyebrow="Getting started" title="Your profile & settings" minutes={4}>
        Your avatar holds everything that is yours: your page in the Directory, your team, and how the portal works for you.
      </GuideHeader>

      <Step n={1} title="Open the avatar menu" picture={<Picture caption="The avatar's menu."><AvatarMenuPicture /></Picture>}>
        <p className="m-0">Click your initials (or your photo) at the foot of the rail; on a phone, at the top right. The menu shows who is signed in, then:</p>
        <ul className="m-0 pl-5 flex flex-col gap-1">
          <li><strong>My profile</strong>: your own page in the Directory.</li>
          <li><strong>My Team</strong>: the people on your teams.</li>
          <li><strong>Settings</strong>: how the portal works for you.</li>
          <li><strong>Sign out</strong>.</li>
        </ul>
        <p className="m-0">While your week to set up two-step sign-in runs, the menu also has <strong>Two-step sign-in</strong> with the days left, and the avatar a small amber dot.</p>
      </Step>

      <Step n={2} title="Keep your profile up to date" picture={<Picture caption="Your page, on its Personal tab." height={620}><ProfilePicture /></Picture>}>
        <p className="m-0"><strong>My profile</strong> opens the same page everyone else opens for you, cut into tabs by who keeps the information:</p>
        <ul className="m-0 pl-5 flex flex-col gap-1">
          <li><strong>Personal</strong>: you keep it. Click <strong>Edit personal data</strong> to change your phone, address, date of birth and location, then <strong>Save changes</strong>.</li>
          <li><strong>Work</strong>: the company keeps it (title, teams, who you report to). If something is wrong, tell an Admin.</li>
          <li><strong>Reports</strong>: who reports to you.</li>
        </ul>
        <p className="m-0">To change your photo, click the camera on your picture, crop it and click <strong>Save photo</strong>.</p>
      </Step>

      <Step n={3} title="Choose your notifications" picture={<Picture caption="Settings, Notifications." height={560}><SettingsPicture only={['notifications']} /></Picture>}>
        <p className="m-0">Open <strong>Settings</strong> from the avatar menu. The first section lists every notification that can reach you. For each one, switch it <strong>On</strong> or off, and pick <strong>When</strong>: <strong>As it happens</strong> (in the bell right away) or <strong>Daily summary</strong> (one email, Monday to Friday, and in the bell too). <strong>Preview</strong> shows how it looks.</p>
        <p className="m-0">A setting with a lock was fixed by an admin for everyone. A faded row is one the portal cannot send yet. Every change saves on its own.</p>
      </Step>

      <Step n={4} title="Sign-in and security" picture={<Picture caption="Settings, Sign-in and security."><SettingsPicture only={['security']} /></Picture>}>
        <p className="m-0">See the address your sign-in codes go to, set up or move <strong>Two-step sign-in</strong> (a 6-digit code from an app on your phone), and <strong>Sign out on all devices</strong> after using a shared computer.</p>
      </Step>

      <Step n={5} title="Your time zone and start page" picture={<Picture caption="Settings, Time and region."><SettingsPicture only={['time']} /></Picture>}>
        <p className="m-0">Pick <strong>Your time zone</strong> and when the <strong>Daily summary</strong> arrives: the bell and the summary follow it. Until you choose, it is the time where your Directory profile says you live, or New York time when it does not say.</p>
        <p className="m-0">Under <strong>Home and start</strong>, <strong>After you sign in, open</strong> chooses the page you land on (Home or My Work).</p>
        <p className="m-0">Below it, a <strong>Show ... on Home</strong> switch for each card you can have (Needs you, Pay period, Agenda, My goals, i7 budget, Publishing goals) chooses what Home shows you. The day banner with the clock and the annual review card always show.</p>
      </Step>

      <Step n={6} title="Your privacy" picture={<Picture caption="Settings, Privacy."><SettingsPicture only={['privacy']} /></Picture>}>
        <p className="m-0">Choose whether Home and the Agenda show your birthday (the day and month, never the year) and your work anniversary. With the birthday off, nobody gets the birthday bell for you either.</p>
      </Step>

      <Tip title="Seeing someone else's settings?">In a View Stage preview, Settings shows the previewed person&apos;s choices and saves nothing. Close the preview to change your own.</Tip>
    </div>
  )
}
