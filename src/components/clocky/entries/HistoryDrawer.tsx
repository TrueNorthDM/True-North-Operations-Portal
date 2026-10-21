'use client'

/**
 * 3G, the entry's history (Time Entries.dc.html, frame 3G): a drawer from the
 * right under the top bar, every change newest first, old values struck
 * through and new ones in navy, the reason under each.
 */

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { HistoryData } from '@/lib/timeclock/clocky-types'
import { CloseButton, useIsClient } from './ui'

export function HistoryDrawer({ history, error, onClose }: {
  history: HistoryData | null
  /** The read failed: its sentence. */
  error: string | null
  onClose: () => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('[aria-modal="true"]')) close.current() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
  const client = useIsClient()
  if (!client) return null
  return createPortal(
    <div ref={box} role="dialog" aria-label="Entry history"
      className="fixed top-[var(--chrome-top)] right-0 bottom-0 w-[431px] max-w-full bg-white border-l border-[var(--panel-border)] shadow-[-24px_0_50px_-24px_rgba(1,35,88,.35)] z-[60] flex flex-col leading-[normal]">
      <div className="px-[18px] pt-[18px] pb-3.5 border-b border-[var(--row-rule)] flex gap-2.5 items-start">
        <div className="flex-1 min-w-0">
          <h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[18px] text-tn-ink" style={{ letterSpacing: 'normal' }}>Entry history</h2>
          <div className="text-[12.5px] text-foreground mt-[5px] leading-[1.45] tabular-nums lining-nums">{history?.summary ?? ''}</div>
        </div>
        <CloseButton onClick={onClose} />
      </div>
      <div className="flex-1 overflow-auto px-[18px] py-4 flex flex-col">
        {error && <p role="alert" className="m-0 text-[13px] text-[#c8323d] font-semibold">{error}</p>}
        {history?.lines.map((h, i) => (
          <div key={`${h.at}${i}`} className="grid grid-cols-[14px_minmax(0,1fr)] gap-3">
            <div className="flex flex-col items-center">
              <span className="w-2.5 h-2.5 rounded-full mt-1 flex-none" style={{ background: h.dot }} />
              <span className="flex-1 w-0.5 bg-[var(--row-rule)] my-1" />
            </div>
            <div className="pb-[18px] flex flex-col gap-1">
              <div className="text-[11.5px] text-muted tabular-nums lining-nums">{h.when}</div>
              <div className="text-[13px] text-tn-ink font-bold leading-[1.4]">{h.text}</div>
              {h.changes.map((c, j) => (
                <div key={j} className="text-[12.5px] text-foreground tabular-nums lining-nums">
                  {c.field}: <s className="text-muted">{c.old}</s> → <b className="text-tn-ink">{c.new}</b>
                </div>
              ))}
              {h.reason && <div className="text-[12.5px] text-foreground">Reason: {h.reason}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>,
    document.body,
  )
}
