'use client'

/**
 * Team priority in three levels: workspace, board, item. A mockup, asked for on
 * 18 September 2026, before anything is built.
 *
 * Today a leader orders single steps. Asked for: order whole workspaces, then
 * the boards inside each, then single items. The three combine one way:
 *   1. workspaces in the leader's order;
 *   2. inside each, boards in the leader's order;
 *   3. inside each board, True North's order (the soonest deadline first);
 *   4. a step moved at the Item level keeps the place it was given, above
 *      everything, even other workspaces.
 * Workspace and board orders are rules, not snapshots: a step that arrives on
 * a board next week lands in that board's place without anybody moving it.
 *
 * The SEO team's real shape on 18 September 2026: 820 open steps, 6 workspaces,
 * 22 boards. Item names are two real ones per board, deadlines are made up.
 * Nothing is saved.
 */

import { useMemo, useState } from 'react'
import { chip, PRIORITY_CHIP } from '@/components/monday/tokens'

type Priority = 'high' | 'medium' | 'low'
interface Board { name: string; ws: string; priority: Priority; open: number; late: number; items: string[] }

const BOARDS: Board[] = [
  { name: 'Tool Management', ws: 'Admin & Leadership', priority: 'medium', open: 7, late: 7, items: ['SEMrush', 'Screaming Frog'] },
  { name: 'HFA - Publishing', ws: 'Africa', priority: 'medium', open: 12, late: 6, items: ['HFA.ai 05/043 - Why do I struggle to plan ahead?', 'HFA.ai 05/044 - How do I stay motivated long-term?'] },
  { name: 'AAAF - SEO & Writing', ws: 'Ask An Adventist Friend', priority: 'high', open: 55, late: 1, items: ["PP16/02/07 - What Does the Lord's Prayer Mean?", 'PP16/01/26 - How Do I Find God Again?'] },
  { name: 'AAAF - Schema Audits', ws: 'Ask An Adventist Friend', priority: 'high', open: 31, late: 20, items: ['190 - what is legalism?', '181 - What do Adventists believe about the devil?'] },
  { name: 'AAAF - Publishing', ws: 'Ask An Adventist Friend', priority: 'high', open: 24, late: 14, items: ["PP12/24/04 - Signs of Jesus Christ's Second Coming", 'Why do Adventists Worship on Saturday?'] },
  { name: 'AAAF - General Audits', ws: 'Ask An Adventist Friend', priority: 'high', open: 17, late: 1, items: ['12A - Prayers - What Is It and Why Is It Important?', '12B - Prayers - How do I do it?'] },
  { name: 'AAAF - General', ws: 'Ask An Adventist Friend', priority: 'high', open: 3, late: 0, items: ['ASI 2023 Videos', 'Strategy Brief DRAFT - Pillar PP14'] },
  { name: 'WM - Social Media Planning', ws: 'Graphics & Social Media', priority: 'medium', open: 248, late: 248, items: ['Busting the Biggest Myths About Concrete Moisture Testing', 'Customer Satisfaction Template for Flooring Professionals'] },
  { name: 'Subitems of Graphics - Social Media', ws: 'Graphics & Social Media', priority: 'medium', open: 99, late: 24, items: ['01.01.27 - Happy Sabbath Post', '01.01.27 - Holiday Post'] },
  { name: 'Graphics - Social Media', ws: 'Graphics & Social Media', priority: 'medium', open: 56, late: 27, items: ['156 - What is VBS?', '2027 Weekly word studies'] },
  { name: 'Graphics Requests - All Projects', ws: 'Graphics & Social Media', priority: 'medium', open: 8, late: 5, items: ['PP04 - Adventist Education - Benefits Infographic', 'William Miller quick fact sheet'] },
  { name: 'AAAF - Social Media Planning', ws: 'Graphics & Social Media', priority: 'medium', open: 5, late: 1, items: ['148 - Lead Magnet - bible study tools', 'Do Seventh-Day Adventists Have Rules for Clothing?'] },
  { name: 'BM - Social Media Planning', ws: 'Graphics & Social Media', priority: 'medium', open: 4, late: 4, items: ['24.12 - December', '25.01 - January'] },
  { name: 'WM - Schema Audits', ws: 'i7 Projects', priority: 'high', open: 103, late: 33, items: ['Rapid RH and Carbide Bomb: The Pros & Cons of Each', 'Compare Costs for Concrete Moisture Tests: RH vs MVER'] },
  { name: 'BM - General Audits', ws: 'i7 Projects', priority: 'high', open: 42, late: 20, items: ['Footnotes Authority (audit and update for topical EEAT)', 'Screaming Frog Issues'] },
  { name: 'BM - Schema Audits', ws: 'i7 Projects', priority: 'high', open: 13, late: 4, items: ['B117: best pin moisture meters', 'Slide Hammer Probe'] },
  { name: 'BM - SEO & Writing', ws: 'i7 Projects', priority: 'high', open: 8, late: 2, items: ['B122: construction delays caused by moisture', 'B123: moisture documentation for construction projects'] },
  { name: 'BM - Photo Curation Audits', ws: 'i7 Projects', priority: 'high', open: 2, late: 2, items: ['About Bessemeter', 'What 7K Custom Builds Thinks of the DS500'] },
  { name: 'BM - Publishing', ws: 'i7 Projects', priority: 'high', open: 2, late: 0, items: ['Wood Moisture Meter FAQs', 'B116: pin vs pinless moisture meter'] },
  { name: 'WM - Technical Fixes', ws: 'i7 Projects', priority: 'high', open: 2, late: 0, items: ['Technical - Scan 5 / Heading Structure', 'Technical - Scan 4 / Meta Titles'] },
  { name: "SOP's for the SEO's", ws: 'SEO Team', priority: 'medium', open: 43, late: 17, items: ['How to write Schema', 'Schema Reporting'] },
  { name: 'Team Reports Scheduled', ws: 'SEO Team', priority: 'medium', open: 36, late: 2, items: ['ECD AAAF & HFA total lives touched, September 2026', 'ECD AAAF & HFA total lives touched, October 2026'] },
]

const RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 }
const WORKSPACES = [...new Set(BOARDS.map(b => b.ws))]
const boardsOf = (ws: string) => BOARDS.filter(b => b.ws === ws)
const sum = (bs: Board[], k: 'open' | 'late') => bs.reduce((s, b) => s + b[k], 0)

/** True North's order for workspaces: the one with the highest board priority first, then the most work. */
const TN_WS = [...WORKSPACES].sort((a, b) =>
  Math.min(...boardsOf(a).map(x => RANK[x.priority])) - Math.min(...boardsOf(b).map(x => RANK[x.priority]))
  || sum(boardsOf(b), 'open') - sum(boardsOf(a), 'open'))
/** And for boards inside a workspace: board priority, then the most late work. */
const TN_BOARDS = Object.fromEntries(WORKSPACES.map(ws => [ws, boardsOf(ws)
  .sort((a, b) => RANK[a.priority] - RANK[b.priority] || b.late - a.late).map(b => b.name)]))

/** An item moved by hand at the Item level, to show that it still beats the levels above. */
const PINNED = { item: 'ECD AAAF & HFA total lives touched, September 2026', board: 'Team Reports Scheduled', ws: 'SEO Team' }

function move<T>(list: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir
  if (j < 0 || j >= list.length) return list
  const next = [...list]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

const HEAD = 'px-3 py-[10px] font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.07em] uppercase text-muted whitespace-nowrap'
const segment = 'font-(family-name:--font-display) font-extrabold text-[13px] px-3.5 py-1.5 rounded-[8px] transition-colors'

function Arrows({ onUp, onDown, first, last, label }: { onUp: () => void; onDown: () => void; first: boolean; last: boolean; label: string }) {
  const b = 'w-6 h-[18px] inline-flex items-center justify-center rounded-[5px] text-[10px] text-muted hover:bg-subtle hover:text-tn-ink disabled:opacity-30'
  return (
    <span className="inline-flex flex-col">
      <button type="button" onClick={onUp} disabled={first} aria-label={`Move ${label} up`} className={b}>▲</button>
      <button type="button" onClick={onDown} disabled={last} aria-label={`Move ${label} down`} className={b}>▼</button>
    </span>
  )
}

function Moved({ from, to }: { from: number; to: number }) {
  const by = from - to
  if (!by) return <span className="text-[var(--faint)] text-[13px]">-</span>
  return by > 0
    ? <span className={`${chip} bg-[rgba(30,125,127,.12)] text-tn-teal`}>{`up ${by}`}</span>
    : <span className={`${chip} bg-[rgba(224,138,30,.16)] text-[#b06d0a]`}>{`down ${-by}`}</span>
}

export function LevelsMockup({ initialLevel = 'workspace' }: { initialLevel?: 'workspace' | 'board' | 'item' }) {
  const [level, setLevel] = useState<'workspace' | 'board' | 'item'>(initialLevel)
  const [wsOrder, setWsOrder] = useState<string[]>(TN_WS)
  const [boardOrder, setBoardOrder] = useState<Record<string, string[]>>(TN_BOARDS)

  // The list the team sees, from the two orders above plus the one hand-placed item.
  const items = useMemo(() => {
    const out: { item: string; board: Board; late: boolean }[] = []
    for (const ws of wsOrder) {
      for (const name of boardOrder[ws]) {
        const b = BOARDS.find(x => x.name === name)!
        b.items.forEach((it, i) => { if (it !== PINNED.item) out.push({ item: it, board: b, late: i < Math.min(b.late, 2) }) })
      }
    }
    const pinnedBoard = BOARDS.find(x => x.name === PINNED.board)!
    return [{ item: PINNED.item, board: pinnedBoard, late: false }, ...out]
  }, [wsOrder, boardOrder])

  const card = 'rounded-[14px] border border-[var(--panel-border)] bg-white'

  return (
    <div className="space-y-4">
      {/* The editor's own row, as it is today, with Save and close. */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="flex-1 min-w-[220px] inline-flex items-center gap-2 px-3 py-[10px] rounded-[11px] border border-[var(--panel-border)] bg-white text-[13px] text-[var(--faint)]">Search the team&apos;s steps…</span>
        <div className="flex items-center bg-subtle border border-[var(--panel-border)] rounded-[10px] p-[3px]">
          <span className={`${segment} text-muted`}>Mine</span>
          <span className={`${segment} text-muted`}>Everyone</span>
          <span className={`${segment} bg-white text-tn-ink shadow-[0_1px_3px_rgba(1,35,88,.14)]`}>Team priority</span>
        </div>
        <span className="inline-flex items-center px-3 py-[9px] rounded-[10px] border border-tn-teal bg-white font-(family-name:--font-display) font-semibold text-[13px] text-tn-teal">SEO</span>
        <span className="inline-flex items-center gap-2 rounded-full px-[17px] py-2 bg-tn-primary font-(family-name:--font-display) font-extrabold text-[12.5px] text-[#ffffff]">Save and close</span>
      </div>

      {/* NEW: the level being ordered. */}
      <div className={`${card} p-4 flex items-center gap-4 flex-wrap`}>
        <div>
          <div className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.07em] uppercase text-muted">Order by</div>
          <div className="mt-1.5 inline-flex items-center bg-subtle border border-[var(--panel-border)] rounded-[10px] p-[3px]">
            {([['workspace', 'Workspace', `${WORKSPACES.length}`], ['board', 'Board', `${BOARDS.length}`], ['item', 'Item', '820']] as const).map(([k, label, count]) => (
              <button key={k} type="button" onClick={() => setLevel(k)} className={`${segment} ${level === k ? 'bg-white text-tn-ink shadow-[0_1px_3px_rgba(1,35,88,.14)]' : 'text-muted hover:text-tn-ink'}`}>
                {label} <span className="text-[11px] font-bold text-muted ml-0.5">{count}</span>
              </button>
            ))}
          </div>
        </div>
        <p className="flex-1 min-w-[300px] text-[12.5px] text-muted leading-relaxed m-0">
          {level === 'workspace' && 'Put whole workspaces in order. Every board and item inside moves with its workspace.'}
          {level === 'board' && 'Put boards in order inside their workspace. Every item on a board moves with it.'}
          {level === 'item' && 'Single steps, as today. A step you move here keeps its place above everything, even other workspaces.'}
        </p>
      </div>

      {level === 'workspace' && (
        <div className={card}>
          <div className="grid bg-subtle border-b border-[var(--panel-border)] rounded-t-[14px]" style={{ gridTemplateColumns: '52px 72px minmax(0,1fr) 90px 110px 90px 110px' }}>
            <div className={HEAD} /><div className={HEAD}>Team #</div><div className={HEAD}>Workspace</div><div className={HEAD}>Boards</div><div className={HEAD}>Open steps</div><div className={HEAD}>Late</div><div className={HEAD}>vs True North</div>
          </div>
          {wsOrder.map((ws, i) => (
            <div key={ws} className="grid items-center border-b border-[var(--row-rule)] last:border-b-0" style={{ gridTemplateColumns: '52px 72px minmax(0,1fr) 90px 110px 90px 110px' }}>
              <div className="px-3 py-2"><Arrows label={ws} first={i === 0} last={i === wsOrder.length - 1} onUp={() => setWsOrder(move(wsOrder, i, -1))} onDown={() => setWsOrder(move(wsOrder, i, 1))} /></div>
              <div className="px-3 font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">{i + 1}</div>
              <div className="px-3 py-3 text-[13.5px] font-semibold text-tn-ink">{ws}</div>
              <div className="px-3 text-[13px] text-muted">{boardsOf(ws).length}</div>
              <div className="px-3 text-[13px] text-foreground">{sum(boardsOf(ws), 'open')}</div>
              <div className="px-3 text-[13px] text-[#c2410c] font-semibold">{sum(boardsOf(ws), 'late') || <span className="text-[var(--faint)] font-normal">0</span>}</div>
              <div className="px-3"><Moved from={TN_WS.indexOf(ws)} to={i} /></div>
            </div>
          ))}
        </div>
      )}

      {level === 'board' && (
        <div className="space-y-3">
          <div className="grid" style={{ gridTemplateColumns: '52px 72px minmax(0,1fr) 124px 110px 90px 110px' }}>
            <div className={HEAD} /><div className={HEAD}>Team #</div><div className={HEAD}>Board</div><div className={HEAD}>Board priority</div><div className={HEAD}>Open steps</div><div className={HEAD}>Late</div><div className={HEAD}>vs True North</div>
          </div>
          {wsOrder.map((ws, wi) => (
            <div key={ws} className={card}>
              <div className="flex items-center gap-2.5 px-4 py-2.5 bg-subtle border-b border-[var(--panel-border)] rounded-t-[14px]">
                <span className="font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink">{`${wi + 1}. ${ws}`}</span>
                <span className="text-[12px] text-muted">{`${sum(boardsOf(ws), 'open')} open steps`}</span>
              </div>
              {boardOrder[ws].map((name, i) => {
                const b = BOARDS.find(x => x.name === name)!
                return (
                  <div key={name} className="grid items-center border-b border-[var(--row-rule)] last:border-b-0" style={{ gridTemplateColumns: '52px 72px minmax(0,1fr) 124px 110px 90px 110px' }}>
                    <div className="px-3 py-2"><Arrows label={name} first={i === 0} last={i === boardOrder[ws].length - 1} onUp={() => setBoardOrder({ ...boardOrder, [ws]: move(boardOrder[ws], i, -1) })} onDown={() => setBoardOrder({ ...boardOrder, [ws]: move(boardOrder[ws], i, 1) })} /></div>
                    <div className="px-3 font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">{`${wi + 1}.${i + 1}`}</div>
                    <div className="px-3 py-2.5 text-[13px] font-semibold text-tn-ink">{name}</div>
                    <div className="px-3"><span className={`${chip} ${PRIORITY_CHIP[b.priority]}`}>{b.priority}</span></div>
                    <div className="px-3 text-[13px] text-foreground">{b.open}</div>
                    <div className="px-3 text-[13px] text-[#c2410c] font-semibold">{b.late || <span className="text-[var(--faint)] font-normal">0</span>}</div>
                    <div className="px-3"><Moved from={TN_BOARDS[ws].indexOf(name)} to={i} /></div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {level === 'item' && (
        <div className={card}>
          <div className="grid bg-subtle border-b border-[var(--panel-border)] rounded-t-[14px]" style={{ gridTemplateColumns: '52px 72px minmax(0,1fr) 124px 190px' }}>
            <div className={HEAD} /><div className={HEAD}>Team #</div><div className={HEAD}>Step</div><div className={HEAD}>Board priority</div><div className={HEAD}>Change</div>
          </div>
          {items.slice(0, 14).map((r, i) => (
            <div key={r.item} className={`grid items-center border-b border-[var(--row-rule)] last:border-b-0 border-l-[3px] ${i === 0 ? 'border-l-tn-teal' : 'border-l-transparent'}`} style={{ gridTemplateColumns: '52px 72px minmax(0,1fr) 124px 190px' }}>
              <div className="px-3 py-2"><Arrows label={r.item} first={i === 0} last={false} onUp={() => {}} onDown={() => {}} /></div>
              <div className="px-3 font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">{i + 1}</div>
              <div className="px-3 py-2.5 min-w-0">
                <div className="text-[13px] font-semibold text-tn-ink truncate">{r.item}</div>
                <div className="text-[11.5px] text-muted truncate">
                  {`${r.board.ws} · ${r.board.name}`}{r.late && <span className="text-[#c2410c] font-semibold"> · late</span>}
                </div>
              </div>
              <div className="px-3"><span className={`${chip} ${PRIORITY_CHIP[r.board.priority]}`}>{r.board.priority}</span></div>
              <div className="px-3">
                {i === 0
                  ? <span className={`${chip} bg-[rgba(30,125,127,.12)] text-tn-teal`}>placed by hand</span>
                  : <span className="text-[11.5px] text-muted">workspace, then board</span>}
              </div>
            </div>
          ))}
          <div className="px-5 py-3 text-[12.5px] text-muted border-t border-[var(--row-rule)]">
            {`The first 14 of 820. Change the order at the Workspace or Board level and come back: this list follows it.`}
          </div>
        </div>
      )}

      <div className={`${card} p-5`}>
        <div className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">How the three levels make one list</div>
        <ol className="mt-3 space-y-2 text-[13px] text-foreground leading-relaxed list-none p-0 m-0">
          {[
            ['Workspaces', 'in your order. Everything in the first one comes before anything in the second.'],
            ['Boards', 'in your order, inside their workspace.'],
            ['Items', "inside a board follow True North's order: the soonest deadline first."],
            ['Placed by hand', 'at the Item level: keeps the place you gave it, above everything, even other workspaces.'],
            ['New workspaces and boards', "join at the end of their level until you place them. Reset puts any level back to True North's order."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-2.5">
              <span className="shrink-0 inline-flex items-center justify-center w-5 h-5 mt-px rounded-full bg-tn-teal-soft text-tn-teal font-(family-name:--font-display) font-extrabold text-[11px]">{i + 1}</span>
              <span><strong className="font-semibold text-tn-ink">{t}</strong> {d}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
