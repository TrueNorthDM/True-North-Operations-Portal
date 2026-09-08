'use client'

// Project Hours & Others: the report that replaces a monthly spreadsheet.
//
// Two views, because the sheet it replaces is two questions. Costs asks what
// each project consumed and what came in for it; People asks who did the hours.
// They were one table until money arrived, and eight money columns beside
// fifteen person columns is a table nobody reads across.
//
// Laid out as accounting's own sheet is, on purpose: project down the side,
// balance on the left, totals on the right. Somebody who has filled that sheet
// in every month for years should not have to learn a new shape.
//
// The balance columns are empty for AAAF and Hope for Africa, and that is
// correct rather than missing. Those are donation funded with no hour
// allowance; only Grants Pass Church and School buy hours in advance, at $90.

import { useState } from 'react'
import { money } from '@/lib/tsheets/format'
import { InfoDialog } from '@/components/ui/InfoDialog'
import type { ProjectTracking } from '@/lib/timeclock/projects'

const thNum = 'text-right text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted px-3 py-3 whitespace-nowrap'
const card = 'rounded-[14px] border border-slate-200 bg-white p-5'
const label = 'text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted'
const big = 'mt-1 font-(family-name:--font-display) font-extrabold text-[26px] text-tn-ink tabular-nums leading-tight'
const num = 'px-3 py-3 text-right tabular-nums'
const bal = 'bg-[rgba(30,125,127,0.06)]'
const hi = 'bg-[rgba(224,138,30,0.07)]'

/** Hours as the sheet writes them: 854.25, not 854:15. */
const h2 = (n: number) => n === 0 ? '-' : n.toFixed(2)
const m0 = (n: number) => n === 0 ? '-' : money(n)

