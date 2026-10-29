/**
 * North Time rollout, read from the database (migration 129): the two waves'
 * dates, the people moved by hand, and each person's start date, decided by
 * the pure rules in waves.ts. Server only (the tables are closed to sessions).
 *
 * Until migration 129 runs, the tables are missing and every reader answers
 * "no dates": nothing changes, as with dates not set.
 */

import type { Db } from '@/lib/supabase/types'
import { missingTable } from '@/lib/supabase/errors'
import { loadSubjects } from '@/lib/access/store'
import { LEVEL_LABEL, type AccessLevel } from '@/lib/access/catalogue'
import { NO_DATES, personWave, type Wave, type WaveDates } from './waves'
import { northTimeOpen } from './north-time-lock'

/** The two dates. A missing table is "not set"; any other failed read throws (an unread date is not "no date"). */
export async function loadWaveDates(c: Db): Promise<WaveDates> {
  const { data, error } = await c.from('tc_rollout_waves').select('wave, starts_on')
  if (error) {
    if (missingTable(error)) return NO_DATES
    throw new Error(`The North Time rollout dates could not be read: ${error.message}`)
  }
  const out: WaveDates = { 1: null, 2: null }
  for (const r of (data ?? []) as { wave: number; starts_on: string | null }[]) if (r.wave === 1 || r.wave === 2) out[r.wave] = r.starts_on
  return out
}

/** person id -> the wave a Super Admin moved them to. */
export async function loadWaveOverrides(c: Db, personId?: string): Promise<Map<string, Wave>> {
  let q = c.from('tc_rollout_people').select('person_id, wave')
  if (personId) q = q.eq('person_id', personId)
  const { data, error } = await q.limit(5000)
  if (error) {
    if (missingTable(error)) return new Map()
    throw new Error(`The North Time rollout people could not be read: ${error.message}`)
  }
  return new Map(((data ?? []) as { person_id: string; wave: number }[])
    .filter(r => r.wave === 1 || r.wave === 2).map(r => [r.person_id, r.wave as Wave]))
}

/** One person's start date, for the clock: their level from the caller, their override and the dates from here. */
export async function startDateOf(c: Db, personId: string, who: { level: AccessLevel; leader?: boolean }): Promise<string | null> {
  const dates = await loadWaveDates(c)
  if (!dates[1] && !dates[2]) return null
  const override = (await loadWaveOverrides(c, personId)).get(personId) ?? null
  return personWave(who, override, dates).startsOn
}

export interface RolloutPerson {
  id: string
  name: string
  level: AccessLevel
  levelLabel: string
  wave: Wave
  by: 'level' | 'hand'
  startsOn: string | null
}

