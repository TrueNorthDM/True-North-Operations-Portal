'use client'

/**
 * A person's page (8 October 2026): the cover band, then one tab per who keeps
 * the information (lib/directory/page-rights.ts). The server sends only the
 * tabs the viewer opens; each editable tab has its own Edit button, edits only
 * its own fields and saves them on its own (app/(app)/directory/[id]/actions.ts).
 */

import Link from 'next/link'
import { useMemo, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar } from '@/components/Avatar'
import { ProfileAvatar } from '@/components/ProfileAvatar'
import { Select } from '@/components/ui/Select'
import { PortalAccessControl } from '@/components/admin/PortalAccessControl'
import { TwoStepControl } from '@/components/admin/TwoStepControl'
import { deletePerson, resetTwoStep } from '@/app/(app)/admin/people/actions'
import { saveHr, savePersonal, saveWork } from '@/app/(app)/directory/[id]/actions'
import { formatPhone } from '@/lib/phone'
import { addressFlag, formatAddressLines, toAddressForm, type AddressForm } from '@/lib/address'
import { allCountries } from '@/lib/countries'
import { deviceLabel } from '@/lib/user-agent'
import { MILESTONE_KINDS, MILESTONE_LABEL, milestoneColor, milestoneLabel, sortMilestones, toMilestoneForms, type MilestoneForm } from '@/lib/milestones'
import {
  LIFECYCLE_LABEL, LIFECYCLE_OPTIONS, PILL_CLASS, formatDate, lifecyclePill, roleTypePill, statusPill, timePill, typePill,
  type Pill,
} from '@/lib/directory/people-types'
import { withViewAs } from '@/components/ViewAsKeeper'
import { PAGE_TABS, personHref, type PageTab } from '@/lib/directory/page-rights'
import type { PersonPageData } from '@/lib/directory/person-page-data'

type Editable = 'personal' | 'work' | 'hr'

const first = (name: string) => name.split(' ')[0]

const PEN = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F2C40A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
const LOCK = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
const EYE = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
const PENCIL = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>

const fieldCls = 'text-sm text-tn-ink bg-subtle border border-slate-200 rounded-[10px] px-3.5 py-[10px] w-full transition-all focus:outline-none focus:border-tn-teal'
const btnNavy = 'inline-flex items-center gap-2 font-(family-name:--font-display) font-extrabold text-[13.5px] bg-tn-primary rounded-[10px] px-4 py-2.5 shadow-[0_10px_24px_-14px_rgba(1,35,88,.7)] transition-all hover:brightness-110'

export function PersonPage({ data, tab, canRemove }: { data: PersonPageData; tab: PageTab; canRemove: boolean }) {
  return (
    <div className="space-y-5">
      <Cover data={data} />
      {/* The rule under the tabs is a shadow, not a border the active tab overlaps:
          an overlap inside a sideways-scrolling row shows a scroll bar. */}
      <nav aria-label="Profile" className="flex gap-1 overflow-x-auto [scrollbar-width:none] shadow-[inset_0_-1px_0_var(--panel-border)]">
        {PAGE_TABS.filter(t => data.rights[t.key]).map(t => {
          const on = t.key === tab
          return (
            <Link
              key={t.key}
              href={personHref(data.id, t.key)}
              scroll={false}
              aria-current={on ? 'page' : undefined}
              className={`inline-flex items-center gap-2 whitespace-nowrap font-(family-name:--font-display) font-extrabold text-[14px] px-1.5 py-3 mr-4 border-b-[2.5px] transition-colors ${on ? 'text-tn-ink border-tn-teal' : 'text-muted border-transparent hover:text-tn-ink'}`}
            >
              {t.key === 'hr' && <span className="text-[#8a6d1a]">{LOCK}</span>}
              {t.label}
              {t.key === 'reports' && data.reports && (
                <span className={`text-[11px] rounded-full px-2 py-0.5 ${on ? 'bg-tn-teal-soft text-tn-teal' : 'bg-subtle text-muted'}`}>{data.reports.length}</span>
              )}
            </Link>
          )
        })}
      </nav>
      {/* Keyed by tab: moving to another tab leaves any edit behind. */}
      <TabPanel key={tab} data={data} tab={tab} canRemove={canRemove} />
    </div>
  )
}

