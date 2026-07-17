'use client'

/**
 * ClientsProjectsTab — the client, its projects, and the live job codes under
 * each (grouped from the TSheets "1 · i7 Code" field by prefix). Each project
 * shows the people assigned to it (the people.i7_projects roster) and the auto-
 * calculated AVERAGE billing rate the Budget Usage Report uses.
 *
 * This is also where the roster is EDITED: per project, "Edit" opens a people
 * picker so you choose who works on it (saveProjectRoster reconciles everyone's
 * people.i7_projects). Rates themselves live in People & rates.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveProjectRoster } from '@/lib/tsheets/settings-actions'
import type { ProjectDirectory } from '@/lib/tsheets/report-data'

const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

export function ClientsProjectsTab({ directory }: { directory: ProjectDirectory }) {
  const { clientName, rows, month, standardRate, allPeople } = directory
  const router = useRouter()
  const totalCodes = rows.reduce((s, r) => s + r.jobCodes.length, 0)

  const [editProject, setEditProject] = useState<string | null>(null)
  const [draft, setDraft] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function startEdit(project: string, assignedIds: string[]) {
    setError(null)
    setEditProject(project)
    setDraft(new Set(assignedIds))
  }
  function toggle(id: string) {
    setDraft(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  async function save(project: string) {
    setSaving(true)
    setError(null)
    const res = await saveProjectRoster({ project, personIds: [...draft] })
    setSaving(false)
    if (res.ok) { setEditProject(null); router.refresh() }
    else setError(res.error ?? 'Save failed.')
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[14px] border border-slate-200 bg-white overflow-hidden shadow-[0_1px_2px_rgba(1,35,88,.06)]">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-subtle">
          <span className="shrink-0 inline-flex w-9 h-9 items-center justify-center rounded-[10px] bg-tn-teal text-white">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 1v22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
          </span>
          <div className="min-w-0">
            <h3 className="font-(family-name:--font-display) font-extrabold text-[16px] text-tn-ink truncate">{clientName}</h3>
            <p className="text-[12px] text-muted mt-0.5">{rows.length} projects · {totalCodes} job codes</p>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {rows.map(row => {
            const editing = editProject === row.project
            return (
              <div key={row.project} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">{row.project}</div>
                    <div className="text-[11.5px] text-muted mt-0.5">{row.jobCodes.length} job code{row.jobCodes.length === 1 ? '' : 's'}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="inline-flex items-baseline gap-1 rounded-[10px] bg-tn-teal-soft px-3 py-1.5">
                      <span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-teal tabular-nums">{money(row.avgRate)}</span>
                      <span className="text-[10.5px] font-semibold text-tn-teal/80">/h</span>
                    </div>
                    <div className="text-[10px] text-muted mt-1 font-(family-name:--font-display) font-bold uppercase tracking-wide">
                      {row.usingFallback ? 'Standard rate' : 'Average rate'}
                    </div>
                  </div>
                </div>

                {/* job codes */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {row.jobCodes.length > 0 ? row.jobCodes.map(code => (
                    <span key={code} className="inline-flex items-center rounded-[7px] border border-slate-200 bg-subtle px-2 py-1 text-[11px] font-(family-name:--font-display) font-bold text-foreground tabular-nums">
                      {code}
                    </span>
                  )) : <span className="text-[11.5px] text-muted italic">No job codes logged yet</span>}
                </div>

                {/* assigned people — read view + edit */}
                <div className="mt-3">
                  {editing ? (
                    <div className="rounded-[10px] border border-tn-teal/40 bg-tn-teal-soft/40 p-3">
                      <div className="text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted mb-2">
                        Who works on {row.project}?
                      </div>
                      {allPeople.length === 0 ? (
                        <p className="text-[11.5px] text-muted italic">No people available. Sync people or add them in the Directory first.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {allPeople.map(p => {
                            const on = draft.has(p.id)
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => toggle(p.id)}
                                className={`inline-flex items-center gap-1.5 rounded-full pl-2 pr-2.5 py-1 text-[11.5px] font-semibold border transition-colors ${
                                  on ? 'bg-tn-teal text-white border-tn-teal' : 'bg-white text-foreground border-slate-200 hover:border-tn-teal'
                                }`}
                              >
                                <span className={`inline-flex w-3.5 h-3.5 items-center justify-center rounded-full text-[9px] ${on ? 'bg-white/25' : 'bg-slate-100'}`}>
                                  {on ? '✓' : '+'}
                                </span>
                                {p.name}
                              </button>
                            )
                          })}
                        </div>
                      )}
                      {error && <div className="text-[11.5px] text-[var(--bdg-red-fg)] mt-2">{error}</div>}
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          type="button"
                          onClick={() => save(row.project)}
                          disabled={saving}
                          className="inline-flex items-center gap-1.5 font-(family-name:--font-display) font-extrabold text-[12px] text-white bg-tn-primary rounded-[9px] px-3.5 py-2 hover:brightness-110 transition-all disabled:opacity-60"
                        >
                          <span className="text-[#ffffff]">{saving ? 'Saving…' : 'Save'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditProject(null)}
                          disabled={saving}
                          className="font-(family-name:--font-display) font-extrabold text-[12px] text-foreground border border-slate-200 rounded-[9px] px-3.5 py-2 hover:border-slate-300 transition-colors disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted">Assigned</span>
                      {row.assignedPeople.length > 0 ? row.assignedPeople.map(p => (
                        <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 pl-2 pr-2.5 py-0.5 text-[11.5px]">
                          <span className="font-semibold text-tn-ink">{p.name}</span>
                          <span className="tabular-nums text-muted">{p.rate > 0 ? money(p.rate) : '—'}</span>
                        </span>
                      )) : (
                        <span className="text-[11.5px] text-muted italic">No one assigned — using the standard rate.</span>
                      )}
                      <button
                        type="button"
                        onClick={() => startEdit(row.project, row.assignedPeople.map(p => p.id))}
                        className="inline-flex items-center gap-1 text-[11.5px] font-(family-name:--font-display) font-bold text-tn-teal hover:text-tn-primary transition-colors ml-1"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <p className="text-[12px] text-muted leading-relaxed">
        Job codes are read live from QuickBooks Time (the “1 · i7 Code” field), grouped into projects by prefix. Assign people to
        a project with <b className="text-foreground">Edit</b> — the <b className="text-foreground">average rate</b> is then the mean
        billing rate (from People &amp; rates) of those people, resolved for <b className="text-foreground">{month}</b>, and is what
        the Budget Usage Report multiplies by each project’s budgeted hours. Projects with no one assigned fall back to the standard
        rate ({money(standardRate)}/h).
      </p>
    </div>
  )
}
