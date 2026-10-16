/**
 * What every Clocky loader and action reads first, with the privileged client
 * (Clocky's tables are the server's alone, migrations 112 and 113): who is
 * asking and what they may do, the people and teams, the job codes and the
 * fields, and the company's rules.
 *
 *   renderViewer()  for a loader: the person shown, a View Stage preview
 *                   included (loadAccess), so a preview shows that level.
 *   writeViewer()   for an action: the person really signed in, after the
 *                   verified-session checks, and null during a View Stage
 *                   preview: a preview shows, it never saves (writerAccess).
 *
 * Not a "use server" file: the actions in app/(app)/clocky-hours call it.
 */

import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Db } from '@/lib/supabase/types'
import { loadAccess, writerAccess, type Access } from '@/lib/access/resolve'
import { getCurrentPerson, getRealPerson } from '@/lib/auth/session'
import { isLeadPosition, type AccessLevel } from '@/lib/access/catalogue'
import { loadSettingsFor } from '@/lib/settings/person'
import { DAILY_ZONE } from '@/lib/notifications/catalogue'
import { I7_PARENT_JOBCODE_ID } from '@/lib/tsheets/i7report'
import { loadEntryFieldKeys } from './manual-fields'
import { jobPath, shortJob } from './format'
import type { FieldKeys, FieldName } from './entry-rules'
import { isLeader, type ScopeTarget, type ScopeViewer } from './scope'
import type { AnchorChange, Cadence, CadenceChange, CadenceRules } from './periods'

type Client = Db

export const db = (): Client => createAdminClient()

/** Throws with the database's words; the actions turn it into a sentence. */
export function must<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res.data as T
}

/** Every row of a query, 1,000 at a time (PostgREST stops at 1,000 without saying so). */
export async function allRows<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>, what: string): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999)
    if (error) throw new Error(`${what}: ${error.message}`)
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < 1000) return out
  }
}

// ── People and teams ────────────────────────────────────────────────────────

export interface Person {
  id: string
  name: string
  avatarUrl: string | null
  active: boolean
  teamIds: string[]
  /** The team a person is grouped under (their primary team, else the first). */
  teamId: string | null
  /** Their own time zone (personal settings), New York by default. */
  zone: string
}

export interface Team { id: string; name: string; color: string | null; sortOrder: number }

export interface Directory {
  people: ReadonlyMap<string, Person>
  teams: ReadonlyMap<string, Team>
  /** person id -> the teams they lead */
  led: ReadonlyMap<string, ReadonlySet<string>>
  target: (personId: string) => ScopeTarget
  zoneOf: (personId: string) => string
  nameOf: (personId: string | null | undefined) => string
}

export const loadDirectory = cache(async function loadDirectory(): Promise<Directory> {
  const c = db()
  const [people, members, teams] = await Promise.all([
    allRows<{ id: string; full_name: string; avatar_url: string | null; status: string | null }>(
      (a, b) => c.from('people').select('id, full_name, avatar_url, status').order('id').range(a, b), 'People could not be read'),
    allRows<{ person_id: string; team_id: string; position: string; is_primary: boolean }>(
      (a, b) => c.from('team_members').select('person_id, team_id, position, is_primary').order('person_id').range(a, b), 'Teams could not be read'),
    c.from('teams').select('id, name, color, sort_order'),
  ])
  const teamRows = must(teams, 'Teams could not be read') as { id: string; name: string; color: string | null; sort_order: number }[]
  const settings = await loadSettingsFor(c, people.map(p => p.id))

  const teamsOf = new Map<string, string[]>()
  const primary = new Map<string, string>()
  const led = new Map<string, Set<string>>()
  for (const m of members) {
    ;(teamsOf.get(m.person_id) ?? teamsOf.set(m.person_id, []).get(m.person_id)!).push(m.team_id)
    if (m.is_primary) primary.set(m.person_id, m.team_id)
    if (isLeadPosition(m.position)) (led.get(m.person_id) ?? led.set(m.person_id, new Set()).get(m.person_id)!).add(m.team_id)
  }
  const map = new Map<string, Person>()
  for (const p of people) {
    const teamIds = teamsOf.get(p.id) ?? []
    map.set(p.id, {
      id: p.id,
      name: p.full_name,
      avatarUrl: p.avatar_url,
      active: !p.status || p.status === 'active',
      teamIds,
      teamId: primary.get(p.id) ?? teamIds[0] ?? null,
      zone: settings.get(p.id)?.timeZone ?? DAILY_ZONE,
    })
  }
  return {
    people: map,
    teams: new Map(teamRows.map(t => [t.id, { id: t.id, name: t.name, color: t.color, sortOrder: t.sort_order }])),
    led,
    target: id => ({ personId: id, teamIds: map.get(id)?.teamIds ?? [] }),
    zoneOf: id => map.get(id)?.zone ?? DAILY_ZONE,
    nameOf: id => (id ? map.get(id)?.name ?? 'Someone' : 'Clocky'),
  }
})

