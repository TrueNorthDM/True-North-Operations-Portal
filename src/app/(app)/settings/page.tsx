// Settings — one surface with a left sub-nav: APIs & tokens, Clients & budgets,
// People & rates, Publishing targets, Sites & languages (+ Change history). The
// heavy editors are the existing functional components, routed into sections.

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth/role'
import { SettingsNav, type SettingsSection } from '@/components/SettingsNav'
import { SettingsForm } from '@/components/SettingsForm'
import { MondayTokenField } from '@/components/MondayTokenField'
import { MondayBoardField } from '@/components/MondayBoardField'
import { WpUrlsField } from '@/components/WpUrlsField'
import { TsheetsTokenField } from '@/components/TsheetsTokenField'
import { PullInfo } from '@/components/PullInfo'
import { getBudgetUsageData } from '@/lib/tsheets/budget-usage-data'
import { ClientsTab } from '@/components/tsheets/settings/ClientsTab'
import { PeopleTab } from '@/components/tsheets/settings/PeopleTab'
import { FullHistoryButton } from '@/components/settings/FullHistoryButton'
import { HistoryTab, ChangeHistory } from '@/components/tsheets/settings/HistoryTab'
import { SyncStatus } from '@/components/tsheets/settings/SyncStatus'
import { TargetsEditor } from '@/components/boards/TargetsEditor'

interface SiteData {
  id: string
  code: 'aaaf' | 'hfa'
  name: string
  domain: string
  languages: string[]
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
const PeopleIcon = <Icon paths={['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8', 'M23 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75']} />
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
  const supabase = await createClient()

  const { data: sites } = await supabase
    .from('sites')
    .select('id, code, name, domain, languages, language_paths, monday_board_id, wp_dev_url, wp_live_url')
    .order('code')

  const { data: appSettings } = await supabase
    .from('app_settings')
    .select('monday_api_token, tsheets_api_token, tsheets_synced_at')
    .eq('singleton_id', 1)
    .maybeSingle()

  const { data: mondaySnap } = await supabase
    .from('monday_snapshot')
    .select('ingested_at')
    .order('ingested_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const mondayPulledAt = (mondaySnap as { ingested_at: string } | null)?.ingested_at ?? null
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
    const { data: urlRows } = await supabase
      .from('page_urls')
      .select('page_id, pages!inner(site_id)')
      .eq('pages.site_id', s.id)
    const pageIds = new Set((urlRows ?? []).map(r => r.page_id))
    enriched.push({
      id: s.id,
      code: s.code as 'aaaf' | 'hfa',
      name: s.name,
      domain: s.domain,
      languages: s.languages as string[],
      language_paths: s.language_paths as Record<string, string>,
      pagesWithUrlsCount: pageIds.size,
      monday_board_id: (s.monday_board_id as string | null) ?? null,
      wp_dev_url: (s.wp_dev_url as string | null) ?? null,
      wp_live_url: (s.wp_live_url as string | null) ?? null,
    })
  }

  // Budget Usage Report data (clients & budgets, people & rates, history, targets).
  const budget = await getBudgetUsageData()

  // "Signed in as" — the current user's directory name (fallback to email).
  const profile = await getCurrentProfile()
  const { data: me } = profile
    ? await supabase.from('people').select('full_name').eq('profile_id', profile.id).maybeSingle()
    : { data: null }
  const roleLabel = profile?.role ? profile.role[0].toUpperCase() + profile.role.slice(1) : 'Member'
  const signedIn = { name: profile?.full_name ?? me?.full_name ?? profile?.email ?? 'You', role: `${roleLabel} · True North` }

