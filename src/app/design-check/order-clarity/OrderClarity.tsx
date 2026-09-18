/**
 * Which order a row follows: the team's, or True North's. A mockup, asked for
 * on 18 September 2026, for both screens: a person's own list on My Work, and
 * the leader's editor.
 *
 * What the real data shows, and every option has to make visible:
 *   - the SEO team's first 169 steps were all placed by hand, so True North's
 *     #1 is the team's #170;
 *   - a step nobody moved still lands far from its True North place: Arnaldo's
 *     first step is True North's #80 and the team's #203, because 179 steps
 *     placed by hand sit above it. Today nothing on the screen says so.
 *
 * Three options, the same data in each:
 *   1. Marks: a pin (placed by hand) or a compass (True North's order) on every
 *      row, and both numbers.
 *   2. Bands: the list divided where it changes from one order to the other,
 *      each band saying which order it is and why.
 *   3. Track: a small line from True North's place to the team's place, so a
 *      jump reads before a number does.
 *   4. Marks and bands together.
 */

import type { ReactNode } from 'react'
import { chip } from '@/components/monday/tokens'
import { ARNALDO, EDITOR_SEAM, EDITOR_TOP, JEANNETTE, LEADER, PLACED, TOTAL, type OrderRow } from './data'

export type Option = '1' | '2' | '3' | '4'

/** Option 4, asked for on 18 September 2026 while deciding between 1 and 2: both at once. */
const hasMarks = (o: Option) => o === '1' || o === '4'
const hasBands = (o: Option) => o === '2' || o === '4'

// ── Symbols ────────────────────────────────────────────────────────────────
export const PIN = <><path d="M12 17v5" /><path d="M5 17h14v-1.8a2 2 0 0 0-1.1-1.8l-1.8-.9A2 2 0 0 1 15 10.8V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.8a2 2 0 0 1-1.1 1.8l-1.8.9A2 2 0 0 0 5 15.2Z" /></>
export const COMPASS = <><circle cx="12" cy="12" r="10" /><path d="m16.2 7.8-1.8 5.4a2 2 0 0 1-1.3 1.3l-5.4 1.8 1.8-5.4a2 2 0 0 1 1.3-1.3z" /></>

