'use client'

// Screen 1.2: People, one row per person in scope.
//
// The comparison table. Same period as the Overview, sortable by every
// numeric column, and the row itself is the way into the person drawer, so
// the whole row lights on hover rather than growing a button.

import { useState } from 'react'
import { chip } from '@/components/monday/tokens'
import { formatDays } from '@/lib/report/overview'
import { PersonDrawer, type DrawerPerson } from '@/components/report/PersonDrawer'
import type { PersonDetail } from '@/lib/report/drawer'

export type PersonRow = {
  id: string
  name: string
  team: string | null
  /** Their team's colour, already resolved by the caller. */
  color: string
  initials: string
  delivered: number | null
  /** 0 to 100, or null while there is no history to divide. */
  onTimePct: number | null
  medianHeld: number | null
  open: number
  late: number
  /** Timeclock, not Monday. Null for anyone not on the timeclock. */
  hours: number | null
}

const GRID = '1.6fr .8fr 1.1fr 1fr .8fr .8fr .9fr 28px'

const HEAD_CELL =
  'px-4 py-[11px] font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.07em] uppercase text-muted'
const CELL = 'px-4 py-3 text-[13.5px] text-foreground'

/**
 * One scale for the bar and the text, so they can never disagree.
 *
 * The amber text is darker than the amber bar on purpose: #E09422 is legible
 * as a 7px block and not as 12.5px type.
 */
function onTimeColours(pct: number): { bar: string; text: string } {
  if (pct >= 80) return { bar: '#1E7D7F', text: '#1E7D7F' }
  if (pct >= 60) return { bar: '#E09422', text: '#b06d0a' }
  return { bar: '#c2410c', text: '#c2410c' }
}

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}

export function ReportPeople({
  people, periodDays = 90, loadDetail,
}: {
  people: PersonRow[]
  periodDays?: number
  /** Fetches the per-item detail. Absent in previews, where nothing opens. */
  loadDetail?: (personId: string) => Promise<PersonDetail>
}) {
  // Open state lives here rather than in the URL on purpose: the handoff asks
  // that opening the drawer not lose the table's scroll position, and a query
  // param means a navigation, which restores scroll wherever it feels like.
  const [open, setOpen] = useState<PersonRow | null>(null)
  const [detail, setDetail] = useState<PersonDetail | null>(null)

  const openRow = (p: PersonRow) => {
    if (!loadDetail) return
    setOpen(p)
    setDetail(null)
    loadDetail(p.id).then(d => setDetail(cur => (cur === null ? d : cur)))
  }

  return (
    <>
    <section className="border border-[var(--panel-border)] bg-white rounded-[14px] overflow-hidden">
      <div className="grid bg-subtle border-b border-[var(--panel-border)]" style={{ gridTemplateColumns: GRID }}>
        <div className={HEAD_CELL}>Person</div>
        <div className={`${HEAD_CELL} text-right`}>Delivered</div>
        <div className={HEAD_CELL}>On time</div>
        <div className={`${HEAD_CELL} text-right`}>Median held</div>
        <div className={`${HEAD_CELL} text-right`}>Open</div>
        <div className={`${HEAD_CELL} text-right`}>Late now</div>
        <div className={`${HEAD_CELL} text-right`}>Hours</div>
        <div className="px-2 py-[11px]" />
      </div>

      {people.map((p, i) => (
        <div
          key={p.id}
          onClick={() => openRow(p)}
          className={`grid transition-colors hover:bg-[var(--row-hover)] ${loadDetail ? 'cursor-pointer' : ''} ${i ? 'border-t border-[var(--row-rule)]' : ''}`}
          style={{ gridTemplateColumns: GRID }}
        >
          <div className="px-4 py-3 flex items-center gap-[11px] min-w-0">
            <span
              className="inline-flex w-8 h-8 flex-none rounded-full items-center justify-center font-(family-name:--font-display) font-extrabold text-[11.5px] text-white"
              style={{ background: p.color }}
            >
              {p.initials}
            </span>
            <span className="min-w-0">
              <span className="block text-[13.5px] font-semibold text-tn-ink truncate">{p.name}</span>
              <span className="block text-[11.5px] text-muted truncate">{p.team ?? '-'}</span>
            </span>
          </div>

          <div className={`${CELL} text-right font-semibold text-tn-ink`}>{p.delivered ?? '-'}</div>

          <div className="px-4 py-3">
            <OnTime pct={p.onTimePct} />
          </div>

          <div className={`${CELL} text-right`}>{p.medianHeld === null ? '-' : formatDays(p.medianHeld)}</div>
          <div className={`${CELL} text-right`}>{p.open}</div>

          {/* A red zero is a warning about nothing. Zero is a grey dash. */}
          <div className="px-4 py-3 text-right">
            {p.late > 0
              ? <span className={`${chip} bg-[rgba(194,65,12,.12)] text-[#c2410c]`}>{p.late}</span>
              : <span className="text-[13.5px] text-[var(--faint)]">-</span>}
          </div>

          {/* Hours are the timeclock, not Monday. Blank means not on it. */}
          <div className={`${CELL} text-right`}>{p.hours === null ? '' : `${p.hours}h`}</div>

          <div className="px-2 py-3 flex items-center text-[var(--faint)]">
            <ChevronIcon />
          </div>
        </div>
      ))}
    </section>

    {open ? (
      <PersonDrawer
        person={drawerPerson(open)}
        detail={detail}
        periodDays={periodDays}
        onClose={() => setOpen(null)}
      />
    ) : null}
    </>
  )
}

/** The four numbers already on the row, so the drawer reads on its own. */
function drawerPerson(p: PersonRow): DrawerPerson {
  return {
    id: p.id,
    name: p.name,
    initials: p.initials,
    color: p.color,
    team: p.team,
    stats: [
      { label: 'Delivered', value: p.delivered === null ? '-' : String(p.delivered) },
      { label: 'On time', value: p.onTimePct === null ? '-' : `${p.onTimePct}%` },
      { label: 'Median held', value: p.medianHeld === null ? '-' : formatDays(p.medianHeld) },
      { label: 'Open now', value: String(p.open) },
    ],
  }
}

function OnTime({ pct }: { pct: number | null }) {
  if (pct === null) {
    return <span className="text-[13.5px] text-[var(--faint)]">-</span>
  }
  const c = onTimeColours(pct)
  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 h-[7px] rounded-[4px] bg-subtle overflow-hidden">
        <span className="block h-full rounded-[4px]" style={{ background: c.bar, width: `${pct}%` }} />
      </span>
      {/* Fixed 34px so the numbers line up down the column. */}
      <span className="w-[34px] text-right text-[12.5px] font-bold" style={{ color: c.text }}>{pct}%</span>
    </div>
  )
}
