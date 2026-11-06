'use server'

/**
 * Claude's buttons (Topic Studio, phase 3, 6 November 2026). One action runs one
 * feature on one topic. The SEO team may run all nine; a writer may run only the
 * two that work on the draft (suggest placements, review). The access rule is
 * asked first, the limits and the call live in lib/topic-studio/ai/run.ts, and
 * what Claude answered is saved into the topic like any other edit.
 */

import { revalidatePath } from 'next/cache'
import { writerAccess } from '@/lib/access/resolve'
import { createAdminClient } from '@/lib/supabase/admin'
import { topicStudioTopic } from '@/lib/nav/routes'
import { createAnalysis } from '@/lib/topic-studio/analysis'
import { ClaudeError, claudeConfigured, defaultClient } from '@/lib/topic-studio/ai/claude'
import { WRITER_FEATURES, isFeature } from '@/lib/topic-studio/ai/features'
import { runFeature } from '@/lib/topic-studio/ai/run'
import { loadSettings, lastRunAt, logUsage, usageSince } from '@/lib/topic-studio/ai/store'
import { loadBundle, patchTopic, topicRole } from '@/lib/topic-studio/store'
import { sanitizeDraftHtml } from '@/lib/topic-studio/sanitize'

export type AiDone = { ok: true; model: string } | { ok: false; error: string }

const DAY_MS = 24 * 60 * 60 * 1000
const FAILED = 'Claude could not finish that. Try again in a moment.'

/** Runs one Claude feature on a topic and saves what it answered. */
export async function runAi(id: string, feature: string): Promise<AiDone> {
  try {
    const access = await writerAccess()
    if (!access) return { ok: false, error: 'Sign in again to use Claude. A View Stage preview cannot.' }
    const role = topicRole(access.canTool)
    if (!role) return { ok: false, error: 'Topic Studio is not open to your access.' }
    if (!access.personId) return { ok: false, error: 'Your login is not linked to anyone in the Directory.' }
    if (!isFeature(feature)) return { ok: false, error: 'That Claude feature does not exist.' }
    if (role === 'writer' && !WRITER_FEATURES.includes(feature)) return { ok: false, error: 'That Claude feature is open to the SEO team.' }
    if (!claudeConfigured()) return { ok: false, error: 'Claude is not connected yet. An Admin needs to add the Anthropic key to the server.' }

    const db = createAdminClient()
    const b = await loadBundle(db, id, role)
    if (!b) return { ok: false, error: 'That topic is not available.' }
    const settings = await loadSettings(db)
    const client = defaultClient()
    if (!client) return { ok: false, error: 'Claude is not connected yet. An Admin needs to add the Anthropic key to the server.' }
    const personId = access.personId

    const out = await runFeature(
      feature,
      { analysis: createAnalysis(b.project, b.pages), pages: b.pages, client: b.client, settings, draftHtml: sanitizeDraftHtml(b.draft.html) },
      { exempt: access.isSuperAdmin },
      {
        client,
        now: () => Date.now(),
        usedToday: () => usageSince(db, personId, new Date(Date.now() - DAY_MS).toISOString()),
        lastRun: () => lastRunAt(db, personId, feature),
        log: r => logUsage(db, { person_id: personId, topic_id: id, topic_name: b.project.topic, feature, model: r.model, ok: r.ok, error: r.error, input_tokens: r.inputTokens, output_tokens: r.outputTokens, ms: r.ms }),
        save: patch => patchTopic(db, id, patch, {}, personId),
      },
    )
    if (out.ok) revalidatePath(topicStudioTopic(id))
    return out
  } catch (e) {
    if (e instanceof ClaudeError) return { ok: false, error: e.message }
    console.error('[topic-studio] runAi', e)
    return { ok: false, error: FAILED }
  }
}
