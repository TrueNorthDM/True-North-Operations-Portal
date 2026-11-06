// One Topic Studio topic (phase 1, 5 November 2026): the tabs of the approved
// mockup. An SEO (topic-studio-seo) works through Setup, Competitors, Topic
// terms, Questions, the Writer workshop and the SEO brief; a writer
// (topic-studio) opens only topics shared with writers and uses the Writer
// workshop and the SEO brief.
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
import { claudeConfigured } from '@/lib/topic-studio/ai/claude'
import { PROMPT_ORDER } from '@/lib/topic-studio/ai/prompt-defs'
import { loadSettings } from '@/lib/topic-studio/ai/store'
import { featureConfig } from '@/lib/topic-studio/ai/settings'
import { citationsBrief, citationsBriefHtml, citationsBriefMarkdown, citationsView } from '@/lib/topic-studio/citations'
import { discussionSearchLinks, discussionsView } from '@/lib/topic-studio/discussions'
import { originalityBriefHtml, originalityBriefMarkdown, originalityView } from '@/lib/topic-studio/originality'
import { briefHtml, briefMarkdown, slugOf, termListHtml, termListText, termsCsv } from '@/lib/topic-studio/brief'
import { createAdminClient } from '@/lib/supabase/admin'
import { listClientsFull, listFeedbackRows, loadBundle, topicRole } from '@/lib/topic-studio/store'
import { workshopModel } from '@/lib/topic-studio/workshop'
import { competitorsView, questionsView, termsView } from '@/lib/topic-studio/views'
import { PAGE_TITLE } from '@/lib/ui/type'
import type { AiInfo } from './AiBtn'
import { BriefTab } from './BriefTab'
import { CitationsTab } from './CitationsTab'
import { DiscussionsTab } from './DiscussionsTab'
import { InsightsPanel } from './InsightsPanel'
import { OriginalityTab } from './OriginalityTab'
import { ShareControl } from './ShareControl'
import { WriterTab } from './WriterTab'
import { CompetitorsTab } from './CompetitorsTab'
import { QuestionsTab } from './QuestionsTab'
import { SetupTab } from './SetupTab'
import { TermsTab } from './TermsTab'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Topic Studio' }

const SEO_TABS = ['setup', 'competitors', 'terms', 'questions', 'originality', 'citations', 'discussions', 'writer', 'brief'] as const
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
  const tabOn: Record<string, boolean> = { questions: b.project.rules.features.questions, originality: b.project.rules.features.originality, citations: b.project.rules.features.sources, discussions: b.project.rules.features.discussions }
  const tab: Tab = writer ? (asked === 'brief' ? 'brief' : 'writer') : (SEO_TABS as readonly string[]).includes(asked ?? '') && tabOn[asked ?? ''] !== false ? (asked as Tab) : 'setup'
  const p = b.project

  // The counts on the tabs need no page text: the competitor list, and the terms with their variants.
  const light = createAnalysis(p, [])
  const captured = compList(p, b.pages).filter(c => c.page).length
  const base = topicStudioTopic(id)
  const on = p.rules.features
  const items: TabItem<Tab>[] = writer
    ? [{ key: 'writer', label: 'Writer workshop', href: base }, { key: 'brief', label: 'SEO brief', href: `${base}?tab=brief` }]
    : [
        { key: 'setup', label: 'Setup', href: `${base}?tab=setup` },
        { key: 'competitors', label: 'Competitors', count: captured, href: `${base}?tab=competitors` },
        { key: 'terms', label: 'Topic terms', count: light.concepts().length, href: `${base}?tab=terms` },
        ...(on.questions ? [{ key: 'questions', label: 'Questions', count: p.questions.filter(q => !q.off).length, href: `${base}?tab=questions` }] as TabItem<Tab>[] : []),
        ...(on.originality ? [{ key: 'originality', label: 'Originality', href: `${base}?tab=originality` }] as TabItem<Tab>[] : []),
        ...(on.sources ? [{ key: 'citations', label: 'Citations', href: `${base}?tab=citations` }] as TabItem<Tab>[] : []),
        ...(on.discussions ? [{ key: 'discussions', label: 'Discussions', count: discussionsView(b.pages).total, href: `${base}?tab=discussions` }] as TabItem<Tab>[] : []),
        { key: 'writer', label: 'Writer workshop', href: `${base}?tab=writer` },
        { key: 'brief', label: 'SEO brief', href: `${base}?tab=brief` },
      ]

  // Claude's buttons: connected once the key is on the server, each on unless an Admin switched it off.
  const settings = await loadSettings(db)
  const ai: AiInfo = { connected: claudeConfigured(), on: Object.fromEntries(PROMPT_ORDER.map(k => [k, featureConfig(settings.ai, k).on])) }

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
  else if (a && tab === 'terms') content = <TermsTab id={id} view={termsView(a)} feedback={await listFeedbackRows(db, id)} ai={ai} />
  else if (a && tab === 'writer') content = <WriterTab id={id} initialHtml={b.draft.html} version={b.draft.version} model={workshopModel(a)} ai={ai} results={{ review: p.ai.review, placements: p.ai.placements }} />
  else if (a && tab === 'questions') content = <QuestionsTab id={id} view={questionsView(a)} ai={ai} />
  else if (a && tab === 'originality') content = <OriginalityTab id={id} view={originalityView(p.ai, b.client.orig, b.client.faith)} ai={ai} interview={on.interview} />
  else if (a && tab === 'citations') content = <CitationsTab id={id} view={citationsView(a, p.curated, b.client)} />
  else if (a && tab === 'discussions') {
    const dv = discussionsView(b.pages)
    content = (
      <>
        <DiscussionsTab id={id} view={dv} searches={discussionSearchLinks(p.primary || p.topic, b.client.faith)} />
        <InsightsPanel id={id} insights={p.ai.insights} threads={dv.total} ai={ai} />
      </>
    )
  }
  else if (a && tab === 'brief') {
    const cb = citationsBrief(a, p.curated, b.client)
    const extra = { html: [originalityBriefHtml(p.ai, on.interview), citationsBriefHtml(cb)].filter(Boolean).join('\n'), md: [originalityBriefMarkdown(p.ai, on.interview), citationsBriefMarkdown(cb)].filter(Boolean).join('\n\n') }
    content = (
      <BriefTab
        id={id} shared={writer ? null : p.shared}
        html={briefHtml(a, b.client.heading, extra)} markdown={briefMarkdown(a, b.client.heading, extra)}
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
