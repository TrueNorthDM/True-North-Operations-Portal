// The Method tab, read from the things it describes.
//
// The point of the tab is that a number stays defensible when somebody
// disputes it, which a hand-written "every 4 hours" cannot do: it stops being
// true the day the cron changes and nobody notices for a quarter.

import type { Db } from '@/lib/supabase/types'
import type { OpenDecision, Source } from '@/components/report/ReportMethod'
import type { Recording } from './data'

type Client = Db

/** Matches deploy/cron/portal.crontab. Six passes a day, which is what the cadence text says. */
const SYNC_CADENCE = 'every 4 hours'

export async function loadMethod(
  supabase: Client, recording: Recording,
): Promise<{ sources: Source[]; todo: OpenDecision[] }> {
  const { count: boards } = await supabase
    .from('monday_boards').select('id', { count: 'exact', head: true }).eq('included', true)

  const logged = recording.state === 'on'
    ? `${recording.events.toLocaleString('en-US')} changes recorded`
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
      cadence: 'approved hours only',
      what: 'Approved hours per person per day with the i7 code. Answers how much time went in, which the boards never record.',
    },
  ]

  // The decisions that are settled drop off the list. One that stays on the
  // page after being made is the fastest way to make the whole panel ignored.
  const todo: OpenDecision[] = []
  if (recording.state !== 'on') {
    todo.push({ text: 'Run migration 071 so the sync can start writing the change log.' })
  }
  todo.push(
    { text: 'Backfill what Monday still remembers for open items, one item at a time.' },
    { text: 'Decide who gets the Everyone scope beyond directory level 3.' },
  )

  return { sources, todo }
}
