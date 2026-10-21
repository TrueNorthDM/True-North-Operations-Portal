// Design check: a Clocky screen inside the portal's real shell (top bar and
// rail as the app draws them), with nothing of the design check around it.
//
//   /design-check/clocky-app?frame=1B          a clock panel frame (1A to 1N), panel open
//   &level=user | lead | admin-level | admin   the rail for that level (Super Admin by default)
//   &closed=1                                   the panel closed (only the top-bar button)
//   ?frame=N1 | N3 | N4                         the bell open (Super Admin, Team Leader, requester)
//                                               over Clock safety; for a Team Leader or a User the
//                                               address opens their own Time entries, as the real
//                                               page redirects
//   ?frame=3A1 ... 3K4 | E                      Time entries (the frame's own level)
//   ?frame=5A ... 5C3                        Timesheet periods (settings, a person's page, Rates & Costs)
//   ?frame=10A1 | 10A1v ...                  Clocky part 2 (Part2Frame, the overview's codes)
//   ?frame=6A | 6B | 6Ec | 6Es | 6Ef | 6F | 6Fp | 6G   Invoices, part 2 (the frame's own level)
//   ?frame=4A | 4B                           Clock safety, with data or empty (Super Admin)
//   ?frame=AP1 | AP3 | AP2 | APL | APD       Approvals, part 2 (Super Admin: waiting, others, decided; Team Leader; Dave Sharpe)
//   ?frame=2A ... 2E | 2P                       Who's working, the drawer open (2B as Wendy
//                                               Cacka, Team Leader of Web) or the page
//
// Development only.

import { notFound } from 'next/navigation'
import Image from 'next/image'
import { Sidebar } from '@/components/Sidebar'
import { NotificationButton } from '@/components/NotificationButton'
import { Launcher } from '@/components/Launcher'
import { buildRail } from '@/lib/access/nav'
import { canAs, rulesWithTools } from '@/lib/access/simulate'
import type { AccessLevel } from '@/lib/access/catalogue'
import { MainContent } from '@/components/MainContent'
import { AppClock } from './AppClock'
import { AppWorking, AppWorkingPage } from './AppWorking'
import { AppApprovals, type ApprovalsFrame } from './AppApprovals'
import { PeriodsFrame } from '../clocky-periods/PeriodsFrame'
import { PART2_FRAMES, Part2Frame } from '../clocky-part2/Part2Frame'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { BellCheck } from '../clocky-bell/BellCheck'
import { SafetyCheck } from '../clocky-safety/SafetyCheck'
import { EntriesFrame } from '../clocky-entries/EntriesCheck'
import { buildFrame } from '../clocky-entries/frames'
import { ME } from '../clocky-entries/sample'

const BELL = { N1: 'super', N3: 'lead', N4: 'user' } as const

export const dynamic = 'force-dynamic'

const ROLE: Record<string, AccessLevel> = { user: 'user', lead: 'team_leader', admin: 'super_admin', super: 'super_admin', 'admin-level': 'admin' }
const GRANTS = new Set(['publishing', 'href-links', 'i7-budget'])

