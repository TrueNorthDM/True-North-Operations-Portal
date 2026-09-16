'use server'

// Saving a team's priority order on My Work.
//
// Only the team's leader (team position 'team_leader' or 'founder') or an admin
// may, and this action is the only way in: migration 084 gives the table no
// write policy, so the check below is the security, not a courtesy. It runs on
// the person really signed in, verified with the Auth server, and never on the
// person View Stage is previewing.
//
// No revalidatePath. Called from a server action it re-renders the page being
// viewed, and the editor saves as the leader works: every arrow click would
// reload a thousand steps to show a list the browser already has. My Work is
// rendered per request, so the next visit to any list reads the new order.

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadCurrentPerson } from '@/lib/directory/current-person'
import { isSecurityAdmin } from '@/lib/auth/role'
import { canSetOrder, cleanSavedOrder } from '@/lib/monday/worklist/team-priority'
import { loadMemberships } from '@/lib/monday/worklist/team-priority-data'

export interface SaveResult { ok: boolean; error?: string; savedAt?: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function saveTeamPriority(teamId: string, order: string[], pinned: string[]): Promise<SaveResult> {
  if (typeof teamId !== 'string' || !UUID.test(teamId)) return { ok: false, error: 'That team does not exist.' }
  const clean = cleanSavedOrder(order, pinned)
  if (!clean) return { ok: false, error: 'The order could not be read. Reload the page and try again.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'You are signed out. Sign in again to save.' }

  const [me, admin] = await Promise.all([
    loadCurrentPerson(supabase, user, { real: true }),
    isSecurityAdmin(),
  ])
  // Memberships from the privileged client: the answer to "does this person
  // lead this team" should not depend on what their own session can read.
  const db = createAdminClient()
  const memberships = me ? await loadMemberships(db, me.id) : []
  if (!canSetOrder(teamId, memberships, admin)) {
    return { ok: false, error: "Only this team's leader or an admin can change its order." }
  }

  const { data: team } = await db.from('teams').select('id').eq('id', teamId).maybeSingle()
  if (!team) return { ok: false, error: 'That team does not exist.' }

  const savedAt = new Date().toISOString()
  const { error } = await db.from('monday_team_priority').upsert({
    team_id: teamId,
    step_order: clean.order,
    pinned: clean.pinned,
    updated_by: me?.id ?? null,
    updated_at: savedAt,
  }, { onConflict: 'team_id' })
  if (error) return { ok: false, error: error.message }
  return { ok: true, savedAt }
}
