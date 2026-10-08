'use server'

/**
 * Admin > Access levels (7 October 2026): every write of the access model.
 * Super Admin only, checked against the Auth server on each call (allowedTo),
 * and refused during a View Stage preview.
 *
 *   saveAccessChanges   ticks per level and team lists per tool, saved together
 *                       with one reason; the impact (who gains, who loses) is
 *                       worked out HERE from the saved rules, never taken from
 *                       the browser, and kept in the log with the change.
 *   setPersonLevel      Super Admin, Admin, or automatic. Always at least two
 *                       Super Admins. profiles.role follows, for the database's
 *                       row-level policies.
 *   addException        one person, one item, until a date.
 *   endException        ends one early.
 *   undoChange          writes the opposite of a logged change, as a new change
 *                       with its own reason, pointing at the one it reverses.
 *   setPriorityGrant    team priority on My Work, by name.
 *
 * Writes use the privileged client: the access tables are closed to the
 * signed-in role (migration 094).
 */

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadCurrentPerson } from '@/lib/directory/current-person'
import { isSuperAdmin } from '@/lib/access/resolve'
import { CONFIGURABLE, ITEM, LEVEL_LABEL, isConfigurable, type ConfigurableLevel } from '@/lib/access/catalogue'
import { allowedKeys, impact, overlay, ruleKey, type Audience, type ToolScope } from '@/lib/access/decide'
import { loadRules, loadSubjects, loadTeamNames } from '@/lib/access/store'
import { logChange } from '@/lib/access/log'
import { zoneDate } from '@/lib/notifications/schedule'
import { isGrantScope } from '@/lib/monday/worklist/team-priority'

