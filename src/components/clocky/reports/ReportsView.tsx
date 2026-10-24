'use client'

/**
 * Clocky > Reports (Clocky part 2, Reports.dc.html): 12A everyone, 12B a
 * Team Leader's team (hours only), 12C the PDF preview. The filters change
 * the address and the server reads the report again (lib/timeclock/reports-data.ts).
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { withViewAs } from '@/components/ViewAsKeeper'
import { PdfWindow } from '@/components/clocky/invoices/InvoicePdfModal'
import { FieldLabel, Icon, LabeledSelect, Toast, type ToastState } from '@/components/clocky/entries/ui'
import type { ReportPage } from '@/lib/timeclock/reports-data'
import { reportSearch as search, type ReportQuery } from '@/lib/timeclock/reports'
import { ReportSheet } from './ReportSheet'

const SEG = 'flex bg-white border border-[var(--panel-border)] rounded-[10px] p-[3px] gap-0.5'
const SEG_BTN = 'border-0 cursor-pointer rounded-[8px] px-3 py-[7px] font-(family-name:--font-display) font-bold text-[12.5px] leading-[normal]'
const pill = (on: boolean) => (on ? 'bg-tn-primary text-[#ffffff]' : 'bg-transparent text-foreground')
const LABEL = 'font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted leading-[normal]'
const WHITE_BTN = 'inline-flex items-center gap-2 border border-slate-200 rounded-[10px] px-[15px] py-2.5 bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[13px] leading-[normal] cursor-pointer hover:border-tn-teal'
const TONE = { ink: 'text-tn-ink', ok: 'text-[#0d7a4f]', bad: 'text-[#c8323d]' } as const

export function ReportsView({ page, made, startPdf = false, linked = true }: { page: ReportPage; made: string; startPdf?: boolean; linked?: boolean }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [pdf, setPdf] = useState(startPdf)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [range, setRange] = useState({ from: page.from, to: page.to })
  const q = page.query
  const v = page.view
  const go = (patch: Partial<ReportQuery>) => {
    if (!linked) return
    const next = { ...q, ...patch }
    const s = search(next)
    startTransition(() => router.replace(withViewAs(`/clocky-hours/reports${s ? `?${s}` : ''}`), { scroll: false }))
  }
  const qs = search(q)
  const csv = async () => {
    try {
      const res = await fetch(withViewAs(`/clocky-hours/reports/csv${qs ? `?${qs}` : ''}`))
      if (!res.ok) throw new Error(await res.text())
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = url; a.download = `${page.file}.csv`; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      setToast({ text: `Exported ${page.file}.csv` })
    } catch {
      setToast({ text: 'The CSV could not be made. Try again in a moment.', error: true })
    }
    setTimeout(() => setToast(null), 4200)
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex items-end justify-between gap-3.5 flex-wrap">
        <div>
          <Breadcrumb parents={['/clocky-hours']} now="Reports" />
          <h1 className="m-0 font-(family-name:--font-display) font-extrabold text-[30px] leading-[normal] text-tn-ink" style={{ letterSpacing: '-.01em' }}>Reports</h1>
          <p className="m-0 mt-1 text-[13.5px] text-muted">{page.scopeLine}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void csv()} className={WHITE_BTN}><Icon d="M12 3v12M7 10l5 5 5-5M5 21h14" size={15} color="#1E9E6A" width={2.2} />CSV</button>
          <button type="button" onClick={() => setPdf(true)} className={WHITE_BTN}><Icon d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" size={15} color="#1E9E6A" width={2.2} />Preview PDF</button>
        </div>
      </div>

      {/* On a phone the month goes on its own line under Period, and Team, Person and Client take the full width. */}
      <div className="flex flex-wrap gap-2.5 items-end">
        <div className="flex flex-col gap-[5px]">
          <span className={LABEL}>Period</span>
          <div className={SEG} role="group" aria-label="Period">
            {([['month', 'Month'], ['pp', 'Pay period'], ['quarter', 'Quarter'], ['custom', 'Custom']] as const).map(([k, l]) => (
              <button key={k} type="button" aria-pressed={q.kind === k} onClick={() => go({ kind: k, from: undefined, to: undefined })} className={`${SEG_BTN} ${pill(q.kind === k)}`}>{l}</button>
            ))}
          </div>
        </div>
        {q.kind === 'custom' ? (
          <div className="flex items-end gap-2">
            <label className="flex flex-col gap-[5px]"><FieldLabel>From</FieldLabel>
              <input type="date" value={range.from} max={range.to} onChange={e => setRange(r => ({ ...r, from: e.target.value }))} onBlur={() => go({ from: range.from, to: range.to })} className="h-10 box-border px-3 border border-[var(--panel-border)] rounded-[10px] text-[13px] text-tn-ink bg-white" /></label>
            <label className="flex flex-col gap-[5px]"><FieldLabel>To</FieldLabel>
              <input type="date" value={range.to} min={range.from} onChange={e => setRange(r => ({ ...r, to: e.target.value }))} onBlur={() => go({ from: range.from, to: range.to })} className="h-10 box-border px-3 border border-[var(--panel-border)] rounded-[10px] text-[13px] text-tn-ink bg-white" /></label>
          </div>
        ) : (
          <span className="max-md:basis-full font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink px-1.5 max-md:px-0.5 pb-2.5 max-md:pb-0 whitespace-nowrap leading-[normal]">{v.label}</span>
        )}
        {page.scope === 'all' && <div className="w-full md:w-[170px]"><LabeledSelect label="Team" value={q.team} search onChange={t => go({ team: t, person: 'all' })} options={page.options.teams} /></div>}
        {page.scope !== 'own' && <div className="w-full md:w-[190px]"><LabeledSelect label="Person" value={q.person} search onChange={p => go({ person: p })} options={page.options.people} /></div>}
        <div className="w-full md:w-[200px]"><LabeledSelect label="Client" value={q.client} onChange={c => go({ client: c })} options={page.options.clients} /></div>
        <div className="flex flex-col gap-[5px]">
          <span className={LABEL}>Billable</span>
          <div className={SEG} role="group" aria-label="Billable">
            {([['all', 'All'], ['yes', 'Billable'], ['no', 'Not billable']] as const).map(([k, l]) => (
              <button key={k} type="button" aria-pressed={q.bill === k} onClick={() => go({ bill: k })} className={`${SEG_BTN} ${pill(q.bill === k)}`}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {v.cards.map(c => (
          <div key={c.label} className="bg-white border border-[var(--panel-border)] rounded-[14px] px-4 py-3.5 flex flex-col gap-1 min-w-0 leading-[normal]">
            <span className={LABEL}>{c.label}</span>
            <span className={`font-(family-name:--font-display) font-black text-[24px] tabular-nums lining-nums whitespace-nowrap ${TONE[c.tone]}`}>{c.val}</span>
            <span className="text-[12px] text-muted tabular-nums lining-nums">{c.sub}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-3.5 items-stretch">
        <div className="bg-white border border-[var(--panel-border)] rounded-[14px] px-[18px] py-4 flex flex-col gap-3 leading-[normal]">
          <div className="flex justify-between items-baseline gap-2.5"><span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">Hours by client, by month</span><span className="text-[12px] text-muted">{v.chart.range}</span></div>
          <div className="grid grid-cols-[44px_repeat(4,minmax(0,1fr))] gap-3.5 items-end h-[220px]">
            <div className="h-full flex flex-col justify-between text-[10.5px] text-[#a3aebb] text-right tabular-nums lining-nums">{v.chart.axis.map(a => <span key={a}>{a}</span>)}</div>
            {v.chart.months.map(m => (
              <div key={m.label} className="h-full flex flex-col justify-end items-center gap-1.5">
                <span className="text-[11.5px] font-bold text-tn-ink tabular-nums lining-nums">{m.total}</span>
                <div title={m.tip} className="w-[58%] flex flex-col-reverse rounded-t-[6px] rounded-b-[2px] overflow-hidden" style={{ height: `${m.height}%`, outline: m.ring ? '2px solid #1E7D7F' : '0', outlineOffset: 2 }}>
                  {m.segs.map((g, k) => <span key={k} style={{ height: `${g.share}%`, background: g.color }} />)}
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-[44px_repeat(4,minmax(0,1fr))] gap-3.5 -mt-1.5"><span />{v.chart.months.map(m => <span key={m.label} className="text-center font-(family-name:--font-display) font-extrabold text-[11px] tracking-[.06em] uppercase text-muted">{m.label}</span>)}</div>
          <div className="flex flex-wrap gap-x-3.5 gap-y-1.5">{v.chart.legend.map(l => <span key={l.label} className="flex items-center gap-1.5 text-[12px] text-foreground"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: l.color }} />{l.label}</span>)}</div>
        </div>
        <div className="flex flex-col gap-3.5">
          <div className="bg-white border border-[var(--panel-border)] rounded-[14px] px-[18px] py-4 flex flex-col gap-2.5 flex-1 leading-[normal]">
            <span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">By team</span>
            {v.byTeam.map(t => (
              <div key={t.team} className="grid grid-cols-[110px_minmax(0,1fr)_70px] gap-2.5 items-center text-[12.5px]">
                <span className="text-tn-ink font-semibold whitespace-nowrap overflow-hidden text-ellipsis">{t.team}</span>
                <span className="h-2.5 rounded-full bg-[#f1f3f6] overflow-hidden flex"><span className="rounded-full" style={{ width: `${t.width}%`, background: t.color }} /></span>
                <span className="text-right text-foreground tabular-nums lining-nums">{t.val}</span>
              </div>
            ))}
            {!v.byTeam.length && <span className="text-[12.5px] text-muted">No hours in this period.</span>}
          </div>
          <div className="bg-white border border-[var(--panel-border)] rounded-[14px] px-[18px] py-4 flex flex-col gap-2.5 leading-[normal]">
            <span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">Billable vs not</span>
            <div className="flex h-3.5 rounded-full overflow-hidden bg-[#f1f3f6]"><span style={{ width: `${v.bill.share}%`, background: '#1E9E6A' }} /><span className="flex-1 bg-[#cbd2da]" /></div>
            <div className="flex justify-between text-[12.5px] tabular-nums lining-nums"><span className="text-[#0d7a4f] font-bold">Billable {v.bill.yes}</span><span className="text-[#5b6b82] font-semibold">Not billable {v.bill.no}</span></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-3.5 items-start">
        <div className="bg-white border border-[var(--panel-border)] rounded-[14px] overflow-hidden leading-[normal]">
          <div className="px-4 py-[13px] font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink border-b border-[var(--panel-border)]">By person</div>
          {/* Only the table scrolls sideways; its title stays. */}
          <div className="overflow-x-auto">
          <div className="grid grid-cols-[minmax(180px,1.4fr)_90px_80px_90px_90px_110px] bg-subtle border-b border-[var(--panel-border)] min-w-[640px]">
            {v.personHeads.map((h, k) => <div key={h} className={`px-3 py-[9px] font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.08em] uppercase text-muted whitespace-nowrap ${k ? 'text-right' : 'text-left sticky left-0 z-[1] bg-subtle max-md:w-[170px]'}`}>{h}</div>)}
          </div>
          {v.byPerson.map(p => (
            <div key={p.id} className="group grid grid-cols-[minmax(180px,1.4fr)_90px_80px_90px_90px_110px] items-center border-b border-[var(--row-rule)] text-[12.5px] tabular-nums lining-nums hover:bg-[#f8f7f3] min-w-[640px]">
              {/* The name stays in view when the table scrolls sideways (a phone). */}
              <div className="sticky left-0 z-[1] self-stretch bg-white group-hover:bg-[#f8f7f3] max-md:w-[170px] px-3 py-2 flex items-center gap-[9px] min-w-0">
                <span className="w-[26px] h-[26px] rounded-full bg-tn-primary text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[10px] flex items-center justify-center flex-none">{p.ini}</span>
                <span className="flex flex-col min-w-0">
                  <span className="font-(family-name:--font-display) font-bold text-[13px] text-tn-ink whitespace-nowrap max-md:truncate">{p.name}</span>
                  <span className="flex items-center gap-[5px] text-[11px] text-muted"><span className="w-1.5 h-1.5 rounded-full" style={{ background: p.teamColor }} />{p.team}</span>
                </span>
              </div>
              <div className="px-3 py-2 text-right text-tn-ink font-bold">{p.hours}</div>
              <div className="px-3 py-2 text-right text-foreground">{p.billPct}</div>
              <div className="px-3 py-2 text-right text-muted">{p.allowance}</div>
              <div className="px-3 py-2 text-right" style={{ color: p.overTone === 'bad' ? '#c8323d' : p.overTone === 'warn' ? '#8a6d1a' : '#cbd2da', fontWeight: p.overTone === 'none' ? 400 : 700 }}>{p.over}</div>
              <div className="px-3 py-2 text-right text-tn-ink font-semibold">{p.last}</div>
            </div>
          ))}
          </div>
        </div>
        <div className="bg-white border border-[var(--panel-border)] rounded-[14px] overflow-hidden leading-[normal]">
          <div className="px-4 py-[13px] font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink border-b border-[var(--panel-border)]">By client</div>
          <div className="grid grid-cols-[minmax(0,1fr)_90px_70px] bg-subtle border-b border-[var(--panel-border)] font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.08em] uppercase text-muted">
            <div className="px-3 py-[9px]">Client</div><div className="px-3 py-[9px] text-right">Hours</div><div className="px-3 py-[9px] text-right">People</div>
          </div>
          {v.byClient.map(c => (
            <div key={c.label} className="grid grid-cols-[minmax(0,1fr)_90px_70px] items-center border-b border-[var(--row-rule)] text-[12.5px] tabular-nums lining-nums">
              <div className="px-3 py-[9px] flex items-center gap-2 min-w-0"><span className="w-[9px] h-[9px] rounded-[3px] flex-none" style={{ background: c.color }} /><span className="text-tn-ink font-semibold overflow-hidden text-ellipsis whitespace-nowrap">{c.label}</span></div>
              <div className="px-3 py-[9px] text-right text-tn-ink font-bold">{c.hours}</div>
              <div className="px-3 py-[9px] text-right text-foreground">{c.people}</div>
            </div>
          ))}
        </div>
      </div>

      {pdf && (
        <PdfWindow landscape name={`${page.file}.pdf`} href={`/clocky-hours/reports/pdf${qs ? `?${qs}` : ''}`} onClose={() => setPdf(false)}
          onDownloaded={() => { setToast({ text: 'Downloaded the report PDF.' }); setTimeout(() => setToast(null), 4200) }}>
          <ReportSheet view={v} scope={page.scopeText} file={page.file} made={made} />
        </PdfWindow>
      )}
      <Toast toast={toast} />
    </div>
  )
}
