'use client'

/**
 * Company settings for Clocky part 2 (Company Settings.dc.html):
 *
 *   13A  IntegrationsSettings   Rippling and Google Calendar: the connection,
 *        what each sends and reads, Test connection, the errors with Try again
 *   13B  InvoiceSettings        numbering, who approves invoices, billing
 *        details, payment terms, and how an invoice reads
 *   13C  RemindersSettings      the timesheet reminders, on or off, and the
 *        bell lines part 2 adds
 *
 * Read only below Super Admin ("Read only at the Admin level.").
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BTN_ICON } from '@/lib/ui/buttons'
import type { IntegrationsData, InvoiceSettingsData } from '@/lib/timeclock/company-settings'
import type { ReminderKey } from '@/lib/timeclock/reminder-kinds'
import { REMINDERS } from '@/lib/timeclock/reminder-kinds'
import { InvoiceDoc } from '@/components/clocky/invoices/InvoiceDoc'
import { openDrawer } from '@/components/NotificationButton'
import { FieldLabel, Icon, Modal, MODAL_TITLE, TEXTAREA_PLAIN, Toast, type ToastState } from '@/components/clocky/entries/ui'

type Done = { ok: true; toast: string } | { ok: false; error: string }
const INPUT = 'h-10 box-border px-3 border border-[var(--panel-border)] rounded-[10px] text-[13px] text-tn-ink outline-none bg-white focus:border-tn-teal focus:shadow-[0_0_0_3px_rgba(30,125,127,.15)] disabled:bg-subtle disabled:text-muted'
const BTN_W = 'inline-flex items-center gap-2 border border-slate-200 rounded-[10px] px-3.5 py-[9px] bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[12.5px] cursor-pointer hover:border-tn-teal disabled:opacity-50'
const BTN_N = 'inline-flex items-center gap-2 border-0 rounded-[10px] px-[18px] py-[11px] bg-tn-primary text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[13px] cursor-pointer hover:bg-[#0a2f6b] disabled:opacity-50'
const LABEL = 'font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted'
const REFRESH = 'M21 12a9 9 0 1 1-3-6.7M21 4v5h-5'

function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null)
  const say = (t: ToastState) => { setToast(t); setTimeout(() => setToast(null), 4200) }
  return [toast, say] as const
}

function ReadOnly() {
  return <span className="self-start text-[12px] text-[#5b6b82] bg-[var(--chip-neutral-bg)] rounded-full px-[11px] py-[5px]">Read only at the Admin level. Super Admins change company settings.</span>
}

// ── 13A ─────────────────────────────────────────────────────────────────────

export interface IntegrationsApi {
  saveRipplingToken(i: { token: string }): Promise<Done>
  removeRipplingToken(): Promise<Done>
  saveGoogle(i: { serviceAccount?: string; teamCalendarId: string; goodNewsCalendarId: string }): Promise<Done>
  removeGoogle(): Promise<Done>
  testGoogle(): Promise<Done>
  retryIntegrationJob(i: { id: number }): Promise<Done>
}

export function IntegrationsSettings({ data, canEdit, api }: { data: IntegrationsData; canEdit: boolean; api: IntegrationsApi }) {
  const router = useRouter()
  const [toast, say] = useToast()
  const [busy, setBusy] = useState(false)
  const [modal, setModal] = useState<'rippling' | 'google' | null>(null)
  const [team, setTeam] = useState(data.google.teamCalendarId)
  const [good, setGood] = useState(data.google.goodNewsCalendarId)
  const run = async (p: Promise<Done>, after?: () => void) => {
    setBusy(true)
    try {
      const r = await p
      say(r.ok ? { text: r.toast } : { text: r.error, error: true })
      if (r.ok) { after?.(); router.refresh() }
    } catch {
      say({ text: 'That did not go through. Check your connection and try again.', error: true })
    } finally {
      setBusy(false)
    }
  }
  const cards = [
    { key: 'rippling' as const, mark: 'R', icBg: '#fbf1e6', icFg: '#92400E', name: 'Rippling', on: data.rippling.tokenSaved, onLabel: 'Token saved', d: data.rippling },
    { key: 'google' as const, mark: 'G', icBg: '#eaf4f4', icFg: '#1E7D7F', name: 'Google Calendar', on: data.google.connected, onLabel: 'Connected', d: data.google },
  ]
  return (
    <div className="flex flex-col gap-[18px]">
      {!canEdit && <ReadOnly />}
      {cards.map(g => (
        <div key={g.key} className="bg-white border border-[var(--panel-border)] rounded-[16px] px-[22px] py-5 flex flex-col gap-4">
          <div className="flex items-center gap-3.5 flex-wrap">
            <span className="w-11 h-11 rounded-[12px] flex items-center justify-center font-(family-name:--font-display) font-black text-[18px] flex-none" style={{ background: g.icBg, color: g.icFg }}>{g.mark}</span>
            <div className="flex-1 min-w-[200px] flex flex-col gap-[3px]">
              <div className="flex items-center gap-2.5">
                <span className="font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink leading-[normal]">{g.name}</span>
                <span className={`font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.05em] uppercase rounded-full px-[9px] py-1 ${g.on ? 'bg-[#e6f6ee] text-[#0d7a4f]' : 'bg-[var(--chip-neutral-bg)] text-[#5b6b82]'}`}>{g.on ? g.onLabel : 'Not connected'}</span>
              </div>
              <span className="text-[12.5px] text-muted">{g.d.who}</span>
            </div>
            {g.key === 'google' && data.google.saved && (
              <button type="button" disabled={busy} onClick={() => void run(api.testGoogle())} className={BTN_W}>
                <Icon d={REFRESH} size={14} color={BTN_ICON.white} width={2.2} />Test connection
              </button>
            )}
            {canEdit && (
              <button type="button" disabled={busy} onClick={() => setModal(g.key)} className={BTN_W}>
                {g.key === 'rippling' ? (data.rippling.tokenSaved ? 'Replace token' : 'Connect') : data.google.saved ? 'Replace key' : 'Connect'}
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {g.d.facts.map(f => (
              <div key={f.k} className="bg-subtle rounded-[12px] px-[13px] py-[11px] flex flex-col gap-1">
                <span className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.08em] uppercase text-muted">{f.k}</span>
                <span className="text-[13px] text-tn-ink font-semibold leading-[1.45]">{f.v}</span>
              </div>
            ))}
          </div>
          {g.key === 'google' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex flex-col gap-[5px]">
                <span className={LABEL}>Team calendar</span>
                <input value={team} onChange={e => setTeam(e.target.value)} disabled={!canEdit} placeholder="c_xxx@group.calendar.google.com" className={`${INPUT} font-mono text-[12.5px]`} />
                <span className="text-[11.5px] text-muted">The calendar the team already uses. The portal adds PTO to it.</span>
              </label>
              <label className="flex flex-col gap-[5px]">
                <span className={LABEL}>Good News Calendar</span>
                <input value={good} onChange={e => setGood(e.target.value)} disabled={!canEdit} placeholder="c_xxx@group.calendar.google.com" className={`${INPUT} font-mono text-[12.5px]`} />
                <span className="text-[11.5px] text-muted">Read into Agenda with its own colour and a &quot;Good News&quot; tag.</span>
              </label>
              {canEdit && (team !== data.google.teamCalendarId || good !== data.google.goodNewsCalendarId) && (
                <div className="md:col-span-2 flex justify-end">
                  <button type="button" disabled={busy} onClick={() => void run(api.saveGoogle({ teamCalendarId: team, goodNewsCalendarId: good }))} className={BTN_N}>
                    <Icon d="M5 12l5 5 9-10" size={14} color={BTN_ICON.navy} width={3} />Save the calendars
                  </button>
                </div>
              )}
            </div>
          )}
          {g.d.errors.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className={LABEL}>Errors</span>
              <div className="border border-[var(--panel-border)] rounded-[12px] overflow-hidden">
                {g.d.errors.map(e => (
                  // On a phone: when and the button on one line, then what it was, then the error.
                  <div key={e.id} className={`grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[150px_110px_minmax(0,1fr)_120px] gap-x-2.5 gap-y-1 md:gap-y-2.5 items-center px-3.5 py-2.5 border-b border-[var(--row-rule)] text-[12.5px] ${e.failed ? 'bg-[#fdeeef]' : 'bg-white'}`}>
                    <span className="text-tn-ink font-semibold">{e.when}</span>
                    <span className="max-md:col-span-2 max-md:row-start-2 text-foreground">{e.what}</span>
                    <span className={`max-md:col-span-2 max-md:row-start-3 leading-[1.45] ${e.failed ? 'text-[#c8323d]' : 'text-foreground'}`}>{e.text}</span>
                    <span className="max-md:col-start-2 max-md:row-start-1 justify-self-end text-right">
                      {e.failed && canEdit && <button type="button" disabled={busy} onClick={() => void run(api.retryIntegrationJob({ id: e.id }))} className="border-0 rounded-[9px] px-3 py-[7px] bg-tn-primary text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[12px] leading-[normal] cursor-pointer">Try again</button>}
                      {e.doneText && <span className="text-[11.5px] font-bold text-[#0d7a4f]">{e.doneText}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
      {modal === 'rippling' && <SecretDialog title="Rippling API token" hint="The company's API token from Rippling (Settings, API access). Only its last four characters are shown again."
        placeholder="Paste the token" multiline={false} canRemove={data.rippling.tokenSaved} busy={busy} onClose={() => setModal(null)}
        onSave={v => void run(api.saveRipplingToken({ token: v }), () => setModal(null))} onRemove={() => void run(api.removeRipplingToken(), () => setModal(null))} />}
      {modal === 'google' && <SecretDialog title="Google service account key" hint="The JSON key of a Google Cloud service account. Share the team calendar (to change events) and the Good News Calendar (to see them) with its address."
        placeholder='{"type": "service_account", ...}' multiline canRemove={data.google.saved} busy={busy} onClose={() => setModal(null)}
        onSave={v => void run(api.saveGoogle({ serviceAccount: v, teamCalendarId: team, goodNewsCalendarId: good }), () => setModal(null))} onRemove={() => void run(api.removeGoogle(), () => setModal(null))} />}
      <Toast toast={toast} />
    </div>
  )
}

function SecretDialog({ title, hint, placeholder, multiline, canRemove, busy, onClose, onSave, onRemove }: {
  title: string; hint: string; placeholder: string; multiline: boolean; canRemove: boolean; busy: boolean
  onClose: () => void; onSave: (v: string) => void; onRemove: () => void
}) {
  const [v, setV] = useState('')
  return (
    <Modal label={title} width={480} onClose={onClose}>
      <h2 className={MODAL_TITLE}>{title}</h2>
      <p className="m-0 text-[13px] text-foreground leading-[1.55]">{hint}</p>
      <label className="flex flex-col gap-[5px]">
        <FieldLabel>{multiline ? 'Key' : 'Token'}</FieldLabel>
        {multiline
          ? <textarea value={v} onChange={e => setV(e.target.value)} rows={6} placeholder={placeholder} spellCheck={false} autoComplete="off" className={`${TEXTAREA_PLAIN} font-mono text-[12px]`} />
          : <input value={v} onChange={e => setV(e.target.value)} type="password" placeholder={placeholder} autoComplete="off" className={`${INPUT} font-mono`} />}
      </label>
      <div className="text-[12px] text-muted">Kept on the server only, never shown again and never sent to a browser.</div>
      <div className="flex justify-end gap-2 items-center">
        {canRemove && <button type="button" disabled={busy} onClick={onRemove} className="mr-auto border border-slate-200 rounded-[10px] px-4 py-2.5 bg-white text-[#c8323d] font-(family-name:--font-display) font-extrabold text-[13px] cursor-pointer hover:border-[#c8323d]">Remove</button>}
        <button type="button" onClick={onClose} className="border border-slate-200 rounded-[10px] px-4 py-2.5 bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[13px] cursor-pointer hover:border-tn-teal">Cancel</button>
        <button type="button" disabled={!v.trim() || busy} onClick={() => onSave(v.trim())} className={BTN_N}><Icon d="M5 12l5 5 9-10" size={14} color={BTN_ICON.navy} width={3} />Save</button>
      </div>
    </Modal>
  )
}

// ── 13B ─────────────────────────────────────────────────────────────────────

export function InvoiceSettings({ data, canEdit, save }: { data: InvoiceSettingsData; canEdit: boolean; save: (i: { prefix: string; nextNumber: string; rmbPrefix: string; billingName: string; address: string; country: string; email: string; paymentDays: string }) => Promise<Done> }) {
  const router = useRouter()
  const [toast, say] = useToast()
  const [busy, setBusy] = useState(false)
  const [f, setF] = useState({ prefix: data.prefix, nextNumber: data.nextNumber, rmbPrefix: data.rmbPrefix, billingName: data.billing.name, address: data.billing.address, country: data.billing.country, email: data.billing.email, paymentDays: String(data.paymentDays) })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF(x => ({ ...x, [k]: e.target.value }))
  const y = data.nextInvoice.split('-')[1]
  const nextInv = `${f.prefix.toUpperCase()}-${y}-${String(Number(f.nextNumber) || 0).padStart(4, '0')}`
  const nextRmb = `${f.rmbPrefix.toUpperCase()}-${y}-${data.nextRmb.split('-')[2]}`
  const due = (() => { const d = new Date(Date.UTC(Number(y), 11, 1)); d.setUTCDate(d.getUTCDate() + (parseInt(f.paymentDays, 10) || 0)); return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}` })()
  const field = (k: keyof typeof f, label: string, num = false) => (
    <label key={k} className="flex flex-col gap-[5px]"><span className={LABEL}>{label}</span><input value={f[k]} onChange={set(k)} disabled={!canEdit} inputMode={num ? 'numeric' : undefined} className={`${INPUT} ${num ? 'tabular-nums lining-nums' : ''}`} /></label>
  )
  const submit = async () => {
    setBusy(true)
    try {
      const r = await save(f)
      say(r.ok ? { text: r.toast } : { text: r.error, error: true })
      if (r.ok) router.refresh()
    } catch {
      say({ text: 'That did not go through. Check your connection and try again.', error: true })
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-col gap-[18px]">
      {!canEdit && <ReadOnly />}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)] gap-4 items-start">
        <div className="bg-white border border-[var(--panel-border)] rounded-[16px] px-[22px] py-5 flex flex-col gap-3.5">
          <span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">Numbering</span>
          <div className="grid grid-cols-3 gap-3">{field('prefix', 'Prefix')}{field('nextNumber', 'Next number', true)}{field('rmbPrefix', 'Reimbursement prefix')}</div>
          <div className="text-[12.5px] text-foreground bg-subtle rounded-[10px] px-3 py-2.5 tabular-nums lining-nums">Next invoice: <b className="text-tn-ink">{nextInv}</b> · next reimbursement document: <b className="text-tn-ink">{nextRmb}</b>. Numbers restart at 0001 every January.</div>
          <div className="border border-[var(--panel-border)] rounded-[12px] px-3.5 py-3 flex flex-col gap-2">
            <span className={LABEL}>Who approves invoices</span>
            {data.approvers.map((a, i) => (
              <div key={a.name} className={`flex justify-between gap-3 text-[13px] ${i < data.approvers.length - 1 ? 'border-b border-[var(--row-rule)] pb-[7px]' : ''}`}>
                <span className="text-tn-ink font-bold">{a.name}</span><span className="text-foreground text-right">{a.who}</span>
              </div>
            ))}
            <span className="text-[12px] text-muted leading-[1.5]">Hours are approved by the person each one reports to. When the same person approves both, it is one step. The Deputy Director&apos;s own timesheet is recorded without approval. Team Leaders never see invoices.</span>
          </div>
          <span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink mt-1">True North&apos;s billing details</span>
          {field('billingName', 'Billing name')}{field('address', 'Address')}{field('country', 'Country')}{field('email', 'Billing email')}
          <div className="grid grid-cols-2 gap-3">
            {field('paymentDays', 'Payment terms (days)', true)}
            <div className="flex flex-col gap-[5px]"><span className={LABEL}>Currency</span><div className={`${INPUT} flex items-center bg-subtle text-muted`}>USD</div></div>
          </div>
          <div className="text-[12px] text-muted leading-[1.5]">Every invoice is in USD: contractors ask for their reimbursements in dollars. An employee's reimbursement in another currency is converted by Finance at the rate of the expense date.</div>
          {canEdit && <div className="flex justify-end"><button type="button" disabled={busy} onClick={() => void submit()} className={BTN_N}><Icon d="M5 12l5 5 9-10" size={14} color={BTN_ICON.navy} width={3} />Save</button></div>}
        </div>
        <div className="flex flex-col gap-2 xl:sticky xl:top-0">
          <span className={LABEL}>How an invoice reads</span>
          {/* The invoice as contractors get it (owner, 25 October 2026): its real design, with example lines and this form's numbers. */}
          <div className="bg-white border border-[var(--panel-border)] rounded-[14px] overflow-hidden shadow-[0_10px_24px_-18px_rgba(1,35,88,.4)]">
            <InvoiceDoc variant="detail" inv={{
              number: nextInv, date: `Dec 1, ${y}`, period: `November ${y}`, due,
              lines: [
                { desc: '2 - i7 Marketing', hrs: '120h 00m', muted: false, rate: '$22.00', amt: '$2,640.00' },
                { desc: '1 - True North', hrs: '20h 00m', muted: false, rate: '$22.00', amt: '$440.00' },
              ],
              reimb: [{ desc: 'Home internet, November', cat: 'Internet', amt: '$35.00' }],
              total: '$3,115.00',
              from: { name: 'The contractor', line: 'Their name and country, from the Directory', email: 'Their email' },
              to: { name: f.billingName, line1: f.address, line2: [f.country, f.email].filter(Boolean).join(' · ') },
              paid: null,
            }} />
          </div>
          <div className="text-[12px] text-muted leading-[1.5]">Example lines. They come from the timesheet (one per client, or the fixed monthly amount) and the approved reimbursements. Nobody types money on an invoice.</div>
        </div>
      </div>
      <Toast toast={toast} />
    </div>
  )
}

