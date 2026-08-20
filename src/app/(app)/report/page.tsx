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
import { ReportTabs, type ReportTabKey } from '@/components/report/ReportTabs'
import { ReportOverview } from '@/components/report/ReportOverview'
import { loadReportOverview, type Recording } from '@/lib/report/data'

export const metadata = { title: 'Report' }
export const dynamic = 'force-dynamic'

/** Tabs with something behind them. The rest arrive as they are built. */
const READY: readonly ReportTabKey[] = ['overview']

export default async function ReportPage() {
  await requireSurface('my-work')

  const access = await loadAccess()
  const level = directoryLevel(access.can)

  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  const me = await loadCurrentPerson(supabase, auth?.user ?? null)

  // Level 1 sees their own work and nothing else. Not a filter the person can
  // clear: it is the scope of the page for them.
  const scope = level >= 2 ? {} : { personId: me?.id ?? null }
  const { overview, recording } = await loadReportOverview(supabase, scope)

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

      <ReportTabs active="overview" level={level} ready={READY} />
      <RecordingNotice recording={recording} />
      <ReportOverview data={overview} />
    </div>
  )
}

/**
 * Says out loud that the past is not available yet.
 *
 * Three of the five headline numbers, both charts and the per-person panel
 * read the change log, and the change log starts empty. Without this line the
 * page looks like a team that delivered nothing, which is a claim nobody
 * should make on this account's behalf.
 */
function RecordingNotice({ recording }: { recording: Recording }) {
  if (recording.state === 'on' && recording.events > 0) return null

  const since = recording.state === 'on'
    ? new Date(recording.startedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  return (
    <div className="rounded-[12px] border border-[var(--warn-border)] bg-[var(--warn-bg)] px-[18px] py-3.5">
      <p className="text-[13px] text-[var(--warn-fg)] m-0 leading-[1.55]">
        <strong className="font-bold">No history yet.</strong>{' '}
        Delivery, on-time share and held time are read from a record of what changed on each
        step. Monday keeps only the current state, so this account has no past to report on
        until that record has been running for a while
        {since ? `; it started on ${since}.` : '.'}{' '}
        Open now and Late now are the current snapshot and are already true.
      </p>
    </div>
  )
}
