/**
 * The nine Claude features of Topic Studio (phase 3, 6 November 2026), ported from
 * the Artifact: for each, how its prompt is filled from the topic (prepare) and
 * what an answer does to the topic (apply). Pure: no database, no network, so each
 * is tested with canned answers. ai/run.ts does the calling, the limits and the
 * saving.
 *
 * A feature that cannot run yet (no captured page, no draft, no terms) says so in
 * a sentence the person can act on (NeedsMore). An answer that cannot be read is
 * Unreadable. Whatever Claude returns is checked and cut down by ai/results.ts
 * before it reaches the topic.
 */

import {
  bibleRefs, countIn, hashId, sectionsWith, termKey,
  type Source,
} from '../engine'
import type { Analysis } from '../analysis'
import { draftBlocks } from '../draft-blocks'
import { AI_LABEL, AI_KEYS, hasAnswer } from '../project'
import type { ClientFull } from '../store'
import { syncQuestions, type Patch } from '../term-ops'
import { draftSource } from '../workshop'
import type { TopicPage } from '../project'
import { PROMPT_ORDER, type PromptKey } from './prompt-defs'
import { fillPrompt, promptTemplate, type TsSettings } from './settings'
import { str, strs } from './results'

/** A feature cannot run yet; the message says what to do first. */
export class NeedsMore extends Error {}
/** Claude's answer had no usable shape. */
export class Unreadable extends Error {
  constructor(message = 'Claude’s answer could not be read. Try again.') { super(message) }
}

export interface AiContext {
  analysis: Analysis
  /** Every captured page of the topic (competitors and discussions). */
  pages: readonly TopicPage[]
  client: ClientFull
  settings: TsSettings
  /** The topic's draft, sanitized (empty when there is none). */
  draftHtml: string
}

export interface FeatureRun {
  /** The filled prompt; null when nothing needs asking (the patch is already known). */
  prompt: string | null
  /** What the answer does to the topic. */
  apply(answer: unknown): Patch
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s)
const joined = (s: string) => s.split('\n').map(x => x.trim()).filter(Boolean).join('; ') || 'none'
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

export const clientIntro = (c: ClientFull): string => `${c.name} (${c.code})${c.about ? `. About the client and its audience: ${c.about}` : ''}`
const original = (c: ClientFull): string => c.orig || 'Stories, quotes, advice and use cases from real experience.'

/** The pasted AI answers, each cut to `maxEach`. */
export function aiAnswersText(a: Analysis, maxEach: number): string {
  const parts = AI_KEYS.filter(k => hasAnswer(a.project, k)).map(k => `${AI_LABEL[k]} answer:\n${clip(a.project[k], maxEach)}`)
  return parts.length ? parts.join('\n\n') : 'No AI answers provided.'
}

/** A page's blocks as text, headings marked, cut to `max` characters. */
export function condensed(src: Source, max: number): string {
  const out: string[] = []
  let n = 0
  for (const [tag, text] of src.blocks) {
    const line = /^h\d$/.test(tag) ? `\n${tag.toUpperCase()}: ${text}` : text
    out.push(line)
    n += line.length + 1
    if (n > max) break
  }
  return clip(out.join('\n'), max)
}

/** Bible books the competitors cite, most shared first. */
function booksCited(a: Analysis): { name: string; df: number }[] {
  const m = new Map<string, number>()
  for (const src of a.live) for (const b of bibleRefs(src.text ?? '').books) m.set(b, (m.get(b) ?? 0) + 1)
  return [...m.entries()].map(([name, df]) => ({ name, df })).sort((x, y) => y.df - x.df)
}

const common = (ctx: AiContext) => {
  const p = ctx.analysis.project
  return { client: clientIntro(ctx.client), topic: p.topic, primary: p.primary }
}
const tpl = (ctx: AiContext, key: PromptKey, values: Record<string, string | number>) => fillPrompt(promptTemplate(ctx.settings.ai, key), values)
const needCompetitors = (ctx: AiContext) => { if (!ctx.analysis.N) throw new NeedsMore('Capture at least one competitor page first.') }

/* 1. Refine terms */

