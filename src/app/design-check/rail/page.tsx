// Design check: the portal's shell after the navigation redesign of 22
// September 2026 (Design/Redesign Handoff): the navy rail with its panels, the
// avatar and its menu, and the top bar's search and two notification drawers.
// The real components, fed the real rail model for a level.
//
//   ?level=user | lead | admin   (admin by default)
//   ?hub=my-work | my-hours | tools | people | admin | clocky   a panel open
//   ?open=menu | bell | inbox | launcher                        one of those open
//   ?page=soon | home                                           a Coming soon page, or Home, in the content
//   ?twoStep=6                                                  someone with 6 days left to set up two-step sign-in
//
// A team leader and a user are given three tool grants (Publishing Goals, Href
// Links and the i7 report), which is what a typical team has. Development only.

import { notFound } from 'next/navigation'
import Image from 'next/image'
import { Sidebar } from '@/components/Sidebar'
import { NotificationBell } from '@/components/NotificationBell'
import { NotificationButton } from '@/components/NotificationButton'
import { Launcher } from '@/components/Launcher'
import { ComingSoon } from '@/components/ComingSoon'
import { UserMenu } from '@/components/UserMenu'
import { TwoStepBanner } from '@/components/mfa/TwoStepBanner'
import { HomeBody } from '../home-widgets/HomeBody'
import { buildRail } from '@/lib/access/nav'
import { directoryLevel, surfaceAllowed } from '@/lib/access/surfaces'
import type { RoleType } from '@/lib/auth/tier'

export const dynamic = 'force-dynamic'

const ROLE: Record<string, RoleType> = { user: 'user', lead: 'team_leader', admin: 'admin' }
const GRANTS = new Set(['publishing', 'href-links', 'i7-budget'])

export default async function RailDesignCheck({ searchParams }: { searchParams: Promise<{ level?: string; open?: string; hub?: string; page?: string; twoStep?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { level = 'admin', open, hub, page, twoStep } = await searchParams
  const twoStepDaysLeft = twoStep ? Number(twoStep) : null
  const role = ROLE[level] ?? 'admin'
  const can = (k: string) => surfaceAllowed(role, k, new Map())
  const canTool = (k: string) => role === 'admin' || GRANTS.has(k)
  const rail = buildRail({ can, canTool, level: directoryLevel(can) })

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* The development badge sits where the avatar is; this page is for looking at the avatar. */}
      <style>{'nextjs-portal{display:none!important}'}</style>
      <header className="border-b border-slate-200 bg-white px-6 py-3.5 flex items-center justify-between gap-4 sticky top-0 z-20">
        <span className="flex items-end gap-2.5">
          <Image src="/logos/true-north.png" alt="True North Digital Marketing" width={1352} height={705} priority className="h-9 w-auto" />
          <span className="text-sm font-semibold text-slate-500 pb-0.5">Operations Portal</span>
        </span>
        <div className="flex items-center gap-2">
          <Launcher rail={rail} canPeople={can('directory')} startOpen={open === 'launcher'} />
          <NotificationButton kind="inbox" startOpen={open === 'inbox'} />
          <NotificationBell startOpen={open === 'bell'} />
          <div className="md:hidden">
            <UserMenu userEmail="arnaldo@leveluponline.org" userName="Arnaldo Oliveira" avatarUrl={null} startOpen={open === 'menu'} twoStepDaysLeft={twoStepDaysLeft} />
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <Sidebar
          rail={rail}
          menuOpen={open === 'menu'}
          twoStepDaysLeft={twoStepDaysLeft}
          startHub={hub ?? null}
          user={{ email: 'arnaldo@leveluponline.org', name: 'Arnaldo Oliveira', avatarUrl: null }}
        />
        <main className="flex-1 min-w-0">
          {twoStepDaysLeft !== null && <TwoStepBanner daysLeft={twoStepDaysLeft} />}
          <div className={page === 'home' ? 'px-6 py-8' : 'p-8'}>
          {page === 'home' ? <HomeBody /> : page === 'soon' ? (
            <ComingSoon icon="schema-app" title="Schema App" description="Write and publish schema markup for the sites' pages." canSuggest={role === 'admin'} />
          ) : <>
          <p className="text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.14em] text-tn-teal m-0">Design check · as built</p>
          <h1 className="font-(family-name:--font-display) font-extrabold text-[24px] text-tn-ink m-0">
            {role === 'admin' ? 'The shell, as an admin' : role === 'team_leader' ? 'The shell, as a team leader' : 'The shell, as a user'}
          </h1>
          </>}
          </div>
        </main>
      </div>
    </div>
  )
}