export function Sym({ d, size = 12, colour }: { d: ReactNode; size?: number; colour: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={colour} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
}

/** Placed by hand: navy with a gold pin. Following True North: teal with a compass. */
export function Mark({ placed, size = 24 }: { placed: boolean; size?: number }) {
  return placed
    ? <span className="inline-flex items-center justify-center rounded-full bg-tn-primary shrink-0" style={{ width: size, height: size }} title={`Placed by hand by ${LEADER}`}><Sym d={PIN} size={size * 0.52} colour="#F2C40A" /></span>
    : <span className="inline-flex items-center justify-center rounded-full bg-[rgba(30,125,127,.14)] shrink-0" style={{ width: size, height: size }} title="Follows True North's order"><Sym d={COMPASS} size={size * 0.58} colour="#1E7D7F" /></span>
}

function LegendItem({ placed, text }: { placed: boolean; text: string }) {
  return <span className="inline-flex items-center gap-1.5 text-[12.5px] text-tn-ink"><Mark placed={placed} size={20} />{text}</span>
}

// ── The track (option 3) ───────────────────────────────────────────────────
function Track({ r, width = 170 }: { r: OrderRow; width?: number }) {
  const x = (n: number) => 6 + ((n - 1) / (TOTAL - 1)) * (width - 12)
  const a = x(r.tn), b = x(r.team)
  return (
    <svg width={width} height="18" viewBox={`0 0 ${width} 18`} aria-hidden="true">
      <line x1="6" x2={width - 6} y1="9" y2="9" stroke="#e3dfd5" strokeWidth="2" strokeLinecap="round" />
      <line x1={a} x2={b} y1="9" y2="9" stroke={r.placed ? '#012358' : '#8593a4'} strokeWidth={r.placed ? 3 : 2} strokeDasharray={r.placed ? undefined : '3 3'} strokeLinecap="round" />
      <circle cx={a} cy="9" r="4.5" fill="#ffffff" stroke="#1E7D7F" strokeWidth="2" />
      <circle cx={b} cy="9" r="4.5" fill="#012358" stroke={r.placed ? '#F2C40A' : '#012358'} strokeWidth="1.5" />
    </svg>
  )
}

function trackText(r: OrderRow): { text: string; strong: boolean } {
  const d = r.tn - r.team
  if (r.placed) return { text: d > 0 ? `Moved up ${d} by hand` : d < 0 ? `Moved down ${-d} by hand` : 'Placed by hand, same place', strong: true }
  return { text: `True North's #${r.tn} · ${r.placedAbove} placed by hand above it`, strong: false }
}

// ── Screen 1: a person's own list on My Work ───────────────────────────────
const LIST_COLS = (opt: Option) => opt === '3'
  ? '64px 70px minmax(0,1fr) 170px 120px 130px 70px 200px'
  : `64px ${hasMarks(opt) ? '104px' : '70px'} minmax(0,1fr) 190px 140px 140px 80px`

function Banner({ opt, who }: { opt: Option; who: string }) {
  return (
    <div className="rounded-[14px] border border-[rgba(30,125,127,.35)] bg-[rgba(30,125,127,.07)] px-4 py-3">
      <div className="flex items-center gap-3 flex-wrap">
        <Sym d={<path d="M4 6h16M4 12h10M4 18h6" />} size={16} colour="#1E7D7F" />
        <span className="text-[13.5px] text-tn-ink"><b>Ordered by the SEO team&apos;s priority</b><span className="text-muted">, set by {LEADER} · updated today at 2:58 PM</span></span>
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[10px] border border-[var(--panel-border)] bg-white font-(family-name:--font-display) font-semibold text-[12.5px] text-tn-ink">SEO order ▾</span>
        {who === LEADER && (
          <span className="ml-auto inline-flex items-center gap-2 rounded-full px-[17px] py-2 font-(family-name:--font-display) font-extrabold text-[12.5px] bg-tn-primary shadow-[0_8px_18px_-8px_rgba(1,35,88,.6)]">
            <Sym d={<><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>} size={13} colour="#F2C40A" />
            <span className="text-[#ffffff]">Edit order</span>
          </span>
        )}
      </div>
      {hasMarks(opt) && (
        <div className="flex items-center gap-5 flex-wrap mt-2.5 pl-7">
          <LegendItem placed text={`Placed by ${LEADER}`} />
          <LegendItem placed={false} text="Follows True North's order" />
          <span className="text-[12px] text-muted">The small number is True North&apos;s place for the step.</span>
        </div>
      )}
      {opt === '3' && (
        <div className="flex items-center gap-5 flex-wrap mt-2.5 pl-7 text-[12px] text-muted">
          <span className="inline-flex items-center gap-1.5"><svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="4.5" fill="#fff" stroke="#1E7D7F" strokeWidth="2" /></svg>True North&apos;s place</span>
          <span className="inline-flex items-center gap-1.5"><svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="4.5" fill="#012358" /></svg>The team&apos;s place</span>
          <span className="inline-flex items-center gap-1.5"><svg width="22" height="6" aria-hidden="true"><line x1="1" x2="21" y1="3" y2="3" stroke="#012358" strokeWidth="3" strokeLinecap="round" /></svg>placed by hand</span>
          <span className="inline-flex items-center gap-1.5"><svg width="22" height="6" aria-hidden="true"><line x1="1" x2="21" y1="3" y2="3" stroke="#8593a4" strokeWidth="2" strokeDasharray="3 3" /></svg>pushed down by steps placed above</span>
          <span>{`Line runs from #1 to #${TOTAL}.`}</span>
        </div>
      )}
    </div>
  )
}

function ListHead({ opt }: { opt: Option }) {
  const h = 'px-3 py-2.5 font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.07em] uppercase text-muted'
  return (
    <div className="grid bg-subtle border-b border-[var(--panel-border)] rounded-t-[14px]" style={{ gridTemplateColumns: LIST_COLS(opt) }}>
      <div />
      <div className={h}>Team</div>
      <div className={h}>Item</div>
      <div className={h}>Board</div>
      <div className={h}>Step</div>
      <div className={h}>Status</div>
      <div className={`${h} text-right`}>Due</div>
      {opt === '3' && <div className={h}>Team vs True North</div>}
    </div>
  )
}

function ListRow({ r, opt }: { r: OrderRow; opt: Option }) {
  const c = 'px-3 py-2.5 text-[13px] min-w-0'
  return (
    <div className={`grid items-center border-b border-[var(--row-rule)] last:border-b-0 ${hasBands(opt) && r.placed ? 'bg-[rgba(1,35,88,.025)]' : ''}`} style={{ gridTemplateColumns: LIST_COLS(opt) }}>
      <div className="flex items-center gap-1.5 pl-3">
        <span className="w-6 h-6 rounded-full bg-[var(--chip-neutral-bg)]" />
        <span className="w-6 h-6 rounded-full bg-[var(--chip-neutral-bg)]" />
      </div>
      <div className={`${c} flex items-center gap-2`}>
        {hasMarks(opt) && <Mark placed={r.placed} />}
        <span className="flex flex-col leading-none">
          <span className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">{r.team}</span>
          {hasMarks(opt) && <span className="text-[10.5px] font-bold text-tn-teal mt-1">{`TN #${r.tn}`}</span>}
        </span>
      </div>
      <div className={`${c} text-tn-ink font-medium truncate`}>{r.item}{r.language && <span className="text-muted font-normal">{` · ${r.language}`}</span>}</div>
      <div className={`${c} text-muted truncate`}>{r.board}</div>
      <div className={`${c} text-muted truncate`}>{r.step}</div>
      <div className={c}>{r.status && <span className={`${chip} text-white whitespace-nowrap`} style={{ background: r.colour }}>{r.status}</span>}</div>
      <div className={`${c} text-right text-tn-ink`}>{r.due ?? <span className="text-[var(--faint)]">-</span>}</div>
      {opt === '3' && (
        <div className={`${c} flex flex-col gap-0.5`}>
          <Track r={r} />
          <span className={`text-[11px] ${trackText(r).strong ? 'font-semibold text-tn-ink' : 'text-muted'}`}>{trackText(r).text}</span>
        </div>
      )}
    </div>
  )
}

/** Option 2: a band where the list changes from one order to the other. */
function Band({ placed, children }: { placed: boolean; children: ReactNode }) {
  return (
    <div className={`flex items-center gap-2.5 px-4 py-2 border-b border-[var(--row-rule)] ${placed ? 'bg-[rgba(1,35,88,.06)] border-l-[3px] border-l-tn-primary' : 'bg-[rgba(30,125,127,.08)] border-l-[3px] border-l-tn-teal'}`}>
      <Mark placed={placed} size={22} />
      <span className="text-[12.5px] text-tn-ink leading-snug">{children}</span>
    </div>
  )
}

function runs(rows: OrderRow[]): OrderRow[][] {
  const out: OrderRow[][] = []
  for (const r of rows) {
    const last = out[out.length - 1]
    if (last && last[0].placed === r.placed) last.push(r)
    else out.push([r])
  }
  return out
}

function ListScreen({ opt, rows, who, note }: { opt: Option; rows: OrderRow[]; who: string; note: string }) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-3">
        <span className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">{`My Work · ${who}'s own list`}</span>
        <span className="text-[12px] text-muted">{note}</span>
      </div>
      <Banner opt={opt} who={who} />
      <div className="rounded-[14px] border border-[var(--panel-border)] bg-white">
        <ListHead opt={opt} />
        {hasBands(opt)
          ? runs(rows).map((run, i) => (
            <div key={i}>
              <Band placed={run[0].placed}>
                {run[0].placed
                  ? <><b>{`Placed by hand by ${LEADER}.`}</b> <span className="text-muted">These keep the place she gave them, above the order True North would give.</span></>
                  : <><b>Following True North&apos;s order.</b> <span className="text-muted">{`${run[0].placedAbove} steps placed by hand come before these, so True North's #${run[0].tn} is the team's #${run[0].team}.`}</span></>}
              </Band>
              {run.map(r => <ListRow key={r.team} r={r} opt={opt} />)}
            </div>
          ))
          : rows.map(r => <ListRow key={r.team} r={r} opt={opt} />)}
      </div>
    </div>
  )
}

