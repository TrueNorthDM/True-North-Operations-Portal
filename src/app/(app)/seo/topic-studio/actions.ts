'use server'

/**
 * Topic Studio's saves (phase 1, 5 November 2026). Every action asks the access
 * rule first (guard): SEO research only, the person really signed in, never a
 * View Stage preview. Writers read the brief and, from phase 2, work in the
 * writer workshop; they save nothing here.
 *
 * What each edit does lives in lib/topic-studio (term-ops, capture-place) as
 * pure functions; an action reads the topic fresh, works out the patch, saves
 * it in one statement (ts_patch_topic) and says what happened. A sentence meant
 * for the person (a refusal such as "That term is already on the list") comes
 * from the pure functions through say(); anything else is logged and answered
 * with one generic line, so a database message never reaches the screen.
 */

import { revalidatePath } from 'next/cache'
import { writerAccess } from '@/lib/access/resolve'
import { createAdminClient } from '@/lib/supabase/admin'
import { ROUTES, topicStudioTopic } from '@/lib/nav/routes'
import { createAnalysis, termContext as buildTermContext, type TermContext } from '@/lib/topic-studio/analysis'
import { cleanCapture, pagePayload, placeCapture } from '@/lib/topic-studio/capture-place'
import { countWords, normUrl, type Rules } from '@/lib/topic-studio/engine'
import { AI_KEYS, AI_LABEL, missingAnswers, type Tier } from '@/lib/topic-studio/project'
import {
  addDirectQuestion, addTerm, buildTerms, cleanNotes, cleanRules, clearBuild, cycleTier, deleteGroup, moveKeysToGroup, moveTerm, moveToEnd, newGroup, notVariant,
  removeTerms, renameGroup, restoreAll, restoreTerm, syncQuestions, toggleDirect, toggleQuestionOff, type Patch,
} from '@/lib/topic-studio/term-ops'
import { MAX_DRAFT_CHARS, draftWords, sanitizeDraftHtml } from '@/lib/topic-studio/sanitize'
import {
  addFeedbackRow, addVersionRow, createTopicRow, deleteTopicRow, lastVersionAt, listClientsFull, listVersionRows, loadBundle, pageIdsByAddress, patchTopic, readVersionHtml,
  removePages, resolveFeedbackRow, saveDraftRow, savePage, topicRole, type Bundle, type Cols, type TopicRole, type VersionInfo,
} from '@/lib/topic-studio/store'

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

const refresh = (id: string, list = false) => { revalidatePath(topicStudioTopic(id)); if (list) revalidatePath(ROUTES.topicStudio) }

async function open(id: string): Promise<{ db: ReturnType<typeof createAdminClient>; personId: string; b: Bundle }> {
  const g = await guard()
  const b = await loadBundle(g.db, id, 'seo')
  if (!b) throw new Say('That topic no longer exists.')
  return { ...g, b }
}

/**
 * Someone who may work in a topic's workshop: an SEO on any topic, a writer on a
 * topic shared with writers (loadBundle returns nothing otherwise).
 */
async function member(id: string): Promise<{ db: ReturnType<typeof createAdminClient>; personId: string; role: TopicRole; b: Bundle }> {
  const access = await writerAccess()
  if (!access) throw new Say('Sign in again to save. A View Stage preview cannot save.')
  const role = topicRole(access.canTool)
  if (!role) throw new Say('Topic Studio is not open to your access.')
  if (!access.personId) throw new Say('Your login is not linked to anyone in the Directory.')
  const db = createAdminClient()
  const b = await loadBundle(db, id, role)
  if (!b) throw new Say('That topic is not available.')
  return { db, personId: access.personId, role, b }
}

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const webOrEmpty = (v: unknown, what: string): string => {
  const u = text(v, 2000)
  if (u && !/^https?:\/\/[^\s]+$/i.test(u)) throw new Say(`${what} must be a web address that starts with http:// or https://.`)
  return u
}

/* New topic */

