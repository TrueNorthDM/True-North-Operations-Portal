// Design check: Admin → Access levels, the real board on sample people.
//
// Built for the Team priority rows and section added on 16 September 2026, so
// they can be looked at without signing in as an admin. Development only;
// every button here would call the real admin actions, which refuse anyone
// who is not signed in as an admin, so nothing is saved.
// ?grants=off shows the section before migration 085 is run.

import { notFound } from 'next/navigation'
import { AccessLevelsBoard, type AccessPerson } from '@/components/admin/AccessLevelsBoard'
import type { Membership } from '@/lib/monday/worklist/team-priority'

export const dynamic = 'force-dynamic'

const person = (id: string, name: string, roleType: AccessPerson['roleType'], title: string | null = null): AccessPerson => ({
  id, name, title, avatarUrl: null, roleType, hasAccount: true,
  securityRole: roleType === 'admin' || roleType === 'admin_assistant' ? 'admin' : 'viewer',
})

const PEOPLE: AccessPerson[] = [
  person('arnaldo', 'Arnaldo Oliveira', 'admin', 'Operations'),
  person('tina', 'Tina Gennette', 'admin', 'Admin Assistant'),
  person('jeannette', 'Jeannette Owens', 'team_leader', 'SEO Lead'),
  person('jonatas', 'Jônatas Queiroz', 'team_leader'),
  person('stephanie', 'Stephanie Aguirre', 'team_leader', 'Graphics Lead'),
  person('joy', 'Joy Deche', 'team_leader'),
  person('rock', 'Rock Kai', 'user'),
  person('ed', 'Ed Wagner', 'user', 'Founder'),
  person('devon', 'Devon Smith', 'user'),
  person('kevin', 'Kevin Ames', 'user'),
]

const TEAMS = [
  { id: 'assistants', name: 'Admin Assistants' }, { id: 'africa', name: 'Africa' }, { id: 'graphics', name: 'Graphics' },
  { id: 'leadership', name: 'Leadership' }, { id: 'operations', name: 'Operations' }, { id: 'seo', name: 'SEO' },
  { id: 'special', name: 'Special Projects' }, { id: 'translation', name: 'Translation' },
]
const name = new Map(TEAMS.map(t => [t.id, t.name]))
const on = (teamId: string, position = 'collaborator', isPrimary = false): Membership =>
  ({ teamId, teamName: name.get(teamId)!, isPrimary, position })

const MEMBERSHIPS: Record<string, Membership[]> = {
  arnaldo: [on('leadership', 'manager', true), on('seo'), on('operations', 'team_leader')],
  tina: [on('assistants', 'team_leader', true)],
  jeannette: [on('seo', 'team_leader', true)],
  jonatas: [on('assistants', 'collaborator', true), on('translation')],
  stephanie: [on('graphics', 'team_leader', true), on('seo')],
  joy: [on('translation', 'team_leader', true), on('africa')],
  rock: [on('africa', 'manager', true)],
  ed: [on('leadership', 'founder', true)],
  devon: [on('assistants', 'collaborator', true)],
  kevin: [on('special', 'team_leader', true), on('seo')],
}

export default async function AccessLevelsDesignCheck(
  { searchParams }: { searchParams: Promise<{ grants?: string }> },
) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { grants } = await searchParams
  const available = grants !== 'off'
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-[1180px] mx-auto space-y-8">
        <div>
          <p className="text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.14em] text-tn-teal m-0">Design check · as built</p>
          <h1 className="text-2xl font-(family-name:--font-display) font-extrabold tracking-tight text-tn-ink m-0">Access levels</h1>
          <p className="mt-1.5 text-muted leading-relaxed m-0">The real board on sample people, with Jônatas added by name for the teams he is on.</p>
        </div>
        <AccessLevelsBoard
          people={PEOPLE}
          configured={{}}
          priority={{
            grantsAvailable: available,
            teams: TEAMS,
            memberships: MEMBERSHIPS,
            grants: available ? [{ personId: 'jonatas', scope: 'member', grantedAt: new Date().toISOString(), grantedBy: 'arnaldo' }] : [],
          }}
        />
      </div>
    </div>
  )
}
