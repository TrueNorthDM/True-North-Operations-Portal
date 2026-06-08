// Dashboard: overview of both AAAF and HFA sites
// This is a Server Component — data is fetched at request time.

import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { languagePalette } from '@/lib/language-colors'

// Each card carries its project's brand identity — colors + display font + real logo.
const SITES = [
  {
    code: 'aaaf',
    name: 'Ask An Adventist Friend',
    domain: 'askanadventistfriend.com',
    languages: ['EN', 'PT', 'ES', 'SW'],
    href: '/aaaf',
    logo: '/logos/aaaf.jpg',
    logoW: 148,
    logoH: 78,
    cardCls: 'bg-aaaf-soft border-aaaf-primary/30 hover:border-aaaf-primary',
    titleCls: 'text-aaaf-ink font-(family-name:--font-aaaf-display)',
    linkCls: 'text-aaaf-primary',
    badgeCls: 'bg-white/70 text-aaaf-secondary border border-aaaf-primary/20',
  },
  {
    code: 'hfa',
    name: 'Hope For Africa',
    domain: 'hopefor.africa',
    languages: ['EN', 'SW'],
    href: '/hfa',
    logo: '/logos/hfa.png',
    logoW: 300,
    logoH: 83,
    cardCls: 'bg-hfa-soft border-hfa-primary/40 hover:border-hfa-primary',
    titleCls: 'text-hfa-ink font-(family-name:--font-hfa-display) tracking-wide uppercase',
    linkCls: 'text-hfa-secondary',
    badgeCls: 'bg-white/70 text-hfa-secondary border border-hfa-primary/30',
  },
] as const

interface ProjectStats {
  /** Pages shipped in the trailing 14 days (confirmed_done_at within window). */
  recentCompletions: number
  /** Pages we consider "done" overall — fully live OR explicitly set aside. */
  totalDone: number
  /** Pages still pending work. */
  remaining: number
}

