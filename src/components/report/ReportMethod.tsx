// Screen 1.5: Method.
//
// A live page, not a static copy block. The cards print the real cadences and
// the real change-log start date, because the point of the tab is that a
// number stays defensible when somebody disputes it, and a hand-written "every
// 4 hours" stops being true the day the cron changes and nobody notices.

import { chip } from '@/components/monday/tokens'
import type { Scope } from '@/lib/report/scope'
import type { OpenDecision, Source, SourceState } from '@/lib/report/types'
export type { OpenDecision, Source, SourceState }

const SOURCE_CHIP: Record<SourceState, { label: string; className: string }> = {
  live: { label: 'live', className: 'bg-[rgba(30,125,127,.12)] text-tn-teal' },
  'to-build': { label: 'to build', className: 'bg-[rgba(224,138,30,.16)] text-[#b06d0a]' },
}

export function ReportMethod(
  { sources, todo, yours }: {
    sources: Source[]; todo: OpenDecision[]
    /** The widest scope the reader has, marked as theirs. */
    yours?: Scope
  },
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

      <HowItCounts />
      {todo.length > 0 ? <ToBuild todo={todo} /> : null}
      {yours ? <WhoSeesWhat yours={yours} /> : null}
    </div>
  )
}

// Whose work each scope reads (access model, 7 October 2026; My team decided
// 9 October 2026). Which tabs each person gets is set on Admin, Access levels,
// so it is stated there rather than here.
const SCOPES: { scope: Scope; who: string; sees: string }[] = [
  { scope: 'me', who: 'Me', sees: 'Your own work, for everyone who opens the Report.' },
  { scope: 'team', who: 'My team', sees: 'The teams you lead, for whoever leads a team.' },
  { scope: 'everyone', who: 'Everyone', sees: 'The whole company, including Monday accounts nobody is linked to, for whoever has "See everyone".' },
]

/** The rules every figure on the page follows. */
function HowItCounts() {
  return (
    <div className="border border-[var(--panel-border)] bg-white rounded-[12px] px-4 py-3.5">
      <h3 className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink m-0 mb-2">
        How it counts
      </h3>
      <ul className="m-0 pl-4 flex flex-col gap-1.5 text-[12.5px] text-foreground leading-[1.55]">
        <li>Held time is working days, Monday to Friday without US federal holidays, from the moment a step lands on someone to the moment it is marked done.</li>
        <li>Late means finished after the end of its due date in New York. A step with no due date is neither on time nor late.</li>
        <li>A step reopened and finished again counts once, on its last finish.</li>
        <li>Switched-off boards, switched-off steps and hidden Monday accounts are left out of the past as well as the present.</li>
      </ul>
    </div>
  )
}

/**
 * Who sees what, scope by scope.
 *
 * On the Method tab rather than in a settings screen because the question it
 * answers is about the numbers: somebody comparing their Report against a
 * colleague's and finding different figures needs to know that is by design
 * and not a fault. The reader's own widest scope is marked.
 */
function WhoSeesWhat({ yours }: { yours: Scope }) {
  return (
    <div className="border border-[var(--panel-border)] bg-white rounded-[12px] px-4 py-3.5">
      <h3 className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink m-0 mb-3">
        Who sees what
      </h3>
      <div className="flex flex-col gap-2.5">
        {SCOPES.map(l => (
          <div key={l.scope} className="flex items-start gap-2.5">
            <span className={`${chip} flex-none mt-px ${l.scope === yours
              ? 'bg-[rgba(30,125,127,.12)] text-tn-teal'
              : 'bg-[var(--chip-neutral-bg)] text-[var(--chip-neutral-fg)]'}`}
            >
              {l.scope === yours ? 'you' : l.who}
            </span>
            <span className="min-w-0 text-[12.5px] text-foreground leading-[1.55]">
              <strong className="font-bold">{l.who}.</strong> {l.sees}
            </span>
          </div>
        ))}
      </div>
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