// ── Who is asking ───────────────────────────────────────────────────────────

export interface Viewer extends ScopeViewer {
  name: string
  level: AccessLevel
  zone: string
  leader: boolean
}

/**
 * The viewer behind an access the caller already resolved: loadAccess() for a
 * loader, writerAccess() for an action (null in a View Stage preview).
 */
export async function viewerFor(access: Access): Promise<Viewer | null> {
  return viewerFrom(access, access.personId, null)
}

async function viewerFrom(access: Access, personId: string | null, name: string | null): Promise<Viewer | null> {
  if (!personId) return null
  const dir = await loadDirectory()
  const base: ScopeViewer = {
    personId,
    can: access.can,
    isSuperAdmin: access.isSuperAdmin,
    ledTeamIds: dir.led.get(personId) ?? new Set(),
  }
  return {
    ...base,
    name: name ?? dir.nameOf(personId),
    level: access.level,
    zone: dir.zoneOf(personId),
    leader: isLeader(base),
  }
}

/** For a loader: the person on screen (a View Stage preview shows its level). */
export const renderViewer = cache(async function renderViewer(): Promise<Viewer | null> {
  const [access, me] = await Promise.all([loadAccess(), getCurrentPerson()])
  return viewerFrom(access, access.personId ?? me?.id ?? null, me?.full_name ?? null)
})

/** For an action: the person really signed in, verified; null in a View Stage preview or a lapsed session. */
export async function writeViewer(): Promise<Viewer | null> {
  const access = await writerAccess()
  if (!access) return null
  const me = await getRealPerson()
  return viewerFrom(access, access.personId ?? me?.id ?? null, me?.full_name ?? null)
}

// ── Job codes and fields ────────────────────────────────────────────────────

export interface Job {
  id: number
  name: string
  path: string
  short: string
  parentId: number | null
  /** The top folder (client) it sits under, null at the top. */
  folderId: number | null
  kind: string
  active: boolean
  isI7: boolean
  /** Has active work codes under it: a folder, not something to clock into. */
  isFolder: boolean
  /** Offered in the clock and the forms: active, work (not time off), not a folder. */
  selectable: boolean
}

export interface FieldDef { key: FieldName; id: string; label: string; options: string[]; required: 'always' | 'i7' }

export interface Catalog {
  jobs: ReadonlyMap<number, Job>
  keys: FieldKeys
  fields: FieldDef[]
  pathOf: (id: number | null | undefined) => string
}

