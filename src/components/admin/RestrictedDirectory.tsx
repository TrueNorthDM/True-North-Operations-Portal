'use client'

/**
 * RestrictedDirectory: the People directory as seen by non-privileged tiers
 * (team_leader, user). Part 4 of "People, Teams and Permissions".
 *
 * Read-only by construction: there are no edit affordances here, so none can
 * leak to a user who shouldn't have them. Everyone sees the org LIST (name,
 * title, team, photo, contact type, status). Only people in the viewer's scope,
 * themselves, and (for a team lead) their reports + led-team members, carry a
 * `detail` block and are openable. Sensitive comp/HR fields (rate, DOB, personal
 * contacts) are never sent to this view for anyone; the server builds this lean
 * shape so nothing sensitive reaches the browser.
 */

import { useState } from 'react'
import { Avatar } from '@/components/Avatar'
import { roleTypePill, statusPill, formatDate, PILL_CLASS, TEAM_COLOR, type TeamKey } from './people-types'

export interface RestrictedPersonDetail {
  managerName: string | null
  workEmail: string | null
  phone: string | null
  location: string | null
  hireDate: string | null
  employmentType: string | null
}

export interface RestrictedPerson {
  id: string
  name: string
  title: string | null
  teamName: string | null
  teamKey: TeamKey
  avatarUrl: string | null
  roleType: string
  status: 'active' | 'inactive'
  detail: RestrictedPersonDetail | null
}

const EMPLOYMENT_LABEL: Record<string, string> = { us: 'US employee', contractor: 'Contractor' }

export function RestrictedDirectory({ people, isLead }: { people: RestrictedPerson[]; isLead: boolean }) {
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const needle = q.trim().toLowerCase()
  const rows = needle
    ? people.filter(p =>
        p.name.toLowerCase().includes(needle) ||
        (p.title ?? '').toLowerCase().includes(needle) ||
        (p.teamName ?? '').toLowerCase().includes(needle))
    : people
  const open = openId ? people.find(p => p.id === openId) ?? null : null

  return (
    <div className="space-y-6">
      <div className="max-w-[640px]">
        <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink">People</h1>
        <p className="mt-1.5 text-[15px] text-muted leading-relaxed">
          The company directory. Open your own {isLead ? 'and your team’s ' : ''}profile for full details, everyone else shows name, role, and team.
        </p>
      </div>

      <input
        type="text"
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Search people…"
        className="w-full max-w-[420px] text-[14px] text-tn-ink bg-white border border-slate-200 rounded-[12px] px-4 py-2.5 focus:outline-none focus:border-tn-teal focus:ring-2 focus:ring-tn-teal/20"
      />

      <div className="border border-slate-200 bg-white rounded-[16px] overflow-hidden shadow-[0_1px_2px_rgba(1,35,88,.06)]">
        {rows.length === 0 && <div className="px-[22px] py-[52px] text-center text-sm text-muted">No one matches “{q}”.</div>}
        {rows.map((p, i) => {
          const rp = roleTypePill(p.roleType)
          const sp = statusPill(p.status === 'active')
          const openable = p.detail !== null
          return (
            <div
              key={p.id}
              role={openable ? 'button' : undefined}
              tabIndex={openable ? 0 : undefined}
              onClick={openable ? () => setOpenId(p.id) : undefined}
              onKeyDown={openable ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenId(p.id) } } : undefined}
              className={`flex items-center gap-3.5 px-[22px] py-3 ${i === 0 ? '' : 'border-t border-slate-200'} ${openable ? 'cursor-pointer hover:bg-subtle transition-colors' : ''}`}
            >
              <Avatar name={p.name} avatarUrl={p.avatarUrl} size={36} color={TEAM_COLOR[p.teamKey]} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-foreground truncate">{p.name}</span>
                  <span className={`font-(family-name:--font-display) font-extrabold text-[9px] tracking-wide uppercase rounded-full px-2 py-0.5 shrink-0 ${PILL_CLASS[rp.kind]}`}>{rp.label}</span>
                </span>
                <span className="block text-[12.5px] text-muted truncate">{p.title ?? '-'}</span>
              </span>
              <span className="hidden sm:block text-[12.5px] text-muted truncate max-w-[160px]">{p.teamName ?? '-'}</span>
              <span className={`font-(family-name:--font-display) font-extrabold text-[9px] tracking-wide uppercase rounded-full px-2 py-0.5 shrink-0 ${PILL_CLASS[sp.kind]}`}>{sp.label}</span>
              {openable && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-slate-300 shrink-0"><path d="M9 18l6-6-6-6" /></svg>
              )}
            </div>
          )
        })}
      </div>

      {open && open.detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-tn-ink/40" onClick={() => setOpenId(null)} />
          <div className="relative w-full max-w-[420px] bg-white rounded-[18px] shadow-[0_30px_70px_-20px_rgba(1,35,88,.5)] overflow-hidden">
            <div className="px-6 pt-6 pb-5 flex items-center gap-3.5 border-b border-slate-100">
              <Avatar name={open.name} avatarUrl={open.avatarUrl} size={52} color={TEAM_COLOR[open.teamKey]} />
              <div className="min-w-0">
                <h2 className="font-(family-name:--font-display) font-extrabold text-[18px] text-tn-ink m-0 truncate">{open.name}</h2>
                <p className="text-[13px] text-muted mt-0.5 truncate">{open.title ?? '-'}</p>
              </div>
              <button type="button" onClick={() => setOpenId(null)} aria-label="Close" className="ml-auto shrink-0 inline-flex w-8 h-8 items-center justify-center rounded-[9px] text-muted hover:bg-subtle hover:text-tn-ink transition-colors">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <dl className="px-6 py-4 text-[13.5px]">
              <DetailRow label="Team" value={open.teamName} />
              <DetailRow label="Manager" value={open.detail.managerName} />
              <DetailRow label="Work email" value={open.detail.workEmail} />
              <DetailRow label="Phone" value={open.detail.phone} />
              <DetailRow label="Location" value={open.detail.location} />
              <DetailRow label="Employment" value={open.detail.employmentType ? EMPLOYMENT_LABEL[open.detail.employmentType] ?? open.detail.employmentType : null} />
              <DetailRow label="Start date" value={formatDate(open.detail.hireDate)} />
            </dl>
          </div>
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-50 last:border-0">
      <dt className="text-muted shrink-0">{label}</dt>
      <dd className="font-semibold text-foreground text-right min-w-0 truncate">{value || '-'}</dd>
    </div>
  )
}
