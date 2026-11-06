/* Text analysis engine of Topic Studio (no DOM, no server-only: runs on server, client and in vitest).
   Port of the Artifact's engine, behaviour for behaviour. The only change in strings: the em dash placeholder
   of fleschLabel is a plain hyphen. */

/* Types */
export interface Seg {
  sf: string[]
  st: string[]
  hy: boolean[]
  sec?: number
}
export interface Section {
  h: string
  l: number
  idx: number
}
export type Block = [string, string]
export interface SourceMeta {
  label?: string
  url?: string
  rank?: number
  title?: string
  desc?: string
  [key: string]: unknown
}
export interface Source extends SourceMeta {
  blocks: Block[]
  grams: Map<string, number>
  headGrams: Set<string>
  segs: Seg[]
  sections: Section[]
  headings: { l: number; t: string }[]
  words: number
  flesch?: number | null
  text?: string
  _rsegs?: string[][]
}
export interface Ctx {
  forms: Map<string, Map<string, number>>
  caps: Map<string, [number, number]>
}
export interface Term {
  t: string
  key?: string
  altKeys?: string[]
  alts?: string[]
  tier?: string
  [key: string]: unknown
}
export interface Rules {
  size: number
  singles: number
  everyday: number
  inside: number
  fragments: number
  spread: number
  usage: number
  headings: number
  ai: number
  setup: number
}
export interface Candidate {
  k: string
  t: string
  df: number
  tf: number
  ai: number
  hdf: number
  n: number
  head: boolean
  pk: boolean
  score: number
  why: string
}
export interface Excluded {
  k: string
  t: string
  df: number
  tf: number
  ai?: number
  by: string
}
export interface BuildOpts {
  primary?: string
  rules?: Partial<Rules>
  secondary?: string
  rich?: string
  avoid?: string
}
export interface Question {
  q: string
  key: string
  from: (string | undefined)[]
  heading: boolean
}

/* Internal working entry of buildCandidates */
interface Entry {
  k: string
  df: number
  hdf: number
  tf: number
  ai: number
  aiTf?: number
  n?: number
  t?: string
  generic?: boolean
  topical?: boolean
  secExact?: boolean
  sec?: boolean
  ans?: number
  q?: boolean
  pk?: boolean
  common?: boolean
  allCommon?: boolean
  stopsIn?: number
  edgeCommon?: number
  head?: boolean
  drop?: boolean
}

