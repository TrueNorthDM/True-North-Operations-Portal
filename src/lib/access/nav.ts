/**
 * access/nav.ts: the rail, its panels, and the route → surface map used to
 * guard pages.
 *
 * Since 22 September 2026 (the navigation redesign, Design/Redesign Handoff)
 * the rail is a model rather than a list of surface keys: plain pages, hubs
 * that open a second-level panel, and the rules between groups. The layout
 * resolves it on the server for the person signed in (buildRail) and hands the
 * rail and the Cmd+K launcher the same result, so the two can never offer
 * different places.
 *
 * Kept apart from surfaces.ts (the full matrix, including capabilities that
 * are not places) so the rail and the page guards agree on one list.
 */

import { NAV_LABEL, type NavHref } from '@/lib/nav/labels'
import { onPath, pathOf } from '@/lib/nav/path'
import type { NavIconKey } from '@/lib/nav/nav-icons'
import { ROUTES } from '@/lib/nav/routes'
import { CLIENT_REPORT_TOOLS, TOOLS, type ToolGroup } from '@/lib/access/tools'

export type Level = 1 | 2 | 3

/** One row of a panel. */
export interface PanelItem {
  key: string
  label: string
  href: string
  icon: NavIconKey
  /** Shown when this access item is open to the person (lib/access/catalogue.ts). */
  surface?: string
  /** Or when any of these tools is open to them (level and team list, Access levels). */
  tools?: readonly string[]
  soon?: boolean
  /**
   * Also needs a fact about the person, not their level: `invoices` is for
   * contractors, Super Admins, Admins and Finance (an employee gets no invoice).
   */
  needs?: NavFact
  /**
   * A number shown beside the row, fetched when the panel opens: `approvals`
   * is the corrections and time off waiting for this person (Clocky,
   * getApprovalsCount), drawn only above zero.
   */
  count?: NavCount
}

/** The counts a panel row can carry. */
export type NavCount = 'approvals'

/** Facts about the person a row can need (NavContext.facts). */
export type NavFact = 'invoices'

/**
 * A module that is not finished, drawn faded on the rail (asked for on 22
 * September 2026): `soon` is not built at all (Chat, Emails), `building` works
 * but is not yet the real thing. Clocky was `building` until it became the
 * clock for every level (16 October 2026); nothing is `building` today.
 */
export type Readiness = 'soon' | 'building'

export type RailEntry =
  | { kind: 'page'; key: string; href: NavHref; icon: NavIconKey; surface?: string; soon?: boolean }
  | {
      kind: 'hub'
      key: string
      label: string
      icon: NavIconKey
      hint: string
      /**
       * A hint per level, the first whose surface the person holds (Clocky,
       * 16 October 2026: what each level finds behind the hub); `hint` otherwise.
       */
      hints?: readonly { surface: string; hint: string }[]
      /** The hub needs this surface as well as a visible row. */
      surface?: string
      /** A landing page of its own, reached from the panel's title. */
      landing?: string
      /** The surface the landing page itself needs; without it the title is not a link. */
      landingSurface?: string
      /** With a single visible row, go straight there instead of opening the panel. */
      skipWhenSingle?: boolean
      /** Pages outside its rows that still belong to it, for the highlight. */
      alsoMatches?: readonly string[]
      readiness?: Readiness
      groups: readonly { label: string | null; items: readonly PanelItem[] }[]
    }
  | { kind: 'rule' }

const toolRows = (group: ToolGroup): PanelItem[] => {
  const rows: PanelItem[] = []
  for (const t of TOOLS.filter(t => t.group === group)) {
    // The two client reports are two grants behind one row.
    if (CLIENT_REPORT_TOOLS.includes(t.key)) {
      if (!rows.some(r => r.key === 'client-reports')) {
        rows.push({ key: 'client-reports', label: NAV_LABEL[ROUTES.clientReports], href: ROUTES.clientReports, icon: 'client-reports', tools: CLIENT_REPORT_TOOLS })
      }
      continue
    }
    rows.push({ key: t.key, label: t.label, href: t.href, icon: t.icon, tools: [t.key], soon: t.soon })
  }
  return rows
}

