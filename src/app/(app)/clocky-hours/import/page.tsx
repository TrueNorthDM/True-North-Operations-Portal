// Clocky > Import (16 October 2026): what /clocky-hours was before it became
// Time entries, moved here whole (docs/time-clock/05-clocky-build.md, owner's
// decision 2): the rules, the migration from QuickBooks Time, and the
// reconciliation that decides whether any of it can be trusted.
//
// The reconciliation is the point of the page. A migration that ends in "done"
// tells you it finished, not that it is right; this ends in their number beside
// ours, month by month, for every month since 2017.

import { requireSurface } from '@/lib/access/resolve'
import { createAdminClient } from '@/lib/supabase/admin'
import { ImportRunner } from '../ImportRunner'
import { RulesForm, type Rules } from '../RulesForm'
import { Breadcrumb } from '@/components/ui/Breadcrumb'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Import' }

type Settings = Rules

interface Recon {
  month: string
  tsheets_entries: number
  tsheets_seconds: number
  portal_entries: number
  portal_seconds: number
}

const hours = (s: number) => (s / 3600).toFixed(2)

/**
 * What a run row actually means now.
 *
 * A slice killed by the platform never gets to mark itself finished, so
 * "running" outlives the run and the header claims an import is in flight days
 * later. Anything idle for an hour is over, whatever the row says.
 *
 * Outside the component on purpose: reading the clock during a render is the
 * kind of impurity React rightly complains about, and a plain function that
 * takes a row and answers a question is easier to trust anyway.
 */
function runState(run: { state: string; started_at: string | null }): string {
  if (run.state !== 'running' || !run.started_at) return run.state
  return Date.now() - Date.parse(run.started_at) > 3600_000 ? 'stopped' : run.state
}

