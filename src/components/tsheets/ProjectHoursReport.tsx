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
import { spanWording } from '@/lib/tsheets/range'
import type { ProjectTracking } from '@/lib/timeclock/projects'

// Two header rows: what a block of columns is about, then what each one holds.
//
// One row could not do it. "Donations this month" and "2025 hours same month"
// are wider than any figure under them, so twelve headers were setting the
// width of a table whose cells are six characters wide, and the last two
// columns fell off the right edge. Saying "this month" once over four columns
// instead of in four of them is what brings it back inside the page.
const thGroup = 'text-center text-[9.5px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.1em] text-muted px-2.5 pt-3 pb-1.5 whitespace-nowrap'
// px-2.5, not px-3, on the eleven number columns. The sidebar and the page
// padding take 112px, so a 1280-wide laptop has 1168 to give a table that wants
// 1153: fifteen pixels, which a scrollbar or a notch of browser zoom eats.
const thNum = 'text-right text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted px-2.5 pb-3 pt-1 whitespace-nowrap'
/** The line that starts a block of columns, drawn in the head, body and foot alike. */
const edge = 'border-l border-[rgba(1,35,88,0.1)]'
const card = 'rounded-[14px] border border-slate-200 bg-white p-5'
const label = 'text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted'
const big = 'mt-1 font-(family-name:--font-display) font-extrabold text-[26px] text-tn-ink tabular-nums leading-tight'
const num = 'px-2.5 py-3 text-right tabular-nums'
const bal = 'bg-[rgba(30,125,127,0.06)]'
const hi = 'bg-[rgba(224,138,30,0.07)]'

/** Hours as the sheet writes them: 854.25, not 854:15. */
const h2 = (n: number) => n === 0 ? '-' : n.toFixed(2)
const m0 = (n: number) => n === 0 ? '-' : money(n)

