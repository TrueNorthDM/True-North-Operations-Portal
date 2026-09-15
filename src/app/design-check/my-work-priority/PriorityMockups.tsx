'use client'

/**
 * Three ways to put "my priority" beside "True North's priority" on My Work.
 *
 * Mockups for a decision, not the feature: the rows are a fixture, the order a
 * person sets lives in component state and is gone on reload. Each option can be
 * reordered with the arrows so the comparison can be seen changing, which is the
 * part a static picture cannot show.
 *
 * True North's order is the one the list already uses: board priority first,
 * then the soonest deadline.
 */

import { useMemo, useState } from 'react'
import { chip, PRIORITY_CHIP } from '@/components/monday/tokens'

interface Item {
  id: string
  name: string
  board: string
  step: string
  priority: 'high' | 'medium' | 'low'
  due: string
  dueLabel: string
}

const ITEMS: Item[] = [
  { id: 'a', name: 'B82: best moisture meter for water restoration', board: 'BM - General Audits', step: 'Audit', priority: 'high', due: '2026-09-19', dueLabel: 'Sep 19' },
  { id: 'b', name: 'Lead Magnet - How to Use Bessemeter Pro', board: 'BM - General Audits', step: 'Audit', priority: 'high', due: '2026-09-25', dueLabel: 'Sep 25' },
  { id: 'c', name: '5.03 - Article Post', board: 'Graphics - Social Media', step: 'D Approval', priority: 'high', due: '2026-09-17', dueLabel: 'Sep 17' },
  { id: 'd', name: 'How Do Adventists Do Baby Dedications?', board: 'AAAF - Photo Curation Audits', step: 'Photo Curation Audit', priority: 'medium', due: '2026-09-16', dueLabel: 'Sep 16' },
  { id: 'e', name: '02 - Good Vs. Evil (Salvation)', board: 'AAAF - SEO & Writing', step: 'Brief Draft SEO', priority: 'medium', due: '2026-09-30', dueLabel: 'Sep 30' },
  { id: 'f', name: '06.25.26 - Event Post', board: 'Subitems of Graphics - Social Media', step: 'Asset Creation', priority: 'medium', due: '2026-10-02', dueLabel: 'Oct 2' },
  { id: 'g', name: 'Monthly Reporting Steps - adventist.org', board: "SOP's for the SEO's", step: 'Status', priority: 'low', due: '2026-09-18', dueLabel: 'Sep 18' },
  { id: 'h', name: 'Fundamental Beliefs infographic', board: 'Graphics Requests - All Projects', step: 'Finalization', priority: 'low', due: '2026-10-09', dueLabel: 'Oct 9' },
]

const RANK = { high: 0, medium: 1, low: 2 }
const TN_ORDER = [...ITEMS].sort((x, y) => RANK[x.priority] - RANK[y.priority] || x.due.localeCompare(y.due)).map(i => i.id)
/** A person who has already moved a few things, so every option opens on a difference to look at. */
const PRESET_MINE = ['d', 'g', 'c', 'a', 'b', 'e', 'f', 'h']
const byId = new Map(ITEMS.map(i => [i.id, i]))

