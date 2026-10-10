// Admin > Configuration > Company settings: the settings the whole portal runs
// on, admins only (the 'settings' surface). One left sub-nav: APIs & tokens, My
// Work sources, Clients & budgets, the catalogue, Publishing targets, Sites &
// languages. Until 7 October 2026 this was /settings, in the avatar menu; that
// address now redirects here until the personal Settings takes it.

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
import { loadProjectDirectory, loadReportNote } from '@/lib/tsheets/report-data'
import { NoteCard } from '@/components/tsheets/I7ReportParts'
import { currentYearMonth } from '@/lib/tsheets/report'
import { ClientsTab } from '@/components/tsheets/settings/ClientsTab'
import { ClientsProjectsTab } from '@/components/tsheets/settings/ClientsProjectsTab'
import { ChangeHistory } from '@/components/tsheets/settings/HistoryTab'
import { SyncStatus } from '@/components/tsheets/settings/SyncStatus'
import { TargetsEditor } from '@/components/settings/TargetsEditor'
import { ROUTES } from '@/lib/nav/routes'

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
  const sites = sitesRead.data ?? []
  const pausedByCode = new Map<string, string[]>(
    sites.map(r => [r.code, ((r as { paused_languages?: string[] | null }).paused_languages) ?? []]))

  // The tokens and the webhook secret: APIs & tokens (cs-apis) only.
  const { data: appSettings } = can.apis
    ? await supabase
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
      domain: s.domain,
      languages: s.languages as string[],
      paused_languages: pausedByCode.get(s.code) ?? [],
      language_paths: s.language_paths as Record<string, string>,
      pagesWithUrlsCount: pageIds.size,
      monday_board_id: (s.monday_board_id as string | null) ?? null,
      wp_dev_url: (s.wp_dev_url as string | null) ?? null,
      wp_live_url: (s.wp_live_url as string | null) ?? null,
    })
  }

  // Budget Usage Report data (clients & budgets, history, targets). Pay only
  // with Rates & Costs: the history repeats it.
  const budget = can.clients ? await getBudgetUsageData({ pay: access.can('d-rates') }) : null
  const targetsData = can.targets ? await loadTargetsEditor() : null

  // Clients → Projects → Job codes directory + the auto avg rate (current month).
  // highestRate is the top client rate: Rates & Costs (d-rates) only. Without
  // it the budget editor simply offers no hours estimate.
  const fullDirectory = can.catalog || can.clients ? await loadProjectDirectory(new Date().toISOString().slice(0, 7)) : null
  const projectDirectory = fullDirectory && !access.can('d-rates') ? { ...fullDirectory, highestRate: 0 } : fullDirectory

  // The month note printed on the client PDF. It used to be edited from the
  // report page itself; that page is for reading the month, and this is where
  // the rest of what shapes the report already lives.
  const noteMonth = currentYearMonth()
  const reportNote = can.clients ? await loadReportNote(noteMonth) : null

  // "Signed in as", the current user's directory name (fallback to email).
  const profile = await getCurrentProfile()
  const { data: me } = profile
    ? await supabase.from('people').select('full_name').eq('profile_id', profile.id).maybeSingle()
    : { data: null }
  const signedIn = { name: profile?.full_name ?? me?.full_name ?? profile?.email ?? 'You', role: `${LEVEL_LABEL[access.level]} · True North` }

  const worklistSources = can.myWork ? await loadWorklistSources(createAdminClient()) : null
  const stepsForReview = can.myWork ? await loadStepsForReview(createAdminClient()) : null
  const boardLinks = can.myWork ? await loadBoardLinks() : null

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
            description="Personal API token from monday.com, used to sync page implementation status."
            info={tokenInfo}
            save={saveMondayApiToken}
            placeholder="Paste your Monday personal API token…"
            help={<>Find it at <a href="https://auth.monday.com/users/sign_in" target="_blank" rel="noopener noreferrer" className="text-slate-700 underline">monday.com</a> → Profile picture → Developers → My Access Tokens.</>}
            changeWarning={{ title: 'Change the Monday API token?', confirm: 'I understand, let me change it', body: <p>Replacing it will <strong>break the existing Monday connection</strong> until a working token is saved.</p> }}
            clearWarning={{ title: 'Remove the Monday API token?', confirm: 'Remove token', body: <p>Removing it <strong>breaks the Monday connection</strong>. Implementation status stops syncing until a token is added again.</p> }}
            note={<div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex gap-2"><span aria-hidden="true">🔒</span><span>Stored with row-level security: only admins can read or change it, and it is never sent to the browser.</span></div>}
            footer={<PullInfo syncedAt={mondayPulledAt} utcHours={[1, 5, 9, 13, 17, 21]} utcMinute={0} label="Boards pulled" pastVerb="pulled" />}
          />

          <WebhookUrlField
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
            clearWarning={{ title: 'Remove the TSheets token?', confirm: 'Remove token', body: <p>Removing it stops the hours sync; the Clients Reports page falls back to sample data.</p> }}
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
          <SectionHead title="Publishing targets" desc="The weekly pace goal per site & language. These drive the Publishing Goals dashboard." />
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
  ]

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb parents={[adminCrumb(access.can('admin'))]} self="/admin/settings" />
        <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">Company settings</h1>
        <p className="mt-1.5 text-[15px] text-muted leading-relaxed">
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
 * Boards to link, busiest first, with the projects available to link them to.
 *
 * Only active regular job codes: PTO and unpaid are not project work, and
 * offering them invites a mapping that would make an estimate worse.
 */
async function loadBoardLinks(): Promise<{ boards: BoardLink[]; jobcodes: { id: number; name: string }[] }> {
  const supabase = createAdminClient()

  const [{ data: boards }, { data: jobcodes }] = await Promise.all([
    supabase.from('monday_boards')
      .select('id, name, workspace_name, assignments_count, tc_jobcode_id')
      .eq('included', true),
    supabase.from('tc_jobcodes').select('id, name').eq('active', true).eq('kind', 'regular').order('name'),
  ])

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
    jobcodes: (jobcodes ?? []) as { id: number; name: string }[],
  }
}
