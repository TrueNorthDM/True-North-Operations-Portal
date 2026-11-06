/**
 * A Topic Studio topic as the screens work with it (phase 1, 5 November 2026).
 *
 * ts_topics keeps the topic's own columns (name, primary keyphrase, Monday
 * link, client, shared) and one JSON `data` with everything else, in the shape
 * the Artifact exports, so an imported topic and one made here are the same
 * thing. readProject() lays the columns over the data and fills what is
 * missing; the screens and the analysis only ever see a Project.
 *
 * Which features are on is fixed for now (the Artifact's own defaults:
 * secondary keyphrases, terms to avoid and the Questions tab on, the rest off);
 * the settings area of phase 4 makes them adjustable.
 */

import { RULES_DEFAULT, termKey } from './engine'
import type { Block } from './engine'

export type Tier = 'high' | 'medium' | 'low'
export type TermSource = 'data' | 'manual' | 'claude'

export interface TermEntry {
  t: string
  key?: string
  tier: Tier
  src?: TermSource
  why?: string
}

export interface RemovedTerm { t: string; key: string; reason?: string }
export interface TermGroup { name: string; keys: string[] }

export interface QuestionEntry {
  q: string
  key: string
  from?: string[]
  heading?: boolean
  src?: 'competitor' | 'manual' | 'claude'
  off?: boolean
  direct?: boolean
  why?: string
  reason?: string
}

/** A captured page, as ts_pages keeps it. */
export interface TopicPage {
  /** The Artifact's id for the page ('c' + a hash of its address), kept by an import. */
  artifactId: string | null
  kind: string
  url: string
  title: string
  desc: string
  blocks: Block[]
  links: [string, string][]
  capturedAt: string | null
  method: string
}

export const AI_KEYS = ['aiOverview', 'aiChatgpt', 'aiGemini', 'aiPerplexity'] as const
export type AiKey = (typeof AI_KEYS)[number]
export const AI_LABEL: Record<AiKey, string> = { aiOverview: 'AI Overview', aiChatgpt: 'ChatGPT', aiGemini: 'Gemini', aiPerplexity: 'Perplexity' }

export interface Project {
  topic: string
  primary: string
  monday: string
  client: string
  secondary: string
  avoid: string
  rich: string
  aiFollowups: string
  aiOverview: string
  aiChatgpt: string
  aiGemini: string
  aiPerplexity: string
  /** The top organic URLs in rank order (empty strings keep their place). */
  organic: string[]
  /** URLs the AI Overview cites. */
  cited: string[]
  terms: TermEntry[]
  removed: RemovedTerm[]
  termGroups: TermGroup[] | null
  groupsCustom: boolean
  variantOf: Record<string, string>
  notVariant: Record<string, boolean>
  buildRules: Partial<typeof RULES_DEFAULT>
  questions: QuestionEntry[]
  answerTop: string[]
  /** The draft an import brought, used until the topic has a draft of its own (ts_drafts). */
  draftHtml: string
  shared: boolean
}

/** The Artifact's feature switches; fixed until the settings area (phase 4). */
export const FEATURES = { secondary: true, rich: false, followups: false, avoid: true, questions: true } as const

/** The term list feedback rules (the Artifact's defaults; adjustable in phase 4). */
export const FEEDBACK_TERMS = {
  general: { minList: 10 },
  size: { on: true, thin: 15, short: 20, max: 35, long: 45 },
  variants: { on: true, share: 25, perTerm: 4 },
  bigGroup: { on: true, minTerms: 8, share: 35 },
  fewGroups: { on: true, minTerms: 15, groups: 3 },
  singles: { on: true, share: 70 },
  relevance: { on: true, share: 70, spread: 30, spreadOnce: 50, minComps: 3 },
} as const

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown): string => (typeof v === 'string' ? v : '')
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const strings = (v: unknown): string[] => list(v).filter((x): x is string => typeof x === 'string')
const TIERS: readonly Tier[] = ['high', 'medium', 'low']

