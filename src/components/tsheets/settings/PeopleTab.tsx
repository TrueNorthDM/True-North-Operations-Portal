'use client'

/**
 * PeopleTab — "People & rates", built to the handoff. ONE clean table:
 *   Person · Team · Report to · Joined on   → read-only, sourced from the Directory
 *   Rate / client · Rate / cost             → the only two things we set here
 *
 * The Directory (/directory) is the source of truth for who exists and their
 * identity fields; we never create a person here. "Edit" makes both rate columns
 * editable at once; "Save changes" writes every change — client rate via a dated
 * tr_assignments row (so rate history stays intact for past-month reports) and cost
 * via people.internal_rate. Both are still audited (auto reason, no prompt).
 */

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveTrAssignment, savePersonCostRate, savePersonMonthlySalary } from '@/lib/tsheets/settings-actions'
import { TEAM_COLOR, teamKeyFromName, initialsOf, formatDate } from '@/components/admin/people-types'
import { FilterBar } from '@/components/admin/grid/FilterBar'
import { SortHeader } from '@/components/admin/grid/SortHeader'
import { applyFilters, applySort, nextSort } from '@/components/admin/grid/utils'
import type { FilterCond, GridColumn, SortState } from '@/components/admin/grid/types'

// Kept for the data loader (budget-usage-data.ts builds objects of this shape).
// Only `name`, `teamName`, `managerName`, `hireDate`, `costRate`, `assignments`,
// and `tsheetsUserId` drive this view; the rest ride along for other consumers.
export interface PersonWithAssignments {
  id: string
  name: string
  title: string | null
  teams: string[]
  teamName: string | null
  managerName: string | null
  managerTeam: string | null
  hireDate: string | null
  costRate: number | null
  monthlySalary: number | null
  projects: string[]
  tsheetsUserId: number
  tsheetsOnly: boolean
  assignments: {
    id: number
    clientId: number
    clientName: string
    hourlyRate: number
    effectiveFrom: string
  }[]
}

export interface DirectoryOption {
  id: string
  name: string
  title: string | null
}

interface Props {
  people: PersonWithAssignments[]
  allClients: { id: number; name: string }[]
}

const AUTO_REASON = 'Updated in Rates & Costs'

// Team pill, tinted from the shared team-colour system.
function TeamBadge({ team }: { team: string | null }) {
  if (!team) return <span className="text-slate-300">—</span>
  const color = TEAM_COLOR[teamKeyFromName(team)]
  return (
    <span
      className="inline-flex items-center text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide rounded-[6px] px-2 py-0.5 whitespace-nowrap"
      style={{ color, background: `${color}1a` }}
    >
      {team}
    </span>
  )
}

const GRID = 'grid grid-cols-[1.9fr_1fr_1.4fr_1.1fr_224px_224px_224px] gap-3.5 items-center'

