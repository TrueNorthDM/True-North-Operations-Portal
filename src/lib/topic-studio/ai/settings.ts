/**
 * Topic Studio's settings (phase 3 and 4, 6 November 2026): what an Admin can
 * change, in one validated shape. Stored as one JSON row in ts_settings (key
 * 'main'); anything missing or invalid falls back to the defaults below, so a
 * half-saved or hand-edited row can never break the tool.
 *
 *   ai        which Claude features are on, the model and effort of each, the
 *             daily limit and cooldown per person, models that may not be used,
 *             and the prompts an Admin edited.
 *   features  the Artifact's switches: which Setup fields and tabs are on.
 *   feedback  the rules behind the term list warnings and the writer panels.
 *
 * Pure and client-safe: the settings screen and the runner both read it.
 */

import { PROMPT_DEFS, PROMPT_ORDER, type PromptKey } from './prompt-defs'

export type Effort = 'low' | 'medium' | 'high'
export const EFFORTS: readonly Effort[] = ['low', 'medium', 'high']

/** The model every feature starts on; an Admin can pick another per feature. */
export const DEFAULT_MODEL = 'claude-opus-5-5'
/** Models offered in the settings; any other id may be typed (MODEL_RE). */
export const MODEL_CHOICES: readonly { id: string; label: string }[] = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (most capable, default)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (faster, lower cost)' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (fastest, lowest cost)' },
]
export const MODEL_RE = /^[a-z0-9][a-z0-9.:@_-]{2,80}$/i

export interface AiFeatureSetting { on: boolean; model: string; effort: Effort }

export interface AiSettings {
  features: Record<PromptKey, AiFeatureSetting>
  /** Runs per person per day (0 is no limit); Super Admins are never limited. */
  dailyCap: number
  /** Seconds before the same feature can run again for the same person (0 is none). */
  cooldownSec: number
  /** Words that make a model id unusable (priciest models stay off unless allowed). */
  blockedModels: string[]
  maxEffort: Effort
  /** Prompts an Admin edited; a missing one uses the default. */
  prompts: Partial<Record<PromptKey, string>>
}

export interface FeatureSwitches {
  secondary: boolean; rich: boolean; followups: boolean; avoid: boolean
  questions: boolean; sources: boolean; discussions: boolean; originality: boolean; interview: boolean
}

export interface FeedbackTerms {
  general: { minList: number }
  size: { on: boolean; thin: number; short: number; max: number; long: number }
  variants: { on: boolean; share: number; perTerm: number }
  bigGroup: { on: boolean; minTerms: number; share: number }
  fewGroups: { on: boolean; minTerms: number; groups: number }
  singles: { on: boolean; share: number }
  relevance: { on: boolean; share: number; spread: number; spreadOnce: number; minComps: number }
}
export interface FeedbackWriter {
  review: { on: boolean; noOriginal: boolean }
  coverage: { on: boolean; good: number; ok: number; h1: boolean; intro: boolean; keys: boolean; cover: number; keyNeed: number; introWords: number }
  length: { on: boolean; thin: number; long: number }
  readability: { on: boolean; target: number }
  terms: { on: boolean; grouped: boolean }
  used: { on: boolean; overuse: boolean; minWords: number; termMult: number; termPer1k: number; wordPer1k: number }
}

export interface TsSettings {
  ai: AiSettings
  features: FeatureSwitches
  feedback: { terms: FeedbackTerms; writer: FeedbackWriter }
}

export const FEATURE_DEFAULTS: FeatureSwitches = { secondary: true, rich: false, followups: false, avoid: true, questions: true, sources: true, discussions: true, originality: true, interview: true }

