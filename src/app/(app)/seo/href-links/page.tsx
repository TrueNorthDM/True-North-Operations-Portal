// Href Links overview: both sites at a glance (server component, read at
// request time). Each site's languages and domain come from Settings
// (getProjectsOverview), not from this file (audit, 10 October 2026); only
// each card's branding is written here.

import Link from 'next/link'
import { previewHref } from '@/lib/auth/view-as-server'
import Image from 'next/image'
import { languagePalette } from '@/lib/language-colors'
import { getProjectsOverview } from '@/lib/href-links/data'
import { siteHost } from '@/lib/href-links/rules'
import { StatCell } from '@/components/ProjectStatCell'
import { requireSurface } from '@/lib/access/resolve'
import { redirect } from 'next/navigation'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { ROUTES, hrefLinksSite } from '@/lib/nav/routes'
import { HrefLinksReadError } from '@/components/href-links/ReadError'
import { attempt } from '@/components/href-links/load'

// Each card carries its site's brand: colours, display font and real logo.
const SITES = [
  {
    code: 'aaaf',
    name: 'Ask An Adventist Friend',
    href: hrefLinksSite('aaaf'),
    logo: '/logos/aaaf.jpg',
    logoW: 148,
    logoH: 78,
    brand: '#44ad85', // AAAF green, top accent bar + brand-tinted numbers/links
    cardCls: 'bg-white border-slate-200 hover:border-tn-teal',
    titleCls: 'text-aaaf-ink font-(family-name:--font-aaaf-display)',
    linkCls: 'text-aaaf-primary',
    badgeCls: 'bg-white/70 text-aaaf-secondary border border-aaaf-primary/20',
  },
  {
    code: 'hfa',
    name: 'Hope For Africa',
    href: hrefLinksSite('hfa'),
    logo: '/logos/hfa.png',
    logoW: 300,
    logoH: 83,
    brand: '#fe9d2d', // HFA orange, top accent bar + brand-tinted numbers/links
    cardCls: 'bg-white border-slate-200 hover:border-tn-teal',
    titleCls: 'text-hfa-ink font-(family-name:--font-hfa-display) tracking-wide uppercase',
    linkCls: 'text-hfa-secondary',
    badgeCls: 'bg-white/70 text-hfa-secondary border border-hfa-primary/30',
  },
] as const

// Workflow tag palette, copied verbatim from the handoff: a soft translucent
// fill (colour at ~12% alpha, the `1f` suffix) + saturated text, NO border.
// Literal hex so the chips read identically in light and dark.
const TAG_BASE =
  'inline-flex items-center text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-[5px]'
const TAG_COLOR = {
  auto: 'bg-[#059f6b1f] text-[#059f6b]',
  manual: 'bg-[#d979061f] text-[#c67f0c]',
  monday: 'bg-[#7c3aed1f] text-[#7c3aed]',
  system: 'bg-[#0284c71f] text-[#0284c7]',
  wordpress: 'bg-[#2563eb1f] text-[#2563eb]',
} as const

