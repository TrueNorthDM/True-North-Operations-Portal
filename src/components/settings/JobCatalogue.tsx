'use client'

/**
 * Company settings > Job catalogue (Clocky part 2, Job Catalogue.dc.html):
 *
 *   11A  Jobs                the tree (drag to put jobs in order) and the job
 *                            open for editing, with how it reads in the clock
 *   11B  Fields and options  rename, hide, add; never delete
 *        Clients             the clients and the job folder each one is
 *
 * Super Admins change it; Admins read it.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BTN_ICON } from '@/lib/ui/buttons'
import type { CatalogueData, CatalogueRow } from '@/lib/timeclock/job-catalogue'
import { FieldLabel, Icon, LabeledSelect, Toast, type ToastState } from '@/components/clocky/entries/ui'

type Done = { ok: true; toast: string; id?: number } | { ok: false; error: string }
/** A call that never answered (the connection dropped) reads as a refusal, so busy resets and the toast says so. */
const settle = (p: Promise<Done>): Promise<Done> => p.catch(() => ({ ok: false, error: 'That did not go through. Check your connection and try again.' }))
export interface CatalogueApi {
  saveJob: (i: { id: number; name: string; parentId: number | null; active: boolean; billable: boolean; company: string; project: string; use: string }) => Promise<Done>
  addFolder: () => Promise<Done>
  addJob: (i: { parentId: number | null }) => Promise<Done>
  reorderJobs: (i: { parentId: number | null; ids: number[] }) => Promise<Done>
  setOptionShown: (i: { optionId: number; shown: boolean }) => Promise<Done>
  renameOption: (i: { optionId: number; label: string }) => Promise<Done>
  addOption: (i: { fieldId: number; label: string }) => Promise<Done>
}

// The options table: narrower number columns on a phone, so a code (i7-WEBDVT) stays on one line.
const OPT_COLS = 'grid-cols-[minmax(0,1fr)_92px_54px_68px] md:grid-cols-[minmax(0,1fr)_120px_110px_90px]'
const LABEL = 'font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted leading-[normal]'
const INPUT = 'h-10 box-border px-3 border border-[var(--panel-border)] rounded-[10px] font-sans text-[13.5px] text-tn-ink bg-white outline-none focus:border-tn-teal focus:shadow-[0_0_0_3px_rgba(30,125,127,.15)] disabled:bg-subtle'
const SMALL_BTN = 'inline-flex items-center gap-1.5 border border-slate-200 rounded-[9px] px-[11px] py-1.5 bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[12px] leading-[normal] cursor-pointer hover:border-tn-teal disabled:opacity-50'
const FOLDER = 'M3 6.5A1.5 1.5 0 0 1 4.5 5h4l2 2.5h9A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z'
const NO_FOLDER = 'top'

const billPill = (on: boolean) => ({ text: on ? 'Billable' : 'Not billable', cls: on ? 'bg-[#e6f6ee] text-[#0d7a4f]' : 'bg-[#f1f3f6] text-[#5b6b82]' })

function Switch({ on, label, disabled, onChange }: { on: boolean; label: string; disabled?: boolean; onChange: () => void }) {
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

export function JobCatalogue({ data, canEdit, api, startTab = 'jobs', startId, startField, linked = true }: {
  data: CatalogueData
  canEdit: boolean
  api: CatalogueApi
  startTab?: 'jobs' | 'fields' | 'clients'
  startId?: number
  startField?: string
  linked?: boolean
}) {
  const router = useRouter()
  const [tab, setTab] = useState(startTab)
  const [toast, setToast] = useState<ToastState | null>(null)
  const say = (r: Done) => { setToast(r.ok ? { text: r.toast } : { text: r.error, error: true }); setTimeout(() => setToast(null), 4200); if (r.ok && linked) router.refresh() }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="flex bg-white border border-[var(--panel-border)] rounded-[10px] p-[3px] gap-0.5" role="group" aria-label="Part of the catalogue">
          {([['jobs', 'Jobs'], ['fields', 'Fields and options'], ['clients', 'Clients']] as const).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)}
              className={`border-0 cursor-pointer rounded-[8px] px-3.5 py-[7px] font-(family-name:--font-display) font-bold text-[12.5px] leading-[normal] ${tab === k ? 'bg-tn-primary text-[#ffffff]' : 'bg-transparent text-foreground'}`}>{l}</button>
          ))}
        </div>
        {!canEdit && <span className="text-[12px] text-[#5b6b82] bg-[#f1f3f6] rounded-full px-[11px] py-[5px] leading-[normal]">Read only at the Admin level. Super Admins edit the catalogue.</span>}
      </div>
      {tab === 'jobs' && <Jobs data={data} canEdit={canEdit} api={api} startId={startId} say={say} />}
      {tab === 'fields' && <Fields data={data} canEdit={canEdit} api={api} startField={startField} say={say} />}
      {tab === 'clients' && <Clients data={data} />}
      <Toast toast={toast} />
    </div>
  )
}

