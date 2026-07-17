'use client'

// Per-month budgeted hours per i7 project — the report's "Budget hrs / Hrs
// avail." guide (i7_project_month_hours). Rows are projects, columns are months
// (a 6-month window). Opens read-only; "Edit" turns the section editable with
// its own Review → Save.

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

// Shared first-column width so this table lines up with the monthly-budget one.
const COL0 = 'w-52'

export function ProjectHoursGrid({ clientId, projects, hours, estimateRate, budgets }: {
  clientId: number
  projects: readonly string[]
  hours: ProjectMonthHours[]
  /** The highest Rate/client (People & rates), applied uniformly to estimate the $ each project's hours cost. */
  estimateRate?: number
  /** month 'YYYY-MM' → the month's $ ceiling (budget + extra). */
  budgets?: Record<string, number>
}) {
  const router = useRouter()
  const months = editableMonths(new Date())
  const existing = new Map(hours.map(h => [key(h.project, h.month), h.hours]))

  const initial = () => {
    const o: Record<string, string> = {}
    for (const p of projects) for (const ym of months) {
      const h = existing.get(key(p, ym))
      o[key(p, ym)] = h != null ? String(h) : ''
    }
    return o
  }
  const [vals, setVals] = useState(initial)
  const [editing, setEditing] = useState(false)
  const [pending, setPending] = useState<null | { changes: { project: string; month: string; hours: number }[]; lines: string[] }>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(k: string, v: string) { setVals(s => ({ ...s, [k]: v })) }
  function startEdit() { setVals(initial()); setError(null); setEditing(true) }
  function cancel() { setVals(initial()); setError(null); setEditing(false) }

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
    if (res.ok) { setPending(null); setEditing(false); router.refresh() }
    else { setError(res.error ?? 'Save failed.'); setPending(null) }
  }

  const cellInput = 'num-cell w-full rounded-[8px] border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-right tabular-nums text-tn-ink focus:outline-none focus:border-[#e08a1e]'
  const th = 'text-right text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-[var(--bdg-orange-fg)] px-3 py-3 whitespace-nowrap'
  const changeCount = diff().changes.length

  // ── $ allocation (live): a PLANNING estimate — allocated = total budgeted hours
  // × the highest Rate/client (the same rate for every project); the month's budget
  // (budget + extra) is the ceiling; left/over = ceiling − allocated.
  const money = (n: number) => `$${Math.round(n).toLocaleString()}`
  const curHours = (p: string, ym: string) => {
    if (editing) { const v = vals[key(p, ym)]; return v === '' ? 0 : Number(v) || 0 }
    return existing.get(key(p, ym)) ?? 0
  }
  const allocatedFor = (ym: string) => (estimateRate ?? 0) * projects.reduce((s, p) => s + curHours(p, ym), 0)
  const ceilingFor = (ym: string) => budgets?.[ym] ?? 0
  const showAlloc = !!estimateRate && estimateRate > 0 && !!budgets && Object.keys(budgets).some(m => (budgets[m] ?? 0) > 0)
  const sumCell = 'px-3 py-2 text-right tabular-nums whitespace-nowrap'

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="border-l-[3px] border-[#e08a1e] pl-3">
          <h3 className="font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink">Budget hours per project</h3>
          <p className="text-xs text-muted mt-0.5">Budgeted hours the report shows per project, per month. Empty months show no guide.</p>
        </div>
        {!editing && (
          <button onClick={startEdit} className="shrink-0 inline-flex items-center gap-1.5 text-[12.5px] font-(family-name:--font-display) font-extrabold px-3.5 py-2 rounded-[9px] bg-[#e08a1e] text-white hover:brightness-110 transition-all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
            Edit
          </button>
        )}
      </div>
      <div className="rounded-[12px] border border-slate-200 overflow-x-auto">
        <table className="min-w-full text-sm table-fixed">
          <thead>
            <tr className="bg-hfa-soft border-b border-slate-200">
              <th className={`text-left text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-[var(--bdg-orange-fg)] px-3 py-3 sticky left-0 bg-hfa-soft ${COL0}`}>Project</th>
              {months.map(ym => <th key={ym} className={th}>{monthLabel(ym)}</th>)}
            </tr>
          </thead>
          <tbody>
            {projects.map(p => (
              <tr key={p} className="border-b border-slate-100 last:border-0">
                <td className="text-left text-[12px] font-(family-name:--font-display) font-bold text-tn-ink px-3 py-2.5 sticky left-0 bg-white whitespace-nowrap">{p}</td>
                {months.map(ym => {
                  const h = existing.get(key(p, ym)) ?? 0
                  return (
                    <td key={ym} className="px-3 py-2 text-right">
                      {editing
                        ? <input type="number" min="0" step="0.5" value={vals[key(p, ym)]} onChange={e => set(key(p, ym), e.target.value)} placeholder="0" className={cellInput} />
                        : <span className="tabular-nums font-semibold text-tn-ink">{h > 0 ? fmtHrs(h) : <span className="text-slate-300">—</span>}</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
          {showAlloc && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-subtle">
                <td className={`text-left text-[10.5px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted px-3 py-2.5 sticky left-0 bg-subtle ${COL0}`}>Allocated</td>
                {months.map(ym => <td key={ym} className={`${sumCell} font-semibold text-tn-ink`}>{money(allocatedFor(ym))}</td>)}
              </tr>
              <tr className="bg-subtle">
                <td className={`text-left text-[10.5px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted px-3 py-2.5 sticky left-0 bg-subtle ${COL0}`}>Budget (ceiling)</td>
                {months.map(ym => <td key={ym} className={`${sumCell} text-muted`}>{ceilingFor(ym) > 0 ? money(ceilingFor(ym)) : <span className="text-slate-300">—</span>}</td>)}
              </tr>
              <tr className="bg-subtle border-t border-slate-200">
                <td className={`text-left text-[10.5px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted px-3 py-2.5 sticky left-0 bg-subtle ${COL0}`}>Left to allocate</td>
                {months.map(ym => {
                  const left = ceilingFor(ym) - allocatedFor(ym)
                  if (ceilingFor(ym) <= 0) return <td key={ym} className={`${sumCell} text-slate-300`}>—</td>
                  const over = left < 0
                  return (
                    <td key={ym} className={`${sumCell} font-(family-name:--font-display) font-extrabold ${over ? 'text-[var(--bdg-red-fg)]' : 'text-[var(--bdg-green-fg)]'}`}>
                      {over ? `${money(-left)} over` : money(left)}
                    </td>
                  )
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {showAlloc && (
        <p className="text-[11px] text-muted leading-relaxed px-0.5">
          Planning estimate: <b className="text-foreground">Allocated</b> = total budgeted hours × the highest Rate/client ({money(estimateRate ?? 0)}/h, from People &amp; rates). <b className="text-foreground">Budget</b> = the month’s budget + extra (the ceiling). <b className="text-foreground">Left</b> = ceiling − allocated; red means the hours don’t fit the budget at that rate.
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      {editing && (
        <div className="flex items-center justify-end gap-3">
          {changeCount > 0 && <span className="text-xs text-slate-500">{changeCount} cell{changeCount !== 1 ? 's' : ''} changed</span>}
          <button onClick={cancel} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
          <button
            onClick={review}
            disabled={changeCount === 0}
            className="px-5 py-2.5 rounded-[10px] bg-tn-primary text-white text-sm font-(family-name:--font-display) font-extrabold hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Review changes
          </button>
        </div>
      )}

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
