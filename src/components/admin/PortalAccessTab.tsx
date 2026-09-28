'use client'

/**
 * PortalAccessTab: who can get into the portal, at a glance (sign-in by
 * invitation, migration 089; two-step sign-in, plan step p4-2fa).
 *
 * Every active person with where they stand: not invited, invited but not
 * signed in yet, signed in, and whether their second step is set up. The chips
 * on top count each group and filter by it; ticking people invites them, or
 * sends the invitation again, in one go. A row opens the person's card.
 */

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { SearchField } from '@/components/ui/SearchField'
import { invitePerson } from '@/app/(app)/admin/people/actions'
import { portalAccessState, type PortalAccessState } from '@/lib/auth/portal-rule'
import { PILL_CLASS, formatDate, initialsOf, type Pill, type PersonView } from '@/lib/directory/people-types'

/** A person's second step: set up, not yet, or nothing to set up (no account). */
export type TwoStep = 'on' | 'none'

type Filter = 'all' | 'not-invited' | 'invited' | 'signed-in' | 'no-two-step' | 'no-address'

const ACCESS_PILL: Record<PortalAccessState, Pill> = {
  'signed-in': { kind: 'green', label: 'Has access' },
  invited: { kind: 'teal', label: 'Invited' },
  'not-invited': { kind: 'grey', label: 'Not invited' },
  'no-address': { kind: 'amber', label: 'No GoodNews address' },
  inactive: { kind: 'grey', label: 'Inactive' },
}

// The Two-step column only once two-step sign-in is live (twoStep not null).
const GRID_2FA = 'grid grid-cols-[28px_2fr_1.6fr_1.3fr_1.1fr_1fr] gap-3.5 items-center'
const GRID_NO_2FA = 'grid grid-cols-[28px_2fr_1.6fr_1.3fr_1.1fr] gap-3.5 items-center'

function pill(p: Pill, title?: string) {
  return (
    <span title={title} className={`inline-flex items-center font-(family-name:--font-display) font-extrabold text-[11px] rounded-[7px] px-2.5 py-[4px] whitespace-nowrap ${PILL_CLASS[p.kind]}`}>{p.label}</span>
  )
}

