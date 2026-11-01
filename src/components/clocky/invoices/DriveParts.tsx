'use client'

/**
 * Google Drive on the pay pages (owner, 31 October 2026):
 *
 *   DriveCell   the Drive column of the Invoices and Documents lists: In Drive
 *               (a green check, opens the file in a new tab), Waiting (an
 *               amber clock), Failed (red, with Try again for Super Admins),
 *               "After approval" before it is approved
 *   DriveBox    the "Google Drive" box beside one invoice: the file, the
 *               folder, each version written, Open in Drive
 *
 * What each state means is lib/drive/copy-plan.ts (driveShow).
 */

import { useState } from 'react'
import type { DriveBoxData, DriveShow } from '@/lib/drive/copy-plan'
import { BTN, BTN_ICON } from '@/lib/ui/buttons'
import { CARD, CARD_TITLE, FIELD_LABEL } from '@/lib/ui/type'
import { ERROR_TEXT } from '@/lib/ui/feedback'

type Done = { ok: true; toast: string } | { ok: false; error: string }
export type RetryDrive = (i: { id: number }) => Promise<Done>

const CHECK = 'M5 12l5 5 9-10'
const CLOCK = 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z'
const CROSS = 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9 9l6 6M15 9l-6 6'
const OUT = 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'

function Glyph({ d, color }: { d: string; color: string }) {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none"><path d={d} /></svg>
}

const GREEN = 'var(--bdg-green-fg)'
const AMBER = 'var(--bdg-orange-fg)'
const RED = '#c8323d'

/** One row's Drive cell. The row opens its document, so clicks here stop at the cell. */
export function DriveCell({ show, retry, say }: { show: DriveShow | undefined; retry?: RetryDrive; say?: (t: { text: string; error?: boolean }) => void }) {
  const [busy, setBusy] = useState(false)
  const stop = (e: React.MouseEvent | React.KeyboardEvent) => e.stopPropagation()
  if (!show) return <span className="text-muted">-</span>
  if (show.state === 'done') {
    return show.link
      ? <a href={show.link} target="_blank" rel="noreferrer" onClick={stop} onKeyDown={stop} className="inline-flex items-center gap-1.5 font-bold text-[12.5px] text-[var(--bdg-green-fg)] hover:underline whitespace-nowrap"><Glyph d={CHECK} color={GREEN} />In Drive</a>
      : <span className="inline-flex items-center gap-1.5 font-bold text-[12.5px] text-[var(--bdg-green-fg)] whitespace-nowrap"><Glyph d={CHECK} color={GREEN} />In Drive</span>
  }
  if (show.state === 'waiting') {
    return <span title={show.updating ? 'A new version waits to be written over the file in Drive, within a few minutes.' : 'Copied in the next few minutes.'} className="inline-flex items-center gap-1.5 font-bold text-[12.5px] text-[var(--bdg-orange-fg)] whitespace-nowrap"><Glyph d={CLOCK} color={AMBER} />{show.updating ? 'Updating' : 'Waiting'}</span>
  }
  if (show.state === 'failed') {
    const again = async (e: React.MouseEvent) => {
      e.stopPropagation()
      if (!retry || show.copyId == null) return
      setBusy(true)
      try {
        const r = await retry({ id: show.copyId })
        say?.(r.ok ? { text: r.toast } : { text: r.error, error: true })
      } finally {
        setBusy(false)
      }
    }
    return (
      <span className="inline-flex items-center gap-2 whitespace-nowrap" title={show.error ?? undefined}>
        <span className={`inline-flex items-center gap-1.5 font-bold text-[12.5px] ${ERROR_TEXT}`}><Glyph d={CROSS} color={RED} />Failed</span>
        {retry && show.copyId != null && <button type="button" disabled={busy} onClick={e => void again(e)} className={`${BTN.link} disabled:opacity-50`}>Try again</button>}
      </span>
    )
  }
  if (show.state === 'after') return <span className="text-[12.5px] text-muted whitespace-nowrap">After approval</span>
  return <span title="Approved before the Drive copies began: kept in the portal only." className="text-[12.5px] text-muted whitespace-nowrap">Not copied</span>
}


/** The "Google Drive" box beside one invoice. */
export function DriveBox({ data, retry, say }: { data: DriveBoxData; retry?: RetryDrive; say?: (t: { text: string; error?: boolean }) => void }) {
  const s = data.show
  const status = s.state === 'done' ? 'In Drive' : s.state === 'waiting' ? (s.updating ? 'A new version is waiting' : 'Waiting to be copied') : s.state === 'failed' ? 'The copy failed' : s.state === 'after' ? 'Copied when it is approved' : 'Not copied: approved before the copies began'
  return (
    <div className={`${CARD} p-[18px] flex flex-col gap-3`}>
      <div className="flex items-center justify-between gap-3">
        <span className={CARD_TITLE}>Google Drive</span>
        <DriveCell show={s.state === 'failed' ? s : { ...s, link: null }} retry={retry} say={say} />
      </div>
      {s.state !== 'before' && (
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-1"><span className={FIELD_LABEL}>File</span><span className="text-[13px] text-tn-ink font-semibold [overflow-wrap:anywhere]">{data.file}</span></div>
          <div className="flex flex-col gap-1"><span className={FIELD_LABEL}>Folder</span><span className="text-[13px] text-tn-ink font-semibold">{data.folder}</span></div>
        </div>
      )}
      {s.state === 'failed' && s.error && <span className={`text-[12px] leading-[1.45] ${ERROR_TEXT}`}>{s.error}</span>}
      {data.history.length > 0 ? (
        <div className="flex flex-col gap-1.5 border-t border-[var(--row-rule)] pt-2.5">
          {data.history.map((h, i) => (
            <div key={i} className="flex justify-between gap-3 text-[12.5px]">
              <span className="text-tn-ink font-semibold">{h.text}</span>
              <span className="text-muted tabular-nums lining-nums whitespace-nowrap">{h.when}</span>
            </div>
          ))}
        </div>
      ) : <span className="text-[12.5px] text-muted">{status}.</span>}
      {s.link && s.state !== 'after' && (
        <a href={s.link} target="_blank" rel="noreferrer" className={`${BTN.white} justify-center`}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={OUT} /></svg>Open in Drive
        </a>
      )}
    </div>
  )
}
