'use client'

/**
 * The annual review's building blocks (design handoff, C3 to E5): a section
 * card that hides and shows, a question that saves as you type, the goals
 * (read, edited, marked for the other person), the year's goals and how they
 * went, and the priorities with how many goals serve each one.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CARD } from '@/lib/ui/type'
import { BTN } from '@/lib/ui/buttons'
import { INPUT, TEXTAREA } from '@/lib/ui/fields'
import { FIELD_LABEL } from '@/lib/ui/type'
import { Pill } from '@/components/ui/Pill'
import { Segmented } from '@/components/ui/Segmented'
import { Select } from '@/components/ui/Select'
import { MonthField } from '@/components/ui/DateField'
import { StatusIcon } from '@/components/ui/StatusIcon'
import { GOAL_RESULT, TERM_LABEL, monthLabel, type GoalResult } from '@/lib/review/rules'
import type { GoalView, PriorityView } from '@/lib/review/view'

export type Saved = (at: string) => void
type Res = { ok: true; savedAt?: string; toast?: string; id?: number } | { ok: false; error: string }

// ── Section ────────────────────────────────────────────────────────────────

export function Section({ id, title, sub, right, open, onToggle, children, tone }: {
  id: string; title: ReactNode; sub?: ReactNode; right?: ReactNode; open?: boolean; onToggle?: () => void; children?: ReactNode; tone?: 'teal' | 'locked'
}) {
  const edge = tone === 'teal' ? 'border-tn-teal shadow-[0_0_0_3px_rgba(30,125,127,.10)]' : ''
  return (
    <section id={id} data-section={id} className={`${CARD} ${edge} scroll-mt-[150px] px-[22px] py-[18px] flex flex-col gap-3`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[17px] leading-[1.25] text-tn-ink">{title}</h2>
          {sub && <p className="m-0 text-[13px] text-[#5b6b82] leading-[1.5]">{sub}</p>}
        </div>
        <div className="flex-none flex items-center gap-3">
          {right}
          {onToggle && (
            <button type="button" onClick={onToggle} className={`${BTN.link} gap-1`} aria-expanded={open}>
              {open ? 'Hide' : 'Show'}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={open ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} /></svg>
            </button>
          )}
        </div>
      </div>
      {(open ?? true) && children}
    </section>
  )
}

export const Count = ({ done, total, words = 'answered' }: { done: number; total: number; words?: string }) => (
  <span className={`font-(family-name:--font-display) font-extrabold text-[12.5px] ${done === total && total > 0 ? 'text-[var(--bdg-green-fg)]' : 'text-muted'}`}>{done} of {total} {words}</span>
)

// ── Saving as you type ─────────────────────────────────────────────────────

/** A value saved a moment after the last keystroke, and when leaving the field. */
export function useAutosave(initial: string, save: (v: string) => Promise<Res>, onSaved: Saved, onError: (e: string) => void) {
  const [value, setValue] = useState(initial)
  const last = useRef(initial)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flush = async (v: string) => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    if (v === last.current) return
    last.current = v
    try {
      const r = await save(v)
      if (r.ok) onSaved(r.savedAt ?? new Date().toISOString())
      else onError(r.error)
    } catch {
      onError('Not saved. Check the connection; what you typed is still here.')
    }
  }
  const change = (v: string) => {
    setValue(v)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(v), 900)
  }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  return { value, change, blur: () => void flush(value) }
}

