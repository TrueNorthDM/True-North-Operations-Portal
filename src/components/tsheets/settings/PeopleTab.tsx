'use client'

import { Fragment, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ConfirmModal } from './ConfirmModal'
import { saveTrAssignment, deactivateTrAssignment, savePersonCostRate } from '@/lib/tsheets/settings-actions'
import { linkTsheetsPersonToDirectory } from '@/lib/tsheets/sync-actions'
import { TEAM_COLOR, teamKeyFromName, initialsOf, formatDate } from '@/components/admin/people-types'

// Team-coloured initials avatar. Colour keys off the person's primary team.
function Avatar({ name, team, size = 32 }: { name: string; team: string | null; size?: number }) {
  const color = TEAM_COLOR[teamKeyFromName(team)]
  return (
    <span
      className="inline-flex items-center justify-center rounded-full text-white font-(family-name:--font-display) font-extrabold shrink-0"
      style={{ width: size, height: size, background: color, fontSize: Math.round(size * 0.36) }}
    >
      {initialsOf(name)}
    </span>
  )
}

// Team pill, tinted from the same team-colour system as the avatar.
function TeamBadge({ team }: { team: string | null }) {
  if (!team) return <span className="text-slate-300">—</span>
  const color = TEAM_COLOR[teamKeyFromName(team)]
  return (
    <span
      className="inline-flex items-center text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide rounded-[6px] px-2 py-0.5 whitespace-nowrap"
      style={{ color, background: `${color}1a` }}
    >
      {team}
    </span>
  )
}

export interface PersonWithAssignments {
  id: string
  name: string
  title: string | null
  teams: string[]
  /** Primary team (first membership) — drives the team badge + avatar colour. */
  teamName: string | null
  /** Report-to (manager) name + their team colour, resolved server-side. */
  managerName: string | null
  managerTeam: string | null
  /** Joined-on (hire_date, ISO). */
  hireDate: string | null
  /** Internal cost per hour (people.internal_rate) — one per person. */
  costRate: number | null
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
  mode: 'edit' | 'remove' | 'new' | 'cost'
  currentRate: number | null
}

