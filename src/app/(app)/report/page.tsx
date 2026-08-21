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
import { ReportPeople } from '@/components/report/ReportPeople'
import { ReportWaits } from '@/components/report/ReportWaits'
import { ReportMethod } from '@/components/report/ReportMethod'
import { loadReportPeople } from '@/lib/report/people'
import { loadWaits } from '@/lib/report/waits'
import { loadMethod } from '@/lib/report/method'
import { ReportControls } from '@/components/report/ReportControls'
import { resolvePeriod, resolveScope, type ReportState } from '@/lib/report/scope'
import { loadReportOverview, readRecording, type Recording } from '@/lib/report/data'

export const metadata = { title: 'Report' }
export const dynamic = 'force-dynamic'

/** Tabs with something behind them. The rest arrive as they are built. */
const READY: readonly ReportTabKey[] = ['overview', 'people', 'waits', 'method']

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
  // Only the recording state is needed by every tab: the notice above the
  // content and the note beside the controls. The Overview's own load reads
  // the whole worklist and a year of events, so it waits until it is the tab
  // actually being shown.
  const recording = await readRecording(supabase)

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
            <Tab tab={tab} supabase={supabase} filters={filters} period={period} recording={recording} />
          </div>
        </DimWhilePending>
      </ReportNav>
    </div>
  )
}

/**
 * One tab's body.
 *
 * Each loader is called only for the tab being shown. The Workload tab is not
 * here yet, and resolveTab has already sent anyone asking for it to Overview,
 * so there is no case to fall through.
 */
async function Tab({
  tab, supabase, filters, period, recording,
}: {
  tab: ReportTabKey
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
  filters: { personId?: string | null; teamId?: string | null }
  period: 30 | 90
  recording: Recording
}) {
  if (tab === 'people') {
    const people = await loadReportPeople(supabase, { ...filters, period })
    return <ReportPeople people={people} periodDays={period} />
  }

  if (tab === 'waits') {
    const { steps, stuck } = await loadWaits(supabase, { ...filters, period })
    return <ReportWaits steps={steps} stuck={stuck} />
  }

  if (tab === 'method') {
    const { sources, todo } = await loadMethod(supabase, recording)
    return <ReportMethod sources={sources} todo={todo} />
  }

  const { overview } = await loadReportOverview(supabase, { ...filters, period })
  return <ReportOverview data={overview} />
}

/** The real change-log start date, never a constant. */
function methodNote(recording: Recording): string {
  if (recording.state !== 'on') return 'change log not running yet'
  const since = new Date(recording.startedAt)
    .toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
  return `change log since ${since}`
}

