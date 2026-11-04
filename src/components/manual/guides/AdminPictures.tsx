'use client'

// The Admin guides' pictures: the real Company settings, Access levels,
// Notification rules, Monday accounts and My Work sources, fed the manual's
// made-up data (lib/manual/samples/admin.ts). Nothing saves, nothing
// navigates; the picture around them (GuideParts) makes them inert anyway.

import { SettingsNav, type SettingsSection } from '@/components/SettingsNav'
import { HrSettings, type HrSettingsApi } from '@/components/review/HrSettings'
import { AgendaGoogleSwitch, IntegrationsSettings, type IntegrationsApi } from '@/components/settings/ClockySettings'
import { AccessLevels, type AccessPageData } from '@/components/access/AccessLevels'
import { NotificationSettings } from '@/components/NotificationSettings'
import { MondayLinksClient } from '@/components/monday/MondayLinksClient'
import { WorklistSources } from '@/components/monday/WorklistSources'
import { NOTIFICATION_TYPES } from '@/lib/notifications/catalogue'
import { accessLevelsSample, hrSettingsSample, integrationsSample, mondayLinksSample, notificationRulesSample, worklistSourcesSample } from '@/lib/manual/samples/admin'

const EXAMPLE = { ok: true as const, toast: 'This is an example.' }
const noop = async () => EXAMPLE
const noPicker = async () => ({ ok: false as const, error: 'This is an example.' })

const HR_API: HrSettingsApi = {
  saveHrSettings: noop, saveReviewDates: noop, saveHrDriveFolder: noop, hrPicker: noPicker, pickImportFiles: noop,
  setImportPerson: noop, importFiles: noop, saveImportGoal: noop, removeImportGoal: noop,
}
const INTEGRATIONS_API: IntegrationsApi = {
  saveRipplingToken: noop, removeRipplingToken: noop, saveGoogle: noop, removeGoogle: noop, testGoogle: noop,
  retryIntegrationJob: noop, saveGoogleApp: noop, removeGoogleApp: noop,
  drivePicker: noPicker, saveDriveFolder: noop, testDrive: noop, retryDriveCopy: noop, copyDriveNow: noop,
}

// The side menu's icons, as the Company settings page draws them.
const icon = (paths: string[], circles: [number, number, number][] = []) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {circles.map(([cx, cy, r], i) => <circle key={`c${i}`} cx={cx} cy={cy} r={r} />)}
    {paths.map((d, i) => <path key={`p${i}`} d={d} />)}
  </svg>
)
const CATALOG = ['M3 7V5a2 2 0 0 1 2-2h2', 'M17 3h2a2 2 0 0 1 2 2v2', 'M21 17v2a2 2 0 0 1-2 2h-2', 'M7 21H5a2 2 0 0 1-2-2v-2', 'M7 8h10', 'M7 12h6', 'M7 16h8']

/** Every section of Company settings, as a Super Admin sees the side menu, A to Z. */
function sections(open: SettingsSection['content']): SettingsSection[] {
  const s = (id: string, label: string, ic: React.ReactNode, badge?: SettingsSection['badge']): SettingsSection =>
    ({ id, label, icon: ic, editable: false, badge, content: id === 'human-resources' ? open : null })
  return [
    s('apis', 'APIs & tokens', icon(['M15 7a5 5 0 0 1 0 10h-1', 'M9 17a5 5 0 0 1 0-10h1', 'M8 12h8'])),
    s('my-work', 'My Work sources', icon(CATALOG)),
    s('clients', 'Clients & budgets', icon(['M12 1v22', 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'])),
    s('catalog', 'Clients, Projects & Job Codes', icon(CATALOG)),
    s('targets', 'Publishing targets', icon([], [[12, 12, 10], [12, 12, 6], [12, 12, 2]])),
    s('sites', 'Sites & languages', icon(['M2 12h20', 'M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z'], [[12, 12, 10]])),
    s('periods', 'Timesheet periods', icon(['M4 5h16v16H4z', 'M4 10h16', 'M9 3v4', 'M15 3v4', 'M8 14h3', 'M8 17h6'])),
    s('jobs', 'Job catalogue', icon(['M3 6.5A1.5 1.5 0 0 1 4.5 5h4l2 2.5h9A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z'])),
    s('invoices', 'Invoices', icon(['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M8 13h8', 'M8 17h5'])),
    s('integrations', 'Integrations', icon(['M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1', 'M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1'])),
    s('reminders', 'Reminders', icon(['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'])),
    s('rollout', 'North Time rollout', icon(['M4 22V4', 'M4 4h12l-2 4 2 4H4']), { count: 2, label: '2 TSheets entries to decide' }),
    s('human-resources', 'Human Resources', icon(['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M16 11l2 2 4-4'])),
  ].sort((x, y) => x.label.localeCompare(y.label))
}

/** Company settings with its side menu, Human Resources open. */
export function CompanySettingsPicture() {
  const hr = <HrSettings data={hrSettingsSample()} canEdit api={HR_API} />
  return <SettingsNav signedIn={{ name: 'Chris Taylor', role: 'Super Admin · True North' }} sections={sections(hr)} startSection="human-resources" />
}

export function HrSettingsPicture() {
  return <HrSettings data={hrSettingsSample()} canEdit api={HR_API} />
}

export function IntegrationsPicture() {
  return (
    <div className="flex flex-col gap-[18px]">
      <AgendaGoogleSwitch open canChange set={noop} />
      <IntegrationsSettings data={integrationsSample()} canEdit api={INTEGRATIONS_API} />
    </div>
  )
}

export function AccessLevelsPicture({ tab, who }: { tab: AccessPageData['initialTab']; who?: string }) {
  return <AccessLevels data={accessLevelsSample(tab, who ?? null)} />
}

export function NotificationRulesPicture() {
  const { rules, offCounts } = notificationRulesSample()
  return <NotificationSettings mode="rules" types={NOTIFICATION_TYPES} rules={rules} offCounts={offCounts} />
}

export function MondayAccountsPicture() {
  const { board, people } = mondayLinksSample()
  return <MondayLinksClient board={board} people={people} />
}

export function WorklistSourcesPicture() {
  return <WorklistSources sources={worklistSourcesSample()} />
}
