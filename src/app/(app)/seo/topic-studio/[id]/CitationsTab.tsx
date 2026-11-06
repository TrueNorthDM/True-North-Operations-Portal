'use client'

/**
 * Citations (Topic Studio, phase 4): what the captured competitor pages cite.
 * For a faith-based client the Bible books and passages they quote; for every
 * client the outside pages they link to and the authorities they name ("according
 * to Mayo Clinic"). Each list is ticked for the SEO brief: the most cited go in
 * until the SEO chooses, a tick adds or drops one, and the SEO can add their own.
 * Writers read the result in the brief.
 */

import { useState } from 'react'
import { Icon, ICON } from '@/components/clocky/entries/ui'
import { Pill } from '@/components/ui/Pill'
import { BTN } from '@/lib/ui/buttons'
import { CHECKBOX, INPUT } from '@/lib/ui/fields'
import { CARD, CARD_TITLE, SECTION_TITLE, TH } from '@/lib/ui/type'
import { CITE_KINDS, citedBy, type CiteList, type CiteRow, type CitationsView, type CuratedOp, type SourceRow } from '@/lib/topic-studio/citations'
import { editTopic } from '../actions'
import { saveCurated } from '../actions-research'
import { useTopicCall } from './use-topic-call'

const PLACEHOLDER = { books: 'Add a book, e.g. Psalms', refs: 'Add a passage, e.g. Psalm 51:10', auth: 'Add an authority, e.g. Mayo Clinic' } as const

const Sub = ({ children, hint }: { children: React.ReactNode; hint?: string }) => (
  <div className="mt-6 first:mt-0">
    <h3 className={CARD_TITLE}>{children}</h3>
    {hint && <p className="m-0 mt-1 mb-3 text-[12.5px] leading-normal text-muted">{hint}</p>}
  </div>
)

