/**
 * Publishing goals on the Home page: the last four complete weeks, per client,
 * one row per week.
 *
 * Week by week rather than four weeks summed, because a four-week total that
 * meets its target can hide a week that missed badly, and the target is set per
 * week. The per-language split is what the dashboard behind this is for.
 *
 * The whole card is the link. A card with one small "open" link in the corner
 * gives a mouse a target the size of two words when the obvious target is the
 * card itself.
 *
 * It is only a link for people who can open the page behind it. The figures are
 * for everyone, but /dashboards/publishing is gated on its own tool grant, and a
 * card that looks clickable and bounces you to /tools is worse than a card that
 * never offered.
 */

import Link from 'next/link'
import type { PublishingBoardWeeks } from '@/lib/boards/publishing-weeks'

export function PublishingGoalsWidget(
  { boards, linked = false }: {
    boards: PublishingBoardWeeks[]
    /** Whether the reader may open the Publishing Goals page. */
    linked?: boolean
  },
) {
  if (boards.length === 0) return null

  const shell = 'block rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-[0_1px_2px_rgba(1,35,88,.06)]'

  // The card's contents, wrapped below in whichever of the two the reader gets.
  // Not a component defined here: one built during render is a new type on
  // every pass, which remounts its whole subtree.
  const inner = (
    <>
      <div className="flex items-center justify-between gap-3 bg-tn-primary px-5 py-3">
        <span className="font-(family-name:--font-display) font-extrabold text-lg text-white">Publishing goals</span>
        <span className="font-(family-name:--font-display) font-bold text-[12px] text-white/70">Last 4 weeks</span>
      </div>

      <div className="p-5 space-y-5">
        {boards.map(b => (
          <div key={b.boardId}>
            <div className="flex items-baseline justify-between gap-3 pb-2.5">
              <span className="font-(family-name:--font-display) font-extrabold text-[13.5px] text-tn-ink">{b.name}</span>
              {b.perWeek > 0 && (
                <span className="text-[11.5px] text-muted whitespace-nowrap">
                  <span className="font-bold text-tn-ink tabular-nums">{b.hits}/4</span> on target
                  <span> · {b.perWeek}/wk</span>
                </span>
              )}
            </div>

            {/* No target set is not the same as missing one, so it says so
                rather than drawing four empty bars against zero. */}
            {b.perWeek === 0 ? (
              <p className="text-[12px] text-muted m-0">No weekly target set for this board.</p>
            ) : (
              <div className="space-y-3">
                {b.weeks.map(w => {
                  const hit = w.done >= w.target
                  const pct = Math.round((w.done / w.target) * 100)
                  return (
                    // One line, left to right: which week, what was done
                    // against the target, what share of it that is, then the
                    // bar. Stacking the bar under the row put the date at one
                    // end of the screen and the figure at the other.
                    <div key={w.start} className="flex items-center gap-4">
                      <span className="w-[52px] shrink-0 text-[11.5px] text-muted tabular-nums">{w.label}</span>
                      <span className={`w-[54px] shrink-0 text-right text-[13px] font-(family-name:--font-display) font-extrabold tabular-nums ${hit ? 'text-[#1E9E6A]' : 'text-[#b06d0a]'}`}>
                        {w.done}/{w.target}
                      </span>
                      {/* The percentage is the headline and the count is the
                          working. Navy on every week: the bar and the count
                          already say pass or fail, and a 26px figure in amber
                          reads as an alarm rather than a measurement. */}
                      <span className="w-[74px] shrink-0 text-right text-[26px] leading-none font-(family-name:--font-display) font-extrabold tabular-nums text-tn-ink">
                        {pct}<span className="text-[15px]">%</span>
                      </span>
                      <span className="flex-1 h-2.5 rounded-full bg-subtle overflow-hidden">
                        <span
                          className={`block h-full rounded-full ${hit ? 'bg-[#1E9E6A]' : 'bg-[#e08a1e]'}`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )

  return linked
    ? (
      <Link
        href="/dashboards/publishing"
        className={`${shell} transition-all hover:border-tn-teal hover:shadow-[0_10px_28px_-14px_rgba(1,35,88,.45)]`}
      >
        {inner}
      </Link>
    )
    : <div className={shell}>{inner}</div>
}
