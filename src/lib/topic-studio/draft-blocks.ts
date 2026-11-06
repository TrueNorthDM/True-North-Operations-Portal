/**
 * A draft's blocks on the server (Topic Studio phase 3, 6 November 2026): the
 * same [tag, text] list the browser reads with a DOM (draft-client.ts), taken
 * from the draft's sanitized HTML with no DOM at all. Claude's draft review and
 * placement ideas read the draft on the server, where only the sanitizer's own
 * small vocabulary can appear (h1 to h4, p, blockquote, ul, ol, li, strong, em,
 * u, a, br), so a plain scan is enough and cannot be fooled by anything else.
 *
 * Blocks are headings (h1 to h4), paragraphs (p, also inside a quote) and list
 * items (li), text with its inline formatting dropped and spaces collapsed.
 */

import type { Block } from './engine'

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,6});/gi, (m, e: string) => {
    if (e[0] === '#') {
      const cp = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff) ? String.fromCodePoint(cp) : ''
    }
    return NAMED[e.toLowerCase()] ?? m
  })
}

const TOKEN = /<(\/?)([a-z0-9]+)(?:\s[^>]*)?>|([^<]+)/gi
const BLOCK = /^(h[1-4]|p|li)$/

export function draftBlocks(html: string): Block[] {
  const out: Block[] = []
  let cur: { tag: string; text: string } | null = null
  const flush = () => {
    if (cur) {
      const t = cur.text.replace(/\s+/g, ' ').trim()
      if (t) out.push([cur.tag, t])
      cur = null
    }
  }
  let m: RegExpExecArray | null
  const re = new RegExp(TOKEN.source, 'gi')
  while ((m = re.exec(html))) {
    if (m[3] !== undefined) { if (cur) cur.text += decode(m[3]); continue }
    const close = m[1] === '/'
    const tag = m[2].toLowerCase()
    if (BLOCK.test(tag)) { flush(); if (!close) cur = { tag, text: '' } }
    else if (tag === 'br') { if (cur) cur.text += ' ' }
    else if (tag === 'blockquote' || tag === 'ul' || tag === 'ol') flush()
  }
  flush()
  return out
}
