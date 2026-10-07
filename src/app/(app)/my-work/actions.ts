'use server'

// Saving a team's priority order on My Work.
//
// Who may is decided by priorityRights (team-priority.ts): admins, the Team
// priority rows on Admin → Access levels for the person's level, and people
// given it there by name. This action is the only way in: migration 084 gives
// the table no write policy, so the check below is the security, not a
// courtesy. It runs on the person really signed in, verified with the Auth
// server, and refuses outright while View Stage is previewing a level.
//
// No revalidatePath. Called from a server action it re-renders the page being
// viewed, and the editor saves as the leader works: every arrow click would
// reload a thousand steps to show a list the browser already has. My Work is
// rendered per request, so the next visit to any list reads the new order.

import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadCurrentPerson } from '@/lib/directory/current-person'
import { getViewAs } from '@/lib/auth/view-as-server'
import { loadRealAccess } from '@/lib/access/resolve'
import { canSetOrder, cleanLevels, cleanSavedOrder, priorityRights } from '@/lib/monday/worklist/team-priority'
import { loadMemberships, loadPriorityGrant } from '@/lib/monday/worklist/team-priority-data'
import { missingColumn } from '@/lib/monday/worklist/missing-column'
import { notifyTeamOrder } from '@/lib/notifications/run'

export interface SaveResult { ok: boolean; error?: string; savedAt?: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * `levels` is the team's workspace and board order (migration 087). Left out,
 * the stored one is kept as it is, which is what an editor that cannot order
 * levels yet sends.
 */
export async function saveTeamPriority(
  teamId: string, order: string[], pinned: string[], levels?: unknown,
): Promise<SaveResult> {
  if (typeof teamId !== 'string' || !UUID.test(teamId)) return { ok: false, error: 'That team does not exist.' }
  const clean = cleanSavedOrder(order, pinned)
  if (!clean) return { ok: false, error: 'The order could not be read. Reload the page and try again.' }
  const cleanLv = levels === undefined ? undefined : cleanLevels(levels)
  if (cleanLv === null) return { ok: false, error: 'The workspace and board order could not be read. Reload the page and try again.' }

  // A preview shows what a level would see. Saving from one would act with the
  // admin's real session on behalf of somebody else's level, so it does not.
  if (await getViewAs()) return { ok: false, error: "View Stage is only a preview. Close it to change a team's order." }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'You are signed out. Sign in again to save.' }

  const me = await loadCurrentPerson(supabase, user, { real: true })
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
  const { error } = await db.from('monday_team_priority').upsert({
    team_id: teamId,
    step_order: clean.order,
    pinned: clean.pinned,
    ...(cleanLv ? { workspace_order: cleanLv.workspaces, board_order: cleanLv.boards } : {}),
    updated_by: me.id,
    updated_at: savedAt,
  }, { onConflict: 'team_id' })
  if (missingColumn(error, 'workspace_order') || missingColumn(error, 'board_order')) {
    return { ok: false, error: 'Ordering by workspace and board needs migration 087 in the database. Nothing was saved.' }
  }
  if (error) return { ok: false, error: error.message }
  // The team hears about it (notification T4), after the answer is sent: a
  // save must not wait on, or fail because of, a notification.
  after(() => notifyTeamOrder(teamId, me.id))
  return { ok: true, savedAt }
}
