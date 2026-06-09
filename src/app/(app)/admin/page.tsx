// Admin — access control hub (People · Teams · Access). Server-guarded: only
// portal admins reach it; everyone else is redirected home. The three sections
// are previewed here but land in a later phase (F2/F3) — this page documents
// the structure so the direction is visible in-product.

import { redirect } from 'next/navigation'
import { isCurrentUserAdmin } from '@/lib/auth/role'

const SECTIONS: { title: string; description: string; href?: string }[] = [
  {
    title: 'People',
    description: 'The company directory — add/edit people, set titles and reporting lines (drives the org chart).',
    href: '/admin/people',
  },
  {
    title: 'Teams',
    description: 'Group people into teams and grant each team access to projects, with a role (Admin / Member / Viewer).',
    href: '/admin/teams',
  },
  {
    title: 'Access',
    description: 'A bird’s-eye matrix of which teams can reach which projects, for review and auditing.',
  },
]

export default async function AdminPage() {
  if (!(await isCurrentUserAdmin())) redirect('/')

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
          <a href="/" className="hover:text-slate-800">Dashboard</a>
          <span>/</span>
          <span>Admin</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Admin</h1>
        <p className="mt-1 text-slate-500">People, teams, and who can access what.</p>
      </div>

      {/* Tickets — live now. */}
      <a
        href="/admin/tickets"
        className="group block rounded-xl border-2 border-slate-200 bg-white p-6 transition-all hover:border-slate-300 hover:shadow-md"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-slate-900 group-hover:text-slate-700">Tickets</h2>
          <span className="shrink-0 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">
            Open <span aria-hidden="true">→</span>
          </span>
        </div>
        <p className="mt-1.5 text-sm text-slate-500">
          The dev work tracker — everything we need to resolve, so nothing gets lost.
        </p>
      </a>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {SECTIONS.map(s =>
          s.href ? (
            <a
              key={s.title}
              href={s.href}
              className="group rounded-xl border-2 border-slate-200 bg-white p-6 transition-all hover:border-slate-300 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-slate-900 group-hover:text-slate-700">{s.title}</h2>
                <span className="shrink-0 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">
                  Open <span aria-hidden="true">→</span>
                </span>
              </div>
              <p className="mt-1.5 text-sm text-slate-500">{s.description}</p>
            </a>
          ) : (
            <div key={s.title} className="rounded-xl border-2 border-slate-200 bg-white p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-slate-900">{s.title}</h2>
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                  Coming soon
                </span>
              </div>
              <p className="mt-1.5 text-sm text-slate-500">{s.description}</p>
            </div>
          ),
        )}
      </div>

      <p className="text-xs text-slate-400">
        Access model: people join <strong>teams</strong>, teams are granted access to{' '}
        <strong>projects</strong> with a role. Teams &amp; Access land next.
      </p>
    </div>
  )
}
