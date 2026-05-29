// AAAF — page detail (Server Component)
// Fetches one page with its URLs + confirmations, renders the shared editor.

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageDetail } from '@/components/PageDetail'

export default async function AaafPageDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: site } = await supabase
    .from('sites')
    .select('languages')
    .eq('code', 'aaaf')
    .single()

  const { data: page } = await supabase
    .from('pages')
    .select('id, name, needs_hreflang_update, monday_status, monday_lang_status, confirmed_done_at, not_relevant, page_urls(language_code, url), confirmations(language_code, confirmed_on_live, indexed_in_gsc)')
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
      showGsc={false}
      needsUpdate={page.needs_hreflang_update}
      mondayStatus={page.monday_status as 'pending' | 'in_progress' | 'done'}
      mondayLangStatus={page.monday_lang_status as Record<string, boolean>}
      confirmedDoneAt={page.confirmed_done_at}
      notRelevant={page.not_relevant ?? false}
    />
  )
}
