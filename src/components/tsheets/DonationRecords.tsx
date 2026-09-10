'use client'

/**
 * The donation records, and what has been done to them.
 *
 * Two tables, because they answer two questions. The entries are what the
 * figures are now, one per project per month, and they can be corrected here.
 * The log is what has happened to them, and it cannot be edited at all: an
 * audit trail you can rewrite is not one.
 *
 * Editing is inline rather than through the month dialog. The dialog asks about
 * a month and shows every project in it, which is the right shape when you are
 * entering what arrived; it is the wrong shape when you have found one wrong
 * figure and want to fix that figure.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveDonation } from '@/lib/timeclock/money-in-actions'
import type { DonationEntry, DonationLogEntry } from '@/lib/timeclock/donations-ledger'

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const monthLabel = (ym: string) => `${MON[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`

const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

/** "9 Sep 2026, 14:32" in the reader's own zone, which is where they typed it. */
function when(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const TH = 'text-left text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted px-3 py-2.5 whitespace-nowrap'
const TD = 'px-3 py-2.5 text-[13px] text-tn-ink align-top'
const FIELD = 'rounded-[10px] border border-[var(--panel-border)] bg-white px-2.5 py-1.5 text-[13px] text-tn-ink'

export function DonationRecords(
  { entries, log, years, year, logMissing, canEdit }: {
    entries: DonationEntry[]
    log: DonationLogEntry[]
    years: string[]
    year: string | null
    logMissing: boolean
    canEdit: boolean
  },
) {
  const router = useRouter()
  const [editing, setEditing] = useState<number | null>(null)

  const total = entries.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted">Year</span>
          {/* Offered from the years that exist, so it never lists an empty one. */}
          <div className="flex items-center gap-1.5">
            <YearChip label="All" active={year === null} href="/tools/time-report/grant-pass/donations" />
            {years.map(y => (
              <YearChip key={y} label={y} active={year === y} href={`/tools/time-report/grant-pass/donations?year=${y}`} />
            ))}
          </div>
        </div>
        <span className="text-[13px] text-muted">
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          <span className="mx-1.5">·</span>
          <span className="font-bold text-tn-ink tabular-nums">{money(total)}</span> in total
        </span>
      </div>

      <section className="space-y-3">
        <h2 className="font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink m-0">Entries</h2>
        {entries.length === 0 ? (
          <Empty>Nothing has been entered{year ? ` for ${year}` : ''} yet.</Empty>
        ) : (
          <div className="overflow-x-auto rounded-[14px] border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-subtle border-b border-slate-200">
                  <th className={TH}>Project</th>
                  <th className={TH}>Month</th>
                  <th className={`${TH} text-right`}>Amount</th>
                  <th className={TH}>Note</th>
                  <th className={TH}>Last changed</th>
                  {canEdit && <th className={`${TH} text-right`}>&nbsp;</th>}
                </tr>
              </thead>
              <tbody>
                {entries.map(e => (
                  <Row
                    key={e.id}
                    entry={e}
                    canEdit={canEdit}
                    open={editing === e.id}
                    onOpen={() => setEditing(e.id)}
                    onClose={() => setEditing(null)}
                    onSaved={() => { setEditing(null); router.refresh() }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink m-0">Change log</h2>
          <p className="text-[12.5px] text-muted mt-1 mb-0 leading-relaxed">
            Every entry, correction and removal, newest first. Nothing here can be edited.
          </p>
        </div>

        {/* An unapplied migration reaches the loader as a null rather than an
            error, so the page says so instead of showing an empty log that
            looks like nothing ever happened. */}
        {logMissing ? (
          <Empty>
            The change log table is not in the database yet. Run migration 080 and it will fill from here on.
          </Empty>
        ) : log.length === 0 ? (
          <Empty>No changes recorded{year ? ` for ${year}` : ''}.</Empty>
        ) : (
          <div className="overflow-x-auto rounded-[14px] border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-subtle border-b border-slate-200">
                  <th className={TH}>When</th>
                  <th className={TH}>Who</th>
                  <th className={TH}>What</th>
                  <th className={TH}>Project</th>
                  <th className={TH}>Month</th>
                  <th className={`${TH} text-right`}>Change</th>
                </tr>
              </thead>
              <tbody>
                {log.map(l => (
                  <tr key={l.id} className="border-t border-slate-100">
                    <td className={`${TD} text-muted whitespace-nowrap`}>{when(l.at)}</td>
                    <td className={TD}>{l.actor}</td>
                    <td className={TD}><ActionChip action={l.action} /></td>
                    <td className={TD}>{l.projectName}</td>
                    <td className={`${TD} whitespace-nowrap`}>{monthLabel(l.month)}</td>
                    <td className={`${TD} text-right tabular-nums whitespace-nowrap`}>
                      <Delta before={l.amountBefore} after={l.amountAfter} />
                      {(l.noteBefore || l.noteAfter) && l.noteBefore !== l.noteAfter && (
                        <span className="block text-[11.5px] text-muted mt-0.5">note changed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[14px] border border-dashed border-slate-300 bg-white/60 px-4 py-6 text-center text-[13px] text-muted m-0">
      {children}
    </p>
  )
}

function YearChip({ label, active, href }: { label: string; active: boolean; href: string }) {
  return (
    <a
      href={href}
      className={`rounded-full px-3 py-1 text-[12.5px] font-semibold transition-colors ${
        active ? 'bg-tn-primary text-white' : 'bg-subtle text-tn-ink hover:bg-slate-200'
      }`}
    >
      {label}
    </a>
  )
}

function ActionChip({ action }: { action: DonationLogEntry['action'] }) {
  const tone = action === 'created'
    ? 'bg-[#e7f5ee] text-[#1E9E6A]'
    : action === 'deleted'
      ? 'bg-[#fdece5] text-[#c2410c]'
      : 'bg-[#fdf3e2] text-[#b06d0a]'
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${tone}`}>
      {action}
    </span>
  )
}

/** "$425.00 → $500.00", or just the one figure when there is only one. */
function Delta({ before, after }: { before: number | null; after: number | null }) {
  if (before === null && after === null) return <span className="text-muted">-</span>
  if (before === null) return <span className="font-semibold">{money(after!)}</span>
  if (after === null) return <span className="line-through text-muted">{money(before)}</span>
  if (before === after) return <span className="text-muted">{money(after)}</span>
  return (
    <span>
      <span className="line-through text-muted">{money(before)}</span>
      <span className="mx-1.5 text-muted">to</span>
      <span className="font-semibold">{money(after)}</span>
    </span>
  )
}

function Row(
  { entry, canEdit, open, onOpen, onClose, onSaved }: {
    entry: DonationEntry
    canEdit: boolean
    open: boolean
    onOpen: () => void
    onClose: () => void
    onSaved: () => void
  },
) {
  const [amount, setAmount] = useState(entry.amount.toFixed(2))
  const [note, setNote] = useState(entry.note ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function submit(nextAmount: string) {
    setError(null)
    start(async () => {
      const res = await saveDonation({
        project: entry.project, month: entry.month, amount: nextAmount, note,
      })
      if (res.ok) onSaved()
      else setError(res.error ?? 'That did not save.')
    })
  }

  if (!open) {
    return (
      <tr className="border-t border-slate-100">
        <td className={`${TD} font-semibold whitespace-nowrap`}>{entry.projectName}</td>
        <td className={`${TD} whitespace-nowrap`}>{monthLabel(entry.month)}</td>
        <td className={`${TD} text-right tabular-nums font-semibold whitespace-nowrap`}>{money(entry.amount)}</td>
        <td className={`${TD} text-muted max-w-[280px]`}>{entry.note || <span className="text-slate-300">-</span>}</td>
        <td className={`${TD} text-muted text-[12px] whitespace-nowrap`}>
          {entry.lastChangedAt ? (
            <>
              {when(entry.lastChangedAt)}
              <span className="block">
                by {entry.lastChangedBy}
                {/* Only worth saying when it has actually been corrected. */}
                {entry.changes > 0 && <span> · corrected {entry.changes}×</span>}
              </span>
            </>
          ) : (
            <span className="text-slate-300">not recorded</span>
          )}
        </td>
        {canEdit && (
          <td className={`${TD} text-right`}>
            <button type="button" onClick={onOpen} className="text-[12.5px] font-semibold text-tn-teal hover:underline">
              Edit
            </button>
          </td>
        )}
      </tr>
    )
  }

  return (
    <tr className="border-t border-slate-100 bg-[rgba(1,35,88,0.02)]">
      <td className={`${TD} font-semibold whitespace-nowrap`}>{entry.projectName}</td>
      <td className={`${TD} whitespace-nowrap`}>{monthLabel(entry.month)}</td>
      <td className={`${TD} text-right`}>
        <input
          value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal"
          aria-label="Amount" className={`${FIELD} w-[110px] text-right tabular-nums font-semibold`}
        />
      </td>
      <td className={TD} colSpan={2}>
        <input
          value={note} onChange={e => setNote(e.target.value)}
          placeholder="What this was, where it came from" aria-label="Note"
          className={`${FIELD} w-full`}
        />
        {error && <p className="text-[12px] text-[#c2410c] mt-1.5 mb-0">{error}</p>}
      </td>
      <td className={`${TD} text-right whitespace-nowrap`}>
        <div className="flex items-center justify-end gap-2">
          {/* Removing is saving an empty amount, which is the rule saveDonation
              already had: a blank month and a zero month are different things. */}
          <button
            type="button" disabled={pending} onClick={() => submit('')}
            className="text-[12.5px] font-semibold text-[#c2410c] hover:underline disabled:opacity-50"
          >
            Delete
          </button>
          <button
            type="button" disabled={pending} onClick={onClose}
            className="text-[12.5px] font-semibold text-muted hover:underline disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button" disabled={pending} onClick={() => submit(amount)}
            className="rounded-[10px] bg-tn-primary px-3 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-50"
          >
            {pending ? 'Saving' : 'Save'}
          </button>
        </div>
      </td>
    </tr>
  )
}
