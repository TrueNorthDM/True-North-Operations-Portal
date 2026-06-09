'use client'

/**
 * TestChecklist — interactive manual-test checklist (data from lib/tests/data.ts).
 * Ticking a check is remembered in localStorage per browser, so you can work
 * through the system across sittings. Read-only data; the checks themselves are
 * maintained in the repo by Claude.
 */

import { useEffect, useMemo, useState } from 'react'
import { TEST_AREAS } from '@/lib/tests/data'

const STORAGE_KEY = 'tn:tests:checked'

export function TestChecklist() {
  const total = useMemo(() => TEST_AREAS.reduce((n, a) => n + a.cases.length, 0), [])
  const [checked, setChecked] = useState<Set<string>>(new Set())

  // Hydrate from localStorage on mount (SSR-safe). One-time mount hydration —
  // the synchronous setState is intentional (localStorage can't be read during
  // SSR without a hydration mismatch), so we opt out of the React 19 rule here.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setChecked(new Set(JSON.parse(raw) as string[]))
    } catch { /* ignore */ }
  }, [])

  function toggle(id: string) {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }

  function reset() {
    setChecked(new Set())
    try { window.localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }

  const done = checked.size
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
          <a href="/" className="hover:text-slate-800">Dashboard</a>
          <span>/</span>
          <a href="/admin" className="hover:text-slate-800">Admin</a>
          <span>/</span>
          <span>Tests</span>
        </div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Tests</h1>
            <p className="mt-1 text-sm text-slate-500">Walk through the whole system and tick off what works. Saved in this browser.</p>
          </div>
          <button type="button" onClick={reset} className="shrink-0 text-xs font-medium text-slate-500 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50">
            Reset
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="rounded-xl bg-white border border-slate-200 p-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-medium text-slate-700">Verified</span>
          <span className="text-slate-500">{done} / {total} ({pct}%)</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2">
          <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {TEST_AREAS.map(area => {
        const areaDone = area.cases.filter(c => checked.has(c.id)).length
        return (
          <section key={area.area} className="rounded-xl bg-white border border-slate-200 overflow-hidden">
            <div className="flex items-baseline gap-2 px-5 py-3 border-b border-slate-100 bg-slate-50">
              <h2 className="text-sm font-bold text-slate-800">{area.area}</h2>
              <span className="text-xs text-slate-400">{areaDone}/{area.cases.length}</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {area.cases.map(c => {
                const isChecked = checked.has(c.id)
                return (
                  <li key={c.id}>
                    <label className={`flex gap-3 px-5 py-4 cursor-pointer hover:bg-slate-50/60 ${isChecked ? 'opacity-60' : ''}`}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggle(c.id)}
                        className="mt-0.5 w-4 h-4 rounded border-slate-300 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-slate-400">{c.id}</span>
                          {c.needs && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">needs: {c.needs}</span>
                          )}
                        </div>
                        <p className={`text-sm text-slate-800 mt-0.5 ${isChecked ? 'line-through decoration-slate-300' : ''}`}>{c.check}</p>
                        <p className="text-xs text-slate-500 mt-0.5"><span className="font-medium text-slate-400">Expect:</span> {c.expect}</p>
                      </div>
                    </label>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