  const sections: SettingsSection[] = [
    {
      id: 'apis',
      label: 'APIs & tokens',
      icon: ApisIcon,
      content: (
        <div className="space-y-8">
          <SectionHead title="APIs & tokens" desc="Connect Monday and QuickBooks Time (TSheets). Tokens are stored server-side and never exposed to the browser." />
          <MondayTokenField tokenInfo={tokenInfo} footer={<PullInfo syncedAt={mondayPulledAt} utcHours={[1, 5, 9, 13, 17, 21]} utcMinute={0} label="Boards pulled" pastVerb="pulled" />} />
          <TsheetsTokenField tokenInfo={tsheetsTokenInfo} footer={<PullInfo syncedAt={tsheetsPulledAt} utcHours={[1, 5, 9, 13, 17, 21]} utcMinute={30} label="Clients & people synced" pastVerb="synced" />} />
        </div>
      ),
    },
    {
      id: 'clients',
      label: 'Clients & budgets',
      icon: ClientsIcon,
      editable: false,
      content: (
        <div className="space-y-12">
          <div className="space-y-5">
            <SectionHead title="Clients & budgets" desc="The dollar budget and budget period for each client. “Extra” is an approved top-up covering part of the period. Hours are read live from QuickBooks Time and power the i7 Budget Usage Report." />
            <div className="flex items-center gap-3.5 flex-wrap">
              <Link
                href="/tools/time-report/guide"
                title="How the report works"
                aria-label="How the report works"
                className="shrink-0 w-11 h-11 rounded-full bg-tn-primary text-white flex items-center justify-center shadow-[0_8px_18px_-8px_rgba(1,35,88,.6)] transition-transform hover:-translate-y-0.5"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F2C40A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
              </Link>
              <SyncStatus syncedAt={budget.syncedAt} interactive={budget.canSync} />
              <FullHistoryButton />
            </div>
            <ClientsTab clients={budget.clients} />
          </div>
          <ChangeHistory entries={budget.auditLog} />
        </div>
      ),
    },
    {
      id: 'people',
      label: 'People & rates',
      icon: PeopleIcon,
      editable: false,
      content: (
        <div className="space-y-5">
          <SectionHead title="People & rates" desc="Everyone who logs time on i7. Rate / client is what the client is billed per hour; Rate / cost is what the hour costs internally. Changes are justified and audited." />
          <PeopleTab people={budget.people} allClients={budget.clients.map(c => ({ id: c.id, name: c.name }))} directoryOptions={budget.directoryOptions} />
        </div>
      ),
    },
    {
      id: 'targets',
      label: 'Publishing targets',
      icon: TargetsIcon,
      editable: false,
      content: (
        <div className="space-y-5">
          <SectionHead title="Publishing targets" desc="The weekly pace goal per site & language. These drive the Publishing Goals dashboard." />
          <TargetsEditor targets={budget.publishingTargets} isAdmin={budget.canSync} audit={budget.publishingAudit} grid />
        </div>
      ),
    },
    {
      id: 'sites',
      label: 'Sites & languages',
      icon: SitesIcon,
      editable: false,
      content: (
        <div>
          <SectionHead title="Sites & languages" desc="Per-project configuration — publishing languages, the Monday board ID, and the WordPress URLs." />
          <div className="space-y-6">
            {enriched.map(site => (
              <div key={site.code} className="rounded-[16px] bg-white border border-slate-200 p-5 shadow-[0_1px_2px_rgba(1,35,88,.06)]">
                <SettingsForm site={site} embedded />
                <MondayBoardField siteCode={site.code} initialBoardId={site.monday_board_id} accent={site.code} />
                <WpUrlsField siteCode={site.code} initialDev={site.wp_dev_url} initialLive={site.wp_live_url} accent={site.code} />
              </div>
            ))}
          </div>
        </div>
      ),
    },
  ]

  const historyContent = (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <SectionHead title="Full history" desc="Every budget, rate, and target change — who changed what, when, and why — plus the past budget schedule." />
        <FullHistoryButton />
      </div>
      <HistoryTab entries={budget.auditLog} pastBudgets={budget.pastBudgets} pastProjectHours={budget.pastProjectHours} />
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">Settings</h1>
        <p className="mt-1.5 text-[15px] text-muted leading-relaxed">
          Sites &amp; languages, publishing targets, clients &amp; budgets, people &amp; rates, and API tokens — the shared settings the whole portal runs on. Changes apply everywhere.
        </p>
      </div>

      <SettingsNav signedIn={signedIn} sections={sections} historyContent={historyContent} />
    </div>
  )
}
