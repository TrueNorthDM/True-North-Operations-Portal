/**
 * Publishing goals on the Home page: the last five complete weeks, per client
 * (Home redesign, owner, 25 October 2026; Design/design_handoff_home, section 6).
 *
 * Week by week rather than five weeks summed, because a total that meets its
 * target can hide a week that missed badly, and the target is set per week.
 *
 * English comes first and gets a chart of its own, as a percentage of its
 * target, because the board total lets one language cover another: in the
 * week of 24 August, AskAnAdventistFriend published 15 against a target of 11
 * while English sat at 0 of 2, and three overachieving translations hid it
 * completely. Every other language with a target gets a row: its target, a
 * sparkline, the five weeks as "done/target" and a pill counting the weeks it
 * met. Pages in a language with no target are no longer drawn: the design
 * counts targets only, and the dashboard behind the card still shows them.
 *
 * The two weekly clients sit side by side, and stack below lg. A board counted
 * in two-week cycles (Bessemeters, 15 October 2026) gets a full-width row under
 * them: its last five complete cycles, or, before the first one ends, that
 * cycle so far and the day it ends.
 *
 * The whole card is the link. A card with one small "open" link in the corner
 * gives a mouse a target the size of two words when the obvious target is the
 * card itself. The link carries a short name of its own, so a screen reader
 * says "Publishing goals, open the dashboard" instead of reading every figure
 * on the card as the name of the link (audit, 10 October 2026).
 *
 * It is only a link for people who can open the page behind it. The figures are
 * for everyone the page shows them to, but /ops/publishing is gated on its own
 * tool grant, and a card that looks clickable and bounces you away is worse
 * than a card that never offered.
 */

import Link from 'next/link'
import type { PublishingBoardWeeks, PublishingWeek } from '@/lib/boards/publishing-weeks'
import { shortDay } from '@/lib/boards/publishing-cycles'
import { addDays } from '@/lib/notifications/schedule'
import { codeFromInput } from '@/lib/language-display'
import { ROUTES } from '@/lib/nav/routes'

/**
 * Text colours that reach 4.5:1 on white (audit, 10 October 2026). The old
 * #1E9E6A (3.4:1) and #b06d0a (4.2:1) failed on the 11.5 to 13px figures they
 * coloured. The bars and dots are not text and keep the brighter shades.
 */
export const GREEN = '#167a52'
export const AMBER = '#9a5a00'
export const RED = '#c8323d'
const GREEN_BAR = '#1E9E6A'
const AMBER_BAR = '#e08a1e'

const NY = 'America/New_York'
const ENGLISH = 'English'

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

/**
 * The colour of a "3/5" score in a header: green when every row but one or
 * more met the target, amber otherwise (the prototype's rule). With a single
 * row, "all but one" would be none, so one row needs its one hit.
 */
export function scoreColour(hits: number, rows: number): string {
  return rows > 0 && hits >= Math.max(1, rows - 1) ? GREEN : AMBER
}

/** "ES" for Spanish: the site's own code where it knows one, else the first two letters. */
export function langCode(lang: string): string {
  return (codeFromInput(lang) ?? lang.slice(0, 2)).toUpperCase()
}

/** "Sep 28-Oct 11", "Aug 17-30": a cycle by its Monday, for the cycle cells. */
export function cycleSpan(monday: string): string {
  const end = addDays(monday, 13)
  return `${shortDay(monday)}-${end.slice(5, 7) === monday.slice(5, 7) ? Number(end.slice(8, 10)) : shortDay(end)}`
}

/** "Oct 12 to 25": the first cycle, for its one line. */
function firstSpan(c: PublishingWeek): string {
  const end = addDays(c.start, 13)
  return `${shortDay(c.start)} to ${end.slice(5, 7) === c.start.slice(5, 7) ? Number(end.slice(8, 10)) : shortDay(end)}`
}

