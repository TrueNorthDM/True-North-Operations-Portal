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
};

export default nextConfig;
