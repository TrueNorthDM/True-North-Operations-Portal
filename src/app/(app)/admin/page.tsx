// Admin: hub for the portal's admin tools (Tickets, Tests, System manual,
// Directory). Server-guarded: only portal admins reach it; everyone else is
// redirected home. Card layout + animated icons match the handoff prototype.

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { isCurrentUserAdmin } from '@/lib/auth/role'
import { SystemHealthBanner } from '@/components/admin/SystemHealthBanner'

// Each card's icon is a system-style line SVG whose animated parts carry the
// `tn-anim` class (so prefers-reduced-motion disables them via globals.css).
const OpenArrow = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14" />
    <path d="m13 6 6 6-6 6" />
  </svg>
)

// Ticket: the whole glyph bobs; the punch-hole dot pulses.
const TicketsIcon = (
  <svg className="tn-anim w-[22px] h-[22px]" style={{ animation: 'tn-ico-bob 2.8s ease-in-out infinite' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L3 13V4a1 1 0 0 1 1-1h9l7.59 7.59a2 2 0 0 1 0 2.82z" />
    <circle className="tn-anim" cx="7.5" cy="7.5" r="1.6" fill="currentColor" stroke="none" style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'tn-dot-pulse 2.8s ease-in-out infinite' }} />
  </svg>
)

// Clipboard: the checkmark draws itself in on a loop.
const TestsIcon = (
  <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 4H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" />
    <rect x="9" y="2.5" width="6" height="4" rx="1" />
    <path className="tn-anim" d="m8.5 13.5 2.2 2.2 4.3-4.6" strokeWidth="2.2" style={{ strokeDasharray: 26, animation: 'tn-check-draw 2.8s ease-in-out infinite' }} />
  </svg>
)

// Book: the left page gently swings on its spine.
const ManualIcon = (
  <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <g className="tn-anim" style={{ transformBox: 'fill-box', transformOrigin: 'bottom center', animation: 'tn-ico-swing 3.4s ease-in-out infinite' }}>
      <path d="M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2z" />
    </g>
    <path d="M12 6.5C13.5 5 16 4.5 20 4.5v13c-4 0-6.5.5-8 2z" />
    <path d="M12 6.5v13" />
  </svg>
)

// View Stage, three panels; the middle one pulses (a live preview).
const StageIcon = (
  <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="5" height="16" rx="1" />
    <rect x="9.5" y="4" width="5" height="16" rx="1" className="tn-anim" style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'tn-dot-pulse 2.8s ease-in-out infinite' }} />
    <rect x="16" y="4" width="5" height="16" rx="1" />
  </svg>
)

// Automations: a lightning bolt whose fill pulses (a live signal).
const AutomationsIcon = (
  <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path className="tn-anim" d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'tn-dot-pulse 2.8s ease-in-out infinite' }} />
  </svg>
)

// Shield with a key-hole; the shield outline draws itself in on a loop.
const AccessIcon = (
  <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path className="tn-anim" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" style={{ strokeDasharray: 62, animation: 'tn-check-draw 3.4s ease-in-out infinite' }} />
    <circle cx="12" cy="11" r="1.7" />
    <path d="M12 12.7V15" />
  </svg>
)

// Finished and in daily use.
const ACTIVE = [
  { href: '/admin/access-levels', title: 'Access levels', icon: AccessIcon, description: 'The four access levels, what each one can see, and who has it today.' },
  { href: '/admin/view-stage', title: 'View Stage', icon: StageIcon, description: 'Preview the portal through each access level (admin, team leader, user) side by side.' },
] as const

// Usable, but still being built out. Grouped separately so the finished tools
// above are not mistaken for work in progress.
const IN_CONSTRUCTION = [
  { href: '/admin/tickets', title: 'Tickets', icon: TicketsIcon, description: 'The dev work tracker, everything we need to resolve, so nothing gets lost.' },
  { href: '/admin/tests', title: 'Tests', icon: TestsIcon, description: 'A checklist to verify the whole system end-to-end, tick off what works.' },
  { href: '/admin/automations', title: 'Automations', icon: AutomationsIcon, description: 'Every webhook and scheduled job, with live health so an outage surfaces fast.' },
  { href: '/admin/manual', title: 'System manual', icon: ManualIcon, description: 'How the portal works, pages, access, and how Monday feeds it.' },
] as const

type AdminCard = (typeof ACTIVE)[number] | (typeof IN_CONSTRUCTION)[number]

function CardGrid({ cards }: { cards: readonly AdminCard[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(card => (
        <Link
          key={card.href}
          href={card.href}
          className="group rounded-2xl border border-slate-200 bg-white p-[22px] shadow-sm transition-all hover:-translate-y-[3px] hover:border-tn-teal hover:shadow-md"
        >
          <div className="flex items-start justify-between gap-2.5">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-tn-teal-soft text-tn-teal">
              {card.icon}
            </span>
            <span className="inline-flex items-center gap-1 font-(family-name:--font-display) font-extrabold text-[13px] text-tn-teal whitespace-nowrap">
              Open
              <span className="transition-transform group-hover:translate-x-0.5">{OpenArrow}</span>
            </span>
          </div>
          <h2 className="mt-4 font-(family-name:--font-display) font-extrabold text-[19px] text-tn-ink">{card.title}</h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{card.description}</p>
        </Link>
      ))}
    </div>
  )
}

export default async function AdminPage() {
  if (!(await isCurrentUserAdmin())) redirect('/')

  return (
    <div className="space-y-10">
      <SystemHealthBanner />
      <div>
        <div className="flex items-center gap-2 text-sm text-muted mb-2">
          <Link href="/" className="font-semibold hover:text-tn-ink transition-colors">Dashboard</Link>
          <span className="text-slate-300">/</span>
          <span className="font-semibold text-tn-ink">Admin</span>
        </div>
        <h1 className="text-2xl font-(family-name:--font-display) font-extrabold tracking-tight text-tn-ink">Admin</h1>
        <p className="mt-1.5 text-muted">People, teams, and who can access what.</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Active</h2>
        <CardGrid cards={ACTIVE} />
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">In construction</h2>
        <CardGrid cards={IN_CONSTRUCTION} />
      </section>

      <p className="text-[13px] leading-relaxed text-muted">
        Access model: each person has one <strong className="font-bold text-foreground">access level</strong>, which decides the
        pages they reach, and the <strong className="font-bold text-foreground">teams</strong> they belong to decide which tools
        appear inside them. Levels are set above; teams and their tools on the Directory.
      </p>
    </div>
  )
}
