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

'use client'

import { ExportMenu } from '@/components/report/ExportMenu'
import { useReportNav } from '@/components/report/ReportFrame'
import {
  PERIODS, PERIOD_LABEL, SCOPE_LABEL, reportHref, scopesFor, type ReportState,
} from '@/lib/report/scope'

const SEGMENT_BOX = 'flex items-center bg-subtle border border-[var(--panel-border)] rounded-[10px] p-[3px]'
const SEGMENT = 'font-(family-name:--font-display) font-extrabold text-[13px] px-3.5 py-1.5 rounded-lg transition-colors'
const SEGMENT_ON = 'bg-white text-tn-ink shadow-[0_1px_3px_rgba(1,35,88,.14)]'
const SEGMENT_OFF = 'text-muted hover:text-tn-ink'

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
  // Buttons rather than links: the dim on screen 6.3 needs the pending state
  // of the navigation, and only a transition we start ourselves reports it.
  const { go } = useReportNav()

  return (
    <div className="flex items-center gap-2.5 flex-wrap mb-4">
      <div className={SEGMENT_BOX}>
        {scopes.map(s => (
          <button
            key={s}
            type="button"
            onClick={() => go(reportHref(base, state, { scope: s }))}
            aria-current={s === state.scope ? 'true' : undefined}
            className={`${SEGMENT} ${s === state.scope ? SEGMENT_ON : SEGMENT_OFF}`}
          >
            {SCOPE_LABEL[s]}
          </button>
        ))}
      </div>

      <div className={SEGMENT_BOX}>
        {PERIODS.map(p => (
          <button
            key={p}
            type="button"
            onClick={() => go(reportHref(base, state, { period: p }))}
            aria-current={p === state.period ? 'true' : undefined}
            className={`${SEGMENT} ${p === state.period ? SEGMENT_ON : SEGMENT_OFF}`}
          >
            {PERIOD_LABEL[p]}
          </button>
        ))}
      </div>

      <span className="text-[12.5px] text-muted">{note}</span>

      {canExport ? (
        <div className="ml-auto">
          <ExportMenu
            csvHref={reportHref(`${base}/csv`, state)}
            pdfHref={reportHref(`${base}/pdf`, state)}
          />
        </div>
      ) : null}
    </div>
  )
}
