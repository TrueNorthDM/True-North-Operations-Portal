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

import type { SupabaseClient } from '@supabase/supabase-js'
import { after } from 'next/server'
import { LEVEL_LABEL, type AccessLevel } from './catalogue'
import { loadSubject } from './store'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = SupabaseClient<any, any, any>

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
    changes: e.changes, impact: e.impact ?? null, undoes: e.undoes ?? null,
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
