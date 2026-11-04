'use client'

/**
 * Company settings > Human Resources (annual review handoff, A1 and A2): the
 * yearly review's roles (picked here, never named in code), who takes part
 * beyond the employees, the year's dates, the Drive folder for the approved
 * PDFs, and last year's reviews imported once from Drive (first year only).
 * Super Admins change them, and so does the person picked as HR.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BTN, BTN_ICON } from '@/lib/ui/buttons'
import { CARD, FIELD_LABEL, TH } from '@/lib/ui/type'
import { INPUT } from '@/lib/ui/fields'
import { Pill } from '@/components/ui/Pill'
import { Select } from '@/components/ui/Select'
import { DateField, MonthField } from '@/components/ui/DateField'
import { GoogleIcon } from '@/components/ui/GoogleIcon'
import { MODAL_TITLE, Modal, Toast, type ToastState } from '@/components/clocky/entries/ui'
import { openPicker } from '@/lib/drive/picker-client'
import { fmtDay, initials } from '@/lib/review/format'
import { APR_COLORS } from '@/lib/review/colors'

type Res = { ok: true; toast?: string } | { ok: false; error: string }
export interface HrSettingsData {
  year: number
  roles: { vpId: string | null; cisoId: string | null; hrId: string | null }
  people: { value: string; label: string }[]
  employees: number
  extra: { id: string; name: string }[]
  dates: Record<DateKey, string | null>
  started: string | null
  drive: { name: string | null; ready: boolean; why: string | null; account: string | null }
  imports: { id: number; file: string; personId: string | null; person: string | null; match: 'matched' | 'check' | 'none' | 'skipped'; imported: boolean; leftOn: string | null
    /** What the file said (migration 150): whether it could be read, how many Job Description answers. */
    found: { read: boolean; job: number } | null
    goals: { id: number; what: string; byMonth: string | null }[] }[]
}
type DateKey = 'leaders_open_on' | 'leaders_due' | 'teams_open_by' | 'self_due' | 'review_due' | 'meeting_due' | 'approval_due' | 'checkins_by'
export interface HrSettingsApi {
  saveHrSettings(i: { vpId?: string | null; cisoId?: string | null; hrId?: string | null; extra?: string[] }): Promise<Res>
  saveReviewDates(i: { year: number; dates: Partial<Record<DateKey, string | null>> }): Promise<Res>
  saveHrDriveFolder(i: { id: string; name: string }): Promise<Res>
  hrPicker(): Promise<{ ok: true; token: string; key: string; appId: string } | { ok: false; error: string }>
  pickImportFiles(i: { year: number; files: { id: string; name: string; mimeType?: string; url?: string }[] }): Promise<Res>
  setImportPerson(i: { id: number; personId: string | null; skip?: boolean }): Promise<Res>
  importFiles(i: { year: number }): Promise<Res>
  saveImportGoal(i: { importId: number; goalId?: number | null; what?: string; byMonth?: string | null }): Promise<Res>
  removeImportGoal(i: { goalId: number }): Promise<Res>
}

// The person's initials inside a picker, as in the design's role and import rows.
const badged = (people: { value: string; label: string }[]) => people.map(p => ({ ...p, icon: <span className="w-[22px] h-[22px] rounded-full bg-[#eef1f5] border border-[#dfe4ea] flex items-center justify-center font-(family-name:--font-display) font-extrabold text-[9px] text-[#435066]">{initials(p.label)}</span> }))
const MONTH = (d: string) => new Date(`${d}T12:00:00`).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })

const DATES: { key: DateKey; label: string }[] = [
  { key: 'leaders_open_on', label: 'Team Leaders open on' }, { key: 'leaders_due', label: "Team Leaders' self-review by" },
  { key: 'teams_open_by', label: 'Teams open by' }, { key: 'self_due', label: 'Self-review by' }, { key: 'review_due', label: 'Review by' },
  { key: 'meeting_due', label: 'Meeting by' }, { key: 'approval_due', label: 'Approval by' }, { key: 'checkins_by', label: 'Check-ins by' },
]
const ROLES = [
  { key: 'vpId', label: 'VP of Operations', what: "Writes the Company Priorities with the CISO and approves each team's. Reviews only the people who report to them." },
  { key: 'cisoId', label: 'CISO', what: "Writes the Company Priorities with the VP of Operations and approves each team's. Reviews only the people who report to them." },
  { key: 'hrId', label: 'HR', what: 'Sees every review. Told when one is approved.' },
] as const

