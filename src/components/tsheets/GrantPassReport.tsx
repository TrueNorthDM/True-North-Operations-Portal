// Grant Pass client report.
//
// FRAMEWORK / PLACEHOLDER. Grant Pass is not tracked in QuickBooks Time the way
// i7 is: its job codes ("GP Church" #1606222 and "GP School" #1606224, under the
// archived "Client" parent #5225333) are inactive, and no time is logged against
// them. The only figures we have live in the "2026 Project Hours Detail"
// spreadsheet, hours-only with a monthly carryover, no dollar budget.
//
// This component reserves the tab and lays out the intended shape (two
// sub-clients, carryover → worked → remaining) so that once the data source is
// confirmed, we swap this empty state for the wired-up table without touching
// the page or the tab bar.

const SUBCLIENTS = ['Grants Pass Church', 'Grants Pass School'] as const

export function GrantPassReport() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
        <p className="font-semibold text-amber-900 m-0">Setup in progress</p>
        <p className="mt-1 text-sm text-amber-800 leading-relaxed m-0">
          Grant Pass is an hours based retainer (Church and School), tracked with a monthly
          carryover rather than a dollar budget. Unlike i7, it is not logged in QuickBooks Time,
          so this tab will be filled once the data source is confirmed. The layout below is the
          shape it will take.
        </p>
      </div>

      {/* Skeleton of the intended hours table, shown disabled so the structure is visible. */}
      <div className="rounded-xl border border-slate-200 overflow-hidden opacity-60 select-none" aria-hidden="true">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-muted">
              <th className="px-4 py-3 font-semibold">Sub-client</th>
              <th className="px-4 py-3 font-semibold text-right">Carryover</th>
              <th className="px-4 py-3 font-semibold text-right">Hours this month</th>
              <th className="px-4 py-3 font-semibold text-right">Remaining</th>
            </tr>
          </thead>
          <tbody>
            {SUBCLIENTS.map((name) => (
              <tr key={name} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium text-tn-ink">{name}</td>
                {[0, 1, 2].map((i) => (
                  <td key={i} className="px-4 py-3 text-right">
                    <span className="inline-block h-3 w-12 rounded bg-slate-200 align-middle" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