export function CitationsTab({ id, view }: { id: string; view: CitationsView }) {
  const { call, busy, toast } = useTopicCall()
  const [typed, setTyped] = useState<Record<string, string>>({})
  const [src, setSrc] = useState({ url: '', title: '' })
  const run = (op: CuratedOp, ok?: string) => call(() => saveCurated(id, op), { ok })

  if (!view.captured) {
    return (
      <div className="space-y-6">
        {toast}
        <section className={`${CARD} p-5`}>
          <h2 className={SECTION_TITLE}>Citations</h2>
          <p className="m-0 mt-3 rounded-[12px] bg-subtle px-4 py-3 text-[13px] text-muted">Capture competitor pages first.</p>
        </section>
      </div>
    )
  }

  const citeRow = (kind: CiteList['kind'], x: CiteRow) => (
    <li key={x.name} className="flex flex-wrap items-center gap-2 border-b border-[var(--row-rule)] py-2 text-[13px] last:border-0">
      {x.manual
        ? <span className="w-4" />
        : <input type="checkbox" className={CHECKBOX} checked={x.inBrief} disabled={busy} aria-label={`Include ${x.name} in the brief`} onChange={() => void run({ op: 'citePick', kind, name: x.name, on: !x.inBrief })} />}
      <span className="min-w-[160px] flex-1 [overflow-wrap:anywhere] text-tn-ink" title={x.manual ? 'Added by you' : x.from.join(', ')}>{x.name}</span>
      <span className="text-[12px] text-muted">{citedBy(x)}</span>
      {x.manual && (
        <>
          <Pill tone="blue" text="Added" />
          <button type="button" className={BTN.icon} disabled={busy} aria-label={`Remove ${x.name} from the brief`} onClick={() => void run({ op: 'citeRemove', kind, name: x.name })}><Icon d={ICON.close} size={15} /></button>
        </>
      )}
    </li>
  )

  const citeCurator = (list: CiteList) => {
    const { kind } = list
    const value = typed[kind] ?? ''
    const add = async () => { if (await run({ op: 'citeAdd', kind, name: value }, 'Added to the brief.')) setTyped(t => ({ ...t, [kind]: '' })) }
    return (
      <div>
        <div className="mb-3 flex flex-wrap gap-2">
          <input className={`${INPUT} min-w-[220px] max-w-[320px] flex-1`} value={value} maxLength={120} placeholder={PLACEHOLDER[kind]} aria-label={`Add to ${CITE_KINDS[kind]}`}
            onChange={e => setTyped(t => ({ ...t, [kind]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') void add() }} />
          <button type="button" className={BTN.smallNavy} disabled={busy || !value.trim()} onClick={() => void add()}>Add</button>
        </div>
        <p className="m-0 mb-1 text-[12.5px] text-muted">In the brief ({list.inBrief.length})</p>
        {list.inBrief.length ? <ul className="m-0 list-none p-0">{list.inBrief.map(x => citeRow(kind, x))}</ul> : <p className="m-0 text-[12.5px] text-muted">None yet.</p>}
        {list.othersTotal > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-[13px] font-semibold text-tn-teal">Others found ({list.othersTotal})</summary>
            <ul className="m-0 mt-2 list-none p-0">{list.others.map(x => citeRow(kind, x))}</ul>
          </details>
        )}
      </div>
    )
  }

  const srcRow = (x: SourceRow) => (
    <tr key={x.n} className="border-b border-[var(--row-rule)] align-top last:border-0 hover:bg-[var(--row-hover)]">
      <td className="w-10 px-4 py-3">
        {!x.manual && <input type="checkbox" className={CHECKBOX} checked={x.inBrief} disabled={busy} aria-label={`Include ${x.title} in the brief`} onChange={() => void run({ op: 'srcPick', n: x.n, on: !x.inBrief })} />}
      </td>
      <td className="min-w-[220px] px-4 py-3 [overflow-wrap:anywhere]">
        <a href={x.url} target="_blank" rel="noopener noreferrer" title={x.url} className="font-semibold text-tn-teal hover:underline">{x.title}</a>
        <span className="block text-[12px] text-muted">{x.url}</span>
      </td>
      <td className="px-4 py-3 text-[12.5px]">{x.domain}</td>
      <td className="px-4 py-3 text-right tabular-nums" title={x.from.join(', ')}>{x.manual ? <Pill tone="blue" text="Added" /> : x.from.length}</td>
      <td className="px-4 py-3 text-right">
        {x.manual && <button type="button" className={BTN.icon} disabled={busy} aria-label={`Remove ${x.title} from the brief`} onClick={() => void run({ op: 'srcRemove', n: x.n })}><Icon d={ICON.close} size={15} /></button>}
      </td>
    </tr>
  )
  const srcTable = (rows: SourceRow[]) => (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead><tr><th className={TH}><span className="sr-only">In the brief</span></th><th className={TH}>Source</th><th className={TH}>Site</th><th className={`${TH} text-right`}>Competitors linking</th><th className={TH}><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{rows.map(srcRow)}</tbody>
      </table>
    </div>
  )
  const addSource = async () => { if (await run({ op: 'srcAdd', url: src.url, title: src.title }, 'Source added to the brief.')) setSrc({ url: '', title: '' }) }
  const s = view.sources

  return (
    <div className="space-y-6">
      {toast}
      {view.faith && (
        <section className={`${CARD} p-5`}>
          <h2 className={SECTION_TITLE}>Bible books and passages</h2>
          <p className="m-0 mt-1 mb-4 text-[13px] leading-normal text-muted">Scripture competitors cite, most cited first. Choose which books and passages go in the brief, and add your own.</p>
          <Sub>Books</Sub>
          <div className="mt-3">{citeCurator(view.books)}</div>
          {view.bookTerms.length > 0 && (
            <div className="mt-3">
              <p className="m-0 mb-2 text-[12.5px] text-muted">Also add a book to the topic terms:</p>
              <div className="flex flex-wrap gap-2">
                {view.bookTerms.map(b => (
                  <button key={b.key} type="button" className={BTN.smallWhite} disabled={busy} aria-label={`Add ${b.name} to the topic terms`}
                    onClick={() => void call(() => editTopic(id, { op: 'add', text: b.name, key: b.key, tier: 'medium' }), { ok: `Added “${b.name}”.` })}>{b.name} <span className="font-normal text-muted">+ term</span></button>
                ))}
              </div>
            </div>
          )}
          <Sub>Passages</Sub>
          <div className="mt-3">{citeCurator(view.refs)}</div>
        </section>
      )}

      <section className={`${CARD} p-5`}>
        <h2 className={SECTION_TITLE}>Linked sources</h2>
        <p className="m-0 mt-1 mb-4 text-[13px] leading-normal text-muted">Outside pages competitors link to, most linked first. Choose which ones go in the brief for writers to consider citing, and add your own.</p>
        <div className="mb-4 flex flex-wrap gap-2">
          <input className={`${INPUT} min-w-[240px] flex-[2]`} type="url" value={src.url} maxLength={2000} placeholder="https://… a source to add" aria-label="Source URL" onChange={e => setSrc(v => ({ ...v, url: e.target.value }))} />
          <input className={`${INPUT} min-w-[180px] flex-1`} value={src.title} maxLength={300} placeholder="Title (optional)" aria-label="Source title" onChange={e => setSrc(v => ({ ...v, title: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') void addSource() }} />
          <button type="button" className={BTN.smallNavy} disabled={busy || !src.url.trim()} onClick={() => void addSource()}>Add source</button>
        </div>
        <h3 className={`${CARD_TITLE} mb-2`}>In the brief ({s.inBrief.length})</h3>
        {s.inBrief.length ? srcTable(s.inBrief) : <p className="m-0 text-[12.5px] text-muted">None yet. Tick sources from the list below or paste your own above.</p>}
        {s.othersTotal > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-[13px] font-semibold text-tn-teal">Other linked sources ({s.othersTotal})</summary>
            <div className="mt-2">{srcTable(s.others)}</div>
          </details>
        )}
        <Sub hint="Organizations and experts competitors cite by name, such as “according to Mayo Clinic”.">Named authorities</Sub>
        <div className="mt-3">{citeCurator(view.auth)}</div>
      </section>
    </div>
  )
}
