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

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { SearchField } from '@/components/ui/SearchField'
import {
  setBoardIncluded, setWorkspaceIncluded, setUserHidden, setBoardPriority, setWorkspacePriority,
} from '@/app/(app)/admin/settings/monday/actions'
import { StaleRuleToggle } from '@/components/monday/StaleRuleToggle'
import type { WorklistSources, Priority } from '@/lib/monday/worklist/sources'

const PRIORITIES: Priority[] = ['high', 'medium', 'low']

const PRIORITY_STYLE: Record<Priority, string> = {
  high: 'border-[#c2410c] text-[#c2410c] bg-[rgba(194,65,12,.08)]',
  medium: 'border-slate-300 text-tn-ink bg-slate-50',
  low: 'border-slate-200 text-muted',
}

/**
 * Three buttons rather than a dropdown, because the whole set is three items
 * and the current one should be readable without opening anything: this row is
 * scanned far more often than it is changed.
 */
function PriorityPicker({ value, onChange, busy }: {
  value: Priority; onChange: (p: Priority) => void; busy: boolean
}) {
  return (
    <span className="shrink-0 inline-flex rounded-[8px] overflow-hidden border border-slate-200">
      {PRIORITIES.map(p => (
        <button
          key={p}
          type="button"
          disabled={busy}
          onClick={() => onChange(p)}
          aria-pressed={value === p}
          className={`text-[11px] font-bold px-2 py-1.5 capitalize transition-colors border-r border-slate-200 last:border-r-0 ${
            value === p ? PRIORITY_STYLE[p] : 'text-slate-400 hover:text-tn-ink hover:bg-slate-50'
          }`}
        >
          {p}
        </button>
      ))}
    </span>
  )
}

const card = 'rounded-[14px] border border-slate-200 bg-white overflow-hidden'

function ago(iso: string | null): { text: string; stale: boolean } {
  if (!iso) return { text: 'never', stale: true }
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 1) return { text: 'today', stale: false }
  if (days < 30) return { text: `${days}d ago`, stale: false }
  const months = Math.round(days / 30)
  if (months < 12) return { text: `${months}mo ago`, stale: months >= 6 }
  return { text: `${(days / 365).toFixed(1)}y ago`, stale: true }
}

function Toggle({ on, onChange, busy, labelOn = 'Shown', labelOff = 'Not shown' }: {
  on: boolean; onChange: (v: boolean) => void; busy: boolean; labelOn?: string; labelOff?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={busy}
      onClick={() => onChange(!on)}
      className={`shrink-0 text-xs font-bold px-2.5 py-1.5 rounded-[8px] border transition-colors ${
        on ? 'border-tn-teal text-tn-teal bg-[rgba(30,125,127,.06)]' : 'border-slate-200 text-muted hover:text-tn-ink'
      }`}
    >
      {on ? labelOn : labelOff}
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
      {error && <div className="rounded-[10px] border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

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
        <div className="flex items-center gap-1 border-b border-slate-200">
          {(['boards', 'people'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3.5 py-2 text-sm font-semibold -mb-px border-b-2 transition-colors ${
                tab === t ? 'border-tn-teal text-tn-ink' : 'border-transparent text-muted hover:text-tn-ink'
              }`}
            >
              {t === 'boards' ? 'Workspaces & boards' : 'People'}
            </button>
          ))}
        </div>
        <SearchField value={q} onChange={setQ} placeholder="Search…" className="w-full sm:w-[300px]" />
        <span className="text-sm text-muted ml-auto">
          {tab === 'boards' ? `${hiddenBoards} boards not shown` : `${hiddenUsers} people not shown`}
        </span>
      </div>

      {tab === 'boards' && workspaces.map(w => {
        const seen = ago(w.lastActivityAt)
        const allOn = w.included === w.boards.length
        // Shown as the workspace's own only when its boards agree; otherwise
        // medium sits unhighlighted and pressing one sets them all.
        const levels = new Set(w.boards.map(b => b.priority))
        const wPriority: Priority = levels.size === 1 ? [...levels][0] : 'medium'
        return (
          <div key={w.name} className={card}>
            <div className="flex items-center gap-3 px-5 py-3.5">
              <button onClick={() => toggleOpen(w.name)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
                <span className={`shrink-0 text-muted transition-transform ${open.has(w.name) ? 'rotate-90' : ''}`} aria-hidden="true">›</span>
                <span className="min-w-0">
                  <span className="block font-(family-name:--font-display) font-extrabold text-tn-ink text-[15px] truncate">{w.name}</span>
                  {/* No badge beside the button. "Quiet" read as a control
                      sitting next to a control, when it is a fact, and the
                      line already carried it: emphasising the words that say
                      it is clearer than adding a word that repeats it. */}
                  <span className="block text-xs text-muted">
                    {w.included} of {w.boards.length} boards · {w.assignments} assignments ·{' '}
                    <span className={seen.stale ? 'font-bold text-[#b06d0a]' : ''}>last used {seen.text}</span>
                  </span>
                </span>
              </button>
              <PriorityPicker
                value={wPriority}
                busy={busy}
                onChange={p => run(() => setWorkspacePriority(w.name, p))}
              />
              <Toggle
                on={allOn}
                busy={busy}
                labelOn="Shown"
                labelOff={w.included === 0 ? 'Not shown' : 'Partly shown'}
                onChange={v => run(() => setWorkspaceIncluded(w.name, v))}
              />
            </div>

            {open.has(w.name) && (
              <ul className="m-0 p-0 list-none border-t border-slate-100">
                {w.boards.map(b => {
                  const s = ago(b.lastActivityAt)
                  return (
                    <li key={b.id} className="px-5 py-2.5 border-b border-slate-100 last:border-b-0 flex items-center gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-semibold text-tn-ink truncate">
                          {b.name}
                          {b.isSubitemBoard && <span className="ml-2 text-[10px] font-bold uppercase text-muted">subitems</span>}
                        </span>
                        <span className="block text-xs text-muted">
                          {b.assignments} assignments ·{' '}
                          <span className={s.stale ? 'font-bold text-[#b06d0a]' : ''}>last used {s.text}</span>
                        </span>
                      </span>
                      <PriorityPicker
                        value={b.priority}
                        busy={busy}
                        onChange={p => run(() => setBoardPriority(b.id, p))}
                      />
                      <Toggle on={b.included} busy={busy} onChange={v => run(() => setBoardIncluded(b.id, v))} />
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
                    {u.personName ? `${u.name} · ` : ''}{u.email ?? `id ${u.mondayUserId}`} · {u.assignments} assignments
                  </span>
                </span>
                <Toggle on={!u.hidden} busy={busy} onChange={v => run(() => setUserHidden(u.mondayUserId, !v))} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-muted leading-relaxed m-0">
        Priority orders the On-going block of My Work and changes nothing else: it does not hide anything and
        does not affect the reports. Nothing in Monday knows which boards matter most, because a row count says
        how busy a board is and a deadline says what is urgent, and neither is the same as important. The
        buttons on the right are the switches; everything else on a row is a fact about it. A date in amber
        means nothing has moved on that board for more than six months, which is usually what makes it safe to
        switch off. Hiding changes what My Work shows and nothing else. Everything here is still ingested, still counted, and
        still visible in the reports: a board switched off stops filling somebody&apos;s list, it does not disappear.
        Turn any of it back on and the work returns at the next refresh.
      </p>
    </div>
  )
}
