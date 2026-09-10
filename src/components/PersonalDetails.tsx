'use client'

// "Your details", the personal fields the signed-in user can edit about
// themselves, with a view/edit toggle. Saves the whitelisted fields via the
// scoped updateMyProfile action. Everything else on the profile is HR-managed
// and read-only (see the profile page).

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateMyProfile, type MyProfileInput } from '@/app/(app)/profile/profile-actions'
import { formatDate, ynPill, PILL_CLASS } from '@/lib/directory/people-types'
import { BTN_ICON } from '@/lib/ui/buttons'

export interface PersonalFields {
  lastName: string
  personalEmail: string
  phone: string
  whatsappSameNumber: string
  location: string
  dateOfBirth: string // ISO YYYY-MM-DD
}

const fieldCls = 'text-sm text-tn-ink bg-subtle border border-slate-200 rounded-[10px] px-3.5 py-[10px] w-full transition-all focus:outline-none focus:border-tn-teal'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3.5">
      <span className="text-[12.5px] text-muted font-semibold shrink-0">{label}</span>
      <span className="text-right min-w-0">{children}</span>
    </div>
  )
}
const txt = (v: string | null) => <span className="text-[13.5px] text-foreground font-semibold">{v || '-'}</span>
const mail = (v: string | null) => (v ? <a href={`mailto:${v}`} className="text-[13.5px] font-semibold text-tn-teal truncate inline-block max-w-[220px] align-bottom">{v}</a> : txt(null))
function ynBadge(v: string) {
  const pill = ynPill(v || null)
  return pill ? <span className={`inline-flex items-center font-(family-name:--font-display) font-extrabold text-[11px] rounded-[7px] px-3 py-[5px] ${PILL_CLASS[pill.kind]}`}>{pill.label}</span> : txt(null)
}
const label = (t: string) => <span className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-wide uppercase text-muted">{t}</span>

export function PersonalDetails({ initial }: { initial: PersonalFields }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [d, setD] = useState<PersonalFields>(initial)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const set = <K extends keyof PersonalFields>(k: K, v: PersonalFields[K]) => setD(s => ({ ...s, [k]: v }))

  async function save() {
    setBusy(true); setErr(null)
    try {
      const input: MyProfileInput = {
        last_name: d.lastName || null,
        email_personal: d.personalEmail || null,
        phone: d.phone || null,
        whatsapp_same_number: d.whatsappSameNumber || null,
        location: d.location || null,
        date_of_birth: d.dateOfBirth || null,
      }
      await updateMyProfile(input)
      setEditing(false)
      startTransition(() => router.refresh())
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save') }
    finally { setBusy(false) }
  }
  function cancel() { setD(initial); setEditing(false); setErr(null) }

  const seg = (
    <div className="flex gap-1.5">
      {[{ v: 'yes', l: 'Yes' }, { v: 'no', l: 'No' }].map(o => (
        <button key={o.v} type="button" onClick={() => set('whatsappSameNumber', d.whatsappSameNumber === o.v ? '' : o.v)}
          className={`px-3 py-[9px] rounded-[9px] border text-xs font-(family-name:--font-display) font-extrabold transition-all ${d.whatsappSameNumber === o.v ? 'border-tn-teal bg-tn-teal-soft text-tn-teal' : 'border-slate-200 bg-white text-foreground'}`}>{o.l}</button>
      ))}
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200">
        <span className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.08em] uppercase text-tn-teal">Your details · you can edit these</span>
        {!editing ? (
          <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 font-(family-name:--font-display) font-extrabold text-[12px] text-tn-teal hover:text-tn-ink transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
            Edit
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button type="button" onClick={cancel} disabled={busy} className="font-(family-name:--font-display) font-extrabold text-[12px] text-muted hover:text-tn-ink disabled:opacity-50">Cancel</button>
            <button type="button" onClick={save} disabled={busy} className="font-(family-name:--font-display) font-extrabold text-[12px] text-white bg-tn-primary rounded-[8px] px-3.5 py-1.5 hover:brightness-110 disabled:opacity-50"><span className="text-[#ffffff]">{busy ? 'Saving…' : 'Save'}</span></button>
          </div>
        )}
      </div>

      {!editing ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-[13px]">
          <Row label="Last name">{txt(initial.lastName || null)}</Row>
          <Row label="Personal email">{mail(initial.personalEmail || null)}</Row>
          <Row label="Phone / WhatsApp">{txt(initial.phone || null)}</Row>
          <Row label="WhatsApp, same number">{ynBadge(initial.whatsappSameNumber)}</Row>
          <Row label="Location">{txt(initial.location || null)}</Row>
          <Row label="Date of birth">{txt(formatDate(initial.dateOfBirth))}</Row>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3.5">
          <label className="flex flex-col gap-1.5">{label('Last name')}<input type="text" value={d.lastName} onChange={e => set('lastName', e.target.value)} className={fieldCls} placeholder="Doe" /></label>
          <label className="flex flex-col gap-1.5">{label('Personal email')}<input type="email" value={d.personalEmail} onChange={e => set('personalEmail', e.target.value)} className={fieldCls} placeholder="name@email.com" /></label>
          <label className="flex flex-col gap-1.5">{label('Phone / WhatsApp')}<input type="text" value={d.phone} onChange={e => set('phone', e.target.value)} className={fieldCls} placeholder="+1 555 000 0000" /></label>
          <div className="flex flex-col gap-1.5">{label('WhatsApp, same number?')}{seg}</div>
          <label className="flex flex-col gap-1.5">{label('Location')}<input type="text" value={d.location} onChange={e => set('location', e.target.value)} className={fieldCls} placeholder="City, Country" /></label>
          <label className="flex flex-col gap-1.5">{label('Date of birth')}<input type="date" value={d.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)} className={fieldCls} /></label>
        </div>
      )}
      {err && <p className="text-[12.5px] text-red-600 mt-2">{err}</p>}
    </div>
  )
}