export const FEEDBACK_TERMS_DEFAULT: FeedbackTerms = {
  general: { minList: 10 },
  size: { on: true, thin: 15, short: 20, max: 35, long: 45 },
  variants: { on: true, share: 25, perTerm: 4 },
  bigGroup: { on: true, minTerms: 8, share: 35 },
  fewGroups: { on: true, minTerms: 15, groups: 3 },
  singles: { on: true, share: 70 },
  relevance: { on: true, share: 70, spread: 30, spreadOnce: 50, minComps: 3 },
}
export const FEEDBACK_WRITER_DEFAULT: FeedbackWriter = {
  review: { on: true, noOriginal: true },
  coverage: { on: true, good: 86, ok: 65, h1: true, intro: true, keys: true, cover: 66, keyNeed: 2, introWords: 160 },
  length: { on: true, thin: 800, long: 2500 },
  readability: { on: true, target: 60 },
  terms: { on: true, grouped: true },
  used: { on: true, overuse: true, minWords: 150, termMult: 2, termPer1k: 5, wordPer1k: 10 },
}

export const AI_DEFAULTS: AiSettings = {
  features: Object.fromEntries(PROMPT_ORDER.map(k => [k, { on: true, model: DEFAULT_MODEL, effort: 'medium' as Effort }])) as Record<PromptKey, AiFeatureSetting>,
  dailyCap: 50,
  cooldownSec: 15,
  blockedModels: ['fable', 'mythos'],
  maxEffort: 'high',
  prompts: {},
}

