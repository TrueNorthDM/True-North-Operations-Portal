'use client'

/**
 * The priorities for next year (owner, 10 November 2026): the CISO writes the
 * Company Priorities, the VP of Operations their own, each marks theirs ready
 * (the goals for next year open in every self-review when both are), and
 * each Team Leader writes their team's first thing in their own self-review,
 * with no approval. Everyone sees where each team is. On the right, the
 * changes.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BTN, BTN_ICON } from '@/lib/ui/buttons'
import { CARD, FIELD_LABEL, PAGE_TITLE } from '@/lib/ui/type'
import { INPUT, TEXTAREA } from '@/lib/ui/fields'
import { Pill } from '@/components/ui/Pill'
import { Toast, type ToastState } from '@/components/clocky/entries/ui'
import { fmtTime, fmtInstantDay, initials } from '@/lib/review/format'
import { useAutosave } from './parts'

type Res = { ok: true; toast?: string; savedAt?: string; id?: number } | { ok: false; error: string }
export interface PriorityRow { id: number; title: string; body: string; changed: string | null }
export interface TeamRow { teamId: string; name: string; leader: string; written: number; line: string }
/** One writer's block: the CISO's Company Priorities or the VP of Operations'. */
export interface Block { kind: 'company' | 'vp'; title: string; writer: string; canEdit: boolean; ready: string | null; due: string | null; rows: PriorityRow[] }

export function PrioritiesPage({ cycleId, year, intro, notice, blocks, teams, noLeader, log, api }: {
  cycleId: number; year: number; intro: string; notice: string | null
  blocks: Block[]; teams: TeamRow[]; noLeader: string[]; log: { who: string; text: string; at: string }[]
  api: {
    savePriority(i: { cycleId: number; id?: number | null; teamId?: string | null; kind?: 'company' | 'vp'; title?: string; body?: string }): Promise<Res>
    removePriority(i: { id: number }): Promise<Res>
    markPrioritiesReady(i: { cycleId: number; kind: 'company' | 'vp' }): Promise<Res>
  }
}) {
  const router = useRouter()
  const [toast, setToast] = useState<ToastState | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const say = (text: string, error = false) => { setToast({ text, error }); setTimeout(() => setToast(null), 5000) }
  const run = async (go: () => Promise<Res>) => {
    setBusy(true)
    try { const r = await go(); if (r.ok) { if (r.toast) say(r.toast); router.refresh() } else say(r.error, true) } catch { say('That did not go through. Try again.', true) } finally { setBusy(false) }
  }
  const H2 = 'm-0 font-(family-name:--font-display) font-extrabold text-[16px] text-tn-ink'
  const COUNT = 'text-[12px] font-bold text-[#5b6b82] bg-[#f1f3f6] rounded-full px-[9px] py-0.5'
  const NUM = 'flex-none rounded-full bg-tn-ink text-[#F2C40A] font-(family-name:--font-display) font-black flex items-center justify-center'
  const BADGE = 'flex-none rounded-full bg-[#eef1f5] border border-[#dfe4ea] text-[#435066] font-(family-name:--font-display) font-extrabold flex items-center justify-center'
  let n = 0
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex-1 min-w-[260px] flex flex-col gap-1.5">
          <h1 className={PAGE_TITLE}>Priorities for {year + 1}</h1>
          <p className="m-0 text-[15px] text-muted leading-relaxed">{intro}</p>
        </div>
        {saved && <span className="flex items-center gap-1.5 text-[12.5px] text-muted whitespace-nowrap"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1E9E6A" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>Saved · {fmtTime(saved)}</span>}
      </div>

      <div className="flex gap-5 items-start flex-wrap min-[1100px]:flex-nowrap">
        <div className="flex-1 min-w-0 flex flex-col gap-3.5 w-full">
          {notice && <div className="flex items-center gap-3 rounded-[12px] bg-[#eaf4f4] px-4 py-3 text-[13.5px] text-[#12585a]"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="flex-none" aria-hidden="true"><path d="M4 5h16v16H4zM4 10h16M9 3v4M15 3v4" /></svg>{notice}</div>}

          {blocks.map(b => (
            <section key={b.kind} className="flex flex-col gap-2.5 pt-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className={H2}>{b.title}</h2>
                <span className={COUNT}>{b.rows.length} {b.rows.length === 1 ? 'priority' : 'priorities'}</span>
                {b.ready ? <Pill tone="green" text="Ready" /> : <Pill tone="amber" text={b.due ? `Due ${b.due}` : 'Not ready'} />}
                <span className="text-[12.5px] text-muted">{b.canEdit ? 'You write these. They show in every review.' : `${b.writer} writes these. They show in every review.`}{b.ready ? ` Marked ready ${b.ready}.` : ''}</span>
              </div>
              {b.rows.map(p => { n++; return b.canEdit
                ? <EditRow key={p.id} n={n} p={p} scope={b.kind === 'vp' ? 'VP of Operations' : 'Whole company'} cycleId={cycleId} api={api} onSaved={setSaved} onError={e => say(e, true)} onRemove={() => run(() => api.removePriority({ id: p.id }))} />
                : <div key={p.id} className={`${CARD} px-5 py-4 grid grid-cols-[30px_minmax(0,1fr)] gap-3.5`}><span className={`${NUM} w-7 h-7 text-[13px]`}>{n}</span><div className="flex flex-col gap-[3px] min-w-0"><span className="text-[14.5px] font-extrabold text-tn-ink">{p.title || 'Untitled'}</span><span className="text-[13.5px] leading-[1.55] text-[#435066]">{p.body}</span></div></div> })}
              {!b.rows.length && !b.canEdit && <p className="m-0 rounded-[12px] border-[1.5px] border-dashed border-[#d9dee6] p-4 text-center text-[13.5px] text-[#8593a4]">None written yet.</p>}
              {b.canEdit && (
                <div className="flex flex-wrap gap-2.5">
                  <button type="button" disabled={busy} className={BTN.smallWhite} onClick={() => run(() => api.savePriority({ cycleId, teamId: null, kind: b.kind, title: '', body: '' }))}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>Add a priority</button>
                  {!b.ready && <button type="button" disabled={busy || !b.rows.some(r => r.title.trim())} className={`${BTN.smallNavy} disabled:opacity-50`} onClick={() => run(() => api.markPrioritiesReady({ cycleId, kind: b.kind }))}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>Mark them ready</button>}
                </div>
              )}
            </section>
          ))}

          <section className="flex flex-col gap-2.5 pt-1.5">
            <div className="flex items-baseline gap-2.5 flex-wrap"><h2 className={H2}>Teams</h2><span className={COUNT}>{teams.length} {teams.length === 1 ? 'team' : 'teams'}</span><span className="text-[12.5px] text-muted">Each Team Leader writes them first thing in their own self-review. They show in the reviews of that team.</span></div>
            <div className="rounded-[14px] border border-[#e4e7ec] overflow-hidden flex flex-col gap-px bg-[#f1f3f6]">
              {teams.map(t => (
                <div key={t.teamId} className="bg-white grid gap-4 items-center px-[18px] py-3.5 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto]">
                  <div className="flex items-center gap-2.5 min-w-0"><span className={`${BADGE} w-8 h-8 text-[10px]`}>{initials(t.leader)}</span><div className="flex flex-col gap-px min-w-0"><span className="text-[14px] font-extrabold text-tn-ink">{t.name}</span><span className="text-[12.5px] text-muted">{t.leader}</span></div></div>
                  <span className="text-[13px] leading-normal text-[#435066]">{t.line}</span>
                  <span className="flex sm:justify-end">{t.written ? <Pill tone="green" text={`${t.written} written`} /> : <Pill tone="gray" text="None yet" />}</span>
                </div>
              ))}
            </div>
            {noLeader.length > 0 && <p className="m-0 text-[13px] leading-normal text-muted">{noLeader.join(', ').replace(/, ([^,]*)$/, ' and $1')} {noLeader.length === 1 ? 'has' : 'have'} no Team Leader, so {noLeader.length === 1 ? 'it has' : 'they have'} no team priorities.</p>}
          </section>
        </div>

        <aside className={`${CARD} w-full min-[1100px]:w-[340px] flex-none min-[1100px]:sticky top-[calc(var(--chrome-top,64px)+16px)] p-[18px] flex flex-col gap-1 max-h-[calc(100vh-140px)] overflow-y-auto [scrollbar-width:none]`}>
          <h2 className="m-0 mb-1.5 font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">Changes</h2>
          {log.map((l, i) => (
            <div key={i} className="flex gap-2.5 py-2.5 border-t border-[#f1f3f6]">
              <span className={`${BADGE} w-7 h-7 text-[9.5px]`}>{initials(l.who || '?')}</span>
              <span className="flex flex-col gap-0.5 min-w-0"><span className="text-[13px] leading-[1.45] text-tn-ink">{l.text}</span><span className="text-[12px] text-muted">{fmtInstantDay(l.at)}, {fmtTime(l.at)}</span></span>
            </div>
          ))}
          {!log.length && <span className="text-[12.5px] text-muted py-2.5 border-t border-[#f1f3f6]">No changes yet.</span>}
        </aside>
      </div>
      <Toast toast={toast} />
    </div>
  )
}