export async function createTopic(input: { client: string; topic: string; primary: string }): Promise<Done<{ id: string }>> {
  return run(async () => {
    const { db, personId } = await guard()
    const topic = text(input?.topic, 300)
    const primary = text(input?.primary, 300)
    if (!topic) throw new Say('Type the Monday task name.')
    if (!primary) throw new Say('Type the primary keyphrase.')
    const clients = await listClientsFull(db)
    if (!clients.some(c => c.code === input?.client)) throw new Say('Choose a client.')
    const id = await createTopicRow(db, { client: input.client, topic, primary }, personId)
    refresh(id, true)
    return { id }
  })
}

/* Setup */

export interface SetupFields {
  topic?: string; primary?: string; monday?: string; client?: string
  secondary?: string; avoid?: string
  aiOverview?: string; aiChatgpt?: string; aiGemini?: string; aiPerplexity?: string
  organic?: string[]; cited?: string[]
}

export async function saveSetup(id: string, f: SetupFields): Promise<Done<{ savedAt: string }>> {
  return run(async () => {
    const { db, personId } = await guard()
    const patch: Patch = {}
    const cols: Cols = {}
    if (f.topic !== undefined) { const v = text(f.topic, 300); if (!v) throw new Say('The Monday task name cannot be empty.'); patch.topic = v; cols.topic = v }
    if (f.primary !== undefined) { const v = text(f.primary, 300); if (!v) throw new Say('The primary keyphrase cannot be empty.'); patch.primary = v; cols.primary_keyphrase = v }
    if (f.monday !== undefined) { const v = webOrEmpty(f.monday, 'The Monday task link'); patch.monday = v; cols.monday_url = v }
    if (f.client !== undefined) {
      if (!(await listClientsFull(db)).some(c => c.code === f.client)) throw new Say('Choose a client.')
      patch.client = f.client; cols.client_code = f.client
    }
    for (const k of ['secondary', 'avoid'] as const) if (f[k] !== undefined) patch[k] = text(f[k], 5000)
    for (const k of AI_KEYS) if (f[k] !== undefined) patch[k] = text(f[k], 30000)
    if (f.organic !== undefined) {
      if (!Array.isArray(f.organic) || f.organic.length > 10) throw new Say('Give up to ten organic addresses.')
      const list = f.organic.map(u => webOrEmpty(u, 'An organic address'))
      while (list.length && !list[list.length - 1]) list.pop()
      patch.organic = list
    }
    if (f.cited !== undefined) {
      if (!Array.isArray(f.cited) || f.cited.length > 40) throw new Say('Give up to forty cited addresses.')
      patch.cited = f.cited.map(u => webOrEmpty(u, 'A cited address')).filter(Boolean)
    }
    if (!Object.keys(patch).length) return { savedAt: new Date().toISOString() }
    await patchTopic(db, id, patch, cols, personId)
    refresh(id, cols.topic !== undefined || cols.primary_keyphrase !== undefined || cols.client_code !== undefined)
    return { savedAt: new Date().toISOString() }
  })
}

/* Competitors */

/** `capture` is what the browser read from the clipboard (lib/topic-studio/capture.ts); `html` says it came as formatted text. */
export async function saveCapture(id: string, capture: unknown, html: boolean, target: number | 'any'): Promise<Done<{ label: string; words: number; notes: string[] }>> {
  return run(async () => {
    const { db, personId, b } = await open(id)
    const cap = say(() => { const c = cleanCapture(capture, html); if (typeof c === 'string') throw new Error(c); return c })
    const place = say(() => { const r = placeCapture(b.project, b.pages, cap, typeof target === 'number' && Number.isInteger(target) && target >= 0 ? target : 'any'); if (typeof r === 'string') throw new Error(r); return r })
    if (place.patch) await patchTopic(db, id, place.patch, {}, personId)
    await savePage(db, id, pagePayload(place, cap), personId)
    refresh(id)
    return { label: place.label, words: cap.blocks.reduce((n, x) => n + countWords(x[1]), 0), notes: place.notes }
  })
}

