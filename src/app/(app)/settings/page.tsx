// Settings — language configuration for both projects.

import { createClient } from '@/lib/supabase/server'
import { SettingsForm } from '@/components/SettingsForm'
import { MondayTokenField } from '@/components/MondayTokenField'
import { MondayBoardField } from '@/components/MondayBoardField'
import { WpUrlsField } from '@/components/WpUrlsField'
import { TsheetsTokenField } from '@/components/TsheetsTokenField'
import { BudgetUsageSettings } from '@/components/tsheets/settings/BudgetUsageSettings'
import { SettingsShell } from '@/components/SettingsShell'
import { PullInfo } from '@/components/PullInfo'

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

export default async function SettingsPage() {
  const supabase = await createClient()

  const { data: sites } = await supabase
    .from('sites')
    .select('id, code, name, domain, languages, language_paths, monday_board_id, wp_dev_url, wp_live_url')
    .order('code')

  // API tokens (singleton row) — full values read server-side only;
  // client receives { exists, last4 } to show a masked preview without
  // exposing the raw token to DevTools / Network inspection.
  const { data: appSettings } = await supabase
    .from('app_settings')
    .select('monday_api_token, tsheets_api_token, tsheets_synced_at')
    .eq('singleton_id', 1)
    .maybeSingle()

  // Latest Monday ingest time (the cron writes monday_snapshot.ingested_at per
  // board) — shown as "last pulled X ago" on the Monday API card.
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

  // For each site, count pages with ≥1 URL — used to show "X pages will be
  // flagged" in the save confirmation modal.
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Manage API tokens, the Budget Usage Report, publishing targets, and languages per project.
        </p>
      </div>

      <SettingsShell
        apiTab={
          <div className="space-y-8">
            <MondayTokenField
              tokenInfo={tokenInfo}
              footer={<PullInfo syncedAt={mondayPulledAt} utcHours={[1, 5, 9, 13, 17, 21]} utcMinute={0} label="Boards pulled" pastVerb="pulled" />}
            />
            <TsheetsTokenField
              tokenInfo={tsheetsTokenInfo}
              footer={<PullInfo syncedAt={tsheetsPulledAt} utcHours={[1, 5, 9, 13, 17, 21]} utcMinute={30} label="Clients & people synced" pastVerb="synced" />}
            />

            {/* Projects — per-site config (languages, Monday board ID, WordPress
                URLs). No section heading; the cards speak for themselves. */}
            <div className="space-y-6">
              {enriched.map(site => (
                // Each project card groups its language config and its Monday
                // board ID — both are "what this site is" settings and live in
                // the same visual block to make that mental model obvious.
                <div key={site.code} className="rounded-xl bg-white border border-slate-200 p-5">
                  <SettingsForm site={site} embedded />
                  <MondayBoardField
                    siteCode={site.code}
                    initialBoardId={site.monday_board_id}
                    accent={site.code}
                  />
                  <WpUrlsField
                    siteCode={site.code}
                    initialDev={site.wp_dev_url}
                    initialLive={site.wp_live_url}
                    accent={site.code}
                  />
                </div>
              ))}
            </div>
          </div>
        }
        toolsTab={
          <div className="space-y-8">
            {/* Budget Usage Report — clients & budgets, people & rates, change history. */}
            <BudgetUsageSettings />
          </div>
        }
      />
    </div>
  )
}
