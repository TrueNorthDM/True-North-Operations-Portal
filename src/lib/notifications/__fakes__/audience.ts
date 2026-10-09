/**
 * A hand-made notification audience for tests: the people, what they open,
 * which teams they lead. The real one is read from the database
 * (../audience.ts loadAudience) and tested on its own.
 */

import { reaches } from '../catalogue'
import type { Audience, Recipient } from '../audience'

export function recipient(id: string, over: Partial<Recipient> = {}): Recipient {
  return {
    personId: id, profileId: `acc-${id}`, name: id, email: `${id}@goodnewsadvocates.org`, roleType: 'user',
    isAdmin: false, teams: new Map(), canTool: () => false, ...over,
  }
}

export function fakeAudience(people: Recipient[], teams: Record<string, { name: string; members: string[] }> = {}): Audience {
  const byId = new Map(people.map(p => [p.personId, p]))
  const teamMembers = new Map(Object.entries(teams).map(([id, t]) => [id, t.members]))
  return {
    people, byId, byProfile: new Map(people.map(p => [p.profileId, p])),
    teamName: new Map(Object.entries(teams).map(([id, t]) => [id, t.name])),
    teamMembers,
    withTool: k => people.filter(p => p.canTool(k)),
    leadersOf: teamId => people.filter(p => p.teams.get(teamId) === true),
    membersOf: teamId => (teamMembers.get(teamId) ?? []).map(id => byId.get(id)).filter((r): r is Recipient => !!r),
    reached: (t, r) => reaches(t, { isAdmin: r.isAdmin, leads: [...r.teams.values()].some(Boolean), canTool: r.canTool }),
  }
}
