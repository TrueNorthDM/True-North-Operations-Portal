// (app) route group, wraps everything that needs the top bar + sidebar.
// Login and auth callback are at the root level, so they get a clean layout.
// All protected pages live inside this layout.

import Link from 'next/link'
import Image from 'next/image'
import { Sidebar } from '@/components/Sidebar'
import { MainContent } from '@/components/MainContent'
import { UserMenu } from '@/components/UserMenu'
import { NotificationBell } from '@/components/NotificationBell'
import { NotificationButton } from '@/components/NotificationButton'
import { Launcher } from '@/components/Launcher'
import { AccessPing } from '@/components/AccessPing'
import { ViewAsKeeper } from '@/components/ViewAsKeeper'
import { redirect } from 'next/navigation'
import { getCurrentPerson, getSessionUser } from '@/lib/auth/session'
import { checkPortalAccess } from '@/lib/auth/portal-access'
import { checkTwoStep } from '@/lib/auth/two-step'
import { daysLeft } from '@/lib/auth/two-step-rule'
import { loadAccess } from '@/lib/access/resolve'
import { buildRail } from '@/lib/access/nav'
import { directoryLevel } from '@/lib/access/surfaces'
import { loadInbox } from '@/lib/notifications/inbox'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Nav visibility comes from the configured per-level surfaces (Admin →
  // Access levels), not from the tier alone. profiles.role='admin' is still a
  // floor inside loadAccess, so a real admin is never hidden out of anything.
  //
  // Identity and person come from auth/session.ts, shared with loadAccess and
  // the page underneath, so this layout no longer asks Supabase who is signed in
  // a second time or loads the person a third.
  const [user, access, me, portal, twoStep] = await Promise.all([getSessionUser(), loadAccess(), getCurrentPerson(), checkPortalAccess(), checkTwoStep()])
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
  const rail = buildRail({ can: access.can, canTool: access.canTool, level: directoryLevel(access.can) })
  const canSettings = access.can('settings')
  // The bell's notifications, for the person this page renders as. One
  // indexed read; empty while migration 088 has not been run.
  const inbox = me ? await loadInbox(me.id) : {}

  return (
    <>
      {user && <AccessPing />}
      {/* Keeps a View Stage preview impersonating across navigation. */}
      <ViewAsKeeper />
      {/* Top bar, brand on the left. On the right, since the navigation
          redesign of 22 September 2026: search (the Cmd+K launcher), Messages
          (Chat and Email) and Notifications (Tools and System). The avatar
          lives at the foot of the rail, and only comes up here on a phone,
          where the rail is hidden. */}
      <header className="border-b border-slate-200 bg-white px-6 py-3.5 flex items-center justify-between gap-4 sticky top-0 z-20">
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
              className="h-9 w-auto"
            />
          </span>
          <span className="text-sm font-semibold text-slate-500 pb-0.5 group-hover:text-slate-700 transition-colors">
            Operations Portal
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <Launcher rail={rail} canSettings={canSettings} canPeople={access.can('directory')} />
          <NotificationButton kind="inbox" />
          <NotificationBell items={inbox} />
          {/* The person's own mailbox, not the session's: in a View Stage preview
              those differ, and the menu should read as that person. */}
          <div className="md:hidden">
            <UserMenu userEmail={me?.email ?? user?.email ?? null} userName={me?.full_name ?? null} avatarUrl={me?.avatar_url ?? null} canSettings={canSettings} />
          </div>
        </div>
      </header>

      {/* The reminder while someone's week to set up two-step sign-in runs. */}
      {twoStepDays !== null && (
        <div className="flex items-center justify-center gap-3 border-b border-[#f2dc85] bg-[#fdf6d8] px-6 py-2.5 text-[13px] text-[#6b5500]">
          <span>
            Set up two-step sign-in: <strong>{twoStepDays} {twoStepDays === 1 ? 'day' : 'days'} left</strong>. After that the portal asks for it before you can go on.
          </span>
          <Link href="/auth/two-step/setup" className="font-(family-name:--font-display) font-extrabold text-[12.5px] text-tn-ink underline">Set it up now</Link>
        </div>
      )}

      {/* Sidebar + main */}
      <div className="flex flex-1">
        <Sidebar
          rail={rail}
          canSettings={canSettings}
          user={{ email: me?.email ?? user?.email ?? null, name: me?.full_name ?? null, avatarUrl: me?.avatar_url ?? null }}
        />
        <MainContent>{children}</MainContent>
      </div>
    </>
  )
}
