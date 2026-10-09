// The Method tab, read from the things it describes.
//
// The point of the tab is that a number stays defensible when somebody
// disputes it, which a hand-written "every 4 hours" cannot do: it stops being
// true the day the cron changes and nobody notices for a quarter.

import type { OpenDecision, Source } from './types'
import { countChanges, failed, reportDb, type Recording } from './data'

/** Matches deploy/cron/portal.crontab. Six passes a day, which is what the cadence text says. */
const SYNC_CADENCE = 'every 4 hours'

export async function loadMethod(recording: Recording): Promise<{ sources: Source[]; todo: OpenDecision[] }> {
  const [{ count: boards, error }, changes] = await Promise.all([
    reportDb().from('monday_boards').select('id', { count: 'exact', head: true }).eq('included', true),
    recording.state === 'on' ? countChanges() : Promise.resolve(0),
  ])
  failed('the boards', error)

  const logged = recording.state === 'on'
    ? `about ${changes.toLocaleString('en-US')} changes recorded`
    : 'not recording yet'

  const sources: Source[] = [
    {
      name: 'Monday assignments',
      state: 'live',
      cadence: `${SYNC_CADENCE} · ${boards ?? 0} boards`,
      what: 'Who is on which step, its status, due date, board and workspace. The same read as My Work, so the two pages cannot disagree.',
    },
    {
      name: 'Assignment change log',
      state: recording.state === 'on' ? 'live' : 'to-build',
      cadence: `written by the same sync · ${logged}`,
      what: 'One row per change: step, person, status, due date, moment. Held time and on-time delivery come only from here.',
    },
    {
      name: 'Timeclock entries',
      state: 'live',
      cadence: 'approved and locked hours only',
      what: 'Hours per person per day, by timeclock code. Answers how much time went in, which the boards never record.',
    },
  ]

  // Only what is still open. A settled item that stays on the page is the
  // fastest way to make the whole panel ignored.
  const todo: OpenDecision[] = recording.state === 'on'
    ? []
    : [{ text: 'Start the change log, so the sync writes down what changes on each step.' }]

  return { sources, todo }
}
