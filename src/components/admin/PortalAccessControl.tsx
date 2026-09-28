'use client'

/**
 * A person's portal access in the Directory card: where they stand, and the
 * Invite or Revoke that changes it (sign-in by invitation, migration 089).
 *
 * The person signs in with their GoodNews address, the only address that can.
 * No email goes out yet: the admin tells them. The invitation email comes with
 * the email service (plan step p4-code).
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { invitePerson, revokeInvite } from '@/app/(app)/admin/people/actions'
import { portalAccessState, type PortalAccessState } from '@/lib/auth/portal-rule'
import { PILL_CLASS, formatDate, type Pill, type PersonView } from '@/lib/directory/people-types'

const PILL: Record<PortalAccessState, Pill> = {
  'signed-in': { kind: 'green', label: 'Has access' },
  invited: { kind: 'teal', label: 'Invited' },
  'not-invited': { kind: 'grey', label: 'Not invited' },
  'no-address': { kind: 'amber', label: 'No GoodNews address' },
  inactive: { kind: 'grey', label: 'No access (inactive)' },
}

const btn =
  'font-(family-name:--font-display) font-extrabold text-[12px] rounded-[8px] px-3 py-1.5 transition-all disabled:opacity-50'

export function PortalAccessControl({ p }: { p: PersonView }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const state = portalAccessState({
    status: p.status,
    email_goodnews: p.emails.goodnews,
    portal_invited_at: p.portalInvitedAt,
    hasAccount: !!p.accountId,
  })

  function act(fn: () => Promise<string | null>) {
    setError(null)
    setNote(null)
    start(async () => {
      try {
        const msg = await fn()
        setNote(msg)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong')
      }
    })
  }

  const invite = () =>
    act(async () => {
      const { loginEmail } = await invitePerson(p.id)
      return `Invited. Let ${p.full_name.split(' ')[0]} know to sign in with ${loginEmail}.`
    })

  const revoke = () => {
    if (!window.confirm(`Revoke ${p.full_name}'s access? They are signed out now and cannot sign in until invited again.`)) return
    act(async () => {
      await revokeInvite(p.id)
      return null
    })
  }

  const pill = PILL[state]
  const since = p.portalInvitedAt ? formatDate(p.portalInvitedAt) : null

  return (
    <span className="inline-flex flex-col items-end gap-1.5">
      <span className="inline-flex items-center gap-2">
        <span
          className={`inline-flex items-center font-(family-name:--font-display) font-extrabold text-[11px] rounded-[7px] px-3 py-[5px] whitespace-nowrap ${PILL_CLASS[pill.kind]}`}
          title={since && (state === 'invited' || state === 'signed-in') ? `Invited ${since}` : undefined}
        >
          {pill.label}
        </span>
        {state === 'not-invited' && (
          <button type="button" disabled={pending} onClick={invite} className={`${btn} text-[#ffffff] bg-tn-primary hover:brightness-110`}>
            {pending ? 'Inviting…' : 'Invite'}
          </button>
        )}
        {(state === 'invited' || state === 'signed-in') && (
          <button type="button" disabled={pending} onClick={revoke} className={`${btn} text-red-600 border border-[rgba(215,57,47,.35)] hover:bg-red-50`}>
            {pending ? 'Revoking…' : 'Revoke'}
          </button>
        )}
      </span>
      {state === 'no-address' && (
        <span className="text-[11.5px] text-muted max-w-[240px] text-right">Add a @goodnewsadvocates.org address to invite them: it is the one they sign in with.</span>
      )}
      {note && <span className="text-[11.5px] text-tn-teal font-semibold max-w-[240px] text-right">{note}</span>}
      {error && <span className="text-[11.5px] text-red-600 max-w-[240px] text-right">{error}</span>}
    </span>
  )
}
