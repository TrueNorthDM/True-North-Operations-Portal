/**
 * The access change log (access_changes, migration 094): every change to who
 * can open what, with who made it, when, before and after, and why. Super
 * Admins read it on Admin > Access levels, Change log.
 *
 * Also the one place that notices a level moving on its own: Team Leader is
 * worked out from team positions, so adding someone to a team as Lead, or
 * making a Lead a Member, changes their level. Callers take a snapshot of the
 * people they touch before the change (levelsOf) and hand it to
 * noteLevelShifts afterwards, which logs and notifies whatever moved.
 */

import type { Json } from '@/lib/types/database.types'
import type { Db } from '@/lib/supabase/types'
import { after } from 'next/server'
import { LEVEL_LABEL, type AccessLevel } from './catalogue'
import { loadSubject } from './store'

type Client = Db

export type ChangeKind = 'rules' | 'tool-teams' | 'level' | 'exception' | 'position' | 'undo'

export interface LogEntry {
  actorId: string | null
  kind: ChangeKind
  summary: string
  reason: string
  changes: unknown
  impact?: unknown
  undoes?: number | null
}

export async function logChange(db: Client, e: LogEntry): Promise<number | null> {
  const { data, error } = await db.from('access_changes').insert({
    actor_id: e.actorId, kind: e.kind, summary: e.summary, reason: e.reason,
    changes: e.changes as Json, impact: (e.impact ?? null) as Json, undoes: e.undoes ?? null,
  }).select('id').single()
  if (error) { console.error('[access] log:', error.message); return null }
  return (data as { id: number }).id
}

/** The levels of some people, now. */
export async function levelsOf(db: Client, personIds: readonly string[]): Promise<Map<string, { level: AccessLevel; name: string }>> {
  const out = new Map<string, { level: AccessLevel; name: string }>()
  const subjects = await Promise.all(personIds.map(id => loadSubject(db, id)))
  for (const s of subjects) if (s) out.set(s.id, { level: s.level, name: s.name })
  return out
}

/**
 * After a team change: whoever's level moved (User to Team Leader and back) is
 * logged as a position change and told (notification "access level changed").
 */
export async function noteLevelShifts(
  db: Client,
  before: ReadonlyMap<string, { level: AccessLevel; name: string }>,
  actor: { personId: string | null; profileId: string | null },
  what: string,
): Promise<void> {
  const now = await levelsOf(db, [...before.keys()])
  for (const [id, was] of before) {
    const is = now.get(id)
    if (!is || is.level === was.level) continue
    await logChange(db, {
      actorId: actor.personId, kind: 'position',
      summary: `${was.name}: ${LEVEL_LABEL[was.level]} → ${LEVEL_LABEL[is.level]}`,
      reason: what,
      changes: [{ person: was.name, from: was.level, to: is.level }],
    })
    after(async () => {
      const { notifyLevelChange } = await import('@/lib/notifications/run')
      await notifyLevelChange({ personId: id, name: was.name, from: was.level, to: is.level, actorProfileId: actor.profileId })
    })
  }
}

// ── All-or-nothing changes (migration 097) ──────────────────────────────────

/** One write of an access change, applied by access_commit() in the database. */
export type AccessOp =
  | { op: 'rule_set'; level: string; key: string; allowed: boolean }
  | { op: 'rule_clear'; level: string; key: string }
  | { op: 'tool_set'; key: string; every: boolean; teams: Record<string, 'team' | 'lead'> }
  | { op: 'exception_add'; id: string; person_id: string; key: string; effect: 'grant' | 'deny'; until: string | null; reason: string; by: string | null }
  | { op: 'exception_end'; id: string; by: string | null }
  | { op: 'exception_reopen'; id: string }
  | { op: 'person_level'; person_id: string; level: 'super_admin' | 'admin' | null; profile_id: string | null }

/** What the change was based on; refused when any of it is no longer so. */
export interface AccessExpected {
  rules?: { level: string; key: string; allowed: boolean | null }[]
  tools?: { key: string; scope: { every: boolean; teams: Record<string, string> } | null }[]
  levels?: { person_id: string; level: 'super_admin' | 'admin' | null }[]
  exceptions?: { id: string; ended: boolean }[]
}

const COMMIT_ERRORS: Record<string, string> = {
  access_changed_since: 'Someone changed this since you opened the page. Reload to see the latest, then make your change again.',
  access_already_undone: 'That change was already undone.',
  at_least_two_super_admins: 'There must always be at least two Super Admins. Make someone else a Super Admin first.',
  access_unknown_person: 'That person is not in the Directory.',
}

/**
 * Apply an access change and write its log row in one transaction: both or
 * neither, one change at a time, and only if what it was based on still holds
 * (supabase/migrations/097_access_commit.sql). Returns the log row's id.
 */
export async function commitAccess(
  db: Client,
  ops: AccessOp[],
  expected: AccessExpected,
  log: Omit<LogEntry, 'actorId'> & { actorId: string | null },
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const { data, error } = await db.rpc('access_commit', {
    p_ops: ops as unknown as Json,
    p_expected: expected as unknown as Json,
    p_log: {
      actor_id: log.actorId, kind: log.kind, summary: log.summary, reason: log.reason,
      changes: log.changes as Json, impact: (log.impact ?? null) as Json, undoes: log.undoes ?? null,
    },
  })
  if (error) {
    const known = Object.keys(COMMIT_ERRORS).find(k => error.message.includes(k))
    if (!known) console.error('[access] commit:', error.message)
    return { ok: false, error: known ? COMMIT_ERRORS[known] : 'The change could not be saved. Nothing was changed; try again.' }
  }
  return { ok: true, id: data as number }
}
