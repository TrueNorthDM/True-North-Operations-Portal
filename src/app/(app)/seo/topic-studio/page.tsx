// Topic Studio: the list of topic briefs (phase 0, 5 November 2026; mockup
// Design/Topic Studio mockup, approved by the owner the same day).
//
// Two grants behind one page (lib/access/tools.ts): the SEO team sees every
// topic and imports the Artifact's .topic-studio.json files; the Writers team
// sees only the topics shared with writers. SEOs start a topic here (phase 1)
// or import one from the Artifact.

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Pill } from '@/components/ui/Pill'
import { requireSurface } from '@/lib/access/resolve'
import { previewHref } from '@/lib/auth/view-as-server'
import { ROUTES, topicStudioTopic } from '@/lib/nav/routes'
import { formatDate } from '@/lib/directory/people-types'
import { zoneDate } from '@/lib/notifications/schedule'
import { createAdminClient } from '@/lib/supabase/admin'
import { listArchived, listClientsFull, listTopics, topicRole } from '@/lib/topic-studio/store'
import { CARD, PAGE_TITLE, SECTION_TITLE, TH } from '@/lib/ui/type'
import { segClass, SEG_BOX } from '@/lib/ui/segmented'
import { ImportDialog } from './ImportDialog'
import { NewTopicForm } from './NewTopicForm'
import { RestoreButton } from './RestoreButton'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Topic Studio' }

export default async function TopicStudioPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const access = await requireSurface('tools')
  const role = topicRole(access.canTool)
  if (!role) redirect(await previewHref('/'))
  const writer = role === 'writer'

  const db = createAdminClient()
  const { topics, clients } = await listTopics(db, role)
  const [archived, startable] = writer ? [[], []] : await Promise.all([listArchived(db), listClientsFull(db)])
  const { client: picked } = await searchParams
  const codes = [...new Set([...clients.map(c => c.code), ...topics.map(t => t.client_code)])]
  const client = picked && codes.includes(picked) ? picked : 'all'
  const count = (code: string) => topics.filter(t => t.client_code === code).length
  const rows = client === 'all' ? topics : topics.filter(t => t.client_code === client)
  const filterHref = (code: string) => (code === 'all' ? ROUTES.topicStudio : `${ROUTES.topicStudio}?client=${encodeURIComponent(code)}`)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <Breadcrumb self={ROUTES.topicStudio} />
          <h1 className={PAGE_TITLE}>Topic Studio</h1>
          <p className="text-muted mt-1">
            {writer
              ? 'SEO topic briefs and the writer workshop. You see the topics an SEO has shared with writers.'
              : 'SEO topic briefs and the writer workshop. Research a topic, build the brief, share it with a writer.'}
          </p>
        </div>
        {!writer && <ImportDialog />}
      </div>

      {!writer && startable.length > 0 && <NewTopicForm clients={startable.map(c => ({ code: c.code, name: c.name }))} />}

      <section className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 border-b border-[var(--panel-border)]">
          <h2 className={SECTION_TITLE}>Topics</h2>
          {codes.length > 1 && (
            <nav aria-label="Client" className={SEG_BOX}>
              <Link href={filterHref('all')} className={segClass(client === 'all')} aria-current={client === 'all' ? 'page' : undefined}>All clients {topics.length}</Link>
              {codes.map(code => (
                <Link key={code} href={filterHref(code)} className={segClass(client === code)} aria-current={client === code ? 'page' : undefined}>{code} {count(code)}</Link>
              ))}
            </nav>
          )}
        </div>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr>
                  <th className={TH}>Client</th>
                  <th className={TH}>Topic</th>
                  <th className={TH}>Primary keyphrase</th>
                  {!writer && <th className={TH}>Writers</th>}
                  <th className={TH}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(t => (
                  <tr key={t.id} className="border-b border-[var(--row-rule)] last:border-0 hover:bg-[var(--row-hover)]">
                    <td className="px-4 py-3 font-(family-name:--font-display) font-extrabold text-[12px] text-muted">{t.client_code}</td>
                    <td className="px-4 py-3 font-semibold text-tn-ink"><Link href={topicStudioTopic(t.id)} className="text-tn-teal hover:underline">{t.topic}</Link></td>
                    <td className="px-4 py-3 text-foreground">{t.primary_keyphrase}</td>
                    {!writer && <td className="px-4 py-3">{t.shared ? <Pill tone="green" text="Shared" /> : <Pill tone="gray" text="Draft" />}</td>}
                    <td className="px-4 py-3 text-muted tabular-nums whitespace-nowrap">{formatDate(zoneDate(new Date(t.updated_at)))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="m-0 px-4 py-6 text-muted">
            {topics.length ? 'No topics for this client yet.'
              : writer ? 'No topics have been shared with writers yet.'
              : 'No topics yet. Import the .topic-studio.json files exported from the Topic Studio Artifact.'}
          </p>
        )}
      </section>

      {archived.length > 0 && (
        <details className={`${CARD} p-4`}>
          <summary className={`${SECTION_TITLE} cursor-pointer`}>Archived topics ({archived.length})</summary>
          <ul className="m-0 mt-3 list-none p-0">
            {archived.map(t => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 border-b border-[var(--row-rule)] py-2.5 text-[13px] last:border-0">
                <span className="w-9 shrink-0 font-(family-name:--font-display) text-[12px] font-extrabold text-muted">{t.client_code}</span>
                <Link href={topicStudioTopic(t.id)} className="min-w-[200px] flex-1 font-semibold text-tn-teal hover:underline">{t.topic}</Link>
                <RestoreButton id={t.id} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
