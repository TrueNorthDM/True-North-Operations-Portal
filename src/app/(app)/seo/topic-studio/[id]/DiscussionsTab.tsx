'use client'

/**
 * Discussions (Topic Studio, phase 4): what real people ask and feel about the
 * topic. The SEO opens a search (forums, Reddit, Quora and so on), captures a few
 * helpful threads the same way as competitor pages (the bookmark button's JSON,
 * a copied thread or copied text pasted into the box), and Claude will summarize
 * the insights in phase 3. The browser reads the clipboard, the server checks
 * and stores it.
 */

import { Icon, ICON } from '@/components/clocky/entries/ui'
import { BTN } from '@/lib/ui/buttons'
import { CARD, CARD_TITLE, SECTION_TITLE } from '@/lib/ui/type'
import { parseCapture } from '@/lib/topic-studio/capture'
import type { DiscussionsView } from '@/lib/topic-studio/discussions'
import { removeDiscussion, saveDiscussion } from '../actions-research'
import { useTopicCall } from './use-topic-call'

/** A server action takes about a megabyte; a capture that big is a page, not a thread. */
const MAX_BYTES = 900_000
const n = (v: number) => v.toLocaleString('en-US')

export function DiscussionsTab({ id, view, searches }: { id: string; view: DiscussionsView; searches: { label: string; href: string }[] }) {
  const { call, busy, say, toast } = useTopicCall()

  async function paste(e: React.ClipboardEvent<HTMLElement>) {
    e.preventDefault()
    const txt = e.clipboardData.getData('text/plain')
    const html = e.clipboardData.getData('text/html')
    const cap = parseCapture(txt, html, '')
    if (!cap || !cap.blocks.length) { say('Nothing to capture in that paste.', true); return }
    if (JSON.stringify(cap).length > MAX_BYTES) { say('That page is too long to capture. Copy just the thread text and paste again.', true); return }
    // The server's firewall refuses text that holds a classic script-injection sample (tested 5 November 2026): say so rather than "check your connection".
    const r = await call(() => saveDiscussion(id, cap, /<[a-z]/i.test(html)), { fail: 'The server did not accept that page. If it contains sample code, such as a script alert, copy the thread text without it and paste again.' })
    if (r) say(`Discussion added: ${n(r.words)} words.`)
    ;(e.target as HTMLElement).blur()
  }

  // The paste box shows its hint and takes no typing: only a paste goes in.
  const guardKeys = (e: React.KeyboardEvent) => { if (!(e.ctrlKey || e.metaKey) && !['Tab', 'Shift', 'Escape'].includes(e.key)) e.preventDefault() }

  return (
    <div className="space-y-6">
      {toast}
      <section className={`${CARD} p-5`}>
        <h2 className={`${SECTION_TITLE} mb-1`}>Social discussions</h2>
        <p className="m-0 mb-3 text-[13px] text-muted leading-normal">What real people ask and feel about this topic. Open a search, capture a few helpful threads the same way as competitors, then let Claude summarize the insights.</p>
        <div className="mb-4 flex flex-wrap gap-2">
          {searches.map(s => <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className={BTN.smallWhite}>{s.label}</a>)}
        </div>
        <div
          contentEditable suppressContentEditableWarning role="textbox" aria-label="Paste a discussion thread" tabIndex={0}
          onPaste={e => void paste(e)} onKeyDown={guardKeys} onDrop={e => e.preventDefault()}
          className="rounded-[12px] border-[1.5px] border-dashed border-[var(--faint)] bg-subtle px-4 py-6 text-center text-[13px] text-muted outline-none focus:border-tn-teal cursor-text"
        >Click here, then paste a captured thread</div>
        {view.full && <p className="m-0 mt-3 text-[12.5px] text-muted">This topic keeps up to 40 threads. Remove one to add another.</p>}
      </section>

      {view.total > 0 && (
        <section className={`${CARD} p-5`}>
          <h3 className={`${CARD_TITLE} mb-1`}>Captured threads <span className="text-[12.5px] font-normal text-muted">{view.total} · {n(view.words)} words</span></h3>
          <ul className="m-0 list-none p-0">
            {view.rows.map(r => (
              <li key={r.key} className="flex items-start gap-3 border-b border-[var(--row-rule)] py-3 text-[13px] last:border-0">
                <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                  {r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-tn-teal hover:underline">{r.title}</a> : <b className="text-tn-ink">{r.title}</b>}
                  <span className="block text-[12px] text-muted">{[r.domain, `${n(r.words)} words`].filter(Boolean).join(' · ')}</span>
                  {r.lines.length > 0 && <span className="mt-1 block text-[12px] leading-normal text-muted">{r.lines.join(' ')}</span>}
                </span>
                <button type="button" className={BTN.icon} disabled={busy} aria-label={`Remove the thread ${r.title}`} onClick={() => void call(() => removeDiscussion(id, r.key), { ok: 'Discussion removed.' })}>
                  <Icon d={ICON.close} size={15} />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" className={`${BTN.smallWhite} opacity-60`} disabled title="Needs the Anthropic key">Summarize with Claude</button>
            <span className="text-[11.5px] text-muted">Phase 3</span>
          </div>
        </section>
      )}
    </div>
  )
}
