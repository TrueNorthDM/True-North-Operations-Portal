// Time Report — pulls hours from QuickBooks Time (TSheets) and renders the
// employee × job code pivot that the admin assistant used to build manually.
//
// The TSheets API token is read here (server-side only) and never sent to the
// client. The matrix component receives already-computed data as props.

import { createClient } from '@/lib/supabase/server'
import { fetchUsers, fetchJobcodes, fetchTimesheets } from '@/lib/tsheets/client'
import { buildMatrix, monthBounds, currentYearMonth } from '@/lib/tsheets/report'
import { TimeReportMatrixView } from '@/components/tsheets/TimeReportMatrix'

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
        <h1 className="text-2xl font-bold text-slate-900">Time Report</h1>
        <p className="mt-1 text-slate-500">
          Hours per employee per job code — pulled directly from QuickBooks Time.
        </p>
      </div>

      {!token ? (
        <NoTokenState />
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

function NoTokenState() {
  return (
    <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white p-8 text-center space-y-4 max-w-lg mx-auto">
      <div className="text-3xl" aria-hidden="true">⏱</div>
      <div>
        <p className="font-semibold text-slate-800">QuickBooks Time token not configured</p>
        <p className="text-sm text-slate-500 mt-1">
          Add your TSheets API token in Settings to start pulling hours automatically.
        </p>
      </div>
      <a
        href="/settings"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-900 transition-colors"
      >
        Go to Settings →
      </a>
      <div className="text-xs text-slate-400 pt-2">
        In TSheets: company menu → Company Settings → Add-ons → API Access → generate token
      </div>
    </div>
  )
}
