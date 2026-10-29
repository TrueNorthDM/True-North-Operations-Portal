'use client'

/**
 * Company settings > Job catalogue, the 2026 structure (owner, 28 October
 * 2026): the page "Which job?" is, one table of every project with its Client
 * and Division, when to use it and whether it is billable, and the shared
 * Activities under it, with one search. What it adds is the editing: a pencil
 * on each client, division and project, and + Client, + Division and
 * + Project, each opening a window that saves only on Add.
 *
 * In alphabetical order, as the clock panel lists them: there is nothing to
 * drag here.
 */

import { useState } from 'react'
import { BTN_ICON } from '@/lib/ui/buttons'
import { alpha } from '@/components/clocky/clock/clock-model'
import { ActivitiesSection, Bill, TH } from '@/components/clocky/WhichJob2026View'
import type { ActivityRow, CatalogueRow } from '@/lib/timeclock/job-catalogue'
import { BTN_MODAL_NAVY, BTN_MODAL_WHITE, CloseButton, FieldLabel, Icon, ICON, LabeledSelect, MODAL_TITLE, Modal } from '@/components/clocky/entries/ui'

export type Done = { ok: true; toast: string; id?: number } | { ok: false; error: string }
type Level = 'client' | 'division' | 'project'
export interface Api2026 {
  saveJob: (i: { id: number; name: string; parentId: number | null; active: boolean; billable: boolean; company: string; project: string; use: string }) => Promise<Done>
  addFolder: (i?: { structure?: 1 | 2; parentId?: number | null; name?: string; billable?: boolean; use?: string }) => Promise<Done>
  addJob: (i: { parentId: number | null; name?: string; billable?: boolean; use?: string }) => Promise<Done>
}

export const SMALL_BTN = 'inline-flex items-center gap-1.5 border border-slate-200 rounded-[9px] px-[11px] py-1.5 bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[12px] leading-[normal] cursor-pointer hover:border-tn-teal disabled:opacity-50'
const INPUT = 'h-10 box-border px-3 border border-[var(--panel-border)] rounded-[10px] font-sans text-[13.5px] text-tn-ink bg-white outline-none focus:border-tn-teal focus:shadow-[0_0_0_3px_rgba(30,125,127,.15)] disabled:bg-subtle'
const PLUS = 'M12 5v14M5 12h14'
const OFF = 'text-[10.5px] font-bold rounded-full px-2 py-[3px] bg-[#f1f3f6] text-muted whitespace-nowrap'

export function Switch({ on, label, disabled, onChange }: { on: boolean; label: string; disabled?: boolean; onChange: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} disabled={disabled} onClick={onChange}
      className="flex items-center gap-2.5 border border-[var(--panel-border)] rounded-[11px] px-3 py-2.5 bg-white cursor-pointer text-left leading-[normal] whitespace-nowrap disabled:cursor-default">
      <span className="w-[34px] h-[19px] rounded-full relative flex-none" style={{ background: on ? '#1E7D7F' : '#cbd2da' }}>
        <span className="absolute top-0.5 w-[15px] h-[15px] rounded-full bg-white shadow-[0_1px_3px_rgba(1,35,88,.3)]" style={{ left: on ? 17 : 2 }} />
      </span>
      <span className="font-(family-name:--font-display) font-extrabold text-[12.5px] text-tn-ink">{label}</span>
    </button>
  )
}

/** A small pencil beside a name: opens its window. */
function Pencil({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      className="inline-flex items-center justify-center w-7 h-7 flex-none border-0 rounded-[8px] bg-transparent text-muted cursor-pointer hover:bg-subtle hover:text-tn-ink">
      <Icon d={ICON.edit} size={14} width={2.2} />
    </button>
  )
}

type Line = { client: CatalogueRow; division: CatalogueRow | null; project: CatalogueRow | null }
type Win = { mode: 'new'; level: Level } | { mode: 'edit'; id: number }

