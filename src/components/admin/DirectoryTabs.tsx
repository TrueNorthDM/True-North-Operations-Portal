'use client'

/**
 * DirectoryTabs — the single admin surface for the org: People, Emails, Teams,
 * and Access. Owns the shared person modal (opened from People and Emails) and
 * the "Add person" menu. Each tab renders its own manager component.
 */

import { useState } from 'react'
import Link from 'next/link'
import { PeopleManager } from './PeopleManager'
import { EmailsTab } from './EmailsTab'
import { TeamsManager, type TeamCard } from './TeamsManager'
import { AccessMatrix, type AccessRow } from './AccessMatrix'
import { PersonModal, type ModalState } from './PersonModal'
import type { PersonView, Account } from './people-types'

type Tab = 'people' | 'emails' | 'teams' | 'access'

export interface TeamOption { id: string; name: string; key: string; color: string }
export interface ProjectOption { id: string; name: string; logo: string | null }

export function DirectoryTabs({
  people,
  teamOptions,
  teamCards,
  accessRows,
  projectOptions,
  availableAccounts,
}: {
  people: PersonView[]
  teamOptions: TeamOption[]
  teamCards: TeamCard[]
  accessRows: AccessRow[]
  projectOptions: ProjectOption[]
  availableAccounts: Account[]
}) {
  const [tab, setTab] = useState<Tab>('people')
  const [modal, setModal] = useState<ModalState>(null)
  const [addMenu, setAddMenu] = useState(false)

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'people', label: 'People', count: people.length },
    { key: 'emails', label: 'Emails', count: people.length },
    { key: 'teams', label: 'Teams', count: teamCards.length },
    { key: 'access', label: 'Access', count: accessRows.length },
  ]

  return (
    <div className="space-y-6">
      {/* heading row */}
      <div className="flex items-start justify-between gap-5 flex-wrap">
        <div className="max-w-[640px]">
          <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink">People, Teams and Permissions</h1>
          <p className="mt-1.5 text-[15px] text-muted leading-relaxed">
            People, teams, and access — one place. Add or edit people, manage team membership, and grant each team access to projects.
          </p>
          <Link href="/settings#people" className="inline-flex items-center gap-1.5 mt-2.5 text-[13px] font-(family-name:--font-display) font-bold text-tn-teal hover:text-tn-primary transition-colors">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 1v22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
            Rates &amp; project assignment in Settings
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </Link>
        </div>

        {/* Add person split-button */}
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
                    <span className="block text-[11.5px] text-muted leading-snug mt-0.5">Create a record now — fill in details and access.</span>
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
                    <span className="block text-[11.5px] text-muted leading-snug mt-0.5">Guided flow — email setup, access &amp; first-week steps.</span>
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
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
              <span className={`font-(family-name:--font-display) font-extrabold text-[11px] rounded-full px-2 py-0.5 ${active ? 'text-tn-teal bg-tn-teal-soft' : 'text-muted bg-subtle'}`}>{t.count}</span>
            </button>
          )
        })}
      </div>

      {tab === 'people' && (
        <PeopleManager people={people} teamOptions={teamOptions} onOpen={id => setModal({ mode: 'view', person: people.find(p => p.id === id) ?? null })} />
      )}
      {tab === 'emails' && (
        <EmailsTab people={people} onOpen={id => setModal({ mode: 'edit', person: people.find(p => p.id === id) ?? null })} />
      )}
      {tab === 'teams' && <TeamsManager cards={teamCards} />}
      {tab === 'access' && <AccessMatrix rows={accessRows} teamOptions={teamOptions} projectOptions={projectOptions} />}

      {modal && (
        <PersonModal
          state={modal}
          setState={setModal}
          people={people}
          teamOptions={teamOptions}
          availableAccounts={availableAccounts}
        />
      )}
    </div>
  )
}
