'use client'

/**
 * Reimbursements (Clocky part 2, Requests.dc.html):
 *
 *   9B   My reimbursements: each request with where it is (waiting, on an
 *        invoice, on a reimbursement document, paid, denied); an employee's
 *        open document is a card that opens it. Super Admins, Admins and
 *        Finance also get Everyone and Documents (RmbDocsList.tsx)
 *   9A   New reimbursement: the receipt (required), the date, the category,
 *        the amount and currency, what it was for, the client and whether it
 *        is billable; what happens after, for a contractor or an employee
 *
 * Tina's review (29 October 2026): Mileage asks the miles (times the company's
 * rate, no receipt needed), a meal while travelling is $25 at most, and the
 * request's name is its event or trip (reimbursement-rules.ts).
 */

import { Fragment, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { withViewAs } from '@/components/ViewAsKeeper'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { BTN_ICON } from '@/lib/ui/buttons'
import { MON, parsePaidOn } from '@/lib/timeclock/paid-on'
import type { ReimbursementsPage, ReqTone } from '@/lib/timeclock/requests-data'
import { CloseButton, FieldLabel, Icon, LabeledSelect, Modal, MODAL_TITLE, TEXTAREA_PLAIN, TRIGGER, Toast, type ToastState } from '@/components/clocky/entries/ui'
import { Select } from '@/components/ui/Select'
import { usePhone } from '@/components/clocky/clock/hooks'
import { PhoneSheet } from './PhoneSheet'
import { totalsText } from '@/lib/timeclock/reimbursement-reports'
import { RmbDocsList, type DocFilter, type MarkRmbPaid } from './RmbDocsList'
import { CATEGORIES, MEAL_HINT, MEALS_TRAVEL, MILEAGE, mileageAmount, mileageText, milesOf, needsReceipt, overMealCap } from '@/lib/timeclock/reimbursement-rules'

export const REQ_TONE: Record<ReqTone, { bg: string; fg: string }> = {
  ok: { bg: '#e6f6ee', fg: '#0d7a4f' }, warn: { bg: '#fdf8e7', fg: '#8a6d1a' }, bad: { bg: '#fdeeef', fg: '#c8323d' },
  neu: { bg: '#f1f3f6', fg: '#5b6b82' }, teal: { bg: '#eaf4f4', fg: '#1E7D7F' }, navy: { bg: '#e8effa', fg: '#1e40af' },
}
const PILL = 'font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.05em] uppercase rounded-full px-[9px] py-1 whitespace-nowrap'
const COLS = 'grid grid-cols-[130px_130px_minmax(220px,1fr)_110px_120px_minmax(220px,1fr)]'
const COLS_ALL = 'grid grid-cols-[180px_120px_120px_minmax(200px,1fr)_110px_110px_minmax(200px,1fr)]'

/** Who sent it (Everyone): initials in the team's colour, the name and the team. */
function Who({ who }: { who: NonNullable<ReimbursementsPage['rows'][number]['who']> }) {
  return (
    <span className="flex items-center gap-2 min-w-0">
      <span className="w-7 h-7 flex-none rounded-full text-tn-ink text-[10.5px] font-extrabold flex items-center justify-center" style={{ background: who.color }}>{who.initials}</span>
      <span className="flex flex-col min-w-0 leading-[1.25]">
        <span className="text-[13px] text-tn-ink font-semibold truncate">{who.name}</span>
        {who.team && <span className="text-[11.5px] text-muted truncate">{who.team}</span>}
      </span>
    </span>
  )
}
const RECEIPT = 'M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM9 8h6M9 12h6'
const CAMERA = 'M3 7h4l2-3h6l2 3h4v13H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'
const UPLOAD = 'M12 16V4M7 9l5-5 5 5M5 20h14'
const INPUT = 'h-10 box-border px-3 border border-[var(--panel-border)] rounded-[10px] font-sans text-[13px] text-tn-ink outline-none focus:border-tn-teal focus:shadow-[0_0_0_3px_rgba(30,125,127,.15)] tabular-nums lining-nums'
export { CATEGORIES }
const CURRENCIES = ['USD', 'KES', 'RWF']

export type SendReimbursement = (form: FormData) => Promise<{ ok: true } | { ok: false; error: string }>

/** The live sender: the form goes to the route that stores the receipt. */
export const sendReimbursement: SendReimbursement = async form => {
  try {
    const res = await fetch(withViewAs('/requests/reimbursements/new'), { method: 'POST', body: form })
    const body = await res.json().catch(() => null) as { ok: boolean; error?: string } | null
    return body?.ok ? { ok: true } : { ok: false, error: body?.error ?? 'Not saved. Try again in a moment.' }
  } catch {
    return { ok: false, error: 'Not saved. Check the connection and try again.' }
  }
}

type Tab = 'mine' | 'all' | 'docs'

export function ReimbursementsView({ data, send, markRmbPaid, initial }: { data: ReimbursementsPage; send: SendReimbursement; markRmbPaid: MarkRmbPaid; initial?: { form?: boolean; draft?: Partial<Draft>; tab?: Tab; st?: DocFilter; pay?: number } }) {
  const router = useRouter()
  const [form, setForm] = useState(!!initial?.form)
  const [toast, setToast] = useState<ToastState | null>(null)
  const phone = usePhone()
  // Super Admins, Admins and Finance also see everyone's (owner, 2026-10-23), as Time off does.
  // Documents (owner, 25 October 2026): the same people, every reimbursement document, as the Invoices list.
  const [tab, setTab] = useState<Tab>(initial?.tab ?? 'mine')
  const all = tab === 'all' && !!data.everyone
  const docs = tab === 'docs' && data.documents ? data.documents : null
  const pick = (k: Tab) => {
    setTab(k)
    // The address follows the view (?view=documents), so Back from a document comes back to it.
    try {
      const u = new URL(window.location.href)
      if (k === 'docs') u.searchParams.set('view', 'documents')
      else u.searchParams.delete('view')
      u.searchParams.delete('state')
      window.history.replaceState(null, '', u)
    } catch { /* the address is a convenience */ }
  }
  const list = all ? data.everyone! : data.rows
  const say = (t: ToastState) => { setToast(t); setTimeout(() => setToast(null), 4200) }
  const sub = docs && docs.finance ? 'Every employee reimbursement document. You are Finance: you pay them outside Rippling payroll, then mark them paid.'
    : docs ? 'Every employee reimbursement document. Made when a Super Admin approves an employee\'s reimbursement, paid by Finance outside Rippling payroll.'
    : data.contractor ? 'Ask for money you spent for work, with the receipt. Approved, it goes on your next invoice by itself.'
    : 'Ask for money you spent for work, with the receipt. Approved, Finance pays it with a reimbursement document.'

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] auto-rows-max content-start gap-4 leading-[normal]">
      <div>
        <Breadcrumb parents={['/requests']} now="Reimbursements" />
        <div className="flex items-center justify-between gap-3.5 flex-wrap mt-1.5">
          <h1 className="m-0 font-(family-name:--font-display) font-extrabold text-[30px] leading-[1.15] text-tn-ink" style={{ letterSpacing: '-.01em' }}>Reimbursements</h1>
          <button type="button" onClick={() => setForm(true)} className="inline-flex items-center gap-2 border-0 rounded-[10px] px-[18px] py-[11px] bg-tn-primary text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[13px] cursor-pointer hover:bg-[#0a2f6b] shadow-[0_6px_16px_-8px_rgba(1,35,88,.55)]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="3" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>New request
          </button>
        </div>
        <p className="m-0 mt-1 text-[13.5px] text-muted [text-wrap:pretty]">{sub}</p>
      </div>

      {data.doc && (
        <button type="button" onClick={() => router.push(withViewAs(`/requests/reimbursements/${data.doc!.id}`))}
          className="text-left flex items-center gap-3.5 bg-white border border-[var(--panel-border)] rounded-[14px] px-[18px] py-3.5 cursor-pointer hover:border-tn-teal">
          <span className="w-[38px] h-[38px] rounded-[11px] bg-tn-teal-soft text-tn-teal flex items-center justify-center flex-none"><Icon d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5" size={18} /></span>
          <span className="flex-1 flex flex-col gap-0.5">
            <span className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">Reimbursement document {data.doc.number}</span>
            <span className="text-[12.5px] text-muted">Approved items waiting for Finance to pay. Opens the document and its PDF.</span>
          </span>
          <Icon d="M9 6l6 6-6 6" size={16} color="#a3aebb" />
        </button>
      )}

      {data.everyone && (
        <div role="tablist" aria-label="Whose reimbursements" className="flex bg-white border border-[var(--panel-border)] rounded-[10px] p-[3px] gap-0.5 self-start justify-self-start">
          {([['mine', 'Mine'], ['all', 'Everyone'], ...(data.documents ? [['docs', 'Documents']] as const : [])] as const).map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => pick(k)}
              className={`border-0 cursor-pointer rounded-[8px] px-3 py-1.5 font-(family-name:--font-display) font-bold text-[12.5px] ${tab === k ? 'bg-tn-primary text-[#ffffff]' : 'bg-transparent text-foreground'}`}>{label}</button>
          ))}
        </div>
      )}

      {docs ? (
        <RmbDocsList data={docs} markRmbPaid={markRmbPaid} initial={{ st: initial?.st, pay: initial?.pay }} say={say} />
      ) : list.length > 0 && phone ? (
        // On a phone each reimbursement is a short card, the request's name and total above its receipts.
        <div className="bg-white border border-[var(--panel-border)] rounded-[14px] overflow-hidden">
          {list.map(r => (
            <Fragment key={r.id}>
              {r.report?.first && (
                <div className="flex items-baseline justify-between gap-3 px-3.5 py-2 bg-[#faf9f5] border-b border-[var(--row-rule)] text-[12.5px]">
                  <span className="font-(family-name:--font-display) font-extrabold text-tn-ink">{r.who ? `${r.who.name} · ` : ''}{r.report.title}</span>
                  <span className="font-(family-name:--font-display) font-extrabold text-tn-ink whitespace-nowrap tabular-nums lining-nums">{r.report.total}</span>
                </div>
              )}
              <div className={`flex flex-col gap-1.5 py-3 pr-3.5 border-b border-[var(--row-rule)] ${r.report ? 'pl-6' : 'pl-3.5'}`}>
                {r.who && !r.report && <Who who={r.who} />}
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex items-center gap-2 min-w-0 text-[13.5px] text-tn-ink font-semibold">
                    {r.what}
                    {r.hasReceipt && (
                      <a href={withViewAs(`/requests/reimbursements/receipt/${r.id}`)} target="_blank" rel="noreferrer" aria-label="Open the receipt" className="inline-flex text-tn-teal flex-none"><Icon d={RECEIPT} size={13} width={2.2} /></a>
                    )}
                  </span>
                  <span className="font-(family-name:--font-display) font-extrabold text-[13.5px] text-tn-ink whitespace-nowrap tabular-nums lining-nums">{r.amount}</span>
                </div>
                <span className="text-[12px] text-muted tabular-nums lining-nums">{r.date} · {r.category}</span>
                <div className="flex items-start gap-2">
                  <span className={`${PILL} flex-none`} style={{ background: REQ_TONE[r.st.tone].bg, color: REQ_TONE[r.st.tone].fg }}>{r.st.label}</span>
                  <span className="text-[12px] text-[#5b6b82] leading-[1.45] [text-wrap:pretty]">{r.info}</span>
                </div>
              </div>
            </Fragment>
          ))}
        </div>
      ) : list.length > 0 ? (
        <div className="bg-white border border-[var(--panel-border)] rounded-[14px] overflow-auto">
          <div className={all ? 'min-w-[1060px]' : 'min-w-[880px]'}>
            <div className={`${all ? COLS_ALL : COLS} bg-subtle border-b border-[var(--panel-border)]`}>
              {[...(all ? ['Person'] : []), 'Date', 'Category', 'What it was for', 'Amount', 'State', 'Where it is'].map(h => (
                <div key={h} className={`px-3.5 py-2.5 font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted ${h === 'Amount' ? 'text-right' : ''}`}>{h}</div>
              ))}
            </div>
            {list.map(r => (
              <Fragment key={r.id}>
              {r.report?.first && (
                <div className="flex items-center justify-between gap-3 px-3.5 py-2 bg-[#faf9f5] border-b border-[var(--row-rule)] text-[12.5px]">
                  <span className="font-(family-name:--font-display) font-extrabold text-tn-ink">{r.who ? `${r.who.name} · ` : ''}{r.report.title}</span>
                  <span className="font-(family-name:--font-display) font-extrabold text-tn-ink tabular-nums lining-nums">{r.report.total}</span>
                </div>
              )}
              <div className={`${all ? COLS_ALL : COLS} items-center border-b border-[var(--row-rule)] text-[13px] tabular-nums lining-nums hover:bg-[#f8f7f3] ${r.report ? '[&>div:first-child]:pl-6' : ''}`}>
                {all && <div className="px-3.5 py-3 min-w-0">{r.who && !r.report ? <Who who={r.who} /> : null}</div>}
                <div className="px-3.5 py-3 text-tn-ink font-semibold whitespace-nowrap">{r.date}</div>
                <div className="px-3.5 py-3 text-foreground">{r.category}</div>
                <div className="px-3.5 py-3 flex items-center gap-2 min-w-0">
                  <span className="text-tn-ink font-semibold">{r.what}</span>
                  {r.hasReceipt && (
                    <a href={withViewAs(`/requests/reimbursements/receipt/${r.id}`)} target="_blank" rel="noreferrer" title="Receipt attached" aria-label="Open the receipt" className="inline-flex text-tn-teal">
                      <Icon d={RECEIPT} size={13} width={2.2} />
                    </a>
                  )}
                </div>
                <div className="px-3.5 py-3 text-right font-(family-name:--font-display) font-extrabold text-tn-ink">{r.amount}</div>
                <div className="px-3.5 py-3"><span className={PILL} style={{ background: REQ_TONE[r.st.tone].bg, color: REQ_TONE[r.st.tone].fg }}>{r.st.label}</span></div>
                <div className="px-3.5 py-3 text-[#5b6b82] text-[12.5px] leading-[1.45] [text-wrap:pretty]">{r.info}</div>
              </div>
              </Fragment>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[var(--panel-border)] rounded-[14px] px-5 py-11 text-center text-[13.5px] text-muted">{all ? 'Nobody has asked for a reimbursement yet.' : <>No reimbursement requests yet. Decisions on other people&apos;s requests are in Approvals.</>}</div>
      )}

      {form && <NewReimbursement data={data} draft={initial?.draft} send={send} onClose={() => setForm(false)}
        onSent={() => { setForm(false); say({ text: data.contractor ? 'Sent. Approved, each receipt goes on your next invoice by itself.' : 'Sent. Approved, Finance pays it with a reimbursement document.' }); router.refresh() }} />}
      <Toast toast={toast} />
    </div>
  )
}

/** What a design check or a reopened form starts with: the first receipt's fields, and more receipts. */
export interface Draft { file: File | null; fileLabel: string; date: string; category: string; amount: string; miles?: string; currency: string; what: string; client: string; billable: 'yes' | 'no'; name?: string; more?: Partial<Item>[] }

/** One receipt. `client` null: the request's client, set once at the top (owner, 2026-10-23). */
interface Item { key: number; file: File | null; fileLabel: string; date: string; category: string; amount: string; miles: string; currency: string; what: string; client: string | null; billable: 'yes' | 'no' }

const today = () => { const d = new Date(); return `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` }
const size = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)
const labelOf = (f: File, fromCamera = false) => `${f.type === 'application/pdf' ? 'PDF' : fromCamera ? 'Photo from the camera' : 'Photo'}, ${size(f.size)}`
const amountOk = (a: string) => Number(a.replace(/,/g, '')) > 0
const amountOf = (a: string) => Number(a.replace(/,/g, ''))
const isMileage = (it: Pick<Item, 'category'>) => it.category === MILEAGE
/** A line is ready: its receipt (but Mileage), its miles or amount (a meal while travelling under the cap), what it was for. */
const itemOk = (it: Item) => ((!!it.file || !!it.fileLabel) || !needsReceipt(it.category))
  && (isMileage(it) ? milesOf(it.miles) != null : amountOk(it.amount) && !overMealCap(it.category, amountOf(it.amount), it.currency))
  && !!it.what.trim()
