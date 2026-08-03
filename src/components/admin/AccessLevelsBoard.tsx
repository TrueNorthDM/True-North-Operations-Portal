'use client'

/**
 * Access levels board: an EDITABLE matrix of what each contact type
 * (people.role_type) may reach, plus who currently holds each level.
 *
 * The rows come from lib/access/surfaces (the catalogue) and the ticks from
 * access_level_pages. Toggling a cell calls setSurfaceAllowed and the sidebar,
 * page guards and Home widgets all read the same rows, so a change here is
 * applied, not just documented. Admin has no column: it always passes
 * everything, which is what makes lock-out impossible.
 *
 * Every mutation is admin-gated on the server, this UI never decides permission
 * on its own.
 */

import { Fragment, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Select } from '@/components/ui/Select'
import { initialsOf } from '@/components/admin/people-types'
import { LEVELS, KNOWN_GAPS } from '@/lib/access/levels'
import { SURFACES, SURFACE_GROUPS, CONFIGURABLE_ROLES, type ConfigurableRole } from '@/lib/access/surfaces'
import type { RoleType } from '@/lib/auth/tier'
import { setPersonRoleType, syncAllRoleTypes } from '@/app/(app)/admin/people/actions'
import { setSurfaceAllowed } from '@/app/(app)/admin/access-levels/actions'

export interface AccessPerson {
  id: string
  name: string
  title: string | null
  avatarUrl: string | null
  roleType: RoleType
  /** True once the person has actually signed in at least once. */
  hasAccount: boolean
  /** profiles.role as it stands now ('admin' | 'viewer'), null with no account. */
  securityRole: string | null
}

/** The security role a level is supposed to map to (migration 038's rule). */
const expectedRole = (r: RoleType) => (r === 'admin' || r === 'admin_assistant' ? 'admin' : 'viewer')

// ── Matrix cells ───────────────────────────────────────────────────────────
const Tick = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 13 4 4L19 7" /></svg>
)
const Dash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
)

/** A fixed cell: the Admin column, and any locked row. */
function StaticCell({ on, reason }: { on: boolean; reason: string }) {
  return (
    <span
      title={reason}
      className={`inline-flex items-center justify-center w-7 h-7 rounded-full ${
        on ? 'bg-tn-teal-soft text-tn-teal' : 'bg-slate-100 text-slate-400'
      }`}
    >
      {on ? <Tick /> : <Dash />}
      <span className="sr-only">{on ? 'Allowed' : 'Not allowed'}, {reason}</span>
    </span>
  )
}

