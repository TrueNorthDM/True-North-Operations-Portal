/**
 * Project Hours & Others, month by month, laid out for paper.
 *
 * Asked for by Tina on 16 September 2026: the month by month table exactly as
 * the screen shows it, as a document. The screen's shape (one block per
 * project, its name on a shaded line, its rows under it, Net in green or red)
 * on a landscape page, which is what a year of months needs, with a Total
 * column the screen does not have: on paper nobody can scroll to add it up.
 *
 * Rows come from historyRows and cells from historyText, the screen's own
 * rules, so the PDF cannot disagree with the table it copies.
 *
 * Inline styles, like the other print sheets: the PDF route renders this in a
 * headless browser, and a class that goes missing there fails silently.
 */

import type { ProjectHistoryBlock } from '@/lib/timeclock/projects'
import {
  historyMonthHeading, historyRows, historyText, historyTotal, HISTORY_NOTE, HISTORY_ROW_NAMES,
} from '@/lib/timeclock/project-history-rows'

const INK = '#012358'
const MUTED = '#64748b'
const LINE = '#e2e8f0'
const TEAL = '#1E7D7F'
const SHADE = '#f3f5f8'
const TOTAL_SHADE = '#f8fafc'

const th: React.CSSProperties = {
  textAlign: 'right', fontSize: 8, fontWeight: 800, letterSpacing: '.06em',
  textTransform: 'uppercase', color: MUTED, padding: '7px 6px',
  background: SHADE, borderBottom: `1px solid ${LINE}`, whiteSpace: 'nowrap',
}
const td: React.CSSProperties = {
  textAlign: 'right', fontSize: 9, padding: '5px 6px', color: INK,
  borderTop: '1px solid #f1f5f9', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
}
const label: React.CSSProperties = { ...td, textAlign: 'left', borderRight: `1px solid ${LINE}` }
const total: React.CSSProperties = { ...td, fontWeight: 700, background: TOTAL_SHADE, borderLeft: `1px solid ${LINE}` }

export function ProjectHistoryPrint(
  { blocks, periodLabel, generatedOn }: { blocks: ProjectHistoryBlock[]; periodLabel: string; generatedOn: string },
) {
  const months = blocks[0]?.months ?? []
  const netColor = (n: number | null) => (n == null ? INK : n < 0 ? '#c2410c' : '#1E9E6A')

  return (
    // print-doc is what the PDF route waits for before it prints.
    <div className="print-doc" style={{
      background: '#fff', color: INK, padding: '24px 28px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, paddingBottom: 12, borderBottom: `2px solid ${INK}` }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: TEAL }}>
            True North Digital Marketing
          </div>
          <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.01em', marginTop: 3 }}>
            Project Hours &amp; Others
          </div>
          <div style={{ fontSize: 10.5, color: MUTED, marginTop: 3 }}>Month by month</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12.5, fontWeight: 800 }}>{periodLabel}</div>
          <div style={{ fontSize: 9.5, color: MUTED, marginTop: 2 }}>Generated {generatedOn}</div>
        </div>
      </div>

      {blocks.length === 0 ? (
        <p style={{ fontSize: 11, color: MUTED, marginTop: 20 }}>Nothing was tracked in this period.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16, border: `1px solid ${LINE}` }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left', borderRight: `1px solid ${LINE}` }}>Project</th>
              {months.map(m => <th key={m.month} style={th}>{historyMonthHeading(m.month)}</th>)}
              <th style={{ ...th, borderLeft: `1px solid ${LINE}`, color: INK }}>Total</th>
            </tr>
          </thead>
          {blocks.map(b => {
            const sum = historyTotal(b)
            return (
              // A project's block does not split across two pages.
              <tbody key={b.label} style={{ breakInside: 'avoid' }}>
                <tr>
                  <td colSpan={months.length + 2} style={{ ...td, textAlign: 'left', background: SHADE, borderTop: `1px solid ${LINE}`, padding: '7px 6px' }}>
                    <span style={{ fontSize: 10, fontWeight: 800 }}>{b.name}</span>
                    {b.prepaid && (
                      <span style={{ marginLeft: 8, fontSize: 7.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: TEAL }}>
                        prepaid
                      </span>
                    )}
                  </td>
                </tr>
                {historyRows(b).map(key => {
                  const isNet = key === 'net'
                  return (
                    <tr key={key}>
                      <td style={{ ...label, fontWeight: isNet ? 700 : 400 }}>{HISTORY_ROW_NAMES[key]}</td>
                      {b.months.map(m => (
                        <td key={m.month} style={isNet ? { ...td, fontWeight: 700, color: netColor(m.net) } : td}>
                          {historyText(key, m)}
                        </td>
                      ))}
                      <td style={isNet ? { ...total, color: netColor(sum.net) } : total}>{historyText(key, sum)}</td>
                    </tr>
                  )
                })}
              </tbody>
            )
          })}
        </table>
      )}

      <p style={{ fontSize: 8.5, color: MUTED, marginTop: 14, lineHeight: 1.5 }}>
        {`${HISTORY_NOTE} Costs are hours × each person’s break-even rate: what a project consumed, not what left the bank. A blank donation means nobody has entered one, not that nothing came in.`}
      </p>
    </div>
  )
}