function refine(ctx: AiContext): FeatureRun {
  const a = ctx.analysis
  const p = a.project
  const f = ctx.settings.features
  needCompetitors(ctx)
  const { list, N } = a.candidates()
  const cur = a.termObjs()
  const cand = list.slice(0, 160).map(c => `${c.t} | ${c.df}/${N} | ${c.tf} | ${c.ai || 0}`).join('\n')
  const metas = a.live.map(c => `${c.label ?? ''}: ${clip(c.title ?? '', 120)} - ${clip(c.desc ?? '', 200)}`).join('\n')
  const books = booksCited(a).slice(0, 15).map(b => `${b.name} (${b.df} competitors)`).join(', ')
  const prompt = tpl(ctx, 'refine', {
    ...common(ctx),
    secondary: f.secondary ? joined(p.secondary) : 'none',
    rich_questions: f.rich ? joined(p.rich) : 'none',
    followup_questions: f.followups ? joined(p.aiFollowups) : 'none',
    avoid_terms: f.avoid ? joined(p.avoid) : 'none',
    ai_answers: aiAnswersText(a, 2500),
    competitor_meta: metas,
    bible_books: ctx.client.faith ? `Bible books cited by competitors: ${books || 'none found'}` : '',
    candidate_terms: cand,
    current_terms: cur.map(t => `${t.t}${t.src === 'manual' ? ' (manual)' : ''}`).join('\n'),
    list_size: a.rules.size,
    list_size_max: a.rules.size + 5,
    extra_term_ideas: ctx.client.faith ? 'commonly cited Bible books, or Christian concepts central to the topic' : 'or concepts, entities and standards central to the topic',
  })
  return {
    prompt,
    apply(answer) {
      if (!isObj(answer) || !Array.isArray(answer.terms)) throw new Unreadable()
      const byKey = new Map(cur.map(t => [t.key, t]))
      const next: { t: string; key: string; tier: string; src: string; why: string }[] = []
      const seen = new Set<string>()
      for (const x of answer.terms) {
        const r = isObj(x) ? x : {}
        const t = str(r.term, 120)
        if (!t) continue
        const key = termKey(t)
        if (!key || seen.has(key)) continue
        seen.add(key)
        const old = byKey.get(key)
        const tier = r.relevance === 'high' || r.relevance === 'medium' || r.relevance === 'low' ? r.relevance : 'medium'
        next.push({ t: old ? old.t : t, key, tier, src: old ? (old.src ?? 'data') : r.added ? 'claude' : 'data', why: r.added ? str(r.why, 300) : old?.why ?? '' })
      }
      if (!next.length) throw new Unreadable('Claude returned no terms. Try again.')
      for (const t of cur) if (t.src === 'manual' && !seen.has(t.key)) next.push({ t: t.t, key: t.key, tier: t.tier, src: 'manual', why: t.why ?? '' })
      const removed = [...p.removed]
      for (const x of asArr(answer.removed)) {
        const r = isObj(x) ? x : {}
        const term = str(r.term, 120)
        const key = termKey(term)
        if (key && !seen.has(key) && !removed.some(y => y.key === key)) removed.push({ t: term, key, reason: str(r.reason, 200) || 'Claude' })
      }
      return { terms: next, removed, refinedAt: Date.now() }
    },
  }
}

/* 2. Group terms */

function group(ctx: AiContext): FeatureRun {
  const all = ctx.analysis.termObjs()
  if (!all.length) throw new NeedsMore('Build the term list first.')
  const prompt = tpl(ctx, 'group', { ...common(ctx), term_list: all.map(t => `- ${t.t}`).join('\n') })
  return {
    prompt,
    apply(answer) {
      if (!isObj(answer) || !Array.isArray(answer.groups)) throw new Unreadable()
      const keys = new Set(all.map(t => t.key))
      const k = (s: unknown): string | null => { const x = termKey(String(s ?? '')); return keys.has(x) ? x : null }
      const groups = asArr(answer.groups).flatMap(g => {
        const o = isObj(g) ? g : {}
        const gk = asArr(o.terms).map(k).filter((x): x is string => !!x)
        return gk.length ? [{ name: str(o.name, 60) || 'Group', keys: gk }] : []
      })
      if (!groups.length) throw new Unreadable('Claude returned no groups. Try again.')
      const variantOf: Record<string, string> = {}
      for (const v of asArr(answer.variants)) {
        const o = isObj(v) ? v : {}
        const main = k(o.main)
        if (!main) continue
        for (const s of asArr(o.same)) { const x = k(s); if (x && x !== main) variantOf[x] = main }
      }
      return { termGroups: groups, groupsCustom: false, variantOf, notVariant: {}, groupedAt: Date.now() }
    },
  }
}

