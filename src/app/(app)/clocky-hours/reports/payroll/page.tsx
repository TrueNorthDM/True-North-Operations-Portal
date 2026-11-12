// North Time > Reports > Payroll summary (owner and Tina, 12 November 2026):
// each US employee's REG and PTO hours for a pay period (or a month, quarter or any days), and the file Tina
// sends to Rippling. Super Admins and Finance only (payroll-summary-data.ts).

import { redirect } from 'next/navigation'
import { previewHref } from '@/lib/auth/view-as-server'
import { requireSurface } from '@/lib/access/resolve'
import { canSeePayroll, loadPayroll } from '@/lib/timeclock/payroll-summary-data'
import { gapText, parsePayrollQuery, payrollSearch } from '@/lib/timeclock/payroll-summary'
import { PayrollFilters } from '@/components/clocky/reports/PayrollFilters'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { BTN } from '@/lib/ui/buttons'
import { CARD, PAGE_TITLE } from '@/lib/ui/type'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Payroll summary' }

const TH = 'text-left font-semibold text-muted text-[12.5px] py-2 px-3'
const TD = 'py-2 px-3'

export default async function PayrollRoute({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const access = await requireSurface('clocky-reports')
  if (!(await canSeePayroll(access))) redirect(await previewHref('/clocky-hours/reports'))
  const page = await loadPayroll(parsePayrollQuery(await searchParams))
  if (!page) return <p role="alert" className="m-0 text-[13px] font-semibold text-[#c8323d]">The company pay period start is not set (North Time settings).</p>

  const flagged = page.lines.filter(l => l.gap !== 0).length
  const pending = Math.round(page.lines.reduce((n, l) => n + l.pending, 0) * 100) / 100

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex items-end justify-between gap-3.5 flex-wrap">
        <div>
          <Breadcrumb parents={['/clocky-hours', { href: '/clocky-hours/reports', label: 'Reports' }]} now="Payroll summary" />
          <h1 className={PAGE_TITLE}>Payroll summary</h1>
          <p className="m-0 mt-1 text-[13.5px] text-muted">US employees, the hours recorded in the period. Nothing is topped up or capped: a row that is not 8 hours a weekday (80 in a pay period) is marked to check.</p>
        </div>
        <a href={`/clocky-hours/reports/payroll/csv?${payrollSearch(page.query)}`} className={BTN.white} download>Download CSV</a>
      </div>

      <PayrollFilters query={page.query} from={page.from} to={page.to} label={page.label} />

      <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
        <div className={`${CARD} p-3.5`}><div className="text-[12.5px] text-muted">US employees</div><div className="text-[22px] font-semibold text-tn-ink">{page.lines.length}</div></div>
        <div className={`${CARD} p-3.5`}><div className="text-[12.5px] text-muted">Not approved yet</div><div className="text-[22px] font-semibold text-tn-ink">{pending} h</div></div>
        <div className={`${CARD} p-3.5`}><div className="text-[12.5px] text-muted">Rows to check</div><div className={`text-[22px] font-semibold ${flagged ? 'text-[#b26a00]' : 'text-tn-ink'}`}>{flagged}</div></div>
      </div>

      <div className={`${CARD} overflow-x-auto`}>
        <table className="w-full border-collapse text-[13.5px] text-tn-ink">
          <thead><tr><th className={TH}>type</th><th className={TH}>hours</th><th className={TH}>fname</th><th className={TH}>lname</th><th className={TH}>Check</th></tr></thead>
          <tbody>
            {page.lines.flatMap(l => {
              const check = [gapText(l.gap, page.expected), l.pending ? `${l.pending} h not approved yet` : null].filter(Boolean).join(' · ')
              const rows = [
                <tr key={`${l.personId}-reg`} className="border-t border-[var(--panel-border)]">
                  <td className={TD}>REG</td><td className={TD}>{l.reg}</td><td className={TD}>{l.fname}</td><td className={TD}>{l.lname}</td>
                  <td className={`${TD} ${check ? 'text-[#b26a00]' : ''}`}>{check}</td>
                </tr>,
              ]
              if (l.pto > 0) rows.push(
                <tr key={`${l.personId}-pto`}>
                  <td className={TD}>PTO</td><td className={TD}>{l.pto}</td><td className={TD}></td><td className={TD}></td><td className={TD}></td>
                </tr>,
              )
              return rows
            })}
          </tbody>
        </table>
      </div>
      <p className="m-0 text-[12.5px] text-muted">The CSV has only type, hours, fname and lname, in this order. Unpaid time off is left out.</p>
    </div>
  )
}
