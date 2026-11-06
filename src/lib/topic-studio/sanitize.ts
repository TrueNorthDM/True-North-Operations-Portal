// Server-side sanitizer for Topic Studio drafts. The browser cleans what it produces, but the server
// never trusts it: any string can arrive. No DOM here: a small strict tokenizer builds a tree of the
// allowed vocabulary (h1-h4 p blockquote ul ol li strong em u br a) and writes it back in canonical form.
// Everything is loops with bounded nesting, so adversarial input stays linear.

export const MAX_DRAFT_CHARS = 400_000

const MAX_DEPTH = 20 // blockquote + ul + ol nesting
const MAX_HREF = 2000

const BLOCKS = new Set(['h1', 'h2', 'h3', 'h4', 'p', 'blockquote', 'ul', 'ol', 'li'])
const INLINE = new Set(['strong', 'em', 'u', 'a'])
const CONTAINERS = new Set(['blockquote', 'ul', 'ol'])
const TEXTUAL = new Set(['h1', 'h2', 'h3', 'h4', 'p', 'li', 'strong', 'em', 'u', 'a'])
const TEXT_BLOCKS = new Set(['h1', 'h2', 'h3', 'h4', 'p'])
const DROP_ALL = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'noscript', 'template', 'svg', 'math', 'canvas', 'video',
  'audio', 'select', 'textarea', 'head', 'title', 'form', 'button', 'input', 'img', 'picture', 'figure',
  'link', 'meta', 'base',
])
const VOID_DROP = new Set(['img', 'input', 'link', 'meta', 'base'])
// Unknown tags that end a line of text, so the words around them do not glue together
const BREAKS = new Set([
  'div', 'section', 'article', 'main', 'header', 'footer', 'aside', 'nav', 'tr', 'table', 'thead', 'tbody',
  'tfoot', 'center', 'dl', 'dt', 'dd', 'address', 'details', 'summary', 'hr',
])
const CELLS = new Set(['td', 'th'])

interface El {
  t: string
  k: Array<El | string>
  h?: string
  imp?: boolean // implicit block made for loose text
  o?: boolean // open tag already written (render time)
}

const isWs = (c: number) => c === 32 || c === 9 || c === 10 || c === 12 || c === 13

function lowerAscii(s: string): string {
  return s.replace(/[A-Z]+/g, (m) => m.toLowerCase())
}

function validCodePoint(v: number): boolean {
  if (!(v > 0) || v > 0x10ffff) return false
  if (v >= 0xd800 && v <= 0xdfff) return false
  if (v < 32 && v !== 9 && v !== 10 && v !== 13) return false
  if (v >= 127 && v <= 159) return false
  return true
}

// A well-formed reference at raw[i] ('&'), returned verbatim, or null
function entityAt(raw: string, i: number): string | null {
  const n = raw.length
  if (raw.charCodeAt(i + 1) === 35) {
    let j = i + 2
    let hex = false
    const x = raw.charCodeAt(j)
    if (x === 120 || x === 88) {
      hex = true
      j++
    }
    const ds = j
    const max = hex ? 6 : 7
    let v = 0
    while (j < n && j - ds < max) {
      const c = raw.charCodeAt(j)
      let d = -1
      if (c >= 48 && c <= 57) d = c - 48
      else if (hex && c >= 97 && c <= 102) d = c - 87
      else if (hex && c >= 65 && c <= 70) d = c - 55
      if (d < 0) break
      v = v * (hex ? 16 : 10) + d
      j++
    }
    if (j === ds || raw.charCodeAt(j) !== 59 || !validCodePoint(v)) return null
    return raw.slice(i, j + 1)
  }
  for (const nm of ['&amp;', '&lt;', '&gt;', '&quot;', '&nbsp;']) {
    if (raw.startsWith(nm, i)) return nm
  }
  return null
}

