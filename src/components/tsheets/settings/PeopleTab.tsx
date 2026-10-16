'use client'

/**
 * PeopleTab: "People & rates", built to the handoff. ONE clean table:
 *   Person · Team · Report to · Joined on   → read-only, sourced from the Directory
 *   Rate / client · Rate / cost             → the only two things we set here
 *
 * The Directory (/directory) is the source of truth for who exists and their
 * identity fields; we never create a person here. "Edit" makes both rate columns
 * editable at once; "Save changes" writes every change, client rate via a dated
 * tr_assignments row (so rate history stays intact for past-month reports) and cost
 * via people.internal_rate. Both are still audited (auto reason, no prompt).
 *
 * Timesheet (Clocky, 16 October 2026, Timesheet Periods.dc.html frames 5C to
 * 5C3): how each person submits their hours, monthly or every 2 weeks, the same
 * setting as their page's Work tab. A filter by it beside the search; in Edit,
 * a choice per row for whoever may change it (cs-periods-edit), changed rows in
 * amber, and Save asks first ("Change how these people submit?") with the
 * dates each change takes effect. A name opens the person's page.
 */

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { SearchField } from '@/components/ui/SearchField'
import { Segmented } from '@/components/ui/Segmented'
import { useRouter } from 'next/navigation'
import { withViewAs } from '@/components/ViewAsKeeper'
import { personHref } from '@/lib/directory/page-rights'
import { CadencePill, NewTag, PeriodsDialog, useToast, type DialogItem } from '@/components/clocky/periods/ui'
import { previewCadenceChange, setCadence } from '@/app/(app)/clocky-hours/periods/actions'
import type { CadenceActions } from '@/components/person/PersonForms'
import type { Cadence } from '@/lib/timeclock/periods'
import { saveTrAssignment, savePersonCostRate, savePersonBeRate, savePersonMonthlySalary } from '@/lib/tsheets/settings-actions'
import { firstOfNextMonth } from '@/lib/tsheets/report'
import { initialsOf, formatDate } from '@/lib/directory/people-types'
import { teamColour } from '@/lib/directory/team-colour'
import { FilterBar } from '@/components/admin/grid/FilterBar'
import { SortHeader } from '@/components/admin/grid/SortHeader'
import { applyFilters, applySort, nextSort } from '@/components/admin/grid/utils'
import type { FilterCond, GridColumn, SortState } from '@/components/admin/grid/types'
import { MONTH_LONG } from '@/lib/format/months'

// Kept for the data loader (budget-usage-data.ts builds objects of this shape).
// Only `name`, `teamName`, `managerName`, `hireDate`, `costRate`, `assignments`,
// and `id` drive this view; the rest ride along for other consumers.
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
  beRate: number | null
  monthlySalary: number | null
  projects: string[]
  /** Null for somebody who bills hours without a TSheets account. */
  tsheetsUserId: number | null
  tsheetsOnly: boolean
  /** No longer active, listed because they logged time since the rates began. */
  inactive?: boolean
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

/** The Timesheet column: each person's cadence, and whether this viewer may change it. */
export interface CadenceColumn {
  byPerson: Record<string, Cadence>
  canEdit: boolean
}

interface Props {
  people: PersonWithAssignments[]
  allClients: { id: number; name: string }[]
  /** Null leaves the Timesheet column out (no Company settings > Timesheet periods). */
  cadence?: CadenceColumn | null
  /** Design check only: the previews and saves without the server, and a state to open in. */
  cadenceActions?: CadenceActions
  startEditing?: boolean
  startCadences?: Record<string, Cadence>
  startDialog?: DialogItem[] | null
}

const CADENCE_ACTIONS: CadenceActions = { previewCadenceChange, setCadence }

const AUTO_REASON = 'Updated in Rates & Costs'

// Team pill, tinted from the shared team-colour system.
function TeamBadge({ team }: { team: string | null }) {
  if (!team) return <span className="text-slate-300">-</span>
  const color = teamColour(null, team)
  return (
    <span
      className="inline-flex items-center text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide rounded-[6px] px-2 py-0.5 whitespace-nowrap"
      style={{ color, background: `${color}1a` }}
    >
      {team}
    </span>
  )
}

/** 'August 2026' from a YYYY-MM-DD, for the rate-start dialog. */
function monthName(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  return `${MONTH_LONG[m - 1]} ${y}`
}

const GRID = 'grid grid-cols-[1.9fr_1fr_1.4fr_1.1fr_224px_224px_224px_224px] gap-3.5 items-center'
// With the Timesheet column (Timesheet Periods.dc.html, 5C): the rates narrow to make room.
const GRID_TS = 'grid grid-cols-[1.9fr_1fr_1.4fr_1fr_210px_150px_150px_160px_150px] gap-3.5 items-center'

