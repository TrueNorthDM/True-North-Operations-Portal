// What each manual page shows (lib/manual/registry.ts lists the pages). The
// guides are their own components (components/manual/guides); the pages of
// Behind the portal and North Time still render the one-page manual's
// sections (SystemManual's ManualSection) until each is rewritten.

import type { ReactNode } from 'react'
import { ManualSection } from '@/components/SystemManual'
import { HowItRuns } from './HowItRuns'
import { AgendaGuide, AgendaSettingsGuide } from './guides/AgendaGuide'
import { GettingAroundGuide, HomeGuide, ProfileSettingsGuide, WhereGuide } from './guides/GettingStartedGuide'
import { MyTeamGuide, MyWorkGuide, ReportGuide } from './guides/MyWorkGuide'
import { PublishingGoalsGuide } from './guides/PublishingGoalsGuide'
import { ClientReportI7Guide, ClientReportProjectHoursGuide, ClientReportsGuide } from './guides/ClientReportsGuide'
import { HrefLinksGuide } from './guides/HrefLinksGuide'
import { ApprovalsGuide, ExtraHoursGuide, ReimbursementsGuide, TimeOffGuide } from './guides/RequestsGuide'
import { DirectoryGuide, HistoryGuide, HumanResourcesGuide, OrganizationGuide } from './guides/PeopleGuide'
import { AnnualReviewGuide } from './guides/AnnualReviewGuide'
import { AccessLevelsGuide, CompanySettingsGuide, MondayAndAutomationsGuide, NotificationRulesGuide } from './guides/AdminGuide'

/** The guides, by slug. */
const GUIDE: Record<string, () => ReactNode> = {
  'getting-around': GettingAroundGuide,
  'home': HomeGuide,
  'where-do-i-find': WhereGuide,
  'profile-and-settings': ProfileSettingsGuide,
  'agenda': AgendaGuide,
  'agenda-settings': AgendaSettingsGuide,
  'my-work': MyWorkGuide,
  'report': ReportGuide,
  'my-team': MyTeamGuide,
  'publishing-goals': PublishingGoalsGuide,
  'client-reports': ClientReportsGuide,
  'client-report-i7': ClientReportI7Guide,
  'client-report-project-hours': ClientReportProjectHoursGuide,
  'href-links': HrefLinksGuide,
  'time-off': TimeOffGuide,
  'reimbursements': ReimbursementsGuide,
  'extra-hours': ExtraHoursGuide,
  'approvals': ApprovalsGuide,
  'directory': DirectoryGuide,
  'organization': OrganizationGuide,
  'history': HistoryGuide,
  'human-resources': HumanResourcesGuide,
  'annual-review': AnnualReviewGuide,
  'company-settings': CompanySettingsGuide,
  'access-levels': AccessLevelsGuide,
  'notification-rules': NotificationRulesGuide,
  'monday-and-automations': MondayAndAutomationsGuide,
}

/** The one-page manual's section each page not yet rewritten shows, by slug. */
export const SECTION_OF: Record<string, string> = {
  'north-time': 'north-time',
  'north-time-quick-start': 'quick-start',
  'overview': 'overview',
  'pages-and-sections': 'pages',
  'access-model': 'access',
  'how-monday-feeds-it': 'monday',
  'data-sources': 'sources',
  'moving-from-tsheets': 'transition',
}

export function ManualContent({ slug, superOnly }: { slug: string; superOnly: readonly string[] }) {
  const Guide = GUIDE[slug]
  if (Guide) return <Guide />
  if (slug === 'how-it-runs') return <HowItRuns />
  const id = SECTION_OF[slug]
  return id ? <ManualSection id={id} superOnly={superOnly} /> : null
}
