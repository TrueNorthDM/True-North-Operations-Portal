/**
 * What each edit on the Topic terms and Questions tabs does to a topic (phase 1,
 * 5 November 2026), as pure functions: each takes the topic's Project (and, for
 * groups, its Analysis) and returns the patch for ts_topics.data. The server
 * actions check access, call these and save the patch; nothing here touches the
 * database. Terms are named by key, never by position, so two people editing at
 * once cannot change the wrong term.
 */

import { RULES_DEFAULT, termKey, type Rules } from './engine'
import type { Analysis } from './analysis'
import type { Project, QuestionEntry, RemovedTerm, TermEntry, TermGroup, Tier } from './project'

export type Patch = Record<string, unknown>

const keyOf = (t: { t: string; key?: string }) => t.key || termKey(t.t)
const NEXT_TIER: Record<Tier, Tier> = { high: 'medium', medium: 'low', low: 'high' }

/** The automatic term list: the best candidates up to the size rule, by relevance thirds; terms added by hand stay. */
export function buildTerms(a: Analysis): Patch {
  const { list } = a.candidates()
  const keep = a.project.terms.filter(t => t.src === 'manual').map(t => ({ ...t, key: keyOf(t), tier: t.tier || 'high' }))
  const removed = new Set(a.project.removed.map(r => r.key))
  const have = new Set(keep.map(keyOf))
  const auto: TermEntry[] = []
  for (const c of list) {
    if (auto.length >= a.rules.size) break
    if (removed.has(c.k) || have.has(c.k)) continue
    auto.push({ t: c.t, key: c.k, src: 'data', tier: 'low' })
  }
  const third = Math.max(1, Math.ceil(auto.length / 3))
  auto.forEach((t, i) => { t.tier = i < third ? 'high' : i < third * 2 ? 'medium' : 'low' })
  return { terms: [...keep, ...auto], termsBuilt: Date.now() }
}

/** Throws a sentence for the person when the term is not on the list. */
function find(p: Project, key: string): number {
  const i = p.terms.findIndex(t => keyOf(t) === key)
  if (i < 0) throw new Error('That term is no longer on the list.')
  return i
}

export function cycleTier(p: Project, key: string): Patch {
  const terms = p.terms.map(t => ({ ...t }))
  const t = terms[find(p, key)]
  t.tier = NEXT_TIER[t.tier] ?? 'high'
  return { terms }
}

export function moveTerm(p: Project, key: string, dir: -1 | 1): Patch {
  const terms = p.terms.map(t => ({ ...t }))
  const i = find(p, key)
  const j = i + dir
  if (j < 0 || j >= terms.length) return {}
  ;[terms[i], terms[j]] = [terms[j], terms[i]]
  return { terms }
}

export function removeTerms(p: Project, keys: readonly string[], reason = 'removed by you'): Patch {
  const gone = new Set(keys)
  const out = p.terms.filter(t => gone.has(keyOf(t)))
  if (!out.length) throw new Error('That term is no longer on the list.')
  const removed: RemovedTerm[] = [...p.removed, ...out.map(t => ({ t: t.t, key: keyOf(t), reason }))]
  return { terms: p.terms.filter(t => !gone.has(keyOf(t))), removed }
}

export function addTerm(p: Project, text: string, opts: { key?: string; tier?: Tier } = {}): Patch {
  const t = text.trim().slice(0, 120)
  const key = opts.key || termKey(t)
  if (!t || !key) throw new Error('Type the term to add.')
  if (p.terms.some(x => keyOf(x) === key)) throw new Error('That term is already on the list.')
  const entry: TermEntry = { t, key, tier: opts.tier ?? 'high', src: 'manual' }
  // A term the person adds back is no longer "removed".
  return { terms: [...p.terms, entry], removed: p.removed.filter(r => r.key !== key) }
}

export function restoreTerm(p: Project, key: string): Patch {
  const r = p.removed.find(x => x.key === key)
  if (!r) throw new Error('That term is not in the removed list.')
  const terms: TermEntry[] = p.terms.some(t => keyOf(t) === key) ? p.terms : [...p.terms, { t: r.t, key: r.key, tier: 'medium', src: 'data' }]
  return { terms, removed: p.removed.filter(x => x.key !== key) }
}

export function restoreAll(p: Project): Patch {
  const have = new Set(p.terms.map(keyOf))
  const add: TermEntry[] = p.removed.filter(r => !have.has(r.key)).map(r => ({ t: r.t, key: r.key, tier: 'medium', src: 'data' }))
  return { terms: [...p.terms, ...add], removed: [] }
}

export function moveToEnd(p: Project, keys: readonly string[], where: 'top' | 'bottom'): Patch {
  const s = new Set(keys)
  const moving = p.terms.filter(t => s.has(keyOf(t)))
  const rest = p.terms.filter(t => !s.has(keyOf(t)))
  return { terms: where === 'top' ? [...moving, ...rest] : [...rest, ...moving] }
}

/** Not the same: the term stops counting as a variant of another. */
export function notVariant(p: Project, key: string): Patch {
  return { notVariant: { ...p.notVariant, [key]: true }, variantOf: Object.fromEntries(Object.entries(p.variantOf).filter(([k]) => k !== key)) }
}

/** Every term, group and variant choice cleared, the rules kept. */
export function clearBuild(): Patch {
  return { terms: [], removed: [], termGroups: null, groupsCustom: false, variantOf: {}, notVariant: {}, termsBuilt: null }
}