// ── Screen 2: the editor ───────────────────────────────────────────────────
const ED_COLS = (opt: Option) => opt === '3'
  ? '56px 80px minmax(0,1fr) 160px 240px'
  : `56px ${hasMarks(opt) ? '96px' : '72px'} minmax(0,1fr) 160px 140px 130px`

function EditorHead({ opt }: { opt: Option }) {
  const h = 'px-3 py-2.5 font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.07em] uppercase'
  return (
    <div className="grid bg-subtle border-b border-[var(--panel-border)] rounded-t-[14px]" style={{ gridTemplateColumns: ED_COLS(opt) }}>
      <div />
      <div className={`${h} ${hasMarks(opt) ? 'text-tn-ink' : 'text-muted'}`}>Team #</div>
      <div className={`${h} text-muted`}>Step</div>
      <div className={`${h} text-muted`}>Person</div>
      {opt === '3'
        ? <div className={`${h} text-muted`}>{`True North's place → the team's (1 to ${TOTAL})`}</div>
        : <>
          <div className={`${h} whitespace-nowrap ${hasMarks(opt) ? 'text-tn-teal inline-flex items-center gap-1' : 'text-muted'}`}>{hasMarks(opt) && <Sym d={COMPASS} size={11} colour="#1E7D7F" />}True North #</div>
          <div className={`${h} text-muted`}>Change</div>
        </>}
    </div>
  )
}

