'use client'

/**
 * Competitors (Topic Studio, phase 1): the pages ranking for the keyphrase,
 * captured one by one. A capture is the bookmark button's JSON, a copied page
 * or copied article text pasted into a row (or into the box that matches it by
 * address); the browser reads the clipboard, the server checks and stores it.
 * Rows show the words, reading ease and term score of each captured page.
 */

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Pill } from '@/components/ui/Pill'
import { BTN } from '@/lib/ui/buttons'
import { CARD, SECTION_TITLE, TH } from '@/lib/ui/type'
import { bookmarkletHref, parseCapture } from '@/lib/topic-studio/capture'
import type { CompetitorsView } from '@/lib/topic-studio/views'
import { removeCapture, saveCapture } from '../actions'
import { useTopicCall } from './use-topic-call'

/** A server action takes about a megabyte; a capture that big is a page, not an article. */
const MAX_BYTES = 900_000
const n = (v: number) => v.toLocaleString('en-US')

export function CompetitorsTab({ id, view }: { id: string; view: CompetitorsView }) {
  const { call, busy, say, toast } = useTopicCall()
  const [open, setOpen] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const bm = useRef<HTMLAnchorElement>(null)

  // React refuses javascript: addresses in href, so the bookmark button gets its address directly.
  useEffect(() => { bm.current?.setAttribute('href', bookmarkletHref()) }, [])

  async function paste(e: React.ClipboardEvent<HTMLElement>, target: number | 'any', domain: string) {
    e.preventDefault()
    const txt = e.clipboardData.getData('text/plain')
    const html = e.clipboardData.getData('text/html')
    const cap = parseCapture(txt, html, domain)
    if (!cap || !cap.blocks.length) { say('Nothing to capture in that paste. Copy the article text or use the capture button.', true); return }
    if (JSON.stringify(cap).length > MAX_BYTES) { say('That page is too long to capture. Copy just the article text and paste again.', true); return }
    // The server's firewall refuses text that holds a classic script-injection sample (tested 5 November 2026): say so rather than "check your connection".
    const r = await call(() => saveCapture(id, cap, /<[a-z]/i.test(html), target), { fail: 'The server did not accept that page. If it contains sample code, such as a script alert, copy the article text without it and paste again.' })
    if (r) say([`Saved ${n(r.words)} words for ${r.label}.`, ...r.notes].join(' '))
    ;(e.target as HTMLElement).blur()
  }

  // The paste box shows its hint and takes no typing: only a paste goes in.
  const guardKeys = (e: React.KeyboardEvent) => { if (!(e.ctrlKey || e.metaKey) && !['Tab', 'Shift', 'Escape'].includes(e.key)) e.preventDefault() }

  const copyCode = async () => {
    try { await navigator.clipboard.writeText(bookmarkletHref()); setCopied(true); setTimeout(() => setCopied(false), 3000) } catch { say('Could not copy the code. Drag the button to your bookmarks bar instead.', true) }
  }

  const { rows, done, total } = view
  return (
    <div className="space-y-6">
      {toast}
      <section className={`${CARD} p-5`}>
        <h2 className={`${SECTION_TITLE} mb-1`}>Capture competitor pages</h2>
        <p className="m-0 mb-3 text-[13px] text-muted leading-normal">Capturing takes one click per page. Open each competitor, click the capture button in your bookmarks bar, come back and paste anywhere below. Headings, links and body text are kept; menus, footers and comments are dropped.</p>
        <details className="mb-4">
          <summary className="cursor-pointer text-[13px] font-semibold text-tn-teal">Set up the capture button (one time)</summary>
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[12px] bg-subtle p-3.5">
            <a ref={bm} href="#" draggable onClick={e => { e.preventDefault(); say('Drag this button to your bookmarks bar. Clicking it here does nothing.') }} className={BTN.navy}>Capture for Topic Studio</a>
            <p className="m-0 flex-1 min-w-[220px] text-[12.5px] text-muted leading-normal">
              Drag this button to your bookmarks bar once. Cannot drag? <button type="button" className={BTN.link} onClick={() => void copyCode()}>{copied ? 'Copied' : 'Copy the code'}</button> and create a bookmark with it as the address. No button? Select the article text on the page, copy it and paste it into the row instead.
            </p>
          </div>
        </details>

        {total > 0 ? (
          <>
            <div
              contentEditable suppressContentEditableWarning role="textbox" aria-label="Paste any capture" tabIndex={0}
              onPaste={e => void paste(e, 'any', '')} onKeyDown={guardKeys} onDrop={e => e.preventDefault()}
              className="rounded-[12px] border-[1.5px] border-dashed border-[var(--faint)] bg-subtle px-4 py-4 text-center text-[13px] text-muted outline-none focus:border-tn-teal cursor-text"
            >Click here, then paste. A capture is matched to the right competitor automatically.</div>
            <div className="mt-5 flex flex-wrap gap-x-9 gap-y-3">
              <Stat value={`${done}/${total}`} label="pages captured" />
              <Stat value={n(view.words.med)} label="median words" />
              <Stat value={`${n(view.words.lo)}-${n(view.words.hi)}`} label="typical range" />
              {view.avgScore != null && <Stat value={String(view.avgScore)} label="average term score" />}
            </div>
          </>
        ) : (
          <div className="rounded-[12px] bg-subtle px-4 py-4 text-[13px] text-muted">Add the competitor addresses in Setup first. <Link href={`/seo/topic-studio/${id}?tab=setup`} className="text-tn-teal font-semibold hover:underline">Open Setup</Link></div>
        )}
      </section>

      {total > 0 && (
        <section className={CARD}>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr>
                  <th className={TH}>Rank</th><th className={TH}>Page</th>
                  <th className={`${TH} text-right`}>Words</th><th className={`${TH} text-right`}>Flesch</th><th className={`${TH} text-right`}>Term score</th><th className={TH}>Content</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <RowFragment key={r.i}>
                    <tr className="border-b border-[var(--row-rule)] last:border-0 align-top hover:bg-[var(--row-hover)]">
                      <td className="px-4 py-3 text-muted tabular-nums whitespace-nowrap">{r.rank ? `#${r.rank}` : <Pill tone="amber" text="AIO" />}</td>
                      <td className="px-4 py-3 min-w-[220px]">
                        <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-tn-teal hover:underline">{r.domain}</a>
                        {r.cited && <span className="ml-2 align-middle"><Pill tone="green" text="AIO cited" tip="Cited in the AI Overview" /></span>}
                        <div className="text-[12px] text-muted [overflow-wrap:anywhere]">{r.title.length > 90 ? `${r.title.slice(0, 90)}…` : r.title}</div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.captured ? n(r.words) : '-'}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.captured && r.flesch != null ? r.flesch : '-'}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.score != null ? <><b className="text-tn-ink">{r.score}</b> <span className="text-muted text-[12px]">{r.grade}</span></> : '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {r.captured ? (
                          <span className="inline-flex items-center gap-1">
                            <Pill tone="green" text="Captured" />
                            <button type="button" className={BTN.icon} aria-label={`Show the heading outline of ${r.domain}`} aria-expanded={open === r.i} onClick={() => setOpen(open === r.i ? null : r.i)}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
                            </button>
                            <button type="button" className={BTN.icon} aria-label={`Remove the capture of ${r.domain}`} disabled={busy} onClick={() => void call(() => removeCapture(id, r.url), { ok: 'Capture removed.' })}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
                            </button>
                          </span>
                        ) : (
                          <div
                            contentEditable suppressContentEditableWarning role="textbox" tabIndex={0} aria-label={`Paste the capture for ${r.domain}`}
                            onPaste={e => void paste(e, r.i, r.domain)} onKeyDown={guardKeys} onDrop={e => e.preventDefault()}
                            className="inline-block min-w-[130px] rounded-[8px] border border-dashed border-[var(--faint)] px-3 py-1.5 text-[12px] text-muted outline-none focus:border-tn-teal cursor-text"
                          >Click, then paste</div>
                        )}
                      </td>
                    </tr>
                    {open === r.i && r.captured && (
                      <tr className="border-b border-[var(--row-rule)] bg-subtle">
                        <td />
                        <td colSpan={5} className="px-4 py-3">
                          {r.headings.length
                            ? <ul className="m-0 p-0 list-none space-y-1">{r.headings.map((h, k) => <li key={k} style={{ paddingLeft: `${(h.l - 1) * 16}px` }} className="text-[12.5px]"><span className="text-muted">H{h.l} · </span>{h.t}</li>)}</ul>
                            : <span className="text-muted text-[12.5px]">No headings found. Paste the page as formatted text or use the capture button to keep headings.</span>}
                        </td>
                      </tr>
                    )}
                  </RowFragment>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-[var(--panel-border)] px-4 py-3">
            {!view.hasTerms && done > 0 && <span className="text-[12px] text-muted">Scores appear once you build the topic term list.</span>}
            {done > 0 && <Link href={`/seo/topic-studio/${id}?tab=terms`} className={`${BTN.navy} ml-auto`}>Build topic terms</Link>}
          </div>
        </section>
      )}
    </div>
  )
}

const RowFragment = ({ children }: { children: React.ReactNode }) => <>{children}</>

const Stat = ({ value, label }: { value: string; label: string }) => (
  <div className="flex flex-col">
    <b className="font-(family-name:--font-display) font-extrabold text-[24px] leading-tight text-tn-ink tabular-nums">{value}</b>
    <span className="text-[12px] text-muted">{label}</span>
  </div>
)
