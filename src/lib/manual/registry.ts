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
  /** Admins and Super Admins only (the Admin guides). */
  adminOnly?: boolean
}

/** Who reads the manual: what their level lets them see of it. */
export interface ManualViewer { admin: boolean; superAdmin: boolean }
const sees = (p: ManualPage, v: ManualViewer) => (!p.superOnly || v.superAdmin) && (!p.adminOnly || v.admin)

export const TAB_LABEL: Record<ManualTab, string> = { guides: 'Guides', behind: 'Behind the portal' }

export const GROUPS: Record<ManualTab, readonly string[]> = {
  guides: ['Getting started', 'Your work', 'Tools', 'Requests', 'People', 'Admin', 'North Time'],
  behind: ['How the portal works', 'Super Admins only'],
}

const g = (group: string, slug: string, title: string, minutes?: number, more: Partial<ManualPage> = {}): ManualPage => ({ slug, tab: 'guides', group, title, minutes, ...more })

export const PAGES: readonly ManualPage[] = [
  g('Getting started', 'getting-around', 'Getting around', 4),
  g('Getting started', 'home', 'Home', 3),
  g('Getting started', 'where-do-i-find', 'Where do I find...', 2),
  g('Getting started', 'profile-and-settings', 'Your profile & settings', 4),
  g('Your work', 'agenda', 'Agenda', 4),
  g('Your work', 'agenda-settings', 'Agenda settings and Google', 4, { parent: 'agenda' }),
  g('Your work', 'my-work', 'My Work', 5),
  g('Your work', 'report', 'Report', 5, { parent: 'my-work' }),
  g('Your work', 'my-team', 'My Team', 3, { parent: 'my-work' }),
  g('Tools', 'publishing-goals', 'Publishing Goals', 4),
  g('Tools', 'client-reports', 'Client Reports', 3),
  g('Tools', 'client-report-i7', 'i7 report', 6, { parent: 'client-reports' }),
  g('Tools', 'client-report-project-hours', 'Project Hours & Others', 5, { parent: 'client-reports' }),
  g('Tools', 'href-links', 'Href Links', 5),
  g('Requests', 'time-off', 'Time off', 4),
  g('Requests', 'reimbursements', 'Reimbursements', 5),
  g('Requests', 'extra-hours', 'Extra hours', 3),
  g('Requests', 'approvals', 'Approvals', 4),
  g('People', 'directory', 'Directory', 6),
  g('People', 'organization', 'Organization', 2),
  g('People', 'history', 'History', 2),
  g('People', 'human-resources', 'Human Resources', 4),
  g('People', 'annual-review', 'Annual review', 10),
  g('Admin', 'company-settings', 'Company settings', 7, { adminOnly: true }),
  g('Admin', 'access-levels', 'Access levels and View Stage', 7, { adminOnly: true }),
  g('Admin', 'notification-rules', 'Notification rules', 3, { adminOnly: true }),
  g('Admin', 'monday-and-automations', 'Monday accounts and Automations', 5, { adminOnly: true }),
  // North Time keeps today's text until its rules are approved (owner, 4 November 2026).
  g('North Time', 'north-time', 'North Time'),
  g('North Time', 'north-time-quick-start', 'North Time quick start'),
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
export function drawerFor(tab: ManualTab, viewer: ManualViewer): { group: string; pages: NavPage[] }[] {
  const mine = PAGES.filter(p => p.tab === tab && sees(p, viewer))
  return GROUPS[tab]
    .map(group => ({
      group,
      pages: az(mine.filter(p => p.group === group && !p.parent))
        .map(p => ({ ...p, children: az(mine.filter(c => c.parent === p.slug)) })),
    }))
    .filter(g => g.pages.length)
}

/** The pages of a tab in reading order (the drawer, top to bottom), for Previous and Next. */
export function readingOrder(tab: ManualTab, viewer: ManualViewer): ManualPage[] {
  return drawerFor(tab, viewer).flatMap(g => g.pages.flatMap(p => [p, ...p.children]))
}

export function pageOf(tab: ManualTab, slug: string): ManualPage | null {
  return PAGES.find(p => p.tab === tab && p.slug === slug) ?? null
}

/** Whether this viewer may open the page. */
export const canRead = (p: ManualPage, v: ManualViewer) => sees(p, v)

export const pageHref = (p: Pick<ManualPage, 'tab' | 'slug'>) => `/manual/${p.tab}/${p.slug}`