/** The rail, top to bottom. Rules separate the person's own things, the company, and the machinery. */
export const RAIL: readonly RailEntry[] = [
  { kind: 'page', key: 'home', href: '/', icon: 'home' },
  {
    kind: 'hub',
    key: 'my-work',
    label: NAV_LABEL['/my-work'],
    icon: 'my-work',
    hint: 'Three views of the same work: yours now, what got delivered, and who you work with.',
    skipWhenSingle: true,
    groups: [{
      label: null,
      items: [
        { key: 'my-work', label: 'My Work', href: '/my-work', icon: 'my-work', surface: 'my-work' },
        { key: 'report', label: 'Report', href: '/report', icon: 'report', surface: 'report' },
        { key: 'my-team', label: 'My Team', href: '/my-work?tab=team', icon: 'my-team', surface: 'my-team' },
      ],
    }],
  },
  { kind: 'page', key: 'chat', href: ROUTES.chat, icon: 'chat', surface: 'chat', soon: true },
  { kind: 'page', key: 'emails', href: ROUTES.emails, icon: 'emails', surface: 'emails', soon: true },
  { kind: 'rule' },
  {
    kind: 'hub',
    key: 'tools',
    label: 'Tools',
    icon: 'tools',
    hint: 'Each tool is open to some levels and some teams. Ask a Super Admin to add one.',
    alsoMatches: ['/ops', '/seo'],
    groups: [
      { label: 'SEO Tools', items: toolRows('SEO Tools') },
      { label: 'Operations', items: toolRows('Operations') },
    ],
  },
  {
    kind: 'hub',
    key: 'people',
    label: 'People',
    icon: 'people',
    hint: 'Everyone in the company. How much of each card opens depends on your level.',
    groups: [{
      label: null,
      items: [
        { key: 'directory', label: NAV_LABEL['/directory'], href: '/directory', icon: 'directory', surface: 'directory' },
        { key: 'organization', label: NAV_LABEL['/organization'], href: ROUTES.organization, icon: 'organization', surface: 'organization' },
        { key: 'human-resources', label: NAV_LABEL['/human-resources'], href: '/human-resources', icon: 'human-resources', surface: 'human-resources' },
        // Everyone signed in, like Organization (7 October 2026).
        { key: 'history', label: NAV_LABEL['/history'], href: ROUTES.history, icon: 'history', surface: 'history' },
      ],
    }],
  },
  { kind: 'rule' },
  {
    kind: 'hub',
    key: 'admin',
    label: NAV_LABEL['/admin'],
    icon: 'admin',
    hint: 'People, teams, and who can access what.',
    landing: '/admin',
    landingSurface: 'admin',
    groups: [
      {
        label: 'Access',
        items: [
          { key: 'access-levels', label: 'Access levels', href: '/admin/access-levels', icon: 'admin', surface: 'access-levels' },
          { key: 'view-stage', label: 'View Stage', href: '/admin/view-stage', icon: 'view-stage', surface: 'view-stage' },
        ],
      },
      {
        label: 'Integrations',
        items: [
          { key: 'monday-accounts', label: 'Monday accounts', href: '/admin/monday-links', icon: 'monday-accounts', surface: 'monday-accounts' },
          { key: 'automations', label: 'Automations', href: '/admin/automations', icon: 'automations', surface: 'automations' },
        ],
      },
      {
        // The company-wide settings (7 October 2026): they left the avatar menu,
        // which is for each person's own things.
        label: 'Configuration',
        items: [
          { key: 'company-settings', label: NAV_LABEL['/admin/settings'], href: '/admin/settings', icon: 'settings', surface: 'settings' },
          { key: 'notification-rules', label: 'Notification rules', href: '/notifications?tab=rules', icon: 'bell', surface: 'notification-rules' },
        ],
      },
      {
        label: 'Portal',
        items: [
          { key: 'tests', label: 'Tests', href: '/admin/tests', icon: 'tests', surface: 'tests' },
          { key: 'manual', label: 'System manual', href: '/admin/manual', icon: 'manual', surface: 'manual' },
        ],
      },
    ],
  },
  {
    // Clocky for every level (owner's decision, 16 October 2026,
    // docs/time-clock/05-clocky-build.md): one hub, its rows filtered by level
    // as the design handoff's "Clocky menu in the rail" (Design/design_handoff_clocky).
    // It replaced the My Hours hub; /hours redirects here.
    kind: 'hub',
    key: 'clocky',
    label: NAV_LABEL['/clocky-hours'],
    icon: 'clocky',
    hint: 'Your own hours: what you clocked, and the corrections you asked for. Clock in opens from the top bar.',
    hints: [
      { surface: 'ck-all', hint: "The time module: everyone's hours, and the rules behind them." },
      { surface: 'ck-team', hint: "Your hours and your team's. Clock in and Who's working also open from the top bar." },
    ],
    groups: [
      {
        label: null,
        items: [
          { key: 'clocky-hours', label: 'Time entries', href: '/clocky-hours', icon: 'my-hours', surface: 'clocky-hours' },
          { key: 'clocky-approvals', label: 'Approvals', href: '/clocky-hours/approvals', icon: 'tests', surface: 'clocky-approvals', count: 'approvals' },
          { key: 'clocky-whos-working', label: "Who's working", href: '/clocky-hours/whos-working', icon: 'my-team', surface: 'ck-whos-working' },
          { key: 'clocky-invoices', label: 'Invoices', href: '/clocky-hours/invoices', icon: 'client-reports', surface: 'clocky-invoices', needs: 'invoices' },
          { key: 'clocky-reports', label: 'Reports', href: '/clocky-hours/reports', icon: 'client-reports', surface: 'clocky-reports', soon: true },
        ],
      },
      {
        label: 'The module',
        items: [
          { key: 'clocky-safety', label: 'Clock safety', href: '/clocky-hours/safety', icon: 'admin', surface: 'ck-safety' },
          // A section of Company settings (Admin > Configuration).
          { key: 'clocky-periods', label: 'Timesheet periods', href: '/admin/settings#periods', icon: 'settings', surface: 'cs-periods' },
          { key: 'clocky-import', label: 'Import', href: '/clocky-hours/import', icon: 'schema-scraper', surface: 'ck-import' },
        ],
      },
    ],
  },
]

