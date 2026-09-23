/**
 * Publishing goals on the Home page: the last four complete weeks, per client,
 * one row per week.
 *
 * Week by week rather than four weeks summed, because a four-week total that
 * meets its target can hide a week that missed badly, and the target is set per
 * week.
 *
 * English gets its own column for the same reason one step down. The board
 * total lets one language cover another: in the week of 24 August,
 * AskAnAdventistFriend published 15 against a target of 11 while English sat at
 * 0 of 2, and three overachieving translations hid it completely. English is
 * only 2 of that board's 11, so it is deliberately the smaller figure: it has
 * to be visible without pretending to be half the story.
 *
 * The full per-language split is still what the dashboard behind this is for.
 *
 * The whole card is the link. A card with one small "open" link in the corner
 * gives a mouse a target the size of two words when the obvious target is the
 * card itself.
 *
 * It is only a link for people who can open the page behind it. The figures are
 * for everyone, but /ops/publishing is gated on its own tool grant, and a
 * card that looks clickable and bounces you away is worse than a card that
 * never offered.
 */

import Link from 'next/link'
import type { PublishingBoardWeeks } from '@/lib/boards/publishing-weeks'
import { ROUTES } from '@/lib/nav/routes'

const GREEN = '#1E9E6A'
const AMBER = '#b06d0a'
const AMBER_BAR = '#e08a1e'

const colour = (done: number, target: number) => (done >= target ? GREEN : AMBER)

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
            <div className="flex items-baseline justify-between gap-3 pb-2">
              <span className="font-(family-name:--font-display) font-extrabold text-[13.5px] text-tn-ink">{b.name}</span>
              {b.perWeek > 0 && (
                <span className="text-[11.5px] text-muted whitespace-nowrap">
                  <span className="font-bold text-tn-ink tabular-nums">{b.hits}/4</span> on target
                  {b.enPerWeek > 0 && (
                    <span> · <span className="font-bold tabular-nums" style={{ color: colour(b.enHits, 4) }}>{b.enHits}/4</span> EN</span>
                  )}
                </span>
              )}
            </div>

            {/* No target set is not the same as missing one, so it says so
                rather than drawing four empty bars against zero. */}
            {b.perWeek === 0 ? (
              <p className="text-[12px] text-muted m-0">No weekly target set for this board.</p>
            ) : (
              <>
                {/* The columns need naming once: "9/11 82% 0/2 0%" on its own
                    is four numbers in a row with nothing saying which is which. */}
                <div className="flex items-center gap-4 pb-1.5">
                  <span className="w-[76px] shrink-0" />
                  <span className="w-[128px] shrink-0 text-right text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted">
                    All languages
                  </span>
                  {b.enPerWeek > 0 && (
                    <span className="w-[96px] shrink-0 text-right text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted">
                      English
                    </span>
                  )}
                  <span className="flex-1" />
                </div>

                <div className="space-y-3">
                  {b.weeks.map(w => {
                    const pct = Math.round((w.done / w.target) * 100)
                    return (
                      <div key={w.start} className="flex items-center gap-4">
                        <span className="w-[76px] shrink-0 text-[11.5px] text-muted tabular-nums whitespace-nowrap">{w.label}</span>

                        {/* The percentage is the headline and the count is the
                            working. Navy on every week: the bar and the count
                            already say pass or fail, and a 26px figure in amber
                            reads as an alarm rather than a measurement. */}
                        <span className="w-[128px] shrink-0 flex items-baseline justify-end gap-2">
                          <span
                            className="text-[13px] font-(family-name:--font-display) font-extrabold tabular-nums"
                            style={{ color: colour(w.done, w.target) }}
                          >
                            {w.done}/{w.target}
                          </span>
                          <span className="text-[26px] leading-none font-(family-name:--font-display) font-extrabold tabular-nums text-tn-ink">
                            {pct}<span className="text-[15px]">%</span>
                          </span>
                        </span>

                        {w.en && (
                          <span className="w-[96px] shrink-0 flex items-baseline justify-end gap-1.5 border-l border-slate-200 pl-3">
                            <span
                              className="text-[11.5px] font-bold tabular-nums"
                              style={{ color: colour(w.en.done, w.en.target) }}
                            >
                              {w.en.done}/{w.en.target}
                            </span>
                            <span className="text-[17px] leading-none font-(family-name:--font-display) font-extrabold tabular-nums text-tn-ink">
                              {Math.round((w.en.done / w.en.target) * 100)}<span className="text-[11px]">%</span>
                            </span>
                          </span>
                        )}

                        {/* The bar tracks the total. English has its own figures
                            and reading it as a segment here would conflate its
                            share of the week with whether it met its own target,
                            which are different numbers. */}
                        <span className="flex-1 h-2.5 rounded-full bg-subtle overflow-hidden">
                          <span
                            className="block h-full rounded-full"
                            style={{ width: `${Math.min(100, pct)}%`, background: w.done >= w.target ? GREEN : AMBER_BAR }}
                          />
                        </span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </>
  )

  return linked
    ? (
      <Link
        href={ROUTES.publishing}
        className={`${shell} transition-all hover:border-tn-teal hover:shadow-[0_10px_28px_-14px_rgba(1,35,88,.45)]`}
      >
        {inner}
      </Link>
    )
    : <div className={shell}>{inner}</div>
}
