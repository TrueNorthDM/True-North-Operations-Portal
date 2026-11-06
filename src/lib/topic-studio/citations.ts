/**
 * Citations of a topic (phase 4, 6 November 2026): what the captured competitor
 * pages cite (Scripture, named authorities, outside pages they link to) and
 * which of it the SEO ticks for the SEO brief. Ported from the Artifact
 * (citationData, linkData, curatedSources, curatedCites, sourcesView and the
 * Scripture, source and authority sections of the brief), behaviour for
 * behaviour. Pure: nothing here reads or writes the database.
 *
 * The SEO's choices live in ts_topics.data.curated, one plain object:
 *   srcPicks    { [normalised address]: true | false }  a linked source ticked or unticked
 *   srcManual   [{ url, title, added }]                 sources the SEO typed in
 *   citePicks   { auth | books | refs: { [name]: true | false } }
 *   citeManual  { auth | books | refs: [name] }         names the SEO typed in
 * A topic imported from the Artifact carries the same four keys at the top of
 * its data; readCurated() falls back to them until the first change here.
 *
 * The Scripture sections only ever show for a client whose profile says faith.
 */

import { bibleRefs, hostOf, normUrl, termKey, type Source } from './engine'
import type { Analysis } from './analysis'
import { esc } from './brief'

/** Share buttons and mail links are not sources (the Artifact's own test). */
export const SHARE_RE = /(facebook\.com\/(sharer|share|dialog)|twitter\.com\/(intent|share)|x\.com\/intent|pinterest\.[a-z.]+\/pin\/create|linkedin\.com\/(share|shareArticle)|wa\.me|api\.whatsapp|t\.me\/share|reddit\.com\/submit|mailto:|addtoany|sharethis)/i

/** Anchor texts that say nothing about the page they point to. */
export const GENERIC_ANCHOR = /^(here|click here|this|link|read more|learn more|source|website|article|this article|this study|study|more)$/i

export type CiteKind = 'auth' | 'books' | 'refs'
export const CITE_KINDS: Record<CiteKind, string> = { auth: 'Named authorities', books: 'Bible books', refs: 'Bible passages' }
const KINDS = Object.keys(CITE_KINDS) as CiteKind[]

/** How many of each kind are in the brief before the SEO chooses (the Artifact's first twelve). */
export const DEFAULT_CITES = 12
/** How many linked sources are in the brief before the SEO chooses. */
export const DEFAULT_SOURCES = 20

export type Patch = Record<string, unknown>

/* What the competitors cite */

export interface RefEntry { name: string; from: string[]; n: number; df: number }
export interface BookEntry { name: string; from: string[]; df: number }
export interface DomainEntry { name: string; from: string[]; links: [string, string][]; df: number }
export interface AccordEntry { name: string; from: string[]; df: number }
export interface CitationData { refs: RefEntry[]; books: BookEntry[]; domains: DomainEntry[]; accord: AccordEntry[] }

/** The links a captured page carries (buildSource keeps them on the source, untyped). */
export function sourceLinks(s: Source): [string, string][] {
  const v = s.links
  if (!Array.isArray(v)) return []
  return v.filter((l): l is [string, string] => Array.isArray(l) && typeof l[0] === 'string').map(l => [l[0], typeof l[1] === 'string' ? l[1] : ''])
}

const labelOf = (s: Source): string => (typeof s.label === 'string' ? s.label : '')
const domainOf = (s: Source): string => (typeof s.domain === 'string' ? s.domain : '')

const ACCORD_RE = /\b(?:[Aa]ccording to|[Rr]esearch (?:from|by)|[Aa] study (?:from|by)|[Ss]tudies (?:from|by)|[Aa]s (?:noted|explained) by)\s+((?:the\s+)?[A-Z][\w.&'’-]*(?:\s+(?:of\s+|for\s+|and\s+)?[A-Z][\w.&'’-]*){0,5})/g

