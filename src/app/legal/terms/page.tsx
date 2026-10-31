// The portal's terms of use (owner, 30 October 2026): public, no login.
// Asked for by Google's review of the portal's Google sign-in.

import type { Metadata } from 'next'
import Link from 'next/link'
import { CONTACT, H2, LegalPage, List } from '@/components/legal/LegalPage'

export const metadata: Metadata = { title: 'Terms of use | True North Operations Portal' }

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use">
      <p className="m-0">
        The True North Operations Portal (&quot;the portal&quot;, at truenorthportal.online) is run by True North Digital Marketing
        (&quot;True North&quot;). By using it you agree to these terms.
      </p>

      <H2>Who may use it</H2>
      <List items={[
        <>Team members and contractors of True North, with the access True North gives them.</>,
        <>Anyone booking a meeting through a public booking page, only to book, confirm or change that meeting.</>,
      ]} />

      <H2>Your account</H2>
      <p className="m-0">
        Keep your sign-in private and tell {CONTACT} if you think someone else used it. Use the portal only for True North work,
        and only see or change what your role allows.
      </p>

      <H2>Connecting a Google account</H2>
      <p className="m-0">
        Connecting a Google account is optional. When you connect one, you allow the portal to create and change the events you
        make in the portal on that calendar, add Google Meet links, and read when you are busy, as described in the{' '}
        <Link href="/legal/privacy" className="text-tn-teal font-bold">privacy policy</Link>. You can disconnect it at any time in Agenda settings.
      </p>

      <H2>What not to do</H2>
      <List items={[
        <>Do not try to reach information or parts of the portal your role does not allow.</>,
        <>Do not use the booking page to send spam or anything unlawful.</>,
        <>Do not try to disrupt, copy or attack the portal.</>,
      ]} />

      <H2>The service</H2>
      <p className="m-0">
        True North may change, pause or end any part of the portal, and may suspend access that breaks these terms. The portal is
        provided as is, and True North is not responsible for indirect losses from using it, as far as the law allows. Work
        agreements between True North and its team members or contractors still govern pay, hours and time off.
      </p>

      <H2>Changes and contact</H2>
      <p className="m-0">
        If these terms change, the new version is posted on this page with a new date. Questions go to <b>{CONTACT}</b>.
      </p>
    </LegalPage>
  )
}
