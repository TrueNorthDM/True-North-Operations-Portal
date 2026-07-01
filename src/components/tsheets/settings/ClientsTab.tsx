'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BudgetForm } from './BudgetForm'

export interface ClientWithBudget {
  id: number
  name: string
  active: boolean
  budget: {
    id: number
    hoursAllocated: number | null
    budgetAmount: number | null
    extraBudget: number
    startDate: string
  } | null
}

interface Props {
  clients: ClientWithBudget[]
}

function fmt(n: number | null | undefined, prefix = '') {
  if (n == null) return <span className="text-slate-400">--</span>
  return <span>{prefix}{n.toLocaleString()}</span>
}

export function ClientsTab({ clients }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState<number | null>(null)

  function handleClose() {
    setEditing(null)
    router.refresh()
  }

  if (clients.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center space-y-2">
        <p className="text-sm font-medium text-slate-700">No clients yet</p>
        <p className="text-xs text-slate-500">Click &ldquo;Sync clients&rdquo; above to pull job codes from TSheets.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {clients.map(client => (
        <div key={client.id}>
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900 text-sm">{client.name}</span>
                {!client.active && (
                  <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Inactive</span>
                )}
              </div>
              {client.budget ? (
                <div className="mt-1 flex flex-wrap gap-4 text-xs text-slate-600">
                  <span>Hours: {fmt(client.budget.hoursAllocated)}</span>
                  <span>Budget: {fmt(client.budget.budgetAmount, '$')}</span>
                  {client.budget.extraBudget > 0 && (
                    <span>Extra: ${client.budget.extraBudget.toLocaleString()}</span>
                  )}
                  <span className="text-slate-400">from {client.budget.startDate}</span>
                </div>
              ) : (
                <p className="mt-1 text-xs text-slate-400">No budget set</p>
              )}
            </div>
            <button
              onClick={() => setEditing(editing === client.id ? null : client.id)}
              className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              {client.budget ? 'Edit budget' : 'Set budget'}
            </button>
          </div>

          {editing === client.id && (
            <div className="mt-2 ml-4">
              <BudgetForm
                client={{ id: client.id, name: client.name }}
                current={client.budget ? {
                  hoursAllocated: client.budget.hoursAllocated,
                  budgetAmount: client.budget.budgetAmount,
                  extraBudget: client.budget.extraBudget,
                  startDate: client.budget.startDate,
                } : null}
                onClose={handleClose}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
