// Design check: two-step sign-in (plan step p4-2fa, 28 September 2026), the real
// screens with nothing behind them. ?screen=enroll (first sign-in: set up the
// app), challenge (every sign-in after that), directory (the admin's Reset) or
// invite (Portal access in the Directory card, each state) or list (the
// Directory's Portal access tab, with made-up people), enroll-new (the setup a
// new person meets, with its Skip), banner (the reminder alone) or profile (My
// profile's Sign-in & security, set up and not). The reminder and the menu row
// on the real shell are in design-check/rail (?page=home&twoStep=6&open=menu).
// The QR code here is a stand-in drawn locally; the real one comes from Supabase.
// Development only.

import { notFound } from 'next/navigation'
import { AuthShell } from '@/components/AuthShell'
import { TwoStepEnroll } from '@/components/mfa/TwoStepEnroll'
import { TwoStepChallenge } from '@/components/mfa/TwoStepChallenge'
import { TwoStepControl } from '@/components/admin/TwoStepControl'
import { PILL_CLASS, type PersonView } from '@/lib/directory/people-types'
import { PortalAccessControl } from '@/components/admin/PortalAccessControl'
import { PortalAccessTab } from '@/components/admin/PortalAccessTab'
import { TwoStepSelf } from '@/components/mfa/TwoStepSelf'
import { TwoStepBanner } from '@/components/mfa/TwoStepBanner'

export const dynamic = 'force-dynamic'

// A fixed "now" for the fixtures: Date.now() in render is impure (lint
// react-hooks/purity) and made the screen differ from one load to the next.
const NOW = Date.parse('2026-10-10T12:00:00Z')
const days = (n: number) => new Date(NOW - n * 86_400_000).toISOString()