export function PeopleTab({ people, allClients }: Props) {
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)
  // The tool is i7-locked; "Rate / client" is the person's rate on the i7 client.
  const i7ClientId = allClients.find(c => /i7/i.test(c.name))?.id ?? null

  // A person's current client (i7) rate — the i7 assignment, else their only one.
  const rateOf = (p: PersonWithAssignments): number | null => {
    if (i7ClientId != null) {
      const a = p.assignments.find(x => x.clientId === i7ClientId)
      if (a) return a.hourlyRate
    }
    return p.assignments[0]?.hourlyRate ?? null
  }

  const [editing, setEditing] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, { client: string; cost: string; salary: string }>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sort / filter — shares the Directory grid engine. Editing + saving always act
  // on the full `people` list (drafts are keyed by id), so filtering only changes
  // what's visible, never what gets saved.
  const [q, setQ] = useState('')
  const [conds, setConds] = useState<FilterCond[]>([])
  const [sort, setSort] = useState<SortState | null>(null)

  const filterColumns = useMemo<GridColumn<PersonWithAssignments>[]>(() => {
    const teams = Array.from(new Set(people.map(p => p.teamName).filter((t): t is string => !!t))).sort()
    const clientRateOf = (p: PersonWithAssignments): number | null => {
      if (i7ClientId != null) {
        const a = p.assignments.find(x => x.clientId === i7ClientId)
        if (a) return a.hourlyRate
      }
      return p.assignments[0]?.hourlyRate ?? null
    }
    return [
      { id: 'name', label: 'Name', type: 'text', get: p => p.name },
      { id: 'team', label: 'Team', type: 'enum', get: p => p.teamName, options: teams.map(t => ({ value: t, label: t })) },
      { id: 'reports', label: 'Report to', type: 'text', get: p => p.managerName },
      { id: 'joined', label: 'Joined on', type: 'date', get: p => p.hireDate },
      { id: 'clientRate', label: 'Rate / client', type: 'number', get: clientRateOf },
      { id: 'costRate', label: 'Rate / cost', type: 'number', get: p => p.costRate },
      { id: 'salary', label: 'Month / salary', type: 'number', get: p => p.monthlySalary },
    ]
  }, [people, i7ClientId])

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    const base = term
      ? people.filter(p => `${p.name} ${p.teamName ?? ''} ${p.managerName ?? ''}`.toLowerCase().includes(term))
      : people
    return applySort(applyFilters(base, filterColumns, conds), filterColumns, sort)
  }, [people, q, conds, sort, filterColumns])

  function enterEdit() {
    const d: Record<string, { client: string; cost: string; salary: string }> = {}
    for (const p of people) {
      const cr = rateOf(p)
      d[p.id] = { client: cr != null ? cr.toFixed(2) : '', cost: p.costRate != null ? p.costRate.toFixed(2) : '', salary: p.monthlySalary != null ? p.monthlySalary.toFixed(2) : '' }
    }
    setDrafts(d)
    setEditing(true)
    setError(null)
  }

  function cancel() {
    setEditing(false)
    setDrafts({})
    setError(null)
  }

  function setDraft(id: string, field: 'client' | 'cost' | 'salary', val: string) {
    setDrafts(prev => ({ ...prev, [id]: { ...(prev[id] ?? { client: '', cost: '', salary: '' }), [field]: val } }))
  }

  async function save() {
    setSaving(true)
    setError(null)
    const ops: Promise<{ ok: boolean; error?: string }>[] = []
    for (const p of people) {
      const d = drafts[p.id]
      if (!d) continue
      // Client (i7) rate — only when it actually changed.
      const newClient = d.client.trim() === '' ? null : Number(d.client)
      if (newClient != null && newClient > 0 && newClient !== rateOf(p)) {
        if (i7ClientId == null) { setError('No i7 client found to attach the rate to.'); setSaving(false); return }
        ops.push(saveTrAssignment({ tsheetsUserId: p.tsheetsUserId, clientId: i7ClientId, hourlyRate: newClient, effectiveFrom: today, justification: AUTO_REASON }))
      }
      // Cost rate — only when it changed.
      const newCost = d.cost.trim() === '' ? null : Number(d.cost)
      if (newCost != null && newCost > 0 && newCost !== p.costRate) {
        ops.push(savePersonCostRate({ personId: p.id, costRate: newCost, justification: AUTO_REASON }))
      }
      // Monthly salary — only when it changed.
      const newSalary = d.salary.trim() === '' ? null : Number(d.salary)
      if (newSalary != null && newSalary > 0 && newSalary !== p.monthlySalary) {
        ops.push(savePersonMonthlySalary({ personId: p.id, monthlySalary: newSalary, justification: AUTO_REASON }))
      }
    }
    if (ops.length === 0) { setEditing(false); setSaving(false); return }
    const results = await Promise.all(ops)
    setSaving(false)
    const failed = results.find(r => !r.ok)
    if (failed) { setError(failed.error ?? 'Some changes could not be saved.'); return }
    setEditing(false)
    setDrafts({})
    router.refresh()
  }

  if (people.length === 0) {
    return (
      <div className="rounded-[14px] border border-slate-200 bg-subtle p-8 text-center space-y-2">
        <p className="text-sm font-(family-name:--font-display) font-bold text-tn-ink">No people linked yet</p>
        <p className="text-xs text-muted">People come from the Directory. Click &ldquo;Sync people&rdquo; above to import QuickBooks Time users, or add them in the Directory.</p>
      </div>
    )
  }

  // USD display — always a dot and two decimals (95 → "95.00"). Applied only on
  // the read side; while editing we keep the raw string so the cursor is stable.
  const money = (v: string): string | null => {
    if (v.trim() === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? n.toFixed(2) : null
  }

  // Edit uses a text field with inputMode=decimal (not type=number) so the value
  // always shows a dot — type=number renders the OS locale separator (e.g. 44,78).
  const rateInput = (val: string, onChange: (v: string) => void, focusColor: string) => (
    <span className="flex w-full items-center justify-end gap-1.5">
      <span className="text-[12px] text-muted">$</span>
      {editing ? (
        <input
          type="text"
          inputMode="decimal"
          value={val}
          onChange={e => onChange(e.target.value)}
          placeholder="—"
          className="w-48 text-right tabular-nums text-[13.5px] font-semibold text-tn-ink bg-white border border-slate-200 rounded-md px-3 py-1.5 outline-none"
          onFocus={e => { e.currentTarget.style.borderColor = focusColor }}
          onBlur={e => { e.currentTarget.style.borderColor = '' }}
        />
      ) : (
        <span className="w-48 text-right tabular-nums text-[13.5px] font-semibold text-tn-ink rounded-md px-3 py-1.5 bg-subtle">
          {money(val) ?? <span className="text-slate-300">—</span>}
        </span>
      )}
    </span>
  )

  return (
    <div>
      {/* toolbar */}
      <div className="flex items-center gap-3.5 flex-wrap mb-[18px]">
        <div className="relative flex-1 min-w-[230px] max-w-[340px]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="absolute left-[13px] top-1/2 -translate-y-1/2 text-muted"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search people…"
            className="w-full text-sm text-tn-ink bg-white border border-slate-200 rounded-[11px] pl-[38px] pr-3.5 py-[11px] focus:outline-none focus:border-tn-teal"
          />
        </div>
        <FilterBar columns={filterColumns} conds={conds} onChange={setConds} />
      </div>

      <div className="rounded-[16px] border border-slate-200 bg-white overflow-x-auto shadow-[0_1px_2px_rgba(1,35,88,.06)]">
        <div className="min-w-[1180px]">
          {/* header */}
          <div className={`${GRID} px-[22px] py-3.5 bg-subtle border-b border-slate-200`}>
            <SortHeader label="Person" active={sort?.id === 'name'} dir={sort?.id === 'name' ? sort.dir : null} onClick={() => setSort(s => nextSort(s, 'name'))} />
            <SortHeader label="Team" active={sort?.id === 'team'} dir={sort?.id === 'team' ? sort.dir : null} onClick={() => setSort(s => nextSort(s, 'team'))} />
            <SortHeader label="Report to" active={sort?.id === 'reports'} dir={sort?.id === 'reports' ? sort.dir : null} onClick={() => setSort(s => nextSort(s, 'reports'))} />
            <SortHeader label="Joined on" active={sort?.id === 'joined'} dir={sort?.id === 'joined' ? sort.dir : null} onClick={() => setSort(s => nextSort(s, 'joined'))} />
            <SortHeader label="Rate / client" align="right" active={sort?.id === 'clientRate'} dir={sort?.id === 'clientRate' ? sort.dir : null} onClick={() => setSort(s => nextSort(s, 'clientRate'))} />
            <SortHeader label="Rate / cost" align="right" active={sort?.id === 'costRate'} dir={sort?.id === 'costRate' ? sort.dir : null} onClick={() => setSort(s => nextSort(s, 'costRate'))} />
            <SortHeader label="Month / salary" align="right" active={sort?.id === 'salary'} dir={sort?.id === 'salary' ? sort.dir : null} onClick={() => setSort(s => nextSort(s, 'salary'))} />
          </div>

          {rows.map(p => {
            const d = drafts[p.id]
            const clientVal = editing ? (d?.client ?? '') : (rateOf(p) != null ? String(rateOf(p)) : '')
            const costVal = editing ? (d?.cost ?? '') : (p.costRate != null ? String(p.costRate) : '')
            const salaryVal = editing ? (d?.salary ?? '') : (p.monthlySalary != null ? String(p.monthlySalary) : '')
            return (
              <div key={p.id} className={`${GRID} px-[22px] py-3 border-b border-slate-100 last:border-0`}>
                {/* Person — navy avatar + name (from Directory) */}
                <span className="inline-flex items-center gap-[11px] min-w-0">
                  <span className="w-[30px] h-[30px] rounded-full shrink-0 bg-tn-primary text-white inline-flex items-center justify-center font-(family-name:--font-display) font-extrabold text-[10.5px]">
                    {initialsOf(p.name)}
                  </span>
                  <span className="text-[14px] font-bold text-tn-ink truncate">{p.name}</span>
                </span>

                {/* Team */}
                <span><TeamBadge team={p.teamName} /></span>

                {/* Report to */}
                <span className="inline-flex items-center gap-2 min-w-0">
                  {p.managerName ? (
                    <>
                      <span className="w-6 h-6 rounded-full shrink-0 bg-slate-100 text-foreground inline-flex items-center justify-center font-(family-name:--font-display) font-extrabold text-[9px]">
                        {initialsOf(p.managerName)}
                      </span>
                      <span className="text-[13px] text-foreground truncate">{p.managerName}</span>
                    </>
                  ) : <span className="text-slate-300">—</span>}
                </span>

                {/* Joined on */}
                <span className="text-[13px] text-foreground tabular-nums">
                  {p.hireDate ? formatDate(p.hireDate) : <span className="text-slate-300">—</span>}
                </span>

                {/* Rate / client (teal focus) */}
                {rateInput(clientVal, v => setDraft(p.id, 'client', v), '#1E7D7F')}

                {/* Rate / cost (violet focus) */}
                {rateInput(costVal, v => setDraft(p.id, 'cost', v), '#6d5ae0')}

                {/* Month / salary (green focus) */}
                {rateInput(salaryVal, v => setDraft(p.id, 'salary', v), '#15803d')}
              </div>
            )
          })}
        </div>
      </div>

      {/* save bar */}
      <div className="flex items-center justify-end gap-3.5 mt-6 pt-5 border-t border-slate-200">
        {error ? (
          <span className="text-[13px] text-[var(--bdg-red-fg)] mr-auto">{error}</span>
        ) : editing ? (
          <span className="text-[13px] text-muted mr-auto">Editing — changes apply when you save.</span>
        ) : null}

        {editing ? (
          <>
            <button
              type="button"
              onClick={cancel}
              disabled={saving}
              className="font-(family-name:--font-display) font-extrabold text-[13px] text-foreground bg-transparent border border-slate-200 rounded-[10px] px-[18px] py-[11px] transition-colors hover:border-slate-300 hover:text-tn-ink disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2.5 font-(family-name:--font-display) font-extrabold text-[13px] text-white bg-tn-primary rounded-[10px] px-[22px] py-[11px] shadow-[0_8px_20px_-8px_rgba(1,35,88,.55)] transition-all hover:brightness-110 disabled:opacity-60"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F2C40A" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
              <span className="text-[#ffffff]">{saving ? 'Saving…' : 'Save changes'}</span>
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={enterEdit}
            className="inline-flex items-center gap-2.5 font-(family-name:--font-display) font-extrabold text-[13px] text-white bg-tn-primary rounded-[10px] px-[22px] py-[11px] shadow-[0_8px_20px_-8px_rgba(1,35,88,.55)] transition-all hover:brightness-110"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F2C40A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
            <span className="text-[#ffffff]">Edit</span>
          </button>
        )}
      </div>
    </div>
  )
}
