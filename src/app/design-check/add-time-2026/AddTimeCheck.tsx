'use client'

import { useState } from 'react'
import { EntryForm } from '@/components/clocky/entries/EntryForm'
import { blankForm, blankRequest, type FormState, type RequestState } from '@/components/clocky/entries/form'
import { CorrectionRequest } from '@/components/clocky/entries/CorrectionRequest'
import type { Catalog } from '@/components/clocky/entries/api'
import { FRAMES, JOBS } from '@/app/design-check/clocky-clock/sample'

const d = FRAMES.find(f => f.code === '26H')!.data
// The TSheets jobs too, so a day before the switch date (Oct 1 here) still offers them.
const CATALOG: Catalog = { ...d, jobs: [...JOBS, ...d.jobs] }
const NOW = Date.parse(d.now)
const me = { personId: d.me.personId, personName: 'Arnaldo Oliveira', zone: d.me.zone }
const africa = d.jobs.find(j => j.name === 'HopeFor.Africa')!

const START: Record<string, () => FormState> = {
  empty: () => blankForm({ ...me, date: d.today }),
  filled: () => ({ ...blankForm({ ...me, date: d.today }), jobcodeId: africa.id, jobPath: africa.path, values: { company: '', project: '', activity: 'Content: Translation', billable: '', code: '' }, notes: 'Weekly newsletter, French', reason: 'Forgot to clock in.' }),
  other: () => ({ ...blankForm({ ...me, date: d.today }), jobcodeId: africa.id, jobPath: africa.path, values: { company: '', project: '', activity: 'Other', billable: '', code: '' } }),
}

export function AddTimeCheck() {
  const [which, setWhich] = useState('empty')
  const [form, setFormState] = useState<FormState>(START.empty)
  const [rq, setRq] = useState<RequestState>(() => blankRequest({ date: d.today }))
  const open = (k: string) => { setWhich(k); if (k === 'request') setRq(blankRequest({ date: d.today })); else setFormState(START[k]()) }
  return (
    <div className="min-h-screen bg-[#f1efe8] px-8 py-7">
      <div className="fixed bottom-4 right-4 z-[100] flex bg-white border border-[var(--panel-border)] rounded-[10px] p-[3px] gap-0.5 w-fit shadow-[0_6px_18px_rgba(1,35,88,.18)]" role="group" aria-label="Start from">
        {([['empty', 'Empty'], ['filled', 'Filled in'], ['other', 'Activity Other'], ['request', 'Request a correction']] as const).map(([k, label]) => (
          <button key={k} type="button" aria-pressed={which === k} onClick={() => open(k)}
            className={`border-0 cursor-pointer rounded-[8px] px-3 py-1.5 font-(family-name:--font-display) font-bold text-[12.5px] ${which === k ? 'bg-tn-primary text-[#ffffff]' : 'bg-transparent text-foreground'}`}>{label}</button>
        ))}
      </div>
      {which === 'request' ? (
        <CorrectionRequest rq={rq} setRq={p => setRq(r => ({ ...r, ...p }))} catalog={CATALOG} today={d.today} personId={me.personId} zone={me.zone}
          rows={[]} nowMs={NOW} busy={false} onClose={() => open('request')} onSend={() => {}} />
      ) : <EntryForm key={which} form={form} setForm={p => setFormState(f => ({ ...f, ...p }))} catalog={CATALOG} people={[]} pickPerson={false} leader
        viewerId={me.personId} rows={[]} nowMs={NOW} busy={false} onClose={() => open(which)} onSave={() => {}} onDelete={() => {}} onRequestInstead={() => {}} />}
    </div>
  )
}
