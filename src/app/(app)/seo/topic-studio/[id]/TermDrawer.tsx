'use client'

/**
 * A term in context (Topic Studio): which competitors use it, how often, and the
 * sentences around it, with the term marked. Opened from the Topic terms tab and
 * from the term chips in the writer workshop; Escape or a click outside closes it.
 */

import { useEffect, useMemo, useState } from 'react'
import { Icon, ICON } from '@/components/clocky/entries/ui'
import { BTN } from '@/lib/ui/buttons'
import { termPattern, type TermContext } from '@/lib/topic-studio/analysis'
import { termContext } from '../actions'

/** A term in context: who uses it, how often, and the sentences around it. */
export function TermDrawer({ id, term, onClose, onError }: { id: string; term: { key: string; label: string }; onClose: () => void; onError: (m: string) => void }) {
  const [ctx, setCtx] = useState<TermContext | null>(null)
  useEffect(() => {
    let stale = false
    void termContext(id, term.key, term.label).then(r => { if (stale) return; if (r.ok) setCtx(r.context); else { onError(r.error); onClose() } }).catch(() => { if (!stale) { onError('That did not load. Try again in a moment.'); onClose() } })
    return () => { stale = true }
  }, [id, term.key, term.label, onClose, onError])
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [onClose])

  const re = useMemo(() => { const p = termPattern(term.label); try { return p ? new RegExp(`\\b${p}\\b`, 'gi') : null } catch { return null } }, [term.label])
  const mark = (s: string) => {
    if (!re) return s
    re.lastIndex = 0
    const out: React.ReactNode[] = []
    let pos = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(s))) { out.push(s.slice(pos, m.index), <mark key={m.index} className="rounded bg-[#fbf1cf] px-0.5 text-inherit">{m[0]}</mark>); pos = m.index + m[0].length; if (!m[0]) re.lastIndex++ }
    out.push(s.slice(pos))
    return out
  }
  const st = ctx?.stats

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-[rgba(1,35,88,.32)]" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <aside role="dialog" aria-modal="true" aria-label={`${term.label} in context`} className="flex h-full w-full max-w-[440px] flex-col bg-white shadow-[-20px_0_50px_-20px_rgba(1,35,88,.5)]">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--panel-border)] px-5 py-4">
          <h2 className="m-0 font-(family-name:--font-display) text-[18px] font-extrabold text-tn-ink">{term.label}</h2>
          <button type="button" className={BTN.icon} onClick={onClose} aria-label="Close" autoFocus><Icon d={ICON.close} size={17} /></button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!ctx && <p className="m-0 text-[13px] text-muted">Loading…</p>}
          {st && (
            <>
              <p className="m-0 mb-4 text-[13px] text-muted leading-normal">
                Used by {st.df} of {st.competitors} competitors{st.df ? `, typically ${st.med}× (range ${st.min}-${st.max})` : ''}
                {st.aiAnswers ? (st.ai ? `, and by ${st.aiLabels.join(', ')}` : '. No AI answer uses it') : ''}.
              </p>
              {ctx.sources.length ? ctx.sources.map(g => (
                <div key={g.label} className="mb-4">
                  <p className="m-0 mb-1.5 text-[13px] font-bold text-tn-ink">{g.label} <span className="font-normal text-muted">{g.uses} use{g.uses === 1 ? '' : 's'}</span></p>
                  {g.examples.map((e, i) => (
                    <blockquote key={i} className="m-0 mb-2 border-l-[3px] border-[var(--panel-border)] pl-3 text-[13px] leading-normal">
                      {mark(e.text)}<small className="mt-0.5 block text-[11.5px] text-muted">under “{e.under}”</small>
                    </blockquote>
                  ))}
                </div>
              )) : <p className="m-0 text-muted">No competitor uses this term.</p>}
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