/* 3. Clean up questions and find gaps */

function cleanq(ctx: AiContext): FeatureRun {
  const a = ctx.analysis
  const p = a.project
  const f = ctx.settings.features
  if (!a.N) throw new NeedsMore('Capture at least one competitor page first.')
  // The competitor questions are listed first when the tab has not scanned yet.
  const synced = p.questions.length ? p : { ...p, ...(syncQuestions(p, a.competitorQuestions()) as { questions: typeof p.questions }) }
  const qs = synced.questions.filter(q => q.src === 'competitor')
  if (!qs.length && !p.questions.length) throw new NeedsMore('No questions were found in the captured pages yet.')
  const outlines = a.live.map(c => `${c.label ?? ''}: ${c.headings.filter(h => h.l <= 3).map(h => h.t).slice(0, 25).join(' | ')}`).join('\n')
  const prompt = tpl(ctx, 'cleanq', {
    ...common(ctx),
    rich_questions: f.rich ? joined(p.rich) : 'none',
    followup_questions: f.followups ? joined(p.aiFollowups) : 'none',
    competitor_questions: qs.map((q, i) => `${i}: ${q.q} [${(q.from ?? []).length}]`).join('\n'),
    heading_outlines: clip(outlines, 9000),
    gap_audience: ctx.client.faith ? 'especially ones a Christian perspective can answer helpfully (Scripture, prayer, grace, practical steps)' : 'especially ones this client’s expertise can answer helpfully',
  })
  return {
    prompt,
    apply(answer) {
      const res = isObj(answer) ? answer : null
      if (!res) throw new Unreadable()
      const all = synced.questions.map(q => ({ ...q }))
      for (const x of asArr(res.remove)) {
        const r = isObj(x) ? x : {}
        const q = typeof r.i === 'number' ? qs[r.i] : undefined
        if (!q) continue
        const t = all.find(y => y.key === q.key)
        if (t) { t.off = true; t.reason = str(r.reason, 200) }
      }
      for (const x of asArr(res.gaps)) {
        const g = isObj(x) ? x : {}
        const q = str(g.q, 300)
        if (!q) continue
        const key = termKey(q)
        if (!key || all.some(y => y.key === key)) continue
        all.push({ q, key, src: 'claude', why: str(g.why, 300), from: [], off: false })
      }
      return { questions: all, questionsAt: Date.now() }
    },
  }
}

/* 4. Draft the answer near the top */

function answer(ctx: AiContext): FeatureRun {
  const a = ctx.analysis
  const direct = a.project.questions.filter(q => q.direct && !q.off).map(q => q.q)
  const prompt = tpl(ctx, 'answer', {
    ...common(ctx),
    direct_questions: direct.join(' | ') || 'none listed',
    ai_answers: aiAnswersText(a, 2500),
    competitor_openings: a.live.map(c => `=== ${c.label ?? ''}\n${condensed(c, 1500)}`).join('\n\n') || 'none captured',
  })
  return {
    prompt,
    apply(ans) {
      const pts = strs(isObj(ans) ? ans.points : null, 700, 12)
      if (!pts.length) throw new Unreadable()
      return { answerTop: pts }
    },
  }
}

/* 5. Summarize discussions */

function insights(ctx: AiContext): FeatureRun {
  const ds = ctx.pages.filter(p => p.kind === 'discussion')
  if (!ds.length) throw new NeedsMore('Add at least one discussion first.')
  const body = ds.map((d, i) => `--- Thread ${i + 1}: ${d.title} (${d.url || 'no url'})\n${clip(d.blocks.map(b => b[1]).join('\n'), 7000)}`).join('\n\n')
  const prompt = tpl(ctx, 'insights', { ...common(ctx), discussion_threads: clip(body, 70000) })
  return {
    prompt,
    apply(ans) {
      if (!isObj(ans)) throw new Unreadable()
      const o = { painPoints: strs(ans.painPoints), language: strs(ans.language), questions: strs(ans.questions), misconceptions: strs(ans.misconceptions), angles: strs(ans.angles) }
      if (!Object.values(o).some(l => l.length)) throw new Unreadable()
      return { insights: { at: Date.now(), ...o } }
    },
  }
}

