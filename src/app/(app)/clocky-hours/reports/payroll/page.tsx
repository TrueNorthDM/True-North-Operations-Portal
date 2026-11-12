// North Time > Reports > Payroll summary (owner and Tina, 12 November 2026):
// each US employee's REG and PTO hours for a pay period (or a month, quarter or any days), and the file Tina
// sends to Rippling. Super Admins and Finance only (payroll-summary-data.ts).

import { redirect } from 'next/navigation'
import { previewHref } from '@/lib/auth/view-as-server'
import { requireSurface } from '@/lib/access/resolve'
import { canSeePayroll, loadPayroll } from '@/lib/timeclock/payroll-summary-data'
import { parsePayrollQuery, payrollSearch, type PayrollLine } from '@/lib/timeclock/payroll-summary'
import { PayrollFilters } from '@/components/clocky/reports/PayrollFilters'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { BTN } from '@/lib/ui/buttons'
import { Avatar } from '@/components/Avatar'
import { Pill } from '@/components/ui/Pill'
import { CARD, PAGE_TITLE } from '@/lib/ui/type'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Payroll summary' }

/** The Directory's list: label row, hairline rows, one grid for both. */
const GRID = 'minmax(220px,2.2fr) minmax(70px,.7fr) minmax(70px,.7fr) minmax(80px,.8fr) minmax(190px,1.8fr)'
const HEAD = 'font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] leading-[normal] uppercase text-muted'
const NUM = 'font-(family-name:--font-display) font-bold text-sm tabular-nums lining-nums text-right'
const STAT = 'font-(family-name:--font-display) font-extrabold text-[26px] leading-none tabular-nums lining-nums'

/** Hours as TSheets writes them: 80, 67.5, 11.25; a dash for none. */
const h = (n: number) => (n ? String(n) : '-')

function Status({ l, expected }: { l: PayrollLine; expected: number }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {l.gap === 0 ? <Pill tone="green" text={`${expected} h`} />
        : l.gap < 0 ? <Pill tone="amber" text={`${-l.gap} h short`} tip={`${-l.gap} hours short of ${expected}`} />
        : <Pill tone="blue" text={`${l.gap} h over`} tip={`${l.gap} hours over ${expected}`} />}
      {l.pending > 0 && <Pill tone="gray" text={`${l.pending} h not approved`} />}
    </span>
  )
}

export default async function PayrollRoute({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const access = await requireSurface('clocky-reports')
  if (!(await canSeePayroll(access))) redirect(await previewHref('/clocky-hours/reports'))
  const page = await loadPayroll(parsePayrollQuery(await searchParams))
  if (!page) return <p role="alert" className="m-0 text-[13px] font-semibold text-[#c8323d]">The company pay period start is not set (North Time settings).</p>

  const flagged = page.lines.filter(l => l.gap !== 0).length
  const sum = (k: 'reg' | 'pto' | 'pending') => Math.round(page.lines.reduce((n, l) => n + l[k], 0) * 100) / 100
  const stats = [
    { label: 'US employees', value: String(page.lines.length), tone: 'text-tn-ink' },
    { label: 'Regular hours', value: String(sum('reg')), tone: 'text-tn-ink' },
    { label: 'Paid time off', value: String(sum('pto')), tone: 'text-tn-teal' },
    { label: 'To check', value: String(flagged), tone: flagged ? 'text-[var(--bdg-orange-fg)]' : 'text-tn-ink', note: sum('pending') ? `${sum('pending')} h not approved yet` : null },
  ]

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex items-end justify-between gap-3.5 flex-wrap">
        <div>
          <Breadcrumb parents={['/clocky-hours', { href: '/clocky-hours/reports', label: 'Reports' }]} now="Payroll summary" />
          <h1 className={PAGE_TITLE}>Payroll summary</h1>
          <p className="m-0 mt-1 text-[13.5px] text-muted">The hours each US employee recorded, as they go to Rippling. Nothing is topped up or capped: a row that is not {page.expected} hours is marked to check.</p>
        </div>
        <a href={`/clocky-hours/reports/payroll/csv?${payrollSearch(page.query)}`} className={BTN.white} download>Download CSV</a>
      </div>

      <PayrollFilters query={page.query} from={page.from} to={page.to} label={page.label} prev={page.prev} next={page.next} />

      <div className="grid grid-cols-4 gap-3.5 max-lg:grid-cols-2">
        {stats.map(s => (
          <div key={s.label} className={`${CARD} px-[22px] py-[18px]`}>
            <div className={HEAD}>{s.label}</div>
            <div className={`${STAT} mt-2.5 ${s.tone}`}>{s.value}</div>
            {s.note && <div className="mt-1.5 text-[12px] text-muted">{s.note}</div>}
          </div>
        ))}
      </div>

      <div className={`${CARD} overflow-x-auto`}>
        <div className="min-w-[680px]">
          <div className="grid gap-3.5 items-center px-[22px] py-[13px] bg-subtle border-b border-slate-200" style={{ gridTemplateColumns: GRID }}>
            <span className={HEAD}>Person</span>
            <span className={`${HEAD} text-right`}>REG</span>
            <span className={`${HEAD} text-right`}>PTO</span>
            <span className={`${HEAD} text-right`}>Total</span>
            <span className={HEAD}>Check</span>
          </div>
          {page.lines.map((l, i) => {
            const look = page.looks[l.personId]
            const name = `${l.fname} ${l.lname}`.trim()
            return (
              <div key={l.personId} className={`grid gap-3.5 items-center px-[22px] py-[13px] transition-colors hover:bg-subtle ${i === 0 ? '' : 'border-t border-slate-200'}`} style={{ gridTemplateColumns: GRID }}>
                <span className="inline-flex items-center gap-3 min-w-0">
                  <Avatar name={name} avatarUrl={look?.avatarUrl} size={38} color={look?.color} />
                  <span className="min-w-0">
                    <span className="block font-(family-name:--font-display) font-bold text-sm text-tn-ink truncate">{name}</span>
                    <span className="block text-xs text-muted truncate">{look?.team ?? 'No team'}</span>
                  </span>
                </span>
                <span className={`${NUM} ${l.reg ? 'text-tn-ink' : 'text-muted'}`}>{h(l.reg)}</span>
                <span className={`${NUM} ${l.pto ? 'text-tn-teal' : 'text-muted'}`}>{h(l.pto)}</span>
                <span className={`${NUM} text-tn-ink font-extrabold`}>{h(Math.round((l.reg + l.pto) * 100) / 100)}</span>
                <Status l={l} expected={page.expected} />
              </div>
            )
          })}
          {page.lines.length === 0 && <div className="px-[22px] py-[52px] text-center"><p className="text-sm text-muted">No US employees in this period.</p></div>}
        </div>
      </div>

      <p className="m-0 text-[12.5px] text-muted mx-0.5">{page.lines.length} people · {page.label}. The CSV keeps Tina&apos;s layout: type, hours, fname, lname, with each PTO row under its person. Unpaid time off is left out.</p>
    </div>
  )
}
