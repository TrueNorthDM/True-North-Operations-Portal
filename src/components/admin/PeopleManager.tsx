'use client'

/**
 * PeopleManager — admin UI for the company directory. Add/edit/remove people
 * and set their title, manager (reporting line), and status. Saving a manager
 * change redraws the home org chart (the actions revalidate it).
 */

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createPerson, updatePerson, deletePerson } from '@/app/(app)/admin/people/actions'
import { PersonForm } from './PersonForm'
import type { PersonView, Account } from './people-types'

// Re-exported so existing consumers keep importing the type from PeopleManager.
export type { PersonView } from './people-types'

type EditTarget = PersonView | 'new' | null

export function PeopleManager({ people, availableAccounts, embedded = false }: { people: PersonView[]; availableAccounts: Account[]; embedded?: boolean }) {
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
      `${p.full_name} ${p.title ?? ''} ${p.managerName ?? ''} ${p.teams.join(' ')} ${p.accountEmail ?? ''}`.toLowerCase().includes(q),
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
      {!embedded && (
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link href="/" className="hover:text-slate-800">Dashboard</Link>
            <span>/</span>
            <Link href="/admin" className="hover:text-slate-800">Admin</Link>
            <span>/</span>
            <span>People</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">People</h1>
          <p className="mt-1 text-sm text-slate-500">The company directory — edits drive the org chart.</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${people.length} people…`}
          className="w-64 rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
        <button
          type="button"
          onClick={() => { setEdit('new'); setError(null) }}
          className="shrink-0 px-4 py-2 text-sm font-medium bg-slate-800 hover:bg-slate-900 text-white rounded-lg transition-colors"
        >
          + Add person
        </button>
      </div>

      {edit !== null && (
        <PersonForm
          target={edit}
          people={people}
          availableAccounts={availableAccounts}
          pending={pending}
          error={error}
          onCancel={() => { setEdit(null); setError(null) }}
          onSubmit={(input) =>
            run(() => (edit === 'new' ? createPerson(input) : updatePerson(edit.id, input)))
          }
        />
      )}

      <div className="rounded-xl bg-white border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3 w-40">Reports to</th>
              <th className="px-4 py-3">Teams</th>
              <th className="px-4 py-3 w-24">Account</th>
              <th className="px-4 py-3 w-24">TSheets</th>
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
                  {p.accountEmail
                    ? <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-700" title={p.accountEmail}><span className="w-1.5 h-1.5 rounded-full bg-green-500" />{p.accountEmail}</span>
                    : <span className="text-slate-300 text-xs">—</span>}
                </td>
                <td className="px-4 py-3">
                  {p.hasTsheets
                    ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200" title="Linked to a QuickBooks Time (TSheets) user"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Linked</span>
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
              <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">No people match the search.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
