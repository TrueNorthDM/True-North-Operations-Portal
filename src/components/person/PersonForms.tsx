'use client'

/**
 * The edit forms of a person's page, one per editable tab (Personal, Work,
 * HR). Each edits only its own fields and hands them to the page, which saves
 * them with that tab's own action (app/(app)/directory/[id]/actions.ts).
 */

import { useMemo, useState, type ReactNode } from 'react'
import { Select } from '@/components/ui/Select'
import type { saveHr, savePersonal, saveWork } from '@/app/(app)/directory/[id]/actions'
import { toAddressForm, type AddressForm } from '@/lib/address'
import { allCountries } from '@/lib/countries'
import { MILESTONE_KINDS, MILESTONE_LABEL, toMilestoneForms, type MilestoneForm } from '@/lib/milestones'
import { LIFECYCLE_LABEL, LIFECYCLE_OPTIONS } from '@/lib/directory/people-types'
import type { PersonPageData } from '@/lib/directory/person-page-data'
import { Section, TeamsList, fieldCls } from './PersonParts'

// ── Forms ───────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-wide uppercase text-muted">{label}</span>
      {children}
    </label>
  )
}

function Seg({ value, options, onPick }: { value: string; options: { v: string; l: string }[]; onPick: (v: string) => void }) {
  return (
    <div className="flex gap-1.5">
      {options.map(o => (
        <button key={o.v} type="button" onClick={() => onPick(o.v)} className={`flex-1 text-center font-(family-name:--font-display) font-extrabold text-xs rounded-[9px] px-2.5 py-[9px] border transition-all ${value === o.v ? 'border-tn-teal bg-tn-teal-soft text-tn-teal' : 'border-slate-200 bg-white text-foreground'}`}>{o.l}</button>
      ))}
    </div>
  )
}

function SaveBar({ what, pending, error, onCancel, onSave, left }: { what: string; pending: boolean; error: string | null; onCancel: () => void; onSave: () => void; left?: ReactNode }) {
  return (
    <>
      {error && <p className="text-sm text-red-600 mt-4 mb-0">{error}</p>}
      <div className="sticky bottom-3 mt-5 flex items-center justify-between gap-3 flex-wrap rounded-[12px] bg-tn-primary px-4 py-2.5 shadow-[0_18px_36px_-18px_rgba(1,35,88,.7)]">
        <span className="flex items-center gap-2.5 text-[13px] text-[#ffffff]">
          <span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-[#8a6d00] bg-[#fbeaa8] rounded-[7px] px-2.5 py-1">Editing</span>
          {what}. The other tabs stay as they are.
        </span>
        <span className="flex items-center gap-2">
          {left}
          <button type="button" onClick={onCancel} className="rounded-[9px] bg-white text-tn-ink px-3.5 py-2 text-[13px] font-bold">Cancel</button>
          <button type="button" disabled={pending} onClick={onSave} className="rounded-[9px] bg-[#F2C40A] text-tn-ink px-3.5 py-2 text-[13px] font-bold disabled:opacity-50">{pending ? 'Saving…' : 'Save changes'}</button>
        </span>
      </div>
    </>
  )
}

interface FormProps<T> { data: PersonPageData; pending: boolean; error: string | null; onCancel: () => void; onSave: (input: T) => void }

export function PersonalForm({ data, pending, error, onCancel, onSave }: FormProps<Parameters<typeof savePersonal>[1]>) {
  const p = data.personal!
  const [d, setD] = useState({
    lastName: p.lastName ?? '', personalEmail: p.personalEmail ?? '', phone: p.phone ?? '', whatsappSame: p.whatsappSame ?? '',
    dateOfBirth: p.dateOfBirth ?? '', location: p.location ?? '', address: toAddressForm(p.address),
  })
  const countries = useMemo(() => allCountries().map(c => ({ value: c.code, label: `${c.flag ? `${c.flag}  ` : ''}${c.name}` })), [])
  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD(x => ({ ...x, [k]: v }))
  const setAddr = (k: keyof AddressForm, v: string) => setD(x => ({ ...x, address: { ...x.address, [k]: v } }))
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(d) }}>
      <div className="grid md:grid-cols-2 gap-x-12 gap-y-6">
        <Section title="Contact">
          <div className="flex flex-col gap-3.5 pt-2">
            <Field label="Last name"><input id="pp-last" value={d.lastName} onChange={e => set('lastName', e.target.value)} className={fieldCls} /></Field>
            <Field label="Personal email"><input id="pp-mail" type="email" value={d.personalEmail} onChange={e => set('personalEmail', e.target.value)} className={fieldCls} placeholder="name@email.com" /></Field>
            <Field label="Phone / WhatsApp">
              <input id="pp-phone" value={d.phone} onChange={e => set('phone', e.target.value)} className={fieldCls} placeholder="+1 407 555 0142" />
              <span className="text-[11px] text-muted">Include the country code so the flag shows.</span>
            </Field>
            <div className="flex flex-col gap-1.5">
              <span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-wide uppercase text-muted">WhatsApp, same number?</span>
              <Seg value={d.whatsappSame} options={[{ v: 'yes', l: 'Yes' }, { v: 'no', l: 'No' }]} onPick={v => set('whatsappSame', v)} />
            </div>
          </div>
        </Section>
        <Section title="About">
          <div className="flex flex-col gap-3.5 pt-2">
            <Field label="Date of birth"><input id="pp-dob" type="date" value={d.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)} className={fieldCls} /></Field>
            <Field label="Location"><input id="pp-loc" value={d.location} onChange={e => set('location', e.target.value)} className={fieldCls} placeholder="City, Country" /></Field>
            <div className="flex flex-col gap-1.5">
              <span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-wide uppercase text-muted">Full address</span>
              <Select fullWidth searchable value={d.address.country} onChange={v => setAddr('country', v)} options={countries} placeholder="Select a country…" className={fieldCls} ariaLabel="Country" />
              {d.address.country && (
                <div className="flex flex-col gap-2">
                  <input value={d.address.zip} onChange={e => setAddr('zip', e.target.value)} className={fieldCls} placeholder="ZIP / Postal code" aria-label="ZIP" />
                  <input value={d.address.city} onChange={e => setAddr('city', e.target.value)} className={fieldCls} placeholder="City" aria-label="City" />
                  <input value={d.address.line1} onChange={e => setAddr('line1', e.target.value)} className={fieldCls} placeholder="Address line 1 (street, number)" aria-label="Address line 1" />
                  <input value={d.address.line2} onChange={e => setAddr('line2', e.target.value)} className={fieldCls} placeholder="Address line 2 (apt, suite)" aria-label="Address line 2" />
                  <input value={d.address.state} onChange={e => setAddr('state', e.target.value)} className={fieldCls} placeholder="State / Province / Region" aria-label="State" />
                </div>
              )}
            </div>
          </div>
        </Section>
      </div>
      <SaveBar what="Personal" pending={pending} error={error} onCancel={onCancel} onSave={() => onSave(d)} />
    </form>
  )
}