function move(order: string[], id: string, dir: -1 | 1): string[] {
  const i = order.indexOf(id), j = i + dir
  if (j < 0 || j >= order.length) return order
  const next = [...order]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

/** Spearman's rank correlation turned into a 0 to 100 score: 100 is the same order, 0 the reverse. */
function agreement(mine: string[], tn: string[]): number {
  const n = mine.length
  const d2 = mine.reduce((s, id, i) => s + (i - tn.indexOf(id)) ** 2, 0)
  const rho = 1 - (6 * d2) / (n * (n * n - 1))
  return Math.round(((rho + 1) / 2) * 100)
}

const card = 'rounded-[14px] border border-[var(--panel-border)] bg-white overflow-hidden'
const head = 'px-3 py-[10px] font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.07em] uppercase text-muted'

function Tabs<T extends string>({ value, options, onChange }: { value: T; options: { key: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex items-center bg-subtle border border-[var(--panel-border)] rounded-[10px] p-[3px]">
      {options.map(o => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={`font-(family-name:--font-display) font-extrabold text-[13px] px-3.5 py-1.5 rounded-[8px] transition-colors ${
            value === o.key ? 'bg-white text-tn-ink shadow-[0_1px_3px_rgba(1,35,88,.14)]' : 'text-muted hover:text-tn-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Arrows({ onUp, onDown }: { onUp: () => void; onDown: () => void }) {
  const b = 'w-6 h-6 inline-flex items-center justify-center rounded-[6px] text-muted hover:bg-subtle hover:text-tn-ink text-[12px]'
  return (
    <span className="inline-flex flex-col">
      <button type="button" onClick={onUp} aria-label="Move up" className={b}>▲</button>
      <button type="button" onClick={onDown} aria-label="Move down" className={b}>▼</button>
    </span>
  )
}

function Delta({ by }: { by: number }) {
  if (by === 0) return <span className={`${chip} bg-[var(--chip-neutral-bg)] text-[var(--chip-neutral-fg)]`}>same</span>
  return by > 0
    ? <span className={`${chip} bg-[rgba(30,125,127,.12)] text-tn-teal`}>{`up ${by}`}</span>
    : <span className={`${chip} bg-[rgba(224,138,30,.16)] text-[#b06d0a]`}>{`down ${-by}`}</span>
}

function ItemCell({ it }: { it: Item }) {
  return (
    <div className="min-w-0">
      <div className="text-[13px] font-semibold text-tn-ink truncate">{it.name}</div>
      <div className="text-[11.5px] text-muted truncate">{`${it.board} · ${it.step} · due ${it.dueLabel}`}</div>
    </div>
  )
}

// ── Option A ────────────────────────────────────────────────────────────────

export function OptionA() {
  const [tab, setTab] = useState<'tn' | 'mine'>('mine')
  const [mine, setMine] = useState(PRESET_MINE)
  const moved = mine.filter((id, i) => TN_ORDER.indexOf(id) !== i).length
  const order = tab === 'tn' ? TN_ORDER : mine

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <Tabs value={tab} onChange={setTab} options={[{ key: 'tn', label: 'True North priority' }, { key: 'mine', label: 'My priority' }]} />
        {tab === 'mine' && (
          <>
            <span className="text-[13px] text-muted">{moved ? `You moved ${moved} of ${mine.length} steps from True North's order` : "Same as True North's order"}</span>
            <button type="button" onClick={() => setMine(TN_ORDER)} className="text-[13px] font-semibold text-tn-teal hover:underline ml-auto">Reset to True North order</button>
          </>
        )}
      </div>
      <div className={card}>
        <div className="grid bg-subtle border-b border-[var(--panel-border)]" style={{ gridTemplateColumns: '44px 56px minmax(0,1fr) 90px 72px 90px' }}>
          <div className={head} />
          <div className={head}>{tab === 'mine' ? 'Mine' : 'TN'}</div>
          <div className={head}>Step</div>
          <div className={head}>Priority</div>
          <div className={head}>{tab === 'mine' ? 'TN' : 'Mine'}</div>
          <div className={head}>{tab === 'mine' ? 'Against TN' : ''}</div>
        </div>
        {order.map((id, i) => {
          const it = byId.get(id)!
          const tnRank = TN_ORDER.indexOf(id) + 1, myRank = mine.indexOf(id) + 1
          return (
            <div key={id} className="grid items-center border-b border-[var(--row-rule)] last:border-b-0 hover:bg-[var(--row-hover)]" style={{ gridTemplateColumns: '44px 56px minmax(0,1fr) 90px 72px 90px' }}>
              <div className="px-2 py-2">{tab === 'mine' && <Arrows onUp={() => setMine(o => move(o, id, -1))} onDown={() => setMine(o => move(o, id, 1))} />}</div>
              <div className="px-3 font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">{i + 1}</div>
              <div className="px-3 py-2.5"><ItemCell it={it} /></div>
              <div className="px-3"><span className={`${chip} ${PRIORITY_CHIP[it.priority]}`}>{it.priority}</span></div>
              <div className="px-3 text-[13px] text-muted">{tab === 'mine' ? tnRank : myRank}</div>
              <div className="px-3">{tab === 'mine' && <Delta by={tnRank - myRank} />}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Option B ────────────────────────────────────────────────────────────────

export function OptionB() {
  const [tab, setTab] = useState<'mine' | 'compare'>('compare')
  const [mine, setMine] = useState(PRESET_MINE)
  const [hover, setHover] = useState<string | null>(null)
  const ROW = 44, TOP = 14, H = TOP * 2 + ROW * ITEMS.length

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <Tabs value={tab} onChange={setTab} options={[{ key: 'mine', label: 'My priority' }, { key: 'compare', label: 'Compare with True North' }]} />
        <button type="button" onClick={() => setMine(TN_ORDER)} className="text-[13px] font-semibold text-tn-teal hover:underline ml-auto">Reset to True North order</button>
      </div>

      {tab === 'mine' ? (
        <div className={card}>
          {mine.map((id, i) => (
            <div key={id} className="flex items-center gap-3 px-3 py-2 border-b border-[var(--row-rule)] last:border-b-0">
              <Arrows onUp={() => setMine(o => move(o, id, -1))} onDown={() => setMine(o => move(o, id, 1))} />
              <span className="w-6 font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">{i + 1}</span>
              <ItemCell it={byId.get(id)!} />
            </div>
          ))}
        </div>
      ) : (
        <div className={`${card} p-4`}>
          <div className="grid gap-0" style={{ gridTemplateColumns: 'minmax(0,1fr) 160px minmax(0,1fr)' }}>
            <div>
              <div className={`${head} px-0`}>True North priority</div>
              <div style={{ height: H }} className="relative">
                {TN_ORDER.map((id, i) => (
                  <div key={id} onMouseEnter={() => setHover(id)} onMouseLeave={() => setHover(null)}
                    className={`absolute left-0 right-0 flex items-center gap-2 px-2 rounded-[8px] ${hover === id ? 'bg-[var(--row-hover)]' : ''}`}
                    style={{ top: TOP + i * ROW - ROW / 2 + 22, height: ROW - 6 }}>
                    <span className="w-5 text-right font-(family-name:--font-display) font-extrabold text-[13px] text-muted">{i + 1}</span>
                    <span className={`${chip} ${PRIORITY_CHIP[byId.get(id)!.priority]}`}>{byId.get(id)!.priority}</span>
                    <span className="text-[12.5px] text-tn-ink truncate">{byId.get(id)!.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <svg width="160" height={H + 26} className="mt-[26px]" aria-hidden="true">
              {TN_ORDER.map((id, i) => {
                const j = mine.indexOf(id)
                const colour = j < i ? '#1E7D7F' : j > i ? '#E08A1E' : '#c5ccd6'
                const on = !hover || hover === id
                return (
                  // Row centres: the label column's 35px heading, less the 26px
                  // the drawing is already pushed down, plus half a label.
                  <line key={id} x1="4" y1={TOP + 28 + i * ROW} x2="156" y2={TOP + 28 + j * ROW}
                    stroke={colour} strokeWidth={hover === id ? 3 : 2} opacity={on ? 1 : 0.18} strokeLinecap="round" />
                )
              })}
            </svg>
            <div>
              <div className={`${head} px-0`}>My priority</div>
              <div style={{ height: H }} className="relative">
                {mine.map((id, i) => (
                  <div key={id} onMouseEnter={() => setHover(id)} onMouseLeave={() => setHover(null)}
                    className={`absolute left-0 right-0 flex items-center gap-2 px-2 rounded-[8px] ${hover === id ? 'bg-[var(--row-hover)]' : ''}`}
                    style={{ top: TOP + i * ROW - ROW / 2 + 22, height: ROW - 6 }}>
                    <span className="w-5 text-right font-(family-name:--font-display) font-extrabold text-[13px] text-muted">{i + 1}</span>
                    <span className="text-[12.5px] text-tn-ink truncate">{byId.get(id)!.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-[12px] text-muted mt-2">
            <span className="inline-flex items-center gap-1.5"><span className="w-4 h-[3px] rounded bg-[#1E7D7F]" />You put it higher</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-4 h-[3px] rounded bg-[#E08A1E]" />You put it lower</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-4 h-[3px] rounded bg-[#c5ccd6]" />Same place</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Option C ────────────────────────────────────────────────────────────────

export function OptionC() {
  const [tab, setTab] = useState<'tn' | 'mine'>('mine')
  const [mine, setMine] = useState(PRESET_MINE)
  const score = agreement(mine, TN_ORDER)
  const diffs = useMemo(() => mine
    .map(id => ({ id, by: TN_ORDER.indexOf(id) - mine.indexOf(id) }))
    .filter(d => Math.abs(d.by) >= 2)
    .sort((x, y) => Math.abs(y.by) - Math.abs(x.by)), [mine])
  const higher = diffs.filter(d => d.by > 0)
  const lower = diffs.filter(d => d.by < 0)
  const order = tab === 'tn' ? TN_ORDER : mine

  return (
    <div className="space-y-3">
      <Tabs value={tab} onChange={setTab} options={[{ key: 'tn', label: 'True North priority' }, { key: 'mine', label: 'My priority' }]} />

      {tab === 'mine' && (
        <div className="rounded-[14px] border border-[var(--panel-border)] bg-white p-4 grid gap-4" style={{ gridTemplateColumns: '170px minmax(0,1fr) minmax(0,1fr)' }}>
          <div>
            <div className={`${head} px-0 py-0`}>Agreement with True North</div>
            <div className="font-(family-name:--font-display) font-extrabold text-[30px] leading-none text-tn-ink mt-2">{`${score}%`}</div>
            <div className="h-1.5 rounded-full bg-subtle mt-2 overflow-hidden">
              <div className="h-full rounded-full bg-tn-teal" style={{ width: `${score}%` }} />
            </div>
            <button type="button" onClick={() => setMine(TN_ORDER)} className="text-[12.5px] font-semibold text-tn-teal hover:underline mt-2">Reset to True North order</button>
          </div>
          <div>
            <div className={`${head} px-0 py-0`}>You put first, True North later</div>
            {higher.length === 0 && <div className="text-[12.5px] text-muted mt-2">Nothing</div>}
            {higher.map(d => (
              <div key={d.id} className="flex items-center gap-2 mt-2">
                <Delta by={d.by} />
                <span className="text-[12.5px] text-tn-ink truncate">{byId.get(d.id)!.name}</span>
              </div>
            ))}
          </div>
          <div>
            <div className={`${head} px-0 py-0`}>True North first, you later</div>
            {lower.length === 0 && <div className="text-[12.5px] text-muted mt-2">Nothing</div>}
            {lower.map(d => (
              <div key={d.id} className="flex items-center gap-2 mt-2">
                <Delta by={d.by} />
                <span className="text-[12.5px] text-tn-ink truncate">{byId.get(d.id)!.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={card}>
        {order.map((id, i) => {
          const it = byId.get(id)!
          return (
            <div key={id} className="flex items-center gap-3 px-3 py-2 border-b border-[var(--row-rule)] last:border-b-0 hover:bg-[var(--row-hover)]">
              {tab === 'mine' ? <Arrows onUp={() => setMine(o => move(o, id, -1))} onDown={() => setMine(o => move(o, id, 1))} /> : <span className="w-6" />}
              <span className="w-6 font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">{i + 1}</span>
              <ItemCell it={it} />
              <span className={`${chip} ${PRIORITY_CHIP[it.priority]} ml-auto`}>{it.priority}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
