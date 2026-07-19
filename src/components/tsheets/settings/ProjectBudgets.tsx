'use client'

// Per-project budgeted HOURS, the "guide" level shown when a client is
// expanded, below its high-level $ budget. Each change goes through the same
// justification modal and audit trail as the rest.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ConfirmModal } from './ConfirmModal'
import { saveProjectBudget } from '@/lib/tsheets/settings-actions'

export interface ProjectBudget {
  project: string
  hours: number | null
}

interface Props {
  clientId: number
  projects: ProjectBudget[]
  onSaved: () => void
}

const currentMonth = () => new Date().toISOString().slice(0, 7)

export function ProjectBudgets({ clientId, projects, onSaved }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState<string | null>(null)
  const [hours, setHours] = useState('')
  const [month, setMonth] = useState(currentMonth())
  const [pending, setPending] = useState<{ project: string; hoursAllocated: number; effectiveFrom: string; lines: string[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function startEdit(p: ProjectBudget) {
    setEditing(p.project)
    setHours(p.hours != null ? String(p.hours) : '')
    setMonth(currentMonth())
    setError(null)
  }

  function review(p: ProjectBudget) {
    if (hours === '' || Number(hours) < 0) { setError('Enter budget hours (0 or more).'); return }
    if (!month) { setError('Pick an effective month.'); return }
    setError(null)
    setPending({
      project: p.project,
      hoursAllocated: Number(hours),
      effectiveFrom: `${month}-01`,
      lines: [
        `Project: ${p.project}`,
        `Budget hours: ${p.hours ?? 'none'} → ${hours}`,
        `Effective from: ${month}`,
      ],
    })
  }

  async function handleConfirm(justification: string) {
    if (!pending) return
    setLoading(true)
    const res = await saveProjectBudget({
      clientId,
      project: pending.project,
      hoursAllocated: pending.hoursAllocated,
      effectiveFrom: pending.effectiveFrom,
      justification,
    })
    setLoading(false)
    if (res.ok) { setPending(null); setEditing(null); onSaved(); router.refresh() }
    else { setError(res.error ?? 'Save failed.'); setPending(null) }
  }

  const cellInput = 'w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400'

  return (
    <div className="mt-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Budget hours per project (guide)</div>
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <th className="text-left font-medium px-4 py-2">Project</th>
              <th className="text-right font-medium px-4 py-2 w-36">Budget hours</th>
              <th className="text-left font-medium px-4 py-2 w-44">Effective from</th>
              <th className="px-4 py-2 w-32" />
            </tr>
          </thead>
          <tbody>
            {projects.map(p => {
              const isEd = editing === p.project
              return (
                <tr key={p.project} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 text-slate-800">{p.project}</td>
                  <td className="px-4 py-2 text-right">
                    {isEd
                      ? <input type="number" min="0" step="0.5" value={hours} onChange={e => setHours(e.target.value)} placeholder="e.g. 221" className={cellInput} />
                      : <span className="tabular-nums text-slate-700">{p.hours != null ? p.hours.toLocaleString() : <span className="text-slate-300">-</span>}</span>}
                  </td>
                  <td className="px-4 py-2">
                    {isEd
                      ? <input type="month" value={month} onChange={e => setMonth(e.target.value)} className={cellInput} />
                      : <span className="text-slate-400">-</span>}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    {isEd ? (
                      <>
                        <button onClick={() => setEditing(null)} className="text-slate-500 hover:text-slate-800 px-2">Cancel</button>
                        <button onClick={() => review(p)} className="text-xs px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800">Review</button>
                      </>
                    ) : (
                      <button onClick={() => startEdit(p)} className="text-slate-500 hover:text-slate-900 underline underline-offset-2">
                        {p.hours != null ? 'Edit' : 'Set hours'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      <ConfirmModal
        open={pending !== null}
        title="Confirm project budget hours"
        lines={pending?.lines ?? []}
        onConfirm={handleConfirm}
        onCancel={() => setPending(null)}
        loading={loading}
      />
    </div>
  )
}