export async function removeCapture(id: string, url: string): Promise<Done> {
  return run(async () => {
    const { db } = await open(id)
    const n = normUrl(url)
    await removePages(db, id, await pageIdsByAddress(db, id, u => normUrl(u) === n))
    refresh(id)
    return {}
  })
}

/* Terms, groups, questions, sharing */

export type TopicOp =
  | { op: 'build' }
  | { op: 'tier'; key: string }
  | { op: 'move'; key: string; dir: -1 | 1 }
  | { op: 'remove'; keys: string[] }
  | { op: 'add'; text: string; key?: string; tier?: Tier }
  | { op: 'restore'; key: string }
  | { op: 'restoreAll' }
  | { op: 'moveEnd'; keys: string[]; where: 'top' | 'bottom' }
  | { op: 'notVariant'; key: string }
  | { op: 'clear' }
  | { op: 'rules'; rules: Partial<Rules>; rebuild: boolean }
  | { op: 'groupNew'; name?: string }
  | { op: 'groupRename'; from: string; to: string }
  | { op: 'groupDelete'; name: string }
  | { op: 'groupMove'; keys: string[]; target: string | null }
  | { op: 'syncQuestions' }
  | { op: 'qDirect'; key: string }
  | { op: 'qOff'; key: string }
  | { op: 'qAdd'; text: string }
  | { op: 'notes'; notes: string[] }
  | { op: 'share'; shared: boolean }
  | { op: 'archive'; archived: boolean }

const keyList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length < 300).slice(0, 200) : [])
const oneKey = (v: unknown): string => { if (typeof v !== 'string' || !v || v.length > 300) throw new Error('That term is no longer on the list.'); return v }

export async function editTopic(id: string, o: TopicOp): Promise<Done<{ message?: string; name?: string }>> {
  return run(async () => {
    const { db, personId, b } = await open(id)
    const p = b.project
    const a = createAnalysis(p, b.pages)
    let patch: Patch = {}
    let cols: Cols = {}
    let message: string | undefined
    let name: string | undefined
    let list = false

    const rebuild = (an: typeof a) => {
      const miss = missingAnswers(an.project)
      if (miss.length) throw new Error(`Paste the ${miss.map(k => AI_LABEL[k]).join(', ')} answer${miss.length > 1 ? 's' : ''} in Setup first.`)
      if (!an.N) throw new Error('Capture at least one competitor page first.')
      const built = buildTerms(an)
      message = `Built ${(built.terms as unknown[]).length} terms from competitor data.`
      return built
    }

    say(() => {
      switch (o.op) {
        case 'build': patch = rebuild(a); break
        case 'tier': patch = cycleTier(p, oneKey(o.key)); break
        case 'move': patch = moveTerm(p, oneKey(o.key), o.dir === -1 ? -1 : 1); break
        case 'remove': patch = removeTerms(p, keyList(o.keys)); message = `Removed ${keyList(o.keys).length === 1 ? 'the term' : `${keyList(o.keys).length} terms`}. Restore from Removed terms.`; break
        case 'add': patch = addTerm(p, text(o.text, 120), { key: typeof o.key === 'string' && o.key ? o.key.slice(0, 300) : undefined, tier: o.tier === 'high' || o.tier === 'medium' || o.tier === 'low' ? o.tier : undefined }); break
        case 'restore': patch = restoreTerm(p, oneKey(o.key)); break
        case 'restoreAll': patch = restoreAll(p); break
        case 'moveEnd': patch = moveToEnd(p, keyList(o.keys), o.where === 'top' ? 'top' : 'bottom'); break
        case 'notVariant': patch = notVariant(p, oneKey(o.key)); break
        case 'clear': patch = clearBuild(); break
        case 'rules': {
          const rules = cleanRules(o.rules)
          const next = { ...p, buildRules: rules }
          patch = { buildRules: rules }
          if (o.rebuild) patch = { ...patch, ...rebuild(createAnalysis(next, b.pages)) }
          else message = 'Build rules saved. Rebuild the list to use them.'
          break
        }
        case 'groupNew': { const r = newGroup(a, text(o.name, 60) || undefined); patch = r.patch; name = r.name; break }
        case 'groupRename': patch = renameGroup(a, text(o.from, 60), text(o.to, 60)); break
        case 'groupDelete': patch = deleteGroup(a, text(o.name, 60)); message = 'Group deleted. Its terms are now under Other terms.'; break
        case 'groupMove': patch = moveKeysToGroup(a, keyList(o.keys), o.target === null ? null : text(o.target, 60)); break
        case 'syncQuestions': {
          const found = a.competitorQuestions()
          if (!found.length) throw new Error(a.N ? 'No questions found in the captured pages.' : 'Capture competitor pages first.')
          patch = syncQuestions(p, found)
          message = `Found ${Math.min(found.length, 60)} question${found.length === 1 ? '' : 's'} in the captured pages.`
          break
        }
        case 'qDirect': patch = toggleDirect(p, oneKey(o.key)); break
        case 'qOff': patch = toggleQuestionOff(p, oneKey(o.key)); break
        case 'qAdd': patch = addDirectQuestion(p, text(o.text, 300)); break
        case 'notes': patch = { answerTop: cleanNotes(o.notes) }; break
        case 'share': cols = { shared: o.shared === true }; patch = { sharedAt: o.shared === true ? Date.now() : null }; message = o.shared === true ? 'Shared with writers. They can open the SEO brief.' : 'No longer shared with writers.'; list = true; break
        case 'archive': cols = { archived: o.archived === true }; patch = { archivedAt: o.archived === true ? Date.now() : null }; message = o.archived === true ? 'Topic archived. It is hidden from the topic list and from writers.' : 'Topic restored to the topic list.'; list = true; break
        default: throw new Error('That change is not available.')
      }
    })
    if (Object.keys(patch).length || Object.keys(cols).length) await patchTopic(db, id, patch, cols, personId)
    refresh(id, list)
    return { message, name }
  })
}

