'use client'

/**
 * PersonModal — the person record: a read view (Employment, Reporting, Emails,
 * Contact, Onboarding, Dates, Team members, History) and an edit form over the
 * same fields. Self-contained: it runs create/update/delete and refreshes.
 */

import { useMemo, useState, useTransition, type ChangeEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { createPerson, updatePerson, deletePerson, type PersonInput } from '@/app/(app)/admin/people/actions'
import { uploadPersonAttachment, deletePersonAttachment, signedAttachmentUrl } from '@/app/(app)/admin/people/attachment-actions'
import {
  TEAM_COLOR,
  PILL_CLASS,
  initialsOf,
  formatDate,
  typePill,
  timePill,
  statusPill,
  ynPill,
  teamKeyFromName,
  type PersonView,
  type PersonAttachment,
  type Account,
  type Pill,
  type TeamKey,
} from './people-types'
import type { TeamOption } from './DirectoryTabs'

export type ModalState = null | { mode: 'view' | 'edit'; person: PersonView | null }

interface EmailDraft { has: boolean; addr: string }
interface Draft {
  full_name: string
  lastName: string
  title: string
  teamId: string
  manager_id: string
  alsoReportsToId: string
  reportsToManager: string
  managerNameText: string
  employmentType: string
  schedule: string
  weeklyHours: string
  internalRate: string
  teamMeeting: boolean
  status: 'active' | 'inactive'
  phone: string
  location: string
  whatsappSameNumber: string
  companyEmail: string
  usesSystem: string
  dateOfBirth: string
  hireDate: string
  leftOn: string
  emails: { trueNorth: EmailDraft; goodnews: EmailDraft; coe: EmailDraft; personal: EmailDraft }
  hasTsheets: boolean
  history: string
  mondayDocs: string
}

const EMAIL_META: { key: keyof Draft['emails']; label: string; color: string }[] = [
  { key: 'trueNorth', label: 'True North', color: '#012358' },
  { key: 'goodnews', label: 'GoodNews', color: '#1f8a5b' },
  { key: 'coe', label: 'COE', color: '#6d5ae0' },
  { key: 'personal', label: 'Personal', color: '#8593a4' },
]

function emailDraft(addr: string | null): EmailDraft { return { has: !!addr, addr: addr ?? '' } }

function toDraft(p: PersonView | null, defaultTeamId: string): Draft {
  if (!p) {
    return {
      full_name: '', lastName: '', title: '', teamId: defaultTeamId, manager_id: '', alsoReportsToId: '',
      reportsToManager: 'no', managerNameText: '', employmentType: 'us', schedule: 'full', weeklyHours: '40', internalRate: '',
      teamMeeting: false, status: 'active', phone: '', location: '', whatsappSameNumber: '', companyEmail: 'notyet', usesSystem: 'notyet',
      dateOfBirth: '', hireDate: '', leftOn: '',
      emails: { trueNorth: { has: false, addr: '' }, goodnews: { has: false, addr: '' }, coe: { has: false, addr: '' }, personal: { has: false, addr: '' } },
      hasTsheets: true, history: '', mondayDocs: '',
    }
  }
  return {
    full_name: p.full_name, lastName: p.lastName ?? '', title: p.title ?? '', teamId: p.teamId ?? '', manager_id: p.manager_id ?? '',
    alsoReportsToId: p.alsoReportsToId ?? '', reportsToManager: p.reportsToManager ?? '', managerNameText: p.managerNameText ?? '',
    employmentType: p.employmentType ?? '', schedule: p.schedule ?? '',
    weeklyHours: p.weeklyHours != null ? String(p.weeklyHours) : '', internalRate: p.internalRate != null ? String(p.internalRate) : '',
    teamMeeting: p.teamMeeting, status: p.status, phone: p.phone ?? '', location: p.location ?? '', whatsappSameNumber: p.whatsappSameNumber ?? '',
    companyEmail: p.companyEmail ?? '', usesSystem: p.usesSystem ?? '',
    dateOfBirth: p.dateOfBirth ?? '', hireDate: p.hireDate ?? '', leftOn: p.leftOn ?? '',
    emails: { trueNorth: emailDraft(p.emails.trueNorth), goodnews: emailDraft(p.emails.goodnews), coe: emailDraft(p.emails.coe), personal: emailDraft(p.emails.personal) },
    hasTsheets: p.hasTsheets, history: p.history ?? '', mondayDocs: p.mondayDocs ?? '',
  }
}

const parseNum = (s: string): number | null => { const t = s.trim(); if (!t) return null; const n = Number(t); return Number.isNaN(n) ? null : n }
const emailVal = (e: EmailDraft): string | null => (e.has && e.addr.trim() ? e.addr.trim() : null)

export function PersonModal({
  state,
  setState,
  people,
  teamOptions,
  availableAccounts: _availableAccounts,
}: {
  state: NonNullable<ModalState>
  setState: (s: ModalState) => void
  people: PersonView[]
  teamOptions: TeamOption[]
  availableAccounts: Account[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(() => toDraft(state.person, teamOptions[0]?.id ?? ''))

  const isEdit = state.mode === 'edit'
  const isExisting = !!state.person
  const p = state.person

  const teamNameById = useMemo(() => new Map(teamOptions.map(t => [t.id, t.name])), [teamOptions])
  const draftTeamKey = teamKeyFromName(teamNameById.get(draft.teamId))
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft(d => ({ ...d, [k]: v }))

  function run(fn: () => Promise<void>, after: () => void) {
    setError(null)
    startTransition(async () => {
      try { await fn(); after(); router.refresh() }
      catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong') }
    })
  }

  function save() {
    const input: PersonInput = {
      full_name: draft.full_name,
      last_name: draft.lastName || null,
      title: draft.title || null,
      team_id: draft.teamId || null,
      manager_id: draft.manager_id || null,
      also_reports_to_id: draft.alsoReportsToId || null,
      reports_to_manager: draft.reportsToManager || null,
      manager_name_text: draft.managerNameText || null,
      employment_type: draft.employmentType || null,
      schedule: draft.schedule || null,
      weekly_hours: parseNum(draft.weeklyHours),
      internal_rate: parseNum(draft.internalRate),
      team_meeting: draft.teamMeeting,
      status: draft.status,
      phone: draft.phone || null,
      location: draft.location || null,
      whatsapp_same_number: draft.whatsappSameNumber || null,
      company_email: draft.companyEmail || null,
      uses_system: draft.usesSystem || null,
      date_of_birth: draft.dateOfBirth || null,
      hire_date: draft.hireDate || null,
      left_on: draft.leftOn || null,
      email_true_north: emailVal(draft.emails.trueNorth),
      email_goodnews: emailVal(draft.emails.goodnews),
      email_coe: emailVal(draft.emails.coe),
      email_personal: emailVal(draft.emails.personal),
      employment_history: draft.history || null,
      monday_docs: draft.mondayDocs || null,
      tsheets: draft.hasTsheets ? undefined : false,
    }
    run(() => (isExisting ? updatePerson(p!.id, input) : createPerson(input)), () => setState(null))
  }

  function remove() {
    if (!p) return
    run(() => deletePerson(p.id), () => setState(null))
  }

  // ── header ──
  const headTeamKey: TeamKey = isEdit ? draftTeamKey : p ? p.teamKey : 'other'
  const headName = isEdit ? draft.full_name || 'New person' : p?.full_name ?? ''
  const headJob = isEdit ? draft.title || '—' : p?.title ?? '—'
  const headInactive = !isEdit && p?.status === 'inactive'

  const managerOptions = people.filter(x => !p || x.id !== p.id)

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-6 py-10 overflow-y-auto">
      <div onClick={() => setState(null)} className="fixed inset-0 bg-[rgba(1,20,45,.44)] backdrop-blur-[2px]" />
      <div className="relative w-[920px] max-w-full bg-white border border-slate-200 rounded-[18px] shadow-[0_40px_90px_-30px_rgba(1,35,88,.6)] overflow-hidden flex flex-col max-h-[calc(100vh-80px)] tn-modal animate-[tn-modal-in_.2s_ease]">

        {/* header */}
        <div className="px-8 pt-6 pb-5 border-b border-slate-200 shrink-0">
          <div className="flex items-start justify-between gap-3.5">
            <div className="flex items-center gap-4 min-w-0">
              <span className={`shrink-0 inline-flex items-center justify-center rounded-full text-white font-(family-name:--font-display) font-extrabold text-[20px] ${headInactive ? 'opacity-50 grayscale-[.4]' : ''}`} style={{ width: 60, height: 60, background: TEAM_COLOR[headTeamKey] }}>{initialsOf(headName)}</span>
              <div className="min-w-0">
                <h2 className="font-(family-name:--font-display) font-extrabold text-[22px] text-tn-ink leading-tight m-0">{headName}</h2>
                <p className="text-sm text-muted mt-1 font-semibold">{headJob}</p>
                <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                  <span className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-wide uppercase rounded-full px-[11px] py-1 whitespace-nowrap" style={{ color: TEAM_COLOR[headTeamKey], background: `${TEAM_COLOR[headTeamKey]}1a` }}>{teamNameById.get(isEdit ? draft.teamId : p?.teamId ?? '') ?? 'No team'}</span>
                  {!isEdit && p && <PillBadge pill={statusPill(p.status === 'active')} />}
                  {isEdit && <span className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-wide uppercase text-[#8a6d00] bg-[#fbeaa8] rounded-[7px] px-2.5 py-1">Editing</span>}
                </div>
              </div>
            </div>
            <button type="button" onClick={() => setState(null)} aria-label="Close" className="shrink-0 inline-flex w-9 h-9 items-center justify-center rounded-[10px] text-muted transition-all hover:bg-subtle hover:text-tn-ink">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-8 pt-6 pb-2">
          {!isEdit && p ? <ViewBody p={p} people={people} /> : <EditBody draft={draft} set={set} setDraft={setDraft} managerOptions={managerOptions} teamOptions={teamOptions} personId={state.person?.id ?? null} attachments={state.person?.attachments ?? []} />}
          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        </div>

        {/* footer */}
        <div className="shrink-0 flex items-center gap-2.5 px-8 py-4 border-t border-slate-200 bg-subtle">
          {!isEdit ? (
            <>
              <span className="inline-flex items-center gap-2 font-(family-name:--font-display) font-extrabold text-[13px] text-[#b8790a] border border-[rgba(184,121,10,.4)] rounded-[10px] px-[15px] py-2.5 mr-auto opacity-80 cursor-default">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                Start offboarding
                <span className="font-(family-name:--font-display) font-extrabold text-[8.5px] tracking-wide uppercase text-muted bg-white rounded-full px-[7px] py-0.5">Soon</span>
              </span>
              <button type="button" onClick={() => setState(null)} className="font-(family-name:--font-display) font-extrabold text-[13.5px] text-foreground border border-slate-200 rounded-[10px] px-[18px] py-2.5 transition-all hover:border-tn-ink hover:text-tn-ink">Close</button>
              <button type="button" onClick={() => { setDraft(toDraft(p, teamOptions[0]?.id ?? '')); setState({ mode: 'edit', person: p }) }} className="inline-flex items-center gap-2.5 font-(family-name:--font-display) font-extrabold text-[13.5px] text-white bg-tn-primary rounded-[10px] px-5 py-[11px] shadow-[0_10px_24px_-12px_rgba(1,35,88,.7)] transition-all hover:brightness-110 hover:-translate-y-px">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#F2C40A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                <span className="text-[#ffffff]">Edit person</span>
              </button>
            </>
          ) : (
            <>
              {isExisting && (
                <button type="button" disabled={pending} onClick={remove} className="inline-flex items-center gap-[7px] font-(family-name:--font-display) font-extrabold text-[13px] text-red-600 border border-[rgba(215,57,47,.35)] rounded-[10px] px-[15px] py-2.5 mr-auto transition-all hover:bg-red-50 disabled:opacity-50">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                  Remove
                </button>
              )}
              <button type="button" onClick={() => (isExisting ? setState({ mode: 'view', person: p }) : setState(null))} className={`font-(family-name:--font-display) font-extrabold text-[13.5px] text-foreground border border-slate-200 rounded-[10px] px-[18px] py-2.5 transition-all hover:border-tn-ink hover:text-tn-ink ${isExisting ? 'ml-auto' : 'ml-auto'}`}>Cancel</button>
              <button type="button" disabled={pending || !draft.full_name.trim()} onClick={save} className="font-(family-name:--font-display) font-extrabold text-[13.5px] text-white bg-tn-primary rounded-[10px] px-5 py-[11px] shadow-[0_10px_24px_-12px_rgba(1,35,88,.7)] transition-all hover:brightness-110 hover:-translate-y-px disabled:opacity-50">
                <span className="text-[#ffffff]">{pending ? 'Saving…' : isExisting ? 'Save changes' : 'Add person'}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── shared bits ──
function PillBadge({ pill }: { pill: Pill }) {
  return <span className={`inline-flex items-center font-(family-name:--font-display) font-extrabold text-[11px] rounded-[7px] px-3 py-[5px] whitespace-nowrap ${PILL_CLASS[pill.kind]}`}>{pill.label}</span>
}

function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.08em] uppercase text-tn-teal mb-3 pb-2 border-b border-slate-200">
      <span>{children}</span>
      {right && <span className="text-muted">{right}</span>}
    </div>
  )
}

// ── VIEW ──
function ViewBody({ p, people }: { p: PersonView; people: PersonView[] }) {
  const reports = people.filter(x => x.manager_id === p.id)
  const item = (label: string, node: ReactNode) => (
    <div className="flex items-center justify-between gap-3.5">
      <span className="text-[12.5px] text-muted font-semibold shrink-0">{label}</span>
      <span className="text-right min-w-0">{node}</span>
    </div>
  )
  const txt = (v: string | null | undefined) => <span className="text-[13.5px] text-foreground font-semibold">{v || '—'}</span>
  const pillNode = (pill: Pill | null) => (pill ? <PillBadge pill={pill} /> : txt('—'))
  const link = (v: string | null) => (v ? <a href={`mailto:${v}`} className="text-[13.5px] font-semibold text-tn-teal truncate inline-block max-w-[220px] align-bottom">{v}</a> : txt('Not set'))
  const personNode = (id: string | null, name: string | null, key: TeamKey | null) =>
    id && name ? (
      <span className="inline-flex items-center gap-2">
        <span className="inline-flex items-center justify-center rounded-full text-white font-(family-name:--font-display) font-extrabold text-[10px]" style={{ width: 24, height: 24, background: TEAM_COLOR[key ?? 'other'] }}>{initialsOf(name)}</span>
        <span className="text-[13.5px] text-foreground font-semibold">{name}</span>
      </span>
    ) : txt('—')

  return (
    <>
      <div className="grid grid-cols-2 gap-x-10 gap-y-6">
        <div>
          <SectionTitle>Employment</SectionTitle>
          <div className="flex flex-col gap-[13px]">
            {item('Last name', txt(p.lastName))}
            {item('Type', pillNode(typePill(p.employmentType)))}
            {item('Team', p.teamName ? <span className="font-(family-name:--font-display) font-extrabold text-[11px] rounded-[7px] px-3 py-[5px]" style={{ color: TEAM_COLOR[p.teamKey], background: `${TEAM_COLOR[p.teamKey]}1a` }}>{p.teamName}</span> : txt('—'))}
            {item('Time', pillNode(timePill(p.schedule)))}
            {item('Weekly hours', txt(p.weeklyHours != null ? `${p.weeklyHours} h / week` : null))}
            {item('Internal rate', txt(p.internalRate != null ? `$${p.internalRate} / hr` : null))}
            {item('Status', pillNode(statusPill(p.status === 'active')))}
          </div>
        </div>
        <div>
          <SectionTitle>Reporting</SectionTitle>
          <div className="flex flex-col gap-[13px]">
            {item('Reports to', personNode(p.manager_id, p.managerName, p.managerTeamKey))}
            {item('Do you report to a manager?', pillNode(ynPill(p.reportsToManager)))}
            {item('Also reports to', personNode(p.alsoReportsToId, p.alsoReportsToName, p.alsoReportsToTeamKey))}
            {item('Manager (as stated)', txt(p.managerNameText))}
          </div>
        </div>
        <div>
          <SectionTitle>Emails</SectionTitle>
          <div className="flex flex-col gap-[13px]">
            {item('True North', link(p.emails.trueNorth))}
            {item('GoodNews', link(p.emails.goodnews))}
            {item('COE', link(p.emails.coe))}
            {item('Personal', link(p.emails.personal))}
          </div>
        </div>
        <div>
          <SectionTitle>Contact</SectionTitle>
          <div className="flex flex-col gap-[13px]">
            {item('Phone / WhatsApp', txt(p.phone))}
            {item('WhatsApp — same number', pillNode(ynPill(p.whatsappSameNumber)))}
            {item('Location', txt(p.location))}
          </div>
        </div>
        <div>
          <SectionTitle>Onboarding</SectionTitle>
          <div className="flex flex-col gap-[13px]">
            {item('Company email', pillNode(ynPill(p.companyEmail)))}
            {item('Uses the system', pillNode(ynPill(p.usesSystem)))}
            {item('Team meeting', pillNode(p.teamMeeting ? { kind: 'green', label: 'Yes' } : { kind: 'grey', label: 'No' }))}
          </div>
        </div>
        <div>
          <SectionTitle>Dates</SectionTitle>
          <div className="flex flex-col gap-[13px]">
            {item('Date of birth', txt(formatDate(p.dateOfBirth)))}
            {item('Joined on', txt(formatDate(p.hireDate)))}
            {item('Left on', txt(formatDate(p.leftOn)))}
          </div>
        </div>
      </div>

      {reports.length > 0 && (
        <div className="mt-6">
          <SectionTitle right={`${reports.length} ${reports.length === 1 ? 'report' : 'reports'}`}>Team members</SectionTitle>
          <div className="grid grid-cols-2 gap-x-5 gap-y-2.5">
            {reports.map(m => (
              <div key={m.id} className="flex items-center gap-2.5">
                <span className="inline-flex items-center justify-center rounded-full text-white font-(family-name:--font-display) font-extrabold text-[11px]" style={{ width: 30, height: 30, background: TEAM_COLOR[m.teamKey] }}>{initialsOf(m.full_name)}</span>
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-bold text-tn-ink truncate">{m.full_name}</span>
                  <span className="block text-xs text-muted truncate">{m.title ?? '—'}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {p.history && p.history.trim() && (
        <div className="mt-6 mb-2">
          <SectionTitle>Employment history</SectionTitle>
          <p className="text-[13.5px] leading-relaxed text-foreground m-0">{p.history}</p>
        </div>
      )}

      {p.mondayDocs && p.mondayDocs.trim() && (
        <div className="mt-6 mb-2">
          <SectionTitle>Monday Docs</SectionTitle>
          <div className="text-[13px] leading-relaxed text-foreground whitespace-pre-wrap rounded-[10px] border border-slate-200 bg-subtle p-4 max-h-[340px] overflow-y-auto">{p.mondayDocs}</div>
        </div>
      )}

      {p.attachments.length > 0 && (
        <div className="mt-6 mb-2">
          <SectionTitle right={`${p.attachments.length} ${p.attachments.length === 1 ? 'file' : 'files'}`}>Documents</SectionTitle>
          <AttachmentsSection personId={p.id} attachments={p.attachments} editable={false} />
        </div>
      )}
    </>
  )
}

// ── EDIT ──
const fieldCls = 'text-sm text-tn-ink bg-subtle border border-slate-200 rounded-[10px] px-3.5 py-[11px] w-full transition-all focus:outline-none focus:border-tn-teal'

function Wrap({ wide, children }: { wide?: boolean; children: ReactNode }) {
  return <label className={`flex flex-col gap-1.5 ${wide ? 'col-span-2' : ''}`}>{children}</label>
}

function EditBody({
  draft, set, setDraft, managerOptions, teamOptions, personId, attachments,
}: {
  draft: Draft
  set: <K extends keyof Draft>(k: K, v: Draft[K]) => void
  setDraft: (fn: (d: Draft) => Draft) => void
  managerOptions: PersonView[]
  teamOptions: TeamOption[]
  personId: string | null
  attachments: PersonAttachment[]
}) {
  const label = (t: string) => <span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-wide uppercase text-muted">{t}</span>

  const seg = (value: string, opts: { v: string; l: string }[], onPick: (v: string) => void) => (
    <div className="flex gap-1.5">
      {opts.map(o => (
        <button key={o.v} type="button" onClick={() => onPick(o.v)} className={`flex-1 text-center font-(family-name:--font-display) font-extrabold text-xs rounded-[9px] px-2.5 py-[9px] border transition-all ${value === o.v ? 'border-tn-teal bg-tn-teal-soft text-tn-teal' : 'border-slate-200 bg-white text-foreground'}`}>{o.l}</button>
      ))}
    </div>
  )

  const managerSelect = (value: string, onChange: (v: string) => void) => (
    <select value={value} onChange={e => onChange(e.target.value)} className={fieldCls}>
      <option value="">— None —</option>
      {managerOptions.map(o => <option key={o.id} value={o.id}>{o.full_name}{o.teamName ? ` · ${o.teamName}` : ''}</option>)}
    </select>
  )

  return (
    <>
      {/* Identity */}
      <div className="mb-6">
        <SectionTitle>Identity</SectionTitle>
        <div className="grid grid-cols-2 gap-x-[18px] gap-y-3.5">
          <Wrap>{label('Full name')}<input type="text" value={draft.full_name} onChange={e => set('full_name', e.target.value)} className={fieldCls} placeholder="Jane Doe" /></Wrap>
          <Wrap>{label('Last name')}<input type="text" value={draft.lastName} onChange={e => set('lastName', e.target.value)} className={fieldCls} placeholder="Doe" /></Wrap>
          <Wrap wide>{label('Job title')}<input type="text" value={draft.title} onChange={e => set('title', e.target.value)} className={fieldCls} placeholder="SEO Strategist" /></Wrap>
          <Wrap>{label('Team')}
            <select value={draft.teamId} onChange={e => set('teamId', e.target.value)} className={fieldCls}>
              <option value="">— No team —</option>
              {teamOptions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Wrap>
          <Wrap>{label('Status')}{seg(draft.status, [{ v: 'active', l: 'Active' }, { v: 'inactive', l: 'Inactive' }], v => set('status', v as 'active' | 'inactive'))}</Wrap>
          <Wrap>{label('Type')}{seg(draft.employmentType, [{ v: 'us', l: 'US Employee' }, { v: 'contractor', l: 'Contractor' }], v => set('employmentType', v))}</Wrap>
          <Wrap>{label('Time')}{seg(draft.schedule, [{ v: 'full', l: 'Full-Time' }, { v: 'part', l: 'Part-Time' }], v => set('schedule', v))}</Wrap>
          <Wrap>{label('Weekly hours')}<input type="number" value={draft.weeklyHours} onChange={e => set('weeklyHours', e.target.value)} className={fieldCls} placeholder="40" /></Wrap>
          <Wrap>{label('Internal rate ($/hr)')}<input type="number" value={draft.internalRate} onChange={e => set('internalRate', e.target.value)} className={fieldCls} placeholder="60" /></Wrap>
        </div>
      </div>

      {/* Reporting */}
      <div className="mb-6">
        <SectionTitle>Reporting</SectionTitle>
        <div className="grid grid-cols-2 gap-x-[18px] gap-y-3.5">
          <Wrap>{label('Reports to')}{managerSelect(draft.manager_id, v => set('manager_id', v))}</Wrap>
          <Wrap>{label('Do you report to a manager?')}{seg(draft.reportsToManager, [{ v: 'yes', l: 'Yes' }, { v: 'no', l: 'No' }, { v: 'sometimes', l: 'Sometimes' }], v => set('reportsToManager', v))}</Wrap>
          <Wrap>{label('Also reports to')}{managerSelect(draft.alsoReportsToId, v => set('alsoReportsToId', v))}</Wrap>
          <Wrap>{label('Manager (as stated)')}<input type="text" value={draft.managerNameText} onChange={e => set('managerNameText', e.target.value)} className={fieldCls} placeholder="Free-text manager name" /></Wrap>
        </div>
      </div>

      {/* Contact */}
      <div className="mb-6">
        <SectionTitle>Contact</SectionTitle>
        <div className="grid grid-cols-2 gap-x-[18px] gap-y-3.5">
          <Wrap>{label('Phone / WhatsApp')}<input type="text" value={draft.phone} onChange={e => set('phone', e.target.value)} className={fieldCls} placeholder="+1 555 000 0000" /></Wrap>
          <Wrap>{label('Location')}<input type="text" value={draft.location} onChange={e => set('location', e.target.value)} className={fieldCls} placeholder="City, Country" /></Wrap>
          <Wrap wide>{label('WhatsApp — same number?')}{seg(draft.whatsappSameNumber, [{ v: 'yes', l: 'Yes' }, { v: 'no', l: 'No' }], v => set('whatsappSameNumber', v))}</Wrap>
          <Wrap>{label('Date of birth')}<input type="date" value={draft.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)} className={fieldCls} /></Wrap>
          <Wrap>{label('Joined on')}<input type="date" value={draft.hireDate} onChange={e => set('hireDate', e.target.value)} className={fieldCls} /></Wrap>
          <Wrap>{label('Left on')}<input type="date" value={draft.leftOn} onChange={e => set('leftOn', e.target.value)} className={fieldCls} /></Wrap>
        </div>
      </div>

      {/* Onboarding */}
      <div className="mb-6">
        <SectionTitle>Onboarding</SectionTitle>
        <div className="grid grid-cols-2 gap-x-[18px] gap-y-3.5">
          <Wrap>{label('Company email')}{seg(draft.companyEmail, [{ v: 'yes', l: 'Yes' }, { v: 'notyet', l: 'Not yet' }], v => set('companyEmail', v))}</Wrap>
          <Wrap wide>{label('Uses the system')}{seg(draft.usesSystem, [{ v: 'yes', l: 'Yes' }, { v: 'notyet', l: 'Not yet' }, { v: 'no', l: 'No' }], v => set('usesSystem', v))}</Wrap>
        </div>
      </div>

      {/* Emails */}
      <div className="mb-6">
        <SectionTitle>Emails</SectionTitle>
        <div className="flex flex-col gap-2.5">
          {EMAIL_META.map(t => {
            const e = draft.emails[t.key]
            return (
              <div key={t.key} className="grid grid-cols-[180px_1fr] gap-3 items-center">
                <button
                  type="button"
                  onClick={() => setDraft(d => ({ ...d, emails: { ...d.emails, [t.key]: { ...d.emails[t.key], has: !d.emails[t.key].has } } }))}
                  className="inline-flex items-center gap-2.5 w-full text-left font-(family-name:--font-display) font-extrabold text-[12.5px] rounded-[10px] px-3.5 py-2.5 border-[1.5px] transition-all"
                  style={e.has ? { borderColor: t.color, background: `${t.color}14`, color: t.color } : undefined}
                  data-off={!e.has}
                >
                  <span className="shrink-0 w-[18px] h-[18px] rounded-full inline-flex items-center justify-center text-white" style={{ background: e.has ? t.color : '#c9cfd8' }}>
                    {e.has && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>}
                  </span>
                  <span className={e.has ? '' : 'text-foreground'}>{t.label}</span>
                </button>
                {e.has ? (
                  <input type="text" value={e.addr} onChange={ev => setDraft(d => ({ ...d, emails: { ...d.emails, [t.key]: { ...d.emails[t.key], addr: ev.target.value } } }))} placeholder="name@domain.com" className={fieldCls} />
                ) : (
                  <span className="text-[12.5px] text-muted italic">Not enabled — click to add.</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Access toggles */}
      <div className="mb-6">
        <SectionTitle>Access</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <ToggleCard title="Active" desc="Inactive people keep history but can’t sign in." on={draft.status === 'active'} onToggle={() => set('status', draft.status === 'active' ? 'inactive' : 'active')} />
          <ToggleCard title="QuickBooks Time" desc="Linked for logging hours (TSheets)." on={draft.hasTsheets} onToggle={() => set('hasTsheets', !draft.hasTsheets)} />
          <ToggleCard title="Team meeting" desc="Included in the team meeting (from the board)." on={draft.teamMeeting} onToggle={() => set('teamMeeting', !draft.teamMeeting)} />
        </div>
      </div>

      {/* History */}
      <div className="mb-6">
        <SectionTitle>Employment history</SectionTitle>
        <textarea value={draft.history} onChange={e => set('history', e.target.value)} placeholder="Notes on start date, role changes, milestones…" className={`${fieldCls} min-h-[90px] resize-y leading-relaxed`} />
      </div>

      {/* Monday Docs */}
      <div className="mb-6">
        <SectionTitle>Monday Docs</SectionTitle>
        <textarea value={draft.mondayDocs} onChange={e => set('mondayDocs', e.target.value)} placeholder="Content pulled from the person's History Monday Doc…" className={`${fieldCls} min-h-[140px] resize-y leading-relaxed`} />
      </div>

      {/* Documents */}
      <div className="mb-2">
        <SectionTitle>Documents</SectionTitle>
        {personId
          ? <AttachmentsSection personId={personId} attachments={attachments} editable />
          : <p className="text-[13px] text-muted">Save this person first, then you can attach documents.</p>}
      </div>
    </>
  )
}

function ToggleCard({ title, desc, on, onToggle }: { title: string; desc: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 border border-slate-200 rounded-[12px] px-4 py-[13px]">
      <div>
        <div className="font-(family-name:--font-display) font-bold text-[13.5px] text-tn-ink">{title}</div>
        <div className="text-xs text-muted mt-0.5">{desc}</div>
      </div>
      <button type="button" onClick={onToggle} role="switch" aria-checked={on} className="relative w-11 h-[25px] rounded-full shrink-0 transition-colors" style={{ background: on ? '#1E7D7F' : '#c9cfd8' }}>
        <span className="absolute top-[3px] left-[3px] w-[19px] h-[19px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.3)] transition-transform" style={{ transform: on ? 'translateX(19px)' : 'translateX(0)' }} />
      </button>
    </div>
  )
}

function fmtSize(bytes: number | null): string {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// The person's "History" documents. View mode = download only; edit mode adds
// upload + delete. Keeps its own list so uploads/deletes show instantly (the
// modal snapshots the person, so it wouldn't otherwise refresh in place).
function AttachmentsSection({ personId, attachments, editable }: { personId: string; attachments: PersonAttachment[]; editable?: boolean }) {
  const router = useRouter()
  const [list, setList] = useState<PersonAttachment[]>(attachments)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function open(a: PersonAttachment) {
    setErr(null)
    try { const url = await signedAttachmentUrl(a.storagePath); window.open(url, '_blank', 'noopener,noreferrer') }
    catch (e) { setErr(e instanceof Error ? e.message : 'Could not open the file') }
  }
  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true); setErr(null)
    try {
      const fd = new FormData(); fd.set('file', file)
      const added = await uploadPersonAttachment(personId, fd)
      setList(l => [added, ...l]); router.refresh()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Upload failed') }
    finally { setBusy(false) }
  }
  async function remove(a: PersonAttachment) {
    setBusy(true); setErr(null)
    try { await deletePersonAttachment(a.id); setList(l => l.filter(x => x.id !== a.id)); router.refresh() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Delete failed') }
    finally { setBusy(false) }
  }

  return (
    <div className="flex flex-col gap-2">
      {list.length === 0 && <p className="text-[13px] text-muted m-0">No documents yet.</p>}
      {list.map(a => (
        <div key={a.id} className="flex items-center gap-3 border border-slate-200 rounded-[10px] px-3.5 py-2.5">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1E7D7F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
          <button type="button" onClick={() => open(a)} className="min-w-0 flex-1 text-left">
            <span className="block text-[13.5px] font-semibold text-tn-ink truncate hover:text-tn-teal">{a.fileName}</span>
            {fmtSize(a.sizeBytes) && <span className="block text-[11px] text-muted">{fmtSize(a.sizeBytes)}</span>}
          </button>
          {editable && (
            <button type="button" disabled={busy} onClick={() => remove(a)} aria-label="Delete document" className="shrink-0 inline-flex w-8 h-8 items-center justify-center rounded-[8px] text-muted transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
            </button>
          )}
        </div>
      ))}
      {editable && (
        <label className="inline-flex items-center gap-2 self-start cursor-pointer font-(family-name:--font-display) font-extrabold text-[12.5px] text-tn-teal border border-dashed border-slate-300 rounded-[10px] px-3.5 py-2.5 transition-colors hover:bg-tn-teal-soft">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          {busy ? 'Uploading…' : 'Add document'}
          <input type="file" className="hidden" onChange={onPick} disabled={busy} />
        </label>
      )}
      {err && <p className="text-[12.5px] text-red-600 m-0">{err}</p>}
    </div>
  )
}
