'use client'

/**
 * The panels beside the draft (Topic Studio writer workshop, phase 2): how the
 * draft covers the topic, its length and reading level, the terms still to
 * consider and the ones already used, a check for overused words, and a place to
 * tell the SEO team what the term list got right or wrong. Guidance in words, no
 * grades and no targets from competitors (the SEO team's decision). Claude's
 * review and placement suggestions sit in the same column (phase 3).
 */

import { useState } from 'react'
import { BTN } from '@/lib/ui/buttons'
import { TEXTAREA } from '@/components/clocky/entries/ui'
import { CARD, FIELD_LABEL } from '@/lib/ui/type'
import type { Block } from '@/lib/topic-studio/engine'
import { FEEDBACK_WRITER, overuseCheck, type DraftReport, type Overuse, type Tone, type WorkshopModel, type WorkshopTerm } from '@/lib/topic-studio/workshop'
import type { AiResults } from '@/lib/topic-studio/ai/results'
import { sendTermFeedback } from '../actions'
import { AiBtn, NO_AI, type AiInfo } from './AiBtn'
import { PlacementsResult, ReviewResult } from './AiResults'
import { useTopicCall } from './use-topic-call'

const NO_RESULTS: Pick<AiResults, 'review' | 'placements'> = { review: null, placements: null }

const n = (v: number) => v.toLocaleString('en-US')
const TONE: Record<Tone, string> = { good: 'text-[var(--ok-fg)]', ok: 'text-[var(--ok-fg)]', neutral: 'text-foreground', warn: 'text-[var(--warn-fg)]', poor: 'text-[#c8323d]' }

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className={`${CARD} p-4`}>
    <h4 className={`${FIELD_LABEL} mb-2`}>{title}</h4>
    {children}
  </section>
)
const Hint = ({ children }: { children: React.ReactNode }) => <p className="m-0 mt-2 text-[12px] leading-snug text-muted">{children}</p>
const Kv = ({ k, v }: { k: string; v: string }) => <div className="flex justify-between gap-3 py-0.5 text-[13px]"><span>{k}</span><b className="tabular-nums text-tn-ink">{v}</b></div>

const MARK = { ok: ['text-tn-green', '✓'], part: ['text-[var(--warn-fg)]', '◐'], no: ['text-[#c8323d]', '✕'] } as const

