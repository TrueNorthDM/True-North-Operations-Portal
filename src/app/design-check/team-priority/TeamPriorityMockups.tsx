'use client'

/**
 * Team priority, as decided on 16 September 2026, before anything is built.
 *
 *   - Each team has one priority order. Its team leader sets it; an admin can
 *     set any team's. Nobody else changes priorities.
 *   - Everyone on the team sees their own steps in that order, read only.
 *   - Steps the leader has not placed follow the default order: the board's
 *     priority, then the soonest deadline.
 *
 * The leader's screen carries the A + C design chosen earlier: an agreement card
 * on top (here, the team's order against the default one) and a ranked list
 * with how far each step moved. The member's screen reads the same order, and
 * on the full page the two share state, so moving a step for the team moves it
 * on the member's list too.
 *
 * Fixture data only; nothing is saved.
 */

import { useMemo, useState } from 'react'
import { chip, PRIORITY_CHIP, DUE_BADGE } from '@/components/monday/tokens'

type Priority = 'high' | 'medium' | 'low'
interface Step {
  id: string
  item: string
  language?: string
  board: string
  step: string
  person: string
  priority: Priority
  due: string
  dueLabel: string
  status: string
  statusColor: string
  isNew?: boolean
}

const TODAY = '2026-09-16'
const STEPS: Step[] = [
  { id: 's1', item: 'B82: best moisture meter for water restoration', board: 'BM - General Audits', step: 'SEO Review', person: 'Jeannette Owens', priority: 'high', due: '2026-08-29', dueLabel: 'Aug 29', status: 'Stuck', statusColor: '#E2445C' },
  { id: 's2', item: 'Lead Magnet - How to Use Bessemeter Pro', board: 'BM - General Audits', step: 'Audit', person: 'Stephanie Aguirre', priority: 'high', due: '2026-09-25', dueLabel: 'Sep 25', status: "Hasn't Started Yet", statusColor: '#C4C4C4' },
  { id: 's3', item: '128 - How do Adventists view the concept of the end of the world?', language: 'English', board: 'AAAF - Publishing', step: 'Href Link', person: 'Arnaldo Oliveira', priority: 'high', due: '2026-09-07', dueLabel: 'Sep 7', status: 'Stuck', statusColor: '#E2445C' },
  { id: 's4', item: 'PP09/21 - Was Ellen White a prophet', language: 'Spanish', board: 'AAAF - Publishing', step: 'Href Link', person: 'Arnaldo Oliveira', priority: 'high', due: '2026-09-14', dueLabel: 'Sep 14', status: 'Stuck', statusColor: '#E2445C' },
  { id: 's5', item: 'Wagner Meters Wood Flooring Newsletter', board: 'WM - Schema Audits', step: 'Audit', person: 'Jeannette Owens', priority: 'medium', due: '2026-09-12', dueLabel: 'Sep 12', status: 'Stuck', statusColor: '#E2445C' },
  { id: 's6', item: 'How Do Adventists Do Baby Dedications?', board: 'AAAF - Photo Curation Audits', step: 'Photo Curation Audit', person: 'Stephanie Aguirre', priority: 'medium', due: '2026-09-17', dueLabel: 'Sep 17', status: 'Working on it', statusColor: '#FDAB3D' },
  { id: 's7', item: "Moisture meter buyer's guide", board: 'WM - Content Audits', step: 'Full-page Audit', person: 'Kathleen Aguilar', priority: 'medium', due: '2026-09-22', dueLabel: 'Sep 22', status: 'Working on it', statusColor: '#FDAB3D' },
  { id: 's8', item: '02 - Good Vs. Evil (Salvation)', board: 'AAAF - SEO & Writing', step: 'Brief Draft SEO', person: 'Stephanie Aguirre', priority: 'medium', due: '2026-09-30', dueLabel: 'Sep 30', status: "Hasn't Started Yet", statusColor: '#C4C4C4' },
  { id: 's9', item: 'Monthly Reporting Steps - adventist.org', board: "SOP's for the SEO's", step: 'Status', person: 'Jeannette Owens', priority: 'low', due: '2026-09-18', dueLabel: 'Sep 18', status: 'Working on it', statusColor: '#FDAB3D' },
  { id: 's10', item: 'Fundamental Beliefs infographic', board: 'Graphics Requests - All Projects', step: 'Finalization', person: 'Kathleen Aguilar', priority: 'low', due: '2026-10-09', dueLabel: 'Oct 9', status: "Hasn't Started Yet", statusColor: '#C4C4C4' },
  { id: 's11', item: '137 - How does the Holy Spirit work?', language: 'English', board: 'AAAF - Publishing', step: 'On-Page SEO', person: 'Stephanie Aguirre', priority: 'high', due: '2026-09-30', dueLabel: 'Sep 30', status: "Hasn't Started Yet", statusColor: '#C4C4C4', isNew: true },
]

