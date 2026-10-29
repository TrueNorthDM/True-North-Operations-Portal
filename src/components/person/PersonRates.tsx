'use client'

/**
 * The rates of someone who is no longer active (owner, 28 October 2026):
 * inactive people appear only in the Directory's People tab, Inactive, so
 * Rates & Costs no longer lists them. Their hours stay in the reports, priced
 * at these rates, so this section on their Work tab keeps the same four values
 * and the same saves as Rates & Costs, for whoever keeps it (d-rates).
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { savePersonBeRate, savePersonCostRate, savePersonMonthlySalary, saveTrAssignment } from '@/lib/tsheets/settings-actions'
import { firstOfNextMonth } from '@/lib/tsheets/report'
import type { PersonPageData } from '@/lib/directory/person-page-data'
import { Section, fieldCls } from './PersonParts'

type Rates = NonNullable<PersonPageData['rates']>
type Key = 'client' | 'cost' | 'be' | 'salary'

const REASON = 'Updated on the person page (no longer active)'
const ROWS: { key: Key; label: string; unit: string }[] = [
  { key: 'client', label: 'Rate / client (i7)', unit: '/h' },
  { key: 'cost', label: 'Rate / cost', unit: '/h' },
  { key: 'be', label: 'Rate / break-even', unit: '/h' },
  { key: 'salary', label: 'Month / salary', unit: '' },
]
const valueOf = (r: Rates, k: Key) => (k === 'client' ? r.clientRate : k === 'cost' ? r.costRate : k === 'be' ? r.beRate : r.salary)
const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const monthName = (iso: string) => new Date(`${iso.slice(0, 7)}-01T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' })

export function PersonRates({ name, rates }: { name: string; rates: Rates }) {
  const router = useRouter()
  const [draft, setDraft] = useState<Record<Key, string> | null>(null)
  const [nextMonth, setNextMonth] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const thisMonth = `${today.slice(0, 8)}01`
  const next = firstOfNextMonth(today)

  const open = () => {
    const s = (k: Key) => { const v = valueOf(rates, k); return v != null ? v.toFixed(2) : '' }
    setDraft({ client: s('client'), cost: s('cost'), be: s('be'), salary: s('salary') })
    setNextMonth(true)
    setError(null)
  }
  // Like Rates & Costs: a value is saved only when it changed to a number above zero.
  const changed = (k: Key) => {
    if (!draft || draft[k].trim() === '' || (k === 'client' && !rates.canEditClient)) return null
    const n = Number(draft[k])
    return Number.isFinite(n) && n > 0 && n !== valueOf(rates, k) ? n : null
  }
  const clientChanged = changed('client') != null

  const save = async () => {
    const ops: Promise<{ ok: boolean; error?: string }>[] = []
    const client = changed('client'), cost = changed('cost'), be = changed('be'), salary = changed('salary')
    if (client != null) {
      if (rates.i7ClientId == null) { setError('No i7 client found to attach the rate to.'); return }
      ops.push(saveTrAssignment({ personId: rates.personId, tsheetsUserId: rates.tsheetsUserId, clientId: rates.i7ClientId, hourlyRate: client, effectiveFrom: nextMonth ? next : thisMonth, justification: REASON }))
    }
    if (cost != null) ops.push(savePersonCostRate({ personId: rates.personId, costRate: cost, justification: REASON }))
    if (be != null) ops.push(savePersonBeRate({ personId: rates.personId, beRate: be, justification: REASON }))
    if (salary != null) ops.push(savePersonMonthlySalary({ personId: rates.personId, monthlySalary: salary, justification: REASON }))
    if (!ops.length) { setDraft(null); return }
    setPending(true)
    setError(null)
    const res = await Promise.all(ops.map(p => p.catch(() => ({ ok: false, error: 'Not saved. Reload the page and try again.' }))))
    setPending(false)
    const bad = res.find(r => !r.ok)
    if (bad) { setError(bad.error ?? 'Not saved. Try again in a moment.'); return }
    setDraft(null)
    router.refresh()
  }

  return (
    <Section title="Rates" right={rates.canEdit && !draft ? <button type="button" onClick={open} className="border-0 bg-transparent p-0 cursor-pointer text-tn-teal font-bold normal-case tracking-normal text-[12.5px]">Edit rates</button> : undefined}>
      <p className="m-0 py-2 text-[12.5px] text-muted leading-normal">{name} is no longer active, so Rates & Costs no longer lists them. Their hours stay in the reports at these rates.</p>
      <dl className="m-0">
        {ROWS.map(r => {
          const v = valueOf(rates, r.key)
          return (
            <div key={r.key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3.5 items-center py-2.5 border-b border-[var(--row-rule)] last:border-b-0">
              <dt className="text-muted text-[13.5px]">{r.label}</dt>
              <dd className="m-0 text-right text-[13.5px] font-semibold text-foreground tabular-nums lining-nums">
                {draft && (r.key !== 'client' || rates.canEditClient)
                  ? <input type="number" min="0" step="0.01" inputMode="decimal" value={draft[r.key]} aria-label={r.label}
                      onChange={e => setDraft(d => (d ? { ...d, [r.key]: e.target.value } : d))} className={`${fieldCls} w-[140px] text-right py-[7px]`} />
                  : v != null ? `${money(v)}${r.unit}` : <span className="text-muted font-normal">-</span>}
              </dd>
            </div>
          )
        })}
      </dl>
      {draft && (
        <div className="flex flex-col gap-2.5 mt-3">
          {clientChanged && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[12.5px] text-muted">A client rate applies to a whole month. When does the new one start?</span>
              <div className="flex flex-wrap gap-2">
                {([[true, `1 ${monthName(next)}`], [false, `1 ${monthName(thisMonth)} (reprices ${monthName(thisMonth)})`]] as const).map(([k, l]) => (
                  <button key={String(k)} type="button" aria-pressed={nextMonth === k} onClick={() => setNextMonth(k)}
                    className={`rounded-[9px] px-3 py-1.5 text-[12.5px] font-bold border ${nextMonth === k ? 'bg-tn-primary text-[#ffffff] border-tn-primary' : 'bg-white text-tn-ink border-slate-200'}`}>{l}</button>
                ))}
              </div>
            </div>
          )}
          {error && <p role="alert" className="m-0 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setDraft(null)} className="rounded-[9px] border border-slate-200 bg-white text-tn-ink px-3.5 py-2 text-[13px] font-bold">Cancel</button>
            <button type="button" disabled={pending} onClick={() => void save()} className="rounded-[9px] bg-[#F2C40A] text-tn-ink px-3.5 py-2 text-[13px] font-bold disabled:opacity-50">{pending ? 'Saving…' : 'Save rates'}</button>
          </div>
        </div>
      )}
    </Section>
  )
}
