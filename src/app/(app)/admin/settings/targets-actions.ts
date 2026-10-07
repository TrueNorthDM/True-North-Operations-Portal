'use server'

/**
 * Server Actions for the publishing-targets editor, in Settings → Publishing
 * targets. It lived under the Boards page until Boards was removed on
 * 23 September 2026.
 *
 * Every write needs Publishing targets (cs-targets) on Admin > Access levels,
 * checked for the person really signed in, and then goes through the
 * privileged client, so the tick decides and not the database role. Each write
 * stamps updated_by with the actor's email, which the log_target_change
 * trigger records in audit_log.
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { allowedTo } from '@/lib/access/resolve'
import { revalidatePath } from 'next/cache'
import { ROUTES } from '@/lib/nav/routes'

/** Where targets are edited, and where they are read. */
const refresh = () => { revalidatePath('/admin/settings'); revalidatePath(ROUTES.publishing) }

type Result = { ok: boolean; error?: string }

async function requireAdmin(): Promise<{ ok: false; error: string } | { ok: true; email: string }> {
  if (!(await allowedTo('cs-targets'))) return { ok: false, error: 'Publishing targets is not open to your access.' }
  const {
    data: { user },
  } = await (await createClient()).auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }
  return { ok: true, email: user.email ?? 'unknown' }
}

export async function saveTargetValue(input: { id: string; targetValue: number }): Promise<Result> {
  const auth = await requireAdmin()
  if (!auth.ok) return { ok: false, error: auth.error }
  if (!Number.isFinite(input.targetValue) || input.targetValue < 0) {
    return { ok: false, error: 'Target must be a non-negative number.' }
  }
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('publishing_targets')
    .update({ target_value: Math.round(input.targetValue), updated_by: auth.email })
    .eq('id', input.id)
  if (error) return { ok: false, error: error.message }
  refresh()
  return { ok: true }
}

export async function addTarget(input: {
  boardId: string
  boardShort: string
  language: string
  targetValue: number
}): Promise<Result> {
  const auth = await requireAdmin()
  if (!auth.ok) return { ok: false, error: auth.error }
  const language = input.language.trim()
  if (!language) return { ok: false, error: 'Language is required.' }
  if (!Number.isFinite(input.targetValue) || input.targetValue < 0) {
    return { ok: false, error: 'Target must be a non-negative number.' }
  }
  const supabase = createAdminClient()
  const { error } = await supabase.from('publishing_targets').insert({
    board_id: input.boardId,
    board_short: input.boardShort,
    language,
    target_value: Math.round(input.targetValue),
    period_type: 'weekly',
    updated_by: auth.email,
  })
  if (error) {
    // 23505 = unique_violation (board_id, language, period_type already exists)
    if (error.code === '23505') return { ok: false, error: `A weekly target for ${language} already exists on this board.` }
    return { ok: false, error: error.message }
  }
  refresh()
  return { ok: true }
}

export async function deleteTarget(input: { id: string }): Promise<Result> {
  const auth = await requireAdmin()
  if (!auth.ok) return { ok: false, error: auth.error }
  const supabase = createAdminClient()
  const { error } = await supabase.from('publishing_targets').delete().eq('id', input.id)
  if (error) return { ok: false, error: error.message }
  refresh()
  return { ok: true }
}
