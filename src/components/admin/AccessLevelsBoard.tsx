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
import { setPersonRoleType } from '@/app/(app)/admin/people/actions'
import { saveSurfaceChanges } from '@/app/(app)/admin/access-levels/actions'

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

/**
 * An editable cell, only rendered in edit mode. It flips a DRAFT value; nothing
 * reaches the server until Save, so a half-finished set of rules never goes
 * live and a mistake costs nothing to abandon.
 */
function ToggleCell({
  label, on, changed, onFlip,
}: { label: string; on: boolean; changed: boolean; onFlip: () => void }) {
  return (
    <button
      type="button"
      onClick={onFlip}
      aria-pressed={on}
      title={`${label}: click to ${on ? 'block' : 'allow'}`}
      className={`inline-flex items-center justify-center w-7 h-7 rounded-full transition-all hover:scale-110 ${
        on
          ? 'bg-tn-teal-soft text-tn-teal hover:bg-tn-teal hover:text-white'
          : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600'
      } ${changed ? 'ring-2 ring-offset-1 ring-[var(--bdg-gold-fg)]' : ''}`}
    >
      {on ? <Tick /> : <Dash />}
      <span className="sr-only">{label}, {on ? 'allowed' : 'not allowed'}{changed ? ', changed' : ''}</span>
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
            : 'Saved. It is applied for them the moment they first sign in.',
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

  // View by default; Edit stages changes in `draft` and Save commits them all.
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<string, boolean>>({})
  const [saving, startSaving] = useTransition()
  const [saveError, setSaveError] = useState<string | null>(null)

  // A surface with no stored row falls back to the catalogue default, so a new
  // surface behaves sensibly before anyone touches it.
  const saved = (role: ConfigurableRole, key: string): boolean => {
    const stored = configured[`${role}:${key}`]
    if (stored !== undefined) return stored
    return SURFACES.find(s => s.key === key)?.defaults[role] ?? false
  }
  // What the matrix shows: the draft while editing, otherwise what is stored.
  const allowed = (role: ConfigurableRole, key: string): boolean =>
    draft[`${role}:${key}`] ?? saved(role, key)
  const isChanged = (role: ConfigurableRole, key: string): boolean =>
    `${role}:${key}` in draft

  const changes = Object.entries(draft).map(([k, allowedValue]) => {
    const [roleType, surfaceKey] = k.split(':')
    return { roleType, surfaceKey, allowed: allowedValue }
  })

  function flip(role: ConfigurableRole, key: string) {
    const id = `${role}:${key}`
    setDraft(d => {
      const next = { ...d }
      const wanted = !allowed(role, key)
      // Flipping back to the stored value drops the entry, so "0 changes"
      // really means nothing to save.
      if (wanted === saved(role, key)) delete next[id]
      else next[id] = wanted
      return next
    })
  }

  function cancel() {
    setDraft({})
    setSaveError(null)
    setEditing(false)
  }

  function save() {
    setSaveError(null)
    startSaving(async () => {
      try {
        await saveSurfaceChanges(changes)
        setDraft({})
        setEditing(false)
        onChanged()
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : 'Could not save the changes')
      }
    })
  }

  const countOf = (key: RoleType) => people.filter(p => p.roleType === key).length
  const shown = filter === 'all' ? people : people.filter(p => p.roleType === filter)

  return (
    <div className="space-y-10">
      {/* ── Editable matrix ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <h2 className="font-(family-name:--font-display) font-extrabold text-[19px] text-tn-ink m-0">What each level can do</h2>
            <p className="mt-1 text-[13.5px] text-muted leading-relaxed m-0">
              {editing
                ? 'Click a tick to allow or block that page. Nothing is applied until you press Save.'
                : 'What each level reaches today. Press Edit to change it.'}
              {' '}<strong className="font-semibold text-tn-ink">Admin</strong> is not listed because it always has everything, which is what makes it impossible to lock yourself out.
            </p>
            {saveError && <p className="mt-1.5 text-[12.5px] text-red-600 m-0">{saveError}</p>}
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {editing && (
              <span className="text-[12.5px] text-muted tabular-nums">
                {changes.length === 0 ? 'No changes' : `${changes.length} ${changes.length === 1 ? 'change' : 'changes'}`}
              </span>
            )}
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={cancel}
                  disabled={saving}
                  className="inline-flex items-center rounded-full px-[15px] py-2 font-(family-name:--font-display) font-extrabold text-[12px] border border-slate-200 text-foreground hover:border-slate-300 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving || changes.length === 0}
                  className="inline-flex items-center gap-2 rounded-full px-[17px] py-2 font-(family-name:--font-display) font-extrabold text-[12px] bg-tn-primary border border-tn-primary text-white shadow-[0_8px_18px_-8px_rgba(1,35,88,.6)] transition-transform hover:-translate-y-px disabled:opacity-50 disabled:translate-y-0"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F2C40A" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 13 4 4L19 7" /></svg>
                  <span className="text-[#ffffff]">{saving ? 'Saving…' : 'Save'}</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-2 rounded-full px-[17px] py-2 font-(family-name:--font-display) font-extrabold text-[12px] bg-tn-primary border border-tn-primary text-white shadow-[0_8px_18px_-8px_rgba(1,35,88,.6)] transition-transform hover:-translate-y-px"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F2C40A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
                <span className="text-[#ffffff]">Edit</span>
              </button>
            )}
          </div>
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
                          {sf.note && <p className="mt-1 text-[12px] text-muted leading-relaxed m-0">{sf.note}</p>}
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
                              ) : editing ? (
                                <ToggleCell
                                  label={`${sf.label}, ${r}`}
                                  on={on}
                                  changed={isChanged(r, sf.key)}
                                  onFlip={() => flip(r, sf.key)}
                                />
                              ) : (
                                <StaticCell on={on} reason={on ? 'allowed' : 'not allowed'} />
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
            <p className="mt-1 text-[13.5px] text-muted leading-relaxed m-0">
              Changing a level here sets both the interface and the security role, so it takes effect the next time
              that person loads a page. For anyone who has never signed in, it is applied for them the moment they do.
            </p>
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