export function QuestionField({ label, hint, initial, editable, copied, save, onSaved, onError, rows = 3 }: {
  label: string; hint: string; initial: string; editable: boolean; copied?: boolean
  save: (v: string) => Promise<Res>; onSaved: Saved; onError: (e: string) => void; rows?: number
}) {
  const a = useAutosave(initial, save, onSaved, onError)
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[14px] font-bold text-tn-ink">{label}</span>
      {editable && <span className="text-[12.5px] text-[#8593a4] -mt-1">{hint}</span>}
      {editable ? (
        <>
          <textarea value={a.value} onChange={e => a.change(e.target.value)} onBlur={a.blur} rows={rows} placeholder="Write your answer"
            className={`${TEXTAREA} w-full text-[13.5px] leading-[1.55] ${copied ? 'border-tn-teal' : ''}`} />
          {copied && <span className="text-[12px] text-tn-teal">Copied from your last review. Change anything that is different now.</span>}
        </>
      ) : (
        <p className={`m-0 text-[14px] leading-[1.6] whitespace-pre-wrap ${initial.trim() ? 'text-[#435066]' : 'text-muted italic'}`}>{initial.trim() || 'No answer.'}</p>
      )}
    </label>
  )
}

// ── Priorities ─────────────────────────────────────────────────────────────

export function PriorityGrid({ items, showGoals }: { items: PriorityView[]; showGoals: boolean }) {
  if (!items.length) return <p className="m-0 text-[13px] text-muted">No priorities yet. The VP of Operations and the CISO write them before the cycle starts.</p>
  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
      {items.map(p => (
        <div key={p.id} className="rounded-[12px] bg-[#f8f7f3] px-4 py-3.5 flex flex-col gap-1.5 min-w-0">
          <span className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.08em] uppercase text-[#1E7D7F]">{p.scope}</span>
          <span className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink leading-[1.3]">{p.n}. {p.title || 'Untitled'}</span>
          {p.body && <span className="text-[13px] text-[#5b6b82] leading-[1.5]">{p.body}</span>}
          {showGoals && <span className={`text-[12px] font-bold ${p.goals ? 'text-[#0d7a4f]' : 'text-[#9a5a00]'}`}>{p.goals ? `Served by ${p.goals} ${p.goals === 1 ? 'goal' : 'goals'}` : 'No goal yet'}</span>}
        </div>
      ))}
    </div>
  )
}

/**
 * The priorities inside a review (design handoff, C3 and A4): a quiet block,
 * a flag and a small capital label, folded to one line of titles when hidden.
 */
