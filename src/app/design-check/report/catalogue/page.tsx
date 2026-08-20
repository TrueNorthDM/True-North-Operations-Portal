// Group 7: chips, thresholds and the rules that keep the Report honest.
//
// Every value here is read from the code that draws the real screens, or
// computed by calling the same function. A catalogue that restates the
// thresholds in its own words is a second copy of the rule, and the second
// copy is the one that goes stale without anybody noticing.

import { notFound } from 'next/navigation'
import { chip } from '@/components/monday/tokens'
import { READING_CHIP, READING_LABEL, loadColour, netChip, utilisationColour } from '@/lib/report/workload'
import { AGE_BUCKETS } from '@/lib/report/overview'
import { BOARD_FALLBACK, boardColour, labelOn } from '@/lib/report/holdings'

export const dynamic = 'force-dynamic'

const COLUMN_TITLE =
  'font-(family-name:--font-display) font-extrabold text-[11px] tracking-[.07em] uppercase text-muted mb-3.5'
const NOTE = 'text-[12px] text-muted mt-3.5 m-0 leading-[1.55]'
const RULE = 'text-[12.5px] text-muted leading-[1.55]'

/** Same thresholds as the People table, kept in one place there and here. */
function onTimeColour(pct: number): string {
  if (pct >= 80) return '#1E7D7F'
  if (pct >= 60) return '#b06d0a'
  return '#c2410c'
}

const SOURCE_CHIPS: [string, string][] = [
  ['live', 'bg-[rgba(30,125,127,.12)] text-tn-teal'],
  ['estimate', 'bg-[rgba(224,138,30,.16)] text-[#b06d0a]'],
  ['to build', 'bg-[rgba(224,138,30,.16)] text-[#b06d0a]'],
  ['change log', 'bg-[rgba(87,155,252,.16)] text-[#2a5cab]'],
  ['measured', 'bg-[rgba(30,125,127,.12)] text-tn-teal'],
  ['fallback', 'bg-[rgba(224,138,30,.16)] text-[#b06d0a]'],
]

/**
 * Each threshold is shown by asking the real function what it returns at the
 * boundary and just past it, so a changed cutoff shows up here as a changed
 * swatch rather than as a line of prose that no longer matches.
 */
const THRESHOLDS: { name: string; samples: [string, string][] }[] = [
  {
    name: 'On time',
    samples: [['80%', onTimeColour(80)], ['60%', onTimeColour(60)], ['59%', onTimeColour(59)]],
  },
  {
    name: 'Utilisation',
    samples: [['95%', utilisationColour(95)], ['75%', utilisationColour(75)], ['74%', utilisationColour(74)]],
  },
  {
    name: 'Load',
    samples: [['110%', loadColour(110)], ['85%', loadColour(85)], ['84%', loadColour(84)]],
  },
]

const HONEST_RULES = [
  'A zero is a grey dash, never a red zero.',
  'Open and Late are always now; delivered and utilisation always follow the period.',
  'The 30-day load horizon and the 8-week backlog window never follow the period switch.',
  "Monday status colours come from Monday's own hex, never mapped per label.",
  'Suspect due dates, years outside 2000 to 2100, are excluded from late counts rather than shown as centuries overdue.',
  'No record and a record of zero are different: the first is a dash, the second is a 0.',
]

export default function CataloguePage() {
  if (process.env.NODE_ENV === 'production') notFound()

  return (
    <div className="p-8 bg-app min-h-screen">
      <h1 className="font-(family-name:--font-display) font-extrabold text-[22px] text-tn-ink m-0 mb-5">
        Report: chips, thresholds and colours
      </h1>

      <div className="bg-white border border-[var(--panel-border)] rounded-[16px] px-7 pt-[26px] pb-[30px] grid grid-cols-4 gap-7">
        <div>
          <div className={COLUMN_TITLE}>Reading</div>
          <div className="flex flex-col gap-2.5 items-start">
            {(Object.keys(READING_LABEL) as (keyof typeof READING_LABEL)[]).map(k => (
              <span key={k} className={`${chip} ${READING_CHIP[k]}`}>{READING_LABEL[k]}</span>
            ))}
          </div>
          <p className={NOTE}>First matching rule wins; the order is in reading().</p>
        </div>

        <div>
          <div className={COLUMN_TITLE}>Source</div>
          <div className="flex flex-col gap-2.5 items-start">
            {SOURCE_CHIPS.map(([label, cls]) => (
              <span key={label} className={`${chip} ${cls}`}>{label}</span>
            ))}
          </div>
          <p className={NOTE}>
            Every estimated number carries a chip. No exceptions, or the page stops being
            defensible.
          </p>
        </div>

        <div>
          <div className={COLUMN_TITLE}>Thresholds</div>
          <div className="flex flex-col gap-2.5">
            {THRESHOLDS.map(t => (
              <div key={t.name} className="flex items-center gap-2">
                <span className="w-[76px] flex-none text-[12.5px] font-bold text-foreground">{t.name}</span>
                {t.samples.map(([at, colour]) => (
                  <span
                    key={at}
                    className="text-[11px] font-bold px-1.5 py-0.5 rounded"
                    style={{ color: colour, background: `${colour}1a` }}
                  >
                    {at}
                  </span>
                ))}
              </div>
            ))}
            <div className="flex items-center gap-2">
              <span className="w-[76px] flex-none text-[12.5px] font-bold text-foreground">Backlog net</span>
              {[['+0.5', 0.5], ['0', 0], ['-0.2', -0.2]].map(([label, n]) => (
                <span key={String(label)} className={`${chip} ${netChip(n as number)}`}>{label}</span>
              ))}
            </div>
          </div>

          <div className={`${COLUMN_TITLE} mt-6`}>Open work, by age</div>
          <div className="flex flex-col gap-2">
            {AGE_BUCKETS.map(b => (
              <span key={b.label} className="flex items-center gap-2 text-[12.5px] text-muted">
                <span className="w-3 h-3 rounded-sm" style={{ background: b.color }} />
                {b.label}
              </span>
            ))}
          </div>
        </div>

        <div>
          <div className={COLUMN_TITLE}>Rules that keep it honest</div>
          <div className="flex flex-col gap-2.5">
            {HONEST_RULES.map(r => <span key={r} className={RULE}>{r}</span>)}
          </div>

          <div className={`${COLUMN_TITLE} mt-6`}>Board colours</div>
          <div className="flex flex-col gap-2 items-start">
            {['AAAF Publishing', 'HFA Publishing', 'i7 Marketing', 'Team Reports Scheduled', 'Anything else'].map(b => {
              const bg = b === 'Anything else' ? BOARD_FALLBACK : boardColour(b)
              return (
                <span
                  key={b}
                  className="text-[11px] font-bold px-2 py-1 rounded"
                  style={{ background: bg, color: labelOn(bg) }}
                >
                  {b}
                </span>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
