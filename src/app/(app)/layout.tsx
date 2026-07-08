// (app) route group — wraps everything that needs the top bar + sidebar.
// Login and auth callback are at the root level, so they get a clean layout.
// All protected pages live inside this layout.

import Link from 'next/link'
import { Sidebar } from '@/components/Sidebar'
import { MainContent } from '@/components/MainContent'
import { ThemeToggle } from '@/components/ThemeToggle'
import { UserMenu } from '@/components/UserMenu'
import { createClient } from '@/lib/supabase/server'
import { isCurrentUserAdmin } from '@/lib/auth/role'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isAdmin = await isCurrentUserAdmin()

  return (
    <>
      {/* Top bar — brand on the left; theme toggle + avatar on the right
          (avatar is always the rightmost element). */}
      <header className="border-b border-slate-200 bg-white px-6 py-3.5 flex items-center justify-between gap-4 sticky top-0 z-20">
        <Link href="/" className="flex items-center gap-2 group" aria-label="Go to dashboard">
          {/* North star — the portal's identity mark. */}
          <svg className="w-4 h-4 text-tn-accent shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 1l2.4 8.6L23 12l-8.6 2.4L12 23l-2.4-8.6L1 12l8.6-2.4z" />
          </svg>
          <span className="text-lg font-bold text-slate-900 group-hover:text-tn-primary transition-colors font-(family-name:--font-display)">
            True North
          </span>
          <span className="text-slate-300">/</span>
          <span className="text-sm text-slate-500 font-medium group-hover:text-slate-700 transition-colors">
            Operations Portal
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <UserMenu userEmail={user?.email ?? null} />
        </div>
      </header>

      {/* Sidebar + main */}
      <div className="flex flex-1">
        <Sidebar isAdmin={isAdmin} />
        <MainContent>{children}</MainContent>
      </div>
    </>
  )
}
