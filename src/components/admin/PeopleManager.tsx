'use client'

/**
 * PeopleManager — admin UI for the company directory. Add/edit/remove people
 * and set their title, manager (reporting line), and status. Saving a manager
 * change redraws the home org chart (the actions revalidate it).
 */

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createPerson, updatePerson, deletePerson } from '@/app/(app)/admin/people/actions'

export interface PersonView {
  id: string
  full_name: string
  title: string | null
  manager_id: string | null
  managerName: string | null
  status: 'active' | 'inactive'
  teams: string[]
  hasAccount: boolean
}

type EditTarget = PersonView | 'new' | null

export function PeopleManager({ people }: { people: PersonView[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [edit, setEdit] = useState<EditTarget>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return people
    return people.filter(p =>
      `${p.full_name} ${p.title ?? ''} ${p.managerName ?? ''} ${p.teams.join(' ')}`.toLowerCase().includes(q),
    )
  }, [people, search])

  function run(fn: () => Promise<void>) {
    setError(null)
    startTransition(async () => {
      try {
        await fn()
        setEdit(null)
        setConfirmDelete(null)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong')
      }
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
          <a href="/" className="hover:text-slate-800">Dashboard</a>
          <span>/</span>
          <a href="/admin" className="hover:text-slate-800">Admin</a>
          <span>/</span>
          <span>People</span>
        </div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">People</h1>
            <p className="mt-1 text-sm text-slate-500">The company directory — edits drive the org chart.</p>
          </div>
          <button
            type="button"
            onClick={() => { setEdit('new'); setError(null) }}
            className="shrink-0 px-4 py-2 text-sm font-medium bg-slate-800 hover:bg-slate-900 text-white rounded-lg transition-colors"
          >
            + Add person
          </button>
        </div>
      </div>

      {edit !== null && (
        <PersonForm
          target={edit}
          people={people}
          pending={pending}
          error={error}
          onCancel={() => { setEdit(null); setError(null) }}
          onSubmit={(input) =>
            run(() => (edit === 'new' ? createPerson(input) : updatePerson(edit.id, input)))
          }
        />
      )}

      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder={`Search ${people.length} people…`}
        className="w-64 rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
      />

      <div className="rounded-xl bg-white border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3 w-40">Reports to</th>
              <th className="px-4 py-3">Teams</th>
              <th className="px-4 py-3 w-24">Account</th>
              <th className="px-4 py-3 w-24">Status</th>
              <th className="px-4 py-3 w-28" />
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/60 ${p.status === 'inactive' ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 font-medium text-slate-800">{p.full_name}</td>
                <td className="px-4 py-3 text-slate-600">{p.title ?? <span className="text-slate-300">—</span>}</td>
                <td className="px-4 py-3 text-slate-600">{p.managerName ?? <span className="text-slate-300">—</span>}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {p.teams.length === 0
                      ? <span className="text-slate-300">—</span>
                      : p.teams.map(t => (
                          <span key={t} className="inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{t}</span>
                        ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {p.hasAccount
                    ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Portal</span>
                    : <span className="text-slate-300 text-xs">—</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${p.status === 'active' ? 'bg-slate-100 text-slate-600' : 'bg-slate-100 text-slate-400'}`}>
                    {p.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {confirmDelete === p.id ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="text-xs text-slate-500">Delete?</span>
                      <button type="button" disabled={pending} onClick={() => run(() => deletePerson(p.id))} className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50">Yes</button>
                      <button type="button" onClick={() => setConfirmDelete(null)} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-3">
                      <button type="button" onClick={() => { setEdit(p); setError(null) }} className="text-xs font-medium text-slate-600 hover:text-slate-900">Edit</button>
                      <button type="button" onClick={() => setConfirmDelete(p.id)} className="text-xs text-slate-400 hover:text-red-600">Delete</button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">No people match the search.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PersonForm({
  target,
  people,
  pending,
  error,
  onCancel,
  onSubmit,
}: {
  target: PersonView | 'new'
  people: PersonView[]
  pending: boolean
  error: string | null
  onCancel: () => void
  onSubmit: (input: { full_name: string; title: string | null; manager_id: string | null; status: 'active' | 'inactive' }) => void
}) {
  const existing = target === 'new' ? null : target
  const [fullName, setFullName] = useState(existing?.full_name ?? '')
  const [title, setTitle] = useState(existing?.title ?? '')
  const [managerId, setManagerId] = useState(existing?.manager_id ?? '')
  const [status, setStatus] = useState<'active' | 'inactive'>(existing?.status ?? 'active')

  const managerOptions = people
    .filter(p => p.id !== existing?.id)
    .sort((a, b) => a.full_name.localeCompare(b.full_name))

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
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pending || !fullName.trim()}
          onClick={() => onSubmit({ full_name: fullName, title: title || null, manager_id: managerId || null, status })}
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