/** Everyone active, each with their wave and start date. Sorted by name. */
export async function loadRolloutPeople(c: Db, dates?: WaveDates): Promise<RolloutPerson[]> {
  const [d, overrides, subjects] = await Promise.all([dates ?? loadWaveDates(c), loadWaveOverrides(c), loadSubjects(c)])
  return subjects.map(s => {
    const leader = [...s.teams.values()].some(Boolean)
    const w = personWave({ level: s.level, leader }, overrides.get(s.id) ?? null, d)
    return { id: s.id, name: s.name, level: s.level, levelLabel: LEVEL_LABEL[s.level], ...w }
  }).sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * person id -> start date, for everyone with one. Empty while no date is set,
 * without reading anyone (the import calls it on every run).
 */
export async function loadStartDates(c: Db): Promise<Map<string, string>> {
  // While North Time is closed nobody has started: the import keeps every TSheets entry.
  if (!(await northTimeOpen())) return new Map()
  const dates = await loadWaveDates(c)
  if (!dates[1] && !dates[2]) return new Map()
  const people = await loadRolloutPeople(c, dates)
  return new Map(people.filter(p => p.startsOn).map(p => [p.id, p.startsOn!]))
}

// ── Company settings > North Time rollout ───────────────────────────────────

export interface RolloutData {
  dates: WaveDates
  people: RolloutPerson[]
  /** TSheets entries set aside and not decided yet. */
  setAside: number
  /** Whether migration 129 has run (the tables exist). */
  ready: boolean
}

export async function loadRolloutData(c: Db): Promise<RolloutData> {
  const probe = await c.from('tc_rollout_waves').select('wave').limit(1)
  const ready = !(probe.error && missingTable(probe.error))
  const dates = await loadWaveDates(c)
  const [people, aside] = await Promise.all([
    loadRolloutPeople(c, dates),
    ready ? c.from('tc_import_skipped').select('external_id', { count: 'exact', head: true }).is('decided_at', null) : null,
  ])
  if (aside?.error && !missingTable(aside.error)) throw new Error(`The entries set aside could not be counted: ${aside.error.message}`)
  return { dates, people, setAside: aside?.count ?? 0, ready }
}

// ── Clocked in TSheets after switching ──────────────────────────────────────

export interface SkippedEntry {
  externalId: number
  personId: string
  name: string
  date: string
  startsOn: string
  seconds: number
  startedAt: string | null
  endedAt: string | null
  jobPath: string | null
  kind: string | null
  state: string | null
  notes: string | null
  /** field label and value */
  fields: { label: string; value: string }[]
  alreadyInEntries: boolean
  deletedInTsheets: boolean
  firstSeenAt: string
  decision: string | null
  decidedAt: string | null
  decidedByName: string | null
  decisionReason: string | null
}

type SkippedRow = {
  external_id: number; person_id: string; entry_date: string; starts_on: string; duration_seconds: number
  started_at: string | null; ended_at: string | null; job_path: string | null; kind: string | null; state: string | null
  notes: string | null; fields: unknown; already_in_entries: boolean; deleted_in_tsheets_at: string | null
  first_seen_at: string; decision: string | null; decided_at: string | null; decided_by: string | null; decision_reason?: string | null
}

/** Every entry set aside, newest day first, with the person's name and the fields by label. Empty before migration 129. */
export async function loadSkippedEntries(c: Db): Promise<SkippedEntry[]> {
  const rows: SkippedRow[] = []
  const BASE = 'external_id, person_id, entry_date, starts_on, duration_seconds, started_at, ended_at, job_path, kind, state, notes, fields, already_in_entries, deleted_in_tsheets_at, first_seen_at, decision, decided_at, decided_by'
  // decision_reason arrives with migration 130: until it runs, read without it.
  let columns = `${BASE}, decision_reason`
  for (let from = 0; ; from += 1000) {
    let res = await c.from('tc_import_skipped').select(columns)
      .order('entry_date', { ascending: false }).order('external_id', { ascending: false }).range(from, from + 999)
    if (res.error && columns !== BASE && /decision_reason/.test(res.error.message)) {
      columns = BASE
      res = await c.from('tc_import_skipped').select(columns)
        .order('entry_date', { ascending: false }).order('external_id', { ascending: false }).range(from, from + 999)
    }
    const { data, error } = res
    if (error) {
      if (missingTable(error)) return []
      throw new Error(`The entries set aside could not be read: ${error.message}`)
    }
    const page = (data ?? []) as unknown as SkippedRow[]
    rows.push(...page)
    if (page.length < 1000) break
  }
  if (!rows.length) return []
  const ids = [...new Set(rows.flatMap(r => [r.person_id, r.decided_by].filter((x): x is string => !!x)))]
  const [people, fieldDefs] = await Promise.all([
    c.from('people').select('id, full_name').in('id', ids),
    c.from('tc_fields').select('id, name'),
  ])
  if (people.error) throw new Error(`People could not be read: ${people.error.message}`)
  const nameOf = new Map(((people.data ?? []) as { id: string; full_name: string }[]).map(p => [p.id, p.full_name]))
  const labelOf = new Map(((fieldDefs.data ?? []) as { id: number; name: string }[]).map(f => [String(f.id), f.name]))
  return rows.map(r => ({
    externalId: r.external_id,
    personId: r.person_id,
    name: nameOf.get(r.person_id) ?? 'Someone',
    date: r.entry_date,
    startsOn: r.starts_on,
    seconds: r.duration_seconds,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    jobPath: r.job_path,
    kind: r.kind,
    state: r.state,
    notes: r.notes,
    fields: Object.entries((r.fields ?? {}) as Record<string, unknown>)
      .filter(([, v]) => typeof v === 'string' && !!v)
      .map(([k, v]) => ({ label: labelOf.get(k) ?? `Field ${k}`, value: v as string })),
    alreadyInEntries: r.already_in_entries,
    deletedInTsheets: !!r.deleted_in_tsheets_at,
    firstSeenAt: r.first_seen_at,
    decision: r.decision,
    decidedAt: r.decided_at,
    decidedByName: r.decided_by ? nameOf.get(r.decided_by) ?? null : null,
    decisionReason: r.decision_reason ?? null,
  }))
}
