'use client'

/**
 * SEO brief (Topic Studio, phase 1): the research of every tab compiled into
 * the brief template. Copy it into the writer's Google Doc, download it as
 * Markdown, or take the term list alone (as bullets or a CSV). SEOs also share
 * the topic with writers from here: a writer sees only shared topics.
 */

import { useState } from 'react'
import { Pill } from '@/components/ui/Pill'
import { Switch } from '@/components/ui/Switch'
import { BTN, BTN_ICON } from '@/lib/ui/buttons'
import { CARD, SECTION_TITLE } from '@/lib/ui/type'
import { editTopic } from '../actions'
import { useTopicCall } from './use-topic-call'

export interface BriefProps {
  id: string
  /** Shown to an SEO only; null for a writer, who cannot change sharing. */
  shared: boolean | null
  html: string
  markdown: string
  termListHtml: string
  termListText: string
  csv: string
  slug: string
  hasTerms: boolean
}

const icon = (d: string, tone: keyof typeof BTN_ICON) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" stroke={BTN_ICON[tone]}><path d={d} /></svg>

/** Rich copy for a Google Doc: formatted text with a plain fallback. */
async function copyRich(html: string, text: string): Promise<boolean> {
  try {
    if (window.ClipboardItem && navigator.clipboard?.write) {
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })])
      return true
    }
  } catch { /* fall through to selecting the text */ }
  const div = document.createElement('div')
  div.contentEditable = 'true'
  div.innerHTML = html
  div.style.cssText = 'position:fixed;left:-9999px;top:0'
  document.body.appendChild(div)
  const range = document.createRange()
  range.selectNodeContents(div)
  const sel = getSelection()
  sel?.removeAllRanges(); sel?.addRange(range)
  let ok = false
  try { ok = document.execCommand('copy') } catch { /* refused */ }
  sel?.removeAllRanges(); div.remove()
  return ok
}

function download(name: string, data: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = document.createElement('a')
  a.href = url; a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function BriefTab(p: BriefProps) {
  const { call, busy, say, toast } = useTopicCall()
  const [open, setOpen] = useState(true)
  const copy = async (html: string, text: string, ok: string) => say(await copyRich(html, text) ? ok : 'Could not copy. Select the brief and copy it by hand.', false)

  return (
    <div className="space-y-6">
      {toast}
      <section className={`${CARD} p-5`}>
        <h2 className={`${SECTION_TITLE} mb-1`}>Brief SEO information</h2>
        <p className="m-0 mb-4 text-[13px] leading-normal text-muted">The compiled SEO research from all tabs into the brief template. Copy the parts into the writer Google Doc template respectively.</p>
        {p.shared !== null && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--row-rule)] pb-4">
            <div>
              <div className="flex items-center gap-2"><b className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">Shared with writers</b>{p.shared ? <Pill tone="green" text="Shared" /> : <Pill tone="gray" text="Not shared" />}</div>
              <div className="text-[12.5px] text-muted">{p.shared ? 'Writers on the Writers team can open this topic and read the brief.' : 'Only the SEO team sees this topic. Share it when the brief is ready.'}</div>
            </div>
            <Switch on={p.shared} label="Shared with writers" disabled={busy} onChange={v => void call(() => editTopic(p.id, { op: 'share', shared: v }), { ok: r => r.message })} />
          </div>
        )}
        <div className="flex flex-wrap gap-2.5">
          <button type="button" className={BTN.navy} onClick={() => void copy(p.html, p.markdown, 'Brief copied. Paste it into the Google Doc.')}>{icon('M9 9h10v10H9zM5 15V5h10', 'navy')}Copy for Google Docs</button>
          {p.hasTerms && <button type="button" className={BTN.white} onClick={() => void copy(p.termListHtml, p.termListText, 'Term list copied as bullets.')}>Copy term list only</button>}
          <button type="button" className={BTN.white} onClick={() => download(`${p.slug}-brief.md`, p.markdown, 'text/markdown;charset=utf-8')}>{icon('M12 4v12M7 11l5 5 5-5M5 20h14', 'white')}Download .md</button>
          {p.hasTerms && <button type="button" className={BTN.white} onClick={() => download(`${p.slug}-terms.csv`, p.csv, 'text/csv;charset=utf-8')}>{icon('M12 4v12M7 11l5 5 5-5M5 20h14', 'white')}Download terms .csv</button>}
        </div>
      </section>

      <section className={`${CARD} p-5`}>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className={SECTION_TITLE}>Brief</h2>
          <button type="button" className={BTN.link} onClick={() => setOpen(o => !o)} aria-expanded={open}>{open ? 'Hide preview' : 'Show preview'}</button>
        </div>
        {/* The brief is built on the server from text that is escaped there (lib/topic-studio/brief.ts). */}
        {open && (
          <div
            className="text-[14px] leading-[1.65] text-foreground [&_a]:text-tn-teal [&_a]:underline [&_h2]:mt-0 [&_h2]:mb-2 [&_h2]:font-(family-name:--font-display) [&_h2]:text-[20px] [&_h2]:font-extrabold [&_h2]:text-tn-ink [&_h3]:mt-5 [&_h3]:mb-1.5 [&_h3]:font-(family-name:--font-display) [&_h3]:text-[15px] [&_h3]:font-extrabold [&_h3]:text-tn-ink [&_li]:my-1 [&_p]:my-2 [&_ul]:my-1 [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: p.html }}
          />
        )}
      </section>
    </div>
  )
}
