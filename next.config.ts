import type { NextConfig } from "next";

// TypeScript errors now block the production build again. The old
// `typescript.ignoreBuildErrors` escape hatch (added when Supabase queries
// resolved to `never`) was removed during the 2026-07 audit once the
// hand-written database types were completed and every module passed `tsc`.
const nextConfig: NextConfig = {
  // Keep the headless-Chromium packages out of the bundler so @sparticuz/chromium
  // can find + extract its binary at runtime on Vercel (used by the i7 report's
  // server-side PDF route). Bundling them corrupts the binary / blows size limits.
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  // @sparticuz/chromium loads its brotli binary via a runtime path Next's file
  // tracer can't see, so force it into the PDF route's serverless function.
  outputFileTracingIncludes: {
    '/ops/client-reports/i7/pdf': ['./node_modules/@sparticuz/chromium/**'],
    '/ops/client-reports/i7/image': ['./node_modules/@sparticuz/chromium/**'],
  },
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
      r('/boards-beta', '/ops/boards'),
      r('/boards-beta/:path*', '/ops/boards/:path*'),
      r('/projects', '/seo/href-links'),
      r('/aaaf', '/seo/href-links/aaaf'),
      r('/aaaf/:path*', '/seo/href-links/aaaf/:path*'),
      r('/hfa', '/seo/href-links/hfa'),
      r('/hfa/:path*', '/seo/href-links/hfa/:path*'),
    ];
  },
};

export default nextConfig;
