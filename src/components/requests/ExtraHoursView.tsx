'use client'

/**
 * Extra hours (Clocky part 2, Requests.dc.html):
 *
 *   10E   the allowance this week or month and how much is used; the requests
 *         (a Team Leader's include the people of their teams)
 *   10C   Ask for extra hours: for whom (Team Leaders), how many, which week
 *         or month, the client and why; what the allowance becomes
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { BTN_ICON } from '@/lib/ui/buttons'
import type { ExtraPage } from '@/lib/timeclock/requests-data'
import type { Result } from '@/lib/timeclock/clocky-types'
import { CloseButton, FieldLabel, Icon, LabeledSelect, Modal, MODAL_TITLE, TEXTAREA_PLAIN, Toast, type ToastState } from '@/components/clocky/entries/ui'
import { REQ_TONE } from './ReimbursementsView'

export interface ExtraApi {
  askExtraHours(i: { personId: string; hours: number; when: string; client: string; why: string }): Promise<Result<{ toast: string }>>
}

const PILL = 'font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.05em] uppercase rounded-full px-[9px] py-1 whitespace-nowrap'
const INPUT = 'h-10 box-border px-3 border border-[var(--panel-border)] rounded-[10px] font-sans text-[13px] text-tn-ink outline-none focus:border-tn-teal focus:shadow-[0_0_0_3px_rgba(30,125,127,.15)] tabular-nums lining-nums'

export function ExtraHoursView({ data, api, initial }: { data: ExtraPage; api: ExtraApi; initial?: { form?: boolean; draft?: Partial<Draft> } }) {
  const router = useRouter()
  const [form, setForm] = useState(!!initial?.form)
  const [toast, setToast] = useState<ToastState | null>(null)
  const say = (t: ToastState) => { setToast(t); setTimeout(() => setToast(null), 4200) }
  const a = data.allowance
  const sub = data.forOthers ? 'Ask before someone on your team goes over their allowance. A Super Admin decides.'
    : a ? `Your allowance is ${a.cap.split(' ')[0]} a ${a.period.startsWith('Week') ? 'week' : 'month'}. Going over needs approval before, not a surprise on the invoice.`
      : 'You have no hours allowance: your hours are never flagged as over. Ask here if one is set and you need more.'

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] auto-rows-max content-start gap-4 leading-[normal]">
      <div>
        <Breadcrumb parents={['/requests']} now="Extra hours" />
        <div className="flex items-center justify-between gap-3.5 flex-wrap mt-1.5">
          <h1 className="m-0 font-(family-name:--font-display) font-extrabold text-[30px] leading-[1.15] text-tn-ink" style={{ letterSpacing: '-.01em' }}>Extra hours</h1>
          <button type="button" onClick={() => setForm(true)} className="inline-flex items-center gap-2 border-0 rounded-[10px] px-[18px] py-[11px] bg-tn-primary text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[13px] cursor-pointer hover:bg-[#0a2f6b] shadow-[0_6px_16px_-8px_rgba(1,35,88,.55)]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="3" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>Ask for extra hours
          </button>
        </div>
        <p className="m-0 mt-1 text-[13.5px] text-muted [text-wrap:pretty]">{sub}</p>
      </div>

      {a && (
        <div className="bg-white border border-[var(--panel-border)] rounded-[16px] px-5 py-[18px] flex flex-col gap-3">
          <div className="flex justify-between items-baseline gap-3 flex-wrap">
            <span className="font-(family-name:--font-display) font-extrabold text-[16px] text-tn-ink">{a.period}</span>
            <span className="font-(family-name:--font-display) font-black text-[22px] text-tn-ink tabular-nums lining-nums">{a.used} <span className="text-[14px] text-muted font-bold">of {a.cap}</span></span>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden bg-[var(--row-rule)]"><span style={{ width: `${Math.round(a.share * 100)}%`, background: a.share >= 1 ? '#c8323d' : '#012358' }} /></div>
          <div className="text-[12.5px] text-[#5b6b82] leading-[1.5] tabular-nums lining-nums">{a.note}</div>
        </div>
      )}

      <div className="font-(family-name:--font-display) font-extrabold text-[18px] text-tn-ink">{data.forOthers ? 'Requests' : 'Your requests'}</div>
      <div className="bg-white border border-[var(--panel-border)] rounded-[14px] overflow-hidden">
        {data.rows.map(r => (
          <div key={r.id} className="flex flex-wrap items-center gap-x-5 gap-y-2.5 px-[18px] py-3.5 border-b border-[var(--row-rule)]">
            <span className="flex-[0_0_160px] flex flex-col gap-0.5">
              <span className="font-(family-name:--font-display) font-black text-[16px] text-tn-ink tabular-nums lining-nums">{r.hours}</span>
              <span className="text-[12px] text-muted">{r.when}</span>
            </span>
            <span className="flex-[1_1_240px] flex flex-col gap-0.5 min-w-0">
              <span className="text-[13px] text-tn-ink font-semibold">{r.who ? `${r.who} · ` : ''}{r.client}</span>
              <span className="text-[12.5px] text-foreground leading-[1.45]">{r.why}</span>
            </span>
            <span className="flex-none ml-auto flex flex-col items-end gap-1">
              <span className={PILL} style={{ background: REQ_TONE[r.st.tone].bg, color: REQ_TONE[r.st.tone].fg }}>{r.st.label}</span>
              <span className="text-[11.5px] text-muted">{r.by}</span>
            </span>
          </div>
        ))}
        {!data.rows.length && <div className="px-5 py-11 text-center text-[13.5px] text-muted">No extra hours asked yet.</div>}
      </div>

      {form && <AskExtra data={data} draft={initial?.draft} onClose={() => setForm(false)}
        send={async f => { const r = await api.askExtraHours(f); if (r.ok) { setForm(false); say({ text: r.toast }); router.refresh() } return r }} />}
      <Toast toast={toast} />
    </div>
  )
}

interface Draft { personId: string; hours: string; when: string; client: string; why: string }

function AskExtra({ data, draft, onClose, send }: { data: ExtraPage; draft?: Partial<Draft>; onClose: () => void; send: ExtraApi['askExtraHours'] }) {
  const firstWith = data.people.find(p => p.cap != null) ?? data.people[0]
  const [d, setD] = useState<Draft>({ personId: data.forOthers ? firstWith.id : data.me, hours: '8', when: data.whens[0]?.value ?? '', client: data.clients[0] ?? '', why: '', ...draft })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (p: Partial<Draft>) => setD(x => ({ ...x, ...p }))
  const person = data.people.find(p => p.id === d.personId) ?? data.people[0]
  const when = data.whens.find(w => w.value === d.when)
  const hours = parseFloat(d.hours.replace(',', '.'))
  const ok = hours > 0 && !!d.why.trim() && !!d.client && !!when
  const after = person.cap != null && when && when.period === person.period
    ? `Approved, the allowance for ${when.label} becomes ${person.cap + (hours > 0 ? hours : 0)}h. Hours past that are flagged again.`
    : 'Approved, these hours are added to the allowance for that week or month. Hours past it are flagged again.'

  const submit = async () => {
    if (!ok) return
    setBusy(true)
    setError(null)
    try {
      const r = await send({ personId: d.personId, hours, when: d.when, client: d.client, why: d.why.trim() })
      if (!r.ok) setError(r.error)
    } catch {
      setError('That did not go through. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal label="Ask for extra hours" width={516} onClose={onClose}>
      <div className="flex items-center justify-between gap-2.5">
        <h2 className={MODAL_TITLE}>Ask for extra hours</h2>
        <CloseButton onClick={onClose} />
      </div>
      {data.forOthers && <LabeledSelect label="For" value={d.personId} onChange={v => set({ personId: v })} options={data.people.map(p => ({ value: p.id, label: p.id === data.me ? `${p.name} (you)` : p.name }))} />}
      <div className="text-[12.5px] text-[#5b6b82] bg-[var(--chip-neutral-bg)] rounded-[9px] px-3 py-[9px] leading-[1.5] tabular-nums lining-nums">{person.context}</div>
      <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-3">
        <label className="flex flex-col gap-[5px]"><FieldLabel>How many hours</FieldLabel><input value={d.hours} onChange={e => set({ hours: e.target.value })} inputMode="decimal" className={INPUT} /></label>
        <LabeledSelect label="Which week or month" value={d.when} onChange={v => set({ when: v })} options={data.whens.map(w => ({ value: w.value, label: w.label }))} />
      </div>
      <LabeledSelect label="Client or project" value={d.client} search onChange={v => set({ client: v })} options={data.clients.map(c => ({ value: c, label: c }))} />
      <label className="flex flex-col gap-[5px]"><FieldLabel>Why</FieldLabel><textarea value={d.why} onChange={e => set({ why: e.target.value })} rows={3} placeholder="What the extra hours are for, and who asked" className={TEXTAREA_PLAIN} /></label>
      <div className="text-[12.5px] text-tn-teal font-semibold leading-[1.5] bg-tn-teal-soft rounded-[10px] px-3 py-2.5">{after}</div>
      {error && <p role="alert" className="m-0 text-[12.5px] font-semibold text-[#c8323d]">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="border border-slate-200 rounded-[10px] px-4 py-2.5 bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[13px] cursor-pointer hover:border-tn-teal">Cancel</button>
        <button type="button" disabled={!ok || busy} onClick={() => void submit()} className="inline-flex items-center gap-2 border-0 rounded-[10px] px-[18px] py-[11px] bg-tn-primary text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[13px] cursor-pointer hover:bg-[#0a2f6b] disabled:opacity-45 disabled:cursor-not-allowed">
          <Icon d="M22 2 11 13M22 2l-7 20-4-9-9-4z" size={14} color={BTN_ICON.navy} width={2.4} />{busy ? 'Sending…' : 'Send request'}
        </button>
      </div>
    </Modal>
  )
}
