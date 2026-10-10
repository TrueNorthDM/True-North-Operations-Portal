'use client'

/**
 * What My Work is allowed to show: workspaces, boards, people.
 *
 * Ordered by how much work each holds, and every row carries the two facts
 * that make the decision possible: how many assignments ride on it and when it
 * was last touched. "Boards we have not used in a long time" is a real
 * category and nobody can list it from memory; sorted by last activity, it
 * lists itself.
 */

import { useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { SearchField } from '@/components/ui/SearchField'
import { Segmented } from '@/components/ui/Segmented'
import { tabKeys } from '@/components/ui/tab-keys'
import {
  setBoardIncluded, setWorkspaceIncluded, setUserHidden, setBoardPriority, setWorkspacePriority,
} from '@/app/(app)/admin/settings/monday/actions'
import { StaleRuleToggle } from '@/components/monday/StaleRuleToggle'
import { STALE_MONTHS } from '@/lib/monday/worklist/stale'
import type { WorklistSources, Priority } from '@/lib/monday/worklist/sources'

const PRIORITIES = [
  { key: 'high', label: 'High' },
  { key: 'medium', label: 'Medium' },
  { key: 'low', label: 'Low' },
] as const

const n = (v: number) => v.toLocaleString('en-US')

const TABS = [['boards', 'Workspaces & boards'], ['people', 'People']] as const
const TAB_KEYS = TABS.map(([k]) => k)

/**
 * Three choices rather than a dropdown, because the whole set is three items
 * and the current one should be readable without opening anything: this row is
 * scanned far more often than it is changed. The portal's one choice row
 * (Segmented), named for the board or workspace it sets (audit, 10 October 2026).
 */
function PriorityPicker({ name, value, onChange, busy }: {
  name: string; value: Priority; onChange: (p: Priority) => void; busy: boolean
}) {
  return (
    <span className="shrink-0">
      <Segmented<Priority> label={`Priority for ${name}`} options={PRIORITIES} value={value} onChange={onChange} disabled={busy} />
    </span>
  )
}

const card = 'rounded-[14px] border border-slate-200 bg-white overflow-hidden'

/** How long ago a board was last used. Exported for its test. */
export function ago(iso: string | null, now = Date.now()): { text: string; stale: boolean } {
  if (!iso) return { text: 'never', stale: true }
  const days = Math.floor((now - new Date(iso).getTime()) / 86_400_000)
  // `< 1`, not `<= 1`: a board last used yesterday said "today" (audit, 10 October 2026).
  if (days < 1) return { text: 'today', stale: false }
  if (days < 2) return { text: 'yesterday', stale: false }
  if (days < 30) return { text: `${days}d ago`, stale: false }
  const months = Math.round(days / 30)
  // Amber from the same age the activity rule hides at (stale.ts).
  if (months < 12) return { text: `${months}mo ago`, stale: months >= STALE_MONTHS }
  return { text: `${(days / 365).toFixed(1)}y ago`, stale: true }
}

/**
 * Shown or not, with the word on the button. Named for what it controls, so a
 * screen reader hears "Show SEO Audits on My Work, on" rather than "Shown"
 * (audit, 10 October 2026). A workspace with some boards on and some off is a
 * checkbox in its third state, "mixed", not off: role switch has no third
 * state, so the workspace's own toggle is a checkbox.
 */
function Toggle({ name, on, onChange, busy, group = false, partly = false }: {
  name: string; on: boolean; onChange: (v: boolean) => void; busy: boolean
  /** A workspace's toggle, for all of its boards at once. */
  group?: boolean
  /** Some of the workspace's boards shown, some not. */
  partly?: boolean
}) {
  return (
    <button
      type="button"
      role={group ? 'checkbox' : 'switch'}
      aria-checked={partly ? 'mixed' : on}
      aria-label={`Show ${name} on My Work`}
      disabled={busy}
      onClick={() => onChange(!on)}
      className={`shrink-0 text-xs font-bold px-2.5 py-1.5 rounded-[8px] border transition-colors ${
        on ? 'border-tn-teal text-tn-teal bg-[rgba(30,125,127,.06)]' : 'border-slate-200 text-muted hover:text-tn-ink'
      }`}
    >
      {on ? 'Shown' : partly ? 'Partly shown' : 'Not shown'}
    </button>
  )
}

export function WorklistSources({ sources }: { sources: WorklistSources }) {
  const router = useRouter()
  const [busy, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState<'boards' | 'people'>('boards')
  const [q, setQ] = useState('')
  const uid = useId()

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null)
    startTransition(async () => {
      const r = await fn()
      if (!r.ok) setError(r.error ?? 'Something went wrong.')
      else router.refresh()
    })
  }

  const toggleOpen = (name: string) => {
    const next = new Set(open)
    if (next.has(name)) next.delete(name); else next.add(name)
    setOpen(next)
  }

  const needle = q.trim().toLowerCase()
  const workspaces = needle
    ? sources.workspaces
        .map(w => ({ ...w, boards: w.boards.filter(b => `${w.name} ${b.name}`.toLowerCase().includes(needle)) }))
        .filter(w => w.boards.length > 0)
    : sources.workspaces
  const users = needle
    ? sources.users.filter(u => `${u.name} ${u.email ?? ''} ${u.personName ?? ''}`.toLowerCase().includes(needle))
    : sources.users

  const hiddenBoards = sources.workspaces.reduce((s, w) => s + (w.boards.length - w.included), 0)
  const hiddenUsers = sources.users.filter(u => u.hidden).length

  return (
    <div className="space-y-4">
      {error && <div role="alert" className="rounded-[10px] border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      {/* Above the tabs, because it governs the boards list below it and not
          the People tab beside it. */}
      {tab === 'boards' ? (
        <StaleRuleToggle
          on={sources.stale.on}
          wouldHide={sources.stale.wouldHide}
          wouldShow={sources.stale.wouldShow}
        />
      ) : null}

      <div className="flex items-center gap-3 flex-wrap">
        <div
          role="tablist"
          aria-label="What My Work shows"
          onKeyDown={tabKeys(TAB_KEYS, tab, setTab)}
          className="flex items-center gap-1 border-b border-slate-200"
        >
          {TABS.map(([t, label]) => (
            <button
              key={t}
              type="button"
              role="tab"
              id={`${uid}-tab-${t}`}
              data-tab={t}
              aria-selected={tab === t}
              aria-controls={`${uid}-panel`}
              tabIndex={tab === t ? 0 : -1}
              onClick={() => setTab(t)}
              className={`px-3.5 py-2 text-sm font-semibold -mb-px border-b-2 transition-colors ${
                tab === t ? 'border-tn-teal text-tn-ink' : 'border-transparent text-muted hover:text-tn-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <SearchField value={q} onChange={setQ} placeholder="Search…" className="w-full sm:w-[300px]" />
        <span className="text-sm text-muted ml-auto">
          {tab === 'boards' ? `${n(hiddenBoards)} boards not shown` : `${n(hiddenUsers)} people not shown`}
        </span>
      </div>

      <div role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-tab-${tab}`} className="space-y-4">
        {tab === 'boards' && workspaces.map(w => {
          const seen = ago(w.lastActivityAt)
          const allOn = w.included === w.boards.length
          const isOpen = open.has(w.name)
          const boardsId = `${uid}-ws-${w.name.replace(/\W+/g, '-')}`
          // Shown as the workspace's own only when its boards agree; otherwise
          // medium sits unhighlighted and pressing one sets them all.
          const levels = new Set(w.boards.map(b => b.priority))
          const wPriority: Priority = levels.size === 1 ? [...levels][0] : 'medium'
          return (
            <div key={w.name} className={card}>
              <div className="flex items-center gap-3 px-5 py-3.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => toggleOpen(w.name)}
                  aria-expanded={isOpen}
                  aria-controls={boardsId}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left"
                >
                  <span className={`shrink-0 text-muted transition-transform ${isOpen ? 'rotate-90' : ''}`} aria-hidden="true">›</span>
                  <span className="min-w-0">
                    <span className="block font-(family-name:--font-display) font-extrabold text-tn-ink text-[15px] truncate">{w.name}</span>
                    {/* No badge beside the button. "Quiet" read as a control
                        sitting next to a control, when it is a fact, and the
                        line already carried it: emphasising the words that say
                        it is clearer than adding a word that repeats it. */}
                    <span className="block text-xs text-muted">
                      {`${n(w.included)} of ${n(w.boards.length)} boards · ${n(w.assignments)} assignments · `}
                      <span className={seen.stale ? 'font-bold text-[#b06d0a]' : ''}>last used {seen.text}</span>
                    </span>
                  </span>
                </button>
                <PriorityPicker
                  name={w.name}
                  value={wPriority}
                  busy={busy}
                  onChange={p => run(() => setWorkspacePriority(w.name, p))}
                />
                <Toggle
                  name={w.name}
                  group
                  on={allOn}
                  partly={!allOn && w.included > 0}
                  busy={busy}
                  onChange={v => run(() => setWorkspaceIncluded(w.name, v))}
                />
              </div>

              {isOpen && (
                <ul id={boardsId} className="m-0 p-0 list-none border-t border-slate-100">
                  {w.boards.map(b => {
                    const s = ago(b.lastActivityAt)
                    return (
                      <li key={b.id} className="px-5 py-2.5 border-b border-slate-100 last:border-b-0 flex items-center gap-3 flex-wrap">
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13.5px] font-semibold text-tn-ink truncate">
                            {b.name}
                            {b.isSubitemBoard && <span className="ml-2 text-[10px] font-bold uppercase text-muted">subitems</span>}
                          </span>
                          <span className="block text-xs text-muted">
                            {`${n(b.assignments)} assignments · `}
                            <span className={s.stale ? 'font-bold text-[#b06d0a]' : ''}>last used {s.text}</span>
                          </span>
                        </span>
                        <PriorityPicker
                          name={b.name}
                          value={b.priority}
                          busy={busy}
                          onChange={p => run(() => setBoardPriority(b.id, p))}
                        />
                        <Toggle name={b.name} on={b.included} busy={busy} onChange={v => run(() => setBoardIncluded(b.id, v))} />
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}

        {tab === 'people' && (
          <div className={card}>
            <ul className="m-0 p-0 list-none">
              {users.map(u => (
                <li key={u.mondayUserId} className="px-5 py-2.5 border-b border-slate-100 last:border-b-0 flex items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-semibold text-tn-ink truncate">
                      {u.personName ?? u.name}
                      {u.isExternal && <span className="ml-2 text-[10px] font-bold uppercase text-muted">outside</span>}
                    </span>
                    <span className="block text-xs text-muted truncate">
                      {u.personName ? `${u.name} · ` : ''}{u.email ?? `id ${u.mondayUserId}`}{` · ${n(u.assignments)} assignments`}
                    </span>
                  </span>
                  <Toggle name={`${u.personName ?? u.name}'s work`} on={!u.hidden} busy={busy} onChange={v => run(() => setUserHidden(u.mondayUserId, !v))} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <p className="text-xs text-muted leading-relaxed m-0">
        {`Priority orders the On-going block of My Work and nothing else: it hides nothing and does not affect the reports. Nothing in Monday knows which boards matter most, because a row count says how busy a board is and a deadline says what is urgent, and neither is the same as important. The buttons on the right are the switches; everything else on a row is a fact about it. A date in amber means nothing has moved on that board for more than ${STALE_MONTHS} months, which is usually what makes it safe to switch off. Switching something off changes only what My Work shows: it is still ingested, still counted and still in the reports, so a board switched off stops filling somebody's list without disappearing. Turn it back on and the work returns at the next refresh.`}
      </p>
    </div>
  )
}