export const DEFAULT_SETTINGS: TsSettings = {
  ai: AI_DEFAULTS,
  features: FEATURE_DEFAULTS,
  feedback: { terms: FEEDBACK_TERMS_DEFAULT, writer: FEEDBACK_WRITER_DEFAULT },
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** Keeps the keys of `base`, taking a value from `raw` only when it has the same type (numbers within [lo, hi] when `range` has the key). */
function merge<T extends Record<string, unknown>>(base: T, raw: unknown, range: Record<string, [number, number]> = {}): T {
  const out: Record<string, unknown> = { ...base }
  if (!isObj(raw)) return out as T
  for (const k of Object.keys(base)) {
    const b = base[k]
    const v = raw[k]
    if (isObj(b)) out[k] = merge(b as Record<string, unknown>, v, isObj(range[k] as unknown) ? (range[k] as unknown as Record<string, [number, number]>) : range)
    else if (typeof b === 'boolean' && typeof v === 'boolean') out[k] = v
    else if (typeof b === 'number' && typeof v === 'number' && Number.isFinite(v)) { const [lo, hi] = range[k] ?? [0, 100000]; out[k] = Math.min(hi, Math.max(lo, v)) }
  }
  return out as T
}

export const modelBlocked = (model: string, blocked: readonly string[]): string => {
  const m = model.toLowerCase()
  return blocked.map(w => w.trim().toLowerCase()).filter(Boolean).find(w => m.includes(w)) ?? ''
}
const effortOk = (e: unknown): e is Effort => EFFORTS.includes(e as Effort)

/** Settings from whatever was stored (or nothing): always complete and valid. */
export function readSettings(raw: unknown): TsSettings {
  const r = isObj(raw) ? raw : {}
  const ai = isObj(r.ai) ? r.ai : {}
  const feats = isObj(ai.features) ? ai.features : {}
  const features = Object.fromEntries(PROMPT_ORDER.map(k => {
    const f = isObj(feats[k]) ? (feats[k] as Record<string, unknown>) : {}
    const model = typeof f.model === 'string' && MODEL_RE.test(f.model.trim()) ? f.model.trim() : DEFAULT_MODEL
    return [k, { on: typeof f.on === 'boolean' ? f.on : true, model, effort: effortOk(f.effort) ? f.effort : 'medium' }]
  })) as Record<PromptKey, AiFeatureSetting>
  const prompts: Partial<Record<PromptKey, string>> = {}
  if (isObj(ai.prompts)) for (const k of PROMPT_ORDER) { const t = ai.prompts[k]; if (typeof t === 'string' && t.trim() && t !== PROMPT_DEFS[k].template) prompts[k] = t.slice(0, 40000) }
  const blocked = Array.isArray(ai.blockedModels) ? ai.blockedModels.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map(x => x.trim().slice(0, 40)).slice(0, 20) : AI_DEFAULTS.blockedModels
  return {
    ai: {
      features,
      dailyCap: typeof ai.dailyCap === 'number' && Number.isFinite(ai.dailyCap) ? Math.min(1000, Math.max(0, Math.round(ai.dailyCap))) : AI_DEFAULTS.dailyCap,
      cooldownSec: typeof ai.cooldownSec === 'number' && Number.isFinite(ai.cooldownSec) ? Math.min(3600, Math.max(0, Math.round(ai.cooldownSec))) : AI_DEFAULTS.cooldownSec,
      blockedModels: blocked,
      maxEffort: effortOk(ai.maxEffort) ? ai.maxEffort : AI_DEFAULTS.maxEffort,
      prompts,
    },
    features: merge(FEATURE_DEFAULTS as unknown as Record<string, unknown>, r.features) as unknown as FeatureSwitches,
    feedback: {
      terms: merge(FEEDBACK_TERMS_DEFAULT as unknown as Record<string, unknown>, isObj(r.feedback) ? r.feedback.terms : null, { minList: [3, 30], thin: [1, 100], short: [1, 100], max: [1, 100], long: [1, 150], share: [5, 100], perTerm: [2, 12], minTerms: [3, 60], groups: [1, 10], spread: [10, 60], spreadOnce: [20, 80], minComps: [1, 10] }) as unknown as FeedbackTerms,
      writer: merge(FEEDBACK_WRITER_DEFAULT as unknown as Record<string, unknown>, isObj(r.feedback) ? r.feedback.writer : null, { good: [50, 100], ok: [20, 100], cover: [30, 100], keyNeed: [1, 5], introWords: [50, 400], thin: [100, 3000], long: [500, 10000], target: [0, 100], minWords: [50, 1000], termMult: [1, 5], termPer1k: [1, 20], wordPer1k: [3, 40] }) as unknown as FeedbackWriter,
    },
  }
}

export interface FeatureConfig {
  on: boolean
  model: string
  effort: Effort
  /** The model that was asked for but is blocked, or ''. */
  blockedModel: string
}

/** What a feature runs with: its model (the default when the chosen one is blocked) and its effort (never above the maximum). */
export function featureConfig(s: AiSettings, key: PromptKey): FeatureConfig {
  const f = s.features[key]
  const blockedModel = modelBlocked(f.model, s.blockedModels) ? f.model : ''
  const effort = EFFORTS.indexOf(f.effort) > EFFORTS.indexOf(s.maxEffort) ? s.maxEffort : f.effort
  return { on: f.on, model: blockedModel ? DEFAULT_MODEL : f.model, effort, blockedModel }
}

/** The prompt a feature sends: the Admin's edit, else the default. */
export const promptTemplate = (s: AiSettings, key: PromptKey): string => s.prompts[key] ?? PROMPT_DEFS[key].template

const PH_RE = /\{\{\s*(\w+)\s*\}\}/g
/** Fills the data variables; an unknown one becomes empty. */
export const fillPrompt = (template: string, values: Record<string, string | number>): string =>
  template.replace(PH_RE, (_m, k: string) => (k in values ? String(values[k]) : ''))

/** A sentence when an edited prompt would break the feature, or ''. */
export function validatePrompt(key: PromptKey, text: string): string {
  const def = PROMPT_DEFS[key]
  const used = [...text.matchAll(PH_RE)].map(m => m[1])
  const known = new Set(def.vars.map(v => v[0]))
  const unknown = [...new Set(used.filter(k => !known.has(k)))]
  if (unknown.length) return `Unknown variable${unknown.length === 1 ? '' : 's'}: ${unknown.map(k => `{{${k}}}`).join(', ')}. Use only the variables listed for this prompt.`
  const missing = def.vars.filter(v => v[2] && !used.includes(v[0])).map(v => `{{${v[0]}}}`)
  if (missing.length) return `Keep ${missing.join(', ')} in the prompt. Claude needs that data to do the job.`
  if (!/json/i.test(text)) return 'Keep the instruction to reply with JSON. The tool cannot read the answer without it.'
  if (text.length > 40000) return 'This prompt is too long.'
  return ''
}
