// Report: what got delivered, how long it sat with each person, what came late.
//
// Third view of the same module as My Work and My Team, and it sits between
// them in the switch because it is about both: My Work is one person's list
// now, My Team is who they are, and this is what actually happened.
//
// Reachable by anyone who can reach My Work. What differs by level is scope,
// not entry: level 1 sees themselves, level 2 their team, level 3 everybody
// plus the Workload tab.

import Link from 'next/link'
import { requireSurface, loadAccess } from '@/lib/access/resolve'
import { directoryLevel } from '@/lib/access/surfaces'
import { createClient } from '@/lib/supabase/server'
import { loadCurrentPerson } from '@/lib/directory/current-person'
import { WorkViewSwitch } from '@/components/monday/WorkViewSwitch'
import { ReportTabs, resolveTab, type ReportTabKey } from '@/components/report/ReportTabs'
import { ReportNav, DimWhilePending } from '@/components/report/ReportFrame'
import { ChangeLogNotice } from '@/components/report/ReportNotices'
import { ReportOverview } from '@/components/report/ReportOverview'
import { ReportControls } from '@/components/report/ReportControls'
import { resolvePeriod, resolveScope, type ReportState } from '@/lib/report/scope'
import { loadReportOverview, type Recording } from '@/lib/report/data'

export const metadata = { title: 'Report' }
export const dynamic = 'force-dynamic'

/** Tabs with something behind them. The rest arrive as they are built. */
const READY: readonly ReportTabKey[] = ['overview']

export default async function ReportPage(
  { searchParams }: {
    searchParams: Promise<{ tab?: string; scope?: string; period?: string; team?: string }>
  },
) {
  await requireSurface('my-work')

  const sp = await searchParams
  const access = await loadAccess()
  const level = directoryLevel(access.can)

  // Clamped against the level, never taken as given: the query string is
  // typed by people, and a level 1 person editing ?scope=everyone lands on
  // their own work rather than on an error or on everyone.
  const scope = resolveScope(sp.scope, level)
  const period = resolvePeriod(sp.period)
  // Screen 6.6: a tab this level may not see resolves to Overview rather than
  // throwing, so an admin's shared link degrades quietly.
  const tab = resolveTab(sp.tab, level)
  const state: ReportState = { tab, scope, period, team: sp.team }

  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  const me = await loadCurrentPerson(supabase, auth?.user ?? null)

  // Me means this person; My team means the team filter if one is set and
  // otherwise everyone they may see. resolveScope has already refused any
  // scope this level is not entitled to.
  const filters = scope === 'me'
    ? { personId: me?.id ?? null }
    : { teamId: sp.team || null }
  const { overview, recording } = await loadReportOverview(supabase, { ...filters, period })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-[13px]">
        <Link href="/" className="font-semibold text-muted hover:text-tn-ink transition-colors">Dashboard</Link>
        <span className="text-[var(--faint)]">/</span>
        <span className="font-semibold text-tn-ink">My Work / Report / My Team</span>
      </div>

      <div className="flex items-start justify-between gap-5 flex-wrap pb-[18px] border-b border-[var(--panel-border)]">
        <div>
          <h2 className="font-(family-name:--font-display) font-extrabold text-[26px] tracking-[-.01em] text-tn-ink m-0">
            Report
          </h2>
          <p className="text-[14.5px] text-muted mt-1.5 m-0">
            What got delivered, how long it sat with each person, and what came in late.
          </p>
        </div>
        <WorkViewSwitch active="report" />
      </div>

      <ReportNav>
        <ReportTabs active={tab} level={level} ready={READY} state={state} />
        <ReportControls
          state={state}
          level={level}
          note={methodNote(recording)}
          canExport={access.can('report-export')}
        />
        <DimWhilePending>
          <div className="space-y-4">
            <ChangeLogNotice recording={recording} />
            <ReportOverview data={overview} />
          </div>
        </DimWhilePending>
      </ReportNav>
    </div>
  )
}

/** The real change-log start date, never a constant. */
function methodNote(recording: Recording): string {
  if (recording.state !== 'on') return 'change log not running yet'
  const since = new Date(recording.startedAt)
    .toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
  return `change log since ${since}`
}

