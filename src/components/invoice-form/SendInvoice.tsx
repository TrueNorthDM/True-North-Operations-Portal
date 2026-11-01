'use client'

/**
 * The invoice form (owner, 1 November 2026, forms mockup v3, sections 2 to
 * 5), for people with no portal login:
 *
 *   Who are you?        name, email, how they are paid; "Send me a code"
 *   Check your email    the 6-digit code, "Change email", send it again
 *   Your invoice        their details (from their record, with Edit; blank
 *                       when we do not have them), the month, the work
 *                       (a fixed amount, or one line a Monday item), the
 *                       reimbursements with the portal's own fields, and
 *                       their own PDF if they want
 *   Preview             the invoice as True North gets it, "Not sent yet"
 *   Thank you           the number when it has one, a copy by email
 *
 * The page shows the rules as they are typed (lib/invoice-form/rules.ts);
 * the route that stores it checks everything again and works out the money.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Segmented } from '@/components/ui/Segmented'
import { Select } from '@/components/ui/Select'
import { DateField, MonthField } from '@/components/ui/DateField'
import { InvoiceDoc, type InvoiceDocData } from '@/components/clocky/invoices/InvoiceDoc'
import { FieldLabel, Icon, ICON } from '@/components/clocky/entries/ui'
import { BTN, BTN_ICON } from '@/lib/ui/buttons'
import { INPUT, SELECT_FIELD, TEXTAREA } from '@/lib/ui/fields'
import { ERROR_BOX } from '@/lib/ui/feedback'
import { CARD_TITLE, FIELD_LABEL } from '@/lib/ui/type'
import { formatAddressLines, type AddressForm } from '@/lib/address'
import { allCountries, countryName } from '@/lib/countries'
import { dateLabel } from '@/lib/timeclock/format'
import { dueOn } from '@/lib/timeclock/invoice-lines'
import { usd } from '@/lib/timeclock/invoice-doc'
import { CATEGORIES, MEAL_HINT, MEALS_TRAVEL, MILEAGE, mileageAmount, mileageNote, mileageText, milesOf, needsReceipt, overMealCap } from '@/lib/timeclock/reimbursement-rules'
import { DELIVERABLE_LABEL, DELIVERABLE_TAG, MAX_FILE, RECEIPT_TYPES, buildFormLines, codeOf, emailOf, itemName, type Deliverable, type FormKind, type Rates } from '@/lib/invoice-form/rules'

export interface SendContext {
  email: string
  /** Their own record, when the email is in the Directory: name and address only. */
  found: { name: string; address: AddressForm } | null
  rates: Rates
  mileageRate: number
  clients: string[]
  billTo: { name: string; address: string; email: string }
  paymentDays: number
  today: string
  defaultMonth: string
}

type Fail = { ok: false; error: string }
export interface SendApi {
  requestCode: (i: { token: string; email: string }) => Promise<{ ok: true; email: string; waitSeconds: number } | Fail>
  checkCode: (i: { token: string; email: string; code: string }) => Promise<{ ok: true } | Fail>
  forgetDevice: (i: { token: string }) => Promise<{ ok: true } | Fail>
  checkLine: (i: { token: string; name: string; kind: string; others: { name: string; kind: string }[]; month: string }) => Promise<{ ok: true; name: string } | Fail>
  checkMonth: (i: { token: string; month: string }) => Promise<{ ok: true; again: string | null } | Fail>
}

const TRY = 'Something went wrong. Check the connection and try again.'
const BTN_MAIN = `${BTN.navy} justify-center disabled:opacity-45 disabled:cursor-not-allowed`
const LINK = BTN.link

/** The page's frame: the logo, a white card with the navy band, the line under it. No portal shell. */
function Frame({ crumb, title, children }: { crumb: string; title: string; children: ReactNode }) {
  return (
    <main className="flex-1 min-h-screen bg-[#f0eee9] px-4 py-6 flex flex-col items-center gap-4">
      <Image src="/logos/true-north.png" alt="True North Digital Marketing" width={1352} height={705} priority className="h-10 w-auto" />
      <div className="bg-white rounded-[20px] shadow-[0_10px_30px_rgba(1,35,88,.10)] w-full max-w-[640px] overflow-hidden">
        <div className="bg-tn-primary px-[22px] pt-4 pb-3.5 flex flex-col gap-0.5">
          <span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.1em] uppercase text-[#a9b6cc]">{crumb}</span>
          <h1 className="m-0 font-(family-name:--font-display) font-extrabold text-[20px] text-[#ffffff]">{title}</h1>
        </div>
        <div className="px-[22px] pt-[18px] pb-6 flex flex-col gap-3.5">{children}</div>
      </div>
      <p className="m-0 text-[11.5px] text-muted">Powered by the True North Operations Portal</p>
    </main>
  )
}

