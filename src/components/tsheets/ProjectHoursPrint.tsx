/**
 * Project Hours & Others, laid out for paper.
 *
 * Two versions of one sheet, the same split the report's tabs have and the same
 * split the i7 exports have:
 *   client   → what each project consumed and what came in for it. No names.
 *   internal → who did the hours, one column per person. Names, so it stays in.
 *
 * A server component with no interaction: the PDF route drives a headless
 * browser at the page that renders this, and a person reaching it in a browser
 * gets the same thing and can print it themselves.
 *
 * Styles are inline rather than utility classes, as the i7 print sheet's are.
 * The print stylesheet has to survive being rendered with no application CSS by
 * a headless browser, and a class that goes missing there fails silently as a
 * page of unstyled text.
 */

import type { ProjectTracking } from '@/lib/timeclock/projects'

const INK = '#012358'
const MUTED = '#64748b'
const LINE = '#e2e8f0'
const TEAL = '#1E7D7F'

// Blank for absent, a dash for nothing, a figure for something. The same three
// states the screen shows, because a printed sheet that renders $0.00 where the
// screen renders a dash reads as a different report.
const money = (n: number | null | undefined) =>
  n == null ? '' : n === 0 ? '-' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
const hours = (n: number | null | undefined) =>
  n == null ? '' : n === 0 ? '-' : n.toFixed(2)

const th: React.CSSProperties = {
  textAlign: 'right', fontSize: 8, fontWeight: 800, letterSpacing: '.06em',
  textTransform: 'uppercase', color: MUTED, padding: '7px 6px',
  borderBottom: `1px solid ${LINE}`, whiteSpace: 'nowrap',
}
const thL: React.CSSProperties = { ...th, textAlign: 'left' }
const td: React.CSSProperties = {
  textAlign: 'right', fontSize: 9.5, padding: '6px', color: INK,
  borderBottom: `1px solid #f1f5f9`, fontVariantNumeric: 'tabular-nums',
}
const tdL: React.CSSProperties = { ...td, textAlign: 'left', fontWeight: 700 }
const foot: React.CSSProperties = { ...td, fontWeight: 800, borderTop: `2px solid #cbd5e1` }
const footL: React.CSSProperties = { ...foot, textAlign: 'left' }

export function ProjectHoursPrint(
  { data, type, periodLabel, generatedOn }: {
    data: ProjectTracking
    type: 'client' | 'internal'
    periodLabel: string
    generatedOn: string
  },
) {
  const year = data.month.slice(0, 4)
  const lastYear = String(Number(year) - 1)
  const { rows, totals } = data
  const people = [...data.people].sort((a, b) => a.localeCompare(b))

  const given = (pick: (r: typeof rows[number]) => number | null) => {
    const parts = rows.map(pick).filter((n): n is number => n != null)
    return parts.length === 0 ? null : parts.reduce((s, n) => s + n, 0)
  }

  return (
    // print-doc is what the PDF route waits for before it prints: proof the
    // document actually rendered rather than an error page.
    <div className="print-doc" style={{
      background: '#fff', color: INK, padding: '28px 32px',
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
          <div style={{ fontSize: 10.5, color: MUTED, marginTop: 3 }}>
            {type === 'internal' ? 'Hours by person' : 'What each project consumed, and what came in'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12.5, fontWeight: 800 }}>{periodLabel}</div>
          <div style={{ fontSize: 9.5, color: MUTED, marginTop: 2 }}>Generated {generatedOn}</div>
        </div>
      </div>

      {type === 'client' ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
          <thead>
            <tr>
              <th style={thL}>Project</th>
              <th style={th}>Carried in</th>
              <th style={th}>Prepaid</th>
              <th style={th}>Remaining</th>
              <th style={th}>Hours</th>
              <th style={th}>Employee costs</th>
              <th style={th}>Contractor costs</th>
              <th style={th}>Donations</th>
              <th style={th}>Net</th>
              <th style={th}>Hours {year}</th>
              <th style={th}>Donations {year}</th>
              <th style={th}>Costs {year}</th>
              <th style={th}>Net {year}</th>
              <th style={th}>{lastYear} same period</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.label}>
                <td style={tdL}>{r.name}</td>
                <td style={td}>{hours(r.carriedIn)}</td>
                <td style={td}>{hours(r.boughtThisMonth)}</td>
                <td style={td}>{hours(r.remaining)}</td>
                <td style={td}>{hours(r.workedThisMonth)}</td>
                <td style={td}>{money(r.employeeCostThisMonth)}</td>
                <td style={td}>{money(r.contractorCostThisMonth)}</td>
                <td style={td}>{money(r.donationsThisMonth)}</td>
                <td style={{ ...td, fontWeight: 600, color: r.netThisMonth == null ? INK : r.netThisMonth < 0 ? '#c2410c' : '#1E9E6A' }}>{money(r.netThisMonth)}</td>
                <td style={td}>{hours(r.yearToDate)}</td>
                <td style={td}>{money(r.donationsYtd)}</td>
                <td style={td}>{money(r.totalCosts)}</td>
                <td style={{ ...td, fontWeight: 600, color: r.netYtd == null ? INK : r.netYtd < 0 ? '#c2410c' : '#1E9E6A' }}>{money(r.netYtd)}</td>
                <td style={{ ...td, color: MUTED }}>{hours(r.sameMonthLastYear)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td style={footL}>Totals</td>
              <td style={foot} /><td style={foot} />
              <td style={foot}>{hours(rows.reduce((s, r) => s + (r.remaining ?? 0), 0))}</td>
              <td style={foot}>{hours(totals.workedThisMonth)}</td>
              <td style={foot}>{money(totals.employeeCostThisMonth)}</td>
              <td style={foot}>{money(totals.contractorCostThisMonth)}</td>
              <td style={foot}>{money(given(r => r.donationsThisMonth))}</td>
              <td style={foot}>{money(given(r => r.netThisMonth))}</td>
              <td style={foot}>{hours(totals.yearToDate)}</td>
              <td style={foot}>{money(given(r => r.donationsYtd))}</td>
              <td style={foot}>{money(totals.totalCosts)}</td>
              <td style={foot}>{money(given(r => r.netYtd))}</td>
              <td style={{ ...foot, color: MUTED }}>{hours(totals.sameMonthLastYear)}</td>
            </tr>
          </tfoot>
        </table>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
          <thead>
            <tr>
              <th style={thL}>Project</th>
              {people.map(p => <th key={p} style={th}>{p}</th>)}
              <th style={th}>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.label}>
                <td style={tdL}>{r.name}</td>
                {people.map(p => (
                  <td key={p} style={r.byPerson[p] ? td : { ...td, color: '#cbd5e1' }}>
                    {r.byPerson[p] ? hours(r.byPerson[p]) : '-'}
                  </td>
                ))}
                <td style={{ ...td, fontWeight: 700 }}>{hours(r.workedThisMonth)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td style={footL}>Total hours</td>
              {people.map(p => <td key={p} style={foot}>{hours(totals.byPerson[p] ?? 0)}</td>)}
              <td style={foot}>{hours(totals.workedThisMonth)}</td>
            </tr>
          </tfoot>
        </table>
      )}

      <p style={{ fontSize: 8.5, color: MUTED, marginTop: 14, lineHeight: 1.5 }}>
        Costs are hours × each person&rsquo;s break-even rate: what a project consumed, not what left
        the bank. Nothing here is billed. Grants Pass Church and School buy hours in advance at $90,
        which is what the balance columns track; the other two have no allowance, so those cells are
        blank rather than zero. A blank donation means nobody has entered one, not that nothing came in.
      </p>
    </div>
  )
}
