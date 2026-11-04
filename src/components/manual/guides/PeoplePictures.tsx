'use client'

// The People guides' pictures: the real Directory, person page, Portal access
// tab, org chart, History, Human Resources tabs and anniversary badges, fed
// the manual's made-up data (lib/manual/samples/people.ts). Nothing saves,
// nothing navigates; the picture around them (GuideParts) makes them inert.

import { DirectoryTabs } from '@/components/admin/DirectoryTabs'
import { PortalAccessTab } from '@/components/admin/PortalAccessTab'
import { PersonPage } from '@/components/person/PersonPage'
import { OrgChart } from '@/components/OrgChart'
import { PortalHistory } from '@/components/history/PortalHistory'
import { HrGallery } from '@/components/hr/HrGallery'
import { Tabs } from '@/components/ui/Tabs'
import { hrTabs } from '@/lib/review/hr-tabs'
import type { PageTab } from '@/lib/directory/page-rights'
import {
  adminCardRights, anniversariesSample, directoryPeopleSample, directoryTeamOptions, jordanReportsSample, orgSample,
  personPageSample, twoStepSample, type PageViewer,
} from '@/lib/manual/samples/people'

const noSave = async () => ({ ok: true })

export function DirectoryPicture() {
  return (
    <DirectoryTabs people={directoryPeopleSample()} teamOptions={directoryTeamOptions} teamCards={[]} rights={adminCardRights} accessLog={[]}
      allowed={['emails', 'teams', 'portal']} saveColumns={noSave} />
  )
}

export function PortalAccessPicture() {
  return <PortalAccessTab people={directoryPeopleSample()} twoStep={twoStepSample()} canInvite />
}

export function PersonPagePicture({ viewer, tab }: { viewer: PageViewer; tab: PageTab }) {
  return <PersonPage data={personPageSample(viewer)} tab={tab} canRemove={false} />
}

export function ReportsPicture() {
  return <PersonPage data={jordanReportsSample()} tab="reports" canRemove={false} />
}

export function OrgChartPicture() {
  return <OrgChart roots={orgSample()} />
}

export function HistoryPicture() {
  return <PortalHistory />
}

export function HrTabsPicture({ team }: { team: boolean }) {
  return <Tabs label="Human Resources" value="reviews" items={hrTabs({ first: false, team, all: team })} />
}

export function AnniversariesPicture() {
  const a = anniversariesSample()
  return <HrGallery quarters={a.quarters} years={a.years} next={a.next} />
}
