'use client'

/**
 * 3F, "This overlaps another entry." (Time Entries.dc.html, frame 3F): the
 * two entries drawn on a small timeline with what they share hatched in red,
 * and the two ways out, trim the other entry or trim this one. Overlaps are
 * never saved.
 */

import { minutesLabel } from '@/lib/timeclock/format'
import { formatDuration } from '@/lib/timeclock/rounding'
import { BTN_MODAL_WHITE, MODAL_TITLE, Modal } from './ui'

/** A span in seconds of the person's day. */
export interface DaySpan { s: number; e: number }

const clk = (sec: number) => minutesLabel(sec / 60)

/** The copy and the drawing of 3F, from this entry (a) and the other (b, its end null while running). */
export function overlapModel(a: DaySpan, b: { s: number; e: number; running: boolean; name: string }) {
  const W = 456
  const lo = Math.min(a.s, b.s) - 900
  const hi = Math.max(a.e, b.e) + 900
  const px = (t: number) => ((t - lo) / (hi - lo)) * W
  const xs = Math.max(a.s, b.s)
  const xe = Math.min(a.e, b.e)
  const ticks: { x: number; label: string }[] = []
  for (let t = Math.ceil(lo / 3600) * 3600; t < hi; t += 3600) ticks.push({ x: px(t), label: clk(t).replace(':00', '') })
  return {
    text: `This one: ${clk(a.s)} to ${clk(a.e)}. ${b.name}: ${clk(b.s)} to ${b.running ? 'now' : clk(b.e)}. They share ${formatDuration(xe - xs)}, from ${clk(xs)} to ${clk(xe)}. Overlaps are never saved.`,
    ticks,
    a: { x: px(a.s), w: px(a.e) - px(a.s) },
    b: { x: px(b.s), w: px(b.e) - px(b.s) },
    shared: { x: px(xs), w: Math.max(2, px(xe) - px(xs)) },
    otherSub: b.s < a.s ? `${b.name} becomes ${clk(b.s)} to ${clk(a.s)}.` : `${b.name} becomes ${clk(a.e)} to ${clk(b.e)}.`,
    thisSub: a.s >= b.s ? `This one becomes ${clk(b.e)} to ${clk(a.e)}.` : `This one becomes ${clk(a.s)} to ${clk(b.s)}.`,
  }
}

const CHOICE = 'flex flex-col items-start gap-0.5 whitespace-nowrap border border-slate-200 rounded-[11px] px-3.5 py-[11px] bg-white text-left transition-colors hover:border-tn-teal'

export function OverlapFix({ a, b, onTrim, onCancel, busy }: {
  a: DaySpan
  b: { s: number; e: number; running: boolean; name: string }
  onTrim: (which: 'other' | 'this') => void
  onCancel: () => void
  busy: boolean
}) {
  const m = overlapModel(a, b)
  return (
    <Modal label="Overlap" width={500} onClose={onCancel} alert>
      <h2 className={MODAL_TITLE} style={{ letterSpacing: 'normal' }}>This overlaps another entry.</h2>
      <p className="m-0 text-[13px] text-foreground leading-normal tabular-nums lining-nums">{m.text}</p>
      <div className="relative h-[98px] border border-[var(--row-rule)] rounded-[12px] bg-[var(--row-hover)] overflow-hidden" aria-hidden="true">
        {m.ticks.map(t => (
          <span key={t.x} style={{ left: t.x }} className="absolute top-0 bottom-0 border-l border-dashed border-[var(--panel-border)] pt-1 pl-1 text-[10px] text-muted tabular-nums lining-nums">{t.label}</span>
        ))}
        <div style={{ left: m.a.x, width: m.a.w }}
          className="absolute top-6 h-[26px] rounded-[7px] bg-tn-teal-soft border-2 border-tn-teal box-border px-[7px] flex items-center font-(family-name:--font-display) font-extrabold text-[11px] text-tn-teal whitespace-nowrap overflow-hidden">This one</div>
        <div style={{ left: m.b.x, width: m.b.w }}
          className="absolute top-[58px] h-[26px] rounded-[7px] bg-tn-primary box-border px-[7px] flex items-center font-(family-name:--font-display) font-extrabold text-[11px] text-[#ffffff] whitespace-nowrap overflow-hidden">{b.name}</div>
        <div style={{ left: m.shared.x, width: m.shared.w, background: 'repeating-linear-gradient(135deg,rgba(200,50,61,.28) 0 5px,rgba(200,50,61,.08) 5px 10px)' }}
          className="absolute box-content top-[18px] bottom-2 border-l-[1.5px] border-r-[1.5px] border-[#c8323d]" />
      </div>
      <div className="flex flex-col gap-2">
        <button type="button" disabled={busy} onClick={() => onTrim('other')} className={CHOICE}>
          <span className="font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink">Trim the other entry</span>
          <span className="text-[12px] text-muted tabular-nums lining-nums">{m.otherSub}</span>
        </button>
        <button type="button" disabled={busy} onClick={() => onTrim('this')} className={CHOICE}>
          <span className="font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink">Trim this one</span>
          <span className="text-[12px] text-muted tabular-nums lining-nums">{m.thisSub}</span>
        </button>
      </div>
      <div className="flex justify-end">
        <button type="button" onClick={onCancel} className={BTN_MODAL_WHITE}>Cancel</button>
      </div>
    </Modal>
  )
}
