import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireSurface } from '@/lib/access/resolve'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { ROUTES } from '@/lib/nav/routes'
// How the i7 Budget Usage Report is built, a plain-language explainer linked
// from the info icon in Settings. Static content (the July 2026 numbers are an
// illustrative worked example).

function InfoMark({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <circle cx="12" cy="7.2" r="1.5" />
      <rect x="10.6" y="10.4" width="2.8" height="7.4" rx="1.4" />
    </svg>
  )
}

const SOURCES = [
  { tag: 'Actuals', name: 'QuickBooks Time (TSheets)', cls: 'bg-blue-50 border-blue-200 text-blue-900', dot: 'text-blue-600',
    body: 'The real hours. Pulled automatically every 4 hours. Each approved entry says who worked, on which i7 code (→ project + job code), on which activity, and how many hours.' },
  { tag: 'Rates', name: 'Hourly rates', cls: 'bg-indigo-50 border-indigo-200 text-indigo-900', dot: 'text-indigo-600',
    body: 'Directory → Rates & Costs. Each person’s Rate / client ($/hour billed on i7), with history ($120 through January, $95 from February, foreign contractors $60).' },
  { tag: 'Budget $', name: 'Monthly budget', cls: 'bg-emerald-50 border-emerald-200 text-emerald-900', dot: 'text-emerald-600',
    body: 'Settings → Clients & Budgets → i7. Each month’s budget in dollars (base + extra). This is the source of truth for the month, the report never back-calculates it from hours.' },
  { tag: 'Budget hrs', name: 'Budget hours per project', cls: 'bg-amber-50 border-amber-200 text-amber-900', dot: 'text-amber-600',
    body: 'Same i7 modal. A planning estimate: how the budget splits into hours per project. Editing it never changes the dollar budget, a live “left to allocate” line flags when the hours run past it. Copy a month across to the others in a click.' },
]

const FORMULAS = [
  { label: 'Hours used', formula: 'sum of that group’s hours', from: 'TSheets' },
  { label: 'Budget used ($)', formula: 'for each person: their hours × their rate that month, summed', from: 'TSheets × Rates' },
  { label: 'Budget hrs', formula: 'the project’s budgeted hours for the month', from: 'Settings' },
  { label: 'Hrs avail.', formula: 'Budget hrs − Hours used', from: 'derived' },
  { label: 'Budget avail. ($)', formula: 'Hrs avail. × the month’s standard i7 rate ($95 in July)', from: 'derived × Rates' },
  { label: 'Person columns', formula: 'each person’s hours in that group', from: 'TSheets' },
]

const PROOF = [
  { p: 'Bessemeter', hrs: '220', used: '15.5', avail: '204.50', bavail: '$19,428', bused: '$1,411' },
  { p: 'i7 Marketing', hrs: '50', used: '2.25', avail: '47.75', bavail: '$4,536', bused: '$214' },
  { p: 'Moisture Meters (MME)', hrs: '10', used: '8.5', avail: '1.50', bavail: '$143', bused: '$808' },
  { p: 'Wagner Meters (WM)', hrs: '308', used: '75.75', avail: '232.25', bavail: '$22,064', bused: '$7,196' },
]

