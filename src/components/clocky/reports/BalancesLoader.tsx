'use client'

/**
 * Loads Rippling's Time off balances report (owner, 23 November 2026). The
 * file is read here, in the browser (lib/xlsx-rows.ts), so only each person's
 * two numbers go to the server. Before anything is saved, Finance sees who
 * was found, the names that were not, and says the day of the report.
 */

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveBalances } from '@/app/(app)/clocky-hours/reports/balances/actions'
import { DateField } from '@/components/ui/DateField'
import { matchReport, readReport, reportDay, type MatchedBalance, type ReportPerson } from '@/lib/timeclock/rippling-balances'
import { csvRows, xlsxRows } from '@/lib/xlsx-rows'
import { BTN } from '@/lib/ui/buttons'
import { CARD, FIELD_LABEL } from '@/lib/ui/type'

const HEAD = 'font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] leading-[normal] uppercase text-muted'
const TITLE = 'font-(family-name:--font-display) font-extrabold text-[16px] text-tn-ink'
const GRID = 'minmax(200px,2fr) minmax(90px,1fr) minmax(90px,1fr)'

interface Draft { file: string; matched: MatchedBalance[]; unmatched: string[]; missing: string[] }

export function BalancesLoader({ people, today }: { people: ReportPerson[]; today: string }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [pending, start] = useTransition()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [asOf, setAsOf] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  async function read(file: File) {
    setError(null); setNote(null); setDraft(null)
    try {
      const rows = /\.csv$/i.test(file.name) ? csvRows(await file.text()) : await xlsxRows(new Uint8Array(await file.arrayBuffer()))
      const report = readReport(rows)
      if (report.error) { setError(report.error); return }
      const { matched, unmatched } = matchReport(report.rows, people)
      if (!matched.length) { setError('Nobody in the report was found among the US employees in the Directory.'); return }
      const found = new Set(matched.map(m => m.personId))
      setDraft({ file: file.name, matched, unmatched, missing: people.filter(p => !found.has(p.id)).map(p => p.fullName) })
      const day = reportDay(file.name)
      setAsOf(day && day <= today ? day : '')
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'The file could not be read.')
    }
  }

  function save() {
    if (!draft || !asOf) return
    setError(null)
    start(async () => {
      const r = await saveBalances({ asOf, people: draft.matched.map(m => ({ personId: m.personId, vacation: m.vacation, sick: m.sick })) }).catch(() => ({ ok: false as const, error: 'Not saved. Try again in a moment.' }))
      if (!r.ok) { setError(r.error); return }
      setNote(r.toast); setDraft(null)
      router.refresh()
    })
  }

  return (
    <section className={`${CARD} p-5 flex flex-col gap-3.5`} aria-label="Load Rippling's report">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-[260px]">
          <div className={TITLE}>Load Rippling&apos;s report</div>
          <p className="m-0 mt-1 text-[13px] text-foreground leading-[1.5]">
            In Rippling, export the Time off balances report (Excel or CSV) and pick the file here. Nothing is saved until you check the list and press Save. Loading a new report replaces the numbers of the people in it.
          </p>
        </div>
        <input ref={input} type="file" accept=".xlsx,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void read(f) }} />
        <button type="button" className={BTN.smallNavy} disabled={pending} onClick={() => input.current?.click()}>{draft ? 'Pick another file' : 'Pick the file'}</button>
      </div>

      {draft && (
        <div className="bg-subtle rounded-[12px] p-3.5 flex flex-col gap-3">
          <div className="text-[13px] text-foreground"><span className="font-semibold">{draft.file}</span>: {draft.matched.length} {draft.matched.length === 1 ? 'person' : 'people'} found.</div>
          <div className="bg-white border border-[var(--panel-border)] rounded-[12px] overflow-x-auto">
            <div className="min-w-[420px]">
              <div className="grid gap-3 items-center px-3.5 py-2.5 border-b border-[var(--panel-border)]" style={{ gridTemplateColumns: GRID }}>
                <span className={HEAD}>Person</span><span className={`${HEAD} text-right`}>Vacation</span><span className={`${HEAD} text-right`}>Sick leave</span>
              </div>
              {draft.matched.map((m, i) => (
                <div key={m.personId} className={`grid gap-3 items-center px-3.5 py-2 text-[13px] ${i ? 'border-t border-[var(--panel-border)]' : ''}`} style={{ gridTemplateColumns: GRID }}>
                  <span className="flex flex-col min-w-0">
                    <span className="font-(family-name:--font-display) font-bold text-tn-ink truncate">{m.name}</span>
                    {m.reportName && <span className="text-[11.5px] text-[var(--bdg-orange-fg)]">In the report as {m.reportName}: check it is the same person</span>}
                  </span>
                  <span className="text-right tabular-nums lining-nums text-foreground">{m.vacation ?? '-'}</span>
                  <span className="text-right tabular-nums lining-nums text-foreground">{m.sick ?? '-'}</span>
                </div>
              ))}
            </div>
          </div>
          {draft.unmatched.length > 0 && <p role="alert" className="m-0 text-[12.5px] font-semibold text-[#c8323d]">Not found in the Directory, so not loaded: {draft.unmatched.join(', ')}. Their name in Rippling is not their name here.</p>}
          {draft.missing.length > 0 && <p className="m-0 text-[12.5px] text-muted">Not in the report, so left as they are: {draft.missing.join(', ')}.</p>}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-[5px] w-[220px] max-w-full">
              <span className={FIELD_LABEL}>Day of the report</span>
              <DateField value={asOf} onChange={setAsOf} max={today} ariaLabel="Day of the report" />
            </div>
            <div className="flex gap-2">
              <button type="button" className={BTN.smallWhite} onClick={() => { setDraft(null); setError(null) }}>Cancel</button>
              <button type="button" className={`${BTN.smallNavy} disabled:opacity-50`} disabled={pending || !asOf} onClick={save}>Save balances</button>
            </div>
          </div>
          <p className="m-0 text-[12.5px] text-muted">The day matters: time off on later days, or approved after it, is taken off these numbers.</p>
        </div>
      )}
      {note && <p role="status" className="m-0 text-[12.5px] font-semibold text-tn-teal">{note}</p>}
      {error && <p role="alert" className="m-0 text-[12.5px] font-semibold text-[#c8323d]">{error}</p>}
    </section>
  )
}
