// Which of someone's teams is their main one: the team that colours their
// avatar and names them on a card.
//
// Before the audit of 8 October 2026 three screens answered this three ways:
// the Directory took the primary flag and then the first name alphabetically,
// the Report took the flag and then whichever row the database returned first,
// and My Team ignored the flag. So someone on two teams could be one colour on
// the Directory and another on My Team. This is the one rule now.
//
// The flag (team_members.is_primary, migration 048) wins. Without one, the
// first team by name, so the answer never depends on row order.

export interface Membership<T extends { name: string }> {
  personId: string
  team: T
  isPrimary: boolean
}

/** Each person's main team, for everyone who is on at least one. */
export function primaryTeamByPerson<T extends { name: string }>(rows: Iterable<Membership<T>>): Map<string, T> {
  const best = new Map<string, Membership<T>>()
  for (const m of rows) {
    const cur = best.get(m.personId)
    if (!cur || beats(m, cur)) best.set(m.personId, m)
  }
  return new Map([...best].map(([id, m]) => [id, m.team]))
}

function beats<T extends { name: string }>(a: Membership<T>, b: Membership<T>): boolean {
  if (a.isPrimary !== b.isPrimary) return a.isPrimary
  return a.team.name.localeCompare(b.team.name) < 0
}