/** "Ends Sun, Oct 25". */
function endsText(monday: string): string {
  const end = addDays(monday, 13)
  const wd = new Date(`${end}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short' })
  return `Ends ${wd}, ${shortDay(end)}`
}

const pct = (done: number, target: number) => (target > 0 ? Math.round((done / target) * 100) : 0)

/* The English chart, in the prototype's own units: a 330 by 150 box drawn
   to the column's width, 22px clear above for the figures and 10px below,
   the scale from 0 to 150% (higher is clamped to the top), the first and
   last points 16 units in from the ends. */
const CW = 330, CH = 150, CTOP = 22, CBOT = 10, CMAX = 150

const chartY = (p: number) => CTOP + (1 - Math.min(p, CMAX) / CMAX) * (CH - CTOP - CBOT)

/**
 * The English chart for a board: one point per week that had an English
 * target, the line and the area under it. Exported for its test.
 */
export function englishChart(weeks: PublishingWeek[]) {
  const n = weeks.length
  const x = (i: number) => (n > 1 ? 16 + (i * (CW - 32)) / (n - 1) : CW / 2)
  const pts = weeks.flatMap((w, i) => {
    if (!w.en) return []
    const p = pct(w.en.done, w.en.target)
    return [{
      key: w.start,
      x: x(i),
      left: `${((x(i) / CW) * 100).toFixed(2)}%`,
      y: chartY(p),
      value: `${p}%`,
      week: shortDay(w.start),
      colour: p >= 100 ? GREEN : p > 0 ? AMBER : RED,
    }]
  })
  const path = pts.length ? 'M' + pts.map(p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L') : ''
  const area = pts.length ? `${path} L${pts[pts.length - 1].x} ${CH - CBOT} L${pts[0].x} ${CH - CBOT} Z` : ''
  return { pts, path, area, line100: chartY(100), labels: weeks.map((w, i) => ({ key: w.start, left: `${((x(i) / CW) * 100).toFixed(2)}%`, week: shortDay(w.start) })) }
}

/**
 * The languages that get a row: every one but English that had a target in
 * any of the weeks, in the order of the latest week that has them (the data's
 * order: larger targets first, then by name).
 */
function otherLangs(weeks: PublishingWeek[]): { lang: string; target: number }[] {
  const seen = new Map<string, number>()
  for (let i = weeks.length - 1; i >= 0; i--) {
    for (const l of weeks[i].langs) if (l.lang !== ENGLISH && !seen.has(l.lang)) seen.set(l.lang, l.target)
  }
  return [...seen].map(([lang, target]) => ({ lang, target }))
}

/** A week cell's colours: met, part, none. A week with no target for the language is neutral. */
function cellColours(done: number, target: number): [string, string] {
  if (target <= 0) return ['#f1f3f6', '#8593a4']
  return done >= target ? ['#d6f0e3', GREEN] : done > 0 ? ['#fbe9cf', AMBER] : ['#fbe1e1', RED]
}

const dotColour = (done: number, target: number) =>
  target <= 0 ? '#cbd2da' : done >= target ? GREEN_BAR : done > 0 ? AMBER_BAR : RED

function LangRow({ lang, target, weeks, hits }: { lang: string; target: number; weeks: PublishingWeek[]; hits: number }) {
  const n = weeks.length
  const cells = weeks.map(w => {
    const l = w.langs.find(x => x.lang === lang)
    return { key: w.start, done: l?.done ?? 0, target: l?.target ?? 0 }
  })
  // The sparkline, 104 by 26: the target line dashed, the weeks in teal.
  const sx = (i: number) => (n > 1 ? 4 + (i * 96) / (n - 1) : 52)
  const mx = Math.max(target * 1.5, ...cells.map(c => c.done), 1)
  const sy = (v: number) => 23 - (v / mx) * 20
  const path = 'M' + cells.map((c, i) => `${sx(i)} ${sy(c.done).toFixed(1)}`).join(' L')
  const [pillBg, pillFg] = hits === n ? ['#e6f6ee', GREEN] : hits >= 2 ? ['#fdf3e3', AMBER] : ['#fdeeef', RED]
  return (
    // Below sm the sparkline gives its room to the five cells, which carry
    // the same figures.
    <div className="grid grid-cols-[52px_minmax(0,1fr)_auto] sm:grid-cols-[52px_104px_minmax(0,1fr)_auto] gap-3.5 items-center py-[7px] border-b border-[#f1f3f6]">
      <span title={lang} className="flex flex-col leading-[1.2]">
        <span className="font-(family-name:--font-display) font-extrabold text-[12.5px] text-tn-ink">{langCode(lang)}</span>
        <span className="text-[11px] text-muted">{target}/wk</span>
      </span>
      <span className="relative h-[26px] hidden sm:block" aria-hidden="true">
        <svg width="104" height="26" viewBox="0 0 104 26" className="absolute inset-0 overflow-visible">
          <path d={`M0 ${sy(target).toFixed(1)} H104`} stroke="#d6dbe3" strokeWidth="1" strokeDasharray="3 3" fill="none" />
          <path d={path} fill="none" stroke="#1E7D7F" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
        {cells.map((c, i) => (
          <span
            key={c.key}
            className="absolute w-1.5 h-1.5 rounded-full -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${sx(i)}px`, top: `${sy(c.done)}px`, background: dotColour(c.done, c.target) }}
          />
        ))}
      </span>
      <span className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.max(n, 1)}, minmax(0, 1fr))` }}>
        {cells.map(c => {
          const [bg, fg] = cellColours(c.done, c.target)
          return (
            <span
              key={c.key}
              title={c.target > 0 ? undefined : 'No target that week'}
              className="h-6 rounded-md flex items-center justify-center text-[11.5px] font-bold tabular-nums"
              style={{ background: bg, color: fg }}
            >
              {c.target > 0 ? `${c.done}/${c.target}` : '-'}
            </span>
          )
        })}
      </span>
      <span className="text-[12px] font-extrabold rounded-full px-2 py-0.5 tabular-nums" style={{ background: pillBg, color: pillFg }}>
        {hits}/{n}
      </span>
    </div>
  )
}

function ClientColumn({ b, className }: { b: PublishingBoardWeeks; className: string }) {
  const n = b.weeks.length
  const english = b.weeks.some(w => w.en)
  const chart = english ? englishChart(b.weeks) : null
  return (
    <div className={`px-6 py-5 flex flex-col gap-3.5 ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-(family-name:--font-display) font-extrabold text-[16px] text-tn-ink">{b.name}</span>
        {b.perPeriod > 0 && (
          <span className="text-[12.5px] text-muted text-right">
            {english && (
              <>
                <b className="tabular-nums" style={{ color: scoreColour(b.enHits, n) }}>{b.enHits}/{n}</b> weeks English on target ·{' '}
              </>
            )}
            <b className="tabular-nums text-tn-ink">{b.hits}/{n}</b> all languages
          </span>
        )}
      </div>

      {/* No target set is not the same as missing one, so it says so rather
          than drawing five empty weeks against zero. */}
      {b.perPeriod === 0 ? (
        <p className="text-[12px] text-muted m-0">No weekly target set for this board.</p>
      ) : (
        <div className="flex flex-col gap-[18px]">
          {chart && (
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-(family-name:--font-display) font-extrabold text-[11px] tracking-[.08em] uppercase text-tn-ink">English</span>
                <span className="text-[12px] text-muted">{b.enPerPeriod} a week</span>
              </div>
              <div className="relative h-[150px] mt-2">
                <div className="absolute left-0 right-0 border-t-[1.5px] border-dashed border-[#c9d1dc]" style={{ top: `${chart.line100}px` }} />
                <svg viewBox={`0 0 ${CW} ${CH}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-[150px] overflow-visible" aria-hidden="true">
                  <path d={chart.area} fill="rgba(1,35,88,.06)" />
                  <path d={chart.path} fill="none" stroke="#012358" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                </svg>
                {chart.pts.map(p => (
                  <div key={p.key} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: p.left, top: `${p.y}px` }}>
                    <div
                      className="w-3 h-3 rounded-full box-border border-[2.5px] border-white"
                      style={{ background: p.colour, boxShadow: `0 0 0 1.5px ${p.colour}` }}
                    />
                    <span
                      className="absolute left-1/2 bottom-4 -translate-x-1/2 font-(family-name:--font-display) font-extrabold text-[12.5px] whitespace-nowrap tabular-nums"
                      style={{ color: p.colour }}
                    >
                      {p.value}
                    </span>
                  </div>
                ))}
              </div>
              <div className="relative h-[18px] mt-1.5">
                {chart.labels.map(l => (
                  <span key={l.key} className="absolute -translate-x-1/2 text-[11px] text-muted whitespace-nowrap" style={{ left: l.left }}>{l.week}</span>
                ))}
              </div>
            </div>
          )}
          {/* A board with no English target has no chart, and every one of
              its languages is a row. */}
          <div className="flex flex-col">
            {otherLangs(b.weeks).map(l => (
              <LangRow key={l.lang} lang={l.lang} target={l.target} weeks={b.weeks} hits={b.langHits[l.lang] ?? 0} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** "English · every 2 weeks · 2 per cycle", from the row's own languages and target. */
function cycleRule(row: PublishingWeek | undefined, perCycle: number): string {
  const langs = (row?.langs ?? []).map(l => l.lang).join(', ')
  return `${langs ? `${langs} · ` : ''}every 2 weeks · ${perCycle} per cycle`
}

function CycleRow({ b }: { b: PublishingBoardWeeks }) {
  // Before the first cycle ends: one line, the cycle so far and the day it ends.
  if (b.weeks.length === 0 && b.firstCycle) {
    const c = b.firstCycle
    const met = c.target > 0 && c.done >= c.target
    return (
      <div className="px-6 py-4 border-b border-[#eceff3] flex items-center gap-6 flex-wrap">
        <div className="flex flex-col gap-[3px] min-w-[170px]">
          <span className="font-(family-name:--font-display) font-extrabold text-[16px] text-tn-ink">{b.name}</span>
          <span className="text-[12px] text-muted">{cycleRule(c, c.target)}</span>
        </div>
        <div className="flex-1 min-w-[240px] flex flex-col gap-1.5">
          <div className="flex justify-between text-[12px]">
            <span className="text-[#5b6b82]">First cycle, {firstSpan(c)}</span>
            <b className="tabular-nums" style={{ color: met ? GREEN : AMBER }}>{c.done} of {c.target} so far</b>
          </div>
          <div className="h-2 rounded-full bg-[#eef0f3] overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct(c.done, c.target))}%`, background: met ? GREEN_BAR : AMBER_BAR }} />
          </div>
        </div>
        <span className="text-[12px] font-bold rounded-full px-[11px] py-1 bg-[#fdeeef] text-[#c8323d] whitespace-nowrap">{endsText(c.start)}</span>
      </div>
    )
  }

  const n = b.weeks.length
  return (
    <div className="px-6 pt-[18px] pb-5 border-b border-[#eceff3] flex flex-col gap-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex items-baseline gap-2.5 flex-wrap">
          <span className="font-(family-name:--font-display) font-extrabold text-[16px] text-tn-ink">{b.name}</span>
          <span className="text-[12.5px] text-muted">{cycleRule(b.weeks[n - 1], b.perPeriod)}</span>
        </span>
        {b.perPeriod > 0 && (
          <span className="text-[12.5px] text-muted whitespace-nowrap">
            <b className="tabular-nums" style={{ color: scoreColour(b.hits, n) }}>{b.hits}/{n}</b> cycles on target
          </span>
        )}
      </div>
      {b.perPeriod === 0 ? (
        <p className="text-[12px] text-muted m-0">No target set for this board.</p>
      ) : (
        // Five across from md; below it two, so "Sep 28-Oct 11" keeps one line.
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {b.weeks.map(w => {
            const met = w.target > 0 && w.done >= w.target
            const p = pct(w.done, w.target)
            return (
              <div key={w.start} className="flex flex-col gap-[7px] rounded-xl px-3.5 py-3" style={{ background: met ? '#f1f9f5' : '#fdf6ea' }}>
                <span className="text-[11.5px] text-[#5b6b82] whitespace-nowrap">{cycleSpan(w.start)}</span>
                <span className="flex items-baseline gap-[7px]">
                  <span className="font-(family-name:--font-display) font-black text-[22px] leading-none text-tn-ink tabular-nums">
                    {p}<span className="text-[13px]">%</span>
                  </span>
                  <span className="text-[12px] font-extrabold tabular-nums" style={{ color: met ? GREEN : AMBER }}>{w.done} of {w.target}</span>
                </span>
                <span className="h-1.5 rounded-full bg-[rgba(1,35,88,.08)] overflow-hidden">
                  <span className="block h-full rounded-full" style={{ width: `${Math.min(100, p)}%`, background: met ? GREEN_BAR : AMBER_BAR }} />
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// The prototype's text sits at the browser's normal line height, not the
// portal's 1.5; measured against it, the card is 22px taller without this.
const shell = 'block bg-white border border-[#e4e7ec] rounded-[18px] overflow-hidden leading-[normal]'

function Header() {
  return (
    <div className="flex items-center justify-between gap-3 bg-tn-primary px-6 py-3.5">
      <h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[18px] text-white">Publishing goals</h2>
      <span className="font-(family-name:--font-display) font-bold text-[12px] text-white/70">Last 5 weeks</span>
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
        <p role="status" className="m-0 px-6 py-4 text-[13.5px] text-muted">
          Publishing goals could not be read. Try again in a moment.
        </p>
      </div>
    )
  }

  const { boards, updatedAt } = data
  if (boards.length === 0) return null
  const updated = updatedLabel(updatedAt)
  const weekly = boards.filter(b => b.cycleWeeks === 1)
  const cycled = boards.filter(b => b.cycleWeeks === 2)
  // The lg row a column sits in: the last row takes no rule under it, and the
  // left of each pair takes the 1px rule between the two.
  const lastRowFrom = weekly.length - (weekly.length % 2 || 2)

  // The card's contents, wrapped below in whichever of the two the reader gets.
  // Not a component defined here: one built during render is a new type on
  // every pass, which remounts its whole subtree.
  const inner = (
    <>
      <Header />
      {weekly.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 border-b border-[#eceff3]">
          {weekly.map((b, i) => (
            <ClientColumn
              key={b.boardId}
              b={b}
              className={[
                'border-[#eceff3]',
                i < weekly.length - 1 ? 'border-b' : '',
                i >= lastRowFrom ? 'lg:border-b-0' : '',
                i % 2 === 0 && i < weekly.length - 1 ? 'lg:border-r' : '',
              ].join(' ')}
            />
          ))}
        </div>
      )}
      {cycled.map(b => <CycleRow key={b.boardId} b={b} />)}
      <div className="px-6 pt-2.5 pb-3 text-[11.5px] text-muted">
        {updated ? `${updated} · dashed lines are the targets` : 'Dashed lines are the targets'} · pills count weeks on target
      </div>
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