export default async function ClockyAppCheck({ searchParams }: { searchParams: Promise<{ frame?: string; level?: string; closed?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { frame = '1A', level = 'admin', closed } = await searchParams
  const bell = BELL[frame as keyof typeof BELL] ?? null
  // Part 1's 3L frames now open part 2's list (3L as AP1, 3L2 as APL).
  const approvals = (({ '3L': 'AP1', '3L2': 'APL', '3L3': 'AP1', AP1: 'AP1', AP3: 'AP3', AP2: 'AP2', APL: 'APL', APD: 'APD', '7C': '7C', '9C': '9C', '10D': '10D' }) as Record<string, ApprovalsFrame>)[frame] ?? null
  const safety = frame === '4A' || frame === '4B'
  const periods = /^5[ABC]/.test(frame)
  const part2 = PART2_FRAMES.test(frame)
  const entries = !approvals && /^3|^E$/.test(frame)
  // Clock safety sends a Team Leader or a User to their own Time entries (the page's redirect).
  const userBell = bell === 'user' || bell === 'lead'
  const entriesLevel = entries ? buildFrame(frame).level : null
  const working = /^2/.test(frame)
  const workingPage = frame === '2P'
  // Invoices.dc.html: 6A, 6B, 6Ec, 6F and 6Fp as a User (Justus Tsofa, Wendy Cacka), 6Ef and 6G as Finance (Tina Gennette).
  const invUser = ['6A', '6B', '6Ec', '6F', '6Fp', '7A', '7Ap', '7B', '7D', '7E', '9A', '9Ap', '9B', '10E', '10C'].includes(frame)
  const invFinance = frame === '6Ef' || frame === '6G' || frame === '9D' || frame === '9Dp'
  const role = invUser ? 'user' : invFinance ? 'admin'
    : bell === 'lead' || entriesLevel === 'lead' || frame === '2B' || approvals === 'APL' || frame === '6Ct' || frame === '6Ce' ? 'team_leader'
    : approvals === 'APD' || frame === '6Cd' ? 'admin'
    : bell === 'user' || entriesLevel === 'user' ? 'user'
    : entriesLevel === 'admin' ? 'admin'
    : entriesLevel === 'super' ? 'super_admin'
    : ROLE[level] ?? 'super_admin'
  const can = canAs(role, { teams: [['team', role === 'team_leader']], rules: rulesWithTools(GRANTS) })
  const rail = buildRail({ can, canTool: can })

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <style>{'nextjs-portal{display:none!important}'}</style>
      <header className="border-b border-slate-200 bg-white px-4 md:px-6 py-3.5 flex items-center justify-between gap-4 sticky top-0 z-20">
        <span className="flex items-end gap-2.5">
          <Image src="/logos/true-north.png" alt="True North Digital Marketing" width={1352} height={705} priority className="h-[30px] md:h-9 w-auto" />
          <span className="hidden md:inline text-sm font-semibold text-slate-500 pb-0.5">Operations Portal</span>
        </span>
        <div className="flex items-center gap-1 md:gap-2">
          <Launcher rail={rail} canPeople={can('directory')} />
          <NotificationButton kind="inbox" />
          {/* Who's working is for Team Leaders and up; the Time entries frames have the
              list's running clock (on the clock since 10:45 AM). */}
          {working ? <AppWorking frame={frame} /> : (
            <AppClock frame={entries || bell === 'user' ? 'RUN' : bell || part2 ? '1A' : frame} open={!bell && !entries && !approvals && !safety && !periods && !part2 && closed !== '1'}
              working={role !== 'user'} />
          )}
          {bell ? <BellCheck level={bell} /> : <NotificationButton kind="bell" />}
        </div>
      </header>
      <div className="flex flex-1">
        <Sidebar rail={rail} menuOpen={false} twoStepDaysLeft={null} startHub={null} startCounts={{}}
          activePath={part2 ? (/^6[CD]/.test(frame) ? '/clocky-hours/approvals' : /^6[EFG]/.test(frame) ? '/clocky-hours/invoices' : /^6[AB]$/.test(frame) ? '/clocky-hours' : /^(7|9|10[CE])/.test(frame) ? '/requests' : '/directory') : periods ? (frame.startsWith('5A') ? '/admin' : '/directory') : approvals ? '/clocky-hours/approvals' : safety ? '/clocky-hours/safety' : entries || userBell ? '/clocky-hours' : bell ? '/clocky-hours/safety' : workingPage ? '/clocky-hours/whos-working' : '/'}
          user={{ email: null, name: frame === '6B' ? 'Wendy Cacka' : /^7/.test(frame) && frame !== '7Dx' ? 'Tina Gennette' : /^10[CE]$/.test(frame) ? 'Cheyenne Wilson' : invUser ? 'Justus Tsofa' : invFinance ? 'Tina Gennette' : entriesLevel ? ME[entriesLevel] : bell === 'lead' ? ME.lead : bell === 'user' ? ME.user : frame === '2B' || approvals === 'APL' || frame === '6Ct' || frame === '6Ce' ? 'Wendy Cacka' : approvals === 'APD' || frame === '6Cd' ? 'Dave Sharpe' : 'Arnaldo Oliveira', avatarUrl: null }} />
        {part2 ? (
          <MainContent notice={null}><Part2Frame frame={frame} /></MainContent>
        ) : periods ? (
          <MainContent notice={null}><PeriodsFrame frame={frame} level={level === 'admin-level' ? 'admin' : 'super'} /></MainContent>
        ) : safety ? (
          <MainContent notice={null}><SafetyCheck empty={frame === '4B'} access="full" /></MainContent>
        ) : approvals ? (
          <MainContent notice={null}><AppApprovals frame={approvals} /></MainContent>
        ) : entries || userBell ? (
          <MainContent notice={null}><EntriesFrame frame={entries ? frame : bell === 'lead' ? 'L' : '3A1'} /></MainContent>
        ) : workingPage ? (
          <MainContent notice={null}>
            <div>
              <Breadcrumb parents={['/clocky-hours']} now="Who's working" />
              <AppWorkingPage frame={frame} />
            </div>
          </MainContent>
        ) : bell ? (
          <MainContent notice={null}><SafetyCheck empty={false} access="full" /></MainContent>
        ) : (
          <main className="flex-1 min-w-0 px-10 py-[34px]">
            <div className="font-(family-name:--font-display) font-extrabold text-[30px] text-tn-ink tracking-[-.01em]">True North Operations Portal</div>
            <div className="text-[15px] text-muted mt-1.5">Where would you like to go?</div>
          </main>
        )}
      </div>
    </div>
  )
}
