'use client'

/**
 * PersonModal: adding someone to the Directory. Since 8 October 2026 everything
 * else about a person, reading and changing it, is on their own page
 * (/directory/<id>, components/person/PersonPage); this opens there once saved.
 */

import { useMemo, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { personHref } from '@/lib/directory/page-rights'
import { withViewAs } from '@/components/ViewAsKeeper'
import { createPerson, type PersonInput } from '@/app/(app)/admin/people/actions'
import { Avatar } from '@/components/Avatar'
import { Select } from '@/components/ui/Select'
import { toAddressForm, normalizeAddress, type AddressForm } from '@/lib/address'
import { allCountries } from '@/lib/countries'
import { toMilestoneForms, normalizeMilestones, MILESTONE_KINDS, MILESTONE_LABEL, type MilestoneForm } from '@/lib/milestones'
import {
  TEAM_COLOR,
  PILL_CLASS,
  roleTypePill,
  ROLE_TYPE_LABEL,
  TEAM_POSITION_OPTIONS,
  normalPosition,
  TEAM_POSITION_LABEL,
  LIFECYCLE_OPTIONS,
  LIFECYCLE_LABEL,
  teamKeyFromName,
  type PersonView,
  type Pill,
} from '@/lib/directory/people-types'
import type { TeamOption } from './DirectoryTabs'

export type ModalState = null | { mode: 'view' | 'edit'; person: PersonView | null }

interface EmailDraft { has: boolean; addr: string }
interface Draft {
  full_name: string
  lastName: string
  title: string
  teams: { teamId: string; position: string; primary: boolean }[]
  manager_id: string
  alsoReportsToId: string
  reportsToManager: string
  managerNameText: string
  employmentType: string
  schedule: string
  weeklyHours: string
  internalRate: string
  roleType: string
  status: 'active' | 'inactive'
  phone: string
  location: string
  address: AddressForm
  whatsappSameNumber: string
  onboardingStatus: string
  offboardingStatus: string
  dateOfBirth: string
  hireDate: string
  leftOn: string
  emails: { trueNorth: EmailDraft; goodnews: EmailDraft; coe: EmailDraft; personal: EmailDraft }
  hasTsheets: boolean
  history: string
  milestones: MilestoneForm[]
  mondayDocs: string
}

function emailDraft(addr: string | null): EmailDraft { return { has: !!addr, addr: addr ?? '' } }

function toDraft(p: PersonView | null): Draft {
  if (!p) {
    return {
      full_name: '', lastName: '', title: '', teams: [], manager_id: '', alsoReportsToId: '',
      reportsToManager: 'no', managerNameText: '', employmentType: 'us', schedule: 'full', weeklyHours: '40', internalRate: '',
      roleType: 'user', status: 'active', phone: '', location: '', address: toAddressForm(null), whatsappSameNumber: '', onboardingStatus: 'not_started', offboardingStatus: 'not_started',
      dateOfBirth: '', hireDate: '', leftOn: '',
      emails: { trueNorth: { has: false, addr: '' }, goodnews: { has: false, addr: '' }, coe: { has: false, addr: '' }, personal: { has: false, addr: '' } },
      hasTsheets: true, history: '', milestones: [], mondayDocs: '',
    }
  }
  return {
    full_name: p.full_name, lastName: p.lastName ?? '', title: p.title ?? '', teams: p.teams.map(t => ({ teamId: t.teamId, position: normalPosition(t.position), primary: t.primary })), manager_id: p.manager_id ?? '',
    alsoReportsToId: p.alsoReportsToId ?? '', reportsToManager: p.reportsToManager ?? '', managerNameText: p.managerNameText ?? '',
    employmentType: p.employmentType ?? '', schedule: p.schedule ?? '',
    weeklyHours: p.weeklyHours != null ? String(p.weeklyHours) : '', internalRate: p.internalRate != null ? String(p.internalRate) : '',
    roleType: p.roleType, status: p.status, phone: p.phone ?? '', location: p.location ?? '', address: toAddressForm(p.address), whatsappSameNumber: p.whatsappSameNumber ?? '',
    onboardingStatus: p.onboardingStatus ?? '', offboardingStatus: p.offboardingStatus ?? '',
    dateOfBirth: p.dateOfBirth ?? '', hireDate: p.hireDate ?? '', leftOn: p.leftOn ?? '',
    emails: { trueNorth: emailDraft(p.emails.trueNorth), goodnews: emailDraft(p.emails.goodnews), coe: emailDraft(p.emails.coe), personal: emailDraft(p.emails.personal) },
    hasTsheets: p.hasTsheets, history: p.history ?? '', milestones: toMilestoneForms(p.milestones), mondayDocs: p.mondayDocs ?? '',
  }
}

const parseNum = (s: string): number | null => { const t = s.trim(); if (!t) return null; const n = Number(t); return Number.isNaN(n) ? null : n }
const emailVal = (e: EmailDraft): string | null => (e.has && e.addr.trim() ? e.addr.trim() : null)


export function PersonModal({
  setState,
  people,
  teamOptions,
  canTeams,
}: {
  state: NonNullable<ModalState>
  setState: (s: ModalState) => void
  people: PersonView[]
  teamOptions: TeamOption[]
  /** d-positions (Super Admin only): without it a new person starts on no team. */
  canTeams: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(() => toDraft(null))

  const teamNameById = useMemo(() => new Map(teamOptions.map(t => [t.id, t.name])), [teamOptions])
  const draftTeamKey = teamKeyFromName(teamNameById.get(draft.teams[0]?.teamId ?? ''))
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft(d => ({ ...d, [k]: v }))

  function save() {
    const input: PersonInput = {
      full_name: draft.full_name,
      last_name: draft.lastName || null,
      title: draft.title || null,
      teams: draft.teams.filter(t => t.teamId),
      manager_id: draft.manager_id || null,
      also_reports_to_id: draft.alsoReportsToId || null,
      reports_to_manager: draft.reportsToManager || null,
      manager_name_text: draft.managerNameText || null,
      employment_type: draft.employmentType || null,
      schedule: draft.schedule || null,
      weekly_hours: parseNum(draft.weeklyHours),
      status: draft.status,
      phone: draft.phone || null,
      location: draft.location || null,
      address: normalizeAddress(draft.address),
      whatsapp_same_number: draft.whatsappSameNumber || null,
      onboarding_status: draft.onboardingStatus || null,
      offboarding_status: draft.offboardingStatus || null,
      date_of_birth: draft.dateOfBirth || null,
      hire_date: draft.hireDate || null,
      left_on: draft.leftOn || null,
      email_true_north: emailVal(draft.emails.trueNorth),
      email_goodnews: emailVal(draft.emails.goodnews),
      email_coe: emailVal(draft.emails.coe),
      email_personal: emailVal(draft.emails.personal),
      employment_history: draft.history || null,
      milestones: normalizeMilestones(draft.milestones),
      tsheets: draft.hasTsheets ? undefined : false,
    }
    setError(null)
    startTransition(async () => {
      try {
        // Their page is where everything else about them is seen and changed.
        const { id } = await createPerson(input)
        setState(null)
        router.push(withViewAs(personHref(id)))
      } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong') }
    })
  }

  const headName = draft.full_name || 'New person'
  const headJob = draft.title || '-'

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-6 py-10 overflow-y-auto">
      <div onClick={() => setState(null)} className="fixed inset-0 bg-[rgba(1,20,45,.44)] backdrop-blur-[2px]" />
      <div className="relative w-[920px] max-w-full bg-white border border-slate-200 rounded-[18px] shadow-[0_40px_90px_-30px_rgba(1,35,88,.6)] overflow-hidden flex flex-col max-h-[calc(100vh-80px)] tn-modal animate-[tn-modal-in_.2s_ease]">

        {/* header */}
        <div className="px-8 pt-6 pb-5 border-b border-slate-200 shrink-0">
          <div className="flex items-start justify-between gap-3.5">
            <div className="flex items-center gap-4 min-w-0">
              <Avatar name={headName} avatarUrl={null} size={60} color={TEAM_COLOR[draftTeamKey]} />
              <div className="min-w-0">
                <h2 className="font-(family-name:--font-display) font-extrabold text-[22px] text-tn-ink leading-tight m-0">{headName}</h2>
                <p className="text-sm text-muted mt-1 font-semibold">{headJob}</p>
                <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                  <span className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-wide uppercase rounded-full px-[11px] py-1 whitespace-nowrap" style={{ color: TEAM_COLOR[draftTeamKey], background: `${TEAM_COLOR[draftTeamKey]}1a` }}>{teamNameById.get(draft.teams[0]?.teamId ?? '') ?? 'No team'}</span>
                  <span className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-wide uppercase text-[#8a6d00] bg-[#fbeaa8] rounded-[7px] px-2.5 py-1">New</span>
                </div>
              </div>
            </div>
            <button type="button" onClick={() => setState(null)} aria-label="Close" className="inline-flex w-9 h-9 items-center justify-center rounded-[10px] text-muted transition-all hover:bg-subtle hover:text-tn-ink">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-8 pt-6 pb-2">
          <EditBody draft={draft} set={set} setDraft={setDraft} managerOptions={people} teamOptions={teamOptions} canTeams={canTeams} />
          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        </div>

        {/* footer */}
        <div className="shrink-0 flex items-center gap-2.5 px-8 py-4 border-t border-slate-200 bg-subtle">
          <button type="button" onClick={() => setState(null)} className="ml-auto font-(family-name:--font-display) font-extrabold text-[13.5px] text-foreground border border-slate-200 rounded-[10px] px-[18px] py-2.5 transition-all hover:border-tn-ink hover:text-tn-ink">Cancel</button>
          <button type="button" disabled={pending || !draft.full_name.trim()} onClick={save} className="font-(family-name:--font-display) font-extrabold text-[13.5px] text-white bg-tn-primary rounded-[10px] px-5 py-[11px] shadow-[0_10px_24px_-12px_rgba(1,35,88,.7)] transition-all hover:brightness-110 hover:-translate-y-px disabled:opacity-50">
            <span className="text-[#ffffff]">{pending ? 'Saving…' : 'Add person'}</span>
          </button>
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

// Top-level group heading: a full navy bar with white text, matching the i7
// budget card header (optional right-aligned meta, like its month). One tier
// above the teal SectionTitles it groups. Uses a literal white so the text
// stays white in dark mode (the token would remap).
function GroupTitle({ children, right, className = '' }: { children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={`flex items-center justify-between gap-3 bg-tn-primary rounded-[10px] px-5 py-3 mb-4 ${className}`}>
      <h3 className="font-(family-name:--font-display) font-extrabold text-[14px] text-[#ffffff] m-0">{children}</h3>
      {right && <span className="font-(family-name:--font-display) font-bold text-[11px] tracking-wide uppercase text-[#ffffff]/70">{right}</span>}
    </div>
  )
}

// ── The form for adding someone ──
const fieldCls = 'text-sm text-tn-ink bg-subtle border border-slate-200 rounded-[10px] px-3.5 py-[11px] w-full transition-all focus:outline-none focus:border-tn-teal'

function EditBody({
  draft, set, setDraft, managerOptions, teamOptions, canTeams,
}: {
  canTeams: boolean
  draft: Draft
  set: <K extends keyof Draft>(k: K, v: Draft[K]) => void
  setDraft: (fn: (d: Draft) => Draft) => void
  managerOptions: PersonView[]
  teamOptions: TeamOption[]
}) {
  const label = (t: string) => <span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-wide uppercase text-muted">{t}</span>

  const countryOptions = useMemo(() => allCountries().map(c => ({ value: c.code, label: `${c.flag ? `${c.flag}  ` : ''}${c.name}` })), [])
  const setAddr = (k: keyof AddressForm, v: string) => setDraft(d => ({ ...d, address: { ...d.address, [k]: v } }))

  const seg = (value: string, opts: { v: string; l: string }[], onPick: (v: string) => void) => (
    <div className="flex gap-1.5">
      {opts.map(o => (
        <button key={o.v} type="button" onClick={() => onPick(o.v)} className={`flex-1 text-center font-(family-name:--font-display) font-extrabold text-xs rounded-[9px] px-2.5 py-[9px] border transition-all ${value === o.v ? 'border-tn-teal bg-tn-teal-soft text-tn-teal' : 'border-slate-200 bg-white text-foreground'}`}>{o.l}</button>
      ))}
    </div>
  )

  const managerSelect = (value: string, onChange: (v: string) => void) => (
    <Select
      fullWidth
      value={value}
      onChange={onChange}
      options={[{ value: '', label: 'None' }, ...managerOptions.map(o => ({ value: o.id, label: `${o.full_name}${o.teamName ? ` · ${o.teamName}` : ''}` }))]}
      className={fieldCls}
      ariaLabel="Manager"
    />
  )

  const field = (l: string, control: ReactNode) => <div className="flex flex-col gap-1.5">{label(l)}{control}</div>
  const setEmail = (key: keyof Draft['emails'], v: string) => setDraft(d => ({ ...d, emails: { ...d.emails, [key]: { has: !!v.trim(), addr: v } } }))
  const emailInput = (key: keyof Draft['emails'], l: string) => field(l, <input type="email" value={draft.emails[key].addr} onChange={e => setEmail(key, e.target.value)} className={fieldCls} placeholder="name@domain.com" />)

  return (
    <>
      {/* Group 1: Personal Data and Login */}
      <GroupTitle>Personal Data and Login</GroupTitle>
      <div className="grid grid-cols-2 gap-x-10 gap-y-6 items-start">
        <div>
          <SectionTitle>Personal data</SectionTitle>
          <div className="flex flex-col gap-3.5">
            {field('Full name', <input type="text" value={draft.full_name} onChange={e => set('full_name', e.target.value)} className={fieldCls} placeholder="Jane Doe" />)}
            {field('Last name', <input type="text" value={draft.lastName} onChange={e => set('lastName', e.target.value)} className={fieldCls} placeholder="Doe" />)}
            {emailInput('personal', 'Email')}
            {field('Phone / WhatsApp', (
              <>
                <input type="text" value={draft.phone} onChange={e => set('phone', e.target.value)} className={fieldCls} placeholder="+55 85 98683 9825" />
                <span className="text-[11px] text-muted normal-case font-normal tracking-normal mt-1">Include the country code so we can show the flag.</span>
              </>
            ))}
            {field('WhatsApp, same number?', seg(draft.whatsappSameNumber, [{ v: 'yes', l: 'Yes' }, { v: 'no', l: 'No' }], v => set('whatsappSameNumber', v)))}
            {field('Date of birth', <input type="date" value={draft.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)} className={fieldCls} />)}
            {field('Location', <input type="text" value={draft.location} onChange={e => set('location', e.target.value)} className={fieldCls} placeholder="City, Country" />)}
            {field('Full address', (
              <div className="space-y-2.5">
                {/* Country first; the rest of the form only appears once a country is chosen. */}
                <Select fullWidth searchable value={draft.address.country} onChange={v => setAddr('country', v)} options={countryOptions} placeholder="Select a country…" className={fieldCls} ariaLabel="Country" />
                {draft.address.country && (
                  <>
                    <input type="text" value={draft.address.zip} onChange={e => setAddr('zip', e.target.value)} className={fieldCls} placeholder="ZIP / Postal code" />
                    <input type="text" value={draft.address.city} onChange={e => setAddr('city', e.target.value)} className={fieldCls} placeholder="City" />
                    <input type="text" value={draft.address.line1} onChange={e => setAddr('line1', e.target.value)} className={fieldCls} placeholder="Address line 1 (street, number)" />
                    <input type="text" value={draft.address.line2} onChange={e => setAddr('line2', e.target.value)} className={fieldCls} placeholder="Address line 2 (apt, suite, complement)" />
                    <input type="text" value={draft.address.state} onChange={e => setAddr('state', e.target.value)} className={fieldCls} placeholder="State / Province / Region" />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
        <div>
          <SectionTitle>Login &amp; access</SectionTitle>
          <div className="flex flex-col gap-3.5">
            {field('Access level', (
              <div className="flex items-center gap-2.5 flex-wrap">
                <PillBadge pill={roleTypePill(draft.roleType)} />
                <span className="text-[12px] text-muted leading-snug">{`Super Admin and Admin are given on Admin, Access levels. Team Leader comes from being Lead of a team; everyone else is a ${ROLE_TYPE_LABEL.user}.`}</span>
              </div>
            ))}
            {emailInput('trueNorth', 'True North')}
            {emailInput('goodnews', 'GoodNews')}
            {emailInput('coe', 'COE')}
            <ToggleCard title="QuickBooks Time" desc="Linked for logging hours (TSheets)." on={draft.hasTsheets} onToggle={() => set('hasTsheets', !draft.hasTsheets)} />
          </div>
        </div>
      </div>

      {/* Group 2: Employment. Multi-column flow so the four blocks pack to fit
          however much each one holds, matching the read view. */}
      <GroupTitle className="mt-8">Employment</GroupTitle>
      <div className="columns-2 gap-x-10">
        <div className="break-inside-avoid mb-6">
          <SectionTitle>Employment</SectionTitle>
          <div className="flex flex-col gap-3.5">
            {field('Job title', <input type="text" value={draft.title} onChange={e => set('title', e.target.value)} className={fieldCls} placeholder="SEO Strategist" />)}
            {field('Type', seg(draft.employmentType, [{ v: 'us', l: 'US Employee' }, { v: 'contractor', l: 'Contractor' }], v => set('employmentType', v)))}
            {field('Time', seg(draft.schedule, [{ v: 'full', l: 'Full-Time' }, { v: 'part', l: 'Part-Time' }], v => set('schedule', v)))}
            {field('Weekly hours', <input type="number" value={draft.weeklyHours} onChange={e => set('weeklyHours', e.target.value)} className={fieldCls} placeholder="40" />)}
            {field('Status', seg(draft.status, [{ v: 'active', l: 'Active' }, { v: 'inactive', l: 'Inactive' }], v => set('status', v as 'active' | 'inactive')))}
          </div>
        </div>
        {canTeams && <div className="break-inside-avoid mb-6">
          <div className="flex items-center gap-2 font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.08em] uppercase text-tn-teal mb-3 pb-2 border-b border-slate-200">
            <span>Team position</span>
            <span className="text-[10px] text-muted normal-case font-normal tracking-normal">(several teams, a different position in each. The star marks the primary department)</span>
          </div>
          <div className="space-y-2">
            {draft.teams.length === 0 && <p className="text-[12.5px] text-muted italic">No teams yet, add one below.</p>}
            {draft.teams.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <Select fullWidth value={row.teamId} onChange={v => setDraft(d => ({ ...d, teams: d.teams.map((t, j) => (j === i ? { ...t, teamId: v } : t)) }))} options={teamOptions.map(t => ({ value: t.id, label: t.name }))} placeholder="Choose a team…" className={fieldCls} ariaLabel="Team" />
                </div>
                <div className="shrink-0 w-[150px]">
                  <Select fullWidth value={row.position} onChange={v => setDraft(d => ({ ...d, teams: d.teams.map((t, j) => (j === i ? { ...t, position: v } : t)) }))} options={TEAM_POSITION_OPTIONS.map(pos => ({ value: pos, label: TEAM_POSITION_LABEL[pos] }))} className={fieldCls} ariaLabel="Team position" />
                </div>
                <button type="button" onClick={() => setDraft(d => ({ ...d, teams: d.teams.map((t, j) => ({ ...t, primary: j === i })) }))} aria-label={row.primary ? 'Primary department' : 'Set as primary department'} title={row.primary ? 'Primary department' : 'Set as primary department'} className={`shrink-0 inline-flex w-9 h-9 items-center justify-center rounded-[10px] transition-colors ${row.primary ? 'text-tn-primary bg-tn-teal-soft' : 'text-slate-300 hover:text-tn-teal hover:bg-tn-teal-soft'}`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={row.primary ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2 15.09 8.26 22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                </button>
                <button type="button" onClick={() => setDraft(d => ({ ...d, teams: d.teams.filter((_, j) => j !== i) }))} aria-label="Remove team" className="shrink-0 inline-flex w-9 h-9 items-center justify-center rounded-[10px] text-muted transition-colors hover:bg-red-50 hover:text-red-600">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setDraft(d => ({ ...d, teams: [...d.teams, { teamId: '', position: 'member', primary: d.teams.length === 0 }] }))} className="inline-flex items-center gap-1.5 font-(family-name:--font-display) font-extrabold text-[12.5px] text-tn-teal border border-dashed border-slate-300 rounded-[10px] px-3 py-2 transition-colors hover:border-tn-teal">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              Add team
            </button>
          </div>
        </div>}
        <div className="break-inside-avoid mb-6">
          <SectionTitle>Reporting</SectionTitle>
          <div className="flex flex-col gap-3.5">
            {field('Reports to', managerSelect(draft.manager_id, v => set('manager_id', v)))}
            {field('Also reports to', managerSelect(draft.alsoReportsToId, v => set('alsoReportsToId', v)))}
          </div>
        </div>
        <div className="break-inside-avoid mb-6">
          <SectionTitle>Dates</SectionTitle>
          <div className="flex flex-col gap-3.5">
            {field('Joined on', <input type="date" value={draft.hireDate} onChange={e => set('hireDate', e.target.value)} className={fieldCls} />)}
            {field('Left on', <input type="date" value={draft.leftOn} onChange={e => set('leftOn', e.target.value)} className={fieldCls} />)}
          </div>
        </div>
      </div>

      {/* Milestones editor + employment history, still under the Employment group. */}
      <div className="mt-6">
        <SectionTitle>Milestones</SectionTitle>
        <div className="space-y-2">
          {draft.milestones.length === 0 && <p className="text-[12.5px] text-muted italic">No milestones yet. Add joined dates, promotions, role changes…</p>}
          {draft.milestones.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="shrink-0 w-[150px]">
                <Select fullWidth value={row.kind} onChange={v => setDraft(d => ({ ...d, milestones: d.milestones.map((m, j) => (j === i ? { ...m, kind: v } : m)) }))} options={MILESTONE_KINDS.map(k => ({ value: k, label: MILESTONE_LABEL[k] }))} className={fieldCls} ariaLabel="Milestone type" />
              </div>
              <div className="shrink-0 w-[150px]">
                <input type="date" value={row.date} onChange={e => setDraft(d => ({ ...d, milestones: d.milestones.map((m, j) => (j === i ? { ...m, date: e.target.value } : m)) }))} className={fieldCls} />
              </div>
              <div className="flex-1 min-w-0">
                <input type="text" value={row.note} onChange={e => setDraft(d => ({ ...d, milestones: d.milestones.map((m, j) => (j === i ? { ...m, note: e.target.value } : m)) }))} className={fieldCls} placeholder="What changed…" />
              </div>
              <button type="button" onClick={() => setDraft(d => ({ ...d, milestones: d.milestones.filter((_, j) => j !== i) }))} aria-label="Remove milestone" className="shrink-0 inline-flex w-9 h-9 items-center justify-center rounded-[10px] text-muted transition-colors hover:bg-red-50 hover:text-red-600">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setDraft(d => ({ ...d, milestones: [...d.milestones, { kind: 'promoted', date: '', note: '' }] }))} className="inline-flex items-center gap-1.5 font-(family-name:--font-display) font-extrabold text-[12.5px] text-tn-teal border border-dashed border-slate-300 rounded-[10px] px-3 py-2 transition-colors hover:border-tn-teal">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            Add milestone
          </button>
        </div>
      </div>
      <div className="mt-6">
        <SectionTitle>Employment history</SectionTitle>
        <textarea value={draft.history} onChange={e => set('history', e.target.value)} placeholder="Free-text summary (the timeline above is the structured version)…" className={`${fieldCls} min-h-[80px] resize-y leading-relaxed`} />
      </div>

      {/* Group 3: Hiring. Onboarding + Offboarding side by side, matched height. */}
      <GroupTitle className="mt-2">Hiring</GroupTitle>
      <div className="grid grid-cols-2 gap-x-10 items-start">
        <div>
          <SectionTitle>Onboarding</SectionTitle>
          <div className="flex flex-col gap-3.5">
            {field('Status', seg(draft.onboardingStatus, LIFECYCLE_OPTIONS.map(v => ({ v, l: LIFECYCLE_LABEL[v] })), v => set('onboardingStatus', v)))}
          </div>
        </div>
        <div>
          <SectionTitle>Offboarding</SectionTitle>
          <div className="flex flex-col gap-3.5">
            {field('Status', seg(draft.offboardingStatus, LIFECYCLE_OPTIONS.map(v => ({ v, l: LIFECYCLE_LABEL[v] })), v => set('offboardingStatus', v)))}
          </div>
        </div>
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