/* 6. Map originality (the commodity map) */

function commodity(ctx: AiContext): FeatureRun {
  const a = ctx.analysis
  needCompetitors(ctx)
  const each = Math.max(2000, Math.min(8000, Math.floor(150000 / Math.max(1, a.live.length))))
  const prompt = tpl(ctx, 'commodity', {
    ...common(ctx),
    original_definition: original(ctx.client),
    ai_answers: aiAnswersText(a, 3000),
    competitor_content: a.live.map(c => `=== ${c.label ?? ''}\n${condensed(c, each)}`).join('\n\n'),
  })
  return {
    prompt,
    apply(ans) {
      if (!isObj(ans) || !Array.isArray(ans.baseline)) throw new Unreadable()
      const pts = (v: unknown, sources: boolean) => asArr(v).flatMap(x => {
        const o = isObj(x) ? x : { point: x }
        const point = str(o.point)
        return point ? [{ point, ...(sources ? { sources: strs(o.sources, 80, 20) } : {}), ...(str(o.source, 80) ? { source: str(o.source, 80) } : {}), ...(str(o.why) ? { why: str(o.why) } : {}) }] : []
      }).slice(0, 60)
      const notes = (v: unknown) => asArr(v).map(x => str(isObj(x) ? x.point : x)).filter(Boolean).slice(0, 40)
      return { commodity: { at: Date.now(), baseline: pts(ans.baseline, true), unique: pts(ans.unique, false), gaps: pts(ans.gaps, false) }, opps: notes(ans.opportunities), angle: notes(ans.angle) }
    },
  }
}

/* 7. Interview and story prompts */

function interview(ctx: AiContext): FeatureRun {
  const r = ctx.analysis.project.ai
  const cm = r.commodity
  const c = ctx.client
  const prompt = tpl(ctx, 'interview', {
    ...common(ctx),
    original_definition: original(c),
    context_notes: [
      r.angle.length ? `Angle to stand out: ${r.angle.join('; ')}\n` : '',
      cm?.baseline.length ? `Points every competitor already makes (dig past these): ${cm.baseline.map(b => b.point).join('; ')}\n` : '',
      cm?.gaps.length ? `What competitors don’t cover: ${cm.gaps.map(g => g.point).join('; ')}\n` : '',
    ].join(''),
    who_examples: c.faith ? ' (for example a pastor, Bible worker, church member or colleague)' : ' (for example an application expert, support lead or customer)',
    story_kind: c.faith ? 'stories and testimonies from colleagues, church members or friends' : 'real customer use cases',
  })
  return {
    prompt,
    apply(ans) {
      if (!isObj(ans) || !Array.isArray(ans.sme)) throw new Unreadable()
      return { interview: { at: Date.now(), who: strs(ans.who), sme: strs(ans.sme), stories: strs(ans.stories) } }
    },
  }
}

/* 8. Suggest natural placements (writer workshop) */

function place(ctx: AiContext): FeatureRun {
  const a = ctx.analysis
  const blocks = draftBlocks(ctx.draftHtml)
  if (!blocks.length) throw new NeedsMore('Write or paste your draft first.')
  const d = draftSource(blocks)
  const missing = a.concepts().filter(t => ![t.key, ...t.altKeys].some(k => countIn(d, k) > 0)).slice(0, 25)
  if (!missing.length) return { prompt: null, apply: () => ({ placements: { at: Date.now(), list: [], skip: [] } }) }
  const ctxFor = (t: { key: string }) => {
    const secs = new Map<string, number>()
    for (const c of a.live) for (const s of sectionsWith(c, t.key)) if (s.l > 0) secs.set(s.h, (secs.get(s.h) ?? 0) + 1)
    return [...secs.entries()].sort((x, y) => y[1] - x[1]).slice(0, 3).map(x => x[0]).join(' | ')
  }
  const outline = d.sections.map(s => {
    const txt = d.segs.filter(g => g.sec === s.idx).map(g => g.sf.join(' ')).join(' ')
    return `[${s.l ? `H${s.l}` : 'Intro'}] ${s.h}\n${clip(txt, 350)}`
  }).join('\n\n')
  const prompt = tpl(ctx, 'place', {
    ...common(ctx),
    draft_outline: clip(outline, 14000),
    missing_terms: missing.map(t => `${t.t}${t.alts.length ? ` (or ${t.alts.join(', ')})` : ''} [${t.tier}] - ${ctxFor(t) || 'no clear section'}`).join('\n'),
  })
  return {
    prompt,
    apply(ans) {
      const o = isObj(ans) ? ans : null
      if (!o) throw new Unreadable()
      const list = asArr(o.placements).flatMap(x => { const r = isObj(x) ? x : {}; const term = str(r.term, 120); return term ? [{ term, heading: str(r.heading, 200), how: str(r.how) }] : [] }).slice(0, 60)
      const skip = asArr(o.skip).flatMap(x => { const r = isObj(x) ? x : {}; const term = str(r.term, 120); return term ? [{ term, reason: str(r.reason) }] : [] }).slice(0, 60)
      return { placements: { at: Date.now(), list, skip } }
    },
  }
}

