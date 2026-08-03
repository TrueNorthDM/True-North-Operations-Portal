'use client'

/**
 * Access levels board: what each of the four contact types (people.role_type)
 * can see and do, plus who currently holds each one, with inline reassignment.
 *
 * The matrix is rendered from lib/access/levels (the single written-down source
 * of truth); the people come from the server page. Changing a level calls
 * setPersonRoleType, which is admin-gated server-side, so this UI never decides
 * permission on its own.
 */

import { Fragment, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Select } from '@/components/ui/Select'
import { PILL_CLASS, roleTypePill, initialsOf } from '@/components/admin/people-types'
import { LEVELS, CAPABILITIES, KNOWN_GAPS, type CapState } from '@/lib/access/levels'
import type { RoleType } from '@/lib/auth/tier'
import { setPersonRoleType, syncAllRoleTypes } from '@/app/(app)/admin/people/actions'

export interface AccessPerson {
  id: string
  name: string
  title: string | null
  avatarUrl: string | null
  roleType: RoleType
  /** True once the person has actually signed in at least once. */
  hasAccount: boolean
}

const pillFor = (key: RoleType) => {
  const p = roleTypePill(key)
  return PILL_CLASS[p.kind]
}

// ── The yes / no / partial marks in the matrix ──────────────────────────────
function Mark({ state }: { state: CapState }) {
  if (state === 'yes') {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-tn-teal-soft text-tn-teal" title="Yes">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 13 4 4L19 7" /></svg>
        <span className="sr-only">Yes</span>
      </span>
    )
  }
  if (state === 'partial') {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[var(--bdg-gold-bg)] text-[var(--bdg-gold-fg)]" title="Partly, see the note below">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>
        <span className="sr-only">Partly</span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400" title="No">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
      <span className="sr-only">No</span>
    </span>
  )
}

