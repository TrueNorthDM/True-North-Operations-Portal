// What a Workload filter does to the URL.
//
// Small enough to look obvious and wrong in two ways that both hide: a person
// left selected under a different team filters every row out, and a scope
// left behind states one thing while the page obeys another. Neither shows up
// as an error, only as an empty table.

export type FilterKey = 'team' | 'person'

/**
 * Apply one filter change, and everything that has to follow from it.
 *
 * Changing the team resets the person to Anyone. Leaving the old name would
 * cross two conditions that cannot both hold, and the screen would show an
 * empty table with two filters that each look perfectly reasonable.
 *
 * Setting either filter drops the scope, because a filter forces Everyone.
 * Keeping the old value would leave a switch pointing at a scope the page is
 * no longer using.
 */
export function applyFilter(
  current: Record<string, string>,
  key: FilterKey,
  value: string,
): Record<string, string> {
  const next: Record<string, string> = { ...current }

  if (value) next[key] = value
  else delete next[key]

  if (key === 'team') delete next.person
  if (value) delete next.scope

  return next
}

/** Clearing takes both filters, and leaves everything else alone. */
export function clearFilters(current: Record<string, string>): Record<string, string> {
  const next = { ...current }
  delete next.team
  delete next.person
  return next
}

export function toQuery(params: Record<string, string>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v)
  return q.toString()
}
