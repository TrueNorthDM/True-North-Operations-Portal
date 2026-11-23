// North Time > Reports > Time off balances (owner, 23 November 2026): what each US employee has left of Vacation and
// sick leave. Finance loads Rippling's report here; the portal takes off the time off approved since
// (lib/timeclock/time-off-rules.ts). Super Admins and Finance only, as the payroll summary.

import { redirect } from 'next/navigation'
import { previewHref } from '@/lib/auth/view-as-server'
import { requireSurface } from '@/lib/access/resolve'
import { allRows, db, loadClockySettings, loadDirectory } from '@/lib/timeclock/clocky-context'
import { dateLabel, dayLabel, localDate } from '@/lib/timeclock/format'
import { canSeePayroll } from '@/lib/timeclock/payroll-summary-data'
import { loadOffStandings } from '@/lib/timeclock/time-off-rules-data'
import { balanceNote, hoursText, NO_STANDING, SICK_YEAR_HOURS, type OffBalance } from '@/lib/timeclock/time-off-rules'
import { teamColour } from '@/lib/directory/team-colour'
import { BalancesLoader } from '@/components/clocky/reports/BalancesLoader'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Avatar } from '@/components/Avatar'
import { CARD, PAGE_TITLE } from '@/lib/ui/type'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Time off balances' }

const GRID = 'minmax(220px,2fr) minmax(150px,1.3fr) minmax(150px,1.3fr) minmax(200px,1.8fr)'
const HEAD = 'font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] leading-[normal] uppercase text-muted'

function Left({ b }: { b: OffBalance | undefined }) {
  if (!b) return <span className="text-sm text-muted">-</span>
  return (
    <span className="flex flex-col gap-0.5">
      <span className={`font-(family-name:--font-display) font-bold text-sm tabular-nums lining-nums ${b.left < 0 ? 'text-[#c8323d]' : 'text-tn-ink'}`}>{hoursText(b.left)}</span>
      <span className="text-[11.5px] text-muted tabular-nums lining-nums">{b.usedSince > 0 ? `${b.reported} h in Rippling, less ${hoursText(b.usedSince)}` : `${b.reported} h in Rippling`}</span>
      {b.waiting > 0 && <span className="text-[11.5px] text-muted tabular-nums lining-nums">{hoursText(b.waiting)} waiting for approval</span>}
    </span>
  )
}

export default async function BalancesRoute() {
  const access = await requireSurface('clocky-reports')
  if (!(await canSeePayroll(access))) redirect(await previewHref('/clocky-hours/reports'))
  const c = db()
  const today = localDate(new Date(), (await loadClockySettings()).companyZone)
  const [people, dir] = await Promise.all([
    allRows<{ id: string; full_name: string }>((a, b) => c.from('people').select('id, full_name').eq('employment_type', 'us').eq('status', 'active').order('full_name').range(a, b), 'People could not be read'),
    loadDirectory(),
  ])
  const standings = await loadOffStandings(people.map(p => p.id), today)
  const year = today.slice(0, 4)
  const days = [...new Set([...standings.values()].flatMap(s => Object.values(s.balances).map(b => b.asOf)))].sort()
  const latest = days[days.length - 1] ?? null

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div>
        <Breadcrumb parents={['/clocky-hours', { href: '/clocky-hours/reports', label: 'Reports' }]} now="Time off balances" />
        <h1 className={PAGE_TITLE}>Time off balances</h1>
        <p className="m-0 mt-1 text-[13.5px] text-muted">
          What each US employee has left. The numbers come from Rippling&apos;s Time off balances report{latest ? `, last loaded for ${dateLabel(latest)}` : ''}; the portal takes off the time off approved since, and adds nothing: what was earned since comes with the next report.
        </p>
      </div>

      <BalancesLoader people={people.map(p => ({ id: p.id, fullName: p.full_name }))} today={today} />

      <div className={`${CARD} overflow-x-auto`}>
        <div className="min-w-[760px]">
          <div className="grid gap-3.5 items-center px-[22px] py-[13px] bg-subtle border-b border-slate-200" style={{ gridTemplateColumns: GRID }}>
            <span className={HEAD}>Person</span><span className={HEAD}>Vacation left</span><span className={HEAD}>Sick leave left</span><span className={HEAD}>Rules</span>
          </div>
          {people.map((p, i) => {
            const s = standings.get(p.id) ?? NO_STANDING
            const d = dir.people.get(p.id), t = d?.teamId ? dir.teams.get(d.teamId) : undefined
            const anyBalance = s.balances.vacation ?? s.balances.sick
            const sick = s.sickUsed[year] ?? 0
            const notes = [
              s.vacationFrom && s.vacationFrom > today ? `Vacation from ${dayLabel(s.vacationFrom)}, ${s.vacationFrom.slice(0, 4)}` : null,
              s.sickFrom && s.sickFrom > today ? `Sick leave from ${dayLabel(s.sickFrom)}, ${s.sickFrom.slice(0, 4)}` : null,
              sick > 0 ? `${hoursText(sick)} of ${SICK_YEAR_HOURS}h sick leave in ${year}` : null,
            ].filter((x): x is string => !!x)
            return (
              <div key={p.id} className={`grid gap-3.5 items-center px-[22px] py-[13px] transition-colors hover:bg-subtle ${i === 0 ? '' : 'border-t border-slate-200'}`} style={{ gridTemplateColumns: GRID }}>
                <span className="inline-flex items-center gap-3 min-w-0">
                  <Avatar name={p.full_name} avatarUrl={d?.avatarUrl} size={38} color={teamColour(t?.color, t?.name)} />
                  <span className="min-w-0">
                    <span className="block font-(family-name:--font-display) font-bold text-sm text-tn-ink truncate">{p.full_name}</span>
                    <span className="block text-xs text-muted truncate">{anyBalance ? balanceNote(anyBalance).replace(/, less.*$/, '') : 'No balance loaded yet'}</span>
                  </span>
                </span>
                <Left b={s.balances.vacation} />
                <Left b={s.balances.sick} />
                <span className="flex flex-col gap-0.5 text-[12.5px] text-foreground">{notes.length ? notes.map(n => <span key={n} className={sick >= SICK_YEAR_HOURS * 3600 && n.includes('sick leave in') ? 'font-semibold text-[var(--bdg-orange-fg)]' : ''}>{n}</span>) : <span className="text-muted">-</span>}</span>
              </div>
            )
          })}
          {people.length === 0 && <div className="px-[22px] py-[52px] text-center"><p className="text-sm text-muted">No US employees.</p></div>}
        </div>
      </div>

      <p className="m-0 text-[12.5px] text-muted mx-0.5">The handbook&apos;s rules are applied when time off is asked: no Vacation in the first year of employment, sick leave from the 91st day, and no more than {SICK_YEAR_HOURS} hours of sick leave in a calendar year (taken, approved or asked).</p>
    </div>
  )
}
