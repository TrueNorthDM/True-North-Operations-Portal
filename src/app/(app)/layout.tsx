// (app) route group, wraps everything that needs the top bar + sidebar.
// Login and auth callback are at the root level, so they get a clean layout.
// All protected pages live inside this layout.

import Link from 'next/link'
import Image from 'next/image'
import { Sidebar } from '@/components/Sidebar'
import { MainContent } from '@/components/MainContent'
import { ThemeToggle } from '@/components/ThemeToggle'
import { UserMenu } from '@/components/UserMenu'
import { createClient } from '@/lib/supabase/server'
import { isCurrentUserAdmin } from '@/lib/auth/role'
import { loadCurrentPerson } from '@/lib/directory/current-person'
import { tierOf } from '@/lib/auth/tier'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const [isAdmin, me] = await Promise.all([isCurrentUserAdmin(), loadCurrentPerson(supabase, user)])
  // Tier drives nav visibility (Part 4). profiles.role='admin' is a floor for
  // privilege, so a real admin is never demoted by a missing/lower role_type.
  const tier = tierOf(isAdmin ? 'admin' : (me?.roleType ?? 'user'))

  return (
    <>
      {/* Top bar, brand on the left; theme toggle + avatar on the right
          (avatar is always the rightmost element). */}
      <header className="border-b border-slate-200 bg-white px-6 py-3.5 flex items-center justify-between gap-4 sticky top-0 z-20">
        {/* True North lockup. On dark the navy wordmark sits on a white chip so
            it stays legible; on the white light bar the chip is invisible. */}
        <Link href="/" className="flex items-end gap-2.5 group" aria-label="Go to dashboard">
          <span className="rounded-lg dark:bg-[#ffffff] dark:px-2 dark:py-1">
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
          <ThemeToggle />
          <UserMenu userEmail={user?.email ?? null} userName={me?.full_name ?? null} avatarUrl={me?.avatar_url ?? null} />
        </div>
      </header>

      {/* Sidebar + main */}
      <div className="flex flex-1">
        <Sidebar isPrivileged={tier.isPrivileged} />
        <MainContent>{children}</MainContent>
      </div>
    </>
  )
}
