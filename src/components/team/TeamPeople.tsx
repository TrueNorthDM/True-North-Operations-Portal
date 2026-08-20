'use client'

/**
 * My Team, the People list, built to screen 1.3 of the handoff.
 *
 * A separate component from RestrictedDirectory rather than a restyle of it:
 * that one also draws the Directory at level 3, where a row carries more and
 * every card opens. Two screens with different jobs were sharing one set of
 * classes, and the handoff only redraws this one.
 *
 * Only the viewer's own card opens at levels 1 and 2, which is why the chevron
 * appears on exactly one row: it points at the thing that can be pressed.
 */

import { useState } from 'react'
import { SearchField } from '@/components/ui/SearchField'
import { roleTypePill } from '@/lib/directory/people-types'
import { ProfileCard, type RestrictedPerson, type FullProfile } from '@/components/admin/RestrictedDirectory'

// The pill shape the handoff uses for both role and status: 9px, uppercase,
// fully round, and never allowed to grow with its row.
const PILL = 'inline-flex items-center shrink-0 font-(family-name:--font-display) font-extrabold text-[9px] tracking-[.05em] uppercase rounded-full px-2 py-[3px]'

/** Avatar colours follow the person's team, as everywhere else in the portal. */
const AVATAR_COLOUR: Record<string, string> = {
  seo: '#1E7D7F',
  writing: '#579BFC',
  graphics: '#7c3aed',
  web: '#012358',
  other: '#012358',
}

const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase()

export function TeamPeople({
  people, selfId, profiles,
}: {
  people: RestrictedPerson[]
  selfId: string | null
  /** Full cards for the people this viewer may open, keyed by person id. */
  profiles?: Record<string, FullProfile>
}) {
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const open = openId ? people.find(p => p.id === openId) ?? null : null

  const needle = q.trim().toLowerCase()
  const shown = needle
    ? people.filter(p => `${p.name} ${p.title ?? ''} ${p.teamName ?? ''}`.toLowerCase().includes(needle))
    : people

  return (
    <div>
      <SearchField
        value={q}
        onChange={setQ}
        placeholder="Search people…"
        className="w-full sm:w-[420px] mb-4"
      />

      <div className="border border-[#e4e7ec] bg-white rounded-[16px] overflow-hidden shadow-[0_1px_2px_rgba(1,35,88,.06)]">
        {shown.length === 0 && (
          <div className="px-[22px] py-13 text-center text-[13px] text-muted">No one matches “{q}”.</div>
        )}

        {shown.map((p, i) => {
          const role = roleTypePill(p.roleType)
          const active = p.status === 'active'
          const self = p.id === selfId
          // Openable and "is me" are the same thing at these levels, but they
          // are asked separately: the row opens because there is a card to
          // open, not because of who it belongs to.
          const openable = p.detail !== null

          return (
            <div
              key={p.id}
              onClick={() => { if (openable) setOpenId(p.id) }}
              className={`flex items-center gap-3.5 px-[22px] py-3 transition-colors ${i > 0 ? 'border-t border-[#eceff3]' : ''} ${
                openable ? 'cursor-pointer hover:bg-[#f8f7f3]' : ''
              }`}
            >
              <span
                className="inline-flex shrink-0 w-9 h-9 rounded-full items-center justify-center font-(family-name:--font-display) font-extrabold text-[12.5px] text-white"
                style={{ background: AVATAR_COLOUR[p.teamKey] ?? AVATAR_COLOUR.other }}
              >
                {initialsOf(p.name)}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 flex-wrap">
                  <span className="text-[14px] font-semibold text-tn-ink">{p.name}</span>
                  <span className={`${PILL} bg-[#eef2f7] text-[#5b6b82]`}>{role.label}</span>
                  {self && <span className={`${PILL} bg-[rgba(30,125,127,.12)] text-tn-teal`}>You</span>}
                </span>
                <span className="block text-[12.5px] text-muted mt-0.5">{p.title ?? '-'}</span>
              </span>

              <span className="text-[12.5px] text-muted w-40 shrink-0">{p.teamName ?? '-'}</span>

              <span className={`${PILL} ${active ? 'bg-[#e6f6ee] text-[#0d7a4f]' : 'bg-[#f1f3f6] text-muted'}`}>
                {active ? 'Active' : 'Inactive'}
              </span>

              {/* Present only where there is somewhere to go. */}
              <span className="shrink-0 w-4 text-[#cbd2da] inline-flex justify-end">
                {openable && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                )}
              </span>
            </div>
          )
        })}
      </div>

      {/* The same card the Directory and My profile open, so a person sees one
          profile everywhere rather than three that drifted apart. */}
      {open && profiles?.[open.id] && (
        <ProfileCard profile={profiles[open.id]} isSelf={open.id === selfId} onClose={() => setOpenId(null)} />
      )}
    </div>
  )
}