/** The rules a person set, kept only where they differ from the defaults and are within their slider's range. */
export const RULE_RANGE: Record<keyof Rules, [number, number]> = {
  size: [15, 60], singles: [10, 60], everyday: [0, 100], inside: [30, 100], fragments: [0, 100], spread: [0, 100], usage: [0, 100], headings: [0, 100], ai: [0, 100], setup: [0, 200],
}
export function cleanRules(input: unknown): Partial<Rules> {
  const out: Partial<Rules> = {}
  if (!input || typeof input !== 'object') return out
  for (const k of Object.keys(RULES_DEFAULT) as (keyof Rules)[]) {
    const v = (input as Record<string, unknown>)[k]
    if (typeof v !== 'number' || !Number.isFinite(v)) continue
    const [lo, hi] = RULE_RANGE[k]
    const n = Math.min(hi, Math.max(lo, Math.round(v)))
    if (n !== RULES_DEFAULT[k]) out[k] = n
  }
  return out
}

/* Groups: the first edit makes the groups the person's own (what the automatic grouping showed becomes the saved list). */

const OTHER = 'other terms'
export const groupNameOk = (groups: readonly TermGroup[], name: string, skip?: string): boolean =>
  !!name && name.toLowerCase() !== OTHER && !groups.some(g => g.name !== skip && g.name.toLowerCase() === name.toLowerCase())

function materialized(a: Analysis): TermGroup[] {
  if (a.project.groupsCustom) return (a.project.termGroups ?? []).map(g => ({ name: g.name, keys: [...g.keys] }))
  return a.termGroups().filter(g => !g.other).map(g => ({ name: g.name, keys: g.items.map(c => c.key) }))
}
const groupsPatch = (gs: TermGroup[]): Patch => ({ termGroups: gs, groupsCustom: true })

export function newGroup(a: Analysis, name?: string): { patch: Patch; name: string } {
  const gs = materialized(a)
  const taken = new Set([...gs.map(g => g.name.toLowerCase()), OTHER])
  let n = (name ?? 'New group').trim().slice(0, 60) || 'New group'
  if (taken.has(n.toLowerCase())) { let i = 2; while (taken.has(`${n} ${i}`.toLowerCase())) i++; n = `${n} ${i}` }
  gs.unshift({ name: n, keys: [] })
  return { patch: groupsPatch(gs), name: n }
}

export function renameGroup(a: Analysis, from: string, to: string): Patch {
  const gs = materialized(a)
  const name = to.trim().slice(0, 60)
  if (!groupNameOk(gs, name, from)) throw new Error('Choose a name that is not already used.')
  const g = gs.find(x => x.name === from)
  if (!g) throw new Error('That group no longer exists.')
  g.name = name
  return groupsPatch(gs)
}

export function deleteGroup(a: Analysis, name: string): Patch {
  const gs = materialized(a)
  const i = gs.findIndex(g => g.name === name)
  if (i < 0) throw new Error('That group no longer exists.')
  gs.splice(i, 1)
  return groupsPatch(gs)
}

/** Moves terms (with their variants, which follow the main term) to a group, or out of every group when `target` is null. */
export function moveKeysToGroup(a: Analysis, keys: readonly string[], target: string | null): Patch {
  const vm = a.variantMap()
  const mains = new Set(keys.map(k => vm[k] || k))
  const gs = materialized(a)
  for (const g of gs) g.keys = g.keys.filter(k => !mains.has(k))
  if (target) {
    const g = gs.find(x => x.name === target)
    if (!g) throw new Error('That group no longer exists.')
    g.keys.push(...mains)
  }
  return groupsPatch(gs)
}

/* Questions */

export function syncQuestions(p: Project, found: readonly { q: string; key: string; from: (string | undefined)[]; heading: boolean }[]): Patch {
  const map = new Map<string, QuestionEntry>(p.questions.map(q => [q.key, { ...q }]))
  for (const f of found.slice(0, 60)) {
    const from = f.from.filter((x): x is string => !!x)
    const e = map.get(f.key)
    if (e) { e.from = from; e.heading = f.heading }
    else map.set(f.key, { q: f.q, key: f.key, from, heading: f.heading, src: 'competitor', off: false })
  }
  return { questions: [...map.values()], questionsAt: Date.now() }
}

function question(p: Project, key: string): number {
  const i = p.questions.findIndex(q => q.key === key)
  if (i < 0) throw new Error('That question is no longer on the list.')
  return i
}

export function toggleDirect(p: Project, key: string): Patch {
  const qs = p.questions.map(q => ({ ...q }))
  const q = qs[question(p, key)]
  q.direct = !q.direct
  return { questions: qs }
}

export function toggleQuestionOff(p: Project, key: string): Patch {
  const qs = p.questions.map(q => ({ ...q }))
  const q = qs[question(p, key)]
  q.off = !q.off
  if (!q.off) delete q.reason
  return { questions: qs }
}

export function addDirectQuestion(p: Project, text: string): Patch {
  const q = text.trim().replace(/\s+/g, ' ').slice(0, 300)
  if (!q) throw new Error('Type the question to add.')
  const key = termKey(q.replace(/\?$/, '')) || q.toLowerCase()
  if (p.questions.some(x => x.key === key)) {
    // Already known (from a competitor, say): promote it instead of listing it twice.
    return { questions: p.questions.map(x => (x.key === key ? { ...x, direct: true, off: false } : x)) }
  }
  return { questions: [...p.questions, { q: /[?.!]$/.test(q) ? q : `${q}?`, key, src: 'manual', from: [], off: false, direct: true }] }
}

/** The "answer near the top" notes: plain lines, trimmed, empty ones dropped. */
export function cleanNotes(input: unknown, max = 30): string[] {
  if (!Array.isArray(input)) return []
  return input.filter((x): x is string => typeof x === 'string').map(s => s.trim().slice(0, 600)).filter(Boolean).slice(0, max)
}
