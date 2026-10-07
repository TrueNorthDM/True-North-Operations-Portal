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
  /** Shown when this surface is granted. */
  surface?: string
  /** Or when any of these tools is granted (a team grant, Directory → Teams). */
  tools?: readonly string[]
  minLevel?: Level
  soon?: boolean
}

/**
 * A module that is not finished, drawn faded on the rail (asked for on 22
 * September 2026): `soon` is not built at all (Chat, Emails), `building` works
 * but is not yet the real thing (My Hours and Clocky, while QuickBooks Time is
 * still the record of hours).
 */
export type Readiness = 'soon' | 'building'

export type RailEntry =
  | { kind: 'page'; key: string; href: NavHref; icon: NavIconKey; surface?: string; minLevel?: Level; soon?: boolean }
  | {
      kind: 'hub'
      key: string
      label: string
      icon: NavIconKey
      hint: string
      /** The hub needs this surface as well as a visible row. */
      surface?: string
      minLevel?: Level
      /** A landing page of its own, reached from the panel's title. */
      landing?: string
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
  {
    kind: 'hub',
    key: 'my-hours',
    label: NAV_LABEL['/hours'],
    icon: 'my-hours',
    hint: 'Your own time: what you logged, what it adds up to, and what was approved.',
    surface: 'my-hours',
    readiness: 'building',
    groups: [{
      label: null,
      items: [
        { key: 'my-hours', label: 'Hours', href: '/hours', icon: 'my-hours', surface: 'my-hours' },
        { key: 'my-hours-reports', label: 'Reports', href: '/hours/reports', icon: 'client-reports', surface: 'my-hours', soon: true },
        { key: 'my-hours-approvals', label: 'Approvals and Invoices', href: '/hours/approvals', icon: 'tests', surface: 'my-hours', soon: true },
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
    hint: "Granted per team. Ask an admin to add one on the Directory's Teams tab.",
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
    surface: 'directory',
    alsoMatches: ['/my-team'],
    groups: [{
      label: null,
      items: [
        { key: 'directory', label: NAV_LABEL['/directory'], href: '/directory', icon: 'directory', surface: 'directory' },
        { key: 'organization', label: NAV_LABEL['/organization'], href: ROUTES.organization, icon: 'organization', surface: 'home' },
        { key: 'human-resources', label: NAV_LABEL['/human-resources'], href: '/human-resources', icon: 'human-resources', surface: 'human-resources', minLevel: 2 },
        // Everyone signed in, like Organization (7 October 2026).
        { key: 'history', label: NAV_LABEL['/history'], href: ROUTES.history, icon: 'history', surface: 'home' },
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
    surface: 'admin',
    landing: '/admin',
    groups: [
      {
        label: 'Access',
        items: [
          { key: 'access-levels', label: 'Access levels', href: '/admin/access-levels', icon: 'admin', surface: 'admin' },
          { key: 'view-stage', label: 'View Stage', href: '/admin/view-stage', icon: 'view-stage', surface: 'admin' },
        ],
      },
      {
        label: 'Integrations',
        items: [
          { key: 'monday-accounts', label: 'Monday accounts', href: '/admin/monday-links', icon: 'monday-accounts', surface: 'admin' },
          { key: 'automations', label: 'Automations', href: '/admin/automations', icon: 'automations', surface: 'admin' },
        ],
      },
      {
        label: 'Portal',
        items: [
          { key: 'tickets', label: 'Tickets', href: '/admin/tickets', icon: 'tickets', surface: 'admin' },
          { key: 'tests', label: 'Tests', href: '/admin/tests', icon: 'tests', surface: 'admin' },
          { key: 'manual', label: 'System manual', href: '/admin/manual', icon: 'manual', surface: 'admin' },
        ],
      },
    ],
  },
  {
    kind: 'hub',
    key: 'clocky',
    label: NAV_LABEL['/clocky-hours'],
    icon: 'clocky',
    hint: "The time module: everyone's hours, and the rules behind them.",
    surface: 'clocky-hours',
    readiness: 'building',
    groups: [
      {
        label: null,
        items: [
          { key: 'clocky-hours', label: 'Hours', href: '/clocky-hours', icon: 'my-hours', surface: 'clocky-hours' },
          { key: 'clocky-reports', label: 'Reports', href: '/clocky-hours/reports', icon: 'client-reports', surface: 'clocky-hours', soon: true },
          { key: 'clocky-approvals', label: 'Approvals and Invoices', href: '/clocky-hours/approvals', icon: 'tests', surface: 'clocky-hours', soon: true },
        ],
      },
      {
        // The page stays as it was (decided 22 September 2026): Rules and
        // Import open the same page, at their own section.
        label: 'The module',
        items: [
          { key: 'clocky-rules', label: 'Rules', href: '/clocky-hours#rules', icon: 'settings', surface: 'clocky-hours' },
          { key: 'clocky-import', label: 'Import', href: '/clocky-hours#import', icon: 'schema-scraper', surface: 'clocky-hours' },
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
  level: Level
}

/** The address without its query or section, for matching the current page. */
export function pathOf(href: string): string {
  return href.split(/[?#]/)[0]
}

function rowVisible(i: PanelItem, ctx: NavContext): boolean {
  if ((i.minLevel ?? 1) > ctx.level) return false
  if (i.tools) return i.tools.some(t => ctx.canTool(t)) && ctx.can('tools')
  return !i.surface || ctx.can(i.surface)
}

const toItem = (i: { key: string; label: string; href: string; icon: NavIconKey; soon?: boolean }): NavItem =>
  ({ key: i.key, label: i.label, href: i.href, icon: i.icon, ...(i.soon ? { soon: true } : {}) })

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
    if ((e.minLevel ?? 1) > ctx.level) continue
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
    const matches = [...new Set([...rows.map(r => pathOf(r.href)), ...(e.landing ? [e.landing] : []), ...(e.alsoMatches ?? [])])]
    out.push({
      kind: 'hub',
      key: e.key,
      label: e.label,
      icon: e.icon,
      hint: e.hint,
      ...(e.landing ? { landing: e.landing } : {}),
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

/** Is `pathname` this address or somewhere under it? */
export function onPath(pathname: string, prefix: string): boolean {
  return prefix === '/' ? pathname === '/' : pathname === prefix || pathname.startsWith(prefix + '/')
}

/**
 * Which surface guards a given pathname. First match wins, so list the more
 * specific prefixes first. Routes with no entry are ungated by surface (they
 * carry their own checks, e.g. /profile is always your own).
 */
const ROUTE_SURFACES: readonly { prefix: string; surface: string }[] = [
  { prefix: '/admin', surface: 'admin' },
  { prefix: '/clocky-hours', surface: 'clocky-hours' },
  { prefix: '/hours', surface: 'my-hours' },
  { prefix: '/settings', surface: 'settings' },
  { prefix: '/human-resources', surface: 'human-resources' },
  { prefix: '/directory', surface: 'directory' },
  { prefix: '/my-work', surface: 'my-work' },
  // Its own grant now. The My Team TAB inside /my-work carries the 'my-team'
  // surface and is checked in the page, because a prefix cannot see a query
  // parameter and the tab is ?tab=team.
  { prefix: '/report', surface: 'report' },
  // The Tools panel's pages. Each is also gated in the page itself by its own
  // tool grant (Directory → Teams), which is what decides who sees it.
  { prefix: '/ops', surface: 'tools' },
  { prefix: '/seo', surface: 'tools' },
  { prefix: '/organization', surface: 'home' },
  { prefix: '/history', surface: 'home' },
  { prefix: '/chat', surface: 'chat' },
  { prefix: '/emails', surface: 'emails' },
]

export function surfaceForPath(pathname: string): string | null {
  const hit = ROUTE_SURFACES.find(r => pathname === r.prefix || pathname.startsWith(r.prefix + '/'))
  return hit?.surface ?? null
}
