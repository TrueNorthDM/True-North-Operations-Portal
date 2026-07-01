'use client'

import { useState } from 'react'
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
    <div className="space-y-2">
      {people.map(person => {
        const assignedClientIds = new Set(person.assignments.map(a => a.clientId))
        const availableClients = allClients.filter(c => !assignedClientIds.has(c.id))
        const isExpanded = expanded === person.id

        return (
          <div key={person.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {/* Person header */}
            <button
              className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-50"
              onClick={() => {
                setExpanded(isExpanded ? null : person.id)
                setEditing(null)
                setAddingFor(null)
              }}
            >
              <div className="flex-1">
                <span className="text-sm font-medium text-slate-900">{person.name}</span>
                {person.tsheetsOnly && (
                  <span className="ml-2 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">TSheets only</span>
                )}
                <span className="ml-3 text-xs text-slate-400">
                  {person.assignments.length === 0
                    ? 'No projects'
                    : `${person.assignments.length} project${person.assignments.length !== 1 ? 's' : ''}`}
                </span>
              </div>
              <svg
                className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isExpanded && (
              <div className="border-t border-slate-100 px-5 py-4 space-y-3">
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
                    <tbody className="divide-y divide-slate-50">
                      {person.assignments.map(a => (
                        <tr key={a.id}>
                          <td className="py-2 text-slate-900">{a.clientName}</td>
                          <td className="py-2 text-slate-700">${a.hourlyRate}/hr</td>
                          <td className="py-2 text-slate-400">{a.effectiveFrom}</td>
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
                              Edit
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
                        className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1"
                      >
                        <span className="text-base leading-none">+</span>
                        <span>Add to project</span>
                      </button>
                    )}
                  </div>
                )}

                {person.assignments.length === 0 && availableClients.length === 0 && (
                  <p className="text-xs text-slate-400">All projects assigned.</p>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
