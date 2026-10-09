'use client'

// Screens 5.1 to 5.3: the person drawer, opened from a People row.
//
// The only place in the Report that queries per-item detail. Everything else
// is aggregates, which is why this is the one thing fetched on demand rather
// than with the page.

import { useRef } from 'react'
import { chip } from '@/components/monday/tokens'
import { useModal } from '@/components/ui/useModal'
import { formatDays } from '@/lib/report/overview'
import {
  hoursBar, landed, visibleDeliveries, type PersonDetail,
} from '@/lib/report/drawer'

const ROW_GRID = '1.9fr 1fr .8fr .8fr'
const HEAD_CELL =
  'px-3 py-2 font-(family-name:--font-display) font-extrabold text-[9.5px] tracking-[.06em] uppercase text-muted'
const SECTION_TITLE = 'font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink m-0'
const STAT_LABEL =
  'font-(family-name:--font-display) font-extrabold text-[9.5px] tracking-[.06em] uppercase text-muted'

export type DrawerPerson = {
  id: string
  name: string
  initials: string
  color: string
  team: string | null
  /** The four numbers already on their row, so the drawer reads on its own. */
  stats: { label: string; value: string }[]
  /** Open steps in their name now, for the empty state. */
  open: number
  inactive?: boolean
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}

export function PersonDrawer({
  person, detail, error, periodDays, onClose,
}: {
  person: DrawerPerson
  /** Null while the deliveries and hours are still being fetched. */
  detail: PersonDetail | null
  /** Why the detail could not be fetched, when it could not. */
  error?: string | null
  periodDays: number
  onClose: () => void
}) {
  // Focus in and back, Tab kept inside, Escape closes, the page stays put.
  const box = useRef<HTMLDivElement>(null)
  useModal(true, box, onClose)

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[rgba(1,35,88,.34)]"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={box}
        className="w-[640px] max-w-full h-full bg-white overflow-y-auto shadow-[0_24px_50px_-20px_rgba(1,35,88,.55)]"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={person.name}
      >
        <div className="px-[22px] pt-5 pb-[18px] border-b border-[var(--panel-border)] flex items-start gap-3.5">
          <span
            className="inline-flex w-[46px] h-[46px] flex-none rounded-full items-center justify-center font-(family-name:--font-display) font-extrabold text-[15px] text-white"
            style={{ background: person.color }}
          >
            {person.initials}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-(family-name:--font-display) font-extrabold text-[19px] text-tn-ink m-0">
              {person.name}
            </h3>
            <p className="text-[13px] text-muted mt-[3px] m-0">
              {`${person.team ?? 'No team'}${person.inactive ? ' · inactive' : ''} · last ${periodDays} days`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex-none w-8 h-8 inline-flex items-center justify-center rounded-[9px] text-muted hover:text-tn-ink hover:bg-subtle transition-colors"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Screen 5.2: these four are already on the row that was clicked, so
            they are drawn at once. Only the two sections below are fetched,
            and neither justifies a spinner over the whole panel. */}
        <div className="px-[22px] pt-4 pb-1.5 grid grid-cols-4 gap-3">
          {person.stats.map(s => (
            <div key={s.label} className="border border-[var(--panel-border)] rounded-[11px] px-[13px] py-[11px]">
              <div className={STAT_LABEL}>{s.label}</div>
              <div className="font-(family-name:--font-display) font-extrabold text-[20px] text-tn-ink mt-[5px]">
                {s.value}
              </div>
            </div>
          ))}
        </div>

        <div className="px-[22px] pt-4 pb-1.5">
          <h4 className={`${SECTION_TITLE} mb-1`}>Delivered in this period</h4>
          {error ? (
            <p role="alert" className="text-[12.5px] text-[#c2410c] m-0">{error}</p>
          ) : detail === null ? (
            <Skeleton rows={4} />
          ) : detail.deliveries.length === 0 ? (
            <NothingDelivered periodDays={periodDays} open={person.open} />
          ) : (
            <Deliveries detail={detail} />
          )}
        </div>

        <div className="px-[22px] pt-[18px] pb-6">
          <h4 className={`${SECTION_TITLE} mb-3`}>Hours logged, by project</h4>
          {error ? null : detail === null ? <Skeleton rows={4} /> : <Hours detail={detail} />}
        </div>
      </div>
    </div>
  )
}

