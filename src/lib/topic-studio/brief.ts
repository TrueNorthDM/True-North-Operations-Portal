/**
 * The SEO brief of a topic (phase 1, 5 November 2026): the research of every tab
 * compiled into the brief template, as HTML (to paste into the writer's Google
 * Doc), as Markdown, as a plain term list and as a CSV of the terms. Pure text
 * builders over an Analysis; the Artifact's wording is kept.
 *
 * Left out until their tabs come (phase 4): the originality section, cited
 * Scripture, linked sources and named authorities. The writer workshop link
 * arrives with the workshop (phase 2).
 */

import type { Analysis } from './analysis'

export const PK_NOTES = [
  'Use this primary keyphrase naturally if you can in the meta title, H1, meta description, and introduction. It does not need to be exact-matched, but use it in context, semantically the terms, for topical clarity.',
  'The meta title and H1 should not be exactly the same, but semantic variations. Both say what the page is about, but are compelling two different actions. The meta title is to get searchers to click. The H1 is to get readers to stay on the page. The meta description should describe the page content as a factual summary, with a clear value proposition (no marketing fluff), and a content type cue, such as checklist, deep dive, commentary, tutorial, comparison guide.',
]
export const ANS_NOTE = 'Create a summary answer near the top of the page that is concise, fact-rich, all together, and direct. It should be 2-5 sentences. It should immediately answer a user’s core question before going into scenarios, subtopics, or discussions.'
export const KEY_NOTE = 'Use some of these high importance terms naturally in the meta description and in the introduction. Use the terms to help tell readers what the page topic is about. It can address the target audience, have a hook, the problem, or context, as well as the promise or expectation of how it can help them.'

const HL = 'border:1px solid rgba(251, 201, 22, 0.2);background-color:rgba(254, 237, 175, 0.5);padding:8px 14px;border-radius:6px;margin:6px 0 12px'

export const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))

const withAlts = (t: { t: string; alts: string[] }) => ({ text: t.t, alts: t.alts })

interface Parts {
  heading: string
  topic: string
  primary: string
  key: { text: string; alts: string[] }[]
  answer: string[]
  direct: string[]
  mindset: string[]
  competitors: string[]
}