const ranked = <T extends { from: string[]; n?: number }>(m: Map<string, T>): (T & { df: number })[] =>
  [...m.values()].map(e => ({ ...e, df: e.from.length })).sort((a, b) => b.df - a.df || (b.n || 0) - (a.n || 0))

/** Scripture, outside sites and named authorities in the captured pages, most cited first. */
export function citationData(a: Analysis): CitationData {
  const refs = new Map<string, { name: string; from: string[]; n: number }>()
  const books = new Map<string, { name: string; from: string[] }>()
  const doms = new Map<string, { name: string; from: string[]; links: [string, string][] }>()
  const accord = new Map<string, { name: string; from: string[] }>()
  for (const c of a.live) {
    const label = labelOf(c)
    const text = c.text ?? ''
    const { refs: r, books: b } = bibleRefs(text)
    for (const x of new Set(r)) {
      const e = refs.get(x) ?? { name: x, from: [], n: 0 }
      e.from.push(label)
      refs.set(x, e)
    }
    for (const x of r) refs.get(x)!.n++
    for (const x of b) {
      const e = books.get(x) ?? { name: x, from: [] }
      e.from.push(label)
      books.set(x, e)
    }
    const ds = new Map<string, [string, string][]>()
    for (const [h, t] of sourceLinks(c)) {
      if (SHARE_RE.test(h)) continue
      const d = hostOf(h)
      if (!d || d === domainOf(c)) continue
      if (!ds.has(d)) ds.set(d, [])
      ds.get(d)!.push([h, t])
    }
    for (const [d, ls] of ds) {
      const e = doms.get(d) ?? { name: d, from: [], links: [] }
      e.from.push(label)
      e.links.push(...ls.slice(0, 3))
      doms.set(d, e)
    }
    const seen = new Set<string>()
    for (const m of text.matchAll(ACCORD_RE)) {
      const n = m[1].replace(/^the\s+/i, '').trim()
      if (n.length < 3 || seen.has(n)) continue
      seen.add(n)
      const e = accord.get(n) ?? { name: n, from: [] }
      e.from.push(label)
      accord.set(n, e)
    }
  }
  return { refs: ranked(refs), books: ranked(books), domains: ranked(doms), accord: ranked(accord) }
}

/* What the SEO chose */