/** The top candidates for a set of build rules, without saving them (the sliders' live preview). */
export async function previewRules(id: string, rules: Partial<Rules>): Promise<Done<{ top: { t: string; single: boolean }[]; singles: number }>> {
  return run(async () => {
    const { b } = await open(id)
    const a = createAnalysis({ ...b.project, buildRules: cleanRules(rules) }, b.pages)
    const list = a.candidates().list
    return { top: list.slice(0, 24).map(c => ({ t: c.t, single: c.n === 1 })), singles: list.slice(0, 30).filter(c => c.n === 1).length }
  })
}

/** Where a term is used, for the drawer on the Topic terms tab. */
export async function termContext(id: string, key: string, label: string): Promise<Done<{ context: TermContext }>> {
  return run(async () => {
    const { b } = await member(id)
    const k = text(key, 300)
    if (!k) throw new Say('That term is no longer on the list.')
    return { context: buildTermContext(createAnalysis(b.project, b.pages), k, text(label, 200) || k) }
  })
}

/** Deletes a topic for good: its brief, captured pages, history. The screen asks first. */
export async function deleteTopic(id: string): Promise<Done> {
  return run(async () => {
    const { db } = await open(id)
    await deleteTopicRow(db, id)
    refresh(id, true)
    return {}
  })
}


/* The writer workshop: the draft, its versions and feedback on the term list. */

const AUTO_VERSION_MS = 30 * 60 * 1000
const MIN_WORDS_FOR_VERSION = 30
const MAX_VERSION_CHARS = 180_000

/**
 * Saves the draft. `base` is the version the editor started from: when someone
 * else has saved since, nothing is written and `saved` is false with the current
 * version, so the screen can say so instead of overwriting their work. The HTML is
 * sanitized here again whatever the browser sent. A snapshot of what the draft
 * was is kept automatically when a first edit starts or half an hour has passed.
 */