export default async function ReportGuidePage() {
  // Explains the Clients Reports figures, so it follows the report itself.
  const access = await requireSurface('tools')
  if (!access.canTool('i7-budget')) redirect('/')
  if (!access.can('i7-guide')) redirect(ROUTES.i7)

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      {/* Header */}
      <div>
        <Breadcrumb parents={[ROUTES.clientReports, ROUTES.i7]} now="How the report works" />
        <div className="flex items-start gap-4">
          <span className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-slate-900 text-white shrink-0">
            <InfoMark className="w-6 h-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">How the i7 Budget Usage Report is built</h1>
            <p className="mt-1 text-slate-500">
              The report never invents a number. It combines <strong className="text-slate-700">one thing pulled from QuickBooks Time</strong> with{' '}
              <strong className="text-slate-700">three things you set</strong>, then only adds and subtracts.
            </p>
          </div>
        </div>
      </div>

      {/* The four inputs */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">The four inputs</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SOURCES.map(s => (
            <div key={s.name} className={`rounded-2xl border p-5 ${s.cls}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`text-[11px] font-bold uppercase tracking-wide ${s.dot}`}>{s.tag}</span>
              </div>
              <div className="text-base font-bold">{s.name}</div>
              <p className="mt-1.5 text-sm leading-relaxed opacity-90">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How each column is calculated */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">How each column is calculated <span className="normal-case font-normal text-slate-400">(for the selected month)</span></h2>
        <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
          {FORMULAS.map(f => (
            <div key={f.label} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3.5">
              <span className="w-40 shrink-0 text-sm font-semibold text-slate-800">{f.label}</span>
              <span className="flex-1 min-w-[220px] text-sm text-slate-600">= {f.formula}</span>
              <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{f.from}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Budget balance */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">Budget Balance <span className="normal-case font-normal text-slate-400">(the running balance at the top)</span></h2>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
          <p className="text-sm text-slate-600">It works like a bank account, running from January:</p>
          <ul className="space-y-2 text-sm text-slate-700">
            <li><strong className="text-slate-900">Carried in</strong> = (all monthly budgets since January) − (all actual cost since January), for the months <em>before</em> the one you’re viewing.</li>
            <li><strong className="text-slate-900">Budget total this month</strong> = Carried in + this month’s budget (base + extra).</li>
            <li><strong className="text-slate-900">Used</strong> = the same &ldquo;Budget used&rdquo; total from the bottom of the table.</li>
            <li><strong className="text-slate-900">Balance left</strong> = Budget total − Used (this carries into next month).</li>
          </ul>
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600 leading-relaxed">
            On the report, <strong className="text-slate-900">Budget total this month</strong> shows the breakdown in brackets, e.g. <span className="font-mono text-slate-800">$49,094 ($55,000 − $5,906)</span>: this month’s full budget minus what was carried over (or plus, if last month came in under). The <strong className="text-slate-900">Team Update</strong> button (next to Export) turns the same numbers (used, % used, and what’s left) into a shareable image for the team.
          </div>
        </div>
      </section>

      {/* The proof */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">The proof - July 2026</h2>
        <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <th className="text-left px-4 py-3">Project</th>
                <th className="text-right px-4 py-3">Budget hrs<div className="font-normal normal-case text-slate-400">Settings</div></th>
                <th className="text-right px-4 py-3">Hours used<div className="font-normal normal-case text-slate-400">TSheets</div></th>
                <th className="text-right px-4 py-3">Hrs avail.<div className="font-normal normal-case text-slate-400">hrs − used</div></th>
                <th className="text-right px-4 py-3">Budget avail.<div className="font-normal normal-case text-slate-400">avail × $95</div></th>
                <th className="text-right px-4 py-3">Budget used<div className="font-normal normal-case text-slate-400">hrs × rate</div></th>
              </tr>
            </thead>
            <tbody>
              {PROOF.map(r => (
                <tr key={r.p} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-800">{r.p}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{r.hrs}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{r.used}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">{r.avail}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">{r.bavail}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{r.bused}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold text-slate-900">
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3 text-right tabular-nums">588</td>
                <td className="px-4 py-3 text-right tabular-nums">102.00</td>
                <td className="px-4 py-3 text-right tabular-nums">486.00</td>
                <td className="px-4 py-3 text-right tabular-nums">$46,170</td>
                <td className="px-4 py-3 text-right tabular-nums">$9,629</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="text-sm font-semibold text-emerald-900 mb-2">Everything checks out ✓</div>
          <ul className="space-y-1 text-sm text-emerald-800">
            <li><strong>588</strong> = 220 + 50 + 10 + 308, the hours you typed into the July matrix</li>
            <li><strong>486.00</strong> = 588 − 102.00</li>
            <li><strong>$46,170</strong> = 486 × <strong>$95</strong> (July&rsquo;s standard rate)</li>
            <li><strong>$9,629</strong> = the sum of actual cost (hours × each person&rsquo;s rate)</li>
          </ul>
          <div className="mt-4 rounded-xl bg-white/70 border border-emerald-200 p-4 font-mono text-[13px] text-emerald-900 leading-relaxed">
            Carried in (−$5,906) + This month ($55,000) = Budget total ($49,094)<br />
            Budget total ($49,094) − Used ($9,629) = Balance left ($39,465)
          </div>
        </div>
      </section>

      {/* One line */}
      <section className="rounded-2xl border border-slate-200 bg-slate-900 text-white p-6">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">In one line</div>
        <p className="text-lg leading-relaxed">
          <span className="text-emerald-300 font-semibold">Settings</span> sets the targets (budgeted hours and dollars),{' '}
          <span className="text-blue-300 font-semibold">QuickBooks Time</span> brings the actuals (hours),{' '}
          the <span className="text-indigo-300 font-semibold">rates</span> turn hours into dollars, and the report just adds and subtracts, every number traceable.
        </p>
      </section>

      <div className="pt-2">
        <Link href={ROUTES.i7} className="text-sm text-slate-600 underline underline-offset-2 hover:text-slate-900">Open the i7 Budget Usage Report →</Link>
      </div>
    </div>
  )
}
