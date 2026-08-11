// Client Report, Grant Pass.
//
// Deliberately not the i7 report with different data in it. That one exists to
// manage a budget: it has hours available, money left, a carryover balance. This
// client has no budget in the portal and about 470 hours across nine years, so
// what it needs is a history somebody can read in one screen.
//
// School and Church are shown side by side rather than as two reports, because
// the question people actually ask is how the two compare.

import { formatHM, decimalHours } from '@/lib/timeclock/clock'
import type { GrantPassData, GrantPassSlice } from '@/lib/timeclock/grant-pass'

const card = 'rounded-[14px] border border-slate-200 bg-white p-5'
const label = 'text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted'
const thNum = 'text-right text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted px-3 py-3 whitespace-nowrap'

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1))
    .toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

function SliceTable({ title, rows, note }: { title: string; rows: GrantPassSlice[]; note: string }) {
  const total = rows.reduce((s, r) => s + r.schoolSeconds + r.churchSeconds, 0)
  return (
    <div className="space-y-2 min-w-0">
      <h3 className="font-(family-name:--font-display) font-extrabold text-tn-ink m-0">{title}</h3>
      <p className="text-sm text-muted m-0">{note}</p>
      <div className="overflow-x-auto rounded-[14px] border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-subtle border-b border-slate-200">
              <th className="text-left text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted px-4 py-3">{title}</th>
              <th className={thNum}>School</th>
              <th className={thNum}>Church</th>
              <th className={thNum}>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-400">Nothing logged.</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.label} className="border-b border-slate-100 last:border-b-0">
                <td className="px-4 py-2.5 text-tn-ink">{r.label}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{r.schoolSeconds ? formatHM(r.schoolSeconds) : <span className="text-slate-300">-</span>}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{r.churchSeconds ? formatHM(r.churchSeconds) : <span className="text-slate-300">-</span>}</td>
                <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-tn-ink">{formatHM(r.schoolSeconds + r.churchSeconds)}</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-subtle">
                <td className="px-4 py-2.5 font-(family-name:--font-display) font-extrabold text-tn-ink">Total</td>
                <td className="px-3 py-2.5 text-right tabular-nums font-extrabold">{formatHM(rows.reduce((s, r) => s + r.schoolSeconds, 0))}</td>
                <td className="px-3 py-2.5 text-right tabular-nums font-extrabold">{formatHM(rows.reduce((s, r) => s + r.churchSeconds, 0))}</td>
                <td className="px-3 py-2.5 text-right tabular-nums font-extrabold text-tn-ink">{formatHM(total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

export function GrantPassReport({ data }: { data: GrantPassData }) {
  const total = data.totalSchool + data.totalChurch

  if (!data.entries) {
    return (
      <div className="rounded-[12px] border border-amber-300/60 bg-amber-50 p-5 text-sm text-[#8a6d1a]">
        No Grant Pass hours found. They are recognised two ways, by the deactivated GP Church and
        GP School job codes and by the &ldquo;2 Project&rdquo; field, so an empty report here means
        neither is in use rather than that the report is broken.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className={card}>
          <div className={label}>Total</div>
          <div className="mt-1 font-(family-name:--font-display) font-extrabold text-[26px] text-tn-ink tabular-nums leading-tight">{formatHM(total)}</div>
          <div className="text-xs text-muted mt-0.5">{decimalHours(total)} h over {data.entries} entries</div>
        </div>
        <div className={card}>
          <div className={label}>School</div>
          <div className="mt-1 font-(family-name:--font-display) font-extrabold text-[26px] text-tn-ink tabular-nums leading-tight">{formatHM(data.totalSchool)}</div>
          <div className="text-xs text-muted mt-0.5">{total ? Math.round((data.totalSchool / total) * 100) : 0}% of the time</div>
        </div>
        <div className={card}>
          <div className={label}>Church</div>
          <div className="mt-1 font-(family-name:--font-display) font-extrabold text-[26px] text-tn-ink tabular-nums leading-tight">{formatHM(data.totalChurch)}</div>
          <div className="text-xs text-muted mt-0.5">{total ? Math.round((data.totalChurch / total) * 100) : 0}% of the time</div>
        </div>
        <div className={card}>
          <div className={label}>Covering</div>
          <div className="mt-1 font-(family-name:--font-display) font-extrabold text-[20px] text-tn-ink leading-tight">
            {data.firstMonth ? monthLabel(data.firstMonth) : '—'}
          </div>
          <div className="text-xs text-muted mt-0.5">to {data.lastMonth ? monthLabel(data.lastMonth) : '—'}</div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-(family-name:--font-display) font-extrabold text-tn-ink m-0">Month by month</h3>
        <p className="text-sm text-muted m-0">Only months with hours. The gaps are real gaps.</p>
        <div className="overflow-x-auto rounded-[14px] border border-slate-200 bg-white max-h-[420px] overflow-y-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0">
              <tr className="bg-subtle border-b border-slate-200">
                <th className="text-left text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted px-4 py-3 bg-subtle">Month</th>
                <th className={`${thNum} bg-subtle`}>School</th>
                <th className={`${thNum} bg-subtle`}>Church</th>
                <th className={`${thNum} bg-subtle`}>Total</th>
              </tr>
            </thead>
            <tbody>
              {data.months.map(m => (
                <tr key={m.month} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-4 py-2.5 font-semibold text-tn-ink tabular-nums">{monthLabel(m.month)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{m.schoolSeconds ? formatHM(m.schoolSeconds) : <span className="text-slate-300">-</span>}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{m.churchSeconds ? formatHM(m.churchSeconds) : <span className="text-slate-300">-</span>}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-tn-ink">{formatHM(m.schoolSeconds + m.churchSeconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <SliceTable title="Who" rows={data.byPerson} note="Everyone who has logged time on this client." />
        <SliceTable title="What" rows={data.byActivity} note="From the “3 Activity” field on each entry." />
      </div>

      <p className="text-xs text-muted leading-relaxed">
        Grant Pass hours are recognised two ways, and both are counted: the deactivated
        <span className="font-semibold"> GP Church</span> and <span className="font-semibold">GP School</span> job
        codes, used until 2022, and the <span className="font-semibold">“2 Project”</span> field, used since. No entry
        carries both, so nothing here is counted twice.
      </p>
    </div>
  )
}
