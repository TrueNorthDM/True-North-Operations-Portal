// Screens 6.1, 6.4 and 6.5: the three things the page has to say out loud
// rather than express as a number.
//
// The shared rule across all of them: never render a zero where there is no
// data. A zero is a measurement, and "we were not watching" is not one.

import type { Recording } from '@/lib/report/data'
import { reportDate } from '@/lib/report/clock'

const PANEL = 'rounded-[10px] px-4 py-3.5 text-[13.5px] leading-[1.6]'

/**
 * 6.1: the honest first-run state.
 *
 * Delivered and Open still work, because they come from the snapshot. Median
 * held, On time and Backlog need history, and history starts the day the log
 * does. Naming the date lets somebody reconcile a number that looks low
 * against the reason it is low.
 */
export function ChangeLogNotice({ recording }: { recording: Recording }) {
  if (recording.state === 'on') {
    // Said as it is (audit, 9 October 2026): this used to claim the earlier
    // steps were counted as delivered, and they are not counted at all.
    return (
      <div className={`${PANEL} border border-[rgba(224,148,14,.5)] bg-[var(--warn-bg)] text-[var(--warn-fg)]`}>
        {`Delivery, on-time share and held time start on ${reportDate(recording.startedAt)}, when the change log began. `}
        Steps finished before that date are not counted, and a step that was already open then
        has no hand-off date, so it has no held time.
      </div>
    )
  }

  return (
    <div className={`${PANEL} border border-[rgba(224,148,14,.5)] bg-[var(--warn-bg)] text-[var(--warn-fg)]`}>
      <strong className="font-bold">No history yet.</strong> Delivery, on-time share and held time
      are read from a record of what changed on each step. Monday keeps only the current state, so
      this account has no past to report on until that record has been running for a while. Open
      now and Late now are the current snapshot and are already true.
    </div>
  )
}

/**
 * 6.4: the snapshot is behind.
 *
 * Says which half of the page is affected. A lead looking at a late count
 * needs to know whether the number in front of them is this morning's, and
 * a warning that does not separate the two halves makes them distrust all of
 * it, which is worse than the staleness.
 */
export function StaleSnapshot({ syncedAt, hoursBehind }: { syncedAt: string; hoursBehind: number }) {
  const at = new Date(syncedAt).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York',
  })
  const zone = new Date(syncedAt)
    .toLocaleTimeString('en-US', { timeZoneName: 'short', timeZone: 'America/New_York' }).split(' ').pop()

  return (
    <div className={`${PANEL} border border-[var(--panel-border)] bg-subtle text-foreground`}>
      Open and late counts are from the Monday pull at {at} ({zone}), {`${hoursBehind} hours`} ago.
      Delivered and held time are unaffected.
    </div>
  )
}

/**
 * 6.5: nothing at all.
 *
 * The one empty state that should suggest a cause. A switched-off board is
 * the usual explanation and is one click away, so it gets named rather than
 * left for the reader to guess at.
 */
export function NothingInWindow({ periodDays }: { periodDays: number }) {
  return (
    <div className="border border-[var(--panel-border)] bg-white rounded-[10px] px-4 py-[30px] text-center">
      <p className="text-[13.5px] text-muted m-0 leading-[1.6]">
        {/* The unit is inside the expression on purpose. When the text after
            an expression runs onto a second line, JSX trims every line of
            that chunk, including the first, and " days" became "days". */}
        No delivered work in the last {`${periodDays} days`}. Check the period, or whether
        this team&rsquo;s boards are switched on in{' '}
        <a href="/admin/settings" className="text-tn-teal font-semibold hover:underline">Settings</a>.
      </p>
    </div>
  )
}

/**
 * Why the Load column is empty.
 *
 * Hours per step is logged hours over steps delivered, and the log has
 * delivered nothing in the window yet. Saying so beats a Load column of
 * zeros, which would read as a team with nothing to do. On the screen and on
 * paper alike.
 */
export function NoEstimateYet() {
  return (
    <div className="rounded-[10px] border border-[rgba(224,148,14,.5)] bg-[var(--warn-bg)] px-4 py-3.5">
      <p className="text-[13.5px] text-[var(--warn-fg)] m-0 leading-[1.6]">
        Load cannot be estimated yet. Hours per step is the logged hours divided by the steps
        the change log has seen delivered, and it has seen none in the last 13 weeks.
        Utilisation and Backlog do not depend on it.
      </p>
    </div>
  )
}
