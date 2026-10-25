'use client'

/**
 * The side panel a Needs you or My Work row opens on Home (design_handoff_home,
 * README "Side panel", Home Final.dc.html): 460px from the right, full height
 * under the top bar, over a dim layer that closes it. The head (type, due,
 * title, the row's line), the facts, a note, the way to the page the row
 * belongs to, and the two buttons. The navy one runs the page's own server
 * action; one that needs a reason (send back, decline) asks for it here, as
 * the page does, before it runs.
 *
 * The one text box is either the Reason (send back, decline) or the Note an
 * approval needs; the navy button sends it only as a Note (audit, 25 October
 * 2026: a reason typed for Send back went out as the approval's note). When
 * approving answers that it needs a note, the box opens as the Note and the
 * person approves again. An action that ran but leaves the row (an invitation
 * sent again, checks run now) says so here and keeps the panel open.
 *
 * Focus moves in, Tab stays inside, Escape closes it and focus goes back to
 * the row's button: the drawers' useModal (NeedsYouCard finds a place for it
 * when that button is gone).
 */

import Link from 'next/link'
import { useRef, useState } from 'react'
import { useModal } from '@/components/ui/useModal'
import { asksForNote, panelText, type HomeRow, type PanelButton, type PanelField } from '@/lib/home/needs-you-model'
import { DUE_FG, TypeChip, typeOf } from './needs-you-ui'
import type { Runner } from './needs-you-actions'

const SYMBOL = { check: 'M5 12l5 5 9-10', arrow: 'M9 6l6 6-6 6' }
const PRIMARY = 'flex-1 cursor-pointer border-0 rounded-[11px] px-4 py-[13px] font-(family-name:--font-display) font-extrabold text-[14px] flex items-center justify-center gap-2 bg-tn-primary text-[#ffffff] disabled:opacity-60 disabled:cursor-wait'
const SECONDARY = 'cursor-pointer border border-[#d9dee6] bg-white rounded-[11px] px-4 py-[13px] font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink disabled:opacity-60 disabled:cursor-wait'

