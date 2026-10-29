'use client'

/**
 * A person's page (8 October 2026): the cover band, then one tab per who keeps
 * the information (lib/directory/page-rights.ts). The server sends only the
 * tabs the viewer opens; each editable tab has its own Edit button, edits only
 * its own fields and saves them on its own (app/(app)/directory/[id]/actions.ts).
 */

import Link from 'next/link'
import { useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar } from '@/components/Avatar'
import { ProfileAvatar } from '@/components/ProfileAvatar'
import { PortalAccessControl } from '@/components/admin/PortalAccessControl'
import { TwoStepControl } from '@/components/admin/TwoStepControl'
import { deletePerson, resetTwoStep } from '@/app/(app)/admin/people/actions'
import { saveHr, savePersonal, saveWork } from '@/app/(app)/directory/[id]/actions'
import { formatPhone } from '@/lib/phone'
import { addressFlag, formatAddressLines } from '@/lib/address'
import { deviceLabel } from '@/lib/user-agent'
import { milestoneColor, milestoneLabel, sortMilestones } from '@/lib/milestones'
import { formatDate, lifecyclePill, roleTypePill, statusPill, timePill, typePill } from '@/lib/directory/people-types'
import { withViewAs } from '@/components/ViewAsKeeper'
import { useConfirm } from '@/components/ui/useConfirm'
import { HrForm, PersonalForm, WorkForm } from './PersonForms'
import { PillBadge, Section, TeamsList } from './PersonParts'
import { PersonRates } from './PersonRates'
import { PAGE_TABS, personHref, type PageTab } from '@/lib/directory/page-rights'
import type { PersonPageData } from '@/lib/directory/person-page-data'

type Editable = 'personal' | 'work' | 'hr'

const first = (name: string) => name.split(' ')[0]

const PEN = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F2C40A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
const LOCK = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
const EYE = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
const PENCIL = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>

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

  const [confirmDialog, confirm] = useConfirm()
  const [notice, setNotice] = useState<string | null>(null)
  const [removing, startRemove] = useTransition()

  // Someone with hours or rates on record is made inactive instead (decided
  // 8 October 2026); the server decides which, and says so.
  async function remove() {
    const yes = await confirm({
      title: `Remove ${data.name} from the Directory?`,
      body: 'Their access ends at once. If they have hours or rates on record they are made inactive instead, so every report stays true. Otherwise their record, photo and documents are deleted, and that cannot be undone.',
      action: 'Remove',
      danger: true,
    })
    if (!yes) return
    setError(null)
    startRemove(async () => {
      const res = await deletePerson(data.id)
      if (!res.ok) { setError(res.error); return }
      if (res.outcome === 'removed') { router.push(withViewAs('/directory')); return }
      setEditing(null)
      setNotice(`${who} has hours or rates on record, so they were made inactive instead of removed. Their hours stay in every report and their access has ended.`)
      router.refresh()
    })
  }

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
          <button type="button" onClick={() => { setError(null); setNotice(null); setEditing(rule!.edit!.on) }} className={btnNavy}>{PEN}<span className="text-[#ffffff]">{rule.edit.label}</span></button>
        )}
      </div>

      {confirmDialog}
      {notice && <p role="status" className="m-0 mb-5 rounded-[12px] px-4 py-2.5 text-[13px] bg-[var(--warn-bg)] text-[var(--warn-fg)]">{notice}</p>}

      {tab === 'personal' && data.personal && (editing === 'personal'
        ? <PersonalForm data={data} pending={pending} error={error} onCancel={() => setEditing(null)} onSave={input => run(() => savePersonal(data.id, input))} />
        : <PersonalView p={data.personal} />)}

      {tab === 'work' && data.work && (editing === 'work'
        ? <WorkForm data={data} pending={pending} error={error} remove={canRemove ? { pending: removing, run: remove } : null} onCancel={() => setEditing(null)} onSave={input => run(() => saveWork(data.id, input))} />
        : <WorkView data={data} />)}

      {tab === 'hr' && data.hr && (editing === 'hr'
        ? <HrForm data={data} pending={pending} error={error} onCancel={() => setEditing(null)} onSave={input => run(() => saveHr(data.id, input))} />
        : <HrView data={data} />)}

      {tab === 'reports' && data.reports && <ReportsView data={data} />}
    </section>
  )
}

// ── Read views ──────────────────────────────────────────────────────────────

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
          {data.rates && <PersonRates name={data.name} rates={data.rates} />}
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
