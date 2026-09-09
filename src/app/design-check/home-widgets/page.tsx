// Mockup: the Home page as sketched. Nothing here is wired up.
//
//   Hello            (welcome banner, full width)
//   i7 Budget        (full width, shorter than it is today)
//   Publishing goals | Birthdays
//   (tall)           | Anniversaries
//
// Publishing goals is the tall one because it is now four weeks per project
// rather than one figure per project, and four weeks of two projects is what
// sets its height. Birthdays and Anniversaries stack beside it to fill that.
//
// The three shortcut cards are gone. Static figures throughout: what is being
// decided is the shape and the wording.

import Link from 'next/link'
import { Anniversaries } from '@/components/home/Anniversaries'
import { Birthdays } from '@/components/home/Birthdays'
import type { CelebrationPerson } from '@/lib/hr/celebrations'

const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

/** Four Mondays, most recent last, with what was published against the weekly target. */
const WEEKS = ['Aug 11', 'Aug 18', 'Aug 25', 'Sep 1']
const BOARDS = [
  { name: 'AskAnAdventistFriend', perWeek: 9, done: [9, 11, 7, 14] },
  { name: 'Hope for Africa', perWeek: 8, done: [6, 8, 5, 3] },
]

// Enough of a person for the two real widgets to draw themselves.
const PEOPLE: CelebrationPerson[] = [
  { id: '1', name: 'Cheyenne Wilson', avatarUrl: null, hireDate: '2021-09-14', dob: '1990-09-06', teamName: 'Writing', teamKey: 'writing', color: '#e08a1e' },
  { id: '2', name: 'Kevin Ames', avatarUrl: null, hireDate: '2019-09-02', dob: '1985-09-21', teamName: 'SEO', teamKey: 'seo', color: '#1E7D7F' },
  { id: '3', name: 'Wendy Cacka', avatarUrl: null, hireDate: '2023-09-25', dob: '1988-09-30', teamName: 'Web', teamKey: 'web', color: '#6d5ae0' },
]

export default function HomeWidgetsMockup() {
  return (
    <div className="min-h-screen bg-[var(--page-bg,#efedE8)] px-6 py-10">
      <div className="max-w-[1400px] mx-auto space-y-8">
        <div>
          <p className="text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.14em] text-tn-teal m-0">Mockup, not built</p>
          <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">Home, as sketched</h1>
          <p className="mt-1.5 text-muted leading-relaxed m-0">
            Shortcut cards gone. i7 full width and shorter. Publishing goals tall on the left,
            four weeks per project, with Birthdays and Anniversaries stacked beside it.
          </p>
        </div>

        {/* Hello */}
        <div className="rounded-2xl bg-tn-primary px-7 py-6 text-white">
          <div className="font-(family-name:--font-display) font-extrabold text-[22px]">Good afternoon, Arnaldo</div>
          <div className="text-white/70 text-[13.5px] mt-1">One home for the tools, dashboards and tasks that keep your team moving every day.</div>
        </div>

        <I7Half />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <PublishingGoals />
          <div className="space-y-6">
            <Birthdays people={PEOPLE} />
            <Anniversaries people={PEOPLE} />
          </div>
        </div>

        <p className="text-[13px] text-muted leading-relaxed max-w-[72ch]">
          Both new cards are one link each, so there is no separate &ldquo;Open report&rdquo;. The i7
          card keeps its navy header and the two figures worth reading, and drops the animated
          counting bar, which is what made it tall.
        </p>
      </div>
    </div>
  )
}

/** Full width, but short: two figures and a thin meter instead of the animation. */
function I7Half() {
  const total = 75047.38
  const used = 7577.92
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
      <div className="px-5 py-4 flex items-center gap-8 flex-wrap">
        <div>
          <div className="text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted">Balance left</div>
          <div className="text-[24px] font-(family-name:--font-display) font-extrabold tabular-nums text-[#1E9E6A] leading-tight">{money(total - used)}</div>
        </div>
        <div>
          <div className="text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted">Used of {money(total)}</div>
          <div className="text-[24px] font-(family-name:--font-display) font-extrabold tabular-nums text-tn-ink leading-tight">{money(used)}</div>
        </div>
        <div className="flex-1 min-w-[180px]">
          <div className="h-2 rounded-full bg-subtle overflow-hidden">
            <div className="h-full rounded-full bg-tn-teal" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1.5 text-[11.5px] text-muted">{pct}% used</div>
        </div>
      </div>
    </Link>
  )
}

/** Four weeks per project, each week against that project's weekly target. */
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

      <div className="p-5 space-y-5">
        {BOARDS.map(b => {
          const hits = b.done.filter(d => d >= b.perWeek).length
          return (
            <div key={b.name}>
              <div className="flex items-baseline justify-between gap-3 pb-2.5">
                <span className="font-(family-name:--font-display) font-extrabold text-[13.5px] text-tn-ink">{b.name}</span>
                <span className="text-[11.5px] text-muted">
                  <span className="font-bold text-tn-ink tabular-nums">{hits} of 4</span> weeks on target
                  <span className="text-muted"> · {b.perWeek}/wk</span>
                </span>
              </div>

              {/* A row per week rather than one figure for the four, which is
                  what hides a bad week inside a good month. */}
              <div className="space-y-1.5">
                {b.done.map((done, i) => {
                  const hit = done >= b.perWeek
                  const pct = Math.min(100, Math.round((done / b.perWeek) * 100))
                  return (
                    <div key={WEEKS[i]} className="flex items-center gap-3">
                      <span className="w-[54px] shrink-0 text-[11.5px] text-muted tabular-nums">{WEEKS[i]}</span>
                      <span className="flex-1 h-2 rounded-full bg-subtle overflow-hidden">
                        <span
                          className={`block h-full rounded-full ${hit ? 'bg-[#1E9E6A]' : 'bg-[#e08a1e]'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                      <span className={`w-[46px] shrink-0 text-right text-[12px] tabular-nums font-semibold ${hit ? 'text-[#1E9E6A]' : 'text-[#b06d0a]'}`}>
                        {done}/{b.perWeek}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </Link>
  )
}
