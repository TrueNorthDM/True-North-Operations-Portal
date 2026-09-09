// Mockup: the Home page's widget row as proposed. Nothing here is wired up.
//
// Three changes being proposed at once, so they are shown together rather than
// one at a time: the three shortcut cards go, the i7 widget halves and becomes
// the link itself, and a Publishing goals widget joins it.
//
// Static figures. The point is the shape and the wording, not the numbers.

import Link from 'next/link'

const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

/** Two publishing boards, last four weeks. Real board names, invented counts. */
const BOARDS = [
  { name: 'AskAnAdventistFriend', short: 'AAAF', done: 41, target: 36 },
  { name: 'Hope for Africa', short: 'HFA', done: 22, target: 32 },
]

export default function HomeWidgetsMockup() {
  return (
    <div className="min-h-screen bg-[var(--page-bg,#efedE8)] px-6 py-10">
      <div className="max-w-[1400px] mx-auto space-y-8">
        <div>
          <p className="text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.14em] text-tn-teal m-0">Mockup, not built</p>
          <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">Home widgets</h1>
          <p className="mt-1.5 text-muted leading-relaxed m-0">
            The three shortcut cards are gone. The i7 widget is half width and is itself the link.
            Publishing goals is new.
          </p>
        </div>

        {/* What is being removed, shown once so the change is visible rather
            than just described. */}
        <div>
          <p className="text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.1em] text-muted m-0 mb-2">
            Removed
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 opacity-40 grayscale">
            {[
              ['My Work', 'Everything you’re working on across Monday.'],
              ['My Team', 'Your team at a glance.'],
              ['Tools & Dashboards', 'Dashboards and the tools used inside a project.'],
            ].map(([t, s]) => (
              <div key={t} className="rounded-[14px] border border-slate-200 bg-white p-5">
                <span className="inline-flex w-9 h-9 rounded-[10px] bg-tn-teal-soft mb-3" />
                <div className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">{t}</div>
                <div className="text-[12.5px] text-muted mt-0.5">{s}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.1em] text-muted m-0 mb-2">
            Proposed
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <I7Half />
            <PublishingGoals />
          </div>
        </div>

        <p className="text-[13px] text-muted leading-relaxed max-w-[70ch]">
          Both cards are one link each: the whole card is clickable, so there is no separate
          &ldquo;Open report&rdquo;. The i7 card keeps its navy header and the figures that answer
          the question at a glance, and drops the animated usage bar, which is what made it tall.
        </p>
      </div>
    </div>
  )
}

/** The i7 widget at half width: the header, the two figures, and a thin meter. */
function I7Half() {
  const total = 75047.38
  const used = 7577.92
  const left = total - used
  const pct = Math.round((used / total) * 100)

  return (
    <Link
      href="/tools/time-report"
      className="block rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-[0_1px_2px_rgba(1,35,88,.06)] transition-all hover:border-tn-teal hover:shadow-[0_10px_28px_-14px_rgba(1,35,88,.45)]"
    >
      <div className="flex items-center justify-between gap-3 bg-tn-primary px-5 py-3">
        <span className="font-(family-name:--font-display) font-extrabold text-[13px] text-white">i7 Marketing budget</span>
        <span className="font-(family-name:--font-display) font-bold text-[12px] text-white/70">September 2026</span>
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted">Balance left</div>
            <div className="text-[26px] font-(family-name:--font-display) font-extrabold tabular-nums text-[#1E9E6A] leading-tight">{money(left)}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted">Used of {money(total)}</div>
            <div className="text-[26px] font-(family-name:--font-display) font-extrabold tabular-nums text-tn-ink leading-tight">{money(used)}</div>
          </div>
        </div>

        <div className="mt-3.5 h-2 rounded-full bg-subtle overflow-hidden">
          <div className="h-full rounded-full bg-tn-teal" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1.5 text-[11.5px] text-muted">{pct}% used</div>
      </div>
    </Link>
  )
}

/** Publishing goals: did the last four weeks hit target, per board. */
function PublishingGoals() {
  return (
    <Link
      href="/dashboards/publishing"
      className="block rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-[0_1px_2px_rgba(1,35,88,.06)] transition-all hover:border-tn-teal hover:shadow-[0_10px_28px_-14px_rgba(1,35,88,.45)]"
    >
      <div className="flex items-center justify-between gap-3 bg-tn-primary px-5 py-3">
        <span className="font-(family-name:--font-display) font-extrabold text-[13px] text-white">Publishing goals</span>
        <span className="font-(family-name:--font-display) font-bold text-[12px] text-white/70">Last 4 weeks</span>
      </div>

      <div className="p-5 space-y-3.5">
        {BOARDS.map(b => {
          const hit = b.done >= b.target
          const pct = Math.min(100, Math.round((b.done / b.target) * 100))
          return (
            <div key={b.short}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-(family-name:--font-display) font-extrabold text-[13.5px] text-tn-ink">{b.name}</span>
                <span className="flex items-baseline gap-2">
                  <span className="text-[15px] font-(family-name:--font-display) font-extrabold tabular-nums text-tn-ink">{b.done}</span>
                  <span className="text-[12px] text-muted tabular-nums">of {b.target}</span>
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-(family-name:--font-display) font-bold px-2.5 py-0.5 rounded-full border ${
                    hit ? 'text-[#1E9E6A] bg-[#eafaf1] border-[#c3ead5]' : 'text-amber-700 bg-amber-50 border-amber-200'
                  }`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    {hit ? 'On target' : 'Behind'}
                  </span>
                </span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-subtle overflow-hidden">
                <div
                  className={`h-full rounded-full ${hit ? 'bg-[#1E9E6A]' : 'bg-[#e08a1e]'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </Link>
  )
}
