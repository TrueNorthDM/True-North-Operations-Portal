/**
 * The item History, three ways to show whose step each change is. A mockup,
 * asked for on 18 September 2026.
 *
 * The item is real: HFA.ai 04/024 on HFA - Publishing, seen by Arnaldo, whose
 * step is Href Link. The changes are Monday's own log for it, newest first,
 * with the subscribe and add-owner noise left out.
 *
 * What the log alone does not say, and every option adds:
 *   - whose step a change belongs to. The owner is the person in the step's
 *     people column, which the portal already maps (monday_board_steps); the
 *     person who clicked is often somebody else (Wendy marked Publishing done,
 *     and Publishing is Samuel's).
 *   - who was assigned. "SEO 2" on its own was Monday putting Arnaldo on Href
 *     Link; the portal did not read the name out of that change.
 *
 * Only the reader's own steps get an avatar. Everyone else is a name.
 */

import { Avatar } from '@/components/Avatar'

export type Option = 'a' | 'b' | 'b2' | 'b2-navy' | 'b2-teal' | 'b2-label' | 'c'

/**
 * How another person's name is drawn on their step's card. Asked for on 18
 * September 2026: the outline pill, as a navy button with a gold symbol, and
 * two others to choose between.
 */
export type OwnerTag = 'outline' | 'navy' | 'teal' | 'label'

const ME = 'Arnaldo Oliveira'
const MY_AVATAR = 'https://xoahdamwwgogfhyawogs.supabase.co/storage/v1/object/public/avatars/d95bae40-e85b-49ff-a203-e8da8a92a129.jpg?v=1784323484508'

/** The item's steps, in workflow order, with their owner and state. */
const STEPS: { name: string; owner: string; status: string; colour: string }[] = [
  { name: 'Staging', owner: 'Wendy Cacka', status: 'Done', colour: '#00c875' },
  { name: 'Proofing', owner: 'Joy Deche', status: 'Done', colour: '#00c875' },
  { name: 'Implementation', owner: 'Samuel Manzi', status: 'Done', colour: '#00c875' },
  { name: 'Internal Linking', owner: 'Lana Hein', status: 'Done', colour: '#00c875' },
  { name: 'Publishing', owner: 'Samuel Manzi', status: 'Done', colour: '#00c875' },
  { name: 'Href Link', owner: ME, status: 'Apply Link', colour: '#faa1f1' },
]

interface Change {
  when: string
  /** The column Monday names. */
  column: string
  /** The step it belongs to, or null for the item itself (links, dates on no step). */
  step: string | null
  kind: 'status' | 'date' | 'assign' | 'other'
  from?: string
  to: string
  by?: string
}

