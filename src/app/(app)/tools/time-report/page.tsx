// Time Report — pulls hours from QuickBooks Time (TSheets) and renders the
// employee × job code pivot that the admin assistant used to build manually.
//
// The TSheets API token is read here (server-side only) and never sent to the
// client. The matrix component receives already-computed data as props.

import { createClient } from '@/lib/supabase/server'
import { fetchUsers, fetchJobcodes, fetchTimesheets } from '@/lib/tsheets/client'
import { buildMatrix, monthBounds, currentYearMonth } from '@/lib/tsheets/report'
import { TimeReportMatrixView } from '@/components/tsheets/TimeReportMatrix'
import { SyncStatus } from '@/components/tsheets/settings/SyncStatus'
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
const MOCK_CLIENTS = [
  { id: 100, name: '1 - True North' },
  { id: 101, name: '2 - i7 Marketing' },
]
const MOCK_JOBCODES = [
  { id: 10, name: 'Bessemeter', clientId: 100 },
  { id: 11, name: 'Foreign contractors', clientId: 101 },
  { id: 12, name: 'i7 Marketing', clientId: 101 },
  { id: 13, name: 'MME', clientId: 100 },
  { id: 14, name: 'WM All', clientId: 100 },
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
  clients: MOCK_CLIENTS,
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
    .select('tsheets_api_token, tsheets_synced_at')
    .eq('singleton_id', 1)
    .maybeSingle()

  const token = settings?.tsheets_api_token ?? null
  const syncedAt = settings?.tsheets_synced_at ?? null

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
          <a href="/" className="hover:text-slate-800">Dashboard</a>
          <span>/</span>
          <a href="/tools" className="hover:text-slate-800">Tools</a>
          <span>/</span>
          <span>Budget Usage Report</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Budget Usage Report</h1>
        <p className="mt-1 text-slate-500">
          Hours per employee per job code — pulled directly from QuickBooks Time.{' '}
          <a href="/settings" className="text-slate-600 underline underline-offset-2 hover:text-slate-900">
            Manage clients, rates &amp; budgets in Settings →
          </a>
        </p>
        <div className="mt-3">
          <SyncStatus syncedAt={syncedAt} />
        </div>
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

