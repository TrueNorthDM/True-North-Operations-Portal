'use client'

/**
 * The Work tab's two Clocky part 2 sections (handoff part 2, Company
 * Settings.dc.html frame 10A-1), drawn as the page's other sections:
 *
 *   Approvals      Reports to, who approves the hours and who the invoice, and
 *                  whether that is one step or two. No money: shown to whoever
 *                  sees the Work tab.
 *   Pay and hours  Pays as, the rate or the fixed amount, the hours allowance,
 *                  and for a contractor when time off comes (10A-3).
 *                  Money: only for the person, Super Admins and
 *                  Finance; changed by whoever keeps Rates & Costs (d-rates),
 *                  inside Edit work (5 November 2026: the editor keeps the
 *                  view's sections), or with this section's own Edit for
 *                  someone with d-rates who cannot edit the Work tab.
 *
 * The hours allowance is never typed here (owner, 5 November 2026): it is a
 * contractor's Hours limit, per week or per month (9 November 2026), set in
 * Edit work's Job section; US employees have none.
 */

import { INPUT as FIELD } from '@/lib/ui/fields'
import { Fragment, useState, type ReactNode } from 'react'
import { failText } from '@/lib/ui/action-error'
import { useRouter } from 'next/navigation'
import { Segmented } from '@/components/ui/Segmented'
import { NewTag } from '@/components/clocky/periods/ui'
import { BTN_MODAL_NAVY, BTN_MODAL_WHITE } from '@/components/clocky/entries/ui'
import { BTN_ICON } from '@/lib/ui/buttons'
import type { PaysAs } from '@/lib/timeclock/routing'
import { Section } from './PersonParts'
import { FIELD_LABEL } from '@/lib/ui/type'
import { allowanceFromLimit, limitAsTyped, type HoursLimitPer } from '@/lib/timeclock/allowance'

export interface ApprovalsView {
  rows: { k: string; v: string; sub: string }[]
  note: string
}

export interface PayView {
  isContractor: boolean
  paysAs: PaysAs | null
  hourlyRate: number | null
  fixedAmount: number | null
  /**
   * Derived from Hours limit (lib/timeclock/pay-terms.ts): a contractor's, per week or per month; null for
   * employees and for no number. `text`: with its window when that differs ("30 h / week · 126h 00m in Nov").
   */
  allowance: { hours: number; per: HoursLimitPer; text?: string } | null
  /** A contractor's "Time off" line (10A-3, 10A-4): "Contractors do not ask PTO", or from when they will. */
  timeOff?: string | null
  /** The change to employee scheduled (10A-4): the last day as a contractor, "Nov 30". */
  contractorUntil?: string | null
  canEdit: boolean
}

export type SavePay = (input: {
  paysAs: PaysAs | null
  amount: number | null
}) => Promise<{ ok: true } | { ok: false; error: string }>

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const PAYS: Record<PaysAs, string> = { hourly: 'Hourly', fixed_monthly: 'Fixed monthly', fixed_no_timesheet: 'Fixed, no timesheet' }
const LABEL = FIELD_LABEL
const INPUT = `${FIELD} tabular-nums lining-nums`
const PAYS_OPTIONS = [{ key: 'hourly' as const, label: 'Hourly' }, { key: 'fixed_monthly' as const, label: 'Fixed monthly' }, { key: 'fixed_no_timesheet' as const, label: 'Fixed, no timesheet' }]

/** The Hours allowance line: "30 h / week (Hours limit)", "None", or "Exempt (salaried)" for a US employee. */
export function allowanceText(isContractor: boolean, allowance: PayView['allowance']): string {
  if (!isContractor) return 'Exempt (salaried)'
  return allowance ? `${allowance.text ?? limitAsTyped(allowance)} (Hours limit)` : 'None'
}

/** The same line from the Work tab's draft: its Type and Hours limit as typed. */
export function draftAllowanceText(employmentType: string, hours: string, per: HoursLimitPer = 'week'): string {
  const contractor = employmentType === 'contractor'
  const h = hours.trim() === '' ? null : Number(hours)
  return allowanceText(contractor, allowanceFromLimit(contractor, h, per))
}

const ALLOWANCE_SUB = 'A contractor\'s Hours limit. US employees have none.'

export function Row({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-start py-2.5 border-b border-[var(--row-rule)]">
      <dt className="text-muted text-[13.5px]">{label}</dt>
      <dd className="m-0 flex flex-col items-end gap-0.5 text-right">
        <span className="text-[13.5px] font-semibold text-foreground">{value}</span>
        {sub && <span className="text-[11.5px] text-muted">{sub}</span>}
      </dd>
    </div>
  )
}