export function HomeSidePanel({ row, run, onClose, onDone, onRan }: {
  row: HomeRow
  run: Runner
  onClose: () => void
  /** The action worked: the row turns to Done. */
  onDone: () => void
  /** The action ran and the row stays (its message is shown here): the page behind reads again. */
  onRan?: () => void
}) {
  const box = useRef<HTMLDivElement>(null)
  useModal(true, box, onClose)
  const p = row.panel!
  const t = typeOf(row)
  // What the box is for now: a Note to approve, a Reason to send back or decline, or nothing yet.
  const [field, setField] = useState<PanelField>(p.approveNeedsNote ? 'note' : null)
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const asking = field === 'reason'
  const focusField = () => requestAnimationFrame(() => noteRef.current?.focus())

  const press = async (b: PanelButton, isSecondary: boolean) => {
    if (b.copy) {
      const text = b.copy.startsWith('/') ? `${window.location.origin}${b.copy}` : b.copy
      try { await navigator.clipboard.writeText(text); setMsg({ ok: true, text: 'Link copied.' }) } catch { setMsg({ ok: false, text: `Copy it from here: ${text}` }) }
      return
    }
    if (!b.op) { onClose(); return }
    // Send back and decline ask for the reason first, as their pages do.
    if (isSecondary && b.needsReason && !asking) {
      setField('reason'); setMsg(null)
      focusField()
      return
    }
    setPending(true); setMsg(null)
    try {
      const r = await run(b.op, panelText(field, isSecondary, note))
      if (r.ok && r.message) { setMsg({ ok: true, text: r.message }); onRan?.(); return }
      if (r.ok) { onDone(); return }
      setMsg({ ok: false, text: r.error })
      // Approving asked for a note (over the allowance): the box opens as the Note, to approve again.
      if (!isSecondary && asksForNote(r.error)) {
        setField('note')
        focusField()
      }
    } catch {
      setMsg({ ok: false, text: 'Not saved. Try again in a moment.' })
    } finally {
      setPending(false)
    }
  }

  const button = (b: PanelButton, isSecondary: boolean) => {
    const cls = isSecondary ? SECONDARY : PRIMARY
    const inner = (
      <>
        {!isSecondary && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-tn-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={SYMBOL[b.icon ?? 'arrow']} /></svg>
        )}
        {b.label}
      </>
    )
    if (b.href) {
      return b.external
        ? <a href={b.href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
        : <Link href={b.href} onClick={onClose} className={cls}>{inner}</Link>
    }
    return <button type="button" disabled={pending} aria-busy={pending} onClick={() => press(b, isSecondary)} className={cls}>{inner}</button>
  }

  return (
    <>
      <div aria-hidden="true" onClick={onClose} className="fixed inset-x-0 bottom-0 top-[var(--chrome-top)] z-40 bg-[rgba(1,35,88,.18)]" />
      <div ref={box} role="dialog" aria-modal="true" aria-label={p.title} className="fixed right-0 bottom-0 top-[var(--chrome-top)] z-40 w-[460px] max-w-full bg-white border-l border-[var(--panel-border)] shadow-[-24px_0_50px_-24px_rgba(1,35,88,.35)] flex flex-col">
        <div className="px-6 pt-[22px] pb-[18px] border-b border-[var(--row-rule)] flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2.5">
              <TypeChip row={row} size={34} />
              <span className="font-(family-name:--font-display) font-extrabold text-[11px] tracking-[.1em] uppercase" style={{ color: t.fg }}>{t.label}</span>
              {row.due && <span className="text-[12.5px] font-bold" style={{ color: DUE_FG[row.due.tone] }}>· {row.due.label}</span>}
            </span>
            <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 border-0 bg-transparent rounded-[8px] cursor-pointer text-muted flex items-center justify-center hover:bg-[#f4f2ec] hover:text-tn-ink">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>
          <div className="font-(family-name:--font-display) font-extrabold text-[22px] leading-[1.25] text-tn-ink">{p.title}</div>
          <div className="text-[14px] text-[#5b6b82] leading-[1.5] tabular-nums">{p.sub}</div>
        </div>

        <div className="flex-1 overflow-auto px-6 py-5 flex flex-col gap-[18px]">
          <div className="border border-[var(--panel-border)] rounded-[14px] overflow-hidden">
            {p.facts.map(f => (
              <div key={f.k} className="flex justify-between gap-4 px-4 py-3 border-b border-[#f1f3f6]">
                <span className="text-[13px] text-muted">{f.k}</span>
                <span className="text-[13.5px] font-bold text-tn-ink text-right tabular-nums">{f.v}</span>
              </div>
            ))}
          </div>
          {p.note && <div className="bg-[#f4f2ec] rounded-[12px] px-4 py-[14px] text-[13.5px] text-foreground leading-[1.55]">{p.note}</div>}
          {field && (
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-bold text-tn-ink">{asking ? 'Reason' : 'Note'}</span>
              <textarea
                ref={noteRef} value={note} onChange={e => setNote(e.target.value)} rows={3}
                placeholder={asking ? 'They see it with the decision.' : 'Why the hours over the allowance are approved.'}
                className="rounded-[10px] border border-[#d9dee6] px-3 py-2.5 text-[13.5px] text-tn-ink leading-[1.5] resize-y focus:outline-none focus:border-tn-teal"
              />
            </label>
          )}
          <Link href={p.link.href} onClick={onClose} className="text-[13px] font-bold inline-flex items-center gap-1.5 self-start text-tn-teal hover:text-tn-ink">
            {p.link.label}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
          </Link>
        </div>

        <div className="px-6 py-4 border-t border-[var(--row-rule)] flex flex-col gap-2.5">
          {msg && <p aria-live="polite" className={`m-0 text-[12.5px] font-semibold ${msg.ok ? 'text-[#0d7a4f]' : 'text-[#c8323d]'}`}>{msg.text}</p>}
          <div className="flex gap-2.5">
            {button(p.primary, false)}
            {p.secondary && button(p.secondary, true)}
          </div>
        </div>
      </div>
    </>
  )
}
