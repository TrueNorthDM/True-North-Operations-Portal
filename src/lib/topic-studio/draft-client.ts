// Browser-side draft editor helpers (ported from the Artifact prototype).
// They use document, DOMParser and NodeFilter, so this module only runs in the browser and in vitest's jsdom.

const D_BLOCK: Record<string, string> = { h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h4', h5: 'h4', h6: 'h4', p: 'p', blockquote: 'blockquote', ul: 'ul', ol: 'ol', li: 'li', pre: 'p' }
const D_SKIP = new Set(['script', 'style', 'meta', 'link', 'title', 'head', 'iframe', 'object', 'embed', 'svg', 'canvas', 'video', 'audio', 'noscript', 'template', 'form', 'input', 'button', 'select', 'textarea', 'img', 'picture', 'figure'])
const D_BREAKS = new Set(['div', 'section', 'article', 'main', 'header', 'footer', 'aside', 'nav', 'tr', 'table', 'thead', 'tbody', 'tfoot', 'center', 'dl', 'dt', 'dd', 'address', 'details', 'summary', 'hr'])
const D_INLINEONLY = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'LI'])

type Fmt = { b?: boolean, i?: boolean, u?: boolean, a?: string }

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

export function safeHref(h: unknown): string {
  const s = String(h || '').trim()
  return /^(https?:\/\/|mailto:)/i.test(s) ? s : ''
}

function styleFlags(el: Element) {
  const s = (el.getAttribute && el.getAttribute('style') || '').toLowerCase()
  const fw = /font-weight\s*:\s*([^;]+)/.exec(s)
  const fs = /font-style\s*:\s*([^;]+)/.exec(s)
  const td = /text-decoration[^:]*:\s*([^;]+)/.exec(s)
  const w = fw ? fw[1].trim() : ''
  return { bold: /^(bold|bolder|[6-9]00)$/.test(w), unbold: /^(normal|lighter|[1-5]00)$/.test(w), italic: /italic|oblique/.test(fs ? fs[1] : ''), underline: /underline/.test(td ? td[1] : '') }
}

/* Rebuilds any HTML (pasted or typed) into a small safe set: headings 1-4, paragraphs, quotes, lists,
   bold, italic, underline and links. Everything else, including scripts and styles, is dropped. */
