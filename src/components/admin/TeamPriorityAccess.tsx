'use client'

/**
 * Team priority on Admin → Access levels: how the right to change a team's
 * priority order on My Work is decided, who has it today and why, and the
 * people given it by name.
 *
 * Decided on 16 September 2026: the right comes from three places, and this
 * section is where an admin can see all three at once.
 *   1. Admins, every team, always.
 *   2. A level, through the two Team priority rows of the matrix above.
 *   3. A person, by name, from the list here: the teams they are on, or every
 *      team.
 *
 * "Who can today" is worked out with the same function My Work and its save
 * action use (priorityRights), from what is SAVED: a draft in the matrix above
 * changes nothing here until it is saved, and says so.
 */

import { useMemo, useState, useTransition } from 'react'
import { Select } from '@/components/ui/Select'
import { initialsOf, PILL_CLASS, roleTypePill, TEAM_POSITION_LABEL } from '@/lib/directory/people-types'
import { surfaceAllowed } from '@/lib/access/surfaces'
import {
  GRANT_SCOPES, priorityLevel, priorityReach, priorityRights, type GrantScope, type Membership, type PriorityReach,
} from '@/lib/monday/worklist/team-priority'
import type { PriorityGrant } from '@/lib/monday/worklist/team-priority-data'
import type { AccessPerson } from '@/components/admin/AccessLevelsBoard'
import { setPriorityGrant } from '@/app/(app)/admin/access-levels/actions'

export interface PriorityAccessData {
  /** False until migration 085 is run: nobody can be added by name yet. */
  grantsAvailable: boolean
  teams: { id: string; name: string }[]
  /** Each person's teams, with their position on each, keyed by person id. */
  memberships: Record<string, Membership[]>
  grants: PriorityGrant[]
}

const card = 'rounded-2xl border border-slate-200 bg-white'
const cardHead = 'font-(family-name:--font-display) font-extrabold text-[14.5px] text-tn-ink m-0'

function LevelPill({ level }: { level: string }) {
  const pill = roleTypePill(level)
  return (
    <span className={`shrink-0 inline-flex items-center font-(family-name:--font-display) font-extrabold text-[10.5px] rounded-[6px] px-2 py-[3px] whitespace-nowrap ${PILL_CLASS[pill.kind]}`}>
      {pill.label}
    </span>
  )
}

