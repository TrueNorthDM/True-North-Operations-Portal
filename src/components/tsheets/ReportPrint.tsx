'use client'

// Print/PDF layouts for the i7 Budget Usage Report — two bespoke documents:
//   internal — full detail: invoice reconciliation, per-person table grouped by
//              invoice (i7 vs MME), team workload / cost / utilization charts.
//   client   — client-facing: "Your month at a glance", friendly copy, billing
//              blocks, budget-health gauge, investment + activity charts,
//              highlights. No internal costs or staff names.
// Colours are hardcoded hex (print must be identical regardless of theme and
// survive the browser dropping backgrounds). Data logic stays in report-data.

import Link from 'next/link'
import { Fragment, useEffect } from 'react'
import type { I7Report, I7Carryover, I7TrendPoint } from '@/lib/tsheets/types'
import { money, moneySigned, fmtHours } from '@/lib/tsheets/format'

const INK = '#012358', TEAL = '#1E7D7F', BLUE = '#2A6FDB', GOLD = '#F2C40A', PURPLE = '#6D5AE6', AMBER = '#E8912A', MMEC = '#B8790A', GREEN = '#1E9E6A', MUTED = '#8593a4', BODY = '#435066', BORDER = '#e4e7ec', WARM = '#f4f2ec', RED = '#C2410C', TRACK = '#eef0f3'
const COST_COLORS = [TEAL, BLUE, GOLD, PURPLE, AMBER]
const ACT_COLORS = [TEAL, BLUE, PURPLE, AMBER, '#00A3DD', GREEN]

const isMME = (name: string) => /mme|moisture/i.test(name)
const pctOf = (v: number, t: number) => (t > 0 ? Math.round((v / t) * 100) : 0)

interface Props {
  report: I7Report
  projectHours: Record<string, number>
  carryover: I7Carryover | null
  stdRate: number
  trend: I7TrendPoint[]
  type: 'client' | 'internal'
  monthLabel: string
  generatedOn: string
  note: string
}

// ── shared chart primitives ─────────────────────────────────────────────────
function Donut({ segs, size = 110, sw = 18 }: { segs: { value: number; color: string }[]; size?: number; sw?: number }) {
  const total = segs.reduce((s, x) => s + x.value, 0)
  const r = 52, C = 2 * Math.PI * r
  let acc = 0
  const arcs = segs.filter(s => s.value > 0).map(s => { const dash = (total > 0 ? s.value / total : 0) * C; const a = { dash, offset: -acc, color: s.color }; acc += dash; return a })
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
      <circle cx="64" cy="64" r={r} fill="none" stroke={TRACK} strokeWidth={sw} />
      {arcs.map((a, i) => <circle key={i} cx="64" cy="64" r={r} fill="none" stroke={a.color} strokeWidth={sw} strokeDasharray={`${a.dash} ${C - a.dash}`} strokeDashoffset={a.offset} />)}
    </svg>
  )
}

function LegendRow({ color, label, value, extra }: { color: string; label: string; value: string; extra?: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] mb-1.5 last:mb-0">
      <span className="w-2 h-2 rounded-[2px] shrink-0" style={{ background: color }} />
      <span className="flex-1 min-w-0 truncate" style={{ color: BODY }}>{label}</span>
      <strong style={{ color: INK }}>{value}</strong>
      {extra && <span className="ml-1.5" style={{ color: MUTED }}>{extra}</span>}
    </div>
  )
}

