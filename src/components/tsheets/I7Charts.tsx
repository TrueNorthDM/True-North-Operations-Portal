'use client'

// "In Graphics" tab of the i7 Budget Usage Report. Flat, dependency-free CSS
// bar/bullet charts computed from the same month's data as the table. Values are
// always shown as text next to each bar (accessible; no color-only meaning), and
// bars are transform/opacity only for the entrance (skipped under reduced-motion).

import type { I7Report } from '@/lib/tsheets/types'

function fmtHours(n: number): string {
  if (n === 0) return '0'
  return n % 1 === 0 ? String(n) : n.toFixed(2).replace(/\.?0+$/, '')
}
const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US')

interface Props {
  data: I7Report
  projectHours: Record<string, number>
  totalByPerson: Record<string, number>
  showCost: boolean
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

// A plain comparison bar (value relative to the row set's max).
function Bars({ rows, max, fmt, accent = 'bg-slate-800' }: {
  rows: { label: string; value: number; hint?: string }[]
  max: number
  fmt: (n: number) => string
  accent?: string
}) {
  if (rows.length === 0) return <p className="text-sm text-slate-400">No data this month.</p>
  return (
    <div className="space-y-2.5">
      {rows.map(r => (
        <div key={r.label} className="flex items-center gap-3">
          <div className="w-36 shrink-0 text-sm text-slate-700 truncate" title={r.label}>{r.label}</div>
          <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div className={`h-full rounded-full ${accent}`} style={{ width: `${max > 0 ? Math.max(2, (r.value / max) * 100) : 0}%` }} />
          </div>
          <div className="w-28 shrink-0 text-right text-sm tabular-nums font-medium text-slate-800">{fmt(r.value)}</div>
        </div>
      ))}
    </div>
  )
}

// Bullet bar — actual (used) against a target (budgeted). Normalised per row so
// each project reads its own % regardless of absolute size. Colour = status.
function Bullets({ rows }: { rows: { label: string; used: number; budget: number }[] }) {
  return (
    <div className="space-y-3.5">
      {rows.map(r => {
        const pct = r.budget > 0 ? (r.used / r.budget) * 100 : 0
        const fill = Math.min(100, pct)
        const over = pct > 100
        const color = over ? 'bg-red-500' : pct >= 90 ? 'bg-amber-500' : 'bg-emerald-500'
        return (
          <div key={r.label}>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-sm text-slate-700">{r.label}</span>
              <span className="text-xs tabular-nums text-slate-500">
                <b className="text-slate-900">{fmtHours(r.used)}</b> / {r.budget > 0 ? fmtHours(r.budget) : '—'} h
                {r.budget > 0 && <span className={`ml-1.5 font-semibold ${over ? 'text-red-600' : 'text-slate-400'}`}>{Math.round(pct)}%</span>}
              </span>
            </div>
            <div className="relative h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div className={`h-full rounded-full ${r.budget > 0 ? color : 'bg-slate-300'}`} style={{ width: `${r.budget > 0 ? fill : 0}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function I7Charts({ data, projectHours, totalByPerson, showCost }: Props) {
  // Per-project rows
  const projectRows = data.projects.map(p => ({
    label: p.project,
    used: p.hours,
    budget: projectHours[p.project] ?? 0,
    cost: p.cost,
  }))

  // Hours by activity — aggregated across the whole tree.
  const actMap = new Map<string, number>()
  for (const p of data.projects) for (const jc of p.jobcodes) for (const a of jc.activities) {
    actMap.set(a.activity, (actMap.get(a.activity) ?? 0) + a.hours)
  }
  const activityRows = [...actMap.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)

  // Hours by person.
  const personRows = Object.entries(totalByPerson).map(([label, value]) => ({ label, value: Math.round(value * 100) / 100 })).sort((a, b) => b.value - a.value)

  const costRows = [...projectRows].filter(r => r.cost > 0).sort((a, b) => b.cost - a.cost).map(r => ({ label: r.label, value: r.cost }))
  const maxActivity = Math.max(0, ...activityRows.map(r => r.value))
  const maxPerson = Math.max(0, ...personRows.map(r => r.value))
  const maxCost = Math.max(0, ...costRows.map(r => r.value))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      <Card title="Hours: used vs budgeted" subtitle="Per project · green under budget, red over">
        <Bullets rows={projectRows} />
      </Card>

      {showCost && (
        <Card title="Budget used ($)" subtitle="Per project · where the spend went this month">
          <Bars rows={costRows} max={maxCost} fmt={money} accent="bg-slate-900" />
        </Card>
      )}

      <Card title="Hours by activity" subtitle="Content, SEO, WebDev, Social…">
        <Bars rows={activityRows} max={maxActivity} fmt={n => `${fmtHours(n)} h`} accent="bg-blue-500" />
      </Card>

      <Card title="Hours by person" subtitle="Who logged the time this month">
        <Bars rows={personRows} max={maxPerson} fmt={n => `${fmtHours(n)} h`} accent="bg-indigo-500" />
      </Card>
    </div>
  )
}