const LOG: Change[] = [
  { when: 'Sep 17, 2026 at 2:28 PM', column: 'Set Up By', step: 'Href Link', kind: 'date', from: 'Sep 17', to: 'Sep 20' },
  { when: 'Sep 17, 2026 at 2:28 PM', column: 'SEO 2', step: 'Href Link', kind: 'assign', to: ME },
  { when: 'Sep 17, 2026 at 2:28 PM', column: 'Href Link', step: 'Href Link', kind: 'status', from: 'Run Link', to: 'Apply Link', by: ME },
  { when: 'Sep 17, 2026 at 2:28 PM', column: 'Zapier', step: null, kind: 'other', to: 'Activated' },
  { when: 'Sep 17, 2026 at 2:28 PM', column: 'Href Link', step: 'Href Link', kind: 'status', to: 'Run Link' },
  { when: 'Sep 17, 2026 at 2:28 PM', column: 'Published On', step: null, kind: 'date', to: 'Sep 17' },
  { when: 'Sep 17, 2026 at 2:28 PM', column: 'Publishing', step: 'Publishing', kind: 'status', from: "Hasn't Started Yet", to: 'Done', by: 'Wendy Cacka' },
  { when: 'Sep 17, 2026 at 2:27 PM', column: 'Page Link', step: null, kind: 'other', from: 'dev.hopefor.africa/…', to: 'hopefor.africa/en/relationships/…', by: 'Wendy Cacka' },
  { when: 'Aug 24, 2026 at 5:00 PM', column: 'Publish By', step: 'Publishing', kind: 'date', from: 'Aug 27', to: 'cleared', by: 'Wendy Cacka' },
  { when: 'Aug 24, 2026 at 4:58 PM', column: 'Publishing', step: 'Publishing', kind: 'status', from: 'Stuck', to: "Hasn't Started Yet", by: 'Wendy Cacka' },
  { when: 'Aug 22, 2026 at 8:45 AM', column: 'Publishing', step: 'Publishing', kind: 'status', from: "Hasn't Started Yet", to: 'Stuck' },
  { when: 'Aug 18, 2026 at 8:13 PM', column: 'Publisher', step: 'Publishing', kind: 'assign', to: 'Samuel Manzi' },
  { when: 'Aug 18, 2026 at 8:13 PM', column: 'Internal Linking', step: 'Internal Linking', kind: 'status', from: "Hasn't Started Yet", to: 'Done', by: 'Lana Hein' },
  { when: 'Aug 11, 2026 at 3:43 PM', column: 'Internal Linking', step: 'Internal Linking', kind: 'status', from: 'Stuck', to: "Hasn't Started Yet", by: 'Clarise Nixon' },
  { when: 'Aug 11, 2026 at 3:43 PM', column: 'SEO 1', step: 'Internal Linking', kind: 'assign', to: 'Lana Hein', by: 'Clarise Nixon' },
  { when: 'Aug 5, 2026 at 11:08 AM', column: 'Implementation', step: 'Implementation', kind: 'status', from: 'Stuck', to: 'Done', by: 'Samuel Manzi' },
  { when: 'Jul 31, 2026 at 4:46 AM', column: 'Proofing', step: 'Proofing', kind: 'status', from: 'Stuck', to: 'Done', by: 'Joy Deche' },
  { when: 'Jul 15, 2026 at 12:26 PM', column: 'Staging', step: 'Staging', kind: 'status', from: "Hasn't Started Yet", to: 'Done', by: 'Samuel Manzi' },
]

const ownerOf = (step: string | null) => STEPS.find(s => s.name === step)?.owner ?? null
const isMine = (c: Change) => ownerOf(c.step) === ME
const STATUS_TONE: Record<string, string> = { Done: '#00c875', Stuck: '#e2445c', "Hasn't Started Yet": '#c4c4c4', 'Apply Link': '#faa1f1', 'Run Link': '#9d99b9' }

function What({ c, showColumn = true }: { c: Change; showColumn?: boolean }) {
  if (c.kind === 'assign') {
    return (
      <span>
        {showColumn && <span className="font-bold">{c.step}</span>}
        <span className="text-muted">{showColumn ? ' assigned to ' : 'Assigned to '}</span>
        <span className="font-bold">{c.to === ME ? 'you' : c.to}</span>
        <span className="text-muted"> ({c.column})</span>
      </span>
    )
  }
  return (
    <span>
      {showColumn && <span className="font-bold">{c.column}</span>}
      {c.from && <span className="text-muted">{showColumn ? ' from ' : 'From '}{c.from}</span>}
      <span className="font-semibold">{c.from || showColumn ? ' → ' : '→ '}{c.to}</span>
    </span>
  )
}

function When({ c }: { c: Change }) {
  return (
    <div className="text-[11.5px] text-muted mt-0.5">
      {c.when}{c.by && <> · changed by <span className={c.by === ME ? 'font-semibold text-tn-ink' : ''}>{c.by === ME ? 'you' : c.by}</span></>}
    </div>
  )
}

const PERSON_SYMBOL = <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>