/** While North Time is closed: the form says so and takes nothing. */
export function SendClosed() {
  return (
    <Frame crumb="True North · Send an invoice" title="Not open yet">
      <p className="m-0 text-[14px] leading-[1.55] text-foreground">The invoice form is not open yet. Send your invoice to True North the way you do today; this page works as soon as it opens.</p>
    </Frame>
  )
}

const Field = ({ label, children, note }: { label: string; children: ReactNode; note?: ReactNode }) => (
  <label className="flex flex-col gap-[5px] min-w-0">
    <FieldLabel>{label}</FieldLabel>
    {children}
    {note && <span className="text-[12px] text-muted leading-[1.45]">{note}</span>}
  </label>
)
const Section = ({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) => (
  <div className="flex flex-col gap-3 pt-3.5 border-t border-[var(--row-rule)]">
    <div>
      <h2 className={CARD_TITLE}>{title}</h2>
      {sub && <p className="m-0 mt-0.5 text-[12.5px] text-muted leading-[1.45]">{sub}</p>}
    </div>
    {children}
  </div>
)
const Err = ({ text }: { text: string | null }) => (text ? <div role="alert" className={ERROR_BOX}>{text}</div> : null)

// ── Who are you? / Check your email ────────────────────────────────────────

function WhoAreYou({ token, api, kind, setKind, name, setName, onSent }: {
  token: string; api: SendApi; kind: FormKind; setKind: (k: FormKind) => void; name: string; setName: (s: string) => void; onSent: (email: string) => void
}) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ok = name.trim().length >= 2 && !!emailOf(email)
  const send = async () => {
    setBusy(true); setError(null)
    try {
      const r = await api.requestCode({ token, email })
      if (r.ok) onSent(r.email)
      else setError(r.error)
    } catch { setError(TRY) } finally { setBusy(false) }
  }
  return (
    <Frame crumb="True North · Send an invoice" title="Who are you?">
      <Field label="Your name"><input value={name} onChange={e => setName(e.target.value)} maxLength={120} autoComplete="name" className={INPUT} /></Field>
      <Field label="Your email"><input value={email} onChange={e => setEmail(e.target.value)} maxLength={200} type="email" autoComplete="email" inputMode="email" className={INPUT} /></Field>
      <div className="flex flex-col gap-[5px]">
        <span className={FIELD_LABEL}>How you are paid</span>
        <Segmented label="How you are paid" value={kind} onChange={setKind} options={[{ key: 'fixed', label: 'Fixed amount' }, { key: 'deliverables', label: 'Deliverables' }]} />
      </div>
      <Err text={error} />
      <button type="button" disabled={!ok || busy} onClick={() => void send()} className={BTN_MAIN}>{busy ? 'Sending…' : 'Send me a code'}</button>
      <p className="m-0 text-[12px] text-muted leading-[1.5]">We email you a 6-digit code to make sure it is you.</p>
    </Frame>
  )
}

function CheckEmail({ token, api, email, onBack, onDone }: { token: string; api: SendApi; email: string; onBack: () => void; onDone: () => void }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [wait, setWait] = useState(60)
  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait(w => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])
  const go = async () => {
    setBusy(true); setError(null); setNote(null)
    try {
      const r = await api.checkCode({ token, email, code })
      if (r.ok) onDone()
      else setError(r.error)
    } catch { setError(TRY) } finally { setBusy(false) }
  }
  const again = async () => {
    setError(null); setNote(null)
    try {
      const r = await api.requestCode({ token, email })
      if (r.ok) { setWait(r.waitSeconds); setNote('A new code is on its way. The one before no longer works.') }
      else setError(r.error)
    } catch { setError(TRY) }
  }
  return (
    <Frame crumb="True North · Send an invoice" title="Check your email">
      <p className="m-0 text-[13.5px] text-foreground leading-[1.5]">We sent a code to <b className="text-tn-ink">{email}</b>. <button type="button" onClick={onBack} className={LINK}>Change email</button></p>
      <Field label="The code" note={<>Valid for 10 minutes. Not there? Look in spam, or {wait > 0 ? `send it again (after ${wait} seconds)` : <button type="button" onClick={() => void again()} className={LINK}>send it again</button>}.</>}>
        <input value={code} onChange={e => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="6 digits" className={`${INPUT} tracking-[.2em] tabular-nums`} />
      </Field>
      {note && <p className="m-0 text-[12.5px] text-tn-teal font-semibold">{note}</p>}
      <Err text={error} />
      <button type="button" disabled={!codeOf(code) || busy} onClick={() => void go()} className={BTN_MAIN}>{busy ? 'Checking…' : 'Continue'}</button>
    </Frame>
  )
}

// ── The invoice ────────────────────────────────────────────────────────────