export function HrSettings({ data, canEdit, canRoles = canEdit, api }: { data: HrSettingsData; canEdit: boolean; /** The three roles: Super Admins only (audit, 4 November 2026). */ canRoles?: boolean; api: HrSettingsApi }) {
  const router = useRouter()
  const [toast, setToast] = useState<ToastState | null>(null)
  const [busy, setBusy] = useState(false)
  const [importing, setImporting] = useState(false)
  const say = (t: ToastState) => { setToast(t); setTimeout(() => setToast(null), 5000) }
  const run = async (go: () => Promise<Res>) => {
    setBusy(true)
    try { const r = await go(); say(r.ok ? { text: r.toast ?? 'Saved.' } : { text: r.error, error: true }); if (r.ok) router.refresh() }
    catch { say({ text: 'That did not go through. Try again in a moment.', error: true }) } finally { setBusy(false) }
  }
  const pick = async (mode: 'folder' | 'files') => {
    setBusy(true)
    try {
      const p = await api.hrPicker()
      if (!p.ok) { say({ text: p.error, error: true }); return }
      await openPicker({ ...p, mode, title: mode === 'folder' ? 'Pick the folder for the approved reviews' : `Pick the ${data.year - 1} reviews`, onPick: docs => {
        void run(() => mode === 'folder' ? api.saveHrDriveFolder({ id: docs[0].id, name: docs[0].name }) : api.pickImportFiles({ year: data.year - 1, files: docs }))
        if (mode === 'files') setImporting(true)
      } })
    } catch (e) {
      say({ text: e instanceof Error ? e.message : 'The Picker did not open. Try again.', error: true })
    } finally { setBusy(false) }
  }
  const opensIn = data.dates.leaders_open_on
  const imported = data.imports.filter(i => i.imported).length
  const left = data.people.filter(p => !data.extra.some(e => e.id === p.value))
  const withBadge = badged(data.people)
  return (
    <div className="flex flex-col gap-4" style={APR_COLORS}>
      <div className={`${CARD} px-[22px] py-5 flex flex-col gap-3`}>
        <div className="flex flex-col gap-0.5"><span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">Roles</span><span className="text-[12.5px] text-muted">Chosen here, never by name in the code. All three see every review.</span></div>
        {ROLES.map(r => (
          <div key={r.key} className="grid gap-x-6 gap-y-2 items-center border-t border-[var(--row-rule)] pt-3 sm:grid-cols-[170px_1fr_300px]">
            <span className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">{r.label}</span>
            <span className="text-[13px] text-muted leading-relaxed">{r.what}</span>
            <Select value={data.roles[r.key] ?? ''} disabled={!canRoles || busy} searchable fullWidth ariaLabel={r.label} placeholder="Pick a person" className={INPUT}
              options={withBadge} onChange={v => void run(() => api.saveHrSettings({ [r.key]: v || null }))} />
          </div>
        ))}
      </div>

      <div className={`${CARD} px-[22px] py-5 flex flex-col gap-3`}>
        <div className="flex flex-col gap-0.5"><span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">Who takes part</span><span className="text-[12.5px] text-muted">Every employee in the Directory has a review, {data.employees} people today. Add anyone else who should have one, like a contractor.</span></div>
        <span className={FIELD_LABEL}>Also in the review</span>
        {data.extra.map(p => (
          <div key={p.id} className="flex items-center gap-3 text-[13px]"><span className="w-7 h-7 rounded-full bg-subtle flex items-center justify-center font-(family-name:--font-display) font-extrabold text-[10px] text-muted">{initials(p.name)}</span><span className="flex-1 font-bold text-tn-ink">{p.name}</span>
            {canEdit && <button type="button" className={BTN.link} disabled={busy} onClick={() => void run(() => api.saveHrSettings({ extra: data.extra.filter(x => x.id !== p.id).map(x => x.id) }))}>Remove</button>}</div>
        ))}
        <div className="flex items-center gap-3 flex-wrap">
          {!data.extra.length && <span className="text-[13px] text-muted">No one added.</span>}
          {canEdit && <Select value="" options={left} placeholder="Add a person" searchable ariaLabel="Add a person" disabled={busy} chevron={false} mutePlaceholder={false}
            placeholderIcon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true" className="text-tn-teal"><path d="M12 5v14M5 12h14" /></svg>}
            className={BTN.smallWhite} onChange={v => v && void run(() => api.saveHrSettings({ extra: [...data.extra.map(x => x.id), v] }))} />}
        </div>
      </div>

      <div className={`${CARD} px-[22px] py-5 flex flex-col gap-3`}>
        <div className="flex flex-col gap-0.5"><span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">Dates</span><span className="text-[12.5px] text-muted">Team Leaders, and the people with no Team Leader, go first. A team&apos;s self-reviews open when its priorities are approved, or on &ldquo;Teams open by&rdquo; at the latest. The deadlines show on every review and on the year&apos;s list.</span></div>
        <div className="grid gap-x-4 gap-y-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {DATES.map(d => (
            <label key={d.key} className="flex flex-col gap-1.5"><span className={FIELD_LABEL}>{d.label}</span>
              <DateField value={data.dates[d.key] ?? ''} disabled={!canEdit || busy} clearable ariaLabel={d.label}
                onChange={v => void run(() => api.saveReviewDates({ year: data.year, dates: { [d.key]: v || null } }))} /></label>
          ))}
        </div>
        {opensIn && !data.started && <p className="m-0 text-[13px] text-tn-ink">The {data.year} cycle opens for Team Leaders when a Super Admin starts it in Human Resources › Reviews (planned for {fmtDay(opensIn)}).</p>}
        {data.started && <p className="m-0 text-[13px] text-tn-ink">The {data.year} cycle started on {fmtDay(data.started.slice(0, 10))}. Changing a date moves its reminders.</p>}
      </div>

      <div className={`${CARD} px-[22px] py-5 flex flex-col gap-3`}>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="w-11 h-11 rounded-[12px] flex items-center justify-center flex-none bg-[#eaf4f4]"><GoogleIcon size={22} /></span>
          <div className="flex-1 min-w-[220px] flex flex-col gap-0.5"><span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">Google Drive</span>
            <span className="text-[12.5px] text-muted">When a review is approved, its PDF is copied to this folder, inside a folder for the year. It goes through the office@ Google account, like invoices and receipts.</span></div>
          {canEdit && <button type="button" disabled={busy || !data.drive.ready} className={`${BTN.smallWhite} disabled:opacity-50`} onClick={() => void pick('folder')}>Pick the folder</button>}
        </div>
        <div className="grid gap-x-6 gap-y-1.5 grid-cols-[auto_1fr] text-[13px]">
          <span className={FIELD_LABEL}>Folder</span><span className="text-tn-ink font-semibold">{data.drive.name ?? 'Not picked: the PDFs go into the portal\'s Drive folder, under Annual Performance Reviews'}</span>
          <span className={FIELD_LABEL}>File name</span><span className="text-[#435066]">{data.year} / {data.year}.11 - Name.pdf</span>
          <span className={FIELD_LABEL}>Account</span><span className="text-[#435066]">{data.drive.ready ? `Connected, ${data.drive.account ?? 'office@'} Google account` : data.drive.why}</span>
        </div>
      </div>

      <div className={`${CARD} px-[22px] py-5 flex flex-col gap-3`}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[240px] flex flex-col gap-0.5"><span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">Last year&apos;s reviews</span>
            <span className="text-[12.5px] text-muted">The {data.year - 1} reviews are Word and PDF files in Drive. Import them once, and each one shows as the reference in that person&apos;s {data.year} self-review and on their page. {data.imports.length ? `${imported} of ${data.imports.length} imported.` : 'Not imported yet.'}</span></div>
          {canEdit && <button type="button" disabled={busy || !data.drive.ready} className={`${BTN.smallNavy} disabled:opacity-50`} onClick={() => data.imports.length ? setImporting(true) : void pick('files')}>Import last year&apos;s reviews</button>}
        </div>
      </div>

      {importing && <ImportDialog data={data} busy={busy} api={api} onSaved={say} onClose={() => setImporting(false)} onMore={() => void pick('files')}
        onPerson={(id, personId) => void run(() => api.setImportPerson({ id, personId }))}
        onImport={() => void run(async () => { const r = await api.importFiles({ year: data.year - 1 }); if (r.ok) setImporting(false); return r })} />}
      <Toast toast={toast} />
    </div>
  )
}