function Deliveries({ detail }: { detail: PersonDetail }) {
  const { rows, hidden } = visibleDeliveries(detail.deliveries)

  return (
    <>
      <p className="text-[12px] text-muted m-0 mb-3">
        Held is the working days between the step landing on them and being marked done.
      </p>
      <div className="grid bg-subtle rounded-lg" style={{ gridTemplateColumns: ROW_GRID }}>
        <div className={HEAD_CELL}>Item</div>
        <div className={HEAD_CELL}>Step</div>
        <div className={`${HEAD_CELL} text-right`}>Held</div>
        <div className={`${HEAD_CELL} text-right`}>Landed</div>
      </div>
      {rows.map(r => {
        const l = landed(r.lateDays)
        return (
          <div key={r.id} className="grid border-b border-[var(--row-rule)]" style={{ gridTemplateColumns: ROW_GRID }}>
            <div className="px-3 py-2.5 text-[12.5px] font-semibold text-tn-ink leading-[1.4]">{r.item}</div>
            <div className="px-3 py-2.5 text-[12.5px] text-muted">{r.step}</div>
            <div className="px-3 py-2.5 text-right text-[12.5px] text-foreground">{formatDays(r.heldDays)}</div>
            <div className="px-3 py-2.5 text-right">
              <span className={`${chip} ${l.late
                ? 'bg-[rgba(194,65,12,.12)] text-[#c2410c]'
                : 'bg-[rgba(30,125,127,.12)] text-tn-teal'}`}
              >
                {l.label}
              </span>
            </div>
          </div>
        )
      })}
      {hidden > 0 ? (
        <p className="text-[12.5px] text-muted mt-2.5 m-0">
          Showing the {rows.length} most recent. {hidden} more in this period.
        </p>
      ) : null}
    </>
  )
}

function Hours({ detail }: { detail: PersonDetail }) {
  const most = Math.max(0, ...detail.hours.map(h => h.hours))

  if (!detail.hours.length) {
    return <p className="text-[12.5px] text-muted m-0">No hours logged in this period.</p>
  }

  return (
    <>
      <div className="flex flex-col gap-[11px]">
        {detail.hours.map(h => (
          <div key={`${h.folder ?? ''}|${h.project}`} className="flex items-center gap-3">
            <span className="w-[180px] flex-none min-w-0">
              <span className="block text-[12.5px] text-foreground truncate" title={h.project}>{h.project}</span>
              {h.folder ? <span className="block text-[11px] text-muted truncate">{h.folder}</span> : null}
            </span>
            <span className="flex-1 h-2 rounded-[4px] bg-subtle overflow-hidden" aria-hidden="true">
              <span className="block h-full rounded-[4px] bg-[#579BFC]" style={{ width: `${hoursBar(h, most)}%` }} />
            </span>
            <span className="w-[52px] flex-none text-right text-[12.5px] font-semibold text-tn-ink">{h.hours}h</span>
          </div>
        ))}
      </div>
      {/* Named so the number can be reconciled with the timeclock, rather
          than looking like a second, disagreeing source. */}
      <p className="text-[11.5px] text-muted mt-3 m-0">
        Approved hours, by the timeclock code they were logged to.
      </p>
    </>
  )
}

/**
 * Screen 5.3: a real case, so it says which case. The link to My Work it used
 * to carry opened the reader's own list, not theirs, so it says what is open
 * instead.
 */
function NothingDelivered({ periodDays, open }: { periodDays: number; open: number }) {
  return (
    <p className="text-[12.5px] text-muted m-0 leading-[1.6]">
      {`Nothing closed in the last ${periodDays} days. `}
      {open > 0 ? `${open} ${open === 1 ? 'step is' : 'steps are'} open in their name now.` : 'Nothing is open in their name now.'}
    </p>
  )
}

function Skeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-2.5" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className="block h-[34px] rounded-lg bg-subtle" />
      ))}
    </div>
  )
}
