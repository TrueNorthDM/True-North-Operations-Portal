'use client'

/**
 * DirectoryTabs: the single admin surface for the org: People, Emails, Teams,
 * and Access. Owns the shared person modal (opened from People and Emails) and
 * the "Add person" menu. Each tab renders its own manager component.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { personHref } from '@/lib/directory/page-rights'
import { withViewAs } from '@/components/ViewAsKeeper'
import { PeopleManager } from './PeopleManager'
import { EmailsTab } from './EmailsTab'
import { TeamsManager, type TeamCard } from './TeamsManager'
import { RatesCostsTab } from './RatesCostsTab'
import { AccessLogManager, type AccessLogEntry } from './AccessLogManager'
import { PortalAccessTab } from './PortalAccessTab'
import { PersonModal, type ModalState } from './PersonModal'
import type { PersonView, CardRights } from '@/lib/directory/people-types'
import type { PersonWithAssignments } from '@/components/tsheets/settings/PeopleTab'

type Tab = 'people' | 'emails' | 'teams' | 'rates' | 'access' | 'portal'

export interface TeamOption { id: string; name: string; key: string; color: string }
export interface ProjectOption { id: string; name: string; logo: string | null }

export function DirectoryTabs({
  people,
  teamOptions,
  teamCards,
  rights,
  ratesPeople,
  ratesClients,
  accessLog,
  allowed,
}: {
  people: PersonView[]
  teamOptions: TeamOption[]
  teamCards: TeamCard[]
  rights: CardRights
  ratesPeople: PersonWithAssignments[]
  ratesClients: { id: number; name: string }[]
  accessLog: AccessLogEntry[]
  /** The tabs this person's access opens (People always); every tab when omitted. */
  allowed?: readonly string[]
}) {
  const [tab, setTab] = useState<Tab>('people')
  // Deep-link: open a person's card on mount when ?open=<id> was passed.
  const router = useRouter()
  // The popup is for adding someone; everyone else opens on their own page.
  const [modal, setModal] = useState<ModalState>(null)
  const [addMenu, setAddMenu] = useState(false)

  // Inactive people live only on the People tab; every other surface (Emails,
  // Teams, the person modal's manager picker) sees actives only.
  const activePeople = people.filter(p => p.status === 'active')
  // Two-step sign-in by person, once it is loaded (migration 090); null leaves
  // the column out of the Portal access tab.
  const twoStep = people.some(p => p.twoStepSince !== undefined)
    ? Object.fromEntries(people.filter(p => p.accountId).map(p => [p.id, p.twoStepSince ? 'on' as const : 'none' as const]))
    : null

  const allTabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'people', label: 'People', count: people.length },
    { key: 'emails', label: 'Emails', count: activePeople.length },
    { key: 'teams', label: 'Teams', count: teamCards.length },
    { key: 'rates', label: 'Rates & Costs' },
    { key: 'access', label: 'Access log', count: accessLog.length },
    { key: 'portal', label: 'Portal access', count: activePeople.length },
  ]
  const tabs = allTabs.filter(t => t.key === 'people' || !allowed || allowed.includes(t.key))

  return (
    <div className="space-y-6">
      {/* heading row */}
      <div className="flex items-start justify-between gap-5 flex-wrap">
        <div className="max-w-[880px]">
          <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink">Directory</h1>
          <p className="mt-1.5 text-[15px] text-muted leading-relaxed">
            Add or edit people, and manage teams and who is in them.
          </p>
        </div>

        {/* Add person split-button, People is the only tab where a person can be
            created, so the control only appears there. */}
        {tab === 'people' && rights.edit && (
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setAddMenu(v => !v)}
            className="inline-flex items-center gap-2.5 font-(family-name:--font-display) font-extrabold text-[13.5px] text-white bg-tn-primary rounded-[10px] px-[18px] py-[11px] shadow-[0_10px_24px_-12px_rgba(1,35,88,.7)] transition-all hover:brightness-110 hover:-translate-y-px"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#F2C40A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></svg>
            <span className="text-[#ffffff]">Add person</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
          </button>

          {addMenu && (
            <>
              <div onClick={() => setAddMenu(false)} className="fixed inset-0 z-40" />
              <div className="absolute top-[calc(100%+8px)] right-0 z-[41] w-80 bg-white border border-slate-200 rounded-[14px] shadow-[0_24px_50px_-20px_rgba(1,35,88,.4)] p-2">
                <div className="font-(family-name:--font-display) font-extrabold text-[9.5px] tracking-[.1em] uppercase text-muted px-2.5 pt-2 pb-1.5">Add someone</div>
                <button
                  type="button"
                  onClick={() => { setAddMenu(false); setModal({ mode: 'edit', person: null }) }}
                  className="group flex items-start gap-3 w-full text-left border border-slate-200 rounded-[10px] px-3 py-[11px] mb-1.5 transition-all hover:border-tn-teal hover:bg-subtle"
                >
                  <span className="shrink-0 w-[30px] h-[30px] rounded-lg bg-tn-teal-soft inline-flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1E7D7F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></svg>
                  </span>
                  <span className="min-w-0">
                    <span className="block font-(family-name:--font-display) font-extrabold text-[13.5px] text-tn-ink">Add person</span>
                    <span className="block text-[11.5px] text-muted leading-snug mt-0.5">Create a record now, fill in details and access.</span>
                  </span>
                </button>
                <div className="flex items-start gap-3 w-full text-left border border-slate-200 rounded-[10px] px-3 py-[11px] opacity-70">
                  <span className="shrink-0 w-[30px] h-[30px] rounded-lg bg-amber-50 inline-flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B8790A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 font-(family-name:--font-display) font-extrabold text-[13.5px] text-tn-ink">
                      Start onboarding
                      <span className="font-(family-name:--font-display) font-extrabold text-[8.5px] tracking-wide uppercase text-muted bg-subtle rounded-full px-[7px] py-0.5">Soon</span>
                    </span>
                    <span className="block text-[11.5px] text-muted leading-snug mt-0.5">Guided flow, email setup, access &amp; first-week steps.</span>
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
        )}
      </div>

      {/* tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map(t => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative inline-flex items-center gap-2 font-(family-name:--font-display) font-extrabold text-sm px-1.5 py-3 mr-5 -mb-px transition-colors ${
                active ? 'text-tn-ink border-b-[2.5px] border-tn-teal' : 'text-muted border-b-[2.5px] border-transparent hover:text-tn-ink'
              }`}
            >
              {t.label}
              {t.count !== undefined && <span className={`font-(family-name:--font-display) font-extrabold text-[11px] rounded-full px-2 py-0.5 ${active ? 'text-tn-teal bg-tn-teal-soft' : 'text-muted bg-subtle'}`}>{t.count}</span>}
            </button>
          )
        })}
      </div>

      {tab === 'people' && (
        <div className="space-y-5">
          {/* Source-of-truth notice, People feeds every other surface. */}
          <div className="flex items-start gap-3.5 rounded-[16px] border border-tn-teal/25 bg-tn-teal-soft px-5 py-4">
            <span className="shrink-0 mt-0.5 inline-flex w-9 h-9 items-center justify-center rounded-[11px] bg-white text-tn-teal shadow-[0_1px_2px_rgba(1,35,88,.08)]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
            </span>
            <div className="min-w-0">
              <div className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">People is the source of truth</div>
              <p className="text-[13px] text-foreground leading-relaxed mt-1">
                Add or edit someone once here, their name, team, reporting line and teams flow everywhere else. These all read from People:
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {['Emails', 'Teams', 'Access', 'Rates & Costs', 'Org chart', 'Profiles', 'i7 Budget Report', 'My Work'].map(x => (
                  <span key={x} className="font-(family-name:--font-display) font-bold text-[11px] text-tn-teal bg-white border border-tn-teal/20 rounded-full px-2.5 py-1">{x}</span>
                ))}
              </div>
            </div>
          </div>
          <PeopleManager people={people} teamOptions={teamOptions} onOpen={id => router.push(withViewAs(personHref(id)))} />
        </div>
      )}
      {tab === 'emails' && (
        <EmailsTab people={activePeople} onOpen={id => router.push(withViewAs(personHref(id, 'work')))} />
      )}
      {tab === 'teams' && <TeamsManager cards={teamCards} people={activePeople} />}
      {tab === 'rates' && <RatesCostsTab people={ratesPeople} allClients={ratesClients} />}
      {tab === 'access' && <AccessLogManager entries={accessLog} />}
      {tab === 'portal' && (
        <PortalAccessTab people={activePeople} twoStep={twoStep} canInvite={rights.invite} onOpen={id => router.push(withViewAs(personHref(id, 'hr')))} />
      )}

      {modal && (
        <PersonModal
          state={modal}
          setState={setModal}
          people={activePeople}
          teamOptions={teamOptions}
        />
      )}
    </div>
  )
}
