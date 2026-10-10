'use server'

// Saving a team's priority order on My Work.
//
// Who may is decided by priorityRights (team-priority.ts): admins, the Team
// priority rows on Admin → Access levels for the person's level, and people
// given it there by name. This action is the only way in: migration 084 gives
// the table no write policy, so the check below is the security, not a
// courtesy. It runs on the person really signed in, with the session every
// write uses (verifiedSession: confirmed with the Auth server, two-step code
// given, still active and invited), and refuses outright while View Stage is
// previewing a level.
//
// No revalidatePath. Called from a server action it re-renders the page being
// viewed, and the editor saves as the leader works: every arrow click would
// reload a thousand steps to show a list the browser already has. My Work is
// rendered per request, so the next visit to any list reads the new order.

import { after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadCurrentPerson } from '@/lib/directory/current-person'
import { getViewAs } from '@/lib/auth/view-as-server'
import { loadRealAccess, verifiedSession } from '@/lib/access/resolve'
import { canSetOrder, cleanLevels, cleanSavedOrder, priorityRights } from '@/lib/monday/worklist/team-priority'
import { loadMemberships, loadPriorityGrant } from '@/lib/monday/worklist/team-priority-data'
import { missingColumn } from '@/lib/monday/worklist/missing-column'
import { notifyTeamOrder } from '@/lib/notifications/run'

export interface SaveResult {
  ok: boolean
  error?: string
  /** The order's new stamp: the editor sends it with its next save. */
  savedAt?: string
  /** Someone else saved this team's order after the editor loaded it. */
  conflict?: boolean
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Not exported: a 'use server' file may export async functions only.
const CONFLICT = 'Someone else changed this order a moment ago. Reload to see it.'

/**
 * `levels` is the team's workspace and board order (migration 087). Left out
 * (undefined), the stored one is kept as it is, which is what an editor that
 * cannot order levels yet sends.
 *
 * `loadedAt` is the stamp of the order the editor is changing: the saved
 * order's updated_at when the page loaded it, or the one the last save
 * returned; null when the team had no order. The save goes through only while
 * it is still the stamp in the table (audit, 10 October 2026). Two leaders
 * arranging the same team used to overwrite each other without either knowing:
 * the last one to pause won, and the other's work was gone.
 */
export async function saveTeamPriority(
  teamId: string, order: string[], pinned: string[], levels: unknown, loadedAt: string | null,
): Promise<SaveResult> {
  if (typeof teamId !== 'string' || !UUID.test(teamId)) return { ok: false, error: 'That team does not exist.' }
  const clean = cleanSavedOrder(order, pinned)
  if (!clean) return { ok: false, error: 'The order could not be read. Reload the page and try again.' }
  const cleanLv = levels === undefined ? undefined : cleanLevels(levels)
  if (cleanLv === null) return { ok: false, error: 'The workspace and board order could not be read. Reload the page and try again.' }
  if (loadedAt !== null && (typeof loadedAt !== 'string' || Number.isNaN(Date.parse(loadedAt)))) {
    return { ok: false, error: 'The order could not be read. Reload the page and try again.' }
  }

  // A preview shows what a level would see. Saving from one would act with the
  // admin's real session on behalf of somebody else's level, so it does not.
  if (await getViewAs()) return { ok: false, error: "View Stage is only a preview. Close it to change a team's order." }

  // The session behind any write (audit, 10 October 2026): getUser alone let a
  // session that still owed its two-step code, or belonged to someone since
  // switched off, save.
  const session = await verifiedSession()
  if (!session) return { ok: false, error: 'Sign in again to save.' }

  const me = await loadCurrentPerson(session.supabase, session.user, { real: true })
  if (!me) return { ok: false, error: 'Your login is not linked to anyone in the Directory, so there is no team to save for.' }

  // Read with the privileged client: whether this person may change the order
  // should not depend on what their own session can read.
  const db = createAdminClient()
  // The signed-in person's own access (never a preview's): the access rule.
  const [access, memberships, grant] = await Promise.all([
    loadRealAccess(),
    loadMemberships(db, me.id),
    loadPriorityGrant(db, me.id),
  ])

  const rights = priorityRights({ isAdmin: access.isSuperAdmin, can: access.can, grant })
  if (!canSetOrder(teamId, memberships, rights)) {
    return { ok: false, error: "You do not have access to change this team's order." }
  }

  const { data: team } = await db.from('teams').select('id').eq('id', teamId).maybeSingle()
  if (!team) return { ok: false, error: 'That team does not exist.' }

  const savedAt = new Date().toISOString()
  const row = {
    step_order: clean.order,
    pinned: clean.pinned,
    ...(cleanLv ? { workspace_order: cleanLv.workspaces, board_order: cleanLv.boards } : {}),
    updated_by: me.id,
    updated_at: savedAt,
  }
  // Only over the order the editor loaded: an update that matches its stamp,
  // or, for a team with no order yet, an insert that the primary key refuses
  // when someone else's first save got there first.
  const { data, error } = loadedAt
    ? await db.from('monday_team_priority').update(row).eq('team_id', teamId).eq('updated_at', loadedAt).select('updated_at')
    : await db.from('monday_team_priority').insert({ team_id: teamId, ...row }).select('updated_at')
  if (missingColumn(error, 'workspace_order') || missingColumn(error, 'board_order')) {
    return { ok: false, error: 'Ordering by workspace and board needs migration 087 in the database. Nothing was saved.' }
  }
  if (error && (error as { code?: string }).code === '23505') return { ok: false, conflict: true, error: CONFLICT }
  if (error) {
    // The database's own words go to the server log, not to the browser
    // (audit, 10 October 2026).
    console.error('[team-priority] saving the order failed:', error.message)
    return { ok: false, error: 'The order could not be saved. Try again in a moment.' }
  }
  const written = (data ?? []) as { updated_at: string | null }[]
  if (!written.length) return { ok: false, conflict: true, error: CONFLICT }

  // The team hears about it (notification T4), after the answer is sent: a
  // save must not wait on, or fail because of, a notification.
  after(() => notifyTeamOrder(teamId, me.id))
  return { ok: true, savedAt: written[0].updated_at ?? savedAt }
}