function EditRow({ n, p, scope, cycleId, api, onSaved, onError, onRemove }: {
  n: number; p: PriorityRow; scope: string; cycleId: number; api: { savePriority(i: { cycleId: number; id?: number | null; title?: string; body?: string }): Promise<Res> }
  onSaved: (a: string) => void; onError: (e: string) => void; onRemove: () => void
}) {
  const t = useAutosave(p.title, x => api.savePriority({ cycleId, id: p.id, title: x }), onSaved, onError)
  const b = useAutosave(p.body, x => api.savePriority({ cycleId, id: p.id, body: x }), onSaved, onError)
  return (
    <div className={`${CARD} px-5 py-[18px] grid grid-cols-[30px_minmax(0,1fr)_32px] gap-3.5`}>
      <span className="w-7 h-7 rounded-full bg-tn-ink text-[#F2C40A] font-(family-name:--font-display) font-black text-[13px] flex items-center justify-center">{n}</span>
      <div className="flex flex-col gap-2.5 min-w-0">
        <label className="flex flex-col gap-1.5"><span className={FIELD_LABEL}>Title</span><input value={t.value} onChange={e => t.change(e.target.value)} onBlur={t.blur} maxLength={200} className={`${INPUT} w-full font-bold`} /></label>
        <label className="flex flex-col gap-1.5"><span className={FIELD_LABEL}>What it means</span><textarea value={b.value} onChange={e => b.change(e.target.value)} onBlur={b.blur} rows={2} maxLength={2000} className={`${TEXTAREA} w-full`} /></label>
        <div className="flex items-end gap-4 flex-wrap">
          <div className="flex flex-col gap-1.5 w-[240px] max-w-full"><span className={FIELD_LABEL}>Applies to</span><span className={`${INPUT} flex items-center font-semibold text-tn-ink`}>{scope}</span></div>
          {p.changed && <span className="text-[12px] text-muted pb-3">{p.changed}</span>}
        </div>
      </div>
      <button type="button" aria-label="Remove this priority" title="Remove" className={BTN.icon} onClick={onRemove}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
      </button>
    </div>
  )
}
