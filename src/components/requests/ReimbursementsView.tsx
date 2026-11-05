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
 * rate, no receipt needed), and the request's name is its event or trip
 * (reimbursement-rules.ts).
 *
 * Finance's feedback (owner, 5 November 2026): a request still entirely waiting
 * has Edit (this form, filled in with it) and Withdraw; a meal while travelling
 * over $25 goes for review with a description that says why; the field is
 * "Description of expense"; the date may be typed 10/31/2026.
 */

import { INPUT as FIELD } from '@/lib/ui/fields'
import { Fragment, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { withViewAs } from '@/components/ViewAsKeeper'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { BTN, BTN_ICON } from '@/lib/ui/buttons'
import { DAY_HINT, MON, parsePaidOn } from '@/lib/timeclock/paid-on'
import type { ReimbursementsPage, WaitingRequest } from '@/lib/timeclock/requests-data'
import { CloseButton, FieldLabel, Icon, LabeledSelect, Modal, MODAL_TITLE, TEXTAREA_PLAIN, TRIGGER, Toast, type ToastState } from '@/components/clocky/entries/ui'
import { Select } from '@/components/ui/Select'
import { usePhone } from '@/components/clocky/clock/hooks'
import { PhoneSheet } from './PhoneSheet'
import { totalsText } from '@/lib/timeclock/reimbursement-reports'
import { RmbDocsList, type DocFilter, type MarkRmbPaid } from './RmbDocsList'
import { CATEGORIES, DESCRIPTION_LABEL, MEAL_HINT, MEAL_OVER_FLAG, MEAL_OVER_WARNING, MEALS_TRAVEL, MILEAGE, mealReasonMissing, mileageAmount, mileageText, milesOf, needsReceipt, overMealCap, amountOf as readAmount } from '@/lib/timeclock/reimbursement-rules'
import { SEG_BOX, segClass } from '@/lib/ui/segmented'
import { Tabs } from '@/components/ui/Tabs'
import { PAGE_TITLE } from '@/lib/ui/type'
import { pillClass } from '@/components/ui/Pill'

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
const INPUT = `${FIELD} tabular-nums lining-nums`
export { CATEGORIES }
const CURRENCIES = ['USD', 'KES', 'RWF']

export type SendReimbursement = (form: FormData) => Promise<{ ok: true; toast?: string } | { ok: false; error: string }>

/** Withdraw a request still entirely waiting (requests/actions.ts withdrawReimbursement). */
export type WithdrawReimbursement = (input: { target: string; reason?: string }) => Promise<{ ok: true; toast: string } | { ok: false; error: string }>

/** The live sender: the form goes to the route that stores the receipt; an edit (it names its `target`) to the one that changes it. */
export const sendReimbursement: SendReimbursement = async form => {
  try {
    const res = await fetch(withViewAs(form.has('target') ? '/requests/reimbursements/edit' : '/requests/reimbursements/new'), { method: 'POST', body: form })
    const body = await res.json().catch(() => null) as { ok: boolean; error?: string; toast?: string } | null
    return body?.ok ? { ok: true, toast: body.toast } : { ok: false, error: body?.error ?? 'Not saved. Try again in a moment.' }
  } catch {
    return { ok: false, error: 'Not saved. Check the connection and try again.' }
  }
}

type Tab = 'mine' | 'all' | 'docs'

export function ReimbursementsView({ data, send, markRmbPaid, withdraw, initial }: { data: ReimbursementsPage; send: SendReimbursement; markRmbPaid: MarkRmbPaid; withdraw?: WithdrawReimbursement; initial?: { form?: boolean; draft?: Partial<Draft>; tab?: Tab; st?: DocFilter; pay?: number } }) {
  const router = useRouter()
  const [form, setForm] = useState(!!initial?.form)
  // The viewer's own waiting request being edited, or withdrawn (owner, 5 November 2026).
  const [editing, setEditing] = useState<WaitingRequest | null>(null)
  const [leaving, setLeaving] = useState<WaitingRequest | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const phone = usePhone()
  // Super Admins and Finance also see everyone's (owner, 2026-10-23), as Time off does.
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
  const waiting = data.waiting ?? {}
  /** Edit and Withdraw on the viewer's own request while all of it waits. */
  const actions = (key: string | undefined) => {
    const w = key ? waiting[key] : undefined
    if (!w || all) return null
    return (
      <span className="inline-flex items-center gap-1.5 flex-none">
        <button type="button" onClick={() => { setEditing(w); setForm(true) }} className={BTN.smallWhite}>Edit</button>
        {withdraw && <button type="button" onClick={() => setLeaving(w)} className={BTN.smallWhiteDanger}>Withdraw</button>}
      </span>
    )
  }
  const overPill = <span className={`${pillClass('warn')} flex-none`}>{MEAL_OVER_FLAG}</span>
  const say = (t: ToastState) => { setToast(t); setTimeout(() => setToast(null), 4200) }
  const sub = docs && docs.finance ? 'Every employee reimbursement document. You are Finance: you pay them outside Rippling payroll, then mark them paid.'
    : docs ? 'Every employee reimbursement document. Made when an employee\'s reimbursement is approved, paid by Finance outside Rippling payroll.'
    : data.contractor ? 'Ask for money you spent for work, with the receipt. Approved, you add it to your next invoice.'
    : 'Ask for money you spent for work, with the receipt. Approved, Finance pays it with a reimbursement document.'

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] auto-rows-max content-start gap-4 leading-[normal]">
      <div>
        <Breadcrumb parents={['/requests']} now="Reimbursements" />
        <div className="flex items-center justify-between gap-3.5 flex-wrap mt-1.5">
          <h1 className={PAGE_TITLE}>Reimbursements</h1>
          <button type="button" onClick={() => setForm(true)} className={BTN.navy}>
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
        <Tabs label="Whose reimbursements" value={tab} onChange={pick}
          items={[{ key: 'mine', label: 'Mine' }, { key: 'all', label: 'Everyone' }, ...(data.documents ? [{ key: 'docs', label: 'Documents' }] as const : [])]} />
      )}

      {docs ? (
        <RmbDocsList data={docs} markRmbPaid={markRmbPaid} initial={{ st: initial?.st, pay: initial?.pay }} say={say} />
      ) : list.length > 0 && phone ? (
        // On a phone each reimbursement is a short card, the request's name and total above its receipts.
        <div className="bg-white border border-[var(--panel-border)] rounded-[14px] overflow-hidden">
          {list.map(r => (
            <Fragment key={r.id}>
              {r.report?.first && (
                <div className="flex flex-col gap-2 px-3.5 py-2 bg-[#faf9f5] border-b border-[var(--row-rule)] text-[12.5px]">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-(family-name:--font-display) font-extrabold text-tn-ink">{r.who ? `${r.who.name} · ` : ''}{r.report.title}</span>
                    <span className="font-(family-name:--font-display) font-extrabold text-tn-ink whitespace-nowrap tabular-nums lining-nums">{r.report.total}</span>
                  </div>
                  {actions(r.edit)}
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
                {r.over && overPill}
                <div className="flex items-start gap-2">
                  <span className={`${pillClass(r.st.tone)} flex-none`}>{r.st.label}</span>
                  <span className="text-[12px] text-[#5b6b82] leading-[1.45] [text-wrap:pretty]">{r.info}</span>
                </div>
                {!r.report && actions(r.edit)}
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
                  <span className="flex items-center gap-3">
                    {actions(r.edit)}
                    <span className="font-(family-name:--font-display) font-extrabold text-tn-ink tabular-nums lining-nums">{r.report.total}</span>
                  </span>
                </div>
              )}
              <div className={`${all ? COLS_ALL : COLS} items-center border-b border-[var(--row-rule)] text-[13px] tabular-nums lining-nums hover:bg-[#f8f7f3] ${r.report ? '[&>div:first-child]:pl-6' : ''}`}>
                {all && <div className="px-3.5 py-3 min-w-0">{r.who && !r.report ? <Who who={r.who} /> : null}</div>}
                <div className="px-3.5 py-3 text-tn-ink font-semibold whitespace-nowrap">{r.date}</div>
                <div className="px-3.5 py-3 text-foreground">{r.category}</div>
                <div className="px-3.5 py-3 flex items-center flex-wrap gap-2 min-w-0">
                  <span className="text-tn-ink font-semibold">{r.what}</span>
                  {r.over && overPill}
                  {r.hasReceipt && (
                    <a href={withViewAs(`/requests/reimbursements/receipt/${r.id}`)} target="_blank" rel="noreferrer" title="Receipt attached" aria-label="Open the receipt" className="inline-flex text-tn-teal">
                      <Icon d={RECEIPT} size={13} width={2.2} />
                    </a>
                  )}
                </div>
                <div className="px-3.5 py-3 text-right font-(family-name:--font-display) font-extrabold text-tn-ink">{r.amount}</div>
                <div className="px-3.5 py-3"><span className={pillClass(r.st.tone)}>{r.st.label}</span></div>
                <div className="px-3.5 py-3 text-[#5b6b82] text-[12.5px] leading-[1.45] [text-wrap:pretty] flex flex-col items-start gap-2">
                  <span>{r.info}</span>
                  {!r.report && actions(r.edit)}
                </div>
              </div>
              </Fragment>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[var(--panel-border)] rounded-[14px] px-5 py-11 text-center text-[13.5px] text-muted">{all ? 'Nobody has asked for a reimbursement yet.' : <>No reimbursement requests yet. Decisions on other people&apos;s requests are in Approvals.</>}</div>
      )}

      {form && <NewReimbursement key={editing?.key ?? 'new'} data={data} draft={editing ? undefined : initial?.draft} edit={editing ?? undefined} send={send} onClose={() => { setForm(false); setEditing(null) }}
        onSent={sent => { setForm(false); setEditing(null); say({ text: sent ?? (data.contractor ? 'Sent. Approved, you add each receipt to your next invoice.' : 'Sent. Approved, Finance pays it with a reimbursement document.') }); router.refresh() }} />}
      {leaving && withdraw && <WithdrawDialog w={leaving} withdraw={withdraw} onClose={() => setLeaving(null)}
        onDone={t => { setLeaving(null); say({ text: t }); router.refresh() }} />}
      <Toast toast={toast} />
    </div>
  )
}

/** What a design check or a reopened form starts with: the first receipt's fields, and more receipts. */
export interface Draft { file: File | null; fileLabel: string; date: string; category: string; amount: string; miles?: string; currency: string; what: string; client: string; billable: 'yes' | 'no'; name?: string; more?: Partial<Item>[] }

/**
 * One receipt. `client` null: the request's client, set once at the top (owner, 2026-10-23).
 * Editing a waiting request (owner, 5 November 2026): `rid` is the receipt it was, and
 * `stored` the name of its file kept on the server (no new file picked).
 */
interface Item { key: number; file: File | null; fileLabel: string; date: string; category: string; amount: string; miles: string; currency: string; what: string; client: string | null; billable: 'yes' | 'no'; rid?: number; stored?: string; kept?: { miles: number; rate: number } }

const today = () => { const d = new Date(); return `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` }
const size = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)
const labelOf = (f: File, fromCamera = false) => `${f.type === 'application/pdf' ? 'PDF' : fromCamera ? 'Photo from the camera' : 'Photo'}, ${size(f.size)}`
// As the server reads it (reimbursement-rules.ts amountOf): a plain number, at most 2 decimals, over 0 once rounded.
const amountOk = (a: string) => readAmount(a) != null
const amountOf = (a: string) => readAmount(a) ?? 0
const isMileage = (it: Pick<Item, 'category'>) => it.category === MILEAGE
/** Its stored file stays: an edited receipt with no new file picked and the old one not removed. */
const keeps = (it: Item) => it.rid != null && !it.file && !!it.stored && !!it.fileLabel
/**
 * A line is ready: its receipt (but Mileage), its miles or amount, its description;
 * a meal while travelling over the $25 with a description that says why (owner, 5 November 2026).
 */
