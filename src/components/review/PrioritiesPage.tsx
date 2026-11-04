'use client'

/**
 * Step 0, Priorities (design handoff, A3): the VP of Operations and the CISO
 * write the whole-company priorities, approve each team's (Approve opens the
 * team's self-reviews at once; Send back returns them with a reason; Edit
 * changes their text), and see where each team is. On the right, the changes.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BTN, BTN_ICON } from '@/lib/ui/buttons'
import { CARD, FIELD_LABEL, PAGE_TITLE } from '@/lib/ui/type'
import { INPUT, TEXTAREA } from '@/lib/ui/fields'
import { Pill } from '@/components/ui/Pill'
import { Toast, Modal, type ToastState } from '@/components/clocky/entries/ui'
import { fmtTime, fmtInstantDay, initials } from '@/lib/review/format'
import { useAutosave } from './parts'
import { APR_COLORS } from '@/lib/review/colors'

type Res = { ok: true; toast?: string; savedAt?: string; id?: number } | { ok: false; error: string }
export interface PriorityRow { id: number; title: string; body: string; changed: string | null }
export interface TeamRow { teamId: string; name: string; leader: string; state: 'draft' | 'sent' | 'approved' | 'returned' | 'none'; line: string
  /** Set when the viewer leads this team: who approves it instead. */
  decider: string | null; sentLine: string | null; members: number; priorities: PriorityRow[] }

