// Project Hours, the report that replaces a monthly spreadsheet.
//
// Laid out as accounting's own sheet is, on purpose: project down the side,
// people across, balance on the left, totals on the right. Somebody who has
// filled that sheet in every month for years should not have to learn a new
// shape to check the same numbers.
//
// The balance columns are empty for AAAF and Hope for Africa, and that is
// correct rather than missing. Those are donation funded with no hour
// allowance; only Grants Pass Church and School buy hours in advance.

import type { ProjectTracking } from '@/lib/timeclock/projects'

const thNum = 'text-right text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted px-3 py-3 whitespace-nowrap'
const card = 'rounded-[14px] border border-slate-200 bg-white p-5'
const label = 'text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted'

/** Hours as the sheet writes them: 854.25, not 854:15. */
const h2 = (n: number) => n === 0 ? '-' : n.toFixed(2)

function monthName(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export function ProjectHoursReport({ data }: { data: ProjectTracking }) {
  const { rows, people, totals } = data
  const lastYear = `${Number(data.month.slice(0, 4)) - 1}`
  const thisYear = data.month.slice(0, 4)
  const prepaid = rows.filter(r => r.prepaid)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className={card}>
          <div className={label}>Worked this month</div>
          <div className="mt-1 font-(family-name:--font-display) font-extrabold text-[26px] text-tn-ink tabular-nums leading-tight">
            {totals.workedThisMonth.toFixed(2)}
          </div>
          <div className="text-xs text-muted mt-0.5">across {rows.filter(r => r.workedThisMonth > 0).length} projects</div>
        </div>
        <div className={card}>
          <div className={label}>{thisYear} to date</div>
          <div className="mt-1 font-(family-name:--font-display) font-extrabold text-[26px] text-tn-ink tabular-nums leading-tight">
            {totals.yearToDate.toFixed(2)}
          </div>
          <div className="text-xs text-muted mt-0.5">January to {monthName(data.month).split(' ')[0]}</div>
        </div>
        <div className={card}>
          <div className={label}>Same month, {lastYear}</div>
          <div className="mt-1 font-(family-name:--font-display) font-extrabold text-[26px] text-tn-ink tabular-nums leading-tight">
            {totals.sameMonthLastYear.toFixed(2)}
          </div>
          <div className="text-xs text-muted mt-0.5">
            {totals.sameMonthLastYear > 0
              ? `${totals.workedThisMonth >= totals.sameMonthLastYear ? '+' : ''}${(totals.workedThisMonth - totals.sameMonthLastYear).toFixed(2)} against it`
              : 'nothing logged that month'}
          </div>
        </div>
        <div className={card}>
          <div className={label}>Prepaid hours left</div>
          <div className="mt-1 font-(family-name:--font-display) font-extrabold text-[26px] text-tn-ink tabular-nums leading-tight">
            {prepaid.reduce((s, r) => s + (r.remaining ?? 0), 0).toFixed(2)}
          </div>
          <div className="text-xs text-muted mt-0.5">Grants Pass, Church and School</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-[14px] border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-subtle border-b border-slate-200">
              <th className="text-left text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted px-4 py-3 sticky left-0 bg-subtle z-10">Project</th>
              <th className={`${thNum} bg-[rgba(30,125,127,0.06)]`}>Carried in</th>
              <th className={`${thNum} bg-[rgba(30,125,127,0.06)]`}>Bought</th>
              <th className={`${thNum} bg-[rgba(30,125,127,0.06)] border-r border-[rgba(1,35,88,0.1)]`}>Remaining</th>
              {people.map(p => <th key={p} className={thNum}>{p}</th>)}
              <th className={`${thNum} bg-[rgba(224,138,30,0.07)] border-l border-[rgba(224,138,30,0.18)]`}>This month</th>
              <th className={thNum}>{thisYear} total</th>
              <th className={thNum}>{lastYear} same month</th>
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
                <td className="px-3 py-3 text-right tabular-nums bg-[rgba(30,125,127,0.06)]">{r.carriedIn == null ? '' : h2(r.carriedIn)}</td>
                <td className="px-3 py-3 text-right tabular-nums bg-[rgba(30,125,127,0.06)]">{r.boughtThisMonth == null ? '' : h2(r.boughtThisMonth)}</td>
                <td className={`px-3 py-3 text-right tabular-nums font-semibold bg-[rgba(30,125,127,0.06)] border-r border-[rgba(1,35,88,0.1)] ${r.remaining != null && r.remaining < 0 ? 'text-[#c2410c]' : 'text-tn-ink'}`}>
                  {r.remaining == null ? '' : h2(r.remaining)}
                </td>
                {people.map(p => (
                  <td key={p} className="px-3 py-3 text-right tabular-nums">
                    {r.byPerson[p] ? h2(r.byPerson[p]) : <span className="text-slate-300">-</span>}
                  </td>
                ))}
                <td className="px-3 py-3 text-right tabular-nums font-bold text-tn-ink bg-[rgba(224,138,30,0.07)] border-l border-[rgba(224,138,30,0.18)]">{h2(r.workedThisMonth)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{h2(r.yearToDate)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-muted">{h2(r.sameMonthLastYear)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 bg-subtle">
              <td className="px-4 py-3 font-(family-name:--font-display) font-extrabold text-tn-ink sticky left-0 bg-subtle z-10">Totals</td>
              <td className="bg-[rgba(30,125,127,0.06)]" />
              <td className="bg-[rgba(30,125,127,0.06)]" />
              <td className="px-3 py-3 text-right tabular-nums font-extrabold bg-[rgba(30,125,127,0.06)] border-r border-[rgba(1,35,88,0.1)]">
                {prepaid.reduce((s, r) => s + (r.remaining ?? 0), 0).toFixed(2)}
              </td>
              {people.map(p => (
                <td key={p} className="px-3 py-3 text-right tabular-nums font-extrabold text-tn-ink">
                  {totals.byPerson[p] ? h2(totals.byPerson[p]) : <span className="text-slate-300">-</span>}
                </td>
              ))}
              <td className="px-3 py-3 text-right tabular-nums font-extrabold text-tn-ink bg-[rgba(224,138,30,0.07)] border-l border-[rgba(224,138,30,0.18)]">{totals.workedThisMonth.toFixed(2)}</td>
              <td className="px-3 py-3 text-right tabular-nums font-extrabold">{totals.yearToDate.toFixed(2)}</td>
              <td className="px-3 py-3 text-right tabular-nums font-extrabold text-muted">{totals.sameMonthLastYear.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="rounded-[12px] border border-slate-200 bg-subtle p-4 text-sm leading-relaxed space-y-2">
        <p className="m-0">
          <strong className="font-(family-name:--font-display) font-extrabold text-tn-ink">No money here, and that is deliberate.</strong>{' '}
          These projects are funded by donation and not billed. Grants Pass Church and School are the
          exception: they buy hours in advance at $90, which is what the three balance columns track.
          The other two have no allowance, so those cells are blank rather than zero.
        </p>
        <p className="m-0 text-muted">
          All four are recognised by the <span className="font-semibold">“2 Project”</span> field on
          each entry. Hope for Africa in particular is not a job code: its work sits under two
          different ones and only the project value joins them, which is why counting by job code came
          out 120 to 190 hours short every month.
        </p>
      </div>
    </div>
  )
}
