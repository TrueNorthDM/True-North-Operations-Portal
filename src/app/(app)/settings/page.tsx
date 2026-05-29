// Settings — language configuration for both projects.

import { createClient } from '@/lib/supabase/server'
import { SettingsForm } from '@/components/SettingsForm'
import { MondayTokenField } from '@/components/MondayTokenField'
import { MondayBoardField } from '@/components/MondayBoardField'
import { WpUrlsField } from '@/components/WpUrlsField'

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

  // Monday API token (single-row singleton).
  // SECURITY: server reads the full token but ONLY sends { exists, last4 } to
  // the client — the actual value never leaves the server here, so client-side
  // inspection (DevTools, Network) can't reveal it. (The token is still in
  // Supabase under anon-key reach; auth + RLS will fully lock it down later.)
  const { data: appSettings } = await supabase
    .from('app_settings')
    .select('monday_api_token')
    .eq('singleton_id', 1)
    .maybeSingle()
  const tokenInfo = {
    exists: !!appSettings?.monday_api_token,
    last4: appSettings?.monday_api_token ? appSettings.monday_api_token.slice(-4) : null,
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
          Manage languages per project and the Monday API token.
        </p>
      </div>

      <MondayTokenField tokenInfo={tokenInfo} />

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">Projects</h2>
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
    </div>
  )
}
