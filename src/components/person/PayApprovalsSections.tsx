'use client'

/**
 * The Work tab's two Clocky part 2 sections (handoff part 2, Company
 * Settings.dc.html frame 10A-1), drawn as the page's other sections:
 *
 *   Approvals      Reports to, who approves the hours and who the invoice, and
 *                  whether that is one step or two. No money: shown to whoever
 *                  sees the Work tab.
 *   Pay and hours  Pays as, the rate or the fixed amount, the hours allowance.
 *                  Money: only for the person, Super Admins, Admins and
 *                  Finance; changed by whoever keeps Rates & Costs (d-rates).
 */

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Segmented } from '@/components/ui/Segmented'
import { NewTag } from '@/components/clocky/periods/ui'
import { BTN_MODAL_NAVY, BTN_MODAL_WHITE } from '@/components/clocky/entries/ui'
import { BTN_ICON } from '@/lib/ui/buttons'
import type { PaysAs } from '@/lib/timeclock/routing'
import { Section } from './PersonParts'

export interface ApprovalsView {
  rows: { k: string; v: string; sub: string }[]
  note: string
}

export interface PayView {
  isContractor: boolean
  paysAs: PaysAs | null
  hourlyRate: number | null
  fixedAmount: number | null
  allowance: { hours: number; period: 'week' | 'month' } | null
  canEdit: boolean
}

export type SavePay = (input: {
  paysAs: PaysAs | null
  amount: number | null
  allowance: { hours: number; period: 'week' | 'month' } | null
}) => Promise<{ ok: true } | { ok: false; error: string }>

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const PAYS: Record<PaysAs, string> = { hourly: 'Hourly', fixed_monthly: 'Fixed monthly', fixed_no_timesheet: 'Fixed, no timesheet' }
const UNIT = { week: 'a week', month: 'a month' } as const
const LABEL = 'font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted'
const INPUT = 'h-10 box-border px-3 border border-[var(--panel-border)] rounded-[10px] text-[13px] text-tn-ink bg-white outline-none tabular-nums lining-nums focus:border-tn-teal focus:shadow-[0_0_0_3px_rgba(30,125,127,.15)]'

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
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

export function ApprovalsSection({ view }: { view: ApprovalsView }) {
  return (
    <Section title="Approvals" tag={<NewTag />}>
      <dl className="m-0">{view.rows.map(r => <Row key={r.k} label={r.k} value={r.v} sub={r.sub} />)}</dl>
      <p className="m-0 mt-2.5 text-[12px] text-tn-teal font-semibold leading-[1.5] bg-tn-teal-soft rounded-[10px] px-[11px] py-[9px]">{view.note}</p>
    </Section>
  )
}