interface Details { name: string; line1: string; line2: string; city: string; state: string; zip: string; country: string }
interface Line { key: number; name: string; kind: Deliverable }
interface Receipt {
  key: number; event: string; file: File | null; date: string; category: string; amount: string; miles: string
  what: string; client: string; billable: 'yes' | 'no'
}
let nextKey = 1
const blankReceipt = (today: string): Receipt => ({ key: nextKey++, event: '', file: null, date: today, category: 'Software', amount: '', miles: '', what: '', client: 'None', billable: 'no' })
const detailsOf = (name: string, a: AddressForm | null): Details => ({ name, line1: a?.line1 ?? '', line2: a?.line2 ?? '', city: a?.city ?? '', state: a?.state ?? '', zip: a?.zip ?? '', country: a?.country ?? '' })
const detailsDone = (d: Details) => d.name.trim().length >= 2 && !!d.line1.trim() && !!d.city.trim() && !!d.country
const addressLine = (d: Details) => formatAddressLines({ line1: d.line1, line2: d.line2, city: d.city, state: d.state, zip: d.zip, country: d.country }).join(', ')
const amountOf = (s: string) => Number(s.replace(/[$,\s]/g, ''))
const fileOk = (f: File) => f.size <= MAX_FILE && !!RECEIPT_TYPES[f.type]
const shortDay = (iso: string) => dateLabel(iso).replace(/, \d{4}$/, '')
/** A receipt ready to add: its file (but Mileage), its miles or amount (a meal while travelling under the cap), what it was for. */
const receiptOk = (r: Receipt) => (!!r.file || !needsReceipt(r.category)) && !!r.date
  && (r.category === MILEAGE ? milesOf(r.miles) != null : amountOf(r.amount) > 0 && amountOf(r.amount) < 100_000 && !overMealCap(r.category, amountOf(r.amount), 'USD'))
  && !!r.what.trim()

function DetailsEditor({ d, set, email, found, onCancel, onUse }: { d: Details; set: (p: Partial<Details>) => void; email: string; found: boolean; onCancel?: () => void; onUse?: () => void }) {
  const countries = useMemo(() => allCountries().map(c => ({ value: c.code, label: `${c.flag ? `${c.flag} ` : ''}${c.name}` })), [])
  return (
    <div className="flex flex-col gap-3">
      <Field label="Full name"><input value={d.name} onChange={e => set({ name: e.target.value })} maxLength={120} autoComplete="name" className={INPUT} /></Field>
      <Field label="Address"><input value={d.line1} onChange={e => set({ line1: e.target.value })} maxLength={200} placeholder="Street and number" autoComplete="address-line1" className={INPUT} /></Field>
      <input value={d.line2} onChange={e => set({ line2: e.target.value })} maxLength={200} placeholder="Apartment, suite (optional)" aria-label="Address line 2" autoComplete="address-line2" className={INPUT} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <input value={d.city} onChange={e => set({ city: e.target.value })} maxLength={100} placeholder="City" aria-label="City" autoComplete="address-level2" className={INPUT} />
        <input value={d.state} onChange={e => set({ state: e.target.value })} maxLength={100} placeholder="State or region" aria-label="State or region" autoComplete="address-level1" className={INPUT} />
        <input value={d.zip} onChange={e => set({ zip: e.target.value })} maxLength={30} placeholder="Postal code" aria-label="Postal code" autoComplete="postal-code" className={INPUT} />
      </div>
      <div className="flex flex-col gap-[5px]">
        <FieldLabel>Country</FieldLabel>
        <Select fullWidth searchable value={d.country} onChange={v => set({ country: v })} options={countries} placeholder="Choose" ariaLabel="Country" className={SELECT_FIELD} />
      </div>
      <Field label="Email" note={found ? 'The email you confirmed with the code. To use another, start again with it.' : undefined}>
        <div className={`${INPUT} flex items-center bg-subtle text-muted`}>{email}</div>
      </Field>
      {onUse && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={onCancel} className={`${BTN.white} justify-center`}>Cancel</button>
            <button type="button" disabled={!detailsDone(d)} onClick={onUse} className={BTN_MAIN}>Use these</button>
          </div>
          <p className="m-0 text-[12px] text-muted leading-[1.5]">What you change here goes on this invoice and on your record at True North, so next time it is already right.</p>
        </>
      )}
    </div>
  )
}

