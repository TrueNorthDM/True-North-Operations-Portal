// Who the work list is filtered to.
//
// The rule has three cases and lived in three places, each written separately,
// and they disagreed:
//
//   person absent   the signed-in person   (opening the page shows your work)
//   person empty    anybody                (the Everyone tab)
//   a team chosen   that team, and NOT also a person
//
// The third is the one that broke. Choosing a team deleted the person
// parameter, an absent person means "me", so picking Writers quietly filtered
// to Writers AND Arnaldo and showed only his rows. Both halves were behaving
// as written; nobody had written down what happens when they meet.
//
// One function now, because a rule with three cases spread over three files is
// a rule that only holds by coincidence.

export interface WorklistParams {
  /** Absent and empty mean different things; see above. */
  person?: string
  team?: string
}

/** The person to filter by, or null for anybody. */
export function resolvePersonFilter(sp: WorklistParams, selfPersonId: string | null): string | null {
  // A team is a wider question than a person, so it wins: narrowing a team by
  // an implicit person answers a question nobody asked.
  if (sp.team) return null
  if (sp.person === undefined) return selfPersonId
  return sp.person || null
}

/** What the person selector should show, given the same three cases. */
export function personSelectValue(
  person: string | null | undefined,
  team: string,
  selfPersonId: string | null,
): string {
  if (team) return ''
  if (person == null) return selfPersonId ?? ''
  return person
}

/** True when the list is showing only the signed-in person's work. */
export function isMine(person: string, team: string, selfPersonId: string | null): boolean {
  return !!selfPersonId && person === selfPersonId && !team
}
