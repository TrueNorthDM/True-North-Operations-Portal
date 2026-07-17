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

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveTrAssignment, savePersonCostRate } from '@/lib/tsheets/settings-actions'
import { TEAM_COLOR, teamKeyFromName, initialsOf, formatDate } from '@/components/admin/people-types'

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

const AUTO_REASON = 'Updated in Settings → People & rates'

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

const GRID = 'grid grid-cols-[1.9fr_1fr_1.4fr_1.1fr_1fr_1fr] gap-3.5 items-center'
const HD = 'font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.06em] uppercase text-muted'

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
  const [drafts, setDrafts] = useState<Record<string, { client: string; cost: string }>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function enterEdit() {
    const d: Record<string, { client: string; cost: string }> = {}
    for (const p of people) {
      const cr = rateOf(p)
      d[p.id] = { client: cr != null ? String(cr) : '', cost: p.costRate != null ? String(p.costRate) : '' }
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

  function setDraft(id: string, field: 'client' | 'cost', val: string) {
    setDrafts(prev => ({ ...prev, [id]: { ...(prev[id] ?? { client: '', cost: '' }), [field]: val } }))
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

  // View: plain text (no number-spinner arrows). Edit: an input, spinners hidden
  // too (appearance:textfield + webkit spin-button off) so the field stays clean.
  const rateInput = (val: string, onChange: (v: string) => void, focusColor: string) => (
    <span className="inline-flex items-center justify-end gap-1">
      <span className="text-[12px] text-muted">$</span>
      {editing ? (
        <input
          type="number"
          min="0"
          value={val}
          onChange={e => onChange(e.target.value)}
          placeholder="—"
          className="w-16 text-right tabular-nums text-[13.5px] font-semibold text-tn-ink bg-white border border-slate-200 rounded-md px-2 py-1 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          onFocus={e => { e.currentTarget.style.borderColor = focusColor }}
          onBlur={e => { e.currentTarget.style.borderColor = '' }}
        />
      ) : (
        <span className="w-16 text-right tabular-nums text-[13.5px] font-semibold text-tn-ink rounded-md px-2 py-1 bg-subtle">
          {val !== '' ? val : <span className="text-slate-300">—</span>}
        </span>
      )}
    </span>
  )

  return (
    <div>
      <div className="rounded-[16px] border border-slate-200 bg-white overflow-x-auto shadow-[0_1px_2px_rgba(1,35,88,.06)]">
        <div className="min-w-[640px]">
          {/* header */}
          <div className={`${GRID} px-[22px] py-3.5 bg-subtle border-b border-slate-200`}>
            <span className={HD}>Person</span>
            <span className={HD}>Team</span>
            <span className={HD}>Report to</span>
            <span className={HD}>Joined on</span>
            <span className={`${HD} text-right`}>Rate / client</span>
            <span className={`${HD} text-right`}>Rate / cost</span>
          </div>

          {people.map(p => {
            const d = drafts[p.id]
            const clientVal = editing ? (d?.client ?? '') : (rateOf(p) != null ? String(rateOf(p)) : '')
            const costVal = editing ? (d?.cost ?? '') : (p.costRate != null ? String(p.costRate) : '')
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
