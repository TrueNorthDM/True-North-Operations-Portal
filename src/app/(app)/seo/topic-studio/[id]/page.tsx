// One Topic Studio topic (phase 0, 5 November 2026). For now a read-only
// overview of what the import brought: keyphrases, terms by relevance and the
// questions marked for headings. The tabs of the mockup (Setup, Competitors,
// Topic terms, Questions, Originality for SEOs; Writer workshop and SEO brief
// for everyone) are built on this page in phases 1 and 2.
//
// A writer opens only topics shared with writers; anything else is "not found",
// so a link cannot tell them a hidden topic exists.

import { notFound, redirect } from 'next/navigation'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Pill } from '@/components/ui/Pill'
import { requireSurface } from '@/lib/access/resolve'
import { previewHref } from '@/lib/auth/view-as-server'
import { ROUTES } from '@/lib/nav/routes'
import { formatDate } from '@/lib/directory/people-types'
import { zoneDate } from '@/lib/notifications/schedule'
import { createAdminClient } from '@/lib/supabase/admin'
import { readTopic, topicRole } from '@/lib/topic-studio/store'
import { CARD, CARD_TITLE, FIELD_LABEL, PAGE_TITLE } from '@/lib/ui/type'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Topic Studio' }

type Term = { t?: unknown; tier?: unknown }
type Question = { q?: unknown; heading?: unknown; off?: unknown }

const lines = (v: unknown) => (typeof v === 'string' ? v.split('\n').map(s => s.trim()).filter(Boolean) : [])
const list = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])

export default async function TopicPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireSurface('tools')
  const role = topicRole(access.canTool)
  if (!role) redirect(await previewHref('/'))
  const { id } = await params
  const t = await readTopic(createAdminClient(), id, role)
  if (!t) notFound()

  const d = t.data
  const terms = list<Term>(d.terms).filter(x => typeof x.t === 'string')
  const tier = (name: string) => terms.filter(x => x.tier === name).map(x => String(x.t))
  const headings = list<Question>(d.questions).filter(q => q.heading && !q.off && typeof q.q === 'string').map(q => String(q.q))
  const answerTop = list<unknown>(d.answerTop).filter((x): x is string => typeof x === 'string')
  const secondary = lines(d.secondary)
  const avoid = lines(d.avoid)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <Breadcrumb parents={[ROUTES.topicStudio]} now={t.topic} />
          <p className="m-0 mb-1 text-[12.5px] text-muted">
            {t.client_code} · {t.client_name}
            {t.monday_url && <> · <a href={t.monday_url} target="_blank" rel="noopener noreferrer" className="text-tn-teal hover:underline">Open Monday task</a></>}
          </p>
          <h1 className={PAGE_TITLE}>{t.topic}</h1>
          {t.primary_keyphrase && <p className="m-0 mt-1.5"><span className="text-muted">Primary keyphrase</span> <b className="text-tn-ink">{t.primary_keyphrase}</b></p>}
        </div>
        {role === 'seo' && (t.shared ? <Pill tone="green" text="Shared with writers" /> : <Pill tone="gray" text="Draft" />)}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--panel-border)] bg-tn-teal-soft px-4 py-3 text-[13px] text-tn-ink">
        <span>
          The workshop tabs are coming to the portal next ({role === 'seo' ? 'Setup, Competitors, Topic terms, Questions, Originality, ' : ''}Writer workshop and SEO brief). Until then, keep working on this topic in the Topic Studio Artifact.
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className={`${CARD} p-5 space-y-3`}>
          <h2 className={CARD_TITLE}>Keyphrases</h2>
          <div>
            <div className={FIELD_LABEL}>Secondary</div>
            {secondary.length ? <ul className="m-0 mt-1.5 pl-5 space-y-1">{secondary.map(s => <li key={s}>{s}</li>)}</ul> : <p className="m-0 mt-1.5 text-muted">None.</p>}
          </div>
          {avoid.length > 0 && (
            <div>
              <div className={FIELD_LABEL}>Terms to avoid</div>
              <p className="m-0 mt-1.5">{avoid.join(', ')}</p>
            </div>
          )}
        </section>

        <section className={`${CARD} p-5 space-y-3`}>
          <h2 className={CARD_TITLE}>This topic</h2>
          <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-[13px]">
            <dt className="text-muted">Topic terms</dt><dd className="m-0 text-tn-ink font-semibold tabular-nums">{terms.length}</dd>
            <dt className="text-muted">Questions for headings</dt><dd className="m-0 text-tn-ink font-semibold tabular-nums">{headings.length}</dd>
            <dt className="text-muted">Competitor pages</dt><dd className="m-0 text-tn-ink font-semibold tabular-nums">{t.pages}</dd>
            <dt className="text-muted">Updated in the Artifact</dt><dd className="m-0 text-tn-ink tabular-nums">{t.artifact_updated_at ? formatDate(zoneDate(new Date(t.artifact_updated_at))) : '-'}</dd>
            <dt className="text-muted">Imported</dt><dd className="m-0 text-tn-ink tabular-nums">{t.imported_at ? formatDate(zoneDate(new Date(t.imported_at))) : '-'}</dd>
          </dl>
        </section>
      </div>

      {answerTop.length > 0 && (
        <section className={`${CARD} p-5`}>
          <h2 className={CARD_TITLE}>Answer near the top</h2>
          <ul className="m-0 mt-3 pl-5 space-y-1.5">{answerTop.map(a => <li key={a}>{a}</li>)}</ul>
        </section>
      )}

      {terms.length > 0 && (
        <section className={`${CARD} p-5 space-y-3`}>
          <h2 className={CARD_TITLE}>Key terms</h2>
          {(['high', 'medium', 'low'] as const).map(level => tier(level).length > 0 && (
            <p key={level} className="m-0"><span className="text-muted capitalize">{level}:</span> {tier(level).join(', ')}</p>
          ))}
        </section>
      )}

      {headings.length > 0 && (
        <section className={`${CARD} p-5`}>
          <h2 className={CARD_TITLE}>Questions to answer</h2>
          <ul className="m-0 mt-3 pl-5 space-y-1.5">{headings.map(q => <li key={q}>{q}</li>)}</ul>
        </section>
      )}
    </div>
  )
}
