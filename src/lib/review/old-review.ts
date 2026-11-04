/**
 * Reads last year's review, the Word file as text (the owner, 4 November 2026):
 * the goals it set for the year under review, and the four Job Description
 * answers. Pure: the text in, what was found out. Nothing found is fine: HR
 * checks every file on the import screen and adds what the reader missed.
 *
 * Headings are found by their words, in any case, with or without a colon:
 * the Job Description questions of the review template, and a goals heading
 * that names the year ("Goals for 2026", "2026 goals", "Goals for next year").
 * A heading is any short line that ends the previous part.
 */

import { JOB_KEYS } from './template'

export interface OldGoal { what: string; byMonth: string | null }
export interface OldReview { goals: OldGoal[]; job: Partial<Record<(typeof JOB_KEYS)[number], string>> }

const JOB_HEADINGS: Record<(typeof JOB_KEYS)[number], RegExp> = {
  job_current: /^current\s+(responsibilities|role)\b/i,
  job_initial: /^initial\s+role\s+expectations?\b/i,
  job_alignment: /^role\s+alignment\b/i,
  job_success: /^success\s+(indicators?|measures?)\b/i,
}
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
const MONTH = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(20\d\d)\b/i

const startsJob = (s: string) => Object.values(JOB_HEADINGS).some(re => re.test(s.split(':')[0].trim()))
const clean = (s: string) => s.replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim()
const isBullet = (s: string) => /^(\d{1,2}[.)]|[-•*–▪◦●])\s+/.test(s)
const unbullet = (s: string) => s.replace(/^(\d{1,2}[.)]|[-•*–▪◦●])\s+/, '').trim()

/** A heading: short, no full stop at the end, not a list item. */
function isHeading(s: string): boolean {
  if (!s || isBullet(s) || s.length > 70) return false
  if (/[.!?]$/.test(s)) return false
  return /:$/.test(s) || s === s.toUpperCase() || s.split(' ').length <= 6
}

/** A section of the template: a line in capitals, a line ending in a colon, or a part the template names. */
const SECTIONS = /^(job description|self[- ]evaluation|self[- ]assessment|feedback|suggestions|manager'?s? (feedback|comments)|comments|signatures?|employee signature|additional comments|company improvements|strengths|accomplishments|challenges|development plan)\b/i
function isSection(s: string): boolean {
  if (isBullet(s)) return false
  const t = s.replace(/:$/, '')
  return /:$/.test(s) || (/[A-Z]/.test(t) && t === t.toUpperCase() && t.length <= 60) || SECTIONS.test(t)
}

/** The goals heading for the year under review: "Goals for 2026", "2026 Goals", "Goals for next year". */
function goalsHeading(s: string, year: number): boolean {
  const t = s.replace(/:$/, '').toLowerCase()
  if (!/\bgoals?\b|\bobjectives?\b/.test(t)) return false
  return t.includes(String(year)) || /\bnext\s+year\b|\bcoming\s+year\b|\bupcoming\b/.test(t)
}

/** "by June 2026", "(Jun 2026)", "June 2026": the first day of that month, or null. */
export function monthIn(s: string): string | null {
  const m = MONTH.exec(s)
  if (!m) return null
  const i = MONTHS.findIndex(x => x.startsWith(m[1].toLowerCase().replace('.', '').slice(0, 3)))
  return i < 0 ? null : `${m[2]}-${String(i + 1).padStart(2, '0')}-01`
}

/** The goal's words without its date: "Clear the backlog (by June 2026)" → "Clear the backlog". */
function goalWords(s: string): string {
  return clean(s.replace(/[(\[]?\s*(by|due|until|deadline:?)?\s*(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s+20\d\d\s*[)\]]?/i, '').replace(/[\s,;:–-]+$/, ''))
}

export function readOldReview(text: string, goalYear: number): OldReview {
  const lines = text.split(/\r?\n/).map(clean)
  const out: OldReview = { goals: [], job: {} }

  // Job Description: each question's heading, its answer until the next heading.
  for (let i = 0; i < lines.length; i++) {
    const head = lines[i].replace(/:$/, '')
    const key = (Object.keys(JOB_HEADINGS) as (typeof JOB_KEYS)[number][]).find(k => JOB_HEADINGS[k].test(head))
    if (!key || out.job[key]) continue
    // The answer can sit on the heading's own line, after a colon.
    const inline = lines[i].includes(':') ? clean(lines[i].slice(lines[i].indexOf(':') + 1)) : ''
    const body: string[] = inline ? [inline] : []
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j]
      if (!l) { if (body.length) body.push(''); continue }
      if ((isHeading(l) && !isBullet(l)) || isSection(l) || startsJob(l)) break
      body.push(l)
    }
    const answer = body.join('\n').replace(/\n{2,}/g, '\n\n').trim()
    if (answer) out.job[key] = answer.slice(0, 20000)
  }

  // Goals: the list under the goals heading for the year, until the next section.
  const at = lines.findIndex(l => goalsHeading(l, goalYear) && isHeading(l))
  if (at >= 0) {
    const block: string[] = []
    for (let j = at + 1; j < lines.length; j++) {
      const l = lines[j]
      if (!l) continue
      if (block.length && isSection(l)) break
      block.push(l)
    }
    // A bulleted list: one goal per item, its next lines ("Measured by…") belong to it.
    // No bullets: one goal per line.
    const items = block.some(isBullet) ? block.filter(isBullet) : block
    for (const l of items) {
      const words = goalWords(unbullet(l))
      if (words.length >= 3 && out.goals.length < 20) out.goals.push({ what: words.slice(0, 500), byMonth: monthIn(l) })
    }
  }
  return out
}