function monthName(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export function ProjectHoursReport(
  { data, teams = [], selectedTeam = '' }: {
    data: ProjectTracking
    /** Teams the filter offers, with the first names of their members. */
    teams?: readonly { id: string; name: string; members: readonly string[] }[]
    selectedTeam?: string
  },
) {
  const [view, setView] = useState<'costs' | 'people'>('costs')
  const { rows, totals, unratedPeople, unrestricted } = data
  // Only ever takes names away, and only from the People columns. The totals
  // stay everyone's: a partial view should not read as a whole one.
  const teamPeople = teams.find(t => t.id === selectedTeam)?.members ?? null
  const people = data.people.filter(n => !teamPeople || teamPeople.includes(n))
  const oneMonth = data.from === data.month
  // What the middle block of columns covers. "This month" is a lie over a range,
  // and the range is the only thing on screen that says which months these are.
  const period = oneMonth ? 'This month' : spanWording(data.from, data.month)
  // Everything given, projects and the fund together. Null while nobody has
  // entered anything, so the totals line stays as blank as the rows above it.
  const sumGiven = (pick: (r: typeof rows[number]) => number | null, fund: number | null) => {
    const parts = [...rows.map(pick), fund].filter((n): n is number => n != null)
    return parts.length === 0 ? null : Math.round(parts.reduce((s, n) => s + n, 0) * 100) / 100
  }
  const givenMonth = sumGiven(r => r.donationsThisMonth, unrestricted.thisMonth)
  const givenYtd = sumGiven(r => r.donationsYtd, unrestricted.ytd)
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
          <div className={label}>Worked {oneMonth ? "this month" : "in this period"}</div>
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

      <div className="border-b border-slate-200 flex gap-1">
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
      </div>

      <div className="overflow-x-auto rounded-[14px] border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-subtle">
              <th rowSpan={2} className="text-left text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted px-4 py-3 sticky left-0 bg-subtle z-10 align-bottom">Project</th>
              <th colSpan={3} className={`${thGroup} ${bal} border-r border-[rgba(1,35,88,0.1)]`}>Prepaid hours</th>
              {/* In the People view the person columns and their total are all
                  this month's hours, so they sit under the one heading. */}
              <th colSpan={view === 'costs' ? 4 : people.length + 1} className={thGroup}>{period}</th>
              <th colSpan={view === 'costs' ? 3 : 1} className={`${thGroup} ${edge}`}>{thisYear} to date</th>
              <th className={`${thGroup} ${edge}`}>{lastYear}</th>
            </tr>
            <tr className="bg-subtle border-b border-slate-200">
              <th className={`${thNum} ${bal}`}>Carried in</th>
              <th className={`${thNum} ${bal}`}>Prepaid</th>
              <th className={`${thNum} ${bal} border-r border-[rgba(1,35,88,0.1)]`}>Remaining</th>
              {view === 'people' && people.map(p => <th key={p} className={thNum}>{p}</th>)}
              <th className={`${thNum} ${hi} border-l border-[rgba(224,138,30,0.18)]`}>{view === 'costs' ? 'Hours' : 'Total'}</th>
              {view === 'costs' && (
                <>
                  <th className={thNum}>Employee</th>
                  <th className={thNum}>Contractor</th>
                  <th className={thNum}>Donations</th>
                </>
              )}
              <th className={`${thNum} ${edge}`}>Hours</th>
              {view === 'costs' && (
                <>
                  <th className={thNum}>Donations</th>
                  <th className={thNum}>Costs</th>
                </>
              )}
              <th className={`${thNum} ${edge}`}>Same month</th>
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
                    <td className={num}>{r.donationsThisMonth == null ? '' : money(r.donationsThisMonth)}</td>
                  </>
                )}
                <td className={`${num} ${edge}`}>{h2(r.yearToDate)}</td>
                {view === 'costs' && (
                  <>
                    <td className={num}>{r.donationsYtd == null ? '' : money(r.donationsYtd)}</td>
                    <td className={`${num} font-semibold text-tn-ink`}>{m0(r.totalCosts)}</td>
                  </>
                )}
                <td className={`${num} ${edge} text-muted`}>{h2(r.sameMonthLastYear)}</td>
              </tr>
            ))}

            {/* Money given without a project attached. It gets a row rather
                than a share of the four, because dividing it would invent an
                allocation nobody asked for. Every cell that is about work is
                left empty on purpose: a fund has no hours and no rate. */}
            {view === 'costs' && (unrestricted.thisMonth != null || unrestricted.ytd != null) && (
              <tr className="border-b border-slate-100 bg-[rgba(1,35,88,0.02)]">
                <td className="px-4 py-3 sticky left-0 bg-white z-10">
                  <span className="font-(family-name:--font-display) font-bold text-tn-ink whitespace-nowrap">Unrestricted</span>
                  <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-muted">not a project</span>
                </td>
                <td className={bal} /><td className={bal} />
                <td className={`${bal} border-r border-[rgba(1,35,88,0.1)]`} />
                <td className={`${num} ${hi} border-l border-[rgba(224,138,30,0.18)]`} />
                <td className={num} /><td className={num} />
                <td className={`${num} font-semibold text-tn-ink`}>
                  {unrestricted.thisMonth == null ? '' : money(unrestricted.thisMonth)}
                </td>
                <td className={`${num} ${edge}`} />
                <td className={`${num} font-semibold text-tn-ink`}>
                  {unrestricted.ytd == null ? '' : money(unrestricted.ytd)}
                </td>
                <td className={num} />
                <td className={`${num} ${edge}`} />
              </tr>
            )}
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
                  {/* The four projects plus the fund. Said here because the
                      Unrestricted row sits directly above, so the arithmetic is
                      on screen rather than hidden in a footer. */}
                  <td className={`${num} font-extrabold`}>{givenMonth == null ? '' : money(givenMonth)}</td>
                </>
              )}
              <td className={`${num} ${edge} font-extrabold`}>{totals.yearToDate.toFixed(2)}</td>
              {view === 'costs' && (
                <>
                  <td className={`${num} font-extrabold`}>{givenYtd == null ? '' : money(givenYtd)}</td>
                  <td className={`${num} font-extrabold`}>{money(totals.totalCosts)}</td>
                </>
              )}
              <td className={`${num} ${edge} font-extrabold text-muted`}>{totals.sameMonthLastYear.toFixed(2)}</td>
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