function Chip({ t, missing, onClick }: { t: WorkshopTerm; missing: boolean; onClick: () => void }) {
  // A high-importance term that is still missing wears an orange edge, as the Artifact draws it.
  const edge = missing ? (t.tier === 'high' ? 'border-[#e8850c] bg-[var(--warn-bg)]' : 'border-[var(--warn-border)] bg-[var(--warn-bg)]') : 'border-[var(--panel-border)] bg-tn-teal-soft'
  return (
    <button type="button" onClick={onClick} title={`${t.tier} relevance${t.alts.length ? ` · also counts: ${t.alts.join(', ')}` : ''}`}
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[12.5px] text-tn-ink transition-colors hover:border-tn-teal ${edge}`}>{t.t}</button>
  )
}

export function WriterPanels({ id, model, report, blocks, html, onTerm, ai = NO_AI, results = NO_RESULTS }: {
  id: string
  model: WorkshopModel
  report: DraftReport | null
  /** The draft's blocks, for the overuse check. */
  blocks: Block[]
  /** The draft's HTML, to tell when an overuse check is out of date. */
  html: string
  onTerm: (t: { key: string; label: string }) => void
  ai?: AiInfo
  /** What Claude left on the topic: the last review and placement suggestions. */
  results?: Pick<AiResults, 'review' | 'placements'>
}) {
  const { call, busy, toast } = useTopicCall()
  const [grouped, setGrouped] = useState<boolean>(FEEDBACK_WRITER.terms.grouped)
  const [over, setOver] = useState<{ result: Overuse; html: string } | null>(null)
  const [rating, setRating] = useState<'good' | 'problems' | null>(null)
  const [note, setNote] = useState('')

  const cv = FEEDBACK_WRITER.coverage
  const ln = FEEDBACK_WRITER.length
  const rd = FEEDBACK_WRITER.readability

  if (!model.terms.length) {
    return <Card title="Topic coverage"><p className="m-0 text-[13px] text-muted">The SEO team has not built the topic term list yet.</p></Card>
  }

  const missing = report?.missing ?? model.terms
  const used = report?.used ?? []
  const chips = (list: WorkshopTerm[], isMissing: boolean) => grouped
    ? model.groups.map(g => { const items = list.filter(t => t.group === g); return items.length ? (
        <div key={g} className="mb-1">
          <p className="m-0 mt-2 mb-1 text-[12px] font-semibold text-muted">{g}</p>
          <div className="flex flex-wrap gap-1.5">{items.map(t => <Chip key={t.key} t={t} missing={isMissing} onClick={() => onTerm({ key: t.key, label: t.t })} />)}</div>
        </div>
      ) : null })
    : <div className="flex flex-wrap gap-1.5">{list.map(t => <Chip key={t.key} t={t} missing={isMissing} onClick={() => onTerm({ key: t.key, label: t.t })} />)}</div>
  const groupToggle = <button type="button" className={`${BTN.link} mt-2`} aria-pressed={grouped} onClick={() => setGrouped(g => !g)}>{grouped ? 'Turn groupings off' : 'Turn groupings on'}</button>

  async function send() {
    if (!rating) return
    const ok = await call(() => sendTermFeedback(id, rating, note), { refresh: false, ok: 'Thank you. The SEO team will see your feedback on the term list.' })
    if (ok) { setRating(null); setNote('') }
  }

  const stale = over && over.html !== html

  return (
    <div className="space-y-3">
      {toast}
      <Card title="Content review">
        <AiBtn id={id} feature="review" ai={ai} label={results.review ? 'Review again' : 'Review with Claude'} done="Claude reviewed the draft." />
        {results.review && <ReviewResult review={results.review} />}
        {!results.review && <Hint>Claude reads the whole draft and says where it is strong, where it is thin, and what to fix. It never grades the writer.</Hint>}
      </Card>

      {cv.on && (
        <Card title="Topic coverage">
          <p className={`m-0 text-[13px] leading-snug ${report ? TONE[report.coverage.tone] : 'text-muted'}`}>{report ? report.coverage.text : 'Paste your draft to see how well it covers the topic.'}</p>
          <Hint>Use terms naturally, where they help the reader. Using a term more often does not improve coverage.</Hint>
          {report && (
            <ul className="m-0 mt-2.5 list-none space-y-1 p-0 text-[13px]">
              {report.checks.map(c => { const m = c.st ? MARK[c.st] : null; return (
                <li key={c.l} className="flex items-start gap-2"><span className={`w-4 shrink-0 text-center font-bold ${m ? m[0] : 'text-muted'}`}>{m ? m[1] : '○'}</span><span>{c.l}{c.st === 'part' && <span className="text-[12px] text-muted"> (partly)</span>}</span></li>
              ) })}
            </ul>
          )}
          <Hint>The keyphrase checks look for the main ideas, not exact wording: word endings are ignored, and most of the keyphrase’s meaningful words need to appear. The key-terms check looks for a couple of the most important terms in your introduction.</Hint>
        </Card>
      )}

      {ln.on && (
        <Card title="Length">
          <Hint>No word count guarantees success. Under about {n(ln.thin)} words can leave gaps; over about {n(ln.long)} can bury readers in detail or drift off topic. If your draft covers everything readers need, a shorter article is fine.</Hint>
          <div className="mt-2"><Kv k="Your word count" v={n(report?.words ?? 0)} /></div>
          {report ? <p className={`m-0 mt-1.5 text-[13px] leading-snug ${TONE[report.length.tone]}`}>{report.length.text}</p> : <p className="m-0 mt-1.5 text-[12px] text-muted">Paste your draft to see its length.</p>}
        </Card>
      )}

      {rd.on && (
        <Card title="Readability">
          <Hint>Based on the Flesch reading-ease test, which looks at sentence length and word length. Aim for standard plain English or easier: shorter sentences and simpler words make a draft easier to read. Technical topics may read a bit harder, which is fine when your audience expects it.</Hint>
          {report?.read ? (
            <>
              <div className="mt-2"><Kv k="Your draft is" v={report.read.label} /></div>
              <p className={`m-0 mt-1.5 text-[13px] leading-snug ${TONE[report.read.tone]}`}>{report.read.text}</p>
            </>
          ) : <p className="m-0 mt-2 text-[12px] text-muted">Add a few paragraphs to check readability. Aim for plain English or easier.</p>}
        </Card>
      )}

      {FEEDBACK_WRITER.terms.on && (
        <Card title="Terms to consider">
          {missing.length ? (
            <>
              {chips(missing, true)}
              {groupToggle}
              <Hint>Try to work in as many of these as fit naturally and help the reader, but never stuff them in. Skip any that would feel forced. Click a term to see how others use it.</Hint>
            </>
          ) : <p className="m-0 text-[13px] text-[var(--ok-fg)]">Every term is covered.</p>}
          {!report && <p className="m-0 mt-2 text-[12px] text-muted">Add your draft to see which of these it already uses.</p>}
          {report && missing.length > 0 && <div className="mt-3"><AiBtn id={id} feature="place" ai={ai} label={results.placements ? 'Suggest again' : 'Suggest natural placements'} done="Claude suggested where the missing terms could fit." />{results.placements && <PlacementsResult placements={results.placements} />}</div>}
        </Card>
      )}

      {FEEDBACK_WRITER.used.on && (
        <Card title="Terms you’ve used">
          {used.length ? <>{chips(used, false)}{groupToggle}</> : <p className="m-0 text-[13px] text-muted">None yet.</p>}
          {report && FEEDBACK_WRITER.used.overuse && (
            <div className="mt-3">
              <button type="button" className={BTN.smallWhite} onClick={() => setOver({ result: overuseCheck(model, blocks), html })}>{over ? 'Check again' : 'Check for overused words'}</button>
              {over && (over.result.short
                ? <p className="m-0 mt-2 text-[12px] text-muted">Write a bit more before checking for overused words.</p>
                : over.result.items.length
                  ? <><p className="m-0 mt-2.5 mb-1.5 text-[13px]">These may be repeated more than reads naturally. Try varying the wording or trimming repetition:</p><ul className="m-0 list-disc pl-5 text-[13px]">{over.result.items.map(x => <li key={x.w}><b>{x.w}</b> appears {x.n} times</li>)}</ul></>
                  : <p className="m-0 mt-2 text-[13px] text-[var(--ok-fg)]">No words stand out as overused.</p>)}
              {stale && <p className="m-0 mt-1.5 text-[12px] text-muted">The draft has changed since this check.</p>}
            </div>
          )}
        </Card>
      )}

      <Card title="Feedback on the term list">
        <p className="m-0 text-[12.5px] leading-snug text-muted">Is this list a good fit for the topic? Tell the SEO team what is missing, what does not belong, or that it works well. It helps them tune how the lists are built.</p>
        <div className="mt-2.5 flex flex-wrap gap-2" role="group" aria-label="How is the term list?">
          <button type="button" aria-pressed={rating === 'good'} className={`${BTN.smallWhite} aria-pressed:!border-tn-teal aria-pressed:bg-tn-teal-soft`} onClick={() => setRating('good')}>Looks good</button>
          <button type="button" aria-pressed={rating === 'problems'} className={`${BTN.smallWhite} aria-pressed:!border-tn-teal aria-pressed:bg-tn-teal-soft`} onClick={() => setRating('problems')}>Has problems</button>
        </div>
        {rating && (
          <>
            <label htmlFor="fb-note" className="sr-only">Your feedback</label>
            <textarea id="fb-note" className={`${TEXTAREA} mt-2.5 min-h-[84px]`} value={note} maxLength={2000} onChange={e => setNote(e.target.value)} placeholder={rating === 'good' ? 'Anything the list did especially well? (optional)' : 'What is missing, or what does not belong?'} />
            <div className="mt-2"><button type="button" className={BTN.smallNavy} disabled={busy || (rating === 'problems' && !note.trim())} onClick={() => void send()}>Send feedback</button></div>
          </>
        )}
      </Card>
    </div>
  )
}