type Result = { ok: true; id?: number | null } | { ok: false; error: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const today = () => zoneDate(new Date())

/** The Super Admin making the change, or why not. */
async function actor(): Promise<{ personId: string | null; profileId: string; name: string } | { error: string }> {
  if (!(await isSuperAdmin())) return { error: 'Only a Super Admin can change access.' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You are signed out. Sign in again to save.' }
  const me = await loadCurrentPerson(supabase, user, { real: true })
  return { personId: me?.id ?? null, profileId: user.id, name: me?.full_name ?? 'A Super Admin' }
}

const cleanReason = (r: unknown): string | null => {
  const s = typeof r === 'string' ? r.trim() : ''
  return s.length >= 8 && s.length <= 2000 ? s : null
}

function refresh() {
  revalidatePath('/admin/access-levels')
  // The rail and every guarded page read the rules.
  revalidatePath('/', 'layout')
}

/** Super Admins hear about it (notification "Access rules were changed"), after the answer is sent. */
function tellSuperAdmins(changeId: number | null, summary: string, reason: string, actorId: string | null) {
  if (!changeId) return
  after(async () => {
    const { notifyAccessChange } = await import('@/lib/notifications/run')
    await notifyAccessChange({ changeId, summary, reason, actorPersonId: actorId })
  })
}

// ── Ticks and team lists ────────────────────────────────────────────────────

export interface LevelChange { level: ConfigurableLevel; key: string; allowed: boolean }
export interface ToolChange { key: string; every: boolean; teams: { teamId: string; audience: Audience }[] }

const scopeJson = (s: ToolScope | undefined) => (s ? { every: s.every, teams: Object.fromEntries(s.teams) } : null)

async function applyRules(db: ReturnType<typeof createAdminClient>, levels: readonly LevelChange[], tools: readonly ToolChange[], defaults: { level: ConfigurableLevel; key: string }[] = []) {
  if (levels.length) {
    const { error } = await db.from('access_rules').upsert(
      levels.map(c => ({ level: c.level, item_key: c.key, allowed: c.allowed, updated_at: new Date().toISOString() })),
      { onConflict: 'level,item_key' },
    )
    if (error) throw new Error(error.message)
  }
  for (const d of defaults) {
    await db.from('access_rules').delete().eq('level', d.level).eq('item_key', d.key)
  }
  for (const t of tools) {
    const { error: e1 } = await db.from('access_tool_scope').upsert({ item_key: t.key, every_team: t.every, updated_at: new Date().toISOString() }, { onConflict: 'item_key' })
    if (e1) throw new Error(e1.message)
    const { error: e2 } = await db.from('access_tool_teams').delete().eq('item_key', t.key)
    if (e2) throw new Error(e2.message)
    if (!t.every && t.teams.length) {
      const { error: e3 } = await db.from('access_tool_teams').insert(t.teams.map(x => ({ item_key: t.key, team_id: x.teamId, audience: x.audience })))
      if (e3) throw new Error(e3.message)
    }
  }
}

export async function saveAccessChanges(input: { levels: LevelChange[]; tools: ToolChange[]; reason: string }): Promise<Result> {
  const who = await actor()
  if ('error' in who) return { ok: false, error: who.error }
  const reason = cleanReason(input.reason)
  if (!reason) return { ok: false, error: 'Say why, in a sentence (at least 8 characters).' }

  const levels = (Array.isArray(input.levels) ? input.levels : []).filter(c =>
    CONFIGURABLE.includes(c.level) && typeof c.allowed === 'boolean' && !!ITEM.get(c.key) && isConfigurable(ITEM.get(c.key)!))
  const tools = (Array.isArray(input.tools) ? input.tools : []).filter(t =>
    ITEM.get(t.key)?.kind === 'tool' && typeof t.every === 'boolean' && Array.isArray(t.teams)
    && t.teams.every(x => UUID.test(x.teamId) && (x.audience === 'team' || x.audience === 'lead')))
  if (!levels.length && !tools.length) return { ok: false, error: 'There is nothing to save.' }

  const db = createAdminClient()
  const [before, people, teamNames] = await Promise.all([loadRules(db), loadSubjects(db), loadTeamNames(db)])
  const after_ = overlay(before,
    new Map(levels.map(c => [ruleKey(c.level, c.key), c.allowed])),
    new Map(tools.map(t => [t.key, { every: t.every, teams: new Map(t.teams.map(x => [x.teamId, x.audience])) }])))
  const rows = impact(people, before, after_, { today: today() })
  const nameOf = new Map(people.map(p => [p.id, p.name]))

  try {
    await applyRules(db, levels, tools)
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  const changes = [
    ...levels.map(c => ({ kind: 'rule', level: c.level, key: c.key, label: ITEM.get(c.key)!.label, before: before.levels.get(ruleKey(c.level, c.key)) ?? null, beforeEffective: before.levels.get(ruleKey(c.level, c.key)) ?? ITEM.get(c.key)!.defaults?.[c.level] ?? false, after: c.allowed })),
    ...tools.map(t => ({ kind: 'tool', key: t.key, label: ITEM.get(t.key)!.label, before: scopeJson(before.tools.get(t.key)), after: { every: t.every, teams: Object.fromEntries(t.teams.map(x => [x.teamId, x.audience])) }, teamNames: Object.fromEntries(t.teams.map(x => [x.teamId, teamNames.get(x.teamId) ?? 'Team'])) })),
  ]
  const n = changes.length
  const summary = n === 1
    ? (levels[0] ? `${LEVEL_LABEL[levels[0].level]}: ${ITEM.get(levels[0].key)!.label} ${levels[0].allowed ? 'on' : 'off'}` : `Teams for ${ITEM.get(tools[0].key)!.label}`)
    : `${n} changes to permissions`
  const id = await logChange(db, {
    actorId: who.personId, kind: tools.length && !levels.length ? 'tool-teams' : 'rules', summary, reason, changes,
    impact: rows.map(r => ({ person: nameOf.get(r.personId) ?? 'Someone', gained: r.gained, lost: r.lost })),
  })
  tellSuperAdmins(id, summary, reason, who.personId)
  refresh()
  return { ok: true, id }
}

// ── Levels ──────────────────────────────────────────────────────────────────

/** The account behind a person: the explicit link, else a mailbox matching a profile. */
async function profileOf(db: ReturnType<typeof createAdminClient>, personId: string): Promise<string | null> {
  const { data: p } = await db.from('people').select('profile_id, email_true_north, email_goodnews, email_coe, email_personal').eq('id', personId).maybeSingle()
  if (!p) return null
  const row = p as { profile_id: string | null; email_true_north: string | null; email_goodnews: string | null; email_coe: string | null; email_personal: string | null }
  if (row.profile_id) return row.profile_id
  const emails = [row.email_true_north, row.email_goodnews, row.email_coe, row.email_personal].map(e => (e ?? '').trim().toLowerCase()).filter(Boolean)
  if (!emails.length) return null
  const { data: profiles } = await db.from('profiles').select('id, email')
  return ((profiles ?? []) as { id: string; email: string | null }[]).find(x => emails.includes((x.email ?? '').trim().toLowerCase()))?.id ?? null
}

export async function setPersonLevel(personId: string, level: 'super_admin' | 'admin' | null, reasonIn: string, opts: { undoes?: number } = {}): Promise<Result> {
  const who = await actor()
  if ('error' in who) return { ok: false, error: who.error }
  const reason = cleanReason(reasonIn)
  if (!reason) return { ok: false, error: 'Say why, in a sentence (at least 8 characters).' }
  if (typeof personId !== 'string' || !UUID.test(personId)) return { ok: false, error: 'Unknown person.' }
  if (level !== null && level !== 'super_admin' && level !== 'admin') return { ok: false, error: 'Unknown level.' }

  const db = createAdminClient()
  const [before, people] = await Promise.all([loadRules(db), loadSubjects(db)])
  const person = people.find(p => p.id === personId)
  if (!person) return { ok: false, error: 'That person is not active in the Directory.' }
  if (person.given === level) return { ok: false, error: 'That is already their level.' }
  const supers = people.filter(p => p.given === 'super_admin')
  if (person.given === 'super_admin' && level !== 'super_admin' && supers.length <= 2) {
    return { ok: false, error: 'There must always be at least two Super Admins. Make someone else a Super Admin first.' }
  }

  const { error } = await db.from('people').update({ access_level: level }).eq('id', personId)
  if (error) return { ok: false, error: error.message }
  const profileId = await profileOf(db, personId)
  if (profileId) await db.from('profiles').update({ role: level ? 'admin' : 'viewer' }).eq('id', profileId)

  const fromLevel = person.level
  const now = (await loadSubjects(db)).find(p => p.id === personId)
  const toLevel = now?.level ?? fromLevel
  // What the move opens and closes for them, under the same rules.
  const o = { today: today() }
  const was = allowedKeys(person, before, o)
  const is = now ? allowedKeys(now, before, o) : was
  const gained = [...is].filter(k => !was.has(k) && ITEM.get(k)?.kind !== 'module')
  const lost = [...was].filter(k => !is.has(k) && ITEM.get(k)?.kind !== 'module')
  const summary = `${person.name}: ${LEVEL_LABEL[fromLevel]} → ${LEVEL_LABEL[toLevel]}`
  const id = await logChange(db, {
    actorId: who.personId, kind: opts.undoes ? 'undo' : 'level', summary, reason, undoes: opts.undoes ?? null,
    changes: [{ kind: 'level', personId, person: person.name, before: person.given, after: level, from: fromLevel, to: toLevel }],
    impact: gained.length || lost.length ? [{ person: person.name, gained, lost }] : [],
  })
  if (opts.undoes && id) await db.from('access_changes').update({ undone_by: id }).eq('id', opts.undoes)
  after(async () => {
    const { notifyLevelChange } = await import('@/lib/notifications/run')
    await notifyLevelChange({ personId, name: person.name, from: fromLevel, to: toLevel, actorProfileId: who.profileId })
  })
  tellSuperAdmins(id, summary, reason, who.personId)
  refresh()
  revalidatePath('/directory')
  return { ok: true, id }
}

// ── Exceptions ──────────────────────────────────────────────────────────────

export async function addException(input: { personId: string; key: string; effect: 'grant' | 'deny'; until: string | null; reason: string }): Promise<Result> {
  const who = await actor()
  if ('error' in who) return { ok: false, error: who.error }
  const reason = cleanReason(input.reason)
  if (!reason) return { ok: false, error: 'Say why, in a sentence (at least 8 characters).' }
  const item = ITEM.get(input.key)
  if (!item || item.kind === 'module' || item.superOnly || item.always) return { ok: false, error: 'That item cannot have an exception.' }
  if (!UUID.test(input.personId)) return { ok: false, error: 'Unknown person.' }
  if (input.effect !== 'grant' && input.effect !== 'deny') return { ok: false, error: 'Choose open or closed.' }
  if (input.until !== null && !/^\d{4}-\d{2}-\d{2}$/.test(input.until)) return { ok: false, error: 'That date could not be read.' }
  if (input.until && input.until < today()) return { ok: false, error: 'The end date has already passed.' }

  const db = createAdminClient()
  const { data: p } = await db.from('people').select('full_name').eq('id', input.personId).maybeSingle()
  if (!p) return { ok: false, error: 'Unknown person.' }
  const name = (p as { full_name: string }).full_name
  const { data, error } = await db.from('access_exceptions').insert({
    person_id: input.personId, item_key: input.key, effect: input.effect, until: input.until, reason, created_by: who.personId,
  }).select('id').single()
  if (error) return { ok: false, error: error.message }
  const summary = `Exception for ${name}: ${item.label} ${input.effect === 'grant' ? 'open' : 'closed'}${input.until ? ` until ${input.until}` : ''}`
  const id = await logChange(db, {
    actorId: who.personId, kind: 'exception', summary, reason,
    changes: [{ kind: 'exception-add', exceptionId: (data as { id: string }).id, person: name, key: input.key, label: item.label, effect: input.effect, until: input.until }],
  })
  tellSuperAdmins(id, summary, reason, who.personId)
  refresh()
  return { ok: true, id }
}

export async function endException(exceptionId: string, reasonIn: string, opts: { undoes?: number } = {}): Promise<Result> {
  const who = await actor()
  if ('error' in who) return { ok: false, error: who.error }
  const reason = cleanReason(reasonIn)
  if (!reason) return { ok: false, error: 'Say why, in a sentence (at least 8 characters).' }
  if (!UUID.test(exceptionId)) return { ok: false, error: 'Unknown exception.' }
  const db = createAdminClient()
  const { data: ex } = await db.from('access_exceptions').select('id, person_id, item_key, effect, ended_at').eq('id', exceptionId).maybeSingle()
  const row = ex as { id: string; person_id: string; item_key: string; effect: string; ended_at: string | null } | null
  if (!row || row.ended_at) return { ok: false, error: 'That exception has already ended.' }
  const { error: endError } = await db.from('access_exceptions').update({ ended_at: new Date().toISOString(), ended_by: who.personId }).eq('id', exceptionId)
  if (endError) return { ok: false, error: 'The exception could not be ended. Nothing changed; try again.' }
  const { data: p } = await db.from('people').select('full_name').eq('id', row.person_id).maybeSingle()
  const name = (p as { full_name: string } | null)?.full_name ?? 'Someone'
  const summary = `Exception ended for ${name}: ${ITEM.get(row.item_key)?.label ?? row.item_key}`
  const id = await logChange(db, {
    actorId: who.personId, kind: opts.undoes ? 'undo' : 'exception', summary, reason, undoes: opts.undoes ?? null,
    changes: [{ kind: 'exception-end', exceptionId, person: name, key: row.item_key, label: ITEM.get(row.item_key)?.label ?? row.item_key }],
  })
  if (opts.undoes && id) await db.from('access_changes').update({ undone_by: id }).eq('id', opts.undoes).is('undone_by', null)
  // Ending one is told to the Super Admins, as adding one is (decided 8 October 2026).
  tellSuperAdmins(id, summary, reason, who.personId)
  refresh()
  return { ok: true, id }
}

// ── Undo ────────────────────────────────────────────────────────────────────

/**
 * What a logged change touched, as comparable keys: a level's tick on an item,
 * a tool's team list, a person's level, one exception. Two log entries that
 * share a key changed the same thing.
 */
function touchKeys(c: unknown): string[] {
  const x = c as { kind?: string; level?: string; key?: string; personId?: string; exceptionId?: string } | null
  if (!x?.kind) return []
  if (x.kind === 'rule' && x.level && x.key) return [`rule:${x.level}|${x.key}`]
  if (x.kind === 'tool' && x.key) return [`tool:${x.key}`]
  if (x.kind === 'level' && x.personId) return [`level:${x.personId}`]
  if (x.exceptionId) return [`exception:${x.exceptionId}`]
  return []
}

type Logged =
  | { kind: 'rule'; level: ConfigurableLevel; key: string; before: boolean | null; after: boolean }
  | { kind: 'tool'; key: string; before: { every: boolean; teams: Record<string, Audience> } | null }
  | { kind: 'level'; personId: string; before: 'super_admin' | 'admin' | null }
  | { kind: 'exception-add'; exceptionId: string }
  | { kind: 'exception-end'; exceptionId: string }

export async function undoChange(changeId: number, reasonIn: string): Promise<Result> {
  const who = await actor()
  if ('error' in who) return { ok: false, error: who.error }
  const reason = cleanReason(reasonIn)
  if (!reason) return { ok: false, error: 'Say why, in a sentence (at least 8 characters).' }
  const db = createAdminClient()
  const { data } = await db.from('access_changes').select('id, kind, summary, changes, undone_by').eq('id', changeId).maybeSingle()
  const entry = data as { id: number; kind: string; summary: string; changes: Logged[]; undone_by: number | null } | null
  if (!entry) return { ok: false, error: 'That change is not in the log.' }
  if (entry.undone_by) return { ok: false, error: 'That change was already undone.' }
  if (entry.kind === 'undo') return { ok: false, error: 'An undo is not undone. Make the change again instead.' }
  const items = Array.isArray(entry.changes) ? entry.changes : []

  // Refused when anything it touched has changed again since (decided 8 October
  // 2026): undoing it would silently override the later change.
  const touched = new Set(items.flatMap(touchKeys))
  const { data: laterRows } = await db.from('access_changes').select('id, changes').gt('id', changeId).order('id')
  const later = ((laterRows ?? []) as { id: number; changes: unknown }[])
    .find(r => (Array.isArray(r.changes) ? r.changes : []).some(c => touchKeys(c).some(k => touched.has(k))))
  if (later) return { ok: false, error: `This was changed again since (change #${later.id}). Undo that one first, or make the change you want directly.` }

  const level = items.find(c => c.kind === 'level') as Extract<Logged, { kind: 'level' }> | undefined
  if (level) return setPersonLevel(level.personId, level.before, `Undo: ${reason}`, { undoes: changeId })
  const added = items.find(c => c.kind === 'exception-add') as Extract<Logged, { kind: 'exception-add' }> | undefined
  if (added) return endException(added.exceptionId, `Undo: ${reason}`, { undoes: changeId })
  const ended = items.find(c => c.kind === 'exception-end') as Extract<Logged, { kind: 'exception-end' }> | undefined
  if (ended) {
    const { error: reopenError } = await db.from('access_exceptions').update({ ended_at: null, ended_by: null }).eq('id', ended.exceptionId)
    if (reopenError) return { ok: false, error: 'The exception could not be reopened. Nothing changed; try again.' }
    const id = await logChange(db, { actorId: who.personId, kind: 'undo', summary: `Undo: ${entry.summary}`, reason, undoes: changeId, changes: [{ kind: 'exception-reopen', exceptionId: ended.exceptionId }] })
    if (id) await db.from('access_changes').update({ undone_by: id }).eq('id', changeId).is('undone_by', null)
    tellSuperAdmins(id, `Undo: ${entry.summary}`, reason, who.personId)
    refresh()
    return { ok: true, id }
  }

  const rules = items.filter((c): c is Extract<Logged, { kind: 'rule' }> => c.kind === 'rule')
  const tools = items.filter((c): c is Extract<Logged, { kind: 'tool' }> => c.kind === 'tool')
  if (!rules.length && !tools.length) return { ok: false, error: 'This change cannot be undone from here.' }
  const before = await loadRules(db)
  try {
    await applyRules(db,
      rules.filter(r => r.before !== null).map(r => ({ level: r.level, key: r.key, allowed: r.before as boolean })),
      tools.map(t => ({ key: t.key, every: t.before?.every ?? false, teams: Object.entries(t.before?.teams ?? {}).map(([teamId, audience]) => ({ teamId, audience })) })),
      rules.filter(r => r.before === null).map(r => ({ level: r.level, key: r.key })),
    )
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
  const people = await loadSubjects(db)
  const afterRules = await loadRules(db)
  const rows = impact(people, before, afterRules, { today: today() })
  const nameOf = new Map(people.map(p => [p.id, p.name]))
  const id = await logChange(db, {
    actorId: who.personId, kind: 'undo', summary: `Undo: ${entry.summary}`, reason, undoes: changeId,
    changes: [
      ...rules.map(r => ({ kind: 'rule', level: r.level, key: r.key, label: ITEM.get(r.key)?.label ?? r.key, before: r.after, after: r.before })),
      ...tools.map(t => ({ kind: 'tool', key: t.key, label: ITEM.get(t.key)?.label ?? t.key, after: t.before })),
    ],
    impact: rows.map(r => ({ person: nameOf.get(r.personId) ?? 'Someone', gained: r.gained, lost: r.lost })),
  })
  if (id) await db.from('access_changes').update({ undone_by: id }).eq('id', changeId).is('undone_by', null)
  tellSuperAdmins(id, `Undo: ${entry.summary}`, reason, who.personId)
  refresh()
  return { ok: true, id }
}

// ── Team priority, given by name ────────────────────────────────────────────

/**
 * Give a person the right to set team priorities on My Work, change how far it
 * reaches, or (scope null) take it away. Super Admin only.
 */
export async function setPriorityGrant(personId: string, scope: string | null) {
  if (!(await isSuperAdmin())) throw new Error('Not authorized')
  if (typeof personId !== 'string' || !UUID.test(personId)) throw new Error('Unknown person')
  if (scope !== null && !isGrantScope(scope)) throw new Error('Unknown scope')

  const db = createAdminClient()
  if (scope === null) {
    const { error } = await db.from('monday_priority_grants').delete().eq('person_id', personId)
    if (error) throw new Error(error.message)
  } else {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const me = user ? await loadCurrentPerson(supabase, user, { real: true }) : null
    const { error } = await db.from('monday_priority_grants').upsert(
      { person_id: personId, scope, granted_by: me?.id ?? null, granted_at: new Date().toISOString() },
      { onConflict: 'person_id' },
    )
    if (error) throw new Error(error.message)
  }
  revalidatePath('/admin/access-levels')
}
