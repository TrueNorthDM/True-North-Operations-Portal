'use client'

/**
 * FavoritesBlock — the user's pinned destinations (up to 5) on Home.
 * Display: a row of link cards. Edit: an inline picker over the catalog
 * (grouped, capped at MAX_FAVORITES — extra options disable at the cap).
 * Saved per user in the DB via saveFavorites; empty state offers the action.
 */

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveFavorites } from '@/lib/favorites/actions'
import { MAX_FAVORITES, type FavoriteTarget } from '@/lib/favorites/catalog'

export interface Favorite {
  href: string
  label: string
}

const StarIcon = (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
  </svg>
)

export function FavoritesBlock({ favorites, catalog }: { favorites: Favorite[]; catalog: FavoriteTarget[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const groups = useMemo(() => {
    const out = new Map<string, FavoriteTarget[]>()
    for (const t of catalog) {
      const arr = out.get(t.group) ?? []
      arr.push(t)
      out.set(t.group, arr)
    }
    return [...out.entries()]
  }, [catalog])

  function openEditor() {
    setSelected(favorites.map(f => f.href))
    setError(null)
    setEditing(true)
  }

  function toggle(href: string) {
    setSelected(prev =>
      prev.includes(href) ? prev.filter(h => h !== href) : prev.length >= MAX_FAVORITES ? prev : [...prev, href],
    )
  }

  function save() {
    setError(null)
    startTransition(async () => {
      try {
        await saveFavorites(selected)
        setEditing(false)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save favourites')
      }
    })
  }

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="text-lg font-bold text-tn-ink">My favourites</h2>
        {!editing && (
          <button
            type="button"
            onClick={openEditor}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-3 py-1.5 bg-white"
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="rounded-xl border border-slate-300 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-600">Pick up to {MAX_FAVORITES} destinations to pin here.</p>
            <span className={`text-xs font-semibold ${selected.length >= MAX_FAVORITES ? 'text-amber-600' : 'text-slate-400'}`}>
              {selected.length}/{MAX_FAVORITES}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3">
            {groups.map(([group, targets]) => (
              <div key={group}>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">{group}</div>
                <ul className="space-y-1">
                  {targets.map(t => {
                    const checked = selected.includes(t.href)
                    const capped = !checked && selected.length >= MAX_FAVORITES
                    return (
                      <li key={t.href}>
                        <label className={`flex items-center gap-2 text-sm rounded px-1.5 py-1 ${capped ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-50'}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={capped}
                            onChange={() => toggle(t.href)}
                            className="w-4 h-4 rounded border-slate-300"
                          />
                          <span className="text-slate-700">{t.label}</span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={save}
              className="px-4 py-2 text-sm font-medium bg-primary hover:opacity-90 text-[#ffffff] rounded-lg transition-colors disabled:opacity-50"
            >
              {pending ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-4 py-2 text-sm font-medium text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : favorites.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white/50 px-5 py-8 text-center">
          <p className="text-sm text-slate-500">Nothing pinned yet — keep your most-used pages one click away.</p>
          <button
            type="button"
            onClick={openEditor}
            className="mt-3 px-4 py-2 text-sm font-medium bg-primary hover:opacity-90 text-[#ffffff] rounded-lg transition-colors"
          >
            Choose favourites
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
          {favorites.map(f => (
            <Link
              key={f.href}
              href={f.href}
              className="group flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 py-3 transition-all hover:-translate-y-0.5 hover:border-tn-teal hover:shadow-md"
            >
              <span className="text-tn-accent shrink-0">{StarIcon}</span>
              <span className="text-sm font-semibold text-tn-ink truncate">{f.label}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
