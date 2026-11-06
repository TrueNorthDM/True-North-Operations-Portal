'use server'

/**
 * Topic Studio's research saves for the Citations and Discussions tabs (phase 4,
 * 6 November 2026). Same rule as actions.ts: every action asks the access rule
 * first (guard), SEO research only, the person really signed in, never a View
 * Stage preview. What each change does lives in lib/topic-studio (citations,
 * discussions) as pure functions; an action reads the topic fresh, works out the
 * change, saves it and says what happened. A sentence meant for the person comes
 * from the pure functions through say(); anything else is logged and answered
 * with one generic line.
 *
 * The guard is written out again here on purpose: actions.ts is a 'use server'
 * file and can only export actions, so its helpers cannot be imported.
 */

import { revalidatePath } from 'next/cache'
import { writerAccess } from '@/lib/access/resolve'
import { createAdminClient } from '@/lib/supabase/admin'
import { topicStudioTopic } from '@/lib/nav/routes'
import { createAnalysis } from '@/lib/topic-studio/analysis'
import { applyCuratedOp, cleanCuratedOp, readCurated } from '@/lib/topic-studio/citations'
import { cleanCapture } from '@/lib/topic-studio/capture-place'
import { discussionPages, discussionPayload, MAX_DISCUSSIONS } from '@/lib/topic-studio/discussions'
import { countWords } from '@/lib/topic-studio/engine'
import { loadBundle, patchTopic, removePages, savePage, type Bundle } from '@/lib/topic-studio/store'

export type Done<T = object> = ({ ok: true } & T) | { ok: false; error: string }

/** A refusal in the person's own words. */
class Say extends Error {}
const say = <T,>(fn: () => T): T => { try { return fn() } catch (e) { throw new Say((e as Error).message) } }

const SAVE_FAILED = 'That did not save. Try again in a moment.'

async function guard() {
  const access = await writerAccess()
  if (!access) throw new Say('Sign in again to save. A View Stage preview cannot save.')
  if (!access.canTool('topic-studio-seo')) throw new Say('Working on topics is open to the SEO team.')
  if (!access.personId) throw new Say('Your login is not linked to anyone in the Directory.')
  return { db: createAdminClient(), personId: access.personId }
}

/** Runs a save: the answer on success, the person's sentence on a refusal, one generic line on anything else. */
async function run<T extends object>(fn: () => Promise<T>): Promise<Done<T>> {
  try { return { ok: true, ...(await fn()) } }
  catch (e) {
    if (e instanceof Say) return { ok: false, error: e.message }
    console.error('[topic-studio]', e)
    return { ok: false, error: SAVE_FAILED }
  }
}

const refresh = (id: string) => revalidatePath(topicStudioTopic(id))

async function open(id: string): Promise<{ db: ReturnType<typeof createAdminClient>; personId: string; b: Bundle }> {
  const g = await guard()
  const b = await loadBundle(g.db, id, 'seo')
  if (!b) throw new Say('That topic no longer exists.')
  return { ...g, b }
}

/** Citations: one change to what the SEO ticked for the brief. `op` is checked field by field (cleanCuratedOp). */
export async function saveCurated(id: string, op: unknown): Promise<Done> {
  return run(async () => {
    const { db, personId, b } = await open(id)
    // The choices are read fresh from the topic's data, so two people ticking at once start from the same list.
    const { data, error } = await db.from('ts_topics').select('data').eq('id', id).maybeSingle()
    if (error) throw new Error(`The topic could not be read: ${error.message}`)
    const patch = say(() => applyCuratedOp(createAnalysis(b.project, b.pages), readCurated(data?.data), cleanCuratedOp(op)))
    await patchTopic(db, id, patch, {}, personId)
    refresh(id)
    return {}
  })
}

/** Discussions: keeps a pasted thread. `capture` is what the browser read from the clipboard (lib/topic-studio/capture.ts); `html` says it came as formatted text. */
export async function saveDiscussion(id: string, capture: unknown, html: boolean): Promise<Done<{ title: string; words: number }>> {
  return run(async () => {
    const { db, personId, b } = await open(id)
    const cap = say(() => { const c = cleanCapture(capture, html === true); if (typeof c === 'string') throw new Error(c); return c })
    if (discussionPages(b.pages).length >= MAX_DISCUSSIONS) throw new Say(`A topic keeps up to ${MAX_DISCUSSIONS} threads. Remove one first.`)
    await savePage(db, id, discussionPayload(cap.url, cap), personId)
    refresh(id)
    return { title: cap.title || 'Discussion', words: cap.blocks.reduce((n, x) => n + countWords(x[1]), 0) }
  })
}

/** Discussions: removes a thread by its page id (a thread may have no address, so the address cannot name it). */
export async function removeDiscussion(id: string, key: string): Promise<Done> {
  return run(async () => {
    const { db } = await open(id)
    if (typeof key !== 'string' || !key || key.length > 100) throw new Say('That thread no longer exists.')
    const { data, error } = await db.from('ts_pages').select('id').eq('topic_id', id).eq('kind', 'discussion').eq('artifact_id', key)
    if (error) throw new Error(`The captured threads could not be read: ${error.message}`)
    await removePages(db, id, (data ?? []).map(r => r.id as number))
    refresh(id)
    return {}
  })
}