const RANK = { high: 0, medium: 1, low: 2 }
const byId = new Map(STEPS.map(s => [s.id, s]))
/** Board priority, then the soonest deadline: the order every team starts from. */
const DEFAULT_ORDER = [...STEPS].sort((a, b) => RANK[a.priority] - RANK[b.priority] || a.due.localeCompare(b.due)).map(s => s.id)
/** A leader who has already placed a few steps: the lead magnet and the baby dedication pushed up, the late SEO review down. */
const PRESET = ['s2', 's6', 's3', 's4', 's1', 's11', 's5', 's7', 's8', 's9', 's10']

const TEAMS = [
  { id: 'seo', name: 'SEO Team', lead: 'Jeannette Owens', led: true },
  { id: 'graphics', name: 'Graphics & Social Media', lead: 'Stephanie Aguirre', led: false },
  { id: 'writing', name: 'Writing', lead: 'Amy Prindle', led: false },
  { id: 'africa', name: 'Africa', lead: 'Gad Rukundo', led: false },
]

function move(order: string[], id: string, dir: -1 | 1): string[] {
  const i = order.indexOf(id), j = i + dir
  if (j < 0 || j >= order.length) return order
  const next = [...order]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

/** Spearman's rank correlation as 0 to 100: 100 is the default order, 0 its reverse. */
function agreement(order: string[], base: string[]): number {
  const n = order.length
  const d2 = order.reduce((s, id, i) => s + (i - base.indexOf(id)) ** 2, 0)
  return Math.round(((1 - (6 * d2) / (n * (n * n - 1)) + 1) / 2) * 100)
}

const head = 'px-3 py-[10px] font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.07em] uppercase text-muted'
const card = 'rounded-[14px] border border-[var(--panel-border)] bg-white overflow-hidden'

function Segmented({ items, active }: { items: string[]; active: string }) {
  return (
    <div className="inline-flex items-center bg-subtle border border-[var(--panel-border)] rounded-[10px] p-[3px]">
      {items.map(i => (
        <span key={i} className={`font-(family-name:--font-display) font-extrabold text-[13px] px-3.5 py-1.5 rounded-[8px] ${i === active ? 'bg-white text-tn-ink shadow-[0_1px_3px_rgba(1,35,88,.14)]' : 'text-muted'}`}>{i}</span>
      ))}
    </div>
  )
}

function Delta({ by }: { by: number }) {
  if (by === 0) return <span className={`${chip} bg-[var(--chip-neutral-bg)] text-[var(--chip-neutral-fg)]`}>same</span>
  return by > 0
    ? <span className={`${chip} bg-[rgba(30,125,127,.12)] text-tn-teal`}>{`up ${by}`}</span>
    : <span className={`${chip} bg-[rgba(224,138,30,.16)] text-[#b06d0a]`}>{`down ${-by}`}</span>
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

function StepCell({ s }: { s: Step }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[13px] font-semibold text-tn-ink truncate">{s.item}</span>
        {s.isNew && <span className={`${chip} bg-[rgba(1,35,88,.08)] text-tn-ink shrink-0`}>new</span>}
      </div>
      <div className="text-[11.5px] text-muted truncate">{[s.language, s.board, s.step, `due ${s.dueLabel}`].filter(Boolean).join(' · ')}</div>
    </div>
  )
}

/** Screen chrome: a thin frame with a caption, so each screen reads as one. */
function Screen({ who, children }: { who: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[18px] border border-[var(--panel-border)] bg-background p-5 space-y-3.5">
      <div className="flex items-center gap-2 text-[12px] text-muted">
        <span className="w-2 h-2 rounded-full bg-tn-teal" />
        {who}
      </div>
      {children}
    </div>
  )
}

// ── 1. The team leader sets the team's order ───────────────────────────────

export function LeaderScreen({ order, setOrder }: { order: string[]; setOrder: (o: string[]) => void }) {
  const score = agreement(order, DEFAULT_ORDER)
  const moved = order.filter((id, i) => DEFAULT_ORDER.indexOf(id) !== i).length
  const diffs = useMemo(() => order
    .map(id => ({ id, by: DEFAULT_ORDER.indexOf(id) - order.indexOf(id) }))
    .filter(d => Math.abs(d.by) >= 2)
    .sort((x, y) => Math.abs(y.by) - Math.abs(x.by)), [order])
  const up = diffs.filter(d => d.by > 0).slice(0, 3)
  const down = diffs.filter(d => d.by < 0).slice(0, 3)
  const cols = '44px 52px minmax(0,1fr) 140px 88px 70px 96px'

  return (
    <Screen who="Jeannette Owens · team leader of the SEO Team">
      <div className="flex items-center gap-2.5 flex-wrap">
        <Segmented items={['Mine', 'Everyone', 'Team priority']} active="Team priority" />
        <span className="inline-flex items-center gap-2 px-3 py-[9px] rounded-[10px] border border-tn-teal bg-white font-(family-name:--font-display) font-semibold text-[13px] text-tn-teal">
          SEO Team
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
        </span>
        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted ml-auto">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1E7D7F" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
          Saved · the SEO Team sees this order
        </span>
      </div>

      <div className="rounded-[14px] border border-[var(--panel-border)] bg-white p-4 grid gap-5" style={{ gridTemplateColumns: '200px minmax(0,1fr) minmax(0,1fr)' }}>
        <div>
          <div className={`${head} px-0 py-0`}>Agreement with the default order</div>
          <div className="font-(family-name:--font-display) font-extrabold text-[30px] leading-none text-tn-ink mt-2">{`${score}%`}</div>
          <div className="h-1.5 rounded-full bg-subtle mt-2 overflow-hidden"><div className="h-full rounded-full bg-tn-teal" style={{ width: `${score}%` }} /></div>
          <div className="text-[12px] text-muted mt-2">{`${moved} of ${order.length} steps moved · board priority, then deadline`}</div>
          <button type="button" onClick={() => setOrder(DEFAULT_ORDER)} className="text-[12.5px] font-semibold text-tn-teal hover:underline mt-1">Reset to the default order</button>
        </div>
        <div>
          <div className={`${head} px-0 py-0`}>You moved up</div>
          {up.length === 0 && <div className="text-[12.5px] text-muted mt-2">Nothing</div>}
          {up.map(d => (
            <div key={d.id} className="flex items-center gap-2 mt-2">
              <Delta by={d.by} />
              <span className="text-[12.5px] text-tn-ink truncate">{byId.get(d.id)!.item}</span>
            </div>
          ))}
        </div>
        <div>
          <div className={`${head} px-0 py-0`}>You moved down</div>
          {down.length === 0 && <div className="text-[12.5px] text-muted mt-2">Nothing</div>}
          {down.map(d => (
            <div key={d.id} className="flex items-center gap-2 mt-2">
              <Delta by={d.by} />
              <span className="text-[12.5px] text-tn-ink truncate">{byId.get(d.id)!.item}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={card}>
        <div className="grid bg-subtle border-b border-[var(--panel-border)] border-l-[3px] border-l-transparent" style={{ gridTemplateColumns: cols }}>
          <div className={head} />
          <div className={head}>Team</div>
          <div className={head}>Step</div>
          <div className={head}>Person</div>
          <div className={head}>Priority</div>
          <div className={head}>Default</div>
          <div className={head}>Change</div>
        </div>
        {order.map((id, i) => {
          const s = byId.get(id)!
          const by = DEFAULT_ORDER.indexOf(id) - i
          const mark = s.isNew ? 'border-l-tn-primary' : Math.abs(by) < 2 ? 'border-l-transparent' : by > 0 ? 'border-l-tn-teal' : 'border-l-[#E08A1E]'
          return (
            <div key={id} className={`grid items-center border-b border-[var(--row-rule)] last:border-b-0 border-l-[3px] ${mark} hover:bg-[var(--row-hover)]`} style={{ gridTemplateColumns: cols }}>
              <div className="px-2 py-2"><Arrows onUp={() => setOrder(move(order, id, -1))} onDown={() => setOrder(move(order, id, 1))} /></div>
              <div className="px-3 font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">{i + 1}</div>
              <div className="px-3 py-2.5"><StepCell s={s} /></div>
              <div className="px-3 text-[13px] text-foreground truncate">{s.person}</div>
              <div className="px-3"><span className={`${chip} ${PRIORITY_CHIP[s.priority]}`}>{s.priority}</span></div>
              <div className="px-3 text-[13px] text-muted">{DEFAULT_ORDER.indexOf(id) + 1}</div>
              <div className="px-3">{s.isNew ? <span className="text-[11.5px] text-muted leading-tight block">placed by default</span> : <Delta by={by} />}</div>
            </div>
          )
        })}
      </div>
      <p className="text-[12px] text-muted m-0 leading-relaxed">
        A new step (marked <span className="font-semibold">new</span>) lands where the default order puts it and stays marked until you move it. Finished steps leave the list on their own.
      </p>
    </Screen>
  )
}

// ── 2. Each person sees their own steps in the team's order ────────────────

export function MemberScreen({ order, person = 'Stephanie Aguirre' }: { order: string[]; person?: string }) {
  const mine = order.filter(id => byId.get(id)!.person === person)
  const cols = '44px 44px 60px minmax(0,1fr) 150px 130px 190px 90px 110px'
  const late = (s: Step) => s.due < TODAY

  return (
    <Screen who={`${person} · on the SEO Team`}>
      <div className="flex items-center gap-2.5 flex-wrap">
        <Segmented items={['Mine', 'Everyone']} active="Mine" />
        <span className="text-[12.5px] text-muted ml-auto">{`${mine.length} open`}</span>
      </div>

      {/* Said once, above the list, where the order is decided: who set it and when. */}
      <div className="flex items-center gap-3 rounded-[12px] border border-[rgba(30,125,127,.28)] bg-[rgba(30,125,127,.06)] px-4 py-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1E7D7F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h6" /></svg>
        <span className="text-[13px] text-tn-ink">
          <span className="font-semibold">Ordered by the SEO Team priority</span>
          <span className="text-muted">, set by Jeannette Owens · updated today at 10:32</span>
        </span>
        <span className="text-[12px] text-muted ml-auto">Team leaders and admins set priorities</span>
      </div>

      <div className={card}>
        <div className="grid bg-subtle border-b border-[var(--panel-border)]" style={{ gridTemplateColumns: cols }}>
          <div className={head} />
          <div className={head} />
          <div className={head}>Team</div>
          <div className={head}>Item</div>
          <div className={head}>Board</div>
          <div className={head}>Step</div>
          <div className={head}>Status</div>
          <div className={`${head} text-right`}>Due</div>
          <div className={`${head} text-right`}>Time</div>
        </div>
        {mine.map(id => {
          const s = byId.get(id)!
          return (
            <div key={id} className="grid items-center border-b border-[var(--row-rule)] last:border-b-0" style={{ gridTemplateColumns: cols }}>
              <div className="px-2 py-2.5 flex justify-center">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-[7px] bg-[var(--chip-neutral-bg)] text-tn-teal">
                  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>
                </span>
              </div>
              <div className="px-2 py-2.5 flex justify-center">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-[7px] bg-[var(--chip-neutral-bg)] text-tn-teal">
                  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 2.64-6.36" /><polyline points="3 4 3 9 8 9" /><polyline points="12 7.5 12 12 15 14" /></svg>
                </span>
              </div>
              <div className="px-3 font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">{order.indexOf(id) + 1}</div>
              <div className="px-3 py-2.5 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[13px] font-semibold text-tn-ink truncate">{s.item}</span>
                  {s.isNew && <span className={`${chip} bg-[rgba(1,35,88,.08)] text-tn-ink shrink-0`}>new</span>}
                </div>
                {s.language && <div className="text-[11.5px] text-muted">{s.language}</div>}
              </div>
              <div className="px-3 text-[13px] text-muted truncate">{s.board}</div>
              <div className="px-3 text-[13px] text-muted truncate">{s.step}</div>
              <div className="px-3"><span className={`${chip} text-white`} style={{ background: s.statusColor }}>{s.status}</span></div>
              <div className="px-3 text-[13px] text-tn-ink text-right">{s.dueLabel}</div>
              <div className="px-3 flex justify-end">
                <span className={`${chip} ${late(s) ? DUE_BADGE.late.className : DUE_BADGE.upcoming.className}`}>{late(s) ? 'late' : 'upcoming'}</span>
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-[12px] text-muted m-0 leading-relaxed">
        No arrows here: the order is the team&apos;s. Sorting by a column still works for a quick look, and &ldquo;Team priority&rdquo; puts the list back.
        The Team number is the step&apos;s place in the whole team&apos;s list, so a 6 means sixth for the team, not sixth for Stephanie.
      </p>
    </Screen>
  )
}

// ── 3. Admins can set any team's order ─────────────────────────────────────

export function AdminScreen() {
  return (
    <Screen who="Arnaldo Oliveira · admin">
      <div className="grid gap-5" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
        <div className="space-y-2.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <Segmented items={['Mine', 'Everyone', 'Team priority']} active="Team priority" />
            <span className="inline-flex items-center gap-2 px-3 py-[9px] rounded-[10px] border border-tn-teal bg-white font-(family-name:--font-display) font-semibold text-[13px] text-tn-teal">Choose a team</span>
          </div>
          <div className="w-[300px] rounded-[12px] border border-[var(--panel-border)] bg-white p-1.5 shadow-[0_24px_50px_-20px_rgba(1,35,88,.4)]">
            <div className="px-2.5 pt-1.5 pb-1 font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.07em] uppercase text-muted">Every team</div>
            {TEAMS.map(t => (
              <div key={t.id} className={`flex items-center justify-between gap-3 px-2.5 py-2 rounded-[8px] ${t.id === 'seo' ? 'bg-[rgba(30,125,127,.08)]' : ''}`}>
                <span className="text-[13px] font-semibold text-tn-ink">{t.name}</span>
                <span className="text-[11.5px] text-muted">{`lead: ${t.lead}`}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[14px] border border-[var(--panel-border)] bg-white p-4 space-y-3 text-[13px] leading-relaxed text-foreground">
          <div className={`${head} px-0 py-0`}>Who can change priorities</div>
          <div className="flex gap-3"><span className={`${chip} bg-[rgba(30,125,127,.12)] text-tn-teal shrink-0`}>team leader</span><span>Their own team&apos;s order, and only the teams they lead.</span></div>
          <div className="flex gap-3"><span className={`${chip} bg-[rgba(1,35,88,.08)] text-tn-ink shrink-0`}>admin</span><span>Any team&apos;s order, and the board priorities the default order starts from (Settings → My Work sources).</span></div>
          <div className="flex gap-3"><span className={`${chip} bg-[var(--chip-neutral-bg)] text-[var(--chip-neutral-fg)] shrink-0`}>everyone else</span><span>Sees their steps in their team&apos;s order. Nothing to change.</span></div>
        </div>
      </div>
    </Screen>
  )
}

// ── The page: leader and member share one order ────────────────────────────

export function TeamPriorityDemo({ only }: { only?: string }) {
  const [order, setOrder] = useState(PRESET)
  const show = (k: string) => !only || only === k
  return (
    <div className="space-y-10">
      {show('1') && (
        <section className="space-y-3">
          <div>
            <h2 className="font-(family-name:--font-display) font-extrabold text-[18px] text-tn-ink m-0">1 · The team leader sets the team&apos;s order</h2>
            <p className="text-[13.5px] text-muted mt-1 m-0 leading-relaxed">My Work gets a third view for team leaders and admins, Team priority: every open step on the team in one list. The card on top compares that order with the default one; the arrows (or dragging) change it, and it saves as it goes.</p>
          </div>
          <LeaderScreen order={order} setOrder={setOrder} />
        </section>
      )}
      {show('2') && (
        <section className="space-y-3">
          <div>
            <h2 className="font-(family-name:--font-display) font-extrabold text-[18px] text-tn-ink m-0">2 · Everyone on the team sees their steps in that order</h2>
            <p className="text-[13.5px] text-muted mt-1 m-0 leading-relaxed">Stephanie&apos;s My Work follows the SEO Team order, read only, with who set it and when. On this page it is live: move a step above and it moves here.</p>
          </div>
          <MemberScreen order={order} />
        </section>
      )}
      {show('3') && (
        <section className="space-y-3">
          <div>
            <h2 className="font-(family-name:--font-display) font-extrabold text-[18px] text-tn-ink m-0">3 · Admins can set any team&apos;s order</h2>
            <p className="text-[13.5px] text-muted mt-1 m-0 leading-relaxed">The same Team priority view, with every team in the picker instead of only the teams the person leads.</p>
          </div>
          <AdminScreen />
        </section>
      )}
    </div>
  )
}
