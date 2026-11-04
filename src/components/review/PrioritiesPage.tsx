'use client'

/**
 * Step 0, Priorities (design handoff, A3): the VP of Operations and the CISO
 * write the whole-company priorities, approve each team's (Approve opens the
 * team's self-reviews at once; Send back returns them with a reason; Edit
 * changes their text), and see where each team is. On the right, the changes.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BTN } from '@/lib/ui/buttons'
import { CARD, FIELD_LABEL, PAGE_TITLE } from '@/lib/ui/type'
import { INPUT, TEXTAREA } from '@/lib/ui/fields'
import { Pill } from '@/components/ui/Pill'
import { Toast, Modal, type ToastState } from '@/components/clocky/entries/ui'
import { fmtTime, fmtInstantDay, initials } from '@/lib/review/format'
import { useAutosave } from './parts'

type Res = { ok: true; toast?: string; savedAt?: string; id?: number } | { ok: false; error: string }
export interface PriorityRow { id: number; title: string; body: string; changed: string | null }
export interface TeamRow { teamId: string; name: string; leader: string; state: 'draft' | 'sent' | 'approved' | 'returned' | 'none'; line: string; sentLine: string | null; members: number; priorities: PriorityRow[] }

export function PrioritiesPage({ cycleId, year, intro, notice, company, teams, noLeader, log, api }: {
  cycleId: number; year: number; intro: string; notice: string | null
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
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[260px] flex flex-col gap-1.5">
          <h1 className={PAGE_TITLE}>Priorities for {year + 1}</h1>
          <p className="m-0 text-[15px] text-muted leading-relaxed">{intro}</p>
        </div>
        {saved && <span className="text-[12.5px] text-muted">Saved · {fmtTime(saved)}</span>}
      </div>
      {notice && <p className="m-0 rounded-[12px] bg-[var(--bdg-blue-bg)] px-4 py-3 text-[13.5px] text-tn-ink">{notice}</p>}

      <div className="flex gap-5 items-start flex-wrap min-[1100px]:flex-nowrap">
        <div className="flex-1 min-w-0 flex flex-col gap-5 w-full">
          {waiting.length > 0 && (
            <section className={`${CARD} border-tn-teal px-[22px] py-5 flex flex-col gap-4`}>
              <div className="flex items-center gap-2"><h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink">Team priorities to approve</h2><Pill tone="amber" text={`${waiting.length} waiting`} /></div>
              {waiting.map(t => (
                <div key={t.teamId} className="flex flex-col gap-3 border-t border-[var(--row-rule)] pt-4 first:border-t-0 first:pt-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="w-9 h-9 rounded-full bg-subtle flex items-center justify-center font-(family-name:--font-display) font-extrabold text-[11px] text-muted">{initials(t.leader)}</span>
                    <div className="flex-1 min-w-[200px] flex flex-col"><span className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">{t.leader}, Team Leader · {t.name}</span><span className="text-[12.5px] text-muted">{t.sentLine}</span></div>
                    <Pill tone="amber" text="Waiting for you" />
                  </div>
                  <div className="flex flex-col gap-2">
                    {t.priorities.map((p, i) => editing === t.teamId
                      ? <EditRow key={p.id} n={i + 1} p={p} cycleId={cycleId} api={api} onSaved={setSaved} onError={e => say(e, true)} onRemove={() => run(() => api.removePriority({ id: p.id }))} />
                      : <div key={p.id} className="rounded-[12px] bg-subtle px-4 py-3 flex gap-3"><span className="font-(family-name:--font-display) font-extrabold text-tn-teal">{i + 1}</span><div className="flex flex-col gap-0.5"><span className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">{p.title}</span><span className="text-[13px] text-muted">{p.body}</span></div></div>)}
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="flex-1 min-w-[200px] text-[12.5px] text-muted">Approving opens the self-reviews of the {t.members} {t.members === 1 ? 'person' : 'people'} in the {t.name}. Either of you can approve.</span>
                    <button type="button" disabled={busy} className={BTN.smallWhite} onClick={() => setBack(t)}>Send back</button>
                    <button type="button" disabled={busy} className={BTN.smallWhite} onClick={() => setEditing(e => e === t.teamId ? null : t.teamId)}>{editing === t.teamId ? 'Done' : 'Edit'}</button>
                    <button type="button" disabled={busy} className={`${BTN.smallNavy} disabled:opacity-50`} onClick={() => run(() => api.approveTeamPriorities({ cycleId, teamId: t.teamId }))}>Approve</button>
                  </div>
                </div>
              ))}
            </section>
          )}

          <section className={`${CARD} px-[22px] py-5 flex flex-col gap-4`}>
            <div className="flex items-baseline gap-2.5 flex-wrap"><h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink">Whole company</h2><span className="text-[13px] text-muted">{company.length} {company.length === 1 ? 'priority' : 'priorities'} · You write these. They show in every review.</span></div>
            {company.map((p, i) => <EditRow key={p.id} n={i + 1} p={p} cycleId={cycleId} api={api} onSaved={setSaved} onError={e => say(e, true)} onRemove={() => run(() => api.removePriority({ id: p.id }))} />)}
            <div><button type="button" disabled={busy} className={BTN.smallWhite} onClick={() => run(() => api.savePriority({ cycleId, teamId: null, title: '', body: '' }))}>+ Add a whole-company priority</button></div>
          </section>

          <section className={`${CARD} px-[22px] py-5 flex flex-col gap-3`}>
            <div className="flex items-baseline gap-2.5 flex-wrap"><h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink">Teams</h2><span className="text-[13px] text-muted">{teams.length} teams · Each Team Leader writes them in their own self-review. They show only in the reviews of that team.</span></div>
            {teams.map(t => (
              <div key={t.teamId} className="flex items-center gap-3 py-2.5 border-t border-[var(--row-rule)] first:border-t-0 flex-wrap">
                <span className="w-9 h-9 rounded-full bg-subtle flex items-center justify-center font-(family-name:--font-display) font-extrabold text-[11px] text-muted flex-none">{initials(t.leader)}</span>
                <div className="flex-1 min-w-[200px] flex flex-col"><span className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">{t.name} <span className="font-sans font-semibold text-muted text-[13px]">{t.leader}</span></span><span className="text-[12.5px] text-muted">{t.line}</span></div>
                {t.state === 'approved' ? <Pill tone="green" text="Approved" /> : t.state === 'sent' ? <Pill tone="amber" text="Waiting for you" /> : t.state === 'returned' ? <Pill tone="amber" text="Sent back" /> : <Pill tone="gray" text="Not sent yet" />}
              </div>
            ))}
            {noLeader.length > 0 && <p className="m-0 text-[12.5px] text-muted">{noLeader.join(' and ')} {noLeader.length === 1 ? 'has' : 'have'} no Team Leader, so {noLeader.length === 1 ? 'it has' : 'they have'} no team priorities. Their people do the self-review with the Team Leaders.</p>}
          </section>
        </div>

        <aside className={`${CARD} w-full min-[1100px]:w-[320px] flex-none min-[1100px]:sticky top-[calc(var(--chrome-top,64px)+16px)] px-5 py-4 flex flex-col gap-3 max-h-[calc(100vh-140px)] overflow-y-auto [scrollbar-width:none]`}>
          <span className={FIELD_LABEL}>Changes</span>
          {log.map((l, i) => (
            <div key={i} className="flex gap-2.5 text-[12.5px] leading-[1.45]">
              <span className="w-7 h-7 rounded-full bg-subtle flex items-center justify-center font-(family-name:--font-display) font-extrabold text-[9.5px] text-muted flex-none">{initials(l.who || '?')}</span>
              <span className="flex flex-col"><span className="text-[#435066]">{l.text}</span><span className="text-muted">{fmtInstantDay(l.at)}, {fmtTime(l.at)}</span></span>
            </div>
          ))}
          {!log.length && <span className="text-[12.5px] text-muted">No changes yet.</span>}
        </aside>
      </div>

      {back && <ReturnDialog team={back} onClose={() => setBack(null)} onSend={reason => { const t = back; setBack(null); void run(() => api.returnTeamPriorities({ cycleId, teamId: t.teamId, reason })) }} />}
      <Toast toast={toast} />
    </div>
  )
}

function EditRow({ n, p, cycleId, api, onSaved, onError, onRemove }: {
  n: number; p: PriorityRow; cycleId: number; api: { savePriority(i: { cycleId: number; id?: number | null; title?: string; body?: string }): Promise<Res> }
  onSaved: (a: string) => void; onError: (e: string) => void; onRemove: () => void
}) {
  const t = useAutosave(p.title, x => api.savePriority({ cycleId, id: p.id, title: x }), onSaved, onError)
  const b = useAutosave(p.body, x => api.savePriority({ cycleId, id: p.id, body: x }), onSaved, onError)
  return (
    <div className="rounded-[12px] border border-[var(--panel-border)] px-4 py-3.5 flex gap-3">
      <span className="flex-none w-6 h-6 rounded-full bg-[#eaf4f4] text-tn-teal font-(family-name:--font-display) font-extrabold text-[11px] flex items-center justify-center mt-6">{n}</span>
      <div className="flex-1 min-w-0 flex flex-col gap-2.5">
        <label className="flex flex-col gap-1.5"><span className={FIELD_LABEL}>Title</span><input value={t.value} onChange={e => t.change(e.target.value)} onBlur={t.blur} maxLength={200} className={`${INPUT} w-full font-semibold`} /></label>
        <label className="flex flex-col gap-1.5"><span className={FIELD_LABEL}>What it means</span><textarea value={b.value} onChange={e => b.change(e.target.value)} onBlur={b.blur} rows={2} maxLength={2000} className={`${TEXTAREA} w-full`} /></label>
        <div className="flex items-center gap-3 flex-wrap"><span className={FIELD_LABEL}>Applies to</span><span className="text-[13px] text-tn-ink">Whole company</span>{p.changed && <span className="text-[12px] text-muted">· {p.changed}</span>}</div>
      </div>
      <button type="button" aria-label="Remove this priority" className={BTN.icon} onClick={onRemove}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
      </button>
    </div>
  )
}

function ReturnDialog({ team, onClose, onSend }: { team: TeamRow; onClose: () => void; onSend: (r: string) => void }) {
  const [reason, setReason] = useState('')
  return (
    <Modal label={`Send the ${team.name}'s priorities back?`} width={460} onClose={onClose}>
      <h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[19px] text-tn-ink">Send the {team.name}&apos;s priorities back?</h2>
      <p className="m-0 text-[13.5px] text-[#435066]">{team.leader} gets them back in their self-review, with your reason, to change and send again.</p>
      <label className="flex flex-col gap-1.5"><span className={FIELD_LABEL}>Reason ({team.leader.split(' ')[0]} sees it)</span><textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} autoFocus className={`${TEXTAREA} w-full`} /></label>
      <div className="flex justify-end gap-2.5"><button type="button" className={BTN.white} onClick={onClose}>Cancel</button><button type="button" disabled={!reason.trim()} className={`${BTN.navy} disabled:opacity-50`} onClick={() => onSend(reason.trim())}>Send back</button></div>
    </Modal>
  )
}
