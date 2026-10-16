'use client'

// The rules, as something you can change rather than something you are told.
//
// Phase 0 showed these read-only, imported from QuickBooks Time. That was right
// while the only honest answer was "this is how the other system is set up".
// Now that the portal keeps its own hours, they are the portal's rules, and
// leaving them frozen would mean the settings page describes a system nobody
// can adjust.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Select } from '@/components/ui/Select'
import { saveRules } from './actions'

export interface Rules {
  timezone: string
  week_start: number
  period_type: string
  round_enabled: boolean
  round_minutes: number
  round_direction: string
  auto_clockout_hours: number | null
  split_at_midnight: boolean
  calculate_overtime: boolean
  daily_regular_hours: number
  weekly_regular_hours: number
  import_cutoff_date: string | null
}

const label = 'text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted'
const input = 'px-3 py-2 rounded-[9px] border border-slate-200 text-sm bg-white text-tn-ink focus:outline-none focus:border-tn-teal focus:ring-2 focus:ring-tn-teal/20'

// The zones anybody here actually works in. A list of 400 is a list nobody
// reads, and a free text box is a way to save 'Amrica/New_York' by accident.
const ZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Sao_Paulo', 'Africa/Kigali', 'Africa/Nairobi', 'Europe/London', 'UTC',
]
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function RulesForm({ rules }: { rules: Rules }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [r, setR] = useState(rules)

  const set = <K extends keyof Rules>(k: K, v: Rules[K]) => setR(s => ({ ...s, [k]: v }))

  function save() {
    setMsg(null)
    startTransition(async () => {
      const res = await saveRules(r)
      setMsg(res.ok ? { ok: true, text: 'Saved.' } : { ok: false, text: res.error ?? 'Something went wrong.' })
      if (res.ok) { setOpen(false); router.refresh() }
    })
  }

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <button
          onClick={() => { setR(rules); setOpen(true) }}
          className="px-4 py-2 rounded-[10px] border border-slate-200 bg-white text-tn-ink font-(family-name:--font-display) font-bold text-sm hover:border-tn-teal transition-colors"
        >
          Change the rules
        </button>
        {msg && <span className={`text-sm ${msg.ok ? 'text-[#1f8a5b]' : 'text-red-600'}`}>{msg.text}</span>}
      </div>
    )
  }

  return (
    <div className="rounded-[14px] border border-slate-200 bg-white p-5 space-y-5">
      <div className="flex gap-4 flex-wrap">
        <div className="flex flex-col gap-1 min-w-[190px]">
          <label className={label} htmlFor="tz">Timezone</label>
          <Select id="tz" value={r.timezone} onChange={v => set('timezone', v)}
            options={ZONES.map(z => ({ value: z, label: z.replace('_', ' ') }))}
            ariaLabel="Timezone" className={input} />
          <span className="text-xs text-muted">Decides which day an entry belongs to.</span>
        </div>
        <div className="flex flex-col gap-1 min-w-[150px]">
          <label className={label} htmlFor="ws">Week starts</label>
          <Select id="ws" value={String(r.week_start)} onChange={v => set('week_start', Number(v))}
            options={WEEKDAYS.map((d, i) => ({ value: String(i), label: d }))}
            ariaLabel="Week starts" className={input} />
        </div>
        <div className="flex flex-col gap-1 min-w-[150px]">
          <label className={label} htmlFor="pt">Pay period</label>
          <Select id="pt" value={r.period_type} onChange={v => set('period_type', v)}
            options={[
              { value: 'monthly', label: 'Monthly' },
              { value: 'semimonthly', label: 'Twice a month' },
              { value: 'biweekly', label: 'Every two weeks' },
              { value: 'weekly', label: 'Weekly' },
            ]}
            ariaLabel="Pay period" className={input} />
        </div>
      </div>

      <div className="flex gap-4 flex-wrap items-start border-t border-slate-100 pt-4">
        <label className="flex items-center gap-2 text-sm text-tn-ink pt-6">
          <input type="checkbox" checked={r.round_enabled} onChange={e => set('round_enabled', e.target.checked)} />
          Round for payroll
        </label>
        <div className="flex flex-col gap-1">
          <label className={label} htmlFor="rm">To the nearest</label>
          <input id="rm" type="number" min="1" max="60" value={r.round_minutes}
            onChange={e => set('round_minutes', Number(e.target.value))}
            disabled={!r.round_enabled} className={`${input} w-24`} />
        </div>
        <div className="flex flex-col gap-1 min-w-[150px]">
          <label className={label} htmlFor="rd">Direction</label>
          <Select id="rd" value={r.round_direction} onChange={v => set('round_direction', v)}
            options={[
              { value: 'nearest', label: 'Nearest' },
              { value: 'up', label: 'Up' },
              { value: 'down', label: 'Down' },
            ]}
            ariaLabel="Rounding direction" className={input} />
        </div>
        <p className="text-xs text-muted max-w-none grow pt-6 m-0">
          Not used since October 16, 2026: Clocky rounds every recorded time to the nearest 15
          minutes and keeps the real times in each entry&apos;s history.
        </p>
      </div>

      <div className="flex gap-4 flex-wrap items-start border-t border-slate-100 pt-4">
        <div className="flex flex-col gap-1">
          <label className={label} htmlFor="ac">Auto clock-out after</label>
          <input id="ac" type="number" min="0" max="24" value={r.auto_clockout_hours ?? ''}
            placeholder="never"
            onChange={e => set('auto_clockout_hours', e.target.value === '' ? null : Number(e.target.value))}
            className={`${input} w-28`} />
          <span className="text-xs text-muted">Not used: Clocky stops a clock after 5 hours without an answer.</span>
        </div>
        <label className="flex items-center gap-2 text-sm text-tn-ink pt-6">
          <input type="checkbox" checked={r.split_at_midnight} onChange={e => set('split_at_midnight', e.target.checked)} />
          Split an entry at midnight
        </label>
        <label className="flex items-center gap-2 text-sm text-tn-ink pt-6">
          <input type="checkbox" checked={r.calculate_overtime} onChange={e => set('calculate_overtime', e.target.checked)} />
          Calculate overtime
        </label>
        <div className="flex flex-col gap-1">
          <label className={label} htmlFor="dh">Regular hours a day</label>
          <input id="dh" type="number" step="0.5" min="0" max="24" value={r.daily_regular_hours}
            onChange={e => set('daily_regular_hours', Number(e.target.value))}
            disabled={!r.calculate_overtime} className={`${input} w-24`} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={label} htmlFor="wh">A week</label>
          <input id="wh" type="number" step="0.5" min="0" max="168" value={r.weekly_regular_hours}
            onChange={e => set('weekly_regular_hours', Number(e.target.value))}
            disabled={!r.calculate_overtime} className={`${input} w-24`} />
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4 space-y-1">
        <label className={label} htmlFor="cut">Import cutoff</label>
        <input id="cut" type="date" value={r.import_cutoff_date ?? ''}
          onChange={e => set('import_cutoff_date', e.target.value || null)} className={input} />
        {/* The one setting here that can lose data if it is set carelessly. */}
        <p className="text-xs text-[#b45309] m-0 max-w-none">
          Set this only on the day you switch over. It stops the import reaching past that date,
          which is what keeps a day somebody entered here from being counted twice. Leaving it
          empty means the import follows today, and QuickBooks Time stays the source of truth.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={pending}
          className="px-5 py-2.5 rounded-[10px] bg-tn-primary text-white font-(family-name:--font-display) font-bold disabled:opacity-50">
          {pending ? 'Saving…' : 'Save the rules'}
        </button>
        <button onClick={() => { setOpen(false); setR(rules) }} disabled={pending}
          className="px-4 py-2.5 rounded-[10px] border border-slate-200 text-tn-ink font-(family-name:--font-display) font-bold text-sm disabled:opacity-50">
          Cancel
        </button>
        {msg && <span className={`text-sm ${msg.ok ? 'text-[#1f8a5b]' : 'text-red-600'}`}>{msg.text}</span>}
      </div>
    </div>
  )
}
