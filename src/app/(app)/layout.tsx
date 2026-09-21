// (app) route group, wraps everything that needs the top bar + sidebar.
// Login and auth callback are at the root level, so they get a clean layout.
// All protected pages live inside this layout.

import Link from 'next/link'
import Image from 'next/image'
import { Sidebar } from '@/components/Sidebar'
import { MainContent } from '@/components/MainContent'
import { UserMenu } from '@/components/UserMenu'
import { NotificationBell } from '@/components/NotificationBell'
import { AccessPing } from '@/components/AccessPing'
import { ViewAsKeeper } from '@/components/ViewAsKeeper'
import { getCurrentPerson, getSessionUser } from '@/lib/auth/session'
import { loadAccess } from '@/lib/access/resolve'
import { NAV_SURFACES, navHref, navVisible } from '@/lib/access/nav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Nav visibility comes from the configured per-level surfaces (Admin →
  // Access levels), not from the tier alone. profiles.role='admin' is still a
  // floor inside loadAccess, so a real admin is never hidden out of anything.
  //
  // Identity and person come from auth/session.ts, shared with loadAccess and
  // the page underneath, so this layout no longer asks Supabase who is signed in
  // a second time or loads the person a third.
  const [user, access, me] = await Promise.all([getSessionUser(), loadAccess(), getCurrentPerson()])
  const allowedNav = NAV_SURFACES.filter(k => navVisible(k, access.can))
  // A module rail opens whichever of its views this person may reach, so its
  // destination is resolved here rather than hardcoded on the item.
  const navHrefs = Object.fromEntries(
    allowedNav.map(k => [k, navHref(k, access.can)]).filter(([, h]) => h),
  ) as Record<string, string>

  return (
    <>
      {user && <AccessPing />}
      {/* Keeps a View Stage preview impersonating across navigation. */}
      <ViewAsKeeper />
      {/* Top bar, brand on the left; the notification bell on the right. The
          avatar lives at the foot of the rail since 21 September 2026, and
          only comes up here on a phone, where the rail is hidden. */}
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
          <NotificationBell />
          {/* The person's own mailbox, not the session's: in a View Stage preview
              those differ, and the menu should read as that person. */}
          <div className="md:hidden">
            <UserMenu userEmail={me?.email ?? user?.email ?? null} userName={me?.full_name ?? null} avatarUrl={me?.avatar_url ?? null} />
          </div>
        </div>
      </header>

      {/* Sidebar + main */}
      <div className="flex flex-1">
        <Sidebar
          allowed={allowedNav}
          hrefs={navHrefs}
          user={{ email: me?.email ?? user?.email ?? null, name: me?.full_name ?? null, avatarUrl: me?.avatar_url ?? null }}
        />
        <MainContent>{children}</MainContent>
      </div>
    </>
  )
}
