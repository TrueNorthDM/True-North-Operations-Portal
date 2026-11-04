// The Agenda guides (owner, 4 November 2026): using the Agenda, and its
// settings with Google. Written from the built screens (components/agenda);
// the pictures are those screens with made-up data.

import Link from 'next/link'
import { GuideHeader, Picture, Step, Tip } from '../GuideParts'
import { AgendaPicture, AgendaSettingsPicture } from './AgendaPictures'

export function AgendaGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideHeader eyebrow="Your work" title="Agenda" minutes={4}>
        The Agenda is True North&apos;s calendar, for everyone: who is out, birthdays, work anniversaries, events, client milestones and holidays, in one place.
      </GuideHeader>

      <Step n={1} title="Open the Agenda" picture={<Picture caption="The Agenda in Month view." height={640}><AgendaPicture view="month" /></Picture>}>
        <p className="m-0">Click the calendar icon on the left rail, then <strong>Calendar</strong>. The month opens on today. Next to the calendar, <strong>Coming up</strong> lists the next 14 days.</p>
      </Step>

      <Step n={2} title="Pick how you see it" picture={<Picture caption="The same weeks in Week view." height={560}><AgendaPicture view="week" /></Picture>}>
        <p className="m-0"><strong>Month</strong>, <strong>Week</strong> or <strong>List</strong>, at the top. The arrows move to the next or previous month or week, and <strong>Today</strong> brings you back.</p>
        <p className="m-0">In Week view, the hours outside your working hours are shaded, so you see at a glance when people are available.</p>
      </Step>

      <Step n={3} title="Show only what you need">
        <p className="m-0">Use <strong>Show</strong> to choose what appears: PTO, Birthdays, Anniversaries, Events, Milestones and Holidays. Pick a team to see only its people and its events.</p>
      </Step>

      <Step n={4} title="Open anything for the details">
        <p className="m-0">Click an item to open its card: who, when, where and who it is for. An event with a call has <strong>Join with Google Meet</strong>.</p>
      </Step>

      <Step n={5} title="Create an event">
        <p className="m-0">If your level can create events, <strong>New event</strong> opens a drawer: the title, the day and time, who it is for (everyone or some teams) and whether it also goes on the team Google Calendar. <strong>Find a time</strong> shows when the people you invite are free.</p>
        <p className="m-0">To create events with a Google Meet link and see when people are busy, connect your Google account first: see <Link href="/manual/guides/agenda-settings" className="font-bold text-tn-teal">Agenda settings and Google</Link>.</p>
      </Step>

      <Tip title="Time off shows up by itself.">Once a time off request is approved, it appears in the Agenda and on the team Google Calendar. Everyone sees that the person is out; only they and the Super Admins see the type (vacation, sick).</Tip>
    </div>
  )
}

export function AgendaSettingsGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideHeader eyebrow="Your work" title="Agenda settings and Google" minutes={4}>
        Connect your Google accounts so the portal can create your meetings with a Google Meet link and knows when you are busy. You can connect more than one, so every calendar you use counts in one place.
      </GuideHeader>

      <Step n={1} title="Open Agenda settings">
        <p className="m-0">On the left rail, click the calendar icon, then <strong>Settings</strong>.</p>
      </Step>

      <Step n={2} title="Connect your Google account" picture={<Picture caption="Your Google accounts, with two connected."><AgendaSettingsPicture only={['accounts']} /></Picture>}>
        <p className="m-0">In <strong>Your Google accounts</strong>, click <strong>+ Connect a Google account</strong>, sign in with Google and allow the portal. You come back to this page with the account listed as <strong>Connected</strong>.</p>
        <p className="m-0">Until Google finishes reviewing the portal, Google may show a warning first: click <strong>Advanced</strong>, then <strong>Go to True North Operations Portal</strong>.</p>
      </Step>

      <Step n={3} title="Add your other calendars">
        <p className="m-0">Click <strong>+ Connect a Google account</strong> again for each other account you use, for example your True North and your GoodNews addresses. Find a time and your booking link read when you are busy on all of them, so one meeting never lands on top of another.</p>
        <p className="m-0">Under <strong>Invitations to you go to</strong>, choose which of them receives the invitations people send you from the portal.</p>
      </Step>

      <Step n={4} title="Set your working hours" picture={<Picture caption="Your working hours." height={520}><AgendaSettingsPicture only={['hours']} /></Picture>}>
        <p className="m-0">Pick the hours you work each day, in your own time zone. <strong>Copy to other days</strong> repeats a day&apos;s hours. Find a time and your booking link only offer times inside them. Click <strong>Save working hours</strong>.</p>
      </Step>

      <Step n={5} title="Share your booking link" picture={<Picture caption="Your booking link." height={560}><AgendaSettingsPicture only={['link']} /></Picture>}>
        <p className="m-0">Send the link to anyone, inside or outside True North. They pick a free time and the meeting is created on your Google account, with a Meet link, and both of you get the invitation. Choose the meeting lengths people can pick, then <strong>Save booking link</strong>.</p>
      </Step>

      <Step n={6} title="The team calendar" picture={<Picture caption="The team calendar, as everyone but a Super Admin sees it."><AgendaSettingsPicture only={['team']} /></Picture>}>
        <p className="m-0">The True North calendar the whole team sees. A Super Admin connects it once. Approved time off goes there by itself, and events you send from the New event drawer go there too.</p>
      </Step>

      <Tip title="An account says Needs reconnect?">Google asked to sign in again. Click <strong>Reconnect</strong> next to it and sign in with that account.</Tip>
    </div>
  )
}
