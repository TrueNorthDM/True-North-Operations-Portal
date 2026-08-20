'use server'

/** Turning parts of Monday on and off for My Work. Admins only. */

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSecurityAdmin } from '@/lib/auth/role'

type Result = { ok: boolean; error?: string }

async function guard(): Promise<string | null> {
  return (await isSecurityAdmin()) ? null : 'Admins only.'
}

function done() {
  revalidatePath('/settings')
  revalidatePath('/my-work')
}

export async function setBoardIncluded(boardId: number, included: boolean): Promise<Result> {
  const no = await guard(); if (no) return { ok: false, error: no }
  const { error } = await createAdminClient()
    .from('monday_boards').update({ included }).eq('id', boardId)
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
  const q = supabase.from('monday_boards').update({ included })
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