type Pending =
  | { kind: 'save'; tsheetsUserId: number; clientId: number; hourlyRate: number; effectiveFrom: string; title: string; lines: string[] }
  | { kind: 'deactivate'; tsheetsUserId: number; clientId: number; effectiveFrom: string; title: string; lines: string[] }
  | { kind: 'cost'; personId: string; costRate: number; title: string; lines: string[] }

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
  function startCost(p: PersonWithAssignments) {
    setError(null)
    setEdit({ key: `${p.id}:cost`, personId: p.id, tsheetsUserId: p.tsheetsUserId, personName: p.name, clientId: null, clientName: null, mode: 'cost', currentRate: p.costRate })
    setRate(p.costRate != null ? String(p.costRate) : '')
  }

  function review(availableName?: string) {
    if (!edit) return
    if (edit.mode === 'cost') {
      if (!rate || Number(rate) <= 0) { setError('Enter a valid cost rate.'); return }
      setError(null)
      setPending({
        kind: 'cost', personId: edit.personId, costRate: Number(rate),
        title: 'Confirm internal cost change',
        lines: [
          `Person: ${edit.personName}`,
          edit.currentRate != null ? `Cost: $${edit.currentRate}/hr → $${rate}/hr` : `Cost: $${rate}/hr (first set)`,
          'This is the internal cost per hour — shared with the Directory.',
        ],
      })
      return
    }
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
      : pending.kind === 'cost'
      ? await savePersonCostRate({ personId: pending.personId, costRate: pending.costRate, justification })
      : await saveTrAssignment({ tsheetsUserId: pending.tsheetsUserId, clientId: pending.clientId, hourlyRate: pending.hourlyRate, effectiveFrom: pending.effectiveFrom, justification })
    setLoading(false)
    if (result.ok) { setPending(null); cancel(); router.refresh() }
    else { setError(result.error ?? 'Save failed.'); setPending(null) }
  }

  const cellInput = 'w-full rounded-md border border-slate-200 bg-subtle px-2 py-1.5 text-sm focus:outline-none focus:border-tn-teal focus:ring-2 focus:ring-tn-teal/25'
  const inputSm = 'w-20 rounded-md border border-slate-200 bg-subtle px-2 py-1.5 text-sm focus:outline-none focus:border-tn-teal focus:ring-2 focus:ring-tn-teal/25'
  const dateInput = 'rounded-md border border-slate-200 bg-subtle px-2 py-1.5 text-sm focus:outline-none focus:border-tn-teal focus:ring-2 focus:ring-tn-teal/25'
  const iconBtn = 'inline-flex items-center justify-center p-1.5 rounded-md text-muted hover:text-tn-ink hover:bg-subtle transition-colors'
  const th = 'text-left text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted px-4 py-3 whitespace-nowrap'
  const money = (n: number) => (
    <span className="tabular-nums font-semibold text-tn-ink">${n}<span className="text-muted font-normal text-xs">/hr</span></span>
  )

  if (people.length === 0) {
    return (
      <div className="rounded-[14px] border border-slate-200 bg-subtle p-8 text-center space-y-2">
        <p className="text-sm font-(family-name:--font-display) font-bold text-tn-ink">No people linked yet</p>
        <p className="text-xs text-muted">Click &ldquo;Sync people&rdquo; above to import TSheets users.</p>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-[14px] border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1180px]">
            <thead>
              <tr className="bg-subtle border-b border-slate-200">
                <th className={`${th} w-64`}>Person</th>
                <th className={th}>Team</th>
                <th className={th}>Report to</th>
                <th className={th}>Joined on</th>
                <th className={th}>Project</th>
                <th className={th}>Rate / client</th>
                <th className={th}>Rate / cost</th>
                <th className={th}>Effective from</th>
                <th className={`${th} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {people.map(person => {
                const assignedIds = new Set(person.assignments.map(a => a.clientId))
                const availableClients = allClients.filter(c => !assignedIds.has(c.id))
                const rows: Assignment[] = person.assignments.length ? person.assignments : []
                const addingNew = edit?.mode === 'new' && edit.personId === person.id
                const editingCost = edit?.key === `${person.id}:cost`
                const showEmptyRow = rows.length === 0 && !addingNew

                // Person-level columns (avatar, team, report-to, joined-on) —
                // rendered once, on the person's first row.
                const personLead = (show: boolean) => (
                  <>
                    <td className="px-4 py-3 align-middle">
                      {show && (
                        <div className="flex items-center gap-2.5">
                          <Avatar name={person.name} team={person.teamName} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-(family-name:--font-display) font-bold text-tn-ink">{person.name}</span>
                              {person.tsheetsOnly && (
                                <span className="text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-[var(--bdg-gold-fg)] bg-[var(--bdg-gold-bg)] px-1.5 py-0.5 rounded-[5px]">TSheets only</span>
                              )}
                            </div>
                            {person.title && <div className="text-xs text-muted mt-0.5">{person.title}</div>}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle">{show ? <TeamBadge team={person.teamName} /> : null}</td>
                    <td className="px-4 py-3 align-middle">
                      {show ? (person.managerName ? (
                        <div className="flex items-center gap-2">
                          <Avatar name={person.managerName} team={person.managerTeam} size={26} />
                          <span className="text-[13px] text-foreground whitespace-nowrap">{person.managerName}</span>
                        </div>
                      ) : <span className="text-slate-300">—</span>) : null}
                    </td>
                    <td className="px-4 py-3 align-middle whitespace-nowrap text-[13px] text-muted tabular-nums">
                      {show ? (formatDate(person.hireDate) ?? <span className="text-slate-300">—</span>) : null}
                    </td>
                  </>
                )

                // Rate / cost (internal, per person) — editor or value, once.
                const costCell = (show: boolean) => (
                  <td className="px-4 py-3 align-middle whitespace-nowrap">
                    {editingCost ? (
                      <div className="flex items-center gap-1">
                        <span className="text-muted text-sm">$</span>
                        <input type="number" min="0" step="0.01" value={rate} onChange={e => setRate(e.target.value)} className={inputSm} aria-label="Cost rate" />
                        <button onClick={() => review()} className={iconBtn} title="Save" aria-label="Save"><Save /></button>
                        <button onClick={cancel} className={iconBtn} title="Cancel" aria-label="Cancel"><XMark /></button>
                      </div>
                    ) : show ? (
                      person.costRate != null ? (
                        <span className="inline-flex items-center gap-1">
                          {money(person.costRate)}
                          <button onClick={() => startCost(person)} className={iconBtn} title="Edit cost" aria-label="Edit cost"><Pencil /></button>
                        </span>
                      ) : (
                        <button onClick={() => startCost(person)} className="text-xs font-(family-name:--font-display) font-bold text-tn-teal hover:underline">Set cost</button>
                      )
                    ) : null}
                  </td>
                )

                return (
                  <Fragment key={person.id}>
                    {rows.map((a, idx) => {
                      const isEditing = edit?.key === `${person.id}:${a.clientId}`
                      const editing = isEditing && edit?.mode === 'edit'
                      const removing = isEditing && edit?.mode === 'remove'
                      const show = idx === 0
                      const isLast = idx === rows.length - 1
                      return (
                        <tr key={a.id} className={`border-b border-slate-100 ${editing ? 'bg-subtle' : removing ? 'bg-[var(--bdg-red-bg)]/40' : 'hover:bg-subtle/60'}`}>
                          {personLead(show)}
                          <td className="px-4 py-3 align-middle text-tn-ink whitespace-nowrap">
                            {a.clientName}{removing && <span className="text-[var(--bdg-red-fg)] text-xs ml-1">(removing)</span>}
                          </td>
                          <td className="px-4 py-3 align-middle whitespace-nowrap">
                            {editing ? (
                              <div className="flex items-center gap-1"><span className="text-muted text-sm">$</span><input type="number" min="0" step="0.01" value={rate} onChange={e => setRate(e.target.value)} className={inputSm} aria-label="Client rate" /></div>
                            ) : removing ? <span className="text-slate-300">—</span> : money(a.hourlyRate)}
                          </td>
                          {costCell(show)}
                          <td className="px-4 py-3 align-middle whitespace-nowrap">
                            {(editing || removing) ? (
                              <input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} className={dateInput} aria-label="Effective from" />
                            ) : <span className="text-muted tabular-nums text-[13px]">{a.effectiveFrom}</span>}
                          </td>
                          <td className="px-4 py-3 align-middle text-right whitespace-nowrap">
                            {editing ? (
                              <>
                                <button onClick={() => review()} className={iconBtn} title="Save" aria-label="Save"><Save /></button>
                                <button onClick={cancel} className={iconBtn} title="Cancel" aria-label="Cancel"><XMark /></button>
                              </>
                            ) : removing ? (
                              <>
                                <button onClick={() => review()} className="inline-flex items-center justify-center p-1.5 rounded-md text-[var(--bdg-red-fg)] hover:bg-[var(--bdg-red-bg)]" title="Confirm removal" aria-label="Confirm removal"><Trash /></button>
                                <button onClick={cancel} className={iconBtn} title="Cancel" aria-label="Cancel"><XMark /></button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => startEdit(person, a)} className={iconBtn} title="Edit rate" aria-label="Edit rate"><Pencil /></button>
                                <button onClick={() => startRemove(person, a)} className={iconBtn} title="Remove from project" aria-label="Remove from project"><Trash /></button>
                                {isLast && availableClients.length > 0 && (
                                  <button onClick={() => startNew(person)} className={iconBtn} title="Assign to another project" aria-label="Assign to another project"><Plus /></button>
                                )}
                              </>
                            )}
                          </td>
                        </tr>
                      )
                    })}

                    {/* Empty person → single row with an assign action */}
                    {showEmptyRow && (
                      <tr className="border-b border-slate-100 hover:bg-subtle/60">
                        {personLead(true)}
                        <td className="px-4 py-3 align-middle text-muted text-xs">No rate assigned</td>
                        <td className="px-4 py-3 align-middle text-slate-300">—</td>
                        {costCell(true)}
                        <td className="px-4 py-3 align-middle text-slate-300">—</td>
                        <td className="px-4 py-3 align-middle text-right whitespace-nowrap">
                          {availableClients.length > 0 ? (
                            <button onClick={() => startNew(person)} className={iconBtn} title="Assign a rate" aria-label="Assign a rate"><Plus /></button>
                          ) : <span className="text-xs text-slate-300">no projects</span>}
                        </td>
                      </tr>
                    )}

                    {/* New-rate editor row */}
                    {addingNew && (
                      <tr className="border-b border-slate-100 bg-subtle">
                        {personLead(rows.length === 0)}
                        <td className="px-4 py-3 align-middle">
                          <select value={clientId} onChange={e => setClientId(e.target.value)} className={cellInput} aria-label="Project">
                            <option value="">Select a project…</option>
                            {availableClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3 align-middle whitespace-nowrap">
                          <div className="flex items-center gap-1"><span className="text-muted text-sm">$</span><input type="number" min="0" step="0.01" value={rate} onChange={e => setRate(e.target.value)} placeholder="45" className={inputSm} aria-label="Client rate" /></div>
                        </td>
                        {costCell(rows.length === 0)}
                        <td className="px-4 py-3 align-middle">
                          <input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} className={dateInput} aria-label="Effective from" />
                        </td>
                        <td className="px-4 py-3 align-middle text-right whitespace-nowrap">
                          <button onClick={() => review(availableClients.find(c => c.id === Number(clientId))?.name)} className={iconBtn} title="Save" aria-label="Save"><Save /></button>
                          <button onClick={cancel} className={iconBtn} title="Cancel" aria-label="Cancel"><XMark /></button>
                        </td>
                      </tr>
                    )}

                    {/* Link a TSheets-only import to a real directory person */}
                    {person.tsheetsOnly && (
                      <tr className="border-b border-slate-100 bg-[var(--bdg-gold-bg)]/40">
                        <td className="px-4 py-3 text-xs text-[var(--bdg-gold-fg)] align-middle whitespace-nowrap" colSpan={4}>Not in the org directory</td>
                        <td className="px-4 py-3 align-middle" colSpan={4}>
                          {directoryOptions.length === 0 ? (
                            <span className="text-xs text-muted">No unlinked directory people — add them in Admin → People first.</span>
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
                        <td className="px-4 py-3 text-right whitespace-nowrap align-middle">
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
                        <td colSpan={9} className="px-4 pb-2 text-xs text-[var(--bdg-red-fg)]">{error}</td>
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
