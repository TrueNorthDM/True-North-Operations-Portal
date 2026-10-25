// Design check: the portal's shell after the navigation redesign of 22
// September 2026 (Design/Redesign Handoff): the navy rail with its panels, the
// avatar and its menu, and the top bar's search and two notification drawers.
// The real components, fed the real rail model for a level.
//
//   ?level=user | lead | admin-level | admin   (admin, a Super Admin, by default)
//   ?hub=my-work | tools | people | admin | clocky              a panel open
//   ?open=menu | bell | inbox | launcher                        one of those open
//   ?page=soon | home                                           a Coming soon page, or Home, in the content
//   ?twoStep=6                                                  someone with 6 days left to set up two-step sign-in
//   ?approvals=3                                                Clocky's Approvals row with 3 waiting (Clock Safety.dc.html rail)
//   ?counts=1 | big                                             the attention counters (25 October 2026): a sample on
//                                                               North Time, Requests, My Work, People and Admin; big
//                                                               puts 140 on Approvals to show the 99+ cap
//
// A team leader and a user are given three tool grants (Publishing Goals, Href
// Links and the i7 report), which is what a typical team has. Development only.

import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { Sidebar } from '@/components/Sidebar'
import { NotificationButton } from '@/components/NotificationButton'
import { Launcher } from '@/components/Launcher'
import { ComingSoon } from '@/components/ComingSoon'
import { UserMenu } from '@/components/UserMenu'
import { TwoStepBanner } from '@/components/mfa/TwoStepBanner'
import { NewHome, HomeSwitches, readChoice } from '../home-full/NewHome'
import { clockOf, needsOf } from '../home-full/proto'
import { ClockyTopBar } from '@/components/clocky/clock/ClockyTopBar'
import { buildRail } from '@/lib/access/nav'
import { canAs, rulesWithTools } from '@/lib/access/simulate'
import type { AccessLevel } from '@/lib/access/catalogue'
import type { NavCount } from '@/lib/nav/counts'

export const dynamic = 'force-dynamic'

// admin is a Super Admin here (the first checks were written as one); admin-level is the Admin level.
const ROLE: Record<string, AccessLevel> = { user: 'user', lead: 'team_leader', admin: 'super_admin', super: 'super_admin', 'admin-level': 'admin' }
const GRANTS = new Set(['publishing', 'href-links', 'i7-budget'])
// One of each, so every hub shows a number: North Time 3, Requests 3 (the same
// Approvals, once), My Work 5, People 2, Admin 2 + 4 + 1 = 7.
const SAMPLE_COUNTS: Record<NavCount, number> = { approvals: 3, 'my-late': 5, 'integration-errors': 2, 'monday-unlinked': 4, 'automations-down': 1, 'no-rate': 2 }

export default async function RailDesignCheck({ searchParams }: { searchParams: Promise<{ level?: string; open?: string; hub?: string; page?: string; twoStep?: string; approvals?: string; counts?: string; home?: string; pay?: string; bess?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound()
  const sp = await searchParams
  const { open, hub, page, twoStep, approvals, counts } = sp
  // On Home, the prototype's level switch decides the shell's level too.
  const choice = readChoice(sp)
  const level = page === 'home' ? ({ super: 'admin', admin: 'admin-level', lead: 'lead', emp: 'user', con: 'user' } as const)[choice.level] : sp.level ?? 'admin'
  const twoStepDaysLeft = twoStep ? Number(twoStep) : null
  const role = ROLE[level] ?? 'super_admin'
  const can = canAs(role, { teams: [['team', role === 'team_leader']], rules: rulesWithTools(GRANTS) })
  const canTool = can
  const rail = buildRail({ can, canTool })
  // Always fixed here: a design check never asks the server for counts.
  // On Home, the rail counts what the Home sample shows: its decisions and its late steps.
  const home = needsOf(choice.level)
  const homeCounts: Partial<Record<NavCount, number>> = {
    approvals: home.needs.rows.filter(r => r.kind === 'approval' || r.kind === 'request').length,
    'my-late': (home.work?.rows ?? []).filter(r => r.due?.tone === 'late').length,
  }
  const startCounts: Partial<Record<NavCount, number>> = counts === 'big' ? { ...SAMPLE_COUNTS, approvals: 140 }
    : counts ? SAMPLE_COUNTS
    : page === 'home' ? homeCounts
    : approvals ? { approvals: Number(approvals) } : {}

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {page === 'home' && <HomeSwitches choice={choice} base="/design-check/rail?page=home" />}
      {/* The development badge sits where the avatar is; this page is for looking at the avatar. */}
      <style>{'nextjs-portal{display:none!important}'}</style>
      {/* The real layout's top bar (app/(app)/layout.tsx), with the clock and Who's working on sample data. */}
      <header className="border-b border-slate-200 bg-white px-4 md:px-6 py-3.5 flex items-center justify-between gap-4 sticky top-0 z-20">
        <span className="flex items-end gap-2.5">
          <Image src="/logos/true-north.png" alt="True North Digital Marketing" width={1352} height={705} priority className="h-[30px] md:h-9 w-auto" />
          <span className="hidden md:inline text-sm font-semibold text-slate-500 pb-0.5">Operations Portal</span>
        </span>
        <div className="flex items-center gap-1 md:gap-2">
          <Launcher rail={rail} canPeople={can('directory')} startOpen={open === 'launcher'} />
          <NotificationButton kind="inbox" startOpen={open === 'inbox'} />
          <Suspense fallback={null}>
            <ClockyTopBar
              clock={Promise.resolve({ ok: true as const, data: clockOf(choice.level) })}
              working={role === 'user' ? null : Promise.resolve({ ok: true as const, count: role === 'team_leader' ? 1 : 6 })}
              meName="Arnaldo Oliveira"
            />
          </Suspense>
          <NotificationButton kind="bell" startOpen={open === 'bell'} />
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
          startCounts={startCounts}
          user={{ email: 'arnaldo@leveluponline.org', name: 'Arnaldo Oliveira', avatarUrl: null }}
        />
        <main className="flex-1 min-w-0">
          {twoStepDaysLeft !== null && <TwoStepBanner daysLeft={twoStepDaysLeft} />}
          <div className={page === 'home' ? 'px-6 py-8' : 'p-8'}>
          {page === 'home' ? <NewHome choice={choice} /> : page === 'soon' ? (
            <ComingSoon icon="schema-app" title="Schema App" description="Write and publish schema markup for the sites' pages." />
          ) : <>
          <p className="text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.14em] text-tn-teal m-0">Design check · as built</p>
          <h1 className="font-(family-name:--font-display) font-extrabold text-[24px] text-tn-ink m-0">
            {role === 'super_admin' ? 'The shell, as a Super Admin' : role === 'admin' ? 'The shell, as an Admin' : role === 'team_leader' ? 'The shell, as a team leader' : 'The shell, as a user'}
          </h1>
          </>}
          </div>
        </main>
      </div>
    </div>
  )
}
