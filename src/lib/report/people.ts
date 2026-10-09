// The People tab: one row per person in scope.
//
// Three of its numbers come from the change log, two from the current Monday
// snapshot, and one from the timeclock. Keeping the sources straight is the
// whole job, because the row reads as six facts about one person and they are
// true of three different moments.
//
// Someone no longer active keeps a row while they delivered something in the
// period, marked inactive: the work happened and the totals count it
// (decided 9 October 2026).

import type { PeopleFilter } from '@/lib/monday/worklist/data'
import { initialsOf } from '@/lib/directory/people-types'
import { colourOf } from '@/lib/directory/team-colour'
import type { PersonRow } from './types'
import { accountOwners, accountsInScope, isLate, loadOpenWork, loadSpans } from './data'
import { peopleInScope, primaryTeams, teamColours } from './directory'
import { periodStart, periodStartDay, reportToday } from './clock'
import { median, onTimeShare, type Span } from './spans'
import { approvedHours } from './hours'
import type { Period } from './scope'

export async function loadReportPeople(
  f: PeopleFilter & { period?: Period },
): Promise<PersonRow[]> {
  const period = f.period ?? 90
  const now = new Date()
  const since = periodStart(period, now)

  const [everyone, accounts, open, colours, owners] = await Promise.all([
    peopleInScope(f),
    accountsInScope(f),
    loadOpenWork(f),
    teamColours(),
    accountOwners(),
  ])
  if (!everyone.length) return []

  const spans = await loadSpans(accounts, since)

  // One person can own several Monday accounts, so the spans are folded back
  // onto the directory person rather than counted per account.
  const spansOf = new Map<string, Span[]>()
  for (const s of spans) {
    const pid = owners.get(s.monday_user_id)?.personId
    if (!pid) continue
    spansOf.set(pid, [...(spansOf.get(pid) ?? []), s])
  }

  const people = everyone.filter(p => p.active || spansOf.has(p.id))
  const [teamOf, hours] = await Promise.all([
    primaryTeams(people.map(p => p.id)),
    approvedHours(people.map(p => p.id), periodStartDay(period, now)),
  ])

  const today = reportToday(now)
  const openOf = new Map<string, { open: number; late: number }>()
  for (const r of open) {
    const pid = owners.get(r.mondayUserId)?.personId
    if (!pid) continue
    const cur = openOf.get(pid) ?? { open: 0, late: 0 }
    cur.open++
    if (isLate(r.dueDate, r.dueSuspect, today)) cur.late++
    openOf.set(pid, cur)
  }

  return people.map(p => {
    const mine = spansOf.get(p.id) ?? []
    const share = onTimeShare(mine)
    const counts = openOf.get(p.id) ?? { open: 0, late: 0 }
    const team = teamOf.get(p.id) ?? null
    const secs = hours.get(p.id)

    return {
      id: p.id,
      name: p.full_name,
      team,
      inactive: !p.active,
      color: colourOf(colours, team),
      initials: initialsOf(p.full_name),
      // Null, not zero, while there is no history for them: zero delivered is
      // a measurement and no history is not.
      delivered: mine.length || null,
      onTimePct: share.pct,
      medianHeld: median(mine.map(s => s.heldDays)),
      open: counts.open,
      late: counts.late,
      // Rounded once, at the end. Rounding each entry loses an hour a month.
      hours: secs === undefined ? null : Math.round(secs / 3600),
    }
  })
}
