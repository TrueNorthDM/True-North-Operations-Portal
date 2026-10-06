'use client'

/**
 * TestChecklist: pre-launch QA checklist (data from lib/tests/data.ts).
 * Tri-state per check (pass / fail / skip / not-run) plus an optional note,
 * remembered in localStorage per browser. Read-only data, the checks are
 * maintained in the repo. Styling matches the handoff prototype.
 */

import { useEffect, useMemo, useState } from 'react'
import { TEST_AREAS } from '@/lib/tests/data'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { BTN_ICON } from '@/lib/ui/buttons'

type Result = 'pass' | 'fail' | 'skip'
type Filter = 'all' | 'pass' | 'fail' | 'skip' | 'none'

const STORAGE_KEY = 'tn:tests:v2'
const C: Record<Result, string> = { pass: '#127A3E', fail: '#E11D2A', skip: '#94a1b2' }

// Per-area emoji (keyed by area name; falls back to a clipboard).
const AREA_ICON: Record<string, string> = {
  'Navigation & access': '🧭',
  'Account': '🎨',
  'Home · Widgets & favourites': '🏠',
  'Home · Org chart': '🌳',
  'Admin · Tickets': '🎫',
  'Admin · System manual': '📖',
  'Admin · People': '👤',
  'Admin · Teams': '👥',
  'Admin · Access': '🔑',
  'Access enforcement': '🔒',
  'Projects · hreflang': '🌐',
  'Settings · Publishing targets': '🎯',
  'Tools · Budget Usage Report': '💵',
  'Dashboards': '📊',
}