/* 9. Content review (writer workshop) */

export const STANDARDS: readonly (readonly [string, string])[] = [
  ['E-E-A-T', 'Sounds like it was written by an expert or someone with real experience: authoritative, specific and lived, not generic, vague, salesy or textbook theory. Goes deep with real use cases, scenarios and step-by-step help from someone who actually does this, not basic examples or basic steps.'],
  ['Clarity', 'Opens with a solid summary answer and ends with clear takeaways. Visitors never have to guess what the discussion concluded or search for the answer.'],
  ['Helpfulness', 'More helpful than the competing pages, not commodity content that restates what everyone already says.'],
  ['Originality', 'Includes at least one original element from the writer or a subject expert: stories, testimonies, quotes, recommendations or advice, first-hand use cases, or the client’s distinctive voice or context. Depth or format alone doesn’t count.'],
]

function review(ctx: AiContext): FeatureRun {
  const a = ctx.analysis
  const blocks = draftBlocks(ctx.draftHtml)
  if (!blocks.length) throw new NeedsMore('Write or paste your draft first.')
  const r = a.project.ai
  const cm = r.commodity
  const draft = clip(blocks.map(([t, x]) => (/^h\d$/.test(t) ? `\n[${t.toUpperCase()}] ${x}` : x)).join('\n'), 60000)
  const heads = clip(a.live.map(c => `${c.label ?? ''}: ${c.headings.filter(h => h.l <= 3).map(h => h.t).slice(0, 20).join(' | ')}`).join('\n'), 8000)
  const material = [
    a.project.answerTop.length ? `Answer near the top should include: ${a.project.answerTop.join('; ')}` : '',
    r.opps.length ? `Originality opportunities: ${r.opps.join('; ')}` : '',
    r.angle.length ? `Angle and depth: ${r.angle.join('; ')}` : '',
  ].filter(Boolean).join('\n')
  const prompt = tpl(ctx, 'review', {
    ...common(ctx),
    content_standards: STANDARDS.map(([n, t], i) => `${i + 1}. ${n}: ${t}`).join('\n'),
    original_definition: original(ctx.client),
    ai_answers: aiAnswersText(a, 2000),
    baseline_points: cm?.baseline.length ? `\nPoints every competitor already makes (commodity):\n${cm.baseline.map(b => `- ${b.point}`).join('\n')}\n` : '',
    competitor_headings: heads || 'not captured',
    seo_recommendations: material || 'none recorded',
    draft,
  })
  return {
    prompt,
    apply(ans) {
      if (!isObj(ans) || !Array.isArray(ans.criteria)) throw new Unreadable()
      return { review: { at: Date.now(), hash: hashId(ctx.draftHtml), ...ans } }
    },
  }
}

const FEATURES: Record<PromptKey, (ctx: AiContext) => FeatureRun> = { refine, group, cleanq, answer, insights, commodity, interview, place, review }

export const isFeature = (k: unknown): k is PromptKey => typeof k === 'string' && (PROMPT_ORDER as readonly string[]).includes(k)

/** Fills a feature's prompt, or throws NeedsMore when it cannot run yet. */
export function prepare(key: PromptKey, ctx: AiContext): FeatureRun {
  return FEATURES[key](ctx)
}

/** Who may run a feature: the writer workshop's two are open to writers too. */
export const WRITER_FEATURES: readonly PromptKey[] = ['place', 'review']