// ── The cover band ──────────────────────────────────────────────────────────

function Cover({ data }: { data: PersonPageData }) {
  const { cover } = data
  const [copied, setCopied] = useState(false)
  const medal = cover.tenure && cover.tenure.milestone.kind !== 'none' ? cover.tenure.milestone : null
  const medalValue = medal ? (medal.kind === 'quarter' ? medal.value * 3 : medal.value) : null
  const medalUnit = medal ? (medal.kind === 'quarter' ? 'MONTHS' : medal.value === 1 ? 'YEAR' : 'YEARS') : ''
  const line = [data.title, cover.location, cover.localTime ? `${cover.localTime} there` : null].filter(Boolean).join(' · ')

  async function copyEmail() {
    if (!cover.email) return
    try { await navigator.clipboard.writeText(cover.email); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { setCopied(false) }
  }

  return (
    <section className="bg-white border border-[var(--panel-border)] rounded-[18px] overflow-hidden" aria-label={data.name}>
      <div className="relative h-[96px] bg-[radial-gradient(circle_at_88%_0%,rgba(242,196,10,.35),transparent_38%),linear-gradient(120deg,#012358,#0a2f6b)]">
        {medal && (
          <div className="absolute right-6 top-[18px] flex items-center gap-2.5 text-right">
            {cover.tenure?.next && <p className="hidden sm:block m-0 text-[12px] font-semibold text-[#dfe8f5] leading-snug">{cover.tenure.next.replace(/^Next: /, 'Next: ').split(' in ')[0]}<br />{cover.tenure.next.includes(' in ') ? `in ${cover.tenure.next.split(' in ')[1]}` : ''}</p>}
            <div className="w-[58px] h-[58px] rounded-full border-4 border-[#F2C40A] grid place-content-center text-center text-[#ffffff] font-(family-name:--font-display) font-black text-[19px] leading-none" title={cover.tenure?.text}>
              {medalValue}<small className="block text-[7px] tracking-[.1em] mt-0.5">{medalUnit}</small>
            </div>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[auto_minmax(0,1fr)] lg:grid-cols-[auto_minmax(0,1fr)_auto] gap-x-5 gap-y-3 items-end px-5 sm:px-7 pb-5">
        <div className="relative -mt-[54px] w-fit rounded-full border-[5px] border-white bg-white">
          {data.rights.own
            ? <ProfileAvatar name={data.name} avatarUrl={data.avatarUrl} color={data.color} size={98} />
            : <Avatar name={data.name} avatarUrl={data.avatarUrl} size={98} color={data.color} dimmed={!data.active} />}
          <span title={data.active ? 'Active' : 'Inactive'} className={`absolute right-1 bottom-1 w-[18px] h-[18px] rounded-full border-[3px] border-white ${data.active ? 'bg-[#1E9E6A]' : 'bg-[#c9cfd8]'}`} />
        </div>
        <div className="min-w-0">
          <h1 className="m-0 font-(family-name:--font-display) font-black text-[26px] sm:text-[30px] text-tn-ink leading-tight tracking-tight [text-wrap:balance]">{data.name}</h1>
          {line && <p className="m-0 mt-1 text-muted font-semibold">{line}</p>}
          <div className="flex flex-wrap gap-2 mt-2.5">
            {cover.teams.map(t => (
              <span key={t.teamId} className="inline-flex items-center gap-1.5 rounded-full px-[11px] py-[5px] text-[12px] font-bold bg-subtle text-foreground">
                <span className="w-[9px] h-[9px] rounded-[3px]" style={{ background: t.color }} />
                {t.teamName} · {t.position === 'lead' ? 'Lead' : 'Member'}
              </span>
            ))}
            {cover.hireDate && <span className="inline-flex items-center rounded-full px-[11px] py-[5px] text-[12px] font-bold bg-subtle text-foreground">Joined {formatDate(cover.hireDate)}</span>}
            {!data.active && <span className="inline-flex items-center rounded-full px-[11px] py-[5px] text-[12px] font-bold bg-[var(--chip-neutral-bg)] text-muted">Inactive</span>}
          </div>
        </div>
        {(cover.email || cover.whatsapp) && (
          <div className="flex flex-wrap gap-2 lg:justify-end sm:col-span-2 lg:col-span-1">
            {cover.email && (
              <button type="button" onClick={copyEmail} title={cover.email} className="inline-flex items-center gap-1.5 border border-[var(--panel-border)] bg-white rounded-[9px] px-3 py-[7px] text-[12.5px] font-semibold text-tn-ink whitespace-nowrap hover:border-tn-teal">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1E9E6A" strokeWidth="2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
                {copied ? 'Copied' : 'Copy email'}
              </button>
            )}
            {cover.whatsapp && (
              <a href={`https://wa.me/${cover.whatsapp}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 border border-[var(--panel-border)] bg-white rounded-[9px] px-3 py-[7px] text-[12.5px] font-semibold text-tn-ink whitespace-nowrap hover:border-tn-teal">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1E9E6A" strokeWidth="2" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" /></svg>
                WhatsApp
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

// ── One tab ─────────────────────────────────────────────────────────────────

function TabPanel({ data, tab, canRemove }: { data: PersonPageData; tab: PageTab; canRemove: boolean }) {
  const router = useRouter()
  const [editing, setEditing] = useState<Editable | null>(null)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const r = data.rights
  const who = first(data.name)

  function run(save: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null)
    start(async () => {
      const res = await save().catch(e => ({ ok: false as const, error: e instanceof Error ? e.message : 'Something went wrong.' }))
      if (!res.ok) { setError(res.error); return }
      setEditing(null)
      router.refresh()
    })
  }

  let rule: { kind: 'edit' | 'view' | 'hidden'; text: string; edit?: { label: string; on: Editable } } | null = null
  if (tab === 'personal') {
    rule = r.own
      ? { kind: 'edit', text: 'You can edit these details.', edit: { label: 'Edit personal data', on: 'personal' } }
      : r.personalEdit
        ? { kind: 'edit', text: `${who} can see and edit this tab. Your access lets you edit it too.`, edit: { label: 'Edit personal data', on: 'personal' } }
        : { kind: 'view', text: `${who} keeps these details. You can see them, not change them.` }
  } else if (tab === 'work') {
    const edit = r.workEdit ? { label: 'Edit work', on: 'work' as const } : undefined
    rule = r.own
      ? { kind: 'view', text: r.workEdit ? 'Kept by the company. Your access lets you change it.' : 'Kept by the company. If something here is wrong, tell an Admin.', edit }
      : { kind: 'view', text: r.workEdit ? `${who} can see this tab but not change it.` : `Kept by the company. ${who} sees this tab too.`, edit }
  } else if (tab === 'hr') {
    rule = {
      kind: 'hidden',
      text: r.own
        ? 'Your access opens this tab on everyone\'s page, yours included. Inviting, revoking and resetting two-step are not done on your own page.'
        : `Not shown to ${who}. Each part follows its own item on Access levels.`,
      edit: r.hrEdit ? { label: 'Edit statuses', on: 'hr' } : undefined,
    }
  } else {
    rule = { kind: 'view', text: `Who reports to ${who}, by reporting line or by a team ${who} leads. A name opens that person's page when your access allows it.` }
  }

  const ruleCls = rule.kind === 'edit' ? 'bg-[var(--ok-bg)] text-[var(--ok-fg)]' : rule.kind === 'hidden' ? 'bg-[var(--warn-bg)] text-[var(--warn-fg)]' : 'bg-[var(--chip-neutral-bg)] text-[var(--chip-neutral-fg)]'

  return (
    <section className="bg-white border border-[var(--panel-border)] rounded-[18px] px-5 sm:px-7 py-6">
      <div className={`flex items-center justify-between gap-3 flex-wrap rounded-[12px] px-4 py-2.5 mb-5 text-[13px] ${ruleCls}`}>
        <p className="m-0 flex items-center gap-2">{rule.kind === 'edit' ? PENCIL : rule.kind === 'hidden' ? LOCK : EYE}{rule.text}</p>
        {rule.edit && editing !== rule.edit.on && (
          <button type="button" onClick={() => { setError(null); setEditing(rule!.edit!.on) }} className={btnNavy}>{PEN}<span className="text-[#ffffff]">{rule.edit.label}</span></button>
        )}
      </div>

      {tab === 'personal' && data.personal && (editing === 'personal'
        ? <PersonalForm data={data} pending={pending} error={error} onCancel={() => setEditing(null)} onSave={input => run(() => savePersonal(data.id, input))} />
        : <PersonalView p={data.personal} />)}

      {tab === 'work' && data.work && (editing === 'work'
        ? <WorkForm data={data} pending={pending} error={error} canRemove={canRemove} onCancel={() => setEditing(null)} onSave={input => run(() => saveWork(data.id, input))} />
        : <WorkView data={data} />)}

      {tab === 'hr' && data.hr && (editing === 'hr'
        ? <HrForm data={data} pending={pending} error={error} onCancel={() => setEditing(null)} onSave={input => run(() => saveHr(data.id, input))} />
        : <HrView data={data} />)}

      {tab === 'reports' && data.reports && <ReportsView data={data} />}
    </section>
  )
}

// ── Read views ──────────────────────────────────────────────────────────────

function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="mb-6 min-w-0">
      <h3 className="m-0 mb-1.5 pb-2.5 border-b border-[var(--panel-border)] flex justify-between font-(family-name:--font-display) font-extrabold text-[11.5px] tracking-[.1em] uppercase text-tn-teal">
        <span>{title}</span>{right && <span className="text-muted tracking-[.04em]">{right}</span>}
      </h3>
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3.5 items-center py-2.5 border-b border-[var(--row-rule)] last:border-b-0">
      <dt className="text-muted text-[13.5px]">{label}</dt>
      <dd className="m-0 text-right min-w-0 [overflow-wrap:anywhere] flex flex-wrap justify-end items-center gap-2 text-[13.5px] font-semibold text-foreground">{children}</dd>
    </div>
  )
}

const none = <span className="text-muted font-normal">-</span>
const val = (v: string | null | undefined) => (v ? v : none)
const PillBadge = ({ pill }: { pill: Pill }) => (
  <span className={`inline-flex items-center font-(family-name:--font-display) font-extrabold text-[11px] rounded-[7px] px-3 py-[5px] whitespace-nowrap ${PILL_CLASS[pill.kind]}`}>{pill.label}</span>
)
const mail = (v: string | null) => (v ? <a href={`mailto:${v}`} className="text-tn-teal">{v}</a> : <span className="text-muted font-normal">Not set</span>)

function PersonalView({ p }: { p: NonNullable<PersonPageData['personal']> }) {
  const phone = formatPhone(p.phone)
  const lines = formatAddressLines(p.address)
  const flag = addressFlag(p.address)
  return (
    <div className="grid md:grid-cols-2 gap-x-12">
      <Section title="Contact">
        <dl className="m-0">
          <Row label="Last name">{val(p.lastName)}</Row>
          <Row label="Personal email">{mail(p.personalEmail)}</Row>
          <Row label="Phone / WhatsApp">
            {phone ? (
              phone.valid
                ? <a href={`https://wa.me/${phone.digits}`} target="_blank" rel="noopener noreferrer" className="hover:text-tn-teal">{phone.flag ? `${phone.flag} ` : ''}{phone.international}</a>
                : <span>{phone.flag ? `${phone.flag} ` : ''}{phone.international}</span>
            ) : none}
          </Row>
          <Row label="WhatsApp, same number">{p.whatsappSame === 'yes' ? 'Yes' : p.whatsappSame === 'no' ? 'No' : none}</Row>
        </dl>
      </Section>
      <Section title="About">
        <dl className="m-0">
          <Row label="Date of birth">{val(formatDate(p.dateOfBirth))}</Row>
          <Row label="Location">{val(p.location)}</Row>
          <Row label="Full address">
            {lines.length ? (
              <span className="inline-flex flex-col items-end leading-snug">
                {lines.map((ln, i) => <span key={i}>{i === lines.length - 1 && flag ? `${flag} ${ln}` : ln}</span>)}
              </span>
            ) : none}
          </Row>
        </dl>
      </Section>
    </div>
  )
}

function WorkView({ data }: { data: PersonPageData }) {
  const w = data.work!
  return (
    <>
      <div className="grid md:grid-cols-2 gap-x-12">
        <div className="min-w-0">
          <Section title="Job">
            <dl className="m-0">
              <Row label="Job title">{val(w.title)}</Row>
              <Row label="Type">{typePill(w.employmentType) ? <PillBadge pill={typePill(w.employmentType)!} /> : none}</Row>
              <Row label="Time">{timePill(w.schedule) ? <PillBadge pill={timePill(w.schedule)!} /> : none}</Row>
              <Row label="Weekly hours">{w.weeklyHours != null ? `${w.weeklyHours} h / week` : none}</Row>
              <Row label="Status"><PillBadge pill={statusPill(w.status === 'active')} /></Row>
              <Row label="Access level"><PillBadge pill={roleTypePill(w.accessLevel)} /></Row>
            </dl>
          </Section>
          <Section title="Company emails">
            <dl className="m-0">
              <Row label="True North">{mail(w.emails.trueNorth)}</Row>
              <Row label="GoodNews">{mail(w.emails.goodnews)}</Row>
              <Row label="COE">{mail(w.emails.coe)}</Row>
            </dl>
          </Section>
          <Section title="Dates">
            <dl className="m-0">
              <Row label="Joined on">{val(formatDate(w.hireDate))}</Row>
              <Row label="Left on">{val(formatDate(w.leftOn))}</Row>
            </dl>
          </Section>
        </div>
        <div className="min-w-0">
          <Section title="Teams"><TeamsList teams={w.teams} /></Section>
          <Section title="Reporting">
            <dl className="m-0">
              <Row label="Reports to">{val(w.managerName)}</Row>
              <Row label="Also reports to">{val(w.alsoReportsToName)}</Row>
            </dl>
          </Section>
          {w.milestones.length > 0 && (
            <Section title="Milestones">
              <div className="flex flex-col gap-3 pt-2">
                {sortMilestones(w.milestones).map((m, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="mt-[6px] w-[9px] h-[9px] rounded-full shrink-0" style={{ background: milestoneColor(m.kind) }} />
                    <div className="min-w-0">
                      <span className="inline-flex items-center font-(family-name:--font-display) font-extrabold text-[10px] tracking-wide uppercase rounded-full px-[9px] py-[3px]" style={{ color: milestoneColor(m.kind), background: `${milestoneColor(m.kind)}1a` }}>{milestoneLabel(m.kind)}</span>
                      {m.date && <span className="ml-2 text-[12px] text-muted font-semibold">{formatDate(m.date)}</span>}
                      {m.note && <p className="text-[13px] text-foreground leading-snug mt-1 m-0">{m.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>
      <Section title="Employment history">
        {w.history ? <p className="m-0 pt-2 text-[13.5px] leading-relaxed text-foreground whitespace-pre-wrap">{w.history}</p> : <p className="m-0 pt-2 text-[13px] text-muted">Nothing written yet.</p>}
      </Section>
    </>
  )
}

function HrView({ data }: { data: PersonPageData }) {
  const h = data.hr!
  const r = data.rights
  const lastAccess = h.lastAccessAt
    ? `${new Date(h.lastAccessAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })} · ${deviceLabel(h.lastAccessAgent)}`
    : 'Never'
  return (
    <div className="grid md:grid-cols-2 gap-x-12">
      <div className="min-w-0">
        <Section title="Onboarding">
          <dl className="m-0"><Row label="Status"><PillBadge pill={lifecyclePill(h.onboarding)} /></Row></dl>
        </Section>
        <Section title="Offboarding">
          <dl className="m-0"><Row label="Status"><PillBadge pill={lifecyclePill(h.offboarding)} /></Row></dl>
          <div className="flex justify-end mt-3">
            <span className="inline-flex items-center gap-2 font-(family-name:--font-display) font-extrabold text-[13px] text-[#b8790a] border border-[rgba(184,121,10,.4)] rounded-[10px] px-[15px] py-2.5 opacity-80 cursor-default">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
              Start offboarding
              <span className="font-(family-name:--font-display) font-extrabold text-[8.5px] tracking-wide uppercase text-muted bg-white rounded-full px-[7px] py-0.5">Soon</span>
            </span>
          </div>
        </Section>
      </div>
      <Section title="Portal access">
        <dl className="m-0">
          <Row label="Invitation">
            <PortalAccessControl
              p={{ id: data.id, full_name: data.name, status: data.active ? 'active' : 'inactive', portalInvitedAt: h.invitedAt, accountId: h.hasAccount ? 'yes' : null, emails: { goodnews: h.goodnews } }}
              canInvite={r.invite}
            />
          </Row>
          {h.twoStepSince !== undefined && (
            <Row label="Two-step sign-in">
              <TwoStepControl
                name={data.name}
                state={!h.hasAccount ? 'no-account' : h.twoStepSince ? 'on' : 'not-set-up'}
                since={h.twoStepSince}
                reset={r.resetTwoStep ? () => resetTwoStep(data.id) : null}
              />
            </Row>
          )}
          <Row label="Last access">{lastAccess}</Row>
          <Row label="QuickBooks Time"><PillBadge pill={h.hasTsheets ? { kind: 'green', label: 'Linked' } : { kind: 'grey', label: 'Not linked' }} /></Row>
        </dl>
      </Section>
    </div>
  )
}

function ReportsView({ data }: { data: PersonPageData }) {
  const list = data.reports!
  if (!list.length) return <p className="m-0 text-[13.5px] text-muted">Nobody reports to {first(data.name)}.</p>
  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
      {list.map(p => {
        const body = (
          <>
            <Avatar name={p.name} avatarUrl={null} size={40} color={p.color} />
            <span className="min-w-0">
              <b className="block font-(family-name:--font-display) font-extrabold text-tn-ink truncate">{p.name}</b>
              <small className="block text-muted truncate">
                {p.title ?? '-'}
                {p.via === 'dotted' ? ' · dotted line' : p.via === 'team' && p.teamName ? ` · ${p.teamName}` : ''}
              </small>
            </span>
          </>
        )
        const cls = 'flex items-center gap-3 border border-[var(--panel-border)] rounded-[14px] p-3.5 min-w-0'
        return p.href
          ? <Link key={p.id} href={p.href} className={`${cls} hover:border-tn-teal transition-colors`}>{body}</Link>
          : <div key={p.id} className={cls}>{body}</div>
      })}
    </div>
  )
}

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

function PersonalForm({ data, pending, error, onCancel, onSave }: FormProps<Parameters<typeof savePersonal>[1]>) {
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

function WorkForm({ data, pending, error, onCancel, onSave, canRemove }: FormProps<Parameters<typeof saveWork>[1]> & { canRemove: boolean }) {
  const router = useRouter()
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
  const [removing, startRemove] = useTransition()
  function remove() {
    if (!window.confirm(`Remove ${data.name} from the Directory? Their record is deleted and their access ends at once. This cannot be undone.`)) return
    startRemove(async () => {
      try { await deletePerson(data.id); router.push(withViewAs('/directory')) } catch (e) { window.alert(e instanceof Error ? e.message : 'Could not remove them.') }
    })
  }

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
        left={canRemove ? <button type="button" disabled={removing} onClick={remove} className="rounded-[9px] border border-[rgba(255,255,255,.35)] text-[#ffd7d3] px-3 py-2 text-[12.5px] font-bold hover:bg-[rgba(255,255,255,.08)] disabled:opacity-50">{removing ? 'Removing…' : 'Remove from the Directory'}</button> : undefined}
      />
    </form>
  )
}

function HrForm({ data, pending, error, onCancel, onSave }: FormProps<Parameters<typeof saveHr>[1]>) {
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
function TeamsList({ teams }: { teams: NonNullable<PersonPageData['work']>['teams'] }) {
  if (!teams.length) return <p className="text-[13px] text-muted italic m-0 py-2.5">No team yet.</p>
  return (
    <>
      {teams.map(t => (
        <div key={t.teamId} className="flex items-center justify-between gap-3 py-2.5 border-b border-[var(--row-rule)] last:border-b-0">
          <span className="inline-flex items-center gap-2 min-w-0 text-[13.5px] font-semibold text-foreground">
            <span className="w-[9px] h-[9px] rounded-[3px] shrink-0" style={{ background: t.color }} />
            <span className="truncate">{t.teamName}</span>
            {t.primary && teams.length > 1 && <span className="text-[10.5px] text-muted font-semibold">primary</span>}
          </span>
          <PillBadge pill={t.position === 'lead' ? { kind: 'teal', label: 'Lead' } : { kind: 'grey', label: 'Member' }} />
        </div>
      ))}
    </>
  )
}
