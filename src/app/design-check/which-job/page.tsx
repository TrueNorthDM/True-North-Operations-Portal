'use client'

// Design check: three ways to draw "Which job?" in the 2026 structure, with the
// real lists (structure-2026.ts) and their "When to use" lines, for the owner
// to pick one. ?v=A (levels), ?v=B (columns), ?v=C (table).

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ACTIVITIES, ACTIVITY_FAMILIES, STRUCTURE } from '@/lib/timeclock/structure-2026'
import { whenToUse } from '@/lib/timeclock/structure-2026-seed'

type Row = { client: string; division: string; project: string; billable: boolean }
const ROWS: Row[] = STRUCTURE.flatMap(c => [
  ...c.divisions.flatMap(d => d.projects.map(p => ({ client: c.name, division: d.name, project: p.name, billable: c.billable }))),
  ...c.projects.map(p => ({ client: c.name, division: '', project: p.name, billable: c.billable })),
])
const alpha = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' })
const lineOf = (n: string) => whenToUse(n) ?? ''

const LEVEL = 'font-(family-name:--font-display) font-extrabold text-[9.5px] tracking-[.1em] uppercase rounded-full px-[7px] py-[2px] leading-[normal]'
const TAG = { client: `${LEVEL} bg-tn-primary text-[#ffffff]`, division: `${LEVEL} bg-[#eaf4f4] text-tn-teal`, project: `${LEVEL} bg-[#f1f3f6] text-[#5b6b82]` }
const Bill = ({ on }: { on: boolean }) => (
  <span className={`text-[10.5px] font-bold rounded-full px-[9px] py-[3px] whitespace-nowrap ${on ? 'bg-[#e6f6ee] text-[#0d7a4f]' : 'bg-[#f1f3f6] text-[#5b6b82]'}`}>{on ? 'Billable' : 'Not billable'}</span>
)

function useFilter() {
  const [q, setQ] = useState('')
  const n = q.trim().toLowerCase()
  const match = (r: Row) => !n || `${r.client} ${r.division} ${r.project} ${lineOf(r.project)}`.toLowerCase().includes(n)
  const box = (
    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search a client, division, project or line, e.g. Wagner"
      className="w-[360px] max-w-full box-border h-[38px] px-3 border border-[var(--panel-border)] rounded-[10px] font-sans text-[13px] text-tn-ink bg-white outline-none focus:border-tn-teal" />
  )
  return { match, box }
}