function ImportDialog({ data, busy, api, onSaved, onClose, onMore, onPerson, onImport }: {
  data: HrSettingsData; busy: boolean; api: HrSettingsApi; onSaved: (t: ToastState) => void; onClose: () => void; onMore: () => void; onPerson: (id: number, personId: string | null) => void; onImport: () => void
}) {
  const rows = data.imports
  const [checking, setChecking] = useState<number | null>(null)
  const open = rows.find(r => r.id === checking) ?? null
  const people = badged(data.people)
  const count = (m: string) => rows.filter(r => !r.imported && r.match === m).length
  const ready = rows.filter(r => !r.imported && r.personId && (r.match === 'matched' || r.match === 'check')).length
  const COLS = 'grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4 items-center px-6'
  const note = (r: HrSettingsData['imports'][number]) =>
    r.imported ? (r.found?.read ? `${r.goals.length} ${data.year} ${r.goals.length === 1 ? 'goal' : 'goals'} · Job Description ${r.found.job} of 4` : 'Not read: the goals go in by hand.') : r.match === 'check' ? 'Close to the name, not the same.' : r.match === 'none' ? 'The name is not in the file name.'
      : r.match === 'skipped' ? (r.leftOn ? `Left the company in ${MONTH(r.leftOn)}.` : 'Not active in the Directory.') : ''
  return (
    <Modal label="Import last year's reviews" width={860} gap={0} onClose={onClose}><div className="contents" style={APR_COLORS}>
      <div className="-mx-[22px] -mt-[22px] px-6 pt-5 pb-4 border-b border-[#eceff3] flex items-start gap-3">
        <div className="flex-1 flex flex-col gap-[3px]"><h2 className={MODAL_TITLE}>Import last year&apos;s reviews</h2>
          <span className="text-[13px] text-muted">{rows.length} files picked in Google Drive. Each one is matched to a person by its name, as in {data.year - 1}.11 - Name.</span></div>
        <button type="button" className={BTN.icon} aria-label="Close" onClick={onClose}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
      </div>
      <div className="-mx-[22px] px-6 py-3 flex items-center gap-2.5 text-[13px] font-bold bg-[#f8f7f3]">
        <span className="flex items-center gap-[7px] text-[#0d7a4f]"><span className="w-5 h-5 rounded-full bg-[#1E9E6A] flex items-center justify-center"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg></span>Pick the files</span>
        <span className="w-7 h-0.5 bg-[#cbd2da]" />
        <span className="flex items-center gap-[7px] text-tn-ink"><span className="w-5 h-5 rounded-full bg-tn-ink text-[#F2C40A] text-[11px] flex items-center justify-center">2</span>Check the matches</span>
      </div>
      <div className="-mx-[22px] overflow-y-auto [scrollbar-width:none] max-h-[55vh]">
        <div className={`${COLS} py-2.5 bg-[#f4f2ec] border-y border-[#e4e7ec] ${TH} !p-0 !px-6 !py-2.5`}><span>File</span><span>Person</span><span>Match</span></div>
        {rows.map(r => (
          <div key={r.id} className={`${COLS} py-2 border-t border-[#f1f3f6] first:border-t-0`}>
            <span className="flex items-center gap-2 text-[13px] text-tn-ink min-w-0"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8593a4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-none" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6" /></svg><span className="truncate">{r.file}</span></span>
            {r.imported ? <span className="text-[13px] font-bold text-tn-ink">{r.person}</span>
              : <Select value={r.personId ?? ''} options={r.personId && r.person && !people.some(p => p.value === r.personId) ? [...people, ...badged([{ value: r.personId, label: r.person }])] : people}
                  placeholder="Pick a person" searchable fullWidth ariaLabel={`Person for ${r.file}`} disabled={busy}
                  className={`${INPUT}${r.match === 'none' ? ' !border-[#f0b7b7] !bg-[#fff7f7]' : ''}`} onChange={v => onPerson(r.id, v || null)} />}
            <span className="flex items-center gap-2 min-w-0">
              {r.imported ? <Pill tone="green" text="Imported" /> : r.match === 'matched' ? <Pill tone="green" text="Matched" />
                : r.match === 'check' ? <Pill tone="amber" text="Check" /> : r.match === 'skipped' ? <Pill tone="gray" text="Skipped" /> : <Pill tone="red" text="No match" />}
              {note(r) && <span className="text-[12px] text-[#5b6b82] leading-[1.35]">{note(r)}</span>}
              {r.imported && <button type="button" className={`${BTN.link} ml-auto`} onClick={() => setChecking(r.id)}>Check</button>}
            </span>
          </div>
        ))}
      </div>
      <div className="-mx-[22px] -mb-[22px] px-6 py-3.5 border-t border-[#eceff3] flex flex-wrap items-center gap-2">
        <span className="flex-1 min-w-[220px] text-[13px] text-[#5b6b82]">{count('matched')} matched · {count('check')} to check · {count('none')} {count('none') === 1 ? 'needs' : 'need'} a person · {count('skipped')} skipped</span>
        <button type="button" disabled={busy} className={BTN.white} onClick={onMore}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.3" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>Pick more files</button>
        <button type="button" disabled={busy || !ready} className={`${BTN.navy} disabled:opacity-50`} onClick={onImport}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M5 20h14" /></svg>Import {ready} {ready === 1 ? 'file' : 'files'}</button>
      </div>
      {open && <GoalsCheck row={open} year={data.year} api={api} onSaved={onSaved} onClose={() => setChecking(null)} />}
    </div></Modal>
  )
}

