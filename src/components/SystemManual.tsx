'use client'

/**
 * SystemManual: the internal docs, hand-built to match the handoff prototype:
 * a sticky scroll-spy table of contents on the left, richly-laid-out sections
 * on the right (cards, the left-rail reference, page cards, the access-model
 * flow, the Monday data-flow, and the data-source cards). Content is static;
 * the only client bit is the scroll-spy.
 */

import Link from 'next/link'
import { useEffect, useState } from 'react'

// ── Icons (line style, system look) ─────────────────────────────────
const S = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
const ICONS: Record<string, React.ReactNode> = {
  home: <svg {...S}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></svg>,
  dash: <svg {...S}><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></svg>,
  proj: <svg {...S}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M15 3v18" /></svg>,
  tools: <svg {...S}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>,
  admin: <svg {...S}><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>,
  settings: <svg {...S}><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
  ticket: <svg {...S}><path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L3 13V4a1 1 0 0 1 1-1h9l7.59 7.59a2 2 0 0 1 0 2.82z" /><circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" /></svg>,
  test: <svg {...S}><path d="M9 4H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" /><rect x="9" y="2.5" width="6" height="4" rx="1" /><path d="m8.5 13.5 2.2 2.2 4.3-4.6" /></svg>,
  book: <svg {...S}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>,
  dir: <svg {...S}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  work: <svg {...S}><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>,
}
const Chip = ({ k, className = '' }: { k: string; className?: string }) => (
  <span className={`shrink-0 inline-flex items-center justify-center rounded-xl bg-tn-teal-soft text-tn-teal ${className}`}>
    <span className="inline-flex w-5 h-5">{ICONS[k]}</span>
  </span>
)
const Arrow = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>

const TOC = [
  { id: 'overview', label: 'Overview', eyebrow: 'Overview', heading: 'What this portal is' },
  { id: 'navigation', label: 'Getting around', eyebrow: 'Getting around', heading: 'The left rail' },
  { id: 'pages', label: 'Pages & sections', eyebrow: 'Reference', heading: 'Pages & sections' },
  { id: 'access', label: 'Access model', eyebrow: 'Permissions', heading: 'Access model' },
  { id: 'monday', label: 'How Monday feeds it', eyebrow: 'Data flow', heading: 'How Monday feeds the portal' },
  { id: 'sources', label: 'Data sources', eyebrow: 'Connections', heading: 'Data sources' },
]

const RAIL = [
  { icon: 'home', name: 'Home', desc: 'Your landing page, My Team and My Work at a glance.', admin: false },
  { icon: 'dash', name: 'Dashboards', desc: 'Board review dashboards, including Publishing Goals.', admin: false },
  { icon: 'proj', name: 'Projects', desc: 'The hreflang workflow for the AAAF and HFA sites.', admin: false },
  { icon: 'tools', name: 'Tools', desc: 'Utilities the team runs day to day.', admin: false },
  { icon: 'admin', name: 'Admin', desc: 'Tickets, Tests, Directory and this manual.', admin: true },
  { icon: 'settings', name: 'Settings', desc: 'Sites, targets, clients, rates and API tokens.', admin: true },
]

