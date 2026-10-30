// Admin > Configuration > Company settings: the settings the whole portal runs
// on, admins only (the 'settings' surface). One left sub-nav: APIs & tokens, My
// Work sources, Clients & budgets, the catalogue, Publishing targets, Sites &
// languages, and Timesheet periods (Clocky, 16 October 2026). Until 7 October
// 2026 this was /settings, in the avatar menu; that address now redirects here
// until the personal Settings takes it.

import Link from 'next/link'
import { Breadcrumb, adminCrumb } from '@/components/ui/Breadcrumb'
import { WorklistSources } from '@/components/monday/WorklistSources'
import { loadWorklistSources } from '@/lib/monday/worklist/sources'
import { StepReview } from '@/components/monday/StepReview'
import { loadStepsForReview, reviewProgress } from '@/lib/monday/worklist/steps-review'
import { BoardProjects, type BoardLink } from '@/components/monday/BoardProjects'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth/role'
import { requireSurface } from '@/lib/access/resolve'
import { LEVEL_LABEL } from '@/lib/access/catalogue'
import { SettingsNav, type SettingsSection } from '@/components/SettingsNav'
import { SiteCard } from '@/components/settings/SiteCard'
import { SecretField } from '@/components/settings/SecretField'
import { WebhookUrlField } from '@/components/settings/WebhookUrlField'
import { saveMondayApiToken, saveTsheetsApiToken, regenerateMondayWebhookSecret } from '@/app/actions'
import { PullInfo } from '@/components/PullInfo'
import { getBudgetUsageData } from '@/lib/tsheets/budget-usage-data'
import { loadTargetsEditor } from '@/lib/boards/targets-data'
import { pagesWithUrls } from '@/lib/site-pages'
import { PUBLISHING_BOARD_IDS } from '@/lib/boards/config'
import { headers } from 'next/headers'
import { publicOrigin } from '@/lib/auth/public-origin'
import { loadProjectDirectory, loadReportNote } from '@/lib/tsheets/report-data'
import { NoteCard } from '@/components/tsheets/I7ReportParts'
import { currentYearMonth } from '@/lib/tsheets/report'
import { ClientsTab } from '@/components/tsheets/settings/ClientsTab'
import { ClientsProjectsTab } from '@/components/tsheets/settings/ClientsProjectsTab'
import { ChangeHistory } from '@/components/tsheets/settings/HistoryTab'
import { SyncStatus } from '@/components/tsheets/settings/SyncStatus'
import { TargetsEditor } from '@/components/settings/TargetsEditor'
import { ROUTES } from '@/lib/nav/routes'
import { isSiteCode } from '@/lib/href-links/rules'
import { TimesheetPeriodsSection } from '@/components/clocky/periods/TimesheetPeriodsSection'
import { getTimesheetPeriods } from '@/app/(app)/clocky-hours/periods/actions'
import { viewerFor } from '@/lib/timeclock/clocky-context'
import { loadIntegrations, loadInvoiceSettingsData, loadReminders } from '@/lib/timeclock/company-settings'
import { loadCatalogueData } from '@/lib/timeclock/job-catalogue'
import { loadCatalog } from '@/lib/timeclock/clocky-context'
import { JobCatalogue } from '@/components/settings/JobCatalogue'
import { addFolder, addJob, addOption, linkFolders, renameOption, reorderJobs, saveJob, setOptionShown } from './catalogue-actions'
import { AgendaGoogleSwitch, IntegrationsSettings, InvoiceSettings, NorthTimeOpenSwitch, RemindersSettings, RolloutSettings } from '@/components/settings/ClockySettings'
import { saveRolloutDates, moveToWave, setNorthTimeOpen, setAgendaGoogleOpen } from './rollout-actions'
import { northTimeOpen } from '@/lib/timeclock/north-time-lock'
import { agendaGoogleOpen } from '@/lib/agenda/google-lock'
import { loadRolloutData } from '@/lib/timeclock/waves-data'
import { removeGoogle, removeRipplingToken, retryIntegrationJob, saveGoogle, saveInvoiceSettings, saveRipplingToken, setReminder, testGoogle } from './clocky-actions'
import { loadClockySettings } from '@/lib/timeclock/clocky-context'
import { anchorOptions } from '@/components/clocky/periods/anchor-options'
import type { TimesheetPeriodsData } from '@/lib/timeclock/clocky-types'
import { localDate } from '@/lib/timeclock/format'

