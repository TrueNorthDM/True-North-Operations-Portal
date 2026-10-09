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
import { Segmented } from '@/components/ui/Segmented'
import {
  PERIODS, PERIOD_LABEL, SCOPE_LABEL, reportHref, type Period, type ReportState, type Scope,
} from '@/lib/report/scope'

export function ReportControls({
  state, scopes, note, label, base = '/report', canExport = false,
}: {
  state: ReportState
  /** The scopes this person may ask for (scopesFor), resolved on the server. */
  scopes: Scope[]
  /** The real person count and change-log start date, never a constant. */
  note: string
  /**
   * What a team or person filter narrows the page to, by name. Shown on every
   * tab, so a filter picked on Workload never hides behind the scope's label.
   */
  label?: string | null
  base?: string
  canExport?: boolean
}) {
  // The dim on screen 6.3 needs the pending state of the navigation, and only
  // a transition we start ourselves reports it.
  const { go } = useReportNav()
  const filtered = Boolean(state.team || state.person)

  return (
    <div className="flex items-center gap-2.5 flex-wrap mb-4">
      <Segmented
        label="Whose work"
        options={scopes.map(s => ({ key: s, label: SCOPE_LABEL[s] }))}
        value={state.scope}
        onChange={s => go(reportHref(base, state, { scope: s, team: undefined, person: undefined }))}
      />

      <Segmented<Period>
        label="Period"
        options={PERIODS.map(p => ({ key: p, label: PERIOD_LABEL[p] }))}
        value={state.period}
        onChange={p => go(reportHref(base, state, { period: p }))}
      />

      {filtered && label ? (
        <span className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-tn-ink bg-[rgba(30,125,127,.08)] border border-[rgba(30,125,127,.35)] rounded-full pl-3 pr-1 py-0.5">
          {`Showing ${label}`}
          <button
            type="button"
            onClick={() => go(reportHref(base, state, { team: undefined, person: undefined }))}
            className="text-[12px] font-bold text-tn-teal rounded-full px-2 py-0.5 hover:bg-[rgba(30,125,127,.12)]"
          >
            Clear
          </button>
        </span>
      ) : null}

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
