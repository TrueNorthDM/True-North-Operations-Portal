'use client'

/**
 * "Which job?" in the 2026 structure (owner, 28 October 2026, option C): one
 * table of every project with its Client and Division, when to use it and
 * whether it is billable; then the 26 Activities, shared by every project, in
 * the same table style. One search at the top filters both.
 */

import { pillClass } from '@/components/ui/Pill'
import { INPUT } from '@/lib/ui/fields'
import { useState, type ReactNode } from 'react'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { alpha } from '@/components/clocky/clock/clock-model'
import type { ActivityRow } from '@/lib/timeclock/job-catalogue'
import { SEG_BOX, segClass } from '@/lib/ui/segmented'
import { PAGE_TITLE, SECTION_TITLE, TH_CELL } from '@/lib/ui/type'

export type { ActivityRow }
export interface ProjectRow { client: string; division: string; project: string; use: string; billable: boolean }

/** The table head and the Billable pill, shared with Company settings > Job catalogue. */
export const TH = `${TH_CELL} text-left px-3.5 py-2.5`
export const Bill = ({ on }: { on: boolean }) => (
  <span className={pillClass(on ? 'green' : 'gray')}>{on ? 'Billable' : 'Not billable'}</span>
)

export function WhichJob2026View({ projects, activities, switcher }: { projects: ProjectRow[]; activities: ActivityRow[]; switcher?: ReactNode }) {
  const [q, setQ] = useState('')
  const [client, setClient] = useState('all')
  const n = q.trim().toLowerCase()
  const clients = [...new Set(projects.map(r => r.client))].sort(alpha)
  const rows = projects
    .filter(r => (client === 'all' || r.client === client) && (!n || `${r.client} ${r.division} ${r.project} ${r.use}`.toLowerCase().includes(n)))
    .sort((a, b) => alpha(a.client, b.client) || alpha(a.division, b.division) || alpha(a.project, b.project))

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div>
        <Breadcrumb parents={['/clocky-hours']} now="Which job?" />
        <h1 className={PAGE_TITLE}>Which job?</h1>
        <p className="m-0 mt-1 text-[13.5px] text-muted [text-wrap:pretty]">Every client, division and project, with when to use it. Billable is set by the project. The same lines show when you clock in.</p>
        {switcher}
      </div>

      <div className="flex flex-wrap gap-2.5 items-center">
        <input value={q} onChange={e => setQ(e.target.value)} aria-label="Search" placeholder="Search anything: a client, division, project or activity, e.g. translation"
          className={`w-[460px] max-w-full ${INPUT}`} />
        <div className={`${SEG_BOX} flex-wrap`} role="group" aria-label="Client">
          {[['all', 'All clients'], ...clients.map(x => [x, x])].map(([k, l]) => (
            <button key={k} type="button" aria-pressed={client === k} onClick={() => setClient(k)}
              className={segClass(client === k)}>{l}</button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-[var(--panel-border)] rounded-[14px] overflow-x-auto">
        <table className="w-full border-collapse text-[13px] min-w-[860px]">
          <thead><tr><th className={TH}>Client</th><th className={TH}>Division</th><th className={TH}>Project</th><th className={TH}>When to use</th><th className={TH}>Billable</th></tr></thead>
          <tbody>
            {!rows.length && <tr><td colSpan={5} className="px-3.5 py-8 text-center text-muted">No client, division or project matches. Activities that match are listed below.</td></tr>}
            {rows.map((r, i) => {
              const newClient = i === 0 || rows[i - 1].client !== r.client
              const newDiv = newClient || rows[i - 1].division !== r.division
              return (
                <tr key={`${r.client}|${r.division}|${r.project}`} className={newClient && i > 0 ? 'border-t-2 border-tn-primary' : newDiv ? 'border-t border-[#cfe5e5]' : 'border-t border-[var(--row-rule)]'}>
                  <td className="px-3.5 py-2.5 align-top w-[150px]">{newClient && <b className="font-(family-name:--font-display) text-tn-ink">{r.client}</b>}</td>
                  <td className="px-3.5 py-2.5 align-top w-[170px]">{newDiv && (r.division ? <span className="font-(family-name:--font-display) font-bold text-tn-teal">{r.division}</span> : <span className="text-muted text-[12px]">(none)</span>)}</td>
                  <td className="px-3.5 py-2.5 align-top w-[200px] font-(family-name:--font-display) font-bold text-tn-ink">{r.project}</td>
                  <td className="px-3.5 py-2.5 align-top text-foreground leading-[1.5]">{r.use}</td>
                  <td className="px-3.5 py-2.5 align-top w-[110px]"><Bill on={r.billable} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ActivitiesSection activities={activities} query={n} />
    </div>
  )
}

/**
 * The 26 Activities, shared by every project, filtered by the page's search:
 * on "Which job?" and under the projects in Company settings > Job catalogue
 * (`extra` sits beside the heading there: where the list is edited).
 */
export function ActivitiesSection({ activities, query, extra }: { activities: ActivityRow[]; query: string; extra?: ReactNode }) {
  const acts = activities
    .filter(a => !query || `${a.family} ${a.name} ${a.covers}`.toLowerCase().includes(query))
    .sort((a, b) => alpha(a.family, b.family) || alpha(a.name, b.name))
  return (
    <section className="flex flex-col gap-3 mt-4">
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className={SECTION_TITLE}>Activities</h2>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eaf4f4] text-tn-teal px-2.5 py-1 font-(family-name:--font-display) font-extrabold text-[11.5px]">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
            Shared by every client, division and project
          </span>
          {extra}
        </div>
        <div className="bg-white border border-[var(--panel-border)] border-l-4 border-l-tn-teal rounded-[12px] px-4 py-3 text-[13px] text-foreground leading-[1.55]">
          Activities do not belong to a client or a project. <b className="text-tn-ink">The same {activities.length} are offered on every project</b>: first pick where the work goes (Client, Division, Project, in the table above), then the Activity that says <b className="text-tn-ink">what kind of work</b> it was. Translation is translation whether it is for AAAF, HopeFor.Africa or i7.
        </div>
      </div>
      <div className="bg-white border border-[var(--panel-border)] rounded-[14px] overflow-x-auto">
        <table className="w-full border-collapse text-[13px] min-w-[720px]">
          <thead><tr><th className={TH}>Family</th><th className={TH}>Activity</th><th className={TH}>What it covers</th><th className={TH}>Notes</th></tr></thead>
          <tbody>
            {!acts.length && <tr><td colSpan={4} className="px-3.5 py-8 text-center text-muted">No activity matches.</td></tr>}
            {acts.map((a, i) => {
              const newFamily = i === 0 || acts[i - 1].family !== a.family
              return (
                <tr key={a.name} className={newFamily && i > 0 ? 'border-t-2 border-[#cfe5e5]' : 'border-t border-[var(--row-rule)]'}>
                  <td className="px-3.5 py-2.5 align-top w-[150px]">{newFamily && <span className="font-(family-name:--font-display) font-bold text-tn-teal">{a.family}</span>}</td>
                  <td className="px-3.5 py-2.5 align-top w-[260px] font-(family-name:--font-display) font-bold text-tn-ink">{a.name}</td>
                  <td className="px-3.5 py-2.5 align-top text-foreground leading-[1.5]">{a.covers}</td>
                  <td className="px-3.5 py-2.5 align-top w-[110px]">{a.notesRequired
                    ? <span className={pillClass('amber')}>Required</span>
                    : <span className="text-[12px] text-muted">Optional</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
