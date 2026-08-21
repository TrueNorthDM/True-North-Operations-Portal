// The People tab: one row per person in scope.
//
// Three of its numbers come from the change log, two from the current Monday
// snapshot, and one from the timeclock. Keeping the sources straight is the
// whole job, because the row reads as six facts about one person and they are
// true of three different moments.

import type { SupabaseClient } from '@supabase/supabase-js'
import { loadWorklist } from '@/lib/monday/worklist/data'
import { TEAM_COLOR, initialsOf, teamKeyFromName } from '@/lib/directory/people-types'
import type { PersonRow } from '@/components/report/ReportPeople'
import { accountsInScope, loadSpans } from './data'
import { activePeople, primaryTeams } from './directory'
import { median, onTimeShare } from './spans'
import type { Period } from './scope'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = SupabaseClient<any, any, any>

type DirectoryPerson = {
  id: string
  full_name: string
  weekly_hours: number | null
  teamName: string | null
}

/** Everyone in scope, with the team they are primarily on. */
async function peopleInScope(
  supabase: Client, f: { personId?: string | null; teamId?: string | null },
): Promise<DirectoryPerson[]> {
  const people = await activePeople(supabase, f)
  if (!people.length) return []
  const teamOf = await primaryTeams(supabase, people.map(p => p.id))
  return people.map(p => ({ ...p, teamName: teamOf.get(p.id) ?? null }))
}

/** Approved hours per person over the period. Nothing else counts as worked. */
async function hoursByPerson(
  supabase: Client, personIds: string[], since: string,
): Promise<Map<string, number>> {
  if (!personIds.length) return new Map()

  const { data } = await supabase
    .from('tc_entries')
    .select('person_id, duration_seconds')
    .in('person_id', personIds)
    .in('state', ['approved', 'locked'])
    .gte('entry_date', since)
    .limit(100_000)

  const out = new Map<string, number>()
  for (const e of (data ?? []) as { person_id: string; duration_seconds: number }[]) {
    out.set(e.person_id, (out.get(e.person_id) ?? 0) + e.duration_seconds)
  }
  // Rounded once, at the end. Rounding each entry loses an hour a month.
  return new Map([...out].map(([id, secs]) => [id, Math.round(secs / 3600)]))
}

export async function loadReportPeople(
  supabase: Client,
  f: { personId?: string | null; teamId?: string | null; period?: Period },
): Promise<PersonRow[]> {
  const period = f.period ?? 90
  const since = new Date(Date.now() - period * 86_400_000)
  const sinceDate = since.toISOString().slice(0, 10)

  const [people, accounts, snapshot] = await Promise.all([
    peopleInScope(supabase, f),
    accountsInScope(supabase, f),
    loadWorklist(supabase, { personId: f.personId, teamId: f.teamId, includeDone: false }),
  ])
  if (!people.length) return []

  const [spans, hours, links] = await Promise.all([
    loadSpans(supabase, accounts, since),
    hoursByPerson(supabase, people.map(p => p.id), sinceDate),
    supabase.from('monday_user_links').select('monday_user_id, person_id')
      .in('person_id', people.map(p => p.id)),
  ])

  // One person can own several Monday accounts, so the spans are folded back
  // onto the directory person rather than counted per account.
  const personOf = new Map<number, string>(
    ((links.data ?? []) as { monday_user_id: number; person_id: string }[])
      .map(l => [l.monday_user_id, l.person_id]),
  )

  const spansOf = new Map<string, typeof spans>()
  for (const s of spans) {
    const pid = personOf.get(s.monday_user_id)
    if (!pid) continue
    const list = spansOf.get(pid)
    if (list) list.push(s)
    else spansOf.set(pid, [s])
  }

  const today = new Date().toISOString().slice(0, 10)
  const openOf = new Map<string, { open: number; late: number }>()
  for (const r of snapshot.rows) {
    if (r.statusDone) continue
    const pid = personOf.get(r.mondayUserId)
    if (!pid) continue
    const cur = openOf.get(pid) ?? { open: 0, late: 0 }
    cur.open++
    if (!r.dueSuspect && r.dueDate && r.dueDate < today) cur.late++
    openOf.set(pid, cur)
  }

  return people.map(p => {
    const mine = spansOf.get(p.id) ?? []
    const share = onTimeShare(mine)
    const counts = openOf.get(p.id) ?? { open: 0, late: 0 }
    const teamKey = teamKeyFromName(p.teamName)

    return {
      id: p.id,
      name: p.full_name,
      team: p.teamName,
      color: TEAM_COLOR[teamKey],
      initials: initialsOf(p.full_name),
      // Null, not zero, while there is no history for them: zero delivered is
      // a measurement and no history is not.
      delivered: mine.length || null,
      onTimePct: share.pct,
      medianHeld: median(mine.map(s => s.heldDays)),
      open: counts.open,
      late: counts.late,
      hours: hours.get(p.id) ?? null,
    }
  })
}
