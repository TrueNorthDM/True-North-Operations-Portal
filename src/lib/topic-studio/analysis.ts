/**
 * Topic Studio's analysis of one topic (phase 1, 5 November 2026): the glue the
 * Artifact keeps between its text engine (engine.ts) and its screens, ported
 * as pure functions. Given a Project and its captured pages it answers what
 * the Competitors, Topic terms, Questions and SEO brief tabs show: the
 * competitors in rank order, candidate terms, how each term is used, the
 * concepts (a main term and its variants), the groups, the warnings about the
 * shape of the list, the questions competitors answer, and the key terms.
 *
 * Nothing here reads or writes the database and nothing here is async: it is
 * the same code on the server (the pages) and in tests. The analysis is built
 * once per request and its parts are worked out the first time they are asked.
 */

import {
  RULES_DEFAULT, buildCandidates, buildSource, contentStems, countIn, extractQuestions, hostOf, median, mixOrder, normUrl, pct,
  scoreAgainst, splitLines, splitSentences, termKey, tokenize,
  type Candidate, type Ctx, type Excluded, type Rules, type Source, type Term,
} from './engine'
import { AI_KEYS, AI_LABEL, FEATURES, FEEDBACK_TERMS, hasAnswer, type AiKey, type Project, type TermEntry, type TopicPage } from './project'

/** One row of the competitor list: a URL from Setup, with its page once captured. */
export interface Comp {
  i: number
  url: string
  /** The address without scheme, www and trailing slash: how pages are matched. */
  n: string
  rank: number | null
  /** Cited in the AI Overview. */
  cited: boolean
  domain: string
  label: string
  page: TopicPage | null
  /** The page analysed; null until it is captured. */
  src: Source | null
}

export interface AiSource extends Source { aiKey: AiKey }

/** A main term with the variants that mean the same thing; scoring counts it once. */
export interface Concept extends TermEntry {
  key: string
  alts: string[]
  altKeys: string[]
}

export interface TermStats {
  /** Uses on each competitor, in the order of Analysis.comps; null where nothing is captured. */
  per: (number | null)[]
  /** Competitors that use it, uses in total, and the median, least and most uses on those. */
  df: number
  tf: number
  med: number
  min: number
  max: number
  aiPer: { label: string; v: number }[]
  /** AI answers that use it. */
  ai: number
}

export interface GroupOut { name: string; items: Concept[]; other: boolean }

export interface Analysis {
  project: Project
  comps: Comp[]
  /** Competitors with a captured page. */
  live: Source[]
  ais: AiSource[]
  /** Captured competitor pages. */
  N: number
  rules: Rules
  candidates(): { list: Candidate[]; N: number; excluded: Excluded[] }
  /** The term list, one entry per key, each with its key. */
  termObjs(): (TermEntry & { key: string })[]
  termStats(key: string): TermStats
  variantMap(): Record<string, string>
  concepts(): Concept[]
  compScores(): { scores: (number | null)[]; target: number; avg: number }
  wordStats(): { med: number; lo: number; hi: number; avg: number }
  termGroups(): GroupOut[]
  warnings(): string[]
  /** The questions the captured pages and AI answers ask, most shared first. */
  competitorQuestions(): ReturnType<typeof extractQuestions>
  keyTerms(): Concept[]
  /** The answer's average reading ease across captured pages, or null. */
  avgFlesch(): number | null
}

const cap = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

/** The competitors in rank order: the top organic URLs, then those the AI Overview cites that are not among them. */
export function compList(p: Project, pages: readonly TopicPage[]): Omit<Comp, 'src'>[] {
  const cited = new Set(p.cited.map(normUrl))
  const list: Omit<Comp, 'src'>[] = []
  const seen = new Set<string>()
  p.organic.forEach((u, i) => {
    if (!u) return
    const n = normUrl(u)
    if (seen.has(n)) return
    seen.add(n)
    list.push({ url: u, n, rank: i + 1, cited: cited.has(n), domain: '', label: '', page: null, i: 0 })
  })
  p.cited.forEach(u => {
    if (!u) return
    const n = normUrl(u)
    if (seen.has(n)) return
    seen.add(n)
    list.push({ url: u, n, rank: null, cited: true, domain: '', label: '', page: null, i: 0 })
  })
  const byN = new Map(pages.filter(pg => pg.kind === 'competitor').map(pg => [normUrl(pg.url), pg]))
  return list.map((c, i) => {
    const domain = hostOf(c.url)
    return { ...c, page: byN.get(c.n) ?? null, domain, label: c.rank ? `#${c.rank} ${domain}` : `AIO ${domain}`, i }
  })
}

