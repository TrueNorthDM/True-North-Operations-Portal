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
import { BTN } from '@/lib/ui/buttons'
import { CARD, FIELD_LABEL, TH } from '@/lib/ui/type'
import { INPUT } from '@/lib/ui/fields'
import { Pill } from '@/components/ui/Pill'
import { Select } from '@/components/ui/Select'
import { DateField } from '@/components/ui/DateField'
import { GoogleIcon } from '@/components/ui/GoogleIcon'
import { Modal, Toast, type ToastState } from '@/components/clocky/entries/ui'
import { openPicker } from '@/lib/drive/picker-client'
import { fmtDay, initials } from '@/lib/review/format'

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
  imports: { id: number; file: string; personId: string | null; person: string | null; match: 'matched' | 'check' | 'none' | 'skipped'; imported: boolean }[]
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
}

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

export function HrSettings({ data, canEdit, api }: { data: HrSettingsData; canEdit: boolean; api: HrSettingsApi }) {
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
  return (
    <div className="flex flex-col gap-4">
      <div className={`${CARD} px-[22px] py-5 flex flex-col gap-3`}>
        <div className="flex flex-col gap-0.5"><span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">Roles</span><span className="text-[12.5px] text-muted">Chosen here, never by name in the code. All three see every review.</span></div>
        {ROLES.map(r => (
          <div key={r.key} className="flex items-center gap-4 flex-wrap border-t border-[var(--row-rule)] pt-3 first:border-t-0">
            <div className="flex-1 min-w-[240px] flex flex-col gap-0.5"><span className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">{r.label}</span><span className="text-[12.5px] text-muted">{r.what}</span></div>
            <div className="w-[260px] max-w-full">
              <Select value={data.roles[r.key] ?? ''} disabled={!canEdit || busy} searchable fullWidth ariaLabel={r.label} placeholder="Pick a person" className={INPUT}
                options={data.people} onChange={v => void run(() => api.saveHrSettings({ [r.key]: v || null }))} />
            </div>
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
        {!data.extra.length && <span className="text-[13px] text-muted">No one added.</span>}
        {canEdit && <div className="w-[300px] max-w-full"><Select value="" options={left} placeholder="Add a person" searchable fullWidth ariaLabel="Add a person" className={INPUT} disabled={busy}
          onChange={v => v && void run(() => api.saveHrSettings({ extra: [...data.extra.map(x => x.id), v] }))} /></div>}
      </div>

      <div className={`${CARD} px-[22px] py-5 flex flex-col gap-3`}>
        <div className="flex flex-col gap-0.5"><span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">Dates for {data.year}</span><span className="text-[12.5px] text-muted">Team Leaders, and the people with no Team Leader, go first. A team&apos;s self-reviews open when its priorities are approved, or on &ldquo;Teams open by&rdquo; at the latest. The deadlines show on every review and on the year&apos;s list.</span></div>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
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

      {importing && <ImportDialog data={data} busy={busy} onClose={() => setImporting(false)} onMore={() => void pick('files')}
        onPerson={(id, personId, skip) => void run(() => api.setImportPerson({ id, personId, skip }))}
        onImport={() => void run(async () => { const r = await api.importFiles({ year: data.year - 1 }); if (r.ok) setImporting(false); return r })} />}
      <Toast toast={toast} />
    </div>
  )
}

function ImportDialog({ data, busy, onClose, onMore, onPerson, onImport }: {
  data: HrSettingsData; busy: boolean; onClose: () => void; onMore: () => void; onPerson: (id: number, personId: string | null, skip?: boolean) => void; onImport: () => void
}) {
  const rows = data.imports
  const count = (m: string) => rows.filter(r => !r.imported && r.match === m).length
  const ready = rows.filter(r => !r.imported && r.personId && (r.match === 'matched' || r.match === 'check')).length
  return (
    <Modal label="Import last year's reviews" width={760} onClose={onClose}>
      <div className="flex flex-col gap-0.5"><h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[19px] text-tn-ink">Import last year&apos;s reviews</h2>
        <span className="text-[13px] text-muted">{rows.length} files picked in Google Drive. Each one is matched to a person by its name, as in {data.year - 1}.11 - Name.</span></div>
      <div className="max-h-[55vh] overflow-y-auto [scrollbar-width:none] border border-[var(--panel-border)] rounded-[12px]">
        <table className="w-full border-collapse">
          <thead><tr><th className={TH}>File</th><th className={TH}>Person</th><th className={TH}>Match</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t border-[var(--row-rule)] align-middle">
                <td className="px-4 py-2.5 text-[13px] text-tn-ink">{r.file}</td>
                <td className="px-4 py-2.5 w-[230px]">{r.imported ? <span className="text-[13px] font-bold text-tn-ink">{r.person}</span>
                  : <Select value={r.personId ?? ''} options={data.people} placeholder="Pick a person" searchable fullWidth ariaLabel={`Person for ${r.file}`} className={INPUT} disabled={busy} onChange={v => onPerson(r.id, v || null)} />}</td>
                <td className="px-4 py-2.5 w-[200px]">
                  {r.imported ? <Pill tone="green" text="Imported" />
                    : r.match === 'matched' ? <Pill tone="green" text="Matched" />
                    : r.match === 'check' ? <span className="flex flex-col gap-0.5"><Pill tone="amber" text="Check" /><span className="text-[11.5px] text-muted">Close to the name, not the same.</span></span>
                    : r.match === 'skipped' ? <span className="flex flex-col gap-0.5"><Pill tone="gray" text="Skipped" /><span className="text-[11.5px] text-muted">Not active in the Directory.</span></span>
                    : <span className="flex flex-col gap-0.5"><Pill tone="red" text="No match" /><span className="text-[11.5px] text-muted">The name is not in the file name.</span></span>}
                  {!r.imported && r.match !== 'skipped' && <button type="button" className={`${BTN.link} mt-1`} onClick={() => onPerson(r.id, null, true)}>Skip</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="flex-1 min-w-[220px] text-[12.5px] text-muted">{count('matched')} matched · {count('check')} to check · {count('none')} {count('none') === 1 ? 'needs' : 'need'} a person · {count('skipped')} skipped</span>
        <button type="button" disabled={busy} className={BTN.white} onClick={onMore}>Pick more files</button>
        <button type="button" disabled={busy || !ready} className={`${BTN.navy} disabled:opacity-50`} onClick={onImport}>Import {ready} {ready === 1 ? 'file' : 'files'}</button>
      </div>
    </Modal>
  )
}
