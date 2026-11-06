'use server'

/**
 * Topic Studio's settings (phase 4, 6 November 2026): Super Admins only for now.
 * What arrives from the browser goes through readSettings (validated, clamped,
 * defaults for anything wrong) and every edited prompt is checked first, so a
 * prompt that lost a required variable or its JSON instruction cannot be saved.
 */

import { revalidatePath } from 'next/cache'
import { writerAccess } from '@/lib/access/resolve'
import { createAdminClient } from '@/lib/supabase/admin'
import { PROMPT_ORDER } from '@/lib/topic-studio/ai/prompt-defs'
import { loadSettings, saveSettings } from '@/lib/topic-studio/ai/store'
import { promptTemplate, readSettings, validatePrompt } from '@/lib/topic-studio/ai/settings'
import { ROUTES } from '@/lib/nav/routes'

export type SettingsDone = { ok: true } | { ok: false; error: string }

/** Saves the Claude settings (features, limits, blocked models, prompts); the other areas stay as they are. */
export async function saveAiSettings(ai: unknown): Promise<SettingsDone> {
  try {
    const access = await writerAccess()
    if (!access) return { ok: false, error: 'Sign in again to save. A View Stage preview cannot save.' }
    if (!access.isSuperAdmin) return { ok: false, error: 'Settings are open to Super Admins.' }
    if (!access.personId) return { ok: false, error: 'Your login is not linked to anyone in the Directory.' }
    const db = createAdminClient()
    const current = await loadSettings(db)
    const next = readSettings({ ...current, ai })
    for (const k of PROMPT_ORDER) {
      const problem = validatePrompt(k, promptTemplate(next.ai, k))
      if (problem) return { ok: false, error: `${k}: ${problem}` }
    }
    await saveSettings(db, next, access.personId)
    revalidatePath(`${ROUTES.topicStudio}/settings`)
    return { ok: true }
  } catch (e) {
    console.error('[topic-studio] saveAiSettings', e)
    return { ok: false, error: 'That did not save. Try again in a moment.' }
  }
}