function ReceiptEditor({ r, n, ctx, onCancel, onSave }: { r: Receipt; n: number; ctx: SendContext; onCancel: () => void; onSave: (r: Receipt) => void }) {
  const [d, setD] = useState(r)
  const [fileError, setFileError] = useState<string | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLInputElement>(null)
  const set = (p: Partial<Receipt>) => setD(x => ({ ...x, ...p }))
  const pick = (f: File | undefined) => {
    if (!f) return
    if (!fileOk(f)) { setFileError('The receipt must be a photo (JPG, PNG, HEIC) or a PDF, up to 10 MB.'); return }
    setFileError(null)
    set({ file: f })
  }
  const mileage = d.category === MILEAGE
  const miles = milesOf(d.miles)
  const clientOptions = ['None', ...ctx.clients].map(c => ({ value: c, label: c }))
  return (
    <div className="rounded-[12px] border border-[var(--panel-border)] p-3.5 flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">Reimbursement</span>
        <span className="text-[12px] text-muted">Receipt {n}</span>
      </div>
      <Field label="Event or trip (optional)"><input value={d.event} onChange={e => set({ event: e.target.value })} maxLength={120} placeholder="e.g. ASI convention, Aug 5 to 8" className={INPUT} /></Field>
      <div className="flex flex-col gap-[5px]">
        <FieldLabel>{needsReceipt(d.category) ? 'Receipt' : 'Receipt (optional for mileage)'}</FieldLabel>
        <input ref={file} type="file" accept="image/jpeg,image/png,image/heic,image/heif,image/webp,application/pdf" className="hidden" onChange={e => { pick(e.target.files?.[0]); e.target.value = '' }} />
        <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { pick(e.target.files?.[0]); e.target.value = '' }} />
        {d.file ? (
          <div className="flex items-center justify-between gap-2 rounded-[12px] bg-subtle px-3 py-2.5 text-[13px]">
            <span className="min-w-0 truncate text-tn-ink font-semibold">{d.file.name}</span>
            <button type="button" onClick={() => set({ file: null })} className="border-0 bg-transparent p-0 cursor-pointer text-[12.5px] font-bold text-[#c8323d]">Remove</button>
          </div>
        ) : (
          <div className="rounded-[12px] border-[1.5px] border-dashed border-[#cdd5e0] px-3.5 py-3 text-center text-[13px] text-muted flex flex-col items-center gap-1">
            <span><button type="button" onClick={() => file.current?.click()} className={LINK}>Choose a file</button> or <button type="button" onClick={() => camera.current?.click()} className={LINK}>take a photo</button></span>
            <span className="text-[12px]">PDF or image, up to 10 MB</span>
          </div>
        )}
        <Err text={fileError} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-[5px]"><FieldLabel>Date of the expense</FieldLabel><DateField value={d.date} onChange={v => set({ date: v })} max={ctx.today} ariaLabel="Date of the expense" /></div>
        <div className="flex flex-col gap-[5px]"><FieldLabel>Category</FieldLabel><Select fullWidth value={d.category} onChange={v => set({ category: v })} options={CATEGORIES.map(c => ({ value: c, label: c }))} ariaLabel="Category" className={SELECT_FIELD} /></div>
      </div>
      {mileage ? (
        <Field label="Miles" note={<span className="text-tn-teal font-semibold">{miles == null ? `Miles times $${ctx.mileageRate} a mile, in US dollars. No receipt needed.` : `${mileageText(miles, ctx.mileageRate)}. No receipt needed.`}</span>}>
          <input value={d.miles} onChange={e => set({ miles: e.target.value })} placeholder="e.g. 120" inputMode="decimal" className={`${INPUT} tabular-nums`} />
        </Field>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-3">
          <Field label="Amount"><input value={d.amount} onChange={e => set({ amount: e.target.value })} placeholder="0.00" inputMode="decimal" className={`${INPUT} tabular-nums`} /></Field>
          <div className="flex flex-col gap-[5px]"><FieldLabel>Currency</FieldLabel><Select fullWidth value="USD" onChange={() => {}} options={[{ value: 'USD', label: 'USD' }]} ariaLabel="Currency" className={SELECT_FIELD} /></div>
        </div>
      )}
      {d.category === MEALS_TRAVEL && <p className={`m-0 text-[12px] leading-[1.45] ${overMealCap(d.category, amountOf(d.amount), 'USD') ? 'text-[#c8323d] font-semibold' : 'text-muted'}`}>{MEAL_HINT}</p>}
      {!mileage && <p className="m-0 -mt-1.5 text-[12px] text-muted leading-[1.45]">In US dollars: the invoice is in USD. Paid in another currency? Convert it, and write the amount you paid in What it was for.</p>}
      <Field label="What it was for"><textarea value={d.what} onChange={e => set({ what: e.target.value })} rows={2} maxLength={440} placeholder="e.g. Adobe Premiere, November" className={`w-full ${TEXTAREA}`} /></Field>
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
        <div className="flex flex-col gap-[5px] min-w-0"><FieldLabel>Client or project (optional)</FieldLabel><Select fullWidth searchable value={d.client} onChange={v => set({ client: v, billable: v === 'None' ? 'no' : d.billable })} options={clientOptions} ariaLabel="Client or project" className={SELECT_FIELD} /></div>
        <div className="flex flex-col gap-[5px]">
          <FieldLabel>Billable to the client</FieldLabel>
          <Segmented label="Billable to the client" value={d.billable} onChange={v => set({ billable: v })} disabled={d.client === 'None'} options={[{ key: 'no', label: 'Not billable' }, { key: 'yes', label: 'Billable' }]} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onCancel} className={`${BTN.white} justify-center`}>Cancel</button>
        <button type="button" disabled={!receiptOk(d)} onClick={() => onSave(d)} className={BTN_MAIN}>{r.what ? 'Save it' : 'Add it'}</button>
      </div>
    </div>
  )
}

