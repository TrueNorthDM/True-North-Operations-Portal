'use client'

// "In Graphics" tab — dependency-free SVG/CSS charts from the same month's data
// (plus the Jan→month trend series). Four styles: donut (share of hours), radial
// rings (% of budget used), 100% stacked bar (activity mix), and a line+area
// trend. Values/labels are always shown as text (accessible; no color-only
// meaning), and the charts are static so they read immediately.

import type { ReactNode } from 'react'
import type { I7Report, I7TrendPoint } from '@/lib/tsheets/types'
import { fmtHours } from '@/lib/tsheets/format'

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const monShort = (ym: string) => MON[Number(ym.slice(5, 7)) - 1] ?? ym

// Distinct, colourblind-friendly palettes.
const PROJ = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#0ea5e9', '#a855f7']
const ACT = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6']
const OTHER = '#94a3b8'

interface Props {
  data: I7Report
  projectHours: Record<string, number>
  totalByPerson: Record<string, number>
  showCost: boolean
  trend: I7TrendPoint[]
  // 'full' = the on-screen In Graphics tab (all four charts).
  // 'client' = the client PDF — only activity mix + % of budget used (as bars).
  variant?: 'full' | 'client'
}

function Card({ title, subtitle, className = '', legend, children, dense = false }: { title: string; subtitle?: string; className?: string; legend?: ReactNode; children: ReactNode; dense?: boolean }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white ${dense ? 'p-4' : 'p-5'} ${className}`}>
      <div className={`${dense ? 'mb-3' : 'mb-4'} flex items-start justify-between gap-3 flex-wrap`}>
        <div>
          <h3 className={`${dense ? 'text-[11px]' : 'text-sm'} font-semibold text-slate-800`}>{title}</h3>
          {subtitle && <p className={`${dense ? 'text-[10px]' : 'text-xs'} text-slate-400 mt-0.5`}>{subtitle}</p>}
        </div>
        {legend}
      </div>
      {children}
    </div>
  )
}

function Legend({ items, dense = false }: { items: { label: string; color: string; value?: string }[]; dense?: boolean }) {
  return (
    <div className={`flex flex-wrap gap-x-4 gap-y-1.5 ${dense ? 'text-[10px]' : 'text-xs'} text-slate-600`}>
      {items.map(i => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className={`${dense ? 'w-2 h-2' : 'w-2.5 h-2.5'} rounded-sm shrink-0`} style={{ background: i.color }} />
          <span className="whitespace-nowrap">{i.label}{i.value != null && <span className="text-slate-400"> · {i.value}</span>}</span>
        </span>
      ))}
    </div>
  )
}

// ── Donut — share of hours by project ───────────────────────────────────────
function Donut({ segments, centerTop, centerBottom }: { segments: { label: string; value: number; color: string }[]; centerTop: string; centerBottom: string }) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  const r = 46, C = 2 * Math.PI * r
  const visible = segments.filter(s => s.value > 0)
  const fracs = visible.map(s => (total > 0 ? s.value / total : 0))
  // offset = prefix sum of the prior fractions (no render-time mutation).
  const arcs = visible.map((s, i) => ({
    ...s,
    dash: fracs[i] * C,
    offset: -fracs.slice(0, i).reduce((a, b) => a + b, 0) * C,
  }))
  return (
    <div className="flex items-center justify-center py-2">
      <svg viewBox="0 0 130 130" width="150" height="150" role="img">
        <g transform="rotate(-90 65 65)" fill="none" strokeWidth={17}>
          <circle cx="65" cy="65" r={r} stroke="#f1f5f9" />
          {arcs.map(a => <circle key={a.label} cx="65" cy="65" r={r} stroke={a.color} strokeDasharray={`${a.dash} ${C - a.dash}`} strokeDashoffset={a.offset} />)}
        </g>
        <text x="65" y="62" textAnchor="middle" fontSize="18" fontWeight="700" fill="#0f172a">{centerTop}</text>
        <text x="65" y="78" textAnchor="middle" fontSize="10" fill="#94a3b8">{centerBottom}</text>
      </svg>
    </div>
  )
}

// ── Radial rings — % of budget used per project ─────────────────────────────
function Rings({ rows }: { rows: { label: string; pct: number | null }[] }) {
  const r = 26, C = 2 * Math.PI * r
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-2">
      {rows.map(row => {
        const p = row.pct
        const has = p != null
        const fill = has ? Math.min(1, p) : 0
        const color = !has ? '#cbd5e1' : p > 1 ? '#ef4444' : p >= 0.9 ? '#f59e0b' : '#10b981'
        return (
          <div key={row.label} className="flex flex-col items-center">
            <svg viewBox="0 0 64 64" width="72" height="72" role="img">
              <g fill="none" strokeWidth={7}>
                <circle cx="32" cy="32" r={r} stroke="#f1f5f9" />
                <circle cx="32" cy="32" r={r} stroke={color} strokeLinecap="round" strokeDasharray={`${fill * C} ${C}`} transform="rotate(-90 32 32)" />
              </g>
              <text x="32" y="36" textAnchor="middle" fontSize="14" fontWeight="700" fill="#0f172a">{has ? `${Math.round(p * 100)}%` : '—'}</text>
            </svg>
            <span className="mt-1 text-xs text-slate-500 text-center leading-tight">{row.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Vertical bars — % of budget used per project (client PDF) ────────────────
function BudgetBars({ rows }: { rows: { label: string; pct: number | null; hours: number; budget: number }[] }) {
  const H = 106   // px height of the plot area (= 100% of budget)
  return (
    <div>
      <div className="relative flex items-end justify-around gap-3" style={{ height: H }}>
        {/* 100%-of-budget reference line */}
        <div className="absolute inset-x-0 top-0 border-t border-dashed border-slate-200" />
        <span className="absolute right-0 -top-1.5 text-[8px] text-slate-300 bg-white px-1">100%</span>
        {rows.map(row => {
          const p = row.pct
          const has = p != null
          const fill = has ? Math.min(1, p) : 0
          const color = !has ? '#cbd5e1' : p > 1 ? '#ef4444' : p >= 0.9 ? '#f59e0b' : '#10b981'
          return (
            <div key={row.label} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full">
              <span className="text-[10px] tabular-nums mb-1" style={{ color: has ? color : '#94a3b8' }}>{has ? `${Math.round(p * 100)}%` : '—'}</span>
              <div className="w-full max-w-[44px] rounded-t-md" style={{ height: `${Math.max(fill * H, has ? 3 : 0)}px`, background: color }} />
            </div>
          )
        })}
      </div>
      <div className="flex items-start justify-around gap-3 mt-2 border-t border-slate-100 pt-2">
        {rows.map(row => (
          <div key={row.label} className="flex-1 min-w-0 text-center">
            <div className="text-[10px] text-slate-500 leading-tight">{row.label}</div>
            {row.budget > 0 && <div className="text-[8px] tabular-nums text-slate-400 mt-0.5">{fmtHours(row.hours)} / {fmtHours(row.budget)} h</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 100% stacked bar — activity mix per project ─────────────────────────────
function StackedBars({ rows, colorOf, dense = false }: { rows: { label: string; total: number; parts: { activity: string; hours: number }[] }[]; colorOf: (a: string) => string; dense?: boolean }) {
  return (
    <div className={dense ? 'space-y-2.5' : 'space-y-3'}>
      {rows.filter(r => r.total > 0).map(r => (
        <div key={r.label}>
          <div className="flex items-baseline justify-between mb-1">
            <span className={`${dense ? 'text-[11px]' : 'text-sm'} text-slate-700`}>{r.label}</span>
            <span className={`${dense ? 'text-[10px]' : 'text-xs'} tabular-nums text-slate-400`}>{fmtHours(r.total)} h</span>
          </div>
          <div className={`flex ${dense ? 'h-3' : 'h-3.5'} rounded-full overflow-hidden bg-slate-100`}>
            {r.parts.map(p => (
              <div key={p.activity} title={`${p.activity}: ${fmtHours(p.hours)} h`} style={{ width: `${(p.hours / r.total) * 100}%`, background: colorOf(p.activity) }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Line + area — cost vs budget per month ──────────────────────────────────
function TrendChart({ trend }: { trend: I7TrendPoint[] }) {
  if (trend.length < 2) {
    return <p className="text-sm text-slate-400 py-6 text-center">Not enough months yet — the trend fills in as the year goes.</p>
  }
  const W = 640, H = 180, padL = 8, padR = 8, padT = 12, padB = 22
  const maxY = Math.max(1, ...trend.map(t => Math.max(t.cost, t.budget)))
  const x = (i: number) => padL + (i / (trend.length - 1)) * (W - padL - padR)
  const y = (v: number) => padT + (1 - v / maxY) * (H - padT - padB)
  const costPts = trend.map((t, i) => `${x(i)},${y(t.cost)}`).join(' ')
  const budgetPts = trend.map((t, i) => `${x(i)},${y(t.budget)}`).join(' ')
  const area = `${padL},${H - padB} ${costPts} ${x(trend.length - 1)},${H - padB}`
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" preserveAspectRatio="none" style={{ minWidth: 480 }}>
        {[0.25, 0.5, 0.75, 1].map(g => <line key={g} x1={padL} x2={W - padR} y1={y(maxY * g)} y2={y(maxY * g)} stroke="#f1f5f9" strokeWidth={1} />)}
        <polygon points={area} fill="#3b82f6" opacity="0.10" />
        <polyline points={budgetPts} fill="none" stroke="#94a3b8" strokeWidth={1.75} strokeDasharray="5 4" />
        <polyline points={costPts} fill="none" stroke="#3b82f6" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {trend.map((t, i) => <circle key={t.month} cx={x(i)} cy={y(t.cost)} r={3} fill="#3b82f6" />)}
        {trend.map((t, i) => <text key={t.month} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="#94a3b8">{monShort(t.month)}</text>)}
      </svg>
    </div>
  )
}

export function I7Charts({ data, projectHours, showCost, trend, variant = 'full' }: Props) {
  // Donut + rings — per project
  const projectSegments = data.projects.map((p, i) => ({ label: p.project, value: p.hours, color: PROJ[i % PROJ.length] }))
  const rings = data.projects.map(p => {
    const budget = projectHours[p.project] ?? 0
    return { label: p.project, pct: budget > 0 ? p.hours / budget : null, hours: p.hours, budget }
  })

  // Activity mix per project + a shared colour map (top activities coloured, rest grey).
  const globalAct = new Map<string, number>()
  for (const p of data.projects) for (const jc of p.jobcodes) for (const a of jc.activities) globalAct.set(a.activity, (globalAct.get(a.activity) ?? 0) + a.hours)
  const topActs = [...globalAct.entries()].sort((a, b) => b[1] - a[1]).slice(0, ACT.length).map(([a]) => a)
  const actColor = new Map(topActs.map((a, i) => [a, ACT[i]]))
  const colorOf = (a: string) => actColor.get(a) ?? OTHER
  const stackedRows = data.projects.map(p => {
    const m = new Map<string, number>()
    for (const jc of p.jobcodes) for (const a of jc.activities) m.set(a.activity, (m.get(a.activity) ?? 0) + a.hours)
    const parts = [...m.entries()].map(([activity, hours]) => ({ activity, hours })).sort((a, b) => b.hours - a.hours)
    return { label: p.project, total: p.hours, parts }
  })
  const actLegend = [...topActs.map((a, i) => ({ label: a, color: ACT[i] })), ...(globalAct.size > topActs.length ? [{ label: 'Other', color: OTHER }] : [])]

  // Client PDF — just the two charts i7 asked for, stacked full-width.
  if (variant === 'client') {
    return (
      <div className="space-y-4">
        <Card
          dense
          title="Activity mix per project"
          subtitle="How each project’s hours split by activity"
          legend={<Legend dense items={actLegend} />}
        >
          <StackedBars dense rows={stackedRows} colorOf={colorOf} />
        </Card>
        <Card dense title="% of budget used" subtitle="Hours used ÷ budgeted, per project">
          <BudgetBars rows={rings} />
        </Card>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      <Card
        title="Share of hours by project"
        subtitle={`${fmtHours(data.totalHours)} hours this month`}
        legend={<Legend items={projectSegments.filter(s => s.value > 0).map(s => ({ label: s.label, color: s.color }))} />}
      >
        <Donut segments={projectSegments} centerTop={fmtHours(data.totalHours)} centerBottom="hours" />
      </Card>

      <Card title="% of budget used" subtitle="Hours used ÷ budgeted, per project">
        <Rings rows={rings} />
      </Card>

      <Card
        title="Activity mix per project"
        subtitle="How each project’s hours split by activity"
        className="lg:col-span-2"
        legend={<Legend items={actLegend} />}
      >
        <StackedBars rows={stackedRows} colorOf={colorOf} />
      </Card>

      {showCost && (
        <Card
          title="Cost vs budget over the months"
          subtitle="January → this month"
          className="lg:col-span-2"
          legend={<Legend items={[{ label: 'Cost', color: '#3b82f6' }, { label: 'Budget', color: '#94a3b8' }]} />}
        >
          <TrendChart trend={trend} />
        </Card>
      )}
    </div>
  )
}