/** Another person's name on their card, in one of the styles being compared. */
function OwnerTagView({ name, tag }: { name: string; tag: OwnerTag }) {
  if (tag === 'navy') {
    // Save and close's palette: navy, white words, gold symbol.
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-tn-primary border border-tn-primary px-3 py-[5px] font-(family-name:--font-display) font-extrabold text-[12px] whitespace-nowrap shadow-[0_6px_14px_-8px_rgba(1,35,88,.6)]">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#F2C40A" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">{PERSON_SYMBOL}</svg>
        <span className="text-[#ffffff]">{name}</span>
      </span>
    )
  }
  if (tag === 'teal') {
    // A soft tag: keeps navy for the reader's own step.
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(30,125,127,.12)] px-3 py-[5px] font-(family-name:--font-display) font-extrabold text-[12px] text-tn-ink whitespace-nowrap">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1E9E6A" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">{PERSON_SYMBOL}</svg>
        {name}
      </span>
    )
  }
  if (tag === 'label') {
    // No shape at all: a small caption over the name, as the details box does.
    return (
      <span className="inline-flex flex-col leading-tight">
        <span className="font-(family-name:--font-display) font-extrabold text-[9.5px] tracking-[.08em] uppercase text-muted">Owner</span>
        <span className="inline-flex items-center gap-1.5 font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink whitespace-nowrap">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1E9E6A" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">{PERSON_SYMBOL}</svg>
          {name}
        </span>
      </span>
    )
  }
  return <OwnerName name={name} strong />
}

