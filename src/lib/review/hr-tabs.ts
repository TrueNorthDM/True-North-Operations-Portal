/**
 * Human Resources' tabs, shared by its page and the Reviews list (owner,
 * 4 November 2026: Reviews is a tab like the others, not a button on the
 * side). In the first year (no review of theirs approved yet, no team goals)
 * the page is the card and the badges, so the tabs are only that and Reviews.
 */

export type HrTab = 'reviews' | 'goals' | 'team' | 'anniversaries' | 'all'

export function hrTabs(o: { first: boolean; team: boolean; all: boolean }): { key: HrTab; label: string; href: string }[] {
  const all = o.all ? [{ key: 'all' as const, label: 'Reviews', href: '/human-resources/reviews' }] : []
  if (o.first) return [{ key: 'reviews', label: 'My review', href: '/human-resources' }, ...all]
  return [
    { key: 'reviews', label: 'My reviews', href: '/human-resources?tab=reviews' },
    { key: 'goals', label: 'My goals', href: '/human-resources?tab=goals' },
    ...(o.team ? [{ key: 'team' as const, label: "My team's goals", href: '/human-resources?tab=team' }] : []),
    { key: 'anniversaries', label: 'Anniversaries', href: '/human-resources?tab=anniversaries' },
    ...all,
  ]
}
