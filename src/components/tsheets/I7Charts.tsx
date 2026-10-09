'use client'

// "In Graphics" tab, dependency-free SVG/CSS charts from the same period's data.
// Styled to the True North handoff: donut (hours by project), horizontal bars
// (hours by person), radial rings (budget utilization) and a 100% stacked bar
// (activity mix). Values and labels are always shown as text (accessible; no
// colour-only meaning). The client PDF draws its own (ReportPrint).

import type { ReactNode } from 'react'
import type { I7Report } from '@/lib/tsheets/types'
import { fmtHours } from '@/lib/tsheets/format'
import { activityMix } from '@/lib/tsheets/i7-view'

// Brand palette, teal / blue / purple / orange / cyan / green.
const PROJ = ['#1E7D7F', '#3B82C6', '#e08a1e', '#6d5ae0', '#00A3DD', '#009C3B']
const ACT = ['#1E7D7F', '#3B82C6', '#6d5ae0', '#e08a1e', '#00A3DD', '#009C3B']
const OTHER = '#8593a4'
const pct = (v: number, total: number) => (total > 0 ? Math.round((v / total) * 100) : 0)

interface Props {
  data: I7Report
  projectHours: Record<string, number>
  totalByPerson: Record<string, number>
}

function Card({ title, subtitle, className = '', legend, children }: { title: string; subtitle?: string; className?: string; legend?: ReactNode; children: ReactNode }) {
  return (
    <div className={`rounded-[16px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(1,35,88,.06)] p-5 ${className}`}>
      <div className={`mb-4 flex items-start justify-between gap-3 flex-wrap`}>
        <div>
          <h3 className={`text-[15px] font-(family-name:--font-display) font-extrabold text-tn-ink`}>{title}</h3>
          {subtitle && <p className={`text-xs text-muted mt-0.5`}>{subtitle}</p>}
        </div>
        {legend}
      </div>
      {children}
    </div>
  )
}

function Donut({ segments, centerTop, centerBottom }: { segments: { label: string; value: number; color: string }[]; centerTop: string; centerBottom: string }) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  const r = 46, C = 2 * Math.PI * r
  const visible = segments.filter(s => s.value > 0)
  const fracs = visible.map(s => (total > 0 ? s.value / total : 0))
  const arcs = visible.map((s, i) => ({
    ...s,
    dash: fracs[i] * C,
    offset: -fracs.slice(0, i).reduce((a, b) => a + b, 0) * C,
  }))
  return (
    <div className="flex items-center justify-center shrink-0">
      <svg viewBox="0 0 130 130" width="140" height="140" role="img" aria-label={`${centerTop} ${centerBottom.toLowerCase()}, by project: ${segments.filter(x => x.value > 0).map(x => `${x.label} ${fmtHours(x.value)}`).join(', ')}`}>
        <g transform="rotate(-90 65 65)" fill="none" strokeWidth={16}>
          <circle cx="65" cy="65" r={r} stroke="#eef0f3" />
          {arcs.map(a => <circle key={a.label} cx="65" cy="65" r={r} stroke={a.color} strokeDasharray={`${a.dash} ${C - a.dash}`} strokeDashoffset={a.offset} strokeLinecap="butt" />)}
        </g>
        <text x="65" y="63" textAnchor="middle" fontSize="20" fontWeight="800" fontFamily="Raleway, sans-serif" fill="#012358">{centerTop}</text>
        <text x="65" y="79" textAnchor="middle" fontSize="9" letterSpacing="1.5" fontFamily="Raleway, sans-serif" fontWeight="700" fill="#8593a4">{centerBottom}</text>
      </svg>
    </div>
  )
}

