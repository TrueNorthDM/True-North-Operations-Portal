'use client'

import { Fragment, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ConfirmModal } from './ConfirmModal'
import { saveTrAssignment, deactivateTrAssignment } from '@/lib/tsheets/settings-actions'
import { linkTsheetsPersonToDirectory } from '@/lib/tsheets/sync-actions'

export interface PersonWithAssignments {
  id: string
  name: string
  title: string | null
  teams: string[]
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

export interface DirectoryOption {
  id: string
  name: string
  title: string | null
}

interface Props {
  people: PersonWithAssignments[]
  allClients: { id: number; name: string }[]
  directoryOptions: DirectoryOption[]
}

type Assignment = PersonWithAssignments['assignments'][number]

// Which cell is being edited, and how.
interface EditState {
  key: string                 // `${personId}:${clientId}` or `${personId}:new`
  personId: string
  tsheetsUserId: number
  personName: string
  clientId: number | null     // null while a brand-new rate has no project picked yet
  clientName: string | null
  mode: 'edit' | 'remove' | 'new'
  currentRate: number | null
}

type Pending =
  | { kind: 'save'; tsheetsUserId: number; clientId: number; hourlyRate: number; effectiveFrom: string; title: string; lines: string[] }
  | { kind: 'deactivate'; tsheetsUserId: number; clientId: number; effectiveFrom: string; title: string; lines: string[] }

// ── Icons (stroke, 20px) ────────────────────────────────────────────────────
const iconCls = 'w-4 h-4'
const Pencil = () => <svg className={iconCls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.862 4.487z" /></svg>
const Save = () => <svg className={iconCls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" /><path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-8H7v8M7 3v5h8" /></svg>
const Trash = () => <svg className={iconCls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-7 0v12a1 1 0 001 1h6a1 1 0 001-1V7" /></svg>
const XMark = () => <svg className={iconCls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
const Plus = () => <svg className={iconCls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" /></svg>
const LinkIcon = () => <svg className={iconCls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>

export function PeopleTab({ people, allClients, directoryOptions }: Props) {
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)

  const [edit, setEdit] = useState<EditState | null>(null)
  const [clientId, setClientId] = useState('')   // for a new rate's project picker
  const [rate, setRate] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState(today)

  const [linking, setLinking] = useState<string | null>(null)  // tsheets_only person being linked
  const [linkTarget, setLinkTarget] = useState('')

  const [pending, setPending] = useState<Pending | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function cancel() {
    setEdit(null)
    setClientId('')
    setRate('')
    setEffectiveFrom(today)
    setLinking(null)
    setLinkTarget('')
    setError(null)
  }

  async function handleLink(personId: string) {
    if (!linkTarget) { setError('Select a directory person to link to.'); return }
    setLoading(true)
    const result = await linkTsheetsPersonToDirectory({ tsheetsOnlyPersonId: personId, directoryPersonId: linkTarget })
    setLoading(false)
    if (result.ok) { setLinking(null); setLinkTarget(''); setError(null); router.refresh() }
    else setError(result.error ?? 'Link failed.')
  }

  function startEdit(p: PersonWithAssignments, a: Assignment) {
    setError(null)
    setEdit({ key: `${p.id}:${a.clientId}`, personId: p.id, tsheetsUserId: p.tsheetsUserId, personName: p.name, clientId: a.clientId, clientName: a.clientName, mode: 'edit', currentRate: a.hourlyRate })
    setRate(String(a.hourlyRate)); setEffectiveFrom(today)
  }
  function startRemove(p: PersonWithAssignments, a: Assignment) {
    setError(null)
    setEdit({ key: `${p.id}:${a.clientId}`, personId: p.id, tsheetsUserId: p.tsheetsUserId, personName: p.name, clientId: a.clientId, clientName: a.clientName, mode: 'remove', currentRate: a.hourlyRate })
    setEffectiveFrom(today)
  }
  function startNew(p: PersonWithAssignments) {
    setError(null)
    setEdit({ key: `${p.id}:new`, personId: p.id, tsheetsUserId: p.tsheetsUserId, personName: p.name, clientId: null, clientName: null, mode: 'new', currentRate: null })
    setClientId(''); setRate(''); setEffectiveFrom(today)
  }

  function review(availableName?: string) {
    if (!edit) return
    if (edit.mode === 'remove') {
      if (!effectiveFrom) { setError('Effective date is required.'); return }
      setPending({
        kind: 'deactivate', tsheetsUserId: edit.tsheetsUserId, clientId: edit.clientId!, effectiveFrom,
        title: 'Confirm removal from project',
        lines: [
          `Person: ${edit.personName}`,
          `Client: ${edit.clientName}`,
          `Action: Remove from project (effective ${effectiveFrom})`,
          'Past reports still show their hours and rate for periods when they were active.',
        ],
      })
      return
    }
    // edit or new
    const cid = edit.mode === 'new' ? Number(clientId) : edit.clientId!
    const cname = edit.mode === 'new' ? (availableName ?? '') : (edit.clientName ?? '')
    if (edit.mode === 'new' && !clientId) { setError('Select a project.'); return }
    if (!rate || Number(rate) <= 0) { setError('Enter a valid hourly rate.'); return }
    if (!effectiveFrom) { setError('Effective date is required.'); return }
    setError(null)
    setPending({
      kind: 'save', tsheetsUserId: edit.tsheetsUserId, clientId: cid, hourlyRate: Number(rate), effectiveFrom,
      title: edit.mode === 'new' ? 'Confirm rate assignment' : 'Confirm rate change',
      lines: [
        `Person: ${edit.personName}`,
        `Client: ${cname}`,
        edit.mode === 'new' ? `Rate: $${rate}/hr (new assignment)` : `Rate: $${edit.currentRate}/hr → $${rate}/hr`,
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
    if (result.ok) { setPending(null); cancel(); router.refresh() }
    else { setError(result.error ?? 'Save failed.'); setPending(null) }
  }

  const cellInput = 'w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400'
  const iconBtn = 'inline-flex items-center justify-center p-1.5 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100'

  if (people.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center space-y-2">
        <p className="text-sm font-medium text-slate-700">No people linked yet</p>
        <p className="text-xs text-slate-500">Click &ldquo;Sync people&rdquo; above to import TSheets users.</p>
      </div>
    )
  }

  // Row helpers ---------------------------------------------------------------
  function editCells(availableClients: { id: number; name: string }[], isNew: boolean, personName: string) {
    return (
      <>
        <td className="px-5 py-2.5">
          {isNew ? (
            <select value={clientId} onChange={e => setClientId(e.target.value)} className={cellInput} aria-label="Project">
              <option value="">Select a project…</option>
              {availableClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : (
            <span className="text-slate-400 text-xs">{personName}</span>
          )}
        </td>
        <td className="px-5 py-2.5">
          <input type="number" min="0" step="0.01" value={rate} onChange={e => setRate(e.target.value)} placeholder="e.g. 45" className={cellInput} aria-label="Hourly rate" />
        </td>
        <td className="px-5 py-2.5">
          <input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} className={cellInput} aria-label="Effective from" />
        </td>
      </>
    )
  }

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-5 py-3 w-56">Person</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-5 py-3">Project</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-5 py-3 w-40">Rate ($/hr)</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-5 py-3 w-48">Effective from</th>
                <th className="text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-5 py-3 w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {people.map(person => {
                const assignedIds = new Set(person.assignments.map(a => a.clientId))
                const availableClients = allClients.filter(c => !assignedIds.has(c.id))
                const rows: Assignment[] = person.assignments.length ? person.assignments : []
                const addingNew = edit?.mode === 'new' && edit.personId === person.id
                const subtitle = [person.title, person.teams.join(', ')].filter(Boolean).join(' · ')
                const nameCell = (show: boolean) => (
                  <td className="px-5 py-2.5 align-middle">
                    {show && (
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-slate-900">{person.name}</span>
                          {person.tsheetsOnly && (
                            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">TSheets only</span>
                          )}
                        </div>
                        {subtitle && <div className="text-xs text-slate-400 mt-0.5">{subtitle}</div>}
                      </div>
                    )}
                  </td>
                )

                // total rendered rows for this person = assignment rows (or 1 empty) + maybe a new row
                const showEmptyRow = rows.length === 0 && !addingNew

                return (
                  <Fragment key={person.id}>
                    {rows.map((a, idx) => {
                      const isEditing = edit?.key === `${person.id}:${a.clientId}`
                      const showName = idx === 0
                      if (isEditing && edit?.mode === 'edit') {
                        return (
                          <tr key={a.id} className="border-b border-slate-100 bg-slate-50/60">
                            {nameCell(showName)}
                            <td className="px-5 py-2.5 text-slate-900">{a.clientName}</td>
                            <td className="px-5 py-2.5"><input type="number" min="0" step="0.01" value={rate} onChange={e => setRate(e.target.value)} className={cellInput} aria-label="Hourly rate" /></td>
                            <td className="px-5 py-2.5"><input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} className={cellInput} aria-label="Effective from" /></td>
                            <td className="px-5 py-2.5 text-right whitespace-nowrap">
                              <button onClick={() => review()} className={iconBtn} title="Save" aria-label="Save"><Save /></button>
                              <button onClick={cancel} className={iconBtn} title="Cancel" aria-label="Cancel"><XMark /></button>
                            </td>
                          </tr>
                        )
                      }
                      if (isEditing && edit?.mode === 'remove') {
                        return (
                          <tr key={a.id} className="border-b border-slate-100 bg-red-50/50">
                            {nameCell(showName)}
                            <td className="px-5 py-2.5 text-slate-900">{a.clientName} <span className="text-red-600 text-xs">(removing)</span></td>
                            <td className="px-5 py-2.5 text-slate-400">—</td>
                            <td className="px-5 py-2.5"><input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} className={cellInput} aria-label="Effective from" /></td>
                            <td className="px-5 py-2.5 text-right whitespace-nowrap">
                              <button onClick={() => review()} className="inline-flex items-center justify-center p-1.5 rounded-md text-red-500 hover:text-red-700 hover:bg-red-50" title="Confirm removal" aria-label="Confirm removal"><Trash /></button>
                              <button onClick={cancel} className={iconBtn} title="Cancel" aria-label="Cancel"><XMark /></button>
                            </td>
                          </tr>
                        )
                      }
                      // display row
                      const isLast = idx === rows.length - 1
                      return (
                        <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                          {nameCell(showName)}
                          <td className="px-5 py-2.5 text-slate-900">{a.clientName}</td>
                          <td className="px-5 py-2.5 text-slate-700 tabular-nums">${a.hourlyRate}/hr</td>
                          <td className="px-5 py-2.5 text-slate-400 tabular-nums">{a.effectiveFrom}</td>
                          <td className="px-5 py-2.5 text-right whitespace-nowrap">
                            <button onClick={() => startEdit(person, a)} className={iconBtn} title="Edit rate" aria-label="Edit rate"><Pencil /></button>
                            <button onClick={() => startRemove(person, a)} className={iconBtn} title="Remove from project" aria-label="Remove from project"><Trash /></button>
                            {isLast && availableClients.length > 0 && (
                              <button onClick={() => startNew(person)} className={iconBtn} title="Assign to another project" aria-label="Assign to another project"><Plus /></button>
                            )}
                          </td>
                        </tr>
                      )
                    })}

                    {/* Empty person → single row with an assign action (or its inline editor) */}
                    {showEmptyRow && (
                      <tr className="border-b border-slate-100 hover:bg-slate-50/60">
                        {nameCell(true)}
                        <td className="px-5 py-2.5 text-slate-400 text-xs" colSpan={3}>No rate assigned</td>
                        <td className="px-5 py-2.5 text-right whitespace-nowrap">
                          {availableClients.length > 0 ? (
                            <button onClick={() => startNew(person)} className={iconBtn} title="Assign a rate" aria-label="Assign a rate"><Plus /></button>
                          ) : <span className="text-xs text-slate-300">no projects</span>}
                        </td>
                      </tr>
                    )}

                    {/* New-rate editor row */}
                    {addingNew && (
                      <tr className="border-b border-slate-100 bg-slate-50/60">
                        {nameCell(rows.length === 0)}
                        {editCells(availableClients, true, person.name)}
                        <td className="px-5 py-2.5 text-right whitespace-nowrap">
                          <button onClick={() => review(availableClients.find(c => c.id === Number(clientId))?.name)} className={iconBtn} title="Save" aria-label="Save"><Save /></button>
                          <button onClick={cancel} className={iconBtn} title="Cancel" aria-label="Cancel"><XMark /></button>
                        </td>
                      </tr>
                    )}

                    {/* Link a TSheets-only import to a real directory person */}
                    {person.tsheetsOnly && (
                      <tr className="border-b border-slate-100 bg-amber-50/40">
                        <td className="px-5 py-2.5 text-xs text-amber-700 align-middle">Not in the org directory</td>
                        <td className="px-5 py-2.5 align-middle" colSpan={3}>
                          {directoryOptions.length === 0 ? (
                            <span className="text-xs text-slate-400">No unlinked directory people — add them in Admin → People first.</span>
                          ) : (
                            <select
                              value={linking === person.id ? linkTarget : ''}
                              onChange={e => { setLinking(person.id); setLinkTarget(e.target.value); setError(null) }}
                              className={`${cellInput} max-w-md`}
                              aria-label="Link to directory person"
                            >
                              <option value="">Link to an existing directory person…</option>
                              {directoryOptions.map(d => (
                                <option key={d.id} value={d.id}>{d.name}{d.title ? ` — ${d.title}` : ''}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="px-5 py-2.5 text-right whitespace-nowrap align-middle">
                          {linking === person.id && linkTarget && (
                            <>
                              <button onClick={() => handleLink(person.id)} className={iconBtn} title="Link to directory" aria-label="Link to directory"><LinkIcon /></button>
                              <button onClick={() => { setLinking(null); setLinkTarget(''); setError(null) }} className={iconBtn} title="Cancel" aria-label="Cancel"><XMark /></button>
                            </>
                          )}
                        </td>
                      </tr>
                    )}

                    {/* Inline error under the person being edited/linked */}
                    {error && (edit?.personId === person.id || linking === person.id) && (
                      <tr>
                        <td colSpan={5} className="px-5 pb-2 text-xs text-red-600">{error}</td>
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
