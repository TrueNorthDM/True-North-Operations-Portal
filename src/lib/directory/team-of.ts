// Who counts as somebody's team.
//
// This rule lived twice, written from memory both times, and both copies read
// manager_id alone. That is the reporting line, not the team, and the people it
// leaves out are the ones the question is usually about: Cheyenne Wilson works
// on Graphics under Stephanie and shows that way on her card and on the Teams
// tab, but her solid line runs to Writers, so a filter on manager_id could not
// see her. Stephanie's card said one report; the team has three.
//
// Three ways in, kept apart rather than merged into one blob, because a screen
// that shows them should say which one it is: turning a dotted line into a
// direct report silently is a worse bug than the one this fixes.

export type TeamTie = 'solid' | 'dotted' | 'team'

/** Direct reports first, then the dotted line, then the rest of the team. */
export const TIE_RANK: Record<TeamTie, number> = { solid: 0, dotted: 1, team: 2 }

export interface TeamCandidate {
  id: string
  managerId: string | null
  alsoReportsToId: string | null
  teamIds: string[]
}

/**
 * How `candidate` belongs to `leaderId`'s team, or null if they do not.
 * `ledTeamIds` are the teams the leader heads, not the teams they are on.
 */
export function teamTie(
  candidate: TeamCandidate,
  leaderId: string,
  ledTeamIds: ReadonlySet<string>,
): TeamTie | null {
  if (candidate.id === leaderId) return null
  if (candidate.managerId === leaderId) return 'solid'
  if (candidate.alsoReportsToId === leaderId) return 'dotted'
  if (candidate.teamIds.some(id => ledTeamIds.has(id))) return 'team'
  return null
}

/**
 * Leading is any position that is not plain membership: team_leader, and also
 * manager and founder, who lead the teams they sit on.
 */
export function leadsTeam(position: string | null | undefined): boolean {
  return position != null && position !== 'collaborator'
}