/** A name, made to read as a person: a small outline pill with a person symbol. */
function OwnerName({ name, strong = false }: { name: string; strong?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[12px] font-semibold whitespace-nowrap ${strong ? 'border-tn-ink text-tn-ink' : 'border-[var(--panel-border)] text-tn-ink bg-white'}`}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#1E9E6A" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>
      {name}
    </span>
  )
}

function YouBadge() {
  return <span className="inline-flex items-center rounded-full bg-tn-primary px-2 py-[2px] font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.06em] uppercase text-[#F2C40A]">Your step</span>
}

function MyAvatar({ size = 30 }: { size?: number }) {
  return <Avatar name={ME} avatarUrl={MY_AVATAR} size={size} className="ring-2 ring-[#F2C40A] ring-offset-2 ring-offset-white" />
}

function StatusDot({ status }: { status: string }) {
  return <span className="inline-flex items-center gap-1.5 rounded-[6px] px-2 py-[2px] text-[10.5px] font-extrabold uppercase tracking-[.05em] text-white" style={{ background: STATUS_TONE[status] ?? '#8593a4' }}>{status}</span>
}

// ── A. Owner on every line ────────────────────────────────────────────────
function OptionA() {
  return (
    <div className="space-y-1.5">
      {LOG.map((c, i) => {
        const owner = ownerOf(c.step)
        if (isMine(c)) {
          return (
            <div key={i} className="flex items-start gap-3 rounded-[12px] border border-[rgba(30,125,127,.35)] bg-[rgba(30,125,127,.07)] px-3 py-2.5">
              <MyAvatar size={28} />
              <div className="min-w-0 flex-1 text-[12.5px] leading-[1.45] text-tn-ink">
                <What c={c} />
                <When c={c} />
              </div>
              <YouBadge />
            </div>
          )
        }
        return (
          <div key={i} className="flex items-start gap-3 px-3 py-2">
            <span className={`mt-1.5 ml-[10px] mr-[9px] w-[7px] h-[7px] rounded-full shrink-0 ${owner ? 'bg-tn-teal' : 'bg-[var(--faint)]'}`} />
            <div className="min-w-0 flex-1 text-[12.5px] leading-[1.45] text-tn-ink">
              <What c={c} />
              <When c={c} />
            </div>
            {owner ? <OwnerName name={owner} /> : <span className="text-[11px] font-semibold uppercase tracking-[.06em] text-[var(--faint)] pt-1">Item</span>}
          </div>
        )
      })}
    </div>
  )
}

// ── B. Grouped by step ────────────────────────────────────────────────────
// `mirrored` (asked for on 18 September 2026, to try): on other people's cards
// the owner moves to the left and everything else to the right, the status
// chip sitting between them, just before the step's name. Your own card stays
// as it is.
function OptionB({ mirrored = false, tag = 'outline' }: { mirrored?: boolean; tag?: OwnerTag }) {
  const mine = STEPS.filter(s => s.owner === ME)
  const others = STEPS.filter(s => s.owner !== ME).reverse()
  const itemChanges = LOG.filter(c => c.step === null)
  return (
    <div className="space-y-2.5">
      {mine.map(s => {
        const changes = LOG.filter(c => c.step === s.name)
        return (
          <div key={s.name} className="rounded-[14px] border-2 border-tn-primary bg-white overflow-hidden">
            <div className="flex items-center gap-3 px-3.5 py-3 bg-[rgba(1,35,88,.04)] border-b border-[var(--panel-border)]">
              <MyAvatar size={34} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-(family-name:--font-display) font-extrabold text-[14.5px] text-tn-ink">{s.name}</span>
                  <StatusDot status={s.status} />
                </div>
                <div className="text-[12px] text-muted mt-0.5">Yours · Set up by Sep 20, in 2 days</div>
              </div>
              <YouBadge />
            </div>
            <div className="px-3.5 py-2.5 space-y-2">
              {changes.map((c, i) => (
                <div key={i} className="text-[12.5px] leading-[1.45] text-tn-ink"><What c={c} showColumn={c.column !== s.name} /><When c={c} /></div>
              ))}
            </div>
          </div>
        )
      })}

      {others.map(s => {
        const changes = LOG.filter(c => c.step === s.name)
        const last = changes[0]
        if (mirrored) {
          return (
            <div key={s.name} className="rounded-[14px] border border-[var(--panel-border)] bg-white px-3.5 py-3">
              <div className="flex items-center gap-2.5 flex-wrap">
                <OwnerTagView name={s.owner} tag={tag} />
                <span className="ml-auto inline-flex items-center gap-2.5">
                  <StatusDot status={s.status} />
                  <span className="font-(family-name:--font-display) font-extrabold text-[13.5px] text-tn-ink">{s.name}</span>
                </span>
              </div>
              {last && (
                <div className="mt-2 text-right text-[12.5px] leading-[1.45] text-tn-ink">
                  <What c={last} showColumn={last.column !== s.name} /><When c={last} />
                </div>
              )}
              {changes.length > 1 && <div className="mt-1.5 text-right text-[12px] font-semibold text-tn-teal">{`${changes.length - 1} earlier ${changes.length - 1 === 1 ? 'change' : 'changes'}`}</div>}
            </div>
          )
        }
        return (
          <div key={s.name} className="rounded-[14px] border border-[var(--panel-border)] bg-white px-3.5 py-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-(family-name:--font-display) font-extrabold text-[13.5px] text-tn-ink">{s.name}</span>
              <StatusDot status={s.status} />
              <span className="ml-auto"><OwnerName name={s.owner} strong /></span>
            </div>
            {last && (
              <div className="mt-2 text-[12.5px] leading-[1.45] text-tn-ink">
                <What c={last} showColumn={last.column !== s.name} /><When c={last} />
              </div>
            )}
            {changes.length > 1 && <div className="mt-1.5 text-[12px] font-semibold text-tn-teal">{`${changes.length - 1} earlier ${changes.length - 1 === 1 ? 'change' : 'changes'}`}</div>}
          </div>
        )
      })}

      <div className="rounded-[14px] border border-dashed border-[var(--panel-border)] px-3.5 py-3">
        <div className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted mb-2">The item itself</div>
        <div className="space-y-2">
          {itemChanges.map((c, i) => <div key={i} className="text-[12.5px] leading-[1.45] text-tn-ink"><What c={c} /><When c={c} /></div>)}
        </div>
      </div>
    </div>
  )
}

// ── C. Owner column ───────────────────────────────────────────────────────
function OptionC() {
  // Runs of consecutive changes with the same owner share one name in the lane.
  const runs: { owner: string | null; changes: Change[] }[] = []
  for (const c of LOG) {
    const owner = ownerOf(c.step)
    const last = runs[runs.length - 1]
    if (last && last.owner === owner) last.changes.push(c)
    else runs.push({ owner, changes: [c] })
  }
  return (
    <div className="rounded-[14px] border border-[var(--panel-border)] bg-white overflow-hidden">
      {runs.map((r, i) => {
        const mine = r.owner === ME
        return (
          <div key={i} className={`grid grid-cols-[132px_minmax(0,1fr)] border-b border-[var(--row-rule)] last:border-b-0 ${mine ? 'bg-[rgba(30,125,127,.08)] border-l-[3px] border-l-tn-teal' : ''}`}>
            <div className={`px-3 py-3 ${mine ? '' : 'border-r border-[var(--row-rule)]'}`}>
              {mine ? (
                <div className="flex flex-col items-start gap-1.5">
                  <MyAvatar size={36} />
                  <span className="font-(family-name:--font-display) font-extrabold text-[12.5px] text-tn-ink">You</span>
                </div>
              ) : r.owner ? (
                <div>
                  <div className="font-(family-name:--font-display) font-extrabold text-[13px] leading-tight text-tn-ink">{r.owner}</div>
                  <div className="text-[11px] text-muted mt-0.5">{r.changes[0].step}</div>
                </div>
              ) : (
                <div className="text-[11px] font-semibold uppercase tracking-[.06em] text-[var(--faint)]">Item</div>
              )}
            </div>
            <div className="px-3 py-2.5 space-y-2">
              {r.changes.map((c, j) => (
                <div key={j} className="text-[12.5px] leading-[1.45] text-tn-ink"><What c={c} /><When c={c} /></div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** The drawer as it is today, down to the History heading, then the option. */
export function HistoryMockup({ option }: { option: Option }) {
  return (
    <div className="w-full max-w-[560px] bg-white rounded-[16px] shadow-[0_24px_50px_-20px_rgba(1,35,88,.45)] overflow-hidden">
      <div className="border-b border-[var(--panel-border)] px-[18px] py-4">
        <div className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.07em] uppercase text-muted">Item</div>
        <h3 className="font-(family-name:--font-display) font-extrabold text-[17px] leading-[1.25] text-tn-ink m-0 mt-[3px]">HFA.ai 04/024 - How do I grow emotionally while I&apos;m in love?</h3>
      </div>
      <div className="px-[18px] pt-4 pb-5">
        <dl className="grid grid-cols-[104px_minmax(0,1fr)] gap-x-3 gap-y-2.5 m-0 mb-5 rounded-[12px] border border-[var(--panel-border)] bg-subtle px-3.5 py-3 text-[13px] text-tn-ink">
          {[['Language', 'English'], ['Board', 'HFA - Publishing'], ['Workspace', 'Africa'], ['Assignee', ME], ['Step', 'Href Link · Apply Link'], ['Set up by', 'Sep 20, 2026 · in 2d']].map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.07em] uppercase text-muted pt-[3px]">{k}</dt>
              <dd className="m-0">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="flex items-baseline justify-between mb-3">
          <h4 className="font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink m-0">History</h4>
          <span className="text-[11.5px] text-muted">{`${LOG.length} changes · newest first`}</span>
        </div>
        {option === 'a' ? <OptionA />
          : option === 'b' ? <OptionB />
          : option === 'b2' ? <OptionB mirrored />
          : option === 'b2-navy' ? <OptionB mirrored tag="navy" />
          : option === 'b2-teal' ? <OptionB mirrored tag="teal" />
          : option === 'b2-label' ? <OptionB mirrored tag="label" />
          : <OptionC />}
      </div>
    </div>
  )
}
