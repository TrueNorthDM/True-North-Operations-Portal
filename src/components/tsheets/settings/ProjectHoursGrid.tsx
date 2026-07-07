'use client'

// Per-month budgeted hours per i7 project — the report's "Budget hrs / Hrs
// avail." guide, now month-specific (i7_project_month_hours). Rows are projects,
// columns are months. Same 6-month editable window as the budget grid.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ConfirmModal } from './ConfirmModal'
import { editableMonths } from '@/lib/tsheets/retention'
import { saveProjectMonthHours } from '@/lib/tsheets/settings-actions'

export interface ProjectMonthHours { project: string; month: string; hours: number }  // month = 'YYYY-MM'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}
const key = (project: string, ym: string) => `${project}|${ym}`
const fmtHrs = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(2).replace(/\.?0+$/, ''))

export function ProjectHoursGrid({ clientId, projects, hours }: { clientId: number; projects: readonly string[]; hours: ProjectMonthHours[] }) {
  const router = useRouter()
  const months = editableMonths(new Date())
  const existing = new Map(hours.map(h => [key(h.project, h.month), h.hours]))

  const [vals, setVals] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {}
    for (const p of projects) for (const ym of months) {
      const h = existing.get(key(p, ym))
      o[key(p, ym)] = h != null ? String(h) : ''
    }
    return o
  })
  const [pending, setPending] = useState<null | { changes: { project: string; month: string; hours: number }[]; lines: string[] }>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(k: string, v: string) {
    setVals(s => ({ ...s, [k]: v }))
  }

  function diff() {
    const changes: { project: string; month: string; hours: number }[] = []
    const lines: string[] = []
    for (const p of projects) for (const ym of months) {
      const k = key(p, ym)
      const nv = vals[k] === '' ? 0 : Number(vals[k])
      const ov = existing.get(k) ?? 0
      if (nv !== ov) {
        changes.push({ project: p, month: ym, hours: nv })
        lines.push(`${p} · ${monthLabel(ym)}: ${ov ? fmtHrs(ov) : '—'} → ${nv ? fmtHrs(nv) : '—'} h`)
      }
    }
    return { changes, lines }
  }

  function review() {
    setError(null)
    const { changes, lines } = diff()
    if (!changes.length) { setError('No changes to save.'); return }
    setPending({ changes, lines })
  }

  async function confirm(justification: string) {
    if (!pending) return
    setLoading(true)
    const res = await saveProjectMonthHours({ clientId, changes: pending.changes, justification })
    setLoading(false)
    if (res.ok) { setPending(null); router.refresh() }
    else { setError(res.error ?? 'Save failed.'); setPending(null) }
  }

  const cellInput = 'w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-slate-400'
  const th = 'text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-3 py-2.5 whitespace-nowrap'
  const changeCount = diff().changes.length

  return (
    <div className="space-y-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Budget hours per project</div>
      <p className="text-xs text-slate-500">Budgeted hours the report shows per project, per month. Empty months show no guide.</p>
      <div className="rounded-xl border border-slate-200 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-3 py-2.5 sticky left-0 bg-slate-50">Project</th>
              {months.map(ym => <th key={ym} className={th}>{monthLabel(ym)}</th>)}
            </tr>
          </thead>
          <tbody>
            {projects.map(p => (
              <tr key={p} className="border-b border-slate-100 last:border-0">
                <td className="text-left text-xs font-medium text-slate-700 px-3 py-2 sticky left-0 bg-white whitespace-nowrap">{p}</td>
                {months.map(ym => (
                  <td key={ym} className="px-3 py-2">
                    <input type="number" min="0" step="0.5" value={vals[key(p, ym)]} onChange={e => set(key(p, ym), e.target.value)} placeholder="0" className={cellInput} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center justify-end gap-3">
        {changeCount > 0 && <span className="text-xs text-slate-500">{changeCount} cell{changeCount !== 1 ? 's' : ''} changed</span>}
        <button
          onClick={review}
          disabled={changeCount === 0}
          className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Review changes
        </button>
      </div>

      <ConfirmModal
        open={pending !== null}
        title="Confirm project hours change"
        lines={pending?.lines ?? []}
        onConfirm={confirm}
        onCancel={() => setPending(null)}
        loading={loading}
      />
    </div>
  )
}
