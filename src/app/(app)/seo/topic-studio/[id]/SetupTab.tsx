'use client'

/**
 * Setup (Topic Studio, phase 1): the topic and its keyphrases, what the search
 * engines and AI tools answer, and the competitor addresses. Saves as you go:
 * a text field after a short pause, a choice at once. Archiving or deleting the
 * topic is at the foot.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { withViewAs } from '@/components/ViewAsKeeper'
import { LabeledSelect, SaveError, TEXTAREA } from '@/components/clocky/entries/ui'
import { useConfirm } from '@/components/ui/useConfirm'
import { BTN } from '@/lib/ui/buttons'
import { INPUT } from '@/lib/ui/fields'
import { CARD, FIELD_LABEL, SECTION_TITLE } from '@/lib/ui/type'
import { ROUTES } from '@/lib/nav/routes'
import { AI_KEYS, AI_LABEL, type AiKey } from '@/lib/topic-studio/project'
import { deleteTopic, editTopic, saveSetup, type SetupFields } from '../actions'
import { useTopicCall } from './use-topic-call'

export interface SetupProps {
  id: string
  client: string
  clients: { code: string; name: string }[]
  topic: string
  primary: string
  monday: string
  secondary: string
  avoid: string
  ai: Record<AiKey, string>
  organic: string[]
  cited: string[]
  archived: boolean
}

type Text = 'topic' | 'primary' | 'monday' | 'secondary' | 'avoid' | AiKey
const PAUSE = 800

const Field = ({ id, label, hint, children }: { id: string; label: React.ReactNode; hint?: string; children: React.ReactNode }) => (
  <div className="min-w-0">
    <label htmlFor={id} className={`${FIELD_LABEL} block mb-1.5`}>{label}</label>
    {children}
    {hint && <p className="m-0 mt-1.5 text-[12px] text-muted leading-normal">{hint}</p>}
  </div>
)

const ext = <span aria-hidden="true">↗</span>

export function SetupTab(props: SetupProps) {
  const { id } = props
  const router = useRouter()
  const { call, busy, toast } = useTopicCall()
  const [confirmDialog, confirm] = useConfirm()
  const [vals, setVals] = useState<Record<Text, string>>({
    topic: props.topic, primary: props.primary, monday: props.monday, secondary: props.secondary, avoid: props.avoid, ...props.ai,
  })
  const [organic, setOrganic] = useState<string[]>(() => Array.from({ length: 10 }, (_, i) => props.organic[i] ?? ''))
  const [cited, setCited] = useState<string[]>(() => (props.cited.length ? props.cited : []))
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  // Saves one field. A title or keyphrase change also refreshes the header.
  async function save(field: Text | 'organic' | 'cited' | 'client', value: SetupFields[keyof SetupFields], header = false) {
    setState('saving'); setError(null)
    const r = await call(() => saveSetup(id, { [field]: value } as SetupFields), { refresh: header })
    if (r) setState('saved')
    else { setState('idle'); setError('That change was not saved.') }
  }

  const later = (key: string, fn: () => void) => {
    const t = timers.current.get(key)
    if (t) clearTimeout(t)
    timers.current.set(key, setTimeout(() => { timers.current.delete(key); fn() }, PAUSE))
  }
  useEffect(() => () => { for (const t of timers.current.values()) clearTimeout(t) }, [])

  // One handler for every text field: the field's name is on the element.
  const edit = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const k = e.target.dataset.field as Text
    const v = e.target.value
    setVals(s => ({ ...s, [k]: v }))
    later(k, () => void save(k, v, k === 'topic' || k === 'primary'))
  }
  const editUrls = (kind: 'organic' | 'cited', next: string[]) => {
    if (kind === 'organic') setOrganic(next); else setCited(next)
    later(kind, () => void save(kind, kind === 'cited' ? next.map(u => u.trim()).filter(Boolean) : next.map(u => u.trim())))
  }
  // A list of addresses pasted into one box fills it and the boxes below.
  const pasteUrls = (kind: 'organic' | 'cited', i: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text/plain')
    if (!/\n/.test(text.trim())) return
    e.preventDefault()
    const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
    const base = kind === 'organic' ? [...organic] : [...cited]
    lines.forEach((u, k) => { if (kind === 'organic' ? i + k < 10 : i + k < 40) base[i + k] = u })
    editUrls(kind, base)
  }

  const q = encodeURIComponent(vals.primary || vals.topic)
  const links: Record<AiKey, string> = useMemo(() => ({
    aiOverview: `https://www.google.com/search?q=${q}`,
    aiChatgpt: `https://chatgpt.com/?q=${q}&hints=search&temporary-chat=true`,
    aiGemini: 'https://gemini.google.com/app',
    aiPerplexity: `https://www.perplexity.ai/search?q=${q}`,
  }), [q])
  const aiPlaceholder: Record<AiKey, string> = {
    aiOverview: 'Paste the full AI Overview answer without formatting',
    aiChatgpt: 'Paste ChatGPT’s answer without formatting',
    aiGemini: 'Paste Gemini’s answer without formatting',
    aiPerplexity: 'Paste Perplexity’s answer without formatting',
  }

  const archive = async () => {
    if (await call(() => editTopic(id, { op: 'archive', archived: true }), { refresh: false })) router.push(withViewAs(ROUTES.topicStudio))
  }
  const remove = async () => {
    const yes = await confirm({ title: 'Delete this topic?', body: 'This removes the brief, the captured pages and the history for everyone. It cannot be undone.', action: 'Delete topic', danger: true })
    if (!yes) return
    if (await call(() => deleteTopic(id), { refresh: false })) router.push(withViewAs(ROUTES.topicStudio))
  }

  const rows = (kind: 'organic' | 'cited') => {
    const list = kind === 'organic' ? organic : cited
    const n = kind === 'organic' ? 10 : Math.max(3, list.length + 1)
    return Array.from({ length: n }, (_, i) => (
      <div key={i} className="flex items-center gap-2">
        <span className="w-6 shrink-0 text-right text-[12px] text-muted tabular-nums">{kind === 'organic' ? i + 1 : ''}</span>
        <input
          className={`${INPUT} flex-1 min-w-0`} value={list[i] ?? ''} inputMode="url" placeholder="https://"
          aria-label={kind === 'organic' ? `Organic result ${i + 1}` : `Cited address ${i + 1}`}
          onChange={e => { const next = [...list]; next[i] = e.target.value; while (next.length <= i) next.push(''); editUrls(kind, next) }}
          onPaste={e => pasteUrls(kind, i, e)}
        />
      </div>
    ))
  }

  return (
    <div className="space-y-6">
      {toast}{confirmDialog}
      <section className={`${CARD} p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <h2 className={SECTION_TITLE}>Topic and keyphrases</h2>
          <span className="text-[12px] text-muted" role="status" aria-live="polite">{state === 'saving' ? 'Saving…' : state === 'saved' ? 'All changes saved' : 'Changes save as you type'}</span>
        </div>
        <p className="m-0 mb-4 text-[13px] text-muted leading-normal">The Monday task name, primary keyphrase and secondary keyphrases help rank the topic terms. Terms matching the specific terms to avoid are left out. After changing these, rebuild the list in Topic terms.</p>
        <SaveError text={error} />
        <div className="grid gap-4 md:grid-cols-[1fr_2fr] mt-3">
          <LabeledSelect label="Client" value={props.client} options={props.clients.map(c => ({ value: c.code, label: `${c.code} · ${c.name}` }))} onChange={v => void save('client', v, true)} disabled={busy} />
          <Field id="s-topic" label="Monday task name"><input id="s-topic" className={`${INPUT} w-full`} value={vals.topic} data-field="topic" onChange={edit} maxLength={300} /></Field>
          <Field id="s-primary" label="Primary keyphrase"><input id="s-primary" className={`${INPUT} w-full`} value={vals.primary} data-field="primary" onChange={edit} maxLength={300} /></Field>
          <Field id="s-monday" label="Monday task link" hint="Links this brief back to its task in Monday.">
            <input id="s-monday" className={`${INPUT} w-full`} value={vals.monday} data-field="monday" onChange={edit} inputMode="url" placeholder="https://truenorth.monday.com/boards/…" />
          </Field>
          <Field id="s-secondary" label={<>Secondary keyphrases <span className="font-normal normal-case tracking-normal">(one per line)</span></>} hint="Terms sharing these words rank a little higher.">
            <textarea id="s-secondary" className={`${TEXTAREA} min-h-[132px]`} value={vals.secondary} data-field="secondary" onChange={edit} placeholder="One keyphrase per line" />
          </Field>
          <Field id="s-avoid" label={<>Specific terms to avoid <span className="font-normal normal-case tracking-normal">(one per line)</span></>} hint="Terms containing these, or built from their distinctive words, are left out. Words that are part of the topic itself are kept.">
            <textarea id="s-avoid" className={`${TEXTAREA} min-h-[132px]`} value={vals.avoid} data-field="avoid" onChange={edit} placeholder="One word or phrase per line" />
          </Field>
        </div>
      </section>

      <section className={`${CARD} p-5`}>
        <h2 className={`${SECTION_TITLE} mb-1`}>Search and AI answers</h2>
        <p className="m-0 mb-4 text-[13px] text-muted leading-normal">Search the primary keyphrase in an incognito window, then paste what you see. Duplicates are removed automatically, and AI Overview citations that are not in the top 10 are still analyzed.</p>
        <div className="grid gap-4 md:grid-cols-2">
          {AI_KEYS.map(k => (
            <Field key={k} id={`s-${k}`} label={<a href={links[k]} target="_blank" rel="noopener noreferrer" className="text-tn-teal hover:underline normal-case tracking-normal text-[12px]">{AI_LABEL[k]} answer {ext}<span className="sr-only"> (opens in a new tab)</span></a>}>
              <textarea id={`s-${k}`} className={`${TEXTAREA} min-h-[170px]`} value={vals[k]} data-field={k} onChange={edit} placeholder={aiPlaceholder[k]} />
            </Field>
          ))}
        </div>
        <p className="m-0 mt-3 text-[12px] text-muted leading-normal">Click a name to open it in a new tab with the primary keyphrase ready to ask; for Gemini, paste the keyphrase yourself. Web pages cannot open private windows, so for a clean session right-click the name and choose “Open link in incognito window”. All four answers are needed before building the topic terms. If Google does not show an AI Overview for the keyphrase, type “none” in that box. Terms the AI answers use rank higher.</p>
      </section>

      <section className={`${CARD} p-5`}>
        <div className="grid gap-6 md:grid-cols-2">
          <div role="group" aria-labelledby="lbl-organic">
            <div id="lbl-organic" className={`${FIELD_LABEL} mb-1.5`}>Top 10 organic URLs <span className="font-normal normal-case tracking-normal">(in rank order)</span></div>
            <div className="space-y-2">{rows('organic')}</div>
          </div>
          <div role="group" aria-labelledby="lbl-cited">
            <div id="lbl-cited" className={`${FIELD_LABEL} mb-1.5`}>AI Overview cited URLs <span className="font-normal normal-case tracking-normal">(every source it cites)</span></div>
            <div className="space-y-2">{rows('cited')}</div>
            <button type="button" className={`${BTN.link} mt-2`} onClick={() => setCited(c => [...c, ''])}>+ Add another</button>
            <p className="m-0 mt-3 text-[12px] text-muted leading-normal">Tip: paste a whole list of addresses into any box and it fills that box and the ones below it. Next, capture each page’s content in the Competitors tab.</p>
            <div className="mt-3"><Link href={`/seo/topic-studio/${id}?tab=competitors`} className={BTN.navy}>Go to Competitors</Link></div>
          </div>
        </div>
      </section>

      <section className={`${CARD} p-5`}>
        <h2 className={`${SECTION_TITLE} mb-1`}>Archive or remove this topic</h2>
        <p className="m-0 mb-3 text-[13px] text-muted leading-normal">Archiving hides the topic from the topic list and from writers; you can restore it from the list. Deleting removes the brief, captured pages and history for everyone and cannot be undone.</p>
        <div className="flex flex-wrap gap-2.5">
          <button type="button" className={BTN.white} onClick={() => void archive()} disabled={busy || props.archived}>Archive topic</button>
          <button type="button" className={BTN.whiteDanger} onClick={() => void remove()} disabled={busy}>Delete topic</button>
        </div>
      </section>
    </div>
  )
}
