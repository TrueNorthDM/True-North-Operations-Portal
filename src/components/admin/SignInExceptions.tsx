'use client'

/**
 * Sign-in exceptions (owner, 18 November 2026; migration 168): the people who
 * sign in with an address that is not a GoodNews mailbox. A Super Admin lists
 * the address here; the person is then invited as anyone else, and the
 * invitation goes to it. On Directory > Portal access, for Super Admins only.
 *
 * The list is read from the people the tab already has (each carries their
 * exception); adding and removing are the actions in admin/people/actions.ts.
 */

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { removeSignInException, setSignInException, signInAddressesOf } from '@/app/(app)/admin/people/actions'
import { Select } from '@/components/ui/Select'
import { useConfirm } from '@/components/ui/useConfirm'
import { initialsOf, type PersonView } from '@/lib/directory/people-types'
import { BTN } from '@/lib/ui/buttons'
import { INPUT } from '@/lib/ui/fields'
import { CARD, FIELD_LABEL } from '@/lib/ui/type'
import { staleOr } from '@/lib/ui/action-error'

const TITLE = 'font-(family-name:--font-display) font-extrabold text-[16px] text-tn-ink'

export function SignInExceptions({ people }: { people: PersonView[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [confirmDialog, confirm] = useConfirm()
  const [adding, setAdding] = useState(false)
  const [personId, setPersonId] = useState('')
  const [email, setEmail] = useState('')
  const [onFile, setOnFile] = useState<{ label: string; email: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const listed = useMemo(() => people.filter(p => p.emails.signIn).sort((a, b) => a.full_name.localeCompare(b.full_name)), [people])
  const options = useMemo(() => people.filter(p => !p.emails.signIn).sort((a, b) => a.full_name.localeCompare(b.full_name))
    .map(p => ({ value: p.id, label: p.emails.goodnews ? `${p.full_name} (has a GoodNews address)` : p.full_name })), [people])

  const close = () => { setAdding(false); setPersonId(''); setEmail(''); setOnFile([]); setError(null) }

  function pick(id: string) {
    setPersonId(id); setEmail(''); setOnFile([]); setError(null)
    if (!id) return
    start(async () => {
      const r = await signInAddressesOf(id).catch(() => null)
      if (r?.ok) {
        // A GoodNews address is never an exception: it is not offered.
        const usable = r.addresses.filter(a => !a.email.endsWith('@goodnewsadvocates.org'))
        setOnFile(usable)
        if (usable.length === 1) setEmail(usable[0].email)
      }
    })
  }

  function save() {
    setError(null); setNote(null)
    const who = people.find(p => p.id === personId)?.full_name ?? 'They'
    start(async () => {
      const r = await setSignInException({ personId, email }).catch(e => ({ ok: false as const, error: staleOr(e, 'Not saved. Try again in a moment.') }))
      if (!r.ok) { setError(r.error); return }
      setNote(`${who} now signs in with ${email.trim().toLowerCase()}. Invite them from the list below.`)
      close()
      router.refresh()
    })
  }

  async function remove(p: PersonView) {
    const yes = await confirm({
      title: `Remove ${p.full_name}'s sign-in exception?`,
      body: `${p.emails.signIn} stops working for the portal. If they signed in with it, they are signed out now. They can sign in again only with a GoodNews address, or with a new exception.`,
      action: 'Remove',
    })
    if (!yes) return
    setError(null); setNote(null)
    start(async () => {
      const r = await removeSignInException(p.id).catch(e => ({ ok: false as const, error: staleOr(e, 'Not removed. Try again in a moment.') }))
      if (!r.ok) { setError(r.error); return }
      setNote(`${p.full_name}'s exception was removed.`)
      router.refresh()
    })
  }

  return (
    <section className={`${CARD} p-5 mb-[18px] flex flex-col gap-3.5`} aria-label="Sign-in exceptions">
      {confirmDialog}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-[260px]">
          <div className={TITLE}>Sign-in exceptions</div>
          <p className="m-0 mt-1 text-[13px] text-foreground leading-[1.5]">
            People who sign in with an address that is not a GoodNews one: a True North address, or a personal one. Listing someone here does not let them in by itself: invite them from the list below, and the invitation goes to this address. Super Admins only.
          </p>
        </div>
        {!adding && <button type="button" className={BTN.smallNavy} disabled={pending} onClick={() => { setAdding(true); setNote(null) }}>+ Add an exception</button>}
      </div>

      {adding && (
        <div className="bg-subtle rounded-[12px] p-3.5 flex flex-col gap-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex flex-col gap-[5px] min-w-0">
              <span className={FIELD_LABEL}>Person</span>
              <Select value={personId} onChange={pick} options={options} placeholder="Pick a person" searchable fullWidth ariaLabel="Person" />
            </div>
            <label className="flex flex-col gap-[5px] min-w-0">
              <span className={FIELD_LABEL}>Address they sign in with</span>
              <input id="exception-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="off" spellCheck={false} disabled={!personId} className={INPUT} />
            </label>
          </div>
          {onFile.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
              <span>In the Directory:</span>
              {onFile.map(a => (
                <button key={a.email} type="button" onClick={() => setEmail(a.email)}
                  className={`rounded-full border px-3 py-1 font-semibold transition-colors ${email.trim().toLowerCase() === a.email ? 'border-tn-teal bg-tn-teal-soft text-tn-ink' : 'border-slate-200 bg-white text-foreground hover:border-tn-teal'}`}>
                  {a.label}: {a.email}
                </button>
              ))}
            </div>
          )}
          {personId && !pending && onFile.length === 0 && <p className="m-0 text-[12.5px] text-muted">The Directory has no other address for them: type the one they will use.</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className={BTN.smallWhite} onClick={close}>Cancel</button>
            <button type="button" className={`${BTN.smallNavy} disabled:opacity-50`} disabled={pending || !personId || !email.trim()} onClick={save}>Save exception</button>
          </div>
        </div>
      )}

      {listed.length > 0 ? (
        <div className="border border-[var(--panel-border)] rounded-[12px] overflow-hidden">
          {listed.map((p, i) => (
            <div key={p.id} className={`flex flex-wrap items-center gap-3 px-3.5 py-2.5 ${i ? 'border-t border-[var(--panel-border)]' : ''}`}>
              <span className="shrink-0 inline-flex items-center justify-center rounded-full text-white font-(family-name:--font-display) font-extrabold text-[10.5px]" style={{ width: 30, height: 30, background: p.color }}>{initialsOf(p.full_name)}</span>
              <span className="flex-1 min-w-[180px] flex flex-col gap-px">
                <span className="font-(family-name:--font-display) font-bold text-[13.5px] text-tn-ink">{p.full_name}</span>
                <span className="text-[12.5px] text-foreground break-all">{p.emails.signIn}</span>
              </span>
              <button type="button" className={`${BTN.smallWhiteDanger} disabled:opacity-50`} disabled={pending} onClick={() => void remove(p)}>Remove</button>
            </div>
          ))}
        </div>
      ) : (
        !adding && <p className="m-0 text-[13px] text-muted">No exceptions yet. Everyone signs in with their GoodNews address.</p>
      )}
      {note && <p role="status" className="m-0 text-[12.5px] font-semibold text-tn-teal">{note}</p>}
      {error && <p role="alert" className="m-0 text-[12.5px] font-semibold text-[#c8323d]">{error}</p>}
    </section>
  )
}
