// The page the PDF route renders headless.
//
// Same components as the screen, on white, with the controls and the tab bar
// gone: a printed report has no switches, and a reader holding it on paper
// needs the scope and period stated instead, which the subtitle does.
//
// Reached directly it is a printable page; reached with ?pdf=1 it is what
// Puppeteer photographs.

import { loadAccess, requireSurface } from '@/lib/access/resolve'
import { createClient } from '@/lib/supabase/server'
import { resolveReportView } from '@/lib/report/view'
import type { PeopleFilter } from '@/lib/monday/worklist/data'
import { loadReportOverview, readRecording, type Recording } from '@/lib/report/data'
import { loadReportPeople } from '@/lib/report/people'
import { loadWaits } from '@/lib/report/waits'
import { loadWorkload } from '@/lib/report/workload-data'
import { loadMethod } from '@/lib/report/method'
import { reportDate } from '@/lib/report/clock'
import type { Scope } from '@/lib/report/scope'
import { ReportOverview } from '@/components/report/ReportOverview'
import { ReportPeople } from '@/components/report/ReportPeople'
import { ReportWaits } from '@/components/report/ReportWaits'
import { ReportWorkload } from '@/components/report/ReportWorkload'
import { ReportMethod } from '@/components/report/ReportMethod'
import { ChangeLogNotice, NoEstimateYet } from '@/components/report/ReportNotices'
import { EstimateAudit } from '@/components/report/WorkloadHoldings'
import { getCurrentPerson } from '@/lib/auth/session'

export const metadata = { title: 'Report' }
export const dynamic = 'force-dynamic'

export default async function ReportPrintPage(
  { searchParams }: {
    searchParams: Promise<{ tab?: string; scope?: string; period?: string; team?: string; person?: string }>
  },
) {
  await requireSurface('report')
  // The printable page is an export, like the CSV and the PDF.
  await requireSurface('rp-export')

  const access = await loadAccess()
  const sp = await searchParams
  const supabase = await createClient()
  const me = await getCurrentPerson()
  // Resolved exactly as the screen resolves it (lib/report/view.ts).
  const view = await resolveReportView(supabase, access.can, me?.id ?? null, sp)
  const { tab, period, filter: filters } = view
  const recording = await readRecording()

  const printed = reportDate(new Date())

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
          {`${view.label} · last ${period} days · printed ${printed}`}
        </p>
      </header>

      {/* The notices the screen shows, so paper says what the numbers rest on. */}
      {tab !== 'method' ? <div className="mb-4"><ChangeLogNotice recording={recording} /></div> : null}
      <Body tab={tab} filters={filters} period={period} recording={recording} widest={view.scopes[view.scopes.length - 1]} />
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
  tab, filters, period, recording, widest,
}: {
  tab: string
  widest: Scope
  filters: PeopleFilter
  period: 30 | 90
  recording: Recording
}) {
  if (tab === 'people') {
    // No loadDetail: on paper a row cannot be clicked, so it must not look
    // like it can.
    return <ReportPeople people={await loadReportPeople({ ...filters, period })} periodDays={period} />
  }

  if (tab === 'workload') {
    const { people, effort, estimateReady } = await loadWorkload({ ...filters, period })
    return (
      <div className="space-y-4">
        <ReportWorkload people={people} />
        {estimateReady ? <EstimateAudit rows={effort} /> : <NoEstimateYet />}
      </div>
    )
  }

  if (tab === 'waits') {
    const { steps, boards, stuck } = await loadWaits({ ...filters, period })
    return <ReportWaits steps={steps} boards={boards} stuck={stuck} />
  }

  if (tab === 'method') {
    const { sources, todo } = await loadMethod(recording)
    return <ReportMethod sources={sources} todo={todo} yours={widest} />
  }

  const { overview } = await loadReportOverview({ ...filters, period })
  return <ReportOverview data={overview} />
}