function InvoicePage({ token, api, ctx, kind, setKind, startName, onSent }: {
  token: string; api: SendApi; ctx: SendContext; kind: FormKind; setKind: (k: FormKind) => void; startName: string; onSent: (number: string | null, email: string) => void
}) {
  const router = useRouter()
  const found = ctx.found
  const [details, setDetails] = useState<Details>(() => detailsOf(found?.name ?? startName, found?.address ?? null))
  const [saved, setSaved] = useState<Details>(details)
  const [editing, setEditing] = useState(!found || !detailsDone(details))
  const [changedRecord, setChangedRecord] = useState(false)
  const [month, setMonth] = useState(ctx.defaultMonth)
  const [monthNote, setMonthNote] = useState<{ error?: string; again?: string } | null>(null)
  const [covers, setCovers] = useState('')
  const [amount, setAmount] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [itemDraft, setItemDraft] = useState('')
  const [itemKind, setItemKind] = useState<Deliverable>('page')
  const [lineError, setLineError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [rmbOn, setRmbOn] = useState<'yes' | 'no'>('no')
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [open, setOpen] = useState<Receipt | null>(null)
  const [pdf, setPdf] = useState<File | null>(null)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pdfInput = useRef<HTMLInputElement>(null)
  const top = useRef<HTMLDivElement>(null)

  // The month picked: free, theirs to send again (it was returned), or already sent.
  useEffect(() => {
    let live = true
    api.checkMonth({ token, month }).then(r => { if (live) setMonthNote(r.ok ? (r.again ? { again: r.again } : null) : { error: r.error }) }).catch(() => { if (live) setMonthNote(null) })
    return () => { live = false }
  }, [api, token, month])

  const items = lines.map(l => ({ name: l.name, kind: l.kind }))
  const rmb = rmbOn === 'yes' ? receipts : []
  const reimbursements = rmb.map(r => ({
    category: r.category,
    purpose: r.category === MILEAGE ? `${r.what.trim()}${mileageNote(milesOf(r.miles) ?? 0, ctx.mileageRate)}` : r.what.trim(),
    amount: r.category === MILEAGE ? mileageAmount(milesOf(r.miles) ?? 0, ctx.mileageRate) : amountOf(r.amount),
  }))
  const work = kind === 'fixed' ? { kind: 'fixed' as const, covers, amount: amountOf(amount) } : { kind: 'deliverables' as const, items }
  const built = buildFormLines(work, ctx.rates, reimbursements)
  const workOk = kind === 'fixed' ? covers.trim().length >= 3 && amountOf(amount) > 0 && amountOf(amount) <= 100_000 : lines.length > 0
  const ready = detailsDone(details) && !editing && workOk && !monthNote?.error && !open
  const why = !detailsDone(details) || editing ? 'Fill in your details and press Use these.' : !workOk ? (kind === 'fixed' ? 'Say what it covers and the amount.' : 'Add at least one line.') : open ? 'Add the receipt you are filling in, or cancel it.' : monthNote?.error ? 'Pick another month.' : null

  const addLine = async () => {
    const name = itemName(itemDraft)
    if (name.length < 2) return
    setAdding(true); setLineError(null)
    try {
      const r = await api.checkLine({ token, name, kind: itemKind, others: items, month })
      if (r.ok) { setLines(xs => [...xs, { key: nextKey++, name: r.name, kind: itemKind }]); setItemDraft('') }
      else setLineError(r.error)
    } catch { setLineError(TRY) } finally { setAdding(false) }
  }
  const pickPdf = (f: File | undefined) => {
    if (!f) return
    if (f.type !== 'application/pdf' || f.size > MAX_FILE) { setPdfError('Choose a PDF of up to 10 MB.'); return }
    setPdfError(null); setPdf(f)
  }
  const startOver = async () => {
    try { await api.forgetDevice({ token }) } finally { router.refresh() }
  }

  const send = async () => {
    setBusy(true); setError(null)
    const f = new FormData()
    const fileOf = new Map<number, number>()
    rmb.forEach((r, i) => { if (r.file) { f.set(`receipt_${i}`, r.file); fileOf.set(r.key, i) } })
    if (pdf) f.set('own_pdf', pdf)
    f.set('data', JSON.stringify({
      month, kind, sender: details, saveToRecord: !!found && changedRecord,
      covers, amount, items,
      reimbursements: rmb.map(r => ({
        event: r.event, date: r.date, category: r.category, amount: r.amount, miles: r.miles, currency: 'USD', purpose: r.what,
        client: r.client, billable: r.billable, file: fileOf.get(r.key) ?? null,
      })),
    }))
    try {
      const res = await fetch(`/send/${encodeURIComponent(token)}/submit`, { method: 'POST', body: f })
      const body = await res.json().catch(() => null) as { ok: boolean; error?: string; number?: string | null; email?: string } | null
      if (body?.ok) onSent(body.number ?? null, body.email ?? ctx.email)
      else setError(body?.error ?? 'Not sent. Try again in a moment.')
    } catch { setError(TRY) } finally { setBusy(false) }
  }

  const monthName = (() => { const [y, m] = month.split('-').map(Number); return `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1]} ${y}` })()
  const firstName = (details.name || ctx.found?.name || startName).trim().split(/\s+/)[0] || 'there'

  if (preview) {
    const issued = ctx.today
    const to = ctx.billTo.address.split('\n')
    const doc: InvoiceDocData = {
      number: 'Not sent yet', date: dateLabel(issued), period: monthName, due: dateLabel(dueOn(issued, ctx.paymentDays)),
      lines: built.lines.filter(l => l.kind !== 'reimbursement').map(l => ({ desc: l.description, hrs: '-', muted: l.kind === 'fixed', rate: l.kind === 'fixed' ? 'Fixed' : usd(l.rate ?? 0), amt: usd(l.amount) })),
      reimb: built.lines.filter(l => l.kind === 'reimbursement').map(l => ({ desc: `${l.description} (${shortDay(rmb[l.reimbursement!].date)})`, cat: l.client ?? '', amt: usd(l.amount) })),
      total: usd(built.total),
      from: { name: details.name, line: addressLine(details), email: ctx.email },
      to: { name: ctx.billTo.name, line1: to[0] ?? '', line2: [to.slice(1).join(', '), ctx.billTo.email].filter(Boolean).join(' · ') },
      paid: null,
    }
    const nReceipts = rmb.filter(r => r.file).length
    const attached = [pdf ? 'your invoice (PDF)' : null, nReceipts ? `${nReceipts} receipt${nReceipts > 1 ? 's' : ''}` : null].filter(Boolean).join(', ')
    return (
      <Frame crumb="Preview" title="Your invoice">
        <div className="rounded-[12px] border border-[var(--panel-border)] overflow-x-auto">
          <div className="min-w-[520px]"><InvoiceDoc inv={doc} variant="detail" /></div>
        </div>
        <p className="m-0 text-[12px] text-muted leading-[1.5]">Payment terms: {ctx.paymentDays} days from approval.{attached ? ` Attached: ${attached}.` : ''}</p>
        <Err text={error} />
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={() => { setPreview(false); setError(null) }} className={`${BTN.white} justify-center`}>Back to edit</button>
          <button type="button" disabled={busy} onClick={() => void send()} className={BTN_MAIN}>
            <Icon d={ICON.send} size={14} color={BTN_ICON.navy} width={2.4} />{busy ? 'Sending…' : 'Send invoice'}
          </button>
        </div>
      </Frame>
    )
  }

  const editingDone = (d: Details) => { setSaved(d); setEditing(false); if (found) setChangedRecord(true) }
  return (
    <Frame crumb={`Your invoice · ${kind === 'fixed' ? 'Fixed amount' : 'Deliverables'}`} title={`Hi, ${firstName}`}>
      <div ref={top} className="flex items-center justify-between gap-3 flex-wrap">
        <Segmented label="How you are paid" value={kind} onChange={setKind} options={[{ key: 'fixed', label: 'Fixed amount' }, { key: 'deliverables', label: 'Deliverables' }]} />
        <button type="button" onClick={() => void startOver()} className={LINK}>Not you? Start again</button>
      </div>

      <Section title="Your details" sub={found ? <>From your record at True North. {!editing && <button type="button" onClick={() => setEditing(true)} className={LINK}>Edit</button>}</> : 'We do not have you yet: fill them in as they go on the invoice.'}>
        {editing ? (
          <DetailsEditor d={details} set={p => setDetails(x => ({ ...x, ...p }))} email={ctx.email} found={!!found}
            onCancel={found && detailsDone(saved) ? () => { setDetails(saved); setEditing(false) } : undefined}
            onUse={() => editingDone(details)} />
        ) : (
          <div className="rounded-[10px] bg-tn-teal-soft px-3 py-2.5 text-[13px] text-tn-ink leading-[1.5]">
            <b>{details.name}</b><br />{addressLine(details) || countryName(details.country)}<br /><span className="text-muted">{ctx.email}</span>
          </div>
        )}
      </Section>

      <Section title="The period">
        <div className="flex flex-col gap-[5px]">
          <FieldLabel>Month</FieldLabel>
          <MonthField value={month} onChange={setMonth} max={ctx.today.slice(0, 7)} ariaLabel="Month" />
        </div>
        {monthNote?.error && <Err text={monthNote.error} />}
        {monthNote?.again && <p className="m-0 text-[12.5px] text-tn-teal font-semibold leading-[1.45]">Your invoice {monthNote.again} for {monthName} was returned. Sending it again keeps its number.</p>}
      </Section>

      {kind === 'fixed' ? (
        <Section title="The work">
          <Field label="What it covers"><textarea value={covers} onChange={e => setCovers(e.target.value)} rows={3} maxLength={500} placeholder="e.g. Video editing for the Good News channel, 6 episodes" className={`w-full ${TEXTAREA}`} /></Field>
          <Field label="Amount (USD)"><input value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" inputMode="decimal" className={`${INPUT} tabular-nums`} /></Field>
        </Section>
      ) : (
        <Section title="The work" sub="One line a Monday item. Paste its name as it is on Monday.">
          <input value={itemDraft} onChange={e => setItemDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void addLine() } }} maxLength={200} placeholder="The Monday item's name" aria-label="The Monday item's name" className={INPUT} />
          <Segmented label="What it is" value={itemKind} onChange={setItemKind} options={[{ key: 'page', label: `${DELIVERABLE_LABEL.page} · ${usd(ctx.rates.page).replace(/\.00$/, '')}` }, { key: 'asset', label: `${DELIVERABLE_LABEL.asset} · ${usd(ctx.rates.asset).replace(/\.00$/, '')}` }]} />
          <button type="button" disabled={itemName(itemDraft).length < 2 || adding || lines.length >= 200} onClick={() => void addLine()} className={`${BTN.smallWhite} self-start disabled:opacity-45`}>
            <Icon d={ICON.plus} size={13} color={BTN_ICON.white} width={2.6} />{adding ? 'Checking…' : 'Add the line'}
          </button>
          <Err text={lineError} />
          {lines.length > 0 && (
            <div className="rounded-[12px] border border-[var(--panel-border)] overflow-hidden">
              {lines.map(l => (
                <div key={l.key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2.5 gap-y-0.5 px-3 py-2.5 border-t border-[var(--row-rule)] first:border-t-0 text-[13px]">
                  <b className="text-tn-ink font-bold [overflow-wrap:anywhere]">{l.name}</b>
                  <span className="row-span-2 self-center font-bold text-tn-ink tabular-nums">{usd(ctx.rates[l.kind])}</span>
                  <span className="text-[12px] text-muted">{DELIVERABLE_TAG[l.kind]} · <button type="button" onClick={() => setLines(xs => xs.filter(x => x.key !== l.key))} className="border-0 bg-transparent p-0 cursor-pointer text-[12px] font-bold text-[#c8323d]">Remove</button></span>
                </div>
              ))}
              <div className="flex justify-between px-3 py-2.5 bg-subtle font-(family-name:--font-display) font-extrabold text-tn-ink tabular-nums">
                <span>{lines.length} line{lines.length > 1 ? 's' : ''}</span><span>{usd(buildFormLines({ kind: 'deliverables', items }, ctx.rates).total)}</span>
              </div>
            </div>
          )}
        </Section>
      )}

      <Section title="Would you like to add a reimbursement to this invoice?">
        <Segmented label="Add a reimbursement" value={rmbOn} onChange={v => { setRmbOn(v); if (v === 'yes' && !receipts.length && !open) setOpen(blankReceipt(ctx.today)) }} options={[{ key: 'yes', label: 'Yes' }, { key: 'no', label: 'No' }]} />
        {rmbOn === 'yes' && (
          <>
            {receipts.map((r, i) => (
              <div key={r.key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2.5 gap-y-0.5 rounded-[12px] border border-[var(--panel-border)] px-3 py-2.5 text-[13px]">
                <b className="text-tn-ink font-bold [overflow-wrap:anywhere]">{r.category} · {r.what}</b>
                <span className="row-span-2 self-center font-bold text-tn-ink tabular-nums">{usd(reimbursements[i].amount)}</span>
                <span className="text-[12px] text-muted">
                  {shortDay(r.date)}{r.file ? ` · ${r.file.name}` : ''} · <button type="button" onClick={() => setOpen(r)} className={`${LINK} text-[12px]`}>Edit</button> · <button type="button" onClick={() => setReceipts(xs => xs.filter(x => x.key !== r.key))} className="border-0 bg-transparent p-0 cursor-pointer text-[12px] font-bold text-[#c8323d]">Remove</button>
                </span>
              </div>
            ))}
            {open && (
              <ReceiptEditor key={open.key} r={open} n={receipts.some(x => x.key === open.key) ? receipts.findIndex(x => x.key === open.key) + 1 : receipts.length + 1} ctx={ctx}
                onCancel={() => setOpen(null)}
                onSave={r => { setReceipts(xs => (xs.some(x => x.key === r.key) ? xs.map(x => (x.key === r.key ? r : x)) : [...xs, r])); setOpen(null) }} />
            )}
            {!open && receipts.length < 20 && (
              <button type="button" onClick={() => setOpen(blankReceipt(ctx.today))} className={`${BTN.smallWhite} self-start`}>
                <Icon d={ICON.plus} size={13} color={BTN_ICON.white} width={2.6} />{receipts.length ? 'Add another receipt' : 'Add a receipt'}
              </button>
            )}
          </>
        )}
      </Section>

      <Section title="Your own invoice (optional)">
        <input ref={pdfInput} type="file" accept="application/pdf" className="hidden" onChange={e => { pickPdf(e.target.files?.[0]); e.target.value = '' }} />
        {pdf ? (
          <div className="flex items-center justify-between gap-2 rounded-[12px] bg-subtle px-3 py-2.5 text-[13px]">
            <span className="min-w-0 truncate text-tn-ink font-semibold">{pdf.name}</span>
            <button type="button" onClick={() => setPdf(null)} className="border-0 bg-transparent p-0 cursor-pointer text-[12.5px] font-bold text-[#c8323d]">Remove</button>
          </div>
        ) : (
          <button type="button" onClick={() => pdfInput.current?.click()}
            onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); pickPdf(e.dataTransfer.files?.[0]) }}
            className="rounded-[12px] border-[1.5px] border-dashed border-[#cdd5e0] bg-white px-3.5 py-3.5 text-center text-[13px] text-muted cursor-pointer hover:border-tn-teal">
            <b className="text-tn-teal">Choose a PDF</b> or drop it here
          </button>
        )}
        <Err text={pdfError} />
      </Section>

      <div className="flex flex-col gap-2 pt-3.5 border-t border-[var(--row-rule)]">
        {kind === 'deliverables' || rmb.length ? <div className="flex justify-between font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink tabular-nums"><span>Total</span><span>{usd(built.total)}</span></div> : null}
        {why && <span className="text-[12.5px] text-muted">{why}</span>}
        <button type="button" disabled={!ready} onClick={() => { setPreview(true); top.current?.scrollIntoView({ block: 'start' }) }} className={BTN_MAIN}>Preview invoice</button>
      </div>
    </Frame>
  )
}

