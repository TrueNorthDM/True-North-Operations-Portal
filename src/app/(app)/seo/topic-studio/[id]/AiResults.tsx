'use client'

/**
 * What Claude's review and placement suggestions look like in the writer's
 * panel (phase 3). Guidance in words: ratings say where to look, never grade the
 * writer, and a fix is a thing to do. Everything is plain text from the
 * server's own reading of Claude's answer.
 */

import type { Placements, Review } from '@/lib/topic-studio/ai/results'

const RATING: Record<string, string> = { strong: 'text-[var(--ok-fg)]', good: 'text-[var(--ok-fg)]', ok: 'text-[var(--ok-fg)]', 'needs work': 'text-[var(--warn-fg)]', weak: 'text-[#c8323d]', missing: 'text-[#c8323d]' }
const VERDICT: Record<string, string> = { original: 'Original', commodity: 'Commodity', mixed: 'Mixed' }

const when = (t: number) => (t ? new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')

export function ReviewResult({ review }: { review: Review }) {
  return (
    <div className="mt-3 space-y-3 text-[13px] leading-snug">
      {review.at > 0 && <p className="m-0 text-[11.5px] text-muted">Reviewed {when(review.at)}. Review again after big changes.</p>}
      <ul className="m-0 list-none space-y-2.5 p-0">
        {review.criteria.map(c => (
          <li key={c.name}>
            <p className="m-0 font-semibold text-tn-ink">{c.name} <span className={`ml-1 text-[12px] font-bold ${RATING[c.rating.toLowerCase()] ?? 'text-muted'}`}>{c.rating}</span></p>
            {c.summary && <p className="m-0 mt-0.5 text-muted">{c.summary}</p>}
            {c.fixes.length > 0 && <ul className="m-0 mt-1 list-disc pl-5">{c.fixes.map(f => <li key={f}>{f}</li>)}</ul>}
          </li>
        ))}
      </ul>
      {(review.opening.note || review.closing.note) && (
        <div>
          {review.opening.note && <p className="m-0"><b>Opening:</b> <span className={review.opening.ok ? 'text-[var(--ok-fg)]' : 'text-[var(--warn-fg)]'}>{review.opening.ok ? 'works' : 'needs work'}</span>. {review.opening.note}</p>}
          {review.closing.note && <p className="m-0 mt-1"><b>Closing:</b> <span className={review.closing.ok ? 'text-[var(--ok-fg)]' : 'text-[var(--warn-fg)]'}>{review.closing.ok ? 'works' : 'needs work'}</span>. {review.closing.note}</p>}
        </div>
      )}
      {review.original.length > 0 && (
        <div>
          <p className="m-0 font-semibold text-tn-ink">Original material Claude found</p>
          <ul className="m-0 mt-1 list-disc pl-5">{review.original.map(o => <li key={o.excerpt}>{o.type && <b>{o.type}: </b>}{o.excerpt}{o.heading && <span className="text-muted"> (under {o.heading})</span>}</li>)}</ul>
        </div>
      )}
      {review.sections.length > 0 && (
        <div>
          <p className="m-0 font-semibold text-tn-ink">Section by section</p>
          <ul className="m-0 mt-1 list-none space-y-1 p-0">{review.sections.map(s => <li key={s.heading}><b>{s.heading}</b> <span className="text-muted">{VERDICT[s.verdict] ?? s.verdict}</span>{s.note && <span>. {s.note}</span>}</li>)}</ul>
        </div>
      )}
    </div>
  )
}

export function PlacementsResult({ placements }: { placements: Placements }) {
  if (!placements.list.length && !placements.skip.length) return <p className="m-0 mt-2 text-[12.5px] text-muted">Claude found nothing to add.</p>
  return (
    <div className="mt-3 text-[13px] leading-snug">
      {placements.list.length > 0 && (
        <ul className="m-0 list-none space-y-2 p-0">
          {placements.list.map(p => <li key={p.term}><b className="text-tn-ink">{p.term}</b>{p.heading && <span className="text-muted"> under {p.heading}</span>}<span className="block">{p.how}</span></li>)}
        </ul>
      )}
      {placements.skip.length > 0 && (
        <div className="mt-2.5">
          <p className="m-0 font-semibold text-tn-ink">Better to skip</p>
          <ul className="m-0 mt-1 list-disc pl-5">{placements.skip.map(p => <li key={p.term}><b>{p.term}</b>{p.reason && <span className="text-muted">: {p.reason}</span>}</li>)}</ul>
        </div>
      )}
    </div>
  )
}
