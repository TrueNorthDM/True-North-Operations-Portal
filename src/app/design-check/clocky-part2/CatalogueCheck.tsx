'use client'

// 11A, 11B, 11Cl (Job Catalogue.dc.html): the real Job catalogue section with
// the prototype's sample, in Company settings' own sub-navigation; 11D the
// "Which job?" page. Nothing saves.

import { SettingsNav } from '@/components/SettingsNav'
import { JobCatalogue } from '@/components/settings/JobCatalogue'
import { WhichJobView } from '@/components/clocky/WhichJobView'
import type { CatalogueData, GuideGroup } from '@/lib/timeclock/job-catalogue'

const ok = async () => ({ ok: true as const, toast: 'Saved.' })
const folder = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4l2 2.5h9A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z" /></svg>

export function CatalogueCheck({ frame, data, startId, guide }: { frame: string; data?: CatalogueData; startId?: number; guide?: { groups: GuideGroup[]; codes: string[] } }) {
  if (guide) return <WhichJobView groups={guide.groups} codes={guide.codes} />
  return (
    <div className="space-y-[22px]">
      <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] text-tn-ink m-0 leading-[normal]" style={{ letterSpacing: '-.01em' }}>Company settings</h1>
      <SettingsNav signedIn={{ name: 'Arnaldo Oliveira', role: 'Super Admin · True North' }} startSection="jobs" sections={[{
        id: 'jobs', label: 'Job catalogue', icon: folder, isNew: true, editable: false,
        content: (
          <div>
            <div className="mb-[18px]">
              <h2 className="font-(family-name:--font-display) font-extrabold text-[19px] text-tn-ink m-0">Job catalogue</h2>
              <p className="text-[13.5px] text-muted mt-1.5 leading-relaxed">The jobs people pick in North Time, their fields and the clients. The portal keeps them now; QuickBooks Time no longer changes what is edited here. A change shows in the clock panel right away.</p>
            </div>
            <JobCatalogue data={data!} canEdit linked={false} startId={startId} startField="code" startTab={frame === '11B' ? 'fields' : frame === '11Cl' ? 'clients' : 'jobs'}
              api={{ saveJob: ok, addFolder: ok, addJob: ok, reorderJobs: async () => ({ ok: true, toast: 'Order saved. The clock panel lists jobs in this order.' }), setOptionShown: ok, renameOption: ok, addOption: ok }} />
          </div>
        ),
      }]} />
    </div>
  )
}
