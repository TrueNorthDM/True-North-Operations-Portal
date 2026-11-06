/**
 * Where a pasted capture goes (phase 1, 5 November 2026): what the server
 * accepts from the browser's capture, and which competitor row it belongs to.
 * Pure; the capture action calls it and saves the answer.
 *
 * The browser sends { url, title, desc, blocks, links } read from the clipboard
 * (capture.ts). Nothing in it is trusted: tags are limited to the ones the
 * capture produces, text is cut to a sane length, and only web addresses are
 * kept as links.
 */

import { hashId, hostOf, normUrl } from './engine'
import type { Block } from './engine'
import { compList } from './analysis'
import type { Project, TopicPage } from './project'

export const MAX_BLOCKS = 2500
export const MAX_LINKS = 300
export const MAX_ORGANIC = 10
const TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'blockquote', 'dd', 'dt', 'td', 'th', 'figcaption', 'pre'])

export interface CleanCapture {
  url: string
  title: string
  desc: string
  blocks: Block[]
  links: [string, string][]
  /** How it came in: the button (2), a formatted paste, or plain text. */
  method: 'button' | 'paste' | 'text'
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')
const web = (u: string): boolean => /^https?:\/\/[^\s]+$/i.test(u)

/** The capture as the server will keep it, or the sentence to show when there is nothing in it. */
export function cleanCapture(raw: unknown, html: boolean): CleanCapture | string {
  if (!isObj(raw) || !Array.isArray(raw.blocks)) return 'Nothing to capture in that paste. Copy the article text or use the capture button.'
  const blocks: Block[] = []
  for (const b of raw.blocks) {
    if (!Array.isArray(b) || typeof b[0] !== 'string' || typeof b[1] !== 'string') continue
    const tag = b[0].toLowerCase()
    const text = str(b[1], 6000)
    if (!TAGS.has(tag) || !text) continue
    blocks.push([tag, text])
    if (blocks.length >= MAX_BLOCKS) break
  }
  if (!blocks.length) return 'Nothing to capture in that paste. Copy the article text or use the capture button.'
  const links: [string, string][] = []
  const seen = new Set<string>()
  for (const l of Array.isArray(raw.links) ? raw.links : []) {
    if (!Array.isArray(l) || typeof l[0] !== 'string') continue
    const u = l[0].trim().slice(0, 2000)
    if (!web(u) || seen.has(u)) continue
    seen.add(u)
    links.push([u, str(l[1], 140)])
    if (links.length >= MAX_LINKS) break
  }
  const url = str(raw.url, 2000)
  return {
    url: web(url) ? url : '',
    title: str(raw.title, 500),
    desc: str(raw.desc, 1000),
    blocks,
    links,
    method: raw._hfa === 2 ? 'button' : html ? 'paste' : 'text',
  }
}

export interface Placement {
  /** The competitor's address and the id the page is stored under. */
  url: string
  artifactId: string
  label: string
  /** Changes to the topic that come with it (a new address in the list). */
  patch: Record<string, unknown> | null
  /** What to tell the person besides "saved". */
  notes: string[]
}

/**
 * The row a capture fills. `target` is the row's position in the competitor list,
 * or 'any' (the paste box that matches by address). A capture that carries its
 * own address goes to that competitor, whatever box it was pasted in; one from an
 * address not in the list is added to the list; one without an address fills the
 * next competitor with nothing captured.
 */
export function placeCapture(p: Project, pages: readonly TopicPage[], cap: CleanCapture, target: number | 'any'): Placement | string {
  const comps = compList(p, pages)
  let row = target === 'any' ? null : comps[target] ?? null
  const notes: string[] = []
  let patch: Record<string, unknown> | null = null

  if (cap.url) {
    const match = comps.find(c => c.n === normUrl(cap.url))
    if (match && match !== row) {
      if (row) notes.push(`That capture is from ${match.label}, so it was saved there.`)
      row = match
    }
  }
  if (!row && cap.url) {
    const organic = [...p.organic]
    let slot = organic.findIndex(u => !u)
    if (slot < 0 && organic.length < MAX_ORGANIC) slot = organic.length
    if (slot >= 0) {
      organic[slot] = cap.url
      patch = { organic }
      const found = compList({ ...p, organic }, pages).find(c => c.n === normUrl(cap.url))
      if (found) { row = found; notes.push(`Added ${hostOf(cap.url)} to your competitor list.`) }
    }
  }
  if (!row) row = comps.find(c => !c.page) ?? null
  if (!row) return 'All competitors are captured. Remove one first, or add its address in Setup.'
  return { url: row.url, artifactId: `c${hashId(row.n)}`, label: row.label, patch, notes }
}

/** The page's own data as ts_save_page stores it. */
export function pagePayload(placement: Placement, cap: CleanCapture): Record<string, unknown> {
  return {
    artifact_id: placement.artifactId,
    kind: 'competitor',
    url: placement.url,
    title: cap.title,
    captured_at: new Date().toISOString(),
    data: { desc: cap.desc, blocks: cap.blocks, links: cap.links, method: cap.method },
  }
}