const SRC: Record<string, { color: string; bg: string }> = {
  monday: { color: '#7c3aed', bg: '#7c3aed14' },
  mixed: { color: '#2563eb', bg: '#2563eb14' },
  portal: { color: '#1E7D7F', bg: 'var(--color-tn-teal-soft)' },
  config: { color: '#c67f0c', bg: '#d9790614' },
  none: { color: '#8593a4', bg: 'var(--color-subtle)' },
}
const PAGES = [
  { icon: 'home', name: 'Home', desc: 'The landing screen. Surfaces your team at a glance and everything assigned to you, with quick jumps to the rest of the portal.', src: 'Monday', srcKey: 'monday' as const },
  { icon: 'work', name: 'My Work', desc: 'Everything assigned to you across Monday in one place, switch between a board and a list view.', src: 'Monday', srcKey: 'monday' as const },
  { icon: 'dash', name: 'Dashboards', desc: 'Board review dashboards. Publishing Goals tracks publishing pace versus target for AAAF and HFA over a chosen timeframe.', src: 'Monday', srcKey: 'monday' as const, sub: ['Publishing Goals', 'Workload'] },
  { icon: 'proj', name: 'Projects', desc: 'Manages the hreflang tag workflow for the AAAF and HFA WordPress sites, the one place the portal writes back to Monday.', src: 'Monday + WordPress', srcKey: 'mixed' as const },
  { icon: 'tools', name: 'Tools', desc: 'Utilities the team runs day to day, each launched from one list.', src: 'Varies', srcKey: 'none' as const },
  { icon: 'ticket', name: 'Tickets', desc: 'The dev work tracker, everything that needs resolving, so nothing gets lost.', src: 'Portal', srcKey: 'portal' as const },
  { icon: 'test', name: 'Tests', desc: 'A pre-launch checklist to verify the whole system end to end, walk each area, tick off what works, flag what doesn’t.', src: 'Portal', srcKey: 'portal' as const },
  { icon: 'dir', name: 'People, Teams and Permissions', desc: 'People, teams and access in one place. Add or edit people, manage team membership, and grant each team access to projects.', src: 'Portal', srcKey: 'portal' as const },
  { icon: 'book', name: 'System manual', desc: 'This page, how the portal works, who can see what, and how the data flows in.', src: 'Portal', srcKey: 'portal' as const },
  { icon: 'settings', name: 'Settings', desc: 'Sites & languages, publishing targets, clients & budgets, people & rates, and API tokens. This is where connections are configured.', src: 'Config', srcKey: 'config' as const },
]

const FLOWS = [
  { surface: 'Dashboards', reads: 'AAAF & HFA Publishing boards, pace, targets and totals.', both: false },
  { surface: 'My Work', reads: 'Every item assigned to the signed-in person across boards.', both: false },
  { surface: 'Home · My Team', reads: 'Team membership and each person’s open work.', both: false },
  { surface: 'Projects', reads: 'Page & language items for the hreflang workflow.', both: true },
  { surface: 'People, Teams and Permissions', reads: 'People and assignments, cross-checked against portal grants.', both: false },
]

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <div className="font-(family-name:--font-display) font-extrabold text-[11px] uppercase tracking-[.09em] text-tn-teal mb-2">{children}</div>
)
const Heading = ({ children }: { children: React.ReactNode }) => (
  <h2 className="font-(family-name:--font-display) font-extrabold text-[22px] text-tn-ink mb-3">{children}</h2>
)
const Lede = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[14.5px] leading-[1.7] text-foreground max-w-2xl mb-4">{children}</p>
)
const card = 'rounded-2xl border border-slate-200 bg-white shadow-sm'

