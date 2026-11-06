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
import { saveSettings } from '@/lib/topic-studio/ai/store'
import { promptTemplate, readSettings, validatePrompt } from '@/lib/topic-studio/ai/settings'
import { saveClientRow } from '@/lib/topic-studio/store'
import { ROUTES } from '@/lib/nav/routes'

export type SettingsDone = { ok: true } | { ok: false; error: string }

/** Saves the settings: the Claude part, the tab and field switches and the feedback rules. Anything missing or invalid falls back to its default. */
export async function saveAiSettings(input: unknown): Promise<SettingsDone> {
  try {
    const access = await writerAccess()
    if (!access) return { ok: false, error: 'Sign in again to save. A View Stage preview cannot save.' }
    if (!access.isSuperAdmin) return { ok: false, error: 'Settings are open to Super Admins.' }
    if (!access.personId) return { ok: false, error: 'Your login is not linked to anyone in the Directory.' }
    const db = createAdminClient()
    const next = readSettings(input)
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

const CODE_RE = /^[A-Z][A-Z0-9]{1,5}$/
const cut = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '')

/** Adds a client, or changes one: its name, the brief heading, whether it is a faith client, and what Claude is told about it. */
export async function saveClient(input: { code: string; name: string; heading: string; faith: boolean; about: string; orig: string }): Promise<SettingsDone> {
  try {
    const access = await writerAccess()
    if (!access) return { ok: false, error: 'Sign in again to save. A View Stage preview cannot save.' }
    if (!access.isSuperAdmin) return { ok: false, error: 'Settings are open to Super Admins.' }
    const code = cut(input?.code, 6).toUpperCase()
    if (!CODE_RE.test(code)) return { ok: false, error: 'A client code is 2 to 6 capital letters or digits, starting with a letter.' }
    const name = cut(input.name, 80)
    if (!name) return { ok: false, error: 'Give the client a name.' }
    const db = createAdminClient()
    await saveClientRow(db, code, name, { heading: cut(input.heading, 60) || `${code} Topic`, faith: input.faith === true, about: cut(input.about, 4000), orig: cut(input.orig, 4000) })
    revalidatePath(`${ROUTES.topicStudio}/settings`)
    return { ok: true }
  } catch (e) {
    console.error('[topic-studio] saveClient', e)
    return { ok: false, error: 'That did not save. Try again in a moment.' }
  }
}
