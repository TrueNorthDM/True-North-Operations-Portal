// HFA — page detail (Server Component)
// Fetches one page with its URLs + confirmations, renders the shared editor.
// HFA additionally tracks GSC indexing, so showGsc is true.

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageDetail } from '@/components/PageDetail'

export default async function HfaPageDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: site } = await supabase
    .from('sites')
    .select('languages')
    .eq('code', 'hfa')
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
      siteCode="hfa"
      pageName={page.name}
      languages={site?.languages ?? ['en', 'sw']}
      savedUrls={page.page_urls ?? []}
      confirmations={page.confirmations ?? []}
      accent="hfa"
      showGsc={true}
      needsUpdate={page.needs_hreflang_update}
      mondayStatus={page.monday_status as 'pending' | 'in_progress' | 'done'}
      mondayLangStatus={page.monday_lang_status as Record<string, boolean>}
      confirmedDoneAt={page.confirmed_done_at}
      notRelevant={page.not_relevant ?? false}
    />
  )
}