/** The topic row and its JSON as a Project. Tolerant: an export from an older Artifact may lack any field. */
export function readProject(row: { topic: string; primary_keyphrase: string; monday_url: string | null; client_code: string; shared: boolean; data: unknown }): Project {
  const d = isObj(row.data) ? row.data : {}
  const terms: TermEntry[] = list(d.terms).filter(isObj).filter(t => typeof t.t === 'string' && t.t.trim()).map(t => ({
    t: String(t.t),
    key: typeof t.key === 'string' && t.key ? t.key : termKey(String(t.t)),
    tier: (TIERS as readonly unknown[]).includes(t.tier) ? (t.tier as Tier) : 'medium',
    ...(t.src === 'manual' || t.src === 'claude' || t.src === 'data' ? { src: t.src } : {}),
    ...(typeof t.why === 'string' && t.why ? { why: t.why } : {}),
  }))
  const removed: RemovedTerm[] = list(d.removed).filter(isObj).filter(r => typeof r.t === 'string').map(r => ({
    t: String(r.t), key: typeof r.key === 'string' && r.key ? r.key : termKey(String(r.t)), ...(typeof r.reason === 'string' ? { reason: r.reason } : {}),
  }))
  const groups = Array.isArray(d.termGroups)
    ? list(d.termGroups).filter(isObj).map(g => ({ name: text(g.name), keys: strings(g.keys) })).filter(g => g.name)
    : null
  const questions: QuestionEntry[] = list(d.questions).filter(isObj).filter(q => typeof q.q === 'string' && q.q).map(q => ({
    q: String(q.q),
    key: typeof q.key === 'string' && q.key ? q.key : termKey(String(q.q).replace(/\?$/, '')),
    from: strings(q.from),
    heading: q.heading === true,
    src: q.src === 'manual' || q.src === 'claude' ? q.src : 'competitor',
    off: q.off === true,
    direct: q.direct === true,
    ...(typeof q.why === 'string' && q.why ? { why: q.why } : {}),
    ...(typeof q.reason === 'string' && q.reason ? { reason: q.reason } : {}),
  }))
  const map = (v: unknown): Record<string, string> => (isObj(v) ? Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x === 'string')) as Record<string, string> : {})
  const flags = (v: unknown): Record<string, boolean> => (isObj(v) ? Object.fromEntries(Object.entries(v).filter(([, x]) => x === true).map(([k]) => [k, true])) : {})
  const rules: Partial<typeof RULES_DEFAULT> = {}
  if (isObj(d.buildRules)) for (const k of Object.keys(RULES_DEFAULT) as (keyof typeof RULES_DEFAULT)[]) { const v = (d.buildRules as Record<string, unknown>)[k]; if (typeof v === 'number' && Number.isFinite(v)) rules[k] = v }
  return {
    topic: row.topic,
    primary: row.primary_keyphrase,
    monday: row.monday_url ?? '',
    client: row.client_code,
    secondary: text(d.secondary),
    avoid: text(d.avoid),
    rich: text(d.rich),
    aiFollowups: text(d.aiFollowups),
    aiOverview: text(d.aiOverview),
    aiChatgpt: text(d.aiChatgpt),
    aiGemini: text(d.aiGemini),
    aiPerplexity: text(d.aiPerplexity),
    organic: list(d.organic).map(u => (typeof u === 'string' ? u : '')),
    cited: strings(d.cited),
    terms,
    removed,
    termGroups: groups,
    groupsCustom: d.groupsCustom === true,
    variantOf: map(d.variantOf),
    notVariant: flags(d.notVariant),
    buildRules: rules,
    questions,
    answerTop: strings(d.answerTop),
    draftHtml: text(d.draftHtml),
    shared: row.shared,
  }
}

/** A ts_pages row as a TopicPage. */
export function readPage(row: { artifact_id: string | null; kind: string; url: string; title: string; data: unknown; captured_at: string | null }): TopicPage {
  const d = isObj(row.data) ? row.data : {}
  const blocks: Block[] = list(d.blocks).filter((b): b is [string, string] => Array.isArray(b) && typeof b[0] === 'string' && typeof b[1] === 'string')
  const links: [string, string][] = list(d.links).filter((l): l is [string, string] => Array.isArray(l) && typeof l[0] === 'string').map(l => [l[0], typeof l[1] === 'string' ? l[1] : ''])
  return { artifactId: row.artifact_id, kind: row.kind, url: row.url, title: row.title, desc: text(d.desc), blocks, links, capturedAt: row.captured_at, method: text(d.method) }
}

/** The AI answers that count: filled in, and not "none". */
export const hasAnswer = (p: Project, k: AiKey): boolean => {
  const v = p[k].trim()
  return !!v && !/^(none|n\/a|no ai overview( shown)?)\.?$/i.test(v)
}
/** The answers still empty (all four are needed before building the term list). */
export const missingAnswers = (p: Project): AiKey[] => AI_KEYS.filter(k => !p[k].trim())