export function PeopleTab({ people, allClients, cadence = null, cadenceActions = CADENCE_ACTIONS, startEditing = false, startCadences, startDialog = null }: Props) {
  const router = useRouter()
  const grid = cadence ? GRID_TS : GRID
  const [cadF, setCadF] = useState<'all' | Cadence>('all')
  const [cadDraft, setCadDraft] = useState<Record<string, Cadence>>(startCadences ?? {})
  const [cadDialog, setCadDialog] = useState<DialogItem[] | null>(startDialog)
  const [toast, showToast] = useToast()
  const cadOf = (id: string): Cadence => cadence?.byPerson[id] ?? 'monthly'
  const cadChanged = cadence?.canEdit ? people.filter(p => cadDraft[p.id] && cadDraft[p.id] !== cadOf(p.id)) : []
  const today = new Date().toISOString().slice(0, 10)
  const firstOfThisMonth = `${today.slice(0, 7)}-01`
  // The tool is i7-locked; "Rate / client" is the person's rate on the i7 client.
  const i7ClientId = allClients.find(c => /i7/i.test(c.name))?.id ?? null

  // A person's current client (i7) rate, the i7 assignment, else their only one.
  const rateOf = (p: PersonWithAssignments): number | null => {
    if (i7ClientId != null) {
      const a = p.assignments.find(x => x.clientId === i7ClientId)
      if (a) return a.hourlyRate
    }
    return p.assignments[0]?.hourlyRate ?? null
  }

  /** Every rate as the edit fields start: two decimals, or empty. */
  function draftsOf(list: PersonWithAssignments[]) {
    const d: Record<string, { client: string; cost: string; be: string; salary: string }> = {}
    for (const p of list) {
      const cr = rateOf(p)
      d[p.id] = { client: cr != null ? cr.toFixed(2) : '', cost: p.costRate != null ? p.costRate.toFixed(2) : '', be: p.beRate != null ? p.beRate.toFixed(2) : '', salary: p.monthlySalary != null ? p.monthlySalary.toFixed(2) : '' }
    }
    return d
  }

  // When a client rate changes, the admin picks which month it starts in. A
  // rate resolves to one value per month, so "from today" reprices this whole
  // month, hours already logged included (audit finding M3-2). The choice was
  // never offered before: every save silently took the "from today" branch.
  const [pendingRates, setPendingRates] = useState<{ name: string; from: number | null; to: number }[] | null>(null)

  const [editing, setEditing] = useState(startEditing)
  const [drafts, setDrafts] = useState<Record<string, { client: string; cost: string; be: string; salary: string }>>(() => (startEditing ? draftsOf(people) : {}))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sort / filter, shares the Directory grid engine. Editing + saving always act
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
      { id: 'beRate', label: 'Rate / break-even', type: 'number', get: p => p.beRate },
      { id: 'salary', label: 'Month / salary', type: 'number', get: p => p.monthlySalary },
    ]
  }, [people, i7ClientId])

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    const base = (term
      ? people.filter(p => `${p.name} ${p.teamName ?? ''} ${p.managerName ?? ''}`.toLowerCase().includes(term))
      : people).filter(p => !cadence || cadF === 'all' || (cadence.byPerson[p.id] ?? 'monthly') === cadF)
    return applySort(applyFilters(base, filterColumns, conds), filterColumns, sort)
  }, [people, q, conds, sort, filterColumns, cadence, cadF])

  function enterEdit() {
    setDrafts(draftsOf(people))
    setCadDraft({})
    setEditing(true)
    setError(null)
  }

  function cancel() {
    setEditing(false)
    setDrafts({})
    setCadDraft({})
    setError(null)
  }

  function setDraft(id: string, field: 'client' | 'cost' | 'be' | 'salary', val: string) {
    setDrafts(prev => ({ ...prev, [id]: { ...(prev[id] ?? { client: '', cost: '', salary: '' }), [field]: val } }))
  }

  /** The client-rate changes in the current drafts, for the confirm dialog. */
  function changedRates() {
    const out: { name: string; from: number | null; to: number }[] = []
    for (const p of people) {
      const d = drafts[p.id]
      if (!d) continue
      const v = d.client.trim() === '' ? null : Number(d.client)
      if (v != null && v > 0 && v !== rateOf(p)) out.push({ name: p.name, from: rateOf(p), to: v })
    }
    return out
  }

  /** Asks first when someone's timesheet changes (the dates it takes effect), then about the rates. */
  async function save() {
    setError(null)
    if (cadChanged.length) {
      const items = await cadenceItems()
      if (items) setCadDialog(items)
      return
    }
    saveRates()
  }

  /** Asks first when a client rate moved, since that decides which month it hits. */
  function saveRates() {
    const rates = changedRates()
    if (rates.length > 0) { setPendingRates(rates); return }
    void commit(firstOfThisMonth)
  }

  /** Each change, old to new and the dates it starts ("Change how these people submit?"). */
  async function cadenceItems(): Promise<DialogItem[] | null> {
    const out: DialogItem[] = []
    for (const to of ['monthly', 'biweekly'] as const) {
      const ids = cadChanged.filter(p => cadDraft[p.id] === to).map(p => p.id)
      if (!ids.length) continue
      const r = await cadenceActions.previewCadenceChange({ personIds: ids, cadence: to })
      if (!r.ok) { setError(r.error); return null }
      for (const x of r.data) out.push({ name: x.name, change: x.change, eff: x.plan.text })
    }
    const order = new Map(cadChanged.map((p, i) => [p.name, i]))
    return out.sort((a, b) => (order.get(a.name) ?? 0) - (order.get(b.name) ?? 0))
  }

  async function saveCadences() {
    setSaving(true)
    for (const to of ['monthly', 'biweekly'] as const) {
      const ids = cadChanged.filter(p => cadDraft[p.id] === to).map(p => p.id)
      if (!ids.length) continue
      const r = await cadenceActions.setCadence({ personIds: ids, cadence: to })
      if (!r.ok) { setSaving(false); setError(r.error); return }
    }
    const n = cadChanged.length
    setSaving(false)
    setCadDialog(null)
    setCadDraft({})
    showToast(`Saved. ${n} timesheet change${n > 1 ? 's' : ''}, also shown on each person's page.`)
    saveRates()
  }

  // A rate starts on the 1st (decided 9 October 2026): "this month as well"
  // starts it on the 1st of this month, which is what a whole-month rate means.
  async function commit(effectiveFrom: string) {
    setPendingRates(null)
    setSaving(true)
    setError(null)
    const ops: Promise<{ ok: boolean; error?: string }>[] = []
    for (const p of people) {
      const d = drafts[p.id]
      if (!d) continue
      // Client (i7) rate, only when it actually changed.
      const newClient = d.client.trim() === '' ? null : Number(d.client)
      if (newClient != null && newClient > 0 && newClient !== rateOf(p)) {
        if (i7ClientId == null) { setError('No i7 client found to attach the rate to.'); setSaving(false); return }
        ops.push(saveTrAssignment({
          personId: p.id,
          tsheetsUserId: p.tsheetsUserId ?? null,
          clientId: i7ClientId,
          hourlyRate: newClient,
          effectiveFrom,
          justification: AUTO_REASON,
        }))
      }
      // Cost rate, only when it changed.
      const newCost = d.cost.trim() === '' ? null : Number(d.cost)
      const newBe = d.be.trim() === '' ? null : Number(d.be)
      if (newBe != null && newBe > 0 && newBe !== p.beRate) {
        ops.push(savePersonBeRate({ personId: p.id, beRate: newBe, justification: AUTO_REASON }))
      }
      if (newCost != null && newCost > 0 && newCost !== p.costRate) {
        ops.push(savePersonCostRate({ personId: p.id, costRate: newCost, justification: AUTO_REASON }))
      }
      // Monthly salary, only when it changed.
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

  // USD display, always a dot and two decimals (95 → "95.00"). Applied only on
  // the read side; while editing we keep the raw string so the cursor is stable.
  const money = (v: string): string | null => {
    if (v.trim() === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? n.toFixed(2) : null
  }

  // Edit uses a text field with inputMode=decimal (not type=number) so the value
  // always shows a dot, type=number renders the OS locale separator (e.g. 44,78).
  const rateInput = (val: string, onChange: (v: string) => void, focusColor: string) => (
    <span className="flex w-full items-center justify-end gap-1.5">
      <span className="text-[12px] text-muted">$</span>
      {editing ? (
        <input
          type="text"
          inputMode="decimal"
          value={val}
          onChange={e => onChange(e.target.value)}
          placeholder="-"
          className={`${cadence ? 'w-[110px]' : 'w-48'} text-right tabular-nums text-[13.5px] font-semibold text-tn-ink bg-white border border-slate-200 rounded-md px-3 py-1.5 outline-none`}
          onFocus={e => { e.currentTarget.style.borderColor = focusColor }}
          onBlur={e => { e.currentTarget.style.borderColor = '' }}
        />
      ) : (
        <span className={`${cadence ? 'w-[110px]' : 'w-48'} text-right tabular-nums text-[13.5px] font-semibold text-tn-ink rounded-md px-3 py-1.5 bg-subtle`}>
          {money(val) ?? <span className="text-slate-300">-</span>}
        </span>
      )}
    </span>
  )

  return (
    <div>
      {/* toolbar */}
      <div className="flex items-center gap-3.5 flex-wrap mb-[18px]">
        <SearchField
          value={q}
          onChange={setQ}
          placeholder="Search people…"
          className="flex-1 min-w-[230px] max-w-[340px]"
        />
        {cadence && (
          <Segmented
            label="Timesheet"
            options={[
              { key: 'all', label: 'Everyone' },
              { key: 'monthly', label: `Monthly · ${people.filter(p => cadOf(p.id) === 'monthly').length}` },
              { key: 'biweekly', label: `Every 2 weeks · ${people.filter(p => cadOf(p.id) === 'biweekly').length}` },
            ]}
            value={cadF}
            onChange={setCadF}
          />
        )}
        <FilterBar columns={filterColumns} conds={conds} onChange={setConds} />
      </div>

      <div className="rounded-[16px] border border-slate-200 bg-white overflow-x-auto shadow-[0_1px_2px_rgba(1,35,88,.06)]">
        <div className={cadence ? 'min-w-[1420px]' : 'min-w-[1404px]'}>
          {/* header */}
          <div className={`${grid} px-[22px] py-3.5 bg-subtle border-b border-slate-200`}>
            <SortHeader label="Person" active={sort?.id === 'name'} dir={sort?.id === 'name' ? sort.dir : null} onClick={() => setSort(s => nextSort(s, 'name'))} />
            <SortHeader label="Team" active={sort?.id === 'team'} dir={sort?.id === 'team' ? sort.dir : null} onClick={() => setSort(s => nextSort(s, 'team'))} />
            <SortHeader label="Report to" active={sort?.id === 'reports'} dir={sort?.id === 'reports' ? sort.dir : null} onClick={() => setSort(s => nextSort(s, 'reports'))} />
            <SortHeader label="Joined on" active={sort?.id === 'joined'} dir={sort?.id === 'joined' ? sort.dir : null} onClick={() => setSort(s => nextSort(s, 'joined'))} />
            {cadence && (
              <span className="flex items-center gap-1.5 font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-tn-ink leading-[normal]">
                Timesheet<NewTag size={8.5} />
              </span>
            )}
            <SortHeader label="Rate / client" align="right" active={sort?.id === 'clientRate'} dir={sort?.id === 'clientRate' ? sort.dir : null} onClick={() => setSort(s => nextSort(s, 'clientRate'))} />
            <SortHeader label="Rate / cost" align="right" active={sort?.id === 'costRate'} dir={sort?.id === 'costRate' ? sort.dir : null} onClick={() => setSort(s => nextSort(s, 'costRate'))} />
            <SortHeader label="Rate / break-even" align="right" active={sort?.id === 'beRate'} dir={sort?.id === 'beRate' ? sort.dir : null} onClick={() => setSort(s => nextSort(s, 'beRate'))} />
            <SortHeader label="Month / salary" align="right" active={sort?.id === 'salary'} dir={sort?.id === 'salary' ? sort.dir : null} onClick={() => setSort(s => nextSort(s, 'salary'))} />
          </div>

          {rows.map(p => {
            const d = drafts[p.id]
            const clientVal = editing ? (d?.client ?? '') : (rateOf(p) != null ? String(rateOf(p)) : '')
            const costVal = editing ? (d?.cost ?? '') : (p.costRate != null ? String(p.costRate) : '')
            const beVal = editing ? (d?.be ?? '') : (p.beRate != null ? String(p.beRate) : '')
            const salaryVal = editing ? (d?.salary ?? '') : (p.monthlySalary != null ? String(p.monthlySalary) : '')
            return (
              <div key={p.id} className={`${grid} px-[22px] py-3 border-b border-slate-100 last:border-0 ${editing && cadence?.canEdit && cadDraft[p.id] && cadDraft[p.id] !== cadOf(p.id) ? 'bg-[var(--warn-bg)]' : ''}`}>
                {/* Person: navy avatar + name (from Directory); the name opens their page */}
                <span className="inline-flex items-center gap-[11px] min-w-0">
                  <span className="w-[30px] h-[30px] rounded-full shrink-0 bg-tn-primary text-white inline-flex items-center justify-center font-(family-name:--font-display) font-extrabold text-[10.5px]">
                    {initialsOf(p.name)}
                  </span>
                  <Link href={withViewAs(personHref(p.id))} title={`Open ${p.name}'s page`} className="text-[14px] font-bold text-tn-ink truncate transition-colors hover:text-tn-teal">{p.name}</Link>
                  {p.inactive && (
                    <span title="No longer active, listed because they logged time this year" className="shrink-0 rounded-md bg-[var(--chip-neutral-bg)] px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-[var(--chip-neutral-fg)]">Inactive</span>
                  )}
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
                  ) : <span className="text-slate-300">-</span>}
                </span>

                {/* Joined on */}
                <span className="text-[13px] text-foreground tabular-nums">
                  {p.hireDate ? formatDate(p.hireDate) : <span className="text-slate-300">-</span>}
                </span>

                {/* Timesheet: the pill, or in Edit the choice (changed rows amber) */}
                {cadence && (
                  <span className="flex flex-col gap-1 items-start">
                    {editing && cadence.canEdit ? (
                      <Segmented
                        compact
                        warn={!!cadDraft[p.id] && cadDraft[p.id] !== cadOf(p.id)}
                        label={`How ${p.name} submits`}
                        options={[{ key: 'monthly', label: 'Monthly' }, { key: 'biweekly', label: '2 weeks' }]}
                        value={cadDraft[p.id] ?? cadOf(p.id)}
                        onChange={c => setCadDraft(prev => ({ ...prev, [p.id]: c }))}
                      />
                    ) : <CadencePill cadence={cadOf(p.id)} />}
                  </span>
                )}

                {/* Rate / client (teal focus) */}
                {rateInput(clientVal, v => setDraft(p.id, 'client', v), '#1E7D7F')}

                {/* Rate / cost (violet focus) */}
                {rateInput(costVal, v => setDraft(p.id, 'cost', v), '#6d5ae0')}

                {/* Rate / break-even (amber focus) */}
                {rateInput(beVal, v => setDraft(p.id, 'be', v), '#a8660a')}

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
          <span className="text-[13px] text-muted mr-auto">
            {cadChanged.length ? `Editing. ${cadChanged.length} timesheet change${cadChanged.length > 1 ? 's' : ''}, highlighted.` : 'Editing, changes apply when you save.'}
          </span>
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
              onClick={() => void save()}
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

      {cadDialog && (
        <PeriodsDialog
          title="Change how these people submit?"
          intro="A person's current period always closes the way it started, so nobody loses or doubles a day."
          items={cadDialog}
          action="Save changes"
          busy={saving}
          error={error}
          onCancel={() => setCadDialog(null)}
          onConfirm={() => void saveCadences()}
        />
      )}
      {toast}

      {/*
        Which month does the new rate start in. A rate resolves to one value per
        month, so "from today" is not "from today": it reprices every hour
        already logged this month, and any report already sent for it. The old
        code always took that branch without asking.
      */}
      {pendingRates && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onClick={() => setPendingRates(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900">When does the new rate start?</h3>

            <ul className="text-sm text-slate-700 space-y-1">
              {pendingRates.map(r => (
                <li key={r.name}>
                  <span className="font-semibold">{r.name}</span>{' '}
                  {r.from != null ? `$${r.from.toFixed(2)} → ` : ''}<span className="font-semibold">${r.to.toFixed(2)}</span>/h
                </li>
              ))}
            </ul>

            <p className="text-sm text-slate-600 leading-relaxed">
              A rate applies to a whole month, so starting it now also reprices the hours already logged in{' '}
              <strong className="font-semibold text-slate-800">{monthName(today)}</strong>, and changes any report already sent for it.
            </p>

            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={() => void commit(firstOfNextMonth(today))}
                className="w-full text-sm font-semibold px-4 py-2.5 rounded-lg bg-slate-800 text-white hover:bg-slate-900 transition-colors text-left"
              >
                Start on 1 {monthName(firstOfNextMonth(today))}
                <span className="block text-xs font-normal text-slate-300 mt-0.5">Leaves {monthName(today)} exactly as it is.</span>
              </button>
              <button
                onClick={() => void commit(firstOfThisMonth)}
                className="w-full text-sm font-semibold px-4 py-2.5 rounded-lg border border-amber-300 bg-amber-50 text-[#7a4e05] hover:bg-amber-100 transition-colors text-left"
              >
                Apply to {monthName(today)} as well
                <span className="block text-xs font-normal mt-0.5">Recalculates this month at the new rate.</span>
              </button>
              <button
                onClick={() => setPendingRates(null)}
                className="w-full text-sm font-medium px-4 py-2 text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