// ── One person row, with the level picker ──────────────────────────────────
function PersonRow({ person, onChanged }: { person: AccessPerson; onChanged: () => void }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  function change(next: string) {
    if (next === person.roleType) return
    setError(null)
    setNotice(null)
    startTransition(async () => {
      try {
        const res = await setPersonRoleType(person.id, next)
        setNotice(
          res.applied === 'live'
            ? 'Saved. It applies the next time they load a page.'
            : 'Saved. It takes effect when they sign in for the first time.',
        )
        onChanged()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not change the level')
      }
    })
  }

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 last:border-0 ${pending ? 'opacity-60' : ''}`}>
      {person.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={person.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
      ) : (
        <span className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-tn-primary text-white font-(family-name:--font-display) font-extrabold text-[11px]">
          {initialsOf(person.name)}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-(family-name:--font-display) font-extrabold text-[13.5px] text-tn-ink truncate">{person.name}</span>
          {!person.hasAccount && (
            <span className="shrink-0 text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide rounded-[6px] px-1.5 py-0.5 bg-slate-100 text-slate-500" title="This person has never signed in, so the level takes effect on their first login.">
              No login yet
            </span>
          )}
        </div>
        {person.title && <div className="text-[12px] text-muted truncate">{person.title}</div>}
        {error && <div className="text-[12px] text-red-600 mt-0.5">{error}</div>}
        {!error && notice && <div className="text-[12px] text-tn-teal mt-0.5">{notice}</div>}
      </div>
      <div className="shrink-0 w-[164px]">
        <Select
          fullWidth
          value={person.roleType}
          onChange={change}
          disabled={pending}
          ariaLabel={`Access level for ${person.name}`}
          options={LEVELS.map(l => ({ value: l.key, label: l.label }))}
        />
      </div>
    </div>
  )
}

// One-shot repair: re-applies every level to its security role, for accounts
// configured before the two started syncing.
function ReapplyButton({ onDone }: { onDone: () => void }) {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<string | null>(null)

  function run() {
    setResult(null)
    startTransition(async () => {
      try {
        const { updated, skippedSelf } = await syncAllRoleTypes()
        setResult(
          (updated === 0 ? 'Everyone was already in sync.' : `Re-applied ${updated} ${updated === 1 ? 'account' : 'accounts'}.`) +
          (skippedSelf ? ' Your own account was left alone.' : ''),
        )
        onDone()
      } catch (e) {
        setResult(e instanceof Error ? e.message : 'Could not re-apply the levels')
      }
    })
  }

  return (
    <div className="flex items-center gap-2.5 flex-wrap">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-full px-[15px] py-2 font-(family-name:--font-display) font-extrabold text-[12px] border border-slate-200 text-foreground hover:border-tn-teal hover:text-tn-teal transition-colors disabled:opacity-50"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" /></svg>
        {pending ? 'Re-applying…' : 'Re-apply all levels'}
      </button>
      {result && <span className="text-[12px] text-muted">{result}</span>}
    </div>
  )
}

export function AccessLevelsBoard({ people }: { people: AccessPerson[] }) {
  const router = useRouter()
  const [filter, setFilter] = useState<RoleType | 'all'>('all')
  const onChanged = () => router.refresh()

  const countOf = (key: RoleType) => people.filter(p => p.roleType === key).length
  const shown = filter === 'all' ? people : people.filter(p => p.roleType === filter)

  return (
    <div className="space-y-10">
      {/* ── The four levels ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="font-(family-name:--font-display) font-extrabold text-[19px] text-tn-ink m-0">The four levels</h2>
          <p className="mt-1 text-[13.5px] text-muted leading-relaxed m-0">
            Every person has one <strong className="font-semibold text-tn-ink">contact type</strong>, which is their portal access.
            It is separate from their <strong className="font-semibold text-tn-ink">team position</strong> (Founder, Manager, Team Leader,
            Collaborator), which only says what they do inside a team and grants no access on its own.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {LEVELS.map(l => (
            <div key={l.key} className="rounded-2xl border border-slate-200 bg-white p-[18px]">
              <div className="flex items-center justify-between gap-2">
                <span className={`inline-flex items-center text-[10.5px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide rounded-[6px] px-2 py-0.5 ${pillFor(l.key)}`}>
                  {l.label}
                </span>
                <span className="text-[12.5px] font-(family-name:--font-display) font-extrabold text-tn-ink tabular-nums">
                  {countOf(l.key)}
                </span>
              </div>
              <p className="mt-2.5 text-[13px] text-muted leading-relaxed m-0">{l.summary}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Capability matrix ───────────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="font-(family-name:--font-display) font-extrabold text-[19px] text-tn-ink m-0">What each level can do</h2>
          <p className="mt-1 text-[13.5px] text-muted leading-relaxed m-0">
            Written to match how the portal behaves today. Rows with a warning sign have a note underneath.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-subtle border-b border-slate-200">
                  <th className="text-left text-[10.5px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted px-5 py-3 min-w-[260px]">Capability</th>
                  {LEVELS.map(l => (
                    <th key={l.key} className="text-center text-[10.5px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted px-4 py-3 whitespace-nowrap">
                      {l.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CAPABILITIES.map(group => (
                  <Fragment key={group.area}>
                    <tr className="bg-tn-teal-soft/40">
                      <td colSpan={5} className="px-5 py-2 text-[10.5px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-tn-teal">
                        {group.area}
                      </td>
                    </tr>
                    {group.items.map(cap => (
                      <tr key={cap.label} className="border-b border-slate-100 last:border-0">
                        <td className="px-5 py-3 text-left text-[13.5px] text-foreground align-top">
                          {cap.label}
                          {cap.caveat && (
                            <p className="mt-1 text-[12px] text-[var(--bdg-gold-fg)] leading-relaxed m-0 max-w-[46ch]">{cap.caveat}</p>
                          )}
                        </td>
                        {LEVELS.map(l => (
                          <td key={l.key} className="px-4 py-3 text-center align-top">
                            <Mark state={cap.state[l.key]} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Who has which level ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h2 className="font-(family-name:--font-display) font-extrabold text-[19px] text-tn-ink m-0">Who has which level</h2>
            <p className="mt-1 mb-2.5 text-[13.5px] text-muted leading-relaxed max-w-[74ch]">
              Changing a level here sets both the interface and the security role, so it takes effect the next time
              that person loads a page. For anyone who has never signed in, it lands on their first login.
            </p>
            <ReapplyButton onDone={onChanged} />
          </div>
          <div className="w-[190px]">
            <Select
              fullWidth
              value={filter}
              onChange={v => setFilter(v as RoleType | 'all')}
              ariaLabel="Filter by access level"
              options={[
                { value: 'all', label: `All people (${people.length})` },
                ...LEVELS.map(l => ({ value: l.key, label: `${l.label} (${countOf(l.key)})` })),
              ]}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          {shown.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted m-0">Nobody has this level yet.</p>
          ) : (
            shown.map(p => <PersonRow key={p.id} person={p} onChanged={onChanged} />)
          )}
        </div>
      </section>

      {/* ── Known gaps ──────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="font-(family-name:--font-display) font-extrabold text-[19px] text-tn-ink m-0">Before you hand out access</h2>
        <div className="rounded-2xl border border-[var(--bdg-gold-fg)]/25 bg-[var(--bdg-gold-bg)]/50 p-5 space-y-3.5">
          {KNOWN_GAPS.map(g => (
            <div key={g.title}>
              <p className="font-(family-name:--font-display) font-extrabold text-[13.5px] text-tn-ink m-0">{g.title}</p>
              <p className="text-[13px] text-foreground leading-relaxed m-0 mt-0.5">{g.detail}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
