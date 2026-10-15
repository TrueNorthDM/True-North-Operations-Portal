/**
 * The year month by month, in the shape Tina's own tracking sheet has.
 *
 * The report above is projects down the side and metrics across, which answers
 * "what did this period cost". Her sheet is the transpose: metrics down the
 * side, months across, one block per project, which answers "how has the year
 * gone". Both are worth having and neither replaces the other, so this sits
 * under the report the way Full history sits under the i7 one.
 *
 * Her rows exactly: hours, employee costs, contractor costs, donations, net.
 * Which of them each project gets is decided in historyRows, and how each cell
 * is written in historyText, not here, so the Export CSV and PDF of this table
 * cannot come out with different rows or differently written figures. In short: the
 * two client projects have no donations and no net, and no Contractor costs
 * until a contractor actually works on one of them.
 */

import type { ProjectHistoryBlock } from '@/lib/timeclock/projects'
import { historyRowName, historyRows, historyText, HISTORY_NOTE, HISTORY_ROW_NAMES } from '@/lib/timeclock/project-history-rows'
import { MONTH_SHORT } from '@/lib/format/months'

const shortMonth = (ym: string) => MONTH_SHORT[Number(ym.slice(5, 7)) - 1]

// 14px body and 10px headings, which is what the Costs table above uses. This
// table had 13px cells and 12.5px row labels, so one page carried three body
// sizes and read as three different tables.
//
// The months have a floor width so they stay legible instead of compressing to
// fit: twelve of them plus the project column do not belong on one screen, and
// squeezing them until they do is how a figure ends up mid-air between two
// columns. Past the floor the wrapper scrolls and the project column stays.
const th = 'text-right text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted px-2 py-2.5 whitespace-nowrap min-w-[94px]'
const cell = 'px-2 py-2 text-right tabular-nums whitespace-nowrap text-[14px] min-w-[94px]'
const label = 'px-3 py-2 text-left text-[14px] text-tn-ink whitespace-nowrap'


export function ProjectFullHistory({ blocks, year }: { blocks: ProjectHistoryBlock[]; year: string }) {
  if (blocks.length === 0) return null
  const months = blocks[0].months

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-3">
          <h2 className="font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink m-0">
            {year}, month by month
          </h2>
          <span className="text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-tn-teal bg-tn-teal-soft border border-tn-teal/25 rounded-full px-2.5 py-0.5">
            {year}
          </span>
        </div>
        {/* Centred and 70% wide, the divider the Full history header uses. */}
        <span className="block w-[70%] mx-auto mt-3 h-0.5 rounded-full bg-tn-primary/85" />
      </div>

      <div className="overflow-x-auto rounded-[14px] border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-subtle border-b border-slate-200">
              <th className="text-left text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted px-3 py-2.5 sticky left-0 bg-subtle z-10 border-r border-slate-200">
                Project
              </th>
              {months.map(m => <th key={m.month} className={th}>{shortMonth(m.month)}</th>)}
            </tr>
          </thead>

          {blocks.map(b => (
            <tbody key={b.label} className="border-b border-slate-200 last:border-b-0">
              <tr className="bg-[rgba(1,35,88,0.03)]">
                <td className="px-3 py-2.5 sticky left-0 bg-[#f6f7f9] z-10 border-r border-slate-200" colSpan={1}>
                  <span className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink whitespace-nowrap">{b.name}</span>
                  {b.prepaid && <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-tn-teal">prepaid</span>}
                  {b.billed && <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-[#B8790A]">billed</span>}
                </td>
                <td colSpan={months.length} className="bg-[rgba(1,35,88,0.03)]" />
              </tr>

              {historyRows(b).map(key => key === 'net' ? (
                <tr key={key} className="border-t border-slate-100">
                  <td className={`${label} sticky left-0 bg-white z-10 border-r border-slate-200 font-semibold`}>{HISTORY_ROW_NAMES.net}</td>
                  {b.months.map(m => (
                    <td
                      key={m.month}
                      className={`${cell} font-semibold ${m.net == null || m.net === 0 ? '' : m.net < 0 ? 'text-[#c2410c]' : 'text-[#1E9E6A]'}`}
                    >
                      {historyText('net', m)}
                    </td>
                  ))}
                </tr>
              ) : (
                <Row
                  key={key}
                  name={historyRowName(key, b)}
                  cells={b.months.map(m => historyText(key, m))}
                />
              ))}
            </tbody>
          ))}
        </table>
      </div>

      <p className="text-[13.5px] text-muted leading-relaxed m-0">{HISTORY_NOTE}</p>
    </div>
  )
}

function Row({ name, cells }: { name: string; cells: string[] }) {
  return (
    <tr className="border-t border-slate-100">
      <td className={`${label} sticky left-0 bg-white z-10 border-r border-slate-200`}>{name}</td>
      {cells.map((c, i) => <td key={i} className={cell}>{c}</td>)}
    </tr>
  )
}