/**
 * The goals a file gave, for HR to check (the owner, 4 November 2026): the
 * reader may miss one or read one wrong. Changes save as they are made; the
 * person only marks these in their review.
 */
function GoalsCheck({ row, year, api, onSaved, onClose }: {
  row: HrSettingsData['imports'][number]; year: number; api: HrSettingsApi; onSaved: (t: ToastState) => void; onClose: () => void
}) {
  const router = useRouter()
  const run = async (go: () => Promise<Res>) => { const r = await go(); if (r.ok) router.refresh(); else onSaved({ text: r.error, error: true }) }
  const first = row.person?.split(' ')[0] ?? 'They'
  return (
    <Modal label={`${row.person ?? 'Their'} ${year} goals`} width={640} onClose={onClose}><div className="contents" style={APR_COLORS}>
      <div className="flex flex-col gap-0.5"><h2 className={MODAL_TITLE}>{row.person}&apos;s {year} goals</h2>
        <span className="text-[13px] text-muted">From {row.file}. {row.found?.read ? 'Check them against the file: add what was missed, fix what was read wrong.' : 'This file could not be read: type the goals as the file has them.'} {first} only marks how each one went.</span></div>
      <div className="flex flex-col">
        {row.goals.map((g, i) => (
          <div key={g.id} className="grid grid-cols-[24px_minmax(0,1fr)_170px_32px] gap-2.5 items-center py-2 border-t border-[#f1f3f6] first:border-t-0">
            <span className="font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink">{i + 1}.</span>
            <input defaultValue={g.what} aria-label={`Goal ${i + 1}`} placeholder="The goal, as the file says it" className={INPUT}
              onBlur={e => { if (e.target.value !== g.what) void run(() => api.saveImportGoal({ importId: row.id, goalId: g.id, what: e.target.value })) }} />
            <MonthField value={g.byMonth?.slice(0, 7) ?? ''} ariaLabel="By when" placeholder="By when" onChange={v => void run(() => api.saveImportGoal({ importId: row.id, goalId: g.id, byMonth: v ? `${v}-01` : null }))} />
            <button type="button" className={BTN.icon} aria-label="Remove this goal" onClick={() => void run(() => api.removeImportGoal({ goalId: g.id }))}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
            </button>
          </div>
        ))}
        {!row.goals.length && <p className="m-0 rounded-[12px] border-[1.5px] border-dashed border-[#d9dee6] p-[18px] text-center text-[13.5px] text-[#8593a4]">No {year} goals read from this file.</p>}
      </div>
      <div className="flex items-center gap-2.5">
        <button type="button" className={BTN.smallWhite} onClick={() => void run(() => api.saveImportGoal({ importId: row.id, what: '' }))}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>Add a goal</button>
        <span className="flex-1" />
        <button type="button" className={BTN.navy} onClick={onClose}>Done</button>
      </div>
    </div></Modal>
  )
}
