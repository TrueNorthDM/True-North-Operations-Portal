// AAAF: page detail (Server Component)
// Fetches one page with its URLs + confirmations, renders the shared editor.

import { notFound, redirect } from 'next/navigation'
import { requireSurface } from '@/lib/access/resolve'
import { createClient } from '@/lib/supabase/server'
import { PageDetail } from '@/components/PageDetail'

export default async function AaafPageDetail({ params }: { params: Promise<{ id: string }> }) {
  // Href Link Management, so the area plus its team grant. /aaaf was guarded
  // but this detail page was not.
  const access = await requireSurface('tools')
  if (!access.canTool('href-links')) redirect('/work-tools')

  const { id } = await params
  const supabase = await createClient()

  const { data: site } = await supabase
    .from('sites')
    .select('languages')
    .eq('code', 'aaaf')
    .single()

  const { data: page } = await supabase
    .from('pages')
    .select('id, name, needs_hreflang_update, confirmed_done_at, not_relevant, page_urls(language_code, url), confirmations(language_code, confirmed_on_live)')
    .eq('id', id)
    .maybeSingle()

  if (!page) notFound()

  return (
    <PageDetail
      pageId={page.id}
      siteCode="aaaf"
      pageName={page.name}
      languages={site?.languages ?? ['en', 'pt', 'es', 'sw']}
      savedUrls={page.page_urls ?? []}
      confirmations={page.confirmations ?? []}
      accent="aaaf"
      needsUpdate={page.needs_hreflang_update}
      confirmedDoneAt={page.confirmed_done_at}
      notRelevant={page.not_relevant ?? false}
    />
  )
}