// Raw text to its safe escaped form. Whitespace runs become one space; every entity written is complete
function escapeText(raw: string): string {
  let out = ''
  let sp = false
  const n = raw.length
  for (let i = 0; i < n; i++) {
    const c = raw.charCodeAt(i)
    if (c === 32 || c === 9 || c === 10 || c === 13) {
      if (!sp) out += ' '
      sp = true
      continue
    }
    if (c === 38) {
      const e = entityAt(raw, i)
      if (e) {
        out += e
        i += e.length - 1
      } else out += '&amp;'
      sp = false
      continue
    }
    if (c === 60) out += '&lt;'
    else if (c === 62) out += '&gt;'
    else if (c === 0xa0) out += '&nbsp;'
    else if (c < 32 || (c >= 127 && c <= 159)) continue
    else if (c >= 0xd800 && c <= 0xdbff) {
      const d = raw.charCodeAt(i + 1)
      if (d >= 0xdc00 && d <= 0xdfff) {
        out += raw[i] + raw[i + 1]
        i++
      } else continue
    } else if (c >= 0xdc00 && c <= 0xdfff) continue
    else out += raw[i]
    sp = false
  }
  return out
}

const REF_NAMES = new Map<string, string>([
  ['amp', '&'], ['lt', '<'], ['gt', '>'], ['quot', '"'], ['apos', "'"], ['nbsp', ' '], ['colon', ':'],
  ['Tab', '\t'], ['NewLine', '\n'], ['lpar', '('], ['rpar', ')'], ['sol', '/'], ['num', '#'],
])

