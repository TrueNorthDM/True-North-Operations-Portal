// The page the PDF route renders headless.
//
// Same components as the screen, on white, with the controls and the tab bar
// gone: a printed report has no switches, and a reader holding it on paper
// needs the scope and period stated instead, which the subtitle does.
//
// Reached directly it is a printable page; reached with ?pdf=1 it is what
// Puppeteer photographs.

import { loadAccess, requireSurface } from '@/lib/access/resolve'
import { directoryLevel } from '@/lib/access/surfaces'
import { createClient } from '@/lib/supabase/server'
import { loadCurrentPerson } from '@/lib/directory/current-person'
import { resolveTab } from '@/components/report/ReportTabs'
import { resolvePeriod, resolveScope, SCOPE_LABEL } from '@/lib/report/scope'
import { loadReportOverview, readRecording } from '@/lib/report/data'
import { loadReportPeople } from '@/lib/report/people'
import { loadWaits } from '@/lib/report/waits'
import { loadWorkload } from '@/lib/report/workload-data'
import { loadMethod } from '@/lib/report/method'
import { ReportOverview } from '@/components/report/ReportOverview'
import { ReportPeople } from '@/components/report/ReportPeople'
import { ReportWaits } from '@/components/report/ReportWaits'
import { ReportWorkload } from '@/components/report/ReportWorkload'
import { ReportMethod } from '@/components/report/ReportMethod'
import { EstimateAudit } from '@/components/report/WorkloadHoldings'

export const metadata = { title: 'Report' }
export const dynamic = 'force-dynamic'

export default async function ReportPrintPage(
  { searchParams }: {
    searchParams: Promise<{ tab?: string; scope?: string; period?: string; team?: string }>
  },
) {
  await requireSurface('my-work')

  const access = await loadAccess()
  const level = directoryLevel(access.can)
  const sp = await searchParams

  const tab = resolveTab(sp.tab, level)
  const scope = resolveScope(sp.scope, level)
  const period = resolvePeriod(sp.period)

  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  const me = await loadCurrentPerson(supabase, auth?.user ?? null)
  const filters = scope === 'me' ? { personId: me?.id ?? null } : { teamId: sp.team || null }

  const printed = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    // print-doc is what the PDF route waits for before photographing, and the
    // same class the Time report's print page uses.
    <div className="print-doc bg-white text-tn-ink p-8 print:p-0">
      <header className="pb-4 mb-5 border-b border-[var(--panel-border)]">
        <h1 className="font-(family-name:--font-display) font-extrabold text-[24px] m-0">
          Report · {TAB_TITLE[tab]}
        </h1>
        {/* The switches are gone, so the state they carried is written down. */}
        <p className="text-[13px] text-muted mt-1.5 m-0">
          {`${SCOPE_LABEL[scope]} · last ${period} days · printed ${printed}`}
        </p>
      </header>

      <Body tab={tab} supabase={supabase} filters={filters} period={period} level={level} />
    </div>
  )
}

const TAB_TITLE: Record<string, string> = {
  overview: 'Overview',
  people: 'People',
  workload: 'Workload',
  waits: 'Where it waits',
  method: 'Method',
}

async function Body({
  tab, supabase, filters, period, level,
}: {
  tab: string
  level: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
  filters: { personId?: string | null; teamId?: string | null }
  period: 30 | 90
}) {
  if (tab === 'people') {
    // No loadDetail: on paper a row cannot be clicked, so it must not look
    // like it can.
    return <ReportPeople people={await loadReportPeople(supabase, { ...filters, period })} />
  }

  if (tab === 'workload') {
    const { people, effort, estimateReady } = await loadWorkload(supabase, { ...filters, period })
    return (
      <div className="space-y-4">
        <ReportWorkload people={people} />
        {estimateReady ? <EstimateAudit rows={effort} /> : null}
      </div>
    )
  }

  if (tab === 'waits') {
    const { steps, boards, stuck } = await loadWaits(supabase, { ...filters, period })
    return <ReportWaits steps={steps} boards={boards} stuck={stuck} />
  }

  if (tab === 'method') {
    const { sources, todo } = await loadMethod(supabase, await readRecording(supabase))
    return <ReportMethod sources={sources} todo={todo} yourLevel={level} />
  }

  const { overview } = await loadReportOverview(supabase, { ...filters, period })
  return <ReportOverview data={overview} />
}