let nextKey = 1

function NewReimbursement({ data, draft, send, onClose, onSent }: { data: ReimbursementsPage; draft?: Partial<Draft>; send: SendReimbursement; onClose: () => void; onSent: () => void }) {
  const blank = (p: Partial<Item> = {}): Item => ({ key: nextKey++, file: null, fileLabel: '', date: today(), category: 'Internet', amount: '', miles: '', currency: 'USD', what: '', client: null, billable: 'no', ...p })
  const [name, setName] = useState(draft?.name ?? '')
  const [client, setClient] = useState(draft?.client ?? 'None')
  const [billable, setBillable] = useState<'yes' | 'no'>(draft?.billable ?? 'no')
  const [items, setItems] = useState<Item[]>(() => [
    blank({ file: draft?.file ?? null, fileLabel: draft?.fileLabel ?? '', date: draft?.date ?? today(), category: draft?.category ?? 'Internet', amount: draft?.amount ?? '', miles: draft?.miles ?? '', currency: draft?.currency ?? 'USD', what: draft?.what ?? '' }),
    ...(draft?.more ?? []).map(m => blank(m)),
  ])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [drag, setDrag] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLInputElement>(null)
  // Where a picked file goes: a receipt that has none yet, or new receipts.
  const target = useRef<number | null>(null)
  const phone = usePhone()
  const many = items.length > 1
  const first = items[0]
  const setItem = (key: number, p: Partial<Item>) => setItems(xs => xs.map(x => (x.key === key ? { ...x, ...p } : x)))
  const remove = (key: number) => setItems(xs => (xs.length > 1 ? xs.filter(x => x.key !== key) : xs.map(x => ({ ...x, file: null, fileLabel: '' }))))
  const ok = items.every(itemOk)
  // A new receipt starts with the last one's category and currency, which is usually right on a trip.
  const addFiles = (files: File[], fromCamera = false) => {
    if (!files.length) return
    const at = target.current
    target.current = null
    setItems(xs => {
      const last = xs[xs.length - 1]
      if (at != null) {
        const [f, ...rest] = files
        return [...xs.map(x => (x.key === at ? { ...x, file: f, fileLabel: labelOf(f, fromCamera) } : x)), ...rest.map(f2 => blank({ file: f2, fileLabel: labelOf(f2, fromCamera), category: last.category, currency: last.currency }))]
      }
      return [...xs, ...files.map(f => blank({ file: f, fileLabel: labelOf(f, fromCamera), category: last.category, currency: last.currency }))]
    })
  }
  const pickFor = (key: number | null, cam = false) => { target.current = key; (cam ? camera : input).current?.click() }

  const submit = async () => {
    if (!ok) return
    const f = new FormData()
    f.set('count', String(items.length))
    if (name.trim()) f.set('name', name.trim())
    for (const [i, it] of items.entries()) {
      if (!it.file && needsReceipt(it.category)) return
      const day = parsePaidOn(it.date)
      if (!day) { setError(`${many ? `Receipt ${i + 1}: write` : 'Write'} the date of the expense, like Oct 31, 2026.`); return }
      const c = it.client ?? client
      if (it.file) f.set(`receipt_${i}`, it.file)
      f.set(`date_${i}`, day)
      f.set(`category_${i}`, it.category)
      // Mileage sends the miles: the server works out the amount from the company's rate.
      if (isMileage(it)) f.set(`miles_${i}`, it.miles)
      else f.set(`amount_${i}`, it.amount)
      f.set(`currency_${i}`, isMileage(it) ? 'USD' : it.currency)
      f.set(`purpose_${i}`, it.what.trim())
      f.set(`client_${i}`, c)
      f.set(`billable_${i}`, c === 'None' ? 'no' : it.client != null ? it.billable : billable)
    }
    setBusy(true)
    setError(null)
    const r = await send(f)
    setBusy(false)
    if (r.ok) onSent()
    else setError(r.error)
  }

  // A contractor's receipts go on a USD invoice, so they ask in dollars (owner, 24 October 2026); an
  // employee's document goes to Finance, who converts any other currency.
  const currencies = data.contractor ? ['USD'] : CURRENCIES
  const usdNote = 'In US dollars: your invoice is in USD. Paid in another currency? Convert it, and write the amount you paid in What it was for.'
  const afterLine = data.contractor
    ? (many ? 'Approved, each receipt goes on your next invoice by itself, as its own line. If that invoice is already approved, they go on the one after.' : 'Approved, it goes on your next invoice by itself. If that invoice is already approved, it goes on the one after.')
    : (many ? 'Approved, the portal puts each receipt on a reimbursement document and Finance pays you, outside Rippling payroll.' : 'Approved, the portal puts it on a reimbursement document and Finance pays you, outside Rippling payroll.')
  const rate = data.mileageRate
  const valueOf = (it: Item) => {
    if (isMileage(it)) { const m = milesOf(it.miles); return m == null ? null : { amount: mileageAmount(m, rate), currency: 'USD' } }
    return amountOk(it.amount) ? { amount: amountOf(it.amount), currency: it.currency } : null
  }
  const total = totalsText(items.map(valueOf).filter((x): x is { amount: number; currency: string } => !!x))
  /** Under a line: the mileage worked out as it is typed, or the meals rule. */
  const lineHint = (it: Item) => {
    if (isMileage(it)) {
      const m = milesOf(it.miles)
      return <div className="text-[12px] text-tn-teal font-semibold tabular-nums lining-nums">{m == null ? `Miles times $${rate} a mile, in US dollars. No receipt needed.` : `${mileageText(m, rate)}. No receipt needed.`}</div>
    }
    if (it.category === MEALS_TRAVEL) {
      const over = overMealCap(it.category, amountOf(it.amount), it.currency)
      return <div className={`text-[12px] leading-[1.45] ${over ? 'text-[#c8323d] font-semibold' : 'text-muted'}`}>{MEAL_HINT}</div>
    }
    return null
  }
  const sendLabel = busy ? 'Sending…' : many ? `Send ${items.length} receipts` : 'Send request'
  const clientOptions = ['None', ...data.clients].map(c => ({ value: c, label: c }))
  const files = (
    <>
      <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/heic,image/heif,image/webp,application/pdf" className="hidden" onChange={e => { addFiles([...(e.target.files ?? [])]); e.target.value = '' }} />
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { addFiles([...(e.target.files ?? [])], true); e.target.value = '' }} />
    </>
  )
  const billableSeg = (value: 'yes' | 'no', onChange: (v: 'yes' | 'no') => void, off: boolean, wide = false) => (
    <div className="flex bg-white border border-[var(--panel-border)] rounded-[10px] p-[3px] gap-0.5">
      {([['yes', 'Yes'], ['no', 'No']] as const).map(([k, label]) => (
        <button key={k} type="button" disabled={off} aria-pressed={value === k} onClick={() => onChange(k)}
          className={`border-0 rounded-[8px] font-(family-name:--font-display) font-bold disabled:cursor-default cursor-pointer ${wide ? 'flex-1 h-10 text-[13px]' : 'px-3.5 py-[7px] text-[12.5px]'} ${value === k ? 'bg-tn-primary text-[#ffffff]' : 'bg-transparent text-foreground'}`}>{label}</button>
      ))}
    </div>
  )
  const addMore = (
    <button type="button" onClick={() => pickFor(null)} className="self-start inline-flex items-center gap-1.5 border-0 bg-transparent px-0 py-1 cursor-pointer text-[12.5px] font-bold text-tn-teal">
      <Icon d="M12 5v14M5 12h14" size={13} width={2.6} />Add another receipt
    </button>
  )

  // ── Several receipts: the list (owner, 2026-10-23) ──────────────────────
  const bare = (aria: string, value: string, onChange: (v: string) => void, options: string[]) =>
    <Select value={value} onChange={onChange} options={options.map(o => ({ value: o, label: o }))} fullWidth ariaLabel={aria} className={TRIGGER} />
  const itemsList = (
    <div className="flex flex-col gap-2">
      <FieldLabel>Receipts ({items.length})</FieldLabel>
      {items.map((it, i) => {
        const has = !!it.file || !!it.fileLabel
        const thumb = (
          <button type="button" onClick={() => pickFor(it.key)} aria-label={has ? `Change the receipt of line ${i + 1}` : `Add the receipt of line ${i + 1}`} title={it.file?.name ?? 'Add the receipt'}
            className={`w-10 h-10 flex-none rounded-[8px] flex items-center justify-center cursor-pointer ${has ? 'bg-subtle border border-[var(--panel-border)] text-muted' : 'bg-[#f8f7f3] border-[1.5px] border-dashed border-[#cbd2da] text-[#1E9E6A]'}`}>
            <Icon d={has ? RECEIPT : UPLOAD} size={17} width={1.8} />
          </button>
        )
        const close = (
          <button type="button" onClick={() => remove(it.key)} aria-label={`Remove line ${i + 1}`} className="w-8 h-10 flex-none border-0 bg-transparent rounded-[8px] cursor-pointer text-muted hover:text-[#c8323d] hover:bg-subtle flex items-center justify-center"><Icon d="M6 6l12 12M18 6 6 18" size={15} width={2.2} /></button>
        )
        const date = <input value={it.date} onChange={e => setItem(it.key, { date: e.target.value })} aria-label={`Date of line ${i + 1}`} className={`${INPUT} min-w-0`} />
        const cat = bare(`Category of line ${i + 1}`, it.category, v => setItem(it.key, { category: v }), CATEGORIES)
        const amt = isMileage(it)
          ? <input value={it.miles} onChange={e => setItem(it.key, { miles: e.target.value })} placeholder="Miles" inputMode="decimal" aria-label={`Miles of line ${i + 1}`} className={`${INPUT} min-w-0`} />
          : <input value={it.amount} onChange={e => setItem(it.key, { amount: e.target.value })} placeholder="0.00" inputMode="decimal" aria-label={`Amount of line ${i + 1}`} className={`${INPUT} min-w-0`} />
        const cur = isMileage(it) ? <div className={`${INPUT} flex items-center bg-subtle text-muted min-w-0`}>USD</div> : bare(`Currency of line ${i + 1}`, it.currency, v => setItem(it.key, { currency: v }), currencies)
        return (
          <div key={it.key} className="border border-[var(--panel-border)] rounded-[12px] p-2.5 flex flex-col gap-2">
            {phone ? (
              <>
                <div className="flex items-center gap-2.5">{thumb}<span className="flex-1 min-w-0 font-(family-name:--font-display) font-extrabold text-[12.5px] text-tn-ink truncate">{it.file?.name ?? 'Receipt missing'}</span>{close}</div>
                <div className="grid grid-cols-2 gap-2">{date}{cat}{amt}{cur}</div>
              </>
            ) : (
              <div className="grid grid-cols-[40px_120px_minmax(0,1fr)_104px_92px_32px] gap-2 items-center">{thumb}{date}{cat}{amt}{cur}{close}</div>
            )}
            {lineHint(it)}
            <input value={it.what} onChange={e => setItem(it.key, { what: e.target.value })} placeholder={isMileage(it) ? 'Where you drove, e.g. Office to the ASI convention and back' : 'What it was for, e.g. Uber to the client'} aria-label={`What line ${i + 1} was for`} className={INPUT} />
            {it.client == null ? (
              <div className="flex items-center justify-between gap-3 text-[11.5px]">
                <span className={`min-w-0 truncate ${has || !needsReceipt(it.category) ? 'text-muted' : 'text-[#c8323d] font-semibold'}`}>{has ? `${phone ? '' : `${it.file?.name ?? 'receipt'} · `}${it.fileLabel}` : needsReceipt(it.category) ? 'Add the photo or PDF of this receipt' : 'No receipt needed for mileage'}</span>
                <button type="button" onClick={() => setItem(it.key, { client, billable })} className="flex-none border-0 bg-transparent p-0 cursor-pointer text-[12px] font-bold text-tn-teal">Other client for this receipt</button>
              </div>
            ) : (
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-end">
                <LabeledSelect label="Client or project for this receipt" value={it.client} search onChange={v => setItem(it.key, { client: v, billable: v === 'None' ? 'no' : it.billable })} options={clientOptions} />
                {billableSeg(it.billable, v => setItem(it.key, { billable: v }), it.client === 'None')}
              </div>
            )}
          </div>
        )
      })}
      <button type="button" onClick={() => pickFor(null)}
        onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); addFiles([...(e.dataTransfer.files ?? [])]) }}
        className={`h-11 rounded-[12px] bg-[#f8f7f3] border-[1.5px] border-dashed flex items-center justify-center gap-2 cursor-pointer font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink hover:border-tn-teal ${drag ? 'border-tn-teal' : 'border-[#cbd2da]'}`}>
        <Icon d="M12 5v14M5 12h14" size={15} color="#1E9E6A" width={2.6} />{phone ? 'Choose files' : 'Add a receipt (or drop several photos and PDFs here)'}
      </button>
      {phone && (
        <button type="button" onClick={() => pickFor(null, true)} className="h-11 rounded-[12px] bg-[#f8f7f3] border-[1.5px] border-dashed border-[#cbd2da] flex items-center justify-center gap-2 cursor-pointer font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink">
          <Icon d={CAMERA} size={17} color="#1E9E6A" width={2} />Take a photo
        </button>
      )}
      <div className="flex justify-end items-baseline gap-2.5 pt-1"><span className="text-[12.5px] text-muted">Total</span><span className="font-(family-name:--font-display) font-black text-[20px] text-tn-ink tabular-nums lining-nums">{total}</span></div>
      {data.contractor && <div className="text-[12px] text-muted leading-[1.45]">{usdNote}</div>}
    </div>
  )
  const topFields = (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,220px)_auto] gap-3 items-end">
      <label className="flex flex-col gap-[5px]"><FieldLabel>Event or trip (optional)</FieldLabel><input value={name} onChange={e => setName(e.target.value)} maxLength={120} placeholder="e.g. ASI convention, Aug 5 to 8" className={INPUT} /></label>
      <LabeledSelect label="Client or project (optional)" value={client} search onChange={v => { setClient(v); if (v === 'None') setBillable('no') }} options={clientOptions} />
      <div className="flex flex-col gap-1.5" style={{ opacity: client === 'None' ? 0.45 : 1 }}>
        <FieldLabel>Billable</FieldLabel>
        {billableSeg(billable, setBillable, client === 'None')}
      </div>
    </div>
  )
  const note = <div className="text-[12.5px] text-tn-teal font-semibold leading-[1.5] bg-tn-teal-soft rounded-[10px] px-3 py-2.5">{afterLine}</div>
  const errorLine = error && <p role="alert" className="m-0 text-[12.5px] font-semibold text-[#c8323d]">{error}</p>

  // 9A on a phone (Requests.dc.html 9Ap): the whole screen, the receipt from the camera or a file.
  if (phone) {
    const PHONE_INPUT = `${INPUT} h-11 text-[14px]`
    return (
      <PhoneSheet crumb="Requests · Reimbursements" title="New reimbursement" onBack={onClose}
        footer={(
          <div className="flex flex-col gap-2">
            {errorLine}
            <button type="button" disabled={!ok || busy} onClick={() => void submit()} className="w-full h-[50px] flex items-center justify-center gap-[9px] border-0 rounded-[12px] bg-tn-primary text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[15px] cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed">
              <Icon d="M22 2 11 13M22 2l-7 20-4-9-9-4z" size={15} color={BTN_ICON.navy} width={2.4} />{sendLabel}
            </button>
          </div>
        )}>
        {files}
        {many ? (
          <>
            {topFields}
            {itemsList}
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <FieldLabel>{needsReceipt(first.category) ? 'Receipt (required)' : 'Receipt (optional for mileage)'}</FieldLabel>
              {first.file || first.fileLabel ? (
                <div className="flex gap-3 items-center border border-[var(--panel-border)] rounded-[12px] p-2.5">
                  <div className="w-[78px] h-24 rounded-[8px] bg-[#e9e6dd] flex items-center justify-center flex-none"><Icon d={CAMERA} size={24} color="#8593a4" width={1.7} /></div>
                  <div className="flex-1 min-w-0 flex flex-col gap-[3px]">
                    <span className="font-(family-name:--font-display) font-extrabold text-[13.5px] text-tn-ink break-all">{first.file?.name ?? 'receipt'}</span>
                    <span className="text-[12px] text-muted">{first.fileLabel}</span>
                    <button type="button" onClick={() => pickFor(first.key, true)} className="self-start h-11 border-0 bg-transparent p-0 cursor-pointer text-[13px] font-bold text-tn-teal">Retake</button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {([['Take a photo', CAMERA, true], ['Choose a file', UPLOAD, false]] as const).map(([label, icon, cam]) => (
                    <button key={label} type="button" onClick={() => pickFor(first.key, cam)}
                      className="h-14 rounded-[12px] border-[1.5px] border-dashed border-[#cbd2da] bg-[#f8f7f3] flex items-center justify-center gap-2 cursor-pointer font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink">
                      <Icon d={icon} size={18} color="#1E9E6A" width={2} />{label}
                    </button>
                  ))}
                </div>
              )}
              {addMore}
            </div>
            <label className="flex flex-col gap-[5px]"><FieldLabel>Event or trip (optional)</FieldLabel><input value={name} onChange={e => setName(e.target.value)} maxLength={120} placeholder="e.g. ASI convention, Aug 5 to 8" className={PHONE_INPUT} /></label>
            <label className="flex flex-col gap-[5px]"><FieldLabel>Date of the expense</FieldLabel><input value={first.date} onChange={e => setItem(first.key, { date: e.target.value })} className={PHONE_INPUT} /></label>
            <LabeledSelect label="Category" value={first.category} onChange={v => setItem(first.key, { category: v })} options={CATEGORIES.map(c => ({ value: c, label: c }))} />
            {isMileage(first) ? (
              <label className="flex flex-col gap-[5px] min-w-0"><FieldLabel>Miles</FieldLabel><input value={first.miles} onChange={e => setItem(first.key, { miles: e.target.value })} placeholder="e.g. 120" inputMode="decimal" className={PHONE_INPUT} /></label>
            ) : (
              <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-2.5">
                <label className="flex flex-col gap-[5px] min-w-0"><FieldLabel>Amount</FieldLabel><input value={first.amount} onChange={e => setItem(first.key, { amount: e.target.value })} placeholder="0.00" inputMode="decimal" className={PHONE_INPUT} /></label>
                <LabeledSelect label="Currency" value={first.currency} onChange={v => setItem(first.key, { currency: v })} options={currencies.map(c => ({ value: c, label: c }))} />
              </div>
            )}
            {lineHint(first)}
            {data.contractor
              ? <div className="text-[12px] text-muted leading-[1.45]">{usdNote}</div>
              : first.currency !== 'USD' && !isMileage(first) && <div className="text-[12px] text-[#8a6d1a] bg-[var(--warn-bg)] rounded-[9px] px-[11px] py-2">Invoices are in USD. Finance converts at the rate of the expense date.</div>}
            <label className="flex flex-col gap-[5px]"><FieldLabel>What it was for</FieldLabel><textarea value={first.what} onChange={e => setItem(first.key, { what: e.target.value })} rows={2} placeholder="e.g. Home internet for October" className={`${TEXTAREA_PLAIN} text-[14px]`} /></label>
            <LabeledSelect label="Client or project (optional)" value={client} search onChange={v => { setClient(v); if (v === 'None') setBillable('no') }} options={clientOptions} />
            {/* Billable only matters once a client is picked; the phone design leaves it out until then. */}
            {client !== 'None' && <div className="flex flex-col gap-1.5"><FieldLabel>Billable to the client</FieldLabel>{billableSeg(billable, setBillable, false, true)}</div>}
          </>
        )}
        {note}
      </PhoneSheet>
    )
  }

  return (
    <Modal label="New reimbursement" width={776} onClose={onClose} gap={16}>
      <div className="flex items-center justify-between gap-2.5">
        <h2 className={MODAL_TITLE}>New reimbursement</h2>
        <CloseButton onClick={onClose} />
      </div>
      {files}
      {many ? (
        <>
          {topFields}
          {itemsList}
          {note}
        </>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)] gap-5 items-start">
          <div className="flex flex-col gap-1.5">
            <FieldLabel>{needsReceipt(first.category) ? 'Receipt (required)' : 'Receipt (optional for mileage)'}</FieldLabel>
            {!(first.file || first.fileLabel) ? (
              <button type="button" onClick={() => pickFor(first.key)}
                onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
                onDrop={e => { e.preventDefault(); setDrag(false); target.current = first.key; addFiles([...(e.dataTransfer.files ?? [])]) }}
                className={`h-[280px] rounded-[12px] bg-[#f8f7f3] border-[1.5px] border-dashed flex flex-col items-center justify-center gap-2.5 cursor-pointer p-4 hover:border-tn-teal ${drag ? 'border-tn-teal' : 'border-[#cbd2da]'}`}>
                <Icon d={UPLOAD} size={30} color={BTN_ICON.white} width={1.8} />
                <span className="font-(family-name:--font-display) font-extrabold text-[13.5px] text-tn-ink">Drop a photo or PDF here</span>
                <span className="text-[12.5px] text-tn-teal font-bold">or choose a file</span>
              </button>
            ) : (
              <div className="h-[280px] rounded-[12px] bg-subtle border border-[var(--panel-border)] flex flex-col items-center justify-center gap-2 p-4 box-border text-center">
                <Icon d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM9 8h6M9 12h6M9 16h3" size={32} color="#8593a4" width={1.6} />
                <span className="font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink break-all">{first.file?.name ?? 'receipt'}</span>
                <span className="text-[12px] text-muted">{first.fileLabel}</span>
                <button type="button" onClick={() => remove(first.key)} className="border-0 bg-transparent px-1.5 py-px cursor-pointer text-[12.5px] font-bold text-[#c8323d]">Remove</button>
              </div>
            )}
            {addMore}
          </div>
          <div className="flex flex-col gap-3.5 min-w-0">
            <label className="flex flex-col gap-[5px]"><FieldLabel>Event or trip (optional)</FieldLabel><input value={name} onChange={e => setName(e.target.value)} maxLength={120} placeholder="e.g. ASI convention, Aug 5 to 8" className={INPUT} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-[5px]"><FieldLabel>Date of the expense</FieldLabel><input value={first.date} onChange={e => setItem(first.key, { date: e.target.value })} className={INPUT} /></label>
              <LabeledSelect label="Category" value={first.category} onChange={v => setItem(first.key, { category: v })} options={CATEGORIES.map(c => ({ value: c, label: c }))} />
            </div>
            {isMileage(first) ? (
              <label className="flex flex-col gap-[5px]"><FieldLabel>Miles</FieldLabel><input value={first.miles} onChange={e => setItem(first.key, { miles: e.target.value })} placeholder="e.g. 120" inputMode="decimal" className={INPUT} /></label>
            ) : (
              <div className="grid grid-cols-[minmax(0,1fr)_130px] gap-3">
                <label className="flex flex-col gap-[5px]"><FieldLabel>Amount</FieldLabel><input value={first.amount} onChange={e => setItem(first.key, { amount: e.target.value })} placeholder="0.00" inputMode="decimal" className={INPUT} /></label>
                <LabeledSelect label="Currency" value={first.currency} onChange={v => setItem(first.key, { currency: v })} options={currencies.map(c => ({ value: c, label: c }))} />
              </div>
            )}
            {lineHint(first)}
            {data.contractor
              ? <div className="text-[12px] text-muted leading-[1.45] -mt-1.5">{usdNote}</div>
              : first.currency !== 'USD' && !isMileage(first) && <div className="text-[12px] text-[#8a6d1a] bg-[var(--warn-bg)] rounded-[9px] px-[11px] py-2 -mt-1.5">Invoices are in USD. Finance converts at the rate of the expense date.</div>}
            <label className="flex flex-col gap-[5px]"><FieldLabel>What it was for</FieldLabel><textarea value={first.what} onChange={e => setItem(first.key, { what: e.target.value })} rows={2} placeholder="e.g. Home internet for October" className={TEXTAREA_PLAIN} /></label>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
              <LabeledSelect label="Client or project (optional)" value={client} search onChange={v => { setClient(v); if (v === 'None') setBillable('no') }} options={clientOptions} />
              <div className="flex flex-col gap-1.5" style={{ opacity: client === 'None' ? 0.45 : 1 }}>
                <FieldLabel>Billable to the client</FieldLabel>
                {billableSeg(billable, setBillable, client === 'None')}
              </div>
            </div>
            {note}
          </div>
        </div>
      )}
      {errorLine}
      <div className="flex justify-end gap-2 items-center">
        {!ok && <span className="mr-auto text-[12.5px] text-muted">{many ? 'Each receipt needs its photo or PDF (mileage: the miles), the amount and what it was for.' : isMileage(first) ? 'Write the miles and where you drove.' : 'Add the receipt, the amount and what it was for.'}</span>}
        <button type="button" onClick={onClose} className="border border-slate-200 rounded-[10px] px-4 py-2.5 bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[13px] cursor-pointer hover:border-tn-teal">Cancel</button>
        <button type="button" disabled={!ok || busy} onClick={() => void submit()} className="inline-flex items-center gap-2 border-0 rounded-[10px] px-[18px] py-[11px] bg-tn-primary text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[13px] cursor-pointer hover:bg-[#0a2f6b] disabled:opacity-45 disabled:cursor-not-allowed">
          <Icon d="M22 2 11 13M22 2l-7 20-4-9-9-4z" size={14} color={BTN_ICON.navy} width={2.4} />{sendLabel}
        </button>
      </div>
    </Modal>
  )
}