// ── main ────────────────────────────────────────────────────────────────────
export function ReportPrint({ report, projectHours, carryover, stdRate, type, monthLabel, generatedOn, note }: Props) {
  useEffect(() => {
    document.documentElement.classList.remove('dark')
    document.documentElement.style.colorScheme = 'light'
    const t = setTimeout(() => window.print(), 700) // let the SVG charts paint first
    return () => clearTimeout(t)
  }, [])

  const showCost = report.hasRates
  const totalCost = report.totalCost
  const monthShort = monthLabel.split(' ')[0]

  // Invoice split — MME is billed separately; everything else is the i7 invoice.
  const i7Projects = report.projects.filter(p => !isMME(p.project))
  const mmeProjects = report.projects.filter(p => isMME(p.project))
  const i7Cost = i7Projects.reduce((s, p) => s + p.cost, 0)
  const mmeCost = mmeProjects.reduce((s, p) => s + p.cost, 0)
  const i7Pct = totalCost > 0 ? (i7Cost / totalCost) * 100 : 100

  // Per-project cost (for donuts), sorted big→small.
  const byCost = [...report.projects].filter(p => p.cost > 0).sort((a, b) => b.cost - a.cost)
  const costSegs = byCost.map((p, i) => ({ label: p.project.replace(/\s*\(.*\)/, ''), value: p.cost, color: COST_COLORS[i % COST_COLORS.length] }))

  // Team workload (hours per person).
  const byPerson: Record<string, number> = {}
  for (const p of report.projects) for (const [n, h] of Object.entries(p.byPerson)) byPerson[n] = (byPerson[n] ?? 0) + h
  const persons = Object.entries(byPerson).map(([name, hours]) => ({ name, hours: Math.round(hours * 100) / 100 })).sort((a, b) => b.hours - a.hours)
  const maxPerson = Math.max(1, ...persons.map(p => p.hours))

  // Budget utilization (hours used vs budgeted).
  const util = report.projects.map(p => {
    const budget = projectHours[p.project] ?? 0
    const pct = budget > 0 ? p.hours / budget : null
    return { name: p.project.replace(/\s*\(.*\)/, ''), hours: p.hours, budget, pct }
  }).filter(u => u.budget > 0)
  const nearBudget = util.some(u => u.pct != null && u.pct >= 0.9)

  // Activity mix (global).
  const actMap = new Map<string, number>()
  for (const p of report.projects) for (const jc of p.jobcodes) for (const a of jc.activities) actMap.set(a.activity, (actMap.get(a.activity) ?? 0) + a.hours)
  const acts = [...actMap.entries()].sort((a, b) => b[1] - a[1]).map(([activity, hours], i) => ({ activity, hours, color: ACT_COLORS[i % ACT_COLORS.length] }))
  const actTotal = acts.reduce((s, a) => s + a.hours, 0)

  const budgetLeft = carryover ? carryover.totalLeft : 0
  const usedPct = carryover && carryover.totalAvailable > 0 ? carryover.monthUsed / carryover.totalAvailable : 0
  const leftPct = carryover && carryover.totalAvailable > 0 ? Math.round((carryover.totalLeft / carryover.totalAvailable) * 100) : 0
  const onTrack = !carryover || carryover.totalLeft >= 0

  const Toolbar = (
    <div className="no-print mx-auto max-w-[1056px] mb-4 flex items-center justify-between px-2">
      <Link href={`/tools/time-report?month=${report.startDate.slice(0, 7)}`} className="text-sm font-(family-name:--font-display) font-bold" style={{ color: BODY }}>&larr; Back to report</Link>
      <button onClick={() => window.print()} className="inline-flex items-center gap-2 px-[18px] py-2.5 rounded-[10px] text-white font-(family-name:--font-display) font-extrabold text-[13px]" style={{ background: INK }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
        Save as PDF
      </button>
    </div>
  )

  const Header = ({ label, sub }: { label: string; sub: string }) => (
    <div className="flex items-start justify-between gap-6 pb-[18px]" style={{ borderBottom: `2px solid ${INK}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logos/true-north.png" alt="True North Digital Marketing" style={{ height: 40, display: 'block' }} />
      <div className="text-right shrink-0">
        <div className="font-(family-name:--font-display) font-extrabold text-[11px] tracking-[.16em] uppercase" style={{ color: TEAL }}>{label}</div>
        <div className="text-[11.5px] mt-1" style={{ color: MUTED }}>{sub}</div>
      </div>
    </div>
  )

  const sheet = 'print-doc mx-auto w-[1056px] max-w-full print:w-full bg-white rounded-[14px] shadow-sm print:shadow-none print:rounded-none p-[44px_48px_40px] print:p-0 flex flex-col print:block min-h-[816px] print:min-h-0'

  // ══════════════════════════ CLIENT REPORT ══════════════════════════
  if (type === 'client') {
    const blocks = [
      { title: 'Included in your i7 invoice', note: 'Wagner Meters & Bessemeter', color: TEAL, headBg: '#eef6f5', projects: i7Projects, invest: i7Cost },
      ...(mmeProjects.length ? [{ title: 'Moisture Meters (MME)', note: 'Billed to Wagner Meter separately', color: MMEC, headBg: '#fdf6dc', projects: mmeProjects, invest: mmeCost }] : []),
    ]
    return (
      <div className="min-h-dvh print:min-h-0 py-8 print:py-0 print:bg-white" style={{ background: '#e9e7df' }}>
        {Toolbar}
        <div className={sheet} style={{ color: BODY }}>
          <Header label="Monthly Marketing Report" sub="Prepared for i7 Marketing" />

          <div className="flex items-end justify-between gap-6 mt-5">
            <div>
              <h1 className="font-(family-name:--font-display) font-black text-[27px] leading-[1.05] m-0" style={{ color: INK }}>Your month at a glance</h1>
              <p className="text-[13px] mt-1.5" style={{ color: BODY }}>A summary of the work delivered and how your budget was used in <b style={{ color: INK }}>{monthLabel}</b>.</p>
            </div>
            <div className="text-right shrink-0">
              <div className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.1em] uppercase" style={{ color: MUTED }}>Reporting period</div>
              <div className="font-(family-name:--font-display) font-extrabold text-[16px] mt-0.5" style={{ color: INK }}>{monthLabel}</div>
              <div className="text-[11.5px] mt-px tabular-nums" style={{ color: MUTED }}>{report.startDate} &rarr; {report.endDate}</div>
            </div>
          </div>

          {/* summary cards */}
          <div className="grid grid-cols-4 gap-3.5 mt-[22px]">
            {[
              { l: 'Budget available', v: carryover ? moneySigned(carryover.totalAvailable) : '—', c: INK },
              { l: 'Total work delivered', v: money(totalCost), c: INK },
              { l: 'Hours delivered', v: report.totalHours.toFixed(2), c: INK },
            ].map(x => (
              <div key={x.l} className="rounded-[12px] p-[14px_16px]" style={{ border: `1px solid ${BORDER}` }}>
                <div className="font-(family-name:--font-display) font-extrabold text-[9.5px] tracking-[.09em] uppercase" style={{ color: MUTED }}>{x.l}</div>
                <div className="font-(family-name:--font-display) font-black text-[22px] mt-1.5 tabular-nums" style={{ color: x.c }}>{x.v}</div>
              </div>
            ))}
            <div className="rounded-[12px] p-[14px_16px]" style={{ border: `1px solid ${onTrack ? '#d6ebe4' : BORDER}`, background: onTrack ? '#f2faf6' : '#fff' }}>
              <div className="flex items-center justify-between">
                <div className="font-(family-name:--font-display) font-extrabold text-[9.5px] tracking-[.09em] uppercase" style={{ color: onTrack ? GREEN : MUTED }}>Budget remaining</div>
                {onTrack && <span className="inline-flex items-center gap-1 text-[10px] font-bold" style={{ color: GREEN }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: GREEN }} />On track</span>}
              </div>
              <div className="font-(family-name:--font-display) font-black text-[22px] mt-1.5 tabular-nums" style={{ color: budgetLeft < 0 ? RED : GREEN }}>{moneySigned(budgetLeft)}</div>
            </div>
          </div>

          {/* how this month is invoiced */}
          <div className="mt-3.5 rounded-[12px] p-[16px_18px]" style={{ border: `1px solid ${BORDER}`, background: '#fbfcfd' }}>
            <div className="flex items-baseline justify-between gap-4 flex-wrap">
              <div className="font-(family-name:--font-display) font-extrabold text-[12px]" style={{ color: INK }}>How this month is invoiced</div>
              <div className="text-[11.5px] tabular-nums" style={{ color: BODY }}>Total work <b style={{ color: INK }}>{money(totalCost)}</b> &nbsp;=&nbsp; i7 invoice <b style={{ color: TEAL }}>{money(i7Cost)}</b> &nbsp;+&nbsp; MME separate invoice <b style={{ color: MMEC }}>{money(mmeCost)}</b></div>
            </div>
            <div className="flex h-[22px] rounded-[7px] overflow-hidden mt-3">
              <div className="flex items-center px-2.5 text-white font-(family-name:--font-display) font-extrabold text-[11px]" style={{ flexBasis: `${i7Pct}%`, background: TEAL }}>i7 · {Math.round(i7Pct)}%</div>
              <div style={{ flexBasis: `${100 - i7Pct}%`, background: MMEC }} />
            </div>
            <div className="flex gap-[18px] flex-wrap mt-2.5 text-[11px]">
              <div className="flex items-center gap-[7px]"><span className="w-[9px] h-[9px] rounded-[2px] shrink-0" style={{ background: TEAL }} /><span style={{ color: BODY }}>Included in your i7 invoice — Wagner Meters, Bessemeter</span></div>
              <div className="flex items-center gap-[7px]"><span className="w-[9px] h-[9px] rounded-[2px] shrink-0" style={{ background: MMEC }} /><span style={{ color: BODY }}>Moisture Meters (MME) — billed to Wagner Meter separately</span></div>
            </div>
          </div>

          {/* charts row */}
          <div className="grid grid-cols-[0.9fr_1.1fr_1.2fr] gap-4 mt-5">
            <div className="rounded-[12px] p-[16px_18px]" style={{ border: `1px solid ${BORDER}` }}>
              <div className="font-(family-name:--font-display) font-extrabold text-[12px]" style={{ color: INK }}>Budget health</div>
              <div className="text-[11px] mt-0.5" style={{ color: MUTED }}>Share of monthly budget used</div>
              <div className="flex justify-center mt-2.5">
                <div className="relative w-[132px] h-[132px]">
                  <svg width="132" height="132" viewBox="0 0 128 128" style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
                    <circle cx="64" cy="64" r="52" fill="none" stroke={TRACK} strokeWidth="16" />
                    <circle cx="64" cy="64" r="52" fill="none" stroke={TEAL} strokeWidth="16" strokeLinecap="round" strokeDasharray={`${Math.min(1, usedPct) * 2 * Math.PI * 52} ${2 * Math.PI * 52}`} />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="font-(family-name:--font-display) font-black text-[26px] leading-none" style={{ color: INK }}>{Math.round(usedPct * 100)}%</div>
                    <div className="text-[10px] uppercase tracking-wide mt-0.5" style={{ color: MUTED }}>used</div>
                  </div>
                </div>
              </div>
              <div className="text-center text-[11px] mt-1.5" style={{ color: BODY }}>{money(carryover?.monthUsed ?? 0)} used · <b style={{ color: GREEN }}>{money(budgetLeft)} left</b></div>
            </div>

            <div className="rounded-[12px] p-[16px_18px]" style={{ border: `1px solid ${BORDER}` }}>
              <div className="font-(family-name:--font-display) font-extrabold text-[12px]" style={{ color: INK }}>Investment by project</div>
              <div className="text-[11px] mt-0.5" style={{ color: MUTED }}>Where this month’s work went</div>
              <div className="flex items-center gap-3.5 mt-2.5">
                <Donut segs={costSegs} size={110} sw={18} />
                <div className="flex-1 min-w-0">
                  {costSegs.map(s => <LegendRow key={s.label} color={s.color} label={s.label} value={money(s.value)} extra={`${pctOf(s.value, totalCost)}%`} />)}
                </div>
              </div>
            </div>

            <div className="rounded-[12px] p-[16px_18px]" style={{ border: `1px solid ${BORDER}` }}>
              <div className="font-(family-name:--font-display) font-extrabold text-[12px]" style={{ color: INK }}>Where your hours went</div>
              <div className="text-[11px] mt-0.5" style={{ color: MUTED }}>Effort by type of work</div>
              <div className="flex h-[26px] rounded-[7px] overflow-hidden mt-3.5">
                {acts.map(a => <div key={a.activity} style={{ flexBasis: `${(a.hours / actTotal) * 100}%`, background: a.color }} />)}
              </div>
              <div className="mt-3.5">
                {acts.map(a => <LegendRow key={a.activity} color={a.color} label={a.activity} value={`${fmtHours(a.hours)}h`} extra={`${pctOf(a.hours, actTotal)}%`} />)}
              </div>
            </div>
          </div>

          {/* billing blocks */}
          {blocks.map(blk => {
            const bHours = blk.projects.reduce((s, p) => s + p.hours, 0)
            return (
              <div key={blk.title} className="mt-4">
                <div className="flex items-center gap-3 p-[13px_18px] rounded-t-[12px]" style={{ background: blk.headBg, border: `1px solid ${BORDER}`, borderBottom: 'none' }}>
                  <span className="w-[11px] h-[11px] rounded-[3px] shrink-0" style={{ background: blk.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="font-(family-name:--font-display) font-black text-[13.5px]" style={{ color: INK }}>{blk.title}</div>
                    <div className="text-[11px] mt-px" style={{ color: MUTED }}>{blk.note}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-(family-name:--font-display) font-black text-[19px] tabular-nums leading-none" style={{ color: blk.color }}>{money(blk.invest)}</div>
                    <div className="text-[10px] mt-[3px]" style={{ color: MUTED }}>{fmtHours(bHours)} h · {pctOf(blk.invest, totalCost)}% of total</div>
                  </div>
                </div>
                <div className="rounded-b-[12px] overflow-hidden" style={{ border: `1px solid ${BORDER}`, borderTop: 'none' }}>
                  <table className="w-full text-[12px]" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: WARM, borderBottom: `1px solid ${BORDER}` }}>
                        <th className="text-left font-(family-name:--font-display) font-extrabold text-[9.5px] tracking-[.06em] uppercase p-[9px_16px]" style={{ color: MUTED }}>Project · Job code</th>
                        <th className="text-right font-(family-name:--font-display) font-extrabold text-[9.5px] tracking-[.06em] uppercase p-[9px_14px] whitespace-nowrap" style={{ color: MUTED }}>Hours</th>
                        <th className="text-right font-(family-name:--font-display) font-extrabold text-[9.5px] tracking-[.06em] uppercase p-[9px_14px] whitespace-nowrap" style={{ color: MUTED }}>Investment</th>
                        <th className="text-right font-(family-name:--font-display) font-extrabold text-[9.5px] tracking-[.06em] uppercase p-[9px_16px] whitespace-nowrap" style={{ color: MUTED, background: 'rgba(30,125,127,.07)', borderLeft: '1px solid rgba(1,35,88,.12)' }}>Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {blk.projects.map(p => (
                        <Fragment key={p.project}>
                          <tr style={{ borderBottom: `1px solid ${TRACK}` }}>
                            <td className="p-[9px_16px] font-(family-name:--font-display) font-bold" style={{ color: INK }}>{p.project}</td>
                            <td className="p-[9px_14px] text-right tabular-nums" style={{ color: BODY }}>{fmtHours(p.hours)}</td>
                            <td className="p-[9px_14px] text-right tabular-nums font-bold" style={{ color: INK }}>{money(p.cost)}</td>
                            <td className="p-[9px_16px] text-right tabular-nums" style={{ color: BODY, background: 'rgba(30,125,127,.05)', borderLeft: '1px solid rgba(1,35,88,.10)' }}>{pctOf(p.cost, totalCost)}%</td>
                          </tr>
                          {p.jobcodes.filter(jc => jc.hours > 0).map(jc => (
                            <tr key={`${p.project}-${jc.code}`} style={{ borderBottom: `1px solid #f4f5f7` }}>
                              <td className="p-[7px_16px] pl-9 text-[11.5px]" style={{ color: BODY }}>{jc.code}</td>
                              <td className="p-[7px_14px] text-right tabular-nums text-[11.5px]" style={{ color: MUTED }}>{fmtHours(jc.hours)}</td>
                              <td className="p-[7px_14px] text-right tabular-nums text-[11.5px]" style={{ color: BODY }}>{money(jc.cost)}</td>
                              <td className="p-[7px_16px] text-right tabular-nums text-[11.5px]" style={{ color: MUTED, background: 'rgba(30,125,127,.05)', borderLeft: '1px solid rgba(1,35,88,.10)' }}>{pctOf(jc.cost, totalCost)}%</td>
                            </tr>
                          ))}
                        </Fragment>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: '2px solid #cfd6de', background: '#f7f9fb' }}>
                        <td className="p-[11px_16px] font-(family-name:--font-display) font-extrabold" style={{ color: blk.color }}>Subtotal · {blk.title.includes('MME') ? 'MME invoice' : 'i7 invoice'}</td>
                        <td className="p-[11px_14px] text-right tabular-nums font-(family-name:--font-display) font-extrabold" style={{ color: blk.color }}>{fmtHours(bHours)}</td>
                        <td className="p-[11px_14px] text-right tabular-nums font-(family-name:--font-display) font-extrabold" style={{ color: blk.color }}>{money(blk.invest)}</td>
                        <td className="p-[11px_16px] text-right tabular-nums font-(family-name:--font-display) font-extrabold" style={{ color: blk.color, background: 'rgba(30,125,127,.07)', borderLeft: '1px solid rgba(1,35,88,.12)' }}>{pctOf(blk.invest, totalCost)}%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )
          })}

          {/* grand total */}
          <div className="mt-3.5 flex items-center justify-between gap-4 rounded-[12px] p-[13px_20px] text-white" style={{ background: INK }}>
            <span className="font-(family-name:--font-display) font-extrabold text-[12.5px] tracking-[.03em]">Grand total · all work delivered <span className="font-semibold" style={{ color: '#8fa6c6' }}>(i7 {money(i7Cost)}{mmeCost > 0 ? ` + MME ${money(mmeCost)}` : ''})</span></span>
            <span className="flex items-center gap-6 tabular-nums">
              <span className="text-[11.5px]" style={{ color: '#aebfd6' }}>{report.totalHours.toFixed(2)} h</span>
              <span className="font-(family-name:--font-display) font-black text-[19px]" style={{ color: GOLD }}>{money(totalCost)}</span>
            </span>
          </div>

          {/* highlights */}
          {note && (
            <div className="mt-[18px] flex gap-3 rounded-[12px] p-[16px_18px]" style={{ background: '#f7f9fb', border: `1px solid ${BORDER}` }}>
              <span className="shrink-0 w-8 h-8 rounded-[8px] inline-flex items-center justify-center" style={{ background: INK }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
              </span>
              <div>
                <div className="font-(family-name:--font-display) font-extrabold text-[12px] mb-1.5" style={{ color: INK }}>Highlights this month</div>
                <p className="text-[12px] leading-relaxed whitespace-pre-line m-0" style={{ color: BODY }}>{note}</p>
              </div>
            </div>
          )}

          <div className="mt-auto pt-4 flex items-center justify-between text-[10px]" style={{ borderTop: `1px solid ${BORDER}`, color: MUTED }}>
            <span>Prepared for i7 Marketing by True North Digital Marketing</span>
            <span>{monthLabel}</span>
            <span>Page 1 of 1</span>
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════════════ INTERNAL REPORT ══════════════════════════
  const showBudgetAvail = showCost && stdRate > 0
  const totBudget = report.projects.reduce((s, p) => s + (projectHours[p.project] ?? 0), 0)
  const totAvail = totBudget - report.totalHours
  const cardData = carryover ? [
    { l: 'Budget this month', v: moneySigned(carryover.totalAvailable), c: INK, sub: 'after carry in' },
    { l: 'Carried in', v: moneySigned(carryover.opening), c: carryover.opening < 0 ? RED : INK },
    { l: 'Total cost used', v: money(carryover.monthUsed), c: INK },
  ] : []

  // One project's rows (project → job code → activity) with per-person cells.
  const renderProject = (p: I7Report['projects'][number]) => {
    const budget = projectHours[p.project] ?? 0
    const avail = budget - p.hours
    const cells = (bp: Record<string, number>, faint = false) => report.people.map(n => (
      <td key={n} className={`p-[7px_9px] text-right tabular-nums text-[11px] ${faint ? 'opacity-70' : ''}`} style={{ color: faint ? MUTED : BODY }}>{bp[n] ? fmtHours(bp[n]) : <span style={{ color: '#cbd5e1' }}>—</span>}</td>
    ))
    return (
      <Fragment key={p.project}>
        <tr style={{ borderBottom: `1px solid ${TRACK}` }}>
          <td className="p-[8px_16px] font-(family-name:--font-display) font-bold whitespace-nowrap" style={{ color: INK }}>{p.project}</td>
          <td className="p-[8px_9px] text-right tabular-nums" style={{ color: BODY, background: 'rgba(30,125,127,.05)' }}>{budget ? budget.toLocaleString() : '—'}</td>
          <td className="p-[8px_9px] text-right tabular-nums" style={{ color: avail < 0 ? RED : BODY, background: 'rgba(30,125,127,.05)' }}>{budget ? avail.toFixed(2) : '—'}</td>
          {showBudgetAvail && <td className="p-[8px_9px] text-right tabular-nums font-semibold" style={{ color: avail < 0 ? RED : INK, background: 'rgba(30,125,127,.05)' }}>{budget ? moneySigned(avail * stdRate) : '—'}</td>}
          {showCost && <td className="p-[8px_9px] text-right tabular-nums font-bold" style={{ color: INK, background: 'rgba(30,125,127,.05)', borderRight: '1px solid rgba(1,35,88,.10)' }}>{p.cost > 0 ? money(p.cost) : '—'}</td>}
          {cells(p.byPerson)}
          <td className="p-[8px_9px] text-right tabular-nums font-bold" style={{ color: INK, background: 'rgba(242,196,10,.09)', borderLeft: '1px solid rgba(1,35,88,.10)' }}>{fmtHours(p.hours)}</td>
        </tr>
        {p.jobcodes.filter(jc => jc.hours > 0).map(jc => (
          <Fragment key={`${p.project}-${jc.code}`}>
            <tr style={{ borderBottom: `1px solid #f4f5f7` }}>
              <td className="p-[6px_16px] pl-8 font-medium text-[11.5px]" style={{ color: BODY }}>{jc.code}</td>
              <td style={{ background: 'rgba(30,125,127,.05)' }} /><td style={{ background: 'rgba(30,125,127,.05)' }} />{showBudgetAvail && <td style={{ background: 'rgba(30,125,127,.05)' }} />}
              {showCost && <td className="p-[6px_9px] text-right tabular-nums text-[11px]" style={{ color: BODY, background: 'rgba(30,125,127,.05)', borderRight: '1px solid rgba(1,35,88,.10)' }}>{jc.cost > 0 ? money(jc.cost) : '—'}</td>}
              {cells(jc.byPerson)}
              <td className="p-[6px_9px] text-right tabular-nums text-[11px]" style={{ color: BODY, background: 'rgba(242,196,10,.06)', borderLeft: '1px solid rgba(1,35,88,.10)' }}>{fmtHours(jc.hours)}</td>
            </tr>
            {jc.activities.map((a, i) => (
              <tr key={`${p.project}-${jc.code}-${i}`} style={{ borderBottom: `1px solid #f7f8fa` }}>
                <td className="p-[5px_16px] pl-[52px] text-[11px]" style={{ color: MUTED }}>{a.activity}</td>
                <td style={{ background: 'rgba(30,125,127,.04)' }} /><td style={{ background: 'rgba(30,125,127,.04)' }} />{showBudgetAvail && <td style={{ background: 'rgba(30,125,127,.04)' }} />}
                {showCost && <td className="p-[5px_9px] text-right tabular-nums text-[10.5px]" style={{ color: MUTED, background: 'rgba(30,125,127,.04)', borderRight: '1px solid rgba(1,35,88,.10)' }}>{a.cost > 0 ? money(a.cost) : '—'}</td>}
                {cells(a.byPerson, true)}
                <td className="p-[5px_9px] text-right tabular-nums text-[10.5px]" style={{ color: MUTED, background: 'rgba(242,196,10,.05)', borderLeft: '1px solid rgba(1,35,88,.10)' }}>{fmtHours(a.hours)}</td>
              </tr>
            ))}
          </Fragment>
        ))}
      </Fragment>
    )
  }

  const groupRow = (label: string, color: string) => (
    <tr style={{ background: color === MMEC ? 'rgba(184,121,10,.08)' : 'rgba(30,125,127,.09)' }}>
      <td colSpan={2 + (showBudgetAvail ? 1 : 0) + (showCost ? 1 : 0) + report.people.length + 2} className="p-[7px_16px] font-(family-name:--font-display) font-extrabold text-[9.5px] tracking-[.08em] uppercase" style={{ color }}>{label}</td>
    </tr>
  )
  const subtotalRow = (label: string, projs: I7Report['projects'], color: string) => {
    const hrs = projs.reduce((s, p) => s + p.hours, 0)
    const cost = projs.reduce((s, p) => s + p.cost, 0)
    const per: Record<string, number> = {}
    for (const p of projs) for (const [n, h] of Object.entries(p.byPerson)) per[n] = (per[n] ?? 0) + h
    return (
      <tr style={{ background: color === MMEC ? 'rgba(184,121,10,.06)' : 'rgba(30,125,127,.06)', borderTop: `1px solid ${BORDER}` }}>
        <td className="p-[8px_16px] font-(family-name:--font-display) font-extrabold text-[10px] uppercase tracking-wide" style={{ color }}>{label}</td>
        <td /><td />{showBudgetAvail && <td />}
        {showCost && <td className="p-[8px_9px] text-right tabular-nums font-(family-name:--font-display) font-extrabold" style={{ color, borderRight: '1px solid rgba(1,35,88,.10)' }}>{money(cost)}</td>}
        {report.people.map(n => <td key={n} className="p-[8px_9px] text-right tabular-nums font-bold text-[11px]" style={{ color: INK }}>{per[n] ? fmtHours(per[n]) : <span style={{ color: '#cbd5e1' }}>—</span>}</td>)}
        <td className="p-[8px_9px] text-right tabular-nums font-(family-name:--font-display) font-extrabold" style={{ color: INK, background: 'rgba(242,196,10,.12)', borderLeft: '1px solid rgba(1,35,88,.10)' }}>{fmtHours(hrs)}</td>
      </tr>
    )
  }

  const thF = 'text-right font-(family-name:--font-display) font-extrabold text-[9px] tracking-wide uppercase p-[8px_9px] whitespace-nowrap'
  const tealTh: React.CSSProperties = { background: 'rgba(30,125,127,.07)' }

  return (
    <div className="min-h-dvh print:min-h-0 py-8 print:py-0 print:bg-white" style={{ background: '#e9e7df' }}>
      {Toolbar}
      <div className={sheet} style={{ color: BODY }}>
        <Header label="Budget Usage Report" sub={`Generated ${generatedOn}`} />

        <div className="flex items-end justify-between gap-6 mt-5">
          <div>
            <h1 className="font-(family-name:--font-display) font-black text-[27px] leading-[1.05] m-0" style={{ color: INK }}>i7 Budget Usage Report</h1>
            <p className="text-[13px] mt-1.5" style={{ color: BODY }}>Hours, cost and budget usage for the <b style={{ color: INK }}>i7 Marketing</b> client · pulled from QuickBooks Time.</p>
          </div>
          <div className="text-right shrink-0">
            <div className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.1em] uppercase" style={{ color: MUTED }}>Pay period</div>
            <div className="font-(family-name:--font-display) font-extrabold text-[16px] mt-0.5" style={{ color: INK }}>{monthLabel}</div>
            <div className="text-[11.5px] mt-px tabular-nums" style={{ color: MUTED }}>{report.startDate} &rarr; {report.endDate}</div>
          </div>
        </div>

        {/* summary cards */}
        {carryover && (
          <>
            <div className="grid grid-cols-4 gap-3.5 mt-[22px]">
              {cardData.map(x => (
                <div key={x.l} className="rounded-[12px] p-[14px_16px] flex flex-col" style={{ border: `1px solid ${BORDER}` }}>
                  <div className="font-(family-name:--font-display) font-extrabold text-[9.5px] tracking-[.09em] uppercase" style={{ color: MUTED }}>{x.l}</div>
                  {x.sub && <div className="text-[10px] italic mt-0.5" style={{ fontFamily: 'Georgia, serif', color: '#a3adba' }}>{x.sub}</div>}
                  <div className="font-(family-name:--font-display) font-black text-[22px] mt-auto pt-1.5 tabular-nums" style={{ color: x.c }}>{x.v}</div>
                </div>
              ))}
              <div className="rounded-[12px] p-[14px_16px] flex flex-col" style={{ border: `1px solid ${onTrack ? '#d6ebe4' : BORDER}`, background: onTrack ? '#f2faf6' : '#fff' }}>
                <div className="flex items-center justify-between">
                  <div className="font-(family-name:--font-display) font-extrabold text-[9.5px] tracking-[.09em] uppercase" style={{ color: onTrack ? GREEN : MUTED }}>Balance left</div>
                  {onTrack && <span className="inline-flex items-center gap-1 text-[10px] font-bold" style={{ color: GREEN }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: GREEN }} />On track</span>}
                </div>
                <div className="font-(family-name:--font-display) font-black text-[22px] mt-auto pt-1.5 tabular-nums" style={{ color: budgetLeft < 0 ? RED : GREEN }}>{moneySigned(budgetLeft)}</div>
              </div>
            </div>
            <div className="flex items-center gap-3.5 mt-3.5">
              <div className="font-(family-name:--font-display) font-extrabold text-[10px] uppercase tracking-wide whitespace-nowrap" style={{ color: MUTED }}>Budget used</div>
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: TRACK }}><div className="h-full rounded-full" style={{ width: `${Math.min(100, usedPct * 100)}%`, background: 'linear-gradient(90deg,#1E7D7F,#31a39a)' }} /></div>
              <div className="text-[11px] font-bold whitespace-nowrap tabular-nums" style={{ color: BODY }}>{Math.round(usedPct * 100)}% used · {money(budgetLeft)} remaining</div>
            </div>
          </>
        )}

        {/* invoice reconciliation */}
        {showCost && mmeProjects.length > 0 && (
          <div className="mt-4 rounded-[12px] p-[14px_18px]" style={{ border: `1px solid ${BORDER}`, background: '#fbfcfd' }}>
            <div className="flex items-baseline justify-between gap-4 flex-wrap">
              <div className="font-(family-name:--font-display) font-extrabold text-[11px] tracking-[.04em] uppercase" style={{ color: INK }}>Invoice reconciliation</div>
              <div className="text-[11.5px] tabular-nums" style={{ color: BODY }}>Sheet total <b style={{ color: INK }}>{money(totalCost)}</b> &nbsp;=&nbsp; i7 invoice <b style={{ color: TEAL }}>{money(i7Cost)}</b> &nbsp;+&nbsp; MME separate invoice <b style={{ color: MMEC }}>{money(mmeCost)}</b></div>
            </div>
            <div className="flex h-5 rounded-[6px] overflow-hidden mt-2.5">
              <div className="flex items-center px-2.5 text-white font-(family-name:--font-display) font-extrabold text-[10.5px]" style={{ flexBasis: `${i7Pct}%`, background: TEAL }}>Billed to i7 · {money(i7Cost)}</div>
              <div style={{ flexBasis: `${100 - i7Pct}%`, background: MMEC }} />
            </div>
            <div className="mt-2 text-[10.5px] leading-relaxed" style={{ color: MUTED }}>Wagner Meters &amp; Bessemeter are billed to i7. <b style={{ color: BODY }}>Moisture Meters (MME)</b> is part of i7’s work report but invoiced separately to Wagner Meter — so the Sheet total is always higher than the i7 invoice by the MME amount.</div>
          </div>
        )}

        {/* charts row */}
        <div className="grid grid-cols-[1fr_0.85fr_1.05fr] gap-4 mt-5">
          <div className="rounded-[12px] p-[16px_18px]" style={{ border: `1px solid ${BORDER}` }}>
            <div className="font-(family-name:--font-display) font-extrabold text-[12px]" style={{ color: INK }}>Team workload</div>
            <div className="text-[11px] mt-0.5" style={{ color: MUTED }}>Hours logged per person</div>
            <div className="mt-3 flex flex-col gap-[9px]">
              {persons.map(w => (
                <div key={w.name} className="flex items-center gap-[9px] text-[11px]">
                  <span className="w-16 shrink-0 truncate" style={{ color: BODY }}>{w.name}</span>
                  <span className="flex-1 h-[9px] rounded-full overflow-hidden" style={{ background: TRACK }}><span className="block h-full rounded-full" style={{ width: `${(w.hours / maxPerson) * 100}%`, background: TEAL }} /></span>
                  <span className="w-9 text-right font-bold tabular-nums" style={{ color: INK }}>{fmtHours(w.hours)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[12px] p-[16px_18px]" style={{ border: `1px solid ${BORDER}` }}>
            <div className="font-(family-name:--font-display) font-extrabold text-[12px]" style={{ color: INK }}>Cost by project</div>
            <div className="text-[11px] mt-0.5" style={{ color: MUTED }}>Total {money(totalCost)} used</div>
            <div className="flex justify-center mt-2.5"><Donut segs={costSegs} size={118} sw={18} /></div>
            <div className="mt-2">{costSegs.map(s => <LegendRow key={s.label} color={s.color} label={s.label} value={money(s.value)} />)}</div>
          </div>

          <div className="rounded-[12px] p-[16px_18px]" style={{ border: `1px solid ${BORDER}` }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-(family-name:--font-display) font-extrabold text-[12px]" style={{ color: INK }}>Budget utilization</div>
                <div className="text-[11px] mt-0.5" style={{ color: MUTED }}>Hours used vs. hours budgeted</div>
              </div>
              {nearBudget && <span className="inline-flex items-center gap-1 text-[9.5px] font-bold rounded-full px-[9px] py-1" style={{ color: MMEC, background: '#fdf6dc' }}>MME near budget</span>}
            </div>
            <div className="mt-3 flex flex-col gap-[11px]">
              {util.map(u => {
                const p = u.pct ?? 0
                const color = p > 1 ? '#ef4444' : p >= 0.9 ? AMBER : TEAL
                return (
                  <div key={u.name}>
                    <div className="flex items-baseline justify-between text-[11px] mb-1">
                      <span className="font-semibold" style={{ color: BODY }}>{u.name}</span>
                      <span className="font-extrabold tabular-nums" style={{ color }}>{fmtHours(u.hours)} / {fmtHours(u.budget)} h · {Math.round(p * 100)}%</span>
                    </div>
                    <span className="block h-[9px] rounded-full overflow-hidden" style={{ background: TRACK }}><span className="block h-full rounded-full" style={{ width: `${Math.min(100, p * 100)}%`, background: color }} /></span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* invoice-grouped per-person table */}
        <div className="mt-5 rounded-[12px] overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
          <table className="w-full text-[11.5px]" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: WARM, borderBottom: `1px solid ${BORDER}` }}>
                <th className="text-left font-(family-name:--font-display) font-extrabold text-[9px] tracking-[.06em] uppercase p-[8px_16px] min-w-[200px]" style={{ color: MUTED }}>Project · Job code · Activity</th>
                <th className={thF} style={{ ...tealTh, color: MUTED, borderLeft: '1px solid rgba(1,35,88,.12)' }}>Budget hrs</th>
                <th className={thF} style={{ ...tealTh, color: MUTED }}>Hrs avail.</th>
                {showBudgetAvail && <th className={thF} style={{ ...tealTh, color: MUTED }}>Budget avail.</th>}
                {showCost && <th className={thF} style={{ ...tealTh, color: MUTED, borderRight: '1px solid rgba(1,35,88,.12)' }}>Budget used</th>}
                {report.people.map(n => <th key={n} className={thF} style={{ color: MUTED }}>{n}</th>)}
                <th className={thF} style={{ background: 'rgba(242,196,10,.2)', color: MUTED, borderLeft: '1px solid rgba(1,35,88,.12)' }}>Hours used</th>
              </tr>
            </thead>
            <tbody>
              {groupRow('i7 invoice', TEAL)}
              {i7Projects.map(renderProject)}
              {showCost && subtotalRow('Subtotal · i7 invoice', i7Projects, TEAL)}
              {mmeProjects.length > 0 && groupRow('Moisture Meters (MME) invoice', MMEC)}
              {mmeProjects.map(renderProject)}
              {showCost && mmeProjects.length > 0 && subtotalRow('Subtotal · MME invoice', mmeProjects, MMEC)}
              <tr style={{ borderTop: '2px solid #cfd6de', background: WARM }}>
                <td className="p-[9px_16px] font-(family-name:--font-display) font-extrabold" style={{ color: INK }}>Total</td>
                <td className="p-[9px_9px] text-right tabular-nums font-(family-name:--font-display) font-extrabold" style={{ color: INK, ...tealTh, borderLeft: '1px solid rgba(1,35,88,.12)' }}>{totBudget ? totBudget.toLocaleString() : '—'}</td>
                <td className="p-[9px_9px] text-right tabular-nums font-(family-name:--font-display) font-extrabold" style={{ color: totAvail < 0 ? RED : INK, ...tealTh }}>{totBudget ? totAvail.toFixed(2) : '—'}</td>
                {showBudgetAvail && <td className="p-[9px_9px] text-right tabular-nums font-(family-name:--font-display) font-extrabold" style={{ color: totAvail < 0 ? RED : GREEN, ...tealTh }}>{totBudget ? moneySigned(totAvail * stdRate) : '—'}</td>}
                {showCost && <td className="p-[9px_9px] text-right tabular-nums font-(family-name:--font-display) font-extrabold" style={{ color: INK, ...tealTh, borderRight: '1px solid rgba(1,35,88,.12)' }}>{money(totalCost)}</td>}
                {report.people.map(n => <td key={n} className="p-[9px_9px] text-right tabular-nums font-bold text-[11px]" style={{ color: INK }}>{byPerson[n] ? fmtHours(Math.round(byPerson[n] * 100) / 100) : <span style={{ color: '#cbd5e1' }}>—</span>}</td>)}
                <td className="p-[9px_9px] text-right tabular-nums font-(family-name:--font-display) font-extrabold" style={{ color: INK, background: 'rgba(242,196,10,.16)', borderLeft: '1px solid rgba(1,35,88,.12)' }}>{report.totalHours.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-[10.5px] leading-relaxed mt-3" style={{ color: MUTED }}>
          Hours pulled from QuickBooks Time, grouped by the “1 · i7 Code” and “3 · Activity” fields; one hours column per person. <b style={{ color: BODY }}>Budget used</b> = hours × each person’s rate.
          {showBudgetAvail && <> <b style={{ color: BODY }}>Budget avail.</b> = hours available × the i7 rate (${stdRate}/h).</>} Carried-in balance reflects last month’s over/under.
        </p>

        <div className="mt-auto pt-4 flex items-center justify-between text-[10px]" style={{ borderTop: `1px solid ${BORDER}`, color: MUTED }}>
          <span>True North Digital Marketing · Operations Portal</span>
          <span>Confidential · For internal use only</span>
          <span>Page 1 of 1</span>
        </div>
      </div>
    </div>
  )
}
