'use server'

/** Turning parts of Monday on and off for My Work. Admins only. */

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSecurityAdmin } from '@/lib/auth/role'
import { staleSweep } from '@/lib/monday/worklist/stale'

type Result = { ok: boolean; error?: string }

async function guard(): Promise<string | null> {
  return (await isSecurityAdmin()) ? null : 'Admins only.'
}

function done() {
  revalidatePath('/admin/settings')
  revalidatePath('/my-work')
}

/**
 * Clicking Shown or Not shown pins the board.
 *
 * The stale rule decides visibility from activity; a person clicking is
 * saying the reason is something else, and the rule stops deciding for that
 * board. Without the pin the click would be undone at the next sync with no
 * explanation on screen, which is a button that lies.
 */
export async function setBoardIncluded(boardId: number, included: boolean): Promise<Result> {
  const no = await guard(); if (no) return { ok: false, error: no }
  const { error } = await createAdminClient()
    .from('monday_boards').update({ included, included_pinned: true }).eq('id', boardId)
  if (error) return { ok: false, error: error.message }
  done()
  return { ok: true }
}

/**
 * A workspace is not a thing that can be included; its boards are. Setting it
 * sets them, which is why the switch reads as "all of them" rather than
 * pretending the workspace itself holds the flag: a board switched back on
 * afterwards should stay on, and it does.
 */
export async function setWorkspaceIncluded(workspace: string, included: boolean): Promise<Result> {
  const no = await guard(); if (no) return { ok: false, error: no }
  const supabase = createAdminClient()
  const q = supabase.from('monday_boards').update({ included, included_pinned: true })
  const { error } = workspace === 'No workspace'
    ? await q.is('workspace_name', null)
    : await q.eq('workspace_name', workspace)
  if (error) return { ok: false, error: error.message }
  done()
  return { ok: true }
}

/** How much a board matters. Nothing in Monday knows this; a person does. */
export async function setBoardPriority(boardId: number, priority: 'high' | 'medium' | 'low'): Promise<Result> {
  const no = await guard(); if (no) return { ok: false, error: no }
  const { error } = await createAdminClient()
    .from('monday_boards').update({ priority }).eq('id', boardId)
  if (error) return { ok: false, error: error.message }
  done()
  return { ok: true }
}

/** Same reasoning as the shown switch: a workspace sets its boards. */
export async function setWorkspacePriority(workspace: string, priority: 'high' | 'medium' | 'low'): Promise<Result> {
  const no = await guard(); if (no) return { ok: false, error: no }
  const supabase = createAdminClient()
  const q = supabase.from('monday_boards').update({ priority })
  const { error } = workspace === 'No workspace'
    ? await q.is('workspace_name', null)
    : await q.eq('workspace_name', workspace)
  if (error) return { ok: false, error: error.message }
  done()
  return { ok: true }
}

export async function setUserHidden(mondayUserId: number, hidden: boolean): Promise<Result> {
  const no = await guard(); if (no) return { ok: false, error: no }
  const { error } = await createAdminClient()
    .from('monday_users').update({ hidden }).eq('id', mondayUserId)
  if (error) return { ok: false, error: error.message }
  done()
  return { ok: true }
}

/**
 * Confirm a seeded step, or switch it off.
 *
 * 'guess' is what seedSteps() writes: the people column paired with whatever
 * status column sat to its right. Confirming says a human looked; switching
 * off says the pairing found a column that is not a stage of work, and the
 * rows under it stop appearing on anybody's list.
 */
export async function setStepSource(
  boardId: number, peopleCol: string, source: 'guess' | 'confirmed' | 'off',
): Promise<Result> {
  const no = await guard(); if (no) return { ok: false, error: no }
  const { error } = await createAdminClient()
    .from('monday_board_steps')
    .update({ source })
    .eq('board_id', boardId)
    .eq('people_col', peopleCol)
  if (error) return { ok: false, error: error.message }
  done()
  return { ok: true }
}

/**
 * Point a board at the timeclock project its hours are booked to.
 *
 * Null unlinks it, and the board goes back to the shared average. That is a
 * real choice rather than an undo: a board whose hours are spread across
 * several codes is better on the average than on one wrong code.
 */
export async function setBoardJobcode(boardId: number, jobcodeId: number | null): Promise<Result> {
  const no = await guard(); if (no) return { ok: false, error: no }
  const { error } = await createAdminClient()
    .from('monday_boards').update({ tc_jobcode_id: jobcodeId }).eq('id', boardId)
  if (error) return { ok: false, error: error.message }
  done()
  return { ok: true }
}

/**
 * Turn the stale rule on or off, and apply it at once.
 *
 * Applying immediately rather than waiting for the next sync is the whole
 * difference between a switch and a promise: four hours of nothing happening
 * reads as a broken toggle.
 */
export async function setHideStaleBoards(on: boolean): Promise<Result & { hidden?: number; shown?: number }> {
  const no = await guard(); if (no) return { ok: false, error: no }
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('app_settings').update({ monday_hide_stale_boards: on }).eq('singleton_id', 1)
  if (error) return { ok: false, error: error.message }

  // Switching it off changes nothing that is already hidden: the rule stops
  // deciding, it does not undo what it decided. Undoing would flood My Work
  // with years of finished projects on a single click.
  if (!on) { done(); return { ok: true, hidden: 0, shown: 0 } }

  const result = await applyStaleRule(supabase)
  done()
  return { ok: true, ...result }
}

/** One pass of the rule. Also called from the sync, so the two cannot drift. */
export async function applyStaleRule(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<{ hidden: number; shown: number }> {
  const { data } = await supabase
    .from('monday_boards').select('id, included, included_pinned, last_activity_at')

  const boards = ((data ?? []) as {
    id: number; included: boolean; included_pinned: boolean; last_activity_at: string | null
  }[]).map(b => ({
    id: b.id,
    included: b.included,
    includedPinned: b.included_pinned,
    lastActivityAt: b.last_activity_at,
  }))

  const { hide, show } = staleSweep(boards, new Date())
  if (hide.length) await supabase.from('monday_boards').update({ included: false }).in('id', hide)
  if (show.length) await supabase.from('monday_boards').update({ included: true }).in('id', show)

  return { hidden: hide.length, shown: show.length }
}
