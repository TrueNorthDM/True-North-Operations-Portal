'use client'

// Per-month budgeted hours per i7 project, the report's "Budget hrs / Hrs
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
  function cancel() { setVals(initial()); setError(null); setEditing(false); setToast(null); setCopyFor(null) }

  // ── Fill helpers: copy a month across, or a project across, with a flash on the
  // changed cells and an undoable toast. All draft-only (Cancel / Review still gate).
  const [flash, setFlash] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<null | { msg: string; undo: () => void }>(null)
  // Copy-a-month dialog: which month opened it, the chosen scope, and (for the
  // "select months" scope) which target months are ticked.
  const [copyFor, setCopyFor] = useState<string | null>(null)
  const [copyScope, setCopyScope] = useState<'all' | 'future' | 'select'>('all')
  const [copySel, setCopySel] = useState<Set<string>>(new Set())

  function flashKeys(keys: string[]) {
    if (!keys.length) return
    setFlash(new Set(keys))
    window.setTimeout(() => setFlash(new Set()), 600)
  }
  function raiseToast(t: NonNullable<typeof toast>) {
    setToast(t)
    window.setTimeout(() => setToast(cur => (cur === t ? null : cur)), 6000)
  }

  function openCopy(ym: string) { setCopyFor(ym); setCopyScope('all'); setCopySel(new Set()) }
  function copyTargets(sourceYm: string): string[] {
    if (copyScope === 'future') return months.filter(m => m > sourceYm)
    if (copyScope === 'select') return months.filter(m => m !== sourceYm && copySel.has(m))
    return months.filter(m => m !== sourceYm)
  }
  function applyCopy() {
    if (!copyFor) return
    const sourceYm = copyFor
    const targets = copyTargets(sourceYm)
    if (!targets.length) return
    const prev = { ...vals }
    const next = { ...vals }
    const changed: string[] = []
    for (const p of projects) {
      const v = vals[key(p, sourceYm)] ?? ''
      for (const m of targets) { const k = key(p, m); if (next[k] !== v) { next[k] = v; changed.push(k) } }
    }
    setVals(next)
    setCopyFor(null)
    flashKeys(changed)
    const n = targets.length
    raiseToast({ msg: `Copied ${monthLabel(sourceYm)} to ${n} month${n !== 1 ? 's' : ''}`, undo: () => { setVals(prev); setToast(null) } })
  }

  function fillProject(project: string, sourceYm: string) {
    const prev = { ...vals }
    const v = vals[key(project, sourceYm)] ?? ''
    const next = { ...vals }
    const changed: string[] = []
    for (const m of months) { if (m === sourceYm) continue; const k = key(project, m); if (next[k] !== v) { next[k] = v; changed.push(k) } }
    if (!changed.length) return
    setVals(next)
    flashKeys(changed)
    raiseToast({ msg: `Filled ${project} across ${changed.length} month${changed.length !== 1 ? 's' : ''}`, undo: () => { setVals(prev); setToast(null) } })
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
        lines.push(`${p} · ${monthLabel(ym)}: ${ov ? fmtHrs(ov) : '-'} → ${nv ? fmtHrs(nv) : '-'} h`)
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

  // ── $ allocation (live): a PLANNING estimate, allocated = total budgeted hours
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
              {months.map(ym => (
                <th key={ym} className={th}>
                  <span className="inline-flex items-center justify-end gap-1.5">
                    {monthLabel(ym)}
                    {editing && (
                      <button
                        type="button"
                        onClick={() => openCopy(ym)}
                        title={`Copy ${monthLabel(ym)} to other months`}
                        aria-label={`Copy ${monthLabel(ym)} to other months`}
                        className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-[6px] text-[var(--bdg-orange-fg)] hover:bg-[#e08a1e] hover:text-white transition-colors"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                      </button>
                    )}
                  </span>
                </th>
              ))}
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
                      {editing ? (
                        <div className="relative group">
                          <input
                            type="number" min="0" step="0.5"
                            value={vals[key(p, ym)]}
                            onChange={e => set(key(p, ym), e.target.value)}
                            placeholder="0"
                            className={cellInput}
                            style={{ transition: 'background .5s, border-color .5s', ...(flash.has(key(p, ym)) ? { background: 'rgba(29,158,117,.16)', borderColor: '#1D9E75' } : {}) }}
                          />
                          <button
                            type="button"
                            onClick={() => fillProject(p, ym)}
                            title={`Fill ${p} across every month`}
                            aria-label={`Fill ${p} across every month`}
                            className="absolute left-1 top-1/2 -translate-y-1/2 hidden group-hover:inline-flex group-focus-within:inline-flex items-center justify-center w-[18px] h-[18px] rounded-[5px] bg-white border border-slate-200 text-[#e08a1e] hover:bg-[#e08a1e] hover:text-white hover:border-[#e08a1e] transition-colors"
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                          </button>
                        </div>
                      ) : (
                        <span className="tabular-nums font-semibold text-tn-ink">{h > 0 ? fmtHrs(h) : <span className="text-slate-300">-</span>}</span>
                      )}
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
                {months.map(ym => <td key={ym} className={`${sumCell} text-muted`}>{ceilingFor(ym) > 0 ? money(ceilingFor(ym)) : <span className="text-slate-300">-</span>}</td>)}
              </tr>
              <tr className="bg-subtle border-t border-slate-200">
                <td className={`text-left text-[10.5px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted px-3 py-2.5 sticky left-0 bg-subtle ${COL0}`}>Left to allocate</td>
                {months.map(ym => {
                  const left = ceilingFor(ym) - allocatedFor(ym)
                  if (ceilingFor(ym) <= 0) return <td key={ym} className={`${sumCell} text-slate-300`}>-</td>
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
        <p className="text-[11px] text-muted px-0.5 leading-relaxed">
          <b className="text-foreground">Copy a month</b> with the copy icon in its header, then choose which months to apply it to; <b className="text-foreground">fill one project</b> with the → on a focused cell. Both are undoable and only apply when you save.
        </p>
      )}
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

      {copyFor && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-[rgba(1,20,45,.44)] backdrop-blur-[2px] p-4" onClick={() => setCopyFor(null)}>
          <div className="w-full max-w-md rounded-[16px] bg-white shadow-[0_40px_90px_-30px_rgba(1,35,88,.6)] overflow-hidden tn-modal animate-[tn-modal-in_.2s_ease]" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-200">
              <h3 className="font-(family-name:--font-display) font-extrabold text-[16px] text-tn-ink">Copy {monthLabel(copyFor)} to other months</h3>
              <p className="text-xs text-muted mt-1">Applies {monthLabel(copyFor)}&rsquo;s hours (all projects) to the months you choose.</p>
            </div>
            <div className="p-5 space-y-2">
              {([
                { v: 'all', label: 'All other months', desc: `Every month except ${monthLabel(copyFor)}` },
                { v: 'future', label: 'Future months only', desc: `Months after ${monthLabel(copyFor)}` },
                { v: 'select', label: 'Select months', desc: 'Pick exactly which months' },
              ] as const).map(o => {
                const on = copyScope === o.v
                return (
                  <button key={o.v} type="button" onClick={() => setCopyScope(o.v)} className={`flex items-start gap-3 w-full text-left rounded-[11px] border px-3.5 py-3 transition-colors ${on ? 'border-tn-teal bg-tn-teal-soft' : 'border-slate-200 hover:border-slate-300'}`}>
                    <span className={`shrink-0 mt-0.5 inline-flex w-[18px] h-[18px] rounded-full border-2 items-center justify-center ${on ? 'border-tn-teal' : 'border-slate-300'}`}>
                      {on && <span className="w-2.5 h-2.5 rounded-full bg-tn-teal" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-(family-name:--font-display) font-bold text-[13.5px] text-tn-ink">{o.label}</span>
                      <span className="block text-[11.5px] text-muted mt-0.5">{o.desc}</span>
                    </span>
                  </button>
                )
              })}
              {copyScope === 'select' && (
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  {months.filter(m => m !== copyFor).map(m => {
                    const on = copySel.has(m)
                    return (
                      <button key={m} type="button" onClick={() => setCopySel(s => { const n = new Set(s); if (n.has(m)) n.delete(m); else n.add(m); return n })} className={`inline-flex items-center gap-2 rounded-[9px] border px-3 py-2 text-[12.5px] font-medium transition-colors ${on ? 'border-tn-teal bg-tn-teal-soft text-tn-teal' : 'border-slate-200 text-foreground hover:border-slate-300'}`}>
                        <span className={`inline-flex w-4 h-4 rounded-[5px] border items-center justify-center ${on ? 'bg-tn-teal border-tn-teal text-white' : 'border-slate-300'}`}>
                          {on && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>}
                        </span>
                        {monthLabel(m)}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button type="button" onClick={() => setCopyFor(null)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
              <button type="button" onClick={applyCopy} disabled={copyTargets(copyFor).length === 0} className="px-5 py-2.5 rounded-[10px] bg-tn-primary text-sm font-(family-name:--font-display) font-extrabold hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                <span className="text-[#ffffff]">Apply to {copyTargets(copyFor).length} month{copyTargets(copyFor).length !== 1 ? 's' : ''}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3.5 bg-[#012358] rounded-[12px] px-4 py-2.5 shadow-[0_16px_36px_-10px_rgba(1,20,45,.7)] animate-[tn-modal-in_.2s_ease]">
          <span className="text-[13px] font-medium text-[#ffffff]">{toast.msg}</span>
          <button type="button" onClick={toast.undo} className="text-[12.5px] font-(family-name:--font-display) font-extrabold text-[#ffffff] hover:underline">Undo</button>
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className="inline-flex items-center justify-center w-5 h-5 rounded-md text-[#ffffff] opacity-60 hover:opacity-100 hover:bg-[rgba(255,255,255,.12)] text-base leading-none">&times;</button>
        </div>
      )}
    </div>
  )
}
