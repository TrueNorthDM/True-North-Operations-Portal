// Screens 2.1, 2.2, 2.4 and 2.5: scope, period and export.
//
// Every control is a link, not a button with an onChange, so the page stays a
// server component and any state it holds is in the URL. Tab, scope, period,
// team and person all travel together, which is what makes a report pasteable
// into Slack: whoever clicks it sees the same thing the sender did.
//
// Permission is a shorter control, never a disabled one. A level 1 person
// gets a scope switch with one segment and two tabs fewer, and nothing on
// screen suggests there is a version of the page they are being kept from.

import Link from 'next/link'
import {
  PERIODS, PERIOD_LABEL, SCOPE_LABEL, reportHref, scopesFor, type ReportState,
} from '@/lib/report/scope'

const SEGMENT_BOX = 'flex items-center bg-subtle border border-[var(--panel-border)] rounded-[10px] p-[3px]'
const SEGMENT = 'font-(family-name:--font-display) font-extrabold text-[13px] px-3.5 py-1.5 rounded-lg transition-colors'
const SEGMENT_ON = 'bg-white text-tn-ink shadow-[0_1px_3px_rgba(1,35,88,.14)]'
const SEGMENT_OFF = 'text-muted hover:text-tn-ink'

const EXPORT_BUTTON =
  'inline-flex items-center gap-[7px] text-[13px] font-semibold px-[13px] py-[9px] rounded-[10px] border border-[var(--panel-border)] bg-white text-foreground hover:bg-[var(--row-hover)] transition-colors'

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5M12 15V3" />
    </svg>
  )
}

export function ReportControls({
  state, level, note, base = '/report', canExport = false,
}: {
  state: ReportState
  level: number
  /** The real person count and change-log start date, never a constant. */
  note: string
  base?: string
  canExport?: boolean
}) {
  const scopes = scopesFor(level)

  return (
    <div className="flex items-center gap-2.5 flex-wrap mb-4">
      <div className={SEGMENT_BOX}>
        {scopes.map(s => (
          <Link
            key={s}
            href={reportHref(base, state, { scope: s })}
            aria-current={s === state.scope ? 'true' : undefined}
            className={`${SEGMENT} ${s === state.scope ? SEGMENT_ON : SEGMENT_OFF}`}
          >
            {SCOPE_LABEL[s]}
          </Link>
        ))}
      </div>

      <div className={SEGMENT_BOX}>
        {PERIODS.map(p => (
          <Link
            key={p}
            href={reportHref(base, state, { period: p })}
            aria-current={p === state.period ? 'true' : undefined}
            className={`${SEGMENT} ${p === state.period ? SEGMENT_ON : SEGMENT_OFF}`}
          >
            {PERIOD_LABEL[p]}
          </Link>
        ))}
      </div>

      <span className="text-[12.5px] text-muted">{note}</span>

      {canExport ? (
        <div className="ml-auto flex items-center gap-2.5">
          {/* The export carries the current tab, scope and period, so what
              downloads is what is on screen and not the default view. */}
          <a className={EXPORT_BUTTON} href={reportHref(`${base}/csv`, state)}>
            <DownloadIcon />CSV
          </a>
          <a className={EXPORT_BUTTON} href={reportHref(`${base}/pdf`, state)}>
            <DownloadIcon />PDF
          </a>
        </div>
      ) : null}
    </div>
  )
}
