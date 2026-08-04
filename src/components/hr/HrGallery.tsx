'use client'

// HrGallery: the badge gallery + in-place person card. Each milestone card puts
// the (double-size) badge on the left and the label / headcount on the right;
// each holder is a button that opens their PersonModal right here, no navigation.

import { useState } from 'react'
import { Avatar } from '@/components/Avatar'
import { TenureBadge } from '@/components/TenureBadge'
import { PersonModal, type ModalState } from '@/components/admin/PersonModal'
import { TEAM_COLOR, type PersonView, type Account, type TeamKey } from '@/lib/directory/people-types'
import type { TeamOption } from '@/components/admin/DirectoryTabs'
import type { Milestone } from '@/lib/tenure'

export interface HrHolder { id: string; name: string; avatarUrl: string | null; teamName: string | null; teamKey: TeamKey; tenure: string }
export interface HrSection { key: string; milestone: Milestone; label: string; holders: HrHolder[] }

export function HrGallery({ quarters, years, people, teamOptions, availableAccounts }: {
  quarters: HrSection[]
  years: HrSection[]
  people: PersonView[]
  teamOptions: TeamOption[]
  availableAccounts: Account[]
}) {
  const [modal, setModal] = useState<ModalState>(null)
  const activePeople = people.filter(p => p.status === 'active')
  const open = (id: string) => setModal({ mode: 'view', person: people.find(p => p.id === id) ?? null })

  const card = (s: HrSection) => (
    <div key={s.key} className="rounded-[16px] border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(1,35,88,.06)]">
      <div className="flex items-center justify-between gap-3">
        <TenureBadge milestone={s.milestone} size={128} />
        <div className="text-right">
          <div className="font-(family-name:--font-display) font-extrabold text-[32px] leading-none text-tn-ink">{s.label}</div>
          <div className="text-[12px] text-muted mt-1.5">{s.holders.length} {s.holders.length === 1 ? 'person' : 'people'}</div>
        </div>
      </div>
      {s.holders.length === 0 ? (
        <p className="text-[12px] text-muted italic mt-3">No one yet</p>
      ) : (
        <div className="mt-3 flex flex-col gap-0.5 border-t border-slate-100 pt-3">
          {s.holders.map(h => (
            <button key={h.id} type="button" onClick={() => open(h.id)} className="group flex items-center gap-2.5 rounded-[9px] -mx-1 px-1 py-1 text-left transition-colors hover:bg-subtle">
              <Avatar name={h.name} avatarUrl={h.avatarUrl} size={28} color={TEAM_COLOR[h.teamKey]} />
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-semibold text-tn-ink truncate group-hover:text-tn-teal transition-colors">{h.name}</span>
                {h.teamName && (
                  <span className="inline-block mt-0.5 max-w-full truncate font-(family-name:--font-display) font-extrabold text-[8.5px] tracking-wide uppercase rounded-full px-1.5 py-0.5" style={{ color: TEAM_COLOR[h.teamKey], background: `${TEAM_COLOR[h.teamKey]}1a` }}>{h.teamName}</span>
                )}
              </span>
              <span className="shrink-0 text-[11px] text-muted whitespace-nowrap tabular-nums">{h.tenure}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <>
      <section>
        <div className="flex items-center gap-2.5 mb-3.5">
          <h2 className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">First year</h2>
          <span className="text-[12.5px] text-muted">quarterly milestones</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">{quarters.map(card)}</div>
      </section>

      <section>
        <h2 className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink mb-3.5">Years of service</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">{years.map(card)}</div>
      </section>

      {modal && <PersonModal state={modal} setState={setModal} people={activePeople} teamOptions={teamOptions} availableAccounts={availableAccounts} />}
    </>
  )
}