// One pass over character references. Unknown or invalid ones stay literal
function decodeRefs(s: string): string {
  return s.replace(/&(?:#[xX]([0-9a-fA-F]{1,6})|#([0-9]{1,7})|([A-Za-z]{2,8}));/g, (m, hex, dec, name) => {
    if (name) return REF_NAMES.get(name) ?? m
    const v = hex ? parseInt(hex, 16) : parseInt(dec, 10)
    if (!(v > 0) || v > 0x10ffff || (v >= 0xd800 && v <= 0xdfff)) return m
    return String.fromCodePoint(v)
  })
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// The decoded, checked address, or null when the link must go
function cleanHref(raw: string | null): string | null {
  if (raw === null || raw.length > MAX_HREF * 10) return null
  const v = decodeRefs(raw).trim()
  if (!v || v.length > MAX_HREF) return null
  if (/[\s\u0000-\u001f\u007f-\u009f]/.test(v)) return null
  if (!/^(?:https?:\/\/|mailto:)/i.test(v)) return null
  return v
}

interface TagTok {
  name: string
  href: string | null
  end: number
}

// s[i] is '<' followed by a letter. Returns null when the tag never closes (the rest is dropped)
function readTag(s: string, i: number): TagTok | null {
  const n = s.length
  let j = i + 1
  while (j < n) {
    const c = s.charCodeAt(j)
    if (isWs(c) || c === 47 || c === 62) break
    j++
  }
  const name = lowerAscii(s.slice(i + 1, j))
  let href: string | null = null
  for (;;) {
    while (j < n) {
      const c = s.charCodeAt(j)
      if (isWs(c) || c === 47) j++
      else break
    }
    if (j >= n) return null
    if (s.charCodeAt(j) === 62) return { name, href, end: j + 1 }
    const ns = j
    j++
    while (j < n) {
      const c = s.charCodeAt(j)
      if (isWs(c) || c === 61 || c === 47 || c === 62) break
      j++
    }
    const isHref = j - ns === 4 && lowerAscii(s.slice(ns, j)) === 'href'
    while (j < n && isWs(s.charCodeAt(j))) j++
    let value: string | null = null
    if (j < n && s.charCodeAt(j) === 61) {
      j++
      while (j < n && isWs(s.charCodeAt(j))) j++
      if (j >= n) return null
      const q = s.charCodeAt(j)
      if (q === 34 || q === 39) {
        const e = s.indexOf(s[j], j + 1)
        if (e === -1) return null
        value = s.slice(j + 1, e)
        j = e + 1
      } else {
        const vs = j
        while (j < n && !isWs(s.charCodeAt(j)) && s.charCodeAt(j) !== 62) j++
        value = s.slice(vs, j)
      }
    }
    if (isHref && href === null && value !== null) href = value
  }
}

const isLetter = (c: number) => (c >= 65 && c <= 90) || (c >= 97 && c <= 122)

function parse(src: string): El {
  const n = src.length
  const root: El = { t: '', k: [] }
  const stack: El[] = [root]
  const open: Record<string, number> = Object.create(null)
  let depth = 0
  const skipEnd: Record<string, number> = Object.create(null) // end tags owed to dropped inline starts
  let lowerSrc: string | null = null

  const top = () => stack[stack.length - 1]
  const push = (el: El) => {
    top().k.push(el)
    stack.push(el)
    open[el.t] = (open[el.t] || 0) + 1
    if (CONTAINERS.has(el.t)) depth++
  }
  const pop = () => {
    const e = stack.pop() as El
    open[e.t]--
    if (CONTAINERS.has(e.t)) depth--
  }
  const popTo = (tag: string) => {
    while (stack.length > 1) {
      const e = top()
      pop()
      if (e.t === tag) break
    }
  }
  const pushText = (el: El, s: string) => {
    const k = el.k
    const l = k.length
    if (l && typeof k[l - 1] === 'string') k[l - 1] += s
    else k.push(s)
  }
  const closeInline = () => {
    while (INLINE.has(top().t)) pop()
  }
  // Make sure the top of the stack can hold text
  const ensureTextual = () => {
    const t = top().t
    if (TEXTUAL.has(t)) return
    if (t === 'ul' || t === 'ol') push({ t: 'li', k: [], imp: true })
    else push({ t: 'p', k: [], imp: true })
  }
  const addSpace = () => {
    const t = top()
    if (TEXTUAL.has(t.t)) pushText(t, ' ')
  }
  const addText = (raw: string) => {
    const s = escapeText(raw)
    if (!s) return
    if (!TEXTUAL.has(top().t)) {
      if (s === ' ') return
      ensureTextual()
    }
    pushText(top(), s)
  }
  const boundary = () => {
    closeInline()
    const t = top()
    if (TEXT_BLOCKS.has(t.t)) pop()
    else if (t.t === 'li') addSpace()
  }

  const openBlock = (tag: string) => {
    const isList = tag === 'ul' || tag === 'ol'
    if (INLINE.has(top().t)) {
      let k = stack.length - 1
      while (INLINE.has(stack[k].t)) k--
      const ctx = stack[k]
      if (isList && !(ctx.t === 'p' && ctx.imp)) return
      closeInline()
    }
    let t = top()
    if (t.t === 'p' && t.imp) {
      pop()
      t = top()
    }
    if (tag === 'li') {
      if (t.t === 'li') {
        pop()
        t = top()
      }
      if (t.t === 'ul' || t.t === 'ol') push({ t: 'li', k: [] })
      return
    }
    if (isList) {
      if (TEXT_BLOCKS.has(t.t)) return
      if (t.t === 'ul' || t.t === 'ol') {
        push({ t: 'li', k: [], imp: true })
      }
      if (depth >= MAX_DEPTH) return
      push({ t: tag, k: [] })
      return
    }
    // p, h1-h4, blockquote
    if (TEXT_BLOCKS.has(t.t)) {
      pop()
      t = top()
    }
    if (t.t === 'li') {
      addSpace()
      return
    }
    if (t.t === 'ul' || t.t === 'ol') return
    if (tag === 'blockquote' && depth >= MAX_DEPTH) return
    push({ t: tag, k: [] })
  }

  const startTag = (name: string, rawHref: string | null) => {
    if (name === 'br') {
      const t = top()
      if (TEXTUAL.has(t.t)) t.k.push({ t: 'br', k: [] })
      return
    }
    if (INLINE.has(name)) {
      let h: string | undefined
      if (open[name]) {
        skipEnd[name] = (skipEnd[name] || 0) + 1
        return
      }
      if (name === 'a') {
        const c = cleanHref(rawHref)
        if (c === null) {
          skipEnd[name] = (skipEnd[name] || 0) + 1
          return
        }
        h = c
      }
      ensureTextual()
      push({ t: name, k: [], h })
      return
    }
    if (BLOCKS.has(name)) openBlock(name)
    else if (BREAKS.has(name)) boundary()
    else if (CELLS.has(name)) addSpace()
  }

  const endTag = (name: string) => {
    if (INLINE.has(name) && skipEnd[name]) {
      skipEnd[name]--
      return
    }
    if (BLOCKS.has(name) || INLINE.has(name)) {
      if (open[name]) popTo(name)
      else if (name === 'p' || name === 'blockquote' || /^h[1-4]$/.test(name)) addSpace()
    } else if (BREAKS.has(name)) boundary()
    else if (CELLS.has(name)) addSpace()
  }

  // Position after the end tag of a raw-dropped element, or the end of input
  const skipRaw = (name: string, from: number): number => {
    if (lowerSrc === null) lowerSrc = lowerAscii(src)
    const needle = '</' + name
    let p = lowerSrc.indexOf(needle, from)
    while (p !== -1) {
      const c = lowerSrc.charCodeAt(p + needle.length)
      if (Number.isNaN(c) || isWs(c) || c === 62 || c === 47) break
      p = lowerSrc.indexOf(needle, p + 1)
    }
    if (p === -1) return n
    const gt = src.indexOf('>', p)
    return gt === -1 ? n : gt + 1
  }

  let i = 0
  while (i < n) {
    const lt = src.indexOf('<', i)
    if (lt === -1) {
      addText(src.slice(i))
      break
    }
    if (lt > i) addText(src.slice(i, lt))
    i = lt
    const c1 = src.charCodeAt(i + 1)
    if (isLetter(c1)) {
      const tag = readTag(src, i)
      if (!tag) break
      i = tag.end
      if (DROP_ALL.has(tag.name)) {
        if (!VOID_DROP.has(tag.name)) i = skipRaw(tag.name, i)
        continue
      }
      startTag(tag.name, tag.href)
    } else if (c1 === 47 && isLetter(src.charCodeAt(i + 2))) {
      const gt = src.indexOf('>', i + 2)
      if (gt === -1) break
      let j = i + 2
      while (j < gt) {
        const c = src.charCodeAt(j)
        if (isWs(c) || c === 47) break
        j++
      }
      endTag(lowerAscii(src.slice(i + 2, j)))
      i = gt + 1
    } else if (c1 === 33) {
      if (src.startsWith('<!--', i)) {
        const j = i + 4
        if (src.charCodeAt(j) === 62) i = j + 1
        else if (src.startsWith('->', j)) i = j + 2
        else {
          const e = src.indexOf('-->', j)
          i = e === -1 ? n : e + 3
        }
      } else if (src.startsWith('<![CDATA[', i)) {
        const e = src.indexOf(']]>', i + 9)
        i = e === -1 ? n : e + 3
      } else {
        const gt = src.indexOf('>', i + 2)
        i = gt === -1 ? n : gt + 1
      }
    } else if (c1 === 63) {
      const gt = src.indexOf('>', i + 2)
      i = gt === -1 ? n : gt + 1
    } else {
      addText('<')
      i++
    }
  }
  return root
}

// ---- Rendering: a tree back to canonical HTML ----

interface Flow {
  out: string[]
  pend: El[] // inline elements whose open tag waits for the first content
  space: boolean
  brs: number
  start: boolean
  vis: number // visible atoms (and nested lists) written
  emitted: number
}

const newFlow = (): Flow => ({ out: [], pend: [], space: false, brs: 0, start: true, vis: 0, emitted: 0 })

function openTag(e: El): string {
  if (e.t === 'a') return '<a href="' + escapeAttr(e.h as string) + '" target="_blank" rel="noopener">'
  return '<' + e.t + '>'
}

function atomValue(atom: string): string {
  const m = /^&(?:#[xX]([0-9a-fA-F]+)|#([0-9]+)|(amp|lt|gt|quot|nbsp));$/.exec(atom)
  if (!m) return atom
  if (m[3]) return REF_NAMES.get(m[3]) as string
  return String.fromCodePoint(m[1] ? parseInt(m[1], 16) : parseInt(m[2], 10))
}

function emit(st: Flow, atom: string, visible: boolean) {
  if (st.brs) {
    for (let b = 0; b < st.brs; b++) st.out.push('<br>')
    st.brs = 0
  } else if (st.space) st.out.push(' ')
  st.space = false
  if (st.pend.length) {
    for (const e of st.pend) {
      st.out.push(openTag(e))
      e.o = true
    }
    st.pend.length = 0
  }
  st.out.push(atom)
  st.start = false
  st.emitted++
  if (visible) st.vis++
}

function flowText(s: string, st: Flow) {
  const n = s.length
  let i = 0
  while (i < n) {
    const code = s.charCodeAt(i)
    if (code === 32) {
      if (!st.start && !st.brs) st.space = true
      i++
      continue
    }
    if (code === 38) {
      const e = s.indexOf(';', i)
      const atom = s.slice(i, e + 1)
      i = e + 1
      emit(st, atom, atomValue(atom).trim() !== '')
      continue
    }
    let len = 1
    if (code >= 0xd800 && code <= 0xdbff) len = 2
    const atom = s.slice(i, i + len)
    i += len
    const visible = code > 32 && code < 127 ? true : atom.trim() !== ''
    emit(st, atom, visible)
  }
}

function flow(kids: Array<El | string>, st: Flow) {
  for (const c of kids) {
    if (typeof c === 'string') {
      flowText(c, st)
    } else if (c.t === 'br') {
      if (!st.start) {
        st.brs++
        st.space = false
      }
    } else if (c.t === 'ul' || c.t === 'ol') {
      const s = renderList(c)
      if (s) {
        st.out.push(s)
        st.space = false
        st.brs = 0
        st.start = true
        st.vis++
        st.emitted++
      }
    } else {
      st.pend.push(c)
      flow(c.k, st)
      if (c.o) st.out.push('</' + c.t + '>')
      else st.pend.pop()
    }
  }
}

function renderTextBlock(el: El): string {
  const st = newFlow()
  flow(el.k, st)
  if (!st.vis) return ''
  return '<' + el.t + '>' + st.out.join('') + '</' + el.t + '>'
}

function renderList(el: El): string {
  let inner = ''
  for (const c of el.k) {
    if (typeof c !== 'string' && c.t === 'li') inner += renderTextBlock(c)
  }
  return inner ? '<' + el.t + '>' + inner + '</' + el.t + '>' : ''
}

function renderContainer(kids: Array<El | string>): string {
  let out = ''
  for (const c of kids) {
    if (typeof c === 'string') continue
    if (TEXT_BLOCKS.has(c.t)) out += renderTextBlock(c)
    else if (c.t === 'ul' || c.t === 'ol') out += renderList(c)
    else if (c.t === 'blockquote') {
      const inner = renderContainer(c.k)
      if (inner) out += '<blockquote>' + inner + '</blockquote>'
    }
  }
  return out
}

function run(src: string): string {
  return renderContainer(parse(src).k)
}

export function sanitizeDraftHtml(html: unknown): string {
  if (typeof html !== 'string') return ''
  let len = Math.min(html.length, MAX_DRAFT_CHARS)
  for (;;) {
    const out = run(len === html.length ? html : html.slice(0, len))
    if (out.length <= MAX_DRAFT_CHARS) return out
    // Escaping can grow the text: shrink the input until the result fits, so a second pass changes nothing
    len = Math.max(0, Math.min(len - 1, Math.floor((len * MAX_DRAFT_CHARS * 0.999) / out.length)))
  }
}

// ---- Reading sanitized drafts ----

function decodeText(s: string): string {
  return s.replace(/&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|(amp|lt|gt|quot|apos|nbsp));/g, (m, dec, hex, name) => {
    if (name) return REF_NAMES.get(name) as string
    const v = hex ? parseInt(hex, 16) : parseInt(dec, 10)
    if (!(v > 0) || v > 0x10ffff || (v >= 0xd800 && v <= 0xdfff)) return m
    return String.fromCodePoint(v)
  })
}

const BREAK_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'p', 'blockquote', 'ul', 'ol', 'li', 'br'])

// The visible text of sanitized HTML, one space where a block or line break ends
export function draftText(html: string): string {
  let out = ''
  const n = html.length
  let i = 0
  while (i < n) {
    const lt = html.indexOf('<', i)
    if (lt === -1) {
      out += html.slice(i)
      break
    }
    out += html.slice(i, lt)
    const gt = html.indexOf('>', lt + 1)
    if (gt === -1) break
    let j = lt + 1
    if (html[j] === '/') j++
    let e = j
    while (e < gt && /[A-Za-z0-9]/.test(html[e])) e++
    if (BREAK_TAGS.has(lowerAscii(html.slice(j, e)))) out += ' '
    i = gt + 1
  }
  return decodeText(out).replace(/\s+/g, ' ').trim()
}

export function draftWords(html: string): number {
  const m = draftText(html).match(/[A-Za-z0-9À-ɏ]+(?:['’][A-Za-z]+)?/g)
  return m ? m.length : 0
}