/**
 * Approvals. `alsoReportsTo` adds that line under Reports to (the Work tab
 * shows its reporting here). `reporting`, in Edit work, takes the place of
 * the Reports to line: the fields that decide who approves.
 */
export function ApprovalsSection({ view, alsoReportsTo, reporting }: { view: ApprovalsView; alsoReportsTo?: string; reporting?: ReactNode }) {
  const rows = reporting ? view.rows.filter(r => r.k !== 'Reports to') : view.rows
  return (
    <Section title="Approvals" tag={<NewTag />}>
      {reporting}
      <dl className="m-0">
        {rows.map(r => (
          <Fragment key={r.k}>
            <Row label={r.k} value={r.v} sub={reporting ? `${r.sub}. Follows Reports to once saved.` : r.sub} />
            {!reporting && r.k === 'Reports to' && alsoReportsTo !== undefined && <Row label="Also reports to" value={alsoReportsTo} />}
          </Fragment>
        ))}
      </dl>
      <p className="m-0 mt-2.5 text-[12px] text-tn-teal font-semibold leading-[1.5] bg-tn-teal-soft rounded-[10px] px-[11px] py-[9px]">{view.note}</p>
    </Section>
  )
}

const rateTextOf = (view: PayView) => view.paysAs === 'hourly'
  ? (view.hourlyRate != null ? `${money(view.hourlyRate)}/h` : 'Not set')
  : view.fixedAmount != null ? `${money(view.fixedAmount)}/mo` : 'Not set'

const rateLabelOf = (pays: PaysAs) => pays === 'fixed_no_timesheet'
  ? 'Fixed amount a month (USD). No timesheet: they send their own invoice each month'
  : pays === 'fixed_monthly' ? 'Fixed amount a month (USD)' : 'Rate an hour (USD)'

/** The amount saved for a way of paying: the rate for hourly, the monthly amount otherwise. */
export const amountFor = (view: Pick<PayView, 'hourlyRate' | 'fixedAmount'>, p: PaysAs) => (p === 'hourly' ? view.hourlyRate : view.fixedAmount)

/** A Pays as and amount being typed, and what it means for savePayTerms. */
export interface PayDraft { pays: PaysAs; amount: string }

export const payDraftOf = (view: PayView): PayDraft => {
  const pays = view.paysAs ?? 'hourly'
  const a = amountFor(view, pays)
  return { pays, amount: a != null ? a.toFixed(2) : '' }
}

/**
 * The draft as savePayTerms takes it: null when nothing changed (or the
 * person is not a contractor, whose pay is Rippling's), an error when the
 * amount cannot be read.
 */
export function payDraftInput(view: PayView, d: PayDraft): { paysAs: PaysAs; amount: number } | { error: string } | null {
  if (!view.isContractor) return null
  const a = d.amount.trim() === '' ? null : Number(d.amount.replace(/[$,\s]/g, ''))
  const before = amountFor(view, d.pays)
  if (d.pays === (view.paysAs ?? 'hourly') && a === before) return null
  if (a === null || !Number.isFinite(a) || a <= 0) return { error: d.pays === 'hourly' ? 'Type the rate an hour.' : 'Type the amount a month.' }
  return { paysAs: d.pays, amount: a }
}

/** Pays as and the amount, as fields: in Edit work and in this section's own editor. */
export function PayFields({ view, draft, onDraft }: { view: PayView; draft: PayDraft; onDraft: (d: PayDraft) => void }) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <span className={LABEL}>Pays as</span>
        <div className="self-start max-w-full overflow-x-auto">
          <Segmented label="Pays as" value={draft.pays} options={PAYS_OPTIONS}
            onChange={k => { const a = amountFor(view, k); onDraft({ pays: k, amount: a != null ? a.toFixed(2) : '' }) }} />
        </div>
      </div>
      <label className="flex flex-col gap-[5px]">
        <span className={LABEL}>{rateLabelOf(draft.pays)}</span>
        <input value={draft.amount} onChange={e => onDraft({ ...draft, amount: e.target.value })} inputMode="decimal" className={INPUT} />
        <span className="text-[11.5px] text-muted">Same value as Rates &amp; Costs. Invoices use it for the period; it is never typed on an invoice.</span>
      </label>
    </>
  )
}