function ThankYou({ number, email }: { number: string | null; email: string }) {
  return (
    <Frame crumb="True North" title="Sent">
      <div className="flex flex-col items-center text-center gap-2.5 py-6 px-1.5">
        <div className="w-14 h-14 rounded-full bg-[#e6f6ee] flex items-center justify-center"><Icon d={ICON.check} size={26} color="#0d7a4f" width={3} /></div>
        <h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[20px] text-tn-ink">We have received your invoice.</h2>
        <p className="m-0 text-[14px] text-foreground">If we have questions, we&apos;ll be in touch.</p>
        <p className="m-0 text-[13px] text-muted leading-[1.5]">
          {number
            ? <>Your invoice is <b className="text-tn-ink">{number}</b>. A copy is on its way to {email}, and you hear from us when it is approved and when it is paid.</>
            : <>A copy is on its way to {email}. Your invoice number comes by email once we add you to our records, and you hear from us when it is approved and when it is paid.</>}
        </p>
      </div>
    </Frame>
  )
}

export function SendInvoice({ token, ctx, api }: { token: string; ctx: SendContext | null; api: SendApi }) {
  const router = useRouter()
  const [kind, setKind] = useState<FormKind>('fixed')
  const [name, setName] = useState('')
  const [codeFor, setCodeFor] = useState<string | null>(null)
  const [sent, setSent] = useState<{ number: string | null; email: string } | null>(null)
  if (sent) return <ThankYou number={sent.number} email={sent.email} />
  if (ctx) return <InvoicePage token={token} api={api} ctx={ctx} kind={kind} setKind={setKind} startName={name} onSent={(number, email) => { setSent({ number, email }); window.scrollTo({ top: 0 }) }} />
  if (codeFor) return <CheckEmail token={token} api={api} email={codeFor} onBack={() => setCodeFor(null)} onDone={() => { setCodeFor(null); router.refresh() }} />
  return <WhoAreYou token={token} api={api} kind={kind} setKind={setKind} name={name} setName={setName} onSent={setCodeFor} />
}
