/**
 * The System manual's pages (owner, 4 November 2026): two tabs, Guides (a
 * tutorial for each module, for everyone) and Behind the portal (how it
 * works, with a group for Super Admins only). Each page has its own address,
 * /manual/<tab>/<slug>. The drawer shows each tab's groups in this order, with
 * a rule between them, and the pages of a group A to Z; a page with a
 * `parent` sits under it. A new page only needs a line here and its content
 * in components/manual/ManualContent.tsx.
 */

export type ManualTab = 'guides' | 'behind'

export interface ManualPage {
  slug: string
  tab: ManualTab
  group: string
  title: string
  /** A step of a bigger guide: listed under it in the drawer. */
  parent?: string
  /** About how long it takes to read. */
  minutes?: number
  /** Super Admins only (the server, its accounts and keys). */
  superOnly?: boolean
}

export const TAB_LABEL: Record<ManualTab, string> = { guides: 'Guides', behind: 'Behind the portal' }

export const GROUPS: Record<ManualTab, readonly string[]> = {
  guides: ['Getting started', 'Your work', 'North Time', 'People'],
  behind: ['How the portal works', 'Super Admins only'],
}

export const PAGES: readonly ManualPage[] = [
  { slug: 'getting-around', tab: 'guides', group: 'Getting started', title: 'Getting around' },
  { slug: 'home', tab: 'guides', group: 'Getting started', title: 'Home' },
  { slug: 'where-do-i-find', tab: 'guides', group: 'Getting started', title: 'Where do I find...' },
  { slug: 'agenda', tab: 'guides', group: 'Your work', title: 'Agenda', minutes: 4 },
  { slug: 'agenda-settings', tab: 'guides', group: 'Your work', title: 'Agenda settings and Google', parent: 'agenda', minutes: 4 },
  // North Time keeps today's text until its rules are approved (owner, 4 November 2026).
  { slug: 'north-time', tab: 'guides', group: 'North Time', title: 'North Time' },
  { slug: 'north-time-quick-start', tab: 'guides', group: 'North Time', title: 'North Time quick start' },
  { slug: 'annual-review', tab: 'guides', group: 'People', title: 'Annual review' },
  { slug: 'overview', tab: 'behind', group: 'How the portal works', title: 'Overview' },
  { slug: 'pages-and-sections', tab: 'behind', group: 'How the portal works', title: 'Pages & sections' },
  { slug: 'access-model', tab: 'behind', group: 'How the portal works', title: 'Access model' },
  { slug: 'how-monday-feeds-it', tab: 'behind', group: 'How the portal works', title: 'How Monday feeds it' },
  { slug: 'data-sources', tab: 'behind', group: 'How the portal works', title: 'Data sources' },
  { slug: 'moving-from-tsheets', tab: 'behind', group: 'How the portal works', title: 'Moving from TSheets' },
  { slug: 'how-it-runs', tab: 'behind', group: 'Super Admins only', title: 'How it runs', superOnly: true },
]

export const isTab = (t: string): t is ManualTab => t === 'guides' || t === 'behind'

export type NavPage = ManualPage & { children: ManualPage[] }

const az = <T extends { title: string }>(xs: T[]) => xs.sort((a, b) => a.title.localeCompare(b.title))

/** A tab's drawer: its groups in order, each with its pages A to Z, steps under their guide. */
export function drawerFor(tab: ManualTab, superAdmin: boolean): { group: string; pages: NavPage[] }[] {
  const mine = PAGES.filter(p => p.tab === tab && (superAdmin || !p.superOnly))
  return GROUPS[tab]
    .map(group => ({
      group,
      pages: az(mine.filter(p => p.group === group && !p.parent))
        .map(p => ({ ...p, children: az(mine.filter(c => c.parent === p.slug)) })),
    }))
    .filter(g => g.pages.length)
}

/** The pages of a tab in reading order (the drawer, top to bottom), for Previous and Next. */
export function readingOrder(tab: ManualTab, superAdmin: boolean): ManualPage[] {
  return drawerFor(tab, superAdmin).flatMap(g => g.pages.flatMap(p => [p, ...p.children]))
}

export function pageOf(tab: ManualTab, slug: string): ManualPage | null {
  return PAGES.find(p => p.tab === tab && p.slug === slug) ?? null
}

export const pageHref = (p: Pick<ManualPage, 'tab' | 'slug'>) => `/manual/${p.tab}/${p.slug}`