function Avatar({ person }: { person: AccessPerson }) {
  if (person.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={person.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
  }
  return (
    <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-tn-primary text-white font-(family-name:--font-display) font-extrabold text-[10px]">
      {initialsOf(person.name)}
    </span>
  )
}

/** Why a person reaches what they reach, in words. */
function reason(reach: PriorityReach, levelLabel: string): string {
  if (reach.every === 'admin') return 'Admin'
  if (reach.every === 'level') return `${levelLabel} level: every team`
  if (reach.every === 'name') return 'Added by name: every team'
  const led = reach.teams.filter(t => t.why === 'leads')
  const onTeam = reach.teams.filter(t => t.why === 'member')
  const parts: string[] = []
  if (led.length) parts.push(led.map(t => `${TEAM_POSITION_LABEL[t.position ?? ''] ?? 'Leads'} of ${t.name}`).join(', '))
  if (onTeam.length) parts.push('added by name for the teams they are on')
  const text = parts.join('; ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function TeamPriorityAccess({
  people, configured, data, editingMatrix, onChanged,
}: {
  people: AccessPerson[]
  /** The saved matrix, keyed "roleType:surfaceKey". */
  configured: Record<string, boolean>
  data: PriorityAccessData
  /** The matrix above has unsaved edits open. */
  editingMatrix: boolean
  onChanged: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState('')
  const [addScope, setAddScope] = useState<GrantScope>('member')

  const saved = useMemo(() => new Map(Object.entries(configured)), [configured])
  const grantOf = useMemo(() => new Map(data.grants.map(g => [g.personId, g])), [data.grants])
  const nameOf = useMemo(() => new Map(people.map(p => [p.id, p.name])), [people])

  // A person with no login yet has no security role; the one their level will
  // be given at first sign-in stands in for it (migration 038's rule).
  const levelOf = (p: AccessPerson) => priorityLevel(
    p.roleType,
    p.securityRole ?? (p.roleType === 'admin' || p.roleType === 'admin_assistant' ? 'admin' : 'viewer'),
  )

  const rows = useMemo(() => people
    .map(p => {
      const { matrixLevel, isAdmin } = levelOf(p)
      const rights = priorityRights({
        isAdmin,
        can: key => surfaceAllowed(matrixLevel, key, saved),
        grant: grantOf.get(p.id)?.scope ?? null,
      })
      return { person: p, level: isAdmin ? 'admin' : matrixLevel, reach: priorityReach(data.teams, data.memberships[p.id] ?? [], rights) }
    })
    .filter(r => r.reach.every || r.reach.teams.length)
    .sort((a, b) => {
      const rank = (r: typeof a) => (r.reach.every === 'admin' ? 0 : r.reach.every ? 1 : 2)
      return rank(a) - rank(b) || a.person.name.localeCompare(b.person.name)
    }),
  [people, saved, grantOf, data.teams, data.memberships])

  const grantRows = data.grants
    .map(g => ({ grant: g, person: people.find(p => p.id === g.personId) }))
    .filter((r): r is { grant: PriorityGrant; person: AccessPerson } => !!r.person)
    .sort((a, b) => a.person.name.localeCompare(b.person.name))

  // Admins already set every team, so adding one by name would change nothing.
  const addable = people
    .filter(p => !grantOf.has(p.id) && !levelOf(p).isAdmin)
    .map(p => ({ value: p.id, label: p.name }))

  const run = (personId: string, scope: GrantScope | null, after?: () => void) => {
    setError(null)
    startTransition(async () => {
      try {
        await setPriorityGrant(personId, scope)
        after?.()
        onChanged()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save that')
      }
    })
  }

  const levelLabel = (level: string) => roleTypePill(level).label

  return (
    <section className="space-y-4">
      <div className="min-w-0">
        <h2 className="font-(family-name:--font-display) font-extrabold text-[19px] text-tn-ink m-0">Team priority on My Work</h2>
        <p className="mt-1 text-[13.5px] text-muted leading-relaxed m-0">
          Each team has one priority order for its open steps, and everyone on the team sees their own steps in it.
          This is who can change that order, and why.
          {editingMatrix && <strong className="font-semibold text-tn-ink"> It shows what is saved: press Save above to see your changes here.</strong>}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className={`${card} p-5`}>
          <h3 className={cardHead}>How it is decided</h3>
          <ol className="mt-3 space-y-2.5 text-[13px] text-foreground leading-relaxed list-none p-0 m-0">
            {[
              ['Admins', "set every team's order, always."],
              ['By level', 'the two Team priority rows in the table above. "The teams they lead" also needs a team position: Founder, Manager or Team Leader on that team, set on the Directory.'],
              ['By name', 'the people added here, whatever their level: for the teams they are on, or for every team.'],
              ['Everyone else', "sees their own steps in their team's order and cannot change it. Someone on more than one team follows their main team's order, or another of their teams' when the main one has none, and can switch between them."],
            ].map(([title, text], i) => (
              <li key={title} className="flex gap-2.5">
                <span className="shrink-0 inline-flex items-center justify-center w-5 h-5 mt-px rounded-full bg-tn-teal-soft text-tn-teal font-(family-name:--font-display) font-extrabold text-[11px]">{i + 1}</span>
                <span><strong className="font-semibold text-tn-ink">{title}</strong>: {text}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className={`${card} p-5 ${pending ? 'opacity-70' : ''}`}>
          <h3 className={cardHead}>Added by name</h3>
          <p className="mt-1 text-[12.5px] text-muted leading-relaxed m-0">
            For someone whose level and team position do not give it, without changing either.
          </p>
          {error && <p className="mt-2 text-[12.5px] text-red-600 m-0">{error}</p>}

          {!data.grantsAvailable ? (
            <p className="mt-3 rounded-[10px] border border-[var(--warn-border)] bg-[var(--warn-bg)] px-3.5 py-3 text-[12.5px] leading-relaxed text-[var(--warn-fg)] m-0">
              This list needs migration 085 in the database. Until it is run, nobody can be added by name; the level rows above already work.
            </p>
          ) : (
            <>
              <div className="mt-3 rounded-[12px] border border-slate-100 overflow-hidden">
                {grantRows.length === 0 && (
                  <p className="px-4 py-4 text-[12.5px] text-muted m-0">Nobody yet.</p>
                )}
                {grantRows.map(({ grant, person }) => (
                  <div key={grant.personId} className="flex items-center gap-3 px-3.5 py-2.5 border-b border-slate-100 last:border-0">
                    <Avatar person={person} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink truncate">{person.name}</span>
                        <LevelPill level={levelOf(person).isAdmin ? 'admin' : person.roleType} />
                      </div>
                      {grant.grantedBy && nameOf.get(grant.grantedBy) && (
                        <div className="text-[11.5px] text-muted truncate">{`Added by ${nameOf.get(grant.grantedBy)}`}</div>
                      )}
                    </div>
                    <div className="shrink-0 w-[184px]">
                      <Select
                        fullWidth
                        value={grant.scope}
                        onChange={v => { if (v !== grant.scope) run(person.id, v as GrantScope) }}
                        disabled={pending}
                        ariaLabel={`What ${person.name} can set`}
                        options={GRANT_SCOPES.map(s => ({ value: s.value, label: s.label }))}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => run(person.id, null)}
                      disabled={pending}
                      className="shrink-0 text-[12.5px] font-(family-name:--font-display) font-extrabold text-muted hover:text-red-600 transition-colors disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center gap-2.5 flex-wrap">
                <div className="flex-1 min-w-[180px]">
                  <Select
                    fullWidth
                    searchable
                    value={adding}
                    onChange={setAdding}
                    disabled={pending || addable.length === 0}
                    ariaLabel="Person to add"
                    placeholder="Choose a person…"
                    options={addable}
                  />
                </div>
                <div className="w-[184px]">
                  <Select
                    fullWidth
                    value={addScope}
                    onChange={v => setAddScope(v as GrantScope)}
                    disabled={pending}
                    ariaLabel="What they can set"
                    options={GRANT_SCOPES.map(s => ({ value: s.value, label: s.label }))}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => run(adding, addScope, () => setAdding(''))}
                  disabled={pending || !adding}
                  className="inline-flex items-center gap-2 rounded-full px-[17px] py-2 font-(family-name:--font-display) font-extrabold text-[12px] bg-tn-primary border border-tn-primary text-white shadow-[0_8px_18px_-8px_rgba(1,35,88,.6)] transition-transform hover:-translate-y-px disabled:opacity-50 disabled:translate-y-0"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F2C40A" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                  <span className="text-[#ffffff]">Add</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className={`${card} overflow-hidden`}>
        <div className="px-5 pt-4 pb-3 flex items-baseline gap-2.5">
          <h3 className={cardHead}>Who can change team priorities today</h3>
          <span className="text-[12.5px] font-bold text-muted tabular-nums">{rows.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-subtle border-y border-slate-200">
                <th className="text-left text-[10.5px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted px-5 py-2.5">Person</th>
                <th className="text-left text-[10.5px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted px-4 py-2.5">Teams</th>
                <th className="text-left text-[10.5px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted px-4 py-2.5">Why</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ person, level, reach }) => (
                <tr key={person.id} className="border-b border-slate-100 last:border-0 align-top">
                  <td className="px-5 py-2.5">
                    <div className="flex items-center gap-2.5 min-w-[200px]">
                      <Avatar person={person} />
                      <span className="font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink">{person.name}</span>
                      <LevelPill level={level} />
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1.5 pt-[3px]">
                      {reach.every ? (
                        <span className="inline-flex items-center rounded-[6px] px-2 py-[3px] text-[11.5px] font-semibold bg-tn-teal-soft text-tn-teal">Every team</span>
                      ) : reach.teams.map(t => (
                        <span key={t.id} className="inline-flex items-center rounded-[6px] px-2 py-[3px] text-[11.5px] font-semibold bg-slate-100 text-foreground">{t.name}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-[12.5px] text-muted leading-relaxed">
                    <div className="pt-[3px]">{reason(reach, levelLabel(level))}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
