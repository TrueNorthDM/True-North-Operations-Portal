// The portal's privacy policy (owner, 30 October 2026): public, no login.
// Google's review of the portal's Google sign-in reads this page, so it says
// exactly which Google data the portal reads, why, and the Limited Use terms.

import type { Metadata } from 'next'
import { CONTACT, H2, LegalPage, List } from '@/components/legal/LegalPage'

export const metadata: Metadata = { title: 'Privacy policy | True North Operations Portal' }

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy">
      <p className="m-0">
        The True North Operations Portal (&quot;the portal&quot;, at truenorthportal.online) is the internal work tool of
        True North Digital Marketing (&quot;True North&quot;, &quot;we&quot;). The people who use it are True North&apos;s team
        members and contractors, and the people outside True North who book a meeting with them through a public booking page.
        This page explains what information the portal keeps, how it uses information from Google accounts, and the choices you have.
      </p>

      <H2>Information the portal keeps</H2>
      <List items={[
        <>Work details about team members: name, work email, role, team, hours worked, time off, and the information needed to pay them.</>,
        <>Meetings and events created in the portal: title, time, guests, description, and video link.</>,
        <>For people who book a meeting through a public booking page: the name, email address and note they type in, and the time they pick.</>,
        <>Basic technical records needed to run the service securely, such as sign-in times and error logs.</>,
      ]} />

      <H2>Information from your Google account</H2>
      <p className="m-0">
        A team member can choose to connect a Google account in Agenda settings. True North can also connect its shared team
        calendar account. When an account is connected, the portal asks Google for these permissions, and uses each one only as described:
      </p>
      <List items={[
        <><b>Your email address and basic account identity</b> (openid, userinfo.email): to know which Google account was connected and show it in Agenda settings.</>,
        <><b>Your calendar events</b> (calendar.events): to create, change and delete the events you make in the portal on your Google Calendar, with a Google Meet link, and to show you the events on that calendar inside the portal.</>,
        <><b>When you are free or busy</b> (calendar.freebusy): to find times that suit everyone when you schedule a meeting, and to offer only your free times on your booking page. The portal reads busy times, not what the busy events are.</>,
        <><b>Files the portal creates in Google Drive</b> (drive.file): only for True North&apos;s shared account, to save receipts and invoices the portal produces. The portal cannot see any other file in that Drive.</>,
      ]} />
      <p className="m-0">
        The portal keeps the sign-in tokens Google gives it so it can do these things without asking you to sign in every time.
        They are stored on True North&apos;s own server, are never shown in a browser, and are used only for the actions above.
      </p>

      <H2>Google API Services User Data Policy</H2>
      <p className="m-0">
        The portal&apos;s use and transfer of information received from Google APIs to any other app will adhere to the{' '}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" className="text-tn-teal font-bold" target="_blank" rel="noreferrer">Google API Services User Data Policy</a>,
        including the Limited Use requirements. In particular:
      </p>
      <List items={[
        <>Google data is used only to provide and improve the scheduling features you see in the portal.</>,
        <>Google data is not sold, not used for advertising, and not used to build profiles of anyone.</>,
        <>Google data is not shared with anyone, except as needed to provide those features, to comply with the law, or with your consent.</>,
        <>No person at True North reads your Google data, unless you ask us to for support, it is needed for security, or the law requires it.</>,
        <>Google data is not used to train artificial intelligence or machine learning models.</>,
      ]} />

      <H2>Who we share information with</H2>
      <p className="m-0">
        We do not sell personal information. The portal runs on a server True North rents, and uses a small number of services
        to work: Google (calendars, Meet and Drive, for connected accounts), an email service to send confirmations and notices,
        and the payroll and HR tools True North already uses. Each receives only what that task needs.
      </p>

      <H2>How long we keep it, and deleting it</H2>
      <List items={[
        <>You can disconnect a Google account at any time in Agenda settings. The portal then deletes its tokens for that account and asks Google to cancel its access. You can also remove the portal from your Google account at myaccount.google.com/permissions.</>,
        <>Busy times read from Google are kept only as long as needed to show schedules, and are refreshed or removed as the calendar changes.</>,
        <>Work records (hours, time off, invoices) are kept as long as the law and True North&apos;s accounting require.</>,
        <>To ask for a copy of your information, or for it to be corrected or deleted, write to {CONTACT}.</>,
      ]} />

      <H2>Security</H2>
      <p className="m-0">
        Information travels encrypted (HTTPS). Access inside the portal depends on each person&apos;s role, and sign-in can require a second step.
        Sign-in tokens and keys are kept on the server only.
      </p>

      <H2>Changes and contact</H2>
      <p className="m-0">
        If this policy changes, the new version is posted on this page with a new date. Questions about privacy go to True North
        Digital Marketing at <b>{CONTACT}</b>.
      </p>
    </LegalPage>
  )
}
