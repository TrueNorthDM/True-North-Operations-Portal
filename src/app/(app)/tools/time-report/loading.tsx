// Shown while the report loads (it pulls i7 timesheets from January through the
// selected month for the carryover, which can take a few seconds).

export default function Loading() {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
          <span>Dashboard</span><span>/</span><span>Tools</span><span>/</span><span>i7 Budget Usage Report</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">i7 Budget Usage Report</h1>
        <p className="mt-1 text-slate-500">Hours, cost and budget usage for the i7 Marketing client — pulled directly from QuickBooks Time.</p>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-6">
        <svg className="w-5 h-5 animate-spin text-slate-400" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-20" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <div>
          <p className="text-sm font-medium text-slate-700">Loading the report…</p>
          <p className="text-xs text-slate-400">Pulling i7 hours from QuickBooks Time and computing the running balance since January.</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="flex items-center justify-between px-4 py-4 border-b border-slate-100 last:border-0">
            <div className="h-4 w-40 rounded bg-slate-100 animate-pulse" />
            <div className="h-4 w-16 rounded bg-slate-100 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