function ago(iso: string | null): string {
  if (!iso) return 'Never'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Never'
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days} days ago`
  return formatDate(iso) ?? 'Never'
}

export function PortalAccessTab({ people, twoStep, onOpen }: {
  /** Active people only. */
  people: PersonView[]
  /** Second step by person id, for people with an account. Null until two-step sign-in ships. */
  twoStep: Record<string, TwoStep> | null
  /** Opens the person's card. Absent in design checks. */
  onOpen?: (id: string) => void
}) {
  const router = useRouter()
  const withTwoStep = twoStep !== null
  const GRID = withTwoStep ? GRID_2FA : GRID_NO_2FA
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [progress, setProgress] = useState<string | null>(null)
  const [report, setReport] = useState<string | null>(null)
  const [pending, start] = useTransition()
  // Invitations made on this screen, so the rows update before the page reloads.
  const [justInvited, setJustInvited] = useState<Record<string, string>>({})

  const rows = useMemo(() => people.map(p => {
    const invitedAt = justInvited[p.id] ?? p.portalInvitedAt
    const state = portalAccessState({ status: p.status, email_goodnews: p.emails.goodnews, portal_invited_at: invitedAt, hasAccount: !!p.accountId })
    const second: TwoStep | null = p.accountId ? (twoStep?.[p.id] ?? 'none') : null
    return { p, invitedAt, state, second }
  }), [people, twoStep, justInvited])

  const counts = useMemo(() => ({
    all: rows.length,
    'not-invited': rows.filter(r => r.state === 'not-invited').length,
    invited: rows.filter(r => r.state === 'invited').length,
    'signed-in': rows.filter(r => r.state === 'signed-in').length,
    'no-two-step': rows.filter(r => r.state === 'signed-in' && r.second !== 'on').length,
    'no-address': rows.filter(r => r.state === 'no-address').length,
  }), [rows])

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase()
    return rows
      .filter(r => filter === 'all'
        || (filter === 'no-two-step' ? r.state === 'signed-in' && r.second !== 'on' : r.state === filter))
      .filter(r => !term || `${r.p.full_name} ${r.p.title ?? ''} ${r.p.emails.goodnews ?? ''}`.toLowerCase().includes(term))
      .sort((a, b) => a.p.full_name.localeCompare(b.p.full_name))
  }, [rows, filter, q])

  // Only people an invitation can go to: not invited yet, or invited and not in yet.
  const pickable = (s: PortalAccessState) => s === 'not-invited' || s === 'invited'
  const pickedRows = rows.filter(r => picked.has(r.p.id) && pickable(r.state))
  const toggle = (id: string) => setPicked(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const allShownPickable = shown.filter(r => pickable(r.state))
  const allPicked = allShownPickable.length > 0 && allShownPickable.every(r => picked.has(r.p.id))

  function inviteAll() {
    const list = pickedRows
    if (list.length === 0) return
    const fresh = list.filter(r => r.state === 'not-invited').length
    const again = list.length - fresh
    const what = [fresh && `invite ${fresh} ${fresh === 1 ? 'person' : 'people'}`, again && `send ${again} ${again === 1 ? 'invitation' : 'invitations'} again`].filter(Boolean).join(' and ')
    if (!window.confirm(`This will ${what}. Each gets an email from the portal. Continue?`)) return
    setReport(null)
    start(async () => {
      let sent = 0
      const failed: string[] = []
      for (const [i, r] of list.entries()) {
        setProgress(`Sending ${i + 1} of ${list.length}…`)
        try {
          const res = await invitePerson(r.p.id)
          setJustInvited(prev => ({ ...prev, [r.p.id]: prev[r.p.id] ?? r.invitedAt ?? new Date().toISOString() }))
          if (res.emailed) sent++
          else failed.push(`${r.p.full_name} (${res.reason})`)
        } catch (e) {
          failed.push(`${r.p.full_name} (${e instanceof Error ? e.message : 'failed'})`)
        }
      }
      setProgress(null)
      setPicked(new Set())
      setReport(failed.length ? `${sent} sent. Not sent: ${failed.join('; ')}.` : `${sent} ${sent === 1 ? 'invitation' : 'invitations'} sent.`)
      router.refresh()
    })
  }

  const chips: { key: Filter; label: string; tone: string }[] = [
    { key: 'all', label: 'Everyone active', tone: 'text-tn-ink' },
    { key: 'not-invited', label: 'Not invited', tone: 'text-muted' },
    { key: 'invited', label: 'Invited, not in yet', tone: 'text-tn-teal' },
    { key: 'signed-in', label: 'Signed in', tone: 'text-[#136c43]' },
    { key: 'no-two-step', label: 'Two-step not set up', tone: 'text-[#8a6d00]' },
    { key: 'no-address', label: 'No GoodNews address', tone: 'text-[#8a6d00]' },
  ].filter(c => withTwoStep || c.key !== 'no-two-step') as { key: Filter; label: string; tone: string }[]

  return (
    <div>
      <p className="text-[13.5px] text-muted mb-[18px] leading-relaxed">
        Who can get into the portal. People sign in with their GoodNews address after an admin invites them; the chips count each group and filter the list. Tick people to invite them, or send the invitation again, in one go.
      </p>

      {/* the counts, which are also the filters */}
      <div className="flex flex-wrap gap-2.5 mb-[18px]">
        {chips.map(c => {
          const on = filter === c.key
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setFilter(c.key)}
              className={`flex items-baseline gap-2 rounded-[12px] border px-3.5 py-2.5 text-left transition-all ${on ? 'border-tn-teal bg-tn-teal-soft' : 'border-slate-200 bg-white hover:border-tn-ink'}`}
            >
              <span className={`font-(family-name:--font-display) font-extrabold text-[20px] leading-none ${c.tone}`}>{counts[c.key]}</span>
              <span className="text-[12.5px] font-semibold text-foreground">{c.label}</span>
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-3.5 flex-wrap mb-[14px]">
        <SearchField value={q} onChange={setQ} placeholder="Search people…" className="flex-1 min-w-[230px] max-w-[340px]" />
        <div className="ml-auto flex items-center gap-3">
          {progress && <span className="text-[12.5px] font-semibold text-tn-teal">{progress}</span>}
          <button
            type="button"
            disabled={pickedRows.length === 0 || pending}
            onClick={inviteAll}
            className="font-(family-name:--font-display) font-extrabold text-[13px] rounded-[10px] px-4 py-2.5 text-[#ffffff] bg-tn-primary transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pickedRows.length === 0 ? 'Invite selected' : `Invite ${pickedRows.length} selected`}
          </button>
        </div>
      </div>
      {report && <p className="text-[12.5px] font-semibold text-tn-teal mb-3">{report}</p>}

      <div className="border border-slate-200 bg-white rounded-[16px] overflow-hidden shadow-[0_1px_2px_rgba(1,35,88,.06)]">
        <div className={`${GRID} px-[22px] py-[13px] bg-subtle border-b border-slate-200 font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-wide uppercase text-muted`}>
          <input
            type="checkbox"
            aria-label="Select everyone who can be invited"
            checked={allPicked}
            disabled={allShownPickable.length === 0}
            onChange={() => setPicked(prev => {
              const n = new Set(prev)
              if (allPicked) allShownPickable.forEach(r => n.delete(r.p.id))
              else allShownPickable.forEach(r => n.add(r.p.id))
              return n
            })}
            className="h-4 w-4 accent-[#012358]"
          />
          <span>Person</span>
          <span>Signs in with</span>
          <span>Portal access</span>
          <span>Last sign-in</span>
          {withTwoStep && <span>Two-step</span>}
        </div>

        {shown.map((r, i) => (
          <div
            key={r.p.id}
            onClick={() => onOpen?.(r.p.id)}
            className={`${GRID} px-[22px] py-[12px] cursor-pointer transition-colors hover:bg-subtle ${i === 0 ? '' : 'border-t border-slate-200'}`}
          >
            <span onClick={e => e.stopPropagation()}>
              {pickable(r.state) && (
                <input type="checkbox" aria-label={`Select ${r.p.full_name}`} checked={picked.has(r.p.id)} onChange={() => toggle(r.p.id)} className="h-4 w-4 accent-[#012358]" />
              )}
            </span>
            <span className="inline-flex items-center gap-3 min-w-0">
              <span className="shrink-0 inline-flex items-center justify-center rounded-full text-white font-(family-name:--font-display) font-extrabold text-[11px]" style={{ width: 34, height: 34, background: r.p.color }}>{initialsOf(r.p.full_name)}</span>
              <span className="min-w-0">
                <span className="block font-(family-name:--font-display) font-bold text-sm text-tn-ink truncate">{r.p.full_name}</span>
                <span className="block text-xs text-muted truncate">{r.p.title ?? '-'}</span>
              </span>
            </span>
            <span className="text-[12.5px] text-foreground truncate" title={r.p.emails.goodnews ?? undefined}>{r.p.emails.goodnews ?? <span className="text-slate-300">-</span>}</span>
            <span className="inline-flex flex-col items-start gap-0.5">
              {pill(ACCESS_PILL[r.state])}
              {r.invitedAt && r.state !== 'no-address' && <span className="text-[11px] text-muted">Invited {formatDate(r.invitedAt)}</span>}
            </span>
            <span className="text-[12.5px] text-foreground">{r.p.accountId ? ago(r.p.lastAccessAt) : <span className="text-slate-300">-</span>}</span>
            {withTwoStep && <span>
              {r.second === 'on' && pill({ kind: 'green', label: 'On' })}
              {r.second === 'none' && pill({ kind: 'amber', label: 'Not set up' })}
              {r.second === null && <span className="text-[13px] text-slate-300">-</span>}
            </span>}
          </div>
        ))}

        {shown.length === 0 && (
          <div className="px-[22px] py-[52px] text-center"><p className="text-sm text-muted">Nobody in this group.</p></div>
        )}
      </div>
      <p className="text-[12.5px] text-muted mt-3.5 mx-0.5">{shown.length} of {people.length} active people</p>
    </div>
  )
}
