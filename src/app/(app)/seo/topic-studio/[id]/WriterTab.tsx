'use client'

/**
 * The writer workshop (Topic Studio, phase 2): the draft on the left, the
 * guidance panels on the right. The draft saves itself a moment after the writer
 * pauses, one save at a time, each naming the version it started from; if someone
 * else saved in between, nothing is overwritten and a banner offers to reload
 * their version or keep this one. Version history and the term-in-context drawer
 * open over the page. SEOs and writers use the same screen.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useIsClient } from '@/components/clocky/entries/ui'
import { failText } from '@/lib/ui/action-error'
import { BTN } from '@/lib/ui/buttons'
import { CARD } from '@/lib/ui/type'
import { draftBlocksFromHtml } from '@/lib/topic-studio/draft-client'
import { analyzeDraft, highlightSpecs, type WorkshopModel } from '@/lib/topic-studio/workshop'
import { saveDraft } from '../actions'
import type { AiResults } from '@/lib/topic-studio/ai/results'
import { NO_AI, type AiInfo } from './AiBtn'
import { TermDrawer } from './TermDrawer'
import { useTopicCall } from './use-topic-call'
import { VersionHistory } from './VersionHistory'
import { WriterEditor, type EditorHandle, type SaveState } from './WriterEditor'
import { WriterPanels } from './WriterPanels'

export interface WriterTabProps {
  id: string
  /** The draft as the server keeps it (sanitized there), or what an import brought. */
  initialHtml: string
  /** The save counter the draft was read at. */
  version: number
  model: WorkshopModel
  ai?: AiInfo
  results?: Pick<AiResults, 'review' | 'placements'>
}

const clock = (t: number) => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

export function WriterTab({ id, initialHtml, version, model, ai = NO_AI, results }: WriterTabProps) {
  const client = useIsClient()
  const { call, say, toast } = useTopicCall()
  const api = useRef<EditorHandle>(null)
  const base = useRef(version)
  const saved = useRef<string | null>(null)
  const latest = useRef('')
  const chain = useRef<Promise<void>>(Promise.resolve())
  const [html, setHtml] = useState(initialHtml)
  const [save, setSave] = useState<{ state: SaveState; at: number | null }>({ state: initialHtml ? 'saved' : 'idle', at: null })
  const [conflict, setConflict] = useState<{ version: number } | null>(null)
  const [history, setHistory] = useState(false)
  const [term, setTerm] = useState<{ key: string; label: string } | null>(null)

  // The panels read the draft in the browser (the sanitizer and the editor need a DOM).
  const blocks = useMemo(() => (client ? draftBlocksFromHtml(html) : []), [client, html])
  const report = useMemo(() => (client ? analyzeDraft(model, blocks) : null), [client, model, blocks])
  const specs = useMemo(() => highlightSpecs(model), [model])

  const commit = useCallback((next: string) => {
    latest.current = next
    setHtml(next)
    // One save at a time: the next one starts from the version the last one made.
    chain.current = chain.current.then(async () => {
      if (next === saved.current) return
      setSave(s => ({ state: 'saving', at: s.at }))
      try {
        const r = await saveDraft(id, next, base.current)
        if (!r.ok) { setSave(s => ({ state: 'error', at: s.at })); say(r.error, true); return }
        if (r.saved) { base.current = r.version; saved.current = next; setConflict(null); setSave({ state: 'saved', at: Date.now() }) }
        else { setConflict({ version: r.version }); setSave(s => ({ state: 'error', at: s.at })) }
      } catch (e) {
        setSave(s => ({ state: 'error', at: s.at }))
        say(failText(e), true)
      }
    })
  }, [id, say])

  const beforeSave = useCallback(async () => { api.current?.flush(); await chain.current }, [])

  async function saveNow() {
    await beforeSave()
    const { saveVersionNow } = await import('../actions')
    await call(() => saveVersionNow(id), { refresh: false, ok: 'Version saved.' })
  }

  // What was typed reaches the server when the writer leaves the tab or the page.
  useEffect(() => {
    const flush = () => api.current?.flush()
    const hide = () => { if (document.visibilityState === 'hidden') flush() }
    document.addEventListener('visibilitychange', hide)
    window.addEventListener('pagehide', flush)
    return () => { document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', flush) }
  }, [])

  const saveText = save.state === 'saving' ? 'Saving…' : save.state === 'error' ? 'Could not save' : save.at ? `Saved ${clock(save.at)}` : html ? 'Saved' : ''

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      {toast}
      <section className={`${CARD} min-w-0`}>
        {conflict && (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-t-[14px] border-b border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-[13px] text-[#92400e]">
            <span className="flex-1 min-w-[220px]">Someone else saved this draft after you opened it, so your latest changes were not saved. Reload to see their version, or keep yours to replace it.</span>
            <button type="button" className={BTN.smallWhite} onClick={() => location.reload()}>Reload their version</button>
            <button type="button" className={BTN.smallNavy} onClick={() => { base.current = conflict.version; commit(latest.current || api.current?.html() || '') }}>Keep mine</button>
          </div>
        )}
        <WriterEditor
          initialHtml={initialHtml} specs={specs} onChange={commit} onSaveNow={() => void saveNow()} onHistory={() => setHistory(true)}
          saveText={saveText} saveState={save.state} apiRef={api}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-b-[14px] border-t border-[var(--panel-border)] px-4 py-2.5 text-[12px] text-muted">
          <span aria-live="polite">{saveText || 'Your draft saves automatically as you type.'}</span>
          <button type="button" className={BTN.link} onClick={() => setHistory(true)}>Version history</button>
        </div>
      </section>

      <aside className="min-w-0 lg:sticky lg:top-[calc(var(--chrome-top)+16px)] lg:max-h-[calc(100vh-var(--chrome-top)-32px)] lg:overflow-y-auto lg:pr-1" aria-label="Guidance for your draft">
        <WriterPanels id={id} model={model} report={report} blocks={blocks} html={html} onTerm={setTerm} ai={ai} results={results} />
      </aside>

      {history && (
        <VersionHistory
          id={id} beforeSave={beforeSave} onClose={() => setHistory(false)}
          onRestored={(restored, v) => { base.current = v; saved.current = restored; api.current?.load(restored); setSave({ state: 'saved', at: Date.now() }) }}
        />
      )}
      {term && <TermDrawer id={id} term={term} onClose={() => setTerm(null)} onError={m => say(m, true)} />}
    </div>
  )
}