export default async function ProjectsPage() {
  // Href Links is a tool in the rail's Tools panel (SEO Tools), not a rail
  // item, so it needs the area plus its own team grant.
  const access = await requireSurface('tools')
  if (!access.canTool('href-links')) redirect(await previewHref('/'))

  const overview = await attempt('the overview', getProjectsOverview)
  if (!overview.ok) return <HrefLinksReadError />
  const { accessibleCodes, readyBySite, totalReady, statsBySite, sites } = overview.value
  const visibleSites = SITES.filter(s => accessibleCodes.has(s.code)).map(s => {
    const host = siteHost(sites[s.code]?.domain)
    return { ...s, host, shownDomain: host?.replace(/^www\./, '') ?? null, languages: sites[s.code]?.languages ?? [] }
  })

  return (
    <div className="space-y-8">
      {/* Page header. The trail names where this lives rather than where the
          reader came from: it is a tool in the Tools panel, and the two
          site pages hang off it. */}
      <div>
        <Breadcrumb self={ROUTES.hrefLinks} />
        <h1 className="text-2xl font-extrabold text-tn-ink">Href Links</h1>
        <p className="text-muted mt-1">
          Manage hreflang tag workflows for AAAF and HFA WordPress sites.
        </p>
      </div>

      {/* Compact "ready to apply" banner (handoff 2): one line + per-site jump
          pills. A page is ready when every language has a URL but it isn't live
          yet, so SEO 2 can apply the hreflang now. Each pill links to that
          site's page list; only sites the reader may open are counted. */}
      {totalReady > 0 && (
        <div className="flex items-center gap-3 flex-wrap rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <svg
            aria-hidden="true"
            className="shrink-0 w-[17px] h-[17px] text-amber-700"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <path d="M12 9v4M12 17h.01" />
          </svg>
          <span className="font-(family-name:--font-display) font-extrabold text-[13.5px] text-tn-ink">
            {totalReady} {totalReady === 1 ? 'page is' : 'pages are'} ready to apply
          </span>
          <div className="ml-auto flex gap-2">
            {SITES.map(({ code }) => {
              const list = readyBySite[code] ?? []
              if (list.length === 0) return null
              return (
                <Link
                  key={code}
                  href={hrefLinksSite(code)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white border border-amber-200 px-2.5 py-1 text-[11.5px] font-bold text-amber-700 whitespace-nowrap transition-colors hover:bg-amber-100"
                >
                  <span className="uppercase tracking-wide">{code}</span> · {list.length} →
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Site cards, pseudo-element overlay pattern so the card is clickable
          (to the site's page list) AND the domain inside is independently
          clickable (to the live site). Valid HTML, no JS, keyboard reachable. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {visibleSites.map(site => (
          <article
            key={site.code}
            className={`relative overflow-hidden rounded-xl border transition-all hover:-translate-y-1 hover:shadow-md ${site.cardCls}`}
          >
            {/* Brand accent bar (handoff 2): AAAF green / HFA orange, flush to
                the top edge, clipped to the rounded corners by overflow-hidden. */}
            <div className="h-1" style={{ backgroundColor: site.brand }} aria-hidden="true" />
            <div className="p-6">
            <div className="flex items-stretch gap-5">
              {/* Logo plate stays literally white in both themes, the logo
                  files have white backgrounds, so a themed surface would clash. */}
              <div className="shrink-0 self-center rounded-lg bg-[#fff] p-3 w-36 aspect-[3/2] flex items-center justify-center">
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
                  {/* Title link, its ::before spans the whole <article>,
                      so any click on the card (outside other links) goes here. */}
                  <h2 className={`text-2xl leading-tight ${site.titleCls}`}>
                    <Link
                      href={site.href}
                      className="before:content-[''] before:absolute before:inset-0 before:rounded-xl outline-none focus-visible:before:ring-2 focus-visible:before:ring-offset-2 focus-visible:before:ring-slate-400"
                    >
                      {site.name}
                    </Link>
                  </h2>
                  {/* Domain link, `relative z-10` lifts it above the ::before,
                      so clicks here open the external site instead of the title link. */}
                  {site.host && (
                    <a
                      href={`https://${site.host}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative z-10 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 hover:underline mt-1"
                      aria-label={`Open ${site.shownDomain} in a new tab`}
                    >
                      {site.shownDomain}
                      <span aria-hidden="true">↗</span>
                    </a>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3">
                  <div className="flex gap-1.5 flex-wrap justify-end">
                    {site.languages.map(lang => {
                      const langC = languagePalette(lang.toLowerCase())
                      return (
                        <span
                          key={lang}
                          className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${langC.bg} ${langC.text} ${langC.border}`}
                        >
                          {lang}
                        </span>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
            </div>

            {/* Stats: three at-a-glance numbers, unified into the card with a
                top-border divider (matches the handoff). Non-interactive, so
                sitting under the card-wide ::before link is harmless. */}
            <div className="grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-200">
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
                color={site.brand}
              />
            </div>
          </article>
        ))}
      </div>

      {/* Workflow: end-to-end, in execution order.
          Each step is tagged Auto (system + Monday API do it) or Manual
          (a person, normally SEO 2, does it). The same list serves three
          masters: human instructions, Monday workflow design, and the
          contract for what the API integration must do. */}
      <div className="rounded-lg bg-white border border-slate-200 p-5">
        <h3 className="font-(family-name:--font-display) font-extrabold text-tn-ink mb-3">How to do this</h3>

        {/* Legend chips. Two orthogonal axes per step:
              - mode (Auto vs Manual) = WHO does it (system vs human)
              - where (Monday/System/WordPress) = WHERE the action lives
            Combining both lets you scan a step and immediately know if you
            need to open WordPress, check Monday, or watch our dashboard. */}
        <div className="flex flex-wrap items-center gap-2 mb-4 pb-3 border-b border-slate-100 text-[10px] uppercase tracking-wider">
          <span className="text-slate-400 font-semibold">Legend:</span>
          <span className={`${TAG_BASE} ${TAG_COLOR.auto}`}>Auto</span>
          <span className={`${TAG_BASE} ${TAG_COLOR.manual}`}>Manual</span>
          <span className="text-slate-300">·</span>
          <span className={`${TAG_BASE} ${TAG_COLOR.monday}`}>Monday</span>
          <span className={`${TAG_BASE} ${TAG_COLOR.system}`}>System</span>
          <span className={`${TAG_BASE} ${TAG_COLOR.wordpress}`}>WordPress</span>
        </div>

        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">General workflow</div>
        <ol className="space-y-3 text-sm text-slate-600">
          {/* `w` (where) names the primary actor of the step. Cross-boundary
              actions (e.g. system writes to Monday) tag the actor, not the
              destination, answers "where do I look to see this happen?". */}
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
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-(family-name:--font-display) font-extrabold">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2 flex-wrap">
                  <span className={`${TAG_BASE} ${TAG_COLOR[step.m]}`}>
                    {step.m}
                  </span>
                  <span className={`${TAG_BASE} ${TAG_COLOR[step.w]}`}>
                    {step.w === 'wordpress' ? 'WordPress' : step.w}
                  </span>
                  <span className="font-bold text-tn-ink">{step.t}</span>
                </div>
                {step.d && <div className="text-muted text-xs mt-1">{step.d}</div>}
              </div>
            </li>
          ))}
        </ol>

        {/* Project-specific quality steps, performed by SEO 2 on top of the
            general flow. Kept project-scoped because they differ between sites. */}
        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mt-6 mb-2">AAAF only</div>
        <ul className="space-y-2 text-sm text-slate-600">
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-aaaf-soft text-aaaf-secondary flex items-center justify-center text-[10px] font-bold">A</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`${TAG_BASE} ${TAG_COLOR.manual}`}>manual</span>
                <span className={`${TAG_BASE} ${TAG_COLOR.wordpress}`}>WordPress</span>
                <span className="font-bold text-tn-ink">Remove any canonical tags and allow indexing (Yoast Advanced)</span>
              </div>
              <div className="text-muted text-xs mt-1">Make sure each language version is set to allow indexing.</div>
            </div>
          </li>
        </ul>
      </div>

      {/* Resources: links from the original Sheets Instructions tab */}
      <div className="rounded-lg bg-white border border-slate-200 p-5">
        <h3 className="font-(family-name:--font-display) font-extrabold text-tn-ink mb-3">Resources</h3>
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
                className="text-tn-teal font-bold hover:underline"
              >
                {r.label} ↗
              </a>
              {r.note && <span className="text-muted">, {r.note}</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
