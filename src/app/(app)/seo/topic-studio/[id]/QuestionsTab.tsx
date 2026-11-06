'use client'

/**
 * Questions (Topic Studio, phase 1): choose the questions the article answers
 * directly, review the ones that show what searchers are thinking, and note
 * what the short summary answer at the top should say. These sections appear
 * in the SEO brief in the same order. Finding gaps with Claude arrives in
 * phase 3.
 */

import { useState } from 'react'
import { Icon, ICON } from '@/components/clocky/entries/ui'
import { BTN } from '@/lib/ui/buttons'
import { INPUT } from '@/lib/ui/fields'
import { CARD, CARD_TITLE, SECTION_TITLE } from '@/lib/ui/type'
import type { QuestionRow, QuestionsView } from '@/lib/topic-studio/views'
import { editTopic, type TopicOp } from '../actions'
import { useTopicCall } from './use-topic-call'

const Tag = ({ children, title, tone = 'gray' }: { children: React.ReactNode; title?: string; tone?: 'gray' | 'teal' | 'gold' }) => (
  <span title={title} className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${tone === 'teal' ? 'bg-tn-teal-soft text-tn-teal' : tone === 'gold' ? 'bg-[#fbf1cf] text-[#8a6703]' : 'bg-subtle text-muted'}`}>{children}</span>
)

const Sub = ({ children, hint }: { children: React.ReactNode; hint?: string }) => (
  <div className="mt-6 first:mt-0">
    <h3 className={CARD_TITLE}>{children}</h3>
    {hint && <p className="m-0 mt-1 mb-3 text-[12.5px] leading-normal text-muted">{hint}</p>}
  </div>
)

export function QuestionsTab({ id, view }: { id: string; view: QuestionsView }) {
  const { call, busy, toast } = useTopicCall()
  const [direct, setDirect] = useState('')
  const [note, setNote] = useState('')
  const [editing, setEditing] = useState<{ i: number; text: string } | null>(null)
  const run = (op: TopicOp, ok?: string) => call(() => editTopic(id, op), { ok: ok ?? (r => r.message) })

  function QRow({ q }: { q: QuestionRow }) {
    return (
      <li className={`flex flex-wrap items-center gap-2 border-b border-[var(--row-rule)] py-2.5 text-[13px] last:border-0 ${q.off ? 'opacity-55' : ''}`}>
        <span className="min-w-[200px] flex-1 [overflow-wrap:anywhere] text-tn-ink">
          {q.q}
          {q.why && <span className="block text-[12px] text-muted">{q.why}</span>}
          {q.off && q.reason && <span className="block text-[12px] text-muted">Removed: {q.reason}</span>}
        </span>
        {q.from.length > 0 && <Tag title={q.from.join(', ')}>{q.from.length} source{q.from.length === 1 ? '' : 's'}</Tag>}
        {q.heading && <Tag>heading</Tag>}
        {q.src === 'claude' && <Tag tone="gold">Claude</Tag>}
        {q.src === 'manual' && <Tag tone="teal">you</Tag>}
        {!q.off && <button type="button" className={BTN.link} disabled={busy} onClick={() => void run({ op: 'qDirect', key: q.key })}>{q.direct ? 'Move out' : 'Answer directly'}</button>}
        <button type="button" className={BTN.icon} disabled={busy} aria-label={q.off ? `Restore: ${q.q}` : `Remove: ${q.q}`} onClick={() => void run({ op: 'qOff', key: q.key })}>
          {q.off ? <Icon d={ICON.correction} size={15} /> : <Icon d={ICON.close} size={15} />}
        </button>
      </li>
    )
  }
  const list = (rows: QuestionRow[], empty: string) => (rows.length ? <ul className="m-0 list-none p-0">{rows.map(q => <QRow key={q.key} q={q} />)}</ul> : <p className="m-0 text-[12.5px] text-muted">{empty}</p>)
  const group = (label: string, rows: QuestionRow[]) => rows.length > 0 && (
    <div className="mb-4">
      <h4 className="m-0 mb-1 text-[12.5px] font-bold text-muted">{label} <span className="font-normal">{rows.length}</span></h4>
      {list(rows, '')}
    </div>
  )

  const notes = view.answerTop
  const saveNotes = (next: string[]) => run({ op: 'notes', notes: next })
  async function addNote() {
    const v = note.trim()
    if (!v) return
    if (await saveNotes([...notes, v])) setNote('')
  }
  async function saveEdit() {
    if (!editing) return
    const { i, text } = editing
    setEditing(null)
    const v = text.trim()
    if (v === notes[i]) return
    await saveNotes(v ? notes.map((n, k) => (k === i ? v : n)) : notes.filter((_, k) => k !== i))
  }
  async function addDirect() {
    const v = direct.trim()
    if (!v) return
    if (await run({ op: 'qAdd', text: v })) setDirect('')
  }

  return (
    <div className="space-y-6">
      {toast}
      <section className={`${CARD} p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className={SECTION_TITLE}>Questions</h2>
            <p className="m-0 mt-1 text-[13px] leading-normal text-muted">Choose the questions the article should answer directly, and review the questions that show what searchers are thinking. These sections appear in the SEO brief in the same order.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={BTN.smallWhite} disabled={busy || !view.captured} title={view.captured ? undefined : 'Capture competitor pages first'} onClick={() => void run({ op: 'syncQuestions' })}>{view.hasCompetitorQuestions ? 'Re-scan competitors' : 'Find competitor questions'}</button>
            <button type="button" className={`${BTN.smallWhite} opacity-60`} disabled title="Needs the Anthropic key">Clean up and find gaps with Claude</button>
            <span className="text-[11.5px] text-muted">Phase 3</span>
          </div>
        </div>
      </section>

      <section className={`${CARD} p-5`}>
        <Sub hint="What the short summary answer at the top should say before the article goes into depth: the direct answer, key facts, distinctions and terms, and how it can be more helpful than the AI answers.">Answer near the top</Sub>
        {notes.length > 0 && (
          <ul className="m-0 mb-3 list-none p-0">
            {notes.map((n, i) => (
              <li key={`${i}-${n}`} className="flex items-start gap-2 border-b border-[var(--row-rule)] py-2.5 text-[13px] last:border-0">
                {editing?.i === i ? (
                  <input autoFocus className={`${INPUT} flex-1`} value={editing.text} maxLength={600} aria-label="Edit this note"
                    onChange={e => setEditing({ i, text: e.target.value })} onBlur={() => void saveEdit()}
                    onKeyDown={e => { if (e.key === 'Enter') void saveEdit(); if (e.key === 'Escape') setEditing(null) }} />
                ) : (
                  <>
                    <span className="flex-1 [overflow-wrap:anywhere] text-tn-ink">{n}</span>
                    <button type="button" className={BTN.icon} aria-label={`Edit: ${n}`} onClick={() => setEditing({ i, text: n })}><Icon d={ICON.edit} size={15} /></button>
                    <button type="button" className={BTN.icon} disabled={busy} aria-label={`Remove: ${n}`} onClick={() => void saveNotes(notes.filter((_, k) => k !== i))}><Icon d={ICON.close} size={15} /></button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <input className={`${INPUT} min-w-[220px] flex-1`} value={note} maxLength={600} placeholder="Add a note for the summary answer" aria-label="Add a note for the summary answer" onChange={e => setNote(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void addNote() }} />
          <button type="button" className={BTN.smallNavy} disabled={busy || !note.trim()} onClick={() => void addNote()}>Add note</button>
        </div>

        <Sub hint="The questions this page exists to answer. Give each one a short, direct answer early in its section, so readers and AI answers get what they need without hunting. Keep this list short and focused; you can promote any question below with “Answer directly”.">Questions to answer directly <span className="text-[12.5px] font-normal text-muted">(and have summary answers for)</span></Sub>
        <div className="mb-3 flex flex-wrap gap-2">
          <input className={`${INPUT} min-w-[220px] flex-1`} value={direct} maxLength={300} placeholder="Add a question to answer directly" aria-label="Add a question to answer directly" onChange={e => setDirect(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void addDirect() }} />
          <button type="button" className={BTN.smallNavy} disabled={busy || !direct.trim()} onClick={() => void addDirect()}>Add question</button>
        </div>
        {list(view.direct, 'None yet. Add one above, or click “Answer directly” on any question below.')}

        <Sub hint="These show what searchers are thinking, worried about or trying to do. They are not an outline: let them shape your tone, context and examples, and answer them briefly or indirectly where they fit. Promote any that deserve their own summary answer with “Answer directly”.">Questions that reveal the mindset of the searchers <span className="text-[12.5px] font-normal text-muted">(can answer indirectly)</span></Sub>
        {group('Suggested by Claude', view.claude)}
        {group('From competitors', view.competitor)}
        {group('Added by you', view.mine)}
        {!view.claude.length && !view.competitor.length && !view.mine.length && <p className="m-0 rounded-[12px] bg-subtle px-4 py-3 text-[13px] text-muted">Scan your captured pages to list their questions.</p>}
      </section>
    </div>
  )
}
