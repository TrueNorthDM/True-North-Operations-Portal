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

// Only what Clocky and the import read (audit of 20 October 2026). Rounding,
// the auto clock-out and overtime are Clocky's own fixed rules, and how often
// each person submits lives in Company settings > Timesheet periods.
export interface Rules {
  timezone: string
  week_start: number
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
      const res = await saveRules({ timezone: r.timezone, week_start: r.week_start, import_cutoff_date: r.import_cutoff_date })
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