export function WorkForm({ data, pending, error, onCancel, onSave, remove }: FormProps<Parameters<typeof saveWork>[1]> & { remove: { pending: boolean; run: () => void } | null }) {
  const w = data.work!
  const people = data.options?.people ?? []
  const teams = data.options?.teams ?? []
  const [d, setD] = useState({
    fullName: w.fullName, title: w.title ?? '', employmentType: w.employmentType ?? '', schedule: w.schedule ?? '',
    weeklyHours: w.weeklyHours != null ? String(w.weeklyHours) : '', status: w.status,
    emails: { trueNorth: w.emails.trueNorth ?? '', goodnews: w.emails.goodnews ?? '', coe: w.emails.coe ?? '' },
    teams: w.teams.map(t => ({ teamId: t.teamId, position: t.position, primary: t.primary })),
    managerId: w.managerId ?? '', alsoReportsToId: w.alsoReportsToId ?? '', hireDate: w.hireDate ?? '', leftOn: w.leftOn ?? '',
    milestones: toMilestoneForms(w.milestones) as MilestoneForm[], history: w.history ?? '',
  })
  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD(x => ({ ...x, [k]: v }))
  const personSelect = (value: string, onChange: (v: string) => void, label: string) => (
    <Select fullWidth searchable value={value} onChange={onChange} options={[{ value: '', label: 'None' }, ...people]} className={fieldCls} ariaLabel={label} />
  )

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(d) }}>
      <div className="grid md:grid-cols-2 gap-x-12 gap-y-6">
        <Section title="Job">
          <div className="flex flex-col gap-3.5 pt-2">
            <Field label="Full name"><input id="pw-name" value={d.fullName} onChange={e => set('fullName', e.target.value)} className={fieldCls} /></Field>
            <Field label="Job title"><input id="pw-title" value={d.title} onChange={e => set('title', e.target.value)} className={fieldCls} /></Field>
            <div className="flex flex-col gap-1.5"><span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-wide uppercase text-muted">Type</span><Seg value={d.employmentType} options={[{ v: 'us', l: 'US Employee' }, { v: 'contractor', l: 'Contractor' }]} onPick={v => set('employmentType', v)} /></div>
            <div className="flex flex-col gap-1.5"><span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-wide uppercase text-muted">Time</span><Seg value={d.schedule} options={[{ v: 'full', l: 'Full-Time' }, { v: 'part', l: 'Part-Time' }]} onPick={v => set('schedule', v)} /></div>
            <Field label="Weekly hours"><input id="pw-hours" type="number" value={d.weeklyHours} onChange={e => set('weeklyHours', e.target.value)} className={fieldCls} /></Field>
            <div className="flex flex-col gap-1.5"><span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-wide uppercase text-muted">Status</span><Seg value={d.status} options={[{ v: 'active', l: 'Active' }, { v: 'inactive', l: 'Inactive' }]} onPick={v => set('status', v as 'active' | 'inactive')} /></div>
            <Field label="True North email"><input id="pw-tn" type="email" value={d.emails.trueNorth} onChange={e => set('emails', { ...d.emails, trueNorth: e.target.value })} className={fieldCls} /></Field>
            <Field label="GoodNews email (they sign in with it)"><input id="pw-gna" type="email" value={d.emails.goodnews} onChange={e => set('emails', { ...d.emails, goodnews: e.target.value })} className={fieldCls} /></Field>
            <Field label="COE email"><input id="pw-coe" type="email" value={d.emails.coe} onChange={e => set('emails', { ...d.emails, coe: e.target.value })} className={fieldCls} /></Field>
          </div>
        </Section>
        <div className="min-w-0">
          <Section title="Teams">
            {!data.rights.teamsEdit ? (
              <>
                <TeamsList teams={w.teams} />
                <p className="text-[11.5px] text-muted m-0 pt-2">Teams and positions change with &quot;Add people, and change teams and positions&quot; on Access levels.</p>
              </>
            ) : (
            <div className="flex flex-col gap-2 pt-2">
              {d.teams.length === 0 && <p className="text-[12.5px] text-muted italic m-0">No teams yet, add one below.</p>}
              {d.teams.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0"><Select fullWidth value={row.teamId} onChange={v => set('teams', d.teams.map((t, j) => (j === i ? { ...t, teamId: v } : t)))} options={teams.map(t => ({ value: t.id, label: t.name }))} placeholder="Choose a team…" className={fieldCls} ariaLabel="Team" /></div>
                  <div className="shrink-0 w-[120px]"><Select fullWidth value={row.position} onChange={v => set('teams', d.teams.map((t, j) => (j === i ? { ...t, position: v as 'lead' | 'member' } : t)))} options={[{ value: 'lead', label: 'Lead' }, { value: 'member', label: 'Member' }]} className={fieldCls} ariaLabel="Position" /></div>
                  <button type="button" onClick={() => set('teams', d.teams.map((t, j) => ({ ...t, primary: j === i })))} aria-label={row.primary ? 'Primary department' : 'Set as primary department'} title={row.primary ? 'Primary department' : 'Set as primary department'} className={`shrink-0 inline-flex w-9 h-9 items-center justify-center rounded-[10px] ${row.primary ? 'text-tn-primary bg-tn-teal-soft' : 'text-slate-300 hover:text-tn-teal hover:bg-tn-teal-soft'}`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill={row.primary ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2 15.09 8.26 22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                  </button>
                  <button type="button" onClick={() => set('teams', d.teams.filter((_, j) => j !== i))} aria-label="Remove team" className="shrink-0 inline-flex w-9 h-9 items-center justify-center rounded-[10px] text-muted hover:bg-red-50 hover:text-red-600">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => set('teams', [...d.teams, { teamId: '', position: 'member', primary: d.teams.length === 0 }])} className="self-start inline-flex items-center gap-1.5 font-(family-name:--font-display) font-extrabold text-[12.5px] text-tn-teal border border-dashed border-slate-300 rounded-[10px] px-3 py-2 hover:border-tn-teal">+ Add team</button>
              <p className="text-[11.5px] text-muted m-0">Lead of any team makes them a Team Leader. The star marks the primary department.</p>
            </div>
            )}
          </Section>
          <Section title="Reporting and dates">
            <div className="flex flex-col gap-3.5 pt-2">
              <div className="flex flex-col gap-1.5"><span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-wide uppercase text-muted">Reports to</span>{personSelect(d.managerId, v => set('managerId', v), 'Reports to')}</div>
              <div className="flex flex-col gap-1.5"><span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-wide uppercase text-muted">Also reports to</span>{personSelect(d.alsoReportsToId, v => set('alsoReportsToId', v), 'Also reports to')}</div>
              <Field label="Joined on"><input id="pw-joined" type="date" value={d.hireDate} onChange={e => set('hireDate', e.target.value)} className={fieldCls} /></Field>
              <Field label="Left on"><input id="pw-left" type="date" value={d.leftOn} onChange={e => set('leftOn', e.target.value)} className={fieldCls} /></Field>
            </div>
          </Section>
        </div>
      </div>
      <Section title="Milestones">
        <div className="flex flex-col gap-2 pt-2">
          {d.milestones.map((row, i) => (
            <div key={i} className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <div className="w-[150px] shrink-0"><Select fullWidth value={row.kind} onChange={v => set('milestones', d.milestones.map((m, j) => (j === i ? { ...m, kind: v } : m)))} options={MILESTONE_KINDS.map(k => ({ value: k, label: MILESTONE_LABEL[k] }))} className={fieldCls} ariaLabel="Milestone type" /></div>
              <div className="w-[150px] shrink-0"><input type="date" value={row.date} onChange={e => set('milestones', d.milestones.map((m, j) => (j === i ? { ...m, date: e.target.value } : m)))} className={fieldCls} aria-label="Milestone date" /></div>
              <div className="flex-1 min-w-[160px]"><input value={row.note} onChange={e => set('milestones', d.milestones.map((m, j) => (j === i ? { ...m, note: e.target.value } : m)))} className={fieldCls} placeholder="What changed…" aria-label="Milestone note" /></div>
              <button type="button" onClick={() => set('milestones', d.milestones.filter((_, j) => j !== i))} aria-label="Remove milestone" className="shrink-0 inline-flex w-9 h-9 items-center justify-center rounded-[10px] text-muted hover:bg-red-50 hover:text-red-600">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
          <button type="button" onClick={() => set('milestones', [...d.milestones, { kind: 'promoted', date: '', note: '' }])} className="self-start inline-flex items-center gap-1.5 font-(family-name:--font-display) font-extrabold text-[12.5px] text-tn-teal border border-dashed border-slate-300 rounded-[10px] px-3 py-2 hover:border-tn-teal">+ Add milestone</button>
        </div>
      </Section>
      <Section title="Employment history">
        <textarea id="pw-history" value={d.history} onChange={e => set('history', e.target.value)} className={`${fieldCls} min-h-[90px] resize-y leading-relaxed mt-2`} placeholder="A short summary of their time here…" />
      </Section>
      <SaveBar
        what="Work" pending={pending} error={error} onCancel={onCancel} onSave={() => onSave(d)}
        left={remove ? <button type="button" disabled={remove.pending} onClick={remove.run} className="rounded-[9px] border border-[rgba(255,255,255,.35)] text-[#ffd7d3] px-3 py-2 text-[12.5px] font-bold hover:bg-[rgba(255,255,255,.08)] disabled:opacity-50">{remove.pending ? 'Removing…' : 'Remove from the Directory'}</button> : undefined}
      />
    </form>
  )
}

export function HrForm({ data, pending, error, onCancel, onSave }: FormProps<Parameters<typeof saveHr>[1]>) {
  const h = data.hr!
  const [d, setD] = useState({ onboarding: h.onboarding ?? 'not_started', offboarding: h.offboarding ?? 'not_started', unlinkTsheets: false })
  const opts = LIFECYCLE_OPTIONS.map(v => ({ v, l: LIFECYCLE_LABEL[v] }))
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(d) }}>
      <div className="grid md:grid-cols-2 gap-x-12 gap-y-6">
        <Section title="Onboarding">
          <div className="pt-2"><Seg value={d.onboarding} options={opts} onPick={v => setD(x => ({ ...x, onboarding: v }))} /></div>
        </Section>
        <Section title="Offboarding">
          <div className="pt-2"><Seg value={d.offboarding} options={opts} onPick={v => setD(x => ({ ...x, offboarding: v }))} /></div>
        </Section>
      </div>
      {h.hasTsheets && (
        <Section title="QuickBooks Time">
          <label className="flex items-center gap-2.5 pt-2 text-[13.5px] text-foreground cursor-pointer">
            <input type="checkbox" checked={d.unlinkTsheets} onChange={e => setD(x => ({ ...x, unlinkTsheets: e.target.checked }))} className="h-4 w-4 accent-[#012358]" />
            Unlink their QuickBooks Time account
          </label>
        </Section>
      )}
      <SaveBar what="HR and access" pending={pending} error={error} onCancel={onCancel} onSave={() => onSave(d)} />
    </form>
  )
}

/** A person's teams, read only: in the Work tab, and in its editor without teamsEdit. */
