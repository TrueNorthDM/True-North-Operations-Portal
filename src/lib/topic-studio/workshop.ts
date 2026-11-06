/**
 * The writer workshop's checks (Topic Studio, phase 2, 6 November 2026): what the
 * panels beside the editor say about a draft, ported from the Artifact.
 *
 * The server prepares a WorkshopModel from the topic's analysis (the terms, their
 * groups, the competitors' target and typical rates); the browser then checks the
 * draft against it as the writer types, with the same engine. Nothing here needs a
 * DOM or the database, so the numbers are tested without a screen.
 *
 * There are no grades and no length or term-count targets from competitors: the
 * writer gets guidance, not a score to chase (the SEO team's decision, in the
 * video). A term is "covered" by its own wording or any variant that counts as
 * the same term, and by word roots, so "track" and "tracking" are one idea.
 */

import {
  GENERIC, STOP, buildSource, contentRoots, countIn, median, rootOf, scoreAgainst, tokenize,
  type Block, type Source, type Term,
} from './engine'
import type { Analysis } from './analysis'
import type { FeedbackWriter } from './ai/settings'
import type { Tier } from './project'

export interface WorkshopTerm { t: string; key: string; tier: Tier; alts: string[]; altKeys: string[]; group: string }

export interface WorkshopModel {
  primary: string
  terms: WorkshopTerm[]
  /** Group names in display order (Other terms last). */
  groups: string[]
  /** The best competitors' term score, the yardstick for "covers the topic". */
  target: number
  /** The five to ten most important terms, for the introduction check. */
  keyTerms: { t: string; alts: string[] }[]
  /** How often competitors use each term, per 1,000 words (median over the pages that use it). */
  rates: Record<string, number>
  /** The writer-side feedback rules from the settings. */
  rules: FeedbackWriter
}

const per1k = (n: number, words: number) => (words ? (1000 * n) / words : 0)

export function workshopModel(a: Analysis): WorkshopModel {
  const concepts = a.concepts()
  const groupOf = new Map<string, string>()
  const groups = a.termGroups()
  for (const g of groups) for (const c of g.items) groupOf.set(c.key, g.name)
  const rates: Record<string, number> = {}
  for (const c of concepts) {
    const keys = [c.key, ...c.altKeys]
    const r = a.live.map(src => per1k(keys.reduce((n, k) => n + countIn(src, k), 0), src.words)).filter(x => x > 0)
    rates[c.key] = median(r)
  }
  return {
    primary: a.project.primary,
    terms: concepts.map(c => ({ t: c.t, key: c.key, tier: c.tier, alts: c.alts, altKeys: c.altKeys, group: groupOf.get(c.key) ?? 'Other terms' })),
    groups: groups.map(g => g.name),
    target: a.compScores().target,
    keyTerms: a.keyTerms().map(k => ({ t: k.t, alts: k.alts })),
    rates,
    rules: a.project.rules.writer,
  }
}

/* The draft as the engine reads it. */

export const draftSource = (blocks: Block[]): Source => buildSource({ label: 'Your draft' }, blocks, null)

const asTerm = (t: WorkshopTerm): Term => ({ ...t })

/** The introduction: what comes before the first subheading (or the first paragraphs), cut to the rule's length. */
export function introText(blocks: Block[], words = 160): string {
  const pre: string[] = []
  for (const [tag, text] of blocks) {
    if (/^h[2-6]$/.test(tag)) break
    if (tag === 'h1') continue
    pre.push(text)
  }
  const use = pre.length ? pre : blocks.filter(b => !/^h/.test(b[0])).slice(0, 3).map(b => b[1])
  return use.join(' ').split(/\s+/).slice(0, words).join(' ')
}

export type Check = { st: 'ok' | 'part' | 'no' | null; l: string }