// ── Horizontal bars, hours by person ───────────────────────────────────────
function PersonBars({ rows }: { rows: { name: string; hours: number }[] }) {
  const max = Math.max(1, ...rows.map(r => r.hours))
  if (rows.length === 0) return <p className="text-sm text-muted py-6 text-center">No hours logged this period.</p>
  return (
    <div className="space-y-3">
      {rows.map(r => (
        <div key={r.name}>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-[13px] font-(family-name:--font-display) font-bold text-tn-ink">{r.name}</span>
            <span className="text-[13px] font-(family-name:--font-display) font-bold text-tn-ink tabular-nums">{fmtHours(r.hours)}</span>
          </div>
          <div className="h-2.5 rounded-full bg-subtle overflow-hidden">
            <div className="h-full rounded-full bg-tn-teal" style={{ width: `${Math.max((r.hours / max) * 100, 2)}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Radial rings, budget utilization per project ───────────────────────────
function Rings({ rows }: { rows: { label: string; pct: number | null; hours: number; budget: number }[] }) {
  const r = 24, C = 2 * Math.PI * r
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {rows.map(row => {
        const p = row.pct
        const has = p != null
        const fill = has ? Math.min(1, p) : 0
        const over = has && p > 1
        const near = has && p >= 0.9 && p <= 1
        const color = !has ? '#cbd5e1' : over ? '#ef4444' : near ? '#e08a1e' : '#1E7D7F'
        return (
          <div key={row.label} className="flex items-center gap-3 rounded-[12px] border border-slate-200 bg-subtle/50 p-3">
            <svg viewBox="0 0 60 60" width="58" height="58" role="img" aria-label={has ? `${row.label}: ${Math.round(p * 100)}% of its budgeted hours` : `${row.label}: no budgeted hours`} className="shrink-0">
              <g fill="none" strokeWidth={6}>
                <circle cx="30" cy="30" r={r} stroke="#eef0f3" />
                <circle cx="30" cy="30" r={r} stroke={color} strokeLinecap="round" strokeDasharray={`${fill * C} ${C}`} transform="rotate(-90 30 30)" />
              </g>
              <text x="30" y="34" textAnchor="middle" fontSize="13" fontWeight="800" fontFamily="Raleway, sans-serif" fill="#012358">{has ? `${Math.round(p * 100)}%` : '-'}</text>
            </svg>
            <div className="min-w-0">
              <div className="text-[13px] font-(family-name:--font-display) font-bold text-tn-ink truncate">{row.label}</div>
              {row.budget > 0 && <div className="text-[11px] text-muted mt-0.5">{fmtHours(row.hours)} of {fmtHours(row.budget)} hrs used</div>}
              {over && <span className="inline-flex items-center mt-1.5 text-[9px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-[var(--bdg-red-fg)] bg-[var(--bdg-red-bg)] rounded-[5px] px-1.5 py-0.5">Over budget</span>}
              {near && <span className="inline-flex items-center mt-1.5 text-[9px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-[var(--bdg-gold-fg)] bg-[var(--bdg-gold-bg)] rounded-[5px] px-1.5 py-0.5">Near budget</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Global 100% stacked bar, activity mix ──────────────────────────────────
function ActivityMix({ parts, total, colorOf }: { parts: { activity: string; hours: number }[]; total: number; colorOf: (a: string) => string }) {
  if (total <= 0) return <p className="text-sm text-muted py-4 text-center">No activity data this period.</p>
  return (
    <div>
      <div className="flex h-4 rounded-md overflow-hidden bg-subtle">
        {parts.map(p => (
          <div key={p.activity} title={`${p.activity}: ${fmtHours(p.hours)} h`} style={{ width: `${(p.hours / total) * 100}%`, background: colorOf(p.activity) }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 mt-3 text-xs">
        {parts.map(p => (
          <span key={p.activity} className="inline-flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: colorOf(p.activity) }} />
            <span className="text-foreground">{p.activity}</span>
            <span className="font-(family-name:--font-display) font-extrabold text-tn-ink tabular-nums">{fmtHours(p.hours)}h</span>
            <span className="text-muted">({pct(p.hours, total)}%)</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ── 100% stacked bar per project, activity mix (client PDF) ─────────────────
export function I7Charts({ data, projectHours, totalByPerson }: Props) {
  // Donut + rings, per project
  const projectSegments = data.projects.map((p, i) => ({ label: p.project, value: p.hours, color: PROJ[i % PROJ.length] }))
  const rings = data.projects.map(p => {
    const budget = projectHours[p.project] ?? 0
    return { label: p.project, pct: budget > 0 ? p.hours / budget : null, hours: p.hours, budget }
  })

  // Hours by person, sorted by name (matches the handoff order).
  const personRows = Object.entries(totalByPerson)
    .map(([name, hours]) => ({ name, hours: Math.round(hours * 100) / 100 }))
    .filter(r => r.hours > 0)
    .sort((a, b) => a.name.localeCompare(b.name))

  // Activity totals + a shared colour map (top activities coloured, rest grey).
  const globalAct = new Map(activityMix(data).map(a => [a.activity, a.hours]))
  const topActs = [...globalAct.entries()].sort((a, b) => b[1] - a[1]).slice(0, ACT.length).map(([a]) => a)
  const actColor = new Map(topActs.map((a, i) => [a, ACT[i]]))
  const colorOf = (a: string) => actColor.get(a) ?? OTHER

  const actTotal = [...globalAct.values()].reduce((s, h) => s + h, 0)
  const sumTop = topActs.reduce((s, a) => s + (globalAct.get(a) ?? 0), 0)
  const otherHours = actTotal - sumTop
  const globalParts = [
    ...topActs.map(a => ({ activity: a, hours: globalAct.get(a) ?? 0 })),
    ...(otherHours > 0.005 ? [{ activity: 'Other', hours: otherHours }] : []),
  ]
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      <Card title="Hours by project" subtitle="Share of logged hours this period">
        <div className="flex items-center gap-5">
          <Donut segments={projectSegments} centerTop={fmtHours(data.totalHours)} centerBottom="HOURS" />
          <div className="flex-1 min-w-0 space-y-2.5">
            {projectSegments.filter(s => s.value > 0).map(s => (
              <div key={s.label} className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
                <span className="flex-1 text-[13px] text-foreground truncate">{s.label}</span>
                <span className="text-[13px] font-(family-name:--font-display) font-bold text-tn-ink tabular-nums whitespace-nowrap">{fmtHours(s.value)}h · {pct(s.value, data.totalHours)}%</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card title="Hours by person" subtitle="Logged hours per team member">
        <PersonBars rows={personRows} />
      </Card>

      <Card title="Budget utilization" subtitle="Hours used against each project’s period budget" className="lg:col-span-2">
        <Rings rows={rings} />
      </Card>

      <Card title="Activity mix" subtitle="Where the hours went, by activity type" className="lg:col-span-2">
        <ActivityMix parts={globalParts} total={actTotal} colorOf={colorOf} />
      </Card>
    </div>
  )
}
