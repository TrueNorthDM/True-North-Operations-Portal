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
    '/work-tools/time-report/pdf': ['./node_modules/@sparticuz/chromium/**'],
    '/work-tools/time-report/image': ['./node_modules/@sparticuz/chromium/**'],
  },
  // Tools & Dashboards became Work Tools on 18 September 2026, and its pages
  // moved from /tools to /work-tools. Every old link (bookmarks, Slack, the
  // PDFs already sent) lands on the same page at its new address, query string
  // kept. Temporary (307) rather than permanent so no browser caches it for
  // good in case the name moves again.
  async redirects() {
    return [
      { source: '/tools/:path*', destination: '/work-tools/:path*', permanent: false },
    ];
  },
};

export default nextConfig;
