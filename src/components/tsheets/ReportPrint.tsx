'use client'

// Print/PDF layout for the i7 Budget Usage Report. Two flavours:
//   client   — project → activity, no per-person detail (goes to i7 each month)
//   internal — the above plus an hours-by-person table
// Reuses I7Charts for the graphics. On screen it looks like a document; the
// browser's "Save as PDF" produces the file (print CSS hides the app chrome).

import Link from 'next/link'
import { useEffect, Fragment } from 'react'
import { I7Charts } from './I7Charts'
import type { I7Report, I7Carryover, I7TrendPoint } from '@/lib/tsheets/types'

const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US')
const moneySigned = (n: number) => (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US')
const fmtHours = (n: number) => (n === 0 ? '—' : n % 1 === 0 ? String(n) : n.toFixed(2).replace(/\.?0+$/, ''))
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const monShort = (ym: string) => `${MON[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`

interface Props {
  report: I7Report
  projectHours: Record<string, number>
  carryover: I7Carryover | null
  stdRate: number
  trend: I7TrendPoint[]
  type: 'client' | 'internal'
  monthLabel: string
  generatedOn: string
  note: string
}

function Star() {
  return <svg className="w-4 h-4 text-amber-500" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 1l2.4 8.6L23 12l-8.6 2.4L12 23l-2.4-8.6L1 12l8.6-2.4z" /></svg>
}

export function ReportPrint({ report, projectHours, carryover, stdRate, trend, type, monthLabel, generatedOn, note }: Props) {
  useEffect(() => {
    // Force light: a client PDF must never render in the portal's dark theme
    // (dark bg + light text prints blank once the browser drops backgrounds).
    // theme-init.js already skips dark here; this covers cached scripts / SPA nav.
    document.documentElement.classList.remove('dark')
    document.documentElement.style.colorScheme = 'light'
    const t = setTimeout(() => window.print(), 700) // let the SVG charts paint first
    return () => clearTimeout(t)
  }, [])

  const showCost = report.hasRates
  const showBudgetAvail = showCost && stdRate > 0

  // Per-project rows broken down by job code (project code) — no activity level.
  const rows = report.projects.map(p => {
    const budgeted = projectHours[p.project] ?? 0
    return {
      name: p.project, hours: p.hours, cost: p.cost, budgeted, avail: budgeted - p.hours,
      codes: p.jobcodes.filter(jc => jc.hours > 0).map(jc => ({ code: jc.code, hours: jc.hours, cost: jc.cost })).sort((a, b) => b.hours - a.hours),
    }
  })
  const totBudget = rows.reduce((s, r) => s + r.budgeted, 0)
  const totAvail = totBudget - report.totalHours

  const byPerson: Record<string, number> = {}
  for (const p of report.projects) for (const [name, h] of Object.entries(p.byPerson)) byPerson[name] = (byPerson[name] ?? 0) + h
  const persons = Object.entries(byPerson).map(([name, hours]) => ({ name, hours: Math.round(hours * 100) / 100 })).sort((a, b) => b.hours - a.hours)

  // The three months *before* the selected one (the selected month is the last
  // point in the trend, so exclude it) — the actual "last 3 months".
  const last3 = trend.slice(-4, -1)

  const th = 'text-right text-[8px] font-semibold uppercase tracking-wide text-slate-500 px-3 py-2'

  return (
    <div className="min-h-dvh bg-slate-100 py-8 print:bg-white print:py-0">
      {/* Screen-only toolbar */}
      <div className="no-print mx-auto max-w-[820px] mb-4 flex items-center justify-between px-2">
        <Link href={`/tools/time-report?month=${report.startDate.slice(0, 7)}`} className="text-sm text-slate-600 hover:text-slate-900">&larr; Back to report</Link>
        <button onClick={() => window.print()} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">Save as PDF</button>
      </div>

      <div className="print-doc mx-auto max-w-[820px] bg-white rounded-xl shadow-sm print:shadow-none print:rounded-none p-10 print:p-0 space-y-7 text-slate-800">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <Star />
              <span className="text-[15px] font-bold text-slate-900">True North</span>
              <span className="text-slate-300">/</span>
              <span className="text-[11px] text-slate-500">Operations</span>
            </div>
            <h1 className="mt-3 text-[19px] font-bold text-slate-900">i7 Budget Usage Report</h1>
            <p className="text-[13px] text-slate-500">{monthLabel}{type === 'client' ? ' · Prepared for i7 Marketing' : ' · Internal'}</p>
          </div>
          <div className="text-right text-[10px] text-slate-400 shrink-0">
            <div className="uppercase tracking-wide font-semibold">{type === 'client' ? 'Client report' : 'Internal report'}</div>
            <div className="mt-1">Generated {generatedOn}</div>
          </div>
        </div>

        {/* Month narrative */}
        {note && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 print:break-inside-avoid">
            <div className="text-[8px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Summary</div>
            <p className="text-[11px] text-slate-700 whitespace-pre-line leading-relaxed">{note}</p>
          </div>
        )}

        {/* Budget balance */}
        {carryover && (
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="text-[8px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Budget balance · {monthLabel}</div>
            <div className="flex items-start justify-between gap-4">
              {[
                { l: 'Carried in', v: moneySigned(carryover.opening), c: carryover.opening < 0 ? 'text-red-600' : 'text-slate-900' },
                { l: 'Budget this month', v: moneySigned(carryover.totalAvailable), c: 'text-slate-900' },
                { l: 'Used', v: money(carryover.monthUsed), c: 'text-slate-900' },
                { l: 'Balance left', v: moneySigned(carryover.totalLeft), c: carryover.totalLeft < 0 ? 'text-red-600' : 'text-emerald-600' },
              ].map(x => (
                <div key={x.l}>
                  <div className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">{x.l}</div>
                  <div className={`text-[16px] font-bold tabular-nums ${x.c}`}>{x.v}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Project → job code table */}
        <div>
          <div className="text-[8px] font-semibold uppercase tracking-wider text-slate-400 mb-2">By project &amp; job code</div>
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left text-[8px] font-semibold uppercase tracking-wide text-slate-500 px-3 py-2">Project · Job code</th>
                  <th className={th}>Budget hrs</th>
                  <th className={th}>Hrs avail.</th>
                  {showBudgetAvail && <th className={th}>Budget avail.</th>}
                  {showCost && <th className={th}>Budget used</th>}
                  <th className={th}>Hours used</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <Fragment key={r.name}>
                    <tr className="border-b border-slate-100 bg-slate-50/40">
                      <td className="px-3 py-2 font-semibold text-slate-900">{r.name}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">{r.budgeted ? r.budgeted.toLocaleString() : '—'}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${r.avail < 0 ? 'text-red-600' : 'text-slate-700'}`}>{r.budgeted ? r.avail.toFixed(2) : '—'}</td>
                      {showBudgetAvail && <td className={`px-3 py-2 text-right tabular-nums ${r.avail < 0 ? 'text-red-600' : 'text-slate-700'}`}>{r.budgeted ? moneySigned(r.avail * stdRate) : '—'}</td>}
                      {showCost && <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">{r.cost > 0 ? money(r.cost) : '—'}</td>}
                      <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">{fmtHours(r.hours)}</td>
                    </tr>
                    {r.codes.map((c, i) => (
                      <tr key={`${r.name}-${i}`} className="border-b border-slate-50">
                        <td className="px-3 py-1.5 pl-8 text-slate-600">{c.code}</td>
                        <td /><td />{showBudgetAvail && <td />}
                        {showCost && <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">{c.cost > 0 ? money(c.cost) : '—'}</td>}
                        <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">{fmtHours(c.hours)}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
                <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold text-slate-900">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right tabular-nums">{totBudget ? totBudget.toLocaleString() : '—'}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${totAvail < 0 ? 'text-red-600' : ''}`}>{totBudget ? totAvail.toFixed(2) : '—'}</td>
                  {showBudgetAvail && <td className={`px-3 py-2 text-right tabular-nums ${totAvail < 0 ? 'text-red-600' : ''}`}>{totBudget ? moneySigned(totAvail * stdRate) : '—'}</td>}
                  {showCost && <td className="px-3 py-2 text-right tabular-nums">{money(report.totalCost)}</td>}
                  <td className="px-3 py-2 text-right tabular-nums">{report.totalHours.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 3-month summary */}
        {last3.length > 0 && (
          <div>
            <div className="text-[8px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Last {last3.length} month{last3.length !== 1 ? 's' : ''}</div>
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left text-[8px] font-semibold uppercase tracking-wide text-slate-500 px-3 py-2">Month</th>
                    <th className={th}>Hours</th>
                    <th className={th}>Cost</th>
                    <th className={th}>Budget</th>
                    <th className={th}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {last3.map(t => (
                    <tr key={t.month} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2 text-slate-700">{monShort(t.month)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">{t.hours.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">{money(t.cost)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-500">{money(t.budget)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums font-medium ${t.balance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{moneySigned(t.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Graphics */}
        <div className="print:break-inside-avoid">
          <div className="text-[8px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Graphics</div>
          <I7Charts data={report} projectHours={projectHours} totalByPerson={byPerson} showCost={showCost} trend={trend} variant={type === 'client' ? 'client' : 'full'} />
        </div>

        {/* Internal-only: hours by person */}
        {type === 'internal' && persons.length > 0 && (
          <div className="print:break-inside-avoid">
            <div className="text-[8px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Hours by person</div>
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-[11px]">
                <tbody>
                  {persons.map(p => (
                    <tr key={p.name} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-1.5 text-slate-700">{p.name}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">{fmtHours(p.hours)} h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-slate-200 text-[10px] text-slate-400">
          Hours pulled from QuickBooks Time · budget &amp; rates managed in the True North Operations Portal · generated {generatedOn}
        </div>
      </div>
    </div>
  )
}
