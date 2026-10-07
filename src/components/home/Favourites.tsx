// Favourites on Home (7 October 2026): up to five pages each person picks in
// Settings, Home and start, in their order, at the top of Home. Only pages
// they can still open are shown (resolveFavourites). With none chosen, one
// quiet line says where to pick them. Server component.

import Link from 'next/link'
import { NavIcon } from '@/components/NavIcon'
import type { NavItem } from '@/lib/access/nav'

export function Favourites({ items }: { items: readonly NavItem[] }) {
  if (!items.length) {
    return (
      <p className="text-[13px] text-muted m-0">
        Pin up to five pages you use most to the top of Home in{' '}
        <Link href="/settings#home" className="font-semibold text-tn-teal hover:text-tn-ink">Settings</Link>.
      </p>
    )
  }
  return (
    <section aria-label="Your favourites" className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-(family-name:--font-display) font-extrabold text-[13px] tracking-[.1em] uppercase text-muted m-0">Your favourites</h2>
        <Link href="/settings#home" className="text-[12.5px] font-semibold text-tn-teal hover:text-tn-ink">Edit</Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {items.map(it => (
          <Link key={it.key} href={it.href}
            className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 transition-all hover:border-tn-teal hover:-translate-y-px hover:shadow-[0_8px_20px_-12px_rgba(1,35,88,.35)]">
            <span className="w-9 h-9 rounded-[10px] shrink-0 inline-flex items-center justify-center bg-[rgba(30,125,127,.1)] text-tn-teal group-hover:bg-tn-teal group-hover:text-[#ffffff] transition-colors">
              <NavIcon name={it.icon} size={18} />
            </span>
            <span className="min-w-0 font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink leading-snug">{it.label}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
