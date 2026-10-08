'use client'

// HrGallery: the badge gallery. Each milestone card puts the (double-size) badge
// on the left and the label / headcount on the right; a holder's name opens
// their page when the viewer may open it (lib/directory/page-rights.ts).

import Link from 'next/link'
import { Avatar } from '@/components/Avatar'
import { TenureBadge } from '@/components/TenureBadge'
import type { TeamKey } from '@/lib/directory/people-types'
import type { Milestone } from '@/lib/tenure'

export interface HrHolder {
  id: string; name: string; avatarUrl: string | null; teamName: string | null; teamKey: TeamKey; color: string; tenure: string
  /** Their page, when the viewer may open it. */
  href: string | null
}
export interface HrSection { key: string; milestone: Milestone; label: string; holders: HrHolder[] }

export function HrGallery({ quarters, years }: {
  quarters: HrSection[]
  years: HrSection[]
}) {
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
          {s.holders.map(h => {
            const body = (
              <>
              <Avatar name={h.name} avatarUrl={h.avatarUrl} size={28} color={h.color} />
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-semibold text-tn-ink truncate group-hover:text-tn-teal transition-colors">{h.name}</span>
                {h.teamName && (
                  <span className="inline-block mt-0.5 max-w-full truncate font-(family-name:--font-display) font-extrabold text-[8.5px] tracking-wide uppercase rounded-full px-1.5 py-0.5" style={{ color: h.color, background: `${h.color}1a` }}>{h.teamName}</span>
                )}
              </span>
              <span className="shrink-0 text-[11px] text-muted whitespace-nowrap tabular-nums">{h.tenure}</span>
              </>
            )
            const cls = 'group flex items-center gap-2.5 rounded-[9px] -mx-1 px-1 py-1 text-left transition-colors'
            return h.href
              ? <Link key={h.id} href={h.href} className={`${cls} hover:bg-subtle`}>{body}</Link>
              : <div key={h.id} className={cls}>{body}</div>
          })}
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

    </>
  )
}
