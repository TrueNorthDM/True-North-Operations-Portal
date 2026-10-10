'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { withViewAs } from '@/components/ViewAsKeeper'
import { Select } from '@/components/ui/Select'
import { SearchField } from '@/components/ui/SearchField'
import { useConfirm } from '@/components/ui/useConfirm'
import { linkAccount, markExternal, clearAccount } from '@/app/(app)/admin/monday-links/actions'
import type { LinkBoard } from '@/lib/monday/worklist/links'
import type { AccountProfile } from '@/lib/monday/worklist/account'
import { dateLabel, n } from './shared'

interface Option { value: string; label: string }

const card = 'rounded-[14px] border border-slate-200 bg-white overflow-hidden'
const head = 'px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3'
const title = 'font-(family-name:--font-display) font-extrabold text-tn-ink text-[15px] m-0'
const chip = 'inline-flex items-center text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-[5px]'
const btn = 'text-xs font-bold px-2.5 py-1.5 rounded-[8px] border transition-colors whitespace-nowrap'

/**
 * The evidence for "who was this", where the decision is made.
 *
 * For an account Monday has deleted there is no name to look up, so the answer
 * has to be reconstructed from the work: which boards, which steps, over which
 * years, and who else was on the same items. That last one usually settles it.
 */
function WhoIsThis({ id }: { id: number }) {
  const [p, setP] = useState<AccountProfile | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    // Only JSON is believed, and a failure is said in a sentence rather than
    // as the browser's own error text (audit, 10 October 2026).
    const unreachable = 'The account could not be looked up. Try again in a moment.'
    fetch(withViewAs(`/api/admin/monday-account?id=${id}`))
      .then(async r => {
        if (!(r.headers.get('content-type') ?? '').includes('application/json')) throw new Error('not json')
        const d = await r.json()
        if (!alive) return
        if (typeof d?.error === 'string' && d.error) setErr(d.error)
        else if (!r.ok) setErr(unreachable)
        else setP(d)
      })
      .catch(() => { if (alive) setErr(unreachable) })
    return () => { alive = false }
  }, [id])

  if (err) return <div role="alert" className="text-sm text-red-700">{err}</div>
  if (!p) return <div className="text-sm text-muted" role="status">Looking…</div>

  const col = 'text-[10px] font-extrabold uppercase tracking-wider text-muted mb-1.5'
  return (
    <div className="grid md:grid-cols-3 gap-5 pt-3">
      <div>
        <div className={col}>Boards</div>
        <ul className="m-0 p-0 list-none space-y-1">
          {p.boards.slice(0, 6).map(b => (
            <li key={b.name} className="text-[13px] text-tn-ink">
              <span className="tabular-nums text-muted mr-2">{n(b.count)}</span>{b.name}
              <span className="block text-xs text-muted">{b.workspace ?? '-'}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className={col}>Steps</div>
        <ul className="m-0 p-0 list-none space-y-1">
          {p.steps.slice(0, 6).map(st => (
            <li key={st.name} className="text-[13px] text-tn-ink">
              <span className="tabular-nums text-muted mr-2">{n(st.count)}</span>{st.name}
            </li>
          ))}
        </ul>
        {(p.firstDue || p.lastTouched) && (
          <div className="text-xs text-muted mt-2">
            {p.firstDue && <div>{`Deadlines ${dateLabel(p.firstDue)}${p.lastDue ? ` → ${dateLabel(p.lastDue)}` : ''}`}</div>}
            {p.lastTouched && <div>{`Last touched ${dateLabel(p.lastTouched)}`}</div>}
          </div>
        )}
      </div>
      <div>
        <div className={col}>Worked alongside</div>
        {p.alongside.length === 0 && <div className="text-[13px] text-muted">Nobody: always alone on these items.</div>}
        <ul className="m-0 p-0 list-none space-y-1">
          {p.alongside.slice(0, 6).map(a => (
            <li key={a.name} className="text-[13px] text-tn-ink">
              <span className="tabular-nums text-muted mr-2">{n(a.count)}</span>{a.name}
            </li>
          ))}
        </ul>
      </div>
      <div className="md:col-span-3">
        <div className={col}>Sample items</div>
        <div className="text-[13px] text-muted leading-relaxed">
          {p.sample.map(x => (x.parent ? `${x.parent} → ${x.item}` : x.item)).join(' · ')}
        </div>
      </div>
    </div>
  )
}

export function MondayLinksClient({ board, people }: { board: LinkBoard; people: Option[] }) {
  const router = useRouter()
  const [busy, startTransition] = useTransition()
  const [q, setQ] = useState('')
  const [choice, setChoice] = useState<Record<number, string>>({})
  const [expanded, setExpanded] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmDialog, confirm] = useConfirm()

  /** `onFail` undoes what the screen already shows, such as a person chosen in a link that did not save. */
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, onFail?: () => void) => {
    setError(null)
    startTransition(async () => {
      const r = await fn()
      if (!r.ok) { setError(r.error ?? 'That did not save. Try again in a moment.'); onFail?.() }
      else router.refresh()
    })
  }

  // A link that fails clears its choice again (audit, 10 October 2026): the
  // name stayed in the box and read as linked.
  const link = (id: number, personId: string) => {
    setChoice(c => ({ ...c, [id]: personId }))
    if (personId) run(() => linkAccount(id, personId), () => setChoice(c => ({ ...c, [id]: '' })))
  }

  // Both change whose work this is, so both ask first, naming the account and
  // what happens (audit, 10 October 2026).
  const notOurs = async (a: { mondayUserId: number; name: string }) => {
    const yes = await confirm({
      title: `Mark ${a.name} as outside True North?`,
      body: 'The account is linked to nobody on purpose: it stops waiting for an answer here, and its work stays out of every person\'s and team\'s list. It can be undone under Outside True North.',
      action: 'Not ours',
    })
    if (yes) run(() => markExternal(a.mondayUserId))
  }
  const unlink = async (a: { mondayUserId: number; name: string; personName: string }) => {
    const yes = await confirm({
      title: `Unlink ${a.name} from ${a.personName}?`,
      body: `Its Monday work stops being ${a.personName}'s: it leaves their My Work and their team's filter, and the account goes back to waiting on an answer.`,
      action: 'Unlink',
    })
    if (yes) run(() => clearAccount(a.mondayUserId))
  }

  const match = (s: string) => !q || s.toLowerCase().includes(q.toLowerCase())
  const pending = board.pending.filter(a => match(`${a.name} ${a.email ?? ''}`))
  const external = board.external.filter(a => match(`${a.name} ${a.email ?? ''}`))
  const linked = board.linked.filter(a => match(`${a.name} ${a.personName}`))

  return (
    <div className="space-y-5">
      {confirmDialog}
      {error && (
        <div role="alert" className="rounded-[10px] border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      <SearchField value={q} onChange={setQ} placeholder="Search accounts…" className="max-w-[380px]" />

      {/* The list the My Work banner is counting. Named, not tallied. */}
      {board.onWorkUnresolved.length > 0 && (
        <section className={card}>
          <div className={head}>
            <h2 className={title}>
              On work, owned by nobody
              <span className="ml-2 text-xs font-bold text-muted">{n(board.onWorkUnresolved.length)}</span>
            </h2>
            <span className="text-xs text-muted">
              {`${n(board.onWorkUnresolved.reduce((s2, a) => s2 + a.assignments, 0))} assignments a team filter cannot see`}
            </span>
          </div>
          <ul className="m-0 p-0 list-none">
            {board.onWorkUnresolved.map(a => (
              <li key={a.mondayUserId} className="px-5 py-3 border-b border-slate-100 last:border-b-0 flex items-center gap-3 flex-wrap">
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-bold text-tn-ink truncate">
                    {a.name}
                    {!a.known && <span className="ml-2 text-[10px] font-bold uppercase text-muted">no account record</span>}
                  </span>
                  <span className="block text-xs text-muted truncate">{a.email ?? `id ${a.mondayUserId}`}</span>
                </span>
                <span className={`${chip} bg-[rgba(224,138,30,.1)] text-[#b06d0a]`}>{`${n(a.assignments)} assigned`}</span>
                <span className="w-[220px]">
                  <Select
                    value={choice[a.mondayUserId] ?? ''}
                    onChange={v => link(a.mondayUserId, v)}
                    options={[{ value: '', label: 'Choose a person…' }, ...people]}
                    ariaLabel={`Link ${a.name}`}
                    disabled={busy}
                    searchable
                    fullWidth
                  />
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void notOurs(a)}
                  className={`${btn} border-slate-200 text-muted hover:text-tn-ink`}
                >
                  Not ours
                </button>
                <button
                  type="button"
                  onClick={() => setExpanded(expanded === a.mondayUserId ? null : a.mondayUserId)}
                  className={`${btn} border-tn-teal text-tn-teal hover:bg-[rgba(30,125,127,.06)]`}
                >
                  {expanded === a.mondayUserId ? 'Hide' : 'Who is this?'}
                </button>
                {expanded === a.mondayUserId && (
                  <div className="w-full border-t border-slate-100 mt-2">
                    <WhoIsThis id={a.mondayUserId} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={card}>
        <div className={head}>
          <h2 className={title}>Waiting on an answer <span className="ml-2 text-xs font-bold text-muted">{n(board.pending.length)}</span></h2>
          <span className="text-xs text-muted">Most work first</span>
        </div>
        {board.pending.length === 0 && <div className="px-5 py-8 text-center text-sm text-muted">Nothing pending.</div>}
        {board.pending.length > 0 && pending.length === 0 && <NoMatch />}
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
                {`${n(a.assignments)} assigned`}
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
                  onChange={v => link(a.mondayUserId, v)}
                  options={[{ value: '', label: a.suggestion ? 'Somebody else…' : 'Choose a person…' }, ...people]}
                  ariaLabel={`Link ${a.name}`}
                  disabled={busy}
                  searchable
                  fullWidth
                />
              </span>

              <button
                type="button"
                disabled={busy}
                onClick={() => void notOurs(a)}
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
            <h2 className={title}>Outside True North <span className="ml-2 text-xs font-bold text-muted">{n(board.external.length)}</span></h2>
            <span className="text-xs text-muted">Deliberately linked to nobody</span>
          </div>
          {external.length === 0 && <NoMatch />}
          <ul className="m-0 p-0 list-none">
            {external.map(a => (
              <li key={a.mondayUserId} className="px-5 py-3 border-b border-slate-100 last:border-b-0 flex items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-semibold text-tn-ink truncate">{a.name}</span>
                  <span className="block text-xs text-muted truncate">{a.email ?? 'no email'}</span>
                </span>
                <span className="text-xs text-muted">{`${n(a.assignments)} assigned`}</span>
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
          <h2 className={title}>Linked <span className="ml-2 text-xs font-bold text-muted">{n(board.linked.length)}</span></h2>
          <span className="text-xs text-muted">How each one was matched</span>
        </div>
        {board.linked.length > 0 && linked.length === 0 && <NoMatch />}
        <ul className="m-0 p-0 list-none">
          {linked.map(a => (
            <li key={a.mondayUserId} className="px-5 py-3 border-b border-slate-100 last:border-b-0 flex items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold text-tn-ink truncate">{a.personName}</span>
                <span className="block text-xs text-muted truncate">{a.name} · matched by {a.linkedBy}</span>
              </span>
              <span className="text-xs text-muted">{`${n(a.assignments)} assigned`}</span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void unlink(a)}
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

/** A section the search emptied, said as that rather than as an empty list (audit, 10 October 2026). */
function NoMatch() {
  return <div className="px-5 py-8 text-center text-sm text-muted">No account matches that search</div>
}