export function cleanDraftHtml(html: string): string {
  const src = new DOMParser().parseFromString('<body>' + String(html || '') + '</body>', 'text/html').body
  const doc = document.implementation.createHTMLDocument('')
  const root = doc.body
  const mk = (t: string) => doc.createElement(t)
  // the prototype's private "_p" field (current paragraph of a container)
  const curP = new WeakMap<Element, HTMLElement | null>()
  const isList = (c: Element) => c.tagName === 'UL' || c.tagName === 'OL'
  const pOf = (c: Element): Element => {
    if (D_INLINEONLY.has(c.tagName)) return c
    let p = curP.get(c)
    if (!p || p.parentNode !== c || c.lastChild !== p) { p = mk('p'); c.appendChild(p); curP.set(c, p) }
    return p
  }
  const addText = (text: string, c: Element, fmt: Fmt) => {
    const t = String(text).replace(/[\s ]+/g, ' ')
    if (!t) return
    if (!t.trim()) {
      const cp = curP.get(c)
      const tgt = D_INLINEONLY.has(c.tagName) ? c : (cp && cp.parentNode === c && c.lastChild === cp ? cp : null)
      if (!tgt || !tgt.lastChild) return
      tgt.appendChild(doc.createTextNode(' '))
      return
    }
    const target = pOf(c)
    let node: Node = doc.createTextNode(t)
    const wrap = (tag: string, n: Node) => { const e = mk(tag); e.appendChild(n); return e }
    if (fmt.u) node = wrap('u', node)
    if (fmt.i) node = wrap('em', node)
    if (fmt.b && !/^H[1-4]$/.test(target.tagName)) node = wrap('strong', node)
    if (fmt.a) {
      const a = mk('a')
      a.setAttribute('href', fmt.a)
      a.setAttribute('target', '_blank')
      a.setAttribute('rel', 'noopener')
      a.appendChild(node)
      node = a
    }
    target.appendChild(node)
  }
  const kids = (node: Node, c: Element, fmt: Fmt) => { for (const k of Array.from(node.childNodes)) walk(k, c, fmt) }
  function walk(node: Node, c: Element, fmt: Fmt): void {
    if (node.nodeType === 3) {
      const v = node.nodeValue || ''
      if (isList(c)) {
        if (!v.trim()) return
        const li = mk('li')
        c.appendChild(li)
        addText(v, li, fmt)
        return
      }
      addText(v, c, fmt)
      return
    }
    if (node.nodeType !== 1) return
    const el = node as Element
    const tag = el.tagName.toLowerCase()
    if (D_SKIP.has(tag)) return
    if (isList(c) && tag !== 'li') {
      const li = mk('li')
      c.appendChild(li)
      walk(el, li, fmt)
      return
    }
    if (tag === 'br') { pOf(c).appendChild(mk('br')); return }
    const bm = D_BLOCK[tag]
    if (bm === 'ul' || bm === 'ol') {
      if (D_INLINEONLY.has(c.tagName) && c.tagName !== 'LI') { kids(el, c, fmt); return }
      const list = mk(bm)
      c.appendChild(list)
      curP.set(c, null)
      kids(el, list, fmt)
      return
    }
    if (bm === 'li') {
      let list: Element = c
      if (!isList(c)) {
        if (D_INLINEONLY.has(c.tagName)) { kids(el, c, fmt); return }
        const last = c.lastElementChild
        if (last && last.tagName === 'UL') list = last
        else {
          const u = mk('ul')
          c.appendChild(u)
          curP.set(c, null)
          list = u
        }
      }
      const li = mk('li')
      list.appendChild(li)
      kids(el, li, fmt)
      return
    }
    if (bm) {
      if (D_INLINEONLY.has(c.tagName)) {
        if (c.lastChild) c.appendChild(doc.createTextNode(' '))
        kids(el, c, fmt)
        return
      }
      if (bm === 'blockquote' && c.tagName === 'BLOCKQUOTE') { curP.set(c, null); kids(el, c, fmt); return }
      const b = mk(bm)
      c.appendChild(b)
      curP.set(c, null)
      kids(el, b, fmt)
      return
    }
    if (D_BREAKS.has(tag)) {
      if (tag === 'hr') return
      if (D_INLINEONLY.has(c.tagName)) {
        if (c.lastChild) c.appendChild(doc.createTextNode(' '))
        kids(el, c, fmt)
        return
      }
      curP.set(c, null)
      kids(el, c, fmt)
      curP.set(c, null)
      return
    }
    const f: Fmt = Object.assign({}, fmt)
    const sf = styleFlags(el)
    if (tag === 'strong' || tag === 'b') f.b = !sf.unbold
    else if (tag === 'em' || tag === 'i') f.i = true
    else if (tag === 'u') f.u = true
    else if (tag === 'a') {
      const hr = safeHref(el.getAttribute('href'))
      if (hr) f.a = hr
    }
    if (sf.bold) f.b = true
    else if (sf.unbold) f.b = false
    if (sf.italic) f.i = true
    if (sf.underline) f.u = true
    kids(el, c, f)
    if (tag === 'td' || tag === 'th') addText(' ', c, fmt)
  }
  for (const k of Array.from(src.childNodes)) walk(k, root, {})
  const tw = (d: Node) => {
    const w = doc.createTreeWalker(d, NodeFilter.SHOW_TEXT)
    const a: Text[] = []
    while (w.nextNode()) a.push(w.currentNode as Text)
    return a
  }
  root.querySelectorAll('p,h1,h2,h3,h4,li').forEach((b) => {
    while (b.firstChild && b.firstChild.nodeName === 'BR') b.removeChild(b.firstChild)
    let l = b.lastChild
    while (l && (l.nodeName === 'BR' || (l.nodeType === 3 && !(l.nodeValue || '').trim()))) { b.removeChild(l); l = b.lastChild }
    const t = tw(b)
    if (t.length) {
      t[0].nodeValue = (t[0].nodeValue || '').replace(/^\s+/, '')
      const z = t[t.length - 1]
      z.nodeValue = (z.nodeValue || '').replace(/\s+$/, '')
    }
  })
  Array.from(root.querySelectorAll('p,h1,h2,h3,h4,li,blockquote,ul,ol')).reverse().forEach((e) => { if (!(e.textContent || '').trim()) e.remove() })
  const mergeAdj = (parent: Element) => {
    let n: ChildNode | null = parent.firstChild
    while (n) {
      const nx: ChildNode | null = n.nextSibling
      if (n.nodeType === 1 && nx && nx.nodeType === 1) {
        const a = n as Element
        const b = nx as Element
        if (a.tagName === b.tagName && ['STRONG', 'EM', 'U', 'A'].includes(a.tagName) && (a.tagName !== 'A' || a.getAttribute('href') === b.getAttribute('href'))) {
          while (b.firstChild) a.appendChild(b.firstChild)
          parent.removeChild(b)
          continue
        }
      }
      n = nx
    }
    parent.normalize()
    for (const c of Array.from(parent.children)) mergeAdj(c)
  }
  mergeAdj(root)
  return root.innerHTML
}

export function plainToHtml(text: string): string {
  return String(text || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean).map((s) => '<p>' + esc(s) + '</p>').join('')
}

export function htmlToText(html: string): string {
  return new DOMParser().parseFromString('<body>' + String(html || '') + '</body>', 'text/html').body.textContent || ''
}

function draftBlocksFromEl(el: Element): [string, string][] {
  const blocks: [string, string][] = []
  const walk = (node: Node) => {
    for (const n of Array.from(node.childNodes)) {
      if (n.nodeType === 3) {
        const t = (n.textContent || '').replace(/\s+/g, ' ').trim()
        if (t) blocks.push(['p', t])
        continue
      }
      if (n.nodeType !== 1) continue
      const e = n as Element
      const tag = e.tagName.toLowerCase()
      if (/^(h[1-6]|p|li|blockquote|pre)$/.test(tag) && !e.querySelector('p,li,h1,h2,h3,h4,h5,h6')) {
        const t = (e.textContent || '').replace(/\s+/g, ' ').trim()
        if (t) blocks.push([tag, t])
      } else walk(e)
    }
  }
  walk(el)
  return blocks
}

export function draftBlocksFromHtml(html: string): [string, string][] {
  const body = new DOMParser().parseFromString('<body>' + cleanDraftHtml(html) + '</body>', 'text/html').body
  return draftBlocksFromEl(body)
}