export function TestChecklist() {
  const total = useMemo(() => TEST_AREAS.reduce((n, a) => n + a.cases.length, 0), [])
  const [results, setResults] = useState<Record<string, Result>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [noteOpen, setNoteOpen] = useState<Record<string, boolean>>({})
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [filter, setFilter] = useState<Filter>('all')

  // One-time hydration from localStorage (SSR can't read it without a mismatch).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as { results?: Record<string, Result>; notes?: Record<string, string> }
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (parsed.results) setResults(parsed.results)
        if (parsed.notes) setNotes(parsed.notes)
      }
    } catch { /* ignore */ }
  }, [])

  function persist(nextResults: Record<string, Result>, nextNotes: Record<string, string>) {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ results: nextResults, notes: nextNotes })) } catch { /* ignore */ }
  }

  function setResult(id: string, value: Result) {
    setResults(prev => {
      const next = { ...prev }
      if (next[id] === value) delete next[id] // click the active state again → clear
      else next[id] = value
      persist(next, notes)
      return next
    })
  }

  function setNote(id: string, value: string) {
    setNotes(prev => {
      const next = { ...prev, [id]: value }
      persist(results, next)
      return next
    })
  }

  function reset() {
    setResults({})
    setNotes({})
    setNoteOpen({})
    setFilter('all')
    try { window.localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }

  const counts = useMemo(() => {
    let pass = 0, fail = 0, skip = 0
    for (const v of Object.values(results)) {
      if (v === 'pass') pass++
      else if (v === 'fail') fail++
      else if (v === 'skip') skip++
    }
    return { pass, fail, skip, none: total - pass - fail - skip, reviewed: pass + fail + skip }
  }, [results, total])
  const pct = total > 0 ? Math.round((counts.reviewed / total) * 100) : 0

  const matchFilter = (v: Result | undefined) =>
    filter === 'all' ? true : filter === 'none' ? !v : v === filter

  const STAT_CARDS: { key: Filter; label: string; count: number; color: string }[] = [
    { key: 'all', label: 'All checks', count: total, color: '#0f2036' },
    { key: 'pass', label: 'Passing', count: counts.pass, color: C.pass },
    { key: 'fail', label: 'Failing', count: counts.fail, color: C.fail },
    { key: 'skip', label: 'Skipped', count: counts.skip, color: C.skip },
    { key: 'none', label: 'Not run', count: counts.none, color: '#5b6b82' },
  ]

  const sections = TEST_AREAS.map(area => {
    let sPass = 0, sFail = 0, sSkip = 0
    for (const c of area.cases) {
      const v = results[c.id]
      if (v === 'pass') sPass++
      else if (v === 'fail') sFail++
      else if (v === 'skip') sSkip++
    }
    const sReviewed = sPass + sFail + sSkip
    const items = area.cases.filter(c => matchFilter(results[c.id]))
    return { area, items, sPass, sFail, sReviewed, allPass: sPass === area.cases.length }
  }).filter(s => s.items.length > 0)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-5 flex-wrap">
        <div>
          <Breadcrumb parents={['/admin']} now="Tests" />
          <h1 className="text-2xl font-(family-name:--font-display) font-extrabold tracking-tight text-tn-ink">Tests</h1>
          <p className="mt-1.5 max-w-2xl text-muted">A pre-launch checklist to verify the whole system end-to-end. Walk each area, tick off what works, flag what doesn’t.</p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="shrink-0 inline-flex items-center gap-1.5 font-(family-name:--font-display) font-extrabold text-[13px] text-foreground bg-white border border-slate-200 rounded-[10px] px-3.5 py-2.5 transition-colors hover:border-tn-teal hover:text-tn-teal"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
          Reset checklist
        </button>
      </div>

      {/* Progress */}
      <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
        <div className="flex items-baseline justify-between gap-4 mb-3">
          <div className="flex items-baseline gap-2.5">
            <span className="font-(family-name:--font-display) font-black text-2xl leading-none text-tn-ink">{pct}%</span>
            <span className="text-[13.5px] font-semibold text-muted">{counts.reviewed} of {total} reviewed</span>
          </div>
          <span className="text-[13px] text-muted">
            <strong className="font-extrabold" style={{ color: C.pass }}>{counts.pass} passing</strong>
            {counts.fail > 0 && <> · <strong className="font-extrabold" style={{ color: C.fail }}>{counts.fail} failing</strong></>}
          </span>
        </div>
        <div className="h-[11px] rounded-full bg-slate-100 overflow-hidden flex">
          <div style={{ width: `${(counts.pass / total) * 100}%`, background: C.pass }} />
          <div style={{ width: `${(counts.fail / total) * 100}%`, background: C.fail }} />
          <div style={{ width: `${(counts.skip / total) * 100}%`, background: C.skip }} />
        </div>
      </div>

      {/* Stat / filter cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {STAT_CARDS.map(card => {
          const activeCard = filter === card.key
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => setFilter(activeCard && card.key !== 'all' ? 'all' : card.key)}
              className={`text-left rounded-[13px] border px-[17px] py-[15px] shadow-sm transition-all ${activeCard ? 'border-transparent text-[#ffffff]' : 'bg-white border-slate-200 text-tn-ink hover:border-slate-300'}`}
              style={activeCard ? { background: card.color } : undefined}
            >
              <div className="font-(family-name:--font-display) font-extrabold text-[26px] leading-none">{card.count}</div>
              <div className={`text-[12.5px] font-semibold mt-[7px] ${activeCard ? 'opacity-90' : 'text-muted'}`}>{card.label}</div>
            </button>
          )
        })}
      </div>

      {/* Sections */}
      {sections.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 p-14 text-center">
          <div className="font-(family-name:--font-display) font-extrabold text-base text-foreground">No checks in this view</div>
          <div className="mt-1 text-sm text-muted">Nothing matches the current filter.</div>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {sections.map(({ area, items, sPass, sFail, sReviewed, allPass }) => {
            const open = filter !== 'all' ? true : !collapsed[area.area]
            const tallyStyle = sFail > 0
              ? { background: 'rgba(225,29,42,.12)', color: '#E11D2A' }
              : allPass
                ? { background: 'rgba(18,122,62,.14)', color: '#127A3E' }
                : undefined
            return (
              <section key={area.area} className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
                <button
                  type="button"
                  onClick={() => setCollapsed(prev => ({ ...prev, [area.area]: !prev[area.area] }))}
                  className="w-full text-left bg-subtle border-b border-slate-200 flex items-center gap-3 px-5 py-3.5"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 text-muted transition-transform ${open ? 'rotate-90' : ''}`}><path d="m9 6 6 6-6 6" /></svg>
                  <span className="shrink-0 inline-flex w-[30px] h-[30px] items-center justify-center rounded-[9px] bg-tn-teal-soft text-[15px]">{AREA_ICON[area.area] ?? '📋'}</span>
                  <span className="font-(family-name:--font-display) font-extrabold text-base text-tn-ink">{area.area}</span>
                  <span
                    className={`font-(family-name:--font-display) font-extrabold text-[11px] px-2.5 py-[3px] rounded-full ${tallyStyle ? '' : 'bg-tn-teal-soft text-tn-teal'}`}
                    style={tallyStyle}
                  >
                    {sFail > 0 ? `${sFail} failing` : allPass ? 'All passing' : `${sPass} passing`}
                  </span>
                  <span className="ml-auto text-[12.5px] font-semibold text-muted">{sReviewed}/{area.cases.length} reviewed</span>
                </button>
                {open && (
                  <div>
                    {items.map(c => {
                      const v = results[c.id]
                      const dot = v ? C[v] : '#cbd2da'
                      const showNote = !!noteOpen[c.id]
                      return (
                        <div key={c.id} className="flex items-start gap-4 px-5 py-4 border-b border-slate-100 last:border-0">
                          <span className="mt-[6px] w-[9px] h-[9px] rounded-full shrink-0" style={{ background: dot }} aria-hidden="true" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-(family-name:--font-display) font-bold text-[14.5px] text-tn-ink">{c.check}</span>
                              {c.needs && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">needs: {c.needs}</span>
                              )}
                            </div>
                            <div className="text-[13px] leading-relaxed text-muted mt-1"><span className="font-semibold text-slate-400">Expect:</span> {c.expect}</div>
                            {showNote && (
                              <textarea
                                value={notes[c.id] ?? ''}
                                onChange={e => setNote(c.id, e.target.value)}
                                placeholder="Add a note, what broke, repro steps, ticket link…"
                                rows={2}
                                className="w-full mt-2.5 resize-y rounded-[9px] border border-slate-200 px-3 py-2 text-[13px] text-foreground bg-subtle outline-none leading-relaxed focus:ring-2 focus:ring-tn-teal/30"
                              />
                            )}
                          </div>
                          <div className="flex-none flex items-center gap-2.5">
                            <div className="inline-flex rounded-[9px] border border-slate-200 overflow-hidden bg-white">
                              {(['pass', 'fail', 'skip'] as Result[]).map((r, i) => (
                                <button
                                  key={r}
                                  type="button"
                                  onClick={() => setResult(c.id, r)}
                                  title={r[0].toUpperCase() + r.slice(1)}
                                  className={`inline-flex items-center justify-center gap-1 font-(family-name:--font-display) font-extrabold text-[12px] px-3 py-2 transition-colors ${i > 0 ? 'border-l border-slate-200' : ''} ${v === r ? 'text-[#ffffff]' : 'text-muted hover:bg-subtle'}`}
                                  style={v === r ? { background: C[r] } : undefined}
                                >
                                  {r === 'pass' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>}
                                  {r === 'fail' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>}
                                  {r === 'pass' ? 'Pass' : r === 'fail' ? 'Fail' : 'Skip'}
                                </button>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() => setNoteOpen(prev => ({ ...prev, [c.id]: !prev[c.id] }))}
                              title="Note"
                              className={`flex-none inline-flex w-[34px] h-[34px] items-center justify-center rounded-[9px] border border-slate-200 bg-white transition-colors hover:bg-subtle ${notes[c.id] ? 'text-tn-teal' : 'text-muted'}`}
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
