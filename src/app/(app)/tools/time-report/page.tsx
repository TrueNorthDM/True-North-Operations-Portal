// Time Report — pulls hours from QuickBooks Time (TSheets) and renders the
// employee × job code pivot that the admin assistant used to build manually.
//
// The TSheets API token is read here (server-side only) and never sent to the
// client. The matrix component receives already-computed data as props.

import { createClient } from '@/lib/supabase/server'
import { fetchUsers, fetchJobcodes, fetchTimesheets } from '@/lib/tsheets/client'
import { buildMatrix, monthBounds, currentYearMonth } from '@/lib/tsheets/report'
import { TimeReportMatrixView } from '@/components/tsheets/TimeReportMatrix'
import type { TimeReportMatrix } from '@/lib/tsheets/types'

// Sample data shown when no API token is configured, so the user can see the
// table structure before adding their credentials.
const MOCK_EMPLOYEES = [
  { id: 1, name: 'Amy' },
  { id: 2, name: 'Cheyenne' },
  { id: 3, name: 'Jeannette' },
  { id: 4, name: 'Kathleen' },
  { id: 5, name: 'Samuel' },
  { id: 6, name: 'Stephanie' },
]
const MOCK_JOBCODES = [
  { id: 10, name: 'Bessemeter' },
  { id: 11, name: 'Foreign contractors' },
  { id: 12, name: 'i7 Marketing' },
  { id: 13, name: 'MME' },
  { id: 14, name: 'WM All' },
]
const MOCK_HOURS: Record<number, Record<number, number>> = {
  10: { 1: 12, 3: 8, 5: 20 },
  11: { 2: 4, 6: 16 },
  12: { 1: 40, 2: 32, 3: 24, 4: 38, 5: 10, 6: 20 },
  13: { 1: 8, 3: 16, 4: 24, 6: 8 },
  14: { 2: 20, 4: 12, 5: 28, 6: 4 },
}
const MOCK_MATRIX: TimeReportMatrix = {
  month: '2026-06',
  startDate: '2026-06-01',
  endDate: '2026-06-30',
  employees: MOCK_EMPLOYEES,
  jobcodes: MOCK_JOBCODES,
  hours: MOCK_HOURS,
  rowTotals: Object.fromEntries(
    MOCK_JOBCODES.map(jc => [jc.id, Object.values(MOCK_HOURS[jc.id] ?? {}).reduce((a, b) => a + b, 0)])
  ),
  colTotals: Object.fromEntries(
    MOCK_EMPLOYEES.map(emp => [emp.id, MOCK_JOBCODES.reduce((sum, jc) => sum + (MOCK_HOURS[jc.id]?.[emp.id] ?? 0), 0)])
  ),
  grandTotal: MOCK_JOBCODES.reduce((sum, jc) => sum + Object.values(MOCK_HOURS[jc.id] ?? {}).reduce((a, b) => a + b, 0), 0),
}

// Generate the last 24 months as YYYY-MM strings (newest first)
function recentMonths(): string[] {
  const now = new Date()
  return Array.from({ length: 24 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
}

interface Props {
  searchParams: Promise<{ month?: string }>
}

export default async function TimeReportPage({ searchParams }: Props) {
  const { month } = await searchParams
  const selectedMonth = month ?? currentYearMonth()
  const availableMonths = recentMonths()

  const supabase = await createClient()
  const { data: settings } = await supabase
    .from('app_settings')
    .select('tsheets_api_token')
    .eq('singleton_id', 1)
    .maybeSingle()

  const token = settings?.tsheets_api_token ?? null

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
          <a href="/" className="hover:text-slate-800">Dashboard</a>
          <span>/</span>
          <a href="/tools" className="hover:text-slate-800">Tools</a>
          <span>/</span>
          <span>Time Report</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Time Report</h1>
          <a
            href="/tools/time-report/settings"
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
            Settings
          </a>
        </div>
        <p className="mt-1 text-slate-500">
          Hours per employee per job code — pulled directly from QuickBooks Time.
        </p>
      </div>

      {!token ? (
        <TimeReportMatrixView
          data={MOCK_MATRIX}
          selectedMonth={selectedMonth}
          availableMonths={availableMonths}
          preview
        />
      ) : (
        <ReportView token={token} selectedMonth={selectedMonth} availableMonths={availableMonths} />
      )}
    </div>
  )
}

async function ReportView({
  token,
  selectedMonth,
  availableMonths,
}: {
  token: string
  selectedMonth: string
  availableMonths: string[]
}) {
  const { startDate, endDate } = monthBounds(selectedMonth)

  let data = null
  let fetchError: string | null = null

  try {
    const [users, jobcodes, timesheets] = await Promise.all([
      fetchUsers(token),
      fetchJobcodes(token),
      fetchTimesheets(token, startDate, endDate),
    ])
    data = buildMatrix(users, jobcodes, timesheets, startDate)
  } catch (e) {
    fetchError = e instanceof Error ? e.message : 'Unknown error fetching from TSheets.'
  }

  if (fetchError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 space-y-2">
        <p className="font-semibold text-red-700">Failed to fetch from QuickBooks Time</p>
        <p className="text-sm text-red-600 font-mono">{fetchError}</p>
        <p className="text-sm text-red-500">
          Check that your API token in <a href="/settings" className="underline">Settings</a> is valid and hasn&apos;t expired.
        </p>
      </div>
    )
  }

  if (!data || data.grandTotal === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center space-y-2">
        <p className="font-semibold text-slate-700">No approved time entries found</p>
        <p className="text-sm text-slate-500">
          There are no approved timesheets for {selectedMonth}. Try a different month or check that entries have been approved in TSheets.
        </p>
      </div>
    )
  }

  return (
    <TimeReportMatrixView
      data={data}
      selectedMonth={selectedMonth}
      availableMonths={availableMonths}
    />
  )
}

