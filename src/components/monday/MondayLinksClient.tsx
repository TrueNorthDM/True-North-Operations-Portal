'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Select } from '@/components/ui/Select'
import { SearchField } from '@/components/ui/SearchField'
import { linkAccount, markExternal, clearAccount } from '@/app/(app)/admin/monday-links/actions'
import type { LinkBoard } from '@/lib/monday/worklist/links'

interface Option { value: string; label: string }

const card = 'rounded-[14px] border border-slate-200 bg-white overflow-hidden'
const head = 'px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3'
const title = 'font-(family-name:--font-display) font-extrabold text-tn-ink text-[15px] m-0'
const chip = 'inline-flex items-center text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-[5px]'
const btn = 'text-xs font-bold px-2.5 py-1.5 rounded-[8px] border transition-colors whitespace-nowrap'

export function MondayLinksClient({ board, people }: { board: LinkBoard; people: Option[] }) {
  const router = useRouter()
  const [busy, startTransition] = useTransition()
  const [q, setQ] = useState('')
  const [choice, setChoice] = useState<Record<number, string>>({})
  const [error, setError] = useState<string | null>(null)

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null)
    startTransition(async () => {
      const r = await fn()
      if (!r.ok) setError(r.error ?? 'Something went wrong.')
      else router.refresh()
    })
  }

  const match = (s: string) => !q || s.toLowerCase().includes(q.toLowerCase())
  const pending = board.pending.filter(a => match(`${a.name} ${a.email ?? ''}`))
  const external = board.external.filter(a => match(`${a.name} ${a.email ?? ''}`))
  const linked = board.linked.filter(a => match(`${a.name} ${a.personName}`))

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-[10px] border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      <SearchField value={q} onChange={setQ} placeholder="Search accounts…" className="max-w-[380px]" />

      {/* Ids on work with nobody behind them at all. */}
      {board.unknownIds.length > 0 && (
        <div className="rounded-[10px] border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-[#8a6d1a]">
          <strong className="font-extrabold">
            {board.unknownIds.length} account {board.unknownIds.length === 1 ? 'id is' : 'ids are'} on work but
            unknown to Monday&apos;s user list
          </strong>
          , holding {board.unknownIds.reduce((s, u) => s + u.assignments, 0)} assignments. These are usually
          people who left and are still named on old items. Run the discovery once more: it now asks Monday for
          deactivated accounts too, which it did not before.
        </div>
      )}

      <section className={card}>
        <div className={head}>
          <h2 className={title}>Waiting on an answer <span className="ml-2 text-xs font-bold text-muted">{board.pending.length}</span></h2>
          <span className="text-xs text-muted">Most work first</span>
        </div>
        {pending.length === 0 && <div className="px-5 py-8 text-center text-sm text-muted">Nothing pending.</div>}
        <ul className="m-0 p-0 list-none">
          {pending.map(a => (
            <li key={a.mondayUserId} className="px-5 py-3.5 border-b border-slate-100 last:border-b-0 flex items-center gap-3 flex-wrap">
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-bold text-tn-ink truncate">
                  {a.name}
                  {!a.enabled && <span className="ml-2 text-[10px] font-bold uppercase text-muted">deactivated</span>}
                  {a.isGuest && <span className="ml-2 text-[10px] font-bold uppercase text-muted">guest</span>}
                </span>
                <span className="block text-xs text-muted truncate">{a.email ?? 'no email'}</span>
              </span>

              <span className={`${chip} ${a.assignments > 0 ? 'bg-[rgba(224,138,30,.1)] text-[#b06d0a]' : 'bg-slate-100 text-slate-500'}`}>
                {a.assignments} assigned
              </span>

              {a.suggestion && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => linkAccount(a.mondayUserId, a.suggestion!.personId))}
                  className={`${btn} border-tn-teal text-tn-teal hover:bg-[rgba(30,125,127,.06)]`}
                  title={a.suggestion.why}
                >
                  This is {a.suggestion.personName}
                </button>
              )}

              <span className="w-[220px]">
                <Select
                  value={choice[a.mondayUserId] ?? ''}
                  onChange={v => {
                    setChoice({ ...choice, [a.mondayUserId]: v })
                    if (v) run(() => linkAccount(a.mondayUserId, v))
                  }}
                  options={[{ value: '', label: a.suggestion ? 'Somebody else…' : 'Choose a person…' }, ...people]}
                  ariaLabel={`Link ${a.name}`}
                  searchable
                  fullWidth
                />
              </span>

              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => markExternal(a.mondayUserId))}
                className={`${btn} border-slate-200 text-muted hover:text-tn-ink`}
              >
                Not ours
              </button>
            </li>
          ))}
        </ul>
      </section>

      {board.external.length > 0 && (
        <section className={card}>
          <div className={head}>
            <h2 className={title}>Outside True North <span className="ml-2 text-xs font-bold text-muted">{board.external.length}</span></h2>
            <span className="text-xs text-muted">Deliberately linked to nobody</span>
          </div>
          <ul className="m-0 p-0 list-none">
            {external.map(a => (
              <li key={a.mondayUserId} className="px-5 py-3 border-b border-slate-100 last:border-b-0 flex items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-semibold text-tn-ink truncate">{a.name}</span>
                  <span className="block text-xs text-muted truncate">{a.email ?? 'no email'}</span>
                </span>
                <span className="text-xs text-muted">{a.assignments} assigned</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => clearAccount(a.mondayUserId))}
                  className={`${btn} border-slate-200 text-muted hover:text-tn-ink`}
                >
                  Undo
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={card}>
        <div className={head}>
          <h2 className={title}>Linked <span className="ml-2 text-xs font-bold text-muted">{board.linked.length}</span></h2>
          <span className="text-xs text-muted">How each one was matched</span>
        </div>
        <ul className="m-0 p-0 list-none">
          {linked.map(a => (
            <li key={a.mondayUserId} className="px-5 py-3 border-b border-slate-100 last:border-b-0 flex items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold text-tn-ink truncate">{a.personName}</span>
                <span className="block text-xs text-muted truncate">{a.name} · matched by {a.linkedBy}</span>
              </span>
              <span className="text-xs text-muted">{a.assignments} assigned</span>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => clearAccount(a.mondayUserId))}
                className={`${btn} border-slate-200 text-muted hover:text-tn-ink`}
              >
                Unlink
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
