// (app) route group, wraps everything that needs the top bar + sidebar.
// Login and auth callback are at the root level, so they get a clean layout.
// All protected pages live inside this layout.

import Link from 'next/link'
import Image from 'next/image'
import { Sidebar } from '@/components/Sidebar'
import { MainContent } from '@/components/MainContent'
import { UserMenu } from '@/components/UserMenu'
import { NotificationButton } from '@/components/NotificationButton'
import { Launcher } from '@/components/Launcher'
import { AccessPing } from '@/components/AccessPing'
import { redirect } from 'next/navigation'
import { getCurrentPerson, getSessionUser } from '@/lib/auth/session'
import { checkPortalAccess } from '@/lib/auth/portal-access'
import { checkTwoStep } from '@/lib/auth/two-step'
import { daysLeft } from '@/lib/auth/two-step-rule'
import { TwoStepBanner } from '@/components/mfa/TwoStepBanner'
import { loadAccess } from '@/lib/access/resolve'
import { buildRail, NORTH_TIME_CLOSED_ROWS } from '@/lib/access/nav'
import { northTimeOpen } from '@/lib/timeclock/north-time-lock'
import { loadNavFacts } from '@/lib/access/nav-facts'
import { loadInbox } from '@/lib/notifications/inbox'
import { Suspense } from 'react'
import { ClockyTopBar } from '@/components/clocky/clock/ClockyTopBar'
import { getClockPanel } from '@/app/(app)/clocky-hours/clock-actions'
import { getWhosWorkingCount } from '@/app/(app)/clocky-hours/whos-working/actions'
import type { Fail } from '@/lib/timeclock/clocky-types'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Nav visibility comes from the configured per-level surfaces (Admin →
  // Access levels), not from the tier alone. profiles.role='admin' is still a
  // floor inside loadAccess, so a real admin is never hidden out of anything.
  //
  // Identity and person come from auth/session.ts, shared with loadAccess and
  // the page underneath, so this layout no longer asks Supabase who is signed in
  // a second time or loads the person a third.
  // The bell's notifications start as soon as the person is known, beside the
  // checks rather than after them; nothing is rendered before the checks pass.
  const mePromise = getCurrentPerson()
  const inboxPromise = mePromise.then(m => (m ? loadInbox(m.id) : {}))
  const [user, access, me, portal, twoStep, inbox] = await Promise.all([getSessionUser(), loadAccess(), mePromise, checkPortalAccess(), checkTwoStep(), inboxPromise])
  // Sign-in by invitation (migration 089): a session whose person was
  // deactivated or had the invitation revoked is signed out here, on the next
  // page it opens. The route handler does the sign-out, since a layout cannot
  // clear cookies while it renders.
  if (portal === 'denied') redirect('/auth/no-access')
  // Two-step sign-in (p4-2fa, lib/auth/two-step-rule.ts): an app that is set up
  // asks for its code; without one, the setup screen comes up once per browser
  // session while the week runs (skippable), and for good once it is over.
  if (twoStep.need === 'challenge') redirect('/auth/two-step')
  if (twoStep.need === 'enroll-required') redirect('/auth/two-step/setup')
  if (twoStep.need === 'enroll-optional' && !twoStep.skipped) redirect('/auth/two-step/setup')
  const twoStepDays = twoStep.need === 'enroll-optional' && twoStep.deadline ? daysLeft(twoStep.deadline, new Date()) : null
  // The rail, its panels and the launcher all come from one resolved model
  // (lib/access/nav.ts), built here for this person: what each of them offers
  // is exactly what the page guards let through.
  // North Time closed (migration 132): no clock, and its person-facing rows only for a Super Admin.
  const ntOpen = await northTimeOpen()
  const rail = buildRail({ can: access.can, canTool: access.canTool, facts: await loadNavFacts(access), hidden: ntOpen || access.isSuperAdmin ? undefined : NORTH_TIME_CLOSED_ROWS })
  // Clocky in the top bar (design handoff of 16 October 2026): the clock for
  // everyone with Time entries, Who's working for Team Leaders and up. Started
  // here and not awaited: the bar streams them in, the page never waits.
  const clockPromise = ntOpen && access.can('clocky-hours')
    ? getClockPanel().catch((): Fail => ({ ok: false, error: 'The clock could not be read. Try again in a moment.' }))
    : null
  const workingPromise = ntOpen && access.can('ck-whos-working')
    ? getWhosWorkingCount().catch((): Fail => ({ ok: false, error: "Who's working could not be read." }))
    : null

  return (
    <>
      {user && <AccessPing accountId={user.id} />}
      {/* Keeps a View Stage preview impersonating across navigation. */}
      {/* Top bar, brand on the left. On the right, since the navigation
          redesign of 22 September 2026: search (the Cmd+K launcher), Messages
          (Chat and Email), since 16 October 2026 Clocky's Who's working and
          clock, and Notifications (Tools and System). The avatar
          lives at the foot of the rail, and only comes up here on a phone,
          where the rail is hidden. On a phone the bar follows the phone frame of
          Clock Panel.dc.html (390px): the logo at 30px, no "Operations
          Portal", 16px sides, so the clock fits beside the icons. */}
      <header className="border-b border-slate-200 bg-white px-4 md:px-6 h-[var(--topbar-h)] shrink-0 flex items-center justify-between gap-4 sticky top-[var(--banner-h)] z-20">
        {/* True North lockup. On dark the navy wordmark sits on a white chip so
            it stays legible; on the white light bar the chip is invisible. */}
        <Link href="/" className="flex items-end gap-2.5 group" aria-label="Go to dashboard">
          <span className="rounded-lg">
            <Image
              src="/logos/true-north.png"
              alt="True North Digital Marketing"
              width={1352}
              height={705}
              priority
              className="h-[30px] md:h-9 w-auto"
            />
          </span>
          <span className="hidden md:inline text-sm font-semibold text-slate-500 pb-0.5 group-hover:text-slate-700 transition-colors">
            Operations Portal
          </span>
        </Link>

        <div className="flex items-center gap-1 md:gap-2">
          <Launcher rail={rail} canPeople={access.can('directory')} />
          <NotificationButton kind="inbox" />
          {/* Who's working (people icon) and the clock, left of the bell. */}
          {(clockPromise || workingPromise) && (
            <Suspense fallback={null}>
              <ClockyTopBar clock={clockPromise} working={workingPromise} meName={me?.full_name ?? ''} />
            </Suspense>
          )}
          <NotificationButton kind="bell" items={inbox} />
          {/* The person's own mailbox, not the session's: in a View Stage preview
              those differ, and the menu should read as that person. */}
          <div className="md:hidden">
            <UserMenu userEmail={me?.email ?? user?.email ?? null} userName={me?.full_name ?? null} avatarUrl={me?.avatar_url ?? null} twoStepDaysLeft={twoStepDays} canMyTeam={access.can('my-team')} />
          </div>
        </div>
      </header>

      {/* Sidebar + main */}
      <div className="flex flex-1">
        <Sidebar
          rail={rail}
          twoStepDaysLeft={twoStepDays}
          canMyTeam={access.can('my-team')}
          user={{ email: me?.email ?? user?.email ?? null, name: me?.full_name ?? null, avatarUrl: me?.avatar_url ?? null }}
        />
        {/* The reminder while someone's week to set up two-step sign-in runs. */}
        <MainContent notice={twoStepDays !== null ? <TwoStepBanner daysLeft={twoStepDays} /> : null}>{children}</MainContent>
      </div>
    </>
  )
}
