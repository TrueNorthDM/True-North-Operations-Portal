/**
 * access/tools.ts: the rows of the rail's Tools panel. Which teams may open
 * each tool is set on Admin > Access levels (each tool's team list, decided by
 * access/decide.ts), not here.
 *
 * ONE list, on purpose: a tool's key here is its item in the access catalogue
 * (access/catalogue.ts), so a tool cannot exist in one place and be missing
 * from the other.
 *
 * The corollary matters just as much: anything NOT in this list is not a tool,
 * and is governed solely by the access-level matrix (access/surfaces.ts). My
 * Work used to sit here despite never being a card, which meant it needed a
 * team grant nobody had thought to give.
 *
 * `key` is stored in the access tables (access_rules, access_tool_teams), so
 * it must never change once shipped: rename the label freely but keep the key. `sensitive` flags tools
 * that expose money or PII so the UI can mark them.
 *
 * Since 22 September 2026 (the navigation redesign) the tools sit in two
 * groups, SEO Tools and Operations, in the rail's Tools panel; the Work Tools
 * page (18 to 22 September) that listed them as cards is gone.
 */

import { ROUTES } from '@/lib/nav/routes'
import type { NavIconKey } from '@/lib/nav/nav-icons'

export type ToolAudience = 'lead' | 'all'

export type ToolGroup = 'SEO Tools' | 'Operations'

export interface ToolDef {
  key: string
  label: string
  href: string
  /** The group of the Tools panel it sits in. */
  group: ToolGroup
  icon: NavIconKey
  description: string
  sensitive?: boolean
  /** Not built yet: a real route showing Coming soon, tagged SOON in the panel. */
  soon?: boolean
}

export const TOOLS: ToolDef[] = [
  // ── SEO Tools ────────────────────────────────────────────────────────────
  // The seven below are Coming soon pages (22 September 2026). Their keys are
  // stable from today, so a grant given now still holds when the tool ships.
  // The descriptions are provisional; rewrite each when the tool is specified.
  {
    key: 'schema-app',
    label: 'Schema App',
    href: '/seo/schema',
    group: 'SEO Tools',
    icon: 'schema-app',
    description: "Write and publish schema markup for the sites' pages.",
    soon: true,
  },
  {
    key: 'schema-scraper',
    label: 'Schema Scraper',
    href: '/seo/scraper',
    group: 'SEO Tools',
    icon: 'schema-scraper',
    description: 'Pull the schema off any URL to read it and compare it with ours.',
    soon: true,
  },
  {
    key: 'knowledge-graph',
    label: 'Knowledge Graph',
    href: '/seo/graph',
    group: 'SEO Tools',
    icon: 'knowledge-graph',
    description: 'The entities in our schema and how they connect across pages.',
    soon: true,
  },
  {
    key: 'page-auditor',
    label: 'Page Auditor',
    href: '/seo/auditor',
    group: 'SEO Tools',
    icon: 'page-auditor',
    description: 'Technical checks on a page: titles, headings, links, speed.',
    soon: true,
  },
  {
    key: 'image-optimization',
    label: 'Image Optimization',
    href: '/seo/images',
    group: 'SEO Tools',
    icon: 'image-optimization',
    description: 'Every image on a page, with weight, format and missing alt text.',
    soon: true,
  },
  {
    key: 'analytics',
    label: 'Analytics',
    href: '/seo/analytics',
    group: 'SEO Tools',
    icon: 'analytics',
    description: 'Traffic and search performance for each site.',
    soon: true,
  },
  {
    key: 'impact-globe',
    label: 'Impact Globe',
    href: '/seo/globe',
    group: 'SEO Tools',
    icon: 'impact-globe',
    description: 'Where in the world the sites are being read.',
    soon: true,
  },
  {
    key: 'href-links',
    label: 'Href Links',
    href: ROUTES.hrefLinks,
    group: 'SEO Tools',
    icon: 'href-links',
    description: 'Hreflang tags for the WordPress pages of each project, AAAF and HFA.',
  },

  // ── Operations ───────────────────────────────────────────────────────────
  {
    key: 'publishing',
    label: 'Publishing Goals',
    href: ROUTES.publishing,
    group: 'Operations',
    icon: 'publishing-goals',
    description: 'Weekly publishing pace against target, per client.',
  },
  // Boards (key 'workload', the native rewrite of the boards review) was
  // removed on 23 September 2026: Publishing Goals is the boards review, and
  // publishing targets are edited in Settings. Anything still stored under
  // its key grants nothing: the access rule closes keys not in the catalogue.
  // One entry per client, not one entry for "reports". Each client's numbers
  // are a separate thing to trust someone with, so each has its own team list
  // on Access levels. In the Tools panel the two share one row,
  // Client Reports, shown when either is granted (lib/access/nav.ts).
  //
  // The i7 key stays 'i7-budget'. It is internal, nobody sees it, and its
  // ticks and team list are stored under it: renaming it would silently revoke
  // access for whoever already has it, because the access rule closes keys
  // that have left the catalogue.
  {
    key: 'i7-budget',
    label: 'Client Report - i7',
    href: ROUTES.i7,
    group: 'Operations',
    icon: 'client-reports',
    description: 'Hours, cost and budget usage for i7 Marketing, from QuickBooks Time.',
    sensitive: true,
  },
  {
    key: 'grant-pass-report',
    label: 'Client Report - Project Hours & Others',
    href: ROUTES.projectHours,
    group: 'Operations',
    icon: 'client-reports',
    description: 'Hours, costs and donations for AskAnAdventistFriend, Grants Pass and Hope for Africa.',
    sensitive: true,
  },
]

/** The tools behind the one Client Reports row, in tab order. */
export const CLIENT_REPORT_TOOLS: readonly string[] = ['i7-budget', 'grant-pass-report']

/** Valid tool keys, the server action validates writes against this. */
export const TOOL_KEYS: ReadonlySet<string> = new Set(TOOLS.map(t => t.key))

export const AUDIENCE_LABEL: Record<ToolAudience, string> = {
  lead: 'Lead only',
  all: 'Whole team',
}