export function createAnalysis(project: Project, pages: readonly TopicPage[]): Analysis {
  const p = project
  const rules: Rules = { ...RULES_DEFAULT, ...p.buildRules }
  const ctx: Ctx = { forms: new Map(), caps: new Map() }

  const comps: Comp[] = compList(p, pages).map(c => ({
    ...c,
    src: c.page ? buildSource({ label: c.label, url: c.url, rank: c.rank ?? undefined, cited: c.cited, domain: c.domain, title: c.page.title, desc: c.page.desc, links: c.page.links, i: c.i }, c.page.blocks, ctx) : null,
  }))
  const live = comps.flatMap(c => (c.src && c.src.words > 0 ? [c.src] : []))
  const ais: AiSource[] = AI_KEYS.filter(k => hasAnswer(p, k)).map(k => ({ ...buildSource({ label: AI_LABEL[k] }, p[k].split(/\n+/).map(t => ['p', t] as [string, string]), ctx), aiKey: k }))

  let cands: ReturnType<Analysis['candidates']> | null = null
  const candidates = () => {
    if (!cands) {
      const built = buildCandidates(live, ais, ctx, [p.topic, p.primary].join('. '), {
        primary: p.primary, rules,
        secondary: FEATURES.secondary ? p.secondary : '',
        rich: [FEATURES.rich ? p.rich : '', FEATURES.followups ? p.aiFollowups : ''].filter(Boolean).join('\n'),
        avoid: FEATURES.avoid ? p.avoid : '',
      })
      cands = { ...built, list: mixOrder(built.list, live, rules) }
    }
    return cands
  }

  const termObjs = () => {
    const seen = new Set<string>()
    return p.terms.map(t => ({ ...t, key: t.key || termKey(t.t) })).filter(t => !seen.has(t.key) && seen.add(t.key))
  }

  const termStats = (key: string): TermStats => {
    const per = comps.map(c => (c.src ? countIn(c.src, key) : null))
    const users = per.filter((v): v is number => v != null && v > 0)
    return {
      per, df: users.length, tf: users.reduce((a, b) => a + b, 0), med: median(users),
      min: users.length ? Math.min(...users) : 0, max: users.length ? Math.max(...users) : 0,
      aiPer: ais.map(a => ({ label: a.label ?? '', v: countIn(a, key) })), ai: ais.filter(a => countIn(a, key) > 0).length,
    }
  }

  // Terms whose words are the same ones in another order count as one idea.
  const autoVariants = (all: { t: string; key: string }[]) => {
    const seen = new Map<string, string>()
    const vm: Record<string, string> = {}
    for (const t of all) {
      const sig = tokenize(t.t).flatMap(s => s.st).filter(x => x.length > 1).sort().join(' ')
      if (!sig) continue
      if (seen.has(sig)) vm[t.key] = seen.get(sig)!
      else seen.set(sig, t.key)
    }
    return vm
  }
  let vmCache: Record<string, string> | null = null
  const variantMap = () => {
    if (vmCache) return vmCache
    const all = termObjs()
    const vm: Record<string, string> = { ...autoVariants(all), ...p.variantOf }
    const keys = new Set(all.map(t => t.key))
    for (const k of Object.keys(vm)) if (!keys.has(vm[k]) || vm[k] === k || p.notVariant[k]) delete vm[k]
    for (const k of Object.keys(vm)) if (vm[vm[k]]) vm[k] = vm[vm[k]]
    return (vmCache = vm)
  }

  let conceptCache: Concept[] | null = null
  const concepts = (): Concept[] => {
    if (conceptCache) return conceptCache
    const all = termObjs()
    const vm = variantMap()
    return (conceptCache = all.filter(t => !vm[t.key]).map(m => {
      const alts = all.filter(t => vm[t.key] === m.key)
      return { ...m, alts: alts.map(a => a.t), altKeys: alts.map(a => a.key) }
    }))
  }

  const asTerm = (c: Concept): Term => ({ ...c })
  const compScores = () => {
    const terms = concepts().map(asTerm)
    const scores = comps.map(c => (c.src ? scoreAgainst(c.src, terms).score : null))
    const valid = scores.filter((v): v is number => v != null).sort((a, b) => b - a)
    const target = valid.length ? Math.round(valid.slice(0, 3).reduce((a, b) => a + b, 0) / Math.min(3, valid.length)) : 0
    return { scores, target, avg: valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : 0 }
  }
  const wordStats = () => {
    const w = live.map(c => c.words).filter(Boolean)
    return { med: median(w), lo: pct(w, 0.25), hi: pct(w, 0.75), avg: w.length ? Math.round(w.reduce((a, b) => a + b, 0) / w.length) : 0 }
  }

  const termGroups = (): GroupOut[] => {
    const cs = concepts()
    const assigned = new Map<string, string>()
    for (const g of p.termGroups ?? []) for (const k of g.keys) if (!assigned.has(k)) assigned.set(k, g.name)
    if (p.groupsCustom) {
      const groups: GroupOut[] = (p.termGroups ?? []).map(g => ({ name: g.name, items: [], other: false }))
      const byName = new Map(groups.map(g => [g.name, g]))
      const other: Concept[] = []
      for (const c of cs) {
        const name = assigned.get(c.key) ?? c.altKeys.map(k => assigned.get(k)).find(Boolean)
        const g = name ? byName.get(name) : undefined
        if (g) g.items.push(c)
        else other.push(c)
      }
      if (other.length) groups.push({ name: 'Other terms', items: other, other: true })
      return groups
    }
    for (const c of cs) if (!assigned.has(c.key)) { const alt = c.altKeys.find(k => assigned.has(k)); if (alt) assigned.set(c.key, assigned.get(alt)!) }
    // Terms that end in the same word make a group, named by the shortest of them.
    const un = cs.filter(c => !assigned.has(c.key))
    const byHead = new Map<string, Concept[]>()
    for (const c of un) {
      const st = contentStems(c.t)
      const hd = st[st.length - 1] || c.key
      if (!byHead.has(hd)) byHead.set(hd, [])
      byHead.get(hd)!.push(c)
    }
    for (const l of byHead.values()) if (l.length >= 2) {
      const name = cap(l.slice().sort((a, b) => a.t.length - b.t.length)[0].t)
      for (const c of l) assigned.set(c.key, name)
    }
    const groups = new Map<string, Concept[]>()
    for (const c of cs) {
      const name = assigned.get(c.key) ?? 'Other terms'
      if (!groups.has(name)) groups.set(name, [])
      groups.get(name)!.push(c)
    }
    const out = [...groups.entries()].map(([name, items]) => ({ name, items, other: name === 'Other terms' }))
    return out.filter(g => !g.other).concat(out.filter(g => g.other))
  }

  const warnings = (): string[] => {
    const cs = concepts()
    const n = cs.length
    const all = termObjs().length
    const out: string[] = []
    const F = FEEDBACK_TERMS
    if (!n || all < F.general.minList) return out
    const pc = (x: number) => Math.round(100 * x)
    const variants = all - n
    if (F.variants.on) {
      if (variants / all > F.variants.share / 100) out.push(`${variants} of the ${all} terms (${pc(variants / all)}%) are variants of other terms. Too many near-duplicates make the list repetitive. Remove the ones that add nothing.`)
      const worst = cs.slice().sort((a, b) => b.alts.length - a.alts.length)[0]
      if (worst && worst.alts.length >= F.variants.perTerm) out.push(`“${worst.t}” has ${worst.alts.length} variants. That may be more wording than the topic needs.`)
    }
    if (F.bigGroup.on || F.fewGroups.on) {
      const gs = termGroups().filter(g => !g.other && g.items.length)
      const big = gs.slice().sort((a, b) => b.items.length - a.items.length)[0]
      if (F.bigGroup.on && big && big.items.length >= F.bigGroup.minTerms && big.items.length / n > F.bigGroup.share / 100) out.push(`The group “${big.name}” holds ${big.items.length} of ${n} terms (${pc(big.items.length / n)}%). A group this large may be many phrasings of one idea.`)
      if (F.fewGroups.on && n >= F.fewGroups.minTerms && gs.length < F.fewGroups.groups) out.push(`The terms fall into ${gs.length === 0 ? 'no groups' : `only ${gs.length} group${gs.length === 1 ? '' : 's'}`}. The list may lean on one idea, so check that it covers the topic’s other subtopics.`)
    }
    const uni = cs.filter(t => !t.key.includes(' ')).length
    if (F.singles.on && uni / n > F.singles.share / 100) out.push(`${uni} of the ${n} terms (${pc(uni / n)}%) are single words. The list may be too generic or less helpful. Favor specific phrases.`)
    if (F.relevance.on && live.length >= F.relevance.minComps) {
      const low = cs.filter(t => { const st = termStats(t.key); const share = st.df / live.length; return share < F.relevance.spread / 100 || (share < F.relevance.spreadOnce / 100 && st.med <= 1) }).length
      if (low / n > F.relevance.share / 100) out.push(`${low} of the ${n} terms (${pc(low / n)}%) are used by few competitors or only about once per page. The list may be less relevant to the topic than what competitors cover.`)
    }
    return out
  }

  const keyTerms = (): Concept[] => {
    const pk = termKey(p.primary)
    const cs = concepts().filter(t => t.key !== pk)
    const pick = cs.filter(t => t.tier === 'high').slice(0, 10)
    for (const t of cs) { if (pick.length >= 5) break; if (!pick.includes(t)) pick.push(t) }
    return pick
  }

  const avgFlesch = () => {
    const fl = live.map(c => c.flesch).filter((v): v is number => typeof v === 'number')
    return fl.length ? Math.round(fl.reduce((a, b) => a + b, 0) / fl.length) : null
  }

  return {
    project: p, comps, live, ais, N: live.length, rules, candidates, termObjs, termStats, variantMap, concepts, compScores, wordStats, termGroups, warnings, keyTerms, avgFlesch,
    competitorQuestions: () => extractQuestions([...live, ...ais]),
  }
}

