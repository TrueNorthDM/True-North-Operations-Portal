import type { NextConfig } from "next";

// TypeScript errors now block the production build again. The old
// `typescript.ignoreBuildErrors` escape hatch (added when Supabase queries
// resolved to `never`) was removed during the 2026-07 audit once the
// hand-written database types were completed and every module passed `tsc`.
const nextConfig: NextConfig = {
  // puppeteer-core drives the server's Chromium for the PDF and image exports
  // (lib/pdf/browser.ts); it stays out of the bundler.
  serverExternalPackages: ['puppeteer-core'],
  // Old addresses keep working. Every rule lands in one hop, the query string
  // kept, and all are temporary (307) so no browser caches them for good in
  // case a name moves again. Order matters: first match wins, and grant-pass
  // sits under time-report, so its rules come first.
  //
  //   18 September 2026: Tools & Dashboards became Work Tools, /tools moved to
  //     /work-tools.
  //   22 September 2026: the navigation redesign (Design/Redesign Handoff).
  //     Work Tools was dissolved into the Tools panel of the rail: the client
  //     reports, Publishing Goals and Boards moved under /ops, Href Links
  //     under /seo. PDFs already sent link to /work-tools/time-report and
  //     /tools/time-report; both are covered.
  // Only the portal itself may show the portal in a frame: View Stage's
  // columns are same-origin iframes, and nothing else should ever embed a
  // signed-in page (clickjacking). CSP for current browsers, X-Frame-Options
  // for older ones. (Audit, 8 October 2026.)
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      ],
    }]
  },
  async redirects() {
    const r = (source: string, destination: string) => ({ source, destination, permanent: false })
    return [
      r('/tools/time-report/grant-pass', '/ops/client-reports/project-hours'),
      r('/tools/time-report/grant-pass/:path*', '/ops/client-reports/project-hours/:path*'),
      r('/work-tools/time-report/grant-pass', '/ops/client-reports/project-hours'),
      r('/work-tools/time-report/grant-pass/:path*', '/ops/client-reports/project-hours/:path*'),
      r('/tools/time-report', '/ops/client-reports/i7'),
      r('/tools/time-report/:path*', '/ops/client-reports/i7/:path*'),
      r('/work-tools/time-report', '/ops/client-reports/i7'),
      r('/work-tools/time-report/:path*', '/ops/client-reports/i7/:path*'),
      r('/tools', '/'),
      r('/tools/:path*', '/'),
      r('/work-tools', '/'),
      r('/dashboards', '/ops/publishing'),
      r('/dashboards/publishing', '/ops/publishing'),
      // Boards was removed on 23 September 2026; its addresses land on Publishing Goals.
      r('/boards-beta', '/ops/publishing'),
      r('/boards-beta/:path*', '/ops/publishing'),
      r('/ops/boards', '/ops/publishing'),
      r('/ops/boards/:path*', '/ops/publishing'),
      r('/projects', '/seo/href-links'),
      r('/aaaf', '/seo/href-links/aaaf'),
      r('/aaaf/:path*', '/seo/href-links/aaaf/:path*'),
      r('/hfa', '/seo/href-links/hfa'),
      r('/hfa/:path*', '/seo/href-links/hfa/:path*'),
    ];
  },
};

export default nextConfig;
