/**
 * What each Topic Studio tab shows (phase 1, 5 November 2026), as plain data a
 * client component can take as props: the Analysis worked into rows, counts and
 * sentences. Pure, so the numbers on screen are tested without a screen. The
 * wording of the guidance is the Artifact's.
 */

import { RULES_DEFAULT, letterGrade, makeAvoidTest, splitLines, type Rules } from './engine'
import type { Analysis } from './analysis'
import { AI_KEYS, AI_LABEL, missingAnswers, type AiKey, type Tier } from './project'

/* Competitors */

export interface CompetitorRow {
  i: number
  url: string
  domain: string
  rank: number | null
  cited: boolean
  title: string
  captured: boolean
  words: number
  flesch: number | null
  score: number | null
  grade: string
  headings: { l: number; t: string }[]
}

export interface CompetitorsView {
  rows: CompetitorRow[]
  done: number
  total: number
  words: { med: number; lo: number; hi: number }
  /** Average term score across captured pages; null until the term list is built. */
  avgScore: number | null
  hasTerms: boolean
}

export function competitorsView(a: Analysis): CompetitorsView {
  const hasTerms = a.project.terms.length > 0
  const sc = hasTerms ? a.compScores() : null
  const rows = a.comps.map((c, i): CompetitorRow => {
    const score = sc && sc.scores[i] != null ? sc.scores[i] : null
    return {
      i, url: c.url, domain: c.domain, rank: c.rank, cited: c.cited,
      title: c.page?.title || c.url, captured: !!c.src,
      words: c.src?.words ?? 0, flesch: c.src?.flesch ?? null,
      score, grade: score != null && sc ? letterGrade(score, sc.target) : '',
      headings: c.src?.headings ?? [],
    }
  })
  const w = a.wordStats()
  return { rows, done: a.comps.filter(c => c.page).length, total: a.comps.length, words: { med: w.med, lo: w.lo, hi: w.hi }, avgScore: sc ? sc.avg : null, hasTerms }
}

/* Topic terms */

export interface TermRow {
  key: string
  t: string
  tier: Tier
  src: string
  why: string
  /** The main term this one counts as, when it is a variant. */
  variantOf: { key: string; t: string } | null
  /** A phrase to avoid it matches, or ''. */
  avoid: string
  /** Why the build ranked it: helps answer a question, matches a secondary keyphrase. */
  reason: '' | 'answer' | 'question' | 'secondary'
  per: (number | null)[]
  df: number
  ai: number
  med: number
  min: number
  max: number
  aiPer: { label: string; v: number }[]
}

export interface TermsView {
  /** Every term in list order (the ranked view), variants included. */
  terms: TermRow[]
  /** The groups, each with the main terms in it (a variant follows its main term on screen). */
  groups: { name: string; other: boolean; keys: string[] }[]
  /** Variants by their main term's key. */
  variants: Record<string, string[]>
  concepts: number
  all: number
  tiers: Record<Tier, number>
  size: { tone: 'bad' | 'warn' | 'ok'; text: string; short: number; max: number } | null
  warnings: string[]
  rules: Rules
  defaults: Rules
  changedRules: number
  more: { t: string; k: string; df: number; ai: number }[]
  excluded: { t: string; k: string; df: number; ai: number; by: string }[]
  removed: { t: string; key: string; reason: string }[]
  /** Captured competitors and AI answers, for "used by 3/12". */
  N: number
  aiCount: number
  missing: { key: AiKey; label: string }[]
  /** Labels of the competitors in column order, for the dots' tooltips. */
  labels: (string | null)[]
  primaryTop: { t: string; single: boolean }[]
  singlesInTop: number
}