/** Where a term is used, for the "term in context" drawer: up to three sentences per page, under the heading they sit in. */
export interface TermContext {
  label: string
  stats: Pick<TermStats, 'df' | 'med' | 'min' | 'max' | 'ai'> & { competitors: number; aiLabels: string[]; aiAnswers: number }
  sources: { label: string; uses: number; examples: { text: string; under: string; heading: boolean }[] }[]
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s)

export function termContext(a: Analysis, key: string, label: string): TermContext {
  const parts = key.split(' ')
  const has = (s: string) => {
    for (const seg of tokenize(s)) for (let i = 0; i + parts.length <= seg.st.length; i++) {
      let ok = true
      for (let k = 0; k < parts.length; k++) if (seg.st[i + k] !== parts[k]) { ok = false; break }
      if (ok) return true
    }
    return false
  }
  const st = a.termStats(key)
  const sources = [...a.live, ...a.ais].map(c => {
    const examples: TermContext['sources'][number]['examples'] = []
    let sec = 'Introduction'
    for (const [tag, text] of c.blocks) {
      if (/^h\d$/.test(tag)) {
        sec = text
        if (has(text) && examples.length < 3) examples.push({ text, under: `Heading H${tag[1]}`, heading: true })
        continue
      }
      if (examples.length >= 3) break
      for (const s of splitSentences(text)) {
        if (examples.length >= 3) break
        if (has(s)) examples.push({ text: clip(s, 320), under: clip(sec, 80), heading: false })
      }
    }
    return { label: c.label ?? '', uses: countIn(c, key), examples }
  }).filter(g => g.uses > 0)
  return {
    label,
    stats: { df: st.df, med: st.med, min: st.min, max: st.max, ai: st.ai, competitors: a.N, aiLabels: st.aiPer.filter(x => x.v > 0).map(x => x.label), aiAnswers: a.ais.length },
    sources,
  }
}

/** A pattern that finds a term in text as readers see it (plural forms, possessive), for highlighting. */
export function termPattern(label: string): string | null {
  const first = tokenize(label)[0]
  if (!first) return null
  return first.st.map(s => { const base = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); return s.endsWith('y') ? `${base.slice(0, -1)}(?:y|ies)(?:'s)?` : `${base}(?:s|es|'s)?` }).join('[\\s-]+')
}

export { splitLines }