// ── 13C ─────────────────────────────────────────────────────────────────────

const LINES: [string, string, string][] = [
  ['Invoices', 'Invoice created (on submit) · approved · returned, with the reason · paid', 'The contractor; approved also to Finance'],
  ['Time off', 'Asked · cancellation asked', "Super Admins and the person's Team Leader"],
  ['Time off', 'Approved, denied or cancelled', 'The person'],
  ['Time off', 'Rippling refused it', 'Super Admins, in red'],
  ['Reimbursements', 'Asked · decided · document ready · paid', 'Super Admins · the person · Finance · the person'],
  ['Extra hours', 'Asked · decided', 'Super Admins · the person'],
  ['Allowance', '90% · over', 'The person; over without approval also to the Team Leader and Super Admins'],
  ['Timesheets', 'The reminders above', 'As set above'],
  ['Agenda', 'Today: a birthday (optional)', 'Everyone who keeps it on'],
]

export function RemindersSettings({ on, canEdit, set }: { on: Record<ReminderKey, boolean>; canEdit: boolean; set: (i: { key: ReminderKey; on: boolean }) => Promise<Done> }) {
  const router = useRouter()
  const [toast, say] = useToast()
  const [state, setState] = useState(on)
  const toggle = async (key: ReminderKey) => {
    const next = !state[key]
    setState(s => ({ ...s, [key]: next }))
    let r: Done
    try {
      r = await set({ key, on: next })
    } catch {
      setState(s => ({ ...s, [key]: !next }))
      say({ text: 'That did not go through. Check your connection and try again.', error: true })
      return
    }
    if (!r.ok) { setState(s => ({ ...s, [key]: !next })); say({ text: r.error, error: true }); return }
    say({ text: r.toast })
    router.refresh()
  }
  return (
    <div className="flex flex-col gap-[18px]">
      {!canEdit && <ReadOnly />}
      <div className="bg-white border border-[var(--panel-border)] rounded-[16px] overflow-hidden">
        <div className="px-[18px] py-3.5 border-b border-[var(--panel-border)] flex items-center justify-between gap-2.5 flex-wrap">
          <span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">Timesheet reminders</span>
          {/* The bell's Tools tab, where these lines land (Company Settings.dc.html 13C). */}
          <button type="button" onClick={() => openDrawer('bell', 'tools')} className="inline-flex items-center gap-[7px] border border-slate-200 rounded-[10px] px-[13px] py-2 bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[12.5px] leading-[normal] cursor-pointer hover:border-tn-teal">
            <Icon d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" size={14} color="#1E9E6A" width={2.2} />See them in the bell
          </button>
        </div>
        {REMINDERS.map(r => (
          // On a phone: the line and its switch on top, who and when under it, one each.
          <div key={r.key} className="grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_60px] gap-x-3.5 gap-y-1 md:gap-y-3.5 items-center px-[18px] py-3.5 border-b border-[var(--row-rule)]" style={{ opacity: state[r.key] ? 1 : 0.5 }}>
            <div className="flex gap-2.5 items-start min-w-0">
              <span className="w-[30px] h-[30px] rounded-[9px] bg-[var(--warn-bg)] text-[#8a6d1a] flex items-center justify-center flex-none"><Icon d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" size={15} /></span>
              <span className="text-[13.5px] text-tn-ink font-bold leading-[1.4]">&quot;{r.text}&quot;</span>
            </div>
            <span className="max-md:col-span-2 max-md:row-start-2 max-md:pl-10 text-[12.5px] text-foreground leading-[1.45]">{r.who}</span>
            <span className="max-md:col-span-2 max-md:row-start-3 max-md:pl-10 text-[12.5px] text-muted md:text-foreground leading-[1.45]">{r.when}</span>
            <button type="button" role="switch" aria-checked={state[r.key]} aria-label={r.text} disabled={!canEdit} onClick={() => void toggle(r.key)}
              className="max-md:col-start-2 max-md:row-start-1 justify-self-end w-9 h-5 border-0 rounded-full relative cursor-pointer p-0 disabled:cursor-default" style={{ background: state[r.key] ? '#1E7D7F' : '#cbd2da' }}>
              <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-[0_1px_3px_rgba(1,35,88,.3)]" style={{ left: state[r.key] ? 18 : 2 }} />
            </button>
          </div>
        ))}
      </div>
      <div className="bg-white border border-[var(--panel-border)] rounded-[16px] overflow-hidden">
        <div className="px-[18px] py-3.5 border-b border-[var(--panel-border)] flex flex-col gap-[3px]">
          <span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">New bell lines</span>
          <span className="text-[12.5px] text-muted">Bell only. The one email North Time sends is still &quot;Your clock stopped&quot;.</span>
        </div>
        {/* On a phone each line is a short block: the area, the line, who it goes to. */}
        <div className={`hidden md:grid grid-cols-[150px_minmax(0,1.4fr)_minmax(0,1fr)] bg-subtle border-b border-[var(--panel-border)] ${LABEL}`}><div className="px-[18px] py-[9px]">Area</div><div className="px-3 py-[9px]">Line</div><div className="px-3 py-[9px]">Goes to</div></div>
        {LINES.map(([area, line, to]) => (
          <div key={`${area}${line}`} className="grid grid-cols-1 md:grid-cols-[150px_minmax(0,1.4fr)_minmax(0,1fr)] items-center border-b border-[var(--row-rule)] text-[12.5px] max-md:px-[18px] max-md:py-2.5 max-md:gap-0.5">
            <div className="md:px-[18px] md:py-[9px] text-tn-teal font-(family-name:--font-display) font-extrabold">{area}</div>
            <div className="md:px-3 md:py-[9px] text-tn-ink font-semibold leading-[1.45]">{line}</div>
            <div className={`md:px-3 md:py-[9px] leading-[1.45] ${/red/.test(to) ? 'text-[#c8323d]' : 'text-foreground'}`}>{to}</div>
          </div>
        ))}
      </div>
      <Toast toast={toast} />
    </div>
  )
}