export function termsView(a: Analysis): TermsView {
  const p = a.project
  const terms = a.termObjs()
  const cands = a.N ? a.candidates() : { list: [], excluded: [], N: 0 }
  const whyOf = new Map(cands.list.map(c => [c.k, c.why]))
  const avoidTest = makeAvoidTest(p.rules.features.avoid ? p.avoid : '', [p.topic, p.primary].join('. '))
  const vm = a.variantMap()
  const byKey = new Map(terms.map(t => [t.key, t]))
  const concepts = a.concepts()

  const rows: TermRow[] = terms.map(t => {
    const s = a.termStats(t.key)
    const main = vm[t.key] ? byKey.get(vm[t.key]) : undefined
    const why = whyOf.get(t.key)
    return {
      key: t.key, t: t.t, tier: t.tier, src: t.src ?? 'data', why: t.why ?? '',
      variantOf: main ? { key: main.key, t: main.t } : null,
      avoid: avoidTest(t.t),
      reason: why === 'answer' || why === 'question' || why === 'secondary' ? why : '',
      per: s.per, df: s.df, ai: s.ai, med: s.med, min: s.min, max: s.max, aiPer: s.aiPer,
    }
  })

  const n = concepts.length
  const sz = p.rules.terms.size
  const size: TermsView['size'] = !n || !sz.on ? null
    : n < sz.thin ? { tone: 'bad', text: 'This list may be thin. Writers could miss important ideas, so look through More candidate terms for anything that matters.', short: sz.short, max: sz.max }
    : n < sz.short ? { tone: 'warn', text: 'A little short. Check More candidate terms for important ideas that are missing.', short: sz.short, max: sz.max }
    : n <= sz.max ? { tone: 'ok', text: 'A healthy range: focused enough for writers to use naturally while covering the topic.', short: sz.short, max: sz.max }
    : n <= sz.long ? { tone: 'warn', text: 'On the long side. Trim generic or overlapping terms so writers can focus on what matters.', short: sz.short, max: sz.max }
    : { tone: 'bad', text: 'This list may be too long to use naturally. Remove generic, duplicate or low-relevance terms.', short: sz.short, max: sz.max }

  const have = new Set(terms.map(t => t.key))
  const removedKeys = new Set(p.removed.map(r => r.key))
  const top = cands.list.slice(0, 30)
  const rules = a.rules
  const changed = (Object.keys(RULES_DEFAULT) as (keyof Rules)[]).filter(k => rules[k] !== RULES_DEFAULT[k]).length

  return {
    terms: rows,
    groups: terms.length ? a.termGroups().map(g => ({ name: g.name, other: g.other, keys: g.items.map(c => c.key) })) : [],
    variants: Object.fromEntries(concepts.filter(c => c.altKeys.length).map(c => [c.key, c.altKeys])),
    concepts: n,
    all: terms.length,
    tiers: { high: concepts.filter(c => c.tier === 'high').length, medium: concepts.filter(c => c.tier === 'medium').length, low: concepts.filter(c => c.tier === 'low').length },
    size,
    warnings: a.warnings(),
    rules,
    defaults: RULES_DEFAULT,
    changedRules: changed,
    more: cands.list.filter(c => !have.has(c.k) && !removedKeys.has(c.k)).slice(0, 40).map(c => ({ t: c.t, k: c.k, df: c.df, ai: c.ai || 0 })),
    excluded: cands.excluded.filter(x => !have.has(x.k)).slice(0, 80).map(x => ({ t: x.t, k: x.k, df: x.df, ai: x.ai || 0, by: x.by })),
    removed: p.removed.map(r => ({ t: r.t, key: r.key, reason: r.reason ?? '' })),
    N: a.N,
    aiCount: a.ais.length,
    missing: missingAnswers(p).map(key => ({ key, label: AI_LABEL[key] })),
    labels: a.comps.map(c => (c.src ? c.label : null)),
    primaryTop: top.slice(0, 24).map(c => ({ t: c.t, single: c.n === 1 })),
    singlesInTop: top.filter(c => c.n === 1).length,
  }
}

/* Questions */

export interface QuestionRow { key: string; q: string; why: string; reason: string; from: string[]; heading: boolean; src: string; off: boolean; direct: boolean }

export interface QuestionsView {
  answerTop: string[]
  direct: QuestionRow[]
  competitor: QuestionRow[]
  mine: QuestionRow[]
  claude: QuestionRow[]
  hasCompetitorQuestions: boolean
  captured: number
}

export function questionsView(a: Analysis): QuestionsView {
  const p = a.project
  const rows: QuestionRow[] = p.questions.map(q => ({
    key: q.key, q: q.q, why: q.why ?? '', reason: q.reason ?? '', from: q.from ?? [], heading: !!q.heading, src: q.src ?? 'competitor', off: !!q.off, direct: !!q.direct,
  }))
  const rest = rows.filter(q => !q.direct)
  return {
    answerTop: p.answerTop,
    direct: rows.filter(q => q.direct),
    claude: rest.filter(q => q.src === 'claude'),
    competitor: rest.filter(q => q.src === 'competitor'),
    mine: rest.filter(q => q.src === 'manual'),
    hasCompetitorQuestions: rows.some(q => q.src === 'competitor'),
    captured: a.N,
  }
}

/** Secondary keyphrase lines, for the Setup hints and the brief. */
export const secondaryLines = (a: Analysis): string[] => splitLines(a.project.secondary)
export { AI_KEYS }