const itemOk = (it: Item) => ((!!it.file || !!it.fileLabel) || !needsReceipt(it.category))
  && (isMileage(it) ? milesOf(it.miles) != null : amountOk(it.amount) && !mealReasonMissing(it.category, amountOf(it.amount), it.currency, it.what))
  && !!it.what.trim()
const nameOf = (it: Item) => it.file?.name ?? it.stored ?? 'receipt'
let nextKey = 1

/** A waiting request as the form starts with it: one client at the top when all its receipts share it, else each its own. */
function fromWaiting(w: WaitingRequest, blank: (p: Partial<Item>) => Item): { client: string; billable: 'yes' | 'no'; items: Item[] } {
  const one = w.items.every(x => x.client === w.items[0].client && x.billable === w.items[0].billable)
  const yn = (b: boolean): 'yes' | 'no' => (b ? 'yes' : 'no')
  return {
    client: one ? w.items[0].client ?? 'None' : 'None', billable: one ? yn(w.items[0].billable) : 'no',
    items: w.items.map(x => blank({
      rid: x.id, stored: x.receipt?.name, fileLabel: x.receipt?.label ?? '', date: x.date, category: x.category, amount: x.amount, miles: x.miles, currency: x.currency, what: x.what,
      // A Mileage line keeps its stored rate while its miles stay the same (the server decides the same way).
      ...(x.rate != null && x.miles ? { kept: { miles: Number(x.miles), rate: x.rate } } : {}),
      ...(one ? {} : { client: x.client ?? 'None', billable: yn(x.billable) }),
    })),
  }
}

