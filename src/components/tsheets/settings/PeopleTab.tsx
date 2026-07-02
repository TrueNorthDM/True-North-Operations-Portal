'use client'

import { Fragment, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AssignmentForm } from './AssignmentForm'

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

interface EditTarget {
  personId: string
  clientId: number
  clientName: string
  current: { hourlyRate: number; effectiveFrom: string } | null
}

interface Props {
  people: PersonWithAssignments[]
  allClients: { id: number; name: string }[]
}

export function PeopleTab({ people, allClients }: Props) {
  const router = useRouter()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editing, setEditing] = useState<EditTarget | null>(null)
  const [addingFor, setAddingFor] = useState<string | null>(null)
  const [selectedClientId, setSelectedClientId] = useState<string>('')

  function handleClose() {
    setEditing(null)
    setAddingFor(null)
    setSelectedClientId('')
    router.refresh()
  }

  if (people.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center space-y-2">
        <p className="text-sm font-medium text-slate-700">No people linked yet</p>
        <p className="text-xs text-slate-500">Click &ldquo;Sync people&rdquo; above to import TSheets users.</p>
      </div>
    )
  }

  return (
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

              return (
                <Fragment key={person.id}>
                  {/* Person row */}
                  <tr
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 cursor-pointer"
                    onClick={() => {
                      setExpanded(isExpanded ? null : person.id)
                      setEditing(null)
                      setAddingFor(null)
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

                  {/* Expanded detail */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={3} className="bg-slate-50/60 px-5 py-4 border-b border-slate-100">
                        <div className="space-y-3">
                          {/* Assignment list */}
                          {person.assignments.length > 0 && (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-slate-500">
                                  <th className="text-left font-medium pb-2">Project</th>
                                  <th className="text-left font-medium pb-2">Rate</th>
                                  <th className="text-left font-medium pb-2">Since</th>
                                  <th className="pb-2" />
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {person.assignments.map(a => (
                                  <tr key={a.id}>
                                    <td className="py-2 text-slate-900">{a.clientName}</td>
                                    <td className="py-2 text-slate-700 tabular-nums">${a.hourlyRate}/hr</td>
                                    <td className="py-2 text-slate-400 tabular-nums">{a.effectiveFrom}</td>
                                    <td className="py-2 text-right">
                                      <button
                                        onClick={() => {
                                          setAddingFor(null)
                                          setEditing({
                                            personId: person.id,
                                            clientId: a.clientId,
                                            clientName: a.clientName,
                                            current: { hourlyRate: a.hourlyRate, effectiveFrom: a.effectiveFrom },
                                          })
                                        }}
                                        className="text-slate-500 hover:text-slate-900 underline underline-offset-2"
                                      >
                                        Edit rate
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}

                          {/* Inline assignment form (edit existing) */}
                          {editing && editing.personId === person.id && (
                            <AssignmentForm
                              person={{ tsheetsUserId: person.tsheetsUserId, name: person.name }}
                              client={{ id: editing.clientId, name: editing.clientName }}
                              current={editing.current}
                              onClose={handleClose}
                            />
                          )}

                          {/* Add to project */}
                          {availableClients.length > 0 && (
                            <div>
                              {addingFor === person.id && selectedClientId ? (
                                <AssignmentForm
                                  person={{ tsheetsUserId: person.tsheetsUserId, name: person.name }}
                                  client={{
                                    id: Number(selectedClientId),
                                    name: allClients.find(c => c.id === Number(selectedClientId))?.name ?? '',
                                  }}
                                  current={null}
                                  onClose={handleClose}
                                />
                              ) : addingFor === person.id ? (
                                <div className="flex items-center gap-2">
                                  <select
                                    value={selectedClientId}
                                    onChange={e => setSelectedClientId(e.target.value)}
                                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                                  >
                                    <option value="">Select a project...</option>
                                    {availableClients.map(c => (
                                      <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={() => { setAddingFor(null); setSelectedClientId('') }}
                                    className="text-sm text-slate-400 hover:text-slate-700"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setEditing(null); setAddingFor(person.id) }}
                                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-white flex items-center gap-1 w-fit"
                                >
                                  <span className="text-base leading-none">+</span>
                                  <span>Assign to a project</span>
                                </button>
                              )}
                            </div>
                          )}

                          {person.assignments.length === 0 && availableClients.length === 0 && (
                            <p className="text-xs text-slate-400">All projects assigned.</p>
                          )}
                        </div>
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
  )
}
