'use client'

import { Fragment, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ConfirmModal } from './ConfirmModal'
import { saveTrAssignment, deactivateTrAssignment } from '@/lib/tsheets/settings-actions'

export interface PersonWithAssignments {
  id: string
  name: string
  tsheetsUserId: number
  tsheetsOnly: boolean
  assignments: {
    id: number
    clientId: number
    clientName: string
    hourlyRate: number
    effectiveFrom: string
  }[]
}

interface Props {
  people: PersonWithAssignments[]
  allClients: { id: number; name: string }[]
}

// Which existing rate row is being edited (or removed) inline.
interface EditState {
  personId: string
  tsheetsUserId: number
  personName: string
  clientId: number
  clientName: string
  mode: 'edit' | 'remove'
  currentRate: number
}

// Which person is having a brand-new rate added.
interface AddState {
  personId: string
  tsheetsUserId: number
  personName: string
}

// The change queued for the justification modal.
type Pending =
  | { kind: 'save'; tsheetsUserId: number; clientId: number; hourlyRate: number; effectiveFrom: string; title: string; lines: string[] }
  | { kind: 'deactivate'; tsheetsUserId: number; clientId: number; effectiveFrom: string; title: string; lines: string[] }

export function PeopleTab({ people, allClients }: Props) {
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)

  const [expanded, setExpanded] = useState<string | null>(null)
  const [editing, setEditing] = useState<EditState | null>(null)
  const [adding, setAdding] = useState<AddState | null>(null)

  // Drafts (shared: only one row edits at a time)
  const [rate, setRate] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState(today)
  const [addClientId, setAddClientId] = useState('')

  const [pending, setPending] = useState<Pending | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function resetDrafts() {
    setEditing(null)
    setAdding(null)
    setRate('')
    setAddClientId('')
    setEffectiveFrom(today)
    setError(null)
  }

  function startEdit(person: PersonWithAssignments, a: PersonWithAssignments['assignments'][number]) {
    setAdding(null)
    setError(null)
    setEditing({
      personId: person.id, tsheetsUserId: person.tsheetsUserId, personName: person.name,
      clientId: a.clientId, clientName: a.clientName, mode: 'edit', currentRate: a.hourlyRate,
    })
    setRate(String(a.hourlyRate))
    setEffectiveFrom(today)
  }

  function startRemove(person: PersonWithAssignments, a: PersonWithAssignments['assignments'][number]) {
    setAdding(null)
    setError(null)
    setEditing({
      personId: person.id, tsheetsUserId: person.tsheetsUserId, personName: person.name,
      clientId: a.clientId, clientName: a.clientName, mode: 'remove', currentRate: a.hourlyRate,
    })
    setEffectiveFrom(today)
  }

  function startAdd(person: PersonWithAssignments) {
    setEditing(null)
    setError(null)
    setAdding({ personId: person.id, tsheetsUserId: person.tsheetsUserId, personName: person.name })
    setRate('')
    setAddClientId('')
    setEffectiveFrom(today)
  }

  function reviewEdit() {
    if (!editing) return
    if (editing.mode === 'edit') {
      if (!rate || Number(rate) <= 0) { setError('Enter a valid hourly rate.'); return }
      if (!effectiveFrom) { setError('Effective date is required.'); return }
      setError(null)
      setPending({
        kind: 'save', tsheetsUserId: editing.tsheetsUserId, clientId: editing.clientId,
        hourlyRate: Number(rate), effectiveFrom,
        title: 'Confirm rate change',
        lines: [
          `Person: ${editing.personName}`,
          `Client: ${editing.clientName}`,
          `Rate: $${editing.currentRate}/hr → $${rate}/hr`,
          `Effective from: ${effectiveFrom}`,
        ],
      })
    } else {
      if (!effectiveFrom) { setError('Effective date is required.'); return }
      setError(null)
      setPending({
        kind: 'deactivate', tsheetsUserId: editing.tsheetsUserId, clientId: editing.clientId, effectiveFrom,
        title: 'Confirm removal from project',
        lines: [
          `Person: ${editing.personName}`,
          `Client: ${editing.clientName}`,
          `Action: Remove from project (effective ${effectiveFrom})`,
          'Past reports still show their hours and rate for periods when they were active.',
        ],
      })
    }
  }

  function reviewAdd(clientName: string) {
    if (!adding) return
    if (!addClientId) { setError('Select a project.'); return }
    if (!rate || Number(rate) <= 0) { setError('Enter a valid hourly rate.'); return }
    if (!effectiveFrom) { setError('Effective date is required.'); return }
    setError(null)
    setPending({
      kind: 'save', tsheetsUserId: adding.tsheetsUserId, clientId: Number(addClientId),
      hourlyRate: Number(rate), effectiveFrom,
      title: 'Confirm rate assignment',
      lines: [
        `Person: ${adding.personName}`,
        `Client: ${clientName}`,
        `Rate: $${rate}/hr (new assignment)`,
        `Effective from: ${effectiveFrom}`,
      ],
    })
  }

  async function handleConfirm(justification: string) {
    if (!pending) return
    setLoading(true)
    const result = pending.kind === 'deactivate'
      ? await deactivateTrAssignment({ tsheetsUserId: pending.tsheetsUserId, clientId: pending.clientId, effectiveFrom: pending.effectiveFrom, justification })
      : await saveTrAssignment({ tsheetsUserId: pending.tsheetsUserId, clientId: pending.clientId, hourlyRate: pending.hourlyRate, effectiveFrom: pending.effectiveFrom, justification })
    setLoading(false)
    if (result.ok) {
      setPending(null)
      resetDrafts()
      router.refresh()
    } else {
      setError(result.error ?? 'Save failed.')
      setPending(null)
    }
  }

  const cellInput = 'w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-slate-400'

  if (people.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center space-y-2">
        <p className="text-sm font-medium text-slate-700">No people linked yet</p>
        <p className="text-xs text-slate-500">Click &ldquo;Sync people&rdquo; above to import TSheets users.</p>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-5 py-3 w-64">Person</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-5 py-3">Projects &amp; rates</th>
                <th className="px-5 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {people.map(person => {
                const assignedClientIds = new Set(person.assignments.map(a => a.clientId))
                const availableClients = allClients.filter(c => !assignedClientIds.has(c.id))
                const isExpanded = expanded === person.id
                const isAdding = adding?.personId === person.id

                return (
                  <Fragment key={person.id}>
                    {/* Person row */}
                    <tr
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 cursor-pointer"
                      onClick={() => {
                        setExpanded(isExpanded ? null : person.id)
                        resetDrafts()
                      }}
                    >
                      <td className="px-5 py-3.5 align-middle">
                        <span className="font-medium text-slate-900">{person.name}</span>
                        {person.tsheetsOnly && (
                          <span className="ml-2 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">TSheets only</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 align-middle">
                        {person.assignments.length === 0 ? (
                          <span className="text-xs text-slate-400">No rates assigned</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {person.assignments.map(a => (
                              <span key={a.id} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full tabular-nums">
                                {a.clientName} &middot; ${a.hourlyRate}/hr
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right align-middle">
                        <svg
                          className={`inline w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </td>
                    </tr>

                    {/* Expanded: inline-editable rates table */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={3} className="bg-slate-50/60 px-5 py-4 border-b border-slate-100">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-slate-500">
                                <th className="text-left font-medium pb-2 pr-3">Project</th>
                                <th className="text-left font-medium pb-2 pr-3 w-40">Rate ($/hr)</th>
                                <th className="text-left font-medium pb-2 pr-3 w-48">Effective from</th>
                                <th className="text-right font-medium pb-2 w-44">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {person.assignments.map(a => {
                                const rowEditing = editing?.personId === person.id && editing?.clientId === a.clientId
                                if (rowEditing && editing?.mode === 'edit') {
                                  return (
                                    <tr key={a.id}>
                                      <td className="py-2 pr-3 text-slate-900">{a.clientName}</td>
                                      <td className="py-2 pr-3">
                                        <input type="number" min="0" step="0.01" value={rate} onChange={e => setRate(e.target.value)} className={cellInput} placeholder="e.g. 45" />
                                      </td>
                                      <td className="py-2 pr-3">
                                        <input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} className={cellInput} />
                                      </td>
                                      <td className="py-2 text-right whitespace-nowrap">
                                        <button onClick={resetDrafts} className="text-slate-500 hover:text-slate-800 px-2">Cancel</button>
                                        <button onClick={reviewEdit} className="text-xs px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800">Review change</button>
                                      </td>
                                    </tr>
                                  )
                                }
                                if (rowEditing && editing?.mode === 'remove') {
                                  return (
                                    <tr key={a.id} className="bg-red-50/40">
                                      <td className="py-2 pr-3 text-slate-900">{a.clientName} <span className="text-red-600">(removing)</span></td>
                                      <td className="py-2 pr-3 text-slate-400">—</td>
                                      <td className="py-2 pr-3">
                                        <input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} className={cellInput} />
                                      </td>
                                      <td className="py-2 text-right whitespace-nowrap">
                                        <button onClick={resetDrafts} className="text-slate-500 hover:text-slate-800 px-2">Cancel</button>
                                        <button onClick={reviewEdit} className="text-xs px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700">Remove</button>
                                      </td>
                                    </tr>
                                  )
                                }
                                return (
                                  <tr key={a.id}>
                                    <td className="py-2 pr-3 text-slate-900">{a.clientName}</td>
                                    <td className="py-2 pr-3 text-slate-700 tabular-nums">${a.hourlyRate}/hr</td>
                                    <td className="py-2 pr-3 text-slate-400 tabular-nums">{a.effectiveFrom}</td>
                                    <td className="py-2 text-right whitespace-nowrap">
                                      <button onClick={() => startEdit(person, a)} className="text-slate-500 hover:text-slate-900 underline underline-offset-2 mr-3">Edit rate</button>
                                      <button onClick={() => startRemove(person, a)} className="text-red-500 hover:text-red-700 underline underline-offset-2">Remove</button>
                                    </td>
                                  </tr>
                                )
                              })}

                              {/* Add-a-rate row */}
                              {isAdding && (
                                <tr className="bg-white">
                                  <td className="py-2 pr-3">
                                    <select value={addClientId} onChange={e => setAddClientId(e.target.value)} className={cellInput}>
                                      <option value="">Select a project…</option>
                                      {availableClients.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="py-2 pr-3">
                                    <input type="number" min="0" step="0.01" value={rate} onChange={e => setRate(e.target.value)} className={cellInput} placeholder="e.g. 45" />
                                  </td>
                                  <td className="py-2 pr-3">
                                    <input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} className={cellInput} />
                                  </td>
                                  <td className="py-2 text-right whitespace-nowrap">
                                    <button onClick={resetDrafts} className="text-slate-500 hover:text-slate-800 px-2">Cancel</button>
                                    <button
                                      onClick={() => reviewAdd(availableClients.find(c => c.id === Number(addClientId))?.name ?? '')}
                                      className="text-xs px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800"
                                    >
                                      Review change
                                    </button>
                                  </td>
                                </tr>
                              )}

                              {person.assignments.length === 0 && !isAdding && (
                                <tr>
                                  <td colSpan={4} className="py-2 text-slate-400">No rates yet — assign one below.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>

                          {error && (editing?.personId === person.id || isAdding) && (
                            <p className="text-xs text-red-600 mt-2">{error}</p>
                          )}

                          {availableClients.length > 0 && !isAdding && !editing && (
                            <button
                              onClick={() => startAdd(person)}
                              className="mt-3 text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-white flex items-center gap-1 w-fit"
                            >
                              <span className="text-base leading-none">+</span>
                              <span>Assign to a project</span>
                            </button>
                          )}
                          {person.assignments.length > 0 && availableClients.length === 0 && !editing && (
                            <p className="mt-3 text-xs text-slate-400">All projects assigned.</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        open={pending !== null}
        title={pending?.title ?? 'Confirm change'}
        lines={pending?.lines ?? []}
        onConfirm={handleConfirm}
        onCancel={() => setPending(null)}
        loading={loading}
      />
    </>
  )
}
