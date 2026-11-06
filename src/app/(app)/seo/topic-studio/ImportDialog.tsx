'use client'

/**
 * Import topic files (Topic Studio, phase 0): the .topic-studio.json exports
 * of the Artifact. Choosing or dropping files first asks the import route what
 * each would do (preview), then "Import" writes the new and updated ones.
 * The route decides everything; this only shows its answers.
 */

import { useRef, useState, type DragEvent } from 'react'
import { useRouter } from 'next/navigation'
import { CloseButton, Modal } from '@/components/clocky/entries/ui'
import { Pill } from '@/components/ui/Pill'
import { BTN, BTN_ICON } from '@/lib/ui/buttons'
import { MODAL_TITLE } from '@/lib/ui/modal'
import { ERROR_TEXT } from '@/lib/ui/feedback'
import type { ImportFileResult } from './import/route'

const URL = '/seo/topic-studio/import'

const TONE = { new: 'blue', updated: 'amber', same: 'gray', older: 'gray', error: 'red' } as const
const WORD = { new: 'New', updated: 'Updated', same: 'Same', older: 'Older', error: 'Not read' } as const

const UploadIcon = ({ tone }: { tone: keyof typeof BTN_ICON }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON[tone]} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M5 20h14" /></svg>
)

export function ImportDialog() {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [results, setResults] = useState<ImportFileResult[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<number | null>(null)
  const [over, setOver] = useState(false)

  const reset = () => { setFiles([]); setResults(null); setError(''); setDone(null); setBusy(false) }
  const close = () => { setOpen(false); reset() }

  async function send(mode: 'preview' | 'commit', list: File[]) {
    setBusy(true); setError('')
    const form = new FormData()
    form.set('mode', mode)
    for (const f of list) form.append('files', f)
    try {
      const res = await fetch(URL, { method: 'POST', body: form })
      const body = await res.json().catch(() => null) as { error?: string; imported?: number; files?: ImportFileResult[] } | null
      if (!res.ok || !body?.files) { setError(body?.error ?? 'The import did not answer. Try again.'); return }
      setResults(body.files)
      if (mode === 'commit') { setDone(body.imported ?? 0); router.refresh() }
    } catch {
      setError('The import could not be reached. Check the connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  function pick(list: FileList | null) {
    const chosen = [...(list ?? [])]
    if (!chosen.length) return
    setFiles(chosen); setDone(null)
    void send('preview', chosen)
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files) }
  const toImport = results?.filter(r => r.status === 'new' || r.status === 'updated').length ?? 0

  return (
    <>
      <button type="button" className={BTN.white} onClick={() => setOpen(true)}>
        <UploadIcon tone="white" />Import topic files
      </button>
      {open && (
        <Modal label="Import topic files" width={600} onClose={close}>
          <div className="flex items-center justify-between gap-3">
            <h2 className={MODAL_TITLE}>Import topic files</h2>
            <CloseButton onClick={close} />
          </div>
          <p className="m-0 text-[13px] leading-normal">
            Add the <code>.topic-studio.json</code> files exported from the Topic Studio Artifact (Export for writer). A topic that is already here is updated, never duplicated, and the copy it replaces is kept.
          </p>
          <div
            onDragOver={e => { e.preventDefault(); setOver(true) }}
            onDragLeave={() => setOver(false)}
            onDrop={onDrop}
            className={`rounded-[12px] border-[1.5px] border-dashed px-4 py-5 text-center text-[13px] text-muted bg-subtle transition-colors ${over ? 'border-tn-teal' : 'border-[var(--faint)]'}`}
          >
            Drop files here or{' '}
            <button type="button" className={BTN.link} onClick={() => input.current?.click()}>choose files</button>
            <input ref={input} type="file" accept=".json,application/json" multiple hidden onChange={e => { pick(e.target.files); e.target.value = '' }} />
          </div>

          {busy && !results && <p className="m-0 text-[13px] text-muted">Reading {files.length} file{files.length === 1 ? '' : 's'}…</p>}
          {error && <p className={`m-0 text-[13px] ${ERROR_TEXT}`} role="alert">{error}</p>}

          {results && (
            <ul className="m-0 p-0 list-none">
              {results.map((r, i) => (
                <li key={`${r.name}-${i}`} className="flex items-center gap-3 py-2.5 border-b border-[var(--row-rule)] last:border-0 text-[13px]">
                  <span className="w-[38px] shrink-0 font-(family-name:--font-display) font-extrabold text-[12px] text-muted">{r.client ?? ''}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold text-tn-ink [overflow-wrap:anywhere]">{r.topic ?? r.name}</span>
                    <span className="block text-[12px] text-muted [overflow-wrap:anywhere]">{r.topic ? `${r.name} · ` : ''}{r.note}</span>
                  </span>
                  <Pill tone={TONE[r.status]} text={WORD[r.status]} />
                </li>
              ))}
            </ul>
          )}

          {done !== null && (
            <p className="m-0 text-[13px] text-tn-ink font-semibold" role="status">
              {done ? `Imported ${done} topic${done === 1 ? '' : 's'}.` : 'Nothing to import: every topic is already up to date.'}
            </p>
          )}

          <div className="flex justify-end gap-2.5 pt-1">
            {done !== null ? (
              <button type="button" className={BTN.navy} onClick={close}>Done</button>
            ) : (
              <>
                <button type="button" className={BTN.white} onClick={close}>Cancel</button>
                <button type="button" className={`${BTN.navy} disabled:opacity-50 disabled:cursor-default`} disabled={busy || !toImport} onClick={() => void send('commit', files)}>
                  <UploadIcon tone="navy" />{busy && results ? 'Importing…' : `Import ${toImport} topic${toImport === 1 ? '' : 's'}`}
                </button>
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  )
}