function EditorRow({ r, opt }: { r: OrderRow; opt: Option }) {
  const c = 'px-3 py-2.5 text-[13px] min-w-0'
  const d = r.tn - r.team
  return (
    <div className={`grid items-center border-b border-[var(--row-rule)] ${r.placed && !hasBands(opt) ? 'shadow-[inset_3px_0_0_#1E7D7F]' : ''} ${hasBands(opt) && r.placed ? 'bg-[rgba(1,35,88,.025)]' : ''}`} style={{ gridTemplateColumns: ED_COLS(opt) }}>
      <div className="pl-3 text-[10px] text-muted leading-none"><div>⋮⋮ ▲</div><div className="pl-[18px]">▼</div></div>
      <div className={`${c} flex items-center gap-2`}>
        {hasMarks(opt) && <Mark placed={r.placed} />}
        <span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">{r.team}</span>
      </div>
      <div className={c}>
        <div className="text-tn-ink font-semibold truncate">{r.item}</div>
        <div className="text-[11.5px] text-muted truncate">{[r.board, r.step, r.due ? `due ${r.due}` : null].filter(Boolean).join(' · ')}</div>
      </div>
      <div className={`${c} text-tn-ink`}>{r.who}</div>
      {opt === '3'
        ? (
          <div className={`${c} flex items-center gap-2`}>
            <span className="text-[11px] font-bold text-tn-teal w-[30px] text-right">{r.tn}</span>
            <Track r={r} width={150} />
            <span className="text-[11px] font-extrabold text-tn-ink w-[30px]">{r.team}</span>
          </div>
        )
        : <>
          <div className={`${c} ${hasMarks(opt) ? 'font-bold text-tn-teal' : 'text-muted'}`}>{r.tn}</div>
          <div className={c}>
            {r.placed
              ? <span className={`${chip} ${d >= 0 ? 'bg-[rgba(30,125,127,.12)] text-tn-teal' : 'bg-[rgba(224,138,30,.16)] text-[#b06d0a]'}`}>{d >= 0 ? `up ${d}` : `down ${-d}`}</span>
              : <span className="text-[11.5px] text-muted leading-tight block">{hasMarks(opt) ? `pushed down ${r.team - r.tn}` : 'follows True North'}</span>}
          </div>
        </>}
    </div>
  )
}

const EDITOR_BANDS: Record<number, { placed: boolean; text: ReactNode }> = {
  1: { placed: true, text: <><b>Placed by hand · #1 to #169.</b> <span className="text-muted">169 steps in a row, all moved here by the team.</span></> },
  170: { placed: false, text: <><b>True North&apos;s order · #170 to #171.</b> <span className="text-muted">True North&apos;s #1 and #2, below the 169 placed by hand.</span></> },
  172: { placed: true, text: <><b>Placed by hand · #172 to #175.</b></> },
  176: { placed: false, text: <><b>True North&apos;s order · #176 to #177.</b> <span className="text-muted">True North&apos;s #3 and #4.</span></> },
}

function EditorScreen({ opt }: { opt: Option }) {
  const gap = (
    <div className="px-4 py-2 text-[12px] text-muted border-b border-[var(--row-rule)] bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,rgba(1,35,88,.03)_6px,rgba(1,35,88,.03)_12px)]">
      {hasBands(opt) ? '#5 to #168: 164 more placed by hand' : '#5 to #168'}
    </div>
  )
  const rows = (list: OrderRow[]) => list.map(r => (
    <div key={r.team}>
      {hasBands(opt) && EDITOR_BANDS[r.team] && <Band placed={EDITOR_BANDS[r.team].placed}>{EDITOR_BANDS[r.team].text}</Band>}
      <EditorRow r={r} opt={opt} />
    </div>
  ))
  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-3">
        <span className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">Edit priority · SEO</span>
        <span className="text-[12px] text-muted">{`${TOTAL} open steps, ${PLACED} placed by hand. The top of the list, then where the hand-placed block ends.`}</span>
      </div>
      {hasMarks(opt) && (
        <div className="flex items-center gap-5 flex-wrap">
          <LegendItem placed text="Placed by hand" />
          <LegendItem placed={false} text="Follows True North's order" />
        </div>
      )}
      <div className="rounded-[14px] border border-[var(--panel-border)] bg-white overflow-hidden">
        <EditorHead opt={opt} />
        {rows(EDITOR_TOP)}
        {gap}
        {rows(EDITOR_SEAM)}
      </div>
    </div>
  )
}

export function OrderClarity({ option }: { option: Option }) {
  return (
    <div className="space-y-8">
      <ListScreen opt={option} rows={JEANNETTE} who={LEADER} note="Her steps: mostly placed by hand, the last one following True North." />
      <ListScreen opt={option} rows={ARNALDO} who="Arnaldo Oliveira" note="Nothing moved by hand, and still far from True North's place." />
      <EditorScreen opt={option} />
    </div>
  )
}
