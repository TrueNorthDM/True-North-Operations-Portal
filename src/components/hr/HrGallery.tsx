'use client'

// HrGallery: the anniversary badges as one timeline (the owner's choice, 4
// November 2026, option 1 of the mock-up): every milestone in order, each with
// today's TenureBadge small and its headcount; milestones nobody holds fade.
// The one picked grows by half (no ring, the owner's choice).
// Picking one lists its people below, one line each; a name opens their page
// when the viewer may open it (lib/directory/page-rights.ts).

import { useState } from 'react'
import Link from 'next/link'
import { Avatar } from '@/components/Avatar'
import { TenureBadge } from '@/components/TenureBadge'
import type { TeamKey } from '@/lib/directory/people-types'
import type { Milestone } from '@/lib/tenure'
import { CARD } from '@/lib/ui/type'

export interface HrHolder {
  id: string; name: string; avatarUrl: string | null; teamName: string | null; teamKey: TeamKey; color: string; tenure: string
  /** Their page, when the viewer may open it. */
  href: string | null
}
export interface HrSection { key: string; milestone: Milestone; label: string; holders: HrHolder[] }
/** The next person to complete a year, within the coming month. */
export interface HrNext { name: string; avatarUrl: string | null; color: string; years: number; inDays: number }

const short = (s: HrSection) => s.milestone.kind === 'quarter' ? `${s.milestone.value * 3}m` : s.milestone.kind === 'year' ? `${s.milestone.value}y` : ''

export function HrGallery({ quarters, years, next }: { quarters: HrSection[]; years: HrSection[]; next: HrNext | null }) {
  const all = [...quarters, ...years]
  const start = years.find(s => s.holders.length) ?? all.find(s => s.holders.length) ?? all[0]
  const [picked, setPicked] = useState(start?.key)
  const shown = all.find(s => s.key === picked) ?? start

  return (
    <section className={`${CARD} px-[22px] py-5 flex flex-col gap-4`}>
      <div className="flex items-baseline gap-2.5 flex-wrap">
        <h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink">Anniversaries</h2>
        <span className="text-[12.5px] text-[#8593a4]">Every service milestone and who holds it now. Pick one to see the people.</span>
      </div>

      {next && (
        <div className="self-start inline-flex items-center gap-2.5 rounded-full border border-[#f0e2a8] bg-[#fdf8e7] py-[5px] pl-[5px] pr-3.5 text-[13px] text-[#8a6d1a]">
          <Avatar name={next.name} avatarUrl={next.avatarUrl} size={26} color={next.color} />
          <span><b className="text-tn-ink">{next.name}</b> completes {next.years} {next.years === 1 ? 'year' : 'years'} {next.inDays === 0 ? 'today' : next.inDays === 1 ? 'tomorrow' : `in ${next.inDays} days`}.</span>
        </div>
      )}

      <div className="flex items-start overflow-x-auto [scrollbar-width:none] pb-0.5" role="tablist" aria-label="Milestones">
        {all.map((s, i) => {
          const empty = !s.holders.length
          const on = s.key === shown?.key
          return (
            <div key={s.key} className="contents">
              {i > 0 && <span className="flex-1 min-w-2.5 h-0.5 bg-[#e4e7ec] mt-8" aria-hidden="true" />}
              <button type="button" role="tab" aria-selected={on} disabled={empty} onClick={() => setPicked(s.key)}
                className={`flex flex-col items-center gap-1 px-1 bg-transparent border-0 font-[inherit] ${empty ? 'opacity-35 cursor-default' : 'cursor-pointer'}`}>
                <span className="flex items-center justify-center h-[66px]"><TenureBadge milestone={s.milestone} size={on ? 66 : 44} /></span>
                <span className="font-(family-name:--font-display) font-extrabold text-[11px] text-tn-ink">{short(s)}</span>
                <span className="text-[11px] text-[#8593a4] tabular-nums">{s.holders.length || '·'}</span>
              </button>
            </div>
          )
        })}
      </div>

      {shown && (
        <div className="border-t border-[#eceff3] pt-3" role="tabpanel">
          <div className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink mb-1">
            {shown.label} <span className="font-sans font-normal text-[12.5px] text-[#8593a4] ml-1.5">{shown.holders.length} {shown.holders.length === 1 ? 'person' : 'people'}</span>
          </div>
          <div className="flex flex-col max-w-[760px]">
            {shown.holders.map(h => {
              const body = (
                <>
                  <Avatar name={h.name} avatarUrl={h.avatarUrl} size={28} color={h.color} />
                  <span className="min-w-0 flex-1 flex items-center gap-2.5">
                    <span className="text-[13.5px] font-bold text-tn-ink truncate group-hover:text-tn-teal transition-colors">{h.name}</span>
                    {h.teamName && <span className="shrink-0 max-w-[160px] truncate font-(family-name:--font-display) font-extrabold text-[8.5px] tracking-wide uppercase rounded-full px-1.5 py-0.5" style={{ color: h.color, background: `${h.color}1a` }}>{h.teamName}</span>}
                  </span>
                  <span className="shrink-0 text-[12px] text-[#8593a4] whitespace-nowrap tabular-nums">{h.tenure}</span>
                </>
              )
              const cls = 'group flex items-center gap-2.5 py-[7px] border-t border-[#f1f3f6] first:border-t-0 text-left'
              return h.href
                ? <Link key={h.id} href={h.href} className={`${cls} rounded-[9px] hover:bg-subtle`}>{body}</Link>
                : <div key={h.id} className={cls}>{body}</div>
            })}
          </div>
        </div>
      )}
    </section>
  )
}