export function PayHoursSection({ view, save, startEditing = false, after }: {
  view: PayView
  save: SavePay
  /** Under the rows: Change to employee… (10A-3), for a contractor and a Super Admin. */
  after?: ReactNode
  /** Design check only: open in Edit (frame 10A-1). */
  startEditing?: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(startEditing)
  const [pays, setPays] = useState<PaysAs>(view.paysAs ?? 'hourly')
  const first = (view.paysAs ?? 'hourly') === 'hourly' ? view.hourlyRate : view.fixedAmount
  const [amount, setAmount] = useState(first != null ? first.toFixed(2) : '')
  const [alKind, setAlKind] = useState<'none' | 'week' | 'month'>(view.allowance?.period ?? 'none')
  const [alHours, setAlHours] = useState(view.allowance ? String(view.allowance.hours) : '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const open = () => {
    setPays(view.paysAs ?? 'hourly')
    const a = (view.paysAs ?? 'hourly') === 'hourly' ? view.hourlyRate : view.fixedAmount
    setAmount(a != null ? a.toFixed(2) : '')
    setAlKind(view.allowance?.period ?? 'none')
    setAlHours(view.allowance ? String(view.allowance.hours) : '')
    setError(null)
    setEditing(true)
  }
  const amountFor = (p: PaysAs) => (p === 'hourly' ? view.hourlyRate : view.fixedAmount)

  const submit = async () => {
    const a = amount.trim() === '' ? null : Number(amount.replace(/[$,\s]/g, ''))
    if (view.isContractor && (a === null || !Number.isFinite(a) || a <= 0)) return setError(pays === 'hourly' ? 'Type the rate an hour.' : 'Type the amount a month.')
    const h = Number(alHours)
    if (alKind !== 'none' && (!Number.isFinite(h) || h <= 0)) return setError('Type the hours of the allowance.')
    setBusy(true)
    setError(null)
    try {
      const r = await save({ paysAs: view.isContractor ? pays : null, amount: view.isContractor ? a : null, allowance: alKind === 'none' ? null : { hours: h, period: alKind } })
      if (!r.ok) return setError(r.error)
      setEditing(false)
      router.refresh()
    } catch {
      setError('That did not go through. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  const rateText = view.paysAs === 'hourly'
    ? (view.hourlyRate != null ? `${money(view.hourlyRate)}/h` : 'Not set')
    : view.fixedAmount != null ? `${money(view.fixedAmount)}/mo` : 'Not set'

  if (!editing) {
    return (
      <Section title="Pay and hours" tag={<NewTag />} right={view.canEdit ? <button type="button" onClick={open} className="border-0 bg-transparent p-0 font-(family-name:--font-display) font-extrabold text-[11px] tracking-[.04em] uppercase text-tn-teal hover:text-tn-ink cursor-pointer">Edit</button> : undefined}>
        <dl className="m-0">
          <Row label="Pays as" value={view.isContractor ? PAYS[view.paysAs ?? 'hourly'] : 'Salary (Rippling)'} />
          {view.isContractor && <Row label={view.paysAs === 'hourly' ? 'Rate an hour' : 'Fixed amount a month'} value={rateText} sub={view.paysAs === 'fixed_no_timesheet' ? 'No timesheet: the invoice is made on the 1st' : undefined} />}
          <Row label="Hours allowance" value={view.allowance ? `${view.allowance.hours}h ${UNIT[view.allowance.period]}` : 'None'} />
        </dl>
        {after}
      </Section>
    )
  }

  const rateLabel = pays === 'fixed_no_timesheet'
    ? 'Fixed amount a month (USD). No timesheet: the invoice is made by itself on the 1st and goes straight to approval'
    : pays === 'fixed_monthly' ? 'Fixed amount a month (USD)' : 'Rate an hour (USD)'
  const alHint = alKind === 'none'
    ? 'No allowance: hours are never flagged as over.'
    : `Going over ${alHours || '0'}h ${UNIT[alKind]} needs extra hours approved before. Hours are still recorded and flagged, never blocked.`

  return (
    // While it is being changed, a soft teal ring says where the change is (as the Timesheet section).
    <div className="mb-[22px] rounded-[14px] outline-2 outline-[#cfe5e5] outline-offset-8">
      <Section title="Pay and hours" tag={<NewTag />} flush>
        <div className="flex flex-col gap-3.5 pt-3">
          {view.isContractor && (
            <>
              <div className="flex flex-col gap-1.5">
                <span className={LABEL}>Pays as</span>
                <div className="self-start">
                  <Segmented label="Pays as" display="px-[13px] py-[7px] text-[12.5px]" value={pays}
                    options={[{ key: 'hourly', label: 'Hourly' }, { key: 'fixed_monthly', label: 'Fixed monthly' }, { key: 'fixed_no_timesheet', label: 'Fixed, no timesheet' }]}
                    onChange={k => { setPays(k); const a = amountFor(k); setAmount(a != null ? a.toFixed(2) : '') }} />
                </div>
              </div>
              <label className="flex flex-col gap-[5px]">
                <span className={LABEL}>{rateLabel}</span>
                <input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" className={INPUT} />
                <span className="text-[11.5px] text-muted">Same value as Rates &amp; Costs. Invoices use it for the period; it is never typed on an invoice.</span>
              </label>
            </>
          )}
          <div className="flex flex-col gap-1.5">
            <span className={LABEL}>Hours allowance</span>
            <div className="flex gap-2.5 items-center flex-wrap">
              <Segmented label="Hours allowance" display="px-3 py-[7px] text-[12.5px]" value={alKind}
                options={[{ key: 'none', label: 'None' }, { key: 'week', label: 'A week' }, { key: 'month', label: 'A month' }]} onChange={setAlKind} />
              {alKind !== 'none' && (
                <span className="flex items-center gap-2">
                  <input value={alHours} onChange={e => setAlHours(e.target.value)} inputMode="decimal" aria-label="Hours" className={`${INPUT} w-20`} />
                  <span className="text-[13px] text-foreground">{`hours ${UNIT[alKind]}`}</span>
                </span>
              )}
            </div>
            <span className="text-[11.5px] text-muted leading-[1.5]">{alHint}</span>
          </div>
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
