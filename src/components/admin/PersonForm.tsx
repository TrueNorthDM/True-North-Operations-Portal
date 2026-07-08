'use client'

/**
 * PersonForm — the add/edit form for a directory person. Presentational: it
 * owns only its field state and calls back via onSubmit/onCancel; all the
 * mutation + list orchestration lives in PeopleManager.
 */

import { useState } from 'react'
import type { PersonView, Account } from './people-types'

export function PersonForm({
  target,
  people,
  availableAccounts,
  pending,
  error,
  onCancel,
  onSubmit,
}: {
  target: PersonView | 'new'
  people: PersonView[]
  availableAccounts: Account[]
  pending: boolean
  error: string | null
  onCancel: () => void
  onSubmit: (input: { full_name: string; title: string | null; manager_id: string | null; status: 'active' | 'inactive'; profile_id: string | null }) => void
}) {
  const existing = target === 'new' ? null : target
  const [fullName, setFullName] = useState(existing?.full_name ?? '')
  const [title, setTitle] = useState(existing?.title ?? '')
  const [managerId, setManagerId] = useState(existing?.manager_id ?? '')
  const [status, setStatus] = useState<'active' | 'inactive'>(existing?.status ?? 'active')
  const [accountId, setAccountId] = useState(existing?.accountId ?? '')

  const managerOptions = people
    .filter(p => p.id !== existing?.id)
    .sort((a, b) => a.full_name.localeCompare(b.full_name))

  // The person's currently-linked account isn't in availableAccounts (only free
  // ones are), so keep it as a selectable option.
  const accountOptions: Account[] =
    existing?.accountId && existing.accountEmail
      ? [{ id: existing.accountId, email: existing.accountEmail }, ...availableAccounts]
      : availableAccounts

  return (
    <div className="rounded-xl border border-slate-300 bg-white p-5 space-y-4">
      <h2 className="text-sm font-semibold text-slate-700">{existing ? `Edit ${existing.full_name}` : 'Add person'}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Full name" required>
          <input value={fullName} onChange={e => setFullName(e.target.value)} className={inputCls} placeholder="Jane Doe" />
        </Field>
        <Field label="Title">
          <input value={title} onChange={e => setTitle(e.target.value)} className={inputCls} placeholder="SEO Strategist" />
        </Field>
        <Field label="Reports to">
          <select value={managerId} onChange={e => setManagerId(e.target.value)} className={inputCls}>
            <option value="">— None (top level) —</option>
            {managerOptions.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select value={status} onChange={e => setStatus(e.target.value as 'active' | 'inactive')} className={inputCls}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </Field>
        <Field label="Portal account">
          <select value={accountId} onChange={e => setAccountId(e.target.value)} className={inputCls}>
            <option value="">— No account —</option>
            {accountOptions.map(a => <option key={a.id} value={a.id}>{a.email}</option>)}
          </select>
        </Field>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pending || !fullName.trim()}
          onClick={() => onSubmit({ full_name: fullName, title: title || null, manager_id: managerId || null, status, profile_id: accountId || null })}
          className="px-4 py-2 text-sm font-medium bg-slate-800 hover:bg-slate-900 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {pending ? 'Saving…' : existing ? 'Save changes' : 'Add person'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50">
          Cancel
        </button>
      </div>
    </div>
  )
}

const inputCls = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-300'

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">
        {label}{required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  )
}
