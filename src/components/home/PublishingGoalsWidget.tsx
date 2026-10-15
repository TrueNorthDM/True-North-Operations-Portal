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
 * The total is "Targeted languages" (audit, 10 October 2026): it only ever
 * counted languages with a target, and "All languages" said otherwise. Pages in
 * a language with no target that week sit beside it as "+2 other", never added
 * to the score.
 *
 * The full per-language split is still what the dashboard behind this is for.
 *
 * A board counted in two-week cycles (Bessemeters, 15 October 2026) shows its
 * last two complete cycles instead, one row each ("Sep 29 to Oct 12", "1 of
 * 1"), or the day its first cycle ends while none has. Its English column
 * shows only when English is not the whole target, as it is not for a board
 * that publishes in English alone: the same figure twice says nothing.
 *
 * The whole card is the link. A card with one small "open" link in the corner
 * gives a mouse a target the size of two words when the obvious target is the
 * card itself. The link carries a short name of its own, so a screen reader
 * says "Publishing goals, open the dashboard" instead of reading every figure
 * on the card as the name of the link (audit, 10 October 2026).
 *
 * It is only a link for people who can open the page behind it. The figures are
 * for everyone, but /ops/publishing is gated on its own tool grant, and a
 * card that looks clickable and bounces you away is worse than a card that
 * never offered.
 */

import Link from 'next/link'
import type { PublishingBoardWeeks } from '@/lib/boards/publishing-weeks'
import { shortDay } from '@/lib/boards/publishing-cycles'
import { ROUTES } from '@/lib/nav/routes'

/**
 * Text colours that reach 4.5:1 on white (audit, 10 October 2026). The old
 * #1E9E6A (3.4:1) and #b06d0a (4.2:1) failed on the 11.5 to 13px figures they
 * coloured. The bars are not text and keep the brighter shades.
 */
export const GREEN = '#167a52'
export const AMBER = '#9a5a00'
const GREEN_BAR = '#1E9E6A'
const AMBER_BAR = '#e08a1e'

const colour = (done: number, target: number) => (done >= target ? GREEN : AMBER)

const NY = 'America/New_York'

/**
 * "Updated Oct 9, 3:05 PM", New York. The time the older of the two boards was
 * last read, so the card never claims to be fresher than its stalest half.
 * Exported for its test.
 */
export function updatedLabel(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const day = d.toLocaleDateString('en-US', { timeZone: NY, month: 'short', day: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { timeZone: NY, hour: 'numeric', minute: '2-digit' })
  return `Updated ${day}, ${time}`
}

/** "2 pages in languages with no target". Exported for its test. */
export function otherText(n: number): string {
  return `${n} ${n === 1 ? 'page' : 'pages'} in languages with no target`
}

/**
 * Whether the English column says anything: only when some row has an
 * English target that is not the whole of it. Exported for its test.
 */
export function showsEnglish(b: PublishingBoardWeeks): boolean {
  return b.weeks.some(w => w.en && w.en.target < w.target)
}

const shell = 'block rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-[0_1px_2px_rgba(1,35,88,.06)]'

function Header({ cycles = false }: { cycles?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-tn-primary px-5 py-3">
      <h2 className="m-0 font-(family-name:--font-display) font-extrabold text-lg text-white">Publishing goals</h2>
      <span className="font-(family-name:--font-display) font-bold text-[12px] text-white/70">{cycles ? 'Last 4 weeks · last 2 cycles' : 'Last 4 weeks'}</span>
    </div>
  )
}

export function PublishingGoalsWidget(
  { data, linked = false }: {
    /** null when the read failed: the card says so instead of disappearing. */
    data: { boards: PublishingBoardWeeks[]; updatedAt: string | null } | null
    /** Whether the reader may open the Publishing Goals page. */
    linked?: boolean
  },
) {
  // A failed read shows as a card that says so, never as zeros and never as
  // nothing at all, the way the i7 card on Home reports "unavailable"
  // (audit, 10 October 2026).
  if (data === null) {
    return (
      <div className={shell}>
        <Header />
        <p role="status" className="m-0 px-5 py-4 text-[13.5px] text-muted">
          Publishing goals could not be read. Try again in a moment.
        </p>
      </div>
    )
  }

  const { boards, updatedAt } = data
  if (boards.length === 0) return null
  const updated = updatedLabel(updatedAt)

  // The card's contents, wrapped below in whichever of the two the reader gets.
  // Not a component defined here: one built during render is a new type on
  // every pass, which remounts its whole subtree.
  const inner = (
    <>
      <Header cycles={boards.some(b => b.cycleWeeks === 2)} />

      <div className="p-5 space-y-5">
        {boards.map(b => {
          const cycles = b.cycleWeeks === 2
          const english = showsEnglish(b)
          // "Sep 29 to Oct 12" needs more room than "Aug 31-Sep 6".
          const labelW = cycles ? 'w-[112px]' : 'w-[76px]'
          return (
          <div key={b.boardId}>
            <div className="flex items-baseline justify-between gap-3 pb-2">
              <span className="font-(family-name:--font-display) font-extrabold text-[13.5px] text-tn-ink">
                {b.name}
                {cycles && <span className="ml-2 font-(family-name:--font-body) font-semibold text-[11.5px] text-muted">every 2 weeks</span>}
              </span>
              {b.perPeriod > 0 && (
                <span className="text-[11.5px] text-muted whitespace-nowrap">
                  <span className="font-bold text-tn-ink tabular-nums">{b.hits}/{b.weeks.length}</span> on target
                  {english && (
                    <span> · <span className="font-bold tabular-nums" style={{ color: colour(b.enHits, b.weeks.length) }}>{b.enHits}/{b.weeks.length}</span> EN</span>
                  )}
                </span>
              )}
            </div>

            {/* No target set is not the same as missing one, so it says so
                rather than drawing four empty bars against zero. A new board
                in cycles has nothing complete yet and says when it will. */}
            {b.firstCycleEnds ? (
              <p className="text-[12px] text-muted m-0">First cycle ends {shortDay(b.firstCycleEnds)}</p>
            ) : b.perPeriod === 0 ? (
              <p className="text-[12px] text-muted m-0">{cycles ? 'No target set for this board.' : 'No weekly target set for this board.'}</p>
            ) : (
              <>
                {/* The columns need naming once: "9/11 82% 0/2 0%" on its own
                    is four numbers in a row with nothing saying which is which. */}
                <div className="flex items-center gap-4 pb-1.5">
                  <span className={`${labelW} shrink-0`} />
                  <span className="w-[164px] shrink-0 text-right text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted">
                    Targeted languages
                  </span>
                  {english && (
                    <span className="w-[96px] shrink-0 text-right text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted">
                      English
                    </span>
                  )}
                  <span className="flex-1" />
                </div>

                <div className="space-y-3">
                  {b.weeks.map(w => {
                    // The target can differ week to week now (a past week keeps
                    // the target it had), and a week with none is 0, not NaN.
                    const pct = w.target > 0 ? Math.round((w.done / w.target) * 100) : 0
                    return (
                      <div key={w.start} className="flex items-center gap-4">
                        <span className={`${labelW} shrink-0 text-[11.5px] text-muted tabular-nums whitespace-nowrap`}>{w.label}</span>

                        {/* The percentage is the headline and the count is the
                            working. Navy on every week: the bar and the count
                            already say pass or fail, and a 26px figure in amber
                            reads as an alarm rather than a measurement. */}
                        <span className="w-[164px] shrink-0 flex items-baseline justify-end gap-2">
                          {w.untargeted > 0 && (
                            <span className="text-[11px] text-muted tabular-nums whitespace-nowrap" title={otherText(w.untargeted)}>
                              <span aria-hidden="true">+{w.untargeted} other</span>
                              <span className="sr-only">{otherText(w.untargeted)}</span>
                            </span>
                          )}
                          <span
                            className="text-[13px] font-(family-name:--font-display) font-extrabold tabular-nums whitespace-nowrap"
                            style={{ color: colour(w.done, w.target) }}
                          >
                            {cycles ? `${w.done} of ${w.target}` : `${w.done}/${w.target}`}
                          </span>
                          <span className="text-[26px] leading-none font-(family-name:--font-display) font-extrabold tabular-nums text-tn-ink">
                            {pct}<span className="text-[15px]">%</span>
                          </span>
                        </span>

                        {english && w.en && (
                          <span className="w-[96px] shrink-0 flex items-baseline justify-end gap-1.5 border-l border-slate-200 pl-3">
                            <span
                              className="text-[11.5px] font-bold tabular-nums"
                              style={{ color: colour(w.en.done, w.en.target) }}
                            >
                              {w.en.done}/{w.en.target}
                            </span>
                            <span className="text-[17px] leading-none font-(family-name:--font-display) font-extrabold tabular-nums text-tn-ink">
                              {w.en.target > 0 ? Math.round((w.en.done / w.en.target) * 100) : 0}<span className="text-[11px]">%</span>
                            </span>
                          </span>
                        )}
                        {/* A row with no English target keeps the column's
                            place, so the bars stay lined up. */}
                        {english && !w.en && <span className="w-[96px] shrink-0" />}

                        {/* The bar tracks the total. English has its own figures
                            and reading it as a segment here would conflate its
                            share of the week with whether it met its own target,
                            which are different numbers. */}
                        <span className="flex-1 h-2.5 rounded-full bg-subtle overflow-hidden">
                          <span
                            className="block h-full rounded-full"
                            style={{ width: `${Math.min(100, pct)}%`, background: w.done >= w.target ? GREEN_BAR : AMBER_BAR }}
                          />
                        </span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
          )
        })}
      </div>

      {updated && (
        <div className="border-t border-slate-100 px-5 py-2.5 text-[11.5px] text-muted">{updated}</div>
      )}
    </>
  )

  return linked
    ? (
      <Link
        href={ROUTES.publishing}
        aria-label="Publishing goals, open the dashboard"
        className={`${shell} transition-all hover:border-tn-teal hover:shadow-[0_10px_28px_-14px_rgba(1,35,88,.45)]`}
      >
        {inner}
      </Link>
    )
    : <div className={shell}>{inner}</div>
}