export function SystemManual() {
  const [active, setActive] = useState('overview')

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: '-12% 0px -70% 0px', threshold: 0 },
    )
    for (const t of TOC) { const el = document.getElementById(t.id); if (el) observer.observe(el) }
    return () => observer.disconnect()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-muted mb-2">
          <Link href="/" className="font-semibold hover:text-tn-ink transition-colors">Dashboard</Link>
          <span className="text-slate-300">/</span>
          <Link href="/admin" className="font-semibold hover:text-tn-ink transition-colors">Admin</Link>
          <span className="text-slate-300">/</span>
          <span className="font-semibold text-tn-ink">System manual</span>
        </div>
        <h1 className="text-2xl font-(family-name:--font-display) font-extrabold tracking-tight text-tn-ink">System manual</h1>
        <p className="mt-1.5 max-w-2xl text-muted">How the Operations Portal is put together, every page, who can see what, and how Monday, WordPress and QuickBooks Time feed the numbers you see.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[214px_1fr] gap-10 items-start">
        {/* Sticky scroll-spy TOC */}
        <nav className="lg:sticky lg:top-[81px] lg:max-h-[calc(100vh-97px)] lg:overflow-y-auto flex flex-col gap-0.5">
          <div className="font-(family-name:--font-display) font-extrabold text-[10.5px] uppercase tracking-[.09em] text-muted px-3 pb-2">On this page</div>
          {TOC.map(t => {
            const on = active === t.id
            return (
              <a
                key={t.id}
                href={`#${t.id}`}
                onClick={() => setActive(t.id)}
                className={`text-[13px] px-3 py-[7px] rounded-lg border-l-2 transition-colors ${on ? 'border-tn-teal bg-tn-teal-soft text-tn-teal font-bold' : 'border-transparent text-muted font-semibold hover:text-tn-ink hover:bg-subtle'}`}
              >
                {t.label}
              </a>
            )
          })}
          <div className="mt-4 pt-3 px-3 border-t border-slate-200 text-xs leading-relaxed text-muted">
            Last updated<br /><strong className="font-bold text-foreground">June 2026</strong> · v1
          </div>
        </nav>

        {/* Content */}
        <div className="min-w-0 flex flex-col gap-11">
          {/* Overview */}
          <section id="overview" className="scroll-mt-6">
            <Eyebrow>Overview</Eyebrow>
            <Heading>What this portal is</Heading>
            <Lede>The Operations Portal is True North’s single home for the tools, dashboards, and to-do lists that keep publishing and client work moving. It doesn’t replace Monday, WordPress or QuickBooks Time, it reads from them and gives the team one calm, consistent place to see status and act on it.</Lede>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {[
                { t: 'Who signs in', d: 'True North staff and contractors on the allow-list, no public access.' },
                { t: 'How you get in', d: 'Magic-link email, no password to remember or reset.' },
                { t: 'Where data lives', d: 'Monday, WordPress and QuickBooks Time. The portal reads, it’s the source that’s the truth.' },
              ].map(c => (
                <div key={c.t} className={`${card} p-4`}>
                  <div className="font-(family-name:--font-display) font-black text-[15px] text-tn-ink">{c.t}</div>
                  <div className="text-[13px] leading-relaxed text-muted mt-1.5">{c.d}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Getting around */}
          <section id="navigation" className="scroll-mt-6">
            <Eyebrow>Getting around</Eyebrow>
            <Heading>The left rail</Heading>
            <Lede>Every screen shares the same slim icon rail on the left. The top group is day-to-day work; the bottom group (above the divider) is admin &amp; setup, shown only to admins.</Lede>
            <div className={`${card} overflow-hidden`}>
              {RAIL.map((r, i) => (
                <div key={r.name} className={`flex items-center gap-3.5 px-[18px] py-3.5 ${i > 0 ? 'border-t border-slate-100' : ''} ${r.admin ? 'bg-subtle' : ''}`}>
                  <Chip k={r.icon} className="w-[38px] h-[38px]" />
                  <div className="w-[118px] shrink-0 font-(family-name:--font-display) font-extrabold text-sm text-tn-ink">{r.name}</div>
                  <div className="flex-1 min-w-0 text-[13px] leading-relaxed text-muted">{r.desc}</div>
                  {r.admin && <span className="shrink-0 font-(family-name:--font-display) font-extrabold text-[9.5px] uppercase tracking-wider text-amber-700 bg-amber-50 rounded-full px-2.5 py-[3px]">Admin</span>}
                </div>
              ))}
            </div>
          </section>

          {/* Pages & sections */}
          <section id="pages" className="scroll-mt-6">
            <Eyebrow>Reference</Eyebrow>
            <Heading>Pages &amp; sections</Heading>
            <Lede>What each screen is for, and where its data comes from.</Lede>
            <div className="flex flex-col gap-3">
              {PAGES.map(p => {
                const s = SRC[p.srcKey]
                return (
                  <div key={p.name} className={`${card} p-5 flex gap-4 items-start`}>
                    <Chip k={p.icon} className="w-10 h-10" />
                    <div className="flex-1 min-w-0">
                      <div className="font-(family-name:--font-display) font-extrabold text-base text-tn-ink">{p.name}</div>
                      <p className="text-[13.5px] leading-relaxed text-muted mt-1">{p.desc}</p>
                      {p.sub && (
                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                          {p.sub.map(x => <span key={x} className="text-[11.5px] font-semibold text-foreground bg-subtle rounded-md px-2 py-1">{x}</span>)}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-bold text-foreground rounded-full px-2.5 py-[5px] whitespace-nowrap" style={{ background: s.bg }}>
                      <span className="w-[7px] h-[7px] rounded-full" style={{ background: s.color }} />{p.src}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Access model */}
          <section id="access" className="scroll-mt-6">
            <Eyebrow>Permissions</Eyebrow>
            <Heading>Access model</Heading>
            <Lede>Access is never granted to one person at a time. People join <strong className="font-bold text-tn-ink">teams</strong>; teams are granted a <strong className="font-bold text-tn-ink">role</strong> on <strong className="font-bold text-tn-ink">projects</strong>. Everything is managed from the Directory.</Lede>
            <div className={`${card} p-6 flex flex-wrap items-stretch gap-3.5`}>
              {[
                { name: 'People', d: 'Staff & contractors with a portal login', color: '#0284c7', bg: '#0284c71a', hi: false, label: 'join' },
                { name: 'Teams', d: 'SEO, Writing, Web, Leadership', color: '#1E7D7F', bg: 'var(--color-tn-teal-soft)', hi: true, label: 'granted role on' },
                { name: 'Projects', d: 'AAAF, HFA and other client sites', color: '#2563eb', bg: '#2563eb1a', hi: false, label: null },
              ].map((b, i) => (
                <div key={b.name} className="contents">
                  <div className={`flex-1 min-w-[150px] rounded-xl p-[18px] text-center ${b.hi ? 'border-[1.5px] border-tn-teal bg-tn-teal-soft' : 'border-[1.5px] border-slate-200 bg-subtle'}`}>
                    <span className="inline-flex w-[42px] h-[42px] items-center justify-center rounded-xl mb-2.5" style={{ background: b.bg, color: b.color }}><span className="inline-flex w-5 h-5">{ICONS.dir}</span></span>
                    <div className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">{b.name}</div>
                    <div className="text-xs text-muted mt-1 leading-relaxed">{b.d}</div>
                  </div>
                  {i < 2 && (
                    <div className="flex-none self-center flex flex-col items-center text-muted">
                      <Arrow /><span className="text-[10.5px] font-bold mt-0.5">{b.label}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              {[
                { role: 'Manager', dot: '#127A3E', d: 'Full access to the project: edit pages, assign work, and manage the team’s access.' },
                { role: 'Editor', dot: '#1E7D7F', d: 'Works inside the project, edits pages and moves items through the workflow.' },
                { role: 'Viewer', dot: '#8593a4', d: 'Read-only, can see dashboards and status but can’t change anything.' },
              ].map(r => (
                <div key={r.role} className={`${card} p-4`}>
                  <div className="flex items-center gap-2">
                    <span className="w-[9px] h-[9px] rounded-full" style={{ background: r.dot }} />
                    <span className="font-(family-name:--font-display) font-extrabold text-sm text-tn-ink">{r.role}</span>
                  </div>
                  <div className="text-[12.5px] leading-relaxed text-muted mt-1.5">{r.d}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 items-start">
              <svg className="shrink-0 mt-0.5 text-amber-700" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16v-4M12 8h.01" /><circle cx="12" cy="12" r="10" /></svg>
              <div className="text-[13px] leading-relaxed text-amber-800"><strong className="font-extrabold">Login is separate from access.</strong> Being on the sign-in allow-list only lets someone in the front door, what they see inside is decided entirely by their team’s project grants.</div>
            </div>
          </section>

          {/* How Monday feeds it */}
          <section id="monday" className="scroll-mt-6">
            <Eyebrow>Data flow</Eyebrow>
            <Heading>How Monday feeds the portal</Heading>
            <Lede>Monday.com is the system of record for work. The portal connects with an API token (set in <Link href="/settings" className="text-tn-teal font-semibold hover:underline">Settings → API tokens</Link>), pulls the boards it needs on a schedule, and shows them as clean, read-only views. A few actions write back to Monday.</Lede>
            <div className={`${card} p-6 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr] gap-3.5 items-center`}>
              <div className="rounded-xl border-[1.5px] p-4" style={{ borderColor: '#7c3aed33', background: '#7c3aed0d' }}>
                <div className="flex items-center gap-2 mb-2.5"><span className="w-[9px] h-[9px] rounded-[3px]" style={{ background: '#7c3aed' }} /><span className="font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink">Monday boards</span></div>
                <div className="flex flex-col gap-1.5 text-xs text-foreground leading-snug"><span>AAAF &amp; HFA Publishing</span><span>Project &amp; page items</span><span>Assignments &amp; people</span></div>
              </div>
              <div className="hidden md:flex flex-col items-center text-muted"><Arrow /></div>
              <div className="rounded-xl border-[1.5px] border-tn-teal bg-tn-teal-soft p-4 text-center">
                <span className="inline-flex w-[38px] h-[38px] items-center justify-center rounded-[10px] bg-tn-teal-soft text-tn-teal mb-2"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /></svg></span>
                <div className="font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink">Scheduled sync</div>
                <div className="text-[11.5px] text-muted mt-1 leading-snug">API token pulls fresh data; last sync shown in Settings</div>
              </div>
              <div className="hidden md:flex flex-col items-center text-muted"><Arrow /></div>
              <div className="rounded-xl border-[1.5px] border-slate-200 bg-subtle p-4">
                <div className="flex items-center gap-2 mb-2.5"><span className="w-[9px] h-[9px] rounded-full bg-tn-teal" /><span className="font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink">Portal surfaces</span></div>
                <div className="flex flex-col gap-1.5 text-xs text-foreground leading-snug"><span>Dashboards &amp; Publishing Goals</span><span>My Work</span><span>Projects &amp; Home · My Team</span></div>
              </div>
            </div>

            <h3 className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink mt-6 mb-3">What reads from Monday</h3>
            <div className={`${card} overflow-hidden`}>
              <div className="grid grid-cols-[140px_1fr_84px] sm:grid-cols-[180px_1fr_96px] gap-3.5 px-[18px] py-3 bg-subtle border-b border-slate-200 font-(family-name:--font-display) font-extrabold text-[10.5px] uppercase tracking-wide text-muted">
                <span>Portal surface</span><span>Reads</span><span className="text-right">Direction</span>
              </div>
              {FLOWS.map(f => (
                <div key={f.surface} className="grid grid-cols-[140px_1fr_84px] sm:grid-cols-[180px_1fr_96px] gap-3.5 px-[18px] py-3 border-b border-slate-100 last:border-0 items-center">
                  <span className="font-(family-name:--font-display) font-bold text-[13.5px] text-tn-ink">{f.surface}</span>
                  <span className="text-[13px] text-muted leading-snug">{f.reads}</span>
                  <span className={`justify-self-end text-[10.5px] font-extrabold uppercase tracking-wide rounded-full px-2.5 py-[3px] ${f.both ? 'bg-tn-teal-soft text-tn-teal' : 'bg-subtle text-muted'}`}>{f.both ? 'read + write' : 'read'}</span>
                </div>
              ))}
            </div>
            <div className={`flex gap-3 mt-4 ${card} bg-subtle px-4 py-3.5 items-start`}>
              <svg className="shrink-0 mt-0.5 text-tn-teal" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
              <div className="text-[13px] leading-relaxed text-foreground"><strong className="font-extrabold text-tn-ink">Write-backs are deliberate.</strong> The one place the portal writes to Monday is the hreflang workflow in Projects, when a language goes live, marking it Done ticks the matching item back on the Monday board. Everything else is read-only.</div>
            </div>
          </section>

          {/* Data sources */}
          <section id="sources" className="scroll-mt-6">
            <Eyebrow>Connections</Eyebrow>
            <Heading>Data sources</Heading>
            <Lede>Three systems feed the portal. Credentials for each live in <Link href="/settings" className="text-tn-teal font-semibold hover:underline">Settings</Link>.</Lede>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {[
                { name: 'Monday.com', color: '#7c3aed', bg: '#7c3aed1a', d: 'System of record for publishing, projects and assignments. Connected by API token.', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 4v16M16 4v16" /></svg> },
                { name: 'WordPress', color: '#2563eb', bg: '#2563eb1a', d: 'The AAAF and HFA sites where hreflang tags are published. Edited by hand from Projects.', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" /></svg> },
                { name: 'QuickBooks Time', color: '#059f6b', bg: '#059f6b1a', d: 'Hours and cost behind the i7 Budget Usage Report. Every figure traces back to a timesheet.', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg> },
              ].map(s => (
                <div key={s.name} className={`${card} p-[18px]`}>
                  <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl mb-3" style={{ background: s.bg, color: s.color }}>{s.icon}</span>
                  <div className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">{s.name}</div>
                  <div className="text-[13px] leading-relaxed text-muted mt-1.5">{s.d}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