function monthName(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export function ProjectHoursReport({ data }: { data: ProjectTracking }) {
  const [view, setView] = useState<'costs' | 'people'>('costs')
  const { rows, people, totals, unratedPeople } = data
  const lastYear = `${Number(data.month.slice(0, 4)) - 1}`
  const thisYear = data.month.slice(0, 4)
  const prepaid = rows.filter(r => r.prepaid)
  const prepaidLeft = prepaid.reduce((s, r) => s + (r.remaining ?? 0), 0)
  const costThisMonth = totals.employeeCostThisMonth + totals.contractorCostThisMonth

  return (
    <div className="space-y-6">
      {/* Cards follow the view: the same four slots, answering the question the
          table below is answering. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className={card}>
          <div className={label}>Worked this month</div>
          <div className={big}>{totals.workedThisMonth.toFixed(2)}</div>
          <div className="text-xs text-muted mt-0.5">across {rows.filter(r => r.workedThisMonth > 0).length} projects</div>
        </div>
        {view === 'costs' ? (
          <>
            <div className={card}>
              <div className={label}>Costs this month</div>
              <div className={big}>{money(costThisMonth)}</div>
              <div className="text-xs text-muted mt-0.5">
                {money(totals.employeeCostThisMonth)} employees · {money(totals.contractorCostThisMonth)} contractors
              </div>
            </div>
            <div className={card}>
              <div className={label}>Total costs {thisYear}</div>
              <div className={big}>{money(totals.totalCosts)}</div>
              <div className="text-xs text-muted mt-0.5">January to {monthName(data.month).split(' ')[0]}</div>
            </div>
          </>
        ) : (
          <>
            <div className={card}>
              <div className={label}>{thisYear} to date</div>
              <div className={big}>{totals.yearToDate.toFixed(2)}</div>
              <div className="text-xs text-muted mt-0.5">January to {monthName(data.month).split(' ')[0]}</div>
            </div>
            <div className={card}>
              <div className={label}>Same month, {lastYear}</div>
              <div className={big}>{totals.sameMonthLastYear.toFixed(2)}</div>
              <div className="text-xs text-muted mt-0.5">
                {totals.sameMonthLastYear > 0
                  ? `${totals.workedThisMonth >= totals.sameMonthLastYear ? '+' : ''}${(totals.workedThisMonth - totals.sameMonthLastYear).toFixed(2)} against it`
                  : 'nothing logged that month'}
              </div>
            </div>
          </>
        )}
        <div className={card}>
          <div className={label}>Prepaid hours left</div>
          <div className={big}>{prepaidLeft.toFixed(2)}</div>
          <div className="text-xs text-muted mt-0.5">Grants Pass, Church and School</div>
        </div>
      </div>

      <div className="border-b border-slate-200 flex items-center gap-1">
        {(['costs', 'people'] as const).map(v => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`px-4 py-2.5 text-[13.5px] font-(family-name:--font-display) font-bold border-b-2 -mb-px transition-colors ${
              view === v ? 'border-tn-teal text-tn-teal' : 'border-transparent text-muted hover:text-tn-ink'
            }`}
          >
            {v === 'costs' ? 'Costs' : 'People'}
          </button>
        ))}
        {/* Beside the tabs rather than under the table: the questions it
            answers are asked while looking at a cell, not after scrolling
            past everything. */}
        <span className="ml-auto pb-1.5">
          <InfoDialog title="How this report is built" label="How this report is built">
            <p className="m-0">
              <strong className="font-(family-name:--font-display) font-extrabold text-tn-ink">Costs here are what a project consumed, not what left the bank.</strong>{' '}
              They are hours × each person&rsquo;s break-even rate. For somebody on the payroll that is an
              attribution: they are paid the same whether they logged ten hours or a hundred.
            </p>
            <p className="m-0">
              <strong className="font-(family-name:--font-display) font-extrabold text-tn-ink">Nothing here is billed.</strong>{' '}
              These projects are donation funded. Grants Pass Church and School are the exception: they buy
              hours in advance at $90, which is what the three balance columns track. The other two have no
              allowance, so those cells are blank rather than zero.
            </p>
            <p className="m-0 text-muted">
              Donations are entered by hand and there is nowhere to enter them yet, so both donation
              columns are blank. Blank rather than zero: zero would say nothing came in.
            </p>
            <p className="m-0 text-muted">
              All four projects are recognised by the <span className="font-semibold">“2 Project”</span>{' '}
              field on each entry. Hope for Africa in particular is not a job code: its work sits under two
              different ones and only the project value joins them, which is why counting by job code came
              out 120 to 190 hours short every month.
            </p>
            {/* The one column that compares two different kinds of truth. Saying so
                is cheaper than being asked about it every month. */}
            <p className="m-0 text-muted">
              The <span className="font-semibold">{lastYear} same month</span> column is computed from the
              timesheets as they stand today, so it can differ from what the {`${lastYear} tracking sheet`}{' '}
              said at the time: a year of corrections and retroactive approvals sits between them. Across the
              months that were checked the gap ran from four hours over to eighty-seven under.
            </p>
          </InfoDialog>
        </span>
      </div>

      <div className="overflow-x-auto rounded-[14px] border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-subtle border-b border-slate-200">
              <th className="text-left text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted px-4 py-3 sticky left-0 bg-subtle z-10">Project</th>
              <th className={`${thNum} ${bal}`}>Carried in</th>
              <th className={`${thNum} ${bal}`}>Prepaid</th>
              <th className={`${thNum} ${bal} border-r border-[rgba(1,35,88,0.1)]`}>Remaining</th>
              {view === 'people' && people.map(p => <th key={p} className={thNum}>{p}</th>)}
              <th className={`${thNum} ${hi} border-l border-[rgba(224,138,30,0.18)]`}>Hours this month</th>
              {view === 'costs' && (
                <>
                  <th className={thNum}>Employee costs</th>
                  <th className={thNum}>Contractor costs</th>
                  <th className={thNum}>Donations this month</th>
                </>
              )}
              <th className={thNum}>Total hours {thisYear}</th>
              {view === 'costs' && (
                <>
                  <th className={thNum}>Total donations {thisYear}</th>
                  <th className={thNum}>Total costs {thisYear}</th>
                </>
              )}
              <th className={thNum}>{lastYear} hours same month</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.label} className="border-b border-slate-100">
                <td className="px-4 py-3 sticky left-0 bg-white z-10">
                  <span className="font-(family-name:--font-display) font-bold text-tn-ink whitespace-nowrap">{r.name}</span>
                  {r.prepaid && <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-tn-teal">prepaid</span>}
                </td>
                {/* Blank, not zero, when a project has no allowance: it does not
                    have a balance rather than having one of nothing. */}
                <td className={`${num} ${bal}`}>{r.carriedIn == null ? '' : h2(r.carriedIn)}</td>
                <td className={`${num} ${bal}`}>{r.boughtThisMonth == null ? '' : h2(r.boughtThisMonth)}</td>
                <td className={`${num} font-semibold ${bal} border-r border-[rgba(1,35,88,0.1)] ${r.remaining != null && r.remaining < 0 ? 'text-[#c2410c]' : 'text-tn-ink'}`}>
                  {r.remaining == null ? '' : h2(r.remaining)}
                </td>
                {view === 'people' && people.map(p => (
                  <td key={p} className={num}>
                    {r.byPerson[p] ? h2(r.byPerson[p]) : <span className="text-slate-300">-</span>}
                  </td>
                ))}
                <td className={`${num} font-bold text-tn-ink ${hi} border-l border-[rgba(224,138,30,0.18)]`}>{h2(r.workedThisMonth)}</td>
                {view === 'costs' && (
                  <>
                    <td className={num}>{m0(r.employeeCostThisMonth)}</td>
                    <td className={num}>{m0(r.contractorCostThisMonth)}</td>
                    {/* Blank while there is nowhere to enter one. Zero would say
                        nothing was donated; blank says nobody has told us. */}
                    <td className={`${num} text-slate-300`}>{r.donationsThisMonth == null ? '' : money(r.donationsThisMonth)}</td>
                  </>
                )}
                <td className={num}>{h2(r.yearToDate)}</td>
                {view === 'costs' && (
                  <>
                    <td className={`${num} text-slate-300`}>{r.donationsYtd == null ? '' : money(r.donationsYtd)}</td>
                    <td className={`${num} font-semibold text-tn-ink`}>{m0(r.totalCosts)}</td>
                  </>
                )}
                <td className={`${num} text-muted`}>{h2(r.sameMonthLastYear)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 bg-subtle">
              <td className="px-4 py-3 font-(family-name:--font-display) font-extrabold text-tn-ink sticky left-0 bg-subtle z-10">Totals</td>
              <td className={bal} />
              <td className={bal} />
              <td className={`${num} font-extrabold ${bal} border-r border-[rgba(1,35,88,0.1)]`}>{prepaidLeft.toFixed(2)}</td>
              {view === 'people' && people.map(p => (
                <td key={p} className={`${num} font-extrabold text-tn-ink`}>
                  {totals.byPerson[p] ? h2(totals.byPerson[p]) : <span className="text-slate-300">-</span>}
                </td>
              ))}
              <td className={`${num} font-extrabold text-tn-ink ${hi} border-l border-[rgba(224,138,30,0.18)]`}>{totals.workedThisMonth.toFixed(2)}</td>
              {view === 'costs' && (
                <>
                  <td className={`${num} font-extrabold`}>{money(totals.employeeCostThisMonth)}</td>
                  <td className={`${num} font-extrabold`}>{money(totals.contractorCostThisMonth)}</td>
                  <td className={num} />
                </>
              )}
              <td className={`${num} font-extrabold`}>{totals.yearToDate.toFixed(2)}</td>
              {view === 'costs' && (
                <>
                  <td className={num} />
                  <td className={`${num} font-extrabold`}>{money(totals.totalCosts)}</td>
                </>
              )}
              <td className={`${num} font-extrabold text-muted`}>{totals.sameMonthLastYear.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {unratedPeople.length > 0 && (
        <div className="rounded-[12px] border border-[#e2c68e] bg-[#f9f1e3] p-4 text-sm leading-relaxed">
          <p className="m-0 text-[#8a5408]">
            <strong className="font-(family-name:--font-display) font-extrabold">
              {unratedPeople.length === 1 ? '1 person has hours but no break-even rate' : `${unratedPeople.length} people have hours but no break-even rate`}
            </strong>{': '}
            {unratedPeople.join(', ')}. Their hours are in the totals and their cost counts as nothing,
            so these projects read cheaper than they were. Set a rate in Rates &amp; Costs.
          </p>
        </div>
      )}
    </div>
  )
}