interface SiteData {
  id: string
  code: 'aaaf' | 'hfa'
  name: string
  domain: string
  languages: string[]
  paused_languages: string[]
  language_paths: Record<string, string>
  pagesWithUrlsCount: number
  monday_board_id: string | null
  wp_dev_url: string | null
  wp_live_url: string | null
}

const iconProps = { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
// Each SVG child is keyed: these elements are created at module scope (outside a
// render), so React would otherwise flag the child paths as a keyless list.
const Icon = ({ paths, circles = [] }: { paths?: string[]; circles?: [number, number, number][] }) => (
  <svg {...iconProps} aria-hidden="true">
    {circles.map(([cx, cy, r], i) => <circle key={`c${i}`} cx={cx} cy={cy} r={r} />)}
    {paths?.map((d, i) => <path key={`p${i}`} d={d} />)}
  </svg>
)
const ApisIcon = <Icon paths={['M15 7a5 5 0 0 1 0 10h-1', 'M9 17a5 5 0 0 1 0-10h1', 'M8 12h8']} />
const ClientsIcon = <Icon paths={['M12 1v22', 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6']} />
const CatalogIcon = <Icon paths={['M3 7V5a2 2 0 0 1 2-2h2', 'M17 3h2a2 2 0 0 1 2 2v2', 'M21 17v2a2 2 0 0 1-2 2h-2', 'M7 21H5a2 2 0 0 1-2-2v-2', 'M7 8h10', 'M7 12h6', 'M7 16h8']} />
const TargetsIcon = <Icon circles={[[12, 12, 10], [12, 12, 6], [12, 12, 2]]} />
const SitesIcon = <Icon circles={[[12, 12, 10]]} paths={['M2 12h20', 'M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z']} />
const PeriodsIcon = <Icon paths={['M4 5h16v16H4z', 'M4 10h16', 'M9 3v4', 'M15 3v4', 'M8 14h3', 'M8 17h6']} />
// Clocky part 2 (Company Settings.dc.html CS): Invoices, Integrations, Reminders.
const JobsIcon = <Icon paths={['M3 6.5A1.5 1.5 0 0 1 4.5 5h4l2 2.5h9A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z']} />
const InvoicesIcon = <Icon paths={['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M8 13h8', 'M8 17h5']} />
const IntegrationsIcon = <Icon paths={['M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1', 'M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1']} />
const RemindersIcon = <Icon paths={['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0']} />
// North Time rollout (owner, 27 October 2026): a flag on its day.
const RolloutIcon = <Icon paths={['M4 22V4', 'M4 4h12l-2 4 2 4H4']} />

function SectionHead({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mb-[18px]">
      <h2 className="font-(family-name:--font-display) font-extrabold text-[19px] text-tn-ink m-0">{title}</h2>
      <p className="text-[13.5px] text-muted mt-1.5 leading-relaxed">{desc}</p>
    </div>
  )
}

export default async function SettingsPage() {
  // Settings exposes budgets, hourly rates and the API token panel, so it is
  // gated on the server, not just by hiding the sidebar icon (which left the
  // page reachable by typing the URL). Same gate as /human-resources.
  const access = await requireSurface('settings')
  // Each section is its own item on Admin > Access levels. A section the
  // person's access does not open is neither read nor sent to the browser.
  const can = {
    apis: access.can('cs-apis'),
    myWork: access.can('cs-my-work'),
    clients: access.can('cs-clients'),
    catalog: access.can('cs-catalog'),
    targets: access.can('cs-targets'),
    sites: access.can('cs-sites'),
    periods: access.can('cs-periods'),
    jobs: access.can('cs-jobs'),
    integrations: access.can('cs-integrations'),
    invoices: access.can('cs-invoices'),
    reminders: access.can('cs-reminders'),
    rollout: access.can('cs-rollout'),
  }

  const supabase = await createClient()

  // Sites & languages, read by the server: the Href Links tables are closed
  // to sessions (migration 107), and who may see this section is decided
  // above (cs-sites). A failed read stops the page rather than show no sites.
  const db = createAdminClient()
  const sitesRead = can.sites
    ? await db
      .from('sites')
      .select('id, code, name, domain, languages, paused_languages, language_paths, monday_board_id, wp_dev_url, wp_live_url')
      .order('code')
    : { data: [], error: null }
  if (sitesRead.error) throw new Error(`Settings could not read the sites: ${sitesRead.error.message}`)
  // The Href Links sites only. Bessemeters has a sites row for its language
  // and its two-week rhythm (migration 111), but no domain, no hreflang pages
  // and no WordPress links: its rhythm is set on Publishing targets
  // (15 October 2026).
  const sites = (sitesRead.data ?? []).filter(r => isSiteCode(r.code))
  const pausedByCode = new Map<string, string[]>(
    sites.map(r => [r.code, ((r as { paused_languages?: string[] | null }).paused_languages) ?? []]))

  // The tokens and the webhook secret: APIs & tokens (cs-apis, Super Admin
  // only), read by the server (app_settings is closed to sessions, migration
  // 108). Only the last four characters of a token reach the browser.
  const { data: appSettings } = can.apis
    ? await db
      .from('app_settings')
      .select('monday_api_token, tsheets_api_token, monday_webhook_secret, tsheets_synced_at')
      .eq('singleton_id', 1)
      .maybeSingle()
    : { data: null }

  // The OLDEST board's pull, read by the server (the table is closed to
  // sessions, migration 106): the newest one hid a board failing for days
  // behind the other (audit, 10 October 2026).
  const { data: mondaySnaps } = await createAdminClient()
    .from('monday_snapshot')
    .select('ingested_at')
    .in('board_id', PUBLISHING_BOARD_IDS)
    .order('ingested_at', { ascending: true })
    .limit(1)
  const mondayPulledAt = ((mondaySnaps ?? []) as { ingested_at: string }[])[0]?.ingested_at ?? null
  const tsheetsPulledAt = appSettings?.tsheets_synced_at ?? null
  const tokenInfo = {
    exists: !!appSettings?.monday_api_token,
    last4: appSettings?.monday_api_token ? appSettings.monday_api_token.slice(-4) : null,
  }
  const tsheetsTokenInfo = {
    exists: !!appSettings?.tsheets_api_token,
    last4: appSettings?.tsheets_api_token ? appSettings.tsheets_api_token.slice(-4) : null,
  }

  const enriched: SiteData[] = []
  for (const s of sites ?? []) {
    // How many pages a new language would flag (lib/site-pages.ts).
    const pageIds = await pagesWithUrls(db, s.id)
    enriched.push({
      id: s.id,
      code: s.code as 'aaaf' | 'hfa',
      name: s.name,
      domain: s.domain ?? '',
      languages: s.languages as string[],
      paused_languages: pausedByCode.get(s.code) ?? [],
      language_paths: s.language_paths as Record<string, string>,
      pagesWithUrlsCount: pageIds.size,
      monday_board_id: (s.monday_board_id as string | null) ?? null,
      wp_dev_url: (s.wp_dev_url as string | null) ?? null,
      wp_live_url: (s.wp_live_url as string | null) ?? null,
    })
  }

  // The sections' loaders, together rather than one after another (audit,
  // 10 October 2026); each still runs only for the section it feeds.
  //
  // Budget Usage Report data (clients & budgets, history). Pay only with Rates
  // & Costs: the history repeats it. The Clients > Projects > Job codes
  // directory and the auto average rate are for the current New York month;
  // highestRate is the top client rate, Rates & Costs (d-rates) only. The month
  // note is printed on the client PDF.
  const noteMonth = currentYearMonth()
  const profileP = getCurrentProfile()
  // The address Monday posts to, built here so the browser draws what the
  // server drew (it used window.location in render).
  const h = await headers()
  const origin = publicOrigin(`${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost'}`)
  const [budget, targetsData, fullDirectory, reportNote, profile, worklistSources, stepsForReview, boardLinks, periods] = await Promise.all([
    can.clients ? getBudgetUsageData({ pay: access.can('d-rates') }) : null,
    can.targets ? loadTargetsEditor() : null,
    can.catalog || can.clients ? loadProjectDirectory(noteMonth) : null,
    can.clients ? loadReportNote(noteMonth) : null,
    profileP,
    can.myWork ? loadWorklistSources(createAdminClient()) : null,
    can.myWork ? loadStepsForReview(createAdminClient()) : null,
    can.myWork ? loadBoardLinks() : null,
    can.periods ? loadPeriods() : null,
  ])
  // Clocky part 2 (Company Settings.dc.html 13A, 13B, 13C).
  const zone = (await viewerFor(access))?.zone ?? 'America/New_York'
  const ntOpen = await northTimeOpen()
  const agOpen = await agendaGoogleOpen()
  const [integrations, invoiceSettings, reminders, jobCatalogue, rollout] = await Promise.all([
    can.integrations ? loadIntegrations(zone) : null,
    can.invoices ? loadInvoiceSettingsData() : null,
    can.reminders ? loadReminders() : null,
    can.jobs ? loadCatalogueData() : null,
    can.rollout ? loadRolloutData(createAdminClient()) : null,
  ])
  const projectDirectory = fullDirectory && !access.can('d-rates') ? { ...fullDirectory, highestRate: 0 } : fullDirectory

  // "Signed in as", the current user's directory name (fallback to email).
  const { data: me } = profile
    ? await supabase.from('people').select('full_name').eq('profile_id', profile.id).maybeSingle()
    : { data: null }
  const signedIn = { name: profile?.full_name ?? me?.full_name ?? profile?.email ?? 'You', role: `${LEVEL_LABEL[access.level]} · True North` }

  const sections: (SettingsSection | false | null)[] = [
    can.apis && {
      id: 'apis',
      label: 'APIs & tokens',
      icon: ApisIcon,
      content: (
        <div className="space-y-8">
          <SectionHead title="APIs & tokens" desc="Connect Monday and QuickBooks Time (TSheets). Tokens are stored server-side and never exposed to the browser." />
          <SecretField
            title="Monday API"
            description="Personal API token from monday.com. It reads the boards for My Work, the Report, Publishing Goals and Href Links."
            info={tokenInfo}
            save={saveMondayApiToken}
            placeholder="Paste your Monday personal API token…"
            help={<>Find it at <a href="https://auth.monday.com/users/sign_in" target="_blank" rel="noopener noreferrer" className="text-slate-700 underline">monday.com</a> → Profile picture → Developers → My Access Tokens.</>}
            changeWarning={{ title: 'Change the Monday API token?', confirm: 'I understand, let me change it', body: <p>Replacing it will <strong>break the existing Monday connection</strong> until a working token is saved.</p> }}
            clearWarning={{ title: 'Remove the Monday API token?', confirm: 'Remove token', body: <p>Removing it <strong>breaks the Monday connection</strong>. Implementation status stops syncing until a token is added again.</p> }}
            note={<div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex gap-2"><span aria-hidden="true">🔒</span><span>Read and written only by the server, for Super Admins. Only its last four characters reach the browser.</span></div>}
            footer={<PullInfo syncedAt={mondayPulledAt} utcHours={[1, 5, 9, 13, 17, 21]} utcMinute={0} label="Boards pulled" pastVerb="pulled" />}
          />

          <WebhookUrlField
            origin={origin}
            secret={appSettings?.monday_webhook_secret ?? null}
            regenerate={regenerateMondayWebhookSecret}
          />

          <SecretField
            title="QuickBooks Time (TSheets) API"
            description="Static API token, used by the Clients Reports tool to pull hours from TSheets."
            info={tsheetsTokenInfo}
            save={saveTsheetsApiToken}
            placeholder="Paste your TSheets API token…"
            changeWarning={{ title: 'Change the TSheets token?', confirm: 'I understand, let me change it', body: <p>Replacing it will <strong>break the hours sync</strong> until a working token is saved.</p> }}
            clearWarning={{ title: 'Remove the TSheets token?', confirm: 'Remove token', body: <p>Removing it stops the hours sync from QuickBooks Time until a new token is saved.</p> }}
            footer={<PullInfo syncedAt={tsheetsPulledAt} utcHours={[1, 5, 9, 13, 17, 21]} utcMinute={30} label="Clients & people synced" pastVerb="synced" />}
          />
        </div>
      ),
    },
    can.myWork && worklistSources && stepsForReview && boardLinks && {
      id: 'my-work',
      label: 'My Work sources',
      icon: CatalogIcon,
      editable: false,
      content: (
        <div className="space-y-5">
          <SectionHead
            title="My Work sources"
            desc="Which Monday workspaces, boards and people are allowed to appear on My Work. 262 boards is more than anybody works on: finished projects, experiments and personal spaces keep producing steps that will never be done, and every one of them makes the list longer without making it truer. Each row shows how much work it holds and when it was last touched, so the boards nobody has used in years list themselves."
          />
          <WorklistSources sources={worklistSources} />

          <div className="mt-8">
            <SectionHead
              title="Steps the ingest guessed"
              desc="A step is a status with a deadline: on each board, the status column that sits before a date column, owned by the people column beside it. Statuses with no deadline, like Kick-Off, Design Needs or an Assigner's Assign, are not steps and stay off My Work. The rule reads the board's layout, because Monday does not share its Deadline Mode links, so it is a guess until somebody looks. Each row shows what it read; switch off anything that is not a stage of work. The ones that read like a dropdown come first, then the ones carrying the most work."
            />
            <StepReview steps={stepsForReview} progress={reviewProgress(stepsForReview)} />
          </div>

          <div className="mt-8">
            <SectionHead
              title="Boards and timeclock projects"
              desc="The Workload tab estimates how much work is ahead of somebody by multiplying their open steps by an hours-per-step figure. A board with no project code shares one average across the whole company, so a translation step and a monthly report count as the same amount of work. Linking a board measures it against its own hours instead, and the estimate audit stops saying fallback. The busiest boards are first: linking the top ten changes the numbers, linking the quietest hundred does not."
            />
            <BoardProjects boards={boardLinks.boards} jobcodes={boardLinks.jobcodes} />
          </div>
        </div>
      ),
    },
    can.clients && budget && projectDirectory && {
      id: 'clients',
      label: 'Clients & budgets',
      icon: ClientsIcon,
      editable: false,
      content: (
        <div className="space-y-12">
          <div className="space-y-5">
            <SectionHead title="Clients & budgets" desc="The dollar budget and budget period for each client. “Extra” is an approved top-up covering part of the period. Hours are read live from QuickBooks Time and power the Clients Reports page." />
            <div className="flex items-center gap-3.5 flex-wrap">
              {access.can('i7-guide') && <Link
                href={`${ROUTES.i7}/guide`}
                title="How the report works"
                aria-label="How the report works"
                className="shrink-0 w-11 h-11 rounded-full bg-tn-primary text-white flex items-center justify-center shadow-[0_8px_18px_-8px_rgba(1,35,88,.6)] transition-transform hover:-translate-y-0.5"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F2C40A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
              </Link>}
              <SyncStatus syncedAt={budget.syncedAt} interactive={can.clients} />
            </div>
            <ClientsTab clients={budget.clients} estimateRate={access.can('d-rates') ? projectDirectory.highestRate : undefined} />
            {/* Grant Pass framework placeholder: it is an hours-based retainer
                (Church + School) with no dollar budget and no QuickBooks Time
                feed, so it doesn't fit the budget table above. This reserves the
                spot until the data source is confirmed. */}
            {/* The month note printed on the client PDF as "Highlights". Its
                editor used to sit on the report page; the report page is for
                reading the month, and this section already owns everything else
                that shapes what the client receives. */}
            <NoteCard month={noteMonth} note={reportNote ?? ''} canEdit={access.can('i7-note')} />

            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Setup pending</span>
                <span className="text-sm font-semibold text-tn-ink">Grant Pass</span>
              </div>
              <p className="mt-1.5 text-sm text-muted leading-relaxed m-0">
                Grant Pass (Church and School) is an hours-based retainer tracked with a monthly
                carryover, not a dollar budget, and it is not logged in QuickBooks Time. Once the
                data source is confirmed, its setup will live here. Its report already has its
                own page and its own access grant.
              </p>
            </div>
          </div>
          <ChangeHistory entries={budget.auditLog} />
        </div>
      ),
    },
    can.catalog && projectDirectory && {
      id: 'catalog',
      label: 'Clients, Projects & Job Codes',
      icon: CatalogIcon,
      editable: false,
      content: (
        <div className="space-y-5">
          <SectionHead title="Clients, Projects & Job Codes" desc="The client, its projects, and the job codes under each, read live from QuickBooks Time. Each project shows who's assigned and the average billing rate that feeds the Budget Usage Report." />
          <ClientsProjectsTab directory={projectDirectory} />
        </div>
      ),
    },
    can.targets && targetsData && {
      id: 'targets',
      label: 'Publishing targets',
      icon: TargetsIcon,
      editable: false,
      content: (
        <div className="space-y-5">
          <SectionHead title="Publishing targets" desc="The pace goal per site & language, per week or per two-week cycle. These drive the Publishing Goals dashboard." />
          <TargetsEditor {...targetsData} canEdit={can.targets} grid />
        </div>
      ),
    },
    can.sites && {
      id: 'sites',
      label: 'Sites & languages',
      icon: SitesIcon,
      editable: false,
      content: (
        <div className="space-y-5">
          <SectionHead title="Sites & languages" desc="The publishing languages tracked for each site. Pause a language to hide it from dashboards and reports without deleting its history." />
          <div className="space-y-[18px]">
            {enriched.map(site => (
              <SiteCard key={site.code} site={site} />
            ))}
          </div>
        </div>
      ),
    },
    can.periods && periods && {
      id: 'periods',
      label: 'Timesheet periods',
      icon: PeriodsIcon,
      // Its own Edit / Done: Done saves, and moving the start date asks first.
      editable: false,
      content: 'error' in periods
        ? <p role="alert" className="text-[13.5px] text-[#c8323d] m-0">{periods.error}</p>
        : <TimesheetPeriodsSection data={periods.data} anchorOptions={periods.options} />,
    },
    can.jobs && jobCatalogue && {
      id: 'jobs',
      label: 'Job catalogue',
      icon: JobsIcon,
      isNew: true,
      editable: false,
      content: (
        <div>
          <SectionHead title="Job catalogue" desc="The jobs people pick in North Time, their fields and the clients. The portal keeps them now; QuickBooks Time no longer changes what is edited here. A change shows in the clock panel right away." />
          <JobCatalogue data={jobCatalogue} canEdit={access.can('cs-jobs-edit')} api={{ saveJob, addFolder, addJob, reorderJobs, setOptionShown, renameOption, addOption, linkFolders }} />
        </div>
      ),
    },
    can.invoices && invoiceSettings && {
      id: 'invoices',
      label: 'Invoices',
      icon: InvoicesIcon,
      isNew: true,
      editable: false,
      content: (
        <div>
          <SectionHead title="Invoices" desc='How invoices and reimbursement documents are numbered, and what True North puts in the "To" block.' />
          <InvoiceSettings data={invoiceSettings} canEdit={access.can('cs-invoices-edit')} save={saveInvoiceSettings} />
        </div>
      ),
    },
    can.integrations && integrations && {
      id: 'integrations',
      label: 'Integrations',
      icon: IntegrationsIcon,
      isNew: true,
      editable: false,
      content: (
        <div>
          <SectionHead title="Integrations" desc="Rippling for payroll and PTO, Google Calendar for the team calendar. The portal fills them; nobody copies by hand." />
          <div className="mb-[18px]"><AgendaGoogleSwitch open={agOpen} canChange={access.isSuperAdmin} set={setAgendaGoogleOpen} /></div>
          <IntegrationsSettings data={integrations} canEdit={access.can('cs-integrations-edit')} api={{ saveRipplingToken, removeRipplingToken, saveGoogle, removeGoogle, testGoogle, retryIntegrationJob }} />
        </div>
      ),
    },
    can.reminders && reminders && {
      id: 'reminders',
      label: 'Reminders',
      icon: RemindersIcon,
      isNew: true,
      editable: false,
      content: (
        <div>
          <SectionHead title="Reminders" desc="When the bell reminds people to submit, and the new lines it shows." />
          <RemindersSettings on={reminders} canEdit={access.can('cs-reminders-edit')} set={setReminder} />
        </div>
      ),
    },
    can.rollout && rollout && {
      id: 'rollout',
      label: 'North Time rollout',
      icon: RolloutIcon,
      isNew: true,
      badge: { count: rollout.setAside, label: `${rollout.setAside} TSheets ${rollout.setAside === 1 ? 'entry' : 'entries'} to decide` },
      editable: false,
      content: (
        <div>
          <SectionHead title="North Time rollout" desc="Who starts on North Time when. Wave 1 is everyone at Team Leader level or above, plus anyone added by hand; wave 2 is everyone else. Until a wave has a date, nothing changes for its people." />
          <div className="mb-[18px]"><NorthTimeOpenSwitch open={ntOpen} canChange={access.isSuperAdmin} set={setNorthTimeOpen} /></div>
          <RolloutSettings data={rollout} canEdit={access.can('cs-rollout-edit')} api={{ saveRolloutDates, moveToWave }} skippedHref="/admin/settings/tsheets-after-switch" />
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-[22px]">
      <div>
        <Breadcrumb parents={[adminCrumb(access.can('admin'))]} self="/admin/settings" />
        <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] text-tn-ink m-0 leading-[normal]" style={{ letterSpacing: '-.01em' }}>Company settings</h1>
        <p className="mt-1.5 text-[15px] text-muted leading-normal">
          Sites &amp; languages, publishing targets, clients &amp; budgets, and API tokens, the shared settings the whole portal runs on. Changes apply everywhere.
        </p>
      </div>

      {sections.some(Boolean)
        ? <SettingsNav signedIn={signedIn} sections={sections.filter((x): x is SettingsSection => !!x)} />
        : <p className="text-[14px] text-muted">None of the sections here is open to your access level. A Super Admin can open them on Admin &gt; Access levels.</p>}
    </div>
  )
}

/**
 * Timesheet periods (Clocky): the section's data and the days its start date
 * can be set to, around today in the company's zone.
 */
async function loadPeriods(): Promise<{ data: TimesheetPeriodsData; options: string[] } | { error: string }> {
  const res = await getTimesheetPeriods()
  if (!res.ok) return { error: res.error }
  const settings = await loadClockySettings()
  return { data: res.data, options: anchorOptions(localDate(new Date(), settings.companyZone), res.data.anchor) }
}

/**
 * Boards to link, busiest first, with the projects available to link them to.
 *
 * Only active regular job codes: PTO and unpaid are not project work, and
 * offering them invites a mapping that would make an estimate worse.
 */
async function loadBoardLinks(): Promise<{ boards: BoardLink[]; jobcodes: { id: number; name: string }[] }> {
  const supabase = createAdminClient()

  const [{ data: boards }, catalog] = await Promise.all([
    supabase.from('monday_boards')
      .select('id, name, workspace_name, assignments_count, tc_jobcode_id')
      .eq('included', true),
    loadCatalog(),
  ])
  // Every job hours can be logged to, by its full path: the TSheets jobs and the
  // 2026 projects ("COE Group › Africa › HopeFor.Africa"), so a board can be
  // linked to the project it will be clocked under after the switch date.
  const jobcodes = [...catalog.jobs.values()].filter(j => j.selectable)
    .map(j => ({ id: j.id, name: j.structure === 2 ? j.path : j.name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  type Row = {
    id: number; name: string; workspace_name: string | null
    assignments_count: number | null; tc_jobcode_id: number | null
  }

  return {
    boards: ((boards ?? []) as Row[])
      .map(b => ({
        id: b.id,
        name: b.name,
        workspaceName: b.workspace_name,
        assignments: b.assignments_count ?? 0,
        jobcodeId: b.tc_jobcode_id,
      }))
      .sort((a, b) => b.assignments - a.assignments),
    jobcodes,
  }
}