export const loadCatalog = cache(async function loadCatalog(): Promise<Catalog> {
  const c = db()
  const [rows, keys] = await Promise.all([
    allRows<{ id: number; name: string; parent_id: number | null; external_id: number | null; kind: string; active: boolean }>(
      (a, b) => c.from('tc_jobcodes').select('id, name, parent_id, external_id, kind, active').order('id').range(a, b), 'Job codes could not be read'),
    loadEntryFieldKeys(c),
  ])
  const byId = new Map(rows.map(r => [r.id, r]))
  const children = new Map<number, typeof rows>()
  for (const r of rows) if (r.parent_id != null) (children.get(r.parent_id) ?? children.set(r.parent_id, []).get(r.parent_id)!).push(r)

  const top = (id: number): typeof rows[number] => {
    let r = byId.get(id)!
    for (let i = 0; i < 20 && r.parent_id != null && byId.has(r.parent_id); i++) r = byId.get(r.parent_id)!
    return r
  }
  const pathOfRow = (r: typeof rows[number]): string => {
    const names: string[] = [r.name]
    let cur = r
    for (let i = 0; i < 20 && cur.parent_id != null && byId.has(cur.parent_id); i++) { cur = byId.get(cur.parent_id)!; names.unshift(cur.name) }
    return names.length === 1 ? names[0] : jobPath(names.slice(1).join(' › '), names[0])
  }

  const jobs = new Map<number, Job>()
  for (const r of rows) {
    const root = top(r.id)
    const isFolder = (children.get(r.id) ?? []).some(k => k.active && k.kind === 'regular')
    const path = pathOfRow(r)
    jobs.set(r.id, {
      id: r.id,
      name: r.name,
      path,
      short: shortJob(path),
      parentId: r.parent_id,
      folderId: root.id === r.id ? null : root.id,
      kind: r.kind,
      active: r.active,
      isI7: root.external_id === I7_PARENT_JOBCODE_ID,
      isFolder,
      selectable: r.active && r.kind === 'regular' && !isFolder,
    })
  }

  // The five fields the entry form asks, with their options, in the design's order.
  const order: [FieldName, 'always' | 'i7'][] = [['company', 'always'], ['project', 'always'], ['activity', 'always'], ['billable', 'always'], ['code', 'i7']]
  const ids = order.map(([k]) => keys[k]).filter((x): x is string => !!x).map(Number)
  const [fieldRows, optionRows] = ids.length
    ? await Promise.all([
      c.from('tc_fields').select('id, name').in('id', ids),
      allRows<{ field_id: number; label: string; position: number }>(
        (a, b) => c.from('tc_field_options').select('field_id, label, position').in('field_id', ids).eq('active', true)
          .order('field_id').order('position').order('label').range(a, b), 'Field options could not be read'),
    ])
    : [{ data: [], error: null }, []]
  const names = new Map(((must(fieldRows as { data: { id: number; name: string }[] | null; error: { message: string } | null }, 'Fields could not be read')) ?? []).map(f => [String(f.id), f.name]))
  const fields: FieldDef[] = []
  for (const [k, required] of order) {
    const id = keys[k]
    if (!id) continue
    fields.push({
      key: k, id, required,
      label: names.get(id) ?? k,
      options: optionRows.filter(o => String(o.field_id) === id).map(o => o.label),
    })
  }

  return { jobs, keys, fields, pathOf: id => (id != null ? jobs.get(id)?.path ?? '' : '') }
})

// ── The company's rules ─────────────────────────────────────────────────────

export interface ClockySettings {
  companyZone: string
  /** 0 = Sunday, as QuickBooks Time had it. */
  weekStart: number
  defaultCadence: Cadence
  anchor: string | null
  anchors: AnchorChange[]
}

export const loadClockySettings = cache(async function loadClockySettings(): Promise<ClockySettings> {
  const c = db()
  const [s, a] = await Promise.all([
    c.from('tc_settings').select('timezone, week_start, default_cadence, pay_period_anchor').eq('singleton_id', 1).maybeSingle(),
    c.from('tc_pay_period_anchors').select('anchor, effective_from').order('effective_from', { ascending: true, nullsFirst: true }),
  ])
  const row = must(s, 'The clock rules could not be read') as { timezone: string; week_start: number; default_cadence: string; pay_period_anchor: string | null } | null
  const anchors = (must(a, 'The pay period start could not be read') ?? []) as { anchor: string; effective_from: string | null }[]
  const history: AnchorChange[] = anchors.map(r => ({ anchor: r.anchor, effectiveFrom: r.effective_from }))
  // The setting alone, before any move was recorded.
  if (!history.length && row?.pay_period_anchor) history.push({ anchor: row.pay_period_anchor, effectiveFrom: null })
  return {
    companyZone: row?.timezone ?? DAILY_ZONE,
    weekStart: row?.week_start ?? 0,
    defaultCadence: row?.default_cadence === 'biweekly' ? 'biweekly' : 'monthly',
    anchor: row?.pay_period_anchor ?? null,
    anchors: history,
  }
})

/** Each person's cadence changes (tc_person_cadence), for the period rules. */
export async function loadCadenceChanges(c: Client, personIds?: readonly string[]): Promise<Map<string, CadenceChange[]>> {
  const rows = await allRows<{ person_id: string; cadence: string; effective_from: string; one_period: boolean }>(
    (a, b) => {
      let q = c.from('tc_person_cadence').select('person_id, cadence, effective_from, one_period').order('person_id').order('effective_from')
      if (personIds) q = q.in('person_id', personIds as string[])
      return q.range(a, b)
    }, 'How people submit could not be read')
  const out = new Map<string, CadenceChange[]>()
  for (const r of rows) {
    ;(out.get(r.person_id) ?? out.set(r.person_id, []).get(r.person_id)!).push({
      cadence: r.cadence === 'biweekly' ? 'biweekly' : 'monthly', effectiveFrom: r.effective_from, onePeriod: r.one_period,
    })
  }
  return out
}

/** The period rules for one person. */
export function rulesFor(personId: string, changes: ReadonlyMap<string, CadenceChange[]>, s: ClockySettings): CadenceRules {
  return { changes: changes.get(personId) ?? [], fallback: s.defaultCadence, anchors: s.anchors }
}
