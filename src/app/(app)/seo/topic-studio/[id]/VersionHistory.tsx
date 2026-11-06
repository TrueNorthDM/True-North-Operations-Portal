'use client'

/**
 * Version history of the draft (Topic Studio writer workshop, phase 2): a
 * drawer listing the snapshots (saved by hand, automatic, or taken before a
 * restore), with a preview and a restore. A restore keeps what the draft was
 * first, so nothing is lost either way. The newest 40 are kept.
 */

import { useEffect, useState } from 'react'
import { Icon, ICON } from '@/components/clocky/entries/ui'
import { Pill } from '@/components/ui/Pill'
import { useConfirm } from '@/components/ui/useConfirm'
import { BTN } from '@/lib/ui/buttons'
import type { VersionInfo } from '@/lib/topic-studio/store'
import { listVersions, readVersion, restoreVersion, saveVersionNow } from '../actions'
import { useTopicCall } from './use-topic-call'

const KIND = { saved: ['Saved', 'green'], auto: ['Automatic', 'gray'], restore: ['Before restore', 'amber'] } as const
const when = (t: string) => new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

export function VersionHistory({ id, beforeSave, onRestored, onClose }: {
  id: string
  /** Sends any typing still waiting to the server and waits for it, so a snapshot holds the latest text. */
  beforeSave: () => Promise<void>
  onRestored: (html: string, version: number) => void
  onClose: () => void
}) {
  const { call, busy, toast } = useTopicCall()
  const [confirmDialog, confirm] = useConfirm()
  const [list, setList] = useState<VersionInfo[] | null>(null)
  const [open, setOpen] = useState<{ id: number; html: string | null } | null>(null)

  useEffect(() => {
    let stale = false
    void (async () => {
      try { await beforeSave(); const r = await listVersions(id); if (!stale) setList(r.ok ? r.versions : []) } catch { if (!stale) setList([]) }
    })()
    return () => { stale = true }
  }, [id, beforeSave])
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [onClose])

  async function saveNow() {
    await beforeSave()
    const r = await call(() => saveVersionNow(id), { refresh: false, ok: 'Version saved.' })
    if (r) { const l = await listVersions(id); if (l.ok) setList(l.versions) }
  }
  async function preview(v: VersionInfo) {
    if (open?.id === v.id) { setOpen(null); return }
    setOpen({ id: v.id, html: null })
    const r = await call(() => readVersion(id, v.id), { refresh: false })
    setOpen(r ? { id: v.id, html: r.html } : null)
  }
  async function restore(v: VersionInfo) {
    if (!(await confirm({ title: 'Restore this version?', body: 'It becomes your draft. What you have now is saved in the history first, so you can come back to it.', action: 'Restore' }))) return
    await beforeSave()
    const r = await call(() => restoreVersion(id, v.id), { refresh: false, ok: 'Restored. Your previous draft is saved in the history.' })
    if (r) { onRestored(r.html, r.version); onClose() }
  }

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-[rgba(1,35,88,.32)]" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      {toast}{confirmDialog}
      <aside role="dialog" aria-modal="true" aria-label="Version history" className="flex h-full w-full max-w-[480px] flex-col bg-white shadow-[-20px_0_50px_-20px_rgba(1,35,88,.5)]">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--panel-border)] px-5 py-4">
          <h2 className="m-0 font-(family-name:--font-display) text-[18px] font-extrabold text-tn-ink">Version history</h2>
          <button type="button" className={BTN.icon} onClick={onClose} aria-label="Close" autoFocus><Icon d={ICON.close} size={17} /></button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <button type="button" className={BTN.smallNavy} disabled={busy} onClick={() => void saveNow()}>Save version now</button>
          <p className="m-0 my-3 text-[12.5px] leading-snug text-muted">Your draft saves automatically as you type. A version is a snapshot you can go back to. The newest 40 are kept.</p>
          {list === null && <p className="m-0 text-[13px] text-muted">Loading…</p>}
          {list && !list.length && <p className="m-0 rounded-[12px] bg-subtle px-4 py-3 text-[13px] text-muted">No saved versions yet. Click Save version now to keep a snapshot.</p>}
          {list && list.length > 0 && (
            <ul className="m-0 list-none p-0">
              {list.map(v => (
                <li key={v.id} className="border-b border-[var(--row-rule)] py-3 last:border-0">
                  <div className="flex items-center justify-between gap-2 text-[13px]">
                    <span><b className="text-tn-ink">{when(v.savedAt)}</b> <Pill tone={KIND[v.kind][1]} text={KIND[v.kind][0]} /></span>
                    <span className="text-[12px] tabular-nums text-muted">{v.words.toLocaleString('en-US')} words</span>
                  </div>
                  <div className="text-[12px] text-muted">{v.by}{v.note ? ` · ${v.note}` : ''}</div>
                  <div className="mt-1.5 flex gap-2">
                    <button type="button" className={BTN.smallWhite} disabled={busy} onClick={() => void preview(v)}>{open?.id === v.id ? 'Hide preview' : 'Preview'}</button>
                    <button type="button" className={BTN.smallWhite} disabled={busy} onClick={() => void restore(v)}>Restore</button>
                  </div>
                  {open?.id === v.id && (
                    open.html === null ? <p className="m-0 mt-2 text-[12.5px] text-muted">Loading…</p>
                      : <div className="ts-editor mt-2 max-h-[320px] overflow-y-auto rounded-[10px] border border-[var(--panel-border)] bg-subtle !min-h-0 !p-3 !text-[13px]" /* The server sanitized this HTML (lib/topic-studio/sanitize.ts). */ dangerouslySetInnerHTML={{ __html: open.html || '<p>Empty.</p>' }} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  )
}