const TEMPLATE_STOPS: string[] = ["to","the","a","are","as","is","you","your","their","this","do","can","i","have","when","he","so","but","how","what","of the","in","that","for","them","it","we","with","they","be","our","will","on","about","or","in the","his","my","has","of","from","all","them to","us","if","was","him","one","up","it is","her","by","at","who","should","and","it's","to be","get","need","an","it’s","she","see","is the","how to","every","out","in their","and the","is a","we are","don’t","in a","to the","just","into","would","been","they will","is not","if you","understand that","others","for your","where","to get","so that","out of","through","they are","as a","these","on the","you are","then","much","that they","me","to do","there","to understand","too","own","let","go","not","like","well","of a","this is","even","because","always","were","when you","means","in our","to your","is to","you’re","for the","and to","say","we can","is our","in all","and for","always be","that they will","them to the","this is the","this is a","you are not","with them and","there is no","the one who","they will have","the need to","those who are","with each","as an","when the","and their","who are","and who","they know","who will","so they","who is","one that","or a","being a","let me","for each","to them","do your","know that","also","each","had","does","myself","ourselves","yours","yourself","yourselves","hers","herself","himself","itself","themselves","am","being","did","doing","could","might","shall","until","above","below","down","off","over","under","after","during","before","between","against","any","both","few","more","most","other","same","such","no","nor","only","very","than","once","further","here","why","i’m","we’re","we’ve","we’ll","we’d","you’ve","you’ll","you’d","he’s","he’ll","he’d","she’s","she’ll","she’d","it’ll","it’d","they’re","they’ve","they’ll","they’d","that’s","what’s","who’s","where’s","when’s","why’s","how’s","here’s","there’s","let’s","ma’am","might’ve","must’ve","could’ve","should’ve","would’ve","here’re","there’d","there’ll","where’d","where’ll","what’ll","what’re","who’ll","who’d","who’ve","gonna","gotta","wanna","y’all","’tis","’twas","imma","ain’t","aren’t","can’t","couldn’t","doesn’t","didn’t","haven’t","hasn’t","hadn’t","isn’t","mightn’t","mustn’t","needn’t","oughtn’t","shan’t","shouldn’t","wasn’t","weren’t","won’t","wouldn’t","while","which","some","now","whom","those","having","theirs","may","many","must","however","really","etc"]
const EXTRA_STOPS: string[] = "about again ago all almost along already although among around away back became become becomes becoming beside besides beyond came come comes cannot could did either else enough ever everything everyone everybody anything anyone anybody something someone somebody nothing nobody instead its itself just least less lot lots made make makes making maybe mean meant meanwhile mine more moreover much nearly neither next often ones onto otherwise ours perhaps quite rather said says seem seemed seems seen several shall since sometimes somewhat soon still sure take taken takes taking thing things thus together toward towards upon us used uses using via want wants way ways whatever whenever wherever whether whose within without yes yet get gets getting got gotten go goes going gone went also i'd i'll i've let's that's there's it's don't can't won't isn't aren't didn't doesn't etc e.g i.e per non like likely unlike tell told really truly simply actually especially example examples include includes including one two three four five six seven eight nine ten first second third".split(' ')
const NOISE_ANY = new Set("click cookie cookies subscribe subscribed newsletter login logged signup copyright reserved facebook twitter pinterest instagram linkedin whatsapp tiktok youtube http https www com html pdf javascript advertisement sponsored affiliate".split(' '))
const NOISE_UNI = new Set("self share shares shared read reading post posts blog article articles page pages site website image images photo photos video videos author updated published min minute minutes privacy policy download free app comment comments reply replies email emails menu search home contact view continue related category tags tag".split(' '))
const GENERIC = new Set("make made help helps helping helped know knowing knew want need needs find found look looking use used time times day days year years good great important often new right part able best better start started keep give gives giving given try trying put see show shows work works working thing things lot others someone person people number different many important really able also call called around set kind sort type types end even matter".split(' '))
const AUX = new Set("is are was were be been being am can could will would should may might must do does did has have had it's that's".split(' '))
const KEEP_S = new Set("always perhaps across whereas sometimes news series species christmas alas lens physics ethics politics its yes thus this his hers ours yours theirs was has does is us gas bus plus".split(' '))
const IRREG: Record<string, string> = {children:'child', men:'man', women:'woman', wives:'wife', lives:'life', feet:'foot', teeth:'tooth', mice:'mouse', geese:'goose'}
const toStraight = (s: string): string => s.replace(/[’‘`]/g, "'")
export const STOP = new Set<string>()
const STOP_PHRASES = new Set<string>()
for (const w of TEMPLATE_STOPS) { const s = toStraight(w).toLowerCase(); if (s.includes(' ')) STOP_PHRASES.add(s); else STOP.add(s.replace(/^'/, '')) }
for (const w of EXTRA_STOPS) STOP.add(w)
/* Everyday English words that are rarely useful on their own as topic terms (not stop words, but generic). */
const COMMON_WORDS: string = "able accept action activity actually add addition adult advantage advice affect afraid afternoon again age agree agreement air allow almost alone already always amount angry animal another answer anxious appear approach area areas argument arrangement arrive art ask attempt attend audience author available average avoid aware back background bad bag ball bank bar bare base basic basis beautiful become bed begin believe belong best better big bill birth bit bits bitter black blood blue board boat body book boring bottom box brain branch brave break bridge brief bright bring broad brown build bus business busy buy call calm capital car card career careful carry case cause center century certain chair chance change channel character charge cheap check chief choice choose circle city class clean clear clever close clothes club coach coast cold collection color column come comment committee common company compare complete concern condition conference connection consider contact contain content context continue contract control cook copy corner correct cost count couple course cover crazy create cross crowd cruel cup current customer cut damage dark date daughter day dead deal dear debate decide decision deep degree department describe design detail develop development difference different difficult dinner direction dirty discuss discussion distance door double doubt draw drawing dream dress drink drive driver drop dry duty early earn easy eat edge effect effective effort egg element emotion emotional empty end energy engine enjoy enter entire entry environment equal error especially essential evening event ever evidence example excellent exciting exist expect expensive experience expert explain extent extra eye fact fair fall false familiar famous far fast fat fear feature fee feel feeling few field figure file fill final find fine finger finish fire firm first fish fit fix flat flower focus follow food football force foreign forest forget form formal frame free freedom fresh friend friendly front fruit full fun funny future gain garden gas general gentle get gift give glad glass global go goal gold good government gray great green ground group grow guess guest guide hall hand handle happen happy hard hat hate head healthy hear heat heavy height helpful hide high history hit hold hole holiday honest hope horse hot hotel house huge human hundred hungry hurt husband ice idea identify ill image imagine important impossible improve include income increase independent indicate individual industry information interest interesting interview involve island issue item jealous job join journey judge jump keep key kick kind kinds kitchen knee know knowledge lack lady lake land lane language large last late later laugh law lay lazy lead learn least leave lecture leg lend length less lesson let letter level library lie life lift light likely limit line link lip list listen live load local lonely long look loose lose lot lots loud lovely low lucky lunch mad magazine mail main maintain major majority make man manage manager many map mark market matter meal means measure meat medium meet meeting member mention method mild mile milk mind minister minute mirror miss model modern moment money month mood more morning most mouth move much music name narrow nasty national natural near nearby nearly neat neck need negative neighbor nerve nervous net never new news next nice noise normal note notice novel number object obtain obvious occur ocean odd offer office official often old open opinion opportunity option order ordinary organization origin original other overall owner pack page pair pale paper part particular partner parts party pass passage past path pattern pay peace pen people percent perfect perform period person personal phase phrase physical pick picture piece place plain plan plant plate play pleasant pocket poem point policy polite pool poor popular position positive possible pound practice prefer prepare present press pressure pretty prevent previous price prince principle private prize probably problem process produce product program project promise proof proper protect proud prove provide public pull pure purpose push put quality quarter queen question quick quiet quite race radio rain raise range rare rate rather raw reach reaction read reading ready real reality realize really reason receive recent recognize record reduce refer reflect refuse regard region regular relate release relief remain remember remove repair repeat replace reply report represent request require research reserve resource response rest result return reveal review rice rich ride right ring ripe rise risk river rock role room root rough round route row royal rude rule run sad safe safety sale salt same sample sand save scared scene schedule scheme school science screen sea search season seat second secret section sector see seek seem selection send senior sense sensible series serious serve service set settle several severe shake shape share sharp sheet shelf shift ship shirt shoe shoot shop short shot shoulder show shut shy sick side sight sign silent silly silver simple simply sing sister sit site situation size skill skin sky sleep slight slow small smart smile smooth snow social society soft soil soldier solid solution solve sometimes song sorry sort sound soup sour source space speak special specific speech speed spend sport spot spread spring square staff stage stand standard state stay steel step stick still stock stomach stone stop store storm story strange strategy street strict strong structure student studio study stuff stupid style subject success successful sudden suffer sugar suggest suit summer sun supply support suppose sure surface surprise survey survive sweet system table take tale talk tall target task taste tea teach team telephone television tell temperature tend tender tennis tent term terrible thank theory thick thin thing things think thought throw ticket tight time tiny tired title tone tooth top topic total touch tough tour tower toy track trade tradition traditional traffic train travel treat trip trouble truck true trust truth try turn type types typical ugly unable understand unfair unique unit university unusual upper upset use useful user usual usually valuable value variety various vehicle version victim video view village visit visitor voice vote wage wait wake walk want war warm warn wash watch wave way ways weak wear weather wedding week weight welcome wet wheel whole wide wild win winter wise wish woman wonder wonderful word world worried worry worse write writer wrong yard year yet young youth zone"

export function stem(w: string): string {
  if (w.length <= 3 || STOP.has(w)) return w
  if (IRREG[w]) return IRREG[w]
  if (w.endsWith("'s")) w = w.slice(0, -2)
  if (KEEP_S.has(w) || w.length <= 3) return w
  if (/[^aeiou]ies$/.test(w) && w.length > 4) return w.slice(0, -3) + 'y'
  if (/(ss|us|is|ous|ics)$/.test(w)) return w
  if (/(ches|shes|xes|sses|zzes)$/.test(w)) return w.slice(0, -2)
  if (w.endsWith('s')) return w.slice(0, -1)
  return w
}
const COMMON = new Set(COMMON_WORDS.split(/\s+/).map(w => stem(w)))
const SEG_SPLIT = /[.!?;:,()\[\]{}"\u201c\u201d\u2014\u2013\u2026|•·\n\r\t]+|\s-\s/
const WORD_RE = /[A-Za-z0-9À-ɏ]+(?:'[A-Za-z]+)?/g
export function tokenize(text: unknown, caps?: Map<string, [number, number]> | null): Seg[] {
  const segs: Seg[] = []
  const parts = toStraight(String(text || '')).replace(/https?:\/\/\S+|www\.\S+/g, ' ').split(SEG_SPLIT)
  for (const part of parts) {
    if (!part) continue
    const sf: string[] = [], hy: boolean[] = []
    let lastEnd = -1
    let m: RegExpExecArray | null
    WORD_RE.lastIndex = 0
    while ((m = WORD_RE.exec(part))) {
      const low = m[0].toLowerCase()
      if (sf.length) hy.push(part.slice(lastEnd, m.index) === '-')
      if (caps && sf.length) { const e = caps.get(low) || [0, 0]; e[1]++; if (/^[A-Z]/.test(m[0])) e[0]++; caps.set(low, e) }
      sf.push(low); lastEnd = m.index + m[0].length
    }
    if (sf.length) { hy.push(false); segs.push({ sf, st: sf.map(stem), hy }) }
  }
  return segs
}
export function termKey(term: unknown): string { return tokenize(term).map(s => s.st.join(' ')).join(' ').trim() }
export function countWords(text: unknown): number { return (String(text || '').match(/[A-Za-z0-9À-ɏ]+(?:['’][A-Za-z]+)?/g) || []).length }
export function syllables(w: string): number {
  w = w.toLowerCase().replace(/[^a-z]/g, ''); if (!w) return 0; if (w.length <= 3) return 1
  w = w.replace(/(?:[^laeiouy]es|[^laeiouy]ed|[^laeiouy]e)$/, '').replace(/^y/, '')
  const m = w.match(/[aeiouy]{1,2}/g); return Math.max(1, m ? m.length : 1)
}
export function splitSentences(text: unknown): string[] { return String(text).split(/(?<=[.!?])\s+(?=["“'(\[]?[A-Z0-9])/).map(s => s.trim()).filter(Boolean) }
export function flesch(blocks: Block[]): number | null {
  let words = 0, sents = 0, syl = 0
  for (const [tag, text] of blocks) {
    if (/^h\d$/.test(tag)) continue
    const ss = splitSentences(text); sents += Math.max(1, ss.length)
    const ws = String(text).match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) || []
    words += ws.length; for (const w of ws) syl += syllables(w)
  }
  if (words < 30) return null
  return Math.round(206.835 - 1.015 * (words / sents) - 84.6 * (syl / words))
}
export function fleschLabel(f: number | null | undefined): string {
  if (f == null) return '-'
  if (f >= 90) return 'Very easy'; if (f >= 80) return 'Easy'; if (f >= 70) return 'Fairly easy'; if (f >= 60) return 'Plain English'
  if (f >= 50) return 'Fairly difficult'; if (f >= 30) return 'Difficult'; return 'Very difficult'
}
/* Share of each word's uses that sit inside the given phrases (exact, no double counting). */
export function unigramCoverage(live: Source[], phraseKeys: string[]): Map<string, number> {
  const P = phraseKeys.map(k => k.split(' ')); const total = new Map<string, number>(), cov = new Map<string, number>()
  for (const src of live) for (const seg of src.segs) {
    const st = seg.st; const mark = new Uint8Array(st.length)
    for (const ph of P) { const L = ph.length; for (let i = 0; i + L <= st.length; i++) { let ok = true; for (let k = 0; k < L; k++) if (st[i + k] !== ph[k]) { ok = false; break } if (ok) for (let k = 0; k < L; k++) mark[i + k] = 1 } }
    for (let i = 0; i < st.length; i++) { total.set(st[i], (total.get(st[i]) || 0) + 1); if (mark[i]) cov.set(st[i], (cov.get(st[i]) || 0) + 1) }
  }
  const out = new Map<string, number>(); for (const [k, t] of total) out.set(k, (cov.get(k) || 0) / t); return out
}
/* Orders candidates so single words are a minority: only useful head words qualify, words that mostly appear inside
   chosen phrases are dropped, and single words never exceed about a third of any prefix of the list. */
export function mixOrder(list: Candidate[], live: Source[], rules?: Partial<Rules> | null): Candidate[] {
  const R: Rules = Object.assign({}, RULES_DEFAULT, rules || {}); const share = Math.max(0.05, R.singles / 100); const thr = R.inside >= 100 ? 2 : R.inside / 100
  const phrases = list.filter(c => c.n >= 2); const cov = unigramCoverage(live, phrases.slice(0, 45).map(c => c.k))
  const ok: Candidate[] = [], rest: Candidate[] = []
  for (const c of list) if (c.n === 1) (((c.head || R.singles >= 55) && (c.pk || (cov.get(c.k) || 0) < thr)) ? ok : rest).push(c)
  const out: Candidate[] = []; let pi = 0, ui = 0, uni = 0
  while (pi < phrases.length || ui < ok.length) {
    const p = phrases[pi], u = ok[ui]
    const canU = u && (uni + 1) <= Math.max(2, Math.floor((out.length + 1) * share))
    if (u && canU && (!p || u.score >= p.score)) { out.push(u); ui++; uni++ }
    else if (p) { out.push(p); pi++ }
    else { out.push(u); ui++; uni++ }
  }
  return out.concat(rest)
}
export function buildSource(meta: SourceMeta, blocks: Block[] | null | undefined, ctx?: Ctx | null): Source {
  const src: Source = Object.assign({}, meta, { blocks: blocks || [], grams: new Map<string, number>(), headGrams: new Set<string>(), segs: [] as Seg[], sections: [] as Section[], headings: [] as { l: number; t: string }[], words: 0 })
  let sec: Section = { h: 'Introduction', l: 0, idx: 0 }; src.sections.push(sec)
  for (const [tag, text] of src.blocks) {
    const isH = /^h\d$/.test(tag)
    src.words += countWords(text)
    if (isH) { sec = { h: text, l: +tag[1], idx: src.sections.length }; src.sections.push(sec); src.headings.push({ l: +tag[1], t: text }) }
    for (const seg of tokenize(text, ctx && ctx.caps)) {
      seg.sec = sec.idx; src.segs.push(seg)
      const { st, sf, hy } = seg
      for (let i = 0; i < st.length; i++) {
        let key = '', surf = ''
        for (let n = 1; n <= 4 && i + n - 1 < st.length; n++) {
          const j = i + n - 1
          key = n === 1 ? st[i] : key + ' ' + st[j]
          surf = n === 1 ? sf[i] : surf + (hy[j - 1] ? '-' : ' ') + sf[j]
          src.grams.set(key, (src.grams.get(key) || 0) + 1); if (isH) src.headGrams.add(key)
          if (ctx && ctx.forms && !(i > 0 && hy[i - 1]) && !hy[j]) { let f = ctx.forms.get(key); if (!f) { f = new Map<string, number>(); ctx.forms.set(key, f) } f.set(surf, (f.get(surf) || 0) + 1) }
        }
      }
    }
  }
  for (const t of [src.title, src.desc]) for (const seg of tokenize(t || '')) for (let i = 0; i < seg.st.length; i++) { let key = ''; for (let n = 1; n <= 4 && i + n - 1 < seg.st.length; n++) { key = n === 1 ? seg.st[i] : key + ' ' + seg.st[i + n - 1]; src.headGrams.add(key) } }
  src.flesch = flesch(src.blocks)
  src.text = src.blocks.map(b => b[1]).join('\n')
  return src
}
/* Light root matching so "tracking", "tracked" and "track" count as the same idea. */
const ROOT_SUF = ['izations','ization','ational','ations','ation','ingly','ments','ment','ness','ities','ity','ings','ing','ibles','ible','able','ful','ers','ies','ied','ors','ions','ion','als','ed','er','es','ly','or','al','s','y'].sort((a, b) => b.length - a.length)
const _rootCache = new Map<string, string>()
export function rootOf(w: unknown): string {
  const s0 = String(w || '').toLowerCase().replace(/['’]s$/, '')
  if (s0.length <= 3) return s0
  const hit = _rootCache.get(s0); if (hit) return hit
  let r = s0
  for (let pass = 0; pass < 2; pass++) {
    let changed = false
    for (const s of ROOT_SUF) { const min = s === 's' ? 3 : 4; if (r.length - s.length >= min && r.endsWith(s)) { r = r.slice(0, -s.length); changed = true; break } }
    if (!changed) break
  }
  if (r.length > 3 && r.endsWith('e')) r = r.slice(0, -1)
  r = r.replace(/([b-df-hj-np-tv-z])\1$/, '$1')
  _rootCache.set(s0, r); return r
}
export function contentRoots(text: unknown): string[] { return [...new Set(tokenize(text).flatMap(s => s.sf.filter(w => !STOP.has(w) && w.length > 1).map(rootOf)))] }
export function rootMatchTerm(src: Source | null | undefined, term: Term): boolean {
  if (!src || !src.segs) return false
  if (!src._rsegs) src._rsegs = src.segs.map(s => s.sf.map(rootOf))
  for (const text of [term.t, ...(term.alts || [])]) {
    const roots = tokenize(text).flatMap(s => s.sf).map(rootOf); if (!roots.length) continue
    for (const rs of src._rsegs) for (let i = 0; i + roots.length <= rs.length; i++) { let ok = true; for (let k = 0; k < roots.length; k++) if (rs[i + k] !== roots[k]) { ok = false; break } if (ok) return true }
  }
  return false
}
export function countIn(src: Source | null | undefined, key: string | null | undefined): number {
  if (!src || !key) return 0
  const parts = key.split(' ')
  if (parts.length <= 4) return src.grams.get(key) || 0
  let c = 0
  for (const seg of src.segs) for (let i = 0; i + parts.length <= seg.st.length; i++) { let ok = true; for (let k = 0; k < parts.length; k++) if (seg.st[i + k] !== parts[k]) { ok = false; break } if (ok) c++ }
  return c
}
export function sectionsWith(src: Source, key: string): Section[] {
  const parts = key.split(' '), hits = new Map<number, number>()
  for (const seg of src.segs) {
    for (let i = 0; i + parts.length <= seg.st.length; i++) {
      let ok = true; for (let k = 0; k < parts.length; k++) if (seg.st[i + k] !== parts[k]) { ok = false; break }
      if (ok) { hits.set(seg.sec as number, (hits.get(seg.sec as number) || 0) + 1); break }
    }
  }
  return [...hits.keys()].map(i => src.sections[i])
}
export function bestForm(ctx: Ctx, key: string): string {
  const f = ctx.forms.get(key); if (!f) return key
  let best = key, bc = -1; for (const [s, c] of f) if (c > bc) { bc = c; best = s }
  return best.split(/([ -])/).map(t => { const e = ctx.caps.get(t); return e && e[1] >= 3 && e[0] / e[1] > 0.8 ? t.charAt(0).toUpperCase() + t.slice(1) : t }).join('')
}
export function median(a: number[]): number { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2) }
export function pct(a: number[], p: number): number { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))] }

export function contentStems(text: unknown): string[] { const out: string[] = []; for (const s of tokenize(text)) s.st.forEach((t, i) => { if (!STOP.has(s.sf[i]) && t.length > 1) out.push(t) }); return out }
export const splitLines = (s: unknown): string[] => String(s || '').split(/\n+/).map(x => x.trim()).filter(Boolean)
/* Returns a test for "this term is about something the SEO wants to avoid":
   the term contains every distinctive word of an avoided phrase, or the term is made only of
   that phrase's words and at least one of them isn't part of the topic itself. */
export function makeAvoidTest(avoidText: unknown, coreText: unknown): (disp: string) => string {
  const root = (t: string): string => t.length > 4 ? t.replace(/(ings?|ers?|ed|ly|ions?|ful)$/, '') : t
  const core = new Set(contentStems(coreText).map(root))
  const avoid = splitLines(avoidText).map(contentStems).filter(a => a.length)
  if (!avoid.length) return () => ''
  return disp => {
    const cst = String(disp).toLowerCase().split(/[\s-]+/).filter(w => w && !STOP.has(w)).map(stem)
    if (!cst.length) return ''
    for (let i = 0; i < avoid.length; i++) {
      const a = avoid[i]; const d = a.filter(t => !core.has(root(t)))
      if (a.every(t => cst.includes(t))) return splitLines(avoidText)[i]
      if (d.length && d.every(t => cst.includes(t))) return splitLines(avoidText)[i]
      if (cst.every(t => a.includes(t)) && cst.some(t => d.includes(t))) return splitLines(avoidText)[i]
    }
    return ''
  }
}
/* Build rules (all adjustable per topic with the sliders on the Topic terms tab). */
export const RULES_DEFAULT: Rules = { size: 35, singles: 55, everyday: 30, inside: 50, fragments: 40, spread: 100, usage: 60, headings: 10, ai: 50, setup: 80 }
export function buildCandidates(comps: (Source | null | undefined)[], ai: Source | (Source | null | undefined)[] | null | undefined, ctx: Ctx, topicText: unknown, opts?: BuildOpts | null): { list: Candidate[]; N: number; excluded: Excluded[] } {
  const live = comps.filter((c): c is Source => !!c && c.words > 0); const N = Math.max(1, live.length)
  const all = new Map<string, Entry>()
  for (const c of live) for (const [k, v] of c.grams) { let e = all.get(k); if (!e) { e = { k, df: 0, hdf: 0, tf: 0, ai: 0 }; all.set(k, e) } e.df++; e.tf += v; if (c.headGrams && c.headGrams.has(k)) e.hdf++ }
  const ais = Array.isArray(ai) ? ai.filter((a): a is Source => !!a) : ai ? [ai] : []
  for (const a of ais) for (const [k, v] of a.grams) { let e = all.get(k); if (!e) { e = { k, df: 0, hdf: 0, tf: 0, ai: 0, aiTf: 0 }; all.set(k, e) } e.ai = (e.ai || 0) + 1; e.aiTf = (e.aiTf || 0) + v }
  const minDf = N >= 8 ? 3 : N >= 3 ? 2 : 1
  const topical = new Set<string>(); for (const s of tokenize(topicText)) s.st.forEach((t, i) => { if (!STOP.has(s.sf[i]) && t.length > 2) topical.add(t) })
  const o: BuildOpts = opts || {}; const R: Rules = Object.assign({}, RULES_DEFAULT, o.rules || {})
  const primarySet = new Set<string>(); for (const s of tokenize(o.primary || '')) s.st.forEach((t, i) => { if (!STOP.has(s.sf[i]) && t.length > 2) primarySet.add(t) })
  const secLines = splitLines(o.secondary)
  const secSet = new Set(secLines.flatMap(contentStems).filter(t => t.length > 2))
  const secKeys = new Set(secLines.map(termKey))
  const qLines = splitLines(o.rich).map(contentStems).filter(a => a.length)
  const qSet = new Set(qLines.flat().filter(t => t.length > 2 && !topical.has(t)))
  const answer = new Map<string, number>()
  if (qLines.length) for (const c of live) {
    const secs = new Set<number>()
    for (const sec of c.sections) { if (!sec.l) continue; const hs = new Set(contentStems(sec.h)); if (qLines.some(q => q.filter(t => hs.has(t)).length / q.length >= 0.5)) secs.add(sec.idx) }
    if (!secs.size) continue
    const seen = new Set<string>()
    for (const seg of c.segs) { if (!secs.has(seg.sec as number)) continue; const st = seg.st; for (let i = 0; i < st.length; i++) { let key = ''; for (let n = 1; n <= 4 && i + n - 1 < st.length; n++) { key = n === 1 ? st[i] : key + ' ' + st[i + n - 1]; seen.add(key) } } }
    for (const k of seen) answer.set(k, (answer.get(k) || 0) + 1)
  }
  const avoidTest = makeAvoidTest(o.avoid, topicText); const excluded: Excluded[] = []
  let maxTf = 1; const out: Entry[] = []
  for (const e of all.values()) {
    const n0 = e.k.split(' ').length; const need = n0 >= 3 ? Math.max(2, minDf - 1) : minDf
    if (!(e.df >= need || (e.ai && e.df >= Math.max(1, need - 1)) || (answer.get(e.k) || 0) >= 2)) continue
    if (e.tf + (e.aiTf || 0) < 2) continue
    if (!ctx.forms.has(e.k)) continue
    const toks = e.k.split(' '); const n = toks.length
    const disp = bestForm(ctx, e.k); const low = disp.toLowerCase()
    const words = low.split(/[ -]/)
    if (STOP_PHRASES.has(low)) continue
    if (STOP.has(words[0]) || STOP.has(words[words.length - 1])) continue
    if (words.some(w => NOISE_ANY.has(w))) continue
    if (n >= 3 && words.slice(1, -1).some(w => AUX.has(w))) continue
    if (/^\d+$/.test(words[words.length - 1]) || words.every(w => /^\d+$/.test(w))) continue
    if (n === 1 && (words[0].length < 3 || NOISE_UNI.has(words[0]))) continue
    if (words.every(w => STOP.has(w) || GENERIC.has(w))) { if (n > 1) continue }
    const hit = avoidTest(disp); if (hit) { excluded.push({ k: e.k, t: disp, df: e.df, tf: e.tf, ai: e.ai || 0, by: hit }); continue }
    e.n = n; e.t = disp; e.generic = n === 1 && GENERIC.has(words[0]); e.topical = toks.some(t => topical.has(t)); e.secExact = secKeys.has(e.k); e.sec = toks.some(t => secSet.has(t)); e.ans = answer.get(e.k) || 0; e.q = toks.some(t => qSet.has(t))
    e.pk = n === 1 && primarySet.has(e.k); e.common = n === 1 && !e.topical && COMMON.has(e.k); e.allCommon = n > 1 && !e.topical && toks.every(t => COMMON.has(t) || STOP.has(t))
    e.stopsIn = n >= 3 ? toks.slice(1, -1).filter(t => STOP.has(t)).length : 0; e.edgeCommon = n >= 2 ? (COMMON.has(toks[0]) ? 1 : 0) + (COMMON.has(toks[n - 1]) ? 1 : 0) : 0
    e.head = n === 1 && (e.pk || e.topical || e.hdf >= 2 || (e.ai || 0) >= 2 || (!COMMON.has(e.k) && e.df / N >= 0.5))
    out.push(e); if (e.tf > maxTf) maxTf = e.tf
  }
  const byKey = new Map(out.map(e => [e.k, e]))
  for (const x of excluded.slice()) {
    const t = x.k.split(' '); if (t.length < 2) continue
    for (let len = 1; len < t.length; len++) for (let i = 0; i + len <= t.length; i++) {
      const a = byKey.get(t.slice(i, i + len).join(' '))
      if (a && !a.drop && x.tf >= 0.8 * a.tf) { a.drop = true; excluded.push({ k: a.k, t: a.t as string, df: a.df, tf: a.tf, by: x.by }) }
    }
  }
  for (const b of out) {
    if ((b.n as number) < 2) continue; const t = b.k.split(' ')
    for (let len = 1; len < t.length; len++) for (let i = 0; i + len <= t.length; i++) {
      const a = byKey.get(t.slice(i, i + len).join(' '))
      if (a && !a.drop && b.tf >= 0.8 * a.tf && b.df >= a.df - 1) a.drop = true
    }
  }
  /* Each length (1 to 4 words) is scored against its own best terms, so phrases aren't judged against the most common single word. */
  const alive = out.filter(e => !e.drop)
  const tfMax: Record<number, number> = {}; for (const e of alive) tfMax[e.n as number] = Math.max(tfMax[e.n as number] || 1, e.tf)
  const headCap = Math.max(2, 0.3 * N)
  const w = { spread: R.spread / 100, usage: R.usage / 100, heads: R.headings / 100, ai: R.ai / 100 }
  const wsum = Math.max(0.05, w.spread + w.usage + w.heads + w.ai)
  const aiPart = (e: Entry): number => e.ai ? Math.min(1, e.ai / Math.min(2, Math.max(1, ais.length))) + (e.ai >= 3 ? 0.2 : 0) : 0
  const raw = (e: Entry): number => w.spread * (e.df / N) + w.usage * (Math.log1p(e.tf) / Math.log1p(tfMax[e.n as number])) + w.heads * Math.min(1, e.hdf / headCap) + w.ai * aiPart(e)
  const ref: Record<number, number> = {}; for (const n of [1, 2, 3, 4]) { const sc = alive.filter(e => e.n === n).map(raw).sort((a, b) => b - a).slice(0, 5); ref[n] = Math.max(sc.length ? sc.reduce((a, b) => a + b, 0) / sc.length : 1, 0.45 * wsum) }
  const boost: Record<number, number> = { 1: 1, 2: 1.05, 3: 0.95, 4: 0.7 }
  const gen = 1 - 0.55 * Math.min(1, R.everyday / 50), ev = 1 - 0.7 * R.everyday / 100, ev2 = 1 - 0.3 * R.everyday / 100, fs = 1 - 0.5 * R.fragments / 100, fe = 1 - 0.16 * R.fragments / 100, sp = R.setup / 100
  const res: Candidate[] = alive.map(e => {
    const en = e.n as number
    let s = raw(e) / ref[en]
    s *= boost[en] || 1; if (en === 1) s *= Math.pow(R.singles / RULES_DEFAULT.singles, 0.6); if (e.generic) s *= gen; if (e.common) s *= ev; if (e.allCommon) s *= ev2; if (e.topical) s *= 1.15
    if (e.stopsIn) s *= Math.pow(fs, e.stopsIn); if (e.edgeCommon && !e.topical) s *= Math.pow(fe, e.edgeCommon)
    if (e.secExact) s *= Math.pow(1.15, sp); else if (e.sec) s *= Math.pow(1.06, sp)
    if (e.ans) s *= Math.pow(e.ans >= 2 ? 1.15 : 1.08, sp); else if (e.q) s *= Math.pow(1.05, sp)
    return { k: e.k, t: e.t as string, df: e.df, tf: e.tf, ai: e.ai, hdf: e.hdf, n: en, head: !!e.head, pk: !!e.pk, score: s, why: e.ans ? 'answer' : e.q ? 'question' : (e.secExact || e.sec) ? 'secondary' : '' }
  })
  res.sort((a, b) => b.score - a.score)
  excluded.sort((a, b) => b.df - a.df)
  return { list: res, N, excluded }
}

/* questions */
export const QSTART = /^(how|what|why|when|where|who|which|can|could|does|do|did|is|are|should|will|would|was|were|has|have|may)\b/i
export function extractQuestions(sources: (Source | null | undefined)[]): Question[] {
  const map = new Map<string, Question>()
  sources.forEach(src => {
    if (!src) return
    const seen = new Set<string>()
    const add = (q: string, fromHeading: boolean): void => {
      q = q.replace(/^[\d.)\s#*–-]+/, '').replace(/\s+/g, ' ').trim()
      const wc = countWords(q); if (wc < 3 || wc > 24) return
      const key = termKey(q.replace(/\?$/, '')); if (!key || seen.has(key)) return; seen.add(key)
      let e = map.get(key); if (!e) { e = { q: /\?$/.test(q) ? q : q + '?', key, from: [], heading: false }; map.set(key, e) }
      e.from.push(src.label); if (fromHeading) e.heading = true
    }
    for (const [tag, text] of src.blocks) {
      if (/^h[1-6]$/.test(tag)) { if (/\?\s*$/.test(text) || (QSTART.test(text) && countWords(text) <= 14)) add(text, true) }
      else for (const s of splitSentences(text)) if (/\?["”']?$/.test(s) && QSTART.test(s.replace(/^["“']/, ''))) add(s.replace(/^["“']|["”']$/g, ''), false)
    }
  })
  return [...map.values()].sort((a, b) => (b.from.length - a.from.length) || (Number(b.heading) - Number(a.heading)))
}

/* Bible references */
type BookRow = [string, string[], string[]] | [string, string[], string[], number]
const BOOKS: BookRow[] = [
  ['Genesis', ['Genesis'], ['Gen']], ['Exodus', ['Exodus'], ['Exod', 'Ex']], ['Leviticus', ['Leviticus'], ['Lev']], ['Numbers', [], ['Numbers', 'Num']], ['Deuteronomy', ['Deuteronomy'], ['Deut', 'Dt']],
  ['Joshua', [], ['Joshua', 'Josh']], ['Judges', [], ['Judges', 'Judg']], ['Ruth', [], ['Ruth']], ['Samuel', [], ['Samuel', 'Sam'], 1], ['Kings', [], ['Kings', 'Kgs'], 1], ['Chronicles', ['Chronicles'], ['Chron', 'Chr'], 1],
  ['Ezra', [], ['Ezra']], ['Nehemiah', ['Nehemiah'], ['Neh']], ['Esther', [], ['Esther', 'Esth']], ['Job', [], ['Job']], ['Psalms', ['Psalms', 'Psalm'], ['Psa', 'Ps']], ['Proverbs', ['Proverbs'], ['Prov', 'Pr']],
  ['Ecclesiastes', ['Ecclesiastes'], ['Eccl', 'Ecc']], ['Song of Songs', ['Song of Songs', 'Song of Solomon'], []], ['Isaiah', ['Isaiah'], ['Isa']], ['Jeremiah', ['Jeremiah'], ['Jer']], ['Lamentations', ['Lamentations'], ['Lam']],
  ['Ezekiel', ['Ezekiel'], ['Ezek']], ['Daniel', [], ['Daniel', 'Dan']], ['Hosea', [], ['Hosea', 'Hos']], ['Joel', [], ['Joel']], ['Amos', [], ['Amos']], ['Obadiah', [], ['Obadiah', 'Obad']], ['Jonah', [], ['Jonah']],
  ['Micah', [], ['Micah', 'Mic']], ['Nahum', [], ['Nahum']], ['Habakkuk', ['Habakkuk'], ['Hab']], ['Zephaniah', ['Zephaniah'], ['Zeph']], ['Haggai', ['Haggai'], ['Hag']], ['Zechariah', ['Zechariah'], ['Zech']], ['Malachi', ['Malachi'], ['Mal']],
  ['Matthew', [], ['Matthew', 'Matt', 'Mt']], ['Mark', [], ['Mark', 'Mk']], ['Luke', [], ['Luke', 'Lk']], ['John', [], ['John', 'Jn'], 1], ['Acts', [], ['Acts']], ['Romans', ['Romans'], ['Rom']], ['Corinthians', ['Corinthians'], ['Cor'], 1],
  ['Galatians', ['Galatians'], ['Gal']], ['Ephesians', ['Ephesians'], ['Eph']], ['Philippians', ['Philippians'], ['Phil']], ['Colossians', ['Colossians'], ['Col']], ['Thessalonians', ['Thessalonians'], ['Thess'], 1],
  ['Timothy', [], ['Timothy', 'Tim'], 1], ['Titus', [], ['Titus']], ['Philemon', [], ['Philemon', 'Philem']], ['Hebrews', ['Hebrews'], ['Heb']], ['James', [], ['James', 'Jas']], ['Peter', [], ['Peter', 'Pet'], 1], ['Jude', [], ['Jude']], ['Revelation', ['Revelation'], ['Rev']]
]
const BOOK_OF = new Map<string, [string, number | undefined]>(); const FREE = new Set<string>()
for (const [canon, free, abbr, numbered] of BOOKS) { for (const f of free) { BOOK_OF.set(f, [canon, numbered]); FREE.add(f) } for (const a of abbr) BOOK_OF.set(a, [canon, numbered]) }
const bookAlt = [...BOOK_OF.keys()].sort((a, b) => b.length - a.length).map(s => s.replace(/ /g, '\\s+')).join('|')
const REF_RE = new RegExp('(?:\\b([123]|I{1,3}|First|Second|Third)\\s+)?\\b(' + bookAlt + ')\\.?\\s+(\\d{1,3})(?:\\s*:\\s*(\\d{1,3})(?:\\s*[-–]\\s*(\\d{1,3}))?)?\\b', 'g')
const BOOKNAME_RE = new RegExp('\\b(?:([123])\\s+)?(' + [...FREE].sort((a, b) => b.length - a.length).map(s => s.replace(/ /g, '\\s+')).join('|') + ')\\b', 'g')
const NUMWORD: Record<string, number> = { I: 1, II: 2, III: 3, First: 1, Second: 2, Third: 3, 1: 1, 2: 2, 3: 3 }
export function bibleRefs(text: string): { refs: string[]; books: Set<string> } {
  const refs: string[] = [], books = new Set<string>(); let m: RegExpExecArray | null; REF_RE.lastIndex = 0
  while ((m = REF_RE.exec(text))) {
    const name = m[2].replace(/\s+/g, ' '); const info = BOOK_OF.get(name); if (!info) continue
    const [canon, numbered] = info; const num = numbered && m[1] ? NUMWORD[m[1]] : null
    const ch = +m[3], v = m[4], v2 = m[5]
    if (!v && !(FREE.has(name) || num)) continue
    if (ch > 150) continue
    const bk = (num ? num + ' ' : '') + (canon === 'Psalms' ? 'Psalm' : canon)
    refs.push(bk + ' ' + ch + (v ? ':' + v : '') + (v2 ? '–' + v2 : ''))
    books.add((num ? num + ' ' : '') + canon)
  }
  BOOKNAME_RE.lastIndex = 0
  while ((m = BOOKNAME_RE.exec(text))) { const info = BOOK_OF.get(m[2].replace(/\s+/g, ' ')); if (info) books.add((info[1] && m[1] ? m[1] + ' ' : '') + info[0]) }
  return { refs, books }
}
export function hostOf(u: string): string { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return '' } }
export function normUrl(u: unknown): string { try { const x = new URL(String(u).trim()); return (x.hostname.replace(/^www\./, '') + x.pathname.replace(/\/+$/, '')).toLowerCase() } catch { return String(u || '').trim().toLowerCase() } }
export function hashId(s: string): string { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36) }

/* scoring */
export const TIER_W: Record<string, number> = { high: 3, medium: 2, low: 1 }
export function scoreAgainst(src: Source | null | undefined, terms: Term[]): { score: number; used: Set<string | undefined> } {
  let tot = 0, got = 0; const used = new Set<string | undefined>()
  for (const t of terms) { const w = TIER_W[t.tier as string] || 1; tot += w; if (src && ([t.key, ...(t.altKeys || [])].some(k => countIn(src, k) > 0) || rootMatchTerm(src, t))) { got += w; used.add(t.key) } }
  return { score: tot ? Math.round(100 * got / tot) : 0, used }
}
export function letterGrade(score: number, target?: number): string {
  const r = score / Math.max(35, target || 0)
  const cut: [number, string][] = [[1, 'A+'], [.93, 'A'], [.86, 'A-'], [.79, 'B+'], [.72, 'B'], [.65, 'B-'], [.58, 'C+'], [.5, 'C'], [.42, 'C-'], [.32, 'D']]
  for (const [c, g] of cut) if (r >= c) return g
  return 'F'
}