/** The keyphrase checks: matched by word roots, so word endings are ignored and most meaningful words must appear. */
export function keyChecks(m: WorkshopModel, d: Source | null): Check[] {
  const labels = ['Primary keyphrase ideas in the H1', 'Primary keyphrase ideas in the introduction', 'Some key terms in the introduction']
  if (!d) return labels.map(l => ({ st: null, l }))
  const cv = m.rules.coverage
  const pk = contentRoots(m.primary)
  const cover = (txt: string): 'ok' | 'part' | 'no' | null => {
    if (!pk.length) return null
    const set = new Set(contentRoots(txt))
    const n = pk.filter(r => set.has(r)).length
    return n / pk.length >= cv.cover / 100 ? 'ok' : n > 0 ? 'part' : 'no'
  }
  const h1 = d.headings.find(h => h.l === 1) ?? d.headings[0]
  const intro = introText(d.blocks, cv.introWords)
  const iset = new Set(contentRoots(intro))
  const hits = m.keyTerms.filter(t => [t.t, ...t.alts].some(x => { const rs = contentRoots(x); return rs.length > 0 && rs.every(r => iset.has(r)) })).length
  const need = m.keyTerms.length >= 4 ? cv.keyNeed : 1
  return [
    { st: h1 ? cover(h1.t) : 'no', l: labels[0] },
    { st: intro ? cover(intro) : 'no', l: labels[1] },
    { st: m.keyTerms.length ? (hits >= need ? 'ok' : hits > 0 ? 'part' : 'no') : null, l: labels[2] },
  ]
}

export function readingLabel(f: number | null): string {
  if (f == null) return ''
  if (f >= 90) return 'Very easy to read'
  if (f >= 80) return 'Easy to read'
  if (f >= 70) return 'Fairly easy to read'
  if (f >= 60) return 'Standard plain English'
  if (f >= 50) return 'Fairly difficult to read'
  if (f >= 30) return 'Difficult to read'
  if (f >= 10) return 'Very difficult to read'
  return 'Very confusing'
}

export type Tone = 'good' | 'neutral' | 'poor' | 'warn' | 'ok'
export interface Say { tone: Tone; text: string }

export interface DraftReport {
  words: number
  flesch: number | null
  coverage: Say
  length: Say
  read: (Say & { label: string }) | null
  checks: Check[]
  used: WorkshopTerm[]
  missing: WorkshopTerm[]
}

/** How the draft stands against the topic. Null while there is no draft. */
export function analyzeDraft(m: WorkshopModel, blocks: Block[]): DraftReport | null {
  if (!blocks.length) return null
  const d = draftSource(blocks)
  const cv = m.rules.coverage
  const ln = m.rules.length
  const rd = m.rules.readability
  const mine = scoreAgainst(d, m.terms.map(asTerm))
  const ratio = mine.score / Math.max(35, m.target || 0)
  const missing = m.terms.filter(t => !mine.used.has(t.key))
  const used = m.terms.filter(t => mine.used.has(t.key))
  const highMissing = missing.filter(t => t.tier === 'high')

  const coverage: Say = ratio >= cv.good / 100
    ? { tone: 'good', text: 'The draft covers the topic’s key ideas well. Focus on making each section clear, specific and genuinely helpful.' }
    : ratio >= cv.ok / 100
      ? { tone: 'neutral', text: `Some key ideas may be missing${highMissing.length ? ', including important ones' : ''}. Look through Terms to consider and work in the ones that genuinely help the reader.` }
      : { tone: 'poor', text: 'The draft may have gaps or be thin. Several important ideas aren’t covered yet. Check Terms to consider and the questions readers need answered.' }
  const length: Say = d.words < ln.thin
    ? { tone: 'warn', text: 'This may be thin. Check that readers’ questions are fully answered. If everything needed is covered, a shorter article is fine.' }
    : d.words > ln.long
      ? { tone: 'warn', text: 'This is long. Check for fluff, repetition or off-topic sections that could overwhelm readers.' }
      : { tone: 'ok', text: 'A typical length for a thorough article. No word count guarantees success; covering what readers need matters most.' }
  const f = d.flesch ?? null
  const read = f == null ? null : { ...(f >= rd.target ? { tone: 'ok' as const, text: 'Good. Aim to keep it at plain English or easier.' } : { tone: 'warn' as const, text: 'Aim for plain English or easier. Shorten long sentences and swap complex words for simpler ones.' }), label: readingLabel(f) }
  const all = keyChecks(m, d)
  const checks = all.filter((_, i) => [cv.h1, cv.intro, cv.keys][i])
  return { words: d.words, flesch: f, coverage, length, read, checks, used, missing }
}

