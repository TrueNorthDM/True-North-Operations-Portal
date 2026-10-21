'use client'

// 5A and 5A2: Company settings with the Timesheet periods section open, the
// real SettingsNav and section, the prototype's data. The other sections are
// only their names here.

import { Breadcrumb, adminCrumb } from '@/components/ui/Breadcrumb'
import { SettingsNav, type SettingsSection } from '@/components/SettingsNav'
import { TimesheetPeriodsSection, type PeriodsActions } from '@/components/clocky/periods/TimesheetPeriodsSection'
import { ANCHOR_OPTIONS, periodsData, previewAnchorMove, setPayPeriodAnchor } from './sample'

const ACTIONS: PeriodsActions = { previewAnchorMove, setPayPeriodAnchor }

const icon = (paths: string[]) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {paths.map(d => <path key={d} d={d} />)}
  </svg>
)
const OTHER: [string, string, string[]][] = [
  ['apis', 'APIs & tokens', ['M15 7a5 5 0 0 1 0 10h-1', 'M9 17a5 5 0 0 1 0-10h1', 'M8 12h8']],
  ['my-work', 'My Work sources', ['M3 7V5a2 2 0 0 1 2-2h2', 'M17 3h2a2 2 0 0 1 2 2v2', 'M21 17v2a2 2 0 0 1-2 2h-2', 'M7 21H5a2 2 0 0 1-2-2v-2', 'M7 8h10', 'M7 12h6', 'M7 16h8']],
  ['clients', 'Clients & budgets', ['M12 1v22', 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6']],
  ['catalog', 'Clients, Projects & Job Codes', ['M3 7V5a2 2 0 0 1 2-2h2', 'M17 3h2a2 2 0 0 1 2 2v2', 'M21 17v2a2 2 0 0 1-2 2h-2', 'M7 21H5a2 2 0 0 1-2-2v-2', 'M7 8h10', 'M7 12h6', 'M7 16h8']],
  ['targets', 'Publishing targets', ['M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z', 'M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0z', 'M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0z']],
  ['sites', 'Sites & languages', ['M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z', 'M2 12h20', 'M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z']],
]

export function SettingsCheck({ frame, level }: { frame: string; level: 'super' | 'admin' }) {
  const moving = frame === '5A2'
  const sections: SettingsSection[] = [
    ...OTHER.map(([id, label, paths]) => ({ id, label, icon: icon(paths), editable: false, content: <p className="text-[13.5px] text-muted m-0">{label}: unchanged.</p> })),
    {
      id: 'periods', label: 'Timesheet periods', isNew: true, editable: false,
      icon: icon(['M4 5h16v16H4z', 'M4 10h16', 'M9 3v4', 'M15 3v4', 'M8 14h3', 'M8 17h6']),
      content: (
        <TimesheetPeriodsSection
          data={periodsData(level === 'super' ? 'edit' : 'read')}
          anchorOptions={ANCHOR_OPTIONS}
          startEditing={moving}
          startAnchor={moving ? '2026-10-08' : null}
          startDialog={moving}
          actions={ACTIONS}
        />
      ),
    },
  ]
  return (
    <div className="space-y-[22px]">
      <div>
        <Breadcrumb parents={[adminCrumb(true)]} self="/admin/settings" />
        <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] text-tn-ink m-0 leading-[normal]" style={{ letterSpacing: '-.01em' }}>Company settings</h1>
        <p className="mt-1.5 text-[15px] text-muted leading-normal">
          Sites &amp; languages, publishing targets, clients &amp; budgets, and API tokens, the shared settings the whole portal runs on. Changes apply everywhere.
        </p>
      </div>
      <SettingsNav
        signedIn={level === 'super' ? { name: 'Arnaldo Oliveira', role: 'Super Admin · True North' } : { name: 'Dave Sharpe', role: 'Admin · True North' }}
        sections={sections}
        startSection="periods"
      />
    </div>
  )
}
