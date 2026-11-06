'use client'

/**
 * Originality (Topic Studio, phase 4): what every competitor already says, what
 * only one says, what nobody covers, how this article can stand out, and the
 * questions to put to a subject-matter expert. Claude drafts the map and the
 * interview prompts; the SEO edits the lists by hand and the brief carries them.
 */

import { useState } from 'react'
import { Icon, ICON } from '@/components/clocky/entries/ui'
import { BTN } from '@/lib/ui/buttons'
import { INPUT } from '@/lib/ui/fields'
import { CARD, CARD_TITLE, SECTION_TITLE } from '@/lib/ui/type'
import type { Point } from '@/lib/topic-studio/ai/results'
import type { OriginalityView } from '@/lib/topic-studio/originality'
import { saveOriginality } from '../actions-originality'
import { AiBtn, NO_AI, type AiInfo } from './AiBtn'
import { useTopicCall } from './use-topic-call'

const Sub = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
  <section className={`${CARD} p-4`}>
    <h3 className={CARD_TITLE}>{title}</h3>
    {hint && <p className="m-0 mt-1 mb-3 text-[12.5px] leading-normal text-muted">{hint}</p>}
    {children}
  </section>
)

function Points({ rows, empty, why }: { rows: Point[]; empty: string; why?: boolean }) {
  if (!rows.length) return <p className="m-0 text-[12.5px] text-muted">{empty}</p>
  return (
    <ul className="m-0 list-none p-0">
      {rows.map(p => (
        <li key={p.point} className="border-b border-[var(--row-rule)] py-2 text-[13px] last:border-0">
          <span className="[overflow-wrap:anywhere] text-tn-ink">{p.point}</span>
          {(p.sources?.length || p.source) && <span className="block text-[12px] text-muted">{p.sources?.join(', ') ?? p.source}</span>}
          {why && p.why && <span className="block text-[12px] text-muted">{p.why}</span>}
        </li>
      ))}
    </ul>
  )
}

/** A list the SEO edits by hand: add a line, remove a line; each change saves the whole list. */
function Editable({ id, field, items, placeholder, empty }: { id: string; field: 'opps' | 'angle' | 'interviewManual'; items: string[]; placeholder: string; empty: string }) {
  const { call, busy, toast } = useTopicCall()
  const [text, setText] = useState('')
  const save = (next: string[], ok?: string) => call(() => saveOriginality(id, { [field]: next }), { ok })
  async function add() {
    const t = text.trim()
    if (!t || items.includes(t)) return
    if (await save([...items, t])) setText('')
  }
  return (
    <div>
      {toast}
      {items.length ? (
        <ul className="m-0 list-none p-0">
          {items.map(x => (
            <li key={x} className="flex items-start gap-2 border-b border-[var(--row-rule)] py-2 text-[13px] last:border-0">
              <span className="min-w-0 flex-1 [overflow-wrap:anywhere] text-tn-ink">{x}</span>
              <button type="button" className={BTN.icon} disabled={busy} aria-label={`Remove: ${x}`} onClick={() => void save(items.filter(i => i !== x))}><Icon d={ICON.close} size={15} /></button>
            </li>
          ))}
        </ul>
      ) : <p className="m-0 text-[12.5px] text-muted">{empty}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <input className={`${INPUT} min-w-[220px] flex-1`} placeholder={placeholder} aria-label={placeholder} value={text} maxLength={600} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void add() }} />
        <button type="button" className={BTN.smallNavy} disabled={busy || !text.trim()} onClick={() => void add()}>Add</button>
      </div>
    </div>
  )
}

export function OriginalityTab({ id, view, ai = NO_AI }: { id: string; view: OriginalityView; ai?: AiInfo }) {
  const c = view.commodity
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className={SECTION_TITLE}>Originality</h2>
          <p className="m-0 mt-1 text-[13px] leading-normal text-muted">Find what every competitor repeats, so the article does not just repeat it too, and what nobody covers. {view.clientOrig ? `For this client, original material means: ${view.clientOrig}` : ''}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AiBtn id={id} feature="commodity" ai={ai} label={c ? 'Map again with Claude' : 'Map originality with Claude'} done="Claude mapped what competitors say and where the gaps are." />
          <AiBtn id={id} feature="interview" ai={ai} label={view.interview ? 'Draft interview prompts again' : 'Draft interview prompts'} done="Claude drafted the interview prompts." />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Sub title="What everyone says" hint="Commodity content. Cover it briefly, then go further.">
          <Points rows={c?.baseline ?? []} empty="Not mapped yet. Capture competitors first, then ask Claude." />
        </Sub>
        <Sub title="What only one says" hint="One competitor’s own angle, worth a look.">
          <Points rows={c?.unique ?? []} empty="Nothing yet." />
        </Sub>
        <Sub title="What nobody covers" hint="The gaps this article can fill.">
          <Points rows={c?.gaps ?? []} why empty="Nothing yet." />
        </Sub>
      </div>
      {c?.edited && <p className="m-0 text-[12px] text-muted">The map was edited by hand.</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Sub title="Opportunities to add original value" hint="Tests, data, stories or expert input that only this client can offer.">
          <Editable id={id} field="opps" items={view.opps} placeholder="Add an opportunity" empty="None yet. Claude fills this when it maps originality." />
        </Sub>
        <Sub title="Angle to stand out" hint="How this article is different from the ones already ranking.">
          <Editable id={id} field="angle" items={view.angle} placeholder="Add an angle" empty="None yet." />
        </Sub>
      </div>

      <Sub title="Interview prompts" hint="Questions for a subject-matter expert, and prompts for stories from real customers. These go into the SEO brief.">
        {view.interview && (
          <div className="mb-4 grid gap-4 lg:grid-cols-3">
            <div><h4 className="m-0 mb-1 text-[12.5px] font-bold text-muted">Who to ask</h4><ul className="m-0 list-disc pl-5 text-[13px]">{view.interview.who.map(x => <li key={x}>{x}</li>)}</ul></div>
            <div><h4 className="m-0 mb-1 text-[12.5px] font-bold text-muted">Questions for the expert</h4><ul className="m-0 list-disc pl-5 text-[13px]">{view.interview.sme.map(x => <li key={x}>{x}</li>)}</ul></div>
            <div><h4 className="m-0 mb-1 text-[12.5px] font-bold text-muted">Story prompts</h4><ul className="m-0 list-disc pl-5 text-[13px]">{view.interview.stories.map(x => <li key={x}>{x}</li>)}</ul></div>
          </div>
        )}
        <h4 className="m-0 mb-1 text-[12.5px] font-bold text-muted">Your own questions</h4>
        <Editable id={id} field="interviewManual" items={view.interviewManual} placeholder="Add your own question" empty="None yet." />
      </Sub>
    </div>
  )
}