/** An editable cell: click to flip this level's access to this surface. */
function ToggleCell({
  role, surfaceKey, label, on, onSaved,
}: { role: ConfigurableRole; surfaceKey: string; label: string; on: boolean; onSaved: () => void }) {
  const [pending, startTransition] = useTransition()
  const [failed, setFailed] = useState(false)

  function flip() {
    setFailed(false)
    startTransition(async () => {
      try {
        await setSurfaceAllowed(role, surfaceKey, !on)
        onSaved()
      } catch {
        setFailed(true)
      }
    })
  }

  return (
    <button
      type="button"
      onClick={flip}
      disabled={pending}
      aria-pressed={on}
      title={`${label}: click to ${on ? 'block' : 'allow'}`}
      className={`inline-flex items-center justify-center w-7 h-7 rounded-full transition-all hover:scale-110 disabled:opacity-50 ${
        failed
          ? 'bg-[var(--bdg-red-bg)] text-[var(--bdg-red-fg)]'
          : on
            ? 'bg-tn-teal-soft text-tn-teal hover:bg-tn-teal hover:text-white'
            : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600'
      }`}
    >
      {failed ? '!' : on ? <Tick /> : <Dash />}
      <span className="sr-only">{label}, {on ? 'allowed' : 'not allowed'}</span>
    </button>
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
          {person.hasAccount && person.securityRole !== expectedRole(person.roleType) && (
            <span
              className="shrink-0 text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide rounded-[6px] px-1.5 py-0.5 bg-[var(--bdg-gold-bg)] text-[var(--bdg-gold-fg)]"
              title={`Their level says "${expectedRole(person.roleType)}" but the security role is "${person.securityRole ?? 'none'}". Use Re-apply all levels to fix it.`}
            >
              Out of sync
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

export function AccessLevelsBoard({
  people,
  configured,
}: {
  people: AccessPerson[]
  /** Rows from access_level_pages, keyed "roleType:surfaceKey". */
  configured: Record<string, boolean>
}) {
  const router = useRouter()
  const [filter, setFilter] = useState<RoleType | 'all'>('all')
  const onChanged = () => router.refresh()

  // A surface with no stored row falls back to the catalogue default, so a new
  // surface behaves sensibly before anyone touches it.
  const allowed = (role: ConfigurableRole, key: string): boolean => {
    const stored = configured[`${role}:${key}`]
    if (stored !== undefined) return stored
    return SURFACES.find(s => s.key === key)?.defaults[role] ?? false
  }

  const countOf = (key: RoleType) => people.filter(p => p.roleType === key).length
  const shown = filter === 'all' ? people : people.filter(p => p.roleType === filter)

  return (
    <div className="space-y-10">
      {/* ── Editable matrix ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="font-(family-name:--font-display) font-extrabold text-[19px] text-tn-ink m-0">What each level can do</h2>
          <p className="mt-1 text-[13.5px] text-muted leading-relaxed m-0 max-w-[80ch]">
            Click a tick to allow or block that page for that level. Changes apply the next time the person loads a
            page. <strong className="font-semibold text-tn-ink">Admin</strong> is not listed because it always has
            everything, which is what makes it impossible to lock yourself out.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-subtle border-b border-slate-200">
                  <th className="text-left text-[10.5px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted px-5 py-3 min-w-[280px]">Page or capability</th>
                  {CONFIGURABLE_ROLES.map(r => (
                    <th key={r} className="text-center text-[10.5px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted px-4 py-3 whitespace-nowrap">
                      {LEVELS.find(l => l.key === r)?.label ?? r}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SURFACE_GROUPS.map(group => (
                  <Fragment key={group}>
                    <tr className="bg-tn-teal-soft/40">
                      <td colSpan={1 + CONFIGURABLE_ROLES.length} className="px-5 py-2 text-[10.5px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-tn-teal">
                        {group}
                      </td>
                    </tr>
                    {SURFACES.filter(sf => sf.group === group).map(sf => (
                      <tr key={sf.key} className="border-b border-slate-100 last:border-0">
                        <td className="px-5 py-3 text-left text-[13.5px] text-foreground align-top">
                          <span className="flex items-center gap-2 flex-wrap">
                            {sf.label}
                            {sf.locked === 'always' && <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500 bg-slate-100 rounded-[5px] px-1.5 py-0.5">Always on</span>}
                            {sf.locked === 'admin' && <span className="text-[10px] font-extrabold uppercase tracking-wide text-[var(--bdg-purple-fg)] bg-[var(--bdg-purple-bg)] rounded-[5px] px-1.5 py-0.5">Admin only</span>}
                          </span>
                          {sf.note && <p className="mt-1 text-[12px] text-muted leading-relaxed m-0 max-w-[52ch]">{sf.note}</p>}
                        </td>
                        {CONFIGURABLE_ROLES.map(r => {
                          const on = allowed(r, sf.key)
                          return (
                            <td key={r} className="px-4 py-3 text-center align-top">
                              {sf.locked ? (
                                <StaticCell
                                  on={sf.locked === 'always'}
                                  reason={sf.locked === 'always' ? 'always on for everyone' : 'admin only'}
                                />
                              ) : (
                                <ToggleCell
                                  role={r}
                                  surfaceKey={sf.key}
                                  label={sf.label}
                                  on={on}
                                  onSaved={onChanged}
                                />
                              )}
                            </td>
                          )
                        })}
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
