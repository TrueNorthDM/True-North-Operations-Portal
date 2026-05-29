// (app) route group — wraps everything that needs the top bar + sidebar.
// Login and auth callback are at the root level, so they get a clean layout.
// All protected pages live inside this layout.

import { Sidebar } from '@/components/Sidebar'
import { MainContent } from '@/components/MainContent'
import { createClient } from '@/lib/supabase/server'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <>
      {/* Top bar — brand only. Brand links back to dashboard. */}
      <header className="border-b border-slate-200 bg-white px-6 py-4 flex items-center sticky top-0 z-10">
        <a href="/" className="flex items-center gap-2 group" aria-label="Go to dashboard">
          <span className="text-lg font-bold text-slate-900 group-hover:text-slate-700 transition-colors">
            True North
          </span>
          <span className="text-slate-300">/</span>
          <span className="text-sm text-slate-500 font-medium group-hover:text-slate-700 transition-colors">
            Href Links
          </span>
        </a>
      </header>

      {/* Sidebar + main */}
      <div className="flex flex-1">
        <Sidebar userEmail={user?.email ?? null} />
        <MainContent>{children}</MainContent>
      </div>
    </>
  )
}
