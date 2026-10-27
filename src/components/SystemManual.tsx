'use client'

/**
 * SystemManual: the internal docs (the System manual's "The portal" tab; the
 * header and tabs are ManualHeader), hand-built to match the handoff prototype:
 * a sticky scroll-spy table of contents on the left, richly-laid-out sections
 * on the right (cards, the left-rail reference, page cards, the access-model
 * flow, the Monday data-flow, and the data-source cards). Content is static;
 * the only client bit is the scroll-spy.
 *
 * Audit, 10 October 2026: the Access section is rewritten from the real model
 * (lib/access/catalogue.ts and decide.ts); it still described team grants on
 * projects managed from the Directory, which the portal left on 7 October.
 * The Super Admin only list is read from the catalogue by the page (on the
 * server: client code never imports the catalogue, see view-as-links.test)
 * and passed in, so it cannot drift from what the portal enforces. Tickets
 * is gone (retired).
 *
 * 16 October 2026: Clocky, the portal's own time clock, for every level (the
 * My Hours hub is gone; /hours opens Clocky's Time entries).
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
  test: <svg {...S}><path d="M9 4H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" /><rect x="9" y="2.5" width="6" height="4" rx="1" /><path d="m8.5 13.5 2.2 2.2 4.3-4.6" /></svg>,
  book: <svg {...S}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>,
  dir: <svg {...S}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  work: <svg {...S}><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>,
  clock: <svg {...S}><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2" /><path d="M9.5 2h5" /><path d="M12 2v3" /></svg>,
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
  { icon: 'home', name: 'Home', desc: 'What you need to do today: your day and clock, what needs you, your pay period, the Agenda.', admin: false },
  { icon: 'work', name: 'My Work', desc: 'A panel of three views: My Work, Report and My Team. With only one granted, it goes straight there.', admin: false },
  { icon: 'book', name: 'Chat · Emails', desc: 'Two places coming soon: the company chat, and the mailboxes you hold.', admin: false },
  { icon: 'tools', name: 'Tools', desc: 'A panel in two groups. SEO Tools: Href Links, and seven tools coming soon. Operations: Publishing Goals, Boards and Client Reports. Each tool is granted per team.', admin: false },
  { icon: 'dir', name: 'People', desc: 'A panel: the Directory, the Organization chart, History, and Human Resources (Admins, unless Access levels says otherwise).', admin: false },
  { icon: 'admin', name: 'Admin', desc: 'A panel: Access levels, View Stage, Monday accounts, Automations, Tests and this manual. Its title opens the Admin page.', admin: true },
  { icon: 'clock', name: 'North Time', desc: 'The time clock, for every level. A panel: Time entries, Approvals and Who’s working (Team Leaders and up, with the count of requests waiting for you), Reports (coming soon), and for Admins Clock safety, Timesheet periods and Import.', admin: false },
  { icon: 'settings', name: 'Company settings', desc: 'In the Admin panel, under Configuration: sites, targets, clients and budgets, My Work sources, API tokens and timesheet periods. Notification rules for everyone sit beside it.', admin: true },
]

const SRC: Record<string, { color: string; bg: string }> = {
  monday: { color: '#7c3aed', bg: '#7c3aed14' },
  mixed: { color: '#2563eb', bg: '#2563eb14' },
  portal: { color: '#1E7D7F', bg: 'var(--color-tn-teal-soft)' },
  config: { color: '#c67f0c', bg: '#d9790614' },
  none: { color: '#8593a4', bg: 'var(--color-subtle)' },
}
const PAGES = [
  { icon: 'home', name: 'Home', desc: 'The landing screen, one question per level: what do I need to do today? The day banner with the clock, Needs you / My Work / Requests, the pay period, the Agenda, the i7 budget and Publishing goals (design_handoff_home, 25 October 2026).', src: 'Monday', srcKey: 'monday' as const },
  { icon: 'work', name: 'My Work', desc: 'Everything assigned to you across Monday in one list, in your team\'s priority order. Team leaders and admins set that order, by whole workspace, by board, or step by step; Admin, Access levels says who else can.', src: 'Monday', srcKey: 'monday' as const },
  { icon: 'dash', name: 'Publishing Goals · Boards', desc: 'Operations tools. Publishing Goals tracks publishing pace versus target for AAAF, HFA and Bessemeters over a chosen timeframe; Boards is the Monday boards review.', src: 'Monday', srcKey: 'monday' as const, sub: ['Publishing Goals', 'Boards'] },
  { icon: 'proj', name: 'Href Links', desc: 'An SEO tool: manages the hreflang tag workflow for the AAAF and HFA WordPress sites, the one place the portal writes back to Monday.', src: 'Monday + WordPress', srcKey: 'mixed' as const },
  { icon: 'tools', name: 'Client Reports', desc: 'Hours, cost and budget per client: the i7 report, and Project Hours & Others. One tab per client, each its own team grant.', src: 'QuickBooks Time', srcKey: 'config' as const },
  { icon: 'test', name: 'Tests', desc: 'A pre-launch checklist to verify the whole system end to end, walk each area, tick off what works, flag what doesn’t.', src: 'Portal', srcKey: 'portal' as const },
  { icon: 'dir', name: 'Directory', desc: 'People and teams in one place: add or edit people, who is on each team and who leads it, and who is invited to the portal. Each person has their own page (Personal, Work, HR and access, Reports). What each level can open is set in Admin, Access levels.', src: 'Portal', srcKey: 'portal' as const },
  { icon: 'book', name: 'System manual', desc: 'This page, how the portal works, who can see what, and how the data flows in.', src: 'Portal', srcKey: 'portal' as const },
  { icon: 'clock', name: 'North Time', desc: 'The company’s own time clock, for every level. Clock in from the button in the top bar: pick a job, one of your saved combinations (a job with its Company, Project, Activity and Billable, under a name), or Resume the last one. Switch to another job without clocking out: one entry ends and the next starts at the same second. There are no breaks: a break is a clock out, and coming back is a new clock in. Every start, end and typed duration is recorded on the nearest 15 minutes (8:07 counts as 8:00, 8:08 as 8:15), and every total is a whole quarter hour; the real times stay in each entry’s history. Time entries shows your hours, and your team’s or everyone’s by level, as a list, a week grid and a day timeline.', src: 'Portal + QuickBooks Time', srcKey: 'mixed' as const, sub: ['Time entries', 'Who’s working', 'Reports (coming soon)'] },
  { icon: 'clock', name: 'North Time: safety, corrections and periods', desc: 'A clock nobody answers stops itself. At 4h 30m on the clock, counted from the clock in across every switch, it asks “Still working?” in the clock panel and the bell; Keep going starts a new 5-hour window. With no answer it stops at the 5-hour mark, the person gets one email and confirms when they really stopped, and Clock safety logs every automatic stop, including a clock stopped at the person’s hours allowance, with its reason (Admins, read only below Super Admin). Users only shorten their own entries; for missing time they send a time correction request, which counts once their Team Leader, an Admin or a Super Admin approves it on Approvals. Every change needs a reason and is kept in the entry’s history. Each person submits their hours monthly or every 2 weeks (pay periods of 14 days from the start date in Company settings, Timesheet periods); a submitted period is locked until a Super Admin reopens it, and changing someone’s cadence never cuts a period in half.', src: 'Portal', srcKey: 'portal' as const, sub: ['Approvals', 'Clock safety', 'Timesheet periods', 'Import'] },
  { icon: 'settings', name: 'Company settings', desc: 'Sites & languages, publishing targets, clients & budgets, My Work sources, API tokens, and timesheet periods (when pay periods start, and how new people submit). This is where connections are configured. In Admin, Configuration.', src: 'Config', srcKey: 'config' as const },
]

const FLOWS = [
  { surface: 'Publishing Goals', reads: 'AAAF & HFA Publishing boards, pace, targets and totals.', both: false },
  { surface: 'My Work', reads: 'Every item assigned to the signed-in person across boards.', both: false },
  { surface: 'Home · My Team', reads: 'Team membership and each person’s open work.', both: false },
  { surface: 'Href Links', reads: 'Page & language items for the hreflang workflow.', both: true },
  { surface: 'Directory', reads: 'People and assignments, cross-checked against portal grants.', both: false },
]

// The levels as the manual explains them (the catalogue's summaries are
// written for the Access levels page itself).
const LEVEL_TEXT: Record<string, string> = {
  super_admin: 'Everything, always, including Access levels and View Stage. Given in Access levels, People and levels; there are always at least two.',
  admin: 'Given by a Super Admin. Opens what the Admin column has ticked.',
  team_leader: 'Automatic: Lead of at least one team. Opens what the Team Leader column has ticked. Team positions are set by a Super Admin only.',
  user: 'Automatic: everyone else. Opens what the User column has ticked.',
}
const LEVEL_DOT: Record<string, string> = { super_admin: '#012358', admin: '#1E7D7F', team_leader: '#127A3E', user: '#8593a4' }

const KINDS = [
  { name: 'Module', d: 'An icon on the rail, like My Work or Admin. It opens when anything inside it does.' },
  { name: 'Page', d: 'A screen with its own address, like Report or Directory.' },
  { name: 'Tool', d: 'A page in the Tools panel. Besides the level, one of the person\'s teams must be on its team list.' },
  { name: 'Tab', d: 'A part of a page you switch to, like Report, Workload.' },
  { name: 'Action', d: 'Something you can do or see inside a page: export, edit, run the checks, a sensitive column.' },
]

const LEVEL_ORDER = [
  { key: 'super_admin', label: 'Super Admin' },
  { key: 'admin', label: 'Admin' },
  { key: 'team_leader', label: 'Team Leader' },
  { key: 'user', label: 'User' },
] as const

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <div className="font-(family-name:--font-display) font-extrabold text-[11px] uppercase tracking-[.09em] text-tn-teal mb-2">{children}</div>
)
const Heading = ({ children }: { children: React.ReactNode }) => (
  <h2 className="font-(family-name:--font-display) font-extrabold text-[22px] text-tn-ink mb-3">{children}</h2>
)
const Lede = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[14.5px] leading-[1.7] text-foreground mb-4">{children}</p>
)
const card = 'rounded-2xl border border-slate-200 bg-white shadow-sm'

/**
 * `superOnly`: the labels of the catalogue's Super Admin only items, worked out
 * on the server by app/(app)/admin/manual/page.tsx.
 */