export default async function ProjectsPage() {
  // Pages flagged after a language config change, grouped by site
  const supabase = await createClient()
  const { data: stalePages } = await supabase
    .from('pages')
    .select('id, name, site_id, sites!inner(code, name)')
    .eq('needs_hreflang_update', true)
  const staleBySite: Record<string, { id: string; name: string }[]> = { aaaf: [], hfa: [] }
  for (const p of stalePages ?? []) {
    const code = (p.sites as unknown as { code: string }).code
    if (staleBySite[code]) staleBySite[code].push({ id: p.id, name: p.name })
  }
  const totalStale = (stalePages ?? []).length

  // Project-level stats for the cards below each project widget.
  // One query, computed in JS — cheaper than 6 separate COUNT(*) calls.
  const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000
  // This is an async Server Component (renders once per request), so reading the
  // clock at request time is fine despite the render-purity lint rule.
  // eslint-disable-next-line react-hooks/purity
  const twoWeeksAgo = new Date(Date.now() - TWO_WEEKS_MS)
  const { data: allPages } = await supabase
    .from('pages')
    .select('confirmed_done_at, not_relevant, sites!inner(code)')
  const statsBySite: Record<string, ProjectStats> = {
    aaaf: { recentCompletions: 0, totalDone: 0, remaining: 0 },
    hfa:  { recentCompletions: 0, totalDone: 0, remaining: 0 },
  }
  for (const p of allPages ?? []) {
    const code = (p.sites as unknown as { code: string }).code
    const s = statsBySite[code]
    if (!s) continue
    const isDone = p.confirmed_done_at != null || p.not_relevant === true
    if (isDone) s.totalDone++
    else s.remaining++
    // "Recent" = confirmed live in last 14 days. Not-relevant pages don't
    // count here — they were set aside, not shipped.
    if (p.confirmed_done_at && new Date(p.confirmed_done_at) >= twoWeeksAgo) {
      s.recentCompletions++
    }
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
        <p className="text-slate-500 mt-1">
          Manage hreflang tag workflows for AAAF and HFA WordPress sites.
        </p>
      </div>

      {totalStale > 0 && (
        <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-5 space-y-3">
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="text-xl leading-none">⚠</span>
            <div className="flex-1">
              <h3 className="font-semibold text-amber-900">
                {totalStale} {totalStale === 1 ? 'page needs' : 'pages need'} hreflang review
              </h3>
              <p className="text-sm text-amber-800 mt-0.5">
                Language settings changed — re-save URLs on each page (and re-paste the generated hreflang in WordPress) to clear the flag.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(['aaaf', 'hfa'] as const).map(code => {
              const list = staleBySite[code]
              if (list.length === 0) return null
              return (
                <div key={code} className="bg-white border border-amber-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">{code}</span>
                    <a href={`/${code}`} className="text-xs text-amber-700 hover:text-amber-900 font-medium">
                      View all ({list.length}) →
                    </a>
                  </div>
                  <ul className="space-y-1">
                    {list.slice(0, 5).map(p => (
                      <li key={p.id}>
                        <a href={`/${code}/${p.id}`} className="text-sm text-slate-700 hover:text-slate-900 hover:underline truncate block">
                          {p.name}
                        </a>
                      </li>
                    ))}
                    {list.length > 5 && (
                      <li className="text-xs text-slate-500 pt-1">
                        + {list.length - 5} more
                      </li>
                    )}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Site cards — pseudo-element overlay pattern so the card is clickable
          (→ project page) AND the domain inside is independently clickable
          (→ external site). Valid HTML, no JS, fully keyboard accessible. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {SITES.map(site => (
          <div key={site.code} className="flex flex-col gap-3">
          <article
            className={`relative rounded-xl border-2 p-6 transition-all hover:shadow-md ${site.cardCls}`}
          >
            <div className="flex items-stretch gap-5">
              <div className="shrink-0 self-center rounded-lg bg-white border border-slate-200 p-3 w-36 aspect-[3/2] flex items-center justify-center">
                <Image
                  src={site.logo}
                  alt={`${site.name} logo`}
                  width={site.logoW}
                  height={site.logoH}
                  className="object-contain h-auto w-auto max-h-full max-w-full"
                />
              </div>

              <div className="flex-1 min-w-0 flex flex-col justify-between gap-4">
                <div className="min-w-0">
                  {/* Title link — its ::before spans the whole <article>,
                      so any click on the card (outside other links) goes here. */}
                  <h2 className={`text-2xl leading-tight ${site.titleCls}`}>
                    <a
                      href={site.href}
                      className="before:content-[''] before:absolute before:inset-0 before:rounded-xl outline-none focus-visible:before:ring-2 focus-visible:before:ring-offset-2 focus-visible:before:ring-slate-400"
                    >
                      {site.name}
                    </a>
                  </h2>
                  {/* Domain link — `relative z-10` lifts it above the ::before,
                      so clicks here open the external site instead of the title link. */}
                  <a
                    href={`https://${site.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative z-10 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 hover:underline mt-1"
                    aria-label={`Open ${site.domain} in a new tab`}
                  >
                    {site.domain}
                    <span aria-hidden="true">↗</span>
                  </a>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className={`text-sm font-semibold ${site.linkCls}`}>
                    View pages →
                  </span>
                  <div className="flex gap-1.5 flex-wrap justify-end">
                    {site.languages.map(lang => {
                      const langC = languagePalette(lang.toLowerCase())
                      return (
                        <span
                          key={lang}
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${langC.bg} ${langC.text} ${langC.border}`}
                        >
                          {lang}
                        </span>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </article>

          {/* Stats strip — three at-a-glance numbers per project. Lives
              outside the <article> so its clicks aren't swallowed by the
              card-wide ::before link. */}
          <div className="rounded-xl bg-white border border-slate-200 p-4 grid grid-cols-3 divide-x divide-slate-100">
            <StatCell
              value={statsBySite[site.code]?.recentCompletions ?? 0}
              label="Last 2 weeks"
              hint="Pages confirmed live in the last 14 days"
            />
            <StatCell
              value={statsBySite[site.code]?.totalDone ?? 0}
              label="Total done"
              hint="Pages fully live or marked Not relevant"
            />
            <StatCell
              value={statsBySite[site.code]?.remaining ?? 0}
              label="Remaining"
              hint="Pages still requiring work"
              tone="active"
            />
          </div>
          </div>
        ))}
      </div>

      {/* Workflow — end-to-end, in execution order.
          Each step is tagged Auto (system + Monday API do it) or Manual
          (a person, normally SEO 2, does it). The same list serves three
          masters: human instructions, Monday workflow design, and the
          contract for what the API integration must do. */}
      <div className="rounded-lg bg-white border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-800 mb-3">How to do this</h3>

        {/* Legend chips. Two orthogonal axes per step:
              - mode (Auto vs Manual) = WHO does it (system vs human)
              - where (Monday/System/WordPress) = WHERE the action lives
            Combining both lets you scan a step and immediately know if you
            need to open WordPress, check Monday, or watch our dashboard. */}
        <div className="flex flex-wrap items-center gap-2 mb-4 pb-3 border-b border-slate-100 text-[10px] uppercase tracking-wider">
          <span className="text-slate-400 font-semibold">Legend:</span>
          <span className="inline-flex items-center font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Auto</span>
          <span className="inline-flex items-center font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">Manual</span>
          <span className="text-slate-300">·</span>
          <span className="inline-flex items-center font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">Monday</span>
          <span className="inline-flex items-center font-bold px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">System</span>
          <span className="inline-flex items-center font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">WordPress</span>
        </div>

        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">General workflow</div>
        <ol className="space-y-3 text-sm text-slate-600">
          {/* `w` (where) names the primary actor of the step. Cross-boundary
              actions (e.g. system writes to Monday) tag the actor, not the
              destination — answers "where do I look to see this happen?". */}
          {([
            { m: 'auto',   w: 'monday',    t: 'Publishing item moves to Done → Monday automation sets Href Links to "Run Link"' },
            { m: 'auto',   w: 'system',    t: 'Monday webhook fires; the system receives the "Run Link" trigger' },
            { m: 'auto',   w: 'system',    t: 'System verifies the page exists; creates it if missing' },
            { m: 'auto',   w: 'system',    t: 'System reads each language URL from Monday and saves them to the page' },
            { m: 'auto',   w: 'system',    t: 'Once all URLs are present, system generates WordPress-ready hreflang tags' },
            { m: 'auto',   w: 'system',    t: 'System updates Href Links on Monday to "Apply Link"' },
            { m: 'auto',   w: 'monday',    t: 'Monday runs automations: assigns SEO 2 and sends notifications' },
            { m: 'manual', w: 'wordpress', t: 'SEO 2 logs in to WordPress in the browser' },
            { m: 'manual', w: 'wordpress', t: 'SEO 2 opens each language URL from the system and clicks Edit in WordPress' },
            { m: 'manual', w: 'wordpress', t: 'SEO 2 copies the hreflang tags from the system, pastes them into the "custom_hreflang" custom field on each page, and saves', d: 'Select "custom_hreflang" as the field name, paste as value, then click "Add Custom Field" or it will not save.' },
            { m: 'manual', w: 'monday',    t: 'SEO 2 marks every language item for the page as Done in Monday' },
            { m: 'auto',   w: 'system',    t: 'Monday webhook fires; system ticks "Confirmed live" for each language and stamps the All Live date' },
          ] as { m: 'auto' | 'manual'; w: 'monday' | 'system' | 'wordpress'; t: string; d?: string }[]).map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      step.m === 'auto'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {step.m}
                  </span>
                  <span
                    className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                      step.w === 'monday'    ? 'bg-purple-50 text-purple-700 border-purple-200' :
                      step.w === 'system'    ? 'bg-sky-50 text-sky-700 border-sky-200' :
                                               'bg-blue-50 text-blue-700 border-blue-200'
                    }`}
                  >
                    {step.w === 'wordpress' ? 'WordPress' : step.w}
                  </span>
                  <span className="font-medium text-slate-800">{step.t}</span>
                </div>
                {step.d && <div className="text-slate-500 text-xs mt-1">{step.d}</div>}
              </div>
            </li>
          ))}
        </ol>

        {/* Project-specific quality steps — performed by SEO 2 on top of the
            general flow. Kept project-scoped because they differ between sites. */}
        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mt-6 mb-2">AAAF only</div>
        <ul className="space-y-2 text-sm text-slate-600">
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-aaaf-soft text-aaaf-secondary flex items-center justify-center text-[10px] font-bold">A</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">manual</span>
                <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">WordPress</span>
                <span className="font-medium text-slate-800">Remove any canonical tags and allow indexing (Yoast Advanced)</span>
              </div>
              <div className="text-slate-500 text-xs mt-1">Make sure each language version is set to allow indexing.</div>
            </div>
          </li>
        </ul>
      </div>

      {/* Resources — links from the original Sheets Instructions tab */}
      <div className="rounded-lg bg-white border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-800 mb-3">Resources</h3>
        <ul className="space-y-2 text-sm">
          {[
            {
              label: 'ISO 639 language codes (reference)',
              href: 'https://en.wikipedia.org/wiki/List_of_ISO_639_language_codes',
            },
            {
              label: 'Validate hreflang tags',
              href: 'https://technicalseo.com/tools/hreflang/',
              note: 'Each page must use valid ISO 639 codes, self-reference, and have reciprocal tags to every other language.',
            },
            {
              label: 'Google requirements for localized versions',
              href: 'https://developers.google.com/search/docs/specialty/international/localized-versions',
            },
            {
              label: 'Ahrefs hreflang training',
              href: 'https://ahrefs.com/blog/hreflang-tags/',
            },
          ].map(r => (
            <li key={r.href}>
              <a
                href={r.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                {r.label} ↗
              </a>
              {r.note && <span className="text-slate-500 text-xs"> — {r.note}</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/**
 * Single-metric block used in the project stats strip on the dashboard.
 *
 * `tone="active"` is a subtle slate-on-slate look that pulls a tiny bit of
 * attention to the "Remaining" number — it's the one the team actually
 * needs to act on. The other two numbers are diagnostic, not actionable.
 */
function StatCell({
  value,
  label,
  hint,
  tone = 'default',
}: {
  value: number
  label: string
  hint?: string
  tone?: 'default' | 'active'
}) {
  return (
    <div className="px-4 first:pl-2 last:pr-2 flex flex-col" title={hint}>
      <span className={`text-3xl font-extrabold tabular-nums ${
        tone === 'active' ? 'text-slate-900' : 'text-slate-700'
      }`}>
        {value}
      </span>
      <span className="text-xs text-slate-500 mt-1 font-medium">
        {label}
      </span>
    </div>
  )
}
