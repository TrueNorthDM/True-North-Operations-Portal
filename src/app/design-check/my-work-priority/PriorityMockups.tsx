'use client'

/**
 * Ways to put "my priority" beside "True North's priority" on My Work.
 *
 * Mockups for a decision, not the feature: the rows are a fixture, the order a
 * person sets lives in component state and is gone on reload. Each option can be
 * reordered with the arrows so the comparison can be seen changing, which is the
 * part a static picture cannot show.
 *
 * Option B (both orders drawn with a line per step) was dropped on 16 September
 * 2026: it stops being readable past a dozen steps, and the lists it would show
 * run from 132 to 348. What was asked for next is A and C together.
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

// ── Option A + C ────────────────────────────────────────────────────────────
//
// C's card on top, A's ranks underneath. The card answers "how far apart are we"
// at a glance; the list answers "where exactly". Rows that differ by two places
// or more carry a thin mark on their left edge in the same teal or amber as
// their chip, so a step named in the card can be found in the list without
// reading every number.

export function OptionAC() {
  const [tab, setTab] = useState<'tn' | 'mine'>('mine')
  const [mine, setMine] = useState(PRESET_MINE)
  const score = agreement(mine, TN_ORDER)
  const moved = mine.filter((id, i) => TN_ORDER.indexOf(id) !== i).length
  const diffs = useMemo(() => mine
    .map(id => ({ id, by: TN_ORDER.indexOf(id) - mine.indexOf(id) }))
    .filter(d => Math.abs(d.by) >= 2)
    .sort((x, y) => Math.abs(y.by) - Math.abs(x.by)), [mine])
  const higher = diffs.filter(d => d.by > 0)
  const lower = diffs.filter(d => d.by < 0)
  const order = tab === 'tn' ? TN_ORDER : mine
  const cols = '44px 56px minmax(0,1fr) 96px 64px 104px'

  return (
    <div className="space-y-3">
      <Tabs value={tab} onChange={setTab} options={[{ key: 'tn', label: 'True North priority' }, { key: 'mine', label: 'My priority' }]} />

      {tab === 'mine' && (
        <div className="rounded-[14px] border border-[var(--panel-border)] bg-white p-4 grid gap-5" style={{ gridTemplateColumns: '190px minmax(0,1fr) minmax(0,1fr)' }}>
          <div>
            <div className={`${head} px-0 py-0`}>Agreement with True North</div>
            <div className="font-(family-name:--font-display) font-extrabold text-[30px] leading-none text-tn-ink mt-2">{`${score}%`}</div>
            <div className="h-1.5 rounded-full bg-subtle mt-2 overflow-hidden">
              <div className="h-full rounded-full bg-tn-teal" style={{ width: `${score}%` }} />
            </div>
            <div className="text-[12px] text-muted mt-2">{moved ? `${moved} of ${mine.length} steps moved` : "Same as True North's order"}</div>
            <button type="button" onClick={() => setMine(TN_ORDER)} className="text-[12.5px] font-semibold text-tn-teal hover:underline mt-1">Reset to True North order</button>
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
        {/* The same 3px left edge as the rows, so the columns line up with them. */}
        <div className="grid bg-subtle border-b border-[var(--panel-border)] border-l-[3px] border-l-transparent" style={{ gridTemplateColumns: cols }}>
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
          const by = tnRank - myRank
          const mark = tab !== 'mine' || Math.abs(by) < 2 ? 'border-l-transparent' : by > 0 ? 'border-l-tn-teal' : 'border-l-[#E08A1E]'
          return (
            <div key={id} className={`grid items-center border-b border-[var(--row-rule)] last:border-b-0 border-l-[3px] ${mark} hover:bg-[var(--row-hover)]`} style={{ gridTemplateColumns: cols }}>
              <div className="px-2 py-2">{tab === 'mine' && <Arrows onUp={() => setMine(o => move(o, id, -1))} onDown={() => setMine(o => move(o, id, 1))} />}</div>
              <div className="px-3 font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">{i + 1}</div>
              <div className="px-3 py-2.5"><ItemCell it={it} /></div>
              <div className="px-3"><span className={`${chip} ${PRIORITY_CHIP[it.priority]}`}>{it.priority}</span></div>
              <div className="px-3 text-[13px] text-muted">{tab === 'mine' ? tnRank : myRank}</div>
              <div className="px-3">{tab === 'mine' && <Delta by={by} />}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
