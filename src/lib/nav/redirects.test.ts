import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import nextConfig from '../../../next.config'

// Every old address still lands somewhere real, in one hop, with its tail and
// its query kept. PDFs already sent link to /work-tools/time-report and
// /tools/time-report; bookmarks to everything else that moved on 22 September
// 2026 (the navigation redesign).

type Rule = { source: string; destination: string }

/** The first rule that matches, as Next applies them: a fixed path, or a prefix with its tail. */
function resolve(rules: Rule[], path: string): string | null {
  const [pathname, query] = path.split('?')
  for (const r of rules) {
    if (r.source.endsWith('/:path*')) {
      const base = r.source.slice(0, -'/:path*'.length)
      if (pathname === base || pathname.startsWith(base + '/')) {
        const tail = pathname.slice(base.length).replace(/^\//, '')
        const dest = r.destination.endsWith('/:path*')
          ? r.destination.slice(0, -'/:path*'.length) + (tail ? `/${tail}` : '')
          : r.destination
        return query ? `${dest}?${query}` : dest
      }
    } else if (pathname === r.source) {
      return query ? `${r.destination}?${query}` : r.destination
    }
  }
  return null
}

/** Does a route exist for this address under src/app? Dynamic segments match anything. */
function routeExists(pathname: string): boolean {
  const roots = [join('src', 'app', '(app)'), join('src', 'app')]
  const parts = pathname.split('/').filter(Boolean)
  const walk = (dir: string, i: number): boolean => {
    if (i === parts.length) return ['page.tsx', 'route.ts'].some(f => existsSync(join(dir, f)))
    if (existsSync(join(dir, parts[i])) && walk(join(dir, parts[i]), i + 1)) return true
    const dynamic = existsSync(dir) ? readdirSync(dir).filter(d => d.startsWith('[')) : []
    return dynamic.some(d => walk(join(dir, d), i + 1))
  }
  return roots.some(r => walk(r, 0))
}

const OLD: [string, string][] = [
  ['/tools', '/'],
  ['/work-tools', '/'],
  ['/tools/time-report?month=2026-07', '/ops/client-reports/i7?month=2026-07'],
  ['/work-tools/time-report?month=2026-07', '/ops/client-reports/i7?month=2026-07'],
  ['/work-tools/time-report/pdf?month=2026-07&type=client', '/ops/client-reports/i7/pdf?month=2026-07&type=client'],
  ['/work-tools/time-report/guide', '/ops/client-reports/i7/guide'],
  ['/work-tools/time-report/grant-pass', '/ops/client-reports/project-hours'],
  ['/tools/time-report/grant-pass/donations', '/ops/client-reports/project-hours/donations'],
  ['/dashboards', '/ops/publishing'],
  ['/dashboards/publishing', '/ops/publishing'],
  ['/boards-beta', '/ops/publishing'],
  ['/boards-beta/targets', '/ops/publishing'],
  ['/ops/boards', '/ops/publishing'],
  ['/ops/boards/translation', '/ops/publishing'],
  ['/projects', '/seo/href-links'],
  ['/aaaf', '/seo/href-links/aaaf'],
  ['/aaaf/42', '/seo/href-links/aaaf/42'],
  ['/hfa/7', '/seo/href-links/hfa/7'],
]

describe('redirects from the old addresses', async () => {
  const rules = (await nextConfig.redirects!()) as Rule[]

  it.each(OLD)('sends %s to %s', (from, to) => {
    expect(resolve(rules, from)).toBe(to)
  })

  it.each(OLD)('lands %s on a real route, in one hop', (from) => {
    const to = resolve(rules, from)!
    expect(resolve(rules, to), `${to} is redirected again`).toBeNull()
    expect(routeExists(to.split('?')[0]), `${to} has no route`).toBe(true)
  })

  it('keeps them all temporary', () => {
    for (const r of rules as (Rule & { permanent: boolean })[]) expect(r.permanent, r.source).toBe(false)
  })
})