export function Catalogue2026({ rows, activities, canEdit, api, run, onFields }: {
  rows: CatalogueRow[]
  activities: ActivityRow[]
  canEdit: boolean
  api: Api2026
  /** Runs a save: busy, the toast, and the page read again. */
  run: (p: Promise<Done>) => Promise<Done>
  /** Fields and options, where the Activities are edited. */
  onFields: () => void
}) {
  const [q, setQ] = useState('')
  const [client, setClient] = useState<number | 'all'>('all')
  const [win, setWin] = useState<Win | null>(null)
  const n = q.trim().toLowerCase()
  const byName = (a: CatalogueRow, b: CatalogueRow) => alpha(a.name, b.name)
  const clients = rows.filter(r => r.level === 'client').sort(byName)
  const under = (id: number, level: Level) => rows.filter(r => r.parentId === id && r.level === level).sort(byName)

  // One line per project; a client or a division with none still gets its line, so it can be found and edited.
  const lines: Line[] = []
  for (const c of clients) {
    if (client !== 'all' && client !== c.id) continue
    const groups: { division: CatalogueRow | null; projects: CatalogueRow[] }[] = [
      ...under(c.id, 'division').map(d => ({ division: d, projects: under(d.id, 'project') })),
      ...(under(c.id, 'project').length ? [{ division: null, projects: under(c.id, 'project') }] : []),
    ]
    if (!groups.length) lines.push({ client: c, division: null, project: null })
    for (const g of groups) {
      if (!g.projects.length) lines.push({ client: c, division: g.division, project: null })
      for (const p of g.projects) lines.push({ client: c, division: g.division, project: p })
    }
  }
  const shown = lines.filter(l => !n || `${l.client.name} ${l.division?.name ?? ''} ${l.project?.name ?? ''} ${l.project?.use ?? ''}`.toLowerCase().includes(n))
  const projects = rows.filter(r => r.level === 'project').length
  const nameCell = (r: CatalogueRow, cls: string, noun: string) => (
    <span className="inline-flex items-center gap-1 max-w-full">
      <span className={`${cls} ${r.active ? '' : 'text-[#a3aebb]'}`}>{r.name}</span>
      {!r.active && <span className={OFF}>Inactive</span>}
      {canEdit && <Pencil label={`Edit ${noun} ${r.name}`} onClick={() => setWin({ mode: 'edit', id: r.id })} />}
    </span>
  )

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap gap-2.5 items-center">
        <input value={q} onChange={e => setQ(e.target.value)} aria-label="Search" placeholder="Search anything: a client, division, project or activity, e.g. translation"
          className="w-[460px] max-w-full box-border h-[40px] px-3 border border-[var(--panel-border)] rounded-[10px] font-sans text-[13.5px] text-tn-ink bg-white outline-none focus:border-tn-teal focus:shadow-[0_0_0_3px_rgba(30,125,127,.15)]" />
        <div className="flex bg-white border border-[var(--panel-border)] rounded-[10px] p-[3px] gap-0.5 flex-wrap" role="group" aria-label="Client">
          {([['all', 'All clients'], ...clients.map(c => [c.id, c.name])] as [number | 'all', string][]).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={client === k} onClick={() => setClient(k)}
              className={`border-0 cursor-pointer rounded-[8px] px-3 py-1.5 font-(family-name:--font-display) font-bold text-[12.5px] leading-[normal] ${client === k ? 'bg-tn-primary text-[#ffffff]' : 'bg-transparent text-foreground'}`}>{l}</button>
          ))}
        </div>
        {canEdit && (
          <div className="flex gap-2 ml-auto">
            {([['client', 'Client'], ['division', 'Division'], ['project', 'Project']] as const).map(([level, label]) => (
              <button key={level} type="button" onClick={() => setWin({ mode: 'new', level })} className={SMALL_BTN}>
                <Icon d={PLUS} size={13} color="#1E9E6A" width={2.6} />{label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border border-[var(--panel-border)] rounded-[14px] overflow-x-auto">
        <div className="px-3.5 py-2.5 border-b border-[var(--panel-border)] font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted leading-[normal]">
          {projects} projects in {clients.length} clients
        </div>
        <table className="w-full border-collapse text-[13px] min-w-[900px]">
          <thead><tr><th className={TH}>Client</th><th className={TH}>Division</th><th className={TH}>Project</th><th className={TH}>When to use</th><th className={TH}>Billable</th>{canEdit && <th className={TH} aria-label="Edit" />}</tr></thead>
          <tbody>
            {!shown.length && <tr><td colSpan={canEdit ? 6 : 5} className="px-3.5 py-8 text-center text-muted">No client, division or project matches. Activities that match are listed below.</td></tr>}
            {shown.map((l, i) => {
              const prev = shown[i - 1]
              const newClient = i === 0 || prev.client.id !== l.client.id
              const newDiv = newClient || prev.division?.id !== l.division?.id
              const p = l.project
              return (
                <tr key={`${l.client.id}|${l.division?.id ?? ''}|${p?.id ?? ''}`} className={newClient && i > 0 ? 'border-t-2 border-tn-primary' : newDiv ? 'border-t border-[#cfe5e5]' : 'border-t border-[var(--row-rule)]'}>
                  <td className="px-3.5 py-2 align-top w-[170px]">{newClient && nameCell(l.client, 'font-(family-name:--font-display) font-extrabold text-tn-ink', 'client')}</td>
                  <td className="px-3.5 py-2 align-top w-[190px]">{newDiv && (l.division ? nameCell(l.division, 'font-(family-name:--font-display) font-bold text-tn-teal', 'division') : <span className="text-muted text-[12px]">(none)</span>)}</td>
                  <td className="px-3.5 py-2 align-top w-[220px]">{p
                    ? <span className="inline-flex items-center gap-1.5 flex-wrap"><span className={`font-(family-name:--font-display) font-bold ${p.active ? 'text-tn-ink' : 'text-[#a3aebb]'}`}>{p.name}</span>{!p.active && <span className={OFF}>Inactive</span>}</span>
                    : <span className="text-muted text-[12px]">No projects yet</span>}</td>
                  <td className="px-3.5 py-2 align-top text-foreground leading-[1.5]">{p?.use}</td>
                  <td className="px-3.5 py-2 align-top w-[110px]">{p && <Bill on={p.billable} />}</td>
                  {canEdit && <td className="px-2 py-1 align-top w-[48px] text-right">{p && <Pencil label={`Edit project ${p.name}`} onClick={() => setWin({ mode: 'edit', id: p.id })} />}</td>}
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="px-3.5 py-2.5 border-t border-[var(--row-rule)] text-[12px] text-muted leading-[1.5]">Vacation, Sick, Holiday and Jury duty are time off, asked in Requests. They never show in the job picker.</div>
      </div>

      <ActivitiesSection activities={activities} query={n}
        extra={<button type="button" onClick={onFields} className="ml-auto border-0 bg-transparent p-0 cursor-pointer font-(family-name:--font-display) font-bold text-[12.5px] text-tn-teal hover:text-tn-ink">Edit the list in Fields and options</button>} />

      {win && <RowWindow key={win.mode === 'edit' ? `e${win.id}` : `n${win.level}`} win={win} rows={rows} startClient={client === 'all' ? null : client}
        canEdit={canEdit} api={api} run={run} onClose={() => setWin(null)} />}
    </div>
  )
}

/** "New client", "Edit division", "New project"...: nothing is saved before Add or Save. */
function RowWindow({ win, rows, startClient, canEdit, api, run, onClose }: {
  win: Win
  rows: CatalogueRow[]
  startClient: number | null
  canEdit: boolean
  api: Api2026
  run: (p: Promise<Done>) => Promise<Done>
  onClose: () => void
}) {
  const row = win.mode === 'edit' ? rows.find(r => r.id === win.id) ?? null : null
  const level: Level = row?.level ?? (win.mode === 'new' ? win.level : 'project')
  const byId = (id: number | null) => rows.find(r => r.id === id) ?? null
  const clientOf = (r: CatalogueRow | null): CatalogueRow | null => !r ? null : r.level === 'client' ? r : clientOf(byId(r.parentId))
  const clients = rows.filter(r => r.level === 'client').sort((a, b) => alpha(a.name, b.name))

  const [name, setName] = useState(row?.name ?? '')
  const [use, setUse] = useState(row?.use ?? '')
  const [active, setActive] = useState(row?.active ?? true)
  const [clientId, setClientId] = useState<number | null>(row ? clientOf(row)?.id ?? null : startClient)
  // A project's place: a division, or its client when the client has no divisions.
  const [parentId, setParentId] = useState<number | null>(row?.parentId ?? null)
  const parentNow = level === 'division' ? byId(clientId) : level === 'project' ? byId(parentId) : null
  const [billable, setBillable] = useState(row?.billable ?? true)
  const [busy, setBusy] = useState(false)

  const divisions = clientId == null ? [] : rows.filter(r => r.parentId === clientId && r.level === 'division').sort((a, b) => alpha(a.name, b.name))
  const places = clientId == null ? [] : divisions.length ? divisions : [byId(clientId)!]
  const noun = level === 'client' ? 'client' : level === 'division' ? 'division' : 'project'
  const title = row ? `Edit ${noun}` : `New ${noun}`
  const ready = !!name.trim() && (level === 'client' || (level === 'division' ? clientId != null : parentId != null))

  const save = async () => {
    if (!ready) return
    setBusy(true)
    const p = row
      ? api.saveJob({ id: row.id, name, parentId: level === 'project' ? parentId : row.parentId, active, billable, company: row.company, project: row.project, use })
      : level === 'project'
        ? api.addJob({ parentId, name, billable, use })
        : api.addFolder({ structure: 2, parentId: level === 'division' ? clientId : null, name, billable, use })
    const r = await run(p)
    setBusy(false)
    if (r.ok) onClose()
  }

  return (
    <Modal label={title} width={520} onClose={onClose}>
      <div className="flex items-start justify-between gap-2.5">
        <div>
          <h2 className={MODAL_TITLE} style={{ letterSpacing: 'normal' }}>{title}</h2>
          <p className="m-0 text-[13px] text-foreground mt-[5px] leading-normal">{row?.parentId != null ? byId(row.parentId)?.path : level === 'client' ? 'A client at the top of the 2026 structure.' : level === 'division' ? 'A division inside a client.' : 'A project inside a division, or right under a client with no divisions.'}</p>
        </div>
        <CloseButton onClick={onClose} />
      </div>

      {level !== 'client' && (row && level === 'division'
        ? null
        : <LabeledSelect label="Client" value={clientId == null ? '' : String(clientId)} placeholder="Pick the client" disabled={!canEdit}
            options={clients.map(c => ({ value: String(c.id), label: c.name }))}
            onChange={v => {
              const id = Number(v)
              setClientId(id)
              // The client's billable is where a new division or project starts.
              if (!row) setBillable(byId(id)?.billable ?? true)
              if (level === 'project') {
                const ds = rows.filter(r => r.parentId === id && r.level === 'division')
                setParentId(ds.length === 1 ? ds[0].id : ds.length ? null : id)
              }
            }} />)}
      {level === 'project' && clientId != null && (divisions.length
        ? <LabeledSelect label="Division" value={parentId == null || parentId === clientId ? '' : String(parentId)} placeholder="Pick the division" disabled={!canEdit}
            options={places.map(d => ({ value: String(d.id), label: d.name }))}
            onChange={v => { const id = Number(v); setParentId(id); if (!row) setBillable(byId(id)?.billable ?? billable) }} />
        : <div className="text-[12.5px] text-muted leading-[1.5]">{byId(clientId)?.name} has no divisions: the project goes right under it.</div>)}

      <label className="flex flex-col gap-[5px]">
        <FieldLabel>Name</FieldLabel>
        <input value={name} disabled={!canEdit} maxLength={120} autoFocus={!row} onChange={e => setName(e.target.value)} className={INPUT}
          placeholder={level === 'client' ? 'e.g. COE Group' : level === 'division' ? 'e.g. Education' : 'e.g. Education General'} />
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] gap-2.5">
        {row && <Switch on={active} label="Active" disabled={!canEdit} onChange={() => setActive(!active)} />}
        <Switch on={billable} label="Billable" disabled={!canEdit} onChange={() => setBillable(!billable)} />
      </div>
      {level !== 'project' && <div className="-mt-1.5 text-[11.5px] text-muted leading-[normal]">New {level === 'client' ? 'divisions and projects' : 'projects'} in it start with this. Each project keeps its own.</div>}
      <label className="flex flex-col gap-[5px]">
        <FieldLabel>When to use</FieldLabel>
        <textarea value={use} disabled={!canEdit} rows={3} maxLength={400} onChange={e => setUse(e.target.value)}
          className="w-full box-border resize-y px-3 py-2.5 border border-[var(--panel-border)] rounded-[10px] font-sans text-[13px] leading-[1.5] text-tn-ink bg-white outline-none focus:border-tn-teal disabled:bg-subtle" />
        <span className="text-[11.5px] text-muted leading-[normal]">One plain line. It shows in the clock panel, in Add time and on &quot;Which job?&quot;.</span>
      </label>
      {level === 'project' && (
        <div className="flex flex-col gap-1.5">
          <span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted leading-[normal]">In the clock panel</span>
          <div className="flex items-start gap-2.5 border border-dashed border-[#cbd2da] rounded-[11px] px-3 py-2.5 bg-[#f8f7f3] leading-[normal]">
            <span className="flex-1 min-w-0 flex flex-col gap-0.5">
              <span className="font-(family-name:--font-display) font-semibold text-[13.5px] text-tn-ink">{[clientOf(parentNow)?.name, parentNow?.level === 'division' ? parentNow.name : null, name.trim() || 'Project'].filter(Boolean).join(' › ')}</span>
              {use.trim() && <span className="text-[12px] text-foreground leading-[1.45]">{use.trim()}</span>}
            </span>
            <Bill on={billable} />
          </div>
        </div>
      )}

      {canEdit && (
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={BTN_MODAL_WHITE}>Cancel</button>
          <button type="button" disabled={!ready || busy} onClick={() => void save()} className={`${BTN_MODAL_NAVY} disabled:opacity-45 disabled:cursor-not-allowed`}>
            <Icon d={row ? ICON.check : PLUS} size={14} color={BTN_ICON.navy} width={3} />{row ? 'Save' : `Add ${noun}`}
          </button>
        </div>
      )}
    </Modal>
  )
}
