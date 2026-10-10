// The page every place that is not built yet shows (navigation redesign, 22
// September 2026): Chat, Emails, the SEO tools, and the Reports and Approvals
// pages of My Hours and Clocky. Real routes rather than hidden ones, so a link
// can be shared ahead of launch and the rail shows what is coming.
//
// "Suggest what it should do" is meant to open a ticket with the tool's name.
// Tickets are a list kept in the repo that only admins see (Admin → Tickets),
// and nobody can file one from the portal yet, so the button is offered to
// admins only, and leads to that list.

import Link from 'next/link'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { NavIcon } from '@/components/NavIcon'
import { BTN, BTN_ICON } from '@/lib/ui/buttons'
import type { NavIconKey } from '@/lib/nav/nav-icons'
import type { NavHref } from '@/lib/nav/labels'

export function ComingSoon({ icon, title, description, parents, self, canSuggest = false }: {
  icon: NavIconKey
  title: string
  description: string
  /** Where the page sits, for the trail. */
  parents?: readonly NavHref[]
  /** The page is one of the named places (Chat, Emails). */
  self?: NavHref
  canSuggest?: boolean
}) {
  return (
    <div className="space-y-6">
      {self ? <Breadcrumb parents={parents} self={self} /> : <Breadcrumb parents={parents} now={title} />}
      <div className="max-w-[640px] mx-auto mt-14 rounded-2xl border border-[var(--panel-border)] bg-white px-11 py-10 flex flex-col items-center text-center gap-3.5">
        <span className="w-[68px] h-[68px] rounded-[18px] bg-[rgba(30,125,127,.1)] text-tn-teal inline-flex items-center justify-center">
          <NavIcon name={icon} size={32} strokeWidth={1.8} />
        </span>
        <span className="rounded-[5px] bg-[#fbf1cf] px-[9px] py-1 text-[10.5px] font-bold tracking-[.1em] text-[#8a6703]">COMING SOON</span>
        <h1 className="font-(family-name:--font-display) font-black text-[26px] tracking-[-.01em] text-tn-ink m-0">{title}</h1>
        <p className="text-[14px] leading-relaxed text-foreground m-0">{description}</p>
        <div className="flex gap-2.5 mt-2 flex-wrap justify-center">
          <Link href="/" className={BTN.navy}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5" /></svg>
            Back to Home
          </Link>
          {canSuggest && (
            <Link href="/admin/tickets" className={BTN.white}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4zM10 6v12" /></svg>
              Suggest what it should do
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