function parts(a: Analysis, clientHeading: string): Parts {
  const p = a.project
  const qs = p.questions.filter(q => !q.off)
  return {
    heading: clientHeading,
    topic: p.topic,
    primary: p.primary,
    key: a.keyTerms().map(withAlts),
    answer: p.answerTop,
    direct: qs.filter(q => q.direct).map(q => q.q),
    mindset: qs.filter(q => !q.direct).map(q => q.q),
    // Only web addresses become links: an imported topic could carry anything in its list.
    competitors: a.comps.filter(c => c.src && /^https?:\/\//i.test(c.url)).map(c => c.url),
  }
}

/** Sections other tabs add to the brief (originality, citations), already written as HTML and Markdown. */
export interface BriefExtra { html: string; md: string }

export function briefHtml(a: Analysis, clientHeading: string, extra?: BriefExtra): string {
  const b = parts(a, clientHeading)
  const ul = (items: string[]) => (items.length ? `<ul>${items.map(x => `<li>${x}</li>`).join('')}</ul>` : '<p>None</p>')
  const questions = b.direct.length || b.mindset.length
    ? '<h2>Questions</h2>'
      + (b.direct.length ? `<h3>Questions to answer directly (and have summary answers for)</h3>${ul(b.direct.map(esc))}` : '')
      + (b.mindset.length ? `<h3>Questions that reveal the mindset of the searchers (can answer indirectly)</h3>${ul(b.mindset.map(esc))}` : '')
    : ''
  return [
    `<h2>${esc(b.heading)}: ${esc(b.topic)}</h2>`,
    `<h3>Title, metas, and introduction</h3><div style="${HL}"><b>${esc(b.primary)}</b></div>`,
    ...PK_NOTES.map(t => `<p><i>${esc(t)}</i></p>`),
    b.key.length ? `<h3>Key terms for the meta description and introduction</h3><p><i>${esc(KEY_NOTE)}</i></p><div style="${HL}">${ul(b.key.map(t => esc(t.text) + (t.alts.length ? ` <i>(also: ${esc(t.alts.join(', '))})</i>` : '')))}</div>` : '',
    b.answer.length ? `<h3>Answer near the top</h3><p><i>${esc(ANS_NOTE)}</i></p><div style="${HL}">${ul(b.answer.map(esc))}</div>` : '',
    questions,
    extra?.html ?? '',
    b.competitors.length ? `<h3>Competitors analyzed</h3><ul>${b.competitors.map(u => `<li><a href="${esc(u)}">${esc(u)}</a></li>`).join('')}</ul>` : '',
  ].filter(Boolean).join('\n')
}

export function briefMarkdown(a: Analysis, clientHeading: string, extra?: BriefExtra): string {
  const b = parts(a, clientHeading)
  const li = (items: string[]) => (items.length ? items.map(x => `- ${x}`).join('\n') : '- None')
  const out: string[] = [`# ${b.heading}: ${b.topic}`, '', '## Title, metas, and introduction', `**${b.primary}**`, '']
  for (const t of PK_NOTES) out.push(`_${t}_`, '')
  if (b.key.length) out.push('## Key terms for the meta description and introduction', `_${KEY_NOTE}_`, '', li(b.key.map(t => t.text + (t.alts.length ? ` _(also: ${t.alts.join(', ')})_` : ''))), '')
  if (b.answer.length) out.push('## Answer near the top', `_${ANS_NOTE}_`, '', li(b.answer), '')
  if (b.direct.length || b.mindset.length) out.push('## Questions', '')
  if (b.direct.length) out.push('### Questions to answer directly (and have summary answers for)', li(b.direct), '')
  if (b.mindset.length) out.push('### Questions that reveal the mindset of the searchers (can answer indirectly)', li(b.mindset), '')
  if (extra?.md) out.push(extra.md, '')
  out.push('## Competitors analyzed', ...b.competitors.map(u => `- ${u}`))
  return out.join('\n')
}

/** The term list as bullets, each with the variants that count as the same term. */
export function termListHtml(a: Analysis): string {
  return `<ul>${a.concepts().map(t => `<li>${esc(t.t)}${t.alts.length ? ` <i>(also: ${esc(t.alts.join(', '))})</i>` : ''}</li>`).join('')}</ul>`
}
export function termListText(a: Analysis): string {
  return a.concepts().map(t => `• ${t.t}${t.alts.length ? ` (also: ${t.alts.join(', ')})` : ''}`).join('\n')
}

const csvCell = (v: unknown): string => {
  const s = String(v ?? '')
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Every term with its group, relevance and how competitors use it. */
export function termsCsv(a: Analysis): string {
  const all = a.termObjs()
  const vm = a.variantMap()
  const byKey = new Map(all.map(t => [t.key, t]))
  const group = new Map<string, string>()
  for (const g of a.termGroups()) for (const c of g.items) { group.set(c.key, g.name); for (const k of c.altKeys) group.set(k, g.name) }
  const rows: unknown[][] = [['Order', 'Term', 'Group', 'Same as', 'Relevance', 'Competitors using', 'Typical uses', 'Min', 'Max', 'AI answers using it']]
  all.forEach((t, i) => {
    const s = a.termStats(t.key)
    rows.push([i + 1, t.t, group.get(t.key) ?? '', vm[t.key] ? byKey.get(vm[t.key])?.t ?? '' : '', t.tier, `${s.df}/${a.N}`, s.med, s.min, s.max, s.aiPer.filter(x => x.v > 0).map(x => x.label).join(', ')])
  })
  return rows.map(r => r.map(csvCell).join(',')).join('\n')
}

/** A file name for the downloads: the primary keyphrase (or the topic) as a slug. */
export const slugOf = (primary: string, topic: string): string => (primary || topic || 'topic').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'topic'