// ── Resolved for one person ─────────────────────────────────────────────────

/** What the rail and the launcher draw: plain data, safe to hand to the client. */
export interface NavItem {
  key: string
  label: string
  href: string
  icon: NavIconKey
  soon?: boolean
  count?: NavCount
}

export type ResolvedEntry =
  | { kind: 'page'; item: NavItem; readiness?: Readiness }
  | {
      kind: 'hub'
      key: string
      label: string
      icon: NavIconKey
      hint: string
      landing?: string
      /** Set when the panel is skipped: the one row's address. */
      direct?: string
      /** Path prefixes that light the hub up. */
      matches: string[]
      readiness?: Readiness
      groups: { label: string | null; items: NavItem[] }[]
    }
  | { kind: 'rule' }

export interface NavContext {
  can: (surfaceKey: string) => boolean
  canTool: (toolKey: string) => boolean
  /** The facts this person has (lib/access/nav-facts.ts); a row needing one they lack is left out. Absent: every fact holds (design checks). */
  facts?: ReadonlySet<NavFact>
}


function rowVisible(i: PanelItem, ctx: NavContext): boolean {
  if (i.needs && ctx.facts && !ctx.facts.has(i.needs)) return false
  if (i.tools) return i.tools.some(t => ctx.canTool(t))
  return !i.surface || ctx.can(i.surface)
}

const toItem = (i: { key: string; label: string; href: string; icon: NavIconKey; soon?: boolean; count?: NavCount }): NavItem =>
  ({ key: i.key, label: i.label, href: i.href, icon: i.icon, ...(i.soon ? { soon: true } : {}), ...(i.count ? { count: i.count } : {}) })

/**
 * The rail this person gets. A page shows when its surface is granted (Home
 * always); a hub when its own surface is granted and at least one of its rows
 * would show; a row when its surface or one of its tools is granted and the
 * person's directory level is high enough. A rule with nothing after it, or
 * nothing before it, is dropped.
 */
export function buildRail(ctx: NavContext): ResolvedEntry[] {
  const out: ResolvedEntry[] = []
  for (const e of RAIL) {
    if (e.kind === 'rule') { out.push(e); continue }
    if (e.kind === 'page') {
      if (e.surface && !ctx.can(e.surface)) continue
      out.push({ kind: 'page', item: toItem({ key: e.key, label: NAV_LABEL[e.href], href: e.href, icon: e.icon, soon: e.soon }), ...(e.soon ? { readiness: 'soon' as const } : {}) })
      continue
    }
    if (e.surface && !ctx.can(e.surface)) continue
    const groups = e.groups
      .map(g => ({ label: g.label, items: g.items.filter(i => rowVisible(i, ctx)).map(toItem) }))
      .filter(g => g.items.length > 0)
    const rows = groups.flatMap(g => g.items)
    if (!rows.length) continue
    // The landing only for whoever opens it: holding one row of a hub does not open its landing page.
    const landing = e.landing && (!e.landingSurface || ctx.can(e.landingSurface)) ? e.landing : undefined
    const matches = [...new Set([...rows.map(r => pathOf(r.href)), ...(landing ? [landing] : []), ...(e.alsoMatches ?? [])])]
    out.push({
      kind: 'hub',
      key: e.key,
      label: e.label,
      icon: e.icon,
      hint: e.hints?.find(h => ctx.can(h.surface))?.hint ?? e.hint,
      ...(landing ? { landing } : {}),
      ...(e.skipWhenSingle && rows.length === 1 ? { direct: rows[0].href } : {}),
      ...(e.readiness ? { readiness: e.readiness } : {}),
      matches,
      groups,
    })
  }
  // Rules only between groups that both have something in them.
  return out.filter((e, i, all) =>
    e.kind !== 'rule'
    || (i > 0 && all[i - 1].kind !== 'rule' && all.slice(i + 1).some(x => x.kind !== 'rule')))
}

// Re-exported for the server code that already reads them from here.
export { onPath, pathOf }