export async function saveDraft(id: string, html: unknown, base: number): Promise<Done<{ saved: boolean; version: number; savedAt: string | null }>> {
  return run(async () => {
    const { db, personId, b } = await member(id)
    if (typeof html !== 'string') throw new Say('That draft could not be read.')
    if (html.length > MAX_DRAFT_CHARS * 2) throw new Say('This draft is too long to save.')
    const clean = sanitizeDraftHtml(html)
    const r = await saveDraftRow(db, id, clean, Number.isInteger(base) && base >= 0 ? base : 0, personId)
    if (r.saved) {
      const before = sanitizeDraftHtml(b.draft.html)
      if (before && before !== clean && before.length <= MAX_VERSION_CHARS && draftWords(before) >= MIN_WORDS_FOR_VERSION) {
        const last = await lastVersionAt(db, id)
        if (!last || Date.now() - Date.parse(last) > AUTO_VERSION_MS) await addVersionRow(db, id, 'auto', before, last ? '' : 'Before this editing session', draftWords(before), personId)
      }
    }
    return r
  })
}

/** Keeps a snapshot of the saved draft the writer can go back to. */
export async function saveVersionNow(id: string): Promise<Done<{ version: VersionInfo | null }>> {
  return run(async () => {
    const { db, personId, b } = await member(id)
    const html = sanitizeDraftHtml(b.draft.html)
    if (!html) throw new Say('Nothing to save yet. Write or paste your draft first.')
    if (html.length > MAX_VERSION_CHARS) throw new Say('This draft is too long to keep in version history.')
    await addVersionRow(db, id, 'saved', html, '', draftWords(html), personId)
    return { version: (await listVersionRows(db, id))[0] ?? null }
  })
}

export async function listVersions(id: string): Promise<Done<{ versions: VersionInfo[] }>> {
  return run(async () => {
    const { db } = await member(id)
    return { versions: await listVersionRows(db, id) }
  })
}

/** One version's text, for the preview in the history. */
export async function readVersion(id: string, versionId: number): Promise<Done<{ html: string }>> {
  return run(async () => {
    const { db } = await member(id)
    const html = Number.isInteger(versionId) ? await readVersionHtml(db, id, versionId) : null
    if (html === null) throw new Say('That version no longer exists.')
    return { html: sanitizeDraftHtml(html) }
  })
}

/** Puts an earlier version back as the draft; what the draft was is kept first. */
export async function restoreVersion(id: string, versionId: number): Promise<Done<{ html: string; version: number }>> {
  return run(async () => {
    const { db, personId, b } = await member(id)
    const stored = Number.isInteger(versionId) ? await readVersionHtml(db, id, versionId) : null
    if (stored === null) throw new Say('That version no longer exists.')
    const html = sanitizeDraftHtml(stored)
    const cur = sanitizeDraftHtml(b.draft.html)
    if (cur && cur !== html && cur.length <= MAX_VERSION_CHARS) await addVersionRow(db, id, 'restore', cur, 'Before restoring an earlier version', draftWords(cur), personId)
    const r = await saveDraftRow(db, id, html, b.draft.version, personId)
    if (!r.saved) throw new Say('The draft changed while you were restoring. Reload the page and try again.')
    return { html, version: r.version }
  })
}

/** What a writer thinks of the topic's term list, for the SEO team. */
export async function sendTermFeedback(id: string, rating: 'good' | 'problems', note: string): Promise<Done> {
  return run(async () => {
    const { db, personId } = await member(id)
    if (rating !== 'good' && rating !== 'problems') throw new Say('Choose whether the list is good or has problems.')
    const n = text(note, 2000)
    if (rating === 'problems' && !n) throw new Say('Say what the problem is, so the SEO team can fix the list.')
    await addFeedbackRow(db, id, rating, n, personId)
    refresh(id)
    return {}
  })
}

/** An SEO marks feedback as dealt with, or open again. */
export async function resolveFeedback(id: string, feedbackId: number, resolved: boolean): Promise<Done> {
  return run(async () => {
    const { db, personId } = await open(id)
    if (!Number.isInteger(feedbackId)) throw new Say('That feedback no longer exists.')
    await resolveFeedbackRow(db, id, feedbackId, personId, resolved === true)
    refresh(id)
    return {}
  })
}
