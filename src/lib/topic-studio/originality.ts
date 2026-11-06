/**
 * The Originality tab's data and its part of the SEO brief (phase 4, 6 November
 * 2026): what every competitor says (the commodity map), what only one says,
 * what nobody covers, the SEO's notes on how to stand out, and the interview
 * prompts for a subject-matter expert. Claude fills the first draft; the SEO
 * edits the lists by hand and the brief carries what is there.
 */

import { esc } from './brief'
import { interviewSelected, readCommodity, strs, type AiResults, type Commodity } from './ai/results'

const ul = (items: string[]) => `<ul>${items.map(x => `<li>${x}</li>`).join('')}</ul>`
const withSrc = (p: { point: string; sources?: string[]; source?: string }) => p.point + (p.sources?.length ? ` (${p.sources.join(', ')})` : p.source ? ` (${p.source})` : '')

/** The lists the SEO may change by hand; everything is cut to a safe length and count. */
export interface OriginalityEdit { opps?: unknown; angle?: unknown; interviewManual?: unknown; commodity?: unknown }

export function cleanOriginalityEdit(raw: unknown): Record<string, unknown> {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const out: Record<string, unknown> = {}
  for (const k of ['opps', 'angle', 'interviewManual'] as const) if (k in o) out[k] = strs(o[k], 600, 60)
  if ('commodity' in o) {
    const c = readCommodity(o.commodity)
    if (c) out.commodity = { ...c, edited: true }
  }
  return out
}

export interface OriginalityView {
  commodity: Commodity | null
  opps: string[]
  angle: string[]
  interview: AiResults['interview']
  interviewManual: string[]
  /** The questions that go into the brief. */
  selected: string[]
  /** An opening for the interview prompt: the client's own sentence about original material. */
  clientOrig: string
  /** A faith client: the interview is with a pastor, Bible worker or church member, not a customer expert. */
  faith: boolean
}

export function originalityView(r: AiResults, clientOrig: string, faith = false): OriginalityView {
  return { commodity: r.commodity, opps: r.opps, angle: r.angle, interview: r.interview, interviewManual: r.interviewManual, selected: interviewSelected(r), clientOrig, faith }
}

export function originalityBriefHtml(r: AiResults, interview = true): string {
  const c = r.commodity
  const parts: string[] = []
  if (c && (c.baseline.length || c.unique.length || c.gaps.length)) {
    parts.push('<h3>Originality</h3>')
    if (c.baseline.length) parts.push(`<h4>What everyone already says (do not just repeat it)</h4>${ul(c.baseline.map(p => esc(withSrc(p))))}`)
    if (c.unique.length) parts.push(`<h4>What only one competitor says</h4>${ul(c.unique.map(p => esc(withSrc(p))))}`)
    if (c.gaps.length) parts.push(`<h4>What competitors do not cover</h4>${ul(c.gaps.map(p => esc(p.point + (p.why ? `: ${p.why}` : ''))))}`)
  }
  if (r.opps.length) parts.push(`<h4>Opportunities to add original value</h4>${ul(r.opps.map(esc))}`)
  if (r.angle.length) parts.push(`<h4>Angle to stand out</h4>${ul(r.angle.map(esc))}`)
  const q = interview ? interviewSelected(r) : []
  if (q.length) parts.push(`<h3>Interview prompts for a subject-matter expert</h3>${ul(q.map(esc))}`)
  return parts.join('\n')
}

export function originalityBriefMarkdown(r: AiResults, interview = true): string {
  const c = r.commodity
  const li = (items: string[]) => items.map(x => `- ${x}`).join('\n')
  const out: string[] = []
  if (c && (c.baseline.length || c.unique.length || c.gaps.length)) {
    out.push('## Originality', '')
    if (c.baseline.length) out.push('### What everyone already says (do not just repeat it)', li(c.baseline.map(withSrc)), '')
    if (c.unique.length) out.push('### What only one competitor says', li(c.unique.map(withSrc)), '')
    if (c.gaps.length) out.push('### What competitors do not cover', li(c.gaps.map(p => p.point + (p.why ? `: ${p.why}` : ''))), '')
  }
  if (r.opps.length) out.push('### Opportunities to add original value', li(r.opps), '')
  if (r.angle.length) out.push('### Angle to stand out', li(r.angle), '')
  const q = interview ? interviewSelected(r) : []
  if (q.length) out.push('## Interview prompts for a subject-matter expert', li(q), '')
  return out.join('\n').trim()
}
