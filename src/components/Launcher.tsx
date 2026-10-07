'use client'

/**
 * Launcher: the search in the top bar (navigation redesign, 22 September
 * 2026). An icon only; the overlay carries the input. Cmd+K (Ctrl+K) opens it
 * from anywhere, Escape closes it, the arrows move through the results and
 * Enter opens one.
 *
 * It offers exactly what the rail offers this person (the same resolved model,
 * lib/access/nav.ts), plus the person's own Settings, plus the people
 * in the Directory for whoever may open it, loaded the first time it opens.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { withViewAs } from '@/components/ViewAsKeeper'
import { NavIcon } from '@/components/NavIcon'
import type { NavIconKey } from '@/lib/nav/nav-icons'
import type { ResolvedEntry } from '@/lib/access/nav'
import { pageGroups } from '@/lib/settings/pages'
import { launcherPeople } from '@/app/(app)/launcher-actions'

interface Row { key: string; label: string; href: string; icon: NavIconKey; soon?: boolean }
interface Group { label: string; rows: Row[] }

/** The rail, regrouped the way a person thinks of it (lib/settings/pages.ts), plus Settings, which everyone has. */
function groupsFrom(rail: ResolvedEntry[]): Group[] {
  const groups: Group[] = pageGroups(rail)
  groups[0].rows.push({ key: 'settings', label: 'Settings', href: '/settings', icon: 'settings' })
  return groups
}

export function Launcher({ rail, canPeople = false, startOpen = false }: {
  rail: ResolvedEntry[]
  canPeople?: boolean
  /** Design check only: open without a click. */
  startOpen?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(startOpen)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [people, setPeople] = useState<{ id: string; name: string }[] | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)

  const show = () => {
    setOpen(true)
    setQuery('')
    setActive(0)
    if (canPeople && people === null) launcherPeople().then(setPeople).catch(() => setPeople([]))
  }
  const close = () => setOpen(false)

  // Cmd+K / Ctrl+K from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (open) close()
        else show()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  useEffect(() => { if (open) input.current?.focus({ preventScroll: true }) }, [open])

  const q = query.trim().toLowerCase()
  const groups = useMemo(() => {
    const all = groupsFrom(rail)
    if (q && people?.length) {
      all.push({ label: 'Colleagues', rows: people.map(p => ({ key: `person-${p.id}`, label: p.name, href: `/directory?open=${p.id}`, icon: 'directory' as const })) })
    }
    // Each row carries its place in the whole list, for the arrow keys.
    let i = 0
    return all
      .map(g => ({ ...g, rows: g.rows.filter(r => !q || r.label.toLowerCase().includes(q)).slice(0, g.label === 'Colleagues' ? 8 : undefined) }))
      .filter(g => g.rows.length > 0)
      .map(g => ({ ...g, rows: g.rows.map(r => ({ ...r, i: i++ })) }))
  }, [rail, people, q])
  const flat = groups.flatMap(g => g.rows)
  const at = Math.min(active, Math.max(0, flat.length - 1))

  const openRow = (r: Row) => {
    close()
    router.push(withViewAs(r.href))
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); close() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(at + 1, flat.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(at - 1, 0)) }
    else if (e.key === 'Enter' && flat[at]) { e.preventDefault(); openRow(flat[at]) }
  }

  // Keep the highlighted row in view as the arrows move it.
  useEffect(() => {
    list.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [at, open])

  return (
    <>
      <button
        type="button"
        onClick={show}
        aria-label="Search the portal"
        title="Go to a tool, page or person (⌘K)"
        className="inline-flex items-center justify-center w-10 h-10 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-tn-teal/40 text-slate-400 hover:bg-slate-100 hover:text-tn-primary"
      >
        <NavIcon name="launcher" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-[rgba(1,35,88,.28)] flex items-start justify-center px-4 pt-[90px]" onMouseDown={e => { if (e.target === e.currentTarget) close() }}>
          <div role="dialog" aria-label="Search the portal" className="w-[560px] max-w-full bg-white rounded-[14px] shadow-[0_24px_60px_rgba(1,35,88,.25)] overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-[var(--panel-border)]">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8593a4" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input
                ref={input}
                value={query}
                onChange={e => { setQuery(e.target.value); setActive(0) }}
                onKeyDown={onKeyDown}
                placeholder={canPeople ? 'Tool, page or person…' : 'Tool or page…'}
                aria-label="Search"
                className="flex-1 border-0 outline-none bg-transparent text-[15px] text-tn-ink placeholder:text-muted"
              />
              <kbd className="text-[11px] border border-[var(--panel-border)] rounded-[5px] px-1.5 py-px text-muted font-sans">esc</kbd>
            </div>
            <div ref={list} className="max-h-[400px] overflow-y-auto p-2">
              {groups.length === 0 && <p className="px-3 py-6 text-center text-[13.5px] text-muted m-0">{`Nothing matches “${query.trim()}”.`}</p>}
              {groups.map(g => (
                <div key={g.label} className="pt-1 pb-1.5">
                  <div className="px-2.5 pt-1.5 pb-1 text-[10.5px] font-bold tracking-[.09em] uppercase text-muted">{g.label}</div>
                  {g.rows.map(r => {
                    const on = r.i === at
                    return (
                      <button
                        key={r.key}
                        type="button"
                        data-active={on}
                        onMouseEnter={() => setActive(r.i)}
                        onClick={() => openRow(r)}
                        className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] text-tn-ink ${on ? 'bg-subtle' : ''}`}
                      >
                        <NavIcon name={r.icon} size={16} className="text-slate-500 shrink-0" />
                        <span className="flex-1">{r.label}</span>
                        {r.soon && <span className="rounded bg-[#fbf1cf] px-[5px] py-0.5 text-[9.5px] font-bold tracking-[.06em] text-[#a67c04]">SOON</span>}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