export function PrioritiesPage({ cycleId, year, intro, notice, editors, company, teams, noLeader, log, api }: {
  cycleId: number; year: number; intro: string; notice: string | null
  /** The VP of Operations and the CISO, drawn as the page's two writers. */
  editors: string[]
  company: PriorityRow[]; teams: TeamRow[]; noLeader: string[]; log: { who: string; text: string; at: string }[]
  api: {
    savePriority(i: { cycleId: number; id?: number | null; teamId?: string | null; title?: string; body?: string }): Promise<Res>
    removePriority(i: { id: number }): Promise<Res>
    approveTeamPriorities(i: { cycleId: number; teamId: string }): Promise<Res>
    returnTeamPriorities(i: { cycleId: number; teamId: string; reason: string }): Promise<Res>
  }
}) {
  const router = useRouter()
  const [toast, setToast] = useState<ToastState | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [back, setBack] = useState<TeamRow | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const say = (text: string, error = false) => { setToast({ text, error }); setTimeout(() => setToast(null), 5000) }
  const run = async (go: () => Promise<Res>) => {
    setBusy(true)
    try { const r = await go(); if (r.ok) { if (r.toast) say(r.toast); router.refresh() } else say(r.error, true) } catch { say('That did not go through. Try again.', true) } finally { setBusy(false) }
  }
  const waiting = teams.filter(t => t.state === 'sent')
  const H2 = 'm-0 font-(family-name:--font-display) font-extrabold text-[16px] text-tn-ink'
  const COUNT = 'text-[12px] font-bold text-[#5b6b82] bg-[#f1f3f6] rounded-full px-[9px] py-0.5'
  const NUM = 'flex-none rounded-full bg-tn-ink text-[#F2C40A] font-(family-name:--font-display) font-black flex items-center justify-center'
  const BADGE = 'flex-none rounded-full bg-[#eef1f5] border border-[#dfe4ea] text-[#435066] font-(family-name:--font-display) font-extrabold flex items-center justify-center'
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex-1 min-w-[260px] flex flex-col gap-1.5">
          <h1 className={PAGE_TITLE}>Priorities for {year + 1}</h1>
          <p className="m-0 text-[15px] text-muted leading-relaxed">{intro}</p>
        </div>
        <div className="flex items-center gap-3.5">
          {saved && <span className="flex items-center gap-1.5 text-[12.5px] text-muted whitespace-nowrap"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1E9E6A" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>Saved · {fmtTime(saved)}</span>}
          {editors.length > 0 && <span className="flex" title={editors.join(' and ')}>{editors.map((e, i) => <span key={e} className={`${BADGE} w-8 h-8 border-2 border-white text-[11px]${i ? ' -ml-2' : ''}`}>{initials(e)}</span>)}</span>}
        </div>
      </div>

      <div className="flex gap-5 items-start flex-wrap min-[1100px]:flex-nowrap">
        <div className="flex-1 min-w-0 flex flex-col gap-3.5 w-full">
          {notice && <div className="flex items-center gap-3 rounded-[12px] bg-[#eaf4f4] px-4 py-3 text-[13.5px] text-[#12585a]"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="flex-none" aria-hidden="true"><path d="M4 5h16v16H4zM4 10h16M9 3v4M15 3v4" /></svg>{notice}</div>}

          {waiting.length > 0 && (
            <section className="flex flex-col gap-2.5">
              <div className="flex items-baseline gap-2.5 flex-wrap"><h2 className={H2}>Team priorities to approve</h2><span className="text-[12.5px] text-muted">{waiting.length} waiting</span></div>
              {waiting.map(t => (
                <div key={t.teamId} className="rounded-[14px] bg-[#fffdf6] border border-[#e9d48a] px-5 py-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className={`${BADGE} w-7 h-7 text-[10px]`}>{initials(t.leader)}</span>
                    <span className="text-[13px] font-bold text-tn-ink">{t.leader}, Team Leader</span>
                    <span className="text-[12.5px] text-muted">{t.sentLine}</span>
                    <span className="flex-1" />
                    <Pill tone="amber" text={t.decider ? `Waiting for ${t.decider}` : 'Waiting for you'} />
                  </div>
                  <div className="flex flex-col gap-2.5">
                    <span className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.08em] uppercase text-[#1E7D7F]">{t.name}</span>
                    {t.priorities.map((p, i) => editing === t.teamId
                      ? <EditRow key={p.id} n={i + 1} p={p} scope={t.name} cycleId={cycleId} api={api} onSaved={setSaved} onError={e => say(e, true)} onRemove={() => run(() => api.removePriority({ id: p.id }))} />
                      : <div key={p.id} className="grid grid-cols-[26px_minmax(0,1fr)] gap-2.5"><span className={`${NUM} w-6 h-6 text-[12px]`}>{i + 1}</span><div className="flex flex-col gap-[3px] min-w-0"><span className="text-[14.5px] font-extrabold text-tn-ink">{p.title}</span><span className="text-[13.5px] leading-[1.55] text-[#435066]">{p.body}</span></div></div>)}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#f3ead0]">
                    <span className="flex-1 min-w-[200px] text-[12.5px] text-muted">{t.decider ? `You lead the ${t.name}, so ${t.decider} approves these. Approving opens the self-reviews of its ${t.members} ${t.members === 1 ? 'person' : 'people'}.` : `Approving opens the self-reviews of the ${t.members} ${t.members === 1 ? 'person' : 'people'} in the ${t.name}. Either of you can approve.`}</span>
                    {!t.decider && <>
                    <button type="button" disabled={busy} className={BTN.smallWhite} onClick={() => setBack(t)}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" /></svg>Send back</button>
                    <button type="button" disabled={busy} className={BTN.smallWhite} onClick={() => setEditing(e => e === t.teamId ? null : t.teamId)}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>{editing === t.teamId ? 'Done' : 'Edit'}</button>
                    <button type="button" disabled={busy} className={`${BTN.smallNavy} disabled:opacity-50`} onClick={() => run(() => api.approveTeamPriorities({ cycleId, teamId: t.teamId }))}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>Approve</button>
                    </>}
                  </div>
                </div>
              ))}
            </section>
          )}

          <section className="flex flex-col gap-2.5 pt-1.5">
            <div className="flex items-baseline gap-2.5 flex-wrap"><h2 className={H2}>Whole company</h2><span className={COUNT}>{company.length} {company.length === 1 ? 'priority' : 'priorities'}</span><span className="text-[12.5px] text-muted">You write these. They show in every review.</span></div>
            {company.map((p, i) => <EditRow key={p.id} n={i + 1} p={p} scope="Whole company" cycleId={cycleId} api={api} onSaved={setSaved} onError={e => say(e, true)} onRemove={() => run(() => api.removePriority({ id: p.id }))} />)}
          </section>
          <div><button type="button" disabled={busy} className={BTN.smallWhite} onClick={() => run(() => api.savePriority({ cycleId, teamId: null, title: '', body: '' }))}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>Add a whole-company priority</button></div>

          <section className="flex flex-col gap-2.5 pt-1.5">
            <div className="flex items-baseline gap-2.5 flex-wrap"><h2 className={H2}>Teams</h2><span className={COUNT}>{teams.length} {teams.length === 1 ? 'team' : 'teams'}</span><span className="text-[12.5px] text-muted">Each Team Leader writes them in their own self-review. They show only in the reviews of that team.</span></div>
            <div className="rounded-[14px] border border-[#e4e7ec] overflow-hidden flex flex-col gap-px bg-[#f1f3f6]">
              {teams.map(t => (
                <div key={t.teamId} className="bg-white grid gap-4 items-center px-[18px] py-3.5 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto]">
                  <div className="flex items-center gap-2.5 min-w-0"><span className={`${BADGE} w-8 h-8 text-[10px]`}>{initials(t.leader)}</span><div className="flex flex-col gap-px min-w-0"><span className="text-[14px] font-extrabold text-tn-ink">{t.name}</span><span className="text-[12.5px] text-muted">{t.leader}</span></div></div>
                  <span className="text-[13px] leading-normal text-[#435066]">{t.line}</span>
                  <span className="flex sm:justify-end">{t.state === 'approved' ? <Pill tone="green" text="Approved" /> : t.state === 'sent' ? <Pill tone="amber" text={t.decider ? `Waiting for ${t.decider}` : 'Waiting for you'} /> : t.state === 'returned' ? <Pill tone="amber" text="Sent back" /> : <Pill tone="gray" text="Not sent yet" />}</span>
                </div>
              ))}
            </div>
            {noLeader.length > 0 && <p className="m-0 text-[13px] leading-normal text-muted">{noLeader.join(', ').replace(/, ([^,]*)$/, ' and $1')} {noLeader.length === 1 ? 'has' : 'have'} no Team Leader, so {noLeader.length === 1 ? 'it has' : 'they have'} no team priorities. Their people do the self-review with the Team Leaders.</p>}
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

      {back && <ReturnDialog team={back} onClose={() => setBack(null)} onSend={reason => { const t = back; setBack(null); void run(() => api.returnTeamPriorities({ cycleId, teamId: t.teamId, reason })) }} />}
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

function ReturnDialog({ team, onClose, onSend }: { team: TeamRow; onClose: () => void; onSend: (r: string) => void }) {
  const [reason, setReason] = useState('')
  return (
    <Modal label={`Send the ${team.name}'s priorities back?`} width={460} onClose={onClose}><div className="contents" style={APR_COLORS}>
      <h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[19px] text-tn-ink">Send the {team.name}&apos;s priorities back?</h2>
      <p className="m-0 text-[13.5px] text-[#435066]">{team.leader} gets them back in their self-review, with your reason, to change and send again.</p>
      <label className="flex flex-col gap-1.5"><span className={FIELD_LABEL}>Reason ({team.leader.split(' ')[0]} sees it)</span><textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} autoFocus className={`${TEXTAREA} w-full`} /></label>
      <div className="flex justify-end gap-2.5"><button type="button" className={BTN.white} onClick={onClose}>Cancel</button><button type="button" disabled={!reason.trim()} className={`${BTN.navy} disabled:opacity-50`} onClick={() => onSend(reason.trim())}>Send back</button></div>
    </div></Modal>
  )
}
