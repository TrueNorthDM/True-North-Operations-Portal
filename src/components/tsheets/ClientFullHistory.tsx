// Client "Full history": a month-by-month view of the year (from January), with
// real data, budget, used, carry-in, and hours used per month, plus year-to-date
// totals. This is the report-page home of what used to be the Settings "Full
// history" schedule; the audit-style Change history stays in Settings.
//
// Data comes from the report's `trend` series (Σ budget − Σ cost running
// balance), so the carry-in for a month is simply the previous month's balance.

import { money, moneySigned, fmtHours } from '@/lib/tsheets/format'
import type { I7TrendPoint } from '@/lib/tsheets/types'
import { HistoryExport } from '@/components/tsheets/HistoryExport'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}

export function ClientFullHistory(
  { trend, currentMonth, canExport = false }: {
    trend: I7TrendPoint[]; currentMonth?: string; canExport?: boolean
  },
) {
  const year = trend[0]?.month.slice(0, 4) ?? new Date().getUTCFullYear().toString()

  // Year-to-date totals.
  const ytdBudget = trend.reduce((s, t) => s + t.budget, 0)
  const ytdUsed = trend.reduce((s, t) => s + t.cost, 0)
  const ytdHours = trend.reduce((s, t) => s + t.hours, 0)
  const ytdPct = ytdBudget > 0 ? Math.round((ytdUsed / ytdBudget) * 100) : 0

  return (
    <section className="space-y-4 pt-10">
      {/* A divider, not a full rule. The table above ends in its own borders,
          and a line spanning the whole width would read as one more of them.
          Seventy per cent, centred, leaves air on both sides so it reads as a
          break between two blocks rather than the bottom of the first. Same
          two pixels as the underline on the In Numbers / In Graphics tabs. */}
      <div className="flex justify-center pb-6" aria-hidden="true">
        <span className="block w-[70%] h-0.5 rounded-full bg-tn-primary/85" />
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-baseline gap-3">
          <h3 className="font-(family-name:--font-display) font-extrabold text-[19px] text-tn-ink m-0">Full history</h3>
          <span className="text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-tn-teal bg-tn-teal-soft border border-tn-teal/25 rounded-full px-2.5 py-0.5">{year}</span>
        </div>
        {/* The table is one calendar year, because that is how a budget is
            planned. The export is not tied to that: the questions people bring
            here cross year ends. */}
        {canExport && currentMonth ? <HistoryExport currentMonth={currentMonth} /> : null}
      </div>

      {trend.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-muted">
          No months recorded yet this year.
        </div>
      ) : (
        <>
          {/* Year-to-date summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
              <div className="text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted">Budget YTD</div>
              <div className="text-[28px] font-extrabold text-tn-ink tabular-nums mt-1.5">{money(ytdBudget)}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
              <div className="text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted">Used YTD</div>
              <div className="text-[28px] font-extrabold text-tn-ink tabular-nums mt-1.5">{money(ytdUsed)}</div>
              <div className="text-[12.5px] text-muted mt-1">{ytdPct}% of budget</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
              <div className="text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted">Hours used YTD</div>
              <div className="text-[28px] font-extrabold text-tn-ink tabular-nums mt-1.5">{fmtHours(Math.round(ytdHours * 100) / 100)}</div>
            </div>
          </div>

          {/* Month by month */}
          <div className="rounded-2xl border border-slate-200 overflow-hidden">
            <div className="bg-tn-primary text-white px-5 py-3.5 flex items-center justify-between">
              <span className="font-(family-name:--font-display) font-extrabold text-[15px]">Month by month</span>
              <span className="text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-[#9fb3d4]">{year}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-subtle border-b border-slate-200">
                    <th className="text-left text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted px-5 py-3">Month</th>
                    <th className="text-right text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted px-5 py-3">Budget</th>
                    <th className="text-right text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted px-5 py-3">Carry-in</th>
                    <th className="text-right text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted px-5 py-3">Used</th>
                    <th className="text-right text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted px-5 py-3">Hours used</th>
                  </tr>
                </thead>
                <tbody>
                  {trend.map((t, i) => {
                    // The first month's carry-in is the balance it opened with,
                    // as the History CSV says it: before it, nothing was on
                    // screen to take it from (audit, 9 October 2026).
                    const carryIn = i === 0 ? (Math.round((t.balance - t.budget + t.cost) * 100) / 100 || 0) : trend[i - 1].balance
                    const isCurrent = t.month === currentMonth
                    return (
                      <tr key={t.month} className={`border-b border-slate-100 last:border-0 ${isCurrent ? 'bg-[#f2c40a12]' : ''}`}>
                        <td className="px-5 py-3 text-left font-(family-name:--font-display) font-bold text-tn-ink whitespace-nowrap">
                          {monthLabel(t.month)}
                          {isCurrent && <span className="ml-2 text-[10px] font-extrabold uppercase tracking-wide text-[#a8790a] bg-[#f2c40a2e] rounded-[6px] px-1.5 py-0.5 align-middle">In progress</span>}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums font-semibold text-tn-ink">{money(t.budget)}</td>
                        <td className={`px-5 py-3 text-right tabular-nums ${carryIn != null && carryIn < 0 ? 'text-[#c2410c]' : 'text-muted'}`}>{carryIn == null ? <span className="text-slate-300">-</span> : moneySigned(carryIn)}</td>
                        <td className="px-5 py-3 text-right tabular-nums font-semibold text-tn-ink">{money(t.cost)}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-tn-ink">{fmtHours(t.hours)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-[#fbfcfe]">
                    <td className="px-5 py-3.5 text-left font-(family-name:--font-display) font-extrabold text-tn-ink">Total {year}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums font-extrabold text-tn-ink">{money(ytdBudget)}</td>
                    <td className="px-5 py-3.5"></td>
                    <td className="px-5 py-3.5 text-right tabular-nums font-extrabold text-tn-teal">{money(ytdUsed)}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums font-extrabold text-tn-ink">{fmtHours(Math.round(ytdHours * 100) / 100)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