/** A QR-looking stand-in: the three finder squares and a fixed scatter of modules. */
function mockQr(): string {
  const n = 25
  const cells: string[] = []
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const finder = (x: number, y: number) =>
    `<rect x="${x}" y="${y}" width="7" height="7" fill="#012358"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#fff"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" fill="#012358"/>`
  const inFinder = (x: number, y: number) => (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9)
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (!inFinder(x, y) && rnd() > 0.52) cells.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="#012358"/>`)
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/>${cells.join('')}${finder(0, 0)}${finder(n - 7, 0)}${finder(0, n - 7)}</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export default async function TwoStepCheck({ searchParams }: { searchParams: Promise<{ screen?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { screen = 'enroll' } = await searchParams

  if (screen === 'challenge') {
    return <AuthShell><TwoStepChallenge email="ana@goodnewsadvocates.org" verify={null} signOut={null} /></AuthShell>
  }

  if (screen === 'list') {
    const mk = (name: string, title: string, color: string, over: Partial<PersonView>) => ({
      id: name, full_name: name, title, color, status: 'active', accountId: null, portalInvitedAt: null, lastAccessAt: null,
      emails: { trueNorth: null, goodnews: `${name.split(' ')[0].toLowerCase()}@goodnewsadvocates.org`, coe: null },
      ...over,
    }) as unknown as PersonView
    const people = [
      mk('Tina Gennette', 'Operations Director', '#1E7D7F', { accountId: 'a', portalInvitedAt: days(20), lastAccessAt: days(0) }),
      mk('Kevin Ames', 'Team Leader', '#012358', { accountId: 'b', portalInvitedAt: days(20), lastAccessAt: days(3) }),
      mk('Alyssa Sommerville', 'Writer', '#D38B35', { portalInvitedAt: days(0) }),
      mk('Joy Deche', 'Editor', '#7A5AF8', { accountId: 'c', portalInvitedAt: days(20), lastAccessAt: days(12) }),
      mk('Ana Silva', 'Translator', '#D38B35', {}),
      mk('Bruno Costa', 'Designer', '#1E9E6A', {}),
      mk('Devon Smith', 'Developer', '#012358', { emails: { trueNorth: 'devon@truenorthdigitalmarketing.com', goodnews: null, coe: null } }),
      mk('Stephanie Aguirre', 'Writer', '#D38B35', { accountId: 'd', portalInvitedAt: days(20), lastAccessAt: days(1) }),
    ]
    return (
      <div className="min-h-screen bg-background p-10">
        <div className="max-w-[1180px] mx-auto">
          <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0 mb-1">Directory</h1>
          <div className="flex gap-1 border-b border-slate-200 mb-6">
            {['People', 'Emails', 'Teams', 'Rates & Costs', 'Access log', 'Portal access'].map(t => (
              <span key={t} className={`font-(family-name:--font-display) font-extrabold text-sm px-1.5 py-3 mr-5 -mb-px border-b-[2.5px] ${t === 'Portal access' ? 'text-tn-ink border-tn-teal' : 'text-muted border-transparent'}`}>{t}</span>
            ))}
          </div>
          <PortalAccessTab people={people} twoStep={{ Tina: 'on', 'Tina Gennette': 'on', 'Kevin Ames': 'none', 'Joy Deche': 'on', 'Stephanie Aguirre': 'none' }} />
        </div>
      </div>
    )
  }

  if (screen === 'invite') {
    const person = (name: string, over: Partial<PersonView>) => ({
      id: name, full_name: name, status: 'active', accountId: null, portalInvitedAt: null,
      emails: { trueNorth: null, goodnews: `${name.split(' ')[0].toLowerCase()}@goodnewsadvocates.org`, coe: null },
      ...over,
    }) as unknown as PersonView
    const card = (title: string, caption: string, node: React.ReactNode) => (
      <div className="w-[430px] rounded-[18px] border border-slate-200 bg-card p-6 shadow-[0_24px_60px_-30px_rgba(1,35,88,.35)]">
        <p className="m-0 mb-1 text-[11px] font-extrabold uppercase tracking-wide text-muted">{title}</p>
        <p className="m-0 mb-4 text-[12.5px] text-muted">{caption}</p>
        <div className="flex items-start justify-between gap-3.5">
          <span className="text-[12.5px] text-muted font-semibold shrink-0 pt-1">Portal access</span>
          <span className="text-right min-w-0">{node}</span>
        </div>
      </div>
    )
    const sent = (
      <span className="inline-flex flex-col items-end gap-1.5">
        <span className="inline-flex items-center gap-2">
          <span className={`inline-flex items-center font-(family-name:--font-display) font-extrabold text-[11px] rounded-[7px] px-3 py-[5px] ${PILL_CLASS.teal}`}>Invited</span>
          <span className="font-(family-name:--font-display) font-extrabold text-[12px] rounded-[8px] px-3 py-1.5 text-tn-ink border border-slate-200">Send again</span>
          <span className="font-(family-name:--font-display) font-extrabold text-[12px] rounded-[8px] px-3 py-1.5 text-red-600 border border-[rgba(215,57,47,.35)]">Revoke</span>
        </span>
        <span className="text-[11.5px] text-tn-teal font-semibold max-w-[240px] text-right">Invitation sent to ana@goodnewsadvocates.org.</span>
      </span>
    )
    return (
      <div className="min-h-screen bg-background p-10">
        <div className="flex flex-wrap gap-6">
          {card('1 · Not invited yet', 'Active, with a GoodNews address. One click invites.', <PortalAccessControl p={person('Ana Silva', {})} canInvite />)}
          {card('2 · Right after Invite', 'The invitation email went out.', sent)}
          {card('3 · Invited, not signed in yet', 'Send again resends the email; Revoke withdraws it.', <PortalAccessControl p={person('Ana Silva', { portalInvitedAt: '2026-09-28' })} canInvite />)}
          {card('4 · Signed in', 'Revoke signs them out at once.', <PortalAccessControl p={person('Tina Gennette', { portalInvitedAt: '2026-09-28', accountId: 'x' })} canInvite />)}
          {card('5 · No GoodNews address', 'The address comes first: it is the one they sign in with.', <PortalAccessControl p={person('Devon Smith', { emails: { trueNorth: 'devon@truenorthdigitalmarketing.com', goodnews: null, coe: null } })} canInvite />)}
          {card('6 · Inactive', 'No access, and no Invite, while inactive.', <PortalAccessControl p={person('Former Person', { status: 'inactive' })} canInvite />)}
        </div>
      </div>
    )
  }

  if (screen === 'directory') {
    const row = (label: string, node: React.ReactNode) => (
      <div className="flex items-center justify-between gap-3.5">
        <span className="text-[12.5px] text-muted font-semibold shrink-0">{label}</span>
        <span className="text-right min-w-0">{node}</span>
      </div>
    )
    const pill = (cls: string, label: string) => (
      <span className={`inline-flex items-center font-(family-name:--font-display) font-extrabold text-[11px] rounded-[7px] px-3 py-[5px] whitespace-nowrap ${cls}`}>{label}</span>
    )
    const card = (name: string, access: React.ReactNode, twoStep: React.ReactNode) => (
      <div className="w-[430px] rounded-[18px] border border-slate-200 bg-card p-6 shadow-[0_24px_60px_-30px_rgba(1,35,88,.35)]">
        <p className="m-0 mb-1 text-[11px] font-extrabold uppercase tracking-wide text-muted">Directory card · {name}</p>
        <h3 className="m-0 mb-4 font-(family-name:--font-display) text-[15px] font-extrabold text-tn-ink">Login &amp; access</h3>
        <div className="flex flex-col gap-[13px]">
          {row('Portal access', access)}
          {row('Two-step sign-in', twoStep)}
          {row('GoodNews', <span className="text-[13.5px] font-semibold text-tn-teal">{name.split(' ')[0].toLowerCase()}@goodnewsadvocates.org</span>)}
        </div>
      </div>
    )
    return (
      <div className="min-h-screen bg-background p-10">
        <div className="flex flex-wrap gap-6">
          {card('Tina Gennette', pill(PILL_CLASS.green, 'Has access'), <TwoStepControl name="Tina Gennette" state="on" since="2026-10-02" reset={async () => {}} />)}
          {card('Kevin Ames', pill(PILL_CLASS.green, 'Has access'), <TwoStepControl name="Kevin Ames" state="not-set-up" reset={null} />)}
          {card('Ana Silva', pill(PILL_CLASS.teal, 'Invited'), <TwoStepControl name="Ana Silva" state="no-account" reset={null} />)}
          {card('Joy Deche', pill(PILL_CLASS.green, 'Has access'), <TwoStepControl name="Joy Deche" state="on" since="2026-10-02" reset={async () => {}} />)}
        </div>
      </div>
    )
  }

  if (screen === 'banner') {
    // The reminder the app layout shows while someone's week runs (see (app)/layout.tsx).
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-slate-200 bg-white px-6 py-3.5 flex items-center"><span className="font-(family-name:--font-display) font-extrabold text-tn-ink">True North · Operations Portal</span></header>
        <TwoStepBanner daysLeft={6} />
        <div className="p-10 text-muted">(The page they opened, as usual.)</div>
      </div>
    )
  }

  if (screen === 'profile') {
    // Settings' Sign-in and security (components/settings/PersonalSettings.tsx), in its three states.
    const section = (caption: string, node: React.ReactNode) => (
      <div className="max-w-[920px] rounded-[18px] border border-slate-200 bg-white overflow-hidden">
        <p className="m-0 px-8 pt-4 text-[11px] font-extrabold uppercase tracking-wide text-muted">{caption}</p>
        <div className="px-8 pt-3 pb-6">
          <div className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.08em] uppercase text-tn-teal mb-3 pb-2 border-b border-slate-200">Sign-in &amp; security</div>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between text-[13.5px]"><span className="text-muted">Signs in with</span><span className="text-foreground">ana@goodnewsadvocates.org</span></div>
            <div className="flex flex-col gap-2">
              <span className="text-[12.5px] text-muted font-semibold">Two-step sign-in</span>
              {node}
            </div>
          </div>
        </div>
      </div>
    )
    return (
      <div className="min-h-screen bg-background p-10 flex flex-col gap-6">
        {section('1 · New person, their week running', <TwoStepSelf since={null} daysLeft={6} />)}
        {section('2 · Someone from before, until the cutoff', <TwoStepSelf since={null} daysLeft={null} />)}
        {section('3 · Set up', <TwoStepSelf since="2026-09-28" daysLeft={null} />)}
      </div>
    )
  }

  const skip = screen === 'enroll-new' ? { label: 'Skip for now (7 days left)' } : null
  return (
    <AuthShell>
      <TwoStepEnroll skip={skip} qr={mockQr()} secret="JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP" uri="otpauth://totp/True%20North%20Operations%20Portal:ana%40goodnewsadvocates.org?secret=JBSWY3DPEHPK3PXP&issuer=True%20North%20Operations%20Portal" email="ana@goodnewsadvocates.org" verify={null} signOut={null} />
    </AuthShell>
  )
}
