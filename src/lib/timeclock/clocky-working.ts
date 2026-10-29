/**
 * Who's working (design handoff of 16 October 2026, SPEC section 7, Who's
 * Working.dc.html frames 2A to 2P): the people in the viewer's scope (a Team
 * Leader's teams; everyone for Admins and Super Admins), each with their local
 * time zone, the entry running now and when its timer started, the day and
 * week totals on the quarter hour, whether they are past 4h 30m since they
 * clocked in, an automatic stop today, and who clocked them out.
 *
 * Not a "use server" file: app/(app)/clocky-hours/whos-working/actions.ts serves it.
 */

import { allRows, db, loadCatalog, loadClockySettings, loadDirectory, shownActivity, type Viewer } from './clocky-context'
import type { EntryRow } from './clocky-store'
import { entrySeconds } from './clocky-panel'
import { dayLabel, initials, localDate, monthLong, timeLabel, weekdayShort, zoneAbbr } from './format'
import { formatDuration } from './rounding'
import { loadPayTerms } from './pay-terms'
import { loadAllowanceUse, loadApprovedExtra } from './allowance-data'
import { weekBounds } from './clock'
import { addDays, daysBetween } from './periods'
import { WARN_AFTER_SECONDS, sessionStart } from './safety'
import { canClockOutFor, canSeeWorking, seesEveryone } from './scope'
import type { WhosWorkingData, WorkingPerson } from './clocky-types'

/** Everyone the viewer sees in Who's working (active people only). */
export async function workingScope(v: Viewer): Promise<string[]> {
  const dir = await loadDirectory()
  return [...dir.people.values()].filter(p => p.active && canSeeWorking(v, dir.target(p.id))).map(p => p.id)
}

/** The badge on the top-bar icon: people on the clock in the viewer's scope (0 shows no badge). */
export async function countOnTheClock(v: Viewer): Promise<number> {
  if (!v.can('ck-whos-working')) return 0
  const ids = new Set(await workingScope(v))
  const rows = await allRows<{ person_id: string }>((a, b) => db().from('tc_entries').select('person_id')
    .eq('kind', 'clock').is('ended_at', null).order('id').range(a, b), 'The running clocks could not be read')
  return new Set(rows.map(r => r.person_id).filter(id => ids.has(id))).size
}

