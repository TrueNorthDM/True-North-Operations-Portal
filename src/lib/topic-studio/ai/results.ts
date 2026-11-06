/**
 * What Claude's features leave on a topic (phase 3, 6 November 2026), and how an
 * answer is read. Claude replies with JSON; each reader takes whatever came back
 * and keeps only what has the right shape, cut to a sane length, so an odd answer
 * never puts something unexpected into a topic. The shapes are the Artifact's.
 * They live in the topic's data next to the terms and questions, and the tabs
 * read them through readAiResults (tolerant of anything missing).
 */

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
/** A trimmed string cut to `max`, or ''. */
export const str = (v: unknown, max = 600): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')
/** The non-empty strings of a list, each cut to `max`, at most `n` of them. */
export const strs = (v: unknown, max = 600, n = 100): string[] => arr(v).map(x => str(x, max)).filter(Boolean).slice(0, n)

export interface Point { point: string; sources?: string[]; source?: string; why?: string }
export interface Commodity { at: number; baseline: Point[]; unique: Point[]; gaps: Point[]; edited?: boolean }
export interface Placement { term: string; heading: string; how: string }
export interface Placements { at: number; list: Placement[]; skip: { term: string; reason: string }[] }
export interface Interview { at: number; who: string[]; sme: string[]; stories: string[] }
export interface Insights { at: number; painPoints: string[]; language: string[]; questions: string[]; misconceptions: string[]; angles: string[] }
export interface Criterion { name: string; rating: string; summary: string; fixes: string[] }
export interface Review {
  at: number
  /** Hash of the draft it read, to tell when the draft has changed since. */
  hash: string
  criteria: Criterion[]
  opening: { ok: boolean; note: string }
  closing: { ok: boolean; note: string }
  original: { type: string; excerpt: string; heading: string }[]
  sections: { heading: string; verdict: string; note: string }[]
}

export interface AiResults {
  commodity: Commodity | null
  opps: string[]
  angle: string[]
  placements: Placements | null
  interview: Interview | null
  /** Interview questions the SEO added by hand. */
  interviewManual: string[]
  insights: Insights | null
  review: Review | null
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

function points(v: unknown, withSources: boolean): Point[] {
  return arr(v).flatMap((x): Point[] => {
    const o = isObj(x) ? x : { point: x }
    const point = str(o.point)
    if (!point) return []
    return [{ point, ...(withSources && Array.isArray(o.sources) ? { sources: strs(o.sources, 80, 20) } : {}), ...(str(o.source, 80) ? { source: str(o.source, 80) } : {}), ...(str(o.why) ? { why: str(o.why) } : {}) }]
  }).slice(0, 100)
}

export function readCommodity(v: unknown): Commodity | null {
  if (!isObj(v)) return null
  return { at: num(v.at), baseline: points(v.baseline, true), unique: points(v.unique, false), gaps: points(v.gaps, false), ...(v.edited === true ? { edited: true } : {}) }
}
export function readPlacements(v: unknown): Placements | null {
  if (!isObj(v)) return null
  return {
    at: num(v.at),
    list: arr(v.list).flatMap((x): Placement[] => { const o = isObj(x) ? x : {}; const term = str(o.term, 120); return term ? [{ term, heading: str(o.heading, 200), how: str(o.how) }] : [] }).slice(0, 60),
    skip: arr(v.skip).flatMap(x => { const o = isObj(x) ? x : {}; const term = str(o.term, 120); return term ? [{ term, reason: str(o.reason) }] : [] }).slice(0, 60),
  }
}
export function readInterview(v: unknown): Interview | null {
  if (!isObj(v)) return null
  return { at: num(v.at), who: strs(v.who), sme: strs(v.sme), stories: strs(v.stories) }
}
export function readInsights(v: unknown): Insights | null {
  if (!isObj(v)) return null
  return { at: num(v.at), painPoints: strs(v.painPoints), language: strs(v.language), questions: strs(v.questions), misconceptions: strs(v.misconceptions), angles: strs(v.angles) }
}
export function readReview(v: unknown): Review | null {
  if (!isObj(v) || !Array.isArray(v.criteria)) return null
  const yn = (x: unknown) => { const o = isObj(x) ? x : {}; return { ok: o.ok === true, note: str(o.note) } }
  return {
    at: num(v.at),
    hash: str(v.hash, 40),
    criteria: arr(v.criteria).flatMap((x): Criterion[] => { const o = isObj(x) ? x : {}; const name = str(o.name, 60); return name ? [{ name, rating: str(o.rating, 30), summary: str(o.summary, 1500), fixes: strs(o.fixes, 800, 20) }] : [] }).slice(0, 8),
    opening: yn(v.opening),
    closing: yn(v.closing),
    original: arr(v.original).flatMap(x => { const o = isObj(x) ? x : {}; const excerpt = str(o.excerpt, 500); return excerpt ? [{ type: str(o.type, 40), excerpt, heading: str(o.heading, 200) }] : [] }).slice(0, 40),
    sections: arr(v.sections).flatMap(x => { const o = isObj(x) ? x : {}; const heading = str(o.heading, 200); return heading ? [{ heading, verdict: str(o.verdict, 30).toLowerCase(), note: str(o.note, 800) }] : [] }).slice(0, 60),
  }
}

/** Everything the features left on a topic's data. */
export function readAiResults(d: unknown): AiResults {
  const o = isObj(d) ? d : {}
  return {
    commodity: readCommodity(o.commodity),
    opps: strs(o.opps),
    angle: strs(o.angle),
    placements: readPlacements(o.placements),
    interview: readInterview(o.interview),
    interviewManual: strs(o.interviewManual),
    insights: readInsights(o.insights),
    review: readReview(o.review),
  }
}

/** The interview questions that go into the brief: Claude's, the SEO's own and the story prompts, each once. */
export function interviewSelected(r: Pick<AiResults, 'interview' | 'interviewManual'>): string[] {
  const iv = r.interview
  return [...(iv?.sme ?? []), ...r.interviewManual, ...(iv?.stories ?? [])].filter((q, i, a) => a.indexOf(q) === i)
}