export function PriorityBlock({ id, label, items, showGoals, open, onToggle }: {
  id: string; label: string; items: PriorityView[]; showGoals: boolean; open: boolean; onToggle: () => void
}) {
  return (
    <section id={id} data-section={id} className={`${CARD} scroll-mt-[150px] px-[18px] py-3.5 flex flex-col gap-3.5`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex items-center gap-3.5 text-left bg-transparent border-0 p-0 cursor-pointer">
        <span className="w-[34px] h-[34px] rounded-[9px] bg-[#eaf4f4] text-[#1E7D7F] flex items-center justify-center flex-none"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={FLAG} /></svg></span>
        <span className="flex-1 min-w-0 flex flex-col gap-[3px]">
          <span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted">{label}</span>
          {!open && <span className="text-[13.5px] font-bold text-tn-ink truncate">{items.length ? items.map(p => p.title || 'Untitled').join(' · ') : 'None yet'}</span>}
        </span>
        <span className="flex items-center gap-[5px] font-(family-name:--font-display) font-extrabold text-[12.5px] text-[#1E7D7F]">{open ? 'Hide' : 'Show'}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={open ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} /></svg></span>
      </button>
      {open && <PriorityGrid items={items} showGoals={showGoals} />}
    </section>
  )
}

// ── Goals ──────────────────────────────────────────────────────────────────

const chip = 'inline-flex items-center gap-1.5 rounded-full bg-subtle px-2.5 py-[3px] text-[12px] font-semibold text-tn-ink'
const FLAG = 'M4 22V4M4 4h13l-2 4 2 4H4'

/** With two reviewers: who each goal is for, "Jeannette Owens · SEO" (owner, 10 November 2026). */
export interface GoalOwner { no: 0 | 1; label: string }

function GoalRead({ g, who, onEdit, owners }: { g: GoalView; who: string; onEdit?: () => void; owners?: GoalOwner[] }) {
  const [orig, setOrig] = useState(false)
  const was = g.original
  const changes: string[] = []
  if (was) {
    if (was.what !== undefined && was.what !== g.what) changes.push(`"${was.what}"`)
    if (was.how !== undefined && was.how !== g.how) changes.push(`measured by "${was.how}"`)
    if (was.by_month !== undefined && was.by_month !== g.byMonth) changes.push(`by ${monthLabel(was.by_month ?? null) || 'no date'}`)
    if (was.term !== undefined && was.term !== g.term) changes.push(was.term ? TERM_LABEL[was.term as '6m' | '1y'] : 'no term')
  }
  return (
    <div className="flex gap-3 py-3 border-t border-[var(--row-rule)] first:border-t-0">
      <span className="flex-none w-6 h-6 rounded-full bg-[#eaf4f4] text-tn-teal font-(family-name:--font-display) font-extrabold text-[11px] flex items-center justify-center">{g.n}</span>
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">{g.what || 'Untitled goal'}</span>
        {g.how && <span className="text-[13px] text-[#435066]">Measured by: {g.how}</span>}
        <div className="flex flex-wrap items-center gap-1.5">
          {owners && owners.length > 1 && <span className={chip}>For {owners.find(o => o.no === (g.part ?? 0))?.label}</span>}
          {g.byLabel && <span className={chip}>By {g.byLabel}</span>}
          {g.term && <span className={chip}>{TERM_LABEL[g.term]}</span>}
          {g.priorityTitle && <span className={`${chip} bg-[#eaf4f4] text-tn-teal`}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={FLAG} /></svg>{g.priorityTitle}</span>}
          {g.addedByReviewer && <Pill tone="blue" text={`Added by ${g.addedByName}`} />}
          {!g.addedByReviewer && g.changedByName && <Pill tone="blue" text={`Changed by ${g.changedByName}`} />}
          {!g.addedByReviewer && g.changedByName && changes.length > 0 && (
            <button type="button" className={BTN.link} onClick={() => setOrig(o => !o)}>{orig ? 'Hide the original' : 'Show the original'}</button>
          )}
        </div>
        {orig && changes.length > 0 && <p className="m-0 rounded-[8px] bg-subtle px-3 py-2 text-[12.5px] text-[#435066]">{who} wrote: <s>{changes.join(', ')}</s>. {g.changedByName} changed it.</p>}
      </div>
      {onEdit && (
        <button type="button" onClick={onEdit} aria-label="Change this goal" className={`${BTN.icon} border border-[var(--panel-border)]`}>
          <StatusIcon state="progress" size={14} color="currentColor" />
        </button>
      )}
    </div>
  )
}

export interface GoalApi {
  saveGoal(i: { goalId: number; what?: string; how?: string; byMonth?: string | null; term?: '6m' | '1y' | null; priorityId?: number | null; part?: 0 | 1 }): Promise<Res>
  removeGoal(i: { goalId: number }): Promise<Res>
}

function GoalEdit({ g, priorities, api, onSaved, onError, onRemoved, tag, owners, pickOwner }: {
  g: GoalView; priorities: PriorityView[]; api: GoalApi; onSaved: Saved; onError: (e: string) => void; onRemoved: () => void; tag?: string
  /** Two reviewers: the person says which one each goal is for. */
  owners?: GoalOwner[]; pickOwner?: boolean
}) {
  const [owner, setOwner] = useState<'0' | '1'>(String(g.part ?? 0) as '0' | '1')
  const what = useAutosave(g.what, v => api.saveGoal({ goalId: g.id, what: v }), onSaved, onError)
  const how = useAutosave(g.how, v => api.saveGoal({ goalId: g.id, how: v }), onSaved, onError)
  const [by, setBy] = useState(g.byMonth?.slice(0, 7) ?? '')
  const [term, setTerm] = useState<'6m' | '1y' | null>(g.term)
  const [pri, setPri] = useState(g.priorityId ? String(g.priorityId) : '')
  const save = async (p: Parameters<GoalApi['saveGoal']>[0]) => {
    const r = await api.saveGoal(p)
    if (r.ok) onSaved(r.savedAt ?? new Date().toISOString()); else onError(r.error)
  }
  return (
    <div className="rounded-[12px] border border-tn-teal px-4 py-3.5 flex flex-col gap-3 my-2">
      <div className="flex items-center gap-2">
        <span className={FIELD_LABEL}>Goal {g.n}</span>
        {tag && <Pill tone="blue" text={tag} />}
        <span className="flex-1" />
        <button type="button" aria-label="Remove this goal" className={BTN.icon} onClick={async () => {
          const r = await api.removeGoal({ goalId: g.id })
          if (r.ok) onRemoved(); else onError(r.error)
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
        </button>
      </div>
      {owners && owners.length > 1 && (pickOwner
        ? <div className="flex flex-col gap-1.5"><span className={FIELD_LABEL}>For</span>
            <Segmented label="Which reviewer this goal is for" value={owner} options={owners.map(o => ({ key: String(o.no) as '0' | '1', label: o.label }))} onChange={k => { setOwner(k); void save({ goalId: g.id, part: Number(k) as 0 | 1 }) }} /></div>
        : <span className="text-[12.5px] text-muted">For {owners.find(o => o.no === (g.part ?? 0))?.label}</span>)}
      <label className="flex flex-col gap-1.5"><span className={FIELD_LABEL}>What</span>
        <input value={what.value} onChange={e => what.change(e.target.value)} onBlur={what.blur} maxLength={500} placeholder="What you will do" className={`${INPUT} w-full font-semibold`} /></label>
      <label className="flex flex-col gap-1.5"><span className={FIELD_LABEL}>How it is measured</span>
        <input value={how.value} onChange={e => how.change(e.target.value)} onBlur={how.blur} maxLength={1000} placeholder="How you and your manager can tell it is done" className={`${INPUT} w-full`} /></label>
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1.5 basis-[180px] flex-1"><span className={FIELD_LABEL}>By when · month and year</span>
          <MonthField value={by} onChange={v => { setBy(v); void save({ goalId: g.id, byMonth: v ? `${v}-01` : null }) }} ariaLabel="By when" /></div>
        <div className="flex flex-col gap-1.5"><span className={FIELD_LABEL}>Term</span>
          <Segmented label="Term" value={term} options={[{ key: '6m', label: '6 months' }, { key: '1y', label: '1 year' }]} onChange={k => { setTerm(k); void save({ goalId: g.id, term: k }) }} /></div>
        <div className="flex flex-col gap-1.5 basis-[260px] flex-[2] min-w-0"><span className={FIELD_LABEL}>Serves which priority</span>
          <Select value={pri} fullWidth ariaLabel="Serves which priority" placeholder="No priority"
            options={[{ value: '', label: 'No priority' }, ...priorities.map(p => ({ value: String(p.id), label: p.title || `Priority ${p.n}`, group: p.scope }))]}
            onChange={v => { setPri(v); void save({ goalId: g.id, priorityId: v ? Number(v) : null }) }} /></div>
      </div>
    </div>
  )
}

/** The goals for the coming year: read, or edited by whoever may change them now. */
export function GoalList({ goals, priorities, api, editable, mode, who, onSaved, onError, onChanged, editingId, setEditingId, owners, myPart }: {
  goals: GoalView[]; priorities: PriorityView[]; api: GoalApi; editable: boolean; mode: 'person' | 'reviewer' | 'read'; who: string
  onSaved: Saved; onError: (e: string) => void; onChanged: () => void; editingId: number | null; setEditingId: (id: number | null) => void
  /** Two reviewers: who each goal is for; a reviewer changes only theirs (or one given to neither). */
  owners?: GoalOwner[]; myPart?: 0 | 1 | null
}) {
  const two = !!owners && owners.length > 1
  const mayEdit = (g: GoalView) => editable && (mode !== 'reviewer' || !two || g.part === null || g.part === myPart)
  return (
    <div className="flex flex-col">
      {goals.map(g => (mode === 'person' && editable) || (mayEdit(g) && editingId === g.id)
        ? <GoalEdit key={g.id} g={g} priorities={priorities} api={api} onSaved={onSaved} onError={onError} onRemoved={onChanged}
            tag={g.addedByReviewer ? `Added by ${g.addedByName}` : undefined} owners={owners} pickOwner={mode === 'person'} />
        : <GoalRead key={g.id} g={g} who={who} owners={owners} onEdit={mayEdit(g) ? () => setEditingId(g.id) : undefined} />)}
      {!goals.length && <p className="m-0 text-[13px] text-muted">No goals yet. Add the first one: what, how it is measured, and by when (month and year).</p>}
    </div>
  )
}

// ── The year's goals, and how they went ────────────────────────────────────

export interface PastApi {
  saveGoal: GoalApi['saveGoal']
  removeGoal: GoalApi['removeGoal']
  markGoal(i: { goalId: number; result?: GoalResult | null; comment?: string }): Promise<Res>
}

/**
 * A goal of the year under review (design handoff, C3 and C4): read only, as
 * that year is closed (the owner, 4 November 2026). The person marks how it
 * went and says why in a sentence; nothing else about the goal changes.
 */
export function PastGoal({ g, year, editable, api, onSaved, onError }: {
  g: GoalView; year: number; editable: boolean; api: PastApi; onSaved: Saved; onError: (e: string) => void
}) {
  const [result, setResult] = useState<GoalResult | null>(g.result)
  const comment = useAutosave(g.resultComment, v => api.markGoal({ goalId: g.id, comment: v }), onSaved, onError)
  const res = GOAL_RESULT.find(x => x.key === g.result)
  const from = g.fromLastReview ? g.how : `From your ${year - 1} review`
  const when = [from, g.byLabel ? `by ${g.byLabel}` : ''].filter(Boolean).join(' · ') + (g.term && g.fromLastReview ? `, ${TERM_LABEL[g.term]}` : '')
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-2.5 items-center pt-4 pb-1 border-t border-[#f1f3f6]">
      <div className="flex flex-col gap-[3px] min-w-0">
        <span className="text-[14.5px] font-extrabold text-tn-ink">{g.n}. {g.what || 'Untitled goal'}</span>
        {when && <span className="text-[13px] text-[#5b6b82]">{when}</span>}
      </div>
      {editable ? (
        <Segmented label="How it went" value={result} options={GOAL_RESULT.map(x => ({ key: x.key, label: x.label }))}
          onChange={k => { setResult(k); void api.markGoal({ goalId: g.id, result: k }).then(r => r.ok ? onSaved(r.savedAt ?? '') : onError(r.error)) }} />
      ) : <Pill tone={res ? res.tone : 'gray'} text={res ? res.label : 'Not marked'} />}
      {editable
        ? <input value={comment.value} onChange={e => comment.change(e.target.value)} onBlur={comment.blur} placeholder="How it went, in a sentence" aria-label="How it went"
            className="col-span-2 min-h-[44px] rounded-[10px] border border-[#e4e7ec] bg-white px-3 py-2.5 text-[13.5px] leading-[1.5] text-tn-ink outline-none focus:border-tn-teal focus:shadow-[0_0_0_3px_rgba(30,125,127,.12)]" />
        : g.resultComment && <p className="col-span-2 m-0 min-h-[44px] rounded-[10px] border border-[#e4e7ec] px-3 py-2.5 text-[13.5px] leading-[1.5] text-tn-ink">{g.resultComment}</p>}
    </div>
  )
}