// ── 11A Jobs ────────────────────────────────────────────────────────────────

type Draft = { name: string; parent: string; active: boolean; billable: boolean; company: string; project: string; use: string }
const draftOf = (r: CatalogueRow): Draft => ({ name: r.name, parent: r.parentId == null ? NO_FOLDER : String(r.parentId), active: r.active, billable: r.billable, company: r.company, project: r.project, use: r.use })

function Jobs({ data, canEdit, api, startId, say }: { data: CatalogueData; canEdit: boolean; api: CatalogueApi; startId?: number; say: (r: Done) => void }) {
  const rows = data.rows
  const [sel, setSel] = useState<number | null>(startId ?? rows.find(r => !r.folder)?.id ?? rows[0]?.id ?? null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [drag, setDrag] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const row = rows.find(r => r.id === sel) ?? null
  const ed = row ? { ...draftOf(row), ...draft } : null
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft(d => ({ ...(d ?? {}), [k]: v }) as Draft)
  const folders = rows.filter(r => r.depth === 0 && r.folder)
  const jobs = rows.filter(r => !r.folder).length
  const fieldOpts = (key: string) => [{ value: '', label: 'None' }, ...(data.fields.find(f => f.key === key)?.options.filter(o => o.shown).map(o => ({ value: o.label, label: o.label })) ?? [])]

  const run = async (p: Promise<Done>) => { setBusy(true); const r = await settle(p); setBusy(false); say(r); return r }
  const move = (from: number | null, to: number) => {
    setDrag(null); setOver(null)
    const a = rows.find(r => r.id === from), b = rows.find(r => r.id === to)
    if (!a || !b || a.id === b.id || a.depth !== b.depth || a.parentId !== b.parentId) return
    const group = rows.filter(r => r.depth === a.depth && r.parentId === a.parentId).map(r => r.id)
    group.splice(group.indexOf(a.id), 1)
    group.splice(group.indexOf(b.id), 0, a.id)
    void run(api.reorderJobs({ parentId: a.parentId, ids: group }))
  }
  const addHere = () => {
    const parent = row ? (row.folder && row.depth === 0 ? row.id : row.parentId) : null
    void run(api.addJob({ parentId: parent })).then(r => { if (r.ok && r.id) { setSel(r.id); setDraft(null) } })
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px] gap-4 items-start">
      <div className="bg-white border border-[var(--panel-border)] rounded-[14px] overflow-hidden">
        <div className="flex items-center justify-between gap-2.5 px-3.5 py-3 border-b border-[var(--panel-border)] bg-subtle">
          <span className={LABEL}>{`${jobs} jobs in ${folders.length} folders`}</span>
          {canEdit && (
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={() => void run(api.addFolder()).then(r => { if (r.ok && r.id) { setSel(r.id); setDraft(null) } })} className={SMALL_BTN}><Icon d="M12 5v14M5 12h14" size={13} color="#1E9E6A" width={2.6} />Folder</button>
              <button type="button" disabled={busy} onClick={addHere} className={SMALL_BTN}><Icon d="M12 5v14M5 12h14" size={13} color="#1E9E6A" width={2.6} />Job</button>
            </div>
          )}
        </div>
        {rows.map(r => {
          const b = billPill(r.billable)
          return (
            <div key={r.id} draggable={canEdit} onDragStart={e => { try { e.dataTransfer.setData('text/plain', String(r.id)) } catch { /* the browser keeps it */ } setDrag(r.id) }}
              onDragOver={e => { e.preventDefault(); if (over !== r.id) setOver(r.id) }} onDrop={e => { e.preventDefault(); move(drag, r.id) }} onDragEnd={() => { setDrag(null); setOver(null) }}
              onClick={() => { setSel(r.id); setDraft(null) }} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(r.id); setDraft(null) } }}
              className={`flex items-center gap-2.5 border-b border-[var(--row-rule)] cursor-pointer leading-[normal] hover:bg-[#f8f7f3] ${r.depth === 1 ? 'py-[9px] pr-3.5 pl-[46px]' : 'px-3.5 py-[11px]'}`}
              style={{ background: r.id === sel ? '#eaf4f4' : r.folder ? '#faf9f5' : undefined, borderTop: `2px solid ${over === r.id && drag && drag !== r.id ? '#1E7D7F' : 'transparent'}` }}>
              <span title="Drag to reorder" className="text-[#cbd2da] flex flex-none cursor-grab"><Icon d="M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01" size={14} width={3} /></span>
              {r.folder && <Icon d={FOLDER} size={16} color="#8593a4" width={1.9} className="flex-none" />}
              <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className={`font-(family-name:--font-display) text-[13.5px] ${r.folder ? 'font-extrabold' : r.depth === 1 ? 'font-semibold' : 'font-bold'} ${r.active ? 'text-tn-ink' : 'text-[#a3aebb]'}`}>{r.name}</span>
                <span className="text-[12px] text-muted overflow-hidden text-ellipsis whitespace-nowrap">{r.use}</span>
              </span>
              {!r.folder && <span className={`flex-none text-[10.5px] font-bold rounded-full px-2 py-[3px] ${b.cls}`}>{b.text}</span>}
              {!r.active && <span className="flex-none text-[10.5px] font-bold rounded-full px-2 py-[3px] bg-[#f1f3f6] text-muted">Inactive</span>}
            </div>
          )
        })}
        <div className="px-3.5 py-2.5 text-[12px] text-muted leading-[1.5]">Vacation, Sick, Holiday and Jury duty are time off, asked in Requests. They never show in the job picker.</div>
      </div>

      {row && ed && (
        <div className="bg-white border border-[var(--panel-border)] rounded-[14px] p-[18px] flex flex-col gap-[13px] xl:sticky xl:top-0">
          <div className="flex items-center justify-between gap-2.5 leading-[normal]">
            <span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">{row.folder ? 'Edit folder' : 'Edit job'}</span>
            <span className="text-[11.5px] text-muted">{!row.folder && row.parentId != null ? rows.find(r => r.id === row.parentId)?.name : 'Top level'}</span>
          </div>
          <label className="flex flex-col gap-[5px]">
            <FieldLabel>Name</FieldLabel>
            <input value={ed.name} disabled={!canEdit} maxLength={120} onChange={e => set('name', e.target.value)} className={INPUT} />
          </label>
          {!row.folder && (
            <LabeledSelect label="Parent folder" value={ed.parent} disabled={!canEdit} onChange={v => set('parent', v)}
              options={[...folders.map(f => ({ value: String(f.id), label: f.name })), { value: NO_FOLDER, label: 'No folder (top level)' }]} />
          )}
          {/* One column on a phone: "Billable by default" does not fit beside Active at 390px. */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] gap-2.5">
            <Switch on={ed.active} label="Active" disabled={!canEdit} onChange={() => set('active', !ed.active)} />
            <Switch on={ed.billable} label="Billable by default" disabled={!canEdit} onChange={() => set('billable', !ed.billable)} />
            {row.i7 && !row.folder && <Switch on label="Asks for an i7 Code" disabled onChange={() => {}} />}
          </div>
          {!row.folder && (
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2.5">
              <LabeledSelect label="Default Company" value={ed.company} disabled={!canEdit} onChange={v => set('company', v)} options={fieldOpts('company')} />
              <LabeledSelect label="Default Project" value={ed.project} disabled={!canEdit} search onChange={v => set('project', v)} options={fieldOpts('project')} />
            </div>
          )}
          <label className="flex flex-col gap-[5px]">
            <FieldLabel>When to use</FieldLabel>
            <textarea value={ed.use} disabled={!canEdit} rows={3} maxLength={400} onChange={e => set('use', e.target.value)}
              className="w-full box-border resize-y px-3 py-2.5 border border-[var(--panel-border)] rounded-[10px] font-sans text-[13px] leading-[1.5] text-tn-ink bg-white outline-none focus:border-tn-teal disabled:bg-subtle" />
            <span className="text-[11.5px] text-muted leading-[normal]">One plain line. It shows under the job in the clock panel, in Add time and on &quot;Which job?&quot;.</span>
          </label>
          <div className="flex flex-col gap-1.5">
            <span className={LABEL}>In the clock panel</span>
            <div className="flex items-start gap-2.5 border border-dashed border-[#cbd2da] rounded-[11px] px-3 py-2.5 bg-[#f8f7f3] leading-[normal]">
              <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="font-(family-name:--font-display) font-semibold text-[13.5px] text-tn-ink">{ed.name}</span>
                {ed.use && <span className="text-[12px] text-foreground leading-[1.45]">{ed.use}</span>}
              </span>
              {!row.folder && <span className={`flex-none text-[10.5px] font-bold rounded-full px-2 py-[3px] ${billPill(ed.billable).cls}`}>{billPill(ed.billable).text}</span>}
            </div>
          </div>
          {canEdit && (
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDraft(null)} className="border border-slate-200 rounded-[10px] px-4 py-2.5 bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[13px] leading-[normal] cursor-pointer hover:border-tn-teal">Cancel</button>
              <button type="button" disabled={busy} onClick={() => void run(api.saveJob({ id: row.id, name: ed.name, parentId: ed.parent === NO_FOLDER ? null : Number(ed.parent), active: ed.active, billable: ed.billable, company: ed.company, project: ed.project, use: ed.use })).then(r => { if (r.ok) setDraft(null) })}
                className="inline-flex items-center gap-2 border-0 rounded-[10px] px-[18px] py-[11px] bg-tn-primary text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[13px] leading-[normal] cursor-pointer hover:bg-[#0a2f6b] disabled:opacity-50 disabled:cursor-not-allowed">
                <Icon d="M5 12l5 5 9-10" size={14} color={BTN_ICON.navy} width={3} />Save
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── 11B Fields and options ──────────────────────────────────────────────────

function Fields({ data, canEdit, api, startField, say }: { data: CatalogueData; canEdit: boolean; api: CatalogueApi; startField?: string; say: (r: Done) => void }) {
  const [key, setKey] = useState(startField ?? data.fields[0]?.key ?? '')
  const [renaming, setRenaming] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [fresh, setFresh] = useState('')
  const f = data.fields.find(x => x.key === key)
  if (!f) return null
  const mono = f.key === 'code'
  const commit = async (id: number, old: string) => {
    setRenaming(null)
    const v = draft.trim()
    if (v && v !== old) say(await settle(api.renameOption({ optionId: id, label: v })))
  }
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-4 items-start">
      <div className="flex flex-col gap-2">
        {data.fields.map(x => (
          <button key={x.key} type="button" aria-pressed={x.key === key} onClick={() => { setKey(x.key); setRenaming(null) }}
            className={`text-left flex flex-col gap-[3px] border rounded-[12px] px-3.5 py-3 cursor-pointer leading-[normal] min-w-0 ${x.key === key ? 'border-tn-teal bg-tn-teal-soft' : 'border-[var(--panel-border)] bg-white'}`}>
            <span className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">{x.label}</span>
            <span className="text-[12px] text-muted whitespace-nowrap overflow-hidden text-ellipsis">{`${x.options.length} options · ${x.hint}`}</span>
          </button>
        ))}
      </div>
      <div className="bg-white border border-[var(--panel-border)] rounded-[14px] overflow-hidden">
        <div className="flex items-center justify-between gap-2.5 px-4 py-3.5 border-b border-[var(--panel-border)] leading-[normal]">
          <div className="flex flex-col gap-0.5">
            <span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">{f.label}</span>
            <span className="text-[12px] text-muted">{f.hint}</span>
          </div>
          <span className="text-[12px] text-muted whitespace-nowrap">{`${f.options.filter(o => o.shown).length} shown · ${f.options.filter(o => !o.shown).length} hidden`}</span>
        </div>
        <div className={`grid ${OPT_COLS} bg-subtle border-b border-[var(--panel-border)] ${LABEL}`}>
          <div className="px-3 md:px-4 py-[9px]">Option</div><div className="px-2 md:px-3 py-[9px] text-right">Used in</div><div className="px-2 md:px-3 py-[9px]">Shown</div><div />
        </div>
        <div className="max-h-[520px] overflow-auto">
          {f.options.map(o => (
            <div key={o.id} className={`grid ${OPT_COLS} items-center border-b border-[var(--row-rule)] text-[13px] leading-[normal]`} style={{ opacity: o.shown ? 1 : 0.5 }}>
              <div className="px-3 md:px-4 py-[7px] min-w-0">
                {renaming === o.id
                  ? <input autoFocus value={draft} onChange={e => setDraft(e.target.value)} onBlur={() => void commit(o.id, o.label)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setRenaming(null) }} aria-label={`Rename ${o.label}`}
                    className="w-full h-8 box-border px-2.5 border border-tn-teal rounded-[8px] font-sans text-[13px] text-tn-ink outline-none shadow-[0_0_0_3px_rgba(30,125,127,.15)]" />
                  : <span className={`text-tn-ink font-semibold ${mono ? 'font-mono' : ''}`}>{o.label}</span>}
              </div>
              <div className="px-2 md:px-3 py-[7px] text-right text-foreground tabular-nums lining-nums whitespace-nowrap">{`${o.used.toLocaleString('en-US')} entries`}</div>
              <div className="px-2 md:px-3 py-[7px]">
                <button type="button" role="switch" aria-checked={o.shown} aria-label={`Show ${o.label}`} disabled={!canEdit} onClick={async () => say(await settle(api.setOptionShown({ optionId: o.id, shown: !o.shown })))}
                  className="w-[34px] h-[19px] border-0 rounded-full relative cursor-pointer p-0 disabled:cursor-default" style={{ background: o.shown ? '#1E7D7F' : '#cbd2da' }}>
                  <span className="absolute top-0.5 w-[15px] h-[15px] rounded-full bg-white shadow-[0_1px_3px_rgba(1,35,88,.3)]" style={{ left: o.shown ? 17 : 2 }} />
                </button>
              </div>
              <div className="px-2 md:px-3 py-[7px] text-right">
                {canEdit && <button type="button" onClick={() => { setRenaming(o.id); setDraft(o.label) }} className="border-0 bg-transparent cursor-pointer text-[12.5px] font-bold text-tn-teal p-0">Rename</button>}
              </div>
            </div>
          ))}
        </div>
        {canEdit && (
          <form className="flex gap-2 px-4 py-3 border-t border-[var(--panel-border)] bg-[#faf9f5]" onSubmit={async e => { e.preventDefault(); const v = fresh.trim(); if (!v) return; const r = await settle(api.addOption({ fieldId: Number(f.id), label: v })); if (r.ok) setFresh(''); say(r) }}>
            <input value={fresh} onChange={e => setFresh(e.target.value)} placeholder="New option" maxLength={120} aria-label="New option"
              className="flex-1 h-[38px] box-border px-3 border border-[var(--panel-border)] rounded-[10px] font-sans text-[13px] text-tn-ink bg-white outline-none focus:border-tn-teal" />
            <button type="submit" className="inline-flex items-center gap-1.5 border border-slate-200 rounded-[10px] px-3.5 bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[12.5px] cursor-pointer hover:border-tn-teal"><Icon d="M12 5v14M5 12h14" size={13} color="#1E9E6A" width={2.6} />Add</button>
          </form>
        )}
        <div className="px-4 py-2.5 text-[12px] text-muted leading-[1.5]">A hidden option stays on old entries and leaves the pickers. Options are never deleted, so history keeps its words.</div>
      </div>
    </div>
  )
}

// ── Clients ─────────────────────────────────────────────────────────────────

function Clients({ data }: { data: CatalogueData }) {
  return (
    <div className="bg-white border border-[var(--panel-border)] rounded-[14px] overflow-hidden">
      <div className={`grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px] bg-subtle border-b border-[var(--panel-border)] ${LABEL}`}>
        <div className="px-4 py-2.5">Client</div><div className="px-4 py-2.5">Linked job folder</div><div className="px-4 py-2.5">Active</div>
      </div>
      {data.clients.map(c => (
        <div key={c.name} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px] items-center border-b border-[var(--row-rule)] text-[13px] leading-[normal]">
          <div className="px-4 py-[11px] text-tn-ink font-bold font-(family-name:--font-display)">{c.name}</div>
          <div className="px-4 py-[11px] text-foreground">{c.folder || '-'}</div>
          <div className="px-4 py-[11px]"><span className={`text-[10.5px] font-bold rounded-full px-[9px] py-[3px] ${c.active ? 'bg-[#e6f6ee] text-[#0d7a4f]' : 'bg-[#f1f3f6] text-muted'}`}>{c.active ? 'Active' : 'Inactive'}</span></div>
        </div>
      ))}
    </div>
  )
}