export async function loadWhosWorking(v: Viewer, now: Date): Promise<WhosWorkingData> {
  const c = db()
  const [dir, catalog, settings] = await Promise.all([loadDirectory(), loadCatalog(), loadClockySettings()])
  const ids = await workingScope(v)
  // Each person's week, in their own zone: read from the earliest such week.
  const todays = new Map(ids.map(id => [id, localDate(now, dir.zoneOf(id))]))
  const weeks = new Map(ids.map(id => [id, weekBounds(todays.get(id)!, settings.weekStart)]))
  const from = [...weeks.values()].reduce((m, w) => (w.start < m ? w.start : m), localDate(now, v.zone))
  const lookBack = addDays(from, -14)

  const [entries, running, kept] = ids.length ? await Promise.all([
    allRows<EntryRow>((a, b) => c.from('tc_entries').select('*').in('person_id', ids).gte('entry_date', lookBack)
      .order('entry_date').order('id').range(a, b), 'Entries could not be read'),
    allRows<EntryRow>((a, b) => c.from('tc_entries').select('*').in('person_id', ids).eq('kind', 'clock').is('ended_at', null)
      .order('id').range(a, b), 'The running clocks could not be read'),
    allRows<{ person_id: string; at: string }>((a, b) => c.from('tc_safety_events').select('person_id, at').in('person_id', ids)
      .eq('kind', 'keep_going').gte('at', new Date(now.getTime() - 2 * 86_400_000).toISOString()).order('at').range(a, b), 'Clock safety could not be read'),
  ]) : [[], [], []]

  // Over the hours allowance without approval (Clocky part 2, Who's Working.dc.html "Over").
  const terms = ids.length ? await loadPayTerms(ids) : new Map()
  const today = localDate(now, v.zone)
  const allowance = ids.length ? await loadAllowanceUse(terms, now, await loadApprovedExtra(ids, addDays(today, -40), addDays(today, 40))) : new Map()

  const people: WorkingPerson[] = ids.map(id => {
    const p = dir.people.get(id)!
    const zone = p.zone
    const today = todays.get(id)!
    const week = weeks.get(id)!
    const mine = entries.filter(e => e.person_id === id && e.kind !== 'absence')
    const run = running.find(e => e.person_id === id) ?? null
    const day = mine.filter(e => e.entry_date === today).reduce((s, e) => s + entrySeconds(e, now), 0)
    const wk = mine.filter(e => e.entry_date >= week.start && e.entry_date <= week.end).reduce((s, e) => s + entrySeconds(e, now), 0)
    const session = run ? sessionStart(run) : null
    const over = !!session && (now.getTime() - Date.parse(session)) / 1000 >= WARN_AFTER_SECONDS
    const keptAt = session ? kept.filter(k => k.person_id === id && k.at >= session).map(k => k.at).pop() ?? null : null
    const auto = mine.filter(e => e.entry_date === today && e.auto_stopped_at).pop()
    const outBy = mine.filter(e => e.entry_date === today && e.clocked_out_by).pop()
    const lastClosed = mine.filter(e => e.ended_at).sort((a, b) => (a.ended_at! < b.ended_at! ? -1 : 1)).pop()
    let lastOut: string | null = null
    if (!run && lastClosed?.ended_at) {
      const d = localDate(lastClosed.ended_at, zone)
      const t = timeLabel(lastClosed.ended_at, zone)
      lastOut = d === today ? t : daysBetween(d, today) < 7 ? `${weekdayShort(d)}, ${t}` : dayLabel(d)
    }
    const team = p.teamId ? dir.teams.get(p.teamId) : undefined
    const fields = (run?.fields ?? {}) as Record<string, string>
    return {
      personId: id,
      name: p.name,
      initials: initials(p.name),
      avatarUrl: p.avatarUrl,
      team: team ? { id: team.id, name: team.name, color: team.color } : null,
      zone,
      zoneAbbr: zoneAbbr(zone, now),
      status: run ? 'on' : 'off',
      autoOutToday: auto ? { at: auto.auto_stopped_at! } : null,
      clockedOutBy: outBy ? { name: dir.nameOf(outBy.clocked_out_by), reason: null } : null,
      current: run && run.started_at ? {
        entryId: run.id,
        path: catalog.pathOf(run.jobcode_id),
        activity: shownActivity(catalog, catalog.jobs.get(run.jobcode_id ?? -1), fields, run.entry_date),
        timerFrom: run.started_at_real ?? run.started_at,
        startedAt: run.started_at,
        sessionStartedAt: session,
      } : null,
      lastOut,
      daySeconds: day,
      weekSeconds: wk,
      over,
      allowanceOver: (() => {
        const u = allowance.get(id)
        if (!u || u.over <= 0) return null
        const extra = u.limit - u.hours * 3600
        return `Over the allowance without approval: ${formatDuration(u.used)} of ${u.hours}h ${u.period === 'month' ? `in ${monthLong(u.from)}` : 'this week'}${extra > 0 ? ` (${formatDuration(extra)} approved in advance)` : ''}`
      })(),
      keptGoingAt: keptAt,
      canClockOut: !!run && canClockOutFor(v, dir.target(id)),
    }
  })

  // The reason a Super Admin gave when they clocked someone out, from the trail.
  const outIds = people.filter(p => p.clockedOutBy).map(p => p.personId)
  if (outIds.length) {
    const entryIds = entries.filter(e => outIds.includes(e.person_id) && e.clocked_out_by).map(e => e.id)
    if (entryIds.length) {
      const { data } = await c.from('tc_entry_audit').select('entry_id, reason').eq('action', 'clocked_out_for').in('entry_id', entryIds)
      const reasons = new Map(((data ?? []) as { entry_id: number; reason: string | null }[]).map(r => [r.entry_id, r.reason]))
      for (const p of people) {
        if (!p.clockedOutBy) continue
        const e = entries.filter(x => x.person_id === p.personId && x.clocked_out_by && x.entry_date === todays.get(p.personId)).pop()
        if (e) p.clockedOutBy.reason = reasons.get(e.id) ?? null
      }
    }
  }

  const led = [...v.ledTeamIds].map(id => dir.teams.get(id)?.name).filter((n): n is string => !!n).sort()
  return {
    viewer: { zone: v.zone, zoneAbbr: zoneAbbr(v.zone, now), scope: seesEveryone(v) ? 'all' : 'team', teamNames: led },
    now: now.toISOString(),
    onTheClock: people.filter(p => p.status === 'on').length,
    people: people.sort((a, b) => a.name.localeCompare(b.name)),
  }
}