/** The 26 activities by family, the same in every variant. */
function Activities() {
  return (
    <div className="bg-white border border-[var(--panel-border)] rounded-[14px] p-4 flex flex-col gap-3 leading-[normal]">
      <span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">Activities</span>
      <span className="text-[12.5px] text-foreground leading-[1.5]">The kind of work, the same list on every project. Notes are required for Other and Meeting: Other.</span>
      {[...ACTIVITY_FAMILIES].sort(alpha).map(f => (
        <div key={f} className="flex flex-col gap-1.5">
          <span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted">{f}</span>
          {ACTIVITIES.filter(a => a.family === f).sort((a, b) => alpha(a.name, b.name)).map(a => (
            <div key={a.name} className="text-[12.5px] leading-[1.4]"><b className="text-tn-ink font-(family-name:--font-display)">{a.name}</b><span className="text-foreground"> · {a.covers}</span></div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── A. Levels: each client a block, divisions inside, projects inside ─────────

function VariantA() {
  const { match, box } = useFilter()
  const clients = [...new Set(ROWS.map(r => r.client))].sort(alpha)
  return (
    <>
      {box}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
        <div className="flex flex-col gap-5">
          {clients.map(c => {
            const rows = ROWS.filter(r => r.client === c && match(r))
            if (!rows.length) return null
            const divs = [...new Set(rows.map(r => r.division))].sort(alpha)
            return (
              <section key={c} className="bg-white border border-[var(--panel-border)] rounded-[16px] overflow-hidden">
                <header className="px-5 py-4 bg-tn-primary text-[#ffffff] flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className={`${LEVEL} bg-[#F2C40A] text-tn-ink`}>Client</span>
                  <span className="font-(family-name:--font-display) font-extrabold text-[18px]">{c}</span>
                  <span className="ml-auto"><Bill on={rows[0].billable} /></span>
                  <span className="basis-full text-[12.5px] text-[#ffffff]/80">{lineOf(c)}</span>
                </header>
                {divs.map(d => (
                  <div key={d || 'none'} className="border-t border-[var(--panel-border)]">
                    {d ? (
                      <div className="px-5 py-3 bg-[#f4f9f9] flex flex-wrap items-center gap-x-2.5 gap-y-1 border-l-4 border-tn-teal">
                        <span className={TAG.division}>Division</span>
                        <span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">{d}</span>
                        <span className="text-[12.5px] text-foreground basis-full md:basis-auto md:flex-1">{lineOf(d)}</span>
                      </div>
                    ) : (
                      <div className="px-5 py-2.5 bg-subtle text-[12px] text-muted">No divisions: the projects sit right under {c}.</div>
                    )}
                    {rows.filter(r => r.division === d).sort((a, b) => alpha(a.project, b.project)).map(r => (
                      <div key={r.project} className={`grid grid-cols-[minmax(0,1fr)] md:grid-cols-[220px_minmax(0,1fr)] gap-x-4 gap-y-1 py-2.5 pr-5 border-t border-[var(--row-rule)] text-[13px] ${d ? 'pl-10' : 'pl-5'}`}>
                        <span className="flex items-center gap-2"><span className={TAG.project}>Project</span><b className="font-(family-name:--font-display) text-tn-ink">{r.project}</b></span>
                        <span className="text-foreground leading-[1.5]">{lineOf(r.project)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </section>
            )
          })}
        </div>
        <Activities />
      </div>
    </>
  )
}

// ── B. Columns: Client, then Division, then Project, then what it is ─────────

function VariantB() {
  const { match, box } = useFilter()
  const shown = ROWS.filter(match)
  const clients = [...new Set(shown.map(r => r.client))].sort(alpha)
  const [c, setC] = useState(clients[0] ?? '')
  const client = clients.includes(c) ? c : clients[0] ?? ''
  const divs = [...new Set(shown.filter(r => r.client === client).map(r => r.division))].sort(alpha)
  const [d, setD] = useState<string | null>(null)
  const division = d !== null && divs.includes(d) ? d : divs[0] ?? ''
  const projects = shown.filter(r => r.client === client && r.division === division).sort((a, b) => alpha(a.project, b.project))
  const [p, setP] = useState<string | null>(null)
  const project = projects.find(r => r.project === p) ?? projects[0]
  const col = 'bg-white border border-[var(--panel-border)] rounded-[14px] overflow-hidden flex flex-col'
  const item = (on: boolean) => `w-full text-left border-0 border-b border-[var(--row-rule)] px-3.5 py-2.5 cursor-pointer flex items-center justify-between gap-2 font-(family-name:--font-display) font-bold text-[13.5px] ${on ? 'bg-tn-primary text-[#ffffff]' : 'bg-white text-tn-ink hover:bg-[#f8f7f3]'}`
  const head = (n: string, l: keyof typeof TAG) => <div className="px-3.5 py-2.5 bg-subtle border-b border-[var(--panel-border)] flex items-center gap-2"><span className={TAG[l]}>{n}</span></div>
  return (
    <>
      {box}
      <div className="grid grid-cols-1 lg:grid-cols-[200px_220px_220px_minmax(0,1fr)] gap-3 items-start">
        <div className={col}>{head('1 Client', 'client')}{clients.map(x => <button key={x} type="button" onClick={() => { setC(x); setD(null); setP(null) }} className={item(x === client)}>{x}<span>›</span></button>)}</div>
        <div className={col}>{head('2 Division', 'division')}{divs.map(x => <button key={x || 'none'} type="button" onClick={() => { setD(x); setP(null) }} className={item(x === division)}>{x || '(none)'}<span>›</span></button>)}</div>
        <div className={col}>{head('3 Project', 'project')}{projects.map(r => <button key={r.project} type="button" onClick={() => setP(r.project)} className={item(r.project === project?.project)}>{r.project}</button>)}</div>
        <div className="bg-white border border-[var(--panel-border)] rounded-[14px] p-5 flex flex-col gap-3.5">
          {project ? (
            <>
              <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
                <span className={TAG.client}>{project.client}</span><span className="text-muted">›</span>
                {project.division && <><span className={TAG.division}>{project.division}</span><span className="text-muted">›</span></>}
                <span className={TAG.project}>{project.project}</span>
              </div>
              <div className="font-(family-name:--font-display) font-extrabold text-[22px] text-tn-ink leading-[1.2]">{project.project}</div>
              <div className="text-[14px] text-foreground leading-[1.55]">{lineOf(project.project)}</div>
              <div className="flex items-center gap-2"><span className="text-[12px] text-muted">Billable:</span><Bill on={project.billable} /><span className="text-[12px] text-muted">set by the project</span></div>
              <div className="border-t border-[var(--row-rule)] pt-3 flex flex-col gap-1.5 text-[12.5px] text-foreground leading-[1.5]">
                <span><b className="text-tn-ink">{project.client}:</b> {lineOf(project.client)}</span>
                {project.division && <span><b className="text-tn-ink">{project.division}:</b> {lineOf(project.division)}</span>}
              </div>
            </>
          ) : <span className="text-muted text-[13px]">Nothing matches the search.</span>}
        </div>
      </div>
      <Activities />
    </>
  )
}

// ── C. Table: one row per project, the path in columns ───────────────────────

/** The 26 activities in the same table style as the projects: one row each, the family once per group. */
function ActivitiesTable({ q }: { q: string }) {
  const n = q.trim().toLowerCase()
  const rows = ACTIVITIES.filter(a => !n || `${a.family} ${a.name} ${a.covers}`.toLowerCase().includes(n))
    .sort((a, b) => alpha(a.family, b.family) || alpha(a.name, b.name))
  const th = 'text-left px-3.5 py-2.5 font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted bg-subtle border-b border-[var(--panel-border)]'
  return (
    <section className="flex flex-col gap-3 mt-4">
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[22px] text-tn-ink">Activities</h2>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eaf4f4] text-tn-teal px-2.5 py-1 font-(family-name:--font-display) font-extrabold text-[11.5px]">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
            Shared by every client, division and project
          </span>
        </div>
        <div className="flex items-start gap-3 bg-white border border-[var(--panel-border)] border-l-4 border-l-tn-teal rounded-[12px] px-4 py-3 text-[13px] text-foreground leading-[1.55]">
          <span>Activities do not belong to a client or a project. <b className="text-tn-ink">The same 26 are offered on every project</b>: first pick where the work goes (Client, Division, Project, in the table above), then the Activity that says <b className="text-tn-ink">what kind of work</b> it was. Translation is translation whether it is for AAAF, HopeFor.Africa or i7.</span>
        </div>
      </div>
      <div className="bg-white border border-[var(--panel-border)] rounded-[14px] overflow-x-auto">
        <table className="w-full border-collapse text-[13px] min-w-[720px]">
          <thead><tr><th className={th}>Family</th><th className={th}>Activity</th><th className={th}>What it covers</th><th className={th}>Notes</th></tr></thead>
          <tbody>
            {rows.map((a, i) => {
              const newFamily = i === 0 || rows[i - 1].family !== a.family
              return (
                <tr key={a.name} className={newFamily && i > 0 ? 'border-t-2 border-[#cfe5e5]' : 'border-t border-[var(--row-rule)]'}>
                  <td className="px-3.5 py-2.5 align-top w-[150px]">{newFamily && <span className="font-(family-name:--font-display) font-bold text-tn-teal">{a.family}</span>}</td>
                  <td className="px-3.5 py-2.5 align-top w-[260px] font-(family-name:--font-display) font-bold text-tn-ink">{a.name}</td>
                  <td className="px-3.5 py-2.5 align-top text-foreground leading-[1.5]">{a.covers}</td>
                  <td className="px-3.5 py-2.5 align-top w-[110px]">{a.notesRequired
                    ? <span className="text-[10.5px] font-bold rounded-full px-[9px] py-[3px] whitespace-nowrap bg-[#fdf8e7] text-[#8a6d1a]">Required</span>
                    : <span className="text-[12px] text-muted">Optional</span>}</td>
                </tr>
              )
            })}
            {!rows.length && <tr><td colSpan={4} className="px-3.5 py-8 text-center text-muted">No activity matches.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function VariantC() {
  // One search for the whole page: it filters the projects and the activities alike.
  const [q, setQ] = useState('')
  const n = q.trim().toLowerCase()
  const match = (r: Row) => !n || `${r.client} ${r.division} ${r.project} ${lineOf(r.project)}`.toLowerCase().includes(n)
  const box = (
    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search anything: a client, division, project or activity, e.g. translation"
      className="w-[460px] max-w-full box-border h-[40px] px-3 border border-[var(--panel-border)] rounded-[10px] font-sans text-[13.5px] text-tn-ink bg-white outline-none focus:border-tn-teal" />
  )
  const [client, setClient] = useState('all')
  const clients = [...new Set(ROWS.map(r => r.client))].sort(alpha)
  const rows = ROWS.filter(r => match(r) && (client === 'all' || r.client === client))
    .sort((a, b) => alpha(a.client, b.client) || alpha(a.division, b.division) || alpha(a.project, b.project))
  const th = 'text-left px-3.5 py-2.5 font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted bg-subtle border-b border-[var(--panel-border)] sticky top-0'
  return (
    <>
      <div className="flex flex-wrap gap-2.5 items-center">
        {box}
        <div className="flex bg-white border border-[var(--panel-border)] rounded-[10px] p-[3px] gap-0.5 flex-wrap">
          {[['all', 'All clients'], ...clients.map(x => [x, x])].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setClient(k)} className={`border-0 cursor-pointer rounded-[8px] px-3 py-1.5 font-(family-name:--font-display) font-bold text-[12.5px] ${client === k ? 'bg-tn-primary text-[#ffffff]' : 'bg-transparent text-foreground'}`}>{l}</button>
          ))}
        </div>
      </div>
      <div className="bg-white border border-[var(--panel-border)] rounded-[14px] overflow-x-auto">
        <table className="w-full border-collapse text-[13px] min-w-[860px]">
          <thead><tr><th className={th}>Client</th><th className={th}>Division</th><th className={th}>Project</th><th className={th}>When to use</th><th className={th}>Billable</th></tr></thead>
          <tbody>
            {!rows.length && <tr><td colSpan={5} className="px-3.5 py-8 text-center text-muted">No client, division or project matches. Activities that match are listed below.</td></tr>}
            {rows.map((r, i) => {
              const newClient = i === 0 || rows[i - 1].client !== r.client
              const newDiv = newClient || rows[i - 1].division !== r.division
              return (
                <tr key={`${r.client}-${r.division}-${r.project}`} className={newClient ? 'border-t-2 border-tn-primary' : newDiv ? 'border-t border-[#cfe5e5]' : 'border-t border-[var(--row-rule)]'}>
                  <td className="px-3.5 py-2.5 align-top w-[150px]">{newClient && <b className="font-(family-name:--font-display) text-tn-ink">{r.client}</b>}</td>
                  <td className="px-3.5 py-2.5 align-top w-[170px]">{newDiv && (r.division ? <span className="font-(family-name:--font-display) font-bold text-tn-teal">{r.division}</span> : <span className="text-muted text-[12px]">(none)</span>)}</td>
                  <td className="px-3.5 py-2.5 align-top w-[200px] font-(family-name:--font-display) font-bold text-tn-ink">{r.project}</td>
                  <td className="px-3.5 py-2.5 align-top text-foreground leading-[1.5]">{lineOf(r.project)}</td>
                  <td className="px-3.5 py-2.5 align-top w-[110px]"><Bill on={r.billable} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <ActivitiesTable q={q} />
    </>
  )
}

export default function WhichJobVariants() {
  const v = useSearchParams().get('v') ?? 'A'
  const tabs: [string, string][] = [['A', 'A. Levels'], ['B', 'B. Columns'], ['C', 'C. Table']]
  return (
    <div className="min-h-screen bg-[var(--page-bg,#f1efe8)] px-6 md:px-10 py-8">
      <div className="max-w-[1400px] mx-auto flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {tabs.map(([k, l]) => (
            <Link key={k} href={`?v=${k}`} className={`rounded-[10px] px-3.5 py-2 font-(family-name:--font-display) font-extrabold text-[13px] ${v === k ? 'bg-tn-primary text-[#ffffff]' : 'bg-white border border-[var(--panel-border)] text-tn-ink'}`}>{l}</Link>
          ))}
        </div>
        <div>
          <h1 className="m-0 font-(family-name:--font-display) font-extrabold text-[30px] text-tn-ink" style={{ letterSpacing: '-.01em' }}>Which job?</h1>
          <p className="m-0 mt-1 text-[13.5px] text-muted">Every client, division and project, with when to use it. Billable is set by the project. The same lines show when you clock in.</p>
        </div>
        {v === 'B' ? <VariantB /> : v === 'C' ? <VariantC /> : <VariantA />}
      </div>
    </div>
  )
}
