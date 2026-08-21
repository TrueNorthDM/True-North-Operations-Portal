// One answer to "what colour is this person's team".
//
// There were three, and they disagreed:
//
//   teams.color            what an admin sets in the Teams manager, and what
//                          /directory reads
//   TEAM_COLOR             a five-key map in people-types.ts, read by the home
//                          page, /profile and now the Report
//   AVATAR_COLOUR          a second five-key map inside TeamPeople.tsx, with
//                          different values again
//
// So one person could be yellow in the directory, teal on the home page and
// something else on My Team. Nobody files that as a bug; everybody quietly
// stops trusting the colour to mean anything.
//
// The database wins. It is the one an admin can change, and a colour picker
// that changes nothing on five of six screens is the worse defect. The key
// map stays as the fallback for a team with no colour set, and it has to
// stay: teamKeyFromName collapses seven teams into five keys, so it cannot
// be the source of truth even in principle.

import { TEAM_COLOR, teamKeyFromName } from './people-types'

export type TeamColours = Map<string, string>

/** The colour for one team, by whatever is known about it. */
export function teamColour(dbColor: string | null | undefined, teamName: string | null | undefined): string {
  return dbColor?.trim() || TEAM_COLOR[teamKeyFromName(teamName)]
}

/**
 * Every team's colour, keyed by name.
 *
 * Keyed by name rather than id because the screens that draw an avatar know
 * which team somebody is on by its name, and threading ids through all of
 * them to save one lookup would be the change that never gets finished.
 */
export function teamColoursFrom(teams: { name: string; color: string | null }[]): TeamColours {
  return new Map(teams.map(t => [t.name, teamColour(t.color, t.name)]))
}

/** Look one up, falling back the same way for a team that is not in the map. */
export function colourOf(colours: TeamColours, teamName: string | null | undefined): string {
  if (!teamName) return TEAM_COLOR[teamKeyFromName(null)]
  return colours.get(teamName) ?? teamColour(null, teamName)
}