export interface ManualSource { url: string; title: string; added: number }
export interface Curated {
  srcPicks: Record<string, boolean>
  srcManual: ManualSource[]
  citePicks: Partial<Record<CiteKind, Record<string, boolean>>>
  citeManual: Partial<Record<CiteKind, string[]>>
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const webUrl = (u: string): boolean => /^https?:\/\/[^\s]+$/i.test(u)

function picks(v: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  if (isObj(v)) for (const [k, x] of Object.entries(v)) if (typeof x === 'boolean' && k && k.length < 2100) out[k] = x
  return out
}

/** The SEO's choices from a topic's data: tolerant of anything, web addresses only. */
export function readCurated(data: unknown): Curated {
  const d = isObj(data) ? data : {}
  const c = isObj(d.curated) ? d.curated : d
  const manual: ManualSource[] = (Array.isArray(c.srcManual) ? c.srcManual : []).filter(isObj)
    .filter(x => typeof x.url === 'string' && webUrl(x.url))
    .map(x => ({ url: String(x.url), title: typeof x.title === 'string' ? x.title : '', added: typeof x.added === 'number' ? x.added : 0 }))
  const citePicks: Curated['citePicks'] = {}
  const citeManual: Curated['citeManual'] = {}
  const cp = isObj(c.citePicks) ? c.citePicks : {}
  const cm = isObj(c.citeManual) ? c.citeManual : {}
  for (const k of KINDS) {
    if (isObj(cp[k])) citePicks[k] = picks(cp[k])
    if (Array.isArray(cm[k])) citeManual[k] = (cm[k] as unknown[]).filter((x): x is string => typeof x === 'string' && !!x.trim()).map(x => x.trim())
  }
  return { srcPicks: picks(c.srcPicks), srcManual: manual, citePicks, citeManual }
}

/* Linked sources */

export interface LinkedSource {
  /** The address as competitors are matched by it (no scheme, www or trailing slash). */
  n: string
  url: string
  text: string
  domain: string
  /** The competitors linking to it. */
  from: string[]
  /** How many competitors link to the same site. */
  domDf: number
  /** In the brief before the SEO chooses: linked by two or more, or its site is, up to twenty. */
  def: boolean
}

/** Outside pages the competitors link to, most linked first. */
export function linkData(a: Analysis): LinkedSource[] {
  const m = new Map<string, Omit<LinkedSource, 'domDf' | 'def'>>()
  const dom = new Map<string, Set<string>>()
  for (const c of a.live) {
    const label = labelOf(c)
    const seen = new Set<string>()
    for (const [href, text] of sourceLinks(c)) {
      if (SHARE_RE.test(href)) continue
      const d = hostOf(href)
      if (!d || d === domainOf(c)) continue
      const n = normUrl(href)
      if (seen.has(n)) continue
      seen.add(n)
      let e = m.get(n)
      if (!e) { e = { n, url: href, text: '', domain: d, from: [] }; m.set(n, e) }
      const t = String(text || '').trim()
      if (!e.text && t.length > 3 && !GENERIC_ANCHOR.test(t)) e.text = t
      e.from.push(label)
      if (!dom.has(d)) dom.set(d, new Set())
      dom.get(d)!.add(label)
    }
  }
  const list = [...m.values()].map(e => ({ ...e, domDf: dom.get(e.domain)!.size, def: false }))
  list.sort((x, y) => (y.from.length - x.from.length) || (y.domDf - x.domDf) || x.domain.localeCompare(y.domain))
  let n = 0
  for (const e of list) { e.def = (e.from.length >= 2 || e.domDf >= 2) && n < DEFAULT_SOURCES; if (e.def) n++ }
  return list
}

export interface SourceRow extends LinkedSource { title: string; manual: boolean; inBrief: boolean }

/** A readable title for a source: its anchor text, or its address without scheme and www. */
export function srcTitle(e: { text: string; url: string }): string {
  if (e.text) return e.text
  try { const u = new URL(e.url); return (u.hostname.replace(/^www\./, '') + u.pathname).replace(/\/$/, '') } catch { return e.url }
}

/** The sources the SEO added, the ones found, and the ones that go in the brief (added first). */
export function curatedSources(a: Analysis, c: Curated): { manual: SourceRow[]; auto: SourceRow[]; brief: SourceRow[] } {
  const auto: SourceRow[] = linkData(a).map(e => ({ ...e, title: srcTitle(e), manual: false, inBrief: c.srcPicks[e.n] != null ? c.srcPicks[e.n] : e.def }))
  const manualNs = new Set<string>()
  const manual: SourceRow[] = c.srcManual.map(x => {
    const n = normUrl(x.url)
    manualNs.add(n)
    const text = x.title
    return { n, url: x.url, text, title: srcTitle({ text, url: x.url }), domain: hostOf(x.url), from: [], domDf: 0, def: true, manual: true, inBrief: true }
  })
  const rest = auto.filter(e => !manualNs.has(e.n))
  return { manual, auto: rest, brief: [...manual, ...rest.filter(e => e.inBrief)] }
}

/* Named authorities, Bible books and passages */

export interface CiteRow { name: string; df: number; from: string[]; manual: boolean; inBrief: boolean }

/** What one kind of citation offers: the ones found (the first twelve ticked until the SEO chooses) and the ones typed in. */
export function curatedCites(a: Analysis, c: Curated, kind: CiteKind): { auto: CiteRow[]; manual: CiteRow[]; brief: CiteRow[] } {
  const d = a.N ? citationData(a) : { accord: [], books: [], refs: [] }
  const list: { name: string; df: number; from: string[] }[] = kind === 'auth' ? d.accord : kind === 'books' ? d.books : d.refs
  const picked = c.citePicks[kind] ?? {}
  const names = c.citeManual[kind] ?? []
  const mset = new Set(names.map(m => m.toLowerCase()))
  const auto: CiteRow[] = list.filter(x => !mset.has(x.name.toLowerCase())).map((x, i) => ({ name: x.name, df: x.df, from: x.from, manual: false, inBrief: picked[x.name] != null ? picked[x.name] : i < DEFAULT_CITES }))
  const manual: CiteRow[] = names.map(name => ({ name, df: 0, from: [], manual: true, inBrief: true }))
  return { auto, manual, brief: [...manual, ...auto.filter(x => x.inBrief)] }
}

/** "cited by 3 competitors", or "added by SEO" for a name the SEO typed. */
export const citedBy = (x: { manual: boolean; df: number }): string => (x.manual ? 'added by SEO' : `cited by ${x.df} competitor${x.df === 1 ? '' : 's'}`)

/* Changing the choices: each returns the patch for ts_topics.data (the whole `curated` object, so an imported topic's old keys move over) */

const whole = (c: Curated): Patch => ({ curated: c })

/** Ticks or unticks a linked source for the brief. */
export function pickSource(c: Curated, n: string, on: boolean): Patch {
  if (!n) throw new Error('That source is no longer listed.')
  return whole({ ...c, srcPicks: { ...c.srcPicks, [n]: on } })
}

/** An address the SEO typed: web only, "www.example.com" gets its https://. Null when it is not a web address. */
export function cleanSourceUrl(v: unknown): string | null {
  let s = String(v ?? '').trim()
  if (!s) return null
  if (!/^https?:\/\//i.test(s) && /^[\w-]+(\.[\w-]+)+(\/|$)/.test(s)) s = `https://${s}`
  if (!webUrl(s) || s.length > 2000) return null
  try { return /^https?:$/.test(new URL(s).protocol) ? s : null } catch { return null }
}

export function addManualSource(c: Curated, url: unknown, title: unknown, now = Date.now()): Patch {
  const u = cleanSourceUrl(url)
  if (!u) throw new Error('Paste the full web address of the source, starting with https://')
  const n = normUrl(u)
  if (c.srcManual.some(x => normUrl(x.url) === n)) throw new Error('That source is already in the brief.')
  const picks = { ...c.srcPicks }
  delete picks[n]
  const t = typeof title === 'string' ? title.replace(/\s+/g, ' ').trim().slice(0, 300) : ''
  return whole({ ...c, srcManual: [...c.srcManual, { url: u, title: t, added: now }], srcPicks: picks })
}

export function removeManualSource(c: Curated, n: string): Patch {
  return whole({ ...c, srcManual: c.srcManual.filter(x => normUrl(x.url) !== n) })
}

export function pickCite(c: Curated, kind: CiteKind, name: string, on: boolean): Patch {
  if (!name) throw new Error('That name is no longer listed.')
  return whole({ ...c, citePicks: { ...c.citePicks, [kind]: { ...c.citePicks[kind], [name]: on } } })
}

export function removeManualCite(c: Curated, kind: CiteKind, name: string): Patch {
  return whole({ ...c, citeManual: { ...c.citeManual, [kind]: (c.citeManual[kind] ?? []).filter(x => x !== name) } })
}

/** A name the SEO typed: one the competitors already cite is ticked instead of listed twice. */
export function addManualCite(a: Analysis, c: Curated, kind: CiteKind, input: unknown): Patch {
  const v = typeof input === 'string' ? input.replace(/\s+/g, ' ').trim().slice(0, 120) : ''
  if (!v) throw new Error('Type a name to add.')
  const list = c.citeManual[kind] ?? []
  if (list.some(x => x.toLowerCase() === v.toLowerCase())) throw new Error('That’s already in the brief.')
  const found = curatedCites(a, c, kind).auto.find(x => x.name.toLowerCase() === v.toLowerCase())
  if (found) return pickCite(c, kind, found.name, true)
  return whole({ ...c, citeManual: { ...c.citeManual, [kind]: [...list, v] } })
}

/** One change to the SEO's choices, as the browser sends it. */
export type CuratedOp =
  | { op: 'srcPick'; n: string; on: boolean }
  | { op: 'srcAdd'; url: string; title?: string }
  | { op: 'srcRemove'; n: string }
  | { op: 'citePick'; kind: CiteKind; name: string; on: boolean }
  | { op: 'citeAdd'; kind: CiteKind; name: string }
  | { op: 'citeRemove'; kind: CiteKind; name: string }

const word = (v: unknown, max: number): string => { if (typeof v !== 'string' || !v || v.length > max) throw new Error('That name is no longer listed.'); return v }
const kindOf = (v: unknown): CiteKind => { if (v === 'auth' || v === 'books' || v === 'refs') return v; throw new Error('That list is not available.') }

/** Checks what the browser sent, field by field: anything off is refused with a sentence. */
export function cleanCuratedOp(raw: unknown): CuratedOp {
  if (!isObj(raw)) throw new Error('That change is not available.')
  switch (raw.op) {
    case 'srcPick': return { op: 'srcPick', n: word(raw.n, 2100), on: raw.on === true }
    case 'srcAdd': return { op: 'srcAdd', url: typeof raw.url === 'string' ? raw.url.slice(0, 2100) : '', title: typeof raw.title === 'string' ? raw.title.slice(0, 300) : '' }
    case 'srcRemove': return { op: 'srcRemove', n: word(raw.n, 2100) }
    case 'citePick': return { op: 'citePick', kind: kindOf(raw.kind), name: word(raw.name, 300), on: raw.on === true }
    case 'citeAdd': return { op: 'citeAdd', kind: kindOf(raw.kind), name: typeof raw.name === 'string' ? raw.name.slice(0, 300) : '' }
    case 'citeRemove': return { op: 'citeRemove', kind: kindOf(raw.kind), name: word(raw.name, 300) }
    default: throw new Error('That change is not available.')
  }
}

/** The patch for a checked change. */
export function applyCuratedOp(a: Analysis, c: Curated, o: CuratedOp): Patch {
  switch (o.op) {
    case 'srcPick': return pickSource(c, o.n, o.on)
    case 'srcAdd': return addManualSource(c, o.url, o.title)
    case 'srcRemove': return removeManualSource(c, o.n)
    case 'citePick': return pickCite(c, o.kind, o.name, o.on)
    case 'citeAdd': return addManualCite(a, c, o.kind, o.name)
    case 'citeRemove': return removeManualCite(c, o.kind, o.name)
  }
}

/* The SEO brief */

export interface BriefSource { n: string; url: string; title: string; domain: string; from: string[]; manual: boolean }
export interface BriefCite { name: string; df: number; from: string[]; manual: boolean }
export interface CitationsBrief { src: BriefSource[]; auth: BriefCite[]; books: BriefCite[]; refs: BriefCite[] }

const toCite = (x: CiteRow): BriefCite => ({ name: x.name, df: x.df, from: x.from, manual: x.manual })

/** What goes in the brief: the sources and authorities always, Scripture only for a client with a faith profile. */
export function citationsBrief(a: Analysis, curated: Curated, client: { faith: boolean }): CitationsBrief {
  const s = curatedSources(a, curated)
  return {
    src: s.brief.map(x => ({ n: x.n, url: x.url, title: x.title, domain: x.domain, from: x.from, manual: x.manual })),
    auth: curatedCites(a, curated, 'auth').brief.map(toCite),
    books: client.faith ? curatedCites(a, curated, 'books').brief.map(toCite) : [],
    refs: client.faith ? curatedCites(a, curated, 'refs').brief.map(toCite) : [],
  }
}

const ul = (items: string[]) => `<ul>${items.map(x => `<li>${x}</li>`).join('')}</ul>`
const linkedBy = (x: BriefSource) => (x.from.length ? ` · linked by ${x.from.length} competitor${x.from.length === 1 ? '' : 's'}` : '')

/** The brief's sections for Google Docs, in the Artifact's order: Scripture, linked sources, named authorities. Empty when there is nothing. */
export function citationsBriefHtml(b: CitationsBrief): string {
  return [
    b.books.length || b.refs.length
      ? `<h3>Commonly cited Scripture</h3>${b.books.length ? `<p>${b.books.map(x => esc(x.name)).join(', ')}</p>` : ''}${b.refs.length ? ul(b.refs.map(r => `${esc(r.name)} <i>(${citedBy(r)})</i>`)) : ''}`
      : '',
    b.src.length ? `<h3>Commonly linked sources</h3>${ul(b.src.map(x => `<a href="${esc(x.url)}">${esc(x.title)}</a> <i>(${esc(x.domain)}${linkedBy(x)})</i>`))}` : '',
    b.auth.length ? `<h3>Named authorities</h3>${ul(b.auth.map(x => `${esc(x.name)} <i>(${citedBy(x)})</i>`))}` : '',
  ].filter(Boolean).join('\n')
}

/** The same sections as Markdown; each ends with a line break, so it can be pushed as one piece. Empty when there is nothing. */
export function citationsBriefMarkdown(b: CitationsBrief): string {
  return [
    b.books.length ? `## Commonly cited Scripture\n${b.books.map(x => x.name).join(', ')}\n` : '',
    b.refs.length ? `## Commonly cited passages\n${b.refs.map(r => `- ${r.name} (${citedBy(r)})`).join('\n')}\n` : '',
    b.src.length ? `## Commonly linked sources\n${b.src.map(x => `- [${x.title}](${x.url}) (${x.domain}${linkedBy(x)})`).join('\n')}\n` : '',
    b.auth.length ? `## Named authorities\n${b.auth.map(x => `- ${x.name} (${citedBy(x)})`).join('\n')}\n` : '',
  ].filter(Boolean).join('\n')
}

/* The Citations tab */

export interface CiteList {
  kind: CiteKind
  /** Typed in by the SEO first, then the found ones that are ticked. */
  inBrief: CiteRow[]
  /** Found but not ticked (the first eighty). */
  others: CiteRow[]
  othersTotal: number
}

export interface CitationsView {
  /** Captured competitor pages with text; nothing is found without them. */
  captured: number
  faith: boolean
  books: CiteList
  refs: CiteList
  auth: CiteList
  sources: { inBrief: SourceRow[]; others: SourceRow[]; othersTotal: number }
  /** Books found that are not topic terms yet (the "also add a book to the topic terms" chips). */
  bookTerms: { name: string; key: string }[]
}

const OTHERS_CITES = 80
const OTHERS_SOURCES = 150

function citeList(a: Analysis, c: Curated, kind: CiteKind): CiteList {
  const x = curatedCites(a, c, kind)
  const out = x.auto.filter(r => !r.inBrief)
  return { kind, inBrief: x.brief, others: out.slice(0, OTHERS_CITES), othersTotal: out.length }
}

/** Everything the Citations tab shows, as plain data. */
export function citationsView(a: Analysis, curated: Curated, client: { faith: boolean }): CitationsView {
  const s = curatedSources(a, curated)
  const out = s.auto.filter(e => !e.inBrief)
  const have = new Set(a.termObjs().map(t => t.key))
  const books = citeList(a, curated, 'books')
  const foundBooks = a.N ? citationData(a).books : []
  return {
    captured: a.N,
    faith: client.faith,
    books,
    refs: citeList(a, curated, 'refs'),
    auth: citeList(a, curated, 'auth'),
    sources: { inBrief: s.brief, others: out.slice(0, OTHERS_SOURCES), othersTotal: out.length },
    bookTerms: client.faith ? foundBooks.filter(b => !have.has(termKey(b.name))).map(b => ({ name: b.name, key: termKey(b.name) })) : [],
  }
}
