// One Topic Studio topic (phase 1, 5 November 2026): the tabs of the approved
// mockup. An SEO (topic-studio-seo) works through Setup, Competitors, Topic
// terms, Questions, the Writer workshop and the SEO brief; a writer
// (topic-studio) opens only topics shared with writers and uses the Writer
// workshop and the SEO brief. Originality is phase 4.
//
// The page reads the topic and its captured pages once, runs the analysis
// only for the tabs that show it, and hands each tab plain data
// (lib/topic-studio/views.ts). A topic a writer may not open is "not found",
// so a link cannot tell them a hidden topic exists.

import { notFound, redirect } from 'next/navigation'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Pill } from '@/components/ui/Pill'
import { Tabs, type TabItem } from '@/components/ui/Tabs'
import { requireSurface } from '@/lib/access/resolve'
import { previewHref } from '@/lib/auth/view-as-server'
import { ROUTES, topicStudioTopic } from '@/lib/nav/routes'
import { compList, createAnalysis } from '@/lib/topic-studio/analysis'
import { briefHtml, briefMarkdown, slugOf, termListHtml, termListText, termsCsv } from '@/lib/topic-studio/brief'
import { createAdminClient } from '@/lib/supabase/admin'
import { listClientsFull, listFeedbackRows, loadBundle, topicRole } from '@/lib/topic-studio/store'
import { workshopModel } from '@/lib/topic-studio/workshop'
import { competitorsView, questionsView, termsView } from '@/lib/topic-studio/views'
import { PAGE_TITLE } from '@/lib/ui/type'
import { BriefTab } from './BriefTab'
import { ShareControl } from './ShareControl'
import { WriterTab } from './WriterTab'
import { CompetitorsTab } from './CompetitorsTab'
import { QuestionsTab } from './QuestionsTab'
import { SetupTab } from './SetupTab'
import { TermsTab } from './TermsTab'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Topic Studio' }

const SEO_TABS = ['setup', 'competitors', 'terms', 'questions', 'writer', 'brief'] as const
type Tab = (typeof SEO_TABS)[number]

export default async function TopicPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const access = await requireSurface('tools')
  const role = topicRole(access.canTool)
  if (!role) redirect(await previewHref('/'))
  const { id } = await params
  const db = createAdminClient()
  const b = await loadBundle(db, id, role)
  if (!b) notFound()

  const writer = role === 'writer'
  const { tab: asked } = await searchParams
  const tab: Tab = writer ? (asked === 'brief' ? 'brief' : 'writer') : (SEO_TABS as readonly string[]).includes(asked ?? '') ? (asked as Tab) : 'setup'
  const p = b.project

  // The counts on the tabs need no page text: the competitor list, and the terms with their variants.
  const light = createAnalysis(p, [])
  const captured = compList(p, b.pages).filter(c => c.page).length
  const base = topicStudioTopic(id)
  const items: TabItem<Tab>[] = writer
    ? [{ key: 'writer', label: 'Writer workshop', href: base }, { key: 'brief', label: 'SEO brief', href: `${base}?tab=brief` }]
    : [
        { key: 'setup', label: 'Setup', href: `${base}?tab=setup` },
        { key: 'competitors', label: 'Competitors', count: captured, href: `${base}?tab=competitors` },
        { key: 'terms', label: 'Topic terms', count: light.concepts().length, href: `${base}?tab=terms` },
        { key: 'questions', label: 'Questions', count: p.questions.filter(q => !q.off).length, href: `${base}?tab=questions` },
        { key: 'writer', label: 'Writer workshop', href: `${base}?tab=writer` },
        { key: 'brief', label: 'SEO brief', href: `${base}?tab=brief` },
      ]

  // Everything that reads the captured pages shares one analysis.
  const a = tab === 'setup' ? null : createAnalysis(p, b.pages)

  let content: React.ReactNode = null
  if (tab === 'setup') {
    const clients = await listClientsFull(db)
    content = (
      <SetupTab
        id={id} client={p.client} clients={clients.map(c => ({ code: c.code, name: c.name }))} topic={p.topic} primary={p.primary} monday={p.monday}
        secondary={p.secondary} avoid={p.avoid}
        ai={{ aiOverview: p.aiOverview, aiChatgpt: p.aiChatgpt, aiGemini: p.aiGemini, aiPerplexity: p.aiPerplexity }}
        organic={p.organic} cited={p.cited} archived={b.archived}
      />
    )
  } else if (a && tab === 'competitors') content = <CompetitorsTab id={id} view={competitorsView(a)} />
  else if (a && tab === 'terms') content = <TermsTab id={id} view={termsView(a)} feedback={await listFeedbackRows(db, id)} />
  else if (a && tab === 'writer') content = <WriterTab id={id} initialHtml={b.draft.html} version={b.draft.version} model={workshopModel(a)} />
  else if (a && tab === 'questions') content = <QuestionsTab id={id} view={questionsView(a)} />
  else if (a && tab === 'brief') {
    content = (
      <BriefTab
        id={id} shared={writer ? null : p.shared}
        html={briefHtml(a, b.client.heading)} markdown={briefMarkdown(a, b.client.heading)}
        termListHtml={termListHtml(a)} termListText={termListText(a)} csv={termsCsv(a)}
        slug={slugOf(p.primary, p.topic)} hasTerms={a.concepts().length > 0}
      />
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <Breadcrumb parents={[ROUTES.topicStudio]} now={p.topic} />
          <p className="m-0 mb-1 text-[12.5px] text-muted">
            {b.client.code} · {b.client.name}
            {p.monday && /^https?:\/\//i.test(p.monday) && <> · <a href={p.monday} target="_blank" rel="noopener noreferrer" className="text-tn-teal hover:underline">Open Monday task</a></>}
          </p>
          <h1 className={PAGE_TITLE}>{p.topic}</h1>
          {p.primary && <p className="m-0 mt-1.5"><span className="text-muted">Primary keyphrase</span> <b className="text-tn-ink">{p.primary}</b></p>}
        </div>
        {!writer && (b.archived ? <Pill tone="amber" text="Archived" /> : <ShareControl id={id} shared={p.shared} />)}
      </div>
      {items.length > 1 && <Tabs items={items} value={tab} label="Topic" idPrefix="ts-tab" />}
      {content}
    </div>
  )
}