/** Pay and hours inside Edit work: Pays as and the amount for whoever keeps Rates & Costs, the allowance as the draft makes it. */
export function PayHoursEdit({ view, draft, onDraft, allowance }: { view: PayView; draft: PayDraft; onDraft: (d: PayDraft) => void; allowance: string }) {
  const editable = view.canEdit && view.isContractor
  return (
    <div className={`mb-[22px] ${editable ? 'rounded-[14px] outline-2 outline-[#cfe5e5] outline-offset-8' : ''}`}>
      <Section title="Pay and hours" tag={<NewTag />} flush>
        {editable
          ? <div className="flex flex-col gap-3.5 pt-3 pb-1"><PayFields view={view} draft={draft} onDraft={onDraft} /></div>
          : <PayRows view={view} withAllowance={false} />}
        <dl className="m-0">
          <Row label="Hours allowance" value={allowance} sub={ALLOWANCE_SUB} />
          {view.timeOff && <Row label="Time off" value={view.timeOff} />}
        </dl>
      </Section>
    </div>
  )
}

function PayRows({ view, withAllowance = true }: { view: PayView; withAllowance?: boolean }) {
  const rateText = rateTextOf(view)
  return (
    <dl className="m-0">
      <Row label="Pays as" value={!view.isContractor ? 'Salary (Rippling)' : `${PAYS[view.paysAs ?? 'hourly']}${view.contractorUntil ? ', then salary in Rippling' : ''}`} />
      {view.isContractor && <Row label={view.paysAs === 'hourly' ? 'Rate / cost' : 'Fixed amount a month'} value={view.contractorUntil ? `${rateText} until ${view.contractorUntil}` : rateText} sub={view.paysAs === 'fixed_no_timesheet' ? 'No timesheet: they send their own invoice each month' : undefined} />}
      {withAllowance && <Row label="Hours allowance" value={allowanceText(view.isContractor, view.allowance)} />}
      {withAllowance && view.timeOff && <Row label="Time off" value={view.timeOff} />}
    </dl>
  )
}

export function PayHoursSection({ view, save, startEditing = false, editLink = true, after }: {
  view: PayView
  save: SavePay
  /** Under the rows: Change to employee… (10A-3), for a contractor and a Super Admin. */
  after?: ReactNode
  /** Design check only: open in Edit (frame 10A-1). */
  startEditing?: boolean
  /** The section's own Edit: only for whoever cannot use Edit work (it changes pay too). */
  editLink?: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(startEditing)
  const [draft, setDraft] = useState<PayDraft>(() => payDraftOf(view))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const open = () => {
    setDraft(payDraftOf(view))
    setError(null)
    setEditing(true)
  }

  const submit = async () => {
    const input = payDraftInput(view, draft)
    if (!input) return setEditing(false)
    if ('error' in input) return setError(input.error)
    setBusy(true)
    setError(null)
    try {
      const r = await save(input)
      if (!r.ok) return setError(r.error)
      setEditing(false)
      router.refresh()
    } catch (e) {
      setError(failText(e))
    } finally {
      setBusy(false)
    }
  }

  const canOpen = view.canEdit && view.isContractor && editLink
  if (!editing) {
    return (
      <Section title="Pay and hours" tag={<NewTag />} right={canOpen ? <button type="button" onClick={open} className="border-0 bg-transparent p-0 font-(family-name:--font-display) font-extrabold text-[11px] tracking-[.04em] uppercase text-tn-teal hover:text-tn-ink cursor-pointer">Edit</button> : undefined}>
        <PayRows view={view} />
        {after}
      </Section>
    )
  }

  return (
    // While it is being changed, a soft teal ring says where the change is (as the Timesheet section).
    <div className="mb-[22px] rounded-[14px] outline-2 outline-[#cfe5e5] outline-offset-8">
      <Section title="Pay and hours" tag={<NewTag />} flush>
        <div className="flex flex-col gap-3.5 pt-3">
          {view.isContractor && <PayFields view={view} draft={draft} onDraft={setDraft} />}
          <dl className="m-0">
            <Row label="Hours allowance" value={allowanceText(view.isContractor, view.allowance)} sub={`${ALLOWANCE_SUB} Change it with Hours limit in Edit work.`} />
          </dl>
          {error && <p role="alert" className="m-0 text-[12.5px] font-bold text-[#c8323d]">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(false)} disabled={busy} className={BTN_MODAL_WHITE}>Cancel</button>
            <button type="button" onClick={() => void submit()} disabled={busy} className={`${BTN_MODAL_NAVY} disabled:opacity-60`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>Save
            </button>
          </div>
        </div>
      </Section>
    </div>
  )
}
