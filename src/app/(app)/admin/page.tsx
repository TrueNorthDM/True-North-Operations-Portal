// Admin — hub for the portal's admin tools (Tickets, Tests, System manual,
// Directory). Server-guarded: only portal admins reach it; everyone else is
// redirected home. Card layout + animated icons match the handoff prototype.

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { isCurrentUserAdmin } from '@/lib/auth/role'

// Each card's icon is a system-style line SVG whose animated parts carry the
// `tn-anim` class (so prefers-reduced-motion disables them via globals.css).
const OpenArrow = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14" />
    <path d="m13 6 6 6-6 6" />
  </svg>
)

// Ticket — the whole glyph bobs; the punch-hole dot pulses.
const TicketsIcon = (
  <svg className="tn-anim w-[22px] h-[22px]" style={{ animation: 'tn-ico-bob 2.8s ease-in-out infinite' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L3 13V4a1 1 0 0 1 1-1h9l7.59 7.59a2 2 0 0 1 0 2.82z" />
    <circle className="tn-anim" cx="7.5" cy="7.5" r="1.6" fill="currentColor" stroke="none" style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'tn-dot-pulse 2.8s ease-in-out infinite' }} />
  </svg>
)

// Clipboard — the checkmark draws itself in on a loop.
const TestsIcon = (
  <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 4H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" />
    <rect x="9" y="2.5" width="6" height="4" rx="1" />
    <path className="tn-anim" d="m8.5 13.5 2.2 2.2 4.3-4.6" strokeWidth="2.2" style={{ strokeDasharray: 26, animation: 'tn-check-draw 2.8s ease-in-out infinite' }} />
  </svg>
)

// Book — the left page gently swings on its spine.
const ManualIcon = (
  <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <g className="tn-anim" style={{ transformBox: 'fill-box', transformOrigin: 'bottom center', animation: 'tn-ico-swing 3.4s ease-in-out infinite' }}>
      <path d="M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2z" />
    </g>
    <path d="M12 6.5C13.5 5 16 4.5 20 4.5v13c-4 0-6.5.5-8 2z" />
    <path d="M12 6.5v13" />
  </svg>
)

// People — two figures split apart while a third fades in between (2 → 3),
// the same motion as the Home "My Team" widget.
const DirectoryIcon = (
  <svg className="w-[22px] h-[22px]" style={{ overflow: 'visible' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <g className="tn-anim" style={{ animation: 'tn-split-left 3s ease-in-out infinite' }}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
    </g>
    <g className="tn-anim" style={{ animation: 'tn-split-right 3s ease-in-out infinite' }}>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </g>
    <g style={{ transform: 'translateX(3px)' }}>
      <g className="tn-anim" style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'tn-appear 3s ease-in-out infinite' }}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
      </g>
    </g>
  </svg>
)

// Board — a table whose top row sweeps in, hinting a live-synced grid.
const TeamBoardIcon = (
  <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M9 4v16M3 9.5h18" />
    <path className="tn-anim" style={{ animation: 'tn-appear 3s ease-in-out infinite' }} d="M3 14.5h18" />
  </svg>
)

const CARDS = [
  { href: '/admin/team', title: 'True North Team', icon: TeamBoardIcon, description: 'The whole team, mirrored live from the Monday board — the same groups, columns and status, always current.' },
  { href: '/admin/tickets', title: 'Tickets', icon: TicketsIcon, description: 'The dev work tracker — everything we need to resolve, so nothing gets lost.' },
  { href: '/admin/tests', title: 'Tests', icon: TestsIcon, description: 'A checklist to verify the whole system end-to-end — tick off what works.' },
  { href: '/admin/manual', title: 'System manual', icon: ManualIcon, description: 'How the portal works — pages, access, and how Monday feeds it.' },
  { href: '/admin/directory', title: 'Directory', icon: DirectoryIcon, description: 'People, teams, and access — one place. Add/edit people (with their TSheets link), manage team membership, and grant each team access to projects.' },
] as const

export default async function AdminPage() {
  if (!(await isCurrentUserAdmin())) redirect('/')

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 text-sm text-muted mb-2">
          <Link href="/" className="font-semibold hover:text-tn-ink transition-colors">Dashboard</Link>
          <span className="text-slate-300">/</span>
          <span className="font-semibold text-tn-ink">Admin</span>
        </div>
        <h1 className="text-2xl font-(family-name:--font-display) font-extrabold tracking-tight text-tn-ink">Admin</h1>
        <p className="mt-1.5 text-muted">People, teams, and who can access what.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {CARDS.map(card => (
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

      <p className="text-[13px] leading-relaxed text-muted">
        Access model: people join <strong className="font-bold text-foreground">teams</strong>, teams are granted access to{' '}
        <strong className="font-bold text-foreground">projects</strong> with a role — all managed from the Directory.
      </p>
    </div>
  )
}