function NewReimbursement({ data, draft, edit, send, onClose, onSent }: { data: ReimbursementsPage; draft?: Partial<Draft>; edit?: WaitingRequest; send: SendReimbursement; onClose: () => void; onSent: (toast?: string) => void }) {
  const blank = (p: Partial<Item> = {}): Item => ({ key: nextKey++, file: null, fileLabel: '', date: today(), category: 'Internet', amount: '', miles: '', currency: 'USD', what: '', client: null, billable: 'no', ...p })
  // Editing a waiting request (owner, 5 November 2026): the same form, filled in with it.
  const [start] = useState(() => (edit ? fromWaiting(edit, blank) : null))
  const [name, setName] = useState(edit ? edit.name : draft?.name ?? '')
  const [client, setClient] = useState(start?.client ?? draft?.client ?? 'None')
  const [billable, setBillable] = useState<'yes' | 'no'>(start?.billable ?? draft?.billable ?? 'no')
  const [items, setItems] = useState<Item[]>(() => start?.items ?? [
    blank({ file: draft?.file ?? null, fileLabel: draft?.fileLabel ?? '', date: draft?.date ?? today(), category: draft?.category ?? 'Internet', amount: draft?.amount ?? '', miles: draft?.miles ?? '', currency: draft?.currency ?? 'USD', what: draft?.what ?? '' }),
    ...(draft?.more ?? []).map(m => blank(m)),
  ])
  const title = edit ? 'Edit reimbursement' : 'New reimbursement'
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
  const remove = (key: number) => setItems(xs => (xs.length > 1 ? xs.filter(x => x.key !== key) : xs.map(x => ({ ...x, file: null, fileLabel: '', stored: undefined }))))
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
    // An edit names the request it changes; the route then knows each receipt by its id.
    if (edit) f.set('target', edit.key)
    f.set('count', String(items.length))
    if (name.trim()) f.set('name', name.trim())
    for (const [i, it] of items.entries()) {
      if (!it.file && !keeps(it) && needsReceipt(it.category)) return
      const day = parsePaidOn(it.date)
      if (!day) { setError(many ? `Receipt ${i + 1}: ${DAY_HINT.charAt(0).toLowerCase()}${DAY_HINT.slice(1)}` : DAY_HINT); return }
      const c = it.client ?? client
      if (it.rid != null) f.set(`rid_${i}`, String(it.rid))
      if (keeps(it)) f.set(`keep_${i}`, 'yes')
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
    if (r.ok) onSent(r.toast)
    else setError(r.error)
  }

  // A contractor's receipts go on a USD invoice, so they ask in dollars (owner, 24 October 2026); an
  // employee's document goes to Finance, who converts any other currency.
  const currencies = data.contractor ? ['USD'] : CURRENCIES
  const usdNote = 'In US dollars: your invoice is in USD. Paid in another currency? Convert it, and write the amount you paid in the description.'
  const afterLine = data.contractor
    ? (many ? 'Approved, you add each receipt to your next invoice, as its own line. If that invoice is already approved, they go on the one after.' : 'Approved, you add it to your next invoice. If that invoice is already approved, it goes on the one after.')
    : (many ? 'Approved, the portal puts each receipt on a reimbursement document and Finance pays you, outside Rippling payroll.' : 'Approved, the portal puts it on a reimbursement document and Finance pays you, outside Rippling payroll.')
  const rateOf = (it: Item, m: number | null) => (it.kept && m != null && it.kept.miles === m ? it.kept.rate : data.mileageRate)
  const rate = data.mileageRate
  const valueOf = (it: Item) => {
    if (isMileage(it)) { const m = milesOf(it.miles); return m == null ? null : { amount: mileageAmount(m, rateOf(it, m)), currency: 'USD' } }
    return amountOk(it.amount) ? { amount: amountOf(it.amount), currency: it.currency } : null
  }
  const total = totalsText(items.map(valueOf).filter((x): x is { amount: number; currency: string } => !!x))
  /** Under a line: the mileage worked out as it is typed, or the meals rule. */
  const lineHint = (it: Item) => {
    if (isMileage(it)) {
      const m = milesOf(it.miles)
      return <div className="text-[12px] text-tn-teal font-semibold tabular-nums lining-nums">{m == null ? `Miles times $${rate} a mile, in US dollars. No receipt needed.` : `${mileageText(m, rateOf(it, m))}. No receipt needed.`}</div>
    }
    if (it.category === MEALS_TRAVEL) {
      // Over the $25 it still goes, for review, with a description that says why (owner, 5 November 2026).
      if (overMealCap(it.category, amountOf(it.amount), it.currency)) return <div role="status" className="text-[12px] leading-[1.45] text-[#8a6d1a] font-semibold bg-[var(--warn-bg)] rounded-[9px] px-[11px] py-2">{MEAL_OVER_WARNING}</div>
      return <div className="text-[12px] leading-[1.45] text-muted">{MEAL_HINT}</div>
    }
    return null
  }
  const sendLabel = edit ? (busy ? 'Saving…' : 'Save changes') : busy ? 'Sending…' : many ? `Send ${items.length} receipts` : 'Send request'
  const clientOptions = ['None', ...data.clients].map(c => ({ value: c, label: c }))
  const files = (
    <>
      <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/heic,image/heif,image/webp,application/pdf" className="hidden" onChange={e => { addFiles([...(e.target.files ?? [])]); e.target.value = '' }} />
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { addFiles([...(e.target.files ?? [])], true); e.target.value = '' }} />
    </>
  )
  const billableSeg = (value: 'yes' | 'no', onChange: (v: 'yes' | 'no') => void, off: boolean, wide = false) => (
    <div className={SEG_BOX}>
      {([['yes', 'Yes'], ['no', 'No']] as const).map(([k, label]) => (
        <button key={k} type="button" disabled={off} aria-pressed={value === k} onClick={() => onChange(k)}
          className={`${segClass(value === k)} ${wide ? 'flex-1 h-10 justify-center' : ''}`}>{label}</button>
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
          <button type="button" onClick={() => pickFor(it.key)} aria-label={has ? `Change the receipt of line ${i + 1}` : `Add the receipt of line ${i + 1}`} title={has ? nameOf(it) : 'Add the receipt'}
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
                <div className="flex items-center gap-2.5">{thumb}<span className="flex-1 min-w-0 font-(family-name:--font-display) font-extrabold text-[12.5px] text-tn-ink truncate">{has ? nameOf(it) : 'Receipt missing'}</span>{close}</div>
                <div className="grid grid-cols-2 gap-2">{date}{cat}{amt}{cur}</div>
              </>
            ) : (
              <div className="grid grid-cols-[40px_120px_minmax(0,1fr)_104px_92px_32px] gap-2 items-center">{thumb}{date}{cat}{amt}{cur}{close}</div>
            )}
            {lineHint(it)}
            <input value={it.what} onChange={e => setItem(it.key, { what: e.target.value })} placeholder={isMileage(it) ? 'Where you drove, e.g. Office to the ASI convention and back' : `${DESCRIPTION_LABEL}, e.g. Uber to the client`} aria-label={`${DESCRIPTION_LABEL}, line ${i + 1}`} className={INPUT} />
            {it.client == null ? (
              <div className="flex items-center justify-between gap-3 text-[11.5px]">
                <span className={`min-w-0 truncate ${has || !needsReceipt(it.category) ? 'text-muted' : 'text-[#c8323d] font-semibold'}`}>{has ? `${phone ? '' : `${nameOf(it)} · `}${it.fileLabel}` : needsReceipt(it.category) ? 'Add the photo or PDF of this receipt' : 'No receipt needed for mileage'}</span>
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
  const note = <div className="text-[12.5px] text-tn-teal font-semibold leading-[1.5] bg-tn-teal-soft rounded-[10px] px-3 py-2.5">{edit ? `You can change it while nothing in it is decided; whoever decides is told in the bell. ${afterLine}` : afterLine}</div>
  const errorLine = error && <p role="alert" className="m-0 text-[12.5px] font-semibold text-[#c8323d]">{error}</p>

  // 9A on a phone (Requests.dc.html 9Ap): the whole screen, the receipt from the camera or a file.
  if (phone) {
    const PHONE_INPUT = `${INPUT} !h-11 !text-[14px]`
    return (
      <PhoneSheet crumb="Requests · Reimbursements" title={title} onBack={onClose}
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
                    <span className="font-(family-name:--font-display) font-extrabold text-[13.5px] text-tn-ink break-all">{nameOf(first)}</span>
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
            <label className="flex flex-col gap-[5px]"><FieldLabel>{DESCRIPTION_LABEL}</FieldLabel><textarea value={first.what} onChange={e => setItem(first.key, { what: e.target.value })} rows={2} placeholder="e.g. Home internet for October" className={`${TEXTAREA_PLAIN} !text-[14px]`} /></label>
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
    <Modal label={title} width={776} onClose={onClose} gap={16}>
      <div className="flex items-center justify-between gap-2.5">
        <h2 className={MODAL_TITLE}>{title}</h2>
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
                <span className="font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink break-all">{nameOf(first)}</span>
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
            <label className="flex flex-col gap-[5px]"><FieldLabel>{DESCRIPTION_LABEL}</FieldLabel><textarea value={first.what} onChange={e => setItem(first.key, { what: e.target.value })} rows={2} placeholder="e.g. Home internet for October" className={TEXTAREA_PLAIN} /></label>
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
        {!ok && <span className="mr-auto text-[12.5px] text-muted">{items.some(it => !isMileage(it) && amountOk(it.amount) && mealReasonMissing(it.category, amountOf(it.amount), it.currency, it.what)) ? 'A meal over the $25 needs a few words on why, in the description.' : many ? 'Each receipt needs its photo or PDF (mileage: the miles), the amount and the description.' : isMileage(first) ? 'Write the miles and where you drove.' : 'Add the receipt, the amount and the description.'}</span>}
        <button type="button" onClick={onClose} className={BTN.white}>Cancel</button>
        <button type="button" disabled={!ok || busy} onClick={() => void submit()} className={`${BTN.navy} disabled:opacity-45 disabled:cursor-not-allowed`}>
          <Icon d="M22 2 11 13M22 2l-7 20-4-9-9-4z" size={14} color={BTN_ICON.navy} width={2.4} />{sendLabel}
        </button>
      </div>
    </Modal>
  )
}

/** Withdraw a request still entirely waiting (owner, 5 November 2026): the reason is optional. */
function WithdrawDialog({ w, withdraw, onClose, onDone }: { w: WaitingRequest; withdraw: WithdrawReimbursement; onClose: () => void; onDone: (toast: string) => void }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const n = w.items.length
  const go = async () => {
    setBusy(true)
    setError(null)
    const r = await withdraw({ target: w.key, reason: reason.trim() || undefined }).catch(() => ({ ok: false as const, error: 'Not saved. Check the connection and try again.' }))
    setBusy(false)
    if (r.ok) onDone(r.toast)
    else setError(r.error)
  }
  return (
    <Modal label="Withdraw request" width={480} onClose={onClose} gap={14}>
      <div className="flex items-center justify-between gap-2.5">
        <h2 className={MODAL_TITLE}>Withdraw {w.name ? `"${w.name}"` : n > 1 ? `these ${n} receipts` : 'this request'}?</h2>
        <CloseButton onClick={onClose} />
      </div>
      <p className="m-0 text-[13px] text-[#5b6b82] leading-[1.5] [text-wrap:pretty]">
        {n > 1 ? `All ${n} receipts leave Approvals` : 'It leaves Approvals'} and show{n > 1 ? '' : 's'} as Withdrawn in your list. Whoever decides is told in the bell. To ask again, send a new request.
      </p>
      <label className="flex flex-col gap-[5px]"><FieldLabel>Why (optional)</FieldLabel><textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} maxLength={1000} placeholder="e.g. Sent twice by mistake" className={TEXTAREA_PLAIN} /></label>
      {error && <p role="alert" className="m-0 text-[12.5px] font-semibold text-[#c8323d]">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={BTN.white}>Keep it</button>
        <button type="button" disabled={busy} onClick={() => void go()} className={`${BTN.danger} disabled:opacity-45 disabled:cursor-not-allowed`}>{busy ? 'Withdrawing…' : 'Withdraw request'}</button>
      </div>
    </Modal>
  )
}
