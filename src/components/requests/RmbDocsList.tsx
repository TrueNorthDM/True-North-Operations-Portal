'use client'

/**
 * Documents (owner, 25 October 2026): every reimbursement document for Super
 * Admins, Admins and Finance, laid out as the Invoices list (6E) with its
 * parts: the strip, the filters (state, person, and period by the document's
 * date), Export CSV and the Paid column. Finance alone gets Mark paid, with
 * the document's dialog (9D). A row opens the document, where its PDF is.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { withViewAs } from '@/components/ViewAsKeeper'
import type { RmbDocList, RmbDocListRow } from '@/lib/timeclock/rmb-docs-list'
import type { Result } from '@/lib/timeclock/clocky-types'
import { LabeledSelect, type ToastState } from '@/components/clocky/entries/ui'
import { MarkPaidDialog, STATE_PILL, type PayTarget } from '@/components/clocky/invoices/InvoiceParts'
import { ExportCsvButton, LIST_HEAD, ListStrip, PersonCell, RowMarkPaid, StatePill, StateSwitch, downloadCsv } from '@/components/clocky/invoices/ListParts'

export type MarkRmbPaid = (i: { id: number; paidOn: string; ref?: string; note?: string }) => Promise<Result<{ toast: string }>>

export type DocFilter = 'all' | 'appr' | 'paid'
const SEG: [DocFilter, string][] = [['all', 'All'], ['appr', 'Approved'], ['paid', 'Paid']]
const ALL_PERIODS = 'All periods'
const EVERYONE = 'Everyone'
// Literal classes, so Tailwind sees them: the action column is Finance's alone.
const COLS_PAY = 'grid-cols-[150px_minmax(200px,1.3fr)_80px_130px_minmax(130px,.8fr)_120px_minmax(170px,1fr)_120px]'
const COLS = 'grid-cols-[150px_minmax(200px,1.3fr)_80px_130px_minmax(130px,.8fr)_120px_minmax(170px,1fr)]'

const plural = (n: number) => `${n} document${n === 1 ? '' : 's'}`

export function RmbDocsList({ data, markRmbPaid, initial, say }: {
  data: RmbDocList
  markRmbPaid: MarkRmbPaid
  /** ?state=appr opens on the ones to pay (Home's "Reimbursements to pay"); the design checks open the dialog. */
  initial?: { st?: DocFilter; pay?: number }
  say: (t: ToastState) => void
}) {
  const router = useRouter()
  const [st, setSt] = useState<DocFilter>(initial?.st ?? 'all')
  const [person, setPerson] = useState(EVERYONE)
  // All periods first: an approved document from last month is still to pay.
  const [period, setPeriod] = useState(ALL_PERIODS)
  const [pay, setPay] = useState<PayTarget | null>(() => {
    const r = initial?.pay ? data.rows.find(x => x.id === initial.pay) : null
    return r ? payTarget(r) : null
  })

  const shown = data.rows.filter(r => (period === ALL_PERIODS || r.period === period) && (person === EVERYONE || r.who === person) && (st === 'all' || r.st === st))
  const strip = [
    { k: 'appr' as const, label: 'Approved, not paid', val: String(data.toPay.count), sub: data.toPay.total, fg: '#1E7D7F' },
    { k: 'paid' as const, label: `Paid in ${data.paidIn.label}`, val: data.paidIn.total, sub: plural(data.paidIn.count), fg: '#0d7a4f' },
  ]
  const open = (r: RmbDocListRow) => router.push(withViewAs(`/requests/reimbursements/${r.id}`))

  const exportCsv = () => {
    const head = ['Number', 'Person', 'Team', 'Items', 'Date', 'Total', 'Currency', 'State', 'Paid']
    const lines = [head, ...shown.map(r => [r.number, r.who, r.team, String(r.items), r.date, r.csv.total, r.csv.currency, STATE_PILL[r.st].label, r.where])]
    const name = `reimbursement-documents-${period.toLowerCase().replace(/\s+/g, '-')}.csv`
    downloadCsv(name, lines)
    say({ text: `Exported ${plural(shown.length)} to ${name}` })
  }

  const cols = data.finance ? COLS_PAY : COLS
  const heads: [string, boolean?][] = [['Number'], ['Person'], ['Items', true], ['Date'], ['Total', true], ['State'], ['Paid'], ...(data.finance ? [['']] as [string][] : [])]

  return (
    <>
      <ListStrip cards={strip} active={st} onPick={c => { setSt(c.k); setPeriod(ALL_PERIODS) }} cols="grid-cols-1 sm:grid-cols-2" />
      <div className="flex flex-wrap gap-2.5 items-end">
        <StateSwitch options={SEG} value={st} onChange={setSt} />
        <div className="w-[220px]">
          <LabeledSelect label="Person" value={person} onChange={setPerson} search
            options={[EVERYONE, ...data.people].map(p => ({ value: p, label: p }))} />
        </div>
        <div className="w-[190px]">
          <LabeledSelect label="Period" value={period} onChange={setPeriod}
            options={[...data.periods, ALL_PERIODS].map(p => ({ value: p, label: p }))} />
        </div>
        <ExportCsvButton onClick={exportCsv} />
      </div>

      {shown.length > 0 ? (
        <>
          <div className="bg-white border border-[var(--panel-border)] rounded-[14px] overflow-auto">
            <div className="min-w-[960px]">
              <div className={`grid ${cols} bg-subtle border-b border-[var(--panel-border)]`}>
                {heads.map(([label, right], i) => <div key={i} className={`${LIST_HEAD} ${right ? 'text-right' : ''}`}>{label}</div>)}
              </div>
              {shown.map(r => (
                <div key={r.id} role="link" tabIndex={0} aria-label={`Open ${r.number}`}
                  onClick={() => open(r)} onKeyDown={e => { if (e.key === 'Enter') open(r) }}
                  className={`grid ${cols} items-center border-b border-[var(--row-rule)] text-[13px] cursor-pointer tabular-nums lining-nums hover:bg-[#f8f7f3]`}>
                  <div className="px-3.5 py-[11px] font-(family-name:--font-display) font-extrabold text-tn-ink whitespace-nowrap">{r.number}</div>
                  <PersonCell initials={r.initials} who={r.who} team={r.team} teamColor={r.teamColor} />
                  <div className="px-3.5 py-[11px] text-right text-foreground">{r.items}</div>
                  <div className="px-3.5 py-[11px] text-foreground whitespace-nowrap">{r.date}</div>
                  <div className="px-3.5 py-[11px] text-right font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">{r.total}</div>
                  <div className="px-3.5 py-[11px]"><StatePill st={r.st} /></div>
                  <div className="px-3.5 py-[11px] text-foreground whitespace-nowrap overflow-hidden text-ellipsis">{r.where}</div>
                  {data.finance && <div className="px-3.5 py-2 flex justify-end">{r.canPay && <RowMarkPaid onClick={() => setPay(payTarget(r))} />}</div>}
                </div>
              ))}
            </div>
          </div>
          <div className="text-[12px] text-muted leading-[1.5]">
            {data.finance ? 'Mark paid only after the money left. Paid once: the action goes away after that.' : `Only Finance${data.financeNames ? ` (${data.financeNames})` : ''} marks reimbursement documents paid.`} Totals add each currency on its own, as the document does.
          </div>
        </>
      ) : (
        <div className="bg-white border border-[var(--panel-border)] rounded-[14px] px-5 py-11 text-center text-[13.5px] text-muted">
          {data.rows.length ? 'No documents match these filters.' : "No documents yet. They are made when a Super Admin approves an employee's reimbursement."}
        </div>
      )}

      {pay && (
        <MarkPaidDialog target={pay} onClose={() => setPay(null)} save={markRmbPaid}
          refPlaceholder="e.g. ACH-20261103" notePlaceholder="" note={null}
          onSaved={t => { setPay(null); say({ text: t }); router.refresh() }} />
      )}
    </>
  )
}

function payTarget(r: RmbDocListRow): PayTarget {
  return { id: r.id, number: r.number, who: r.who, line: r.payLine, total: r.total }
}