export interface Overuse { items: { w: string; n: number; x: number; term: boolean }[]; short: boolean }

/** Words and terms used noticeably more than is natural for the draft's length (rules adjustable in phase 4). */
export function overuseCheck(m: WorkshopModel, blocks: Block[]): Overuse {
  const us = m.rules.used
  const d = draftSource(blocks)
  if (d.words < us.minWords) return { items: [], short: true }
  const items: Overuse['items'] = []
  const termWords = new Set<string>()
  for (const t of m.terms) {
    const keys = [t.key, ...t.altKeys]
    const n = keys.reduce((a, k) => a + countIn(d, k), 0)
    for (const k of keys) for (const w of k.split(' ')) termWords.add(w)
    if (n < 4) continue
    const typical = m.rates[t.key] ?? 0
    const mine = per1k(n, d.words)
    const limit = Math.max(us.termMult * typical, us.termPer1k)
    if (mine > limit) items.push({ w: t.t, n, x: mine / limit, term: true })
  }
  const counts = new Map<string, { n: number; f: Map<string, number> }>()
  for (const seg of d.segs) seg.sf.forEach((w, i) => {
    if (STOP.has(w) || w.length < 4 || /^\d+$/.test(w) || GENERIC.has(w)) return
    const s = seg.st[i]
    const e = counts.get(s) ?? { n: 0, f: new Map<string, number>() }
    e.n++
    e.f.set(w, (e.f.get(w) ?? 0) + 1)
    counts.set(s, e)
  })
  for (const [s, e] of counts) {
    if (termWords.has(s) || e.n < 5) continue
    const mine = per1k(e.n, d.words)
    if (mine <= us.wordPer1k) continue
    const form = [...e.f.entries()].sort((a, b) => b[1] - a[1])[0][0]
    items.push({ w: form, n: e.n, x: mine / us.wordPer1k, term: false })
  }
  items.sort((a, b) => b.x - a.x)
  return { items: items.slice(0, 12), short: false }
}

/* Highlighting: where the topic terms sit in the text. */

export interface HighlightSpec { key: string; roots: string[] }
export interface Range { a: number; b: number; key: string }

const WORD = /[A-Za-z0-9À-ɏ]+(?:['’][A-Za-z]+)?/g
function wordPositions(text: string): { r: string; a: number; b: number }[] {
  const out: { r: string; a: number; b: number }[] = []
  const re = new RegExp(WORD.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) out.push({ r: rootOf(m[0]), a: m.index, b: m.index + m[0].length })
  return out
}

/** Every term and every variant, as word roots, longest first so a phrase wins over its words. */
export function highlightSpecs(m: WorkshopModel): HighlightSpec[] {
  return m.terms.flatMap(c => [{ t: c.t, key: c.key }, ...c.alts.map(x => ({ t: x, key: c.key }))])
    .map(x => ({ key: x.key, roots: tokenize(x.t).flatMap(s => s.sf).map(rootOf) }))
    .filter(x => x.roots.length)
    .sort((a, b) => b.roots.length - a.roots.length)
}

/** The stretches of `text` that are a term (by roots, words joined by spaces or hyphens only), no two overlapping. */
export function termRangesIn(text: string, specs: readonly HighlightSpec[]): Range[] {
  const wp = wordPositions(text)
  const ranges: Range[] = []
  for (const { roots, key } of specs) for (let i = 0; i + roots.length <= wp.length; i++) {
    let ok = true
    for (let k = 0; k < roots.length; k++) {
      if (wp[i + k].r !== roots[k]) { ok = false; break }
      if (k && !/^[\s\-–]+$/.test(text.slice(wp[i + k - 1].b, wp[i + k].a))) { ok = false; break }
    }
    if (!ok) continue
    const a = wp[i].a
    const b = wp[i + roots.length - 1].b
    if (!ranges.some(r => a < r.b && b > r.a)) ranges.push({ a, b, key })
  }
  return ranges.sort((x, y) => x.a - y.a)
}