export default async function ClockyImportPage() {
  const access = await requireSurface('clocky-hours')
  // Rules in force, Migration and Reconciliation are items of their own; a
  // section that is off is neither read nor drawn.
  const can = { rules: access.can('ck-rules'), import: access.can('ck-import'), recon: access.can('ck-recon') }
  const supabase = createAdminClient()
  const none = { data: null, error: null, count: null }

  const [settingsRes, reconRes, runRes, entriesRes, jobcodesRes] = await Promise.all([
    can.rules || can.import ? supabase.from('tc_settings').select('*').eq('singleton_id', 1).maybeSingle() : Promise.resolve(none),
    can.recon || can.import ? supabase.from('tc_reconciliation').select('*').order('month') : Promise.resolve(none),
    can.import ? supabase.from('tc_import_runs').select('*').order('id', { ascending: false }).limit(1).maybeSingle() : Promise.resolve(none),
    can.import ? supabase.from('tc_entries').select('id', { count: 'exact', head: true }) : Promise.resolve(none),
    can.import ? supabase.from('tc_jobcodes').select('id', { count: 'exact', head: true }) : Promise.resolve(none),
  ])

  // The tables land with migration 057. Until it is applied, say so plainly
  // instead of rendering a page of zeros that looks like a working empty state.
  if (settingsRes.error) {
    return (
      <div className="space-y-4">
        <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">Import</h1>
        <div className="rounded-[12px] border border-amber-300/60 bg-amber-50 p-5 text-sm text-[#8a6d1a] space-y-1">
          <p className="font-semibold m-0">Migration 057 has not been applied yet.</p>
          <p className="m-0">Run <code className="font-mono">supabase/migrations/057_time_clock_schema.sql</code> in the SQL editor, then reload this page.</p>
          <p className="m-0 font-mono text-xs opacity-70">{settingsRes.error.message}</p>
        </div>
      </div>
    )
  }

  const s = settingsRes.data as Settings | null
  const recon = (reconRes.data ?? []) as Recon[]
  const run = runRes.data as { kind: string; state: string; cursor_date: string | null; entries_written: number; started_at: string | null; finished_at: string | null; error: string | null } | null

  const mismatched = recon.filter(r => r.tsheets_entries !== r.portal_entries || r.tsheets_seconds !== r.portal_seconds)
  // The target comes from the reconciliation, not from a number typed in here.
  // A constant would be right on the day it was written and wrong the next
  // morning, since people keep logging time while the migration runs.
  const sourceTotal = recon.reduce((s, r) => s + r.tsheets_entries, 0)
  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  const card = 'rounded-[14px] border border-slate-200 bg-white p-5'
  const label = 'text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted'

  return (
    <div className="space-y-8">
      <div>
        <Breadcrumb parents={['/clocky-hours']} now="Import" />
        <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">Import</h1>
        <p className="mt-1.5 text-muted leading-relaxed">
          The rules, the import from QuickBooks Time, and the reconciliation. QuickBooks Time is still
          the system of record, and nothing here writes back to it or to payroll.
        </p>
      </div>

      {!can.rules && !can.import && !can.recon && (
        <p className="text-sm text-muted m-0">None of the sections here is open to your access level.</p>
      )}

      {/* Phase 0: the rules, as imported. Read only until the clock exists. */}
      {can.rules && <section className="space-y-3">
        <h2 id="rules" className="scroll-mt-24 font-(family-name:--font-display) font-extrabold text-lg text-tn-ink m-0">Rules in force</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className={card}>
            <div className={label}>Timezone</div>
            <div className="mt-1 font-semibold text-tn-ink">{s?.timezone}</div>
            <div className="text-xs text-muted mt-0.5">Week starts {WEEKDAYS[s?.week_start ?? 0]}</div>
          </div>
          <div className={card}>
            <div className={label}>Rounding</div>
            <div className="mt-1 font-semibold text-tn-ink">Nearest, 15 min</div>
            <div className="text-xs text-muted mt-0.5">Every recorded time and total; the real times stay in each entry&apos;s history</div>
          </div>
          <div className={card}>
            <div className={label}>Clock safety</div>
            <div className="mt-1 font-semibold text-tn-ink">Stops after 5h</div>
            <div className="text-xs text-muted mt-0.5">
              Without an answer to &quot;Still working?&quot;
              {s?.import_cutoff_date ? ` · import stops at ${s.import_cutoff_date}` : ''}
            </div>
          </div>
        </div>
        {s && <RulesForm rules={s} />}
      </section>}

      {/* Phase 1: the migration. */}
      {can.import && <section className="space-y-3">
        <h2 id="import" className="scroll-mt-24 font-(family-name:--font-display) font-extrabold text-lg text-tn-ink m-0">Migration</h2>
        <div className="flex items-center gap-6 flex-wrap text-sm">
          <span><span className="text-muted">Entries here:</span> <strong className="tabular-nums">{(entriesRes.count ?? 0).toLocaleString()}</strong>{sourceTotal > 0 && <> of <span className="tabular-nums">{sourceTotal.toLocaleString()}</span> in QuickBooks Time</>}</span>
          <span><span className="text-muted">Job codes:</span> <strong className="tabular-nums">{(jobcodesRes.count ?? 0).toLocaleString()}</strong></span>
          {run && (
            <span>
              <span className="text-muted">Last run:</span>{' '}
              <strong>{run.kind}</strong>,{' '}
              {runState(run)}
              {run.cursor_date ? `, at ${run.cursor_date.slice(0, 7)}` : ''}
            </span>
          )}
        </div>
        {run?.error && <p className="text-sm text-red-600 font-mono m-0">{run.error}</p>}

        <ImportRunner hasCutoff={Boolean(s?.import_cutoff_date)} mismatched={mismatched.length} />
      </section>}

      {/* The part that decides whether phase 1 is finished. */}
      {can.recon && <section className="space-y-3">
        <h2 className="font-(family-name:--font-display) font-extrabold text-lg text-tn-ink m-0">Reconciliation</h2>
        {recon.length === 0 ? (
          <p className="text-sm text-muted m-0">Nothing checked yet. It fills in as the import walks the months.</p>
        ) : (
          <>
            <p className="text-sm m-0">
              {mismatched.length === 0
                ? <span className="text-[#1f8a5b] font-semibold">Every one of the {recon.length} months checked matches, entry for entry and second for second.</span>
                : <span className="text-[#c2410c] font-semibold">{mismatched.length} of {recon.length} months do not match.</span>}
            </p>
            <div className="overflow-x-auto rounded-[14px] border border-slate-200 bg-white">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-subtle border-b border-slate-200">
                    <th className={`text-left ${label} px-4 py-3`}>Month</th>
                    <th className={`text-right ${label} px-3 py-3`}>Entries there</th>
                    <th className={`text-right ${label} px-3 py-3`}>Entries here</th>
                    <th className={`text-right ${label} px-3 py-3`}>Hours there</th>
                    <th className={`text-right ${label} px-3 py-3`}>Hours here</th>
                    <th className={`text-left ${label} px-3 py-3`}>Match</th>
                  </tr>
                </thead>
                <tbody>
                  {recon.map(r => {
                    const ok = r.tsheets_entries === r.portal_entries && r.tsheets_seconds === r.portal_seconds
                    return (
                      <tr key={r.month} className="border-b border-slate-100">
                        <td className="px-4 py-2.5 font-semibold text-tn-ink tabular-nums">{r.month}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{r.tsheets_entries.toLocaleString()}</td>
                        <td className={`px-3 py-2.5 text-right tabular-nums ${ok ? '' : 'text-[#c2410c] font-semibold'}`}>{r.portal_entries.toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{hours(r.tsheets_seconds)}</td>
                        <td className={`px-3 py-2.5 text-right tabular-nums ${ok ? '' : 'text-[#c2410c] font-semibold'}`}>{hours(r.portal_seconds)}</td>
                        <td className="px-3 py-2.5">
                          {ok
                            ? <span className="text-[#1f8a5b]">match</span>
                            : <span className="text-[#c2410c] font-semibold">
                                {/* Name what actually differs. "off by 0 entries" is what
                                    this said when the counts agreed and the hours did not,
                                    which is the harder case, not the trivial one. */}
                                {r.tsheets_entries !== r.portal_entries
                                  ? `${Math.abs(r.tsheets_entries - r.portal_entries)} entries missing`
                                  : `same entries, ${hours(Math.abs(r.tsheets_seconds - r.portal_seconds))} h apart`}
                              </span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>}
    </div>
  )
}
