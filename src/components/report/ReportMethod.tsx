// Screen 1.5: Method.
//
// A live page, not a static copy block. The cards print the real cadences and
// the real change-log start date, because the point of the tab is that a
// number stays defensible when somebody disputes it, and a hand-written "every
// 4 hours" stops being true the day the cron changes and nobody notices.

import { chip } from '@/components/monday/tokens'

export type SourceState = 'live' | 'to-build'

export type Source = {
  name: string
  state: SourceState
  /** How often it refreshes, read from the thing that refreshes it. */
  cadence: string
  what: string
}

export type OpenDecision = { text: string }

const SOURCE_CHIP: Record<SourceState, { label: string; className: string }> = {
  live: { label: 'live', className: 'bg-[rgba(30,125,127,.12)] text-tn-teal' },
  'to-build': { label: 'to build', className: 'bg-[rgba(224,138,30,.16)] text-[#b06d0a]' },
}

export function ReportMethod(
  { sources, todo }: { sources: Source[]; todo: OpenDecision[] },
) {
  return (
    <div className="flex flex-col gap-3.5">
      {sources.map(s => (
        <div key={s.name} className="border border-[var(--panel-border)] bg-white rounded-[12px] px-4 py-3.5">
          <div className="flex items-center gap-[9px] mb-[7px] flex-wrap">
            <span className="font-(family-name:--font-display) font-extrabold text-[13.5px] text-tn-ink">
              {s.name}
            </span>
            <span className={`${chip} ${SOURCE_CHIP[s.state].className}`}>{SOURCE_CHIP[s.state].label}</span>
            <span className="ml-auto text-[11.5px] text-muted">{s.cadence}</span>
          </div>
          <p className="text-[12.5px] text-foreground m-0 leading-[1.6]">{s.what}</p>
        </div>
      ))}

      {todo.length > 0 ? <ToBuild todo={todo} /> : null}
    </div>
  )
}

/**
 * The honest part of the tab.
 *
 * It stays on the page until the change log has been running, because the
 * alternative is a Report that shows numbers without saying they rest on
 * something not built yet.
 */
function ToBuild({ todo }: { todo: OpenDecision[] }) {
  return (
    <div className="border border-[rgba(224,148,14,.5)] bg-[rgba(242,196,10,.08)] rounded-[14px] px-[18px] py-4">
      <h3 className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink m-0 mb-2">
        What has to be built first
      </h3>
      <p className="text-[12.5px] text-foreground m-0 mb-3 leading-[1.65]">
        The assignments table is replaced board by board on every sync, so yesterday&rsquo;s state
        is gone. The fix is additive: write the differences to a change log, one row per change,
        carrying the step, the person, the status, the date and the moment.
      </p>
      <div className="flex flex-col gap-2">
        {todo.map(t => (
          <div key={t.text} className="flex items-start gap-[9px] text-[12.5px] text-foreground leading-[1.5]">
            <span className="flex-none w-4 h-4 mt-px rounded-[4px] border-[1.5px] border-[var(--faint)]" />
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