export function SystemManual({ superOnly }: { superOnly: readonly string[] }) {
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
            Last updated<br /><strong className="font-bold text-foreground">October 2026</strong> · v3
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
                { t: 'Who signs in', d: 'True North staff and contractors an admin has invited, with their GoodNews address. No public access.' },
                { t: 'How you get in', d: 'A code or link sent by email, then the code from an authenticator app (two-step sign-in). No password to remember or reset.' },
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
            <Lede>Every screen shares the same navy icon rail on the left, in three groups: your own things, the company, and (for admins) the machinery. Most icons open a panel of their pages beside the rail. A faded icon is a module that is not finished yet (Chat and Emails are coming soon). Your avatar sits at the foot and holds My profile (your own page in the Directory), My Team, Settings and Sign out. The top bar carries search (Cmd+K), Who’s working (Team Leaders and up), the clock button and two drawers: Messages (Chat and Email) and Notifications (Tools and System). Counts appear on the top bar’s buttons and on North Time’s Approvals row, never on the rail’s icons.</Lede>
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
            <Lede>Every person has one of four <strong className="font-bold text-tn-ink">levels</strong>. Each level opens the items ticked for it in a <strong className="font-bold text-tn-ink">catalogue</strong> of everything the portal can show, and one rule answers every question about it, so the menus, the page guards and the Access levels page always agree. A few things adjust that for one person or one team: exceptions, and the team lists of tools.</Lede>

            <h3 className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink mt-2 mb-3">The four levels</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {LEVEL_ORDER.map(l => (
                <div key={l.key} className={`${card} p-4`}>
                  <div className="flex items-center gap-2">
                    <span className="w-[9px] h-[9px] rounded-full" style={{ background: LEVEL_DOT[l.key] }} aria-hidden="true" />
                    <span className="font-(family-name:--font-display) font-extrabold text-sm text-tn-ink">{l.label}</span>
                  </div>
                  <div className="text-[12.5px] leading-relaxed text-muted mt-1.5">{LEVEL_TEXT[l.key]}</div>
                </div>
              ))}
            </div>

            <h3 className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink mt-6 mb-3">The catalogue</h3>
            <p className="text-[13.5px] leading-relaxed text-foreground mb-3">Admin, Access levels lists every item the portal can open, as a tree, with a tick per level for Admin, Team Leader and User. Super Admin always has everything.</p>
            <div className={`${card} overflow-hidden`}>
              {KINDS.map((k, i) => (
                <div key={k.name} className={`flex gap-3.5 px-[18px] py-3 ${i > 0 ? 'border-t border-slate-100' : ''}`}>
                  <div className="w-[88px] shrink-0 font-(family-name:--font-display) font-extrabold text-[13.5px] text-tn-ink">{k.name}</div>
                  <div className="flex-1 min-w-0 text-[13px] leading-relaxed text-muted">{k.d}</div>
                </div>
              ))}
            </div>

            <h3 className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink mt-6 mb-3">How a question is answered</h3>
            <ol className="list-decimal pl-5 space-y-1.5 text-[13.5px] leading-relaxed text-foreground">
              <li>A <b className="text-tn-ink">Super Admin</b> opens everything.</li>
              <li>An item that is <b className="text-tn-ink">Super Admin only</b>, or not in the catalogue at all, opens for nobody else, whatever an exception says. That is what makes a new page closed until someone decides who sees it.</li>
              <li>A child never opens without its parent: a tab needs its page, an action its page or tool.</li>
              <li>An <b className="text-tn-ink">exception</b> for the person and the item, still in date, decides next. If a grant and a removal are both open, the removal wins.</li>
              <li>Items everyone has (Home, Organization, History, your own page and Settings) open.</li>
              <li>Otherwise the <b className="text-tn-ink">level&apos;s tick</b> decides: the saved answer, or the catalogue&apos;s starting one.</li>
              <li>A <b className="text-tn-ink">tool</b> also needs one of the person&apos;s teams on its team list (the whole team, or its Leads only), unless the list is every team.</li>
            </ol>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
              <div className={`${card} p-4`}>
                <div className="font-(family-name:--font-display) font-extrabold text-sm text-tn-ink">Super Admin only</div>
                <div className="text-[12.5px] leading-relaxed text-muted mt-1.5">These can never be given to another level, nor by an exception:</div>
                <ul className="list-disc pl-4 mt-1.5 space-y-0.5 text-[12.5px] leading-relaxed text-foreground">
                  {superOnly.map(label => <li key={label}>{label}</li>)}
                </ul>
              </div>
              <div className={`${card} p-4`}>
                <div className="font-(family-name:--font-display) font-extrabold text-sm text-tn-ink">Exceptions</div>
                <div className="text-[12.5px] leading-relaxed text-muted mt-1.5">One person, one item, given or taken away without changing their level or their teams. Each has an end date (or lasts until removed), ends on that date by itself, and carries a reason. Kept in Access levels, Exceptions.</div>
              </div>
              <div className={`${card} p-4`}>
                <div className="font-(family-name:--font-display) font-extrabold text-sm text-tn-ink">Tools limited by team</div>
                <div className="text-[12.5px] leading-relaxed text-muted mt-1.5">Each tool (Href Links, Publishing Goals, the client reports and the SEO tools) has a team list beside its ticks in Access levels, Permissions. A tool with no team yet is closed to everyone but Super Admins. Who is on a team, and who leads it, is set by a Super Admin only, so nobody can give themselves a tool.</div>
              </div>
              <div className={`${card} p-4`}>
                <div className="font-(family-name:--font-display) font-extrabold text-sm text-tn-ink">View Stage</div>
                <div className="text-[12.5px] leading-relaxed text-muted mt-1.5">Admin, View Stage (Super Admin only) shows the portal through each level side by side, each column as the first active person of that level. A preview changes what is shown, never who is signed in, and it saves nothing: every change made inside a preview is refused.</div>
              </div>
            </div>

            <div className={`${card} p-4 mt-3`}>
              <div className="font-(family-name:--font-display) font-extrabold text-sm text-tn-ink">The Access levels page</div>
              <div className="text-[12.5px] leading-relaxed text-muted mt-1.5">
                Super Admin only, in five tabs. <b className="text-foreground">Permissions</b>: the ticks and the tool team lists; changes are staged, the page shows who gains and who loses what, and they are saved together with one reason. <b className="text-foreground">People and levels</b>: who is Super Admin or Admin. <b className="text-foreground">Check a person</b>: everything one person can and cannot open, and why. <b className="text-foreground">Exceptions</b>. <b className="text-foreground">Change log</b>: every change with its reason, who made it and when, with Undo.
              </div>
            </div>

            <div className="flex gap-3 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 items-start">
              <svg className="shrink-0 mt-0.5 text-amber-700" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16v-4M12 8h.01" /><circle cx="12" cy="12" r="10" /></svg>
              <div className="text-[13px] leading-relaxed text-amber-800"><strong className="font-extrabold">Signing in is separate from access.</strong> An invitation (Directory, Portal access) lets someone in with their GoodNews address and two-step sign-in. What they see inside is decided entirely by their level, their teams and any exception.</div>
            </div>
          </section>

          {/* How Monday feeds it */}
          <section id="monday" className="scroll-mt-6">
            <Eyebrow>Data flow</Eyebrow>
            <Heading>How Monday feeds the portal</Heading>
            <Lede>Monday.com is the system of record for work. The portal connects with an API token (set in <Link href="/admin/settings" className="text-tn-teal font-semibold hover:underline">Settings → API tokens</Link>), pulls the boards it needs on a schedule, and shows them as clean, read-only views. A few actions write back to Monday.</Lede>
            <div className={`${card} p-6 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr] gap-3.5 items-center`}>
              <div className="rounded-xl border-[1.5px] p-4" style={{ borderColor: '#7c3aed33', background: '#7c3aed0d' }}>
                <div className="flex items-center gap-2 mb-2.5"><span className="w-[9px] h-[9px] rounded-[3px]" style={{ background: '#7c3aed' }} /><span className="font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink">Monday boards</span></div>
                <div className="flex flex-col gap-1.5 text-xs text-foreground leading-snug"><span>AAAF &amp; HFA Publishing</span><span>Project &amp; page items</span><span>Assignments &amp; people</span></div>
              </div>
              <div className="hidden md:flex flex-col items-center text-muted"><Arrow /></div>
              <div className="rounded-xl border-[1.5px] border-tn-teal bg-tn-teal-soft p-4 text-center">
                <span className="inline-flex w-[38px] h-[38px] items-center justify-center rounded-[10px] bg-tn-teal-soft text-tn-teal mb-2"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /></svg></span>
                <div className="font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink">Scheduled sync</div>
                <div className="text-[11.5px] text-muted mt-1 leading-snug">API token pulls fresh data; last sync shown in Company settings</div>
              </div>
              <div className="hidden md:flex flex-col items-center text-muted"><Arrow /></div>
              <div className="rounded-xl border-[1.5px] border-slate-200 bg-subtle p-4">
                <div className="flex items-center gap-2 mb-2.5"><span className="w-[9px] h-[9px] rounded-full bg-tn-teal" /><span className="font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink">Portal surfaces</span></div>
                <div className="flex flex-col gap-1.5 text-xs text-foreground leading-snug"><span>Publishing Goals &amp; Boards</span><span>My Work</span><span>Href Links &amp; Home · My Team</span></div>
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
              <div className="text-[13px] leading-relaxed text-foreground"><strong className="font-extrabold text-tn-ink">Write-backs are deliberate.</strong> The one place the portal writes to Monday is the hreflang workflow in Href Links, when a language goes live, marking it Done ticks the matching item back on the Monday board. Everything else is read-only.</div>
            </div>
          </section>

          {/* Data sources */}
          <section id="sources" className="scroll-mt-6">
            <Eyebrow>Connections</Eyebrow>
            <Heading>Data sources</Heading>
            <Lede>Three systems feed the portal. Credentials for each live in <Link href="/admin/settings" className="text-tn-teal font-semibold hover:underline">Company settings</Link>.</Lede>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {[
                { name: 'Monday.com', color: '#7c3aed', bg: '#7c3aed1a', d: 'System of record for publishing, projects and assignments. Connected by API token.', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 4v16M16 4v16" /></svg> },
                { name: 'WordPress', color: '#2563eb', bg: '#2563eb1a', d: 'The AAAF and HFA sites where hreflang tags are published. Edited by hand from Href Links.', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" /></svg> },
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
  )
}
