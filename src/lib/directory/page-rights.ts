/**
 * A person's page (8 October 2026): which tabs a viewer opens, and which they
 * may edit, for one person. The tabs are cut by who keeps the information:
 *
 *   Personal       the person keeps it: they see and edit their own
 *   Work           the company keeps it: the person sees their own
 *   HR and access  never shown to the person themselves
 *   Reports        who reports to the person
 *
 * Someone else's page opens with "Open anyone's page" (p-any), or with "Open
 * the pages of people on the teams they lead" (p-led) for a person on one of
 * those teams; then each tab has its own item on Access levels. A page with no
 * tab open to the viewer does not open at all.
 *
 * Pure: the page, its save actions and every list that links to a page ask it,
 * so a link is never drawn to a page that would refuse.
 */

export type Relation = 'own' | 'led' | 'other'

export interface PageRights {
  own: boolean
  personal: boolean
  personalEdit: boolean
  work: boolean
  workEdit: boolean
  /**
   * Inside the Work editor: teams and positions. Lead of a team makes a Team
   * Leader, and a Team Leader opens their team's pages, so this asks for the
   * same item that changes teams on the Directory's Teams tab (d-edit) on top
   * of editing Work: editing Work alone never lets anyone make themselves Lead.
   */
  teamsEdit: boolean
  hr: boolean
  hrEdit: boolean
  reports: boolean
  /** Inside HR and access: invite, send again, revoke (d-invite). */
  invite: boolean
  /** Inside HR and access: reset the second step (d-2fa). */
  resetTwoStep: boolean
}

export type PageTab = 'personal' | 'work' | 'hr' | 'reports'
export const PAGE_TABS: readonly { key: PageTab; label: string }[] = [
  { key: 'personal', label: 'Personal' },
  { key: 'work', label: 'Work' },
  { key: 'hr', label: 'HR and access' },
  { key: 'reports', label: 'Reports' },
]

export function pageRights(can: (key: string) => boolean, rel: Relation): PageRights | null {
  if (rel === 'own') {
    const workEdit = can('p-work') && can('p-work-edit')
    return {
      own: true,
      personal: true,
      personalEdit: true,
      work: true,
      // Their own Work is the company's to change: only with the same items
      // that change anyone's.
      workEdit,
      teamsEdit: workEdit && can('d-edit'),
      hr: false,
      hrEdit: false,
      reports: true,
      invite: false,
      resetTwoStep: false,
    }
  }
  const opens = can('p-any') || (rel === 'led' && can('p-led'))
  if (!opens) return null
  const personal = can('p-personal')
  const work = can('p-work')
  const hr = can('p-hr')
  const reports = can('p-reports')
  if (!personal && !work && !hr && !reports) return null
  const workEdit = work && can('p-work-edit')
  return {
    own: false,
    personal,
    personalEdit: personal && can('p-personal-edit'),
    work,
    workEdit,
    teamsEdit: workEdit && can('d-edit'),
    hr,
    hrEdit: hr && can('p-hr-edit'),
    reports,
    invite: hr && can('d-invite'),
    resetTwoStep: hr && can('d-2fa'),
  }
}

/** The tabs a viewer opens, in order. */
export function openTabs(r: PageRights): PageTab[] {
  return PAGE_TABS.filter(t => r[t.key]).map(t => t.key)
}

/** The tab asked for when it is open, else the first one that is. */
export function resolvePageTab(asked: string | undefined, r: PageRights): PageTab {
  const open = openTabs(r)
  return open.includes(asked as PageTab) ? (asked as PageTab) : open[0]
}

/** How the viewer stands to the person: themselves, on a team they lead, or neither. */
export function relationTo(viewerId: string | null, personId: string, ledMemberIds: ReadonlySet<string>): Relation {
  if (viewerId && viewerId === personId) return 'own'
  return ledMemberIds.has(personId) ? 'led' : 'other'
}

/** The page's address. */
export const personHref = (personId: string, tab?: PageTab) => `/directory/${personId}${tab ? `?tab=${tab}` : ''}`

/** For a list of people: each one's page when the viewer may open it, else null. */
export function pageHrefs(
  can: (key: string) => boolean,
  viewerId: string | null,
  ledByViewer: ReadonlySet<string>,
): (personId: string) => string | null {
  return personId => (pageRights(can, relationTo(viewerId, personId, ledByViewer)) ? personHref(personId) : null)
}
